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

function assertPreflightShape(preflight) {
  assert.deepEqual(Object.keys(preflight), [
    'kind',
    'schemaVersion',
    'mutationAllowed',
    'executionMode',
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
    'uploadCommand',
    'continuation',
    'adapterDependency',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(preflight.continuation), [
    'status',
    'fingerprintVerified',
    'backendKind',
    'manifestId',
    'objectKey',
    'objectSha256',
    'artifactId'
  ]);
  assert.deepEqual(Object.keys(preflight.adapterDependency), [
    'source',
    'dependencyInjectionOnly',
    'injectionCandidate',
    'backendKind',
    'adapterName',
    'resolutionStatus',
    'realBackendImplemented',
    'artifactObjectStore',
    'metadataIndex',
    'contentAddressedObjectKeys',
    'contentAddressedIndexKeys',
    'idempotentWritesRequired',
    'explicitUploadApprovalRequired',
    'remoteWriteAllowed',
    'liveCheckAllowed',
    'credentialValuesExposed',
    'uploadCommand'
  ]);
  assert.deepEqual(Object.keys(preflight.readiness), [
    'status',
    'nextAction',
    'blockerCount',
    'blockerCodes',
    'blockers',
    'reason'
  ]);
}

test('upload adapter preflight contract accepts compact ready summaries', async () => {
  const preflight = buildKnowledgeTeamUploadAdapterPreflight({
    continuation: await validContinuation(),
    adapterResolutionPlan: validMockAdapterPlan()
  });

  assertPreflightShape(preflight);
  assert.equal(preflight.kind, 'infra-agent.knowledge-team-upload-adapter-preflight');
  assert.equal(preflight.schemaVersion, 1);
  assert.equal(preflight.mutationAllowed, false);
  assert.equal(preflight.executionMode, 'dry-run');
  assert.equal(preflight.status, 'preflight-ready');
  assert.equal(preflight.remoteWriteAllowed, false);
  assert.equal(preflight.liveCheckAllowed, false);
  assert.equal(preflight.credentialValuesExposed, false);
  assert.equal(preflight.credentialPresenceChecked, false);
  assert.equal(preflight.uploadApproved, false);
  assert.equal(preflight.uploadExecutionAllowed, false);
  assert.equal(preflight.clientCreated, false);
  assert.equal(preflight.adapterInjected, false);
  assert.equal(preflight.uploadCommand, null);
  assert.equal(preflight.adapterDependency.injectionCandidate, true);
  assert.equal(preflight.adapterDependency.realBackendImplemented, false);
  assert.equal(preflight.readiness.nextAction, 'inject-mock-adapter-in-test-harness');
  assert.deepEqual(preflight.readiness.blockerCodes, []);
});

test('upload adapter preflight contract keeps blocked summaries safe', async () => {
  const preflight = buildKnowledgeTeamUploadAdapterPreflight({
    continuation: {
      ...(await validContinuation()),
      endpointUrl: 'https://private.example.test',
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key'
    },
    adapterResolutionPlan: {
      ...validMockAdapterPlan(),
      bucketName: 'private-bucket',
      capabilities: {
        ...validMockAdapterPlan().capabilities,
        remoteWriteAllowed: true,
        uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key'
      }
    }
  });

  assertPreflightShape(preflight);
  assert.equal(preflight.status, 'blocked');
  assert.equal(preflight.remoteWriteAllowed, false);
  assert.equal(preflight.uploadExecutionAllowed, false);
  assert.equal(preflight.clientCreated, false);
  assert.equal(preflight.adapterInjected, false);
  assert.equal(preflight.uploadCommand, null);
  assert.equal(preflight.adapterDependency.injectionCandidate, false);
  assert.equal(preflight.adapterDependency.remoteWriteAllowed, false);
  assert.equal(preflight.adapterDependency.uploadCommand, null);
  assert.equal(preflight.readiness.nextAction, 'resolve-blockers');
  assert.equal(preflight.readiness.blockerCodes.includes('backend-detail-leak'), true);
  assert.equal(preflight.readiness.blockerCodes.includes('upload-command-present'), true);
  assert.equal(preflight.readiness.blockerCodes.includes('adapter-remote-write-enabled'), true);
  assert.equal(preflight.readiness.blockerCodes.includes('adapter-upload-command-present'), true);

  const text = JSON.stringify(preflight);
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
});
