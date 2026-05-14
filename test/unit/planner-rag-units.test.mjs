import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve
} from 'node:path';
import { runSingleStep } from '../../src/agent/run-single-step.ts';
import {
  writeMultiTargetUnitArtifactRegistryWorkspace,
  writeTerraformRenameKnowledgeWorkspace
} from '../support/planner-rag-unit-fixtures.mjs';

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

test('agent runtime applies Terraform rename units only from the selected registry target', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-runtime-terraform-registry-scope-'));

  try {
    await writeMultiTargetUnitArtifactRegistryWorkspace(tempRoot);
    const result = await runSingleStep(
      'rename terraform app dev from aws_s3_bucket.old to aws_s3_bucket.api',
      tempRoot,
      undefined,
      'rule-based',
      undefined,
      {
        maxTurns: 2,
        retrievedContextBudget: {
          maxFacts: 5
        }
      }
    );
    const movedTf = await readFile(join(tempRoot, 'terraform/app/moved.tf'), 'utf8');
    const serializedKnowledge = JSON.stringify(result.runtime.knowledgeFacts);

    assert.ok(result.turns.some(turn =>
      turn.decision.action.payload?.editPlan?.kind === 'terraform-moved-block'
    ));
    assert.match(movedTf, /from = aws_s3_bucket\.old/);
    assert.match(movedTf, /to   = aws_s3_bucket\.api/);
    assert.deepEqual(result.runtime.knowledgeFacts?.requestedDomains, ['terraform']);
    assert.deepEqual(result.runtime.knowledgeFacts?.targetPaths, ['terraform/app']);
    assert.ok(result.runtime.knowledgeFacts?.units.some(unit =>
      unit.unitType === 'guidance'
      && unit.path === 'guidance.terraform.app.logical-rename'
    ));
    assert.doesNotMatch(serializedKnowledge, /OPS_TERRAFORM_UNIT_SENTINEL/);
    assert.doesNotMatch(serializedKnowledge, /WORKER_PULUMI_UNIT_SENTINEL/);
    assert.doesNotMatch(serializedKnowledge, /EDGE_HELM_UNIT_SENTINEL/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
