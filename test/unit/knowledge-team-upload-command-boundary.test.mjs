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
  buildKnowledgeTeamArtifactContractFixture
} from '../support/knowledge-team-artifact-fixtures.mjs';
import {
  validateKnowledgePayload
} from '../../src/knowledge/validate.ts';

function validBackendReferenceSummary() {
  return validateKnowledgeTeamS3CompatibleBackendReferences(
    buildKnowledgeTeamS3CompatibleBackendConfig(),
    buildKnowledgeTeamS3CompatibleReferenceRegistry()
  );
}

async function validLiveCheckBoundary() {
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
  return buildKnowledgeTeamUploadLiveCheckBoundary({ credentialPresenceBoundary });
}

function assertNoPrivateValues(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const forbidden of [
    'https://should-not-copy.example.test',
    'should-not-copy-bucket',
    'should-not-copy-secret',
    'aws s3 cp',
    's3://private-bucket',
    'private-key',
    'client-secret-value',
    'credential-secret-value',
    'raw-artifact-bytes',
    'private-live-check-output',
    'signed-upload-command'
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
}

function assertExecutionAndCommandDisabled(boundary) {
  assert.equal(boundary.mutationAllowed, false);
  assert.equal(boundary.executionMode, 'dry-run');
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
  assert.equal(boundary.uploadCommandBoundary.credentialValuesRead, false);
  assert.equal(boundary.uploadCommandBoundary.credentialValuesExposed, false);
  assert.equal(boundary.uploadCommandBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.uploadCommandBoundary.credentialPresenceResultExposed, false);
  assert.equal(boundary.uploadCommandBoundary.clientCreated, false);
  assert.equal(boundary.uploadCommandBoundary.sdkClientCreated, false);
  assert.equal(boundary.uploadCommandBoundary.adapterInjected, false);
  assert.equal(boundary.uploadCommandBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.uploadCommandBoundary.metadataIndexBound, false);
  assert.equal(boundary.uploadCommandBoundary.liveCheckAllowed, false);
  assert.equal(boundary.uploadCommandBoundary.liveCheckPerformed, false);
  assert.equal(boundary.uploadCommandBoundary.liveCheckResultExposed, false);
  assert.equal(boundary.uploadCommandBoundary.uploadCommandGenerated, false);
  assert.equal(boundary.uploadCommandBoundary.uploadCommandMaterialized, false);
  assert.equal(boundary.uploadCommandBoundary.uploadCommandExposed, false);
  assert.equal(boundary.uploadCommandBoundary.uploadExecutionAllowed, false);
  assert.equal(boundary.uploadCommandBoundary.objectWriteAttempted, false);
  assert.equal(boundary.uploadCommandBoundary.metadataIndexWriteAttempted, false);
  assert.equal(boundary.uploadCommandBoundary.remoteMutationPerformed, false);
  assert.equal(boundary.uploadCommandBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.artifactBytesProvided, false);
  assert.equal(boundary.remainingExecutionBoundaries.adapterInjected, false);
  assert.equal(boundary.remainingExecutionBoundaries.clientCreated, false);
  assert.equal(boundary.remainingExecutionBoundaries.credentialValuesExposed, false);
  assert.equal(boundary.remainingExecutionBoundaries.credentialPresenceChecked, false);
  assert.equal(boundary.remainingExecutionBoundaries.liveCheckPerformed, false);
  assert.equal(boundary.remainingExecutionBoundaries.uploadCommandGenerated, false);
  assert.equal(boundary.remainingExecutionBoundaries.objectWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.metadataIndexWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.remoteMutationAllowed, false);
}

function blockerCodes(boundary) {
  return new Set(boundary.readiness.blockerCodes);
}

test('upload command boundary records command requirements without generating commands', async () => {
  const liveCheckBoundary = await validLiveCheckBoundary();
  const boundary = buildKnowledgeTeamUploadCommandBoundary({ liveCheckBoundary });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-command-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'upload-command-boundary-dry-run');
  assert.equal(boundary.status, 'upload-command-boundary-ready', JSON.stringify(boundary.readiness.blockers));
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionAndCommandDisabled(boundary);
  assert.equal(boundary.target.manifestId, liveCheckBoundary.target.manifestId);
  assert.equal(boundary.target.objectKeyRedacted, true);
  assert.equal(Object.hasOwn(boundary.target, 'objectKey'), false);
  assert.equal(JSON.stringify(boundary).includes(liveCheckBoundary.target.objectKey), false);
  assert.equal(boundary.target.objectSha256, liveCheckBoundary.target.objectSha256);
  assert.equal(boundary.target.artifactId, liveCheckBoundary.target.artifactId);
  assert.equal(boundary.sourceLiveCheckBoundary.source, 'upload-live-check-boundary');
  assert.equal(boundary.sourceLiveCheckBoundary.boundaryStatus, 'live-check-boundary-ready');
  assert.equal(boundary.sourceLiveCheckBoundary.boundaryKind, 'live-check-boundary-dry-run');
  assert.equal(boundary.sourceLiveCheckBoundary.boundaryNextAction, 'design-upload-command-boundary');
  assert.equal(boundary.sourceLiveCheckBoundary.reviewStatus, 'review-ready');
  assert.equal(boundary.sourceLiveCheckBoundary.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourceLiveCheckBoundary.scopeMatched, true);
  assert.equal(boundary.sourceLiveCheckBoundary.humanReviewRecorded, true);
  assert.equal(boundary.sourceLiveCheckBoundary.fingerprintVerified, true);
  assert.equal(boundary.sourceLiveCheckBoundary.sourceFingerprintVerified, true);
  assert.equal(boundary.sourceLiveCheckBoundary.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourceLiveCheckBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceLiveCheckBoundary.liveCheckPolicyRequired, true);
  assert.equal(boundary.sourceLiveCheckBoundary.liveCheckReadOnlyRequired, true);
  assert.equal(boundary.sourceLiveCheckBoundary.liveCheckResultRedactionRequired, true);
  assert.equal(boundary.sourceLiveCheckBoundary.liveCheckPerformed, false);
  assert.equal(boundary.sourceLiveCheckBoundary.liveCheckResultExposed, false);
  assert.equal(boundary.sourceLiveCheckBoundary.uploadCommandGenerated, false);
  assert.equal(boundary.uploadCommandBoundary.dryRunOnly, true);
  assert.equal(boundary.uploadCommandBoundary.uploadCommandRequiredBeforeExecution, true);
  assert.equal(boundary.uploadCommandBoundary.uploadCommandRequiredAfterLiveCheckBoundary, true);
  assert.equal(boundary.uploadCommandBoundary.uploadCommandDescriptorRequired, true);
  assert.equal(boundary.uploadCommandBoundary.uploadCommandPayloadRedactionRequired, true);
  assert.equal(boundary.uploadCommandBoundary.uploadCommandMaterialRedactionRequired, true);
  assert.equal(boundary.uploadCommandBoundary.commandExecutionApprovalRequired, true);
  assert.equal(boundary.uploadCommandBoundary.artifactObjectStoreDependencyRequired, true);
  assert.equal(boundary.uploadCommandBoundary.metadataIndexDependencyRequired, true);
  assert.equal(boundary.uploadCommandBoundary.explicitUploadApprovalRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.liveCheckRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.uploadCommandRequired, true);
  assert.equal(boundary.readiness.status, 'upload-command-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-object-index-binding-boundary');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assert.equal(validateKnowledgePayload(boundary, 'knowledge-pack.upload-command-boundary.json').valid, true);
  assertNoPrivateValues(boundary);
});

test('upload command boundary blocks non-ready live check boundaries', async () => {
  const liveCheckBoundary = await validLiveCheckBoundary();
  const boundary = buildKnowledgeTeamUploadCommandBoundary({
    liveCheckBoundary: {
      ...liveCheckBoundary,
      status: 'blocked',
      readiness: {
        ...liveCheckBoundary.readiness,
        status: 'blocked',
        nextAction: 'resolve-blockers',
        blockerCount: 1,
        blockerCodes: ['live-check-enabled'],
        blockers: [{
          code: 'live-check-enabled',
          path: '$.liveCheckBoundary.liveCheckPerformed',
          message: 'live check was performed'
        }]
      }
    }
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.readiness.nextAction, 'resolve-blockers');
  assert.equal(codes.has('live-check-boundary-not-ready'), true);
  assert.equal(codes.has('live-check-boundary-next-action-invalid'), true);
  assert.equal(boundary.sourceLiveCheckBoundary.boundaryStatus, 'blocked');
  assertExecutionAndCommandDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload command boundary validation rejects forged command state', async () => {
  const liveCheckBoundary = await validLiveCheckBoundary();
  const boundary = buildKnowledgeTeamUploadCommandBoundary({ liveCheckBoundary });
  const report = validateKnowledgePayload({
    ...boundary,
    uploadCommand: { argv: ['aws', 's3', 'cp'] },
    target: {
      ...boundary.target,
      objectKey: liveCheckBoundary.target.objectKey
    },
    uploadCommandBoundary: {
      ...boundary.uploadCommandBoundary,
      uploadCommandGenerated: true,
      uploadCommandMaterialized: true,
      uploadCommandExposed: true,
      executable: true
    },
    remainingExecutionBoundaries: {
      ...boundary.remainingExecutionBoundaries,
      uploadCommandGenerated: true
    }
  }, 'knowledge-pack.upload-command-boundary.json');

  assert.equal(report.valid, false);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadCommand'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.target.objectKey'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadCommandBoundary.uploadCommandGenerated'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadCommandBoundary.uploadCommandMaterialized'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadCommandBoundary.uploadCommandExposed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadCommandBoundary.executable'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.uploadCommandGenerated'), true);
});

test('upload command boundary validation rejects top-level execution flags', async () => {
  const liveCheckBoundary = await validLiveCheckBoundary();
  const boundary = buildKnowledgeTeamUploadCommandBoundary({ liveCheckBoundary });
  const report = validateKnowledgePayload({
    ...boundary,
    mutationAllowed: true,
    executionMode: 'execute',
    remoteWriteAllowed: true,
    liveCheckAllowed: true,
    credentialValuesExposed: true,
    credentialPresenceChecked: true,
    uploadApproved: true,
    uploadExecutionAllowed: true,
    mutationApprovalGranted: true,
    clientCreated: true,
    adapterInjected: true,
    artifactBytesProvided: true,
    writeTokenIssued: true,
    executionLeaseCreated: true,
    rollbackPlanCreated: true,
    auditRecordCreated: true,
    objectWriteAttempted: true,
    metadataIndexWriteAttempted: true,
    remoteMutationPerformed: true
  }, 'knowledge-pack.upload-command-boundary.json');

  assert.equal(report.valid, false);
  for (const path of [
    '$.mutationAllowed',
    '$.executionMode',
    '$.remoteWriteAllowed',
    '$.liveCheckAllowed',
    '$.credentialValuesExposed',
    '$.credentialPresenceChecked',
    '$.uploadApproved',
    '$.uploadExecutionAllowed',
    '$.mutationApprovalGranted',
    '$.clientCreated',
    '$.adapterInjected',
    '$.artifactBytesProvided',
    '$.writeTokenIssued',
    '$.executionLeaseCreated',
    '$.rollbackPlanCreated',
    '$.auditRecordCreated',
    '$.objectWriteAttempted',
    '$.metadataIndexWriteAttempted',
    '$.remoteMutationPerformed'
  ]) {
    assert.equal(report.issues.some(issue => issue.path === path), true, path);
  }
});

test('upload command boundary validation rejects missing ready prerequisites', async () => {
  const liveCheckBoundary = await validLiveCheckBoundary();
  const boundary = buildKnowledgeTeamUploadCommandBoundary({ liveCheckBoundary });
  const report = validateKnowledgePayload({
    ...boundary,
    status: 'upload-command-boundary-ready',
    sourceLiveCheckBoundary: {
      ...boundary.sourceLiveCheckBoundary,
      boundaryStatus: 'blocked',
      boundaryNextAction: 'resolve-blockers',
      liveCheckPerformed: true,
      uploadCommandGenerated: true,
      adapterBackendKind: 's3-compatible'
    },
    uploadCommandBoundary: {
      ...boundary.uploadCommandBoundary,
      uploadCommandRequiredBeforeExecution: false,
      commandExecutionApprovalRequired: false
    },
    readiness: {
      ...boundary.readiness,
      status: 'upload-command-boundary-ready',
      nextAction: 'resolve-blockers',
      blockerCount: 1,
      blockerCodes: ['live-check-boundary-not-ready'],
      blockers: [{
        code: 'live-check-boundary-not-ready',
        path: '$.sourceLiveCheckBoundary.boundaryStatus',
        message: 'not ready'
      }]
    }
  }, 'knowledge-pack.upload-command-boundary.json');

  assert.equal(report.valid, false);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceLiveCheckBoundary.boundaryStatus'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceLiveCheckBoundary.boundaryNextAction'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceLiveCheckBoundary.liveCheckPerformed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceLiveCheckBoundary.uploadCommandGenerated'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceLiveCheckBoundary.adapterBackendKind'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadCommandBoundary.uploadCommandRequiredBeforeExecution'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadCommandBoundary.commandExecutionApprovalRequired'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.readiness.nextAction'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.readiness.blockerCount'), true);
});

test('upload command boundary validation rejects malformed section shapes', async () => {
  const liveCheckBoundary = await validLiveCheckBoundary();
  const boundary = buildKnowledgeTeamUploadCommandBoundary({ liveCheckBoundary });
  const report = validateKnowledgePayload({
    ...boundary,
    status: 'blocked',
    target: null,
    sourceLiveCheckBoundary: null,
    uploadCommandBoundary: null,
    remainingExecutionBoundaries: null,
    readiness: {
      ...boundary.readiness,
      status: 'blocked',
      nextAction: 'design-object-index-binding-boundary',
      blockerCount: 1,
      blockerCodes: ['missing-required-field'],
      blockers: [{
        code: 'missing-required-field',
        path: '$.target',
        message: 'target missing'
      }]
    }
  }, 'knowledge-pack.upload-command-boundary.json');

  assert.equal(report.valid, false);
  assert.equal(report.issues.some(issue => issue.path === '$.target'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceLiveCheckBoundary'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadCommandBoundary'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.remainingExecutionBoundaries'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.readiness.nextAction'), true);
});

test('upload command boundary validation rejects nested boundary drift', async () => {
  const liveCheckBoundary = await validLiveCheckBoundary();
  const boundary = buildKnowledgeTeamUploadCommandBoundary({ liveCheckBoundary });
  const requiredCommandFields = [
    'dryRunOnly',
    'uploadCommandRequiredBeforeExecution',
    'uploadCommandRequiredAfterLiveCheckBoundary',
    'liveCheckBoundaryRequired',
    'liveCheckPolicyRequired',
    'liveCheckResultRedactionRequired',
    'credentialPresenceBoundaryRequired',
    'credentialReadBoundaryRequired',
    'credentialSourceDescriptorRequired',
    'credentialReferenceOnlyRequired',
    'credentialValueRedactionRequired',
    'credentialPresenceResultRedactionRequired',
    'mockAdapterRequired',
    'clientFactoryDescriptorRequired',
    'uploadCommandDescriptorRequired',
    'uploadCommandPayloadRedactionRequired',
    'uploadCommandMaterialRedactionRequired',
    'commandExecutionApprovalRequired',
    'artifactObjectStoreDependencyRequired',
    'metadataIndexDependencyRequired',
    'contentAddressedObjectKeysRequired',
    'contentAddressedIndexKeysRequired',
    'idempotentWritesRequired',
    'explicitUploadApprovalRequired'
  ];
  const disabledCommandFields = [
    'credentialValuesRead',
    'credentialValuesExposed',
    'credentialPresenceChecked',
    'credentialPresenceResultExposed',
    'clientCreated',
    'sdkClientCreated',
    'adapterInjected',
    'artifactObjectStoreBound',
    'metadataIndexBound',
    'liveCheckAllowed',
    'liveCheckPerformed',
    'liveCheckResultExposed',
    'uploadCommandGenerated',
    'uploadCommandMaterialized',
    'uploadCommandExposed',
    'uploadExecutionAllowed',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed',
    'executable'
  ];
  const requiredRemainingFields = [
    'artifactBytesRequired',
    'adapterInjectionRequired',
    'clientCreationRequired',
    'credentialReadRequired',
    'credentialPresenceCheckRequired',
    'liveCheckRequired',
    'uploadCommandRequired',
    'writeTokenRequired',
    'executionLeaseRequired',
    'rollbackPlanRequired',
    'auditRecordRequired'
  ];
  const disabledRemainingFields = [
    'artifactBytesProvided',
    'adapterInjected',
    'clientCreated',
    'credentialValuesExposed',
    'credentialPresenceChecked',
    'liveCheckPerformed',
    'uploadCommandGenerated',
    'writeTokenIssued',
    'executionLeaseCreated',
    'rollbackPlanCreated',
    'auditRecordCreated',
    'objectWriteAllowed',
    'metadataIndexWriteAllowed',
    'remoteMutationAllowed'
  ];
  const uploadCommandBoundary = { ...boundary.uploadCommandBoundary };
  const remainingExecutionBoundaries = { ...boundary.remainingExecutionBoundaries };
  for (const key of requiredCommandFields) {
    uploadCommandBoundary[key] = false;
  }
  for (const key of disabledCommandFields) {
    uploadCommandBoundary[key] = true;
  }
  for (const key of requiredRemainingFields) {
    remainingExecutionBoundaries[key] = false;
  }
  for (const key of disabledRemainingFields) {
    remainingExecutionBoundaries[key] = true;
  }

  const report = validateKnowledgePayload({
    ...boundary,
    uploadCommandBoundary,
    remainingExecutionBoundaries
  }, 'knowledge-pack.upload-command-boundary.json');

  assert.equal(report.valid, false);
  for (const key of [...requiredCommandFields, ...disabledCommandFields]) {
    assert.equal(report.issues.some(issue => issue.path === `$.uploadCommandBoundary.${key}`), true, key);
  }
  for (const key of [...requiredRemainingFields, ...disabledRemainingFields]) {
    assert.equal(report.issues.some(issue => issue.path === `$.remainingExecutionBoundaries.${key}`), true, key);
  }
});

test('upload command boundary blocks invalid live check inputs', () => {
  const boundary = buildKnowledgeTeamUploadCommandBoundary({
    liveCheckBoundary: 'not-json'
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('invalid-live-check-boundary-kind'), true);
  assert.equal(boundary.target.objectKeyRedacted, true);
  assertExecutionAndCommandDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload command boundary blocks primitive private live check inputs without copying values', () => {
  const boundary = buildKnowledgeTeamUploadCommandBoundary({
    liveCheckBoundary: 'https://should-not-copy.example.test/private-key'
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('invalid-live-check-boundary-kind'), true);
  assert.equal(codes.has('backend-detail-leak'), true);
  assertExecutionAndCommandDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload command boundary blocks malformed live check metadata', async () => {
  const liveCheckBoundary = await validLiveCheckBoundary();
  const boundary = buildKnowledgeTeamUploadCommandBoundary({
    liveCheckBoundary: {
      ...liveCheckBoundary,
      kind: 'wrong-kind',
      status: 'waiting-for-command',
      schemaVersion: 2,
      boundaryKind: 'wrong-boundary',
      target: {
        manifestId: 'unsafe-id',
        objectKey: 'not a safe object key',
        objectSha256: 'not-a-sha',
        artifactId: 'unsafe-artifact-id'
      },
      readiness: {
        ...liveCheckBoundary.readiness,
        nextAction: 'execute-upload'
      },
      sourceCredentialPresenceBoundary: {
        ...liveCheckBoundary.sourceCredentialPresenceBoundary,
        adapterName: 'unsafe adapter name',
        adapterBackendKind: 's3-compatible',
        fingerprintVerified: false
      }
    }
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('invalid-live-check-boundary-kind'), true);
  assert.equal(codes.has('invalid-schema-version'), true);
  assert.equal(codes.has('invalid-boundary-kind'), true);
  assert.equal(codes.has('live-check-boundary-next-action-invalid'), true);
  assert.equal(codes.has('live-check-boundary-not-ready'), true);
  assert.equal(codes.has('unsafe-artifact-reference'), true);
  assert.equal(codes.has('unsafe-adapter-name'), true);
  assert.equal(codes.has('unsupported-adapter-backend'), true);
  assert.equal(codes.has('review-fingerprint-unverified'), true);
  assertExecutionAndCommandDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload command boundary blocks missing live check sections', async () => {
  const liveCheckBoundary = await validLiveCheckBoundary();
  const {
    sourceCredentialPresenceBoundary,
    liveCheckBoundary: liveCheckBoundarySection,
    remainingExecutionBoundaries,
    target,
    ...missingSections
  } = liveCheckBoundary;
  assert.equal(sourceCredentialPresenceBoundary.source, 'upload-credential-presence-boundary');
  assert.equal(liveCheckBoundarySection.dryRunOnly, true);
  assert.equal(remainingExecutionBoundaries.uploadCommandRequired, true);
  assert.equal(typeof target.objectKey, 'string');

  const boundary = buildKnowledgeTeamUploadCommandBoundary({
    liveCheckBoundary: missingSections
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('missing-required-field'), true);
  assert.equal(codes.has('unsafe-artifact-reference'), true);
  assert.equal(codes.has('upload-command-not-required'), true);
  assert.equal(codes.has('live-check-not-required'), true);
  assertExecutionAndCommandDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload command boundary blocks forged command and execution state', async () => {
  const liveCheckBoundary = await validLiveCheckBoundary();
  const boundary = buildKnowledgeTeamUploadCommandBoundary({
    liveCheckBoundary: {
      ...liveCheckBoundary,
      uploadExecutionAllowed: true,
      remoteMutationPerformed: true,
      uploadCommand: { argv: ['aws', 's3', 'cp'] },
      liveCheckBoundary: {
        ...liveCheckBoundary.liveCheckBoundary,
        liveCheckPerformed: true,
        liveCheckResultExposed: true,
        uploadCommandGenerated: true,
        executable: true
      },
      remainingExecutionBoundaries: {
        ...liveCheckBoundary.remainingExecutionBoundaries,
        uploadCommandGenerated: true,
        objectWriteAllowed: true,
        remoteMutationAllowed: true
      }
    }
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('upload-execution-enabled'), true);
  assert.equal(codes.has('remote-mutation-performed'), true);
  assert.equal(codes.has('upload-command-present'), true);
  assert.equal(codes.has('live-check-enabled'), true);
  assert.equal(codes.has('live-check-result-exposed'), true);
  assert.equal(codes.has('upload-command-generated'), true);
  assert.equal(codes.has('executable-state-enabled'), true);
  assert.equal(codes.has('remote-write-enabled'), true);
  assertExecutionAndCommandDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload command boundary reports command, backend, and credential details without copying values', async () => {
  const liveCheckBoundary = await validLiveCheckBoundary();
  const boundary = buildKnowledgeTeamUploadCommandBoundary({
    liveCheckBoundary: {
      ...liveCheckBoundary,
      uploadCommandPayload: 'aws s3 cp ./private s3://private-bucket/object',
      commandLine: 'curl https://should-not-copy.example.test',
      backend: {
        endpoint: 'https://should-not-copy.example.test',
        bucket: 'should-not-copy-bucket',
        authorization: 'should-not-copy-secret'
      },
      credentialValuePayload: 'credential-secret-value',
      liveCheckResultPayload: 'private-live-check-output',
      clientConfig: {
        secret: 'client-secret-value'
      },
      adapterInstance: {
        endpoint: 'https://should-not-copy.example.test'
      },
      artifactBytesBase64: 'raw-artifact-bytes'
    }
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('upload-command-present'), true);
  assert.equal(codes.has('backend-detail-leak'), true);
  assert.equal(codes.has('credential-dependency-leak'), true);
  assert.equal(codes.has('live-check-enabled'), true);
  assert.equal(codes.has('client-dependency-leak'), true);
  assert.equal(codes.has('adapter-dependency-leak'), true);
  assert.equal(codes.has('artifact-bytes-provided'), true);
  assertExecutionAndCommandDisabled(boundary);
  assertNoPrivateValues(boundary);
});
