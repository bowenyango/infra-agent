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
import { serializeKnowledgeArtifactPayload } from '../../src/knowledge/team-artifact-store.ts';

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

async function writePackAndManifest(root) {
  const pack = buildPack();
  const artifactBytes = serializeKnowledgeArtifactPayload(pack);
  const artifactPath = join(root, 'knowledge-pack.json');
  await writeFile(artifactPath, artifactBytes, 'utf8');
  const manifest = buildKnowledgeArtifactManifest(pack, {
    artifactPath,
    artifactSha256: hashKnowledgeArtifactContent(artifactBytes),
    createdAt: '2026-05-09T00:00:00.000Z'
  });
  const manifestPath = join(root, 'knowledge-pack.manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return {
    artifactPath,
    manifestPath
  };
}

function assertNoLeakedPublicationDetails(value) {
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

test('knowledge publish-plan command writes and validates a dry-run plan', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-publish-plan-'));

  try {
    const { manifestPath } = await writePackAndManifest(tempRoot);
    const planPath = join(tempRoot, 'knowledge-pack.publication-plan.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'publish-plan',
      manifestPath,
      '--out',
      planPath,
      '--json'
    ]));
    const outputPayload = JSON.parse(output);
    const plan = JSON.parse(await readFile(planPath, 'utf8'));

    assert.equal(outputPayload.outputPath, planPath);
    assert.equal(plan.kind, 'infra-agent.knowledge-team-publication-plan');
    assert.equal(plan.publication.allowed, true);
    assert.equal(plan.remoteWriteAllowed, false);
    assert.match(plan.object.key, /^knowledge-artifacts\/v1\/knowledge-pack\/sha256\//);
    assertNoLeakedPublicationDetails(plan);

    const validationOutput = await captureStdout(() => main([
      'knowledge',
      'validate',
      planPath,
      '--json'
    ]));
    const validation = JSON.parse(validationOutput);
    assert.equal(validation.inputKind, 'infra-agent.knowledge-team-publication-plan');
    assert.equal(validation.valid, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge publish-plan command emits safe text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-publish-plan-text-'));

  try {
    const { manifestPath } = await writePackAndManifest(tempRoot);
    const output = await captureStdout(() => main([
      'knowledge',
      'publish-plan',
      manifestPath
    ]));

    assert.match(output, /Knowledge team publication plan/);
    assert.match(output, /allowed: yes/);
    assert.match(output, /remote write: no/);
    assert.match(output, /No team publication blockers/);
    assertNoLeakedPublicationDetails(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
