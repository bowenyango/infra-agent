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
  buildKnowledgeTeamUploadObjectIndexBindingBoundary
} from '../../src/knowledge/team-upload-object-index-binding-boundary.ts';
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

async function validCommandBoundary() {
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
  const liveCheckBoundary = buildKnowledgeTeamUploadLiveCheckBoundary({ credentialPresenceBoundary });
  return buildKnowledgeTeamUploadCommandBoundary({ liveCheckBoundary });
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
    'private-live-check-output',
    'signed-upload-command'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

function assertExecutionAndBindingDisabled(boundary) {
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
  assert.equal(boundary.objectIndexBindingBoundary.credentialValuesRead, false);
  assert.equal(boundary.objectIndexBindingBoundary.credentialValuesExposed, false);
  assert.equal(boundary.objectIndexBindingBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.objectIndexBindingBoundary.credentialPresenceResultExposed, false);
  assert.equal(boundary.objectIndexBindingBoundary.clientCreated, false);
  assert.equal(boundary.objectIndexBindingBoundary.sdkClientCreated, false);
  assert.equal(boundary.objectIndexBindingBoundary.adapterInjected, false);
  assert.equal(boundary.objectIndexBindingBoundary.artifactBytesProvided, false);
  assert.equal(boundary.objectIndexBindingBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.objectIndexBindingBoundary.metadataIndexBound, false);
  assert.equal(boundary.objectIndexBindingBoundary.objectStoreHandleExposed, false);
  assert.equal(boundary.objectIndexBindingBoundary.metadataIndexHandleExposed, false);
  assert.equal(boundary.objectIndexBindingBoundary.liveCheckAllowed, false);
  assert.equal(boundary.objectIndexBindingBoundary.liveCheckPerformed, false);
  assert.equal(boundary.objectIndexBindingBoundary.liveCheckResultExposed, false);
  assert.equal(boundary.objectIndexBindingBoundary.uploadCommandGenerated, false);
  assert.equal(boundary.objectIndexBindingBoundary.uploadCommandMaterialized, false);
  assert.equal(boundary.objectIndexBindingBoundary.uploadCommandExposed, false);
  assert.equal(boundary.objectIndexBindingBoundary.uploadExecutionAllowed, false);
  assert.equal(boundary.objectIndexBindingBoundary.objectWriteAllowed, false);
  assert.equal(boundary.objectIndexBindingBoundary.metadataIndexWriteAllowed, false);
  assert.equal(boundary.objectIndexBindingBoundary.objectWriteAttempted, false);
  assert.equal(boundary.objectIndexBindingBoundary.metadataIndexWriteAttempted, false);
  assert.equal(boundary.objectIndexBindingBoundary.remoteMutationPerformed, false);
  assert.equal(boundary.objectIndexBindingBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.artifactBytesProvided, false);
  assert.equal(boundary.remainingExecutionBoundaries.adapterInjected, false);
  assert.equal(boundary.remainingExecutionBoundaries.clientCreated, false);
  assert.equal(boundary.remainingExecutionBoundaries.credentialValuesExposed, false);
  assert.equal(boundary.remainingExecutionBoundaries.credentialPresenceChecked, false);
  assert.equal(boundary.remainingExecutionBoundaries.liveCheckPerformed, false);
  assert.equal(boundary.remainingExecutionBoundaries.uploadCommandGenerated, false);
  assert.equal(boundary.remainingExecutionBoundaries.artifactObjectStoreBound, false);
  assert.equal(boundary.remainingExecutionBoundaries.metadataIndexBound, false);
  assert.equal(boundary.remainingExecutionBoundaries.objectWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.metadataIndexWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.remoteMutationAllowed, false);
}

test('object/index binding boundary records binding requirements without binding stores or indexes', async () => {
  const commandBoundary = await validCommandBoundary();
  const boundary = buildKnowledgeTeamUploadObjectIndexBindingBoundary({ commandBoundary });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-object-index-binding-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'object-index-binding-boundary-dry-run');
  assert.equal(boundary.status, 'object-index-binding-boundary-ready', JSON.stringify(boundary.readiness.blockers));
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionAndBindingDisabled(boundary);
  assert.equal(boundary.target.manifestId, commandBoundary.target.manifestId);
  assert.equal(boundary.target.objectKeyRedacted, true);
  assert.equal(Object.hasOwn(boundary.target, 'objectKey'), false);
  assert.equal(boundary.target.objectSha256, commandBoundary.target.objectSha256);
  assert.equal(boundary.target.artifactId, commandBoundary.target.artifactId);
  assert.equal(boundary.sourceUploadCommandBoundary.source, 'upload-command-boundary');
  assert.equal(boundary.sourceUploadCommandBoundary.boundaryStatus, 'upload-command-boundary-ready');
  assert.equal(boundary.sourceUploadCommandBoundary.boundaryKind, 'upload-command-boundary-dry-run');
  assert.equal(boundary.sourceUploadCommandBoundary.boundaryNextAction, 'design-object-index-binding-boundary');
  assert.equal(boundary.sourceUploadCommandBoundary.reviewStatus, 'review-ready');
  assert.equal(boundary.sourceUploadCommandBoundary.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourceUploadCommandBoundary.scopeMatched, true);
  assert.equal(boundary.sourceUploadCommandBoundary.humanReviewRecorded, true);
  assert.equal(boundary.sourceUploadCommandBoundary.fingerprintVerified, true);
  assert.equal(boundary.sourceUploadCommandBoundary.sourceFingerprintVerified, true);
  assert.equal(boundary.sourceUploadCommandBoundary.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourceUploadCommandBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceUploadCommandBoundary.uploadCommandDescriptorRequired, true);
  assert.equal(boundary.sourceUploadCommandBoundary.uploadCommandGenerated, false);
  assert.equal(boundary.sourceUploadCommandBoundary.uploadCommandMaterialized, false);
  assert.equal(boundary.sourceUploadCommandBoundary.uploadCommandExposed, false);
  assert.equal(boundary.sourceUploadCommandBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.sourceUploadCommandBoundary.metadataIndexBound, false);
  assert.equal(boundary.objectIndexBindingBoundary.dryRunOnly, true);
  assert.equal(boundary.objectIndexBindingBoundary.bindingRequiredAfterUploadCommandBoundary, true);
  assert.equal(boundary.objectIndexBindingBoundary.objectStoreBindingRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.metadataIndexBindingRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.objectStoreDescriptorRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.metadataIndexDescriptorRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.objectKeyRedactionRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.metadataIndexEntryRedactionRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.contentAddressedObjectKeysRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.contentAddressedIndexKeysRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.idempotentObjectWriteRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.idempotentMetadataIndexWriteRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.objectWriteRequiresExecutionBoundary, true);
  assert.equal(boundary.objectIndexBindingBoundary.metadataIndexWriteRequiresExecutionBoundary, true);
  assert.equal(boundary.remainingExecutionBoundaries.objectIndexBindingRequired, true);
  assert.equal(boundary.readiness.status, 'object-index-binding-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-upload-execution-readiness-boundary');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assertNoPrivateValues(boundary);
});
