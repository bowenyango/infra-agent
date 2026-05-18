import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  cp,
  mkdir,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  resolve,
  join
} from 'node:path';
import { captureStdout } from '../support/capture-stdout.mjs';
import {
  buildCompactHandoffBudgetsFixture,
  buildEmptyKnowledgeFactsFixture,
  buildEmptyApprovalGrantsFixture,
  buildEmptyApprovalPendingScopeFixture
} from '../support/compact-fixtures.mjs';
import { writeTerraformProviderSchemaWorkspace } from '../support/terraform-provider-schema-workspace.mjs';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { buildRunPreflight } from '../../src/agent/build-run-preflight.ts';
import { printDoctorReport } from '../../src/cli/output.ts';
import {
  buildLLMClientConfigOverrides,
  main,
  parseArgs,
  readPackageVersion
} from '../../src/cli/main.ts';
import { buildDoctorReport } from '../../src/cli/doctor.ts';
import { buildPlannerProviderCatalogDiscovery } from '../../src/cli/planner-provider-catalog.ts';
import { parsePlannerProviderCatalogReport } from '../../src/cli/planner-provider-catalog-contract.ts';
import {
  exitCodeForAgentOutcome,
  exitCodeForRunPreflight,
  INFRA_AGENT_EXIT_CODES
} from '../../src/cli/exit-codes.ts';
import { writeKnowledgeCacheEntry } from '../../src/knowledge/cache.ts';
import { extractWorkspaceKnowledgeFacts } from '../../src/knowledge/extract.ts';
import { buildKnowledgeSourcesReport } from '../../src/knowledge/sources.ts';

test('knowledge sources command emits read-only source listing JSON', async () => {
  const output = await captureStdout(() => main([
    'knowledge',
    'sources',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--json'
  ]));
  const report = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(report.kind, 'infra-agent.knowledge-sources');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mutationAllowed, false);
  assert.deepEqual(report.requestedDomains, ['helm']);
  assert.deepEqual(report.targetPaths, ['charts/payments-api']);
  assert.equal(report.sourceCount, report.sources.length);
  const chartMetadataSource = report.sources.find(source =>
    source.domain === 'helm'
    && source.targetPath === 'charts/payments-api'
    && source.id
    && source.requiresFetch === false
    && source.source.kind === 'chart-metadata'
    && source.source.localPath === 'charts/payments-api/Chart.yaml'
    && source.source.module === 'charts/payments-api'
  );
  assert.ok(chartMetadataSource);
  assert.equal(chartMetadataSource.storagePolicy.scope, 'workspace-private');
  assert.equal(chartMetadataSource.storagePolicy.defaultStore, 'local-only');
  assert.equal(chartMetadataSource.storagePolicy.shareableByDefault, false);
  assert.equal(chartMetadataSource.storagePolicy.requiresExplicitOptIn, true);
  assert.ok(report.sources.some(source =>
    source.domain === 'helm'
    && source.targetPath === 'charts/payments-api'
    && source.id
    && source.requiresFetch === false
    && source.source.kind === 'chart-schema'
  ));
  assert.ok(report.summary.local >= 1);
  assert.ok(report.summary.storagePolicy.workspacePrivate >= 1);
  assert.ok(report.summary.storagePolicy.explicitOptInRequired >= 1);
  assert.doesNotMatch(output, /contentHash|fetchedAt|# Values|replicaCount:/);
});

test('knowledge sources command lists Terraform local module sources', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-sources-terraform-module-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    await mkdir(join(terraformRoot, 'modules/queue-worker'), { recursive: true });
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'module "queue_worker" {',
        '  source = "./modules/queue-worker"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const output = await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'terraform',
      '--target',
      'terraform/app',
      '--json'
    ]));
    const report = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(report.kind, 'infra-agent.knowledge-sources');
    assert.equal(report.mutationAllowed, false);
    assert.ok(report.sources.some(source =>
      source.domain === 'terraform'
      && source.targetPath === 'terraform/app'
      && source.requiresFetch === false
      && source.source.kind === 'terraform-module'
      && source.source.localPath === 'terraform/app/modules/queue-worker'
    ));
    assert.ok(report.summary.local >= 1);
    assert.doesNotMatch(output, /variable "image_tag"|"content"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge sources command lists Pulumi config sources', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-sources-pulumi-'));

  try {
    await cp('fixtures/sample-workspace', tempRoot, { recursive: true });
    await writeFile(
      join(tempRoot, 'infra/payments-api/package.json'),
      `${JSON.stringify({
        dependencies: {
          '@pulumi/pulumi': '^3.118.0',
          '@pulumi/aws': '^7.0.0'
        }
      }, null, 2)}\n`,
      'utf8'
    );
    const projectFilePath = join(tempRoot, 'infra/payments-api/Pulumi.yaml');
    const projectContent = await readFile(projectFilePath, 'utf8');
    await writeFile(
      projectFilePath,
      projectContent.replace('resources: {}', [
        'resources:',
        '  apiBucket:',
        '    type: aws:s3/bucket:Bucket'
      ].join('\n')),
      'utf8'
    );

    const output = await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'pulumi',
      '--target',
      'infra/payments-api',
      '--json'
    ]));
    const report = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(report.kind, 'infra-agent.knowledge-sources');
    assert.equal(report.mutationAllowed, false);
    assert.deepEqual(report.requestedDomains, ['pulumi']);
    assert.deepEqual(report.targetPaths, ['infra/payments-api']);
    assert.ok(report.sources.some(source =>
      source.domain === 'pulumi'
      && source.targetPath === 'infra/payments-api'
      && source.requiresFetch === false
      && source.source.kind === 'pulumi-config'
      && source.source.localPath === 'infra/payments-api'
      && source.source.packageName === 'payments-api'
    ));
    const docsSource = report.sources.find(source =>
      source.domain === 'pulumi'
      && source.targetPath === 'infra/payments-api'
      && source.requiresFetch === true
      && source.source.kind === 'pulumi-docs'
      && source.source.name === 'pulumi-docs:config'
    );
    assert.ok(docsSource);
    assert.equal(docsSource.storagePolicy.scope, 'public-reference');
    assert.equal(docsSource.storagePolicy.shareableByDefault, true);
    assert.ok(report.sources.some(source =>
      source.domain === 'pulumi'
      && source.targetPath === 'infra/payments-api'
      && source.requiresFetch === true
      && source.source.kind === 'pulumi-docs'
      && source.source.name === 'pulumi-docs:package:aws'
      && source.source.packageName === '@pulumi/aws'
      && source.source.version === '^7.0.0'
      && source.source.url === 'https://www.pulumi.com/registry/packages/aws/api-docs/'
      && source.storagePolicy.scope === 'public-reference'
    ));
    assert.ok(report.sources.some(source =>
      source.domain === 'pulumi'
      && source.targetPath === 'infra/payments-api'
      && source.requiresFetch === true
      && source.source.kind === 'pulumi-docs'
      && source.source.name === 'pulumi-docs:resource:aws:s3/bucket'
      && source.source.packageName === '@pulumi/aws'
      && source.source.module === 'aws:s3/bucket:Bucket'
      && source.source.version === '^7.0.0'
      && source.source.url === 'https://www.pulumi.com/registry/packages/aws/api-docs/s3/bucket/'
      && source.storagePolicy.scope === 'public-reference'
    ));
    assert.ok(report.summary.local >= 1);
    assert.ok(report.summary.external >= 3);
    assert.doesNotMatch(output, /imageTag:\s*latest|runtime:\s*yaml|"content"\s*:|"dependencies"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge sources command lists Pulumi resource docs from language tokens', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-sources-pulumi-language-'));

  try {
    const projectRoot = join(tempRoot, 'infra/api');
    await mkdir(projectRoot, { recursive: true });
    await writeFile(
      join(projectRoot, 'Pulumi.yaml'),
      [
        'name: api',
        'runtime: nodejs',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(projectRoot, 'package.json'),
      `${JSON.stringify({
        dependencies: {
          '@pulumi/aws': '^7.0.0'
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

    const output = await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'pulumi',
      '--target',
      'infra/api',
      '--json'
    ]));
    const report = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(report.kind, 'infra-agent.knowledge-sources');
    assert.equal(report.mutationAllowed, false);
    assert.ok(report.sources.some(source =>
      source.domain === 'pulumi'
      && source.targetPath === 'infra/api'
      && source.requiresFetch === true
      && source.source.kind === 'pulumi-docs'
      && source.source.name === 'pulumi-docs:resource:aws:s3/bucket'
      && source.source.packageName === '@pulumi/aws'
      && source.source.module === 'aws:s3/bucket:Bucket'
      && source.source.version === '^7.0.0'
      && source.source.url === 'https://www.pulumi.com/registry/packages/aws/api-docs/s3/bucket/'
      && source.storagePolicy.scope === 'public-reference'
      && source.storagePolicy.shareableByDefault === true
    ));
    assert.doesNotMatch(output, /api-bucket|new aws\.s3\.Bucket|"content"\s*:/);

    const resourceOutput = await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'pulumi',
      '--resource',
      'aws:s3/bucket:Bucket',
      '--json'
    ]));
    const resourceReport = JSON.parse(resourceOutput.slice(resourceOutput.indexOf('{')));

    assert.equal(resourceReport.kind, 'infra-agent.knowledge-sources');
    assert.equal(resourceReport.resource, 'aws:s3/bucket:Bucket');
    assert.deepEqual(resourceReport.requestedDomains, ['pulumi']);
    assert.deepEqual(resourceReport.targetPaths, ['infra/api']);
    assert.ok(resourceReport.sources.every(source =>
      source.domain === 'pulumi'
      && source.targetPath === 'infra/api'
    ));
    assert.ok(resourceReport.sources.some(source =>
      source.requiresFetch === true
      && source.source.kind === 'pulumi-docs'
      && source.source.name === 'pulumi-docs:resource:aws:s3/bucket'
      && source.source.module === 'aws:s3/bucket:Bucket'
    ));
    assert.doesNotMatch(resourceOutput, /api-bucket|new aws\.s3\.Bucket|"content"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge sources resource misses do not fall back to all workspace targets', async () => {
  const output = await captureStdout(() => main([
    'knowledge',
    'sources',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--resource',
    'chart:missing',
    '--json'
  ]));
  const report = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(report.kind, 'infra-agent.knowledge-sources');
  assert.equal(report.resource, 'chart:missing');
  assert.deepEqual(report.requestedDomains, ['helm']);
  assert.deepEqual(report.targetPaths, []);
  assert.equal(report.sourceCount, 0);
  assert.deepEqual(report.sources, []);
  assert.doesNotMatch(output, /charts\/payments-api|replicaCount|"\$schema"/);
});

test('knowledge sources command lists Pulumi component sources without raw source content', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-sources-pulumi-component-'));

  try {
    const projectRoot = join(tempRoot, 'infra/api');
    await mkdir(projectRoot, { recursive: true });
    await writeFile(
      join(projectRoot, 'Pulumi.yaml'),
      [
        'name: api',
        'runtime: nodejs',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(projectRoot, 'components.ts'),
      [
        'import * as pulumi from "@pulumi/pulumi";',
        'interface ApiServiceArgs {',
        '  image: string;',
        '}',
        'class ApiService extends pulumi.ComponentResource {',
        '  public readonly endpoint: string;',
        '  constructor(name: string, args: ApiServiceArgs) {',
        '    super("pkg:index:ApiService", name, {}, undefined);',
        '  }',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const output = await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'pulumi',
      '--target',
      'infra/api',
      '--json'
    ]));
    const report = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(report.kind, 'infra-agent.knowledge-sources');
    assert.equal(report.mutationAllowed, false);
    const componentSource = report.sources.find(source =>
      source.domain === 'pulumi'
      && source.targetPath === 'infra/api'
      && source.requiresFetch === false
      && source.source.kind === 'pulumi-component'
      && source.source.name === 'pulumi-component:infra/api:ApiService'
    );
    assert.ok(componentSource);
    assert.equal(componentSource.source.localPath, 'infra/api/components.ts');
    assert.equal(componentSource.source.module, 'infra/api');
    assert.equal(componentSource.source.packageName, 'ApiService');
    assert.equal(componentSource.storagePolicy.scope, 'workspace-private');
    assert.equal(componentSource.storagePolicy.defaultStore, 'local-only');
    assert.equal(componentSource.storagePolicy.requiresExplicitOptIn, true);
    assert.ok(report.summary.local >= 1);
    assert.doesNotMatch(output, /class ApiService|interface ApiServiceArgs|super\(|@pulumi\/pulumi|"content"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge sources command reports public-doc cache freshness in JSON and text', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-sources-cache-'));

  try {
    const projectRoot = join(tempRoot, 'infra/api');
    await mkdir(projectRoot, { recursive: true });
    await writeFile(
      join(tempRoot, 'infra-agent.config.json'),
      JSON.stringify({
        knowledgeCache: {
          root: '.infra-agent/knowledge-cache'
        }
      }, null, 2),
      'utf8'
    );
    await writeFile(
      join(projectRoot, 'Pulumi.yaml'),
      [
        'name: api',
        'runtime: nodejs',
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
    const sourceReport = await buildKnowledgeSourcesReport(inspection, {
      domains: ['pulumi'],
      targetPaths: ['infra/api']
    });
    const packageSource = sourceReport.sources.find(source =>
      source.source.name === 'pulumi-docs:package:aws'
    )?.source;
    const resourceSource = sourceReport.sources.find(source =>
      source.source.name === 'pulumi-docs:resource:aws:s3/bucket'
    )?.source;
    assert.ok(packageSource);
    assert.ok(resourceSource);

    await writeKnowledgeCacheEntry(inspection.knowledgeCache.root, {
      source: packageSource,
      contentType: 'text/markdown',
      content: '# PACKAGE CACHE CONTENT MUST NOT LEAK',
      fetchedAt: '2026-05-01T00:00:00.000Z',
      staleAfter: '2099-01-01T00:00:00.000Z'
    });
    await writeKnowledgeCacheEntry(inspection.knowledgeCache.root, {
      source: resourceSource,
      contentType: 'text/markdown',
      content: '# RESOURCE CACHE CONTENT MUST NOT LEAK',
      fetchedAt: '2026-05-01T00:00:00.000Z',
      staleAfter: '2000-01-01T00:00:00.000Z'
    });

    const jsonOutput = await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'pulumi',
      '--target',
      'infra/api',
      '--json'
    ]));
    const jsonReport = JSON.parse(jsonOutput.slice(jsonOutput.indexOf('{')));
    const byName = new Map(jsonReport.sources.map(source => [source.source.name, source]));

    assert.equal(byName.get('pulumi-docs:package:aws')?.cacheStatus, 'fresh');
    assert.equal(byName.get('pulumi-docs:resource:aws:s3/bucket')?.cacheStatus, 'stale');
    assert.equal(byName.get('pulumi-docs:package:kubernetes')?.cacheStatus, 'missing');
    assert.equal(jsonReport.summary.cacheStatus.fresh, 1);
    assert.equal(jsonReport.summary.cacheStatus.stale, 1);
    assert.ok(jsonReport.summary.cacheStatus.missing >= 1);
    assert.equal(
      jsonReport.summary.cacheStatus.refreshRecommended,
      jsonReport.summary.cacheStatus.stale + jsonReport.summary.cacheStatus.missing
    );
    assert.doesNotMatch(jsonOutput, /CACHE CONTENT MUST NOT LEAK|contentHash|fetchedAt/);

    const textOutput = await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'pulumi',
      '--target',
      'infra/api'
    ]));

    assert.match(textOutput, /cache: fresh=1, stale=1, missing=\d+, refresh-recommended=\d+/);
    assert.match(textOutput, /pulumi-docs:package:aws.*cache=fresh/);
    assert.match(textOutput, /pulumi-docs:resource:aws:s3\/bucket.*cache=stale, refresh=prefetch recommended/);
    assert.match(textOutput, /pulumi-docs:package:kubernetes.*cache=missing, refresh=prefetch recommended/);
    assert.doesNotMatch(textOutput, /CACHE CONTENT MUST NOT LEAK|contentHash|fetchedAt/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge prefetch command emits existing prefetch JSON contract', async () => {
  const output = await captureStdout(() => main([
    'knowledge',
    'prefetch',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--max-sources',
    '1',
    '--json'
  ]));
  const result = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(result.kind, 'infra-agent.knowledge-prefetch');
  assert.equal(result.schemaVersion, 1);
  assert.deepEqual(result.requestedDomains, ['helm']);
  assert.deepEqual(result.targetPaths, ['charts/payments-api']);
  assert.equal(result.maxSources, 1);
  assert.ok(result.summary.previousCacheStatus.local >= 1);
  assert.ok(result.sources.some(source =>
    source.domain === 'helm'
    && source.targetPath === 'charts/payments-api'
    && source.status === 'local'
    && source.previousCacheStatus === 'local'
    && source.source.kind === 'chart-schema'
  ));

  const textOutput = await captureStdout(() => main([
    'knowledge',
    'prefetch',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--max-sources',
    '1'
  ]));

  assert.match(textOutput, /previous cache: fresh=\d+, stale=\d+, missing=\d+, local=\d+/);
  assert.match(textOutput, /previous-cache=local/);
});
