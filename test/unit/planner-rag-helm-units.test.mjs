import test from 'node:test';
import assert from 'node:assert/strict';
import { RuleBasedPlanningModel } from '../../src/agent/rule-based-planner.ts';

test('rule-based planner surfaces Helm validation diagnostics for chart values review', async () => {
  const model = new RuleBasedPlanningModel();
  const decision = await model.decideNextAction({
    runtime: {
      task: 'review helm template failure for payments-api service port',
      preflight: {
        requestedDomains: ['helm'],
        requestedEnvironment: 'dev',
        targetCandidates: [
          {
            kind: 'helm-chart',
            path: 'charts/payments-api',
            score: 100,
            reasons: [],
            details: []
          }
        ],
        assumptions: [],
        blockers: [],
        validation: {
          validators: [{ name: 'helm', available: true }],
          plan: [
            {
              kind: 'helm',
              target: 'charts/payments-api',
              commands: ['helm template charts/payments-api']
            }
          ]
        }
      },
      retrievedContext: [],
      knowledgeFacts: {
        kind: 'infra-agent.knowledge-pack',
        schemaVersion: 1,
        mutationAllowed: false,
        packId: 'helm-diagnostic-pack',
        workspaceRoot: '/workspace',
        cacheRoot: '/workspace/.infra-agent/knowledge-cache',
        requestedDomains: ['helm'],
        targetPaths: ['charts/payments-api'],
        sourceIds: ['chart-docs-source'],
        sourceCount: 1,
        factSetCount: 1,
        factCount: 0,
        includedFactCount: 0,
        omittedFactCount: 0,
        unitCount: 1,
        includedUnitCount: 1,
        omittedUnitCount: 0,
        maxFacts: 4,
        maxUnits: 4,
        staleSourceCount: 0,
        storagePolicy: {
          publicReference: 1,
          workspacePrivate: 0,
          shareableByDefault: 1,
          explicitOptInRequired: 0
        },
        sources: [
          {
            id: 'chart-docs-source',
            domain: 'helm',
            targetPath: 'charts/payments-api',
            kind: 'chart-docs',
            name: 'chart-docs:payments-api',
            factCount: 0,
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
        ],
        facts: [],
        units: [
          {
            unitType: 'diagnostic',
            path: 'diagnostic.helm.payments-api.service.port',
            summary: 'Helm chart requires service.port before rendering templates.',
            confidence: 'high',
            extractionMethod: 'provider-diagnostic',
            sourceId: 'chart-docs-source',
            sourceLocator: 'README.md: Troubleshooting',
            privacyScope: 'public-reference',
            engine: 'helm',
            signature: 'Error: service.port is required',
            likelyCause: 'The selected values file omitted a required chart value.',
            recommendedReview: [
              'Inspect chart values and confirm service.port is declared for the selected environment.',
              'Run helm template for the selected chart after updating values.'
            ]
          }
        ]
      },
      observations: [
        {
          toolName: 'helm_template',
          safety: 'read_only',
          output: {}
        }
      ],
      toolSummaries: [],
      appliedWrites: [],
      validationResults: [
        {
          command: 'helm template charts/payments-api',
          cwd: '/workspace',
          exitCode: 1,
          stdout: '',
          stderr: 'template: service.yaml: executing at <.Values.service.port>: nil pointer evaluating interface {}.port'
        }
      ],
      validationIssues: [
        {
          kind: 'helm-missing-service-port',
          repairable: true,
          sourceCommand: 'helm template charts/payments-api',
          message: 'Validation failed because .Values.service.port is missing.',
          guidance: 'Read chart values and define service.port before rerunning helm template.'
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'validation-blocked');
  assert.equal(decision.action.payload?.actionFamily, 'helm-validation');
  assert.match(decision.action.summary, /Helm validation failed/i);
  assert.match(decision.action.rationale, /service\.port is declared/i);
  assert.match(decision.action.rationale, /helm template/i);
});

test('rule-based planner ignores unrelated selected Helm diagnostics for current validation issue', async () => {
  const model = new RuleBasedPlanningModel();
  const decision = await model.decideNextAction({
    runtime: {
      task: 'review helm template failure for payments-api service port',
      preflight: {
        requestedDomains: ['helm'],
        requestedEnvironment: 'dev',
        targetCandidates: [
          {
            kind: 'helm-chart',
            path: 'charts/payments-api',
            score: 100,
            reasons: [],
            details: []
          }
        ],
        assumptions: [],
        blockers: [],
        validation: {
          validators: [{ name: 'helm', available: true }],
          plan: [
            {
              kind: 'helm',
              target: 'charts/payments-api',
              commands: ['helm template charts/payments-api']
            }
          ]
        }
      },
      retrievedContext: [],
      knowledgeFacts: {
        kind: 'infra-agent.knowledge-pack',
        schemaVersion: 1,
        mutationAllowed: false,
        packId: 'helm-diagnostic-pack',
        workspaceRoot: '/workspace',
        cacheRoot: '/workspace/.infra-agent/knowledge-cache',
        requestedDomains: ['helm'],
        targetPaths: ['charts/payments-api'],
        sourceIds: ['chart-docs-source'],
        sourceCount: 1,
        factSetCount: 1,
        factCount: 0,
        includedFactCount: 0,
        omittedFactCount: 0,
        unitCount: 1,
        includedUnitCount: 1,
        omittedUnitCount: 0,
        maxFacts: 4,
        maxUnits: 4,
        staleSourceCount: 0,
        storagePolicy: {
          publicReference: 1,
          workspacePrivate: 0,
          shareableByDefault: 1,
          explicitOptInRequired: 0
        },
        sources: [
          {
            id: 'chart-docs-source',
            domain: 'helm',
            targetPath: 'charts/payments-api',
            kind: 'chart-docs',
            name: 'chart-docs:payments-api',
            factCount: 0,
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
        ],
        facts: [],
        units: [
          {
            unitType: 'diagnostic',
            path: 'diagnostic.helm.payments-api.image.repository',
            summary: 'Helm chart requires image.repository before rendering templates.',
            confidence: 'high',
            extractionMethod: 'provider-diagnostic',
            sourceId: 'chart-docs-source',
            sourceLocator: 'README.md: Troubleshooting',
            privacyScope: 'public-reference',
            engine: 'helm',
            signature: 'Error: image.repository is required',
            likelyCause: 'The selected values file omitted the image repository.',
            recommendedReview: [
              'Inspect chart values and confirm image.repository is declared for the selected environment.',
              'Run helm template for the selected chart after updating values.'
            ]
          }
        ]
      },
      observations: [
        {
          toolName: 'helm_template',
          safety: 'read_only',
          output: {}
        }
      ],
      toolSummaries: [],
      appliedWrites: [],
      validationResults: [
        {
          command: 'helm template charts/payments-api',
          cwd: '/workspace',
          exitCode: 1,
          stdout: '',
          stderr: 'template: service.yaml: executing at <.Values.service.port>: nil pointer evaluating interface {}.port'
        }
      ],
      validationIssues: [
        {
          kind: 'helm-missing-service-port',
          repairable: true,
          sourceCommand: 'helm template charts/payments-api',
          message: 'Validation failed because .Values.service.port is missing.',
          guidance: 'Read chart values and define service.port before rerunning helm template.'
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'validation-blocked');
  assert.equal(decision.action.payload?.actionFamily, 'validation-blocked');
  assert.match(decision.action.summary, /no bounded repair action/i);
  assert.doesNotMatch(decision.action.rationale, /selected Helm diagnostic unit matched/i);
  assert.doesNotMatch(decision.action.rationale, /image\.repository/i);
});
