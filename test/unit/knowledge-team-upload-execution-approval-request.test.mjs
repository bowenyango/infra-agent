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

function assertExecutionDisabled(request) {
  assert.equal(request.mutationAllowed, false);
  assert.equal(request.executionMode, 'dry-run');
  assert.equal(request.remoteWriteAllowed, false);
  assert.equal(request.liveCheckAllowed, false);
  assert.equal(request.credentialValuesExposed, false);
  assert.equal(request.credentialPresenceChecked, false);
  assert.equal(request.uploadApproved, false);
  assert.equal(request.uploadExecutionApproved, false);
  assert.equal(request.uploadExecutionAllowed, false);
  assert.equal(request.mutationApprovalGranted, false);
  assert.equal(request.clientCreated, false);
  assert.equal(request.adapterInjected, false);
  assert.equal(request.artifactBytesProvided, false);
  assert.equal(request.writeTokenIssued, false);
  assert.equal(request.executionLeaseCreated, false);
  assert.equal(request.rollbackPlanCreated, false);
  assert.equal(request.auditRecordCreated, false);
  assert.equal(request.objectWriteAttempted, false);
  assert.equal(request.metadataIndexWriteAttempted, false);
  assert.equal(request.remoteMutationPerformed, false);
  assert.equal(request.uploadCommand, null);
  assert.equal(request.approvalRequest.humanApprovalRecorded, false);
  assert.equal(request.approvalRequest.approvalGranted, false);
  assert.equal(request.approvalRequest.fingerprintVerified, false);
  assert.equal(request.approvalRequest.approvalSource, null);
  assert.equal(request.approvalRequest.suppliedFingerprint, null);
  assert.equal(request.approvalRequest.uploadApproved, false);
  assert.equal(request.approvalRequest.uploadExecutionApproved, false);
  assert.equal(request.approvalRequest.uploadExecutionAllowed, false);
  assert.equal(request.approvalRequest.mutationApprovalGranted, false);
  assert.equal(request.executionBoundary.executable, false);
  assert.equal(request.executionBoundary.artifactBytesProvided, false);
  assert.equal(request.executionBoundary.adapterInjected, false);
  assert.equal(request.executionBoundary.clientCreated, false);
  assert.equal(request.executionBoundary.credentialValuesRead, false);
  assert.equal(request.executionBoundary.credentialValuesExposed, false);
  assert.equal(request.executionBoundary.credentialPresenceChecked, false);
  assert.equal(request.executionBoundary.credentialPresenceResultExposed, false);
  assert.equal(request.executionBoundary.liveCheckAllowed, false);
  assert.equal(request.executionBoundary.liveCheckPerformed, false);
  assert.equal(request.executionBoundary.liveCheckResultExposed, false);
  assert.equal(request.executionBoundary.uploadCommandGenerated, false);
  assert.equal(request.executionBoundary.uploadCommandMaterialized, false);
  assert.equal(request.executionBoundary.uploadCommandExposed, false);
  assert.equal(request.executionBoundary.artifactObjectStoreBound, false);
  assert.equal(request.executionBoundary.metadataIndexBound, false);
  assert.equal(request.executionBoundary.objectStoreHandleExposed, false);
  assert.equal(request.executionBoundary.metadataIndexHandleExposed, false);
  assert.equal(request.executionBoundary.objectWriteAllowed, false);
  assert.equal(request.executionBoundary.metadataIndexWriteAllowed, false);
  assert.equal(request.executionBoundary.objectWriteAttempted, false);
  assert.equal(request.executionBoundary.metadataIndexWriteAttempted, false);
  assert.equal(request.executionBoundary.writeTokenIssued, false);
  assert.equal(request.executionBoundary.executionLeaseCreated, false);
  assert.equal(request.executionBoundary.rollbackPlanCreated, false);
  assert.equal(request.executionBoundary.auditRecordCreated, false);
  assert.equal(request.executionBoundary.remoteMutationPerformed, false);
}

function blockerCodes(request) {
  return new Set(request.readiness.blockerCodes);
}

test('upload execution approval request records deterministic dry-run approval request', async () => {
  const executionReadinessBoundary = await validExecutionReadinessBoundary();
  const request = buildKnowledgeTeamUploadExecutionApprovalRequest({ executionReadinessBoundary });

  assert.equal(request.kind, 'infra-agent.knowledge-team-upload-execution-approval-request');
  assert.equal(request.schemaVersion, 1);
  assert.equal(request.requestKind, 'upload-execution-approval-request-dry-run');
  assert.equal(request.status, 'upload-execution-approval-request-ready', JSON.stringify(request.readiness.blockers));
  assert.equal(request.plannedOperation, 'stage-knowledge-pack');
  assertExecutionDisabled(request);
  assert.equal(request.target.manifestId, executionReadinessBoundary.target.manifestId);
  assert.equal(request.target.objectKeyRedacted, true);
  assert.equal(Object.hasOwn(request.target, 'objectKey'), false);
  assert.equal(request.target.objectSha256, executionReadinessBoundary.target.objectSha256);
  assert.equal(request.target.artifactId, executionReadinessBoundary.target.artifactId);
  assert.equal(request.sourceExecutionReadinessBoundary.source, 'upload-execution-readiness-boundary');
  assert.equal(request.sourceExecutionReadinessBoundary.boundaryStatus, 'upload-execution-readiness-boundary-ready');
  assert.equal(request.sourceExecutionReadinessBoundary.boundaryKind, 'upload-execution-readiness-boundary-dry-run');
  assert.equal(request.sourceExecutionReadinessBoundary.boundaryNextAction, 'request-separate-upload-execution-approval');
  assert.equal(request.sourceExecutionReadinessBoundary.reviewStatus, 'review-ready');
  assert.equal(request.sourceExecutionReadinessBoundary.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(request.sourceExecutionReadinessBoundary.scopeMatched, true);
  assert.equal(request.sourceExecutionReadinessBoundary.humanReviewRecorded, true);
  assert.equal(request.sourceExecutionReadinessBoundary.fingerprintVerified, true);
  assert.equal(request.sourceExecutionReadinessBoundary.sourceFingerprintVerified, true);
  assert.equal(request.sourceExecutionReadinessBoundary.adapterName, 'mock-team-cache');
  assert.equal(request.sourceExecutionReadinessBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(request.sourceExecutionReadinessBoundary.executionReadinessModeled, true);
  assert.equal(request.sourceExecutionReadinessBoundary.separateExecutionApprovalRequired, true);
  assert.equal(request.sourceExecutionReadinessBoundary.objectWriteRequiresExecutionApproval, true);
  assert.equal(request.sourceExecutionReadinessBoundary.metadataIndexWriteRequiresExecutionApproval, true);
  assert.equal(request.sourceExecutionReadinessBoundary.uploadExecutionAllowed, false);
  assert.equal(request.sourceExecutionReadinessBoundary.objectWriteAllowed, false);
  assert.equal(request.sourceExecutionReadinessBoundary.metadataIndexWriteAllowed, false);
  assert.equal(request.approvalRequest.uploadExecutionApprovalRequired, true);
  assert.equal(request.approvalRequest.humanApprovalRequired, true);
  assert.equal(request.approvalRequest.requestIssued, true);
  assert.equal(request.approvalRequest.source, 'execution-readiness-boundary');
  assert.equal(request.approvalRequest.fingerprint.algorithm, 'sha256');
  assert.equal(request.approvalRequest.fingerprint.scope, 'stage-knowledge-pack-upload-execution-approval-request-v1');
  assert.equal(/^[a-f0-9]{64}$/.test(request.approvalRequest.fingerprint.value), true);
  assert.equal(request.approvalRequest.fingerprint.canonicalFieldCount, 16);
  assert.equal(request.readiness.status, 'upload-execution-approval-request-ready');
  assert.equal(request.readiness.nextAction, 'record-human-upload-execution-approval');
  assert.equal(request.readiness.blockerCount, 0);
  assert.deepEqual(request.readiness.blockerCodes, []);
  assertNoPrivateValues(request);
});

test('upload execution approval request blocks non-ready execution readiness boundaries', async () => {
  const executionReadinessBoundary = await validExecutionReadinessBoundary();
  const request = buildKnowledgeTeamUploadExecutionApprovalRequest({
    executionReadinessBoundary: {
      ...executionReadinessBoundary,
      status: 'blocked',
      readiness: {
        ...executionReadinessBoundary.readiness,
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

  const codes = blockerCodes(request);
  assert.equal(request.status, 'blocked');
  assert.equal(request.approvalRequest.requestIssued, false);
  assert.equal(request.approvalRequest.fingerprint.value, null);
  assert.equal(request.readiness.nextAction, 'resolve-blockers');
  assert.equal(codes.has('execution-readiness-boundary-not-ready'), true);
  assert.equal(codes.has('execution-readiness-boundary-next-action-invalid'), true);
  assertExecutionDisabled(request);
  assertNoPrivateValues(request);
});

test('upload execution approval request blocks primitive private inputs without copying values', () => {
  const request = buildKnowledgeTeamUploadExecutionApprovalRequest({
    executionReadinessBoundary: 'https://should-not-copy.example.test/private-key'
  });

  const codes = blockerCodes(request);
  assert.equal(request.status, 'blocked');
  assert.equal(request.approvalRequest.requestIssued, false);
  assert.equal(codes.has('invalid-execution-readiness-boundary-kind'), true);
  assert.equal(codes.has('backend-detail-leak'), true);
  assertExecutionDisabled(request);
  assertNoPrivateValues(request);
});

test('upload execution approval request blocks malformed source shape and unsafe references', async () => {
  const executionReadinessBoundary = await validExecutionReadinessBoundary();
  const request = buildKnowledgeTeamUploadExecutionApprovalRequest({
    executionReadinessBoundary: {
      ...executionReadinessBoundary,
      kind: 'wrong-kind',
      schemaVersion: 2,
      boundaryKind: 'wrong-boundary',
      target: {
        manifestId: 'unsafe-id',
        objectKey: 'team-artifacts/public-reference/aa/bb/private-key.json',
        objectKeyRedacted: false,
        objectSha256: 'not-a-sha',
        artifactId: 'unsafe-artifact-id'
      },
      sourceObjectIndexBindingBoundary: {
        ...executionReadinessBoundary.sourceObjectIndexBindingBoundary,
        adapterName: 'unsafe adapter name',
        adapterBackendKind: 's3-compatible',
        reviewStatus: 'blocked',
        scopeMatched: false,
        fingerprintVerified: false
      },
      readiness: {
        ...executionReadinessBoundary.readiness,
        nextAction: 'execute-upload'
      }
    }
  });

  const codes = blockerCodes(request);
  assert.equal(request.status, 'blocked');
  assert.equal(request.approvalRequest.requestIssued, false);
  assert.equal(codes.has('invalid-execution-readiness-boundary-kind'), true);
  assert.equal(codes.has('invalid-schema-version'), true);
  assert.equal(codes.has('invalid-request-kind'), true);
  assert.equal(codes.has('execution-readiness-boundary-next-action-invalid'), true);
  assert.equal(codes.has('unsafe-artifact-reference'), true);
  assert.equal(codes.has('unsafe-adapter-name'), true);
  assert.equal(codes.has('unsupported-adapter-backend'), true);
  assert.equal(codes.has('review-fingerprint-unverified'), true);
  assertExecutionDisabled(request);
  assertNoPrivateValues(request);
});

test('upload execution approval request blocks missing sections and forged execution flags', async () => {
  const executionReadinessBoundary = await validExecutionReadinessBoundary();
  const request = buildKnowledgeTeamUploadExecutionApprovalRequest({
    executionReadinessBoundary: {
      ...executionReadinessBoundary,
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
      sourceObjectIndexBindingBoundary: null,
      uploadExecutionReadinessBoundary: null,
      remainingExecutionBoundaries: null
    }
  });

  const codes = blockerCodes(request);
  assert.equal(request.status, 'blocked');
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
  assertExecutionDisabled(request);
  assertNoPrivateValues(request);
});

test('upload execution approval request blocks leaky materialized execution data', async () => {
  const executionReadinessBoundary = await validExecutionReadinessBoundary();
  const request = buildKnowledgeTeamUploadExecutionApprovalRequest({
    executionReadinessBoundary: {
      ...executionReadinessBoundary,
      credentialPresenceResultValue: 'credential-secret-value',
      liveCheckResultPayload: 'private-live-check-output',
      uploadCommandLine: 'aws s3 cp ./artifact s3://private-bucket/key',
      objectStoreHandleValue: { putObject: true },
      metadataIndexHandleValue: { putEntry: true },
      artifactBytesBase64: 'raw-artifact-bytes',
      backendEndpointUrl: 'https://should-not-copy.example.test',
      auditCommand: 'curl https://should-not-copy.example.test/audit'
    }
  });

  const codes = blockerCodes(request);
  assert.equal(request.status, 'blocked');
  assert.equal(codes.has('credential-dependency-leak'), true);
  assert.equal(codes.has('live-check-enabled'), true);
  assert.equal(codes.has('upload-command-present'), true);
  assert.equal(codes.has('object-store-handle-leak'), true);
  assert.equal(codes.has('metadata-index-handle-leak'), true);
  assert.equal(codes.has('artifact-bytes-provided'), true);
  assert.equal(codes.has('backend-detail-leak'), true);
  assertExecutionDisabled(request);
  assertNoPrivateValues(request);
});
