import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPlannerUserPrompt } from '../../src/model/prompt.ts';

const FULL_CONTENT_HASH = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const RAW_DOCS_MARKER = 'RAW UNIT INDEX DOCS MARKER';
const RAW_SOURCE_CONTENT = 'raw source content that belongs only in the cached document';

function publicStoragePolicy() {
  return {
    scope: 'public-reference',
    defaultStore: 'local-or-explicit-team-cache',
    shareableByDefault: true,
    requiresExplicitOptIn: false,
    reason: 'Source points at public provider, package, or chart documentation.'
  };
}

function buildPreflightFixture() {
  return {
    task: 'update api infrastructure from compact knowledge units',
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
    requestedDomains: ['terraform'],
    requestedEnvironment: null,
    requestedService: null,
    targetCandidates: [
      {
        kind: 'terraform-root',
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

function buildKnowledgePack() {
  const source = {
    id: 'compound-public-source',
    domain: 'terraform',
    targetPath: 'infra/api',
    kind: 'knowledge-unit-artifact',
    name: 'knowledge-unit-artifact:api-platform',
    provider: 'hashicorp/aws',
    packageName: '@pulumi/aws',
    chart: 'api-chart',
    version: '1.2.3',
    url: 'https://docs.example.test/api-platform',
    content: `# Raw Docs\n\n${RAW_DOCS_MARKER}: ${RAW_SOURCE_CONTENT}.`,
    factCount: 1,
    contentHash: FULL_CONTENT_HASH,
    fetchedAt: '2026-05-13T00:00:00.000Z',
    stale: false,
    freshness: 'fresh',
    storagePolicy: publicStoragePolicy()
  };
  const baseUnit = {
    confidence: 'high',
    sourceId: source.id,
    sourceLocator: 'api-platform',
    privacyScope: 'public-reference'
  };
  const units = [
    {
      ...baseUnit,
      unitType: 'fact',
      factKind: 'argument',
      path: 'provider.aws.region',
      summary: 'AWS provider region is required.',
      extractionMethod: 'terraform-registry-markdown',
      required: true,
      type: 'string'
    },
    {
      ...baseUnit,
      unitType: 'guidance',
      path: 'guidance.api.provider-region',
      summary: 'Keep provider region configuration explicit.',
      extractionMethod: 'official-guidance',
      topic: 'provider-region',
      appliesWhen: ['editing AWS provider configuration']
    },
    {
      ...baseUnit,
      unitType: 'example',
      path: 'example.api.bucket',
      summary: 'Bucket resource example.',
      extractionMethod: 'official-example',
      exampleType: 'resource-usage',
      snippet: 'resource "aws_s3_bucket" "api" {}',
      language: 'hcl'
    },
    {
      ...baseUnit,
      unitType: 'diagnostic',
      path: 'diagnostic.aws.region',
      summary: 'Missing provider region diagnostic.',
      extractionMethod: 'provider-diagnostic',
      engine: 'terraform',
      signature: 'missing region',
      likelyCause: 'Provider configuration is incomplete.',
      recommendedReview: ['Check provider region before planning.']
    },
    {
      ...baseUnit,
      unitType: 'recipe',
      path: 'recipe.api.review',
      summary: 'Review API infrastructure changes.',
      extractionMethod: 'workflow-recipe',
      name: 'API infrastructure review',
      steps: ['Inspect provider configuration.', 'Run a plan.'],
      mutationAllowed: false
    }
  ];

  return {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: 'unit-index-prompt-pack',
    workspaceRoot: '/workspace',
    cacheRoot: '/cache',
    requestedDomains: ['terraform'],
    targetPaths: ['infra/api'],
    sourceIds: [source.id],
    sourceCount: 1,
    factSetCount: 1,
    factCount: 1,
    includedFactCount: 1,
    omittedFactCount: 0,
    unitCount: units.length,
    includedUnitCount: units.length,
    omittedUnitCount: 0,
    maxFacts: units.length,
    maxUnits: units.length,
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
    sources: [source],
    facts: [
      {
        kind: 'argument',
        path: 'provider.aws.region',
        summary: 'AWS provider region is required.',
        confidence: 'high',
        extractionMethod: 'terraform-registry-markdown',
        sourceId: source.id,
        sourceLocator: 'api-platform',
        required: true,
        type: 'string'
      }
    ],
    units
  };
}

function buildRuntimeFixture() {
  return {
    task: 'update api infrastructure from compact knowledge units',
    preflight: buildPreflightFixture(),
    knowledgeFacts: buildKnowledgePack(),
    retrievedContextBudget: {
      maxPackets: 5,
      maxTokens: 1000,
      maxExcerptChars: 1200,
      maxFacts: 5
    },
    retrievedContext: [],
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    maxRepairAttempts: 2,
    lastEditPlan: null
  };
}

test('planner user prompt includes compact knowledge unit index without raw source payloads', () => {
  const prompt = buildPlannerUserPrompt(buildRuntimeFixture());
  const parsed = JSON.parse(prompt);
  const unitIndex = parsed.knowledgeFacts.unitIndex;
  const entry = unitIndex?.entries[0];

  assert.equal(unitIndex?.kind, 'infra-agent.knowledge-unit-index');
  assert.equal(unitIndex?.mutationAllowed, false);
  assert.equal(unitIndex?.sourceCount, 1);
  assert.equal(unitIndex?.includedUnitCount, 5);
  assert.equal(unitIndex?.omittedUnitCount, 0);

  assert.equal(entry?.sourceId, 'compound-public-source');
  assert.equal(entry?.sourceKind, 'knowledge-unit-artifact');
  assert.equal(entry?.sourceName, 'knowledge-unit-artifact:api-platform');
  assert.equal(entry?.provider, 'hashicorp/aws');
  assert.equal(entry?.packageName, '@pulumi/aws');
  assert.equal(entry?.chart, 'api-chart');
  assert.equal(entry?.version, '1.2.3');
  assert.equal(entry?.targetPath, 'infra/api');
  assert.deepEqual(entry?.unitCounts, {
    fact: 1,
    guidance: 1,
    example: 1,
    diagnostic: 1,
    recipe: 1
  });
  assert.ok(entry?.retrievalKeys.includes('provider:hashicorp/aws'));
  assert.ok(entry?.retrievalKeys.includes('packageName:@pulumi/aws'));
  assert.ok(entry?.retrievalKeys.includes('chart:api-chart'));
  assert.ok(entry?.retrievalKeys.includes('version:1.2.3'));
  assert.ok(entry?.retrievalKeys.includes('unitType:fact'));
  assert.ok(entry?.retrievalKeys.includes('unitType:guidance'));
  assert.ok(entry?.retrievalKeys.includes('unitType:example'));
  assert.ok(entry?.retrievalKeys.includes('unitType:diagnostic'));
  assert.ok(entry?.retrievalKeys.includes('unitType:recipe'));

  assert.ok(Array.isArray(parsed.knowledgeFacts.sources));
  assert.ok(Array.isArray(parsed.knowledgeFacts.units));
  assert.equal(parsed.knowledgeFacts.sources[0]?.id, 'compound-public-source');
  assert.equal(parsed.knowledgeFacts.units.length, 5);

  assert.doesNotMatch(prompt, /https:\/\//);
  assert.doesNotMatch(prompt, new RegExp(FULL_CONTENT_HASH));
  assert.doesNotMatch(prompt, /contentHash|sourceContentHash/);
  assert.doesNotMatch(prompt, new RegExp(`${RAW_DOCS_MARKER}|${RAW_SOURCE_CONTENT}`));
  assert.doesNotMatch(prompt, /"content"\s*:/);
});
