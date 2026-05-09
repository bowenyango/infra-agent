import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMockKnowledgeTeamBackendAdapterConfig,
  KnowledgeTeamBackendAdapterResolutionError,
  planKnowledgeTeamBackendAdapterResolution,
  resolveKnowledgeTeamBackendAdapter
} from '../../src/knowledge/team-backend-adapter-resolver.ts';
import {
  buildKnowledgeTeamS3CompatibleBackendConfig
} from '../../src/knowledge/team-s3-compatible-backend-config.ts';
import {
  buildKnowledgeTeamS3CompatibleReferenceRegistry
} from '../../src/knowledge/team-s3-compatible-reference-registry.ts';

function captureResolutionError(config) {
  try {
    resolveKnowledgeTeamBackendAdapter(config);
  } catch (error) {
    return error;
  }

  throw new Error('Expected adapter resolution to fail.');
}

test('mock backend adapter resolver accepts safe mock-only configs', () => {
  const config = buildMockKnowledgeTeamBackendAdapterConfig('mock-team-cache');
  const adapter = resolveKnowledgeTeamBackendAdapter(config);

  assert.equal(adapter.descriptor.name, 'mock-team-cache');
  assert.equal(adapter.descriptor.backendKind, 'mock-s3-compatible');
  assert.equal(adapter.descriptor.capabilities.remoteWriteAllowed, false);
  assert.equal(adapter.descriptor.capabilities.liveCheckAllowed, false);
  assert.equal(adapter.descriptor.capabilities.credentialValuesExposed, false);
  assert.equal(adapter.descriptor.capabilities.uploadCommand, null);
  assert.equal(adapter.artifactStore.backendKind, 'mock-s3-compatible');
  assert.equal(adapter.metadataIndex.backendKind, 'mock-s3-compatible');
});

test('mock backend adapter resolver rejects unsupported and leaky configs without echoing details', () => {
  const error = captureResolutionError({
    kind: 'infra-agent.knowledge-team-backend-adapter-config',
    schemaVersion: 1,
    mutationAllowed: false,
    backendKind: 's3-compatible',
    name: '../private-team-cache',
    credentialMode: 'environment',
    remoteWriteAllowed: true,
    liveCheckAllowed: true,
    bucket: 'private-team-cache',
    endpointUrl: 'https://s3.example.test/private',
    accessToken: 'secret-token'
  });

  assert.ok(error instanceof KnowledgeTeamBackendAdapterResolutionError);
  const codes = new Set(error.issues.map(issue => issue.code));
  for (const expectedCode of [
    'backend-detail-leak',
    'credential-mode-enabled',
    'live-check-enabled',
    'remote-write-enabled',
    'unsafe-adapter-name',
    'unsupported-backend-kind'
  ]) {
    assert.equal(codes.has(expectedCode), true, expectedCode);
  }

  const issueText = JSON.stringify(error.issues);
  for (const forbidden of [
    'private-team-cache',
    'https://s3.example.test/private',
    'secret-token',
    'endpointUrl',
    'accessToken'
  ]) {
    assert.equal(issueText.includes(forbidden), false, forbidden);
  }
});

test('backend adapter resolution plan marks mock configs as locally resolvable', () => {
  const plan = planKnowledgeTeamBackendAdapterResolution(
    buildMockKnowledgeTeamBackendAdapterConfig('mock-team-cache')
  );

  assert.equal(plan.kind, 'infra-agent.knowledge-team-backend-adapter-resolution-plan');
  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.mutationAllowed, false);
  assert.equal(plan.status, 'resolvable');
  assert.equal(plan.backendKind, 'mock-s3-compatible');
  assert.equal(plan.adapterName, 'mock-team-cache');
  assert.deepEqual(plan.issueCodes, []);
  assert.deepEqual(plan.issues, []);
  assert.equal(plan.capabilities.remoteWriteAllowed, false);
  assert.equal(plan.capabilities.liveCheckAllowed, false);
  assert.equal(plan.capabilities.credentialValuesExposed, false);
  assert.equal(plan.capabilities.uploadCommand, null);
  assert.equal(plan.capabilities.dryRunOnly, true);
});

test('backend adapter resolution plan keeps real s3-compatible configs blocked and side-effect free', () => {
  const plan = planKnowledgeTeamBackendAdapterResolution(
    buildKnowledgeTeamS3CompatibleBackendConfig({
      name: 'team-cache-prod'
    })
  );

  assert.equal(plan.status, 'blocked');
  assert.equal(plan.backendKind, 's3-compatible');
  assert.equal(plan.adapterName, 'team-cache-prod');
  assert.deepEqual(plan.issueCodes, ['real-backend-not-implemented']);
  assert.equal(plan.issues[0].path, '$.backendKind');
  assert.equal(plan.capabilities.artifactObjectStore, true);
  assert.equal(plan.capabilities.metadataIndex, true);
  assert.equal(plan.capabilities.remoteWriteAllowed, false);
  assert.equal(plan.capabilities.liveCheckAllowed, false);
  assert.equal(plan.capabilities.credentialValuesExposed, false);
  assert.equal(plan.capabilities.uploadCommand, null);

  assert.throws(
    () => resolveKnowledgeTeamBackendAdapter(buildKnowledgeTeamS3CompatibleBackendConfig()),
    KnowledgeTeamBackendAdapterResolutionError
  );
});

test('backend adapter resolution plan accepts valid s3 registry refs but stays blocked', () => {
  const plan = planKnowledgeTeamBackendAdapterResolution(
    buildKnowledgeTeamS3CompatibleBackendConfig({
      name: 'team-cache-prod',
      storageProfileRef: 'team-cache-storage',
      authProfileRef: 'team-cache-auth'
    }),
    {
      referenceRegistry: buildKnowledgeTeamS3CompatibleReferenceRegistry()
    }
  );

  assert.equal(plan.status, 'blocked');
  assert.equal(plan.backendKind, 's3-compatible');
  assert.equal(plan.adapterName, 'team-cache-prod');
  assert.deepEqual(plan.issueCodes, ['real-backend-not-implemented']);
  assert.equal(plan.capabilities.artifactObjectStore, true);
  assert.equal(plan.capabilities.metadataIndex, true);
  assert.equal(plan.capabilities.remoteWriteAllowed, false);
  assert.equal(plan.capabilities.liveCheckAllowed, false);
  assert.equal(plan.capabilities.credentialValuesExposed, false);
  assert.equal(plan.capabilities.uploadCommand, null);
  assert.equal(plan.capabilities.dryRunOnly, true);
});

test('backend adapter resolution plan blocks missing s3 registry refs before real design', () => {
  const plan = planKnowledgeTeamBackendAdapterResolution(
    buildKnowledgeTeamS3CompatibleBackendConfig({
      name: 'team-cache-prod',
      storageProfileRef: 'missing-storage-profile',
      authProfileRef: 'missing-auth-profile'
    }),
    {
      referenceRegistry: buildKnowledgeTeamS3CompatibleReferenceRegistry()
    }
  );

  assert.equal(plan.status, 'blocked');
  assert.equal(plan.backendKind, 's3-compatible');
  assert.equal(plan.adapterName, 'team-cache-prod');
  assert.equal(plan.issueCodes.includes('missing-storage-profile-reference'), true);
  assert.equal(plan.issueCodes.includes('missing-auth-profile-reference'), true);
  assert.equal(plan.issueCodes.includes('real-backend-not-implemented'), false);
  assert.equal(plan.capabilities.artifactObjectStore, false);
  assert.equal(plan.capabilities.metadataIndex, false);
  assert.equal(plan.capabilities.remoteWriteAllowed, false);
  assert.equal(plan.capabilities.liveCheckAllowed, false);
  assert.equal(plan.capabilities.credentialValuesExposed, false);
  assert.equal(plan.capabilities.uploadCommand, null);
});

test('backend adapter resolution plan rejects leaky real configs without echoing private fields', () => {
  const plan = planKnowledgeTeamBackendAdapterResolution({
    kind: 'infra-agent.knowledge-team-s3-compatible-backend-config',
    schemaVersion: 1,
    mutationAllowed: false,
    backendKind: 's3-compatible',
    name: 'team-cache',
    storageProfileRef: 'team-cache-storage',
    authProfileRef: 'team-cache-auth',
    artifactPrefix: 'knowledge-artifacts/v1',
    indexPrefix: 'knowledge-index/v1',
    credentialMode: 'environment',
    remoteWriteDefault: false,
    liveCheckDefault: false,
    bucket: 'private-team-cache',
    endpointUrl: 'https://s3.example.test/private',
    accessToken: 'secret-token',
    workspaceRoot: '/workspace/private-project'
  });

  assert.equal(plan.status, 'blocked');
  assert.equal(plan.backendKind, 's3-compatible');
  assert.equal(plan.adapterName, null);
  assert.ok(plan.issueCodes.includes('backend-detail-leak'));
  assert.equal(plan.capabilities.artifactObjectStore, false);
  assert.equal(plan.capabilities.metadataIndex, false);

  const planText = JSON.stringify(plan);
  for (const forbidden of [
    'private-team-cache',
    'https://s3.example.test/private',
    'secret-token',
    '/workspace/private-project',
    'endpointUrl',
    'accessToken'
  ]) {
    assert.equal(planText.includes(forbidden), false, forbidden);
  }
});
