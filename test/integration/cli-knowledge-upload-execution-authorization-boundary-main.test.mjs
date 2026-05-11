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
  buildKnowledgeTeamUploadAdapterInjectionBoundary
} from '../../src/knowledge/team-upload-adapter-injection-boundary.ts';
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
  buildKnowledgeTeamUploadArtifactBytesBoundary
} from '../../src/knowledge/team-upload-artifact-bytes-boundary.ts';
import {
  buildKnowledgeTeamUploadAuditRecordBoundary
} from '../../src/knowledge/team-upload-audit-record-boundary.ts';
import {
  buildKnowledgeTeamUploadClientCreationBoundary
} from '../../src/knowledge/team-upload-client-creation-boundary.ts';
import {
  buildKnowledgeTeamUploadCommandBoundary
} from '../../src/knowledge/team-upload-command-boundary.ts';
import {
  buildKnowledgeTeamUploadCredentialPresenceBoundary
} from '../../src/knowledge/team-upload-credential-presence-boundary.ts';
import {
  buildKnowledgeTeamUploadCredentialReadBoundary
} from '../../src/knowledge/team-upload-credential-read-boundary.ts';
import {
  buildKnowledgeTeamUploadExecutionApprovalRecord
} from '../../src/knowledge/team-upload-execution-approval-record.ts';
import {
  buildKnowledgeTeamUploadExecutionApprovalRequest
} from '../../src/knowledge/team-upload-execution-approval-request.ts';
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
  buildKnowledgeTeamUploadExecutionReadinessBoundary
} from '../../src/knowledge/team-upload-execution-readiness-boundary.ts';
import {
  buildKnowledgeTeamUploadLiveCheckBoundary
} from '../../src/knowledge/team-upload-live-check-boundary.ts';
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
  buildKnowledgeTeamUploadObjectIndexBindingBoundary
} from '../../src/knowledge/team-upload-object-index-binding-boundary.ts';
import {
  buildKnowledgeTeamUploadRollbackPlanBoundary
} from '../../src/knowledge/team-upload-rollback-plan-boundary.ts';
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

async function validExecutionApprovalRecord() {
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
  const executionLeaseBoundary = buildKnowledgeTeamUploadExecutionLeaseBoundary({ writeTokenBoundary });
  const rollbackPlanBoundary = buildKnowledgeTeamUploadRollbackPlanBoundary({ executionLeaseBoundary });
  const auditRecordBoundary = buildKnowledgeTeamUploadAuditRecordBoundary({ rollbackPlanBoundary });
  const artifactBytesBoundary = buildKnowledgeTeamUploadArtifactBytesBoundary({ auditRecordBoundary });
  const adapterInjectionBoundary = buildKnowledgeTeamUploadAdapterInjectionBoundary({ artifactBytesBoundary });
  const clientCreationBoundary = buildKnowledgeTeamUploadClientCreationBoundary({ adapterInjectionBoundary });
  const credentialReadBoundary = buildKnowledgeTeamUploadCredentialReadBoundary({ clientCreationBoundary });
  const credentialPresenceBoundary = buildKnowledgeTeamUploadCredentialPresenceBoundary({ credentialReadBoundary });
  const liveCheckBoundary = buildKnowledgeTeamUploadLiveCheckBoundary({ credentialPresenceBoundary });
  const commandBoundary = buildKnowledgeTeamUploadCommandBoundary({ liveCheckBoundary });
  const objectIndexBindingBoundary = buildKnowledgeTeamUploadObjectIndexBindingBoundary({ commandBoundary });
  const executionReadinessBoundary = buildKnowledgeTeamUploadExecutionReadinessBoundary({ objectIndexBindingBoundary });
  const executionApprovalRequest = buildKnowledgeTeamUploadExecutionApprovalRequest({ executionReadinessBoundary });
  return buildKnowledgeTeamUploadExecutionApprovalRecord({
    executionApprovalRequest,
    approvalFingerprint: executionApprovalRequest.approvalRequest.fingerprint.value
  });
}

function assertNoPrivateValues(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const forbidden of [
    'https://private.example.test',
    'should-not-read-secret',
    'aws s3 cp',
    's3://private-bucket',
    'private-key',
    'private-live-check-output',
    'metadataIndex.put',
    'should-not-copy-bucket',
    'signed-upload-command',
    'authorization-secret-value'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

async function writeValidInput(tempRoot) {
  const executionApprovalRecord = await validExecutionApprovalRecord();
  const executionApprovalRecordPath = join(tempRoot, 'knowledge-pack.upload-execution-approval-record.json');
  await writeFile(executionApprovalRecordPath, `${JSON.stringify(executionApprovalRecord, null, 2)}\n`, 'utf8');
  return { executionApprovalRecord, executionApprovalRecordPath };
}

test('knowledge upload-execution-authorization-boundary command writes valid dry-run boundary JSON', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-execution-authorization-boundary-'));

  try {
    const { executionApprovalRecord, executionApprovalRecordPath } = await writeValidInput(tempRoot);
    const boundaryPath = join(tempRoot, 'knowledge-pack.upload-execution-authorization-boundary.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'upload-execution-authorization-boundary',
      executionApprovalRecordPath,
      '--out',
      boundaryPath,
      '--json'
    ]));
    const outputPayload = JSON.parse(output);
    const boundary = JSON.parse(await readFile(boundaryPath, 'utf8'));
    const validation = validateKnowledgePayload(boundary, boundaryPath);

    assert.equal(outputPayload.outputPath, boundaryPath);
    assert.equal(boundary.outputPath, undefined);
    assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-execution-authorization-boundary');
    assert.equal(boundary.status, 'upload-execution-authorization-boundary-ready');
    assert.equal(boundary.readiness.nextAction, 'await-plan-rules-update-for-upload-execution');
    assert.equal(boundary.sourceApprovalRecord.recordStatus, 'upload-execution-approval-record-ready');
    assert.equal(boundary.sourceApprovalRecord.recordNextAction, 'design-upload-execution-authorization-boundary');
    assert.equal(boundary.sourceApprovalRecord.humanApprovalRecorded, true);
    assert.equal(boundary.sourceApprovalRecord.approvalFingerprintVerified, true);
    assert.equal(boundary.sourceApprovalRecord.approvalGranted, false);
    assert.equal(boundary.sourceApprovalRecord.recordFingerprint.value, executionApprovalRecord.approvalRecord.recordFingerprint.value);
    assert.equal(boundary.authorizationBoundary.uploadExecutionAuthorizationRequired, true);
    assert.equal(boundary.authorizationBoundary.authorizationBoundaryDesigned, true);
    assert.equal(boundary.authorizationBoundary.authorizationGranted, false);
    assert.equal(boundary.authorizationBoundary.executionAuthorizationGranted, false);
    assert.equal(/^[a-f0-9]{64}$/.test(boundary.authorizationBoundary.authorizationBoundaryFingerprint.value), true);
    assert.equal(boundary.authorizationBoundary.authorizationBoundaryFingerprint.canonicalFieldCount, 16);
    assert.equal(boundary.target.objectKeyRedacted, true);
    assert.equal(boundary.target.objectKey, undefined);
    assert.equal(boundary.remoteWriteAllowed, false);
    assert.equal(boundary.uploadApproved, false);
    assert.equal(boundary.uploadExecutionApproved, false);
    assert.equal(boundary.uploadExecutionAllowed, false);
    assert.equal(boundary.mutationApprovalGranted, false);
    assert.equal(boundary.executionBoundary.executable, false);
    assert.equal(boundary.executionBoundary.objectWriteAllowed, false);
    assert.equal(boundary.executionBoundary.metadataIndexWriteAllowed, false);
    assert.equal(validation.valid, true);
    assertNoPrivateValues({ outputPayload, boundary });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge upload-execution-authorization-boundary command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-execution-authorization-boundary-text-'));

  try {
    const { executionApprovalRecord, executionApprovalRecordPath } = await writeValidInput(tempRoot);
    await writeFile(executionApprovalRecordPath, `${JSON.stringify({
      ...executionApprovalRecord,
      endpointUrl: 'https://private.example.test',
      objectStoreHandle: {
        bucket: 'should-not-copy-bucket'
      },
      metadataIndexHandle: {
        putEntry: 'metadataIndex.put'
      },
      clientConfig: {
        sdkClient: 'should-not-read-secret'
      },
      uploadCommandPayload: 'aws s3 cp private.json s3://private-bucket/private-key',
      executionAuthorizationValue: 'authorization-secret-value',
      uploadExecutionApproved: true,
      uploadExecutionAllowed: true,
      approvalRecord: {
        ...executionApprovalRecord.approvalRecord,
        approvalGranted: true
      },
      readiness: {
        ...executionApprovalRecord.readiness,
        nextAction: 'resolve-blockers',
        blockerCount: 1,
        blockerCodes: ['upload-execution-approval-already-provided'],
        blockers: [{
          code: 'upload-execution-approval-already-provided',
          path: '$.uploadExecutionApproved',
          message: 'blocked'
        }]
      }
    }, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'upload-execution-authorization-boundary',
      executionApprovalRecordPath
    ]));

    assert.match(output, /Knowledge team upload execution authorization boundary/);
    assert.match(output, /status: blocked/);
    assert.match(output, /next action: resolve-blockers/);
    assert.match(output, /upload command: none/);
    assert.match(output, /upload execution approved: no/);
    assert.match(output, /upload execution allowed: no/);
    assert.match(output, /authorization modeled: no/);
    assert.match(output, /execution authorization granted: no/);
    assert.match(output, /upload-execution-approval-already-provided/);
    assert.match(output, /upload-execution-enabled/);
    assert.match(output, /authorization-already-granted/);
    assert.match(output, /authorization-material-leak/);
    assertNoPrivateValues(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
