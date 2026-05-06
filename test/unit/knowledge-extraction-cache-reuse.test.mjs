import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  cp,
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
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { buildKnowledgeCacheId } from '../../src/knowledge/cache.ts';
import { extractWorkspaceKnowledgeFacts } from '../../src/knowledge/extract.ts';

function sha256Hex(value) {
  return createHash('sha256')
    .update(value)
    .digest('hex');
}

function createMemoryKnowledgeStore(root) {
  const entries = new Map();
  const reads = [];
  const writes = [];

  return {
    root,
    reads,
    writes,
    buildId: buildKnowledgeCacheId,
    read: async source => {
      reads.push(source);
      return entries.get(buildKnowledgeCacheId(source)) ?? null;
    },
    write: async input => {
      const entry = {
        id: buildKnowledgeCacheId(input.source),
        source: input.source,
        contentType: input.contentType,
        content: input.content,
        contentHash: sha256Hex(input.content),
        fetchedAt: input.fetchedAt ?? new Date().toISOString(),
        ...(input.staleAfter !== undefined ? { staleAfter: input.staleAfter } : {}),
        ...(input.fingerprint !== undefined ? { fingerprint: input.fingerprint } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
      };
      writes.push(entry);
      entries.set(entry.id, entry);
      return entry;
    },
    isStale: entry => Boolean(entry.staleAfter && Date.parse(entry.staleAfter) <= Date.now())
  };
}

function findFactSet(report, kind) {
  return report.factSets.find(factSet => factSet.source.kind === kind);
}

test('local knowledge extraction reuses fresh fingerprinted cache entries', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-local-cache-reuse-'));

  try {
    const workspaceRoot = join(tempRoot, 'workspace');
    await cp('fixtures/sample-workspace', workspaceRoot, { recursive: true });
    const inspection = await inspectWorkspace(workspaceRoot);
    const store = createMemoryKnowledgeStore(join(tempRoot, 'cache'));

    const first = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['helm'],
      targetPaths: ['charts/payments-api'],
      store,
      extractedAt: '2026-05-06T00:00:00.000Z'
    });
    const firstWriteCount = store.writes.length;
    assert.ok(firstWriteCount > 0);

    const second = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['helm'],
      targetPaths: ['charts/payments-api'],
      store,
      extractedAt: '2026-05-06T00:01:00.000Z'
    });

    assert.equal(store.writes.length, firstWriteCount);
    assert.equal(
      findFactSet(second, 'chart-schema')?.sourceContentHash,
      findFactSet(first, 'chart-schema')?.sourceContentHash
    );
    assert.ok(store.writes.every(entry => entry.metadata?.retrieval === 'workspace-local'));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('local knowledge extraction regenerates cache entries when fingerprints are stale', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-local-cache-stale-'));

  try {
    const workspaceRoot = join(tempRoot, 'workspace');
    await cp('fixtures/sample-workspace', workspaceRoot, { recursive: true });
    const inspection = await inspectWorkspace(workspaceRoot);
    const store = createMemoryKnowledgeStore(join(tempRoot, 'cache'));

    const first = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['helm'],
      targetPaths: ['charts/payments-api'],
      store,
      extractedAt: '2026-05-06T00:00:00.000Z'
    });
    const firstWriteCount = store.writes.length;
    const valuesSchemaPath = join(workspaceRoot, 'charts/payments-api/values.schema.json');
    const valuesSchema = await readFile(valuesSchemaPath, 'utf8');
    await writeFile(valuesSchemaPath, `${valuesSchema}\n`, 'utf8');

    const second = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['helm'],
      targetPaths: ['charts/payments-api'],
      store,
      extractedAt: '2026-05-06T00:01:00.000Z'
    });

    assert.ok(store.writes.length > firstWriteCount);
    assert.notEqual(
      findFactSet(second, 'chart-schema')?.sourceContentHash,
      findFactSet(first, 'chart-schema')?.sourceContentHash
    );
    assert.equal(findFactSet(second, 'chart-schema')?.sourceFingerprint?.files[0]?.stale, false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
