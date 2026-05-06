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

test('apply-edit-plan execution uses append_file for append-mode writes', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-append-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const existingValues = await readFile(join(workspaceRoot, 'charts/payments-api/values.yaml'), 'utf8');
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: 'Append bounded values update.',
          rationale: 'Test append tool path.',
          payload: {
            writes: [
              {
                path: 'charts/payments-api/values.yaml',
                content: `${existingValues.trimEnd()}\n\nfeatureFlag:\n  enabled: true\n`,
                reason: 'Append test block',
                mode: 'append'
              }
            ]
          }
        }
      },
      workspaceRoot,
      null
    );

    assert.ok(execution);
    assert.equal(execution?.executedTools[0]?.toolName, 'diff_preview');
    assert.equal(execution?.executedTools[1]?.toolName, 'validate_yaml_syntax');
    assert.equal(execution?.executedTools[2]?.toolName, 'append_file');
    assert.equal(execution?.executedTools[3]?.toolName, 'validate_yaml_syntax');
    const updatedValues = await readFile(join(workspaceRoot, 'charts/payments-api/values.yaml'), 'utf8');
    assert.match(updatedValues, /featureFlag:\n  enabled: true/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('apply-edit-plan execution uses replace_file for replace-mode writes', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-replace-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const deploymentPath = join(workspaceRoot, 'charts/payments-api/templates/deployment.yaml');
    const existingDeployment = await readFile(deploymentPath, 'utf8');
    const before = '          resources:\n';
    const after = [
      '          readinessProbe:',
      '            httpGet:',
      '              path: /healthz',
      '              port: http',
      '          resources:\n'
    ].join('\n');
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: 'Replace bounded deployment segment.',
          rationale: 'Test replace tool path.',
          payload: {
            writes: [
              {
                path: 'charts/payments-api/templates/deployment.yaml',
                content: existingDeployment.replace(before, after),
                reason: 'Insert readiness probe block',
                mode: 'replace',
                replacePatch: {
                  before,
                  after
                }
              }
            ]
          }
        }
      },
      workspaceRoot,
      null
    );

    assert.ok(execution);
    assert.equal(execution?.executedTools[0]?.toolName, 'diff_preview');
    assert.equal(execution?.executedTools[1]?.toolName, 'replace_file');
    const updatedDeployment = await readFile(deploymentPath, 'utf8');
    assert.match(updatedDeployment, /readinessProbe:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('PulumiConfigSetTool applies bounded stack config updates through the Pulumi CLI', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-config-set-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const result = await executeTool(
      PulumiConfigSetTool,
      {
        projectRoot: 'infra/payments-api',
        stackName: 'dev',
        key: 'payments-api:imageTag',
        value: '9.9.9'
      },
      {
        workspaceRoot,
        workspaceConfig: null
      }
    );

    assert.equal(result.toolName, 'pulumi_config_set');
    assert.equal(result.output.exitCode, 0);
    assert.equal(result.output.stackFilePath, 'infra/payments-api/Pulumi.dev.yaml');
    assert.match(result.output.content, /payments-api:imageTag: 9\.9\.9/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('apply-edit-plan execution uses pulumi_config_set for Pulumi stack config plans', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-apply-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: 'Apply Pulumi stack configuration updates.',
          rationale: 'Use the native Pulumi CLI for bounded stack config writes.',
          payload: {
            editPlan: {
              kind: 'pulumi-stack-config',
              summary: 'Apply Pulumi stack configuration updates to infra/payments-api/Pulumi.dev.yaml.',
              rationale: 'Synthetic Pulumi config write.',
              pulumiConfigOperations: [
                {
                  projectRoot: 'infra/payments-api',
                  stackName: 'dev',
                  key: 'payments-api:environment',
                  value: 'dev'
                },
                {
                  projectRoot: 'infra/payments-api',
                  stackName: 'dev',
                  key: 'payments-api:imageTag',
                  value: '2.4.6'
                }
              ],
              writes: [
                {
                  path: 'infra/payments-api/Pulumi.dev.yaml',
                  content: 'config:\n  payments-api:environment: dev\n  payments-api:imageTag: 2.4.6\n',
                  reason: 'Synthetic Pulumi stack config write.'
                }
              ]
            },
            writes: [
              {
                path: 'infra/payments-api/Pulumi.dev.yaml',
                content: 'config:\n  payments-api:environment: dev\n  payments-api:imageTag: 2.4.6\n',
                reason: 'Synthetic Pulumi stack config write.'
              }
            ]
          }
        }
      },
      workspaceRoot,
      null
    );

    assert.ok(execution);
    assert.equal(execution?.executedTools[0]?.toolName, 'diff_preview');
    assert.ok(execution?.executedTools.some(tool => tool.toolName === 'pulumi_config_set'));
    assert.ok(execution?.executedTools.every(tool => tool.toolName !== 'write_file'));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('apply-edit-plan execution blocks writes disallowed by workspace mode policy', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-mode-policy-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: 'Blocked rewrite write.',
          rationale: 'Test workspace mode policy.',
          payload: {
            writes: [
              {
                path: 'charts/payments-api/values.yaml',
                content: 'replicaCount: 3\n',
                reason: 'Rewrite test',
                mode: 'rewrite'
              }
            ]
          }
        }
      },
      workspaceRoot,
      {
        writePolicy: {
          allowedModes: ['append', 'create', 'replace']
        }
      }
    );

    assert.ok(execution);
    assert.equal(execution?.status, 'skipped');
    assert.match(execution?.reason ?? '', /write mode/i);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('validation command safety allows read-only validators and blocks mutation commands', () => {
  assert.equal(classifyUnsafeValidationCommand('terraform -chdir=terraform/payments-api fmt -check -recursive'), null);
  assert.equal(classifyUnsafeValidationCommand('terraform -chdir=terraform/payments-api validate'), null);
  assert.equal(classifyUnsafeValidationCommand('helm lint charts/payments-api'), null);
  assert.equal(classifyUnsafeValidationCommand('helm template charts/payments-api'), null);
  assert.equal(
    classifyUnsafeValidationCommand('PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive'),
    null
  );
  assert.equal(
    classifyUnsafeValidationCommand(
      'mkdir -p .pulumi-home .pulumi-state && (PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi stack init dev --cwd infra/payments-api --non-interactive >/dev/null 2>&1 || true) && PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive'
    ),
    null
  );

  assert.match(classifyUnsafeValidationCommand('terraform -chdir=terraform/payments-api apply -auto-approve')?.reason ?? '', /not validation/i);
  assert.match(classifyUnsafeValidationCommand('pulumi up --cwd infra/payments-api --stack prod --yes')?.reason ?? '', /deployment/i);
  assert.match(classifyUnsafeValidationCommand('helm upgrade payments-api charts/payments-api')?.reason ?? '', /deployment/i);
  assert.match(classifyUnsafeValidationCommand('kubectl delete deployment payments-api')?.reason ?? '', /cluster state/i);
});

test('validate_targets blocks unsafe validation commands before execution', async () => {
  const result = await executeTool(ValidateTargetsTool, {
    commands: [
      'terraform -chdir=terraform/payments-api apply -auto-approve'
    ]
  }, {
    workspaceRoot: resolve('fixtures/sample-workspace'),
    workspaceConfig: null
  });

  assert.equal(result.output.results.length, 1);
  assert.equal(result.output.results[0]?.exitCode, 1);
  assert.match(result.output.results[0]?.stderr ?? '', /blocked unsafe validation command/i);
  assert.match(result.output.results[0]?.stderr ?? '', /Terraform apply and destroy/i);

  const issues = classifyValidationIssues(result.output.results);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'unsafe-validation-command');
  assert.equal(issues[0]?.repairable, false);
  assert.equal(issues[0]?.metadata?.unsafeCommand, 'terraform -chdir=terraform/payments-api apply -auto-approve');
  assert.match(issues[0]?.metadata?.unsafeReason ?? '', /Terraform apply and destroy/i);
  assert.match(issues[0]?.guidance ?? '', /Remove deploy, apply, state mutation/i);
});

test('classifyValidationIssues marks ingress.enabled failures as repairable', () => {
  const issues = classifyValidationIssues([
    {
      command: 'helm template charts/payments-api',
      exitCode: 1,
      stdout: '',
      stderr: 'template: charts/payments-api/templates/ingress.yaml: executing at <.Values.ingress.enabled>: nil pointer evaluating interface {}.enabled'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'helm-missing-ingress-values');
  assert.equal(issues[0]?.repairable, true);
  assert.match(issues[0]?.guidance ?? '', /define the ingress block in values\.yaml/i);
});

test('classifyValidationIssues adds actionable guidance for missing Helm service.port', () => {
  const issues = classifyValidationIssues([
    {
      command: 'helm template charts/payments-api',
      exitCode: 1,
      stdout: '',
      stderr: 'template: charts/payments-api/templates/service.yaml: executing at <.Values.service.port>: nil pointer evaluating interface {}.port'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'helm-missing-service-port');
  assert.equal(issues[0]?.repairable, true);
  assert.match(issues[0]?.guidance ?? '', /define service\.port in values\.yaml/i);
});

test('classifyValidationIssues marks YAML syntax failures as blockers', () => {
  const issues = classifyValidationIssues([
    {
      command: 'infra-agent yaml-parse charts/payments-api/values.yaml',
      exitCode: 1,
      stdout: 'parser: python:pyyaml',
      stderr: 'while parsing a flow sequence'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'yaml-syntax-failure');
  assert.equal(issues[0]?.repairable, false);
  assert.equal(issues[0]?.metadata?.yamlPath, 'charts/payments-api/values.yaml');
  assert.equal(issues[0]?.metadata?.yamlParser, 'python:pyyaml');
  assert.match(issues[0]?.guidance ?? '', /Fix the planned YAML content/i);
});
