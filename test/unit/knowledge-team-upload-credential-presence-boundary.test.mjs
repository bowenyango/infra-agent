import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMockKnowledgeTeamBackendAdapterConfig,
  planKnowledgeTeamBackendAdapterResolution
} from '../../src/knowledge/team-backend-adapter-resolver.ts';
import {
  buildKnowledgeTeamS3CompatibleBackendConfig
} from '../../src/knowledge/team-s3-compatible-backend-config.ts';
import {
  buildKnowledgeTeamS3CompatibleReferenceRegistry,
  validateKnowledgeTeamS3CompatibleBackendReferences
} from '../../src/knowledge/team-s3-compatible-reference-registry.ts';
import {
  buildKnowledgeTeamUploadAdapterInjectionBoundary
} from '../../src/knowledge/team-upload-adapter-injection-boundary.ts';
import {
  buildKnowledgeTeamUploadAdapterPreflight
} from '../../src/knowledge/team-upload-adapter-preflight.ts';
import {
  buildKnowledgeTeamUploadApprovalContinuation
} from '../../src/knowledge/team-upload-approval-continuation.ts';
import {
  buildKnowledgeTeamUploadApprovalIntent
} from '../../src/knowledge/team-upload-approval-intent.ts';
import {
  buildKnowledgeTeamUploadArtifactBytesBoundary
} from '../../src/knowledge/team-upload-artifact-bytes-boundary.ts';
import {
  buildKnowledgeTeamUploadAuditRecordBoundary
} from '../../src/knowledge/team-upload-audit-record-boundary.ts';
import {
  buildKnowledgeTeamUploadClientCreationBoundary
} from '../../src/knowledge/team-upload-client-creation-boundary.ts';
import {
  buildKnowledgeTeamUploadCredentialPresenceBoundary
} from '../../src/knowledge/team-upload-credential-presence-boundary.ts';
import {
  buildKnowledgeTeamUploadCredentialReadBoundary
} from '../../src/knowledge/team-upload-credential-read-boundary.ts';
import {
  buildKnowledgeTeamUploadExecutionGate
} from '../../src/knowledge/team-upload-execution-gate.ts';
import {
  buildKnowledgeTeamUploadExecutionLeaseBoundary
} from '../../src/knowledge/team-upload-execution-lease-boundary.ts';
import {
  buildKnowledgeTeamUploadExecutionPrerequisitePlan
} from '../../src/knowledge/team-upload-execution-prerequisite-plan.ts';
import {
  buildKnowledgeTeamUploadMockHarness
} from '../../src/knowledge/team-upload-mock-harness.ts';
import {
  buildKnowledgeTeamUploadMutationApprovalReview
} from '../../src/knowledge/team-upload-mutation-approval-review.ts';
import {
  buildKnowledgeTeamUploadMutationPlan
} from '../../src/knowledge/team-upload-mutation-plan.ts';
import {
  buildKnowledgeTeamUploadRollbackPlanBoundary
} from '../../src/knowledge/team-upload-rollback-plan-boundary.ts';
import {
  buildKnowledgeTeamUploadWriteTokenBoundary
} from '../../src/knowledge/team-upload-write-token-boundary.ts';
import {
  buildKnowledgeTeamArtifactContractFixture
} from '../support/knowledge-team-artifact-fixtures.mjs';

function validBackendReferenceSummary() {
  return validateKnowledgeTeamS3CompatibleBackendReferences(
    buildKnowledgeTeamS3CompatibleBackendConfig(),
    buildKnowledgeTeamS3CompatibleReferenceRegistry()
  );
}

async function validCredentialReadBoundary() {
  const fixture = await buildKnowledgeTeamArtifactContractFixture();
  const intent = buildKnowledgeTeamUploadApprovalIntent({
    publicationReadiness: fixture.uploadRequiredReadiness,
    backendReferenceValidation: validBackendReferenceSummary()
  });
  const continuation = buildKnowledgeTeamUploadApprovalContinuation({
    approvalIntent: intent,
    approvalFingerprint: intent.approvalFingerprint.value
  });
  const adapterResolutionPlan = planKnowledgeTeamBackendAdapterResolution(
    buildMockKnowledgeTeamBackendAdapterConfig('mock-team-cache')
  );
  const preflight = buildKnowledgeTeamUploadAdapterPreflight({
    continuation,
    adapterResolutionPlan
  });
  const mockHarness = buildKnowledgeTeamUploadMockHarness({ preflight });
  const executionGate = buildKnowledgeTeamUploadExecutionGate({
    continuation,
    mockHarness
  });
  const mutationPlan = buildKnowledgeTeamUploadMutationPlan({ executionGate });
  const approvalReview = buildKnowledgeTeamUploadMutationApprovalReview({
    mutationPlan,
    approvalFingerprint: mutationPlan.approvalAudit.approvalScopeFingerprint.value
  });
  const prerequisitePlan = buildKnowledgeTeamUploadExecutionPrerequisitePlan({ approvalReview });
  const writeTokenBoundary = buildKnowledgeTeamUploadWriteTokenBoundary({ prerequisitePlan });
  const executionLeaseBoundary = buildKnowledgeTeamUploadExecutionLeaseBoundary({ writeTokenBoundary });
  const rollbackPlanBoundary = buildKnowledgeTeamUploadRollbackPlanBoundary({ executionLeaseBoundary });
  const auditRecordBoundary = buildKnowledgeTeamUploadAuditRecordBoundary({ rollbackPlanBoundary });
  const artifactBytesBoundary = buildKnowledgeTeamUploadArtifactBytesBoundary({ auditRecordBoundary });
  const adapterInjectionBoundary = buildKnowledgeTeamUploadAdapterInjectionBoundary({ artifactBytesBoundary });
  const clientCreationBoundary = buildKnowledgeTeamUploadClientCreationBoundary({ adapterInjectionBoundary });
  return buildKnowledgeTeamUploadCredentialReadBoundary({ clientCreationBoundary });
}

function assertNoPrivateValues(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const forbidden of [
    'https://should-not-copy.example.test',
    'should-not-copy-bucket',
    'should-not-copy-secret',
    'aws s3 cp',
    's3://private-bucket',
    'private-key',
    'client-secret-value',
    'credential-secret-value',
    'raw-artifact-bytes'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

function assertExecutionAndCredentialPresenceDisabled(boundary) {
  assert.equal(boundary.mutationAllowed, false);
  assert.equal(boundary.executionMode, 'dry-run');
  assert.equal(boundary.remoteWriteAllowed, false);
  assert.equal(boundary.liveCheckAllowed, false);
  assert.equal(boundary.credentialValuesExposed, false);
  assert.equal(boundary.credentialPresenceChecked, false);
  assert.equal(boundary.uploadApproved, false);
  assert.equal(boundary.uploadExecutionAllowed, false);
  assert.equal(boundary.mutationApprovalGranted, false);
  assert.equal(boundary.clientCreated, false);
  assert.equal(boundary.adapterInjected, false);
  assert.equal(boundary.artifactBytesProvided, false);
  assert.equal(boundary.writeTokenIssued, false);
  assert.equal(boundary.executionLeaseCreated, false);
  assert.equal(boundary.rollbackPlanCreated, false);
  assert.equal(boundary.auditRecordCreated, false);
  assert.equal(boundary.objectWriteAttempted, false);
  assert.equal(boundary.metadataIndexWriteAttempted, false);
  assert.equal(boundary.remoteMutationPerformed, false);
  assert.equal(boundary.uploadCommand, null);
  assert.equal(boundary.credentialPresenceBoundary.credentialValuesRead, false);
  assert.equal(boundary.credentialPresenceBoundary.credentialValuesExposed, false);
  assert.equal(boundary.credentialPresenceBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.credentialPresenceBoundary.credentialPresenceResultExposed, false);
  assert.equal(boundary.credentialPresenceBoundary.clientCreated, false);
  assert.equal(boundary.credentialPresenceBoundary.sdkClientCreated, false);
  assert.equal(boundary.credentialPresenceBoundary.adapterInjected, false);
  assert.equal(boundary.credentialPresenceBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.credentialPresenceBoundary.metadataIndexBound, false);
  assert.equal(boundary.credentialPresenceBoundary.liveCheckPerformed, false);
  assert.equal(boundary.credentialPresenceBoundary.uploadExecutionAllowed, false);
  assert.equal(boundary.credentialPresenceBoundary.uploadCommandGenerated, false);
  assert.equal(boundary.credentialPresenceBoundary.objectWriteAttempted, false);
  assert.equal(boundary.credentialPresenceBoundary.metadataIndexWriteAttempted, false);
  assert.equal(boundary.credentialPresenceBoundary.remoteMutationPerformed, false);
  assert.equal(boundary.credentialPresenceBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.artifactBytesProvided, false);
  assert.equal(boundary.remainingExecutionBoundaries.adapterInjected, false);
  assert.equal(boundary.remainingExecutionBoundaries.clientCreated, false);
  assert.equal(boundary.remainingExecutionBoundaries.credentialValuesExposed, false);
  assert.equal(boundary.remainingExecutionBoundaries.credentialPresenceChecked, false);
  assert.equal(boundary.remainingExecutionBoundaries.liveCheckPerformed, false);
  assert.equal(boundary.remainingExecutionBoundaries.uploadCommandGenerated, false);
  assert.equal(boundary.remainingExecutionBoundaries.objectWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.metadataIndexWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.remoteMutationAllowed, false);
}

function blockerCodes(boundary) {
  return new Set(boundary.readiness.blockerCodes);
}

test('upload credential presence boundary records presence requirements without checking credentials', async () => {
  const credentialReadBoundary = await validCredentialReadBoundary();
  const boundary = buildKnowledgeTeamUploadCredentialPresenceBoundary({ credentialReadBoundary });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-credential-presence-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'credential-presence-boundary-dry-run');
  assert.equal(boundary.status, 'credential-presence-boundary-ready');
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionAndCredentialPresenceDisabled(boundary);
  assert.equal(boundary.target.manifestId, credentialReadBoundary.target.manifestId);
  assert.equal(boundary.target.objectKey, credentialReadBoundary.target.objectKey);
  assert.equal(boundary.target.objectSha256, credentialReadBoundary.target.objectSha256);
  assert.equal(boundary.target.artifactId, credentialReadBoundary.target.artifactId);
  assert.equal(boundary.sourceCredentialReadBoundary.source, 'upload-credential-read-boundary');
  assert.equal(boundary.sourceCredentialReadBoundary.boundaryStatus, 'credential-read-boundary-ready');
  assert.equal(boundary.sourceCredentialReadBoundary.boundaryKind, 'credential-read-boundary-dry-run');
  assert.equal(boundary.sourceCredentialReadBoundary.boundaryNextAction, 'design-credential-presence-boundary');
  assert.equal(boundary.sourceCredentialReadBoundary.reviewStatus, 'review-ready');
  assert.equal(boundary.sourceCredentialReadBoundary.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourceCredentialReadBoundary.scopeMatched, true);
  assert.equal(boundary.sourceCredentialReadBoundary.humanReviewRecorded, true);
  assert.equal(boundary.sourceCredentialReadBoundary.fingerprintVerified, true);
  assert.equal(boundary.sourceCredentialReadBoundary.sourceFingerprintVerified, true);
  assert.equal(boundary.sourceCredentialReadBoundary.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourceCredentialReadBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceCredentialReadBoundary.credentialSourceDescriptorRequired, true);
  assert.equal(boundary.sourceCredentialReadBoundary.credentialReferenceOnlyRequired, true);
  assert.equal(boundary.sourceCredentialReadBoundary.credentialValueRedactionRequired, true);
  assert.equal(boundary.sourceCredentialReadBoundary.credentialValuesRead, false);
  assert.equal(boundary.sourceCredentialReadBoundary.credentialValuesExposed, false);
  assert.equal(boundary.sourceCredentialReadBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.credentialPresenceBoundary.dryRunOnly, true);
  assert.equal(boundary.credentialPresenceBoundary.credentialPresenceCheckRequiredBeforeExecution, true);
  assert.equal(boundary.credentialPresenceBoundary.credentialPresenceCheckRequiredAfterCredentialReadBoundary, true);
  assert.equal(boundary.credentialPresenceBoundary.credentialReadBoundaryRequired, true);
  assert.equal(boundary.credentialPresenceBoundary.credentialPresenceSignalRequired, true);
  assert.equal(boundary.credentialPresenceBoundary.credentialPresenceResultRedactionRequired, true);
  assert.equal(boundary.credentialPresenceBoundary.liveCheckBoundaryRequired, true);
  assert.equal(boundary.credentialPresenceBoundary.uploadCommandBoundaryRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.credentialReadRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.credentialPresenceCheckRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.liveCheckRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.uploadCommandRequired, true);
  assert.equal(boundary.readiness.status, 'credential-presence-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-live-check-boundary');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assertNoPrivateValues(boundary);
});

export {
  assertExecutionAndCredentialPresenceDisabled,
  assertNoPrivateValues,
  blockerCodes,
  validCredentialReadBoundary
};
