import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKnowledgeArtifactManifest } from '../../src/knowledge/artifact-manifest.ts';
import {
  evaluateKnowledgeTeamArtifactPublicationPolicy
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
    workspaceRoot: '/workspace',
    cacheRoot: '/cache',
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

function buildManifest(pack) {
  return buildKnowledgeArtifactManifest(pack, {
    artifactPath: '/tmp/knowledge-pack.json',
    createdAt: '2026-05-09T00:00:00.000Z'
  });
}

test('team artifact publication policy allows fresh public-reference knowledge packs', () => {
  const pack = buildPack();
  const manifest = buildManifest(pack);
  const decision = evaluateKnowledgeTeamArtifactPublicationPolicy({
    manifest,
    payload: pack
  });

  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.issues, []);
});

test('team artifact publication policy blocks workspace-private and stale sources', () => {
  const pack = buildPack({
    id: 'private-source-id',
    stale: true,
    staleReason: 'time-expired',
    freshness: 'stale',
    storagePolicy: privateStoragePolicy()
  });
  const decision = evaluateKnowledgeTeamArtifactPublicationPolicy({
    manifest: buildManifest(pack),
    payload: pack
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.some(issue => issue.code === 'workspace-private-source'));
  assert.ok(decision.issues.some(issue => issue.code === 'stale-source'));
  assert.ok(decision.issues.some(issue => issue.code === 'explicit-opt-in-required'));
});

test('team artifact publication policy blocks unchecked payload sources', () => {
  const pack = buildPack({
    freshness: 'unchecked',
    fetchedAt: null,
    staleAfter: undefined
  });
  const decision = evaluateKnowledgeTeamArtifactPublicationPolicy({
    manifest: buildManifest(pack),
    payload: pack
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.some(issue => issue.code === 'unchecked-source'));
});

test('team artifact publication policy blocks forged remote publication manifests', () => {
  const pack = buildPack();
  const manifest = buildManifest(pack);
  const decision = evaluateKnowledgeTeamArtifactPublicationPolicy({
    manifest: {
      ...manifest,
      publication: {
        ...manifest.publication,
        executionMode: 'execute',
        remoteWriteAllowed: true,
        credentialRequired: true,
        uploadCommand: 'aws s3 cp pack.json s3://private'
      }
    },
    payload: pack
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.issues.some(issue => issue.code === 'forged-publication-plan'));
  assert.equal(JSON.stringify(decision).includes('s3://private'), false);
});
