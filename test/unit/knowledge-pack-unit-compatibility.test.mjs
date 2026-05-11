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

test('knowledge pack validation rejects forged unit budget and source drift', async () => {
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
    omittedUnitCount: pack.unitCount - 1,
    units: [{
      ...pack.units[0],
      sourceId: 'missing-source'
    }]
  }, 'inline');

  assert.equal(report.valid, false);
  for (const path of ['$.omittedUnitCount', '$.units[0].sourceId']) {
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
  assert.deepEqual(summary.units.map(unit => unit.unitType), ['fact', 'diagnostic', 'guidance', 'recipe', 'example']);
  assert.ok(summary.units.every(unit => unit.confidence === 'medium'));
  assert.deepEqual(summary.units.find(unit => unit.unitType === 'diagnostic')?.recommendedReview, ['Run helm dependency build before rendering.']);
  assert.deepEqual(summary.units.find(unit => unit.unitType === 'recipe')?.steps, ['Inspect Chart.yaml dependencies.', 'Refresh dependency lock with approval.']);
  assert.equal(summary.units.find(unit => unit.unitType === 'example')?.snippet, 'replicaCount: 2');
  assert.deepEqual(summary.units.find(unit => unit.unitType === 'guidance')?.appliesWhen, ['chart dependencies change']);

  const validationReport = validateKnowledgePayload({
    ...pack,
    unitCount: units.length,
    includedUnitCount: units.length,
    omittedUnitCount: 0,
    units
  }, 'inline');

  assert.equal(validationReport.valid, true);
});

test('knowledge pack validation accepts unit-native packs whose unit totals diverge from facts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const pack = await buildKnowledgePack(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    maxFacts: 4,
    extractedAt: '2026-05-05T00:00:00.000Z'
  });
  const source = pack.sources[0];
  const diagnosticUnit = {
    unitType: 'diagnostic',
    path: 'charts/payments-api',
    summary: 'Helm render failures usually need values and template review.',
    confidence: 'medium',
    extractionMethod: 'validation-diagnostic',
    sourceId: source.id,
    sourceLocator: `${source.kind}:${source.name}`,
    privacyScope: source.storagePolicy.scope,
    engine: 'helm',
    signature: 'render failure',
    likelyCause: 'Template assumptions do not match values.',
    recommendedReview: ['Run helm template for the selected chart.']
  };

  const report = validateKnowledgePayload({
    ...pack,
    unitCount: 1,
    includedUnitCount: 1,
    omittedUnitCount: 0,
    units: [diagnosticUnit]
  }, 'inline');

  assert.equal(report.valid, true);
});

test('knowledge pack budget ranks mixed units before slicing without reordering legacy facts', async () => {
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
    summary: 'Helm chart mixed unit ranking input.',
    confidence: 'high',
    extractionMethod: 'repo-local-static',
    sourceId: source.id,
    sourceLocator,
    privacyScope: source.storagePolicy.scope,
    tokenEstimate: 6
  };
  const unorderedUnits = [
    {
      ...base,
      unitType: 'example',
      exampleType: 'helm-values',
      snippet: 'service:\n  port: 8080',
      language: 'yaml'
    },
    {
      ...base,
      unitType: 'recipe',
      name: 'Review rendered Helm output',
      steps: ['Render chart.', 'Inspect changed resources.'],
      mutationAllowed: false
    },
    {
      ...base,
      unitType: 'diagnostic',
      engine: 'helm',
      signature: 'template render failure',
      likelyCause: 'Chart values no longer match template assumptions.',
      recommendedReview: ['Run helm template for the selected chart.']
    },
    {
      ...base,
      unitType: 'guidance',
      topic: 'Helm values edits',
      appliesWhen: ['values.yaml changes'],
      avoidWhen: ['provider-only edits']
    },
    {
      ...base,
      unitType: 'fact',
      factKind: 'chart-value',
      path: 'values.service.port',
      summary: 'values.service.port is required by chart templates.',
      required: true,
      type: 'number',
      values: ['8080']
    }
  ];
  const mixedPack = {
    ...pack,
    unitCount: unorderedUnits.length,
    includedUnitCount: unorderedUnits.length,
    omittedUnitCount: 0,
    units: unorderedUnits
  };

  const summary = budgetKnowledgePackFacts(mixedPack, { maxFacts: 3 });

  assert.deepEqual(
    summary.facts.map(fact => fact.path),
    pack.facts.slice(0, 3).map(fact => fact.path)
  );
  assert.deepEqual(summary.units.map(unit => unit.unitType), ['fact', 'diagnostic', 'guidance']);
  assert.equal(summary.totalUnitCount, unorderedUnits.length);
  assert.equal(summary.includedUnitCount, 3);
  assert.equal(summary.omittedUnitCount, 2);
  assert.deepEqual(summary.units[1].recommendedReview, ['Run helm template for the selected chart.']);
  assert.deepEqual(summary.units[2].appliesWhen, ['values.yaml changes']);
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
