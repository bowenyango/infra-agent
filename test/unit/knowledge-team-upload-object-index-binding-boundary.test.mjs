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
  buildKnowledgeTeamUploadObjectIndexBindingBoundary
} from '../../src/knowledge/team-upload-object-index-binding-boundary.ts';
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

function assertExecutionAndBindingDisabled(boundary) {
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
  assert.equal(boundary.objectIndexBindingBoundary.credentialValuesRead, false);
  assert.equal(boundary.objectIndexBindingBoundary.credentialValuesExposed, false);
  assert.equal(boundary.objectIndexBindingBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.objectIndexBindingBoundary.credentialPresenceResultExposed, false);
  assert.equal(boundary.objectIndexBindingBoundary.clientCreated, false);
  assert.equal(boundary.objectIndexBindingBoundary.sdkClientCreated, false);
  assert.equal(boundary.objectIndexBindingBoundary.adapterInjected, false);
  assert.equal(boundary.objectIndexBindingBoundary.artifactBytesProvided, false);
  assert.equal(boundary.objectIndexBindingBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.objectIndexBindingBoundary.metadataIndexBound, false);
  assert.equal(boundary.objectIndexBindingBoundary.objectStoreHandleExposed, false);
  assert.equal(boundary.objectIndexBindingBoundary.metadataIndexHandleExposed, false);
  assert.equal(boundary.objectIndexBindingBoundary.liveCheckAllowed, false);
  assert.equal(boundary.objectIndexBindingBoundary.liveCheckPerformed, false);
  assert.equal(boundary.objectIndexBindingBoundary.liveCheckResultExposed, false);
  assert.equal(boundary.objectIndexBindingBoundary.uploadCommandGenerated, false);
  assert.equal(boundary.objectIndexBindingBoundary.uploadCommandMaterialized, false);
  assert.equal(boundary.objectIndexBindingBoundary.uploadCommandExposed, false);
  assert.equal(boundary.objectIndexBindingBoundary.uploadExecutionAllowed, false);
  assert.equal(boundary.objectIndexBindingBoundary.objectWriteAllowed, false);
  assert.equal(boundary.objectIndexBindingBoundary.metadataIndexWriteAllowed, false);
  assert.equal(boundary.objectIndexBindingBoundary.objectWriteAttempted, false);
  assert.equal(boundary.objectIndexBindingBoundary.metadataIndexWriteAttempted, false);
  assert.equal(boundary.objectIndexBindingBoundary.remoteMutationPerformed, false);
  assert.equal(boundary.objectIndexBindingBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.artifactBytesProvided, false);
  assert.equal(boundary.remainingExecutionBoundaries.adapterInjected, false);
  assert.equal(boundary.remainingExecutionBoundaries.clientCreated, false);
  assert.equal(boundary.remainingExecutionBoundaries.credentialValuesExposed, false);
  assert.equal(boundary.remainingExecutionBoundaries.credentialPresenceChecked, false);
  assert.equal(boundary.remainingExecutionBoundaries.liveCheckPerformed, false);
  assert.equal(boundary.remainingExecutionBoundaries.uploadCommandGenerated, false);
  assert.equal(boundary.remainingExecutionBoundaries.artifactObjectStoreBound, false);
  assert.equal(boundary.remainingExecutionBoundaries.metadataIndexBound, false);
  assert.equal(boundary.remainingExecutionBoundaries.objectWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.metadataIndexWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.remoteMutationAllowed, false);
}

function blockerCodes(boundary) {
  return new Set(boundary.readiness.blockerCodes);
}

test('object/index binding boundary records binding requirements without binding stores or indexes', async () => {
  const commandBoundary = await validCommandBoundary();
  const boundary = buildKnowledgeTeamUploadObjectIndexBindingBoundary({ commandBoundary });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-object-index-binding-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'object-index-binding-boundary-dry-run');
  assert.equal(boundary.status, 'object-index-binding-boundary-ready', JSON.stringify(boundary.readiness.blockers));
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionAndBindingDisabled(boundary);
  assert.equal(boundary.target.manifestId, commandBoundary.target.manifestId);
  assert.equal(boundary.target.objectKeyRedacted, true);
  assert.equal(Object.hasOwn(boundary.target, 'objectKey'), false);
  assert.equal(boundary.target.objectSha256, commandBoundary.target.objectSha256);
  assert.equal(boundary.target.artifactId, commandBoundary.target.artifactId);
  assert.equal(boundary.sourceUploadCommandBoundary.source, 'upload-command-boundary');
  assert.equal(boundary.sourceUploadCommandBoundary.boundaryStatus, 'upload-command-boundary-ready');
  assert.equal(boundary.sourceUploadCommandBoundary.boundaryKind, 'upload-command-boundary-dry-run');
  assert.equal(boundary.sourceUploadCommandBoundary.boundaryNextAction, 'design-object-index-binding-boundary');
  assert.equal(boundary.sourceUploadCommandBoundary.reviewStatus, 'review-ready');
  assert.equal(boundary.sourceUploadCommandBoundary.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourceUploadCommandBoundary.scopeMatched, true);
  assert.equal(boundary.sourceUploadCommandBoundary.humanReviewRecorded, true);
  assert.equal(boundary.sourceUploadCommandBoundary.fingerprintVerified, true);
  assert.equal(boundary.sourceUploadCommandBoundary.sourceFingerprintVerified, true);
  assert.equal(boundary.sourceUploadCommandBoundary.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourceUploadCommandBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceUploadCommandBoundary.uploadCommandDescriptorRequired, true);
  assert.equal(boundary.sourceUploadCommandBoundary.uploadCommandGenerated, false);
  assert.equal(boundary.sourceUploadCommandBoundary.uploadCommandMaterialized, false);
  assert.equal(boundary.sourceUploadCommandBoundary.uploadCommandExposed, false);
  assert.equal(boundary.sourceUploadCommandBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.sourceUploadCommandBoundary.metadataIndexBound, false);
  assert.equal(boundary.objectIndexBindingBoundary.dryRunOnly, true);
  assert.equal(boundary.objectIndexBindingBoundary.bindingRequiredAfterUploadCommandBoundary, true);
  assert.equal(boundary.objectIndexBindingBoundary.objectStoreBindingRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.metadataIndexBindingRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.objectStoreDescriptorRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.metadataIndexDescriptorRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.objectKeyRedactionRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.metadataIndexEntryRedactionRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.contentAddressedObjectKeysRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.contentAddressedIndexKeysRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.idempotentObjectWriteRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.idempotentMetadataIndexWriteRequired, true);
  assert.equal(boundary.objectIndexBindingBoundary.objectWriteRequiresExecutionBoundary, true);
  assert.equal(boundary.objectIndexBindingBoundary.metadataIndexWriteRequiresExecutionBoundary, true);
  assert.equal(boundary.remainingExecutionBoundaries.objectIndexBindingRequired, true);
  assert.equal(boundary.readiness.status, 'object-index-binding-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'design-upload-execution-readiness-boundary');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assert.equal(validateKnowledgePayload(boundary, 'knowledge-pack.upload-object-index-binding-boundary.json').valid, true);
  assertNoPrivateValues(boundary);
});

test('object/index binding boundary blocks non-ready command boundaries', async () => {
  const commandBoundary = await validCommandBoundary();
  const boundary = buildKnowledgeTeamUploadObjectIndexBindingBoundary({
    commandBoundary: {
      ...commandBoundary,
      status: 'blocked',
      readiness: {
        ...commandBoundary.readiness,
        status: 'blocked',
        nextAction: 'resolve-blockers',
        blockerCount: 1,
        blockerCodes: ['upload-command-generated'],
        blockers: [{
          code: 'upload-command-generated',
          path: '$.uploadCommandBoundary.uploadCommandGenerated',
          message: 'upload command generated'
        }]
      }
    }
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.readiness.nextAction, 'resolve-blockers');
  assert.equal(codes.has('upload-command-boundary-not-ready'), true);
  assert.equal(codes.has('upload-command-boundary-next-action-invalid'), true);
  assert.equal(boundary.sourceUploadCommandBoundary.boundaryStatus, 'blocked');
  assertExecutionAndBindingDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('object/index binding boundary validation rejects forged binding state', async () => {
  const commandBoundary = await validCommandBoundary();
  const boundary = buildKnowledgeTeamUploadObjectIndexBindingBoundary({ commandBoundary });
  const report = validateKnowledgePayload({
    ...boundary,
    uploadCommand: { argv: ['aws', 's3', 'cp'] },
    target: {
      ...boundary.target,
      objectKey: 'team-artifacts/public-reference/aa/bb/private-key.json'
    },
    objectIndexBindingBoundary: {
      ...boundary.objectIndexBindingBoundary,
      artifactObjectStoreBound: true,
      metadataIndexBound: true,
      objectStoreHandleExposed: true,
      metadataIndexHandleExposed: true,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true,
      objectWriteAttempted: true,
      metadataIndexWriteAttempted: true,
      executable: true
    },
    remainingExecutionBoundaries: {
      ...boundary.remainingExecutionBoundaries,
      artifactObjectStoreBound: true,
      metadataIndexBound: true,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true
    }
  }, 'knowledge-pack.upload-object-index-binding-boundary.json');

  assert.equal(report.valid, false);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadCommand'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.target.objectKey'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.objectIndexBindingBoundary.artifactObjectStoreBound'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.objectIndexBindingBoundary.metadataIndexBound'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.objectIndexBindingBoundary.objectStoreHandleExposed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.objectIndexBindingBoundary.metadataIndexHandleExposed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.objectIndexBindingBoundary.objectWriteAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.objectIndexBindingBoundary.metadataIndexWriteAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.objectIndexBindingBoundary.objectWriteAttempted'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.objectIndexBindingBoundary.metadataIndexWriteAttempted'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.objectIndexBindingBoundary.executable'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.artifactObjectStoreBound'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.metadataIndexBound'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.objectWriteAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.metadataIndexWriteAllowed'), true);
});

test('object/index binding boundary validation rejects missing ready prerequisites', async () => {
  const commandBoundary = await validCommandBoundary();
  const boundary = buildKnowledgeTeamUploadObjectIndexBindingBoundary({ commandBoundary });
  const report = validateKnowledgePayload({
    ...boundary,
    status: 'object-index-binding-boundary-ready',
    sourceUploadCommandBoundary: {
      ...boundary.sourceUploadCommandBoundary,
      boundaryStatus: 'blocked',
      boundaryNextAction: 'resolve-blockers',
      adapterBackendKind: 's3-compatible',
      uploadCommandGenerated: true,
      uploadCommandExposed: true
    },
    objectIndexBindingBoundary: {
      ...boundary.objectIndexBindingBoundary,
      objectStoreBindingRequired: false,
      metadataIndexBindingRequired: false
    },
    readiness: {
      ...boundary.readiness,
      status: 'object-index-binding-boundary-ready',
      nextAction: 'resolve-blockers',
      blockerCount: 1,
      blockerCodes: ['upload-command-boundary-not-ready'],
      blockers: [{
        code: 'upload-command-boundary-not-ready',
        path: '$.sourceUploadCommandBoundary.boundaryStatus',
        message: 'not ready'
      }]
    }
  }, 'knowledge-pack.upload-object-index-binding-boundary.json');

  assert.equal(report.valid, false);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceUploadCommandBoundary.boundaryStatus'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceUploadCommandBoundary.boundaryNextAction'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceUploadCommandBoundary.adapterBackendKind'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceUploadCommandBoundary.uploadCommandGenerated'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceUploadCommandBoundary.uploadCommandExposed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.objectIndexBindingBoundary.objectStoreBindingRequired'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.objectIndexBindingBoundary.metadataIndexBindingRequired'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.readiness.nextAction'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.readiness.blockerCount'), true);
});

test('object/index binding boundary validation rejects malformed section shapes', async () => {
  const commandBoundary = await validCommandBoundary();
  const boundary = buildKnowledgeTeamUploadObjectIndexBindingBoundary({ commandBoundary });
  const report = validateKnowledgePayload({
    ...boundary,
    status: 'blocked',
    target: null,
    sourceUploadCommandBoundary: null,
    objectIndexBindingBoundary: null,
    remainingExecutionBoundaries: null,
    readiness: {
      ...boundary.readiness,
      status: 'blocked',
      nextAction: 'design-upload-execution-readiness-boundary',
      blockerCount: 1,
      blockerCodes: ['missing-required-field'],
      blockers: [{
        code: 'missing-required-field',
        path: '$.target',
        message: 'target missing'
      }]
    }
  }, 'knowledge-pack.upload-object-index-binding-boundary.json');

  assert.equal(report.valid, false);
  assert.equal(report.issues.some(issue => issue.path === '$.target'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceUploadCommandBoundary'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.objectIndexBindingBoundary'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.remainingExecutionBoundaries'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.readiness.nextAction'), true);
});

test('object/index binding boundary validation rejects nested boundary drift', async () => {
  const commandBoundary = await validCommandBoundary();
  const boundary = buildKnowledgeTeamUploadObjectIndexBindingBoundary({ commandBoundary });
  const requiredBindingFields = [
    'dryRunOnly',
    'bindingRequiredAfterUploadCommandBoundary',
    'uploadCommandBoundaryRequired',
    'uploadCommandRequiredBeforeExecution',
    'uploadCommandDescriptorRequired',
    'uploadCommandPayloadRedactionRequired',
    'uploadCommandMaterialRedactionRequired',
    'commandExecutionApprovalRequired',
    'objectStoreBindingRequired',
    'metadataIndexBindingRequired',
    'objectStoreDescriptorRequired',
    'metadataIndexDescriptorRequired',
    'objectKeyRedactionRequired',
    'metadataIndexEntryRedactionRequired',
    'contentAddressedObjectKeysRequired',
    'contentAddressedIndexKeysRequired',
    'idempotentObjectWriteRequired',
    'idempotentMetadataIndexWriteRequired',
    'objectWriteRequiresExecutionBoundary',
    'metadataIndexWriteRequiresExecutionBoundary',
    'explicitUploadApprovalRequired'
  ];
  const disabledBindingFields = [
    'credentialValuesRead',
    'credentialValuesExposed',
    'credentialPresenceChecked',
    'credentialPresenceResultExposed',
    'clientCreated',
    'sdkClientCreated',
    'adapterInjected',
    'artifactBytesProvided',
    'artifactObjectStoreBound',
    'metadataIndexBound',
    'objectStoreHandleExposed',
    'metadataIndexHandleExposed',
    'liveCheckAllowed',
    'liveCheckPerformed',
    'liveCheckResultExposed',
    'uploadCommandGenerated',
    'uploadCommandMaterialized',
    'uploadCommandExposed',
    'uploadExecutionAllowed',
    'objectWriteAllowed',
    'metadataIndexWriteAllowed',
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
    'objectIndexBindingRequired',
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
    'artifactObjectStoreBound',
    'metadataIndexBound',
    'writeTokenIssued',
    'executionLeaseCreated',
    'rollbackPlanCreated',
    'auditRecordCreated',
    'objectWriteAllowed',
    'metadataIndexWriteAllowed',
    'remoteMutationAllowed'
  ];
  const objectIndexBindingBoundary = { ...boundary.objectIndexBindingBoundary };
  const remainingExecutionBoundaries = { ...boundary.remainingExecutionBoundaries };
  for (const key of requiredBindingFields) {
    objectIndexBindingBoundary[key] = false;
  }
  for (const key of disabledBindingFields) {
    objectIndexBindingBoundary[key] = true;
  }
  for (const key of requiredRemainingFields) {
    remainingExecutionBoundaries[key] = false;
  }
  for (const key of disabledRemainingFields) {
    remainingExecutionBoundaries[key] = true;
  }

  const report = validateKnowledgePayload({
    ...boundary,
    objectIndexBindingBoundary,
    remainingExecutionBoundaries
  }, 'knowledge-pack.upload-object-index-binding-boundary.json');

  assert.equal(report.valid, false);
  for (const key of [...requiredBindingFields, ...disabledBindingFields]) {
    assert.equal(report.issues.some(issue => issue.path === `$.objectIndexBindingBoundary.${key}`), true, key);
  }
  for (const key of [...requiredRemainingFields, ...disabledRemainingFields]) {
    assert.equal(report.issues.some(issue => issue.path === `$.remainingExecutionBoundaries.${key}`), true, key);
  }
});

test('object/index binding boundary blocks primitive private command inputs without copying values', () => {
  const boundary = buildKnowledgeTeamUploadObjectIndexBindingBoundary({
    commandBoundary: 'https://should-not-copy.example.test/private-key'
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('invalid-upload-command-boundary-kind'), true);
  assert.equal(codes.has('backend-detail-leak'), true);
  assertExecutionAndBindingDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('object/index binding boundary blocks malformed command boundary metadata', async () => {
  const commandBoundary = await validCommandBoundary();
  const boundary = buildKnowledgeTeamUploadObjectIndexBindingBoundary({
    commandBoundary: {
      ...commandBoundary,
      kind: 'wrong-kind',
      schemaVersion: 2,
      boundaryKind: 'wrong-boundary',
      status: 'waiting-for-binding',
      target: {
        manifestId: 'unsafe-id',
        objectKey: 'team-artifacts/public-reference/aa/bb/private-key.json',
        objectKeyRedacted: false,
        objectSha256: 'not-a-sha',
        artifactId: 'unsafe-artifact-id'
      },
      sourceLiveCheckBoundary: {
        ...commandBoundary.sourceLiveCheckBoundary,
        adapterName: 'unsafe adapter name',
        adapterBackendKind: 's3-compatible',
        reviewStatus: 'blocked',
        scopeMatched: false
      },
      uploadCommandBoundary: {
        ...commandBoundary.uploadCommandBoundary,
        artifactObjectStoreDependencyRequired: false,
        metadataIndexDependencyRequired: false,
        uploadCommandGenerated: true,
        uploadCommandMaterialized: true,
        uploadCommandExposed: true
      },
      remainingExecutionBoundaries: {
        ...commandBoundary.remainingExecutionBoundaries,
        uploadCommandGenerated: true,
        objectWriteAllowed: true,
        metadataIndexWriteAllowed: true
      },
      readiness: {
        ...commandBoundary.readiness,
        nextAction: 'execute-upload'
      }
    }
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('invalid-upload-command-boundary-kind'), true);
  assert.equal(codes.has('invalid-schema-version'), true);
  assert.equal(codes.has('invalid-boundary-kind'), true);
  assert.equal(codes.has('upload-command-boundary-not-ready'), true);
  assert.equal(codes.has('upload-command-boundary-next-action-invalid'), true);
  assert.equal(codes.has('unsafe-artifact-reference'), true);
  assert.equal(codes.has('unsafe-adapter-name'), true);
  assert.equal(codes.has('unsupported-adapter-backend'), true);
  assert.equal(codes.has('review-fingerprint-unverified'), true);
  assert.equal(codes.has('artifact-object-store-bound'), true);
  assert.equal(codes.has('metadata-index-bound'), true);
  assert.equal(codes.has('upload-command-generated'), true);
  assert.equal(codes.has('upload-command-exposed'), true);
  assert.equal(codes.has('remote-write-enabled'), true);
  assertExecutionAndBindingDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('object/index binding boundary blocks missing sections and top-level execution flags', async () => {
  const commandBoundary = await validCommandBoundary();
  const boundary = buildKnowledgeTeamUploadObjectIndexBindingBoundary({
    commandBoundary: {
      ...commandBoundary,
      target: null,
      sourceLiveCheckBoundary: null,
      uploadCommandBoundary: null,
      remainingExecutionBoundaries: null,
      uploadCommand: { argv: ['aws', 's3', 'cp'] },
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
      remoteMutationPerformed: true,
      liveCheckAllowed: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true
    }
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('unsafe-artifact-reference'), true);
  assert.equal(codes.has('missing-required-field'), true);
  assert.equal(codes.has('upload-command-present'), true);
  assert.equal(codes.has('upload-approval-already-provided'), true);
  assert.equal(codes.has('upload-execution-enabled'), true);
  assert.equal(codes.has('mutation-approval-already-granted'), true);
  assert.equal(codes.has('client-created'), true);
  assert.equal(codes.has('adapter-injected'), true);
  assert.equal(codes.has('artifact-bytes-provided'), true);
  assert.equal(codes.has('write-token-issued'), true);
  assert.equal(codes.has('execution-lease-created'), true);
  assert.equal(codes.has('rollback-plan-created'), true);
  assert.equal(codes.has('audit-record-created'), true);
  assert.equal(codes.has('object-write-attempted'), true);
  assert.equal(codes.has('metadata-index-write-attempted'), true);
  assert.equal(codes.has('remote-mutation-performed'), true);
  assert.equal(codes.has('live-check-enabled'), true);
  assert.equal(codes.has('credential-values-exposed'), true);
  assert.equal(codes.has('credential-presence-check-enabled'), true);
  assert.equal(codes.has('review-fingerprint-unverified'), true);
  assert.equal(codes.has('unsupported-adapter-backend'), true);
  assert.equal(boundary.sourceUploadCommandBoundary.reviewStatus, 'invalid');
  assert.equal(boundary.sourceUploadCommandBoundary.reviewKind, 'unsupported');
  assert.equal(boundary.sourceUploadCommandBoundary.adapterBackendKind, 'unsupported');
  assertExecutionAndBindingDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('object/index binding boundary blocks source command requirement drift', async () => {
  const commandBoundary = await validCommandBoundary();
  const uploadCommandBoundary = { ...commandBoundary.uploadCommandBoundary };
  for (const key of [
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
  ]) {
    uploadCommandBoundary[key] = false;
  }
  for (const key of [
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
  ]) {
    uploadCommandBoundary[key] = true;
  }

  const boundary = buildKnowledgeTeamUploadObjectIndexBindingBoundary({
    commandBoundary: {
      ...commandBoundary,
      sourceLiveCheckBoundary: {
        ...commandBoundary.sourceLiveCheckBoundary,
        reviewStatus: 'waiting',
        reviewKind: 'manual',
        adapterBackendKind: 'filesystem',
        scopeMatched: false,
        humanReviewRecorded: false,
        fingerprintVerified: false,
        sourceFingerprintVerified: false
      },
      uploadCommandBoundary,
      remainingExecutionBoundaries: {
        ...commandBoundary.remainingExecutionBoundaries,
        uploadCommandRequired: false,
        uploadCommandGenerated: true,
        objectWriteAllowed: true,
        metadataIndexWriteAllowed: true,
        remoteMutationAllowed: true
      }
    }
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('missing-required-field'), true);
  assert.equal(codes.has('artifact-object-store-bound'), true);
  assert.equal(codes.has('metadata-index-bound'), true);
  assert.equal(codes.has('credential-values-read'), true);
  assert.equal(codes.has('credential-values-exposed'), true);
  assert.equal(codes.has('credential-presence-check-enabled'), true);
  assert.equal(codes.has('credential-presence-result-exposed'), true);
  assert.equal(codes.has('client-created'), true);
  assert.equal(codes.has('adapter-injected'), true);
  assert.equal(codes.has('live-check-enabled'), true);
  assert.equal(codes.has('live-check-result-exposed'), true);
  assert.equal(codes.has('upload-command-generated'), true);
  assert.equal(codes.has('upload-command-exposed'), true);
  assert.equal(codes.has('upload-execution-enabled'), true);
  assert.equal(codes.has('object-write-attempted'), true);
  assert.equal(codes.has('metadata-index-write-attempted'), true);
  assert.equal(codes.has('remote-mutation-performed'), true);
  assert.equal(codes.has('executable-state-enabled'), true);
  assert.equal(codes.has('upload-command-not-required'), true);
  assert.equal(codes.has('remote-write-enabled'), true);
  assert.equal(codes.has('review-fingerprint-unverified'), true);
  assert.equal(codes.has('unsupported-adapter-backend'), true);
  assert.equal(boundary.sourceUploadCommandBoundary.reviewStatus, 'invalid');
  assert.equal(boundary.sourceUploadCommandBoundary.reviewKind, 'unsupported');
  assert.equal(boundary.sourceUploadCommandBoundary.adapterBackendKind, 'unsupported');
  assertExecutionAndBindingDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('object/index binding boundary reports binding, command, backend, and credential leaks with safe blockers', async () => {
  const commandBoundary = await validCommandBoundary();
  const boundary = buildKnowledgeTeamUploadObjectIndexBindingBoundary({
    commandBoundary: {
      ...commandBoundary,
      endpointUrl: 'https://should-not-copy.example.test',
      objectStoreHandle: {
        bucket: 'should-not-copy-bucket'
      },
      metadataIndexHandle: {
        putEntry: 'metadataIndex.put'
      },
      adapterInstance: {
        endpoint: 'https://should-not-copy.example.test'
      },
      clientConfig: {
        secret: 'client-secret-value'
      },
      credentialValue: 'credential-secret-value',
      uploadCommandPayload: 'aws s3 cp private.json s3://private-bucket/private-key',
      artifactBytesBase64: 'raw-artifact-bytes',
      uploadCommandBoundary: {
        ...commandBoundary.uploadCommandBoundary,
        liveCheckResultPayload: 'private-live-check-output',
        objectWriteAttempted: true,
        metadataIndexWriteAttempted: true
      }
    }
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('backend-detail-leak'), true);
  assert.equal(codes.has('object-store-handle-leak'), true);
  assert.equal(codes.has('metadata-index-handle-leak'), true);
  assert.equal(codes.has('adapter-dependency-leak'), true);
  assert.equal(codes.has('client-dependency-leak'), true);
  assert.equal(codes.has('credential-dependency-leak'), true);
  assert.equal(codes.has('upload-command-present'), true);
  assert.equal(codes.has('artifact-bytes-provided'), true);
  assert.equal(codes.has('live-check-enabled'), true);
  assert.equal(codes.has('object-write-attempted'), true);
  assert.equal(codes.has('metadata-index-write-attempted'), true);
  assertExecutionAndBindingDisabled(boundary);
  assertNoPrivateValues(boundary);
});
