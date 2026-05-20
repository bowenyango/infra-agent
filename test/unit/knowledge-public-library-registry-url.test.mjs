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
import { buildKnowledgeSourcesReport } from '../../src/knowledge/sources.ts';
import { prefetchWorkspaceKnowledge } from '../../src/knowledge/prefetch.ts';
import { extractWorkspaceKnowledgeFacts } from '../../src/knowledge/extract.ts';
import { buildKnowledgePack } from '../../src/knowledge/pack.ts';
import {
  buildPublicKnowledgeLibraryArtifact,
  buildPublicKnowledgeUrlReport
} from '../../src/knowledge/url-report.ts';

const S3_BUCKET_URL = 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket';
const PUBLIC_REGISTRY_URL = 'https://knowledge.example.com/public/public-library-registry.json';
const PUBLIC_ARTIFACT_URL = 'https://knowledge.example.com/public/aws-s3-bucket.public-knowledge-library-artifact.json';

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

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function writeRemotePublicLibraryWorkspace(root, registryUrl = PUBLIC_REGISTRY_URL) {
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

async function buildPublicLibraryFixture(root, artifactContentHashOverride) {
  const contentPath = join(root, 'knowledge/aws_s3_bucket.md');
  await writeFile(contentPath, S3_BUCKET_MARKDOWN, 'utf8');
  const report = await buildPublicKnowledgeUrlReport({
    url: S3_BUCKET_URL,
    contentPath,
    maxUnits: 20,
    now: new Date('2026-05-19T00:00:00.000Z')
  });
  const artifact = buildPublicKnowledgeLibraryArtifact(report);
  const artifactContent = JSON.stringify(artifact);
  const artifactContentHash = artifactContentHashOverride ?? sha256Hex(artifactContent);
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
          url: PUBLIC_ARTIFACT_URL,
          contentHash: artifactContentHash,
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
    artifactContent,
    registryContent: JSON.stringify(registry)
  };
}

function fixtureFetcher(input) {
  return async source => {
    if (source.kind === 'public-knowledge-library-registry' && source.url === PUBLIC_REGISTRY_URL) {
      return {
        source,
        contentType: 'application/json',
        content: input.registryContent,
        fetchedAt: '2026-05-19T00:00:00.000Z'
      };
    }

    if (source.kind === 'public-knowledge-library-artifact' && source.url === PUBLIC_ARTIFACT_URL) {
      return {
        source,
        contentType: 'application/json',
        content: input.artifactContent,
        fetchedAt: '2026-05-19T00:00:00.000Z'
      };
    }

    if (source.kind === 'terraform-registry' && source.url === S3_BUCKET_URL) {
      return {
        source,
        contentType: 'text/markdown',
        content: S3_BUCKET_MARKDOWN,
        fetchedAt: '2026-05-19T00:00:00.000Z'
      };
    }

    return null;
  };
}

test('URL public library registries prefetch registry and artifact before five-unit extraction', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-registry-url-'));

  try {
    await writeRemotePublicLibraryWorkspace(tempRoot);
    const fixture = await buildPublicLibraryFixture(tempRoot);
    const inspection = await inspectWorkspace(tempRoot);

    const beforePrefetch = await buildKnowledgeSourcesReport(inspection, {
      domains: ['terraform'],
      resource: 'aws_s3_bucket'
    });
    assert.equal(beforePrefetch.sources.some(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    ), false);

    const prefetch = await prefetchWorkspaceKnowledge(inspection, {
      domains: ['terraform'],
      resource: 'aws_s3_bucket',
      maxSources: 8,
      fetcher: fixtureFetcher(fixture),
      now: new Date('2026-05-19T00:00:00.000Z')
    });
    const registrySource = prefetch.sources.find(source =>
      source.source.kind === 'public-knowledge-library-registry'
    );
    const artifactSource = prefetch.sources.find(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    );

    assert.equal(registrySource?.status, 'fetched');
    assert.equal(registrySource?.source.url, PUBLIC_REGISTRY_URL);
    assert.equal(artifactSource?.status, 'fetched');
    assert.equal(artifactSource?.domain, 'terraform');
    assert.equal(artifactSource?.targetPath, 'terraform/app');
    assert.equal(artifactSource?.source.name, 'resource:aws_s3_bucket');
    assert.equal(artifactSource?.source.provider, 'hashicorp/aws');
    assert.equal(artifactSource?.source.url, PUBLIC_ARTIFACT_URL);
    assert.equal(artifactSource?.source.artifactContentHash, sha256Hex(fixture.artifactContent));

    const afterPrefetch = await buildKnowledgeSourcesReport(inspection, {
      domains: ['terraform'],
      resource: 'aws_s3_bucket',
      now: new Date('2026-05-19T00:00:00.000Z')
    });
    const publicLibrarySource = afterPrefetch.sources.find(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    );

    assert.ok(publicLibrarySource);
    assert.equal(publicLibrarySource.requiresFetch, true);
    assert.equal(publicLibrarySource.cacheStatus, 'fresh');
    assert.equal(publicLibrarySource.storagePolicy.scope, 'public-reference');
    assert.equal(publicLibrarySource.storagePolicy.shareableByDefault, true);

    const extraction = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['terraform'],
      resource: 'aws_s3_bucket',
      now: new Date('2026-05-19T00:00:00.000Z'),
      extractedAt: '2026-05-19T00:00:00.000Z'
    });
    const extractedSource = extraction.sources.find(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    );
    const unitSet = extraction.unitSets.find(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    );

    assert.equal(extractedSource?.status, 'extracted');
    assert.ok(unitSet);
    assert.equal(extractedSource?.unitCount, unitSet?.unitCount);
    assert.deepEqual(
      [...new Set(unitSet.units.map(unit => unit.unitType))].sort(),
      ['diagnostic', 'example', 'fact', 'guidance', 'recipe']
    );
    assert.ok(unitSet.units.every(unit => unit.privacyScope === 'public-reference'));

    const pack = await buildKnowledgePack(inspection, {
      domains: ['terraform'],
      resource: 'aws_s3_bucket',
      maxUnits: 10,
      now: new Date('2026-05-19T00:00:00.000Z'),
      extractedAt: '2026-05-19T00:00:00.000Z'
    });
    const packedSource = pack.sources.find(source =>
      source.kind === 'public-knowledge-library-artifact'
    );
    const packedUnits = pack.units.filter(unit => unit.sourceId === packedSource?.id);

    assert.ok(packedSource);
    assert.equal(packedSource.storagePolicy.scope, 'public-reference');
    assert.equal(packedSource.name, 'resource:aws_s3_bucket');
    assert.ok(packedUnits.some(unit => unit.unitType === 'fact' && unit.path === 'resource.aws_s3_bucket.bucket'));
    assert.ok(packedUnits.some(unit => unit.unitType === 'recipe'));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('URL public library registry artifact hashes block drifted downloaded artifacts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-registry-url-drift-'));

  try {
    await writeRemotePublicLibraryWorkspace(tempRoot);
    const fixture = await buildPublicLibraryFixture(tempRoot, 'c'.repeat(64));
    const inspection = await inspectWorkspace(tempRoot);

    await prefetchWorkspaceKnowledge(inspection, {
      domains: ['terraform'],
      resource: 'aws_s3_bucket',
      maxSources: 8,
      fetcher: fixtureFetcher(fixture),
      now: new Date('2026-05-19T00:00:00.000Z')
    });

    const extraction = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['terraform'],
      resource: 'aws_s3_bucket',
      now: new Date('2026-05-19T00:00:00.000Z'),
      extractedAt: '2026-05-19T00:00:00.000Z'
    });
    const driftedSource = extraction.sources.find(source =>
      source.source.kind === 'public-knowledge-library-artifact'
    );

    assert.equal(driftedSource?.status, 'unreadable');
    assert.equal(
      driftedSource?.message,
      'Public knowledge library artifact content hash did not match the registry reference.'
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
