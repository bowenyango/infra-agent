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
  buildKnowledgeTeamUploadLiveCheckBoundary
} from '../../src/knowledge/team-upload-live-check-boundary.ts';
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

async function validCredentialPresenceBoundary() {
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
  const credentialReadBoundary = buildKnowledgeTeamUploadCredentialReadBoundary({ clientCreationBoundary });
  return buildKnowledgeTeamUploadCredentialPresenceBoundary({ credentialReadBoundary });
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
    'raw-artifact-bytes',
    'live-check-result'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

function assertExecutionAndLiveCheckDisabled(boundary) {
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
  assert.equal(boundary.liveCheckBoundary.credentialValuesRead, false);
  assert.equal(boundary.liveCheckBoundary.credentialValuesExposed, false);
  assert.equal(boundary.liveCheckBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.liveCheckBoundary.credentialPresenceResultExposed, false);
  assert.equal(boundary.liveCheckBoundary.clientCreated, false);
  assert.equal(boundary.liveCheckBoundary.sdkClientCreated, false);
  assert.equal(boundary.liveCheckBoundary.adapterInjected, false);
  assert.equal(boundary.liveCheckBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.liveCheckBoundary.metadataIndexBound, false);
  assert.equal(boundary.liveCheckBoundary.liveCheckAllowed, false);
  assert.equal(boundary.liveCheckBoundary.liveCheckPerformed, false);
  assert.equal(boundary.liveCheckBoundary.liveCheckResultExposed, false);
  assert.equal(boundary.liveCheckBoundary.uploadExecutionAllowed, false);
  assert.equal(boundary.liveCheckBoundary.uploadCommandGenerated, false);
  assert.equal(boundary.liveCheckBoundary.objectWriteAttempted, false);
  assert.equal(boundary.liveCheckBoundary.metadataIndexWriteAttempted, false);
  assert.equal(boundary.liveCheckBoundary.remoteMutationPerformed, false);
  assert.equal(boundary.liveCheckBoundary.executable, false);
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

test('upload live check boundary records live-check requirements without probing remotes', async () => {
  const credentialPresenceBoundary = await validCredentialPresenceBoundary();
  const boundary = buildKnowledgeTeamUploadLiveCheckBoundary({ credentialPresenceBoundary });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-live-check-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'live-check-boundary-dry-run');
  assert.equal(boundary.status, 'live-check-boundary-ready');
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionAndLiveCheckDisabled(boundary);
  assert.equal(boundary.target.manifestId, credentialPresenceBoundary.target.manifestId);
  assert.equal(boundary.target.objectKey, credentialPresenceBoundary.target.objectKey);
  assert.equal(boundary.target.objectSha256, credentialPresenceBoundary.target.objectSha256);
  assert.equal(boundary.target.artifactId, credentialPresenceBoundary.target.artifactId);
  assert.equal(boundary.sourceCredentialPresenceBoundary.source, 'upload-credential-presence-boundary');
  assert.equal(boundary.sourceCredentialPresenceBoundary.boundaryStatus, 'credential-presence-boundary-ready');
  assert.equal(boundary.sourceCredentialPresenceBoundary.boundaryKind, 'credential-presence-boundary-dry-run');
  assert.equal(boundary.sourceCredentialPresenceBoundary.boundaryNextAction, 'design-live-check-boundary');
  assert.equal(boundary.sourceCredentialPresenceBoundary.reviewStatus, 'review-ready');
  assert.equal(boundary.sourceCredentialPresenceBoundary.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourceCredentialPresenceBoundary.scopeMatched, true);
  assert.equal(boundary.sourceCredentialPresenceBoundary.humanReviewRecorded, true);
  assert.equal(boundary.sourceCredentialPresenceBoundary.fingerprintVerified, true);
  assert.equal(boundary.sourceCredentialPresenceBoundary.sourceFingerprintVerified, true);
  assert.equal(boundary.sourceCredentialPresenceBoundary.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourceCredentialPresenceBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceCredentialPresenceBoundary.credentialPresenceSignalRequired, true);
  assert.equal(boundary.sourceCredentialPresenceBoundary.credentialPresenceResultRedactionRequired, true);
  assert.equal(boundary.sourceCredentialPresenceBoundary.credentialValuesRead, false);
  assert.equal(boundary.sourceCredentialPresenceBoundary.credentialValuesExposed, false);
  assert.equal(boundary.sourceCredentialPresenceBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.sourceCredentialPresenceBoundary.credentialPresenceResultExposed, false);
  assert.equal(boundary.liveCheckBoundary.dryRunOnly, true);
  assert.equal(boundary.liveCheckBoundary.liveCheckRequiredBeforeExecution, true);
  assert.equal(boundary.liveCheckBoundary.liveCheckRequiredAfterCredentialPresenceBoundary, true);
  assert.equal(boundary.liveCheckBoundary.credentialPresenceBoundaryRequired, true);
  assert.equal(boundary.liveCheckBoundary.liveCheckPolicyRequired, true);
  assert.equal(boundary.liveCheckBoundary.liveCheckReadOnlyRequired, true);
  assert.equal(boundary.liveCheckBoundary.liveCheckResultRedactionRequired, true);
  assert.equal(boundary.liveCheckBoundary.uploadCommandBoundaryRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.credentialPresenceCheckRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.liveCheckRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.uploadCommandRequired, true);
  assert.equal(boundary.readiness.status, 'live-check-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-upload-command-boundary');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assertNoPrivateValues(boundary);
});
