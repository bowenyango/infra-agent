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

async function validExecutionLeaseBoundary() {
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
  return buildKnowledgeTeamUploadExecutionLeaseBoundary({ writeTokenBoundary });
}

function assertRollbackPlanBoundaryShape(boundary) {
  assert.deepEqual(Object.keys(boundary), [
    'kind',
    'schemaVersion',
    'mutationAllowed',
    'executionMode',
    'boundaryKind',
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
    'sourceExecutionLeaseBoundary',
    'rollbackPlanBoundary',
    'remainingExecutionBoundaries',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(boundary.target), [
    'manifestId',
    'objectKey',
    'objectSha256',
    'artifactId'
  ]);
  assert.deepEqual(Object.keys(boundary.sourceExecutionLeaseBoundary), [
    'source',
    'boundaryStatus',
    'boundaryKind',
    'boundaryNextAction',
    'reviewStatus',
    'reviewKind',
    'scopeMatched',
    'humanReviewRecorded',
    'fingerprintVerified',
    'sourceFingerprintVerified',
    'adapterName',
    'adapterBackendKind',
    'tokenRequiredBeforeExecution',
    'tokenScopeBindingRequired',
    'tokenSingleUseRequired',
    'tokenExpiryRequired',
    'executionLeaseRequiredBeforeExecution',
    'leaseScopeBindingRequired',
    'leaseSingleUseRequired',
    'leaseExpiryRequired',
    'writeTokenRequiredBeforeLease',
    'auditBindingRequired',
    'rollbackPlanRequiredBeforeExecution'
  ]);
  assert.deepEqual(Object.keys(boundary.rollbackPlanBoundary), [
    'dryRunOnly',
    'rollbackPlanRequiredBeforeExecution',
    'rollbackPlanCreated',
    'rollbackScopeBindingRequired',
    'rollbackScopeBoundToArtifact',
    'rollbackReviewRequired',
    'rollbackReviewed',
    'writeTokenRequiredBeforeRollback',
    'writeTokenIssued',
    'executionLeaseRequiredBeforeRollback',
    'executionLeaseCreated',
    'artifactBytesRequiredBeforeRollback',
    'artifactBytesProvided',
    'auditBindingRequired',
    'auditBindingCreated',
    'auditRecordRequiredBeforeExecution',
    'auditRecordCreated',
    'executable'
  ]);
  assert.deepEqual(Object.keys(boundary.remainingExecutionBoundaries), [
    'artifactBytesRequired',
    'artifactBytesProvided',
    'adapterInjectionRequired',
    'adapterInjected',
    'writeTokenRequired',
    'writeTokenIssued',
    'executionLeaseRequired',
    'executionLeaseCreated',
    'rollbackPlanRequired',
    'rollbackPlanCreated',
    'auditRecordRequired',
    'auditRecordCreated',
    'objectWriteAllowed',
    'metadataIndexWriteAllowed',
    'remoteMutationAllowed'
  ]);
  assert.deepEqual(Object.keys(boundary.readiness), [
    'status',
    'nextAction',
    'blockerCount',
    'blockerCodes',
    'blockers',
    'reason'
  ]);
}

function assertNonExecutable(boundary) {
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
    assert.equal(boundary[key], false, key);
  }
  assert.equal(boundary.uploadCommand, null);
  assert.equal(boundary.rollbackPlanBoundary.rollbackPlanCreated, false);
  assert.equal(boundary.rollbackPlanBoundary.rollbackScopeBoundToArtifact, false);
  assert.equal(boundary.rollbackPlanBoundary.rollbackReviewed, false);
  assert.equal(boundary.rollbackPlanBoundary.writeTokenIssued, false);
  assert.equal(boundary.rollbackPlanBoundary.executionLeaseCreated, false);
  assert.equal(boundary.rollbackPlanBoundary.artifactBytesProvided, false);
  assert.equal(boundary.rollbackPlanBoundary.auditBindingCreated, false);
  assert.equal(boundary.rollbackPlanBoundary.auditRecordCreated, false);
  assert.equal(boundary.rollbackPlanBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.objectWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.metadataIndexWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.remoteMutationAllowed, false);
}

function issuePaths(report) {
  return new Set(report.issues.map(issue => issue.path));
}

test('upload rollback plan boundary contract accepts ready boundaries', async () => {
  const executionLeaseBoundary = await validExecutionLeaseBoundary();
  const boundary = buildKnowledgeTeamUploadRollbackPlanBoundary({ executionLeaseBoundary });
  const report = validateKnowledgePayload(boundary, 'rollback-plan-boundary.json');

  assertRollbackPlanBoundaryShape(boundary);
  assertNonExecutable(boundary);
  assert.equal(boundary.status, 'rollback-plan-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-audit-record-boundary');
  assert.equal(boundary.sourceExecutionLeaseBoundary.boundaryNextAction, 'design-rollback-plan-boundary');
  assert.equal(boundary.rollbackPlanBoundary.rollbackPlanRequiredBeforeExecution, true);
  assert.equal(boundary.rollbackPlanBoundary.rollbackPlanCreated, false);
  assert.equal(report.valid, true);
});

test('upload rollback plan boundary contract accepts blocked safe boundaries', async () => {
  const executionLeaseBoundary = await validExecutionLeaseBoundary();
  const blockedBoundary = buildKnowledgeTeamUploadRollbackPlanBoundary({
    executionLeaseBoundary: {
      ...executionLeaseBoundary,
      sourceWriteTokenBoundary: {
        ...executionLeaseBoundary.sourceWriteTokenBoundary,
        fingerprintVerified: false
      }
    }
  });
  const report = validateKnowledgePayload(blockedBoundary, 'rollback-plan-boundary.blocked.json');

  assertRollbackPlanBoundaryShape(blockedBoundary);
  assertNonExecutable(blockedBoundary);
  assert.equal(blockedBoundary.status, 'blocked');
  assert.equal(blockedBoundary.readiness.nextAction, 'resolve-blockers');
  assert.equal(report.valid, true);
});

test('upload rollback plan boundary contract rejects executable drift', async () => {
  const executionLeaseBoundary = await validExecutionLeaseBoundary();
  const boundary = buildKnowledgeTeamUploadRollbackPlanBoundary({ executionLeaseBoundary });
  const forgedBoundary = {
    ...boundary,
    uploadExecutionAllowed: true,
    rollbackPlanCreated: true,
    rollbackPlanBoundary: {
      ...boundary.rollbackPlanBoundary,
      rollbackPlanCreated: true,
      rollbackScopeBoundToArtifact: true,
      executable: true
    },
    remainingExecutionBoundaries: {
      ...boundary.remainingExecutionBoundaries,
      rollbackPlanCreated: true,
      objectWriteAllowed: true
    }
  };
  const report = validateKnowledgePayload(forgedBoundary, 'rollback-plan-boundary.forged.json');
  const paths = issuePaths(report);

  assert.equal(report.valid, false);
  assert.equal(paths.has('$.uploadExecutionAllowed'), true);
  assert.equal(paths.has('$.rollbackPlanCreated'), true);
  assert.equal(paths.has('$.rollbackPlanBoundary.rollbackPlanCreated'), true);
  assert.equal(paths.has('$.rollbackPlanBoundary.rollbackScopeBoundToArtifact'), true);
  assert.equal(paths.has('$.rollbackPlanBoundary.executable'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries.rollbackPlanCreated'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries.objectWriteAllowed'), true);
});

test('upload rollback plan boundary contract rejects ready payload drift', async () => {
  const executionLeaseBoundary = await validExecutionLeaseBoundary();
  const boundary = buildKnowledgeTeamUploadRollbackPlanBoundary({ executionLeaseBoundary });
  const driftedBoundary = {
    ...boundary,
    sourceExecutionLeaseBoundary: {
      ...boundary.sourceExecutionLeaseBoundary,
      boundaryStatus: 'blocked',
      boundaryNextAction: 'resolve-blockers',
      tokenRequiredBeforeExecution: false
    },
    rollbackPlanBoundary: {
      ...boundary.rollbackPlanBoundary,
      rollbackPlanRequiredBeforeExecution: false,
      rollbackReviewRequired: false
    },
    readiness: {
      ...boundary.readiness,
      nextAction: 'resolve-blockers',
      blockerCount: 1
    }
  };
  const report = validateKnowledgePayload(driftedBoundary, 'rollback-plan-boundary.ready-drift.json');
  const paths = issuePaths(report);

  assert.equal(report.valid, false);
  assert.equal(paths.has('$.sourceExecutionLeaseBoundary.boundaryStatus'), true);
  assert.equal(paths.has('$.sourceExecutionLeaseBoundary.boundaryNextAction'), true);
  assert.equal(paths.has('$.sourceExecutionLeaseBoundary.tokenRequiredBeforeExecution'), true);
  assert.equal(paths.has('$.rollbackPlanBoundary.rollbackPlanRequiredBeforeExecution'), true);
  assert.equal(paths.has('$.rollbackPlanBoundary.rollbackReviewRequired'), true);
  assert.equal(paths.has('$.readiness.nextAction'), true);
  assert.equal(paths.has('$.readiness.blockerCount'), true);
});
