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

async function validApprovalIntent() {
  const fixture = await buildKnowledgeTeamArtifactContractFixture();
  return buildKnowledgeTeamUploadApprovalIntent({
    publicationReadiness: fixture.uploadRequiredReadiness,
    backendReferenceValidation: validBackendReferenceSummary()
  });
}

function withEnvValues(updates, callback) {
  const previous = {};
  for (const [key, value] of Object.entries(updates)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (typeof value === 'undefined') {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

function assertNoPrivateValues(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const forbidden of [
    'https://should-not-read.example.test',
    'should-not-read-bucket',
    'should-not-read-secret',
    'aws s3 cp',
    's3://private-bucket',
    'private-key'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

test('upload approval continuation records matching explicit fingerprint without enabling upload', async () => {
  const intent = await validApprovalIntent();
  const continuation = buildKnowledgeTeamUploadApprovalContinuation({
    approvalIntent: intent,
    approvalFingerprint: intent.approvalFingerprint.value
  });

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
  assert.equal(continuation.backendKind, 's3-compatible');
  assert.equal(continuation.target.manifestId, intent.manifestId);
  assert.equal(continuation.target.objectKey, intent.object.key);
  assert.equal(continuation.target.objectSha256, intent.object.sha256);
  assert.equal(continuation.target.artifactId, intent.artifact.id);
  assert.equal(continuation.approval.required, true);
  assert.equal(continuation.approval.provided, true);
  assert.equal(continuation.approval.source, 'cli-flag');
  assert.equal(continuation.approval.expectedFingerprint, intent.approvalFingerprint.value);
  assert.equal(continuation.approval.suppliedFingerprint, intent.approvalFingerprint.value);
  assert.equal(continuation.approval.fingerprintVerified, true);
  assert.equal(continuation.credentialBoundary.requiredEnvironmentVariableCount, 5);
  assert.equal(continuation.credentialBoundary.optionalEnvironmentVariableCount, 1);
  assert.equal(continuation.credentialBoundary.credentialValuesRead, false);
  assert.equal(continuation.adapterBoundary.dependencyInjectionRequired, true);
  assert.equal(continuation.adapterBoundary.adapterInjected, false);
  assert.equal(continuation.adapterBoundary.realBackendImplemented, false);
  assert.equal(continuation.adapterBoundary.remoteWriteCapabilityEnabled, false);
  assert.equal(continuation.readiness.nextAction, 'inject-approved-adapter-dependencies');
  assert.equal(continuation.readiness.blockerCount, 0);
  assert.deepEqual(continuation.readiness.blockerCodes, []);
});

test('upload approval continuation blocks when the intent is not approval-required', async () => {
  const fixture = await buildBlockedKnowledgeTeamArtifactContractFixture();
  const intent = buildKnowledgeTeamUploadApprovalIntent({
    publicationReadiness: fixture.uploadRequiredReadiness,
    backendReferenceValidation: validBackendReferenceSummary()
  });
  const continuation = buildKnowledgeTeamUploadApprovalContinuation({
    approvalIntent: intent,
    approvalFingerprint: 'a'.repeat(64)
  });

  assert.equal(continuation.status, 'blocked');
  assert.equal(continuation.uploadApproved, false);
  assert.equal(continuation.uploadExecutionAllowed, false);
  assert.equal(continuation.uploadCommand, null);
  assert.equal(continuation.approval.intentStatus, 'blocked');
  assert.equal(continuation.approval.expectedFingerprint, null);
  assert.equal(continuation.approval.fingerprintVerified, false);
  assert.equal(continuation.readiness.nextAction, 'resolve-blockers');
  assert.equal(continuation.readiness.blockerCodes.includes('intent-not-approval-required'), true);
  assert.equal(continuation.readiness.blockerCodes.includes('approval-fingerprint-missing'), true);
});

test('upload approval continuation blocks mismatched explicit fingerprint', async () => {
  const intent = await validApprovalIntent();
  const continuation = buildKnowledgeTeamUploadApprovalContinuation({
    approvalIntent: intent,
    approvalFingerprint: 'b'.repeat(64)
  });

  assert.equal(continuation.status, 'blocked');
  assert.equal(continuation.approval.provided, true);
  assert.equal(continuation.approval.fingerprintVerified, false);
  assert.equal(continuation.approval.expectedFingerprint, intent.approvalFingerprint.value);
  assert.equal(continuation.approval.suppliedFingerprint, 'b'.repeat(64));
  assert.equal(continuation.readiness.blockerCodes.includes('approval-fingerprint-mismatch'), true);
  assert.equal(continuation.remoteWriteAllowed, false);
  assert.equal(continuation.uploadCommand, null);
});

test('upload approval continuation does not read env values or copy unsafe upload details', async () => {
  const intent = await validApprovalIntent();
  await withEnvValues({
    INFRA_AGENT_TEAM_CACHE_S3_ENDPOINT_URL: 'https://should-not-read.example.test',
    INFRA_AGENT_TEAM_CACHE_S3_BUCKET_NAME: 'should-not-read-bucket',
    INFRA_AGENT_TEAM_CACHE_S3_SECRET_ACCESS_KEY: 'should-not-read-secret'
  }, async () => {
    const continuation = buildKnowledgeTeamUploadApprovalContinuation({
      approvalIntent: {
        ...intent,
        endpointUrl: 'https://private.example.test',
        uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
        credentialValuesExposed: true
      },
      approvalFingerprint: intent.approvalFingerprint.value
    });

    assert.equal(continuation.status, 'blocked');
    assert.equal(continuation.credentialValuesExposed, false);
    assert.equal(continuation.uploadCommand, null);
    assert.equal(continuation.readiness.blockerCodes.includes('backend-detail-leak'), true);
    assert.equal(continuation.readiness.blockerCodes.includes('credential-values-exposed'), true);
    assert.equal(continuation.readiness.blockerCodes.includes('upload-command-present'), true);
    assertNoPrivateValues(continuation);
  });
});
