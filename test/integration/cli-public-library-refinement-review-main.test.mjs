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
import {
  buildPublicKnowledgeLibraryArtifact,
  buildPublicKnowledgeUrlReport
} from '../../src/knowledge/url-report.ts';

const S3_BUCKET_URL = 'https://registry.terraform.io/providers/hashicorp/aws/5.37.0/docs/resources/s3_bucket';

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

async function buildLibraryArtifact(root) {
  await mkdir(join(root, 'knowledge'), { recursive: true });
  const contentPath = join(root, 'knowledge/aws_s3_bucket.md');
  await writeFile(contentPath, S3_BUCKET_MARKDOWN, 'utf8');
  const report = await buildPublicKnowledgeUrlReport({
    url: S3_BUCKET_URL,
    contentPath,
    maxUnits: 20,
    now: new Date('2026-05-22T00:00:00.000Z')
  });

  return buildPublicKnowledgeLibraryArtifact(report);
}

test('knowledge library-refinement-review emits an offline LLM review packet for a library artifact', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-refinement-review-'));

  try {
    const artifact = await buildLibraryArtifact(tempRoot);
    const artifactPath = join(tempRoot, 'knowledge/aws_s3_bucket.library.json');
    const reportPath = join(tempRoot, 'knowledge/refinement-review.json');
    await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'library-refinement-review',
      artifactPath,
      '--out',
      reportPath,
      '--json'
    ]));
    const report = parseJsonOutput(output);

    assert.equal(report.kind, 'infra-agent.public-knowledge-library-refinement-review');
    assert.equal(report.schemaVersion, 1);
    assert.equal(report.mutationAllowed, false);
    assert.equal(report.executionMode, 'offline-llm-review-input');
    assert.equal(report.inputPath, artifactPath);
    assert.equal(report.outputPath, reportPath);
    assert.equal(report.artifact.coordinates, artifact.coordinates);
    assert.equal(report.artifact.unitPayloadHash, artifact.unitPayloadHash);
    assert.deepEqual(report.artifact.unitCounts, artifact.summary.unitCounts);
    assert.equal(report.classification.providerAddress, 'hashicorp/aws');
    assert.equal(report.review.status, 'not-run');
    assert.equal(report.review.mode, 'offline-review');
    assert.equal(report.review.reviewPacketHash, sha256Hex(JSON.stringify(artifact.llmRefinementInput.reviewPacket)));
    assert.equal(report.review.outputContract, 'infra-agent.public-knowledge-url-report');
    assert.equal(report.review.unitTypeComplete, report.review.missingUnitTypes.length === 0);
    assert.equal(report.llmPrompt.rawContentIncluded, false);
    assert.match(report.llmPrompt.system, /refine public infrastructure knowledge units/);
    assert.match(report.llmPrompt.user, /Coordinates:/);
    assert.deepEqual(report.compactInputs.inputRefs, artifact.llmRefinementInput.inputRefs);
    assert.equal(report.compactInputs.unitsByType.fact.length, artifact.unitsByType.fact.length);

    assert.doesNotMatch(output, /#### Arguments/);
    assert.doesNotMatch(output, /```hcl/);

    const persisted = JSON.parse(await readFile(reportPath, 'utf8'));
    assert.equal(persisted.kind, report.kind);
    assert.equal(persisted.review.reviewPacketHash, report.review.reviewPacketHash);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge library-refinement-review returns validation JSON for malformed artifact input', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-refinement-review-invalid-'));

  try {
    const artifactPath = join(tempRoot, 'bad-library.json');
    await writeFile(artifactPath, '{', 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'library-refinement-review',
      artifactPath,
      '--json'
    ]));
    const report = parseJsonOutput(output);

    assert.equal(report.kind, 'infra-agent.knowledge-validation');
    assert.equal(report.valid, false);
    assert.equal(process.exitCode, 1);
  } finally {
    process.exitCode = undefined;
    await rm(tempRoot, { recursive: true, force: true });
  }
});
