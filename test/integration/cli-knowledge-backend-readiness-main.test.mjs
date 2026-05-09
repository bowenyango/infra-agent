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

function validBackendConfig(overrides = {}) {
  return {
    kind: 'infra-agent.knowledge-team-backend-config',
    schemaVersion: 1,
    mutationAllowed: false,
    backendKind: 's3-compatible',
    name: 'team-cache',
    artifactPrefix: 'knowledge-artifacts/v1',
    indexPrefix: 'knowledge-index/v1',
    credentialMode: 'environment',
    remoteWriteDefault: false,
    liveCheckDefault: false,
    ...overrides
  };
}

function assertNoBackendReadinessLeaks(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const forbidden of [
    'private-team-cache',
    'bucket',
    'endpoint',
    'https://',
    's3://',
    'token',
    'password',
    'secret',
    '/tmp/',
    '/home/',
    '/workspace/'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

test('knowledge backend-readiness command writes and validates a ready report', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-backend-readiness-'));

  try {
    const configPath = join(tempRoot, 'team-backend.config.json');
    const readinessPath = join(tempRoot, 'team-backend.readiness.json');
    await writeFile(configPath, `${JSON.stringify(validBackendConfig(), null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'backend-readiness',
      configPath,
      '--out',
      readinessPath,
      '--json'
    ]));
    const outputPayload = JSON.parse(output);
    const readiness = JSON.parse(await readFile(readinessPath, 'utf8'));

    assert.equal(outputPayload.outputPath, readinessPath);
    assert.equal(readiness.kind, 'infra-agent.knowledge-team-backend-readiness');
    assert.equal(readiness.readiness.status, 'ready-for-explicit-upload');
    assert.equal(readiness.remoteWriteAllowed, false);
    assert.equal(readiness.liveCheckAllowed, false);
    assert.equal(readiness.credentialValuesExposed, false);
    assertNoBackendReadinessLeaks(readiness);

    const validationOutput = await captureStdout(() => main([
      'knowledge',
      'validate',
      readinessPath,
      '--json'
    ]));
    const validation = JSON.parse(validationOutput);
    assert.equal(validation.inputKind, 'infra-agent.knowledge-team-backend-readiness');
    assert.equal(validation.valid, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge backend-readiness command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-backend-readiness-text-'));

  try {
    const configPath = join(tempRoot, 'team-backend.config.json');
    await writeFile(configPath, `${JSON.stringify(validBackendConfig({
      remoteWriteDefault: true,
      endpointUrl: 'https://s3.example.test/private',
      bucket: 'private-team-cache',
      accessToken: 'secret-token'
    }), null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'backend-readiness',
      configPath
    ]));

    assert.match(output, /Knowledge team backend readiness/);
    assert.match(output, /status: blocked/);
    assert.match(output, /remote write: no/);
    assert.match(output, /backend-detail-leak/);
    assertNoBackendReadinessLeaks(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
