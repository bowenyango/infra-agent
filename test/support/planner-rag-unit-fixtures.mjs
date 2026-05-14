import {
  mkdir,
  writeFile
} from 'node:fs/promises';
import { join } from 'node:path';
import { buildKnowledgeCacheId } from '../../src/knowledge/cache.ts';

function unitSourceRef(source, sourceContentHash) {
  const sourceId = buildKnowledgeCacheId(source);

  return {
    sourceId,
    sourceContentHash,
    sourceRef: {
      id: sourceId,
      source,
      contentHash: sourceContentHash,
      locator: source.name
    }
  };
}

function unitArtifactPayload({ source, sourceContentHash, units }) {
  const { sourceId, sourceRef } = unitSourceRef(source, sourceContentHash);

  return {
    kind: 'infra-agent.knowledge-units',
    schemaVersion: 1,
    mutationAllowed: false,
    sourceId,
    source,
    sourceContentHash,
    extractedAt: '2026-05-14T00:00:00.000Z',
    unitCount: units.length,
    units: units.map(unit => ({
      ...unit,
      source: {
        ...sourceRef,
        locator: unit.locator ?? source.name
      }
    }))
  };
}

function terraformRegistrySource(name, module) {
  return {
    kind: 'terraform-registry',
    name,
    provider: 'hashicorp/aws',
    version: '5.37.0',
    module,
    url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket'
  };
}

function pulumiDocsSource(name, module) {
  return {
    kind: 'pulumi-docs',
    name,
    packageName: '@pulumi/aws',
    version: '6.0.0',
    module,
    url: 'https://www.pulumi.com/registry/packages/aws/api-docs/'
  };
}

function helmChartDocsSource(name, chart) {
  return {
    kind: 'chart-docs',
    name,
    chart,
    version: '58.0.0',
    url: 'https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack/'
  };
}

function terraformRenameUnits(label, sentinel = '') {
  return [
    {
      unitType: 'fact',
      factKind: 'identity-field',
      path: `terraform.${label}.aws_s3_bucket.bucket`,
      summary: `Terraform ${label} bucket name is a provider identity field.`,
      confidence: 'high',
      extractionMethod: 'terraform-registry-markdown',
      privacyScope: 'public-reference',
      values: ['bucket'],
      type: 'string'
    },
    {
      unitType: 'guidance',
      path: `guidance.terraform.${label}.logical-rename`,
      summary: `Use Terraform moved blocks when the ${label} resource address changes but the remote object is retained. ${sentinel}`.trim(),
      confidence: 'high',
      extractionMethod: 'official-guidance',
      privacyScope: 'public-reference',
      topic: 'terraform-logical-rename',
      appliesWhen: ['Terraform resource address rename'],
      risk: `Without a moved block, ${label} can plan replacement instead of state movement. ${sentinel}`.trim()
    },
    {
      unitType: 'example',
      path: `example.terraform.${label}.moved-block`,
      summary: `Minimal moved block for the ${label} Terraform resource rename. ${sentinel}`.trim(),
      confidence: 'medium',
      extractionMethod: 'official-example',
      privacyScope: 'public-reference',
      exampleType: 'terraform-moved-block',
      language: 'hcl',
      snippet: `moved { from = aws_s3_bucket.old to = aws_s3_bucket.${label.replaceAll('-', '_')} } ${sentinel}`.trim()
    },
    {
      unitType: 'diagnostic',
      path: `diagnostic.terraform.${label}.already-exists`,
      summary: `Terraform ${label} plan can report an existing provider object when a logical rename lacks a moved block. ${sentinel}`.trim(),
      confidence: 'high',
      extractionMethod: 'terraform-plan-diagnostic',
      privacyScope: 'public-reference',
      engine: 'terraform',
      signature: 'BucketAlreadyOwnedByYou',
      likelyCause: `The ${label} resource address was renamed without an address move. ${sentinel}`.trim(),
      recommendedReview: [
        'Confirm old and new Terraform resource addresses.',
        'Review moved blocks or import/state repair before replacement.'
      ]
    },
    {
      unitType: 'recipe',
      path: `recipe.terraform.${label}.safe-rename`,
      summary: `Review the ${label} Terraform logical rename before editing resources. ${sentinel}`.trim(),
      confidence: 'high',
      extractionMethod: 'workflow-recipe',
      privacyScope: 'public-reference',
      name: `Terraform ${label} safe logical rename`,
      steps: ['Collect old and new resource addresses.', 'Add or review a moved block.', 'Run terraform plan before apply.'],
      requiresApproval: true,
      mutationAllowed: false
    }
  ];
}

function pulumiAliasUnits(label, sentinel = '') {
  return [
    {
      unitType: 'fact',
      factKind: 'pulumi-component-child-resource',
      path: `pulumi.${label}.aws.s3.Bucket`,
      summary: `Pulumi ${label} bucket resources retain physical identity through reviewed aliases.`,
      confidence: 'high',
      extractionMethod: 'pulumi-docs-markdown',
      privacyScope: 'public-reference',
      values: ['aws:s3/bucket:Bucket']
    },
    {
      unitType: 'guidance',
      path: `guidance.pulumi.${label}.logical-rename`,
      summary: `Use Pulumi aliases when a ${label} logical resource name changes but the physical resource is retained. ${sentinel}`.trim(),
      confidence: 'high',
      extractionMethod: 'official-guidance',
      privacyScope: 'public-reference',
      topic: 'pulumi-logical-rename',
      appliesWhen: ['Pulumi resource logical name rename'],
      risk: `Without aliases, ${label} can preview a replacement. ${sentinel}`.trim()
    },
    {
      unitType: 'example',
      path: `example.pulumi.${label}.alias`,
      summary: `Bounded Pulumi alias shape for ${label}. ${sentinel}`.trim(),
      confidence: 'medium',
      extractionMethod: 'official-example',
      privacyScope: 'public-reference',
      exampleType: 'pulumi-alias',
      language: 'typescript',
      snippet: `aliases: [{ name: "old-${label}" }] ${sentinel}`.trim()
    },
    {
      unitType: 'diagnostic',
      path: `diagnostic.pulumi.${label}.replacement-preview`,
      summary: `Pulumi ${label} preview can show replacement when alias review is missing. ${sentinel}`.trim(),
      confidence: 'high',
      extractionMethod: 'pulumi-preview-diagnostic',
      privacyScope: 'public-reference',
      engine: 'pulumi',
      signature: 'replace [diff: name]',
      likelyCause: `Pulumi ${label} logical rename lacked reviewed alias metadata. ${sentinel}`.trim(),
      recommendedReview: ['Collect old and new Pulumi URNs.', 'Review aliases before retaining the existing physical resource.']
    },
    {
      unitType: 'recipe',
      path: `recipe.pulumi.${label}.alias-stack-config`,
      summary: `Review Pulumi aliases and stack config before editing ${label} resources. ${sentinel}`.trim(),
      confidence: 'high',
      extractionMethod: 'workflow-recipe',
      privacyScope: 'public-reference',
      name: `Pulumi ${label} alias and stack config review`,
      steps: [
        'Collect old and new Pulumi resource type, logical name, stack, and URN details.',
        'Review aliases for logical renames that retain the physical resource.',
        'Use native stack config writes only after approval.'
      ],
      requiresApproval: true,
      mutationAllowed: false
    }
  ];
}

function helmKubePrometheusUnits(label, sentinel = '') {
  return [
    {
      unitType: 'fact',
      factKind: 'chart-value',
      path: `helm.${label}.prometheus.prometheusSpec.retention`,
      summary: `kube-prometheus-stack ${label} retention values should be validated against chart defaults.`,
      confidence: 'high',
      extractionMethod: 'helm-chart-docs-markdown',
      privacyScope: 'public-reference',
      values: ['prometheus.prometheusSpec.retention'],
      type: 'string'
    },
    {
      unitType: 'guidance',
      path: `guidance.helm.${label}.values-migration`,
      summary: `Review kube-prometheus-stack chart defaults and breaking values before ${label} upgrades. ${sentinel}`.trim(),
      confidence: 'high',
      extractionMethod: 'official-guidance',
      privacyScope: 'public-reference',
      topic: 'helm-values-migration',
      appliesWhen: ['Helm chart upgrade', 'values migration'],
      risk: `Skipping values migration review can break rendered monitoring resources. ${sentinel}`.trim()
    },
    {
      unitType: 'example',
      path: `example.helm.${label}.values`,
      summary: `Compact kube-prometheus-stack values example for ${label}. ${sentinel}`.trim(),
      confidence: 'medium',
      extractionMethod: 'official-example',
      privacyScope: 'public-reference',
      exampleType: 'helm-values',
      language: 'yaml',
      snippet: `prometheus:\n  prometheusSpec:\n    retention: 15d\n${sentinel}`.trim()
    },
    {
      unitType: 'diagnostic',
      path: `diagnostic.helm.${label}.retention`,
      summary: `kube-prometheus-stack ${label} validation should check migrated retention values. ${sentinel}`.trim(),
      confidence: 'high',
      extractionMethod: 'provider-diagnostic',
      privacyScope: 'public-reference',
      engine: 'helm',
      signature: 'helm template kube-prometheus-stack retention validation',
      likelyCause: `The ${label} values file drifted from chart defaults during upgrade. ${sentinel}`.trim(),
      recommendedReview: ['Compare old and new chart defaults.', 'Run helm template before applying values edits.']
    },
    {
      unitType: 'recipe',
      path: `recipe.helm.${label}.safe-upgrade`,
      summary: `Review kube-prometheus-stack chart defaults and values migration before ${label} upgrades. ${sentinel}`.trim(),
      confidence: 'high',
      extractionMethod: 'workflow-recipe',
      privacyScope: 'public-reference',
      name: `kube-prometheus-stack ${label} values migration review`,
      steps: ['Confirm the target chart version.', 'Compare old and new chart defaults for breaking values.', 'Run helm template or helm lint before applying values edits.'],
      requiresApproval: true,
      mutationAllowed: false
    }
  ];
}

async function writeTerraformTarget(root, targetPath, resourceName, environment = 'dev') {
  await mkdir(join(root, targetPath), { recursive: true });
  await writeFile(
    join(root, targetPath, 'main.tf'),
    [
      `resource "aws_s3_bucket" "${resourceName}" {`,
      `  bucket = "example-${resourceName}"`,
      '}',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(join(root, targetPath, `${environment}.auto.tfvars`), `environment = "${environment}"\n`, 'utf8');
}

async function writePulumiTarget(root, targetPath, projectName, stackName = 'dev') {
  await mkdir(join(root, targetPath), { recursive: true });
  await writeFile(join(root, targetPath, 'Pulumi.yaml'), `name: ${projectName}\nruntime: yaml\n`, 'utf8');
  await writeFile(join(root, targetPath, `Pulumi.${stackName}.yaml`), `config:\n  ${projectName}:environment: ${stackName}\n`, 'utf8');
}

async function writeHelmTarget(root, targetPath, chartName) {
  await mkdir(join(root, targetPath, 'templates'), { recursive: true });
  await writeFile(
    join(root, targetPath, 'Chart.yaml'),
    [
      'apiVersion: v2',
      `name: ${chartName}`,
      'version: 0.1.0',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(join(root, targetPath, 'values.yaml'), 'prometheus:\n  prometheusSpec:\n    retention: 7d\n', 'utf8');
  await writeFile(join(root, targetPath, 'templates/NOTES.txt'), 'render {{ .Chart.Name }}\n', 'utf8');
}

export async function writeMultiTargetUnitArtifactRegistryWorkspace(root) {
  await mkdir(join(root, 'knowledge'), { recursive: true });
  await writeTerraformTarget(root, 'terraform/app', 'api');
  await writeTerraformTarget(root, 'terraform/ops', 'ops', 'prod');
  await writePulumiTarget(root, 'infra/api', 'api');
  await writePulumiTarget(root, 'infra/worker', 'worker', 'prod');
  await writeHelmTarget(root, 'charts/monitoring', 'kube-prometheus-stack');
  await writeHelmTarget(root, 'charts/edge', 'edge-observability');

  const artifacts = [
    {
      domain: 'terraform',
      targetPath: 'terraform/app',
      path: 'knowledge/terraform-app.units.json',
      name: 'terraform-app-registry-units',
      payload: unitArtifactPayload({
        source: terraformRegistrySource('resource:aws_s3_bucket:app', 'terraform/app'),
        sourceContentHash: 'a'.repeat(64),
        units: terraformRenameUnits('app')
      })
    },
    {
      domain: 'terraform',
      targetPath: 'terraform/ops',
      path: 'knowledge/terraform-ops.units.json',
      name: 'terraform-ops-registry-units',
      payload: unitArtifactPayload({
        source: terraformRegistrySource('resource:aws_s3_bucket:ops', 'terraform/ops'),
        sourceContentHash: 'b'.repeat(64),
        units: terraformRenameUnits('ops', 'OPS_TERRAFORM_UNIT_SENTINEL')
      })
    },
    {
      domain: 'pulumi',
      targetPath: 'infra/api',
      path: 'knowledge/pulumi-api.units.json',
      name: 'pulumi-api-registry-units',
      payload: unitArtifactPayload({
        source: pulumiDocsSource('pulumi-docs:aws:api', 'infra/api'),
        sourceContentHash: 'c'.repeat(64),
        units: pulumiAliasUnits('api')
      })
    },
    {
      domain: 'pulumi',
      targetPath: 'infra/worker',
      path: 'knowledge/pulumi-worker.units.json',
      name: 'pulumi-worker-registry-units',
      payload: unitArtifactPayload({
        source: pulumiDocsSource('pulumi-docs:aws:worker', 'infra/worker'),
        sourceContentHash: 'd'.repeat(64),
        units: pulumiAliasUnits('worker', 'WORKER_PULUMI_UNIT_SENTINEL')
      })
    },
    {
      domain: 'helm',
      targetPath: 'charts/monitoring',
      path: 'knowledge/helm-monitoring.units.json',
      name: 'helm-monitoring-registry-units',
      payload: unitArtifactPayload({
        source: helmChartDocsSource('chart-docs:kube-prometheus-stack:monitoring', 'kube-prometheus-stack'),
        sourceContentHash: 'e'.repeat(64),
        units: helmKubePrometheusUnits('monitoring')
      })
    },
    {
      domain: 'helm',
      targetPath: 'charts/edge',
      path: 'knowledge/helm-edge.units.json',
      name: 'helm-edge-registry-units',
      payload: unitArtifactPayload({
        source: helmChartDocsSource('chart-docs:kube-prometheus-stack:edge', 'kube-prometheus-stack'),
        sourceContentHash: 'f'.repeat(64),
        units: helmKubePrometheusUnits('edge', 'EDGE_HELM_UNIT_SENTINEL')
      })
    }
  ];

  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        unitArtifactRegistries: [
          {
            path: 'knowledge/unit-registry.json',
            name: 'multi-target-unit-registry'
          }
        ]
      }
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'knowledge/unit-registry.json'),
    `${JSON.stringify({
      kind: 'infra-agent.knowledge-unit-registry',
      schemaVersion: 1,
      mutationAllowed: false,
      entries: artifacts.map(artifact => ({
        domain: artifact.domain,
        targetPath: artifact.targetPath,
        artifact: {
          path: artifact.path,
          name: artifact.name,
          version: '2026-05-14'
        }
      }))
    }, null, 2)}\n`,
    'utf8'
  );

  for (const artifact of artifacts) {
    await writeFile(join(root, artifact.path), `${JSON.stringify(artifact.payload, null, 2)}\n`, 'utf8');
  }
}

export async function writeTerraformRenameKnowledgeWorkspace(root) {
  await mkdir(join(root, 'terraform/app'), { recursive: true });
  await mkdir(join(root, 'knowledge'), { recursive: true });
  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        curatedUnits: [
          {
            domain: 'terraform',
            targetPath: 'terraform/app',
            path: 'knowledge/terraform-rename-units.json',
            name: 'terraform-rename-internal'
          }
        ]
      }
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'terraform/app/main.tf'),
    [
      'resource "aws_s3_bucket" "api" {',
      '  bucket = "example-api"',
      '}',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(
    join(root, 'terraform/app/dev.auto.tfvars'),
    'image_tag = "1.0.0"\n',
    'utf8'
  );
  await writeFile(
    join(root, 'knowledge/terraform-rename-units.json'),
    `${JSON.stringify({
      kind: 'infra-agent.curated-knowledge-units',
      schemaVersion: 1,
      mutationAllowed: false,
      units: [
        {
          unitType: 'guidance',
          path: 'guidance.terraform.logical-rename',
          summary: 'Use Terraform moved blocks when a resource logical name changes but the remote object should be retained.',
          confidence: 'high',
          topic: 'terraform-logical-rename',
          appliesWhen: ['Terraform resource address rename'],
          risk: 'Without a moved block, a rename can look like destroy and create.'
        },
        {
          unitType: 'example',
          path: 'example.terraform.moved-block',
          summary: 'Minimal moved block for a Terraform resource rename.',
          exampleType: 'terraform-moved-block',
          language: 'hcl',
          snippet: 'moved { from = aws_s3_bucket.old to = aws_s3_bucket.api }'
        },
        {
          unitType: 'recipe',
          path: 'recipe.terraform.safe-rename',
          summary: 'Review a Terraform logical rename before editing infrastructure.',
          name: 'Terraform safe logical rename',
          steps: ['Add or verify a moved block.', 'Run a plan before apply.'],
          requiresApproval: true
        }
      ]
    }, null, 2)}\n`,
    'utf8'
  );
}

export async function writePulumiAliasKnowledgeWorkspace(root, units = null) {
  await mkdir(join(root, 'infra/api'), { recursive: true });
  await mkdir(join(root, 'knowledge'), { recursive: true });
  const defaultUnits = [
    {
      unitType: 'guidance',
      path: 'guidance.pulumi.logical-rename',
      summary: 'Use Pulumi aliases when a resource logical name changes but the physical resource should be retained.',
      confidence: 'high',
      topic: 'pulumi-logical-rename',
      appliesWhen: ['Pulumi resource logical name rename'],
      risk: 'Without an alias, a rename can be planned as a replacement.'
    },
    {
      unitType: 'recipe',
      path: 'recipe.pulumi.alias-stack-config',
      summary: 'Review Pulumi aliases and stack config before editing resources.',
      name: 'Pulumi alias and stack config review',
      steps: [
        'Collect old and new Pulumi resource type and logical name.',
        'Review aliases for logical renames that retain the physical resource.',
        'Use native stack config writes only after approval.'
      ],
      requiresApproval: true
    }
  ];

  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        curatedUnits: [
          {
            domain: 'pulumi',
            targetPath: 'infra/api',
            path: 'knowledge/pulumi-alias-units.json',
            name: 'pulumi-alias-internal'
          }
        ]
      }
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'infra/api/Pulumi.yaml'),
    'name: api\nruntime: yaml\n',
    'utf8'
  );
  await writeFile(
    join(root, 'infra/api/Pulumi.dev.yaml'),
    'config:\n  api:environment: dev\n',
    'utf8'
  );
  await writeFile(
    join(root, 'knowledge/pulumi-alias-units.json'),
    `${JSON.stringify({
      kind: 'infra-agent.curated-knowledge-units',
      schemaVersion: 1,
      mutationAllowed: false,
      units: units ?? defaultUnits
    }, null, 2)}\n`,
    'utf8'
  );
}

export function buildIrrelevantKnowledgePack(domain, targetPath) {
  const sourceId = `${domain}-irrelevant-guidance`;
  return {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: `${domain}-irrelevant-pack`,
    workspaceRoot: '/workspace',
    cacheRoot: '/workspace/.infra-agent/knowledge-cache',
    requestedDomains: [domain],
    targetPaths: [targetPath],
    sourceIds: [sourceId],
    sourceCount: 1,
    factSetCount: 1,
    factCount: 0,
    includedFactCount: 0,
    omittedFactCount: 0,
    unitCount: 1,
    includedUnitCount: 1,
    omittedUnitCount: 0,
    maxFacts: 4,
    maxUnits: 4,
    staleSourceCount: 0,
    storagePolicy: {
      publicReference: 0,
      workspacePrivate: 1,
      shareableByDefault: 0,
      explicitOptInRequired: 1
    },
    sources: [
      {
        id: sourceId,
        domain,
        targetPath,
        kind: 'internal-knowledge',
        name: sourceId,
        factCount: 0,
        contentHash: 'c'.repeat(64),
        fetchedAt: '2026-05-05T00:00:00.000Z',
        stale: false,
        freshness: 'fresh',
        storagePolicy: {
          scope: 'workspace-private',
          defaultStore: 'local-only',
          shareableByDefault: false,
          requiresExplicitOptIn: true,
          reason: 'Local internal guidance.'
        }
      }
    ],
    facts: [],
    units: [
      {
        unitType: 'guidance',
        path: 'guidance.general.change-review',
        summary: 'Review requested infrastructure changes against existing files before editing.',
        confidence: 'medium',
        extractionMethod: 'repo-local-guidance',
        sourceId,
        sourceLocator: 'irrelevant-guidance',
        privacyScope: 'workspace-private',
        topic: 'general-change-review',
        appliesWhen: ['Bounded infrastructure updates'],
        risk: 'Speculative edits can affect unintended resources.'
      }
    ]
  };
}
