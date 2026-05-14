import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  resolve,
  join
} from 'node:path';
import { runSingleStep } from '../../src/agent/run-single-step.ts';
import { buildKnowledgeCacheId } from '../../src/knowledge/cache.ts';

const terraformMovedBlockUnits = [
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
  }
];

async function writeTerraformRoot(root, terraformRoot) {
  await mkdir(join(root, terraformRoot), { recursive: true });
  await writeFile(
    join(root, terraformRoot, 'main.tf'),
    [
      'resource "aws_s3_bucket" "api" {',
      '  bucket = "example-api"',
      '}',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(
    join(root, terraformRoot, 'dev.auto.tfvars'),
    'environment = "dev"\n',
    'utf8'
  );
}

async function writeTerraformMovedBlockRagWorkspace(root, options = {}) {
  const terraformRoot = options.terraformRoot ?? 'terraform/app';
  const knowledgeTargetPath = options.knowledgeTargetPath ?? terraformRoot;

  await mkdir(join(root, 'knowledge'), { recursive: true });
  await writeTerraformRoot(root, terraformRoot);
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
            targetPath: knowledgeTargetPath,
            path: 'knowledge/terraform-rename-units.json',
            name: 'terraform-rename-internal'
          }
        ]
      }
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'knowledge/terraform-rename-units.json'),
    `${JSON.stringify({
      kind: 'infra-agent.curated-knowledge-units',
      schemaVersion: 1,
      mutationAllowed: false,
      units: terraformMovedBlockUnits
    }, null, 2)}\n`,
    'utf8'
  );
}

function terraformRenameUnitArtifactPayload() {
  const source = {
    kind: 'terraform-registry',
    name: 'resource:aws_s3_bucket',
    provider: 'hashicorp/aws',
    version: '5.37.0',
    url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket'
  };
  const sourceId = buildKnowledgeCacheId(source);
  const sourceContentHash = 'd'.repeat(64);
  const sourceRef = {
    id: sourceId,
    source,
    contentHash: sourceContentHash,
    locator: 'Terraform Registry: aws_s3_bucket'
  };

  return {
    kind: 'infra-agent.knowledge-units',
    schemaVersion: 1,
    mutationAllowed: false,
    sourceId,
    source,
    sourceContentHash,
    extractedAt: '2026-05-12T00:00:00.000Z',
    unitCount: 2,
    units: terraformMovedBlockUnits.map(unit => ({
      ...unit,
      confidence: unit.unitType === 'example' ? 'medium' : unit.confidence,
      extractionMethod: unit.unitType === 'example' ? 'official-example' : 'official-guidance',
      source: sourceRef,
      privacyScope: 'public-reference'
    }))
  };
}

async function writeTerraformMovedBlockRegistryRagWorkspace(root) {
  await mkdir(join(root, 'knowledge'), { recursive: true });
  await writeTerraformRoot(root, 'terraform/app');
  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        unitArtifactRegistries: [
          {
            path: 'knowledge/terraform-unit-registry.json',
            name: 'terraform-public-unit-registry'
          }
        ]
      }
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'knowledge/terraform-unit-registry.json'),
    `${JSON.stringify({
      kind: 'infra-agent.knowledge-unit-registry',
      schemaVersion: 1,
      mutationAllowed: false,
      entries: [
        {
          domain: 'terraform',
          targetPath: 'terraform/app',
          artifact: {
            path: 'knowledge/terraform-rename.units.json',
            name: 'terraform-rename-public-units',
            version: '2026-05-12'
          }
        }
      ]
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'knowledge/terraform-rename.units.json'),
    `${JSON.stringify(terraformRenameUnitArtifactPayload(), null, 2)}\n`,
    'utf8'
  );
}

test('rule-based agent applies Terraform moved-block edit plans from compact RAG units', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-moved-rag-'));

  try {
    await writeTerraformMovedBlockRagWorkspace(tempRoot);
    const result = await runSingleStep(
      'rename terraform app dev from aws_s3_bucket.old to aws_s3_bucket.api',
      tempRoot,
      undefined,
      'rule-based',
      undefined,
      {
        maxTurns: 2,
        retrievedContextBudget: {
          maxFacts: 1
        }
      }
    );
    const movedTf = await readFile(join(tempRoot, 'terraform/app/moved.tf'), 'utf8');

    assert.ok(result.turns.some(turn =>
      turn.decision.action.payload?.editPlan?.kind === 'terraform-moved-block'
    ));
    assert.ok(result.runtime.appliedWrites.some(write => write.path.endsWith('terraform/app/moved.tf')));
    assert.match(movedTf, /from = aws_s3_bucket\.old/);
    assert.match(movedTf, /to   = aws_s3_bucket\.api/);
    assert.ok(result.runtime.knowledgeFacts?.units.some(unit =>
      unit.unitType === 'guidance'
      && unit.path === 'guidance.terraform.logical-rename'
    ));
    assert.equal(result.runtime.knowledgeFacts?.factCount, 0);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based agent applies Terraform moved-block edit plans from registry-backed RAG units', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-moved-registry-rag-'));

  try {
    await writeTerraformMovedBlockRegistryRagWorkspace(tempRoot);
    const result = await runSingleStep(
      'rename terraform app dev from aws_s3_bucket.old to aws_s3_bucket.api',
      tempRoot,
      undefined,
      'rule-based',
      undefined,
      {
        maxTurns: 2,
        retrievedContextBudget: {
          maxFacts: 1
        }
      }
    );
    const movedTf = await readFile(join(tempRoot, 'terraform/app/moved.tf'), 'utf8');

    assert.ok(result.turns.some(turn =>
      turn.decision.action.payload?.editPlan?.kind === 'terraform-moved-block'
    ));
    assert.ok(result.runtime.appliedWrites.some(write => write.path.endsWith('terraform/app/moved.tf')));
    assert.match(movedTf, /from = aws_s3_bucket\.old/);
    assert.match(movedTf, /to   = aws_s3_bucket\.api/);
    const renameUnit = result.runtime.knowledgeFacts?.units.find(unit =>
      unit.unitType === 'guidance'
      && unit.path === 'guidance.terraform.logical-rename'
    );
    const renameUnitSource = result.runtime.knowledgeFacts?.sources.find(source => source.id === renameUnit?.sourceId);

    assert.ok(renameUnit);
    assert.equal(renameUnitSource?.kind, 'knowledge-unit-artifact');
    assert.equal(result.runtime.knowledgeFacts?.factCount, 0);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based agent does not write Terraform moved blocks from RAG units scoped to another target', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-moved-rag-scope-'));

  try {
    await writeTerraformMovedBlockRagWorkspace(tempRoot, {
      terraformRoot: 'terraform/payments-api',
      knowledgeTargetPath: 'terraform/other-service'
    });
    const result = await runSingleStep(
      'rename terraform payments-api dev from aws_s3_bucket.old to aws_s3_bucket.api',
      tempRoot,
      undefined,
      'rule-based',
      undefined,
      {
        maxTurns: 2,
        retrievedContextBudget: {
          maxFacts: 1
        }
      }
    );

    assert.equal(
      result.runtime.appliedWrites.some(write => write.path.endsWith('terraform/payments-api/moved.tf')),
      false
    );
    await assert.rejects(
      readFile(join(tempRoot, 'terraform/payments-api/moved.tf'), 'utf8'),
      { code: 'ENOENT' }
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
