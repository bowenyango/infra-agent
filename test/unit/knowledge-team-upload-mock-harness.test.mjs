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

async function validPreflight() {
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
  return buildKnowledgeTeamUploadAdapterPreflight({
    continuation,
    adapterResolutionPlan
  });
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

test('upload mock harness accepts preflight-ready artifacts without executing writes', async () => {
  const preflight = await validPreflight();
  const harness = buildKnowledgeTeamUploadMockHarness({ preflight });

  assert.equal(harness.kind, 'infra-agent.knowledge-team-upload-mock-harness');
  assert.equal(harness.schemaVersion, 1);
  assert.equal(harness.mutationAllowed, false);
  assert.equal(harness.executionMode, 'dry-run');
  assert.equal(harness.harnessKind, 'in-memory-mock');
  assert.equal(harness.status, 'harness-ready');
  assert.equal(harness.plannedOperation, 'stage-knowledge-pack');
  assert.equal(harness.remoteWriteAllowed, false);
  assert.equal(harness.liveCheckAllowed, false);
  assert.equal(harness.credentialValuesExposed, false);
  assert.equal(harness.credentialPresenceChecked, false);
  assert.equal(harness.uploadApproved, false);
  assert.equal(harness.uploadExecutionAllowed, false);
  assert.equal(harness.clientCreated, false);
  assert.equal(harness.adapterInjected, false);
  assert.equal(harness.mockAdapterInstantiated, true);
  assert.equal(harness.objectWriteAttempted, false);
  assert.equal(harness.metadataIndexWriteAttempted, false);
  assert.equal(harness.remoteMutationPerformed, false);
  assert.equal(harness.uploadCommand, null);
  assert.equal(harness.preflight.status, 'preflight-ready');
  assert.equal(harness.preflight.adapterName, 'mock-team-cache');
  assert.equal(harness.preflight.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(harness.preflight.injectionCandidate, true);
  assert.equal(harness.preflight.objectKey, preflight.continuation.objectKey);
  assert.equal(harness.preflight.objectSha256, preflight.continuation.objectSha256);
  assert.equal(harness.mockHarness.adapterFactory, 'createMockKnowledgeTeamBackendAdapter');
  assert.equal(harness.mockHarness.backendKind, 'mock-s3-compatible');
  assert.equal(harness.mockHarness.descriptorMatched, true);
  assert.equal(harness.mockHarness.artifactObjectStoreAvailable, true);
  assert.equal(harness.mockHarness.metadataIndexAvailable, true);
  assert.equal(harness.mockHarness.objectWriteAttempted, false);
  assert.equal(harness.mockHarness.indexWriteAttempted, false);
  assert.equal(harness.mockHarness.remoteMutationPerformed, false);
  assert.equal(harness.readiness.nextAction, 'run-mock-only-contract-tests');
  assert.equal(harness.readiness.blockerCount, 0);
  assert.deepEqual(harness.readiness.blockerCodes, []);
});

test('upload mock harness blocks preflight artifacts that are not ready', async () => {
  const preflight = {
    ...(await validPreflight()),
    status: 'blocked',
    adapterDependency: {
      ...(await validPreflight()).adapterDependency,
      injectionCandidate: false,
      resolutionStatus: 'blocked'
    }
  };
  const harness = buildKnowledgeTeamUploadMockHarness({ preflight });

  assert.equal(harness.status, 'blocked');
  assert.equal(harness.uploadExecutionAllowed, false);
  assert.equal(harness.clientCreated, false);
  assert.equal(harness.adapterInjected, false);
  assert.equal(harness.mockAdapterInstantiated, false);
  assert.equal(harness.objectWriteAttempted, false);
  assert.equal(harness.metadataIndexWriteAttempted, false);
  assert.equal(harness.remoteMutationPerformed, false);
  assert.equal(harness.uploadCommand, null);
  assert.equal(harness.mockHarness.objectWriteAttempted, false);
  assert.equal(harness.mockHarness.indexWriteAttempted, false);
  assert.equal(harness.readiness.nextAction, 'resolve-blockers');
  assert.equal(harness.readiness.blockerCodes.includes('preflight-not-ready'), true);
  assert.equal(harness.readiness.blockerCodes.includes('adapter-resolution-not-ready'), true);
});

test('upload mock harness rejects forged preflight execution flags', async () => {
  const preflight = {
    ...(await validPreflight()),
    mutationAllowed: true,
    remoteWriteAllowed: true,
    liveCheckAllowed: true,
    credentialValuesExposed: true,
    credentialPresenceChecked: true,
    uploadApproved: true,
    uploadExecutionAllowed: true,
    clientCreated: true,
    adapterInjected: true,
    uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key'
  };
  const harness = buildKnowledgeTeamUploadMockHarness({ preflight });

  assert.equal(harness.status, 'blocked');
  assert.equal(harness.remoteWriteAllowed, false);
  assert.equal(harness.liveCheckAllowed, false);
  assert.equal(harness.credentialValuesExposed, false);
  assert.equal(harness.credentialPresenceChecked, false);
  assert.equal(harness.uploadApproved, false);
  assert.equal(harness.uploadExecutionAllowed, false);
  assert.equal(harness.clientCreated, false);
  assert.equal(harness.adapterInjected, false);
  assert.equal(harness.objectWriteAttempted, false);
  assert.equal(harness.metadataIndexWriteAttempted, false);
  assert.equal(harness.remoteMutationPerformed, false);
  assert.equal(harness.uploadCommand, null);
  assert.equal(harness.readiness.blockerCodes.includes('mutation-enabled'), true);
  assert.equal(harness.readiness.blockerCodes.includes('remote-write-enabled'), true);
  assert.equal(harness.readiness.blockerCodes.includes('live-check-enabled'), true);
  assert.equal(harness.readiness.blockerCodes.includes('credential-values-exposed'), true);
  assert.equal(harness.readiness.blockerCodes.includes('credential-presence-check-enabled'), true);
  assert.equal(harness.readiness.blockerCodes.includes('upload-approval-already-provided'), true);
  assert.equal(harness.readiness.blockerCodes.includes('upload-execution-enabled'), true);
  assert.equal(harness.readiness.blockerCodes.includes('client-created'), true);
  assert.equal(harness.readiness.blockerCodes.includes('adapter-injected'), true);
  assert.equal(harness.readiness.blockerCodes.includes('upload-command-present'), true);
});

test('upload mock harness blocks real backend and adapter capability drift', async () => {
  const preflight = {
    ...(await validPreflight()),
    adapterDependency: {
      ...(await validPreflight()).adapterDependency,
      backendKind: 's3-compatible',
      adapterName: 'mock-team-cache',
      injectionCandidate: true,
      resolutionStatus: 'resolvable',
      artifactObjectStore: false,
      metadataIndex: false,
      remoteWriteAllowed: true,
      liveCheckAllowed: true,
      credentialValuesExposed: true,
      uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key'
    }
  };
  const harness = buildKnowledgeTeamUploadMockHarness({ preflight });

  assert.equal(harness.status, 'blocked');
  assert.equal(harness.preflight.adapterBackendKind, 's3-compatible');
  assert.equal(harness.mockHarness.backendKind, 'unsupported');
  assert.equal(harness.mockAdapterInstantiated, false);
  assert.equal(harness.objectWriteAttempted, false);
  assert.equal(harness.metadataIndexWriteAttempted, false);
  assert.equal(harness.remoteMutationPerformed, false);
  assert.equal(harness.readiness.blockerCodes.includes('real-backend-not-implemented'), true);
  assert.equal(harness.readiness.blockerCodes.includes('unsupported-adapter-backend'), true);
  assert.equal(harness.readiness.blockerCodes.includes('adapter-capability-disabled'), true);
  assert.equal(harness.readiness.blockerCodes.includes('adapter-remote-write-enabled'), true);
  assert.equal(harness.readiness.blockerCodes.includes('adapter-live-check-enabled'), true);
  assert.equal(harness.readiness.blockerCodes.includes('adapter-credential-values-exposed'), true);
  assert.equal(harness.readiness.blockerCodes.includes('adapter-upload-command-present'), true);
});

test('upload mock harness blocks backend detail and store leakage', async () => {
  const preflight = {
    ...(await validPreflight()),
    endpointUrl: 'https://should-not-copy.example.test',
    bucketName: 'should-not-copy-bucket',
    secretAccessKey: 'should-not-copy-secret',
    artifactStore: {
      putObject: 'should-not-be-present'
    },
    metadataIndex: {
      putEntry: 'should-not-be-present'
    },
    adapterDependency: {
      ...(await validPreflight()).adapterDependency,
      clientConfig: {
        endpointUrl: 'https://should-not-copy.example.test'
      }
    }
  };
  const harness = buildKnowledgeTeamUploadMockHarness({ preflight });

  assert.equal(harness.status, 'blocked');
  assert.equal(harness.mockAdapterInstantiated, false);
  assert.equal(harness.uploadCommand, null);
  assert.equal(harness.objectWriteAttempted, false);
  assert.equal(harness.metadataIndexWriteAttempted, false);
  assert.equal(harness.remoteMutationPerformed, false);
  assert.equal(harness.readiness.blockerCodes.includes('backend-detail-leak'), true);
  assertNoPrivateValues(harness);
});

test('upload mock harness blocks primitive private preflight inputs without copying values', () => {
  const harness = buildKnowledgeTeamUploadMockHarness({
    preflight: ['https://should-not-copy.example.test/private-key']
  });

  assert.equal(harness.status, 'blocked');
  assert.equal(harness.preflight.status, 'invalid');
  assert.equal(harness.mockAdapterInstantiated, false);
  assert.equal(harness.readiness.nextAction, 'resolve-blockers');
  assert.equal(harness.readiness.blockerCodes.includes('invalid-preflight-kind'), true);
  assert.equal(harness.readiness.blockerCodes.includes('backend-detail-leak'), true);
  assertNoPrivateValues(harness);
});

test('upload mock harness blocks missing and unsafe continuation references', async () => {
  const basePreflight = await validPreflight();
  const missingReferenceHarness = buildKnowledgeTeamUploadMockHarness({
    preflight: {
      ...basePreflight,
      continuation: {
        ...basePreflight.continuation,
        manifestId: '',
        objectKey: '',
        objectSha256: '',
        artifactId: ''
      }
    }
  });
  const unsafeReferenceHarness = buildKnowledgeTeamUploadMockHarness({
    preflight: {
      ...basePreflight,
      continuation: {
        ...basePreflight.continuation,
        manifestId: 'unsafe-id',
        objectKey: '../private-key',
        objectSha256: 'not-a-sha',
        artifactId: 'unsafe-artifact'
      }
    }
  });

  for (const harness of [missingReferenceHarness, unsafeReferenceHarness]) {
    assert.equal(harness.status, 'blocked');
    assert.equal(harness.preflight.manifestId, null);
    assert.equal(harness.preflight.objectKey, null);
    assert.equal(harness.preflight.objectSha256, null);
    assert.equal(harness.preflight.artifactId, null);
    assert.equal(harness.mockAdapterInstantiated, false);
    assert.equal(harness.readiness.nextAction, 'resolve-blockers');
    assert.equal(harness.readiness.blockerCodes.includes('missing-required-field') || harness.readiness.blockerCodes.includes('unsafe-artifact-reference'), true);
    assertNoPrivateValues(harness);
  }
});

test('knowledge validation accepts and rejects upload mock harness artifacts', async () => {
  const harness = buildKnowledgeTeamUploadMockHarness({ preflight: await validPreflight() });
  const validReport = validateKnowledgePayload(harness, 'upload-mock-harness.json');

  assert.equal(validReport.valid, true);
  assert.equal(validReport.inputKind, 'infra-agent.knowledge-team-upload-mock-harness');
  assert.equal(validReport.issueCount, 0);

  const forgedReport = validateKnowledgePayload({
    ...harness,
    remoteWriteAllowed: true,
    uploadApproved: true,
    uploadExecutionAllowed: true,
    clientCreated: true,
    adapterInjected: true,
    objectWriteAttempted: true,
    metadataIndexWriteAttempted: true,
    remoteMutationPerformed: true,
    uploadCommand: 'aws s3 cp private.json s3://private-bucket/private-key',
    preflight: {
      ...harness.preflight,
      adapterBackendKind: 's3-compatible'
    },
    mockHarness: {
      ...harness.mockHarness,
      backendKind: 'unsupported',
      objectWriteAttempted: true,
      indexWriteAttempted: true,
      remoteMutationPerformed: true
    }
  }, 'forged-upload-mock-harness.json');

  assert.equal(forgedReport.valid, false);
  assert.equal(forgedReport.issues.some(issue => issue.path === '$.remoteWriteAllowed'), true);
  assert.equal(forgedReport.issues.some(issue => issue.path === '$.uploadApproved'), true);
  assert.equal(forgedReport.issues.some(issue => issue.path === '$.uploadExecutionAllowed'), true);
  assert.equal(forgedReport.issues.some(issue => issue.path === '$.clientCreated'), true);
  assert.equal(forgedReport.issues.some(issue => issue.path === '$.adapterInjected'), true);
  assert.equal(forgedReport.issues.some(issue => issue.path === '$.objectWriteAttempted'), true);
  assert.equal(forgedReport.issues.some(issue => issue.path === '$.metadataIndexWriteAttempted'), true);
  assert.equal(forgedReport.issues.some(issue => issue.path === '$.remoteMutationPerformed'), true);
  assert.equal(forgedReport.issues.some(issue => issue.path === '$.uploadCommand'), true);
  assert.equal(forgedReport.issues.some(issue => issue.path === '$.preflight.adapterBackendKind'), true);
  assert.equal(forgedReport.issues.some(issue => issue.path === '$.mockHarness.backendKind'), true);
  assert.equal(forgedReport.issues.some(issue => issue.path === '$.mockHarness.objectWriteAttempted'), true);
  assert.equal(forgedReport.issues.some(issue => issue.path === '$.mockHarness.indexWriteAttempted'), true);
  assert.equal(forgedReport.issues.some(issue => issue.path === '$.mockHarness.remoteMutationPerformed'), true);
  assertNoPrivateValues(forgedReport);
});
