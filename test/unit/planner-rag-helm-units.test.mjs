import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { runSingleStep } from '../../src/agent/run-single-step.ts';
import { RuleBasedPlanningModel } from '../../src/agent/rule-based-planner.ts';
import { writeMultiTargetUnitArtifactRegistryWorkspace } from '../support/planner-rag-unit-fixtures.mjs';

function buildHelmRecipeKnowledgePack(unit, targetPath = 'charts/payments-api', sourceName = 'chart-docs:payments-api') {
  return {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: 'helm-recipe-pack',
    workspaceRoot: '/workspace',
    cacheRoot: '/workspace/.infra-agent/knowledge-cache',
    requestedDomains: ['helm'],
    targetPaths: [targetPath],
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
        targetPath,
        kind: 'chart-docs',
        name: sourceName,
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
    units: [unit]
  };
}

function buildObservedHelmPlanningInput({ task, unit }) {
  return {
    runtime: {
      task,
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
              commands: [
                'helm lint charts/payments-api',
                'helm template charts/payments-api'
              ]
            }
          ]
        }
      },
      retrievedContext: [],
      knowledgeFacts: buildHelmRecipeKnowledgePack(unit),
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {}
        }
      ],
      toolSummaries: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  };
}

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

test('rule-based planner uses only selected-target kube-prometheus-stack upgrade units from registry artifacts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-upgrade-registry-scope-'));

  try {
    await writeMultiTargetUnitArtifactRegistryWorkspace(tempRoot);
    const result = await runSingleStep(
      'upgrade helm monitoring kube-prometheus-stack values safely',
      tempRoot,
      undefined,
      'rule-based',
      undefined,
      {
        maxTurns: 3,
        retrievedContextBudget: {
          maxFacts: 5
        }
      }
    );
    const lastTurn = result.turns[result.turns.length - 1];
    const serializedKnowledge = JSON.stringify(result.runtime.knowledgeFacts);

    assert.equal(result.outcome, 'clarification-required');
    assert.deepEqual(result.runtime.knowledgeFacts?.requestedDomains, ['helm']);
    assert.deepEqual(result.runtime.knowledgeFacts?.targetPaths, ['charts/monitoring']);
    assert.equal(lastTurn?.decision.action.kind, 'ask-for-clarification');
    assert.equal(lastTurn?.decision.action.payload?.actionFamily, 'helm-clarification');
    assert.ok(result.runtime.knowledgeFacts?.units.some(unit =>
      unit.unitType === 'recipe'
      && unit.path === 'recipe.helm.monitoring.safe-upgrade'
    ));
    assert.doesNotMatch(serializedKnowledge, /EDGE_HELM_UNIT_SENTINEL/);
    assert.doesNotMatch(serializedKnowledge, /OPS_TERRAFORM_UNIT_SENTINEL/);
    assert.doesNotMatch(serializedKnowledge, /WORKER_PULUMI_UNIT_SENTINEL/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based planner surfaces kube-prometheus-stack validation diagnostics before repair', async () => {
  const model = new RuleBasedPlanningModel();
  const decision = await model.decideNextAction({
    runtime: {
      task: 'review helm template failure for kube-prometheus-stack retention value',
      preflight: {
        requestedDomains: ['helm'],
        requestedEnvironment: 'dev',
        targetCandidates: [
          {
            kind: 'helm-chart',
            path: 'charts/monitoring',
            score: 100,
            reasons: [],
            details: []
          },
          {
            kind: 'pulumi-project',
            path: 'infra/api',
            score: 1,
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
              target: 'charts/monitoring',
              commands: ['helm template charts/monitoring']
            }
          ]
        }
      },
      retrievedContext: [],
      knowledgeFacts: buildHelmRecipeKnowledgePack({
        unitType: 'diagnostic',
        path: 'diagnostic.helm.monitoring.retention',
        summary: 'kube-prometheus-stack validation should check prometheus.prometheusSpec.retention after values migration.',
        confidence: 'high',
        extractionMethod: 'provider-diagnostic',
        sourceId: 'chart-docs-source',
        sourceLocator: 'UPGRADE.md: retention validation',
        privacyScope: 'public-reference',
        engine: 'helm',
        signature: 'prometheus.prometheusSpec.retention must be a duration string',
        likelyCause: 'The migrated kube-prometheus-stack values file changed retention to an invalid duration.',
        recommendedReview: [
          'Compare old and new kube-prometheus-stack chart defaults for prometheus.prometheusSpec.retention.',
          'Run helm template for charts/monitoring before applying values edits.'
        ]
      }, 'charts/monitoring', 'chart-docs:kube-prometheus-stack'),
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
          command: 'helm template charts/monitoring',
          cwd: '/workspace',
          exitCode: 1,
          stdout: '',
          stderr: 'values validation failed: prometheus.prometheusSpec.retention must be a duration string'
        }
      ],
      validationIssues: [
        {
          kind: 'helm-retention-invalid',
          repairable: true,
          sourceCommand: 'helm template charts/monitoring',
          message: 'prometheus.prometheusSpec.retention must be a duration string.',
          guidance: 'Review migrated kube-prometheus-stack values before rerunning helm template.',
          metadata: {
            missingConfigKey: 'prometheus.prometheusSpec.retention'
          }
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
  assert.match(decision.action.rationale, /kube-prometheus-stack chart defaults/i);
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

test('rule-based planner asks for Helm clarification from compact upgrade recipe before edits', async () => {
  const model = new RuleBasedPlanningModel();
  const decision = await model.decideNextAction(buildObservedHelmPlanningInput({
    task: 'upgrade helm payments-api values safely',
    unit: {
      unitType: 'recipe',
      path: 'recipe.helm.payments-api.safe-upgrade',
      summary: 'Review chart defaults and values migration before upgrading this Helm chart.',
      confidence: 'high',
      extractionMethod: 'repo-local-guidance',
      sourceId: 'chart-docs-source',
      sourceLocator: 'UPGRADE.md: safe upgrade',
      privacyScope: 'public-reference',
      name: 'Helm values migration review',
      steps: [
        'Compare old and new chart defaults for breaking values.',
        'Run helm template before applying values edits.'
      ],
      requiresApproval: true,
      mutationAllowed: false
    }
  }));

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.actionFamily, 'helm-clarification');
  assert.equal(decision.action.payload?.clarificationKind, 'general');
  assert.equal(decision.action.payload?.writes, undefined);
  assert.match(decision.action.payload?.questions?.join(' ') ?? '', /values scope|chart version|helm template|render/i);
});

test('rule-based planner ignores irrelevant compact Helm recipe before edits', async () => {
  const model = new RuleBasedPlanningModel();
  const decision = await model.decideNextAction(buildObservedHelmPlanningInput({
    task: 'upgrade helm payments-api values safely',
    unit: {
      unitType: 'recipe',
      path: 'recipe.helm.release-naming',
      summary: 'Keep Helm release names aligned with service ownership labels.',
      confidence: 'medium',
      extractionMethod: 'repo-local-guidance',
      sourceId: 'chart-docs-source',
      sourceLocator: 'README.md: release naming',
      privacyScope: 'public-reference',
      name: 'Helm release naming',
      steps: [
        'Check release name conventions.',
        'Keep ownership labels consistent.'
      ],
      requiresApproval: false,
      mutationAllowed: false
    }
  }));

  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'no-safe-action');
  assert.equal(decision.action.payload?.actionFamily, 'runtime-stop');
});
