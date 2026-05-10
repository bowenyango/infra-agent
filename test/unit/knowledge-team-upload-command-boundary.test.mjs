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
  buildKnowledgeTeamUploadCommandBoundary
} from '../../src/knowledge/team-upload-command-boundary.ts';
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

async function validLiveCheckBoundary() {
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
  const credentialPresenceBoundary = buildKnowledgeTeamUploadCredentialPresenceBoundary({ credentialReadBoundary });
  return buildKnowledgeTeamUploadLiveCheckBoundary({ credentialPresenceBoundary });
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
    'live-check-result',
    'signed-upload-command'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

function assertExecutionAndCommandDisabled(boundary) {
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
  assert.equal(boundary.uploadCommandBoundary.credentialValuesRead, false);
  assert.equal(boundary.uploadCommandBoundary.credentialValuesExposed, false);
  assert.equal(boundary.uploadCommandBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.uploadCommandBoundary.credentialPresenceResultExposed, false);
  assert.equal(boundary.uploadCommandBoundary.clientCreated, false);
  assert.equal(boundary.uploadCommandBoundary.sdkClientCreated, false);
  assert.equal(boundary.uploadCommandBoundary.adapterInjected, false);
  assert.equal(boundary.uploadCommandBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.uploadCommandBoundary.metadataIndexBound, false);
  assert.equal(boundary.uploadCommandBoundary.liveCheckAllowed, false);
  assert.equal(boundary.uploadCommandBoundary.liveCheckPerformed, false);
  assert.equal(boundary.uploadCommandBoundary.liveCheckResultExposed, false);
  assert.equal(boundary.uploadCommandBoundary.uploadCommandGenerated, false);
  assert.equal(boundary.uploadCommandBoundary.uploadCommandMaterialized, false);
  assert.equal(boundary.uploadCommandBoundary.uploadCommandExposed, false);
  assert.equal(boundary.uploadCommandBoundary.uploadExecutionAllowed, false);
  assert.equal(boundary.uploadCommandBoundary.objectWriteAttempted, false);
  assert.equal(boundary.uploadCommandBoundary.metadataIndexWriteAttempted, false);
  assert.equal(boundary.uploadCommandBoundary.remoteMutationPerformed, false);
  assert.equal(boundary.uploadCommandBoundary.executable, false);
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

test('upload command boundary records command requirements without generating commands', async () => {
  const liveCheckBoundary = await validLiveCheckBoundary();
  const boundary = buildKnowledgeTeamUploadCommandBoundary({ liveCheckBoundary });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-command-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'upload-command-boundary-dry-run');
  assert.equal(boundary.status, 'upload-command-boundary-ready', JSON.stringify(boundary.readiness.blockers));
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionAndCommandDisabled(boundary);
  assert.equal(boundary.target.manifestId, liveCheckBoundary.target.manifestId);
  assert.equal(boundary.target.objectKeyRedacted, true);
  assert.equal(Object.hasOwn(boundary.target, 'objectKey'), false);
  assert.equal(JSON.stringify(boundary).includes(liveCheckBoundary.target.objectKey), false);
  assert.equal(boundary.target.objectSha256, liveCheckBoundary.target.objectSha256);
  assert.equal(boundary.target.artifactId, liveCheckBoundary.target.artifactId);
  assert.equal(boundary.sourceLiveCheckBoundary.source, 'upload-live-check-boundary');
  assert.equal(boundary.sourceLiveCheckBoundary.boundaryStatus, 'live-check-boundary-ready');
  assert.equal(boundary.sourceLiveCheckBoundary.boundaryKind, 'live-check-boundary-dry-run');
  assert.equal(boundary.sourceLiveCheckBoundary.boundaryNextAction, 'design-upload-command-boundary');
  assert.equal(boundary.sourceLiveCheckBoundary.reviewStatus, 'review-ready');
  assert.equal(boundary.sourceLiveCheckBoundary.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourceLiveCheckBoundary.scopeMatched, true);
  assert.equal(boundary.sourceLiveCheckBoundary.humanReviewRecorded, true);
  assert.equal(boundary.sourceLiveCheckBoundary.fingerprintVerified, true);
  assert.equal(boundary.sourceLiveCheckBoundary.sourceFingerprintVerified, true);
  assert.equal(boundary.sourceLiveCheckBoundary.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourceLiveCheckBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceLiveCheckBoundary.liveCheckPolicyRequired, true);
  assert.equal(boundary.sourceLiveCheckBoundary.liveCheckReadOnlyRequired, true);
  assert.equal(boundary.sourceLiveCheckBoundary.liveCheckResultRedactionRequired, true);
  assert.equal(boundary.sourceLiveCheckBoundary.liveCheckPerformed, false);
  assert.equal(boundary.sourceLiveCheckBoundary.liveCheckResultExposed, false);
  assert.equal(boundary.sourceLiveCheckBoundary.uploadCommandGenerated, false);
  assert.equal(boundary.uploadCommandBoundary.dryRunOnly, true);
  assert.equal(boundary.uploadCommandBoundary.uploadCommandRequiredBeforeExecution, true);
  assert.equal(boundary.uploadCommandBoundary.uploadCommandRequiredAfterLiveCheckBoundary, true);
  assert.equal(boundary.uploadCommandBoundary.uploadCommandDescriptorRequired, true);
  assert.equal(boundary.uploadCommandBoundary.uploadCommandPayloadRedactionRequired, true);
  assert.equal(boundary.uploadCommandBoundary.uploadCommandMaterialRedactionRequired, true);
  assert.equal(boundary.uploadCommandBoundary.commandExecutionApprovalRequired, true);
  assert.equal(boundary.uploadCommandBoundary.artifactObjectStoreDependencyRequired, true);
  assert.equal(boundary.uploadCommandBoundary.metadataIndexDependencyRequired, true);
  assert.equal(boundary.uploadCommandBoundary.explicitUploadApprovalRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.liveCheckRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.uploadCommandRequired, true);
  assert.equal(boundary.readiness.status, 'upload-command-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-object-index-binding-boundary');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assertNoPrivateValues(boundary);
});
