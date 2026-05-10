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

async function validCredentialPresenceBoundary() {
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
  return buildKnowledgeTeamUploadCredentialPresenceBoundary({ credentialReadBoundary });
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
    'live-check-result'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

function assertExecutionAndLiveCheckDisabled(boundary) {
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
  assert.equal(boundary.liveCheckBoundary.credentialValuesRead, false);
  assert.equal(boundary.liveCheckBoundary.credentialValuesExposed, false);
  assert.equal(boundary.liveCheckBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.liveCheckBoundary.credentialPresenceResultExposed, false);
  assert.equal(boundary.liveCheckBoundary.clientCreated, false);
  assert.equal(boundary.liveCheckBoundary.sdkClientCreated, false);
  assert.equal(boundary.liveCheckBoundary.adapterInjected, false);
  assert.equal(boundary.liveCheckBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.liveCheckBoundary.metadataIndexBound, false);
  assert.equal(boundary.liveCheckBoundary.liveCheckAllowed, false);
  assert.equal(boundary.liveCheckBoundary.liveCheckPerformed, false);
  assert.equal(boundary.liveCheckBoundary.liveCheckResultExposed, false);
  assert.equal(boundary.liveCheckBoundary.uploadExecutionAllowed, false);
  assert.equal(boundary.liveCheckBoundary.uploadCommandGenerated, false);
  assert.equal(boundary.liveCheckBoundary.objectWriteAttempted, false);
  assert.equal(boundary.liveCheckBoundary.metadataIndexWriteAttempted, false);
  assert.equal(boundary.liveCheckBoundary.remoteMutationPerformed, false);
  assert.equal(boundary.liveCheckBoundary.executable, false);
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

test('upload live check boundary records live-check requirements without probing remotes', async () => {
  const credentialPresenceBoundary = await validCredentialPresenceBoundary();
  const boundary = buildKnowledgeTeamUploadLiveCheckBoundary({ credentialPresenceBoundary });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-live-check-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'live-check-boundary-dry-run');
  assert.equal(boundary.status, 'live-check-boundary-ready');
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionAndLiveCheckDisabled(boundary);
  assert.equal(boundary.target.manifestId, credentialPresenceBoundary.target.manifestId);
  assert.equal(boundary.target.objectKey, credentialPresenceBoundary.target.objectKey);
  assert.equal(boundary.target.objectSha256, credentialPresenceBoundary.target.objectSha256);
  assert.equal(boundary.target.artifactId, credentialPresenceBoundary.target.artifactId);
  assert.equal(boundary.sourceCredentialPresenceBoundary.source, 'upload-credential-presence-boundary');
  assert.equal(boundary.sourceCredentialPresenceBoundary.boundaryStatus, 'credential-presence-boundary-ready');
  assert.equal(boundary.sourceCredentialPresenceBoundary.boundaryKind, 'credential-presence-boundary-dry-run');
  assert.equal(boundary.sourceCredentialPresenceBoundary.boundaryNextAction, 'design-live-check-boundary');
  assert.equal(boundary.sourceCredentialPresenceBoundary.reviewStatus, 'review-ready');
  assert.equal(boundary.sourceCredentialPresenceBoundary.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourceCredentialPresenceBoundary.scopeMatched, true);
  assert.equal(boundary.sourceCredentialPresenceBoundary.humanReviewRecorded, true);
  assert.equal(boundary.sourceCredentialPresenceBoundary.fingerprintVerified, true);
  assert.equal(boundary.sourceCredentialPresenceBoundary.sourceFingerprintVerified, true);
  assert.equal(boundary.sourceCredentialPresenceBoundary.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourceCredentialPresenceBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceCredentialPresenceBoundary.credentialPresenceSignalRequired, true);
  assert.equal(boundary.sourceCredentialPresenceBoundary.credentialPresenceResultRedactionRequired, true);
  assert.equal(boundary.sourceCredentialPresenceBoundary.credentialValuesRead, false);
  assert.equal(boundary.sourceCredentialPresenceBoundary.credentialValuesExposed, false);
  assert.equal(boundary.sourceCredentialPresenceBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.sourceCredentialPresenceBoundary.credentialPresenceResultExposed, false);
  assert.equal(boundary.liveCheckBoundary.dryRunOnly, true);
  assert.equal(boundary.liveCheckBoundary.liveCheckRequiredBeforeExecution, true);
  assert.equal(boundary.liveCheckBoundary.liveCheckRequiredAfterCredentialPresenceBoundary, true);
  assert.equal(boundary.liveCheckBoundary.credentialPresenceBoundaryRequired, true);
  assert.equal(boundary.liveCheckBoundary.liveCheckPolicyRequired, true);
  assert.equal(boundary.liveCheckBoundary.liveCheckReadOnlyRequired, true);
  assert.equal(boundary.liveCheckBoundary.liveCheckResultRedactionRequired, true);
  assert.equal(boundary.liveCheckBoundary.uploadCommandBoundaryRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.credentialPresenceCheckRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.liveCheckRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.uploadCommandRequired, true);
  assert.equal(boundary.readiness.status, 'live-check-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-upload-command-boundary');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assertNoPrivateValues(boundary);
});

test('upload live check boundary blocks non-ready credential presence boundaries', async () => {
  const credentialPresenceBoundary = await validCredentialPresenceBoundary();
  const boundary = buildKnowledgeTeamUploadLiveCheckBoundary({
    credentialPresenceBoundary: {
      ...credentialPresenceBoundary,
      status: 'blocked',
      readiness: {
        ...credentialPresenceBoundary.readiness,
        status: 'blocked',
        nextAction: 'resolve-blockers',
        blockerCount: 1,
        blockerCodes: ['credential-presence-check-enabled'],
        blockers: [{
          code: 'credential-presence-check-enabled',
          path: '$.credentialPresenceBoundary.credentialPresenceChecked',
          message: 'presence was checked'
        }]
      }
    }
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.readiness.nextAction, 'resolve-blockers');
  assert.equal(codes.has('credential-presence-boundary-not-ready'), true);
  assert.equal(codes.has('credential-presence-boundary-next-action-invalid'), true);
  assertExecutionAndLiveCheckDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload live check boundary blocks invalid credential presence inputs', () => {
  const boundary = buildKnowledgeTeamUploadLiveCheckBoundary({ credentialPresenceBoundary: null });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.sourceCredentialPresenceBoundary.boundaryStatus, 'invalid');
  assert.equal(codes.has('missing-required-field'), true);
  assertExecutionAndLiveCheckDisabled(boundary);
});

test('upload live check boundary blocks malformed credential presence metadata', async () => {
  const credentialPresenceBoundary = await validCredentialPresenceBoundary();
  const boundary = buildKnowledgeTeamUploadLiveCheckBoundary({
    credentialPresenceBoundary: {
      ...credentialPresenceBoundary,
      kind: 'infra-agent.knowledge-team-upload-credential-read-boundary',
      schemaVersion: 2,
      boundaryKind: 'credential-read-boundary-dry-run',
      target: {
        ...credentialPresenceBoundary.target,
        manifestId: 'not-a-safe-id',
        objectKey: '../unsafe.json',
        objectSha256: 'not-a-sha',
        artifactId: 'not-a-safe-id'
      }
    }
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.sourceCredentialPresenceBoundary.boundaryKind, 'unsupported');
  assert.equal(codes.has('invalid-credential-presence-boundary-kind'), true);
  assert.equal(codes.has('invalid-schema-version'), true);
  assert.equal(codes.has('invalid-boundary-kind'), true);
  assert.equal(codes.has('unsafe-artifact-reference'), true);
  assertExecutionAndLiveCheckDisabled(boundary);
});

test('upload live check boundary blocks missing credential presence sections', () => {
  const boundary = buildKnowledgeTeamUploadLiveCheckBoundary({
    credentialPresenceBoundary: {
      kind: 'infra-agent.knowledge-team-upload-credential-presence-boundary',
      schemaVersion: 1,
      mutationAllowed: false,
      executionMode: 'dry-run',
      boundaryKind: 'credential-presence-boundary-dry-run',
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
      sourceCredentialReadBoundary: null,
      credentialPresenceBoundary: null,
      remainingExecutionBoundaries: null
    }
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.sourceCredentialPresenceBoundary.boundaryStatus, 'invalid');
  assert.equal(boundary.sourceCredentialPresenceBoundary.boundaryNextAction, 'invalid');
  assert.equal(boundary.sourceCredentialPresenceBoundary.reviewStatus, 'invalid');
  assert.equal(boundary.sourceCredentialPresenceBoundary.reviewKind, 'unsupported');
  assert.equal(boundary.sourceCredentialPresenceBoundary.adapterBackendKind, 'unsupported');
  assert.equal(codes.has('credential-presence-boundary-not-ready'), true);
  assert.equal(codes.has('credential-presence-boundary-next-action-invalid'), true);
  assert.equal(codes.has('missing-required-field'), true);
  assert.equal(codes.has('unsafe-artifact-reference'), true);
  assert.equal(codes.has('review-fingerprint-unverified'), true);
  assert.equal(codes.has('scope-not-matched'), true);
  assert.equal(codes.has('unsafe-adapter-name'), true);
  assert.equal(codes.has('unsupported-adapter-backend'), true);
  assert.equal(codes.has('credential-presence-check-not-required'), true);
  assert.equal(codes.has('live-check-not-required'), true);
  assertExecutionAndLiveCheckDisabled(boundary);
});

test('upload live check boundary blocks forged live check, command, and mutation state', async () => {
  const credentialPresenceBoundary = await validCredentialPresenceBoundary();
  const boundary = buildKnowledgeTeamUploadLiveCheckBoundary({
    credentialPresenceBoundary: {
      ...credentialPresenceBoundary,
      remoteWriteAllowed: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      uploadExecutionAllowed: true,
      mutationApprovalGranted: true,
      clientCreated: true,
      adapterInjected: true,
      artifactBytesProvided: true,
      uploadCommand: 'infra-agent upload --should-not-run',
      credentialPresenceBoundary: {
        ...credentialPresenceBoundary.credentialPresenceBoundary,
        credentialValuesRead: true,
        credentialValuesExposed: true,
        credentialPresenceChecked: true,
        credentialPresenceResultExposed: true,
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
        executable: true
      },
      remainingExecutionBoundaries: {
        ...credentialPresenceBoundary.remainingExecutionBoundaries,
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
  assert.equal(codes.has('credential-values-read'), true);
  assert.equal(codes.has('credential-presence-check-enabled'), true);
  assert.equal(codes.has('credential-presence-result-exposed'), true);
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
  assertExecutionAndLiveCheckDisabled(boundary);
});

test('upload live check boundary reports credential, backend, and probe details without copying values', async () => {
  const credentialPresenceBoundary = await validCredentialPresenceBoundary();
  const boundary = buildKnowledgeTeamUploadLiveCheckBoundary({
    credentialPresenceBoundary: {
      ...credentialPresenceBoundary,
      sourceCredentialReadBoundary: {
        ...credentialPresenceBoundary.sourceCredentialReadBoundary,
        endpointUrl: 'https://should-not-copy.example.test',
        bucketName: 'should-not-copy-bucket'
      },
      credentialPresenceBoundary: {
        ...credentialPresenceBoundary.credentialPresenceBoundary,
        clientConfig: {
          accessKey: 'should-not-copy-secret'
        },
        clientFactoryValue: 'client-secret-value',
        credentialValue: 'credential-secret-value',
        credentialFile: '/home/private/credential.json',
        credentialPresenceResultValue: true,
        liveCheckResult: 'live-check-result',
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
  assert.equal(codes.has('live-check-enabled'), true);
  assertExecutionAndLiveCheckDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload live check boundary validation rejects forged live check state', async () => {
  const credentialPresenceBoundary = await validCredentialPresenceBoundary();
  const boundary = buildKnowledgeTeamUploadLiveCheckBoundary({ credentialPresenceBoundary });
  const readyValidation = validateKnowledgePayload(boundary, 'knowledge-pack.upload-live-check-boundary.json');

  assert.equal(readyValidation.valid, true);

  const validation = validateKnowledgePayload({
    ...boundary,
    credentialValuesExposed: true,
    credentialPresenceChecked: true,
    clientCreated: true,
    adapterInjected: true,
    sourceCredentialPresenceBoundary: {
      ...boundary.sourceCredentialPresenceBoundary,
      source: 'upload-credential-read-boundary',
      boundaryStatus: 'blocked',
      boundaryKind: 'unsupported',
      boundaryNextAction: 'resolve-blockers',
      adapterBackendKind: 's3-compatible',
      credentialValuesRead: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      credentialPresenceResultExposed: true,
      clientCreated: true,
      sdkClientCreated: true,
      adapterInjected: true,
      artifactObjectStoreBound: true,
      metadataIndexBound: true,
      liveCheckPerformed: true,
      uploadCommandGenerated: true,
      executable: true
    },
    liveCheckBoundary: {
      ...boundary.liveCheckBoundary,
      credentialValuesRead: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      credentialPresenceResultExposed: true,
      clientCreated: true,
      sdkClientCreated: true,
      adapterInjected: true,
      artifactObjectStoreBound: true,
      metadataIndexBound: true,
      liveCheckAllowed: true,
      liveCheckPerformed: true,
      liveCheckResultExposed: true,
      uploadExecutionAllowed: true,
      uploadCommandGenerated: true,
      objectWriteAttempted: true,
      metadataIndexWriteAttempted: true,
      remoteMutationPerformed: true,
      executable: true,
      liveCheckResult: 'should-not-exist'
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
  }, 'knowledge-pack.upload-live-check-boundary.json');

  assert.equal(validation.valid, false);
  assert.equal(validation.issues.some(issue => issue.path === '$.credentialValuesExposed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.credentialPresenceChecked'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.clientCreated'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.adapterInjected'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceCredentialPresenceBoundary.source'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceCredentialPresenceBoundary.boundaryStatus'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceCredentialPresenceBoundary.boundaryKind'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceCredentialPresenceBoundary.boundaryNextAction'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceCredentialPresenceBoundary.adapterBackendKind'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceCredentialPresenceBoundary.credentialValuesRead'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceCredentialPresenceBoundary.credentialPresenceResultExposed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceCredentialPresenceBoundary.liveCheckPerformed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceCredentialPresenceBoundary.uploadCommandGenerated'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceCredentialPresenceBoundary.executable'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.liveCheckBoundary.credentialValuesRead'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.liveCheckBoundary.credentialPresenceChecked'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.liveCheckBoundary.liveCheckAllowed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.liveCheckBoundary.liveCheckPerformed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.liveCheckBoundary.liveCheckResultExposed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.liveCheckBoundary.liveCheckResult'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.clientCreated'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.objectWriteAllowed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.metadataIndexWriteAllowed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.remoteMutationAllowed'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.readiness.nextAction'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.readiness.blockerCount'), true);
});

test('upload live check boundary validation rejects missing ready prerequisites', async () => {
  const credentialPresenceBoundary = await validCredentialPresenceBoundary();
  const boundary = buildKnowledgeTeamUploadLiveCheckBoundary({ credentialPresenceBoundary });
  const validation = validateKnowledgePayload({
    ...boundary,
    uploadApproved: true,
    uploadExecutionAllowed: true,
    mutationApprovalGranted: true,
    artifactBytesProvided: true,
    writeTokenIssued: true,
    executionLeaseCreated: true,
    rollbackPlanCreated: true,
    auditRecordCreated: true,
    objectWriteAttempted: true,
    metadataIndexWriteAttempted: true,
    remoteMutationPerformed: true,
    target: {
      ...boundary.target,
      manifestId: null,
      artifactId: 'not-a-safe-id',
      objectSha256: null,
      objectKey: null
    },
    sourceCredentialPresenceBoundary: {
      ...boundary.sourceCredentialPresenceBoundary,
      reviewStatus: 'blocked',
      reviewKind: 'unsupported',
      scopeMatched: false,
      humanReviewRecorded: false,
      fingerprintVerified: false,
      sourceFingerprintVerified: false,
      adapterName: null,
      dryRunOnly: false,
      credentialPresenceCheckRequiredBeforeExecution: false,
      credentialPresenceCheckRequiredAfterCredentialReadBoundary: false,
      credentialReadBoundaryRequired: false,
      credentialSourceDescriptorRequired: false,
      credentialReferenceOnlyRequired: false,
      credentialValueRedactionRequired: false,
      credentialPresenceSignalRequired: false,
      credentialPresenceResultRedactionRequired: false,
      mockAdapterRequired: false,
      clientFactoryDescriptorRequired: false,
      liveCheckBoundaryRequired: false,
      uploadCommandBoundaryRequired: false,
      artifactObjectStoreDependencyRequired: false,
      metadataIndexDependencyRequired: false,
      contentAddressedObjectKeysRequired: false,
      contentAddressedIndexKeysRequired: false,
      idempotentWritesRequired: false,
      explicitUploadApprovalRequired: false
    },
    liveCheckBoundary: {
      ...boundary.liveCheckBoundary,
      dryRunOnly: false,
      liveCheckRequiredBeforeExecution: false,
      liveCheckRequiredAfterCredentialPresenceBoundary: false,
      credentialPresenceBoundaryRequired: false,
      credentialReadBoundaryRequired: false,
      liveCheckPolicyRequired: false,
      liveCheckReadOnlyRequired: false,
      liveCheckResultRedactionRequired: false
    },
    remainingExecutionBoundaries: {
      ...boundary.remainingExecutionBoundaries,
      artifactBytesRequired: false,
      adapterInjectionRequired: false,
      clientCreationRequired: false,
      credentialReadRequired: false,
      credentialPresenceCheckRequired: false,
      liveCheckRequired: false,
      uploadCommandRequired: false,
      writeTokenRequired: false,
      executionLeaseRequired: false,
      rollbackPlanRequired: false,
      auditRecordRequired: false
    }
  }, 'knowledge-pack.upload-live-check-boundary.json');

  assert.equal(validation.valid, false);
  assert.equal(validation.issues.some(issue => issue.path === '$.uploadApproved'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.target.manifestId'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.target.artifactId'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceCredentialPresenceBoundary.reviewStatus'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceCredentialPresenceBoundary.adapterName'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.sourceCredentialPresenceBoundary.liveCheckBoundaryRequired'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.liveCheckBoundary.liveCheckPolicyRequired'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.liveCheckBoundary.liveCheckRequiredBeforeExecution'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.liveCheckRequired'), true);
  assert.equal(validation.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.uploadCommandRequired'), true);
});
