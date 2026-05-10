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

async function writeValidContinuation(tempRoot) {
  const fixture = await buildKnowledgeTeamArtifactContractFixture();
  const intent = buildKnowledgeTeamUploadApprovalIntent({
    publicationReadiness: fixture.uploadRequiredReadiness,
    backendReferenceValidation: validBackendReferenceSummary()
  });
  const continuation = buildKnowledgeTeamUploadApprovalContinuation({
    approvalIntent: intent,
    approvalFingerprint: intent.approvalFingerprint.value
  });
  const continuationPath = join(tempRoot, 'knowledge-pack.upload-continuation.json');
  await writeFile(continuationPath, `${JSON.stringify(continuation, null, 2)}\n`, 'utf8');
  return { continuation, continuationPath };
}

async function writeMockAdapterPlan(tempRoot) {
  const adapterResolutionPlan = planKnowledgeTeamBackendAdapterResolution(
    buildMockKnowledgeTeamBackendAdapterConfig('mock-team-cache')
  );
  const adapterPlanPath = join(tempRoot, 'team-backend.adapter-plan.json');
  await writeFile(adapterPlanPath, `${JSON.stringify(adapterResolutionPlan, null, 2)}\n`, 'utf8');
  return { adapterResolutionPlan, adapterPlanPath };
}

test('knowledge upload-adapter-preflight command writes valid preflight JSON', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-adapter-preflight-'));

  try {
    const { continuationPath } = await writeValidContinuation(tempRoot);
    const { adapterPlanPath } = await writeMockAdapterPlan(tempRoot);
    const preflightPath = join(tempRoot, 'knowledge-pack.upload-adapter-preflight.json');

    await withEnvValues({
      INFRA_AGENT_TEAM_CACHE_S3_ENDPOINT_URL: 'https://should-not-read.example.test',
      INFRA_AGENT_TEAM_CACHE_S3_BUCKET_NAME: 'should-not-read-bucket',
      INFRA_AGENT_TEAM_CACHE_S3_SECRET_ACCESS_KEY: 'should-not-read-secret'
    }, async () => {
      const output = await captureStdout(() => main([
        'knowledge',
        'upload-adapter-preflight',
        continuationPath,
        '--adapter-plan',
        adapterPlanPath,
        '--out',
        preflightPath,
        '--json'
      ]));
      const outputPayload = JSON.parse(output);
      const preflight = JSON.parse(await readFile(preflightPath, 'utf8'));
      const validation = validateKnowledgePayload(preflight, preflightPath);

      assert.equal(outputPayload.outputPath, preflightPath);
      assert.equal(preflight.outputPath, undefined);
      assert.equal(preflight.kind, 'infra-agent.knowledge-team-upload-adapter-preflight');
      assert.equal(preflight.status, 'preflight-ready');
      assert.equal(preflight.remoteWriteAllowed, false);
      assert.equal(preflight.liveCheckAllowed, false);
      assert.equal(preflight.credentialValuesExposed, false);
      assert.equal(preflight.credentialPresenceChecked, false);
      assert.equal(preflight.uploadApproved, false);
      assert.equal(preflight.uploadExecutionAllowed, false);
      assert.equal(preflight.clientCreated, false);
      assert.equal(preflight.adapterInjected, false);
      assert.equal(preflight.uploadCommand, null);
      assert.equal(preflight.adapterDependency.injectionCandidate, true);
      assert.equal(validation.valid, true);
      assertNoPrivateValues({ outputPayload, preflight });
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge upload-adapter-preflight command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-adapter-preflight-text-'));

  try {
    const { continuation, continuationPath } = await writeValidContinuation(tempRoot);
    const { adapterResolutionPlan, adapterPlanPath } = await writeMockAdapterPlan(tempRoot);
    await writeFile(continuationPath, `${JSON.stringify({
      ...continuation,
      endpointUrl: 'https://private.example.test',
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key'
    }, null, 2)}\n`, 'utf8');
    await writeFile(adapterPlanPath, `${JSON.stringify({
      ...adapterResolutionPlan,
      bucketName: 'private-bucket',
      capabilities: {
        ...adapterResolutionPlan.capabilities,
        remoteWriteAllowed: true,
        uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key'
      }
    }, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'upload-adapter-preflight',
      continuationPath,
      '--adapter-plan',
      adapterPlanPath
    ]));

    assert.match(output, /Knowledge team upload adapter preflight/);
    assert.match(output, /status: blocked/);
    assert.match(output, /remote write: no/);
    assert.match(output, /upload execution allowed: no/);
    assert.match(output, /client created: no/);
    assert.match(output, /adapter injected: no/);
    assert.match(output, /upload command: none/);
    assert.match(output, /backend-detail-leak/);
    assert.match(output, /adapter-remote-write-enabled/);
    assert.match(output, /adapter-upload-command-present/);
    assertNoPrivateValues(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
