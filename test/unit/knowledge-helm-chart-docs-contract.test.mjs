import test from 'node:test';
import assert from 'node:assert/strict';
import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';

function buildChartDocsPack(confidence = 'medium') {
  return {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: 'fedcba9876543210fedcba98',
    workspaceRoot: '/workspace',
    cacheRoot: '/workspace/.infra-agent/knowledge-cache',
    requestedDomains: ['helm'],
    targetPaths: ['charts/api'],
    sourceIds: ['chart-docs/api-home'],
    sourceCount: 1,
    factSetCount: 1,
    factCount: 1,
    includedFactCount: 1,
    omittedFactCount: 0,
    maxFacts: 1,
    staleSourceCount: 0,
    storagePolicy: {
      publicReference: 1,
      workspacePrivate: 0,
      shareableByDefault: 1,
      explicitOptInRequired: 0
    },
    sources: [
      {
        id: 'chart-docs/api-home',
        domain: 'helm',
        targetPath: 'charts/api',
        kind: 'chart-docs',
        name: 'api:home',
        factCount: 1,
        contentHash: 'b'.repeat(64),
        fetchedAt: '2026-05-06T00:00:00.000Z',
        staleAfter: '2026-06-05T00:00:00.000Z',
        stale: false,
        freshness: 'fresh',
        storagePolicy: {
          scope: 'public-reference',
          defaultStore: 'local-or-explicit-team-cache',
          shareableByDefault: true,
          requiresExplicitOptIn: false,
          reason: 'Helm chart docs are public reference material.'
        }
      }
    ],
    facts: [
      {
        kind: 'chart-value',
        path: 'chart.api.image.repository',
        summary: 'Container image repository.',
        confidence,
        extractionMethod: 'helm-chart-docs-markdown',
        sourceId: 'chart-docs/api-home',
        sourceLocator: 'Chart docs: image.repository',
        type: 'string',
        values: ['image.repository']
      }
    ]
  };
}

test('knowledge pack validation keeps Helm chart docs facts advisory', () => {
  const validReport = validateKnowledgePayload(buildChartDocsPack(), 'inline');
  assert.equal(validReport.valid, true);

  const highConfidenceReport = validateKnowledgePayload(buildChartDocsPack('high'), 'inline');
  assert.equal(highConfidenceReport.valid, false);
  assert.ok(highConfidenceReport.issues.some(issue =>
    issue.path === '$.facts[0].confidence'
    && /medium-confidence advisory/.test(issue.message)
  ));
});
