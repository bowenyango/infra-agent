import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeArtifactManifest,
  hashKnowledgeArtifactContent
} from '../../src/knowledge/artifact-manifest.ts';
import {
  buildKnowledgeTeamArtifactIndexEntry,
  createMockS3CompatibleKnowledgeArtifactStore,
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

function buildPack() {
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
    storagePolicy: publicStoragePolicy()
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
    staleSourceCount: 0,
    storagePolicy: {
      publicReference: 1,
      workspacePrivate: 0,
      shareableByDefault: 1,
      explicitOptInRequired: 0
    },
    sources: [source],
    facts: [{
      kind: 'chart-value',
      path: 'values.image.repository',
      summary: 'Container image repository.',
      confidence: 'medium',
      extractionMethod: 'helm-chart-docs-markdown',
      sourceId: source.id,
      sourceLocator: 'values.image.repository'
    }]
  };
}

async function buildStagedArtifact() {
  const pack = buildPack();
  const artifactBytes = serializeKnowledgeArtifactPayload(pack);
  const manifest = buildKnowledgeArtifactManifest(pack, {
    artifactPath: '/tmp/private-project/knowledge-pack.json',
    artifactSha256: hashKnowledgeArtifactContent(artifactBytes),
    createdAt: '2026-05-09T00:00:00.000Z'
  });
  return stageKnowledgePackArtifactForTeamStore({
    manifest,
    artifactBytes,
    store: createMockS3CompatibleKnowledgeArtifactStore()
  });
}

function assertNoLeakedIndexDetails(value) {
  const text = JSON.stringify(value);
  for (const forbidden of [
    '/tmp/private-project',
    '/workspace/private-project',
    '/home/user/.cache',
    'bucket',
    'endpoint',
    's3://',
    'token',
    'password',
    'Container image repository.'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

test('team artifact index entries are deterministic compact descriptor metadata', async () => {
  const staged = await buildStagedArtifact();

  const firstEntry = buildKnowledgeTeamArtifactIndexEntry(staged.descriptor);
  const secondEntry = buildKnowledgeTeamArtifactIndexEntry(staged.descriptor);

  assert.deepEqual(firstEntry, secondEntry);
  assert.equal(firstEntry.kind, 'infra-agent.knowledge-team-artifact-index-entry');
  assert.equal(firstEntry.schemaVersion, 1);
  assert.equal(firstEntry.mutationAllowed, false);
  assert.equal(firstEntry.backendKind, 'mock-s3-compatible');
  assert.equal(firstEntry.sourceManifestId, staged.descriptor.manifestId);
  assert.equal(firstEntry.index.source, 'descriptor');
  assert.match(firstEntry.index.key, /^knowledge-index\/v1\/knowledge-pack\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.json$/);
  assert.equal(firstEntry.object.key, staged.descriptor.object.key);
  assert.equal(firstEntry.object.sha256, staged.descriptor.object.sha256);
  assert.equal(firstEntry.object.byteLength, staged.descriptor.object.byteLength);
  assert.equal(firstEntry.object.contentType, 'application/json');
  assert.equal(firstEntry.artifact.id, staged.descriptor.artifact.id);
  assert.equal(firstEntry.publication.blockedSourceCount, 0);
  assertNoLeakedIndexDetails(firstEntry);
});
