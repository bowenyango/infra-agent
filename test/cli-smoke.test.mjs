import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { inspectWorkspace } from '../src/domain/inspect-workspace.ts';
import { runSingleStep } from '../src/agent/run-single-step.ts';

test('inspect command detects fixture workspace assets', () => {
  const inspection = inspectWorkspace('fixtures/sample-workspace');

  return inspection.then(result => {
    assert.equal(result.helmCharts.length, 1);
    assert.equal(result.pulumiProjects.length, 1);
  });
});

test('rule-based agent emits ingress edit plan against fixture workspace copy', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-test-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add ingress to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    assert.match(result.modelName, /rule-based/);
    assert.ok(result.runtime.appliedWrites.length > 0);
    assert.ok(
      result.turns.some(turn => turn.decision.action.payload?.editPlan?.kind === 'helm-ingress')
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
