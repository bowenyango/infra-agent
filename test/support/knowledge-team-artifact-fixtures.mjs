import assert from 'node:assert/strict';
import {
  buildKnowledgeArtifactManifest,
  hashKnowledgeArtifactContent
} from '../../src/knowledge/artifact-manifest.ts';
import {
  buildKnowledgeTeamArtifactIndexEntry,
  buildKnowledgeTeamPublicationPlan,
  buildKnowledgeTeamPublicationReadinessReport,
  createMockS3CompatibleKnowledgeArtifactStore,
  serializeKnowledgeArtifactPayload,
  stageKnowledgePackArtifactForTeamStore
} from '../../src/knowledge/team-artifact-store.ts';

export const TEAM_ARTIFACT_FORBIDDEN_LEAK_STRINGS = [
  '/tmp/private-project',
  '/workspace/private-project',
  '/home/user/.cache',
  'bucket',
  'endpoint',
  's3://',
  'token',
  'password',
  'Container image repository.'
];

export function assertNoTeamArtifactContractLeaks(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const forbidden of TEAM_ARTIFACT_FORBIDDEN_LEAK_STRINGS) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

export function publicKnowledgeStoragePolicy() {
  return {
    scope: 'public-reference',
    defaultStore: 'local-or-explicit-team-cache',
    shareableByDefault: true,
    requiresExplicitOptIn: false,
    reason: 'Source points at public documentation.'
  };
}

export function privateKnowledgeStoragePolicy() {
  return {
    scope: 'workspace-private',
    defaultStore: 'local-only',
    shareableByDefault: false,
    requiresExplicitOptIn: true,
    reason: 'Source is derived from workspace-local files.'
  };
}

export function buildKnowledgeTeamContractPack(sourceOverrides = {}) {
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
    storagePolicy: publicKnowledgeStoragePolicy(),
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

export function buildKnowledgeTeamArtifactBytesAndManifest(sourceOverrides = {}) {
  const pack = buildKnowledgeTeamContractPack(sourceOverrides);
  const artifactBytes = serializeKnowledgeArtifactPayload(pack);
  const manifest = buildKnowledgeArtifactManifest(pack, {
    artifactPath: '/tmp/private-project/knowledge-pack.json',
    artifactSha256: hashKnowledgeArtifactContent(artifactBytes),
    createdAt: '2026-05-09T00:00:00.000Z'
  });
  return {
    artifactBytes,
    manifest,
    pack
  };
}

export async function buildKnowledgeTeamArtifactContractFixture(sourceOverrides = {}) {
  const artifact = buildKnowledgeTeamArtifactBytesAndManifest(sourceOverrides);
  const publicationPlan = buildKnowledgeTeamPublicationPlan({
    manifest: artifact.manifest,
    artifactBytes: artifact.artifactBytes
  });
  const staged = publicationPlan.publication.allowed
    ? await stageKnowledgePackArtifactForTeamStore({
        manifest: artifact.manifest,
        artifactBytes: artifact.artifactBytes,
        store: createMockS3CompatibleKnowledgeArtifactStore()
      })
    : null;
  const descriptor = staged?.descriptor ?? null;
  const indexEntry = descriptor === null
    ? null
    : buildKnowledgeTeamArtifactIndexEntry(descriptor);
  const uploadRequiredReadiness = buildKnowledgeTeamPublicationReadinessReport({
    plan: publicationPlan
  });
  const alreadyPublishedReadiness = indexEntry === null
    ? null
    : buildKnowledgeTeamPublicationReadinessReport({
        plan: publicationPlan,
        indexEntry
      });

  return {
    ...artifact,
    descriptor,
    indexEntry,
    publicationPlan,
    uploadRequiredReadiness,
    alreadyPublishedReadiness
  };
}

export async function buildBlockedKnowledgeTeamArtifactContractFixture() {
  return buildKnowledgeTeamArtifactContractFixture({
    id: 'private-source-id',
    kind: 'chart-metadata',
    stale: true,
    staleReason: 'time-expired',
    freshness: 'unchecked',
    storagePolicy: privateKnowledgeStoragePolicy()
  });
}
