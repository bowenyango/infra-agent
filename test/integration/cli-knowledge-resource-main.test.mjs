import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { writeKnowledgeCacheEntry } from '../../src/knowledge/cache.ts';
import { buildKnowledgeSourcesReport } from '../../src/knowledge/sources.ts';

function parseJsonOutput(output) {
  return JSON.parse(output.slice(output.indexOf('{')));
}

function jsonText(value) {
  return JSON.stringify(value);
}

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
    assert.doesNotMatch(reportText, /aws:sns\/topic:Topic|UNRELATED_TOPIC_MARKER|secretToken|password|authorization|bearer|"content"\s*:|"rawContent"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge resource report does not fall back when a resource is unmatched', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-resource-report-miss-'));

  try {
    await writeResourceWorkspace(tempRoot);
    await seedResourceCaches(tempRoot);

    const report = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'resource',
      tempRoot,
      '--domain',
      'terraform',
      '--resource',
      'aws_db_instance.primary',
      '--max-units',
      '10',
      '--json'
    ])));
    const reportText = jsonText(report);

    assert.equal(report.kind, 'infra-agent.knowledge-resource-report');
    assert.equal(report.resource, 'aws_db_instance.primary');
    assert.deepEqual(report.targetPaths, []);
    assert.equal(report.summary.matchedTargetCount, 0);
    assert.equal(report.summary.sourceCount, 0);
    assert.equal(report.summary.includedRefCount, 0);
    assert.equal(report.summary.includedUnitCount, 0);
    assert.equal(report.summary.recommendedAction, 'narrow-scope');
    assert.deepEqual(report.targets, []);
    assert.deepEqual(report.sources, []);
    assert.deepEqual(report.pack.sources, []);
    assert.deepEqual(report.pack.units, []);
    assert.deepEqual(report.unitIndex.entries, []);
    assert.doesNotMatch(reportText, /aws_s3_bucket|aws_sqs_queue|aws_iam_policy_document|UNRELATED_/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
