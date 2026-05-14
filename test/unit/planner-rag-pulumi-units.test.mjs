import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { runSingleStep } from '../../src/agent/run-single-step.ts';
import { RuleBasedPlanningModel } from '../../src/agent/rule-based-planner.ts';
import {
  buildIrrelevantKnowledgePack,
  writePulumiAliasKnowledgeWorkspace
} from '../support/planner-rag-unit-fixtures.mjs';

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
