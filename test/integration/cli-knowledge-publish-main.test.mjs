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
import { buildKnowledgeCacheId } from '../../src/knowledge/cache.ts';

function sourceFixture() {
  return {
    kind: 'terraform-registry',
    name: 'resource:aws_s3_bucket',
    provider: 'hashicorp/aws',
    version: '5.37.0',
    url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket'
  };
}

function unitArtifactPayload() {
  const source = sourceFixture();
  const sourceId = buildKnowledgeCacheId(source);
  const sourceContentHash = 'd'.repeat(64);
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
    extractedAt: '2026-05-15T00:00:00.000Z',
    unitCount: 1,
    units: [
      {
        unitType: 'guidance',
        path: 'guidance.terraform.s3-bucket-rename',
        summary: 'Use moved blocks for logical Terraform renames when the remote bucket identity is unchanged.',
        confidence: 'high',
        extractionMethod: 'official-guidance',
        source: sourceRef,
        privacyScope: 'public-reference',
        topic: 'terraform-logical-rename',
        appliesWhen: ['resource address changes']
      }
    ]
  };
}

function parseJsonOutput(output) {
  return JSON.parse(output.slice(output.indexOf('{')));
}

test('knowledge publish stages a shared unit artifact and registry entry for reuse', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-publish-'));

  try {
    await mkdir(join(tempRoot, 'terraform/app'), { recursive: true });
    await mkdir(join(tempRoot, 'out'), { recursive: true });
    await writeFile(
      join(tempRoot, 'terraform/app/main.tf'),
      [
        'resource "aws_s3_bucket" "api" {',
        '  bucket = "example-api"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(tempRoot, 'infra-agent.config.json'),
      `${JSON.stringify({
        knowledgeCache: {
          root: '.infra-agent/knowledge-cache'
        },
        knowledgeSources: {
          unitArtifactRegistries: [
            {
              path: 'knowledge/unit-registry.json',
              name: 'team-shared-registry'
            }
          ]
        }
      }, null, 2)}\n`,
      'utf8'
    );
    const unitArtifactPath = join(tempRoot, 'out/aws-s3.units.json');
    await writeFile(unitArtifactPath, `${JSON.stringify(unitArtifactPayload(), null, 2)}\n`, 'utf8');

    const publishOutput = await captureStdout(() => main([
      'knowledge',
      'publish',
      unitArtifactPath,
      '--workspace',
      tempRoot,
      '--store-dir',
      'knowledge/shared',
      '--registry',
      'knowledge/unit-registry.json',
      '--domain',
      'terraform',
      '--target',
      'terraform/app',
      '--name',
      'aws-s3-bucket-team-units',
      '--json'
    ]));
    const publishReport = parseJsonOutput(publishOutput);

    assert.equal(publishReport.kind, 'infra-agent.knowledge-shared-artifact-publish');
    assert.equal(publishReport.mutationAllowed, true);
    assert.equal(publishReport.entry.domain, 'terraform');
    assert.equal(publishReport.entry.targetPath, 'terraform/app');
    assert.equal(publishReport.registry.entryCount, 1);
    assert.match(publishReport.artifact.registryPath, /^knowledge\/shared\/[a-f0-9]{64}\.knowledge-units\.json$/);

    const registry = JSON.parse(await readFile(join(tempRoot, 'knowledge/unit-registry.json'), 'utf8'));
    assert.equal(registry.kind, 'infra-agent.knowledge-unit-registry');
    assert.equal(registry.mutationAllowed, false);
    assert.equal(registry.entries[0].artifact.contentHash, publishReport.artifact.sha256);

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
    const source = extraction.sources.find(entry => entry.source.kind === 'knowledge-unit-artifact');

    assert.equal(source?.status, 'extracted');
    assert.equal(source?.unitCount, 1);
    assert.doesNotMatch(extractionOutput, /moved \{/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge publish refuses to overwrite a malformed shared registry', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-publish-bad-registry-'));

  try {
    await mkdir(join(tempRoot, 'out'), { recursive: true });
    await mkdir(join(tempRoot, 'knowledge'), { recursive: true });
    const unitArtifactPath = join(tempRoot, 'out/aws-s3.units.json');
    const registryPath = join(tempRoot, 'knowledge/unit-registry.json');
    await writeFile(unitArtifactPath, `${JSON.stringify(unitArtifactPayload(), null, 2)}\n`, 'utf8');
    await writeFile(registryPath, '{', 'utf8');

    await assert.rejects(
      async () => captureStdout(() => main([
        'knowledge',
        'publish',
        unitArtifactPath,
        '--workspace',
        tempRoot,
        '--store-dir',
        'knowledge/shared',
        '--registry',
        'knowledge/unit-registry.json',
        '--domain',
        'terraform',
        '--json'
      ])),
      /Knowledge unit registry could not be loaded/
    );

    assert.equal(await readFile(registryPath, 'utf8'), '{');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
