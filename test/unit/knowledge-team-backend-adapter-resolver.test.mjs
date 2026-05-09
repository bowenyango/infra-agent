import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMockKnowledgeTeamBackendAdapterConfig,
  KnowledgeTeamBackendAdapterResolutionError,
  resolveKnowledgeTeamBackendAdapter
} from '../../src/knowledge/team-backend-adapter-resolver.ts';

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
