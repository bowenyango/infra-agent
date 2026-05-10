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
  buildKnowledgeTeamUploadAdapterPreflight
} from '../../src/knowledge/team-upload-adapter-preflight.ts';
import {
  buildKnowledgeTeamUploadApprovalContinuation
} from '../../src/knowledge/team-upload-approval-continuation.ts';
import {
  buildKnowledgeTeamUploadApprovalIntent
} from '../../src/knowledge/team-upload-approval-intent.ts';
import {
  buildKnowledgeTeamUploadAuditRecordBoundary
} from '../../src/knowledge/team-upload-audit-record-boundary.ts';
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

async function validRollbackPlanBoundary() {
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
  return buildKnowledgeTeamUploadRollbackPlanBoundary({ executionLeaseBoundary });
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
    'audit-secret-value'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

function assertExecutionDisabled(boundary) {
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
  assert.equal(boundary.auditRecordBoundary.auditRecordCreated, false);
  assert.equal(boundary.auditRecordBoundary.auditScopeBoundToArtifact, false);
  assert.equal(boundary.auditRecordBoundary.auditReviewed, false);
  assert.equal(boundary.auditRecordBoundary.writeTokenIssued, false);
  assert.equal(boundary.auditRecordBoundary.executionLeaseCreated, false);
  assert.equal(boundary.auditRecordBoundary.rollbackPlanCreated, false);
  assert.equal(boundary.auditRecordBoundary.artifactBytesProvided, false);
  assert.equal(boundary.auditRecordBoundary.auditBindingCreated, false);
  assert.equal(boundary.auditRecordBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.artifactBytesProvided, false);
  assert.equal(boundary.remainingExecutionBoundaries.adapterInjected, false);
  assert.equal(boundary.remainingExecutionBoundaries.writeTokenIssued, false);
  assert.equal(boundary.remainingExecutionBoundaries.executionLeaseCreated, false);
  assert.equal(boundary.remainingExecutionBoundaries.rollbackPlanCreated, false);
  assert.equal(boundary.remainingExecutionBoundaries.auditRecordCreated, false);
  assert.equal(boundary.remainingExecutionBoundaries.objectWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.metadataIndexWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.remoteMutationAllowed, false);
}

test('upload audit record boundary records audit requirements without creating an audit record', async () => {
  const rollbackPlanBoundary = await validRollbackPlanBoundary();
  const boundary = buildKnowledgeTeamUploadAuditRecordBoundary({ rollbackPlanBoundary });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-audit-record-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'audit-record-boundary-dry-run');
  assert.equal(boundary.status, 'audit-record-boundary-ready');
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.target.manifestId, rollbackPlanBoundary.target.manifestId);
  assert.equal(boundary.target.objectKey, rollbackPlanBoundary.target.objectKey);
  assert.equal(boundary.target.objectSha256, rollbackPlanBoundary.target.objectSha256);
  assert.equal(boundary.target.artifactId, rollbackPlanBoundary.target.artifactId);
  assert.equal(boundary.sourceRollbackPlanBoundary.source, 'upload-rollback-plan-boundary');
  assert.equal(boundary.sourceRollbackPlanBoundary.boundaryStatus, 'rollback-plan-boundary-ready');
  assert.equal(boundary.sourceRollbackPlanBoundary.boundaryKind, 'rollback-plan-boundary-dry-run');
  assert.equal(boundary.sourceRollbackPlanBoundary.boundaryNextAction, 'design-audit-record-boundary');
  assert.equal(boundary.sourceRollbackPlanBoundary.reviewStatus, 'review-ready');
  assert.equal(boundary.sourceRollbackPlanBoundary.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourceRollbackPlanBoundary.scopeMatched, true);
  assert.equal(boundary.sourceRollbackPlanBoundary.humanReviewRecorded, true);
  assert.equal(boundary.sourceRollbackPlanBoundary.fingerprintVerified, true);
  assert.equal(boundary.sourceRollbackPlanBoundary.sourceFingerprintVerified, true);
  assert.equal(boundary.sourceRollbackPlanBoundary.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourceRollbackPlanBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceRollbackPlanBoundary.tokenRequiredBeforeExecution, true);
  assert.equal(boundary.sourceRollbackPlanBoundary.executionLeaseRequiredBeforeExecution, true);
  assert.equal(boundary.sourceRollbackPlanBoundary.rollbackPlanRequiredBeforeExecution, true);
  assert.equal(boundary.sourceRollbackPlanBoundary.rollbackScopeBindingRequired, true);
  assert.equal(boundary.sourceRollbackPlanBoundary.rollbackReviewRequired, true);
  assert.equal(boundary.sourceRollbackPlanBoundary.auditRecordRequiredBeforeExecution, true);
  assert.equal(boundary.auditRecordBoundary.dryRunOnly, true);
  assert.equal(boundary.auditRecordBoundary.auditRecordRequiredBeforeExecution, true);
  assert.equal(boundary.auditRecordBoundary.auditScopeBindingRequired, true);
  assert.equal(boundary.auditRecordBoundary.auditReviewRequired, true);
  assert.equal(boundary.auditRecordBoundary.writeTokenRequiredBeforeAudit, true);
  assert.equal(boundary.auditRecordBoundary.executionLeaseRequiredBeforeAudit, true);
  assert.equal(boundary.auditRecordBoundary.rollbackPlanRequiredBeforeAudit, true);
  assert.equal(boundary.auditRecordBoundary.artifactBytesRequiredBeforeAudit, true);
  assert.equal(boundary.auditRecordBoundary.auditBindingRequired, true);
  assert.equal(boundary.readiness.status, 'audit-record-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-artifact-bytes-boundary');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assertNoPrivateValues(boundary);
});
