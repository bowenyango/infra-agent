import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKnowledgeTeamBackendReadinessReport } from '../../src/knowledge/team-backend-readiness.ts';
import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';

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

test('team backend readiness blocks remote mutation and backend detail leakage', () => {
  const report = buildKnowledgeTeamBackendReadinessReport(validBackendConfig({
    remoteWriteDefault: true,
    liveCheckDefault: true,
    bucket: 'private-team-cache',
    endpointUrl: 'https://s3.example.test/private',
    accessToken: 'secret-token',
    workspaceRoot: '/workspace/private-project'
  }));

  assert.equal(report.remoteWriteAllowed, false);
  assert.equal(report.liveCheckAllowed, false);
  assert.equal(report.credentialValuesExposed, false);
  assert.equal(report.uploadCommand, null);
  assert.equal(report.readiness.status, 'blocked');
  assert.equal(report.readiness.nextAction, 'fix-backend-config');
  assert.ok(report.readiness.blockerCodes.includes('remote-write-enabled'));
  assert.ok(report.readiness.blockerCodes.includes('live-check-enabled'));
  assert.ok(report.readiness.blockerCodes.includes('backend-detail-leak'));
  assert.equal(
    report.readiness.blockers.some(blocker => blocker.path === '$.config'),
    true
  );
  assertNoBackendReadinessLeaks(report);
});

test('team backend readiness blocks incomplete or unsafe config shape', () => {
  const report = buildKnowledgeTeamBackendReadinessReport({
    kind: 'infra-agent.knowledge-team-backend-config',
    schemaVersion: 2,
    mutationAllowed: true,
    backendKind: 'gcs',
    name: '../team-cache',
    artifactPrefix: 'team-artifacts',
    credentialMode: 'inline',
    remoteWriteDefault: false,
    liveCheckDefault: false
  });

  assert.equal(report.backendKind, 'unsupported');
  assert.equal(report.config.name, null);
  assert.equal(report.config.artifactPrefix, null);
  assert.equal(report.config.indexPrefix, null);
  assert.equal(report.config.credentialMode, 'unsupported');
  assert.equal(report.config.remoteWriteDefault, false);
  assert.equal(report.config.liveCheckDefault, false);
  assert.equal(report.readiness.status, 'blocked');
  assert.ok(report.readiness.blockerCodes.includes('invalid-schema-version'));
  assert.ok(report.readiness.blockerCodes.includes('mutation-enabled'));
  assert.ok(report.readiness.blockerCodes.includes('unsupported-backend-kind'));
  assert.ok(report.readiness.blockerCodes.includes('unsafe-config-name'));
  assert.ok(report.readiness.blockerCodes.includes('unsafe-prefix'));
  assert.ok(report.readiness.blockerCodes.includes('unsupported-credential-mode'));
  assert.ok(report.readiness.blockerCodes.includes('missing-required-field'));
  assertNoBackendReadinessLeaks(report);
});

test('knowledge validation accepts team backend readiness reports', () => {
  const readyReport = buildKnowledgeTeamBackendReadinessReport(validBackendConfig());
  const blockedReport = buildKnowledgeTeamBackendReadinessReport(validBackendConfig({
    remoteWriteDefault: true
  }));

  const readyValidation = validateKnowledgePayload(readyReport, 'inline');
  const blockedValidation = validateKnowledgePayload(blockedReport, 'inline');

  assert.equal(readyValidation.inputKind, 'infra-agent.knowledge-team-backend-readiness');
  assert.equal(readyValidation.valid, true);
  assert.equal(readyValidation.factCount, 0);
  assert.equal(blockedValidation.inputKind, 'infra-agent.knowledge-team-backend-readiness');
  assert.equal(blockedValidation.valid, true);
  assert.equal(blockedValidation.factCount, 0);
});

test('knowledge validation rejects forged or leaky team backend readiness reports', () => {
  const report = buildKnowledgeTeamBackendReadinessReport(validBackendConfig());
  const validation = validateKnowledgePayload({
    ...report,
    remoteWriteAllowed: true,
    liveCheckAllowed: true,
    credentialValuesExposed: true,
    uploadCommand: 'aws s3 cp pack.json s3://private-team-cache',
    endpointUrl: 'https://s3.example.test/private',
    readiness: {
      ...report.readiness,
      blockerCodes: ['remote-write-enabled']
    }
  }, 'inline');

  assert.equal(validation.inputKind, 'infra-agent.knowledge-team-backend-readiness');
  assert.equal(validation.valid, false);
  for (const expectedPath of [
    '$.remoteWriteAllowed',
    '$.liveCheckAllowed',
    '$.credentialValuesExposed',
    '$.uploadCommand',
    '$.endpointUrl',
    '$.readiness.blockerCodes'
  ]) {
    assert.ok(
      validation.issues.some(issue => issue.path === expectedPath),
      `expected issue for ${expectedPath}`
    );
  }
});
