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
import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';

const S3_BUCKET_URL = 'https://registry.terraform.io/providers/hashicorp/aws/5.37.0/docs/resources/s3_bucket';
const INSTANCE_URL = 'https://registry.terraform.io/providers/hashicorp/aws/5.37.0/docs/resources/instance';

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

const INSTANCE_MARKDOWN = [
  '# aws_instance',
  '',
  'Provides an EC2 instance resource.',
  '',
  '## Basic Usage',
  '',
  '```hcl',
  'resource "aws_instance" "example" {',
  '  ami           = "ami-123456"',
  '  instance_type = "t3.micro"',
  '}',
  '```',
  '',
  '#### Arguments',
  '',
  '- `ami` - (Required, Forces new resource) AMI ID.',
  '- `instance_type` - (Required) Instance type.',
  '',
  '## Troubleshooting',
  '',
  '`InvalidAMIID.NotFound` usually means the AMI ID is not available in the selected region.',
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function buildReport(root, url, name, markdown) {
  await mkdir(join(root, 'knowledge'), { recursive: true });
  const contentPath = join(root, `knowledge/${name}.md`);
  await writeFile(contentPath, markdown, 'utf8');

  return buildPublicKnowledgeUrlReport({
    url,
    contentPath,
    maxUnits: 20,
    now: new Date('2026-05-22T00:00:00.000Z')
  });
}

function buildRefinedReport(report) {
  const refined = clone(report);
  refined.unitsByType.fact[0].summary = 'Refined bucket naming fact with clearer provider identity wording.';
  const compactByteLength = JSON.stringify(refined.unitsByType).length;
  refined.summary.compactByteLength = compactByteLength;
  refined.centralLibraryCandidate.llmRefinementInput.reviewPacket.compactByteLength = compactByteLength;

  const validation = validateKnowledgePayload(refined, 'refined-url-report');
  assert.equal(validation.valid, true);

  return refined;
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('knowledge library-refinement-apply writes a validated updated library artifact from a refined URL report', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-refinement-apply-'));

  try {
    const originalReport = await buildReport(tempRoot, S3_BUCKET_URL, 'aws_s3_bucket', S3_BUCKET_MARKDOWN);
    const originalArtifact = buildPublicKnowledgeLibraryArtifact(originalReport);
    const refinedReport = buildRefinedReport(originalReport);
    const originalPath = join(tempRoot, 'knowledge/aws_s3_bucket.library.json');
    const refinedPath = join(tempRoot, 'knowledge/aws_s3_bucket.refined-url-report.json');
    const updatedPath = join(tempRoot, 'knowledge/aws_s3_bucket.updated-library.json');
    await writeJson(originalPath, originalArtifact);
    await writeJson(refinedPath, refinedReport);

    const output = await captureStdout(() => main([
      'knowledge',
      'library-refinement-apply',
      originalPath,
      '--refined',
      refinedPath,
      '--out',
      updatedPath,
      '--json'
    ]));
    const report = parseJsonOutput(output);

    assert.equal(report.kind, 'infra-agent.public-knowledge-library-refinement-apply');
    assert.equal(report.mutationAllowed, true);
    assert.equal(report.executionMode, 'local-artifact-write');
    assert.equal(report.coordinates, originalArtifact.coordinates);
    assert.equal(report.outputPath, updatedPath);
    assert.equal(report.driftChecks.coordinates, 'matched');
    assert.equal(report.driftChecks.sourceContentHash, 'matched');
    assert.equal(report.artifact.previousUnitPayloadHash, originalArtifact.unitPayloadHash);
    assert.notEqual(report.artifact.unitPayloadHash, originalArtifact.unitPayloadHash);
    assert.equal(report.refinement.status, 'applied');
    assert.equal(report.refinement.inputContract, 'infra-agent.public-knowledge-url-report');
    assert.equal(report.refinement.outputArtifactKind, 'infra-agent.public-knowledge-library-artifact');
    assert.equal(report.refinement.unitTypeComplete, report.refinement.missingUnitTypes.length === 0);

    const updatedArtifact = JSON.parse(await readFile(updatedPath, 'utf8'));
    const validation = validateKnowledgePayload(updatedArtifact, updatedPath);
    assert.equal(validation.valid, true);
    assert.equal(validation.inputKind, 'infra-agent.public-knowledge-library-artifact');
    assert.equal(updatedArtifact.artifactId, originalArtifact.artifactId);
    assert.equal(updatedArtifact.coordinates, originalArtifact.coordinates);
    assert.equal(updatedArtifact.sourceContentHash, originalArtifact.sourceContentHash);
    assert.equal(updatedArtifact.unitPayloadHash, report.artifact.unitPayloadHash);
    assert.equal(updatedArtifact.unitsByType.fact[0].summary, 'Refined bucket naming fact with clearer provider identity wording.');
    assert.equal(updatedArtifact.publication.reviewRequired, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge library-refinement-apply rejects refined reports for a different coordinate', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-refinement-apply-drift-'));

  try {
    const originalReport = await buildReport(tempRoot, S3_BUCKET_URL, 'aws_s3_bucket', S3_BUCKET_MARKDOWN);
    const originalArtifact = buildPublicKnowledgeLibraryArtifact(originalReport);
    const mismatchedReport = await buildReport(tempRoot, INSTANCE_URL, 'aws_instance', INSTANCE_MARKDOWN);
    const originalPath = join(tempRoot, 'knowledge/aws_s3_bucket.library.json');
    const refinedPath = join(tempRoot, 'knowledge/aws_instance.refined-url-report.json');
    const updatedPath = join(tempRoot, 'knowledge/aws_s3_bucket.updated-library.json');
    await writeJson(originalPath, originalArtifact);
    await writeJson(refinedPath, mismatchedReport);

    await assert.rejects(
      () => captureStdout(() => main([
        'knowledge',
        'library-refinement-apply',
        originalPath,
        '--refined',
        refinedPath,
        '--out',
        updatedPath,
        '--json'
      ])),
      /coordinates/
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge library-refinement-apply returns validation JSON for raw refined model output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-refinement-apply-raw-'));

  try {
    const originalReport = await buildReport(tempRoot, S3_BUCKET_URL, 'aws_s3_bucket', S3_BUCKET_MARKDOWN);
    const originalArtifact = buildPublicKnowledgeLibraryArtifact(originalReport);
    const rawRefinedReport = {
      ...clone(originalReport),
      rawContent: 'full provider docs should not be accepted'
    };
    const originalPath = join(tempRoot, 'knowledge/aws_s3_bucket.library.json');
    const refinedPath = join(tempRoot, 'knowledge/aws_s3_bucket.raw-refined-url-report.json');
    const updatedPath = join(tempRoot, 'knowledge/aws_s3_bucket.updated-library.json');
    await writeJson(originalPath, originalArtifact);
    await writeJson(refinedPath, rawRefinedReport);

    const output = await captureStdout(() => main([
      'knowledge',
      'library-refinement-apply',
      originalPath,
      '--refined',
      refinedPath,
      '--out',
      updatedPath,
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
