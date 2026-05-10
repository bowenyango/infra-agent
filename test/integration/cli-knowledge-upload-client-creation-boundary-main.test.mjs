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
    '/home/private/knowledge-pack.json',
    'raw-artifact-bytes',
    'client-secret-value',
    'adapter-secret-value'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

async function buildValidAdapterInjectionBoundary() {
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
  return buildKnowledgeTeamUploadAdapterInjectionBoundary({ artifactBytesBoundary });
}

async function writeValidInput(tempRoot) {
  const adapterInjectionBoundary = await buildValidAdapterInjectionBoundary();
  const adapterInjectionBoundaryPath = join(tempRoot, 'knowledge-pack.upload-adapter-injection-boundary.json');
  await writeFile(adapterInjectionBoundaryPath, `${JSON.stringify(adapterInjectionBoundary, null, 2)}\n`, 'utf8');
  return { adapterInjectionBoundary, adapterInjectionBoundaryPath };
}

test('knowledge upload-client-creation-boundary command writes valid dry-run boundary JSON', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-client-creation-'));

  try {
    const { adapterInjectionBoundary, adapterInjectionBoundaryPath } = await writeValidInput(tempRoot);
    const boundaryPath = join(tempRoot, 'knowledge-pack.upload-client-creation-boundary.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'upload-client-creation-boundary',
      adapterInjectionBoundaryPath,
      '--out',
      boundaryPath,
      '--json'
    ]));
    const outputPayload = JSON.parse(output);
    const boundary = JSON.parse(await readFile(boundaryPath, 'utf8'));
    const validation = validateKnowledgePayload(boundary, boundaryPath);

    assert.equal(outputPayload.outputPath, boundaryPath);
    assert.equal(boundary.outputPath, undefined);
    assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-client-creation-boundary');
    assert.equal(boundary.status, 'client-creation-boundary-ready');
    assert.equal(boundary.readiness.nextAction, 'design-credential-read-boundary');
    assert.equal(boundary.sourceAdapterInjectionBoundary.boundaryStatus, 'adapter-injection-boundary-ready');
    assert.equal(boundary.sourceAdapterInjectionBoundary.boundaryNextAction, 'design-client-creation-boundary');
    assert.equal(boundary.sourceAdapterInjectionBoundary.humanReviewRecorded, true);
    assert.equal(boundary.sourceAdapterInjectionBoundary.fingerprintVerified, true);
    assert.equal(boundary.target.manifestId, adapterInjectionBoundary.target.manifestId);
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
    assert.equal(boundary.clientCreationBoundary.clientFactoryDescriptorRequired, true);
    assert.equal(boundary.clientCreationBoundary.credentialReadBoundaryRequired, true);
    assert.equal(boundary.clientCreationBoundary.credentialPresenceBoundaryRequired, true);
    assert.equal(boundary.clientCreationBoundary.liveCheckBoundaryRequired, true);
    assert.equal(boundary.clientCreationBoundary.uploadCommandBoundaryRequired, true);
    assert.equal(boundary.clientCreationBoundary.clientCreated, false);
    assert.equal(boundary.clientCreationBoundary.sdkClientCreated, false);
    assert.equal(boundary.clientCreationBoundary.credentialValuesExposed, false);
    assert.equal(boundary.clientCreationBoundary.liveCheckPerformed, false);
    assert.equal(boundary.clientCreationBoundary.executable, false);
    assert.equal(validation.valid, true);
    assertNoPrivateValues({ outputPayload, boundary });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge upload-client-creation-boundary command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-client-creation-text-'));

  try {
    const { adapterInjectionBoundary, adapterInjectionBoundaryPath } = await writeValidInput(tempRoot);
    await writeFile(adapterInjectionBoundaryPath, `${JSON.stringify({
      ...adapterInjectionBoundary,
      endpointUrl: 'https://private.example.test',
      clientConfig: {
        sdkClient: 'should-not-read-secret'
      },
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
      remoteWriteAllowed: true,
      uploadApproved: true,
      uploadExecutionAllowed: true,
      writeTokenIssued: true,
      executionLeaseCreated: true,
      rollbackPlanCreated: true,
      artifactBytesProvided: true,
      auditRecordCreated: true,
      clientCreated: true,
      adapterInjected: true,
      remoteMutationPerformed: true,
      sourceArtifactBytesBoundary: {
        ...adapterInjectionBoundary.sourceArtifactBytesBoundary,
        fingerprintVerified: false,
        bucketName: 'should-not-read-bucket'
      },
      adapterInjectionBoundary: {
        ...adapterInjectionBoundary.adapterInjectionBoundary,
        artifactBytesProvided: true,
        clientCreated: true,
        adapterInjected: true,
        artifactObjectStoreBound: true,
        metadataIndexBound: true,
        executable: true,
        clientFactory: 'client-secret-value',
        artifactBytesValue: 'raw-artifact-bytes',
        artifactPath: '/home/private/knowledge-pack.json'
      },
      adapterInstance: {
        adapterMaterial: 'adapter-secret-value'
      },
      remainingExecutionBoundaries: {
        ...adapterInjectionBoundary.remainingExecutionBoundaries,
        artifactBytesProvided: true,
        adapterInjected: true,
        clientCreated: true,
        writeTokenIssued: true,
        executionLeaseCreated: true,
        rollbackPlanCreated: true,
        auditRecordCreated: true,
        objectWriteAllowed: true,
        metadataIndexWriteAllowed: true,
        remoteMutationAllowed: true
      }
    }, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'upload-client-creation-boundary',
      adapterInjectionBoundaryPath
    ]));

    assert.match(output, /Knowledge team upload client creation boundary/);
    assert.match(output, /status: blocked/);
    assert.match(output, /remote write: no/);
    assert.match(output, /upload approved: no/);
    assert.match(output, /upload execution allowed: no/);
    assert.match(output, /mutation approval granted: no/);
    assert.match(output, /client created: no/);
    assert.match(output, /adapter injected: no/);
    assert.match(output, /artifact bytes provided: no/);
    assert.match(output, /write token issued: no/);
    assert.match(output, /execution lease created: no/);
    assert.match(output, /rollback plan created: no/);
    assert.match(output, /audit record created: no/);
    assert.match(output, /SDK client created: no/);
    assert.match(output, /executable: no/);
    assert.match(output, /upload command: none/);
    assert.match(output, /review-fingerprint-unverified/);
    assert.match(output, /backend-detail-leak/);
    assert.match(output, /client-dependency-leak/);
    assert.match(output, /adapter-dependency-leak/);
    assert.match(output, /upload-command-present/);
    assert.match(output, /write-token-issued/);
    assert.match(output, /execution-lease-created/);
    assert.match(output, /rollback-plan-created/);
    assert.match(output, /artifact-bytes-provided/);
    assert.match(output, /audit-record-created/);
    assert.match(output, /client-created/);
    assert.match(output, /adapter-injected/);
    assert.match(output, /artifact-object-store-bound/);
    assert.match(output, /metadata-index-bound/);
    assert.match(output, /object-write-attempted/);
    assert.match(output, /metadata-index-write-attempted/);
    assert.match(output, /remote-mutation-performed/);
    assertNoPrivateValues(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
