import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { inspectWorkspace } from '../src/domain/inspect-workspace.ts';
import { runSingleStep } from '../src/agent/run-single-step.ts';
import { executeDecision } from '../src/agent/execute-decision.ts';
import { buildTargetCandidates, detectRequestedService } from '../src/domain/task-targeting.ts';
import { buildRunPreflight } from '../src/agent/build-run-preflight.ts';
import { selectValidationCommands } from '../src/agent/select-validation-commands.ts';
import { buildValidationPreflight } from '../src/validators/preflight.ts';
import { classifyValidationIssues } from '../src/agent/classify-validation-issues.ts';
import { RuleBasedPlanningModel } from '../src/agent/rule-based-planner.ts';
import { parsePlannerDecision } from '../src/model/decision-parser.ts';
import { buildPlannerSystemPrompt } from '../src/model/prompt.ts';
import { buildEditPlan } from '../src/agent/build-edit-plan.ts';
import { collectApprovalSignals } from '../src/agent/collect-approval-signals.ts';
import { summarizeAgentSnapshot, summarizePreflightSnapshot, summarizePreflightSuggestedCommands, summarizeRecommendedNextSteps, summarizeResultCard, summarizeSuggestedCommands } from '../src/cli/output.ts';
import { executeTool } from '../src/services/tools/execute-tool.ts';
import { PulumiConfigSetTool } from '../src/tools/PulumiConfigSetTool/PulumiConfigSetTool.ts';
import { SearchWorkspaceTool } from '../src/tools/SearchWorkspaceTool/SearchWorkspaceTool.ts';
import { resolveEffectiveApprovalPolicy } from '../src/domain/workspace-policy.ts';
import { resolveEffectiveEditPolicy } from '../src/domain/edit-policy.ts';
import { inferRequestedDomains } from '../src/domain/domain-focus.ts';
import { prioritizeEditPlanKinds } from '../src/agent/edit-plan-priority.ts';
import { buildInspectionCandidateFiles, buildInspectionSearchPattern } from '../src/agent/inspection-priority.ts';

test('inspect command detects fixture workspace assets', () => {
  const inspection = inspectWorkspace('fixtures/sample-workspace');

  return inspection.then(result => {
    assert.equal(result.profile.id, 'generic');
    assert.equal(result.helmCharts.length, 1);
    assert.equal(result.pulumiProjects.length, 1);
    assert.deepEqual(result.domainCapabilities.map(domain => domain.id), ['helm', 'pulumi']);
  });
});

test('inspectWorkspace detects scrawlr infra-apps profile', async () => {
  const inspection = await inspectWorkspace('fixtures/scrawlr-infra-apps-workspace');

  assert.equal(inspection.profile.id, 'scrawlr-infra-apps');
  assert.match(inspection.profile.label, /Scrawlr/);
});

test('inspectWorkspace detects scrawlr infra-cloud profile', async () => {
  const inspection = await inspectWorkspace('fixtures/scrawlr-infra-cloud-workspace');

  assert.equal(inspection.profile.id, 'scrawlr-infra-cloud');
  assert.match(inspection.profile.label, /Scrawlr/);
  const networkingProject = inspection.pulumiProjects.find(project => project.projectRoot === 'networking');
  assert.ok(networkingProject?.environmentHints.includes('non-prod'));
});

test('workspace config can pin the repo profile', async () => {
  const inspection = await inspectWorkspace('fixtures/configured-workspace');

  assert.equal(inspection.profile.id, 'scrawlr-infra-cloud');
  assert.equal(inspection.config?.profileId, 'scrawlr-infra-cloud');
});

test('search workspace tool finds chart and Pulumi files under the selected root', async () => {
  const result = await executeTool(
    SearchWorkspaceTool,
    {
      rootPath: 'fixtures/sample-workspace',
      fileNamePattern: '^(Chart\\.ya?ml|Pulumi(\\..+)?\\.(yaml|yml))$',
      maxResults: 10
    },
    {
      workspaceRoot: resolve('.'),
      workspaceConfig: null
    }
  );

  const matchedPaths = result.output.matches.map(match => match.path);
  assert.ok(matchedPaths.some(path => path.endsWith('fixtures/sample-workspace/charts/payments-api/Chart.yaml')));
  assert.ok(matchedPaths.some(path => path.endsWith('fixtures/sample-workspace/infra/payments-api/Pulumi.yaml')));
});

test('profile-aware targeting prefers Helm charts inside scrawlr infra-apps fixtures', async () => {
  const inspection = await inspectWorkspace('fixtures/scrawlr-infra-apps-workspace');
  const targeting = buildTargetCandidates('update reloader chart for dev', inspection);

  assert.equal(targeting.targetCandidates[0]?.kind, 'helm-chart');
  assert.equal(targeting.targetCandidates[0]?.path, 'charts/infra/reloader');
});

test('profile-aware targeting prefers charts/apps for app-level Helm tasks without explicit service in scrawlr infra-apps fixtures', async () => {
  const inspection = await inspectWorkspace('fixtures/scrawlr-infra-apps-workspace');
  const targeting = buildTargetCandidates('add ingress for dev chart', inspection);

  assert.equal(targeting.targetCandidates[0]?.kind, 'helm-chart');
  assert.equal(targeting.targetCandidates[0]?.path, 'charts/apps/app-template');
});

test('profile-aware targeting prefers Pulumi projects inside scrawlr infra-cloud fixtures', async () => {
  const inspection = await inspectWorkspace('fixtures/scrawlr-infra-cloud-workspace');
  const targeting = buildTargetCandidates('update networking non-prod stack', inspection);

  assert.equal(targeting.targetCandidates[0]?.kind, 'pulumi-project');
  assert.equal(targeting.targetCandidates[0]?.path, 'networking');
});

test('profile-aware targeting maps dev requests onto non-prod Pulumi environment hints in infra-cloud fixtures', async () => {
  const inspection = await inspectWorkspace('fixtures/scrawlr-infra-cloud-workspace');
  const targeting = buildTargetCandidates('update networking dev stack', inspection);

  assert.equal(targeting.targetCandidates[0]?.kind, 'pulumi-project');
  assert.equal(targeting.targetCandidates[0]?.path, 'networking');
  assert.ok(targeting.targetCandidates[0]?.matchedEnvironmentHints.includes('non-prod'));
});

test('profile-aware validation selection filters to Pulumi commands for infra-cloud fixtures', async () => {
  const preflight = await buildRunPreflight('update networking non-prod stack', 'fixtures/scrawlr-infra-cloud-workspace');
  const commands = selectValidationCommands({
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [
      {
        path: 'networking/Pulumi.non-prod.yaml',
        content: '',
        reason: 'test write'
      }
    ],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(commands.length > 0);
  assert.ok(commands.every(command => command.includes('pulumi preview')));
});

test('domain-aware validation selection keeps only Pulumi commands in mixed workspaces for Pulumi tasks', async () => {
  const preflight = await buildRunPreflight('update pulumi stack config for payments-api dev', 'fixtures/sample-workspace');
  const commands = selectValidationCommands({
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [
      {
        path: 'infra/payments-api/Pulumi.dev.yaml',
        content: '',
        reason: 'test write'
      }
    ],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(commands.length > 0);
  assert.ok(commands.every(command => command.includes('pulumi preview')));
  assert.ok(commands.every(command => !command.includes('helm ')));
});

test('domain-aware validation selection keeps only Helm commands in mixed workspaces for Helm tasks', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const commands = selectValidationCommands({
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [
      {
        path: 'charts/payments-api/values.yaml',
        content: '',
        reason: 'test write'
      }
    ],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(commands.length > 0);
  assert.ok(commands.some(command => command.includes('helm lint')));
  assert.ok(commands.every(command => !command.includes('pulumi preview')));
});

test('workspace config overrides validation plan entries', async () => {
  const inspection = await inspectWorkspace('fixtures/configured-workspace');
  const validation = buildValidationPreflight(inspection);

  assert.equal(validation.usedWorkspaceConfig, true);
  assert.equal(validation.plan.length, 1);
  assert.equal(validation.plan[0]?.commands[0], 'echo custom networking validation');
});

test('buildRunPreflight records explicit approval scope', async () => {
  const preflight = await buildRunPreflight('update payments-api chart deeply', 'fixtures/sample-workspace', {
    approvedWriteRisks: ['high'],
    approvedWritePaths: ['charts/payments-api']
  });

  assert.deepEqual(preflight.approval.approvedWriteRisks, ['high']);
  assert.deepEqual(preflight.approval.approvedWritePaths, ['charts/payments-api']);
  assert.ok(preflight.assumptions.some(assumption => assumption.includes('Explicit approval granted for write risks')));
  assert.ok(preflight.assumptions.some(assumption => assumption.includes('Explicit approval granted for write paths')));
});

test('summarizePreflightSnapshot highlights primary target and top ambiguity', async () => {
  const preflight = await buildRunPreflight('update terraform image tag to 2.3.4', 'fixtures/terraform-multi-root-workspace');
  const snapshot = summarizePreflightSnapshot(preflight);

  assert.ok(snapshot.some(line => /Detected domains: Terraform/i.test(line)));
  assert.ok(snapshot.some(line => /Requested domains: terraform/i.test(line)));
  assert.ok(snapshot.some(line => /Planned domain path: Terraform/i.test(line)));
  assert.ok(snapshot.some(line => /Primary target: terraform-root terraform\/network-stack/i.test(line)));
  assert.ok(snapshot.some(line => /Requested service: undetected/i.test(line)));
  assert.ok(snapshot.some(line => /Approval posture: writes with risk high require approval/i.test(line)));
  assert.ok(snapshot.some(line => /Validation readiness:/i.test(line)));
});

test('inferRequestedDomains detects task domain focus from available domain capabilities', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');

  assert.deepEqual(
    inferRequestedDomains('add ingress to payments-api chart', inspection.domainCapabilities),
    ['helm']
  );
  assert.deepEqual(
    inferRequestedDomains('update pulumi stack config for payments-api', inspection.domainCapabilities),
    ['pulumi']
  );
});

test('buildRunPreflight records requested domains and warns when task spans multiple domains', async () => {
  const preflight = await buildRunPreflight(
    'update helm and pulumi config for payments-api dev',
    'fixtures/sample-workspace'
  );

  assert.deepEqual(preflight.requestedDomains, ['helm', 'pulumi']);
  assert.ok(preflight.assumptions.some(assumption => /multiple infrastructure domains/i.test(assumption)));
});

test('buildRunPreflight records a single requested domain for terraform-only workspaces', async () => {
  const preflight = await buildRunPreflight(
    'update terraform config for payments-api dev',
    'fixtures/terraform-workspace'
  );

  assert.deepEqual(preflight.requestedDomains, ['terraform']);
});

test('prioritizeEditPlanKinds prefers requested Terraform domain before Helm and Pulumi families', () => {
  assert.deepEqual(
    prioritizeEditPlanKinds(['terraform']),
    [
      'terraform-missing-required-argument-repair',
      'terraform-tfvars-config',
      'helm-service-port-repair',
      'helm-ingress-values-repair',
      'helm-ingress',
      'helm-probes',
      'pulumi-missing-config-repair',
      'pulumi-stack-config'
    ]
  );
});

test('prioritizeEditPlanKinds preserves requested domain order for mixed-domain tasks', () => {
  assert.deepEqual(
    prioritizeEditPlanKinds(['pulumi', 'helm']),
    [
      'pulumi-missing-config-repair',
      'pulumi-stack-config',
      'helm-service-port-repair',
      'helm-ingress-values-repair',
      'helm-ingress',
      'helm-probes',
      'terraform-missing-required-argument-repair',
      'terraform-tfvars-config'
    ]
  );
});

test('buildInspectionCandidateFiles prioritizes only Terraform files for Terraform-focused inspection', () => {
  const candidateFiles = buildInspectionCandidateFiles({
    dirName: 'terraform/payments-api',
    listedFiles: ['main.tf', 'variables.tf', 'dev.auto.tfvars', 'Pulumi.dev.yaml', 'Chart.yaml', 'values.yaml'],
    requestedDomains: ['terraform']
  });

  assert.ok(candidateFiles.some(path => path.endsWith('main.tf')));
  assert.ok(candidateFiles.some(path => path.endsWith('dev.auto.tfvars')));
  assert.ok(candidateFiles.every(path => !path.endsWith('Chart.yaml')));
  assert.ok(candidateFiles.every(path => !path.endsWith('values.yaml')));
  assert.ok(candidateFiles.every(path => !path.endsWith('Pulumi.dev.yaml')));
});

test('buildInspectionSearchPattern narrows search to requested domains', () => {
  assert.match(buildInspectionSearchPattern(['terraform']), /\.\*\\\.tf/);
  assert.doesNotMatch(buildInspectionSearchPattern(['terraform']), /Chart/);
  assert.match(buildInspectionSearchPattern(['pulumi', 'helm']), /Pulumi/);
  assert.match(buildInspectionSearchPattern(['pulumi', 'helm']), /Chart/);
  assert.doesNotMatch(buildInspectionSearchPattern(['pulumi', 'helm']), /\.\*\\\.tf/);
});

test('inspectWorkspace resolves specialized domain capabilities for mixed infra workspaces', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');

  assert.deepEqual(
    inspection.domainCapabilities.map(domain => domain.id),
    ['helm', 'pulumi']
  );
  const helmCapability = inspection.domainCapabilities.find(domain => domain.id === 'helm');
  const pulumiCapability = inspection.domainCapabilities.find(domain => domain.id === 'pulumi');
  assert.ok(helmCapability?.boundedEditKinds.includes('helm-ingress'));
  assert.ok(helmCapability?.validatorCommands.includes('helm lint'));
  assert.ok(pulumiCapability?.boundedEditKinds.includes('pulumi-stack-config'));
  assert.ok(pulumiCapability?.supportedTaskKinds.some(kind => /stack config/i.test(kind)));
});

test('inspectWorkspace resolves Terraform domain capability for terraform-only workspaces', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');

  assert.deepEqual(inspection.domainCapabilities.map(domain => domain.id), ['terraform']);
  assert.equal(inspection.domainCapabilities[0]?.detectedTargets, 1);
  assert.ok(inspection.domainCapabilities[0]?.validatorCommands.includes('terraform validate'));
});

test('summarizePreflightSuggestedCommands recommends inspect and rerun when preflight has ambiguity', async () => {
  const preflight = await buildRunPreflight('update terraform image tag to 2.3.4', 'fixtures/terraform-multi-root-workspace');
  const commands = summarizePreflightSuggestedCommands(preflight);

  assert.ok(commands.some(command => /inspect/.test(command)));
  assert.ok(commands.some(command => /validate/.test(command)));
  assert.ok(!commands.some(command => /main\.ts agent /.test(command)));
});

test('summarizePreflightSuggestedCommands recommends agent when preflight is ready to proceed', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const commands = summarizePreflightSuggestedCommands(preflight);

  assert.ok(commands.some(command => /inspect/.test(command)));
  assert.ok(commands.some(command => /validate/.test(command)));
  assert.ok(commands.some(command => /agent/.test(command)));
});

test('buildRunPreflight exposes effective approval policy from profile defaults', async () => {
  const preflight = await buildRunPreflight('update networking non-prod stack', 'fixtures/scrawlr-infra-cloud-workspace');

  assert.equal(preflight.profile.id, 'scrawlr-infra-cloud');
  assert.deepEqual(preflight.effectiveApprovalPolicy.requiredWriteRisks, ['medium', 'high']);
  assert.equal(preflight.effectiveApprovalPolicy.pathRules.length, 0);
  assert.ok(preflight.effectiveApprovalPolicy.sources.some(source => source.includes('profile-default')));
});

test('resolveEffectiveApprovalPolicy exposes workspace config overrides', () => {
  const effectivePolicy = resolveEffectiveApprovalPolicy(
    {
      approvalPolicy: {
        requiredWriteRisks: ['medium'],
        pathRules: [
          {
            path: './charts/payments-api/',
            requiredWriteRisks: ['high']
          }
        ]
      }
    },
    'generic'
  );

  assert.deepEqual(effectivePolicy.requiredWriteRisks, ['medium']);
  assert.deepEqual(effectivePolicy.pathRules, [
    {
      path: 'charts/payments-api',
      requiredWriteRisks: ['high']
    }
  ]);
  assert.deepEqual(effectivePolicy.sources, ['workspace-config: approvalPolicy']);
});

test('buildRunPreflight exposes effective edit policy from profile defaults', async () => {
  const preflight = await buildRunPreflight('update app-template chart for dev', 'fixtures/scrawlr-infra-apps-workspace');

  assert.equal(preflight.profile.id, 'scrawlr-infra-apps');
  assert.deepEqual(preflight.effectiveEditPolicy.allowedEditPlanKinds, [
    'helm-ingress',
    'helm-probes',
    'helm-service-port-repair',
    'helm-ingress-values-repair'
  ]);
  assert.deepEqual(preflight.effectiveEditPolicy.allowedTargetPrefixes, ['charts/apps', 'charts/infra']);
  assert.deepEqual(preflight.effectiveEditPolicy.allowedTargetPrefixesByKind, {
    'helm-ingress': ['charts/apps'],
    'helm-probes': ['charts/apps'],
    'helm-service-port-repair': ['charts/apps'],
    'helm-ingress-values-repair': ['charts/apps']
  });
  assert.ok(preflight.effectiveEditPolicy.sources.some(source => source.includes('profile-default')));
});

test('buildRunPreflight constrains generic terraform-only workspaces to tfvars edit plans', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');

  assert.equal(preflight.profile.id, 'generic');
  assert.deepEqual(preflight.effectiveEditPolicy.allowedEditPlanKinds, [
    'terraform-missing-required-argument-repair',
    'terraform-tfvars-config'
  ]);
  assert.deepEqual(preflight.effectiveEditPolicy.allowedTargetPrefixes, ['terraform/payments-api']);
  assert.ok(preflight.effectiveEditPolicy.sources.some(source => source.includes('terraform-only generic workspace')));
});

test('buildRunPreflight asks for clarification before creating tfvars in generic terraform-only workspaces', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-no-tfvars-workspace');

  assert.ok(preflight.assumptions.some(assumption => /has no existing tfvars file/i.test(assumption)));
});

test('buildRunPreflight asks for clarification before selecting among multiple tfvars files without an explicit environment', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api image tag to 2.3.4', 'fixtures/terraform-multi-tfvars-workspace');

  assert.ok(preflight.assumptions.some(assumption => /multiple tfvars files/i.test(assumption)));
  assert.ok(preflight.assumptions.some(assumption => /which environment or tfvars file should be updated/i.test(assumption)));
});

test('resolveEffectiveEditPolicy exposes workspace config overrides', () => {
  const effectivePolicy = resolveEffectiveEditPolicy(
    {
      editPolicy: {
        allowedEditPlanKinds: ['pulumi-stack-config'],
        allowedTargetPrefixes: ['./networking/'],
        allowedTargetPrefixesByKind: {
          'pulumi-stack-config': ['./networking/']
        }
      }
    },
    'scrawlr-infra-apps'
  );

  assert.deepEqual(effectivePolicy.allowedEditPlanKinds, ['pulumi-stack-config']);
  assert.deepEqual(effectivePolicy.allowedTargetPrefixes, ['networking']);
  assert.deepEqual(effectivePolicy.allowedTargetPrefixesByKind, {
    'pulumi-stack-config': ['networking']
  });
  assert.deepEqual(effectivePolicy.sources, ['workspace-config: editPolicy']);
});

test('resolveEffectiveEditPolicy derives terraform root prefixes for generic terraform-only inspections', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-multi-root-workspace');
  const effectivePolicy = resolveEffectiveEditPolicy(null, 'generic', inspection);

  assert.deepEqual(effectivePolicy.allowedEditPlanKinds, [
    'terraform-missing-required-argument-repair',
    'terraform-tfvars-config'
  ]);
  assert.deepEqual(effectivePolicy.allowedTargetPrefixes, [
    'terraform/network-stack',
    'terraform/worker-stack'
  ]);
});

test('buildEditPlan filters write modes disallowed by workspace policy', async () => {
  const preflight = await buildRunPreflight('add readiness and liveness probes to payments-api dev chart', 'fixtures/sample-workspace');
  const valuesPath = resolve('fixtures/sample-workspace/charts/payments-api/values.yaml');
  const deploymentPath = resolve('fixtures/sample-workspace/charts/payments-api/templates/deployment.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight: {
      ...preflight,
      inspection: {
        ...preflight.inspection,
        config: {
          writePolicy: {
            allowedModes: ['append', 'create']
          }
        }
      }
    },
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: valuesPath,
          content: await readFile(valuesPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: deploymentPath,
          content: await readFile(deploymentPath, 'utf8'),
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
  assert.ok(editPlan?.writes.every(write => write.mode !== 'replace' && write.mode !== 'rewrite'));
  assert.ok(editPlan?.writes.some(write => write.path.endsWith('values.yaml')));
});

test('buildEditPlan classifies ingress writes as append and create', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: resolve('fixtures/sample-workspace/charts/payments-api/values.yaml'),
          content: await readFile(resolve('fixtures/sample-workspace/charts/payments-api/values.yaml'), 'utf8'),
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
  const valuesWrite = editPlan?.writes.find(write => write.path.endsWith('values.yaml'));
  const ingressWrite = editPlan?.writes.find(write => write.path.endsWith('templates/ingress.yaml'));
  assert.equal(valuesWrite?.mode, 'append');
  assert.equal(ingressWrite?.mode, 'create');
});

test('buildEditPlan blocks Helm plans outside profile-scoped target prefixes', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const valuesPath = resolve('fixtures/sample-workspace/charts/payments-api/values.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight: {
      ...preflight,
      profile: {
        id: 'scrawlr-infra-apps',
        label: 'Scrawlr Infra Apps',
        reasons: ['synthetic edit-policy test']
      },
      effectiveEditPolicy: resolveEffectiveEditPolicy(null, 'scrawlr-infra-apps')
    },
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: valuesPath,
          content: await readFile(valuesPath, 'utf8'),
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

test('buildEditPlan blocks scrawlr infra-apps ingress plans for charts/infra targets', async () => {
  const preflight = await buildRunPreflight('add ingress to reloader dev chart', 'fixtures/scrawlr-infra-apps-workspace');
  const valuesPath = resolve('fixtures/scrawlr-infra-apps-workspace/charts/infra/reloader/values.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: valuesPath,
          content: await readFile(valuesPath, 'utf8'),
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

  assert.equal(preflight.profile.id, 'scrawlr-infra-apps');
  assert.equal(preflight.targetCandidates[0]?.path, 'charts/infra/reloader');
  assert.equal(editPlan, null);
});

test('buildEditPlan allows scrawlr infra-apps ingress plans for charts/apps targets', async () => {
  const preflight = await buildRunPreflight('add ingress to app-template dev chart', 'fixtures/scrawlr-infra-apps-workspace');
  const valuesPath = resolve('fixtures/scrawlr-infra-apps-workspace/charts/apps/app-template/values.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: valuesPath,
          content: await readFile(valuesPath, 'utf8'),
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
  assert.equal(editPlan?.kind, 'helm-ingress');
  assert.ok(editPlan?.writes.every(write => write.path.startsWith('charts/apps/app-template/')));
  const valuesWrite = editPlan?.writes.find(write => write.path.endsWith('values.yaml'));
  assert.match(valuesWrite?.content ?? '', /\nservice:\n  port: 8080\ningress:\n/);
  assert.match(valuesWrite?.reason ?? '', /service\.port/);
});

test('buildEditPlan does not inject a default service.port into generic ingress plans when one already exists or the profile is not infra-apps', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const valuesPath = resolve('fixtures/sample-workspace/charts/payments-api/values.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: valuesPath,
          content: await readFile(valuesPath, 'utf8'),
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

  const valuesWrite = editPlan?.writes.find(write => write.path.endsWith('values.yaml'));
  assert.ok(valuesWrite);
  assert.doesNotMatch(valuesWrite?.content ?? '', /\nservice:\n  port: 8080\n\ningress:\n/);
});

test('buildEditPlan respects workspace-config kind-scoped target prefix overrides', async () => {
  const preflight = await buildRunPreflight('add ingress to app-template dev chart', 'fixtures/scrawlr-infra-apps-workspace');
  const valuesPath = resolve('fixtures/scrawlr-infra-apps-workspace/charts/apps/app-template/values.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight: {
      ...preflight,
      inspection: {
        ...preflight.inspection,
        config: {
          editPolicy: {
            allowedEditPlanKinds: ['helm-ingress'],
            allowedTargetPrefixes: ['charts/apps'],
            allowedTargetPrefixesByKind: {
              'helm-ingress': ['charts/apps/other-service']
            }
          }
        }
      },
      effectiveEditPolicy: resolveEffectiveEditPolicy(
        {
          editPolicy: {
            allowedEditPlanKinds: ['helm-ingress'],
            allowedTargetPrefixes: ['charts/apps'],
            allowedTargetPrefixesByKind: {
              'helm-ingress': ['charts/apps/other-service']
            }
          }
        },
        'scrawlr-infra-apps'
      )
    },
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: valuesPath,
          content: await readFile(valuesPath, 'utf8'),
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

test('buildEditPlan blocks Pulumi plans under scrawlr infra-apps profile defaults', async () => {
  const preflight = await buildRunPreflight(
    'update pulumi dev stack for payments-api image tag to 1.2.3',
    'fixtures/sample-workspace'
  );
  const stackPath = resolve('fixtures/sample-workspace/infra/payments-api/Pulumi.dev.yaml');
  const projectPath = resolve('fixtures/sample-workspace/infra/payments-api/Pulumi.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight: {
      ...preflight,
      profile: {
        id: 'scrawlr-infra-apps',
        label: 'Scrawlr Infra Apps',
        reasons: ['synthetic kind restriction test']
      },
      effectiveEditPolicy: resolveEffectiveEditPolicy(null, 'scrawlr-infra-apps')
    },
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: projectPath,
          content: await readFile(projectPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: stackPath,
          content: await readFile(stackPath, 'utf8'),
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

test('buildEditPlan maps scrawlr infra-cloud dev requests to existing non-prod stack files', async () => {
  const preflight = await buildRunPreflight(
    'update networking dev stack image tag to 1.2.3',
    'fixtures/scrawlr-infra-cloud-workspace'
  );
  const projectPath = resolve('fixtures/scrawlr-infra-cloud-workspace/networking/Pulumi.yaml');
  const stackPath = resolve('fixtures/scrawlr-infra-cloud-workspace/networking/Pulumi.non-prod.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: projectPath,
          content: await readFile(projectPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: stackPath,
          content: await readFile(stackPath, 'utf8'),
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
  assert.equal(editPlan?.kind, 'pulumi-stack-config');
  assert.equal(editPlan?.writes[0]?.path, 'networking/Pulumi.non-prod.yaml');
});

test('buildEditPlan does not create new scrawlr infra-cloud prod stack files when no matching stack exists', async () => {
  const preflight = await buildRunPreflight(
    'update networking prod stack image tag to 1.2.3',
    'fixtures/scrawlr-infra-cloud-workspace'
  );
  const projectPath = resolve('fixtures/scrawlr-infra-cloud-workspace/networking/Pulumi.yaml');
  const stackPath = resolve('fixtures/scrawlr-infra-cloud-workspace/networking/Pulumi.non-prod.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: projectPath,
          content: await readFile(projectPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: stackPath,
          content: await readFile(stackPath, 'utf8'),
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

test('buildEditPlan reuses existing scrawlr infra-cloud config namespace from stack file', async () => {
  const preflight = await buildRunPreflight(
    'update networking dev stack image tag to 1.2.3',
    'fixtures/scrawlr-infra-cloud-workspace'
  );
  const projectPath = resolve('fixtures/scrawlr-infra-cloud-workspace/networking/Pulumi.yaml');
  const stackPath = resolve('fixtures/scrawlr-infra-cloud-workspace/networking/Pulumi.non-prod.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: projectPath,
          content: 'name: shared-networking\nruntime: yaml\ndescription: Synthetic project name drift\nresources: {}\n',
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: stackPath,
          content: await readFile(stackPath, 'utf8'),
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
  const writeContent = editPlan?.writes[0]?.content ?? '';
  assert.match(writeContent, /networking:imageTag:\s+1\.2\.3/);
  assert.doesNotMatch(writeContent, /shared-networking:imageTag:/);
});

test('buildEditPlan normalizes scrawlr infra-cloud environment config values away from full stack names', async () => {
  const preflight = await buildRunPreflight(
    'update eks non-prod stack image tag to 2.4.0',
    'fixtures/scrawlr-infra-cloud-workspace'
  );
  const projectPath = resolve('fixtures/scrawlr-infra-cloud-workspace/eks/Pulumi.yaml');
  const stackPath = resolve('fixtures/scrawlr-infra-cloud-workspace/eks/Pulumi.tenant-shared.non-prod.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: projectPath,
          content: await readFile(projectPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: stackPath,
          content: await readFile(stackPath, 'utf8'),
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
  const writeContent = editPlan?.writes[0]?.content ?? '';
  assert.match(writeContent, /eks:environment:\s+non-prod/);
  assert.doesNotMatch(writeContent, /eks:environment:\s+tenant-shared\.non-prod/);
});

test('buildEditPlan prefers qualifier-specific scrawlr infra-cloud stacks when task requests tenant-shared', async () => {
  const preflight = await buildRunPreflight(
    'update eks tenant-shared non-prod stack image tag to 2.4.0',
    'fixtures/scrawlr-infra-cloud-workspace'
  );
  const projectPath = resolve('fixtures/scrawlr-infra-cloud-workspace/eks/Pulumi.yaml');
  const stackPath = resolve('fixtures/scrawlr-infra-cloud-workspace/eks/Pulumi.tenant-shared.non-prod.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: projectPath,
          content: await readFile(projectPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: stackPath,
          content: await readFile(stackPath, 'utf8'),
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
  assert.equal(editPlan?.writes[0]?.path, 'eks/Pulumi.tenant-shared.non-prod.yaml');
});

test('buildEditPlan does not fall back to unrelated scrawlr infra-cloud qualifier stacks', async () => {
  const preflight = await buildRunPreflight(
    'update eks global non-prod stack image tag to 2.4.0',
    'fixtures/scrawlr-infra-cloud-workspace'
  );
  const projectPath = resolve('fixtures/scrawlr-infra-cloud-workspace/eks/Pulumi.yaml');
  const stackPath = resolve('fixtures/scrawlr-infra-cloud-workspace/eks/Pulumi.tenant-shared.non-prod.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: projectPath,
          content: await readFile(projectPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: stackPath,
          content: await readFile(stackPath, 'utf8'),
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

test('buildEditPlan classifies probe deployment update as replace', async () => {
  const preflight = await buildRunPreflight('add readiness and liveness probes to payments-api dev chart', 'fixtures/sample-workspace');
  const valuesPath = resolve('fixtures/sample-workspace/charts/payments-api/values.yaml');
  const deploymentPath = resolve('fixtures/sample-workspace/charts/payments-api/templates/deployment.yaml');
  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: valuesPath,
          content: await readFile(valuesPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: deploymentPath,
          content: await readFile(deploymentPath, 'utf8'),
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
  const deploymentWrite = editPlan?.writes.find(write => write.path.endsWith('templates/deployment.yaml'));
  assert.equal(deploymentWrite?.mode, 'replace');
  assert.ok(deploymentWrite?.replacePatch?.before);
  assert.ok(deploymentWrite?.replacePatch?.after);
});

test('workspace write policy blocks non-allowed chart edits during preflight', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/restricted-workspace');

  assert.ok(
    preflight.blockers.some(blocker => blocker.includes('Workspace write policy does not allow edits under charts/payments-api'))
  );
});

test('rule-based agent asks for clarification when write policy blocks the top target', async () => {
  const result = await runSingleStep(
    'add ingress to payments-api dev chart',
    'fixtures/restricted-workspace',
    undefined,
    'rule-based'
  );

  assert.equal(result.turns[0]?.decision.action.kind, 'ask-for-clarification');
  assert.match(result.turns[0]?.decision.action.summary ?? '', /writable target boundaries/i);
});

test('rule-based planner asks for clarification before high-risk rewrite edits', async () => {
  const preflight = await buildRunPreflight('update payments-api chart deeply', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight: {
        ...preflight,
        assumptions: [],
        targetCandidates: [
          {
            kind: 'helm-chart',
            name: 'payments-api',
            path: 'charts/payments-api',
            score: 10,
            reasons: ['synthetic approval test'],
            matchedEnvironmentHints: ['dev']
          }
        ]
      },
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: resolve('fixtures/sample-workspace/charts/payments-api/values.yaml'),
            content: await readFile(resolve('fixtures/sample-workspace/charts/payments-api/values.yaml'), 'utf8'),
            truncated: false
          }
        }
      ],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [
        {
          kind: 'write-approval-required',
          path: 'charts/payments-api/values.yaml',
          risk: 'high',
          message: 'The planned rewrite change at charts/payments-api/values.yaml has risk=high. Approval is required before applying this edit.'
        }
      ],
      repairAttempts: 0,
      lastEditPlan: {
        kind: 'helm-ingress',
        summary: 'Rewrite values file.',
        rationale: 'Synthetic rewrite test.',
        writes: [
          {
            path: 'charts/payments-api/values.yaml',
            content: 'replicaCount: 99\n',
            reason: 'Rewrite test',
            mode: 'rewrite',
            risk: 'high'
          }
        ]
      }
    }
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.match(decision.action.summary, /high-risk rewrite/i);
  assert.equal(decision.action.payload?.clarificationKind, 'approval-required');
});

test('collectApprovalSignals respects workspace approval policy overrides', async () => {
  const preflight = await buildRunPreflight('update payments-api chart deeply', 'fixtures/sample-workspace');
  const signals = collectApprovalSignals({
    task: preflight.task,
    preflight: {
      ...preflight,
      inspection: {
        ...preflight.inspection,
        config: {
          approvalPolicy: {
            requiredWriteRisks: []
          }
        }
      }
    },
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: {
      kind: 'helm-ingress',
      summary: 'Rewrite values file.',
      rationale: 'Synthetic rewrite test.',
      writes: [
        {
          path: 'charts/payments-api/values.yaml',
          content: 'replicaCount: 99\n',
          reason: 'Rewrite test',
          mode: 'rewrite',
          risk: 'high'
        }
      ]
    }
  });

  assert.equal(signals.length, 0);
});

test('collectApprovalSignals applies path-scoped approval rules for medium-risk writes', async () => {
  const preflight = await buildRunPreflight('add readiness and liveness probes to payments-api dev chart', 'fixtures/sample-workspace');
  const signals = collectApprovalSignals({
    task: preflight.task,
    preflight: {
      ...preflight,
      inspection: {
        ...preflight.inspection,
        config: {
          approvalPolicy: {
            requiredWriteRisks: [],
            pathRules: [
              {
                path: 'charts/payments-api',
                requiredWriteRisks: ['medium']
              }
            ]
          }
        }
      }
    },
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: {
      kind: 'helm-probes',
      summary: 'Update deployment template and values.',
      rationale: 'Synthetic path-scoped approval test.',
      writes: [
        {
          path: 'charts/payments-api/templates/deployment.yaml',
          content: 'deployment content',
          reason: 'Scoped replace',
          mode: 'replace',
          risk: 'medium'
        },
        {
          path: 'charts/other-service/templates/deployment.yaml',
          content: 'deployment content',
          reason: 'Unscoped replace',
          mode: 'replace',
          risk: 'medium'
        }
      ]
    }
  });

  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.path, 'charts/payments-api/templates/deployment.yaml');
  assert.equal(signals[0]?.risk, 'medium');
});

test('scrawlr infra-apps profile applies default medium-risk approval on app-template and charts/infra paths', async () => {
  const preflight = await buildRunPreflight('update app-template chart for dev', 'fixtures/scrawlr-infra-apps-workspace');
  const signals = collectApprovalSignals({
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: {
      kind: 'helm-probes',
      summary: 'Synthetic medium-risk edits in infra-apps profile.',
      rationale: 'Default profile approval policy test.',
      writes: [
        {
          path: 'charts/apps/app-template/templates/deployment.yaml',
          content: 'deployment content',
          reason: 'Profile-scoped replace in app-template',
          mode: 'replace',
          risk: 'medium'
        },
        {
          path: 'charts/infra/reloader/templates/deployment.yaml',
          content: 'deployment content',
          reason: 'Profile-scoped replace in charts/infra',
          mode: 'replace',
          risk: 'medium'
        }
      ]
    }
  });

  assert.equal(preflight.profile.id, 'scrawlr-infra-apps');
  assert.equal(signals.length, 2);
  assert.ok(signals.some(signal => signal.path === 'charts/apps/app-template/templates/deployment.yaml'));
  assert.ok(signals.some(signal => signal.path === 'charts/infra/reloader/templates/deployment.yaml'));
});

test('scrawlr infra-cloud profile applies default medium-risk approval globally', async () => {
  const preflight = await buildRunPreflight('update networking non-prod stack', 'fixtures/scrawlr-infra-cloud-workspace');
  const signals = collectApprovalSignals({
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: {
      kind: 'pulumi-stack-config',
      summary: 'Synthetic medium-risk edit in infra-cloud profile.',
      rationale: 'Default profile approval policy test.',
      writes: [
        {
          path: 'networking/Pulumi.non-prod.yaml',
          content: 'config:\n  networking:test: value\n',
          reason: 'Profile-scoped replace in infra-cloud',
          mode: 'replace',
          risk: 'medium'
        }
      ]
    }
  });

  assert.equal(preflight.profile.id, 'scrawlr-infra-cloud');
  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.path, 'networking/Pulumi.non-prod.yaml');
  assert.equal(signals[0]?.risk, 'medium');
});

test('collectApprovalSignals suppresses matching explicit approval grants only for the approved path scope', async () => {
  const preflight = await buildRunPreflight('update payments-api chart deeply', 'fixtures/sample-workspace', {
    approvedWriteRisks: ['high'],
    approvedWritePaths: ['charts/payments-api']
  });
  const signals = collectApprovalSignals({
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
      summary: 'Rewrite values file.',
      rationale: 'Synthetic rewrite test.',
      writes: [
        {
          path: 'charts/payments-api/values.yaml',
          content: 'replicaCount: 99\n',
          reason: 'Approved rewrite',
          mode: 'rewrite',
          risk: 'high'
        },
        {
          path: 'charts/other-service/values.yaml',
          content: 'replicaCount: 99\n',
          reason: 'Unapproved rewrite',
          mode: 'rewrite',
          risk: 'high'
        }
      ]
    }
  });

  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.path, 'charts/other-service/values.yaml');
});

test('explicit approval scope can suppress path-scoped medium-risk approval signals', async () => {
  const preflight = await buildRunPreflight('add readiness and liveness probes to payments-api dev chart', 'fixtures/sample-workspace', {
    approvedWriteRisks: ['medium'],
    approvedWritePaths: ['charts/payments-api']
  });
  const signals = collectApprovalSignals({
    task: preflight.task,
    preflight: {
      ...preflight,
      inspection: {
        ...preflight.inspection,
        config: {
          approvalPolicy: {
            requiredWriteRisks: [],
            pathRules: [
              {
                path: 'charts/payments-api',
                requiredWriteRisks: ['medium']
              }
            ]
          }
        }
      }
    },
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: {
      kind: 'helm-probes',
      summary: 'Update deployment template and values.',
      rationale: 'Synthetic explicit approval test for path-scoped rules.',
      writes: [
        {
          path: 'charts/payments-api/templates/deployment.yaml',
          content: 'deployment content',
          reason: 'Scoped replace',
          mode: 'replace',
          risk: 'medium'
        }
      ]
    }
  });

  assert.equal(signals.length, 0);
});

test('rule-based planner proceeds with apply-edit-plan after explicit approval covers a high-risk rewrite', async () => {
  const preflight = await buildRunPreflight('update payments-api chart deeply', 'fixtures/sample-workspace', {
    approvedWriteRisks: ['high'],
    approvedWritePaths: ['charts/payments-api']
  });
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight: {
        ...preflight,
        assumptions: [],
        targetCandidates: [
          {
            kind: 'helm-chart',
            name: 'payments-api',
            path: 'charts/payments-api',
            score: 10,
            reasons: ['synthetic approval continuation test'],
            matchedEnvironmentHints: ['dev']
          }
        ]
      },
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: resolve('fixtures/sample-workspace/charts/payments-api/values.yaml'),
            content: await readFile(resolve('fixtures/sample-workspace/charts/payments-api/values.yaml'), 'utf8'),
            truncated: false
          }
        }
      ],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: {
        kind: 'helm-ingress',
        summary: 'Rewrite values file.',
        rationale: 'Synthetic rewrite continuation test.',
        writes: [
          {
            path: 'charts/payments-api/values.yaml',
            content: 'replicaCount: 99\n',
            reason: 'Rewrite test',
            mode: 'rewrite',
            risk: 'high'
          }
        ]
      }
    }
  });

  assert.equal(decision.action.kind, 'apply-edit-plan');
});

test('rule-based agent repairs missing service.port after validation failure', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-repair-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/repair-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add ingress to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    assert.ok(result.turns.some(turn => turn.decision.action.payload?.editPlan?.kind === 'helm-service-port-repair'));
    assert.ok(result.runtime.repairAttempts >= 1);
    assert.ok(result.runtime.validationResults.every(entry => entry.exitCode === 0));
    assert.equal(result.runtime.validationIssues.length, 0);
    assert.equal(result.outcome, 'completed');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('apply-edit-plan execution emits diff preview before write', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-diff-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: 'Apply bounded values update.',
          rationale: 'Test diff preview output.',
          payload: {
            writes: [
              {
                path: 'charts/payments-api/values.yaml',
                content: 'replicaCount: 2\n',
                reason: 'Test write'
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
    assert.equal(execution?.executedTools[1]?.toolName, 'write_file');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

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
    assert.equal(execution?.executedTools[1]?.toolName, 'append_file');
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

test('planner system prompt documents explicit stop reasons', () => {
  const prompt = buildPlannerSystemPrompt();

  assert.match(prompt, /Allowed stop payload\.stopReason values:/);
  assert.match(prompt, /Allowed ask-for-clarification payload\.clarificationKind values:/);
  assert.match(prompt, /repair-budget-exhausted/);
  assert.match(prompt, /validation-succeeded/);
});

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
});

test('runSingleStep returns approval-required outcome for approval clarification turns', async () => {
  const approvalModel = {
    name: 'approval-test-model',
    async decideNextAction() {
      return {
        confidence: 'high',
        action: {
          kind: 'ask-for-clarification',
          summary: 'Approval required',
          rationale: 'Synthetic approval gate.',
          payload: {
            clarificationKind: 'approval-required',
            questions: ['Proceed with this rewrite?']
          }
        }
      };
    }
  };

  const result = await runSingleStep(
    'add ingress to payments-api dev chart',
    'fixtures/sample-workspace',
    approvalModel
  );

  assert.equal(result.outcome, 'approval-required');
});

test('summarizeRecommendedNextSteps suggests approval continuation for approval-required runs', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const steps = summarizeRecommendedNextSteps({
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
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: [
      {
        index: 0,
        decision: {
          confidence: 'high',
          action: {
            kind: 'ask-for-clarification',
            summary: 'Approval required',
            rationale: 'High-risk write needs approval.',
            payload: {
              clarificationKind: 'approval-required',
              questions: ['Proceed with this rewrite?']
            }
          }
        },
        runtimeSnapshot: {
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
      }
    ]
  });

  assert.ok(steps.some(step => /approve the flagged write risk or write path/i.test(step)));
  assert.ok(steps.some(step => /--approve-write-risk/i.test(step)));
});

test('summarizeSuggestedCommands includes approval continuation flags for approval-required runs', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const commands = summarizeSuggestedCommands({
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
          kind: 'write-approval-required',
          path: 'charts/payments-api/values.yaml',
          risk: 'high',
          message: 'Approval required.'
        }
      ],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(commands[0]?.includes('agent'));
  assert.ok(commands[0]?.includes('--approve-write-risk high'));
  assert.ok(commands[0]?.includes('--approve-write-path "charts/payments-api/values.yaml"'));
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
  assert.ok(snapshot.some(line => /Validation status: failed/i.test(line)));
  assert.ok(snapshot.some(line => /Top validation issue: terraform-validate-failure/i.test(line)));
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

test('summarizeResultCard highlights changed files, native CLI usage, validators, and repairs', async () => {
  const preflight = await buildRunPreflight('update pulumi dev stack for payments-api image tag to 1.2.3', 'fixtures/sample-workspace');
  const summary = summarizeResultCard({
    modelName: 'test-model',
    outcome: 'completed',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [
        {
          path: 'infra/payments-api/Pulumi.dev.yaml',
          content: 'config:\n  payments-api:environment: dev\n  payments-api:imageTag: 1.2.3\n',
          reason: 'Applied via pulumi_config_set tool.'
        }
      ],
      validationResults: [
        {
          command: 'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
          exitCode: 0,
          stdout: '',
          stderr: ''
        }
      ],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 1,
      lastEditPlan: {
        kind: 'pulumi-missing-config-repair',
        summary: 'Repair missing Pulumi config.',
        rationale: 'Test result summary.',
        writes: [
          {
            path: 'infra/payments-api/Pulumi.dev.yaml',
            content: 'config:\n  payments-api:environment: dev\n  payments-api:imageTag: 1.2.3\n',
            reason: 'Synthetic write.'
          }
        ]
      }
    },
    turns: [
      {
        index: 0,
        decision: {
          confidence: 'high',
          action: {
            kind: 'apply-edit-plan',
            summary: 'Repair missing Pulumi config.',
            rationale: 'Use Pulumi CLI.',
            payload: {
              actionFamily: 'pulumi-bounded-edit'
            }
          }
        },
        execution: {
          status: 'completed',
          executedTools: [
            {
              toolName: 'pulumi_config_set',
              safety: 'write_scoped',
              output: {
                workspaceRoot: preflight.workspaceRoot,
                projectRoot: 'infra/payments-api',
                stackName: 'dev',
                key: 'payments-api:imageTag',
                value: '1.2.3',
                stackFilePath: 'infra/payments-api/Pulumi.dev.yaml',
                command: 'pulumi config set',
                exitCode: 0,
                stdout: '',
                stderr: '',
                content: 'config:\n  payments-api:environment: dev\n  payments-api:imageTag: 1.2.3\n'
              }
            }
          ]
        },
        runtimeSnapshot: {
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
      }
    ]
  });

  assert.ok(summary.some(line => /Changed files: infra\/payments-api\/Pulumi\.dev\.yaml/i.test(line)));
  assert.ok(summary.some(line => /Native CLI operations: Pulumi CLI/i.test(line)));
  assert.ok(summary.some(line => /Validators executed: 1 command\(s\) across Pulumi/i.test(line)));
  assert.ok(summary.some(line => /Repair activity: 1 bounded repair attempt/i.test(line)));
});

test('summarizeResultCard includes Helm CLI usage when helm_show_values is executed', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const summary = summarizeResultCard({
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
    turns: [
      {
        index: 0,
        decision: {
          confidence: 'high',
          action: {
            kind: 'inspect-target-files',
            summary: 'Inspect Helm chart files.',
            rationale: 'Use Helm CLI.',
            payload: {
              actionFamily: 'helm-inspection'
            }
          }
        },
        execution: {
          status: 'completed',
          executedTools: [
            {
              toolName: 'helm_show_values',
              safety: 'read_only',
              output: {
                workspaceRoot: preflight.workspaceRoot,
                chartPath: 'charts/payments-api',
                command: 'helm show values charts/payments-api',
                exitCode: 0,
                stdout: 'replicaCount: 2\n',
                stderr: '',
                content: 'replicaCount: 2\n'
              }
            }
          ]
        },
        runtimeSnapshot: {
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
      }
    ]
  });

  assert.ok(summary.some(line => /Native CLI operations: Helm CLI/i.test(line)));
});

test('summarizeSuggestedCommands recommends inspect and run for validation-blocked runs', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const commands = summarizeSuggestedCommands({
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
          message: 'Error: Missing required argument'
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  });

  assert.ok(commands.some(command => /validate/.test(command)));
  assert.ok(commands.some(command => /inspect/.test(command)));
  assert.ok(commands.some(command => /run/.test(command)));
});

test('summarizeRecommendedNextSteps uses Helm-specific clarification wording', async () => {
  const preflight = await buildRunPreflight('update helm chart', 'fixtures/sample-workspace');
  const steps = summarizeRecommendedNextSteps({
    modelName: 'test-model',
    outcome: 'clarification-required',
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

  assert.ok(steps.some(step => /helm chart, environment, or values scope/i.test(step)));
});

test('summarizeSuggestedCommands adds domain-aware validate command for Helm clarification runs', async () => {
  const preflight = await buildRunPreflight('update helm chart', 'fixtures/sample-workspace');
  const commands = summarizeSuggestedCommands({
    modelName: 'test-model',
    outcome: 'clarification-required',
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

  assert.ok(commands.some(command => /inspect/.test(command)));
  assert.ok(commands.some(command => /run/.test(command)));
  assert.ok(commands.some(command => /validate/.test(command)));
});

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
  assert.match(editPlan?.writes[0]?.content ?? '', /image_tag = "2.3.4"/);
  assert.match(editPlan?.writes[0]?.content ?? '', /environment = "dev"/);
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

test('inspect-target-files reads Terraform root files into runtime observations', async () => {
  const execution = await executeDecision(
    {
      confidence: 'high',
      action: {
        kind: 'inspect-target-files',
        summary: 'Inspect Terraform files.',
        rationale: 'Test Terraform inspection path.',
        payload: {
          targetPaths: ['terraform/payments-api'],
          requestedDomains: ['terraform']
        }
      }
    },
    resolve('fixtures/terraform-workspace'),
    null
  );

  assert.ok(execution);
  const readPaths = execution?.executedTools
    .filter(result => result.toolName === 'read_file')
    .map(result => result.output.path);

  assert.ok(readPaths?.some(path => path.endsWith('terraform/payments-api/main.tf')));
  assert.ok(readPaths?.some(path => path.endsWith('terraform/payments-api/dev.auto.tfvars')));
  assert.ok(readPaths?.every(path => !path.endsWith('Chart.yaml')));
});

test('inspect-target-files uses helm_show_values for Helm chart inspection', async () => {
  const execution = await executeDecision(
    {
      confidence: 'high',
      action: {
        kind: 'inspect-target-files',
        summary: 'Inspect Helm files.',
        rationale: 'Test Helm inspection path.',
        payload: {
          targetPaths: ['charts/payments-api'],
          requestedDomains: ['helm']
        }
      }
    },
    resolve('fixtures/sample-workspace'),
    null
  );

  assert.ok(execution);
  const helmShowValues = execution?.executedTools.find(result => result.toolName === 'helm_show_values');

  assert.ok(helmShowValues);
  assert.match(helmShowValues?.output.command ?? '', /helm show values charts\/payments-api/i);
  assert.match(helmShowValues?.output.content ?? '', /service:\s*\n\s*port:\s*8080/i);
});

test('classifyValidationIssues marks terraform fmt failures as terraform-formatting-required', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/payments-api fmt -check -recursive',
      exitCode: 3,
      stdout: 'main.tf',
      stderr: ''
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-formatting-required');
  assert.equal(issues[0]?.repairable, true);
});

test('classifyValidationIssues marks terraform validate failures as terraform-validate-failure', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/payments-api validate',
      exitCode: 1,
      stdout: '',
      stderr: 'Error: Reference to undeclared input variable'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-validate-failure');
  assert.equal(issues[0]?.repairable, false);
  assert.match(issues[0]?.message ?? '', /undeclared input variable/i);
  assert.match(issues[0]?.guidance ?? '', /variable name exists in variable declarations and tfvars/i);
});

test('classifyValidationIssues provides actionable guidance for missing required Terraform arguments', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/payments-api validate',
      exitCode: 1,
      stdout: '',
      stderr: 'Error: Missing required argument\n\nThe argument "image_tag" is required, but no definition was found.'
    }
  ]);

  assert.equal(issues[0]?.kind, 'terraform-validate-failure');
  assert.equal(issues[0]?.repairable, true);
  assert.equal(issues[0]?.metadata?.missingVariableName, 'image_tag');
  assert.match(issues[0]?.guidance ?? '', /add the missing required argument through an existing tfvars file or declared variable path/i);
});

test('classifyValidationIssues marks missing Pulumi config as pulumi-missing-config', () => {
  const issues = classifyValidationIssues([
    {
      command: 'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
      exitCode: 1,
      stdout: '',
      stderr: 'error: missing required configuration variable "payments-api:imageTag"; run `pulumi config set payments-api:imageTag <value>`'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-missing-config');
  assert.equal(issues[0]?.repairable, true);
  assert.equal(issues[0]?.metadata?.missingConfigKey, 'payments-api:imageTag');
  assert.match(issues[0]?.guidance ?? '', /set payments-api:imageTag/i);
});

test('classifyValidationIssues marks general Pulumi preview failures as pulumi-preview-failure', () => {
  const issues = classifyValidationIssues([
    {
      command: 'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
      exitCode: 1,
      stdout: '',
      stderr: 'error: preview failed because the stack configuration is invalid'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-preview-failure');
  assert.equal(issues[0]?.repairable, false);
  assert.match(issues[0]?.guidance ?? '', /failing Pulumi project and stack file/i);
});

test('executeDecision runs terraform formatting repair inside the selected Terraform root', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-fmt-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/terraform-format-repair-workspace'), workspaceRoot, { recursive: true });
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'repair-terraform-formatting',
          summary: 'Repair Terraform formatting.',
          rationale: 'terraform fmt -check failed.',
          payload: {
            rootPath: 'terraform/payments-api'
          }
        }
      },
      workspaceRoot,
      null
    );

    assert.ok(execution);
    assert.equal(execution?.executedTools[0]?.toolName, 'search_workspace');
    assert.equal(execution?.executedTools[1]?.toolName, 'terraform_fmt');
    const repairedMainTf = await readFile(join(workspaceRoot, 'terraform/payments-api/main.tf'), 'utf8');
    assert.match(repairedMainTf, /  type = string/);
    assert.match(repairedMainTf, /  image_tag   = var\.image_tag/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based agent repairs Terraform formatting failures and revalidates', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-repair-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/terraform-format-repair-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'update terraform payments-api dev image tag to 2.3.4',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    assert.ok(result.turns.some(turn => turn.decision.action.kind === 'repair-terraform-formatting'));
    assert.ok(result.turns.some(turn => turn.execution?.executedTools.some(tool => tool.toolName === 'terraform_fmt')));
    assert.ok(result.runtime.repairAttempts >= 1);
    assert.ok(result.runtime.validationResults.every(entry => entry.exitCode === 0));
    assert.equal(result.runtime.validationIssues.length, 0);
    assert.equal(result.outcome, 'completed');

    const repairedMainTf = await readFile(join(workspaceRoot, 'terraform/payments-api/main.tf'), 'utf8');
    const updatedTfvars = await readFile(join(workspaceRoot, 'terraform/payments-api/dev.auto.tfvars'), 'utf8');
    assert.match(repairedMainTf, /  image_tag   = var\.image_tag/);
    assert.match(updatedTfvars, /image_tag\s*=\s*"2.3.4"/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
