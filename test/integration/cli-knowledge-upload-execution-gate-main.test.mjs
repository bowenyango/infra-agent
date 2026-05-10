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
  buildKnowledgeTeamUploadMockHarness
} from '../../src/knowledge/team-upload-mock-harness.ts';
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

async function buildValidContinuationAndHarness() {
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
  const preflight = buildKnowledgeTeamUploadAdapterPreflight({
    continuation,
    adapterResolutionPlan
  });
  const mockHarness = buildKnowledgeTeamUploadMockHarness({ preflight });
  return { continuation, mockHarness };
}

async function writeValidInputs(tempRoot) {
  const { continuation, mockHarness } = await buildValidContinuationAndHarness();
  const continuationPath = join(tempRoot, 'knowledge-pack.upload-continuation.json');
  const mockHarnessPath = join(tempRoot, 'knowledge-pack.upload-mock-harness.json');
  await writeFile(continuationPath, `${JSON.stringify(continuation, null, 2)}\n`, 'utf8');
  await writeFile(mockHarnessPath, `${JSON.stringify(mockHarness, null, 2)}\n`, 'utf8');
  return {
    continuation,
    continuationPath,
    mockHarness,
    mockHarnessPath
  };
}

test('knowledge upload-execution-gate command writes valid dry-run gate JSON', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-execution-gate-'));

  try {
    const { continuationPath, mockHarnessPath } = await writeValidInputs(tempRoot);
    const gatePath = join(tempRoot, 'knowledge-pack.upload-execution-gate.json');

    await withEnvValues({
      INFRA_AGENT_TEAM_CACHE_S3_ENDPOINT_URL: 'https://should-not-read.example.test',
      INFRA_AGENT_TEAM_CACHE_S3_BUCKET_NAME: 'should-not-read-bucket',
      INFRA_AGENT_TEAM_CACHE_S3_SECRET_ACCESS_KEY: 'should-not-read-secret'
    }, async () => {
      const output = await captureStdout(() => main([
        'knowledge',
        'upload-execution-gate',
        continuationPath,
        '--mock-harness',
        mockHarnessPath,
        '--out',
        gatePath,
        '--json'
      ]));
      const outputPayload = JSON.parse(output);
      const gate = JSON.parse(await readFile(gatePath, 'utf8'));
      const validation = validateKnowledgePayload(gate, gatePath);

      assert.equal(outputPayload.outputPath, gatePath);
      assert.equal(gate.outputPath, undefined);
      assert.equal(gate.kind, 'infra-agent.knowledge-team-upload-execution-gate');
      assert.equal(gate.status, 'gate-ready');
      assert.equal(gate.remoteWriteAllowed, false);
      assert.equal(gate.liveCheckAllowed, false);
      assert.equal(gate.credentialValuesExposed, false);
      assert.equal(gate.credentialPresenceChecked, false);
      assert.equal(gate.uploadApproved, false);
      assert.equal(gate.uploadExecutionAllowed, false);
      assert.equal(gate.clientCreated, false);
      assert.equal(gate.adapterInjected, false);
      assert.equal(gate.writeTokenIssued, false);
      assert.equal(gate.executionLeaseCreated, false);
      assert.equal(gate.objectWriteAttempted, false);
      assert.equal(gate.metadataIndexWriteAttempted, false);
      assert.equal(gate.remoteMutationPerformed, false);
      assert.equal(gate.uploadCommand, null);
      assert.equal(gate.approvalGate.mutationApprovalGranted, false);
      assert.equal(gate.approvalGate.uploadApproved, false);
      assert.equal(gate.approvalGate.uploadExecutionAllowed, false);
      assert.equal(gate.mockHarness.objectWriteAttempted, false);
      assert.equal(gate.mockHarness.indexWriteAttempted, false);
      assert.equal(gate.mockHarness.remoteMutationPerformed, false);
      assert.equal(gate.executionBoundary.artifactBytesProvided, false);
      assert.equal(gate.executionBoundary.writeTokenIssued, false);
      assert.equal(gate.executionBoundary.executionLeaseCreated, false);
      assert.equal(gate.executionBoundary.objectWriteAttempted, false);
      assert.equal(gate.executionBoundary.metadataIndexWriteAttempted, false);
      assert.equal(gate.executionBoundary.remoteMutationPerformed, false);
      assert.equal(validation.valid, true);
      assertNoPrivateValues({ outputPayload, gate });
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge upload-execution-gate command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-execution-gate-text-'));

  try {
    const {
      continuation,
      continuationPath,
      mockHarness,
      mockHarnessPath
    } = await writeValidInputs(tempRoot);
    await writeFile(continuationPath, `${JSON.stringify({
      ...continuation,
      endpointUrl: 'https://private.example.test',
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
      remoteWriteAllowed: true,
      uploadExecutionAllowed: true
    }, null, 2)}\n`, 'utf8');
    await writeFile(mockHarnessPath, `${JSON.stringify({
      ...mockHarness,
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
      objectWriteAttempted: true,
      metadataIndexWriteAttempted: true,
      remoteMutationPerformed: true,
      mockHarness: {
        ...mockHarness.mockHarness,
        objectWriteAttempted: true,
        indexWriteAttempted: true,
        remoteMutationPerformed: true
      }
    }, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'upload-execution-gate',
      continuationPath,
      '--mock-harness',
      mockHarnessPath
    ]));

    assert.match(output, /Knowledge team upload execution gate/);
    assert.match(output, /status: blocked/);
    assert.match(output, /remote write: no/);
    assert.match(output, /upload execution allowed: no/);
    assert.match(output, /write token issued: no/);
    assert.match(output, /execution lease created: no/);
    assert.match(output, /object write attempted: no/);
    assert.match(output, /metadata index write attempted: no/);
    assert.match(output, /remote mutation performed: no/);
    assert.match(output, /mutation approval granted: no/);
    assert.match(output, /upload command: none/);
    assert.match(output, /backend-detail-leak/);
    assert.match(output, /upload-command-present/);
    assert.match(output, /remote-write-enabled/);
    assert.match(output, /upload-execution-enabled/);
    assert.match(output, /object-write-attempted/);
    assert.match(output, /metadata-index-write-attempted/);
    assert.match(output, /remote-mutation-performed/);
    assertNoPrivateValues(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
