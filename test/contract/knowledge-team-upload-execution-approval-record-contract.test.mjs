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

async function validApprovalRequest() {
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
  return buildKnowledgeTeamUploadExecutionApprovalRequest({ executionReadinessBoundary });
}

async function validApprovalRecord() {
  const executionApprovalRequest = await validApprovalRequest();
  return buildKnowledgeTeamUploadExecutionApprovalRecord({
    executionApprovalRequest,
    approvalFingerprint: executionApprovalRequest.approvalRequest.fingerprint.value
  });
}

function assertApprovalRecordShape(record) {
  assert.deepEqual(Object.keys(record), [
    'kind',
    'schemaVersion',
    'mutationAllowed',
    'executionMode',
    'recordKind',
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
    'sourceApprovalRequest',
    'approvalRecord',
    'executionBoundary',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(record.target), [
    'manifestId',
    'objectKeyRedacted',
    'objectSha256',
    'artifactId'
  ]);
  assert.equal(Object.hasOwn(record.target, 'objectKey'), false);
  assert.deepEqual(Object.keys(record.approvalRecord), [
    'uploadExecutionApprovalRequired',
    'humanApprovalRequired',
    'humanApprovalRecorded',
    'approvalGranted',
    'source',
    'suppliedFingerprint',
    'expectedFingerprint',
    'fingerprintVerified',
    'sourceRequestFingerprint',
    'recordFingerprint',
    'uploadApproved',
    'uploadExecutionApproved',
    'uploadExecutionAllowed',
    'mutationApprovalGranted'
  ]);
  assert.equal(record.status, 'upload-execution-approval-record-ready');
  assert.equal(record.recordKind, 'human-upload-execution-approval-record-dry-run');
  assert.equal(record.uploadCommand, null);
  assert.equal(record.uploadApproved, false);
  assert.equal(record.uploadExecutionApproved, false);
  assert.equal(record.uploadExecutionAllowed, false);
  assert.equal(record.mutationApprovalGranted, false);
  assert.equal(record.sourceApprovalRequest.requestStatus, 'upload-execution-approval-request-ready');
  assert.equal(record.sourceApprovalRequest.requestNextAction, 'record-human-upload-execution-approval');
  assert.equal(record.sourceApprovalRequest.requestIssued, true);
  assert.equal(record.sourceApprovalRequest.requestHumanApprovalRecorded, false);
  assert.equal(record.sourceApprovalRequest.requestApprovalGranted, false);
  assert.equal(record.sourceApprovalRequest.requestFingerprintVerified, false);
  assert.equal(record.sourceApprovalRequest.sourceExecutionReadinessStatus, 'upload-execution-readiness-boundary-ready');
  assert.equal(record.sourceApprovalRequest.sourceExecutionReadinessNextAction, 'request-separate-upload-execution-approval');
  assert.equal(record.sourceApprovalRequest.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(record.sourceApprovalRequest.executionReadinessModeled, true);
  assert.equal(record.sourceApprovalRequest.separateExecutionApprovalRequired, true);
  assert.equal(record.sourceApprovalRequest.objectWriteRequiresExecutionApproval, true);
  assert.equal(record.sourceApprovalRequest.metadataIndexWriteRequiresExecutionApproval, true);
  assert.equal(record.sourceApprovalRequest.uploadExecutionApproved, false);
  assert.equal(record.sourceApprovalRequest.uploadExecutionAllowed, false);
  assert.equal(record.sourceApprovalRequest.objectWriteAllowed, false);
  assert.equal(record.sourceApprovalRequest.metadataIndexWriteAllowed, false);
  assert.equal(record.approvalRecord.humanApprovalRecorded, true);
  assert.equal(record.approvalRecord.approvalGranted, false);
  assert.equal(record.approvalRecord.source, 'cli-flag');
  assert.equal(record.approvalRecord.suppliedFingerprint, record.approvalRecord.expectedFingerprint);
  assert.equal(record.approvalRecord.fingerprintVerified, true);
  assert.equal(record.approvalRecord.sourceRequestFingerprint.value, record.approvalRecord.expectedFingerprint);
  assert.equal(record.approvalRecord.sourceRequestFingerprint.canonicalFieldCount, 16);
  assert.equal(record.approvalRecord.recordFingerprint.scope, 'stage-knowledge-pack-upload-execution-approval-record-v1');
  assert.equal(record.approvalRecord.recordFingerprint.canonicalFieldCount, 14);
  assert.equal(/^[a-f0-9]{64}$/.test(record.approvalRecord.recordFingerprint.value), true);
  assert.equal(record.executionBoundary.dryRunOnly, true);
  assert.equal(record.executionBoundary.executable, false);
  assert.equal(record.executionBoundary.objectWriteAllowed, false);
  assert.equal(record.executionBoundary.metadataIndexWriteAllowed, false);
  assert.equal(record.executionBoundary.objectWriteAttempted, false);
  assert.equal(record.executionBoundary.metadataIndexWriteAttempted, false);
}

test('upload execution approval record contract keeps stable ready shape', async () => {
  const record = await validApprovalRecord();

  assertApprovalRecordShape(record);
  assert.equal(record.kind, 'infra-agent.knowledge-team-upload-execution-approval-record');
  assert.equal(record.readiness.nextAction, 'design-upload-execution-authorization-boundary');
  assert.equal(validateKnowledgePayload(record, 'knowledge-pack.upload-execution-approval-record.json').valid, true);
});

test('upload execution approval record contract rejects drifted payloads', async () => {
  const record = await validApprovalRecord();
  const report = validateKnowledgePayload({
    ...record,
    target: {
      ...record.target,
      objectKey: 'team-artifacts/public-reference/aa/bb/drift.json',
      objectKeyRedacted: false
    },
    uploadCommand: 'aws s3 cp file s3://bucket/key',
    uploadExecutionApproved: true,
    uploadExecutionAllowed: true,
    sourceApprovalRequest: {
      ...record.sourceApprovalRequest,
      requestNextAction: 'execute-upload',
      requestApprovalGranted: true,
      sourceExecutionReadinessNextAction: 'execute-upload',
      adapterBackendKind: 's3-compatible',
      sourceFingerprintVerified: false,
      objectWriteRequiresExecutionApproval: false,
      uploadExecutionApproved: true,
      uploadExecutionAllowed: true,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true
    },
    approvalRecord: {
      ...record.approvalRecord,
      humanApprovalRecorded: false,
      approvalGranted: true,
      source: 'operator-name',
      suppliedFingerprint: '0'.repeat(64),
      fingerprintVerified: false,
      uploadExecutionApproved: true,
      uploadExecutionAllowed: true,
      recordFingerprint: {
        ...record.approvalRecord.recordFingerprint,
        value: null
      }
    },
    executionBoundary: {
      ...record.executionBoundary,
      uploadCommandGenerated: true,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true,
      objectWriteAttempted: true,
      metadataIndexWriteAttempted: true,
      executable: true
    },
    readiness: {
      ...record.readiness,
      nextAction: 'execute-upload'
    }
  }, 'knowledge-pack.upload-execution-approval-record.json');

  assert.equal(report.valid, false);
  assert.equal(report.issues.some(issue => issue.path === '$.target.objectKey'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadCommand'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionApproved'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceApprovalRequest.requestNextAction'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceApprovalRequest.requestApprovalGranted'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceApprovalRequest.sourceExecutionReadinessNextAction'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceApprovalRequest.adapterBackendKind'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceApprovalRequest.sourceFingerprintVerified'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceApprovalRequest.objectWriteRequiresExecutionApproval'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceApprovalRequest.objectWriteAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.approvalRecord.humanApprovalRecorded'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.approvalRecord.approvalGranted'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.approvalRecord.source'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.approvalRecord.suppliedFingerprint'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.approvalRecord.fingerprintVerified'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.approvalRecord.recordFingerprint.value'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.executionBoundary.uploadCommandGenerated'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.executionBoundary.objectWriteAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.executionBoundary.executable'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.readiness.nextAction'), true);
});
