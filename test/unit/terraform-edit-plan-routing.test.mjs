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

test('inspectWorkspace detects Terraform roots and tfvars files', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');

  assert.equal(inspection.profile.id, 'generic');
  assert.equal(inspection.terraformRoots.length, 1);
  assert.equal(inspection.fileCounts.terraformRootFiles, 1);
  assert.equal(inspection.fileCounts.terraformVariableFiles, 1);
  assert.equal(inspection.terraformRoots[0]?.rootPath, 'terraform/payments-api');
  assert.ok(inspection.terraformRoots[0]?.environmentHints.includes('dev'));
});

test('targeting prefers Terraform roots for Terraform-oriented tasks', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const targeting = buildTargetCandidates('update terraform payments-api dev image tag to 2.3.4', inspection);

  assert.equal(targeting.targetCandidates[0]?.kind, 'terraform-root');
  assert.equal(targeting.targetCandidates[0]?.path, 'terraform/payments-api');
  assert.ok(targeting.targetCandidates[0]?.matchedEnvironmentHints.includes('dev'));
});

test('targeting prefers requested Helm domain over higher-scoring non-Helm candidates in mixed workspaces', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const targeting = buildTargetCandidates('add ingress to payments-api dev chart', inspection);

  assert.equal(targeting.targetCandidates[0]?.kind, 'helm-chart');
  assert.equal(targeting.targetCandidates[0]?.path, 'charts/payments-api');
  assert.equal(targeting.targetCandidates[1]?.kind, 'pulumi-project');
});

test('targeting uses Terraform module hints to disambiguate multi-root workspaces', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-multi-root-workspace');
  const targeting = buildTargetCandidates('update terraform alb dev image tag to 2.3.4', inspection);

  assert.equal(inspection.terraformRoots.length, 2);
  assert.equal(targeting.targetCandidates[0]?.kind, 'terraform-root');
  assert.equal(targeting.targetCandidates[0]?.path, 'terraform/network-stack');
  assert.ok(targeting.targetCandidates[0]?.reasons.some(reason => /repository hints matched service token/i.test(reason)));
});

test('detectRequestedService ignores generic Terraform config nouns like image and tag', () => {
  assert.equal(detectRequestedService('update terraform dev image tag to 2.3.4'), null);
});

test('Terraform target candidates expose tfvars and module hint details for non-infra users', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-multi-root-workspace');
  const targeting = buildTargetCandidates('update terraform alb dev image tag to 2.3.4', inspection);

  assert.ok(targeting.targetCandidates[0]?.details?.some(detail => /tfvars:/i.test(detail)));
  assert.ok(targeting.targetCandidates[0]?.details?.some(detail => /module hints:/i.test(detail)));
});

test('buildRunPreflight warns when multiple Terraform roots match with similar confidence', async () => {
  const preflight = await buildRunPreflight('update terraform image tag to 2.3.4', 'fixtures/terraform-multi-root-workspace');

  assert.ok(preflight.assumptions.some(assumption => /Target service or chart was not explicitly detected/i.test(assumption)));
  assert.ok(preflight.assumptions.some(assumption => /Multiple Terraform roots matched with similar confidence/i.test(assumption)));
  assert.ok(preflight.assumptions.some(assumption => /Terraform environment was not explicit; top candidate offers/i.test(assumption)));
});

test('validation preflight adds Terraform commands for detected Terraform roots', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const validation = buildValidationPreflight(inspection);
  const terraformEntry = validation.plan.find(entry => entry.kind === 'terraform');

  assert.ok(terraformEntry);
  assert.equal(terraformEntry?.target, 'terraform/payments-api');
  assert.deepEqual(terraformEntry?.commands, [
    'terraform -chdir=terraform/payments-api fmt -check -recursive',
    'terraform -chdir=terraform/payments-api validate'
  ]);
});

test('buildEditPlan creates a bounded Terraform tfvars config plan', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const tfvarsPath = resolve('fixtures/terraform-workspace/terraform/payments-api/dev.auto.tfvars');
  const mainTfPath = resolve('fixtures/terraform-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: tfvarsPath,
          content: await readFile(tfvarsPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(editPlan);
  assert.equal(editPlan?.kind, 'terraform-tfvars-config');
  assert.equal(editPlan?.writes[0]?.path, 'terraform/payments-api/dev.auto.tfvars');
  assert.match(editPlan?.rationale ?? '', /Terraform validation allows environment values: dev, stage, prod/);
  assert.match(editPlan?.writes[0]?.content ?? '', /image_tag = "2.3.4"/);
  assert.match(editPlan?.writes[0]?.content ?? '', /environment = "dev"/);
});

test('buildEditPlan respects Terraform string type when formatting numeric-looking tfvars values', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 123', 'fixtures/terraform-workspace');
  const tfvarsPath = resolve('fixtures/terraform-workspace/terraform/payments-api/dev.auto.tfvars');
  const mainTfPath = resolve('fixtures/terraform-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: tfvarsPath,
          content: await readFile(tfvarsPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(editPlan);
  assert.match(editPlan?.rationale ?? '', /Terraform declares image_tag as string/);
  assert.match(editPlan?.writes[0]?.content ?? '', /image_tag = "123"/);
  assert.doesNotMatch(editPlan?.writes[0]?.content ?? '', /image_tag = 123/);
});

test('buildEditPlan blocks Terraform tfvars writes that violate enum semantics', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api qa image tag to 2.3.4', 'fixtures/terraform-workspace');
  const tfvarsPath = resolve('fixtures/terraform-workspace/terraform/payments-api/dev.auto.tfvars');
  const mainTfPath = resolve('fixtures/terraform-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: tfvarsPath,
          content: await readFile(tfvarsPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan, null);
});

test('buildEditPlan does not auto-create tfvars in generic terraform-only workspaces without an existing tfvars file', async () => {
  const preflight = await buildRunPreflight(
    'update terraform payments-api dev image tag to 2.3.4',
    'fixtures/terraform-no-tfvars-workspace'
  );
  const mainTfPath = resolve('fixtures/terraform-no-tfvars-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan, null);
});

test('buildEditPlan does not implicitly select one tfvars file when multiple Terraform tfvars options exist without an explicit environment', async () => {
  const preflight = await buildRunPreflight(
    'update terraform payments-api image tag to 2.3.4',
    'fixtures/terraform-multi-tfvars-workspace'
  );
  const mainTfPath = resolve('fixtures/terraform-multi-tfvars-workspace/terraform/payments-api/main.tf');
  const devTfvarsPath = resolve('fixtures/terraform-multi-tfvars-workspace/terraform/payments-api/dev.auto.tfvars');
  const prodTfvarsPath = resolve('fixtures/terraform-multi-tfvars-workspace/terraform/payments-api/prod.auto.tfvars');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: devTfvarsPath,
          content: await readFile(devTfvarsPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: prodTfvarsPath,
          content: await readFile(prodTfvarsPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan, null);
});

test('buildEditPlan selects the matching tfvars file when Terraform environment is explicit', async () => {
  const preflight = await buildRunPreflight(
    'update terraform payments-api prod image tag to 2.3.4',
    'fixtures/terraform-multi-tfvars-workspace'
  );
  const mainTfPath = resolve('fixtures/terraform-multi-tfvars-workspace/terraform/payments-api/main.tf');
  const devTfvarsPath = resolve('fixtures/terraform-multi-tfvars-workspace/terraform/payments-api/dev.auto.tfvars');
  const prodTfvarsPath = resolve('fixtures/terraform-multi-tfvars-workspace/terraform/payments-api/prod.auto.tfvars');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: devTfvarsPath,
          content: await readFile(devTfvarsPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: prodTfvarsPath,
          content: await readFile(prodTfvarsPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan?.kind, 'terraform-tfvars-config');
  assert.equal(editPlan?.writes[0]?.path, 'terraform/payments-api/prod.auto.tfvars');
  assert.match(editPlan?.writes[0]?.content ?? '', /image_tag = "2.3.4"/);
  assert.match(editPlan?.writes[0]?.content ?? '', /environment = "prod"/);
});

test('buildEditPlan reuses existing Terraform variable key names from tfvars and variable declarations', async () => {
  const preflight = await buildRunPreflight(
    'update terraform payments-api dev image tag to 4.5.6',
    'fixtures/terraform-alt-keys-workspace'
  );
  const tfvarsPath = resolve('fixtures/terraform-alt-keys-workspace/terraform/payments-api/terraform.auto.tfvars');
  const mainTfPath = resolve('fixtures/terraform-alt-keys-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: tfvarsPath,
          content: await readFile(tfvarsPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(editPlan);
  assert.equal(editPlan?.kind, 'terraform-tfvars-config');
  assert.match(editPlan?.rationale ?? '', /app_image_tag/);
  assert.match(editPlan?.rationale ?? '', /deploy_env/);
  assert.match(editPlan?.writes[0]?.content ?? '', /app_image_tag = "4.5.6"/);
  assert.match(editPlan?.writes[0]?.content ?? '', /deploy_env = "dev"/);
  assert.doesNotMatch(editPlan?.writes[0]?.content ?? '', /^image_tag =/m);
  assert.doesNotMatch(editPlan?.writes[0]?.content ?? '', /^environment =/m);
});

test('buildEditPlan creates a bounded Pulumi missing-config repair plan', async () => {
  const preflight = await buildRunPreflight(
    'update pulumi dev stack for payments-api image tag to 1.2.3',
    'fixtures/sample-workspace'
  );

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: 'fixtures/sample-workspace/infra/payments-api/Pulumi.dev.yaml',
          content: 'config:\n  payments-api:environment: dev\n',
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [
      {
        command: 'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
        exitCode: 1,
        stdout: '',
        stderr: 'error: missing required configuration variable "payments-api:imageTag"; run `pulumi config set payments-api:imageTag <value>`'
      }
    ],
    validationIssues: [
      {
        kind: 'pulumi-missing-config',
        repairable: true,
        sourceCommand: 'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
        message: 'error: missing required configuration variable "payments-api:imageTag"; run `pulumi config set payments-api:imageTag <value>`',
        metadata: {
          missingConfigKey: 'payments-api:imageTag'
        }
      }
    ],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan?.kind, 'pulumi-missing-config-repair');
  assert.equal(editPlan?.pulumiConfigOperations?.[0]?.key, 'payments-api:imageTag');
  assert.equal(editPlan?.pulumiConfigOperations?.[0]?.value, '1.2.3');
  assert.match(editPlan?.writes[0]?.content ?? '', /payments-api:imageTag: 1\.2\.3/);
});

test('buildEditPlan creates a bounded Terraform missing-required-argument repair plan', async () => {
  const preflight = await buildRunPreflight(
    'update terraform payments-api dev image tag to 2.3.4',
    'fixtures/terraform-workspace'
  );
  const tfvarsPath = resolve('fixtures/terraform-workspace/terraform/payments-api/dev.auto.tfvars');
  const mainTfPath = resolve('fixtures/terraform-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: tfvarsPath,
          content: 'environment = "dev"\n',
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      }
    ],
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
        metadata: {
          missingVariableName: 'image_tag'
        }
      }
    ],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan?.kind, 'terraform-missing-required-argument-repair');
  assert.match(editPlan?.writes[0]?.content ?? '', /image_tag = "2\.3\.4"/);
  assert.match(editPlan?.writes[0]?.content ?? '', /environment = "dev"/);
});
