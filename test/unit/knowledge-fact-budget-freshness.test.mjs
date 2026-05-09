import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { buildKnowledgePack } from '../../src/knowledge/pack.ts';
import { budgetKnowledgePackFacts } from '../../src/knowledge/fact-budget.ts';

test('knowledge fact budget downgrades unchecked source facts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const pack = await buildKnowledgePack(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    maxFacts: 6,
    extractedAt: '2026-05-05T00:00:00.000Z'
  });

  const uncheckedSource = pack.sources.find(source =>
    pack.facts.some(fact => fact.sourceId === source.id)
  );
  assert.ok(uncheckedSource);

  const uncheckedSummary = budgetKnowledgePackFacts({
    ...pack,
    sources: pack.sources.map(source => source.id === uncheckedSource.id
      ? {
          ...source,
          freshness: 'unchecked'
        }
      : source)
  }, {
    maxFacts: pack.factCount
  });

  assert.equal(uncheckedSummary.uncheckedSourceCount, 1);
  assert.ok(uncheckedSummary.facts
    .filter(fact => fact.sourceId === uncheckedSource.id)
    .every(fact => fact.confidence !== 'high'));
});
