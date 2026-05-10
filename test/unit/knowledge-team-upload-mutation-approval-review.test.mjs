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
  buildKnowledgeTeamUploadMockHarness
} from '../../src/knowledge/team-upload-mock-harness.ts';
import {
  buildKnowledgeTeamUploadMutationPlan
} from '../../src/knowledge/team-upload-mutation-plan.ts';
import {
  buildKnowledgeTeamUploadMutationApprovalReview
} from '../../src/knowledge/team-upload-mutation-approval-review.ts';
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

async function validMutationPlan() {
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
  return buildKnowledgeTeamUploadMutationPlan({ executionGate });
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

function blockerCodes(review) {
  return new Set(review.readiness.blockerCodes);
}

function assertExecutionDisabled(review) {
  assert.equal(review.mutationAllowed, false);
  assert.equal(review.executionMode, 'dry-run');
  assert.equal(review.remoteWriteAllowed, false);
  assert.equal(review.liveCheckAllowed, false);
  assert.equal(review.credentialValuesExposed, false);
  assert.equal(review.credentialPresenceChecked, false);
  assert.equal(review.uploadApproved, false);
  assert.equal(review.uploadExecutionAllowed, false);
  assert.equal(review.mutationApprovalGranted, false);
  assert.equal(review.clientCreated, false);
  assert.equal(review.adapterInjected, false);
  assert.equal(review.artifactBytesProvided, false);
  assert.equal(review.writeTokenIssued, false);
  assert.equal(review.executionLeaseCreated, false);
  assert.equal(review.rollbackPlanCreated, false);
  assert.equal(review.objectWriteAttempted, false);
  assert.equal(review.metadataIndexWriteAttempted, false);
  assert.equal(review.remoteMutationPerformed, false);
  assert.equal(review.uploadCommand, null);
  assert.equal(review.approvalReview.mutationApprovalGranted, false);
  assert.equal(review.approvalReview.uploadApproved, false);
  assert.equal(review.approvalReview.uploadExecutionAllowed, false);
  assert.equal(review.executionBoundary.executable, false);
  assert.equal(review.executionBoundary.dryRunOnly, true);
  assert.equal(review.executionBoundary.artifactBytesProvided, false);
  assert.equal(review.executionBoundary.adapterInjected, false);
  assert.equal(review.executionBoundary.writeTokenIssued, false);
  assert.equal(review.executionBoundary.executionLeaseCreated, false);
  assert.equal(review.executionBoundary.rollbackPlanCreated, false);
  assert.equal(review.executionBoundary.auditRecordCreated, false);
  assert.equal(review.executionBoundary.clientCreated, false);
  assert.equal(review.executionBoundary.credentialValuesRead, false);
  assert.equal(review.executionBoundary.credentialPresenceChecked, false);
  assert.equal(review.executionBoundary.liveCheckPerformed, false);
  assert.equal(review.executionBoundary.uploadCommandGenerated, false);
  assert.equal(review.executionBoundary.objectWriteAttempted, false);
  assert.equal(review.executionBoundary.metadataIndexWriteAttempted, false);
  assert.equal(review.executionBoundary.remoteMutationPerformed, false);
}

test('upload mutation approval review records matching fingerprint without enabling execution', async () => {
  const mutationPlan = await validMutationPlan();
  const review = buildKnowledgeTeamUploadMutationApprovalReview({
    mutationPlan,
    approvalFingerprint: mutationPlan.approvalAudit.approvalScopeFingerprint.value
  });

  assert.equal(review.kind, 'infra-agent.knowledge-team-upload-mutation-approval-review');
  assert.equal(review.schemaVersion, 1);
  assert.equal(review.mutationAllowed, false);
  assert.equal(review.executionMode, 'dry-run');
  assert.equal(review.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(review.status, 'review-ready');
  assert.equal(review.plannedOperation, 'stage-knowledge-pack');
  assert.equal(review.remoteWriteAllowed, false);
  assert.equal(review.liveCheckAllowed, false);
  assert.equal(review.credentialValuesExposed, false);
  assert.equal(review.credentialPresenceChecked, false);
  assert.equal(review.uploadApproved, false);
  assert.equal(review.uploadExecutionAllowed, false);
  assert.equal(review.mutationApprovalGranted, false);
  assert.equal(review.clientCreated, false);
  assert.equal(review.adapterInjected, false);
  assert.equal(review.artifactBytesProvided, false);
  assert.equal(review.writeTokenIssued, false);
  assert.equal(review.executionLeaseCreated, false);
  assert.equal(review.rollbackPlanCreated, false);
  assert.equal(review.objectWriteAttempted, false);
  assert.equal(review.metadataIndexWriteAttempted, false);
  assert.equal(review.remoteMutationPerformed, false);
  assert.equal(review.uploadCommand, null);
  assert.equal(review.target.manifestId, mutationPlan.target.manifestId);
  assert.equal(review.target.objectKey, mutationPlan.target.objectKey);
  assert.equal(review.target.objectSha256, mutationPlan.target.objectSha256);
  assert.equal(review.target.artifactId, mutationPlan.target.artifactId);
  assert.equal(review.sourcePlan.source, 'upload-mutation-plan');
  assert.equal(review.sourcePlan.planStatus, 'plan-ready');
  assert.equal(review.sourcePlan.planKind, 'approval-audit-dry-run');
  assert.equal(review.sourcePlan.planNextAction, 'request-human-mutation-approval');
  assert.equal(review.sourcePlan.gateStatus, 'gate-ready');
  assert.equal(review.sourcePlan.scopeMatched, true);
  assert.equal(review.sourcePlan.sourceFingerprintVerified, true);
  assert.equal(review.sourcePlan.mockHarnessStatus, 'harness-ready');
  assert.equal(review.sourcePlan.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(
    review.sourcePlan.approvalFingerprint.value,
    mutationPlan.approvalAudit.approvalScopeFingerprint.value
  );
  assert.equal(review.approvalReview.mutationApprovalRequired, true);
  assert.equal(review.approvalReview.humanReviewRequired, true);
  assert.equal(review.approvalReview.humanReviewRecorded, true);
  assert.equal(review.approvalReview.source, 'cli-flag');
  assert.equal(
    review.approvalReview.suppliedFingerprint,
    mutationPlan.approvalAudit.approvalScopeFingerprint.value
  );
  assert.equal(
    review.approvalReview.expectedFingerprint,
    mutationPlan.approvalAudit.approvalScopeFingerprint.value
  );
  assert.equal(review.approvalReview.fingerprintVerified, true);
  assert.equal(review.approvalReview.mutationApprovalGranted, false);
  assert.equal(review.approvalReview.uploadApproved, false);
  assert.equal(review.approvalReview.uploadExecutionAllowed, false);
  assert.equal(review.executionBoundary.executable, false);
  assert.equal(review.executionBoundary.dryRunOnly, true);
  assert.equal(review.executionBoundary.artifactBytesProvided, false);
  assert.equal(review.executionBoundary.adapterInjected, false);
  assert.equal(review.executionBoundary.writeTokenIssued, false);
  assert.equal(review.executionBoundary.executionLeaseCreated, false);
  assert.equal(review.executionBoundary.rollbackPlanCreated, false);
  assert.equal(review.executionBoundary.auditRecordCreated, false);
  assert.equal(review.executionBoundary.clientCreated, false);
  assert.equal(review.executionBoundary.credentialValuesRead, false);
  assert.equal(review.executionBoundary.credentialPresenceChecked, false);
  assert.equal(review.executionBoundary.liveCheckPerformed, false);
  assert.equal(review.executionBoundary.uploadCommandGenerated, false);
  assert.equal(review.executionBoundary.objectWriteAttempted, false);
  assert.equal(review.executionBoundary.metadataIndexWriteAttempted, false);
  assert.equal(review.executionBoundary.remoteMutationPerformed, false);
  assert.equal(review.readiness.status, 'review-ready');
  assert.equal(review.readiness.nextAction, 'plan-execution-prerequisite-boundaries');
  assert.equal(review.readiness.blockerCount, 0);
  assert.deepEqual(review.readiness.blockerCodes, []);
  assertNoPrivateValues(review);
});

test('upload mutation approval review blocks non-ready mutation plans', async () => {
  const mutationPlan = await validMutationPlan();
  const blockedPlan = {
    ...mutationPlan,
    status: 'blocked',
    readiness: {
      ...mutationPlan.readiness,
      status: 'blocked',
      nextAction: 'resolve-blockers',
      blockerCount: 1,
      blockerCodes: ['operator-review-required'],
      blockers: [{
        code: 'operator-review-required',
        path: '$.approvalAudit',
        message: 'Operator review is required before planning execution prerequisites.'
      }]
    }
  };

  const review = buildKnowledgeTeamUploadMutationApprovalReview({
    mutationPlan: blockedPlan,
    approvalFingerprint: mutationPlan.approvalAudit.approvalScopeFingerprint.value
  });
  const codes = blockerCodes(review);

  assert.equal(review.status, 'blocked');
  assert.equal(review.readiness.status, 'blocked');
  assert.equal(review.readiness.nextAction, 'resolve-blockers');
  assert.equal(review.approvalReview.humanReviewRecorded, false);
  assert.equal(review.approvalReview.fingerprintVerified, false);
  assert.equal(codes.has('mutation-plan-not-ready'), true);
  assertExecutionDisabled(review);
  assertNoPrivateValues(review);
});

test('upload mutation approval review blocks invalid plan artifacts without leaking private fields', async () => {
  const mutationPlan = await validMutationPlan();
  const invalidPlan = {
    ...mutationPlan,
    kind: 'infra-agent.knowledge-team-upload-execution-gate',
    schemaVersion: 2,
    planKind: 'execution-ready',
    endpointUrl: 'https://should-not-copy.example.test',
    bucketName: 'should-not-copy-bucket',
    uploadCommand: 'aws s3 cp artifact.tgz s3://private-bucket/private-key'
  };

  const review = buildKnowledgeTeamUploadMutationApprovalReview({
    mutationPlan: invalidPlan,
    approvalFingerprint: mutationPlan.approvalAudit.approvalScopeFingerprint.value
  });
  const codes = blockerCodes(review);

  assert.equal(review.status, 'blocked');
  assert.equal(codes.has('invalid-mutation-plan-kind'), true);
  assert.equal(codes.has('invalid-schema-version'), true);
  assert.equal(codes.has('invalid-plan-kind'), true);
  assert.equal(codes.has('backend-detail-leak'), true);
  assert.equal(codes.has('upload-command-present'), true);
  assert.equal(review.approvalReview.humanReviewRecorded, false);
  assert.equal(review.approvalReview.fingerprintVerified, false);
  assertExecutionDisabled(review);
  assertNoPrivateValues(review);
});

test('upload mutation approval review blocks missing unsafe and mismatched fingerprints', async () => {
  const mutationPlan = await validMutationPlan();

  for (const [approvalFingerprint, expectedCode] of [
    [null, 'review-fingerprint-missing'],
    ['not-a-sha256', 'unsafe-review-fingerprint'],
    ['0'.repeat(64), 'review-fingerprint-mismatch']
  ]) {
    const review = buildKnowledgeTeamUploadMutationApprovalReview({
      mutationPlan,
      approvalFingerprint
    });
    const codes = blockerCodes(review);

    assert.equal(review.status, 'blocked', expectedCode);
    assert.equal(codes.has(expectedCode), true, expectedCode);
    assert.equal(review.approvalReview.humanReviewRecorded, false);
    assert.equal(review.approvalReview.fingerprintVerified, false);
    assertExecutionDisabled(review);
    assertNoPrivateValues(review);
  }
});

test('upload mutation approval review blocks missing unsafe and mismatched plan fingerprints', async () => {
  const mutationPlan = await validMutationPlan();

  for (const [approvalScopeFingerprint, expectedCode] of [
    [null, 'plan-fingerprint-missing'],
    [{
      ...mutationPlan.approvalAudit.approvalScopeFingerprint,
      value: 'not-a-sha256'
    }, 'unsafe-review-fingerprint'],
    [{
      ...mutationPlan.approvalAudit.approvalScopeFingerprint,
      value: '0'.repeat(64)
    }, 'review-fingerprint-mismatch']
  ]) {
    const plan = {
      ...mutationPlan,
      approvalAudit: {
        ...mutationPlan.approvalAudit,
        approvalScopeFingerprint
      }
    };
    const review = buildKnowledgeTeamUploadMutationApprovalReview({
      mutationPlan: plan,
      approvalFingerprint: mutationPlan.approvalAudit.approvalScopeFingerprint.value
    });
    const codes = blockerCodes(review);

    assert.equal(review.status, 'blocked', expectedCode);
    assert.equal(codes.has(expectedCode), true, expectedCode);
    assert.equal(review.approvalReview.humanReviewRecorded, false);
    assert.equal(review.approvalReview.fingerprintVerified, false);
    assertExecutionDisabled(review);
    assertNoPrivateValues(review);
  }
});

test('upload mutation approval review blocks forged mutation and execution state', async () => {
  const mutationPlan = await validMutationPlan();
  const forgedPlan = {
    ...mutationPlan,
    mutationAllowed: true,
    executionMode: 'live',
    remoteWriteAllowed: true,
    liveCheckAllowed: true,
    credentialValuesExposed: true,
    credentialPresenceChecked: true,
    uploadApproved: true,
    uploadExecutionAllowed: true,
    mutationApprovalGranted: true,
    clientCreated: true,
    adapterInjected: true,
    artifactBytesProvided: true,
    writeTokenIssued: true,
    executionLeaseCreated: true,
    rollbackPlanCreated: true,
    objectWriteAttempted: true,
    metadataIndexWriteAttempted: true,
    remoteMutationPerformed: true,
    uploadCommand: 'aws s3 cp artifact.tgz s3://private-bucket/private-key',
    approvalAudit: {
      ...mutationPlan.approvalAudit,
      humanApprovalRequestIssued: true,
      uploadApproved: true,
      uploadExecutionAllowed: true,
      mutationApprovalGranted: true
    },
    executionPlan: {
      ...mutationPlan.executionPlan,
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
    }
  };

  const review = buildKnowledgeTeamUploadMutationApprovalReview({
    mutationPlan: forgedPlan,
    approvalFingerprint: mutationPlan.approvalAudit.approvalScopeFingerprint.value
  });
  const codes = blockerCodes(review);

  for (const code of [
    'mutation-enabled',
    'remote-write-enabled',
    'live-check-enabled',
    'credential-values-exposed',
    'credential-presence-check-enabled',
    'upload-approval-already-provided',
    'upload-execution-enabled',
    'mutation-approval-already-granted',
    'client-created',
    'adapter-injected',
    'artifact-bytes-provided',
    'write-token-issued',
    'execution-lease-created',
    'rollback-plan-created',
    'object-write-attempted',
    'metadata-index-write-attempted',
    'remote-mutation-performed',
    'upload-command-present',
    'backend-detail-leak'
  ]) {
    assert.equal(codes.has(code), true, code);
  }
  assert.equal(review.status, 'blocked');
  assert.equal(review.approvalReview.humanReviewRecorded, false);
  assert.equal(review.approvalReview.fingerprintVerified, false);
  assertExecutionDisabled(review);
  assertNoPrivateValues(review);
});

test('upload mutation approval review validates through knowledge validation dispatch', async () => {
  const mutationPlan = await validMutationPlan();
  const review = buildKnowledgeTeamUploadMutationApprovalReview({
    mutationPlan,
    approvalFingerprint: mutationPlan.approvalAudit.approvalScopeFingerprint.value
  });

  const report = validateKnowledgePayload(review, 'inline-review.json');

  assert.equal(report.inputKind, 'infra-agent.knowledge-team-upload-mutation-approval-review');
  assert.equal(report.valid, true);
  assert.equal(report.issueCount, 0);
});

test('upload mutation approval review validation rejects executable review shapes', async () => {
  const mutationPlan = await validMutationPlan();
  const review = buildKnowledgeTeamUploadMutationApprovalReview({
    mutationPlan,
    approvalFingerprint: mutationPlan.approvalAudit.approvalScopeFingerprint.value
  });
  const forgedReview = {
    ...review,
    remoteWriteAllowed: true,
    uploadApproved: true,
    uploadExecutionAllowed: true,
    mutationApprovalGranted: true,
    writeTokenIssued: true,
    executionLeaseCreated: true,
    artifactBytesProvided: true,
    clientCreated: true,
    adapterInjected: true,
    objectWriteAttempted: true,
    metadataIndexWriteAttempted: true,
    remoteMutationPerformed: true,
    uploadCommand: 'aws s3 cp artifact.tgz s3://private-bucket/private-key',
    approvalReview: {
      ...review.approvalReview,
      mutationApprovalGranted: true,
      uploadApproved: true,
      uploadExecutionAllowed: true
    },
    executionBoundary: {
      ...review.executionBoundary,
      executable: true,
      artifactBytesProvided: true,
      adapterInjected: true,
      writeTokenIssued: true,
      executionLeaseCreated: true,
      auditRecordCreated: true,
      clientCreated: true,
      objectWriteAttempted: true,
      metadataIndexWriteAttempted: true,
      remoteMutationPerformed: true
    }
  };

  const report = validateKnowledgePayload(forgedReview, 'inline-review.json');
  const issuePaths = new Set(report.issues.map(issue => issue.path));

  assert.equal(report.valid, false);
  for (const path of [
    '$.remoteWriteAllowed',
    '$.uploadApproved',
    '$.uploadExecutionAllowed',
    '$.mutationApprovalGranted',
    '$.writeTokenIssued',
    '$.executionLeaseCreated',
    '$.artifactBytesProvided',
    '$.clientCreated',
    '$.adapterInjected',
    '$.objectWriteAttempted',
    '$.metadataIndexWriteAttempted',
    '$.remoteMutationPerformed',
    '$.uploadCommand',
    '$.approvalReview.mutationApprovalGranted',
    '$.approvalReview.uploadApproved',
    '$.approvalReview.uploadExecutionAllowed',
    '$.executionBoundary.executable',
    '$.executionBoundary.artifactBytesProvided',
    '$.executionBoundary.adapterInjected',
    '$.executionBoundary.writeTokenIssued',
    '$.executionBoundary.executionLeaseCreated',
    '$.executionBoundary.auditRecordCreated',
    '$.executionBoundary.clientCreated',
    '$.executionBoundary.objectWriteAttempted',
    '$.executionBoundary.metadataIndexWriteAttempted',
    '$.executionBoundary.remoteMutationPerformed'
  ]) {
    assert.equal(issuePaths.has(path), true, path);
  }
});
