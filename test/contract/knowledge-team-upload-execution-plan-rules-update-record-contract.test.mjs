import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeTeamUploadExecutionPlanRulesReview
} from '../../src/knowledge/team-upload-execution-plan-rules-review.ts';
import {
  buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord
} from '../../src/knowledge/team-upload-execution-plan-rules-update-record.ts';
import {
  validateKnowledgePayload
} from '../../src/knowledge/validate.ts';
import {
  validateKnowledgeTeamUploadExecutionPlanRulesUpdateRecordPayload
} from '../../src/knowledge/team-upload-approval-validation.ts';

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

function validPlanRulesReview() {
  return buildKnowledgeTeamUploadExecutionPlanRulesReview({
    executionAuthorizationBoundary: validAuthorizationBoundary()
  });
}

function validUpdateRecord() {
  const review = validPlanRulesReview();
  return buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord({
    planRulesReview: review,
    reviewFingerprint: review.planRulesReview.reviewFingerprint.value
  });
}

function validateUpdateRecordDirect(payload) {
  return validateKnowledgeTeamUploadExecutionPlanRulesUpdateRecordPayload(
    payload,
    'knowledge-pack.upload-execution-plan-rules-update-record.json',
    'infra-agent.knowledge-team-upload-execution-plan-rules-update-record'
  );
}

function assertIssuePaths(report, paths) {
  for (const path of paths) {
    assert.equal(report.issues.some(issue => issue.path === path), true, path);
  }
}

function assertPlanRulesUpdateRecordShape(record) {
  assert.deepEqual(Object.keys(record), [
    'kind',
    'schemaVersion',
    'mutationAllowed',
    'executionMode',
    'recordKind',
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
    'sourcePlanRulesReview',
    'planRulesUpdateRecord',
    'executionBoundary',
    'readiness'
  ]);
  assert.equal(record.kind, 'infra-agent.knowledge-team-upload-execution-plan-rules-update-record');
  assert.equal(record.recordKind, 'upload-execution-plan-rules-update-record-dry-run');
  assert.equal(record.status, 'upload-execution-plan-rules-update-record-ready');
  assert.equal(record.readiness.nextAction, 'design-upload-execution-implementation-boundary');
  assert.equal(record.target.objectKeyRedacted, true);
  assert.equal(Object.hasOwn(record.target, 'objectKey'), false);
  assert.equal(record.sourcePlanRulesReview.reviewStatus, 'upload-execution-plan-rules-review-ready');
  assert.equal(record.sourcePlanRulesReview.reviewNextAction, 'await-explicit-plan-rules-update');
  assert.equal(record.sourcePlanRulesReview.sourceAuthorizationBoundaryStatus, 'upload-execution-authorization-boundary-ready');
  assert.equal(record.sourcePlanRulesReview.authorizationGranted, false);
  assert.equal(record.sourcePlanRulesReview.executionAuthorizationGranted, false);
  assert.equal(record.sourcePlanRulesReview.uploadExecutionAllowed, false);
  assert.equal(record.sourcePlanRulesReview.planRulesUpdateReviewRequired, true);
  assert.equal(record.sourcePlanRulesReview.planRulesUpdated, false);
  assert.equal(record.sourcePlanRulesReview.rulesUpdateReviewed, false);
  assert.equal(record.sourcePlanRulesReview.executionStillDisabled, true);
  assert.equal(record.planRulesUpdateRecord.planRulesUpdateRecorded, true);
  assert.equal(record.planRulesUpdateRecord.rulesUpdateReviewed, true);
  assert.equal(record.planRulesUpdateRecord.policyUpdateAuthorized, false);
  assert.equal(record.planRulesUpdateRecord.fingerprintVerified, true);
  assert.equal(record.planRulesUpdateRecord.suppliedFingerprint, record.planRulesUpdateRecord.expectedFingerprint);
  assert.equal(record.planRulesUpdateRecord.sourceReviewFingerprint.value, record.sourcePlanRulesReview.reviewFingerprint.value);
  assert.equal(record.planRulesUpdateRecord.recordFingerprint.scope, 'stage-knowledge-pack-upload-execution-plan-rules-update-record-v1');
  assert.equal(record.planRulesUpdateRecord.recordFingerprint.canonicalFieldCount, 18);
  assert.equal(/^[a-f0-9]{64}$/.test(record.planRulesUpdateRecord.recordFingerprint.value), true);
  assert.equal(record.executionBoundary.dryRunOnly, true);
  assert.equal(record.executionBoundary.executable, false);
  assert.equal(record.executionBoundary.uploadCommandGenerated, false);
  assert.equal(record.executionBoundary.objectWriteAllowed, false);
  assert.equal(record.executionBoundary.metadataIndexWriteAllowed, false);
  assert.equal(record.executionBoundary.remoteMutationPerformed, false);
}

test('upload execution Plan/Rules update record contract keeps stable ready shape', () => {
  const record = validUpdateRecord();

  assertPlanRulesUpdateRecordShape(record);
  assert.equal(validateKnowledgePayload(record, 'knowledge-pack.upload-execution-plan-rules-update-record.json').valid, true);
});

test('upload execution Plan/Rules update record contract accepts safe blocked records', () => {
  const review = validPlanRulesReview();
  const record = buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord({
    planRulesReview: review,
    reviewFingerprint: null
  });
  const report = validateKnowledgePayload(record, 'knowledge-pack.upload-execution-plan-rules-update-record.json');

  assert.equal(record.status, 'blocked');
  assert.equal(record.readiness.nextAction, 'resolve-blockers');
  assert.equal(record.planRulesUpdateRecord.planRulesUpdateRecorded, false);
  assert.equal(record.planRulesUpdateRecord.rulesUpdateReviewed, false);
  assert.equal(record.planRulesUpdateRecord.fingerprintVerified, false);
  assert.equal(record.planRulesUpdateRecord.recordFingerprint.value, null);
  assert.equal(report.valid, true, JSON.stringify(report.issues));
});

test('upload execution Plan/Rules update record contract rejects malformed envelopes', () => {
  const trueFields = {
    remoteWriteAllowed: true,
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
    remoteMutationPerformed: true
  };
  const report = validateKnowledgePayload({
    kind: 'infra-agent.knowledge-team-upload-execution-plan-rules-update-record',
    schemaVersion: 2,
    mutationAllowed: true,
    executionMode: 'live',
    recordKind: 'wrong-record-kind',
    status: 'unexpected-status',
    plannedOperation: 'wrong-operation',
    ...trueFields,
    uploadCommand: 'aws s3 cp file s3://private-bucket/key',
    target: null,
    sourcePlanRulesReview: null,
    planRulesUpdateRecord: null,
    executionBoundary: null,
    readiness: null,
    backendEndpointUrl: 'https://should-not-copy.example.test'
  }, 'knowledge-pack.upload-execution-plan-rules-update-record.json');

  assert.equal(report.valid, false);
  for (const path of [
    '$.schemaVersion',
    '$.mutationAllowed',
    '$.executionMode',
    '$.recordKind',
    '$.status',
    '$.plannedOperation',
    '$.remoteWriteAllowed',
    '$.uploadCommand',
    '$.target',
    '$.sourcePlanRulesReview',
    '$.planRulesUpdateRecord',
    '$.executionBoundary',
    '$.readiness',
    '$.backendEndpointUrl'
  ]) {
    assert.equal(report.issues.some(issue => issue.path === path), true, path);
  }
});

test('upload execution Plan/Rules update record contract rejects drifted payloads', () => {
  const record = validUpdateRecord();
  const report = validateKnowledgePayload({
    ...record,
    target: {
      ...record.target,
      objectKey: 'team-artifacts/public-reference/aa/bb/drift.json',
      objectKeyRedacted: false
    },
    uploadCommand: 'aws s3 cp file s3://bucket/key',
    uploadExecutionApproved: true,
    uploadExecutionAllowed: true,
    sourcePlanRulesReview: {
      ...record.sourcePlanRulesReview,
      reviewStatus: 'blocked',
      reviewKind: 'unsupported',
      reviewNextAction: 'execute-upload',
      sourceAuthorizationBoundaryStatus: 'blocked',
      sourceAuthorizationBoundaryKind: 'unsupported',
      sourceAuthorizationBoundaryNextAction: 'execute-upload',
      humanApprovalRecorded: false,
      approvalFingerprintVerified: false,
      authorizationBoundaryDesigned: false,
      planRulesUpdated: true,
      rulesUpdateReviewed: true,
      authorizationGranted: true,
      executionAuthorizationGranted: true,
      uploadExecutionAllowed: true,
      adapterBackendKind: 's3-compatible',
      reviewFingerprint: {
        ...record.sourcePlanRulesReview.reviewFingerprint,
        value: null
      }
    },
    planRulesUpdateRecord: {
      ...record.planRulesUpdateRecord,
      planRulesUpdateRecorded: false,
      rulesUpdateReviewed: false,
      policyUpdateAuthorized: true,
      source: null,
      suppliedFingerprint: 'd'.repeat(64),
      expectedFingerprint: 'e'.repeat(64),
      fingerprintVerified: false,
      sourceReviewFingerprint: {
        ...record.planRulesUpdateRecord.sourceReviewFingerprint,
        canonicalFieldCount: 19
      },
      recordFingerprint: {
        ...record.planRulesUpdateRecord.recordFingerprint,
        value: null
      },
      executionAuthorizationGranted: true
    },
    executionBoundary: {
      ...record.executionBoundary,
      uploadCommandGenerated: true,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true,
      executable: true
    },
    readiness: {
      ...record.readiness,
      nextAction: 'execute-upload'
    }
  }, 'knowledge-pack.upload-execution-plan-rules-update-record.json');

  assert.equal(report.valid, false);
  assert.equal(report.issues.some(issue => issue.path === '$.target.objectKey'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.target.objectKeyRedacted'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadCommand'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionApproved'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourcePlanRulesReview.reviewStatus'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourcePlanRulesReview.reviewKind'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourcePlanRulesReview.reviewNextAction'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourcePlanRulesReview.sourceAuthorizationBoundaryStatus'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourcePlanRulesReview.sourceAuthorizationBoundaryKind'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourcePlanRulesReview.sourceAuthorizationBoundaryNextAction'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourcePlanRulesReview.humanApprovalRecorded'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourcePlanRulesReview.planRulesUpdated'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourcePlanRulesReview.rulesUpdateReviewed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourcePlanRulesReview.authorizationGranted'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourcePlanRulesReview.executionAuthorizationGranted'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourcePlanRulesReview.uploadExecutionAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourcePlanRulesReview.adapterBackendKind'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourcePlanRulesReview.reviewFingerprint.value'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.planRulesUpdateRecord.planRulesUpdateRecorded'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.planRulesUpdateRecord.rulesUpdateReviewed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.planRulesUpdateRecord.policyUpdateAuthorized'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.planRulesUpdateRecord.source'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.planRulesUpdateRecord.suppliedFingerprint'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.planRulesUpdateRecord.sourceReviewFingerprint.canonicalFieldCount'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.planRulesUpdateRecord.recordFingerprint.value'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.planRulesUpdateRecord.executionAuthorizationGranted'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.executionBoundary.uploadCommandGenerated'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.executionBoundary.objectWriteAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.executionBoundary.executable'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.readiness.nextAction'), true);
});

test('upload execution Plan/Rules update record validator rejects forged ready field families', () => {
  const record = validUpdateRecord();
  const trueExecutionFields = Object.fromEntries([
    'executable',
    'artifactBytesProvided',
    'adapterInjected',
    'clientCreated',
    'credentialValuesRead',
    'credentialValuesExposed',
    'credentialPresenceChecked',
    'credentialPresenceResultExposed',
    'liveCheckAllowed',
    'liveCheckPerformed',
    'liveCheckResultExposed',
    'uploadCommandGenerated',
    'uploadCommandMaterialized',
    'uploadCommandExposed',
    'artifactObjectStoreBound',
    'metadataIndexBound',
    'objectStoreHandleExposed',
    'metadataIndexHandleExposed',
    'objectWriteAllowed',
    'metadataIndexWriteAllowed',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'writeTokenIssued',
    'executionLeaseCreated',
    'rollbackPlanCreated',
    'auditRecordCreated',
    'remoteMutationPerformed'
  ].map(key => [key, true]));
  const report = validateUpdateRecordDirect({
    ...record,
    kind: 'wrong-kind',
    target: {
      ...record.target,
      manifestId: 'not-a-safe-id',
      artifactId: 'also-not-safe',
      objectSha256: 'not-a-sha',
      objectKeyRedacted: false,
      objectKey: 'team-artifacts/public-reference/aa/bb/private-key.json'
    },
    sourcePlanRulesReview: {
      ...record.sourcePlanRulesReview,
      source: 'wrong-source',
      reviewStatus: 'unsupported',
      reviewKind: 'not-supported',
      reviewNextAction: 'unsupported',
      sourceAuthorizationBoundaryStatus: 'unsupported',
      sourceAuthorizationBoundaryKind: 'not-supported',
      sourceAuthorizationBoundaryNextAction: 'unsupported',
      adapterBackendKind: 'not-supported',
      adapterName: '../unsafe-adapter',
      scopeMatched: 'yes',
      humanApprovalRecorded: 'yes',
      approvalFingerprintVerified: 'yes',
      authorizationBoundaryDesigned: 'yes',
      planRulesUpdateReviewRequired: 'yes',
      planRulesUpdated: 'no',
      rulesUpdateReviewed: 'no',
      executionStillDisabled: 'yes',
      authorizationGranted: 'no',
      executionAuthorizationGranted: 'no',
      approvalGranted: 'no',
      uploadApproved: 'no',
      uploadExecutionApproved: 'no',
      uploadExecutionAllowed: 'no',
      mutationApprovalGranted: 'no'
    },
    planRulesUpdateRecord: {
      ...record.planRulesUpdateRecord,
      explicitPlanRulesUpdateRequired: false,
      humanReviewRequired: false,
      policyUpdateAuthorized: true,
      executionStillDisabled: false,
      planRulesUpdateRecorded: 'yes',
      rulesUpdateReviewed: 'yes',
      fingerprintVerified: 'yes',
      authorizationGranted: true,
      executionAuthorizationGranted: true,
      uploadApproved: true,
      uploadExecutionApproved: true,
      uploadExecutionAllowed: true,
      mutationApprovalGranted: true,
      source: 'manual',
      suppliedFingerprint: 'not-a-sha',
      expectedFingerprint: 'also-not-a-sha'
    },
    executionBoundary: {
      ...record.executionBoundary,
      dryRunOnly: false,
      ...trueExecutionFields
    },
    readiness: {
      ...record.readiness,
      status: 'blocked',
      nextAction: 'resolve-blockers',
      blockerCount: 1,
      blockerCodes: ['unsupported-code'],
      blockers: [{ code: 'unsupported-code', message: 'unsupported', remediation: 'fix' }]
    }
  });

  assert.equal(report.valid, false);
  assertIssuePaths(report, [
    '$.kind',
    '$.target.manifestId',
    '$.target.artifactId',
    '$.target.objectSha256',
    '$.target.objectKeyRedacted',
    '$.target.objectKey',
    '$.sourcePlanRulesReview.source',
    '$.sourcePlanRulesReview.reviewStatus',
    '$.sourcePlanRulesReview.reviewKind',
    '$.sourcePlanRulesReview.reviewNextAction',
    '$.sourcePlanRulesReview.sourceAuthorizationBoundaryStatus',
    '$.sourcePlanRulesReview.sourceAuthorizationBoundaryKind',
    '$.sourcePlanRulesReview.sourceAuthorizationBoundaryNextAction',
    '$.sourcePlanRulesReview.adapterBackendKind',
    '$.sourcePlanRulesReview.adapterName',
    '$.sourcePlanRulesReview.scopeMatched',
    '$.sourcePlanRulesReview.planRulesUpdated',
    '$.sourcePlanRulesReview.authorizationGranted',
    '$.planRulesUpdateRecord.explicitPlanRulesUpdateRequired',
    '$.planRulesUpdateRecord.humanReviewRequired',
    '$.planRulesUpdateRecord.policyUpdateAuthorized',
    '$.planRulesUpdateRecord.executionStillDisabled',
    '$.planRulesUpdateRecord.planRulesUpdateRecorded',
    '$.planRulesUpdateRecord.source',
    '$.planRulesUpdateRecord.suppliedFingerprint',
    '$.planRulesUpdateRecord.expectedFingerprint',
    '$.planRulesUpdateRecord.authorizationGranted',
    '$.executionBoundary.dryRunOnly',
    '$.executionBoundary.credentialValuesRead',
    '$.executionBoundary.remoteMutationPerformed',
    '$.readiness.status',
    '$.readiness.nextAction',
    '$.readiness.blockerCount'
  ]);
});

test('upload execution Plan/Rules update record validator rejects incomplete ready fingerprints', () => {
  const record = validUpdateRecord();
  const report = validateUpdateRecordDirect({
    ...record,
    target: {
      ...record.target,
      manifestId: null,
      artifactId: null,
      objectSha256: null
    },
    sourcePlanRulesReview: {
      ...record.sourcePlanRulesReview,
      adapterName: null,
      sourceApprovalRecordFingerprint: {
        ...record.sourcePlanRulesReview.sourceApprovalRecordFingerprint,
        value: null
      },
      sourceAuthorizationBoundaryFingerprint: {
        ...record.sourcePlanRulesReview.sourceAuthorizationBoundaryFingerprint,
        value: null
      },
      reviewFingerprint: {
        ...record.sourcePlanRulesReview.reviewFingerprint,
        value: null
      }
    },
    planRulesUpdateRecord: {
      ...record.planRulesUpdateRecord,
      source: null,
      suppliedFingerprint: null,
      expectedFingerprint: null,
      sourceReviewFingerprint: {
        ...record.planRulesUpdateRecord.sourceReviewFingerprint,
        value: null
      },
      recordFingerprint: {
        ...record.planRulesUpdateRecord.recordFingerprint,
        value: null
      }
    }
  });

  assert.equal(report.valid, false);
  assertIssuePaths(report, [
    '$.target.manifestId',
    '$.target.artifactId',
    '$.target.objectSha256',
    '$.sourcePlanRulesReview.adapterName',
    '$.sourcePlanRulesReview.sourceApprovalRecordFingerprint.value',
    '$.sourcePlanRulesReview.sourceAuthorizationBoundaryFingerprint.value',
    '$.sourcePlanRulesReview.reviewFingerprint.value',
    '$.planRulesUpdateRecord.source',
    '$.planRulesUpdateRecord.suppliedFingerprint',
    '$.planRulesUpdateRecord.expectedFingerprint',
    '$.planRulesUpdateRecord.sourceReviewFingerprint.value',
    '$.planRulesUpdateRecord.recordFingerprint.value'
  ]);
});

test('upload execution Plan/Rules update record validator rejects mismatched review fingerprints', () => {
  const record = validUpdateRecord();
  const report = validateUpdateRecordDirect({
    ...record,
    planRulesUpdateRecord: {
      ...record.planRulesUpdateRecord,
      sourceReviewFingerprint: {
        ...record.planRulesUpdateRecord.sourceReviewFingerprint,
        value: 'd'.repeat(64)
      },
      suppliedFingerprint: 'e'.repeat(64),
      expectedFingerprint: 'e'.repeat(64)
    }
  });

  assert.equal(report.valid, false);
  assertIssuePaths(report, [
    '$.planRulesUpdateRecord.sourceReviewFingerprint.value',
    '$.planRulesUpdateRecord.expectedFingerprint'
  ]);
});

test('upload execution Plan/Rules update record validator rejects blocked records that claim completion', () => {
  const review = validPlanRulesReview();
  const blocked = buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord({
    planRulesReview: review,
    reviewFingerprint: null
  });
  const report = validateUpdateRecordDirect({
    ...blocked,
    planRulesUpdateRecord: {
      ...blocked.planRulesUpdateRecord,
      planRulesUpdateRecorded: true,
      rulesUpdateReviewed: true
    },
    readiness: {
      ...blocked.readiness,
      nextAction: 'design-upload-execution-implementation-boundary'
    }
  });

  assert.equal(report.valid, false);
  assertIssuePaths(report, [
    '$.planRulesUpdateRecord.planRulesUpdateRecorded',
    '$.planRulesUpdateRecord.rulesUpdateReviewed',
    '$.readiness.nextAction'
  ]);
});
