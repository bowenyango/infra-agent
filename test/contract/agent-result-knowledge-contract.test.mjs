import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCompactAgentRunResult } from '../../src/cli/agent-result-contract.ts';
import { buildAgentResultContractFixtures } from '../support/agent-result-contract-fixtures.mjs';

test('compact agent result contract rejects knowledge context and cache drift', () => {
  const {
    validResult,
    validSafetyBlocker,
    validUnsafeSafetyBlocker,
    resultWithSafetyBlockers,
    resultWithToolEntries,
    twoToolEntries
  } = buildAgentResultContractFixtures();
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: null
    }),
    /knowledgeContext object/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        maxPackets: 0
      }
    }),
    /knowledgeContext\.maxPackets/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        totalPacketCount: 3
      }
    }),
    /knowledgeContext packet counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        omittedByTokenBudget: 0
      }
    }),
    /knowledgeContext omitted counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        totalPacketCount: 3,
        includedPacketCount: 3,
        omittedPacketCount: 0,
        omittedByTokenBudget: 0
      }
    }),
    /knowledgeContext\.includedPacketCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        totalPacketCount: 3,
        omittedPacketCount: 2,
        omittedByPacketLimit: 1
      }
    }),
    /knowledgeContext\.packets length/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        packets: [
          {
            ...validResult.knowledgeContext.packets[0],
            confidence: 'certain'
          },
          validResult.knowledgeContext.packets[1]
        ]
      }
    }),
    /knowledgeContext\.packets\[0\]\.confidence/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        packets: [
          {
            ...validResult.knowledgeContext.packets[0],
            excerptChars: 301
          },
          validResult.knowledgeContext.packets[1]
        ]
      }
    }),
    /knowledgeContext\.packets\[0\]\.excerptChars/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        packets: [
          {
            ...validResult.knowledgeContext.packets[0],
            omittedReason: 'token-budget'
          },
          validResult.knowledgeContext.packets[1]
        ]
      }
    }),
    /knowledgeContext\.packets\[0\]\.omittedReason/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        packets: [
          validResult.knowledgeContext.packets[0],
          {
            ...validResult.knowledgeContext.packets[1],
            omittedReason: null
          }
        ]
      }
    }),
    /knowledgeContext\.packets\[1\]\.omittedReason/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        packets: [
          {
            ...validResult.knowledgeContext.packets[0],
            excerpt: 'raw context should not be in the summary'
          },
          validResult.knowledgeContext.packets[1]
        ]
      }
    }),
    /knowledgeContext\.packets\[0\].*raw context/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeContext: {
        ...validResult.knowledgeContext,
        includedTokenEstimate: 41
      }
    }),
    /knowledgeContext\.includedTokenEstimate/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: null
    }),
    /knowledgeFacts object/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        kind: 'infra-agent.knowledge-pack'
      }
    }),
    /knowledgeFacts\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        mutationAllowed: true
      }
    }),
    /knowledgeFacts\.mutationAllowed/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        totalFactCount: 3
      }
    }),
    /knowledgeFacts fact counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        includedFactCount: 3
      }
    }),
    /knowledgeFacts fact counts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        includedFactCount: 9,
        omittedFactCount: 0,
        totalFactCount: 9,
        sources: [
          {
            ...validResult.knowledgeFacts.sources[0],
            factCount: 9
          }
        ],
        facts: validResult.knowledgeFacts.facts
      }
    }),
    /knowledgeFacts\.includedFactCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        packId: 'not-a-pack-id'
      }
    }),
    /knowledgeFacts\.packId/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        sources: [
          {
            ...validResult.knowledgeFacts.sources[0],
            kind: 'blog-post'
          }
        ]
      }
    }),
    /knowledgeFacts\.sources\[0\]\.kind/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        sources: [
          {
            ...validResult.knowledgeFacts.sources[0],
            freshness: 'unknown'
          }
        ]
      }
    }),
    /knowledgeFacts\.sources\[0\]\.freshness/
  );
  assert.equal(parseCompactAgentRunResult({
    ...validResult,
    knowledgeFacts: {
      ...validResult.knowledgeFacts,
      uncheckedSourceCount: 1,
      sources: [
        {
          ...validResult.knowledgeFacts.sources[0],
          freshness: 'unchecked'
        }
      ]
    }
  }).knowledgeFacts.uncheckedSourceCount, 1);
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        uncheckedSourceCount: 1
      }
    }),
    /knowledgeFacts\.uncheckedSourceCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        sources: [
          {
            ...validResult.knowledgeFacts.sources[0],
            fingerprintDigest: 'not-a-sha',
            fingerprintFileCount: 1
          }
        ]
      }
    }),
    /knowledgeFacts\.sources\[0\]\.fingerprintDigest/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        staleSourceCount: 1,
        sources: [
          {
            ...validResult.knowledgeFacts.sources[0],
            stale: true,
            staleReason: 'local-file-hash-mismatch',
            freshness: 'stale'
          }
        ]
      }
    }),
    /knowledgeFacts\.facts\[0\]\.confidence/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        facts: [
          {
            ...validResult.knowledgeFacts.facts[0],
            sourceId: 'missing-source'
          },
          validResult.knowledgeFacts.facts[1]
        ]
      }
    }),
    /knowledgeFacts\.facts\[0\]\.sourceId/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        facts: [
          {
            ...validResult.knowledgeFacts.facts[0],
            extractionMethod: 'manual-copy'
          },
          validResult.knowledgeFacts.facts[1]
        ]
      }
    }),
    /knowledgeFacts\.facts\[0\]\.extractionMethod/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeFacts: {
        ...validResult.knowledgeFacts,
        facts: [
          {
            ...validResult.knowledgeFacts.facts[0],
            source: {
              contentHash: 'raw-hash'
            }
          },
          validResult.knowledgeFacts.facts[1]
        ]
      }
    }),
    /knowledgeFacts\.facts\[0\]\.source/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      handoffCheckpoint: {
        ...validResult.handoffCheckpoint,
        budgets: {
          ...validResult.handoffCheckpoint.budgets,
          knowledgeFacts: {
            includedCount: 1,
            omittedCount: 0
          }
        }
      }
    }),
    /handoffCheckpoint\.budgets\.knowledgeFacts/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      harness: {
        ...validResult.harness,
        stateSummary: {
          ...validResult.harness.stateSummary,
          knowledgeFactCount: 1
        }
      }
    }),
    /harness\.stateSummary\.knowledgeFactCount/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeCache: null
    }),
    /knowledgeCache object/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeCache: {
        ...validResult.knowledgeCache,
        root: ''
      }
    }),
    /knowledgeCache\.root/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...validResult,
      knowledgeCache: {
        ...validResult.knowledgeCache,
        source: 'unknown'
      }
    }),
    /knowledgeCache\.source/
  );
});

test('compact agent result contract accepts Pulumi resource docs facts without raw source fields', () => {
  const { validResult } = buildAgentResultContractFixtures();
  const resourceKnowledgeFacts = {
    ...validResult.knowledgeFacts,
    packId: 'abcdefabcdefabcdefabcdef',
    sourceCount: 1,
    factSetCount: 1,
    totalFactCount: 2,
    includedFactCount: 2,
    omittedFactCount: 0,
    staleSourceCount: 0,
    sources: [
      {
        id: 'pulumi-docs/aws-s3-bucket',
        domain: 'pulumi',
        targetPath: 'infra/api',
        kind: 'pulumi-docs',
        name: 'pulumi-docs:resource:aws:s3/bucket',
        factCount: 2,
        stale: false,
        freshness: 'fresh'
      }
    ],
    facts: [
      {
        kind: 'argument',
        path: 'pulumi.resource.aws.s3.bucket.Bucket.bucket',
        summary: 'Name of the bucket to create.',
        confidence: 'medium',
        extractionMethod: 'pulumi-docs-markdown',
        sourceId: 'pulumi-docs/aws-s3-bucket',
        sourceLocator: 'Pulumi resource docs: bucket',
        type: 'string'
      },
      {
        kind: 'argument',
        path: 'pulumi.resource.aws.s3.bucket.Bucket.acl',
        summary: 'Canned ACL to apply to the bucket.',
        confidence: 'medium',
        extractionMethod: 'pulumi-docs-markdown',
        sourceId: 'pulumi-docs/aws-s3-bucket',
        sourceLocator: 'Pulumi resource docs: acl',
        type: 'string'
      }
    ]
  };
  const result = {
    ...validResult,
    knowledgeFacts: resourceKnowledgeFacts,
    handoffCheckpoint: {
      ...validResult.handoffCheckpoint,
      budgets: {
        ...validResult.handoffCheckpoint.budgets,
        knowledgeFacts: {
          includedCount: 2,
          omittedCount: 0
        }
      }
    },
    harness: {
      ...validResult.harness,
      stateSummary: {
        ...validResult.harness.stateSummary,
        knowledgeFactCount: 2
      }
    }
  };

  assert.equal(parseCompactAgentRunResult(result).kind, 'infra-agent.agent-result');
  assert.throws(
    () => parseCompactAgentRunResult({
      ...result,
      knowledgeFacts: {
        ...resourceKnowledgeFacts,
        sources: [
          {
            ...resourceKnowledgeFacts.sources[0],
            url: 'https://www.pulumi.com/registry/packages/aws/api-docs/s3/bucket/'
          }
        ]
      }
    }),
    /knowledgeFacts\.sources\[0\]\.url.*raw source fields/
  );
});

test('compact agent result contract accepts Pulumi package docs facts without raw source fields', () => {
  const { validResult } = buildAgentResultContractFixtures();
  const packageKnowledgeFacts = {
    ...validResult.knowledgeFacts,
    packId: '1234567890abcdef12345678',
    sourceCount: 1,
    factSetCount: 1,
    totalFactCount: 2,
    includedFactCount: 2,
    omittedFactCount: 0,
    staleSourceCount: 0,
    sources: [
      {
        id: 'pulumi-docs/aws-package',
        domain: 'pulumi',
        targetPath: 'infra/api',
        kind: 'pulumi-docs',
        name: 'pulumi-docs:package:aws',
        factCount: 2,
        stale: false,
        freshness: 'fresh'
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
  const result = {
    ...validResult,
    knowledgeFacts: packageKnowledgeFacts,
    handoffCheckpoint: {
      ...validResult.handoffCheckpoint,
      budgets: {
        ...validResult.handoffCheckpoint.budgets,
        knowledgeFacts: {
          includedCount: 2,
          omittedCount: 0
        }
      }
    },
    harness: {
      ...validResult.harness,
      stateSummary: {
        ...validResult.harness.stateSummary,
        knowledgeFactCount: 2
      }
    }
  };

  assert.equal(parseCompactAgentRunResult(result).kind, 'infra-agent.agent-result');
  assert.throws(
    () => parseCompactAgentRunResult({
      ...result,
      knowledgeFacts: {
        ...packageKnowledgeFacts,
        sources: [
          {
            ...packageKnowledgeFacts.sources[0],
            url: 'https://www.pulumi.com/registry/packages/aws/api-docs/'
          }
        ]
      }
    }),
    /knowledgeFacts\.sources\[0\]\.url.*raw source fields/
  );
});

test('compact agent result contract accepts Pulumi component facts without raw source fields', () => {
  const { validResult } = buildAgentResultContractFixtures();
  const componentKnowledgeFacts = {
    ...validResult.knowledgeFacts,
    packId: '0123456789abcdef01234567',
    sourceCount: 1,
    factSetCount: 1,
    totalFactCount: 2,
    includedFactCount: 2,
    omittedFactCount: 0,
    staleSourceCount: 0,
    sources: [
      {
        id: 'pulumi-component/api-service',
        domain: 'pulumi',
        targetPath: 'infra/api',
        kind: 'pulumi-component',
        name: 'pulumi-component:infra/api:ApiService',
        factCount: 2,
        stale: false,
        freshness: 'fresh',
        fingerprintDigest: 'a'.repeat(64),
        fingerprintFileCount: 1
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
  const result = {
    ...validResult,
    knowledgeFacts: componentKnowledgeFacts,
    handoffCheckpoint: {
      ...validResult.handoffCheckpoint,
      budgets: {
        ...validResult.handoffCheckpoint.budgets,
        knowledgeFacts: {
          includedCount: 2,
          omittedCount: 0
        }
      }
    },
    harness: {
      ...validResult.harness,
      stateSummary: {
        ...validResult.harness.stateSummary,
        knowledgeFactCount: 2
      }
    }
  };

  assert.equal(parseCompactAgentRunResult(result).kind, 'infra-agent.agent-result');
  assert.throws(
    () => parseCompactAgentRunResult({
      ...result,
      knowledgeFacts: {
        ...componentKnowledgeFacts,
        sources: [
          {
            ...componentKnowledgeFacts.sources[0],
            contentHash: 'b'.repeat(64)
          }
        ]
      }
    }),
    /knowledgeFacts\.sources\[0\]\.contentHash.*raw source fields/
  );
});

test('compact agent result contract accepts Helm chart docs facts without raw source fields', () => {
  const { validResult } = buildAgentResultContractFixtures();
  const chartDocsKnowledgeFacts = {
    ...validResult.knowledgeFacts,
    packId: 'fedcba9876543210fedcba98',
    sourceCount: 1,
    factSetCount: 1,
    totalFactCount: 2,
    includedFactCount: 2,
    omittedFactCount: 0,
    staleSourceCount: 0,
    sources: [
      {
        id: 'chart-docs/api-home',
        domain: 'helm',
        targetPath: 'charts/api',
        kind: 'chart-docs',
        name: 'api:home',
        factCount: 2,
        stale: false,
        freshness: 'fresh'
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
  const result = {
    ...validResult,
    knowledgeFacts: chartDocsKnowledgeFacts,
    handoffCheckpoint: {
      ...validResult.handoffCheckpoint,
      budgets: {
        ...validResult.handoffCheckpoint.budgets,
        knowledgeFacts: {
          includedCount: 2,
          omittedCount: 0
        }
      }
    },
    harness: {
      ...validResult.harness,
      stateSummary: {
        ...validResult.harness.stateSummary,
        knowledgeFactCount: 2
      }
    }
  };

  assert.equal(parseCompactAgentRunResult(result).kind, 'infra-agent.agent-result');
  assert.throws(
    () => parseCompactAgentRunResult({
      ...result,
      knowledgeFacts: {
        ...chartDocsKnowledgeFacts,
        sources: [
          {
            ...chartDocsKnowledgeFacts.sources[0],
            url: 'https://example.com/charts/api'
          }
        ]
      }
    }),
    /knowledgeFacts\.sources\[0\]\.url.*raw source fields/
  );
  assert.throws(
    () => parseCompactAgentRunResult({
      ...result,
      knowledgeFacts: {
        ...chartDocsKnowledgeFacts,
        facts: [
          {
            ...chartDocsKnowledgeFacts.facts[0],
            confidence: 'high'
          },
          chartDocsKnowledgeFacts.facts[1]
        ]
      }
    }),
    /knowledgeFacts\.facts\[0\]\.confidence.*helm-chart-docs-markdown/
  );
});
