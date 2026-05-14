import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { runSingleStep } from '../../src/agent/run-single-step.ts';
import { writeTerraformRenameKnowledgeWorkspace } from '../support/planner-rag-unit-fixtures.mjs';

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
