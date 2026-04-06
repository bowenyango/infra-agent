import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { inspectWorkspace } from '../src/domain/inspect-workspace.ts';
import { runSingleStep } from '../src/agent/run-single-step.ts';
import { buildTargetCandidates } from '../src/domain/task-targeting.ts';
import { buildRunPreflight } from '../src/agent/build-run-preflight.ts';
import { selectValidationCommands } from '../src/agent/select-validation-commands.ts';
import { buildValidationPreflight } from '../src/validators/preflight.ts';

test('inspect command detects fixture workspace assets', () => {
  const inspection = inspectWorkspace('fixtures/sample-workspace');

  return inspection.then(result => {
    assert.equal(result.profile.id, 'generic');
    assert.equal(result.helmCharts.length, 1);
    assert.equal(result.pulumiProjects.length, 1);
  });
});

test('inspectWorkspace detects scrawlr infra-apps profile', async () => {
  const inspection = await inspectWorkspace('fixtures/scrawlr-infra-apps-workspace');

  assert.equal(inspection.profile.id, 'scrawlr-infra-apps');
  assert.match(inspection.profile.label, /Scrawlr/);
});

test('inspectWorkspace detects scrawlr infra-cloud profile', async () => {
  const inspection = await inspectWorkspace('fixtures/scrawlr-infra-cloud-workspace');

  assert.equal(inspection.profile.id, 'scrawlr-infra-cloud');
  assert.match(inspection.profile.label, /Scrawlr/);
});

test('workspace config can pin the repo profile', async () => {
  const inspection = await inspectWorkspace('fixtures/configured-workspace');

  assert.equal(inspection.profile.id, 'scrawlr-infra-cloud');
  assert.equal(inspection.config?.profileId, 'scrawlr-infra-cloud');
});

test('profile-aware targeting prefers Helm charts inside scrawlr infra-apps fixtures', async () => {
  const inspection = await inspectWorkspace('fixtures/scrawlr-infra-apps-workspace');
  const targeting = buildTargetCandidates('update reloader chart for dev', inspection);

  assert.equal(targeting.targetCandidates[0]?.kind, 'helm-chart');
  assert.equal(targeting.targetCandidates[0]?.path, 'charts/infra/reloader');
});

test('profile-aware targeting prefers Pulumi projects inside scrawlr infra-cloud fixtures', async () => {
  const inspection = await inspectWorkspace('fixtures/scrawlr-infra-cloud-workspace');
  const targeting = buildTargetCandidates('update networking non-prod stack', inspection);

  assert.equal(targeting.targetCandidates[0]?.kind, 'pulumi-project');
  assert.equal(targeting.targetCandidates[0]?.path, 'networking');
});

test('profile-aware validation selection filters to Pulumi commands for infra-cloud fixtures', async () => {
  const preflight = await buildRunPreflight('update networking non-prod stack', 'fixtures/scrawlr-infra-cloud-workspace');
  const commands = selectValidationCommands({
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [
      {
        path: 'networking/Pulumi.non-prod.yaml',
        content: '',
        reason: 'test write'
      }
    ],
    validationResults: [],
    lastEditPlan: null
  });

  assert.ok(commands.length > 0);
  assert.ok(commands.every(command => command.includes('pulumi preview')));
});

test('workspace config overrides validation plan entries', async () => {
  const inspection = await inspectWorkspace('fixtures/configured-workspace');
  const validation = buildValidationPreflight(inspection);

  assert.equal(validation.usedWorkspaceConfig, true);
  assert.equal(validation.plan.length, 1);
  assert.equal(validation.plan[0]?.commands[0], 'echo custom networking validation');
});

test('workspace write policy blocks non-allowed chart edits during preflight', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/restricted-workspace');

  assert.ok(
    preflight.blockers.some(blocker => blocker.includes('Workspace write policy does not allow edits under charts/payments-api'))
  );
});

test('rule-based agent asks for clarification when write policy blocks the top target', async () => {
  const result = await runSingleStep(
    'add ingress to payments-api dev chart',
    'fixtures/restricted-workspace',
    undefined,
    'rule-based'
  );

  assert.equal(result.turns[0]?.decision.action.kind, 'ask-for-clarification');
  assert.match(result.turns[0]?.decision.action.summary ?? '', /writable target boundaries/i);
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
