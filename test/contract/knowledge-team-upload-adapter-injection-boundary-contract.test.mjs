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

async function validArtifactBytesBoundary() {
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
  return buildKnowledgeTeamUploadArtifactBytesBoundary({ auditRecordBoundary });
}

function assertAdapterInjectionBoundaryShape(boundary) {
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
    'sourceArtifactBytesBoundary',
    'adapterInjectionBoundary',
    'remainingExecutionBoundaries',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(boundary.target), [
    'manifestId',
    'objectKey',
    'objectSha256',
    'artifactId'
  ]);
  assert.deepEqual(Object.keys(boundary.sourceArtifactBytesBoundary), [
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
    'artifactBytesRequiredBeforeAdapter',
    'artifactBytesRequiredBeforeExecution',
    'artifactBytesProvided',
    'artifactDigestRequired',
    'artifactDigestVerified',
    'artifactScopeBindingRequired',
    'artifactScopeBoundToArtifact',
    'auditRecordRequiredBeforeBytes',
    'auditRecordCreated',
    'writeTokenRequiredBeforeBytes',
    'writeTokenIssued',
    'executionLeaseRequiredBeforeBytes',
    'executionLeaseCreated',
    'rollbackPlanRequiredBeforeBytes',
    'rollbackPlanCreated',
    'adapterInjectionRequiredAfterBytes'
  ]);
  assert.deepEqual(Object.keys(boundary.adapterInjectionBoundary), [
    'dryRunOnly',
    'adapterInjectionRequiredBeforeExecution',
    'adapterInjectionRequiredAfterBytes',
    'adapterDependencyInjectionOnly',
    'mockAdapterRequired',
    'adapterDescriptorRequired',
    'artifactObjectStoreDependencyRequired',
    'metadataIndexDependencyRequired',
    'contentAddressedObjectKeysRequired',
    'contentAddressedIndexKeysRequired',
    'idempotentWritesRequired',
    'explicitUploadApprovalRequired',
    'artifactBytesRequiredBeforeAdapter',
    'artifactBytesProvided',
    'artifactDigestRequired',
    'artifactDigestVerified',
    'artifactScopeBindingRequired',
    'artifactScopeBoundToArtifact',
    'writeTokenRequiredBeforeAdapter',
    'writeTokenIssued',
    'executionLeaseRequiredBeforeAdapter',
    'executionLeaseCreated',
    'rollbackPlanRequiredBeforeAdapter',
    'rollbackPlanCreated',
    'auditRecordRequiredBeforeAdapter',
    'auditRecordCreated',
    'adapterInjected',
    'clientCreated',
    'artifactObjectStoreBound',
    'metadataIndexBound',
    'executable'
  ]);
  assert.deepEqual(Object.keys(boundary.remainingExecutionBoundaries), [
    'artifactBytesRequired',
    'artifactBytesProvided',
    'adapterInjectionRequired',
    'adapterInjected',
    'clientCreationRequired',
    'clientCreated',
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

test('knowledge team upload adapter injection boundary contract stays dry-run and explicit', async () => {
  const artifactBytesBoundary = await validArtifactBytesBoundary();
  const boundary = buildKnowledgeTeamUploadAdapterInjectionBoundary({ artifactBytesBoundary });
  const validation = validateKnowledgePayload(boundary, 'knowledge-pack.upload-adapter-injection-boundary.json');

  assertAdapterInjectionBoundaryShape(boundary);
  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-adapter-injection-boundary');
  assert.equal(boundary.status, 'adapter-injection-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-client-creation-boundary');
  assert.equal(boundary.adapterInjectionBoundary.adapterInjected, false);
  assert.equal(boundary.adapterInjectionBoundary.clientCreated, false);
  assert.equal(boundary.adapterInjectionBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.remoteMutationAllowed, false);
  assert.equal(validation.valid, true);
});

test('knowledge team upload adapter injection boundary contract accepts blocked safe boundaries', () => {
  const boundary = buildKnowledgeTeamUploadAdapterInjectionBoundary({ artifactBytesBoundary: null });
  const validation = validateKnowledgePayload(boundary, 'knowledge-pack.upload-adapter-injection-boundary.json');

  assertAdapterInjectionBoundaryShape(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.readiness.nextAction, 'resolve-blockers');
  assert.equal(boundary.target.manifestId, null);
  assert.equal(boundary.sourceArtifactBytesBoundary.boundaryStatus, 'invalid');
  assert.equal(validation.valid, true);
});

test('knowledge team upload adapter injection boundary contract rejects missing core objects', async () => {
  const artifactBytesBoundary = await validArtifactBytesBoundary();
  const boundary = buildKnowledgeTeamUploadAdapterInjectionBoundary({ artifactBytesBoundary });
  const validation = validateKnowledgePayload({
    ...boundary,
    target: null,
    sourceArtifactBytesBoundary: null,
    adapterInjectionBoundary: null,
    remainingExecutionBoundaries: null,
    readiness: null
  }, 'knowledge-pack.upload-adapter-injection-boundary.json');
  const paths = issuePaths(validation);

  assert.equal(validation.valid, false);
  assert.equal(paths.has('$.target'), true);
  assert.equal(paths.has('$.sourceArtifactBytesBoundary'), true);
  assert.equal(paths.has('$.adapterInjectionBoundary'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries'), true);
  assert.equal(paths.has('$.readiness'), true);
});

test('knowledge team upload adapter injection boundary contract rejects ready payload drift', async () => {
  const artifactBytesBoundary = await validArtifactBytesBoundary();
  const boundary = buildKnowledgeTeamUploadAdapterInjectionBoundary({ artifactBytesBoundary });
  const validation = validateKnowledgePayload({
    ...boundary,
    sourceArtifactBytesBoundary: {
      ...boundary.sourceArtifactBytesBoundary,
      source: 'upload-audit-record-boundary',
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
      artifactBytesRequiredBeforeAdapter: false,
      artifactBytesRequiredBeforeExecution: false,
      artifactBytesProvided: true,
      artifactDigestRequired: false,
      artifactDigestVerified: true,
      artifactScopeBindingRequired: false,
      artifactScopeBoundToArtifact: true,
      auditRecordRequiredBeforeBytes: false,
      auditRecordCreated: true,
      writeTokenRequiredBeforeBytes: false,
      writeTokenIssued: true,
      executionLeaseRequiredBeforeBytes: false,
      executionLeaseCreated: true,
      rollbackPlanRequiredBeforeBytes: false,
      rollbackPlanCreated: true,
      adapterInjectionRequiredAfterBytes: false
    },
    adapterInjectionBoundary: {
      ...boundary.adapterInjectionBoundary,
      dryRunOnly: false,
      adapterInjectionRequiredBeforeExecution: false,
      adapterInjected: true,
      clientCreated: true,
      artifactObjectStoreBound: true,
      metadataIndexBound: true,
      executable: true,
      adapterInstance: {
        putObject: 'should-not-exist'
      }
    },
    remainingExecutionBoundaries: {
      ...boundary.remainingExecutionBoundaries,
      clientCreationRequired: false,
      adapterInjected: true,
      clientCreated: true,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true,
      remoteMutationAllowed: true
    },
    readiness: {
      ...boundary.readiness,
      nextAction: 'resolve-blockers',
      blockerCount: 1
    }
  }, 'knowledge-pack.upload-adapter-injection-boundary.json');
  const paths = issuePaths(validation);

  assert.equal(validation.valid, false);
  assert.equal(paths.has('$.sourceArtifactBytesBoundary.source'), true);
  assert.equal(paths.has('$.sourceArtifactBytesBoundary.boundaryStatus'), true);
  assert.equal(paths.has('$.sourceArtifactBytesBoundary.artifactBytesProvided'), true);
  assert.equal(paths.has('$.sourceArtifactBytesBoundary.artifactDigestVerified'), true);
  assert.equal(paths.has('$.adapterInjectionBoundary.adapterInjected'), true);
  assert.equal(paths.has('$.adapterInjectionBoundary.clientCreated'), true);
  assert.equal(paths.has('$.adapterInjectionBoundary.adapterInstance'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries.remoteMutationAllowed'), true);
  assert.equal(paths.has('$.readiness.nextAction'), true);
});
