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

async function validCredentialPresenceBoundary() {
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
  return buildKnowledgeTeamUploadCredentialPresenceBoundary({ credentialReadBoundary });
}

function assertNoPrivateValues(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const forbidden of [
    'https://private.example.test',
    'should-not-read-secret',
    'aws s3 cp',
    's3://private-bucket',
    'private-key',
    'live-check-result'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

async function writeValidInput(tempRoot) {
  const credentialPresenceBoundary = await validCredentialPresenceBoundary();
  const credentialPresenceBoundaryPath = join(tempRoot, 'knowledge-pack.upload-credential-presence-boundary.json');
  await writeFile(credentialPresenceBoundaryPath, `${JSON.stringify(credentialPresenceBoundary, null, 2)}\n`, 'utf8');
  return { credentialPresenceBoundary, credentialPresenceBoundaryPath };
}

test('knowledge upload-live-check-boundary command writes valid dry-run boundary JSON', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-live-check-'));

  try {
    const { credentialPresenceBoundary, credentialPresenceBoundaryPath } = await writeValidInput(tempRoot);
    const boundaryPath = join(tempRoot, 'knowledge-pack.upload-live-check-boundary.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'upload-live-check-boundary',
      credentialPresenceBoundaryPath,
      '--out',
      boundaryPath,
      '--json'
    ]));
    const outputPayload = JSON.parse(output);
    const boundary = JSON.parse(await readFile(boundaryPath, 'utf8'));
    const validation = validateKnowledgePayload(boundary, boundaryPath);

    assert.equal(outputPayload.outputPath, boundaryPath);
    assert.equal(boundary.outputPath, undefined);
    assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-live-check-boundary');
    assert.equal(boundary.status, 'live-check-boundary-ready');
    assert.equal(boundary.readiness.nextAction, 'design-upload-command-boundary');
    assert.equal(boundary.sourceCredentialPresenceBoundary.boundaryStatus, 'credential-presence-boundary-ready');
    assert.equal(boundary.sourceCredentialPresenceBoundary.boundaryNextAction, 'design-live-check-boundary');
    assert.equal(boundary.sourceCredentialPresenceBoundary.humanReviewRecorded, true);
    assert.equal(boundary.sourceCredentialPresenceBoundary.fingerprintVerified, true);
    assert.equal(boundary.target.manifestId, credentialPresenceBoundary.target.manifestId);
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
    assert.equal(boundary.liveCheckBoundary.liveCheckPolicyRequired, true);
    assert.equal(boundary.liveCheckBoundary.liveCheckReadOnlyRequired, true);
    assert.equal(boundary.liveCheckBoundary.liveCheckResultRedactionRequired, true);
    assert.equal(boundary.liveCheckBoundary.liveCheckAllowed, false);
    assert.equal(boundary.liveCheckBoundary.liveCheckPerformed, false);
    assert.equal(boundary.liveCheckBoundary.liveCheckResultExposed, false);
    assert.equal(boundary.liveCheckBoundary.uploadCommandBoundaryRequired, true);
    assert.equal(boundary.liveCheckBoundary.executable, false);
    assert.equal(validation.valid, true);
    assertNoPrivateValues({ outputPayload, boundary });
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge upload-live-check-boundary command emits safe blocked text output', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-upload-live-check-text-'));

  try {
    const { credentialPresenceBoundary, credentialPresenceBoundaryPath } = await writeValidInput(tempRoot);
    await writeFile(credentialPresenceBoundaryPath, `${JSON.stringify({
      ...credentialPresenceBoundary,
      endpointUrl: 'https://private.example.test',
      clientConfig: {
        sdkClient: 'should-not-read-secret'
      },
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
      credentialPresenceBoundary: {
        ...credentialPresenceBoundary.credentialPresenceBoundary,
        liveCheckResult: 'live-check-result',
        credentialPresenceResultValue: 'should-not-read-secret',
        liveCheckPerformed: true,
        uploadCommandGenerated: true
      },
      readiness: {
        ...credentialPresenceBoundary.readiness,
        nextAction: 'resolve-blockers',
        blockerCount: 1,
        blockerCodes: ['live-check-enabled'],
        blockers: [{
          code: 'live-check-enabled',
          path: '$.credentialPresenceBoundary.liveCheckPerformed',
          message: 'live check was performed'
        }]
      }
    }, null, 2)}\n`, 'utf8');

    const output = await captureStdout(() => main([
      'knowledge',
      'upload-live-check-boundary',
      credentialPresenceBoundaryPath
    ]));

    assert.match(output, /Knowledge team upload live check boundary/);
    assert.match(output, /status: blocked/);
    assert.match(output, /next action: resolve-blockers/);
    assert.match(output, /live-check-enabled/);
    assert.match(output, /upload-command-present/);
    assertNoPrivateValues(output);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
