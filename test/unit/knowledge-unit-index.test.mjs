import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildKnowledgeUnitMetadataIndex,
  selectKnowledgeUnitIndexEntries
} from '../../src/knowledge/unit-index.ts';

function publicStoragePolicy() {
  return {
    scope: 'public-reference',
    defaultStore: 'local-or-explicit-team-cache',
    shareableByDefault: true,
    requiresExplicitOptIn: false,
    reason: 'Source points at public provider, package, or chart documentation.'
  };
}

function privateStoragePolicy() {
  return {
    scope: 'workspace-private',
    defaultStore: 'local-only',
    shareableByDefault: false,
    requiresExplicitOptIn: true,
    reason: 'Source is derived from workspace-local files.'
  };
}

const SOURCES = [
  {
    id: 'terraform-provider-source',
    domain: 'terraform',
    targetPath: 'terraform/aws',
    kind: 'terraform-registry',
    name: 'terraform-registry:provider:hashicorp/aws',
    provider: 'hashicorp/aws',
    version: '5.47.0',
    url: 'https://registry.terraform.io/providers/hashicorp/aws/5.47.0/docs',
    factCount: 2,
    contentHash: 'a'.repeat(64),
    fetchedAt: '2026-05-13T00:00:00.000Z',
    stale: false,
    freshness: 'fresh',
    storagePolicy: publicStoragePolicy()
  },
  {
    id: 'pulumi-package-source',
    domain: 'pulumi',
    targetPath: 'pulumi/aws',
    kind: 'pulumi-docs',
    name: 'pulumi-docs:package:aws',
    packageName: '@pulumi/aws',
    version: '6.31.0',
    url: 'https://www.pulumi.com/registry/packages/aws/api-docs/',
    factCount: 2,
    contentHash: 'b'.repeat(64),
    fetchedAt: '2026-05-13T00:00:00.000Z',
    stale: false,
    freshness: 'fresh',
    storagePolicy: publicStoragePolicy()
  },
  {
    id: 'helm-chart-source',
    domain: 'helm',
    targetPath: 'charts/kube-prometheus-stack',
    kind: 'chart-docs',
    name: 'chart-docs:kube-prometheus-stack',
    chart: 'kube-prometheus-stack',
    version: '58.1.3',
    url: 'https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack/',
    factCount: 1,
    contentHash: 'c'.repeat(64),
    fetchedAt: '2026-05-13T00:00:00.000Z',
    stale: false,
    freshness: 'fresh',
    storagePolicy: publicStoragePolicy()
  },
  {
    id: 'workspace-private-source',
    domain: 'terraform',
    targetPath: 'modules/internal-network',
    kind: 'terraform-module',
    name: 'modules/internal-network/README.md',
    module: 'internal-network',
    version: 'workspace',
    factCount: 1,
    contentHash: 'd'.repeat(64),
    fetchedAt: null,
    stale: false,
    freshness: 'unchecked',
    storagePolicy: privateStoragePolicy()
  }
];

function buildPack() {
  const terraformBase = {
    path: 'provider.aws',
    summary: 'AWS provider setup metadata.',
    confidence: 'high',
    sourceId: 'terraform-provider-source',
    sourceLocator: 'provider.aws',
    privacyScope: 'public-reference'
  };
  const pulumiBase = {
    path: 'package.aws',
    summary: 'Pulumi AWS package metadata.',
    confidence: 'high',
    sourceId: 'pulumi-package-source',
    sourceLocator: 'package.aws',
    privacyScope: 'public-reference'
  };
  const helmBase = {
    path: 'chart.kube-prometheus-stack',
    summary: 'kube-prometheus-stack chart metadata.',
    confidence: 'high',
    sourceId: 'helm-chart-source',
    sourceLocator: 'chart.kube-prometheus-stack',
    privacyScope: 'public-reference'
  };

  const units = [
    {
      ...terraformBase,
      unitType: 'fact',
      factKind: 'argument',
      extractionMethod: 'terraform-registry-markdown',
      required: true,
      type: 'string'
    },
    {
      ...terraformBase,
      unitType: 'guidance',
      topic: 'Provider upgrade review',
      extractionMethod: 'official-guidance'
    },
    {
      ...pulumiBase,
      unitType: 'example',
      exampleType: 'package-usage',
      snippet: 'const topic = new aws.sns.Topic("events");',
      language: 'typescript',
      extractionMethod: 'official-example'
    },
    {
      ...pulumiBase,
      unitType: 'diagnostic',
      engine: 'pulumi',
      signature: 'missing provider region',
      likelyCause: 'Pulumi provider configuration is incomplete.',
      recommendedReview: ['Run pulumi preview after setting provider configuration.'],
      extractionMethod: 'provider-diagnostic'
    },
    {
      ...helmBase,
      unitType: 'recipe',
      name: 'Chart upgrade review',
      steps: ['Run helm template and inspect rendered manifests.'],
      mutationAllowed: false,
      extractionMethod: 'workflow-recipe'
    },
    {
      unitType: 'fact',
      factKind: 'module-input',
      path: 'module.internal-network.vpc_id',
      summary: 'Internal network module requires a VPC id.',
      confidence: 'medium',
      extractionMethod: 'repo-local-static',
      sourceId: 'workspace-private-source',
      sourceLocator: 'modules/internal-network/variables.tf:vpc_id',
      privacyScope: 'workspace-private',
      required: true,
      type: 'string'
    }
  ];

  return {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: 'unit-index-pack',
    workspaceRoot: '/workspace',
    cacheRoot: '/cache',
    requestedDomains: ['terraform', 'pulumi', 'helm'],
    targetPaths: [
      'terraform/aws',
      'pulumi/aws',
      'charts/kube-prometheus-stack',
      'modules/internal-network'
    ],
    sourceIds: SOURCES.map(source => source.id),
    sourceCount: SOURCES.length,
    factSetCount: SOURCES.length,
    factCount: 6,
    includedFactCount: 0,
    omittedFactCount: 0,
    unitCount: units.length,
    includedUnitCount: units.length,
    omittedUnitCount: 0,
    maxFacts: units.length,
    maxUnits: units.length,
    staleSourceCount: 0,
    storagePolicy: {
      publicReference: 3,
      workspacePrivate: 1,
      shareableByDefault: 3,
      explicitOptInRequired: 1
    },
    sources: SOURCES,
    facts: [],
    units
  };
}

test('knowledge unit metadata index aggregates five unit types by source', () => {
  const index = buildKnowledgeUnitMetadataIndex(buildPack());
  const terraformEntry = index.entries.find(entry => entry.sourceId === 'terraform-provider-source');
  const pulumiEntry = index.entries.find(entry => entry.sourceId === 'pulumi-package-source');
  const helmEntry = index.entries.find(entry => entry.sourceId === 'helm-chart-source');
  const privateEntry = index.entries.find(entry => entry.sourceId === 'workspace-private-source');

  assert.equal(index.kind, 'infra-agent.knowledge-unit-index');
  assert.equal(index.schemaVersion, 1);
  assert.equal(index.mutationAllowed, false);
  assert.equal(index.sourceCount, 4);
  assert.equal(index.includedUnitCount, 6);
  assert.equal(index.omittedUnitCount, 0);

  assert.deepEqual(terraformEntry?.unitCounts, {
    fact: 1,
    guidance: 1,
    example: 0,
    diagnostic: 0,
    recipe: 0
  });
  assert.deepEqual(pulumiEntry?.unitCounts, {
    fact: 0,
    guidance: 0,
    example: 1,
    diagnostic: 1,
    recipe: 0
  });
  assert.deepEqual(helmEntry?.unitCounts, {
    fact: 0,
    guidance: 0,
    example: 0,
    diagnostic: 0,
    recipe: 1
  });
  assert.equal(privateEntry?.unitCounts.fact, 1);
  assert.equal(privateEntry?.includedUnitCount, 1);
  assert.equal(privateEntry?.omittedUnitCount, 0);
  assert.equal(privateEntry?.sourceUnitCountEstimate, 1);
});

test('knowledge unit metadata index preserves compact source identity', () => {
  const index = buildKnowledgeUnitMetadataIndex(buildPack());
  const terraformEntry = index.entries.find(entry => entry.sourceId === 'terraform-provider-source');
  const pulumiEntry = index.entries.find(entry => entry.sourceId === 'pulumi-package-source');
  const helmEntry = index.entries.find(entry => entry.sourceId === 'helm-chart-source');
  const privateEntry = index.entries.find(entry => entry.sourceId === 'workspace-private-source');

  assert.equal(terraformEntry?.domain, 'terraform');
  assert.equal(terraformEntry?.targetPath, 'terraform/aws');
  assert.equal(terraformEntry?.sourceKind, 'terraform-registry');
  assert.equal(terraformEntry?.sourceName, 'terraform-registry:provider:hashicorp/aws');
  assert.equal(terraformEntry?.provider, 'hashicorp/aws');
  assert.equal(terraformEntry?.version, '5.47.0');
  assert.equal(terraformEntry?.storageScope, 'public-reference');
  assert.equal(terraformEntry?.sourceContentHash, 'aaaaaaaaaaaa');
  assert.deepEqual(terraformEntry?.privacyScopes, ['public-reference']);
  assert.equal(terraformEntry?.freshness, 'fresh');

  assert.equal(pulumiEntry?.packageName, '@pulumi/aws');
  assert.equal(helmEntry?.chart, 'kube-prometheus-stack');
  assert.equal(privateEntry?.module, 'internal-network');
  assert.equal(privateEntry?.storageScope, 'workspace-private');
  assert.deepEqual(privateEntry?.privacyScopes, ['workspace-private']);
});

test('knowledge unit retrieval keys are stable and avoid raw docs or URLs', () => {
  const first = buildKnowledgeUnitMetadataIndex(buildPack());
  const second = buildKnowledgeUnitMetadataIndex(buildPack());
  const serialized = JSON.stringify(first);
  const allKeys = first.entries.flatMap(entry => entry.retrievalKeys);

  assert.deepEqual(first.entries.map(entry => entry.retrievalKeys), second.entries.map(entry => entry.retrievalKeys));
  assert.ok(allKeys.includes('provider:hashicorp/aws'));
  assert.ok(allKeys.includes('packageName:@pulumi/aws'));
  assert.ok(allKeys.includes('chart:kube-prometheus-stack'));
  assert.ok(allKeys.includes('version:58.1.3'));
  assert.ok(allKeys.includes('unitType:recipe'));
  assert.ok(allKeys.includes('sourceContentHash:aaaaaaaaaaaa'));
  assert.equal(allKeys.some(key => key.includes('a'.repeat(64))), false);
  assert.doesNotMatch(serialized, /https:\/\/|# AWS Provider|Argument Reference|new aws\.sns\.Topic|helm template/);
  assert.doesNotMatch(JSON.stringify(allKeys), /https:\/\/|registry\.terraform\.io|pulumi\.com|artifacthub\.io/);
});

test('knowledge unit index filter selects by provider package chart version and unit type', () => {
  const index = buildKnowledgeUnitMetadataIndex(buildPack());

  assert.deepEqual(
    selectKnowledgeUnitIndexEntries(index, {
      provider: 'hashicorp/aws',
      version: '5.47.0',
      unitType: 'guidance'
    }).map(entry => entry.sourceId),
    ['terraform-provider-source']
  );
  assert.deepEqual(
    selectKnowledgeUnitIndexEntries(index, {
      packageName: '@pulumi/aws',
      unitType: 'diagnostic'
    }).map(entry => entry.sourceId),
    ['pulumi-package-source']
  );
  assert.deepEqual(
    selectKnowledgeUnitIndexEntries(index, {
      chart: 'kube-prometheus-stack',
      version: '58.1.3',
      unitType: 'recipe'
    }).map(entry => entry.sourceId),
    ['helm-chart-source']
  );
  assert.deepEqual(
    selectKnowledgeUnitIndexEntries(index, {
      targetPath: 'modules/internal-network',
      module: 'internal-network',
      unitType: 'fact'
    }).map(entry => entry.sourceId),
    ['workspace-private-source']
  );
});

test('knowledge unit index filter distinguishes public reference and workspace private sources', () => {
  const index = buildKnowledgeUnitMetadataIndex(buildPack());

  assert.deepEqual(
    selectKnowledgeUnitIndexEntries(index, { privacyScope: 'public-reference' })
      .map(entry => entry.sourceId)
      .sort(),
    ['helm-chart-source', 'pulumi-package-source', 'terraform-provider-source']
  );
  assert.deepEqual(
    selectKnowledgeUnitIndexEntries(index, { storageScope: 'workspace-private' })
      .map(entry => entry.sourceId),
    ['workspace-private-source']
  );
  assert.deepEqual(
    selectKnowledgeUnitIndexEntries(index, {
      privacyScope: 'workspace-private',
      domain: 'terraform',
      unitType: 'fact'
    }).map(entry => entry.sourceId),
    ['workspace-private-source']
  );
});
