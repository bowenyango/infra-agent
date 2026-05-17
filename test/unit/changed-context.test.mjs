import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { buildChangedContextReport } from '../../src/impact/changed-context.ts';

const explicitComparison = {
  source: 'explicit-files'
};

function findComponent(report, kind, targetPath) {
  return report.affectedComponents.find(component =>
    component.kind === kind
    && component.targetPath === targetPath
  );
}

test('buildChangedContextReport maps Helm values changes to the Helm chart', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = buildChangedContextReport(inspection, {
    changedFiles: [
      {
        path: 'charts/payments-api/values.yaml',
        status: 'modified'
      }
    ],
    comparison: explicitComparison
  });

  const chart = findComponent(report, 'helm-chart', 'charts/payments-api');

  assert.equal(report.kind, 'infra-agent.changed-context');
  assert.equal(report.mutationAllowed, false);
  assert.equal(report.summary.changedFileCount, 1);
  assert.equal(report.summary.affectedComponentCount, 1);
  assert.deepEqual(report.summary.domains, ['helm']);
  assert.ok(chart);
  assert.equal(chart.id, 'helm-chart:charts/payments-api');
  assert.equal(chart.domain, 'helm');
  assert.equal(chart.name, 'payments-api');
  assert.deepEqual(chart.changedFiles, [
    {
      path: 'charts/payments-api/values.yaml',
      status: 'modified'
    }
  ]);
  assert.ok(chart.suggestedInspectFiles.includes('charts/payments-api/Chart.yaml'));
  assert.ok(chart.suggestedInspectFiles.includes('charts/payments-api/values.yaml'));
  assert.ok(chart.suggestedInspectFiles.includes('charts/payments-api/values.schema.json'));
  assert.ok(chart.suggestedInspectFiles.includes('apps/payments-api.yaml'));
  assert.deepEqual(chart.suggestedValidationTargets, ['charts/payments-api']);
  assert.deepEqual(report.omitted.unmappedFiles, []);
});

test('buildChangedContextReport maps Argo CD Application changes to the linked Helm chart', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = buildChangedContextReport(inspection, {
    changedFiles: [
      {
        path: 'apps/payments-api.yaml',
        status: 'modified'
      }
    ],
    comparison: explicitComparison
  });

  const chart = findComponent(report, 'helm-chart', 'charts/payments-api');

  assert.equal(report.summary.changedFileCount, 1);
  assert.equal(report.summary.affectedComponentCount, 1);
  assert.deepEqual(report.summary.domains, ['helm']);
  assert.equal(report.summary.riskLevel, 'medium');
  assert.ok(chart);
  assert.equal(chart.id, 'helm-chart:charts/payments-api');
  assert.deepEqual(chart.changedFiles, [
    {
      path: 'apps/payments-api.yaml',
      status: 'modified'
    }
  ]);
  assert.ok(chart.suggestedInspectFiles.includes('apps/payments-api.yaml'));
  assert.ok(chart.suggestedInspectFiles.includes('charts/payments-api/Chart.yaml'));
  assert.deepEqual(chart.suggestedValidationTargets, ['charts/payments-api']);
  assert.ok(chart.riskHints.includes('Argo CD Application sync path for Helm chart changed'));
  assert.ok(chart.riskHints.includes('Argo CD automated sync policy should be reviewed'));
  assert.deepEqual(chart.evidence, [
    {
      path: 'apps/payments-api.yaml',
      reason: 'changed Argo CD Application links to Helm chart'
    }
  ]);
  assert.equal(chart.deploymentLinks.length, 1);
  assert.equal(chart.deploymentLinks[0].applicationFile, 'apps/payments-api.yaml');
  assert.equal(chart.deploymentLinks[0].confidence, 'medium');
  assert.doesNotMatch(JSON.stringify(report), /kubernetes\.default\.svc/i);
  assert.doesNotMatch(JSON.stringify(report), /secret-values\.yaml/i);
  assert.deepEqual(report.omitted.unmappedFiles, []);
});

test('buildChangedContextReport maps Pulumi stack changes to the project and stack validation target', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = buildChangedContextReport(inspection, {
    changedFiles: [
      {
        path: 'infra/payments-api/Pulumi.dev.yaml',
        status: 'modified'
      }
    ],
    comparison: explicitComparison
  });

  const project = findComponent(report, 'pulumi-project', 'infra/payments-api');

  assert.equal(report.summary.affectedComponentCount, 1);
  assert.deepEqual(report.summary.domains, ['pulumi']);
  assert.ok(project);
  assert.equal(project.id, 'pulumi-project:infra/payments-api');
  assert.equal(project.domain, 'pulumi');
  assert.deepEqual(project.changedFiles, [
    {
      path: 'infra/payments-api/Pulumi.dev.yaml',
      status: 'modified'
    }
  ]);
  assert.ok(project.suggestedInspectFiles.includes('infra/payments-api/Pulumi.yaml'));
  assert.ok(project.suggestedInspectFiles.includes('infra/payments-api/Pulumi.dev.yaml'));
  assert.deepEqual(project.suggestedValidationTargets, [
    'infra/payments-api',
    'infra/payments-api:dev'
  ]);
  assert.ok(project.riskHints.includes('Pulumi stack config changed'));
  assert.deepEqual(report.omitted.unmappedFiles, []);
});

test('buildChangedContextReport maps Terraform tfvars changes to the Terraform root', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const report = buildChangedContextReport(inspection, {
    changedFiles: [
      {
        path: 'terraform/payments-api/dev.auto.tfvars',
        status: 'modified'
      }
    ],
    comparison: explicitComparison
  });

  const root = findComponent(report, 'terraform-root', 'terraform/payments-api');

  assert.equal(report.summary.affectedComponentCount, 1);
  assert.deepEqual(report.summary.domains, ['terraform']);
  assert.ok(root);
  assert.equal(root.id, 'terraform-root:terraform/payments-api');
  assert.equal(root.domain, 'terraform');
  assert.deepEqual(root.changedFiles, [
    {
      path: 'terraform/payments-api/dev.auto.tfvars',
      status: 'modified'
    }
  ]);
  assert.ok(root.suggestedInspectFiles.includes('terraform/payments-api/main.tf'));
  assert.ok(root.suggestedInspectFiles.includes('terraform/payments-api/variables.tf'));
  assert.ok(root.suggestedInspectFiles.includes('terraform/payments-api/dev.auto.tfvars'));
  assert.deepEqual(root.suggestedValidationTargets, ['terraform/payments-api']);
  assert.ok(root.riskHints.includes('Terraform variable values changed'));
  assert.deepEqual(report.omitted.unmappedFiles, []);
});

test('buildChangedContextReport applies domain and target filters without mapping unrelated components', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = buildChangedContextReport(inspection, {
    changedFiles: [
      {
        path: 'charts/payments-api/values.yaml',
        status: 'modified'
      },
      {
        path: 'infra/payments-api/Pulumi.dev.yaml',
        status: 'modified'
      }
    ],
    comparison: explicitComparison,
    domains: ['helm'],
    targetPaths: ['charts/payments-api']
  });

  assert.equal(report.summary.affectedComponentCount, 1);
  assert.deepEqual(report.summary.domains, ['helm']);
  assert.ok(findComponent(report, 'helm-chart', 'charts/payments-api'));
  assert.equal(findComponent(report, 'pulumi-project', 'infra/payments-api'), undefined);
  assert.deepEqual(report.omitted.unmappedFiles, [
    {
      path: 'infra/payments-api/Pulumi.dev.yaml',
      status: 'modified'
    }
  ]);
});

test('buildChangedContextReport leaves unmapped files in omitted.unmappedFiles', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = buildChangedContextReport(inspection, {
    changedFiles: [
      {
        path: 'README.md',
        status: 'modified'
      }
    ],
    comparison: explicitComparison
  });

  assert.equal(report.summary.changedFileCount, 1);
  assert.equal(report.summary.affectedComponentCount, 0);
  assert.deepEqual(report.summary.domains, []);
  assert.deepEqual(report.affectedComponents, []);
  assert.deepEqual(report.omitted.unmappedFiles, [
    {
      path: 'README.md',
      status: 'modified'
    }
  ]);
});
