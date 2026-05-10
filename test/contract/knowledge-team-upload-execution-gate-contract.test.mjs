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

async function validContinuationAndHarness() {
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
  return { continuation, mockHarness };
}

function assertGateShape(gate) {
  assert.deepEqual(Object.keys(gate), [
    'kind',
    'schemaVersion',
    'mutationAllowed',
    'executionMode',
    'gateKind',
    'status',
    'plannedOperation',
    'remoteWriteAllowed',
    'liveCheckAllowed',
    'credentialValuesExposed',
    'credentialPresenceChecked',
    'uploadApproved',
    'uploadExecutionAllowed',
    'clientCreated',
    'adapterInjected',
    'writeTokenIssued',
    'executionLeaseCreated',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed',
    'uploadCommand',
    'target',
    'approvalGate',
    'mockHarness',
    'executionBoundary',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(gate.target), [
    'manifestId',
    'objectKey',
    'objectSha256',
    'artifactId'
  ]);
  assert.deepEqual(Object.keys(gate.approvalGate), [
    'source',
    'continuationStatus',
    'approvalRequired',
    'approvalProvided',
    'fingerprintVerified',
    'mutationApprovalRequired',
    'mutationApprovalGranted',
    'uploadApproved',
    'uploadExecutionAllowed',
    'scopeMatched'
  ]);
  assert.deepEqual(Object.keys(gate.mockHarness), [
    'source',
    'status',
    'harnessKind',
    'mockAdapterInstantiated',
    'adapterName',
    'adapterBackendKind',
    'descriptorMatched',
    'objectWriteAttempted',
    'indexWriteAttempted',
    'remoteMutationPerformed'
  ]);
  assert.deepEqual(Object.keys(gate.executionBoundary), [
    'dryRunOnly',
    'artifactBytesProvided',
    'adapterInjectionReviewed',
    'adapterInjected',
    'clientCreated',
    'credentialValuesRead',
    'credentialPresenceChecked',
    'liveCheckPerformed',
    'writeTokenIssued',
    'executionLeaseCreated',
    'rollbackPlanRequired',
    'auditRecordRequired',
    'uploadCommandGenerated',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed'
  ]);
  assert.deepEqual(Object.keys(gate.readiness), [
    'status',
    'nextAction',
    'blockerCount',
    'blockerCodes',
    'blockers',
    'reason'
  ]);
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

test('upload execution gate contract accepts approval-gated dry-run summaries', async () => {
  const { continuation, mockHarness } = await validContinuationAndHarness();
  const gate = buildKnowledgeTeamUploadExecutionGate({ continuation, mockHarness });

  assertGateShape(gate);
  assert.equal(gate.kind, 'infra-agent.knowledge-team-upload-execution-gate');
  assert.equal(gate.schemaVersion, 1);
  assert.equal(gate.mutationAllowed, false);
  assert.equal(gate.executionMode, 'dry-run');
  assert.equal(gate.gateKind, 'approval-gated-dry-run');
  assert.equal(gate.status, 'gate-ready');
  assert.equal(gate.plannedOperation, 'stage-knowledge-pack');
  assert.equal(gate.remoteWriteAllowed, false);
  assert.equal(gate.liveCheckAllowed, false);
  assert.equal(gate.credentialValuesExposed, false);
  assert.equal(gate.credentialPresenceChecked, false);
  assert.equal(gate.uploadApproved, false);
  assert.equal(gate.uploadExecutionAllowed, false);
  assert.equal(gate.clientCreated, false);
  assert.equal(gate.adapterInjected, false);
  assert.equal(gate.writeTokenIssued, false);
  assert.equal(gate.executionLeaseCreated, false);
  assert.equal(gate.objectWriteAttempted, false);
  assert.equal(gate.metadataIndexWriteAttempted, false);
  assert.equal(gate.remoteMutationPerformed, false);
  assert.equal(gate.uploadCommand, null);
  assert.equal(gate.approvalGate.mutationApprovalRequired, true);
  assert.equal(gate.approvalGate.mutationApprovalGranted, false);
  assert.equal(gate.approvalGate.uploadApproved, false);
  assert.equal(gate.approvalGate.uploadExecutionAllowed, false);
  assert.equal(gate.mockHarness.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(gate.mockHarness.objectWriteAttempted, false);
  assert.equal(gate.mockHarness.indexWriteAttempted, false);
  assert.equal(gate.mockHarness.remoteMutationPerformed, false);
  assert.equal(gate.executionBoundary.dryRunOnly, true);
  assert.equal(gate.executionBoundary.artifactBytesProvided, false);
  assert.equal(gate.executionBoundary.writeTokenIssued, false);
  assert.equal(gate.executionBoundary.executionLeaseCreated, false);
  assert.equal(gate.executionBoundary.uploadCommandGenerated, false);
  assert.equal(gate.executionBoundary.objectWriteAttempted, false);
  assert.equal(gate.executionBoundary.metadataIndexWriteAttempted, false);
  assert.equal(gate.executionBoundary.remoteMutationPerformed, false);
  assert.equal(gate.readiness.nextAction, 'request-separate-mutation-approval');
  assert.deepEqual(gate.readiness.blockerCodes, []);

  const validation = validateKnowledgePayload(gate, 'inline');
  assert.equal(validation.valid, true);
});

test('upload execution gate contract keeps blocked summaries safe', async () => {
  const { continuation, mockHarness } = await validContinuationAndHarness();
  const gate = buildKnowledgeTeamUploadExecutionGate({
    continuation: {
      ...continuation,
      endpointUrl: 'https://private.example.test',
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
      remoteWriteAllowed: true,
      uploadExecutionAllowed: true
    },
    mockHarness: {
      ...mockHarness,
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
      objectWriteAttempted: true,
      metadataIndexWriteAttempted: true,
      remoteMutationPerformed: true,
      mockHarness: {
        ...mockHarness.mockHarness,
        objectWriteAttempted: true,
        indexWriteAttempted: true,
        remoteMutationPerformed: true
      }
    }
  });

  assertGateShape(gate);
  assert.equal(gate.status, 'blocked');
  assert.equal(gate.remoteWriteAllowed, false);
  assert.equal(gate.uploadApproved, false);
  assert.equal(gate.uploadExecutionAllowed, false);
  assert.equal(gate.clientCreated, false);
  assert.equal(gate.adapterInjected, false);
  assert.equal(gate.writeTokenIssued, false);
  assert.equal(gate.executionLeaseCreated, false);
  assert.equal(gate.objectWriteAttempted, false);
  assert.equal(gate.metadataIndexWriteAttempted, false);
  assert.equal(gate.remoteMutationPerformed, false);
  assert.equal(gate.uploadCommand, null);
  assert.equal(gate.approvalGate.uploadApproved, false);
  assert.equal(gate.approvalGate.uploadExecutionAllowed, false);
  assert.equal(gate.mockHarness.objectWriteAttempted, false);
  assert.equal(gate.mockHarness.indexWriteAttempted, false);
  assert.equal(gate.mockHarness.remoteMutationPerformed, false);
  assert.equal(gate.executionBoundary.adapterInjectionReviewed, false);
  assert.equal(gate.executionBoundary.objectWriteAttempted, false);
  assert.equal(gate.executionBoundary.metadataIndexWriteAttempted, false);
  assert.equal(gate.executionBoundary.remoteMutationPerformed, false);
  assert.equal(gate.readiness.nextAction, 'resolve-blockers');
  assert.equal(gate.readiness.blockerCodes.includes('backend-detail-leak'), true);
  assert.equal(gate.readiness.blockerCodes.includes('upload-command-present'), true);
  assert.equal(gate.readiness.blockerCodes.includes('remote-write-enabled'), true);
  assert.equal(gate.readiness.blockerCodes.includes('upload-execution-enabled'), true);
  assert.equal(gate.readiness.blockerCodes.includes('object-write-attempted'), true);
  assert.equal(gate.readiness.blockerCodes.includes('metadata-index-write-attempted'), true);
  assert.equal(gate.readiness.blockerCodes.includes('remote-mutation-performed'), true);
  assertNoPrivateValues(gate);

  const validation = validateKnowledgePayload(gate, 'inline');
  assert.equal(validation.valid, true);
});
