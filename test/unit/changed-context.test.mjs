import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve
} from 'node:path';
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
  assert.ok(chart.suggestedInspectFiles.includes('charts/payments-api/values-prod.yaml'));
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
  assert.equal(chart.deploymentLinks[0].omittedValueFileCount, 1);
  assert.equal(chart.deploymentLinks[0].valuesLayerCount, 2);
  assert.deepEqual(chart.deploymentLinks[0].valuesLayers.map(layer => ({
    order: layer.order,
    path: layer.path,
    source: layer.source
  })), [
    {
      order: 0,
      path: 'charts/payments-api/values.yaml',
      source: 'chart-default'
    },
    {
      order: 1,
      path: 'charts/payments-api/values-prod.yaml',
      source: 'argocd-value-file'
    }
  ]);
  assert.doesNotMatch(JSON.stringify(report), /kubernetes\.default\.svc/i);
  assert.doesNotMatch(JSON.stringify(report), /secret-values\.yaml/i);
  assert.deepEqual(report.omitted.unmappedFiles, []);
});

test('buildChangedContextReport maps Argo CD Helm value file changes to the linked Helm chart', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = buildChangedContextReport(inspection, {
    changedFiles: [
      {
        path: 'charts/payments-api/values-prod.yaml',
        status: 'modified'
      }
    ],
    comparison: explicitComparison
  });

  const chart = findComponent(report, 'helm-chart', 'charts/payments-api');

  assert.equal(report.summary.affectedComponentCount, 1);
  assert.deepEqual(report.summary.domains, ['helm']);
  assert.equal(report.summary.riskLevel, 'medium');
  assert.ok(chart);
  assert.deepEqual(chart.changedFiles, [
    {
      path: 'charts/payments-api/values-prod.yaml',
      status: 'modified'
    }
  ]);
  assert.ok(chart.riskHints.includes('Argo CD Helm values file changed'));
  assert.ok(chart.evidence.some(entry =>
    entry.path === 'charts/payments-api/values-prod.yaml'
    && entry.reason === 'changed file is referenced by Argo CD Application Helm valueFiles'
  ));
  assert.ok(chart.deploymentLinks.some(link =>
    link.valuesLayers.some(layer =>
      layer.path === 'charts/payments-api/values-prod.yaml'
      && layer.source === 'argocd-value-file'
    )
  ));
  assert.doesNotMatch(JSON.stringify(report), /secret-values\.yaml/i);
  assert.deepEqual(report.omitted.unmappedFiles, []);
});

test('buildChangedContextReport maps out-of-chart Argo values layer changes to the linked Helm chart', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-changed-helm-values-layer-'));

  try {
    await mkdir(join(tempRoot, 'charts/api'), { recursive: true });
    await mkdir(join(tempRoot, 'apps'), { recursive: true });
    await mkdir(join(tempRoot, 'overlays'), { recursive: true });
    await writeFile(
      join(tempRoot, 'charts/api/Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.1.0',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(join(tempRoot, 'charts/api/values.yaml'), 'replicaCount: 1\n', 'utf8');
    await writeFile(join(tempRoot, 'overlays/prod.yaml'), 'replicaCount: 3\n', 'utf8');
    await writeFile(
      join(tempRoot, 'apps/api.yaml'),
      [
        'apiVersion: argoproj.io/v1alpha1',
        'kind: Application',
        'metadata:',
        '  name: api-prod',
        'spec:',
        '  source:',
        '    path: charts/api',
        '    helm:',
        '      valueFiles:',
        '        - ../../overlays/prod.yaml',
        '        - ../../overlays/secret-values.yaml',
        '  destination:',
        '    namespace: api',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const report = buildChangedContextReport(inspection, {
      changedFiles: [
        {
          path: 'overlays/prod.yaml',
          status: 'modified'
        }
      ],
      comparison: explicitComparison
    });
    const chart = findComponent(report, 'helm-chart', 'charts/api');

    assert.equal(report.summary.affectedComponentCount, 1);
    assert.deepEqual(report.summary.domains, ['helm']);
    assert.equal(report.summary.riskLevel, 'medium');
    assert.ok(chart);
    assert.deepEqual(chart.changedFiles, [
      {
        path: 'overlays/prod.yaml',
        status: 'modified'
      }
    ]);
    assert.ok(chart.riskHints.includes('Argo CD Helm values file changed'));
    assert.ok(chart.suggestedInspectFiles.includes('overlays/prod.yaml'));
    assert.ok(chart.deploymentLinks.some(link =>
      link.valuesLayers.some(layer =>
        layer.path === 'overlays/prod.yaml'
        && layer.source === 'argocd-value-file'
      )
    ));
    assert.doesNotMatch(JSON.stringify(report), /secret-values\.yaml/i);
    assert.deepEqual(report.omitted.unmappedFiles, []);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
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
