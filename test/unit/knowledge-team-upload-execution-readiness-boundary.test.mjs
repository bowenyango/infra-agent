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
  buildKnowledgeTeamUploadExecutionReadinessBoundary
} from '../../src/knowledge/team-upload-execution-readiness-boundary.ts';
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

function assertExecutionReadinessDisabled(boundary) {
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
  assert.equal(boundary.uploadExecutionReadinessBoundary.uploadApproved, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.uploadExecutionAllowed, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.mutationApprovalGranted, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.artifactBytesProvided, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.adapterInjected, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.clientCreated, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.credentialValuesRead, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.credentialValuesExposed, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.credentialPresenceChecked, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.credentialPresenceResultExposed, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.liveCheckAllowed, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.liveCheckPerformed, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.liveCheckResultExposed, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.uploadCommandGenerated, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.uploadCommandMaterialized, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.uploadCommandExposed, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.artifactObjectStoreBound, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.metadataIndexBound, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.objectStoreHandleExposed, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.metadataIndexHandleExposed, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.objectWriteAllowed, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.metadataIndexWriteAllowed, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.objectWriteAttempted, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.metadataIndexWriteAttempted, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.writeTokenIssued, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.executionLeaseCreated, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.rollbackPlanCreated, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.auditRecordCreated, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.remoteMutationPerformed, false);
  assert.equal(boundary.uploadExecutionReadinessBoundary.executable, false);
  assert.equal(boundary.remainingExecutionBoundaries.uploadExecutionApproved, false);
  assert.equal(boundary.remainingExecutionBoundaries.mutationApprovalGranted, false);
  assert.equal(boundary.remainingExecutionBoundaries.objectWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.metadataIndexWriteAllowed, false);
  assert.equal(boundary.remainingExecutionBoundaries.remoteMutationAllowed, false);
}

function blockerCodes(boundary) {
  return new Set(boundary.readiness.blockerCodes);
}

test('upload execution readiness boundary records final dry-run execution prerequisites', async () => {
  const objectIndexBindingBoundary = await validObjectIndexBindingBoundary();
  const boundary = buildKnowledgeTeamUploadExecutionReadinessBoundary({ objectIndexBindingBoundary });

  assert.equal(boundary.kind, 'infra-agent.knowledge-team-upload-execution-readiness-boundary');
  assert.equal(boundary.schemaVersion, 1);
  assert.equal(boundary.boundaryKind, 'upload-execution-readiness-boundary-dry-run');
  assert.equal(boundary.status, 'upload-execution-readiness-boundary-ready', JSON.stringify(boundary.readiness.blockers));
  assert.equal(boundary.plannedOperation, 'stage-knowledge-pack');
  assertExecutionReadinessDisabled(boundary);
  assert.equal(boundary.target.manifestId, objectIndexBindingBoundary.target.manifestId);
  assert.equal(boundary.target.objectKeyRedacted, true);
  assert.equal(Object.hasOwn(boundary.target, 'objectKey'), false);
  assert.equal(boundary.target.objectSha256, objectIndexBindingBoundary.target.objectSha256);
  assert.equal(boundary.target.artifactId, objectIndexBindingBoundary.target.artifactId);
  assert.equal(boundary.sourceObjectIndexBindingBoundary.source, 'upload-object-index-binding-boundary');
  assert.equal(boundary.sourceObjectIndexBindingBoundary.boundaryStatus, 'object-index-binding-boundary-ready');
  assert.equal(boundary.sourceObjectIndexBindingBoundary.boundaryKind, 'object-index-binding-boundary-dry-run');
  assert.equal(boundary.sourceObjectIndexBindingBoundary.boundaryNextAction, 'design-upload-execution-readiness-boundary');
  assert.equal(boundary.sourceObjectIndexBindingBoundary.reviewStatus, 'review-ready');
  assert.equal(boundary.sourceObjectIndexBindingBoundary.reviewKind, 'human-fingerprint-dry-run');
  assert.equal(boundary.sourceObjectIndexBindingBoundary.scopeMatched, true);
  assert.equal(boundary.sourceObjectIndexBindingBoundary.humanReviewRecorded, true);
  assert.equal(boundary.sourceObjectIndexBindingBoundary.fingerprintVerified, true);
  assert.equal(boundary.sourceObjectIndexBindingBoundary.sourceFingerprintVerified, true);
  assert.equal(boundary.sourceObjectIndexBindingBoundary.adapterName, 'mock-team-cache');
  assert.equal(boundary.sourceObjectIndexBindingBoundary.adapterBackendKind, 'mock-s3-compatible');
  assert.equal(boundary.sourceObjectIndexBindingBoundary.objectStoreBindingRequired, true);
  assert.equal(boundary.sourceObjectIndexBindingBoundary.metadataIndexBindingRequired, true);
  assert.equal(boundary.sourceObjectIndexBindingBoundary.objectWriteRequiresExecutionBoundary, true);
  assert.equal(boundary.sourceObjectIndexBindingBoundary.metadataIndexWriteRequiresExecutionBoundary, true);
  assert.equal(boundary.uploadExecutionReadinessBoundary.dryRunOnly, true);
  assert.equal(boundary.uploadExecutionReadinessBoundary.executionReadinessModeled, true);
  assert.equal(boundary.uploadExecutionReadinessBoundary.objectIndexBindingBoundaryRequired, true);
  assert.equal(boundary.uploadExecutionReadinessBoundary.writeTokenRequired, true);
  assert.equal(boundary.uploadExecutionReadinessBoundary.executionLeaseRequired, true);
  assert.equal(boundary.uploadExecutionReadinessBoundary.rollbackPlanRequired, true);
  assert.equal(boundary.uploadExecutionReadinessBoundary.auditRecordRequired, true);
  assert.equal(boundary.uploadExecutionReadinessBoundary.objectWriteRequiresExecutionApproval, true);
  assert.equal(boundary.uploadExecutionReadinessBoundary.metadataIndexWriteRequiresExecutionApproval, true);
  assert.equal(boundary.uploadExecutionReadinessBoundary.explicitUploadApprovalRequired, true);
  assert.equal(boundary.uploadExecutionReadinessBoundary.separateExecutionApprovalRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.uploadExecutionApprovalRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.uploadExecutionApproved, false);
  assert.equal(boundary.remainingExecutionBoundaries.mutationApprovalRequired, true);
  assert.equal(boundary.remainingExecutionBoundaries.mutationApprovalGranted, false);
  assert.equal(boundary.readiness.status, 'upload-execution-readiness-boundary-ready');
  assert.equal(boundary.readiness.nextAction, 'request-separate-upload-execution-approval');
  assert.equal(boundary.readiness.blockerCount, 0);
  assert.deepEqual(boundary.readiness.blockerCodes, []);
  assert.equal(validateKnowledgePayload(boundary, 'knowledge-pack.upload-execution-readiness-boundary.json').valid, true);
  assertNoPrivateValues(boundary);
});

test('upload execution readiness boundary validation rejects forged execution state', async () => {
  const objectIndexBindingBoundary = await validObjectIndexBindingBoundary();
  const boundary = buildKnowledgeTeamUploadExecutionReadinessBoundary({ objectIndexBindingBoundary });
  const report = validateKnowledgePayload({
    ...boundary,
    uploadCommand: { argv: ['aws', 's3', 'cp'] },
    target: {
      ...boundary.target,
      objectKey: 'team-artifacts/public-reference/aa/bb/private-key.json'
    },
    uploadExecutionReadinessBoundary: {
      ...boundary.uploadExecutionReadinessBoundary,
      uploadApproved: true,
      uploadExecutionAllowed: true,
      mutationApprovalGranted: true,
      artifactBytesProvided: true,
      adapterInjected: true,
      clientCreated: true,
      credentialValuesRead: true,
      credentialValuesExposed: true,
      credentialPresenceChecked: true,
      credentialPresenceResultExposed: true,
      liveCheckAllowed: true,
      liveCheckPerformed: true,
      liveCheckResultExposed: true,
      uploadCommandGenerated: true,
      uploadCommandMaterialized: true,
      uploadCommandExposed: true,
      artifactObjectStoreBound: true,
      metadataIndexBound: true,
      objectStoreHandleExposed: true,
      metadataIndexHandleExposed: true,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true,
      objectWriteAttempted: true,
      metadataIndexWriteAttempted: true,
      writeTokenIssued: true,
      executionLeaseCreated: true,
      rollbackPlanCreated: true,
      auditRecordCreated: true,
      remoteMutationPerformed: true,
      executable: true
    },
    remainingExecutionBoundaries: {
      ...boundary.remainingExecutionBoundaries,
      uploadExecutionApproved: true,
      mutationApprovalGranted: true,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true
    }
  }, 'knowledge-pack.upload-execution-readiness-boundary.json');

  assert.equal(report.valid, false);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadCommand'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.target.objectKey'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionReadinessBoundary.uploadApproved'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionReadinessBoundary.uploadExecutionAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionReadinessBoundary.mutationApprovalGranted'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionReadinessBoundary.objectStoreHandleExposed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionReadinessBoundary.metadataIndexHandleExposed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionReadinessBoundary.objectWriteAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionReadinessBoundary.metadataIndexWriteAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionReadinessBoundary.executable'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.uploadExecutionApproved'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.mutationApprovalGranted'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.objectWriteAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.remainingExecutionBoundaries.metadataIndexWriteAllowed'), true);
});

test('upload execution readiness boundary validation rejects missing ready prerequisites', async () => {
  const objectIndexBindingBoundary = await validObjectIndexBindingBoundary();
  const boundary = buildKnowledgeTeamUploadExecutionReadinessBoundary({ objectIndexBindingBoundary });
  const report = validateKnowledgePayload({
    ...boundary,
    status: 'upload-execution-readiness-boundary-ready',
    sourceObjectIndexBindingBoundary: {
      ...boundary.sourceObjectIndexBindingBoundary,
      boundaryStatus: 'blocked',
      boundaryNextAction: 'resolve-blockers',
      adapterBackendKind: 's3-compatible',
      objectStoreBindingRequired: false,
      metadataIndexBindingRequired: false,
      objectWriteAllowed: true,
      metadataIndexWriteAllowed: true
    },
    uploadExecutionReadinessBoundary: {
      ...boundary.uploadExecutionReadinessBoundary,
      separateExecutionApprovalRequired: false,
      objectWriteRequiresExecutionApproval: false
    },
    readiness: {
      ...boundary.readiness,
      status: 'upload-execution-readiness-boundary-ready',
      nextAction: 'resolve-blockers',
      blockerCount: 1,
      blockerCodes: ['object-index-binding-boundary-not-ready'],
      blockers: [{
        code: 'object-index-binding-boundary-not-ready',
        path: '$.sourceObjectIndexBindingBoundary.boundaryStatus',
        message: 'not ready'
      }]
    }
  }, 'knowledge-pack.upload-execution-readiness-boundary.json');

  assert.equal(report.valid, false);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceObjectIndexBindingBoundary.boundaryStatus'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceObjectIndexBindingBoundary.boundaryNextAction'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceObjectIndexBindingBoundary.adapterBackendKind'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceObjectIndexBindingBoundary.objectStoreBindingRequired'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceObjectIndexBindingBoundary.metadataIndexBindingRequired'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceObjectIndexBindingBoundary.objectWriteAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceObjectIndexBindingBoundary.metadataIndexWriteAllowed'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionReadinessBoundary.separateExecutionApprovalRequired'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionReadinessBoundary.objectWriteRequiresExecutionApproval'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.readiness.nextAction'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.readiness.blockerCount'), true);
});

test('upload execution readiness boundary validation rejects malformed section shapes', async () => {
  const objectIndexBindingBoundary = await validObjectIndexBindingBoundary();
  const boundary = buildKnowledgeTeamUploadExecutionReadinessBoundary({ objectIndexBindingBoundary });
  const report = validateKnowledgePayload({
    ...boundary,
    status: 'blocked',
    target: null,
    sourceObjectIndexBindingBoundary: null,
    uploadExecutionReadinessBoundary: null,
    remainingExecutionBoundaries: null,
    readiness: {
      ...boundary.readiness,
      status: 'blocked',
      nextAction: 'request-separate-upload-execution-approval',
      blockerCount: 1,
      blockerCodes: ['missing-required-field'],
      blockers: [{
        code: 'missing-required-field',
        path: '$.target',
        message: 'target missing'
      }]
    }
  }, 'knowledge-pack.upload-execution-readiness-boundary.json');

  assert.equal(report.valid, false);
  assert.equal(report.issues.some(issue => issue.path === '$.target'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.sourceObjectIndexBindingBoundary'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.uploadExecutionReadinessBoundary'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.remainingExecutionBoundaries'), true);
  assert.equal(report.issues.some(issue => issue.path === '$.readiness.nextAction'), true);
});

test('upload execution readiness boundary blocks non-ready object/index boundaries', async () => {
  const objectIndexBindingBoundary = await validObjectIndexBindingBoundary();
  const boundary = buildKnowledgeTeamUploadExecutionReadinessBoundary({
    objectIndexBindingBoundary: {
      ...objectIndexBindingBoundary,
      status: 'blocked',
      readiness: {
        ...objectIndexBindingBoundary.readiness,
        status: 'blocked',
        nextAction: 'resolve-blockers',
        blockerCount: 1,
        blockerCodes: ['metadata-index-bound'],
        blockers: [{
          code: 'metadata-index-bound',
          path: '$.objectIndexBindingBoundary.metadataIndexBound',
          message: 'metadata index already bound'
        }]
      }
    }
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(boundary.readiness.nextAction, 'resolve-blockers');
  assert.equal(codes.has('object-index-binding-boundary-not-ready'), true);
  assert.equal(codes.has('object-index-binding-boundary-next-action-invalid'), true);
  assert.equal(boundary.sourceObjectIndexBindingBoundary.boundaryStatus, 'blocked');
  assertExecutionReadinessDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload execution readiness boundary blocks primitive private inputs without copying values', () => {
  const boundary = buildKnowledgeTeamUploadExecutionReadinessBoundary({
    objectIndexBindingBoundary: 'https://should-not-copy.example.test/private-key'
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('invalid-object-index-binding-boundary-kind'), true);
  assert.equal(codes.has('backend-detail-leak'), true);
  assertExecutionReadinessDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload execution readiness boundary blocks malformed object/index metadata', async () => {
  const objectIndexBindingBoundary = await validObjectIndexBindingBoundary();
  const boundary = buildKnowledgeTeamUploadExecutionReadinessBoundary({
    objectIndexBindingBoundary: {
      ...objectIndexBindingBoundary,
      kind: 'wrong-kind',
      schemaVersion: 2,
      boundaryKind: 'wrong-boundary',
      status: 'waiting-for-execution',
      target: {
        manifestId: 'unsafe-id',
        objectKey: 'team-artifacts/public-reference/aa/bb/private-key.json',
        objectKeyRedacted: false,
        objectSha256: 'not-a-sha',
        artifactId: 'unsafe-artifact-id'
      },
      sourceUploadCommandBoundary: {
        ...objectIndexBindingBoundary.sourceUploadCommandBoundary,
        adapterName: 'unsafe adapter name',
        adapterBackendKind: 's3-compatible',
        reviewStatus: 'blocked',
        scopeMatched: false
      },
      objectIndexBindingBoundary: {
        ...objectIndexBindingBoundary.objectIndexBindingBoundary,
        objectStoreBindingRequired: false,
        metadataIndexBindingRequired: false,
        uploadCommandGenerated: true,
        uploadCommandMaterialized: true,
        uploadCommandExposed: true,
        objectWriteAllowed: true,
        metadataIndexWriteAllowed: true
      },
      remainingExecutionBoundaries: {
        ...objectIndexBindingBoundary.remainingExecutionBoundaries,
        objectIndexBindingRequired: false,
        uploadCommandGenerated: true,
        artifactObjectStoreBound: true,
        metadataIndexBound: true,
        objectWriteAllowed: true,
        metadataIndexWriteAllowed: true
      },
      readiness: {
        ...objectIndexBindingBoundary.readiness,
        nextAction: 'execute-upload'
      }
    }
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('invalid-object-index-binding-boundary-kind'), true);
  assert.equal(codes.has('invalid-schema-version'), true);
  assert.equal(codes.has('invalid-boundary-kind'), true);
  assert.equal(codes.has('object-index-binding-boundary-not-ready'), true);
  assert.equal(codes.has('object-index-binding-boundary-next-action-invalid'), true);
  assert.equal(codes.has('unsafe-artifact-reference'), true);
  assert.equal(codes.has('unsafe-adapter-name'), true);
  assert.equal(codes.has('unsupported-adapter-backend'), true);
  assert.equal(codes.has('review-fingerprint-unverified'), true);
  assert.equal(codes.has('artifact-object-store-bound'), true);
  assert.equal(codes.has('metadata-index-bound'), true);
  assert.equal(codes.has('object-index-binding-not-required'), true);
  assert.equal(codes.has('upload-command-generated'), true);
  assert.equal(codes.has('upload-command-exposed'), true);
  assert.equal(codes.has('remote-write-enabled'), true);
  assertExecutionReadinessDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload execution readiness boundary blocks missing sections and top-level execution flags', async () => {
  const objectIndexBindingBoundary = await validObjectIndexBindingBoundary();
  const boundary = buildKnowledgeTeamUploadExecutionReadinessBoundary({
    objectIndexBindingBoundary: {
      ...objectIndexBindingBoundary,
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
      remoteMutationPerformed: true,
      uploadCommand: {
        redacted: true
      },
      sourceUploadCommandBoundary: null,
      objectIndexBindingBoundary: null,
      remainingExecutionBoundaries: null
    }
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('live-check-enabled'), true);
  assert.equal(codes.has('credential-values-exposed'), true);
  assert.equal(codes.has('credential-presence-check-enabled'), true);
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
  assert.equal(codes.has('upload-command-present'), true);
  assert.equal(codes.has('missing-required-field'), true);
  assertExecutionReadinessDisabled(boundary);
  assertNoPrivateValues(boundary);
});

test('upload execution readiness boundary blocks leaked private execution material', async () => {
  const objectIndexBindingBoundary = await validObjectIndexBindingBoundary();
  const boundary = buildKnowledgeTeamUploadExecutionReadinessBoundary({
    objectIndexBindingBoundary: {
      ...objectIndexBindingBoundary,
      endpointUrl: 'https://should-not-copy.example.test',
      bucketName: 'should-not-copy-bucket',
      tokenMaterial: 'should-not-copy-secret',
      leaseMaterial: 'should-not-copy-secret',
      rollbackCommand: 'aws s3 cp s3://private-bucket/private-key',
      auditMaterial: 'private-key',
      artifactBytesValue: 'raw-artifact-bytes',
      clientConfig: {
        signedUrl: 'https://should-not-copy.example.test/signed'
      },
      credentialPresenceResult: {
        value: 'credential-secret-value'
      },
      liveCheckResult: {
        value: 'private-live-check-output'
      },
      objectStoreHandle: {
        putObject: true
      },
      metadataIndexHandle: {
        putEntry: true
      },
      uploadCommandPayload: 'signed-upload-command'
    }
  });

  const codes = blockerCodes(boundary);
  assert.equal(boundary.status, 'blocked');
  assert.equal(codes.has('backend-detail-leak'), true);
  assert.equal(codes.has('artifact-bytes-provided'), true);
  assert.equal(codes.has('client-dependency-leak'), true);
  assert.equal(codes.has('credential-dependency-leak'), true);
  assert.equal(codes.has('live-check-enabled'), true);
  assert.equal(codes.has('object-store-handle-leak'), true);
  assert.equal(codes.has('metadata-index-handle-leak'), true);
  assert.equal(codes.has('upload-command-present'), true);
  assertExecutionReadinessDisabled(boundary);
  assertNoPrivateValues(boundary);
});
