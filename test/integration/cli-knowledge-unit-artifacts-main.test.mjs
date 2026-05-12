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
import { captureStdout } from '../support/capture-stdout.mjs';
import { main } from '../../src/cli/main.ts';
import { buildKnowledgeCacheId } from '../../src/knowledge/cache.ts';

function registrySourceFixture() {
  return {
    kind: 'terraform-registry',
    name: 'resource:aws_s3_bucket',
    provider: 'hashicorp/aws',
    version: '5.37.0',
    url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket'
  };
}

function unitArtifactPayload() {
  const source = registrySourceFixture();
  const sourceId = buildKnowledgeCacheId(source);
  const sourceContentHash = 'c'.repeat(64);
  const sourceRef = {
    id: sourceId,
    source,
    contentHash: sourceContentHash,
    locator: 'Terraform Registry: aws_s3_bucket'
  };

  return {
    kind: 'infra-agent.knowledge-units',
    schemaVersion: 1,
    mutationAllowed: false,
    sourceId,
    source,
    sourceContentHash,
    extractedAt: '2026-05-12T00:00:00.000Z',
    unitCount: 2,
    units: [
      {
        unitType: 'guidance',
        path: 'guidance.terraform.logical-rename',
        summary: 'Use a moved block when only the Terraform logical resource name changes.',
        confidence: 'high',
        extractionMethod: 'official-guidance',
        source: sourceRef,
        privacyScope: 'public-reference',
        topic: 'terraform-logical-rename',
        appliesWhen: ['resource address changes', 'remote identity remains the same']
      },
      {
        unitType: 'example',
        path: 'example.terraform.moved-block',
        summary: 'Minimal moved block for a Terraform resource rename.',
        confidence: 'medium',
        extractionMethod: 'official-example',
        source: sourceRef,
        privacyScope: 'public-reference',
        exampleType: 'terraform-moved-block',
        language: 'hcl',
        snippet: 'moved { from = aws_s3_bucket.old to = aws_s3_bucket.api }'
      }
    ]
  };
}

async function writeUnitArtifactWorkspace(root) {
  await mkdir(join(root, 'terraform/app'), { recursive: true });
  await mkdir(join(root, 'knowledge'), { recursive: true });
  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        unitArtifacts: [
          {
            domain: 'terraform',
            targetPath: 'terraform/app',
            path: 'knowledge/aws-s3-bucket.units.json',
            name: 'aws-s3-bucket-prebuilt-units'
          }
        ]
      }
    }, null, 2)}\n`,
    'utf8'
  );
  await writeFile(
    join(root, 'terraform/app/main.tf'),
    [
      'resource "aws_s3_bucket" "api" {',
      '  bucket = "example-api"',
      '}',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(
    join(root, 'knowledge/aws-s3-bucket.units.json'),
    `${JSON.stringify(unitArtifactPayload(), null, 2)}\n`,
    'utf8'
  );
}

function parseJsonOutput(output) {
  return JSON.parse(output.slice(output.indexOf('{')));
}

test('knowledge CLI handles configured prebuilt unit artifacts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-cli-unit-artifact-'));

  try {
    await writeUnitArtifactWorkspace(tempRoot);
    const sourcesOutput = await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'terraform',
      '--target',
      'terraform/app',
      '--json'
    ]));
    const sourcesReport = parseJsonOutput(sourcesOutput);
    const source = sourcesReport.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');

    assert.ok(source);
    assert.equal(source.requiresFetch, false);
    assert.equal(source.cacheStatus, 'local');
    assert.equal(source.storagePolicy.scope, 'workspace-private');
    assert.doesNotMatch(sourcesOutput, /moved \{ from = aws_s3_bucket\.old/);

    const extractionOutput = await captureStdout(() => main([
      'knowledge',
      'extract',
      tempRoot,
      '--domain',
      'terraform',
      '--target',
      'terraform/app',
      '--json'
    ]));
    const extraction = parseJsonOutput(extractionOutput);
    const extractedSource = extraction.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');

    assert.equal(extractedSource?.status, 'extracted');
    assert.equal(extractedSource?.factCount, 0);
    assert.equal(extractedSource?.unitCount, 2);

    const packOutput = await captureStdout(() => main([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'terraform',
      '--target',
      'terraform/app',
      '--max-units',
      '1',
      '--json'
    ]));
    const pack = parseJsonOutput(packOutput);

    assert.equal(pack.factCount, 0);
    assert.equal(pack.unitCount, 2);
    assert.equal(pack.includedUnitCount, 1);
    assert.equal(pack.omittedUnitCount, 1);
    assert.equal(pack.units[0]?.unitType, 'guidance');
    assert.equal(pack.units[0]?.topic, 'terraform-logical-rename');
    assert.doesNotMatch(packOutput, /moved \{ from = aws_s3_bucket\.old/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
