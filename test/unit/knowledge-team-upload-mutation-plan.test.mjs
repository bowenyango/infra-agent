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

function assertNoPrivateValues(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const forbidden of [
    'https://should-not-copy.example.test',
    'should-not-copy-bucket',
    'should-not-copy-secret',
    'aws s3 cp',
    's3://private-bucket',
    'private-key'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
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

test('upload mutation plan blocks execution gates that are not gate-ready', async () => {
  const executionGate = await validExecutionGate();
  const plan = buildKnowledgeTeamUploadMutationPlan({
    executionGate: {
      ...executionGate,
      status: 'blocked',
      readiness: {
        ...executionGate.readiness,
        status: 'blocked',
        nextAction: 'resolve-blockers',
        blockerCount: 1,
        blockerCodes: ['scope-mismatch'],
        blockers: [{
          code: 'scope-mismatch',
          path: '$.scope',
          message: 'test mismatch'
        }],
        reason: 'test blocked gate'
      }
    }
  });

  assert.equal(plan.status, 'blocked');
  assert.equal(plan.target.manifestId, null);
  assert.equal(plan.target.objectKey, null);
  assert.equal(plan.target.objectSha256, null);
  assert.equal(plan.target.artifactId, null);
  assert.equal(plan.sourceGate.gateStatus, 'blocked');
  assert.equal(plan.sourceGate.gateNextAction, 'resolve-blockers');
  assert.equal(plan.approvalAudit.approvalScopeFingerprint.value, null);
  assert.equal(plan.uploadApproved, false);
  assert.equal(plan.uploadExecutionAllowed, false);
  assert.equal(plan.mutationApprovalGranted, false);
  assert.equal(plan.writeTokenIssued, false);
  assert.equal(plan.executionLeaseCreated, false);
  assert.equal(plan.objectWriteAttempted, false);
  assert.equal(plan.metadataIndexWriteAttempted, false);
  assert.equal(plan.remoteMutationPerformed, false);
  assert.equal(plan.uploadCommand, null);
  assert.equal(plan.readiness.nextAction, 'resolve-blockers');
  assert.equal(plan.readiness.blockerCodes.includes('execution-gate-not-ready'), true);
});

test('upload mutation plan blocks invalid execution gate artifacts', async () => {
  const executionGate = await validExecutionGate();
  const plan = buildKnowledgeTeamUploadMutationPlan({
    executionGate: {
      ...executionGate,
      kind: 'infra-agent.knowledge-team-upload-execution-run',
      schemaVersion: 2,
      gateKind: 'executable',
      endpointUrl: 'https://should-not-copy.example.test',
      bucketName: 'should-not-copy-bucket'
    }
  });

  assert.equal(plan.status, 'blocked');
  assert.equal(plan.sourceGate.gateKind, 'unsupported');
  assert.equal(plan.approvalAudit.approvalScopeFingerprint.value, null);
  assert.equal(plan.readiness.blockerCodes.includes('invalid-execution-gate-kind'), true);
  assert.equal(plan.readiness.blockerCodes.includes('invalid-schema-version'), true);
  assert.equal(plan.readiness.blockerCodes.includes('backend-detail-leak'), true);
  assertNoPrivateValues(plan);
});

test('upload mutation plan blocks forged execution and mutation state', async () => {
  const executionGate = await validExecutionGate();
  const plan = buildKnowledgeTeamUploadMutationPlan({
    executionGate: {
      ...executionGate,
      mutationAllowed: true,
      remoteWriteAllowed: true,
      liveCheckAllowed: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      uploadApproved: true,
      uploadExecutionAllowed: true,
      clientCreated: true,
      adapterInjected: true,
      artifactBytesProvided: true,
      writeTokenIssued: true,
      executionLeaseCreated: true,
      rollbackPlanCreated: true,
      objectWriteAttempted: true,
      metadataIndexWriteAttempted: true,
      remoteMutationPerformed: true,
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
      approvalGate: {
        ...executionGate.approvalGate,
        mutationApprovalGranted: true,
        uploadApproved: true,
        uploadExecutionAllowed: true,
        scopeMatched: false
      },
      mockHarness: {
        ...executionGate.mockHarness,
        status: 'blocked',
        adapterBackendKind: 's3-compatible',
        objectWriteAttempted: true,
        indexWriteAttempted: true,
        remoteMutationPerformed: true
      },
      executionBoundary: {
        ...executionGate.executionBoundary,
        artifactBytesProvided: true,
        adapterInjected: true,
        clientCreated: true,
        credentialValuesRead: true,
        credentialPresenceChecked: true,
        liveCheckPerformed: true,
        writeTokenIssued: true,
        executionLeaseCreated: true,
        uploadCommandGenerated: true,
        objectWriteAttempted: true,
        metadataIndexWriteAttempted: true,
        remoteMutationPerformed: true
      }
    }
  });

  assert.equal(plan.status, 'blocked');
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
  assert.equal(plan.approvalAudit.mutationApprovalGranted, false);
  assert.equal(plan.approvalAudit.uploadApproved, false);
  assert.equal(plan.approvalAudit.uploadExecutionAllowed, false);
  assert.equal(plan.executionPlan.artifactBytesProvided, false);
  assert.equal(plan.executionPlan.writeTokenIssued, false);
  assert.equal(plan.executionPlan.executionLeaseCreated, false);
  assert.equal(plan.executionPlan.rollbackPlanCreated, false);
  assert.equal(plan.executionPlan.objectWriteAttempted, false);
  assert.equal(plan.executionPlan.metadataIndexWriteAttempted, false);
  assert.equal(plan.executionPlan.remoteMutationPerformed, false);
  for (const code of [
    'mutation-enabled',
    'remote-write-enabled',
    'live-check-enabled',
    'credential-values-exposed',
    'credential-presence-check-enabled',
    'upload-approval-already-provided',
    'upload-execution-enabled',
    'client-created',
    'adapter-injected',
    'artifact-bytes-provided',
    'write-token-issued',
    'execution-lease-created',
    'mutation-approval-already-granted',
    'rollback-plan-created',
    'object-write-attempted',
    'metadata-index-write-attempted',
    'remote-mutation-performed',
    'upload-command-present',
    'scope-not-matched',
    'mock-harness-not-ready',
    'unsupported-adapter-backend'
  ]) {
    assert.equal(plan.readiness.blockerCodes.includes(code), true, code);
  }
  assertNoPrivateValues(plan);
});

test('knowledge validation accepts and rejects upload mutation plan artifacts', async () => {
  const executionGate = await validExecutionGate();
  const plan = buildKnowledgeTeamUploadMutationPlan({ executionGate });
  const validReport = validateKnowledgePayload(plan, 'upload-mutation-plan.json');

  assert.equal(validReport.valid, true);
  assert.equal(validReport.inputKind, 'infra-agent.knowledge-team-upload-mutation-plan');
  assert.equal(validReport.issueCount, 0);

  const forgedReport = validateKnowledgePayload({
    ...plan,
    remoteWriteAllowed: true,
    liveCheckAllowed: true,
    credentialValuesExposed: true,
    credentialPresenceChecked: true,
    uploadApproved: true,
    uploadExecutionAllowed: true,
    mutationApprovalGranted: true,
    artifactBytesProvided: true,
    writeTokenIssued: true,
    rollbackPlanCreated: true,
    uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
    sourceGate: {
      ...plan.sourceGate,
      gateStatus: 'blocked',
      gateNextAction: 'resolve-blockers',
      scopeMatched: false,
      endpointUrl: 'https://should-not-copy.example.test'
    },
    approvalAudit: {
      ...plan.approvalAudit,
      mutationApprovalGranted: true,
      humanApprovalRequestIssued: true,
      uploadApproved: true,
      uploadExecutionAllowed: true,
      approvalScopeFingerprint: {
        ...plan.approvalAudit.approvalScopeFingerprint,
        value: null
      }
    },
    executionPlan: {
      ...plan.executionPlan,
      executable: true,
      dryRunOnly: false,
      artifactBytesProvided: true,
      writeTokenIssued: true,
      rollbackPlanCreated: true,
      remoteMutationPerformed: true
    },
    readiness: {
      ...plan.readiness,
      blockerCount: 1,
      blockerCodes: ['write-token-issued'],
      blockers: [
        {
          code: 'write-token-issued',
          path: '$.executionPlan.writeTokenIssued',
          message: 'safe symbolic code'
        }
      ]
    }
  }, 'forged-upload-mutation-plan.json');

  assert.equal(forgedReport.valid, false);
  for (const path of [
    '$.remoteWriteAllowed',
    '$.liveCheckAllowed',
    '$.credentialValuesExposed',
    '$.credentialPresenceChecked',
    '$.uploadApproved',
    '$.uploadExecutionAllowed',
    '$.mutationApprovalGranted',
    '$.artifactBytesProvided',
    '$.writeTokenIssued',
    '$.rollbackPlanCreated',
    '$.uploadCommand',
    '$.sourceGate.endpointUrl',
    '$.sourceGate.gateStatus',
    '$.sourceGate.gateNextAction',
    '$.sourceGate.scopeMatched',
    '$.approvalAudit.mutationApprovalGranted',
    '$.approvalAudit.humanApprovalRequestIssued',
    '$.approvalAudit.uploadApproved',
    '$.approvalAudit.uploadExecutionAllowed',
    '$.approvalAudit.approvalScopeFingerprint.value',
    '$.executionPlan.executable',
    '$.executionPlan.dryRunOnly',
    '$.executionPlan.artifactBytesProvided',
    '$.executionPlan.writeTokenIssued',
    '$.executionPlan.rollbackPlanCreated',
    '$.executionPlan.remoteMutationPerformed'
  ]) {
    assert.equal(forgedReport.issues.some(issue => issue.path === path), true, path);
  }
  assertNoPrivateValues(forgedReport);
});
