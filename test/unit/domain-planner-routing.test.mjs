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
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { runSingleStep } from '../../src/agent/run-single-step.ts';
import { executeDecision } from '../../src/agent/execute-decision.ts';
import {
  buildTargetCandidates,
  detectRequestedService
} from '../../src/domain/task-targeting.ts';
import { buildRunPreflight } from '../../src/agent/build-run-preflight.ts';
import { buildValidationPreflight } from '../../src/validators/preflight.ts';
import { classifyValidationIssues } from '../../src/agent/classify-validation-issues.ts';
import { RuleBasedPlanningModel } from '../../src/agent/rule-based-planner.ts';
import { buildEditPlan } from '../../src/agent/build-edit-plan.ts';
import { main } from '../../src/cli/main.ts';

test('rule-based planner asks Terraform-specific clarification questions when Terraform task lacks root and environment detail', async () => {
  const preflight = await buildRunPreflight('update terraform variables', 'fixtures/terraform-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
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
    }
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.clarificationKind, 'target-ambiguity');
  assert.match(decision.action.summary, /Terraform root, variables, or environment/i);
  assert.ok(decision.action.payload?.questions?.some(question => /Which Terraform root should be updated\?/i.test(question)));
  assert.ok(decision.action.payload?.questions?.some(question => /terraform\/payments-api/i.test(question)));
  assert.ok(decision.action.payload?.questions?.some(question => /tfvars file/i.test(question)));
});

test('rule-based planner asks for primary domain clarification when a task spans multiple detected domains', async () => {
  const preflight = await buildRunPreflight('update helm and pulumi config for payments-api dev', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
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
    }
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.clarificationKind, 'target-ambiguity');
  assert.match(decision.action.rationale, /multiple infrastructure domains/i);
  assert.ok(decision.action.payload?.questions?.some(question => /Which primary domain should the agent modify first/i.test(question)));
});

test('rule-based planner asks Terraform-specific clarification when no Terraform root is detected', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-empty-terraform-'));

  try {
    const preflight = await buildRunPreflight('update terraform variables', tempRoot);
    const planner = new RuleBasedPlanningModel();
    const decision = await planner.decideNextAction({
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
      }
    });

    assert.equal(decision.action.kind, 'ask-for-clarification');
    assert.match(decision.action.summary, /Terraform workspace and target/i);
    assert.ok(decision.action.payload?.questions?.some(question => /existing tfvars file/i.test(question)));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based planner asks Helm-specific clarification questions when Helm task lacks chart and environment detail', async () => {
  const preflight = await buildRunPreflight('update helm values', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
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
    }
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.clarificationKind, 'target-ambiguity');
  assert.match(decision.action.summary, /Helm chart, values scope, or environment/i);
  assert.ok(decision.action.payload?.questions?.some(question => /Which Helm chart should be updated\?/i.test(question)));
  assert.ok(decision.action.payload?.questions?.some(question => /Which environment values or chart variant should be updated\?/i.test(question)));
});

test('rule-based planner asks Pulumi-specific clarification questions when Pulumi task lacks project and environment detail', async () => {
  const preflight = await buildRunPreflight('update pulumi config', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
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
    }
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.clarificationKind, 'target-ambiguity');
  assert.match(decision.action.summary, /Pulumi project, stack, or environment/i);
  assert.ok(decision.action.payload?.questions?.some(question => /Which Pulumi project should be updated\?/i.test(question)));
  assert.ok(decision.action.payload?.questions?.some(question => /Which stack or environment should be updated\?/i.test(question)));
});

test('rule-based planner asks Helm-specific clarification when no Helm chart is detected', async () => {
  const preflight = await buildRunPreflight('add helm ingress', 'fixtures/terraform-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
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
    }
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.match(decision.action.summary, /Helm workspace and target/i);
  assert.ok(decision.action.payload?.questions?.some(question => /Which Helm chart or chart directory should be updated\?/i.test(question)));
});

test('rule-based planner asks Pulumi-specific clarification when no Pulumi project is detected', async () => {
  const preflight = await buildRunPreflight('update pulumi stack', 'fixtures/terraform-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
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
    }
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.match(decision.action.summary, /Pulumi workspace and target/i);
  assert.ok(decision.action.payload?.questions?.some(question => /Which Pulumi project or stack directory should be updated\?/i.test(question)));
});

test('rule-based planner includes Terraform root options in clarification for multi-root ambiguity', async () => {
  const preflight = await buildRunPreflight('update terraform image tag to 2.3.4', 'fixtures/terraform-multi-root-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
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
    }
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.ok(decision.action.payload?.questions?.some(question => /terraform\/network-stack/i.test(question)));
  assert.ok(decision.action.payload?.questions?.some(question => /terraform\/worker-stack/i.test(question)));
  assert.ok(decision.action.payload?.questions?.some(question => /dev\.auto\.tfvars/i.test(question)));
});

test('rule-based planner emits Terraform-specific inspection summary for Terraform tasks', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
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
    }
  });

  assert.equal(decision.action.kind, 'inspect-target-files');
  assert.equal(decision.action.payload?.actionFamily, 'terraform-inspection');
  assert.match(decision.action.summary, /Inspect the selected Terraform root files/i);
  assert.match(decision.action.rationale, /requested terraform task/i);
});

test('rule-based planner emits Helm-specific validation summary for Helm tasks', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight,
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: 'charts/payments-api/values.yaml',
            content: 'ingress:\n  enabled: true\n',
            truncated: false
          }
        }
      ],
      appliedWrites: [
        {
          path: 'charts/payments-api/values.yaml',
          content: 'ingress:\n  enabled: true\n',
          reason: 'test write',
          mode: 'append',
          risk: 'low'
        }
      ],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'validate-targets');
  assert.equal(decision.action.payload?.actionFamily, 'helm-validation');
  assert.match(decision.action.summary, /Run Helm validators for the selected chart/i);
  assert.match(decision.action.rationale, /requested helm path/i);
});

test('rule-based planner tags Pulumi ambiguity clarifications with a Pulumi action family', async () => {
  const preflight = await buildRunPreflight('update pulumi stack', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
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
    }
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.actionFamily, 'pulumi-clarification');
});

test('rule-based planner tags validation-blocked stop actions with validation-blocked action family', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight,
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: 'terraform/payments-api/main.tf',
            content: 'variable "app_image_tag" { type = string }\n',
            truncated: false
          }
        }
      ],
      appliedWrites: [
        {
          path: 'terraform/payments-api/dev.auto.tfvars',
          content: 'app_image_tag = "2.3.4"\n',
          reason: 'test write'
        }
      ],
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
    }
  });

  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.actionFamily, 'validation-blocked');
  assert.equal(decision.action.payload?.stopReason, 'validation-blocked');
});

test('rule-based agent repairs missing ingress values after validation failure', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-repair-ingress-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/repair-ingress-values-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add readiness and liveness probes to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    assert.ok(result.turns.some(turn => turn.decision.action.payload?.editPlan?.kind === 'helm-ingress-values-repair'));
    assert.ok(result.runtime.repairAttempts >= 1);
    assert.ok(result.runtime.validationResults.every(entry => entry.exitCode === 0));
    assert.equal(result.runtime.validationIssues.length, 0);
    assert.equal(result.outcome, 'completed');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based planner stops with repair-budget-exhausted after bounded retries are consumed', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight,
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: 'charts/payments-api/values.yaml',
            content: 'service:\n  port: 8080\n',
            truncated: false
          }
        }
      ],
      appliedWrites: [
        {
          path: 'charts/payments-api/values.yaml',
          content: 'service:\n  port: 8080\n',
          reason: 'test write'
        }
      ],
      validationResults: [
        {
          command: 'helm template charts/payments-api',
          exitCode: 1,
          stdout: '',
          stderr: 'template: charts/payments-api/templates/ingress.yaml: executing at <.Values.ingress.enabled>: nil pointer evaluating interface {}.enabled'
        }
      ],
      validationIssues: [
        {
          kind: 'helm-missing-ingress-values',
          repairable: true,
          sourceCommand: 'helm template charts/payments-api',
          message: 'Validation failed because a Helm template references .Values.ingress.enabled but the values file does not define ingress settings.'
        }
      ],
      approvalSignals: [],
      repairAttempts: 2,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'repair-budget-exhausted');
  assert.match(decision.action.summary, /repair budget/i);
});

test('rule-based agent emits ingress edit plan against fixture workspace copy', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-test-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add ingress to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    assert.match(result.modelName, /rule-based/);
    assert.equal(result.outcome, 'completed');
    assert.ok(result.runtime.appliedWrites.length > 0);
    assert.ok(result.turns.some(turn => turn.execution?.executedTools.some(tool => tool.toolName === 'diff_preview')));
    assert.ok(result.turns.some(turn => turn.execution?.executedTools.some(tool => tool.toolName === 'append_file')));
    const ingressTurn = result.turns.find(turn => turn.decision.action.payload?.editPlan?.kind === 'helm-ingress');
    assert.ok(ingressTurn?.decision.action.payload?.writes?.some(write => write.mode === 'append'));
    assert.ok(ingressTurn?.decision.action.payload?.writes?.some(write => write.mode === 'create'));
    assert.ok(
      result.turns.some(turn => turn.decision.action.payload?.editPlan?.kind === 'helm-ingress')
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based probes path uses replace mode for deployment template edits', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-probes-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add readiness and liveness probes to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    const probesTurn = result.turns.find(turn => turn.decision.action.payload?.editPlan?.kind === 'helm-probes');
    assert.ok(probesTurn?.decision.action.payload?.writes?.some(write => write.mode === 'replace'));
    assert.ok(result.turns.some(turn => turn.execution?.executedTools.some(tool => tool.toolName === 'replace_file')));
    assert.equal(result.outcome, 'completed');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
