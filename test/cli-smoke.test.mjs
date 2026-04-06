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
import { classifyValidationIssues } from '../src/agent/classify-validation-issues.ts';
import { RuleBasedPlanningModel } from '../src/agent/rule-based-planner.ts';
import { parsePlannerDecision } from '../src/model/decision-parser.ts';
import { buildPlannerSystemPrompt } from '../src/model/prompt.ts';

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
    validationIssues: [],
    repairAttempts: 0,
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

test('rule-based agent repairs missing service.port after validation failure', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-repair-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/repair-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add ingress to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    assert.ok(result.turns.some(turn => turn.decision.action.payload?.editPlan?.kind === 'helm-service-port-repair'));
    assert.ok(result.runtime.repairAttempts >= 1);
    assert.ok(result.runtime.validationResults.every(entry => entry.exitCode === 0));
    assert.equal(result.runtime.validationIssues.length, 0);
    assert.equal(result.outcome, 'completed');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('classifyValidationIssues marks ingress.enabled failures as repairable', () => {
  const issues = classifyValidationIssues([
    {
      command: 'helm template charts/payments-api',
      exitCode: 1,
      stdout: '',
      stderr: 'template: charts/payments-api/templates/ingress.yaml: executing at <.Values.ingress.enabled>: nil pointer evaluating interface {}.enabled'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'helm-missing-ingress-values');
  assert.equal(issues[0]?.repairable, true);
});

test('planner system prompt documents explicit stop reasons', () => {
  const prompt = buildPlannerSystemPrompt();

  assert.match(prompt, /Allowed stop payload\.stopReason values:/);
  assert.match(prompt, /repair-budget-exhausted/);
  assert.match(prompt, /validation-succeeded/);
});

test('parsePlannerDecision requires stopReason for stop actions', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');

  assert.throws(
    () =>
      parsePlannerDecision(
        JSON.stringify({
          confidence: 'medium',
          action: {
            kind: 'stop',
            summary: 'Stop here',
            rationale: 'No further work'
          }
        }),
        {
          task: preflight.task,
          preflight,
          observations: [],
          appliedWrites: [],
          validationResults: [],
          validationIssues: [],
          repairAttempts: 0,
          lastEditPlan: null
        }
      ),
    /action\.payload\.stopReason/
  );
});

test('parsePlannerDecision accepts supported stopReason values', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'high',
      action: {
        kind: 'stop',
        summary: 'Validation passed',
        rationale: 'All configured validators succeeded.',
        payload: {
          stopReason: 'validation-succeeded'
        }
      }
    }),
    {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  );

  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'validation-succeeded');
});

test('rule-based agent repairs missing ingress values after validation failure', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-repair-ingress-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/repair-ingress-values-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add readiness and liveness probes to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    assert.ok(result.turns.some(turn => turn.decision.action.payload?.editPlan?.kind === 'helm-ingress-values-repair'));
    assert.ok(result.runtime.repairAttempts >= 1);
    assert.ok(result.runtime.validationResults.every(entry => entry.exitCode === 0));
    assert.equal(result.runtime.validationIssues.length, 0);
    assert.equal(result.outcome, 'completed');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based planner stops with repair-budget-exhausted after bounded retries are consumed', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight,
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: 'charts/payments-api/values.yaml',
            content: 'service:\n  port: 8080\n',
            truncated: false
          }
        }
      ],
      appliedWrites: [
        {
          path: 'charts/payments-api/values.yaml',
          content: 'service:\n  port: 8080\n',
          reason: 'test write'
        }
      ],
      validationResults: [
        {
          command: 'helm template charts/payments-api',
          exitCode: 1,
          stdout: '',
          stderr: 'template: charts/payments-api/templates/ingress.yaml: executing at <.Values.ingress.enabled>: nil pointer evaluating interface {}.enabled'
        }
      ],
      validationIssues: [
        {
          kind: 'helm-missing-ingress-values',
          repairable: true,
          sourceCommand: 'helm template charts/payments-api',
          message: 'Validation failed because a Helm template references .Values.ingress.enabled but the values file does not define ingress settings.'
        }
      ],
      repairAttempts: 2,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'repair-budget-exhausted');
  assert.match(decision.action.summary, /repair budget/i);
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
    assert.equal(result.outcome, 'completed');
    assert.ok(result.runtime.appliedWrites.length > 0);
    assert.ok(
      result.turns.some(turn => turn.decision.action.payload?.editPlan?.kind === 'helm-ingress')
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
