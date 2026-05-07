import test from 'node:test';
import assert from 'node:assert/strict';
import { rankKnowledgePackFacts } from '../../src/knowledge/fact-ranking.ts';

test('knowledge fact ranking places Helm schema facts before chart docs guidance', () => {
  const sources = [
    {
      id: 'chart-schema-source',
      domain: 'helm',
      targetPath: 'charts/api',
      kind: 'chart-schema',
      name: 'api:values.schema.json',
      factCount: 1,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'chart-docs-source',
      domain: 'helm',
      targetPath: 'charts/api',
      kind: 'chart-docs',
      name: 'api:home',
      factCount: 1,
      contentHash: 'b'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false
    }
  ];
  const ranked = rankKnowledgePackFacts([
    {
      kind: 'chart-value',
      path: 'chart.api.image.repository',
      summary: 'Container image repository.',
      confidence: 'medium',
      extractionMethod: 'helm-chart-docs-markdown',
      sourceId: 'chart-docs-source',
      sourceLocator: 'Chart docs: image.repository',
      values: ['image.repository']
    },
    {
      kind: 'chart-value',
      path: 'chart.api.image.tag',
      summary: 'Container image tag.',
      confidence: 'high',
      extractionMethod: 'helm-values-schema',
      sourceId: 'chart-schema-source',
      sourceLocator: 'values.schema.json: image.tag',
      required: true,
      type: 'string',
      defaultValue: 'latest'
    }
  ], {
    sources,
    requestedDomains: ['helm'],
    targetPaths: ['charts/api']
  });

  assert.equal(ranked[0]?.path, 'chart.api.image.tag');
  assert.equal(ranked[1]?.path, 'chart.api.image.repository');
});
