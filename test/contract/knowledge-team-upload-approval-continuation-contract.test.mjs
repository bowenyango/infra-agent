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
  buildKnowledgeTeamUploadApprovalContinuation
} from '../../src/knowledge/team-upload-approval-continuation.ts';
import {
  buildKnowledgeTeamUploadApprovalIntent
} from '../../src/knowledge/team-upload-approval-intent.ts';
import {
  buildBlockedKnowledgeTeamArtifactContractFixture,
  buildKnowledgeTeamArtifactContractFixture
} from '../support/knowledge-team-artifact-fixtures.mjs';

function validBackendReferenceSummary() {
  return validateKnowledgeTeamS3CompatibleBackendReferences(
    buildKnowledgeTeamS3CompatibleBackendConfig(),
    buildKnowledgeTeamS3CompatibleReferenceRegistry()
  );
}

function assertContinuationShape(continuation) {
  assert.deepEqual(Object.keys(continuation), [
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
    'uploadApproved',
    'uploadExecutionAllowed',
    'clientCreated',
    'uploadCommand',
    'backendKind',
    'target',
    'approval',
    'credentialBoundary',
    'adapterBoundary',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(continuation.target), [
    'publicationBackendKind',
    'manifestId',
    'objectKey',
    'objectSha256',
    'objectByteLength',
    'objectContentType',
    'artifactId',
    'configName',
    'storageProfileRef',
    'authProfileRef'
  ]);
  assert.deepEqual(Object.keys(continuation.approval), [
    'required',
    'provided',
    'source',
    'intentStatus',
    'suppliedFingerprint',
    'expectedFingerprint',
    'fingerprintVerified'
  ]);
  assert.deepEqual(Object.keys(continuation.credentialBoundary), [
    'mode',
    'requiredEnvironmentVariableCount',
    'optionalEnvironmentVariableCount',
    'credentialValuesRead',
    'credentialPresenceChecked'
  ]);
  assert.deepEqual(Object.keys(continuation.adapterBoundary), [
    'dependencyInjectionRequired',
    'adapterInjected',
    'adapterResolutionStatus',
    'realBackendImplemented',
    'remoteWriteCapabilityEnabled'
  ]);
  assert.deepEqual(Object.keys(continuation.readiness), [
    'status',
    'nextAction',
    'blockerCount',
    'blockerCodes',
    'blockers',
    'reason'
  ]);
}

async function validIntent() {
  const fixture = await buildKnowledgeTeamArtifactContractFixture();
  return buildKnowledgeTeamUploadApprovalIntent({
    publicationReadiness: fixture.uploadRequiredReadiness,
    backendReferenceValidation: validBackendReferenceSummary()
  });
}

test('upload approval continuation contract accepts compact continuation-ready summaries', async () => {
  const intent = await validIntent();
  const continuation = buildKnowledgeTeamUploadApprovalContinuation({
    approvalIntent: intent,
    approvalFingerprint: intent.approvalFingerprint.value
  });

  assertContinuationShape(continuation);
  assert.equal(continuation.kind, 'infra-agent.knowledge-team-upload-approval-continuation');
  assert.equal(continuation.schemaVersion, 1);
  assert.equal(continuation.mutationAllowed, false);
  assert.equal(continuation.executionMode, 'dry-run');
  assert.equal(continuation.status, 'continuation-ready');
  assert.equal(continuation.remoteWriteAllowed, false);
  assert.equal(continuation.liveCheckAllowed, false);
  assert.equal(continuation.credentialValuesExposed, false);
  assert.equal(continuation.credentialPresenceChecked, false);
  assert.equal(continuation.uploadApproved, false);
  assert.equal(continuation.uploadExecutionAllowed, false);
  assert.equal(continuation.clientCreated, false);
  assert.equal(continuation.uploadCommand, null);
  assert.equal(continuation.approval.required, true);
  assert.equal(continuation.approval.provided, true);
  assert.equal(continuation.approval.fingerprintVerified, true);
  assert.equal(continuation.adapterBoundary.dependencyInjectionRequired, true);
  assert.equal(continuation.adapterBoundary.adapterInjected, false);
  assert.equal(continuation.adapterBoundary.realBackendImplemented, false);
  assert.equal(continuation.adapterBoundary.remoteWriteCapabilityEnabled, false);
  assert.deepEqual(continuation.readiness.blockerCodes, []);
});

test('upload approval continuation contract keeps blocked summaries safe', async () => {
  const fixture = await buildBlockedKnowledgeTeamArtifactContractFixture();
  const intent = buildKnowledgeTeamUploadApprovalIntent({
    publicationReadiness: fixture.uploadRequiredReadiness,
    backendReferenceValidation: validBackendReferenceSummary()
  });
  const continuation = buildKnowledgeTeamUploadApprovalContinuation({
    approvalIntent: {
      ...intent,
      endpointUrl: 'https://private.example.test',
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key'
    },
    approvalFingerprint: 'not-a-sha'
  });

  assertContinuationShape(continuation);
  assert.equal(continuation.status, 'blocked');
  assert.equal(continuation.remoteWriteAllowed, false);
  assert.equal(continuation.uploadApproved, false);
  assert.equal(continuation.uploadExecutionAllowed, false);
  assert.equal(continuation.clientCreated, false);
  assert.equal(continuation.uploadCommand, null);
  assert.equal(continuation.approval.fingerprintVerified, false);
  assert.equal(continuation.readiness.nextAction, 'resolve-blockers');
  assert.equal(continuation.readiness.blockerCodes.includes('backend-detail-leak'), true);
  assert.equal(continuation.readiness.blockerCodes.includes('intent-not-approval-required'), true);
  assert.equal(continuation.readiness.blockerCodes.includes('unsafe-approval-fingerprint'), true);

  const text = JSON.stringify(continuation);
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
