import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { runSingleStep } from '../../src/agent/run-single-step.ts';
import { buildRunPreflight } from '../../src/agent/build-run-preflight.ts';
import {
  buildCompactAgentRunResult,
  buildIdentityConflictIncidentReport,
  summarizeAgentSnapshot,
  summarizeRecommendedNextSteps,
  summarizeResultCard,
  summarizeSuggestedCommands
} from '../../src/cli/output.ts';
import { buildPlannerProviderCatalogDiscovery } from '../../src/cli/planner-provider-catalog.ts';
import { parseCompactAgentRunResult } from '../../src/cli/agent-result-contract.ts';
import { resolveQueryLoopConfig } from '../../src/query-config.ts';
import { buildKnowledgePack } from '../../src/knowledge/pack.ts';

test('runSingleStep returns approval-required outcome for approval clarification turns', async () => {
  const approvalModel = {
    name: 'approval-test-model',
    async decideNextAction() {
      return {
        confidence: 'high',
        action: {
          kind: 'ask-for-clarification',
          summary: 'Approval required',
          rationale: 'Synthetic approval gate.',
          payload: {
            clarificationKind: 'approval-required',
            questions: ['Proceed with this rewrite?']
          }
        }
      };
    }
  };

  const result = await runSingleStep(
    'add ingress to payments-api dev chart',
    'fixtures/sample-workspace',
    approvalModel
  );

  assert.equal(result.outcome, 'approval-required');
});

test('summarizeRecommendedNextSteps suggests approval continuation for approval-required runs', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const steps = summarizeRecommendedNextSteps({
    modelName: 'test-model',
    outcome: 'approval-required',
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
      lastEditPlan: null
    },
    turns: [
      {
        index: 0,
        decision: {
          confidence: 'high',
          action: {
            kind: 'ask-for-clarification',
            summary: 'Approval required',
            rationale: 'High-risk write needs approval.',
            payload: {
              clarificationKind: 'approval-required',
              questions: ['Proceed with this rewrite?']
            }
          }
        },
        runtimeSnapshot: {
          task: preflight.task,
          preflight,
          observations: [],
          appliedWrites: [],
          validationResults: [],
          validationIssues: [],
          approvalSignals: [],
          repairAttempts: 0,
          lastEditPlan: null
        }
      }
    ]
  });

  assert.ok(steps.some(step => /approve the flagged write risk, write path, or tool category/i.test(step)));
  assert.ok(steps.some(step => /--approve-write-risk/i.test(step)));
});

test('summarizeSuggestedCommands includes approval continuation flags for approval-required runs', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const queryConfig = resolveQueryLoopConfig({
    maxTurns: 3,
    maxRepairAttempts: 0,
    retrievedContextBudget: {
      maxPackets: 2,
      maxTokens: 500,
      maxFacts: 4
    }
  });
  const state = {
    modelName: 'test-model',
    outcome: 'approval-required',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [
        {
          kind: 'write-approval-required',
          path: 'charts/payments-api/values.yaml',
          risk: 'high',
          message: 'Approval required.'
        }
      ],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: [],
    config: queryConfig
  };
  const commands = summarizeSuggestedCommands(state);
  const compact = buildCompactAgentRunResult(state);

  assert.ok(commands[0]?.includes('agent'));
  assert.ok(commands[0]?.includes('--max-turns 3'));
  assert.ok(commands[0]?.includes('--max-repair-attempts 0'));
  assert.ok(commands[0]?.includes('--context-packet-limit 2'));
  assert.ok(commands[0]?.includes('--context-token-budget 500'));
  assert.ok(commands[0]?.includes('--context-fact-limit 4'));
  assert.ok(commands[0]?.includes('--approve-write-risk high'));
  assert.ok(commands[0]?.includes('--approve-write-path "charts/payments-api/values.yaml"'));
  assert.equal(compact.approval.resume.continuationRequired, true);
  assert.equal(compact.approval.resume.signalCount, 1);
  assert.equal(compact.approval.resume.command, commands[0]);
  assert.equal(compact.approval.resume.compactCommand, `${commands[0]} --json`);
  assert.equal(compact.approval.resume.debugCommand, `${commands[0]} --json-full`);
  assert.equal(compact.handoffCheckpoint.continuation.command, compact.approval.resume.command);
  assert.equal(compact.handoffCheckpoint.continuation.compactCommand, compact.approval.resume.compactCommand);
  assert.equal(compact.handoffCheckpoint.continuation.debugCommand, compact.approval.resume.debugCommand);
  assert.deepEqual(compact.approval.resume.primarySignal, {
    kind: 'write-approval-required',
    message: 'Approval required.',
    path: 'charts/payments-api/values.yaml',
    risk: 'high',
    toolCategory: null
  });
  assert.equal(compact.approval.resume.additionalSignalCount, 0);
  assert.deepEqual(compact.approval.resume.additionalWriteRisks, []);
  assert.deepEqual(compact.approval.resume.additionalWritePaths, []);
  assert.deepEqual(compact.approval.resume.additionalToolCategories, []);
  assert.deepEqual(compact.approval.resume.pendingScope, {
    signalCount: 1,
    includedSignalCount: 1,
    omittedSignalCount: 0,
    additionalSignalCount: 0,
    writeRiskCount: 1,
    writePathCount: 1,
    toolCategoryCount: 0
  });
  assert.deepEqual(compact.approval.grants, {
    approvedWriteRisks: [],
    approvedWritePaths: [],
    approvedToolCategories: [],
    writePathScope: 'all',
    hasExplicitApproval: false
  });
  assert.deepEqual(compact.approval.resume.writeRisks, ['high']);
  assert.deepEqual(compact.approval.resume.writePaths, ['charts/payments-api/values.yaml']);
  assert.deepEqual(compact.approval.resume.toolCategories, []);
  assert.equal(compact.harness.plannerHandoff.activeBlocker.kind, 'approval');
  assert.equal(compact.harness.plannerHandoff.activeBlocker.approvalSignalKind, 'write-approval-required');
  assert.equal(compact.harness.plannerHandoff.nextControlAction, 'request-approval');
  assert.equal(Object.hasOwn(compact.harness.plannerHandoff, 'payload'), false);
  assert.equal(Object.hasOwn(compact.harness.plannerHandoff, 'runtime'), false);
  assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      approval: {
        ...compact.approval,
        grants: {
          approvedWriteRisks: ['high'],
          approvedWritePaths: ['charts/payments-api'],
          approvedToolCategories: [],
          writePathScope: 'scoped',
          hasExplicitApproval: true
        }
      }
    }),
    /approval\.signals must not repeat approval\.grants-covered scope/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      suggestedCommands: compact.suggestedCommands.filter(command => command !== compact.approval.resume.command)
    }),
    /suggestedCommands must include approval\.resume\.command/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      approval: {
        ...compact.approval,
        resume: {
          ...compact.approval.resume,
          primarySignal: {
            ...compact.approval.resume.primarySignal,
            path: 'charts/payments-api/other-values.yaml'
          }
        }
      }
    }),
    /approval\.resume\.primarySignal.*first included approval signal/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      handoffCheckpoint: {
        ...compact.handoffCheckpoint,
        continuation: {
          ...compact.handoffCheckpoint.continuation,
          command: compact.approval.resume.command?.replace(/ --approve-write-path "charts\/payments-api\/values\.yaml"/, '') ?? null,
          compactCommand: compact.approval.resume.compactCommand?.replace(/ --approve-write-path "charts\/payments-api\/values\.yaml"/, '') ?? null,
          debugCommand: compact.approval.resume.debugCommand?.replace(/ --approve-write-path "charts\/payments-api\/values\.yaml"/, '') ?? null
        }
      },
      approval: {
        ...compact.approval,
        resume: {
          ...compact.approval.resume,
          command: compact.approval.resume.command?.replace(/ --approve-write-path "charts\/payments-api\/values\.yaml"/, '') ?? null,
          compactCommand: compact.approval.resume.compactCommand?.replace(/ --approve-write-path "charts\/payments-api\/values\.yaml"/, '') ?? null,
          debugCommand: compact.approval.resume.debugCommand?.replace(/ --approve-write-path "charts\/payments-api\/values\.yaml"/, '') ?? null
        }
      }
    }),
    /approval\.resume\.command.*write approval scope/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      handoffCheckpoint: {
        ...compact.handoffCheckpoint,
        continuation: {
          ...compact.handoffCheckpoint.continuation,
          compactCommand: compact.approval.resume.command
        }
      }
    }),
    /handoffCheckpoint\.continuation JSON commands/
  );
  assert.throws(
    () => {
      const dropBudgetFlag = (command) => command?.replace(/ --context-token-budget 500/g, '') ?? null;
      return parseCompactAgentRunResult({
        ...compact,
        handoffCheckpoint: {
          ...compact.handoffCheckpoint,
          continuation: {
            ...compact.handoffCheckpoint.continuation,
            command: dropBudgetFlag(compact.handoffCheckpoint.continuation.command),
            compactCommand: dropBudgetFlag(compact.handoffCheckpoint.continuation.compactCommand),
            debugCommand: dropBudgetFlag(compact.handoffCheckpoint.continuation.debugCommand)
          }
        },
        approval: {
          ...compact.approval,
          resume: {
            ...compact.approval.resume,
            command: dropBudgetFlag(compact.approval.resume.command),
            compactCommand: dropBudgetFlag(compact.approval.resume.compactCommand),
            debugCommand: dropBudgetFlag(compact.approval.resume.debugCommand)
          }
        }
      });
    },
    /approval\.resume\.command must include query config flags/
  );
  assert.throws(
    () => {
      const duplicateBudgetFlag = (command) => command?.replace(/--max-turns 3/g, '--max-turns 3 --max-turns 9') ?? null;
      return parseCompactAgentRunResult({
        ...compact,
        handoffCheckpoint: {
          ...compact.handoffCheckpoint,
          continuation: {
            ...compact.handoffCheckpoint.continuation,
            command: duplicateBudgetFlag(compact.handoffCheckpoint.continuation.command),
            compactCommand: duplicateBudgetFlag(compact.handoffCheckpoint.continuation.compactCommand),
            debugCommand: duplicateBudgetFlag(compact.handoffCheckpoint.continuation.debugCommand)
          }
        },
        approval: {
          ...compact.approval,
          resume: {
            ...compact.approval.resume,
            command: duplicateBudgetFlag(compact.approval.resume.command),
            compactCommand: duplicateBudgetFlag(compact.approval.resume.compactCommand),
            debugCommand: duplicateBudgetFlag(compact.approval.resume.debugCommand)
          }
        }
      });
    },
    /approval\.resume\.command must include query config flags/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      approval: {
        ...compact.approval,
        resume: {
          ...compact.approval.resume,
          compactCommand: compact.approval.resume.command
        }
      }
    }),
    /approval\.resume JSON commands/
  );
});

test('summarizeSuggestedCommands includes tool category approval continuation scope', async () => {
  const preflight = await buildRunPreflight('update pulumi dev stack for payments-api image tag to 1.2.3', 'fixtures/sample-workspace');
  const queryConfig = resolveQueryLoopConfig({
    maxTurns: 4,
    maxRepairAttempts: 1,
    retrievedContextBudget: {
      maxPackets: 3,
      maxTokens: 700,
      maxFacts: 5
    }
  });
  const state = {
    modelName: 'llm-model-client:codex-infra-test',
    outcome: 'approval-required',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [
        {
          kind: 'tool-category-approval-required',
          toolCategory: 'native-stack-config-write',
          message: 'Approval required.'
        }
      ],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: [],
    config: queryConfig,
    plannerConfig: {
      requestedMode: 'llm',
      effectiveMode: 'llm',
      clientName: 'llm-model-client:codex-infra-test',
      fallbackReason: null,
      llm: {
        provider: 'openai-compatible',
        model: 'codex-infra-test',
        baseUrl: 'https://models.example.test/v1',
        apiKeySource: 'OPENAI_API_KEY',
        providerSource: 'cli',
        modelSource: 'cli',
        baseUrlSource: 'cli'
      }
    }
  };
  const commands = summarizeSuggestedCommands(state);
  const compact = buildCompactAgentRunResult(state);

  assert.ok(commands[0]?.includes('--max-turns 4'));
  assert.ok(commands[0]?.includes('--planner llm'));
  assert.ok(commands[0]?.includes('--llm-provider openai-compatible'));
  assert.ok(commands[0]?.includes('--model "codex-infra-test"'));
  assert.ok(commands[0]?.includes('--openai-base-url "https://models.example.test/v1"'));
  assert.ok(commands[0]?.includes('--max-repair-attempts 1'));
  assert.ok(commands[0]?.includes('--context-packet-limit 3'));
  assert.ok(commands[0]?.includes('--context-token-budget 700'));
  assert.ok(commands[0]?.includes('--context-fact-limit 5'));
  assert.ok(commands[0]?.includes('--approve-tool-category native-stack-config-write'));
  assert.equal(compact.approval.resume.continuationRequired, true);
  assert.equal(compact.approval.resume.command, commands[0]);
  assert.equal(compact.approval.resume.compactCommand, `${commands[0]} --json`);
  assert.equal(compact.approval.resume.debugCommand, `${commands[0]} --json-full`);
  assert.equal(compact.harness.plannerConfig.llm?.modelSource, 'cli');
  assert.deepEqual(compact.harness.plannerConfig.llm?.capabilities, {
    transport: 'chat-completions',
    endpointPath: '/chat/completions',
    responseFormat: 'json-object',
    supportsJsonObject: true,
    supportsStreaming: false
  });
  assert.match(compact.readiness.doctorCommand, /--llm-provider openai-compatible/);
  assert.match(compact.readiness.doctorCommand, /--model "codex-infra-test"/);
  assert.match(compact.readiness.doctorCommand, /--openai-base-url "https:\/\/models\.example\.test\/v1"/);
  assert.doesNotMatch(compact.readiness.doctorCommand, /--planner llm/);
  assert.deepEqual(compact.readiness.plannerProviderCatalog, buildPlannerProviderCatalogDiscovery());
  assert.doesNotMatch(JSON.stringify(compact.readiness.plannerProviderCatalog), /codex-infra-test/);
  assert.doesNotMatch(JSON.stringify(compact.readiness.plannerProviderCatalog), /models\.example\.test/);
  assert.doesNotMatch(JSON.stringify(compact.readiness.plannerProviderCatalog), /OPENAI_API_KEY/);
  assert.ok(compact.resultCard.some(line => /Planner config: openai-compatible\/codex-infra-test.*transport=chat-completions.*streaming=disabled/i.test(line)));
  assert.equal(compact.handoffCheckpoint.continuation.command, compact.approval.resume.command);
  assert.equal(compact.handoffCheckpoint.continuation.compactCommand, compact.approval.resume.compactCommand);
  assert.equal(compact.handoffCheckpoint.continuation.debugCommand, compact.approval.resume.debugCommand);
  assert.deepEqual(compact.approval.resume.primarySignal, {
    kind: 'tool-category-approval-required',
    message: 'Approval required.',
    path: null,
    risk: null,
    toolCategory: 'native-stack-config-write'
  });
  assert.equal(compact.approval.resume.additionalSignalCount, 0);
  assert.deepEqual(compact.approval.resume.additionalWriteRisks, []);
  assert.deepEqual(compact.approval.resume.additionalWritePaths, []);
  assert.deepEqual(compact.approval.resume.additionalToolCategories, []);
  assert.deepEqual(compact.approval.resume.pendingScope, {
    signalCount: 1,
    includedSignalCount: 1,
    omittedSignalCount: 0,
    additionalSignalCount: 0,
    writeRiskCount: 0,
    writePathCount: 0,
    toolCategoryCount: 1
  });
  assert.deepEqual(compact.approval.resume.writeRisks, []);
  assert.deepEqual(compact.approval.resume.writePaths, []);
  assert.deepEqual(compact.approval.resume.toolCategories, ['native-stack-config-write']);
  assert.equal(compact.harness.plannerHandoff.activeBlocker.kind, 'approval');
  assert.equal(compact.harness.plannerHandoff.activeBlocker.approvalSignalKind, 'tool-category-approval-required');
  assert.equal(compact.harness.plannerHandoff.nextControlAction, 'request-approval');
  assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
  assert.throws(
    () => {
      const dropModelFlag = command => command?.replace(/ --model "codex-infra-test"/g, '') ?? null;
      return parseCompactAgentRunResult({
        ...compact,
        approval: {
          ...compact.approval,
          resume: {
            ...compact.approval.resume,
            command: dropModelFlag(compact.approval.resume.command),
            compactCommand: dropModelFlag(compact.approval.resume.compactCommand),
            debugCommand: dropModelFlag(compact.approval.resume.debugCommand)
          }
        }
      });
    },
    /approval\.resume\.command must include planner config flags/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      approval: {
        ...compact.approval,
        grants: {
          approvedWriteRisks: [],
          approvedWritePaths: [],
          approvedToolCategories: ['native-stack-config-write'],
          writePathScope: 'all',
          hasExplicitApproval: true
        }
      }
    }),
    /approval\.signals must not repeat approval\.grants-covered scope/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      handoffCheckpoint: {
        ...compact.handoffCheckpoint,
        continuation: {
          ...compact.handoffCheckpoint.continuation,
          command: compact.approval.resume.command?.replace(/ --approve-tool-category native-stack-config-write/, '') ?? null,
          compactCommand: compact.approval.resume.compactCommand?.replace(/ --approve-tool-category native-stack-config-write/, '') ?? null,
          debugCommand: compact.approval.resume.debugCommand?.replace(/ --approve-tool-category native-stack-config-write/, '') ?? null
        }
      },
      approval: {
        ...compact.approval,
        resume: {
          ...compact.approval.resume,
          command: compact.approval.resume.command?.replace(/ --approve-tool-category native-stack-config-write/, '') ?? null,
          compactCommand: compact.approval.resume.compactCommand?.replace(/ --approve-tool-category native-stack-config-write/, '') ?? null,
          debugCommand: compact.approval.resume.debugCommand?.replace(/ --approve-tool-category native-stack-config-write/, '') ?? null
        }
      }
    }),
    /approval\.resume\.command.*tool category approval scope/
  );
});

test('buildCompactAgentRunResult counts approval signals beyond the primary continuation scope', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const compact = buildCompactAgentRunResult({
    modelName: 'test-model',
    outcome: 'approval-required',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [
        {
          kind: 'write-approval-required',
          path: 'charts/payments-api/values.yaml',
          risk: 'high',
          message: 'Approval required for values.'
        },
        {
          kind: 'tool-category-approval-required',
          toolCategory: 'native-stack-config-write',
          message: 'Approval required for native stack config.'
        }
      ],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: [],
    config: resolveQueryLoopConfig({
      maxTurns: 5,
      maxRepairAttempts: 1,
      retrievedContextBudget: {
        maxPackets: 4,
        maxTokens: 800,
        maxFacts: 6
      }
    })
  });

  assert.equal(compact.approval.resume.signalCount, 2);
  assert.equal(compact.approval.resume.additionalSignalCount, 1);
  assert.equal(compact.approval.resume.additionalCommands.length, 1);
  assert.equal(compact.approval.resume.additionalCommands[0]?.signal.kind, 'tool-category-approval-required');
  assert.ok(compact.approval.resume.additionalCommands[0]?.command.includes('--approve-tool-category native-stack-config-write'));
  assert.ok(compact.approval.resume.command?.includes('--max-turns 5'));
  assert.ok(compact.approval.resume.command?.includes('--max-repair-attempts 1'));
  assert.ok(compact.approval.resume.command?.includes('--context-packet-limit 4'));
  assert.ok(compact.approval.resume.command?.includes('--context-token-budget 800'));
  assert.ok(compact.approval.resume.command?.includes('--context-fact-limit 6'));
  assert.ok(compact.approval.resume.additionalCommands[0]?.command.includes('--max-turns 5'));
  assert.ok(compact.approval.resume.additionalCommands[0]?.command.includes('--max-repair-attempts 1'));
  assert.ok(compact.approval.resume.additionalCommands[0]?.command.includes('--context-packet-limit 4'));
  assert.ok(compact.approval.resume.additionalCommands[0]?.command.includes('--context-token-budget 800'));
  assert.ok(compact.approval.resume.additionalCommands[0]?.command.includes('--context-fact-limit 6'));
  assert.equal(compact.approval.resume.additionalCommands[0]?.compactCommand, `${compact.approval.resume.additionalCommands[0]?.command} --json`);
  assert.equal(compact.approval.resume.additionalCommands[0]?.debugCommand, `${compact.approval.resume.additionalCommands[0]?.command} --json-full`);
  assert.deepEqual(compact.approval.resume.additionalWriteRisks, []);
  assert.deepEqual(compact.approval.resume.additionalWritePaths, []);
  assert.deepEqual(compact.approval.resume.additionalToolCategories, ['native-stack-config-write']);
  assert.deepEqual(compact.approval.resume.pendingScope, {
    signalCount: 2,
    includedSignalCount: 2,
    omittedSignalCount: 0,
    additionalSignalCount: 1,
    writeRiskCount: 1,
    writePathCount: 1,
    toolCategoryCount: 1
  });
  assert.equal(compact.approval.resume.primarySignal?.kind, 'write-approval-required');
  assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
  assert.throws(
    () => {
      const additionalCommand = compact.approval.resume.additionalCommands[0];
      const commandWithoutBudgetFlag = additionalCommand?.command.replace(/ --max-turns 5/g, '');
      return parseCompactAgentRunResult({
        ...compact,
        approval: {
          ...compact.approval,
          resume: {
            ...compact.approval.resume,
            additionalCommands: [
              {
                ...additionalCommand,
                command: commandWithoutBudgetFlag,
                compactCommand: `${commandWithoutBudgetFlag} --json`,
                debugCommand: `${commandWithoutBudgetFlag} --json-full`
              }
            ]
          }
        }
      });
    },
    /approval\.resume\.additionalCommands\[0\]\.command must include query config flags/
  );
  assert.throws(
    () => {
      const additionalCommand = compact.approval.resume.additionalCommands[0];
      const commandWithWrongBudgetFlag = additionalCommand?.command.replace(/--max-repair-attempts 1/g, '--max-repair-attempts 2');
      return parseCompactAgentRunResult({
        ...compact,
        approval: {
          ...compact.approval,
          resume: {
            ...compact.approval.resume,
            additionalCommands: [
              {
                ...additionalCommand,
                command: commandWithWrongBudgetFlag,
                compactCommand: `${commandWithWrongBudgetFlag} --json`,
                debugCommand: `${commandWithWrongBudgetFlag} --json-full`
              }
            ]
          }
        }
      });
    },
    /approval\.resume\.additionalCommands\[0\]\.command must include query config flags/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      approval: {
        ...compact.approval,
        resume: {
          ...compact.approval.resume,
          additionalSignalCount: 0
        }
      }
    }),
    /approval\.resume\.additionalSignalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      approval: {
        ...compact.approval,
        resume: {
          ...compact.approval.resume,
          additionalToolCategories: []
        }
      }
    }),
    /approval\.resume\.additionalToolCategories.*additional approval signals/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      approval: {
        ...compact.approval,
        resume: {
          ...compact.approval.resume,
          additionalCommands: []
        }
      }
    }),
    /approval\.resume\.additionalCommands.*non-primary approval signals/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...compact,
      approval: {
        ...compact.approval,
        resume: {
          ...compact.approval.resume,
          additionalCommands: [
            {
              ...compact.approval.resume.additionalCommands[0],
              command: compact.approval.resume.additionalCommands[0].command.replace(/ --approve-tool-category native-stack-config-write/, ''),
              compactCommand: compact.approval.resume.additionalCommands[0].compactCommand.replace(/ --approve-tool-category native-stack-config-write/, ''),
              debugCommand: compact.approval.resume.additionalCommands[0].debugCommand.replace(/ --approve-tool-category native-stack-config-write/, '')
            }
          ]
        }
      }
    }),
    /approval\.resume\.additionalCommands\[0\]\.command.*tool category approval scope/
  );
});

test('buildCompactAgentRunResult exposes explicit approval grants', async () => {
  const preflight = await buildRunPreflight('update payments-api chart deeply', 'fixtures/sample-workspace', {
    approvedWriteRisks: ['high'],
    approvedWritePaths: ['charts/payments-api'],
    approvedToolCategories: ['native-stack-config-write']
  });
  const compact = buildCompactAgentRunResult({
    modelName: 'test-model',
    outcome: 'completed',
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
      lastEditPlan: null
    },
    turns: [],
    config: resolveQueryLoopConfig()
  });

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
  assert.ok(compact.suggestedCommands.some(command =>
    /agent .*--approve-write-risk high .*--approve-write-path "charts\/payments-api" .*--approve-tool-category native-stack-config-write .*--json/.test(command)
  ));
});

test('buildCompactAgentRunResult preserves approval grants in continuation commands', async () => {
  const preflight = await buildRunPreflight('update payments-api chart and stack config', 'fixtures/sample-workspace', {
    approvedWriteRisks: ['high'],
    approvedWritePaths: ['charts/payments-api']
  });
  const compact = buildCompactAgentRunResult({
    modelName: 'test-model',
    outcome: 'approval-required',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [
        {
          kind: 'tool-category-approval-required',
          toolCategory: 'native-stack-config-write',
          message: 'Approval required for native stack config.'
        }
      ],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: [],
    config: resolveQueryLoopConfig()
  });

  assert.deepEqual(compact.approval.grants.approvedWriteRisks, ['high']);
  assert.deepEqual(compact.approval.grants.approvedWritePaths, ['charts/payments-api']);
  assert.match(compact.approval.resume.command ?? '', /--approve-write-risk high/);
  assert.match(compact.approval.resume.command ?? '', /--approve-write-path "charts\/payments-api"/);
  assert.match(compact.approval.resume.command ?? '', /--approve-tool-category native-stack-config-write/);
  assert.match(compact.approval.resume.compactCommand ?? '', /--approve-write-risk high/);
  assert.match(compact.approval.resume.debugCommand ?? '', /--approve-write-path "charts\/payments-api"/);
  assert.equal(compact.handoffCheckpoint.continuation.command, compact.approval.resume.command);
  assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
});

test('summarizeSuggestedCommands includes review and export commands for completed runs', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const commands = summarizeSuggestedCommands({
    modelName: 'test-model',
    outcome: 'completed',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      toolSummaries: [
        {
          turnIndex: 0,
          actionKind: 'apply-edit-plan',
          toolName: 'pulumi_config_set',
          safety: 'write_scoped',
          summary: 'Set Pulumi config payments-api:imageTag in infra/payments-api/Pulumi.dev.yaml'
        }
      ],
      appliedWrites: [
        {
          path: 'charts/payments-api/values.yaml',
          content: 'ingress:\n  enabled: true\n',
          reason: 'Enable ingress.'
        }
      ],
      validationResults: [
        {
          command: 'helm lint charts/payments-api',
          cwd: 'fixtures/sample-workspace',
          exitCode: 0,
          stdout: 'lint ok',
          stderr: ''
        }
      ],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(commands.some(command => /helm show values "charts\/payments-api"/.test(command)));
  assert.ok(commands.some(command => /agent "add ingress to payments-api dev chart".*--json/.test(command)));
});

test('summarizeSuggestedCommands preserves approval grants in rerun commands', async () => {
  const preflight = await buildRunPreflight('update payments-api chart deeply', 'fixtures/sample-workspace', {
    approvedWriteRisks: ['high'],
    approvedWritePaths: ['charts/payments-api'],
    approvedToolCategories: ['native-stack-config-write']
  });
  const commands = summarizeSuggestedCommands({
    modelName: 'test-model',
    outcome: 'no-safe-action',
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
      lastEditPlan: null
    },
    turns: [],
    config: resolveQueryLoopConfig()
  });

  const rerunCommand = commands.find(command => / run /.test(command));
  assert.match(rerunCommand ?? '', /--approve-write-risk high/);
  assert.match(rerunCommand ?? '', /--approve-write-path "charts\/payments-api"/);
  assert.match(rerunCommand ?? '', /--approve-tool-category native-stack-config-write/);
});

test('summarizeRecommendedNextSteps surfaces Terraform validation guidance for blocked runs', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const steps = summarizeRecommendedNextSteps({
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [
        {
          kind: 'terraform-validate-failure',
          repairable: false,
          sourceCommand: 'terraform -chdir=terraform/payments-api validate',
          message: 'Error: Missing required argument',
          guidance: 'Read the referenced Terraform module inputs and add the missing required argument through an existing tfvars file or declared variable path.'
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: [
      {
        index: 0,
        decision: {
          confidence: 'medium',
          action: {
            kind: 'stop',
            summary: 'Validation failed and no bounded repair action was available.',
            rationale: 'Terraform validate failed.',
            payload: {
              stopReason: 'validation-blocked'
            }
          }
        },
        runtimeSnapshot: {
          task: preflight.task,
          preflight,
          observations: [],
          toolSummaries: [],
          appliedWrites: [],
          validationResults: [],
          validationIssues: [],
          approvalSignals: [],
          repairAttempts: 0,
          lastEditPlan: null
        }
      }
    ]
  });

  assert.ok(steps.some(step => /add the missing required argument through an existing tfvars file/i.test(step)));
  assert.ok(steps.some(step => /terraform-root target terraform\/payments-api/i.test(step)));
});

test('summarizeAgentSnapshot highlights validation failure and approval count', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const snapshot = summarizeAgentSnapshot({
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [
        {
          command: 'terraform -chdir=terraform/payments-api validate',
          exitCode: 1,
          stdout: '',
          stderr: 'Error: Missing required argument'
        }
      ],
      validationIssues: [
        {
          kind: 'terraform-validate-failure',
          repairable: false,
          sourceCommand: 'terraform -chdir=terraform/payments-api validate',
          message: 'Error: Missing required argument'
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(snapshot.some(line => /Outcome: validation-blocked/i.test(line)));
  assert.ok(snapshot.some(line => /Primary domain: Terraform/i.test(line)));
  assert.ok(snapshot.some(line => /Active bounded path: Terraform -> validation/i.test(line)));
  assert.ok(snapshot.some(line => /Primary target: terraform-root terraform\/payments-api/i.test(line)));
  assert.ok(snapshot.some(line => /Repair attempts: 0\/2/i.test(line)));
  assert.ok(snapshot.some(line => /Validation status: failed/i.test(line)));
  assert.ok(snapshot.some(line => /Top validation issue: terraform-validate-failure/i.test(line)));
});

test('summarizeAgentSnapshot prefers the requested Helm target in mixed workspaces', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const snapshot = summarizeAgentSnapshot({
    modelName: 'test-model',
    outcome: 'completed',
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
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(snapshot.some(line => /Primary target: helm-chart charts\/payments-api/i.test(line)));
});

test('summarizeAgentSnapshot surfaces the active bounded edit path when an edit plan exists', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const snapshot = summarizeAgentSnapshot({
    modelName: 'test-model',
    outcome: 'completed',
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
      lastEditPlan: {
        kind: 'helm-ingress',
        summary: 'Apply ingress.',
        rationale: 'Test bounded path summary.',
        writes: []
      }
    },
    turns: []
  });

  assert.ok(snapshot.some(line => /Active bounded path: Helm -> helm-ingress/i.test(line)));
});

test('summarizeResultCard highlights changed files, native CLI usage, validators, and repairs', async () => {
  const preflight = await buildRunPreflight('update pulumi dev stack for payments-api image tag to 1.2.3', 'fixtures/sample-workspace');
  const summary = summarizeResultCard({
    modelName: 'test-model',
    outcome: 'completed',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      toolSummaries: [
        {
          turnIndex: 0,
          actionKind: 'apply-edit-plan',
          toolName: 'pulumi_config_set',
          safety: 'write_scoped',
          summary: 'Set Pulumi config payments-api:imageTag in infra/payments-api/Pulumi.dev.yaml'
        }
      ],
      appliedWrites: [
        {
          path: 'infra/payments-api/Pulumi.dev.yaml',
          content: 'config:\n  payments-api:environment: dev\n  payments-api:imageTag: 1.2.3\n',
          reason: 'Applied via pulumi_config_set tool.'
        }
      ],
      validationResults: [
        {
          command: 'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
          exitCode: 0,
          stdout: '',
          stderr: ''
        }
      ],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 1,
      lastEditPlan: {
        kind: 'pulumi-missing-config-repair',
        summary: 'Repair missing Pulumi config.',
        rationale: 'Test result summary.',
        writes: [
          {
            path: 'infra/payments-api/Pulumi.dev.yaml',
            content: 'config:\n  payments-api:environment: dev\n  payments-api:imageTag: 1.2.3\n',
            reason: 'Synthetic write.'
          }
        ]
      }
    },
    turns: [
      {
        index: 0,
        decision: {
          confidence: 'high',
          action: {
            kind: 'apply-edit-plan',
            summary: 'Repair missing Pulumi config.',
            rationale: 'Use Pulumi CLI.',
            payload: {
              actionFamily: 'pulumi-bounded-edit'
            }
          }
        },
        execution: {
          status: 'completed',
          executedTools: [
            {
              toolName: 'pulumi_config_set',
              safety: 'write_scoped',
              output: {
                workspaceRoot: preflight.workspaceRoot,
                projectRoot: 'infra/payments-api',
                stackName: 'dev',
                key: 'payments-api:imageTag',
                value: '1.2.3',
                stackFilePath: 'infra/payments-api/Pulumi.dev.yaml',
                command: 'pulumi config set',
                exitCode: 0,
                stdout: '',
                stderr: '',
                content: 'config:\n  payments-api:environment: dev\n  payments-api:imageTag: 1.2.3\n'
              }
            }
          ]
        },
        runtimeSnapshot: {
          task: preflight.task,
          preflight,
          observations: [],
          toolSummaries: [],
          appliedWrites: [],
          validationResults: [],
          validationIssues: [],
          approvalSignals: [],
          repairAttempts: 0,
          lastEditPlan: null
        }
      }
    ]
  });

  assert.ok(summary.some(line => /Run posture: validated and ready for review/i.test(line)));
  assert.ok(summary.some(line => /Primary target impact: Pulumi target infra\/payments-api with 1 changed file\(s\)/i.test(line)));
  assert.ok(summary.some(line => /Open concern: none/i.test(line)));
  assert.ok(summary.some(line => /Review focus: Review the selected Pulumi stack file, config keys, and preview output\./i.test(line)));
  assert.ok(summary.some(line => /Review artifacts: infra\/payments-api\/Pulumi\.dev\.yaml, config key payments-api:imageTag/i.test(line)));
  assert.ok(summary.some(line => /Review command: .*pulumi preview .*infra\/payments-api.*--stack dev/i.test(line)));
  assert.ok(summary.some(line => /Next operator step: Run .*pulumi preview .*infra\/payments-api.*--stack dev.*review the bounded change before merging or handing off the update\./i.test(line)));
  assert.ok(summary.some(line => /Tool trace: t0:Set Pulumi config payments-api:imageTag in infra\/payments-api\/Pulumi\.dev\.yaml/i.test(line)));
  assert.ok(summary.some(line => /Permission posture: 1 tool\(s\); 1 workspace mutation\(s\); 1 native command\(s\); 1 stack\/state mutation-risk tool\(s\)/i.test(line)));
  assert.ok(summary.some(line => /Changed files: infra\/payments-api\/Pulumi\.dev\.yaml/i.test(line)));
  assert.ok(summary.some(line => /Native CLI operations: Pulumi CLI/i.test(line)));
  assert.ok(summary.some(line => /Native CLI findings: Pulumi config updated payments-api:imageTag on stack dev/i.test(line)));
  assert.ok(summary.some(line => /Validators executed: 1 command\(s\) across Pulumi/i.test(line)));
  assert.ok(summary.some(line => /Validation findings: none/i.test(line)));
  assert.ok(summary.some(line => /Validation blockers: none/i.test(line)));
  assert.ok(summary.some(line => /Repair activity: 1\/2 bounded repair attempt\(s\) used/i.test(line)));
});

test('summarizeResultCard includes retrieved knowledge context budget', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const summary = summarizeResultCard({
    modelName: 'test-model',
    outcome: 'no-safe-action',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      retrievedContext: [0, 1, 2].map(index => ({
        id: `terraform-registry-${index}`,
        source: {
          kind: 'terraform-registry',
          name: `resource:aws_test_${index}`,
          provider: 'hashicorp/aws',
          version: '5.37.0',
          url: `https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/test_${index}`
        },
        confidence: 'high',
        reason: 'Terraform Registry docs for selected root terraform/payments-api',
        contentType: 'text/markdown',
        excerpt: `# aws_test_${index}\ncontext`,
        tokenEstimate: 10
      })),
      retrievedContextBudget: {
        maxPackets: 1,
        maxTokens: 500,
        maxExcerptChars: 1200
      },
      observations: [],
      toolSummaries: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(summary.some(line => /Knowledge context: 1\/3 packet\(s\) included; \d+\/500 token estimate used; omitted 2 \(packet-limit=2\)/i.test(line)));
});

test('summarizeResultCard includes budgeted knowledge fact counts', async () => {
  const preflight = await buildRunPreflight('update helm payments-api image tag', 'fixtures/sample-workspace');
  const knowledgeFacts = await buildKnowledgePack(preflight.inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    maxFacts: 8,
    extractedAt: '2026-05-05T00:00:00.000Z'
  });
  const summary = summarizeResultCard({
    modelName: 'test-model',
    outcome: 'no-safe-action',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      knowledgeFacts,
      retrievedContext: [],
      retrievedContextBudget: {
        maxPackets: 5,
        maxTokens: 1000,
        maxExcerptChars: 1200,
        maxFacts: 2
      },
      observations: [],
      toolSummaries: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(summary.some(line =>
    new RegExp(`Knowledge facts: 2/${knowledgeFacts.factCount} fact\\(s\\) included; max 2; omitted ${knowledgeFacts.factCount - 2}; sources ${knowledgeFacts.sourceCount}; stale sources ${knowledgeFacts.staleSourceCount}`, 'i').test(line)
  ));
});

test('summarizeResultCard includes Helm CLI usage when helm_show_values is executed', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const summary = summarizeResultCard({
    modelName: 'test-model',
    outcome: 'completed',
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
      lastEditPlan: null
    },
    turns: [
      {
        index: 0,
        decision: {
          confidence: 'high',
          action: {
            kind: 'inspect-target-files',
            summary: 'Inspect Helm chart files.',
            rationale: 'Use Helm CLI.',
            payload: {
              actionFamily: 'helm-inspection'
            }
          }
        },
        execution: {
          status: 'completed',
          executedTools: [
            {
              toolName: 'helm_show_chart',
              safety: 'read_only',
              output: {
                workspaceRoot: preflight.workspaceRoot,
                chartPath: 'charts/payments-api',
                command: 'helm show chart charts/payments-api',
                exitCode: 0,
                stdout: 'name: payments-api\nversion: 0.1.0\n',
                stderr: '',
                content: 'name: payments-api\nversion: 0.1.0\n'
              }
            },
            {
              toolName: 'helm_show_values',
              safety: 'read_only',
              output: {
                workspaceRoot: preflight.workspaceRoot,
                chartPath: 'charts/payments-api',
                command: 'helm show values charts/payments-api',
                exitCode: 0,
                stdout: 'replicaCount: 2\n',
                stderr: '',
                content: 'replicaCount: 2\n'
              }
            }
          ]
        },
        runtimeSnapshot: {
          task: preflight.task,
          preflight,
          observations: [],
          appliedWrites: [],
          validationResults: [],
          validationIssues: [],
          approvalSignals: [],
          repairAttempts: 0,
          lastEditPlan: null
        }
      }
    ]
  });

  assert.ok(summary.some(line => /Run posture: completed with bounded inspection or edits/i.test(line)));
  assert.ok(summary.some(line => /Primary target impact: Helm target charts\/payments-api was inspected/i.test(line)));
  assert.ok(summary.some(line => /Review focus: Review the target chart metadata, values, and templates for the requested Helm change\./i.test(line)));
  assert.ok(summary.some(line => /Review artifacts: charts\/payments-api\/Chart\.yaml, charts\/payments-api\/values\.yaml, charts\/payments-api\/templates\//i.test(line)));
  assert.ok(summary.some(line => /Review command: helm show values "charts\/payments-api"/i.test(line)));
  assert.ok(summary.some(line => /Next operator step: Run helm show values "charts\/payments-api" and review the bounded change before merging or handing off the update\./i.test(line)));
  assert.ok(summary.some(line => /Native CLI operations: Helm CLI/i.test(line)));
  assert.ok(summary.some(line => /Native CLI findings: Helm chart payments-api v0.1.0; Helm values inspected for charts\/payments-api/i.test(line)));
});

test('summarizeResultCard includes rendered Helm resource kinds from helm template output', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const summary = summarizeResultCard({
    modelName: 'test-model',
    outcome: 'completed',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [
        {
          command: 'helm template charts/payments-api',
          exitCode: 0,
          stdout: [
            'apiVersion: apps/v1',
            'kind: Deployment',
            '---',
            'apiVersion: v1',
            'kind: Service',
            '---',
            'apiVersion: networking.k8s.io/v1',
            'kind: Ingress'
          ].join('\n'),
          stderr: ''
        }
      ],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(summary.some(line => /Run posture: validated and ready for review/i.test(line)));
  assert.ok(summary.some(line => /Primary target impact: Helm target charts\/payments-api was validated without direct file changes/i.test(line)));
  assert.ok(summary.some(line => /Review focus: Review rendered Kubernetes objects and the Helm values block that drives them\./i.test(line)));
  assert.ok(summary.some(line => /Validation findings: Helm rendered resources: Deployment, Service, Ingress/i.test(line)));
});

test('summarizeResultCard includes Pulumi validation findings for missing config blockers', async () => {
  const preflight = await buildRunPreflight('update pulumi dev stack for payments-api image tag to 1.2.3', 'fixtures/sample-workspace');
  const state = {
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      configSemantics: [
        ...preflight.inspection.configSemantics,
        {
          targetKind: 'pulumi-project',
          targetPath: 'infra/payments-api',
          facts: [
            {
              kind: 'required-field',
              path: 'config.payments-api:imageTag',
              message: 'Pulumi preview reported payments-api:imageTag as required.',
              source: {
                kind: 'pulumi-preview',
                path: 'pulumi preview --cwd infra/payments-api --stack dev --non-interactive'
              },
              confidence: 'high'
            }
          ]
        }
      ],
      observations: [],
      appliedWrites: [],
      validationResults: [
        {
          command: 'pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
          exitCode: 1,
          stdout: '',
          stderr: 'error: missing required configuration variable "payments-api:imageTag"'
        }
      ],
      validationIssues: [
        {
          kind: 'pulumi-missing-config',
          repairable: true,
          sourceCommand: 'pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
          message: 'missing required configuration variable "payments-api:imageTag"',
          guidance: 'Update the selected Pulumi stack file and set payments-api:imageTag using the existing stack config namespace before rerunning preview.',
          metadata: {
            missingConfigKey: 'payments-api:imageTag'
          }
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  };
  const summary = summarizeResultCard(state);

  assert.ok(summary.some(line => /Run posture: blocked by validation and needs follow-up action/i.test(line)));
  assert.ok(summary.some(line => /Primary target impact: Pulumi target infra\/payments-api was validated without direct file changes/i.test(line)));
  assert.ok(summary.some(line => /Open concern: Update the selected Pulumi stack file and set payments-api:imageTag/i.test(line)));
  assert.ok(summary.some(line => /Review focus: Review the selected Pulumi stack file and its config namespace before rerunning preview\./i.test(line)));
  assert.ok(summary.some(line => /Next operator step: Run .*pulumi preview .*infra\/payments-api.*--stack dev.*correct the blocking Pulumi issue, and rerun the agent\./i.test(line)));
  assert.ok(summary.some(line => /Validation findings: Pulumi preview missing config: payments-api:imageTag/i.test(line)));
  assert.ok(summary.some(line => /Semantic blockers: pulumi-project infra\/payments-api: config\.payments-api:imageTag required by pulumi-preview/i.test(line)));

  const compact = buildCompactAgentRunResult(state);
  assert.equal(compact.kind, 'infra-agent.agent-result');
  assert.equal(compact.outcome, 'validation-blocked');
  assert.equal(compact.validation.semanticBlockers[0]?.path, 'config.payments-api:imageTag');
  assert.equal(compact.validation.semanticBlockers[0]?.sourceKind, 'pulumi-preview');
  assert.equal(compact.validation.identityConflictSummary.totalCount, 0);
  assert.equal(compact.validation.identityConflictSummary.mutationAllowed, false);
  assert.equal(compact.validation.identityConflicts.length, 0);
  assert.equal(compact.validation.issues[0]?.kind, 'pulumi-missing-config');
  assert.ok(compact.suggestedCommands.some(command => /validate/i.test(command)));
  assert.equal(Object.hasOwn(compact, 'turns'), false);
  assert.equal(Object.hasOwn(compact, 'preflight'), false);
});

test('summarizeResultCard includes Pulumi security duplicate validation findings', async () => {
  const preflight = await buildRunPreflight('update pulumi dev stack networking rule', 'fixtures/sample-workspace');
  const summary = summarizeResultCard({
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [
        {
          command: 'pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
          exitCode: 1,
          stdout: '',
          stderr: 'error: api error InvalidPermission.Duplicate: the specified rule "peer: 10.0.0.0/16, TCP, from port: 443, to port: 443, ALLOW" already exists'
        }
      ],
      validationIssues: [
        {
          kind: 'pulumi-create-before-delete-conflict',
          repairable: false,
          sourceCommand: 'pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
          message: 'api error InvalidPermission.Duplicate',
          guidance: 'Review the preview for matching direction, protocol, port range, security group, and peer before sequencing replacement.',
          metadata: {
            conflictCode: 'InvalidPermission.Duplicate',
            conflictFamily: 'aws-security-group-rule',
            securityGroupRulePeers: '10.0.0.0/16'
          }
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(summary.some(line => /Validation findings: Pulumi create-before-delete conflict: provider returned InvalidPermission\.Duplicate for 10\.0\.0\.0\/16\./i.test(line)));
});

test('summarizeResultCard includes Terraform exclusive identity validation findings', async () => {
  const preflight = await buildRunPreflight('update terraform edge listener rule priority', 'fixtures/terraform-workspace');
  const state = {
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [
        {
          command: 'terraform -chdir=terraform/payments-api plan',
          exitCode: 1,
          stdout: '',
          stderr: 'error: api error PriorityInUse: Priority \'100\' is currently in use'
        }
      ],
      validationIssues: [
        {
          kind: 'terraform-create-before-delete-conflict',
          repairable: false,
          sourceCommand: 'terraform -chdir=terraform/payments-api plan',
          message: 'api error PriorityInUse',
          guidance: 'Review Terraform moved blocks, import/state repair, and lifecycle ordering before retrying.',
          metadata: {
            conflictCode: 'PriorityInUse',
            conflictFamily: 'aws-lb-listener-rule',
            conflictLabel: 'AWS Load Balancer Listener Rule',
            conflictSuggestedAction: 'Use an IaC-native rename mapping for logical renames, or explicitly sequence/delete the old rule before creating a new rule with the same listener priority.',
            resourceAddress: 'aws_lb_listener_rule.api',
            resourceType: 'aws_lb_listener_rule',
            listenerRulePriorities: '100'
          }
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  };
  const summary = summarizeResultCard(state);

  assert.ok(summary.some(line => /Validation findings: Terraform create-before-delete conflict: provider returned PriorityInUse for 100\./i.test(line)));
  assert.ok(summary.some(line => /Review focus: Review Terraform moved blocks, import\/state repair needs, lifecycle ordering, and the matched provider identity before retrying\./i.test(line)));
  assert.ok(summary.some(line => /Identity review: Terraform locator aws_lb_listener_rule\.api; identity listenerRulePriorities=100; classify logical rename vs real replacement/i.test(line)));

  const compact = buildCompactAgentRunResult(state);
  assert.equal(compact.validation.identityConflictSummary.totalCount, 1);
  assert.equal(compact.validation.identityConflictSummary.includedCount, 1);
  assert.equal(compact.validation.identityConflictSummary.omittedCount, 0);
  assert.equal(compact.validation.identityConflictSummary.byEngine.terraform, 1);
  assert.equal(compact.validation.identityConflictSummary.byRiskCategory['create-before-delete-ordering'], 1);
  assert.equal(compact.validation.identityConflictSummary.mutationAllowed, false);
  assert.equal(compact.validation.identityConflicts.length, 1);
  assert.equal(compact.validation.identityConflicts[0]?.engine, 'terraform');
  assert.equal(compact.validation.identityConflicts[0]?.conflictCode, 'PriorityInUse');
  assert.equal(compact.validation.identityConflicts[0]?.conflictFamily, 'aws-lb-listener-rule');
  assert.equal(compact.validation.identityConflicts[0]?.conflictLabel, 'AWS Load Balancer Listener Rule');
  assert.equal(compact.validation.identityConflicts[0]?.resourceAddress, 'aws_lb_listener_rule.api');
  assert.equal(compact.validation.identityConflicts[0]?.resourceName, null);
  assert.equal(compact.validation.identityConflicts[0]?.resourceType, 'aws_lb_listener_rule');
  assert.equal(compact.validation.identityConflicts[0]?.identity.listenerRulePriorities, '100');
  assert.equal(compact.validation.identityConflicts[0]?.riskCategory, 'create-before-delete-ordering');
  assert.equal(compact.validation.identityConflicts[0]?.reviewSteps.length, 5);
  assert.match(compact.validation.identityConflicts[0]?.reviewSteps[0] ?? '', /aws_lb_listener_rule\.api/);
  assert.match(compact.validation.identityConflicts[0]?.reviewSteps[1] ?? '', /listener ARN and priority/i);
  assert.match(compact.validation.identityConflicts[0]?.reviewSteps[2] ?? '', /moved block|terraform state mv/i);
  assert.match(compact.validation.identityConflicts[0]?.suggestedAction ?? '', /listener priority/i);

  const report = buildIdentityConflictIncidentReport(compact);
  assert.equal(report.kind, 'infra-agent.identity-conflict-report');
  assert.equal(report.mutationAllowed, false);
  assert.equal(report.incidentCount, 1);
  assert.equal(report.omittedIncidentCount, 0);
  assert.equal(report.incidentSummary.totalCount, 1);
  assert.equal(report.incidentSummary.byEngine.terraform, 1);
  assert.match(report.summary[0] ?? '', /Terraform AWS Load Balancer Listener Rule at aws_lb_listener_rule\.api/);
  assert.equal(report.incidents[0]?.resourceLocator, 'aws_lb_listener_rule.api');
  assert.equal(report.incidents[0]?.riskCategory, 'create-before-delete-ordering');
  assert.equal(report.incidents[0]?.mutationAllowed, false);
  assert.ok(compact.suggestedCommands.some(command => /agent .*--json > "agent-result\.json"/.test(command)));
  assert.ok(compact.suggestedCommands.some(command => /identity-report "agent-result\.json" --json/.test(command)));
});

test('compact agent result summarizes omitted identity conflict details', async () => {
  const preflight = await buildRunPreflight('update terraform edge listener rule priority', 'fixtures/terraform-workspace');
  const conflictFamilies = [
    'aws-lb-listener-rule',
    'aws-s3-bucket',
    'aws-cloudfront-alias',
    'aws-lb-listener-rule',
    'aws-s3-bucket',
    'aws-cloudfront-alias',
    'aws-lb-listener-rule'
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
      validationIssues: conflictFamilies.map((conflictFamily, index) => ({
        kind: 'terraform-create-before-delete-conflict',
        repairable: false,
        sourceCommand: 'terraform -chdir=terraform/payments-api plan',
        message: `identity conflict ${index}`,
        guidance: 'Review ownership before retrying.',
        metadata: {
          conflictCode: `Conflict${index}`,
          conflictFamily,
          conflictLabel: `Conflict ${index}`,
          resourceAddress: `aws_test_resource.example_${index}`,
          resourceType: 'aws_test_resource',
          duplicateIdentity: `resource-${index}`,
          listenerRulePriorities: conflictFamily === 'aws-lb-listener-rule' ? `${100 + index}` : undefined,
          dnsNames: conflictFamily === 'aws-cloudfront-alias' ? `api-${index}.example.com` : undefined
        }
      })),
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  };

  const compact = buildCompactAgentRunResult(state);

  assert.equal(compact.validation.identityConflicts.length, 5);
  assert.equal(compact.validation.identityConflictSummary.totalCount, 7);
  assert.equal(compact.validation.identityConflictSummary.includedCount, 5);
  assert.equal(compact.validation.identityConflictSummary.maxEntries, 5);
  assert.equal(compact.validation.identityConflictSummary.omittedCount, 2);
  assert.equal(compact.validation.identityConflictSummary.byEngine.terraform, 7);
  assert.equal(compact.validation.identityConflictSummary.byEngine.pulumi, 0);
  assert.equal(compact.validation.identityConflictSummary.byRiskCategory['create-before-delete-ordering'], 3);
  assert.equal(compact.validation.identityConflictSummary.byRiskCategory['physical-name-ownership'], 2);
  assert.equal(compact.validation.identityConflictSummary.byRiskCategory['dns-or-domain-ownership'], 2);
  assert.equal(compact.validation.identityConflictSummary.mutationAllowed, false);

  const report = buildIdentityConflictIncidentReport(compact);
  assert.equal(report.incidentCount, 5);
  assert.equal(report.omittedIncidentCount, 2);
  assert.equal(report.incidentSummary.totalCount, 7);
  assert.equal(report.incidentSummary.mutationAllowed, false);
});

test('summarizeResultCard includes Terraform validation findings for missing required variables', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const summary = summarizeResultCard({
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [
        {
          command: 'terraform -chdir=terraform/payments-api validate',
          exitCode: 1,
          stdout: '',
          stderr: 'Error: Missing required argument\n\nThe argument "image_tag" is required, but no definition was found.'
        }
      ],
      validationIssues: [
        {
          kind: 'terraform-validate-failure',
          repairable: true,
          sourceCommand: 'terraform -chdir=terraform/payments-api validate',
          message: 'Error: Missing required argument',
          guidance: 'Read the referenced Terraform module inputs and add the missing required argument through an existing tfvars file or declared variable path.',
          metadata: {
            missingVariableName: 'image_tag'
          }
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(summary.some(line => /Run posture: blocked by validation and needs follow-up action/i.test(line)));
  assert.ok(summary.some(line => /Primary target impact: Terraform target terraform\/payments-api was validated without direct file changes/i.test(line)));
  assert.ok(summary.some(line => /Open concern: Read the referenced Terraform module inputs and add the missing required argument/i.test(line)));
  assert.ok(summary.some(line => /Review focus: Review the target tfvars file and the Terraform module inputs referenced by validate\./i.test(line)));
  assert.ok(summary.some(line => /Review artifacts: terraform\/payments-api\/terraform\*\.tfvars, variable declarations under terraform\/payments-api/i.test(line)));
  assert.ok(summary.some(line => /Review command: terraform -chdir=terraform\/payments-api validate/i.test(line)));
  assert.ok(summary.some(line => /Next operator step: Run terraform -chdir=terraform\/payments-api validate, correct the blocking Terraform issue, and rerun the agent\./i.test(line)));
  assert.ok(summary.some(line => /Validation findings: Terraform validate is missing required variable: image_tag/i.test(line)));
});

test('summarizeResultCard includes approval-required posture', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const summary = summarizeResultCard({
    modelName: 'test-model',
    outcome: 'approval-required',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [
        {
          kind: 'write-approval-required',
          path: 'charts/payments-api/templates/deployment.yaml',
          risk: 'high',
          message: 'High-risk rewrite requires approval.'
        },
        {
          kind: 'tool-category-approval-required',
          toolCategory: 'native-stack-config-write',
          message: 'Native stack config write requires approval.'
        }
      ],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(summary.some(line => /Run posture: paused pending explicit approval for a scoped high-risk change/i.test(line)));
  assert.ok(summary.some(line => /Open concern: Approval required for high-risk write at charts\/payments-api\/templates\/deployment\.yaml/i.test(line)));
  assert.ok(summary.some(line => /Approval resume: primary high-risk write at charts\/payments-api\/templates\/deployment\.yaml; additional 1 signal\(s\): tool categories native-stack-config-write/i.test(line)));
  assert.ok(summary.some(line => /Next operator step: Decide whether to approve high-risk write at charts\/payments-api\/templates\/deployment\.yaml before continuing\./i.test(line)));
});

test('summarizeResultCard includes clarification concern from the planner question', async () => {
  const preflight = await buildRunPreflight('update helm chart', 'fixtures/sample-workspace');
  const summary = summarizeResultCard({
    modelName: 'test-model',
    outcome: 'clarification-required',
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
      lastEditPlan: null
    },
    turns: [
      {
        index: 0,
        decision: {
          confidence: 'medium',
          action: {
            kind: 'ask-for-clarification',
            summary: 'Clarify the Helm target before making changes.',
            rationale: 'The workspace has multiple possible Helm targets.',
            payload: {
              clarificationKind: 'target-ambiguity',
              actionFamily: 'helm-clarification',
              questions: ['Which Helm chart should be updated?']
            }
          }
        },
        execution: {
          status: 'skipped',
          executedTools: [],
          reason: 'clarification-required'
        },
        runtimeSnapshot: {
          task: preflight.task,
          preflight,
          observations: [],
          appliedWrites: [],
          validationResults: [],
          validationIssues: [],
          approvalSignals: [],
          repairAttempts: 0,
          lastEditPlan: null
        }
      }
    ]
  });

  assert.ok(summary.some(line => /Open concern: Which Helm chart should be updated\?/i.test(line)));
  assert.ok(summary.some(line => /Next operator step: Answer this question and rerun the task: Which Helm chart should be updated\?/i.test(line)));
});

test('summarizeSuggestedCommands recommends inspect and run for validation-blocked runs', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const commands = summarizeSuggestedCommands({
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [
        {
          kind: 'terraform-validate-failure',
          repairable: false,
          sourceCommand: 'terraform -chdir=terraform/payments-api validate',
          message: 'Error: Missing required argument'
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(commands.some(command => /validate/.test(command)));
  assert.ok(commands.some(command => /inspect/.test(command)));
  assert.ok(commands.some(command => /run/.test(command)));
  assert.ok(commands.some(command => /terraform -chdir=terraform\/payments-api fmt -check -recursive/.test(command)));
  assert.ok(commands.some(command => /terraform -chdir=terraform\/payments-api validate/.test(command)));
});

test('summarizeRecommendedNextSteps uses Helm-specific clarification wording', async () => {
  const preflight = await buildRunPreflight('update helm chart', 'fixtures/sample-workspace');
  const steps = summarizeRecommendedNextSteps({
    modelName: 'test-model',
    outcome: 'clarification-required',
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
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(steps.some(step => /helm chart, environment, or values scope/i.test(step)));
});

test('summarizeRecommendedNextSteps focuses the requested Helm target in mixed workspaces', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const steps = summarizeRecommendedNextSteps({
    modelName: 'test-model',
    outcome: 'completed',
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
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(steps.some(step => /Focus on helm-chart target charts\/payments-api/i.test(step)));
});

test('summarizeSuggestedCommands adds domain-aware validate command for Helm clarification runs', async () => {
  const preflight = await buildRunPreflight('update helm chart', 'fixtures/sample-workspace');
  const commands = summarizeSuggestedCommands({
    modelName: 'test-model',
    outcome: 'clarification-required',
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
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(commands.some(command => /inspect/.test(command)));
  assert.ok(commands.some(command => /run/.test(command)));
  assert.ok(commands.some(command => /validate/.test(command)));
});

test('summarizeSuggestedCommands includes native Helm commands for Helm clarification runs', async () => {
  const preflight = await buildRunPreflight('update helm chart', 'fixtures/sample-workspace');
  const commands = summarizeSuggestedCommands({
    modelName: 'test-model',
    outcome: 'clarification-required',
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
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(commands.some(command => /helm show chart "charts\/payments-api"/.test(command)));
  assert.ok(commands.some(command => /helm show values "charts\/payments-api"/.test(command)));
  assert.ok(commands.some(command => /helm lint "charts\/payments-api"/.test(command)));
});

test('summarizeSuggestedCommands includes native Pulumi preview command for blocked Pulumi runs', async () => {
  const preflight = await buildRunPreflight('update pulumi dev stack for payments-api image tag to 1.2.3', 'fixtures/sample-workspace');
  const commands = summarizeSuggestedCommands({
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [
        {
          kind: 'pulumi-missing-config',
          repairable: true,
          sourceCommand: 'pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
          message: 'missing required configuration variable "payments-api:imageTag"',
          metadata: {
            missingConfigKey: 'payments-api:imageTag'
          }
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(commands.some(command => /pulumi preview --cwd infra\/payments-api --stack dev --non-interactive/.test(command)));
});
