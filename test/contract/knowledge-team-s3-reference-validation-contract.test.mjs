import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeTeamS3CompatibleBackendConfig
} from '../../src/knowledge/team-s3-compatible-backend-config.ts';
import {
  buildKnowledgeTeamS3CompatibleReferenceRegistry,
  validateKnowledgeTeamS3CompatibleBackendReferences
} from '../../src/knowledge/team-s3-compatible-reference-registry.ts';

function assertReferenceValidationShape(summary) {
  assert.deepEqual(Object.keys(summary), [
    'kind',
    'schemaVersion',
    'mutationAllowed',
    'status',
    'backendKind',
    'configName',
    'storageProfileRef',
    'authProfileRef',
    'requiredEnvironmentVariables',
    'optionalEnvironmentVariables',
    'capabilities',
    'issueCodes',
    'issues',
    'reason'
  ]);
  assert.deepEqual(Object.keys(summary.capabilities), [
    'remoteWriteAllowed',
    'liveCheckAllowed',
    'credentialValuesExposed',
    'uploadCommand',
    'dryRunOnly'
  ]);
}

test('s3-compatible reference validation contract accepts compact offline summaries', () => {
  const summary = validateKnowledgeTeamS3CompatibleBackendReferences(
    buildKnowledgeTeamS3CompatibleBackendConfig(),
    buildKnowledgeTeamS3CompatibleReferenceRegistry()
  );

  assertReferenceValidationShape(summary);
  assert.equal(summary.kind, 'infra-agent.knowledge-team-s3-compatible-reference-validation');
  assert.equal(summary.schemaVersion, 1);
  assert.equal(summary.mutationAllowed, false);
  assert.equal(summary.status, 'valid');
  assert.equal(summary.backendKind, 's3-compatible');
  assert.equal(summary.configName, 'team-cache');
  assert.equal(summary.storageProfileRef, 'team-cache-storage');
  assert.equal(summary.authProfileRef, 'team-cache-auth');
  assert.equal(summary.capabilities.remoteWriteAllowed, false);
  assert.equal(summary.capabilities.liveCheckAllowed, false);
  assert.equal(summary.capabilities.credentialValuesExposed, false);
  assert.equal(summary.capabilities.uploadCommand, null);
  assert.equal(summary.capabilities.dryRunOnly, true);
  assert.deepEqual(summary.issueCodes, []);
  assert.deepEqual(summary.issues, []);
});

test('s3-compatible reference validation contract keeps blocked summaries safe', () => {
  const summary = validateKnowledgeTeamS3CompatibleBackendReferences(
    buildKnowledgeTeamS3CompatibleBackendConfig({
      storageProfileRef: 'missing-storage',
      authProfileRef: 'missing-auth'
    }),
    buildKnowledgeTeamS3CompatibleReferenceRegistry()
  );

  assertReferenceValidationShape(summary);
  assert.equal(summary.status, 'blocked');
  assert.deepEqual(summary.requiredEnvironmentVariables, []);
  assert.deepEqual(summary.optionalEnvironmentVariables, []);
  assert.equal(summary.issueCodes.includes('missing-storage-profile-reference'), true);
  assert.equal(summary.issueCodes.includes('missing-auth-profile-reference'), true);

  const text = JSON.stringify(summary);
  for (const forbidden of [
    'https://',
    's3://',
    '/tmp/',
    '/home/',
    '/workspace/'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
  assert.equal(text.includes('"uploadCommand":null'), true);
});
