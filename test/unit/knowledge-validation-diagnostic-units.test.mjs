import test from 'node:test';
import assert from 'node:assert/strict';
import { syncValidationDiagnosticKnowledgeUnits } from '../../src/knowledge/validation-diagnostic-units.ts';

function buildRuntime(overrides = {}) {
  const source = {
    id: 'pulumi-config-source',
    domain: 'pulumi',
    targetPath: 'infra/payments-api',
    kind: 'pulumi-config',
    name: 'pulumi-config:infra/payments-api',
    factCount: 5,
    contentHash: 'a'.repeat(64),
    fetchedAt: null,
    stale: false,
    freshness: 'fresh',
    storagePolicy: {
      scope: 'workspace-private',
      defaultStore: 'local-only',
      shareableByDefault: false,
      requiresExplicitOptIn: true,
      reason: 'Local workspace config source.'
    }
  };
  const factUnit = {
    unitType: 'fact',
    factKind: 'pulumi-config-parameter',
    path: 'config.payments-api:imageTag',
    summary: 'config.payments-api:imageTag is declared by Pulumi project config.',
    confidence: 'high',
    extractionMethod: 'repo-local-static',
    sourceId: source.id,
    sourceLocator: 'Pulumi.yaml: config.payments-api:imageTag',
    privacyScope: 'workspace-private',
    type: 'string'
  };

  return {
    task: 'update Pulumi image tag',
    preflight: {
      primaryTarget: {
        kind: 'pulumi-project',
        path: 'infra/payments-api'
      }
    },
    knowledgeFacts: {
      kind: 'infra-agent.knowledge-pack',
      schemaVersion: 1,
      mutationAllowed: false,
      packId: 'a'.repeat(24),
      workspaceRoot: '/workspace',
      cacheRoot: '/workspace/.infra-agent/knowledge-cache',
      requestedDomains: ['pulumi'],
      targetPaths: ['infra/payments-api'],
      sourceIds: [source.id],
      sourceCount: 1,
      factSetCount: 1,
      factCount: 5,
      includedFactCount: 1,
      omittedFactCount: 4,
      unitCount: 5,
      includedUnitCount: 1,
      omittedUnitCount: 4,
      maxFacts: 5,
      staleSourceCount: 0,
      storagePolicy: {
        publicReference: 0,
        workspacePrivate: 1,
        shareableByDefault: 0,
        explicitOptInRequired: 1
      },
      sources: [source],
      facts: [],
      units: [factUnit]
    },
    validationIssues: [],
    ...overrides
  };
}

test('validation diagnostic units are synchronized from current validation issues', () => {
  const runtime = buildRuntime({
    validationIssues: [
      {
        kind: 'pulumi-missing-config',
        repairable: true,
        sourceCommand: 'pulumi preview --cwd infra/payments-api --stack dev',
        message: 'Pulumi stack config is missing payments-api:imageTag.',
        guidance: 'Set payments-api:imageTag in the selected Pulumi stack file before rerunning preview.',
        metadata: {
          missingConfigKey: 'payments-api:imageTag'
        }
      }
    ]
  });

  const synced = syncValidationDiagnosticKnowledgeUnits(runtime);
  const diagnostic = synced.knowledgeFacts.units.find(unit => unit.unitType === 'diagnostic');

  assert.ok(diagnostic);
  assert.equal(diagnostic.extractionMethod, 'validation-diagnostic');
  assert.equal(diagnostic.privacyScope, 'private-run');
  assert.equal(diagnostic.engine, 'pulumi');
  assert.equal(diagnostic.sourceId, 'pulumi-config-source');
  assert.match(diagnostic.signature, /pulumi-missing-config/);
  assert.deepEqual(diagnostic.recommendedReview, [
    'Set payments-api:imageTag in the selected Pulumi stack file before rerunning preview.',
    'Rerun validator: pulumi preview --cwd infra/payments-api --stack dev'
  ]);
  assert.equal(synced.knowledgeFacts.unitCount, 6);
  assert.equal(synced.knowledgeFacts.includedUnitCount, 2);
  assert.equal(synced.knowledgeFacts.omittedUnitCount, 4);

  const cleared = syncValidationDiagnosticKnowledgeUnits({
    ...synced,
    validationIssues: []
  });

  assert.equal(cleared.knowledgeFacts.units.some(unit => unit.extractionMethod === 'validation-diagnostic'), false);
  assert.equal(cleared.knowledgeFacts.unitCount, 5);
  assert.equal(cleared.knowledgeFacts.includedUnitCount, 1);
  assert.equal(cleared.knowledgeFacts.omittedUnitCount, 4);
});

test('validation diagnostic units avoid secret-like issue fields', () => {
  const runtime = buildRuntime({
    validationIssues: [
      {
        kind: 'pulumi-missing-config',
        repairable: true,
        sourceCommand: 'pulumi preview --cwd infra/payments-api',
        message: 'missing apiToken value',
        guidance: 'set apiToken before retrying',
        metadata: {
          missingConfigKey: 'apiToken'
        }
      }
    ]
  });

  const synced = syncValidationDiagnosticKnowledgeUnits(runtime);
  const diagnostic = synced.knowledgeFacts.units.find(unit => unit.unitType === 'diagnostic');

  assert.ok(diagnostic);
  assert.doesNotMatch(JSON.stringify(diagnostic), /apiToken/i);
  assert.equal(diagnostic.summary, 'Validation classifier detected pulumi-missing-config.');
  assert.equal(diagnostic.signature, 'pulumi-missing-config');
});

test('validation diagnostic unit sync is a no-op without knowledge sources', () => {
  const runtime = buildRuntime({
    knowledgeFacts: null,
    validationIssues: [
      {
        kind: 'terraform-validate-failure',
        repairable: false,
        sourceCommand: 'terraform validate',
        message: 'Terraform validation failed.'
      }
    ]
  });

  assert.equal(syncValidationDiagnosticKnowledgeUnits(runtime), runtime);
});
