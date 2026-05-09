import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockKnowledgeTeamBackendAdapter } from '../../src/knowledge/team-backend-adapter-mock.ts';
import {
  buildKnowledgeTeamArtifactIndexEntry,
  KnowledgeTeamArtifactStoreError
} from '../../src/knowledge/team-artifact-store.ts';
import {
  buildKnowledgeTeamArtifactContractFixture
} from '../support/knowledge-team-artifact-fixtures.mjs';

async function rejectsWithCode(action, code) {
  await assert.rejects(
    action,
    error => error instanceof KnowledgeTeamArtifactStoreError && error.code === code
  );
}

test('mock team backend adapter stores metadata index entries idempotently', async () => {
  const adapter = createMockKnowledgeTeamBackendAdapter();
  const fixture = await buildKnowledgeTeamArtifactContractFixture();
  assert.notEqual(fixture.indexEntry, null);

  const first = await adapter.metadataIndex.putEntry(fixture.indexEntry);
  const second = await adapter.metadataIndex.putEntry(fixture.indexEntry);
  const byKey = await adapter.metadataIndex.getEntry(fixture.indexEntry.index.key);
  const byObject = await adapter.metadataIndex.findEntryForObject(fixture.indexEntry.object.key);
  const entries = await adapter.metadataIndex.listEntries();

  assert.equal(first.alreadyPresent, false);
  assert.equal(second.alreadyPresent, true);
  assert.deepEqual(byKey, fixture.indexEntry);
  assert.deepEqual(byObject, fixture.indexEntry);
  assert.deepEqual(entries, [fixture.indexEntry]);
});

test('mock team backend adapter rejects conflicting metadata index entries', async () => {
  const adapter = createMockKnowledgeTeamBackendAdapter();
  const fixture = await buildKnowledgeTeamArtifactContractFixture();
  assert.notEqual(fixture.descriptor, null);
  assert.notEqual(fixture.indexEntry, null);

  await adapter.metadataIndex.putEntry(fixture.indexEntry);
  const conflictingEntry = buildKnowledgeTeamArtifactIndexEntry({
    ...fixture.descriptor,
    object: {
      ...fixture.descriptor.object,
      byteLength: fixture.descriptor.object.byteLength + 1
    }
  });
  await rejectsWithCode(
    () => adapter.metadataIndex.putEntry(conflictingEntry),
    'object-conflict'
  );
});
