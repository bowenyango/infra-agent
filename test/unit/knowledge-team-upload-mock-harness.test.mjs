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

async function validPreflight() {
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
  return buildKnowledgeTeamUploadAdapterPreflight({
    continuation,
    adapterResolutionPlan
  });
}

test('upload mock harness accepts preflight-ready artifacts without executing writes', async () => {
  const preflight = await validPreflight();
  const harness = buildKnowledgeTeamUploadMockHarness({ preflight });

  assert.equal(harness.kind, 'infra-agent.knowledge-team-upload-mock-harness');
  assert.equal(harness.schemaVersion, 1);
  assert.equal(harness.mutationAllowed, false);
  assert.equal(harness.executionMode, 'dry-run');
  assert.equal(harness.harnessKind, 'in-memory-mock');
  assert.equal(harness.status, 'harness-ready');
  assert.equal(harness.plannedOperation, 'stage-knowledge-pack');
  assert.equal(harness.remoteWriteAllowed, false);
  assert.equal(harness.liveCheckAllowed, false);
  assert.equal(harness.credentialValuesExposed, false);
  assert.equal(harness.credentialPresenceChecked, false);
  assert.equal(harness.uploadApproved, false);
  assert.equal(harness.uploadExecutionAllowed, false);
  assert.equal(harness.clientCreated, false);
  assert.equal(harness.adapterInjected, false);
  assert.equal(harness.mockAdapterInstantiated, true);
  assert.equal(harness.objectWriteAttempted, false);
  assert.equal(harness.metadataIndexWriteAttempted, false);
  assert.equal(harness.remoteMutationPerformed, false);
  assert.equal(harness.uploadCommand, null);
  assert.equal(harness.preflight.status, 'preflight-ready');
  assert.equal(harness.preflight.adapterName, 'mock-team-cache');
  assert.equal(harness.preflight.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(harness.preflight.injectionCandidate, true);
  assert.equal(harness.preflight.objectKey, preflight.continuation.objectKey);
  assert.equal(harness.preflight.objectSha256, preflight.continuation.objectSha256);
  assert.equal(harness.mockHarness.adapterFactory, 'createMockKnowledgeTeamBackendAdapter');
  assert.equal(harness.mockHarness.backendKind, 'mock-s3-compatible');
  assert.equal(harness.mockHarness.descriptorMatched, true);
  assert.equal(harness.mockHarness.artifactObjectStoreAvailable, true);
  assert.equal(harness.mockHarness.metadataIndexAvailable, true);
  assert.equal(harness.mockHarness.objectWriteAttempted, false);
  assert.equal(harness.mockHarness.indexWriteAttempted, false);
  assert.equal(harness.mockHarness.remoteMutationPerformed, false);
  assert.equal(harness.readiness.nextAction, 'run-mock-only-contract-tests');
  assert.equal(harness.readiness.blockerCount, 0);
  assert.deepEqual(harness.readiness.blockerCodes, []);
});

test('upload mock harness blocks preflight artifacts that are not ready', async () => {
  const preflight = {
    ...(await validPreflight()),
    status: 'blocked',
    adapterDependency: {
      ...(await validPreflight()).adapterDependency,
      injectionCandidate: false,
      resolutionStatus: 'blocked'
    }
  };
  const harness = buildKnowledgeTeamUploadMockHarness({ preflight });

  assert.equal(harness.status, 'blocked');
  assert.equal(harness.uploadExecutionAllowed, false);
  assert.equal(harness.clientCreated, false);
  assert.equal(harness.adapterInjected, false);
  assert.equal(harness.mockAdapterInstantiated, false);
  assert.equal(harness.objectWriteAttempted, false);
  assert.equal(harness.metadataIndexWriteAttempted, false);
  assert.equal(harness.remoteMutationPerformed, false);
  assert.equal(harness.uploadCommand, null);
  assert.equal(harness.mockHarness.objectWriteAttempted, false);
  assert.equal(harness.mockHarness.indexWriteAttempted, false);
  assert.equal(harness.readiness.nextAction, 'resolve-blockers');
  assert.equal(harness.readiness.blockerCodes.includes('preflight-not-ready'), true);
  assert.equal(harness.readiness.blockerCodes.includes('adapter-resolution-not-ready'), true);
});

test('upload mock harness rejects forged preflight execution flags', async () => {
  const preflight = {
    ...(await validPreflight()),
    mutationAllowed: true,
    remoteWriteAllowed: true,
    liveCheckAllowed: true,
    credentialValuesExposed: true,
    credentialPresenceChecked: true,
    uploadApproved: true,
    uploadExecutionAllowed: true,
    clientCreated: true,
    adapterInjected: true,
    uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key'
  };
  const harness = buildKnowledgeTeamUploadMockHarness({ preflight });

  assert.equal(harness.status, 'blocked');
  assert.equal(harness.remoteWriteAllowed, false);
  assert.equal(harness.liveCheckAllowed, false);
  assert.equal(harness.credentialValuesExposed, false);
  assert.equal(harness.credentialPresenceChecked, false);
  assert.equal(harness.uploadApproved, false);
  assert.equal(harness.uploadExecutionAllowed, false);
  assert.equal(harness.clientCreated, false);
  assert.equal(harness.adapterInjected, false);
  assert.equal(harness.objectWriteAttempted, false);
  assert.equal(harness.metadataIndexWriteAttempted, false);
  assert.equal(harness.remoteMutationPerformed, false);
  assert.equal(harness.uploadCommand, null);
  assert.equal(harness.readiness.blockerCodes.includes('mutation-enabled'), true);
  assert.equal(harness.readiness.blockerCodes.includes('remote-write-enabled'), true);
  assert.equal(harness.readiness.blockerCodes.includes('live-check-enabled'), true);
  assert.equal(harness.readiness.blockerCodes.includes('credential-values-exposed'), true);
  assert.equal(harness.readiness.blockerCodes.includes('credential-presence-check-enabled'), true);
  assert.equal(harness.readiness.blockerCodes.includes('upload-approval-already-provided'), true);
  assert.equal(harness.readiness.blockerCodes.includes('upload-execution-enabled'), true);
  assert.equal(harness.readiness.blockerCodes.includes('client-created'), true);
  assert.equal(harness.readiness.blockerCodes.includes('adapter-injected'), true);
  assert.equal(harness.readiness.blockerCodes.includes('upload-command-present'), true);
});
