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
  buildKnowledgeTeamUploadExecutionApprovalRecord
} from '../../src/knowledge/team-upload-execution-approval-record.ts';
import {
  buildKnowledgeTeamUploadExecutionApprovalRequest
} from '../../src/knowledge/team-upload-execution-approval-request.ts';
import {
  buildKnowledgeTeamUploadExecutionAuthorizationBoundary
} from '../../src/knowledge/team-upload-execution-authorization-boundary.ts';
import {
  buildKnowledgeTeamUploadExecutionGate
} from '../../src/knowledge/team-upload-execution-gate.ts';
import {
  buildKnowledgeTeamUploadExecutionLeaseBoundary
} from '../../src/knowledge/team-upload-execution-lease-boundary.ts';
import {
  buildKnowledgeTeamUploadExecutionPlanRulesReview
} from '../../src/knowledge/team-upload-execution-plan-rules-review.ts';
import {
  buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord
} from '../../src/knowledge/team-upload-execution-plan-rules-update-record.ts';
import {
  buildKnowledgeTeamUploadExecutionPrerequisitePlan
} from '../../src/knowledge/team-upload-execution-prerequisite-plan.ts';
import {
  buildKnowledgeTeamUploadExecutionReadinessBoundary
} from '../../src/knowledge/team-upload-execution-readiness-boundary.ts';
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

async function validPlanRulesReview() {
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
  const commandBoundary = buildKnowledgeTeamUploadCommandBoundary({ liveCheckBoundary });
  const objectIndexBindingBoundary = buildKnowledgeTeamUploadObjectIndexBindingBoundary({ commandBoundary });
  const executionReadinessBoundary = buildKnowledgeTeamUploadExecutionReadinessBoundary({ objectIndexBindingBoundary });
  const executionApprovalRequest = buildKnowledgeTeamUploadExecutionApprovalRequest({ executionReadinessBoundary });
  const executionApprovalRecord = buildKnowledgeTeamUploadExecutionApprovalRecord({
    executionApprovalRequest,
    approvalFingerprint: executionApprovalRequest.approvalRequest.fingerprint.value
  });
  const executionAuthorizationBoundary = buildKnowledgeTeamUploadExecutionAuthorizationBoundary({
    executionApprovalRecord
  });
  return buildKnowledgeTeamUploadExecutionPlanRulesReview({ executionAuthorizationBoundary });
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
    'signed-upload-command',
    'authorization-secret-value',
    'team-artifacts/public-reference/aa/bb/private-key.json'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

function assertExecutionDisabled(record) {
  assert.equal(record.mutationAllowed, false);
  assert.equal(record.executionMode, 'dry-run');
  assert.equal(record.remoteWriteAllowed, false);
  assert.equal(record.liveCheckAllowed, false);
  assert.equal(record.credentialValuesExposed, false);
  assert.equal(record.credentialPresenceChecked, false);
  assert.equal(record.uploadApproved, false);
  assert.equal(record.uploadExecutionApproved, false);
  assert.equal(record.uploadExecutionAllowed, false);
  assert.equal(record.mutationApprovalGranted, false);
  assert.equal(record.clientCreated, false);
  assert.equal(record.adapterInjected, false);
  assert.equal(record.artifactBytesProvided, false);
  assert.equal(record.writeTokenIssued, false);
  assert.equal(record.executionLeaseCreated, false);
  assert.equal(record.rollbackPlanCreated, false);
  assert.equal(record.auditRecordCreated, false);
  assert.equal(record.objectWriteAttempted, false);
  assert.equal(record.metadataIndexWriteAttempted, false);
  assert.equal(record.remoteMutationPerformed, false);
  assert.equal(record.uploadCommand, null);
  assert.equal(record.sourcePlanRulesReview.authorizationGranted, false);
  assert.equal(record.sourcePlanRulesReview.executionAuthorizationGranted, false);
  assert.equal(record.sourcePlanRulesReview.approvalGranted, false);
  assert.equal(record.sourcePlanRulesReview.uploadApproved, false);
  assert.equal(record.sourcePlanRulesReview.uploadExecutionApproved, false);
  assert.equal(record.sourcePlanRulesReview.uploadExecutionAllowed, false);
  assert.equal(record.sourcePlanRulesReview.mutationApprovalGranted, false);
  assert.equal(record.planRulesUpdateRecord.policyUpdateAuthorized, false);
  assert.equal(record.planRulesUpdateRecord.executionStillDisabled, true);
  assert.equal(record.planRulesUpdateRecord.authorizationGranted, false);
  assert.equal(record.planRulesUpdateRecord.executionAuthorizationGranted, false);
  assert.equal(record.planRulesUpdateRecord.uploadApproved, false);
  assert.equal(record.planRulesUpdateRecord.uploadExecutionApproved, false);
  assert.equal(record.planRulesUpdateRecord.uploadExecutionAllowed, false);
  assert.equal(record.planRulesUpdateRecord.mutationApprovalGranted, false);
  assert.equal(record.executionBoundary.executable, false);
  assert.equal(record.executionBoundary.artifactBytesProvided, false);
  assert.equal(record.executionBoundary.adapterInjected, false);
  assert.equal(record.executionBoundary.clientCreated, false);
  assert.equal(record.executionBoundary.credentialValuesRead, false);
  assert.equal(record.executionBoundary.credentialValuesExposed, false);
  assert.equal(record.executionBoundary.credentialPresenceChecked, false);
  assert.equal(record.executionBoundary.credentialPresenceResultExposed, false);
  assert.equal(record.executionBoundary.liveCheckAllowed, false);
  assert.equal(record.executionBoundary.liveCheckPerformed, false);
  assert.equal(record.executionBoundary.liveCheckResultExposed, false);
  assert.equal(record.executionBoundary.uploadCommandGenerated, false);
  assert.equal(record.executionBoundary.uploadCommandMaterialized, false);
  assert.equal(record.executionBoundary.uploadCommandExposed, false);
  assert.equal(record.executionBoundary.artifactObjectStoreBound, false);
  assert.equal(record.executionBoundary.metadataIndexBound, false);
  assert.equal(record.executionBoundary.objectStoreHandleExposed, false);
  assert.equal(record.executionBoundary.metadataIndexHandleExposed, false);
  assert.equal(record.executionBoundary.objectWriteAllowed, false);
  assert.equal(record.executionBoundary.metadataIndexWriteAllowed, false);
  assert.equal(record.executionBoundary.objectWriteAttempted, false);
  assert.equal(record.executionBoundary.metadataIndexWriteAttempted, false);
  assert.equal(record.executionBoundary.writeTokenIssued, false);
  assert.equal(record.executionBoundary.executionLeaseCreated, false);
  assert.equal(record.executionBoundary.rollbackPlanCreated, false);
  assert.equal(record.executionBoundary.auditRecordCreated, false);
  assert.equal(record.executionBoundary.remoteMutationPerformed, false);
}

test('upload execution Plan/Rules update record records matching review fingerprint without enabling execution', async () => {
  const planRulesReview = await validPlanRulesReview();
  const reviewFingerprint = planRulesReview.planRulesReview.reviewFingerprint.value;
  const record = buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord({
    planRulesReview,
    reviewFingerprint
  });

  assert.equal(record.kind, 'infra-agent.knowledge-team-upload-execution-plan-rules-update-record');
  assert.equal(record.schemaVersion, 1);
  assert.equal(record.recordKind, 'upload-execution-plan-rules-update-record-dry-run');
  assert.equal(record.status, 'upload-execution-plan-rules-update-record-ready', JSON.stringify(record.readiness.blockers));
  assert.equal(record.readiness.nextAction, 'design-upload-execution-implementation-boundary');
  assert.equal(record.readiness.blockerCount, 0);
  assert.deepEqual(record.readiness.blockerCodes, []);
  assert.equal(record.target.objectKeyRedacted, true);
  assert.equal(Object.hasOwn(record.target, 'objectKey'), false);
  assert.equal(record.target.manifestId, planRulesReview.target.manifestId);
  assert.equal(record.target.objectSha256, planRulesReview.target.objectSha256);
  assert.equal(record.target.artifactId, planRulesReview.target.artifactId);
  assert.equal(record.sourcePlanRulesReview.reviewStatus, 'upload-execution-plan-rules-review-ready');
  assert.equal(record.sourcePlanRulesReview.reviewKind, 'upload-execution-plan-rules-review-dry-run');
  assert.equal(record.sourcePlanRulesReview.reviewNextAction, 'await-explicit-plan-rules-update');
  assert.equal(record.sourcePlanRulesReview.sourceAuthorizationBoundaryStatus, 'upload-execution-authorization-boundary-ready');
  assert.equal(record.sourcePlanRulesReview.sourceAuthorizationBoundaryNextAction, 'await-plan-rules-update-for-upload-execution');
  assert.equal(record.sourcePlanRulesReview.planRulesUpdateReviewRequired, true);
  assert.equal(record.sourcePlanRulesReview.planRulesUpdated, false);
  assert.equal(record.sourcePlanRulesReview.rulesUpdateReviewed, false);
  assert.equal(record.sourcePlanRulesReview.executionStillDisabled, true);
  assert.equal(record.sourcePlanRulesReview.reviewFingerprint.value, reviewFingerprint);
  assert.equal(record.planRulesUpdateRecord.planRulesUpdateRecorded, true);
  assert.equal(record.planRulesUpdateRecord.rulesUpdateReviewed, true);
  assert.equal(record.planRulesUpdateRecord.source, 'cli-flag');
  assert.equal(record.planRulesUpdateRecord.suppliedFingerprint, reviewFingerprint);
  assert.equal(record.planRulesUpdateRecord.expectedFingerprint, reviewFingerprint);
  assert.equal(record.planRulesUpdateRecord.fingerprintVerified, true);
  assert.equal(record.planRulesUpdateRecord.sourceReviewFingerprint.value, reviewFingerprint);
  assert.equal(record.planRulesUpdateRecord.recordFingerprint.scope, 'stage-knowledge-pack-upload-execution-plan-rules-update-record-v1');
  assert.equal(record.planRulesUpdateRecord.recordFingerprint.canonicalFieldCount, 18);
  assert.match(record.planRulesUpdateRecord.recordFingerprint.value, /^[a-f0-9]{64}$/);
  assertExecutionDisabled(record);
  assertNoPrivateValues(record);
});

test('upload execution Plan/Rules update record blocks missing unsafe and mismatched fingerprints', async () => {
  const planRulesReview = await validPlanRulesReview();

  const missing = buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord({
    planRulesReview,
    reviewFingerprint: null
  });
  assert.equal(missing.status, 'blocked');
  assert.equal(missing.planRulesUpdateRecord.planRulesUpdateRecorded, false);
  assert.equal(missing.planRulesUpdateRecord.recordFingerprint.value, null);
  assert.ok(missing.readiness.blockerCodes.includes('review-fingerprint-missing'));

  const unsafe = buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord({
    planRulesReview,
    reviewFingerprint: 'ABC-not-a-safe-sha'
  });
  assert.equal(unsafe.status, 'blocked');
  assert.ok(unsafe.readiness.blockerCodes.includes('unsafe-review-fingerprint'));

  const mismatch = buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord({
    planRulesReview,
    reviewFingerprint: 'f'.repeat(64)
  });
  assert.equal(mismatch.status, 'blocked');
  assert.ok(mismatch.readiness.blockerCodes.includes('review-fingerprint-mismatch'));
  assertExecutionDisabled(mismatch);
});

test('upload execution Plan/Rules update record blocks non-ready review source', async () => {
  const planRulesReview = await validPlanRulesReview();
  const record = buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord({
    planRulesReview: {
      ...planRulesReview,
      status: 'blocked',
      readiness: {
        ...planRulesReview.readiness,
        status: 'blocked',
        nextAction: 'resolve-blockers',
        blockerCount: 1
      }
    },
    reviewFingerprint: planRulesReview.planRulesReview.reviewFingerprint.value
  });

  assert.equal(record.status, 'blocked');
  assert.equal(record.readiness.nextAction, 'resolve-blockers');
  assert.equal(record.planRulesUpdateRecord.planRulesUpdateRecorded, false);
  assert.equal(record.planRulesUpdateRecord.recordFingerprint.value, null);
  assert.ok(record.readiness.blockerCodes.includes('plan-rules-review-not-ready'));
  assert.ok(record.readiness.blockerCodes.includes('plan-rules-review-next-action-invalid'));
  assertExecutionDisabled(record);
});

test('upload execution Plan/Rules update record blocks forged execution and leaky material without copying private values', async () => {
  const planRulesReview = await validPlanRulesReview();
  const record = buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord({
    planRulesReview: {
      ...planRulesReview,
      uploadExecutionAllowed: true,
      uploadCommand: { value: 'signed-upload-command' },
      target: {
        ...planRulesReview.target,
        objectKey: 'team-artifacts/public-reference/aa/bb/private-key.json'
      },
      sourceAuthorizationBoundary: {
        ...planRulesReview.sourceAuthorizationBoundary,
        authorizationGranted: true,
        executionAuthorizationGranted: true,
        uploadExecutionAllowed: true
      },
      executionBoundary: {
        ...planRulesReview.executionBoundary,
        executable: true,
        uploadCommandGenerated: true,
        objectWriteAttempted: true,
        metadataIndexWriteAttempted: true
      },
      backendEndpointUrl: 'https://should-not-copy.example.test',
      bucket: 'should-not-copy-bucket',
      secretValue: 'should-not-copy-secret',
      artifactBytesPayload: 'raw-artifact-bytes',
      sdkClientConfig: 'client-secret-value',
      credentialValue: 'credential-secret-value',
      liveCheckResultValue: 'private-live-check-output',
      authorizationToken: 'authorization-secret-value',
      objectStoreHandle: { putObject: 's3://private-bucket' },
      metadataIndexHandle: { putEntry: 'aws s3 cp private-key' }
    },
    reviewFingerprint: planRulesReview.planRulesReview.reviewFingerprint.value
  });

  assert.equal(record.status, 'blocked');
  assert.ok(record.readiness.blockerCodes.includes('upload-execution-enabled'));
  assert.ok(record.readiness.blockerCodes.includes('authorization-already-granted'));
  assert.ok(record.readiness.blockerCodes.includes('upload-command-present'));
  assert.ok(record.readiness.blockerCodes.includes('upload-command-generated'));
  assert.ok(record.readiness.blockerCodes.includes('object-write-attempted'));
  assert.ok(record.readiness.blockerCodes.includes('metadata-index-write-attempted'));
  assert.ok(record.readiness.blockerCodes.includes('backend-detail-leak'));
  assert.ok(record.readiness.blockerCodes.includes('artifact-bytes-provided'));
  assert.ok(record.readiness.blockerCodes.includes('client-dependency-leak'));
  assert.ok(record.readiness.blockerCodes.includes('credential-dependency-leak'));
  assert.ok(record.readiness.blockerCodes.includes('live-check-enabled'));
  assert.ok(record.readiness.blockerCodes.includes('authorization-material-leak'));
  assert.ok(record.readiness.blockerCodes.includes('object-store-handle-leak'));
  assert.ok(record.readiness.blockerCodes.includes('metadata-index-handle-leak'));
  assertExecutionDisabled(record);
  assertNoPrivateValues(record);
});
