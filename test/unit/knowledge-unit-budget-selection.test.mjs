import test from 'node:test';
import assert from 'node:assert/strict';

import { budgetKnowledgePackFacts } from '../../src/knowledge/fact-budget.ts';
import { selectKnowledgePackUnitsForBudget } from '../../src/knowledge/unit-ranking.ts';

function helmSources() {
  return [
    {
      id: 'chart-schema-source',
      domain: 'helm',
      targetPath: 'charts/api',
      kind: 'chart-schema',
      name: 'api:values.schema.json',
      factCount: 2,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false,
      freshness: 'fresh',
      storagePolicy: {
        scope: 'workspace-private',
        defaultStore: 'local-only',
        shareableByDefault: false,
        requiresExplicitOptIn: true,
        reason: 'Local chart schema source.'
      }
    },
    {
      id: 'chart-docs-source',
      domain: 'helm',
      targetPath: 'charts/api',
      kind: 'chart-docs',
      name: 'api:README.md',
      factCount: 4,
      contentHash: 'b'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false,
      freshness: 'fresh',
      storagePolicy: {
        scope: 'public-reference',
        defaultStore: 'local-or-explicit-team-cache',
        shareableByDefault: true,
        requiresExplicitOptIn: false,
        reason: 'Public chart documentation source.'
      }
    }
  ];
}

function staleHelmSources() {
  return [
    ...helmSources(),
    {
      ...helmSources()[1],
      id: 'stale-chart-docs-source',
      contentHash: 'c'.repeat(64),
      stale: true,
      staleReason: 'source-stale'
    }
  ];
}

function helmUnits() {
  const docsBase = {
    path: 'chart.api',
    summary: 'Helm chart documentation unit.',
    confidence: 'high',
    sourceId: 'chart-docs-source',
    sourceLocator: 'README.md',
    privacyScope: 'public-reference'
  };

  return [
    {
      ...docsBase,
      unitType: 'example',
      exampleType: 'helm-docs-example',
      snippet: 'image:\n  repository: ghcr.io/example/api',
      extractionMethod: 'markdown-section',
      language: 'yaml'
    },
    {
      ...docsBase,
      unitType: 'guidance',
      topic: 'Best Practices',
      summary: 'Set explicit service ports and image repositories for production releases.',
      extractionMethod: 'markdown-section',
      appliesWhen: ['values.yaml changes']
    },
    {
      ...docsBase,
      unitType: 'guidance',
      topic: 'Important Notes',
      summary: 'Review chart defaults before changing workload-facing values.',
      extractionMethod: 'markdown-section',
      appliesWhen: ['chart upgrades']
    },
    {
      ...docsBase,
      unitType: 'diagnostic',
      engine: 'helm',
      signature: 'Error: template render failure',
      likelyCause: 'Values do not match chart templates.',
      recommendedReview: ['Run helm template for the selected chart.'],
      extractionMethod: 'markdown-section'
    },
    {
      ...docsBase,
      unitType: 'recipe',
      name: 'Upgrade Workflow',
      summary: 'Review, update, and render changed chart values.',
      steps: [
        'Compare current values against chart defaults.',
        'Update only the selected values file.',
        'Run helm template for the selected chart.'
      ],
      requiresApproval: false,
      mutationAllowed: false,
      extractionMethod: 'markdown-section'
    },
    {
      unitType: 'fact',
      factKind: 'chart-value',
      path: 'chart.api.service.port',
      summary: 'service.port is required by chart templates.',
      confidence: 'high',
      extractionMethod: 'helm-values-schema',
      sourceId: 'chart-schema-source',
      sourceLocator: 'values.schema.json: service.port',
      privacyScope: 'workspace-private',
      required: true,
      type: 'number'
    }
  ];
}

test('knowledge unit budget keeps concrete examples and recipes under tight budgets', () => {
  const selected = selectKnowledgePackUnitsForBudget(helmUnits(), {
    sources: helmSources(),
    requestedDomains: ['helm'],
    targetPaths: ['charts/api'],
    maxUnits: 4
  });

  assert.deepEqual(selected.slice(0, 2).map(unit => unit.unitType), ['fact', 'diagnostic']);
  assert.equal(selected.length, 4);
  assert.ok(selected.some(unit =>
    unit.unitType === 'example'
    && /ghcr\.io\/example\/api/.test(unit.snippet)
  ));
  assert.ok(selected.some(unit =>
    unit.unitType === 'recipe'
    && unit.steps.includes('Run helm template for the selected chart.')
  ));
});

test('knowledge unit budget does not evict protected facts or diagnostics', () => {
  const extraProtectedUnits = [
    {
      ...helmUnits().find(unit => unit.unitType === 'fact'),
      path: 'chart.api.image.repository',
      summary: 'image.repository is required by chart templates.'
    },
    {
      ...helmUnits().find(unit => unit.unitType === 'diagnostic'),
      signature: 'Error: required value image.repository is missing',
      likelyCause: 'A required image value is not configured.'
    }
  ];
  const selected = selectKnowledgePackUnitsForBudget([
    ...extraProtectedUnits,
    ...helmUnits()
  ], {
    sources: helmSources(),
    requestedDomains: ['helm'],
    targetPaths: ['charts/api'],
    maxUnits: 4
  });

  assert.equal(selected.filter(unit => unit.unitType === 'fact' && unit.required === true).length, 2);
  assert.equal(selected.filter(unit => unit.unitType === 'diagnostic').length, 2);
  assert.equal(selected.some(unit => unit.unitType === 'example'), false);
  assert.equal(selected.some(unit => unit.unitType === 'recipe'), false);
});

test('knowledge unit budget prefers fresh concrete units over stale concrete units', () => {
  const staleExample = {
    ...helmUnits().find(unit => unit.unitType === 'example'),
    sourceId: 'stale-chart-docs-source',
    snippet: 'image:\n  repository: stale.example/api'
  };
  const staleRecipe = {
    ...helmUnits().find(unit => unit.unitType === 'recipe'),
    sourceId: 'stale-chart-docs-source',
    steps: ['Use stale chart defaults.']
  };
  const selected = selectKnowledgePackUnitsForBudget([
    staleExample,
    staleRecipe,
    ...helmUnits()
  ], {
    sources: staleHelmSources(),
    requestedDomains: ['helm'],
    targetPaths: ['charts/api'],
    maxUnits: 4
  });

  assert.ok(selected.some(unit =>
    unit.unitType === 'example'
    && /ghcr\.io\/example\/api/.test(unit.snippet)
  ));
  assert.ok(selected.some(unit =>
    unit.unitType === 'recipe'
    && unit.steps.includes('Run helm template for the selected chart.')
  ));
  assert.equal(selected.some(unit => unit.sourceId === 'stale-chart-docs-source'), false);
});

test('knowledge budget summary preserves concrete example and recipe units', () => {
  const summary = budgetKnowledgePackFacts({
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: 'helm-budget-pack',
    workspaceRoot: '/workspace',
    cacheRoot: '/cache',
    requestedDomains: ['helm'],
    targetPaths: ['charts/api'],
    sourceIds: ['chart-schema-source', 'chart-docs-source'],
    sourceCount: 2,
    factSetCount: 2,
    factCount: 1,
    includedFactCount: 1,
    omittedFactCount: 0,
    unitCount: 6,
    includedUnitCount: 6,
    omittedUnitCount: 0,
    maxFacts: 6,
    maxUnits: 6,
    staleSourceCount: 0,
    storagePolicy: {
      publicReference: 1,
      workspacePrivate: 1,
      shareableByDefault: 1,
      explicitOptInRequired: 1
    },
    sources: helmSources(),
    facts: [],
    units: helmUnits()
  }, {
    maxUnits: 4
  });

  assert.equal(summary.includedUnitCount, 4);
  assert.deepEqual(summary.units.slice(0, 2).map(unit => unit.unitType), ['fact', 'diagnostic']);
  assert.ok(summary.units.some(unit => unit.unitType === 'example'));
  assert.ok(summary.units.some(unit => unit.unitType === 'recipe'));
});
