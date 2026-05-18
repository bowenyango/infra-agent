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
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { buildRefsReport } from '../../src/domain/refs.ts';

function assertNoRawReferencePayload(value) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      assertNoRawReferencePayload(entry);
    }
    return;
  }

  if (typeof value !== 'object' || value === null) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    assert.equal(key === 'url', false, 'refs output must not expose source URLs');
    assert.equal(key === 'content', false, 'refs output must not expose raw cache content');
    assert.equal(key === 'contentHash', false, 'refs output must not expose content hashes');
    assert.equal(key === 'fetchedAt', false, 'refs output must not expose fetch timestamps');
    assert.equal(key === 'staleAfter', false, 'refs output must not expose stale timestamps');
    assertNoRawReferencePayload(child);
  }
}

test('buildRefsReport emits scoped Helm interface refs without raw reference payloads', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = await buildRefsReport(inspection, {
    scope: 'charts/payments-api',
    domains: ['helm'],
    maxUnits: 3
  });

  assert.equal(report.kind, 'infra-agent.refs');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mutationAllowed, false);
  assert.equal(report.scope.normalized, 'charts/payments-api');
  assert.deepEqual(report.filters.domains, ['helm']);
  assert.equal(report.filters.maxUnits, 3);
  assert.equal(report.summary.matchedTargetCount, 1);
  assert.equal(report.summary.includedRefCount, 3);
  assert.equal(report.summary.omittedRefCount, 4);
  assert.deepEqual(report.summary.domains, ['helm']);
  assert.equal(report.targets[0]?.path, 'charts/payments-api');
  assert.ok(report.targets[0]?.interfaceKinds.includes('helm-values-schema:required-field'));
  assert.ok(report.sources.some(source =>
    source.sourceKind === 'chart-schema'
    && source.sourceName === 'payments-api:values.schema.json'
    && source.freshness === 'local'
  ));
  assert.ok(report.sources.some(source =>
    source.sourceKind === 'helm-docs'
    && source.freshness === 'missing'
    && source.refreshRecommended === true
  ));
  assert.ok(report.refs.some(ref =>
    ref.kind === 'required-field'
    && ref.path === 'image'
    && ref.source.kind === 'helm-values-schema'
  ));
  assertNoRawReferencePayload(report);
});

test('buildRefsReport reports unmatched scopes as narrow-scope without selecting references', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = await buildRefsReport(inspection, {
    scope: 'missing-component',
    domains: ['helm']
  });

  assert.equal(report.summary.matchedTargetCount, 0);
  assert.equal(report.summary.includedRefCount, 0);
  assert.equal(report.summary.recommendedAction, 'narrow-scope');
  assert.equal(report.omitted.unmatchedScope, true);
  assert.deepEqual(report.targets, []);
  assert.deepEqual(report.sources, []);
  assert.deepEqual(report.refs, []);
});

test('buildRefsReport resolves compact resource identities to Helm, Pulumi, and Terraform targets', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-refs-resource-identity-'));

  try {
    await mkdir(join(tempRoot, 'charts/api'), { recursive: true });
    await mkdir(join(tempRoot, 'infra/api'), { recursive: true });
    await mkdir(join(tempRoot, 'terraform/api'), { recursive: true });
    await writeFile(
      join(tempRoot, 'charts/api/Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.1.0',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(join(tempRoot, 'charts/api/values.yaml'), 'image:\n  tag: latest\n', 'utf8');
    await writeFile(
      join(tempRoot, 'charts/api/values.schema.json'),
      JSON.stringify({
        type: 'object',
        properties: {
          image: {
            type: 'object',
            properties: {
              tag: { type: 'string' }
            }
          }
        }
      }),
      'utf8'
    );
    await writeFile(
      join(tempRoot, 'infra/api/Pulumi.yaml'),
      [
        'name: api',
        'runtime: yaml',
        'resources:',
        '  bucket:',
        '    type: aws:s3/bucket:Bucket',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(tempRoot, 'terraform/api/main.tf'),
      [
        'resource "aws_s3_bucket" "logs" {',
        '  bucket = "example-logs"',
        '}',
        '',
        'data "aws_iam_policy_document" "assume" {}',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const helmReport = await buildRefsReport(inspection, {
      scope: 'chart:api',
      domains: ['helm']
    });
    const pulumiReport = await buildRefsReport(inspection, {
      scope: 'aws:s3/bucket:Bucket',
      domains: ['pulumi']
    });
    const terraformReport = await buildRefsReport(inspection, {
      scope: 'aws_s3_bucket.logs',
      domains: ['terraform']
    });
    const terraformDataReport = await buildRefsReport(inspection, {
      scope: 'data.aws_iam_policy_document.assume',
      domains: ['terraform']
    });

    assert.equal(helmReport.summary.matchedTargetCount, 1);
    assert.equal(helmReport.targets[0]?.path, 'charts/api');
    assert.ok(helmReport.targets[0]?.matchReasons.includes('scope matches resource identity'));
    assert.ok(helmReport.targets[0]?.lookupIdentities.includes('chart:api'));

    assert.equal(pulumiReport.summary.matchedTargetCount, 1);
    assert.equal(pulumiReport.targets[0]?.path, 'infra/api');
    assert.ok(pulumiReport.targets[0]?.matchReasons.includes('scope matches resource identity'));
    assert.ok(pulumiReport.targets[0]?.resourceTypes?.includes('aws:s3/bucket:Bucket'));

    assert.equal(terraformReport.summary.matchedTargetCount, 1);
    assert.equal(terraformReport.targets[0]?.path, 'terraform/api');
    assert.ok(terraformReport.targets[0]?.matchReasons.includes('scope matches resource identity'));
    assert.ok(terraformReport.targets[0]?.resourceTypes?.includes('aws_s3_bucket'));
    assert.ok(terraformReport.targets[0]?.files.primary.includes('terraform/api/main.tf'));

    assert.equal(terraformDataReport.summary.matchedTargetCount, 1);
    assert.ok(terraformDataReport.targets[0]?.dataSourceTypes?.includes('aws_iam_policy_document'));
    assert.ok(terraformDataReport.sources.some(source =>
      source.sourceKind === 'terraform-registry'
      && source.sourceName === 'resource:aws_s3_bucket'
    ));
    assertNoRawReferencePayload(terraformReport);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
