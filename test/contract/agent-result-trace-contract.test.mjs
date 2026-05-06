import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCompactAgentRunResult } from '../../src/cli/agent-result-contract.ts';
import { buildAgentResultContractFixtures } from '../support/agent-result-contract-fixtures.mjs';

test('compact agent result contract rejects trace and harness summary drift', () => {
  const {
    validResult,
    validSafetyBlocker,
    validUnsafeSafetyBlocker,
    resultWithSafetyBlockers,
    resultWithToolEntries,
    twoToolEntries
  } = buildAgentResultContractFixtures();
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          entries: {}
        }
      }
    }),
    /harness\.toolTrace\.maxEntries/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          entries: undefined
        }
      }
    }),
    /harness\.toolTrace\.entries/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          permissionCategoryCounts: null
        }
      }
    }),
    /harness\.toolTrace\.permissionCategoryCounts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          totalCount: '0',
          entries: []
        }
      }
    }),
    /harness\.toolTrace\.totalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          includedCount: 0,
          omittedCount: 1
        }
      }
    }),
    /harness\.toolTrace\.includedCount must match entries length/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          preservedWindow: 'head'
        }
      }
    }),
    /harness\.toolTrace\.preservedWindow/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          lastIncludedTurnIndex: 99
        }
      }
    }),
    /harness\.toolTrace\.lastIncludedTurnIndex/
  );
  assert.throws(
    () => parseCompactAgentRunResult(resultWithToolEntries([...twoToolEntries].reverse())),
    /harness\.toolTrace\.entries turnIndex/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          latestTurnIndex: 99
        }
      }
    }),
    /harness\.toolTrace\.latestTurnIndex/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          permissionCategoryCounts: {
            'workspace-write': 1
          }
        },
        toolPermissionSummary: {
          ...validResult.harness.toolPermissionSummary,
          categories: {
            'workspace-write': 1
          }
        }
      }
    }),
    /harness\.toolTrace\.permissionCategoryCounts.*included entries/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: null
      }
    }),
    /harness\.toolTrace/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          entries: [
            {
              ...validResult.harness.toolTrace.entries[0],
              permissionCategory: 'unexpected'
            }
          ]
        }
      }
    }),
    /harness\.toolTrace\.entries\[0\]\.permissionCategory/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          entries: [
            {
              ...validResult.harness.toolTrace.entries[0],
              mutatesWorkspace: 'no'
            }
          ]
        }
      }
    }),
    /harness\.toolTrace\.entries\[0\]\.mutatesWorkspace/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolTrace: {
          ...validResult.harness.toolTrace,
          permissionCategoryCounts: {
            'workspace-read': 2
          }
        }
      }
    }),
    /harness\.toolTrace\.permissionCategoryCounts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTrace: null
      }
    }),
    /harness\.turnTrace/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTraceBudget: null
      }
    }),
    /harness\.turnTraceBudget/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTraceBudget: {
          totalCount: '0'
        }
      }
    }),
    /harness\.turnTraceBudget\.totalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTraceBudget: {
          ...validResult.harness.turnTraceBudget,
          preservedWindow: 'tail'
        }
      }
    }),
    /harness\.turnTraceBudget\.preservedWindow/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTraceBudget: {
          totalCount: 2,
          includedCount: 1,
          omittedCount: 0
        }
      }
    }),
    /harness\.turnTraceBudget counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTrace: [
          {
            ...validResult.harness.turnTrace[0],
            actionKind: 'unexpected'
          }
        ]
      }
    }),
    /harness\.turnTrace\[0\]\.actionKind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTrace: [
          {
            ...validResult.harness.turnTrace[0],
            executedToolCount: -1
          }
        ]
      }
    }),
    /harness\.turnTrace\[0\]\.executedToolCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTraceBudget: {
          ...validResult.harness.turnTraceBudget,
          totalCount: 1,
          includedCount: 0,
          omittedCount: 1
        }
      }
    }),
    /harness\.turnTraceBudget\.includedCount must match turnTrace length/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTraceLimit: 4
      }
    }),
    /harness\.turnTraceLimit/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTraceOmittedCount: 1
      }
    }),
    /harness\.turnTraceOmittedCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTraceBudget: {
          ...validResult.harness.turnTraceBudget,
          firstIncludedTurnIndex: 1
        }
      }
    }),
    /harness\.turnTraceBudget\.firstIncludedTurnIndex/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        turnTraceLimit: undefined
      }
    }),
    /harness\.turnTraceLimit/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          turnTrace: {
            includedCount: 1,
            omittedCount: 1
          }
        }
      },
      harness: {
        ...validResult.harness,
        turnTraceOmittedCount: 1,
        turnTraceBudget: {
          ...validResult.harness.turnTraceBudget,
          totalCount: 2,
          omittedCount: 1
        }
      }
    }),
    /harness\.turnTraceBudget\.totalCount must match root\.turnsUsed/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: null
      }
    }),
    /harness\.lifecycleEvents/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          ...validResult.harness.lifecycleEvents,
          events: {}
        }
      }
    }),
    /harness\.lifecycleEvents\.events/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          ...validResult.harness.lifecycleEvents,
          eventCounts: null
        }
      }
    }),
    /harness\.lifecycleEvents\.eventCounts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          ...validResult.harness.lifecycleEvents,
          totalCount: '0',
          events: []
        }
      }
    }),
    /harness\.lifecycleEvents\.totalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          ...validResult.harness.lifecycleEvents,
          maxEntries: 12,
          totalCount: 1,
          includedCount: 1,
          omittedCount: 0,
          events: [
            {
              event: 'unexpected'
            }
          ]
        }
      }
    }),
    /harness\.lifecycleEvents\.events\[0\]\.event/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          ...validResult.harness.lifecycleEvents,
          totalCount: 3,
          includedCount: 2,
          omittedCount: 1,
          events: []
        }
      }
    }),
    /harness\.lifecycleEvents\.includedCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          ...validResult.harness.lifecycleEvents,
          totalCount: 3,
          includedCount: 1,
          omittedCount: 0,
          events: [
            {
              ...validResult.harness.lifecycleEvents.events[1]
            }
          ]
        }
      }
    }),
    /harness\.lifecycleEvents counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          ...validResult.harness.lifecycleEvents,
          events: [
            {
              ...validResult.harness.lifecycleEvents.events[0],
              actionKind: 'unexpected'
            },
            validResult.harness.lifecycleEvents.events[1]
          ]
        }
      }
    }),
    /harness\.lifecycleEvents\.events\[0\]\.actionKind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          ...validResult.harness.lifecycleEvents,
          eventCounts: {
            ...validResult.harness.lifecycleEvents.eventCounts,
            decision: 2
          }
        }
      }
    }),
    /harness\.lifecycleEvents\.eventCounts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          ...validResult.harness.lifecycleEvents,
          events: [
            validResult.harness.lifecycleEvents.events[0],
            validResult.harness.lifecycleEvents.events[1],
            {
              ...validResult.harness.lifecycleEvents.events[2],
              outcome: 'completed',
              reason: 'outcome:completed'
            }
          ]
        }
      }
    }),
    /harness\.lifecycleEvents terminal event/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        lifecycleEvents: {
          totalCount: 0,
          includedCount: 0,
          omittedCount: 0,
          eventCounts: {
            unexpected: 1
          },
          events: []
        }
      }
    }),
    /harness\.lifecycleEvents\.eventCounts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: null
      }
    }),
    /harness\.stateSummary/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          semanticFactCount: undefined
        }
      }
    }),
    /harness\.stateSummary\.semanticFactCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          validationIssueCount: '1'
        }
      }
    }),
    /harness\.stateSummary/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          semanticFactCount: -1
        }
      }
    }),
    /harness\.stateSummary/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          toolSummaryCount: 2
        }
      }
    }),
    /harness\.stateSummary\.toolSummaryCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          validationResultCount: 2
        }
      }
    }),
    /harness\.stateSummary\.validationResultCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          validationIssueCount: 2
        }
      }
    }),
    /harness\.stateSummary\.validationIssueCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          approvalSignalCount: 1
        }
      }
    }),
    /harness\.stateSummary\.approvalSignalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          retrievedContextCount: 1
        }
      }
    }),
    /harness\.stateSummary\.retrievedContextCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolPermissionSummary: {
          ...validResult.harness.toolPermissionSummary,
          totalToolCount: '1'
        }
      }
    }),
    /harness\.toolPermissionSummary/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolPermissionSummary: {
          ...validResult.harness.toolPermissionSummary,
          workspaceMutationToolCount: 2
        }
      }
    }),
    /workspaceMutationToolCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolPermissionSummary: {
          ...validResult.harness.toolPermissionSummary,
          categories: {
            ansible: 1
          }
        }
      }
    }),
    /toolPermissionSummary\.categories/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolPermissionSummary: {
          ...validResult.harness.toolPermissionSummary,
          categories: {
            'workspace-read': 2
          }
        }
      }
    }),
    /toolPermissionSummary\.categories/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        toolPermissionSummary: {
          ...validResult.harness.toolPermissionSummary,
          categories: {
            'workspace-write': 1
          }
        }
      }
    }),
    /must match harness\.toolTrace\.permissionCategoryCounts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        plannerHandoff: {
          ...validResult.harness.plannerHandoff,
          activeBlocker: {
            ...validResult.harness.plannerHandoff.activeBlocker,
            kind: 'unexpected'
          }
        }
      }
    }),
    /plannerHandoff\.activeBlocker\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        plannerHandoff: {
          ...validResult.harness.plannerHandoff,
          activeBlocker: {
            ...validResult.harness.plannerHandoff.activeBlocker,
            kind: 'validation'
          },
          nextControlAction: 'unexpected'
        }
      }
    }),
    /plannerHandoff\.nextControlAction/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        plannerHandoff: {
          ...validResult.harness.plannerHandoff,
          lastAction: {
            ...validResult.harness.plannerHandoff.lastAction,
            kind: 'unexpected'
          }
        }
      }
    }),
    /plannerHandoff\.lastAction\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        plannerHandoff: {
          ...validResult.harness.plannerHandoff,
          lastAction: {
            ...validResult.harness.plannerHandoff.lastAction,
            stopReason: null
          }
        }
      }
    }),
    /plannerHandoff\.lastAction\.stopReason/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        plannerHandoff: {
          ...validResult.harness.plannerHandoff,
          activeBlocker: {
            ...validResult.harness.plannerHandoff.activeBlocker,
            validationIssueKind: 'new-validation-kind'
          }
        }
      }
    }),
    /plannerHandoff\.activeBlocker\.validationIssueKind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        plannerHandoff: {
          ...validResult.harness.plannerHandoff,
          nextControlAction: 'review-result'
        }
      }
    }),
    /plannerHandoff\.nextControlAction must match outcome/
  );
});
