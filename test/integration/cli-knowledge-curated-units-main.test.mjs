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

async function writeCuratedWorkspace(root) {
  await mkdir(join(root, 'terraform/app'), { recursive: true });
  await mkdir(join(root, 'knowledge'), { recursive: true });
  await writeFile(
    join(root, 'infra-agent.config.json'),
    `${JSON.stringify({
      knowledgeCache: {
        root: '.infra-agent/knowledge-cache'
      },
      knowledgeSources: {
        curatedUnits: [
          {
            domain: 'terraform',
            targetPath: 'terraform/app',
            path: 'knowledge/terraform-rename-units.json',
            name: 'terraform-rename-internal'
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
    join(root, 'knowledge/terraform-rename-units.json'),
    `${JSON.stringify({
      kind: 'infra-agent.curated-knowledge-units',
      schemaVersion: 1,
      mutationAllowed: false,
      units: [
        {
          unitType: 'guidance',
          path: 'guidance.terraform.logical-rename',
          summary: 'Use Terraform moved blocks when a resource logical name changes but the remote object should be retained.',
          confidence: 'high',
          topic: 'terraform-logical-rename',
          appliesWhen: ['Terraform resource address rename']
        },
        {
          unitType: 'example',
          path: 'example.terraform.moved-block',
          summary: 'Minimal moved block for a Terraform resource rename.',
          exampleType: 'terraform-moved-block',
          language: 'hcl',
          snippet: 'moved { from = aws_s3_bucket.old to = aws_s3_bucket.api }'
        },
        {
          unitType: 'recipe',
          path: 'recipe.terraform.safe-rename',
          summary: 'Review a Terraform logical rename before editing infrastructure.',
          name: 'Terraform safe logical rename',
          steps: ['Add or verify a moved block.', 'Run a plan before apply.'],
          requiresApproval: true
        }
      ]
    }, null, 2)}\n`,
    'utf8'
  );
}

function parseJsonOutput(output) {
  return JSON.parse(output.slice(output.indexOf('{')));
}

test('knowledge sources command lists configured local curated unit sources', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-cli-curated-sources-'));

  try {
    await writeCuratedWorkspace(tempRoot);
    const output = await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'terraform',
      '--target',
      'terraform/app',
      '--json'
    ]));
    const report = parseJsonOutput(output);
    const source = report.sources.find(entry => entry.source.kind === 'internal-knowledge');

    assert.ok(source);
    assert.equal(source.domain, 'terraform');
    assert.equal(source.targetPath, 'terraform/app');
    assert.equal(source.requiresFetch, false);
    assert.equal(source.cacheStatus, 'local');
    assert.equal(source.storagePolicy.scope, 'workspace-private');
    assert.doesNotMatch(output, /moved \{ from = aws_s3_bucket\.old/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge extract and pack commands handle configured local curated units', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-cli-curated-pack-'));

  try {
    await writeCuratedWorkspace(tempRoot);
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
    const internalSource = extraction.sources.find(source => source.source.kind === 'internal-knowledge');
    const unitSet = extraction.unitSets.find(source => source.source.kind === 'internal-knowledge');

    assert.equal(internalSource?.status, 'extracted');
    assert.equal(internalSource?.factCount, 0);
    assert.equal(internalSource?.unitCount, 3);
    assert.equal(unitSet?.unitCount, 3);
    assert.ok(unitSet?.units.every(unit => unit.privacyScope === 'internal-team'));

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
    assert.equal(pack.unitCount, 3);
    assert.equal(pack.includedUnitCount, 1);
    assert.equal(pack.omittedUnitCount, 2);
    assert.equal(pack.units[0]?.unitType, 'guidance');
    assert.equal(pack.units[0]?.topic, 'terraform-logical-rename');
    assert.equal(pack.units[0]?.privacyScope, 'internal-team');
    assert.doesNotMatch(packOutput, /moved \{ from = aws_s3_bucket\.old/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
