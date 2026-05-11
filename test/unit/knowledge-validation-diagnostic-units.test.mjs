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

test('validation diagnostic units add Terraform identity conflict review steps', () => {
  const runtime = buildRuntime({
    validationIssues: [
      {
        kind: 'terraform-create-before-delete-conflict',
        repairable: false,
        sourceCommand: 'terraform -chdir=terraform/edge plan',
        message: 'Priority 100 is already in use on the target listener.',
        guidance: 'Terraform attempted to create a listener rule before the existing provider identity was released.',
        metadata: {
          conflictCode: 'PriorityInUse',
          conflictFamily: 'aws-lb-listener-rule',
          conflictLabel: 'AWS Load Balancer Listener Rule',
          conflictSuggestedAction: 'Use a reviewed moved block or state mapping for logical renames, or choose a free listener priority.',
          resourceAddress: 'aws_lb_listener_rule.api',
          resourceType: 'aws_lb_listener_rule',
          listenerArns: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/api/50dc6c495c0c9188/f2f7dc8efc522ab2',
          listenerRulePriorities: '100'
        }
      }
    ]
  });

  const synced = syncValidationDiagnosticKnowledgeUnits(runtime);
  const diagnostic = synced.knowledgeFacts.units.find(unit => unit.unitType === 'diagnostic');

  assert.ok(diagnostic);
  assert.equal(diagnostic.engine, 'terraform');
  assert.equal(diagnostic.path, 'aws_lb_listener_rule.api');
  assert.ok(diagnostic.recommendedReview.some(review =>
    /AWS Load Balancer Listener Rule conflict at aws_lb_listener_rule\.api/i.test(review)
    && /listenerRulePriorities=100/.test(review)
  ));
  assert.ok(diagnostic.recommendedReview.some(review => /listener ARN and priority ownership/i.test(review)));
  assert.ok(diagnostic.recommendedReview.some(review => /reviewed moved block or state mapping/i.test(review)));
  assert.ok(diagnostic.recommendedReview.some(review => /logical Terraform renames/i.test(review)));
});

test('validation diagnostic units add Pulumi DNS ownership review steps', () => {
  const runtime = buildRuntime({
    validationIssues: [
      {
        kind: 'pulumi-create-before-delete-conflict',
        repairable: false,
        sourceCommand: 'pulumi preview --cwd infra/edge --stack prod',
        message: 'CloudFront alias api.example.com is already associated with another distribution.',
        guidance: 'Pulumi attempted to create a provider-exclusive DNS alias before ownership was resolved.',
        metadata: {
          conflictCode: 'CNAMEAlreadyExists',
          conflictFamily: 'aws-cloudfront-alias',
          conflictLabel: 'AWS CloudFront Alias',
          conflictSuggestedAction: 'Use alias/import/state review or sequence the DNS cutover explicitly.',
          resourceName: 'edge',
          dnsNames: 'api.example.com'
        }
      }
    ]
  });

  const synced = syncValidationDiagnosticKnowledgeUnits(runtime);
  const diagnostic = synced.knowledgeFacts.units.find(unit => unit.unitType === 'diagnostic');

  assert.ok(diagnostic);
  assert.equal(diagnostic.engine, 'pulumi');
  assert.ok(diagnostic.recommendedReview.some(review =>
    /AWS CloudFront Alias conflict at edge/i.test(review)
    && /dnsNames=api\.example\.com/.test(review)
  ));
  assert.ok(diagnostic.recommendedReview.some(review => /CloudFront alias ownership/i.test(review)));
  assert.ok(diagnostic.recommendedReview.some(review => /alias\/import\/state review/i.test(review)));
  assert.ok(diagnostic.recommendedReview.some(review => /logical Pulumi renames/i.test(review)));
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
