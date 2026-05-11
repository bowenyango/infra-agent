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
  buildKnowledgeTeamArtifactContractFixture
} from '../support/knowledge-team-artifact-fixtures.mjs';

function validBackendReferenceSummary() {
  return validateKnowledgeTeamS3CompatibleBackendReferences(
    buildKnowledgeTeamS3CompatibleBackendConfig(),
    buildKnowledgeTeamS3CompatibleReferenceRegistry()
  );
}

async function validExecutionApprovalRecord() {
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
  return buildKnowledgeTeamUploadExecutionApprovalRecord({
    executionApprovalRequest,
    approvalFingerprint: executionApprovalRequest.approvalRequest.fingerprint.value
  });
}

function assertNoPrivateValues(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const forbidden of [
    'https://should-not-copy.example.test',
    'should-not-copy-bucket',
    'should-not-copy-secret',
    'aws s3 cp',
    's3://private-bucket',
    'private-key',
    'client-secret-value',
    'credential-secret-value',
    'raw-artifact-bytes',
    'private-live-check-output',
    'signed-upload-command',
    'authorization-secret-value',
    'team-artifacts/public-reference/aa/bb/private-key.json'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

function assertExecutionDisabled(boundary) {
  assert.equal(boundary.mutationAllowed, false);
  assert.equal(boundary.executionMode, 'dry-run');
  assert.equal(boundary.remoteWriteAllowed, false);
  assert.equal(boundary.liveCheckAllowed, false);
  assert.equal(boundary.credentialValuesExposed, false);
  assert.equal(boundary.credentialPresenceChecked, false);
  assert.equal(boundary.uploadApproved, false);
  assert.equal(boundary.uploadExecutionApproved, false);
  assert.equal(boundary.uploadExecutionAllowed, false);
  assert.equal(boundary.mutationApprovalGranted, false);
  assert.equal(boundary.clientCreated, false);
  assert.equal(boundary.adapterInjected, false);
  assert.equal(boundary.artifactBytesProvided, false);
  assert.equal(boundary.writeTokenIssued, false);
  assert.equal(boundary.executionLeaseCreated, false);
  assert.equal(boundary.rollbackPlanCreated, false);
  assert.equal(boundary.auditRecordCreated, false);
  assert.equal(boundary.objectWriteAttempted, false);
  assert.equal(boundary.metadataIndexWriteAttempted, false);
  assert.equal(boundary.remoteMutationPerformed, false);
  assert.equal(boundary.uploadCommand, null);
  assert.equal(boundary.authorizationBoundary.authorizationGranted, false);
  assert.equal(boundary.authorizationBoundary.executionAuthorizationGranted, false);
  assert.equal(boundary.authorizationBoundary.approvalGranted, false);
  assert.equal(boundary.authorizationBoundary.uploadApproved, false);
  assert.equal(boundary.authorizationBoundary.uploadExecutionApproved, false);
  assert.equal(boundary.authorizationBoundary.uploadExecutionAllowed, false);
  assert.equal(boundary.authorizationBoundary.mutationApprovalGranted, false);
  assert.equal(boundary.authorizationBoundary.executable, false);
  assert.equal(boundary.authorizationBoundary.objectWriteAllowed, false);
  assert.equal(boundary.authorizationBoundary.metadataIndexWriteAllowed, false);
  assert.equal(boundary.authorizationBoundary.objectWriteAttempted, false);
  assert.equal(boundary.authorizationBoundary.metadataIndexWriteAttempted, false);
  assert.equal(boundary.authorizationBoundary.remoteMutationPerformed, false);
  assert.equal(boundary.executionBoundary.executable, false);
  assert.equal(boundary.executionBoundary.artifactBytesProvided, false);
  assert.equal(boundary.executionBoundary.adapterInjected, false);
  assert.equal(boundary.executionBoundary.clientCreated, false);
  assert.equal(boundary.executionBoundary.credentialValuesRead, false);
  assert.equal(boundary.executionBoundary.credentialValuesExposed, false);
  assert.equal(boundary.executionBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.executionBoundary.credentialPresenceResultExposed, false);
  assert.equal(boundary.executionBoundary.liveCheckAllowed, false);
  assert.equal(boundary.executionBoundary.liveCheckPerformed, false);
  assert.equal(boundary.executionBoundary.liveCheckResultExposed, false);
  assert.equal(boundary.executionBoundary.uploadCommandGenerated, false);
  assert.equal(boundary.executionBoundary.uploadCommandMaterialized, false);
  assert.equal(boundary.executionBoundary.uploadCommandExposed, false);
  assert.equal(boundary.executionBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.executionBoundary.metadataIndexBound, false);
  assert.equal(boundary.executionBoundary.objectStoreHandleExposed, false);
  assert.equal(boundary.executionBoundary.metadataIndexHandleExposed, false);
  assert.equal(boundary.executionBoundary.objectWriteAllowed, false);
  assert.equal(boundary.executionBoundary.metadataIndexWriteAllowed, false);
  assert.equal(boundary.executionBoundary.objectWriteAttempted, false);
  assert.equal(boundary.executionBoundary.metadataIndexWriteAttempted, false);
  assert.equal(boundary.executionBoundary.writeTokenIssued, false);
  assert.equal(boundary.executionBoundary.executionLeaseCreated, false);
  assert.equal(boundary.executionBoundary.rollbackPlanCreated, false);
  assert.equal(boundary.executionBoundary.auditRecordCreated, false);
  assert.equal(boundary.executionBoundary.remoteMutationPerformed, false);
}

function blockerCodes(boundary) {
  return new Set(boundary.readiness.blockerCodes);
}

test('upload execution authorization boundary models explicit authorization without enabling execution', async () => {
  const executionApprovalRecord = await validExecutionApprovalRecord();
  const boundary = buildKnowledgeTeamUploadExecutionAuthorizationBoundary({
    executionApprovalRecord
  });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-execution-authorization-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'upload-execution-authorization-boundary-dry-run');
  assert.equal(boundary.status, 'upload-execution-authorization-boundary-ready', JSON.stringify(boundary.readiness.blockers));
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.target.manifestId, executionApprovalRecord.target.manifestId);
  assert.equal(boundary.target.objectKeyRedacted, true);
  assert.equal(Object.hasOwn(boundary.target, 'objectKey'), false);
  assert.equal(boundary.target.objectSha256, executionApprovalRecord.target.objectSha256);
  assert.equal(boundary.target.artifactId, executionApprovalRecord.target.artifactId);
  assert.equal(boundary.sourceApprovalRecord.recordStatus, 'upload-execution-approval-record-ready');
  assert.equal(boundary.sourceApprovalRecord.recordKind, 'human-upload-execution-approval-record-dry-run');
  assert.equal(boundary.sourceApprovalRecord.recordNextAction, 'design-upload-execution-authorization-boundary');
  assert.equal(boundary.sourceApprovalRecord.sourceApprovalRequestStatus, 'upload-execution-approval-request-ready');
  assert.equal(boundary.sourceApprovalRecord.sourceApprovalRequestNextAction, 'record-human-upload-execution-approval');
  assert.equal(boundary.sourceApprovalRecord.sourceExecutionReadinessStatus, 'upload-execution-readiness-boundary-ready');
  assert.equal(boundary.sourceApprovalRecord.sourceExecutionReadinessNextAction, 'request-separate-upload-execution-approval');
  assert.equal(boundary.sourceApprovalRecord.reviewStatus, 'review-ready');
  assert.equal(boundary.sourceApprovalRecord.scopeMatched, true);
  assert.equal(boundary.sourceApprovalRecord.humanReviewRecorded, true);
  assert.equal(boundary.sourceApprovalRecord.sourceFingerprintVerified, true);
  assert.equal(boundary.sourceApprovalRecord.sourceArtifactFingerprintVerified, true);
  assert.equal(boundary.sourceApprovalRecord.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceApprovalRecord.requestIssued, true);
  assert.equal(boundary.sourceApprovalRecord.requestHumanApprovalRecorded, false);
  assert.equal(boundary.sourceApprovalRecord.requestApprovalGranted, false);
  assert.equal(boundary.sourceApprovalRecord.requestFingerprintVerified, false);
  assert.equal(boundary.sourceApprovalRecord.humanApprovalRecorded, true);
  assert.equal(boundary.sourceApprovalRecord.approvalFingerprintVerified, true);
  assert.equal(boundary.sourceApprovalRecord.approvalGranted, false);
  assert.equal(boundary.sourceApprovalRecord.requestFingerprint.value, executionApprovalRecord.sourceApprovalRequest.requestFingerprint.value);
  assert.equal(boundary.sourceApprovalRecord.requestFingerprint.canonicalFieldCount, 16);
  assert.equal(boundary.sourceApprovalRecord.sourceRequestFingerprint.value, executionApprovalRecord.approvalRecord.sourceRequestFingerprint.value);
  assert.equal(boundary.sourceApprovalRecord.recordFingerprint.value, executionApprovalRecord.approvalRecord.recordFingerprint.value);
  assert.equal(boundary.sourceApprovalRecord.recordFingerprint.canonicalFieldCount, 14);
  assert.equal(boundary.authorizationBoundary.uploadExecutionAuthorizationRequired, true);
  assert.equal(boundary.authorizationBoundary.humanApprovalRecorded, true);
  assert.equal(boundary.authorizationBoundary.approvalFingerprintVerified, true);
  assert.equal(boundary.authorizationBoundary.authorizationBoundaryDesigned, true);
  assert.equal(boundary.authorizationBoundary.sourceApprovalRecordFingerprint.value, executionApprovalRecord.approvalRecord.recordFingerprint.value);
  assert.equal(boundary.authorizationBoundary.authorizationBoundaryFingerprint.algorithm, 'sha256');
  assert.equal(boundary.authorizationBoundary.authorizationBoundaryFingerprint.scope, 'stage-knowledge-pack-upload-execution-authorization-boundary-v1');
  assert.equal(/^[a-f0-9]{64}$/.test(boundary.authorizationBoundary.authorizationBoundaryFingerprint.value), true);
  assert.equal(boundary.authorizationBoundary.authorizationBoundaryFingerprint.canonicalFieldCount, 16);
  assert.equal(boundary.readiness.status, 'upload-execution-authorization-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'await-plan-rules-update-for-upload-execution');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assertNoPrivateValues(boundary);
});

test('upload execution authorization boundary blocks non-ready source approval records', async () => {
  const executionApprovalRecord = await validExecutionApprovalRecord();
  const boundary = buildKnowledgeTeamUploadExecutionAuthorizationBoundary({
    executionApprovalRecord: {
      ...executionApprovalRecord,
      status: 'blocked',
      readiness: {
        ...executionApprovalRecord.readiness,
        status: 'blocked',
        nextAction: 'resolve-blockers',
        blockerCount: 1,
        blockerCodes: ['upload-command-present'],
        blockers: [{
          code: 'upload-command-present',
          path: '$.uploadCommand',
          message: 'blocked'
        }]
      }
    }
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.authorizationBoundary.humanApprovalRecorded, false);
  assert.equal(boundary.authorizationBoundary.approvalFingerprintVerified, false);
  assert.equal(boundary.authorizationBoundary.authorizationBoundaryDesigned, false);
  assert.equal(boundary.authorizationBoundary.authorizationBoundaryFingerprint.value, null);
  assert.equal(boundary.readiness.nextAction, 'resolve-blockers');
  assert.equal(codes.has('execution-approval-record-not-ready'), true);
  assert.equal(codes.has('execution-approval-record-next-action-invalid'), true);
  assertExecutionDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload execution authorization boundary blocks primitive private inputs without copying values', () => {
  const boundary = buildKnowledgeTeamUploadExecutionAuthorizationBoundary({
    executionApprovalRecord: 'https://should-not-copy.example.test/private-key'
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('invalid-execution-approval-record-kind'), true);
  assert.equal(codes.has('backend-detail-leak'), true);
  assertExecutionDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload execution authorization boundary blocks malformed source shape and unsafe references', async () => {
  const executionApprovalRecord = await validExecutionApprovalRecord();
  const boundary = buildKnowledgeTeamUploadExecutionAuthorizationBoundary({
    executionApprovalRecord: {
      ...executionApprovalRecord,
      kind: 'wrong-kind',
      schemaVersion: 2,
      recordKind: 'wrong-record',
      target: {
        manifestId: 'unsafe-id',
        objectKey: 'team-artifacts/public-reference/aa/bb/private-key.json',
        objectKeyRedacted: false,
        objectSha256: 'not-a-sha',
        artifactId: 'unsafe-artifact-id'
      },
      sourceApprovalRequest: {
        ...executionApprovalRecord.sourceApprovalRequest,
        adapterName: 'unsafe adapter name',
        adapterBackendKind: 's3-compatible',
        reviewStatus: 'blocked',
        scopeMatched: false,
        sourceFingerprintVerified: false
      },
      approvalRecord: {
        ...executionApprovalRecord.approvalRecord,
        recordFingerprint: {
          algorithm: 'md5',
          scope: 'unsupported-scope',
          value: null,
          canonicalFieldCount: 1
        }
      },
      readiness: {
        ...executionApprovalRecord.readiness,
        nextAction: 'execute-upload'
      }
    }
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('invalid-execution-approval-record-kind'), true);
  assert.equal(codes.has('invalid-schema-version'), true);
  assert.equal(codes.has('invalid-record-kind'), true);
  assert.equal(codes.has('execution-approval-record-next-action-invalid'), true);
  assert.equal(codes.has('unsafe-artifact-reference'), true);
  assert.equal(codes.has('unsafe-adapter-name'), true);
  assert.equal(codes.has('unsupported-adapter-backend'), true);
  assert.equal(codes.has('review-fingerprint-unverified'), true);
  assert.equal(codes.has('scope-not-matched'), true);
  assert.equal(codes.has('approval-record-fingerprint-unsupported'), true);
  assert.equal(codes.has('approval-record-fingerprint-missing'), true);
  assertExecutionDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload execution authorization boundary blocks forged grants and execution flags', async () => {
  const executionApprovalRecord = await validExecutionApprovalRecord();
  const boundary = buildKnowledgeTeamUploadExecutionAuthorizationBoundary({
    executionApprovalRecord: {
      ...executionApprovalRecord,
      liveCheckAllowed: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      uploadApproved: true,
      uploadExecutionApproved: true,
      uploadExecutionAllowed: true,
      mutationApprovalGranted: true,
      clientCreated: true,
      adapterInjected: true,
      artifactBytesProvided: true,
      writeTokenIssued: true,
      executionLeaseCreated: true,
      rollbackPlanCreated: true,
      auditRecordCreated: true,
      objectWriteAttempted: true,
      metadataIndexWriteAttempted: true,
      remoteMutationPerformed: true,
      uploadCommand: {
        redacted: true
      },
      approvalRecord: {
        ...executionApprovalRecord.approvalRecord,
        approvalGranted: true,
        uploadApproved: true,
        uploadExecutionApproved: true,
        uploadExecutionAllowed: true,
        mutationApprovalGranted: true
      },
      executionBoundary: {
        ...executionApprovalRecord.executionBoundary,
        executable: true,
        objectWriteAllowed: true,
        metadataIndexWriteAllowed: true,
        remoteMutationPerformed: true
      }
    }
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('upload-approval-already-provided'), true);
  assert.equal(codes.has('upload-execution-approval-already-provided'), true);
  assert.equal(codes.has('upload-execution-enabled'), true);
  assert.equal(codes.has('mutation-approval-already-granted'), true);
  assert.equal(codes.has('client-created'), true);
  assert.equal(codes.has('adapter-injected'), true);
  assert.equal(codes.has('artifact-bytes-provided'), true);
  assert.equal(codes.has('write-token-issued'), true);
  assert.equal(codes.has('execution-lease-created'), true);
  assert.equal(codes.has('rollback-plan-created'), true);
  assert.equal(codes.has('audit-record-created'), true);
  assert.equal(codes.has('object-write-attempted'), true);
  assert.equal(codes.has('metadata-index-write-attempted'), true);
  assert.equal(codes.has('remote-mutation-performed'), true);
  assert.equal(codes.has('live-check-enabled'), true);
  assert.equal(codes.has('credential-values-exposed'), true);
  assert.equal(codes.has('credential-presence-check-enabled'), true);
  assert.equal(codes.has('upload-command-present'), true);
  assert.equal(codes.has('authorization-already-granted'), true);
  assert.equal(codes.has('executable-state-enabled'), true);
  assert.equal(codes.has('remote-write-enabled'), true);
  assertExecutionDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload execution authorization boundary blocks leaky materialized execution data', async () => {
  const executionApprovalRecord = await validExecutionApprovalRecord();
  const boundary = buildKnowledgeTeamUploadExecutionAuthorizationBoundary({
    executionApprovalRecord: {
      ...executionApprovalRecord,
      credentialPresenceResultValue: 'credential-secret-value',
      liveCheckResultPayload: 'private-live-check-output',
      uploadCommandLine: 'aws s3 cp ./artifact s3://private-bucket/key',
      objectStoreHandleValue: { putObject: true },
      metadataIndexHandleValue: { putEntry: true },
      artifactBytesBase64: 'raw-artifact-bytes',
      executionAuthorizationValue: 'authorization-secret-value',
      signedAuthorization: 'Bearer authorization-secret-value',
      backendEndpointUrl: 'https://should-not-copy.example.test',
      auditCommand: 'curl https://should-not-copy.example.test/audit'
    }
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('credential-dependency-leak'), true);
  assert.equal(codes.has('live-check-enabled'), true);
  assert.equal(codes.has('upload-command-present'), true);
  assert.equal(codes.has('object-store-handle-leak'), true);
  assert.equal(codes.has('metadata-index-handle-leak'), true);
  assert.equal(codes.has('artifact-bytes-provided'), true);
  assert.equal(codes.has('authorization-material-leak'), true);
  assert.equal(codes.has('backend-detail-leak'), true);
  assertExecutionDisabled(boundary);
  assertNoPrivateValues(boundary);
});
