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

async function validClientCreationBoundary() {
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
  return buildKnowledgeTeamUploadClientCreationBoundary({ adapterInjectionBoundary });
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

function assertExecutionAndCredentialReadsDisabled(boundary) {
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
  assert.equal(boundary.credentialReadBoundary.credentialValuesRead, false);
  assert.equal(boundary.credentialReadBoundary.credentialValuesExposed, false);
  assert.equal(boundary.credentialReadBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.credentialReadBoundary.clientCreated, false);
  assert.equal(boundary.credentialReadBoundary.sdkClientCreated, false);
  assert.equal(boundary.credentialReadBoundary.adapterInjected, false);
  assert.equal(boundary.credentialReadBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.credentialReadBoundary.metadataIndexBound, false);
  assert.equal(boundary.credentialReadBoundary.liveCheckPerformed, false);
  assert.equal(boundary.credentialReadBoundary.uploadExecutionAllowed, false);
  assert.equal(boundary.credentialReadBoundary.uploadCommandGenerated, false);
  assert.equal(boundary.credentialReadBoundary.objectWriteAttempted, false);
  assert.equal(boundary.credentialReadBoundary.metadataIndexWriteAttempted, false);
  assert.equal(boundary.credentialReadBoundary.remoteMutationPerformed, false);
  assert.equal(boundary.credentialReadBoundary.executable, false);
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

test('upload credential read boundary records credential requirements without reading values', async () => {
  const clientCreationBoundary = await validClientCreationBoundary();
  const boundary = buildKnowledgeTeamUploadCredentialReadBoundary({ clientCreationBoundary });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-credential-read-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'credential-read-boundary-dry-run');
  assert.equal(boundary.status, 'credential-read-boundary-ready');
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionAndCredentialReadsDisabled(boundary);
  assert.equal(boundary.target.manifestId, clientCreationBoundary.target.manifestId);
  assert.equal(boundary.target.objectKey, clientCreationBoundary.target.objectKey);
  assert.equal(boundary.target.objectSha256, clientCreationBoundary.target.objectSha256);
  assert.equal(boundary.target.artifactId, clientCreationBoundary.target.artifactId);
  assert.equal(boundary.sourceClientCreationBoundary.source, 'upload-client-creation-boundary');
  assert.equal(boundary.sourceClientCreationBoundary.boundaryStatus, 'client-creation-boundary-ready');
  assert.equal(boundary.sourceClientCreationBoundary.boundaryKind, 'client-creation-boundary-dry-run');
  assert.equal(boundary.sourceClientCreationBoundary.boundaryNextAction, 'design-credential-read-boundary');
  assert.equal(boundary.sourceClientCreationBoundary.reviewStatus, 'review-ready');
  assert.equal(boundary.sourceClientCreationBoundary.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourceClientCreationBoundary.scopeMatched, true);
  assert.equal(boundary.sourceClientCreationBoundary.humanReviewRecorded, true);
  assert.equal(boundary.sourceClientCreationBoundary.fingerprintVerified, true);
  assert.equal(boundary.sourceClientCreationBoundary.sourceFingerprintVerified, true);
  assert.equal(boundary.sourceClientCreationBoundary.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourceClientCreationBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceClientCreationBoundary.clientFactoryDescriptorRequired, true);
  assert.equal(boundary.sourceClientCreationBoundary.credentialReadBoundaryRequired, true);
  assert.equal(boundary.sourceClientCreationBoundary.credentialPresenceBoundaryRequired, true);
  assert.equal(boundary.sourceClientCreationBoundary.clientCreated, false);
  assert.equal(boundary.sourceClientCreationBoundary.sdkClientCreated, false);
  assert.equal(boundary.sourceClientCreationBoundary.credentialValuesExposed, false);
  assert.equal(boundary.sourceClientCreationBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.credentialReadBoundary.dryRunOnly, true);
  assert.equal(boundary.credentialReadBoundary.credentialReadRequiredBeforeExecution, true);
  assert.equal(boundary.credentialReadBoundary.credentialReadRequiredAfterClientBoundary, true);
  assert.equal(boundary.credentialReadBoundary.clientCreationBoundaryRequired, true);
  assert.equal(boundary.credentialReadBoundary.credentialSourceDescriptorRequired, true);
  assert.equal(boundary.credentialReadBoundary.credentialReferenceOnlyRequired, true);
  assert.equal(boundary.credentialReadBoundary.credentialValueRedactionRequired, true);
  assert.equal(boundary.credentialReadBoundary.credentialPresenceBoundaryRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.clientCreationRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.credentialReadRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.credentialPresenceCheckRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.liveCheckRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.uploadCommandRequired, true);
  assert.equal(boundary.readiness.status, 'credential-read-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-credential-presence-boundary');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assertNoPrivateValues(boundary);
});

export {
  assertExecutionAndCredentialReadsDisabled,
  assertNoPrivateValues,
  blockerCodes,
  validClientCreationBoundary
};
