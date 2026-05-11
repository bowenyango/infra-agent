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

async function validExecutionApprovalRequest() {
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
  return buildKnowledgeTeamUploadExecutionApprovalRequest({ executionReadinessBoundary });
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
    'signed-upload-command'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

async function writeValidInput(tempRoot) {
  const executionApprovalRequest = await validExecutionApprovalRequest();
  const executionApprovalRequestPath = join(tempRoot, 'knowledge-pack.upload-execution-approval-request.json');
  await writeFile(executionApprovalRequestPath, `${JSON.stringify(executionApprovalRequest, null, 2)}\n`, 'utf8');
  return { executionApprovalRequest, executionApprovalRequestPath };
}

test('knowledge record-human-upload-execution-approval command writes valid dry-run record JSON', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-execution-approval-record-'));

  try {
    const { executionApprovalRequest, executionApprovalRequestPath } = await writeValidInput(tempRoot);
    const recordPath = join(tempRoot, 'knowledge-pack.upload-execution-approval-record.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'record-human-upload-execution-approval',
      executionApprovalRequestPath,
      '--approval-fingerprint',
      executionApprovalRequest.approvalRequest.fingerprint.value,
      '--out',
      recordPath,
      '--json'
    ]));
    const outputPayload = JSON.parse(output);
    const record = JSON.parse(await readFile(recordPath, 'utf8'));
    const validation = validateKnowledgePayload(record, recordPath);

    assert.equal(outputPayload.outputPath, recordPath);
    assert.equal(record.outputPath, undefined);
    assert.equal(record.kind, 'infra-agent.knowledge-team-upload-execution-approval-record');
    assert.equal(record.status, 'upload-execution-approval-record-ready');
    assert.equal(record.readiness.nextAction, 'design-upload-execution-authorization-boundary');
    assert.equal(record.sourceApprovalRequest.requestStatus, 'upload-execution-approval-request-ready');
    assert.equal(record.sourceApprovalRequest.requestNextAction, 'record-human-upload-execution-approval');
    assert.equal(record.sourceApprovalRequest.requestIssued, true);
    assert.equal(record.sourceApprovalRequest.requestHumanApprovalRecorded, false);
    assert.equal(record.sourceApprovalRequest.requestApprovalGranted, false);
    assert.equal(record.sourceApprovalRequest.requestFingerprintVerified, false);
    assert.equal(record.approvalRecord.humanApprovalRecorded, true);
    assert.equal(record.approvalRecord.approvalGranted, false);
    assert.equal(record.approvalRecord.source, 'cli-flag');
    assert.equal(record.approvalRecord.suppliedFingerprint, executionApprovalRequest.approvalRequest.fingerprint.value);
    assert.equal(record.approvalRecord.expectedFingerprint, executionApprovalRequest.approvalRequest.fingerprint.value);
    assert.equal(record.approvalRecord.fingerprintVerified, true);
    assert.equal(/^[a-f0-9]{64}$/.test(record.approvalRecord.recordFingerprint.value), true);
    assert.equal(record.approvalRecord.recordFingerprint.canonicalFieldCount, 14);
    assert.equal(record.target.objectKeyRedacted, true);
    assert.equal(record.target.objectKey, undefined);
    assert.equal(record.remoteWriteAllowed, false);
    assert.equal(record.uploadApproved, false);
    assert.equal(record.uploadExecutionApproved, false);
    assert.equal(record.uploadExecutionAllowed, false);
    assert.equal(record.executionBoundary.executable, false);
    assert.equal(record.executionBoundary.objectWriteAllowed, false);
    assert.equal(record.executionBoundary.metadataIndexWriteAllowed, false);
    assert.equal(validation.valid, true);
    assertNoPrivateValues({ outputPayload, record });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge record-human-upload-execution-approval command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-execution-approval-record-text-'));

  try {
    const { executionApprovalRequest, executionApprovalRequestPath } = await writeValidInput(tempRoot);
    await writeFile(executionApprovalRequestPath, `${JSON.stringify({
      ...executionApprovalRequest,
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
      uploadExecutionApproved: true,
      approvalRequest: {
        ...executionApprovalRequest.approvalRequest,
        approvalGranted: true
      },
      readiness: {
        ...executionApprovalRequest.readiness,
        nextAction: 'resolve-blockers',
        blockerCount: 1,
        blockerCodes: ['upload-execution-approval-already-provided'],
        blockers: [{
          code: 'upload-execution-approval-already-provided',
          path: '$.uploadExecutionApproved',
          message: 'execution approval already provided'
        }]
      }
    }, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'record-human-upload-execution-approval',
      executionApprovalRequestPath,
      '--approval-fingerprint',
      executionApprovalRequest.approvalRequest.fingerprint.value
    ]));

    assert.match(output, /Knowledge team upload execution approval record/);
    assert.match(output, /status: blocked/);
    assert.match(output, /next action: resolve-blockers/);
    assert.match(output, /upload-execution-approval-already-provided/);
    assert.match(output, /approval-already-granted/);
    assert.match(output, /object-store-handle-leak/);
    assert.match(output, /metadata-index-handle-leak/);
    assert.match(output, /upload-command-present/);
    assert.match(output, /target object key redacted: yes/);
    assertNoPrivateValues(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
