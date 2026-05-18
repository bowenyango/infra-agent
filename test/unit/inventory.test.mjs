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
  assert.equal(chart.chartMetadata.apiVersion, 'v2');
  assert.equal(chart.chartMetadata.version, '0.1.0');
  assert.equal(chart.chartMetadata.appVersion, '1.0.0');
  assert.equal(chart.chartMetadata.chartType, 'application');
  assert.equal(chart.chartMetadata.hasLockFile, false);
  assert.equal(chart.chartMetadata.dependencyCount, 0);
  assert.deepEqual(chart.chartMetadata.dependencies, []);
  assert.equal(chart.deploymentLinks.length, 1);
  const deploymentLink = chart.deploymentLinks[0];
  assert.equal(deploymentLink.kind, 'argocd-application');
  assert.equal(deploymentLink.applicationName, 'payments-api-prod');
  assert.equal(deploymentLink.applicationNamespace, 'argocd');
  assert.equal(deploymentLink.applicationFile, 'apps/payments-api.yaml');
  assert.equal(deploymentLink.sourcePath, 'charts/payments-api');
  assert.equal(deploymentLink.matchReason, 'argocd-source-path-matches-chart-root');
  assert.equal(deploymentLink.confidence, 'medium');
  assert.equal(deploymentLink.destinationNamespace, 'payments');
  assert.equal(deploymentLink.targetRevision, 'main');
  assert.equal(deploymentLink.releaseName, 'payments-api');
  assert.deepEqual(deploymentLink.valueFiles, ['charts/payments-api/values-prod.yaml']);
  assert.equal(deploymentLink.valueFileCount, 1);
  assert.equal(deploymentLink.omittedValueFileCount, 1);
  assert.equal(deploymentLink.valuesLayerCount, 2);
  assert.equal(deploymentLink.syncPolicyAutomated, true);
  assert.deepEqual(deploymentLink.valuesLayers.map(layer => ({
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
  assert.deepEqual(chart.files.primary, [
    'charts/payments-api/Chart.yaml',
    'charts/payments-api/values.yaml',
    'charts/payments-api/values.schema.json'
  ]);
  assert.ok(chart.files.related.includes('apps/payments-api.yaml'));
  assert.ok(chart.files.related.includes('charts/payments-api/values-prod.yaml'));
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
  assert.doesNotMatch(JSON.stringify(report), /kubernetes\.default\.svc/i);
  assert.doesNotMatch(JSON.stringify(report), /secret-values\.yaml/i);
});

test('buildInventoryReport preserves safe Argo values layer order and omits unsafe valueFiles', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-inventory-helm-values-layers-'));

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
    await writeFile(join(tempRoot, 'overlays/canary.yaml'), 'replicaCount: 2\n', 'utf8');
    await writeFile(
      join(tempRoot, 'apps/api.yaml'),
      [
        'apiVersion: argoproj.io/v1alpha1',
        'kind: Application',
        'metadata:',
        '  name: api-prod',
        'spec:',
        '  source:',
        '    path: ./charts/api',
        '    helm:',
        '      valueFiles:',
        '        - ../../overlays/prod.yaml',
        '        - ../../overlays/canary.yaml',
        '        - ../../overlays/secret-values.yaml',
        '        - $values/prod.yaml',
        '        - https://example.com/values.yaml',
        '        - /tmp/absolute-values.yaml',
        '        - ../../../outside.yaml',
        '  destination:',
        '    namespace: api',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const report = buildInventoryReport(inspection);
    const chart = findTarget(report, 'helm-chart', 'charts/api');

    assert.ok(chart);
    assert.deepEqual(chart.deploymentLinks[0]?.valueFiles, [
      'overlays/prod.yaml',
      'overlays/canary.yaml'
    ]);
    assert.equal(chart.deploymentLinks[0]?.omittedValueFileCount, 5);
    assert.equal(chart.deploymentLinks[0]?.valuesLayerCount, 3);
    assert.deepEqual(chart.deploymentLinks[0]?.valuesLayers.map(layer => ({
      order: layer.order,
      path: layer.path,
      source: layer.source
    })), [
      {
        order: 0,
        path: 'charts/api/values.yaml',
        source: 'chart-default'
      },
      {
        order: 1,
        path: 'overlays/prod.yaml',
        source: 'argocd-value-file'
      },
      {
        order: 2,
        path: 'overlays/canary.yaml',
        source: 'argocd-value-file'
      }
    ]);
    assert.ok(chart.files.related.includes('apps/api.yaml'));
    assert.ok(chart.files.related.includes('overlays/prod.yaml'));
    assert.ok(chart.files.related.includes('overlays/canary.yaml'));
    assert.doesNotMatch(JSON.stringify(report), /secret-values\.yaml/i);
    assert.doesNotMatch(JSON.stringify(report), /\$values/i);
    assert.doesNotMatch(JSON.stringify(report), /example\.com/i);
    assert.doesNotMatch(JSON.stringify(report), /absolute-values/i);
    assert.doesNotMatch(JSON.stringify(report), /outside\.yaml/i);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
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

test('buildInventoryReport summarizes Helm chart metadata dependencies from Chart.lock safely', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-inventory-helm-metadata-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'description: api token should not be retained',
        'type: application',
        'version: 0.2.0',
        'appVersion: "1.4.0"',
        'kubeVersion: ">=1.27.0"',
        'home: https://example.com/api-chart?token=bad',
        'dependencies:',
        '  - name: redis',
        '    alias: cache',
        '    version: 17.3.0',
        '    repository: https://charts.bitnami.com/bitnami',
        '  - name: metrics',
        '    version: 1.2.3',
        '    repository: https://charts.example.com/metrics',
        '  - name: api-token-helper',
        '    version: 0.1.0',
        '    repository: https://example.com/secret-helper',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'Chart.lock'),
      [
        'dependencies:',
        '  - name: redis',
        '    version: 17.3.1',
        '    repository: https://charts.bitnami.com/bitnami',
        '  - name: postgresql',
        '    version: 12.1.0',
        '    repository: oci://registry.example.com/charts',
        'digest: sha256:abc123',
        'generated: "2026-04-28T00:00:00Z"',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const report = buildInventoryReport(inspection);
    const chart = findTarget(report, 'helm-chart', 'charts/api');

    assert.ok(chart);
    assert.equal(chart.chartMetadata.apiVersion, 'v2');
    assert.equal(chart.chartMetadata.version, '0.2.0');
    assert.equal(chart.chartMetadata.appVersion, '1.4.0');
    assert.equal(chart.chartMetadata.kubeVersion, '>=1.27.0');
    assert.equal(chart.chartMetadata.chartType, 'application');
    assert.equal(chart.chartMetadata.hasLockFile, true);
    assert.equal(chart.chartMetadata.dependencyCount, chart.chartMetadata.dependencies.length);
    assert.ok(chart.chartMetadata.dependencies.some(dependency =>
      dependency.name === 'metrics'
      && dependency.version === '1.2.3'
      && dependency.repository === 'https://charts.example.com/metrics'
      && dependency.locked === false
    ));
    assert.ok(chart.chartMetadata.dependencies.some(dependency =>
      dependency.name === 'redis'
      && dependency.version === '17.3.1'
      && dependency.repository === 'https://charts.bitnami.com/bitnami'
      && dependency.locked === true
    ));
    assert.ok(chart.chartMetadata.dependencies.some(dependency =>
      dependency.name === 'postgresql'
      && dependency.version === '12.1.0'
      && dependency.repository === 'oci://registry.example.com/charts'
      && dependency.locked === true
    ));
    assert.doesNotMatch(JSON.stringify(report), /dependencies:\s*\n|api-token-helper|secret-helper|token=bad|api token should not be retained|repository:\s/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
