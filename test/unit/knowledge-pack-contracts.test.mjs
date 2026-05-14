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
  assert.ok(pack.unitCount > pack.factCount);
  assert.equal(pack.units.length, pack.includedUnitCount);
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
  assert.ok(pack.facts.every(fact =>
    typeof fact.sourceId === 'string'
    && !('source' in fact)
  ));
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
