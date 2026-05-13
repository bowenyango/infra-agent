import test from 'node:test';
import assert from 'node:assert/strict';

import { budgetKnowledgePackFacts } from '../../src/knowledge/fact-budget.ts';

function publicStoragePolicy() {
  return {
    scope: 'public-reference',
    defaultStore: 'local-or-explicit-team-cache',
    shareableByDefault: true,
    requiresExplicitOptIn: false,
    reason: 'Source points at public provider, package, or chart documentation.'
  };
}

function buildPack() {
  const source = {
    id: 'compound-public-source',
    domain: 'terraform',
    targetPath: 'infra/api',
    kind: 'knowledge-unit-artifact',
    name: 'knowledge-unit-artifact:api-platform',
    provider: 'hashicorp/aws',
    packageName: '@pulumi/aws',
    chart: 'api-chart',
    module: 'api-platform',
    version: '1.2.3',
    url: 'https://docs.example.test/api-platform',
    content: '# Raw Docs\n\nRAW DOCS MARKER should not enter the budget summary.',
    factCount: 1,
    contentHash: 'a'.repeat(64),
    fetchedAt: '2026-05-13T00:00:00.000Z',
    stale: false,
    freshness: 'fresh',
    storagePolicy: publicStoragePolicy()
  };
  const base = {
    confidence: 'high',
    sourceId: source.id,
    sourceLocator: 'api-platform',
    privacyScope: 'public-reference'
  };
  const units = [
    {
      ...base,
      unitType: 'fact',
      factKind: 'argument',
      path: 'provider.aws.region',
      summary: 'AWS provider region is required.',
      extractionMethod: 'terraform-registry-markdown',
      required: true,
      type: 'string'
    },
    {
      ...base,
      unitType: 'guidance',
      path: 'guidance.api.provider-region',
      summary: 'Keep provider region configuration explicit.',
      extractionMethod: 'official-guidance',
      topic: 'provider-region',
      appliesWhen: ['editing AWS provider configuration']
    },
    {
      ...base,
      unitType: 'example',
      path: 'example.api.bucket',
      summary: 'Bucket resource example.',
      extractionMethod: 'official-example',
      exampleType: 'resource-usage',
      snippet: 'resource "aws_s3_bucket" "api" {}',
      language: 'hcl'
    },
    {
      ...base,
      unitType: 'diagnostic',
      path: 'diagnostic.aws.region',
      summary: 'Missing provider region diagnostic.',
      extractionMethod: 'provider-diagnostic',
      engine: 'terraform',
      signature: 'missing region',
      likelyCause: 'Provider configuration is incomplete.',
      recommendedReview: ['Check provider region before planning.']
    },
    {
      ...base,
      unitType: 'recipe',
      path: 'recipe.api.review',
      summary: 'Review API infrastructure changes.',
      extractionMethod: 'workflow-recipe',
      name: 'API infrastructure review',
      steps: ['Inspect provider configuration.', 'Run a plan.'],
      mutationAllowed: false
    }
  ];

  return {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: 'budget-unit-index-pack',
    workspaceRoot: '/workspace',
    cacheRoot: '/cache',
    requestedDomains: ['terraform'],
    targetPaths: ['infra/api'],
    sourceIds: [source.id],
    sourceCount: 1,
    factSetCount: 1,
    factCount: 1,
    includedFactCount: 1,
    omittedFactCount: 0,
    unitCount: units.length,
    includedUnitCount: units.length,
    omittedUnitCount: 0,
    maxFacts: units.length,
    maxUnits: units.length,
    staleSourceCount: 0,
    storagePolicy: {
      publicReference: 1,
      workspacePrivate: 0,
      explicitOptInRequired: 0,
      shareableByDefault: 1,
      defaultStores: {
        'local-only': 0,
        'local-or-explicit-team-cache': 1
      }
    },
    sources: [source],
    facts: [
      {
        kind: 'argument',
        path: 'provider.aws.region',
        summary: 'AWS provider region is required.',
        confidence: 'high',
        extractionMethod: 'terraform-registry-markdown',
        sourceId: source.id,
        sourceLocator: 'api-platform',
        required: true,
        type: 'string'
      }
    ],
    units
  };
}

test('budget summary includes compact unit index with five unit type counts and source identity', () => {
  const summary = budgetKnowledgePackFacts(buildPack(), { maxUnits: 5 });
  const entry = summary.unitIndex?.entries[0];

  assert.equal(summary.unitIndex?.kind, 'infra-agent.knowledge-unit-index');
  assert.equal(summary.unitIndex?.mutationAllowed, false);
  assert.equal(summary.unitIndex?.sourceCount, 1);
  assert.equal(summary.unitIndex?.includedUnitCount, 5);
  assert.equal(summary.unitIndex?.omittedUnitCount, 0);
  assert.deepEqual(entry?.unitCounts, {
    fact: 1,
    guidance: 1,
    example: 1,
    diagnostic: 1,
    recipe: 1
  });
  assert.equal(entry?.sourceId, 'compound-public-source');
  assert.equal(entry?.sourceKind, 'knowledge-unit-artifact');
  assert.equal(entry?.sourceName, 'knowledge-unit-artifact:api-platform');
  assert.equal(entry?.provider, 'hashicorp/aws');
  assert.equal(entry?.packageName, '@pulumi/aws');
  assert.equal(entry?.chart, 'api-chart');
  assert.equal(entry?.module, 'api-platform');
  assert.equal(entry?.version, '1.2.3');
  assert.equal(entry?.targetPath, 'infra/api');
  assert.equal(entry?.storageScope, 'public-reference');
  assert.equal(entry?.freshness, 'fresh');
  assert.ok(entry?.retrievalKeys.includes('provider:hashicorp/aws'));
  assert.ok(entry?.retrievalKeys.includes('packageName:@pulumi/aws'));
  assert.ok(entry?.retrievalKeys.includes('chart:api-chart'));
  assert.ok(entry?.retrievalKeys.includes('module:api-platform'));
  assert.ok(entry?.retrievalKeys.includes('unitType:recipe'));
});

test('budget summary unit index tracks included and omitted counts for tight maxUnits', () => {
  const summary = budgetKnowledgePackFacts(buildPack(), { maxUnits: 3 });
  const entry = summary.unitIndex?.entries[0];
  const includedByType = Object.values(entry?.unitCounts ?? {}).reduce((sum, value) => sum + value, 0);

  assert.equal(summary.includedUnitCount, 3);
  assert.equal(summary.omittedUnitCount, 2);
  assert.equal(summary.unitIndex?.includedUnitCount, 3);
  assert.equal(summary.unitIndex?.omittedUnitCount, 2);
  assert.equal(entry?.includedUnitCount, 3);
  assert.equal(entry?.omittedUnitCount, 2);
  assert.equal(entry?.sourceUnitCountEstimate, 5);
  assert.equal(includedByType, 3);
});

test('budget summary unit index serialization excludes URLs raw docs and full content hashes', () => {
  const serialized = JSON.stringify(budgetKnowledgePackFacts(buildPack(), { maxUnits: 5 }));

  assert.doesNotMatch(serialized, /https:\/\//);
  assert.doesNotMatch(serialized, /RAW DOCS MARKER|# Raw Docs/);
  assert.doesNotMatch(serialized, new RegExp('a{64}'));
  assert.doesNotMatch(serialized, /sourceContentHash|contentHash/);
});

test('budget summary keeps existing source fact and unit compatibility fields', () => {
  const summary = budgetKnowledgePackFacts(buildPack(), { maxUnits: 2 });

  assert.equal(summary.sources[0]?.id, 'compound-public-source');
  assert.equal(summary.sources[0]?.kind, 'knowledge-unit-artifact');
  assert.equal(summary.sources[0]?.name, 'knowledge-unit-artifact:api-platform');
  assert.equal(summary.sources[0]?.provider, 'hashicorp/aws');
  assert.equal(summary.sources[0]?.packageName, '@pulumi/aws');
  assert.equal(summary.sources[0]?.chart, 'api-chart');
  assert.equal(summary.sources[0]?.module, 'api-platform');
  assert.equal(summary.sources[0]?.version, '1.2.3');
  assert.equal(summary.facts[0]?.path, 'provider.aws.region');
  assert.equal(summary.facts[0]?.sourceId, 'compound-public-source');
  assert.equal(summary.units.length, 2);
  assert.ok(summary.units.every(unit => unit.sourceId === 'compound-public-source'));
});
