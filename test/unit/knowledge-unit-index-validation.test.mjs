import test from 'node:test';
import assert from 'node:assert/strict';

import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';

function indexFixture() {
  return {
    kind: 'infra-agent.knowledge-unit-index',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: 'unit-index-pack',
    sourceCount: 2,
    includedUnitCount: 5,
    omittedUnitCount: 0,
    entries: [
      {
        domain: 'terraform',
        targetPath: 'terraform/aws',
        sourceId: 'terraform-provider-source',
        sourceKind: 'terraform-registry',
        sourceName: 'terraform-registry:provider:hashicorp/aws',
        provider: 'hashicorp/aws',
        version: '5.47.0',
        storageScope: 'public-reference',
        privacyScopes: ['public-reference'],
        freshness: 'fresh',
        sourceContentHash: 'aaaaaaaaaaaa',
        unitCounts: {
          fact: 1,
          guidance: 1,
          example: 0,
          diagnostic: 0,
          recipe: 0
        },
        includedUnitCount: 2,
        omittedUnitCount: 0,
        sourceUnitCountEstimate: 2,
        retrievalKeys: [
          'domain:terraform',
          'freshness:fresh',
          'provider:hashicorp/aws',
          'sourceContentHash:aaaaaaaaaaaa',
          'sourceIdDigest:111111111111',
          'sourceKind:terraform-registry',
          'storageScope:public-reference',
          'targetPath:terraform/aws',
          'unitType:fact',
          'unitType:guidance'
        ]
      },
      {
        domain: 'pulumi',
        targetPath: 'pulumi/aws',
        sourceId: 'pulumi-package-source',
        sourceKind: 'pulumi-docs',
        sourceName: 'pulumi-docs:package:aws',
        packageName: '@pulumi/aws',
        version: '6.31.0',
        storageScope: 'public-reference',
        privacyScopes: ['public-reference', 'internal-team'],
        freshness: 'fresh',
        sourceContentHash: 'bbbbbbbbbbbb',
        unitCounts: {
          fact: 0,
          guidance: 0,
          example: 1,
          diagnostic: 1,
          recipe: 1
        },
        includedUnitCount: 3,
        omittedUnitCount: 0,
        sourceUnitCountEstimate: 3,
        retrievalKeys: [
          'domain:pulumi',
          'freshness:fresh',
          'packageName:@pulumi/aws',
          'privacyScope:internal-team',
          'privacyScope:public-reference',
          'sourceContentHash:bbbbbbbbbbbb',
          'sourceIdDigest:222222222222',
          'sourceKind:pulumi-docs',
          'storageScope:public-reference',
          'targetPath:pulumi/aws',
          'unitType:diagnostic',
          'unitType:example',
          'unitType:recipe'
        ]
      }
    ]
  };
}

test('knowledge unit index validation accepts the compact agent-facing contract', () => {
  const index = indexFixture();
  const report = validateKnowledgePayload(index, 'knowledge-unit-index.json');

  assert.equal(report.valid, true);
  assert.equal(report.inputKind, 'infra-agent.knowledge-unit-index');
  assert.equal(report.factSetCount, 0);
  assert.equal(report.factCount, 0);
  assert.equal(report.unitSetCount, 0);
  assert.equal(report.unitCount, index.includedUnitCount);
  assert.equal(report.issueCount, 0);
});

test('knowledge unit index validation rejects retrieval key URLs', () => {
  const index = indexFixture();
  index.entries[0].retrievalKeys.push('source:https://registry.terraform.io/providers/hashicorp/aws');
  const report = validateKnowledgePayload(index, 'knowledge-unit-index.json');

  assert.equal(report.valid, false);
  assert.ok(report.issues.some(issue => issue.path === '$.entries[0].retrievalKeys[10]'), report.issues);
});

test('knowledge unit index validation rejects full content hashes', () => {
  const index = indexFixture();
  index.entries[0].sourceContentHash = 'a'.repeat(64);
  const report = validateKnowledgePayload(index, 'knowledge-unit-index.json');

  assert.equal(report.valid, false);
  assert.ok(report.issues.some(issue => issue.path === '$.entries[0].sourceContentHash'), report.issues);
});

test('knowledge unit index validation rejects unit count drift', () => {
  const index = indexFixture();
  index.entries[0].unitCounts.guidance = 2;
  const report = validateKnowledgePayload(index, 'knowledge-unit-index.json');

  assert.equal(report.valid, false);
  assert.ok(report.issues.some(issue => issue.path === '$.entries[0].includedUnitCount'), report.issues);
  assert.ok(report.issues.some(issue => issue.path === '$.includedUnitCount'), report.issues);
});

test('knowledge unit index validation rejects unknown privacy scopes', () => {
  const index = indexFixture();
  index.entries[1].privacyScopes = ['public-reference', 'customer-shared'];
  const report = validateKnowledgePayload(index, 'knowledge-unit-index.json');

  assert.equal(report.valid, false);
  assert.ok(report.issues.some(issue => issue.path === '$.entries[1].privacyScopes[1]'), report.issues);
});
