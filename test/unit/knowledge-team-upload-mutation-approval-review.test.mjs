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
  buildKnowledgeTeamUploadMockHarness
} from '../../src/knowledge/team-upload-mock-harness.ts';
import {
  buildKnowledgeTeamUploadMutationPlan
} from '../../src/knowledge/team-upload-mutation-plan.ts';
import {
  buildKnowledgeTeamUploadMutationApprovalReview
} from '../../src/knowledge/team-upload-mutation-approval-review.ts';
import {
  buildKnowledgeTeamArtifactContractFixture
} from '../support/knowledge-team-artifact-fixtures.mjs';

function validBackendReferenceSummary() {
  return validateKnowledgeTeamS3CompatibleBackendReferences(
    buildKnowledgeTeamS3CompatibleBackendConfig(),
    buildKnowledgeTeamS3CompatibleReferenceRegistry()
  );
}

async function validMutationPlan() {
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
  return buildKnowledgeTeamUploadMutationPlan({ executionGate });
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

test('upload mutation approval review records matching fingerprint without enabling execution', async () => {
  const mutationPlan = await validMutationPlan();
  const review = buildKnowledgeTeamUploadMutationApprovalReview({
    mutationPlan,
    approvalFingerprint: mutationPlan.approvalAudit.approvalScopeFingerprint.value
  });

  assert.equal(review.kind, 'infra-agent.knowledge-team-upload-mutation-approval-review');
  assert.equal(review.schemaVersion, 1);
  assert.equal(review.mutationAllowed, false);
  assert.equal(review.executionMode, 'dry-run');
  assert.equal(review.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(review.status, 'review-ready');
  assert.equal(review.plannedOperation, 'stage-knowledge-pack');
  assert.equal(review.remoteWriteAllowed, false);
  assert.equal(review.liveCheckAllowed, false);
  assert.equal(review.credentialValuesExposed, false);
  assert.equal(review.credentialPresenceChecked, false);
  assert.equal(review.uploadApproved, false);
  assert.equal(review.uploadExecutionAllowed, false);
  assert.equal(review.mutationApprovalGranted, false);
  assert.equal(review.clientCreated, false);
  assert.equal(review.adapterInjected, false);
  assert.equal(review.artifactBytesProvided, false);
  assert.equal(review.writeTokenIssued, false);
  assert.equal(review.executionLeaseCreated, false);
  assert.equal(review.rollbackPlanCreated, false);
  assert.equal(review.objectWriteAttempted, false);
  assert.equal(review.metadataIndexWriteAttempted, false);
  assert.equal(review.remoteMutationPerformed, false);
  assert.equal(review.uploadCommand, null);
  assert.equal(review.target.manifestId, mutationPlan.target.manifestId);
  assert.equal(review.target.objectKey, mutationPlan.target.objectKey);
  assert.equal(review.target.objectSha256, mutationPlan.target.objectSha256);
  assert.equal(review.target.artifactId, mutationPlan.target.artifactId);
  assert.equal(review.sourcePlan.source, 'upload-mutation-plan');
  assert.equal(review.sourcePlan.planStatus, 'plan-ready');
  assert.equal(review.sourcePlan.planKind, 'approval-audit-dry-run');
  assert.equal(review.sourcePlan.planNextAction, 'request-human-mutation-approval');
  assert.equal(review.sourcePlan.gateStatus, 'gate-ready');
  assert.equal(review.sourcePlan.scopeMatched, true);
  assert.equal(review.sourcePlan.sourceFingerprintVerified, true);
  assert.equal(review.sourcePlan.mockHarnessStatus, 'harness-ready');
  assert.equal(review.sourcePlan.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(
    review.sourcePlan.approvalFingerprint.value,
    mutationPlan.approvalAudit.approvalScopeFingerprint.value
  );
  assert.equal(review.approvalReview.mutationApprovalRequired, true);
  assert.equal(review.approvalReview.humanReviewRequired, true);
  assert.equal(review.approvalReview.humanReviewRecorded, true);
  assert.equal(review.approvalReview.source, 'cli-flag');
  assert.equal(
    review.approvalReview.suppliedFingerprint,
    mutationPlan.approvalAudit.approvalScopeFingerprint.value
  );
  assert.equal(
    review.approvalReview.expectedFingerprint,
    mutationPlan.approvalAudit.approvalScopeFingerprint.value
  );
  assert.equal(review.approvalReview.fingerprintVerified, true);
  assert.equal(review.approvalReview.mutationApprovalGranted, false);
  assert.equal(review.approvalReview.uploadApproved, false);
  assert.equal(review.approvalReview.uploadExecutionAllowed, false);
  assert.equal(review.executionBoundary.executable, false);
  assert.equal(review.executionBoundary.dryRunOnly, true);
  assert.equal(review.executionBoundary.artifactBytesProvided, false);
  assert.equal(review.executionBoundary.adapterInjected, false);
  assert.equal(review.executionBoundary.writeTokenIssued, false);
  assert.equal(review.executionBoundary.executionLeaseCreated, false);
  assert.equal(review.executionBoundary.rollbackPlanCreated, false);
  assert.equal(review.executionBoundary.auditRecordCreated, false);
  assert.equal(review.executionBoundary.clientCreated, false);
  assert.equal(review.executionBoundary.credentialValuesRead, false);
  assert.equal(review.executionBoundary.credentialPresenceChecked, false);
  assert.equal(review.executionBoundary.liveCheckPerformed, false);
  assert.equal(review.executionBoundary.uploadCommandGenerated, false);
  assert.equal(review.executionBoundary.objectWriteAttempted, false);
  assert.equal(review.executionBoundary.metadataIndexWriteAttempted, false);
  assert.equal(review.executionBoundary.remoteMutationPerformed, false);
  assert.equal(review.readiness.status, 'review-ready');
  assert.equal(review.readiness.nextAction, 'plan-execution-prerequisite-boundaries');
  assert.equal(review.readiness.blockerCount, 0);
  assert.deepEqual(review.readiness.blockerCodes, []);
  assertNoPrivateValues(review);
});
