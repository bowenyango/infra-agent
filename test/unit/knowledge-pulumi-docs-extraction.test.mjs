import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { buildPulumiDocsKnowledgeSources } from '../../src/domain/pulumi-docs-context.ts';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import {
  writeKnowledgeCacheEntry
} from '../../src/knowledge/cache.ts';
import { createFileKnowledgeStore } from '../../src/knowledge/knowledge-store.ts';
import { extractKnowledgeFactSetFromCacheEntry } from '../../src/knowledge/facts.ts';
import { extractWorkspaceKnowledgeFacts } from '../../src/knowledge/extract.ts';
import { buildKnowledgePack } from '../../src/knowledge/pack.ts';

const PULUMI_CONFIG_MARKDOWN = [
  '# Configuration',
  '',
  'Pulumi configuration stores environment-specific values.',
  '',
  '- `pulumi config set` - Sets a stack configuration value.',
  '- `pulumi config get` - Reads a stack configuration value.',
  '- `pulumi config set --secret` - Stores a secret value and must not become a reusable fact.',
  ''
].join('\n');

const PULUMI_YAML_MARKDOWN = [
  '# Pulumi YAML',
  '',
  '- `resources` - Declares Pulumi resources in a YAML program.',
  '- `configuration` - Reads stack configuration values for YAML programs.',
  ''
].join('\n');

function pulumiDocsSource() {
  return {
    kind: 'pulumi-docs',
    name: 'pulumi-docs:config',
    packageName: '@pulumi/pulumi',
    url: 'https://www.pulumi.com/docs/iac/concepts/config/'
  };
}

test('Pulumi docs markdown extraction emits compact guidance facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-docs-facts-'));

  try {
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source: pulumiDocsSource(),
      contentType: 'text/markdown',
      content: PULUMI_CONFIG_MARKDOWN,
      fetchedAt: '2026-05-06T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry, {
      now: new Date('2026-05-07T00:00:00.000Z'),
      extractedAt: '2026-05-07T00:00:00.000Z'
    });

    assert.equal(factSet.kind, 'infra-agent.knowledge-facts');
    assert.equal(factSet.sourceId, entry.id);
    assert.equal(factSet.sourceStale, false);
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'pulumi-docs-guidance'
      && fact.path === 'pulumi.docs.config.pulumi_config_set'
      && fact.summary === 'Sets a stack configuration value.'
      && fact.values?.includes('pulumi config set')
      && fact.extractionMethod === 'pulumi-docs-markdown'
      && fact.source.locator === 'Pulumi docs: pulumi config set'
    ));
    assert.equal(factSet.facts.some(fact =>
      /secret|apiToken|ciphertext|secure/i.test(JSON.stringify(fact))
    ), false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Pulumi YAML docs markdown extraction emits runtime guidance facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-yaml-docs-facts-'));

  try {
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source: {
        kind: 'pulumi-docs',
        name: 'pulumi-docs:yaml',
        packageName: '@pulumi/pulumi',
        url: 'https://www.pulumi.com/docs/iac/languages-sdks/yaml/'
      },
      contentType: 'text/markdown',
      content: PULUMI_YAML_MARKDOWN,
      fetchedAt: '2026-05-06T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry, {
      now: new Date('2026-05-07T00:00:00.000Z')
    });

    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'pulumi-docs-guidance'
      && fact.path === 'pulumi.docs.yaml.resources'
      && fact.summary === 'Declares Pulumi resources in a YAML program.'
      && fact.confidence === 'medium'
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Pulumi docs markdown extraction ignores HTML cache entries', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-docs-html-'));

  try {
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source: pulumiDocsSource(),
      contentType: 'text/markdown',
      content: '<!doctype html><html><body><h1>Config</h1></body></html>',
      fetchedAt: '2026-05-06T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry);

    assert.equal(factSet.factCount, 0);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('workspace knowledge extraction reads cached Pulumi docs sources', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-docs-extract-'));

  try {
    const inspection = await inspectWorkspace('fixtures/sample-workspace');
    const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === 'infra/payments-api');
    assert.ok(project);
    const source = (await buildPulumiDocsKnowledgeSources(inspection.workspaceRoot, project))
      .find(candidate => candidate.name === 'pulumi-docs:config');
    assert.ok(source);
    const store = createFileKnowledgeStore(tempRoot);
    const entry = await store.write({
      source,
      contentType: 'text/markdown',
      content: PULUMI_CONFIG_MARKDOWN,
      fetchedAt: '2026-05-06T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });

    const report = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['pulumi'],
      targetPaths: ['infra/payments-api'],
      sourceIds: [entry.id],
      store,
      now: new Date('2026-05-07T00:00:00.000Z'),
      extractedAt: '2026-05-07T00:00:00.000Z'
    });

    assert.equal(report.factSetCount, 1);
    assert.ok(report.sources.some(result =>
      result.id === entry.id
      && result.source.kind === 'pulumi-docs'
      && result.status === 'extracted'
      && result.factCount > 0
    ));
    assert.ok(report.factSets[0]?.facts.some(fact =>
      fact.extractionMethod === 'pulumi-docs-markdown'
      && fact.path === 'pulumi.docs.config.pulumi_config_get'
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Pulumi docs facts enter bounded packs as public-reference sources', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-docs-pack-'));

  try {
    const inspection = await inspectWorkspace('fixtures/sample-workspace');
    const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === 'infra/payments-api');
    assert.ok(project);
    const source = (await buildPulumiDocsKnowledgeSources(inspection.workspaceRoot, project))
      .find(candidate => candidate.name === 'pulumi-docs:config');
    assert.ok(source);
    const store = createFileKnowledgeStore(tempRoot);
    const entry = await store.write({
      source,
      contentType: 'text/markdown',
      content: PULUMI_CONFIG_MARKDOWN,
      fetchedAt: '2026-05-06T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });

    const pack = await buildKnowledgePack(inspection, {
      domains: ['pulumi'],
      targetPaths: ['infra/payments-api'],
      sourceIds: [entry.id],
      store,
      now: new Date('2026-05-07T00:00:00.000Z'),
      maxFacts: 10
    });

    assert.equal(pack.sourceCount, 1);
    assert.equal(pack.sources[0]?.kind, 'pulumi-docs');
    assert.equal(pack.sources[0]?.storagePolicy.scope, 'public-reference');
    assert.ok(pack.facts.some(fact =>
      fact.extractionMethod === 'pulumi-docs-markdown'
      && fact.path === 'pulumi.docs.config.pulumi_config_set'
    ));
    assert.equal(pack.facts.some(fact => fact.kind === 'example'), false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
