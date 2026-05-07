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
import { buildPulumiDocsKnowledgeSources } from '../../src/domain/pulumi-docs-context.ts';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { buildKnowledgeCacheId } from '../../src/knowledge/cache.ts';
import { fetchOfficialKnowledgeSource } from '../../src/knowledge/retrieve.ts';
import { buildKnowledgeSourcesReport } from '../../src/knowledge/sources.ts';
import { prefetchWorkspaceKnowledge } from '../../src/knowledge/prefetch.ts';

async function writePulumiProject(root, projectPath, projectContent, stackContent = null) {
  const projectRoot = join(root, projectPath);
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, 'Pulumi.yaml'), projectContent, 'utf8');

  if (stackContent !== null) {
    await writeFile(join(projectRoot, 'Pulumi.dev.yaml'), stackContent, 'utf8');
  }
}

async function writePulumiPackageJson(root, projectPath, packageJson) {
  await writeFile(
    join(root, projectPath, 'package.json'),
    `${JSON.stringify(packageJson, null, 2)}\n`,
    'utf8'
  );
}

function createMemoryKnowledgeStore() {
  const entries = new Map();

  return {
    root: 'memory://pulumi-docs-prefetch',
    buildId: buildKnowledgeCacheId,
    read: async source => entries.get(buildKnowledgeCacheId(source)) ?? null,
    write: async input => {
      const entry = {
        id: buildKnowledgeCacheId(input.source),
        source: input.source,
        contentType: input.contentType,
        content: input.content,
        contentHash: 'f'.repeat(64),
        fetchedAt: input.fetchedAt ?? '2026-05-06T00:00:00.000Z',
        ...(input.staleAfter !== undefined ? { staleAfter: input.staleAfter } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
      };
      entries.set(entry.id, entry);
      return entry;
    },
    isStale: entry => Boolean(entry.staleAfter && Date.parse(entry.staleAfter) <= Date.parse('2026-05-06T00:00:00.000Z'))
  };
}

test('Pulumi docs source selection derives bounded public docs from project metadata', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === 'infra/payments-api');
  assert.ok(project);

  const sources = await buildPulumiDocsKnowledgeSources(inspection.workspaceRoot, project);

  assert.equal(sources.length, 2);
  assert.ok(sources.every(source => source.kind === 'pulumi-docs'));
  assert.ok(sources.every(source => source.localPath === undefined));
  assert.ok(sources.some(source =>
    source.name === 'pulumi-docs:config'
    && source.packageName === '@pulumi/pulumi'
    && source.url === 'https://www.pulumi.com/docs/iac/concepts/config/'
  ));
  assert.ok(sources.some(source =>
    source.name === 'pulumi-docs:yaml'
    && source.packageName === '@pulumi/pulumi'
    && source.url === 'https://www.pulumi.com/docs/iac/languages-sdks/yaml/'
  ));
});

test('Pulumi docs source selection derives package docs from project package manifests', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-docs-packages-'));

  try {
    await writePulumiProject(
      tempRoot,
      'infra/api',
      [
        'name: api',
        'runtime: nodejs',
        ''
      ].join('\n')
    );
    await writePulumiPackageJson(tempRoot, 'infra/api', {
      dependencies: {
        '@pulumi/pulumi': '^3.118.0',
        '@pulumi/aws': '^7.0.0',
        '@pulumi/kubernetes': '4.20.1'
      },
      devDependencies: {
        '@pulumi/aws': '^6.0.0',
        '@private/internal': '1.0.0'
      }
    });

    const inspection = await inspectWorkspace(tempRoot);
    const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === 'infra/api');
    assert.ok(project);
    assert.deepEqual(project.packageFiles, ['infra/api/package.json']);

    const sources = await buildPulumiDocsKnowledgeSources(tempRoot, project);

    assert.equal(sources.filter(source => source.name === 'pulumi-docs:package:aws').length, 1);
    assert.ok(sources.some(source =>
      source.kind === 'pulumi-docs'
      && source.name === 'pulumi-docs:package:aws'
      && source.packageName === '@pulumi/aws'
      && source.version === '^7.0.0'
      && source.url === 'https://www.pulumi.com/registry/packages/aws/api-docs/'
      && source.localPath === undefined
    ));
    assert.ok(sources.some(source =>
      source.name === 'pulumi-docs:package:kubernetes'
      && source.packageName === '@pulumi/kubernetes'
      && source.version === '4.20.1'
      && source.url === 'https://www.pulumi.com/registry/packages/kubernetes/api-docs/'
    ));
    assert.equal(sources.some(source => source.packageName === '@pulumi/pulumi'), false);
    assert.equal(sources.some(source => source.packageName === '@private/internal'), false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Pulumi docs source selection derives resource docs from YAML resource tokens', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-docs-resources-'));

  try {
    await writePulumiProject(
      tempRoot,
      'infra/api',
      [
        'name: api',
        'runtime: yaml',
        'resources:',
        '  apiBucket:',
        '    type: aws:s3/bucket:Bucket',
        '  apiDeployment:',
        '    type: kubernetes:apps/v1:Deployment',
        ''
      ].join('\n')
    );
    await writePulumiPackageJson(tempRoot, 'infra/api', {
      dependencies: {
        '@pulumi/aws': '^7.0.0',
        '@pulumi/kubernetes': '4.20.1'
      }
    });

    const inspection = await inspectWorkspace(tempRoot);
    const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === 'infra/api');
    assert.ok(project);

    const sources = await buildPulumiDocsKnowledgeSources(tempRoot, project);

    assert.ok(sources.some(source =>
      source.kind === 'pulumi-docs'
      && source.name === 'pulumi-docs:resource:aws:s3/bucket'
      && source.packageName === '@pulumi/aws'
      && source.module === 'aws:s3/bucket:Bucket'
      && source.version === '^7.0.0'
      && source.url === 'https://www.pulumi.com/registry/packages/aws/api-docs/s3/bucket/'
      && source.localPath === undefined
    ));
    assert.ok(sources.some(source =>
      source.name === 'pulumi-docs:resource:kubernetes:apps/v1/deployment'
      && source.packageName === '@pulumi/kubernetes'
      && source.module === 'kubernetes:apps/v1:Deployment'
      && source.version === '4.20.1'
      && source.url === 'https://www.pulumi.com/registry/packages/kubernetes/api-docs/apps/v1/deployment/'
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Pulumi docs source selection derives resource docs from language resource tokens', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-docs-language-resources-'));

  try {
    await writePulumiProject(
      tempRoot,
      'infra/api',
      [
        'name: api',
        'runtime: nodejs',
        ''
      ].join('\n')
    );
    await writePulumiPackageJson(tempRoot, 'infra/api', {
      dependencies: {
        '@pulumi/aws': '^7.0.0'
      }
    });
    await writeFile(
      join(tempRoot, 'infra/api/index.ts'),
      [
        'import * as aws from "@pulumi/aws";',
        'const bucket = new aws.s3.Bucket("api-bucket", {});',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === 'infra/api');
    assert.ok(project);
    assert.equal(project.resourceTokens[0]?.evidence?.kind, 'pulumi-nodejs');

    const sources = await buildPulumiDocsKnowledgeSources(tempRoot, project);

    assert.ok(sources.some(source =>
      source.kind === 'pulumi-docs'
      && source.name === 'pulumi-docs:resource:aws:s3/bucket'
      && source.packageName === '@pulumi/aws'
      && source.module === 'aws:s3/bucket:Bucket'
      && source.version === '^7.0.0'
      && source.url === 'https://www.pulumi.com/registry/packages/aws/api-docs/s3/bucket/'
      && source.localPath === undefined
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Pulumi docs source selection omits private or local package versions from public docs ids', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-docs-local-package-'));

  try {
    await writePulumiProject(
      tempRoot,
      'infra/api',
      [
        'name: api',
        'runtime: nodejs',
        ''
      ].join('\n')
    );
    await writePulumiPackageJson(tempRoot, 'infra/api', {
      dependencies: {
        '@pulumi/aws': 'file:../private-provider',
        '@pulumi/random': 'workspace:*'
      }
    });

    const inspection = await inspectWorkspace(tempRoot);
    const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === 'infra/api');
    assert.ok(project);

    const sources = await buildPulumiDocsKnowledgeSources(tempRoot, project);

    assert.ok(sources.some(source =>
      source.name === 'pulumi-docs:package:aws'
      && source.packageName === '@pulumi/aws'
      && source.version === undefined
    ));
    assert.ok(sources.some(source =>
      source.name === 'pulumi-docs:package:random'
      && source.packageName === '@pulumi/random'
      && source.version === undefined
    ));
    assert.doesNotMatch(JSON.stringify(sources), /private-provider|workspace:\*/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Pulumi docs source selection skips non-YAML projects without config evidence', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-docs-minimal-'));

  try {
    await writePulumiProject(
      tempRoot,
      'infra/api',
      [
        'name: api',
        'runtime: nodejs',
        ''
      ].join('\n')
    );
    const inspection = await inspectWorkspace(tempRoot);
    const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === 'infra/api');
    assert.ok(project);

    const sources = await buildPulumiDocsKnowledgeSources(tempRoot, project);

    assert.deepEqual(sources, []);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Pulumi docs source report respects target filtering and public storage policy', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-docs-target-'));

  try {
    await writePulumiProject(
      tempRoot,
      'infra/api',
      [
        'name: api',
        'runtime: yaml',
        'config:',
        '  api:imageTag:',
        '    type: string',
        'resources: {}',
        ''
      ].join('\n'),
      'config:\n  api:imageTag: dev\n'
    );
    await writePulumiProject(
      tempRoot,
      'infra/worker',
      [
        'name: worker',
        'runtime: yaml',
        'resources: {}',
        ''
      ].join('\n')
    );
    const inspection = await inspectWorkspace(tempRoot);

    const report = await buildKnowledgeSourcesReport(inspection, {
      domains: ['pulumi'],
      targetPaths: ['infra/api']
    });
    const docsSources = report.sources.filter(source => source.source.kind === 'pulumi-docs');

    assert.equal(report.targetPaths[0], 'infra/api');
    assert.ok(docsSources.length >= 1);
    assert.ok(docsSources.every(source => source.domain === 'pulumi'));
    assert.ok(docsSources.every(source => source.targetPath === 'infra/api'));
    assert.ok(docsSources.every(source => source.requiresFetch === true));
    assert.ok(docsSources.every(source => source.storagePolicy.scope === 'public-reference'));
    assert.ok(docsSources.every(source => source.storagePolicy.shareableByDefault === true));
    assert.equal(report.sources.some(source => source.targetPath === 'infra/worker'), false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Pulumi docs prefetch fetches bounded external docs while preserving local config status', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const result = await prefetchWorkspaceKnowledge(inspection, {
    domains: ['pulumi'],
    targetPaths: ['infra/payments-api'],
    maxSources: 1,
    store: createMemoryKnowledgeStore(),
    now: new Date('2026-05-06T00:00:00.000Z'),
    fetcher: async source => ({
      source,
      contentType: 'text/markdown',
      content: `# ${source.name}\nFetched official Pulumi docs.`,
      fetchedAt: '2026-05-06T00:00:00.000Z'
    })
  });

  assert.equal(result.kind, 'infra-agent.knowledge-prefetch');
  assert.equal(result.summary.local, 1);
  assert.equal(result.summary.fetched, 1);
  assert.equal(result.summary.skipped, 1);
  assert.ok(result.sources.some(source =>
    source.status === 'local'
    && source.source.kind === 'pulumi-config'
  ));
  assert.ok(result.sources.some(source =>
    source.status === 'fetched'
    && source.source.kind === 'pulumi-docs'
    && source.contentType === 'text/markdown'
  ));
  assert.ok(result.sources.some(source =>
    source.status === 'skipped'
    && source.source.kind === 'pulumi-docs'
  ));
});

test('official knowledge fetcher assigns default TTL for URL-backed public docs', async () => {
  const source = {
    kind: 'pulumi-docs',
    name: 'pulumi-docs:config',
    packageName: '@pulumi/pulumi',
    url: 'https://www.pulumi.com/docs/iac/concepts/config/'
  };

  const fetched = await fetchOfficialKnowledgeSource(source, {
    fetchedAt: '2026-05-06T00:00:00.000Z',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: name => name.toLowerCase() === 'content-type' ? 'text/markdown' : null
      },
      text: async () => '# Pulumi Config\n'
    })
  });

  assert.ok(fetched);
  assert.equal(fetched.staleAfter, '2026-06-05T00:00:00.000Z');
});
