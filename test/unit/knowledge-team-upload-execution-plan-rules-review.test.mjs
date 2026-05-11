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

async function validExecutionAuthorizationBoundary() {
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
  return buildKnowledgeTeamUploadExecutionAuthorizationBoundary({ executionApprovalRecord });
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
    'authorization-secret-value'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

function assertExecutionDisabled(review) {
  assert.equal(review.mutationAllowed, false);
  assert.equal(review.executionMode, 'dry-run');
  assert.equal(review.remoteWriteAllowed, false);
  assert.equal(review.liveCheckAllowed, false);
  assert.equal(review.credentialValuesExposed, false);
  assert.equal(review.credentialPresenceChecked, false);
  assert.equal(review.uploadApproved, false);
  assert.equal(review.uploadExecutionApproved, false);
  assert.equal(review.uploadExecutionAllowed, false);
  assert.equal(review.mutationApprovalGranted, false);
  assert.equal(review.clientCreated, false);
  assert.equal(review.adapterInjected, false);
  assert.equal(review.artifactBytesProvided, false);
  assert.equal(review.writeTokenIssued, false);
  assert.equal(review.executionLeaseCreated, false);
  assert.equal(review.rollbackPlanCreated, false);
  assert.equal(review.auditRecordCreated, false);
  assert.equal(review.objectWriteAttempted, false);
  assert.equal(review.metadataIndexWriteAttempted, false);
  assert.equal(review.remoteMutationPerformed, false);
  assert.equal(review.uploadCommand, null);
  assert.equal(review.sourceAuthorizationBoundary.authorizationGranted, false);
  assert.equal(review.sourceAuthorizationBoundary.executionAuthorizationGranted, false);
  assert.equal(review.sourceAuthorizationBoundary.approvalGranted, false);
  assert.equal(review.sourceAuthorizationBoundary.uploadApproved, false);
  assert.equal(review.sourceAuthorizationBoundary.uploadExecutionApproved, false);
  assert.equal(review.sourceAuthorizationBoundary.uploadExecutionAllowed, false);
  assert.equal(review.sourceAuthorizationBoundary.mutationApprovalGranted, false);
  assert.equal(review.planRulesReview.planRulesUpdated, false);
  assert.equal(review.planRulesReview.rulesUpdateReviewed, false);
  assert.equal(review.planRulesReview.executionStillDisabled, true);
  assert.equal(review.planRulesReview.realUploadExecutionStillProhibited, true);
  assert.equal(review.planRulesReview.uploadCommandGenerationStillProhibited, true);
  assert.equal(review.planRulesReview.objectWriteStillProhibited, true);
  assert.equal(review.planRulesReview.metadataIndexWriteStillProhibited, true);
  assert.equal(review.executionBoundary.executable, false);
  assert.equal(review.executionBoundary.artifactBytesProvided, false);
  assert.equal(review.executionBoundary.adapterInjected, false);
  assert.equal(review.executionBoundary.clientCreated, false);
  assert.equal(review.executionBoundary.credentialValuesRead, false);
  assert.equal(review.executionBoundary.credentialValuesExposed, false);
  assert.equal(review.executionBoundary.credentialPresenceChecked, false);
  assert.equal(review.executionBoundary.credentialPresenceResultExposed, false);
  assert.equal(review.executionBoundary.liveCheckAllowed, false);
  assert.equal(review.executionBoundary.liveCheckPerformed, false);
  assert.equal(review.executionBoundary.liveCheckResultExposed, false);
  assert.equal(review.executionBoundary.uploadCommandGenerated, false);
  assert.equal(review.executionBoundary.uploadCommandMaterialized, false);
  assert.equal(review.executionBoundary.uploadCommandExposed, false);
  assert.equal(review.executionBoundary.artifactObjectStoreBound, false);
  assert.equal(review.executionBoundary.metadataIndexBound, false);
  assert.equal(review.executionBoundary.objectStoreHandleExposed, false);
  assert.equal(review.executionBoundary.metadataIndexHandleExposed, false);
  assert.equal(review.executionBoundary.objectWriteAllowed, false);
  assert.equal(review.executionBoundary.metadataIndexWriteAllowed, false);
  assert.equal(review.executionBoundary.objectWriteAttempted, false);
  assert.equal(review.executionBoundary.metadataIndexWriteAttempted, false);
  assert.equal(review.executionBoundary.writeTokenIssued, false);
  assert.equal(review.executionBoundary.executionLeaseCreated, false);
  assert.equal(review.executionBoundary.rollbackPlanCreated, false);
  assert.equal(review.executionBoundary.auditRecordCreated, false);
  assert.equal(review.executionBoundary.remoteMutationPerformed, false);
}

test('upload execution plan/rules review records ready source without enabling execution', async () => {
  const executionAuthorizationBoundary = await validExecutionAuthorizationBoundary();
  const review = buildKnowledgeTeamUploadExecutionPlanRulesReview({ executionAuthorizationBoundary });

  assert.equal(review.kind, 'infra-agent.knowledge-team-upload-execution-plan-rules-review');
  assert.equal(review.schemaVersion, 1);
  assert.equal(review.reviewKind, 'upload-execution-plan-rules-review-dry-run');
  assert.equal(review.status, 'upload-execution-plan-rules-review-ready');
  assert.equal(review.readiness.nextAction, 'await-explicit-plan-rules-update');
  assert.equal(review.readiness.blockerCount, 0);
  assert.deepEqual(review.readiness.blockerCodes, []);
  assert.equal(review.target.objectKeyRedacted, true);
  assert.equal(Object.hasOwn(review.target, 'objectKey'), false);
  assert.equal(review.target.manifestId, executionAuthorizationBoundary.target.manifestId);
  assert.equal(review.target.objectSha256, executionAuthorizationBoundary.target.objectSha256);
  assert.equal(review.target.artifactId, executionAuthorizationBoundary.target.artifactId);
  assert.equal(review.sourceAuthorizationBoundary.boundaryStatus, 'upload-execution-authorization-boundary-ready');
  assert.equal(review.sourceAuthorizationBoundary.boundaryKind, 'upload-execution-authorization-boundary-dry-run');
  assert.equal(review.sourceAuthorizationBoundary.boundaryNextAction, 'await-plan-rules-update-for-upload-execution');
  assert.equal(review.sourceAuthorizationBoundary.humanApprovalRecorded, true);
  assert.equal(review.sourceAuthorizationBoundary.approvalFingerprintVerified, true);
  assert.equal(review.sourceAuthorizationBoundary.authorizationBoundaryDesigned, true);
  assert.equal(review.sourceAuthorizationBoundary.authorizationBoundaryFingerprint.value, executionAuthorizationBoundary.authorizationBoundary.authorizationBoundaryFingerprint.value);
  assert.equal(review.sourceAuthorizationBoundary.sourceApprovalRecordFingerprint.value, executionAuthorizationBoundary.authorizationBoundary.sourceApprovalRecordFingerprint.value);
  assert.equal(review.planRulesReview.reviewFingerprint.algorithm, 'sha256');
  assert.equal(review.planRulesReview.reviewFingerprint.scope, 'stage-knowledge-pack-upload-execution-plan-rules-review-v1');
  assert.equal(review.planRulesReview.reviewFingerprint.canonicalFieldCount, 20);
  assert.match(review.planRulesReview.reviewFingerprint.value, /^[a-f0-9]{64}$/);
  assert.deepEqual(review.planRulesReview.requiredReviewDocuments, [
    'docs/HANDOFF.md',
    'docs/ROADMAP.md',
    'docs/AGENT_RULES.md',
    'docs/CLAUDE_CODE_AGENT_PATTERNS.md'
  ]);
  assertExecutionDisabled(review);
  assertNoPrivateValues(review);
});

test('upload execution plan/rules review blocks non-ready authorization boundary source', async () => {
  const executionAuthorizationBoundary = await validExecutionAuthorizationBoundary();
  const review = buildKnowledgeTeamUploadExecutionPlanRulesReview({
    executionAuthorizationBoundary: {
      ...executionAuthorizationBoundary,
      status: 'blocked',
      readiness: {
        ...executionAuthorizationBoundary.readiness,
        status: 'blocked',
        nextAction: 'resolve-blockers',
        blockerCount: 1
      }
    }
  });

  assert.equal(review.status, 'blocked');
  assert.equal(review.readiness.nextAction, 'resolve-blockers');
  assert.equal(review.planRulesReview.reviewFingerprint.value, null);
  assert.ok(review.readiness.blockerCodes.includes('authorization-boundary-not-ready'));
  assert.ok(review.readiness.blockerCodes.includes('authorization-boundary-next-action-invalid'));
  assertExecutionDisabled(review);
});

test('upload execution plan/rules review blocks forged grants and execution flags', async () => {
  const executionAuthorizationBoundary = await validExecutionAuthorizationBoundary();
  const review = buildKnowledgeTeamUploadExecutionPlanRulesReview({
    executionAuthorizationBoundary: {
      ...executionAuthorizationBoundary,
      uploadExecutionAllowed: true,
      authorizationBoundary: {
        ...executionAuthorizationBoundary.authorizationBoundary,
        authorizationGranted: true,
        executionAuthorizationGranted: true,
        uploadExecutionAllowed: true,
        objectWriteAllowed: true
      },
      executionBoundary: {
        ...executionAuthorizationBoundary.executionBoundary,
        executable: true,
        uploadCommandGenerated: true,
        objectWriteAttempted: true
      }
    }
  });

  assert.equal(review.status, 'blocked');
  assert.ok(review.readiness.blockerCodes.includes('upload-execution-enabled'));
  assert.ok(review.readiness.blockerCodes.includes('authorization-already-granted'));
  assert.ok(review.readiness.blockerCodes.includes('remote-write-enabled'));
  assert.ok(review.readiness.blockerCodes.includes('upload-command-generated'));
  assert.ok(review.readiness.blockerCodes.includes('object-write-attempted'));
  assertExecutionDisabled(review);
});

test('upload execution plan/rules review blocks leaky material without copying private values', async () => {
  const executionAuthorizationBoundary = await validExecutionAuthorizationBoundary();
  const review = buildKnowledgeTeamUploadExecutionPlanRulesReview({
    executionAuthorizationBoundary: {
      ...executionAuthorizationBoundary,
      target: {
        ...executionAuthorizationBoundary.target,
        objectKey: 'team-artifacts/public-reference/aa/bb/private-key.json'
      },
      backendEndpointUrl: 'https://should-not-copy.example.test',
      bucket: 'should-not-copy-bucket',
      secretValue: 'should-not-copy-secret',
      artifactBytesPayload: 'raw-artifact-bytes',
      sdkClientConfig: 'client-secret-value',
      credentialValue: 'credential-secret-value',
      liveCheckResult: 'private-live-check-output',
      uploadCommandPayload: 'aws s3 cp file s3://private-bucket/key',
      signedUploadCommand: 'signed-upload-command',
      authorizationMaterial: 'authorization-secret-value',
      objectStoreHandle: { putObject: true },
      metadataIndexHandle: { putEntry: true }
    }
  });

  assert.equal(review.status, 'blocked');
  assert.ok(review.readiness.blockerCodes.includes('unsafe-artifact-reference'));
  assert.ok(review.readiness.blockerCodes.includes('backend-detail-leak'));
  assert.ok(review.readiness.blockerCodes.includes('artifact-bytes-provided'));
  assert.ok(review.readiness.blockerCodes.includes('client-dependency-leak'));
  assert.ok(review.readiness.blockerCodes.includes('credential-dependency-leak'));
  assert.ok(review.readiness.blockerCodes.includes('live-check-enabled'));
  assert.ok(review.readiness.blockerCodes.includes('upload-command-present'));
  assert.ok(review.readiness.blockerCodes.includes('authorization-material-leak'));
  assert.ok(review.readiness.blockerCodes.includes('object-store-handle-leak'));
  assert.ok(review.readiness.blockerCodes.includes('metadata-index-handle-leak'));
  assert.equal(Object.hasOwn(review.target, 'objectKey'), false);
  assertNoPrivateValues(review);
  assertExecutionDisabled(review);
});
