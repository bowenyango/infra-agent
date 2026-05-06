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

test('buildRunPreflight asks for clarification when requested Terraform environment violates enum semantics', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api qa image tag to 2.3.4', 'fixtures/terraform-workspace');

  assert.ok(preflight.assumptions.some(assumption =>
    /Requested Terraform environment is not allowed/i.test(assumption)
    && /var\.environment allows dev, stage, prod/i.test(assumption)
    && /requested value is qa/i.test(assumption)
  ));
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

test('buildEditPlan uses Helm values schema enum facts for ingress className', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-schema-enum-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    await writeFile(
      join(workspaceRoot, 'charts/payments-api/values.schema.json'),
      JSON.stringify({
        type: 'object',
        properties: {
          ingress: {
            type: 'object',
            properties: {
              className: {
                type: 'string',
                enum: ['alb']
              }
            }
          }
        }
      }, null, 2),
      'utf8'
    );

    const preflight = await buildRunPreflight('add ingress to payments-api dev chart', workspaceRoot);
    const valuesPath = join(workspaceRoot, 'charts/payments-api/values.yaml');
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
    assert.match(valuesWrite?.content ?? '', /\n  className: alb\n/);
    assert.match(editPlan?.rationale ?? '', /allows alb/i);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
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

test('buildEditPlan reuses Pulumi config semantics before project-name fallback', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-semantics-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    await writeFile(
      join(workspaceRoot, 'infra/payments-api/Pulumi.yaml'),
      [
        'name: shared-payments',
        'runtime: yaml',
        'description: Synthetic project name drift',
        'config:',
        '  payments-api:environment:',
        '    type: string',
        '  payments-api:imageTag:',
        '    type: string',
        'resources: {}',
        ''
      ].join('\n'),
      'utf8'
    );

    const preflight = await buildRunPreflight('update pulumi payments-api dev image tag to 3.4.5', workspaceRoot);
    const projectPath = join(workspaceRoot, 'infra/payments-api/Pulumi.yaml');
    const stackPath = join(workspaceRoot, 'infra/payments-api/Pulumi.dev.yaml');
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
    assert.match(editPlan?.rationale ?? '', /payments-api:environment and payments-api:imageTag/);
    assert.match(writeContent, /payments-api:imageTag:\s+3\.4\.5/);
    assert.doesNotMatch(writeContent, /shared-payments:imageTag:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
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
  assert.match(decision.action.summary, /gated operations/i);
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

test('collectApprovalSignals applies tool category approval rules for native stack config writes', async () => {
  const preflight = await buildRunPreflight('update pulumi dev stack for payments-api image tag to 1.2.3', 'fixtures/sample-workspace');
  const signals = collectApprovalSignals({
    task: preflight.task,
    preflight: {
      ...preflight,
      inspection: {
        ...preflight.inspection,
        config: {
          approvalPolicy: {
            requiredWriteRisks: [],
            requiredToolCategories: ['native-stack-config-write']
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
      kind: 'pulumi-stack-config',
      summary: 'Synthetic native stack config write.',
      rationale: 'Tool category approval policy test.',
      pulumiConfigOperations: [
        {
          projectRoot: 'infra/payments-api',
          stackName: 'dev',
          key: 'payments-api:imageTag',
          value: '1.2.3'
        }
      ],
      writes: [
        {
          path: 'infra/payments-api/Pulumi.dev.yaml',
          content: 'config:\n  payments-api:imageTag: 1.2.3\n',
          reason: 'Synthetic Pulumi config write.'
        }
      ]
    }
  });

  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.kind, 'tool-category-approval-required');
  assert.equal(signals[0]?.toolCategory, 'native-stack-config-write');
});

test('explicit approval scope can suppress tool category approval signals', async () => {
  const preflight = await buildRunPreflight('update pulumi dev stack for payments-api image tag to 1.2.3', 'fixtures/sample-workspace', {
    approvedToolCategories: ['native-stack-config-write']
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
            requiredToolCategories: ['native-stack-config-write']
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
      kind: 'pulumi-stack-config',
      summary: 'Synthetic native stack config write.',
      rationale: 'Tool category approval policy test.',
      pulumiConfigOperations: [
        {
          projectRoot: 'infra/payments-api',
          stackName: 'dev',
          key: 'payments-api:imageTag',
          value: '1.2.3'
        }
      ],
      writes: [
        {
          path: 'infra/payments-api/Pulumi.dev.yaml',
          content: 'config:\n  payments-api:imageTag: 1.2.3\n',
          reason: 'Synthetic Pulumi config write.'
        }
      ]
    }
  });

  assert.equal(signals.length, 0);
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
