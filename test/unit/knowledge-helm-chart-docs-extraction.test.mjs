import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { writeKnowledgeCacheEntry } from '../../src/knowledge/cache.ts';
import { parseKnowledgeFactSet } from '../../src/knowledge/facts-contract.ts';
import { extractKnowledgeFactSetFromCacheEntry } from '../../src/knowledge/facts.ts';

const API_CHART_DOCS_MARKDOWN = [
  '# API chart',
  '',
  '| Parameter | Type | Default | Description | Required |',
  '| --- | --- | --- | --- | --- |',
  '| `image.repository` | string | `ghcr.io/example/api` | Container image repository. | yes |',
  '| `service.port` | int | `8080` | Service port exposed by the chart. | no |',
  '| `secretToken` | string | `token` | Secret token that must not become reusable context. | no |',
  '',
  '- `ingress.enabled` - Enables ingress resources.',
  '',
  '## resources.requests.cpu',
  '',
  'CPU request for the deployment.',
  ''
].join('\n');

test('knowledge fact extractor summarizes cached Helm chart docs markdown', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-facts-chart-docs-'));

  try {
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source: {
        kind: 'chart-docs',
        name: 'api:home',
        chart: 'api',
        version: '0.2.0',
        url: 'https://charts.example.test/api/'
      },
      contentType: 'text/markdown',
      content: API_CHART_DOCS_MARKDOWN,
      fetchedAt: '2026-05-05T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry, {
      now: new Date('2026-05-06T00:00:00.000Z')
    });

    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'chart-value'
      && fact.path === 'chart.api.image.repository'
      && fact.summary === 'Container image repository.'
      && fact.required === true
      && fact.type === 'string'
      && fact.defaultValue === 'ghcr.io/example/api'
      && fact.confidence === 'medium'
      && fact.extractionMethod === 'helm-chart-docs-markdown'
      && fact.source.locator === 'Chart docs: image.repository'
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.path === 'chart.api.service.port'
      && fact.required === false
      && fact.type === 'int'
      && fact.defaultValue === '8080'
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.path === 'chart.api.ingress.enabled'
      && fact.summary === 'Enables ingress resources.'
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.path === 'chart.api.resources.requests.cpu'
      && fact.summary === 'CPU request for the deployment.'
    ));
    assert.equal(factSet.facts.some(fact =>
      /secretToken|Secret token/i.test(JSON.stringify(fact))
    ), false);
    assert.equal(parseKnowledgeFactSet(factSet).factCount, factSet.facts.length);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge fact extractor ignores HTML-shaped Helm chart docs cache entries', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-facts-chart-docs-html-'));

  try {
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source: {
        kind: 'chart-docs',
        name: 'api:home',
        chart: 'api',
        url: 'https://charts.example.test/api/'
      },
      contentType: 'text/markdown',
      content: '<!doctype html><html><body><h1>API chart</h1></body></html>',
      fetchedAt: '2026-05-05T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry);

    assert.equal(factSet.factCount, 0);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
