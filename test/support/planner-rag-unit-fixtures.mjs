import {
  mkdir,
  writeFile
} from 'node:fs/promises';
import { join } from 'node:path';

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
