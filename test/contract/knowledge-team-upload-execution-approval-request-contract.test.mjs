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
  buildKnowledgeTeamUploadExecutionApprovalRequest
} from '../../src/knowledge/team-upload-execution-approval-request.ts';
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
  buildKnowledgeTeamUploadExecutionReadinessBoundary
} from '../../src/knowledge/team-upload-execution-readiness-boundary.ts';
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

async function validExecutionReadinessBoundary() {
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
  const objectIndexBindingBoundary = buildKnowledgeTeamUploadObjectIndexBindingBoundary({ commandBoundary });
  return buildKnowledgeTeamUploadExecutionReadinessBoundary({ objectIndexBindingBoundary });
}

async function validApprovalRequest() {
  return buildKnowledgeTeamUploadExecutionApprovalRequest({
    executionReadinessBoundary: await validExecutionReadinessBoundary()
  });
}

function assertApprovalRequestShape(request) {
  assert.deepEqual(Object.keys(request), [
    'kind',
    'schemaVersion',
    'mutationAllowed',
    'executionMode',
    'requestKind',
    'status',
    'plannedOperation',
    'remoteWriteAllowed',
    'liveCheckAllowed',
    'credentialValuesExposed',
    'credentialPresenceChecked',
    'uploadApproved',
    'uploadExecutionApproved',
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
    'sourceExecutionReadinessBoundary',
    'approvalRequest',
    'executionBoundary',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(request.target), [
    'manifestId',
    'objectKeyRedacted',
    'objectSha256',
    'artifactId'
  ]);
  assert.equal(Object.hasOwn(request.target, 'objectKey'), false);
  assert.deepEqual(Object.keys(request.approvalRequest), [
    'uploadExecutionApprovalRequired',
    'humanApprovalRequired',
    'humanApprovalRecorded',
    'approvalGranted',
    'requestIssued',
    'source',
    'fingerprint',
    'fingerprintVerified',
    'approvalSource',
    'suppliedFingerprint',
    'uploadApproved',
    'uploadExecutionApproved',
    'uploadExecutionAllowed',
    'mutationApprovalGranted'
  ]);
  assert.deepEqual(Object.keys(request.approvalRequest.fingerprint), [
    'algorithm',
    'scope',
    'value',
    'canonicalFieldCount'
  ]);
  assert.equal(request.uploadCommand, null);
  assert.equal(request.sourceExecutionReadinessBoundary.source, 'upload-execution-readiness-boundary');
  assert.equal(request.sourceExecutionReadinessBoundary.boundaryNextAction, 'request-separate-upload-execution-approval');
  assert.equal(request.sourceExecutionReadinessBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(request.sourceExecutionReadinessBoundary.executionReadinessModeled, true);
  assert.equal(request.sourceExecutionReadinessBoundary.separateExecutionApprovalRequired, true);
  assert.equal(request.sourceExecutionReadinessBoundary.objectWriteRequiresExecutionApproval, true);
  assert.equal(request.sourceExecutionReadinessBoundary.metadataIndexWriteRequiresExecutionApproval, true);
  assert.equal(request.sourceExecutionReadinessBoundary.uploadExecutionAllowed, false);
  assert.equal(request.sourceExecutionReadinessBoundary.objectWriteAllowed, false);
  assert.equal(request.sourceExecutionReadinessBoundary.metadataIndexWriteAllowed, false);
  assert.equal(request.approvalRequest.humanApprovalRecorded, false);
  assert.equal(request.approvalRequest.approvalGranted, false);
  assert.equal(request.approvalRequest.requestIssued, true);
  assert.equal(request.approvalRequest.fingerprint.scope, 'stage-knowledge-pack-upload-execution-approval-request-v1');
  assert.equal(/^[a-f0-9]{64}$/.test(request.approvalRequest.fingerprint.value), true);
  assert.equal(request.approvalRequest.fingerprint.canonicalFieldCount, 16);
  assert.equal(request.executionBoundary.dryRunOnly, true);
  assert.equal(request.executionBoundary.executable, false);
  assert.equal(request.executionBoundary.objectWriteAllowed, false);
  assert.equal(request.executionBoundary.metadataIndexWriteAllowed, false);
  assert.equal(request.executionBoundary.objectWriteAttempted, false);
  assert.equal(request.executionBoundary.metadataIndexWriteAttempted, false);
}

test('upload execution approval request contract keeps stable ready shape', async () => {
  const request = await validApprovalRequest();

  assertApprovalRequestShape(request);
  assert.equal(request.kind, 'infra-agent.knowledge-team-upload-execution-approval-request');
  assert.equal(request.status, 'upload-execution-approval-request-ready');
  assert.equal(request.requestKind, 'upload-execution-approval-request-dry-run');
  assert.equal(request.readiness.nextAction, 'record-human-upload-execution-approval');
  assert.equal(validateKnowledgePayload(request, 'knowledge-pack.upload-execution-approval-request.json').valid, true);
});

test('upload execution approval request contract rejects drifted payloads', async () => {
  const request = await validApprovalRequest();
  const report = validateKnowledgePayload({
    ...request,
    target: {
      ...request.target,
      objectKey: 'team-artifacts/public-reference/aa/bb/drift.json',
      objectKeyRedacted: false
    },
    uploadCommand: 'aws s3 cp file s3://bucket/key',
    uploadExecutionApproved: true,
    approvalRequest: {
      ...request.approvalRequest,
      humanApprovalRecorded: true,
      approvalGranted: true,
      suppliedFingerprint: request.approvalRequest.fingerprint.value,
      fingerprintVerified: true,
      uploadExecutionApproved: true,
      uploadExecutionAllowed: true
    },
    sourceExecutionReadinessBoundary: {
      ...request.sourceExecutionReadinessBoundary,
      boundaryNextAction: 'execute-upload',
      adapterBackendKind: 's3-compatible',
      fingerprintVerified: false,
      objectWriteRequiresExecutionApproval: false,
      uploadExecutionAllowed: true,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true
    },
    executionBoundary: {
      ...request.executionBoundary,
      uploadCommandGenerated: true,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true,
      objectWriteAttempted: true,
      metadataIndexWriteAttempted: true,
      executable: true
    },
    readiness: {
      ...request.readiness,
      nextAction: 'execute-upload'
    }
  }, 'knowledge-pack.upload-execution-approval-request.json');

  assert.equal(report.valid, false);
  assert.equal(report.issues.some(issue => issue.path === '$.target.objectKey'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadCommand'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionApproved'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.approvalRequest.humanApprovalRecorded'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.approvalRequest.approvalGranted'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.approvalRequest.suppliedFingerprint'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.approvalRequest.fingerprintVerified'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceExecutionReadinessBoundary.boundaryNextAction'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceExecutionReadinessBoundary.adapterBackendKind'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceExecutionReadinessBoundary.fingerprintVerified'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceExecutionReadinessBoundary.objectWriteRequiresExecutionApproval'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceExecutionReadinessBoundary.objectWriteAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.executionBoundary.uploadCommandGenerated'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.executionBoundary.objectWriteAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.executionBoundary.executable'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.readiness.nextAction'), true);
});
