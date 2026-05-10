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
  buildKnowledgeTeamArtifactContractFixture
} from '../support/knowledge-team-artifact-fixtures.mjs';

function validBackendReferenceSummary() {
  return validateKnowledgeTeamS3CompatibleBackendReferences(
    buildKnowledgeTeamS3CompatibleBackendConfig(),
    buildKnowledgeTeamS3CompatibleReferenceRegistry()
  );
}

async function validApprovalReview() {
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
  return buildKnowledgeTeamUploadMutationApprovalReview({
    mutationPlan,
    approvalFingerprint: mutationPlan.approvalAudit.approvalScopeFingerprint.value
  });
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

function assertExecutionDisabled(plan) {
  assert.equal(plan.mutationAllowed, false);
  assert.equal(plan.executionMode, 'dry-run');
  assert.equal(plan.remoteWriteAllowed, false);
  assert.equal(plan.liveCheckAllowed, false);
  assert.equal(plan.credentialValuesExposed, false);
  assert.equal(plan.credentialPresenceChecked, false);
  assert.equal(plan.uploadApproved, false);
  assert.equal(plan.uploadExecutionAllowed, false);
  assert.equal(plan.mutationApprovalGranted, false);
  assert.equal(plan.clientCreated, false);
  assert.equal(plan.adapterInjected, false);
  assert.equal(plan.artifactBytesProvided, false);
  assert.equal(plan.writeTokenIssued, false);
  assert.equal(plan.executionLeaseCreated, false);
  assert.equal(plan.rollbackPlanCreated, false);
  assert.equal(plan.auditRecordCreated, false);
  assert.equal(plan.objectWriteAttempted, false);
  assert.equal(plan.metadataIndexWriteAttempted, false);
  assert.equal(plan.remoteMutationPerformed, false);
  assert.equal(plan.uploadCommand, null);
  assert.equal(plan.prerequisitePlan.mutationApprovalGranted, false);
  assert.equal(plan.prerequisitePlan.uploadApproved, false);
  assert.equal(plan.prerequisitePlan.uploadExecutionAllowed, false);
  assert.equal(plan.prerequisitePlan.executionAllowed, false);
  assert.equal(plan.executionBoundary.executable, false);
  assert.equal(plan.executionBoundary.dryRunOnly, true);
  assert.equal(plan.executionBoundary.artifactBytesProvided, false);
  assert.equal(plan.executionBoundary.adapterInjected, false);
  assert.equal(plan.executionBoundary.writeTokenIssued, false);
  assert.equal(plan.executionBoundary.executionLeaseCreated, false);
  assert.equal(plan.executionBoundary.rollbackPlanCreated, false);
  assert.equal(plan.executionBoundary.auditRecordCreated, false);
  assert.equal(plan.executionBoundary.clientCreated, false);
  assert.equal(plan.executionBoundary.credentialValuesRead, false);
  assert.equal(plan.executionBoundary.credentialPresenceChecked, false);
  assert.equal(plan.executionBoundary.liveCheckPerformed, false);
  assert.equal(plan.executionBoundary.uploadCommandGenerated, false);
  assert.equal(plan.executionBoundary.objectWriteAttempted, false);
  assert.equal(plan.executionBoundary.metadataIndexWriteAttempted, false);
  assert.equal(plan.executionBoundary.remoteMutationPerformed, false);
}

test('upload execution prerequisite plan records required boundaries without enabling execution', async () => {
  const approvalReview = await validApprovalReview();
  const plan = buildKnowledgeTeamUploadExecutionPrerequisitePlan({ approvalReview });

  assert.equal(plan.kind, 'infra-agent.knowledge-team-upload-execution-prerequisite-plan');
  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.prerequisitePlanKind, 'execution-prerequisite-boundary-dry-run');
  assert.equal(plan.status, 'prerequisite-plan-ready');
  assert.equal(plan.plannedOperation, 'stage-knowledge-pack');
  assertExecutionDisabled(plan);
  assert.equal(plan.target.manifestId, approvalReview.target.manifestId);
  assert.equal(plan.target.objectKey, approvalReview.target.objectKey);
  assert.equal(plan.target.objectSha256, approvalReview.target.objectSha256);
  assert.equal(plan.target.artifactId, approvalReview.target.artifactId);
  assert.equal(plan.sourceReview.source, 'upload-mutation-approval-review');
  assert.equal(plan.sourceReview.reviewStatus, 'review-ready');
  assert.equal(plan.sourceReview.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(plan.sourceReview.reviewNextAction, 'plan-execution-prerequisite-boundaries');
  assert.equal(plan.sourceReview.planStatus, 'plan-ready');
  assert.equal(plan.sourceReview.planNextAction, 'request-human-mutation-approval');
  assert.equal(plan.sourceReview.gateStatus, 'gate-ready');
  assert.equal(plan.sourceReview.scopeMatched, true);
  assert.equal(plan.sourceReview.humanReviewRecorded, true);
  assert.equal(plan.sourceReview.fingerprintVerified, true);
  assert.equal(plan.sourceReview.sourceFingerprintVerified, true);
  assert.equal(plan.sourceReview.suppliedFingerprint, approvalReview.approvalReview.suppliedFingerprint);
  assert.equal(plan.sourceReview.expectedFingerprint, approvalReview.approvalReview.expectedFingerprint);
  assert.equal(plan.sourceReview.adapterName, 'mock-team-cache');
  assert.equal(plan.sourceReview.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(plan.prerequisitePlan.humanReviewRequired, true);
  assert.equal(plan.prerequisitePlan.humanReviewRecorded, true);
  assert.equal(plan.prerequisitePlan.fingerprintVerified, true);
  assert.equal(plan.prerequisitePlan.mutationApprovalRequired, true);
  assert.equal(plan.prerequisitePlan.executionPrerequisitesRequired, true);
  assert.equal(plan.prerequisitePlan.nextRequiredBoundary, 'write-token-boundary-design');
  assert.equal(plan.executionBoundary.artifactBytesRequiredBeforeExecution, true);
  assert.equal(plan.executionBoundary.adapterInjectionRequiredBeforeExecution, true);
  assert.equal(plan.executionBoundary.writeTokenRequiredBeforeExecution, true);
  assert.equal(plan.executionBoundary.executionLeaseRequiredBeforeExecution, true);
  assert.equal(plan.executionBoundary.rollbackPlanRequiredBeforeExecution, true);
  assert.equal(plan.executionBoundary.auditRecordRequiredBeforeExecution, true);
  assert.equal(plan.readiness.status, 'prerequisite-plan-ready');
  assert.equal(plan.readiness.nextAction, 'design-write-token-boundary');
  assert.equal(plan.readiness.blockerCount, 0);
  assert.deepEqual(plan.readiness.blockerCodes, []);
  assertNoPrivateValues(plan);
});
