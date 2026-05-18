import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
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

function assertShortDigest(value, fieldName = 'digest') {
  assert.match(value, /^[a-f0-9]{12}$/, `${fieldName} should be a short lowercase hex digest`);
}

function assertCachePostureIsCompact(cachePosture) {
  const postureText = jsonText(cachePosture);

  assert.doesNotMatch(postureText, /[a-f0-9]{64}/);
  assert.doesNotMatch(postureText, /"url"|"localPath"|"content"|"rawContent"|"fingerprint"\s*:|"files"\s*:/);
}

function assertReadyAcceptanceSummary(report) {
  assert.equal(report.summary.acceptanceStatus, 'ready');
  assert.equal(report.summary.cacheReady, true);
  assert.equal(report.summary.unitTypeComplete, true);
  assert.deepEqual(report.summary.includedUnitTypes, ['fact', 'guidance', 'example', 'diagnostic', 'recipe']);
  assert.deepEqual(report.summary.missingUnitTypes, []);
  assert.ok(report.summary.unitCounts.fact > 0);
  assert.ok(report.summary.unitCounts.guidance > 0);
  assert.ok(report.summary.unitCounts.example > 0);
  assert.ok(report.summary.unitCounts.diagnostic > 0);
  assert.ok(report.summary.unitCounts.recipe > 0);
}

function assertUnitIndexFieldMetadataIsCompact(unitIndex) {
  const indexText = jsonText(unitIndex);

  assert.doesNotMatch(indexText, /"summary"|"snippet"|"sourceLocator"|"url"|"localPath"|"content"|"rawContent"/);
}

async function snapshotCacheFiles(cacheDir) {
  const files = await readdir(cacheDir);
  const snapshot = {};
  for (const file of files) {
    snapshot[file] = await readFile(join(cacheDir, file), 'utf8');
  }
  return snapshot;
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
      domains: ['terraform'],
      targetPaths: ['terraform/api']
    },
    'data-source:aws_iam_policy_document',
    [
      '# aws_iam_policy_document',
      '',
      '#### Arguments',
      '',
      '- `statement` - (Optional) UNRELATED_POLICY_MARKER.',
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

test('knowledge resource selection filters Terraform source docs inside a target', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-resource-terraform-'));

  try {
    await writeResourceWorkspace(tempRoot);
    await seedResourceCaches(tempRoot);

    const sources = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'terraform',
      '--resource',
      'aws_s3_bucket.logs',
      '--json'
    ])));
    assert.equal(sources.resource, 'aws_s3_bucket.logs');
    assert.deepEqual(sources.targetPaths, ['terraform/api']);
    assert.deepEqual(sources.sources.map(source => source.source.name), ['resource:aws_s3_bucket']);

    const pack = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'terraform',
      '--resource',
      'aws_s3_bucket.logs',
      '--max-units',
      '8',
      '--json'
    ])));
    const packText = jsonText(pack);

    assert.equal(pack.resource, 'aws_s3_bucket.logs');
    assert.deepEqual(pack.targetPaths, ['terraform/api']);
    assert.deepEqual(pack.sources.map(source => source.name), ['resource:aws_s3_bucket']);
    assert.ok(pack.units.some(unit => unit.path === 'resource.aws_s3_bucket.bucket'));
    assert.doesNotMatch(packText, /aws_sqs_queue|aws_iam_policy_document|UNRELATED_|secretToken|password|authorization|bearer|"content"\s*:/);

    const index = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'index',
      tempRoot,
      '--domain',
      'terraform',
      '--resource',
      'aws_s3_bucket.logs',
      '--max-units',
      '8',
      '--json'
    ])));
    const indexText = jsonText(index);

    assert.deepEqual(index.entries.map(entry => entry.sourceName), ['resource:aws_s3_bucket']);
    assert.ok(index.entries.every(entry => entry.targetPath === 'terraform/api'));
    assert.doesNotMatch(indexText, /aws_sqs_queue|aws_iam_policy_document|UNRELATED_|"facts"|"units"|"content"|"rawContent"|"snippet"|"sourceLocator"/);

  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge resource report composes Terraform refs, sources, pack, and index', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-resource-report-terraform-'));

  try {
    await writeResourceWorkspace(tempRoot);
    await seedResourceCaches(tempRoot);

    const outputPath = join(tempRoot, 'artifacts/resource-knowledge.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'resource',
      tempRoot,
      '--domain',
      'terraform',
      '--resource',
      'aws_s3_bucket.logs',
      '--max-units',
      '10',
      '--out',
      outputPath,
      '--json'
    ]));
    const report = parseJsonOutput(output);
    const persisted = JSON.parse(await readFile(outputPath, 'utf8'));
    const reportText = jsonText(report);
    const unitTypes = new Set(report.pack.units.map(unit => unit.unitType));

    assert.equal(report.kind, 'infra-agent.knowledge-resource-report');
    assert.equal(report.schemaVersion, 1);
    assert.equal(report.mutationAllowed, false);
    assert.equal(report.resource, 'aws_s3_bucket.logs');
    assert.equal(report.outputPath, outputPath);
    assert.equal(persisted.outputPath, undefined);
    assert.equal(persisted.resource, 'aws_s3_bucket.logs');
    assert.deepEqual(report.requestedDomains, ['terraform']);
    assert.deepEqual(report.targetPaths, ['terraform/api']);
    assert.equal(report.summary.matchedTargetCount, 1);
    assert.equal(report.summary.sourceCount, 1);
    assert.equal(report.summary.includedRefCount, report.refs.length);
    assert.ok(report.summary.includedUnitCount > 0);
    assert.equal(report.summary.recommendedAction, 'use-resource-knowledge');
    assertReadyAcceptanceSummary(report);
    assert.ok(report.targets[0].matchReasons.includes('scope matches resource identity'));
    assert.ok(report.suggestedFiles.includes('terraform/api/main.tf'));
    assert.deepEqual(report.validationTargets, ['terraform/api']);
    assert.deepEqual(report.sources.map(source => source.source.name), ['resource:aws_s3_bucket']);
    assert.deepEqual(report.pack.sources.map(source => source.name), ['resource:aws_s3_bucket']);
    assert.ok(report.pack.units.some(unit => unit.path === 'resource.aws_s3_bucket.bucket'));
    assert.ok(['fact', 'guidance', 'example', 'diagnostic', 'recipe'].every(unitType => unitTypes.has(unitType)));
    assert.equal(report.unitIndex.sourceCount, report.unitIndex.entries.length);
    assert.equal(report.unitIndex.includedUnitCount, report.summary.includedUnitCount);
    assert.ok(report.unitIndex.entries.every(entry =>
      entry.targetPath === 'terraform/api'
      && entry.sourceName === 'resource:aws_s3_bucket'
    ));
    assert.ok(report.unitIndex.fieldEntryCount > 0);
    assert.equal(
      report.unitIndex.fieldIncludedUnitCount,
      report.unitIndex.fieldEntries.reduce((sum, entry) => sum + entry.includedUnitCount, 0)
    );
    assert.ok(report.unitIndex.fieldEntries.some(entry =>
      entry.resourceKey === 'resource.aws_s3_bucket'
      && entry.fieldPath === 'bucket'
      && entry.unitPaths.includes('resource.aws_s3_bucket.bucket')
    ));
    assertUnitIndexFieldMetadataIsCompact(report.unitIndex);
    assert.deepEqual(persisted.cachePosture, report.cachePosture);
    assert.equal(report.cachePosture.packId, report.pack.packId);
    assert.equal(report.cachePosture.cacheRootSource, 'workspace-config: knowledgeCache.root');
    assert.equal(report.cachePosture.sourceCount, 1);
    assert.equal(report.cachePosture.local, 0);
    assert.equal(report.cachePosture.fresh, 1);
    assert.equal(report.cachePosture.stale, 0);
    assert.equal(report.cachePosture.missing, 0);
    assert.equal(report.cachePosture.refreshRecommended, 0);
    assert.equal(report.cachePosture.reusedSourceCount, 1);
    assert.equal(report.cachePosture.reusable, true);
    assertShortDigest(report.cachePosture.selectionHash, 'selectionHash');
    assertShortDigest(report.cachePosture.targetHash, 'targetHash');
    assertShortDigest(report.cachePosture.sourceHash, 'sourceHash');
    assertShortDigest(report.cachePosture.unitIndexHash, 'unitIndexHash');
    assert.equal(report.cachePosture.sources[0].sourceName, 'resource:aws_s3_bucket');
    assert.equal(report.cachePosture.sources[0].cacheStatus, 'fresh');
    assert.equal(report.cachePosture.sources[0].freshness, 'fresh');
    assert.equal(report.cachePosture.sources[0].storageScope, 'public-reference');
    assert.equal(report.cachePosture.sources[0].includedUnitCount, report.unitIndex.entries[0].includedUnitCount);
    assertShortDigest(report.cachePosture.sources[0].sourceContentHash, 'sourceContentHash');
    assertCachePostureIsCompact(report.cachePosture);
    assert.doesNotMatch(reportText, /aws_sqs_queue|aws_iam_policy_document|UNRELATED_|secretToken|password|authorization|bearer|"content"\s*:|"rawContent"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge resource selection filters Pulumi resource docs inside a project', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-resource-pulumi-'));

  try {
    await writeResourceWorkspace(tempRoot);
    await seedResourceCaches(tempRoot);

    const sources = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'pulumi',
      '--resource',
      'aws:s3/bucket:Bucket',
      '--json'
    ])));
    assert.equal(sources.resource, 'aws:s3/bucket:Bucket');
    assert.deepEqual(sources.targetPaths, ['infra/api']);
    assert.deepEqual(sources.sources.map(source => source.source.name), ['pulumi-docs:resource:aws:s3/bucket']);

    const pack = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'pulumi',
      '--resource',
      'aws:s3/bucket:Bucket',
      '--max-units',
      '8',
      '--json'
    ])));
    const packText = jsonText(pack);

    assert.equal(pack.resource, 'aws:s3/bucket:Bucket');
    assert.deepEqual(pack.targetPaths, ['infra/api']);
    assert.deepEqual(pack.sources.map(source => source.name), ['pulumi-docs:resource:aws:s3/bucket']);
    assert.ok(pack.units.some(unit => unit.path === 'pulumi.resource.aws.s3.bucket.Bucket.bucket'));
    assert.doesNotMatch(packText, /aws:sns\/topic:Topic|UNRELATED_TOPIC_MARKER|secretToken|password|authorization|bearer|"content"\s*:/);

    const index = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'index',
      tempRoot,
      '--domain',
      'pulumi',
      '--resource',
      'aws:s3/bucket:Bucket',
      '--max-units',
      '8',
      '--json'
    ])));
    const indexText = jsonText(index);

    assert.deepEqual(index.entries.map(entry => entry.sourceName), ['pulumi-docs:resource:aws:s3/bucket']);
    assert.ok(index.entries.every(entry => entry.targetPath === 'infra/api'));
    assert.doesNotMatch(indexText, /aws:sns\/topic:Topic|UNRELATED_TOPIC_MARKER|"facts"|"units"|"content"|"rawContent"|"snippet"|"sourceLocator"/);

  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge resource report composes Pulumi refs, sources, pack, and index', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-resource-report-pulumi-'));

  try {
    await writeResourceWorkspace(tempRoot);
    await seedResourceCaches(tempRoot);

    const report = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'resource',
      tempRoot,
      '--domain',
      'pulumi',
      '--resource',
      'aws:s3/bucket:Bucket',
      '--max-units',
      '10',
      '--json'
    ])));
    const reportText = jsonText(report);
    const unitTypes = new Set(report.pack.units.map(unit => unit.unitType));

    assert.equal(report.kind, 'infra-agent.knowledge-resource-report');
    assert.equal(report.mutationAllowed, false);
    assert.equal(report.resource, 'aws:s3/bucket:Bucket');
    assert.deepEqual(report.requestedDomains, ['pulumi']);
    assert.deepEqual(report.targetPaths, ['infra/api']);
    assert.equal(report.summary.matchedTargetCount, 1);
    assert.equal(report.summary.sourceCount, 1);
    assert.equal(report.summary.recommendedAction, 'use-resource-knowledge');
    assertReadyAcceptanceSummary(report);
    assert.ok(report.suggestedFiles.includes('infra/api/Pulumi.yaml'));
    assert.ok(report.validationTargets.includes('infra/api'));
    assert.deepEqual(report.sources.map(source => source.source.name), ['pulumi-docs:resource:aws:s3/bucket']);
    assert.deepEqual(report.pack.sources.map(source => source.name), ['pulumi-docs:resource:aws:s3/bucket']);
    assert.ok(report.pack.units.some(unit => unit.path === 'pulumi.resource.aws.s3.bucket.Bucket.bucket'));
    assert.ok(['fact', 'guidance', 'example', 'diagnostic', 'recipe'].every(unitType => unitTypes.has(unitType)));
    assert.ok(report.unitIndex.entries.every(entry =>
      entry.targetPath === 'infra/api'
      && entry.sourceName === 'pulumi-docs:resource:aws:s3/bucket'
    ));
    assert.ok(report.unitIndex.fieldEntries.some(entry =>
      entry.resourceKey === 'pulumi.resource.aws.s3.bucket.Bucket'
      && entry.fieldPath === 'bucket'
      && entry.unitPaths.includes('pulumi.resource.aws.s3.bucket.Bucket.bucket')
    ));
    assertUnitIndexFieldMetadataIsCompact(report.unitIndex);
    assert.equal(report.cachePosture.packId, report.pack.packId);
    assert.equal(report.cachePosture.sourceCount, 1);
    assert.equal(report.cachePosture.local, 0);
    assert.equal(report.cachePosture.fresh, 1);
    assert.equal(report.cachePosture.stale, 0);
    assert.equal(report.cachePosture.missing, 0);
    assert.equal(report.cachePosture.refreshRecommended, 0);
    assert.equal(report.cachePosture.reusedSourceCount, 1);
    assert.equal(report.cachePosture.reusable, true);
    assertShortDigest(report.cachePosture.selectionHash, 'selectionHash');
    assertShortDigest(report.cachePosture.targetHash, 'targetHash');
    assertShortDigest(report.cachePosture.sourceHash, 'sourceHash');
    assertShortDigest(report.cachePosture.unitIndexHash, 'unitIndexHash');
    assert.equal(report.cachePosture.sources[0].sourceName, 'pulumi-docs:resource:aws:s3/bucket');
    assert.equal(report.cachePosture.sources[0].cacheStatus, 'fresh');
    assert.equal(report.cachePosture.sources[0].freshness, 'fresh');
    assert.equal(report.cachePosture.sources[0].storageScope, 'public-reference');
    assertShortDigest(report.cachePosture.sources[0].sourceContentHash, 'sourceContentHash');
    assertCachePostureIsCompact(report.cachePosture);
    assert.doesNotMatch(reportText, /aws:sns\/topic:Topic|UNRELATED_TOPIC_MARKER|secretToken|password|authorization|bearer|"content"\s*:|"rawContent"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge resource report composes Helm Argo values layers and five-unit chart docs', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-resource-report-helm-'));

  try {
    await writeHelmResourceWorkspace(tempRoot);
    await seedHelmResourceCaches(tempRoot);
    const cacheDir = join(tempRoot, '.infra-agent/knowledge-cache');
    const cacheSnapshotBefore = await snapshotCacheFiles(cacheDir);

    const report = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'resource',
      tempRoot,
      '--domain',
      'helm',
      '--resource',
      'chart:payments-api',
      '--max-units',
      '50',
      '--json'
    ])));
    const cacheSnapshotAfter = await snapshotCacheFiles(cacheDir);
    const reportText = jsonText(report);
    const unitTypes = new Set(report.pack.units.map(unit => unit.unitType));
    const target = report.targets[0];
    const link = target.deploymentLinks?.[0];

    assert.equal(report.kind, 'infra-agent.knowledge-resource-report');
    assert.equal(report.schemaVersion, 1);
    assert.equal(report.mutationAllowed, false);
    assert.equal(report.resource, 'chart:payments-api');
    assert.deepEqual(report.requestedDomains, ['helm']);
    assert.deepEqual(report.targetPaths, ['charts/payments-api']);
    assert.equal(report.summary.matchedTargetCount, 1);
    assert.equal(report.summary.recommendedAction, 'use-resource-knowledge');
    assertReadyAcceptanceSummary(report);
    assert.equal(report.summary.suggestedFileCount, report.suggestedFiles.length);
    assert.equal(report.summary.validationTargetCount, report.validationTargets.length);
    assert.ok(['fact', 'guidance', 'example', 'diagnostic', 'recipe'].every(unitType => unitTypes.has(unitType)));
    assert.deepEqual(cacheSnapshotAfter, cacheSnapshotBefore);
    const secondReport = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'resource',
      tempRoot,
      '--domain',
      'helm',
      '--resource',
      'chart:payments-api',
      '--max-units',
      '50',
      '--json'
    ])));
    assert.deepEqual(secondReport.cachePosture, report.cachePosture);
    assert.deepEqual(await snapshotCacheFiles(cacheDir), cacheSnapshotBefore);

    assert.equal(target.domain, 'helm');
    assert.equal(target.kind, 'helm-chart');
    assert.equal(target.chartName, 'payments-api');
    assert.deepEqual(target.lookupIdentities, ['chart:payments-api']);
    assert.equal(target.chartMetadata.chartName, 'payments-api');
    assert.equal(target.chartMetadata.version, '0.1.0');
    assert.equal(target.valuesSchemaFile, 'charts/payments-api/values.schema.json');
    assert.equal(target.hasValuesFile, true);
    assert.equal(target.hasTemplatesDir, true);
    assert.ok(link);
    assert.equal(link.applicationName, 'payments-api-prod');
    assert.equal(link.applicationNamespace, 'argocd');
    assert.equal(link.applicationFile, 'apps/payments-api.yaml');
    assert.equal(link.destinationNamespace, 'payments');
    assert.equal(link.releaseName, 'payments-api');
    assert.deepEqual(link.valueFiles, ['charts/payments-api/values-prod.yaml']);
    assert.equal(link.omittedValueFileCount, 1);
    assert.deepEqual(link.valuesLayers.map(layer => layer.path), [
      'charts/payments-api/values.yaml',
      'charts/payments-api/values-prod.yaml'
    ]);
    assert.deepEqual(link.valuesLayers.map(layer => layer.source), [
      'chart-default',
      'argocd-value-file'
    ]);

    assert.ok(report.suggestedFiles.includes('apps/payments-api.yaml'));
    assert.ok(report.suggestedFiles.includes('charts/payments-api/Chart.yaml'));
    assert.ok(report.suggestedFiles.includes('charts/payments-api/values.yaml'));
    assert.ok(report.suggestedFiles.includes('charts/payments-api/values-prod.yaml'));
    assert.ok(report.suggestedFiles.includes('charts/payments-api/values.schema.json'));
    assert.equal(report.suggestedFiles.includes('charts/payments-api/secret-values.yaml'), false);
    assert.deepEqual(report.validationTargets, ['charts/payments-api']);

    assert.ok(report.sources.every(source => source.domain === 'helm' && source.targetPath === 'charts/payments-api'));
    assert.ok(report.sources.some(source => source.source.name === 'payments-api:Chart.yaml'));
    assert.ok(report.sources.some(source => source.source.name === 'payments-api:values.schema.json'));
    assert.ok(report.sources.some(source => source.source.name === 'payments-api:home'));
    assert.ok(report.pack.sources.some(source => source.kind === 'chart-docs' && source.name === 'payments-api:home'));
    assert.ok(report.pack.units.some(unit =>
      unit.unitType === 'fact'
      && unit.path === 'chart.payments-api.image.repository'
    ));
    assert.ok(report.pack.units.some(unit =>
      unit.unitType === 'example'
      && unit.exampleType === 'helm-docs-example'
      && /ghcr\.io\/example\/payments-api/.test(unit.snippet)
    ));
    assert.ok(report.pack.units.some(unit =>
      unit.unitType === 'diagnostic'
      && unit.engine === 'helm'
      && unit.signature === 'Error: image.repository is required'
    ));
    assert.ok(report.unitIndex.entries.some(entry =>
      entry.sourceKind === 'chart-docs'
      && entry.sourceName === 'payments-api:home'
      && entry.unitCounts.example > 0
    ));
    assert.ok(report.unitIndex.fieldEntries.some(entry =>
      entry.resourceKey === 'chart.payments-api'
      && entry.fieldPath === 'image.repository'
      && entry.unitPaths.includes('chart.payments-api.image.repository')
    ));
    assertUnitIndexFieldMetadataIsCompact(report.unitIndex);
    assert.equal(report.cachePosture.packId, report.pack.packId);
    assert.equal(report.cachePosture.sourceCount, report.sources.length);
    assert.equal(report.cachePosture.local, report.sources.filter(source => source.cacheStatus === 'local').length);
    assert.equal(report.cachePosture.fresh, report.sources.filter(source => source.cacheStatus === 'fresh').length);
    assert.equal(report.cachePosture.stale, 0);
    assert.equal(report.cachePosture.missing, 0);
    assert.equal(report.cachePosture.refreshRecommended, 0);
    assert.equal(report.cachePosture.reusedSourceCount, report.cachePosture.local + report.cachePosture.fresh);
    assert.equal(report.cachePosture.reusable, true);
    assertShortDigest(report.cachePosture.selectionHash, 'selectionHash');
    assertShortDigest(report.cachePosture.targetHash, 'targetHash');
    assertShortDigest(report.cachePosture.sourceHash, 'sourceHash');
    assertShortDigest(report.cachePosture.unitIndexHash, 'unitIndexHash');
    assert.ok(report.cachePosture.sources.every(source =>
      source.domain === 'helm'
      && source.targetPath === 'charts/payments-api'
    ));
    const chartDocsPosture = report.cachePosture.sources.find(source => source.sourceName === 'payments-api:home');
    assert.ok(chartDocsPosture);
    assert.equal(chartDocsPosture.cacheStatus, 'fresh');
    assert.equal(chartDocsPosture.freshness, 'fresh');
    assert.equal(chartDocsPosture.storageScope, 'public-reference');
    assert.ok(chartDocsPosture.includedUnitCount > 0);
    assert.ok(chartDocsPosture.unitCounts.example > 0);
    assertShortDigest(chartDocsPosture.sourceContentHash, 'sourceContentHash');
    const chartMetadataPosture = report.cachePosture.sources.find(source => source.sourceName === 'payments-api:Chart.yaml');
    assert.ok(chartMetadataPosture);
    assert.equal(chartMetadataPosture.cacheStatus, 'local');
    assert.equal(chartMetadataPosture.freshness, 'fresh');
    assert.equal(chartMetadataPosture.storageScope, 'workspace-private');
    assertShortDigest(chartMetadataPosture.fingerprintDigest, 'fingerprintDigest');
    assert.equal(chartMetadataPosture.fingerprintFileCount, 1);
    assertCachePostureIsCompact(report.cachePosture);
    assert.doesNotMatch(reportText, /secret-values\.yaml|repository:\s*example\/payments-api|replicaCount:\s*2|"\$schema"|kubernetes\.default\.svc|password|authorization|bearer|"content"\s*:|"rawContent"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge resource report resolves Helm release identity to chart knowledge', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-resource-report-helm-release-'));

  try {
    await writeHelmResourceWorkspace(tempRoot);
    await seedHelmResourceCaches(tempRoot);
    const cacheDir = join(tempRoot, '.infra-agent/knowledge-cache');
    const cacheSnapshotBefore = await snapshotCacheFiles(cacheDir);

    const report = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'resource',
      tempRoot,
      '--domain',
      'helm',
      '--resource',
      'release:payments-api',
      '--max-units',
      '50',
      '--json'
    ])));
    const cacheSnapshotAfter = await snapshotCacheFiles(cacheDir);
    const reportText = jsonText(report);
    const unitTypes = new Set(report.pack.units.map(unit => unit.unitType));
    const target = report.targets[0];
    const link = target.deploymentLinks?.[0];

    assert.equal(report.kind, 'infra-agent.knowledge-resource-report');
    assert.equal(report.mutationAllowed, false);
    assert.equal(report.resource, 'release:payments-api');
    assert.deepEqual(report.requestedDomains, ['helm']);
    assert.deepEqual(report.targetPaths, ['charts/payments-api']);
    assert.equal(report.summary.matchedTargetCount, 1);
    assert.equal(report.summary.recommendedAction, 'use-resource-knowledge');
    assertReadyAcceptanceSummary(report);
    assert.deepEqual(cacheSnapshotAfter, cacheSnapshotBefore);

    assert.equal(target.domain, 'helm');
    assert.equal(target.kind, 'helm-chart');
    assert.equal(target.path, 'charts/payments-api');
    assert.equal(target.chartName, 'payments-api');
    assert.deepEqual(target.lookupIdentities, ['release:payments-api']);
    assert.equal(target.valuesSchemaFile, 'charts/payments-api/values.schema.json');
    assert.ok(link);
    assert.equal(link.releaseName, 'payments-api');
    assert.equal(link.applicationName, 'payments-api-prod');
    assert.equal(link.applicationFile, 'apps/payments-api.yaml');
    assert.equal(link.destinationNamespace, 'payments');
    assert.deepEqual(link.valuesLayers.map(layer => layer.path), [
      'charts/payments-api/values.yaml',
      'charts/payments-api/values-prod.yaml'
    ]);
    assert.deepEqual(link.valuesLayers.map(layer => layer.source), [
      'chart-default',
      'argocd-value-file'
    ]);
    assert.deepEqual(link.valueFiles, ['charts/payments-api/values-prod.yaml']);
    assert.equal(link.omittedValueFileCount, 1);

    assert.ok(report.suggestedFiles.includes('apps/payments-api.yaml'));
    assert.ok(report.suggestedFiles.includes('charts/payments-api/Chart.yaml'));
    assert.ok(report.suggestedFiles.includes('charts/payments-api/values.yaml'));
    assert.ok(report.suggestedFiles.includes('charts/payments-api/values-prod.yaml'));
    assert.equal(report.suggestedFiles.includes('charts/payments-api/secret-values.yaml'), false);
    assert.deepEqual(report.validationTargets, ['charts/payments-api']);

    assert.ok(report.sources.every(source => source.domain === 'helm' && source.targetPath === 'charts/payments-api'));
    assert.ok(report.pack.sources.every(source => source.domain === 'helm' && source.targetPath === 'charts/payments-api'));
    assert.ok(report.unitIndex.entries.every(entry => entry.domain === 'helm' && entry.targetPath === 'charts/payments-api'));
    assert.ok(report.sources.some(source => source.source.name === 'payments-api:Chart.yaml'));
    assert.ok(report.sources.some(source => source.source.name === 'payments-api:values.schema.json'));
    assert.ok(report.sources.some(source => source.source.name === 'payments-api:home'));
    assert.ok(report.pack.sources.some(source => source.kind === 'chart-docs' && source.name === 'payments-api:home'));
    assert.ok(report.unitIndex.entries.some(entry =>
      entry.sourceKind === 'chart-docs'
      && entry.sourceName === 'payments-api:home'
      && entry.unitCounts.example > 0
    ));
    assert.equal(report.cachePosture.packId, report.pack.packId);
    assert.equal(report.cachePosture.sourceCount, report.sources.length);
    assert.equal(report.cachePosture.local, report.sources.filter(source => source.cacheStatus === 'local').length);
    assert.equal(report.cachePosture.fresh, report.sources.filter(source => source.cacheStatus === 'fresh').length);
    assert.equal(report.cachePosture.stale, 0);
    assert.equal(report.cachePosture.missing, 0);
    assert.equal(report.cachePosture.refreshRecommended, 0);
    assert.equal(report.cachePosture.reusedSourceCount, report.cachePosture.local + report.cachePosture.fresh);
    assert.equal(report.cachePosture.reusable, true);
    assertShortDigest(report.cachePosture.selectionHash, 'selectionHash');
    assertShortDigest(report.cachePosture.targetHash, 'targetHash');
    assertShortDigest(report.cachePosture.sourceHash, 'sourceHash');
    assertShortDigest(report.cachePosture.unitIndexHash, 'unitIndexHash');
    assert.ok(report.cachePosture.sources.every(source =>
      source.domain === 'helm'
      && source.targetPath === 'charts/payments-api'
    ));
    assert.ok(report.cachePosture.sources.some(source =>
      source.sourceName === 'payments-api:home'
      && source.cacheStatus === 'fresh'
      && source.freshness === 'fresh'
      && source.storageScope === 'public-reference'
      && source.includedUnitCount > 0
      && source.unitCounts.example > 0
    ));
    assertCachePostureIsCompact(report.cachePosture);
    assert.ok(['fact', 'guidance', 'example', 'diagnostic', 'recipe'].every(unitType => unitTypes.has(unitType)));
    assert.ok(report.pack.units.some(unit =>
      unit.unitType === 'fact'
      && unit.path === 'chart.payments-api.image.repository'
    ));
    assert.ok(report.pack.units.some(unit =>
      unit.unitType === 'diagnostic'
      && unit.engine === 'helm'
      && unit.signature === 'Error: image.repository is required'
    ));
    assert.doesNotMatch(reportText, /secret-values\.yaml|repository:\s*example\/payments-api|replicaCount:\s*2|"\$schema"|kubernetes\.default\.svc|password|authorization|bearer|"content"\s*:|"rawContent"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
