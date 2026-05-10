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
  buildKnowledgeTeamUploadExecutionLeaseBoundary
} from '../../src/knowledge/team-upload-execution-lease-boundary.ts';
import {
  buildKnowledgeTeamUploadExecutionPrerequisitePlan
} from '../../src/knowledge/team-upload-execution-prerequisite-plan.ts';
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
  buildKnowledgeTeamUploadWriteTokenBoundary
} from '../../src/knowledge/team-upload-write-token-boundary.ts';
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
    'private-key',
    'rollback-secret-value'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

async function buildValidExecutionLeaseBoundary() {
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
  const approvalReview = buildKnowledgeTeamUploadMutationApprovalReview({
    mutationPlan,
    approvalFingerprint: mutationPlan.approvalAudit.approvalScopeFingerprint.value
  });
  const prerequisitePlan = buildKnowledgeTeamUploadExecutionPrerequisitePlan({ approvalReview });
  const writeTokenBoundary = buildKnowledgeTeamUploadWriteTokenBoundary({ prerequisitePlan });
  return buildKnowledgeTeamUploadExecutionLeaseBoundary({ writeTokenBoundary });
}

async function writeValidInput(tempRoot) {
  const executionLeaseBoundary = await buildValidExecutionLeaseBoundary();
  const executionLeaseBoundaryPath = join(tempRoot, 'knowledge-pack.upload-execution-lease-boundary.json');
  await writeFile(executionLeaseBoundaryPath, `${JSON.stringify(executionLeaseBoundary, null, 2)}\n`, 'utf8');
  return { executionLeaseBoundary, executionLeaseBoundaryPath };
}

test('knowledge upload-rollback-plan-boundary command writes valid dry-run boundary JSON', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-rollback-plan-'));

  try {
    const { executionLeaseBoundary, executionLeaseBoundaryPath } = await writeValidInput(tempRoot);
    const boundaryPath = join(tempRoot, 'knowledge-pack.upload-rollback-plan-boundary.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'upload-rollback-plan-boundary',
      executionLeaseBoundaryPath,
      '--out',
      boundaryPath,
      '--json'
    ]));
    const outputPayload = JSON.parse(output);
    const boundary = JSON.parse(await readFile(boundaryPath, 'utf8'));
    const validation = validateKnowledgePayload(boundary, boundaryPath);

    assert.equal(outputPayload.outputPath, boundaryPath);
    assert.equal(boundary.outputPath, undefined);
    assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-rollback-plan-boundary');
    assert.equal(boundary.status, 'rollback-plan-boundary-ready');
    assert.equal(boundary.readiness.nextAction, 'design-audit-record-boundary');
    assert.equal(boundary.sourceExecutionLeaseBoundary.boundaryStatus, 'execution-lease-boundary-ready');
    assert.equal(boundary.sourceExecutionLeaseBoundary.boundaryNextAction, 'design-rollback-plan-boundary');
    assert.equal(boundary.sourceExecutionLeaseBoundary.humanReviewRecorded, true);
    assert.equal(boundary.sourceExecutionLeaseBoundary.fingerprintVerified, true);
    assert.equal(boundary.target.manifestId, executionLeaseBoundary.target.manifestId);
    assert.equal(boundary.remoteWriteAllowed, false);
    assert.equal(boundary.liveCheckAllowed, false);
    assert.equal(boundary.credentialValuesExposed, false);
    assert.equal(boundary.credentialPresenceChecked, false);
    assert.equal(boundary.uploadApproved, false);
    assert.equal(boundary.uploadExecutionAllowed, false);
    assert.equal(boundary.mutationApprovalGranted, false);
    assert.equal(boundary.clientCreated, false);
    assert.equal(boundary.adapterInjected, false);
    assert.equal(boundary.artifactBytesProvided, false);
    assert.equal(boundary.writeTokenIssued, false);
    assert.equal(boundary.executionLeaseCreated, false);
    assert.equal(boundary.rollbackPlanCreated, false);
    assert.equal(boundary.auditRecordCreated, false);
    assert.equal(boundary.objectWriteAttempted, false);
    assert.equal(boundary.metadataIndexWriteAttempted, false);
    assert.equal(boundary.remoteMutationPerformed, false);
    assert.equal(boundary.uploadCommand, null);
    assert.equal(boundary.rollbackPlanBoundary.rollbackPlanRequiredBeforeExecution, true);
    assert.equal(boundary.rollbackPlanBoundary.rollbackPlanCreated, false);
    assert.equal(boundary.rollbackPlanBoundary.rollbackScopeBoundToArtifact, false);
    assert.equal(boundary.rollbackPlanBoundary.rollbackReviewed, false);
    assert.equal(boundary.rollbackPlanBoundary.executable, false);
    assert.equal(validation.valid, true);
    assertNoPrivateValues({ outputPayload, boundary });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge upload-rollback-plan-boundary command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-rollback-plan-text-'));

  try {
    const { executionLeaseBoundary, executionLeaseBoundaryPath } = await writeValidInput(tempRoot);
    await writeFile(executionLeaseBoundaryPath, `${JSON.stringify({
      ...executionLeaseBoundary,
      endpointUrl: 'https://private.example.test',
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
      uploadApproved: true,
      uploadExecutionAllowed: true,
      writeTokenIssued: true,
      executionLeaseCreated: true,
      rollbackPlanCreated: true,
      artifactBytesProvided: true,
      auditRecordCreated: true,
      clientCreated: true,
      remoteMutationPerformed: true,
      sourceWriteTokenBoundary: {
        ...executionLeaseBoundary.sourceWriteTokenBoundary,
        fingerprintVerified: false
      },
      executionLeaseBoundary: {
        ...executionLeaseBoundary.executionLeaseBoundary,
        executionLeaseCreated: true,
        leaseScopeBoundToArtifact: true,
        singleUseLeaseCreated: true,
        leaseExpirySet: true,
        writeTokenIssued: true,
        auditBindingCreated: true,
        rollbackPlanCreated: true,
        executable: true
      },
      remainingExecutionBoundaries: {
        ...executionLeaseBoundary.remainingExecutionBoundaries,
        artifactBytesProvided: true,
        adapterInjected: true,
        writeTokenIssued: true,
        executionLeaseCreated: true,
        rollbackPlanCreated: true,
        auditRecordCreated: true,
        objectWriteAllowed: true,
        metadataIndexWriteAllowed: true,
        remoteMutationAllowed: true
      },
      rollbackPlanBoundary: {
        rollbackPlanCreated: true,
        rollbackScopeBoundToArtifact: true,
        rollbackReviewed: true,
        writeTokenIssued: true,
        executionLeaseCreated: true,
        artifactBytesProvided: true,
        auditBindingCreated: true,
        auditRecordCreated: true,
        executable: true,
        rollbackMaterial: 'rollback-secret-value'
      }
    }, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'upload-rollback-plan-boundary',
      executionLeaseBoundaryPath
    ]));

    assert.match(output, /Knowledge team upload rollback plan boundary/);
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
    assert.match(output, /rollback-plan-created/);
    assert.match(output, /artifact-bytes-provided/);
    assert.match(output, /audit-record-created/);
    assert.match(output, /client-created/);
    assert.match(output, /remote-mutation-performed/);
    assert.match(output, /lease-scope-already-bound/);
    assert.match(output, /lease-expiry-already-set/);
    assert.match(output, /rollback-scope-already-bound/);
    assert.match(output, /rollback-review-already-recorded/);
    assert.match(output, /object-write-attempted/);
    assert.match(output, /metadata-index-write-attempted/);
    assertNoPrivateValues(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
