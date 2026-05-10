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

async function validArtifactBytesBoundary() {
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
  return buildKnowledgeTeamUploadArtifactBytesBoundary({ auditRecordBoundary });
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
    'adapter-secret-value',
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
  assert.equal(boundary.adapterInjectionBoundary.adapterInjected, false);
  assert.equal(boundary.adapterInjectionBoundary.clientCreated, false);
  assert.equal(boundary.adapterInjectionBoundary.artifactBytesProvided, false);
  assert.equal(boundary.adapterInjectionBoundary.artifactDigestVerified, false);
  assert.equal(boundary.adapterInjectionBoundary.artifactScopeBoundToArtifact, false);
  assert.equal(boundary.adapterInjectionBoundary.writeTokenIssued, false);
  assert.equal(boundary.adapterInjectionBoundary.executionLeaseCreated, false);
  assert.equal(boundary.adapterInjectionBoundary.rollbackPlanCreated, false);
  assert.equal(boundary.adapterInjectionBoundary.auditRecordCreated, false);
  assert.equal(boundary.adapterInjectionBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.adapterInjectionBoundary.metadataIndexBound, false);
  assert.equal(boundary.adapterInjectionBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.artifactBytesProvided, false);
  assert.equal(boundary.remainingExecutionBoundaries.adapterInjected, false);
  assert.equal(boundary.remainingExecutionBoundaries.clientCreated, false);
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

test('upload adapter injection boundary records dependency requirements without injecting adapters', async () => {
  const artifactBytesBoundary = await validArtifactBytesBoundary();
  const boundary = buildKnowledgeTeamUploadAdapterInjectionBoundary({ artifactBytesBoundary });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-adapter-injection-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'adapter-injection-boundary-dry-run');
  assert.equal(boundary.status, 'adapter-injection-boundary-ready');
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.target.manifestId, artifactBytesBoundary.target.manifestId);
  assert.equal(boundary.target.objectKey, artifactBytesBoundary.target.objectKey);
  assert.equal(boundary.target.objectSha256, artifactBytesBoundary.target.objectSha256);
  assert.equal(boundary.target.artifactId, artifactBytesBoundary.target.artifactId);
  assert.equal(boundary.sourceArtifactBytesBoundary.source, 'upload-artifact-bytes-boundary');
  assert.equal(boundary.sourceArtifactBytesBoundary.boundaryStatus, 'artifact-bytes-boundary-ready');
  assert.equal(boundary.sourceArtifactBytesBoundary.boundaryKind, 'artifact-bytes-boundary-dry-run');
  assert.equal(boundary.sourceArtifactBytesBoundary.boundaryNextAction, 'design-adapter-injection-boundary');
  assert.equal(boundary.sourceArtifactBytesBoundary.reviewStatus, 'review-ready');
  assert.equal(boundary.sourceArtifactBytesBoundary.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourceArtifactBytesBoundary.scopeMatched, true);
  assert.equal(boundary.sourceArtifactBytesBoundary.humanReviewRecorded, true);
  assert.equal(boundary.sourceArtifactBytesBoundary.fingerprintVerified, true);
  assert.equal(boundary.sourceArtifactBytesBoundary.sourceFingerprintVerified, true);
  assert.equal(boundary.sourceArtifactBytesBoundary.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourceArtifactBytesBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceArtifactBytesBoundary.artifactBytesRequiredBeforeAdapter, true);
  assert.equal(boundary.sourceArtifactBytesBoundary.artifactBytesRequiredBeforeExecution, true);
  assert.equal(boundary.sourceArtifactBytesBoundary.artifactDigestRequired, true);
  assert.equal(boundary.sourceArtifactBytesBoundary.artifactScopeBindingRequired, true);
  assert.equal(boundary.sourceArtifactBytesBoundary.adapterInjectionRequiredAfterBytes, true);
  assert.equal(boundary.adapterInjectionBoundary.dryRunOnly, true);
  assert.equal(boundary.adapterInjectionBoundary.adapterInjectionRequiredBeforeExecution, true);
  assert.equal(boundary.adapterInjectionBoundary.adapterInjectionRequiredAfterBytes, true);
  assert.equal(boundary.adapterInjectionBoundary.adapterDependencyInjectionOnly, true);
  assert.equal(boundary.adapterInjectionBoundary.mockAdapterRequired, true);
  assert.equal(boundary.adapterInjectionBoundary.adapterDescriptorRequired, true);
  assert.equal(boundary.adapterInjectionBoundary.artifactObjectStoreDependencyRequired, true);
  assert.equal(boundary.adapterInjectionBoundary.metadataIndexDependencyRequired, true);
  assert.equal(boundary.adapterInjectionBoundary.contentAddressedObjectKeysRequired, true);
  assert.equal(boundary.adapterInjectionBoundary.contentAddressedIndexKeysRequired, true);
  assert.equal(boundary.adapterInjectionBoundary.idempotentWritesRequired, true);
  assert.equal(boundary.adapterInjectionBoundary.explicitUploadApprovalRequired, true);
  assert.equal(boundary.adapterInjectionBoundary.writeTokenRequiredBeforeAdapter, true);
  assert.equal(boundary.adapterInjectionBoundary.executionLeaseRequiredBeforeAdapter, true);
  assert.equal(boundary.adapterInjectionBoundary.rollbackPlanRequiredBeforeAdapter, true);
  assert.equal(boundary.adapterInjectionBoundary.auditRecordRequiredBeforeAdapter, true);
  assert.equal(boundary.remainingExecutionBoundaries.clientCreationRequired, true);
  assert.equal(boundary.readiness.status, 'adapter-injection-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-client-creation-boundary');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assertNoPrivateValues(boundary);
});
