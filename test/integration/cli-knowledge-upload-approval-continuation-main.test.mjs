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
import {
  buildKnowledgeTeamUploadApprovalIntent
} from '../../src/knowledge/team-upload-approval-intent.ts';
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

async function writeValidIntent(tempRoot) {
  const fixture = await buildKnowledgeTeamArtifactContractFixture();
  const intent = buildKnowledgeTeamUploadApprovalIntent({
    publicationReadiness: fixture.uploadRequiredReadiness,
    backendReferenceValidation: validBackendReferenceSummary()
  });
  const intentPath = join(tempRoot, 'knowledge-pack.upload-intent.json');
  await writeFile(intentPath, `${JSON.stringify(intent, null, 2)}\n`, 'utf8');
  return { intent, intentPath };
}

test('knowledge upload-approval-continuation command writes continuation JSON', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-continuation-'));

  try {
    const { intent, intentPath } = await writeValidIntent(tempRoot);
    const continuationPath = join(tempRoot, 'knowledge-pack.upload-continuation.json');

    await withEnvValues({
      INFRA_AGENT_TEAM_CACHE_S3_ENDPOINT_URL: 'https://should-not-read.example.test',
      INFRA_AGENT_TEAM_CACHE_S3_BUCKET_NAME: 'should-not-read-bucket',
      INFRA_AGENT_TEAM_CACHE_S3_SECRET_ACCESS_KEY: 'should-not-read-secret'
    }, async () => {
      const output = await captureStdout(() => main([
        'knowledge',
        'upload-approval-continuation',
        intentPath,
        '--approval-fingerprint',
        intent.approvalFingerprint.value,
        '--out',
        continuationPath,
        '--json'
      ]));
      const outputPayload = JSON.parse(output);
      const continuation = JSON.parse(await readFile(continuationPath, 'utf8'));

      assert.equal(outputPayload.outputPath, continuationPath);
      assert.equal(continuation.outputPath, undefined);
      assert.equal(continuation.kind, 'infra-agent.knowledge-team-upload-approval-continuation');
      assert.equal(continuation.status, 'continuation-ready');
      assert.equal(continuation.remoteWriteAllowed, false);
      assert.equal(continuation.liveCheckAllowed, false);
      assert.equal(continuation.credentialValuesExposed, false);
      assert.equal(continuation.credentialPresenceChecked, false);
      assert.equal(continuation.uploadApproved, false);
      assert.equal(continuation.uploadExecutionAllowed, false);
      assert.equal(continuation.clientCreated, false);
      assert.equal(continuation.uploadCommand, null);
      assert.equal(continuation.approval.fingerprintVerified, true);
      assert.equal(continuation.readiness.nextAction, 'inject-approved-adapter-dependencies');
      assert.deepEqual(continuation.readiness.blockerCodes, []);
      assertNoPrivateValues({ outputPayload, continuation });
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge upload-approval-continuation command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-continuation-text-'));

  try {
    const { intent, intentPath } = await writeValidIntent(tempRoot);
    await writeFile(intentPath, `${JSON.stringify({
      ...intent,
      endpointUrl: 'https://private.example.test',
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key'
    }, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'upload-approval-continuation',
      intentPath,
      '--approval-fingerprint',
      'bad-fingerprint'
    ]));

    assert.match(output, /Knowledge team upload approval continuation/);
    assert.match(output, /status: blocked/);
    assert.match(output, /remote write: no/);
    assert.match(output, /upload approved: no/);
    assert.match(output, /upload execution allowed: no/);
    assert.match(output, /client created: no/);
    assert.match(output, /upload command: none/);
    assert.match(output, /backend-detail-leak/);
    assert.match(output, /unsafe-approval-fingerprint/);
    assertNoPrivateValues(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
