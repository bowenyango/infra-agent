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
  buildKnowledgeTeamUploadArtifactBytesBoundary
} from '../../src/knowledge/team-upload-artifact-bytes-boundary.ts';
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

async function validAuditRecordBoundary() {
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
  return buildKnowledgeTeamUploadAuditRecordBoundary({ rollbackPlanBoundary });
}

function assertArtifactBytesBoundaryShape(boundary) {
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
    'sourceAuditRecordBoundary',
    'artifactBytesBoundary',
    'remainingExecutionBoundaries',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(boundary.target), [
    'manifestId',
    'objectKey',
    'objectSha256',
    'artifactId'
  ]);
  assert.deepEqual(Object.keys(boundary.sourceAuditRecordBoundary), [
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
    'auditRecordRequiredBeforeExecution',
    'auditScopeBindingRequired',
    'auditReviewRequired',
    'artifactBytesRequiredBeforeAudit'
  ]);
  assert.deepEqual(Object.keys(boundary.artifactBytesBoundary), [
    'dryRunOnly',
    'artifactBytesRequiredBeforeAdapter',
    'artifactBytesRequiredBeforeExecution',
    'artifactBytesProvided',
    'artifactDigestRequired',
    'artifactDigestVerified',
    'artifactScopeBindingRequired',
    'artifactScopeBoundToArtifact',
    'auditRecordRequiredBeforeBytes',
    'auditRecordCreated',
    'auditScopeBindingRequired',
    'auditScopeBoundToArtifact',
    'writeTokenRequiredBeforeBytes',
    'writeTokenIssued',
    'executionLeaseRequiredBeforeBytes',
    'executionLeaseCreated',
    'rollbackPlanRequiredBeforeBytes',
    'rollbackPlanCreated',
    'adapterInjectionRequiredAfterBytes',
    'adapterInjected',
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

function issuePaths(report) {
  return new Set(report.issues.map(issue => issue.path));
}

test('knowledge team upload artifact bytes boundary contract stays dry-run and explicit', async () => {
  const auditRecordBoundary = await validAuditRecordBoundary();
  const boundary = buildKnowledgeTeamUploadArtifactBytesBoundary({ auditRecordBoundary });
  const validation = validateKnowledgePayload(boundary, 'knowledge-pack.upload-artifact-bytes-boundary.json');

  assertArtifactBytesBoundaryShape(boundary);
  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-artifact-bytes-boundary');
  assert.equal(boundary.status, 'artifact-bytes-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-adapter-injection-boundary');
  assert.equal(boundary.artifactBytesBoundary.artifactBytesProvided, false);
  assert.equal(boundary.artifactBytesBoundary.artifactDigestVerified, false);
  assert.equal(boundary.artifactBytesBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.remoteMutationAllowed, false);
  assert.equal(validation.valid, true);
});

test('knowledge team upload artifact bytes boundary contract accepts blocked safe boundaries', () => {
  const boundary = buildKnowledgeTeamUploadArtifactBytesBoundary({ auditRecordBoundary: null });
  const validation = validateKnowledgePayload(boundary, 'knowledge-pack.upload-artifact-bytes-boundary.json');

  assertArtifactBytesBoundaryShape(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.readiness.nextAction, 'resolve-blockers');
  assert.equal(boundary.target.manifestId, null);
  assert.equal(boundary.sourceAuditRecordBoundary.boundaryStatus, 'invalid');
  assert.equal(validation.valid, true);
});

test('knowledge team upload artifact bytes boundary contract rejects missing core objects', async () => {
  const auditRecordBoundary = await validAuditRecordBoundary();
  const boundary = buildKnowledgeTeamUploadArtifactBytesBoundary({ auditRecordBoundary });
  const validation = validateKnowledgePayload({
    ...boundary,
    target: null,
    sourceAuditRecordBoundary: null,
    artifactBytesBoundary: null,
    remainingExecutionBoundaries: null,
    readiness: null
  }, 'knowledge-pack.upload-artifact-bytes-boundary.json');
  const paths = issuePaths(validation);

  assert.equal(validation.valid, false);
  assert.equal(paths.has('$.target'), true);
  assert.equal(paths.has('$.sourceAuditRecordBoundary'), true);
  assert.equal(paths.has('$.artifactBytesBoundary'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries'), true);
  assert.equal(paths.has('$.readiness'), true);
});

test('knowledge team upload artifact bytes boundary contract rejects ready payload drift', async () => {
  const auditRecordBoundary = await validAuditRecordBoundary();
  const boundary = buildKnowledgeTeamUploadArtifactBytesBoundary({ auditRecordBoundary });
  const validation = validateKnowledgePayload({
    ...boundary,
    sourceAuditRecordBoundary: {
      ...boundary.sourceAuditRecordBoundary,
      source: 'upload-rollback-plan-boundary',
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
      auditRecordRequiredBeforeExecution: false,
      auditScopeBindingRequired: false,
      auditReviewRequired: false,
      artifactBytesRequiredBeforeAudit: false
    },
    artifactBytesBoundary: {
      ...boundary.artifactBytesBoundary,
      dryRunOnly: false,
      artifactBytesRequiredBeforeAdapter: false,
      artifactBytesRequiredBeforeExecution: false,
      artifactBytesProvided: true,
      artifactDigestRequired: false,
      artifactDigestVerified: true,
      artifactScopeBindingRequired: false,
      artifactScopeBoundToArtifact: true,
      auditRecordRequiredBeforeBytes: false,
      auditRecordCreated: true,
      auditScopeBindingRequired: false,
      auditScopeBoundToArtifact: true,
      writeTokenRequiredBeforeBytes: false,
      writeTokenIssued: true,
      executionLeaseRequiredBeforeBytes: false,
      executionLeaseCreated: true,
      rollbackPlanRequiredBeforeBytes: false,
      rollbackPlanCreated: true,
      adapterInjectionRequiredAfterBytes: false,
      adapterInjected: true,
      executable: true,
      bytesBase64: 'raw-artifact-bytes'
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
  }, 'knowledge-pack.upload-artifact-bytes-boundary.json');
  const paths = issuePaths(validation);

  assert.equal(validation.valid, false);
  assert.equal(paths.has('$.sourceAuditRecordBoundary.source'), true);
  assert.equal(paths.has('$.sourceAuditRecordBoundary.boundaryStatus'), true);
  assert.equal(paths.has('$.artifactBytesBoundary.artifactBytesProvided'), true);
  assert.equal(paths.has('$.artifactBytesBoundary.artifactDigestVerified'), true);
  assert.equal(paths.has('$.artifactBytesBoundary.bytesBase64'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries.remoteMutationAllowed'), true);
  assert.equal(paths.has('$.readiness.nextAction'), true);
});
