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

async function validExecutionLeaseBoundary() {
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
  return buildKnowledgeTeamUploadExecutionLeaseBoundary({ writeTokenBoundary });
}

function assertNoPrivateValues(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const forbidden of [
    'https://should-not-copy.example.test',
    'should-not-copy-bucket',
    'should-not-copy-secret',
    'aws s3 cp',
    's3://private-bucket',
    'private-key'
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
  assert.equal(boundary.rollbackPlanBoundary.rollbackPlanCreated, false);
  assert.equal(boundary.rollbackPlanBoundary.rollbackScopeBoundToArtifact, false);
  assert.equal(boundary.rollbackPlanBoundary.rollbackReviewed, false);
  assert.equal(boundary.rollbackPlanBoundary.writeTokenIssued, false);
  assert.equal(boundary.rollbackPlanBoundary.executionLeaseCreated, false);
  assert.equal(boundary.rollbackPlanBoundary.artifactBytesProvided, false);
  assert.equal(boundary.rollbackPlanBoundary.auditBindingCreated, false);
  assert.equal(boundary.rollbackPlanBoundary.auditRecordCreated, false);
  assert.equal(boundary.rollbackPlanBoundary.executable, false);
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

test('upload rollback plan boundary records rollback requirements without creating a rollback plan', async () => {
  const executionLeaseBoundary = await validExecutionLeaseBoundary();
  const boundary = buildKnowledgeTeamUploadRollbackPlanBoundary({ executionLeaseBoundary });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-rollback-plan-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'rollback-plan-boundary-dry-run');
  assert.equal(boundary.status, 'rollback-plan-boundary-ready');
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.target.manifestId, executionLeaseBoundary.target.manifestId);
  assert.equal(boundary.target.objectKey, executionLeaseBoundary.target.objectKey);
  assert.equal(boundary.target.objectSha256, executionLeaseBoundary.target.objectSha256);
  assert.equal(boundary.target.artifactId, executionLeaseBoundary.target.artifactId);
  assert.equal(boundary.sourceExecutionLeaseBoundary.source, 'upload-execution-lease-boundary');
  assert.equal(boundary.sourceExecutionLeaseBoundary.boundaryStatus, 'execution-lease-boundary-ready');
  assert.equal(boundary.sourceExecutionLeaseBoundary.boundaryKind, 'execution-lease-boundary-dry-run');
  assert.equal(boundary.sourceExecutionLeaseBoundary.boundaryNextAction, 'design-rollback-plan-boundary');
  assert.equal(boundary.sourceExecutionLeaseBoundary.reviewStatus, 'review-ready');
  assert.equal(boundary.sourceExecutionLeaseBoundary.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourceExecutionLeaseBoundary.scopeMatched, true);
  assert.equal(boundary.sourceExecutionLeaseBoundary.humanReviewRecorded, true);
  assert.equal(boundary.sourceExecutionLeaseBoundary.fingerprintVerified, true);
  assert.equal(boundary.sourceExecutionLeaseBoundary.sourceFingerprintVerified, true);
  assert.equal(boundary.sourceExecutionLeaseBoundary.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourceExecutionLeaseBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceExecutionLeaseBoundary.tokenRequiredBeforeExecution, true);
  assert.equal(boundary.sourceExecutionLeaseBoundary.executionLeaseRequiredBeforeExecution, true);
  assert.equal(boundary.sourceExecutionLeaseBoundary.rollbackPlanRequiredBeforeExecution, true);
  assert.equal(boundary.rollbackPlanBoundary.dryRunOnly, true);
  assert.equal(boundary.rollbackPlanBoundary.rollbackPlanRequiredBeforeExecution, true);
  assert.equal(boundary.rollbackPlanBoundary.rollbackScopeBindingRequired, true);
  assert.equal(boundary.rollbackPlanBoundary.rollbackReviewRequired, true);
  assert.equal(boundary.rollbackPlanBoundary.writeTokenRequiredBeforeRollback, true);
  assert.equal(boundary.rollbackPlanBoundary.executionLeaseRequiredBeforeRollback, true);
  assert.equal(boundary.rollbackPlanBoundary.artifactBytesRequiredBeforeRollback, true);
  assert.equal(boundary.rollbackPlanBoundary.auditBindingRequired, true);
  assert.equal(boundary.rollbackPlanBoundary.auditRecordRequiredBeforeExecution, true);
  assert.equal(boundary.readiness.status, 'rollback-plan-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-audit-record-boundary');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assertNoPrivateValues(boundary);
});
