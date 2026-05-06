import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCompactAgentRunResult } from '../../src/cli/agent-result-contract.ts';
import { buildAgentResultContractFixtures } from '../support/agent-result-contract-fixtures.mjs';

test('compact agent result contract accepts core shape and rejects targeting/work plan drift', () => {
  const {
    validResult,
    validSafetyBlocker,
    validUnsafeSafetyBlocker,
    resultWithSafetyBlockers,
    resultWithToolEntries,
    twoToolEntries
  } = buildAgentResultContractFixtures();
  assert.equal(parseCompactAgentRunResult(validResult).kind, 'infra-agent.agent-result');
  assert.equal(parseCompactAgentRunResult(resultWithToolEntries(twoToolEntries)).kind, 'infra-agent.agent-result');
  assert.equal(
    parseCompactAgentRunResult(resultWithSafetyBlockers([validSafetyBlocker, validUnsafeSafetyBlocker])).kind,
    'infra-agent.agent-result'
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        targeting: null
      }
    }),
    /harness\.targeting/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        targeting: {
          ...validResult.harness.targeting,
          source: 'raw-preflight'
        }
      }
    }),
    /harness\.targeting\.source/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        targeting: {
          ...validResult.harness.targeting,
          includedCount: 0
        }
      }
    }),
    /harness\.targeting\.includedCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        targeting: {
          ...validResult.harness.targeting,
          ambiguityKinds: ['missing-service', 'manual-review']
        }
      }
    }),
    /harness\.targeting\.ambiguityKinds/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        targeting: {
          ...validResult.harness.targeting,
          candidates: [
            {
              ...validResult.harness.targeting.candidates[0],
              kind: 'ansible-playbook'
            }
          ]
        }
      }
    }),
    /harness\.targeting\.candidates\[0\]\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          targeting: {
            includedCount: 0,
            omittedCount: 0
          }
        }
      }
    }),
    /handoffCheckpoint\.budgets\.targeting must match harness\.targeting/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      primaryTarget: {
        ...validResult.primaryTarget,
        path: 'terraform/other'
      }
    }),
    /harness\.targeting\.selectedTarget\.path.*root\.primaryTarget\.path/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        targeting: {
          ...validResult.harness.targeting,
          selectedTarget: {
            ...validResult.harness.targeting.selectedTarget,
            domain: 'helm'
          }
        }
      }
    }),
    /harness\.targeting\.selectedTarget\.domain must match kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        targeting: {
          ...validResult.harness.targeting,
          scoreGapToNext: 1
        }
      }
    }),
    /harness\.targeting\.scoreGapToNext/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        targeting: {
          ...validResult.harness.targeting,
          flags: {
            ...validResult.harness.targeting.flags,
            missingService: false
          }
        }
      }
    }),
    /harness\.targeting\.ambiguityKinds must match flags/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        targeting: {
          ...validResult.harness.targeting,
          recommendedAction: 'inspect-selected-target'
        }
      }
    }),
    /harness\.targeting\.recommendedAction/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: null
      }
    }),
    /harness\.workPlan/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          source: 'todo-store'
        }
      }
    }),
    /harness\.workPlan\.source/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          includedCount: 5
        }
      }
    }),
    /harness\.workPlan\.includedCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          steps: [
            validResult.harness.workPlan.steps[0],
            {
              ...validResult.harness.workPlan.steps[1],
              index: 0
            },
            ...validResult.harness.workPlan.steps.slice(2)
          ]
        }
      }
    }),
    /harness\.workPlan\.steps indexes/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          steps: [
            {
              ...validResult.harness.workPlan.steps[0],
              kind: 'deploy'
            },
            ...validResult.harness.workPlan.steps.slice(1)
          ]
        }
      }
    }),
    /harness\.workPlan\.steps\[0\]\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          blockerKind: 'approval'
        }
      }
    }),
    /harness\.workPlan\.blockerKind.*plannerHandoff/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          status: 'completed'
        }
      }
    }),
    /harness\.workPlan\.status must be blocked/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          blockedStepCount: 1
        }
      }
    }),
    /harness\.workPlan\.blockedStepCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          skippedStepCount: 1
        }
      }
    }),
    /harness\.workPlan\.skippedStepCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          currentStepIndex: 1
        }
      }
    }),
    /harness\.workPlan\.currentStepIndex.*blocked or in-progress/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          steps: [
            ...validResult.harness.workPlan.steps.slice(0, 3),
            {
              ...validResult.harness.workPlan.steps[3],
              validationIssueKind: 'terraform-create-before-delete-conflict'
            },
            ...validResult.harness.workPlan.steps.slice(4)
          ]
        }
      }
    }),
    /harness\.workPlan\.steps\[3\]\.validationIssueKind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        workPlan: {
          ...validResult.harness.workPlan,
          steps: [
            ...validResult.harness.workPlan.steps.slice(0, 4),
            {
              ...validResult.harness.workPlan.steps[4],
              approvalSignalKind: 'write-approval-required'
            },
            validResult.harness.workPlan.steps[5]
          ].flat()
        }
      }
    }),
    /harness\.workPlan\.steps\[4\]\.approvalSignalKind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          workPlan: {
            includedCount: 5,
            omittedCount: 0
          }
        }
      }
    }),
    /handoffCheckpoint\.budgets\.workPlan must match harness\.workPlan/
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
              command: 'terraform validate'
            }
          ]
        }
      }
    }),
    /validation\.commands\.entries\[0\]\.command.*validation\.selectedPlan/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: [
          validResult.validation.selectedPlan[0],
          {
            ...validResult.validation.selectedPlan[0],
            executedCommandCount: 0,
            failedCommandCount: 0
          }
        ]
      }
    }),
    /validation\.selectedPlan command "terraform plan".*validation\.selectedPlan\[0\].*validation\.selectedPlan\[1\]/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: [
          {
            ...validResult.validation.selectedPlan[0],
            executedCommandCount: 0,
            failedCommandCount: 0
          }
        ]
      }
    }),
    /validation\.selectedPlan\[0\]\.executedCommandCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: [
          {
            ...validResult.validation.selectedPlan[0],
            failedCommandCount: 0
          }
        ]
      }
    }),
    /validation\.selectedPlan\[0\]\.failedCommandCount/
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
          includedCount: 2,
          omittedCount: 0
        }
      }
    },
    validation: {
      ...validResult.validation,
      yamlGuardCount: 1,
      commands: {
        ...validResult.validation.commands,
        entries: [
          ...validResult.validation.commands.entries,
          {
            command: 'yaml guard terraform/payments-api/dev.auto.tfvars',
            exitCode: 0,
            status: 'passed',
            kind: 'yaml-guard',
            stdoutPreview: '',
            stderrPreview: '',
            unsafeBlocked: false,
            unsafeRuleId: null,
            unsafeReason: null
          }
        ]
      }
    }
  }).validation.yamlGuardCount, 1);
});
