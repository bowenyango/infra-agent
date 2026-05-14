import test from 'node:test';
import assert from 'node:assert/strict';

import { budgetKnowledgePackFacts } from '../../src/knowledge/fact-budget.ts';
import {
  CANONICAL_PUBLIC_KNOWLEDGE_TARGET_KEYS,
  buildCanonicalPublicKnowledgePacks,
  collectObjectKeys
} from '../support/canonical-public-knowledge-fixtures.mjs';

const EXTRACTED_AT = '2026-05-14T00:00:00.000Z';
const NOW = new Date('2026-05-14T12:00:00.000Z');
const COMPACT_MAX_UNITS = 8;
const EXPECTED_UNIT_TYPES = ['fact', 'guidance', 'example', 'diagnostic', 'recipe'];
const SOURCE_IDENTITY_RETRIEVAL_FIELDS = ['provider', 'packageName', 'chart', 'version'];

const EXPECTED_BY_KEY = {
  terraformAwsProviderDocs: {
    examplePattern: /provider "aws"/,
    recipePattern: /terraform plan/i
  },
  pulumiAwsPackageDocs: {
    examplePattern: /new aws\.sns\.Topic/,
    recipePattern: /pulumi preview/i
  },
  helmKubePrometheusStackChartDocs: {
    examplePattern: /serviceMonitorSelectorNilUsesHelmValues/,
    recipePattern: /helm template/i
  }
};

function assertSourceIdentity(source, target) {
  assert.equal(source.kind, target.expectedSourceIdentity.kind);
  assert.equal(source.name, target.expectedSourceIdentity.name);
  assert.equal(source.domain, target.domain);
  assert.equal(source.targetPath, target.targetPath);
  assert.equal(source.provider, target.expectedSourceIdentity.provider);
  assert.equal(source.packageName, target.expectedSourceIdentity.packageName);
  assert.equal(source.chart, target.expectedSourceIdentity.chart);
  assert.equal(source.version, target.expectedSourceIdentity.version);
  assert.equal(source.url, target.expectedSourceIdentity.url);
  assert.equal(source.storagePolicy.scope, 'public-reference');
  assert.equal(source.storagePolicy.defaultStore, 'local-or-explicit-team-cache');
  assert.equal(source.storagePolicy.shareableByDefault, true);
  assert.equal(source.storagePolicy.requiresExplicitOptIn, false);
  assert.equal(source.stale, false);
  assert.equal(source.freshness, 'fresh');
}

function assertFiveUnitTypes(units) {
  assert.deepEqual(
    Array.from(new Set(units.map(unit => unit.unitType))).sort(),
    [...EXPECTED_UNIT_TYPES].sort()
  );
}

function assertUnitIndexSourceIdentity(entry, target, source) {
  assert.equal(entry.domain, target.domain);
  assert.equal(entry.targetPath, target.targetPath);
  assert.equal(entry.sourceId, source.id);
  assert.equal(entry.sourceKind, target.expectedSourceIdentity.kind);
  assert.equal(entry.sourceName, target.expectedSourceIdentity.name);
  assert.equal(entry.provider, target.expectedSourceIdentity.provider);
  assert.equal(entry.packageName, target.expectedSourceIdentity.packageName);
  assert.equal(entry.chart, target.expectedSourceIdentity.chart);
  assert.equal(entry.version, target.expectedSourceIdentity.version);
  assert.equal(entry.storageScope, 'public-reference');
  assert.deepEqual(entry.privacyScopes, ['public-reference']);
  assert.equal(entry.freshness, 'fresh');
}

function assertUnitIndexRetrievalKeys(entry, target) {
  assert.ok(entry.retrievalKeys.includes(`domain:${target.domain}`));
  assert.ok(entry.retrievalKeys.includes(`targetPath:${target.targetPath}`));
  assert.ok(entry.retrievalKeys.includes(`sourceKind:${target.expectedSourceIdentity.kind}`));
  assert.ok(entry.retrievalKeys.includes('storageScope:public-reference'));
  assert.ok(entry.retrievalKeys.includes('freshness:fresh'));

  for (const field of SOURCE_IDENTITY_RETRIEVAL_FIELDS) {
    const value = target.expectedSourceIdentity[field];
    if (value !== undefined) {
      assert.ok(entry.retrievalKeys.includes(`${field}:${value}`), `${field}:${value}`);
    }
  }

  for (const unitType of EXPECTED_UNIT_TYPES) {
    assert.ok(entry.retrievalKeys.includes(`unitType:${unitType}`), unitType);
  }
}

function assertCompactBudgetUnitIndex(budget, target) {
  const entry = budget.unitIndex?.entries[0];

  assert.equal(budget.unitIndex?.kind, 'infra-agent.knowledge-unit-index');
  assert.equal(budget.unitIndex?.schemaVersion, 1);
  assert.equal(budget.unitIndex?.mutationAllowed, false);
  assert.equal(budget.unitIndex?.sourceCount, 1);
  assert.equal(budget.unitIndex?.includedUnitCount, COMPACT_MAX_UNITS);
  assert.equal(budget.unitIndex?.omittedUnitCount, budget.totalUnitCount - COMPACT_MAX_UNITS);
  assert.equal(budget.unitIndex?.entries.length, 1);
  assert.ok(entry);

  assertUnitIndexSourceIdentity(entry, target, budget.sources[0]);
  assert.equal(
    entry.includedUnitCount,
    Object.values(entry.unitCounts).reduce((sum, count) => sum + count, 0)
  );
  assert.equal(entry.includedUnitCount, COMPACT_MAX_UNITS);
  assert.equal(entry.omittedUnitCount, budget.totalUnitCount - COMPACT_MAX_UNITS);
  assert.equal(entry.sourceUnitCountEstimate, budget.totalUnitCount);

  for (const unitType of EXPECTED_UNIT_TYPES) {
    assert.ok(entry.unitCounts[unitType] > 0, unitType);
  }
  assertUnitIndexRetrievalKeys(entry, target);
}

function assertCompactPublicPack({ key, target, pack }) {
  const expected = EXPECTED_BY_KEY[key];
  const source = pack.sources[0];
  const keys = collectObjectKeys(pack);

  assert.equal(pack.kind, 'infra-agent.knowledge-pack');
  assert.equal(pack.mutationAllowed, false);
  assert.equal(pack.maxFacts, COMPACT_MAX_UNITS);
  assert.equal(pack.maxUnits, COMPACT_MAX_UNITS);
  assert.deepEqual(pack.requestedDomains, [target.domain]);
  assert.deepEqual(pack.targetPaths, [target.targetPath]);
  assert.equal(pack.sourceCount, 1);
  assert.equal(pack.factSetCount, 1);
  assert.equal(pack.sources.length, 1);
  assert.ok(pack.factCount > 0);
  assert.ok(pack.unitCount > COMPACT_MAX_UNITS);
  assert.equal(pack.includedUnitCount, COMPACT_MAX_UNITS);
  assert.equal(pack.omittedUnitCount, pack.unitCount - COMPACT_MAX_UNITS);
  assert.ok(pack.omittedUnitCount > 0);
  assert.equal(pack.storagePolicy.publicReference, 1);
  assert.equal(pack.storagePolicy.workspacePrivate, 0);
  assert.equal(pack.storagePolicy.shareableByDefault, 1);
  assert.equal(pack.storagePolicy.explicitOptInRequired, 0);

  assertSourceIdentity(source, target);
  assert.equal(source.factCount, pack.factCount);
  assert.match(source.contentHash, /^[a-f0-9]{64}$/);

  assert.ok(pack.facts.every(fact =>
    fact.sourceId === source.id
    && typeof fact.sourceLocator === 'string'
    && !('source' in fact)
  ));
  assert.ok(pack.units.every(unit =>
    unit.sourceId === source.id
    && unit.privacyScope === 'public-reference'
    && typeof unit.sourceLocator === 'string'
    && !('source' in unit)
  ));
  assertFiveUnitTypes(pack.units);
  assert.ok(pack.units.some(unit =>
    unit.unitType === 'example'
    && expected.examplePattern.test(unit.snippet)
  ));
  assert.ok(pack.units.some(unit =>
    unit.unitType === 'recipe'
    && expected.recipePattern.test(unit.steps.join('\n'))
    && unit.mutationAllowed === false
  ));

  const serialized = JSON.stringify(pack);
  assert.equal(keys.has('content'), false);
  assert.equal(keys.has('rawContent'), false);
  assert.equal(keys.has('rawDocs'), false);
  assert.doesNotMatch(serialized, /"content"\s*:/);
}

function publicReferenceRagContext(pack) {
  const sourceById = new Map(pack.sources.map(source => [source.id, source]));

  return pack.units.map(unit => {
    const source = sourceById.get(unit.sourceId);
    assert.ok(source);

    return {
      sourceId: unit.sourceId,
      sourceKind: source.kind,
      sourceDomain: source.domain,
      sourceIdentity: [source.provider, source.packageName, source.chart, source.name]
        .filter(Boolean)
        .join(' '),
      storageScope: source.storagePolicy.scope,
      unitType: unit.unitType,
      sourceLocator: unit.sourceLocator,
      summary: unit.summary,
      tokenEstimate: unit.tokenEstimate ?? 0
    };
  });
}

test('canonical public targets pack as compact five-type public-reference knowledge', async () => {
  const packs = await buildCanonicalPublicKnowledgePacks({
    maxUnits: COMPACT_MAX_UNITS,
    now: NOW,
    extractedAt: EXTRACTED_AT
  });

  assert.deepEqual(packs.map(pack => pack.key), CANONICAL_PUBLIC_KNOWLEDGE_TARGET_KEYS);

  for (const packedTarget of packs) {
    assertCompactPublicPack(packedTarget);

    const budget = budgetKnowledgePackFacts(packedTarget.pack, { maxUnits: COMPACT_MAX_UNITS });
    const budgetKeys = collectObjectKeys(budget);

    assert.equal(budget.includedUnitCount, COMPACT_MAX_UNITS);
    assert.equal(budget.omittedUnitCount, packedTarget.pack.unitCount - COMPACT_MAX_UNITS);
    assert.equal(budget.sources[0]?.provider, packedTarget.target.expectedSourceIdentity.provider);
    assert.equal(budget.sources[0]?.packageName, packedTarget.target.expectedSourceIdentity.packageName);
    assert.equal(budget.sources[0]?.chart, packedTarget.target.expectedSourceIdentity.chart);
    assert.ok(budget.units.every(unit => unit.privacyScope === 'public-reference'));
    assertFiveUnitTypes(budget.units);
    assertCompactBudgetUnitIndex(budget, packedTarget.target);
    assert.equal(budgetKeys.has('url'), false);
    assert.equal(budgetKeys.has('contentHash'), false);
    assert.equal(budgetKeys.has('fetchedAt'), false);
    assert.equal(budgetKeys.has('staleAfter'), false);
    assert.equal(budgetKeys.has('content'), false);
    assert.equal(budgetKeys.has('rawContent'), false);
    assert.equal(budgetKeys.has('rawDocs'), false);
    assert.doesNotMatch(JSON.stringify(budget), /"content"\s*:|contentHash|fetchedAt|staleAfter|url/);
  }
});

test('canonical public-reference units can be consumed as generic RAG context', async () => {
  const packs = await buildCanonicalPublicKnowledgePacks({
    maxUnits: COMPACT_MAX_UNITS,
    now: NOW,
    extractedAt: EXTRACTED_AT
  });
  const contexts = packs.flatMap(({ pack }) => publicReferenceRagContext(pack));

  assert.equal(contexts.length, CANONICAL_PUBLIC_KNOWLEDGE_TARGET_KEYS.length * COMPACT_MAX_UNITS);
  assert.ok(contexts.every(context =>
    context.storageScope === 'public-reference'
    && typeof context.sourceLocator === 'string'
    && context.sourceLocator.length > 0
    && typeof context.summary === 'string'
    && context.summary.length > 0
  ));
  assert.deepEqual(
    Array.from(new Set(contexts.map(context => context.sourceKind))).sort(),
    ['chart-docs', 'pulumi-docs', 'terraform-registry']
  );
  assert.ok(contexts.some(context => /hashicorp\/aws/.test(context.sourceIdentity)));
  assert.ok(contexts.some(context => /@pulumi\/aws/.test(context.sourceIdentity)));
  assert.ok(contexts.some(context => /kube-prometheus-stack/.test(context.sourceIdentity)));
  assert.doesNotMatch(JSON.stringify(contexts), /"content"\s*:|# AWS Provider|# AWS|# kube-prometheus-stack/);
});
