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

function assertShortDigest(value, fieldName) {
  assert.match(value, /^[a-f0-9]{12}$/, `${fieldName} should be a short lowercase hex digest`);
}

function assertCompactResourceReport(report, forbiddenPattern) {
  const reportText = jsonText(report);
  const cachePostureText = jsonText(report.cachePosture);
  const unitIndexText = jsonText(report.unitIndex);

  assert.equal(report.kind, 'infra-agent.knowledge-resource-report');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mutationAllowed, false);
  assert.equal(report.summary.matchedTargetCount, 1);
  assert.equal(report.summary.recommendedAction, 'use-resource-knowledge');
  assert.equal(report.summary.includedRefCount, report.refs.length);
  assert.equal(report.summary.includedUnitCount, report.pack.includedUnitCount);
  assert.equal(report.summary.sourceCount, report.sources.length);
  assert.equal(report.unitIndex.sourceCount, report.unitIndex.entries.length);
  assert.equal(report.unitIndex.includedUnitCount, report.summary.includedUnitCount);
  assert.equal(report.unitIndex.fieldEntryCount, report.unitIndex.fieldEntries.length);
  assert.equal(
    report.unitIndex.fieldIncludedUnitCount,
    report.unitIndex.fieldEntries.reduce((sum, entry) => sum + entry.includedUnitCount, 0)
  );
  assert.equal(report.cachePosture.packId, report.pack.packId);
  assert.equal(report.cachePosture.sourceCount, report.sources.length);
  assert.equal(report.cachePosture.reusable, true);
  assertShortDigest(report.cachePosture.selectionHash, 'selectionHash');
  assertShortDigest(report.cachePosture.targetHash, 'targetHash');
  assertShortDigest(report.cachePosture.sourceHash, 'sourceHash');
  assertShortDigest(report.cachePosture.unitIndexHash, 'unitIndexHash');

  const unitTypes = new Set(report.pack.units.map(unit => unit.unitType));
  assert.ok(['fact', 'guidance', 'example', 'diagnostic', 'recipe'].every(unitType => unitTypes.has(unitType)));
  assert.doesNotMatch(reportText, /"content"\s*:|"rawContent"\s*:/);
  assert.doesNotMatch(cachePostureText, /[a-f0-9]{64}/);
  assert.doesNotMatch(cachePostureText, /"url"|"localPath"|"content"\s*:|"rawContent"\s*:|"fingerprint"\s*:|"files"\s*:/);
  assert.doesNotMatch(unitIndexText, /"summary"|"snippet"|"sourceLocator"|"url"|"localPath"|"content"\s*:|"rawContent"\s*:/);
  assert.doesNotMatch(reportText, forbiddenPattern);
}

function assertDomainScoped(report, domain, targetPath) {
  assert.deepEqual(report.requestedDomains, [domain]);
  assert.deepEqual(report.targetPaths, [targetPath]);
  assert.ok(report.validationTargets.includes(targetPath));
  assert.ok(report.validationTargets.every(target =>
    target === targetPath || target.startsWith(`${targetPath}:`)
  ));
  assert.ok(report.targets.every(target => target.domain === domain && target.path === targetPath));
  assert.ok(report.sources.every(source => source.domain === domain && source.targetPath === targetPath));
  assert.ok(report.pack.sources.every(source => source.domain === domain && source.targetPath === targetPath));
  assert.ok(report.unitIndex.entries.every(entry => entry.domain === domain && entry.targetPath === targetPath));
  assert.ok(report.unitIndex.fieldEntries.every(entry => entry.domain === domain && entry.targetPath === targetPath));
  assert.ok(report.cachePosture.sources.every(source => source.domain === domain && source.targetPath === targetPath));
}

const TERRAFORM_BUCKET_DOCS_MARKDOWN = [
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
].join('\n');

const TERRAFORM_POLICY_DOCS_MARKDOWN = [
  '# aws_iam_policy_document',
  '',
  '#### Arguments',
  '',
  '- `statement` - (Optional) Policy statement block.',
  '',
  '## Example Usage',
  '',
  '```hcl',
  'data "aws_iam_policy_document" "assume" {',
  '  statement {',
  '    actions = ["sts:AssumeRole"]',
  '  }',
  '}',
  '```',
  '',
  '## Best Practices',
  '',
  'Review generated policy JSON before using it in IAM resources.',
  '',
  '## Upgrade Workflow',
  '',
  '1. Update policy statements separately from role attachment changes.',
  '2. Run terraform plan for the selected root.',
  '3. Review generated policy diff before merging.',
  '',
  '## Troubleshooting',
  '',
  '`MalformedPolicyDocument` usually means the generated policy JSON is invalid.',
  '',
  '- Check statement actions and principals.',
  '- Review terraform plan output.',
  ''
].join('\n');

const PULUMI_BUCKET_DOCS_MARKDOWN = [
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
].join('\n');

const HELM_CHART_DOCS_MARKDOWN = [
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

async function writeAcceptanceWorkspace(root) {
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
    join(pulumiRoot, 'Pulumi.dev.yaml'),
    [
      'config:',
      '  api:apiToken:',
      '    secure: v1:secretToken-password-authorization-bearer',
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

async function writeHelmAcceptanceWorkspace(root) {
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

async function seedAcceptanceCaches(root) {
  const inspection = await inspectWorkspace(root);
  await seedCachedSource(
    inspection,
    {
      domains: ['terraform'],
      targetPaths: ['terraform/api']
    },
    'resource:aws_s3_bucket',
    TERRAFORM_BUCKET_DOCS_MARKDOWN
  );
  await seedCachedSource(
    inspection,
    {
      domains: ['terraform'],
      targetPaths: ['terraform/api']
    },
    'data-source:aws_iam_policy_document',
    TERRAFORM_POLICY_DOCS_MARKDOWN
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
      '- `name` - (Optional) UNRELATED_QUEUE_MARKER secretToken password authorization bearer.',
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
    PULUMI_BUCKET_DOCS_MARKDOWN
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

async function seedHelmAcceptanceCaches(root) {
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
    content: HELM_CHART_DOCS_MARKDOWN,
    fetchedAt: '2026-05-01T00:00:00.000Z',
    staleAfter: '2099-01-01T00:00:00.000Z'
  });
}

async function runKnowledgeResource(workspaceRoot, domain, resource, maxUnits = 20) {
  return parseJsonOutput(await captureStdout(() => main([
    'knowledge',
    'resource',
    workspaceRoot,
    '--domain',
    domain,
    '--resource',
    resource,
    '--max-units',
    String(maxUnits),
    '--json'
  ])));
}

test('knowledge resource acceptance covers Terraform resource type and data source identities', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-resource-acceptance-terraform-'));

  try {
    await writeAcceptanceWorkspace(tempRoot);
    await seedAcceptanceCaches(tempRoot);

    const bucketReport = await runKnowledgeResource(tempRoot, 'terraform', 'resource:aws_s3_bucket');
    assert.equal(bucketReport.resource, 'resource:aws_s3_bucket');
    assertDomainScoped(bucketReport, 'terraform', 'terraform/api');
    assert.ok(bucketReport.suggestedFiles.includes('terraform/api/main.tf'));
    assert.deepEqual(bucketReport.sources.map(source => source.source.name), ['resource:aws_s3_bucket']);
    assert.deepEqual(bucketReport.pack.sources.map(source => source.name), ['resource:aws_s3_bucket']);
    assert.ok(bucketReport.targets[0].lookupIdentities.includes('resource:aws_s3_bucket'));
    assert.ok(bucketReport.pack.units.some(unit => unit.path === 'resource.aws_s3_bucket.bucket'));
    assert.ok(bucketReport.unitIndex.fieldEntries.some(entry =>
      entry.resourceKey === 'resource.aws_s3_bucket'
      && entry.fieldPath === 'bucket'
    ));
    assertCompactResourceReport(
      bucketReport,
      /aws_sqs_queue|aws_iam_policy_document|UNRELATED_|secretToken|password|authorization|bearer/
    );

    const dataSourceReport = await runKnowledgeResource(tempRoot, 'terraform', 'data:aws_iam_policy_document');
    assert.equal(dataSourceReport.resource, 'data:aws_iam_policy_document');
    assertDomainScoped(dataSourceReport, 'terraform', 'terraform/api');
    assert.deepEqual(dataSourceReport.sources.map(source => source.source.name), ['data-source:aws_iam_policy_document']);
    assert.ok(dataSourceReport.targets[0].lookupIdentities.includes('data:aws_iam_policy_document'));
    assert.ok(dataSourceReport.pack.units.some(unit => unit.path === 'data.aws_iam_policy_document.statement'));
    assert.ok(dataSourceReport.unitIndex.fieldEntries.some(entry =>
      entry.resourceKey === 'data.aws_iam_policy_document'
      && entry.fieldPath === 'statement'
    ));
    assertCompactResourceReport(
      dataSourceReport,
      /aws_s3_bucket|aws_sqs_queue|UNRELATED_|secretToken|password|authorization|bearer/
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge resource acceptance covers Pulumi resource name and prefixed token identities', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-resource-acceptance-pulumi-'));

  try {
    await writeAcceptanceWorkspace(tempRoot);
    await seedAcceptanceCaches(tempRoot);

    for (const resource of ['bucket', 'pulumi:aws:s3/bucket:Bucket']) {
      const report = await runKnowledgeResource(tempRoot, 'pulumi', resource);

      assert.equal(report.resource, resource);
      assertDomainScoped(report, 'pulumi', 'infra/api');
      assert.ok(report.suggestedFiles.includes('infra/api/Pulumi.yaml'));
      assert.deepEqual(report.sources.map(source => source.source.name), ['pulumi-docs:resource:aws:s3/bucket']);
      assert.deepEqual(report.pack.sources.map(source => source.name), ['pulumi-docs:resource:aws:s3/bucket']);
      assert.ok(report.targets[0].lookupIdentities.includes(resource));
      assert.ok(report.pack.units.some(unit => unit.path === 'pulumi.resource.aws.s3.bucket.Bucket.bucket'));
      assert.ok(report.unitIndex.fieldEntries.some(entry =>
        entry.resourceKey === 'pulumi.resource.aws.s3.bucket.Bucket'
        && entry.fieldPath === 'bucket'
      ));
      assertCompactResourceReport(
        report,
        /aws:sns\/topic:Topic|UNRELATED_TOPIC_MARKER|apiToken|secure|secretToken|password|authorization|bearer/
      );
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge resource acceptance covers Helm Argo CD and namespace identities', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-resource-acceptance-helm-'));

  try {
    await writeHelmAcceptanceWorkspace(tempRoot);
    await seedHelmAcceptanceCaches(tempRoot);

    for (const resource of ['argocd:payments-api-prod', 'namespace:payments']) {
      const report = await runKnowledgeResource(tempRoot, 'helm', resource, 50);
      const target = report.targets[0];
      const deploymentLink = target.deploymentLinks?.[0];

      assert.equal(report.resource, resource);
      assertDomainScoped(report, 'helm', 'charts/payments-api');
      assert.ok(report.suggestedFiles.includes('apps/payments-api.yaml'));
      assert.ok(report.suggestedFiles.includes('charts/payments-api/Chart.yaml'));
      assert.ok(report.suggestedFiles.includes('charts/payments-api/values.yaml'));
      assert.ok(report.suggestedFiles.includes('charts/payments-api/values-prod.yaml'));
      assert.equal(report.suggestedFiles.includes('charts/payments-api/secret-values.yaml'), false);
      assert.ok(report.sources.some(source => source.source.name === 'payments-api:home'));
      assert.ok(report.pack.sources.some(source => source.kind === 'chart-docs' && source.name === 'payments-api:home'));
      assert.ok(report.pack.units.some(unit => unit.path === 'chart.payments-api.image.repository'));
      assert.ok(report.unitIndex.fieldEntries.some(entry =>
        entry.resourceKey === 'chart.payments-api'
        && entry.fieldPath === 'image.repository'
      ));
      assert.ok(target.lookupIdentities.includes(resource));
      assert.equal(deploymentLink?.applicationName, 'payments-api-prod');
      assert.equal(deploymentLink?.destinationNamespace, 'payments');
      assert.deepEqual(deploymentLink?.valuesLayers.map(layer => layer.path), [
        'charts/payments-api/values.yaml',
        'charts/payments-api/values-prod.yaml'
      ]);
      assertCompactResourceReport(
        report,
        /secret-values\.yaml|repository:\s*example\/payments-api|replicaCount:\s*2|"\$schema"|kubernetes\.default\.svc|password|authorization|bearer/
      );
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
