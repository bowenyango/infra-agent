import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  cp,
  mkdir,
  readFile,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  resolve,
  join
} from 'node:path';
import { captureStdout } from '../support/capture-stdout.mjs';
import { executeDecision } from '../../src/agent/execute-decision.ts';
import { buildRunPreflight } from '../../src/agent/build-run-preflight.ts';
import { selectValidationCommands } from '../../src/agent/select-validation-commands.ts';
import { classifyValidationIssues } from '../../src/agent/classify-validation-issues.ts';
import { LLMModelClient } from '../../src/model/LLMModelClient.ts';
import {
  createModelClient,
  createModelClientSelection
} from '../../src/model/create-model-client.ts';
import { resolveLLMClientConfig } from '../../src/model/config.ts';
import { createLLMProviderAdapter } from '../../src/model/provider-adapter.ts';
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
  listLLMProviderCatalog,
  resolveLLMProviderCapabilities
} from '../../src/model/providers.ts';
import { parsePlannerDecision } from '../../src/model/decision-parser.ts';
import {
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt
} from '../../src/model/prompt.ts';
import { printPlannerProviderCatalogReport } from '../../src/cli/output.ts';
import {
  buildPlannerProviderCatalogDiscovery,
  buildPlannerProviderCatalogReport,
  PLANNER_PROVIDER_CATALOG_COMMAND
} from '../../src/cli/planner-provider-catalog.ts';
import { parsePlannerProviderCatalogReport } from '../../src/cli/planner-provider-catalog-contract.ts';
import { executeTool } from '../../src/services/tools/execute-tool.ts';
import { PulumiConfigSetTool } from '../../src/tools/PulumiConfigSetTool/PulumiConfigSetTool.ts';
import { ValidateTargetsTool } from '../../src/tools/ValidateTargetsTool/ValidateTargetsTool.ts';
import { classifyUnsafeValidationCommand } from '../../src/validators/command-safety.ts';
import {
  deriveConfigSemanticsFromValidationIssues,
  mergeConfigSemantics
} from '../../src/agent/config-semantics-state.ts';
import { buildKnowledgePack } from '../../src/knowledge/pack.ts';

test('parsePlannerDecision requires stopReason for stop actions', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');

  assert.throws(
    () =>
      parsePlannerDecision(
        JSON.stringify({
          confidence: 'medium',
          action: {
            kind: 'stop',
            summary: 'Stop here',
            rationale: 'No further work'
          }
        }),
        {
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
      ),
    /action\.payload\.stopReason/
  );
});

test('parsePlannerDecision accepts supported stopReason values', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'high',
      action: {
        kind: 'stop',
        summary: 'Validation passed',
        rationale: 'All configured validators succeeded.',
        payload: {
          stopReason: 'validation-succeeded'
        }
      }
    }),
    {
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
  );

  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'validation-succeeded');
  assert.equal(decision.action.payload?.actionFamily, 'validation-complete');
});

test('parsePlannerDecision accepts supported clarificationKind values', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'high',
      action: {
        kind: 'ask-for-clarification',
        summary: 'Approval required',
        rationale: 'High-risk rewrite detected.',
        payload: {
          clarificationKind: 'approval-required',
          questions: ['Proceed with this rewrite?']
        }
      }
    }),
    {
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
  );

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.clarificationKind, 'approval-required');
  assert.equal(decision.action.payload?.actionFamily, 'approval-clarification');
});

test('parsePlannerDecision preserves supported actionFamily metadata', async () => {
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
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'high',
      action: {
        kind: 'validate-targets',
        summary: 'Run validation',
        rationale: 'The LLM copied a supported metadata family.',
        payload: {
          actionFamily: 'helm-validation',
          commands: selectValidationCommands(runtime)
        }
      }
    }),
    runtime
  );

  assert.equal(decision.action.payload?.actionFamily, 'helm-validation');
});

test('parsePlannerDecision normalizes unsupported actionFamily metadata', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
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
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'medium',
      action: {
        kind: 'validate-targets',
        summary: 'Run validation',
        rationale: 'The LLM provided unsupported metadata.',
        payload: {
          actionFamily: 'pulumi-up-now',
          commands: selectValidationCommands(runtime)
        }
      }
    }),
    runtime
  );

  assert.equal(decision.action.payload?.actionFamily, 'terraform-validation');
});

test('parsePlannerDecision derives stop actionFamily from stopReason when omitted', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'medium',
      action: {
        kind: 'stop',
        summary: 'Repair budget exhausted',
        rationale: 'The bounded repair budget has been consumed.',
        payload: {
          stopReason: 'repair-budget-exhausted'
        }
      }
    }),
    {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 2,
      maxRepairAttempts: 2,
      lastEditPlan: null
    }
  );

  assert.equal(decision.action.payload?.actionFamily, 'repair-budget-exhausted');
});

test('parsePlannerDecision clamps validate-targets commands to the selected validation plan', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
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
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'high',
      action: {
        kind: 'validate-targets',
        summary: 'Run validation',
        rationale: 'The LLM mixed a safe command with unsafe invented commands.',
        payload: {
          commands: [
            'terraform -chdir=terraform/payments-api apply -auto-approve',
            'helm template charts/payments-api',
            'terraform -chdir=terraform/payments-api validate'
          ]
        }
      }
    }),
    runtime
  );

  assert.deepEqual(decision.action.payload?.commands, [
    'terraform -chdir=terraform/payments-api validate'
  ]);
});

test('parsePlannerDecision falls back to selected validation commands when all LLM commands are invented', async () => {
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
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'medium',
      action: {
        kind: 'validate-targets',
        summary: 'Run validation',
        rationale: 'The LLM did not copy commands from the selected plan.',
        payload: {
          commands: [
            'pulumi up --cwd infra/payments-api --stack dev --yes',
            'terraform -chdir=terraform/payments-api apply -auto-approve'
          ]
        }
      }
    }),
    runtime
  );

  assert.deepEqual(decision.action.payload?.commands, selectValidationCommands(runtime));
  assert.ok(decision.action.payload?.commands?.every(command => /^helm (?:lint|template) charts\/payments-api$/.test(command)));
});

test('parsePlannerDecision clamps inspect target paths to known target candidates', async () => {
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
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'high',
      action: {
        kind: 'inspect-target-files',
        summary: 'Inspect targets',
        rationale: 'The LLM mixed valid and invalid target paths.',
        payload: {
          targetPaths: [
            '../secrets',
            'charts/payments-api',
            '/tmp/unrelated'
          ]
        }
      }
    }),
    runtime
  );

  assert.deepEqual(decision.action.payload?.targetPaths, ['charts/payments-api']);
});

test('parsePlannerDecision falls back to known inspect targets when all LLM target paths are invalid', async () => {
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
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'medium',
      action: {
        kind: 'inspect-target-files',
        summary: 'Inspect targets',
        rationale: 'The LLM invented target paths.',
        payload: {
          targetPaths: [
            '../secrets',
            '/tmp/unrelated'
          ]
        }
      }
    }),
    runtime
  );

  assert.deepEqual(
    decision.action.payload?.targetPaths,
    preflight.targetCandidates.slice(0, 3).map(candidate => candidate.path)
  );
});

test('parsePlannerDecision clamps Terraform formatting root path to Terraform candidates', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
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
  const invalidDecision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'medium',
      action: {
        kind: 'repair-terraform-formatting',
        summary: 'Repair formatting',
        rationale: 'The LLM proposed an unrelated path.',
        payload: {
          rootPath: '../terraform'
        }
      }
    }),
    runtime
  );
  const validDecision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'high',
      action: {
        kind: 'repair-terraform-formatting',
        summary: 'Repair formatting',
        rationale: 'The LLM copied the selected Terraform root.',
        payload: {
          rootPath: 'terraform/payments-api'
        }
      }
    }),
    runtime
  );

  assert.equal(invalidDecision.action.payload?.rootPath, 'terraform/payments-api');
  assert.equal(validDecision.action.payload?.rootPath, 'terraform/payments-api');
});
