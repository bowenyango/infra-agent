import test from 'node:test';
import assert from 'node:assert/strict';
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

function parseJsonOutput(output) {
  return JSON.parse(output.slice(output.indexOf('{')));
}

async function writeHelmKnowledgeIndex(outputPath) {
  const output = await captureStdout(() => main([
    'knowledge',
    'index',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--max-units',
    '3',
    '--out',
    outputPath,
    '--json'
  ]));

  return parseJsonOutput(output);
}

test('knowledge validate command validates knowledge index artifacts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-index-validate-'));

  try {
    const outputPath = join(tempRoot, 'knowledge-index.json');
    const stdoutIndex = await writeHelmKnowledgeIndex(outputPath);
    const artifactIndex = JSON.parse(await readFile(outputPath, 'utf8'));
    const validationOutput = await captureStdout(() => main([
      'knowledge',
      'validate',
      outputPath,
      '--json'
    ]));
    const report = parseJsonOutput(validationOutput);

    assert.equal(stdoutIndex.kind, 'infra-agent.knowledge-unit-index');
    assert.equal(stdoutIndex.outputPath, outputPath);
    assert.equal(artifactIndex.kind, 'infra-agent.knowledge-unit-index');
    assert.equal(artifactIndex.outputPath, undefined);
    assert.equal(artifactIndex.includedUnitCount, stdoutIndex.includedUnitCount);

    assert.equal(report.kind, 'infra-agent.knowledge-validation');
    assert.equal(report.schemaVersion, 1);
    assert.equal(report.mutationAllowed, false);
    assert.equal(report.inputKind, 'infra-agent.knowledge-unit-index');
    assert.equal(report.valid, true);
    assert.equal(report.unitCount, artifactIndex.includedUnitCount);
    assert.equal(report.factCount, 0);
    assert.equal(report.factSetCount, 0);
    assert.deepEqual(report.issues, []);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge validate command rejects tampered knowledge index artifacts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-index-validate-forged-'));
  const previousExitCode = process.exitCode;

  try {
    process.exitCode = undefined;
    const outputPath = join(tempRoot, 'knowledge-index.json');
    const forgedPath = join(tempRoot, 'knowledge-index-forged.json');
    await writeHelmKnowledgeIndex(outputPath);
    const artifactIndex = JSON.parse(await readFile(outputPath, 'utf8'));
    assert.ok(artifactIndex.entries[0]);

    artifactIndex.entries[0].sourceContentHash = 'a'.repeat(64);
    await writeFile(forgedPath, JSON.stringify(artifactIndex, null, 2));

    const validationOutput = await captureStdout(() => main([
      'knowledge',
      'validate',
      forgedPath,
      '--json'
    ]));
    const report = parseJsonOutput(validationOutput);

    assert.equal(report.kind, 'infra-agent.knowledge-validation');
    assert.equal(report.schemaVersion, 1);
    assert.equal(report.mutationAllowed, false);
    assert.equal(report.inputKind, 'infra-agent.knowledge-unit-index');
    assert.equal(report.valid, false);
    assert.equal(report.factCount, 0);
    assert.equal(report.factSetCount, 0);
    assert.equal(report.unitCount, artifactIndex.includedUnitCount);
    assert.equal(process.exitCode, 1);
    assert.ok(report.issues.some(issue => issue.path === '$.entries[0].sourceContentHash'), report.issues);
  } finally {
    process.exitCode = previousExitCode;
    await rm(tempRoot, { recursive: true, force: true });
  }
});
