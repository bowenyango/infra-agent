import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeArtifactManifest,
  hashKnowledgeArtifactContent
} from '../../src/knowledge/artifact-manifest.ts';
import {
  buildKnowledgeTeamPublicationPlan,
  createMockS3CompatibleKnowledgeArtifactStore,
  serializeKnowledgeArtifactPayload
} from '../../src/knowledge/team-artifact-store.ts';
import { stageKnowledgePackArtifactForTeamStore } from '../../src/knowledge/team-artifact-store.ts';

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

test('team publication plan dry run allows fresh public-reference packs', () => {
  const pack = buildPack();
  const { artifactBytes, manifest } = buildArtifact(pack);

  const plan = buildKnowledgeTeamPublicationPlan({
    manifest,
    artifactBytes
  });

  assert.equal(plan.kind, 'infra-agent.knowledge-team-publication-plan');
  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.mutationAllowed, false);
  assert.equal(plan.executionMode, 'dry-run');
  assert.equal(plan.remoteWriteAllowed, false);
  assert.equal(plan.credentialRequired, false);
  assert.equal(plan.uploadCommand, null);
  assert.equal(plan.plannedBackendKind, 'mock-s3-compatible');
  assert.equal(plan.publication.allowed, true);
  assert.equal(plan.publication.blockerCount, 0);
  assert.deepEqual(plan.publication.blockerCodes, []);
  assert.equal(plan.validation.artifactHashMatches, true);
  assert.equal(plan.validation.artifactMetadataMatches, true);
  assert.equal(plan.object.sha256, manifest.artifact.sha256);
  assert.equal(plan.object.byteLength, Buffer.byteLength(artifactBytes));
  assert.match(plan.object.key, /^knowledge-artifacts\/v1\/knowledge-pack\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.json$/);
  assert.equal(plan.artifact.id, pack.packId);
  assert.equal(plan.artifact.sourceCount, 1);
  assert.equal(plan.artifact.factCount, 1);
});

test('team publication plan dry run is deterministic and compact', () => {
  const pack = buildPack();
  const { artifactBytes, manifest } = buildArtifact(pack);

  const firstPlan = buildKnowledgeTeamPublicationPlan({ manifest, artifactBytes });
  const secondPlan = buildKnowledgeTeamPublicationPlan({ manifest, artifactBytes });

  assert.deepEqual(firstPlan, secondPlan);
  const planJson = JSON.stringify(firstPlan);
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
    assert.equal(planJson.includes(forbidden), false, forbidden);
  }
});

test('team publication plan dry run reports private stale and unchecked blockers', () => {
  const pack = buildPack({
    id: 'private-source-id',
    kind: 'chart-metadata',
    stale: true,
    staleReason: 'time-expired',
    freshness: 'unchecked',
    storagePolicy: privateStoragePolicy()
  });
  const { artifactBytes, manifest } = buildArtifact(pack);

  const plan = buildKnowledgeTeamPublicationPlan({
    manifest,
    artifactBytes
  });

  assert.equal(plan.publication.allowed, false);
  assert.ok(plan.publication.blockerCodes.includes('workspace-private-source'));
  assert.ok(plan.publication.blockerCodes.includes('stale-source'));
  assert.ok(plan.publication.blockerCodes.includes('unchecked-source'));
  assert.ok(plan.publication.blockerCodes.includes('explicit-opt-in-required'));
  assert.equal(JSON.stringify(plan).includes('/workspace/private-project'), false);
});

test('team publication plan dry run reports hash and metadata drift as blockers', () => {
  const pack = buildPack();
  const { artifactBytes, manifest } = buildArtifact(pack);

  const hashDriftPlan = buildKnowledgeTeamPublicationPlan({
    manifest: {
      ...manifest,
      artifact: {
        ...manifest.artifact,
        sha256: 'e'.repeat(64)
      }
    },
    artifactBytes
  });
  assert.equal(hashDriftPlan.publication.allowed, false);
  assert.equal(hashDriftPlan.validation.artifactHashMatches, false);
  assert.ok(hashDriftPlan.publication.blockerCodes.includes('artifact-hash-mismatch'));

  const metadataDriftPlan = buildKnowledgeTeamPublicationPlan({
    manifest: {
      ...manifest,
      artifact: {
        ...manifest.artifact,
        sourceCount: manifest.artifact.sourceCount + 1
      }
    },
    artifactBytes
  });
  assert.equal(metadataDriftPlan.publication.allowed, false);
  assert.equal(metadataDriftPlan.validation.artifactMetadataMatches, false);
  assert.ok(metadataDriftPlan.publication.blockerCodes.includes('artifact-metadata-mismatch'));
});

test('team publication plan dry run evaluates optional descriptor reuse without store writes', async () => {
  const pack = buildPack();
  const { artifactBytes, manifest } = buildArtifact(pack);
  const staged = await stageKnowledgePackArtifactForTeamStore({
    manifest,
    artifactBytes,
    store: createMockS3CompatibleKnowledgeArtifactStore()
  });

  const reusablePlan = buildKnowledgeTeamPublicationPlan({
    manifest,
    artifactBytes,
    descriptor: staged.descriptor
  });
  assert.equal(reusablePlan.publication.allowed, true);
  assert.equal(reusablePlan.validation.descriptorProvided, true);
  assert.equal(reusablePlan.validation.descriptorMatches, true);
  assert.equal(reusablePlan.descriptor.reusable, true);

  const mismatchPlan = buildKnowledgeTeamPublicationPlan({
    manifest,
    artifactBytes,
    descriptor: {
      ...staged.descriptor,
      object: {
        ...staged.descriptor.object,
        byteLength: staged.descriptor.object.byteLength + 1
      }
    }
  });
  assert.equal(mismatchPlan.publication.allowed, false);
  assert.equal(mismatchPlan.validation.descriptorMatches, false);
  assert.equal(mismatchPlan.descriptor.reusable, false);
  assert.ok(mismatchPlan.publication.blockerCodes.includes('descriptor-mismatch'));
});
