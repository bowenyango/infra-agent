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
