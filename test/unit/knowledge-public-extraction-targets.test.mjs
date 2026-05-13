import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHelmChartDocsSource,
  buildHelmChartDocsTarget,
  buildPulumiPackageDocsSource,
  buildPulumiPackageDocsTarget,
  buildTerraformProviderDocsSource,
  buildTerraformProviderDocsTarget,
  CANONICAL_PUBLIC_EXTRACTION_TARGETS,
  HELM_KUBE_PROMETHEUS_STACK_DOCS_TARGET,
  PULUMI_AWS_PACKAGE_DOCS_TARGET,
  TERRAFORM_HASHICORP_AWS_PROVIDER_DOCS_TARGET
} from '../../src/knowledge/public-extraction-targets.ts';

test('canonical public extraction targets expose stable v0 source identities', () => {
  assert.deepEqual(
    CANONICAL_PUBLIC_EXTRACTION_TARGETS.map(target => target.id),
    [
      'public:terraform-provider-docs:hashicorp/aws:latest',
      'public:pulumi-package-docs:aws',
      'public:helm-chart-docs:kube-prometheus-stack'
    ]
  );

  assert.deepEqual(TERRAFORM_HASHICORP_AWS_PROVIDER_DOCS_TARGET, {
    id: 'public:terraform-provider-docs:hashicorp/aws:latest',
    domain: 'terraform',
    targetKind: 'terraform-provider-docs',
    targetName: 'hashicorp/aws',
    targetPath: 'public/terraform/providers/hashicorp/aws/latest',
    source: {
      kind: 'terraform-registry',
      name: 'terraform-registry:provider:hashicorp/aws',
      provider: 'hashicorp/aws',
      version: 'latest',
      url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs'
    },
    expectedSourceIdentity: {
      kind: 'terraform-registry',
      name: 'terraform-registry:provider:hashicorp/aws',
      provider: 'hashicorp/aws',
      version: 'latest',
      url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs'
    }
  });

  assert.deepEqual(PULUMI_AWS_PACKAGE_DOCS_TARGET, {
    id: 'public:pulumi-package-docs:aws',
    domain: 'pulumi',
    targetKind: 'pulumi-package-docs',
    targetName: '@pulumi/aws',
    targetPath: 'public/pulumi/packages/aws',
    source: {
      kind: 'pulumi-docs',
      name: 'pulumi-docs:package:aws',
      packageName: '@pulumi/aws',
      url: 'https://www.pulumi.com/registry/packages/aws/api-docs/'
    },
    expectedSourceIdentity: {
      kind: 'pulumi-docs',
      name: 'pulumi-docs:package:aws',
      packageName: '@pulumi/aws',
      url: 'https://www.pulumi.com/registry/packages/aws/api-docs/'
    }
  });

  assert.deepEqual(HELM_KUBE_PROMETHEUS_STACK_DOCS_TARGET, {
    id: 'public:helm-chart-docs:kube-prometheus-stack',
    domain: 'helm',
    targetKind: 'helm-chart-docs',
    targetName: 'kube-prometheus-stack',
    targetPath: 'public/helm/charts/kube-prometheus-stack',
    source: {
      kind: 'chart-docs',
      name: 'chart-docs:kube-prometheus-stack',
      chart: 'kube-prometheus-stack',
      url: 'https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack/'
    },
    expectedSourceIdentity: {
      kind: 'chart-docs',
      name: 'chart-docs:kube-prometheus-stack',
      chart: 'kube-prometheus-stack',
      url: 'https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack/'
    }
  });
});

test('Terraform provider docs builder is provider-address based and reusable', () => {
  const source = buildTerraformProviderDocsSource({
    providerAddress: 'HashiCorp/Google',
    version: '6.12.0'
  });
  const target = buildTerraformProviderDocsTarget({
    providerAddress: 'HashiCorp/Google',
    version: '6.12.0'
  });

  assert.deepEqual(source, {
    kind: 'terraform-registry',
    name: 'terraform-registry:provider:hashicorp/google',
    provider: 'hashicorp/google',
    version: '6.12.0',
    url: 'https://registry.terraform.io/providers/hashicorp/google/6.12.0/docs'
  });
  assert.equal(target.id, 'public:terraform-provider-docs:hashicorp/google:6.12.0');
  assert.equal(target.targetPath, 'public/terraform/providers/hashicorp/google/6.12.0');
  assert.deepEqual(target.expectedSourceIdentity, {
    kind: 'terraform-registry',
    name: 'terraform-registry:provider:hashicorp/google',
    provider: 'hashicorp/google',
    version: '6.12.0',
    url: 'https://registry.terraform.io/providers/hashicorp/google/6.12.0/docs'
  });
});

test('Pulumi package docs builder is package and slug based and reusable', () => {
  const source = buildPulumiPackageDocsSource({
    packageName: '@pulumi/kubernetes',
    slug: 'kubernetes',
    version: '4.20.1'
  });
  const target = buildPulumiPackageDocsTarget({
    packageName: '@pulumi/kubernetes',
    slug: 'kubernetes',
    version: '4.20.1'
  });

  assert.deepEqual(source, {
    kind: 'pulumi-docs',
    name: 'pulumi-docs:package:kubernetes',
    packageName: '@pulumi/kubernetes',
    version: '4.20.1',
    url: 'https://www.pulumi.com/registry/packages/kubernetes/api-docs/'
  });
  assert.equal(target.id, 'public:pulumi-package-docs:kubernetes:4.20.1');
  assert.equal(target.targetPath, 'public/pulumi/packages/kubernetes/4.20.1');
  assert.deepEqual(target.expectedSourceIdentity, {
    kind: 'pulumi-docs',
    name: 'pulumi-docs:package:kubernetes',
    packageName: '@pulumi/kubernetes',
    version: '4.20.1',
    url: 'https://www.pulumi.com/registry/packages/kubernetes/api-docs/'
  });
});

test('Helm chart docs builder is chart and URL based and reusable', () => {
  const source = buildHelmChartDocsSource({
    chart: 'grafana',
    url: 'https://artifacthub.io/packages/helm/grafana/grafana/',
    version: '8.10.0'
  });
  const target = buildHelmChartDocsTarget({
    chart: 'grafana',
    url: 'https://artifacthub.io/packages/helm/grafana/grafana/',
    version: '8.10.0'
  });

  assert.deepEqual(source, {
    kind: 'chart-docs',
    name: 'chart-docs:grafana',
    chart: 'grafana',
    version: '8.10.0',
    url: 'https://artifacthub.io/packages/helm/grafana/grafana/'
  });
  assert.equal(target.id, 'public:helm-chart-docs:grafana:8.10.0');
  assert.equal(target.targetPath, 'public/helm/charts/grafana/8.10.0');
  assert.deepEqual(target.expectedSourceIdentity, {
    kind: 'chart-docs',
    name: 'chart-docs:grafana',
    chart: 'grafana',
    version: '8.10.0',
    url: 'https://artifacthub.io/packages/helm/grafana/grafana/'
  });
});

test('public extraction builders reject unsafe target inputs', () => {
  assert.throws(
    () => buildTerraformProviderDocsSource({ providerAddress: 'hashicorp/aws/instance' }),
    /Terraform provider address is not safe/
  );
  assert.throws(
    () => buildTerraformProviderDocsSource({ providerAddress: 'hashicorp/api-token' }),
    /Terraform provider address is not safe/
  );
  assert.throws(
    () => buildPulumiPackageDocsSource({ packageName: '@pulumi/aws', slug: 'aws-secret' }),
    /Pulumi package slug is not safe/
  );
  assert.throws(
    () => buildPulumiPackageDocsSource({ packageName: '@private/aws' }),
    /Pulumi package must use/
  );
  assert.throws(
    () => buildHelmChartDocsSource({
      chart: '../kube-prometheus-stack',
      url: 'https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack/'
    }),
    /Helm chart label is not safe/
  );
  assert.throws(
    () => buildHelmChartDocsSource({
      chart: 'grafana',
      url: 'https://artifacthub.io/packages/helm/grafana/grafana/?token=abc'
    }),
    /Public extraction URL is not safe/
  );
});
