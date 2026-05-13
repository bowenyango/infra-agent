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
import { runSingleStep } from '../../src/agent/run-single-step.ts';

async function writeTerraformRenameKnowledgeWorkspace(root) {
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

test('agent runtime loads unit-only knowledge packs from configured curated units', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-runtime-unit-only-'));
  let checked = false;

  try {
    await writeTerraformRenameKnowledgeWorkspace(tempRoot);
    const checkingModel = {
      name: 'unit-only-knowledge-check',
      async decideNextAction({ runtime }) {
        checked = true;
        assert.ok(runtime.knowledgeFacts);
        assert.equal(runtime.knowledgeFacts.factCount, 0);
        assert.ok(runtime.knowledgeFacts.unitCount > 0);
        assert.ok(runtime.knowledgeFacts.units.some(unit =>
          unit.unitType === 'guidance'
          && unit.topic === 'terraform-logical-rename'
        ));
        return {
          confidence: 'high',
          action: {
            kind: 'stop',
            summary: 'Unit-only knowledge checked.',
            rationale: 'Runtime loaded compact knowledge units without facts.',
            payload: {
              stopReason: 'no-safe-action'
            }
          }
        };
      }
    };

    await runSingleStep(
      'rename terraform api dev bucket resource safely',
      tempRoot,
      checkingModel,
      'rule-based',
      undefined,
      {
        retrievedContextBudget: {
          maxFacts: 1
        }
      }
    );

    assert.equal(checked, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based planner uses Terraform rename units to ask for moved-block review details', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-rename-rag-'));

  try {
    await writeTerraformRenameKnowledgeWorkspace(tempRoot);
    const result = await runSingleStep(
      'rename terraform api dev bucket resource safely',
      tempRoot,
      undefined,
      'rule-based',
      undefined,
      {
        maxTurns: 3,
        retrievedContextBudget: {
          maxFacts: 1
        }
      }
    );
    const lastTurn = result.turns[result.turns.length - 1];

    assert.equal(result.outcome, 'clarification-required');
    assert.equal(lastTurn?.decision.action.kind, 'ask-for-clarification');
    assert.equal(lastTurn?.decision.action.payload?.actionFamily, 'terraform-clarification');
    assert.equal(lastTurn?.decision.action.payload?.clarificationKind, 'general');
    assert.match(lastTurn?.decision.action.summary ?? '', /Terraform logical rename/i);
    assert.ok(lastTurn?.decision.action.payload?.questions?.some(question =>
      /old and new Terraform resource addresses/i.test(question)
    ));
    assert.ok(lastTurn?.decision.action.payload?.questions?.some(question =>
      /moved block/i.test(question)
    ));
    assert.doesNotMatch(JSON.stringify(lastTurn?.decision), /moved \{ from = aws_s3_bucket\.old/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
