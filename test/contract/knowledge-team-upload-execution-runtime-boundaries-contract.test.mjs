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
  validateKnowledgePayload
} from '../../src/knowledge/validate.ts';

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

function assertIssuePaths(report, paths) {
  for (const path of paths) {
    assert.equal(report.issues.some(issue => issue.path === path), true, path);
  }
}

test('runtime boundaries payload validates ready contract', () => {
  const payload = validRuntimeBoundaries();
  const report = validateKnowledgePayload(
    payload,
    'knowledge-pack.upload-execution-runtime-boundaries.json'
  );

  assert.equal(report.valid, true, JSON.stringify(report.issues));
  assert.equal(report.inputKind, 'infra-agent.knowledge-team-upload-execution-runtime-boundaries');
});

test('runtime boundaries validator rejects ready execution and source drift', () => {
  const payload = validRuntimeBoundaries();
  const drifted = {
    ...payload,
    remoteWriteAllowed: true,
    uploadCommand: { command: 'private' },
    target: {
      ...payload.target,
      manifestId: null,
      artifactId: null,
      objectSha256: null,
      objectKeyRedacted: false,
      objectKey: 'team-artifacts/public-reference/aa/bb/private-key.json'
    },
    sourceImplementationBoundary: {
      ...payload.sourceImplementationBoundary,
      boundaryStatus: 'blocked',
      boundaryKind: 'unsupported',
      boundaryNextAction: 'resolve-blockers',
      sourceUpdateRecordStatus: 'blocked',
      sourceUpdateRecordNextAction: 'resolve-blockers',
      implementationBoundaryDesigned: false,
      sourceUpdateRecordFingerprintVerified: false,
      runtimeBoundaryDesignRequired: false,
      implementationAllowed: true,
      executionStillDisabled: false,
      uploadExecutionAllowed: true,
      adapterName: '../unsafe-adapter',
      adapterBackendKind: 's3-compatible',
      sourceUpdateRecordFingerprint: {
        algorithm: 'md5',
        scope: 'wrong-scope',
        value: 'not-a-sha',
        canonicalFieldCount: 0
      },
      implementationBoundaryFingerprint: {
        algorithm: 'sha256',
        scope: 'stage-knowledge-pack-upload-execution-implementation-boundary-v1',
        value: 'd'.repeat(64),
        canonicalFieldCount: 18
      }
    },
    runtimeBoundaries: {
      ...payload.runtimeBoundaries,
      dryRunOnly: false,
      runtimeBoundariesDesigned: false,
      sourceImplementationBoundaryFingerprintVerified: false,
      separateRuntimeArtifactsRequired: false,
      writeTokenRuntimeBoundaryRequired: false,
      remoteMutationStillProhibited: false,
      runtimeExecutionAllowed: true,
      uploadExecutionAllowed: true,
      executable: true,
      sourceImplementationBoundaryFingerprint: {
        ...payload.runtimeBoundaries.sourceImplementationBoundaryFingerprint,
        value: 'e'.repeat(64)
      },
      runtimeBoundariesFingerprint: {
        algorithm: 'sha256',
        scope: 'wrong-scope',
        value: null,
        canonicalFieldCount: 19
      }
    },
    executionBoundary: {
      ...payload.executionBoundary,
      dryRunOnly: false,
      executable: true,
      uploadCommandGenerated: true,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true
    },
    readiness: {
      ...payload.readiness,
      nextAction: 'resolve-blockers',
      blockerCount: 1
    }
  };

  const report = validateKnowledgePayload(
    drifted,
    'knowledge-pack.upload-execution-runtime-boundaries.json'
  );

  assert.equal(report.valid, false);
  assertIssuePaths(report, [
    '$.remoteWriteAllowed',
    '$.uploadCommand',
    '$.target.manifestId',
    '$.target.artifactId',
    '$.target.objectSha256',
    '$.target.objectKeyRedacted',
    '$.target.objectKey',
    '$.sourceImplementationBoundary.boundaryStatus',
    '$.sourceImplementationBoundary.boundaryKind',
    '$.sourceImplementationBoundary.boundaryNextAction',
    '$.sourceImplementationBoundary.sourceUpdateRecordStatus',
    '$.sourceImplementationBoundary.sourceUpdateRecordNextAction',
    '$.sourceImplementationBoundary.implementationBoundaryDesigned',
    '$.sourceImplementationBoundary.sourceUpdateRecordFingerprintVerified',
    '$.sourceImplementationBoundary.runtimeBoundaryDesignRequired',
    '$.sourceImplementationBoundary.implementationAllowed',
    '$.sourceImplementationBoundary.executionStillDisabled',
    '$.sourceImplementationBoundary.uploadExecutionAllowed',
    '$.sourceImplementationBoundary.adapterName',
    '$.sourceImplementationBoundary.adapterBackendKind',
    '$.sourceImplementationBoundary.sourceUpdateRecordFingerprint.algorithm',
    '$.sourceImplementationBoundary.sourceUpdateRecordFingerprint.scope',
    '$.sourceImplementationBoundary.sourceUpdateRecordFingerprint.canonicalFieldCount',
    '$.sourceImplementationBoundary.sourceUpdateRecordFingerprint.value',
    '$.runtimeBoundaries.dryRunOnly',
    '$.runtimeBoundaries.runtimeBoundariesDesigned',
    '$.runtimeBoundaries.sourceImplementationBoundaryFingerprintVerified',
    '$.runtimeBoundaries.separateRuntimeArtifactsRequired',
    '$.runtimeBoundaries.writeTokenRuntimeBoundaryRequired',
    '$.runtimeBoundaries.remoteMutationStillProhibited',
    '$.runtimeBoundaries.runtimeExecutionAllowed',
    '$.runtimeBoundaries.uploadExecutionAllowed',
    '$.runtimeBoundaries.executable',
    '$.runtimeBoundaries.sourceImplementationBoundaryFingerprint.value',
    '$.runtimeBoundaries.runtimeBoundariesFingerprint.scope',
    '$.runtimeBoundaries.runtimeBoundariesFingerprint.canonicalFieldCount',
    '$.runtimeBoundaries.runtimeBoundariesFingerprint.value',
    '$.executionBoundary.dryRunOnly',
    '$.executionBoundary.executable',
    '$.executionBoundary.uploadCommandGenerated',
    '$.executionBoundary.objectWriteAllowed',
    '$.executionBoundary.metadataIndexWriteAllowed',
    '$.readiness.nextAction',
    '$.readiness.blockerCount'
  ]);
});
