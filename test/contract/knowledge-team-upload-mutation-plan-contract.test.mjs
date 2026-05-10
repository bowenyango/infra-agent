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
  validateKnowledgePayload
} from '../../src/knowledge/validate.ts';
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

function assertMutationPlanShape(plan) {
  assert.deepEqual(Object.keys(plan), [
    'kind',
    'schemaVersion',
    'mutationAllowed',
    'executionMode',
    'planKind',
    'status',
    'plannedOperation',
    'remoteWriteAllowed',
    'liveCheckAllowed',
    'credentialValuesExposed',
    'credentialPresenceChecked',
    'uploadApproved',
    'uploadExecutionAllowed',
    'mutationApprovalGranted',
    'clientCreated',
    'adapterInjected',
    'artifactBytesProvided',
    'writeTokenIssued',
    'executionLeaseCreated',
    'rollbackPlanCreated',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed',
    'uploadCommand',
    'target',
    'sourceGate',
    'approvalAudit',
    'executionPlan',
    'readiness'
  ]);
  assert.deepEqual(Object.keys(plan.target), [
    'manifestId',
    'objectKey',
    'objectSha256',
    'artifactId'
  ]);
  assert.deepEqual(Object.keys(plan.sourceGate), [
    'source',
    'gateStatus',
    'gateKind',
    'gateNextAction',
    'scopeMatched',
    'continuationStatus',
    'approvalProvided',
    'fingerprintVerified',
    'mockHarnessStatus',
    'mockHarnessKind',
    'mockAdapterInstantiated',
    'adapterName',
    'adapterBackendKind'
  ]);
  assert.deepEqual(Object.keys(plan.approvalAudit), [
    'mutationApprovalRequired',
    'mutationApprovalGranted',
    'humanApprovalRequestIssued',
    'uploadApproved',
    'uploadExecutionAllowed',
    'approvalScopeFingerprint'
  ]);
  assert.deepEqual(Object.keys(plan.approvalAudit.approvalScopeFingerprint), [
    'algorithm',
    'scope',
    'value',
    'canonicalFieldCount'
  ]);
  assert.deepEqual(Object.keys(plan.executionPlan), [
    'executable',
    'dryRunOnly',
    'artifactBytesRequiredBeforeExecution',
    'artifactBytesProvided',
    'adapterInjectionRequiredBeforeExecution',
    'adapterInjected',
    'writeTokenRequiredBeforeExecution',
    'writeTokenIssued',
    'executionLeaseRequiredBeforeExecution',
    'executionLeaseCreated',
    'rollbackPlanRequired',
    'rollbackPlanCreated',
    'auditRecordRequired',
    'auditRecordCreated',
    'clientCreated',
    'credentialValuesRead',
    'credentialPresenceChecked',
    'liveCheckPerformed',
    'uploadCommandGenerated',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed'
  ]);
  assert.deepEqual(Object.keys(plan.readiness), [
    'status',
    'nextAction',
    'blockerCount',
    'blockerCodes',
    'blockers',
    'reason'
  ]);
}

function assertNoPrivateValues(value) {
  const text = JSON.stringify(value);
  for (const forbidden of [
    'aws s3 cp',
    's3://private-bucket',
    'private-key',
    'https://',
    '/tmp/',
    '/home/',
    '/workspace/'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

test('upload mutation plan contract accepts approval audit dry-run summaries', async () => {
  const plan = buildKnowledgeTeamUploadMutationPlan({
    executionGate: await validExecutionGate()
  });

  assertMutationPlanShape(plan);
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
  assert.equal(plan.sourceGate.source, 'upload-execution-gate');
  assert.equal(plan.sourceGate.gateStatus, 'gate-ready');
  assert.equal(plan.sourceGate.gateNextAction, 'request-separate-mutation-approval');
  assert.equal(plan.sourceGate.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(plan.approvalAudit.mutationApprovalRequired, true);
  assert.equal(plan.approvalAudit.mutationApprovalGranted, false);
  assert.equal(plan.approvalAudit.humanApprovalRequestIssued, false);
  assert.equal(plan.approvalAudit.uploadApproved, false);
  assert.equal(plan.approvalAudit.uploadExecutionAllowed, false);
  assert.equal(plan.approvalAudit.approvalScopeFingerprint.scope, 'stage-knowledge-pack-mutation-plan-v1');
  assert.match(plan.approvalAudit.approvalScopeFingerprint.value, /^[a-f0-9]{64}$/);
  assert.equal(plan.executionPlan.executable, false);
  assert.equal(plan.executionPlan.dryRunOnly, true);
  assert.equal(plan.executionPlan.artifactBytesRequiredBeforeExecution, true);
  assert.equal(plan.executionPlan.artifactBytesProvided, false);
  assert.equal(plan.executionPlan.writeTokenRequiredBeforeExecution, true);
  assert.equal(plan.executionPlan.writeTokenIssued, false);
  assert.equal(plan.executionPlan.executionLeaseRequiredBeforeExecution, true);
  assert.equal(plan.executionPlan.executionLeaseCreated, false);
  assert.equal(plan.executionPlan.rollbackPlanRequired, true);
  assert.equal(plan.executionPlan.rollbackPlanCreated, false);
  assert.equal(plan.executionPlan.auditRecordRequired, true);
  assert.equal(plan.executionPlan.auditRecordCreated, false);
  assert.equal(plan.readiness.nextAction, 'request-human-mutation-approval');
  assert.deepEqual(plan.readiness.blockerCodes, []);

  const validation = validateKnowledgePayload(plan, 'inline');
  assert.equal(validation.valid, true);
});

test('upload mutation plan contract keeps blocked summaries non-executable', async () => {
  const executionGate = await validExecutionGate();
  const plan = buildKnowledgeTeamUploadMutationPlan({
    executionGate: {
      ...executionGate,
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
      writeTokenIssued: true,
      rollbackPlanCreated: true,
      sourceUrl: 'https://private.example.test',
      approvalGate: {
        ...executionGate.approvalGate,
        mutationApprovalGranted: true
      }
    }
  });

  assertMutationPlanShape(plan);
  assert.equal(plan.status, 'blocked');
  assert.equal(plan.uploadApproved, false);
  assert.equal(plan.uploadExecutionAllowed, false);
  assert.equal(plan.mutationApprovalGranted, false);
  assert.equal(plan.artifactBytesProvided, false);
  assert.equal(plan.writeTokenIssued, false);
  assert.equal(plan.executionLeaseCreated, false);
  assert.equal(plan.rollbackPlanCreated, false);
  assert.equal(plan.objectWriteAttempted, false);
  assert.equal(plan.metadataIndexWriteAttempted, false);
  assert.equal(plan.remoteMutationPerformed, false);
  assert.equal(plan.uploadCommand, null);
  assert.equal(plan.approvalAudit.approvalScopeFingerprint.value, null);
  assert.equal(plan.executionPlan.executable, false);
  assert.equal(plan.executionPlan.writeTokenIssued, false);
  assert.equal(plan.executionPlan.rollbackPlanCreated, false);
  assert.equal(plan.executionPlan.remoteMutationPerformed, false);
  assert.equal(plan.readiness.nextAction, 'resolve-blockers');
  assert.equal(plan.readiness.blockerCodes.includes('write-token-issued'), true);
  assert.equal(plan.readiness.blockerCodes.includes('rollback-plan-created'), true);
  assert.equal(plan.readiness.blockerCodes.includes('upload-command-present'), true);
  assert.equal(plan.readiness.blockerCodes.includes('mutation-approval-already-granted'), true);
  assertNoPrivateValues(plan);

  const validation = validateKnowledgePayload(plan, 'inline');
  assert.equal(validation.valid, true);
});
