import test from 'node:test';
import assert from 'node:assert/strict';
import { captureStdout } from '../support/capture-stdout.mjs';
import {
  main,
  parseArgs
} from '../../src/cli/main.ts';

const FORBIDDEN_REF_KEYS = new Set([
  'content',
  'contentHash',
  'hash',
  'rawContent',
  'url'
]);

function assertNoForbiddenRefFields(value) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      assertNoForbiddenRefFields(entry);
    }
    return;
  }

  if (typeof value !== 'object' || value === null) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    assert.equal(
      FORBIDDEN_REF_KEYS.has(key),
      false,
      `refs JSON must not expose ${key}`
    );
    assertNoForbiddenRefFields(child);
  }
}

test('refs CLI args accept workspace, required scope, domain filter, max units, and json output', () => {
  const parsed = parseArgs([
    'refs',
    'fixtures/sample-workspace',
    '--scope',
    'charts/payments-api',
    '--domain',
    'helm',
    '--max-units',
    '2',
    '--json'
  ]);

  assert.equal(parsed.command, 'refs');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.equal(parsed.refsScope, 'charts/payments-api');
  assert.deepEqual(parsed.domains, ['helm']);
  assert.equal(parsed.maxUnits, 2);
  assert.equal(parsed.json, true);
});

test('refs command emits scope-bound read-only JSON with compact local refs and source cache posture', async () => {
  const output = await captureStdout(() => main([
    'refs',
    'fixtures/sample-workspace',
    '--scope',
    'charts/payments-api',
    '--domain',
    'helm',
    '--max-units',
    '3',
    '--json'
  ]));
  const report = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(report.kind, 'infra-agent.refs');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mutationAllowed, false);
  assert.equal(report.scope.requested, 'charts/payments-api');
  assert.deepEqual(report.filters.domains, ['helm']);
  assert.equal(report.filters.maxUnits, 3);
  assert.equal(report.summary.matchedTargetCount, 1);
  assert.equal(report.summary.domains.length, 1);
  assert.equal(report.summary.domains[0], 'helm');
  assert.ok(report.summary.includedRefCount > 0);
  assert.ok(report.summary.includedRefCount <= 3);
  assert.ok(report.summary.sourceCount > 0);
  assert.equal(report.targets.length, 1);
  assert.equal(report.targets[0].domain, 'helm');
  assert.equal(report.targets[0].path, 'charts/payments-api');
  assert.ok(report.targets[0].interfaceKinds.length > 0);
  assert.ok(report.sources.length > 0);
  assert.ok(report.sources.every(source =>
    source.domain === 'helm'
    && source.targetPath === 'charts/payments-api'
    && typeof source.freshness === 'string'
    && typeof source.requiresFetch === 'boolean'
    && typeof source.refreshRecommended === 'boolean'
    && typeof source.storageScope === 'string'
  ));
  assert.ok(report.refs.every(ref =>
    ref.targetKind === 'helm-chart'
    && ref.targetPath === 'charts/payments-api'
    && typeof ref.summary === 'string'
    && ref.summary.length > 0
    && typeof ref.source?.kind === 'string'
    && typeof ref.source?.path === 'string'
  ));
  assert.ok(report.refs.some(ref => ref.source.kind === 'helm-values-schema'));
  assertNoForbiddenRefFields(report);
  assert.doesNotMatch(output, /https?:\/\//i);
  assert.doesNotMatch(output, /repository: example\/payments-api|replicaCount: 2/i);
  assert.doesNotMatch(output, /example-api-secret|authorization|bearer/i);
});

test('refs command keeps unrelated domains out of a scoped domain lookup', async () => {
  const output = await captureStdout(() => main([
    'refs',
    'fixtures/sample-workspace',
    '--scope',
    'charts/payments-api',
    '--domain',
    'pulumi',
    '--json'
  ]));
  const report = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(report.kind, 'infra-agent.refs');
  assert.equal(report.mutationAllowed, false);
  assert.equal(report.summary.matchedTargetCount, 0);
  assert.equal(report.summary.includedRefCount, 0);
  assert.equal(report.omitted.unmatchedScope, true);
  assert.deepEqual(report.targets, []);
  assert.deepEqual(report.refs, []);
});
