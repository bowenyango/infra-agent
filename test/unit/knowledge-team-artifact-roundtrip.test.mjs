import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeArtifactManifest,
  hashKnowledgeArtifactContent
} from '../../src/knowledge/artifact-manifest.ts';
import {
  buildKnowledgeTeamArtifactObjectKey,
  createMockS3CompatibleKnowledgeArtifactStore,
  KnowledgeTeamArtifactStoreError,
  retrieveKnowledgePackArtifactFromTeamStore,
  serializeKnowledgeArtifactPayload,
  stageKnowledgePackArtifactForTeamStore
} from '../../src/knowledge/team-artifact-store.ts';

function publicStoragePolicy() {
  return {
    scope: 'public-reference',
    defaultStore: 'local-or-explicit-team-cache',
    shareableByDefault: true,
    requiresExplicitOptIn: false,
    reason: 'Source points at public documentation.'
  };
}

function privateStoragePolicy() {
  return {
    scope: 'workspace-private',
    defaultStore: 'local-only',
    shareableByDefault: false,
    requiresExplicitOptIn: true,
    reason: 'Source is derived from workspace-local files.'
  };
}

function buildPack(sourceOverrides = {}) {
  const source = {
    id: 'public-source-id',
    domain: 'helm',
    targetPath: 'charts/payments-api',
    kind: 'helm-docs',
    name: 'payments-api:values',
    factCount: 1,
    contentHash: 'd'.repeat(64),
    fetchedAt: '2026-05-09T00:00:00.000Z',
    staleAfter: '2026-06-09T00:00:00.000Z',
    stale: false,
    freshness: 'fresh',
    storagePolicy: publicStoragePolicy(),
    ...sourceOverrides
  };
  return {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: 'a'.repeat(24),
    workspaceRoot: '/workspace/private-project',
    cacheRoot: '/home/user/.cache/infra-agent',
    requestedDomains: ['helm'],
    targetPaths: ['charts/payments-api'],
    sourceIds: [source.id],
    sourceCount: 1,
    factSetCount: 1,
    factCount: 1,
    includedFactCount: 1,
    omittedFactCount: 0,
    maxFacts: 1,
    staleSourceCount: source.stale ? 1 : 0,
    storagePolicy: {
      publicReference: source.storagePolicy.scope === 'public-reference' ? 1 : 0,
      workspacePrivate: source.storagePolicy.scope === 'workspace-private' ? 1 : 0,
      shareableByDefault: source.storagePolicy.shareableByDefault ? 1 : 0,
      explicitOptInRequired: source.storagePolicy.requiresExplicitOptIn ? 1 : 0
    },
    sources: [source],
    facts: []
  };
}

function buildArtifact(pack) {
  const artifactBytes = serializeKnowledgeArtifactPayload(pack);
  const manifest = buildKnowledgeArtifactManifest(pack, {
    artifactPath: '/tmp/private-project/knowledge-pack.json',
    artifactSha256: hashKnowledgeArtifactContent(artifactBytes),
    createdAt: '2026-05-09T00:00:00.000Z'
  });
  return {
    artifactBytes,
    manifest
  };
}

async function rejectsWithCode(action, code) {
  await assert.rejects(
    action,
    error => error instanceof KnowledgeTeamArtifactStoreError && error.code === code
  );
}

test('team artifact staging stores and retrieves public packs through compact descriptors', async () => {
  const store = createMockS3CompatibleKnowledgeArtifactStore();
  const pack = buildPack();
  const { artifactBytes, manifest } = buildArtifact(pack);

  const staged = await stageKnowledgePackArtifactForTeamStore({
    manifest,
    artifactBytes,
    store
  });

  assert.equal(staged.descriptor.kind, 'infra-agent.knowledge-team-artifact-descriptor');
  assert.equal(staged.descriptor.backendKind, 'mock-s3-compatible');
  assert.equal(staged.descriptor.object.sha256, manifest.artifact.sha256);
  assert.equal(staged.descriptor.object.byteLength, Buffer.byteLength(artifactBytes));
  assert.equal(staged.descriptor.artifact.id, pack.packId);
  assert.equal(staged.policy.allowed, true);

  const descriptorJson = JSON.stringify(staged.descriptor);
  for (const forbidden of [
    '/tmp/private-project',
    '/workspace/private-project',
    '/home/user/.cache',
    'bucket',
    'endpoint',
    's3://',
    'token',
    'password'
  ]) {
    assert.equal(descriptorJson.includes(forbidden), false, forbidden);
  }

  const retrieved = await retrieveKnowledgePackArtifactFromTeamStore({
    descriptor: staged.descriptor,
    store
  });
  assert.equal(retrieved.payload.packId, pack.packId);
  assert.equal(retrieved.bytes.toString('utf8'), artifactBytes);
});

test('team artifact staging rejects hash drift before mock store writes', async () => {
  const store = createMockS3CompatibleKnowledgeArtifactStore();
  const pack = buildPack();
  const { artifactBytes, manifest } = buildArtifact(pack);
  const forgedSha = 'e'.repeat(64);

  await rejectsWithCode(
    () => stageKnowledgePackArtifactForTeamStore({
      manifest: {
        ...manifest,
        artifact: {
          ...manifest.artifact,
          sha256: forgedSha
        }
      },
      artifactBytes,
      store
    }),
    'artifact-hash-mismatch'
  );
  assert.equal(await store.headObject(buildKnowledgeTeamArtifactObjectKey({
    artifactKind: 'infra-agent.knowledge-pack',
    sha256: forgedSha
  })), null);
});

test('team artifact staging rejects private packs before mock store writes', async () => {
  const store = createMockS3CompatibleKnowledgeArtifactStore();
  const pack = buildPack({
    id: 'private-source-id',
    kind: 'chart-metadata',
    storagePolicy: privateStoragePolicy()
  });
  const { artifactBytes, manifest } = buildArtifact(pack);

  await rejectsWithCode(
    () => stageKnowledgePackArtifactForTeamStore({
      manifest,
      artifactBytes,
      store
    }),
    'publication-blocked'
  );
  assert.equal(await store.headObject(buildKnowledgeTeamArtifactObjectKey({
    artifactKind: 'infra-agent.knowledge-pack',
    sha256: manifest.artifact.sha256
  })), null);
});

test('team artifact retrieval rejects tampered stored bytes', async () => {
  const store = createMockS3CompatibleKnowledgeArtifactStore();
  const pack = buildPack();
  const { artifactBytes, manifest } = buildArtifact(pack);
  const staged = await stageKnowledgePackArtifactForTeamStore({
    manifest,
    artifactBytes,
    store
  });
  const tamperedBytes = Buffer.from(artifactBytes.replace('payments-api', 'paymentz-api'), 'utf8');
  const tamperedStore = {
    backendKind: 'mock-s3-compatible',
    async putObject() {
      throw new Error('not used');
    },
    async headObject() {
      return null;
    },
    async getObject(key) {
      return {
        backendKind: 'mock-s3-compatible',
        key,
        sha256: 'f'.repeat(64),
        byteLength: tamperedBytes.byteLength,
        contentType: 'application/json',
        metadata: {},
        bytes: tamperedBytes
      };
    }
  };

  await rejectsWithCode(
    () => retrieveKnowledgePackArtifactFromTeamStore({
      descriptor: staged.descriptor,
      store: tamperedStore
    }),
    'artifact-hash-mismatch'
  );
});
