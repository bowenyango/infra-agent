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

async function validAdapterInjectionBoundary() {
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
  return buildKnowledgeTeamUploadAdapterInjectionBoundary({ artifactBytesBoundary });
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
  assert.equal(boundary.clientCreationBoundary.clientCreated, false);
  assert.equal(boundary.clientCreationBoundary.sdkClientCreated, false);
  assert.equal(boundary.clientCreationBoundary.adapterInjected, false);
  assert.equal(boundary.clientCreationBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.clientCreationBoundary.metadataIndexBound, false);
  assert.equal(boundary.clientCreationBoundary.credentialValuesExposed, false);
  assert.equal(boundary.clientCreationBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.clientCreationBoundary.liveCheckPerformed, false);
  assert.equal(boundary.clientCreationBoundary.uploadExecutionAllowed, false);
  assert.equal(boundary.clientCreationBoundary.uploadCommandGenerated, false);
  assert.equal(boundary.clientCreationBoundary.objectWriteAttempted, false);
  assert.equal(boundary.clientCreationBoundary.metadataIndexWriteAttempted, false);
  assert.equal(boundary.clientCreationBoundary.remoteMutationPerformed, false);
  assert.equal(boundary.clientCreationBoundary.executable, false);
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

test('upload client creation boundary records client requirements without creating clients', async () => {
  const adapterInjectionBoundary = await validAdapterInjectionBoundary();
  const boundary = buildKnowledgeTeamUploadClientCreationBoundary({ adapterInjectionBoundary });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-client-creation-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'client-creation-boundary-dry-run');
  assert.equal(boundary.status, 'client-creation-boundary-ready');
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.target.manifestId, adapterInjectionBoundary.target.manifestId);
  assert.equal(boundary.target.objectKey, adapterInjectionBoundary.target.objectKey);
  assert.equal(boundary.target.objectSha256, adapterInjectionBoundary.target.objectSha256);
  assert.equal(boundary.target.artifactId, adapterInjectionBoundary.target.artifactId);
  assert.equal(boundary.sourceAdapterInjectionBoundary.source, 'upload-adapter-injection-boundary');
  assert.equal(boundary.sourceAdapterInjectionBoundary.boundaryStatus, 'adapter-injection-boundary-ready');
  assert.equal(boundary.sourceAdapterInjectionBoundary.boundaryKind, 'adapter-injection-boundary-dry-run');
  assert.equal(boundary.sourceAdapterInjectionBoundary.boundaryNextAction, 'design-client-creation-boundary');
  assert.equal(boundary.sourceAdapterInjectionBoundary.reviewStatus, 'review-ready');
  assert.equal(boundary.sourceAdapterInjectionBoundary.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourceAdapterInjectionBoundary.scopeMatched, true);
  assert.equal(boundary.sourceAdapterInjectionBoundary.humanReviewRecorded, true);
  assert.equal(boundary.sourceAdapterInjectionBoundary.fingerprintVerified, true);
  assert.equal(boundary.sourceAdapterInjectionBoundary.sourceFingerprintVerified, true);
  assert.equal(boundary.sourceAdapterInjectionBoundary.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourceAdapterInjectionBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceAdapterInjectionBoundary.adapterDependencyInjectionOnly, true);
  assert.equal(boundary.sourceAdapterInjectionBoundary.mockAdapterRequired, true);
  assert.equal(boundary.sourceAdapterInjectionBoundary.adapterDescriptorRequired, true);
  assert.equal(boundary.sourceAdapterInjectionBoundary.artifactObjectStoreDependencyRequired, true);
  assert.equal(boundary.sourceAdapterInjectionBoundary.metadataIndexDependencyRequired, true);
  assert.equal(boundary.sourceAdapterInjectionBoundary.adapterInjected, false);
  assert.equal(boundary.sourceAdapterInjectionBoundary.clientCreated, false);
  assert.equal(boundary.sourceAdapterInjectionBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.sourceAdapterInjectionBoundary.metadataIndexBound, false);
  assert.equal(boundary.sourceAdapterInjectionBoundary.executable, false);
  assert.equal(boundary.clientCreationBoundary.dryRunOnly, true);
  assert.equal(boundary.clientCreationBoundary.clientCreationRequiredBeforeExecution, true);
  assert.equal(boundary.clientCreationBoundary.clientCreationRequiredAfterAdapter, true);
  assert.equal(boundary.clientCreationBoundary.adapterInjectionRequiredBeforeClient, true);
  assert.equal(boundary.clientCreationBoundary.clientFactoryDescriptorRequired, true);
  assert.equal(boundary.clientCreationBoundary.credentialReadBoundaryRequired, true);
  assert.equal(boundary.clientCreationBoundary.credentialPresenceBoundaryRequired, true);
  assert.equal(boundary.clientCreationBoundary.liveCheckBoundaryRequired, true);
  assert.equal(boundary.clientCreationBoundary.uploadCommandBoundaryRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.clientCreationRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.credentialReadRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.credentialPresenceCheckRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.liveCheckRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.uploadCommandRequired, true);
  assert.equal(boundary.readiness.status, 'client-creation-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-credential-read-boundary');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assertNoPrivateValues(boundary);
});
