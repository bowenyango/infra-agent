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
import {
  buildKnowledgeTeamArtifactContractFixture
} from '../support/knowledge-team-artifact-fixtures.mjs';
import {
  buildKnowledgeTeamS3CompatibleBackendConfig
} from '../../src/knowledge/team-s3-compatible-backend-config.ts';
import {
  buildKnowledgeTeamS3CompatibleReferenceRegistry,
  validateKnowledgeTeamS3CompatibleBackendReferences
} from '../../src/knowledge/team-s3-compatible-reference-registry.ts';
import { main } from '../../src/cli/main.ts';

function validBackendReferenceSummary() {
  return validateKnowledgeTeamS3CompatibleBackendReferences(
    buildKnowledgeTeamS3CompatibleBackendConfig(),
    buildKnowledgeTeamS3CompatibleReferenceRegistry()
  );
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

function assertNoPrivateValues(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const forbidden of [
    'https://should-not-read.example.test',
    'should-not-read-bucket',
    'should-not-read-secret',
    'aws s3 cp',
    's3://private-bucket',
    'private-key'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

test('knowledge upload-approval-intent command writes approval intent JSON', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-intent-'));

  try {
    const fixture = await buildKnowledgeTeamArtifactContractFixture();
    const readinessPath = join(tempRoot, 'knowledge-pack.readiness.json');
    const backendReferencePath = join(tempRoot, 'team-backend.reference-readiness.json');
    const intentPath = join(tempRoot, 'knowledge-pack.upload-intent.json');
    await writeFile(readinessPath, `${JSON.stringify(fixture.uploadRequiredReadiness, null, 2)}\n`, 'utf8');
    await writeFile(backendReferencePath, `${JSON.stringify(validBackendReferenceSummary(), null, 2)}\n`, 'utf8');

    await withEnvValues({
      INFRA_AGENT_TEAM_CACHE_S3_ENDPOINT_URL: 'https://should-not-read.example.test',
      INFRA_AGENT_TEAM_CACHE_S3_BUCKET_NAME: 'should-not-read-bucket',
      INFRA_AGENT_TEAM_CACHE_S3_SECRET_ACCESS_KEY: 'should-not-read-secret'
    }, async () => {
      const output = await captureStdout(() => main([
        'knowledge',
        'upload-approval-intent',
        readinessPath,
        '--backend-reference',
        backendReferencePath,
        '--out',
        intentPath,
        '--json'
      ]));
      const outputPayload = JSON.parse(output);
      const intent = JSON.parse(await readFile(intentPath, 'utf8'));

      assert.equal(outputPayload.outputPath, intentPath);
      assert.equal(intent.outputPath, undefined);
      assert.equal(intent.kind, 'infra-agent.knowledge-team-upload-approval-intent');
      assert.equal(intent.status, 'approval-required');
      assert.equal(intent.remoteWriteAllowed, false);
      assert.equal(intent.liveCheckAllowed, false);
      assert.equal(intent.credentialValuesExposed, false);
      assert.equal(intent.credentialPresenceChecked, false);
      assert.equal(intent.uploadCommand, null);
      assert.equal(intent.preconditions.uploadApproval.approvalProvided, false);
      assert.equal(intent.readiness.nextAction, 'request-explicit-upload-approval');
      assert.deepEqual(intent.readiness.blockerCodes, []);
      assertNoPrivateValues({ outputPayload, intent });
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge upload-approval-intent command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-intent-text-'));

  try {
    const fixture = await buildKnowledgeTeamArtifactContractFixture();
    const backendReference = validBackendReferenceSummary();
    const readinessPath = join(tempRoot, 'knowledge-pack.readiness.json');
    const backendReferencePath = join(tempRoot, 'team-backend.reference-readiness.json');
    await writeFile(readinessPath, `${JSON.stringify({
      ...fixture.uploadRequiredReadiness,
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key'
    }, null, 2)}\n`, 'utf8');
    await writeFile(backendReferencePath, `${JSON.stringify({
      ...backendReference,
      capabilities: {
        ...backendReference.capabilities,
        credentialValuesExposed: true,
        uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key'
      }
    }, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'upload-approval-intent',
      readinessPath,
      '--backend-reference',
      backendReferencePath
    ]));

    assert.match(output, /Knowledge team upload approval intent/);
    assert.match(output, /status: blocked/);
    assert.match(output, /remote write: no/);
    assert.match(output, /live check: no/);
    assert.match(output, /credential values exposed: no/);
    assert.match(output, /credential presence checked: no/);
    assert.match(output, /upload command: none/);
    assert.match(output, /upload-command-present/);
    assert.match(output, /credential-values-exposed/);
    assertNoPrivateValues(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
