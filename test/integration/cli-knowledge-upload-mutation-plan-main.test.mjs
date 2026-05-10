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
  buildKnowledgeTeamUploadExecutionGate
} from '../../src/knowledge/team-upload-execution-gate.ts';
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

async function buildValidExecutionGate() {
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
  return buildKnowledgeTeamUploadExecutionGate({ continuation, mockHarness });
}

async function writeValidInput(tempRoot) {
  const gate = await buildValidExecutionGate();
  const gatePath = join(tempRoot, 'knowledge-pack.upload-execution-gate.json');
  await writeFile(gatePath, `${JSON.stringify(gate, null, 2)}\n`, 'utf8');
  return { gate, gatePath };
}

test('knowledge upload-mutation-plan command writes valid dry-run plan JSON', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-mutation-plan-'));

  try {
    const { gatePath } = await writeValidInput(tempRoot);
    const planPath = join(tempRoot, 'knowledge-pack.upload-mutation-plan.json');

    await withEnvValues({
      INFRA_AGENT_TEAM_CACHE_S3_ENDPOINT_URL: 'https://should-not-read.example.test',
      INFRA_AGENT_TEAM_CACHE_S3_BUCKET_NAME: 'should-not-read-bucket',
      INFRA_AGENT_TEAM_CACHE_S3_SECRET_ACCESS_KEY: 'should-not-read-secret'
    }, async () => {
      const output = await captureStdout(() => main([
        'knowledge',
        'upload-mutation-plan',
        gatePath,
        '--out',
        planPath,
        '--json'
      ]));
      const outputPayload = JSON.parse(output);
      const plan = JSON.parse(await readFile(planPath, 'utf8'));
      const validation = validateKnowledgePayload(plan, planPath);

      assert.equal(outputPayload.outputPath, planPath);
      assert.equal(plan.outputPath, undefined);
      assert.equal(plan.kind, 'infra-agent.knowledge-team-upload-mutation-plan');
      assert.equal(plan.status, 'plan-ready');
      assert.equal(plan.remoteWriteAllowed, false);
      assert.equal(plan.liveCheckAllowed, false);
      assert.equal(plan.credentialValuesExposed, false);
      assert.equal(plan.credentialPresenceChecked, false);
      assert.equal(plan.uploadApproved, false);
      assert.equal(plan.uploadExecutionAllowed, false);
      assert.equal(plan.mutationApprovalGranted, false);
      assert.equal(plan.clientCreated, false);
      assert.equal(plan.adapterInjected, false);
      assert.equal(plan.artifactBytesProvided, false);
      assert.equal(plan.writeTokenIssued, false);
      assert.equal(plan.executionLeaseCreated, false);
      assert.equal(plan.rollbackPlanCreated, false);
      assert.equal(plan.objectWriteAttempted, false);
      assert.equal(plan.metadataIndexWriteAttempted, false);
      assert.equal(plan.remoteMutationPerformed, false);
      assert.equal(plan.uploadCommand, null);
      assert.equal(plan.approvalAudit.mutationApprovalGranted, false);
      assert.equal(plan.approvalAudit.humanApprovalRequestIssued, false);
      assert.equal(plan.approvalAudit.uploadApproved, false);
      assert.equal(plan.approvalAudit.uploadExecutionAllowed, false);
      assert.equal(plan.executionPlan.executable, false);
      assert.equal(plan.executionPlan.artifactBytesProvided, false);
      assert.equal(plan.executionPlan.writeTokenIssued, false);
      assert.equal(plan.executionPlan.executionLeaseCreated, false);
      assert.equal(plan.executionPlan.rollbackPlanCreated, false);
      assert.equal(plan.executionPlan.remoteMutationPerformed, false);
      assert.equal(validation.valid, true);
      assertNoPrivateValues({ outputPayload, plan });
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge upload-mutation-plan command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-mutation-plan-text-'));

  try {
    const { gate, gatePath } = await writeValidInput(tempRoot);
    await writeFile(gatePath, `${JSON.stringify({
      ...gate,
      sourceUrl: 'https://private.example.test',
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
      writeTokenIssued: true,
      executionLeaseCreated: true,
      rollbackPlanCreated: true,
      approvalGate: {
        ...gate.approvalGate,
        mutationApprovalGranted: true,
        uploadExecutionAllowed: true
      },
      executionBoundary: {
        ...gate.executionBoundary,
        artifactBytesProvided: true,
        writeTokenIssued: true,
        executionLeaseCreated: true,
        remoteMutationPerformed: true
      }
    }, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'upload-mutation-plan',
      gatePath
    ]));

    assert.match(output, /Knowledge team upload mutation plan/);
    assert.match(output, /status: blocked/);
    assert.match(output, /remote write: no/);
    assert.match(output, /upload execution allowed: no/);
    assert.match(output, /mutation approval granted: no/);
    assert.match(output, /artifact bytes provided: no/);
    assert.match(output, /write token issued: no/);
    assert.match(output, /execution lease created: no/);
    assert.match(output, /rollback plan created: no/);
    assert.match(output, /executable: no/);
    assert.match(output, /upload command: none/);
    assert.match(output, /backend-detail-leak/);
    assert.match(output, /upload-command-present/);
    assert.match(output, /write-token-issued/);
    assert.match(output, /execution-lease-created/);
    assert.match(output, /rollback-plan-created/);
    assert.match(output, /mutation-approval-already-granted/);
    assert.match(output, /upload-execution-enabled/);
    assert.match(output, /artifact-bytes-provided/);
    assert.match(output, /remote-mutation-performed/);
    assertNoPrivateValues(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
