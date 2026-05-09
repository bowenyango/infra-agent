import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeTeamBackendAdapterCapabilities,
  buildKnowledgeTeamBackendAdapterDescriptor,
  isSafeKnowledgeTeamBackendAdapterName
} from '../../src/knowledge/team-backend-adapter.ts';

test('team backend adapter capabilities are mutation-disabled by contract', () => {
  const capabilities = buildKnowledgeTeamBackendAdapterCapabilities('mock-s3-compatible');

  assert.equal(capabilities.kind, 'infra-agent.knowledge-team-backend-adapter-capabilities');
  assert.equal(capabilities.schemaVersion, 1);
  assert.equal(capabilities.mutationAllowed, false);
  assert.equal(capabilities.backendKind, 'mock-s3-compatible');
  assert.equal(capabilities.artifactObjectStore, true);
  assert.equal(capabilities.metadataIndex, true);
  assert.equal(capabilities.contentAddressedObjectKeys, true);
  assert.equal(capabilities.contentAddressedIndexKeys, true);
  assert.equal(capabilities.idempotentWritesRequired, true);
  assert.equal(capabilities.explicitUploadApprovalRequired, true);
  assert.equal(capabilities.remoteWriteAllowed, false);
  assert.equal(capabilities.liveCheckAllowed, false);
  assert.equal(capabilities.credentialValuesExposed, false);
  assert.equal(capabilities.uploadCommand, null);
  assert.deepEqual(capabilities.supportedContentTypes, ['application/json']);
});

test('team backend adapter descriptors require safe local names', () => {
  assert.equal(isSafeKnowledgeTeamBackendAdapterName('mock-team-cache'), true);
  for (const unsafeName of [
    '',
    '../cache',
    'TeamCache',
    'mock team cache',
    'mock/team/cache',
    'a'.repeat(65)
  ]) {
    assert.equal(isSafeKnowledgeTeamBackendAdapterName(unsafeName), false, unsafeName);
  }

  const descriptor = buildKnowledgeTeamBackendAdapterDescriptor({
    name: 'mock-team-cache',
    backendKind: 'mock-s3-compatible'
  });
  assert.equal(descriptor.kind, 'infra-agent.knowledge-team-backend-adapter');
  assert.equal(descriptor.schemaVersion, 1);
  assert.equal(descriptor.mutationAllowed, false);
  assert.equal(descriptor.name, 'mock-team-cache');
  assert.equal(descriptor.backendKind, 'mock-s3-compatible');
  assert.equal(descriptor.capabilities.backendKind, descriptor.backendKind);

  assert.throws(
    () => buildKnowledgeTeamBackendAdapterDescriptor({
      name: '../cache',
      backendKind: 'mock-s3-compatible'
    }),
    /safe lowercase identifier/
  );
});
