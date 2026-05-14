import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { writeKnowledgeCacheEntry } from '../../src/knowledge/cache.ts';
import { extractKnowledgeFactSetFromCacheEntry } from '../../src/knowledge/facts.ts';
import { extractMarkdownKnowledgeUnitsFromCacheEntry } from '../../src/knowledge/markdown-units.ts';
import { extractKnowledgeUnitSetFromFactSet } from '../../src/knowledge/units.ts';
import { parseKnowledgeUnitSet } from '../../src/knowledge/knowledge-unit-contract.ts';
import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';

test('knowledge unit extraction promotes examples and infra guidance from fact sets', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-unit-extract-'));

  try {
    const source = {
      kind: 'terraform-registry',
      name: 'resource:aws_s3_bucket',
      provider: 'hashicorp/aws',
      version: '5.37.0',
      url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket'
    };
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'text/markdown',
      content: [
        '# aws_s3_bucket',
        '',
        '## Example Usage',
        '',
        '```hcl',
        'resource "aws_s3_bucket" "example" {',
        '  bucket = "example-bucket"',
        '}',
        '```',
        '',
        '## Argument Reference',
        '',
        '- `bucket` - (Optional) Name of the bucket. Forces replacement.',
        '- `force_destroy` - (Required) Whether objects should be deleted before bucket removal.',
        '',
        '## Attributes Reference',
        '',
        '- `arn` - ARN of the bucket.',
        ''
      ].join('\n'),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });
    const factSet = extractKnowledgeFactSetFromCacheEntry(entry, {
      extractedAt: '2026-05-05T00:00:00.000Z',
      now: new Date('2026-05-06T00:00:00.000Z')
    });
    const unitSet = extractKnowledgeUnitSetFromFactSet(factSet);
    const markdownUnits = extractMarkdownKnowledgeUnitsFromCacheEntry(entry, factSet);
    const parsed = parseKnowledgeUnitSet(unitSet);

    assert.equal(parsed.kind, 'infra-agent.knowledge-units');
    assert.equal(parsed.sourceId, factSet.sourceId);
    assert.equal(parsed.sourceContentHash, factSet.sourceContentHash);
    assert.ok(parsed.unitCount > factSet.factCount);
    assert.ok(parsed.units.some(unit =>
      unit.unitType === 'fact'
      && unit.factKind === 'argument'
      && unit.path === 'resource.aws_s3_bucket.bucket'
    ));
    assert.ok(parsed.units.some(unit =>
      unit.unitType === 'example'
      && unit.extractionMethod === 'official-example'
      && unit.exampleType === 'terraform-resource-snippet'
      && /aws_s3_bucket/.test(unit.snippet)
    ));
    assert.ok(parsed.units.some(unit =>
      unit.unitType === 'guidance'
      && unit.topic === 'provider-identity-field'
      && /rename, import, state, or alias/i.test(unit.summary)
    ));
    assert.ok(parsed.units.some(unit =>
      unit.unitType === 'guidance'
      && unit.topic === 'replacement-sensitive-field'
      && /replacement-sensitive/i.test(unit.summary)
    ));
    assert.ok(parsed.units.some(unit =>
      unit.unitType === 'guidance'
      && unit.topic === 'required-provider-input'
      && unit.path === 'guidance.required.resource.aws_s3_bucket.force_destroy'
    ));
    assert.ok(markdownUnits.some(unit =>
      unit.unitType === 'guidance'
      && unit.topic === 'argument-reference'
      && unit.path.includes('markdown')
    ));
    assert.ok(parsed.units.some(unit =>
      unit.unitType === 'diagnostic'
      && unit.engine === 'provider'
      && unit.signature === 'identity-field:resource.aws_s3_bucket.bucket'
    ));
    assert.ok(parsed.units.some(unit =>
      unit.unitType === 'diagnostic'
      && unit.engine === 'provider'
      && unit.signature === 'replacement-sensitive-field:resource.aws_s3_bucket.bucket'
    ));
    assert.ok(parsed.units.some(unit =>
      unit.unitType === 'recipe'
      && unit.extractionMethod === 'workflow-recipe'
      && unit.name === 'Plan Terraform identity-sensitive edits'
      && unit.mutationAllowed === false
    ));
    const validationReport = validateKnowledgePayload(parsed, 'inline');
    assert.equal(validationReport.valid, true);
    assert.equal(validationReport.unitSetCount, 1);
    assert.equal(validationReport.unitCount, parsed.unitCount);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('markdown knowledge unit extraction promotes explicit docs sections into five unit types', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-markdown-unit-extract-'));

  try {
    const source = {
      kind: 'chart-docs',
      name: 'chart-docs:payments-api',
      chart: 'payments-api',
      version: '0.1.0',
      url: 'https://charts.example.test/payments-api/README.md'
    };
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'text/markdown',
      content: [
        '# payments-api',
        '',
        '## Values',
        '',
        '- `service.port` - Required service port used by the Kubernetes Service.',
        '',
        '## Example Values',
        '',
        '```yaml',
        'service:',
        '  port: 8080',
        '```',
        '',
        '## Best Practices',
        '',
        'Always set service.port explicitly before rendering this chart.',
        '',
        '## Upgrade Workflow',
        '',
        '1. Update values.yaml for the target environment.',
        '2. Render the chart with helm template.',
        '3. Review changed Service and Deployment manifests.',
        '',
        '## Common Problems',
        '',
        '`Error: service.port is required` usually means the environment values file omitted the service port.',
        '',
        '- Check values.yaml and environment override files.',
        '- Run helm template for the selected chart.',
        ''
      ].join('\n'),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });
    const factSet = extractKnowledgeFactSetFromCacheEntry(entry, {
      extractedAt: '2026-05-05T00:00:00.000Z',
      now: new Date('2026-05-06T00:00:00.000Z')
    });
    const markdownUnits = extractMarkdownKnowledgeUnitsFromCacheEntry(entry, factSet);
    const unitSet = extractKnowledgeUnitSetFromFactSet(factSet, markdownUnits);

    assert.ok(unitSet.units.some(unit =>
      unit.unitType === 'fact'
      && unit.factKind === 'chart-value'
      && unit.path === 'chart.payments-api.service.port'
    ));
    assert.ok(unitSet.units.some(unit =>
      unit.unitType === 'example'
      && unit.exampleType === 'helm-docs-example'
      && unit.language === 'yaml'
      && /service:\n  port: 8080/.test(unit.snippet)
    ));
    assert.ok(unitSet.units.some(unit =>
      unit.unitType === 'guidance'
      && unit.topic === 'values'
      && unit.path.includes('markdown')
    ));
    assert.ok(unitSet.units.some(unit =>
      unit.unitType === 'guidance'
      && unit.topic === 'best-practices'
      && /service.port explicitly/i.test(unit.summary)
    ));
    assert.ok(unitSet.units.some(unit =>
      unit.unitType === 'diagnostic'
      && unit.engine === 'helm'
      && unit.source.locator === 'markdown:Common Problems'
      && unit.signature === 'Error: service.port is required'
    ));
    assert.ok(unitSet.units.some(unit =>
      unit.unitType === 'recipe'
      && unit.name === 'Upgrade Workflow'
      && unit.steps.length === 3
      && unit.mutationAllowed === false
    ));
    assert.equal(validateKnowledgePayload(unitSet, 'inline').valid, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('markdown knowledge unit extraction handles Pulumi docs examples and diagnostics', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-markdown-unit-extract-'));

  try {
    const source = {
      kind: 'pulumi-docs',
      name: 'pulumi-docs:resource:aws:s3/bucket',
      packageName: 'aws',
      module: 'aws:s3/bucket:Bucket',
      url: 'https://www.pulumi.com/registry/packages/aws/api-docs/s3/bucket/'
    };
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'text/markdown',
      content: [
        '# Bucket',
        '',
        '## Inputs',
        '',
        '| Name | Type | Description |',
        '| --- | --- | --- |',
        '| `bucket` | string | Name of the bucket to create. |',
        '',
        '## Example Usage',
        '',
        '```typescript',
        'const bucket = new aws.s3.Bucket("site", {',
        '  bucket: "site-bucket",',
        '});',
        '```',
        '',
        '## Compatibility Warnings',
        '',
        'Bucket names are globally unique and incompatible replacements should be reviewed before changing identity fields.',
        '',
        '## Migration Workflow',
        '',
        '1. Confirm whether the bucket name is changing or only the Pulumi logical name is changing.',
        '2. Add aliases or import/state review when preserving the physical bucket.',
        '3. Run pulumi preview and inspect replacements.',
        '',
        '## Importing resources',
        '',
        '1. Review the existing cloud resource and matching Pulumi type.',
        '2. Run pulumi import with the provider ID before previewing updates.',
        '',
        '## Troubleshooting',
        '',
        '`BucketAlreadyExists` usually means another stack or account owns the requested bucket name.',
        '',
        '- Confirm the owning account and region.',
        '- Use import or aliases when preserving an existing bucket.',
        ''
      ].join('\n'),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });
    const factSet = extractKnowledgeFactSetFromCacheEntry(entry, {
      extractedAt: '2026-05-05T00:00:00.000Z',
      now: new Date('2026-05-06T00:00:00.000Z')
    });
    const markdownUnits = extractMarkdownKnowledgeUnitsFromCacheEntry(entry, factSet);
    const unitSet = extractKnowledgeUnitSetFromFactSet(factSet, markdownUnits);

    assert.ok(unitSet.units.some(unit =>
      unit.unitType === 'fact'
      && unit.factKind === 'argument'
      && unit.path === 'pulumi.resource.aws.s3.bucket.Bucket.bucket'
    ));
    assert.ok(unitSet.units.some(unit =>
      unit.unitType === 'example'
      && unit.exampleType === 'pulumi-docs-example'
      && unit.language === 'typescript'
      && /new aws\.s3\.Bucket/.test(unit.snippet)
    ));
    assert.ok(unitSet.units.some(unit =>
      unit.unitType === 'guidance'
      && unit.topic === 'inputs'
      && unit.path.includes('markdown')
    ));
    assert.ok(unitSet.units.some(unit =>
      unit.unitType === 'guidance'
      && unit.topic === 'compatibility-warnings'
      && /globally unique/i.test(unit.summary)
      && /incompatible/i.test(unit.risk ?? '')
    ));
    assert.ok(unitSet.units.some(unit =>
      unit.unitType === 'diagnostic'
      && unit.engine === 'pulumi'
      && unit.signature === 'BucketAlreadyExists'
    ));
    assert.ok(unitSet.units.some(unit =>
      unit.unitType === 'recipe'
      && unit.name === 'Migration Workflow'
      && unit.requiresApproval === true
      && unit.steps.length === 3
    ));
    assert.ok(unitSet.units.some(unit =>
      unit.unitType === 'recipe'
      && unit.name === 'Importing resources'
      && unit.requiresApproval === true
      && unit.steps.length === 2
    ));
    assert.equal(validateKnowledgePayload(unitSet, 'inline').valid, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('markdown knowledge unit extraction skips secret-like sections', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-secret-markdown-unit-extract-'));

  try {
    const source = {
      kind: 'chart-docs',
      name: 'chart-docs:redaction-safe-chart',
      chart: 'redaction-safe-chart',
      version: '0.1.0',
      url: 'https://charts.example.test/redaction-safe-chart/README.md'
    };
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'text/markdown',
      content: [
        '# redaction-safe-chart',
        '',
        '## Values',
        '',
        '- `service.port` - Required service port used by the Kubernetes Service.',
        '',
        '## Example Values',
        '',
        '```yaml',
        'apiToken: example-token',
        '```',
        '',
        '## Important Notes',
        '',
        'Never include Authorization headers in reusable chart examples.',
        '',
        '## Troubleshooting',
        '',
        '`Error: missing secret token` means a private credential was not provided.',
        ''
      ].join('\n'),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });
    const factSet = extractKnowledgeFactSetFromCacheEntry(entry, {
      extractedAt: '2026-05-05T00:00:00.000Z',
      now: new Date('2026-05-06T00:00:00.000Z')
    });
    const markdownUnits = extractMarkdownKnowledgeUnitsFromCacheEntry(entry, factSet);
    const unitSet = extractKnowledgeUnitSetFromFactSet(factSet, markdownUnits);

    assert.equal(markdownUnits.length, 1);
    assert.ok(unitSet.units.some(unit =>
      unit.unitType === 'fact'
      && unit.factKind === 'chart-value'
      && unit.path === 'chart.redaction-safe-chart.service.port'
    ));
    assert.ok(unitSet.units.every(unit =>
      !/apiToken|example-token|Authorization|secret token/i.test(JSON.stringify(unit))
    ));
    assert.equal(validateKnowledgePayload(unitSet, 'inline').valid, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
