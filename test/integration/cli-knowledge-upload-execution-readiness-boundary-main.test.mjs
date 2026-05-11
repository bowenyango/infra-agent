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

async function validObjectIndexBindingBoundary() {
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
  return buildKnowledgeTeamUploadObjectIndexBindingBoundary({ commandBoundary });
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
  const objectIndexBindingBoundary = await validObjectIndexBindingBoundary();
  const objectIndexBindingBoundaryPath = join(tempRoot, 'knowledge-pack.upload-object-index-binding-boundary.json');
  await writeFile(objectIndexBindingBoundaryPath, `${JSON.stringify(objectIndexBindingBoundary, null, 2)}\n`, 'utf8');
  return { objectIndexBindingBoundary, objectIndexBindingBoundaryPath };
}

test('knowledge upload-execution-readiness-boundary command writes valid dry-run boundary JSON', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-execution-readiness-'));

  try {
    const { objectIndexBindingBoundary, objectIndexBindingBoundaryPath } = await writeValidInput(tempRoot);
    const boundaryPath = join(tempRoot, 'knowledge-pack.upload-execution-readiness-boundary.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'upload-execution-readiness-boundary',
      objectIndexBindingBoundaryPath,
      '--out',
      boundaryPath,
      '--json'
    ]));
    const outputPayload = JSON.parse(output);
    const boundary = JSON.parse(await readFile(boundaryPath, 'utf8'));
    const validation = validateKnowledgePayload(boundary, boundaryPath);

    assert.equal(outputPayload.outputPath, boundaryPath);
    assert.equal(boundary.outputPath, undefined);
    assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-execution-readiness-boundary');
    assert.equal(boundary.status, 'upload-execution-readiness-boundary-ready');
    assert.equal(boundary.readiness.nextAction, 'request-separate-upload-execution-approval');
    assert.equal(boundary.sourceObjectIndexBindingBoundary.boundaryStatus, 'object-index-binding-boundary-ready');
    assert.equal(boundary.sourceObjectIndexBindingBoundary.boundaryNextAction, 'design-upload-execution-readiness-boundary');
    assert.equal(boundary.sourceObjectIndexBindingBoundary.humanReviewRecorded, true);
    assert.equal(boundary.sourceObjectIndexBindingBoundary.fingerprintVerified, true);
    assert.equal(boundary.target.manifestId, objectIndexBindingBoundary.target.manifestId);
    assert.equal(boundary.target.objectKeyRedacted, true);
    assert.equal(boundary.target.objectKey, undefined);
    assert.equal(boundary.target.objectSha256, objectIndexBindingBoundary.target.objectSha256);
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
    assert.equal(boundary.uploadExecutionReadinessBoundary.executionReadinessModeled, true);
    assert.equal(boundary.uploadExecutionReadinessBoundary.separateExecutionApprovalRequired, true);
    assert.equal(boundary.uploadExecutionReadinessBoundary.uploadExecutionAllowed, false);
    assert.equal(boundary.uploadExecutionReadinessBoundary.objectStoreHandleExposed, false);
    assert.equal(boundary.uploadExecutionReadinessBoundary.metadataIndexHandleExposed, false);
    assert.equal(boundary.uploadExecutionReadinessBoundary.objectWriteAllowed, false);
    assert.equal(boundary.uploadExecutionReadinessBoundary.metadataIndexWriteAllowed, false);
    assert.equal(boundary.uploadExecutionReadinessBoundary.executable, false);
    assert.equal(validation.valid, true);
    assertNoPrivateValues({ outputPayload, boundary });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge upload-execution-readiness-boundary command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-execution-readiness-text-'));

  try {
    const { objectIndexBindingBoundary, objectIndexBindingBoundaryPath } = await writeValidInput(tempRoot);
    await writeFile(objectIndexBindingBoundaryPath, `${JSON.stringify({
      ...objectIndexBindingBoundary,
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
      readiness: {
        ...objectIndexBindingBoundary.readiness,
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
      'upload-execution-readiness-boundary',
      objectIndexBindingBoundaryPath
    ]));

    assert.match(output, /Knowledge team upload execution readiness boundary/);
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
