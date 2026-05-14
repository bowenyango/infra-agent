import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveConfigSemanticsFromKnowledgeUnits,
  getRuntimeConfigSemantics,
  refreshRuntimeConfigSemantics
} from '../../src/agent/config-semantics-state.ts';

function source(overrides = {}) {
  return {
    id: 'source-1',
    domain: 'helm',
    targetPath: 'charts/payments-api',
    kind: 'chart-docs',
    name: 'payments-api docs',
    version: '1.0.0',
    url: 'https://example.test/raw/chart-docs',
    factCount: 1,
    contentHash: 'sha256:raw-content-hash',
    fetchedAt: null,
    stale: false,
    freshness: 'unchecked',
    storagePolicy: 'public-reference',
    ...overrides
  };
}

function factUnit(overrides = {}) {
  return {
    unitType: 'fact',
    factKind: 'chart-value',
    path: 'values.ingress.className',
    summary: 'Ingress className is constrained by chart docs.',
    confidence: 'high',
    extractionMethod: 'helm-chart-docs-markdown',
    sourceId: 'source-1',
    sourceLocator: 'Chart docs: ingress.className',
    privacyScope: 'public-reference',
    ...overrides
  };
}

function knowledgePack(overrides = {}) {
  return {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: '1234567890abcdef12345678',
    workspaceRoot: '/workspace',
    cacheRoot: '/cache',
    requestedDomains: ['helm'],
    targetPaths: ['charts/payments-api'],
    sourceIds: ['source-1'],
    sourceCount: 1,
    factSetCount: 1,
    factCount: 1,
    includedFactCount: 1,
    omittedFactCount: 0,
    unitCount: 1,
    includedUnitCount: 1,
    omittedUnitCount: 0,
    maxFacts: 10,
    maxUnits: 10,
    staleSourceCount: 0,
    storagePolicy: {
      publicReferenceCount: 1,
      internalTeamCount: 0,
      privateWorkspaceCount: 0,
      restrictedSecretCount: 0
    },
    sources: [source()],
    facts: [],
    units: [factUnit()],
    ...overrides
  };
}

function runtime(overrides = {}) {
  return {
    task: 'update config',
    preflight: {
      inspection: {
        configSemantics: []
      },
      validation: {
        plan: []
      }
    },
    retrievedContext: [],
    knowledgeFacts: null,
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null,
    ...overrides
  };
}

test('derives Helm config semantics from compact values fact units without raw source leakage', () => {
  const semantics = deriveConfigSemanticsFromKnowledgeUnits(runtime({
    knowledgeFacts: knowledgePack({
      sources: [
        source({
          url: 'https://example.test/raw/values.schema.json',
          contentHash: 'sha256:do-not-leak'
        })
      ],
      units: [
        factUnit({
          values: ['alb', 'nginx'],
          relatedPaths: ['values.ingress.enabled']
        }),
        factUnit({
          path: 'chart.payments-api.image.repository',
          summary: 'Image repository must be a string.',
          type: 'string',
          sourceLocator: 'Chart docs: image.repository'
        })
      ]
    })
  }));

  assert.equal(semantics.length, 1);
  assert.equal(semantics[0]?.targetKind, 'helm-chart');
  assert.equal(semantics[0]?.targetPath, 'charts/payments-api');
  assert.deepEqual(
    semantics[0]?.facts.map(fact => [fact.kind, fact.path, fact.values]),
    [
      ['enum', 'ingress.className', ['alb', 'nginx']],
      ['type-constraint', 'image.repository', ['string']]
    ]
  );
  assert.equal(semantics[0]?.facts[0]?.source.kind, 'knowledge-unit');
  assert.equal(semantics[0]?.facts[0]?.source.path, 'Chart docs: ingress.className');
  assert.deepEqual(semantics[0]?.facts[0]?.relatedPaths, ['values.ingress.enabled']);

  const serialized = JSON.stringify(semantics);
  assert.doesNotMatch(serialized, /https:\/\/example\.test|raw\/values|do-not-leak|contentHash|url/);
});

test('derives Pulumi config semantics from compact config fact units and preserves config path shape', () => {
  const semantics = deriveConfigSemanticsFromKnowledgeUnits(runtime({
    knowledgeFacts: knowledgePack({
      requestedDomains: ['pulumi'],
      targetPaths: ['infra/payments-api'],
      sources: [
        source({
          id: 'pulumi-source',
          domain: 'pulumi',
          targetPath: 'infra/payments-api',
          kind: 'pulumi-docs',
          name: 'pulumi docs',
          url: 'https://example.test/raw/pulumi-docs'
        })
      ],
      units: [
        factUnit({
          factKind: 'pulumi-config-parameter',
          path: 'config.payments-api:imageTag',
          summary: 'imageTag is required.',
          sourceId: 'pulumi-source',
          sourceLocator: 'Pulumi docs: imageTag',
          required: true
        }),
        factUnit({
          factKind: 'pulumi-config-parameter',
          path: 'pulumi.config.payments-api:environment',
          summary: 'environment must be an approved value.',
          sourceId: 'pulumi-source',
          sourceLocator: 'Pulumi docs: environment',
          values: ['dev', 'stage', 'prod']
        })
      ]
    })
  }));

  assert.equal(semantics.length, 1);
  assert.equal(semantics[0]?.targetKind, 'pulumi-project');
  assert.equal(semantics[0]?.targetPath, 'infra/payments-api');
  assert.deepEqual(
    semantics[0]?.facts.map(fact => [fact.kind, fact.path, fact.values]),
    [
      ['required-field', 'config.payments-api:imageTag', undefined],
      ['enum', 'config.payments-api:environment', ['dev', 'stage', 'prod']]
    ]
  );

  const serialized = JSON.stringify(semantics);
  assert.doesNotMatch(serialized, /https:\/\/example\.test|raw\/pulumi|url/);
});

test('skips fact units whose sourceId does not resolve to a known source', () => {
  const semantics = deriveConfigSemanticsFromKnowledgeUnits(runtime({
    knowledgeFacts: knowledgePack({
      units: [
        factUnit({
          sourceId: 'missing-source',
          values: ['alb', 'nginx']
        })
      ]
    })
  }));

  assert.deepEqual(semantics, []);
});

test('skips fact units whose source targetPath is outside pack targetPaths', () => {
  const semantics = deriveConfigSemanticsFromKnowledgeUnits(runtime({
    knowledgeFacts: knowledgePack({
      targetPaths: ['charts/other-service'],
      sources: [
        source({
          targetPath: 'charts/payments-api'
        })
      ],
      units: [
        factUnit({
          values: ['alb', 'nginx']
        })
      ]
    })
  }));

  assert.deepEqual(semantics, []);
});

test('skips fact units whose config path domain conflicts with the source domain', () => {
  const semantics = deriveConfigSemanticsFromKnowledgeUnits(runtime({
    knowledgeFacts: knowledgePack({
      requestedDomains: ['helm', 'pulumi'],
      targetPaths: ['charts/payments-api', 'infra/payments-api'],
      sources: [
        source({
          id: 'helm-source',
          domain: 'helm',
          targetPath: 'charts/payments-api'
        }),
        source({
          id: 'pulumi-source',
          domain: 'pulumi',
          targetPath: 'infra/payments-api',
          kind: 'pulumi-docs'
        })
      ],
      units: [
        factUnit({
          sourceId: 'helm-source',
          path: 'config.payments-api:imageTag',
          required: true
        }),
        factUnit({
          sourceId: 'pulumi-source',
          path: 'values.ingress.className',
          values: ['alb', 'nginx']
        })
      ]
    })
  }));

  assert.deepEqual(semantics, []);
});

test('skips non-fact and ambiguous knowledge units, and refresh merges without duplicates', () => {
  const sourceCommand = 'pulumi preview --cwd infra/payments-api --stack dev';
  const baseRuntime = runtime({
    preflight: {
      inspection: {
        configSemantics: [
          {
            targetKind: 'pulumi-project',
            targetPath: 'infra/payments-api',
            facts: [
              {
                kind: 'configured-field',
                path: 'config.payments-api:replicas',
                message: 'replicas is configured.',
                source: {
                  kind: 'pulumi-config',
                  path: 'infra/payments-api/Pulumi.dev.yaml'
                },
                confidence: 'high'
              }
            ]
          }
        ]
      },
      validation: {
        plan: [
          {
            kind: 'pulumi',
            target: 'infra/payments-api',
            commands: [sourceCommand]
          }
        ]
      }
    },
    knowledgeFacts: knowledgePack({
      requestedDomains: ['pulumi'],
      targetPaths: ['infra/payments-api'],
      sources: [
        source({
          id: 'pulumi-source',
          domain: 'pulumi',
          targetPath: 'infra/payments-api',
          kind: 'pulumi-docs'
        })
      ],
      units: [
        factUnit({
          factKind: 'pulumi-config-parameter',
          path: 'pulumi.config.payments-api:environment',
          summary: 'environment is a string.',
          sourceId: 'pulumi-source',
          sourceLocator: 'Pulumi docs: environment',
          type: 'string'
        }),
        factUnit({
          factKind: 'pulumi-config-parameter',
          path: 'pulumi.config.payments-api:ambiguous',
          summary: 'This has no safe semantic signal.',
          sourceId: 'pulumi-source',
          sourceLocator: 'Pulumi docs: ambiguous'
        }),
        {
          unitType: 'example',
          path: 'config.payments-api:imageTag',
          summary: 'Example should not become config semantics.',
          confidence: 'high',
          extractionMethod: 'official-example',
          sourceId: 'pulumi-source',
          sourceLocator: 'Pulumi docs: example',
          privacyScope: 'public-reference',
          exampleType: 'pulumi-config',
          snippet: 'config:'
        },
        {
          unitType: 'guidance',
          path: 'config.payments-api:region',
          summary: 'Guidance should not become config semantics.',
          confidence: 'high',
          extractionMethod: 'official-guidance',
          sourceId: 'pulumi-source',
          sourceLocator: 'Pulumi docs: guidance',
          privacyScope: 'public-reference',
          topic: 'region'
        }
      ]
    }),
    validationIssues: [
      {
        kind: 'pulumi-missing-config',
        repairable: true,
        sourceCommand,
        message: 'missing required configuration variable "payments-api:imageTag"',
        metadata: {
          missingConfigKey: 'payments-api:imageTag'
        }
      }
    ]
  });

  const first = refreshRuntimeConfigSemantics(baseRuntime);
  const second = refreshRuntimeConfigSemantics({
    ...baseRuntime,
    configSemantics: first
  });
  const facts = second.find(summary =>
    summary.targetKind === 'pulumi-project'
    && summary.targetPath === 'infra/payments-api'
  )?.facts ?? [];

  assert.ok(facts.some(fact => fact.kind === 'configured-field' && fact.path === 'config.payments-api:replicas'));
  assert.ok(facts.some(fact => fact.kind === 'type-constraint' && fact.path === 'config.payments-api:environment'));
  assert.ok(facts.some(fact => fact.kind === 'required-field' && fact.path === 'config.payments-api:imageTag'));
  assert.equal(facts.some(fact => fact.path === 'config.payments-api:ambiguous'), false);
  assert.equal(facts.filter(fact => fact.source.kind === 'knowledge-unit').length, 1);
  assert.equal(first.reduce((count, summary) => count + summary.facts.length, 0), second.reduce((count, summary) => count + summary.facts.length, 0));

  const fromGetter = getRuntimeConfigSemantics({
    ...baseRuntime,
    validationIssues: []
  });
  assert.ok(fromGetter.some(summary =>
    summary.targetPath === 'infra/payments-api'
    && summary.facts.some(fact => fact.source.kind === 'knowledge-unit')
  ));
});
