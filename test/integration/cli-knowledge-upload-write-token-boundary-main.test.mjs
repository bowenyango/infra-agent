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

async function writeValidInput(tempRoot) {
  const prerequisitePlan = await buildValidPrerequisitePlan();
  const prerequisitePlanPath = join(tempRoot, 'knowledge-pack.upload-execution-prerequisite-plan.json');
  await writeFile(prerequisitePlanPath, `${JSON.stringify(prerequisitePlan, null, 2)}\n`, 'utf8');
  return { prerequisitePlan, prerequisitePlanPath };
}

test('knowledge upload-write-token-boundary command writes valid dry-run boundary JSON', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-write-token-'));

  try {
    const { prerequisitePlan, prerequisitePlanPath } = await writeValidInput(tempRoot);
    const boundaryPath = join(tempRoot, 'knowledge-pack.upload-write-token-boundary.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'upload-write-token-boundary',
      prerequisitePlanPath,
      '--out',
      boundaryPath,
      '--json'
    ]));
    const outputPayload = JSON.parse(output);
    const boundary = JSON.parse(await readFile(boundaryPath, 'utf8'));
    const validation = validateKnowledgePayload(boundary, boundaryPath);

    assert.equal(outputPayload.outputPath, boundaryPath);
    assert.equal(boundary.outputPath, undefined);
    assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-write-token-boundary');
    assert.equal(boundary.status, 'write-token-boundary-ready');
    assert.equal(boundary.sourcePrerequisitePlan.prerequisiteStatus, 'prerequisite-plan-ready');
    assert.equal(boundary.sourcePrerequisitePlan.prerequisiteNextAction, 'design-write-token-boundary');
    assert.equal(boundary.sourcePrerequisitePlan.humanReviewRecorded, true);
    assert.equal(boundary.sourcePrerequisitePlan.fingerprintVerified, true);
    assert.equal(boundary.target.manifestId, prerequisitePlan.target.manifestId);
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
    assert.equal(boundary.writeTokenBoundary.tokenRequiredBeforeExecution, true);
    assert.equal(boundary.writeTokenBoundary.tokenIssued, false);
    assert.equal(boundary.writeTokenBoundary.tokenScopeBoundToArtifact, false);
    assert.equal(boundary.writeTokenBoundary.executable, false);
    assert.equal(validation.valid, true);
    assertNoPrivateValues({ outputPayload, boundary });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge upload-write-token-boundary command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-write-token-text-'));

  try {
    const { prerequisitePlan, prerequisitePlanPath } = await writeValidInput(tempRoot);
    await writeFile(prerequisitePlanPath, `${JSON.stringify({
      ...prerequisitePlan,
      endpointUrl: 'https://private.example.test',
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
      uploadApproved: true,
      uploadExecutionAllowed: true,
      writeTokenIssued: true,
      executionLeaseCreated: true,
      sourceReview: {
        ...prerequisitePlan.sourceReview,
        fingerprintVerified: false
      },
      executionBoundary: {
        ...prerequisitePlan.executionBoundary,
        artifactBytesProvided: true,
        auditRecordCreated: true,
        clientCreated: true,
        remoteMutationPerformed: true
      },
      writeTokenBoundary: {
        tokenIssued: true,
        tokenScopeBoundToArtifact: true,
        tokenExpirySet: true
      }
    }, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'upload-write-token-boundary',
      prerequisitePlanPath
    ]));

    assert.match(output, /Knowledge team upload write-token boundary/);
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
    assertNoPrivateValues(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
