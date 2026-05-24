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
import {
  buildPublicKnowledgeLibraryArtifact,
  buildPublicKnowledgeUrlReport
} from '../../src/knowledge/url-report.ts';
import { buildPublicKnowledgeLibraryRefinementReviewReport } from '../../src/knowledge/public-library-refinement-review.ts';
import { runPublicKnowledgeLibraryRefinement } from '../../src/knowledge/public-library-refinement-run.ts';
import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';
import { resolveLLMProviderCapabilities } from '../../src/model/providers.ts';

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

async function buildReviewReport(root) {
  const report = await buildReport(root, S3_BUCKET_URL, 'aws_s3_bucket', S3_BUCKET_MARKDOWN);
  const artifact = buildPublicKnowledgeLibraryArtifact(report);
  const artifactPath = join(root, 'knowledge/aws_s3_bucket.library.json');
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

  return {
    sourceReport: report,
    reviewReport: await buildPublicKnowledgeLibraryRefinementReviewReport({
      artifactPath,
      baseDir: process.cwd()
    })
  };
}

test('public library refinement runner sends bounded compact input and validates model output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-refinement-run-unit-'));

  try {
    const { sourceReport, reviewReport } = await buildReviewReport(tempRoot);
    const refined = buildRefinedReport(sourceReport);
    let capturedUrl = '';
    let capturedInit;

    const { report, refinedReport } = await runPublicKnowledgeLibraryRefinement({
      reviewReport,
      config: LLM_CONFIG,
      fetchTransport: async (url, init) => {
        capturedUrl = String(url);
        capturedInit = init;

        return new Response(JSON.stringify({
          choices: [
            {
              message: {
                content: `\`\`\`json\n${JSON.stringify(refined)}\n\`\`\``
              }
            }
          ]
        }), {
          status: 200
        });
      }
    });

    assert.equal(capturedUrl, 'https://llm.example.test/v1/chat/completions');
    assert.equal(capturedInit?.method, 'POST');
    assert.equal(capturedInit?.headers?.authorization, 'Bearer test-api-key');
    const requestBody = JSON.parse(String(capturedInit?.body));
    assert.equal(requestBody.model, 'test-refinement-model');
    assert.equal(requestBody.response_format.type, 'json_object');
    assert.equal(requestBody.stream, false);
    assert.match(requestBody.messages[0]?.content ?? '', /refine public infrastructure knowledge units/);
    assert.match(requestBody.messages[1]?.content ?? '', /Compact input JSON:/);
    assert.doesNotMatch(requestBody.messages[1]?.content ?? '', /full provider docs/i);

    assert.equal(report.kind, 'infra-agent.public-knowledge-library-refinement-run');
    assert.equal(report.mutationAllowed, false);
    assert.equal(report.executionMode, 'model-refinement-run');
    assert.equal(report.coordinates, reviewReport.artifact.coordinates);
    assert.equal(report.provider.id, 'openai-compatible');
    assert.equal(report.provider.model, 'test-refinement-model');
    assert.equal(report.request.rawContentIncluded, false);
    assert.equal(report.response.status, 'validated');
    assert.equal(report.response.httpStatus, 200);
    assert.equal(report.validation.valid, true);
    assert.equal(report.refined.sourceContentHash, reviewReport.artifact.sourceContentHash);
    assert.equal(refinedReport.unitsByType.fact[0].summary, 'Refined bucket naming fact with clearer provider identity wording.');
    assert.doesNotMatch(JSON.stringify(report), /test-api-key/);
    assert.doesNotMatch(JSON.stringify(report), /#### Arguments/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('public library refinement runner rejects model output for a different coordinate', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-refinement-run-drift-'));

  try {
    const { reviewReport } = await buildReviewReport(tempRoot);
    const mismatchedReport = await buildReport(tempRoot, INSTANCE_URL, 'aws_instance', INSTANCE_MARKDOWN);

    await assert.rejects(
      () => runPublicKnowledgeLibraryRefinement({
        reviewReport,
        config: LLM_CONFIG,
        fetchTransport: async () => new Response(JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify(mismatchedReport)
              }
            }
          ]
        }), {
          status: 200
        })
      }),
      /coordinates/
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('public library refinement runner omits provider error bodies from thrown errors', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-refinement-run-error-'));

  try {
    const { reviewReport } = await buildReviewReport(tempRoot);

    await assert.rejects(
      () => runPublicKnowledgeLibraryRefinement({
        reviewReport,
        config: LLM_CONFIG,
        fetchTransport: async () => new Response('authorization bearer test-api-key raw provider debug body', {
          status: 500,
          statusText: 'Internal Server Error'
        })
      }),
      error => {
        assert.match(error.message, /status 500 Internal Server Error/);
        assert.match(error.message, /response body omitted/);
        assert.doesNotMatch(error.message, /test-api-key|authorization|bearer|raw provider debug body/i);
        return true;
      }
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
