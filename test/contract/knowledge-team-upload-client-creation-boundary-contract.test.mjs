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

async function validAdapterInjectionBoundary() {
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
  return buildKnowledgeTeamUploadAdapterInjectionBoundary({ artifactBytesBoundary });
}

function assertClientCreationBoundaryShape(boundary) {
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
    'sourceAdapterInjectionBoundary',
    'clientCreationBoundary',
    'remainingExecutionBoundaries',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(boundary.target), [
    'manifestId',
    'objectKey',
    'objectSha256',
    'artifactId'
  ]);
  assert.deepEqual(Object.keys(boundary.sourceAdapterInjectionBoundary), [
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
  assert.deepEqual(Object.keys(boundary.clientCreationBoundary), [
    'dryRunOnly',
    'clientCreationRequiredBeforeExecution',
    'clientCreationRequiredAfterAdapter',
    'adapterInjectionRequiredBeforeClient',
    'adapterDependencyInjectionOnly',
    'mockAdapterRequired',
    'clientFactoryDescriptorRequired',
    'credentialReadBoundaryRequired',
    'credentialPresenceBoundaryRequired',
    'liveCheckBoundaryRequired',
    'uploadCommandBoundaryRequired',
    'artifactObjectStoreDependencyRequired',
    'metadataIndexDependencyRequired',
    'contentAddressedObjectKeysRequired',
    'contentAddressedIndexKeysRequired',
    'idempotentWritesRequired',
    'explicitUploadApprovalRequired',
    'clientCreated',
    'sdkClientCreated',
    'adapterInjected',
    'artifactObjectStoreBound',
    'metadataIndexBound',
    'credentialValuesExposed',
    'credentialPresenceChecked',
    'liveCheckPerformed',
    'uploadExecutionAllowed',
    'uploadCommandGenerated',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed',
    'executable'
  ]);
  assert.deepEqual(Object.keys(boundary.remainingExecutionBoundaries), [
    'artifactBytesRequired',
    'artifactBytesProvided',
    'adapterInjectionRequired',
    'adapterInjected',
    'clientCreationRequired',
    'clientCreated',
    'credentialReadRequired',
    'credentialValuesExposed',
    'credentialPresenceCheckRequired',
    'credentialPresenceChecked',
    'liveCheckRequired',
    'liveCheckPerformed',
    'uploadCommandRequired',
    'uploadCommandGenerated',
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

test('knowledge team upload client creation boundary contract stays dry-run and explicit', async () => {
  const adapterInjectionBoundary = await validAdapterInjectionBoundary();
  const boundary = buildKnowledgeTeamUploadClientCreationBoundary({ adapterInjectionBoundary });
  const validation = validateKnowledgePayload(boundary, 'knowledge-pack.upload-client-creation-boundary.json');

  assertClientCreationBoundaryShape(boundary);
  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-client-creation-boundary');
  assert.equal(boundary.status, 'client-creation-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-credential-read-boundary');
  assert.equal(boundary.sourceAdapterInjectionBoundary.adapterInjected, false);
  assert.equal(boundary.sourceAdapterInjectionBoundary.clientCreated, false);
  assert.equal(boundary.clientCreationBoundary.clientCreated, false);
  assert.equal(boundary.clientCreationBoundary.sdkClientCreated, false);
  assert.equal(boundary.clientCreationBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.remoteMutationAllowed, false);
  assert.equal(validation.valid, true);
});

test('knowledge team upload client creation boundary contract accepts blocked safe boundaries', () => {
  const boundary = buildKnowledgeTeamUploadClientCreationBoundary({ adapterInjectionBoundary: null });
  const validation = validateKnowledgePayload(boundary, 'knowledge-pack.upload-client-creation-boundary.json');

  assertClientCreationBoundaryShape(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.readiness.nextAction, 'resolve-blockers');
  assert.equal(boundary.readiness.blockerCount > 0, true);
  assert.equal(validation.valid, true);
});

test('knowledge team upload client creation boundary contract rejects missing core objects', async () => {
  const adapterInjectionBoundary = await validAdapterInjectionBoundary();
  const boundary = buildKnowledgeTeamUploadClientCreationBoundary({ adapterInjectionBoundary });
  const validation = validateKnowledgePayload({
    ...boundary,
    target: null,
    sourceAdapterInjectionBoundary: null,
    clientCreationBoundary: null,
    remainingExecutionBoundaries: null,
    readiness: null
  }, 'knowledge-pack.upload-client-creation-boundary.json');
  const paths = issuePaths(validation);

  assert.equal(validation.valid, false);
  assert.equal(paths.has('$.target'), true);
  assert.equal(paths.has('$.sourceAdapterInjectionBoundary'), true);
  assert.equal(paths.has('$.clientCreationBoundary'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries'), true);
  assert.equal(paths.has('$.readiness'), true);
});

test('knowledge team upload client creation boundary contract rejects ready payload drift', async () => {
  const adapterInjectionBoundary = await validAdapterInjectionBoundary();
  const boundary = buildKnowledgeTeamUploadClientCreationBoundary({ adapterInjectionBoundary });
  const validation = validateKnowledgePayload({
    ...boundary,
    sourceAdapterInjectionBoundary: {
      ...boundary.sourceAdapterInjectionBoundary,
      source: 'upload-adapter-preflight',
      boundaryStatus: 'blocked',
      boundaryKind: 'unsupported',
      boundaryNextAction: 'resolve-blockers',
      adapterBackendKind: 's3-compatible',
      adapterInjected: true,
      clientCreated: true,
      artifactObjectStoreBound: true,
      metadataIndexBound: true,
      executable: true
    },
    clientCreationBoundary: {
      ...boundary.clientCreationBoundary,
      clientCreated: true,
      sdkClientCreated: true,
      adapterInjected: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      liveCheckPerformed: true,
      uploadCommandGenerated: true,
      executable: true,
      sdkClient: 'should-not-exist'
    },
    remainingExecutionBoundaries: {
      ...boundary.remainingExecutionBoundaries,
      clientCreated: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      liveCheckPerformed: true,
      uploadCommandGenerated: true,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true,
      remoteMutationAllowed: true
    },
    readiness: {
      ...boundary.readiness,
      nextAction: 'resolve-blockers',
      blockerCount: 1
    }
  }, 'knowledge-pack.upload-client-creation-boundary.json');
  const paths = issuePaths(validation);

  assert.equal(validation.valid, false);
  assert.equal(paths.has('$.sourceAdapterInjectionBoundary.source'), true);
  assert.equal(paths.has('$.sourceAdapterInjectionBoundary.boundaryStatus'), true);
  assert.equal(paths.has('$.sourceAdapterInjectionBoundary.boundaryKind'), true);
  assert.equal(paths.has('$.sourceAdapterInjectionBoundary.boundaryNextAction'), true);
  assert.equal(paths.has('$.sourceAdapterInjectionBoundary.adapterBackendKind'), true);
  assert.equal(paths.has('$.sourceAdapterInjectionBoundary.adapterInjected'), true);
  assert.equal(paths.has('$.sourceAdapterInjectionBoundary.clientCreated'), true);
  assert.equal(paths.has('$.sourceAdapterInjectionBoundary.artifactObjectStoreBound'), true);
  assert.equal(paths.has('$.sourceAdapterInjectionBoundary.metadataIndexBound'), true);
  assert.equal(paths.has('$.sourceAdapterInjectionBoundary.executable'), true);
  assert.equal(paths.has('$.clientCreationBoundary.clientCreated'), true);
  assert.equal(paths.has('$.clientCreationBoundary.sdkClientCreated'), true);
  assert.equal(paths.has('$.clientCreationBoundary.credentialValuesExposed'), true);
  assert.equal(paths.has('$.clientCreationBoundary.credentialPresenceChecked'), true);
  assert.equal(paths.has('$.clientCreationBoundary.liveCheckPerformed'), true);
  assert.equal(paths.has('$.clientCreationBoundary.uploadCommandGenerated'), true);
  assert.equal(paths.has('$.clientCreationBoundary.executable'), true);
  assert.equal(paths.has('$.clientCreationBoundary.sdkClient'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries.clientCreated'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries.objectWriteAllowed'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries.metadataIndexWriteAllowed'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries.remoteMutationAllowed'), true);
  assert.equal(paths.has('$.readiness.nextAction'), true);
  assert.equal(paths.has('$.readiness.blockerCount'), true);
});
