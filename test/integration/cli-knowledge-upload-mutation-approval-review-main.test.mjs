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
  buildKnowledgeTeamUploadMutationPlan
} from '../../src/knowledge/team-upload-mutation-plan.ts';
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

async function buildValidMutationPlan() {
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
  const executionGate = buildKnowledgeTeamUploadExecutionGate({
    continuation,
    mockHarness
  });
  return buildKnowledgeTeamUploadMutationPlan({ executionGate });
}

async function writeValidInput(tempRoot) {
  const mutationPlan = await buildValidMutationPlan();
  const mutationPlanPath = join(tempRoot, 'knowledge-pack.upload-mutation-plan.json');
  await writeFile(mutationPlanPath, `${JSON.stringify(mutationPlan, null, 2)}\n`, 'utf8');
  return { mutationPlan, mutationPlanPath };
}

test('knowledge upload-mutation-approval-review command writes valid dry-run review JSON', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-mutation-review-'));

  try {
    const { mutationPlan, mutationPlanPath } = await writeValidInput(tempRoot);
    const reviewPath = join(tempRoot, 'knowledge-pack.upload-mutation-approval-review.json');

    await withEnvValues({
      INFRA_AGENT_TEAM_CACHE_S3_ENDPOINT_URL: 'https://should-not-read.example.test',
      INFRA_AGENT_TEAM_CACHE_S3_BUCKET_NAME: 'should-not-read-bucket',
      INFRA_AGENT_TEAM_CACHE_S3_SECRET_ACCESS_KEY: 'should-not-read-secret'
    }, async () => {
      const output = await captureStdout(() => main([
        'knowledge',
        'upload-mutation-approval-review',
        mutationPlanPath,
        '--approval-fingerprint',
        mutationPlan.approvalAudit.approvalScopeFingerprint.value,
        '--out',
        reviewPath,
        '--json'
      ]));
      const outputPayload = JSON.parse(output);
      const review = JSON.parse(await readFile(reviewPath, 'utf8'));
      const validation = validateKnowledgePayload(review, reviewPath);

      assert.equal(outputPayload.outputPath, reviewPath);
      assert.equal(review.outputPath, undefined);
      assert.equal(review.kind, 'infra-agent.knowledge-team-upload-mutation-approval-review');
      assert.equal(review.status, 'review-ready');
      assert.equal(review.remoteWriteAllowed, false);
      assert.equal(review.liveCheckAllowed, false);
      assert.equal(review.credentialValuesExposed, false);
      assert.equal(review.credentialPresenceChecked, false);
      assert.equal(review.uploadApproved, false);
      assert.equal(review.uploadExecutionAllowed, false);
      assert.equal(review.mutationApprovalGranted, false);
      assert.equal(review.clientCreated, false);
      assert.equal(review.adapterInjected, false);
      assert.equal(review.artifactBytesProvided, false);
      assert.equal(review.writeTokenIssued, false);
      assert.equal(review.executionLeaseCreated, false);
      assert.equal(review.rollbackPlanCreated, false);
      assert.equal(review.objectWriteAttempted, false);
      assert.equal(review.metadataIndexWriteAttempted, false);
      assert.equal(review.remoteMutationPerformed, false);
      assert.equal(review.uploadCommand, null);
      assert.equal(review.approvalReview.humanReviewRecorded, true);
      assert.equal(review.approvalReview.fingerprintVerified, true);
      assert.equal(review.approvalReview.mutationApprovalGranted, false);
      assert.equal(review.approvalReview.uploadApproved, false);
      assert.equal(review.approvalReview.uploadExecutionAllowed, false);
      assert.equal(review.executionBoundary.executable, false);
      assert.equal(review.executionBoundary.artifactBytesProvided, false);
      assert.equal(review.executionBoundary.writeTokenIssued, false);
      assert.equal(review.executionBoundary.executionLeaseCreated, false);
      assert.equal(review.executionBoundary.remoteMutationPerformed, false);
      assert.equal(validation.valid, true);
      assertNoPrivateValues({ outputPayload, review });
    });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge upload-mutation-approval-review command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-mutation-review-text-'));

  try {
    const { mutationPlan, mutationPlanPath } = await writeValidInput(tempRoot);
    await writeFile(mutationPlanPath, `${JSON.stringify({
      ...mutationPlan,
      endpointUrl: 'https://private.example.test',
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
      writeTokenIssued: true,
      executionLeaseCreated: true,
      approvalAudit: {
        ...mutationPlan.approvalAudit,
        mutationApprovalGranted: true
      },
      executionPlan: {
        ...mutationPlan.executionPlan,
        artifactBytesProvided: true,
        clientCreated: true,
        remoteMutationPerformed: true
      }
    }, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'upload-mutation-approval-review',
      mutationPlanPath,
      '--approval-fingerprint',
      '0'.repeat(64)
    ]));

    assert.match(output, /Knowledge team upload mutation approval review/);
    assert.match(output, /status: blocked/);
    assert.match(output, /remote write: no/);
    assert.match(output, /upload approved: no/);
    assert.match(output, /upload execution allowed: no/);
    assert.match(output, /mutation approval granted: no/);
    assert.match(output, /artifact bytes provided: no/);
    assert.match(output, /write token issued: no/);
    assert.match(output, /execution lease created: no/);
    assert.match(output, /executable: no/);
    assert.match(output, /human review recorded: no/);
    assert.match(output, /fingerprint verified: no/);
    assert.match(output, /upload command: none/);
    assert.match(output, /review-fingerprint-mismatch/);
    assert.match(output, /backend-detail-leak/);
    assert.match(output, /upload-command-present/);
    assert.match(output, /write-token-issued/);
    assert.match(output, /execution-lease-created/);
    assert.match(output, /artifact-bytes-provided/);
    assert.match(output, /client-created/);
    assert.match(output, /remote-mutation-performed/);
    assertNoPrivateValues(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
