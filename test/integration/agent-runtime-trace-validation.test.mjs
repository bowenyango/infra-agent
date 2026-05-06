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

test('buildCompactAgentRunResult exposes skipped turn execution reasons', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const state = {
    modelName: 'test-model',
    outcome: 'no-safe-action',
    preflight,
    runtime,
    turns: [
      {
        index: 0,
        decision: {
          confidence: 'low',
          action: {
            kind: 'validate-targets',
            summary: 'Validation skipped',
            rationale: 'No command payload was available.',
            payload: {
              commands: [],
              actionFamily: 'helm-validation'
            }
          }
        },
        execution: {
          status: 'skipped',
          executedTools: [],
          reason: 'No validation commands were present in the decision payload.'
        },
        runtimeSnapshot: runtime
      }
    ]
  };
  const compact = buildCompactAgentRunResult(state);

  assert.equal(compact.harness.turnTrace[0]?.executionStatus, 'skipped');
  assert.equal(compact.harness.lifecycleEvents.totalCount, 3);
  assert.equal(compact.harness.lifecycleEvents.includedCount, 3);
  assert.equal(compact.harness.lifecycleEvents.eventCounts.decision, 1);
  assert.equal(compact.harness.lifecycleEvents.eventCounts.terminal, 1);
  assert.ok(compact.harness.lifecycleEvents.events.some(event =>
    event.event === 'decision'
    && event.actionKind === 'validate-targets'
    && event.executionStatus === 'skipped'
    && /No validation commands/.test(event.reason ?? '')
  ));
  assert.equal(compact.harness.lifecycleEvents.events.at(-1)?.event, 'terminal');
  assert.equal(compact.harness.lifecycleEvents.events.at(-1)?.outcome, 'no-safe-action');
  assert.equal(
    compact.harness.turnTrace[0]?.executionReason,
    'No validation commands were present in the decision payload.'
  );
  assert.deepEqual(compact.harness.plannerHandoff.lastAction, {
    kind: 'validate-targets',
    family: 'helm-validation',
    stopReason: null,
    clarificationKind: null,
    executionStatus: 'skipped'
  });
  assert.equal(compact.harness.plannerHandoff.activeBlocker.kind, 'turn-budget');
  assert.equal(compact.harness.plannerHandoff.nextControlAction, 'rerun-with-larger-turn-budget');
  assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
});

test('buildCompactAgentRunResult preserves capped tool trace tail window', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const toolSummaries = Array.from({ length: 10 }, (_, index) => ({
    turnIndex: index,
    actionKind: 'inspect-target-files',
    toolName: 'read_file',
    safety: 'read_only',
    summary: `Read target file ${index}.`
  }));
  const compact = buildCompactAgentRunResult({
    modelName: 'test-model',
    outcome: 'no-safe-action',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      toolSummaries,
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: [],
    config: resolveQueryLoopConfig()
  });

  assert.equal(compact.harness.toolTrace.totalCount, 10);
  assert.equal(compact.harness.toolTrace.maxEntries, 8);
  assert.equal(compact.harness.toolTrace.includedCount, 8);
  assert.equal(compact.harness.toolTrace.omittedCount, 2);
  assert.equal(compact.harness.toolTrace.preservedWindow, 'tail');
  assert.equal(compact.harness.toolTrace.firstIncludedTurnIndex, 2);
  assert.equal(compact.harness.toolTrace.lastIncludedTurnIndex, 9);
  assert.equal(compact.harness.toolTrace.latestTurnIndex, 9);
  assert.deepEqual(
    compact.harness.toolTrace.entries.map(entry => entry.turnIndex),
    [2, 3, 4, 5, 6, 7, 8, 9]
  );
  assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
});

test('buildCompactAgentRunResult exposes turn trace budget metadata when capped', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const turns = Array.from({ length: 12 }, (_, index) => ({
    index,
    decision: {
      confidence: 'medium',
      action: {
        kind: 'inspect-target-files',
        summary: `Inspect turn ${index}`,
        rationale: 'Synthetic capped trace coverage.',
        payload: {
          actionFamily: 'runtime-inspection'
        }
      }
    },
    execution: {
      status: 'completed',
      executedTools: [],
      reason: null
    },
    runtimeSnapshot: runtime
  }));
  const compact = buildCompactAgentRunResult({
    modelName: 'test-model',
    outcome: 'no-safe-action',
    preflight,
    runtime,
    turns
  });

  assert.equal(compact.harness.turnTrace.length, 10);
  assert.equal(compact.harness.turnTraceOmittedCount, 2);
  assert.deepEqual(compact.harness.turnTraceBudget, {
    maxEntries: 10,
    totalCount: 12,
    includedCount: 10,
    omittedCount: 2,
    firstIncludedTurnIndex: 0,
    lastIncludedTurnIndex: 9,
    preservedWindow: 'head'
  });
  assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
});

test('buildCompactAgentRunResult includes budgeted validation command summaries', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const longStdout = 'x'.repeat(420);
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [
      {
        command: 'infra-agent yaml-parse terraform/payments-api/dev.auto.tfvars',
        exitCode: 0,
        stdout: 'YAML ok',
        stderr: ''
      },
      {
        command: 'terraform -chdir=terraform/payments-api validate',
        exitCode: 1,
        stdout: longStdout,
        stderr: 'Error: Missing required argument'
      },
      {
        command: 'terraform -chdir=terraform/payments-api apply -auto-approve',
        exitCode: 1,
        stdout: '',
        stderr: 'infra-agent blocked unsafe validation command: Terraform apply is not validation [terraform-apply]'
      }
    ],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const compact = buildCompactAgentRunResult({
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime,
    turns: []
  });

  assert.equal(compact.validation.commands.maxEntries, 8);
  assert.equal(compact.validation.commands.omittedCount, 0);
  assert.equal(compact.validation.commands.entries[0]?.kind, 'yaml-guard');
  assert.equal(compact.validation.commands.entries[1]?.status, 'failed');
  assert.equal(compact.validation.commands.entries[1]?.stdoutPreview.length, 303);
  assert.equal(compact.validation.commands.entries[1]?.unsafeRuleId, null);
  assert.equal(compact.validation.commands.entries[1]?.unsafeReason, null);
  assert.equal(compact.validation.commands.entries[2]?.unsafeBlocked, true);
  assert.equal(compact.validation.commands.entries[2]?.unsafeRuleId, 'terraform-apply-destroy');
  assert.equal(
    compact.validation.commands.entries[2]?.unsafeReason,
    'Terraform apply and destroy commands are deploy/state mutation operations, not validation.'
  );
  assert.equal(Object.hasOwn(compact, 'runtime'), false);
});

test('buildCompactAgentRunResult includes grouped validation issue summary', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const validationIssues = [
    {
      kind: 'terraform-validate-failure',
      repairable: true,
      sourceCommand: 'terraform -chdir=terraform/payments-api validate',
      message: 'Missing required argument.'
    },
    {
      kind: 'terraform-validate-failure',
      repairable: true,
      sourceCommand: 'terraform -chdir=terraform/payments-api validate -json',
      message: 'Missing required argument.'
    },
    {
      kind: 'yaml-syntax-failure',
      repairable: false,
      sourceCommand: 'infra-agent yaml-parse terraform/payments-api/dev.auto.tfvars',
      message: 'YAML syntax failed.',
      metadata: {
        yamlPath: 'terraform/payments-api/dev.auto.tfvars',
        yamlParser: 'yaml'
      }
    },
    {
      kind: 'unsafe-validation-command',
      repairable: false,
      sourceCommand: 'terraform -chdir=terraform/payments-api apply',
      message: 'Unsafe validation command blocked.',
      metadata: {
        unsafeCommand: 'terraform -chdir=terraform/payments-api apply',
        unsafeReason: 'Terraform apply and destroy commands are deploy/state mutation operations, not validation.'
      }
    },
    {
      kind: 'helm-missing-service-port',
      repairable: true,
      sourceCommand: 'helm template payments-api charts/payments-api',
      message: 'service.port is required.'
    },
    {
      kind: 'helm-missing-ingress-values',
      repairable: true,
      sourceCommand: 'helm template payments-api charts/payments-api',
      message: 'ingress.enabled is required.'
    },
    {
      kind: 'pulumi-missing-config',
      repairable: true,
      sourceCommand: 'pulumi preview --stack dev',
      message: 'Missing stack config.'
    },
    {
      kind: 'pulumi-preview-failure',
      repairable: false,
      sourceCommand: 'pulumi preview --stack dev',
      message: 'Preview failed.'
    },
    {
      kind: 'terraform-formatting-required',
      repairable: true,
      sourceCommand: 'terraform -chdir=terraform/payments-api fmt -check',
      message: 'Terraform formatting is required.'
    },
    {
      kind: 'unknown-validation-failure',
      repairable: false,
      sourceCommand: 'custom validate',
      message: 'Unknown validation failed.'
    }
  ];
  const state = {
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues,
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  };
  const compact = buildCompactAgentRunResult(state);
  const resultCard = summarizeResultCard(state);

  assert.equal(compact.validation.issueSummary.totalCount, 10);
  assert.equal(compact.validation.issueSummary.omittedIssueCount, 5);
  assert.equal(compact.validation.issueSummary.repairableCount, 6);
  assert.equal(compact.validation.issueSummary.nonRepairableCount, 4);
  assert.equal(compact.validation.issueSummary.maxGroups, 8);
  assert.equal(compact.validation.issueSummary.groups.length, 8);
  assert.equal(compact.validation.issueSummary.omittedGroupCount, 1);
  assert.deepEqual(compact.validation.issueSummary.groups[0], {
    kind: 'terraform-validate-failure',
    repairable: true,
    count: 2,
    sourceCommandCount: 2,
    blocking: true
  });
  assert.deepEqual(compact.validation.issueSummary.flags, {
    hasRepairableIssues: true,
    hasNonRepairableIssues: true,
    hasUnsafeValidationCommand: true,
    hasYamlSyntaxFailure: true,
    hasIdentityConflict: false
  });
  assert.deepEqual(compact.validation.issueDetails, {
    maxEntries: 5,
    omittedCount: 5
  });
  assert.equal(compact.validation.issueDetails.omittedCount, compact.validation.issueSummary.omittedIssueCount);
  assert.equal(compact.validation.safetyBlockers.maxEntries, 5);
  assert.equal(compact.validation.safetyBlockers.omittedCount, 0);
  assert.equal(compact.validation.safetyBlockers.entries.length, 2);
  const yamlSafetyBlocker = compact.validation.safetyBlockers.entries.find(entry => entry.kind === 'yaml-syntax-failure');
  const unsafeSafetyBlocker = compact.validation.safetyBlockers.entries.find(entry => entry.kind === 'unsafe-validation-command');
  assert.equal(yamlSafetyBlocker?.mutationPrevented, true);
  assert.equal(yamlSafetyBlocker?.yamlPath, 'terraform/payments-api/dev.auto.tfvars');
  assert.equal(yamlSafetyBlocker?.yamlParser, 'yaml');
  assert.equal(yamlSafetyBlocker?.unsafeRuleId, null);
  assert.equal(unsafeSafetyBlocker?.mutationPrevented, true);
  assert.equal(unsafeSafetyBlocker?.unsafeCommand, 'terraform -chdir=terraform/payments-api apply');
  assert.equal(unsafeSafetyBlocker?.unsafeRuleId, 'terraform-apply-destroy');
  assert.equal(
    unsafeSafetyBlocker?.unsafeReason,
    'Terraform apply and destroy commands are deploy/state mutation operations, not validation.'
  );
  assert.equal(compact.validation.issues.length, 5);
  assert.equal(compact.harness.plannerHandoff.activeBlocker.kind, 'validation');
  assert.equal(compact.harness.plannerHandoff.activeBlocker.validationIssueKind, 'terraform-validate-failure');
  assert.equal(compact.harness.plannerHandoff.nextControlAction, 'resolve-validation');
  assert.ok(resultCard.some(line => /Validation blockers: 10 issue\(s\); 6 repairable, 4 non-repairable; top terraform-validate-failure x2; omitted issues=5, groups=1/i.test(line)));
});

test('buildCompactAgentRunResult maps planner handoff controls by outcome', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const retrievedContextBudget = {
    maxPackets: 5,
    maxTokens: 1000,
    maxExcerptChars: 600
  };
  const makeTurn = (actionKind = 'stop', payload = { stopReason: 'done' }) => ({
    index: 0,
    decision: {
      action: {
        kind: actionKind,
        summary: `${actionKind} summary`,
        payload
      },
      confidence: 0.9
    },
    execution: {
      status: 'skipped',
      reason: null,
      executedTools: []
    },
    runtimeSnapshot: {
      appliedWrites: [],
      validationIssues: [],
      approvalSignals: []
    }
  });
  const makeState = ({
    outcome,
    runtime = {},
    turns = [makeTurn()],
    maxTurns = 6,
    maxRepairAttempts = 2
  }) => ({
    modelName: 'test-model',
    outcome,
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null,
      retrievedContext: [],
      retrievedContextBudget,
      ...runtime
    },
    turns,
    config: {
      maxTurns,
      maxRepairAttempts,
      retrievedContextBudget
    }
  });
  const cases = [
    {
      name: 'completed',
      state: makeState({ outcome: 'completed' }),
      activeBlockerKind: 'none',
      nextControlAction: 'review-result'
    },
    {
      name: 'approval-required',
      state: makeState({
        outcome: 'approval-required',
        runtime: {
          approvalSignals: [
            {
              kind: 'write-approval-required',
              path: 'charts/payments-api/values.yaml',
              risk: 'high',
              message: 'Approval required.'
            }
          ]
        }
      }),
      activeBlockerKind: 'approval',
      nextControlAction: 'request-approval',
      approvalSignalKind: 'write-approval-required'
    },
    {
      name: 'clarification-required',
      state: makeState({
        outcome: 'clarification-required',
        turns: [makeTurn('ask-for-clarification', {
          actionFamily: 'helm-edit',
          clarificationKind: 'target',
          question: 'Which target should be changed?'
        })]
      }),
      activeBlockerKind: 'clarification',
      nextControlAction: 'answer-clarification'
    },
    {
      name: 'validation-blocked',
      state: makeState({
        outcome: 'validation-blocked',
        runtime: {
          validationIssues: [
            {
              kind: 'terraform-validate-failure',
              repairable: true,
              sourceCommand: 'terraform -chdir=terraform/payments-api validate',
              message: 'Missing required argument.'
            }
          ]
        }
      }),
      activeBlockerKind: 'validation',
      nextControlAction: 'resolve-validation',
      validationIssueKind: 'terraform-validate-failure'
    },
    {
      name: 'repair-budget-exhausted',
      state: makeState({
        outcome: 'repair-budget-exhausted',
        runtime: {
          repairAttempts: 2
        },
        maxRepairAttempts: 2
      }),
      activeBlockerKind: 'repair-budget',
      nextControlAction: 'manual-repair'
    },
    {
      name: 'no-safe-action',
      state: makeState({
        outcome: 'no-safe-action',
        turns: [makeTurn('inspect-target-files', { actionFamily: 'inspection' })],
        maxTurns: 3
      }),
      activeBlockerKind: 'no-safe-action',
      nextControlAction: 'inspect-readiness-or-targeting'
    },
    {
      name: 'turn-budget',
      state: makeState({
        outcome: 'no-safe-action',
        turns: [makeTurn('inspect-target-files', { actionFamily: 'inspection' })],
        maxTurns: 1
      }),
      activeBlockerKind: 'turn-budget',
      nextControlAction: 'rerun-with-larger-turn-budget'
    }
  ];

  for (const entry of cases) {
    const handoff = buildCompactAgentRunResult(entry.state).harness.plannerHandoff;
    assert.equal(handoff.activeBlocker.kind, entry.activeBlockerKind, entry.name);
    assert.equal(handoff.nextControlAction, entry.nextControlAction, entry.name);
    assert.equal(handoff.activeBlocker.validationIssueKind, entry.validationIssueKind ?? null, entry.name);
    assert.equal(handoff.activeBlocker.approvalSignalKind, entry.approvalSignalKind ?? null, entry.name);
  }
});
