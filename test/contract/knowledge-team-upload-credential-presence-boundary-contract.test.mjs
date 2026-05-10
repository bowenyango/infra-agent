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
  buildKnowledgeTeamUploadCredentialPresenceBoundary
} from '../../src/knowledge/team-upload-credential-presence-boundary.ts';
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

async function validCredentialReadBoundary() {
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
  return buildKnowledgeTeamUploadCredentialReadBoundary({ clientCreationBoundary });
}

function assertCredentialPresenceBoundaryShape(boundary) {
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
    'sourceCredentialReadBoundary',
    'credentialPresenceBoundary',
    'remainingExecutionBoundaries',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(boundary.target), [
    'manifestId',
    'objectKey',
    'objectSha256',
    'artifactId'
  ]);
  assert.deepEqual(Object.keys(boundary.sourceCredentialReadBoundary), [
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
  assert.deepEqual(Object.keys(boundary.credentialPresenceBoundary), [
    'dryRunOnly',
    'credentialPresenceCheckRequiredBeforeExecution',
    'credentialPresenceCheckRequiredAfterCredentialReadBoundary',
    'credentialReadBoundaryRequired',
    'credentialSourceDescriptorRequired',
    'credentialReferenceOnlyRequired',
    'credentialValueRedactionRequired',
    'credentialPresenceSignalRequired',
    'credentialPresenceResultRedactionRequired',
    'mockAdapterRequired',
    'clientFactoryDescriptorRequired',
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
    'credentialPresenceResultExposed',
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

test('knowledge team upload credential presence boundary contract stays dry-run and explicit', async () => {
  const credentialReadBoundary = await validCredentialReadBoundary();
  const boundary = buildKnowledgeTeamUploadCredentialPresenceBoundary({ credentialReadBoundary });
  const validation = validateKnowledgePayload(boundary, 'knowledge-pack.upload-credential-presence-boundary.json');

  assertCredentialPresenceBoundaryShape(boundary);
  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-credential-presence-boundary');
  assert.equal(boundary.status, 'credential-presence-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-live-check-boundary');
  assert.equal(boundary.sourceCredentialReadBoundary.credentialValuesRead, false);
  assert.equal(boundary.sourceCredentialReadBoundary.credentialValuesExposed, false);
  assert.equal(boundary.sourceCredentialReadBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.credentialPresenceBoundary.credentialValuesRead, false);
  assert.equal(boundary.credentialPresenceBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.credentialPresenceBoundary.credentialPresenceResultExposed, false);
  assert.equal(boundary.credentialPresenceBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.remoteMutationAllowed, false);
  assert.equal(validation.valid, true);
});

test('knowledge team upload credential presence boundary contract accepts blocked safe boundaries', () => {
  const boundary = buildKnowledgeTeamUploadCredentialPresenceBoundary({ credentialReadBoundary: null });
  const validation = validateKnowledgePayload(boundary, 'knowledge-pack.upload-credential-presence-boundary.json');

  assertCredentialPresenceBoundaryShape(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.readiness.nextAction, 'resolve-blockers');
  assert.equal(boundary.readiness.blockerCount > 0, true);
  assert.equal(validation.valid, true);
});

test('knowledge team upload credential presence boundary contract rejects missing core objects', async () => {
  const credentialReadBoundary = await validCredentialReadBoundary();
  const boundary = buildKnowledgeTeamUploadCredentialPresenceBoundary({ credentialReadBoundary });
  const validation = validateKnowledgePayload({
    ...boundary,
    target: null,
    sourceCredentialReadBoundary: null,
    credentialPresenceBoundary: null,
    remainingExecutionBoundaries: null,
    readiness: null
  }, 'knowledge-pack.upload-credential-presence-boundary.json');
  const paths = issuePaths(validation);

  assert.equal(validation.valid, false);
  assert.equal(paths.has('$.target'), true);
  assert.equal(paths.has('$.sourceCredentialReadBoundary'), true);
  assert.equal(paths.has('$.credentialPresenceBoundary'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries'), true);
  assert.equal(paths.has('$.readiness'), true);
});

test('knowledge team upload credential presence boundary contract rejects ready payload drift', async () => {
  const credentialReadBoundary = await validCredentialReadBoundary();
  const boundary = buildKnowledgeTeamUploadCredentialPresenceBoundary({ credentialReadBoundary });
  const validation = validateKnowledgePayload({
    ...boundary,
    sourceCredentialReadBoundary: {
      ...boundary.sourceCredentialReadBoundary,
      source: 'upload-credential-read-boundary-forged',
      boundaryStatus: 'blocked',
      boundaryKind: 'unsupported',
      boundaryNextAction: 'resolve-blockers',
      adapterBackendKind: 's3-compatible',
      credentialValuesRead: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      clientCreated: true,
      sdkClientCreated: true,
      liveCheckPerformed: true,
      uploadCommandGenerated: true,
      executable: true
    },
    credentialPresenceBoundary: {
      ...boundary.credentialPresenceBoundary,
      credentialValuesRead: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      credentialPresenceResultExposed: true,
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
  }, 'knowledge-pack.upload-credential-presence-boundary.json');
  const paths = issuePaths(validation);

  assert.equal(validation.valid, false);
  assert.equal(paths.has('$.sourceCredentialReadBoundary.source'), true);
  assert.equal(paths.has('$.sourceCredentialReadBoundary.boundaryStatus'), true);
  assert.equal(paths.has('$.sourceCredentialReadBoundary.boundaryKind'), true);
  assert.equal(paths.has('$.sourceCredentialReadBoundary.boundaryNextAction'), true);
  assert.equal(paths.has('$.sourceCredentialReadBoundary.adapterBackendKind'), true);
  assert.equal(paths.has('$.sourceCredentialReadBoundary.credentialValuesRead'), true);
  assert.equal(paths.has('$.sourceCredentialReadBoundary.credentialValuesExposed'), true);
  assert.equal(paths.has('$.sourceCredentialReadBoundary.credentialPresenceChecked'), true);
  assert.equal(paths.has('$.sourceCredentialReadBoundary.clientCreated'), true);
  assert.equal(paths.has('$.sourceCredentialReadBoundary.sdkClientCreated'), true);
  assert.equal(paths.has('$.sourceCredentialReadBoundary.liveCheckPerformed'), true);
  assert.equal(paths.has('$.sourceCredentialReadBoundary.uploadCommandGenerated'), true);
  assert.equal(paths.has('$.sourceCredentialReadBoundary.executable'), true);
  assert.equal(paths.has('$.credentialPresenceBoundary.credentialValuesRead'), true);
  assert.equal(paths.has('$.credentialPresenceBoundary.credentialValuesExposed'), true);
  assert.equal(paths.has('$.credentialPresenceBoundary.credentialPresenceChecked'), true);
  assert.equal(paths.has('$.credentialPresenceBoundary.credentialPresenceResultExposed'), true);
  assert.equal(paths.has('$.credentialPresenceBoundary.clientCreated'), true);
  assert.equal(paths.has('$.credentialPresenceBoundary.sdkClientCreated'), true);
  assert.equal(paths.has('$.credentialPresenceBoundary.liveCheckPerformed'), true);
  assert.equal(paths.has('$.credentialPresenceBoundary.uploadCommandGenerated'), true);
  assert.equal(paths.has('$.credentialPresenceBoundary.executable'), true);
  assert.equal(paths.has('$.credentialPresenceBoundary.credentialValue'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries.clientCreated'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries.objectWriteAllowed'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries.metadataIndexWriteAllowed'), true);
  assert.equal(paths.has('$.remainingExecutionBoundaries.remoteMutationAllowed'), true);
  assert.equal(paths.has('$.readiness.nextAction'), true);
  assert.equal(paths.has('$.readiness.blockerCount'), true);
});
