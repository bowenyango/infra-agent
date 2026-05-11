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

function validPlanRulesUpdateRecord() {
  const planRulesReview = buildKnowledgeTeamUploadExecutionPlanRulesReview({
    executionAuthorizationBoundary: validAuthorizationBoundary()
  });
  return buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord({
    planRulesReview,
    reviewFingerprint: planRulesReview.planRulesReview.reviewFingerprint.value
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
  assert.equal(boundary.implementationBoundary.implementationAllowed, false);
  assert.equal(boundary.implementationBoundary.authorizationGranted, false);
  assert.equal(boundary.implementationBoundary.executionAuthorizationGranted, false);
  assert.equal(boundary.implementationBoundary.uploadApproved, false);
  assert.equal(boundary.implementationBoundary.uploadExecutionApproved, false);
  assert.equal(boundary.implementationBoundary.uploadExecutionAllowed, false);
  assert.equal(boundary.implementationBoundary.mutationApprovalGranted, false);
  assert.equal(boundary.implementationBoundary.executable, false);
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
    'authorization-secret-value'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

test('upload execution implementation boundary records ready update record without enabling execution', () => {
  const updateRecord = validPlanRulesUpdateRecord();
  const boundary = buildKnowledgeTeamUploadExecutionImplementationBoundary({
    planRulesUpdateRecord: updateRecord
  });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-execution-implementation-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'upload-execution-implementation-boundary-dry-run');
  assert.equal(boundary.status, 'upload-execution-implementation-boundary-ready', JSON.stringify(boundary.readiness.blockers));
  assert.equal(boundary.readiness.nextAction, 'design-upload-execution-runtime-boundaries');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assert.equal(boundary.target.objectKeyRedacted, true);
  assert.equal(Object.hasOwn(boundary.target, 'objectKey'), false);
  assert.equal(boundary.target.manifestId, updateRecord.target.manifestId);
  assert.equal(boundary.target.objectSha256, updateRecord.target.objectSha256);
  assert.equal(boundary.target.artifactId, updateRecord.target.artifactId);
  assert.equal(boundary.sourcePlanRulesUpdateRecord.recordStatus, 'upload-execution-plan-rules-update-record-ready');
  assert.equal(boundary.sourcePlanRulesUpdateRecord.recordNextAction, 'design-upload-execution-implementation-boundary');
  assert.equal(boundary.sourcePlanRulesUpdateRecord.planRulesUpdateRecorded, true);
  assert.equal(boundary.sourcePlanRulesUpdateRecord.rulesUpdateReviewed, true);
  assert.equal(boundary.sourcePlanRulesUpdateRecord.fingerprintVerified, true);
  assert.equal(boundary.sourcePlanRulesUpdateRecord.updateRecordFingerprint.value, updateRecord.planRulesUpdateRecord.recordFingerprint.value);
  assert.equal(boundary.implementationBoundary.implementationBoundaryDesigned, true);
  assert.equal(boundary.implementationBoundary.sourceUpdateRecordFingerprintVerified, true);
  assert.equal(boundary.implementationBoundary.runtimeBoundaryDesignRequired, true);
  assert.equal(boundary.implementationBoundary.implementationBoundaryFingerprint.scope, 'stage-knowledge-pack-upload-execution-implementation-boundary-v1');
  assert.equal(boundary.implementationBoundary.implementationBoundaryFingerprint.canonicalFieldCount, 18);
  assert.match(boundary.implementationBoundary.implementationBoundaryFingerprint.value, /^[a-f0-9]{64}$/);
  assertExecutionDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload execution implementation boundary blocks non-ready update records', () => {
  const updateRecord = validPlanRulesUpdateRecord();
  const boundary = buildKnowledgeTeamUploadExecutionImplementationBoundary({
    planRulesUpdateRecord: {
      ...updateRecord,
      status: 'blocked',
      readiness: {
        ...updateRecord.readiness,
        status: 'blocked',
        nextAction: 'resolve-blockers',
        blockerCount: 1
      }
    }
  });

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.readiness.nextAction, 'resolve-blockers');
  assert.equal(boundary.implementationBoundary.implementationBoundaryDesigned, false);
  assert.equal(boundary.implementationBoundary.implementationBoundaryFingerprint.value, null);
  assert.ok(boundary.readiness.blockerCodes.includes('plan-rules-update-record-not-ready'));
  assert.ok(boundary.readiness.blockerCodes.includes('plan-rules-update-record-next-action-invalid'));
  assertExecutionDisabled(boundary);
});

test('upload execution implementation boundary blocks primitive and malformed inputs', () => {
  const boundary = buildKnowledgeTeamUploadExecutionImplementationBoundary({
    planRulesUpdateRecord: 's3://private-bucket/team-artifacts/private-key.json'
  });

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.target.manifestId, null);
  assert.equal(boundary.sourcePlanRulesUpdateRecord.recordStatus, 'invalid');
  assert.equal(boundary.sourcePlanRulesUpdateRecord.recordKind, 'unsupported');
  assert.equal(boundary.sourcePlanRulesUpdateRecord.recordNextAction, 'invalid');
  assert.equal(boundary.implementationBoundary.implementationBoundaryDesigned, false);
  assert.equal(boundary.implementationBoundary.implementationBoundaryFingerprint.value, null);
  assert.ok(boundary.readiness.blockerCodes.includes('backend-detail-leak'));
  assert.ok(boundary.readiness.blockerCodes.includes('missing-required-field'));
  assertExecutionDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload execution implementation boundary blocks forged execution and leaky material', () => {
  const updateRecord = validPlanRulesUpdateRecord();
  const boundary = buildKnowledgeTeamUploadExecutionImplementationBoundary({
    planRulesUpdateRecord: {
      ...updateRecord,
      liveCheckAllowed: true,
      uploadExecutionAllowed: true,
      uploadCommand: { value: 'signed-upload-command' },
      target: {
        ...updateRecord.target,
        objectKey: 'team-artifacts/public-reference/aa/bb/private-key.json'
      },
      sourcePlanRulesReview: {
        ...updateRecord.sourcePlanRulesReview,
        authorizationGranted: true,
        executionAuthorizationGranted: true,
        uploadExecutionAllowed: true
      },
      planRulesUpdateRecord: {
        ...updateRecord.planRulesUpdateRecord,
        policyUpdateAuthorized: true,
        authorizationGranted: true,
        executionAuthorizationGranted: true,
        uploadExecutionAllowed: true
      },
      executionBoundary: {
        ...updateRecord.executionBoundary,
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
    'authorization-already-granted',
    'upload-execution-authorization-already-provided',
    'implementation-enabled-execution'
  ]) {
    assert.ok(boundary.readiness.blockerCodes.includes(code), code);
  }
  assertExecutionDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload execution implementation boundary blocks malformed source summaries and fingerprints', () => {
  const updateRecord = validPlanRulesUpdateRecord();
  const boundary = buildKnowledgeTeamUploadExecutionImplementationBoundary({
    planRulesUpdateRecord: {
      ...updateRecord,
      kind: 'infra-agent.knowledge-team-upload-execution-authorization-boundary',
      schemaVersion: 2,
      mutationAllowed: true,
      executionMode: 'live',
      recordKind: 'live-upload',
      readiness: {
        ...updateRecord.readiness,
        nextAction: 'execute-upload'
      },
      target: {
        manifestId: 'not-safe',
        artifactId: 'also-not-safe',
        objectSha256: 'not-a-sha',
        objectKeyRedacted: false,
        objectKey: 'team-artifacts/public-reference/aa/bb/private-key.json'
      },
      sourcePlanRulesReview: {
        ...updateRecord.sourcePlanRulesReview,
        reviewStatus: 'blocked',
        reviewKind: 'live-review',
        reviewNextAction: 'execute-upload',
        scopeMatched: false,
        humanApprovalRecorded: false,
        approvalFingerprintVerified: false,
        authorizationBoundaryDesigned: false,
        planRulesUpdateReviewRequired: false,
        planRulesUpdated: true,
        approvalGranted: true,
        adapterName: '../private-adapter',
        adapterBackendKind: 's3-compatible',
        sourceApprovalRecordFingerprint: {
          algorithm: 'md5',
          scope: 'wrong-scope',
          value: 'not-a-fingerprint',
          canonicalFieldCount: 0
        },
        sourceAuthorizationBoundaryFingerprint: null,
        reviewFingerprint: {
          algorithm: 'sha256',
          scope: 'stage-knowledge-pack-upload-execution-plan-rules-review-v1',
          value: 'z'.repeat(64),
          canonicalFieldCount: 0
        }
      },
      planRulesUpdateRecord: {
        ...updateRecord.planRulesUpdateRecord,
        planRulesUpdateRecorded: false,
        rulesUpdateReviewed: false,
        executionStillDisabled: false,
        fingerprintVerified: false,
        recordFingerprint: {
          algorithm: 'sha256',
          scope: 'wrong-scope',
          value: null,
          canonicalFieldCount: 18
        }
      }
    }
  });

  assert.equal(boundary.status, 'blocked');
  for (const code of [
    'invalid-plan-rules-update-record-kind',
    'invalid-schema-version',
    'mutation-enabled',
    'plan-rules-update-record-next-action-invalid',
    'plan-rules-update-record-not-ready',
    'unsafe-artifact-reference',
    'unsafe-adapter-name',
    'unsupported-adapter-backend',
    'scope-not-matched',
    'authorization-already-granted',
    'executable-state-enabled',
    'review-fingerprint-unverified',
    'plan-rules-update-record-fingerprint-missing',
    'plan-rules-update-record-fingerprint-unsupported'
  ]) {
    assert.ok(boundary.readiness.blockerCodes.includes(code), code);
  }
  assert.equal(boundary.target.manifestId, null);
  assert.equal(boundary.target.artifactId, null);
  assert.equal(boundary.target.objectSha256, null);
  assert.equal(boundary.sourcePlanRulesUpdateRecord.adapterName, null);
  assert.equal(boundary.sourcePlanRulesUpdateRecord.adapterBackendKind, 's3-compatible');
  assert.equal(boundary.sourcePlanRulesUpdateRecord.updateRecordFingerprint.value, null);
  assert.equal(boundary.implementationBoundary.implementationBoundaryFingerprint.value, null);
  assertExecutionDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload execution implementation boundary blocks missing sections and every disabled execution family', () => {
  const updateRecord = validPlanRulesUpdateRecord();
  const boundary = buildKnowledgeTeamUploadExecutionImplementationBoundary({
    planRulesUpdateRecord: {
      ...updateRecord,
      remoteWriteAllowed: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      uploadApproved: true,
      uploadExecutionApproved: true,
      mutationApprovalGranted: true,
      clientCreated: true,
      adapterInjected: true,
      artifactBytesProvided: true,
      writeTokenIssued: true,
      executionLeaseCreated: true,
      rollbackPlanCreated: true,
      auditRecordCreated: true,
      remoteMutationPerformed: true,
      sourcePlanRulesReview: null,
      planRulesUpdateRecord: null,
      executionBoundary: {
        dryRunOnly: false,
        executable: true,
        credentialValuesRead: true,
        credentialPresenceResultExposed: true,
        liveCheckResultExposed: true,
        uploadCommandMaterialized: true,
        uploadCommandExposed: true,
        artifactObjectStoreBound: true,
        metadataIndexBound: true,
        objectStoreHandleExposed: true,
        metadataIndexHandleExposed: true,
        objectWriteAllowed: true,
        metadataIndexWriteAllowed: true
      },
      nestedLeaks: [
        {
          adapterInstance: 'private-adapter',
          artifactPath: '/tmp/private-artifact',
          credentialPresenceResult: 'credential-secret-value',
          signedUrl: 'https://should-not-copy.example.test/signed'
        }
      ]
    }
  });

  assert.equal(boundary.status, 'blocked');
  for (const code of [
    'missing-required-field',
    'remote-write-enabled',
    'credential-values-exposed',
    'credential-presence-check-enabled',
    'upload-approval-already-provided',
    'upload-execution-approval-already-provided',
    'mutation-approval-already-granted',
    'client-created',
    'adapter-injected',
    'artifact-bytes-provided',
    'write-token-issued',
    'execution-lease-created',
    'rollback-plan-created',
    'audit-record-created',
    'remote-mutation-performed',
    'executable-state-enabled',
    'credential-values-read',
    'credential-presence-result-exposed',
    'live-check-result-exposed',
    'upload-command-generated',
    'upload-command-exposed',
    'artifact-object-store-bound',
    'metadata-index-bound',
    'object-store-handle-leak',
    'metadata-index-handle-leak',
    'object-write-attempted',
    'metadata-index-write-attempted',
    'adapter-dependency-leak',
    'client-dependency-leak',
    'credential-dependency-leak'
  ]) {
    assert.ok(boundary.readiness.blockerCodes.includes(code), code);
  }
  assert.equal(boundary.sourcePlanRulesUpdateRecord.sourceReviewStatus, 'invalid');
  assert.equal(boundary.sourcePlanRulesUpdateRecord.updateRecordFingerprint.value, null);
  assertExecutionDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload execution implementation boundary blocks missing target and source approval drift', () => {
  const updateRecord = validPlanRulesUpdateRecord();
  const boundary = buildKnowledgeTeamUploadExecutionImplementationBoundary({
    planRulesUpdateRecord: {
      ...updateRecord,
      target: null,
      executionBoundary: null,
      planRulesUpdateRecord: {
        ...updateRecord.planRulesUpdateRecord,
        uploadApproved: true,
        uploadExecutionApproved: true,
        mutationApprovalGranted: true
      }
    }
  });

  assert.equal(boundary.status, 'blocked');
  for (const code of [
    'missing-required-field',
    'upload-approval-already-provided',
    'upload-execution-approval-already-provided',
    'mutation-approval-already-granted'
  ]) {
    assert.ok(boundary.readiness.blockerCodes.includes(code), code);
  }
  assert.equal(boundary.target.manifestId, null);
  assert.equal(boundary.target.objectSha256, null);
  assert.equal(boundary.target.artifactId, null);
  assert.equal(boundary.implementationBoundary.implementationBoundaryFingerprint.value, null);
  assertExecutionDisabled(boundary);
});
