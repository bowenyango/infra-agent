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

function buildHelmPreflightFixture() {
  const fixture = buildPreflightFixture();
  fixture.task = 'update helm api chart image';
  fixture.requestedDomains = ['helm'];
  fixture.targetCandidates = [
    {
      kind: 'helm-chart',
      name: 'api',
      path: 'charts/api',
      score: 10,
      reasons: ['matched task'],
      matchedEnvironmentHints: [],
      details: []
    }
  ];
  return fixture;
}

function buildTerraformPreflightFixture() {
  const fixture = buildPreflightFixture();
  fixture.task = 'rename terraform api bucket resource safely';
  fixture.requestedDomains = ['terraform'];
  fixture.targetCandidates = [
    {
      kind: 'terraform-root',
      name: 'app',
      path: 'terraform/app',
      score: 10,
      reasons: ['matched task'],
      matchedEnvironmentHints: [],
      details: []
    }
  ];
  return fixture;
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

function buildHelmChartDocsKnowledgePack() {
  return {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: 'fedcba9876543210fedcba98',
    workspaceRoot: '/workspace',
    cacheRoot: '/workspace/.infra-agent/knowledge-cache',
    requestedDomains: ['helm'],
    targetPaths: ['charts/api'],
    sourceIds: ['chart-docs/api-home'],
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
        id: 'chart-docs/api-home',
        domain: 'helm',
        targetPath: 'charts/api',
        kind: 'chart-docs',
        name: 'api:home',
        factCount: 2,
        contentHash: 'b'.repeat(64),
        fetchedAt: '2026-05-06T00:00:00.000Z',
        staleAfter: '2026-06-05T00:00:00.000Z',
        stale: false,
        freshness: 'fresh',
        url: 'https://example.com/charts/api',
        content: '# API Chart\n\nRaw chart docs should not enter the planner prompt.',
        storagePolicy: {
          scope: 'public-reference',
          defaultStore: 'local-or-explicit-team-cache',
          shareableByDefault: true,
          requiresExplicitOptIn: false,
          reason: 'Helm chart docs are public reference material.'
        }
      }
    ],
    facts: [
      {
        kind: 'chart-value',
        path: 'chart.api.image.repository',
        summary: 'Container image repository.',
        confidence: 'medium',
        extractionMethod: 'helm-chart-docs-markdown',
        sourceId: 'chart-docs/api-home',
        sourceLocator: 'Chart docs: image.repository',
        type: 'string',
        values: ['image.repository']
      },
      {
        kind: 'chart-value',
        path: 'chart.api.service.port',
        summary: 'Service port exposed by the chart.',
        confidence: 'medium',
        extractionMethod: 'helm-chart-docs-markdown',
        sourceId: 'chart-docs/api-home',
        sourceLocator: 'Chart docs: service.port',
        type: 'integer',
        defaultValue: '80',
        values: ['service.port']
      }
    ]
  };
}

function buildPulumiComponentKnowledgePack() {
  return {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: '0123456789abcdef01234567',
    workspaceRoot: '/workspace',
    cacheRoot: '/workspace/.infra-agent/knowledge-cache',
    requestedDomains: ['pulumi'],
    targetPaths: ['infra/api'],
    sourceIds: ['pulumi-component/api-service'],
    sourceCount: 1,
    factSetCount: 1,
    factCount: 3,
    includedFactCount: 3,
    omittedFactCount: 0,
    maxFacts: 3,
    staleSourceCount: 0,
    storagePolicy: {
      publicReference: 0,
      workspacePrivate: 1,
      explicitOptInRequired: 1,
      shareableByDefault: 0,
      defaultStores: {
        'local-only': 1,
        'local-or-explicit-team-cache': 0
      }
    },
    sources: [
      {
        id: 'pulumi-component/api-service',
        domain: 'pulumi',
        targetPath: 'infra/api',
        kind: 'pulumi-component',
        name: 'pulumi-component:infra/api:ApiService',
        factCount: 3,
        contentHash: 'c'.repeat(64),
        fetchedAt: '1970-01-01T00:00:00.000Z',
        stale: false,
        freshness: 'fresh',
        fingerprintDigest: 'd'.repeat(64),
        fingerprintFileCount: 1,
        storagePolicy: {
          scope: 'workspace-private',
          defaultStore: 'local-only',
          shareableByDefault: false,
          requiresExplicitOptIn: true,
          reason: 'Pulumi component facts are workspace-local.'
        }
      }
    ],
    facts: [
      {
        kind: 'pulumi-component-input',
        path: 'component.ApiService.inputs.image',
        summary: 'component.ApiService.inputs.image is required by the Pulumi component interface.',
        confidence: 'high',
        extractionMethod: 'repo-local-static',
        sourceId: 'pulumi-component/api-service',
        sourceLocator: 'infra/api/components.ts:3: ApiService.image',
        required: true,
        type: 'string',
        values: ['image'],
        relatedPaths: ['infra/api/components.ts']
      },
      {
        kind: 'pulumi-component-child-resource',
        path: 'component.ApiService.childResources.assets',
        summary: 'component.ApiService.childResources.assets creates child Pulumi resource assets of type aws:s3/bucket:Bucket.',
        confidence: 'high',
        extractionMethod: 'repo-local-static',
        sourceId: 'pulumi-component/api-service',
        sourceLocator: 'infra/api/components.ts:10: ApiService.assets',
        type: 'aws:s3/bucket:Bucket',
        values: ['assets', 'aws:s3/bucket:Bucket'],
        relatedPaths: ['infra/api/components.ts']
      },
      {
        kind: 'pulumi-component-output',
        path: 'component.ApiService.outputs.endpoint',
        summary: 'component.ApiService.outputs.endpoint is exposed by the Pulumi component.',
        confidence: 'high',
        extractionMethod: 'repo-local-static',
        sourceId: 'pulumi-component/api-service',
        sourceLocator: 'infra/api/components.ts:6: ApiService.endpoint',
        type: 'string',
        values: ['endpoint'],
        relatedPaths: ['infra/api/components.ts']
      }
    ]
  };
}

function buildInternalCuratedKnowledgePack() {
  return {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: '111111111111111111111111',
    workspaceRoot: '/workspace',
    cacheRoot: '/workspace/.infra-agent/knowledge-cache',
    requestedDomains: ['terraform'],
    targetPaths: ['terraform/app'],
    sourceIds: ['internal/terraform-rename'],
    sourceCount: 1,
    factSetCount: 1,
    factCount: 0,
    includedFactCount: 0,
    omittedFactCount: 0,
    unitCount: 3,
    includedUnitCount: 3,
    omittedUnitCount: 0,
    maxFacts: 3,
    maxUnits: 3,
    staleSourceCount: 0,
    storagePolicy: {
      publicReference: 0,
      workspacePrivate: 1,
      explicitOptInRequired: 1,
      shareableByDefault: 0,
      defaultStores: {
        'local-only': 1,
        'local-or-explicit-team-cache': 0
      }
    },
    sources: [
      {
        id: 'internal/terraform-rename',
        domain: 'terraform',
        targetPath: 'terraform/app',
        kind: 'internal-knowledge',
        name: 'terraform-rename-internal',
        factCount: 0,
        contentHash: 'd'.repeat(64),
        fetchedAt: '1970-01-01T00:00:00.000Z',
        stale: false,
        freshness: 'fresh',
        fingerprintDigest: 'e'.repeat(64),
        fingerprintFileCount: 1,
        storagePolicy: {
          scope: 'workspace-private',
          defaultStore: 'local-only',
          shareableByDefault: false,
          requiresExplicitOptIn: true,
          reason: 'Internal curated units are workspace-local.'
        }
      }
    ],
    facts: [],
    units: [
      {
        unitType: 'guidance',
        path: 'guidance.terraform.logical-rename',
        summary: 'Use Terraform moved blocks when a resource logical name changes but the remote object should be retained.',
        confidence: 'high',
        extractionMethod: 'repo-local-guidance',
        sourceId: 'internal/terraform-rename',
        sourceLocator: 'guidance:guidance.terraform.logical-rename',
        privacyScope: 'internal-team',
        topic: 'terraform-logical-rename',
        appliesWhen: ['Terraform resource address rename'],
        risk: 'Without a moved block, a rename can look like destroy and create.'
      },
      {
        unitType: 'example',
        path: 'example.terraform.moved-block',
        summary: 'Minimal moved block for a Terraform resource rename.',
        confidence: 'medium',
        extractionMethod: 'repo-local-example',
        sourceId: 'internal/terraform-rename',
        sourceLocator: 'example:example.terraform.moved-block',
        privacyScope: 'internal-team',
        exampleType: 'terraform-moved-block',
        language: 'hcl',
        snippet: 'moved { from = aws_s3_bucket.old to = aws_s3_bucket.api }'
      },
      {
        unitType: 'recipe',
        path: 'recipe.terraform.safe-rename',
        summary: 'Review a Terraform logical rename before editing infrastructure.',
        confidence: 'medium',
        extractionMethod: 'workflow-recipe',
        sourceId: 'internal/terraform-rename',
        sourceLocator: 'recipe:recipe.terraform.safe-rename',
        privacyScope: 'internal-team',
        name: 'Terraform safe logical rename',
        steps: ['Add or verify a moved block.', 'Run a plan before apply.'],
        mutationAllowed: false
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
  assert.equal(parsed.knowledgeFacts.totalUnitCount, 2);
  assert.equal(parsed.knowledgeFacts.includedUnitCount, 1);
  assert.equal(parsed.knowledgeFacts.omittedUnitCount, 1);
  assert.equal(parsed.knowledgeFacts.sources[0]?.kind, 'pulumi-docs');
  assert.equal(parsed.knowledgeFacts.sources[0]?.name, 'pulumi-docs:package:aws');
  assert.equal(parsed.knowledgeFacts.facts[0]?.path, 'pulumi.package.aws.s3');
  assert.equal(parsed.knowledgeFacts.facts[0]?.sourceLocator, 'Pulumi package docs: s3');
  assert.equal(parsed.knowledgeFacts.units[0]?.unitType, 'fact');
  assert.equal(parsed.knowledgeFacts.units[0]?.factKind, 'pulumi-docs-guidance');
  assert.equal(parsed.knowledgeFacts.units[0]?.privacyScope, 'public-reference');
  assert.doesNotMatch(prompt, /"content"\s*:|contentHash|fetchedAt|staleAfter|url|# AWS|api-docs/);
});

test('planner user prompt includes budgeted Helm chart docs facts without raw docs', () => {
  const prompt = buildPlannerUserPrompt({
    task: 'update helm api chart image',
    preflight: buildHelmPreflightFixture(),
    knowledgeFacts: buildHelmChartDocsKnowledgePack(),
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
  assert.equal(parsed.knowledgeFacts.sources[0]?.kind, 'chart-docs');
  assert.equal(parsed.knowledgeFacts.sources[0]?.name, 'api:home');
  assert.equal(parsed.knowledgeFacts.facts[0]?.path, 'chart.api.image.repository');
  assert.equal(parsed.knowledgeFacts.facts[0]?.extractionMethod, 'helm-chart-docs-markdown');
  assert.equal(parsed.knowledgeFacts.facts[0]?.sourceLocator, 'Chart docs: image.repository');
  assert.deepEqual(parsed.knowledgeFacts.facts[0]?.values, ['image.repository']);
  assert.doesNotMatch(
    prompt,
    /"content"\s*:|contentHash|fetchedAt|staleAfter|url|# API Chart|https:\/\/example\.com\/charts\/api/
  );
});

test('planner user prompt includes budgeted Pulumi component facts without raw source', () => {
  const prompt = buildPlannerUserPrompt({
    task: 'update pulumi api component image',
    preflight: buildPreflightFixture(),
    knowledgeFacts: buildPulumiComponentKnowledgePack(),
    retrievedContextBudget: {
      maxPackets: 5,
      maxTokens: 1000,
      maxExcerptChars: 1200,
      maxFacts: 2
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
  assert.equal(parsed.knowledgeFacts.maxFacts, 2);
  assert.equal(parsed.knowledgeFacts.includedFactCount, 2);
  assert.equal(parsed.knowledgeFacts.omittedFactCount, 1);
  assert.equal(parsed.knowledgeFacts.sources[0]?.kind, 'pulumi-component');
  assert.equal(parsed.knowledgeFacts.sources[0]?.name, 'pulumi-component:infra/api:ApiService');
  assert.equal(parsed.knowledgeFacts.sources[0]?.fingerprintFileCount, 1);
  assert.equal(parsed.knowledgeFacts.facts[0]?.kind, 'pulumi-component-input');
  assert.equal(parsed.knowledgeFacts.facts[0]?.path, 'component.ApiService.inputs.image');
  assert.equal(parsed.knowledgeFacts.facts[0]?.sourceLocator, 'infra/api/components.ts:3: ApiService.image');
  assert.equal(parsed.knowledgeFacts.facts[1]?.kind, 'pulumi-component-child-resource');
  assert.equal(parsed.knowledgeFacts.facts[1]?.path, 'component.ApiService.childResources.assets');
  assert.equal(parsed.knowledgeFacts.facts[1]?.type, 'aws:s3/bucket:Bucket');
  assert.doesNotMatch(prompt, /"content"\s*:|contentHash|fetchedAt|class ApiService|super\(|@pulumi\/pulumi|@pulumi\/aws|bucket:\s*args\.image/);
});

test('planner user prompt prioritizes internal curated guidance units without raw examples', () => {
  const prompt = buildPlannerUserPrompt({
    task: 'rename terraform api bucket resource safely',
    preflight: buildTerraformPreflightFixture(),
    knowledgeFacts: buildInternalCuratedKnowledgePack(),
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

  assert.equal(parsed.knowledgeFacts.totalFactCount, 0);
  assert.equal(parsed.knowledgeFacts.includedFactCount, 0);
  assert.equal(parsed.knowledgeFacts.totalUnitCount, 3);
  assert.equal(parsed.knowledgeFacts.includedUnitCount, 1);
  assert.equal(parsed.knowledgeFacts.omittedUnitCount, 2);
  assert.equal(parsed.knowledgeFacts.sources[0]?.kind, 'internal-knowledge');
  assert.equal(parsed.knowledgeFacts.sources[0]?.fingerprintFileCount, 1);
  assert.equal(parsed.knowledgeFacts.units[0]?.unitType, 'guidance');
  assert.equal(parsed.knowledgeFacts.units[0]?.topic, 'terraform-logical-rename');
  assert.equal(parsed.knowledgeFacts.units[0]?.privacyScope, 'internal-team');
  assert.doesNotMatch(prompt, /"content"\s*:|contentHash|fetchedAt|moved \{ from = aws_s3_bucket\.old/);
});
