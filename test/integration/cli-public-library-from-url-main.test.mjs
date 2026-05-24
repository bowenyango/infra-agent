import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
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
  '## Attribute Reference',
  '',
  '- `arn` - ARN of the bucket.',
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256(content) {
  return createHash('sha256')
    .update(content)
    .digest('hex');
}

function validateArtifact(payload) {
  const validation = validateKnowledgePayload(payload, 'public-library-from-url-artifact');
  assert.equal(validation.valid, true);
  assert.equal(validation.inputKind, 'infra-agent.public-knowledge-library-artifact');
}

function validateRegistry(payload) {
  const validation = validateKnowledgePayload(payload, 'public-library-from-url-registry');
  assert.equal(validation.valid, true);
  assert.equal(validation.inputKind, 'infra-agent.public-knowledge-library-registry');
}

function refinedReportFrom(report) {
  const refined = clone(report);
  refined.unitsByType.fact[0].summary = 'Refined S3 bucket fact for downloadable central library reuse.';
  const compactByteLength = JSON.stringify(refined.unitsByType).length;
  refined.summary.compactByteLength = compactByteLength;
  refined.centralLibraryCandidate.llmRefinementInput.reviewPacket.compactByteLength = compactByteLength;

  const validation = validateKnowledgePayload(refined, 'refined-url-report');
  assert.equal(validation.valid, true);

  return refined;
}

test('knowledge library-from-url writes a validated central-library artifact and report', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-from-url-cli-'));

  try {
    const contentPath = join(tempRoot, 'aws_s3_bucket.md');
    const libraryPath = join(tempRoot, 'artifacts/aws_s3_bucket.library.json');
    const reportPath = join(tempRoot, 'artifacts/aws_s3_bucket.library-build.json');
    await writeFile(contentPath, S3_BUCKET_MARKDOWN, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'library-from-url',
      S3_BUCKET_URL,
      '--content',
      contentPath,
      '--max-units',
      '20',
      '--library-out',
      libraryPath,
      '--out',
      reportPath,
      '--json'
    ]));
    const report = parseJsonOutput(output);
    const writtenReport = JSON.parse(await readFile(reportPath, 'utf8'));
    const artifact = JSON.parse(await readFile(libraryPath, 'utf8'));

    validateArtifact(artifact);
    assert.equal(report.kind, 'infra-agent.public-knowledge-library-build');
    assert.equal(report.mutationAllowed, true);
    assert.equal(report.executionMode, 'deterministic');
    assert.equal(report.sourceUrl, S3_BUCKET_URL);
    assert.equal(report.libraryOutputPath, libraryPath);
    assert.equal(report.outputPath, reportPath);
    assert.equal(report.coordinates, artifact.coordinates);
    assert.equal(report.classification.ecosystem, 'terraform');
    assert.equal(report.classification.providerAddress, 'hashicorp/aws');
    assert.equal(report.download.strategy, 'local-content-fixture');
    assert.equal(report.refinement.enabled, false);
    assert.equal(report.validation.valid, true);
    assert.equal(writtenReport.libraryOutputPath, libraryPath);
    assert.equal(artifact.coordinates, 'terraform/provider/hashicorp/aws/5.37.0/resource/aws_s3_bucket');
    assert.equal(artifact.quality.status, 'ready');
    assert.equal(artifact.summary.includedUnitTypes.length, 5);
    assert.doesNotMatch(JSON.stringify(report), /#### Arguments|test-api-key/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge library-from-url refines with a model response and stages the final artifact', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-from-url-refine-cli-'));
  const previousInfraAgentKey = process.env.INFRA_AGENT_OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;

  try {
    const workspace = join(tempRoot, 'workspace');
    const contentPath = join(tempRoot, 'aws_s3_bucket.md');
    const libraryPath = join(tempRoot, 'artifacts/aws_s3_bucket.library.json');
    const refinedPath = join(tempRoot, 'artifacts/aws_s3_bucket.refined-url-report.json');
    const reportPath = join(tempRoot, 'artifacts/aws_s3_bucket.library-build.json');
    await writeFile(contentPath, S3_BUCKET_MARKDOWN, 'utf8');
    const initialReport = await buildPublicKnowledgeUrlReport({
      url: S3_BUCKET_URL,
      contentPath,
      maxUnits: 20
    });
    const initialArtifact = buildPublicKnowledgeLibraryArtifact(initialReport);
    const refinedReport = refinedReportFrom(initialReport);
    const captured = {
      authorization: '',
      body: null
    };
    globalThis.fetch = async (_url, init) => {
      captured.authorization = init?.headers?.authorization ?? '';
      captured.body = JSON.parse(String(init?.body));

      return new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify(refinedReport)
            }
          }
        ]
      }), {
        status: 200
      });
    };

    process.env.INFRA_AGENT_OPENAI_API_KEY = 'test-api-key';
    const output = await captureStdout(() => main([
      'knowledge',
      'library-from-url',
      S3_BUCKET_URL,
      '--content',
      contentPath,
      '--max-units',
      '20',
      '--library-out',
      libraryPath,
      '--refine',
      '--refined-out',
      refinedPath,
      '--model',
      'test-library-builder-model',
      '--openai-base-url',
      'https://llm.example.test/v1',
      '--llm-provider',
      'openai-compatible',
      '--workspace',
      workspace,
      '--store-dir',
      'knowledge/public-library',
      '--registry',
      'knowledge/public-library-registry.json',
      '--out',
      reportPath,
      '--json'
    ]));
    const report = parseJsonOutput(output);
    const artifact = JSON.parse(await readFile(libraryPath, 'utf8'));
    const persistedRefined = JSON.parse(await readFile(refinedPath, 'utf8'));
    const registry = JSON.parse(await readFile(join(workspace, 'knowledge/public-library-registry.json'), 'utf8'));

    validateArtifact(artifact);
    validateRegistry(registry);
    assert.equal(report.executionMode, 'model-refinement');
    assert.equal(report.mutationAllowed, true);
    assert.equal(report.refinement.enabled, true);
    assert.equal(report.refinement.status, 'validated');
    assert.equal(report.refinement.run.provider.model, 'test-library-builder-model');
    assert.equal(report.refinement.inputReviewPacketHash, report.refinement.run.request.reviewPacketHash);
    assert.equal(report.refinement.reviewPacketHash, report.refinement.finalReviewPacketHash);
    assert.notEqual(report.refinement.inputReviewPacketHash, report.refinement.finalReviewPacketHash);
    assert.equal(report.libraryOutputPath, libraryPath);
    assert.equal(report.refinedOutputPath, refinedPath);
    assert.equal(report.stage.entry.coordinates, artifact.coordinates);
    assert.equal(report.stage.entry.artifact.contentHash, registry.entries[0].artifact.contentHash);
    assert.equal(artifact.artifactId, initialArtifact.artifactId);
    assert.notEqual(artifact.unitPayloadHash, initialArtifact.unitPayloadHash);
    assert.equal(artifact.unitsByType.fact[0].summary, 'Refined S3 bucket fact for downloadable central library reuse.');
    assert.equal(persistedRefined.unitsByType.fact[0].summary, 'Refined S3 bucket fact for downloadable central library reuse.');
    assert.equal(registry.entries[0].coordinates, artifact.coordinates);
    assert.equal(registry.entries[0].artifact.path, report.stage.artifact.registryPath);
    const stagedBytes = await readFile(join(workspace, registry.entries[0].artifact.path));
    const libraryBytes = await readFile(libraryPath);
    assert.equal(sha256(stagedBytes), sha256(libraryBytes));
    assert.equal(sha256(stagedBytes), registry.entries[0].artifact.contentHash);
    const stagedArtifact = JSON.parse(stagedBytes.toString('utf8'));
    assert.equal(stagedArtifact.unitPayloadHash, artifact.unitPayloadHash);
    assert.equal(captured.authorization, 'Bearer test-api-key');
    assert.equal(captured.body.model, 'test-library-builder-model');
    assert.match(captured.body.messages[1].content, /Compact input JSON:/);
    assert.doesNotMatch(JSON.stringify(report), /test-api-key|#### Arguments/);
    assert.doesNotMatch(output, /test-api-key|#### Arguments/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousInfraAgentKey === undefined) {
      delete process.env.INFRA_AGENT_OPENAI_API_KEY;
    } else {
      process.env.INFRA_AGENT_OPENAI_API_KEY = previousInfraAgentKey;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
});
