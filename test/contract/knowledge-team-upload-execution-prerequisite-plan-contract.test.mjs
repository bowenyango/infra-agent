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
  validateKnowledgePayload
} from '../../src/knowledge/validate.ts';
import {
  buildKnowledgeTeamArtifactContractFixture
} from '../support/knowledge-team-artifact-fixtures.mjs';

function validBackendReferenceSummary() {
  return validateKnowledgeTeamS3CompatibleBackendReferences(
    buildKnowledgeTeamS3CompatibleBackendConfig(),
    buildKnowledgeTeamS3CompatibleReferenceRegistry()
  );
}

async function validApprovalReview() {
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
  return buildKnowledgeTeamUploadMutationApprovalReview({
    mutationPlan,
    approvalFingerprint: mutationPlan.approvalAudit.approvalScopeFingerprint.value
  });
}

function assertPrerequisitePlanShape(plan) {
  assert.deepEqual(Object.keys(plan), [
    'kind',
    'schemaVersion',
    'mutationAllowed',
    'executionMode',
    'prerequisitePlanKind',
    'status',
    'plannedOperation',
    'remoteWriteAllowed',
    'liveCheckAllowed',
    'credentialValuesExposed',
    'credentialPresenceChecked',
    'uploadApproved',
    'uploadExecutionAllowed',
    'mutationApprovalGranted',
    'clientCreated',
    'adapterInjected',
    'artifactBytesProvided',
    'writeTokenIssued',
    'executionLeaseCreated',
    'rollbackPlanCreated',
    'auditRecordCreated',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed',
    'uploadCommand',
    'target',
    'sourceReview',
    'prerequisitePlan',
    'executionBoundary',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(plan.target), [
    'manifestId',
    'objectKey',
    'objectSha256',
    'artifactId'
  ]);
  assert.deepEqual(Object.keys(plan.sourceReview), [
    'source',
    'reviewStatus',
    'reviewKind',
    'reviewNextAction',
    'planStatus',
    'planNextAction',
    'gateStatus',
    'scopeMatched',
    'humanReviewRecorded',
    'fingerprintVerified',
    'sourceFingerprintVerified',
    'suppliedFingerprint',
    'expectedFingerprint',
    'adapterName',
    'adapterBackendKind'
  ]);
  assert.deepEqual(Object.keys(plan.prerequisitePlan), [
    'humanReviewRequired',
    'humanReviewRecorded',
    'fingerprintVerified',
    'mutationApprovalRequired',
    'mutationApprovalGranted',
    'uploadApproved',
    'uploadExecutionAllowed',
    'executionPrerequisitesRequired',
    'executionAllowed',
    'nextRequiredBoundary'
  ]);
  assert.deepEqual(Object.keys(plan.executionBoundary), [
    'executable',
    'dryRunOnly',
    'artifactBytesRequiredBeforeExecution',
    'artifactBytesProvided',
    'adapterInjectionRequiredBeforeExecution',
    'adapterInjected',
    'writeTokenRequiredBeforeExecution',
    'writeTokenIssued',
    'executionLeaseRequiredBeforeExecution',
    'executionLeaseCreated',
    'rollbackPlanRequiredBeforeExecution',
    'rollbackPlanCreated',
    'auditRecordRequiredBeforeExecution',
    'auditRecordCreated',
    'clientCreated',
    'credentialValuesRead',
    'credentialPresenceChecked',
    'liveCheckPerformed',
    'uploadCommandGenerated',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed'
  ]);
  assert.deepEqual(Object.keys(plan.readiness), [
    'status',
    'nextAction',
    'blockerCount',
    'blockerCodes',
    'blockers',
    'reason'
  ]);
}

function assertNonExecutable(plan) {
  for (const key of [
    'mutationAllowed',
    'remoteWriteAllowed',
    'liveCheckAllowed',
    'credentialValuesExposed',
    'credentialPresenceChecked',
    'uploadApproved',
    'uploadExecutionAllowed',
    'mutationApprovalGranted',
    'clientCreated',
    'adapterInjected',
    'artifactBytesProvided',
    'writeTokenIssued',
    'executionLeaseCreated',
    'rollbackPlanCreated',
    'auditRecordCreated',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed'
  ]) {
    assert.equal(plan[key], false, key);
  }
  assert.equal(plan.uploadCommand, null);
  assert.equal(plan.executionBoundary.executable, false);
  assert.equal(plan.executionBoundary.dryRunOnly, true);
  for (const key of [
    'artifactBytesProvided',
    'adapterInjected',
    'writeTokenIssued',
    'executionLeaseCreated',
    'rollbackPlanCreated',
    'auditRecordCreated',
    'clientCreated',
    'credentialValuesRead',
    'credentialPresenceChecked',
    'liveCheckPerformed',
    'uploadCommandGenerated',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed'
  ]) {
    assert.equal(plan.executionBoundary[key], false, key);
  }
}

test('upload execution prerequisite plan contract accepts ready prerequisite plans', async () => {
  const approvalReview = await validApprovalReview();
  const plan = buildKnowledgeTeamUploadExecutionPrerequisitePlan({ approvalReview });
  const report = validateKnowledgePayload(plan, {
    inputPath: 'execution-prerequisite-plan.json'
  });

  assertPrerequisitePlanShape(plan);
  assertNonExecutable(plan);
  assert.equal(plan.status, 'prerequisite-plan-ready');
  assert.equal(plan.readiness.nextAction, 'design-write-token-boundary');
  assert.equal(plan.prerequisitePlan.humanReviewRecorded, true);
  assert.equal(plan.prerequisitePlan.fingerprintVerified, true);
  assert.equal(plan.prerequisitePlan.executionAllowed, false);
  assert.equal(report.valid, true);
});

test('upload execution prerequisite plan contract accepts blocked safe plans', async () => {
  const approvalReview = await validApprovalReview();
  const blockedPlan = buildKnowledgeTeamUploadExecutionPrerequisitePlan({
    approvalReview: {
      ...approvalReview,
      approvalReview: {
        ...approvalReview.approvalReview,
        fingerprintVerified: false
      }
    }
  });
  const report = validateKnowledgePayload(blockedPlan, {
    inputPath: 'execution-prerequisite-plan.blocked.json'
  });

  assertPrerequisitePlanShape(blockedPlan);
  assertNonExecutable(blockedPlan);
  assert.equal(blockedPlan.status, 'blocked');
  assert.equal(blockedPlan.readiness.nextAction, 'resolve-blockers');
  assert.equal(blockedPlan.readiness.blockerCodes.includes('review-fingerprint-unverified'), true);
  assert.equal(report.valid, true);
});

test('upload execution prerequisite plan contract rejects executable drift', async () => {
  const approvalReview = await validApprovalReview();
  const plan = buildKnowledgeTeamUploadExecutionPrerequisitePlan({ approvalReview });
  const forgedPlan = {
    ...plan,
    uploadExecutionAllowed: true,
    writeTokenIssued: true,
    executionBoundary: {
      ...plan.executionBoundary,
      executable: true,
      writeTokenIssued: true
    },
    readiness: {
      ...plan.readiness,
      blockerCount: 1
    }
  };
  const report = validateKnowledgePayload(forgedPlan, {
    inputPath: 'execution-prerequisite-plan.forged.json'
  });

  assert.equal(report.valid, false);
  assert.ok(report.issues.some(issue => issue.path === '$.uploadExecutionAllowed'));
  assert.ok(report.issues.some(issue => issue.path === '$.writeTokenIssued'));
  assert.ok(report.issues.some(issue => issue.path === '$.executionBoundary.executable'));
  assert.ok(report.issues.some(issue => issue.path === '$.readiness.blockerCount'));
});
