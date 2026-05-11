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
import {
  buildKnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReview
} from '../../src/knowledge/team-upload-execution-runtime-boundary-policy-review.ts';

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

function validRuntimeBoundaries() {
  const planRulesReview = buildKnowledgeTeamUploadExecutionPlanRulesReview({
    executionAuthorizationBoundary: validAuthorizationBoundary()
  });
  const updateRecord = buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord({
    planRulesReview,
    reviewFingerprint: planRulesReview.planRulesReview.reviewFingerprint.value
  });
  const implementationBoundary = buildKnowledgeTeamUploadExecutionImplementationBoundary({
    planRulesUpdateRecord: updateRecord
  });
  return buildKnowledgeTeamUploadExecutionRuntimeBoundaries({
    implementationBoundary
  });
}

function assertExecutionDisabled(review) {
  assert.equal(review.mutationAllowed, false);
  assert.equal(review.executionMode, 'dry-run');
  assert.equal(review.remoteWriteAllowed, false);
  assert.equal(review.liveCheckAllowed, false);
  assert.equal(review.credentialValuesExposed, false);
  assert.equal(review.credentialPresenceChecked, false);
  assert.equal(review.uploadApproved, false);
  assert.equal(review.uploadExecutionApproved, false);
  assert.equal(review.uploadExecutionAllowed, false);
  assert.equal(review.mutationApprovalGranted, false);
  assert.equal(review.clientCreated, false);
  assert.equal(review.adapterInjected, false);
  assert.equal(review.artifactBytesProvided, false);
  assert.equal(review.writeTokenIssued, false);
  assert.equal(review.executionLeaseCreated, false);
  assert.equal(review.rollbackPlanCreated, false);
  assert.equal(review.auditRecordCreated, false);
  assert.equal(review.objectWriteAttempted, false);
  assert.equal(review.metadataIndexWriteAttempted, false);
  assert.equal(review.remoteMutationPerformed, false);
  assert.equal(review.uploadCommand, null);
  assert.equal(review.runtimeBoundaryPolicyReview.runtimeBoundaryPolicyUpdated, false);
  assert.equal(review.runtimeBoundaryPolicyReview.policyUpdateAuthorized, false);
  assert.equal(review.runtimeBoundaryPolicyReview.executionStillDisabled, true);
  assert.equal(review.runtimeBoundaryPolicyReview.runtimeExecutionStillProhibited, true);
  assert.equal(review.runtimeBoundaryPolicyReview.uploadExecutionStillProhibited, true);
  assert.equal(review.runtimeBoundaryPolicyReview.commandGenerationStillProhibited, true);
  assert.equal(review.runtimeBoundaryPolicyReview.objectWriteStillProhibited, true);
  assert.equal(review.runtimeBoundaryPolicyReview.metadataIndexWriteStillProhibited, true);
  assert.equal(review.executionBoundary.executable, false);
  assert.equal(review.executionBoundary.artifactBytesProvided, false);
  assert.equal(review.executionBoundary.adapterInjected, false);
  assert.equal(review.executionBoundary.clientCreated, false);
  assert.equal(review.executionBoundary.credentialValuesRead, false);
  assert.equal(review.executionBoundary.credentialValuesExposed, false);
  assert.equal(review.executionBoundary.credentialPresenceChecked, false);
  assert.equal(review.executionBoundary.credentialPresenceResultExposed, false);
  assert.equal(review.executionBoundary.liveCheckAllowed, false);
  assert.equal(review.executionBoundary.liveCheckPerformed, false);
  assert.equal(review.executionBoundary.liveCheckResultExposed, false);
  assert.equal(review.executionBoundary.uploadCommandGenerated, false);
  assert.equal(review.executionBoundary.uploadCommandMaterialized, false);
  assert.equal(review.executionBoundary.uploadCommandExposed, false);
  assert.equal(review.executionBoundary.artifactObjectStoreBound, false);
  assert.equal(review.executionBoundary.metadataIndexBound, false);
  assert.equal(review.executionBoundary.objectStoreHandleExposed, false);
  assert.equal(review.executionBoundary.metadataIndexHandleExposed, false);
  assert.equal(review.executionBoundary.objectWriteAllowed, false);
  assert.equal(review.executionBoundary.metadataIndexWriteAllowed, false);
  assert.equal(review.executionBoundary.objectWriteAttempted, false);
  assert.equal(review.executionBoundary.metadataIndexWriteAttempted, false);
  assert.equal(review.executionBoundary.writeTokenIssued, false);
  assert.equal(review.executionBoundary.executionLeaseCreated, false);
  assert.equal(review.executionBoundary.rollbackPlanCreated, false);
  assert.equal(review.executionBoundary.auditRecordCreated, false);
  assert.equal(review.executionBoundary.remoteMutationPerformed, false);
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
    'runtime-secret-value',
    'policy-update-secret'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

test('upload execution runtime-boundary policy review records ready runtime boundaries without enabling execution', () => {
  const runtimeBoundaries = validRuntimeBoundaries();
  const review = buildKnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReview({
    runtimeBoundaries
  });

  assert.equal(review.kind, 'infra-agent.knowledge-team-upload-execution-runtime-boundary-policy-review');
  assert.equal(review.schemaVersion, 1);
  assert.equal(review.reviewKind, 'upload-execution-runtime-boundary-policy-review-dry-run');
  assert.equal(review.status, 'upload-execution-runtime-boundary-policy-review-ready', JSON.stringify(review.readiness.blockers));
  assert.equal(review.readiness.nextAction, 'await-explicit-upload-execution-runtime-boundary-policy-update');
  assert.equal(review.readiness.blockerCount, 0);
  assert.deepEqual(review.readiness.blockerCodes, []);
  assert.equal(review.target.objectKeyRedacted, true);
  assert.equal(Object.hasOwn(review.target, 'objectKey'), false);
  assert.equal(review.target.manifestId, runtimeBoundaries.target.manifestId);
  assert.equal(review.target.objectSha256, runtimeBoundaries.target.objectSha256);
  assert.equal(review.target.artifactId, runtimeBoundaries.target.artifactId);
  assert.equal(review.sourceRuntimeBoundaries.boundaryStatus, 'upload-execution-runtime-boundaries-ready');
  assert.equal(review.sourceRuntimeBoundaries.boundaryNextAction, 'await-explicit-upload-execution-runtime-boundary-policy-review');
  assert.equal(review.sourceRuntimeBoundaries.runtimeBoundariesDesigned, true);
  assert.equal(review.sourceRuntimeBoundaries.sourceImplementationBoundaryFingerprintVerified, true);
  assert.equal(review.sourceRuntimeBoundaries.runtimeExecutionAllowed, false);
  assert.equal(review.sourceRuntimeBoundaries.executionStillDisabled, true);
  assert.equal(review.sourceRuntimeBoundaries.adapterName, 'mock-team-cache');
  assert.equal(review.sourceRuntimeBoundaries.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(review.sourceRuntimeBoundaries.runtimeBoundariesFingerprint.value, runtimeBoundaries.runtimeBoundaries.runtimeBoundariesFingerprint.value);
  assert.equal(review.runtimeBoundaryPolicyReview.runtimeBoundaryPolicyReviewRequired, true);
  assert.equal(review.runtimeBoundaryPolicyReview.runtimeBoundaryPolicyReviewed, true);
  assert.equal(review.runtimeBoundaryPolicyReview.artifactBytesPolicyReviewed, true);
  assert.equal(review.runtimeBoundaryPolicyReview.adapterInjectionPolicyReviewed, true);
  assert.equal(review.runtimeBoundaryPolicyReview.clientCreationPolicyReviewed, true);
  assert.equal(review.runtimeBoundaryPolicyReview.credentialReadPolicyReviewed, true);
  assert.equal(review.runtimeBoundaryPolicyReview.credentialPresencePolicyReviewed, true);
  assert.equal(review.runtimeBoundaryPolicyReview.liveCheckPolicyReviewed, true);
  assert.equal(review.runtimeBoundaryPolicyReview.commandGenerationPolicyReviewed, true);
  assert.equal(review.runtimeBoundaryPolicyReview.objectIndexBindingPolicyReviewed, true);
  assert.equal(review.runtimeBoundaryPolicyReview.writeTokenPolicyReviewed, true);
  assert.equal(review.runtimeBoundaryPolicyReview.executionLeasePolicyReviewed, true);
  assert.equal(review.runtimeBoundaryPolicyReview.rollbackPolicyReviewed, true);
  assert.equal(review.runtimeBoundaryPolicyReview.auditPolicyReviewed, true);
  assert.equal(review.runtimeBoundaryPolicyReview.remoteMutationPolicyReviewed, true);
  assert.deepEqual(review.toolCapabilityPolicy.allowedCapabilityFamilies, [
    'read-saved-json',
    'validate-contract',
    'write-local-artifact'
  ]);
  assert.ok(review.toolCapabilityPolicy.disallowedCapabilityFamilies.includes('remote-mutation'));
  assert.equal(review.handoffPolicy.compact, true);
  assert.equal(review.handoffPolicy.rawRuntimeIncluded, false);
  assert.equal(review.runtimeBoundaryPolicyReview.reviewFingerprint.scope, 'stage-knowledge-pack-upload-execution-runtime-boundary-policy-review-v1');
  assert.equal(review.runtimeBoundaryPolicyReview.reviewFingerprint.canonicalFieldCount, 24);
  assert.match(review.runtimeBoundaryPolicyReview.reviewFingerprint.value, /^[a-f0-9]{64}$/);
  assertExecutionDisabled(review);
  assertNoPrivateValues(review);
});

test('upload execution runtime-boundary policy review blocks non-ready runtime boundaries', () => {
  const runtimeBoundaries = validRuntimeBoundaries();
  const review = buildKnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReview({
    runtimeBoundaries: {
      ...runtimeBoundaries,
      status: 'blocked',
      readiness: {
        ...runtimeBoundaries.readiness,
        status: 'blocked',
        nextAction: 'resolve-blockers',
        blockerCount: 1
      }
    }
  });

  assert.equal(review.status, 'blocked');
  assert.equal(review.readiness.nextAction, 'resolve-blockers');
  assert.equal(review.runtimeBoundaryPolicyReview.runtimeBoundaryPolicyReviewed, false);
  assert.equal(review.runtimeBoundaryPolicyReview.reviewFingerprint.value, null);
  assert.ok(review.readiness.blockerCodes.includes('runtime-boundaries-not-ready'));
  assert.ok(review.readiness.blockerCodes.includes('runtime-boundaries-next-action-invalid'));
  assertExecutionDisabled(review);
});

test('upload execution runtime-boundary policy review blocks primitive and malformed inputs', () => {
  const review = buildKnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReview({
    runtimeBoundaries: 's3://private-bucket/team-artifacts/private-key.json'
  });

  assert.equal(review.status, 'blocked');
  assert.equal(review.target.manifestId, null);
  assert.equal(review.sourceRuntimeBoundaries.boundaryStatus, 'invalid');
  assert.equal(review.sourceRuntimeBoundaries.boundaryKind, 'unsupported');
  assert.equal(review.sourceRuntimeBoundaries.boundaryNextAction, 'invalid');
  assert.equal(review.runtimeBoundaryPolicyReview.runtimeBoundaryPolicyReviewed, false);
  assert.equal(review.runtimeBoundaryPolicyReview.reviewFingerprint.value, null);
  assert.ok(review.readiness.blockerCodes.includes('backend-detail-leak'));
  assert.ok(review.readiness.blockerCodes.includes('missing-required-field'));
  assertExecutionDisabled(review);
  assertNoPrivateValues(review);
});

test('upload execution runtime-boundary policy review blocks forged execution and leaky material', () => {
  const runtimeBoundaries = validRuntimeBoundaries();
  const review = buildKnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReview({
    runtimeBoundaries: {
      ...runtimeBoundaries,
      liveCheckAllowed: true,
      uploadExecutionAllowed: true,
      uploadCommand: { value: 'signed-upload-command' },
      runtimeBoundaryPolicyUpdated: true,
      policyUpdateAuthorized: true,
      target: {
        ...runtimeBoundaries.target,
        objectKey: 'team-artifacts/public-reference/aa/bb/private-key.json'
      },
      sourceImplementationBoundary: {
        ...runtimeBoundaries.sourceImplementationBoundary,
        adapterName: '../private-adapter',
        adapterBackendKind: 's3-compatible',
        implementationBoundaryFingerprint: {
          algorithm: 'md5',
          scope: 'wrong-scope',
          value: 'not-a-fingerprint',
          canonicalFieldCount: 0
        }
      },
      runtimeBoundaries: {
        ...runtimeBoundaries.runtimeBoundaries,
        runtimeBoundariesDesigned: false,
        sourceImplementationBoundaryFingerprintVerified: false,
        runtimeExecutionAllowed: true,
        executable: true,
        sourceImplementationBoundaryFingerprint: {
          algorithm: 'sha256',
          scope: 'stage-knowledge-pack-upload-execution-implementation-boundary-v1',
          value: 'd'.repeat(64),
          canonicalFieldCount: 18
        },
        runtimeBoundariesFingerprint: {
          algorithm: 'md5',
          scope: 'wrong-scope',
          value: 'not-a-fingerprint',
          canonicalFieldCount: 0
        }
      },
      executionBoundary: {
        ...runtimeBoundaries.executionBoundary,
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
      policyUpdatePayload: 'policy-update-secret',
      objectStoreHandle: { putObject: 's3://private-bucket' },
      metadataIndexHandle: { putEntry: 'aws s3 cp private-key' }
    }
  });

  assert.equal(review.status, 'blocked');
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
    'live-check-result-exposed',
    'authorization-material-leak',
    'object-store-handle-leak',
    'metadata-index-handle-leak',
    'policy-update-material-leak',
    'policy-update-already-recorded',
    'policy-update-already-authorized',
    'unsafe-artifact-reference',
    'unsupported-adapter-backend',
    'runtime-boundaries-not-ready',
    'runtime-boundaries-fingerprint-missing',
    'runtime-boundaries-fingerprint-unsupported',
    'runtime-boundaries-fingerprint-unverified',
    'executable-state-enabled'
  ]) {
    assert.ok(review.readiness.blockerCodes.includes(code), code);
  }
  assert.equal(review.sourceRuntimeBoundaries.adapterName, null);
  assert.equal(review.sourceRuntimeBoundaries.adapterBackendKind, 's3-compatible');
  assert.equal(review.sourceRuntimeBoundaries.runtimeBoundariesFingerprint.value, null);
  assert.equal(review.runtimeBoundaryPolicyReview.reviewFingerprint.value, null);
  assertExecutionDisabled(review);
  assertNoPrivateValues(review);
});

test('upload execution runtime-boundary policy review blocks missing structural sections and source drift', () => {
  const runtimeBoundaries = validRuntimeBoundaries();
  const review = buildKnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReview({
    runtimeBoundaries: {
      kind: 'infra-agent.knowledge-team-upload-execution-implementation-boundary',
      schemaVersion: 2,
      mutationAllowed: true,
      executionMode: 'execute',
      boundaryKind: 'unsupported-boundary-kind',
      status: 'unknown-status',
      target: {
        manifestId: 'unsafe-manifest',
        objectKeyRedacted: false,
        objectSha256: 'not-a-sha',
        artifactId: 'unsafe-artifact'
      },
      sourceImplementationBoundary: {
        adapterName: 'mock-team-cache',
        adapterBackendKind: 'mock-s3-compatible',
        implementationBoundaryFingerprint: runtimeBoundaries.sourceImplementationBoundary.implementationBoundaryFingerprint
      },
      readiness: {
        nextAction: 'execute-upload',
        blockerCount: 0
      },
      uploadCommandValue: 'signed-upload-command'
    }
  });

  assert.equal(review.status, 'blocked');
  for (const code of [
    'invalid-runtime-boundaries-kind',
    'invalid-schema-version',
    'mutation-enabled',
    'runtime-boundaries-next-action-invalid',
    'unsafe-artifact-reference',
    'missing-required-field',
    'upload-command-exposed',
    'runtime-boundaries-not-ready',
    'runtime-boundaries-fingerprint-missing',
    'runtime-boundaries-fingerprint-unverified'
  ]) {
    assert.ok(review.readiness.blockerCodes.includes(code), code);
  }
  assert.equal(review.sourceRuntimeBoundaries.boundaryStatus, 'invalid');
  assert.equal(review.sourceRuntimeBoundaries.boundaryKind, 'unsupported');
  assert.equal(review.sourceRuntimeBoundaries.boundaryNextAction, 'invalid');
  assert.equal(review.runtimeBoundaryPolicyReview.reviewFingerprint.value, null);
  assertExecutionDisabled(review);
  assertNoPrivateValues(review);
});
