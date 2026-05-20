import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve
} from 'node:path';
import { buildHelmChartKnowledgeSources } from '../../src/domain/helm-chart-context.ts';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { writeKnowledgeCacheEntry } from '../../src/knowledge/cache.ts';
import { parseKnowledgeFactSet } from '../../src/knowledge/facts-contract.ts';
import { extractKnowledgeFactSetFromCacheEntry } from '../../src/knowledge/facts.ts';
import { extractWorkspaceKnowledgeFacts } from '../../src/knowledge/extract.ts';
import { createFileKnowledgeStore } from '../../src/knowledge/knowledge-store.ts';
import { extractMarkdownKnowledgeUnitsFromCacheEntry } from '../../src/knowledge/markdown-units.ts';
import { buildKnowledgePack } from '../../src/knowledge/pack.ts';

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

const API_CHART_DOCS_WITH_EXAMPLE_VALUES_MARKDOWN = [
  '# API chart',
  '',
  '## Values',
  '',
  '| Key | Type | Default | Description |',
  '| --- | --- | --- | --- |',
  '| `image.repository` | string | `ghcr.io/example/api` | Container image repository. |',
  '',
  '## Example Values',
  '',
  '```yaml',
  'image:',
  '  repository: ghcr.io/example/api',
  'example:',
  '  enabled: true',
  '```',
  '',
  '## Usage',
  '',
  '- `example.enabled` - Example-only value that should not become a chart fact.',
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

test('Helm chart docs keep example values as example units instead of chart facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-facts-chart-docs-example-values-'));

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
      content: API_CHART_DOCS_WITH_EXAMPLE_VALUES_MARKDOWN,
      fetchedAt: '2026-05-05T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry, {
      now: new Date('2026-05-06T00:00:00.000Z')
    });
    const units = extractMarkdownKnowledgeUnitsFromCacheEntry(entry, factSet);

    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'chart-value'
      && fact.path === 'chart.api.image.repository'
      && fact.summary === 'Container image repository.'
    ));
    assert.equal(factSet.facts.some(fact =>
      fact.path === 'chart.api.example_values'
      || fact.path === 'chart.api.example.enabled'
      || fact.summary.includes('```yaml')
    ), false);
    assert.ok(units.some(unit =>
      unit.unitType === 'example'
      && unit.path === 'example.api-home.example-values'
      && unit.language === 'yaml'
      && unit.snippet.includes('example:')
    ));
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

test('workspace knowledge extraction reads cached Helm chart docs sources', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-chart-docs-extract-'));
  const cacheRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-chart-docs-cache-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        'home: https://charts.example.test/api/',
        ''
      ].join('\n'),
      'utf8'
    );
    const inspection = await inspectWorkspace(tempRoot);
    const chart = inspection.helmCharts.find(candidate => candidate.chartRoot === 'charts/api');
    assert.ok(chart);
    const source = (await buildHelmChartKnowledgeSources(inspection.workspaceRoot, chart))
      .find(candidate => candidate.kind === 'chart-docs' && candidate.name === 'api:home');
    assert.ok(source);
    const store = createFileKnowledgeStore(cacheRoot);
    const entry = await store.write({
      source,
      contentType: 'text/markdown',
      content: API_CHART_DOCS_MARKDOWN,
      fetchedAt: '2026-05-05T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });

    const report = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['helm'],
      targetPaths: ['charts/api'],
      sourceIds: [entry.id],
      store,
      now: new Date('2026-05-06T00:00:00.000Z'),
      extractedAt: '2026-05-06T00:00:00.000Z'
    });

    assert.equal(report.factSetCount, 1);
    assert.ok(report.sources.some(result =>
      result.id === entry.id
      && result.source.kind === 'chart-docs'
      && result.status === 'extracted'
      && result.factCount > 0
    ));
    assert.ok(report.factSets[0]?.facts.some(fact =>
      fact.kind === 'chart-value'
      && fact.extractionMethod === 'helm-chart-docs-markdown'
      && fact.path === 'chart.api.image.repository'
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    await rm(cacheRoot, { recursive: true, force: true });
  }
});

test('Helm chart docs facts enter bounded packs as public-reference sources', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-chart-docs-pack-'));
  const cacheRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-chart-docs-pack-cache-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        'home: https://charts.example.test/api/',
        ''
      ].join('\n'),
      'utf8'
    );
    const inspection = await inspectWorkspace(tempRoot);
    const chart = inspection.helmCharts.find(candidate => candidate.chartRoot === 'charts/api');
    assert.ok(chart);
    const source = (await buildHelmChartKnowledgeSources(inspection.workspaceRoot, chart))
      .find(candidate => candidate.kind === 'chart-docs' && candidate.name === 'api:home');
    assert.ok(source);
    const store = createFileKnowledgeStore(cacheRoot);
    const entry = await store.write({
      source,
      contentType: 'text/markdown',
      content: API_CHART_DOCS_MARKDOWN,
      fetchedAt: '2026-05-05T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });

    const pack = await buildKnowledgePack(inspection, {
      domains: ['helm'],
      targetPaths: ['charts/api'],
      sourceIds: [entry.id],
      store,
      now: new Date('2026-05-06T00:00:00.000Z'),
      maxFacts: 6
    });

    assert.equal(pack.sourceCount, 1);
    assert.equal(pack.sources[0]?.kind, 'chart-docs');
    assert.equal(pack.sources[0]?.storagePolicy.scope, 'public-reference');
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'chart-value'
      && fact.sourceId === entry.id
      && fact.path === 'chart.api.image.repository'
      && fact.sourceLocator === 'Chart docs: image.repository'
    ));
    assert.doesNotMatch(JSON.stringify(pack), /"content"\s*:|# API chart|Secret token/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    await rm(cacheRoot, { recursive: true, force: true });
  }
});
