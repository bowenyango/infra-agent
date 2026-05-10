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
  buildKnowledgeTeamUploadAdapterPreflight
} from '../../src/knowledge/team-upload-adapter-preflight.ts';
import {
  buildKnowledgeTeamUploadApprovalContinuation
} from '../../src/knowledge/team-upload-approval-continuation.ts';
import {
  buildKnowledgeTeamUploadApprovalIntent
} from '../../src/knowledge/team-upload-approval-intent.ts';
import {
  buildKnowledgeTeamUploadExecutionGate
} from '../../src/knowledge/team-upload-execution-gate.ts';
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
  buildKnowledgeTeamUploadWriteTokenBoundary
} from '../../src/knowledge/team-upload-write-token-boundary.ts';
import {
  buildKnowledgeTeamArtifactContractFixture
} from '../support/knowledge-team-artifact-fixtures.mjs';

function validBackendReferenceSummary() {
  return validateKnowledgeTeamS3CompatibleBackendReferences(
    buildKnowledgeTeamS3CompatibleBackendConfig(),
    buildKnowledgeTeamS3CompatibleReferenceRegistry()
  );
}

async function validPrerequisitePlan() {
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
  return buildKnowledgeTeamUploadExecutionPrerequisitePlan({ approvalReview });
}

function assertNoPrivateValues(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const forbidden of [
    'https://should-not-copy.example.test',
    'should-not-copy-bucket',
    'should-not-copy-secret',
    'aws s3 cp',
    's3://private-bucket',
    'private-key'
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
  assert.equal(boundary.writeTokenBoundary.tokenIssued, false);
  assert.equal(boundary.writeTokenBoundary.tokenScopeBoundToArtifact, false);
  assert.equal(boundary.writeTokenBoundary.singleUseTokenIssued, false);
  assert.equal(boundary.writeTokenBoundary.tokenExpirySet, false);
  assert.equal(boundary.writeTokenBoundary.auditBindingCreated, false);
  assert.equal(boundary.writeTokenBoundary.executionLeaseCreated, false);
  assert.equal(boundary.writeTokenBoundary.rollbackPlanCreated, false);
  assert.equal(boundary.writeTokenBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.artifactBytesProvided, false);
  assert.equal(boundary.remainingExecutionBoundaries.adapterInjected, false);
  assert.equal(boundary.remainingExecutionBoundaries.executionLeaseCreated, false);
  assert.equal(boundary.remainingExecutionBoundaries.rollbackPlanCreated, false);
  assert.equal(boundary.remainingExecutionBoundaries.auditRecordCreated, false);
  assert.equal(boundary.remainingExecutionBoundaries.objectWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.metadataIndexWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.remoteMutationAllowed, false);
}

function blockerCodes(boundary) {
  return new Set(boundary.readiness.blockerCodes);
}

test('upload write token boundary records token requirements without issuing a token', async () => {
  const prerequisitePlan = await validPrerequisitePlan();
  const boundary = buildKnowledgeTeamUploadWriteTokenBoundary({ prerequisitePlan });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-write-token-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'write-token-boundary-dry-run');
  assert.equal(boundary.status, 'write-token-boundary-ready');
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.target.manifestId, prerequisitePlan.target.manifestId);
  assert.equal(boundary.target.objectKey, prerequisitePlan.target.objectKey);
  assert.equal(boundary.target.objectSha256, prerequisitePlan.target.objectSha256);
  assert.equal(boundary.target.artifactId, prerequisitePlan.target.artifactId);
  assert.equal(boundary.sourcePrerequisitePlan.source, 'upload-execution-prerequisite-plan');
  assert.equal(boundary.sourcePrerequisitePlan.prerequisiteStatus, 'prerequisite-plan-ready');
  assert.equal(boundary.sourcePrerequisitePlan.prerequisitePlanKind, 'execution-prerequisite-boundary-dry-run');
  assert.equal(boundary.sourcePrerequisitePlan.prerequisiteNextAction, 'design-write-token-boundary');
  assert.equal(boundary.sourcePrerequisitePlan.reviewStatus, 'review-ready');
  assert.equal(boundary.sourcePrerequisitePlan.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourcePrerequisitePlan.scopeMatched, true);
  assert.equal(boundary.sourcePrerequisitePlan.humanReviewRecorded, true);
  assert.equal(boundary.sourcePrerequisitePlan.fingerprintVerified, true);
  assert.equal(boundary.sourcePrerequisitePlan.sourceFingerprintVerified, true);
  assert.equal(boundary.sourcePrerequisitePlan.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourcePrerequisitePlan.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourcePrerequisitePlan.writeTokenRequiredBeforeExecution, true);
  assert.equal(boundary.writeTokenBoundary.dryRunOnly, true);
  assert.equal(boundary.writeTokenBoundary.tokenRequiredBeforeExecution, true);
  assert.equal(boundary.writeTokenBoundary.tokenScopeBindingRequired, true);
  assert.equal(boundary.writeTokenBoundary.tokenSingleUseRequired, true);
  assert.equal(boundary.writeTokenBoundary.tokenExpiryRequired, true);
  assert.equal(boundary.writeTokenBoundary.auditBindingRequired, true);
  assert.equal(boundary.writeTokenBoundary.executionLeaseRequiredBeforeIssuance, true);
  assert.equal(boundary.writeTokenBoundary.rollbackPlanRequiredBeforeIssuance, true);
  assert.equal(boundary.readiness.status, 'write-token-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-execution-lease-boundary');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assertNoPrivateValues(boundary);
});

test('upload write token boundary blocks non-ready prerequisite plans', async () => {
  const prerequisitePlan = await validPrerequisitePlan();
  const blockedPrerequisitePlan = {
    ...prerequisitePlan,
    status: 'blocked',
    sourcePrerequisitePlan: undefined,
    sourceReview: {
      ...prerequisitePlan.sourceReview,
      humanReviewRecorded: false
    },
    readiness: {
      ...prerequisitePlan.readiness,
      status: 'blocked',
      nextAction: 'resolve-blockers',
      blockerCount: 1,
      blockerCodes: ['review-fingerprint-unverified'],
      blockers: [{
        code: 'review-fingerprint-unverified',
        path: '$.sourceReview.fingerprintVerified',
        message: 'fingerprint not verified'
      }]
    }
  };

  const boundary = buildKnowledgeTeamUploadWriteTokenBoundary({
    prerequisitePlan: blockedPrerequisitePlan
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.readiness.status, 'blocked');
  assert.equal(boundary.readiness.nextAction, 'resolve-blockers');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.sourcePrerequisitePlan.prerequisiteStatus, 'blocked');
  assert.equal(boundary.sourcePrerequisitePlan.humanReviewRecorded, false);
  assert.equal(codes.has('prerequisite-plan-not-ready'), true);
  assert.equal(codes.has('prerequisite-next-action-invalid'), true);
  assert.equal(codes.has('mutation-approval-not-reviewed'), true);
  assertNoPrivateValues(boundary);
});

test('upload write token boundary blocks invalid prerequisite inputs', () => {
  const boundary = buildKnowledgeTeamUploadWriteTokenBoundary({
    prerequisitePlan: null
  });

  assert.equal(boundary.status, 'blocked');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.sourcePrerequisitePlan.prerequisiteStatus, 'invalid');
  assert.equal(blockerCodes(boundary).has('missing-required-field'), true);
  assert.equal(boundary.target.manifestId, null);
  assert.equal(boundary.target.objectKey, null);
  assert.equal(boundary.target.objectSha256, null);
  assert.equal(boundary.target.artifactId, null);
});

test('upload write token boundary blocks malformed prerequisite metadata', () => {
  const boundary = buildKnowledgeTeamUploadWriteTokenBoundary({
    prerequisitePlan: {
      kind: 'infra-agent.other-artifact',
      schemaVersion: 2,
      prerequisitePlanKind: 'runtime-boundary',
      status: 'queued',
      target: {
        manifestId: 'unsafe-id',
        objectKey: '../unsafe-object',
        objectSha256: 'not-a-sha',
        artifactId: 'unsafe-artifact'
      },
      sourceReview: {
        reviewStatus: 'queued',
        reviewKind: 'operator-note',
        scopeMatched: false,
        humanReviewRecorded: false,
        fingerprintVerified: false,
        sourceFingerprintVerified: false,
        adapterName: 'mock-team-cache',
        adapterBackendKind: 'real-s3'
      },
      prerequisitePlan: {
        mutationApprovalGranted: false,
        uploadApproved: false,
        uploadExecutionAllowed: false,
        executionAllowed: false
      },
      executionBoundary: {
        writeTokenRequiredBeforeExecution: false
      },
      readiness: {
        nextAction: 'execute-upload',
        blockerCount: 1
      }
    }
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.sourcePrerequisitePlan.prerequisiteStatus, 'invalid');
  assert.equal(boundary.sourcePrerequisitePlan.prerequisitePlanKind, 'unsupported');
  assert.equal(boundary.sourcePrerequisitePlan.prerequisiteNextAction, 'invalid');
  assert.equal(boundary.sourcePrerequisitePlan.reviewStatus, 'invalid');
  assert.equal(boundary.sourcePrerequisitePlan.reviewKind, 'unsupported');
  assert.equal(boundary.sourcePrerequisitePlan.adapterBackendKind, 'unsupported');
  assert.equal(boundary.target.manifestId, null);
  assert.equal(boundary.target.objectKey, null);
  assert.equal(boundary.target.objectSha256, null);
  assert.equal(boundary.target.artifactId, null);
  for (const code of [
    'invalid-prerequisite-plan-kind',
    'invalid-schema-version',
    'invalid-boundary-kind',
    'prerequisite-plan-not-ready',
    'unsafe-artifact-reference',
    'prerequisite-next-action-invalid',
    'mutation-approval-not-reviewed',
    'review-fingerprint-unverified',
    'scope-not-matched',
    'unsupported-adapter-backend',
    'write-token-not-required',
    'missing-required-field'
  ]) {
    assert.equal(codes.has(code), true, code);
  }
});

test('upload write token boundary blocks missing nested prerequisite sections', () => {
  const boundary = buildKnowledgeTeamUploadWriteTokenBoundary({
    prerequisitePlan: {
      kind: 'infra-agent.knowledge-team-upload-execution-prerequisite-plan',
      schemaVersion: 1,
      prerequisitePlanKind: 'execution-prerequisite-boundary-dry-run',
      status: 'prerequisite-plan-ready',
      target: null,
      sourceReview: null,
      prerequisitePlan: null,
      executionBoundary: null,
      readiness: null
    }
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.sourcePrerequisitePlan.prerequisiteNextAction, 'invalid');
  assert.equal(boundary.sourcePrerequisitePlan.writeTokenRequiredBeforeExecution, false);
  assert.equal(boundary.target.manifestId, null);
  assert.equal(boundary.target.objectKey, null);
  assert.equal(boundary.target.objectSha256, null);
  assert.equal(boundary.target.artifactId, null);
  assert.equal(codes.has('unsafe-artifact-reference'), true);
  assert.equal(codes.has('missing-required-field'), true);
  assert.equal(codes.has('prerequisite-next-action-invalid'), true);
  assert.equal(codes.has('mutation-approval-not-reviewed'), true);
  assert.equal(codes.has('review-fingerprint-unverified'), true);
  assert.equal(codes.has('scope-not-matched'), true);
  assert.equal(codes.has('unsupported-adapter-backend'), true);
  assert.equal(codes.has('write-token-not-required'), true);
});

test('upload write token boundary blocks forged token and execution state', async () => {
  const prerequisitePlan = await validPrerequisitePlan();
  const forgedPlan = {
    ...prerequisitePlan,
    uploadApproved: true,
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
    uploadCommand: 'aws s3 cp should-not-copy',
    prerequisitePlan: {
      ...prerequisitePlan.prerequisitePlan,
      mutationApprovalGranted: true,
      uploadApproved: true,
      uploadExecutionAllowed: true,
      executionAllowed: true
    },
    executionBoundary: {
      ...prerequisitePlan.executionBoundary,
      executable: true,
      artifactBytesProvided: true,
      adapterInjected: true,
      writeTokenIssued: true,
      executionLeaseCreated: true,
      rollbackPlanCreated: true,
      auditRecordCreated: true,
      clientCreated: true,
      credentialValuesRead: true,
      credentialPresenceChecked: true,
      liveCheckPerformed: true,
      uploadCommandGenerated: true,
      objectWriteAttempted: true,
      metadataIndexWriteAttempted: true,
      remoteMutationPerformed: true
    },
    writeTokenBoundary: {
      tokenIssued: true,
      tokenScopeBoundToArtifact: true,
      tokenExpirySet: true,
      singleUseTokenIssued: true
    }
  };

  const boundary = buildKnowledgeTeamUploadWriteTokenBoundary({
    prerequisitePlan: forgedPlan
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assertExecutionDisabled(boundary);
  for (const code of [
    'upload-approval-already-provided',
    'upload-execution-enabled',
    'mutation-approval-already-granted',
    'client-created',
    'adapter-injected',
    'artifact-bytes-provided',
    'write-token-issued',
    'execution-lease-created',
    'rollback-plan-created',
    'audit-record-created',
    'object-write-attempted',
    'metadata-index-write-attempted',
    'remote-mutation-performed',
    'upload-command-present',
    'credential-values-exposed',
    'credential-presence-check-enabled',
    'live-check-enabled',
    'token-scope-already-bound',
    'token-expiry-already-set'
  ]) {
    assert.equal(codes.has(code), true, code);
  }
  assertNoPrivateValues(boundary);
});

test('upload write token boundary blocks backend detail leakage without copying private values', async () => {
  const prerequisitePlan = await validPrerequisitePlan();
  const leakyPlan = {
    ...prerequisitePlan,
    endpointUrl: 'https://should-not-copy.example.test',
    target: {
      ...prerequisitePlan.target,
      objectKey: 's3://private-bucket/should-not-copy'
    },
    sourceReview: {
      ...prerequisitePlan.sourceReview,
      bucketName: 'should-not-copy-bucket',
      adapterName: '../unsafe-adapter'
    },
    privateCredential: {
      secretAccessKey: 'should-not-copy-secret',
      privateKey: 'private-key'
    }
  };

  const boundary = buildKnowledgeTeamUploadWriteTokenBoundary({
    prerequisitePlan: leakyPlan
  });

  assert.equal(boundary.status, 'blocked');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.target.objectKey, null);
  assert.equal(blockerCodes(boundary).has('backend-detail-leak'), true);
  assert.equal(blockerCodes(boundary).has('unsafe-artifact-reference'), true);
  assert.equal(blockerCodes(boundary).has('unsafe-adapter-name'), true);
  assertNoPrivateValues(boundary);
});
