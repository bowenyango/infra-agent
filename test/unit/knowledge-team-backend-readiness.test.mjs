import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKnowledgeTeamBackendReadinessReport } from '../../src/knowledge/team-backend-readiness.ts';

function validBackendConfig(overrides = {}) {
  return {
    kind: 'infra-agent.knowledge-team-backend-config',
    schemaVersion: 1,
    mutationAllowed: false,
    backendKind: 's3-compatible',
    name: 'team-cache',
    artifactPrefix: 'knowledge-artifacts/v1',
    indexPrefix: 'knowledge-index/v1',
    credentialMode: 'environment',
    remoteWriteDefault: false,
    liveCheckDefault: false,
    ...overrides
  };
}

function assertNoBackendReadinessLeaks(value) {
  const text = JSON.stringify(value);
  for (const forbidden of [
    'private-team-cache',
    'bucket',
    'endpoint',
    'https://',
    's3://',
    'token',
    'password',
    'secret',
    '/tmp/',
    '/home/',
    '/workspace/'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

test('team backend readiness accepts safe dry-run backend configs', () => {
  const report = buildKnowledgeTeamBackendReadinessReport(validBackendConfig());

  assert.equal(report.kind, 'infra-agent.knowledge-team-backend-readiness');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mutationAllowed, false);
  assert.equal(report.executionMode, 'dry-run');
  assert.equal(report.remoteWriteAllowed, false);
  assert.equal(report.liveCheckAllowed, false);
  assert.equal(report.credentialValuesExposed, false);
  assert.equal(report.uploadCommand, null);
  assert.equal(report.backendKind, 's3-compatible');
  assert.equal(report.config.name, 'team-cache');
  assert.equal(report.config.artifactPrefix, 'knowledge-artifacts/v1');
  assert.equal(report.config.indexPrefix, 'knowledge-index/v1');
  assert.equal(report.config.credentialMode, 'environment');
  assert.equal(report.config.remoteWriteDefault, false);
  assert.equal(report.config.liveCheckDefault, false);
  assert.equal(report.capabilities.artifactObjectStore, true);
  assert.equal(report.capabilities.metadataIndex, true);
  assert.equal(report.capabilities.contentAddressedObjectKeys, true);
  assert.equal(report.capabilities.contentAddressedIndexKeys, true);
  assert.equal(report.capabilities.idempotentWritesRequired, true);
  assert.equal(report.capabilities.explicitUploadApprovalRequired, true);
  assert.equal(report.capabilities.dryRunOnly, true);
  assert.equal(report.readiness.status, 'ready-for-explicit-upload');
  assert.equal(report.readiness.nextAction, 'design-explicit-upload');
  assert.equal(report.readiness.blockerCount, 0);
  assert.deepEqual(report.readiness.blockerCodes, []);
  assert.deepEqual(report.readiness.blockers, []);
  assertNoBackendReadinessLeaks(report);
});
