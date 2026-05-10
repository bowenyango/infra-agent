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
  buildKnowledgeTeamUploadAuditRecordBoundary
} from '../../src/knowledge/team-upload-audit-record-boundary.ts';
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

async function validRollbackPlanBoundary() {
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
  return buildKnowledgeTeamUploadRollbackPlanBoundary({ executionLeaseBoundary });
}

function assertAuditRecordBoundaryShape(boundary) {
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
    'sourceRollbackPlanBoundary',
    'auditRecordBoundary',
    'remainingExecutionBoundaries',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(boundary.target), [
    'manifestId',
    'objectKey',
    'objectSha256',
    'artifactId'
  ]);
  assert.deepEqual(Object.keys(boundary.sourceRollbackPlanBoundary), [
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
    'rollbackPlanRequiredBeforeExecution',
    'rollbackScopeBindingRequired',
    'rollbackReviewRequired',
    'auditRecordRequiredBeforeExecution'
  ]);
  assert.deepEqual(Object.keys(boundary.auditRecordBoundary), [
    'dryRunOnly',
    'auditRecordRequiredBeforeExecution',
    'auditRecordCreated',
    'auditScopeBindingRequired',
    'auditScopeBoundToArtifact',
    'auditReviewRequired',
    'auditReviewed',
    'writeTokenRequiredBeforeAudit',
    'writeTokenIssued',
    'executionLeaseRequiredBeforeAudit',
    'executionLeaseCreated',
    'rollbackPlanRequiredBeforeAudit',
    'rollbackPlanCreated',
    'artifactBytesRequiredBeforeAudit',
    'artifactBytesProvided',
    'auditBindingRequired',
    'auditBindingCreated',
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

test('knowledge team upload audit record boundary contract stays dry-run and explicit', async () => {
  const rollbackPlanBoundary = await validRollbackPlanBoundary();
  const boundary = buildKnowledgeTeamUploadAuditRecordBoundary({ rollbackPlanBoundary });
  const validation = validateKnowledgePayload(boundary, 'knowledge-pack.upload-audit-record-boundary.json');

  assertAuditRecordBoundaryShape(boundary);
  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-audit-record-boundary');
  assert.equal(boundary.status, 'audit-record-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-artifact-bytes-boundary');
  assert.equal(boundary.auditRecordBoundary.auditRecordCreated, false);
  assert.equal(boundary.auditRecordBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.remoteMutationAllowed, false);
  assert.equal(validation.valid, true);
});

test('knowledge team upload audit record boundary contract accepts blocked safe boundaries', () => {
  const boundary = buildKnowledgeTeamUploadAuditRecordBoundary({ rollbackPlanBoundary: null });
  const validation = validateKnowledgePayload(boundary, 'knowledge-pack.upload-audit-record-boundary.json');

  assertAuditRecordBoundaryShape(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.readiness.nextAction, 'resolve-blockers');
  assert.equal(boundary.target.manifestId, null);
  assert.equal(boundary.sourceRollbackPlanBoundary.boundaryStatus, 'invalid');
  assert.equal(validation.valid, true);
});

test('knowledge team upload audit record boundary contract rejects missing core objects', async () => {
  const rollbackPlanBoundary = await validRollbackPlanBoundary();
  const boundary = buildKnowledgeTeamUploadAuditRecordBoundary({ rollbackPlanBoundary });
  const validation = validateKnowledgePayload({
    ...boundary,
    target: null,
    sourceRollbackPlanBoundary: null,
    auditRecordBoundary: null,
    remainingExecutionBoundaries: null,
    readiness: null
  }, 'knowledge-pack.upload-audit-record-boundary.json');

  assert.equal(validation.valid, false);
  assert.equal(validation.issues.some(issue => issue.path === '$.target'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceRollbackPlanBoundary'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.auditRecordBoundary'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.remainingExecutionBoundaries'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.readiness'), true);
});

test('knowledge team upload audit record boundary contract rejects ready payload drift', async () => {
  const rollbackPlanBoundary = await validRollbackPlanBoundary();
  const boundary = buildKnowledgeTeamUploadAuditRecordBoundary({ rollbackPlanBoundary });
  const validation = validateKnowledgePayload({
    ...boundary,
    sourceRollbackPlanBoundary: {
      ...boundary.sourceRollbackPlanBoundary,
      source: 'upload-execution-lease-boundary',
      boundaryStatus: 'blocked',
      boundaryKind: 'unsupported',
      boundaryNextAction: 'resolve-blockers',
      reviewStatus: 'blocked',
      reviewKind: 'unsupported',
      scopeMatched: false,
      humanReviewRecorded: false,
      fingerprintVerified: false,
      sourceFingerprintVerified: false,
      adapterName: null,
      adapterBackendKind: 'unsupported',
      tokenRequiredBeforeExecution: false,
      tokenScopeBindingRequired: false,
      tokenSingleUseRequired: false,
      tokenExpiryRequired: false,
      executionLeaseRequiredBeforeExecution: false,
      leaseScopeBindingRequired: false,
      leaseSingleUseRequired: false,
      leaseExpiryRequired: false,
      writeTokenRequiredBeforeLease: false,
      auditBindingRequired: false,
      rollbackPlanRequiredBeforeExecution: false,
      rollbackScopeBindingRequired: false,
      rollbackReviewRequired: false,
      auditRecordRequiredBeforeExecution: false
    },
    auditRecordBoundary: {
      ...boundary.auditRecordBoundary,
      dryRunOnly: false,
      auditRecordRequiredBeforeExecution: false,
      auditRecordCreated: true,
      auditScopeBindingRequired: false,
      auditScopeBoundToArtifact: true,
      auditReviewRequired: false,
      auditReviewed: true,
      writeTokenRequiredBeforeAudit: false,
      writeTokenIssued: true,
      executionLeaseRequiredBeforeAudit: false,
      executionLeaseCreated: true,
      rollbackPlanRequiredBeforeAudit: false,
      rollbackPlanCreated: true,
      artifactBytesRequiredBeforeAudit: false,
      artifactBytesProvided: true,
      auditBindingRequired: false,
      auditBindingCreated: true,
      executable: true
    },
    remainingExecutionBoundaries: {
      ...boundary.remainingExecutionBoundaries,
      artifactBytesRequired: false,
      artifactBytesProvided: true,
      adapterInjectionRequired: false,
      adapterInjected: true,
      writeTokenRequired: false,
      writeTokenIssued: true,
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
      ...boundary.readiness,
      nextAction: 'resolve-blockers',
      blockerCount: 1
    }
  }, 'knowledge-pack.upload-audit-record-boundary.json');

  assert.equal(validation.valid, false);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceRollbackPlanBoundary.source'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceRollbackPlanBoundary.boundaryStatus'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.auditRecordBoundary.auditRecordCreated'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.remoteMutationAllowed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.readiness.nextAction'), true);
});
