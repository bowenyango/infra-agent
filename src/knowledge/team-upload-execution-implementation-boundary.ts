import { createHash } from 'node:crypto';
import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadExecutionImplementationBoundaryStatus =
  | 'upload-execution-implementation-boundary-ready'
  | 'blocked';

export type KnowledgeTeamUploadExecutionImplementationBoundaryNextAction =
  | 'design-upload-execution-runtime-boundaries'
  | 'resolve-blockers';

export type KnowledgeTeamUploadExecutionImplementationBoundaryBlockerCode =
  | 'adapter-dependency-leak'
  | 'adapter-injected'
  | 'artifact-bytes-provided'
  | 'artifact-object-store-bound'
  | 'audit-record-created'
  | 'authorization-already-granted'
  | 'authorization-material-leak'
  | 'backend-detail-leak'
  | 'client-created'
  | 'client-dependency-leak'
  | 'credential-dependency-leak'
  | 'credential-presence-check-enabled'
  | 'credential-presence-result-exposed'
  | 'credential-values-exposed'
  | 'credential-values-read'
  | 'executable-state-enabled'
  | 'execution-lease-created'
  | 'implementation-enabled-execution'
  | 'invalid-plan-rules-update-record-kind'
  | 'invalid-schema-version'
  | 'live-check-enabled'
  | 'live-check-result-exposed'
  | 'metadata-index-bound'
  | 'metadata-index-handle-leak'
  | 'metadata-index-write-attempted'
  | 'missing-required-field'
  | 'mutation-approval-already-granted'
  | 'mutation-enabled'
  | 'object-store-handle-leak'
  | 'object-write-attempted'
  | 'plan-rules-update-record-fingerprint-missing'
  | 'plan-rules-update-record-fingerprint-unsupported'
  | 'plan-rules-update-record-next-action-invalid'
  | 'plan-rules-update-record-not-ready'
  | 'remote-mutation-performed'
  | 'remote-write-enabled'
  | 'review-fingerprint-unverified'
  | 'rollback-plan-created'
  | 'scope-not-matched'
  | 'unsafe-adapter-name'
  | 'unsafe-artifact-reference'
  | 'unsupported-adapter-backend'
  | 'upload-approval-already-provided'
  | 'upload-command-exposed'
  | 'upload-command-generated'
  | 'upload-command-present'
  | 'upload-execution-approval-already-provided'
  | 'upload-execution-authorization-already-provided'
  | 'upload-execution-enabled'
  | 'write-token-issued';

export interface KnowledgeTeamUploadExecutionImplementationBoundaryBlocker {
  code: KnowledgeTeamUploadExecutionImplementationBoundaryBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadExecutionImplementationBoundary {
  kind: 'infra-agent.knowledge-team-upload-execution-implementation-boundary';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  boundaryKind: 'upload-execution-implementation-boundary-dry-run';
  status: KnowledgeTeamUploadExecutionImplementationBoundaryStatus;
  plannedOperation: 'stage-knowledge-pack';
  remoteWriteAllowed: false;
  liveCheckAllowed: false;
  credentialValuesExposed: false;
  credentialPresenceChecked: false;
  uploadApproved: false;
  uploadExecutionApproved: false;
  uploadExecutionAllowed: false;
  mutationApprovalGranted: false;
  clientCreated: false;
  adapterInjected: false;
  artifactBytesProvided: false;
  writeTokenIssued: false;
  executionLeaseCreated: false;
  rollbackPlanCreated: false;
  auditRecordCreated: false;
  objectWriteAttempted: false;
  metadataIndexWriteAttempted: false;
  remoteMutationPerformed: false;
  uploadCommand: null;
  target: {
    manifestId: string | null;
    objectKeyRedacted: true;
    objectSha256: string | null;
    artifactId: string | null;
  };
  sourcePlanRulesUpdateRecord: {
    source: 'upload-execution-plan-rules-update-record';
    recordStatus: 'upload-execution-plan-rules-update-record-ready' | 'blocked' | 'invalid';
    recordKind: 'upload-execution-plan-rules-update-record-dry-run' | 'unsupported';
    recordNextAction: 'design-upload-execution-implementation-boundary' | 'resolve-blockers' | 'invalid';
    sourceReviewStatus: 'upload-execution-plan-rules-review-ready' | 'blocked' | 'invalid';
    sourceReviewKind: 'upload-execution-plan-rules-review-dry-run' | 'unsupported';
    sourceReviewNextAction: 'await-explicit-plan-rules-update' | 'resolve-blockers' | 'invalid';
    scopeMatched: boolean;
    humanApprovalRecorded: boolean;
    approvalFingerprintVerified: boolean;
    authorizationBoundaryDesigned: boolean;
    planRulesUpdateReviewRequired: boolean;
    planRulesUpdated: boolean;
    planRulesUpdateRecorded: boolean;
    rulesUpdateReviewed: boolean;
    policyUpdateAuthorized: boolean;
    executionStillDisabled: boolean;
    fingerprintVerified: boolean;
    authorizationGranted: boolean;
    executionAuthorizationGranted: boolean;
    approvalGranted: boolean;
    uploadApproved: boolean;
    uploadExecutionApproved: boolean;
    uploadExecutionAllowed: boolean;
    mutationApprovalGranted: boolean;
    adapterName: string | null;
    adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
    sourceApprovalRecordFingerprint: {
      algorithm: 'sha256' | 'unsupported';
      scope: 'stage-knowledge-pack-upload-execution-approval-record-v1' | 'unsupported';
      value: string | null;
      canonicalFieldCount: number | null;
    };
    sourceAuthorizationBoundaryFingerprint: {
      algorithm: 'sha256' | 'unsupported';
      scope: 'stage-knowledge-pack-upload-execution-authorization-boundary-v1' | 'unsupported';
      value: string | null;
      canonicalFieldCount: number | null;
    };
    sourcePlanRulesReviewFingerprint: {
      algorithm: 'sha256' | 'unsupported';
      scope: 'stage-knowledge-pack-upload-execution-plan-rules-review-v1' | 'unsupported';
      value: string | null;
      canonicalFieldCount: number | null;
    };
    updateRecordFingerprint: {
      algorithm: 'sha256' | 'unsupported';
      scope: 'stage-knowledge-pack-upload-execution-plan-rules-update-record-v1' | 'unsupported';
      value: string | null;
      canonicalFieldCount: number | null;
    };
  };
  implementationBoundary: {
    dryRunOnly: true;
    implementationBoundaryDesigned: boolean;
    sourceUpdateRecordFingerprintVerified: boolean;
    runtimeBoundaryDesignRequired: true;
    commandGenerationStillProhibited: true;
    adapterInjectionStillProhibited: true;
    clientCreationStillProhibited: true;
    credentialAccessStillProhibited: true;
    credentialPresenceCheckStillProhibited: true;
    liveCheckStillProhibited: true;
    objectStoreBindingStillProhibited: true;
    metadataIndexBindingStillProhibited: true;
    objectWriteStillProhibited: true;
    metadataIndexWriteStillProhibited: true;
    remoteMutationStillProhibited: true;
    implementationAllowed: false;
    authorizationGranted: false;
    executionAuthorizationGranted: false;
    uploadApproved: false;
    uploadExecutionApproved: false;
    uploadExecutionAllowed: false;
    mutationApprovalGranted: false;
    executable: false;
    sourceUpdateRecordFingerprint: {
      algorithm: 'sha256' | 'unsupported';
      scope: 'stage-knowledge-pack-upload-execution-plan-rules-update-record-v1' | 'unsupported';
      value: string | null;
      canonicalFieldCount: number | null;
    };
    implementationBoundaryFingerprint: {
      algorithm: 'sha256';
      scope: 'stage-knowledge-pack-upload-execution-implementation-boundary-v1';
      value: string | null;
      canonicalFieldCount: number;
    };
  };
  executionBoundary: {
    dryRunOnly: true;
    executable: false;
    artifactBytesProvided: false;
    adapterInjected: false;
    clientCreated: false;
    credentialValuesRead: false;
    credentialValuesExposed: false;
    credentialPresenceChecked: false;
    credentialPresenceResultExposed: false;
    liveCheckAllowed: false;
    liveCheckPerformed: false;
    liveCheckResultExposed: false;
    uploadCommandGenerated: false;
    uploadCommandMaterialized: false;
    uploadCommandExposed: false;
    artifactObjectStoreBound: false;
    metadataIndexBound: false;
    objectStoreHandleExposed: false;
    metadataIndexHandleExposed: false;
    objectWriteAllowed: false;
    metadataIndexWriteAllowed: false;
    objectWriteAttempted: false;
    metadataIndexWriteAttempted: false;
    writeTokenIssued: false;
    executionLeaseCreated: false;
    rollbackPlanCreated: false;
    auditRecordCreated: false;
    remoteMutationPerformed: false;
  };
  readiness: {
    status: KnowledgeTeamUploadExecutionImplementationBoundaryStatus;
    nextAction: KnowledgeTeamUploadExecutionImplementationBoundaryNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadExecutionImplementationBoundaryBlockerCode[];
    blockers: KnowledgeTeamUploadExecutionImplementationBoundaryBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadExecutionImplementationBoundaryInput {
  planRulesUpdateRecord: unknown;
}

interface ParsedUpdateRecordForImplementationBoundary {
  recordStatus: KnowledgeTeamUploadExecutionImplementationBoundary['sourcePlanRulesUpdateRecord']['recordStatus'];
  recordKind: KnowledgeTeamUploadExecutionImplementationBoundary['sourcePlanRulesUpdateRecord']['recordKind'];
  recordNextAction: KnowledgeTeamUploadExecutionImplementationBoundary['sourcePlanRulesUpdateRecord']['recordNextAction'];
  target: KnowledgeTeamUploadExecutionImplementationBoundary['target'];
  sourcePlanRulesUpdateRecord: KnowledgeTeamUploadExecutionImplementationBoundary['sourcePlanRulesUpdateRecord'];
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const SAFE_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const APPROVAL_RECORD_FINGERPRINT_FIELD_COUNT = 14;
const AUTHORIZATION_BOUNDARY_FINGERPRINT_FIELD_COUNT = 16;
const PLAN_RULES_REVIEW_FINGERPRINT_FIELD_COUNT = 20;
const PLAN_RULES_UPDATE_RECORD_FINGERPRINT_FIELD_COUNT = 18;
const IMPLEMENTATION_BOUNDARY_FINGERPRINT_FIELD_COUNT = 18;
const FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN = /(artifactBytesValue|artifactBytesBase64|artifactBytesContent|artifactBytesPayload|artifactContent|artifactPayload|rawArtifact|byteBuffer|bytesBase64|contentBase64|buffer|stream|arrayBuffer|blob|readPath|filePath|localPath|artifactPath|serializedPayload|stagedBytes)/i;
const FORBIDDEN_CLIENT_KEY_PATTERN = /(clientInstance|clientObject|clientValue|clientFactoryValue|clientDescriptorValue|clientConfig|adapterClient|^sdkClient$|sdkClientConfig|signedUrl)/i;
const FORBIDDEN_CREDENTIAL_KEY_PATTERN = /(^credentialValue$|credentialValuePayload|credentialValueMaterial|credentialMaterial|credentialFile|credentialPath|credentialsPath|secretValue|envValue|processEnv|presenceCheckResult|^credentialPresenceResult$|credentialPresenceResult(?:Value|Payload|Material|Data|Body|Response)|credentialPresenceSignalValue)/i;
const FORBIDDEN_LIVE_CHECK_KEY_PATTERN = /(^liveCheckResult$|liveCheckResult(?:Value|Payload|Material|Data|Body)|liveCheckResponse|liveCheckProbe|liveCheckRequest|liveBackendProbe|headObjectResult|headIndexResult|remoteProbeResult|connectivityResult|healthCheckResult)/i;
const FORBIDDEN_COMMAND_KEY_PATTERN = /(^uploadCommandValue$|^uploadCommandPayload$|^uploadCommandMaterial$|^uploadCommandData$|^uploadCommandBody$|^uploadCommandLine$|^commandLine$|^shellCommand$|^signedUploadCommand$|^uploadExecutionCommand$)/i;
const FORBIDDEN_AUTHORIZATION_KEY_PATTERN = /(^authorizationValue$|authorizationMaterial|authorizationToken|authorizationHeader|executionAuthorizationValue|executionAuthorizationMaterial|executionGrant|signedAuthorization|uploadExecutionAuthorizationMaterial|uploadExecutionGrant)/i;
const FORBIDDEN_ADAPTER_KEY_PATTERN = /(adapterInstance|adapterObject|adapterValue|adapterDescriptorValue)/i;
const FORBIDDEN_OBJECT_STORE_HANDLE_KEY_PATTERN = /(^objectStoreBinding$|objectStoreBinding(?:Handle|Instance|Client|Value|Payload|Material)|^objectStoreHandle$|objectStoreHandle(?:Value|Payload|Material|Instance|Client)|objectStoreInstance|objectStoreClient|artifactObjectStoreHandle|putObject|writeObject)/i;
const FORBIDDEN_METADATA_INDEX_HANDLE_KEY_PATTERN = /(^metadataIndexBinding$|metadataIndexBinding(?:Handle|Instance|Client|Value|Payload|Material)|^metadataIndexHandle$|metadataIndexHandle(?:Value|Payload|Material|Instance|Client)|metadataIndexInstance|metadataIndexClient|putEntry|writeIndex|indexEntryPayload|indexEntryValue)/i;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|secret|password|header|accessKey|sessionToken|tokenValue|tokenMaterial|leaseValue|leaseMaterial|rollbackValue|rollbackMaterial|rollbackCommand|auditValue|auditMaterial|auditCommand|implementationSecret|runtimeSecret)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|kubectl |curl |secret|password|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;

const TOP_LEVEL_FALSE_FIELDS = [
  'remoteWriteAllowed',
  'liveCheckAllowed',
  'credentialValuesExposed',
  'credentialPresenceChecked',
  'uploadApproved',
  'uploadExecutionApproved',
  'uploadExecutionAllowed',
  'mutationApprovalGranted',
  'clientCreated',
  'adapterInjected',
  'artifactBytesProvided',
  'writeTokenIssued',
  'executionLeaseCreated',
  'rollbackPlanCreated',
  'auditRecordCreated',
  'objectWriteAttempted',
  'metadataIndexWriteAttempted',
  'remoteMutationPerformed'
] as const;

const EXECUTION_BOUNDARY_FALSE_FIELDS = [
  'executable',
  'artifactBytesProvided',
  'adapterInjected',
  'clientCreated',
  'credentialValuesRead',
  'credentialValuesExposed',
  'credentialPresenceChecked',
  'credentialPresenceResultExposed',
  'liveCheckAllowed',
  'liveCheckPerformed',
  'liveCheckResultExposed',
  'uploadCommandGenerated',
  'uploadCommandMaterialized',
  'uploadCommandExposed',
  'artifactObjectStoreBound',
  'metadataIndexBound',
  'objectStoreHandleExposed',
  'metadataIndexHandleExposed',
  'objectWriteAllowed',
  'metadataIndexWriteAllowed',
  'objectWriteAttempted',
  'metadataIndexWriteAttempted',
  'writeTokenIssued',
  'executionLeaseCreated',
  'rollbackPlanCreated',
  'auditRecordCreated',
  'remoteMutationPerformed'
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBool(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false;
}

function addBlocker(
  blockers: KnowledgeTeamUploadExecutionImplementationBoundaryBlocker[],
  code: KnowledgeTeamUploadExecutionImplementationBoundaryBlockerCode,
  path: string,
  message: string
): void {
  if (!blockers.some((blocker) => blocker.code === code && blocker.path === path)) {
    blockers.push({ code, path, message });
  }
}

function inspectForForbiddenImplementationMaterial(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadExecutionImplementationBoundaryBlocker[]
): void {
  if (typeof value === 'string') {
    if (FORBIDDEN_LEAK_VALUE_PATTERN.test(value)) {
      addBlocker(blockers, 'backend-detail-leak', path, 'Input must not include backend details, commands, secrets, private paths, or signed material.');
    }
    return;
  }
  if (!isRecord(value) && !Array.isArray(value)) {
    return;
  }
  const entries = Array.isArray(value)
    ? value.map((entry, index) => [String(index), entry] as const)
    : Object.entries(value);
  for (const [key, entry] of entries) {
    const entryPath = Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`;
    if (FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'artifact-bytes-provided', entryPath, 'Input must not include raw artifact bytes or local artifact byte paths.');
    }
    if (FORBIDDEN_CLIENT_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'client-dependency-leak', entryPath, 'Input must not include SDK clients, client configs, or signed URLs.');
    }
    if (FORBIDDEN_CREDENTIAL_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'credential-dependency-leak', entryPath, 'Input must not include credential values, files, or presence-check results.');
    }
    if (FORBIDDEN_LIVE_CHECK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'live-check-result-exposed', entryPath, 'Input must not include live-check probes or results.');
    }
    if (FORBIDDEN_COMMAND_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'upload-command-exposed', entryPath, 'Input must not include upload command material.');
    }
    if (FORBIDDEN_AUTHORIZATION_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'authorization-material-leak', entryPath, 'Input must not include authorization material or execution grants.');
    }
    if (FORBIDDEN_ADAPTER_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'adapter-dependency-leak', entryPath, 'Input must not include concrete adapter instances.');
    }
    if (FORBIDDEN_OBJECT_STORE_HANDLE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'object-store-handle-leak', entryPath, 'Input must not include object-store handles or write functions.');
    }
    if (FORBIDDEN_METADATA_INDEX_HANDLE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'metadata-index-handle-leak', entryPath, 'Input must not include metadata-index handles or write functions.');
    }
    if (FORBIDDEN_LEAK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'backend-detail-leak', entryPath, 'Input must not include backend details, secrets, token/lease/rollback/audit material, or implementation secrets.');
    }
    inspectForForbiddenImplementationMaterial(entry, entryPath, blockers);
  }
}

function emptyTarget(): KnowledgeTeamUploadExecutionImplementationBoundary['target'] {
  return {
    manifestId: null,
    objectKeyRedacted: true,
    objectSha256: null,
    artifactId: null
  };
}

function emptyFingerprint(
  scope: KnowledgeTeamUploadExecutionImplementationBoundary['sourcePlanRulesUpdateRecord']['sourceApprovalRecordFingerprint']['scope'],
  canonicalFieldCount: number
): {
  algorithm: 'sha256' | 'unsupported';
  scope: typeof scope;
  value: string | null;
  canonicalFieldCount: number | null;
} {
  return {
    algorithm: 'unsupported',
    scope,
    value: null,
    canonicalFieldCount
  };
}

function emptySourceUpdateRecord(): KnowledgeTeamUploadExecutionImplementationBoundary['sourcePlanRulesUpdateRecord'] {
  return {
    source: 'upload-execution-plan-rules-update-record',
    recordStatus: 'invalid',
    recordKind: 'unsupported',
    recordNextAction: 'invalid',
    sourceReviewStatus: 'invalid',
    sourceReviewKind: 'unsupported',
    sourceReviewNextAction: 'invalid',
    scopeMatched: false,
    humanApprovalRecorded: false,
    approvalFingerprintVerified: false,
    authorizationBoundaryDesigned: false,
    planRulesUpdateReviewRequired: false,
    planRulesUpdated: false,
    planRulesUpdateRecorded: false,
    rulesUpdateReviewed: false,
    policyUpdateAuthorized: false,
    executionStillDisabled: false,
    fingerprintVerified: false,
    authorizationGranted: false,
    executionAuthorizationGranted: false,
    approvalGranted: false,
    uploadApproved: false,
    uploadExecutionApproved: false,
    uploadExecutionAllowed: false,
    mutationApprovalGranted: false,
    adapterName: null,
    adapterBackendKind: 'unsupported',
    sourceApprovalRecordFingerprint: emptyFingerprint('stage-knowledge-pack-upload-execution-approval-record-v1', APPROVAL_RECORD_FINGERPRINT_FIELD_COUNT),
    sourceAuthorizationBoundaryFingerprint: emptyFingerprint('stage-knowledge-pack-upload-execution-authorization-boundary-v1', AUTHORIZATION_BOUNDARY_FINGERPRINT_FIELD_COUNT),
    sourcePlanRulesReviewFingerprint: emptyFingerprint('stage-knowledge-pack-upload-execution-plan-rules-review-v1', PLAN_RULES_REVIEW_FINGERPRINT_FIELD_COUNT),
    updateRecordFingerprint: emptyFingerprint('stage-knowledge-pack-upload-execution-plan-rules-update-record-v1', PLAN_RULES_UPDATE_RECORD_FINGERPRINT_FIELD_COUNT)
  };
}

function readSafeTarget(
  record: Record<string, unknown>,
  blockers: KnowledgeTeamUploadExecutionImplementationBoundaryBlocker[]
): KnowledgeTeamUploadExecutionImplementationBoundary['target'] {
  if (!isRecord(record.target)) {
    addBlocker(blockers, 'missing-required-field', '$.planRulesUpdateRecord.target', 'Plan/Rules update record target must be an object.');
    return emptyTarget();
  }
  const target = record.target;
  const manifestId = typeof target.manifestId === 'string' && SAFE_ID_PATTERN.test(target.manifestId)
    ? target.manifestId
    : null;
  const artifactId = typeof target.artifactId === 'string' && SAFE_ID_PATTERN.test(target.artifactId)
    ? target.artifactId
    : null;
  const objectSha256 = typeof target.objectSha256 === 'string' && isKnowledgeTeamArtifactSha256(target.objectSha256)
    ? target.objectSha256
    : null;

  if (manifestId === null) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.planRulesUpdateRecord.target.manifestId', 'Target manifest id must be a safe 24-character lowercase hex id.');
  }
  if (artifactId === null) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.planRulesUpdateRecord.target.artifactId', 'Target artifact id must be a safe 24-character lowercase hex id.');
  }
  if (objectSha256 === null) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.planRulesUpdateRecord.target.objectSha256', 'Target object hash must be a safe SHA-256 hex digest.');
  }
  if (target.objectKeyRedacted !== true) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.planRulesUpdateRecord.target.objectKeyRedacted', 'Target object key must remain redacted.');
  }
  if (Object.hasOwn(target, 'objectKey')) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.planRulesUpdateRecord.target.objectKey', 'Target object key must not be copied into implementation boundary output.');
  }

  return {
    manifestId,
    objectKeyRedacted: true,
    objectSha256,
    artifactId
  };
}

function readFingerprint(
  value: unknown,
  path: string,
  expectedScope: string,
  expectedCanonicalFieldCount: number,
  missingCode: KnowledgeTeamUploadExecutionImplementationBoundaryBlockerCode,
  unsupportedCode: KnowledgeTeamUploadExecutionImplementationBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadExecutionImplementationBoundaryBlocker[]
): {
  algorithm: 'sha256' | 'unsupported';
  scope: 'stage-knowledge-pack-upload-execution-approval-record-v1' | 'stage-knowledge-pack-upload-execution-authorization-boundary-v1' | 'stage-knowledge-pack-upload-execution-plan-rules-review-v1' | 'stage-knowledge-pack-upload-execution-plan-rules-update-record-v1' | 'unsupported';
  value: string | null;
  canonicalFieldCount: number | null;
} {
  if (!isRecord(value)) {
    addBlocker(blockers, missingCode, path, 'Required source fingerprint object is missing.');
    return {
      algorithm: 'unsupported',
      scope: expectedScope as 'stage-knowledge-pack-upload-execution-approval-record-v1',
      value: null,
      canonicalFieldCount: expectedCanonicalFieldCount
    };
  }
  const algorithm = value.algorithm === 'sha256' ? 'sha256' : 'unsupported';
  const scope = value.scope === expectedScope
    ? expectedScope as 'stage-knowledge-pack-upload-execution-approval-record-v1'
    : 'unsupported';
  const canonicalFieldCount = value.canonicalFieldCount === expectedCanonicalFieldCount
    ? expectedCanonicalFieldCount
    : null;
  const fingerprintValue = typeof value.value === 'string' && SAFE_FINGERPRINT_PATTERN.test(value.value)
    ? value.value
    : null;

  if (algorithm !== 'sha256' || scope === 'unsupported' || canonicalFieldCount === null) {
    addBlocker(blockers, unsupportedCode, path, 'Source fingerprint metadata must use the expected sha256 scope and canonical field count.');
  }
  if (fingerprintValue === null) {
    addBlocker(blockers, missingCode, `${path}.value`, 'Source fingerprint value must be a safe SHA-256 hex string.');
  }

  return {
    algorithm,
    scope,
    value: fingerprintValue,
    canonicalFieldCount
  };
}

function readRecordStatus(value: unknown): KnowledgeTeamUploadExecutionImplementationBoundary['sourcePlanRulesUpdateRecord']['recordStatus'] {
  return value === 'upload-execution-plan-rules-update-record-ready' || value === 'blocked' ? value : 'invalid';
}

function readRecordKind(value: unknown): KnowledgeTeamUploadExecutionImplementationBoundary['sourcePlanRulesUpdateRecord']['recordKind'] {
  return value === 'upload-execution-plan-rules-update-record-dry-run' ? value : 'unsupported';
}

function readRecordNextAction(value: unknown): KnowledgeTeamUploadExecutionImplementationBoundary['sourcePlanRulesUpdateRecord']['recordNextAction'] {
  return value === 'design-upload-execution-implementation-boundary' || value === 'resolve-blockers' ? value : 'invalid';
}

function readReviewStatus(value: unknown): KnowledgeTeamUploadExecutionImplementationBoundary['sourcePlanRulesUpdateRecord']['sourceReviewStatus'] {
  return value === 'upload-execution-plan-rules-review-ready' || value === 'blocked' ? value : 'invalid';
}

function readReviewKind(value: unknown): KnowledgeTeamUploadExecutionImplementationBoundary['sourcePlanRulesUpdateRecord']['sourceReviewKind'] {
  return value === 'upload-execution-plan-rules-review-dry-run' ? value : 'unsupported';
}

function readReviewNextAction(value: unknown): KnowledgeTeamUploadExecutionImplementationBoundary['sourcePlanRulesUpdateRecord']['sourceReviewNextAction'] {
  return value === 'await-explicit-plan-rules-update' || value === 'resolve-blockers' ? value : 'invalid';
}

function readAdapterBackendKind(value: unknown): KnowledgeTeamUploadExecutionImplementationBoundary['sourcePlanRulesUpdateRecord']['adapterBackendKind'] {
  return value === 'mock-s3-compatible' || value === 's3-compatible' ? value : 'unsupported';
}

function validateNonExecutionPosture(
  record: Record<string, unknown>,
  blockers: KnowledgeTeamUploadExecutionImplementationBoundaryBlocker[]
): void {
  for (const field of TOP_LEVEL_FALSE_FIELDS) {
    if (record[field] !== false) {
      addBlocker(blockers, blockerCodeForFalseField(field), `$.planRulesUpdateRecord.${field}`, `${field} must remain false before implementation boundary design.`);
    }
  }
  if (record.uploadCommand !== null) {
    addBlocker(blockers, 'upload-command-present', '$.planRulesUpdateRecord.uploadCommand', 'Plan/Rules update record must not include upload commands.');
  }
  if (!isRecord(record.executionBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.planRulesUpdateRecord.executionBoundary', 'Plan/Rules update record executionBoundary must be an object.');
    return;
  }
  if (record.executionBoundary.dryRunOnly !== true) {
    addBlocker(blockers, 'executable-state-enabled', '$.planRulesUpdateRecord.executionBoundary.dryRunOnly', 'Execution boundary must remain dry-run only.');
  }
  for (const field of EXECUTION_BOUNDARY_FALSE_FIELDS) {
    if (record.executionBoundary[field] !== false) {
      addBlocker(blockers, blockerCodeForFalseField(field), `$.planRulesUpdateRecord.executionBoundary.${field}`, `${field} must remain false before implementation boundary design.`);
    }
  }
}

function blockerCodeForFalseField(field: string): KnowledgeTeamUploadExecutionImplementationBoundaryBlockerCode {
  switch (field) {
    case 'remoteWriteAllowed':
      return 'remote-write-enabled';
    case 'liveCheckAllowed':
    case 'liveCheckPerformed':
      return 'live-check-enabled';
    case 'liveCheckResultExposed':
      return 'live-check-result-exposed';
    case 'credentialValuesRead':
      return 'credential-values-read';
    case 'credentialValuesExposed':
      return 'credential-values-exposed';
    case 'credentialPresenceChecked':
      return 'credential-presence-check-enabled';
    case 'credentialPresenceResultExposed':
      return 'credential-presence-result-exposed';
    case 'uploadApproved':
      return 'upload-approval-already-provided';
    case 'uploadExecutionApproved':
      return 'upload-execution-approval-already-provided';
    case 'uploadExecutionAllowed':
      return 'upload-execution-enabled';
    case 'mutationApprovalGranted':
      return 'mutation-approval-already-granted';
    case 'clientCreated':
      return 'client-created';
    case 'adapterInjected':
      return 'adapter-injected';
    case 'artifactBytesProvided':
      return 'artifact-bytes-provided';
    case 'writeTokenIssued':
      return 'write-token-issued';
    case 'executionLeaseCreated':
      return 'execution-lease-created';
    case 'rollbackPlanCreated':
      return 'rollback-plan-created';
    case 'auditRecordCreated':
      return 'audit-record-created';
    case 'objectWriteAttempted':
      return 'object-write-attempted';
    case 'metadataIndexWriteAttempted':
      return 'metadata-index-write-attempted';
    case 'remoteMutationPerformed':
      return 'remote-mutation-performed';
    case 'executable':
      return 'executable-state-enabled';
    case 'uploadCommandGenerated':
    case 'uploadCommandMaterialized':
      return 'upload-command-generated';
    case 'uploadCommandExposed':
      return 'upload-command-exposed';
    case 'artifactObjectStoreBound':
      return 'artifact-object-store-bound';
    case 'metadataIndexBound':
      return 'metadata-index-bound';
    case 'objectStoreHandleExposed':
      return 'object-store-handle-leak';
    case 'metadataIndexHandleExposed':
      return 'metadata-index-handle-leak';
    case 'objectWriteAllowed':
      return 'object-write-attempted';
    case 'metadataIndexWriteAllowed':
      return 'metadata-index-write-attempted';
    default:
      return 'implementation-enabled-execution';
  }
}

function parseUpdateRecordForImplementationBoundary(
  input: unknown,
  blockers: KnowledgeTeamUploadExecutionImplementationBoundaryBlocker[]
): ParsedUpdateRecordForImplementationBoundary {
  inspectForForbiddenImplementationMaterial(input, '$.planRulesUpdateRecord', blockers);
  if (!isRecord(input)) {
    addBlocker(blockers, 'missing-required-field', '$.planRulesUpdateRecord', 'Plan/Rules update record input must be an object.');
    return {
      recordStatus: 'invalid',
      recordKind: 'unsupported',
      recordNextAction: 'invalid',
      target: emptyTarget(),
      sourcePlanRulesUpdateRecord: emptySourceUpdateRecord()
    };
  }

  if (input.kind !== 'infra-agent.knowledge-team-upload-execution-plan-rules-update-record') {
    addBlocker(blockers, 'invalid-plan-rules-update-record-kind', '$.planRulesUpdateRecord.kind', 'Input must be a Plan/Rules update record artifact.');
  }
  if (input.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.planRulesUpdateRecord.schemaVersion', 'Plan/Rules update record schemaVersion must be 1.');
  }
  if (input.mutationAllowed !== false || input.executionMode !== 'dry-run') {
    addBlocker(blockers, 'mutation-enabled', '$.planRulesUpdateRecord.mutationAllowed', 'Plan/Rules update record must remain dry-run and non-mutating.');
  }

  validateNonExecutionPosture(input, blockers);

  const recordStatus = readRecordStatus(input.status);
  const recordKind = readRecordKind(input.recordKind);
  const recordNextAction = isRecord(input.readiness) ? readRecordNextAction(input.readiness.nextAction) : 'invalid';
  if (recordKind !== 'upload-execution-plan-rules-update-record-dry-run') {
    addBlocker(blockers, 'invalid-plan-rules-update-record-kind', '$.planRulesUpdateRecord.recordKind', 'Plan/Rules update record kind is unsupported.');
  }
  if (recordStatus !== 'upload-execution-plan-rules-update-record-ready') {
    addBlocker(blockers, 'plan-rules-update-record-not-ready', '$.planRulesUpdateRecord.status', 'Plan/Rules update record must be ready.');
  }
  if (recordNextAction !== 'design-upload-execution-implementation-boundary') {
    addBlocker(blockers, 'plan-rules-update-record-next-action-invalid', '$.planRulesUpdateRecord.readiness.nextAction', 'Plan/Rules update record must point at implementation boundary design.');
  }

  const target = readSafeTarget(input, blockers);
  const sourcePlanRulesReview = isRecord(input.sourcePlanRulesReview) ? input.sourcePlanRulesReview : {};
  const planRulesUpdateRecord = isRecord(input.planRulesUpdateRecord) ? input.planRulesUpdateRecord : {};
  if (!isRecord(input.sourcePlanRulesReview)) {
    addBlocker(blockers, 'missing-required-field', '$.planRulesUpdateRecord.sourcePlanRulesReview', 'Source Plan/Rules review summary must be present.');
  }
  if (!isRecord(input.planRulesUpdateRecord)) {
    addBlocker(blockers, 'missing-required-field', '$.planRulesUpdateRecord.planRulesUpdateRecord', 'Plan/Rules update record summary must be present.');
  }

  const adapterName = typeof sourcePlanRulesReview.adapterName === 'string' && isSafeKnowledgeTeamBackendAdapterName(sourcePlanRulesReview.adapterName)
    ? sourcePlanRulesReview.adapterName
    : null;
  if (adapterName === null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.planRulesUpdateRecord.sourcePlanRulesReview.adapterName', 'Source adapter name must be present and safe.');
  }
  const adapterBackendKind = readAdapterBackendKind(sourcePlanRulesReview.adapterBackendKind);
  if (adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.planRulesUpdateRecord.sourcePlanRulesReview.adapterBackendKind', 'Implementation boundary currently supports only mock-s3-compatible dry-run sources.');
  }

  const sourceApprovalRecordFingerprint = readFingerprint(
    sourcePlanRulesReview.sourceApprovalRecordFingerprint,
    '$.planRulesUpdateRecord.sourcePlanRulesReview.sourceApprovalRecordFingerprint',
    'stage-knowledge-pack-upload-execution-approval-record-v1',
    APPROVAL_RECORD_FINGERPRINT_FIELD_COUNT,
    'plan-rules-update-record-fingerprint-missing',
    'plan-rules-update-record-fingerprint-unsupported',
    blockers
  );
  const sourceAuthorizationBoundaryFingerprint = readFingerprint(
    sourcePlanRulesReview.sourceAuthorizationBoundaryFingerprint,
    '$.planRulesUpdateRecord.sourcePlanRulesReview.sourceAuthorizationBoundaryFingerprint',
    'stage-knowledge-pack-upload-execution-authorization-boundary-v1',
    AUTHORIZATION_BOUNDARY_FINGERPRINT_FIELD_COUNT,
    'plan-rules-update-record-fingerprint-missing',
    'plan-rules-update-record-fingerprint-unsupported',
    blockers
  );
  const sourcePlanRulesReviewFingerprint = readFingerprint(
    sourcePlanRulesReview.reviewFingerprint,
    '$.planRulesUpdateRecord.sourcePlanRulesReview.reviewFingerprint',
    'stage-knowledge-pack-upload-execution-plan-rules-review-v1',
    PLAN_RULES_REVIEW_FINGERPRINT_FIELD_COUNT,
    'plan-rules-update-record-fingerprint-missing',
    'plan-rules-update-record-fingerprint-unsupported',
    blockers
  );
  const updateRecordFingerprint = readFingerprint(
    planRulesUpdateRecord.recordFingerprint,
    '$.planRulesUpdateRecord.planRulesUpdateRecord.recordFingerprint',
    'stage-knowledge-pack-upload-execution-plan-rules-update-record-v1',
    PLAN_RULES_UPDATE_RECORD_FINGERPRINT_FIELD_COUNT,
    'plan-rules-update-record-fingerprint-missing',
    'plan-rules-update-record-fingerprint-unsupported',
    blockers
  );

  const source: KnowledgeTeamUploadExecutionImplementationBoundary['sourcePlanRulesUpdateRecord'] = {
    source: 'upload-execution-plan-rules-update-record',
    recordStatus,
    recordKind,
    recordNextAction,
    sourceReviewStatus: readReviewStatus(sourcePlanRulesReview.reviewStatus),
    sourceReviewKind: readReviewKind(sourcePlanRulesReview.reviewKind),
    sourceReviewNextAction: readReviewNextAction(sourcePlanRulesReview.reviewNextAction),
    scopeMatched: readBool(sourcePlanRulesReview.scopeMatched),
    humanApprovalRecorded: readBool(sourcePlanRulesReview.humanApprovalRecorded),
    approvalFingerprintVerified: readBool(sourcePlanRulesReview.approvalFingerprintVerified),
    authorizationBoundaryDesigned: readBool(sourcePlanRulesReview.authorizationBoundaryDesigned),
    planRulesUpdateReviewRequired: readBool(sourcePlanRulesReview.planRulesUpdateReviewRequired),
    planRulesUpdated: readBool(sourcePlanRulesReview.planRulesUpdated),
    planRulesUpdateRecorded: readBool(planRulesUpdateRecord.planRulesUpdateRecorded),
    rulesUpdateReviewed: readBool(planRulesUpdateRecord.rulesUpdateReviewed),
    policyUpdateAuthorized: readBool(planRulesUpdateRecord.policyUpdateAuthorized),
    executionStillDisabled: readBool(planRulesUpdateRecord.executionStillDisabled),
    fingerprintVerified: readBool(planRulesUpdateRecord.fingerprintVerified),
    authorizationGranted: readBool(planRulesUpdateRecord.authorizationGranted),
    executionAuthorizationGranted: readBool(planRulesUpdateRecord.executionAuthorizationGranted),
    approvalGranted: readBool(sourcePlanRulesReview.approvalGranted),
    uploadApproved: readBool(planRulesUpdateRecord.uploadApproved),
    uploadExecutionApproved: readBool(planRulesUpdateRecord.uploadExecutionApproved),
    uploadExecutionAllowed: readBool(planRulesUpdateRecord.uploadExecutionAllowed),
    mutationApprovalGranted: readBool(planRulesUpdateRecord.mutationApprovalGranted),
    adapterName,
    adapterBackendKind,
    sourceApprovalRecordFingerprint,
    sourceAuthorizationBoundaryFingerprint,
    sourcePlanRulesReviewFingerprint,
    updateRecordFingerprint
  };

  if (source.sourceReviewStatus !== 'upload-execution-plan-rules-review-ready'
    || source.sourceReviewKind !== 'upload-execution-plan-rules-review-dry-run'
    || source.sourceReviewNextAction !== 'await-explicit-plan-rules-update') {
    addBlocker(blockers, 'plan-rules-update-record-not-ready', '$.planRulesUpdateRecord.sourcePlanRulesReview', 'Source Plan/Rules review summary must remain ready.');
  }
  for (const [field, expected] of [
    ['scopeMatched', true],
    ['humanApprovalRecorded', true],
    ['approvalFingerprintVerified', true],
    ['authorizationBoundaryDesigned', true],
    ['planRulesUpdateReviewRequired', true],
    ['planRulesUpdated', false],
    ['planRulesUpdateRecorded', true],
    ['rulesUpdateReviewed', true],
    ['policyUpdateAuthorized', false],
    ['executionStillDisabled', true],
    ['fingerprintVerified', true],
    ['authorizationGranted', false],
    ['executionAuthorizationGranted', false],
    ['approvalGranted', false],
    ['uploadApproved', false],
    ['uploadExecutionApproved', false],
    ['uploadExecutionAllowed', false],
    ['mutationApprovalGranted', false]
  ] as const) {
    if (source[field] !== expected) {
      addBlocker(blockers, blockerCodeForSourceField(field), `$.planRulesUpdateRecord.${field}`, `${field} must remain ${expected} before implementation boundary design.`);
    }
  }

  return {
    recordStatus,
    recordKind,
    recordNextAction,
    target,
    sourcePlanRulesUpdateRecord: source
  };
}

function blockerCodeForSourceField(field: string): KnowledgeTeamUploadExecutionImplementationBoundaryBlockerCode {
  switch (field) {
    case 'scopeMatched':
      return 'scope-not-matched';
    case 'fingerprintVerified':
      return 'review-fingerprint-unverified';
    case 'authorizationGranted':
    case 'approvalGranted':
      return 'authorization-already-granted';
    case 'executionAuthorizationGranted':
      return 'upload-execution-authorization-already-provided';
    case 'uploadApproved':
      return 'upload-approval-already-provided';
    case 'uploadExecutionApproved':
      return 'upload-execution-approval-already-provided';
    case 'uploadExecutionAllowed':
      return 'upload-execution-enabled';
    case 'mutationApprovalGranted':
      return 'mutation-approval-already-granted';
    case 'policyUpdateAuthorized':
      return 'implementation-enabled-execution';
    case 'executionStillDisabled':
      return 'executable-state-enabled';
    default:
      return 'plan-rules-update-record-not-ready';
  }
}

function buildImplementationBoundaryFingerprint(
  parsed: ParsedUpdateRecordForImplementationBoundary,
  ready: boolean
): KnowledgeTeamUploadExecutionImplementationBoundary['implementationBoundary']['implementationBoundaryFingerprint'] {
  if (!ready || parsed.sourcePlanRulesUpdateRecord.updateRecordFingerprint.value === null) {
    return {
      algorithm: 'sha256',
      scope: 'stage-knowledge-pack-upload-execution-implementation-boundary-v1',
      value: null,
      canonicalFieldCount: IMPLEMENTATION_BOUNDARY_FINGERPRINT_FIELD_COUNT
    };
  }

  const canonicalFields = [
    ['scope', 'stage-knowledge-pack-upload-execution-implementation-boundary-v1'],
    ['plannedOperation', 'stage-knowledge-pack'],
    ['sourceKind', 'infra-agent.knowledge-team-upload-execution-plan-rules-update-record'],
    ['sourceStatus', parsed.recordStatus],
    ['sourceNextAction', parsed.recordNextAction],
    ['manifestId', parsed.target.manifestId],
    ['objectSha256', parsed.target.objectSha256],
    ['artifactId', parsed.target.artifactId],
    ['sourceApprovalRecordFingerprint', parsed.sourcePlanRulesUpdateRecord.sourceApprovalRecordFingerprint.value],
    ['sourceAuthorizationBoundaryFingerprint', parsed.sourcePlanRulesUpdateRecord.sourceAuthorizationBoundaryFingerprint.value],
    ['sourcePlanRulesReviewFingerprint', parsed.sourcePlanRulesUpdateRecord.sourcePlanRulesReviewFingerprint.value],
    ['sourceUpdateRecordFingerprint', parsed.sourcePlanRulesUpdateRecord.updateRecordFingerprint.value],
    ['implementationBoundaryDesigned', 'true'],
    ['sourceUpdateRecordFingerprintVerified', 'true'],
    ['runtimeBoundaryDesignRequired', 'true'],
    ['implementationAllowed', 'false'],
    ['uploadExecutionAllowed', 'false'],
    ['mutationApprovalGranted', 'false']
  ] as const;

  return {
    algorithm: 'sha256',
    scope: 'stage-knowledge-pack-upload-execution-implementation-boundary-v1',
    value: createHash('sha256')
      .update(canonicalFields.map(([key, value]) => `${key}=${value}`).join('\n'))
      .digest('hex'),
    canonicalFieldCount: IMPLEMENTATION_BOUNDARY_FINGERPRINT_FIELD_COUNT
  };
}

function buildExecutionBoundary(): KnowledgeTeamUploadExecutionImplementationBoundary['executionBoundary'] {
  return {
    dryRunOnly: true,
    executable: false,
    artifactBytesProvided: false,
    adapterInjected: false,
    clientCreated: false,
    credentialValuesRead: false,
    credentialValuesExposed: false,
    credentialPresenceChecked: false,
    credentialPresenceResultExposed: false,
    liveCheckAllowed: false,
    liveCheckPerformed: false,
    liveCheckResultExposed: false,
    uploadCommandGenerated: false,
    uploadCommandMaterialized: false,
    uploadCommandExposed: false,
    artifactObjectStoreBound: false,
    metadataIndexBound: false,
    objectStoreHandleExposed: false,
    metadataIndexHandleExposed: false,
    objectWriteAllowed: false,
    metadataIndexWriteAllowed: false,
    objectWriteAttempted: false,
    metadataIndexWriteAttempted: false,
    writeTokenIssued: false,
    executionLeaseCreated: false,
    rollbackPlanCreated: false,
    auditRecordCreated: false,
    remoteMutationPerformed: false
  };
}

export function buildKnowledgeTeamUploadExecutionImplementationBoundary(
  input: KnowledgeTeamUploadExecutionImplementationBoundaryInput
): KnowledgeTeamUploadExecutionImplementationBoundary {
  const blockers: KnowledgeTeamUploadExecutionImplementationBoundaryBlocker[] = [];
  const parsed = parseUpdateRecordForImplementationBoundary(input.planRulesUpdateRecord, blockers);
  const ready = blockers.length === 0;
  const status: KnowledgeTeamUploadExecutionImplementationBoundaryStatus = ready
    ? 'upload-execution-implementation-boundary-ready'
    : 'blocked';
  const implementationBoundaryFingerprint = buildImplementationBoundaryFingerprint(parsed, ready);

  return {
    kind: 'infra-agent.knowledge-team-upload-execution-implementation-boundary',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    boundaryKind: 'upload-execution-implementation-boundary-dry-run',
    status,
    plannedOperation: 'stage-knowledge-pack',
    remoteWriteAllowed: false,
    liveCheckAllowed: false,
    credentialValuesExposed: false,
    credentialPresenceChecked: false,
    uploadApproved: false,
    uploadExecutionApproved: false,
    uploadExecutionAllowed: false,
    mutationApprovalGranted: false,
    clientCreated: false,
    adapterInjected: false,
    artifactBytesProvided: false,
    writeTokenIssued: false,
    executionLeaseCreated: false,
    rollbackPlanCreated: false,
    auditRecordCreated: false,
    objectWriteAttempted: false,
    metadataIndexWriteAttempted: false,
    remoteMutationPerformed: false,
    uploadCommand: null,
    target: parsed.target,
    sourcePlanRulesUpdateRecord: parsed.sourcePlanRulesUpdateRecord,
    implementationBoundary: {
      dryRunOnly: true,
      implementationBoundaryDesigned: ready,
      sourceUpdateRecordFingerprintVerified: ready,
      runtimeBoundaryDesignRequired: true,
      commandGenerationStillProhibited: true,
      adapterInjectionStillProhibited: true,
      clientCreationStillProhibited: true,
      credentialAccessStillProhibited: true,
      credentialPresenceCheckStillProhibited: true,
      liveCheckStillProhibited: true,
      objectStoreBindingStillProhibited: true,
      metadataIndexBindingStillProhibited: true,
      objectWriteStillProhibited: true,
      metadataIndexWriteStillProhibited: true,
      remoteMutationStillProhibited: true,
      implementationAllowed: false,
      authorizationGranted: false,
      executionAuthorizationGranted: false,
      uploadApproved: false,
      uploadExecutionApproved: false,
      uploadExecutionAllowed: false,
      mutationApprovalGranted: false,
      executable: false,
      sourceUpdateRecordFingerprint: parsed.sourcePlanRulesUpdateRecord.updateRecordFingerprint,
      implementationBoundaryFingerprint
    },
    executionBoundary: buildExecutionBoundary(),
    readiness: {
      status,
      nextAction: ready ? 'design-upload-execution-runtime-boundaries' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: [...new Set(blockers.map((blocker) => blocker.code))],
      blockers,
      reason: ready
        ? 'Upload execution implementation boundary is designed as a dry-run checkpoint; runtime boundaries and execution remain prohibited.'
        : 'Upload execution implementation boundary is blocked because the Plan/Rules update record is incomplete, unsafe, leaky, non-ready, or already executable.'
    }
  };
}
