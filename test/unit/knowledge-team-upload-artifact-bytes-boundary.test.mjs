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
  buildKnowledgeTeamUploadArtifactBytesBoundary
} from '../../src/knowledge/team-upload-artifact-bytes-boundary.ts';
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

async function validAuditRecordBoundary() {
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
  return buildKnowledgeTeamUploadAuditRecordBoundary({ rollbackPlanBoundary });
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
    'artifact-secret-value',
    'raw-artifact-bytes'
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
  assert.equal(boundary.artifactBytesBoundary.artifactBytesProvided, false);
  assert.equal(boundary.artifactBytesBoundary.artifactDigestVerified, false);
  assert.equal(boundary.artifactBytesBoundary.artifactScopeBoundToArtifact, false);
  assert.equal(boundary.artifactBytesBoundary.auditRecordCreated, false);
  assert.equal(boundary.artifactBytesBoundary.auditScopeBoundToArtifact, false);
  assert.equal(boundary.artifactBytesBoundary.writeTokenIssued, false);
  assert.equal(boundary.artifactBytesBoundary.executionLeaseCreated, false);
  assert.equal(boundary.artifactBytesBoundary.rollbackPlanCreated, false);
  assert.equal(boundary.artifactBytesBoundary.adapterInjected, false);
  assert.equal(boundary.artifactBytesBoundary.executable, false);
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

function blockerCodes(boundary) {
  return new Set(boundary.readiness.blockerCodes);
}

test('upload artifact bytes boundary records byte staging requirements without reading bytes', async () => {
  const auditRecordBoundary = await validAuditRecordBoundary();
  const boundary = buildKnowledgeTeamUploadArtifactBytesBoundary({ auditRecordBoundary });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-artifact-bytes-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'artifact-bytes-boundary-dry-run');
  assert.equal(boundary.status, 'artifact-bytes-boundary-ready');
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.target.manifestId, auditRecordBoundary.target.manifestId);
  assert.equal(boundary.target.objectKey, auditRecordBoundary.target.objectKey);
  assert.equal(boundary.target.objectSha256, auditRecordBoundary.target.objectSha256);
  assert.equal(boundary.target.artifactId, auditRecordBoundary.target.artifactId);
  assert.equal(boundary.sourceAuditRecordBoundary.source, 'upload-audit-record-boundary');
  assert.equal(boundary.sourceAuditRecordBoundary.boundaryStatus, 'audit-record-boundary-ready');
  assert.equal(boundary.sourceAuditRecordBoundary.boundaryKind, 'audit-record-boundary-dry-run');
  assert.equal(boundary.sourceAuditRecordBoundary.boundaryNextAction, 'design-artifact-bytes-boundary');
  assert.equal(boundary.sourceAuditRecordBoundary.reviewStatus, 'review-ready');
  assert.equal(boundary.sourceAuditRecordBoundary.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourceAuditRecordBoundary.scopeMatched, true);
  assert.equal(boundary.sourceAuditRecordBoundary.humanReviewRecorded, true);
  assert.equal(boundary.sourceAuditRecordBoundary.fingerprintVerified, true);
  assert.equal(boundary.sourceAuditRecordBoundary.sourceFingerprintVerified, true);
  assert.equal(boundary.sourceAuditRecordBoundary.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourceAuditRecordBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceAuditRecordBoundary.tokenRequiredBeforeExecution, true);
  assert.equal(boundary.sourceAuditRecordBoundary.executionLeaseRequiredBeforeExecution, true);
  assert.equal(boundary.sourceAuditRecordBoundary.rollbackPlanRequiredBeforeExecution, true);
  assert.equal(boundary.sourceAuditRecordBoundary.auditRecordRequiredBeforeExecution, true);
  assert.equal(boundary.sourceAuditRecordBoundary.auditScopeBindingRequired, true);
  assert.equal(boundary.sourceAuditRecordBoundary.auditReviewRequired, true);
  assert.equal(boundary.sourceAuditRecordBoundary.artifactBytesRequiredBeforeAudit, true);
  assert.equal(boundary.artifactBytesBoundary.dryRunOnly, true);
  assert.equal(boundary.artifactBytesBoundary.artifactBytesRequiredBeforeAdapter, true);
  assert.equal(boundary.artifactBytesBoundary.artifactBytesRequiredBeforeExecution, true);
  assert.equal(boundary.artifactBytesBoundary.artifactDigestRequired, true);
  assert.equal(boundary.artifactBytesBoundary.artifactScopeBindingRequired, true);
  assert.equal(boundary.artifactBytesBoundary.auditRecordRequiredBeforeBytes, true);
  assert.equal(boundary.artifactBytesBoundary.auditScopeBindingRequired, true);
  assert.equal(boundary.artifactBytesBoundary.writeTokenRequiredBeforeBytes, true);
  assert.equal(boundary.artifactBytesBoundary.executionLeaseRequiredBeforeBytes, true);
  assert.equal(boundary.artifactBytesBoundary.rollbackPlanRequiredBeforeBytes, true);
  assert.equal(boundary.artifactBytesBoundary.adapterInjectionRequiredAfterBytes, true);
  assert.equal(boundary.readiness.status, 'artifact-bytes-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-adapter-injection-boundary');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assertNoPrivateValues(boundary);
});
