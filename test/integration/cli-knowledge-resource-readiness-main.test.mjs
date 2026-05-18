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

function assertEmptyUnitSummary(report, status) {
  assert.equal(report.summary.acceptanceStatus, status);
  assert.equal(report.summary.unitTypeComplete, false);
  assert.deepEqual(report.summary.includedUnitTypes, []);
  assert.deepEqual(report.summary.missingUnitTypes, ['fact', 'guidance', 'example', 'diagnostic', 'recipe']);
  assert.deepEqual(report.summary.unitCounts, {
    fact: 0,
    guidance: 0,
    example: 0,
    diagnostic: 0,
    recipe: 0
  });
}

function assertCachePostureIsCompact(cachePosture) {
  const postureText = jsonText(cachePosture);

  assert.doesNotMatch(postureText, /[a-f0-9]{64}/);
  assert.doesNotMatch(postureText, /"url"|"localPath"|"content"|"rawContent"|"fingerprint"\s*:|"files"\s*:/);
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

async function writeResourceWorkspace(root) {
  const terraformRoot = join(root, 'terraform/api');
  await mkdir(terraformRoot, { recursive: true });
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
      ''
    ].join('\n'),
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

async function seedTerraformBucketCache(root) {
  const inspection = await inspectWorkspace(root);
  const report = await buildKnowledgeSourcesReport(inspection, {
    domains: ['terraform'],
    targetPaths: ['terraform/api']
  });
  const source = report.sources.find(candidate => candidate.source.name === 'resource:aws_s3_bucket');
  assert.ok(source);
  await writeKnowledgeCacheEntry(inspection.knowledgeCache.root, {
    source: source.source,
    contentType: 'text/markdown',
    content: [
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
    ].join('\n'),
    fetchedAt: '2026-05-01T00:00:00.000Z',
    staleAfter: '2099-01-01T00:00:00.000Z'
  });
}

async function seedOnlyHelmHomeDocsCache(root) {
  const inspection = await inspectWorkspace(root);
  const report = await buildKnowledgeSourcesReport(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api']
  });
  const source = report.sources.find(candidate => candidate.source.name === 'payments-api:home');
  assert.ok(source);
  await writeKnowledgeCacheEntry(inspection.knowledgeCache.root, {
    source: source.source,
    contentType: 'text/markdown',
    content: API_CHART_DOCS_MARKDOWN,
    fetchedAt: '2026-05-01T00:00:00.000Z',
    staleAfter: '2099-01-01T00:00:00.000Z'
  });

  return source.id;
}

test('knowledge resource report scopes cache readiness to requested source ids', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-resource-readiness-source-filter-'));

  try {
    await writeHelmResourceWorkspace(tempRoot);
    const homeSourceId = await seedOnlyHelmHomeDocsCache(tempRoot);

    const report = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'resource',
      tempRoot,
      '--domain',
      'helm',
      '--resource',
      'chart:payments-api',
      '--source',
      homeSourceId,
      '--max-units',
      '50',
      '--json'
    ])));

    assert.deepEqual(report.sourceIds, [homeSourceId]);
    assert.equal(report.summary.matchedTargetCount, 1);
    assert.equal(report.summary.sourceCount, 1);
    assert.equal(report.summary.recommendedAction, 'use-resource-knowledge');
    assertReadyAcceptanceSummary(report);
    assert.deepEqual(report.sources.map(source => source.id), [homeSourceId]);
    assert.deepEqual(report.pack.sourceIds, [homeSourceId]);
    assert.deepEqual(report.pack.sources.map(source => source.id), [homeSourceId]);
    assert.equal(report.cachePosture.sourceCount, 1);
    assert.equal(report.cachePosture.missing, 0);
    assert.equal(report.cachePosture.stale, 0);
    assert.equal(report.cachePosture.reusable, true);
    assert.deepEqual(report.cachePosture.sources.map(source => source.sourceId), [homeSourceId]);
    assert.equal(report.cachePosture.sources[0].sourceName, 'payments-api:home');
    assert.equal(report.cachePosture.sources[0].cacheStatus, 'fresh');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge resource report marks partial unit coverage under tight unit budgets', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-resource-readiness-partial-'));

  try {
    await writeResourceWorkspace(tempRoot);
    await seedTerraformBucketCache(tempRoot);

    const report = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'resource',
      tempRoot,
      '--domain',
      'terraform',
      '--resource',
      'aws_s3_bucket.logs',
      '--max-units',
      '1',
      '--json'
    ])));

    assert.equal(report.summary.matchedTargetCount, 1);
    assert.equal(report.summary.recommendedAction, 'use-resource-knowledge');
    assert.equal(report.summary.acceptanceStatus, 'partial-unit-coverage');
    assert.equal(report.summary.cacheReady, true);
    assert.equal(report.summary.unitTypeComplete, false);
    assert.ok(report.summary.includedUnitTypes.length > 0);
    assert.ok(report.summary.missingUnitTypes.includes('example'));
    assert.ok(report.summary.missingUnitTypes.length > 0);
    assert.equal(
      Object.values(report.summary.unitCounts).reduce((sum, count) => sum + count, 0),
      report.summary.includedUnitCount
    );
    assert.equal(report.cachePosture.reusable, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge resource report marks cache refresh needed when selected sources are missing', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-resource-readiness-cache-refresh-'));

  try {
    await writeHelmResourceWorkspace(tempRoot);

    const report = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'resource',
      tempRoot,
      '--domain',
      'helm',
      '--resource',
      'argocd:payments-api-prod',
      '--max-units',
      '50',
      '--json'
    ])));

    assert.equal(report.summary.matchedTargetCount, 1);
    assert.equal(report.summary.recommendedAction, 'prefetch-or-extract-knowledge');
    assert.equal(report.summary.acceptanceStatus, 'cache-refresh-needed');
    assert.equal(report.summary.cacheReady, false);
    assert.equal(report.summary.unitTypeComplete, false);
    assert.ok(report.summary.includedUnitTypes.includes('fact'));
    assert.ok(report.summary.missingUnitTypes.includes('example'));
    assert.ok(report.summary.missingOrSkippedSourceCount > 0);
    assert.ok(report.cachePosture.missing > 0);
    assert.equal(report.cachePosture.reusable, false);
    assert.ok(report.cachePosture.sources.some(source =>
      source.requiresFetch
      && source.cacheStatus === 'missing'
      && source.includedUnitCount === 0
    ));
    assert.ok(report.suggestedFiles.includes('apps/payments-api.yaml'));
    assert.deepEqual(report.targetPaths, ['charts/payments-api']);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge resource report marks an empty pack when requested source ids select no units', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-resource-readiness-empty-pack-'));

  try {
    await writeResourceWorkspace(tempRoot);
    await seedTerraformBucketCache(tempRoot);

    const report = parseJsonOutput(await captureStdout(() => main([
      'knowledge',
      'resource',
      tempRoot,
      '--domain',
      'terraform',
      '--resource',
      'aws_s3_bucket.logs',
      '--source',
      'knowledge-source-does-not-exist',
      '--max-units',
      '10',
      '--json'
    ])));

    assert.equal(report.summary.matchedTargetCount, 1);
    assert.equal(report.summary.sourceCount, 0);
    assert.equal(report.summary.includedUnitCount, 0);
    assert.equal(report.summary.recommendedAction, 'prefetch-or-extract-knowledge');
    assertEmptyUnitSummary(report, 'empty-knowledge-pack');
    assert.equal(report.summary.cacheReady, true);
    assert.deepEqual(report.sources, []);
    assert.deepEqual(report.pack.sources, []);
    assert.deepEqual(report.unitIndex.entries, []);
    assert.equal(report.cachePosture.sourceCount, 0);
    assert.equal(report.cachePosture.reusable, false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge resource report does not fall back when a resource is unmatched', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-resource-readiness-miss-'));

  try {
    await writeResourceWorkspace(tempRoot);
    await seedTerraformBucketCache(tempRoot);

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
    assertEmptyUnitSummary(report, 'unmatched-resource');
    assert.equal(report.summary.cacheReady, false);
    assert.deepEqual(report.targets, []);
    assert.deepEqual(report.sources, []);
    assert.deepEqual(report.pack.sources, []);
    assert.deepEqual(report.pack.units, []);
    assert.deepEqual(report.unitIndex.entries, []);
    assert.deepEqual(report.unitIndex.fieldEntries, []);
    assert.equal(report.unitIndex.fieldEntryCount, 0);
    assert.equal(report.unitIndex.fieldIncludedUnitCount, 0);
    assert.equal(report.cachePosture.packId, report.pack.packId);
    assert.equal(report.cachePosture.sourceCount, 0);
    assert.equal(report.cachePosture.local, 0);
    assert.equal(report.cachePosture.fresh, 0);
    assert.equal(report.cachePosture.stale, 0);
    assert.equal(report.cachePosture.missing, 0);
    assert.equal(report.cachePosture.refreshRecommended, 0);
    assert.equal(report.cachePosture.reusedSourceCount, 0);
    assert.equal(report.cachePosture.reusable, false);
    assert.deepEqual(report.cachePosture.sources, []);
    assertShortDigest(report.cachePosture.selectionHash, 'selectionHash');
    assertShortDigest(report.cachePosture.targetHash, 'targetHash');
    assertShortDigest(report.cachePosture.sourceHash, 'sourceHash');
    assertShortDigest(report.cachePosture.unitIndexHash, 'unitIndexHash');
    assertCachePostureIsCompact(report.cachePosture);
    assert.doesNotMatch(reportText, /aws_s3_bucket|UNRELATED_/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
