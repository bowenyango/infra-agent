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

async function validPrerequisitePlan() {
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
  return buildKnowledgeTeamUploadExecutionPrerequisitePlan({ approvalReview });
}

function assertWriteTokenBoundaryShape(boundary) {
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
    'sourcePrerequisitePlan',
    'writeTokenBoundary',
    'remainingExecutionBoundaries',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(boundary.target), [
    'manifestId',
    'objectKey',
    'objectSha256',
    'artifactId'
  ]);
  assert.deepEqual(Object.keys(boundary.sourcePrerequisitePlan), [
    'source',
    'prerequisiteStatus',
    'prerequisitePlanKind',
    'prerequisiteNextAction',
    'reviewStatus',
    'reviewKind',
    'scopeMatched',
    'humanReviewRecorded',
    'fingerprintVerified',
    'sourceFingerprintVerified',
    'adapterName',
    'adapterBackendKind',
    'writeTokenRequiredBeforeExecution',
    'artifactBytesRequiredBeforeExecution',
    'adapterInjectionRequiredBeforeExecution',
    'executionLeaseRequiredBeforeExecution',
    'rollbackPlanRequiredBeforeExecution',
    'auditRecordRequiredBeforeExecution'
  ]);
  assert.deepEqual(Object.keys(boundary.writeTokenBoundary), [
    'dryRunOnly',
    'tokenRequiredBeforeExecution',
    'tokenIssued',
    'tokenScopeBindingRequired',
    'tokenScopeBoundToArtifact',
    'tokenSingleUseRequired',
    'singleUseTokenIssued',
    'tokenExpiryRequired',
    'tokenExpirySet',
    'auditBindingRequired',
    'auditBindingCreated',
    'executionLeaseRequiredBeforeIssuance',
    'executionLeaseCreated',
    'rollbackPlanRequiredBeforeIssuance',
    'rollbackPlanCreated',
    'executable'
  ]);
  assert.deepEqual(Object.keys(boundary.remainingExecutionBoundaries), [
    'artifactBytesRequired',
    'artifactBytesProvided',
    'adapterInjectionRequired',
    'adapterInjected',
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
  assert.equal(boundary.writeTokenBoundary.tokenIssued, false);
  assert.equal(boundary.writeTokenBoundary.tokenScopeBoundToArtifact, false);
  assert.equal(boundary.writeTokenBoundary.singleUseTokenIssued, false);
  assert.equal(boundary.writeTokenBoundary.tokenExpirySet, false);
  assert.equal(boundary.writeTokenBoundary.auditBindingCreated, false);
  assert.equal(boundary.writeTokenBoundary.executionLeaseCreated, false);
  assert.equal(boundary.writeTokenBoundary.rollbackPlanCreated, false);
  assert.equal(boundary.writeTokenBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.objectWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.metadataIndexWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.remoteMutationAllowed, false);
}

function issuePaths(report) {
  return new Set(report.issues.map(issue => issue.path));
}

test('upload write token boundary contract accepts ready boundaries', async () => {
  const prerequisitePlan = await validPrerequisitePlan();
  const boundary = buildKnowledgeTeamUploadWriteTokenBoundary({ prerequisitePlan });
  const report = validateKnowledgePayload(boundary, {
    inputPath: 'write-token-boundary.json'
  });

  assertWriteTokenBoundaryShape(boundary);
  assertNonExecutable(boundary);
  assert.equal(boundary.status, 'write-token-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-execution-lease-boundary');
  assert.equal(boundary.sourcePrerequisitePlan.prerequisiteNextAction, 'design-write-token-boundary');
  assert.equal(boundary.writeTokenBoundary.tokenRequiredBeforeExecution, true);
  assert.equal(boundary.writeTokenBoundary.tokenIssued, false);
  assert.equal(report.valid, true);
});

test('upload write token boundary contract accepts blocked safe boundaries', async () => {
  const prerequisitePlan = await validPrerequisitePlan();
  const blockedBoundary = buildKnowledgeTeamUploadWriteTokenBoundary({
    prerequisitePlan: {
      ...prerequisitePlan,
      sourceReview: {
        ...prerequisitePlan.sourceReview,
        fingerprintVerified: false
      }
    }
  });
  const report = validateKnowledgePayload(blockedBoundary, {
    inputPath: 'write-token-boundary.blocked.json'
  });

  assertWriteTokenBoundaryShape(blockedBoundary);
  assertNonExecutable(blockedBoundary);
  assert.equal(blockedBoundary.status, 'blocked');
  assert.equal(blockedBoundary.readiness.nextAction, 'resolve-blockers');
  assert.equal(blockedBoundary.readiness.blockerCodes.includes('review-fingerprint-unverified'), true);
  assert.equal(report.valid, true);
});

test('upload write token boundary contract rejects executable drift', async () => {
  const prerequisitePlan = await validPrerequisitePlan();
  const boundary = buildKnowledgeTeamUploadWriteTokenBoundary({ prerequisitePlan });
  const forgedBoundary = {
    ...boundary,
    uploadExecutionAllowed: true,
    writeTokenIssued: true,
    writeTokenBoundary: {
      ...boundary.writeTokenBoundary,
      tokenIssued: true,
      tokenScopeBoundToArtifact: true,
      tokenExpirySet: true,
      executable: true
    },
    readiness: {
      ...boundary.readiness,
      blockerCount: 1
    }
  };
  const report = validateKnowledgePayload(forgedBoundary, {
    inputPath: 'write-token-boundary.forged.json'
  });

  assert.equal(report.valid, false);
  assert.ok(report.issues.some(issue => issue.path === '$.uploadExecutionAllowed'));
  assert.ok(report.issues.some(issue => issue.path === '$.writeTokenIssued'));
  assert.ok(report.issues.some(issue => issue.path === '$.writeTokenBoundary.tokenIssued'));
  assert.ok(report.issues.some(issue => issue.path === '$.writeTokenBoundary.executable'));
  assert.ok(report.issues.some(issue => issue.path === '$.readiness.blockerCount'));
});

test('upload write token boundary contract rejects ready payload drift', async () => {
  const prerequisitePlan = await validPrerequisitePlan();
  const boundary = buildKnowledgeTeamUploadWriteTokenBoundary({ prerequisitePlan });
  const forgedBoundary = {
    ...boundary,
    boundaryKind: 'runtime-token',
    plannedOperation: 'delete-knowledge-pack',
    target: {
      manifestId: null,
      objectKey: null,
      objectSha256: null,
      artifactId: 'UNSAFE'
    },
    sourcePrerequisitePlan: {
      ...boundary.sourcePrerequisitePlan,
      source: 'manual-plan',
      prerequisiteStatus: 'blocked',
      prerequisitePlanKind: 'unsupported',
      prerequisiteNextAction: 'resolve-blockers',
      reviewStatus: 'blocked',
      reviewKind: 'unsupported',
      scopeMatched: false,
      humanReviewRecorded: false,
      fingerprintVerified: false,
      sourceFingerprintVerified: false,
      adapterName: '../unsafe-adapter',
      adapterBackendKind: 's3-compatible',
      writeTokenRequiredBeforeExecution: false,
      artifactBytesRequiredBeforeExecution: false,
      adapterInjectionRequiredBeforeExecution: false,
      executionLeaseRequiredBeforeExecution: false,
      rollbackPlanRequiredBeforeExecution: false,
      auditRecordRequiredBeforeExecution: false
    },
    writeTokenBoundary: {
      ...boundary.writeTokenBoundary,
      dryRunOnly: false,
      tokenRequiredBeforeExecution: false,
      tokenIssued: true,
      tokenScopeBindingRequired: false,
      tokenScopeBoundToArtifact: true,
      tokenSingleUseRequired: false,
      singleUseTokenIssued: true,
      tokenExpiryRequired: false,
      tokenExpirySet: true,
      auditBindingRequired: false,
      auditBindingCreated: true,
      executionLeaseRequiredBeforeIssuance: false,
      executionLeaseCreated: true,
      rollbackPlanRequiredBeforeIssuance: false,
      rollbackPlanCreated: true,
      executable: true
    },
    remainingExecutionBoundaries: {
      ...boundary.remainingExecutionBoundaries,
      artifactBytesRequired: false,
      artifactBytesProvided: true,
      adapterInjectionRequired: false,
      adapterInjected: true,
      executionLeaseRequired: false,
      executionLeaseCreated: true,
      rollbackPlanRequired: false,
      rollbackPlanCreated: true,
      auditRecordRequired: false,
      auditRecordCreated: true,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true,
      remoteMutationAllowed: true
    },
    readiness: {
      status: 'blocked',
      nextAction: 'resolve-blockers',
      blockerCount: 1,
      blockerCodes: ['write-token-issued'],
      blockers: [{
        code: 'write-token-issued',
        path: '$.writeTokenBoundary.tokenIssued',
        message: 'token must not be issued'
      }],
      reason: 'blocked'
    }
  };
  const report = validateKnowledgePayload(forgedBoundary, {
    inputPath: 'write-token-boundary.ready-drift.json'
  });
  const paths = issuePaths(report);

  assert.equal(report.valid, false);
  for (const path of [
    '$.boundaryKind',
    '$.plannedOperation',
    '$.target.manifestId',
    '$.target.objectKey',
    '$.target.objectSha256',
    '$.target.artifactId',
    '$.sourcePrerequisitePlan.source',
    '$.sourcePrerequisitePlan.prerequisiteStatus',
    '$.sourcePrerequisitePlan.prerequisitePlanKind',
    '$.sourcePrerequisitePlan.prerequisiteNextAction',
    '$.sourcePrerequisitePlan.reviewStatus',
    '$.sourcePrerequisitePlan.reviewKind',
    '$.sourcePrerequisitePlan.scopeMatched',
    '$.sourcePrerequisitePlan.humanReviewRecorded',
    '$.sourcePrerequisitePlan.fingerprintVerified',
    '$.sourcePrerequisitePlan.sourceFingerprintVerified',
    '$.sourcePrerequisitePlan.adapterName',
    '$.sourcePrerequisitePlan.adapterBackendKind',
    '$.sourcePrerequisitePlan.writeTokenRequiredBeforeExecution',
    '$.writeTokenBoundary.dryRunOnly',
    '$.writeTokenBoundary.tokenRequiredBeforeExecution',
    '$.writeTokenBoundary.tokenIssued',
    '$.writeTokenBoundary.tokenScopeBindingRequired',
    '$.writeTokenBoundary.tokenScopeBoundToArtifact',
    '$.writeTokenBoundary.tokenSingleUseRequired',
    '$.writeTokenBoundary.singleUseTokenIssued',
    '$.writeTokenBoundary.tokenExpiryRequired',
    '$.writeTokenBoundary.tokenExpirySet',
    '$.writeTokenBoundary.auditBindingRequired',
    '$.writeTokenBoundary.auditBindingCreated',
    '$.writeTokenBoundary.executionLeaseRequiredBeforeIssuance',
    '$.writeTokenBoundary.executionLeaseCreated',
    '$.writeTokenBoundary.rollbackPlanRequiredBeforeIssuance',
    '$.writeTokenBoundary.rollbackPlanCreated',
    '$.writeTokenBoundary.executable',
    '$.remainingExecutionBoundaries.artifactBytesRequired',
    '$.remainingExecutionBoundaries.artifactBytesProvided',
    '$.remainingExecutionBoundaries.adapterInjectionRequired',
    '$.remainingExecutionBoundaries.adapterInjected',
    '$.remainingExecutionBoundaries.executionLeaseRequired',
    '$.remainingExecutionBoundaries.executionLeaseCreated',
    '$.remainingExecutionBoundaries.rollbackPlanRequired',
    '$.remainingExecutionBoundaries.rollbackPlanCreated',
    '$.remainingExecutionBoundaries.auditRecordRequired',
    '$.remainingExecutionBoundaries.auditRecordCreated',
    '$.remainingExecutionBoundaries.objectWriteAllowed',
    '$.remainingExecutionBoundaries.metadataIndexWriteAllowed',
    '$.remainingExecutionBoundaries.remoteMutationAllowed',
    '$.readiness.status',
    '$.readiness.nextAction',
    '$.readiness.blockerCount'
  ]) {
    assert.equal(paths.has(path), true, path);
  }
});
