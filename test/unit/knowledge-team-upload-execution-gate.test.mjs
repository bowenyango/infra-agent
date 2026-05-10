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

async function validContinuationAndHarness() {
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
  return { continuation, mockHarness };
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

test('upload execution gate accepts matching continuation and mock harness without enabling execution', async () => {
  const { continuation, mockHarness } = await validContinuationAndHarness();
  const gate = buildKnowledgeTeamUploadExecutionGate({
    continuation,
    mockHarness
  });

  assert.equal(gate.kind, 'infra-agent.knowledge-team-upload-execution-gate');
  assert.equal(gate.schemaVersion, 1);
  assert.equal(gate.mutationAllowed, false);
  assert.equal(gate.executionMode, 'dry-run');
  assert.equal(gate.gateKind, 'approval-gated-dry-run');
  assert.equal(gate.status, 'gate-ready');
  assert.equal(gate.plannedOperation, 'stage-knowledge-pack');
  assert.equal(gate.remoteWriteAllowed, false);
  assert.equal(gate.liveCheckAllowed, false);
  assert.equal(gate.credentialValuesExposed, false);
  assert.equal(gate.credentialPresenceChecked, false);
  assert.equal(gate.uploadApproved, false);
  assert.equal(gate.uploadExecutionAllowed, false);
  assert.equal(gate.clientCreated, false);
  assert.equal(gate.adapterInjected, false);
  assert.equal(gate.writeTokenIssued, false);
  assert.equal(gate.executionLeaseCreated, false);
  assert.equal(gate.objectWriteAttempted, false);
  assert.equal(gate.metadataIndexWriteAttempted, false);
  assert.equal(gate.remoteMutationPerformed, false);
  assert.equal(gate.uploadCommand, null);
  assert.equal(gate.target.manifestId, continuation.target.manifestId);
  assert.equal(gate.target.objectKey, continuation.target.objectKey);
  assert.equal(gate.target.objectSha256, continuation.target.objectSha256);
  assert.equal(gate.target.artifactId, continuation.target.artifactId);
  assert.equal(gate.approvalGate.source, 'upload-approval-continuation');
  assert.equal(gate.approvalGate.continuationStatus, 'continuation-ready');
  assert.equal(gate.approvalGate.approvalRequired, true);
  assert.equal(gate.approvalGate.approvalProvided, true);
  assert.equal(gate.approvalGate.fingerprintVerified, true);
  assert.equal(gate.approvalGate.mutationApprovalRequired, true);
  assert.equal(gate.approvalGate.mutationApprovalGranted, false);
  assert.equal(gate.approvalGate.uploadApproved, false);
  assert.equal(gate.approvalGate.uploadExecutionAllowed, false);
  assert.equal(gate.approvalGate.scopeMatched, true);
  assert.equal(gate.mockHarness.source, 'upload-mock-harness');
  assert.equal(gate.mockHarness.status, 'harness-ready');
  assert.equal(gate.mockHarness.harnessKind, 'in-memory-mock');
  assert.equal(gate.mockHarness.mockAdapterInstantiated, true);
  assert.equal(gate.mockHarness.adapterName, 'mock-team-cache');
  assert.equal(gate.mockHarness.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(gate.mockHarness.descriptorMatched, true);
  assert.equal(gate.mockHarness.objectWriteAttempted, false);
  assert.equal(gate.mockHarness.indexWriteAttempted, false);
  assert.equal(gate.mockHarness.remoteMutationPerformed, false);
  assert.equal(gate.executionBoundary.dryRunOnly, true);
  assert.equal(gate.executionBoundary.artifactBytesProvided, false);
  assert.equal(gate.executionBoundary.adapterInjectionReviewed, true);
  assert.equal(gate.executionBoundary.adapterInjected, false);
  assert.equal(gate.executionBoundary.clientCreated, false);
  assert.equal(gate.executionBoundary.credentialValuesRead, false);
  assert.equal(gate.executionBoundary.credentialPresenceChecked, false);
  assert.equal(gate.executionBoundary.liveCheckPerformed, false);
  assert.equal(gate.executionBoundary.writeTokenIssued, false);
  assert.equal(gate.executionBoundary.executionLeaseCreated, false);
  assert.equal(gate.executionBoundary.rollbackPlanRequired, true);
  assert.equal(gate.executionBoundary.auditRecordRequired, true);
  assert.equal(gate.executionBoundary.uploadCommandGenerated, false);
  assert.equal(gate.executionBoundary.objectWriteAttempted, false);
  assert.equal(gate.executionBoundary.metadataIndexWriteAttempted, false);
  assert.equal(gate.executionBoundary.remoteMutationPerformed, false);
  assert.equal(gate.readiness.nextAction, 'request-separate-mutation-approval');
  assert.equal(gate.readiness.blockerCount, 0);
  assert.deepEqual(gate.readiness.blockerCodes, []);
});

test('upload execution gate blocks forged continuation execution flags', async () => {
  const { continuation, mockHarness } = await validContinuationAndHarness();
  const gate = buildKnowledgeTeamUploadExecutionGate({
    continuation: {
      ...continuation,
      endpointUrl: 'https://should-not-copy.example.test',
      bucketName: 'should-not-copy-bucket',
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
      mutationAllowed: true,
      remoteWriteAllowed: true,
      liveCheckAllowed: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      uploadApproved: true,
      uploadExecutionAllowed: true,
      clientCreated: true
    },
    mockHarness
  });

  assert.equal(gate.status, 'blocked');
  assert.equal(gate.uploadApproved, false);
  assert.equal(gate.uploadExecutionAllowed, false);
  assert.equal(gate.clientCreated, false);
  assert.equal(gate.adapterInjected, false);
  assert.equal(gate.writeTokenIssued, false);
  assert.equal(gate.executionLeaseCreated, false);
  assert.equal(gate.objectWriteAttempted, false);
  assert.equal(gate.metadataIndexWriteAttempted, false);
  assert.equal(gate.remoteMutationPerformed, false);
  assert.equal(gate.uploadCommand, null);
  assert.equal(gate.executionBoundary.adapterInjectionReviewed, false);
  assert.equal(gate.readiness.nextAction, 'resolve-blockers');
  assert.equal(gate.readiness.blockerCodes.includes('backend-detail-leak'), true);
  assert.equal(gate.readiness.blockerCodes.includes('mutation-enabled'), true);
  assert.equal(gate.readiness.blockerCodes.includes('remote-write-enabled'), true);
  assert.equal(gate.readiness.blockerCodes.includes('live-check-enabled'), true);
  assert.equal(gate.readiness.blockerCodes.includes('credential-values-exposed'), true);
  assert.equal(gate.readiness.blockerCodes.includes('credential-presence-check-enabled'), true);
  assert.equal(gate.readiness.blockerCodes.includes('upload-approval-already-provided'), true);
  assert.equal(gate.readiness.blockerCodes.includes('upload-execution-enabled'), true);
  assert.equal(gate.readiness.blockerCodes.includes('client-created'), true);
  assert.equal(gate.readiness.blockerCodes.includes('upload-command-present'), true);
  assertNoPrivateValues(gate);
});

test('upload execution gate blocks forged mock harness mutation flags', async () => {
  const { continuation, mockHarness } = await validContinuationAndHarness();
  const gate = buildKnowledgeTeamUploadExecutionGate({
    continuation,
    mockHarness: {
      ...mockHarness,
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
      remoteWriteAllowed: true,
      liveCheckAllowed: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      uploadApproved: true,
      uploadExecutionAllowed: true,
      clientCreated: true,
      adapterInjected: true,
      objectWriteAttempted: true,
      metadataIndexWriteAttempted: true,
      remoteMutationPerformed: true,
      mockHarness: {
        ...mockHarness.mockHarness,
        objectWriteAttempted: true,
        indexWriteAttempted: true,
        remoteMutationPerformed: true
      }
    }
  });

  assert.equal(gate.status, 'blocked');
  assert.equal(gate.uploadApproved, false);
  assert.equal(gate.uploadExecutionAllowed, false);
  assert.equal(gate.clientCreated, false);
  assert.equal(gate.adapterInjected, false);
  assert.equal(gate.writeTokenIssued, false);
  assert.equal(gate.executionLeaseCreated, false);
  assert.equal(gate.objectWriteAttempted, false);
  assert.equal(gate.metadataIndexWriteAttempted, false);
  assert.equal(gate.remoteMutationPerformed, false);
  assert.equal(gate.uploadCommand, null);
  assert.equal(gate.mockHarness.objectWriteAttempted, false);
  assert.equal(gate.mockHarness.indexWriteAttempted, false);
  assert.equal(gate.mockHarness.remoteMutationPerformed, false);
  assert.equal(gate.executionBoundary.adapterInjectionReviewed, false);
  assert.equal(gate.readiness.blockerCodes.includes('remote-write-enabled'), true);
  assert.equal(gate.readiness.blockerCodes.includes('live-check-enabled'), true);
  assert.equal(gate.readiness.blockerCodes.includes('credential-values-exposed'), true);
  assert.equal(gate.readiness.blockerCodes.includes('credential-presence-check-enabled'), true);
  assert.equal(gate.readiness.blockerCodes.includes('upload-approval-already-provided'), true);
  assert.equal(gate.readiness.blockerCodes.includes('upload-execution-enabled'), true);
  assert.equal(gate.readiness.blockerCodes.includes('client-created'), true);
  assert.equal(gate.readiness.blockerCodes.includes('adapter-injected'), true);
  assert.equal(gate.readiness.blockerCodes.includes('object-write-attempted'), true);
  assert.equal(gate.readiness.blockerCodes.includes('metadata-index-write-attempted'), true);
  assert.equal(gate.readiness.blockerCodes.includes('remote-mutation-performed'), true);
  assert.equal(gate.readiness.blockerCodes.includes('upload-command-present'), true);
  assertNoPrivateValues(gate);
});

test('upload execution gate blocks non-ready harness artifacts', async () => {
  const { continuation, mockHarness } = await validContinuationAndHarness();
  const gate = buildKnowledgeTeamUploadExecutionGate({
    continuation,
    mockHarness: {
      ...mockHarness,
      status: 'blocked',
      mockAdapterInstantiated: false,
      mockHarness: {
        ...mockHarness.mockHarness,
        backendKind: 'unsupported',
        descriptorMatched: false
      }
    }
  });

  assert.equal(gate.status, 'blocked');
  assert.equal(gate.mockHarness.status, 'blocked');
  assert.equal(gate.mockHarness.mockAdapterInstantiated, false);
  assert.equal(gate.mockHarness.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(gate.executionBoundary.adapterInjectionReviewed, false);
  assert.equal(gate.readiness.blockerCodes.includes('harness-not-ready'), true);
  assert.equal(gate.readiness.blockerCodes.includes('mock-adapter-not-instantiated'), true);
  assert.equal(gate.readiness.blockerCodes.includes('unsupported-adapter-backend'), true);
  assert.equal(gate.readiness.blockerCodes.includes('mock-descriptor-not-matched'), true);
});

test('upload execution gate blocks continuation and harness scope mismatch', async () => {
  const { continuation, mockHarness } = await validContinuationAndHarness();
  const gate = buildKnowledgeTeamUploadExecutionGate({
    continuation,
    mockHarness: {
      ...mockHarness,
      preflight: {
        ...mockHarness.preflight,
        objectSha256: 'b'.repeat(64)
      }
    }
  });

  assert.equal(gate.status, 'blocked');
  assert.equal(gate.target.manifestId, null);
  assert.equal(gate.target.objectKey, null);
  assert.equal(gate.target.objectSha256, null);
  assert.equal(gate.target.artifactId, null);
  assert.equal(gate.approvalGate.scopeMatched, false);
  assert.equal(gate.readiness.blockerCodes.includes('scope-mismatch'), true);
  assert.equal(gate.uploadExecutionAllowed, false);
  assert.equal(gate.objectWriteAttempted, false);
  assert.equal(gate.metadataIndexWriteAttempted, false);
  assert.equal(gate.remoteMutationPerformed, false);
});

test('knowledge validation accepts and rejects upload execution gate artifacts', async () => {
  const { continuation, mockHarness } = await validContinuationAndHarness();
  const gate = buildKnowledgeTeamUploadExecutionGate({ continuation, mockHarness });
  const validReport = validateKnowledgePayload(gate, 'upload-execution-gate.json');

  assert.equal(validReport.valid, true);
  assert.equal(validReport.inputKind, 'infra-agent.knowledge-team-upload-execution-gate');
  assert.equal(validReport.issueCount, 0);

  const forgedReport = validateKnowledgePayload({
    ...gate,
    remoteWriteAllowed: true,
    liveCheckAllowed: true,
    credentialValuesExposed: true,
    credentialPresenceChecked: true,
    uploadApproved: true,
    uploadExecutionAllowed: true,
    clientCreated: true,
    adapterInjected: true,
    writeTokenIssued: true,
    executionLeaseCreated: true,
    objectWriteAttempted: true,
    metadataIndexWriteAttempted: true,
    remoteMutationPerformed: true,
    uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
    approvalGate: {
      ...gate.approvalGate,
      mutationApprovalGranted: true,
      uploadApproved: true,
      uploadExecutionAllowed: true,
      scopeMatched: false
    },
    mockHarness: {
      ...gate.mockHarness,
      adapterBackendKind: 's3-compatible',
      objectWriteAttempted: true,
      indexWriteAttempted: true,
      remoteMutationPerformed: true
    },
    executionBoundary: {
      ...gate.executionBoundary,
      dryRunOnly: false,
      adapterInjectionReviewed: false,
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
  }, 'forged-upload-execution-gate.json');

  assert.equal(forgedReport.valid, false);
  for (const path of [
    '$.remoteWriteAllowed',
    '$.liveCheckAllowed',
    '$.credentialValuesExposed',
    '$.credentialPresenceChecked',
    '$.uploadApproved',
    '$.uploadExecutionAllowed',
    '$.clientCreated',
    '$.adapterInjected',
    '$.writeTokenIssued',
    '$.executionLeaseCreated',
    '$.objectWriteAttempted',
    '$.metadataIndexWriteAttempted',
    '$.remoteMutationPerformed',
    '$.uploadCommand',
    '$.approvalGate.mutationApprovalGranted',
    '$.approvalGate.uploadApproved',
    '$.approvalGate.uploadExecutionAllowed',
    '$.approvalGate.scopeMatched',
    '$.mockHarness.adapterBackendKind',
    '$.mockHarness.objectWriteAttempted',
    '$.mockHarness.indexWriteAttempted',
    '$.mockHarness.remoteMutationPerformed',
    '$.executionBoundary.dryRunOnly',
    '$.executionBoundary.adapterInjectionReviewed',
    '$.executionBoundary.artifactBytesProvided',
    '$.executionBoundary.adapterInjected',
    '$.executionBoundary.clientCreated',
    '$.executionBoundary.credentialValuesRead',
    '$.executionBoundary.credentialPresenceChecked',
    '$.executionBoundary.liveCheckPerformed',
    '$.executionBoundary.writeTokenIssued',
    '$.executionBoundary.executionLeaseCreated',
    '$.executionBoundary.uploadCommandGenerated',
    '$.executionBoundary.objectWriteAttempted',
    '$.executionBoundary.metadataIndexWriteAttempted',
    '$.executionBoundary.remoteMutationPerformed'
  ]) {
    assert.equal(forgedReport.issues.some(issue => issue.path === path), true, path);
  }
  assertNoPrivateValues(forgedReport);
});
