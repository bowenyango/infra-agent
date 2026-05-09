import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve
} from 'node:path';
import { captureStdout } from '../support/capture-stdout.mjs';
import { main } from '../../src/cli/main.ts';
import {
  buildKnowledgeArtifactManifest,
  hashKnowledgeArtifactContent
} from '../../src/knowledge/artifact-manifest.ts';
import {
  buildKnowledgeTeamArtifactIndexEntry,
  buildKnowledgeTeamPublicationPlan,
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

async function writePlanAndIndexEntry(root) {
  const pack = buildPack();
  const artifactBytes = serializeKnowledgeArtifactPayload(pack);
  const manifest = buildKnowledgeArtifactManifest(pack, {
    artifactPath: join(root, 'knowledge-pack.json'),
    artifactSha256: hashKnowledgeArtifactContent(artifactBytes),
    createdAt: '2026-05-09T00:00:00.000Z'
  });
  const plan = buildKnowledgeTeamPublicationPlan({
    manifest,
    artifactBytes
  });
  const staged = await stageKnowledgePackArtifactForTeamStore({
    manifest,
    artifactBytes,
    store: createMockS3CompatibleKnowledgeArtifactStore()
  });
  const indexEntry = buildKnowledgeTeamArtifactIndexEntry(staged.descriptor);
  const planPath = join(root, 'knowledge-pack.publication-plan.json');
  const indexEntryPath = join(root, 'knowledge-pack.index-entry.json');
  await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  await writeFile(indexEntryPath, `${JSON.stringify(indexEntry, null, 2)}\n`, 'utf8');
  return {
    indexEntryPath,
    planPath
  };
}

function assertNoLeakedReadinessDetails(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const forbidden of [
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

test('knowledge publish-readiness command writes and validates an upload-required report', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-publish-readiness-'));

  try {
    const { planPath } = await writePlanAndIndexEntry(tempRoot);
    const readinessPath = join(tempRoot, 'knowledge-pack.readiness.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'publish-readiness',
      planPath,
      '--out',
      readinessPath,
      '--json'
    ]));
    const outputPayload = JSON.parse(output);
    const readiness = JSON.parse(await readFile(readinessPath, 'utf8'));

    assert.equal(outputPayload.outputPath, readinessPath);
    assert.equal(readiness.kind, 'infra-agent.knowledge-team-publication-readiness');
    assert.equal(readiness.readiness.status, 'upload-required');
    assert.equal(readiness.remoteWriteAllowed, false);
    assert.equal(readiness.indexEntry.provided, false);
    assertNoLeakedReadinessDetails(readiness);

    const validationOutput = await captureStdout(() => main([
      'knowledge',
      'validate',
      readinessPath,
      '--json'
    ]));
    const validation = JSON.parse(validationOutput);
    assert.equal(validation.inputKind, 'infra-agent.knowledge-team-publication-readiness');
    assert.equal(validation.valid, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge publish-readiness command emits safe already-published text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-publish-readiness-text-'));

  try {
    const { indexEntryPath, planPath } = await writePlanAndIndexEntry(tempRoot);
    const output = await captureStdout(() => main([
      'knowledge',
      'publish-readiness',
      planPath,
      '--index-entry',
      indexEntryPath
    ]));

    assert.match(output, /Knowledge team publication readiness/);
    assert.match(output, /status: already-published/);
    assert.match(output, /remote write: no/);
    assert.match(output, /No team publication readiness blockers/);
    assertNoLeakedReadinessDetails(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
