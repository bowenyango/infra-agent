import test from 'node:test';
import assert from 'node:assert/strict';
import { isKnowledgeCacheEntryStale } from '../../src/knowledge/cache.ts';
import { resolveKnowledgeSourceCacheStatus } from '../../src/knowledge/cache-status.ts';

const fixedNow = new Date('2026-05-09T00:00:00.000Z');

function externalSource() {
  return {
    kind: 'pulumi-docs',
    name: 'pulumi:aws:s3/bucket:Bucket',
    packageName: '@pulumi/aws',
    version: '6.0.0',
    url: 'https://www.pulumi.com/registry/packages/aws/api-docs/s3/bucket/'
  };
}

function localSource() {
  return {
    kind: 'pulumi-config',
    name: 'pulumi-config:Pulumi.yaml',
    localPath: 'Pulumi.yaml'
  };
}

function cacheEntry(source, staleAfter) {
  return {
    id: 'cache-entry',
    source,
    contentType: 'text/markdown',
    content: '# Cached docs',
    contentHash: 'a'.repeat(64),
    fetchedAt: '2026-05-01T00:00:00.000Z',
    staleAfter
  };
}

function createStore(entry) {
  return {
    root: '/tmp/infra-agent-cache',
    buildId(source) {
      return source.name;
    },
    async read() {
      return entry;
    },
    async write() {
      throw new Error('write is not used by cache status checks');
    },
    isStale(entryToCheck, now) {
      return isKnowledgeCacheEntryStale(entryToCheck, now);
    }
  };
}

test('knowledge cache status reports local sources without reading the store', async () => {
  let readCount = 0;
  const store = {
    ...createStore(null),
    async read() {
      readCount += 1;
      return null;
    }
  };

  assert.equal(await resolveKnowledgeSourceCacheStatus(localSource(), store, fixedNow), 'local');
  assert.equal(readCount, 0);
});

test('knowledge cache status reports missing external cache entries', async () => {
  assert.equal(
    await resolveKnowledgeSourceCacheStatus(externalSource(), createStore(null), fixedNow),
    'missing'
  );
});

test('knowledge cache status reports fresh external cache entries', async () => {
  const source = externalSource();
  const entry = cacheEntry(source, '2026-06-09T00:00:00.000Z');

  assert.equal(
    await resolveKnowledgeSourceCacheStatus(source, createStore(entry), fixedNow),
    'fresh'
  );
});

test('knowledge cache status reports stale external cache entries', async () => {
  const source = externalSource();
  const entry = cacheEntry(source, '2026-05-01T00:00:00.000Z');

  assert.equal(
    await resolveKnowledgeSourceCacheStatus(source, createStore(entry), fixedNow),
    'stale'
  );
});
