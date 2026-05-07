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
