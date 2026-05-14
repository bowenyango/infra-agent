import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  cp,
  writeFile,
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

function terraformMovedBlockKnowledgePack(targetPath = 'terraform/payments-api') {
  return {
    units: [
      terraformMovedBlockKnowledgeUnit('guidance')
    ],
    targetPaths: [targetPath],
    requestedDomains: ['terraform']
  };
}

function terraformMovedBlockKnowledgeUnit(unitType) {
  const base = {
    path: `${unitType}.terraform.logical-rename`,
    summary: 'Use Terraform moved blocks when a resource logical name changes but the remote object should be retained.',
    confidence: 'high',
    extractionMethod: 'repo-local-guidance',
    sourceId: `terraform-rename-${unitType}`,
    sourceLocator: `knowledge/terraform-rename-${unitType}.json`,
    privacyScope: 'workspace-private'
  };

  switch (unitType) {
    case 'fact':
      return {
        ...base,
        unitType,
        factKind: 'resource',
        values: ['terraform resource address rename', 'moved block retains the remote object']
      };
    case 'guidance':
      return {
        ...base,
        unitType,
        topic: 'terraform-logical-rename',
        appliesWhen: ['Terraform resource address rename'],
        risk: 'Without a moved block, a rename can look like destroy and create.'
      };
    case 'example':
      return {
        ...base,
        unitType,
        exampleType: 'terraform-moved-block',
        language: 'hcl',
        snippet: 'moved { from = aws_s3_bucket.old to = aws_s3_bucket.api }',
        appliesWhen: ['Terraform resource address rename']
      };
    case 'diagnostic':
      return {
        ...base,
        unitType,
        engine: 'terraform',
        signature: 'plan shows delete/create after resource address rename',
        likelyCause: 'Terraform needs a moved block for a logical resource address rename.',
        recommendedReview: ['Add a reviewed Terraform moved block or use state mv before replacement.']
      };
    case 'recipe':
      return {
        ...base,
        unitType,
        name: 'Terraform logical resource address rename',
        steps: [
          'Confirm the old and new Terraform resource addresses.',
          'Add a moved block so Terraform retains the existing remote object.'
        ],
        mutationAllowed: false
      };
    default:
      throw new Error(`unsupported test knowledge unit type: ${unitType}`);
  }
}

function terraformMovedBlockKnowledgePackForUnit(unitType, targetPath = 'terraform/payments-api') {
  return {
    units: [
      terraformMovedBlockKnowledgeUnit(unitType)
    ],
    targetPaths: [targetPath],
    requestedDomains: ['terraform']
  };
}

function terraformEditRuntime(preflight, overrides = {}) {
  return {
    task: preflight.task,
    preflight,
    knowledgeFacts: null,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null,
    ...overrides
  };
}

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

test('buildEditPlan creates a Terraform moved block from explicit RAG-backed rename addresses', async () => {
  const preflight = await buildRunPreflight(
    'rename terraform payments-api dev from aws_s3_bucket.old to aws_s3_bucket.api',
    'fixtures/terraform-workspace'
  );
  const mainTfPath = resolve('fixtures/terraform-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan(terraformEditRuntime(preflight, {
    knowledgeFacts: terraformMovedBlockKnowledgePack(),
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
    ]
  }));

  assert.ok(editPlan);
  assert.equal(editPlan?.kind, 'terraform-moved-block');
  assert.equal(editPlan?.writes[0]?.path, 'terraform/payments-api/moved.tf');
  assert.equal(editPlan?.writes[0]?.mode, 'create');
  assert.match(editPlan?.rationale ?? '', /compact RAG units/i);
  assert.match(editPlan?.writes[0]?.content ?? '', /moved \{/);
  assert.match(editPlan?.writes[0]?.content ?? '', /from = aws_s3_bucket\.old/);
  assert.match(editPlan?.writes[0]?.content ?? '', /to   = aws_s3_bucket\.api/);
});

test('buildEditPlan creates multiple Terraform moved blocks from explicit RAG-backed rename address pairs', async () => {
  const preflight = await buildRunPreflight(
    [
      'rename terraform payments-api dev',
      'from aws_s3_bucket.old to aws_s3_bucket.api',
      'and from aws_iam_role.old to aws_iam_role.api'
    ].join(' '),
    'fixtures/terraform-workspace'
  );
  const mainTfPath = resolve('fixtures/terraform-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan(terraformEditRuntime(preflight, {
    knowledgeFacts: terraformMovedBlockKnowledgePack(),
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
    ]
  }));

  assert.ok(editPlan);
  assert.equal(editPlan?.kind, 'terraform-moved-block');
  assert.equal(editPlan?.writes.length, 1);
  assert.equal(editPlan?.writes[0]?.path, 'terraform/payments-api/moved.tf');
  assert.equal(editPlan?.writes[0]?.mode, 'create');
  assert.match(editPlan?.writes[0]?.content ?? '', /from = aws_s3_bucket\.old/);
  assert.match(editPlan?.writes[0]?.content ?? '', /to   = aws_s3_bucket\.api/);
  assert.match(editPlan?.writes[0]?.content ?? '', /from = aws_iam_role\.old/);
  assert.match(editPlan?.writes[0]?.content ?? '', /to   = aws_iam_role\.api/);
  assert.equal((editPlan?.writes[0]?.content.match(/moved \{/g) ?? []).length, 2);
});

test('buildEditPlan accepts Terraform moved block knowledge from compact non-guidance units', async t => {
  for (const unitType of ['example', 'diagnostic', 'recipe', 'fact']) {
    await t.test(unitType, async () => {
      const preflight = await buildRunPreflight(
        'rename terraform payments-api dev from aws_s3_bucket.old to aws_s3_bucket.api',
        'fixtures/terraform-workspace'
      );

      const editPlan = buildEditPlan(terraformEditRuntime(preflight, {
        knowledgeFacts: terraformMovedBlockKnowledgePackForUnit(unitType)
      }));

      assert.equal(editPlan?.kind, 'terraform-moved-block');
      assert.equal(editPlan?.writes[0]?.path, 'terraform/payments-api/moved.tf');
      assert.match(editPlan?.writes[0]?.content ?? '', /from = aws_s3_bucket\.old/);
      assert.match(editPlan?.writes[0]?.content ?? '', /to   = aws_s3_bucket\.api/);
    });
  }
});

test('buildEditPlan does not create Terraform moved blocks without explicit old and new addresses', async () => {
  const preflight = await buildRunPreflight(
    'rename terraform payments-api dev bucket resource safely',
    'fixtures/terraform-workspace'
  );

  const editPlan = buildEditPlan(terraformEditRuntime(preflight, {
    knowledgeFacts: terraformMovedBlockKnowledgePack()
  }));

  assert.equal(editPlan, null);
});

test('buildEditPlan keeps Terraform moved block generation tied to RAG units', async () => {
  const preflight = await buildRunPreflight(
    'rename terraform payments-api dev from aws_s3_bucket.old to aws_s3_bucket.api',
    'fixtures/terraform-workspace'
  );

  const editPlan = buildEditPlan(terraformEditRuntime(preflight));

  assert.equal(editPlan, null);
});

test('buildEditPlan ignores Terraform moved block knowledge scoped to a different target path', async () => {
  const preflight = await buildRunPreflight(
    'rename terraform payments-api dev from aws_s3_bucket.old to aws_s3_bucket.api',
    'fixtures/terraform-workspace'
  );

  const editPlan = buildEditPlan(terraformEditRuntime(preflight, {
    knowledgeFacts: terraformMovedBlockKnowledgePack('terraform/other-service')
  }));

  assert.equal(editPlan, null);
});

test('buildEditPlan appends Terraform moved blocks to an observed moved.tf file', async () => {
  const preflight = await buildRunPreflight(
    'rename terraform payments-api dev from aws_s3_bucket.old to aws_s3_bucket.api',
    'fixtures/terraform-workspace'
  );
  const movedTfPath = resolve('fixtures/terraform-workspace/terraform/payments-api/moved.tf');
  const existingMovedContent = [
    'moved {',
    '  from = aws_s3_bucket.legacy',
    '  to   = aws_s3_bucket.current',
    '}',
    ''
  ].join('\n');

  const editPlan = buildEditPlan(terraformEditRuntime(preflight, {
    knowledgeFacts: terraformMovedBlockKnowledgePack(),
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: movedTfPath,
          content: existingMovedContent,
          truncated: false
        }
      }
    ]
  }));

  assert.equal(editPlan?.kind, 'terraform-moved-block');
  assert.equal(editPlan?.writes[0]?.mode, 'append');
  assert.match(editPlan?.writes[0]?.content ?? '', /from = aws_s3_bucket\.legacy/);
  assert.match(editPlan?.writes[0]?.content ?? '', /from = aws_s3_bucket\.old/);
});

test('buildEditPlan avoids duplicating an existing Terraform moved block', async () => {
  const preflight = await buildRunPreflight(
    'rename terraform payments-api dev from aws_s3_bucket.old to aws_s3_bucket.api',
    'fixtures/terraform-workspace'
  );
  const movedTfPath = resolve('fixtures/terraform-workspace/terraform/payments-api/moved.tf');
  const existingMovedContent = [
    'moved {',
    '  from = aws_s3_bucket.old',
    '  to   = aws_s3_bucket.api',
    '}',
    ''
  ].join('\n');

  const editPlan = buildEditPlan(terraformEditRuntime(preflight, {
    knowledgeFacts: terraformMovedBlockKnowledgePack(),
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: movedTfPath,
          content: existingMovedContent,
          truncated: false
        }
      }
    ]
  }));

  assert.equal(editPlan, null);
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

test('buildEditPlan creates a bounded Pulumi missing-config repair plan from a stack ref', async () => {
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
        command: 'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack org/project/dev --non-interactive',
        exitCode: 1,
        stdout: '',
        stderr: 'error: missing required configuration variable "payments-api:imageTag"; run `pulumi config set payments-api:imageTag <value>`'
      }
    ],
    validationIssues: [
      {
        kind: 'pulumi-missing-config',
        repairable: true,
        sourceCommand: 'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack org/project/dev --non-interactive',
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
  assert.equal(editPlan?.writes[0]?.path, 'infra/payments-api/Pulumi.dev.yaml');
  assert.equal(editPlan?.pulumiConfigOperations?.[0]?.stackName, 'dev');
  assert.equal(editPlan?.pulumiConfigOperations?.[0]?.key, 'payments-api:imageTag');
  assert.equal(editPlan?.pulumiConfigOperations?.[0]?.value, '1.2.3');
  assert.match(editPlan?.writes[0]?.content ?? '', /payments-api:imageTag: 1\.2\.3/);
});

test('buildEditPlan preserves dotted Pulumi stack names from missing-config source commands', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'infra-agent-pulumi-stack-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp('fixtures/sample-workspace', workspaceRoot, { recursive: true });
    const stackPath = join(workspaceRoot, 'infra/payments-api/Pulumi.tenant-shared.non-prod.yaml');
    await writeFile(
      stackPath,
      'config:\n  payments-api:environment: tenant-shared.non-prod\n',
      'utf8'
    );
    await writeFile(
      join(workspaceRoot, 'infra-agent.config.json'),
      JSON.stringify({ profileId: 'generic' }),
      'utf8'
    );

    const preflight = await buildRunPreflight(
      'update pulumi tenant-shared non-prod stack for payments-api image tag to 2.4.0',
      workspaceRoot
    );

    const editPlan = buildEditPlan({
      task: preflight.task,
      preflight,
      observations: [
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
      validationResults: [
        {
          command: 'pulumi preview --cwd infra/payments-api --stack tenant-shared.non-prod --non-interactive',
          exitCode: 1,
          stdout: '',
          stderr: 'error: missing required configuration variable "payments-api:imageTag"; run `pulumi config set payments-api:imageTag <value>`'
        }
      ],
      validationIssues: [
        {
          kind: 'pulumi-missing-config',
          repairable: true,
          sourceCommand: 'pulumi preview --cwd infra/payments-api --stack tenant-shared.non-prod --non-interactive',
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
    assert.equal(editPlan?.writes[0]?.path, 'infra/payments-api/Pulumi.tenant-shared.non-prod.yaml');
    assert.equal(editPlan?.pulumiConfigOperations?.[0]?.stackName, 'tenant-shared.non-prod');
    assert.match(editPlan?.writes[0]?.content ?? '', /payments-api:imageTag: 2\.4\.0/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
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
