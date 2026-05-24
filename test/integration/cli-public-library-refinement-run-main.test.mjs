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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function buildReport(root) {
  await mkdir(join(root, 'knowledge'), { recursive: true });
  const contentPath = join(root, 'knowledge/aws_s3_bucket.md');
  await writeFile(contentPath, S3_BUCKET_MARKDOWN, 'utf8');

  return buildPublicKnowledgeUrlReport({
    url: S3_BUCKET_URL,
    contentPath,
    maxUnits: 20,
    now: new Date('2026-05-22T00:00:00.000Z')
  });
}

function buildRefinedReport(report) {
  const refined = clone(report);
  refined.unitsByType.fact[0].summary = 'Refined bucket naming fact from model output.';
  const compactByteLength = JSON.stringify(refined.unitsByType).length;
  refined.summary.compactByteLength = compactByteLength;
  refined.centralLibraryCandidate.llmRefinementInput.reviewPacket.compactByteLength = compactByteLength;

  const validation = validateKnowledgePayload(refined, 'refined-url-report');
  assert.equal(validation.valid, true);

  return refined;
}

test('knowledge library-refinement-run writes a validated refined URL report from a model response', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-public-library-refinement-run-cli-'));
  const previousInfraAgentKey = process.env.INFRA_AGENT_OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;

  try {
    const sourceReport = await buildReport(tempRoot);
    const artifact = buildPublicKnowledgeLibraryArtifact(sourceReport);
    const refinedReport = buildRefinedReport(sourceReport);
    const artifactPath = join(tempRoot, 'knowledge/aws_s3_bucket.library.json');
    const refinedPath = join(tempRoot, 'knowledge/aws_s3_bucket.refined-url-report.json');
    await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    const captured = {
      url: '',
      authorization: '',
      body: null
    };
    globalThis.fetch = async (url, init) => {
      captured.url = String(url);
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
      'library-refinement-run',
      artifactPath,
      '--out',
      refinedPath,
      '--model',
      'test-runner-model',
      '--openai-base-url',
      'https://llm.example.test/v1',
      '--llm-provider',
      'openai-compatible',
      '--json'
    ]));
    const report = parseJsonOutput(output);

    assert.equal(report.kind, 'infra-agent.public-knowledge-library-refinement-run');
    assert.equal(report.mutationAllowed, false);
    assert.equal(report.executionMode, 'model-refinement-run');
    assert.equal(report.outputPath, refinedPath);
    assert.equal(report.coordinates, artifact.coordinates);
    assert.equal(report.provider.id, 'openai-compatible');
    assert.equal(report.provider.model, 'test-runner-model');
    assert.equal(report.request.rawContentIncluded, false);
    assert.equal(report.response.status, 'validated');
    assert.equal(report.refined.unitCount, artifact.summary.unitCount);
    assert.equal(report.validation.valid, true);
    assert.doesNotMatch(output, /test-api-key/);
    assert.doesNotMatch(output, /#### Arguments/);

    assert.equal(captured.url, 'https://llm.example.test/v1/chat/completions');
    assert.equal(captured.authorization, 'Bearer test-api-key');
    assert.equal(captured.body.model, 'test-runner-model');
    assert.equal(captured.body.response_format.type, 'json_object');
    assert.match(captured.body.messages[1].content, /Compact input JSON:/);

    const persisted = JSON.parse(await readFile(refinedPath, 'utf8'));
    const validation = validateKnowledgePayload(persisted, refinedPath);
    assert.equal(validation.valid, true);
    assert.equal(validation.inputKind, 'infra-agent.public-knowledge-url-report');
    assert.equal(persisted.unitsByType.fact[0].summary, 'Refined bucket naming fact from model output.');
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
