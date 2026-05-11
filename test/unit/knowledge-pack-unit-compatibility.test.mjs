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

  const summary = budgetKnowledgePackFacts(pack, 2);
  assert.ok(summary.facts.length > 0);
  assert.ok(summary.facts.every(fact => fact.unitType === 'fact'));
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

test('knowledge pack validation still accepts legacy facts without unit labels', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const pack = await buildKnowledgePack(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    maxFacts: 3,
    extractedAt: '2026-05-05T00:00:00.000Z'
  });
  const legacyFacts = pack.facts.map(fact => {
    const { unitType: _unitType, ...legacyFact } = fact;
    return legacyFact;
  });

  const report = validateKnowledgePayload({
    ...pack,
    facts: legacyFacts
  }, 'inline');

  assert.equal(report.valid, true);
});
