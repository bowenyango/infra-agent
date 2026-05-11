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

test('rule-based planner proceeds with apply-edit-plan after explicit approval covers a high-risk rewrite', async () => {
  const preflight = await buildRunPreflight('update payments-api chart deeply', 'fixtures/sample-workspace', {
    approvedWriteRisks: ['high'],
    approvedWritePaths: ['charts/payments-api']
  });
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight: {
        ...preflight,
        assumptions: [],
        targetCandidates: [
          {
            kind: 'helm-chart',
            name: 'payments-api',
            path: 'charts/payments-api',
            score: 10,
            reasons: ['synthetic approval continuation test'],
            matchedEnvironmentHints: ['dev']
          }
        ]
      },
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: resolve('fixtures/sample-workspace/charts/payments-api/values.yaml'),
            content: await readFile(resolve('fixtures/sample-workspace/charts/payments-api/values.yaml'), 'utf8'),
            truncated: false
          }
        }
      ],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: {
        kind: 'helm-ingress',
        summary: 'Rewrite values file.',
        rationale: 'Synthetic rewrite continuation test.',
        writes: [
          {
            path: 'charts/payments-api/values.yaml',
            content: 'replicaCount: 99\n',
            reason: 'Rewrite test',
            mode: 'rewrite',
            risk: 'high'
          }
        ]
      }
    }
  });

  assert.equal(decision.action.kind, 'apply-edit-plan');
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
    assert.equal(
      result.runtime.knowledgeFacts?.units.some(unit => unit.extractionMethod === 'validation-diagnostic'),
      false
    );
    assert.equal(result.outcome, 'completed');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('apply-edit-plan execution emits diff preview before write', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-diff-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: 'Apply bounded values update.',
          rationale: 'Test diff preview output.',
          payload: {
            writes: [
              {
                path: 'charts/payments-api/values.yaml',
                content: 'replicaCount: 2\n',
                reason: 'Test write'
              }
            ]
          }
        }
      },
      workspaceRoot,
      null
    );

    assert.ok(execution);
    assert.deepEqual(
      execution?.executedTools.map(tool => tool.toolName),
      ['diff_preview', 'validate_yaml_syntax', 'write_file', 'validate_yaml_syntax']
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('apply-edit-plan validates YAML syntax before writing YAML files', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-yaml-preflight-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const valuesPath = join(workspaceRoot, 'charts/payments-api/values.yaml');
    const existingValues = await readFile(valuesPath, 'utf8');
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: 'Apply invalid YAML.',
          rationale: 'Test YAML syntax gate.',
          payload: {
            writes: [
              {
                path: 'charts/payments-api/values.yaml',
                content: 'ingress:\n  hosts: [\n',
                reason: 'Invalid YAML test write'
              }
            ]
          }
        }
      },
      workspaceRoot,
      null
    );

    assert.ok(execution);
    assert.deepEqual(
      execution?.executedTools.map(tool => tool.toolName),
      ['diff_preview', 'validate_yaml_syntax']
    );
    assert.equal(execution?.executedTools[1]?.output.result.exitCode, 1);
    assert.equal(await readFile(valuesPath, 'utf8'), existingValues);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('runSingleStep preserves YAML syntax failures found during apply-edit-plan', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-yaml-runtime-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'write invalid YAML to payments-api values',
      workspaceRoot,
      {
        name: 'invalid-yaml-test-planner',
        async decideNextAction({ runtime }) {
          if (runtime.validationIssues.length > 0) {
            return {
              confidence: 'high',
              action: {
                kind: 'stop',
                summary: 'Stop after YAML validation failure.',
                rationale: 'The runtime preserved the YAML syntax blocker.',
                payload: {
                  stopReason: 'validation-blocked'
                }
              }
            };
          }

          return {
            confidence: 'high',
            action: {
              kind: 'apply-edit-plan',
              summary: 'Apply invalid YAML.',
              rationale: 'Synthetic planner output for YAML validation.',
              payload: {
                writes: [
                  {
                    path: 'charts/payments-api/values.yaml',
                    content: 'ingress:\n  hosts: [\n',
                    reason: 'Invalid YAML test write'
                  }
                ]
              }
            }
          };
        }
      },
      'rule-based'
    );

    assert.equal(result.outcome, 'validation-blocked');
    assert.equal(result.runtime.validationIssues[0]?.kind, 'yaml-syntax-failure');
    assert.ok(result.runtime.validationResults.some(entry => entry.command.includes('yaml-parse')));
    assert.equal(result.runtime.appliedWrites.length, 0);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('runSingleStep gates unapproved edit execution even when the model asks to apply', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-approval-gate-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const valuesPath = join(workspaceRoot, 'charts/payments-api/values.yaml');
    const existingValues = await readFile(valuesPath, 'utf8');
    const write = {
      path: 'charts/payments-api/values.yaml',
      content: 'replicaCount: 99\n',
      reason: 'Synthetic unapproved high-risk rewrite.',
      mode: 'rewrite',
      risk: 'high'
    };
    const bypassModel = {
      name: 'approval-bypass-test-model',
      async decideNextAction() {
        return {
          action: {
            kind: 'apply-edit-plan',
            summary: 'Attempt to bypass approval.',
            rationale: 'Synthetic approval gate test.',
            payload: {
              actionFamily: 'helm-bounded-edit',
              writes: [write],
              editPlan: {
                kind: 'helm-ingress',
                summary: 'Synthetic high-risk rewrite.',
                rationale: 'Exercise execution-time approval gate.',
                writes: [write]
              }
            }
          },
          confidence: 'high'
        };
      }
    };

    const result = await runSingleStep(
      'update payments-api chart deeply',
      workspaceRoot,
      bypassModel
    );
    const compact = buildCompactAgentRunResult(result);

    assert.equal(result.outcome, 'approval-required');
    assert.equal(result.turns.length, 1);
    assert.equal(result.turns[0]?.decision.action.kind, 'apply-edit-plan');
    assert.equal(result.turns[0]?.execution?.status, 'skipped');
    assert.match(result.turns[0]?.execution?.reason ?? '', /Approval is required before executing this workspace mutation/);
    assert.equal(result.turns[0]?.execution?.executedTools.length, 0);
    assert.equal(result.runtime.appliedWrites.length, 0);
    assert.equal(result.runtime.approvalSignals[0]?.kind, 'write-approval-required');
    assert.equal(result.runtime.approvalSignals[0]?.path, 'charts/payments-api/values.yaml');
    assert.equal(compact.harness.plannerHandoff.activeBlocker.kind, 'approval');
    assert.equal(compact.harness.plannerHandoff.nextControlAction, 'request-approval');
    assert.equal(await readFile(valuesPath, 'utf8'), existingValues);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('runSingleStep gates native Pulumi stack config writes by default', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-tool-gate-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const stackPath = join(workspaceRoot, 'infra/payments-api/Pulumi.dev.yaml');
    const existingStackConfig = await readFile(stackPath, 'utf8');
    const pulumiWrite = {
      path: 'infra/payments-api/Pulumi.dev.yaml',
      content: 'config:\n  payments-api:imageTag: 1.2.3\n',
      reason: 'Synthetic native stack config update.'
    };
    const bypassModel = {
      name: 'pulumi-tool-approval-bypass-test-model',
      async decideNextAction() {
        return {
          action: {
            kind: 'apply-edit-plan',
            summary: 'Attempt to bypass native stack config approval.',
            rationale: 'Synthetic Pulumi tool-category gate test.',
            payload: {
              actionFamily: 'pulumi-bounded-stack-config',
              writes: [pulumiWrite],
              editPlan: {
                kind: 'pulumi-stack-config',
                summary: 'Synthetic Pulumi stack config write.',
                rationale: 'Exercise execution-time tool-category approval gate.',
                pulumiConfigOperations: [
                  {
                    projectRoot: 'infra/payments-api',
                    stackName: 'dev',
                    key: 'payments-api:imageTag',
                    value: '1.2.3'
                  }
                ],
                writes: [pulumiWrite]
              }
            }
          },
          confidence: 'high'
        };
      }
    };

    const result = await runSingleStep(
      'update pulumi dev stack for payments-api image tag to 1.2.3',
      workspaceRoot,
      bypassModel
    );

    assert.equal(result.outcome, 'approval-required');
    assert.equal(result.turns.length, 1);
    assert.equal(result.turns[0]?.execution?.status, 'skipped');
    assert.equal(result.turns[0]?.execution?.executedTools.length, 0);
    assert.equal(result.runtime.appliedWrites.length, 0);
    assert.equal(result.runtime.approvalSignals.length, 1);
    assert.equal(result.runtime.approvalSignals[0]?.kind, 'tool-category-approval-required');
    assert.equal(result.runtime.approvalSignals[0]?.toolCategory, 'native-stack-config-write');
    assert.equal(await readFile(stackPath, 'utf8'), existingStackConfig);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('runSingleStep records deterministic tool execution summaries', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-tool-summary-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add ingress to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    assert.ok(result.runtime.toolSummaries.some(summary => summary.summary.includes('Loaded Helm values for charts/payments-api')));
    assert.ok(result.runtime.toolSummaries.some(summary => summary.summary.includes('Previewed diff for charts/payments-api/values.yaml')));
    assert.ok(result.runtime.toolSummaries.every(summary => typeof summary.turnIndex === 'number'));
    assert.ok(result.runtime.toolSummaries.some(summary =>
      summary.toolName === 'helm_show_values'
      && summary.permission.category === 'native-cli-read'
      && summary.permission.externalCommand
    ));
    assert.ok(result.runtime.toolSummaries.some(summary =>
      summary.toolName === 'append_file'
      && summary.permission.category === 'workspace-write'
      && summary.permission.mutatesWorkspace
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('resolveQueryLoopConfig keeps bounded defaults and normalizes overrides', () => {
  assert.equal(resolveQueryLoopConfig().maxTurns, 6);
  assert.equal(resolveQueryLoopConfig().maxRepairAttempts, 2);
  assert.equal(resolveQueryLoopConfig().retrievedContextBudget.maxPackets, 5);
  assert.equal(resolveQueryLoopConfig().retrievedContextBudget.maxTokens, 1000);
  assert.equal(resolveQueryLoopConfig().retrievedContextBudget.maxFacts, 12);
  assert.equal(resolveQueryLoopConfig({ maxTurns: 2.8 }).maxTurns, 2);
  assert.equal(resolveQueryLoopConfig({ maxTurns: 0 }).maxTurns, 1);
  assert.equal(resolveQueryLoopConfig({ maxRepairAttempts: 3.8 }).maxRepairAttempts, 3);
  assert.equal(resolveQueryLoopConfig({ maxRepairAttempts: -1 }).maxRepairAttempts, 0);
  assert.equal(resolveQueryLoopConfig({
    retrievedContextBudget: {
      maxPackets: 2.8,
      maxTokens: 0,
      maxExcerptChars: 240.8,
      maxFacts: 4.8
    }
  }).retrievedContextBudget.maxPackets, 2);
  assert.equal(resolveQueryLoopConfig({
    retrievedContextBudget: {
      maxPackets: 2.8,
      maxTokens: 0,
      maxExcerptChars: 240.8,
      maxFacts: 4.8
    }
  }).retrievedContextBudget.maxTokens, 1);
  assert.equal(resolveQueryLoopConfig({
    retrievedContextBudget: {
      maxPackets: 2.8,
      maxTokens: 0,
      maxExcerptChars: 240.8,
      maxFacts: 4.8
    }
  }).retrievedContextBudget.maxExcerptChars, 240);
  assert.equal(resolveQueryLoopConfig({
    retrievedContextBudget: {
      maxFacts: 4.8
    }
  }).retrievedContextBudget.maxFacts, 4);
});

test('runSingleStep respects configured zero repair attempts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-repair-budget-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/repair-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add ingress to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based',
      undefined,
      {
        maxRepairAttempts: 0
      }
    );

    assert.equal(result.config.maxRepairAttempts, 0);
    assert.equal(result.runtime.maxRepairAttempts, 0);
    assert.equal(result.runtime.repairAttempts, 0);
    assert.equal(result.outcome, 'repair-budget-exhausted');
    assert.ok(result.runtime.knowledgeFacts?.units.some(unit =>
      unit.unitType === 'diagnostic'
      && unit.extractionMethod === 'validation-diagnostic'
      && unit.privacyScope === 'private-run'
    ));
    const compact = buildCompactAgentRunResult(result);
    assert.ok(compact.knowledgeFacts.units.some(unit =>
      unit.unitType === 'diagnostic'
      && unit.extractionMethod === 'validation-diagnostic'
    ));
    assert.equal(compact.harness.queryConfig.maxRepairAttempts, 0);
    assert.deepEqual(compact.harness.repairBudget, {
      attemptsUsed: 0,
      maxAttempts: 0,
      attemptsRemaining: 0,
      exhausted: true
    });
    assert.equal(compact.harness.loopBudget.exhausted, false);
    assert.ok(compact.harness.loopBudget.turnsRemaining > 0);
    assert.ok(compact.resultCard.some(line => /Repair activity: 0\/0 bounded repair attempt\(s\) used/i.test(line)));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('runSingleStep respects the configured maximum turn count', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-turn-budget-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add ingress to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based',
      undefined,
      {
        maxTurns: 1,
        retrievedContextBudget: {
          maxPackets: 2,
          maxTokens: 500,
          maxFacts: 3
        }
      }
    );

    assert.equal(result.turns.length, 1);
    assert.equal(result.outcome, 'no-safe-action');
    assert.equal(result.plannerConfig?.requestedMode, 'rule-based');
    assert.equal(result.plannerConfig?.effectiveMode, 'rule-based');
    assert.equal(result.plannerConfig?.clientName, 'rule-based-model-client');
    assert.equal(result.plannerConfig?.llm, null);
    assert.ok(result.runtime.toolSummaries.some(summary => summary.actionKind === 'inspect-target-files'));
    const compact = buildCompactAgentRunResult(result);
    assert.equal(compact.harness.maxTurns, 1);
    assert.deepEqual(compact.harness.plannerConfig, {
      requestedMode: 'rule-based',
      effectiveMode: 'rule-based',
      clientName: 'rule-based-model-client',
      fallbackReason: null,
      llm: null
    });
    assert.equal(compact.harness.queryConfig.maxTurns, 1);
    assert.equal(compact.harness.queryConfig.maxRepairAttempts, 2);
    assert.equal(compact.harness.queryConfig.retrievedContextBudget.maxPackets, 2);
    assert.equal(compact.harness.queryConfig.retrievedContextBudget.maxTokens, 500);
    assert.equal(compact.harness.queryConfig.retrievedContextBudget.maxFacts, 3);
    assert.equal(compact.knowledgeFacts.kind, 'infra-agent.knowledge-facts-summary');
    assert.equal(compact.knowledgeFacts.maxFacts, 3);
    assert.equal(compact.knowledgeFacts.mutationAllowed, false);
    assert.ok(compact.knowledgeFacts.totalFactCount > 0);
    assert.ok(compact.knowledgeFacts.includedFactCount <= 3);
    assert.equal(
      compact.knowledgeFacts.uncheckedSourceCount,
      compact.knowledgeFacts.sources.filter(source => source.freshness === 'unchecked').length
    );
    assert.ok(compact.knowledgeFacts.facts.every(fact =>
      fact.confidence !== 'high'
      || compact.knowledgeFacts.sources.find(source => source.id === fact.sourceId)?.freshness !== 'unchecked'
    ));
    assert.equal(compact.harness.stateSummary.knowledgeFactCount, compact.knowledgeFacts.totalFactCount);
    assert.deepEqual(compact.handoffCheckpoint.budgets.knowledgeFacts, {
      includedCount: compact.knowledgeFacts.includedFactCount,
      omittedCount: compact.knowledgeFacts.omittedFactCount
    });
    assert.doesNotMatch(JSON.stringify(compact.knowledgeFacts), /"content"\s*:|contentHash|fetchedAt|"\$schema"/);
    assert.deepEqual(compact.harness.loopBudget, {
      turnsUsed: 1,
      maxTurns: 1,
      turnsRemaining: 0,
      exhausted: true
    });
    assert.deepEqual(compact.harness.repairBudget, {
      attemptsUsed: 0,
      maxAttempts: 2,
      attemptsRemaining: 2,
      exhausted: false
    });
    assert.equal(compact.harness.plannerHandoff.activeBlocker.kind, 'turn-budget');
    assert.equal(compact.harness.plannerHandoff.nextControlAction, 'rerun-with-larger-turn-budget');
    assert.equal(compact.harness.plannerHandoff.lastAction.kind, 'inspect-target-files');
    assert.equal(compact.harness.plannerHandoff.lastAction.executionStatus, 'completed');
    assert.equal(compact.harness.lifecycleEvents.maxEntries, 12);
    assert.equal(compact.harness.lifecycleEvents.totalCount, compact.harness.lifecycleEvents.events.length);
    assert.equal(compact.harness.lifecycleEvents.includedCount, compact.harness.lifecycleEvents.events.length);
    assert.equal(compact.harness.lifecycleEvents.omittedCount, 0);
    assert.equal(compact.harness.lifecycleEvents.eventCounts['query-started'], 1);
    assert.equal(compact.harness.lifecycleEvents.eventCounts.decision, 1);
    assert.ok(compact.harness.lifecycleEvents.eventCounts['tool-execution'] >= 1);
    assert.equal(compact.harness.lifecycleEvents.eventCounts.terminal, 1);
    assert.equal(compact.harness.lifecycleEvents.events[0]?.event, 'query-started');
    assert.ok(compact.harness.lifecycleEvents.events.some(event =>
      event.event === 'decision'
      && event.actionKind === 'inspect-target-files'
    ));
    assert.ok(compact.harness.lifecycleEvents.events.some(event =>
      event.event === 'tool-execution'
      && event.toolCount > 0
    ));
    assert.equal(compact.harness.lifecycleEvents.events.at(-1)?.event, 'terminal');
    assert.equal(compact.harness.lifecycleEvents.events.at(-1)?.outcome, 'no-safe-action');
    assert.ok(compact.resultCard.some(line => /Turn budget: 1\/1 turn\(s\) used; exhausted/i.test(line)));
    assert.ok(compact.resultCard.some(line =>
      /Targeting: helm charts\/payments-api score=.*candidates .*; ambiguity none; next inspect-selected-target/i.test(line)
    ));
    assert.ok(compact.resultCard.some(line =>
      /Work plan: blocked; current handoff\/blocked; completed 3\/6; blocked 1; skipped 0; next rerun-with-larger-turn-budget/i.test(line)
    ));
    assert.equal(compact.harness.turnTraceLimit, 10);
    assert.equal(compact.harness.turnTraceOmittedCount, 0);
    assert.deepEqual(compact.harness.turnTraceBudget, {
      maxEntries: 10,
      totalCount: 1,
      includedCount: 1,
      omittedCount: 0,
      firstIncludedTurnIndex: 0,
      lastIncludedTurnIndex: 0,
      preservedWindow: 'head'
    });
    assert.equal(compact.knowledgeContext.maxPackets, 2);
    assert.equal(compact.knowledgeContext.maxTokens, 500);
    assert.equal(compact.harness.turnTrace.length, 1);
    assert.equal(compact.harness.turnTrace[0]?.actionKind, 'inspect-target-files');
    assert.equal(compact.harness.turnTrace[0]?.terminal, false);
    assert.equal(compact.harness.turnTrace[0]?.executionStatus, 'completed');
    assert.equal(compact.harness.turnTrace[0]?.executionReason, null);
    assert.ok((compact.harness.turnTrace[0]?.executedToolCount ?? 0) > 0);
    assert.equal(compact.harness.toolTrace.maxEntries, 8);
    assert.equal(compact.harness.toolTrace.totalCount, result.runtime.toolSummaries.length);
    assert.equal(compact.harness.toolTrace.entries.length, Math.min(result.runtime.toolSummaries.length, 8));
    assert.equal(compact.harness.toolTrace.includedCount, compact.harness.toolTrace.entries.length);
    assert.equal(compact.harness.toolTrace.omittedCount, Math.max(0, result.runtime.toolSummaries.length - 8));
    assert.equal(compact.harness.toolTrace.firstIncludedTurnIndex, compact.harness.toolTrace.entries[0]?.turnIndex ?? null);
    assert.equal(compact.harness.toolTrace.lastIncludedTurnIndex, compact.harness.toolTrace.entries.at(-1)?.turnIndex ?? null);
    assert.equal(compact.harness.toolTrace.preservedWindow, 'tail');
    assert.equal(compact.harness.toolTrace.latestTurnIndex, result.runtime.toolSummaries.at(-1)?.turnIndex ?? null);
    assert.ok(Object.values(compact.harness.toolTrace.permissionCategoryCounts).reduce((total, count) => total + count, 0) >= compact.harness.toolTrace.includedCount);
    assert.ok(compact.harness.toolTrace.entries.some(entry => entry.actionKind === 'inspect-target-files'));
    assert.ok(compact.harness.toolTrace.entries.every(entry => entry.toolName.length > 0));
    assert.equal(compact.harness.toolPermissionSummary.totalToolCount, result.runtime.toolSummaries.length);
    assert.ok(compact.harness.toolPermissionSummary.externalCommandToolCount > 0);
    assert.equal(compact.harness.stateSummary.observationCount, result.runtime.observations.length);
    assert.equal(compact.harness.stateSummary.toolSummaryCount, result.runtime.toolSummaries.length);
    assert.equal(compact.harness.stateSummary.appliedWriteCount, result.runtime.appliedWrites.length);
    assert.equal(compact.harness.stateSummary.validationResultCount, result.runtime.validationResults.length);
    assert.equal(compact.harness.stateSummary.validationIssueCount, result.runtime.validationIssues.length);
    assert.equal(compact.harness.stateSummary.approvalSignalCount, result.runtime.approvalSignals.length);
    assert.equal(compact.harness.stateSummary.retrievedContextCount, result.runtime.retrievedContext.length);
    assert.ok(compact.harness.stateSummary.semanticFactCount > 0);
    assert.equal(compact.harness.targeting.schemaVersion, 1);
    assert.equal(compact.harness.targeting.source, 'derived-run-preflight');
    assert.equal(compact.harness.targeting.compact, true);
    assert.equal(compact.harness.targeting.mutationAllowed, false);
    assert.equal(compact.harness.targeting.candidateCount, result.preflight.targetCandidates.length);
    assert.equal(compact.harness.targeting.includedCount, compact.harness.targeting.candidates.length);
    assert.equal(compact.harness.targeting.omittedCount, Math.max(0, result.preflight.targetCandidates.length - 5));
    assert.equal(compact.harness.targeting.selectedTarget?.path, 'charts/payments-api');
    assert.equal(compact.harness.targeting.selectedTarget?.domain, 'helm');
    assert.equal(compact.harness.targeting.candidates[0]?.rank, 1);
    assert.equal(compact.harness.targeting.candidates[0]?.selected, true);
    assert.equal(compact.harness.targeting.candidates[0]?.domain, 'helm');
    assert.ok((compact.harness.targeting.candidates[0]?.reasons.length ?? 0) <= 3);
    assert.ok((compact.harness.targeting.candidates[0]?.details.length ?? 0) <= 3);
    assert.equal(compact.harness.targeting.flags.missingEnvironment, false);
    assert.equal(compact.harness.targeting.flags.missingService, false);
    assert.equal(compact.harness.targeting.recommendedAction, 'inspect-selected-target');
    assert.ok(compact.validation.selectedPlan.length > 0);
    assert.ok(compact.validation.selectedPlan.every(entry => entry.kind === 'helm'));
    assert.ok(compact.validation.selectedPlan.every(entry => entry.target === 'charts/payments-api'));
    assert.ok(compact.validation.selectedPlan.every(entry => entry.commandCount === entry.commands.length));
    assert.ok(compact.validation.selectedPlan.every(entry => entry.executedCommandCount === 0));
    assert.ok(compact.validation.selectedPlan.every(entry => entry.failedCommandCount === 0));
    assert.ok(compact.validation.selectedPlan.every(entry => typeof entry.validatorAvailable === 'boolean'));
    assert.equal(compact.knowledgeContext.totalPacketCount, result.runtime.retrievedContext.length);
    assert.equal(
      compact.knowledgeContext.includedPacketCount,
      compact.knowledgeContext.packets.filter(packet => packet.included).length
    );
    assert.equal(compact.readiness.status, 'pass');
    assert.equal(compact.harness.workPlan.schemaVersion, 1);
    assert.equal(compact.harness.workPlan.source, 'derived-agent-run-state');
    assert.equal(compact.harness.workPlan.compact, true);
    assert.equal(compact.harness.workPlan.mutationAllowed, false);
    assert.equal(compact.harness.workPlan.status, 'blocked');
    assert.equal(compact.harness.workPlan.blockerKind, 'turn-budget');
    assert.equal(compact.harness.workPlan.nextControlAction, compact.harness.plannerHandoff.nextControlAction);
    assert.equal(compact.harness.workPlan.totalStepCount, 6);
    assert.equal(compact.harness.workPlan.includedCount, compact.harness.workPlan.steps.length);
    assert.equal(compact.harness.workPlan.omittedCount, 0);
    assert.equal(compact.harness.workPlan.currentStepIndex, 5);
    assert.equal(compact.harness.workPlan.skippedStepCount, 0);
    assert.deepEqual(
      compact.harness.workPlan.steps.map(step => step.kind),
      ['readiness', 'targeting', 'inspection', 'edit', 'validation', 'handoff']
    );
    assert.ok(compact.harness.workPlan.steps.some(step =>
      step.kind === 'inspection'
      && step.status === 'completed'
      && step.actionKind === 'inspect-target-files'
    ));
    assert.ok(compact.harness.workPlan.steps.some(step =>
      step.kind === 'handoff'
      && step.status === 'blocked'
    ));
    assert.deepEqual(compact.handoffCheckpoint, {
      schemaVersion: 1,
      source: 'agent-result',
      compact: true,
      primaryArtifact: 'agent --json',
      debugArtifact: 'agent --json-full',
      mutationAllowed: false,
      exclusions: {
        rawRuntimeIncluded: false,
        rawPreflightIncluded: false,
        rawToolOutputIncluded: false,
        rawPromptIncluded: false,
        rawKnowledgeExcerptIncluded: false
      },
      summary: {
        outcome: 'no-safe-action',
        activeBlocker: 'turn-budget',
        nextControlAction: 'rerun-with-larger-turn-budget',
        readinessStatus: 'pass',
        validationStatus: 'not run yet',
        validationIssueCount: 0,
        identityConflictCount: 0,
        approvalContinuationRequired: false,
        changedFileCount: 0
      },
      budgets: {
        turnTrace: {
          includedCount: compact.harness.turnTraceBudget.includedCount,
          omittedCount: compact.harness.turnTraceBudget.omittedCount
        },
        lifecycleEvents: {
          includedCount: compact.harness.lifecycleEvents.includedCount,
          omittedCount: compact.harness.lifecycleEvents.omittedCount
        },
        toolTrace: {
          includedCount: compact.harness.toolTrace.includedCount,
          omittedCount: compact.harness.toolTrace.omittedCount
        },
        workPlan: {
          includedCount: compact.harness.workPlan.includedCount,
          omittedCount: compact.harness.workPlan.omittedCount
        },
        targeting: {
          includedCount: compact.harness.targeting.includedCount,
          omittedCount: compact.harness.targeting.omittedCount
        },
        validationCommands: {
          includedCount: compact.validation.commands.entries.length,
          omittedCount: compact.validation.commands.omittedCount
        },
        validationIssues: {
          includedCount: compact.validation.issues.length,
          omittedCount: compact.validation.issueDetails.omittedCount
        },
        validationIssueGroups: {
          includedCount: compact.validation.issueSummary.groups.length,
          omittedCount: compact.validation.issueSummary.omittedGroupCount
        },
        validationSafetyBlockers: {
          includedCount: compact.validation.safetyBlockers.entries.length,
          omittedCount: compact.validation.safetyBlockers.omittedCount
        },
        identityConflicts: {
          includedCount: compact.validation.identityConflictSummary.includedCount,
          omittedCount: compact.validation.identityConflictSummary.omittedCount
        },
        approvalSignals: {
          includedCount: compact.approval.signals.length,
          omittedCount: Math.max(0, compact.approval.resume.signalCount - compact.approval.signals.length)
        },
        knowledgePackets: {
          includedCount: compact.knowledgeContext.includedPacketCount,
          omittedCount: compact.knowledgeContext.omittedPacketCount,
          includedTokenEstimate: compact.knowledgeContext.includedTokenEstimate,
          omittedTokenEstimate: compact.knowledgeContext.omittedTokenEstimate
        },
        knowledgeFacts: {
          includedCount: compact.knowledgeFacts.includedFactCount,
          omittedCount: compact.knowledgeFacts.omittedFactCount
        },
        knowledgeUnits: {
          includedCount: compact.knowledgeFacts.includedUnitCount,
          omittedCount: compact.knowledgeFacts.omittedUnitCount
        }
      },
      continuation: {
        required: true,
        reason: 'turn-budget',
        nextControlAction: 'rerun-with-larger-turn-budget',
        approvalRequired: false,
        command: null,
        compactCommand: null,
        debugCommand: null,
        mutationAllowed: false
      },
      durableSections: [
        'root',
        'harness',
        'validation',
        'approval',
        'knowledge',
        'readiness',
        'result-card'
      ]
    });
    assert.ok(compact.resultCard.some(line => /Readiness: pass/i.test(line)));
    assert.match(compact.readiness.doctorCommand, / doctor /);
    assert.deepEqual(compact.readiness.plannerProviderCatalog, buildPlannerProviderCatalogDiscovery());
    assert.ok(compact.readiness.checks.some(check =>
      check.name === 'planner'
      && check.status === 'pass'
      && check.detail === 'rule-based-model-client'
    ));
    assert.ok(compact.readiness.checks.some(check =>
      check.name === 'validator:helm'
      && check.status === 'pass'
    ));
    assert.ok(!compact.readiness.checks.some(check => check.name === 'validator:pulumi'));
    assert.ok(!compact.readiness.checks.some(check => check.name === 'validator:terraform'));
    assert.equal(Object.hasOwn(compact, 'runtime'), false);
    assert.equal(Object.hasOwn(compact, 'preflight'), false);
    assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');

    const fallbackCompact = buildCompactAgentRunResult({
      ...result,
      modelName: 'rule-based-fallback'
    });
    assert.equal(fallbackCompact.readiness.status, 'warn');
    assert.ok(fallbackCompact.resultCard.some(line => /Readiness: warn.*planner/i.test(line)));
    assert.match(fallbackCompact.suggestedCommands[0] ?? '', / doctor .*--json/);
    assert.ok(fallbackCompact.readiness.checks.some(check =>
      check.name === 'planner'
      && check.status === 'warn'
      && /fallback/.test(check.message)
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
