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

function validPrivateBackendConfig(overrides = {}) {
  return {
    kind: 'infra-agent.knowledge-team-s3-compatible-backend-config',
    schemaVersion: 1,
    mutationAllowed: false,
    backendKind: 's3-compatible',
    name: 'team-cache',
    storageProfileRef: 'team-cache-storage',
    authProfileRef: 'team-cache-auth',
    artifactPrefix: 'knowledge-artifacts/v1',
    indexPrefix: 'knowledge-index/v1',
    credentialMode: 'environment',
    remoteWriteDefault: false,
    liveCheckDefault: false,
    ...overrides
  };
}

function validReferenceRegistry(overrides = {}) {
  return {
    kind: 'infra-agent.knowledge-team-s3-compatible-reference-registry',
    schemaVersion: 1,
    mutationAllowed: false,
    storageProfiles: [
      {
        ref: 'team-cache-storage',
        endpointUrlEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_ENDPOINT_URL',
        bucketNameEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_BUCKET_NAME',
        regionEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_REGION'
      }
    ],
    authProfiles: [
      {
        ref: 'team-cache-auth',
        accessKeyIdEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_ACCESS_KEY_ID',
        secretAccessKeyEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_SECRET_ACCESS_KEY',
        sessionTokenEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_SESSION_TOKEN'
      }
    ],
    ...overrides
  };
}

function withEnvValues(updates, callback) {
  const previous = {};
  for (const [key, value] of Object.entries(updates)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (typeof value === 'undefined') {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

function assertNoRuntimeValues(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const forbidden of [
    'https://should-not-read.example.test',
    'should-not-read-bucket',
    'should-not-read-region',
    'should-not-read-access-key',
    'should-not-read-secret-key',
    'should-not-read-session-token'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

test('knowledge backend-reference-readiness command writes valid offline reference summary', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-reference-readiness-'));

  try {
    const configPath = join(tempRoot, 'team-backend.config.json');
    const registryPath = join(tempRoot, 'team-backend.reference-registry.json');
    const readinessPath = join(tempRoot, 'team-backend.reference-readiness.json');
    await writeFile(configPath, `${JSON.stringify(validPrivateBackendConfig(), null, 2)}\n`, 'utf8');
    await writeFile(registryPath, `${JSON.stringify(validReferenceRegistry(), null, 2)}\n`, 'utf8');

    await withEnvValues({
      INFRA_AGENT_TEAM_CACHE_S3_ENDPOINT_URL: 'https://should-not-read.example.test',
      INFRA_AGENT_TEAM_CACHE_S3_BUCKET_NAME: 'should-not-read-bucket',
      INFRA_AGENT_TEAM_CACHE_S3_REGION: 'should-not-read-region',
      INFRA_AGENT_TEAM_CACHE_S3_ACCESS_KEY_ID: 'should-not-read-access-key',
      INFRA_AGENT_TEAM_CACHE_S3_SECRET_ACCESS_KEY: 'should-not-read-secret-key',
      INFRA_AGENT_TEAM_CACHE_S3_SESSION_TOKEN: 'should-not-read-session-token'
    }, async () => {
      const output = await captureStdout(() => main([
        'knowledge',
        'backend-reference-readiness',
        configPath,
        '--registry',
        registryPath,
        '--out',
        readinessPath,
        '--json'
      ]));
      const outputPayload = JSON.parse(output);
      const readiness = JSON.parse(await readFile(readinessPath, 'utf8'));

      assert.equal(outputPayload.outputPath, readinessPath);
      assert.equal(readiness.kind, 'infra-agent.knowledge-team-s3-compatible-reference-validation');
      assert.equal(readiness.status, 'valid');
      assert.equal(readiness.backendKind, 's3-compatible');
      assert.deepEqual(readiness.issueCodes, []);
      assert.deepEqual(readiness.requiredEnvironmentVariables, [
        'INFRA_AGENT_TEAM_CACHE_S3_ENDPOINT_URL',
        'INFRA_AGENT_TEAM_CACHE_S3_BUCKET_NAME',
        'INFRA_AGENT_TEAM_CACHE_S3_REGION',
        'INFRA_AGENT_TEAM_CACHE_S3_ACCESS_KEY_ID',
        'INFRA_AGENT_TEAM_CACHE_S3_SECRET_ACCESS_KEY'
      ]);
      assert.deepEqual(readiness.optionalEnvironmentVariables, [
        'INFRA_AGENT_TEAM_CACHE_S3_SESSION_TOKEN'
      ]);
      assert.equal(readiness.capabilities.remoteWriteAllowed, false);
      assert.equal(readiness.capabilities.liveCheckAllowed, false);
      assert.equal(readiness.capabilities.credentialValuesExposed, false);
      assert.equal(readiness.capabilities.uploadCommand, null);
      assert.equal(readiness.capabilities.dryRunOnly, true);
      assertNoRuntimeValues({ outputPayload, readiness });
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge backend-reference-readiness command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-reference-readiness-text-'));

  try {
    const configPath = join(tempRoot, 'team-backend.config.json');
    const registryPath = join(tempRoot, 'team-backend.reference-registry.json');
    await writeFile(configPath, `${JSON.stringify(validPrivateBackendConfig({
      storageProfileRef: 'missing-storage-profile',
      authProfileRef: 'missing-auth-profile'
    }), null, 2)}\n`, 'utf8');
    await writeFile(registryPath, `${JSON.stringify(validReferenceRegistry({
      storageProfiles: [
        {
          ref: 'team-cache-storage',
          endpointUrlEnvVar: 'https://private.example.test',
          bucketNameEnvVar: 'private-team-cache',
          regionEnvVar: 'us-east-1'
        }
      ],
      authProfiles: [
        {
          ref: 'team-cache-auth',
          accessKeyIdEnvVar: 'access-key-value',
          secretAccessKeyEnvVar: 'secret-token'
        }
      ]
    }), null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'backend-reference-readiness',
      configPath,
      '--registry',
      registryPath
    ]));

    assert.match(output, /Knowledge team backend reference readiness/);
    assert.match(output, /status: blocked/);
    assert.match(output, /remote write: no/);
    assert.match(output, /live check: no/);
    assert.match(output, /credential values exposed: no/);
    assert.match(output, /backend-detail-leak/);
    assert.match(output, /unsafe-env-var-name/);
    for (const forbidden of [
      'https://private.example.test',
      'private-team-cache',
      'us-east-1',
      'access-key-value',
      'secret-token'
    ]) {
      assert.equal(output.includes(forbidden), false, forbidden);
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
