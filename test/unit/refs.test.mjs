import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { buildRefsReport } from '../../src/domain/refs.ts';

function assertNoRawReferencePayload(value) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      assertNoRawReferencePayload(entry);
    }
    return;
  }

  if (typeof value !== 'object' || value === null) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    assert.equal(key === 'url', false, 'refs output must not expose source URLs');
    assert.equal(key === 'content', false, 'refs output must not expose raw cache content');
    assert.equal(key === 'contentHash', false, 'refs output must not expose content hashes');
    assert.equal(key === 'fetchedAt', false, 'refs output must not expose fetch timestamps');
    assert.equal(key === 'staleAfter', false, 'refs output must not expose stale timestamps');
    assertNoRawReferencePayload(child);
  }
}

test('buildRefsReport emits scoped Helm interface refs without raw reference payloads', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = await buildRefsReport(inspection, {
    scope: 'charts/payments-api',
    domains: ['helm'],
    maxUnits: 3
  });

  assert.equal(report.kind, 'infra-agent.refs');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mutationAllowed, false);
  assert.equal(report.scope.normalized, 'charts/payments-api');
  assert.deepEqual(report.filters.domains, ['helm']);
  assert.equal(report.filters.maxUnits, 3);
  assert.equal(report.summary.matchedTargetCount, 1);
  assert.equal(report.summary.includedRefCount, 3);
  assert.equal(report.summary.omittedRefCount, 4);
  assert.deepEqual(report.summary.domains, ['helm']);
  assert.equal(report.targets[0]?.path, 'charts/payments-api');
  assert.ok(report.targets[0]?.interfaceKinds.includes('helm-values-schema:required-field'));
  assert.ok(report.sources.some(source =>
    source.sourceKind === 'chart-schema'
    && source.sourceName === 'payments-api:values.schema.json'
    && source.freshness === 'local'
  ));
  assert.ok(report.sources.some(source =>
    source.sourceKind === 'helm-docs'
    && source.freshness === 'missing'
    && source.refreshRecommended === true
  ));
  assert.ok(report.refs.some(ref =>
    ref.kind === 'required-field'
    && ref.path === 'image'
    && ref.source.kind === 'helm-values-schema'
  ));
  assertNoRawReferencePayload(report);
});

test('buildRefsReport reports unmatched scopes as narrow-scope without selecting references', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = await buildRefsReport(inspection, {
    scope: 'missing-component',
    domains: ['helm']
  });

  assert.equal(report.summary.matchedTargetCount, 0);
  assert.equal(report.summary.includedRefCount, 0);
  assert.equal(report.summary.recommendedAction, 'narrow-scope');
  assert.equal(report.omitted.unmatchedScope, true);
  assert.deepEqual(report.targets, []);
  assert.deepEqual(report.sources, []);
  assert.deepEqual(report.refs, []);
});
