import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { inspectWorkspace } from '../src/domain/inspect-workspace.ts';
import { runSingleStep } from '../src/agent/run-single-step.ts';
import { executeDecision } from '../src/agent/execute-decision.ts';
import { buildTargetCandidates } from '../src/domain/task-targeting.ts';
import { buildRunPreflight } from '../src/agent/build-run-preflight.ts';
import { selectValidationCommands } from '../src/agent/select-validation-commands.ts';
import { buildValidationPreflight } from '../src/validators/preflight.ts';
import { classifyValidationIssues } from '../src/agent/classify-validation-issues.ts';
import { RuleBasedPlanningModel } from '../src/agent/rule-based-planner.ts';
import { parsePlannerDecision } from '../src/model/decision-parser.ts';
import { buildPlannerSystemPrompt } from '../src/model/prompt.ts';
import { buildEditPlan } from '../src/agent/build-edit-plan.ts';
import { collectApprovalSignals } from '../src/agent/collect-approval-signals.ts';
import { executeTool } from '../src/services/tools/execute-tool.ts';
import { SearchWorkspaceTool } from '../src/tools/SearchWorkspaceTool/SearchWorkspaceTool.ts';
import { resolveEffectiveApprovalPolicy } from '../src/domain/workspace-policy.ts';
import { resolveEffectiveEditPolicy } from '../src/domain/edit-policy.ts';

test('inspect command detects fixture workspace assets', () => {
  const inspection = inspectWorkspace('fixtures/sample-workspace');

  return inspection.then(result => {
    assert.equal(result.profile.id, 'generic');
    assert.equal(result.helmCharts.length, 1);
    assert.equal(result.pulumiProjects.length, 1);
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

test('resolveEffectiveEditPolicy exposes workspace config overrides', () => {
  const effectivePolicy = resolveEffectiveEditPolicy(
    {
      editPolicy: {
        allowedEditPlanKinds: ['pulumi-stack-config'],
        allowedTargetPrefixes: ['./networking/']
      }
    },
    'scrawlr-infra-apps'
  );

  assert.deepEqual(effectivePolicy.allowedEditPlanKinds, ['pulumi-stack-config']);
  assert.deepEqual(effectivePolicy.allowedTargetPrefixes, ['networking']);
  assert.deepEqual(effectivePolicy.sources, ['workspace-config: editPolicy']);
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
