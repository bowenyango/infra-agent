import test from 'node:test';
import assert from 'node:assert/strict';
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
import {
  buildPublicKnowledgeLibraryArtifact,
  buildPublicKnowledgeUrlReport
} from '../../src/knowledge/url-report.ts';

const S3_BUCKET_URL = 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket';

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

async function writeLibraryArtifactFixture(tempRoot) {
  const contentPath = join(tempRoot, 'aws_s3_bucket.md');
  const artifactPath = join(tempRoot, 'aws_s3_bucket.library.json');
  await writeFile(contentPath, S3_BUCKET_MARKDOWN, 'utf8');
  const report = await buildPublicKnowledgeUrlReport({
    url: S3_BUCKET_URL,
    contentPath,
    maxUnits: 20,
    now: new Date('2026-05-19T00:00:00.000Z')
  });
  const artifact = buildPublicKnowledgeLibraryArtifact(report);
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

  return {
    artifact,
    artifactPath
  };
}

test('knowledge library-stage stores a public library artifact and updates a downloadable registry', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-stage-'));

  try {
    await mkdir(join(tempRoot, 'reports'), { recursive: true });
    const { artifact, artifactPath } = await writeLibraryArtifactFixture(tempRoot);
    const stageReportPath = join(tempRoot, 'reports/library-stage.json');

    const stageOutput = await captureStdout(() => main([
      'knowledge',
      'library-stage',
      artifactPath,
      '--workspace',
      tempRoot,
      '--store-dir',
      'knowledge/public-library',
      '--registry',
      'knowledge/public-library-registry.json',
      '--out',
      stageReportPath,
      '--json'
    ]));
    const stageReport = parseJsonOutput(stageOutput);

    assert.equal(stageReport.kind, 'infra-agent.public-knowledge-library-stage');
    assert.equal(stageReport.mutationAllowed, true);
    assert.equal(stageReport.executionMode, 'local-file-store');
    assert.equal(stageReport.artifact.coordinates, artifact.coordinates);
    assert.equal(stageReport.artifact.unitPayloadHash, artifact.unitPayloadHash);
    assert.equal(stageReport.artifact.sourceContentHash, artifact.sourceContentHash);
    assert.equal(stageReport.artifact.unitCount, artifact.summary.unitCount);
    assert.equal(stageReport.artifact.qualityStatus, 'ready');
    assert.match(stageReport.artifact.registryPath, /^knowledge\/public-library\/[a-f0-9]{64}\.public-knowledge-library-artifact\.json$/);
    assert.equal(stageReport.entry.coordinates, artifact.coordinates);
    assert.equal(stageReport.entry.artifact.contentHash, stageReport.artifact.sha256);
    assert.equal(stageReport.entry.artifact.mediaType, 'application/vnd.infra-agent.public-knowledge-library-artifact+json');
    assert.equal(stageReport.entry.artifact.reviewRequired, true);
    assert.equal(stageReport.entry.download.mode, 'local-content');
    assert.equal(stageReport.registry.entryCount, 1);
    assert.equal(stageReport.registry.updatedExistingEntry, false);
    assert.equal(stageReport.outputPath, stageReportPath);
    assert.ok(stageReport.warnings.some(warning => /review-required/.test(warning)));

    const storedArtifact = JSON.parse(await readFile(stageReport.artifact.storedPath, 'utf8'));
    assert.equal(storedArtifact.kind, 'infra-agent.public-knowledge-library-artifact');
    assert.equal(storedArtifact.coordinates, artifact.coordinates);
    assert.equal(storedArtifact.unitPayloadHash, artifact.unitPayloadHash);

    const registry = JSON.parse(await readFile(join(tempRoot, 'knowledge/public-library-registry.json'), 'utf8'));
    assert.equal(registry.kind, 'infra-agent.public-knowledge-library-registry');
    assert.equal(registry.mutationAllowed, false);
    assert.equal(registry.entries.length, 1);
    assert.equal(registry.entries[0].coordinates, artifact.coordinates);
    assert.equal(registry.entries[0].artifact.path, stageReport.artifact.registryPath);
    assert.equal(registry.entries[0].artifact.contentHash, stageReport.artifact.sha256);

    const validationOutput = await captureStdout(() => main([
      'knowledge',
      'validate',
      stageReport.artifact.storedPath,
      '--json'
    ]));
    const validation = parseJsonOutput(validationOutput);
    assert.equal(validation.inputKind, 'infra-agent.public-knowledge-library-artifact');
    assert.equal(validation.valid, true);

    const secondStageOutput = await captureStdout(() => main([
      'knowledge',
      'library-stage',
      artifactPath,
      '--workspace',
      tempRoot,
      '--store-dir',
      'knowledge/public-library',
      '--registry',
      'knowledge/public-library-registry.json',
      '--json'
    ]));
    const secondStageReport = parseJsonOutput(secondStageOutput);
    assert.equal(secondStageReport.registry.entryCount, 1);
    assert.equal(secondStageReport.registry.updatedExistingEntry, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge library-stage refuses to overwrite a malformed public registry', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-stage-bad-registry-'));

  try {
    await mkdir(join(tempRoot, 'knowledge'), { recursive: true });
    const { artifactPath } = await writeLibraryArtifactFixture(tempRoot);
    const registryPath = join(tempRoot, 'knowledge/public-library-registry.json');
    await writeFile(registryPath, '{', 'utf8');

    await assert.rejects(
      async () => captureStdout(() => main([
        'knowledge',
        'library-stage',
        artifactPath,
        '--workspace',
        tempRoot,
        '--store-dir',
        'knowledge/public-library',
        '--registry',
        'knowledge/public-library-registry.json',
        '--json'
      ])),
      /Public knowledge library registry could not be loaded/
    );

    assert.equal(await readFile(registryPath, 'utf8'), '{');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
