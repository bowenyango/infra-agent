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
import { buildHelmChartKnowledgeSources } from '../../src/domain/helm-chart-context.ts';
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
  '',
  '## Example Values',
  '',
  '```yaml',
  'image:',
  '  repository: ghcr.io/example/api',
  '```',
  '',
  '## Best Practices',
  '',
  'Always set image.repository explicitly before rendering this chart.',
  '',
  '## Upgrade Workflow',
  '',
  '1. Update the image repository in the environment values file.',
  '2. Render the chart with helm template.',
  '3. Review the changed Deployment image before merging.',
  '',
  '## Troubleshooting',
  '',
  '`Error: image.repository is required` usually means the values file omitted the image repository.',
  '',
  '- Check values.yaml and environment override files.',
  '- Run helm template for the selected chart.',
  ''
].join('\n');

test('knowledge extract command emits cache-first fact sets as JSON', async () => {
  const output = await captureStdout(() => main([
    'knowledge',
    'extract',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--json'
  ]));
  const report = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(report.kind, 'infra-agent.knowledge-extraction');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mutationAllowed, false);
  assert.deepEqual(report.requestedDomains, ['helm']);
  assert.deepEqual(report.targetPaths, ['charts/payments-api']);
  assert.equal(report.sourceCount, report.sources.length);
  assert.equal(report.factSetCount, report.factSets.length);
  assert.ok(report.factCount >= 5);
  assert.ok(report.sources.some(source =>
    source.source.kind === 'chart-schema'
    && source.status === 'extracted'
    && source.factCount > 0
  ));
  assert.ok(report.sources.some(source =>
    source.source.kind === 'chart-metadata'
    && source.status === 'extracted'
    && source.factCount > 0
  ));
  assert.ok(report.factSets.some(factSet =>
    factSet.kind === 'infra-agent.knowledge-facts'
    && factSet.source.kind === 'chart-schema'
    && factSet.facts.some(fact => fact.path === 'chart.payments-api.service.port')
  ));
  assert.ok(report.factSets.some(factSet =>
    factSet.kind === 'infra-agent.knowledge-facts'
    && factSet.source.kind === 'chart-metadata'
    && factSet.facts.some(fact =>
      fact.kind === 'chart-metadata'
      && fact.path === 'chart.payments-api.metadata.version'
      && fact.values?.includes('0.1.0')
    )
  ));
  assert.doesNotMatch(output, /"content"\s*:|replicaCount":\s*\{|"\$schema"|apiVersion:\s*v2/);
});

test('knowledge extract command emits Terraform local module facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-extract-terraform-module-'));

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
      'extract',
      tempRoot,
      '--domain',
      'terraform',
      '--target',
      'terraform/app',
      '--json'
    ]));
    const report = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(report.kind, 'infra-agent.knowledge-extraction');
    assert.equal(report.mutationAllowed, false);
    assert.ok(report.sources.some(source =>
      source.source.kind === 'terraform-module'
      && source.status === 'extracted'
      && source.factCount > 0
    ));
    assert.ok(report.factSets.some(factSet =>
      factSet.source.kind === 'terraform-module'
      && factSet.facts.some(fact =>
        fact.kind === 'module-input'
        && fact.path === 'module.queue_worker.inputs.image_tag'
        && fact.required === true
      )
    ));
    assert.doesNotMatch(output, /variable "image_tag"|"content"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge extract command emits Pulumi config facts', async () => {
  const output = await captureStdout(() => main([
    'knowledge',
    'extract',
    'fixtures/sample-workspace',
    '--domain',
    'pulumi',
    '--target',
    'infra/payments-api',
    '--json'
  ]));
  const report = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(report.kind, 'infra-agent.knowledge-extraction');
  assert.equal(report.mutationAllowed, false);
  assert.deepEqual(report.requestedDomains, ['pulumi']);
  assert.deepEqual(report.targetPaths, ['infra/payments-api']);
  assert.ok(report.sources.some(source =>
    source.source.kind === 'pulumi-config'
    && source.status === 'extracted'
    && source.factCount > 0
  ));
  assert.ok(report.factSets.some(factSet =>
    factSet.source.kind === 'pulumi-config'
    && factSet.facts.some(fact =>
      fact.kind === 'pulumi-config-parameter'
      && fact.path === 'config.payments-api:imageTag'
      && fact.values?.includes('latest')
    )
  ));
  assert.doesNotMatch(output, /"content"\s*:|runtime:\s*yaml|imageTag:\s*latest/);
});

test('knowledge extract command emits cached Pulumi docs facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-extract-pulumi-docs-'));

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
    const inspection = await inspectWorkspace(tempRoot);
    const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === 'infra/payments-api');
    assert.ok(project);
    const source = (await buildPulumiDocsKnowledgeSources(inspection.workspaceRoot, project))
      .find(candidate => candidate.name === 'pulumi-docs:config');
    assert.ok(source);
    const entry = await writeKnowledgeCacheEntry(inspection.knowledgeCache.root, {
      source,
      contentType: 'text/markdown',
      content: [
        '# Configuration',
        '',
        '- `pulumi config set` - Sets a stack configuration value.',
        '- `pulumi config get` - Reads a stack configuration value.',
        ''
      ].join('\n'),
      fetchedAt: '2026-05-06T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });

    const output = await captureStdout(() => main([
      'knowledge',
      'extract',
      tempRoot,
      '--domain',
      'pulumi',
      '--target',
      'infra/payments-api',
      '--source',
      entry.id,
      '--json'
    ]));
    const report = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(report.kind, 'infra-agent.knowledge-extraction');
    assert.equal(report.mutationAllowed, false);
    assert.ok(report.sources.some(result =>
      result.source.kind === 'pulumi-docs'
      && result.status === 'extracted'
      && result.factCount > 0
    ));
    assert.ok(report.factSets.some(factSet =>
      factSet.source.kind === 'pulumi-docs'
      && factSet.facts.some(fact =>
        fact.kind === 'pulumi-docs-guidance'
        && fact.extractionMethod === 'pulumi-docs-markdown'
        && fact.path === 'pulumi.docs.config.pulumi_config_set'
      )
    ));
    assert.doesNotMatch(output, /"content"\s*:|# Configuration/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge extract command emits cached Pulumi package docs facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-extract-pulumi-package-docs-'));

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
      'extract',
      tempRoot,
      '--domain',
      'pulumi',
      '--target',
      'infra/payments-api',
      '--source',
      entry.id,
      '--json'
    ]));
    const report = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(report.kind, 'infra-agent.knowledge-extraction');
    assert.equal(report.mutationAllowed, false);
    assert.ok(report.sources.some(result =>
      result.source.kind === 'pulumi-docs'
      && result.source.name === 'pulumi-docs:package:aws'
      && result.status === 'extracted'
      && result.factCount > 0
    ));
    assert.ok(report.factSets.some(factSet =>
      factSet.source.kind === 'pulumi-docs'
      && factSet.facts.some(fact =>
        fact.kind === 'pulumi-docs-guidance'
        && fact.extractionMethod === 'pulumi-docs-markdown'
        && fact.path === 'pulumi.package.aws.s3'
      )
    ));
    assert.doesNotMatch(output, /"content"\s*:|# AWS|dependencies/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge extract command emits language-derived Pulumi resource docs facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-extract-pulumi-language-docs-'));

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
      'extract',
      tempRoot,
      '--domain',
      'pulumi',
      '--target',
      'infra/api',
      '--source',
      entry.id,
      '--json'
    ]));
    const report = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(report.kind, 'infra-agent.knowledge-extraction');
    assert.equal(report.mutationAllowed, false);
    assert.ok(report.sources.some(result =>
      result.source.kind === 'pulumi-docs'
      && result.source.name === 'pulumi-docs:resource:aws:s3/bucket'
      && result.status === 'extracted'
      && result.factCount > 0
    ));
    assert.ok(report.factSets.some(factSet =>
      factSet.source.kind === 'pulumi-docs'
      && factSet.facts.some(fact =>
        fact.kind === 'argument'
        && fact.extractionMethod === 'pulumi-docs-markdown'
        && fact.path === 'pulumi.resource.aws.s3.bucket.Bucket.bucket'
        && fact.type === 'string'
      )
    ));
    assert.doesNotMatch(output, /"content"\s*:|# Bucket|api-bucket|new aws\.s3\.Bucket|secretToken|Secret token/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge extract command emits Pulumi component facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-extract-pulumi-component-'));

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
      'extract',
      tempRoot,
      '--domain',
      'pulumi',
      '--target',
      'infra/api',
      '--json'
    ]));
    const report = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(report.kind, 'infra-agent.knowledge-extraction');
    assert.equal(report.mutationAllowed, false);
    assert.ok(report.sources.some(result =>
      result.source.kind === 'pulumi-component'
      && result.status === 'extracted'
      && result.factCount > 0
    ));
    assert.ok(report.factSets.some(factSet =>
      factSet.source.kind === 'pulumi-component'
      && factSet.sourceFingerprint?.fileCount === 1
      && factSet.facts.some(fact =>
        fact.kind === 'pulumi-component-input'
        && fact.path === 'component.ApiService.inputs.image'
      )
      && factSet.facts.some(fact =>
        fact.kind === 'pulumi-component-output'
        && fact.path === 'component.ApiService.outputs.endpoint'
      )
    ));
    assert.doesNotMatch(output, /class ApiService|interface ApiServiceArgs|super\(|@pulumi\/pulumi|"content"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge extract command emits cached Helm chart docs facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-extract-chart-docs-'));

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
      'extract',
      tempRoot,
      '--domain',
      'helm',
      '--target',
      'charts/api',
      '--source',
      entry.id,
      '--json'
    ]));
    const report = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(report.kind, 'infra-agent.knowledge-extraction');
    assert.equal(report.mutationAllowed, false);
    assert.ok(report.sources.some(result =>
      result.source.kind === 'chart-docs'
      && result.source.name === 'api:home'
      && result.status === 'extracted'
      && result.factCount > 0
    ));
    assert.ok(report.factSets.some(factSet =>
      factSet.source.kind === 'chart-docs'
      && factSet.facts.some(fact =>
        fact.kind === 'chart-value'
        && fact.extractionMethod === 'helm-chart-docs-markdown'
        && fact.path === 'chart.api.image.repository'
      )
    ));
    const chartDocsUnitSet = report.unitSets.find(unitSet =>
      unitSet.source.kind === 'chart-docs'
      && unitSet.source.name === 'api:home'
    );
    assert.ok(chartDocsUnitSet);
    assert.ok(['fact', 'guidance', 'example', 'diagnostic', 'recipe'].every(unitType =>
      chartDocsUnitSet.units.some(unit => unit.unitType === unitType)
    ));
    assert.ok(chartDocsUnitSet.units.some(unit =>
      unit.unitType === 'example'
      && unit.exampleType === 'helm-docs-example'
      && /ghcr\.io\/example\/api/.test(unit.snippet)
    ));
    assert.ok(chartDocsUnitSet.units.some(unit =>
      unit.unitType === 'diagnostic'
      && unit.engine === 'helm'
      && unit.signature === 'Error: image.repository is required'
    ));
    assert.ok(chartDocsUnitSet.units.some(unit =>
      unit.unitType === 'recipe'
      && unit.name === 'Upgrade Workflow'
      && unit.steps.length === 3
    ));
    assert.doesNotMatch(output, /"content"\s*:|# API chart|Secret token/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge extract command writes a reusable validation artifact with --out', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-extract-out-'));

  try {
    const outputPath = join(tempRoot, 'artifacts/knowledge-extraction.json');
    const unitOutputDir = join(tempRoot, 'artifacts/units');
    const manifestPath = join(tempRoot, 'artifacts/knowledge-extraction.manifest.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'extract',
      'fixtures/sample-workspace',
      '--domain',
      'helm',
      '--target',
      'charts/payments-api',
      '--out',
      outputPath,
      '--units-out',
      unitOutputDir,
      '--manifest-out',
      manifestPath,
      '--json'
    ]));
    const stdoutReport = JSON.parse(output.slice(output.indexOf('{')));
    const artifact = JSON.parse(await readFile(outputPath, 'utf8'));
    const unitArtifact = JSON.parse(await readFile(stdoutReport.unitOutputPaths[0], 'utf8'));
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const validationOutput = await captureStdout(() => main([
      'knowledge',
      'validate',
      outputPath,
      '--workspace',
      'fixtures/sample-workspace',
      '--json'
    ]));
    const validation = JSON.parse(validationOutput.slice(validationOutput.indexOf('{')));
    const unitValidationOutput = await captureStdout(() => main([
      'knowledge',
      'validate',
      stdoutReport.unitOutputPaths[0],
      '--json'
    ]));
    const unitValidation = JSON.parse(unitValidationOutput.slice(unitValidationOutput.indexOf('{')));

    assert.equal(stdoutReport.kind, 'infra-agent.knowledge-extraction');
    assert.equal(stdoutReport.outputPath, outputPath);
    assert.equal(stdoutReport.manifestPath, manifestPath);
    assert.equal(stdoutReport.unitOutputPaths.length, stdoutReport.unitSetCount);
    assert.equal(artifact.kind, 'infra-agent.knowledge-extraction');
    assert.equal(artifact.outputPath, undefined);
    assert.equal(artifact.factSetCount, stdoutReport.factSetCount);
    assert.equal(unitArtifact.kind, 'infra-agent.knowledge-units');
    assert.equal(unitArtifact.sourceId, artifact.unitSets[0].sourceId);
    assert.equal(unitArtifact.unitCount, artifact.unitSets[0].unitCount);
    assert.equal(manifest.kind, 'infra-agent.knowledge-artifact-manifest');
    assert.equal(manifest.artifact.kind, 'infra-agent.knowledge-extraction');
    assert.equal(manifest.artifact.path, outputPath);
    assert.equal(manifest.artifact.factCount, artifact.factCount);
    assert.equal(manifest.artifact.unitCount, artifact.unitCount);
    assert.equal(manifest.publication.remoteWriteAllowed, false);
    assert.equal(validation.valid, true);
    assert.equal(validation.factSetCount, artifact.factSetCount);
    assert.equal(unitValidation.valid, true);
    assert.equal(unitValidation.unitSetCount, 1);
    assert.equal(unitValidation.unitCount, unitArtifact.unitCount);
    assert.doesNotMatch(JSON.stringify(artifact), /"content"\s*:|replicaCount":\s*\{|"\$schema"/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge validate command validates extraction JSON files', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-validate-'));

  try {
    const inspection = await inspectWorkspace('fixtures/sample-workspace');
    const extraction = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['helm'],
      targetPaths: ['charts/payments-api'],
      extractedAt: '2026-05-05T00:00:00.000Z'
    });
    const inputPath = join(tempRoot, 'knowledge-extraction.json');
    await writeFile(inputPath, JSON.stringify(extraction, null, 2));

    const output = await captureStdout(() => main([
      'knowledge',
      'validate',
      inputPath,
      '--json'
    ]));
    const report = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(report.kind, 'infra-agent.knowledge-validation');
    assert.equal(report.schemaVersion, 1);
    assert.equal(report.mutationAllowed, false);
    assert.equal(report.inputKind, 'infra-agent.knowledge-extraction');
    assert.equal(report.valid, true);
    assert.equal(report.factSetCount, extraction.factSetCount);
    assert.equal(report.factCount, extraction.factCount);
    assert.deepEqual(report.issues, []);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge validate command detects stale local source fingerprints with workspace', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-validate-stale-'));
  const previousExitCode = process.exitCode;

  try {
    process.exitCode = undefined;
    await cp(resolve('fixtures/sample-workspace'), tempRoot, { recursive: true });
    const inspection = await inspectWorkspace(tempRoot);
    const extraction = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['helm'],
      targetPaths: ['charts/payments-api'],
      extractedAt: '2026-05-05T00:00:00.000Z'
    });
    const inputPath = join(tempRoot, 'knowledge-extraction.json');
    await writeFile(inputPath, JSON.stringify(extraction, null, 2));
    await writeFile(
      join(tempRoot, 'charts/payments-api/Chart.yaml'),
      `${await readFile(join(tempRoot, 'charts/payments-api/Chart.yaml'), 'utf8')}\n# changed after extraction\n`
    );

    const output = await captureStdout(() => main([
      'knowledge',
      'validate',
      inputPath,
      '--workspace',
      tempRoot,
      '--json'
    ]));
    const report = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(report.kind, 'infra-agent.knowledge-validation');
    assert.equal(report.valid, false);
    assert.equal(report.workspaceRoot, resolve(process.cwd(), tempRoot));
    assert.equal(report.staleSourceCount, 1);
    assert.equal(process.exitCode, 1);
    assert.ok(report.issues.some(issue =>
      issue.severity === 'error'
      && /local-file-hash-mismatch/.test(issue.message)
    ));
  } finally {
    process.exitCode = previousExitCode;
    await rm(tempRoot, { recursive: true, force: true });
  }
});
