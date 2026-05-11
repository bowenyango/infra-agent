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

function validPlanRulesReview() {
  return buildKnowledgeTeamUploadExecutionPlanRulesReview({
    executionAuthorizationBoundary: validAuthorizationBoundary()
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
    'team-artifacts/public-reference/aa/bb/private-key.json'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

test('knowledge record-upload-execution-plan-rules-update command writes valid dry-run record JSON', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'infra-agent-plan-rules-update-record-'));
  try {
    const review = validPlanRulesReview();
    const reviewPath = join(tempRoot, 'knowledge-pack.upload-execution-plan-rules-review.json');
    const recordPath = join(tempRoot, 'knowledge-pack.upload-execution-plan-rules-update-record.json');
    await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'record-upload-execution-plan-rules-update',
      reviewPath,
      '--review-fingerprint',
      review.planRulesReview.reviewFingerprint.value,
      '--out',
      recordPath,
      '--json'
    ]));

    const stdoutPayload = JSON.parse(output);
    assert.equal(stdoutPayload.outputPath, recordPath);

    const record = JSON.parse(await readFile(recordPath, 'utf8'));
    assert.equal(Object.hasOwn(record, 'outputPath'), false);
    assert.equal(record.kind, 'infra-agent.knowledge-team-upload-execution-plan-rules-update-record');
    assert.equal(record.status, 'upload-execution-plan-rules-update-record-ready');
    assert.equal(record.readiness.nextAction, 'design-upload-execution-implementation-boundary');
    assert.equal(record.target.objectKeyRedacted, true);
    assert.equal(Object.hasOwn(record.target, 'objectKey'), false);
    assert.equal(record.uploadCommand, null);
    assert.equal(record.uploadExecutionAllowed, false);
    assert.equal(record.sourcePlanRulesReview.authorizationGranted, false);
    assert.equal(record.sourcePlanRulesReview.executionAuthorizationGranted, false);
    assert.equal(record.sourcePlanRulesReview.uploadExecutionAllowed, false);
    assert.equal(record.planRulesUpdateRecord.planRulesUpdateRecorded, true);
    assert.equal(record.planRulesUpdateRecord.rulesUpdateReviewed, true);
    assert.equal(record.planRulesUpdateRecord.policyUpdateAuthorized, false);
    assert.equal(record.planRulesUpdateRecord.fingerprintVerified, true);
    assert.equal(record.planRulesUpdateRecord.suppliedFingerprint, review.planRulesReview.reviewFingerprint.value);
    assert.equal(record.executionBoundary.executable, false);
    assert.equal(record.executionBoundary.uploadCommandGenerated, false);
    assert.equal(record.executionBoundary.objectWriteAllowed, false);
    assert.equal(validateKnowledgePayload(record, recordPath).valid, true);
    assertNoPrivateValues(JSON.stringify(record));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge record-upload-execution-plan-rules-update command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'infra-agent-plan-rules-update-record-'));
  try {
    const review = validPlanRulesReview();
    const reviewPath = join(tempRoot, 'knowledge-pack.upload-execution-plan-rules-review.json');
    await writeFile(reviewPath, `${JSON.stringify({
      ...review,
      uploadExecutionAllowed: true,
      target: {
        ...review.target,
        objectKey: 'team-artifacts/public-reference/aa/bb/private-key.json'
      },
      backendEndpointUrl: 'https://should-not-copy.example.test',
      bucket: 'should-not-copy-bucket',
      secretValue: 'should-not-copy-secret',
      credentialValue: 'credential-secret-value',
      liveCheckResult: 'private-live-check-output',
      uploadCommandPayload: 'aws s3 cp file s3://private-bucket/key',
      signedUploadCommand: 'signed-upload-command',
      authorizationMaterial: 'authorization-secret-value',
      objectStoreHandle: { putObject: true },
      planRulesReview: {
        ...review.planRulesReview,
        planRulesUpdated: true,
        rulesUpdateReviewed: true
      },
      executionBoundary: {
        ...review.executionBoundary,
        uploadCommandGenerated: true,
        objectWriteAllowed: true
      }
    }, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'record-upload-execution-plan-rules-update',
      reviewPath,
      '--review-fingerprint',
      'd'.repeat(64)
    ]));

    assert.match(output, /Knowledge team upload execution plan\/rules update record/);
    assert.match(output, /status: blocked/);
    assert.match(output, /next action: resolve-blockers/);
    assert.match(output, /remote write: no/);
    assert.match(output, /upload command: none/);
    assert.match(output, /policy update authorized: no/);
    assert.match(output, /review fingerprint verified: no/);
    assert.match(output, /review-fingerprint-mismatch/);
    assert.match(output, /upload-execution-enabled/);
    assert.match(output, /unsafe-artifact-reference/);
    assertNoPrivateValues(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
