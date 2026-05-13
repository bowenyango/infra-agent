import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { captureStdout } from '../support/capture-stdout.mjs';
import { writeCanonicalPublicKnowledgeCacheFixtures } from '../support/canonical-public-knowledge-fixtures.mjs';
import { main } from '../../src/cli/main.ts';
import { CANONICAL_PUBLIC_EXTRACTION_TARGETS } from '../../src/knowledge/public-extraction-targets.ts';

const EXPECTED_UNIT_TYPES_BY_TARGET_ID = {
  'public:terraform-provider-docs:hashicorp/aws:latest': ['fact', 'example', 'diagnostic', 'recipe'],
  'public:pulumi-package-docs:aws': ['fact', 'example', 'diagnostic', 'recipe'],
  'public:helm-chart-docs:kube-prometheus-stack': ['fact', 'example', 'recipe']
};

function parseJsonOutput(output) {
  return JSON.parse(output.slice(output.indexOf('{')));
}

function collectObjectKeys(value, keys = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectObjectKeys(item, keys);
    }
    return keys;
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      collectObjectKeys(child, keys);
    }
  }

  return keys;
}

function fixtureForTarget(fixtures, target) {
  return fixtures.find(fixture =>
    fixture.source.kind === target.source.kind
    && fixture.source.name === target.source.name
  );
}

function assertSourceIdentity(entry, target, fixture) {
  assert.equal(entry.domain, target.domain);
  assert.equal(entry.targetPath, target.targetPath);
  assert.equal(entry.sourceId, fixture.entry.id);
  assert.equal(entry.sourceKind, target.expectedSourceIdentity.kind);
  assert.equal(entry.sourceName, target.expectedSourceIdentity.name);
  assert.equal(entry.provider, target.expectedSourceIdentity.provider);
  assert.equal(entry.packageName, target.expectedSourceIdentity.packageName);
  assert.equal(entry.chart, target.expectedSourceIdentity.chart);
  assert.equal(entry.version, target.expectedSourceIdentity.version);
  assert.equal(entry.storageScope, 'public-reference');
  assert.deepEqual(entry.privacyScopes, ['public-reference']);
  assert.equal(entry.freshness, 'fresh');
}

function assertCompactIndex(index, target, fixture) {
  const entry = index.entries[0];
  const keys = collectObjectKeys(index);
  const serialized = JSON.stringify(index);

  assert.equal(index.kind, 'infra-agent.knowledge-unit-index');
  assert.equal(index.schemaVersion, 1);
  assert.equal(index.mutationAllowed, false);
  assert.equal(index.sourceCount, 1);
  assert.equal(index.includedUnitCount, 5);
  assert.ok(index.omittedUnitCount > 0);
  assert.equal(index.entries.length, 1);
  assert.ok(entry);
  assertSourceIdentity(entry, target, fixture);
  assert.equal(
    entry.includedUnitCount,
    Object.values(entry.unitCounts).reduce((sum, count) => sum + count, 0)
  );
  assert.equal(entry.includedUnitCount, 5);
  assert.ok(entry.omittedUnitCount > 0);
  assert.ok(entry.sourceUnitCountEstimate > entry.includedUnitCount);

  for (const unitType of ['fact', 'guidance', 'example', 'diagnostic', 'recipe']) {
    assert.equal(Number.isInteger(entry.unitCounts[unitType]), true, unitType);
  }

  for (const unitType of EXPECTED_UNIT_TYPES_BY_TARGET_ID[target.id]) {
    assert.ok(entry.unitCounts[unitType] > 0, `${target.id} should include ${unitType} units`);
    assert.ok(entry.retrievalKeys.includes(`unitType:${unitType}`));
  }

  assert.ok(entry.retrievalKeys.includes(`domain:${target.domain}`));
  assert.ok(entry.retrievalKeys.includes(`targetPath:${target.targetPath}`));
  assert.ok(entry.retrievalKeys.includes(`sourceKind:${target.source.kind}`));
  assert.ok(entry.retrievalKeys.includes('storageScope:public-reference'));

  assert.equal(keys.has('facts'), false);
  assert.equal(keys.has('units'), false);
  assert.equal(keys.has('url'), false);
  assert.equal(keys.has('content'), false);
  assert.equal(keys.has('rawContent'), false);
  assert.equal(keys.has('rawDocs'), false);
  assert.equal(keys.has('snippet'), false);
  assert.equal(keys.has('sourceLocator'), false);
  assert.equal(serialized.includes(target.expectedSourceIdentity.url), false);
  assert.doesNotMatch(
    serialized,
    /# AWS Provider|# AWS|# kube-prometheus-stack|Argument Reference|Module \| Description|Parameter \| Type/
  );
}

test('knowledge index command emits compact indexes for canonical public targets from cached fixtures', async () => {
  const workspaceRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-canonical-public-index-workspace-'));
  const cacheRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-canonical-public-index-cache-'));
  const previousKnowledgeCache = process.env.INFRA_AGENT_KNOWLEDGE_CACHE;

  try {
    process.env.INFRA_AGENT_KNOWLEDGE_CACHE = cacheRoot;
    const fixtures = await writeCanonicalPublicKnowledgeCacheFixtures(cacheRoot);

    for (const target of CANONICAL_PUBLIC_EXTRACTION_TARGETS) {
      const fixture = fixtureForTarget(fixtures, target);
      assert.ok(fixture, target.id);

      const output = await captureStdout(() => main([
        'knowledge',
        'index',
        workspaceRoot,
        '--domain',
        target.domain,
        '--target',
        target.targetPath,
        '--source',
        fixture.entry.id,
        '--max-units',
        '5',
        '--json'
      ]));

      assertCompactIndex(parseJsonOutput(output), target, fixture);
    }
  } finally {
    if (previousKnowledgeCache === undefined) {
      delete process.env.INFRA_AGENT_KNOWLEDGE_CACHE;
    } else {
      process.env.INFRA_AGENT_KNOWLEDGE_CACHE = previousKnowledgeCache;
    }
    await rm(workspaceRoot, { recursive: true, force: true });
    await rm(cacheRoot, { recursive: true, force: true });
  }
});
