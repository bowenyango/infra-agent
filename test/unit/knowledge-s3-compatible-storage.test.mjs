import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeTeamArtifactObjectKey,
  createMockS3CompatibleKnowledgeArtifactStore,
  KnowledgeTeamArtifactStoreError
} from '../../src/knowledge/team-artifact-store.ts';

const artifactSha256 = 'c'.repeat(64);

function artifactKey() {
  return buildKnowledgeTeamArtifactObjectKey({
    artifactKind: 'infra-agent.knowledge-pack',
    sha256: artifactSha256
  });
}

async function rejectsWithCode(action, code) {
  await assert.rejects(
    action,
    error => error instanceof KnowledgeTeamArtifactStoreError && error.code === code
  );
}

test('mock S3-compatible artifact store puts, heads, and gets content-addressed bytes', async () => {
  const store = createMockS3CompatibleKnowledgeArtifactStore();
  const key = artifactKey();
  const bytes = Buffer.from('{"kind":"infra-agent.knowledge-pack"}\n', 'utf8');

  const put = await store.putObject({
    key,
    bytes,
    contentType: 'application/json',
    metadata: {
      'artifact-kind': 'knowledge-pack',
      'manifest-id': 'a'.repeat(24)
    }
  });

  assert.equal(put.backendKind, 'mock-s3-compatible');
  assert.equal(put.key, key);
  assert.match(put.sha256, /^[a-f0-9]{64}$/);
  assert.equal(put.byteLength, bytes.byteLength);
  assert.equal(put.contentType, 'application/json');
  assert.equal(put.alreadyPresent, false);

  const head = await store.headObject(key);
  assert.equal(head?.sha256, put.sha256);
  assert.deepEqual(head?.metadata, put.metadata);

  const get = await store.getObject(key);
  assert.equal(get?.bytes.toString('utf8'), bytes.toString('utf8'));

  const secondPut = await store.putObject({
    key,
    bytes,
    contentType: 'application/json',
    metadata: put.metadata
  });
  assert.equal(secondPut.alreadyPresent, true);
  assert.equal(secondPut.sha256, put.sha256);
});

test('mock S3-compatible artifact store rejects conflicting writes and reports missing objects', async () => {
  const store = createMockS3CompatibleKnowledgeArtifactStore();
  const key = artifactKey();
  await store.putObject({
    key,
    bytes: Buffer.from('{"one":true}\n', 'utf8'),
    contentType: 'application/json'
  });

  await rejectsWithCode(
    () => store.putObject({
      key,
      bytes: Buffer.from('{"two":true}\n', 'utf8'),
      contentType: 'application/json'
    }),
    'object-conflict'
  );
  assert.equal(await store.headObject(buildKnowledgeTeamArtifactObjectKey({
    artifactKind: 'infra-agent.knowledge-pack',
    sha256: 'd'.repeat(64)
  })), null);
});

test('mock S3-compatible artifact store rejects unsafe backend inputs without leaking them', async () => {
  const store = createMockS3CompatibleKnowledgeArtifactStore();
  const bytes = Buffer.from('{"kind":"infra-agent.knowledge-pack"}\n', 'utf8');

  await rejectsWithCode(
    () => store.putObject({
      key: '../knowledge-pack.json',
      bytes,
      contentType: 'application/json'
    }),
    'invalid-object-key'
  );
  await rejectsWithCode(
    () => store.putObject({
      key: artifactKey(),
      bytes,
      contentType: 'text/plain'
    }),
    'invalid-content-type'
  );
  await rejectsWithCode(
    () => store.putObject({
      key: artifactKey(),
      bytes,
      contentType: 'application/json',
      metadata: {
        bucket: 'private-team-cache'
      }
    }),
    'publication-blocked'
  );
  await rejectsWithCode(
    () => store.putObject({
      key: artifactKey(),
      bytes,
      contentType: 'application/json',
      metadata: {
        'artifact-kind': 'https://s3.example.test/private'
      }
    }),
    'publication-blocked'
  );
});
