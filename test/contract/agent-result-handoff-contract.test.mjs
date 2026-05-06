import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCompactAgentRunResult } from '../../src/cli/agent-result-contract.ts';
import { buildAgentResultContractFixtures } from '../support/agent-result-contract-fixtures.mjs';

test('compact agent result contract rejects handoff, root, and planner drift', () => {
  const {
    validResult,
    validSafetyBlocker,
    validUnsafeSafetyBlocker,
    resultWithSafetyBlockers,
    resultWithToolEntries,
    twoToolEntries
  } = buildAgentResultContractFixtures();
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, kind: 'infra-agent.infra-graph' }),
    /compact infra-agent\.agent-result/
  );
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, schemaVersion: 2 }),
    /schemaVersion 1/
  );
  assert.throws(
    () => {
      const { handoffCheckpoint, ...missingCheckpoint } = validResult;
      void handoffCheckpoint;
      parseCompactAgentRunResult(missingCheckpoint);
    },
    /handoffCheckpoint object/
  );
  assert.throws(
    () => {
      const { approval, ...missingApproval } = validResult;
      void approval;
      parseCompactAgentRunResult(missingApproval);
    },
    /approval object/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        compact: false
      }
    }),
    /handoffCheckpoint\.compact/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        mutationAllowed: true
      }
    }),
    /handoffCheckpoint\.mutationAllowed/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        exclusions: {
          ...validResult.handoffCheckpoint.exclusions,
          rawRuntimeIncluded: true
        }
      }
    }),
    /handoffCheckpoint\.exclusions\.rawRuntimeIncluded/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          activeBlocker: 'runtime'
        }
      }
    }),
    /handoffCheckpoint\.summary\.activeBlocker/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          validationIssueCount: -1
        }
      }
    }),
    /handoffCheckpoint\.summary\.validationIssueCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          outcome: 'completed'
        }
      }
    }),
    /handoffCheckpoint\.summary\.outcome must match root\.outcome/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          changedFileCount: 1
        }
      }
    }),
    /handoffCheckpoint\.summary\.changedFileCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          activeBlocker: 'approval'
        },
        continuation: {
          ...validResult.handoffCheckpoint.continuation,
          reason: 'approval'
        }
      }
    }),
    /handoffCheckpoint\.summary\.activeBlocker must match harness\.plannerHandoff\.activeBlocker\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          nextControlAction: 'review-result'
        },
        continuation: {
          ...validResult.handoffCheckpoint.continuation,
          nextControlAction: 'review-result'
        }
      }
    }),
    /handoffCheckpoint\.summary\.nextControlAction must match harness\.plannerHandoff\.nextControlAction/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          readinessStatus: 'warn'
        }
      }
    }),
    /handoffCheckpoint\.summary\.readinessStatus must match readiness\.status/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          validationStatus: 'passed'
        }
      }
    }),
    /handoffCheckpoint\.summary\.validationStatus must match validation\.status/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          validationIssueCount: 0
        }
      }
    }),
    /handoffCheckpoint\.summary\.validationIssueCount must match validation\.issueSummary\.totalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          identityConflictCount: 0
        }
      }
    }),
    /handoffCheckpoint\.summary\.identityConflictCount must match validation\.identityConflictSummary\.totalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        summary: {
          ...validResult.handoffCheckpoint.summary,
          approvalContinuationRequired: true
        },
        continuation: {
          ...validResult.handoffCheckpoint.continuation,
          approvalRequired: true,
          command: 'node --experimental-strip-types src/cli/main.ts agent "review terraform listener priority"',
          compactCommand: 'node --experimental-strip-types src/cli/main.ts agent "review terraform listener priority" --json',
          debugCommand: 'node --experimental-strip-types src/cli/main.ts agent "review terraform listener priority" --json-full'
        }
      }
    }),
    /handoffCheckpoint\.summary\.approvalContinuationRequired must match approval\.resume\.continuationRequired/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          validationCommands: {
            ...validResult.handoffCheckpoint.budgets.validationCommands,
            omittedCount: -1
          }
        }
      }
    }),
    /handoffCheckpoint\.budgets\.validationCommands\.omittedCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          knowledgePackets: {
            ...validResult.handoffCheckpoint.budgets.knowledgePackets,
            includedTokenEstimate: -1
          }
        }
      }
    }),
    /handoffCheckpoint\.budgets\.knowledgePackets\.includedTokenEstimate/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          turnTrace: {
            ...validResult.handoffCheckpoint.budgets.turnTrace,
            includedCount: 0
          }
        }
      }
    }),
    /handoffCheckpoint\.budgets\.turnTrace must match harness\.turnTraceBudget/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          validationIssueGroups: {
            ...validResult.handoffCheckpoint.budgets.validationIssueGroups,
            omittedCount: 1
          }
        }
      }
    }),
    /handoffCheckpoint\.budgets\.validationIssueGroups must match validation\.issueSummary/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          knowledgePackets: {
            ...validResult.handoffCheckpoint.budgets.knowledgePackets,
            omittedTokenEstimate: 79
          }
        }
      }
    }),
    /handoffCheckpoint\.budgets\.knowledgePackets token estimates must match knowledgeContext/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        continuation: {
          ...validResult.handoffCheckpoint.continuation,
          reason: 'approval'
        }
      }
    }),
    /handoffCheckpoint\.continuation\.reason must match handoffCheckpoint\.summary\.activeBlocker/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        continuation: {
          ...validResult.handoffCheckpoint.continuation,
          required: false
        }
      }
    }),
    /handoffCheckpoint\.continuation\.required must match reason/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        continuation: {
          ...validResult.handoffCheckpoint.continuation,
          command: 'node --experimental-strip-types src/cli/main.ts agent "retry"'
        }
      }
    }),
    /handoffCheckpoint\.continuation\.command must be null when approvalRequired is false/
  );
  assert.throws(
    () => {
      const { compactCommand, ...continuationWithoutCompactCommand } = validResult.handoffCheckpoint.continuation;
      void compactCommand;
      return parseCompactAgentRunResult({
        ...validResult,
        handoffCheckpoint: {
          ...validResult.handoffCheckpoint,
          continuation: continuationWithoutCompactCommand
        }
      });
    },
    /handoffCheckpoint\.continuation\.compactCommand/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        continuation: {
          ...validResult.handoffCheckpoint.continuation,
          compactCommand: 'node --experimental-strip-types src/cli/main.ts agent "retry" --json'
        }
      }
    }),
    /handoffCheckpoint\.continuation\.compactCommand must be null when approvalRequired is false/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        durableSections: []
      }
    }),
    /handoffCheckpoint\.durableSections/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        durableSections: ['runtime']
      }
    }),
    /handoffCheckpoint\.durableSections/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        durableSections: validResult.handoffCheckpoint.durableSections.filter(section => section !== 'approval')
      }
    }),
    /handoffCheckpoint\.durableSections must include all required recovery section names/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        durableSections: [
          ...validResult.handoffCheckpoint.durableSections,
          'root'
        ]
      }
    }),
    /handoffCheckpoint\.durableSections must not include duplicate section names/
  );
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, outcome: 'unexpected' }),
    /supported outcome/
  );
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, task: 1 }),
    /root\.task/
  );
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, workspaceRoot: null }),
    /root\.workspaceRoot/
  );
  for (const field of [
    'modelName',
    'profileId',
    'turnsUsed',
    'requestedDomains',
    'changedFiles',
    'resultCard',
    'nextSteps',
    'suggestedCommands'
  ]) {
    const missingRootField = { ...validResult };
    delete missingRootField[field];
    assert.throws(
      () => parseCompactAgentRunResult(missingRootField),
      new RegExp(`root\\.${field}`)
    );
  }
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, turnsUsed: '1' }),
    /root\.turnsUsed/
  );
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, turnsUsed: -1 }),
    /root\.turnsUsed/
  );
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, requestedDomains: ['ansible'] }),
    /root\.requestedDomains/
  );
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, changedFiles: ['a.tf', 1] }),
    /root\.changedFiles/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      requestedEnvironment: 1
    }),
    /root\.requestedEnvironment/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      primaryTarget: {
        ...validResult.primaryTarget,
        score: 'high'
      }
    }),
    /root\.primaryTarget\.score/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        maxTurns: '6'
      }
    }),
    /harness\.maxTurns/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      turnsUsed: 2
    }),
    /root\.turnsUsed must match harness\.loopBudget\.turnsUsed/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        queryConfig: {
          ...validResult.harness.queryConfig,
          maxRepairAttempts: '2'
        }
      }
    }),
    /harness\.queryConfig\.maxRepairAttempts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        queryConfig: {
          ...validResult.harness.queryConfig,
          retrievedContextBudget: {
            ...validResult.harness.queryConfig.retrievedContextBudget,
            maxTokens: 0
          }
        }
      }
    }),
    /harness\.queryConfig\.retrievedContextBudget\.maxTokens/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        plannerConfig: null
      }
    }),
    /harness\.plannerConfig/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        plannerConfig: {
          ...validResult.harness.plannerConfig,
          clientName: 'different-model'
        }
      }
    }),
    /harness\.plannerConfig\.clientName/
  );
  const llmResult = {
    ...validResult,
    modelName: 'llm-model-client:codex-infra-test',
    readiness: {
      ...validResult.readiness,
      doctorCommand: 'infra-agent doctor /workspace --model codex-infra-test --openai-base-url https://models.example.test/v1 --json'
    },
    harness: {
      ...validResult.harness,
      plannerConfig: {
        requestedMode: 'llm',
        effectiveMode: 'llm',
        clientName: 'llm-model-client:codex-infra-test',
        fallbackReason: null,
        llm: {
          provider: 'openai-compatible',
          model: 'codex-infra-test',
          baseUrl: 'https://models.example.test/v1',
          apiKeyConfigured: true,
          apiKeySource: 'OPENAI_API_KEY',
          providerSource: 'default',
          modelSource: 'cli',
          baseUrlSource: 'cli',
          capabilities: {
            transport: 'chat-completions',
            endpointPath: '/chat/completions',
            responseFormat: 'json-object',
            supportsJsonObject: true,
            supportsStreaming: false
          }
        }
      }
    }
  };
  assert.equal(parseCompactAgentRunResult(llmResult).kind, 'infra-agent.agent-result');
  assert.throws(
    () => parseCompactAgentRunResult({
      ...llmResult,
      readiness: {
        ...llmResult.readiness,
        doctorCommand: 'infra-agent doctor /workspace --planner llm --model codex-infra-test --openai-base-url https://models.example.test/v1 --json'
      }
    }),
    /readiness\.doctorCommand must not include planner mode flags/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...llmResult,
      harness: {
        ...llmResult.harness,
        plannerConfig: {
          ...llmResult.harness.plannerConfig,
          llm: {
            ...llmResult.harness.plannerConfig.llm,
            model: 'wrong-model'
          }
        }
      }
    }),
    /harness\.plannerConfig\.llm\.model/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...llmResult,
      harness: {
        ...llmResult.harness,
        plannerConfig: {
          ...llmResult.harness.plannerConfig,
          llm: {
            ...llmResult.harness.plannerConfig.llm,
            capabilities: {
              ...llmResult.harness.plannerConfig.llm.capabilities,
              supportsStreaming: true
            }
          }
        }
      }
    }),
    /harness\.plannerConfig\.llm\.capabilities\.supportsStreaming/
  );
});
