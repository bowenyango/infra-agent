import test from 'node:test';
import assert from 'node:assert/strict';
import { captureStdout } from '../support/capture-stdout.mjs';
import {
  main,
  parseArgs
} from '../../src/cli/main.ts';

const SENSITIVE_CACHE_KEYS = new Set([
  'content',
  'contentHash',
  'hash',
  'fetchedAt',
  'staleAfter'
]);

function assertNoSensitiveCacheKeys(value) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      assertNoSensitiveCacheKeys(entry);
    }
    return;
  }

  if (typeof value !== 'object' || value === null) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    assert.equal(
      SENSITIVE_CACHE_KEYS.has(key),
      false,
      `cache status JSON must not expose ${key}`
    );
    assertNoSensitiveCacheKeys(child);
  }
}

test('cache status CLI args accept workspace and context filters', () => {
  const parsed = parseArgs([
    'cache',
    'status',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--json'
  ]);

  assert.equal(parsed.command, 'cache');
  assert.equal(parsed.cacheAction, 'status');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.deepEqual(parsed.domains, ['helm']);
  assert.deepEqual(parsed.targetPaths, ['charts/payments-api']);
  assert.equal(parsed.json, true);
});

test('cache status command emits read-only cache posture JSON without cache entry internals', async () => {
  const output = await captureStdout(() => main([
    'cache',
    'status',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--json'
  ]));
  const report = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(report.kind, 'infra-agent.cache-status');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mutationAllowed, false);
  assertNoSensitiveCacheKeys(report);
  assert.doesNotMatch(output, /example-api-secret/i);
  assert.doesNotMatch(output, /contentHash|fetchedAt|staleAfter/);
});
