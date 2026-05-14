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
