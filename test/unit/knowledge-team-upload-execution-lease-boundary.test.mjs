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
  buildKnowledgeTeamUploadExecutionLeaseBoundary
} from '../../src/knowledge/team-upload-execution-lease-boundary.ts';
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

async function validWriteTokenBoundary() {
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
  return buildKnowledgeTeamUploadWriteTokenBoundary({ prerequisitePlan });
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
  assert.equal(boundary.executionLeaseBoundary.executionLeaseCreated, false);
  assert.equal(boundary.executionLeaseBoundary.leaseScopeBoundToArtifact, false);
  assert.equal(boundary.executionLeaseBoundary.singleUseLeaseCreated, false);
  assert.equal(boundary.executionLeaseBoundary.leaseExpirySet, false);
  assert.equal(boundary.executionLeaseBoundary.writeTokenIssued, false);
  assert.equal(boundary.executionLeaseBoundary.auditBindingCreated, false);
  assert.equal(boundary.executionLeaseBoundary.rollbackPlanCreated, false);
  assert.equal(boundary.executionLeaseBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.artifactBytesProvided, false);
  assert.equal(boundary.remainingExecutionBoundaries.adapterInjected, false);
  assert.equal(boundary.remainingExecutionBoundaries.writeTokenIssued, false);
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

test('upload execution lease boundary records lease requirements without creating a lease', async () => {
  const writeTokenBoundary = await validWriteTokenBoundary();
  const boundary = buildKnowledgeTeamUploadExecutionLeaseBoundary({ writeTokenBoundary });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-execution-lease-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'execution-lease-boundary-dry-run');
  assert.equal(boundary.status, 'execution-lease-boundary-ready');
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.target.manifestId, writeTokenBoundary.target.manifestId);
  assert.equal(boundary.target.objectKey, writeTokenBoundary.target.objectKey);
  assert.equal(boundary.target.objectSha256, writeTokenBoundary.target.objectSha256);
  assert.equal(boundary.target.artifactId, writeTokenBoundary.target.artifactId);
  assert.equal(boundary.sourceWriteTokenBoundary.source, 'upload-write-token-boundary');
  assert.equal(boundary.sourceWriteTokenBoundary.boundaryStatus, 'write-token-boundary-ready');
  assert.equal(boundary.sourceWriteTokenBoundary.boundaryKind, 'write-token-boundary-dry-run');
  assert.equal(boundary.sourceWriteTokenBoundary.boundaryNextAction, 'design-execution-lease-boundary');
  assert.equal(boundary.sourceWriteTokenBoundary.reviewStatus, 'review-ready');
  assert.equal(boundary.sourceWriteTokenBoundary.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourceWriteTokenBoundary.scopeMatched, true);
  assert.equal(boundary.sourceWriteTokenBoundary.humanReviewRecorded, true);
  assert.equal(boundary.sourceWriteTokenBoundary.fingerprintVerified, true);
  assert.equal(boundary.sourceWriteTokenBoundary.sourceFingerprintVerified, true);
  assert.equal(boundary.sourceWriteTokenBoundary.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourceWriteTokenBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceWriteTokenBoundary.tokenRequiredBeforeExecution, true);
  assert.equal(boundary.sourceWriteTokenBoundary.tokenScopeBindingRequired, true);
  assert.equal(boundary.sourceWriteTokenBoundary.tokenSingleUseRequired, true);
  assert.equal(boundary.sourceWriteTokenBoundary.tokenExpiryRequired, true);
  assert.equal(boundary.sourceWriteTokenBoundary.auditBindingRequired, true);
  assert.equal(boundary.sourceWriteTokenBoundary.executionLeaseRequiredBeforeIssuance, true);
  assert.equal(boundary.sourceWriteTokenBoundary.rollbackPlanRequiredBeforeIssuance, true);
  assert.equal(boundary.executionLeaseBoundary.dryRunOnly, true);
  assert.equal(boundary.executionLeaseBoundary.executionLeaseRequiredBeforeExecution, true);
  assert.equal(boundary.executionLeaseBoundary.leaseScopeBindingRequired, true);
  assert.equal(boundary.executionLeaseBoundary.leaseSingleUseRequired, true);
  assert.equal(boundary.executionLeaseBoundary.leaseExpiryRequired, true);
  assert.equal(boundary.executionLeaseBoundary.writeTokenRequiredBeforeLease, true);
  assert.equal(boundary.executionLeaseBoundary.auditBindingRequired, true);
  assert.equal(boundary.executionLeaseBoundary.rollbackPlanRequiredBeforeExecution, true);
  assert.equal(boundary.readiness.status, 'execution-lease-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-rollback-plan-boundary');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assertNoPrivateValues(boundary);
});

test('upload execution lease boundary blocks non-ready write-token boundaries', async () => {
  const writeTokenBoundary = await validWriteTokenBoundary();
  const blockedWriteTokenBoundary = {
    ...writeTokenBoundary,
    status: 'blocked',
    sourceWriteTokenBoundary: undefined,
    sourcePrerequisitePlan: {
      ...writeTokenBoundary.sourcePrerequisitePlan,
      fingerprintVerified: false
    },
    readiness: {
      ...writeTokenBoundary.readiness,
      status: 'blocked',
      nextAction: 'resolve-blockers',
      blockerCount: 1,
      blockerCodes: ['review-fingerprint-unverified'],
      blockers: [{
        code: 'review-fingerprint-unverified',
        path: '$.sourcePrerequisitePlan.fingerprintVerified',
        message: 'fingerprint not verified'
      }]
    }
  };

  const boundary = buildKnowledgeTeamUploadExecutionLeaseBoundary({
    writeTokenBoundary: blockedWriteTokenBoundary
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.readiness.status, 'blocked');
  assert.equal(boundary.readiness.nextAction, 'resolve-blockers');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.sourceWriteTokenBoundary.boundaryStatus, 'blocked');
  assert.equal(boundary.sourceWriteTokenBoundary.fingerprintVerified, false);
  assert.equal(codes.has('token-boundary-not-ready'), true);
  assert.equal(codes.has('token-boundary-next-action-invalid'), true);
  assert.equal(codes.has('review-fingerprint-unverified'), true);
  assertNoPrivateValues(boundary);
});

test('upload execution lease boundary blocks invalid write-token inputs', () => {
  const boundary = buildKnowledgeTeamUploadExecutionLeaseBoundary({
    writeTokenBoundary: null
  });

  assert.equal(boundary.status, 'blocked');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.sourceWriteTokenBoundary.boundaryStatus, 'invalid');
  assert.equal(blockerCodes(boundary).has('missing-required-field'), true);
  assert.equal(boundary.target.manifestId, null);
  assert.equal(boundary.target.objectKey, null);
  assert.equal(boundary.target.objectSha256, null);
  assert.equal(boundary.target.artifactId, null);
});

test('upload execution lease boundary blocks malformed write-token metadata', () => {
  const boundary = buildKnowledgeTeamUploadExecutionLeaseBoundary({
    writeTokenBoundary: {
      kind: 'infra-agent.other-artifact',
      schemaVersion: 2,
      boundaryKind: 'runtime-boundary',
      status: 'queued',
      target: {
        manifestId: 'unsafe-id',
        objectKey: '../unsafe-object',
        objectSha256: 'not-a-sha',
        artifactId: 'unsafe-artifact'
      },
      sourcePrerequisitePlan: {
        reviewStatus: 'queued',
        reviewKind: 'operator-note',
        scopeMatched: false,
        humanReviewRecorded: false,
        fingerprintVerified: false,
        sourceFingerprintVerified: false,
        adapterName: 'mock-team-cache',
        adapterBackendKind: 'real-s3'
      },
      writeTokenBoundary: {
        tokenRequiredBeforeExecution: false,
        tokenScopeBindingRequired: false,
        tokenSingleUseRequired: false,
        tokenExpiryRequired: false,
        auditBindingRequired: false,
        executionLeaseRequiredBeforeIssuance: false,
        rollbackPlanRequiredBeforeIssuance: false
      },
      remainingExecutionBoundaries: {
        executionLeaseRequired: false,
        rollbackPlanRequired: false,
        auditRecordRequired: false
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
  assert.equal(boundary.sourceWriteTokenBoundary.boundaryStatus, 'invalid');
  assert.equal(boundary.sourceWriteTokenBoundary.boundaryKind, 'unsupported');
  assert.equal(boundary.sourceWriteTokenBoundary.boundaryNextAction, 'invalid');
  assert.equal(boundary.sourceWriteTokenBoundary.reviewStatus, 'invalid');
  assert.equal(boundary.sourceWriteTokenBoundary.reviewKind, 'unsupported');
  assert.equal(boundary.sourceWriteTokenBoundary.adapterBackendKind, 'unsupported');
  assert.equal(boundary.target.manifestId, null);
  assert.equal(boundary.target.objectKey, null);
  assert.equal(boundary.target.objectSha256, null);
  assert.equal(boundary.target.artifactId, null);
  for (const code of [
    'invalid-write-token-boundary-kind',
    'invalid-schema-version',
    'invalid-boundary-kind',
    'token-boundary-not-ready',
    'unsafe-artifact-reference',
    'token-boundary-next-action-invalid',
    'review-fingerprint-unverified',
    'scope-not-matched',
    'unsupported-adapter-backend',
    'write-token-not-required',
    'execution-lease-not-required'
  ]) {
    assert.equal(codes.has(code), true, code);
  }
});

test('upload execution lease boundary blocks missing nested write-token sections', () => {
  const boundary = buildKnowledgeTeamUploadExecutionLeaseBoundary({
    writeTokenBoundary: {
      kind: 'infra-agent.knowledge-team-upload-write-token-boundary',
      schemaVersion: 1,
      boundaryKind: 'write-token-boundary-dry-run',
      status: 'write-token-boundary-ready',
      target: null,
      sourcePrerequisitePlan: null,
      writeTokenBoundary: null,
      remainingExecutionBoundaries: null,
      readiness: null
    }
  });
  const codes = blockerCodes(boundary);

  assert.equal(boundary.status, 'blocked');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.sourceWriteTokenBoundary.boundaryNextAction, 'invalid');
  assert.equal(boundary.sourceWriteTokenBoundary.tokenRequiredBeforeExecution, false);
  assert.equal(boundary.target.manifestId, null);
  assert.equal(boundary.target.objectKey, null);
  assert.equal(boundary.target.objectSha256, null);
  assert.equal(boundary.target.artifactId, null);
  assert.equal(codes.has('unsafe-artifact-reference'), true);
  assert.equal(codes.has('missing-required-field'), true);
  assert.equal(codes.has('token-boundary-next-action-invalid'), true);
  assert.equal(codes.has('review-fingerprint-unverified'), true);
  assert.equal(codes.has('scope-not-matched'), true);
  assert.equal(codes.has('unsupported-adapter-backend'), true);
  assert.equal(codes.has('write-token-not-required'), true);
  assert.equal(codes.has('execution-lease-not-required'), true);
});

test('upload execution lease boundary blocks forged lease and execution state', async () => {
  const writeTokenBoundary = await validWriteTokenBoundary();
  const forgedBoundary = {
    ...writeTokenBoundary,
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
    writeTokenBoundary: {
      ...writeTokenBoundary.writeTokenBoundary,
      tokenIssued: true,
      tokenScopeBoundToArtifact: true,
      singleUseTokenIssued: true,
      tokenExpirySet: true,
      auditBindingCreated: true,
      executionLeaseCreated: true,
      rollbackPlanCreated: true,
      executable: true
    },
    remainingExecutionBoundaries: {
      ...writeTokenBoundary.remainingExecutionBoundaries,
      executionLeaseCreated: true,
      rollbackPlanCreated: true,
      auditRecordCreated: true,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true,
      remoteMutationAllowed: true
    },
    executionLeaseBoundary: {
      executionLeaseCreated: true,
      leaseScopeBoundToArtifact: true,
      singleUseLeaseCreated: true,
      leaseExpirySet: true,
      writeTokenIssued: true,
      auditBindingCreated: true,
      rollbackPlanCreated: true,
      executable: true
    }
  };

  const boundary = buildKnowledgeTeamUploadExecutionLeaseBoundary({
    writeTokenBoundary: forgedBoundary
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
    'token-scope-already-bound',
    'token-expiry-already-set',
    'audit-binding-created',
    'lease-scope-already-bound',
    'lease-expiry-already-set'
  ]) {
    assert.equal(codes.has(code), true, code);
  }
  assertNoPrivateValues(boundary);
});

test('upload execution lease boundary blocks backend and token material leakage without copying private values', async () => {
  const writeTokenBoundary = await validWriteTokenBoundary();
  const leakyBoundary = {
    ...writeTokenBoundary,
    endpointUrl: 'https://should-not-copy.example.test',
    target: {
      ...writeTokenBoundary.target,
      objectKey: 's3://private-bucket/should-not-copy'
    },
    sourcePrerequisitePlan: {
      ...writeTokenBoundary.sourcePrerequisitePlan,
      bucketName: 'should-not-copy-bucket',
      adapterName: '../unsafe-adapter'
    },
    privateCredential: {
      secretAccessKey: 'should-not-copy-secret',
      privateKey: 'private-key'
    },
    writeTokenBoundary: {
      ...writeTokenBoundary.writeTokenBoundary,
      tokenValue: 'should-not-copy-secret'
    },
    executionLeaseBoundary: {
      leaseValue: 'private-key'
    }
  };

  const boundary = buildKnowledgeTeamUploadExecutionLeaseBoundary({
    writeTokenBoundary: leakyBoundary
  });

  assert.equal(boundary.status, 'blocked');
  assertExecutionDisabled(boundary);
  assert.equal(boundary.target.objectKey, null);
  assert.equal(blockerCodes(boundary).has('backend-detail-leak'), true);
  assert.equal(blockerCodes(boundary).has('unsafe-artifact-reference'), true);
  assert.equal(blockerCodes(boundary).has('unsafe-adapter-name'), true);
  assertNoPrivateValues(boundary);
});

test('upload execution lease boundary validates through knowledge validation dispatch', async () => {
  const writeTokenBoundary = await validWriteTokenBoundary();
  const boundary = buildKnowledgeTeamUploadExecutionLeaseBoundary({ writeTokenBoundary });
  const report = validateKnowledgePayload(boundary, {
    inputPath: 'execution-lease-boundary.json'
  });

  assert.equal(report.valid, true);
  assert.equal(report.inputKind, 'infra-agent.knowledge-team-upload-execution-lease-boundary');
  assert.equal(report.issueCount, 0);
});
