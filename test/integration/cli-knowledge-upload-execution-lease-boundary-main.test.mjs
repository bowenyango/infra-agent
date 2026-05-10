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
    'lease-secret-value'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

async function buildValidPrerequisitePlan() {
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
  return buildKnowledgeTeamUploadExecutionPrerequisitePlan({ approvalReview });
}

async function buildValidWriteTokenBoundary() {
  const prerequisitePlan = await buildValidPrerequisitePlan();
  return buildKnowledgeTeamUploadWriteTokenBoundary({ prerequisitePlan });
}

async function writeValidInput(tempRoot) {
  const writeTokenBoundary = await buildValidWriteTokenBoundary();
  const writeTokenBoundaryPath = join(tempRoot, 'knowledge-pack.upload-write-token-boundary.json');
  await writeFile(writeTokenBoundaryPath, `${JSON.stringify(writeTokenBoundary, null, 2)}\n`, 'utf8');
  return { writeTokenBoundary, writeTokenBoundaryPath };
}

test('knowledge upload-execution-lease-boundary command writes valid dry-run boundary JSON', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-execution-lease-'));

  try {
    const { writeTokenBoundary, writeTokenBoundaryPath } = await writeValidInput(tempRoot);
    const boundaryPath = join(tempRoot, 'knowledge-pack.upload-execution-lease-boundary.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'upload-execution-lease-boundary',
      writeTokenBoundaryPath,
      '--out',
      boundaryPath,
      '--json'
    ]));
    const outputPayload = JSON.parse(output);
    const boundary = JSON.parse(await readFile(boundaryPath, 'utf8'));
    const validation = validateKnowledgePayload(boundary, boundaryPath);

    assert.equal(outputPayload.outputPath, boundaryPath);
    assert.equal(boundary.outputPath, undefined);
    assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-execution-lease-boundary');
    assert.equal(boundary.status, 'execution-lease-boundary-ready');
    assert.equal(boundary.readiness.nextAction, 'design-rollback-plan-boundary');
    assert.equal(boundary.sourceWriteTokenBoundary.boundaryStatus, 'write-token-boundary-ready');
    assert.equal(boundary.sourceWriteTokenBoundary.boundaryNextAction, 'design-execution-lease-boundary');
    assert.equal(boundary.sourceWriteTokenBoundary.humanReviewRecorded, true);
    assert.equal(boundary.sourceWriteTokenBoundary.fingerprintVerified, true);
    assert.equal(boundary.target.manifestId, writeTokenBoundary.target.manifestId);
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
    assert.equal(boundary.executionLeaseBoundary.executionLeaseRequiredBeforeExecution, true);
    assert.equal(boundary.executionLeaseBoundary.executionLeaseCreated, false);
    assert.equal(boundary.executionLeaseBoundary.leaseScopeBoundToArtifact, false);
    assert.equal(boundary.executionLeaseBoundary.singleUseLeaseCreated, false);
    assert.equal(boundary.executionLeaseBoundary.leaseExpirySet, false);
    assert.equal(boundary.executionLeaseBoundary.rollbackPlanCreated, false);
    assert.equal(boundary.executionLeaseBoundary.executable, false);
    assert.equal(validation.valid, true);
    assertNoPrivateValues({ outputPayload, boundary });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge upload-execution-lease-boundary command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-execution-lease-text-'));

  try {
    const { writeTokenBoundary, writeTokenBoundaryPath } = await writeValidInput(tempRoot);
    await writeFile(writeTokenBoundaryPath, `${JSON.stringify({
      ...writeTokenBoundary,
      endpointUrl: 'https://private.example.test',
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
      uploadApproved: true,
      uploadExecutionAllowed: true,
      writeTokenIssued: true,
      executionLeaseCreated: true,
      artifactBytesProvided: true,
      auditRecordCreated: true,
      clientCreated: true,
      remoteMutationPerformed: true,
      sourcePrerequisitePlan: {
        ...writeTokenBoundary.sourcePrerequisitePlan,
        fingerprintVerified: false
      },
      writeTokenBoundary: {
        ...writeTokenBoundary.writeTokenBoundary,
        tokenIssued: true,
        tokenScopeBoundToArtifact: true,
        tokenExpirySet: true,
        auditBindingCreated: true,
        executionLeaseCreated: true,
        rollbackPlanCreated: true
      },
      remainingExecutionBoundaries: {
        ...writeTokenBoundary.remainingExecutionBoundaries,
        executionLeaseCreated: true,
        rollbackPlanCreated: true,
        auditRecordCreated: true,
        objectWriteAllowed: true,
        metadataIndexWriteAllowed: true,
        remoteMutationAllowed: true
      },
      executionLeaseBoundary: {
        executionLeaseCreated: true,
        leaseScopeBoundToArtifact: true,
        singleUseLeaseCreated: true,
        leaseExpirySet: true,
        writeTokenIssued: true,
        auditBindingCreated: true,
        rollbackPlanCreated: true,
        executable: true,
        leaseMaterial: 'lease-secret-value'
      }
    }, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'upload-execution-lease-boundary',
      writeTokenBoundaryPath
    ]));

    assert.match(output, /Knowledge team upload execution lease boundary/);
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
    assert.match(output, /token-scope-already-bound/);
    assert.match(output, /token-expiry-already-set/);
    assert.match(output, /audit-binding-created/);
    assert.match(output, /rollback-plan-created/);
    assert.match(output, /object-write-attempted/);
    assert.match(output, /metadata-index-write-attempted/);
    assert.match(output, /lease-scope-already-bound/);
    assert.match(output, /lease-expiry-already-set/);
    assertNoPrivateValues(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
