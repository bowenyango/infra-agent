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

test('upload execution gate accepts matching continuation and mock harness without enabling execution', async () => {
  const { continuation, mockHarness } = await validContinuationAndHarness();
  const gate = buildKnowledgeTeamUploadExecutionGate({
    continuation,
    mockHarness
  });

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
  assert.equal(gate.target.manifestId, continuation.target.manifestId);
  assert.equal(gate.target.objectKey, continuation.target.objectKey);
  assert.equal(gate.target.objectSha256, continuation.target.objectSha256);
  assert.equal(gate.target.artifactId, continuation.target.artifactId);
  assert.equal(gate.approvalGate.source, 'upload-approval-continuation');
  assert.equal(gate.approvalGate.continuationStatus, 'continuation-ready');
  assert.equal(gate.approvalGate.approvalRequired, true);
  assert.equal(gate.approvalGate.approvalProvided, true);
  assert.equal(gate.approvalGate.fingerprintVerified, true);
  assert.equal(gate.approvalGate.mutationApprovalRequired, true);
  assert.equal(gate.approvalGate.mutationApprovalGranted, false);
  assert.equal(gate.approvalGate.uploadApproved, false);
  assert.equal(gate.approvalGate.uploadExecutionAllowed, false);
  assert.equal(gate.approvalGate.scopeMatched, true);
  assert.equal(gate.mockHarness.source, 'upload-mock-harness');
  assert.equal(gate.mockHarness.status, 'harness-ready');
  assert.equal(gate.mockHarness.harnessKind, 'in-memory-mock');
  assert.equal(gate.mockHarness.mockAdapterInstantiated, true);
  assert.equal(gate.mockHarness.adapterName, 'mock-team-cache');
  assert.equal(gate.mockHarness.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(gate.mockHarness.descriptorMatched, true);
  assert.equal(gate.mockHarness.objectWriteAttempted, false);
  assert.equal(gate.mockHarness.indexWriteAttempted, false);
  assert.equal(gate.mockHarness.remoteMutationPerformed, false);
  assert.equal(gate.executionBoundary.dryRunOnly, true);
  assert.equal(gate.executionBoundary.artifactBytesProvided, false);
  assert.equal(gate.executionBoundary.adapterInjectionReviewed, true);
  assert.equal(gate.executionBoundary.adapterInjected, false);
  assert.equal(gate.executionBoundary.clientCreated, false);
  assert.equal(gate.executionBoundary.credentialValuesRead, false);
  assert.equal(gate.executionBoundary.credentialPresenceChecked, false);
  assert.equal(gate.executionBoundary.liveCheckPerformed, false);
  assert.equal(gate.executionBoundary.writeTokenIssued, false);
  assert.equal(gate.executionBoundary.executionLeaseCreated, false);
  assert.equal(gate.executionBoundary.rollbackPlanRequired, true);
  assert.equal(gate.executionBoundary.auditRecordRequired, true);
  assert.equal(gate.executionBoundary.uploadCommandGenerated, false);
  assert.equal(gate.executionBoundary.objectWriteAttempted, false);
  assert.equal(gate.executionBoundary.metadataIndexWriteAttempted, false);
  assert.equal(gate.executionBoundary.remoteMutationPerformed, false);
  assert.equal(gate.readiness.nextAction, 'request-separate-mutation-approval');
  assert.equal(gate.readiness.blockerCount, 0);
  assert.deepEqual(gate.readiness.blockerCodes, []);
});
