import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPlannerKnowledgeSignal,
  selectPlannerKnowledgeUnits
} from '../../src/agent/planner-knowledge-unit-selector.ts';

function baseRuntime(units, sources, targetPaths = ['terraform/app']) {
  return {
    task: 'review compact RAG units',
    preflight: {
      requestedDomains: ['terraform'],
      targetCandidates: [],
      validation: {
        validators: [],
        plan: []
      }
    },
    retrievedContext: [],
    knowledgeFacts: {
      kind: 'infra-agent.knowledge-pack',
      schemaVersion: 1,
      mutationAllowed: false,
      packId: 'selector-pack',
      workspaceRoot: '/workspace',
      cacheRoot: '/workspace/.infra-agent/knowledge-cache',
      requestedDomains: [...new Set(sources.map(source => source.domain))],
      targetPaths,
      sourceIds: sources.map(source => source.id),
      sourceCount: sources.length,
      factSetCount: sources.length,
      factCount: 0,
      includedFactCount: 0,
      omittedFactCount: 0,
      unitCount: units.length,
      includedUnitCount: units.length,
      omittedUnitCount: 0,
      maxFacts: 8,
      maxUnits: 8,
      staleSourceCount: sources.filter(source => source.stale).length,
      storagePolicy: {
        publicReference: 0,
        workspacePrivate: sources.length,
        shareableByDefault: 0,
        explicitOptInRequired: sources.length
      },
      sources,
      facts: [],
      units
    },
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

function source(id, domain, targetPath, extra = {}) {
  return {
    id,
    domain,
    targetPath,
    kind: 'knowledge-unit-artifact',
    name: id,
    factCount: 0,
    contentHash: 'a'.repeat(64),
    fetchedAt: null,
    stale: false,
    freshness: 'fresh',
    storagePolicy: {
      scope: 'workspace-private',
      defaultStore: 'local-only',
      shareableByDefault: false,
      requiresExplicitOptIn: true,
      reason: 'test source'
    },
    ...extra
  };
}

function unit(sourceId, unitType, path, summary, extra = {}) {
  return {
    unitType,
    path,
    summary,
    confidence: 'high',
    extractionMethod: unitType === 'recipe' ? 'workflow-recipe' : 'official-guidance',
    sourceId,
    sourceLocator: path,
    privacyScope: 'workspace-private',
    ...extra
  };
}

test('planner knowledge selector returns target-scoped Terraform rename units with reasons', () => {
  const sources = [
    source('terraform-app', 'terraform', 'terraform/app', { provider: 'hashicorp/aws' }),
    source('terraform-ops', 'terraform', 'terraform/ops', { provider: 'hashicorp/aws' })
  ];
  const runtime = baseRuntime([
    unit('terraform-app', 'guidance', 'guidance.terraform.app.rename', 'Use Terraform moved blocks when the resource address changes.'),
    unit('terraform-ops', 'guidance', 'guidance.terraform.ops.rename', 'Use Terraform moved blocks when the ops resource address changes.')
  ], sources);
  const selected = selectPlannerKnowledgeUnits(runtime, {
    signals: ['terraform-rename-review']
  });

  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.unit.path, 'guidance.terraform.app.rename');
  assert.deepEqual(selected[0]?.signals, ['terraform-rename-review']);
  assert.ok(selected[0]?.reasons.includes('target:terraform/app'));
  assert.ok(selected[0]?.reasons.includes('provider:hashicorp/aws'));
});

test('planner knowledge selector keeps Helm stack chart names out of Pulumi rename signals', () => {
  const sources = [
    source('helm-monitoring', 'helm', 'charts/monitoring', { chart: 'kube-prometheus-stack' }),
    source('pulumi-api', 'pulumi', 'infra/api', { packageName: '@pulumi/aws' })
  ];
  const runtime = baseRuntime([
    unit('helm-monitoring', 'recipe', 'recipe.helm.monitoring.safe-upgrade', 'Review kube-prometheus-stack chart defaults and values migration before upgrades.', {
      name: 'kube-prometheus-stack values migration',
      steps: ['Compare chart defaults.', 'Run helm template before edits.'],
      requiresApproval: true,
      mutationAllowed: false
    }),
    unit('pulumi-api', 'recipe', 'recipe.pulumi.api.alias', 'Use Pulumi aliases when a logical resource name changes and the physical resource is retained.', {
      name: 'Pulumi alias review',
      steps: ['Collect old and new URNs.', 'Review aliases.'],
      requiresApproval: true,
      mutationAllowed: false
    })
  ], sources, ['charts/monitoring', 'infra/api']);

  assert.equal(hasPlannerKnowledgeSignal(runtime, 'helm-upgrade-migration-review'), true);
  assert.equal(hasPlannerKnowledgeSignal(runtime, 'pulumi-rename-review'), true);
  const helmSelected = selectPlannerKnowledgeUnits(runtime, {
    signals: ['helm-upgrade-migration-review']
  });

  assert.equal(helmSelected.length, 1);
  assert.equal(helmSelected[0]?.source?.chart, 'kube-prometheus-stack');
});

test('planner knowledge selector ignores stale validation diagnostics', () => {
  const runtime = baseRuntime([
    unit('stale-pulumi', 'diagnostic', 'diagnostic.pulumi.alias', 'CNAMEAlreadyExists requires CloudFront alias ownership and import/state review.', {
      extractionMethod: 'validation-diagnostic',
      engine: 'pulumi',
      signature: 'CNAMEAlreadyExists',
      likelyCause: 'Pulumi attempted to create a CloudFront alias before ownership was resolved.',
      recommendedReview: ['Review aliases and import/state repair before retrying.']
    })
  ], [
    source('stale-pulumi', 'pulumi', 'infra/edge', {
      stale: true,
      freshness: 'stale',
      packageName: '@pulumi/aws'
    })
  ], ['infra/edge']);

  assert.equal(hasPlannerKnowledgeSignal(runtime, 'pulumi-validation-review'), false);
});

test('planner knowledge selector ranks diagnostics by validation issue kind and metadata reasons', () => {
  const sources = [
    source('helm-current', 'helm', 'charts/payments-api', { chart: 'payments-api' }),
    source('helm-other', 'helm', 'charts/other-api', { chart: 'other-api' }),
    source('helm-stale', 'helm', 'charts/payments-api', {
      chart: 'payments-api',
      stale: true,
      freshness: 'stale'
    })
  ];
  const runtime = baseRuntime([
    unit('helm-current', 'diagnostic', 'diagnostic.helm.generic', 'Helm template failed; review chart values before retrying.', {
      extractionMethod: 'validation-diagnostic',
      engine: 'helm',
      signature: 'helm-template-failure',
      likelyCause: 'A Helm validation command failed.',
      recommendedReview: ['Review chart values.']
    }),
    unit('helm-current', 'diagnostic', 'diagnostic.helm.service-port', 'helm-missing-service-port requires service.port in charts/payments-api/values.yaml.', {
      extractionMethod: 'validation-diagnostic',
      engine: 'helm',
      signature: 'helm-missing-service-port:service.port',
      likelyCause: 'The chart values are missing service.port.',
      recommendedReview: ['Define service.port in charts/payments-api/values.yaml.']
    }),
    unit('helm-other', 'diagnostic', 'diagnostic.helm.other-service-port', 'helm-missing-service-port requires service.port in charts/other-api/values.yaml.', {
      extractionMethod: 'validation-diagnostic',
      engine: 'helm',
      signature: 'helm-missing-service-port:service.port',
      likelyCause: 'The other chart values are missing service.port.',
      recommendedReview: ['Define service.port in charts/other-api/values.yaml.']
    }),
    unit('helm-stale', 'diagnostic', 'diagnostic.helm.stale-service-port', 'helm-missing-service-port requires service.port in charts/payments-api/values.yaml.', {
      extractionMethod: 'validation-diagnostic',
      engine: 'helm',
      signature: 'helm-missing-service-port:service.port',
      likelyCause: 'The stale chart values are missing service.port.',
      recommendedReview: ['Define service.port in charts/payments-api/values.yaml.']
    })
  ], sources, ['charts/payments-api']);

  const selected = selectPlannerKnowledgeUnits(runtime, {
    signals: ['helm-validation-review'],
    validationIssues: [
      {
        kind: 'helm-missing-service-port',
        repairable: true,
        sourceCommand: 'helm template charts/payments-api',
        message: 'Validation failed because .Values.service.port is missing.',
        guidance: 'Read chart values and define service.port before rerunning helm template.',
        metadata: {
          missingConfigKey: 'service.port',
          yamlPath: 'charts/payments-api/values.yaml'
        }
      }
    ]
  });

  assert.deepEqual(selected.map(entry => entry.unit.path), [
    'diagnostic.helm.service-port',
    'diagnostic.helm.generic'
  ]);
  assert.ok(selected[0]?.reasons.includes('validation-issue:helm-missing-service-port'));
  assert.ok(selected[0]?.reasons.includes('validation-issue:missingConfigKey'));
  assert.ok(selected[0]?.reasons.includes('identity:missingConfigKey:service.port'));
  assert.ok(selected[0]?.reasons.includes('validation-issue:yamlPath'));
  assert.equal(selected.some(entry => entry.unit.path === 'diagnostic.helm.other-service-port'), false);
  assert.equal(selected.some(entry => entry.unit.path === 'diagnostic.helm.stale-service-port'), false);
});

test('planner knowledge selector adds task action hint reasons', () => {
  const sources = [
    source('pulumi-api', 'pulumi', 'infra/api', { packageName: '@pulumi/aws' })
  ];
  const runtime = baseRuntime([
    unit('pulumi-api', 'recipe', 'recipe.pulumi.state-repair', 'Use Pulumi aliases with import/state repair when a logical resource name changes.', {
      name: 'Pulumi state repair review',
      steps: ['Collect old and new URNs.', 'Review import/state repair before retrying.'],
      requiresApproval: true,
      mutationAllowed: false
    })
  ], sources, ['infra/api']);

  const selected = selectPlannerKnowledgeUnits(runtime, {
    signals: ['pulumi-rename-review'],
    plannedActionHints: ['state repair']
  });

  assert.equal(selected.length, 1);
  assert.ok(selected[0]?.reasons.includes('task-action:state repair'));
});

test('planner knowledge selector adds resource module and chart identity hint reasons', () => {
  const sources = [
    source('terraform-edge', 'terraform', 'terraform/edge', {
      provider: 'hashicorp/aws',
      module: 'edge-listener'
    }),
    source('helm-monitoring', 'helm', 'charts/monitoring', {
      chart: 'kube-prometheus-stack'
    })
  ];
  const runtime = baseRuntime([
    unit('terraform-edge', 'guidance', 'guidance.terraform.edge-listener.rename', 'Use Terraform moved blocks when aws_lb_listener_rule.api changes resource address.'),
    unit('helm-monitoring', 'recipe', 'recipe.helm.monitoring.safe-upgrade', 'Review kube-prometheus-stack chart defaults and values migration before upgrades.', {
      name: 'kube-prometheus-stack values migration',
      steps: ['Compare chart defaults.', 'Run helm template before edits.'],
      requiresApproval: true,
      mutationAllowed: false
    })
  ], sources, ['terraform/edge', 'charts/monitoring']);

  const selected = selectPlannerKnowledgeUnits(runtime, {
    signals: ['terraform-rename-review', 'helm-upgrade-migration-review'],
    identityHints: {
      resources: ['aws_lb_listener_rule.api'],
      modules: ['edge-listener'],
      charts: ['kube-prometheus-stack']
    }
  });
  const terraformSelected = selected.find(entry => entry.unit.path === 'guidance.terraform.edge-listener.rename');
  const helmSelected = selected.find(entry => entry.unit.path === 'recipe.helm.monitoring.safe-upgrade');

  assert.ok(terraformSelected?.reasons.includes('identity:resource:aws_lb_listener_rule.api'));
  assert.ok(terraformSelected?.reasons.includes('identity:module:edge-listener'));
  assert.ok(helmSelected?.reasons.includes('identity:chart:kube-prometheus-stack'));
  assert.ok(helmSelected?.reasons.includes('chart:kube-prometheus-stack'));
});
