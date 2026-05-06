import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCompactAgentRunResult } from '../../src/cli/agent-result-contract.ts';
import { buildAgentResultContractFixtures } from '../support/agent-result-contract-fixtures.mjs';

test('compact agent result contract rejects validation issue and conflict drift', () => {
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
        loopBudget: {
          ...validResult.harness.loopBudget,
          turnsRemaining: 4
        }
      }
    }),
    /harness\.loopBudget\.turnsRemaining/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        loopBudget: {
          ...validResult.harness.loopBudget,
          exhausted: true
        }
      }
    }),
    /harness\.loopBudget\.exhausted/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        repairBudget: {
          ...validResult.harness.repairBudget,
          maxAttempts: 3
        }
      }
    }),
    /harness\.repairBudget\.maxAttempts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        repairBudget: {
          ...validResult.harness.repairBudget,
          attemptsRemaining: 1
        }
      }
    }),
    /harness\.repairBudget\.attemptsRemaining/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        repairBudget: {
          ...validResult.harness.repairBudget,
          exhausted: true
        }
      }
    }),
    /harness\.repairBudget\.exhausted/
  );
  assert.throws(
    () => parseCompactAgentRunResult({ ...validResult, validation: {} }),
    /validation\.identityConflicts array/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: 'terraform'
      }
    }),
    /validation\.selectedPlan array/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: [
          {
            ...validResult.validation.selectedPlan[0],
            kind: 'ansible'
          }
        ]
      }
    }),
    /validation\.selectedPlan\[0\]\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: [
          {
            ...validResult.validation.selectedPlan[0],
            target: ''
          }
        ]
      }
    }),
    /validation\.selectedPlan\[0\]\.target/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: [
          {
            ...validResult.validation.selectedPlan[0],
            commands: ['terraform plan', 1]
          }
        ]
      }
    }),
    /validation\.selectedPlan\[0\]\.commands/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: [
          {
            ...validResult.validation.selectedPlan[0],
            commandCount: 2
          }
        ]
      }
    }),
    /validation\.selectedPlan\[0\]\.commandCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: [
          {
            ...validResult.validation.selectedPlan[0],
            executedCommandCount: 2
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
            failedCommandCount: 2
          }
        ]
      }
    }),
    /validation\.selectedPlan\[0\]\.failedCommandCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        selectedPlan: [
          {
            ...validResult.validation.selectedPlan[0],
            validatorAvailable: 'yes'
          }
        ]
      }
    }),
    /validation\.selectedPlan\[0\]\.validatorAvailable/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: null
      }
    }),
    /validation\.issueSummary object/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: {
          ...validResult.validation.issueSummary,
          totalCount: '1'
        }
      }
    }),
    /validation\.issueSummary\.totalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: {
          ...validResult.validation.issueSummary,
          repairableCount: 1
        }
      }
    }),
    /validation\.issueSummary repairable counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: {
          ...validResult.validation.issueSummary,
          maxGroups: 0
        }
      }
    }),
    /validation\.issueSummary\.groups length/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: {
          ...validResult.validation.issueSummary,
          groups: [
            {
              ...validResult.validation.issueSummary.groups[0],
              kind: 'unexpected'
            }
          ]
        }
      }
    }),
    /validation\.issueSummary\.groups\[0\]\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: {
          ...validResult.validation.issueSummary,
          groups: [
            {
              ...validResult.validation.issueSummary.groups[0],
              count: 0
            }
          ]
        }
      }
    }),
    /validation\.issueSummary\.groups\[0\]\.count/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: {
          ...validResult.validation.issueSummary,
          groups: [
            {
              ...validResult.validation.issueSummary.groups[0],
              count: 2
            }
          ]
        }
      }
    }),
    /validation\.issueSummary group counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: {
          ...validResult.validation.issueSummary,
          flags: {
            ...validResult.validation.issueSummary.flags,
            hasIdentityConflict: false
          }
        }
      }
    }),
    /validation\.issueSummary\.flags\.hasIdentityConflict/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueDetails: null
      }
    }),
    /validation\.issueDetails object/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueDetails: {
          ...validResult.validation.issueDetails,
          maxEntries: -1
        }
      }
    }),
    /validation\.issueDetails\.maxEntries/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueDetails: {
          ...validResult.validation.issueDetails,
          omittedCount: 1
        }
      }
    }),
    /validation\.issueDetails\.omittedCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issues: {}
      }
    }),
    /validation\.issues array/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueDetails: {
          ...validResult.validation.issueDetails,
          maxEntries: 0
        }
      }
    }),
    /validation\.issues length/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issueSummary: {
          ...validResult.validation.issueSummary,
          omittedIssueCount: 1
        },
        issueDetails: {
          ...validResult.validation.issueDetails,
          omittedCount: 1
        }
      }
    }),
    /validation\.issues length plus omitted count/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issues: [
          {
            ...validResult.validation.issues[0],
            kind: 'unexpected'
          }
        ]
      }
    }),
    /validation\.issues\[0\]\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issues: [
          {
            ...validResult.validation.issues[0],
            repairable: 'no'
          }
        ]
      }
    }),
    /validation\.issues\[0\]\.repairable/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issues: [
          {
            ...validResult.validation.issues[0],
            message: ''
          }
        ]
      }
    }),
    /validation\.issues\[0\]\.message/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issues: [
          {
            ...validResult.validation.issues[0],
            guidance: 1
          }
        ]
      }
    }),
    /validation\.issues\[0\]\.guidance/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issues: [
          {
            ...validResult.validation.issues[0],
            metadata: {
              listenerRulePriorities: 100
            }
          }
        ]
      }
    }),
    /validation\.issues\[0\]\.metadata\.listenerRulePriorities/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        issues: [
          {
            ...validResult.validation.issues[0],
            repairable: true
          }
        ]
      }
    }),
    /validation\.issues repairable count/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        safetyBlockers: null
      }
    }),
    /validation\.safetyBlockers object/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        safetyBlockers: {
          ...validResult.validation.safetyBlockers,
          maxEntries: -1
        }
      }
    }),
    /validation\.safetyBlockers\.maxEntries/
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
      validation: {
        ...validResult.validation,
        safetyBlockers: {
          ...validResult.validation.safetyBlockers,
          maxEntries: 0,
          entries: [validSafetyBlocker]
        }
      }
    }),
    /validation\.safetyBlockers\.entries length/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        safetyBlockers: {
          ...validResult.validation.safetyBlockers,
          entries: [
            {
              ...validSafetyBlocker,
              kind: 'terraform-create-before-delete-conflict'
            }
          ]
        }
      }
    }),
    /validation\.safetyBlockers\.entries\[0\]\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        safetyBlockers: {
          ...validResult.validation.safetyBlockers,
          entries: [
            {
              ...validSafetyBlocker,
              sourceCommand: ''
            }
          ]
        }
      }
    }),
    /validation\.safetyBlockers\.entries\[0\]\.sourceCommand/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        safetyBlockers: {
          ...validResult.validation.safetyBlockers,
          entries: [
            {
              ...validSafetyBlocker,
              mutationPrevented: false
            }
          ]
        }
      }
    }),
    /validation\.safetyBlockers\.entries\[0\]\.mutationPrevented/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        safetyBlockers: {
          ...validResult.validation.safetyBlockers,
          entries: [
            {
              ...validSafetyBlocker,
              unsafeRuleId: 1
            }
          ]
        }
      }
    }),
    /validation\.safetyBlockers\.entries\[0\]\.unsafeRuleId/
  );
  assert.throws(
    () => parseCompactAgentRunResult(resultWithSafetyBlockers([
      {
        ...validUnsafeSafetyBlocker,
        unsafeCommand: ''
      }
    ])),
    /validation\.safetyBlockers\.entries\[0\]\.unsafeCommand.*unsafe-validation-command/
  );
  assert.throws(
    () => parseCompactAgentRunResult(resultWithSafetyBlockers([
      {
        ...validUnsafeSafetyBlocker,
        yamlPath: 'terraform/payments-api/dev.auto.tfvars'
      }
    ])),
    /validation\.safetyBlockers\.entries\[0\]\.yamlPath.*unsafe-validation-command/
  );
  assert.throws(
    () => parseCompactAgentRunResult(resultWithSafetyBlockers([
      {
        ...validSafetyBlocker,
        yamlParser: ''
      }
    ])),
    /validation\.safetyBlockers\.entries\[0\]\.yamlParser.*yaml-syntax-failure/
  );
  assert.throws(
    () => parseCompactAgentRunResult(resultWithSafetyBlockers([
      {
        ...validSafetyBlocker,
        unsafeReason: 'Terraform apply mutates infrastructure state.'
      }
    ])),
    /validation\.safetyBlockers\.entries\[0\]\.unsafeReason.*yaml-syntax-failure/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: null
      }
    }),
    /identityConflictSummary object/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          totalCount: '1'
        }
      }
    }),
    /identityConflictSummary\.totalCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          mutationAllowed: true
        }
      }
    }),
    /identityConflictSummary\.mutationAllowed/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          totalCount: 2,
          includedCount: 1,
          omittedCount: 0
        }
      }
    }),
    /identityConflictSummary counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          totalCount: 6,
          includedCount: 6,
          omittedCount: 0
        }
      }
    }),
    /identityConflictSummary\.includedCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          includedCount: 0,
          omittedCount: 1
        }
      }
    }),
    /identityConflictSummary\.includedCount.*identityConflicts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          byEngine: {
            ansible: 1
          }
        }
      }
    }),
    /identityConflictSummary\.byEngine/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          byEngine: {
            terraform: 0,
            pulumi: 0
          }
        }
      }
    }),
    /identityConflictSummary\.byEngine counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          byEngine: {
            terraform: 0,
            pulumi: 1
          }
        }
      }
    }),
    /identityConflictSummary\.byEngine must cover/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          byRiskCategory: {
            'create-before-delete-ordering': '1'
          }
        }
      }
    }),
    /identityConflictSummary\.byRiskCategory/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          byRiskCategory: {
            'create-before-delete-ordering': 0,
            'dns-or-domain-ownership': 0,
            'exclusive-identity-review': 0,
            'kubernetes-object-ownership': 0,
            'physical-name-ownership': 0
          }
        }
      }
    }),
    /identityConflictSummary\.byRiskCategory counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      validation: {
        ...validResult.validation,
        identityConflictSummary: {
          ...validResult.validation.identityConflictSummary,
          byRiskCategory: {
            'create-before-delete-ordering': 0,
            'dns-or-domain-ownership': 0,
            'exclusive-identity-review': 0,
            'kubernetes-object-ownership': 0,
            'physical-name-ownership': 1
          }
        }
      }
    }),
    /identityConflictSummary\.byRiskCategory must cover/
  );
});
