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
  buildKnowledgeTeamUploadMutationApprovalReview
} from '../../src/knowledge/team-upload-mutation-approval-review.ts';
import {
  buildKnowledgeTeamUploadMutationPlan
} from '../../src/knowledge/team-upload-mutation-plan.ts';
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

function assertReviewShape(review) {
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
    'uploadExecutionAllowed',
    'mutationApprovalGranted',
    'clientCreated',
    'adapterInjected',
    'artifactBytesProvided',
    'writeTokenIssued',
    'executionLeaseCreated',
    'rollbackPlanCreated',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed',
    'uploadCommand',
    'target',
    'sourcePlan',
    'approvalReview',
    'executionBoundary',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(review.target), [
    'manifestId',
    'objectKey',
    'objectSha256',
    'artifactId'
  ]);
  assert.deepEqual(Object.keys(review.sourcePlan), [
    'source',
    'planStatus',
    'planKind',
    'planNextAction',
    'gateStatus',
    'gateKind',
    'scopeMatched',
    'continuationStatus',
    'approvalProvided',
    'sourceFingerprintVerified',
    'mockHarnessStatus',
    'mockHarnessKind',
    'mockAdapterInstantiated',
    'adapterName',
    'adapterBackendKind',
    'approvalFingerprint'
  ]);
  assert.deepEqual(Object.keys(review.sourcePlan.approvalFingerprint), [
    'algorithm',
    'scope',
    'value',
    'canonicalFieldCount'
  ]);
  assert.deepEqual(Object.keys(review.approvalReview), [
    'mutationApprovalRequired',
    'humanReviewRequired',
    'humanReviewRecorded',
    'source',
    'suppliedFingerprint',
    'expectedFingerprint',
    'fingerprintVerified',
    'mutationApprovalGranted',
    'uploadApproved',
    'uploadExecutionAllowed'
  ]);
  assert.deepEqual(Object.keys(review.executionBoundary), [
    'executable',
    'dryRunOnly',
    'artifactBytesProvided',
    'adapterInjected',
    'writeTokenIssued',
    'executionLeaseCreated',
    'rollbackPlanCreated',
    'auditRecordCreated',
    'clientCreated',
    'credentialValuesRead',
    'credentialPresenceChecked',
    'liveCheckPerformed',
    'uploadCommandGenerated',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed'
  ]);
  assert.deepEqual(Object.keys(review.readiness), [
    'status',
    'nextAction',
    'blockerCount',
    'blockerCodes',
    'blockers',
    'reason'
  ]);
}

function assertNonExecutable(review) {
  for (const key of [
    'mutationAllowed',
    'remoteWriteAllowed',
    'liveCheckAllowed',
    'credentialValuesExposed',
    'credentialPresenceChecked',
    'uploadApproved',
    'uploadExecutionAllowed',
    'mutationApprovalGranted',
    'clientCreated',
    'adapterInjected',
    'artifactBytesProvided',
    'writeTokenIssued',
    'executionLeaseCreated',
    'rollbackPlanCreated',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed'
  ]) {
    assert.equal(review[key], false, key);
  }
  assert.equal(review.uploadCommand, null);
  assert.equal(review.executionBoundary.executable, false);
  assert.equal(review.executionBoundary.dryRunOnly, true);
  for (const key of [
    'artifactBytesProvided',
    'adapterInjected',
    'writeTokenIssued',
    'executionLeaseCreated',
    'rollbackPlanCreated',
    'auditRecordCreated',
    'clientCreated',
    'credentialValuesRead',
    'credentialPresenceChecked',
    'liveCheckPerformed',
    'uploadCommandGenerated',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed'
  ]) {
    assert.equal(review.executionBoundary[key], false, key);
  }
}

function assertNoPrivateValues(value) {
  const text = JSON.stringify(value);
  for (const forbidden of [
    'aws s3 cp',
    's3://private-bucket',
    'private-key',
    'https://',
    '/tmp/',
    '/home/',
    '/workspace/'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

test('upload mutation approval review contract accepts fingerprint review records', async () => {
  const mutationPlan = await validMutationPlan();
  const review = buildKnowledgeTeamUploadMutationApprovalReview({
    mutationPlan,
    approvalFingerprint: mutationPlan.approvalAudit.approvalScopeFingerprint.value
  });

  assertReviewShape(review);
  assert.equal(review.kind, 'infra-agent.knowledge-team-upload-mutation-approval-review');
  assert.equal(review.schemaVersion, 1);
  assert.equal(review.executionMode, 'dry-run');
  assert.equal(review.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(review.status, 'review-ready');
  assert.equal(review.plannedOperation, 'stage-knowledge-pack');
  assert.equal(review.sourcePlan.source, 'upload-mutation-plan');
  assert.equal(review.sourcePlan.planStatus, 'plan-ready');
  assert.equal(review.sourcePlan.planKind, 'approval-audit-dry-run');
  assert.equal(review.sourcePlan.planNextAction, 'request-human-mutation-approval');
  assert.equal(review.sourcePlan.gateStatus, 'gate-ready');
  assert.equal(review.sourcePlan.sourceFingerprintVerified, true);
  assert.equal(review.sourcePlan.approvalFingerprint.scope, 'stage-knowledge-pack-mutation-plan-v1');
  assert.equal(review.sourcePlan.approvalFingerprint.canonicalFieldCount, 12);
  assert.match(review.sourcePlan.approvalFingerprint.value, /^[a-f0-9]{64}$/);
  assert.equal(review.approvalReview.humanReviewRecorded, true);
  assert.equal(review.approvalReview.source, 'cli-flag');
  assert.equal(review.approvalReview.fingerprintVerified, true);
  assert.equal(review.approvalReview.suppliedFingerprint, review.approvalReview.expectedFingerprint);
  assert.equal(review.approvalReview.mutationApprovalGranted, false);
  assert.equal(review.approvalReview.uploadApproved, false);
  assert.equal(review.approvalReview.uploadExecutionAllowed, false);
  assert.equal(review.readiness.status, 'review-ready');
  assert.equal(review.readiness.nextAction, 'plan-execution-prerequisite-boundaries');
  assert.deepEqual(review.readiness.blockerCodes, []);
  assertNonExecutable(review);
  assertNoPrivateValues(review);

  const validation = validateKnowledgePayload(review, 'inline');
  assert.equal(validation.valid, true);
});

test('upload mutation approval review contract keeps blocked records safe', async () => {
  const mutationPlan = await validMutationPlan();
  const review = buildKnowledgeTeamUploadMutationApprovalReview({
    mutationPlan: {
      ...mutationPlan,
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
      endpointUrl: 'https://private.example.test',
      writeTokenIssued: true,
      executionPlan: {
        ...mutationPlan.executionPlan,
        clientCreated: true,
        remoteMutationPerformed: true
      }
    },
    approvalFingerprint: '0'.repeat(64)
  });

  assertReviewShape(review);
  assert.equal(review.status, 'blocked');
  assert.equal(review.readiness.nextAction, 'resolve-blockers');
  assert.equal(review.approvalReview.humanReviewRecorded, false);
  assert.equal(review.approvalReview.fingerprintVerified, false);
  assert.equal(review.readiness.blockerCodes.includes('review-fingerprint-mismatch'), true);
  assert.equal(review.readiness.blockerCodes.includes('backend-detail-leak'), true);
  assert.equal(review.readiness.blockerCodes.includes('upload-command-present'), true);
  assert.equal(review.readiness.blockerCodes.includes('write-token-issued'), true);
  assert.equal(review.readiness.blockerCodes.includes('client-created'), true);
  assert.equal(review.readiness.blockerCodes.includes('remote-mutation-performed'), true);
  assertNonExecutable(review);
  assertNoPrivateValues(review);

  const validation = validateKnowledgePayload(review, 'inline');
  assert.equal(validation.valid, true);
});
