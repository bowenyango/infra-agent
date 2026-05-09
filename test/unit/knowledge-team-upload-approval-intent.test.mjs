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

function validBackendReferenceSummary() {
  return validateKnowledgeTeamS3CompatibleBackendReferences(
    buildKnowledgeTeamS3CompatibleBackendConfig(),
    buildKnowledgeTeamS3CompatibleReferenceRegistry()
  );
}

function blockedBackendReferenceSummary() {
  return validateKnowledgeTeamS3CompatibleBackendReferences(
    buildKnowledgeTeamS3CompatibleBackendConfig({
      storageProfileRef: 'missing-storage-profile',
      authProfileRef: 'missing-auth-profile'
    }),
    buildKnowledgeTeamS3CompatibleReferenceRegistry()
  );
}

test('upload approval intent reports approval-required for dry-run upload preconditions', async () => {
  const fixture = await buildKnowledgeTeamArtifactContractFixture();
  const intent = buildKnowledgeTeamUploadApprovalIntent({
    publicationReadiness: fixture.uploadRequiredReadiness,
    backendReferenceValidation: validBackendReferenceSummary()
  });

  assert.equal(intent.kind, 'infra-agent.knowledge-team-upload-approval-intent');
  assert.equal(intent.schemaVersion, 1);
  assert.equal(intent.mutationAllowed, false);
  assert.equal(intent.executionMode, 'dry-run');
  assert.equal(intent.status, 'approval-required');
  assert.equal(intent.plannedOperation, 'stage-knowledge-pack');
  assert.equal(intent.remoteWriteAllowed, false);
  assert.equal(intent.liveCheckAllowed, false);
  assert.equal(intent.credentialValuesExposed, false);
  assert.equal(intent.credentialPresenceChecked, false);
  assert.equal(intent.uploadCommand, null);
  assert.equal(intent.backendKind, 's3-compatible');
  assert.equal(intent.publicationBackendKind, 'mock-s3-compatible');
  assert.equal(intent.manifestId, fixture.manifest.manifestId);
  assert.equal(intent.object.key, fixture.uploadRequiredReadiness.object.key);
  assert.equal(intent.artifact.id, fixture.pack.packId);
  assert.equal(intent.preconditions.publicationReadiness.status, 'upload-required');
  assert.equal(intent.preconditions.publicationReadiness.uploadRequired, true);
  assert.equal(intent.preconditions.backendReference.status, 'valid');
  assert.equal(intent.preconditions.credentialBoundary.credentialValuesRead, false);
  assert.equal(intent.preconditions.credentialBoundary.credentialPresenceChecked, false);
  assert.deepEqual(intent.preconditions.credentialBoundary.requiredEnvironmentVariables, [
    'INFRA_AGENT_TEAM_CACHE_S3_ENDPOINT_URL',
    'INFRA_AGENT_TEAM_CACHE_S3_BUCKET_NAME',
    'INFRA_AGENT_TEAM_CACHE_S3_REGION',
    'INFRA_AGENT_TEAM_CACHE_S3_ACCESS_KEY_ID',
    'INFRA_AGENT_TEAM_CACHE_S3_SECRET_ACCESS_KEY'
  ]);
  assert.deepEqual(intent.preconditions.credentialBoundary.optionalEnvironmentVariables, [
    'INFRA_AGENT_TEAM_CACHE_S3_SESSION_TOKEN'
  ]);
  assert.equal(intent.preconditions.uploadApproval.explicitUploadApprovalRequired, true);
  assert.equal(intent.preconditions.uploadApproval.approvalProvided, false);
  assert.equal(intent.preconditions.uploadApproval.approvalSource, null);
  assert.equal(intent.preconditions.uploadApproval.uploadCommandGenerated, false);
  assert.deepEqual(intent.readiness.blockerCodes, []);
  assert.equal(intent.readiness.blockerCount, 0);
  assert.equal(intent.readiness.nextAction, 'request-explicit-upload-approval');
});

test('upload approval intent blocks when publication readiness is blocked', async () => {
  const fixture = await buildBlockedKnowledgeTeamArtifactContractFixture();
  const intent = buildKnowledgeTeamUploadApprovalIntent({
    publicationReadiness: fixture.uploadRequiredReadiness,
    backendReferenceValidation: validBackendReferenceSummary()
  });

  assert.equal(intent.status, 'blocked');
  assert.equal(intent.remoteWriteAllowed, false);
  assert.equal(intent.uploadCommand, null);
  assert.equal(intent.preconditions.publicationReadiness.status, 'blocked');
  assert.equal(intent.preconditions.publicationReadiness.uploadRequired, false);
  assert.equal(intent.preconditions.backendReference.status, 'valid');
  assert.equal(intent.readiness.nextAction, 'resolve-blockers');
  assert.equal(intent.readiness.blockerCodes.includes('publication-readiness-blocked'), true);
});

test('upload approval intent blocks when backend references are blocked', async () => {
  const fixture = await buildKnowledgeTeamArtifactContractFixture();
  const intent = buildKnowledgeTeamUploadApprovalIntent({
    publicationReadiness: fixture.uploadRequiredReadiness,
    backendReferenceValidation: blockedBackendReferenceSummary()
  });

  assert.equal(intent.status, 'blocked');
  assert.equal(intent.preconditions.publicationReadiness.uploadRequired, true);
  assert.equal(intent.preconditions.backendReference.status, 'blocked');
  assert.equal(intent.preconditions.credentialBoundary.requiredEnvironmentVariables.length, 0);
  assert.equal(intent.preconditions.credentialBoundary.optionalEnvironmentVariables.length, 0);
  assert.equal(intent.preconditions.uploadApproval.approvalProvided, false);
  assert.equal(intent.readiness.nextAction, 'resolve-blockers');
  assert.equal(intent.readiness.blockerCodes.includes('backend-reference-blocked'), true);
});
