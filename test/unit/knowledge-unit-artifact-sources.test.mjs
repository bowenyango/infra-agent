import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { buildKnowledgeCacheId } from '../../src/knowledge/cache.ts';
import { buildKnowledgeSourcesReport } from '../../src/knowledge/sources.ts';
import { prefetchWorkspaceKnowledge } from '../../src/knowledge/prefetch.ts';
import { extractWorkspaceKnowledgeFacts } from '../../src/knowledge/extract.ts';
import { buildKnowledgePack } from '../../src/knowledge/pack.ts';
import { validateKnowledgePayloadWithLocalSources } from '../../src/knowledge/validate.ts';

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

function registrySourceFixture() {
  return {
    kind: 'terraform-registry',
    name: 'resource:aws_s3_bucket',
    provider: 'hashicorp/aws',
    version: '5.37.0',
    url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket'
  };
}

function unitArtifactPayload() {
  const source = registrySourceFixture();
  const sourceId = buildKnowledgeCacheId(source);
  const sourceContentHash = 'b'.repeat(64);
  const sourceRef = {
    id: sourceId,
    source,
    contentHash: sourceContentHash,
    locator: 'Terraform Registry: aws_s3_bucket'
  };

  return {
    kind: 'infra-agent.knowledge-units',
    schemaVersion: 1,
    mutationAllowed: false,
    sourceId,
    source,
    sourceContentHash,
    extractedAt: '2026-05-12T00:00:00.000Z',
    unitCount: 3,
    units: [
      {
        unitType: 'fact',
        factKind: 'identity-field',
        path: 'resource.aws_s3_bucket.bucket',
        summary: 'The bucket argument participates in the remote S3 bucket identity.',
        confidence: 'high',
        extractionMethod: 'terraform-registry-markdown',
        source: sourceRef,
        privacyScope: 'public-reference',
        values: ['bucket'],
        type: 'string'
      },
      {
        unitType: 'guidance',
        path: 'guidance.terraform.logical-rename',
        summary: 'Use a Terraform moved block when only the logical resource address changes.',
        confidence: 'high',
        extractionMethod: 'official-guidance',
        source: sourceRef,
        privacyScope: 'public-reference',
        topic: 'terraform-logical-rename',
        appliesWhen: ['resource address changes', 'remote identity remains the same'],
        risk: 'Without a moved block, Terraform can plan replacement instead of state movement.'
      },
      {
        unitType: 'example',
        path: 'example.terraform.moved-block',
        summary: 'Minimal moved block for a Terraform resource rename.',
        confidence: 'medium',
        extractionMethod: 'official-example',
        source: sourceRef,
        privacyScope: 'public-reference',
        exampleType: 'terraform-moved-block',
        language: 'hcl',
        snippet: 'moved { from = aws_s3_bucket.old to = aws_s3_bucket.api }'
      }
    ]
  };
}

function unitArtifactRegistryPayload(options = {}) {
  const contentHash = options.contentHash ?? sha256Hex(JSON.stringify(unitArtifactPayload()));

  return {
    kind: 'infra-agent.knowledge-unit-registry',
    schemaVersion: 1,
    mutationAllowed: false,
    entries: [
      {
        domain: 'terraform',
        artifact: {
          url: 'https://knowledge.example.com/public/aws-s3-bucket.units.json',
          name: 'aws-s3-bucket-prebuilt-units-from-registry',
          version: '2026-05-12',
          contentHash
        }
      }
    ]
  };
}

async function writeWorkspace(root) {
  await mkdir(join(root, 'terraform/app'), { recursive: true });
  await mkdir(join(root, 'knowledge'), { recursive: true });
  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        unitArtifacts: [
          {
            domain: 'terraform',
            targetPath: 'terraform/app',
            path: 'knowledge/aws-s3-bucket.units.json',
            name: 'aws-s3-bucket-prebuilt-units',
            version: '2026-05-12'
          }
        ]
      }
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'terraform/app/main.tf'),
    [
      'resource "aws_s3_bucket" "api" {',
      '  bucket = "example-api"',
      '}',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(
    join(root, 'knowledge/aws-s3-bucket.units.json'),
    `${JSON.stringify(unitArtifactPayload(), null, 2)}\n`,
    'utf8'
  );
}

async function writeUrlArtifactWorkspace(root) {
  await mkdir(join(root, 'terraform/app'), { recursive: true });
  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        unitArtifacts: [
          {
            domain: 'terraform',
            targetPath: 'terraform/app',
            url: 'https://knowledge.example.com/public/aws-s3-bucket.units.json',
            name: 'aws-s3-bucket-prebuilt-units-url',
            version: '2026-05-12'
          }
        ]
      }
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'terraform/app/main.tf'),
    [
      'resource "aws_s3_bucket" "api" {',
      '  bucket = "example-api"',
      '}',
      ''
    ].join('\n'),
    'utf8'
  );
}

async function writeRegistryWorkspace(root) {
  await mkdir(join(root, 'terraform/app'), { recursive: true });
  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        unitArtifactRegistries: [
          {
            url: 'https://knowledge.example.com/public/registry.json',
            name: 'public-prebuilt-unit-registry',
            version: '2026-05-12'
          }
        ]
      }
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'terraform/app/main.tf'),
    [
      'resource "aws_s3_bucket" "api" {',
      '  bucket = "example-api"',
      '}',
      ''
    ].join('\n'),
    'utf8'
  );
}

async function writeRegistrySelectorWorkspace(root) {
  await mkdir(join(root, 'terraform/app'), { recursive: true });
  await mkdir(join(root, 'pulumi/service'), { recursive: true });
  await mkdir(join(root, 'charts/platform'), { recursive: true });
  await mkdir(join(root, 'charts/nginx'), { recursive: true });
  await mkdir(join(root, 'knowledge'), { recursive: true });
  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        unitArtifactRegistries: [
          {
            path: 'knowledge/registry.json',
            name: 'multi-domain-unit-registry'
          }
        ]
      }
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'knowledge/registry.json'),
    `${JSON.stringify({
      kind: 'infra-agent.knowledge-unit-registry',
      schemaVersion: 1,
      mutationAllowed: false,
      entries: [
        {
          domain: 'terraform',
          targetPath: 'terraform/app',
          provider: 'hashicorp/aws',
          artifact: {
            path: 'knowledge/tf-aws.units.json',
            name: 'terraform-aws-units'
          }
        },
        {
          domain: 'terraform',
          targetPath: 'terraform/app',
          provider: 'hashicorp/google',
          artifact: {
            path: 'knowledge/tf-google.units.json',
            name: 'terraform-google-units'
          }
        },
        {
          domain: 'pulumi',
          targetPath: 'pulumi/service',
          packageName: '@pulumi/aws',
          artifact: {
            path: 'knowledge/pulumi-aws.units.json',
            name: 'pulumi-aws-units'
          }
        },
        {
          domain: 'pulumi',
          targetPath: 'pulumi/service',
          packageName: '@pulumi/kubernetes',
          artifact: {
            path: 'knowledge/pulumi-kubernetes.units.json',
            name: 'pulumi-kubernetes-units'
          }
        },
        {
          domain: 'helm',
          targetPath: 'charts/platform',
          chart: 'kube-prometheus-stack',
          artifact: {
            path: 'knowledge/kube-prometheus-stack.units.json',
            name: 'helm-kube-prometheus-stack-units'
          }
        },
        {
          domain: 'helm',
          targetPath: 'charts/nginx',
          chart: 'nginx',
          artifact: {
            path: 'knowledge/nginx.units.json',
            name: 'helm-nginx-units'
          }
        }
      ]
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'terraform/app/main.tf'),
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
      'resource "aws_s3_bucket" "api" {',
      '  bucket = "example-api"',
      '}',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(
    join(root, 'pulumi/service/Pulumi.yaml'),
    ['name: service', 'runtime: nodejs', ''].join('\n'),
    'utf8'
  );
  await writeFile(
    join(root, 'pulumi/service/package.json'),
    `${JSON.stringify({
      dependencies: {
        '@pulumi/aws': '^6.0.0'
      }
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'charts/platform/Chart.yaml'),
    ['apiVersion: v2', 'name: kube-prometheus-stack', 'version: 1.0.0', ''].join('\n'),
    'utf8'
  );
  await writeFile(
    join(root, 'charts/nginx/Chart.yaml'),
    ['apiVersion: v2', 'name: nginx', 'version: 1.0.0', ''].join('\n'),
    'utf8'
  );
}

async function writeRegistryDefaultMetadataWorkspace(root) {
  await mkdir(join(root, 'terraform/aws'), { recursive: true });
  await mkdir(join(root, 'terraform/google'), { recursive: true });
  await mkdir(join(root, 'knowledge'), { recursive: true });
  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        unitArtifactRegistries: [
          {
            path: 'knowledge/default-registry.json',
            name: 'default-metadata-registry',
            provider: 'hashicorp/aws',
            packageName: '@pulumi/aws',
            chart: 'kube-prometheus-stack',
            module: 'default-module'
          }
        ]
      }
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'knowledge/default-registry.json'),
    `${JSON.stringify({
      kind: 'infra-agent.knowledge-unit-registry',
      schemaVersion: 1,
      mutationAllowed: false,
      entries: [
        {
          domain: 'terraform',
          targetPath: 'terraform/aws',
          artifact: {
            path: 'knowledge/shared.units.json',
            name: 'inherited-default-metadata-units'
          }
        },
        {
          domain: 'terraform',
          targetPath: 'terraform/google',
          provider: 'hashicorp/google',
          packageName: '@pulumi/kubernetes',
          chart: 'nginx',
          module: 'override-module',
          artifact: {
            path: 'knowledge/shared.units.json',
            name: 'override-metadata-units'
          }
        }
      ]
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'terraform/aws/main.tf'),
    [
      'terraform {',
      '  required_providers {',
      '    aws = { source = "hashicorp/aws" }',
      '  }',
      '}',
      'resource "aws_s3_bucket" "api" {',
      '  bucket = "example-api"',
      '}',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(
    join(root, 'terraform/google/main.tf'),
    [
      'terraform {',
      '  required_providers {',
      '    google = { source = "hashicorp/google" }',
      '  }',
      '}',
      'resource "google_compute_network" "api" {',
      '  name = "api"',
      '}',
      ''
    ].join('\n'),
    'utf8'
  );
}

test('configured prebuilt knowledge unit artifacts are listed as local sources', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-unit-artifact-source-'));

  try {
    await writeWorkspace(tempRoot);
    const inspection = await inspectWorkspace(tempRoot);
    const report = await buildKnowledgeSourcesReport(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app']
    });
    const source = report.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');

    assert.ok(source);
    assert.equal(source.domain, 'terraform');
    assert.equal(source.targetPath, 'terraform/app');
    assert.equal(source.source.localPath, 'knowledge/aws-s3-bucket.units.json');
    assert.equal(source.requiresFetch, false);
    assert.equal(source.cacheStatus, 'local');
    assert.equal(source.storagePolicy.scope, 'workspace-private');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('registry metadata selectors choose matching artifacts across Terraform, Pulumi, and Helm targets', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-unit-artifact-selector-'));

  try {
    await writeRegistrySelectorWorkspace(tempRoot);
    const inspection = await inspectWorkspace(tempRoot);
    const report = await buildKnowledgeSourcesReport(inspection, {
      domains: ['terraform', 'pulumi', 'helm'],
      targetPaths: ['terraform/app', 'pulumi/service', 'charts/platform']
    });
    const artifacts = report.sources
      .filter(entry => entry.source.kind === 'knowledge-unit-artifact')
      .map(entry => ({
        domain: entry.domain,
        targetPath: entry.targetPath,
        name: entry.source.name,
        provider: entry.source.provider,
        packageName: entry.source.packageName,
        chart: entry.source.chart
      }))
      .sort((left, right) => left.name.localeCompare(right.name));

    assert.deepEqual(artifacts, [
      {
        domain: 'helm',
        targetPath: 'charts/platform',
        name: 'helm-kube-prometheus-stack-units',
        provider: undefined,
        packageName: undefined,
        chart: 'kube-prometheus-stack'
      },
      {
        domain: 'pulumi',
        targetPath: 'pulumi/service',
        name: 'pulumi-aws-units',
        provider: undefined,
        packageName: '@pulumi/aws',
        chart: undefined
      },
      {
        domain: 'terraform',
        targetPath: 'terraform/app',
        name: 'terraform-aws-units',
        provider: 'hashicorp/aws',
        packageName: undefined,
        chart: undefined
      }
    ]);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('registry default metadata is inherited, entry metadata overrides it, and artifact source ids include metadata', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-unit-artifact-default-selector-'));

  try {
    await writeRegistryDefaultMetadataWorkspace(tempRoot);
    const inspection = await inspectWorkspace(tempRoot);
    const report = await buildKnowledgeSourcesReport(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/aws', 'terraform/google']
    });
    const inherited = report.sources.find(entry => entry.source.name === 'inherited-default-metadata-units');
    const override = report.sources.find(entry => entry.source.name === 'override-metadata-units');

    assert.ok(inherited);
    assert.ok(override);
    assert.equal(inherited?.source.provider, 'hashicorp/aws');
    assert.equal(inherited?.source.packageName, '@pulumi/aws');
    assert.equal(inherited?.source.chart, 'kube-prometheus-stack');
    assert.equal(inherited?.source.module, 'default-module');
    assert.equal(override?.source.provider, 'hashicorp/google');
    assert.equal(override?.source.packageName, '@pulumi/kubernetes');
    assert.equal(override?.source.chart, 'nginx');
    assert.equal(override?.source.module, 'override-module');
    assert.notEqual(inherited?.id, override?.id);
    assert.notEqual(
      buildKnowledgeCacheId(inherited.source),
      buildKnowledgeCacheId({
        ...inherited.source,
        provider: 'hashicorp/google'
      })
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('configured URL knowledge unit registries prefetch then discover matching artifacts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-unit-artifact-registry-'));

  try {
    await writeRegistryWorkspace(tempRoot);
    const inspection = await inspectWorkspace(tempRoot);
    const beforePrefetch = await buildKnowledgeSourcesReport(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app']
    });

    assert.ok(!beforePrefetch.sources.some(entry => entry.source.kind === 'knowledge-unit-artifact'));

    const prefetch = await prefetchWorkspaceKnowledge(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      maxSources: 3,
      fetcher: async fetchedSource => {
        if (fetchedSource.kind === 'knowledge-unit-registry') {
          return {
            source: fetchedSource,
            contentType: 'application/json',
            content: JSON.stringify(unitArtifactRegistryPayload()),
            fetchedAt: '2026-05-12T00:00:00.000Z',
            staleAfter: '2026-06-12T00:00:00.000Z'
          };
        }

        if (fetchedSource.kind === 'knowledge-unit-artifact') {
          return {
            source: fetchedSource,
            contentType: 'application/json',
            content: JSON.stringify(unitArtifactPayload()),
            fetchedAt: '2026-05-12T00:00:00.000Z',
            staleAfter: '2026-06-12T00:00:00.000Z'
          };
        }

        return null;
      }
    });
    const registry = prefetch.sources.find(entry => entry.source.kind === 'knowledge-unit-registry');
    const artifact = prefetch.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');

    assert.equal(registry?.status, 'fetched');
    assert.equal(artifact?.status, 'fetched');
    assert.equal(artifact?.targetPath, 'terraform/app');
    assert.equal(artifact?.source.name, 'aws-s3-bucket-prebuilt-units-from-registry');

    const afterPrefetch = await buildKnowledgeSourcesReport(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app']
    });
    const discoveredArtifact = afterPrefetch.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');

    assert.equal(discoveredArtifact?.requiresFetch, true);
    assert.equal(discoveredArtifact?.cacheStatus, 'fresh');

    const extraction = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      extractedAt: '2026-05-12T00:00:00.000Z'
    });
    const extractedSource = extraction.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');

    assert.equal(extractedSource?.status, 'extracted');
    assert.equal(extractedSource?.unitCount, 3);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('configured registry artifact hashes reject drifted unit payloads', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-unit-artifact-registry-hash-'));

  try {
    await writeRegistryWorkspace(tempRoot);
    const inspection = await inspectWorkspace(tempRoot);

    await prefetchWorkspaceKnowledge(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      maxSources: 3,
      fetcher: async fetchedSource => {
        if (fetchedSource.kind === 'knowledge-unit-registry') {
          return {
            source: fetchedSource,
            contentType: 'application/json',
            content: JSON.stringify(unitArtifactRegistryPayload({ contentHash: 'e'.repeat(64) })),
            fetchedAt: '2026-05-12T00:00:00.000Z',
            staleAfter: '2026-06-12T00:00:00.000Z'
          };
        }

        if (fetchedSource.kind === 'knowledge-unit-artifact') {
          return {
            source: fetchedSource,
            contentType: 'application/json',
            content: JSON.stringify(unitArtifactPayload()),
            fetchedAt: '2026-05-12T00:00:00.000Z',
            staleAfter: '2026-06-12T00:00:00.000Z'
          };
        }

        return null;
      }
    });

    const extraction = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      extractedAt: '2026-05-12T00:00:00.000Z'
    });
    const extractedSource = extraction.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');

    assert.equal(extractedSource?.status, 'unreadable');
    assert.match(extractedSource?.message ?? '', /content hash/);
    assert.equal(extraction.unitCount, 0);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('configured URL knowledge unit artifacts prefetch then extract through the same unit pipeline', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-unit-artifact-url-'));

  try {
    await writeUrlArtifactWorkspace(tempRoot);
    const inspection = await inspectWorkspace(tempRoot);
    const beforePrefetch = await buildKnowledgeSourcesReport(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app']
    });
    const source = beforePrefetch.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');

    assert.ok(source);
    assert.equal(source.source.url, 'https://knowledge.example.com/public/aws-s3-bucket.units.json');
    assert.equal(source.requiresFetch, true);
    assert.equal(source.cacheStatus, 'missing');

    const prefetch = await prefetchWorkspaceKnowledge(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      fetcher: async fetchedSource => ({
        source: fetchedSource,
        contentType: 'application/json',
        content: JSON.stringify(unitArtifactPayload()),
        fetchedAt: '2026-05-12T00:00:00.000Z',
        staleAfter: '2026-06-12T00:00:00.000Z'
      })
    });
    const fetched = prefetch.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');

    assert.equal(fetched?.status, 'fetched');
    assert.equal(fetched?.previousCacheStatus, 'missing');
    assert.equal(fetched?.contentType, 'application/json');

    const extraction = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      extractedAt: '2026-05-12T00:00:00.000Z'
    });
    const extractedSource = extraction.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');
    const unitSet = extraction.unitSets.find(entry => entry.source.kind === 'knowledge-unit-artifact');

    assert.equal(extractedSource?.status, 'extracted');
    assert.equal(extractedSource?.unitCount, 3);
    assert.equal(unitSet?.unitCount, 3);
    assert.ok(unitSet?.units.every(unit => unit.source.source.url === source.source.url));

    const pack = await buildKnowledgePack(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      maxUnits: 2,
      extractedAt: '2026-05-12T00:00:00.000Z'
    });

    assert.equal(pack.unitCount, 3);
    assert.ok(pack.units.some(unit =>
      unit.unitType === 'guidance'
      && unit.topic === 'terraform-logical-rename'
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('prebuilt knowledge unit artifacts extract and pack as compact units', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-unit-artifact-pack-'));

  try {
    await writeWorkspace(tempRoot);
    const inspection = await inspectWorkspace(tempRoot);
    const extraction = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      extractedAt: '2026-05-12T00:00:00.000Z'
    });
    const source = extraction.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');
    const factSet = extraction.factSets.find(entry => entry.source.kind === 'knowledge-unit-artifact');
    const unitSet = extraction.unitSets.find(entry => entry.source.kind === 'knowledge-unit-artifact');
    const extractionValidation = await validateKnowledgePayloadWithLocalSources(extraction, 'inline', {
      workspaceRoot: tempRoot
    });

    assert.equal(source?.status, 'extracted');
    assert.equal(source?.factCount, 0);
    assert.equal(source?.unitCount, 3);
    assert.equal(factSet?.factCount, 0);
    assert.equal(unitSet?.unitCount, 3);
    assert.equal(unitSet?.source.kind, 'knowledge-unit-artifact');
    assert.ok(unitSet?.units.every(unit => unit.source.id === unitSet.sourceId));
    assert.ok(unitSet?.units.every(unit => unit.source.contentHash === unitSet.sourceContentHash));
    assert.equal(extractionValidation.valid, true);

    const pack = await buildKnowledgePack(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      maxUnits: 2,
      extractedAt: '2026-05-12T00:00:00.000Z'
    });
    const packValidation = await validateKnowledgePayloadWithLocalSources(pack, 'inline', {
      workspaceRoot: tempRoot
    });

    assert.ok(pack.sources.some(packSource =>
      packSource.kind === 'knowledge-unit-artifact'
      && packSource.factCount === 0
      && packSource.freshness === 'fresh'
    ));
    assert.equal(pack.factCount, 0);
    assert.equal(pack.unitCount, 3);
    assert.equal(pack.includedUnitCount, 2);
    assert.equal(pack.omittedUnitCount, 1);
    assert.ok(pack.units.some(unit =>
      unit.unitType === 'guidance'
      && unit.topic === 'terraform-logical-rename'
      && unit.privacyScope === 'public-reference'
    ));
    assert.equal(packValidation.valid, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
