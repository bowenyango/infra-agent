import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeTeamS3CompatibleBackendConfig
} from '../../src/knowledge/team-s3-compatible-backend-config.ts';
import {
  buildKnowledgeTeamS3CompatibleReferenceRegistry,
  validateKnowledgeTeamS3CompatibleBackendReferences
} from '../../src/knowledge/team-s3-compatible-reference-registry.ts';
import {
  buildKnowledgeTeamUploadApprovalIntent
} from '../../src/knowledge/team-upload-approval-intent.ts';
import {
  buildBlockedKnowledgeTeamArtifactContractFixture,
  buildKnowledgeTeamArtifactContractFixture
} from '../support/knowledge-team-artifact-fixtures.mjs';

function assertUploadIntentShape(intent) {
  assert.deepEqual(Object.keys(intent), [
    'kind',
    'schemaVersion',
    'mutationAllowed',
    'executionMode',
    'status',
    'plannedOperation',
    'remoteWriteAllowed',
    'liveCheckAllowed',
    'credentialValuesExposed',
    'credentialPresenceChecked',
    'uploadCommand',
    'backendKind',
    'publicationBackendKind',
    'manifestId',
    'object',
    'artifact',
    'approvalFingerprint',
    'preconditions',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(intent.object), [
    'key',
    'sha256',
    'byteLength',
    'contentType'
  ]);
  assert.deepEqual(Object.keys(intent.artifact), [
    'kind',
    'id',
    'sourceCount',
    'factCount',
    'staleSourceCount',
    'storagePolicy'
  ]);
  assert.deepEqual(Object.keys(intent.approvalFingerprint), [
    'algorithm',
    'scope',
    'value',
    'canonicalFieldCount'
  ]);
  assert.deepEqual(Object.keys(intent.preconditions), [
    'publicationReadiness',
    'backendReference',
    'credentialBoundary',
    'uploadApproval'
  ]);
  assert.deepEqual(Object.keys(intent.preconditions.credentialBoundary), [
    'mode',
    'requiredEnvironmentVariables',
    'optionalEnvironmentVariables',
    'credentialValuesRead',
    'credentialPresenceChecked'
  ]);
  assert.deepEqual(Object.keys(intent.preconditions.uploadApproval), [
    'explicitUploadApprovalRequired',
    'approvalProvided',
    'approvalSource',
    'uploadCommandGenerated'
  ]);
  assert.deepEqual(Object.keys(intent.readiness), [
    'status',
    'nextAction',
    'blockerCount',
    'blockerCodes',
    'blockers',
    'reason'
  ]);
}

function validBackendReferenceSummary(overrides = {}) {
  return {
    ...validateKnowledgeTeamS3CompatibleBackendReferences(
      buildKnowledgeTeamS3CompatibleBackendConfig(),
      buildKnowledgeTeamS3CompatibleReferenceRegistry()
    ),
    ...overrides
  };
}

test('upload approval intent contract accepts compact approval-required summaries', async () => {
  const fixture = await buildKnowledgeTeamArtifactContractFixture();
  const intent = buildKnowledgeTeamUploadApprovalIntent({
    publicationReadiness: fixture.uploadRequiredReadiness,
    backendReferenceValidation: validBackendReferenceSummary()
  });

  assertUploadIntentShape(intent);
  assert.equal(intent.kind, 'infra-agent.knowledge-team-upload-approval-intent');
  assert.equal(intent.schemaVersion, 1);
  assert.equal(intent.mutationAllowed, false);
  assert.equal(intent.executionMode, 'dry-run');
  assert.equal(intent.status, 'approval-required');
  assert.equal(intent.remoteWriteAllowed, false);
  assert.equal(intent.liveCheckAllowed, false);
  assert.equal(intent.credentialValuesExposed, false);
  assert.equal(intent.credentialPresenceChecked, false);
  assert.equal(intent.uploadCommand, null);
  assert.equal(intent.approvalFingerprint.algorithm, 'sha256');
  assert.equal(intent.approvalFingerprint.scope, 'stage-knowledge-pack-intent-v1');
  assert.match(intent.approvalFingerprint.value, /^[a-f0-9]{64}$/);
  assert.equal(intent.approvalFingerprint.canonicalFieldCount, 13);
  assert.equal(intent.preconditions.uploadApproval.explicitUploadApprovalRequired, true);
  assert.equal(intent.preconditions.uploadApproval.approvalProvided, false);
  assert.equal(intent.preconditions.uploadApproval.uploadCommandGenerated, false);
  assert.equal(intent.readiness.nextAction, 'request-explicit-upload-approval');
  assert.deepEqual(intent.readiness.blockerCodes, []);
});

test('upload approval intent contract keeps blocked summaries safe', async () => {
  const fixture = await buildBlockedKnowledgeTeamArtifactContractFixture();
  const intent = buildKnowledgeTeamUploadApprovalIntent({
    publicationReadiness: fixture.uploadRequiredReadiness,
    backendReferenceValidation: validBackendReferenceSummary({
      capabilities: {
        remoteWriteAllowed: false,
        liveCheckAllowed: false,
        credentialValuesExposed: true,
        uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
        dryRunOnly: true
      }
    })
  });

  assertUploadIntentShape(intent);
  assert.equal(intent.status, 'blocked');
  assert.equal(intent.uploadCommand, null);
  assert.equal(intent.approvalFingerprint.algorithm, 'sha256');
  assert.equal(intent.approvalFingerprint.scope, 'stage-knowledge-pack-intent-v1');
  assert.equal(intent.approvalFingerprint.value, null);
  assert.equal(intent.approvalFingerprint.canonicalFieldCount, 13);
  assert.equal(intent.readiness.nextAction, 'resolve-blockers');
  assert.equal(intent.readiness.blockerCodes.includes('publication-readiness-blocked'), true);
  assert.equal(intent.readiness.blockerCodes.includes('credential-values-exposed'), true);

  const text = JSON.stringify(intent);
  for (const forbidden of [
    'aws s3 cp',
    's3://private-bucket',
    'private-key',
    'https://',
    '/tmp/',
    '/home/',
    '/workspace/'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});
