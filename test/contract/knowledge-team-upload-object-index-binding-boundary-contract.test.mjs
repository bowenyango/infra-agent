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
  buildKnowledgeTeamUploadCommandBoundary
} from '../../src/knowledge/team-upload-command-boundary.ts';
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
  buildKnowledgeTeamUploadObjectIndexBindingBoundary
} from '../../src/knowledge/team-upload-object-index-binding-boundary.ts';
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

async function validObjectIndexBindingBoundary() {
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
  const liveCheckBoundary = buildKnowledgeTeamUploadLiveCheckBoundary({ credentialPresenceBoundary });
  const commandBoundary = buildKnowledgeTeamUploadCommandBoundary({ liveCheckBoundary });
  return buildKnowledgeTeamUploadObjectIndexBindingBoundary({ commandBoundary });
}

function assertObjectIndexBindingBoundaryShape(boundary) {
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
    'sourceUploadCommandBoundary',
    'objectIndexBindingBoundary',
    'remainingExecutionBoundaries',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(boundary.target), [
    'manifestId',
    'objectKeyRedacted',
    'objectSha256',
    'artifactId'
  ]);
  assert.equal(Object.hasOwn(boundary.target, 'objectKey'), false);
  assert.equal(boundary.uploadCommand, null);
  assert.equal(boundary.objectIndexBindingBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.objectIndexBindingBoundary.metadataIndexBound, false);
  assert.equal(boundary.objectIndexBindingBoundary.objectStoreHandleExposed, false);
  assert.equal(boundary.objectIndexBindingBoundary.metadataIndexHandleExposed, false);
  assert.equal(boundary.objectIndexBindingBoundary.objectWriteAllowed, false);
  assert.equal(boundary.objectIndexBindingBoundary.metadataIndexWriteAllowed, false);
  assert.equal(boundary.objectIndexBindingBoundary.executable, false);
}

test('object/index binding boundary contract keeps stable ready shape', async () => {
  const boundary = await validObjectIndexBindingBoundary();

  assertObjectIndexBindingBoundaryShape(boundary);
  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-object-index-binding-boundary');
  assert.equal(boundary.status, 'object-index-binding-boundary-ready');
  assert.equal(boundary.boundaryKind, 'object-index-binding-boundary-dry-run');
  assert.equal(boundary.readiness.nextAction, 'design-upload-execution-readiness-boundary');
  assert.equal(validateKnowledgePayload(boundary, 'knowledge-pack.upload-object-index-binding-boundary.json').valid, true);
});

test('object/index binding boundary contract rejects drifted payloads', async () => {
  const boundary = await validObjectIndexBindingBoundary();
  const report = validateKnowledgePayload({
    ...boundary,
    target: {
      ...boundary.target,
      objectKey: 'team-artifacts/public-reference/aa/bb/drift.json',
      objectKeyRedacted: false
    },
    uploadCommand: 'aws s3 cp file s3://bucket/key',
    objectIndexBindingBoundary: {
      ...boundary.objectIndexBindingBoundary,
      artifactObjectStoreBound: true,
      metadataIndexBound: true,
      objectStoreHandleExposed: true,
      metadataIndexHandleExposed: true,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true,
      executable: true
    },
    readiness: {
      ...boundary.readiness,
      nextAction: 'execute-upload'
    }
  }, 'knowledge-pack.upload-object-index-binding-boundary.json');

  assert.equal(report.valid, false);
  assert.equal(report.issues.some(issue => issue.path === '$.target.objectKey'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.target.objectKeyRedacted'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadCommand'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.objectIndexBindingBoundary.artifactObjectStoreBound'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.objectIndexBindingBoundary.metadataIndexBound'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.objectIndexBindingBoundary.objectStoreHandleExposed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.objectIndexBindingBoundary.metadataIndexHandleExposed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.objectIndexBindingBoundary.objectWriteAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.objectIndexBindingBoundary.metadataIndexWriteAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.objectIndexBindingBoundary.executable'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.readiness.nextAction'), true);
});
