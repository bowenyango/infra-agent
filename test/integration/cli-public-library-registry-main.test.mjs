import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve
} from 'node:path';
import { captureStdout } from '../support/capture-stdout.mjs';
import { main } from '../../src/cli/main.ts';
import { stagePublicKnowledgeLibraryArtifact } from '../../src/knowledge/public-library-stage.ts';
import {
  buildPublicKnowledgeLibraryArtifact,
  buildPublicKnowledgeUrlReport
} from '../../src/knowledge/url-report.ts';
import { writeKnowledgeCacheEntry } from '../../src/knowledge/cache.ts';

const S3_BUCKET_URL = 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket';
const PULUMI_AWS_BUCKET_URL = 'https://www.pulumi.com/registry/packages/aws/api-docs/s3/bucket/';
const HELM_KUBE_PROMETHEUS_STACK_URL = 'https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack/';
const REMOTE_PUBLIC_LIBRARY_REGISTRY_URL = 'https://knowledge.example.com/public/public-library-registry.json';

const S3_BUCKET_MARKDOWN = [
  '# aws_s3_bucket',
  '',
  'Provides an S3 bucket resource.',
  '',
  '## Basic Usage',
  '',
  '```hcl',
  'resource "aws_s3_bucket" "example" {',
  '  bucket = "example-bucket"',
  '}',
  '```',
  '',
  '#### Arguments',
  '',
  '- `bucket` - (Optional, Forces new resource) Name of the bucket.',
  '- `bucket_prefix` - (Optional, Forces new resource) Creates a unique bucket name beginning with the specified prefix.',
  '- `force_destroy` - (Optional, Default:false) Delete locked objects when the bucket is destroyed.',
  '',
  '## Troubleshooting',
  '',
  '`BucketAlreadyExists` usually means the bucket name conflicts with an existing remote object.',
  '',
  '## Upgrade Workflow',
  '',
  '1. Run terraform plan.',
  '2. Review replacement output before merge.',
  ''
].join('\n');

const PULUMI_AWS_BUCKET_MARKDOWN = [
  '# Bucket',
  '',
  '## Inputs',
  '',
  '| Name | Type | Description |',
  '| --- | --- | --- |',
  '| `bucket` | string | Name of the bucket to create. |',
  '',
  '## Example Usage',
  '',
  '```typescript',
  'const bucket = new aws.s3.Bucket("site", {',
  '  bucket: "site-bucket",',
  '});',
  '```',
  '',
  '## Migration Workflow',
  '',
  '1. Confirm whether the physical bucket name is changing.',
  '2. Run pulumi preview and inspect replacements.',
  '',
  '## Troubleshooting',
  '',
  '`BucketAlreadyExists` usually means another stack or account owns the requested bucket name.',
  ''
].join('\n');

const HELM_KUBE_PROMETHEUS_STACK_MARKDOWN = [
  '# kube-prometheus-stack',
  '',
  'Installs core components of the kube-prometheus stack.',
  '',
  '## Values',
  '',
  '| Key | Type | Default | Description |',
  '| --- | --- | --- | --- |',
  '| `grafana.enabled` | bool | `true` | Whether to deploy Grafana with the chart. |',
  '',
  '## Example Values',
  '',
  '```yaml',
  'grafana:',
  '  enabled: true',
  '```',
  '',
  '## Upgrade Workflow',
  '',
  '1. Render the chart with helm template.',
  '2. Review CRD and ownership changes before merge.',
  '',
  '## Troubleshooting',
  '',
  '`rendered manifests contain a resource that already exists` usually means an object is owned by a different release.',
  ''
].join('\n');

function parseJsonOutput(output) {
  return JSON.parse(output.slice(output.indexOf('{')));
}

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function withMockFetch(routes, action) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const route = routes.get(String(url));
    if (!route) {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: {
          get: () => 'text/plain'
        },
        text: async () => 'not found'
      };
    }

    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: name => name.toLowerCase() === 'content-type' ? route.contentType : null
      },
      text: async () => route.content
    };
  };

  try {
    return await action();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function writePublicLibraryWorkspace(root) {
  await mkdir(join(root, 'terraform/app'), { recursive: true });
  await mkdir(join(root, 'knowledge'), { recursive: true });

  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        publicLibraryRegistries: [
          {
            path: 'knowledge/public-library-registry.json',
            name: 'local-public-library',
            provider: 'hashicorp/aws'
          }
        ]
      }
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

  const contentPath = join(root, 'knowledge/aws_s3_bucket.md');
  const artifactInputPath = join(root, 'knowledge/aws_s3_bucket.library.json');
  await writeFile(contentPath, S3_BUCKET_MARKDOWN, 'utf8');
  const report = await buildPublicKnowledgeUrlReport({
    url: S3_BUCKET_URL,
    contentPath,
    maxUnits: 20,
    now: new Date('2026-05-19T00:00:00.000Z')
  });
  const artifact = buildPublicKnowledgeLibraryArtifact(report);
  await writeFile(artifactInputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  await stagePublicKnowledgeLibraryArtifact({
    workspaceRoot: root,
    artifactPath: artifactInputPath,
    storeDir: 'knowledge/public-library',
    registryPath: 'knowledge/public-library-registry.json',
    createdAt: '2026-05-19T00:00:00.000Z'
  });
}

async function writeRemotePublicLibraryWorkspace(root, registryUrl) {
  await mkdir(join(root, 'terraform/app'), { recursive: true });
  await mkdir(join(root, 'knowledge'), { recursive: true });

  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        publicLibraryRegistries: [
          {
            url: registryUrl,
            name: 'remote-public-library',
            provider: 'hashicorp/aws'
          }
        ]
      }
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
}

async function buildRemotePublicLibraryPayload(root) {
  await mkdir(join(root, 'knowledge'), { recursive: true });
  const contentPath = join(root, 'knowledge/aws_s3_bucket.md');
  await writeFile(contentPath, S3_BUCKET_MARKDOWN, 'utf8');
  const report = await buildPublicKnowledgeUrlReport({
    url: S3_BUCKET_URL,
    contentPath,
    maxUnits: 20,
    now: new Date('2026-05-19T00:00:00.000Z')
  });
  const artifact = buildPublicKnowledgeLibraryArtifact(report);
  const artifactPath = 'artifacts/aws-s3-bucket.public-knowledge-library-artifact.json';
  const artifactContent = JSON.stringify(artifact);
  const { classification } = artifact;
  const registry = {
    kind: 'infra-agent.public-knowledge-library-registry',
    schemaVersion: 1,
    mutationAllowed: false,
    entries: [
      {
        coordinates: artifact.coordinates,
        ecosystem: classification.ecosystem,
        artifactKind: classification.artifactKind,
        providerAddress: classification.providerAddress,
        version: classification.version,
        versionRef: classification.versionRef,
        versionResolution: classification.versionResolution,
        sourceName: classification.sourceName,
        tags: classification.tags,
        artifact: {
          path: artifactPath,
          contentHash: sha256Hex(artifactContent),
          mediaType: 'application/vnd.infra-agent.public-knowledge-library-artifact+json',
          artifactId: artifact.artifactId,
          unitPayloadHash: artifact.unitPayloadHash,
          sourceContentHash: artifact.sourceContentHash,
          unitCount: artifact.summary.unitCount,
          qualityStatus: artifact.quality.status,
          versionRef: classification.versionRef,
          versionResolution: classification.versionResolution,
          reviewRequired: true
        }
      }
    ]
  };

  return {
    artifact,
    artifactPath,
    artifactContent,
    registryContent: JSON.stringify(registry)
  };
}

async function writeTerraformRegistryCache(root) {
  await writeKnowledgeCacheEntry(join(root, '.infra-agent/knowledge-cache'), {
    source: {
      kind: 'terraform-registry',
      name: 'resource:aws_s3_bucket',
      provider: 'hashicorp/aws',
      module: 'terraform/app/main.tf',
      version: '5.37.0',
      url: S3_BUCKET_URL
    },
    contentType: 'text/markdown',
    content: S3_BUCKET_MARKDOWN,
    fetchedAt: '2026-05-19T00:00:00.000Z'
  });
}

async function stagePublicLibraryFixture(root, input) {
  const contentPath = join(root, 'knowledge', input.contentFile);
  const artifactInputPath = join(root, 'knowledge', input.artifactFile);
  await writeFile(contentPath, input.markdown, 'utf8');
  const report = await buildPublicKnowledgeUrlReport({
    url: input.url,
    contentPath,
    maxUnits: 20,
    now: new Date('2026-05-19T00:00:00.000Z')
  });
  const artifact = buildPublicKnowledgeLibraryArtifact(report);
  await writeFile(artifactInputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  await stagePublicKnowledgeLibraryArtifact({
    workspaceRoot: root,
    artifactPath: artifactInputPath,
    storeDir: 'knowledge/public-library',
    registryPath: 'knowledge/public-library-registry.json',
    createdAt: '2026-05-19T00:00:00.000Z'
  });

  return artifact;
}

async function writeMixedPublicLibraryWorkspace(root) {
  await mkdir(join(root, 'pulumi/service'), { recursive: true });
  await mkdir(join(root, 'charts/platform'), { recursive: true });
  await mkdir(join(root, 'knowledge'), { recursive: true });

  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        publicLibraryRegistries: [
          {
            path: 'knowledge/public-library-registry.json',
            name: 'local-public-library'
          }
        ]
      }
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'pulumi/service/Pulumi.yaml'),
    [
      'name: service',
      'runtime: yaml',
      'resources:',
      '  bucket:',
      '    type: aws:s3/bucket:Bucket',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(
    join(root, 'pulumi/service/package.json'),
    `${JSON.stringify({
      dependencies: {
        '@pulumi/aws': '^7.0.0'
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
    join(root, 'charts/platform/values.yaml'),
    ['grafana:', '  enabled: true', ''].join('\n'),
    'utf8'
  );

  await stagePublicLibraryFixture(root, {
    url: PULUMI_AWS_BUCKET_URL,
    contentFile: 'pulumi_aws_bucket.md',
    artifactFile: 'pulumi_aws_bucket.library.json',
    markdown: PULUMI_AWS_BUCKET_MARKDOWN
  });
  await stagePublicLibraryFixture(root, {
    url: HELM_KUBE_PROMETHEUS_STACK_URL,
    contentFile: 'kube-prometheus-stack.md',
    artifactFile: 'kube-prometheus-stack.library.json',
    markdown: HELM_KUBE_PROMETHEUS_STACK_MARKDOWN
  });
}

test('knowledge pack consumes staged public library registry artifacts as public-reference units', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-registry-'));

  try {
    await writePublicLibraryWorkspace(tempRoot);

    const sourcesOutput = await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'terraform',
      '--resource',
      'aws_s3_bucket',
      '--json'
    ]));
    const sourcesReport = parseJsonOutput(sourcesOutput);
    const publicLibrarySource = sourcesReport.sources.find(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    );

    assert.ok(publicLibrarySource);
    assert.equal(publicLibrarySource.domain, 'terraform');
    assert.equal(publicLibrarySource.targetPath, 'terraform/app');
    assert.equal(publicLibrarySource.requiresFetch, false);
    assert.equal(publicLibrarySource.cacheStatus, 'local');
    assert.equal(publicLibrarySource.storagePolicy.scope, 'public-reference');
    assert.equal(publicLibrarySource.storagePolicy.shareableByDefault, true);
    assert.equal(publicLibrarySource.source.name, 'resource:aws_s3_bucket');
    assert.equal(publicLibrarySource.source.provider, 'hashicorp/aws');
    assert.match(publicLibrarySource.source.localPath, /^knowledge\/public-library\/[a-f0-9]{64}\.public-knowledge-library-artifact\.json$/);

    const extractOutput = await captureStdout(() => main([
      'knowledge',
      'extract',
      tempRoot,
      '--domain',
      'terraform',
      '--resource',
      'aws_s3_bucket',
      '--json'
    ]));
    const extraction = parseJsonOutput(extractOutput);
    const extractedSource = extraction.sources.find(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    );
    const unitSet = extraction.unitSets.find(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    );

    assert.equal(extractedSource?.status, 'extracted');
    assert.equal(extractedSource?.factCount, 0);
    assert.ok((extractedSource?.unitCount ?? 0) > 0);
    assert.equal(extractedSource?.unitCount, unitSet?.unitCount);
    assert.deepEqual(
      [...new Set(unitSet?.units.map(unit => unit.unitType))].sort(),
      ['diagnostic', 'example', 'fact', 'guidance', 'recipe']
    );
    assert.ok(unitSet?.units.every(unit => unit.privacyScope === 'public-reference'));

    const packOutput = await captureStdout(() => main([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'terraform',
      '--resource',
      'aws_s3_bucket',
      '--max-units',
      '8',
      '--json'
    ]));
    const pack = parseJsonOutput(packOutput);
    const packedSource = pack.sources.find(source =>
      source.kind === 'public-knowledge-library-artifact'
    );
    const packedUnits = pack.units.filter(unit => unit.sourceId === packedSource?.id);

    assert.ok(packedSource);
    assert.equal(packedSource.storagePolicy.scope, 'public-reference');
    assert.equal(packedSource.storagePolicy.shareableByDefault, true);
    assert.equal(packedSource.kind, 'public-knowledge-library-artifact');
    assert.equal(packedSource.name, 'resource:aws_s3_bucket');
    assert.equal(pack.storagePolicy.publicReference, pack.sourceCount);
    assert.ok(packedUnits.some(unit => unit.unitType === 'fact' && unit.path === 'resource.aws_s3_bucket.bucket'));
    assert.ok(packedUnits.some(unit => unit.unitType === 'guidance'));
    assert.ok(packedUnits.length > 0);
    assert.doesNotMatch(packOutput, /Provides an S3 bucket resource/);
    assert.doesNotMatch(packOutput, /## Troubleshooting/);
    assert.doesNotMatch(packOutput, /```hcl/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack consumes staged Pulumi and Helm public library registry artifacts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-registry-mixed-'));

  try {
    await writeMixedPublicLibraryWorkspace(tempRoot);

    const pulumiSourcesOutput = await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'pulumi',
      '--resource',
      'aws:s3/bucket:Bucket',
      '--json'
    ]));
    const pulumiSources = parseJsonOutput(pulumiSourcesOutput);
    const pulumiPublicSource = pulumiSources.sources.find(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    );

    assert.ok(pulumiPublicSource);
    assert.equal(pulumiPublicSource.domain, 'pulumi');
    assert.equal(pulumiPublicSource.targetPath, 'pulumi/service');
    assert.equal(pulumiPublicSource.requiresFetch, false);
    assert.equal(pulumiPublicSource.cacheStatus, 'local');
    assert.equal(pulumiPublicSource.storagePolicy.scope, 'public-reference');
    assert.equal(pulumiPublicSource.source.name, 'pulumi-docs:resource:aws:s3/bucket');
    assert.equal(pulumiPublicSource.source.packageName, '@pulumi/aws');
    assert.equal(pulumiPublicSource.source.module, 'aws:s3/bucket:Bucket');

    const pulumiPackOutput = await captureStdout(() => main([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'pulumi',
      '--resource',
      'aws:s3/bucket:Bucket',
      '--source',
      pulumiPublicSource.id,
      '--max-units',
      '8',
      '--json'
    ]));
    const pulumiPack = parseJsonOutput(pulumiPackOutput);

    assert.equal(pulumiPack.sourceCount, 1);
    assert.equal(pulumiPack.storagePolicy.publicReference, 1);
    assert.ok(pulumiPack.units.some(unit =>
      unit.unitType === 'fact'
      && unit.path === 'pulumi.resource.aws.s3.bucket.Bucket.bucket'
    ));
    assert.ok(pulumiPack.units.some(unit => unit.unitType === 'recipe'));
    assert.doesNotMatch(pulumiPackOutput, /## Troubleshooting/);
    assert.doesNotMatch(pulumiPackOutput, /```typescript/);

    const helmSourcesOutput = await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'helm',
      '--resource',
      'kube-prometheus-stack',
      '--json'
    ]));
    const helmSources = parseJsonOutput(helmSourcesOutput);
    const helmPublicSource = helmSources.sources.find(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    );

    assert.ok(helmPublicSource);
    assert.equal(helmPublicSource.domain, 'helm');
    assert.equal(helmPublicSource.targetPath, 'charts/platform');
    assert.equal(helmPublicSource.requiresFetch, false);
    assert.equal(helmPublicSource.cacheStatus, 'local');
    assert.equal(helmPublicSource.storagePolicy.scope, 'public-reference');
    assert.equal(helmPublicSource.source.name, 'chart-docs:prometheus-community/kube-prometheus-stack');
    assert.equal(helmPublicSource.source.chart, 'kube-prometheus-stack');

    const helmPackOutput = await captureStdout(() => main([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'helm',
      '--resource',
      'kube-prometheus-stack',
      '--source',
      helmPublicSource.id,
      '--max-units',
      '8',
      '--json'
    ]));
    const helmPack = parseJsonOutput(helmPackOutput);

    assert.equal(helmPack.sourceCount, 1);
    assert.equal(helmPack.storagePolicy.publicReference, 1);
    assert.ok(helmPack.units.some(unit =>
      unit.unitType === 'fact'
      && unit.path === 'chart.kube-prometheus-stack.grafana.enabled'
    ));
    assert.ok(helmPack.units.some(unit => unit.unitType === 'recipe'));
    assert.doesNotMatch(helmPackOutput, /## Troubleshooting/);
    assert.doesNotMatch(helmPackOutput, /```yaml/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge sources ignore public library entries with mismatched ecosystem artifact kind', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-registry-mismatched-kind-'));

  try {
    await writeMixedPublicLibraryWorkspace(tempRoot);

    const registryPath = join(tempRoot, 'knowledge/public-library-registry.json');
    const registry = JSON.parse(await readFile(registryPath, 'utf8'));
    registry.entries[0].artifactKind = 'terraform-provider-resource';
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');

    const pulumiSourcesOutput = await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'pulumi',
      '--resource',
      'aws:s3/bucket:Bucket',
      '--json'
    ]));
    const pulumiSources = parseJsonOutput(pulumiSourcesOutput);

    assert.equal(pulumiSources.sources.some(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    ), false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge CLI prefetches URL public library registries and relative artifacts before reuse', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-registry-url-cli-'));

  try {
    const payload = await buildRemotePublicLibraryPayload(tempRoot);
    const artifactUrl = new URL(payload.artifactPath, REMOTE_PUBLIC_LIBRARY_REGISTRY_URL).toString();
    await writeRemotePublicLibraryWorkspace(tempRoot, REMOTE_PUBLIC_LIBRARY_REGISTRY_URL);
    await writeTerraformRegistryCache(tempRoot);
    const registryValidationPath = join(tempRoot, 'knowledge/remote-public-library-registry.json');
    await writeFile(registryValidationPath, `${JSON.stringify(JSON.parse(payload.registryContent), null, 2)}\n`, 'utf8');

    const registryValidationOutput = await captureStdout(() => main([
      'knowledge',
      'validate',
      registryValidationPath,
      '--json'
    ]));
    const registryValidation = parseJsonOutput(registryValidationOutput);
    assert.equal(registryValidation.inputKind, 'infra-agent.public-knowledge-library-registry');
    assert.equal(registryValidation.valid, true);
    assert.equal(registryValidation.unitCount, payload.artifact.summary.unitCount);

    const beforeSourcesOutput = await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'terraform',
      '--resource',
      'aws_s3_bucket',
      '--json'
    ]));
    const beforeSources = parseJsonOutput(beforeSourcesOutput);
    assert.equal(beforeSources.sources.some(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    ), false);

    const prefetchOutput = await withMockFetch(new Map([
      [
        REMOTE_PUBLIC_LIBRARY_REGISTRY_URL,
        {
          contentType: 'application/json',
          content: payload.registryContent
        }
      ],
      [
        artifactUrl,
        {
          contentType: 'application/json',
          content: payload.artifactContent
        }
      ]
    ]), () => captureStdout(() => main([
      'knowledge',
      'prefetch',
      tempRoot,
      '--domain',
      'terraform',
      '--resource',
      'aws_s3_bucket',
      '--max-sources',
      '8',
      '--json'
    ])));
    const prefetch = parseJsonOutput(prefetchOutput);
    const registryPrefetch = prefetch.sources.find(source =>
      source.source.kind === 'public-knowledge-library-registry'
    );
    const artifactPrefetch = prefetch.sources.find(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    );
    const terraformRegistryPrefetch = prefetch.sources.find(source =>
      source.source.kind === 'terraform-registry'
    );

    assert.equal(registryPrefetch?.status, 'fetched');
    assert.equal(registryPrefetch?.source.url, REMOTE_PUBLIC_LIBRARY_REGISTRY_URL);
    assert.equal(terraformRegistryPrefetch?.status, 'cached');
    assert.equal(artifactPrefetch?.status, 'fetched');
    assert.equal(artifactPrefetch?.domain, 'terraform');
    assert.equal(artifactPrefetch?.targetPath, 'terraform/app');
    assert.equal(artifactPrefetch?.source.name, 'resource:aws_s3_bucket');
    assert.equal(artifactPrefetch?.source.provider, 'hashicorp/aws');
    assert.equal(artifactPrefetch?.source.url, artifactUrl);
    assert.equal(artifactPrefetch?.source.artifactContentHash, sha256Hex(payload.artifactContent));

    const sourcesOutput = await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'terraform',
      '--resource',
      'aws_s3_bucket',
      '--json'
    ]));
    const sourcesReport = parseJsonOutput(sourcesOutput);
    const publicLibrarySource = sourcesReport.sources.find(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    );

    assert.ok(publicLibrarySource);
    assert.equal(publicLibrarySource.requiresFetch, true);
    assert.equal(publicLibrarySource.cacheStatus, 'fresh');
    assert.equal(publicLibrarySource.storagePolicy.scope, 'public-reference');
    assert.equal(publicLibrarySource.source.url, artifactUrl);

    const extractOutput = await captureStdout(() => main([
      'knowledge',
      'extract',
      tempRoot,
      '--domain',
      'terraform',
      '--resource',
      'aws_s3_bucket',
      '--source',
      publicLibrarySource.id,
      '--json'
    ]));
    const extraction = parseJsonOutput(extractOutput);
    const extractedSource = extraction.sources.find(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    );
    const unitSet = extraction.unitSets.find(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    );

    assert.equal(extractedSource?.status, 'extracted');
    assert.ok(unitSet);
    assert.deepEqual(
      [...new Set(unitSet.units.map(unit => unit.unitType))].sort(),
      ['diagnostic', 'example', 'fact', 'guidance', 'recipe']
    );
    assert.ok(unitSet.units.every(unit => unit.privacyScope === 'public-reference'));

    const packOutput = await captureStdout(() => main([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'terraform',
      '--resource',
      'aws_s3_bucket',
      '--source',
      publicLibrarySource.id,
      '--max-units',
      '8',
      '--json'
    ]));
    const pack = parseJsonOutput(packOutput);
    const packedSource = pack.sources.find(source =>
      source.kind === 'public-knowledge-library-artifact'
    );

    assert.ok(packedSource);
    assert.equal(packedSource.storagePolicy.scope, 'public-reference');
    assert.equal(pack.sourceCount, 1);
    assert.equal(pack.storagePolicy.publicReference, 1);
    assert.ok(pack.units.some(unit => unit.unitType === 'fact' && unit.path === 'resource.aws_s3_bucket.bucket'));
    assert.ok(pack.units.some(unit => unit.unitType === 'recipe'));
    assert.doesNotMatch(packOutput, /Provides an S3 bucket resource/);
    assert.doesNotMatch(packOutput, /## Troubleshooting/);
    assert.doesNotMatch(packOutput, /```hcl/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
