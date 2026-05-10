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
  buildKnowledgeTeamUploadMutationApprovalReview
} from '../../src/knowledge/team-upload-mutation-approval-review.ts';
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

function assertNoPrivateValues(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const forbidden of [
    'https://should-not-read.example.test',
    'should-not-read-bucket',
    'should-not-read-secret',
    'https://private.example.test',
    'aws s3 cp',
    's3://private-bucket',
    'private-key'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

async function buildValidApprovalReview() {
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
  const mutationPlan = buildKnowledgeTeamUploadMutationPlan({ executionGate });
  return buildKnowledgeTeamUploadMutationApprovalReview({
    mutationPlan,
    approvalFingerprint: mutationPlan.approvalAudit.approvalScopeFingerprint.value
  });
}

async function writeValidInput(tempRoot) {
  const approvalReview = await buildValidApprovalReview();
  const approvalReviewPath = join(tempRoot, 'knowledge-pack.upload-mutation-approval-review.json');
  await writeFile(approvalReviewPath, `${JSON.stringify(approvalReview, null, 2)}\n`, 'utf8');
  return { approvalReview, approvalReviewPath };
}

test('knowledge upload-execution-prerequisite-plan command writes valid dry-run plan JSON', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-execution-prereq-'));

  try {
    const { approvalReview, approvalReviewPath } = await writeValidInput(tempRoot);
    const planPath = join(tempRoot, 'knowledge-pack.upload-execution-prerequisite-plan.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'upload-execution-prerequisite-plan',
      approvalReviewPath,
      '--out',
      planPath,
      '--json'
    ]));
    const outputPayload = JSON.parse(output);
    const plan = JSON.parse(await readFile(planPath, 'utf8'));
    const validation = validateKnowledgePayload(plan, planPath);

    assert.equal(outputPayload.outputPath, planPath);
    assert.equal(plan.outputPath, undefined);
    assert.equal(plan.kind, 'infra-agent.knowledge-team-upload-execution-prerequisite-plan');
    assert.equal(plan.status, 'prerequisite-plan-ready');
    assert.equal(plan.sourceReview.reviewStatus, 'review-ready');
    assert.equal(plan.sourceReview.humanReviewRecorded, true);
    assert.equal(plan.sourceReview.fingerprintVerified, true);
    assert.equal(plan.sourceReview.expectedFingerprint, approvalReview.approvalReview.expectedFingerprint);
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
    assert.equal(plan.auditRecordCreated, false);
    assert.equal(plan.objectWriteAttempted, false);
    assert.equal(plan.metadataIndexWriteAttempted, false);
    assert.equal(plan.remoteMutationPerformed, false);
    assert.equal(plan.uploadCommand, null);
    assert.equal(plan.executionBoundary.artifactBytesRequiredBeforeExecution, true);
    assert.equal(plan.executionBoundary.writeTokenRequiredBeforeExecution, true);
    assert.equal(plan.executionBoundary.executionLeaseRequiredBeforeExecution, true);
    assert.equal(plan.executionBoundary.rollbackPlanRequiredBeforeExecution, true);
    assert.equal(plan.executionBoundary.auditRecordRequiredBeforeExecution, true);
    assert.equal(plan.executionBoundary.executable, false);
    assert.equal(validation.valid, true);
    assertNoPrivateValues({ outputPayload, plan });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge upload-execution-prerequisite-plan command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-execution-prereq-text-'));

  try {
    const { approvalReview, approvalReviewPath } = await writeValidInput(tempRoot);
    await writeFile(approvalReviewPath, `${JSON.stringify({
      ...approvalReview,
      endpointUrl: 'https://private.example.test',
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
      uploadApproved: true,
      uploadExecutionAllowed: true,
      writeTokenIssued: true,
      executionLeaseCreated: true,
      approvalReview: {
        ...approvalReview.approvalReview,
        fingerprintVerified: false
      },
      executionBoundary: {
        ...approvalReview.executionBoundary,
        artifactBytesProvided: true,
        auditRecordCreated: true,
        clientCreated: true,
        remoteMutationPerformed: true
      }
    }, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'upload-execution-prerequisite-plan',
      approvalReviewPath
    ]));

    assert.match(output, /Knowledge team upload execution prerequisite plan/);
    assert.match(output, /status: blocked/);
    assert.match(output, /remote write: no/);
    assert.match(output, /upload approved: no/);
    assert.match(output, /upload execution allowed: no/);
    assert.match(output, /mutation approval granted: no/);
    assert.match(output, /artifact bytes provided: no/);
    assert.match(output, /write token issued: no/);
    assert.match(output, /execution lease created: no/);
    assert.match(output, /rollback plan created: no/);
    assert.match(output, /audit record created: no/);
    assert.match(output, /executable: no/);
    assert.match(output, /upload command: none/);
    assert.match(output, /review-fingerprint-unverified/);
    assert.match(output, /backend-detail-leak/);
    assert.match(output, /upload-command-present/);
    assert.match(output, /write-token-issued/);
    assert.match(output, /execution-lease-created/);
    assert.match(output, /artifact-bytes-provided/);
    assert.match(output, /audit-record-created/);
    assert.match(output, /client-created/);
    assert.match(output, /remote-mutation-performed/);
    assertNoPrivateValues(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
