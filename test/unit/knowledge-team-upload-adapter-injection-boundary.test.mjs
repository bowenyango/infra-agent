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
  buildKnowledgeTeamArtifactContractFixture
} from '../support/knowledge-team-artifact-fixtures.mjs';

function validBackendReferenceSummary() {
  return validateKnowledgeTeamS3CompatibleBackendReferences(
    buildKnowledgeTeamS3CompatibleBackendConfig(),
    buildKnowledgeTeamS3CompatibleReferenceRegistry()
  );
}

async function validArtifactBytesBoundary() {
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
  return buildKnowledgeTeamUploadArtifactBytesBoundary({ auditRecordBoundary });
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
    'adapter-secret-value',
    'raw-artifact-bytes'
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
  assert.equal(boundary.adapterInjectionBoundary.adapterInjected, false);
  assert.equal(boundary.adapterInjectionBoundary.clientCreated, false);
  assert.equal(boundary.adapterInjectionBoundary.artifactBytesProvided, false);
  assert.equal(boundary.adapterInjectionBoundary.artifactDigestVerified, false);
  assert.equal(boundary.adapterInjectionBoundary.artifactScopeBoundToArtifact, false);
  assert.equal(boundary.adapterInjectionBoundary.writeTokenIssued, false);
  assert.equal(boundary.adapterInjectionBoundary.executionLeaseCreated, false);
  assert.equal(boundary.adapterInjectionBoundary.rollbackPlanCreated, false);
  assert.equal(boundary.adapterInjectionBoundary.auditRecordCreated, false);
  assert.equal(boundary.adapterInjectionBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.adapterInjectionBoundary.metadataIndexBound, false);
  assert.equal(boundary.adapterInjectionBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.artifactBytesProvided, false);
  assert.equal(boundary.remainingExecutionBoundaries.adapterInjected, false);
  assert.equal(boundary.remainingExecutionBoundaries.clientCreated, false);
  assert.equal(boundary.remainingExecutionBoundaries.writeTokenIssued, false);
  assert.equal(boundary.remainingExecutionBoundaries.executionLeaseCreated, false);
  assert.equal(boundary.remainingExecutionBoundaries.rollbackPlanCreated, false);
  assert.equal(boundary.remainingExecutionBoundaries.auditRecordCreated, false);
  assert.equal(boundary.remainingExecutionBoundaries.objectWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.metadataIndexWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.remoteMutationAllowed, false);
}

function blockerCodes(boundary) {
  return new Set(boundary.readiness.blockerCodes);
}

test('upload adapter injection boundary records dependency requirements without injecting adapters', async () => {
  const artifactBytesBoundary = await validArtifactBytesBoundary();
  const boundary = buildKnowledgeTeamUploadAdapterInjectionBoundary({ artifactBytesBoundary });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-adapter-injection-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'adapter-injection-boundary-dry-run');
  assert.equal(boundary.status, 'adapter-injection-boundary-ready');
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.target.manifestId, artifactBytesBoundary.target.manifestId);
  assert.equal(boundary.target.objectKey, artifactBytesBoundary.target.objectKey);
  assert.equal(boundary.target.objectSha256, artifactBytesBoundary.target.objectSha256);
  assert.equal(boundary.target.artifactId, artifactBytesBoundary.target.artifactId);
  assert.equal(boundary.sourceArtifactBytesBoundary.source, 'upload-artifact-bytes-boundary');
  assert.equal(boundary.sourceArtifactBytesBoundary.boundaryStatus, 'artifact-bytes-boundary-ready');
  assert.equal(boundary.sourceArtifactBytesBoundary.boundaryKind, 'artifact-bytes-boundary-dry-run');
  assert.equal(boundary.sourceArtifactBytesBoundary.boundaryNextAction, 'design-adapter-injection-boundary');
  assert.equal(boundary.sourceArtifactBytesBoundary.reviewStatus, 'review-ready');
  assert.equal(boundary.sourceArtifactBytesBoundary.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourceArtifactBytesBoundary.scopeMatched, true);
  assert.equal(boundary.sourceArtifactBytesBoundary.humanReviewRecorded, true);
  assert.equal(boundary.sourceArtifactBytesBoundary.fingerprintVerified, true);
  assert.equal(boundary.sourceArtifactBytesBoundary.sourceFingerprintVerified, true);
  assert.equal(boundary.sourceArtifactBytesBoundary.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourceArtifactBytesBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceArtifactBytesBoundary.artifactBytesRequiredBeforeAdapter, true);
  assert.equal(boundary.sourceArtifactBytesBoundary.artifactBytesRequiredBeforeExecution, true);
  assert.equal(boundary.sourceArtifactBytesBoundary.artifactDigestRequired, true);
  assert.equal(boundary.sourceArtifactBytesBoundary.artifactScopeBindingRequired, true);
  assert.equal(boundary.sourceArtifactBytesBoundary.adapterInjectionRequiredAfterBytes, true);
  assert.equal(boundary.adapterInjectionBoundary.dryRunOnly, true);
  assert.equal(boundary.adapterInjectionBoundary.adapterInjectionRequiredBeforeExecution, true);
  assert.equal(boundary.adapterInjectionBoundary.adapterInjectionRequiredAfterBytes, true);
  assert.equal(boundary.adapterInjectionBoundary.adapterDependencyInjectionOnly, true);
  assert.equal(boundary.adapterInjectionBoundary.mockAdapterRequired, true);
  assert.equal(boundary.adapterInjectionBoundary.adapterDescriptorRequired, true);
  assert.equal(boundary.adapterInjectionBoundary.artifactObjectStoreDependencyRequired, true);
  assert.equal(boundary.adapterInjectionBoundary.metadataIndexDependencyRequired, true);
  assert.equal(boundary.adapterInjectionBoundary.contentAddressedObjectKeysRequired, true);
  assert.equal(boundary.adapterInjectionBoundary.contentAddressedIndexKeysRequired, true);
  assert.equal(boundary.adapterInjectionBoundary.idempotentWritesRequired, true);
  assert.equal(boundary.adapterInjectionBoundary.explicitUploadApprovalRequired, true);
  assert.equal(boundary.adapterInjectionBoundary.writeTokenRequiredBeforeAdapter, true);
  assert.equal(boundary.adapterInjectionBoundary.executionLeaseRequiredBeforeAdapter, true);
  assert.equal(boundary.adapterInjectionBoundary.rollbackPlanRequiredBeforeAdapter, true);
  assert.equal(boundary.adapterInjectionBoundary.auditRecordRequiredBeforeAdapter, true);
  assert.equal(boundary.remainingExecutionBoundaries.clientCreationRequired, true);
  assert.equal(boundary.readiness.status, 'adapter-injection-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-client-creation-boundary');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assertNoPrivateValues(boundary);
});

test('upload adapter injection boundary blocks non-ready artifact bytes boundaries', async () => {
  const artifactBytesBoundary = await validArtifactBytesBoundary();
  const blockedArtifactBytesBoundary = {
    ...artifactBytesBoundary,
    status: 'blocked',
    sourceAuditRecordBoundary: {
      ...artifactBytesBoundary.sourceAuditRecordBoundary,
      fingerprintVerified: false
    },
    readiness: {
      ...artifactBytesBoundary.readiness,
      status: 'blocked',
      nextAction: 'resolve-blockers',
      blockerCount: 1,
      blockerCodes: ['review-fingerprint-unverified'],
      blockers: [{
        code: 'review-fingerprint-unverified',
        path: '$.sourceArtifactBytesBoundary.fingerprintVerified',
        message: 'fingerprint not verified'
      }]
    }
  };

  const boundary = buildKnowledgeTeamUploadAdapterInjectionBoundary({
    artifactBytesBoundary: blockedArtifactBytesBoundary
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.readiness.nextAction, 'resolve-blockers');
  assert.equal(codes.has('artifact-bytes-boundary-not-ready'), true);
  assert.equal(codes.has('artifact-bytes-boundary-next-action-invalid'), true);
  assert.equal(codes.has('review-fingerprint-unverified'), true);
  assertExecutionDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload adapter injection boundary blocks invalid artifact bytes inputs', () => {
  const boundary = buildKnowledgeTeamUploadAdapterInjectionBoundary({ artifactBytesBoundary: null });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.sourceArtifactBytesBoundary.boundaryStatus, 'invalid');
  assert.equal(codes.has('missing-required-field'), true);
  assertExecutionDisabled(boundary);
});

test('upload adapter injection boundary blocks malformed artifact bytes metadata', async () => {
  const artifactBytesBoundary = await validArtifactBytesBoundary();
  const boundary = buildKnowledgeTeamUploadAdapterInjectionBoundary({
    artifactBytesBoundary: {
      ...artifactBytesBoundary,
      kind: 'infra-agent.knowledge-team-upload-audit-record-boundary',
      schemaVersion: 2,
      boundaryKind: 'audit-record-boundary-dry-run',
      target: {
        ...artifactBytesBoundary.target,
        manifestId: 'not-a-safe-id',
        objectKey: '../unsafe.json',
        objectSha256: 'not-a-sha',
        artifactId: 'not-a-safe-id'
      }
    }
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.sourceArtifactBytesBoundary.boundaryKind, 'unsupported');
  assert.equal(codes.has('invalid-artifact-bytes-boundary-kind'), true);
  assert.equal(codes.has('invalid-schema-version'), true);
  assert.equal(codes.has('invalid-boundary-kind'), true);
  assert.equal(codes.has('unsafe-artifact-reference'), true);
  assertExecutionDisabled(boundary);
});

test('upload adapter injection boundary blocks missing artifact bytes boundary sections', () => {
  const boundary = buildKnowledgeTeamUploadAdapterInjectionBoundary({
    artifactBytesBoundary: {
      kind: 'infra-agent.knowledge-team-upload-artifact-bytes-boundary',
      schemaVersion: 1,
      mutationAllowed: false,
      executionMode: 'dry-run',
      boundaryKind: 'artifact-bytes-boundary-dry-run',
      status: 'not-a-status',
      plannedOperation: 'stage-knowledge-pack',
      remoteWriteAllowed: false,
      liveCheckAllowed: false,
      credentialValuesExposed: false,
      credentialPresenceChecked: false,
      uploadApproved: false,
      uploadExecutionAllowed: false,
      mutationApprovalGranted: false,
      clientCreated: false,
      adapterInjected: false,
      artifactBytesProvided: false,
      writeTokenIssued: false,
      executionLeaseCreated: false,
      rollbackPlanCreated: false,
      auditRecordCreated: false,
      objectWriteAttempted: false,
      metadataIndexWriteAttempted: false,
      remoteMutationPerformed: false,
      uploadCommand: null,
      target: null,
      readiness: null,
      sourceAuditRecordBoundary: null,
      artifactBytesBoundary: null,
      remainingExecutionBoundaries: null
    }
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.sourceArtifactBytesBoundary.boundaryStatus, 'invalid');
  assert.equal(boundary.sourceArtifactBytesBoundary.boundaryNextAction, 'invalid');
  assert.equal(boundary.sourceArtifactBytesBoundary.reviewStatus, 'invalid');
  assert.equal(boundary.sourceArtifactBytesBoundary.reviewKind, 'unsupported');
  assert.equal(boundary.sourceArtifactBytesBoundary.adapterBackendKind, 'unsupported');
  assert.equal(codes.has('artifact-bytes-boundary-not-ready'), true);
  assert.equal(codes.has('artifact-bytes-boundary-next-action-invalid'), true);
  assert.equal(codes.has('missing-required-field'), true);
  assert.equal(codes.has('unsafe-artifact-reference'), true);
  assert.equal(codes.has('review-fingerprint-unverified'), true);
  assert.equal(codes.has('scope-not-matched'), true);
  assert.equal(codes.has('unsafe-adapter-name'), true);
  assert.equal(codes.has('unsupported-adapter-backend'), true);
  assert.equal(codes.has('artifact-bytes-not-required'), true);
  assert.equal(codes.has('adapter-injection-not-required'), true);
  assert.equal(codes.has('write-token-not-required'), true);
  assert.equal(codes.has('execution-lease-not-required'), true);
  assert.equal(codes.has('rollback-plan-not-required'), true);
  assert.equal(codes.has('audit-record-not-required'), true);
  assertExecutionDisabled(boundary);
});

test('upload adapter injection boundary blocks forged adapter, client, command, and mutation state', async () => {
  const artifactBytesBoundary = await validArtifactBytesBoundary();
  const boundary = buildKnowledgeTeamUploadAdapterInjectionBoundary({
    artifactBytesBoundary: {
      ...artifactBytesBoundary,
      remoteWriteAllowed: true,
      uploadExecutionAllowed: true,
      clientCreated: true,
      adapterInjected: true,
      artifactBytesProvided: true,
      uploadCommand: 'infra-agent upload --should-not-run',
      artifactBytesBoundary: {
        ...artifactBytesBoundary.artifactBytesBoundary,
        artifactBytesProvided: true,
        artifactDigestVerified: true,
        artifactScopeBoundToArtifact: true,
        adapterInjected: true,
        executable: true
      },
      remainingExecutionBoundaries: {
        ...artifactBytesBoundary.remainingExecutionBoundaries,
        artifactBytesProvided: true,
        adapterInjected: true,
        objectWriteAllowed: true,
        metadataIndexWriteAllowed: true,
        remoteMutationAllowed: true
      }
    }
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('remote-write-enabled'), true);
  assert.equal(codes.has('upload-execution-enabled'), true);
  assert.equal(codes.has('client-created'), true);
  assert.equal(codes.has('adapter-injected'), true);
  assert.equal(codes.has('artifact-bytes-provided'), true);
  assert.equal(codes.has('artifact-bytes-digest-already-verified'), true);
  assert.equal(codes.has('artifact-bytes-scope-already-bound'), true);
  assert.equal(codes.has('upload-command-present'), true);
  assert.equal(codes.has('object-write-attempted'), true);
  assert.equal(codes.has('metadata-index-write-attempted'), true);
  assert.equal(codes.has('remote-mutation-performed'), true);
  assertExecutionDisabled(boundary);
});

test('upload adapter injection boundary reports private adapter and byte details without copying values', async () => {
  const artifactBytesBoundary = await validArtifactBytesBoundary();
  const boundary = buildKnowledgeTeamUploadAdapterInjectionBoundary({
    artifactBytesBoundary: {
      ...artifactBytesBoundary,
      sourceArtifactBytesBoundary: {
        ...artifactBytesBoundary.sourceArtifactBytesBoundary,
        endpointUrl: 'https://should-not-copy.example.test',
        bucketName: 'should-not-copy-bucket'
      },
      artifactBytesBoundary: {
        ...artifactBytesBoundary.artifactBytesBoundary,
        artifactBytesValue: 'raw-artifact-bytes',
        artifactPath: '/home/private/knowledge-pack.json'
      },
      adapterInstance: {
        clientConfig: {
          accessKey: 'should-not-copy-secret'
        }
      },
      adapterMaterial: 'adapter-secret-value'
    }
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('backend-detail-leak'), true);
  assert.equal(codes.has('adapter-dependency-leak'), true);
  assert.equal(codes.has('artifact-bytes-provided'), true);
  assertExecutionDisabled(boundary);
  assertNoPrivateValues(boundary);
});
