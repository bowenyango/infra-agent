import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateKnowledgeTeamUploadAdapterInjectionBoundaryPayload,
  validateKnowledgeTeamUploadAdapterPreflightPayload,
  validateKnowledgeTeamUploadApprovalContinuationPayload,
  validateKnowledgeTeamUploadArtifactBytesBoundaryPayload,
  validateKnowledgeTeamUploadAuditRecordBoundaryPayload,
  validateKnowledgeTeamUploadClientCreationBoundaryPayload,
  validateKnowledgeTeamUploadCommandBoundaryPayload,
  validateKnowledgeTeamUploadCredentialPresenceBoundaryPayload,
  validateKnowledgeTeamUploadCredentialReadBoundaryPayload,
  validateKnowledgeTeamUploadExecutionApprovalRequestPayload,
  validateKnowledgeTeamUploadExecutionGatePayload,
  validateKnowledgeTeamUploadExecutionLeaseBoundaryPayload,
  validateKnowledgeTeamUploadExecutionPrerequisitePlanPayload,
  validateKnowledgeTeamUploadExecutionReadinessBoundaryPayload,
  validateKnowledgeTeamUploadLiveCheckBoundaryPayload,
  validateKnowledgeTeamUploadMockHarnessPayload,
  validateKnowledgeTeamUploadMutationApprovalReviewPayload,
  validateKnowledgeTeamUploadMutationPlanPayload,
  validateKnowledgeTeamUploadObjectIndexBindingBoundaryPayload,
  validateKnowledgeTeamUploadRollbackPlanBoundaryPayload,
  validateKnowledgeTeamUploadWriteTokenBoundaryPayload
} from '../../src/knowledge/team-upload-approval-validation.ts';

function forgedEnvelope() {
  return {
    kind: 'wrong-kind',
    schemaVersion: 2,
    mutationAllowed: true,
    executionMode: 'live',
    status: 'unsupported-status',
    plannedOperation: 'direct-upload',
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
    remoteMutationPerformed: true,
    uploadCommand: 'aws s3 cp file s3://private-bucket/key',
    target: {
      manifestId: 'not-a-safe-id',
      artifactId: 'not-a-safe-artifact',
      objectSha256: 'not-a-sha',
      objectKey: '../private-key.json',
      objectKeyRedacted: false
    },
    approval: {
      required: false,
      provided: 'yes',
      fingerprintVerified: false,
      suppliedFingerprint: 'not-a-sha',
      expectedFingerprint: 'also-not-a-sha'
    },
    adapterBoundary: {
      dependencyInjectionRequired: false,
      adapterInjected: true,
      realBackendImplemented: true,
      remoteWriteCapabilityEnabled: true
    },
    continuation: null,
    preflight: null,
    mockHarness: null,
    sourceGate: null,
    sourcePlan: null,
    sourceReview: null,
    sourcePrerequisitePlan: null,
    sourceWriteTokenBoundary: null,
    sourceExecutionLeaseBoundary: null,
    sourceRollbackPlanBoundary: null,
    sourceAuditRecordBoundary: null,
    sourceArtifactBytesBoundary: null,
    sourceAdapterInjectionBoundary: null,
    sourceClientCreationBoundary: null,
    sourceCredentialReadBoundary: null,
    sourceCredentialPresenceBoundary: null,
    sourceLiveCheckBoundary: null,
    sourceUploadCommandBoundary: null,
    sourceObjectIndexBindingBoundary: null,
    sourceExecutionReadinessBoundary: null,
    approvalRequest: null,
    executionBoundary: {
      dryRunOnly: false,
      executable: true,
      artifactBytesProvided: true,
      adapterInjected: true,
      clientCreated: true,
      credentialValuesRead: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      credentialPresenceResultExposed: true,
      liveCheckAllowed: true,
      liveCheckPerformed: true,
      liveCheckResultExposed: true,
      uploadCommandGenerated: true,
      uploadCommandMaterialized: true,
      uploadCommandExposed: true,
      artifactObjectStoreBound: true,
      metadataIndexBound: true,
      objectStoreHandleExposed: true,
      metadataIndexHandleExposed: true,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true,
      objectWriteAttempted: true,
      metadataIndexWriteAttempted: true,
      writeTokenIssued: true,
      executionLeaseCreated: true,
      rollbackPlanCreated: true,
      auditRecordCreated: true,
      remoteMutationPerformed: true
    },
    readiness: {
      status: 'unsupported-status',
      nextAction: 'execute-upload',
      blockerCount: -1,
      blockerCodes: ['unsupported-code', ''],
      blockers: [
        null,
        { code: 'unsupported-code', path: '', message: '' }
      ]
    },
    backendEndpointUrl: 'https://should-not-copy.example.test'
  };
}

const validators = [
  ['approval continuation', validateKnowledgeTeamUploadApprovalContinuationPayload],
  ['adapter preflight', validateKnowledgeTeamUploadAdapterPreflightPayload],
  ['mock harness', validateKnowledgeTeamUploadMockHarnessPayload],
  ['execution gate', validateKnowledgeTeamUploadExecutionGatePayload],
  ['mutation plan', validateKnowledgeTeamUploadMutationPlanPayload],
  ['mutation approval review', validateKnowledgeTeamUploadMutationApprovalReviewPayload],
  ['execution prerequisite plan', validateKnowledgeTeamUploadExecutionPrerequisitePlanPayload],
  ['write token boundary', validateKnowledgeTeamUploadWriteTokenBoundaryPayload],
  ['execution lease boundary', validateKnowledgeTeamUploadExecutionLeaseBoundaryPayload],
  ['rollback plan boundary', validateKnowledgeTeamUploadRollbackPlanBoundaryPayload],
  ['audit record boundary', validateKnowledgeTeamUploadAuditRecordBoundaryPayload],
  ['artifact bytes boundary', validateKnowledgeTeamUploadArtifactBytesBoundaryPayload],
  ['adapter injection boundary', validateKnowledgeTeamUploadAdapterInjectionBoundaryPayload],
  ['client creation boundary', validateKnowledgeTeamUploadClientCreationBoundaryPayload],
  ['credential read boundary', validateKnowledgeTeamUploadCredentialReadBoundaryPayload],
  ['credential presence boundary', validateKnowledgeTeamUploadCredentialPresenceBoundaryPayload],
  ['live check boundary', validateKnowledgeTeamUploadLiveCheckBoundaryPayload],
  ['command boundary', validateKnowledgeTeamUploadCommandBoundaryPayload],
  ['object index binding boundary', validateKnowledgeTeamUploadObjectIndexBindingBoundaryPayload],
  ['execution readiness boundary', validateKnowledgeTeamUploadExecutionReadinessBoundaryPayload],
  ['execution approval request', validateKnowledgeTeamUploadExecutionApprovalRequestPayload]
];

test('upload approval validators reject forged dry-run envelopes and unsafe readiness summaries', () => {
  for (const [label, validatePayload] of validators) {
    const report = validatePayload(forgedEnvelope(), 'inline', `infra-agent.${label.replaceAll(' ', '-')}`);

    assert.equal(report.valid, false, label);
    for (const path of [
      '$.schemaVersion',
      '$.mutationAllowed',
      '$.executionMode',
      '$.remoteWriteAllowed',
      '$.liveCheckAllowed',
      '$.credentialValuesExposed',
      '$.credentialPresenceChecked',
      '$.uploadCommand',
      '$.readiness.status',
      '$.readiness.nextAction',
      '$.readiness.blockerCount',
      '$.readiness.blockerCodes[0]',
      '$.readiness.blockerCodes[1]',
      '$.readiness.blockers[0]',
      '$.readiness.blockers[1].code',
      '$.readiness.blockers[1].path',
      '$.readiness.blockers[1].message',
      '$.backendEndpointUrl'
    ]) {
      assert.equal(report.issues.some(issue => issue.path === path), true, `${label} ${path}`);
    }
  }
});
