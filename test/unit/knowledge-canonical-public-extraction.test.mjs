import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { extractKnowledgeFactSetFromCacheEntry } from '../../src/knowledge/facts.ts';
import { extractMarkdownKnowledgeUnitsFromCacheEntry } from '../../src/knowledge/markdown-units.ts';
import { extractKnowledgeUnitSetFromFactSet } from '../../src/knowledge/units.ts';
import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';
import {
  CANONICAL_PUBLIC_KNOWLEDGE_TARGET_KEYS,
  writeCanonicalPublicKnowledgeCacheFixtures
} from '../support/canonical-public-knowledge-fixtures.mjs';

const EXPECTED_UNIT_TYPES = ['diagnostic', 'example', 'fact', 'guidance', 'recipe'];
const CANONICAL_VARIANT_ASSERTIONS = {
  terraformAwsProviderDocs: [
    {
      label: 'Terraform Basic Usage example',
      predicate: unit => unit.unitType === 'example'
        && unit.source.locator.includes('Basic Usage')
        && unit.language === 'hcl'
        && unit.snippet.includes('required_providers')
    },
    {
      label: 'Terraform nested Arguments facts',
      predicate: unit => unit.unitType === 'fact'
        && unit.path.endsWith('.assume_role')
        && unit.source.locator === 'Arguments: assume_role'
    },
    {
      label: 'Terraform singular Attribute Reference facts',
      predicate: unit => unit.unitType === 'fact'
        && unit.path.endsWith('.account_id')
        && unit.source.locator === 'Attribute Reference: account_id'
    },
    {
      label: 'Terraform compatibility guidance',
      predicate: unit => unit.unitType === 'guidance'
        && unit.topic === 'compatibility-and-requirements'
        && unit.source.locator === 'markdown:Compatibility and Requirements'
        && unit.summary.includes('Terraform CLI 1.5')
    },
    {
      label: 'Terraform import/state recipe with init validate plan',
      predicate: unit => unit.unitType === 'recipe'
        && unit.name === 'Import and State Workflow'
        && unit.source.locator === 'markdown:Import and State Workflow'
        && unit.steps.some(step => step.includes('terraform init'))
        && unit.steps.some(step => step.includes('terraform validate'))
        && unit.steps.some(step => step.includes('terraform plan'))
    },
    {
      label: 'Terraform validation diagnostic',
      predicate: unit => unit.unitType === 'diagnostic'
        && unit.source.locator === 'markdown:Validation Failures'
        && unit.signature === 'Error: invalid provider configuration'
    }
  ],
  pulumiAwsPackageDocs: [
    {
      label: 'Pulumi module/package facts',
      predicate: unit => unit.unitType === 'fact'
        && unit.path === 'pulumi.package.aws.ec2'
        && unit.source.locator === 'Pulumi package docs: ec2'
    },
    {
      label: 'Pulumi TypeScript usage example',
      predicate: unit => unit.unitType === 'example'
        && unit.source.locator === 'markdown:TypeScript Usage'
        && unit.language === 'typescript'
        && unit.snippet.includes('new aws.sns.Topic')
    },
    {
      label: 'Pulumi compatibility/preview guidance',
      predicate: unit => unit.unitType === 'guidance'
        && unit.topic === 'compatibility-and-preview-notes'
        && unit.source.locator === 'markdown:Compatibility and Preview Notes'
        && unit.summary.includes('Pulumi CLI 3.x')
    },
    {
      label: 'Pulumi preview recipe',
      predicate: unit => unit.unitType === 'recipe'
        && unit.name === 'Deployment Workflow'
        && unit.source.locator === 'markdown:Deployment Workflow'
        && unit.steps.some(step => step.includes('pulumi preview'))
    },
    {
      label: 'Pulumi preview diagnostic',
      predicate: unit => unit.unitType === 'diagnostic'
        && unit.source.locator === 'markdown:Troubleshooting Preview Failures'
        && unit.signature === 'error: preview failed because required provider region is missing'
    }
  ],
  helmKubePrometheusStackChartDocs: [
    {
      label: 'Helm values facts',
      predicate: unit => unit.unitType === 'fact'
        && unit.path === 'chart.kube-prometheus-stack.grafana.enabled'
        && unit.source.locator === 'Chart docs: grafana.enabled'
    },
    {
      label: 'Helm values example',
      predicate: unit => unit.unitType === 'example'
        && unit.source.locator === 'markdown:Example Values'
        && unit.language === 'yaml'
        && unit.snippet.includes('serviceMonitorSelectorNilUsesHelmValues')
    },
    {
      label: 'Helm prerequisites/selector guidance',
      predicate: unit => unit.unitType === 'guidance'
        && unit.topic === 'prerequisites-and-selector-notes'
        && unit.source.locator === 'markdown:Prerequisites and Selector Notes'
        && unit.summary.includes('monitoring CRDs')
    },
    {
      label: 'Helm template recipe',
      predicate: unit => unit.unitType === 'recipe'
        && unit.name === 'Template Workflow'
        && unit.source.locator === 'markdown:Template Workflow'
        && unit.steps.some(step => step.includes('helm template'))
    },
    {
      label: 'Helm validation diagnostic',
      predicate: unit => unit.unitType === 'diagnostic'
        && unit.source.locator === 'markdown:Validation Errors'
        && unit.signature === 'Error: rendered manifests failed validation'
    }
  ]
};

function assertValidKnowledgePayload(payload, label) {
  const report = validateKnowledgePayload(payload, label);
  assert.equal(report.valid, true, JSON.stringify(report.issues, null, 2));
}

function unitTypes(unitSet) {
  return Array.from(new Set(unitSet.units.map(unit => unit.unitType))).sort();
}

function assertCanonicalSourceIdentity(key, source) {
  if (key === 'terraformAwsProviderDocs') {
    assert.equal(source.kind, 'terraform-registry');
    assert.equal(source.provider, 'hashicorp/aws');
    assert.equal(source.url, 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs');
    return;
  }

  if (key === 'pulumiAwsPackageDocs') {
    assert.equal(source.kind, 'pulumi-docs');
    assert.equal(source.packageName, '@pulumi/aws');
    assert.ok(source.url.includes('/registry/packages/aws'));
    return;
  }

  assert.equal(source.kind, 'chart-docs');
  assert.equal(source.chart, 'kube-prometheus-stack');
  assert.ok(source.url.includes('kube-prometheus-stack'));
}

function assertPublicReferenceUnits(unitSet) {
  assert.ok(unitSet.units.length > 0);
  assert.ok(unitSet.units.every(unit => unit.privacyScope === 'public-reference'));
}

function assertUnitSourceRefs(unitSet, source) {
  assert.ok(unitSet.units.every(unit =>
    unit.source.source.kind === source.kind
    && unit.source.source.name === source.name
    && unit.source.source.url === source.url
    && unit.source.source.provider === source.provider
    && unit.source.source.packageName === source.packageName
    && unit.source.source.chart === source.chart
  ));
}

function assertNoRawContentOrSecrets(value) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, /"content"\s*:/);
  assert.doesNotMatch(serialized, /api[_-]?key|authorization|bearer|password|secret value|secret token/i);
}

function assertCanonicalVariantUnits(key, unitSet) {
  for (const { label, predicate } of CANONICAL_VARIANT_ASSERTIONS[key]) {
    assert.ok(unitSet.units.some(predicate), `${key} should extract ${label}`);
  }
}

test('canonical public docs cache fixtures normalize into five compact knowledge unit types', async () => {
  const cacheRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-canonical-public-knowledge-'));

  try {
    const fixtures = await writeCanonicalPublicKnowledgeCacheFixtures(cacheRoot);
    assert.deepEqual(fixtures.map(fixture => fixture.key), CANONICAL_PUBLIC_KNOWLEDGE_TARGET_KEYS);

    for (const { key, source, entry } of fixtures) {
      assertCanonicalSourceIdentity(key, source);
      assert.deepEqual(entry.source, source);

      const factSet = extractKnowledgeFactSetFromCacheEntry(entry, {
        now: new Date('2026-05-14T00:00:00.000Z'),
        extractedAt: '2026-05-14T00:00:00.000Z'
      });
      const markdownUnits = extractMarkdownKnowledgeUnitsFromCacheEntry(entry, factSet);
      const unitSet = extractKnowledgeUnitSetFromFactSet(factSet, markdownUnits);

      assert.ok(factSet.factCount > 0, `${key} should emit generic facts from cached markdown`);
      assert.ok(markdownUnits.length > 0, `${key} should emit markdown-derived units`);
      assert.deepEqual(unitTypes(unitSet), EXPECTED_UNIT_TYPES);
      assert.equal(unitSet.sourceId, entry.id);
      assert.deepEqual(unitSet.source, source);
      assertPublicReferenceUnits(unitSet);
      assertUnitSourceRefs(unitSet, source);
      assertCanonicalVariantUnits(key, unitSet);
      assertNoRawContentOrSecrets(factSet);
      assertNoRawContentOrSecrets(unitSet);
      assertValidKnowledgePayload(factSet, `${key}.facts`);
      assertValidKnowledgePayload(unitSet, `${key}.units`);
    }
  } finally {
    await rm(cacheRoot, { recursive: true, force: true });
  }
});
