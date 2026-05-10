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
  buildKnowledgeTeamUploadLiveCheckBoundary
} from '../../src/knowledge/team-upload-live-check-boundary.ts';
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

async function validLiveCheckBoundary() {
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
  const credentialReadBoundary = buildKnowledgeTeamUploadCredentialReadBoundary({ clientCreationBoundary });
  const credentialPresenceBoundary = buildKnowledgeTeamUploadCredentialPresenceBoundary({ credentialReadBoundary });
  return buildKnowledgeTeamUploadLiveCheckBoundary({ credentialPresenceBoundary });
}

function assertLiveCheckBoundaryShape(boundary) {
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
    'sourceCredentialPresenceBoundary',
    'liveCheckBoundary',
    'remainingExecutionBoundaries',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(boundary.target), [
    'manifestId',
    'objectKey',
    'objectSha256',
    'artifactId'
  ]);
  assert.deepEqual(Object.keys(boundary.sourceCredentialPresenceBoundary), [
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
  assert.deepEqual(Object.keys(boundary.liveCheckBoundary), [
    'dryRunOnly',
    'liveCheckRequiredBeforeExecution',
    'liveCheckRequiredAfterCredentialPresenceBoundary',
    'credentialPresenceBoundaryRequired',
    'credentialReadBoundaryRequired',
    'credentialSourceDescriptorRequired',
    'credentialReferenceOnlyRequired',
    'credentialValueRedactionRequired',
    'credentialPresenceSignalRequired',
    'credentialPresenceResultRedactionRequired',
    'mockAdapterRequired',
    'clientFactoryDescriptorRequired',
    'liveCheckPolicyRequired',
    'liveCheckReadOnlyRequired',
    'liveCheckResultRedactionRequired',
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
    'liveCheckAllowed',
    'liveCheckPerformed',
    'liveCheckResultExposed',
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

test('upload live check boundary contract keeps stable ready shape', async () => {
  const boundary = await validLiveCheckBoundary();

  assertLiveCheckBoundaryShape(boundary);
  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-live-check-boundary');
  assert.equal(boundary.status, 'live-check-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-upload-command-boundary');
  assert.equal(boundary.sourceCredentialPresenceBoundary.source, 'upload-credential-presence-boundary');
  assert.equal(boundary.liveCheckBoundary.liveCheckPolicyRequired, true);
  assert.equal(boundary.liveCheckBoundary.liveCheckPerformed, false);
  assert.equal(validateKnowledgePayload(boundary, 'knowledge-pack.upload-live-check-boundary.json').valid, true);
});

test('upload live check boundary contract rejects drifted payloads', async () => {
  const boundary = await validLiveCheckBoundary();
  const validation = validateKnowledgePayload({
    ...boundary,
    boundaryKind: 'credential-presence-boundary-dry-run',
    sourceCredentialPresenceBoundary: {
      ...boundary.sourceCredentialPresenceBoundary,
      source: 'upload-credential-read-boundary',
      boundaryKind: 'unsupported',
      boundaryNextAction: 'resolve-blockers'
    },
    liveCheckBoundary: {
      ...boundary.liveCheckBoundary,
      liveCheckRequiredBeforeExecution: false,
      liveCheckAllowed: true,
      liveCheckPerformed: true,
      liveCheckResultExposed: true
    },
    readiness: {
      ...boundary.readiness,
      nextAction: 'resolve-blockers',
      blockerCodes: ['live-check-enabled'],
      blockerCount: 1,
      blockers: [{
        code: 'live-check-enabled',
        path: '$.liveCheckBoundary.liveCheckPerformed',
        message: 'live check was performed'
      }]
    }
  }, 'knowledge-pack.upload-live-check-boundary.json');

  assert.equal(validation.valid, false);
  assert.equal(validation.issues.some(issue => issue.path === '$.boundaryKind'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceCredentialPresenceBoundary.source'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceCredentialPresenceBoundary.boundaryKind'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceCredentialPresenceBoundary.boundaryNextAction'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.liveCheckBoundary.liveCheckRequiredBeforeExecution'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.liveCheckBoundary.liveCheckAllowed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.liveCheckBoundary.liveCheckPerformed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.liveCheckBoundary.liveCheckResultExposed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.readiness.nextAction'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.readiness.blockerCount'), true);
});
