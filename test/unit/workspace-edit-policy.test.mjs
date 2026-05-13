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
    'terraform-moved-block',
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
    'terraform-moved-block',
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
