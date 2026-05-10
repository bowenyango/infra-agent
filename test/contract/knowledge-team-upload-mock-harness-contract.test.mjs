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

function assertHarnessShape(harness) {
  assert.deepEqual(Object.keys(harness), [
    'kind',
    'schemaVersion',
    'mutationAllowed',
    'executionMode',
    'harnessKind',
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
    'mockAdapterInstantiated',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed',
    'uploadCommand',
    'preflight',
    'mockHarness',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(harness.preflight), [
    'status',
    'adapterName',
    'adapterBackendKind',
    'injectionCandidate',
    'manifestId',
    'objectKey',
    'objectSha256',
    'artifactId'
  ]);
  assert.deepEqual(Object.keys(harness.mockHarness), [
    'adapterFactory',
    'adapterName',
    'backendKind',
    'descriptorMatched',
    'artifactObjectStoreAvailable',
    'metadataIndexAvailable',
    'objectWriteAttempted',
    'indexWriteAttempted',
    'remoteMutationPerformed'
  ]);
  assert.deepEqual(Object.keys(harness.readiness), [
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

test('upload mock harness contract accepts compact harness-ready summaries', async () => {
  const harness = buildKnowledgeTeamUploadMockHarness({
    preflight: await validPreflight()
  });

  assertHarnessShape(harness);
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
  assert.equal(harness.preflight.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(harness.mockHarness.adapterFactory, 'createMockKnowledgeTeamBackendAdapter');
  assert.equal(harness.mockHarness.backendKind, 'mock-s3-compatible');
  assert.equal(harness.mockHarness.objectWriteAttempted, false);
  assert.equal(harness.mockHarness.indexWriteAttempted, false);
  assert.equal(harness.mockHarness.remoteMutationPerformed, false);
  assert.equal(harness.readiness.nextAction, 'run-mock-only-contract-tests');
  assert.deepEqual(harness.readiness.blockerCodes, []);

  const validation = validateKnowledgePayload(harness, 'inline');
  assert.equal(validation.valid, true);
});

test('upload mock harness contract keeps blocked summaries safe', async () => {
  const harness = buildKnowledgeTeamUploadMockHarness({
    preflight: {
      ...(await validPreflight()),
      endpointUrl: 'https://private.example.test',
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
      adapterDependency: {
        ...(await validPreflight()).adapterDependency,
        backendKind: 's3-compatible',
        remoteWriteAllowed: true,
        liveCheckAllowed: true,
        uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key'
      }
    }
  });

  assertHarnessShape(harness);
  assert.equal(harness.status, 'blocked');
  assert.equal(harness.remoteWriteAllowed, false);
  assert.equal(harness.uploadApproved, false);
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
  assert.equal(harness.mockHarness.remoteMutationPerformed, false);
  assert.equal(harness.readiness.nextAction, 'resolve-blockers');
  assert.equal(harness.readiness.blockerCodes.includes('backend-detail-leak'), true);
  assert.equal(harness.readiness.blockerCodes.includes('real-backend-not-implemented'), true);
  assert.equal(harness.readiness.blockerCodes.includes('adapter-remote-write-enabled'), true);
  assert.equal(harness.readiness.blockerCodes.includes('adapter-live-check-enabled'), true);
  assert.equal(harness.readiness.blockerCodes.includes('adapter-upload-command-present'), true);
  assertNoPrivateValues(harness);

  const validation = validateKnowledgePayload(harness, 'inline');
  assert.equal(validation.valid, true);
});
