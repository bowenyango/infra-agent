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
  buildKnowledgeTeamArtifactContractFixture
} from '../support/knowledge-team-artifact-fixtures.mjs';

function validBackendReferenceSummary() {
  return validateKnowledgeTeamS3CompatibleBackendReferences(
    buildKnowledgeTeamS3CompatibleBackendConfig(),
    buildKnowledgeTeamS3CompatibleReferenceRegistry()
  );
}

async function validExecutionApprovalRequest() {
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
    'team-artifacts/public-reference/aa/bb/private-key.json'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

function assertExecutionDisabled(record) {
  assert.equal(record.mutationAllowed, false);
  assert.equal(record.executionMode, 'dry-run');
  assert.equal(record.remoteWriteAllowed, false);
  assert.equal(record.liveCheckAllowed, false);
  assert.equal(record.credentialValuesExposed, false);
  assert.equal(record.credentialPresenceChecked, false);
  assert.equal(record.uploadApproved, false);
  assert.equal(record.uploadExecutionApproved, false);
  assert.equal(record.uploadExecutionAllowed, false);
  assert.equal(record.mutationApprovalGranted, false);
  assert.equal(record.clientCreated, false);
  assert.equal(record.adapterInjected, false);
  assert.equal(record.artifactBytesProvided, false);
  assert.equal(record.writeTokenIssued, false);
  assert.equal(record.executionLeaseCreated, false);
  assert.equal(record.rollbackPlanCreated, false);
  assert.equal(record.auditRecordCreated, false);
  assert.equal(record.objectWriteAttempted, false);
  assert.equal(record.metadataIndexWriteAttempted, false);
  assert.equal(record.remoteMutationPerformed, false);
  assert.equal(record.uploadCommand, null);
  assert.equal(record.approvalRecord.approvalGranted, false);
  assert.equal(record.approvalRecord.uploadApproved, false);
  assert.equal(record.approvalRecord.uploadExecutionApproved, false);
  assert.equal(record.approvalRecord.uploadExecutionAllowed, false);
  assert.equal(record.approvalRecord.mutationApprovalGranted, false);
  assert.equal(record.executionBoundary.executable, false);
  assert.equal(record.executionBoundary.artifactBytesProvided, false);
  assert.equal(record.executionBoundary.adapterInjected, false);
  assert.equal(record.executionBoundary.clientCreated, false);
  assert.equal(record.executionBoundary.credentialValuesRead, false);
  assert.equal(record.executionBoundary.credentialValuesExposed, false);
  assert.equal(record.executionBoundary.credentialPresenceChecked, false);
  assert.equal(record.executionBoundary.credentialPresenceResultExposed, false);
  assert.equal(record.executionBoundary.liveCheckAllowed, false);
  assert.equal(record.executionBoundary.liveCheckPerformed, false);
  assert.equal(record.executionBoundary.liveCheckResultExposed, false);
  assert.equal(record.executionBoundary.uploadCommandGenerated, false);
  assert.equal(record.executionBoundary.uploadCommandMaterialized, false);
  assert.equal(record.executionBoundary.uploadCommandExposed, false);
  assert.equal(record.executionBoundary.artifactObjectStoreBound, false);
  assert.equal(record.executionBoundary.metadataIndexBound, false);
  assert.equal(record.executionBoundary.objectStoreHandleExposed, false);
  assert.equal(record.executionBoundary.metadataIndexHandleExposed, false);
  assert.equal(record.executionBoundary.objectWriteAllowed, false);
  assert.equal(record.executionBoundary.metadataIndexWriteAllowed, false);
  assert.equal(record.executionBoundary.objectWriteAttempted, false);
  assert.equal(record.executionBoundary.metadataIndexWriteAttempted, false);
  assert.equal(record.executionBoundary.writeTokenIssued, false);
  assert.equal(record.executionBoundary.executionLeaseCreated, false);
  assert.equal(record.executionBoundary.rollbackPlanCreated, false);
  assert.equal(record.executionBoundary.auditRecordCreated, false);
  assert.equal(record.executionBoundary.remoteMutationPerformed, false);
}

function blockerCodes(record) {
  return new Set(record.readiness.blockerCodes);
}

test('upload execution approval record records matching human fingerprint without granting execution', async () => {
  const executionApprovalRequest = await validExecutionApprovalRequest();
  const approvalFingerprint = executionApprovalRequest.approvalRequest.fingerprint.value;
  const record = buildKnowledgeTeamUploadExecutionApprovalRecord({
    executionApprovalRequest,
    approvalFingerprint
  });

  assert.equal(record.kind, 'infra-agent.knowledge-team-upload-execution-approval-record');
  assert.equal(record.schemaVersion, 1);
  assert.equal(record.recordKind, 'human-upload-execution-approval-record-dry-run');
  assert.equal(record.status, 'upload-execution-approval-record-ready', JSON.stringify(record.readiness.blockers));
  assert.equal(record.plannedOperation, 'stage-knowledge-pack');
  assertExecutionDisabled(record);
  assert.equal(record.target.manifestId, executionApprovalRequest.target.manifestId);
  assert.equal(record.target.objectKeyRedacted, true);
  assert.equal(Object.hasOwn(record.target, 'objectKey'), false);
  assert.equal(record.target.objectSha256, executionApprovalRequest.target.objectSha256);
  assert.equal(record.target.artifactId, executionApprovalRequest.target.artifactId);
  assert.equal(record.sourceApprovalRequest.requestStatus, 'upload-execution-approval-request-ready');
  assert.equal(record.sourceApprovalRequest.requestKind, 'upload-execution-approval-request-dry-run');
  assert.equal(record.sourceApprovalRequest.requestNextAction, 'record-human-upload-execution-approval');
  assert.equal(record.sourceApprovalRequest.requestIssued, true);
  assert.equal(record.sourceApprovalRequest.requestHumanApprovalRecorded, false);
  assert.equal(record.sourceApprovalRequest.requestApprovalGranted, false);
  assert.equal(record.sourceApprovalRequest.requestFingerprintVerified, false);
  assert.equal(record.sourceApprovalRequest.sourceExecutionReadinessStatus, 'upload-execution-readiness-boundary-ready');
  assert.equal(record.sourceApprovalRequest.reviewStatus, 'review-ready');
  assert.equal(record.sourceApprovalRequest.scopeMatched, true);
  assert.equal(record.sourceApprovalRequest.humanReviewRecorded, true);
  assert.equal(record.sourceApprovalRequest.sourceFingerprintVerified, true);
  assert.equal(record.sourceApprovalRequest.sourceArtifactFingerprintVerified, true);
  assert.equal(record.sourceApprovalRequest.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(record.sourceApprovalRequest.executionReadinessModeled, true);
  assert.equal(record.sourceApprovalRequest.separateExecutionApprovalRequired, true);
  assert.equal(record.sourceApprovalRequest.objectWriteRequiresExecutionApproval, true);
  assert.equal(record.sourceApprovalRequest.metadataIndexWriteRequiresExecutionApproval, true);
  assert.equal(record.sourceApprovalRequest.requestFingerprint.algorithm, 'sha256');
  assert.equal(record.sourceApprovalRequest.requestFingerprint.scope, 'stage-knowledge-pack-upload-execution-approval-request-v1');
  assert.equal(record.sourceApprovalRequest.requestFingerprint.value, approvalFingerprint);
  assert.equal(record.sourceApprovalRequest.requestFingerprint.canonicalFieldCount, 16);
  assert.equal(record.approvalRecord.uploadExecutionApprovalRequired, true);
  assert.equal(record.approvalRecord.humanApprovalRequired, true);
  assert.equal(record.approvalRecord.humanApprovalRecorded, true);
  assert.equal(record.approvalRecord.source, 'cli-flag');
  assert.equal(record.approvalRecord.suppliedFingerprint, approvalFingerprint);
  assert.equal(record.approvalRecord.expectedFingerprint, approvalFingerprint);
  assert.equal(record.approvalRecord.fingerprintVerified, true);
  assert.equal(record.approvalRecord.sourceRequestFingerprint.value, approvalFingerprint);
  assert.equal(record.approvalRecord.recordFingerprint.algorithm, 'sha256');
  assert.equal(record.approvalRecord.recordFingerprint.scope, 'stage-knowledge-pack-upload-execution-approval-record-v1');
  assert.equal(/^[a-f0-9]{64}$/.test(record.approvalRecord.recordFingerprint.value), true);
  assert.equal(record.approvalRecord.recordFingerprint.canonicalFieldCount, 14);
  assert.equal(record.readiness.status, 'upload-execution-approval-record-ready');
  assert.equal(record.readiness.nextAction, 'design-upload-execution-authorization-boundary');
  assert.equal(record.readiness.blockerCount, 0);
  assert.deepEqual(record.readiness.blockerCodes, []);
  assertNoPrivateValues(record);
});

test('upload execution approval record blocks non-ready source approval requests', async () => {
  const executionApprovalRequest = await validExecutionApprovalRequest();
  const record = buildKnowledgeTeamUploadExecutionApprovalRecord({
    executionApprovalRequest: {
      ...executionApprovalRequest,
      status: 'blocked',
      readiness: {
        ...executionApprovalRequest.readiness,
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
    },
    approvalFingerprint: executionApprovalRequest.approvalRequest.fingerprint.value
  });

  const codes = blockerCodes(record);
  assert.equal(record.status, 'blocked');
  assert.equal(record.approvalRecord.humanApprovalRecorded, false);
  assert.equal(record.approvalRecord.fingerprintVerified, false);
  assert.equal(record.approvalRecord.recordFingerprint.value, null);
  assert.equal(record.readiness.nextAction, 'resolve-blockers');
  assert.equal(codes.has('execution-approval-request-not-ready'), true);
  assert.equal(codes.has('execution-approval-request-next-action-invalid'), true);
  assertExecutionDisabled(record);
  assertNoPrivateValues(record);
});

test('upload execution approval record blocks missing unsafe or mismatched fingerprints', async () => {
  const executionApprovalRequest = await validExecutionApprovalRequest();

  const missing = buildKnowledgeTeamUploadExecutionApprovalRecord({
    executionApprovalRequest,
    approvalFingerprint: ''
  });
  assert.equal(missing.status, 'blocked');
  assert.equal(blockerCodes(missing).has('approval-fingerprint-missing'), true);
  assert.equal(missing.approvalRecord.humanApprovalRecorded, false);

  const unsafe = buildKnowledgeTeamUploadExecutionApprovalRecord({
    executionApprovalRequest,
    approvalFingerprint: 'ABC-not-a-sha'
  });
  assert.equal(unsafe.status, 'blocked');
  assert.equal(blockerCodes(unsafe).has('unsafe-approval-fingerprint'), true);

  const mismatch = buildKnowledgeTeamUploadExecutionApprovalRecord({
    executionApprovalRequest,
    approvalFingerprint: '0'.repeat(64)
  });
  assert.equal(mismatch.status, 'blocked');
  assert.equal(blockerCodes(mismatch).has('approval-fingerprint-mismatch'), true);
  assert.equal(mismatch.approvalRecord.suppliedFingerprint, '0'.repeat(64));
  assert.equal(mismatch.approvalRecord.expectedFingerprint, executionApprovalRequest.approvalRequest.fingerprint.value);
  assert.equal(mismatch.approvalRecord.fingerprintVerified, false);
  assertExecutionDisabled(mismatch);
  assertNoPrivateValues(mismatch);
});

test('upload execution approval record blocks primitive private inputs without copying values', () => {
  const record = buildKnowledgeTeamUploadExecutionApprovalRecord({
    executionApprovalRequest: 'https://should-not-copy.example.test/private-key',
    approvalFingerprint: 'https://should-not-copy.example.test/private-key'
  });

  const codes = blockerCodes(record);
  assert.equal(record.status, 'blocked');
  assert.equal(codes.has('invalid-execution-approval-request-kind'), true);
  assert.equal(codes.has('backend-detail-leak'), true);
  assert.equal(codes.has('unsafe-approval-fingerprint'), true);
  assertExecutionDisabled(record);
  assertNoPrivateValues(record);
});

test('upload execution approval record blocks malformed source shape and unsafe references', async () => {
  const executionApprovalRequest = await validExecutionApprovalRequest();
  const record = buildKnowledgeTeamUploadExecutionApprovalRecord({
    executionApprovalRequest: {
      ...executionApprovalRequest,
      kind: 'wrong-kind',
      schemaVersion: 2,
      requestKind: 'wrong-request',
      target: {
        manifestId: 'unsafe-id',
        objectKey: 'team-artifacts/public-reference/aa/bb/private-key.json',
        objectKeyRedacted: false,
        objectSha256: 'not-a-sha',
        artifactId: 'unsafe-artifact-id'
      },
      sourceExecutionReadinessBoundary: {
        ...executionApprovalRequest.sourceExecutionReadinessBoundary,
        adapterName: 'unsafe adapter name',
        adapterBackendKind: 's3-compatible',
        reviewStatus: 'blocked',
        scopeMatched: false,
        fingerprintVerified: false
      },
      approvalRequest: {
        ...executionApprovalRequest.approvalRequest,
        fingerprint: {
          algorithm: 'md5',
          scope: 'unsupported-scope',
          value: null,
          canonicalFieldCount: 1
        }
      },
      readiness: {
        ...executionApprovalRequest.readiness,
        nextAction: 'execute-upload'
      }
    },
    approvalFingerprint: executionApprovalRequest.approvalRequest.fingerprint.value
  });

  const codes = blockerCodes(record);
  assert.equal(record.status, 'blocked');
  assert.equal(codes.has('invalid-execution-approval-request-kind'), true);
  assert.equal(codes.has('invalid-schema-version'), true);
  assert.equal(codes.has('invalid-request-kind'), true);
  assert.equal(codes.has('execution-approval-request-next-action-invalid'), true);
  assert.equal(codes.has('unsafe-artifact-reference'), true);
  assert.equal(codes.has('unsafe-adapter-name'), true);
  assert.equal(codes.has('unsupported-adapter-backend'), true);
  assert.equal(codes.has('review-fingerprint-unverified'), true);
  assert.equal(codes.has('scope-not-matched'), true);
  assert.equal(codes.has('approval-request-fingerprint-unsupported'), true);
  assert.equal(codes.has('approval-request-fingerprint-missing'), true);
  assertExecutionDisabled(record);
  assertNoPrivateValues(record);
});

test('upload execution approval record blocks missing sections and forged execution flags', async () => {
  const executionApprovalRequest = await validExecutionApprovalRequest();
  const record = buildKnowledgeTeamUploadExecutionApprovalRecord({
    executionApprovalRequest: {
      ...executionApprovalRequest,
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
      sourceExecutionReadinessBoundary: null,
      approvalRequest: null
    },
    approvalFingerprint: executionApprovalRequest.approvalRequest.fingerprint.value
  });

  const codes = blockerCodes(record);
  assert.equal(record.status, 'blocked');
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
  assert.equal(codes.has('missing-required-field'), true);
  assertExecutionDisabled(record);
  assertNoPrivateValues(record);
});

test('upload execution approval record blocks leaky materialized execution data', async () => {
  const executionApprovalRequest = await validExecutionApprovalRequest();
  const record = buildKnowledgeTeamUploadExecutionApprovalRecord({
    executionApprovalRequest: {
      ...executionApprovalRequest,
      credentialPresenceResultValue: 'credential-secret-value',
      liveCheckResultPayload: 'private-live-check-output',
      uploadCommandLine: 'aws s3 cp ./artifact s3://private-bucket/key',
      objectStoreHandleValue: { putObject: true },
      metadataIndexHandleValue: { putEntry: true },
      artifactBytesBase64: 'raw-artifact-bytes',
      backendEndpointUrl: 'https://should-not-copy.example.test',
      auditCommand: 'curl https://should-not-copy.example.test/audit'
    },
    approvalFingerprint: executionApprovalRequest.approvalRequest.fingerprint.value
  });

  const codes = blockerCodes(record);
  assert.equal(record.status, 'blocked');
  assert.equal(codes.has('credential-dependency-leak'), true);
  assert.equal(codes.has('live-check-enabled'), true);
  assert.equal(codes.has('upload-command-present'), true);
  assert.equal(codes.has('object-store-handle-leak'), true);
  assert.equal(codes.has('metadata-index-handle-leak'), true);
  assert.equal(codes.has('artifact-bytes-provided'), true);
  assert.equal(codes.has('backend-detail-leak'), true);
  assertExecutionDisabled(record);
  assertNoPrivateValues(record);
});
