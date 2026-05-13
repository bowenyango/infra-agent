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
      assertNoRawContentOrSecrets(factSet);
      assertNoRawContentOrSecrets(unitSet);
      assertValidKnowledgePayload(factSet, `${key}.facts`);
      assertValidKnowledgePayload(unitSet, `${key}.units`);
    }
  } finally {
    await rm(cacheRoot, { recursive: true, force: true });
  }
});
