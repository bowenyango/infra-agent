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
import {
  validateKnowledgePayload
} from '../../src/knowledge/validate.ts';

function validBackendReferenceSummary() {
  return validateKnowledgeTeamS3CompatibleBackendReferences(
    buildKnowledgeTeamS3CompatibleBackendConfig(),
    buildKnowledgeTeamS3CompatibleReferenceRegistry()
  );
}

async function validAdapterInjectionBoundary() {
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
  return buildKnowledgeTeamUploadAdapterInjectionBoundary({ artifactBytesBoundary });
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
  assert.equal(boundary.clientCreationBoundary.clientCreated, false);
  assert.equal(boundary.clientCreationBoundary.sdkClientCreated, false);
  assert.equal(boundary.clientCreationBoundary.adapterInjected, false);
  assert.equal(boundary.clientCreationBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.clientCreationBoundary.metadataIndexBound, false);
  assert.equal(boundary.clientCreationBoundary.credentialValuesExposed, false);
  assert.equal(boundary.clientCreationBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.clientCreationBoundary.liveCheckPerformed, false);
  assert.equal(boundary.clientCreationBoundary.uploadExecutionAllowed, false);
  assert.equal(boundary.clientCreationBoundary.uploadCommandGenerated, false);
  assert.equal(boundary.clientCreationBoundary.objectWriteAttempted, false);
  assert.equal(boundary.clientCreationBoundary.metadataIndexWriteAttempted, false);
  assert.equal(boundary.clientCreationBoundary.remoteMutationPerformed, false);
  assert.equal(boundary.clientCreationBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.artifactBytesProvided, false);
  assert.equal(boundary.remainingExecutionBoundaries.adapterInjected, false);
  assert.equal(boundary.remainingExecutionBoundaries.clientCreated, false);
  assert.equal(boundary.remainingExecutionBoundaries.credentialValuesExposed, false);
  assert.equal(boundary.remainingExecutionBoundaries.credentialPresenceChecked, false);
  assert.equal(boundary.remainingExecutionBoundaries.liveCheckPerformed, false);
  assert.equal(boundary.remainingExecutionBoundaries.uploadCommandGenerated, false);
  assert.equal(boundary.remainingExecutionBoundaries.objectWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.metadataIndexWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.remoteMutationAllowed, false);
}

function blockerCodes(boundary) {
  return new Set(boundary.readiness.blockerCodes);
}

test('upload client creation boundary records client requirements without creating clients', async () => {
  const adapterInjectionBoundary = await validAdapterInjectionBoundary();
  const boundary = buildKnowledgeTeamUploadClientCreationBoundary({ adapterInjectionBoundary });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-client-creation-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'client-creation-boundary-dry-run');
  assert.equal(boundary.status, 'client-creation-boundary-ready');
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.target.manifestId, adapterInjectionBoundary.target.manifestId);
  assert.equal(boundary.target.objectKey, adapterInjectionBoundary.target.objectKey);
  assert.equal(boundary.target.objectSha256, adapterInjectionBoundary.target.objectSha256);
  assert.equal(boundary.target.artifactId, adapterInjectionBoundary.target.artifactId);
  assert.equal(boundary.sourceAdapterInjectionBoundary.source, 'upload-adapter-injection-boundary');
  assert.equal(boundary.sourceAdapterInjectionBoundary.boundaryStatus, 'adapter-injection-boundary-ready');
  assert.equal(boundary.sourceAdapterInjectionBoundary.boundaryKind, 'adapter-injection-boundary-dry-run');
  assert.equal(boundary.sourceAdapterInjectionBoundary.boundaryNextAction, 'design-client-creation-boundary');
  assert.equal(boundary.sourceAdapterInjectionBoundary.reviewStatus, 'review-ready');
  assert.equal(boundary.sourceAdapterInjectionBoundary.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourceAdapterInjectionBoundary.scopeMatched, true);
  assert.equal(boundary.sourceAdapterInjectionBoundary.humanReviewRecorded, true);
  assert.equal(boundary.sourceAdapterInjectionBoundary.fingerprintVerified, true);
  assert.equal(boundary.sourceAdapterInjectionBoundary.sourceFingerprintVerified, true);
  assert.equal(boundary.sourceAdapterInjectionBoundary.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourceAdapterInjectionBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceAdapterInjectionBoundary.adapterDependencyInjectionOnly, true);
  assert.equal(boundary.sourceAdapterInjectionBoundary.mockAdapterRequired, true);
  assert.equal(boundary.sourceAdapterInjectionBoundary.adapterDescriptorRequired, true);
  assert.equal(boundary.sourceAdapterInjectionBoundary.artifactObjectStoreDependencyRequired, true);
  assert.equal(boundary.sourceAdapterInjectionBoundary.metadataIndexDependencyRequired, true);
  assert.equal(boundary.sourceAdapterInjectionBoundary.adapterInjected, false);
  assert.equal(boundary.sourceAdapterInjectionBoundary.clientCreated, false);
  assert.equal(boundary.sourceAdapterInjectionBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.sourceAdapterInjectionBoundary.metadataIndexBound, false);
  assert.equal(boundary.sourceAdapterInjectionBoundary.executable, false);
  assert.equal(boundary.clientCreationBoundary.dryRunOnly, true);
  assert.equal(boundary.clientCreationBoundary.clientCreationRequiredBeforeExecution, true);
  assert.equal(boundary.clientCreationBoundary.clientCreationRequiredAfterAdapter, true);
  assert.equal(boundary.clientCreationBoundary.adapterInjectionRequiredBeforeClient, true);
  assert.equal(boundary.clientCreationBoundary.clientFactoryDescriptorRequired, true);
  assert.equal(boundary.clientCreationBoundary.credentialReadBoundaryRequired, true);
  assert.equal(boundary.clientCreationBoundary.credentialPresenceBoundaryRequired, true);
  assert.equal(boundary.clientCreationBoundary.liveCheckBoundaryRequired, true);
  assert.equal(boundary.clientCreationBoundary.uploadCommandBoundaryRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.clientCreationRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.credentialReadRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.credentialPresenceCheckRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.liveCheckRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.uploadCommandRequired, true);
  assert.equal(boundary.readiness.status, 'client-creation-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-credential-read-boundary');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assertNoPrivateValues(boundary);
});

test('upload client creation boundary blocks non-ready adapter injection boundaries', async () => {
  const adapterInjectionBoundary = await validAdapterInjectionBoundary();
  const blockedAdapterInjectionBoundary = {
    ...adapterInjectionBoundary,
    status: 'blocked',
    sourceArtifactBytesBoundary: {
      ...adapterInjectionBoundary.sourceArtifactBytesBoundary,
      fingerprintVerified: false
    },
    readiness: {
      ...adapterInjectionBoundary.readiness,
      status: 'blocked',
      nextAction: 'resolve-blockers',
      blockerCount: 1,
      blockerCodes: ['review-fingerprint-unverified'],
      blockers: [{
        code: 'review-fingerprint-unverified',
        path: '$.sourceAdapterInjectionBoundary.fingerprintVerified',
        message: 'fingerprint not verified'
      }]
    }
  };

  const boundary = buildKnowledgeTeamUploadClientCreationBoundary({
    adapterInjectionBoundary: blockedAdapterInjectionBoundary
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.readiness.nextAction, 'resolve-blockers');
  assert.equal(codes.has('adapter-injection-boundary-not-ready'), true);
  assert.equal(codes.has('adapter-injection-boundary-next-action-invalid'), true);
  assert.equal(codes.has('review-fingerprint-unverified'), true);
  assertExecutionDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload client creation boundary blocks invalid adapter injection inputs', () => {
  const boundary = buildKnowledgeTeamUploadClientCreationBoundary({ adapterInjectionBoundary: null });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.sourceAdapterInjectionBoundary.boundaryStatus, 'invalid');
  assert.equal(codes.has('missing-required-field'), true);
  assertExecutionDisabled(boundary);
});

test('upload client creation boundary blocks malformed adapter injection metadata', async () => {
  const adapterInjectionBoundary = await validAdapterInjectionBoundary();
  const boundary = buildKnowledgeTeamUploadClientCreationBoundary({
    adapterInjectionBoundary: {
      ...adapterInjectionBoundary,
      kind: 'infra-agent.knowledge-team-upload-artifact-bytes-boundary',
      schemaVersion: 2,
      boundaryKind: 'artifact-bytes-boundary-dry-run',
      target: {
        ...adapterInjectionBoundary.target,
        manifestId: 'not-a-safe-id',
        objectKey: '../unsafe.json',
        objectSha256: 'not-a-sha',
        artifactId: 'not-a-safe-id'
      }
    }
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.sourceAdapterInjectionBoundary.boundaryKind, 'unsupported');
  assert.equal(codes.has('invalid-adapter-injection-boundary-kind'), true);
  assert.equal(codes.has('invalid-schema-version'), true);
  assert.equal(codes.has('invalid-boundary-kind'), true);
  assert.equal(codes.has('unsafe-artifact-reference'), true);
  assertExecutionDisabled(boundary);
});

test('upload client creation boundary blocks missing adapter injection sections', () => {
  const boundary = buildKnowledgeTeamUploadClientCreationBoundary({
    adapterInjectionBoundary: {
      kind: 'infra-agent.knowledge-team-upload-adapter-injection-boundary',
      schemaVersion: 1,
      mutationAllowed: false,
      executionMode: 'dry-run',
      boundaryKind: 'adapter-injection-boundary-dry-run',
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
      sourceArtifactBytesBoundary: null,
      adapterInjectionBoundary: null,
      remainingExecutionBoundaries: null
    }
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.sourceAdapterInjectionBoundary.boundaryStatus, 'invalid');
  assert.equal(boundary.sourceAdapterInjectionBoundary.boundaryNextAction, 'invalid');
  assert.equal(boundary.sourceAdapterInjectionBoundary.reviewStatus, 'invalid');
  assert.equal(boundary.sourceAdapterInjectionBoundary.reviewKind, 'unsupported');
  assert.equal(boundary.sourceAdapterInjectionBoundary.adapterBackendKind, 'unsupported');
  assert.equal(codes.has('adapter-injection-boundary-not-ready'), true);
  assert.equal(codes.has('adapter-injection-boundary-next-action-invalid'), true);
  assert.equal(codes.has('missing-required-field'), true);
  assert.equal(codes.has('unsafe-artifact-reference'), true);
  assert.equal(codes.has('review-fingerprint-unverified'), true);
  assert.equal(codes.has('scope-not-matched'), true);
  assert.equal(codes.has('unsafe-adapter-name'), true);
  assert.equal(codes.has('unsupported-adapter-backend'), true);
  assert.equal(codes.has('adapter-injection-not-required'), true);
  assert.equal(codes.has('client-creation-not-required'), true);
  assertExecutionDisabled(boundary);
});

test('upload client creation boundary blocks forged client, adapter, command, and mutation state', async () => {
  const adapterInjectionBoundary = await validAdapterInjectionBoundary();
  const boundary = buildKnowledgeTeamUploadClientCreationBoundary({
    adapterInjectionBoundary: {
      ...adapterInjectionBoundary,
      remoteWriteAllowed: true,
      uploadExecutionAllowed: true,
      mutationApprovalGranted: true,
      clientCreated: true,
      adapterInjected: true,
      artifactBytesProvided: true,
      uploadCommand: 'infra-agent upload --should-not-run',
      adapterInjectionBoundary: {
        ...adapterInjectionBoundary.adapterInjectionBoundary,
        clientCreated: true,
        adapterInjected: true,
        artifactObjectStoreBound: true,
        metadataIndexBound: true,
        executable: true
      },
      remainingExecutionBoundaries: {
        ...adapterInjectionBoundary.remainingExecutionBoundaries,
        clientCreated: true,
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
  assert.equal(codes.has('mutation-approval-already-granted'), true);
  assert.equal(codes.has('client-created'), true);
  assert.equal(codes.has('adapter-injected'), true);
  assert.equal(codes.has('artifact-bytes-provided'), true);
  assert.equal(codes.has('artifact-object-store-bound'), true);
  assert.equal(codes.has('metadata-index-bound'), true);
  assert.equal(codes.has('executable-state-enabled'), true);
  assert.equal(codes.has('upload-command-present'), true);
  assert.equal(codes.has('object-write-attempted'), true);
  assert.equal(codes.has('metadata-index-write-attempted'), true);
  assert.equal(codes.has('remote-mutation-performed'), true);
  assertExecutionDisabled(boundary);
});

test('upload client creation boundary reports private client and backend details without copying values', async () => {
  const adapterInjectionBoundary = await validAdapterInjectionBoundary();
  const boundary = buildKnowledgeTeamUploadClientCreationBoundary({
    adapterInjectionBoundary: {
      ...adapterInjectionBoundary,
      sourceAdapterInjectionBoundary: {
        ...adapterInjectionBoundary.sourceAdapterInjectionBoundary,
        endpointUrl: 'https://should-not-copy.example.test',
        bucketName: 'should-not-copy-bucket'
      },
      adapterInjectionBoundary: {
        ...adapterInjectionBoundary.adapterInjectionBoundary,
        clientConfig: {
          accessKey: 'should-not-copy-secret'
        },
        clientFactory: 'client-secret-value',
        artifactBytesValue: 'raw-artifact-bytes',
        artifactPath: '/home/private/knowledge-pack.json'
      },
      adapterInstance: {
        adapterMaterial: 'adapter-secret-value'
      }
    }
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('backend-detail-leak'), true);
  assert.equal(codes.has('client-dependency-leak'), true);
  assert.equal(codes.has('adapter-dependency-leak'), true);
  assert.equal(codes.has('artifact-bytes-provided'), true);
  assertExecutionDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload client creation boundary validation rejects forged client state and dependency payloads', async () => {
  const adapterInjectionBoundary = await validAdapterInjectionBoundary();
  const boundary = buildKnowledgeTeamUploadClientCreationBoundary({ adapterInjectionBoundary });
  const readyValidation = validateKnowledgePayload(boundary, 'knowledge-pack.upload-client-creation-boundary.json');

  assert.equal(readyValidation.valid, true);

  const validation = validateKnowledgePayload({
    ...boundary,
    clientCreated: true,
    adapterInjected: true,
    sourceAdapterInjectionBoundary: {
      ...boundary.sourceAdapterInjectionBoundary,
      clientCreated: true,
      adapterInjected: true,
      artifactObjectStoreBound: true,
      metadataIndexBound: true,
      executable: true
    },
    clientCreationBoundary: {
      ...boundary.clientCreationBoundary,
      clientCreated: true,
      sdkClientCreated: true,
      adapterInjected: true,
      artifactObjectStoreBound: true,
      metadataIndexBound: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      liveCheckPerformed: true,
      uploadExecutionAllowed: true,
      uploadCommandGenerated: true,
      objectWriteAttempted: true,
      metadataIndexWriteAttempted: true,
      remoteMutationPerformed: true,
      executable: true,
      clientInstance: {
        putObject: 'should-not-exist'
      }
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
  }, 'knowledge-pack.upload-client-creation-boundary.json');

  assert.equal(validation.valid, false);
  assert.equal(validation.issues.some(issue => issue.path === '$.clientCreated'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.adapterInjected'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceAdapterInjectionBoundary.clientCreated'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceAdapterInjectionBoundary.adapterInjected'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceAdapterInjectionBoundary.artifactObjectStoreBound'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceAdapterInjectionBoundary.metadataIndexBound'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceAdapterInjectionBoundary.executable'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.clientCreationBoundary.clientCreated'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.clientCreationBoundary.sdkClientCreated'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.clientCreationBoundary.credentialValuesExposed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.clientCreationBoundary.credentialPresenceChecked'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.clientCreationBoundary.liveCheckPerformed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.clientCreationBoundary.uploadCommandGenerated'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.clientCreationBoundary.objectWriteAttempted'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.clientCreationBoundary.metadataIndexWriteAttempted'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.clientCreationBoundary.remoteMutationPerformed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.clientCreationBoundary.clientInstance'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.clientCreated'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.objectWriteAllowed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.metadataIndexWriteAllowed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.remoteMutationAllowed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.readiness.nextAction'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.readiness.blockerCount'), true);
});
