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
  buildKnowledgeTeamUploadExecutionApprovalRecord
} from '../../src/knowledge/team-upload-execution-approval-record.ts';
import {
  buildKnowledgeTeamUploadExecutionApprovalRequest
} from '../../src/knowledge/team-upload-execution-approval-request.ts';
import {
  buildKnowledgeTeamUploadExecutionAuthorizationBoundary
} from '../../src/knowledge/team-upload-execution-authorization-boundary.ts';
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

async function validAuthorizationBoundary() {
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
  const executionReadinessBoundary = buildKnowledgeTeamUploadExecutionReadinessBoundary({ objectIndexBindingBoundary });
  const executionApprovalRequest = buildKnowledgeTeamUploadExecutionApprovalRequest({ executionReadinessBoundary });
  const executionApprovalRecord = buildKnowledgeTeamUploadExecutionApprovalRecord({
    executionApprovalRequest,
    approvalFingerprint: executionApprovalRequest.approvalRequest.fingerprint.value
  });
  return buildKnowledgeTeamUploadExecutionAuthorizationBoundary({
    executionApprovalRecord
  });
}

function assertAuthorizationBoundaryShape(boundary) {
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
    'sourceApprovalRecord',
    'authorizationBoundary',
    'executionBoundary',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(boundary.target), [
    'manifestId',
    'objectKeyRedacted',
    'objectSha256',
    'artifactId'
  ]);
  assert.equal(Object.hasOwn(boundary.target, 'objectKey'), false);
  assert.deepEqual(Object.keys(boundary.authorizationBoundary), [
    'dryRunOnly',
    'uploadExecutionAuthorizationRequired',
    'humanApprovalRecorded',
    'approvalFingerprintVerified',
    'authorizationBoundaryDesigned',
    'authorizationGranted',
    'executionAuthorizationGranted',
    'approvalGranted',
    'uploadApproved',
    'uploadExecutionApproved',
    'uploadExecutionAllowed',
    'mutationApprovalGranted',
    'executable',
    'objectWriteAllowed',
    'metadataIndexWriteAllowed',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed',
    'sourceApprovalRecordFingerprint',
    'authorizationBoundaryFingerprint'
  ]);
  assert.equal(boundary.status, 'upload-execution-authorization-boundary-ready');
  assert.equal(boundary.boundaryKind, 'upload-execution-authorization-boundary-dry-run');
  assert.equal(boundary.uploadCommand, null);
  assert.equal(boundary.uploadApproved, false);
  assert.equal(boundary.uploadExecutionApproved, false);
  assert.equal(boundary.uploadExecutionAllowed, false);
  assert.equal(boundary.mutationApprovalGranted, false);
  assert.equal(boundary.sourceApprovalRecord.recordStatus, 'upload-execution-approval-record-ready');
  assert.equal(boundary.sourceApprovalRecord.recordKind, 'human-upload-execution-approval-record-dry-run');
  assert.equal(boundary.sourceApprovalRecord.recordNextAction, 'design-upload-execution-authorization-boundary');
  assert.equal(boundary.sourceApprovalRecord.sourceApprovalRequestStatus, 'upload-execution-approval-request-ready');
  assert.equal(boundary.sourceApprovalRecord.sourceApprovalRequestNextAction, 'record-human-upload-execution-approval');
  assert.equal(boundary.sourceApprovalRecord.sourceExecutionReadinessStatus, 'upload-execution-readiness-boundary-ready');
  assert.equal(boundary.sourceApprovalRecord.sourceExecutionReadinessNextAction, 'request-separate-upload-execution-approval');
  assert.equal(boundary.sourceApprovalRecord.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceApprovalRecord.requestIssued, true);
  assert.equal(boundary.sourceApprovalRecord.requestHumanApprovalRecorded, false);
  assert.equal(boundary.sourceApprovalRecord.requestApprovalGranted, false);
  assert.equal(boundary.sourceApprovalRecord.requestFingerprintVerified, false);
  assert.equal(boundary.sourceApprovalRecord.humanApprovalRecorded, true);
  assert.equal(boundary.sourceApprovalRecord.approvalFingerprintVerified, true);
  assert.equal(boundary.sourceApprovalRecord.approvalGranted, false);
  assert.equal(boundary.sourceApprovalRecord.recordFingerprint.scope, 'stage-knowledge-pack-upload-execution-approval-record-v1');
  assert.equal(boundary.sourceApprovalRecord.recordFingerprint.canonicalFieldCount, 14);
  assert.equal(boundary.authorizationBoundary.dryRunOnly, true);
  assert.equal(boundary.authorizationBoundary.uploadExecutionAuthorizationRequired, true);
  assert.equal(boundary.authorizationBoundary.humanApprovalRecorded, true);
  assert.equal(boundary.authorizationBoundary.approvalFingerprintVerified, true);
  assert.equal(boundary.authorizationBoundary.authorizationBoundaryDesigned, true);
  assert.equal(boundary.authorizationBoundary.authorizationGranted, false);
  assert.equal(boundary.authorizationBoundary.executionAuthorizationGranted, false);
  assert.equal(boundary.authorizationBoundary.uploadExecutionApproved, false);
  assert.equal(boundary.authorizationBoundary.uploadExecutionAllowed, false);
  assert.equal(boundary.authorizationBoundary.executable, false);
  assert.equal(boundary.authorizationBoundary.objectWriteAllowed, false);
  assert.equal(boundary.authorizationBoundary.metadataIndexWriteAllowed, false);
  assert.equal(boundary.authorizationBoundary.authorizationBoundaryFingerprint.scope, 'stage-knowledge-pack-upload-execution-authorization-boundary-v1');
  assert.equal(boundary.authorizationBoundary.authorizationBoundaryFingerprint.canonicalFieldCount, 16);
  assert.equal(/^[a-f0-9]{64}$/.test(boundary.authorizationBoundary.authorizationBoundaryFingerprint.value), true);
  assert.equal(boundary.executionBoundary.dryRunOnly, true);
  assert.equal(boundary.executionBoundary.executable, false);
  assert.equal(boundary.executionBoundary.objectWriteAllowed, false);
  assert.equal(boundary.executionBoundary.metadataIndexWriteAllowed, false);
  assert.equal(boundary.executionBoundary.remoteMutationPerformed, false);
  assert.equal(boundary.readiness.nextAction, 'await-plan-rules-update-for-upload-execution');
}

test('upload execution authorization boundary contract keeps stable ready shape', async () => {
  const boundary = await validAuthorizationBoundary();

  assertAuthorizationBoundaryShape(boundary);
  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-execution-authorization-boundary');
  assert.equal(validateKnowledgePayload(boundary, 'knowledge-pack.upload-execution-authorization-boundary.json').valid, true);
});

test('upload execution authorization boundary contract rejects drifted payloads', async () => {
  const boundary = await validAuthorizationBoundary();
  const report = validateKnowledgePayload({
    ...boundary,
    target: {
      ...boundary.target,
      objectKey: 'team-artifacts/public-reference/aa/bb/drift.json',
      objectKeyRedacted: false
    },
    uploadCommand: 'aws s3 cp file s3://bucket/key',
    uploadExecutionApproved: true,
    uploadExecutionAllowed: true,
    sourceApprovalRecord: {
      ...boundary.sourceApprovalRecord,
      recordNextAction: 'execute-upload',
      humanApprovalRecorded: false,
      approvalFingerprintVerified: false,
      approvalGranted: true,
      adapterBackendKind: 's3-compatible',
      sourceRequestFingerprint: {
        ...boundary.sourceApprovalRecord.sourceRequestFingerprint,
        value: '0'.repeat(64)
      },
      recordFingerprint: {
        ...boundary.sourceApprovalRecord.recordFingerprint,
        canonicalFieldCount: 13
      }
    },
    authorizationBoundary: {
      ...boundary.authorizationBoundary,
      humanApprovalRecorded: false,
      approvalFingerprintVerified: false,
      authorizationBoundaryDesigned: false,
      authorizationGranted: true,
      executionAuthorizationGranted: true,
      uploadExecutionApproved: true,
      uploadExecutionAllowed: true,
      executable: true,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true,
      remoteMutationPerformed: true,
      sourceApprovalRecordFingerprint: {
        ...boundary.authorizationBoundary.sourceApprovalRecordFingerprint,
        value: '0'.repeat(64)
      },
      authorizationBoundaryFingerprint: {
        ...boundary.authorizationBoundary.authorizationBoundaryFingerprint,
        value: null
      }
    },
    executionBoundary: {
      ...boundary.executionBoundary,
      uploadCommandGenerated: true,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true,
      objectWriteAttempted: true,
      metadataIndexWriteAttempted: true,
      executable: true
    },
    readiness: {
      ...boundary.readiness,
      nextAction: 'execute-upload'
    }
  }, 'knowledge-pack.upload-execution-authorization-boundary.json');

  assert.equal(report.valid, false);
  assert.equal(report.issues.some(issue => issue.path === '$.target.objectKey'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.target.objectKeyRedacted'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadCommand'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionApproved'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceApprovalRecord.recordNextAction'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceApprovalRecord.humanApprovalRecorded'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceApprovalRecord.approvalFingerprintVerified'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceApprovalRecord.approvalGranted'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceApprovalRecord.adapterBackendKind'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceApprovalRecord.sourceRequestFingerprint.value'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceApprovalRecord.recordFingerprint.canonicalFieldCount'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.authorizationBoundary.humanApprovalRecorded'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.authorizationBoundary.authorizationGranted'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.authorizationBoundary.executionAuthorizationGranted'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.authorizationBoundary.uploadExecutionAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.authorizationBoundary.executable'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.authorizationBoundary.objectWriteAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.authorizationBoundary.metadataIndexWriteAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.authorizationBoundary.remoteMutationPerformed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.authorizationBoundary.sourceApprovalRecordFingerprint.value'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.authorizationBoundary.authorizationBoundaryFingerprint.value'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.executionBoundary.uploadCommandGenerated'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.executionBoundary.objectWriteAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.executionBoundary.executable'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.readiness.nextAction'), true);
});
