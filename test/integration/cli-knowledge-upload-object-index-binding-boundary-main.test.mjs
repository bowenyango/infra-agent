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
  buildKnowledgeTeamUploadExecutionGate
} from '../../src/knowledge/team-upload-execution-gate.ts';
import {
  buildKnowledgeTeamUploadExecutionLeaseBoundary
} from '../../src/knowledge/team-upload-execution-lease-boundary.ts';
import {
  buildKnowledgeTeamUploadExecutionPrerequisitePlan
} from '../../src/knowledge/team-upload-execution-prerequisite-plan.ts';
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

async function validCommandBoundary() {
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
  return buildKnowledgeTeamUploadCommandBoundary({ liveCheckBoundary });
}

function assertNoPrivateValues(value, sourceObjectKey = null) {
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
    sourceObjectKey
  ].filter(Boolean)) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

async function writeValidInput(tempRoot) {
  const commandBoundary = await validCommandBoundary();
  const commandBoundaryPath = join(tempRoot, 'knowledge-pack.upload-command-boundary.json');
  await writeFile(commandBoundaryPath, `${JSON.stringify(commandBoundary, null, 2)}\n`, 'utf8');
  return { commandBoundary, commandBoundaryPath };
}

test('knowledge upload-object-index-binding-boundary command writes valid dry-run boundary JSON', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-object-index-'));

  try {
    const { commandBoundary, commandBoundaryPath } = await writeValidInput(tempRoot);
    const boundaryPath = join(tempRoot, 'knowledge-pack.upload-object-index-binding-boundary.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'upload-object-index-binding-boundary',
      commandBoundaryPath,
      '--out',
      boundaryPath,
      '--json'
    ]));
    const outputPayload = JSON.parse(output);
    const boundary = JSON.parse(await readFile(boundaryPath, 'utf8'));
    const validation = validateKnowledgePayload(boundary, boundaryPath);

    assert.equal(outputPayload.outputPath, boundaryPath);
    assert.equal(boundary.outputPath, undefined);
    assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-object-index-binding-boundary');
    assert.equal(boundary.status, 'object-index-binding-boundary-ready');
    assert.equal(boundary.readiness.nextAction, 'design-upload-execution-readiness-boundary');
    assert.equal(boundary.sourceUploadCommandBoundary.boundaryStatus, 'upload-command-boundary-ready');
    assert.equal(boundary.sourceUploadCommandBoundary.boundaryNextAction, 'design-object-index-binding-boundary');
    assert.equal(boundary.sourceUploadCommandBoundary.humanReviewRecorded, true);
    assert.equal(boundary.sourceUploadCommandBoundary.fingerprintVerified, true);
    assert.equal(boundary.target.manifestId, commandBoundary.target.manifestId);
    assert.equal(boundary.target.objectKeyRedacted, true);
    assert.equal(boundary.target.objectKey, undefined);
    assert.equal(boundary.target.objectSha256, commandBoundary.target.objectSha256);
    assert.equal(boundary.remoteWriteAllowed, false);
    assert.equal(boundary.uploadApproved, false);
    assert.equal(boundary.uploadExecutionAllowed, false);
    assert.equal(boundary.clientCreated, false);
    assert.equal(boundary.adapterInjected, false);
    assert.equal(boundary.artifactBytesProvided, false);
    assert.equal(boundary.objectWriteAttempted, false);
    assert.equal(boundary.metadataIndexWriteAttempted, false);
    assert.equal(boundary.remoteMutationPerformed, false);
    assert.equal(boundary.uploadCommand, null);
    assert.equal(boundary.objectIndexBindingBoundary.objectStoreBindingRequired, true);
    assert.equal(boundary.objectIndexBindingBoundary.metadataIndexBindingRequired, true);
    assert.equal(boundary.objectIndexBindingBoundary.objectStoreDescriptorRequired, true);
    assert.equal(boundary.objectIndexBindingBoundary.metadataIndexDescriptorRequired, true);
    assert.equal(boundary.objectIndexBindingBoundary.artifactObjectStoreBound, false);
    assert.equal(boundary.objectIndexBindingBoundary.metadataIndexBound, false);
    assert.equal(boundary.objectIndexBindingBoundary.objectStoreHandleExposed, false);
    assert.equal(boundary.objectIndexBindingBoundary.metadataIndexHandleExposed, false);
    assert.equal(boundary.objectIndexBindingBoundary.objectWriteAllowed, false);
    assert.equal(boundary.objectIndexBindingBoundary.metadataIndexWriteAllowed, false);
    assert.equal(boundary.objectIndexBindingBoundary.executable, false);
    assert.equal(validation.valid, true);
    assertNoPrivateValues({ outputPayload, boundary });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge upload-object-index-binding-boundary command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-object-index-text-'));

  try {
    const { commandBoundary, commandBoundaryPath } = await writeValidInput(tempRoot);
    await writeFile(commandBoundaryPath, `${JSON.stringify({
      ...commandBoundary,
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
      uploadCommandBoundary: {
        ...commandBoundary.uploadCommandBoundary,
        liveCheckResultPayload: 'private-live-check-output',
        objectWriteAttempted: true,
        metadataIndexWriteAttempted: true
      },
      readiness: {
        ...commandBoundary.readiness,
        nextAction: 'resolve-blockers',
        blockerCount: 1,
        blockerCodes: ['object-write-attempted'],
        blockers: [{
          code: 'object-write-attempted',
          path: '$.objectIndexBindingBoundary.objectWriteAttempted',
          message: 'object write attempted'
        }]
      }
    }, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'upload-object-index-binding-boundary',
      commandBoundaryPath
    ]));

    assert.match(output, /Knowledge team upload object\/index binding boundary/);
    assert.match(output, /status: blocked/);
    assert.match(output, /next action: resolve-blockers/);
    assert.match(output, /object-store-handle-leak/);
    assert.match(output, /metadata-index-handle-leak/);
    assert.match(output, /upload-command-present/);
    assert.match(output, /target object key redacted: yes/);
    assertNoPrivateValues(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
