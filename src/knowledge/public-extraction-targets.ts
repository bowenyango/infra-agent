import type { InfraDomainId } from '../types/repository.ts';
import type { KnowledgeSource, KnowledgeSourceKind } from '../types/knowledge.ts';
import {
  isSafeWorkspaceRelativePath,
  isSecretSafeKnowledgeUrl
} from './source-config.ts';

export type PublicExtractionTargetKind =
  | 'terraform-provider-docs'
  | 'pulumi-package-docs'
  | 'helm-chart-docs';

export interface PublicExtractionSourceIdentity {
  kind: KnowledgeSourceKind;
  name: string;
  provider?: string;
  packageName?: string;
  chart?: string;
  version?: string;
  url: string;
}

export interface PublicExtractionTarget {
  id: string;
  domain: InfraDomainId;
  targetKind: PublicExtractionTargetKind;
  targetName: string;
  targetPath: string;
  source: KnowledgeSource;
  expectedSourceIdentity: PublicExtractionSourceIdentity;
}

export interface TerraformProviderDocsSourceInput {
  providerAddress: string;
  version?: string;
}

export interface PulumiPackageDocsSourceInput {
  packageName: string;
  slug?: string;
  version?: string;
}

export interface HelmChartDocsSourceInput {
  chart: string;
  url: string;
  version?: string;
}

const TERRAFORM_PROVIDER_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const PULUMI_PACKAGE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const HELM_CHART_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
const SAFE_VERSION_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const MAX_TARGET_NAME_LENGTH = 160;
const PULUMI_PACKAGE_PREFIX = '@pulumi/';
const PULUMI_PACKAGE_DOCS_URL_PREFIX = 'https://www.pulumi.com/registry/packages/';

function fail(message: string): never {
  throw new TypeError(message);
}

function trimmed(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    fail(`${fieldName} must be a non-empty string.`);
  }

  return normalized;
}

function validateTargetPath(value: string): string {
  if (!isSafeWorkspaceRelativePath(value)) {
    fail(`Public extraction target path is not safe: ${value}`);
  }

  return value;
}

function validatePublicUrl(value: string): string {
  const url = trimmed(value, 'url');
  if (!isSecretSafeKnowledgeUrl(url)) {
    fail(`Public extraction URL is not safe: ${url}`);
  }

  return url;
}

function normalizeVersion(value: string | undefined, defaultValue?: string): string | undefined {
  if (value === undefined) {
    return defaultValue;
  }

  const version = trimmed(value, 'version');
  if (!SAFE_VERSION_SEGMENT_PATTERN.test(version) || !isSafeWorkspaceRelativePath(version)) {
    fail(`Public extraction version is not safe: ${version}`);
  }

  return version;
}

function normalizeTerraformProviderAddress(providerAddress: string): string {
  const normalized = trimmed(providerAddress, 'providerAddress').toLowerCase();
  const segments = normalized.split('/');
  if (
    segments.length !== 2
    || !segments.every(segment => TERRAFORM_PROVIDER_SEGMENT_PATTERN.test(segment))
    || !isSafeWorkspaceRelativePath(normalized)
  ) {
    fail(`Terraform provider address is not safe: ${providerAddress}`);
  }

  return normalized;
}

function normalizePulumiPackage(input: PulumiPackageDocsSourceInput): {
  packageName: string;
  slug: string;
} {
  const packageName = trimmed(input.packageName, 'packageName').toLowerCase();
  if (!packageName.startsWith(PULUMI_PACKAGE_PREFIX)) {
    fail(`Pulumi package must use the ${PULUMI_PACKAGE_PREFIX}<name> form.`);
  }

  const derivedSlug = packageName.slice(PULUMI_PACKAGE_PREFIX.length);
  const slug = trimmed(input.slug ?? derivedSlug, 'slug').toLowerCase();
  if (
    slug !== derivedSlug
    || !PULUMI_PACKAGE_SLUG_PATTERN.test(slug)
    || !isSafeWorkspaceRelativePath(slug)
  ) {
    fail(`Pulumi package slug is not safe: ${input.slug ?? derivedSlug}`);
  }

  return {
    packageName,
    slug
  };
}

function normalizeHelmChart(value: string): string {
  const chart = trimmed(value, 'chart');
  if (
    chart.length > MAX_TARGET_NAME_LENGTH
    || !HELM_CHART_LABEL_PATTERN.test(chart)
    || !isSafeWorkspaceRelativePath(chart)
  ) {
    fail(`Helm chart label is not safe: ${value}`);
  }

  return chart;
}

function sourceIdentity(source: KnowledgeSource): PublicExtractionSourceIdentity {
  if (!source.url) {
    fail(`Public extraction source requires a URL: ${source.name}`);
  }

  return {
    kind: source.kind,
    name: source.name,
    ...(source.provider !== undefined ? { provider: source.provider } : {}),
    ...(source.packageName !== undefined ? { packageName: source.packageName } : {}),
    ...(source.chart !== undefined ? { chart: source.chart } : {}),
    ...(source.version !== undefined ? { version: source.version } : {}),
    url: source.url
  };
}

function buildTarget(input: {
  id: string;
  domain: InfraDomainId;
  targetKind: PublicExtractionTargetKind;
  targetName: string;
  targetPath: string;
  source: KnowledgeSource;
}): PublicExtractionTarget {
  return {
    ...input,
    targetPath: validateTargetPath(input.targetPath),
    expectedSourceIdentity: sourceIdentity(input.source)
  };
}

export function buildTerraformProviderDocsSource(input: TerraformProviderDocsSourceInput): KnowledgeSource {
  const providerAddress = normalizeTerraformProviderAddress(input.providerAddress);
  const version = normalizeVersion(input.version, 'latest') ?? 'latest';
  const url = validatePublicUrl(`https://registry.terraform.io/providers/${providerAddress}/${version}/docs`);

  return {
    kind: 'terraform-registry',
    name: `terraform-registry:provider:${providerAddress}`,
    provider: providerAddress,
    version,
    url
  };
}

export function buildTerraformProviderDocsTarget(input: TerraformProviderDocsSourceInput): PublicExtractionTarget {
  const source = buildTerraformProviderDocsSource(input);
  const providerAddress = source.provider ?? normalizeTerraformProviderAddress(input.providerAddress);
  const version = source.version ?? 'latest';

  return buildTarget({
    id: `public:terraform-provider-docs:${providerAddress}:${version}`,
    domain: 'terraform',
    targetKind: 'terraform-provider-docs',
    targetName: providerAddress,
    targetPath: `public/terraform/providers/${providerAddress}/${version}`,
    source
  });
}

export function buildPulumiPackageDocsSource(input: PulumiPackageDocsSourceInput): KnowledgeSource {
  const packageInfo = normalizePulumiPackage(input);
  const version = normalizeVersion(input.version);
  const url = validatePublicUrl(`${PULUMI_PACKAGE_DOCS_URL_PREFIX}${packageInfo.slug}/api-docs/`);

  return {
    kind: 'pulumi-docs',
    name: `pulumi-docs:package:${packageInfo.slug}`,
    packageName: packageInfo.packageName,
    ...(version !== undefined ? { version } : {}),
    url
  };
}

export function buildPulumiPackageDocsTarget(input: PulumiPackageDocsSourceInput): PublicExtractionTarget {
  const source = buildPulumiPackageDocsSource(input);
  const packageInfo = normalizePulumiPackage(input);

  return buildTarget({
    id: `public:pulumi-package-docs:${packageInfo.slug}${source.version ? `:${source.version}` : ''}`,
    domain: 'pulumi',
    targetKind: 'pulumi-package-docs',
    targetName: source.packageName ?? packageInfo.packageName,
    targetPath: `public/pulumi/packages/${packageInfo.slug}${source.version ? `/${source.version}` : ''}`,
    source
  });
}

export function buildHelmChartDocsSource(input: HelmChartDocsSourceInput): KnowledgeSource {
  const chart = normalizeHelmChart(input.chart);
  const version = normalizeVersion(input.version);
  const url = validatePublicUrl(input.url);

  return {
    kind: 'chart-docs',
    name: `chart-docs:${chart}`,
    chart,
    ...(version !== undefined ? { version } : {}),
    url
  };
}

export function buildHelmChartDocsTarget(input: HelmChartDocsSourceInput): PublicExtractionTarget {
  const source = buildHelmChartDocsSource(input);
  const chart = source.chart ?? normalizeHelmChart(input.chart);

  return buildTarget({
    id: `public:helm-chart-docs:${chart}${source.version ? `:${source.version}` : ''}`,
    domain: 'helm',
    targetKind: 'helm-chart-docs',
    targetName: chart,
    targetPath: `public/helm/charts/${chart}${source.version ? `/${source.version}` : ''}`,
    source
  });
}

export const TERRAFORM_HASHICORP_AWS_PROVIDER_DOCS_TARGET = buildTerraformProviderDocsTarget({
  providerAddress: 'hashicorp/aws'
});

export const PULUMI_AWS_PACKAGE_DOCS_TARGET = buildPulumiPackageDocsTarget({
  packageName: '@pulumi/aws'
});

export const HELM_KUBE_PROMETHEUS_STACK_DOCS_TARGET = buildHelmChartDocsTarget({
  chart: 'kube-prometheus-stack',
  url: 'https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack/'
});

export const CANONICAL_PUBLIC_EXTRACTION_TARGETS = [
  TERRAFORM_HASHICORP_AWS_PROVIDER_DOCS_TARGET,
  PULUMI_AWS_PACKAGE_DOCS_TARGET,
  HELM_KUBE_PROMETHEUS_STACK_DOCS_TARGET
] as const;
