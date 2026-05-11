import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  cp,
  readFile,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  resolve,
  join
} from 'node:path';
import { captureStdout } from '../support/capture-stdout.mjs';
import { runSingleStep } from '../../src/agent/run-single-step.ts';
import { executeDecision } from '../../src/agent/execute-decision.ts';
import { buildRunPreflight } from '../../src/agent/build-run-preflight.ts';
import { RuleBasedPlanningModel } from '../../src/agent/rule-based-planner.ts';
import {
  buildCompactAgentRunResult,
  summarizeResultCard
} from '../../src/cli/output.ts';
import { main } from '../../src/cli/main.ts';
import { buildPlannerProviderCatalogDiscovery } from '../../src/cli/planner-provider-catalog.ts';
import { INFRA_AGENT_EXIT_CODES } from '../../src/cli/exit-codes.ts';
import { parseCompactAgentRunResult } from '../../src/cli/agent-result-contract.ts';
import { resolveQueryLoopConfig } from '../../src/query-config.ts';

test('compact work plan maps terminal outcomes to active steps', async () => {
  const preflight = await buildRunPreflight('add readiness and liveness probes to payments-api dev chart', 'fixtures/sample-workspace');
  const readFileSummary = {
    turnIndex: 0,
    actionKind: 'inspect-target-files',
    toolName: 'read_file',
    safety: 'read_only',
    permission: {
      category: 'workspace-read',
      mutatesWorkspace: false,
      mutatesExternalState: false,
      externalCommand: false,
      approvalRequired: false
    },
    summary: 'Read chart values.'
  };
  const makeState = runtimeOverrides => ({
    modelName: 'test-model',
    outcome: runtimeOverrides.outcome,
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      retrievedContext: [],
      observations: [],
      toolSummaries: runtimeOverrides.toolSummaries ?? [],
      appliedWrites: runtimeOverrides.appliedWrites ?? [],
      validationResults: runtimeOverrides.validationResults ?? [],
      validationIssues: runtimeOverrides.validationIssues ?? [],
      approvalSignals: runtimeOverrides.approvalSignals ?? [],
      repairAttempts: runtimeOverrides.repairAttempts ?? 0,
      maxRepairAttempts: 2,
      lastEditPlan: null
    },
    turns: [],
    config: resolveQueryLoopConfig()
  });

  const approvalState = makeState({
    outcome: 'approval-required',
    toolSummaries: [readFileSummary],
    approvalSignals: [
      {
        kind: 'write-approval-required',
        path: 'charts/payments-api/values.yaml',
        risk: 'medium',
        message: 'Approval required before editing chart values.'
      }
    ]
  });
  const approvalCompact = buildCompactAgentRunResult(approvalState);
  const approvalStep = approvalCompact.harness.workPlan.steps.find(step => step.kind === 'edit');
  assert.equal(approvalCompact.harness.workPlan.status, 'blocked');
  assert.equal(approvalCompact.harness.workPlan.blockerKind, 'approval');
  assert.equal(approvalCompact.harness.workPlan.currentStepIndex, 3);
  assert.equal(approvalStep?.status, 'blocked');
  assert.equal(approvalStep?.approvalSignalKind, 'write-approval-required');
  assert.equal(parseCompactAgentRunResult(approvalCompact).kind, 'infra-agent.agent-result');

  const approvalWarnCompact = buildCompactAgentRunResult({
    ...approvalState,
    modelName: 'rule-based-fallback'
  });
  assert.match(approvalWarnCompact.suggestedCommands[0] ?? '', / doctor .*--json/);
  assert.ok(approvalWarnCompact.suggestedCommands.some(command => /--approve-write-risk medium/.test(command)));
  assert.doesNotMatch(approvalWarnCompact.approval.resume.command ?? '', /doctor/);

  const validationCompact = buildCompactAgentRunResult(makeState({
    outcome: 'validation-blocked',
    validationResults: [
      {
        command: 'helm lint charts/payments-api',
        exitCode: 1,
        stdout: '',
        stderr: 'service.port is required'
      }
    ],
    validationIssues: [
      {
        kind: 'helm-missing-service-port',
        repairable: true,
        sourceCommand: 'helm lint charts/payments-api',
        message: 'service.port is required'
      }
    ]
  }));
  const validationStep = validationCompact.harness.workPlan.steps.find(step => step.kind === 'validation');
  assert.equal(validationCompact.harness.workPlan.status, 'blocked');
  assert.equal(validationCompact.harness.workPlan.blockerKind, 'validation');
  assert.equal(validationCompact.harness.workPlan.currentStepIndex, 4);
  assert.equal(validationStep?.status, 'blocked');
  assert.equal(validationStep?.validationIssueKind, 'helm-missing-service-port');
  assert.equal(validationCompact.harness.plannerHandoff.activeBlocker.validationIssueKind, 'helm-missing-service-port');
  assert.equal(parseCompactAgentRunResult(validationCompact).kind, 'infra-agent.agent-result');

  const repairCompact = buildCompactAgentRunResult(makeState({
    outcome: 'repair-budget-exhausted',
    repairAttempts: 2,
    validationResults: [
      {
        command: 'helm lint charts/payments-api',
        exitCode: 1,
        stdout: '',
        stderr: 'service.port is required'
      }
    ],
    validationIssues: [
      {
        kind: 'helm-missing-service-port',
        repairable: true,
        sourceCommand: 'helm lint charts/payments-api',
        message: 'service.port is required'
      }
    ]
  }));
  const repairStep = repairCompact.harness.workPlan.steps.find(step => step.kind === 'validation');
  assert.equal(repairCompact.harness.workPlan.status, 'blocked');
  assert.equal(repairCompact.harness.workPlan.blockerKind, 'repair-budget');
  assert.equal(repairCompact.harness.workPlan.nextControlAction, 'manual-repair');
  assert.equal(repairStep?.status, 'blocked');
  assert.equal(repairStep?.validationIssueKind, 'helm-missing-service-port');
  assert.equal(repairCompact.harness.plannerHandoff.activeBlocker.validationIssueKind, null);
  assert.equal(parseCompactAgentRunResult(repairCompact).kind, 'infra-agent.agent-result');

  const completedCompact = buildCompactAgentRunResult(makeState({
    outcome: 'completed',
    toolSummaries: [readFileSummary],
    validationResults: [
      {
        command: 'helm lint charts/payments-api',
        exitCode: 0,
        stdout: 'ok',
        stderr: ''
      }
    ]
  }));
  assert.equal(completedCompact.harness.workPlan.status, 'completed');
  assert.equal(completedCompact.harness.workPlan.blockerKind, 'none');
  assert.equal(completedCompact.harness.workPlan.currentStepIndex, null);
  assert.equal(completedCompact.harness.workPlan.skippedStepCount, 1);
  assert.ok(completedCompact.harness.workPlan.steps.some(step =>
    step.kind === 'edit'
    && step.status === 'skipped'
  ));
  assert.ok(completedCompact.harness.workPlan.steps.some(step =>
    step.kind === 'validation'
    && step.status === 'completed'
  ));
  assert.ok(completedCompact.harness.workPlan.steps.some(step =>
    step.kind === 'handoff'
    && step.status === 'completed'
  ));
  assert.equal(parseCompactAgentRunResult(completedCompact).kind, 'infra-agent.agent-result');
  assert.throws(
    () => parseCompactAgentRunResult({
      ...completedCompact,
      harness: {
        ...completedCompact.harness,
        workPlan: {
          ...completedCompact.harness.workPlan,
          currentStepIndex: 3
        }
      }
    }),
    /harness\.workPlan\.currentStepIndex must be null/
  );

  const noSafeCompact = buildCompactAgentRunResult(makeState({
    outcome: 'no-safe-action'
  }));
  assert.equal(noSafeCompact.harness.workPlan.status, 'blocked');
  assert.equal(noSafeCompact.harness.workPlan.blockerKind, 'no-safe-action');
  assert.equal(noSafeCompact.harness.workPlan.nextControlAction, 'inspect-readiness-or-targeting');
  assert.equal(noSafeCompact.harness.workPlan.currentStepIndex, 5);
  assert.equal(parseCompactAgentRunResult(noSafeCompact).kind, 'infra-agent.agent-result');
});

test('agent CLI compact JSON includes work plan handoff', async () => {
  const previousExitCode = process.exitCode;
  process.exitCode = 0;

  try {
    const output = await captureStdout(() => main([
      'agent',
      'add ingress to payments-api dev chart',
      '--workspace',
      'fixtures/sample-workspace',
      '--planner',
      'rule-based',
      '--max-turns',
      '1',
      '--context-fact-limit',
      '2',
      '--json'
    ]));
    const jsonStart = output.indexOf('{');
    const jsonEnd = output.lastIndexOf('}');
    const compact = JSON.parse(output.slice(jsonStart, jsonEnd + 1));

    assert.equal(compact.kind, 'infra-agent.agent-result');
    assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
    assert.equal(compact.outcome, 'no-safe-action');
    assert.equal(compact.knowledgeFacts.kind, 'infra-agent.knowledge-facts-summary');
    assert.equal(compact.knowledgeFacts.maxFacts, 2);
    assert.ok(compact.knowledgeFacts.totalFactCount > 0);
    assert.ok(compact.knowledgeFacts.totalUnitCount > 0);
    assert.ok(compact.knowledgeFacts.includedFactCount <= 2);
    assert.ok(compact.knowledgeFacts.includedUnitCount <= 2);
    assert.equal(compact.knowledgeFacts.units.length, compact.knowledgeFacts.includedUnitCount);
    assert.equal(
      compact.knowledgeFacts.uncheckedSourceCount,
      compact.knowledgeFacts.sources.filter(source => source.freshness === 'unchecked').length
    );
    assert.deepEqual(compact.handoffCheckpoint.budgets.knowledgeFacts, {
      includedCount: compact.knowledgeFacts.includedFactCount,
      omittedCount: compact.knowledgeFacts.omittedFactCount
    });
    assert.deepEqual(compact.handoffCheckpoint.budgets.knowledgeUnits, {
      includedCount: compact.knowledgeFacts.includedUnitCount,
      omittedCount: compact.knowledgeFacts.omittedUnitCount
    });
    assert.ok(compact.resultCard.some(line => /Knowledge facts: \d+\/\d+ fact\(s\) included; \d+\/\d+ unit\(s\) included; max 2/i.test(line)));
    assert.doesNotMatch(JSON.stringify(compact.knowledgeFacts), /"content"\s*:|contentHash|fetchedAt|"\$schema"/);
    assert.equal(compact.harness.workPlan.schemaVersion, 1);
    assert.equal(compact.harness.workPlan.blockerKind, compact.harness.plannerHandoff.activeBlocker.kind);
    assert.equal(compact.harness.workPlan.nextControlAction, compact.harness.plannerHandoff.nextControlAction);
    assert.equal(compact.handoffCheckpoint.budgets.workPlan.includedCount, compact.harness.workPlan.includedCount);
    assert.equal(compact.handoffCheckpoint.budgets.workPlan.omittedCount, compact.harness.workPlan.omittedCount);
    assert.ok(compact.resultCard.some(line => /Work plan: blocked; current handoff\/blocked; completed \d+\/6; blocked \d+; skipped \d+; next/i.test(line)));
    assert.equal(process.exitCode, INFRA_AGENT_EXIT_CODES.noSafeAction);
  } finally {
    process.exitCode = previousExitCode;
  }
});

test('agent CLI compact JSON preserves explicit approval grants', async () => {
  const previousExitCode = process.exitCode;
  process.exitCode = 0;

  try {
    const output = await captureStdout(() => main([
      'agent',
      'update payments-api chart deeply',
      '--workspace',
      'fixtures/sample-workspace',
      '--planner',
      'rule-based',
      '--approve-write-risk',
      'high',
      '--approve-write-path',
      'charts/payments-api',
      '--approve-tool-category',
      'native-stack-config-write',
      '--json'
    ]));
    const jsonStart = output.indexOf('{');
    const jsonEnd = output.lastIndexOf('}');
    const compact = JSON.parse(output.slice(jsonStart, jsonEnd + 1));

    assert.equal(compact.kind, 'infra-agent.agent-result');
    assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
    assert.deepEqual(compact.approval.grants, {
      approvedWriteRisks: ['high'],
      approvedWritePaths: ['charts/payments-api'],
      approvedToolCategories: ['native-stack-config-write'],
      writePathScope: 'scoped',
      hasExplicitApproval: true
    });
    assert.ok(compact.resultCard.some(line =>
      /Approval grants: write risks high; write paths charts\/payments-api; tool categories native-stack-config-write; write path scope scoped/i.test(line)
    ));
    assert.equal(process.exitCode, INFRA_AGENT_EXIT_CODES.clarificationRequired);
  } finally {
    process.exitCode = previousExitCode;
  }
});
