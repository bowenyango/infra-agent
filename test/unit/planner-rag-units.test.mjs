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

async function writePulumiAliasKnowledgeWorkspace(root, units = null) {
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

test('rule-based planner uses Pulumi alias units to ask for resource identity review details', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-alias-rag-'));

  try {
    await writePulumiAliasKnowledgeWorkspace(tempRoot);
    const result = await runSingleStep(
      'rename pulumi api dev bucket resource safely',
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
    assert.equal(lastTurn?.decision.action.payload?.actionFamily, 'pulumi-clarification');
    assert.equal(lastTurn?.decision.action.payload?.clarificationKind, 'general');
    assert.match(lastTurn?.decision.action.summary ?? '', /Pulumi rename, alias, or stack-config/i);
    assert.ok(lastTurn?.decision.action.payload?.questions?.some(question =>
      /old and new Pulumi resource type/i.test(question)
    ));
    assert.ok(lastTurn?.decision.action.payload?.questions?.some(question =>
      /pulumi_config_set/i.test(question)
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based planner gates Pulumi stack config edits behind alias knowledge review', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-alias-stack-config-rag-'));

  try {
    await writePulumiAliasKnowledgeWorkspace(tempRoot, [
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
    ]);
    const result = await runSingleStep(
      'rename pulumi api dev image tag to 2.3.4 while retaining the existing resource',
      tempRoot,
      undefined,
      'rule-based',
      undefined,
      {
        maxTurns: 3,
        retrievedContextBudget: {
          maxFacts: 4
        }
      }
    );
    const lastTurn = result.turns[result.turns.length - 1];

    assert.equal(result.outcome, 'clarification-required');
    assert.equal(result.runtime.appliedWrites.length, 0);
    assert.equal(lastTurn?.decision.action.kind, 'ask-for-clarification');
    assert.equal(lastTurn?.decision.action.payload?.actionFamily, 'pulumi-clarification');
    assert.match(lastTurn?.decision.action.rationale ?? '', /before applying bounded stack config edits/i);
    assert.ok(result.runtime.knowledgeFacts?.units.some(unit =>
      unit.unitType === 'recipe'
      && /aliases/i.test(JSON.stringify(unit))
    ));
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
