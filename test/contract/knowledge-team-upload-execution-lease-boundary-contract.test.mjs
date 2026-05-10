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

async function validWriteTokenBoundary() {
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
  return buildKnowledgeTeamUploadWriteTokenBoundary({ prerequisitePlan });
}

function assertExecutionLeaseBoundaryShape(boundary) {
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
    'sourceWriteTokenBoundary',
    'executionLeaseBoundary',
    'remainingExecutionBoundaries',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(boundary.target), [
    'manifestId',
    'objectKey',
    'objectSha256',
    'artifactId'
  ]);
  assert.deepEqual(Object.keys(boundary.sourceWriteTokenBoundary), [
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
    'auditBindingRequired',
    'executionLeaseRequiredBeforeIssuance',
    'rollbackPlanRequiredBeforeIssuance'
  ]);
  assert.deepEqual(Object.keys(boundary.executionLeaseBoundary), [
    'dryRunOnly',
    'executionLeaseRequiredBeforeExecution',
    'executionLeaseCreated',
    'leaseScopeBindingRequired',
    'leaseScopeBoundToArtifact',
    'leaseSingleUseRequired',
    'singleUseLeaseCreated',
    'leaseExpiryRequired',
    'leaseExpirySet',
    'writeTokenRequiredBeforeLease',
    'writeTokenIssued',
    'auditBindingRequired',
    'auditBindingCreated',
    'rollbackPlanRequiredBeforeExecution',
    'rollbackPlanCreated',
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
  assert.equal(boundary.executionLeaseBoundary.executionLeaseCreated, false);
  assert.equal(boundary.executionLeaseBoundary.leaseScopeBoundToArtifact, false);
  assert.equal(boundary.executionLeaseBoundary.singleUseLeaseCreated, false);
  assert.equal(boundary.executionLeaseBoundary.leaseExpirySet, false);
  assert.equal(boundary.executionLeaseBoundary.writeTokenIssued, false);
  assert.equal(boundary.executionLeaseBoundary.auditBindingCreated, false);
  assert.equal(boundary.executionLeaseBoundary.rollbackPlanCreated, false);
  assert.equal(boundary.executionLeaseBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.objectWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.metadataIndexWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.remoteMutationAllowed, false);
}

function issuePaths(report) {
  return new Set(report.issues.map(issue => issue.path));
}

test('upload execution lease boundary contract accepts ready boundaries', async () => {
  const writeTokenBoundary = await validWriteTokenBoundary();
  const boundary = buildKnowledgeTeamUploadExecutionLeaseBoundary({ writeTokenBoundary });
  const report = validateKnowledgePayload(boundary, {
    inputPath: 'execution-lease-boundary.json'
  });

  assertExecutionLeaseBoundaryShape(boundary);
  assertNonExecutable(boundary);
  assert.equal(boundary.status, 'execution-lease-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-rollback-plan-boundary');
  assert.equal(boundary.sourceWriteTokenBoundary.boundaryNextAction, 'design-execution-lease-boundary');
  assert.equal(boundary.executionLeaseBoundary.executionLeaseRequiredBeforeExecution, true);
  assert.equal(boundary.executionLeaseBoundary.executionLeaseCreated, false);
  assert.equal(report.valid, true);
});

test('upload execution lease boundary contract accepts blocked safe boundaries', async () => {
  const writeTokenBoundary = await validWriteTokenBoundary();
  const blockedBoundary = buildKnowledgeTeamUploadExecutionLeaseBoundary({
    writeTokenBoundary: {
      ...writeTokenBoundary,
      sourcePrerequisitePlan: {
        ...writeTokenBoundary.sourcePrerequisitePlan,
        fingerprintVerified: false
      }
    }
  });
  const report = validateKnowledgePayload(blockedBoundary, {
    inputPath: 'execution-lease-boundary.blocked.json'
  });

  assertExecutionLeaseBoundaryShape(blockedBoundary);
  assertNonExecutable(blockedBoundary);
  assert.equal(blockedBoundary.status, 'blocked');
  assert.equal(blockedBoundary.readiness.nextAction, 'resolve-blockers');
  assert.equal(report.valid, true);
});

test('upload execution lease boundary contract rejects executable drift', async () => {
  const writeTokenBoundary = await validWriteTokenBoundary();
  const boundary = buildKnowledgeTeamUploadExecutionLeaseBoundary({ writeTokenBoundary });
  const forgedBoundary = {
    ...boundary,
    uploadExecutionAllowed: true,
    executionLeaseCreated: true,
    executionLeaseBoundary: {
      ...boundary.executionLeaseBoundary,
      executionLeaseCreated: true,
      leaseScopeBoundToArtifact: true,
      executable: true
    },
    remainingExecutionBoundaries: {
      ...boundary.remainingExecutionBoundaries,
      executionLeaseCreated: true,
      objectWriteAllowed: true
    }
  };
  const report = validateKnowledgePayload(forgedBoundary, {
    inputPath: 'execution-lease-boundary.forged.json'
  });
  const paths = issuePaths(report);

  assert.equal(report.valid, false);
  assert.equal(paths.has('$.uploadExecutionAllowed'), true);
  assert.equal(paths.has('$.executionLeaseCreated'), true);
  assert.equal(paths.has('$.executionLeaseBoundary.executionLeaseCreated'), true);
  assert.equal(paths.has('$.executionLeaseBoundary.leaseScopeBoundToArtifact'), true);
  assert.equal(paths.has('$.executionLeaseBoundary.executable'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries.executionLeaseCreated'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries.objectWriteAllowed'), true);
});

test('upload execution lease boundary contract rejects ready payload drift', async () => {
  const writeTokenBoundary = await validWriteTokenBoundary();
  const boundary = buildKnowledgeTeamUploadExecutionLeaseBoundary({ writeTokenBoundary });
  const driftedBoundary = {
    ...boundary,
    sourceWriteTokenBoundary: {
      ...boundary.sourceWriteTokenBoundary,
      boundaryStatus: 'blocked',
      boundaryNextAction: 'resolve-blockers',
      tokenRequiredBeforeExecution: false
    },
    executionLeaseBoundary: {
      ...boundary.executionLeaseBoundary,
      executionLeaseRequiredBeforeExecution: false,
      leaseExpiryRequired: false
    },
    readiness: {
      ...boundary.readiness,
      nextAction: 'resolve-blockers',
      blockerCount: 1
    }
  };
  const report = validateKnowledgePayload(driftedBoundary, {
    inputPath: 'execution-lease-boundary.ready-drift.json'
  });
  const paths = issuePaths(report);

  assert.equal(report.valid, false);
  assert.equal(paths.has('$.sourceWriteTokenBoundary.boundaryStatus'), true);
  assert.equal(paths.has('$.sourceWriteTokenBoundary.boundaryNextAction'), true);
  assert.equal(paths.has('$.sourceWriteTokenBoundary.tokenRequiredBeforeExecution'), true);
  assert.equal(paths.has('$.executionLeaseBoundary.executionLeaseRequiredBeforeExecution'), true);
  assert.equal(paths.has('$.executionLeaseBoundary.leaseExpiryRequired'), true);
  assert.equal(paths.has('$.readiness.nextAction'), true);
  assert.equal(paths.has('$.readiness.blockerCount'), true);
});
