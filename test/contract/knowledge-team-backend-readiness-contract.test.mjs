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

function assertValidBackendReadiness(payload) {
  const report = validateKnowledgePayload(payload, 'inline');
  assert.equal(report.inputKind, 'infra-agent.knowledge-team-backend-readiness');
  assert.equal(report.valid, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.factCount, 0);
}

function assertNoBackendReadinessLeaks(payload) {
  const text = JSON.stringify(payload);
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

test('team backend readiness contract accepts compact ready reports', () => {
  const report = buildKnowledgeTeamBackendReadinessReport(validBackendConfig());

  assert.deepEqual(Object.keys(report), [
    'kind',
    'schemaVersion',
    'mutationAllowed',
    'executionMode',
    'remoteWriteAllowed',
    'liveCheckAllowed',
    'credentialValuesExposed',
    'uploadCommand',
    'backendKind',
    'config',
    'capabilities',
    'readiness'
  ]);
  assert.equal(report.kind, 'infra-agent.knowledge-team-backend-readiness');
  assert.equal(report.mutationAllowed, false);
  assert.equal(report.executionMode, 'dry-run');
  assert.equal(report.remoteWriteAllowed, false);
  assert.equal(report.liveCheckAllowed, false);
  assert.equal(report.credentialValuesExposed, false);
  assert.equal(report.uploadCommand, null);
  assert.equal(report.readiness.status, 'ready-for-explicit-upload');
  assert.equal(report.readiness.nextAction, 'design-explicit-upload');
  assert.equal(report.readiness.blockerCount, 0);
  assert.deepEqual(report.readiness.blockerCodes, []);
  assertValidBackendReadiness(report);
  assertNoBackendReadinessLeaks(report);
});

test('team backend readiness contract accepts compact blocked reports', () => {
  const report = buildKnowledgeTeamBackendReadinessReport(validBackendConfig({
    remoteWriteDefault: true,
    liveCheckDefault: true
  }));

  assert.equal(report.remoteWriteAllowed, false);
  assert.equal(report.liveCheckAllowed, false);
  assert.equal(report.credentialValuesExposed, false);
  assert.equal(report.uploadCommand, null);
  assert.equal(report.readiness.status, 'blocked');
  assert.equal(report.readiness.nextAction, 'fix-backend-config');
  assert.ok(report.readiness.blockerCodes.includes('remote-write-enabled'));
  assert.ok(report.readiness.blockerCodes.includes('live-check-enabled'));
  assertValidBackendReadiness(report);
  assertNoBackendReadinessLeaks(report);
});

test('team backend readiness contract rejects remote write and backend leakage drift', () => {
  const report = buildKnowledgeTeamBackendReadinessReport(validBackendConfig());
  const validation = validateKnowledgePayload({
    ...report,
    remoteWriteAllowed: true,
    liveCheckAllowed: true,
    credentialValuesExposed: true,
    uploadCommand: 'aws s3 cp pack.json s3://private-team-cache',
    bucket: 'private-team-cache',
    endpointUrl: 'https://s3.example.test/private'
  }, 'inline');

  assert.equal(validation.valid, false);
  for (const expectedPath of [
    '$.remoteWriteAllowed',
    '$.liveCheckAllowed',
    '$.credentialValuesExposed',
    '$.uploadCommand',
    '$.bucket',
    '$.endpointUrl'
  ]) {
    assert.ok(
      validation.issues.some(issue => issue.path === expectedPath),
      `expected issue for ${expectedPath}`
    );
  }
});

test('team backend readiness contract rejects status and blocker drift', () => {
  const report = buildKnowledgeTeamBackendReadinessReport(validBackendConfig());
  const validation = validateKnowledgePayload({
    ...report,
    backendKind: 'unsupported',
    readiness: {
      ...report.readiness,
      status: 'ready-for-explicit-upload',
      nextAction: 'fix-backend-config',
      blockerCount: 1,
      blockerCodes: ['remote-write-enabled'],
      blockers: [{
        code: 'remote-write-enabled',
        path: '$.remoteWriteDefault',
        message: 'Remote writes are enabled.'
      }]
    }
  }, 'inline');

  assert.equal(validation.valid, false);
  for (const expectedPath of [
    '$.backendKind',
    '$.readiness.nextAction',
    '$.readiness.blockers'
  ]) {
    assert.ok(
      validation.issues.some(issue => issue.path === expectedPath),
      `expected issue for ${expectedPath}`
    );
  }
});
