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

async function validPrerequisitePlan() {
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
  return buildKnowledgeTeamUploadExecutionPrerequisitePlan({ approvalReview });
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
  assert.equal(boundary.writeTokenBoundary.tokenIssued, false);
  assert.equal(boundary.writeTokenBoundary.tokenScopeBoundToArtifact, false);
  assert.equal(boundary.writeTokenBoundary.singleUseTokenIssued, false);
  assert.equal(boundary.writeTokenBoundary.tokenExpirySet, false);
  assert.equal(boundary.writeTokenBoundary.auditBindingCreated, false);
  assert.equal(boundary.writeTokenBoundary.executionLeaseCreated, false);
  assert.equal(boundary.writeTokenBoundary.rollbackPlanCreated, false);
  assert.equal(boundary.writeTokenBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.artifactBytesProvided, false);
  assert.equal(boundary.remainingExecutionBoundaries.adapterInjected, false);
  assert.equal(boundary.remainingExecutionBoundaries.executionLeaseCreated, false);
  assert.equal(boundary.remainingExecutionBoundaries.rollbackPlanCreated, false);
  assert.equal(boundary.remainingExecutionBoundaries.auditRecordCreated, false);
  assert.equal(boundary.remainingExecutionBoundaries.objectWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.metadataIndexWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.remoteMutationAllowed, false);
}

function blockerCodes(boundary) {
  return new Set(boundary.readiness.blockerCodes);
}

test('upload write token boundary records token requirements without issuing a token', async () => {
  const prerequisitePlan = await validPrerequisitePlan();
  const boundary = buildKnowledgeTeamUploadWriteTokenBoundary({ prerequisitePlan });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-write-token-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'write-token-boundary-dry-run');
  assert.equal(boundary.status, 'write-token-boundary-ready');
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.target.manifestId, prerequisitePlan.target.manifestId);
  assert.equal(boundary.target.objectKey, prerequisitePlan.target.objectKey);
  assert.equal(boundary.target.objectSha256, prerequisitePlan.target.objectSha256);
  assert.equal(boundary.target.artifactId, prerequisitePlan.target.artifactId);
  assert.equal(boundary.sourcePrerequisitePlan.source, 'upload-execution-prerequisite-plan');
  assert.equal(boundary.sourcePrerequisitePlan.prerequisiteStatus, 'prerequisite-plan-ready');
  assert.equal(boundary.sourcePrerequisitePlan.prerequisitePlanKind, 'execution-prerequisite-boundary-dry-run');
  assert.equal(boundary.sourcePrerequisitePlan.prerequisiteNextAction, 'design-write-token-boundary');
  assert.equal(boundary.sourcePrerequisitePlan.reviewStatus, 'review-ready');
  assert.equal(boundary.sourcePrerequisitePlan.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourcePrerequisitePlan.scopeMatched, true);
  assert.equal(boundary.sourcePrerequisitePlan.humanReviewRecorded, true);
  assert.equal(boundary.sourcePrerequisitePlan.fingerprintVerified, true);
  assert.equal(boundary.sourcePrerequisitePlan.sourceFingerprintVerified, true);
  assert.equal(boundary.sourcePrerequisitePlan.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourcePrerequisitePlan.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourcePrerequisitePlan.writeTokenRequiredBeforeExecution, true);
  assert.equal(boundary.writeTokenBoundary.dryRunOnly, true);
  assert.equal(boundary.writeTokenBoundary.tokenRequiredBeforeExecution, true);
  assert.equal(boundary.writeTokenBoundary.tokenScopeBindingRequired, true);
  assert.equal(boundary.writeTokenBoundary.tokenSingleUseRequired, true);
  assert.equal(boundary.writeTokenBoundary.tokenExpiryRequired, true);
  assert.equal(boundary.writeTokenBoundary.auditBindingRequired, true);
  assert.equal(boundary.writeTokenBoundary.executionLeaseRequiredBeforeIssuance, true);
  assert.equal(boundary.writeTokenBoundary.rollbackPlanRequiredBeforeIssuance, true);
  assert.equal(boundary.readiness.status, 'write-token-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-execution-lease-boundary');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assertNoPrivateValues(boundary);
});
