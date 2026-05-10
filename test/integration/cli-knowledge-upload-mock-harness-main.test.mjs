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
  buildMockKnowledgeTeamBackendAdapterConfig,
  planKnowledgeTeamBackendAdapterResolution
} from '../../src/knowledge/team-backend-adapter-resolver.ts';
import {
  buildKnowledgeTeamS3CompatibleBackendConfig
} from '../../src/knowledge/team-s3-compatible-backend-config.ts';
import {
  buildKnowledgeTeamS3CompatibleReferenceRegistry,
  validateKnowledgeTeamS3CompatibleBackendReferences
} from '../../src/knowledge/team-s3-compatible-reference-registry.ts';
import {
  buildKnowledgeTeamUploadAdapterPreflight
} from '../../src/knowledge/team-upload-adapter-preflight.ts';
import {
  buildKnowledgeTeamUploadApprovalContinuation
} from '../../src/knowledge/team-upload-approval-continuation.ts';
import {
  buildKnowledgeTeamUploadApprovalIntent
} from '../../src/knowledge/team-upload-approval-intent.ts';
import {
  validateKnowledgePayload
} from '../../src/knowledge/validate.ts';
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

async function buildValidPreflight() {
  const fixture = await buildKnowledgeTeamArtifactContractFixture();
  const intent = buildKnowledgeTeamUploadApprovalIntent({
    publicationReadiness: fixture.uploadRequiredReadiness,
    backendReferenceValidation: validBackendReferenceSummary()
  });
  const continuation = buildKnowledgeTeamUploadApprovalContinuation({
    approvalIntent: intent,
    approvalFingerprint: intent.approvalFingerprint.value
  });
  const adapterResolutionPlan = planKnowledgeTeamBackendAdapterResolution(
    buildMockKnowledgeTeamBackendAdapterConfig('mock-team-cache')
  );
  return buildKnowledgeTeamUploadAdapterPreflight({
    continuation,
    adapterResolutionPlan
  });
}

async function writeValidPreflight(tempRoot) {
  const preflight = await buildValidPreflight();
  const preflightPath = join(tempRoot, 'knowledge-pack.upload-adapter-preflight.json');
  await writeFile(preflightPath, `${JSON.stringify(preflight, null, 2)}\n`, 'utf8');
  return { preflight, preflightPath };
}

test('knowledge upload-mock-harness command writes valid dry-run harness JSON', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-mock-harness-'));

  try {
    const { preflightPath } = await writeValidPreflight(tempRoot);
    const harnessPath = join(tempRoot, 'knowledge-pack.upload-mock-harness.json');

    await withEnvValues({
      INFRA_AGENT_TEAM_CACHE_S3_ENDPOINT_URL: 'https://should-not-read.example.test',
      INFRA_AGENT_TEAM_CACHE_S3_BUCKET_NAME: 'should-not-read-bucket',
      INFRA_AGENT_TEAM_CACHE_S3_SECRET_ACCESS_KEY: 'should-not-read-secret'
    }, async () => {
      const output = await captureStdout(() => main([
        'knowledge',
        'upload-mock-harness',
        preflightPath,
        '--out',
        harnessPath,
        '--json'
      ]));
      const outputPayload = JSON.parse(output);
      const harness = JSON.parse(await readFile(harnessPath, 'utf8'));
      const validation = validateKnowledgePayload(harness, harnessPath);

      assert.equal(outputPayload.outputPath, harnessPath);
      assert.equal(harness.outputPath, undefined);
      assert.equal(harness.kind, 'infra-agent.knowledge-team-upload-mock-harness');
      assert.equal(harness.status, 'harness-ready');
      assert.equal(harness.remoteWriteAllowed, false);
      assert.equal(harness.liveCheckAllowed, false);
      assert.equal(harness.credentialValuesExposed, false);
      assert.equal(harness.credentialPresenceChecked, false);
      assert.equal(harness.uploadApproved, false);
      assert.equal(harness.uploadExecutionAllowed, false);
      assert.equal(harness.clientCreated, false);
      assert.equal(harness.adapterInjected, false);
      assert.equal(harness.mockAdapterInstantiated, true);
      assert.equal(harness.objectWriteAttempted, false);
      assert.equal(harness.metadataIndexWriteAttempted, false);
      assert.equal(harness.remoteMutationPerformed, false);
      assert.equal(harness.uploadCommand, null);
      assert.equal(harness.mockHarness.objectWriteAttempted, false);
      assert.equal(harness.mockHarness.indexWriteAttempted, false);
      assert.equal(harness.mockHarness.remoteMutationPerformed, false);
      assert.equal(validation.valid, true);
      assertNoPrivateValues({ outputPayload, harness });
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge upload-mock-harness command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-mock-harness-text-'));

  try {
    const { preflight, preflightPath } = await writeValidPreflight(tempRoot);
    await writeFile(preflightPath, `${JSON.stringify({
      ...preflight,
      endpointUrl: 'https://private.example.test',
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
      adapterDependency: {
        ...preflight.adapterDependency,
        backendKind: 's3-compatible',
        remoteWriteAllowed: true,
        liveCheckAllowed: true,
        uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key'
      }
    }, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'upload-mock-harness',
      preflightPath
    ]));

    assert.match(output, /Knowledge team upload mock harness/);
    assert.match(output, /status: blocked/);
    assert.match(output, /remote write: no/);
    assert.match(output, /upload execution allowed: no/);
    assert.match(output, /client created: no/);
    assert.match(output, /adapter injected: no/);
    assert.match(output, /object write attempted: no/);
    assert.match(output, /metadata index write attempted: no/);
    assert.match(output, /remote mutation performed: no/);
    assert.match(output, /upload command: none/);
    assert.match(output, /backend-detail-leak/);
    assert.match(output, /real-backend-not-implemented/);
    assert.match(output, /adapter-remote-write-enabled/);
    assert.match(output, /adapter-upload-command-present/);
    assertNoPrivateValues(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
