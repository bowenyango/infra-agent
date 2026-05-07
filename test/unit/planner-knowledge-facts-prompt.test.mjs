import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlannerUserPrompt } from '../../src/model/prompt.ts';

function buildPreflightFixture() {
  return {
    task: 'update pulumi api bucket configuration',
    workspaceRoot: '/workspace',
    profile: {
      id: 'generic',
      label: 'Generic infrastructure repository',
      reasons: []
    },
    approval: {
      approvedWritePaths: [],
      approvedWriteRisks: [],
      approvedToolCategories: []
    },
    effectiveApprovalPolicy: {
      requiredWriteRisks: [],
      requiredToolCategories: [],
      pathRules: [],
      sources: []
    },
    effectiveEditPolicy: {
      allowedEditPlanKinds: null,
      allowedTargetPrefixes: null,
      allowedTargetPrefixesByKind: {},
      sources: []
    },
    inspection: {
      workspaceRoot: '/workspace',
      profile: {
        id: 'generic',
        label: 'Generic infrastructure repository',
        reasons: []
      },
      config: null,
      configSemantics: [],
      domainCapabilities: [],
      helmCharts: [],
      pulumiProjects: [],
      terraformRoots: [],
      knowledgeCache: {
        root: '/workspace/.infra-agent/knowledge-cache',
        source: 'default'
      },
      counts: {
        helmChartFiles: 0,
        pulumiProjectFiles: 0,
        pulumiStackFiles: 0,
        terraformRootFiles: 0,
        terraformVariableFiles: 0
      }
    },
    validation: {
      workspaceRoot: '/workspace',
      validators: [],
      plan: [],
      usedWorkspaceConfig: false
    },
    requestedDomains: ['pulumi'],
    requestedEnvironment: null,
    requestedService: null,
    targetCandidates: [
      {
        kind: 'pulumi-project',
        name: 'api',
        path: 'infra/api',
        score: 10,
        reasons: ['matched task'],
        matchedEnvironmentHints: [],
        details: []
      }
    ],
    assumptions: [],
    blockers: [],
    nextActions: []
  };
}

function buildPackageDocsKnowledgePack() {
  return {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: 'abcdefabcdefabcdefabcdef',
    workspaceRoot: '/workspace',
    cacheRoot: '/workspace/.infra-agent/knowledge-cache',
    requestedDomains: ['pulumi'],
    targetPaths: ['infra/api'],
    sourceIds: ['pulumi-docs/aws-package'],
    sourceCount: 1,
    factSetCount: 1,
    factCount: 2,
    includedFactCount: 2,
    omittedFactCount: 0,
    maxFacts: 2,
    staleSourceCount: 0,
    storagePolicy: {
      publicReference: 1,
      workspacePrivate: 0,
      explicitOptInRequired: 0,
      shareableByDefault: 1,
      defaultStores: {
        'local-only': 0,
        'local-or-explicit-team-cache': 1
      }
    },
    sources: [
      {
        id: 'pulumi-docs/aws-package',
        domain: 'pulumi',
        targetPath: 'infra/api',
        kind: 'pulumi-docs',
        name: 'pulumi-docs:package:aws',
        factCount: 2,
        contentHash: 'a'.repeat(64),
        fetchedAt: '2026-05-06T00:00:00.000Z',
        staleAfter: '2026-06-05T00:00:00.000Z',
        stale: false,
        freshness: 'fresh',
        storagePolicy: {
          scope: 'public-reference',
          defaultStore: 'local-or-explicit-team-cache',
          shareableByDefault: true,
          requiresExplicitOptIn: false,
          reason: 'Pulumi package docs are public reference material.'
        }
      }
    ],
    facts: [
      {
        kind: 'pulumi-docs-guidance',
        path: 'pulumi.package.aws.s3',
        summary: 'S3 resources for buckets and objects.',
        confidence: 'medium',
        extractionMethod: 'pulumi-docs-markdown',
        sourceId: 'pulumi-docs/aws-package',
        sourceLocator: 'Pulumi package docs: s3',
        values: ['s3']
      },
      {
        kind: 'pulumi-docs-guidance',
        path: 'pulumi.package.aws.lambda',
        summary: 'Lambda resources manage functions.',
        confidence: 'medium',
        extractionMethod: 'pulumi-docs-markdown',
        sourceId: 'pulumi-docs/aws-package',
        sourceLocator: 'Pulumi package docs: lambda',
        values: ['lambda']
      }
    ]
  };
}

test('planner user prompt includes budgeted Pulumi package docs facts without raw docs', () => {
  const prompt = buildPlannerUserPrompt({
    task: 'update pulumi api bucket configuration',
    preflight: buildPreflightFixture(),
    knowledgeFacts: buildPackageDocsKnowledgePack(),
    retrievedContextBudget: {
      maxPackets: 5,
      maxTokens: 1000,
      maxExcerptChars: 1200,
      maxFacts: 1
    },
    retrievedContext: [],
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });
  const parsed = JSON.parse(prompt);

  assert.equal(parsed.knowledgeFacts.kind, 'infra-agent.knowledge-facts-summary');
  assert.equal(parsed.knowledgeFacts.mutationAllowed, false);
  assert.equal(parsed.knowledgeFacts.maxFacts, 1);
  assert.equal(parsed.knowledgeFacts.includedFactCount, 1);
  assert.equal(parsed.knowledgeFacts.omittedFactCount, 1);
  assert.equal(parsed.knowledgeFacts.sources[0]?.kind, 'pulumi-docs');
  assert.equal(parsed.knowledgeFacts.sources[0]?.name, 'pulumi-docs:package:aws');
  assert.equal(parsed.knowledgeFacts.facts[0]?.path, 'pulumi.package.aws.s3');
  assert.equal(parsed.knowledgeFacts.facts[0]?.sourceLocator, 'Pulumi package docs: s3');
  assert.doesNotMatch(prompt, /"content"\s*:|contentHash|fetchedAt|staleAfter|url|# AWS|api-docs/);
});
