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
import { captureStdout } from '../support/capture-stdout.mjs';
import {
  buildKnowledgeTeamArtifactContractFixture
} from '../support/knowledge-team-artifact-fixtures.mjs';
import { main } from '../../src/cli/main.ts';

async function writeJson(path, payload) {
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

test('knowledge validate CLI accepts saved team artifact contract payloads', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-team-contract-'));

  try {
    const fixture = await buildKnowledgeTeamArtifactContractFixture();
    assert.ok(fixture.descriptor);
    assert.ok(fixture.indexEntry);
    assert.ok(fixture.alreadyPublishedReadiness);

    const payloads = [
      ['descriptor.json', fixture.descriptor, 'infra-agent.knowledge-team-artifact-descriptor'],
      ['publication-plan.json', fixture.publicationPlan, 'infra-agent.knowledge-team-publication-plan'],
      ['index-entry.json', fixture.indexEntry, 'infra-agent.knowledge-team-artifact-index-entry'],
      ['readiness.json', fixture.alreadyPublishedReadiness, 'infra-agent.knowledge-team-publication-readiness']
    ];

    for (const [filename, payload, expectedKind] of payloads) {
      const payloadPath = join(tempRoot, filename);
      await writeJson(payloadPath, payload);
      const output = await captureStdout(() => main([
        'knowledge',
        'validate',
        payloadPath,
        '--json'
      ]));
      const report = JSON.parse(output);
      assert.equal(report.inputKind, expectedKind);
      assert.equal(report.valid, true);
      assert.equal(report.factCount, 1);
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge validate CLI rejects forged team artifact contract payloads', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-team-contract-forged-'));

  try {
    const fixture = await buildKnowledgeTeamArtifactContractFixture();
    const payloadPath = join(tempRoot, 'forged-readiness.json');
    await writeJson(payloadPath, {
      ...fixture.uploadRequiredReadiness,
      remoteWriteAllowed: true,
      credentialRequired: true,
      uploadCommand: 'aws s3 cp pack.json s3://private-bucket',
      endpointUrl: 'https://s3.example.test/private',
      workspaceRoot: '/workspace/private-project'
    });

    let exitCode = 0;
    const output = await captureStdout(async () => {
      const previousExitCode = process.exitCode;
      process.exitCode = undefined;
      await main([
        'knowledge',
        'validate',
        payloadPath,
        '--json'
      ]);
      exitCode = process.exitCode ?? 0;
      process.exitCode = previousExitCode;
    });
    const report = JSON.parse(output);

    assert.equal(exitCode, 1);
    assert.equal(report.inputKind, 'infra-agent.knowledge-team-publication-readiness');
    assert.equal(report.valid, false);
    for (const path of [
      '$.remoteWriteAllowed',
      '$.credentialRequired',
      '$.uploadCommand',
      '$.endpointUrl',
      '$.workspaceRoot'
    ]) {
      assert.ok(report.issues.some(issue => issue.path === path), path);
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
