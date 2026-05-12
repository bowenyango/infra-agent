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
import { buildHelmChartKnowledgeSources } from '../../src/domain/helm-chart-context.ts';
import { buildPulumiDocsKnowledgeSources } from '../../src/domain/pulumi-docs-context.ts';
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

const PULUMI_AWS_PACKAGE_MARKDOWN = [
  '# AWS',
  '',
  '## Modules',
  '',
  '| Module | Description |',
  '| --- | --- |',
  '| [s3](./s3/) | S3 resources for buckets and objects. |',
  '| [lambda](./lambda/) | Lambda resources manage functions. |',
  ''
].join('\n');

const PULUMI_BUCKET_RESOURCE_MARKDOWN = [
  '# Bucket',
  '',
  '## Inputs',
  '',
  '| Name | Type | Description |',
  '| --- | --- | --- |',
  '| `bucket` | string | Name of the bucket to create. |',
  '| `acl` | string | Canned ACL to apply to the bucket. |',
  '| `secretToken` | string | Secret token that must not become a reusable fact. |',
  ''
].join('\n');

const API_CHART_DOCS_MARKDOWN = [
  '# API chart',
  '',
  '| Parameter | Type | Default | Description | Required |',
  '| --- | --- | --- | --- | --- |',
  '| `image.repository` | string | `ghcr.io/example/api` | Container image repository. | yes |',
  '| `service.port` | int | `8080` | Service port exposed by the chart. | no |',
  ''
].join('\n');

test('knowledge pack command emits bounded fact pack JSON', async () => {
  const output = await captureStdout(() => main([
    'knowledge',
    'pack',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--max-facts',
    '4',
    '--json'
  ]));
  const pack = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(pack.kind, 'infra-agent.knowledge-pack');
  assert.equal(pack.schemaVersion, 1);
  assert.equal(pack.mutationAllowed, false);
  assert.match(pack.packId, /^[a-f0-9]{24}$/);
  assert.equal(pack.maxFacts, 4);
  assert.equal(pack.includedFactCount, Math.min(4, pack.factCount));
  assert.equal(pack.facts.length, pack.includedFactCount);
  const chartSchemaSource = pack.sources.find(source => source.kind === 'chart-schema');
  assert.ok(chartSchemaSource);
  assert.equal(chartSchemaSource.storagePolicy.scope, 'workspace-private');
  assert.equal(chartSchemaSource.storagePolicy.requiresExplicitOptIn, true);
  assert.equal(pack.storagePolicy.workspacePrivate, pack.sources.length);
  assert.equal(pack.storagePolicy.explicitOptInRequired, pack.sources.length);
  assert.ok(pack.facts.some(fact => fact.path === 'chart.payments-api.image.repository'));
  assert.ok(pack.facts.some(fact => fact.path === 'chart.payments-api.service.port'));
  assert.doesNotMatch(output, /"content"\s*:|replicaCount":\s*\{|"\$schema"/);
});

test('knowledge pack command emits Helm chart metadata and dependency facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-helm-metadata-cli-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        'dependencies:',
        '  - name: redis',
        '    version: 17.3.0',
        '    repository: https://charts.bitnami.com/bitnami',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'Chart.lock'),
      [
        'dependencies:',
        '  - name: redis',
        '    version: 17.3.1',
        '    repository: https://charts.bitnami.com/bitnami',
        'digest: sha256:abc123',
        'generated: "2026-04-28T00:00:00Z"',
        ''
      ].join('\n'),
      'utf8'
    );

    const output = await captureStdout(() => main([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'helm',
      '--target',
      'charts/api',
      '--max-facts',
      '6',
      '--json'
    ]));
    const pack = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(pack.kind, 'infra-agent.knowledge-pack');
    assert.equal(pack.mutationAllowed, false);
    assert.equal(pack.maxFacts, 6);
    assert.ok(pack.sources.some(source =>
      source.kind === 'chart-metadata'
      && source.targetPath === 'charts/api'
      && source.factCount > 0
    ));
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'chart-metadata'
      && fact.path === 'chart.api.metadata.version'
      && fact.values?.includes('0.2.0')
    ));
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'chart-dependency'
      && fact.path === 'chart.api.dependencies.redis'
      && fact.values?.includes('version=17.3.1')
      && fact.values?.includes('locked=true')
    ));
    assert.doesNotMatch(output, /"content"\s*:|apiVersion:\s*v2|digest:\s*sha256|generated:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack command emits focused Terraform provider schema facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-provider-schema-cli-'));

  try {
    await writeTerraformProviderSchemaWorkspace(tempRoot);

    const output = await captureStdout(() => main([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'terraform',
      '--target',
      'terraform/app',
      '--max-facts',
      '2',
      '--json'
    ]));
    const pack = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(pack.kind, 'infra-agent.knowledge-pack');
    assert.equal(pack.mutationAllowed, false);
    assert.equal(pack.maxFacts, 2);
    assert.ok(pack.sources.some(source =>
      source.kind === 'provider-schema'
      && source.targetPath === 'terraform/app'
    ));
    assert.ok(pack.facts.some(fact =>
      fact.extractionMethod === 'terraform-provider-schema'
      && fact.path === 'resource.aws_lb_listener_rule.listener_arn'
    ));
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'nested-block'
      && fact.path === 'resource.aws_lb_listener_rule.action'
    ));
    assert.doesNotMatch(output, /aws_instance|provider_schemas|"content"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack command emits Terraform local module facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-terraform-module-cli-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    const moduleRoot = join(terraformRoot, 'modules/queue-worker');
    await mkdir(moduleRoot, { recursive: true });
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
    await writeFile(
      join(moduleRoot, 'variables.tf'),
      [
        'variable "image_tag" {',
        '  type = string',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const output = await captureStdout(() => main([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'terraform',
      '--target',
      'terraform/app',
      '--max-facts',
      '2',
      '--json'
    ]));
    const pack = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(pack.kind, 'infra-agent.knowledge-pack');
    assert.equal(pack.mutationAllowed, false);
    assert.equal(pack.maxFacts, 2);
    assert.ok(pack.sources.some(source =>
      source.kind === 'terraform-module'
      && source.targetPath === 'terraform/app'
    ));
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'module-input'
      && fact.path === 'module.queue_worker.inputs.image_tag'
    ));
    assert.doesNotMatch(output, /variable "image_tag"|"content"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack command emits Pulumi config facts', async () => {
  const output = await captureStdout(() => main([
    'knowledge',
    'pack',
    'fixtures/sample-workspace',
    '--domain',
    'pulumi',
    '--target',
    'infra/payments-api',
    '--max-facts',
    '2',
    '--json'
  ]));
  const pack = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(pack.kind, 'infra-agent.knowledge-pack');
  assert.equal(pack.mutationAllowed, false);
  assert.equal(pack.maxFacts, 2);
  assert.ok(pack.sources.some(source =>
    source.kind === 'pulumi-config'
    && source.targetPath === 'infra/payments-api'
  ));
  assert.ok(pack.facts.some(fact =>
    fact.kind === 'pulumi-config-parameter'
    && fact.path === 'config.payments-api:imageTag'
  ));
  assert.doesNotMatch(output, /"content"\s*:|runtime:\s*yaml|imageTag:\s*latest/);
});

test('knowledge pack command emits cached Pulumi package docs facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-pulumi-package-docs-'));

  try {
    await cp(resolve('fixtures/sample-workspace'), tempRoot, { recursive: true });
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
      join(tempRoot, 'infra/payments-api/package.json'),
      `${JSON.stringify({
        dependencies: {
          '@pulumi/aws': '^7.0.0'
        }
      }, null, 2)}\n`,
      'utf8'
    );
    const inspection = await inspectWorkspace(tempRoot);
    const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === 'infra/payments-api');
    assert.ok(project);
    const source = (await buildPulumiDocsKnowledgeSources(inspection.workspaceRoot, project))
      .find(candidate => candidate.name === 'pulumi-docs:package:aws');
    assert.ok(source);
    const entry = await writeKnowledgeCacheEntry(inspection.knowledgeCache.root, {
      source,
      contentType: 'text/markdown',
      content: PULUMI_AWS_PACKAGE_MARKDOWN,
      fetchedAt: '2026-05-06T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });

    const output = await captureStdout(() => main([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'pulumi',
      '--target',
      'infra/payments-api',
      '--source',
      entry.id,
      '--max-facts',
      '3',
      '--json'
    ]));
    const pack = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(pack.kind, 'infra-agent.knowledge-pack');
    assert.equal(pack.mutationAllowed, false);
    assert.equal(pack.maxFacts, 3);
    assert.ok(pack.sources.some(sourceResult =>
      sourceResult.kind === 'pulumi-docs'
      && sourceResult.name === 'pulumi-docs:package:aws'
      && sourceResult.storagePolicy.scope === 'public-reference'
    ));
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'pulumi-docs-guidance'
      && fact.extractionMethod === 'pulumi-docs-markdown'
      && fact.path === 'pulumi.package.aws.s3'
      && fact.sourceLocator === 'Pulumi package docs: s3'
    ));
    assert.doesNotMatch(output, /"content"\s*:|# AWS|dependencies/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack command emits language-derived Pulumi resource docs facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-pulumi-language-docs-'));

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

    const inspection = await inspectWorkspace(tempRoot);
    const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === 'infra/api');
    assert.ok(project);
    const source = (await buildPulumiDocsKnowledgeSources(inspection.workspaceRoot, project))
      .find(candidate => candidate.name === 'pulumi-docs:resource:aws:s3/bucket');
    assert.ok(source);
    const entry = await writeKnowledgeCacheEntry(inspection.knowledgeCache.root, {
      source,
      contentType: 'text/markdown',
      content: PULUMI_BUCKET_RESOURCE_MARKDOWN,
      fetchedAt: '2026-05-06T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });

    const output = await captureStdout(() => main([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'pulumi',
      '--target',
      'infra/api',
      '--source',
      entry.id,
      '--max-facts',
      '2',
      '--json'
    ]));
    const pack = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(pack.kind, 'infra-agent.knowledge-pack');
    assert.equal(pack.mutationAllowed, false);
    assert.equal(pack.maxFacts, 2);
    assert.ok(pack.sources.some(sourceResult =>
      sourceResult.kind === 'pulumi-docs'
      && sourceResult.name === 'pulumi-docs:resource:aws:s3/bucket'
      && sourceResult.storagePolicy.scope === 'public-reference'
    ));
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'argument'
      && fact.extractionMethod === 'pulumi-docs-markdown'
      && fact.path === 'pulumi.resource.aws.s3.bucket.Bucket.bucket'
      && fact.sourceLocator === 'Pulumi resource docs: bucket'
    ));
    assert.doesNotMatch(output, /"content"\s*:|# Bucket|api-bucket|new aws\.s3\.Bucket|secretToken|Secret token/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack command emits Pulumi component facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-pulumi-component-'));

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
      'pack',
      tempRoot,
      '--domain',
      'pulumi',
      '--target',
      'infra/api',
      '--max-facts',
      '2',
      '--json'
    ]));
    const pack = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(pack.kind, 'infra-agent.knowledge-pack');
    assert.equal(pack.mutationAllowed, false);
    assert.equal(pack.maxFacts, 2);
    assert.ok(pack.sources.some(sourceResult =>
      sourceResult.kind === 'pulumi-component'
      && sourceResult.name === 'pulumi-component:infra/api:ApiService'
      && sourceResult.storagePolicy.scope === 'workspace-private'
      && sourceResult.fingerprintDigest
    ));
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'pulumi-component-input'
      && fact.path === 'component.ApiService.inputs.image'
    ));
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'pulumi-component-output'
      && fact.path === 'component.ApiService.outputs.endpoint'
    ));
    assert.doesNotMatch(output, /class ApiService|interface ApiServiceArgs|super\(|@pulumi\/pulumi|"content"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack command emits cached Helm chart docs facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-chart-docs-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
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
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        'home: https://charts.example.test/api/',
        ''
      ].join('\n'),
      'utf8'
    );
    const inspection = await inspectWorkspace(tempRoot);
    const chart = inspection.helmCharts.find(candidate => candidate.chartRoot === 'charts/api');
    assert.ok(chart);
    const source = (await buildHelmChartKnowledgeSources(inspection.workspaceRoot, chart))
      .find(candidate => candidate.kind === 'chart-docs' && candidate.name === 'api:home');
    assert.ok(source);
    const entry = await writeKnowledgeCacheEntry(inspection.knowledgeCache.root, {
      source,
      contentType: 'text/markdown',
      content: API_CHART_DOCS_MARKDOWN,
      fetchedAt: '2026-05-05T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });

    const output = await captureStdout(() => main([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'helm',
      '--target',
      'charts/api',
      '--source',
      entry.id,
      '--max-facts',
      '3',
      '--json'
    ]));
    const pack = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(pack.kind, 'infra-agent.knowledge-pack');
    assert.equal(pack.mutationAllowed, false);
    assert.equal(pack.maxFacts, 3);
    assert.ok(pack.sources.some(sourceResult =>
      sourceResult.kind === 'chart-docs'
      && sourceResult.name === 'api:home'
      && sourceResult.storagePolicy.scope === 'public-reference'
    ));
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'chart-value'
      && fact.extractionMethod === 'helm-chart-docs-markdown'
      && fact.path === 'chart.api.image.repository'
      && fact.sourceLocator === 'Chart docs: image.repository'
    ));
    assert.doesNotMatch(output, /"content"\s*:|# API chart|Secret token/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack command writes a bounded reusable artifact with --out', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-out-'));

  try {
    const outputPath = join(tempRoot, 'artifacts/knowledge-pack.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'pack',
      'fixtures/sample-workspace',
      '--domain',
      'helm',
      '--target',
      'charts/payments-api',
      '--max-facts',
      '4',
      '--out',
      outputPath,
      '--json'
    ]));
    const stdoutPack = JSON.parse(output.slice(output.indexOf('{')));
    const artifact = JSON.parse(await readFile(outputPath, 'utf8'));
    const validationOutput = await captureStdout(() => main([
      'knowledge',
      'validate',
      outputPath,
      '--json'
    ]));
    const validation = JSON.parse(validationOutput.slice(validationOutput.indexOf('{')));

    assert.equal(stdoutPack.kind, 'infra-agent.knowledge-pack');
    assert.equal(stdoutPack.outputPath, outputPath);
    assert.equal(artifact.kind, 'infra-agent.knowledge-pack');
    assert.equal(artifact.outputPath, undefined);
    assert.equal(artifact.packId, stdoutPack.packId);
    assert.equal(artifact.maxFacts, 4);
    assert.equal(artifact.facts.length, artifact.includedFactCount);
    assert.equal(validation.inputKind, 'infra-agent.knowledge-pack');
    assert.equal(validation.valid, true);
    assert.equal(validation.factSetCount, artifact.factSetCount);
    assert.equal(validation.factCount, artifact.factCount);
    assert.doesNotMatch(JSON.stringify(artifact), /"content"\s*:|replicaCount":\s*\{|"\$schema"/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack command writes an artifact manifest for publication planning', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-manifest-'));

  try {
    const outputPath = join(tempRoot, 'artifacts/knowledge-pack.json');
    const manifestPath = join(tempRoot, 'artifacts/knowledge-pack.manifest.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'pack',
      'fixtures/sample-workspace',
      '--domain',
      'helm',
      '--target',
      'charts/payments-api',
      '--max-facts',
      '4',
      '--out',
      outputPath,
      '--manifest-out',
      manifestPath,
      '--json'
    ]));
    const stdoutPack = JSON.parse(output.slice(output.indexOf('{')));
    const artifact = JSON.parse(await readFile(outputPath, 'utf8'));
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const validationOutput = await captureStdout(() => main([
      'knowledge',
      'validate',
      manifestPath,
      '--json'
    ]));
    const validation = JSON.parse(validationOutput.slice(validationOutput.indexOf('{')));

    assert.equal(stdoutPack.outputPath, outputPath);
    assert.equal(stdoutPack.manifestPath, manifestPath);
    assert.equal(manifest.kind, 'infra-agent.knowledge-artifact-manifest');
    assert.equal(manifest.artifact.kind, 'infra-agent.knowledge-pack');
    assert.equal(manifest.artifact.id, artifact.packId);
    assert.equal(manifest.artifact.path, outputPath);
    assert.match(manifest.artifact.sha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(manifest.artifact.sourceIds, artifact.sources.map(source => source.id));
    assert.equal(manifest.artifact.unitCount, artifact.unitCount);
    assert.equal(manifest.artifact.storagePolicy.workspacePrivate, artifact.storagePolicy.workspacePrivate);
    assert.equal(manifest.publication.executionMode, 'plan-only');
    assert.equal(manifest.publication.remoteWriteAllowed, false);
    assert.equal(manifest.publication.credentialRequired, false);
    assert.equal(manifest.publication.uploadCommand, null);
    assert.equal(manifest.publication.defaultStore, 'local-only');
    assert.equal(manifest.publication.requiresExplicitOptIn, true);
    assert.deepEqual(manifest.publication.publishableByDefaultSourceIds, []);
    assert.ok(manifest.publication.blockedSources.length >= 1);
    assert.ok(manifest.publication.requiredValidations.some(command => command.includes(outputPath)));
    assert.equal(validation.inputKind, 'infra-agent.knowledge-artifact-manifest');
    assert.equal(validation.valid, true);
    assert.equal(validation.factCount, artifact.factCount);
    assert.equal(validation.unitCount, artifact.unitCount);
    assert.doesNotMatch(JSON.stringify(manifest), /"content"\s*:|replicaCount":\s*\{|"\$schema"/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge validate command rejects forged pack JSON files', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-validate-forged-'));
  const previousExitCode = process.exitCode;

  try {
    process.exitCode = undefined;
    const outputPath = join(tempRoot, 'knowledge-pack.json');
    await captureStdout(() => main([
      'knowledge',
      'pack',
      'fixtures/sample-workspace',
      '--domain',
      'helm',
      '--target',
      'charts/payments-api',
      '--max-facts',
      '4',
      '--out',
      outputPath,
      '--json'
    ]));
    const artifact = JSON.parse(await readFile(outputPath, 'utf8'));
    await writeFile(outputPath, JSON.stringify({
      ...artifact,
      includedFactCount: artifact.includedFactCount + 1,
      sources: [{
        ...artifact.sources[0],
        storagePolicy: {
          scope: 'public-reference',
          defaultStore: 'local-or-explicit-team-cache',
          shareableByDefault: true,
          requiresExplicitOptIn: false,
          reason: 'Forged public posture.'
        }
      }],
      facts: [{
        ...artifact.facts[0],
        sourceId: 'forged-source'
      }]
    }, null, 2));

    const validationOutput = await captureStdout(() => main([
      'knowledge',
      'validate',
      outputPath,
      '--json'
    ]));
    const validation = JSON.parse(validationOutput.slice(validationOutput.indexOf('{')));

    assert.equal(validation.inputKind, 'infra-agent.knowledge-pack');
    assert.equal(validation.valid, false);
    assert.equal(process.exitCode, 1);
    assert.ok(validation.issues.some(issue => issue.path === '$.includedFactCount'));
    assert.ok(validation.issues.some(issue => issue.path === '$.sources[0].storagePolicy'));
    assert.ok(validation.issues.some(issue => issue.path === '$.facts[0].sourceId'));
  } finally {
    process.exitCode = previousExitCode;
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge validate command rejects manifests when referenced artifacts drift', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-manifest-drift-cli-'));
  const previousExitCode = process.exitCode;

  try {
    process.exitCode = undefined;
    const outputPath = join(tempRoot, 'knowledge-pack.json');
    const manifestPath = join(tempRoot, 'knowledge-pack.manifest.json');
    await captureStdout(() => main([
      'knowledge',
      'pack',
      'fixtures/sample-workspace',
      '--domain',
      'helm',
      '--target',
      'charts/payments-api',
      '--max-facts',
      '4',
      '--out',
      outputPath,
      '--manifest-out',
      manifestPath,
      '--json'
    ]));
    const artifact = await readFile(outputPath, 'utf8');
    await writeFile(outputPath, `${artifact}\n`, 'utf8');

    const validationOutput = await captureStdout(() => main([
      'knowledge',
      'validate',
      manifestPath,
      '--json'
    ]));
    const validation = JSON.parse(validationOutput.slice(validationOutput.indexOf('{')));

    assert.equal(validation.inputKind, 'infra-agent.knowledge-artifact-manifest');
    assert.equal(validation.valid, false);
    assert.equal(process.exitCode, 1);
    assert.ok(validation.issues.some(issue => issue.path === '$.artifact.sha256'));
  } finally {
    process.exitCode = previousExitCode;
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge validate command rejects stale pack local fingerprints with workspace', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-stale-cli-'));
  const previousExitCode = process.exitCode;

  try {
    process.exitCode = undefined;
    const workspaceRoot = join(tempRoot, 'workspace');
    const outputPath = join(tempRoot, 'knowledge-pack.json');
    await cp('fixtures/sample-workspace', workspaceRoot, { recursive: true });
    await captureStdout(() => main([
      'knowledge',
      'pack',
      workspaceRoot,
      '--domain',
      'helm',
      '--target',
      'charts/payments-api',
      '--max-facts',
      '4',
      '--out',
      outputPath,
      '--json'
    ]));
    const chartPath = join(workspaceRoot, 'charts/payments-api/Chart.yaml');
    const chartContent = await readFile(chartPath, 'utf8');
    await writeFile(chartPath, `${chartContent}\n# drift\n`, 'utf8');

    const validationOutput = await captureStdout(() => main([
      'knowledge',
      'validate',
      outputPath,
      '--workspace',
      workspaceRoot,
      '--json'
    ]));
    const validation = JSON.parse(validationOutput.slice(validationOutput.indexOf('{')));

    assert.equal(validation.inputKind, 'infra-agent.knowledge-pack');
    assert.equal(validation.valid, false);
    assert.equal(process.exitCode, 1);
    assert.ok(validation.freshness.staleSources.some(source =>
      source.sourceKind === 'chart-metadata'
      && source.staleReason === 'local-file-hash-mismatch'
      && source.stalePaths.includes('charts/payments-api/Chart.yaml')
    ));
    assert.ok(validation.issues.some(issue =>
      issue.path.startsWith('$.sources[')
      && /local-file-hash-mismatch/.test(issue.message)
    ));

    process.exitCode = undefined;
    const validationText = await captureStdout(() => main([
      'knowledge',
      'validate',
      outputPath,
      '--workspace',
      workspaceRoot
    ]));
    assert.match(validationText, /Source freshness/);
    assert.match(validationText, /stale chart-metadata payments-api:Chart\.yaml/);
    assert.match(validationText, /changed=charts\/payments-api\/Chart\.yaml/);
    assert.doesNotMatch(validationText, /contentHash|sha256|apiVersion:\s*v2|replicaCount/);
  } finally {
    process.exitCode = previousExitCode;
    await rm(tempRoot, { recursive: true, force: true });
  }
});
