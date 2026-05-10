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
  buildKnowledgeTeamArtifactContractFixture
} from '../support/knowledge-team-artifact-fixtures.mjs';

function validBackendReferenceSummary() {
  return validateKnowledgeTeamS3CompatibleBackendReferences(
    buildKnowledgeTeamS3CompatibleBackendConfig(),
    buildKnowledgeTeamS3CompatibleReferenceRegistry()
  );
}

async function validContinuation() {
  const fixture = await buildKnowledgeTeamArtifactContractFixture();
  const intent = buildKnowledgeTeamUploadApprovalIntent({
    publicationReadiness: fixture.uploadRequiredReadiness,
    backendReferenceValidation: validBackendReferenceSummary()
  });
  return buildKnowledgeTeamUploadApprovalContinuation({
    approvalIntent: intent,
    approvalFingerprint: intent.approvalFingerprint.value
  });
}

function validMockAdapterPlan() {
  return planKnowledgeTeamBackendAdapterResolution(
    buildMockKnowledgeTeamBackendAdapterConfig('mock-team-cache')
  );
}

function realS3AdapterPlan() {
  return planKnowledgeTeamBackendAdapterResolution(
    buildKnowledgeTeamS3CompatibleBackendConfig(),
    {
      referenceRegistry: buildKnowledgeTeamS3CompatibleReferenceRegistry()
    }
  );
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

test('upload adapter preflight accepts continuation-ready with a mock adapter plan', async () => {
  const continuation = await validContinuation();
  const adapterResolutionPlan = validMockAdapterPlan();
  const preflight = buildKnowledgeTeamUploadAdapterPreflight({
    continuation,
    adapterResolutionPlan
  });

  assert.equal(preflight.kind, 'infra-agent.knowledge-team-upload-adapter-preflight');
  assert.equal(preflight.schemaVersion, 1);
  assert.equal(preflight.mutationAllowed, false);
  assert.equal(preflight.executionMode, 'dry-run');
  assert.equal(preflight.status, 'preflight-ready');
  assert.equal(preflight.plannedOperation, 'stage-knowledge-pack');
  assert.equal(preflight.remoteWriteAllowed, false);
  assert.equal(preflight.liveCheckAllowed, false);
  assert.equal(preflight.credentialValuesExposed, false);
  assert.equal(preflight.credentialPresenceChecked, false);
  assert.equal(preflight.uploadApproved, false);
  assert.equal(preflight.uploadExecutionAllowed, false);
  assert.equal(preflight.clientCreated, false);
  assert.equal(preflight.adapterInjected, false);
  assert.equal(preflight.uploadCommand, null);
  assert.equal(preflight.continuation.status, 'continuation-ready');
  assert.equal(preflight.continuation.fingerprintVerified, true);
  assert.equal(preflight.continuation.manifestId, continuation.target.manifestId);
  assert.equal(preflight.continuation.objectKey, continuation.target.objectKey);
  assert.equal(preflight.continuation.objectSha256, continuation.target.objectSha256);
  assert.equal(preflight.continuation.artifactId, continuation.target.artifactId);
  assert.equal(preflight.adapterDependency.source, 'resolution-plan');
  assert.equal(preflight.adapterDependency.dependencyInjectionOnly, true);
  assert.equal(preflight.adapterDependency.injectionCandidate, true);
  assert.equal(preflight.adapterDependency.backendKind, 'mock-s3-compatible');
  assert.equal(preflight.adapterDependency.adapterName, 'mock-team-cache');
  assert.equal(preflight.adapterDependency.resolutionStatus, 'resolvable');
  assert.equal(preflight.adapterDependency.realBackendImplemented, false);
  assert.equal(preflight.adapterDependency.artifactObjectStore, true);
  assert.equal(preflight.adapterDependency.metadataIndex, true);
  assert.equal(preflight.adapterDependency.remoteWriteAllowed, false);
  assert.equal(preflight.adapterDependency.liveCheckAllowed, false);
  assert.equal(preflight.adapterDependency.credentialValuesExposed, false);
  assert.equal(preflight.adapterDependency.uploadCommand, null);
  assert.equal(preflight.readiness.nextAction, 'inject-mock-adapter-in-test-harness');
  assert.equal(preflight.readiness.blockerCount, 0);
  assert.deepEqual(preflight.readiness.blockerCodes, []);
});

test('upload adapter preflight blocks continuation artifacts that are not ready', async () => {
  const continuation = {
    ...(await validContinuation()),
    status: 'blocked',
    approval: {
      required: true,
      provided: true,
      source: 'cli-flag',
      intentStatus: 'blocked',
      suppliedFingerprint: 'b'.repeat(64),
      expectedFingerprint: 'a'.repeat(64),
      fingerprintVerified: false
    }
  };
  const preflight = buildKnowledgeTeamUploadAdapterPreflight({
    continuation,
    adapterResolutionPlan: validMockAdapterPlan()
  });

  assert.equal(preflight.status, 'blocked');
  assert.equal(preflight.uploadExecutionAllowed, false);
  assert.equal(preflight.clientCreated, false);
  assert.equal(preflight.adapterInjected, false);
  assert.equal(preflight.uploadCommand, null);
  assert.equal(preflight.adapterDependency.injectionCandidate, false);
  assert.equal(preflight.readiness.nextAction, 'resolve-blockers');
  assert.equal(preflight.readiness.blockerCodes.includes('continuation-not-ready'), true);
  assert.equal(preflight.readiness.blockerCodes.includes('approval-fingerprint-unverified'), true);
});

test('upload adapter preflight rejects forged continuation mutation flags', async () => {
  const continuation = {
    ...(await validContinuation()),
    mutationAllowed: true,
    remoteWriteAllowed: true,
    liveCheckAllowed: true,
    credentialValuesExposed: true,
    credentialPresenceChecked: true,
    uploadApproved: true,
    uploadExecutionAllowed: true,
    clientCreated: true,
    uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key'
  };
  const preflight = buildKnowledgeTeamUploadAdapterPreflight({
    continuation,
    adapterResolutionPlan: validMockAdapterPlan()
  });

  assert.equal(preflight.status, 'blocked');
  assert.equal(preflight.remoteWriteAllowed, false);
  assert.equal(preflight.liveCheckAllowed, false);
  assert.equal(preflight.credentialValuesExposed, false);
  assert.equal(preflight.credentialPresenceChecked, false);
  assert.equal(preflight.uploadApproved, false);
  assert.equal(preflight.uploadExecutionAllowed, false);
  assert.equal(preflight.clientCreated, false);
  assert.equal(preflight.adapterInjected, false);
  assert.equal(preflight.uploadCommand, null);
  assert.equal(preflight.readiness.blockerCodes.includes('mutation-enabled'), true);
  assert.equal(preflight.readiness.blockerCodes.includes('remote-write-enabled'), true);
  assert.equal(preflight.readiness.blockerCodes.includes('live-check-enabled'), true);
  assert.equal(preflight.readiness.blockerCodes.includes('credential-values-exposed'), true);
  assert.equal(preflight.readiness.blockerCodes.includes('credential-presence-check-enabled'), true);
  assert.equal(preflight.readiness.blockerCodes.includes('upload-approval-already-provided'), true);
  assert.equal(preflight.readiness.blockerCodes.includes('upload-execution-enabled'), true);
  assert.equal(preflight.readiness.blockerCodes.includes('client-created'), true);
  assert.equal(preflight.readiness.blockerCodes.includes('upload-command-present'), true);
});

test('upload adapter preflight blocks real backend adapter plans', async () => {
  const preflight = buildKnowledgeTeamUploadAdapterPreflight({
    continuation: await validContinuation(),
    adapterResolutionPlan: realS3AdapterPlan()
  });

  assert.equal(preflight.status, 'blocked');
  assert.equal(preflight.adapterDependency.backendKind, 's3-compatible');
  assert.equal(preflight.adapterDependency.resolutionStatus, 'blocked');
  assert.equal(preflight.adapterDependency.injectionCandidate, false);
  assert.equal(preflight.adapterDependency.realBackendImplemented, false);
  assert.equal(preflight.remoteWriteAllowed, false);
  assert.equal(preflight.uploadExecutionAllowed, false);
  assert.equal(preflight.clientCreated, false);
  assert.equal(preflight.uploadCommand, null);
  assert.equal(preflight.readiness.blockerCodes.includes('adapter-plan-blocked'), true);
  assert.equal(preflight.readiness.blockerCodes.includes('real-backend-not-implemented'), true);
  assert.equal(preflight.readiness.blockerCodes.includes('unsupported-adapter-backend'), true);
});

test('upload adapter preflight blocks unsafe adapter capability drift', async () => {
  const adapterResolutionPlan = {
    ...validMockAdapterPlan(),
    endpointUrl: 'https://should-not-copy.example.test',
    bucketName: 'should-not-copy-bucket',
    capabilities: {
      ...validMockAdapterPlan().capabilities,
      remoteWriteAllowed: true,
      liveCheckAllowed: true,
      credentialValuesExposed: true,
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key'
    }
  };
  const preflight = buildKnowledgeTeamUploadAdapterPreflight({
    continuation: await validContinuation(),
    adapterResolutionPlan
  });

  assert.equal(preflight.status, 'blocked');
  assert.equal(preflight.adapterDependency.injectionCandidate, false);
  assert.equal(preflight.adapterDependency.remoteWriteAllowed, false);
  assert.equal(preflight.adapterDependency.liveCheckAllowed, false);
  assert.equal(preflight.adapterDependency.credentialValuesExposed, false);
  assert.equal(preflight.adapterDependency.uploadCommand, null);
  assert.equal(preflight.readiness.blockerCodes.includes('adapter-remote-write-enabled'), true);
  assert.equal(preflight.readiness.blockerCodes.includes('adapter-live-check-enabled'), true);
  assert.equal(preflight.readiness.blockerCodes.includes('adapter-credential-values-exposed'), true);
  assert.equal(preflight.readiness.blockerCodes.includes('adapter-upload-command-present'), true);
  assert.equal(preflight.readiness.blockerCodes.includes('backend-detail-leak'), true);
  assertNoPrivateValues(preflight);
});
