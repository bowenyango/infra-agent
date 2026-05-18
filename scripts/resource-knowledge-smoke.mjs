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
import { main as runCli } from '../src/cli/main.ts';
import { buildHelmChartKnowledgeSources } from '../src/domain/helm-chart-context.ts';
import { inspectWorkspace } from '../src/domain/inspect-workspace.ts';
import { writeKnowledgeCacheEntry } from '../src/knowledge/cache.ts';
import { buildKnowledgeSourcesReport } from '../src/knowledge/sources.ts';

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

function parseJsonOutput(output) {
  const start = output.indexOf('{');
  assert.notEqual(start, -1, `expected JSON output, received: ${output}`);
  return JSON.parse(output.slice(start));
}

async function captureStdout(run) {
  const originalWrite = process.stdout.write;
  let output = '';

  process.stdout.write = (chunk, encoding, callback) => {
    output += String(chunk);
    if (typeof encoding === 'function') {
      encoding();
    } else if (typeof callback === 'function') {
      callback();
    }
    return true;
  };

  try {
    await run();
  } finally {
    process.stdout.write = originalWrite;
  }

  return output;
}

async function runInfraAgentJson(args) {
  return parseJsonOutput(await captureStdout(() => runCli(args)));
}

function assertShortDigest(value, fieldName) {
  assert.match(value, /^[a-f0-9]{12}$/, `${fieldName} should be a short digest`);
}

function assertFiveUnitTypes(report) {
  const unitTypes = new Set(report.pack.units.map(unit => unit.unitType));
  assert.ok(['fact', 'guidance', 'example', 'diagnostic', 'recipe'].every(unitType => unitTypes.has(unitType)));
}

function assertCompactOneShotReport(report, options) {
  const reportText = JSON.stringify(report);
  assert.equal(report.kind, 'infra-agent.knowledge-resource-report');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mutationAllowed, false);
  assert.equal(report.summary.matchedTargetCount, 1);
  assert.equal(report.summary.recommendedAction, 'use-resource-knowledge');
  assert.deepEqual(report.requestedDomains, [options.domain]);
  assert.deepEqual(report.targetPaths, [options.targetPath]);
  assert.ok(report.validationTargets.includes(options.targetPath));
  assert.ok(report.targets.every(target => target.domain === options.domain && target.path === options.targetPath));
  assert.ok(report.sources.every(source => source.domain === options.domain && source.targetPath === options.targetPath));
  assert.ok(report.pack.sources.every(source => source.domain === options.domain && source.targetPath === options.targetPath));
  assert.ok(report.unitIndex.entries.every(entry => entry.domain === options.domain && entry.targetPath === options.targetPath));
  assert.equal(report.summary.includedUnitCount, report.pack.includedUnitCount);
  assert.equal(report.summary.sourceCount, report.sources.length);
  assert.equal(report.cachePosture.packId, report.pack.packId);
  assert.equal(report.cachePosture.reusable, true);
  assertShortDigest(report.cachePosture.selectionHash, 'selectionHash');
  assertShortDigest(report.cachePosture.targetHash, 'targetHash');
  assertShortDigest(report.cachePosture.sourceHash, 'sourceHash');
  assertShortDigest(report.cachePosture.unitIndexHash, 'unitIndexHash');
  assertFiveUnitTypes(report);
  assert.ok(report.suggestedFiles.includes(options.requiredFile));
  assert.ok(report.pack.units.some(unit => unit.path === options.requiredUnitPath));
  assert.ok(report.unitIndex.fieldEntries.some(entry =>
    entry.resourceKey === options.requiredResourceKey
    && entry.fieldPath === options.requiredFieldPath
  ));
  assert.doesNotMatch(reportText, /"content"\s*:|"rawContent"\s*:/);
  assert.doesNotMatch(reportText, options.forbiddenPattern);
}

async function writeKnowledgeSmokeWorkspace(root) {
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

async function writeHelmSmokeWorkspace(root) {
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

  const chartPath = join(root, 'charts/payments-api/Chart.yaml');
  const chartYaml = await readFile(chartPath, 'utf8');
  await writeFile(
    chartPath,
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

async function seedKnowledgeSmokeCaches(root) {
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

async function seedHelmSmokeCaches(root) {
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

async function main() {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-resource-knowledge-smoke-'));

  try {
    const knowledgeWorkspace = join(tempRoot, 'resource-knowledge-workspace');
    const helmWorkspace = join(tempRoot, 'helm-resource-knowledge-workspace');
    await writeKnowledgeSmokeWorkspace(knowledgeWorkspace);
    await writeHelmSmokeWorkspace(helmWorkspace);
    await seedKnowledgeSmokeCaches(knowledgeWorkspace);
    await seedHelmSmokeCaches(helmWorkspace);

    const terraformReport = await runInfraAgentJson([
      'knowledge',
      'resource',
      knowledgeWorkspace,
      '--domain',
      'terraform',
      '--resource',
      'resource:aws_s3_bucket',
      '--max-units',
      '20',
      '--json'
    ]);
    assertCompactOneShotReport(terraformReport, {
      domain: 'terraform',
      targetPath: 'terraform/api',
      requiredFile: 'terraform/api/main.tf',
      requiredUnitPath: 'resource.aws_s3_bucket.bucket',
      requiredResourceKey: 'resource.aws_s3_bucket',
      requiredFieldPath: 'bucket',
      forbiddenPattern: /aws_sqs_queue|UNRELATED_|secretToken|password|authorization|bearer/
    });

    const pulumiReport = await runInfraAgentJson([
      'knowledge',
      'resource',
      knowledgeWorkspace,
      '--domain',
      'pulumi',
      '--resource',
      'pulumi:aws:s3/bucket:Bucket',
      '--max-units',
      '20',
      '--json'
    ]);
    assertCompactOneShotReport(pulumiReport, {
      domain: 'pulumi',
      targetPath: 'infra/api',
      requiredFile: 'infra/api/Pulumi.yaml',
      requiredUnitPath: 'pulumi.resource.aws.s3.bucket.Bucket.bucket',
      requiredResourceKey: 'pulumi.resource.aws.s3.bucket.Bucket',
      requiredFieldPath: 'bucket',
      forbiddenPattern: /aws:sns\/topic:Topic|UNRELATED_TOPIC_MARKER|apiToken|secure|secretToken|password|authorization|bearer/
    });

    const helmReport = await runInfraAgentJson([
      'knowledge',
      'resource',
      helmWorkspace,
      '--domain',
      'helm',
      '--resource',
      'argocd:payments-api-prod',
      '--max-units',
      '50',
      '--json'
    ]);
    assertCompactOneShotReport(helmReport, {
      domain: 'helm',
      targetPath: 'charts/payments-api',
      requiredFile: 'apps/payments-api.yaml',
      requiredUnitPath: 'chart.payments-api.image.repository',
      requiredResourceKey: 'chart.payments-api',
      requiredFieldPath: 'image.repository',
      forbiddenPattern: /secret-values\.yaml|repository:\s*example\/payments-api|replicaCount:\s*2|"\$schema"|kubernetes\.default\.svc|password|authorization|bearer/
    });

    process.stdout.write(`resource knowledge smoke passed (${tempRoot})\n`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`resource knowledge smoke failed: ${message}\n`);
  process.exit(1);
});
