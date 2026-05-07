import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve
} from 'node:path';
import { writeTerraformProviderSchemaWorkspace } from '../support/terraform-provider-schema-workspace.mjs';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { buildKnowledgeCacheId } from '../../src/knowledge/cache.ts';
import { buildKnowledgeArtifactManifest } from '../../src/knowledge/artifact-manifest.ts';
import { buildKnowledgePack } from '../../src/knowledge/pack.ts';
import { budgetKnowledgePackFacts } from '../../src/knowledge/fact-budget.ts';
import { rankKnowledgePackFacts } from '../../src/knowledge/fact-ranking.ts';
import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';

test('knowledge pack builds bounded planner-safe fact packs', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const pack = await buildKnowledgePack(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    maxFacts: 3,
    extractedAt: '2026-05-05T00:00:00.000Z'
  });

  assert.equal(pack.kind, 'infra-agent.knowledge-pack');
  assert.equal(pack.schemaVersion, 1);
  assert.equal(pack.mutationAllowed, false);
  assert.match(pack.packId, /^[a-f0-9]{24}$/);
  assert.deepEqual(pack.requestedDomains, ['helm']);
  assert.deepEqual(pack.targetPaths, ['charts/payments-api']);
  assert.equal(pack.maxFacts, 3);
  assert.equal(pack.includedFactCount, Math.min(3, pack.factCount));
  assert.equal(pack.facts.length, pack.includedFactCount);
  assert.ok(pack.omittedFactCount >= 1);
  assert.ok(pack.sources.some(source =>
    source.kind === 'chart-schema'
    && source.domain === 'helm'
    && source.factCount > 0
  ));
  const localSource = pack.sources.find(source => source.kind === 'chart-schema');
  assert.equal(localSource?.freshness, 'fresh');
  assert.equal(localSource?.storagePolicy.scope, 'workspace-private');
  assert.equal(localSource?.storagePolicy.defaultStore, 'local-only');
  assert.equal(localSource?.storagePolicy.requiresExplicitOptIn, true);
  assert.equal(pack.storagePolicy.workspacePrivate, pack.sources.length);
  assert.equal(pack.storagePolicy.explicitOptInRequired, pack.sources.length);
  assert.match(localSource?.fingerprintDigest ?? '', /^[a-f0-9]{64}$/);
  assert.equal(localSource?.fingerprintFileCount, 1);
  assert.ok(localSource && !('sourceFingerprint' in localSource));
  assert.ok(pack.facts.every(fact => typeof fact.sourceId === 'string' && !('source' in fact)));
  assert.doesNotMatch(JSON.stringify(pack), /"content"\s*:|replicaCount":\s*\{|"\$schema"|resource "aws_/);
});

test('knowledge validation accepts packs and rejects compact pack drift', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const pack = await buildKnowledgePack(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    maxFacts: 3,
    extractedAt: '2026-05-05T00:00:00.000Z'
  });

  const validReport = validateKnowledgePayload(pack, 'inline');
  assert.equal(validReport.kind, 'infra-agent.knowledge-validation');
  assert.equal(validReport.inputKind, 'infra-agent.knowledge-pack');
  assert.equal(validReport.valid, true);
  assert.equal(validReport.factSetCount, pack.factSetCount);
  assert.equal(validReport.factCount, pack.factCount);
  assert.equal(validReport.staleSourceCount, pack.staleSourceCount);

  const countDriftReport = validateKnowledgePayload({
    ...pack,
    sourceCount: pack.sourceCount + 1,
    factSetCount: pack.factSetCount + 1,
    factCount: pack.factCount + 1,
    includedFactCount: pack.includedFactCount + 1,
    omittedFactCount: pack.omittedFactCount + 1,
    staleSourceCount: pack.staleSourceCount + 1
  }, 'inline');
  assert.equal(countDriftReport.valid, false);
  for (const path of [
    '$.sourceCount',
    '$.factSetCount',
    '$.factCount',
    '$.includedFactCount',
    '$.omittedFactCount',
    '$.staleSourceCount'
  ]) {
    assert.ok(countDriftReport.issues.some(issue => issue.path === path), path);
  }

  const policyDriftReport = validateKnowledgePayload({
    ...pack,
    storagePolicy: {
      ...pack.storagePolicy,
      publicReference: pack.storagePolicy.publicReference + 1
    }
  }, 'inline');
  assert.equal(policyDriftReport.valid, false);
  assert.ok(policyDriftReport.issues.some(issue => issue.path === '$.storagePolicy.publicReference'));

  const forgedStoragePolicyReport = validateKnowledgePayload({
    ...pack,
    sources: [{
      ...pack.sources[0],
      storagePolicy: {
        scope: 'public-reference',
        defaultStore: 'local-or-explicit-team-cache',
        shareableByDefault: true,
        requiresExplicitOptIn: false,
        reason: 'Forged public posture.'
      }
    }]
  }, 'inline');
  assert.equal(forgedStoragePolicyReport.valid, false);
  assert.ok(forgedStoragePolicyReport.issues.some(issue => issue.path === '$.sources[0].storagePolicy'));

  const missingSourceReport = validateKnowledgePayload({
    ...pack,
    facts: [{
      ...pack.facts[0],
      sourceId: 'missing-source'
    }]
  }, 'inline');
  assert.equal(missingSourceReport.valid, false);
  assert.ok(missingSourceReport.issues.some(issue => issue.path === '$.facts[0].sourceId'));

  const sourceShapeReport = validateKnowledgePayload({
    ...pack,
    sources: [{
      ...pack.sources[0],
      stale: false,
      staleReason: 'time-expired',
      freshness: 'stale',
      fingerprintDigest: 'not-a-sha',
      fingerprintFileCount: '1'
    }],
    sourceIds: [pack.sources[0]?.id],
    sourceCount: 1,
    factSetCount: 1,
    factCount: pack.sources[0]?.factCount ?? 0,
    includedFactCount: 0,
    omittedFactCount: pack.sources[0]?.factCount ?? 0,
    staleSourceCount: 0,
    facts: []
  }, 'inline');
  assert.equal(sourceShapeReport.valid, false);
  assert.ok(sourceShapeReport.issues.some(issue => issue.path === '$.sources[0].staleReason'));
  assert.ok(sourceShapeReport.issues.some(issue => issue.path === '$.sources[0].freshness'));
  assert.ok(sourceShapeReport.issues.some(issue => issue.path === '$.sources[0].fingerprintDigest'));
  assert.ok(sourceShapeReport.issues.some(issue => issue.path === '$.sources[0].fingerprintFileCount'));

  const secretLikeFactReport = validateKnowledgePayload({
    ...pack,
    facts: [{
      ...pack.facts[0],
      summary: 'contains password-like planner context'
    }],
    includedFactCount: 1,
    omittedFactCount: pack.factCount - 1
  }, 'inline');
  assert.equal(secretLikeFactReport.valid, false);
  assert.ok(secretLikeFactReport.issues.some(issue => issue.path === '$.facts[0].summary'));
});

test('knowledge artifact manifests require validation before team-cache publication', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const pack = await buildKnowledgePack(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    maxFacts: 3,
    extractedAt: '2026-05-05T00:00:00.000Z'
  });
  const manifest = buildKnowledgeArtifactManifest(pack, {
    artifactPath: '/tmp/knowledge-pack.json',
    createdAt: '2026-05-06T00:00:00.000Z'
  });

  assert.equal(manifest.kind, 'infra-agent.knowledge-artifact-manifest');
  assert.equal(manifest.mutationAllowed, false);
  assert.match(manifest.manifestId, /^[a-f0-9]{24}$/);
  assert.equal(manifest.artifact.kind, 'infra-agent.knowledge-pack');
  assert.equal(manifest.artifact.id, pack.packId);
  assert.equal(manifest.artifact.path, '/tmp/knowledge-pack.json');
  assert.match(manifest.artifact.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(manifest.artifact.sourceIds, pack.sources.map(source => source.id));
  assert.equal(manifest.artifact.sourceCount, pack.sourceCount);
  assert.equal(manifest.artifact.factCount, pack.factCount);
  assert.equal(manifest.artifact.storagePolicy.workspacePrivate, pack.storagePolicy.workspacePrivate);
  assert.equal(manifest.publication.executionMode, 'plan-only');
  assert.equal(manifest.publication.remoteWriteAllowed, false);
  assert.equal(manifest.publication.credentialRequired, false);
  assert.equal(manifest.publication.uploadCommand, null);
  assert.equal(manifest.publication.defaultStore, 'local-only');
  assert.equal(manifest.publication.shareableByDefault, false);
  assert.equal(manifest.publication.requiresExplicitOptIn, true);
  assert.deepEqual(manifest.publication.publishableByDefaultSourceIds, []);
  assert.ok(manifest.publication.blockedSources.some(source =>
    source.reason === 'workspace-private-source'
    && source.storageScope === 'workspace-private'
  ));
  assert.ok(manifest.publication.requiredValidations.some(command => /knowledge validate/.test(command)));

  const validReport = validateKnowledgePayload(manifest, 'inline');
  assert.equal(validReport.inputKind, 'infra-agent.knowledge-artifact-manifest');
  assert.equal(validReport.valid, true);
  assert.equal(validReport.factCount, pack.factCount);

  const forgedReport = validateKnowledgePayload({
    ...manifest,
    publication: {
      ...manifest.publication,
      executionMode: 'execute',
      remoteWriteAllowed: true,
      credentialRequired: true,
      uploadCommand: 'aws s3 cp knowledge-pack.json s3://example',
      defaultStore: 'local-or-explicit-team-cache',
      shareableByDefault: true,
      requiresExplicitOptIn: false,
      publishableByDefaultSourceIds: ['missing-source'],
      blockedSources: [{
        sourceId: 'missing-source',
        storageScope: 'workspace-private',
        stale: false,
        reason: 'workspace-private-source'
      }],
      requiredValidations: []
    }
  }, 'inline');
  assert.equal(forgedReport.valid, false);
  for (const path of [
    '$.publication.executionMode',
    '$.publication.remoteWriteAllowed',
    '$.publication.credentialRequired',
    '$.publication.uploadCommand',
    '$.publication.defaultStore',
    '$.publication.shareableByDefault',
    '$.publication.requiresExplicitOptIn',
    '$.publication.publishableByDefaultSourceIds[0]',
    '$.publication.blockedSources[0].sourceId',
    '$.publication.requiredValidations'
  ]) {
    assert.ok(forgedReport.issues.some(issue => issue.path === path), path);
  }
});

test('knowledge fact budget summarizes packs without raw source payloads', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const pack = await buildKnowledgePack(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    maxFacts: 6,
    extractedAt: '2026-05-05T00:00:00.000Z'
  });
  const summary = budgetKnowledgePackFacts(pack, {
    maxFacts: 2
  });

  assert.equal(summary.kind, 'infra-agent.knowledge-facts-summary');
  assert.equal(summary.schemaVersion, 1);
  assert.equal(summary.mutationAllowed, false);
  assert.equal(summary.packId, pack.packId);
  assert.equal(summary.maxFacts, 2);
  assert.equal(summary.includedFactCount, 2);
  assert.equal(summary.omittedFactCount, pack.factCount - 2);
  assert.equal(summary.sourceCount, pack.sourceCount);
  assert.ok(summary.sources.some(source =>
    source.kind === 'chart-schema'
    && source.domain === 'helm'
    && source.freshness === 'fresh'
    && typeof source.fingerprintDigest === 'string'
    && source.fingerprintFileCount === 1
    && source.factCount > 0
  ));
  assert.ok(summary.facts.every(fact =>
    typeof fact.sourceId === 'string'
    && typeof fact.sourceLocator === 'string'
    && !('source' in fact)
  ));
  assert.doesNotMatch(JSON.stringify(summary), /contentHash|fetchedAt|"content"\s*:|"\$schema"|replicaCount":\s*\{/);
});

test('knowledge pack marks cached public registry docs as shareable references', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-public-policy-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    await mkdir(terraformRoot, { recursive: true });
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'terraform {',
        '  required_providers {',
        '    aws = {',
        '      source = "hashicorp/aws"',
        '      version = "5.37.0"',
        '    }',
        '  }',
        '}',
        '',
        'resource "aws_s3_bucket" "logs" {}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(terraformRoot, '.terraform.lock.hcl'),
      [
        'provider "registry.terraform.io/hashicorp/aws" {',
        '  version = "5.37.0"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const store = {
      root: join(tempRoot, '.infra-agent/knowledge-cache'),
      buildId: buildKnowledgeCacheId,
      read: async source => ({
        id: buildKnowledgeCacheId(source),
        source,
        contentType: 'text/markdown',
        content: [
          '# aws_s3_bucket',
          '',
          '## Argument Reference',
          '',
          '* `bucket` - (Optional) Bucket name.',
          ''
        ].join('\n'),
        contentHash: 'd'.repeat(64),
        fetchedAt: '2026-05-05T00:00:00.000Z',
        staleAfter: '2026-06-05T00:00:00.000Z'
      }),
      write: async () => {
        throw new Error('pack extraction should not write in this test');
      },
      isStale: () => false
    };
    const inspection = await inspectWorkspace(tempRoot);
    const pack = await buildKnowledgePack(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      maxFacts: 2,
      store,
      extractedAt: '2026-05-05T00:00:00.000Z'
    });
    const registrySource = pack.sources.find(source => source.kind === 'terraform-registry');

    assert.ok(registrySource);
    assert.equal(registrySource.storagePolicy.scope, 'public-reference');
    assert.equal(registrySource.storagePolicy.defaultStore, 'local-or-explicit-team-cache');
    assert.equal(registrySource.storagePolicy.shareableByDefault, true);
    assert.equal(registrySource.storagePolicy.requiresExplicitOptIn, false);
    assert.equal(pack.storagePolicy.publicReference, 1);
    assert.equal(pack.storagePolicy.shareableByDefault, 1);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge fact ranking prioritizes local required facts before examples', () => {
  const sources = [
    {
      id: 'provider-schema-source',
      domain: 'terraform',
      targetPath: 'terraform/app',
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/app',
      factCount: 2,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'registry-source',
      domain: 'terraform',
      targetPath: 'terraform/app',
      kind: 'terraform-registry',
      name: 'resource:aws_lb_listener_rule',
      factCount: 1,
      contentHash: 'b'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false
    }
  ];
  const ranked = rankKnowledgePackFacts([
    {
      kind: 'example',
      path: 'resource.aws_lb_listener_rule.example',
      summary: 'Example listener rule configuration.',
      confidence: 'medium',
      extractionMethod: 'terraform-registry-markdown',
      sourceId: 'registry-source',
      sourceLocator: 'Example Usage'
    },
    {
      kind: 'argument',
      path: 'resource.aws_lb_listener_rule.listener_arn',
      summary: 'resource.aws_lb_listener_rule.listener_arn is required by the Terraform provider schema.',
      confidence: 'high',
      extractionMethod: 'terraform-provider-schema',
      sourceId: 'provider-schema-source',
      sourceLocator: 'provider schema: resource.aws_lb_listener_rule.listener_arn',
      required: true,
      type: 'string'
    }
  ], {
    sources,
    requestedDomains: ['terraform'],
    targetPaths: ['terraform/app']
  });

  assert.equal(ranked[0]?.path, 'resource.aws_lb_listener_rule.listener_arn');
  assert.equal(ranked[1]?.path, 'resource.aws_lb_listener_rule.example');
});

test('knowledge fact ranking is deterministic across target order and staleness', () => {
  const sources = [
    {
      id: 'target-b',
      domain: 'terraform',
      targetPath: 'terraform/b',
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/b',
      factCount: 1,
      contentHash: 'b'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'target-a',
      domain: 'terraform',
      targetPath: 'terraform/a',
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/a',
      factCount: 1,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'stale-schema',
      domain: 'terraform',
      targetPath: 'terraform/a',
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/a-stale',
      factCount: 1,
      contentHash: 'c'.repeat(64),
      fetchedAt: '2026-04-01T00:00:00.000Z',
      stale: true
    },
    {
      id: 'fresh-registry',
      domain: 'terraform',
      targetPath: 'terraform/a',
      kind: 'terraform-registry',
      name: 'resource:aws_lb_listener_rule',
      factCount: 1,
      contentHash: 'd'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false
    }
  ];
  const ranked = rankKnowledgePackFacts([
    {
      kind: 'argument',
      path: 'resource.aws_lb_listener_rule.listener_arn',
      summary: 'listener_arn is required.',
      confidence: 'high',
      extractionMethod: 'terraform-provider-schema',
      sourceId: 'target-b',
      sourceLocator: 'provider schema: listener_arn',
      required: true,
      type: 'string'
    },
    {
      kind: 'argument',
      path: 'resource.aws_lb_listener_rule.listener_arn',
      summary: 'listener_arn is required.',
      confidence: 'high',
      extractionMethod: 'terraform-provider-schema',
      sourceId: 'target-a',
      sourceLocator: 'provider schema: listener_arn',
      required: true,
      type: 'string'
    },
    {
      kind: 'argument',
      path: 'resource.aws_lb_listener_rule.priority',
      summary: 'priority is required.',
      confidence: 'medium',
      extractionMethod: 'terraform-provider-schema',
      sourceId: 'stale-schema',
      sourceLocator: 'provider schema: priority',
      required: true,
      type: 'number'
    },
    {
      kind: 'example',
      path: 'resource.aws_lb_listener_rule.example',
      summary: 'Example listener rule configuration.',
      confidence: 'high',
      extractionMethod: 'terraform-registry-markdown',
      sourceId: 'fresh-registry',
      sourceLocator: 'Example Usage'
    }
  ], {
    sources,
    requestedDomains: ['terraform'],
    targetPaths: ['terraform/a', 'terraform/b']
  });

  assert.equal(ranked[0]?.sourceId, 'target-a');
  assert.equal(ranked[1]?.sourceId, 'target-b');
  assert.ok(
    ranked.findIndex(fact => fact.sourceId === 'stale-schema')
    < ranked.findIndex(fact => fact.sourceId === 'fresh-registry')
  );
});

test('knowledge fact ranking places required module inputs before examples', () => {
  const sources = [
    {
      id: 'provider-schema-source',
      domain: 'terraform',
      targetPath: 'terraform/app',
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/app',
      factCount: 1,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'module-source',
      domain: 'terraform',
      targetPath: 'terraform/app',
      kind: 'terraform-module',
      name: 'terraform-module:terraform/app:queue_worker',
      factCount: 1,
      contentHash: 'b'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'registry-source',
      domain: 'terraform',
      targetPath: 'terraform/app',
      kind: 'terraform-registry',
      name: 'resource:aws_sqs_queue',
      factCount: 1,
      contentHash: 'c'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false
    }
  ];
  const ranked = rankKnowledgePackFacts([
    {
      kind: 'example',
      path: 'resource.aws_sqs_queue.example',
      summary: 'Queue example.',
      confidence: 'high',
      extractionMethod: 'terraform-registry-markdown',
      sourceId: 'registry-source',
      sourceLocator: 'Example Usage'
    },
    {
      kind: 'module-input',
      path: 'module.queue_worker.inputs.image_tag',
      summary: 'module.queue_worker.inputs.image_tag is required by the local Terraform module interface.',
      required: true,
      type: 'string',
      confidence: 'high',
      extractionMethod: 'repo-local-static',
      sourceId: 'module-source',
      sourceLocator: 'variables.tf: variable.image_tag'
    },
    {
      kind: 'argument',
      path: 'resource.aws_sqs_queue.name',
      summary: 'resource.aws_sqs_queue.name is required by the Terraform provider schema.',
      required: true,
      type: 'string',
      confidence: 'high',
      extractionMethod: 'terraform-provider-schema',
      sourceId: 'provider-schema-source',
      sourceLocator: 'provider schema: resource.aws_sqs_queue.name'
    }
  ], {
    sources,
    requestedDomains: ['terraform'],
    targetPaths: ['terraform/app']
  });

  assert.equal(ranked[0]?.path, 'resource.aws_sqs_queue.name');
  assert.equal(ranked[1]?.path, 'module.queue_worker.inputs.image_tag');
  assert.equal(ranked[2]?.path, 'resource.aws_sqs_queue.example');
  assert.ok(ranked.every(fact => !('rank' in fact)));
});

test('knowledge fact ranking places Pulumi config parameters before examples', () => {
  const sources = [
    {
      id: 'pulumi-config-source',
      domain: 'pulumi',
      targetPath: 'infra/payments-api',
      kind: 'pulumi-config',
      name: 'pulumi-config:infra/payments-api',
      factCount: 1,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'pulumi-docs-source',
      domain: 'pulumi',
      targetPath: 'infra/payments-api',
      kind: 'pulumi-docs',
      name: 'pulumi-config-docs',
      factCount: 1,
      contentHash: 'b'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false
    }
  ];
  const ranked = rankKnowledgePackFacts([
    {
      kind: 'example',
      path: 'pulumi.config.example',
      summary: 'Pulumi config example.',
      confidence: 'high',
      extractionMethod: 'repo-local-static',
      sourceId: 'pulumi-docs-source',
      sourceLocator: 'Pulumi config docs'
    },
    {
      kind: 'pulumi-config-parameter',
      path: 'config.payments-api:imageTag',
      summary: 'config.payments-api:imageTag is declared by Pulumi project config.',
      confidence: 'high',
      extractionMethod: 'repo-local-static',
      sourceId: 'pulumi-config-source',
      sourceLocator: 'infra/payments-api/Pulumi.yaml: config.payments-api:imageTag',
      type: 'string',
      values: ['latest']
    }
  ], {
    sources,
    requestedDomains: ['pulumi'],
    targetPaths: ['infra/payments-api']
  });

  assert.equal(ranked[0]?.path, 'config.payments-api:imageTag');
  assert.equal(ranked[1]?.path, 'pulumi.config.example');
});

test('knowledge fact ranking places Pulumi config before package docs guidance', () => {
  const sources = [
    {
      id: 'pulumi-config-source',
      domain: 'pulumi',
      targetPath: 'infra/payments-api',
      kind: 'pulumi-config',
      name: 'pulumi-config:infra/payments-api',
      factCount: 1,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'pulumi-package-docs-source',
      domain: 'pulumi',
      targetPath: 'infra/payments-api',
      kind: 'pulumi-docs',
      name: 'pulumi-docs:package:aws',
      factCount: 1,
      contentHash: 'b'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false
    }
  ];
  const ranked = rankKnowledgePackFacts([
    {
      kind: 'pulumi-docs-guidance',
      path: 'pulumi.package.aws.s3',
      summary: 'S3 resources for buckets and objects.',
      confidence: 'medium',
      extractionMethod: 'pulumi-docs-markdown',
      sourceId: 'pulumi-package-docs-source',
      sourceLocator: 'Pulumi package docs: s3',
      values: ['s3']
    },
    {
      kind: 'pulumi-config-parameter',
      path: 'config.payments-api:imageTag',
      summary: 'config.payments-api:imageTag is declared by Pulumi project config.',
      confidence: 'high',
      extractionMethod: 'repo-local-static',
      sourceId: 'pulumi-config-source',
      sourceLocator: 'infra/payments-api/Pulumi.yaml: config.payments-api:imageTag',
      type: 'string',
      values: ['latest']
    }
  ], {
    sources,
    requestedDomains: ['pulumi'],
    targetPaths: ['infra/payments-api']
  });

  assert.equal(ranked[0]?.path, 'config.payments-api:imageTag');
  assert.equal(ranked[1]?.path, 'pulumi.package.aws.s3');
});

test('knowledge fact ranking places Helm dependency facts before chart docs examples', () => {
  const sources = [
    {
      id: 'chart-metadata-source',
      domain: 'helm',
      targetPath: 'charts/api',
      kind: 'chart-metadata',
      name: 'api:Chart.yaml',
      factCount: 1,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'chart-docs-source',
      domain: 'helm',
      targetPath: 'charts/api',
      kind: 'chart-docs',
      name: 'api:dependency:redis',
      factCount: 1,
      contentHash: 'b'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false
    }
  ];
  const ranked = rankKnowledgePackFacts([
    {
      kind: 'example',
      path: 'chart.api.example',
      summary: 'Helm chart dependency example.',
      confidence: 'high',
      extractionMethod: 'repo-local-static',
      sourceId: 'chart-docs-source',
      sourceLocator: 'chart docs'
    },
    {
      kind: 'chart-dependency',
      path: 'chart.api.dependencies.redis',
      summary: 'chart.api locked Helm dependency redis.',
      confidence: 'high',
      extractionMethod: 'repo-local-static',
      sourceId: 'chart-metadata-source',
      sourceLocator: 'charts/api/Chart.lock: dependencies.redis',
      values: ['version=17.3.1', 'locked=true']
    }
  ], {
    sources,
    requestedDomains: ['helm'],
    targetPaths: ['charts/api']
  });

  assert.equal(ranked[0]?.path, 'chart.api.dependencies.redis');
  assert.equal(ranked[1]?.path, 'chart.api.example');
});

test('knowledge pack includes focused Terraform provider schema facts under small budgets', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-provider-schema-pack-'));

  try {
    await writeTerraformProviderSchemaWorkspace(tempRoot);

    const inspection = await inspectWorkspace(tempRoot);
    const pack = await buildKnowledgePack(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      maxFacts: 2,
      extractedAt: '2026-05-05T00:00:00.000Z'
    });

    assert.equal(pack.kind, 'infra-agent.knowledge-pack');
    assert.equal(pack.includedFactCount, 2);
    assert.ok(pack.sources.some(source =>
      source.kind === 'provider-schema'
      && source.domain === 'terraform'
      && source.targetPath === 'terraform/app'
      && source.freshness === 'fresh'
      && typeof source.fingerprintDigest === 'string'
      && source.fingerprintFileCount === 3
      && source.factCount > 0
    ));
    assert.ok(pack.facts.some(fact =>
      fact.extractionMethod === 'terraform-provider-schema'
      && fact.path === 'resource.aws_lb_listener_rule.listener_arn'
      && fact.required === true
    ));
    assert.ok(pack.facts.some(fact =>
      fact.extractionMethod === 'terraform-provider-schema'
      && fact.path === 'resource.aws_lb_listener_rule.action'
      && fact.required === true
    ));
    assert.doesNotMatch(JSON.stringify(pack), /aws_instance|provider_schemas|"content"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack includes Terraform local module inputs under small budgets', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-module-pack-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    const moduleRoot = join(terraformRoot, 'modules/queue-worker');
    await mkdir(moduleRoot, { recursive: true });
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'module "queue_worker" {',
        '  source = "./modules/queue-worker"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(moduleRoot, 'variables.tf'),
      [
        'variable "image_tag" {',
        '  type = string',
        '}',
        '',
        'variable "environment" {',
        '  type    = string',
        '  default = "dev"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(moduleRoot, 'outputs.tf'),
      [
        'output "queue_name" {',
        '  value = "queue"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const pack = await buildKnowledgePack(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      maxFacts: 2,
      extractedAt: '2026-05-05T00:00:00.000Z'
    });

    assert.equal(pack.kind, 'infra-agent.knowledge-pack');
    assert.equal(pack.includedFactCount, 2);
    assert.ok(pack.sources.some(source =>
      source.kind === 'terraform-module'
      && source.targetPath === 'terraform/app'
      && source.storagePolicy.scope === 'workspace-private'
      && source.storagePolicy.requiresExplicitOptIn === true
      && source.factCount > 0
    ));
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'module-input'
      && fact.path === 'module.queue_worker.inputs.image_tag'
      && fact.required === true
    ));
    assert.ok(pack.facts.some(fact =>
      fact.path === 'module.queue_worker.source'
      && fact.values?.includes('terraform/app/modules/queue-worker')
    ));
    assert.doesNotMatch(JSON.stringify(pack), /variable "image_tag"|output "queue_name"|"content"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack includes Pulumi config parameters under small budgets', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const pack = await buildKnowledgePack(inspection, {
    domains: ['pulumi'],
    targetPaths: ['infra/payments-api'],
    maxFacts: 2,
    extractedAt: '2026-05-05T00:00:00.000Z'
  });

  assert.equal(pack.kind, 'infra-agent.knowledge-pack');
  assert.equal(pack.mutationAllowed, false);
  assert.equal(pack.includedFactCount, 2);
  assert.ok(pack.sources.some(source =>
    source.kind === 'pulumi-config'
    && source.domain === 'pulumi'
    && source.targetPath === 'infra/payments-api'
    && source.storagePolicy.scope === 'workspace-private'
    && source.factCount > 0
  ));
  assert.ok(pack.facts.every(fact => fact.kind === 'pulumi-config-parameter'));
  assert.ok(pack.facts.some(fact =>
    fact.path === 'config.payments-api:imageTag'
    && fact.type === 'string'
    && fact.values?.includes('latest')
  ));
  assert.doesNotMatch(JSON.stringify(pack), /"content"\s*:|runtime:\s*yaml|imageTag:\s*latest/);
});

test('knowledge pack includes Helm chart metadata and dependency facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-helm-metadata-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        'dependencies:',
        '  - name: redis',
        '    version: 17.3.0',
        '    repository: https://charts.bitnami.com/bitnami',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'Chart.lock'),
      [
        'dependencies:',
        '  - name: redis',
        '    version: 17.3.1',
        '    repository: https://charts.bitnami.com/bitnami',
        'digest: sha256:abc123',
        'generated: "2026-04-28T00:00:00Z"',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const pack = await buildKnowledgePack(inspection, {
      domains: ['helm'],
      targetPaths: ['charts/api'],
      maxFacts: 8,
      extractedAt: '2026-05-05T00:00:00.000Z'
    });

    assert.equal(pack.kind, 'infra-agent.knowledge-pack');
    assert.equal(pack.mutationAllowed, false);
    assert.ok(pack.sources.some(source =>
      source.kind === 'chart-metadata'
      && source.domain === 'helm'
      && source.targetPath === 'charts/api'
      && source.factCount > 0
    ));
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'chart-metadata'
      && fact.path === 'chart.api.metadata.version'
      && fact.values?.includes('0.2.0')
    ));
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'chart-dependency'
      && fact.path === 'chart.api.dependencies.redis'
      && fact.values?.includes('version=17.3.1')
      && fact.values?.includes('locked=true')
    ));
    assert.doesNotMatch(JSON.stringify(pack), /"content"\s*:|apiVersion:\s*v2|digest:\s*sha256|generated:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
