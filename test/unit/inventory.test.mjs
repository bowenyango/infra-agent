import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { buildInventoryReport } from '../../src/domain/inventory.ts';

function findTarget(report, kind, path) {
  return report.targets.find(target =>
    target.kind === kind
    && target.path === path
  );
}

test('buildInventoryReport summarizes Helm and Pulumi targets from inspection', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = buildInventoryReport(inspection);

  const chart = findTarget(report, 'helm-chart', 'charts/payments-api');
  const project = findTarget(report, 'pulumi-project', 'infra/payments-api');

  assert.equal(report.kind, 'infra-agent.inventory');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mutationAllowed, false);
  assert.equal(report.summary.totalTargetCount, 2);
  assert.equal(report.summary.includedTargetCount, 2);
  assert.deepEqual(report.summary.domains, ['helm', 'pulumi']);
  assert.equal(report.workspaceConfigPresent, false);
  assert.equal(report.knowledgeCache.source, 'default: user cache');

  assert.ok(chart);
  assert.equal(chart.id, 'helm-chart:charts/payments-api');
  assert.equal(chart.domain, 'helm');
  assert.equal(chart.chartName, 'payments-api');
  assert.equal(chart.hasValuesFile, true);
  assert.equal(chart.hasTemplatesDir, true);
  assert.equal(chart.valuesSchemaFile, 'charts/payments-api/values.schema.json');
  assert.deepEqual(chart.files.primary, [
    'charts/payments-api/Chart.yaml',
    'charts/payments-api/values.yaml',
    'charts/payments-api/values.schema.json'
  ]);
  assert.deepEqual(chart.validationTargets, ['charts/payments-api']);
  assert.ok(chart.semanticFactCount > 0);

  assert.ok(project);
  assert.equal(project.id, 'pulumi-project:infra/payments-api');
  assert.equal(project.domain, 'pulumi');
  assert.equal(project.projectFile, 'infra/payments-api/Pulumi.yaml');
  assert.equal(project.stackFileCount, 1);
  assert.deepEqual(project.stackNames, ['dev']);
  assert.deepEqual(project.validationTargets, [
    'infra/payments-api',
    'infra/payments-api:dev'
  ]);
  assert.ok(project.files.primary.includes('infra/payments-api/Pulumi.yaml'));
  assert.ok(project.files.related.includes('infra/payments-api/Pulumi.dev.yaml'));
  assert.doesNotMatch(JSON.stringify(report), /example-api-secret/i);
});

test('buildInventoryReport summarizes Terraform roots from inspection', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  inspection.configSemantics.push({
    targetKind: 'terraform-root',
    targetPath: 'terraform/payments-api',
    facts: [
      {
        kind: 'replacement-risk',
        path: 'resource.aws_lb_listener_rule.priority',
        message: 'Synthetic provider schema fact for inventory aggregation.',
        source: {
          kind: 'terraform-provider-schema',
          path: 'terraform/payments-api/.infra-agent/terraform-provider-schema.json'
        },
        confidence: 'high'
      }
    ]
  });
  const report = buildInventoryReport(inspection);
  const root = findTarget(report, 'terraform-root', 'terraform/payments-api');
  const expectedSemanticFactCount = inspection.configSemantics
    .filter(summary =>
      summary.targetKind === 'terraform-root'
      && summary.targetPath === 'terraform/payments-api'
    )
    .reduce((sum, summary) => sum + summary.facts.length, 0);

  assert.equal(report.summary.totalTargetCount, 1);
  assert.deepEqual(report.summary.domains, ['terraform']);
  assert.ok(root);
  assert.equal(root.id, 'terraform-root:terraform/payments-api');
  assert.equal(root.domain, 'terraform');
  assert.equal(root.tfFileCount, 2);
  assert.equal(root.tfvarsFileCount, 1);
  assert.equal(root.providerSchemaFileCount, 0);
  assert.deepEqual(root.files.primary, [
    'terraform/payments-api/main.tf',
    'terraform/payments-api/variables.tf'
  ]);
  assert.ok(root.files.related.includes('terraform/payments-api/dev.auto.tfvars'));
  assert.deepEqual(root.validationTargets, ['terraform/payments-api']);
  assert.equal(root.semanticFactCount, expectedSemanticFactCount);
  assert.equal(report.summary.semanticFactCount, expectedSemanticFactCount);
});

test('buildInventoryReport applies domain and target filters with omitted counts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = buildInventoryReport(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api']
  });

  assert.equal(report.summary.totalTargetCount, 2);
  assert.equal(report.summary.includedTargetCount, 1);
  assert.equal(report.summary.omittedTargetCount, 1);
  assert.deepEqual(report.summary.domains, ['helm']);
  assert.deepEqual(report.filters.domains, ['helm']);
  assert.deepEqual(report.filters.targetPaths, ['charts/payments-api']);
  assert.ok(findTarget(report, 'helm-chart', 'charts/payments-api'));
  assert.equal(findTarget(report, 'pulumi-project', 'infra/payments-api'), undefined);
  assert.deepEqual(report.omitted.filteredTargetsByDomain, [
    {
      domain: 'pulumi',
      count: 1
    }
  ]);
});

test('buildInventoryReport caps related file references', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = buildInventoryReport(inspection, {
    relatedFileLimit: 0
  });
  const project = findTarget(report, 'pulumi-project', 'infra/payments-api');

  assert.ok(project);
  assert.deepEqual(project.files.related, []);
  assert.equal(project.files.omittedRelatedCount, 1);
});
