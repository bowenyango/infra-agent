import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { budgetKnowledgePackFacts } from '../../src/knowledge/fact-budget.ts';
import { buildKnowledgePack } from '../../src/knowledge/pack.ts';
import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';

test('knowledge pack and budget summaries label generated facts as fact units', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const pack = await buildKnowledgePack(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    maxFacts: 3,
    extractedAt: '2026-05-05T00:00:00.000Z'
  });

  assert.ok(pack.facts.length > 0);
  assert.ok(pack.facts.every(fact => fact.unitType === 'fact'));
  assert.equal(pack.unitCount, pack.factCount);
  assert.equal(pack.includedUnitCount, pack.includedFactCount);
  assert.equal(pack.omittedUnitCount, pack.omittedFactCount);
  assert.equal(pack.units.length, pack.includedUnitCount);
  assert.ok(pack.units.every(unit =>
    unit.unitType === 'fact'
    && typeof unit.factKind === 'string'
    && typeof unit.sourceId === 'string'
    && typeof unit.privacyScope === 'string'
  ));

  const summary = budgetKnowledgePackFacts(pack, { maxFacts: 2 });
  assert.ok(summary.facts.length > 0);
  assert.ok(summary.facts.every(fact => fact.unitType === 'fact'));
  assert.equal(summary.totalUnitCount, pack.unitCount);
  assert.equal(summary.includedUnitCount, summary.units.length);
  assert.ok(summary.units.every(unit => unit.unitType === 'fact'));
});

test('knowledge pack validation rejects non-fact unit labels in legacy facts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const pack = await buildKnowledgePack(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    maxFacts: 3,
    extractedAt: '2026-05-05T00:00:00.000Z'
  });

  const report = validateKnowledgePayload({
    ...pack,
    facts: [{
      ...pack.facts[0],
      unitType: 'example'
    }],
    includedFactCount: 1,
    omittedFactCount: pack.factCount - 1
  }, 'inline');

  assert.equal(report.valid, false);
  assert.ok(report.issues.some(issue => issue.path === '$.facts[0].unitType'));
});

test('knowledge pack validation rejects forged unit count and source drift', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const pack = await buildKnowledgePack(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    maxFacts: 3,
    extractedAt: '2026-05-05T00:00:00.000Z'
  });

  const report = validateKnowledgePayload({
    ...pack,
    unitCount: pack.unitCount + 1,
    includedUnitCount: 1,
    omittedUnitCount: pack.unitCount,
    units: [{
      ...pack.units[0],
      sourceId: 'missing-source'
    }]
  }, 'inline');

  assert.equal(report.valid, false);
  for (const path of ['$.unitCount', '$.omittedUnitCount', '$.units[0].sourceId']) {
    assert.ok(report.issues.some(issue => issue.path === path), path);
  }
});

test('knowledge pack budget and validation accept mixed knowledge unit projections', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const pack = await buildKnowledgePack(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    maxFacts: 20,
    extractedAt: '2026-05-05T00:00:00.000Z'
  });
  const source = pack.sources[0];
  const sourceLocator = `${source.kind}:${source.name}`;
  const base = {
    path: 'charts/payments-api',
    summary: 'Helm chart knowledge unit projection.',
    confidence: 'high',
    extractionMethod: 'repo-local-static',
    sourceId: source.id,
    sourceLocator,
    privacyScope: source.storagePolicy.scope,
    tokenEstimate: 8,
    relatedPaths: ['charts/payments-api/values.yaml']
  };
  const units = [
    {
      ...base,
      unitType: 'fact',
      factKind: 'chart-metadata',
      values: ['apiVersion:v2'],
      required: true,
      type: 'string',
      defaultValue: 'apiVersion:v2'
    },
    {
      ...base,
      unitType: 'guidance',
      topic: 'Helm dependency review',
      appliesWhen: ['chart dependencies change'],
      avoidWhen: ['values-only edits'],
      risk: 'Changing dependencies can alter rendered manifests.'
    },
    {
      ...base,
      unitType: 'example',
      exampleType: 'helm-values',
      snippet: 'replicaCount: 2',
      language: 'yaml',
      appliesWhen: ['scaling chart deployments'],
      avoidWhen: ['provider-only edits']
    },
    {
      ...base,
      unitType: 'diagnostic',
      engine: 'helm',
      signature: 'missing dependency lock',
      likelyCause: 'Chart dependencies changed without lock refresh.',
      recommendedReview: ['Run helm dependency build before rendering.']
    },
    {
      ...base,
      unitType: 'recipe',
      name: 'Review Helm dependency refresh',
      steps: ['Inspect Chart.yaml dependencies.', 'Refresh dependency lock with approval.'],
      requiresApproval: true,
      mutationAllowed: false
    }
  ];
  const mixedPack = {
    ...pack,
    sources: [{
      ...source,
      freshness: 'unchecked'
    }],
    unitCount: pack.factCount,
    includedUnitCount: units.length,
    omittedUnitCount: pack.factCount - units.length,
    units
  };

  const summary = budgetKnowledgePackFacts(mixedPack, { maxFacts: 5 });

  assert.equal(summary.totalUnitCount, pack.factCount);
  assert.equal(summary.includedUnitCount, 5);
  assert.deepEqual(summary.units.map(unit => unit.unitType), ['fact', 'guidance', 'example', 'diagnostic', 'recipe']);
  assert.ok(summary.units.every(unit => unit.confidence === 'medium'));
  assert.deepEqual(summary.units[3].recommendedReview, ['Run helm dependency build before rendering.']);
  assert.deepEqual(summary.units[4].steps, ['Inspect Chart.yaml dependencies.', 'Refresh dependency lock with approval.']);

  const validationReport = validateKnowledgePayload({
    ...pack,
    unitCount: pack.factCount,
    includedUnitCount: units.length,
    omittedUnitCount: pack.factCount - units.length,
    units
  }, 'inline');

  assert.equal(validationReport.valid, true);
});

test('knowledge pack validation still accepts legacy facts without unit labels', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const pack = await buildKnowledgePack(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    maxFacts: 3,
    extractedAt: '2026-05-05T00:00:00.000Z'
  });
  const legacyFacts = pack.facts.map(fact => {
    const legacyFact = { ...fact };
    delete legacyFact.unitType;
    return legacyFact;
  });

  const report = validateKnowledgePayload({
    ...pack,
    facts: legacyFacts
  }, 'inline');

  assert.equal(report.valid, true);
});

test('knowledge pack validation still accepts legacy packs without unit arrays', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const pack = await buildKnowledgePack(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    maxFacts: 3,
    extractedAt: '2026-05-05T00:00:00.000Z'
  });
  const legacyPack = { ...pack };
  delete legacyPack.unitCount;
  delete legacyPack.includedUnitCount;
  delete legacyPack.omittedUnitCount;
  delete legacyPack.units;

  const report = validateKnowledgePayload(legacyPack, 'inline');

  assert.equal(report.valid, true);
});
