import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { runSingleStep } from '../../src/agent/run-single-step.ts';
import { RuleBasedPlanningModel } from '../../src/agent/rule-based-planner.ts';
import {
  buildIrrelevantKnowledgePack,
  writeTerraformRenameKnowledgeWorkspace
} from '../support/planner-rag-unit-fixtures.mjs';

test('rule-based planner does not ask Terraform rename clarification without relevant units', async () => {
  const model = new RuleBasedPlanningModel();
  const decision = await model.decideNextAction({
    runtime: {
      task: 'rename terraform api bucket resource safely',
      preflight: {
        requestedDomains: ['terraform'],
        requestedEnvironment: null,
        targetCandidates: [
          {
            kind: 'terraform-root',
            path: 'terraform/api',
            score: 100,
            reasons: [],
            details: []
          }
        ],
        assumptions: [],
        blockers: [],
        validation: {
          validators: [],
          plan: []
        }
      },
      retrievedContext: [],
      knowledgeFacts: buildIrrelevantKnowledgePack('terraform', 'terraform/api'),
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {}
        }
      ],
      toolSummaries: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.notEqual(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'no-safe-action');
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
