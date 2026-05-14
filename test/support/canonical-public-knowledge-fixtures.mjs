import { writeKnowledgeCacheEntry } from '../../src/knowledge/cache.ts';

export const CANONICAL_PUBLIC_KNOWLEDGE_TARGET_KEYS = [
  'terraformAwsProviderDocs',
  'pulumiAwsPackageDocs',
  'helmKubePrometheusStackChartDocs'
];

const FALLBACK_CANONICAL_PUBLIC_KNOWLEDGE_TARGETS = {
  terraformAwsProviderDocs: {
    kind: 'terraform-registry',
    name: 'terraform-registry:provider:hashicorp/aws',
    provider: 'hashicorp/aws',
    version: 'latest',
    url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs'
  },
  pulumiAwsPackageDocs: {
    kind: 'pulumi-docs',
    name: 'pulumi-docs:package:aws',
    packageName: '@pulumi/aws',
    version: 'latest',
    url: 'https://www.pulumi.com/registry/packages/aws/api-docs/'
  },
  helmKubePrometheusStackChartDocs: {
    kind: 'chart-docs',
    name: 'chart-docs:kube-prometheus-stack',
    chart: 'kube-prometheus-stack',
    version: 'latest',
    url: 'https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack/'
  }
};

const CANONICAL_PUBLIC_KNOWLEDGE_MARKDOWN = {
  terraformAwsProviderDocs: [
    '# AWS Provider',
    '',
    'The AWS provider docs root describes provider setup and common usage patterns.',
    '',
    '## Basic Usage',
    '',
    '```hcl',
    'terraform {',
    '  required_providers {',
    '    aws = {',
    '      source  = "hashicorp/aws"',
    '      version = "~> 5.0"',
    '    }',
    '  }',
    '}',
    '',
    'provider "aws" {',
    '  region = "us-west-2"',
    '}',
    '```',
    '',
    '### Provider Configuration',
    '',
    '#### Arguments',
    '',
    '- `region` - (Required) Region used for provider operations.',
    '- `profile` - (Optional) Shared credentials profile used by the provider.',
    '- `name` - (Optional) Example identity name; changing it can force replacement in dependent resources.',
    '- `assume_role` - (Optional) Nested provider configuration used when operations require a delegated role.',
    '',
    '## Attribute Reference',
    '',
    '- `account_id` - Account identifier returned by provider metadata.',
    '',
    '## Compatibility and Requirements',
    '',
    'Terraform CLI 1.5 or later is required for the documented workflow; pin provider versions and review identity-like names before changing infrastructure.',
    '',
    '## Import and State Workflow',
    '',
    '1. Review the provider changelog for breaking behavior.',
    '2. Run terraform init with the selected provider version.',
    '3. Run terraform validate for the selected root module.',
    '4. Run terraform plan and inspect replacements before applying edits.',
    '',
    '## Validation Failures',
    '',
    '`Error: invalid provider configuration` usually means the selected region or provider settings are missing.',
    '',
    '- Confirm required provider arguments are present.',
    '- Run terraform validate for the selected root module.',
    ''
  ].join('\n'),
  pulumiAwsPackageDocs: [
    '# AWS',
    '',
    'The Pulumi AWS package exposes provider resources and package-level modules.',
    '',
    '## Modules',
    '',
    '| Module | Description |',
    '| --- | --- |',
    '| [ec2](./ec2/) | Compute resources for instances, launch templates, and networking attachments. |',
    '| [s3](./s3/) | Storage resources for buckets and objects. |',
    '| [iam](./iam/) | Identity resources for roles and policies. |',
    '',
    '## TypeScript Usage',
    '',
    '```typescript',
    'import * as aws from "@pulumi/aws";',
    '',
    'const topic = new aws.sns.Topic("events", {',
    '  displayName: "events",',
    '});',
    '```',
    '',
    '## Compatibility and Preview Notes',
    '',
    'Pulumi CLI 3.x is required for current provider previews; review preview output before changing resource identity fields or provider configuration.',
    '',
    '## Deployment Workflow',
    '',
    '1. Review the selected package version and provider changelog.',
    '2. Update the package dependency for the Pulumi project.',
    '3. Run pulumi preview and inspect replacements before applying edits.',
    '',
    '## Troubleshooting Preview Failures',
    '',
    '`error: preview failed because required provider region is missing` usually means provider configuration is incomplete.',
    '',
    '- Confirm stack configuration for the selected environment.',
    '- Rerun pulumi preview after the bounded edit.',
    ''
  ].join('\n'),
  helmKubePrometheusStackChartDocs: [
    '# kube-prometheus-stack',
    '',
    'The kube-prometheus-stack chart installs Prometheus, Alertmanager, Grafana, and related monitoring resources.',
    '',
    '## Values',
    '',
    '| Parameter | Type | Default | Description | Required |',
    '| --- | --- | --- | --- | --- |',
    '| `grafana.enabled` | bool | `true` | Enables Grafana dashboards for the chart. | no |',
    '| `prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues` | bool | `true` | Selects ServiceMonitor labels for the rendered Prometheus instance. | yes |',
    '| `alertmanager.enabled` | bool | `true` | Enables Alertmanager resources for the release. | no |',
    '',
    '## Example Values',
    '',
    '```yaml',
    'grafana:',
    '  enabled: true',
    'prometheus:',
    '  prometheusSpec:',
    '    serviceMonitorSelectorNilUsesHelmValues: true',
    '```',
    '',
    '## Prerequisites and Selector Notes',
    '',
    'Install the required monitoring CRDs before rendering; keep selector values explicit when chart upgrades affect rendered monitoring resources.',
    '',
    '## Template Workflow',
    '',
    '1. Review chart release notes and changed default values.',
    '2. Update values.yaml for the target environment.',
    '3. Run helm template and inspect changed monitoring manifests.',
    '',
    '## Validation Errors',
    '',
    '`Error: rendered manifests failed validation` usually means required selectors or CRDs are missing.',
    '',
    '- Check installed CRDs before rendering the chart.',
    '- Run helm template for the selected release values.',
    ''
  ].join('\n')
};

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKnowledgeSource(value) {
  return isRecord(value)
    && typeof value.kind === 'string'
    && typeof value.name === 'string';
}

function sourceFromTarget(value) {
  if (isKnowledgeSource(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const field of ['source', 'knowledgeSource', 'cacheSource']) {
    if (isKnowledgeSource(value[field])) {
      return value[field];
    }
  }

  return null;
}

function sourceValuesFromCollection(collection) {
  if (!collection) {
    return [];
  }

  if (Array.isArray(collection)) {
    return collection.map(sourceFromTarget).filter(Boolean);
  }

  if (isRecord(collection)) {
    const direct = sourceFromTarget(collection);
    if (direct) {
      return [direct];
    }

    return Object.values(collection).map(sourceFromTarget).filter(Boolean);
  }

  return [];
}

function findSource(sources, predicate) {
  return sources.find(source => predicate(source)) ?? null;
}

function targetsFromSources(sources) {
  const terraformAwsProviderDocs = findSource(sources, source =>
    source.kind === 'terraform-registry'
    && source.provider === 'hashicorp/aws'
    && source.url === 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs'
  );
  const pulumiAwsPackageDocs = findSource(sources, source =>
    source.kind === 'pulumi-docs'
    && source.packageName === '@pulumi/aws'
    && typeof source.url === 'string'
    && source.url.includes('/registry/packages/aws')
  );
  const helmKubePrometheusStackChartDocs = findSource(sources, source =>
    source.kind === 'chart-docs'
    && source.chart === 'kube-prometheus-stack'
    && typeof source.url === 'string'
    && source.url.includes('kube-prometheus-stack')
  );

  if (!terraformAwsProviderDocs || !pulumiAwsPackageDocs || !helmKubePrometheusStackChartDocs) {
    return null;
  }

  return {
    terraformAwsProviderDocs,
    pulumiAwsPackageDocs,
    helmKubePrometheusStackChartDocs
  };
}

async function importPublicExtractionTargetsModule() {
  try {
    return await import('../../src/knowledge/public-extraction-targets.ts');
  } catch (error) {
    if (
      error
      && error.code === 'ERR_MODULE_NOT_FOUND'
      && String(error.message).includes('public-extraction-targets')
    ) {
      return null;
    }

    throw error;
  }
}

async function targetsFromModule(publicTargetsModule) {
  if (!publicTargetsModule) {
    return null;
  }

  const builder = publicTargetsModule.buildCanonicalPublicExtractionTargets
    ?? publicTargetsModule.buildCanonicalPublicKnowledgeTargets;
  if (typeof builder === 'function') {
    const builtTargets = await builder();
    const targets = targetsFromSources(sourceValuesFromCollection(builtTargets));
    if (targets) {
      return targets;
    }
  }

  const aggregate = publicTargetsModule.canonicalPublicExtractionTargets
    ?? publicTargetsModule.CANONICAL_PUBLIC_EXTRACTION_TARGETS
    ?? publicTargetsModule.canonicalPublicKnowledgeTargets
    ?? publicTargetsModule.CANONICAL_PUBLIC_KNOWLEDGE_TARGETS;
  const aggregateSources = sourceValuesFromCollection(aggregate);
  if (aggregateSources.length > 0) {
    const targets = targetsFromSources(aggregateSources);
    if (targets) {
      return targets;
    }
  }

  const targets = targetsFromSources(sourceValuesFromCollection(publicTargetsModule));
  if (!targets) {
    throw new Error('public-extraction-targets.ts did not expose the three canonical public KnowledgeSource targets.');
  }

  return targets;
}

export async function loadCanonicalPublicKnowledgeTargets() {
  const publicTargetsModule = await importPublicExtractionTargetsModule();
  return await targetsFromModule(publicTargetsModule)
    ?? FALLBACK_CANONICAL_PUBLIC_KNOWLEDGE_TARGETS;
}

export async function writeCanonicalPublicKnowledgeCacheFixtures(cacheRoot) {
  const targets = await loadCanonicalPublicKnowledgeTargets();
  const entries = [];

  for (const key of CANONICAL_PUBLIC_KNOWLEDGE_TARGET_KEYS) {
    entries.push({
      key,
      source: targets[key],
      entry: await writeKnowledgeCacheEntry(cacheRoot, {
        source: targets[key],
        contentType: 'text/markdown',
        content: CANONICAL_PUBLIC_KNOWLEDGE_MARKDOWN[key],
        fetchedAt: '2026-05-13T00:00:00.000Z',
        staleAfter: '2026-06-13T00:00:00.000Z'
      })
    });
  }

  return entries;
}
