import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve
} from 'node:path';
import { runSingleStep } from '../../src/agent/run-single-step.ts';
import { RuleBasedPlanningModel } from '../../src/agent/rule-based-planner.ts';

async function writeTerraformRenameKnowledgeWorkspace(root) {
  await mkdir(join(root, 'terraform/app'), { recursive: true });
  await mkdir(join(root, 'knowledge'), { recursive: true });
  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        curatedUnits: [
          {
            domain: 'terraform',
            targetPath: 'terraform/app',
            path: 'knowledge/terraform-rename-units.json',
            name: 'terraform-rename-internal'
          }
        ]
      }
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'terraform/app/main.tf'),
    [
      'resource "aws_s3_bucket" "api" {',
      '  bucket = "example-api"',
      '}',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(
    join(root, 'terraform/app/dev.auto.tfvars'),
    'image_tag = "1.0.0"\n',
    'utf8'
  );
  await writeFile(
    join(root, 'knowledge/terraform-rename-units.json'),
    `${JSON.stringify({
      kind: 'infra-agent.curated-knowledge-units',
      schemaVersion: 1,
      mutationAllowed: false,
      units: [
        {
          unitType: 'guidance',
          path: 'guidance.terraform.logical-rename',
          summary: 'Use Terraform moved blocks when a resource logical name changes but the remote object should be retained.',
          confidence: 'high',
          topic: 'terraform-logical-rename',
          appliesWhen: ['Terraform resource address rename'],
          risk: 'Without a moved block, a rename can look like destroy and create.'
        },
        {
          unitType: 'example',
          path: 'example.terraform.moved-block',
          summary: 'Minimal moved block for a Terraform resource rename.',
          exampleType: 'terraform-moved-block',
          language: 'hcl',
          snippet: 'moved { from = aws_s3_bucket.old to = aws_s3_bucket.api }'
        },
        {
          unitType: 'recipe',
          path: 'recipe.terraform.safe-rename',
          summary: 'Review a Terraform logical rename before editing infrastructure.',
          name: 'Terraform safe logical rename',
          steps: ['Add or verify a moved block.', 'Run a plan before apply.'],
          requiresApproval: true
        }
      ]
    }, null, 2)}\n`,
    'utf8'
  );
}

async function writePulumiAliasKnowledgeWorkspace(root, units = null) {
  await mkdir(join(root, 'infra/api'), { recursive: true });
  await mkdir(join(root, 'knowledge'), { recursive: true });
  const defaultUnits = [
    {
      unitType: 'guidance',
      path: 'guidance.pulumi.logical-rename',
      summary: 'Use Pulumi aliases when a resource logical name changes but the physical resource should be retained.',
      confidence: 'high',
      topic: 'pulumi-logical-rename',
      appliesWhen: ['Pulumi resource logical name rename'],
      risk: 'Without an alias, a rename can be planned as a replacement.'
    },
    {
      unitType: 'recipe',
      path: 'recipe.pulumi.alias-stack-config',
      summary: 'Review Pulumi aliases and stack config before editing resources.',
      name: 'Pulumi alias and stack config review',
      steps: [
        'Collect old and new Pulumi resource type and logical name.',
        'Review aliases for logical renames that retain the physical resource.',
        'Use native stack config writes only after approval.'
      ],
      requiresApproval: true
    }
  ];

  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        curatedUnits: [
          {
            domain: 'pulumi',
            targetPath: 'infra/api',
            path: 'knowledge/pulumi-alias-units.json',
            name: 'pulumi-alias-internal'
          }
        ]
      }
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'infra/api/Pulumi.yaml'),
    'name: api\nruntime: yaml\n',
    'utf8'
  );
  await writeFile(
    join(root, 'infra/api/Pulumi.dev.yaml'),
    'config:\n  api:environment: dev\n',
    'utf8'
  );
  await writeFile(
    join(root, 'knowledge/pulumi-alias-units.json'),
    `${JSON.stringify({
      kind: 'infra-agent.curated-knowledge-units',
      schemaVersion: 1,
      mutationAllowed: false,
      units: units ?? defaultUnits
    }, null, 2)}\n`,
    'utf8'
  );
}

function buildIrrelevantKnowledgePack(domain, targetPath) {
  const sourceId = `${domain}-irrelevant-guidance`;
  return {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: `${domain}-irrelevant-pack`,
    workspaceRoot: '/workspace',
    cacheRoot: '/workspace/.infra-agent/knowledge-cache',
    requestedDomains: [domain],
    targetPaths: [targetPath],
    sourceIds: [sourceId],
    sourceCount: 1,
    factSetCount: 1,
    factCount: 0,
    includedFactCount: 0,
    omittedFactCount: 0,
    unitCount: 1,
    includedUnitCount: 1,
    omittedUnitCount: 0,
    maxFacts: 4,
    maxUnits: 4,
    staleSourceCount: 0,
    storagePolicy: {
      publicReference: 0,
      workspacePrivate: 1,
      shareableByDefault: 0,
      explicitOptInRequired: 1
    },
    sources: [
      {
        id: sourceId,
        domain,
        targetPath,
        kind: 'internal-knowledge',
        name: sourceId,
        factCount: 0,
        contentHash: 'c'.repeat(64),
        fetchedAt: '2026-05-05T00:00:00.000Z',
        stale: false,
        freshness: 'fresh',
        storagePolicy: {
          scope: 'workspace-private',
          defaultStore: 'local-only',
          shareableByDefault: false,
          requiresExplicitOptIn: true,
          reason: 'Local internal guidance.'
        }
      }
    ],
    facts: [],
    units: [
      {
        unitType: 'guidance',
        path: 'guidance.general.change-review',
        summary: 'Review requested infrastructure changes against existing files before editing.',
        confidence: 'medium',
        extractionMethod: 'repo-local-guidance',
        sourceId,
        sourceLocator: 'irrelevant-guidance',
        privacyScope: 'workspace-private',
        topic: 'general-change-review',
        appliesWhen: ['Bounded infrastructure updates'],
        risk: 'Speculative edits can affect unintended resources.'
      }
    ]
  };
}

test('agent runtime loads unit-only knowledge packs from configured curated units', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-runtime-unit-only-'));
  let checked = false;

  try {
    await writeTerraformRenameKnowledgeWorkspace(tempRoot);
    const checkingModel = {
      name: 'unit-only-knowledge-check',
      async decideNextAction({ runtime }) {
        checked = true;
        assert.ok(runtime.knowledgeFacts);
        assert.equal(runtime.knowledgeFacts.factCount, 0);
        assert.ok(runtime.knowledgeFacts.unitCount > 0);
        assert.ok(runtime.knowledgeFacts.units.some(unit =>
          unit.unitType === 'guidance'
          && unit.topic === 'terraform-logical-rename'
        ));
        return {
          confidence: 'high',
          action: {
            kind: 'stop',
            summary: 'Unit-only knowledge checked.',
            rationale: 'Runtime loaded compact knowledge units without facts.',
            payload: {
              stopReason: 'no-safe-action'
            }
          }
        };
      }
    };

    await runSingleStep(
      'rename terraform api dev bucket resource safely',
      tempRoot,
      checkingModel,
      'rule-based',
      undefined,
      {
        retrievedContextBudget: {
          maxFacts: 1
        }
      }
    );

    assert.equal(checked, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based planner does not ask Terraform rename clarification without relevant units', async () => {
  const model = new RuleBasedPlanningModel();
  const decision = await model.decideNextAction({
    runtime: {
      task: 'rename terraform api bucket resource safely',
      preflight: {
        requestedDomains: ['terraform'],
        requestedEnvironment: null,
        targetCandidates: [
          {
            kind: 'terraform-root',
            path: 'terraform/api',
            score: 100,
            reasons: [],
            details: []
          }
        ],
        assumptions: [],
        blockers: [],
        validation: {
          validators: [],
          plan: []
        }
      },
      retrievedContext: [],
      knowledgeFacts: buildIrrelevantKnowledgePack('terraform', 'terraform/api'),
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {}
        }
      ],
      toolSummaries: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.notEqual(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'no-safe-action');
});

test('rule-based planner uses Pulumi alias units to ask for resource identity review details', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-alias-rag-'));

  try {
    await writePulumiAliasKnowledgeWorkspace(tempRoot);
    const result = await runSingleStep(
      'rename pulumi api dev bucket resource safely',
      tempRoot,
      undefined,
      'rule-based',
      undefined,
      {
        maxTurns: 3,
        retrievedContextBudget: {
          maxFacts: 1
        }
      }
    );
    const lastTurn = result.turns[result.turns.length - 1];

    assert.equal(result.outcome, 'clarification-required');
    assert.equal(lastTurn?.decision.action.kind, 'ask-for-clarification');
    assert.equal(lastTurn?.decision.action.payload?.actionFamily, 'pulumi-clarification');
    assert.equal(lastTurn?.decision.action.payload?.clarificationKind, 'general');
    assert.match(lastTurn?.decision.action.summary ?? '', /Pulumi rename, alias, or stack-config/i);
    assert.ok(lastTurn?.decision.action.payload?.questions?.some(question =>
      /old and new Pulumi resource type/i.test(question)
    ));
    assert.ok(lastTurn?.decision.action.payload?.questions?.some(question =>
      /pulumi_config_set/i.test(question)
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based planner uses Pulumi recipe units for URN alias clarification without writes', async () => {
  const model = new RuleBasedPlanningModel();
  const knowledgeFacts = buildIrrelevantKnowledgePack('pulumi', 'infra/api');
  knowledgeFacts.units = [
    {
      unitType: 'recipe',
      path: 'recipe.pulumi.alias-urn-review',
      summary: 'Review Pulumi aliases for old and new URN details before retaining an existing physical resource.',
      extractionMethod: 'repo-local-guidance',
      sourceId: knowledgeFacts.sourceIds[0],
      sourceLocator: 'pulumi-recipes.md',
      privacyScope: 'workspace-private',
      name: 'Pulumi alias URN review',
      steps: ['Collect old and new Pulumi URN details.', 'Review aliases before retaining the existing physical resource.'],
      requiresApproval: true
    }
  ];
  const runtime = {
    task: 'review alias for old/new URN retaining physical resource',
    preflight: {
      requestedDomains: ['pulumi'],
      requestedEnvironment: null,
      targetCandidates: [
        {
          kind: 'pulumi-project',
          path: 'infra/api',
          score: 100,
          reasons: [],
          details: []
        }
      ],
      assumptions: [],
      blockers: [],
      validation: {
        validators: [],
        plan: []
      }
    },
    retrievedContext: [],
    knowledgeFacts,
    observations: [{ toolName: 'read_file', safety: 'read_only', output: {} }],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const decision = await model.decideNextAction({ runtime });

  assert.equal(runtime.appliedWrites.length, 0);
  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.actionFamily, 'pulumi-clarification');
  assert.equal(decision.action.payload?.clarificationKind, 'general');
  assert.match(decision.action.summary ?? '', /Pulumi rename, alias, or stack-config/i);
});

test('rule-based planner does not ask Pulumi rename clarification without relevant units', async () => {
  const model = new RuleBasedPlanningModel();
  const decision = await model.decideNextAction({
    runtime: {
      task: 'rename pulumi api bucket resource safely',
      preflight: {
        requestedDomains: ['pulumi'],
        requestedEnvironment: null,
        targetCandidates: [
          {
            kind: 'pulumi-project',
            path: 'infra/api',
            score: 100,
            reasons: [],
            details: []
          }
        ],
        assumptions: [],
        blockers: [],
        validation: {
          validators: [],
          plan: []
        }
      },
      retrievedContext: [],
      knowledgeFacts: buildIrrelevantKnowledgePack('pulumi', 'infra/api'),
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {}
        }
      ],
      toolSummaries: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.notEqual(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'no-safe-action');
});

test('rule-based planner does not ask Pulumi URN clarification with irrelevant units', async () => {
  const model = new RuleBasedPlanningModel();
  const decision = await model.decideNextAction({
    runtime: {
      task: 'review alias for old/new URN retaining physical resource',
      preflight: {
        requestedDomains: ['pulumi'],
        requestedEnvironment: null,
        targetCandidates: [
          {
            kind: 'pulumi-project',
            path: 'infra/api',
            score: 100,
            reasons: [],
            details: []
          }
        ],
        assumptions: [],
        blockers: [],
        validation: {
          validators: [],
          plan: []
        }
      },
      retrievedContext: [],
      knowledgeFacts: buildIrrelevantKnowledgePack('pulumi', 'infra/api'),
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {}
        }
      ],
      toolSummaries: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.notEqual(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'no-safe-action');
});

test('rule-based planner gates Pulumi stack config edits behind alias knowledge review', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-alias-stack-config-rag-'));

  try {
    await writePulumiAliasKnowledgeWorkspace(tempRoot, [
      {
        unitType: 'recipe',
        path: 'recipe.pulumi.alias-stack-config',
        summary: 'Review Pulumi aliases and stack config before editing resources.',
        name: 'Pulumi alias and stack config review',
        steps: [
          'Collect old and new Pulumi resource type and logical name.',
          'Review aliases for logical renames that retain the physical resource.',
          'Use native stack config writes only after approval.'
        ],
        requiresApproval: true
      }
    ]);
    const result = await runSingleStep(
      'rename pulumi api dev image tag to 2.3.4 while retaining the existing resource',
      tempRoot,
      undefined,
      'rule-based',
      undefined,
      {
        maxTurns: 3,
        retrievedContextBudget: {
          maxFacts: 4
        }
      }
    );
    const lastTurn = result.turns[result.turns.length - 1];

    assert.equal(result.outcome, 'clarification-required');
    assert.equal(result.runtime.appliedWrites.length, 0);
    assert.equal(lastTurn?.decision.action.kind, 'ask-for-clarification');
    assert.equal(lastTurn?.decision.action.payload?.actionFamily, 'pulumi-clarification');
    assert.match(lastTurn?.decision.action.rationale ?? '', /before applying bounded stack config edits/i);
    assert.ok(result.runtime.knowledgeFacts?.units.some(unit =>
      unit.unitType === 'recipe'
      && /aliases/i.test(JSON.stringify(unit))
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based planner surfaces Pulumi validation diagnostics for alias review', async () => {
  const model = new RuleBasedPlanningModel();
  const decision = await model.decideNextAction({
    runtime: {
      task: 'review pulumi prod preview failure for CloudFront alias replacement',
      preflight: {
        requestedDomains: ['pulumi'],
        requestedEnvironment: 'prod',
        targetCandidates: [
          {
            kind: 'pulumi-project',
            path: 'infra/edge',
            score: 100,
            reasons: [],
            details: []
          }
        ],
        assumptions: [],
        blockers: [],
        validation: {
          validators: [{ name: 'pulumi', available: true }],
          plan: [
            {
              kind: 'pulumi',
              target: 'infra/edge',
              commands: ['pulumi preview --cwd infra/edge --stack prod']
            }
          ]
        }
      },
      retrievedContext: [],
      knowledgeFacts: {
        kind: 'infra-agent.knowledge-pack',
        schemaVersion: 1,
        mutationAllowed: false,
        packId: 'pulumi-diagnostic-pack',
        workspaceRoot: '/workspace',
        cacheRoot: '/workspace/.infra-agent/knowledge-cache',
        requestedDomains: ['pulumi'],
        targetPaths: ['infra/edge'],
        sourceIds: ['pulumi-config-source'],
        sourceCount: 1,
        factSetCount: 1,
        factCount: 0,
        includedFactCount: 0,
        omittedFactCount: 0,
        unitCount: 1,
        includedUnitCount: 1,
        omittedUnitCount: 0,
        maxFacts: 4,
        maxUnits: 4,
        staleSourceCount: 0,
        storagePolicy: {
          publicReference: 0,
          workspacePrivate: 1,
          shareableByDefault: 0,
          explicitOptInRequired: 1
        },
        sources: [
          {
            id: 'pulumi-config-source',
            domain: 'pulumi',
            targetPath: 'infra/edge',
            kind: 'pulumi-config',
            name: 'pulumi-config:infra/edge',
            factCount: 0,
            contentHash: 'a'.repeat(64),
            fetchedAt: null,
            stale: false,
            freshness: 'fresh',
            storagePolicy: {
              scope: 'workspace-private',
              defaultStore: 'local-only',
              shareableByDefault: false,
              requiresExplicitOptIn: true,
              reason: 'Local Pulumi config source.'
            }
          }
        ],
        facts: [],
        units: [
          {
            unitType: 'diagnostic',
            path: 'diagnostic.pulumi.aws-cloudfront-alias.edge',
            summary: 'Pulumi preview detected a CloudFront alias ownership conflict.',
            confidence: 'high',
            extractionMethod: 'validation-diagnostic',
            sourceId: 'pulumi-config-source',
            sourceLocator: 'pulumi preview --cwd infra/edge --stack prod',
            privacyScope: 'private-run',
            engine: 'pulumi',
            signature: 'CNAMEAlreadyExists',
            likelyCause: 'Pulumi attempted to create a CloudFront alias before ownership was resolved.',
            recommendedReview: [
              'Confirm CloudFront alias ownership, certificate coverage, distribution ownership, and DNS cutover before transfer or import.',
              'For logical Pulumi renames, prefer reviewed aliases, import/state review, or bounded stack config changes before retrying preview.'
            ]
          }
        ]
      },
      observations: [
        {
          toolName: 'pulumi_preview',
          safety: 'read_only',
          output: {}
        }
      ],
      toolSummaries: [],
      appliedWrites: [],
      validationResults: [
        {
          command: 'pulumi preview --cwd infra/edge --stack prod',
          cwd: '/workspace',
          exitCode: 1,
          stdout: '',
          stderr: 'CNAMEAlreadyExists: api.example.com is already associated with another distribution.'
        }
      ],
      validationIssues: [
        {
          kind: 'pulumi-create-before-delete-conflict',
          repairable: false,
          sourceCommand: 'pulumi preview --cwd infra/edge --stack prod',
          message: 'CloudFront alias api.example.com is already associated with another distribution.',
          guidance: 'Use alias/import/state review or sequence the DNS cutover explicitly.'
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'validation-blocked');
  assert.equal(decision.action.payload?.actionFamily, 'pulumi-validation');
  assert.match(decision.action.summary, /Pulumi validation failed/i);
  assert.match(decision.action.rationale, /CloudFront alias ownership/i);
  assert.match(decision.action.rationale, /aliases, import\/state review/i);
});

test('rule-based planner ignores stale Pulumi diagnostic for Helm validation failure', async () => {
  const model = new RuleBasedPlanningModel();
  const knowledgeFacts = buildIrrelevantKnowledgePack('helm', 'charts/payments-api');
  knowledgeFacts.sourceIds = ['stale-pulumi-source'];
  knowledgeFacts.staleSourceCount = 1;
  knowledgeFacts.sources = [
    {
      id: 'stale-pulumi-source',
      domain: 'pulumi',
      targetPath: 'infra/edge',
      kind: 'pulumi-config',
      name: 'pulumi-config:infra/edge',
      factCount: 0,
      contentHash: 'd'.repeat(64),
      fetchedAt: '2026-05-01T00:00:00.000Z',
      stale: true,
      freshness: 'stale',
      storagePolicy: {
        scope: 'workspace-private',
        defaultStore: 'local-only',
        shareableByDefault: false,
        requiresExplicitOptIn: true,
        reason: 'Local Pulumi config source.'
      }
    }
  ];
  knowledgeFacts.units = [
    {
      unitType: 'diagnostic',
      path: 'diagnostic.pulumi.aws-cloudfront-alias.edge',
      summary: 'Stale Pulumi preview detected a CloudFront alias ownership conflict.',
      confidence: 'high',
      extractionMethod: 'validation-diagnostic',
      sourceId: 'stale-pulumi-source',
      sourceLocator: 'pulumi preview --cwd infra/edge --stack prod',
      privacyScope: 'private-run',
      engine: 'pulumi',
      signature: 'CNAMEAlreadyExists',
      likelyCause: 'Pulumi attempted to create a CloudFront alias before ownership was resolved.',
      recommendedReview: [
        'Confirm CloudFront alias ownership, certificate coverage, distribution ownership, and DNS cutover before transfer or import.',
        'For logical Pulumi renames, prefer reviewed aliases, import/state review, or bounded stack config changes before retrying preview.'
      ]
    }
  ];
  const decision = await model.decideNextAction({
    runtime: {
      task: 'review helm template failure for payments-api service port',
      preflight: {
        requestedDomains: ['helm'],
        requestedEnvironment: 'dev',
        targetCandidates: [
          {
            kind: 'helm-chart',
            path: 'charts/payments-api',
            score: 100,
            reasons: [],
            details: []
          }
        ],
        assumptions: [],
        blockers: [],
        validation: {
          validators: [{ name: 'helm', available: true }],
          plan: [
            {
              kind: 'helm',
              target: 'charts/payments-api',
              commands: ['helm template charts/payments-api']
            }
          ]
        }
      },
      retrievedContext: [],
      knowledgeFacts,
      observations: [
        {
          toolName: 'helm_template',
          safety: 'read_only',
          output: {}
        }
      ],
      toolSummaries: [],
      appliedWrites: [],
      validationResults: [
        {
          command: 'helm template charts/payments-api',
          cwd: '/workspace',
          exitCode: 1,
          stdout: '',
          stderr: 'template: service.yaml: executing at <.Values.service.port>: nil pointer evaluating interface {}.port'
        }
      ],
      validationIssues: [
        {
          kind: 'helm-missing-service-port',
          repairable: true,
          sourceCommand: 'helm template charts/payments-api',
          message: 'Validation failed because .Values.service.port is missing.',
          guidance: 'Read chart values and define service.port before rerunning helm template.'
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'validation-blocked');
  assert.notEqual(decision.action.payload?.actionFamily, 'pulumi-validation');
  assert.doesNotMatch(decision.action.summary, /Pulumi validation failed/i);
});

test('rule-based planner surfaces Helm validation diagnostics for chart values review', async () => {
  const model = new RuleBasedPlanningModel();
  const decision = await model.decideNextAction({
    runtime: {
      task: 'review helm template failure for payments-api service port',
      preflight: {
        requestedDomains: ['helm'],
        requestedEnvironment: 'dev',
        targetCandidates: [
          {
            kind: 'helm-chart',
            path: 'charts/payments-api',
            score: 100,
            reasons: [],
            details: []
          }
        ],
        assumptions: [],
        blockers: [],
        validation: {
          validators: [{ name: 'helm', available: true }],
          plan: [
            {
              kind: 'helm',
              target: 'charts/payments-api',
              commands: ['helm template charts/payments-api']
            }
          ]
        }
      },
      retrievedContext: [],
      knowledgeFacts: {
        kind: 'infra-agent.knowledge-pack',
        schemaVersion: 1,
        mutationAllowed: false,
        packId: 'helm-diagnostic-pack',
        workspaceRoot: '/workspace',
        cacheRoot: '/workspace/.infra-agent/knowledge-cache',
        requestedDomains: ['helm'],
        targetPaths: ['charts/payments-api'],
        sourceIds: ['chart-docs-source'],
        sourceCount: 1,
        factSetCount: 1,
        factCount: 0,
        includedFactCount: 0,
        omittedFactCount: 0,
        unitCount: 1,
        includedUnitCount: 1,
        omittedUnitCount: 0,
        maxFacts: 4,
        maxUnits: 4,
        staleSourceCount: 0,
        storagePolicy: {
          publicReference: 1,
          workspacePrivate: 0,
          shareableByDefault: 1,
          explicitOptInRequired: 0
        },
        sources: [
          {
            id: 'chart-docs-source',
            domain: 'helm',
            targetPath: 'charts/payments-api',
            kind: 'chart-docs',
            name: 'chart-docs:payments-api',
            factCount: 0,
            contentHash: 'b'.repeat(64),
            fetchedAt: '2026-05-05T00:00:00.000Z',
            stale: false,
            freshness: 'fresh',
            storagePolicy: {
              scope: 'public-reference',
              defaultStore: 'local-or-explicit-team-cache',
              shareableByDefault: true,
              requiresExplicitOptIn: false,
              reason: 'Public chart documentation source.'
            }
          }
        ],
        facts: [],
        units: [
          {
            unitType: 'diagnostic',
            path: 'diagnostic.helm.payments-api.service.port',
            summary: 'Helm chart requires service.port before rendering templates.',
            confidence: 'high',
            extractionMethod: 'provider-diagnostic',
            sourceId: 'chart-docs-source',
            sourceLocator: 'README.md: Troubleshooting',
            privacyScope: 'public-reference',
            engine: 'helm',
            signature: 'Error: service.port is required',
            likelyCause: 'The selected values file omitted a required chart value.',
            recommendedReview: [
              'Inspect chart values and confirm service.port is declared for the selected environment.',
              'Run helm template for the selected chart after updating values.'
            ]
          }
        ]
      },
      observations: [
        {
          toolName: 'helm_template',
          safety: 'read_only',
          output: {}
        }
      ],
      toolSummaries: [],
      appliedWrites: [],
      validationResults: [
        {
          command: 'helm template charts/payments-api',
          cwd: '/workspace',
          exitCode: 1,
          stdout: '',
          stderr: 'template: service.yaml: executing at <.Values.service.port>: nil pointer evaluating interface {}.port'
        }
      ],
      validationIssues: [
        {
          kind: 'helm-missing-service-port',
          repairable: true,
          sourceCommand: 'helm template charts/payments-api',
          message: 'Validation failed because .Values.service.port is missing.',
          guidance: 'Read chart values and define service.port before rerunning helm template.'
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'validation-blocked');
  assert.equal(decision.action.payload?.actionFamily, 'helm-validation');
  assert.match(decision.action.summary, /Helm validation failed/i);
  assert.match(decision.action.rationale, /service\.port is declared/i);
  assert.match(decision.action.rationale, /helm template/i);
});

test('rule-based planner uses Terraform rename units to ask for moved-block review details', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-rename-rag-'));

  try {
    await writeTerraformRenameKnowledgeWorkspace(tempRoot);
    const result = await runSingleStep(
      'rename terraform api dev bucket resource safely',
      tempRoot,
      undefined,
      'rule-based',
      undefined,
      {
        maxTurns: 3,
        retrievedContextBudget: {
          maxFacts: 1
        }
      }
    );
    const lastTurn = result.turns[result.turns.length - 1];

    assert.equal(result.outcome, 'clarification-required');
    assert.equal(lastTurn?.decision.action.kind, 'ask-for-clarification');
    assert.equal(lastTurn?.decision.action.payload?.actionFamily, 'terraform-clarification');
    assert.equal(lastTurn?.decision.action.payload?.clarificationKind, 'general');
    assert.match(lastTurn?.decision.action.summary ?? '', /Terraform logical rename/i);
    assert.ok(lastTurn?.decision.action.payload?.questions?.some(question =>
      /old and new Terraform resource addresses/i.test(question)
    ));
    assert.ok(lastTurn?.decision.action.payload?.questions?.some(question =>
      /moved block/i.test(question)
    ));
    assert.doesNotMatch(JSON.stringify(lastTurn?.decision), /moved \{ from = aws_s3_bucket\.old/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
