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
import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';

const S3_BUCKET_URL = 'https://registry.terraform.io/providers/hashicorp/aws/5.37.0/docs/resources/s3_bucket';
const REMOTE_ARTIFACT_URL = 'https://knowledge.example.com/public/aws-s3-bucket.public-knowledge-library-artifact.json';
const REMOTE_REGISTRY_URL = 'https://knowledge.example.com/public/public-library-registry.json';
const REMOTE_RELATIVE_ARTIFACT_PATH = 'artifacts/aws-s3-bucket.public-knowledge-library-artifact.json';
const REMOTE_RELATIVE_ARTIFACT_URL = 'https://knowledge.example.com/public/artifacts/aws-s3-bucket.public-knowledge-library-artifact.json';

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

async function buildLibraryArtifact(root) {
  await mkdir(join(root, 'knowledge'), { recursive: true });
  const contentPath = join(root, 'knowledge/aws_s3_bucket.md');
  await writeFile(contentPath, S3_BUCKET_MARKDOWN, 'utf8');
  const report = await buildPublicKnowledgeUrlReport({
    url: S3_BUCKET_URL,
    contentPath,
    maxUnits: 20,
    now: new Date('2026-05-19T00:00:00.000Z')
  });

  return buildPublicKnowledgeLibraryArtifact(report);
}

function registryEntryFromArtifact(artifact, artifactLocation, artifactContent) {
  const { classification } = artifact;

  return {
    coordinates: artifact.coordinates,
    ecosystem: classification.ecosystem,
    artifactKind: classification.artifactKind,
    providerAddress: classification.providerAddress,
    version: classification.version,
    versionRef: classification.versionRef,
    versionResolution: classification.versionResolution,
    sourceName: classification.sourceName,
    tags: classification.tags,
    llmRefinement: {
      status: artifact.llmRefinementInput.status,
      mode: artifact.llmRefinementInput.mode,
      inputRef: 'artifact.llmRefinementInput',
      reviewPacketHash: sha256Hex(JSON.stringify(artifact.llmRefinementInput.reviewPacket)),
      outputContract: artifact.llmRefinementInput.outputContract,
      unitTypes: artifact.llmRefinementInput.unitTypes,
      unitCounts: artifact.summary.unitCounts,
      missingUnitTypes: artifact.llmRefinementInput.reviewPacket.missingUnitTypes,
      qualityStatus: artifact.quality.status,
      qualityScore: artifact.quality.score,
      qualityWarningCount: artifact.quality.warnings.length,
      reviewRequired: true
    },
    artifact: {
      ...artifactLocation,
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
  };
}

function registryPayload(entry) {
  return {
    kind: 'infra-agent.public-knowledge-library-registry',
    schemaVersion: 1,
    mutationAllowed: false,
    entries: [entry]
  };
}

async function readValidatedArtifact(path) {
  const payload = JSON.parse(await readFile(path, 'utf8'));
  const validation = validateKnowledgePayload(payload, path);
  assert.equal(validation.valid, true);
  assert.equal(validation.inputKind, 'infra-agent.public-knowledge-library-artifact');

  return payload;
}

test('knowledge library-download copies a local registry artifact into a content-addressed store', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-download-local-'));

  try {
    const artifact = await buildLibraryArtifact(tempRoot);
    const artifactInputPath = join(tempRoot, 'knowledge/aws_s3_bucket.library.json');
    await writeFile(artifactInputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    await stagePublicKnowledgeLibraryArtifact({
      workspaceRoot: tempRoot,
      artifactPath: artifactInputPath,
      storeDir: 'knowledge/public-library',
      registryPath: 'knowledge/public-library-registry.json',
      createdAt: '2026-05-19T00:00:00.000Z'
    });

    const registryPath = join(tempRoot, 'knowledge/public-library-registry.json');
    const reportPath = join(tempRoot, 'knowledge/download-report.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'library-download',
      registryPath,
      '--coordinate',
      artifact.coordinates,
      '--workspace',
      tempRoot,
      '--store-dir',
      'knowledge/downloaded-public-library',
      '--out',
      reportPath,
      '--json'
    ]));
    const report = parseJsonOutput(output);

    assert.equal(report.kind, 'infra-agent.public-knowledge-library-download');
    assert.equal(report.mutationAllowed, true);
    assert.equal(report.coordinates, artifact.coordinates);
    assert.equal(report.source.locationKind, 'workspace-path');
    assert.equal(report.source.status, 'copied');
    assert.equal(report.source.requiresFetch, false);
    assert.match(report.artifact.registryPath, /^knowledge\/downloaded-public-library\/[a-f0-9]{64}\.public-knowledge-library-artifact\.json$/);
    assert.equal(report.artifact.sha256, report.source.contentHash);
    assert.equal(report.artifact.unitPayloadHash, artifact.unitPayloadHash);
    assert.equal(report.outputPath, reportPath);

    const downloadedArtifact = await readValidatedArtifact(report.artifact.storedPath);
    assert.equal(downloadedArtifact.coordinates, artifact.coordinates);
    assert.equal(downloadedArtifact.unitPayloadHash, artifact.unitPayloadHash);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge library-download fetches a URL artifact and verifies the registry content hash', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-download-url-'));

  try {
    const artifact = await buildLibraryArtifact(tempRoot);
    const artifactContent = `${JSON.stringify(artifact, null, 2)}\n`;
    const registry = registryPayload(registryEntryFromArtifact(
      artifact,
      { url: REMOTE_ARTIFACT_URL },
      artifactContent
    ));
    const registryPath = join(tempRoot, 'knowledge/public-library-registry.json');
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');

    const output = await withMockFetch(new Map([
      [REMOTE_ARTIFACT_URL, {
        contentType: 'application/vnd.infra-agent.public-knowledge-library-artifact+json',
        content: artifactContent
      }]
    ]), () => captureStdout(() => main([
      'knowledge',
      'library-download',
      registryPath,
      '--coordinate',
      artifact.coordinates,
      '--workspace',
      tempRoot,
      '--store-dir',
      'knowledge/downloaded-public-library',
      '--json'
    ])));
    const report = parseJsonOutput(output);

    assert.equal(report.source.locationKind, 'url');
    assert.equal(report.source.status, 'downloaded');
    assert.equal(report.source.requiresFetch, true);
    assert.equal(report.source.url, REMOTE_ARTIFACT_URL);
    assert.equal(report.artifact.sha256, sha256Hex(artifactContent));
    const storedContent = await readFile(report.artifact.storedPath, 'utf8');
    assert.equal(storedContent, artifactContent);
    assert.equal((await readValidatedArtifact(report.artifact.storedPath)).coordinates, artifact.coordinates);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge library-download fetches URL registries and relative artifact paths', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-download-registry-url-'));

  try {
    const artifact = await buildLibraryArtifact(tempRoot);
    const artifactContent = `${JSON.stringify(artifact, null, 2)}\n`;
    const registry = registryPayload(registryEntryFromArtifact(
      artifact,
      { path: REMOTE_RELATIVE_ARTIFACT_PATH },
      artifactContent
    ));
    const registryContent = `${JSON.stringify(registry, null, 2)}\n`;

    const output = await withMockFetch(new Map([
      [REMOTE_REGISTRY_URL, {
        contentType: 'application/vnd.infra-agent.public-knowledge-library-registry+json',
        content: registryContent
      }],
      [REMOTE_RELATIVE_ARTIFACT_URL, {
        contentType: 'application/vnd.infra-agent.public-knowledge-library-artifact+json',
        content: artifactContent
      }]
    ]), () => captureStdout(() => main([
      'knowledge',
      'library-download',
      REMOTE_REGISTRY_URL,
      '--coordinate',
      artifact.coordinates,
      '--workspace',
      tempRoot,
      '--store-dir',
      'knowledge/downloaded-public-library',
      '--json'
    ])));
    const report = parseJsonOutput(output);

    assert.equal(report.registryPath, REMOTE_REGISTRY_URL);
    assert.equal(report.registry.locationKind, 'url');
    assert.equal(report.registry.status, 'downloaded');
    assert.equal(report.registry.contentHash, sha256Hex(registryContent));
    assert.equal(report.source.locationKind, 'url');
    assert.equal(report.source.path, REMOTE_RELATIVE_ARTIFACT_PATH);
    assert.equal(report.source.url, REMOTE_RELATIVE_ARTIFACT_URL);
    assert.equal(report.source.status, 'downloaded');
    assert.equal(report.artifact.sha256, sha256Hex(artifactContent));
    assert.equal((await readValidatedArtifact(report.artifact.storedPath)).coordinates, artifact.coordinates);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge library-download rejects URL artifacts with mismatched content hashes', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-download-hash-'));

  try {
    const artifact = await buildLibraryArtifact(tempRoot);
    const artifactContent = `${JSON.stringify(artifact, null, 2)}\n`;
    const registry = registryPayload({
      ...registryEntryFromArtifact(
        artifact,
        { url: REMOTE_ARTIFACT_URL },
        artifactContent
      ),
      artifact: {
        ...registryEntryFromArtifact(
          artifact,
          { url: REMOTE_ARTIFACT_URL },
          artifactContent
        ).artifact,
        contentHash: '0'.repeat(64)
      }
    });
    const registryPath = join(tempRoot, 'knowledge/public-library-registry.json');
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');

    await withMockFetch(new Map([
      [REMOTE_ARTIFACT_URL, {
        contentType: 'application/vnd.infra-agent.public-knowledge-library-artifact+json',
        content: artifactContent
      }]
    ]), () => assert.rejects(
      () => captureStdout(() => main([
        'knowledge',
        'library-download',
        registryPath,
        '--coordinate',
        artifact.coordinates,
        '--workspace',
        tempRoot,
        '--store-dir',
        'knowledge/downloaded-public-library',
        '--json'
      ])),
      /content hash mismatch/
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
