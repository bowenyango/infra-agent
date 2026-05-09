import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockKnowledgeTeamBackendAdapter } from '../../src/knowledge/team-backend-adapter-mock.ts';
import {
  retrieveKnowledgePackArtifactFromTeamStore,
  stageKnowledgePackArtifactForTeamStore
} from '../../src/knowledge/team-artifact-store.ts';
import {
  assertNoTeamArtifactContractLeaks,
  buildKnowledgeTeamArtifactBytesAndManifest
} from '../support/knowledge-team-artifact-fixtures.mjs';

test('mock team backend adapter stages and retrieves content-addressed pack artifacts', async () => {
  const adapter = createMockKnowledgeTeamBackendAdapter({
    name: 'mock-team-cache'
  });
  const { artifactBytes, manifest, pack } = buildKnowledgeTeamArtifactBytesAndManifest();

  const staged = await stageKnowledgePackArtifactForTeamStore({
    manifest,
    artifactBytes,
    store: adapter.artifactStore
  });

  assert.equal(adapter.descriptor.backendKind, 'mock-s3-compatible');
  assert.equal(adapter.descriptor.mutationAllowed, false);
  assert.equal(adapter.descriptor.capabilities.remoteWriteAllowed, false);
  assert.equal(staged.descriptor.backendKind, adapter.descriptor.backendKind);
  assert.equal(staged.descriptor.artifact.id, pack.packId);
  assert.equal(staged.storedObject.alreadyPresent, false);
  assertNoTeamArtifactContractLeaks(staged.descriptor);

  const retrieved = await retrieveKnowledgePackArtifactFromTeamStore({
    descriptor: staged.descriptor,
    store: adapter.artifactStore
  });
  assert.deepEqual(retrieved.payload, pack);
  assert.equal(retrieved.bytes.toString('utf8'), artifactBytes);
});

test('mock team backend adapter keeps object writes idempotent through adapter store', async () => {
  const adapter = createMockKnowledgeTeamBackendAdapter();
  const { artifactBytes, manifest } = buildKnowledgeTeamArtifactBytesAndManifest();

  const first = await stageKnowledgePackArtifactForTeamStore({
    manifest,
    artifactBytes,
    store: adapter.artifactStore
  });
  const second = await stageKnowledgePackArtifactForTeamStore({
    manifest,
    artifactBytes,
    store: adapter.artifactStore
  });

  assert.equal(first.storedObject.alreadyPresent, false);
  assert.equal(second.storedObject.alreadyPresent, true);
  assert.deepEqual(second.descriptor, first.descriptor);
});
