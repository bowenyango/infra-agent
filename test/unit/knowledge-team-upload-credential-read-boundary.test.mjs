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

async function validClientCreationBoundary() {
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
  return buildKnowledgeTeamUploadClientCreationBoundary({ adapterInjectionBoundary });
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
    'raw-artifact-bytes'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

function assertExecutionAndCredentialReadsDisabled(boundary) {
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
  assert.equal(boundary.credentialReadBoundary.credentialValuesRead, false);
  assert.equal(boundary.credentialReadBoundary.credentialValuesExposed, false);
  assert.equal(boundary.credentialReadBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.credentialReadBoundary.clientCreated, false);
  assert.equal(boundary.credentialReadBoundary.sdkClientCreated, false);
  assert.equal(boundary.credentialReadBoundary.adapterInjected, false);
  assert.equal(boundary.credentialReadBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.credentialReadBoundary.metadataIndexBound, false);
  assert.equal(boundary.credentialReadBoundary.liveCheckPerformed, false);
  assert.equal(boundary.credentialReadBoundary.uploadExecutionAllowed, false);
  assert.equal(boundary.credentialReadBoundary.uploadCommandGenerated, false);
  assert.equal(boundary.credentialReadBoundary.objectWriteAttempted, false);
  assert.equal(boundary.credentialReadBoundary.metadataIndexWriteAttempted, false);
  assert.equal(boundary.credentialReadBoundary.remoteMutationPerformed, false);
  assert.equal(boundary.credentialReadBoundary.executable, false);
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

test('upload credential read boundary records credential requirements without reading values', async () => {
  const clientCreationBoundary = await validClientCreationBoundary();
  const boundary = buildKnowledgeTeamUploadCredentialReadBoundary({ clientCreationBoundary });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-credential-read-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'credential-read-boundary-dry-run');
  assert.equal(boundary.status, 'credential-read-boundary-ready');
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionAndCredentialReadsDisabled(boundary);
  assert.equal(boundary.target.manifestId, clientCreationBoundary.target.manifestId);
  assert.equal(boundary.target.objectKey, clientCreationBoundary.target.objectKey);
  assert.equal(boundary.target.objectSha256, clientCreationBoundary.target.objectSha256);
  assert.equal(boundary.target.artifactId, clientCreationBoundary.target.artifactId);
  assert.equal(boundary.sourceClientCreationBoundary.source, 'upload-client-creation-boundary');
  assert.equal(boundary.sourceClientCreationBoundary.boundaryStatus, 'client-creation-boundary-ready');
  assert.equal(boundary.sourceClientCreationBoundary.boundaryKind, 'client-creation-boundary-dry-run');
  assert.equal(boundary.sourceClientCreationBoundary.boundaryNextAction, 'design-credential-read-boundary');
  assert.equal(boundary.sourceClientCreationBoundary.reviewStatus, 'review-ready');
  assert.equal(boundary.sourceClientCreationBoundary.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourceClientCreationBoundary.scopeMatched, true);
  assert.equal(boundary.sourceClientCreationBoundary.humanReviewRecorded, true);
  assert.equal(boundary.sourceClientCreationBoundary.fingerprintVerified, true);
  assert.equal(boundary.sourceClientCreationBoundary.sourceFingerprintVerified, true);
  assert.equal(boundary.sourceClientCreationBoundary.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourceClientCreationBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceClientCreationBoundary.clientFactoryDescriptorRequired, true);
  assert.equal(boundary.sourceClientCreationBoundary.credentialReadBoundaryRequired, true);
  assert.equal(boundary.sourceClientCreationBoundary.credentialPresenceBoundaryRequired, true);
  assert.equal(boundary.sourceClientCreationBoundary.clientCreated, false);
  assert.equal(boundary.sourceClientCreationBoundary.sdkClientCreated, false);
  assert.equal(boundary.sourceClientCreationBoundary.credentialValuesExposed, false);
  assert.equal(boundary.sourceClientCreationBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.credentialReadBoundary.dryRunOnly, true);
  assert.equal(boundary.credentialReadBoundary.credentialReadRequiredBeforeExecution, true);
  assert.equal(boundary.credentialReadBoundary.credentialReadRequiredAfterClientBoundary, true);
  assert.equal(boundary.credentialReadBoundary.clientCreationBoundaryRequired, true);
  assert.equal(boundary.credentialReadBoundary.credentialSourceDescriptorRequired, true);
  assert.equal(boundary.credentialReadBoundary.credentialReferenceOnlyRequired, true);
  assert.equal(boundary.credentialReadBoundary.credentialValueRedactionRequired, true);
  assert.equal(boundary.credentialReadBoundary.credentialPresenceBoundaryRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.clientCreationRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.credentialReadRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.credentialPresenceCheckRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.liveCheckRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.uploadCommandRequired, true);
  assert.equal(boundary.readiness.status, 'credential-read-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-credential-presence-boundary');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assertNoPrivateValues(boundary);
});

test('upload credential read boundary blocks non-ready client creation boundaries', async () => {
  const clientCreationBoundary = await validClientCreationBoundary();
  const blockedClientCreationBoundary = {
    ...clientCreationBoundary,
    status: 'blocked',
    sourceClientCreationBoundary: {
      ...clientCreationBoundary.sourceClientCreationBoundary,
      fingerprintVerified: false
    },
    readiness: {
      ...clientCreationBoundary.readiness,
      status: 'blocked',
      nextAction: 'resolve-blockers',
      blockerCount: 1,
      blockerCodes: ['review-fingerprint-unverified'],
      blockers: [{
        code: 'review-fingerprint-unverified',
        path: '$.sourceClientCreationBoundary.fingerprintVerified',
        message: 'fingerprint not verified'
      }]
    }
  };

  const boundary = buildKnowledgeTeamUploadCredentialReadBoundary({
    clientCreationBoundary: blockedClientCreationBoundary
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.readiness.nextAction, 'resolve-blockers');
  assert.equal(codes.has('client-creation-boundary-not-ready'), true);
  assert.equal(codes.has('client-creation-boundary-next-action-invalid'), true);
  assertExecutionAndCredentialReadsDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload credential read boundary blocks invalid client creation inputs', () => {
  const boundary = buildKnowledgeTeamUploadCredentialReadBoundary({ clientCreationBoundary: null });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.sourceClientCreationBoundary.boundaryStatus, 'invalid');
  assert.equal(codes.has('missing-required-field'), true);
  assertExecutionAndCredentialReadsDisabled(boundary);
});

test('upload credential read boundary blocks malformed client creation metadata', async () => {
  const clientCreationBoundary = await validClientCreationBoundary();
  const boundary = buildKnowledgeTeamUploadCredentialReadBoundary({
    clientCreationBoundary: {
      ...clientCreationBoundary,
      kind: 'infra-agent.knowledge-team-upload-adapter-injection-boundary',
      schemaVersion: 2,
      boundaryKind: 'adapter-injection-boundary-dry-run',
      target: {
        ...clientCreationBoundary.target,
        manifestId: 'not-a-safe-id',
        objectKey: '../unsafe.json',
        objectSha256: 'not-a-sha',
        artifactId: 'not-a-safe-id'
      }
    }
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.sourceClientCreationBoundary.boundaryKind, 'unsupported');
  assert.equal(codes.has('invalid-client-creation-boundary-kind'), true);
  assert.equal(codes.has('invalid-schema-version'), true);
  assert.equal(codes.has('invalid-boundary-kind'), true);
  assert.equal(codes.has('unsafe-artifact-reference'), true);
  assertExecutionAndCredentialReadsDisabled(boundary);
});

test('upload credential read boundary blocks missing client creation sections', () => {
  const boundary = buildKnowledgeTeamUploadCredentialReadBoundary({
    clientCreationBoundary: {
      kind: 'infra-agent.knowledge-team-upload-client-creation-boundary',
      schemaVersion: 1,
      mutationAllowed: false,
      executionMode: 'dry-run',
      boundaryKind: 'client-creation-boundary-dry-run',
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
      sourceAdapterInjectionBoundary: null,
      clientCreationBoundary: null,
      remainingExecutionBoundaries: null
    }
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.sourceClientCreationBoundary.boundaryStatus, 'invalid');
  assert.equal(boundary.sourceClientCreationBoundary.boundaryNextAction, 'invalid');
  assert.equal(boundary.sourceClientCreationBoundary.reviewStatus, 'invalid');
  assert.equal(boundary.sourceClientCreationBoundary.reviewKind, 'unsupported');
  assert.equal(boundary.sourceClientCreationBoundary.adapterBackendKind, 'unsupported');
  assert.equal(codes.has('client-creation-boundary-not-ready'), true);
  assert.equal(codes.has('client-creation-boundary-next-action-invalid'), true);
  assert.equal(codes.has('missing-required-field'), true);
  assert.equal(codes.has('unsafe-artifact-reference'), true);
  assert.equal(codes.has('review-fingerprint-unverified'), true);
  assert.equal(codes.has('scope-not-matched'), true);
  assert.equal(codes.has('unsafe-adapter-name'), true);
  assert.equal(codes.has('unsupported-adapter-backend'), true);
  assert.equal(codes.has('client-creation-not-required'), true);
  assert.equal(codes.has('credential-read-not-required'), true);
  assertExecutionAndCredentialReadsDisabled(boundary);
});

test('upload credential read boundary blocks forged credential, client, command, and mutation state', async () => {
  const clientCreationBoundary = await validClientCreationBoundary();
  const boundary = buildKnowledgeTeamUploadCredentialReadBoundary({
    clientCreationBoundary: {
      ...clientCreationBoundary,
      remoteWriteAllowed: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      uploadExecutionAllowed: true,
      mutationApprovalGranted: true,
      clientCreated: true,
      adapterInjected: true,
      artifactBytesProvided: true,
      uploadCommand: 'infra-agent upload --should-not-run',
      clientCreationBoundary: {
        ...clientCreationBoundary.clientCreationBoundary,
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
        executable: true
      },
      remainingExecutionBoundaries: {
        ...clientCreationBoundary.remainingExecutionBoundaries,
        clientCreated: true,
        credentialValuesExposed: true,
        credentialPresenceChecked: true,
        liveCheckPerformed: true,
        uploadCommandGenerated: true,
        objectWriteAllowed: true,
        metadataIndexWriteAllowed: true,
        remoteMutationAllowed: true
      }
    }
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('remote-write-enabled'), true);
  assert.equal(codes.has('credential-values-exposed'), true);
  assert.equal(codes.has('credential-presence-check-enabled'), true);
  assert.equal(codes.has('upload-execution-enabled'), true);
  assert.equal(codes.has('mutation-approval-already-granted'), true);
  assert.equal(codes.has('client-created'), true);
  assert.equal(codes.has('adapter-injected'), true);
  assert.equal(codes.has('artifact-bytes-provided'), true);
  assert.equal(codes.has('artifact-object-store-bound'), true);
  assert.equal(codes.has('metadata-index-bound'), true);
  assert.equal(codes.has('executable-state-enabled'), true);
  assert.equal(codes.has('live-check-enabled'), true);
  assert.equal(codes.has('upload-command-present'), true);
  assert.equal(codes.has('object-write-attempted'), true);
  assert.equal(codes.has('metadata-index-write-attempted'), true);
  assert.equal(codes.has('remote-mutation-performed'), true);
  assertExecutionAndCredentialReadsDisabled(boundary);
});

test('upload credential read boundary reports credential and backend details without copying values', async () => {
  const clientCreationBoundary = await validClientCreationBoundary();
  const boundary = buildKnowledgeTeamUploadCredentialReadBoundary({
    clientCreationBoundary: {
      ...clientCreationBoundary,
      sourceAdapterInjectionBoundary: {
        ...clientCreationBoundary.sourceAdapterInjectionBoundary,
        endpointUrl: 'https://should-not-copy.example.test',
        bucketName: 'should-not-copy-bucket'
      },
      clientCreationBoundary: {
        ...clientCreationBoundary.clientCreationBoundary,
        clientConfig: {
          accessKey: 'should-not-copy-secret'
        },
        clientFactoryValue: 'client-secret-value',
        credentialValue: 'credential-secret-value',
        credentialFile: '/home/private/credential.json',
        credentialPresenceResult: true,
        artifactBytesValue: 'raw-artifact-bytes'
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
  assert.equal(codes.has('credential-dependency-leak'), true);
  assert.equal(codes.has('adapter-dependency-leak'), true);
  assert.equal(codes.has('artifact-bytes-provided'), true);
  assertExecutionAndCredentialReadsDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload credential read boundary validation rejects forged credential state and dependency payloads', async () => {
  const clientCreationBoundary = await validClientCreationBoundary();
  const boundary = buildKnowledgeTeamUploadCredentialReadBoundary({ clientCreationBoundary });
  const readyValidation = validateKnowledgePayload(boundary, 'knowledge-pack.upload-credential-read-boundary.json');

  assert.equal(readyValidation.valid, true);

  const validation = validateKnowledgePayload({
    ...boundary,
    credentialValuesExposed: true,
    credentialPresenceChecked: true,
    clientCreated: true,
    adapterInjected: true,
    sourceClientCreationBoundary: {
      ...boundary.sourceClientCreationBoundary,
      source: 'upload-adapter-injection-boundary',
      boundaryStatus: 'blocked',
      boundaryKind: 'unsupported',
      boundaryNextAction: 'resolve-blockers',
      adapterBackendKind: 's3-compatible',
      clientCreated: true,
      sdkClientCreated: true,
      adapterInjected: true,
      artifactObjectStoreBound: true,
      metadataIndexBound: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      liveCheckPerformed: true,
      uploadCommandGenerated: true,
      executable: true
    },
    credentialReadBoundary: {
      ...boundary.credentialReadBoundary,
      credentialValuesRead: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      clientCreated: true,
      sdkClientCreated: true,
      adapterInjected: true,
      artifactObjectStoreBound: true,
      metadataIndexBound: true,
      liveCheckPerformed: true,
      uploadExecutionAllowed: true,
      uploadCommandGenerated: true,
      objectWriteAttempted: true,
      metadataIndexWriteAttempted: true,
      remoteMutationPerformed: true,
      executable: true,
      credentialValue: 'should-not-exist'
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
  }, 'knowledge-pack.upload-credential-read-boundary.json');

  assert.equal(validation.valid, false);
  assert.equal(validation.issues.some(issue => issue.path === '$.credentialValuesExposed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.credentialPresenceChecked'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.clientCreated'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.adapterInjected'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceClientCreationBoundary.source'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceClientCreationBoundary.boundaryStatus'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceClientCreationBoundary.boundaryKind'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceClientCreationBoundary.boundaryNextAction'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceClientCreationBoundary.adapterBackendKind'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceClientCreationBoundary.clientCreated'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceClientCreationBoundary.sdkClientCreated'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceClientCreationBoundary.credentialValuesExposed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceClientCreationBoundary.credentialPresenceChecked'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceClientCreationBoundary.liveCheckPerformed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceClientCreationBoundary.uploadCommandGenerated'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceClientCreationBoundary.executable'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.credentialReadBoundary.credentialValuesRead'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.credentialReadBoundary.credentialValuesExposed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.credentialReadBoundary.credentialPresenceChecked'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.credentialReadBoundary.clientCreated'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.credentialReadBoundary.sdkClientCreated'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.credentialReadBoundary.liveCheckPerformed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.credentialReadBoundary.uploadCommandGenerated'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.credentialReadBoundary.credentialValue'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.clientCreated'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.objectWriteAllowed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.metadataIndexWriteAllowed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.remoteMutationAllowed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.readiness.nextAction'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.readiness.blockerCount'), true);
});

export {
  assertExecutionAndCredentialReadsDisabled,
  assertNoPrivateValues,
  blockerCodes,
  validClientCreationBoundary
};
