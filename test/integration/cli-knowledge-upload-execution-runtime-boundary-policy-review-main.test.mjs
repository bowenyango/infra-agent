import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureStdout } from '../support/capture-stdout.mjs';
import {
  buildKnowledgeTeamUploadExecutionPlanRulesReview
} from '../../src/knowledge/team-upload-execution-plan-rules-review.ts';
import {
  buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord
} from '../../src/knowledge/team-upload-execution-plan-rules-update-record.ts';
import {
  buildKnowledgeTeamUploadExecutionImplementationBoundary
} from '../../src/knowledge/team-upload-execution-implementation-boundary.ts';
import {
  buildKnowledgeTeamUploadExecutionRuntimeBoundaries
} from '../../src/knowledge/team-upload-execution-runtime-boundaries.ts';
import {
  validateKnowledgePayload
} from '../../src/knowledge/validate.ts';
import { main } from '../../src/cli/main.ts';

const SAFE_ID = '0123456789abcdef01234567';
const SAFE_ARTIFACT_ID = 'abcdef0123456789abcdef01';
const SAFE_SHA = 'a'.repeat(64);
const SOURCE_APPROVAL_RECORD_FINGERPRINT = 'b'.repeat(64);
const SOURCE_AUTHORIZATION_FINGERPRINT = 'c'.repeat(64);

function validAuthorizationBoundary() {
  return {
    kind: 'infra-agent.knowledge-team-upload-execution-authorization-boundary',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    boundaryKind: 'upload-execution-authorization-boundary-dry-run',
    status: 'upload-execution-authorization-boundary-ready',
    plannedOperation: 'stage-knowledge-pack',
    remoteWriteAllowed: false,
    liveCheckAllowed: false,
    credentialValuesExposed: false,
    credentialPresenceChecked: false,
    uploadApproved: false,
    uploadExecutionApproved: false,
    uploadExecutionAllowed: false,
    mutationApprovalGranted: false,
    clientCreated: false,
    adapterInjected: false,
    artifactBytesProvided: false,
    writeTokenIssued: false,
    executionLeaseCreated: false,
    rollbackPlanCreated: false,
    auditRecordCreated: false,
    objectWriteAttempted: false,
    metadataIndexWriteAttempted: false,
    remoteMutationPerformed: false,
    uploadCommand: null,
    target: {
      manifestId: SAFE_ID,
      objectKeyRedacted: true,
      objectSha256: SAFE_SHA,
      artifactId: SAFE_ARTIFACT_ID
    },
    sourceApprovalRecord: {
      scopeMatched: true,
      adapterName: 'mock-team-cache',
      adapterBackendKind: 'mock-s3-compatible'
    },
    authorizationBoundary: {
      dryRunOnly: true,
      uploadExecutionAuthorizationRequired: true,
      humanApprovalRecorded: true,
      approvalFingerprintVerified: true,
      authorizationBoundaryDesigned: true,
      authorizationGranted: false,
      executionAuthorizationGranted: false,
      approvalGranted: false,
      uploadApproved: false,
      uploadExecutionApproved: false,
      uploadExecutionAllowed: false,
      mutationApprovalGranted: false,
      executable: false,
      objectWriteAllowed: false,
      metadataIndexWriteAllowed: false,
      objectWriteAttempted: false,
      metadataIndexWriteAttempted: false,
      remoteMutationPerformed: false,
      sourceApprovalRecordFingerprint: {
        algorithm: 'sha256',
        scope: 'stage-knowledge-pack-upload-execution-approval-record-v1',
        value: SOURCE_APPROVAL_RECORD_FINGERPRINT,
        canonicalFieldCount: 14
      },
      authorizationBoundaryFingerprint: {
        algorithm: 'sha256',
        scope: 'stage-knowledge-pack-upload-execution-authorization-boundary-v1',
        value: SOURCE_AUTHORIZATION_FINGERPRINT,
        canonicalFieldCount: 16
      }
    },
    executionBoundary: {
      dryRunOnly: true,
      executable: false,
      artifactBytesProvided: false,
      adapterInjected: false,
      clientCreated: false,
      credentialValuesRead: false,
      credentialValuesExposed: false,
      credentialPresenceChecked: false,
      credentialPresenceResultExposed: false,
      liveCheckAllowed: false,
      liveCheckPerformed: false,
      liveCheckResultExposed: false,
      uploadCommandGenerated: false,
      uploadCommandMaterialized: false,
      uploadCommandExposed: false,
      artifactObjectStoreBound: false,
      metadataIndexBound: false,
      objectStoreHandleExposed: false,
      metadataIndexHandleExposed: false,
      objectWriteAllowed: false,
      metadataIndexWriteAllowed: false,
      objectWriteAttempted: false,
      metadataIndexWriteAttempted: false,
      writeTokenIssued: false,
      executionLeaseCreated: false,
      rollbackPlanCreated: false,
      auditRecordCreated: false,
      remoteMutationPerformed: false
    },
    readiness: {
      status: 'upload-execution-authorization-boundary-ready',
      nextAction: 'await-plan-rules-update-for-upload-execution',
      blockerCount: 0,
      blockerCodes: [],
      blockers: [],
      reason: 'ready'
    }
  };
}

function validRuntimeBoundaries() {
  const review = buildKnowledgeTeamUploadExecutionPlanRulesReview({
    executionAuthorizationBoundary: validAuthorizationBoundary()
  });
  const updateRecord = buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord({
    planRulesReview: review,
    reviewFingerprint: review.planRulesReview.reviewFingerprint.value
  });
  const implementationBoundary = buildKnowledgeTeamUploadExecutionImplementationBoundary({
    planRulesUpdateRecord: updateRecord
  });
  return buildKnowledgeTeamUploadExecutionRuntimeBoundaries({
    implementationBoundary
  });
}

function assertNoPrivateValues(text) {
  for (const forbidden of [
    'https://should-not-copy.example.test',
    'should-not-copy-bucket',
    'should-not-copy-secret',
    'credential-secret-value',
    'private-live-check-output',
    'aws s3 cp',
    's3://private-bucket',
    'signed-upload-command',
    'authorization-secret-value',
    'runtime-secret-value',
    'policy-update-secret',
    'team-artifacts/public-reference/aa/bb/private-key.json'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

test('knowledge upload-execution-runtime-boundary-policy-review command writes valid dry-run review JSON', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'infra-agent-runtime-policy-review-'));
  try {
    const runtimeBoundaries = validRuntimeBoundaries();
    const runtimeBoundariesPath = join(tempRoot, 'knowledge-pack.upload-execution-runtime-boundaries.json');
    const reviewPath = join(tempRoot, 'knowledge-pack.upload-execution-runtime-boundary-policy-review.json');
    await writeFile(runtimeBoundariesPath, `${JSON.stringify(runtimeBoundaries, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'upload-execution-runtime-boundary-policy-review',
      runtimeBoundariesPath,
      '--out',
      reviewPath,
      '--json'
    ]));

    const stdoutPayload = JSON.parse(output);
    assert.equal(stdoutPayload.outputPath, reviewPath);

    const review = JSON.parse(await readFile(reviewPath, 'utf8'));
    assert.equal(Object.hasOwn(review, 'outputPath'), false);
    assert.equal(review.kind, 'infra-agent.knowledge-team-upload-execution-runtime-boundary-policy-review');
    assert.equal(review.status, 'upload-execution-runtime-boundary-policy-review-ready');
    assert.equal(review.readiness.nextAction, 'await-explicit-upload-execution-runtime-boundary-policy-update');
    assert.equal(review.target.objectKeyRedacted, true);
    assert.equal(Object.hasOwn(review.target, 'objectKey'), false);
    assert.equal(review.uploadCommand, null);
    assert.equal(review.uploadExecutionAllowed, false);
    assert.equal(review.sourceRuntimeBoundaries.boundaryStatus, 'upload-execution-runtime-boundaries-ready');
    assert.equal(review.sourceRuntimeBoundaries.boundaryNextAction, 'await-explicit-upload-execution-runtime-boundary-policy-review');
    assert.equal(review.sourceRuntimeBoundaries.runtimeBoundariesDesigned, true);
    assert.equal(review.sourceRuntimeBoundaries.sourceImplementationBoundaryFingerprintVerified, true);
    assert.equal(review.sourceRuntimeBoundaries.runtimeExecutionAllowed, false);
    assert.equal(review.runtimeBoundaryPolicyReview.runtimeBoundaryPolicyReviewed, true);
    assert.equal(review.runtimeBoundaryPolicyReview.runtimeBoundaryPolicyUpdated, false);
    assert.equal(review.runtimeBoundaryPolicyReview.policyUpdateAuthorized, false);
    assert.equal(review.executionBoundary.executable, false);
    assert.equal(review.executionBoundary.uploadCommandGenerated, false);
    assert.equal(review.executionBoundary.objectWriteAllowed, false);
    assert.equal(validateKnowledgePayload(review, reviewPath).valid, true);
    assertNoPrivateValues(JSON.stringify(review));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge upload-execution-runtime-boundary-policy-review command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'infra-agent-runtime-policy-review-'));
  try {
    const runtimeBoundaries = validRuntimeBoundaries();
    const runtimeBoundariesPath = join(tempRoot, 'knowledge-pack.upload-execution-runtime-boundaries.json');
    await writeFile(runtimeBoundariesPath, `${JSON.stringify({
      ...runtimeBoundaries,
      uploadExecutionAllowed: true,
      uploadCommand: 'signed-upload-command',
      runtimeBoundaryPolicyUpdated: true,
      policyUpdateAuthorized: true,
      target: {
        ...runtimeBoundaries.target,
        objectKey: 'team-artifacts/public-reference/aa/bb/private-key.json'
      },
      backendEndpointUrl: 'https://should-not-copy.example.test',
      bucket: 'should-not-copy-bucket',
      secretValue: 'should-not-copy-secret',
      credentialValue: 'credential-secret-value',
      liveCheckResult: 'private-live-check-output',
      uploadCommandPayload: 'aws s3 cp file s3://private-bucket/key',
      authorizationMaterial: 'authorization-secret-value',
      runtimeSecret: 'runtime-secret-value',
      policyUpdatePayload: 'policy-update-secret',
      objectStoreHandle: { putObject: true },
      runtimeBoundaries: {
        ...runtimeBoundaries.runtimeBoundaries,
        runtimeExecutionAllowed: true,
        sourceImplementationBoundaryFingerprintVerified: false
      },
      executionBoundary: {
        ...runtimeBoundaries.executionBoundary,
        uploadCommandGenerated: true,
        objectWriteAllowed: true
      }
    }, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'upload-execution-runtime-boundary-policy-review',
      runtimeBoundariesPath
    ]));

    assert.match(output, /Knowledge team upload execution runtime-boundary policy review/);
    assert.match(output, /status: blocked/);
    assert.match(output, /next action: resolve-blockers/);
    assert.match(output, /remote write: no/);
    assert.match(output, /upload command: none/);
    assert.match(output, /policy reviewed: no/);
    assert.match(output, /policy updated: no/);
    assert.match(output, /runtime execution prohibited: yes/);
    assert.match(output, /upload-execution-enabled/);
    assert.match(output, /unsafe-artifact-reference/);
    assert.match(output, /policy-update-already-recorded/);
    assert.match(output, /object-store-handle-leak/);
    assertNoPrivateValues(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
