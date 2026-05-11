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

function validImplementationBoundary() {
  const review = buildKnowledgeTeamUploadExecutionPlanRulesReview({
    executionAuthorizationBoundary: validAuthorizationBoundary()
  });
  const updateRecord = buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord({
    planRulesReview: review,
    reviewFingerprint: review.planRulesReview.reviewFingerprint.value
  });
  return buildKnowledgeTeamUploadExecutionImplementationBoundary({
    planRulesUpdateRecord: updateRecord
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
    'team-artifacts/public-reference/aa/bb/private-key.json'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

test('knowledge upload-execution-runtime-boundaries command writes valid dry-run boundary JSON', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'infra-agent-runtime-boundaries-'));
  try {
    const implementationBoundary = validImplementationBoundary();
    const implementationBoundaryPath = join(tempRoot, 'knowledge-pack.upload-execution-implementation-boundary.json');
    const runtimeBoundariesPath = join(tempRoot, 'knowledge-pack.upload-execution-runtime-boundaries.json');
    await writeFile(implementationBoundaryPath, `${JSON.stringify(implementationBoundary, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'upload-execution-runtime-boundaries',
      implementationBoundaryPath,
      '--out',
      runtimeBoundariesPath,
      '--json'
    ]));

    const stdoutPayload = JSON.parse(output);
    assert.equal(stdoutPayload.outputPath, runtimeBoundariesPath);

    const boundary = JSON.parse(await readFile(runtimeBoundariesPath, 'utf8'));
    assert.equal(Object.hasOwn(boundary, 'outputPath'), false);
    assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-execution-runtime-boundaries');
    assert.equal(boundary.status, 'upload-execution-runtime-boundaries-ready');
    assert.equal(boundary.readiness.nextAction, 'await-explicit-upload-execution-runtime-boundary-policy-review');
    assert.equal(boundary.target.objectKeyRedacted, true);
    assert.equal(Object.hasOwn(boundary.target, 'objectKey'), false);
    assert.equal(boundary.uploadCommand, null);
    assert.equal(boundary.uploadExecutionAllowed, false);
    assert.equal(boundary.sourceImplementationBoundary.boundaryStatus, 'upload-execution-implementation-boundary-ready');
    assert.equal(boundary.sourceImplementationBoundary.boundaryNextAction, 'design-upload-execution-runtime-boundaries');
    assert.equal(boundary.sourceImplementationBoundary.implementationBoundaryDesigned, true);
    assert.equal(boundary.sourceImplementationBoundary.sourceUpdateRecordFingerprintVerified, true);
    assert.equal(boundary.sourceImplementationBoundary.runtimeBoundaryDesignRequired, true);
    assert.equal(boundary.sourceImplementationBoundary.implementationAllowed, false);
    assert.equal(boundary.runtimeBoundaries.runtimeBoundariesDesigned, true);
    assert.equal(boundary.runtimeBoundaries.sourceImplementationBoundaryFingerprintVerified, true);
    assert.equal(boundary.runtimeBoundaries.runtimeExecutionAllowed, false);
    assert.equal(boundary.runtimeBoundaries.uploadExecutionAllowed, false);
    assert.equal(boundary.runtimeBoundaries.executable, false);
    assert.equal(boundary.executionBoundary.executable, false);
    assert.equal(boundary.executionBoundary.uploadCommandGenerated, false);
    assert.equal(boundary.executionBoundary.artifactObjectStoreBound, false);
    assert.equal(boundary.executionBoundary.metadataIndexBound, false);
    assert.equal(boundary.executionBoundary.objectWriteAllowed, false);
    assert.equal(validateKnowledgePayload(boundary, runtimeBoundariesPath).valid, true);
    assertNoPrivateValues(JSON.stringify(boundary));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge upload-execution-runtime-boundaries command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), 'infra-agent-runtime-boundaries-'));
  try {
    const implementationBoundary = validImplementationBoundary();
    const implementationBoundaryPath = join(tempRoot, 'knowledge-pack.upload-execution-implementation-boundary.json');
    await writeFile(implementationBoundaryPath, `${JSON.stringify({
      ...implementationBoundary,
      uploadExecutionAllowed: true,
      target: {
        ...implementationBoundary.target,
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
      runtimeSecret: 'runtime-secret-value',
      objectStoreHandle: { putObject: true },
      implementationBoundary: {
        ...implementationBoundary.implementationBoundary,
        implementationAllowed: true,
        executable: true
      },
      executionBoundary: {
        ...implementationBoundary.executionBoundary,
        uploadCommandGenerated: true,
        artifactObjectStoreBound: true,
        metadataIndexBound: true,
        objectWriteAllowed: true
      }
    }, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'upload-execution-runtime-boundaries',
      implementationBoundaryPath
    ]));

    assert.match(output, /Knowledge team upload execution runtime boundaries/);
    assert.match(output, /status: blocked/);
    assert.match(output, /next action: resolve-blockers/);
    assert.match(output, /remote write: no/);
    assert.match(output, /upload command: none/);
    assert.match(output, /runtime execution allowed: no/);
    assert.match(output, /executable: no/);
    assert.match(output, /upload-execution-enabled/);
    assert.match(output, /unsafe-artifact-reference/);
    assert.match(output, /object-store-handle-leak/);
    assertNoPrivateValues(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
