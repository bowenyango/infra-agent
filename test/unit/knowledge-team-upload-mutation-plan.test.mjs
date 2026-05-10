import test from 'node:test';
import assert from 'node:assert/strict';
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
  buildKnowledgeTeamUploadMockHarness
} from '../../src/knowledge/team-upload-mock-harness.ts';
import {
  buildKnowledgeTeamUploadMutationPlan
} from '../../src/knowledge/team-upload-mutation-plan.ts';
import {
  buildKnowledgeTeamArtifactContractFixture
} from '../support/knowledge-team-artifact-fixtures.mjs';

function validBackendReferenceSummary() {
  return validateKnowledgeTeamS3CompatibleBackendReferences(
    buildKnowledgeTeamS3CompatibleBackendConfig(),
    buildKnowledgeTeamS3CompatibleReferenceRegistry()
  );
}

async function validExecutionGate() {
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
  return buildKnowledgeTeamUploadExecutionGate({ continuation, mockHarness });
}

test('upload mutation plan accepts a gate-ready execution gate without enabling execution', async () => {
  const executionGate = await validExecutionGate();
  const plan = buildKnowledgeTeamUploadMutationPlan({ executionGate });

  assert.equal(plan.kind, 'infra-agent.knowledge-team-upload-mutation-plan');
  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.mutationAllowed, false);
  assert.equal(plan.executionMode, 'dry-run');
  assert.equal(plan.planKind, 'approval-audit-dry-run');
  assert.equal(plan.status, 'plan-ready');
  assert.equal(plan.plannedOperation, 'stage-knowledge-pack');
  assert.equal(plan.remoteWriteAllowed, false);
  assert.equal(plan.liveCheckAllowed, false);
  assert.equal(plan.credentialValuesExposed, false);
  assert.equal(plan.credentialPresenceChecked, false);
  assert.equal(plan.uploadApproved, false);
  assert.equal(plan.uploadExecutionAllowed, false);
  assert.equal(plan.mutationApprovalGranted, false);
  assert.equal(plan.clientCreated, false);
  assert.equal(plan.adapterInjected, false);
  assert.equal(plan.artifactBytesProvided, false);
  assert.equal(plan.writeTokenIssued, false);
  assert.equal(plan.executionLeaseCreated, false);
  assert.equal(plan.rollbackPlanCreated, false);
  assert.equal(plan.objectWriteAttempted, false);
  assert.equal(plan.metadataIndexWriteAttempted, false);
  assert.equal(plan.remoteMutationPerformed, false);
  assert.equal(plan.uploadCommand, null);
  assert.equal(plan.target.manifestId, executionGate.target.manifestId);
  assert.equal(plan.target.objectKey, executionGate.target.objectKey);
  assert.equal(plan.target.objectSha256, executionGate.target.objectSha256);
  assert.equal(plan.target.artifactId, executionGate.target.artifactId);
  assert.equal(plan.sourceGate.source, 'upload-execution-gate');
  assert.equal(plan.sourceGate.gateStatus, 'gate-ready');
  assert.equal(plan.sourceGate.gateKind, 'approval-gated-dry-run');
  assert.equal(plan.sourceGate.gateNextAction, 'request-separate-mutation-approval');
  assert.equal(plan.sourceGate.scopeMatched, true);
  assert.equal(plan.sourceGate.continuationStatus, 'continuation-ready');
  assert.equal(plan.sourceGate.approvalProvided, true);
  assert.equal(plan.sourceGate.fingerprintVerified, true);
  assert.equal(plan.sourceGate.mockHarnessStatus, 'harness-ready');
  assert.equal(plan.sourceGate.mockHarnessKind, 'in-memory-mock');
  assert.equal(plan.sourceGate.mockAdapterInstantiated, true);
  assert.equal(plan.sourceGate.adapterName, 'mock-team-cache');
  assert.equal(plan.sourceGate.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(plan.approvalAudit.mutationApprovalRequired, true);
  assert.equal(plan.approvalAudit.mutationApprovalGranted, false);
  assert.equal(plan.approvalAudit.humanApprovalRequestIssued, false);
  assert.equal(plan.approvalAudit.uploadApproved, false);
  assert.equal(plan.approvalAudit.uploadExecutionAllowed, false);
  assert.equal(plan.approvalAudit.approvalScopeFingerprint.algorithm, 'sha256');
  assert.equal(plan.approvalAudit.approvalScopeFingerprint.scope, 'stage-knowledge-pack-mutation-plan-v1');
  assert.match(plan.approvalAudit.approvalScopeFingerprint.value, /^[a-f0-9]{64}$/);
  assert.equal(plan.approvalAudit.approvalScopeFingerprint.canonicalFieldCount, 12);
  assert.equal(plan.executionPlan.executable, false);
  assert.equal(plan.executionPlan.dryRunOnly, true);
  assert.equal(plan.executionPlan.artifactBytesRequiredBeforeExecution, true);
  assert.equal(plan.executionPlan.artifactBytesProvided, false);
  assert.equal(plan.executionPlan.adapterInjectionRequiredBeforeExecution, true);
  assert.equal(plan.executionPlan.adapterInjected, false);
  assert.equal(plan.executionPlan.writeTokenRequiredBeforeExecution, true);
  assert.equal(plan.executionPlan.writeTokenIssued, false);
  assert.equal(plan.executionPlan.executionLeaseRequiredBeforeExecution, true);
  assert.equal(plan.executionPlan.executionLeaseCreated, false);
  assert.equal(plan.executionPlan.rollbackPlanRequired, true);
  assert.equal(plan.executionPlan.rollbackPlanCreated, false);
  assert.equal(plan.executionPlan.auditRecordRequired, true);
  assert.equal(plan.executionPlan.auditRecordCreated, false);
  assert.equal(plan.executionPlan.clientCreated, false);
  assert.equal(plan.executionPlan.credentialValuesRead, false);
  assert.equal(plan.executionPlan.credentialPresenceChecked, false);
  assert.equal(plan.executionPlan.liveCheckPerformed, false);
  assert.equal(plan.executionPlan.uploadCommandGenerated, false);
  assert.equal(plan.executionPlan.objectWriteAttempted, false);
  assert.equal(plan.executionPlan.metadataIndexWriteAttempted, false);
  assert.equal(plan.executionPlan.remoteMutationPerformed, false);
  assert.equal(plan.readiness.nextAction, 'request-human-mutation-approval');
  assert.equal(plan.readiness.blockerCount, 0);
  assert.deepEqual(plan.readiness.blockerCodes, []);
});
