import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCompactAgentRunResult } from '../../src/cli/agent-result-contract.ts';
import { buildAgentResultContractFixtures } from '../support/agent-result-contract-fixtures.mjs';

test('compact agent result contract rejects readiness, approval, and identity detail drift', () => {
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
      readiness: {
        ...validResult.readiness,
        status: 'unknown'
      }
    }),
    /readiness\.status/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        checks: {}
      }
    }),
    /readiness\.checks/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        passCount: 0
      }
    }),
    /readiness counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        checks: [
          {
            ...validResult.readiness.checks[0],
            status: 'unknown'
          }
        ]
      }
    }),
    /readiness\.checks\[0\]\.status/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        doctorCommand: null
      }
    }),
    /readiness\.doctorCommand/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        plannerProviderCatalog: undefined
      }
    }),
    /readiness\.plannerProviderCatalog must be an object/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        plannerProviderCatalog: {
          ...validResult.readiness.plannerProviderCatalog,
          apiKey: 'secret-value'
        }
      }
    }),
    /readiness\.plannerProviderCatalog\.apiKey must not be included/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        plannerProviderCatalog: {
          ...validResult.readiness.plannerProviderCatalog,
          command: 'infra-agent planner-providers --json --live'
        }
      }
    }),
    /readiness\.plannerProviderCatalog\.command/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        plannerProviderCatalog: {
          ...validResult.readiness.plannerProviderCatalog,
          liveProviderCheck: true
        }
      }
    }),
    /readiness\.plannerProviderCatalog\.liveProviderCheck/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        plannerProviderCatalog: {
          ...validResult.readiness.plannerProviderCatalog,
          supportedProviderIds: ['openai-compatible', 'other-provider']
        }
      }
    }),
    /readiness\.plannerProviderCatalog\.supportedProviderIds/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      readiness: {
        ...validResult.readiness,
        plannerProviderCatalog: {
          ...validResult.readiness.plannerProviderCatalog,
          supportedProviderCount: 2
        }
      }
    }),
    /readiness\.plannerProviderCatalog\.supportedProviderCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        commands: {
          entries: {}
        }
      }
    }),
    /validation\.commands\.entries/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        targetCommandCount: '1'
      }
    }),
    /validation\.targetCommandCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        commands: {
          ...validResult.validation.commands,
          maxEntries: '8'
        }
      }
    }),
    /validation\.commands\.maxEntries/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        commands: {
          ...validResult.validation.commands,
          entries: [
            {
              ...validResult.validation.commands.entries[0],
              status: 'passed'
            }
          ]
        }
      }
    }),
    /validation\.commands\.entries\[0\]\.status/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        commands: {
          ...validResult.validation.commands,
          entries: [
            {
              ...validResult.validation.commands.entries[0],
              kind: 'deploy'
            }
          ]
        }
      }
    }),
    /validation\.commands\.entries\[0\]\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        commands: {
          ...validResult.validation.commands,
          entries: [
            {
              ...validResult.validation.commands.entries[0],
              unsafeBlocked: true,
              unsafeRuleId: null,
              unsafeReason: null
            }
          ]
        }
      }
    }),
    /validation\.commands\.entries\[0\]\.unsafeRuleId/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        commands: {
          ...validResult.validation.commands,
          entries: [
            {
              ...validResult.validation.commands.entries[0],
              unsafeBlocked: false,
              unsafeRuleId: 'terraform-apply-destroy',
              unsafeReason: null
            }
          ]
        }
      }
    }),
    /validation\.commands\.entries\[0\]\.unsafeRuleId/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        targetCommandCount: 0
      }
    }),
    /validation\.targetCommandCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        yamlGuardCount: 1
      }
    }),
    /validation\.yamlGuardCount/
  );
  assert.equal(parseCompactAgentRunResult({
    ...validResult,
    harness: {
      ...validResult.harness,
      stateSummary: {
        ...validResult.harness.stateSummary,
        validationResultCount: 2
      }
    },
    handoffCheckpoint: {
      ...validResult.handoffCheckpoint,
      budgets: {
        ...validResult.handoffCheckpoint.budgets,
        validationCommands: {
          includedCount: 1,
          omittedCount: 1
        }
      }
    },
    validation: {
      ...validResult.validation,
      targetCommandCount: 2,
      commands: {
        ...validResult.validation.commands,
        omittedCount: 1
      }
    }
  }).validation.targetCommandCount, 2);
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: {
          ...validResult.validation.issueSummary,
          groups: {}
        }
      }
    }),
    /validation\.issueSummary\.groups/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        safetyBlockers: {
          ...validResult.validation.safetyBlockers,
          entries: {}
        }
      }
    }),
    /validation\.safetyBlockers\.entries/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        signals: {}
      }
    }),
    /approval\.signals/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        resume: null
      }
    }),
    /approval\.resume/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        grants: null
      }
    }),
    /approval\.grants/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        grants: {
          ...validResult.approval.grants,
          approvedWriteRisks: ['urgent']
        }
      }
    }),
    /approval\.grants\.approvedWriteRisks/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        grants: {
          ...validResult.approval.grants,
          approvedWritePaths: ['charts/payments-api'],
          writePathScope: 'all',
          hasExplicitApproval: true
        }
      }
    }),
    /approval\.grants\.writePathScope.*scoped/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        grants: {
          ...validResult.approval.grants,
          approvedToolCategories: ['native-stack-config-write'],
          hasExplicitApproval: false
        }
      }
    }),
    /approval\.grants\.hasExplicitApproval/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        resume: {
          ...validResult.approval.resume,
          primarySignal: {}
        }
      }
    }),
    /approval\.resume\.primarySignal\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        resume: {
          ...validResult.approval.resume,
          primarySignal: {
            kind: 'write-approval-required',
            message: 'Approval required.',
            path: 'charts/payments-api/values.yaml',
            risk: 'high',
            toolCategory: null
          }
        }
      }
    }),
    /approval\.resume\.primarySignal.*null/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        resume: {
          ...validResult.approval.resume,
          continuationRequired: 'yes'
        }
      }
    }),
    /approval\.resume\.continuationRequired/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        resume: {
          ...validResult.approval.resume,
          compactCommand: 'node --experimental-strip-types src/cli/main.ts agent "task" --json'
        }
      }
    }),
    /approval\.resume\.compactCommand.*null/
  );
  assert.throws(
    () => {
      const { pendingScope, ...resumeWithoutPendingScope } = validResult.approval.resume;
      void pendingScope;
      return parseCompactAgentRunResult({
        ...validResult,
        approval: {
          ...validResult.approval,
          resume: resumeWithoutPendingScope
        }
      });
    },
    /approval\.resume\.pendingScope/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        resume: {
          ...validResult.approval.resume,
          pendingScope: {
            ...validResult.approval.resume.pendingScope,
            signalCount: 1
          }
        }
      }
    }),
    /approval\.resume\.pendingScope\.signalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        requiredWriteRisks: ['urgent']
      }
    }),
    /approval\.requiredWriteRisks/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          approvalSignals: {
            includedCount: 1,
            omittedCount: 0
          }
        }
      },
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          approvalSignalCount: 1
        }
      },
      approval: {
        ...validResult.approval,
        signals: [
          {
            kind: 'write-approval-required',
            message: 'Approval required.',
            path: '',
            risk: 'medium',
            toolCategory: null
          }
        ]
      }
    }),
    /approval\.signals\[0\]\.path/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          approvalSignals: {
            includedCount: 1,
            omittedCount: 0
          }
        }
      },
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          approvalSignalCount: 1
        }
      },
      approval: {
        ...validResult.approval,
        signals: [
          {
            kind: 'tool-category-approval-required',
            message: 'Approval required.',
            path: null,
            risk: null,
            toolCategory: 'deploy'
          }
        ]
      }
    }),
    /approval\.signals\[0\]\.toolCategory/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      approval: {
        ...validResult.approval,
        resume: {
          ...validResult.approval.resume,
          command: 'node --experimental-strip-types src/cli/main.ts agent task --workspace /workspace'
        }
      }
    }),
    /approval\.resume\.command/
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
          command: 'node --experimental-strip-types src/cli/main.ts agent "review terraform listener priority" --workspace "/workspace"',
          compactCommand: 'node --experimental-strip-types src/cli/main.ts agent "review terraform listener priority" --workspace "/workspace" --json',
          debugCommand: 'node --experimental-strip-types src/cli/main.ts agent "review terraform listener priority" --workspace "/workspace" --json-full'
        }
      },
      approval: {
        ...validResult.approval,
        resume: {
          ...validResult.approval.resume,
          continuationRequired: true,
          command: 'node --experimental-strip-types src/cli/main.ts agent "review terraform listener priority" --workspace "/workspace"',
          compactCommand: 'node --experimental-strip-types src/cli/main.ts agent "review terraform listener priority" --workspace "/workspace" --json',
          debugCommand: 'node --experimental-strip-types src/cli/main.ts agent "review terraform listener priority" --workspace "/workspace" --json-full'
        }
      }
    }),
    /approval\.resume\.continuationRequired must match root\.outcome/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          approvalSignals: {
            includedCount: 1,
            omittedCount: 0
          }
        }
      },
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          approvalSignalCount: 1
        }
      },
      approval: {
        ...validResult.approval,
        signals: [
          {
            kind: 'write-approval-required',
            message: 'Approval required.',
            path: 'values.yaml',
            risk: 'medium',
            toolCategory: null
          }
        ],
        resume: {
          ...validResult.approval.resume,
          signalCount: 0
        }
      }
    }),
    /approval\.resume\.signalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          approvalSignals: {
            includedCount: 1,
            omittedCount: 0
          }
        }
      },
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          approvalSignalCount: 1
        }
      },
      approval: {
        ...validResult.approval,
        signals: [
          {
            kind: 'write-approval-required',
            message: 'Approval required.',
            path: 'values.yaml',
            risk: 'medium',
            toolCategory: null
          }
        ],
        resume: {
          ...validResult.approval.resume,
          writeRisks: [],
          writePaths: ['values.yaml'],
          signalCount: 1
        }
      }
    }),
    /approval\.resume\.writeRisks/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          approvalSignals: {
            includedCount: 1,
            omittedCount: 0
          }
        }
      },
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          approvalSignalCount: 1
        }
      },
      approval: {
        ...validResult.approval,
        signals: [
          {
            kind: 'tool-category-approval-required',
            message: 'Approval required.',
            path: null,
            risk: null,
            toolCategory: 'native-stack-config-write'
          }
        ],
        resume: {
          ...validResult.approval.resume,
          toolCategories: [],
          signalCount: 1
        }
      }
    }),
    /approval\.resume\.toolCategories/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          approvalSignals: {
            includedCount: 1,
            omittedCount: 0
          }
        }
      },
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          approvalSignalCount: 1
        }
      },
      approval: {
        ...validResult.approval,
        signals: [
          {
            kind: 'write-approval-required',
            message: 'Approval required.',
            path: 'values.yaml',
            risk: 'medium',
            toolCategory: null
          }
        ],
        resume: {
          ...validResult.approval.resume,
          writeRisks: ['medium', 'high'],
          writePaths: ['values.yaml'],
          signalCount: 1
        }
      }
    }),
    /approval\.resume\.writeRisks must match included approval signals/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflicts: [
          {
            ...validResult.validation.identityConflicts[0],
            issueKind: 'pulumi-create-before-delete-conflict'
          }
        ]
      }
    }),
    /conflict at index 0.*issueKind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflicts: [
          {
            ...validResult.validation.identityConflicts[0],
            riskCategory: 'unexpected'
          }
        ]
      }
    }),
    /conflict at index 0.*riskCategory/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflicts: [
          {
            ...validResult.validation.identityConflicts[0],
            identity: {
              listenerRulePriorities: 100
            }
          }
        ]
      }
    }),
    /conflict at index 0 identity values/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflicts: [
          {
            ...validResult.validation.identityConflicts[0],
            sourceCommand: ''
          }
        ]
      }
    }),
    /conflict at index 0.*sourceCommand/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflicts: [
          {
            ...validResult.validation.identityConflicts[0],
            reviewSteps: ['review', 1]
          }
        ]
      }
    }),
    /conflict at index 0.*reviewSteps/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflicts: [
          {
            ...validResult.validation.identityConflicts[0],
            mutationAllowed: true
          }
        ]
      }
    }),
    /conflict at index 0.*mutationAllowed/
  );
});
