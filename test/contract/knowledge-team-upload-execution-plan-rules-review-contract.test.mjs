import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeTeamUploadExecutionPlanRulesReview
} from '../../src/knowledge/team-upload-execution-plan-rules-review.ts';
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

function assertPlanRulesReviewShape(review) {
  assert.deepEqual(Object.keys(review), [
    'kind',
    'schemaVersion',
    'mutationAllowed',
    'executionMode',
    'reviewKind',
    'status',
    'plannedOperation',
    'remoteWriteAllowed',
    'liveCheckAllowed',
    'credentialValuesExposed',
    'credentialPresenceChecked',
    'uploadApproved',
    'uploadExecutionApproved',
    'uploadExecutionAllowed',
    'mutationApprovalGranted',
    'clientCreated',
    'adapterInjected',
    'artifactBytesProvided',
    'writeTokenIssued',
    'executionLeaseCreated',
    'rollbackPlanCreated',
    'auditRecordCreated',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed',
    'uploadCommand',
    'target',
    'sourceAuthorizationBoundary',
    'planRulesReview',
    'executionBoundary',
    'readiness'
  ]);
  assert.equal(review.kind, 'infra-agent.knowledge-team-upload-execution-plan-rules-review');
  assert.equal(review.reviewKind, 'upload-execution-plan-rules-review-dry-run');
  assert.equal(review.status, 'upload-execution-plan-rules-review-ready');
  assert.equal(review.readiness.nextAction, 'await-explicit-plan-rules-update');
  assert.equal(review.target.objectKeyRedacted, true);
  assert.equal(Object.hasOwn(review.target, 'objectKey'), false);
  assert.equal(review.sourceAuthorizationBoundary.boundaryStatus, 'upload-execution-authorization-boundary-ready');
  assert.equal(review.sourceAuthorizationBoundary.boundaryNextAction, 'await-plan-rules-update-for-upload-execution');
  assert.equal(review.sourceAuthorizationBoundary.authorizationGranted, false);
  assert.equal(review.sourceAuthorizationBoundary.executionAuthorizationGranted, false);
  assert.equal(review.sourceAuthorizationBoundary.uploadExecutionAllowed, false);
  assert.equal(review.planRulesReview.planRulesUpdateReviewRequired, true);
  assert.equal(review.planRulesReview.planRulesUpdated, false);
  assert.equal(review.planRulesReview.rulesUpdateReviewed, false);
  assert.equal(review.planRulesReview.executionStillDisabled, true);
  assert.equal(review.planRulesReview.reviewFingerprint.scope, 'stage-knowledge-pack-upload-execution-plan-rules-review-v1');
  assert.equal(review.planRulesReview.reviewFingerprint.canonicalFieldCount, 20);
  assert.equal(/^[a-f0-9]{64}$/.test(review.planRulesReview.reviewFingerprint.value), true);
  assert.equal(review.executionBoundary.dryRunOnly, true);
  assert.equal(review.executionBoundary.executable, false);
  assert.equal(review.executionBoundary.uploadCommandGenerated, false);
  assert.equal(review.executionBoundary.objectWriteAllowed, false);
  assert.equal(review.executionBoundary.metadataIndexWriteAllowed, false);
  assert.equal(review.executionBoundary.remoteMutationPerformed, false);
}

test('upload execution plan/rules review contract keeps stable ready shape', () => {
  const review = buildKnowledgeTeamUploadExecutionPlanRulesReview({
    executionAuthorizationBoundary: validAuthorizationBoundary()
  });

  assertPlanRulesReviewShape(review);
  assert.equal(validateKnowledgePayload(review, 'knowledge-pack.upload-execution-plan-rules-review.json').valid, true);
});

test('upload execution plan/rules review contract rejects drifted payloads', () => {
  const review = buildKnowledgeTeamUploadExecutionPlanRulesReview({
    executionAuthorizationBoundary: validAuthorizationBoundary()
  });
  const report = validateKnowledgePayload({
    ...review,
    target: {
      ...review.target,
      objectKey: 'team-artifacts/public-reference/aa/bb/drift.json',
      objectKeyRedacted: false
    },
    uploadCommand: 'aws s3 cp file s3://bucket/key',
    uploadExecutionApproved: true,
    uploadExecutionAllowed: true,
    sourceAuthorizationBoundary: {
      ...review.sourceAuthorizationBoundary,
      boundaryStatus: 'blocked',
      boundaryKind: 'unsupported',
      boundaryNextAction: 'execute-upload',
      humanApprovalRecorded: false,
      approvalFingerprintVerified: false,
      authorizationBoundaryDesigned: false,
      authorizationGranted: true,
      executionAuthorizationGranted: true,
      uploadExecutionAllowed: true,
      adapterBackendKind: 's3-compatible',
      authorizationBoundaryFingerprint: {
        ...review.sourceAuthorizationBoundary.authorizationBoundaryFingerprint,
        value: null
      }
    },
    planRulesReview: {
      ...review.planRulesReview,
      planRulesUpdated: true,
      rulesUpdateReviewed: true,
      realUploadExecutionStillProhibited: false,
      requiredReviewDocuments: ['docs/HANDOFF.md'],
      reviewFingerprint: {
        ...review.planRulesReview.reviewFingerprint,
        canonicalFieldCount: 19
      }
    },
    executionBoundary: {
      ...review.executionBoundary,
      uploadCommandGenerated: true,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true,
      executable: true
    },
    readiness: {
      ...review.readiness,
      nextAction: 'execute-upload'
    }
  }, 'knowledge-pack.upload-execution-plan-rules-review.json');

  assert.equal(report.valid, false);
  assert.equal(report.issues.some(issue => issue.path === '$.target.objectKey'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.target.objectKeyRedacted'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadCommand'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionApproved'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceAuthorizationBoundary.boundaryStatus'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceAuthorizationBoundary.boundaryKind'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceAuthorizationBoundary.boundaryNextAction'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceAuthorizationBoundary.humanApprovalRecorded'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceAuthorizationBoundary.authorizationGranted'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceAuthorizationBoundary.executionAuthorizationGranted'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceAuthorizationBoundary.uploadExecutionAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceAuthorizationBoundary.adapterBackendKind'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceAuthorizationBoundary.authorizationBoundaryFingerprint.value'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.planRulesReview.planRulesUpdated'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.planRulesReview.rulesUpdateReviewed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.planRulesReview.realUploadExecutionStillProhibited'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.planRulesReview.requiredReviewDocuments'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.planRulesReview.reviewFingerprint.canonicalFieldCount'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.executionBoundary.uploadCommandGenerated'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.executionBoundary.objectWriteAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.executionBoundary.executable'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.readiness.nextAction'), true);
});
