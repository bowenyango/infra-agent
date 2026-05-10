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
  buildKnowledgeTeamUploadCredentialReadBoundary
} from '../../src/knowledge/team-upload-credential-read-boundary.ts';
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

async function validClientCreationBoundary() {
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
  return buildKnowledgeTeamUploadClientCreationBoundary({ adapterInjectionBoundary });
}

function assertCredentialReadBoundaryShape(boundary) {
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
    'sourceClientCreationBoundary',
    'credentialReadBoundary',
    'remainingExecutionBoundaries',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(boundary.target), [
    'manifestId',
    'objectKey',
    'objectSha256',
    'artifactId'
  ]);
  assert.deepEqual(Object.keys(boundary.sourceClientCreationBoundary), [
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
  assert.deepEqual(Object.keys(boundary.credentialReadBoundary), [
    'dryRunOnly',
    'credentialReadRequiredBeforeExecution',
    'credentialReadRequiredAfterClientBoundary',
    'clientCreationBoundaryRequired',
    'credentialSourceDescriptorRequired',
    'credentialReferenceOnlyRequired',
    'credentialValueRedactionRequired',
    'mockAdapterRequired',
    'clientFactoryDescriptorRequired',
    'credentialPresenceBoundaryRequired',
    'liveCheckBoundaryRequired',
    'uploadCommandBoundaryRequired',
    'artifactObjectStoreDependencyRequired',
    'metadataIndexDependencyRequired',
    'contentAddressedObjectKeysRequired',
    'contentAddressedIndexKeysRequired',
    'idempotentWritesRequired',
    'explicitUploadApprovalRequired',
    'credentialValuesRead',
    'credentialValuesExposed',
    'credentialPresenceChecked',
    'clientCreated',
    'sdkClientCreated',
    'adapterInjected',
    'artifactObjectStoreBound',
    'metadataIndexBound',
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

test('knowledge team upload credential read boundary contract stays dry-run and explicit', async () => {
  const clientCreationBoundary = await validClientCreationBoundary();
  const boundary = buildKnowledgeTeamUploadCredentialReadBoundary({ clientCreationBoundary });
  const validation = validateKnowledgePayload(boundary, 'knowledge-pack.upload-credential-read-boundary.json');

  assertCredentialReadBoundaryShape(boundary);
  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-credential-read-boundary');
  assert.equal(boundary.status, 'credential-read-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-credential-presence-boundary');
  assert.equal(boundary.sourceClientCreationBoundary.clientCreated, false);
  assert.equal(boundary.sourceClientCreationBoundary.sdkClientCreated, false);
  assert.equal(boundary.sourceClientCreationBoundary.credentialValuesExposed, false);
  assert.equal(boundary.credentialReadBoundary.credentialValuesRead, false);
  assert.equal(boundary.credentialReadBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.credentialReadBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.remoteMutationAllowed, false);
  assert.equal(validation.valid, true);
});

test('knowledge team upload credential read boundary contract accepts blocked safe boundaries', () => {
  const boundary = buildKnowledgeTeamUploadCredentialReadBoundary({ clientCreationBoundary: null });
  const validation = validateKnowledgePayload(boundary, 'knowledge-pack.upload-credential-read-boundary.json');

  assertCredentialReadBoundaryShape(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.readiness.nextAction, 'resolve-blockers');
  assert.equal(boundary.readiness.blockerCount > 0, true);
  assert.equal(validation.valid, true);
});

test('knowledge team upload credential read boundary contract rejects missing core objects', async () => {
  const clientCreationBoundary = await validClientCreationBoundary();
  const boundary = buildKnowledgeTeamUploadCredentialReadBoundary({ clientCreationBoundary });
  const validation = validateKnowledgePayload({
    ...boundary,
    target: null,
    sourceClientCreationBoundary: null,
    credentialReadBoundary: null,
    remainingExecutionBoundaries: null,
    readiness: null
  }, 'knowledge-pack.upload-credential-read-boundary.json');
  const paths = issuePaths(validation);

  assert.equal(validation.valid, false);
  assert.equal(paths.has('$.target'), true);
  assert.equal(paths.has('$.sourceClientCreationBoundary'), true);
  assert.equal(paths.has('$.credentialReadBoundary'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries'), true);
  assert.equal(paths.has('$.readiness'), true);
});

test('knowledge team upload credential read boundary contract rejects ready payload drift', async () => {
  const clientCreationBoundary = await validClientCreationBoundary();
  const boundary = buildKnowledgeTeamUploadCredentialReadBoundary({ clientCreationBoundary });
  const validation = validateKnowledgePayload({
    ...boundary,
    sourceClientCreationBoundary: {
      ...boundary.sourceClientCreationBoundary,
      source: 'upload-client-creation-boundary-forged',
      boundaryStatus: 'blocked',
      boundaryKind: 'unsupported',
      boundaryNextAction: 'resolve-blockers',
      adapterBackendKind: 's3-compatible',
      clientCreated: true,
      sdkClientCreated: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      liveCheckPerformed: true,
      uploadCommandGenerated: true,
      executable: true
    },
    credentialReadBoundary: {
      ...boundary.credentialReadBoundary,
      credentialValuesRead: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      clientCreated: true,
      sdkClientCreated: true,
      liveCheckPerformed: true,
      uploadCommandGenerated: true,
      executable: true,
      credentialValue: 'should-not-exist'
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
  }, 'knowledge-pack.upload-credential-read-boundary.json');
  const paths = issuePaths(validation);

  assert.equal(validation.valid, false);
  assert.equal(paths.has('$.sourceClientCreationBoundary.source'), true);
  assert.equal(paths.has('$.sourceClientCreationBoundary.boundaryStatus'), true);
  assert.equal(paths.has('$.sourceClientCreationBoundary.boundaryKind'), true);
  assert.equal(paths.has('$.sourceClientCreationBoundary.boundaryNextAction'), true);
  assert.equal(paths.has('$.sourceClientCreationBoundary.adapterBackendKind'), true);
  assert.equal(paths.has('$.sourceClientCreationBoundary.clientCreated'), true);
  assert.equal(paths.has('$.sourceClientCreationBoundary.sdkClientCreated'), true);
  assert.equal(paths.has('$.sourceClientCreationBoundary.credentialValuesExposed'), true);
  assert.equal(paths.has('$.sourceClientCreationBoundary.credentialPresenceChecked'), true);
  assert.equal(paths.has('$.sourceClientCreationBoundary.liveCheckPerformed'), true);
  assert.equal(paths.has('$.sourceClientCreationBoundary.uploadCommandGenerated'), true);
  assert.equal(paths.has('$.sourceClientCreationBoundary.executable'), true);
  assert.equal(paths.has('$.credentialReadBoundary.credentialValuesRead'), true);
  assert.equal(paths.has('$.credentialReadBoundary.credentialValuesExposed'), true);
  assert.equal(paths.has('$.credentialReadBoundary.credentialPresenceChecked'), true);
  assert.equal(paths.has('$.credentialReadBoundary.clientCreated'), true);
  assert.equal(paths.has('$.credentialReadBoundary.sdkClientCreated'), true);
  assert.equal(paths.has('$.credentialReadBoundary.liveCheckPerformed'), true);
  assert.equal(paths.has('$.credentialReadBoundary.uploadCommandGenerated'), true);
  assert.equal(paths.has('$.credentialReadBoundary.executable'), true);
  assert.equal(paths.has('$.credentialReadBoundary.credentialValue'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries.clientCreated'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries.objectWriteAllowed'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries.metadataIndexWriteAllowed'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries.remoteMutationAllowed'), true);
  assert.equal(paths.has('$.readiness.nextAction'), true);
  assert.equal(paths.has('$.readiness.blockerCount'), true);
});
