import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  cp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  resolve,
  join
} from 'node:path';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { runSingleStep } from '../../src/agent/run-single-step.ts';
import { buildTargetCandidates } from '../../src/domain/task-targeting.ts';
import { buildRunPreflight } from '../../src/agent/build-run-preflight.ts';
import { selectValidationCommands } from '../../src/agent/select-validation-commands.ts';
import { buildValidationPreflight } from '../../src/validators/preflight.ts';
import { classifyUnsafeValidationCommand } from '../../src/validators/command-safety.ts';
import { RuleBasedPlanningModel } from '../../src/agent/rule-based-planner.ts';
import { buildEditPlan } from '../../src/agent/build-edit-plan.ts';
import { collectApprovalSignals } from '../../src/agent/collect-approval-signals.ts';
import {
  summarizeFocusedDomainCapabilities,
  summarizeFocusedValidationPlan,
  summarizePreflightSnapshot,
  summarizePreflightSuggestedCommands
} from '../../src/cli/output.ts';
import { main } from '../../src/cli/main.ts';
import { executeTool } from '../../src/services/tools/execute-tool.ts';
import { SearchWorkspaceTool } from '../../src/tools/SearchWorkspaceTool/SearchWorkspaceTool.ts';
import { resolveEffectiveApprovalPolicy } from '../../src/domain/workspace-policy.ts';
import { resolveEffectiveEditPolicy } from '../../src/domain/edit-policy.ts';
import { inferRequestedDomains } from '../../src/domain/domain-focus.ts';
import { prioritizeEditPlanKinds } from '../../src/agent/edit-plan-priority.ts';
import {
  buildInspectionCandidateFiles,
  buildInspectionSearchPattern
} from '../../src/agent/inspection-priority.ts';

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
  assert.equal(inspection.knowledgeCache.root, resolve('fixtures/configured-workspace/.infra-agent/knowledge-cache'));
  assert.equal(inspection.knowledgeCache.source, 'workspace-config: knowledgeCache.root');
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

test('Pulumi validation preflight uses preview-only commands without local-state bootstrap', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const validation = buildValidationPreflight(inspection);
  const pulumiCommands = validation.plan
    .filter(entry => entry.kind === 'pulumi')
    .flatMap(entry => entry.commands);

  assert.ok(pulumiCommands.length > 0);
  for (const command of pulumiCommands) {
    assert.match(command, /\bpulumi preview\b/);
    assert.doesNotMatch(command, /\bmkdir\b/);
    assert.doesNotMatch(command, /\bpulumi stack init\b/);
    assert.doesNotMatch(command, /\bpulumi login\b/);
    assert.equal(classifyUnsafeValidationCommand(command), null);
  }
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
    approvedWritePaths: ['charts/payments-api'],
    approvedToolCategories: ['native-stack-config-write']
  });

  assert.deepEqual(preflight.approval.approvedWriteRisks, ['high']);
  assert.deepEqual(preflight.approval.approvedWritePaths, ['charts/payments-api']);
  assert.deepEqual(preflight.approval.approvedToolCategories, ['native-stack-config-write']);
  assert.ok(preflight.assumptions.some(assumption => assumption.includes('Explicit approval granted for write risks')));
  assert.ok(preflight.assumptions.some(assumption => assumption.includes('Explicit approval granted for write paths')));
  assert.ok(preflight.assumptions.some(assumption => assumption.includes('Explicit approval granted for tool categories')));
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

test('summarizePreflightSnapshot prefers the requested Helm target in mixed workspaces', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const snapshot = summarizePreflightSnapshot(preflight);

  assert.ok(snapshot.some(line => /Primary target: helm-chart charts\/payments-api/i.test(line)));
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
  assert.deepEqual(
    inferRequestedDomains('upgrade helm monitoring kube-prometheus-stack values safely', inspection.domainCapabilities),
    ['helm']
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
      'terraform-moved-block',
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
      'terraform-moved-block',
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
  assert.ok(commands.some(command => /run/.test(command)));
  assert.ok(!commands.some(command => /validate/.test(command)));
  assert.ok(!commands.some(command => /main\.ts agent /.test(command)));
});

test('summarizePreflightSuggestedCommands recommends agent when preflight is ready to proceed', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const commands = summarizePreflightSuggestedCommands(preflight);

  assert.ok(commands.some(command => /inspect/.test(command)));
  assert.ok(commands.some(command => /validate/.test(command)));
  assert.ok(commands.some(command => /agent/.test(command)));
});

test('summarizeFocusedDomainCapabilities prioritizes requested domains', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const lines = summarizeFocusedDomainCapabilities(inspection.domainCapabilities, ['helm']);

  assert.match(lines[0] ?? '', /^Helm:/);
  assert.match(lines[0] ?? '', /\[requested\]$/);
  assert.match(lines[1] ?? '', /^Pulumi:/);
});

test('summarizeFocusedValidationPlan prioritizes requested domain entries', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const lines = summarizeFocusedValidationPlan(preflight.validation.plan, ['helm']);

  assert.match(lines[0] ?? '', /^helm charts\/payments-api:/);
  assert.match(lines[0] ?? '', /\[requested\]$/);
  assert.match(lines[1] ?? '', /^helm charts\/payments-api:/);
  assert.match(lines[2] ?? '', /^pulumi infra\/payments-api:/);
});

test('buildRunPreflight filters unrelated domain blockers for Helm-only tasks', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');

  assert.ok(preflight.blockers.every(blocker => !blocker.includes('Terraform')));
  assert.ok(preflight.blockers.every(blocker => !blocker.includes('Pulumi')));
});

test('summarizePreflightSuggestedCommands recommends agent for ready Helm-only workspaces', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const commands = summarizePreflightSuggestedCommands(preflight);

  assert.ok(commands.some(command => /inspect/.test(command)));
  assert.ok(commands.some(command => /validate/.test(command)));
  assert.ok(commands.some(command => /agent/.test(command)));
});

test('buildRunPreflight filters unrelated domain next actions for Helm-only tasks', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');

  assert.ok(preflight.nextActions.some(action => /Read the target Helm chart files/i.test(action)));
  assert.ok(preflight.nextActions.some(action => /Use Helm validators as the mandatory refinement loop/i.test(action)));
  assert.ok(preflight.nextActions.every(action => !action.includes('Pulumi project')));
  assert.ok(preflight.nextActions.every(action => !action.includes('Terraform root')));
});
