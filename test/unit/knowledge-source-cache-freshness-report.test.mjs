import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve
} from 'node:path';
import { isKnowledgeCacheEntryStale } from '../../src/knowledge/cache.ts';
import {
  buildKnowledgeCacheStatusReportFromSources,
  resolveKnowledgeSourceCacheStatus
} from '../../src/knowledge/cache-status.ts';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { buildKnowledgeSourcesReport } from '../../src/knowledge/sources.ts';

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

test('knowledge sources report summarizes external cache freshness without fetching', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-source-cache-report-'));

  try {
    const projectRoot = join(tempRoot, 'infra/api');
    await mkdir(projectRoot, { recursive: true });
    await writeFile(
      join(projectRoot, 'Pulumi.yaml'),
      [
        'name: api',
        'runtime: nodejs',
        'config:',
        '  api:imageTag:',
        '    type: string',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({
        dependencies: {
          '@pulumi/aws': '^7.0.0',
          '@pulumi/kubernetes': '4.20.1'
        }
      }, null, 2)}\n`,
      'utf8'
    );
    await writeFile(
      join(projectRoot, 'index.ts'),
      [
        'import * as aws from "@pulumi/aws";',
        'const bucket = new aws.s3.Bucket("api-bucket", {});',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const store = {
      root: 'memory://source-cache-report',
      buildId(source) {
        return source.name;
      },
      async read(source) {
        if (source.name === 'pulumi-docs:package:aws') {
          return cacheEntry(source, '2026-06-09T00:00:00.000Z');
        }
        if (source.name === 'pulumi-docs:resource:aws:s3/bucket') {
          return cacheEntry(source, '2026-05-01T00:00:00.000Z');
        }
        return null;
      },
      async write() {
        throw new Error('write is not used by source reports');
      },
      isStale(entry, now) {
        return isKnowledgeCacheEntryStale(entry, now);
      }
    };
    const report = await buildKnowledgeSourcesReport(inspection, {
      domains: ['pulumi'],
      targetPaths: ['infra/api'],
      store,
      now: fixedNow
    });
    const byName = new Map(report.sources.map(source => [source.source.name, source]));

    assert.equal(byName.get('pulumi-docs:package:aws')?.cacheStatus, 'fresh');
    assert.equal(byName.get('pulumi-docs:resource:aws:s3/bucket')?.cacheStatus, 'stale');
    assert.equal(byName.get('pulumi-docs:package:kubernetes')?.cacheStatus, 'missing');
    assert.ok(report.sources.some(source =>
      source.source.kind === 'pulumi-config'
      && source.cacheStatus === 'local'
    ));
    assert.equal(report.summary.cacheStatus.fresh, 1);
    assert.equal(report.summary.cacheStatus.stale, 1);
    assert.ok(report.summary.cacheStatus.missing >= 1);
    assert.equal(
      report.summary.cacheStatus.refreshRecommended,
      report.summary.cacheStatus.stale + report.summary.cacheStatus.missing
    );

    const cacheStatusReport = buildKnowledgeCacheStatusReportFromSources(
      report,
      inspection.knowledgeCache.source
    );
    const pulumiDomain = cacheStatusReport.byDomain.find(entry => entry.domain === 'pulumi');

    assert.equal(cacheStatusReport.kind, 'infra-agent.cache-status');
    assert.equal(cacheStatusReport.mutationAllowed, false);
    assert.equal(cacheStatusReport.cacheRootSource, inspection.knowledgeCache.source);
    assert.equal(cacheStatusReport.summary.sourceCount, report.sourceCount);
    assert.equal(cacheStatusReport.summary.fresh, 1);
    assert.equal(cacheStatusReport.summary.stale, 1);
    assert.equal(
      cacheStatusReport.summary.refreshRecommended,
      cacheStatusReport.summary.stale + cacheStatusReport.summary.missing
    );
    assert.ok(pulumiDomain);
    assert.equal(pulumiDomain.refreshRecommended, cacheStatusReport.summary.refreshRecommended);
    assert.ok(cacheStatusReport.sources.some(source =>
      source.sourceKind === 'pulumi-docs'
      && source.sourceName === 'pulumi-docs:resource:aws:s3/bucket'
      && source.refreshRecommended === true
      && source.location === 'https://www.pulumi.com/registry/packages/aws/api-docs/s3/bucket/'
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
