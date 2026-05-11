import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeTeamUploadExecutionPlanRulesReview
} from '../../src/knowledge/team-upload-execution-plan-rules-review.ts';
import {
  buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord
} from '../../src/knowledge/team-upload-execution-plan-rules-update-record.ts';
import {
  buildKnowledgeTeamUploadExecutionImplementationBoundary
} from '../../src/knowledge/team-upload-execution-implementation-boundary.ts';
import {
  buildKnowledgeTeamUploadExecutionRuntimeBoundaries
} from '../../src/knowledge/team-upload-execution-runtime-boundaries.ts';

const SAFE_ID = '0123456789abcdef01234567';
const SAFE_ARTIFACT_ID = 'abcdef0123456789abcdef01';
const SAFE_SHA = 'a'.repeat(64);
const SOURCE_APPROVAL_RECORD_FINGERPRINT = 'b'.repeat(64);
const SOURCE_AUTHORIZATION_FINGERPRINT = 'c'.repeat(64);

function validAuthorizationBoundary() {
  return {
    kind: 'infra-agent.knowledge-team-upload-execution-authorization-boundary',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    boundaryKind: 'upload-execution-authorization-boundary-dry-run',
    status: 'upload-execution-authorization-boundary-ready',
    plannedOperation: 'stage-knowledge-pack',
    remoteWriteAllowed: false,
    liveCheckAllowed: false,
    credentialValuesExposed: false,
    credentialPresenceChecked: false,
    uploadApproved: false,
    uploadExecutionApproved: false,
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
    target: {
      manifestId: SAFE_ID,
      objectKeyRedacted: true,
      objectSha256: SAFE_SHA,
      artifactId: SAFE_ARTIFACT_ID
    },
    sourceApprovalRecord: {
      scopeMatched: true,
      adapterName: 'mock-team-cache',
      adapterBackendKind: 'mock-s3-compatible'
    },
    authorizationBoundary: {
      dryRunOnly: true,
      uploadExecutionAuthorizationRequired: true,
      humanApprovalRecorded: true,
      approvalFingerprintVerified: true,
      authorizationBoundaryDesigned: true,
      authorizationGranted: false,
      executionAuthorizationGranted: false,
      approvalGranted: false,
      uploadApproved: false,
      uploadExecutionApproved: false,
      uploadExecutionAllowed: false,
      mutationApprovalGranted: false,
      executable: false,
      objectWriteAllowed: false,
      metadataIndexWriteAllowed: false,
      objectWriteAttempted: false,
      metadataIndexWriteAttempted: false,
      remoteMutationPerformed: false,
      sourceApprovalRecordFingerprint: {
        algorithm: 'sha256',
        scope: 'stage-knowledge-pack-upload-execution-approval-record-v1',
        value: SOURCE_APPROVAL_RECORD_FINGERPRINT,
        canonicalFieldCount: 14
      },
      authorizationBoundaryFingerprint: {
        algorithm: 'sha256',
        scope: 'stage-knowledge-pack-upload-execution-authorization-boundary-v1',
        value: SOURCE_AUTHORIZATION_FINGERPRINT,
        canonicalFieldCount: 16
      }
    },
    executionBoundary: {
      dryRunOnly: true,
      executable: false,
      artifactBytesProvided: false,
      adapterInjected: false,
      clientCreated: false,
      credentialValuesRead: false,
      credentialValuesExposed: false,
      credentialPresenceChecked: false,
      credentialPresenceResultExposed: false,
      liveCheckAllowed: false,
      liveCheckPerformed: false,
      liveCheckResultExposed: false,
      uploadCommandGenerated: false,
      uploadCommandMaterialized: false,
      uploadCommandExposed: false,
      artifactObjectStoreBound: false,
      metadataIndexBound: false,
      objectStoreHandleExposed: false,
      metadataIndexHandleExposed: false,
      objectWriteAllowed: false,
      metadataIndexWriteAllowed: false,
      objectWriteAttempted: false,
      metadataIndexWriteAttempted: false,
      writeTokenIssued: false,
      executionLeaseCreated: false,
      rollbackPlanCreated: false,
      auditRecordCreated: false,
      remoteMutationPerformed: false
    },
    readiness: {
      status: 'upload-execution-authorization-boundary-ready',
      nextAction: 'await-plan-rules-update-for-upload-execution',
      blockerCount: 0,
      blockerCodes: [],
      blockers: [],
      reason: 'ready'
    }
  };
}

function validImplementationBoundary() {
  const planRulesReview = buildKnowledgeTeamUploadExecutionPlanRulesReview({
    executionAuthorizationBoundary: validAuthorizationBoundary()
  });
  const updateRecord = buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord({
    planRulesReview,
    reviewFingerprint: planRulesReview.planRulesReview.reviewFingerprint.value
  });
  return buildKnowledgeTeamUploadExecutionImplementationBoundary({
    planRulesUpdateRecord: updateRecord
  });
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
  assert.equal(boundary.runtimeBoundaries.runtimeExecutionAllowed, false);
  assert.equal(boundary.runtimeBoundaries.authorizationGranted, false);
  assert.equal(boundary.runtimeBoundaries.executionAuthorizationGranted, false);
  assert.equal(boundary.runtimeBoundaries.uploadApproved, false);
  assert.equal(boundary.runtimeBoundaries.uploadExecutionApproved, false);
  assert.equal(boundary.runtimeBoundaries.uploadExecutionAllowed, false);
  assert.equal(boundary.runtimeBoundaries.mutationApprovalGranted, false);
  assert.equal(boundary.runtimeBoundaries.executable, false);
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

function assertNoPrivateValues(value) {
  const text = JSON.stringify(value);
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
    'runtime-secret-value'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

test('upload execution runtime boundaries record ready implementation boundary without enabling execution', () => {
  const implementationBoundary = validImplementationBoundary();
  const boundary = buildKnowledgeTeamUploadExecutionRuntimeBoundaries({
    implementationBoundary
  });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-execution-runtime-boundaries');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'upload-execution-runtime-boundaries-dry-run');
  assert.equal(boundary.status, 'upload-execution-runtime-boundaries-ready', JSON.stringify(boundary.readiness.blockers));
  assert.equal(boundary.readiness.nextAction, 'await-explicit-upload-execution-runtime-boundary-policy-review');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assert.equal(boundary.target.objectKeyRedacted, true);
  assert.equal(Object.hasOwn(boundary.target, 'objectKey'), false);
  assert.equal(boundary.target.manifestId, implementationBoundary.target.manifestId);
  assert.equal(boundary.target.objectSha256, implementationBoundary.target.objectSha256);
  assert.equal(boundary.target.artifactId, implementationBoundary.target.artifactId);
  assert.equal(boundary.sourceImplementationBoundary.boundaryStatus, 'upload-execution-implementation-boundary-ready');
  assert.equal(boundary.sourceImplementationBoundary.boundaryNextAction, 'design-upload-execution-runtime-boundaries');
  assert.equal(boundary.sourceImplementationBoundary.implementationBoundaryDesigned, true);
  assert.equal(boundary.sourceImplementationBoundary.sourceUpdateRecordFingerprintVerified, true);
  assert.equal(boundary.sourceImplementationBoundary.runtimeBoundaryDesignRequired, true);
  assert.equal(boundary.sourceImplementationBoundary.implementationBoundaryFingerprint.value, implementationBoundary.implementationBoundary.implementationBoundaryFingerprint.value);
  assert.equal(boundary.runtimeBoundaries.runtimeBoundariesDesigned, true);
  assert.equal(boundary.runtimeBoundaries.sourceImplementationBoundaryFingerprintVerified, true);
  assert.equal(boundary.runtimeBoundaries.separateRuntimeArtifactsRequired, true);
  assert.equal(boundary.runtimeBoundaries.artifactBytesRuntimeBoundaryRequired, true);
  assert.equal(boundary.runtimeBoundaries.adapterInjectionRuntimeBoundaryRequired, true);
  assert.equal(boundary.runtimeBoundaries.clientCreationRuntimeBoundaryRequired, true);
  assert.equal(boundary.runtimeBoundaries.credentialReadRuntimeBoundaryRequired, true);
  assert.equal(boundary.runtimeBoundaries.credentialPresenceRuntimeBoundaryRequired, true);
  assert.equal(boundary.runtimeBoundaries.liveCheckRuntimeBoundaryRequired, true);
  assert.equal(boundary.runtimeBoundaries.uploadCommandRuntimeBoundaryRequired, true);
  assert.equal(boundary.runtimeBoundaries.objectIndexBindingRuntimeBoundaryRequired, true);
  assert.equal(boundary.runtimeBoundaries.writeTokenRuntimeBoundaryRequired, true);
  assert.equal(boundary.runtimeBoundaries.executionLeaseRuntimeBoundaryRequired, true);
  assert.equal(boundary.runtimeBoundaries.rollbackPlanRuntimeBoundaryRequired, true);
  assert.equal(boundary.runtimeBoundaries.auditRecordRuntimeBoundaryRequired, true);
  assert.equal(boundary.runtimeBoundaries.runtimeBoundariesFingerprint.scope, 'stage-knowledge-pack-upload-execution-runtime-boundaries-v1');
  assert.equal(boundary.runtimeBoundaries.runtimeBoundariesFingerprint.canonicalFieldCount, 20);
  assert.match(boundary.runtimeBoundaries.runtimeBoundariesFingerprint.value, /^[a-f0-9]{64}$/);
  assertExecutionDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload execution runtime boundaries block non-ready implementation boundaries', () => {
  const implementationBoundary = validImplementationBoundary();
  const boundary = buildKnowledgeTeamUploadExecutionRuntimeBoundaries({
    implementationBoundary: {
      ...implementationBoundary,
      status: 'blocked',
      readiness: {
        ...implementationBoundary.readiness,
        status: 'blocked',
        nextAction: 'resolve-blockers',
        blockerCount: 1
      }
    }
  });

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.readiness.nextAction, 'resolve-blockers');
  assert.equal(boundary.runtimeBoundaries.runtimeBoundariesDesigned, false);
  assert.equal(boundary.runtimeBoundaries.runtimeBoundariesFingerprint.value, null);
  assert.ok(boundary.readiness.blockerCodes.includes('implementation-boundary-not-ready'));
  assert.ok(boundary.readiness.blockerCodes.includes('implementation-boundary-next-action-invalid'));
  assertExecutionDisabled(boundary);
});

test('upload execution runtime boundaries block primitive and malformed inputs', () => {
  const boundary = buildKnowledgeTeamUploadExecutionRuntimeBoundaries({
    implementationBoundary: 's3://private-bucket/team-artifacts/private-key.json'
  });

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.target.manifestId, null);
  assert.equal(boundary.sourceImplementationBoundary.boundaryStatus, 'invalid');
  assert.equal(boundary.sourceImplementationBoundary.boundaryKind, 'unsupported');
  assert.equal(boundary.sourceImplementationBoundary.boundaryNextAction, 'invalid');
  assert.equal(boundary.runtimeBoundaries.runtimeBoundariesDesigned, false);
  assert.equal(boundary.runtimeBoundaries.runtimeBoundariesFingerprint.value, null);
  assert.ok(boundary.readiness.blockerCodes.includes('backend-detail-leak'));
  assert.ok(boundary.readiness.blockerCodes.includes('missing-required-field'));
  assertExecutionDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload execution runtime boundaries block forged execution and leaky material', () => {
  const implementationBoundary = validImplementationBoundary();
  const boundary = buildKnowledgeTeamUploadExecutionRuntimeBoundaries({
    implementationBoundary: {
      ...implementationBoundary,
      liveCheckAllowed: true,
      uploadExecutionAllowed: true,
      uploadCommand: { value: 'signed-upload-command' },
      target: {
        ...implementationBoundary.target,
        objectKey: 'team-artifacts/public-reference/aa/bb/private-key.json'
      },
      sourcePlanRulesUpdateRecord: {
        ...implementationBoundary.sourcePlanRulesUpdateRecord,
        executionStillDisabled: false,
        adapterName: '../private-adapter',
        adapterBackendKind: 's3-compatible'
      },
      implementationBoundary: {
        ...implementationBoundary.implementationBoundary,
        implementationAllowed: true,
        authorizationGranted: true,
        executionAuthorizationGranted: true,
        uploadExecutionAllowed: true,
        sourceUpdateRecordFingerprint: {
          algorithm: 'md5',
          scope: 'wrong-scope',
          value: 'not-a-fingerprint',
          canonicalFieldCount: 0
        },
        implementationBoundaryFingerprint: null
      },
      executionBoundary: {
        ...implementationBoundary.executionBoundary,
        executable: true,
        uploadCommandGenerated: true,
        objectWriteAttempted: true,
        metadataIndexWriteAttempted: true
      },
      backendEndpointUrl: 'https://should-not-copy.example.test',
      bucket: 'should-not-copy-bucket',
      secretValue: 'should-not-copy-secret',
      artifactBytesPayload: 'raw-artifact-bytes',
      sdkClientConfig: 'client-secret-value',
      credentialValue: 'credential-secret-value',
      liveCheckResultValue: 'private-live-check-output',
      authorizationToken: 'authorization-secret-value',
      runtimeSecret: 'runtime-secret-value',
      objectStoreHandle: { putObject: 's3://private-bucket' },
      metadataIndexHandle: { putEntry: 'aws s3 cp private-key' }
    }
  });

  assert.equal(boundary.status, 'blocked');
  for (const code of [
    'upload-execution-enabled',
    'upload-command-present',
    'upload-command-generated',
    'object-write-attempted',
    'metadata-index-write-attempted',
    'backend-detail-leak',
    'artifact-bytes-provided',
    'client-dependency-leak',
    'credential-dependency-leak',
    'live-check-enabled',
    'authorization-material-leak',
    'object-store-handle-leak',
    'metadata-index-handle-leak',
    'implementation-enabled-execution',
    'authorization-already-granted',
    'upload-execution-authorization-already-provided',
    'implementation-boundary-fingerprint-missing',
    'implementation-boundary-fingerprint-unsupported',
    'implementation-boundary-fingerprint-unverified'
  ]) {
    assert.ok(boundary.readiness.blockerCodes.includes(code), code);
  }
  assert.equal(boundary.sourceImplementationBoundary.adapterName, null);
  assert.equal(boundary.sourceImplementationBoundary.adapterBackendKind, 's3-compatible');
  assert.equal(boundary.sourceImplementationBoundary.sourceUpdateRecordFingerprint.value, null);
  assert.equal(boundary.sourceImplementationBoundary.implementationBoundaryFingerprint.value, null);
  assert.equal(boundary.runtimeBoundaries.runtimeBoundariesFingerprint.value, null);
  assertExecutionDisabled(boundary);
  assertNoPrivateValues(boundary);
});
