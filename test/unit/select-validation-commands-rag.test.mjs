import test from 'node:test';
import assert from 'node:assert/strict';
import { selectValidationCommands } from '../../src/agent/select-validation-commands.ts';

const CHART_ROOT = 'charts/payments-api';

function baseUnit(overrides = {}) {
  return {
    path: 'unit.helm.validation',
    summary: 'Compact Helm validation unit',
    confidence: 'high',
    extractionMethod: 'repo-local-guidance',
    sourceId: 'helm-source',
    sourceLocator: 'README.md',
    privacyScope: 'public-reference',
    ...overrides
  };
}

function knowledgePack(units) {
  return {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: 'helm-validation-rag-pack',
    workspaceRoot: '/workspace',
    cacheRoot: '/workspace/.infra-agent/knowledge-cache',
    requestedDomains: ['helm'],
    targetPaths: [CHART_ROOT],
    sourceIds: ['helm-source'],
    sourceCount: 1,
    factSetCount: 1,
    factCount: 0,
    includedFactCount: 0,
    omittedFactCount: 0,
    unitCount: units.length,
    includedUnitCount: units.length,
    omittedUnitCount: 0,
    maxFacts: 6,
    maxUnits: 6,
    staleSourceCount: 0,
    storagePolicy: {
      publicReference: 1,
      workspacePrivate: 0,
      shareableByDefault: 1,
      explicitOptInRequired: 0
    },
    sources: [
      {
        id: 'helm-source',
        domain: 'helm',
        targetPath: CHART_ROOT,
        kind: 'chart-docs',
        name: 'chart-docs:payments-api',
        factCount: 0,
        contentHash: 'a'.repeat(64),
        fetchedAt: '2026-05-05T00:00:00.000Z',
        stale: false,
        freshness: 'fresh',
        storagePolicy: {
          scope: 'public-reference',
          defaultStore: 'local-or-explicit-team-cache',
          shareableByDefault: true,
          requiresExplicitOptIn: false,
          reason: 'Public Helm chart documentation source.'
        }
      }
    ],
    facts: [],
    units
  };
}

function runtime({ commands, knowledgeFacts = null }) {
  return {
    task: 'update payments-api Helm chart values',
    preflight: {
      profile: {
        id: 'generic'
      },
      requestedDomains: ['helm'],
      targetCandidates: [
        {
          kind: 'helm-chart',
          path: CHART_ROOT
        }
      ],
      validation: {
        plan: [
          {
            kind: 'helm',
            target: CHART_ROOT,
            commands
          }
        ]
      }
    },
    knowledgeFacts,
    retrievedContext: [],
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
}

test('Helm render diagnostic prioritizes helm template ahead of lint', () => {
  const commands = selectValidationCommands(runtime({
    commands: [
      `helm lint ${CHART_ROOT}`,
      `helm template ${CHART_ROOT}`
    ],
    knowledgeFacts: knowledgePack([
      baseUnit({
        unitType: 'diagnostic',
        engine: 'helm',
        signature: 'service.port is required',
        likelyCause: 'The values render is missing service.port.',
        recommendedReview: [
          'Run helm template after updating values to render manifests.'
        ]
      })
    ])
  }));

  assert.deepEqual(commands, [
    `helm template ${CHART_ROOT}`,
    `helm lint ${CHART_ROOT}`
  ]);
});

test('Helm RAG priorities keep template and lint commands inside the six-command cap', () => {
  const commands = selectValidationCommands(runtime({
    commands: [
      'custom validation 1',
      'custom validation 2',
      'custom validation 3',
      'custom validation 4',
      'custom validation 5',
      'custom validation 6',
      `helm lint ${CHART_ROOT}`,
      `helm template ${CHART_ROOT}`
    ],
    knowledgeFacts: knowledgePack([
      baseUnit({
        unitType: 'recipe',
        name: 'Helm values render and lint review',
        summary: 'Render manifests and lint chart schema before finishing values edits.',
        steps: [
          'Run helm template to render manifests and check ingress.enabled.',
          'Run helm lint to catch values schema drift.'
        ],
        requiresApproval: false,
        mutationAllowed: false
      })
    ])
  }));

  assert.equal(commands.length, 6);
  assert.equal(commands[0], `helm template ${CHART_ROOT}`);
  assert.equal(commands[1], `helm lint ${CHART_ROOT}`);
  assert.ok(commands.includes('custom validation 1'));
  assert.ok(commands.includes('custom validation 4'));
  assert.equal(commands.includes('custom validation 5'), false);
  assert.equal(commands.includes('custom validation 6'), false);
});

test('Helm schema guidance prioritizes helm lint', () => {
  const commands = selectValidationCommands(runtime({
    commands: [
      `helm template ${CHART_ROOT}`,
      `helm lint ${CHART_ROOT}`
    ],
    knowledgeFacts: knowledgePack([
      baseUnit({
        unitType: 'guidance',
        topic: 'helm-values-schema',
        summary: 'Use chart lint when values schema changes.',
        appliesWhen: ['editing values schema'],
        risk: 'Schema drift is caught by helm lint.'
      })
    ])
  }));

  assert.deepEqual(commands, [
    `helm lint ${CHART_ROOT}`,
    `helm template ${CHART_ROOT}`
  ]);
});

test('validation command selection keeps original order and cap without related RAG units', () => {
  const commands = selectValidationCommands(runtime({
    commands: [
      'custom validation 1',
      'custom validation 2',
      'custom validation 3',
      'custom validation 4',
      'custom validation 5',
      'custom validation 6',
      `helm lint ${CHART_ROOT}`,
      `helm template ${CHART_ROOT}`
    ]
  }));

  assert.deepEqual(commands, [
    'custom validation 1',
    'custom validation 2',
    'custom validation 3',
    'custom validation 4',
    'custom validation 5',
    'custom validation 6'
  ]);
});
