import test from 'node:test';
import assert from 'node:assert/strict';
import { syncInfraWorkflowRecipeKnowledgeUnits } from '../../src/knowledge/infra-workflow-recipe-units.ts';

function source(id, domain, targetPath, kind) {
  return {
    id,
    domain,
    targetPath,
    kind,
    name: `${kind}:${targetPath}`,
    factCount: 3,
    contentHash: id.padEnd(64, 'a').slice(0, 64),
    fetchedAt: null,
    stale: false,
    freshness: 'fresh',
    storagePolicy: {
      scope: 'workspace-private',
      defaultStore: 'local-only',
      shareableByDefault: false,
      requiresExplicitOptIn: true,
      reason: 'Local workspace source.'
    }
  };
}

function buildRuntime() {
  const sources = [
    source('terraform-source', 'terraform', 'terraform/payments-api', 'provider-schema'),
    source('pulumi-source', 'pulumi', 'infra/payments-api', 'pulumi-config'),
    source('helm-source', 'helm', 'charts/payments-api', 'chart-schema')
  ];
  const factUnit = {
    unitType: 'fact',
    factKind: 'argument',
    path: 'resource.aws_lb_listener_rule.listener_arn',
    summary: 'listener_arn is required.',
    confidence: 'high',
    extractionMethod: 'terraform-provider-schema',
    sourceId: 'terraform-source',
    sourceLocator: 'provider schema: listener_arn',
    privacyScope: 'workspace-private',
    required: true,
    type: 'string'
  };

  return {
    task: 'review infra changes',
    preflight: {
      requestedDomains: ['terraform', 'pulumi', 'helm'],
      primaryTarget: {
        kind: 'terraform-root',
        path: 'terraform/payments-api'
      }
    },
    knowledgeFacts: {
      kind: 'infra-agent.knowledge-pack',
      schemaVersion: 1,
      mutationAllowed: false,
      packId: 'b'.repeat(24),
      workspaceRoot: '/workspace',
      cacheRoot: '/workspace/.infra-agent/knowledge-cache',
      requestedDomains: ['terraform', 'pulumi', 'helm'],
      targetPaths: ['terraform/payments-api', 'infra/payments-api', 'charts/payments-api'],
      sourceIds: sources.map(entry => entry.id),
      sourceCount: sources.length,
      factSetCount: sources.length,
      factCount: 9,
      includedFactCount: 1,
      omittedFactCount: 8,
      unitCount: 9,
      includedUnitCount: 1,
      omittedUnitCount: 8,
      maxFacts: 12,
      staleSourceCount: 0,
      storagePolicy: {
        publicReference: 0,
        workspacePrivate: 3,
        shareableByDefault: 0,
        explicitOptInRequired: 3
      },
      sources,
      facts: [],
      units: [factUnit]
    }
  };
}

test('infra workflow recipe units cover Terraform, Pulumi, and Helm workflows', () => {
  const synced = syncInfraWorkflowRecipeKnowledgeUnits(buildRuntime());
  const recipes = synced.knowledgeFacts.units.filter(unit => unit.unitType === 'recipe');

  assert.equal(recipes.length, 3);
  assert.equal(synced.knowledgeFacts.unitCount, 12);
  assert.equal(synced.knowledgeFacts.includedUnitCount, 4);
  assert.equal(synced.knowledgeFacts.omittedUnitCount, 8);
  assert.ok(recipes.some(recipe =>
    recipe.sourceId === 'terraform-source'
    && recipe.steps.some(step => /moved blocks/i.test(step))
  ));
  assert.ok(recipes.some(recipe =>
    recipe.sourceId === 'pulumi-source'
    && recipe.steps.some(step => /pulumi_config_set/i.test(step))
  ));
  assert.ok(recipes.some(recipe =>
    recipe.sourceId === 'helm-source'
    && recipe.steps.some(step => /helm template/i.test(step))
  ));
  assert.ok(recipes.every(recipe =>
    recipe.extractionMethod === 'workflow-recipe'
    && recipe.mutationAllowed === false
  ));
});

test('infra workflow recipe units are synchronized without duplicates', () => {
  const first = syncInfraWorkflowRecipeKnowledgeUnits(buildRuntime());
  const second = syncInfraWorkflowRecipeKnowledgeUnits(first);

  assert.equal(first.knowledgeFacts.units.filter(unit => unit.extractionMethod === 'workflow-recipe').length, 3);
  assert.equal(second.knowledgeFacts.units.filter(unit => unit.extractionMethod === 'workflow-recipe').length, 3);
  assert.equal(second.knowledgeFacts.unitCount, first.knowledgeFacts.unitCount);
});

test('infra workflow recipe unit sync is a no-op without knowledge facts', () => {
  const runtime = {
    preflight: {
      requestedDomains: ['terraform'],
      primaryTarget: null
    },
    knowledgeFacts: null
  };

  assert.equal(syncInfraWorkflowRecipeKnowledgeUnits(runtime), runtime);
});
