import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cp,
  mkdir,
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
import { buildHelmChartKnowledgeSources } from '../../src/domain/helm-chart-context.ts';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { writeKnowledgeCacheEntry } from '../../src/knowledge/cache.ts';
import { buildKnowledgeSourcesReport } from '../../src/knowledge/sources.ts';

function parseJsonOutput(output) {
  return JSON.parse(output.slice(output.indexOf('{')));
}

function jsonText(value) {
  return JSON.stringify(value);
}

function assertUnitIndexFieldMetadataIsCompact(unitIndex) {
  const indexText = jsonText(unitIndex);

  assert.doesNotMatch(indexText, /"summary"|"snippet"|"sourceLocator"|"url"|"localPath"|"content"|"rawContent"/);
}

const API_CHART_DOCS_MARKDOWN = [
  '# Payments API chart',
  '',
  '| Parameter | Type | Default | Description | Required |',
  '| --- | --- | --- | --- | --- |',
  '| `image.repository` | string | `ghcr.io/example/payments-api` | Container image repository. | yes |',
  '| `service.port` | int | `8080` | Service port exposed by the chart. | no |',
  '',
  '## Example Values',
  '',
  '```yaml',
  'image:',
  '  repository: ghcr.io/example/payments-api',
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

const HELM_SCHEMA_DOCS_MARKDOWN = [
  '# Helm values schema',
  '',
  '## Best Practices',
  '',
  'Use values.schema.json to document and validate chart values before rendering.',
  ''
].join('\n');

async function writeResourceWorkspace(root) {
  const terraformRoot = join(root, 'terraform/api');
  const pulumiRoot = join(root, 'infra/api');
  await mkdir(terraformRoot, { recursive: true });
  await mkdir(pulumiRoot, { recursive: true });
  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      }
    }, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    join(terraformRoot, 'main.tf'),
    [
      'resource "aws_s3_bucket" "logs" {',
      '  bucket = "logs-example"',
      '}',
      '',
      'resource "aws_sqs_queue" "jobs" {',
      '  name = "jobs-example"',
      '}',
      '',
      'data "aws_iam_policy_document" "assume" {',
      '  statement {',
      '    actions = ["sts:AssumeRole"]',
      '  }',
      '}',
      ''
    ].join('\n'),
    'utf8'
  );

  await writeFile(
    join(pulumiRoot, 'Pulumi.yaml'),
    [
      'name: api',
      'runtime: yaml',
      'resources:',
      '  bucket:',
      '    type: aws:s3/bucket:Bucket',
      '  topic:',
      '    type: aws:sns/topic:Topic',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(
    join(pulumiRoot, 'package.json'),
    `${JSON.stringify({
      dependencies: {
        '@pulumi/aws': '^7.0.0'
      }
    }, null, 2)}\n`,
    'utf8'
  );
}

async function writeHelmResourceWorkspace(root) {
  await cp(resolve('fixtures/sample-workspace'), root, { recursive: true });
  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      }
    }, null, 2)}\n`,
    'utf8'
  );

  const chartFile = join(root, 'charts/payments-api/Chart.yaml');
  const chartYaml = await readFile(chartFile, 'utf8');
  await writeFile(
    chartFile,
    `${chartYaml.trimEnd()}\nhome: https://charts.example.test/payments/\n`,
    'utf8'
  );
}

async function seedCachedSource(inspection, options, sourceName, content) {
  const report = await buildKnowledgeSourcesReport(inspection, options);
  const source = report.sources.find(candidate => candidate.source.name === sourceName)?.source;
  assert.ok(source, `expected source ${sourceName}`);
  await writeKnowledgeCacheEntry(inspection.knowledgeCache.root, {
    source,
    contentType: 'text/markdown',
    content,
    fetchedAt: '2026-05-01T00:00:00.000Z',
    staleAfter: '2099-01-01T00:00:00.000Z'
  });
}

async function seedResourceCaches(root) {
  const inspection = await inspectWorkspace(root);
  await seedCachedSource(
    inspection,
    {
      domains: ['terraform'],
      targetPaths: ['terraform/api']
    },
    'resource:aws_s3_bucket',
    [
      '# aws_s3_bucket',
      '',
      '#### Arguments',
      '',
      '- `bucket` - (Optional) Bucket name. Forces replacement.',
      '- `tags` - (Optional) Tags for the bucket.',
      '',
      '## Example Usage',
      '',
      '```hcl',
      'resource "aws_s3_bucket" "logs" {',
      '  bucket = "logs-example"',
      '}',
      '```',
      '',
      '## Best Practices',
      '',
      'Review replacement-sensitive bucket name changes against the Terraform plan.',
      '',
      '## Upgrade Workflow',
      '',
      '1. Update non-identity bucket arguments first.',
      '2. Run terraform plan for the selected root.',
      '3. Review delete/create output before merge.',
      '',
      '## Troubleshooting',
      '',
      '`Error: bucket already exists` usually means the bucket name conflicts with an existing remote object.',
      '',
      '- Check the configured bucket name.',
      '- Review whether this is a rename or a new bucket.',
      '',
      '## Attribute Reference',
      '',
      '- `arn` - Bucket ARN.',
      ''
    ].join('\n')
  );
  await seedCachedSource(
    inspection,
    {
      domains: ['terraform'],
      targetPaths: ['terraform/api']
    },
    'resource:aws_sqs_queue',
    [
      '# aws_sqs_queue',
      '',
      '#### Arguments',
      '',
      '- `name` - (Optional) Queue name. UNRELATED_QUEUE_MARKER password authorization bearer.',
      ''
    ].join('\n')
  );
  await seedCachedSource(
    inspection,
    {
      domains: ['pulumi'],
      targetPaths: ['infra/api']
    },
    'pulumi-docs:resource:aws:s3/bucket',
    [
      '# Bucket',
      '',
      '## Inputs',
      '',
      '| Name | Type | Description |',
      '| --- | --- | --- |',
      '| `bucket` | string | Name of the bucket to create. |',
      '| `acl` | string | Canned ACL for the bucket. |',
      '',
      '## Example Usage',
      '',
      '```typescript',
      'const bucket = new aws.s3.Bucket("bucket", { bucket: "logs-example" });',
      '```',
      '',
      '## Best Practices',
      '',
      'Review preview output before changing bucket identity-like inputs.',
      '',
      '## Upgrade Workflow',
      '',
      '1. Change stack config separately from resource identity edits.',
      '2. Run pulumi preview for the selected project.',
      '3. Review replacements before merge.',
      '',
      '## Troubleshooting',
      '',
      '`Duplicate resource URN` errors can indicate a logical rename without aliases.',
      '',
      '- Check resource names and aliases.',
      '- Review preview replacement output.',
      ''
    ].join('\n')
  );
  await seedCachedSource(
    inspection,
    {
      domains: ['pulumi'],
      targetPaths: ['infra/api']
    },
    'pulumi-docs:resource:aws:sns/topic',
    [
      '# Topic',
      '',
      '## Inputs',
      '',
      '| Name | Type | Description |',
      '| --- | --- | --- |',
      '| `name` | string | UNRELATED_TOPIC_MARKER secretToken password authorization bearer. |',
      ''
    ].join('\n')
  );
}

async function seedHelmResourceCaches(root) {
  const inspection = await inspectWorkspace(root);
  await seedCachedSource(
    inspection,
    {
      domains: ['helm'],
      targetPaths: ['charts/payments-api']
    },
    'values.schema.json',
    HELM_SCHEMA_DOCS_MARKDOWN
  );

  const chart = inspection.helmCharts.find(candidate => candidate.chartRoot === 'charts/payments-api');
  assert.ok(chart);
  const chartDocsSource = (await buildHelmChartKnowledgeSources(inspection.workspaceRoot, chart))
    .find(candidate => candidate.kind === 'chart-docs' && candidate.name === 'payments-api:home');
  assert.ok(chartDocsSource);
  await writeKnowledgeCacheEntry(inspection.knowledgeCache.root, {
    source: chartDocsSource,
    contentType: 'text/markdown',
    content: API_CHART_DOCS_MARKDOWN,
    fetchedAt: '2026-05-01T00:00:00.000Z',
    staleAfter: '2099-01-01T00:00:00.000Z'
  });
}

test('knowledge index filters Terraform resource metadata by field path', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-resource-field-terraform-'));

  try {
    await writeResourceWorkspace(tempRoot);
    await seedResourceCaches(tempRoot);

    const index = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'index',
      tempRoot,
      '--domain',
      'terraform',
      '--resource',
      'aws_s3_bucket.logs',
      '--field-path',
      'bucket',
      '--max-units',
      '8',
      '--json'
    ])));
    const indexText = jsonText(index);
    const fieldEntry = index.fieldEntries.find(entry =>
      entry.resourceKey === 'resource.aws_s3_bucket'
      && entry.fieldPath === 'bucket'
    );

    assert.equal(index.kind, 'infra-agent.knowledge-unit-index');
    assert.ok(fieldEntry);
    assert.ok(index.fieldEntryCount >= 1);
    assert.equal(index.includedUnitCount, index.fieldIncludedUnitCount);
    assert.ok(fieldEntry.unitPaths.includes('resource.aws_s3_bucket.bucket'));
    assert.ok(fieldEntry.unitCounts.fact > 0);
    assert.ok(fieldEntry.unitCounts.guidance > 0);
    assert.ok(fieldEntry.unitCounts.diagnostic > 0);
    assert.ok(index.entries.every(entry =>
      entry.fieldPaths.every(fieldPath => fieldPath.endsWith('.bucket'))
    ));
    assertUnitIndexFieldMetadataIsCompact(index);
    assert.doesNotMatch(indexText, /resource\.aws_s3_bucket\.tags|resource\.aws_s3_bucket\.arn|aws_sqs_queue|UNRELATED_|"facts"|"units"|"content"|"rawContent"|"snippet"|"sourceLocator"/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge index filters Pulumi resource metadata by field path', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-resource-field-pulumi-'));

  try {
    await writeResourceWorkspace(tempRoot);
    await seedResourceCaches(tempRoot);

    const index = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'index',
      tempRoot,
      '--domain',
      'pulumi',
      '--resource',
      'aws:s3/bucket:Bucket',
      '--field-path',
      'bucket',
      '--max-units',
      '8',
      '--json'
    ])));
    const indexText = jsonText(index);
    const fieldEntry = index.fieldEntries.find(entry =>
      entry.resourceKey === 'pulumi.resource.aws.s3.bucket.Bucket'
      && entry.fieldPath === 'bucket'
    );

    assert.ok(fieldEntry);
    assert.ok(index.fieldEntryCount >= 1);
    assert.equal(index.includedUnitCount, index.fieldIncludedUnitCount);
    assert.ok(fieldEntry.unitPaths.includes('pulumi.resource.aws.s3.bucket.Bucket.bucket'));
    assert.ok(fieldEntry.unitCounts.fact > 0);
    assert.ok(index.entries.every(entry =>
      entry.fieldPaths.every(fieldPath => fieldPath.endsWith('.bucket'))
    ));
    assertUnitIndexFieldMetadataIsCompact(index);
    assert.doesNotMatch(indexText, /pulumi\.resource\.aws\.s3\.bucket\.Bucket\.acl|aws:sns\/topic:Topic|UNRELATED_TOPIC_MARKER|"facts"|"units"|"content"|"rawContent"|"snippet"|"sourceLocator"/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge index filters Helm chart metadata by field path', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-resource-field-helm-'));

  try {
    await writeHelmResourceWorkspace(tempRoot);
    await seedHelmResourceCaches(tempRoot);

    const index = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'index',
      tempRoot,
      '--domain',
      'helm',
      '--resource',
      'chart:payments-api',
      '--field-path',
      'image.repository',
      '--max-units',
      '50',
      '--json'
    ])));
    const indexText = jsonText(index);
    const imageRepositoryEntry = index.fieldEntries.find(entry =>
      entry.resourceKey === 'chart.payments-api'
      && entry.fieldPath === 'image.repository'
    );

    assert.ok(imageRepositoryEntry);
    assert.ok(index.fieldEntryCount >= 1);
    assert.equal(index.includedUnitCount, index.fieldIncludedUnitCount);
    assert.ok(imageRepositoryEntry.unitPaths.includes('chart.payments-api.image.repository'));
    assert.ok(imageRepositoryEntry.unitCounts.fact > 0);
    assert.ok(index.entries.every(entry =>
      entry.domain === 'helm'
      && entry.targetPath === 'charts/payments-api'
      && entry.fieldPaths.every(fieldPath => fieldPath.endsWith('.image.repository'))
    ));
    assertUnitIndexFieldMetadataIsCompact(index);
    assert.doesNotMatch(indexText, /chart\.payments-api\.service\.port|chart\.payments-api\.replicaCount|secret-values\.yaml|repository:\s*example\/payments-api|"facts"|"units"|"content"|"rawContent"|"snippet"|"sourceLocator"/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
