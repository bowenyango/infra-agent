import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve
} from 'node:path';
import { buildPublicKnowledgeLibraryFromUrl } from '../../src/knowledge/public-library-build.ts';
import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';
import { resolveLLMProviderCapabilities } from '../../src/model/providers.ts';

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

const LLM_CONFIG = {
  apiKey: 'test-api-key',
  apiKeySource: 'INFRA_AGENT_OPENAI_API_KEY',
  provider: 'openai-compatible',
  providerCapabilities: resolveLLMProviderCapabilities('openai-compatible'),
  providerSource: 'cli',
  baseUrl: 'https://llm.example.test/v1',
  baseUrlSource: 'cli',
  model: 'test-refinement-model',
  modelSource: 'cli'
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function writeMarkdownFixture(tempRoot) {
  const contentPath = join(tempRoot, 'aws_s3_bucket.md');
  await writeFile(contentPath, S3_BUCKET_MARKDOWN, 'utf8');
  return contentPath;
}

function validateArtifact(artifact) {
  const validation = validateKnowledgePayload(artifact, 'public-library-build-artifact');
  assert.equal(validation.valid, true);
  assert.equal(validation.inputKind, 'infra-agent.public-knowledge-library-artifact');
}

function refinedReportFrom(report) {
  const refined = clone(report);
  refined.unitsByType.fact[0].summary = 'Refined S3 bucket identity fact for central library reuse.';
  const compactByteLength = JSON.stringify(refined.unitsByType).length;
  refined.summary.compactByteLength = compactByteLength;
  refined.centralLibraryCandidate.llmRefinementInput.reviewPacket.compactByteLength = compactByteLength;

  const validation = validateKnowledgePayload(refined, 'refined-url-report');
  assert.equal(validation.valid, true);

  return refined;
}

test('builds a validated public knowledge library artifact from a URL report without refinement', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-build-unit-'));

  try {
    const contentPath = await writeMarkdownFixture(tempRoot);
    const { report, artifact, urlReport } = await buildPublicKnowledgeLibraryFromUrl({
      url: S3_BUCKET_URL,
      contentPath,
      maxUnits: 20,
      now: new Date('2026-05-22T00:00:00.000Z')
    });

    validateArtifact(artifact);
    assert.equal(report.kind, 'infra-agent.public-knowledge-library-build');
    assert.equal(report.mutationAllowed, false);
    assert.equal(report.executionMode, 'deterministic');
    assert.equal(report.mutationAllowed, false);
    assert.equal(report.refinement.enabled, false);
    assert.equal(report.refinement.status, 'disabled');
    assert.equal(report.refinement.reviewPacketHash, report.refinement.finalReviewPacketHash);
    assert.equal(report.refinement.inputReviewPacketHash, report.refinement.finalReviewPacketHash);
    assert.equal(report.classification.coordinates, urlReport.centralLibraryCandidate.classification.coordinates);
    assert.equal(report.coordinates, artifact.coordinates);
    assert.equal(report.download.strategy, 'local-content-fixture');
    assert.equal(artifact.download.strategy, 'local-content-fixture');
    assert.equal(artifact.classification.coordinates, urlReport.centralLibraryCandidate.classification.coordinates);
    assert.equal(artifact.classification.providerAddress, 'hashicorp/aws');
    assert.equal(report.artifact.artifactId, artifact.artifactId);
    assert.equal(report.artifact.unitPayloadHash, artifact.unitPayloadHash);
    assert.equal(report.quality.initial.status, urlReport.quality.status);
    assert.equal(report.quality.final.status, urlReport.quality.status);
    assert.equal(report.unitCoverage.unitCount, artifact.summary.unitCount);
    assert.equal(report.validation.valid, true);

    const reportJson = JSON.stringify(report);
    assert.doesNotMatch(reportJson, /test-api-key/);
    assert.doesNotMatch(reportJson, /# aws_s3_bucket|#### Arguments/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('refines the URL report, rebuilds the artifact, and preserves the artifact ID', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-build-refine-'));

  try {
    const contentPath = await writeMarkdownFixture(tempRoot);
    let capturedInitialReport;
    const initial = await buildPublicKnowledgeLibraryFromUrl({
      url: S3_BUCKET_URL,
      contentPath,
      maxUnits: 20,
      now: new Date('2026-05-22T00:00:00.000Z')
    });
    capturedInitialReport = initial.urlReport;
    const refined = refinedReportFrom(capturedInitialReport);

    const result = await buildPublicKnowledgeLibraryFromUrl({
      url: S3_BUCKET_URL,
      contentPath,
      maxUnits: 20,
      now: new Date('2026-05-22T00:00:00.000Z'),
      refine: {
        config: LLM_CONFIG,
        fetchTransport: async () => new Response(JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify(refined)
              }
            }
          ]
        }), {
          status: 200
        })
      }
    });

    validateArtifact(result.artifact);
    assert.equal(result.report.executionMode, 'model-refinement');
    assert.equal(result.report.mutationAllowed, false);
    assert.equal(result.report.refinement.enabled, true);
    assert.equal(result.report.refinement.status, 'validated');
    assert.equal(result.report.refinement.run.provider.model, 'test-refinement-model');
    assert.equal(result.report.refinement.inputReviewPacketHash, result.report.refinement.run.request.reviewPacketHash);
    assert.equal(result.report.refinement.reviewPacketHash, result.report.refinement.finalReviewPacketHash);
    assert.notEqual(result.report.refinement.inputReviewPacketHash, result.report.refinement.finalReviewPacketHash);
    assert.equal(result.artifact.artifactId, initial.artifact.artifactId);
    assert.equal(result.artifact.unitPayloadHash !== initial.artifact.unitPayloadHash, true);
    assert.equal(result.artifact.unitsByType.fact[0].summary, 'Refined S3 bucket identity fact for central library reuse.');
    assert.equal(result.urlReport.unitsByType.fact[0].summary, 'Refined S3 bucket identity fact for central library reuse.');
    assert.equal(result.artifact.classification.coordinates, initial.artifact.classification.coordinates);
    assert.equal(result.artifact.download.strategy, initial.artifact.download.strategy);
    assert.equal(result.report.classification.coordinates, initial.report.classification.coordinates);
    assert.equal(result.report.download.strategy, initial.report.download.strategy);
    assert.equal(result.report.quality.initial.status, initial.urlReport.quality.status);
    assert.equal(result.report.quality.final.status, result.urlReport.quality.status);

    const reportJson = JSON.stringify(result.report);
    assert.doesNotMatch(reportJson, /test-api-key/);
    assert.doesNotMatch(reportJson, /# aws_s3_bucket|#### Arguments/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
