import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  buildKnowledgeTeamArtifactIndexEntry,
  KnowledgeTeamArtifactStoreError
} from '../../src/knowledge/team-artifact-store.ts';
import {
  buildKnowledgeTeamArtifactObjectKey
} from '../../src/knowledge/team-artifact-keys.ts';
import {
  buildKnowledgeTeamArtifactContractFixture
} from './knowledge-team-artifact-fixtures.mjs';

async function rejectsWithStoreCode(action, code) {
  await assert.rejects(
    action,
    error => error instanceof KnowledgeTeamArtifactStoreError && error.code === code
  );
}

function objectKeyForBytes(bytes) {
  return buildKnowledgeTeamArtifactObjectKey({
    artifactKind: 'infra-agent.knowledge-pack',
    sha256: createHash('sha256').update(bytes).digest('hex')
  });
}

export async function assertTeamBackendAdapterObjectStoreConformance(createAdapter) {
  const adapter = createAdapter();
  const bytes = Buffer.from('{"kind":"infra-agent.knowledge-pack","packId":"conformance"}');
  const key = objectKeyForBytes(bytes);

  const first = await adapter.artifactStore.putObject({
    key,
    bytes,
    contentType: 'application/json',
    metadata: {
      purpose: 'conformance'
    }
  });
  const second = await adapter.artifactStore.putObject({
    key,
    bytes,
    contentType: 'application/json',
    metadata: {
      purpose: 'conformance'
    }
  });
  const head = await adapter.artifactStore.headObject(key);
  const object = await adapter.artifactStore.getObject(key);

  assert.equal(adapter.descriptor.capabilities.remoteWriteAllowed, false);
  assert.equal(adapter.descriptor.capabilities.liveCheckAllowed, false);
  assert.equal(adapter.descriptor.capabilities.credentialValuesExposed, false);
  assert.equal(adapter.descriptor.capabilities.uploadCommand, null);
  assert.equal(first.alreadyPresent, false);
  assert.equal(second.alreadyPresent, true);
  assert.deepEqual(head, {
    backendKind: adapter.artifactStore.backendKind,
    key,
    sha256: first.sha256,
    byteLength: bytes.byteLength,
    contentType: 'application/json',
    metadata: {
      purpose: 'conformance'
    }
  });
  assert.notEqual(object, null);
  assert.equal(object.bytes.toString('utf8'), bytes.toString('utf8'));

  await rejectsWithStoreCode(
    () => adapter.artifactStore.putObject({
      key,
      bytes: Buffer.from('{"kind":"infra-agent.knowledge-pack","packId":"conflict"}'),
      contentType: 'application/json'
    }),
    'object-conflict'
  );
  await rejectsWithStoreCode(
    () => adapter.artifactStore.headObject('../escape.json'),
    'invalid-object-key'
  );
  await rejectsWithStoreCode(
    () => adapter.artifactStore.putObject({
      key: objectKeyForBytes(Buffer.from('invalid content type')),
      bytes: Buffer.from('invalid content type'),
      contentType: 'text/plain'
    }),
    'invalid-content-type'
  );
}

export async function assertTeamBackendAdapterMetadataIndexConformance(createAdapter) {
  const adapter = createAdapter();
  const fixture = await buildKnowledgeTeamArtifactContractFixture();
  assert.notEqual(fixture.descriptor, null);
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

  const conflictingEntry = buildKnowledgeTeamArtifactIndexEntry({
    ...fixture.descriptor,
    object: {
      ...fixture.descriptor.object,
      byteLength: fixture.descriptor.object.byteLength + 1
    }
  });

  await rejectsWithStoreCode(
    () => adapter.metadataIndex.putEntry(conflictingEntry),
    'object-conflict'
  );
  await rejectsWithStoreCode(
    () => adapter.metadataIndex.getEntry('../escape.json'),
    'invalid-object-key'
  );
}
