import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKnowledgeCacheId } from '../../src/knowledge/cache.ts';
import {
  knowledgeFactToFactUnit,
  parseKnowledgeUnitSet
} from '../../src/knowledge/knowledge-unit-contract.ts';
import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';
import { KNOWLEDGE_UNIT_TYPES } from '../../src/types/knowledge.ts';

function sourceFixture() {
  return {
    kind: 'terraform-registry',
    name: 'resource:aws_s3_bucket',
    provider: 'hashicorp/aws',
    version: '5.37.0',
    url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket'
  };
}

function unitSetFixture() {
  const source = sourceFixture();
  const sourceId = buildKnowledgeCacheId(source);
  const sourceContentHash = 'a'.repeat(64);
  const sourceRef = {
    id: sourceId,
    source,
    contentHash: sourceContentHash,
    locator: 'Terraform Registry: aws_s3_bucket'
  };
  const base = {
    path: 'resource.aws_s3_bucket.bucket',
    confidence: 'high',
    extractionMethod: 'terraform-registry-markdown',
    source: sourceRef,
    privacyScope: 'public-reference'
  };

  return {
    kind: 'infra-agent.knowledge-units',
    schemaVersion: 1,
    mutationAllowed: false,
    sourceId,
    source,
    sourceContentHash,
    extractedAt: '2026-05-11T00:00:00.000Z',
    unitCount: 5,
    units: [
      {
        ...base,
        unitType: 'fact',
        factKind: 'identity-field',
        summary: 'The bucket field participates in provider identity.',
        values: ['bucket'],
        type: 'string'
      },
      {
        ...base,
        unitType: 'guidance',
        path: 'guidance.terraform.resource-rename',
        topic: 'terraform-resource-rename',
        summary: 'Use moved blocks when the Terraform address changes but provider identity should be preserved.',
        appliesWhen: ['resource address changes', 'provider identity is unchanged'],
        avoidWhen: ['physical object should be recreated'],
        risk: 'Missing moved blocks can cause delete/create replacement.'
      },
      {
        ...base,
        unitType: 'example',
        path: 'example.terraform.s3-bucket.minimal',
        summary: 'Minimal public-reference Terraform bucket example.',
        confidence: 'medium',
        exampleType: 'terraform-resource-snippet',
        language: 'hcl',
        snippet: 'resource "aws_s3_bucket" "logs" {\n  bucket = "example-logs"\n}'
      },
      {
        ...base,
        unitType: 'diagnostic',
        path: 'diagnostic.terraform.bucket-already-exists',
        summary: 'S3 bucket duplicate identity diagnostic.',
        confidence: 'medium',
        engine: 'terraform',
        signature: 'BucketAlreadyExists',
        likelyCause: 'The physical bucket name already exists outside this state.',
        recommendedReview: ['check whether this is a logical rename', 'review import or moved block before mutation']
      },
      {
        ...base,
        unitType: 'recipe',
        path: 'recipe.terraform.safe-resource-rename',
        summary: 'Review workflow for a Terraform resource rename.',
        name: 'safe-terraform-resource-rename',
        steps: ['compare old and new addresses', 'check provider identity fields', 'propose moved block only after review'],
        requiresApproval: true,
        mutationAllowed: false
      }
    ]
  };
}

test('knowledge unit constants pin the infra RAG taxonomy', () => {
  assert.deepEqual(KNOWLEDGE_UNIT_TYPES, [
    'fact',
    'guidance',
    'example',
    'diagnostic',
    'recipe'
  ]);
});

test('knowledge unit contract accepts all five unit types', () => {
  const parsed = parseKnowledgeUnitSet(unitSetFixture());

  assert.equal(parsed.kind, 'infra-agent.knowledge-units');
  assert.equal(parsed.mutationAllowed, false);
  assert.equal(parsed.unitCount, 5);
  assert.deepEqual(parsed.units.map(unit => unit.unitType), [
    'fact',
    'guidance',
    'example',
    'diagnostic',
    'recipe'
  ]);
});

test('knowledge unit contract rejects unsupported or leaky units', () => {
  const valid = unitSetFixture();

  assert.throws(
    () => parseKnowledgeUnitSet({
      ...valid,
      mutationAllowed: true
    }),
    /mutationAllowed/
  );
  assert.throws(
    () => parseKnowledgeUnitSet({
      ...valid,
      unitCount: 4
    }),
    /unitCount/
  );
  assert.throws(
    () => parseKnowledgeUnitSet({
      ...valid,
      units: [
        {
          ...valid.units[0],
          unitType: 'vector'
        }
      ],
      unitCount: 1
    }),
    /unitType/
  );
  assert.throws(
    () => parseKnowledgeUnitSet({
      ...valid,
      units: [
        {
          ...valid.units[0],
          summary: 'contains api token material'
        }
      ],
      unitCount: 1
    }),
    /secret-like/
  );
  assert.throws(
    () => parseKnowledgeUnitSet({
      ...valid,
      sourceId: 'wrong-source-id'
    }),
    /sourceId/
  );
  assert.throws(
    () => parseKnowledgeUnitSet({
      ...valid,
      units: [
        {
          ...valid.units[0],
          source: {
            ...valid.units[0].source,
            contentHash: 'b'.repeat(64)
          }
        }
      ],
      unitCount: 1
    }),
    /contentHash/
  );
  assert.throws(
    () => parseKnowledgeUnitSet({
      ...valid,
      source: {
        ...valid.source,
        url: `${valid.source.url}?ref=current`
      }
    }),
    /URL/
  );
  assert.throws(
    () => parseKnowledgeUnitSet({
      ...valid,
      units: [
        {
          ...valid.units[4],
          mutationAllowed: undefined
        }
      ],
      unitCount: 1
    }),
    /mutationAllowed/
  );
});

test('knowledge validation dispatcher reports knowledge unit issues by path', () => {
  const valid = unitSetFixture();
  const validReport = validateKnowledgePayload(valid, 'inline');

  assert.equal(validReport.kind, 'infra-agent.knowledge-validation');
  assert.equal(validReport.inputKind, 'infra-agent.knowledge-units');
  assert.equal(validReport.valid, true);

  const invalidReport = validateKnowledgePayload({
    ...valid,
    sourceId: 'wrong-source-id',
    source: {
      ...valid.source,
      url: `${valid.source.url}#reference`
    },
    unitCount: 4,
    units: [
      {
        ...valid.units[4],
        mutationAllowed: true
      },
      {
        ...valid.units[0],
        source: {
          ...valid.units[0].source,
          contentHash: 'b'.repeat(64)
        }
      }
    ]
  }, 'inline');

  assert.equal(invalidReport.valid, false);
  for (const path of [
    '$.sourceId',
    '$.source.url',
    '$.unitCount',
    '$.units[0].mutationAllowed',
    '$.units[1].source.contentHash'
  ]) {
    assert.ok(invalidReport.issues.some(issue => issue.path === path), path);
  }
});

test('knowledge facts map to fact units without raw source expansion', () => {
  const source = sourceFixture();
  const sourceId = buildKnowledgeCacheId(source);
  const fact = {
    kind: 'argument',
    path: 'resource.aws_s3_bucket.bucket',
    summary: 'Bucket name argument.',
    values: ['bucket'],
    required: false,
    type: 'string',
    confidence: 'high',
    extractionMethod: 'terraform-registry-markdown',
    source: {
      id: sourceId,
      source,
      contentHash: 'a'.repeat(64),
      locator: 'Argument Reference: bucket'
    }
  };
  const unit = knowledgeFactToFactUnit(fact, 'public-reference');

  assert.equal(unit.unitType, 'fact');
  assert.equal(unit.factKind, 'argument');
  assert.equal(unit.privacyScope, 'public-reference');
  assert.deepEqual(unit.values, ['bucket']);
  assert.equal('content' in unit, false);
});
