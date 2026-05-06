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
