import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeArtifactManifest,
  hashKnowledgeArtifactContent
} from '../../src/knowledge/artifact-manifest.ts';
import {
  buildKnowledgeTeamArtifactIndexEntry,
  buildKnowledgeTeamPublicationPlan,
  buildKnowledgeTeamPublicationReadinessReport,
  createMockS3CompatibleKnowledgeArtifactMetadataIndex,
  createMockS3CompatibleKnowledgeArtifactStore,
  KnowledgeTeamArtifactStoreError,
  serializeKnowledgeArtifactPayload,
  stageKnowledgePackArtifactForTeamStore
} from '../../src/knowledge/team-artifact-store.ts';
import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';

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
    unitCount: 1,
    includedUnitCount: 1,
    omittedUnitCount: 0,
    maxFacts: 1,
    maxUnits: 1,
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
    }],
    units: [{
      unitType: 'fact',
      factKind: 'chart-value',
      path: 'values.image.repository',
      summary: 'Container image repository.',
      confidence: 'medium',
      extractionMethod: 'helm-chart-docs-markdown',
      sourceId: source.id,
      sourceLocator: 'values.image.repository',
      privacyScope: 'public-reference'
    }]
  };
}

function buildArtifact(sourceOverrides = {}) {
  const pack = buildPack(sourceOverrides);
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

async function buildStagedArtifact() {
  const artifact = buildArtifact();
  return stageKnowledgePackArtifactForTeamStore({
    manifest: artifact.manifest,
    artifactBytes: artifact.artifactBytes,
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
  assert.equal(firstEntry.artifact.unitCount, 1);
  assert.equal(firstEntry.publication.blockedSourceCount, 0);
  assertNoLeakedIndexDetails(firstEntry);
});

test('team publication readiness reports upload-required and already-published states', async () => {
  const artifact = buildArtifact();
  const staged = await stageKnowledgePackArtifactForTeamStore({
    manifest: artifact.manifest,
    artifactBytes: artifact.artifactBytes,
    store: createMockS3CompatibleKnowledgeArtifactStore()
  });
  const plan = buildKnowledgeTeamPublicationPlan({
    manifest: artifact.manifest,
    artifactBytes: artifact.artifactBytes
  });

  const uploadRequired = buildKnowledgeTeamPublicationReadinessReport({ plan });
  assert.equal(uploadRequired.kind, 'infra-agent.knowledge-team-publication-readiness');
  assert.equal(uploadRequired.mutationAllowed, false);
  assert.equal(uploadRequired.remoteWriteAllowed, false);
  assert.equal(uploadRequired.credentialRequired, false);
  assert.equal(uploadRequired.uploadCommand, null);
  assert.equal(uploadRequired.readiness.status, 'upload-required');
  assert.equal(uploadRequired.artifact.unitCount, 1);
  assert.equal(uploadRequired.readiness.nextAction, 'prepare-explicit-upload');
  assert.equal(uploadRequired.readiness.blockerCount, 0);
  assert.equal(uploadRequired.indexEntry.provided, false);
  assert.equal(uploadRequired.indexEntry.matches, null);
  assertNoLeakedIndexDetails(uploadRequired);

  const indexEntry = buildKnowledgeTeamArtifactIndexEntry(staged.descriptor);
  const alreadyPublished = buildKnowledgeTeamPublicationReadinessReport({
    plan,
    indexEntry
  });
  assert.equal(alreadyPublished.readiness.status, 'already-published');
  assert.equal(alreadyPublished.readiness.nextAction, 'none');
  assert.equal(alreadyPublished.readiness.blockerCount, 0);
  assert.equal(alreadyPublished.indexEntry.provided, true);
  assert.equal(alreadyPublished.indexEntry.matches, true);
  assert.equal(alreadyPublished.indexEntry.key, indexEntry.index.key);
  assertNoLeakedIndexDetails(alreadyPublished);
});

test('team publication readiness preserves blocked publication plan reasons', () => {
  const artifact = buildArtifact({
    id: 'private-source-id',
    kind: 'chart-metadata',
    stale: true,
    staleReason: 'time-expired',
    freshness: 'unchecked',
    storagePolicy: privateStoragePolicy()
  });
  const plan = buildKnowledgeTeamPublicationPlan({
    manifest: artifact.manifest,
    artifactBytes: artifact.artifactBytes
  });

  const readiness = buildKnowledgeTeamPublicationReadinessReport({ plan });

  assert.equal(readiness.publication.allowed, false);
  assert.equal(readiness.readiness.status, 'blocked');
  assert.equal(readiness.readiness.nextAction, 'resolve-blockers');
  assert.ok(readiness.readiness.blockerCodes.includes('workspace-private-source'));
  assert.ok(readiness.readiness.blockerCodes.includes('stale-source'));
  assert.ok(readiness.readiness.blockerCodes.includes('unchecked-source'));
  assertNoLeakedIndexDetails(readiness);
});

test('team publication readiness reports compact index conflicts', async () => {
  const artifact = buildArtifact();
  const staged = await stageKnowledgePackArtifactForTeamStore({
    manifest: artifact.manifest,
    artifactBytes: artifact.artifactBytes,
    store: createMockS3CompatibleKnowledgeArtifactStore()
  });
  const plan = buildKnowledgeTeamPublicationPlan({
    manifest: artifact.manifest,
    artifactBytes: artifact.artifactBytes
  });
  const indexEntry = buildKnowledgeTeamArtifactIndexEntry(staged.descriptor);

  const objectConflict = buildKnowledgeTeamPublicationReadinessReport({
    plan,
    indexEntry: {
      ...indexEntry,
      object: {
        ...indexEntry.object,
        byteLength: indexEntry.object.byteLength + 1
      }
    }
  });
  assert.equal(objectConflict.readiness.status, 'conflict');
  assert.ok(objectConflict.readiness.blockerCodes.includes('index-object-mismatch'));

  const artifactConflict = buildKnowledgeTeamPublicationReadinessReport({
    plan,
    indexEntry: {
      ...indexEntry,
      artifact: {
        ...indexEntry.artifact,
        factCount: indexEntry.artifact.factCount + 1
      }
    }
  });
  assert.equal(artifactConflict.readiness.status, 'conflict');
  assert.ok(artifactConflict.readiness.blockerCodes.includes('index-artifact-mismatch'));

  const unitCountConflict = buildKnowledgeTeamPublicationReadinessReport({
    plan,
    indexEntry: {
      ...indexEntry,
      artifact: {
        ...indexEntry.artifact,
        unitCount: (indexEntry.artifact.unitCount ?? 0) + 1
      }
    }
  });
  assert.equal(unitCountConflict.readiness.status, 'conflict');
  assert.ok(unitCountConflict.readiness.blockerCodes.includes('index-artifact-mismatch'));

  const publicationConflict = buildKnowledgeTeamPublicationReadinessReport({
    plan,
    indexEntry: {
      ...indexEntry,
      publication: {
        ...indexEntry.publication,
        blockedSourceCount: 1
      }
    }
  });
  assert.equal(publicationConflict.readiness.status, 'conflict');
  assert.ok(publicationConflict.readiness.blockerCodes.includes('index-publication-mismatch'));
  assertNoLeakedIndexDetails(publicationConflict);
});

test('mock team artifact metadata index stores entries idempotently', async () => {
  const staged = await buildStagedArtifact();
  const entry = buildKnowledgeTeamArtifactIndexEntry(staged.descriptor);
  const index = createMockS3CompatibleKnowledgeArtifactMetadataIndex();

  const firstPut = await index.putEntry(entry);
  const secondPut = await index.putEntry(entry);
  const byKey = await index.getEntry(entry.index.key);
  const byObject = await index.findEntryForObject(entry.object.key);
  const allEntries = await index.listEntries();

  assert.equal(firstPut.alreadyPresent, false);
  assert.equal(secondPut.alreadyPresent, true);
  assert.deepEqual(firstPut.entry, entry);
  assert.deepEqual(secondPut.entry, entry);
  assert.deepEqual(byKey, entry);
  assert.deepEqual(byObject, entry);
  assert.deepEqual(allEntries, [entry]);
  assertNoLeakedIndexDetails(allEntries);
});

test('mock team artifact metadata index rejects conflicts and unsafe keys', async () => {
  const staged = await buildStagedArtifact();
  const entry = buildKnowledgeTeamArtifactIndexEntry(staged.descriptor);
  const index = createMockS3CompatibleKnowledgeArtifactMetadataIndex();

  await index.putEntry(entry);
  await assert.rejects(
    () => index.putEntry({
      ...entry,
      object: {
        ...entry.object,
        byteLength: entry.object.byteLength + 1
      }
    }),
    error => error instanceof KnowledgeTeamArtifactStoreError && error.code === 'object-conflict'
  );

  await assert.rejects(
    () => index.putEntry({
      ...entry,
      index: {
        ...entry.index,
        key: '../unsafe-index-entry.json'
      }
    }),
    error => error instanceof KnowledgeTeamArtifactStoreError && error.code === 'invalid-object-key'
  );
  await assert.rejects(
    () => index.findEntryForObject('/absolute/object/key.json'),
    error => error instanceof KnowledgeTeamArtifactStoreError && error.code === 'invalid-object-key'
  );
});

test('knowledge validation accepts team index entries and readiness reports', async () => {
  const artifact = buildArtifact();
  const staged = await stageKnowledgePackArtifactForTeamStore({
    manifest: artifact.manifest,
    artifactBytes: artifact.artifactBytes,
    store: createMockS3CompatibleKnowledgeArtifactStore()
  });
  const plan = buildKnowledgeTeamPublicationPlan({
    manifest: artifact.manifest,
    artifactBytes: artifact.artifactBytes
  });
  const entry = buildKnowledgeTeamArtifactIndexEntry(staged.descriptor);
  const readiness = buildKnowledgeTeamPublicationReadinessReport({
    plan,
    indexEntry: entry
  });

  const entryReport = validateKnowledgePayload(entry, 'inline');
  const readinessReport = validateKnowledgePayload(readiness, 'inline');

  assert.equal(entryReport.inputKind, 'infra-agent.knowledge-team-artifact-index-entry');
  assert.equal(entryReport.valid, true);
  assert.equal(entryReport.factCount, 1);
  assert.equal(entryReport.unitCount, 1);
  assert.equal(readinessReport.inputKind, 'infra-agent.knowledge-team-publication-readiness');
  assert.equal(readinessReport.valid, true);
  assert.equal(readinessReport.factCount, 1);
  assert.equal(readinessReport.unitCount, 1);
});

test('knowledge validation rejects forged or leaky team index readiness payloads', async () => {
  const artifact = buildArtifact();
  const staged = await stageKnowledgePackArtifactForTeamStore({
    manifest: artifact.manifest,
    artifactBytes: artifact.artifactBytes,
    store: createMockS3CompatibleKnowledgeArtifactStore()
  });
  const plan = buildKnowledgeTeamPublicationPlan({
    manifest: artifact.manifest,
    artifactBytes: artifact.artifactBytes
  });
  const entry = buildKnowledgeTeamArtifactIndexEntry(staged.descriptor);
  const readiness = buildKnowledgeTeamPublicationReadinessReport({
    plan,
    indexEntry: entry
  });

  const entryReport = validateKnowledgePayload({
    ...entry,
    bucket: 'private-team-cache',
    endpointUrl: 'https://s3.example.test/private',
    accessToken: 'secret-token'
  }, 'inline');
  const readinessReport = validateKnowledgePayload({
    ...readiness,
    remoteWriteAllowed: true,
    credentialRequired: true,
    uploadCommand: 'aws s3 cp pack.json s3://private-bucket',
    bucket: 'private-team-cache',
    endpointUrl: 'https://s3.example.test/private',
    accessToken: 'secret-token'
  }, 'inline');

  assert.equal(entryReport.valid, false);
  for (const path of ['$.bucket', '$.endpointUrl', '$.accessToken']) {
    assert.ok(entryReport.issues.some(issue => issue.path === path), path);
  }
  assert.equal(readinessReport.valid, false);
  for (const path of [
    '$.remoteWriteAllowed',
    '$.credentialRequired',
    '$.uploadCommand',
    '$.bucket',
    '$.endpointUrl',
    '$.accessToken'
  ]) {
    assert.ok(readinessReport.issues.some(issue => issue.path === path), path);
  }
});
