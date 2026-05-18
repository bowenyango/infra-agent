import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve
} from 'node:path';
import { captureStdout } from '../support/capture-stdout.mjs';
import { main } from '../../src/cli/main.ts';

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

test('knowledge index command emits compact unit metadata JSON', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-index-'));

  try {
    const outputPath = join(tempRoot, 'knowledge-index.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'index',
      'fixtures/sample-workspace',
      '--domain',
      'helm',
      '--target',
      'charts/payments-api',
      '--max-units',
      '3',
      '--out',
      outputPath,
      '--json'
    ]));
    const stdoutIndex = parseJsonOutput(output);
    const artifactIndex = JSON.parse(await readFile(outputPath, 'utf8'));
    const entry = stdoutIndex.entries[0];
    const keys = collectObjectKeys(stdoutIndex);

    assert.equal(stdoutIndex.kind, 'infra-agent.knowledge-unit-index');
    assert.equal(stdoutIndex.schemaVersion, 1);
    assert.equal(stdoutIndex.mutationAllowed, false);
    assert.equal(stdoutIndex.outputPath, outputPath);
    const stdoutArtifact = { ...stdoutIndex };
    delete stdoutArtifact.outputPath;
    assert.deepEqual(artifactIndex, stdoutArtifact);

    assert.ok(stdoutIndex.packId);
    assert.ok(stdoutIndex.sourceCount >= 1);
    assert.ok(stdoutIndex.includedUnitCount > 0);
    assert.ok(entry);
    assert.equal(entry.domain, 'helm');
    assert.equal(entry.targetPath, 'charts/payments-api');
    assert.ok(entry.sourceId);
    assert.ok(entry.sourceKind);
    assert.ok(entry.sourceName);
    assert.equal(entry.includedUnitCount, Object.values(entry.unitCounts).reduce((sum, count) => sum + count, 0));
    assert.ok(['fact', 'guidance', 'example', 'diagnostic', 'recipe'].every(unitType =>
      Number.isInteger(entry.unitCounts[unitType])
    ));

    assert.equal(keys.has('facts'), false);
    assert.equal(keys.has('units'), false);
    assert.equal(keys.has('url'), false);
    assert.equal(keys.has('content'), false);
    assert.equal(keys.has('rawContent'), false);
    assert.equal(keys.has('snippet'), false);
    assert.equal(keys.has('sourceLocator'), false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge index command resolves resource identities before metadata filtering', async () => {
  const output = await captureStdout(() => main([
    'knowledge',
    'index',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--resource',
    'chart:payments-api',
    '--max-units',
    '4',
    '--json'
  ]));
  const index = parseJsonOutput(output);

  assert.equal(index.kind, 'infra-agent.knowledge-unit-index');
  assert.ok(index.sourceCount >= 1);
  assert.ok(index.includedUnitCount > 0);
  assert.ok(index.entries.every(entry =>
    entry.domain === 'helm'
    && entry.targetPath === 'charts/payments-api'
  ));
  assert.equal(collectObjectKeys(index).has('content'), false);
});

test('knowledge index filters entries by unit type and storage scope', async () => {
  const baseArgs = [
    'knowledge',
    'index',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--max-units',
    '10',
    '--json'
  ];
  const unfilteredIndex = parseJsonOutput(await captureStdout(() => main(baseArgs)));
  const filteredIndex = parseJsonOutput(await captureStdout(() => main([
    ...baseArgs.slice(0, -1),
    '--unit-type',
    'fact',
    '--storage-scope',
    'workspace-private',
    '--json'
  ])));

  assert.ok(filteredIndex.entries.length > 0);
  assert.equal(filteredIndex.sourceCount, filteredIndex.entries.length);
  assert.equal(
    filteredIndex.includedUnitCount,
    filteredIndex.entries.reduce((sum, entry) => sum + entry.includedUnitCount, 0)
  );
  assert.equal(filteredIndex.omittedUnitCount, unfilteredIndex.omittedUnitCount);
  assert.ok(filteredIndex.entries.every(entry => entry.storageScope === 'workspace-private'));
  assert.ok(filteredIndex.entries.every(entry => entry.unitCounts.fact > 0));
});

test('knowledge index mismatched filters return an empty entry set', async () => {
  const output = await captureStdout(() => main([
    'knowledge',
    'index',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--unit-type',
    'example',
    '--storage-scope',
    'workspace-private',
    '--json'
  ]));
  const index = parseJsonOutput(output);

  assert.deepEqual(index.entries, []);
  assert.equal(index.sourceCount, 0);
  assert.equal(index.includedUnitCount, 0);
  assert.equal(index.omittedUnitCount, 0);
});
