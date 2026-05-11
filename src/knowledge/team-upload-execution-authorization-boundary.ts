import { createHash } from 'node:crypto';
import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadExecutionAuthorizationBoundaryStatus =
  | 'upload-execution-authorization-boundary-ready'
  | 'blocked';

export type KnowledgeTeamUploadExecutionAuthorizationBoundaryNextAction =
  | 'await-plan-rules-update-for-upload-execution'
  | 'resolve-blockers';

export type KnowledgeTeamUploadExecutionAuthorizationBoundaryBlockerCode =
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
  | 'execution-approval-record-next-action-invalid'
  | 'execution-approval-record-not-ready'
  | 'execution-lease-created'
  | 'invalid-execution-approval-record-kind'
  | 'invalid-record-kind'
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
  | 'approval-record-fingerprint-missing'
  | 'approval-record-fingerprint-unsupported'
  | 'approval-record-fingerprint-unverified'
  | 'write-token-issued';

export interface KnowledgeTeamUploadExecutionAuthorizationBoundaryBlocker {
  code: KnowledgeTeamUploadExecutionAuthorizationBoundaryBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadExecutionAuthorizationBoundary {
  kind: 'infra-agent.knowledge-team-upload-execution-authorization-boundary';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  boundaryKind: 'upload-execution-authorization-boundary-dry-run';
  status: KnowledgeTeamUploadExecutionAuthorizationBoundaryStatus;
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
  sourceApprovalRecord: {
    source: 'upload-execution-approval-record';
    recordStatus: 'upload-execution-approval-record-ready' | 'blocked' | 'invalid';
    recordKind: 'human-upload-execution-approval-record-dry-run' | 'unsupported';
    recordNextAction: 'design-upload-execution-authorization-boundary' | 'resolve-blockers' | 'invalid';
    sourceApprovalRequestStatus: 'upload-execution-approval-request-ready' | 'blocked' | 'invalid';
    sourceApprovalRequestKind: 'upload-execution-approval-request-dry-run' | 'unsupported';
    sourceApprovalRequestNextAction: 'record-human-upload-execution-approval' | 'resolve-blockers' | 'invalid';
    sourceExecutionReadinessStatus: 'upload-execution-readiness-boundary-ready' | 'blocked' | 'invalid';
    sourceExecutionReadinessKind: 'upload-execution-readiness-boundary-dry-run' | 'unsupported';
    sourceExecutionReadinessNextAction: 'request-separate-upload-execution-approval' | 'resolve-blockers' | 'invalid';
    reviewStatus: 'review-ready' | 'blocked' | 'invalid';
    reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
    scopeMatched: boolean;
    humanReviewRecorded: boolean;
    sourceFingerprintVerified: boolean;
    sourceArtifactFingerprintVerified: boolean;
    adapterName: string | null;
    adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
    requestIssued: boolean;
    requestHumanApprovalRecorded: boolean;
    requestApprovalGranted: boolean;
    requestFingerprintVerified: boolean;
    requestFingerprint: {
      algorithm: 'sha256' | 'unsupported';
      scope: 'stage-knowledge-pack-upload-execution-approval-request-v1' | 'unsupported';
      value: string | null;
      canonicalFieldCount: number | null;
    };
    humanApprovalRecorded: boolean;
    approvalFingerprintVerified: boolean;
    approvalGranted: boolean;
    suppliedFingerprint: string | null;
    expectedFingerprint: string | null;
    sourceRequestFingerprint: {
      algorithm: 'sha256' | 'unsupported';
      scope: 'stage-knowledge-pack-upload-execution-approval-request-v1' | 'unsupported';
      value: string | null;
      canonicalFieldCount: number | null;
    };
    recordFingerprint: {
      algorithm: 'sha256' | 'unsupported';
      scope: 'stage-knowledge-pack-upload-execution-approval-record-v1' | 'unsupported';
      value: string | null;
      canonicalFieldCount: number | null;
    };
    uploadApproved: boolean;
    uploadExecutionApproved: boolean;
    uploadExecutionAllowed: boolean;
    mutationApprovalGranted: boolean;
  };
  authorizationBoundary: {
    dryRunOnly: true;
    uploadExecutionAuthorizationRequired: true;
    humanApprovalRecorded: boolean;
    approvalFingerprintVerified: boolean;
    authorizationBoundaryDesigned: boolean;
    authorizationGranted: false;
    executionAuthorizationGranted: false;
    approvalGranted: false;
    uploadApproved: false;
    uploadExecutionApproved: false;
    uploadExecutionAllowed: false;
    mutationApprovalGranted: false;
    executable: false;
    objectWriteAllowed: false;
    metadataIndexWriteAllowed: false;
    objectWriteAttempted: false;
    metadataIndexWriteAttempted: false;
    remoteMutationPerformed: false;
    sourceApprovalRecordFingerprint: {
      algorithm: 'sha256' | 'unsupported';
      scope: 'stage-knowledge-pack-upload-execution-approval-record-v1' | 'unsupported';
      value: string | null;
      canonicalFieldCount: number | null;
    };
    authorizationBoundaryFingerprint: {
      algorithm: 'sha256';
      scope: 'stage-knowledge-pack-upload-execution-authorization-boundary-v1';
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
    status: KnowledgeTeamUploadExecutionAuthorizationBoundaryStatus;
    nextAction: KnowledgeTeamUploadExecutionAuthorizationBoundaryNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadExecutionAuthorizationBoundaryBlockerCode[];
    blockers: KnowledgeTeamUploadExecutionAuthorizationBoundaryBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadExecutionAuthorizationBoundaryInput {
  executionApprovalRecord: unknown;
}

interface ParsedExecutionApprovalRecordForAuthorizationBoundary {
  recordStatus: KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord']['recordStatus'];
  recordKind: KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord']['recordKind'];
  recordNextAction: KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord']['recordNextAction'];
  target: KnowledgeTeamUploadExecutionAuthorizationBoundary['target'];
  sourceApprovalRecord: KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord'];
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const SAFE_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const APPROVAL_REQUEST_FINGERPRINT_FIELD_COUNT = 16;
const APPROVAL_RECORD_FINGERPRINT_FIELD_COUNT = 14;
const AUTHORIZATION_BOUNDARY_FINGERPRINT_FIELD_COUNT = 16;
const FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN = /(artifactBytesValue|artifactBytesBase64|artifactBytesContent|artifactBytesPayload|artifactContent|artifactPayload|rawArtifact|byteBuffer|bytesBase64|contentBase64|buffer|stream|arrayBuffer|blob|readPath|filePath|localPath|artifactPath|serializedPayload|stagedBytes)/i;
const FORBIDDEN_CLIENT_KEY_PATTERN = /(clientInstance|clientObject|clientValue|clientFactoryValue|clientDescriptorValue|clientConfig|adapterClient|^sdkClient$|sdkClientConfig|signedUrl)/i;
const FORBIDDEN_CREDENTIAL_KEY_PATTERN = /(^credentialValue$|credentialValuePayload|credentialValueMaterial|credentialMaterial|credentialFile|credentialPath|credentialsPath|secretValue|envValue|processEnv|presenceCheckResult|^credentialPresenceResult$|credentialPresenceResult(?:Value|Payload|Material|Data|Body|Response)|credentialPresenceSignalValue)/i;
const FORBIDDEN_LIVE_CHECK_KEY_PATTERN = /(^liveCheckResult$|liveCheckResult(?:Value|Payload|Material|Data|Body)|liveCheckResponse|liveCheckProbe|liveCheckRequest|liveBackendProbe|headObjectResult|headIndexResult|remoteProbeResult|connectivityResult|healthCheckResult)/i;
const FORBIDDEN_COMMAND_KEY_PATTERN = /(^uploadCommandValue$|^uploadCommandPayload$|^uploadCommandMaterial$|^uploadCommandData$|^uploadCommandBody$|^uploadCommandLine$|^commandLine$|^shellCommand$|^signedUploadCommand$|^uploadExecutionCommand$)/i;
const FORBIDDEN_AUTHORIZATION_KEY_PATTERN = /(^authorizationValue$|authorizationMaterial|authorizationToken|authorizationHeader|executionAuthorizationValue|executionAuthorizationMaterial|executionGrant|signedAuthorization|uploadExecutionAuthorizationMaterial|uploadExecutionGrant)/i;
const FORBIDDEN_ADAPTER_KEY_PATTERN = /(adapterInstance|adapterObject|adapterValue|adapterDescriptorValue)/i;
const FORBIDDEN_OBJECT_STORE_HANDLE_KEY_PATTERN = /(^objectStoreBinding$|objectStoreBinding(?:Handle|Instance|Client|Value|Payload|Material)|^objectStoreHandle$|objectStoreHandle(?:Value|Payload|Material|Instance|Client)|objectStoreInstance|objectStoreClient|artifactObjectStoreHandle|putObject|writeObject)/i;
const FORBIDDEN_METADATA_INDEX_HANDLE_KEY_PATTERN = /(^metadataIndexBinding$|metadataIndexBinding(?:Handle|Instance|Client|Value|Payload|Material)|^metadataIndexHandle$|metadataIndexHandle(?:Value|Payload|Material|Instance|Client)|metadataIndexInstance|metadataIndexClient|putEntry|writeIndex|indexEntryPayload|indexEntryValue)/i;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|secret|password|authorization|header|accessKey|sessionToken|tokenValue|tokenMaterial|leaseValue|leaseMaterial|rollbackValue|rollbackMaterial|rollbackCommand|auditValue|auditMaterial|auditCommand)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|kubectl |curl |secret|password|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;

const DISABLED_SOURCE_RECORD_FIELDS = [
  'uploadApproved',
  'uploadExecutionApproved',
  'uploadExecutionAllowed',
  'mutationApprovalGranted'
] as const;

const DISABLED_EXECUTION_BOUNDARY_FIELDS = [
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
  return value === true;
}

function addBlocker(
  blockers: KnowledgeTeamUploadExecutionAuthorizationBoundaryBlocker[],
  code: KnowledgeTeamUploadExecutionAuthorizationBoundaryBlockerCode,
  path: string,
  message: string
): void {
  blockers.push({ code, path, message });
}

function scanForPrivateDetails(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadExecutionAuthorizationBoundaryBlocker[]
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForPrivateDetails(entry, `${path}[${index}]`, blockers));
    return;
  }
  if (!isRecord(value)) {
    if (typeof value === 'string' && FORBIDDEN_LEAK_VALUE_PATTERN.test(value)) {
      addBlocker(blockers, 'backend-detail-leak', path, 'Upload execution authorization boundary input must not contain backend details, private paths, credentials, executable commands, live-check results, object/index handles, authorization material, or raw artifact content.');
    }
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    if (key === 'objectKey') {
      addBlocker(blockers, 'unsafe-artifact-reference', entryPath, 'Upload execution authorization boundary input must not contain target object keys.');
      continue;
    }
    if (FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'artifact-bytes-provided', entryPath, 'Upload execution authorization boundary input must not contain raw bytes, byte buffers, streams, content payloads, or local artifact paths.');
      continue;
    }
    if (FORBIDDEN_CLIENT_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'client-dependency-leak', entryPath, 'Upload execution authorization boundary input must not contain SDK clients, client configs, signed URLs, or write functions.');
      continue;
    }
    if (FORBIDDEN_CREDENTIAL_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'credential-dependency-leak', entryPath, 'Upload execution authorization boundary input must not contain credential values, credential files, environment reads, or credential presence results.');
      continue;
    }
    if (FORBIDDEN_LIVE_CHECK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'live-check-enabled', entryPath, 'Upload execution authorization boundary input must not contain live backend probes, live-check requests, or live-check results.');
      continue;
    }
    if (FORBIDDEN_COMMAND_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'upload-command-present', entryPath, 'Upload execution authorization boundary input must not contain upload command payloads or executable command material.');
      continue;
    }
    if (FORBIDDEN_AUTHORIZATION_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'authorization-material-leak', entryPath, 'Upload execution authorization boundary input must not contain execution authorization material, grant values, tokens, or headers.');
      continue;
    }
    if (FORBIDDEN_ADAPTER_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'adapter-dependency-leak', entryPath, 'Upload execution authorization boundary input must not contain adapter instances or concrete adapter values.');
      continue;
    }
    if (FORBIDDEN_OBJECT_STORE_HANDLE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'object-store-handle-leak', entryPath, 'Upload execution authorization boundary input must not contain object store handles or object write functions.');
      continue;
    }
    if (FORBIDDEN_METADATA_INDEX_HANDLE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'metadata-index-handle-leak', entryPath, 'Upload execution authorization boundary input must not contain metadata index handles, metadata index entries, or index write functions.');
      continue;
    }
    if (FORBIDDEN_LEAK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'backend-detail-leak', entryPath, 'Upload execution authorization boundary input must not contain backend details, credential fields, commands, token/lease material, rollback material, audit material, authorization material, or raw artifact content.');
      continue;
    }
    scanForPrivateDetails(entry, entryPath, blockers);
  }
}

function readSafeId(value: unknown): string | null {
  if (typeof value !== 'string' || !SAFE_ID_PATTERN.test(value)) {
    return null;
  }
  return value;
}

function readSafeSha256(value: unknown): string | null {
  if (typeof value !== 'string' || !isKnowledgeTeamArtifactSha256(value)) {
    return null;
  }
  return value;
}

function readRecordStatus(value: unknown): ParsedExecutionApprovalRecordForAuthorizationBoundary['recordStatus'] {
  if (value === 'upload-execution-approval-record-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readRecordKind(value: unknown): ParsedExecutionApprovalRecordForAuthorizationBoundary['recordKind'] {
  if (value === 'human-upload-execution-approval-record-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readRecordNextAction(value: unknown): ParsedExecutionApprovalRecordForAuthorizationBoundary['recordNextAction'] {
  if (value === 'design-upload-execution-authorization-boundary' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readRequestStatus(value: unknown): KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord']['sourceApprovalRequestStatus'] {
  if (value === 'upload-execution-approval-request-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readRequestKind(value: unknown): KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord']['sourceApprovalRequestKind'] {
  if (value === 'upload-execution-approval-request-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readRequestNextAction(value: unknown): KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord']['sourceApprovalRequestNextAction'] {
  if (value === 'record-human-upload-execution-approval' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readSourceExecutionReadinessStatus(value: unknown): KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord']['sourceExecutionReadinessStatus'] {
  if (value === 'upload-execution-readiness-boundary-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readSourceExecutionReadinessKind(value: unknown): KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord']['sourceExecutionReadinessKind'] {
  if (value === 'upload-execution-readiness-boundary-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readSourceExecutionReadinessNextAction(value: unknown): KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord']['sourceExecutionReadinessNextAction'] {
  if (value === 'request-separate-upload-execution-approval' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readReviewStatus(value: unknown): KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord']['reviewStatus'] {
  if (value === 'review-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readReviewKind(value: unknown): KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord']['reviewKind'] {
  if (value === 'human-fingerprint-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readAdapterBackendKind(value: unknown): KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord']['adapterBackendKind'] {
  if (value === 'mock-s3-compatible' || value === 's3-compatible') {
    return value;
  }
  return 'unsupported';
}

function readSafeRequestFingerprint(
  value: unknown
): KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord']['requestFingerprint'] {
  if (!isRecord(value)) {
    return {
      algorithm: 'unsupported',
      scope: 'unsupported',
      value: null,
      canonicalFieldCount: null
    };
  }
  return {
    algorithm: value.algorithm === 'sha256' ? 'sha256' : 'unsupported',
    scope: value.scope === 'stage-knowledge-pack-upload-execution-approval-request-v1'
      ? 'stage-knowledge-pack-upload-execution-approval-request-v1'
      : 'unsupported',
    value: typeof value.value === 'string' && SAFE_FINGERPRINT_PATTERN.test(value.value) ? value.value : null,
    canonicalFieldCount: typeof value.canonicalFieldCount === 'number' ? value.canonicalFieldCount : null
  };
}

function readSafeRecordFingerprint(
  value: unknown
): KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord']['recordFingerprint'] {
  if (!isRecord(value)) {
    return {
      algorithm: 'unsupported',
      scope: 'unsupported',
      value: null,
      canonicalFieldCount: null
    };
  }
  return {
    algorithm: value.algorithm === 'sha256' ? 'sha256' : 'unsupported',
    scope: value.scope === 'stage-knowledge-pack-upload-execution-approval-record-v1'
      ? 'stage-knowledge-pack-upload-execution-approval-record-v1'
      : 'unsupported',
    value: typeof value.value === 'string' && SAFE_FINGERPRINT_PATTERN.test(value.value) ? value.value : null,
    canonicalFieldCount: typeof value.canonicalFieldCount === 'number' ? value.canonicalFieldCount : null
  };
}

function blockerCodeForFalseField(key: string): KnowledgeTeamUploadExecutionAuthorizationBoundaryBlockerCode {
  if (key === 'uploadApproved') return 'upload-approval-already-provided';
  if (key === 'uploadExecutionApproved') return 'upload-execution-approval-already-provided';
  if (key === 'uploadExecutionAllowed') return 'upload-execution-enabled';
  if (key === 'mutationApprovalGranted') return 'mutation-approval-already-granted';
  if (key === 'authorizationGranted' || key === 'executionAuthorizationGranted') return 'authorization-already-granted';
  if (key === 'clientCreated') return 'client-created';
  if (key === 'adapterInjected') return 'adapter-injected';
  if (key === 'artifactBytesProvided') return 'artifact-bytes-provided';
  if (key === 'credentialValuesRead') return 'credential-values-read';
  if (key === 'credentialValuesExposed') return 'credential-values-exposed';
  if (key === 'credentialPresenceChecked') return 'credential-presence-check-enabled';
  if (key === 'credentialPresenceResultExposed') return 'credential-presence-result-exposed';
  if (key === 'liveCheckAllowed' || key === 'liveCheckPerformed') return 'live-check-enabled';
  if (key === 'liveCheckResultExposed') return 'live-check-result-exposed';
  if (key === 'uploadCommandGenerated' || key === 'uploadCommandMaterialized') return 'upload-command-generated';
  if (key === 'uploadCommandExposed') return 'upload-command-exposed';
  if (key === 'artifactObjectStoreBound') return 'artifact-object-store-bound';
  if (key === 'metadataIndexBound') return 'metadata-index-bound';
  if (key === 'objectStoreHandleExposed') return 'object-store-handle-leak';
  if (key === 'metadataIndexHandleExposed') return 'metadata-index-handle-leak';
  if (key === 'objectWriteAllowed' || key === 'metadataIndexWriteAllowed') return 'remote-write-enabled';
  if (key === 'objectWriteAttempted') return 'object-write-attempted';
  if (key === 'metadataIndexWriteAttempted') return 'metadata-index-write-attempted';
  if (key === 'writeTokenIssued') return 'write-token-issued';
  if (key === 'executionLeaseCreated') return 'execution-lease-created';
  if (key === 'rollbackPlanCreated') return 'rollback-plan-created';
  if (key === 'auditRecordCreated') return 'audit-record-created';
  if (key === 'remoteMutationPerformed') return 'remote-mutation-performed';
  if (key === 'executable') return 'executable-state-enabled';
  return 'mutation-enabled';
}

function checkFalseField(
  value: Record<string, unknown>,
  key: string,
  path: string,
  blockers: KnowledgeTeamUploadExecutionAuthorizationBoundaryBlocker[]
): void {
  if (value[key] === true) {
    addBlocker(blockers, blockerCodeForFalseField(key), `${path}.${key}`, `${key} must remain false when modeling upload execution authorization boundary.`);
  }
}

function emptyTarget(): KnowledgeTeamUploadExecutionAuthorizationBoundary['target'] {
  return {
    manifestId: null,
    objectKeyRedacted: true,
    objectSha256: null,
    artifactId: null
  };
}

function emptyRequestFingerprint(): KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord']['requestFingerprint'] {
  return {
    algorithm: 'unsupported',
    scope: 'unsupported',
    value: null,
    canonicalFieldCount: null
  };
}

function emptyRecordFingerprint(): KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord']['recordFingerprint'] {
  return {
    algorithm: 'unsupported',
    scope: 'unsupported',
    value: null,
    canonicalFieldCount: null
  };
}

function emptySourceApprovalRecord(): KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord'] {
  return {
    source: 'upload-execution-approval-record',
    recordStatus: 'invalid',
    recordKind: 'unsupported',
    recordNextAction: 'invalid',
    sourceApprovalRequestStatus: 'invalid',
    sourceApprovalRequestKind: 'unsupported',
    sourceApprovalRequestNextAction: 'invalid',
    sourceExecutionReadinessStatus: 'invalid',
    sourceExecutionReadinessKind: 'unsupported',
    sourceExecutionReadinessNextAction: 'invalid',
    reviewStatus: 'invalid',
    reviewKind: 'unsupported',
    scopeMatched: false,
    humanReviewRecorded: false,
    sourceFingerprintVerified: false,
    sourceArtifactFingerprintVerified: false,
    adapterName: null,
    adapterBackendKind: 'unsupported',
    requestIssued: false,
    requestHumanApprovalRecorded: false,
    requestApprovalGranted: false,
    requestFingerprintVerified: false,
    requestFingerprint: emptyRequestFingerprint(),
    humanApprovalRecorded: false,
    approvalFingerprintVerified: false,
    approvalGranted: false,
    suppliedFingerprint: null,
    expectedFingerprint: null,
    sourceRequestFingerprint: emptyRequestFingerprint(),
    recordFingerprint: emptyRecordFingerprint(),
    uploadApproved: false,
    uploadExecutionApproved: false,
    uploadExecutionAllowed: false,
    mutationApprovalGranted: false
  };
}

function emptyParsedExecutionApprovalRecord(): ParsedExecutionApprovalRecordForAuthorizationBoundary {
  return {
    recordStatus: 'invalid',
    recordKind: 'unsupported',
    recordNextAction: 'invalid',
    target: emptyTarget(),
    sourceApprovalRecord: emptySourceApprovalRecord()
  };
}

function parseTarget(
  value: unknown,
  blockers: KnowledgeTeamUploadExecutionAuthorizationBoundaryBlocker[]
): KnowledgeTeamUploadExecutionAuthorizationBoundary['target'] {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.executionApprovalRecord.target', 'Upload execution authorization boundary requires a target object.');
    addBlocker(blockers, 'unsafe-artifact-reference', '$.executionApprovalRecord.target', 'Upload execution authorization boundary requires safe target references.');
    return emptyTarget();
  }

  const manifestId = readSafeId(value.manifestId);
  const objectSha256 = readSafeSha256(value.objectSha256);
  const artifactId = readSafeId(value.artifactId);

  if (Object.hasOwn(value, 'objectKey') || value.objectKeyRedacted !== true || manifestId === null || objectSha256 === null || artifactId === null) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.executionApprovalRecord.target', 'Upload execution authorization boundary requires redacted object keys and safe manifest, hash, and artifact references.');
  }

  return {
    manifestId,
    objectKeyRedacted: true,
    objectSha256,
    artifactId
  };
}

function validateSourceApprovalRecordReadiness(
  value: Record<string, unknown>,
  sourceApprovalRecord: KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord'],
  blockers: KnowledgeTeamUploadExecutionAuthorizationBoundaryBlocker[]
): void {
  if (value.kind !== 'infra-agent.knowledge-team-upload-execution-approval-record') {
    addBlocker(blockers, 'invalid-execution-approval-record-kind', '$.executionApprovalRecord.kind', 'Upload execution authorization boundary requires an infra-agent.knowledge-team-upload-execution-approval-record artifact.');
  }
  if (value.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.executionApprovalRecord.schemaVersion', 'Upload execution authorization boundary requires schemaVersion 1.');
  }
  if (value.recordKind !== 'human-upload-execution-approval-record-dry-run') {
    addBlocker(blockers, 'invalid-record-kind', '$.executionApprovalRecord.recordKind', 'Upload execution authorization boundary requires a human-upload-execution-approval-record-dry-run source.');
  }
  if (value.status !== 'upload-execution-approval-record-ready') {
    addBlocker(blockers, 'execution-approval-record-not-ready', '$.executionApprovalRecord.status', 'Upload execution authorization boundary requires upload-execution-approval-record-ready input.');
  }
  if (!isRecord(value.readiness) || value.readiness.nextAction !== 'design-upload-execution-authorization-boundary') {
    addBlocker(blockers, 'execution-approval-record-next-action-invalid', '$.executionApprovalRecord.readiness.nextAction', 'Execution approval record must ask to design upload execution authorization boundary.');
  }
  if (isRecord(value.readiness) && value.readiness.blockerCount !== 0) {
    addBlocker(blockers, 'execution-approval-record-not-ready', '$.executionApprovalRecord.readiness.blockerCount', 'Upload execution authorization boundary requires an unblocked execution approval record.');
  }
  if (value.uploadCommand !== null) {
    addBlocker(blockers, 'upload-command-present', '$.executionApprovalRecord.uploadCommand', 'Upload execution authorization boundary must not receive upload commands.');
  }

  for (const key of [
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
    'remoteMutationPerformed',
    'liveCheckAllowed',
    'credentialValuesExposed',
    'credentialPresenceChecked'
  ]) {
    checkFalseField(value, key, '$.executionApprovalRecord', blockers);
  }

  if (sourceApprovalRecord.recordStatus !== 'upload-execution-approval-record-ready') {
    addBlocker(blockers, 'execution-approval-record-not-ready', '$.executionApprovalRecord.status', 'Upload execution authorization boundary requires a ready approval record source.');
  }
  if (sourceApprovalRecord.recordKind !== 'human-upload-execution-approval-record-dry-run') {
    addBlocker(blockers, 'invalid-record-kind', '$.executionApprovalRecord.recordKind', 'Upload execution authorization boundary requires a dry-run approval record source.');
  }
  if (sourceApprovalRecord.recordNextAction !== 'design-upload-execution-authorization-boundary') {
    addBlocker(blockers, 'execution-approval-record-next-action-invalid', '$.executionApprovalRecord.readiness.nextAction', 'Upload execution authorization boundary requires the authorization boundary next action.');
  }
  if (sourceApprovalRecord.sourceApprovalRequestStatus !== 'upload-execution-approval-request-ready'
    || sourceApprovalRecord.sourceApprovalRequestKind !== 'upload-execution-approval-request-dry-run'
    || sourceApprovalRecord.sourceApprovalRequestNextAction !== 'record-human-upload-execution-approval') {
    addBlocker(blockers, 'execution-approval-record-not-ready', '$.executionApprovalRecord.sourceApprovalRequest', 'Upload execution authorization boundary requires a ready source approval request chain.');
  }
  if (sourceApprovalRecord.sourceExecutionReadinessStatus !== 'upload-execution-readiness-boundary-ready'
    || sourceApprovalRecord.sourceExecutionReadinessKind !== 'upload-execution-readiness-boundary-dry-run'
    || sourceApprovalRecord.sourceExecutionReadinessNextAction !== 'request-separate-upload-execution-approval') {
    addBlocker(blockers, 'execution-approval-record-not-ready', '$.executionApprovalRecord.sourceApprovalRequest.sourceExecutionReadiness', 'Upload execution authorization boundary requires a ready source execution readiness chain.');
  }
  if (sourceApprovalRecord.reviewStatus !== 'review-ready' || sourceApprovalRecord.reviewKind !== 'human-fingerprint-dry-run') {
    addBlocker(blockers, 'review-fingerprint-unverified', '$.executionApprovalRecord.sourceApprovalRequest.reviewStatus', 'Upload execution authorization boundary requires the source review fingerprint to be ready.');
  }
  if (!sourceApprovalRecord.scopeMatched) {
    addBlocker(blockers, 'scope-not-matched', '$.executionApprovalRecord.sourceApprovalRequest.scopeMatched', 'Upload execution authorization boundary requires matched source scope.');
  }
  if (!sourceApprovalRecord.humanReviewRecorded
    || !sourceApprovalRecord.sourceFingerprintVerified
    || !sourceApprovalRecord.sourceArtifactFingerprintVerified) {
    addBlocker(blockers, 'review-fingerprint-unverified', '$.executionApprovalRecord.sourceApprovalRequest', 'Upload execution authorization boundary requires verified source fingerprints.');
  }
  if (sourceApprovalRecord.adapterName === null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.executionApprovalRecord.sourceApprovalRequest.adapterName', 'Upload execution authorization boundary requires a safe adapter name.');
  }
  if (sourceApprovalRecord.adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.executionApprovalRecord.sourceApprovalRequest.adapterBackendKind', 'Upload execution authorization boundary remains mock-backend only.');
  }
  if (!sourceApprovalRecord.requestIssued) {
    addBlocker(blockers, 'missing-required-field', '$.executionApprovalRecord.sourceApprovalRequest.requestIssued', 'Upload execution authorization boundary requires an issued source approval request.');
  }
  if (sourceApprovalRecord.requestHumanApprovalRecorded) {
    addBlocker(blockers, 'authorization-already-granted', '$.executionApprovalRecord.sourceApprovalRequest.requestHumanApprovalRecorded', 'Upload execution authorization boundary requires source request approval to be recorded only in the approval record.');
  }
  if (sourceApprovalRecord.requestApprovalGranted) {
    addBlocker(blockers, 'authorization-already-granted', '$.executionApprovalRecord.sourceApprovalRequest.requestApprovalGranted', 'Upload execution authorization boundary must not consume an approval-granted source request.');
  }
  if (sourceApprovalRecord.requestFingerprintVerified) {
    addBlocker(blockers, 'authorization-already-granted', '$.executionApprovalRecord.sourceApprovalRequest.requestFingerprintVerified', 'Upload execution authorization boundary must not consume a source request that directly verifies approval.');
  }
  if (!sourceApprovalRecord.humanApprovalRecorded || !sourceApprovalRecord.approvalFingerprintVerified) {
    addBlocker(blockers, 'approval-record-fingerprint-unverified', '$.executionApprovalRecord.approvalRecord', 'Upload execution authorization boundary requires recorded and verified human approval fingerprint.');
  }
  if (sourceApprovalRecord.approvalGranted) {
    addBlocker(blockers, 'authorization-already-granted', '$.executionApprovalRecord.approvalRecord.approvalGranted', 'Upload execution authorization boundary must not consume approval-granted records.');
  }
  for (const key of DISABLED_SOURCE_RECORD_FIELDS) {
    if (sourceApprovalRecord[key]) {
      addBlocker(blockers, blockerCodeForFalseField(key), `$.executionApprovalRecord.approvalRecord.${key}`, `${key} must remain false before upload execution authorization boundary design.`);
    }
  }
  if (sourceApprovalRecord.requestFingerprint.algorithm !== 'sha256'
    || sourceApprovalRecord.requestFingerprint.scope !== 'stage-knowledge-pack-upload-execution-approval-request-v1'
    || sourceApprovalRecord.requestFingerprint.canonicalFieldCount !== APPROVAL_REQUEST_FINGERPRINT_FIELD_COUNT) {
    addBlocker(blockers, 'approval-record-fingerprint-unsupported', '$.executionApprovalRecord.sourceApprovalRequest.requestFingerprint', 'Upload execution authorization boundary requires a supported source request fingerprint.');
  }
  if (sourceApprovalRecord.sourceRequestFingerprint.algorithm !== 'sha256'
    || sourceApprovalRecord.sourceRequestFingerprint.scope !== 'stage-knowledge-pack-upload-execution-approval-request-v1'
    || sourceApprovalRecord.sourceRequestFingerprint.canonicalFieldCount !== APPROVAL_REQUEST_FINGERPRINT_FIELD_COUNT
    || sourceApprovalRecord.sourceRequestFingerprint.value === null) {
    addBlocker(blockers, 'approval-record-fingerprint-unsupported', '$.executionApprovalRecord.approvalRecord.sourceRequestFingerprint', 'Upload execution authorization boundary requires a supported approval record source request fingerprint.');
  }
  if (sourceApprovalRecord.recordFingerprint.algorithm !== 'sha256'
    || sourceApprovalRecord.recordFingerprint.scope !== 'stage-knowledge-pack-upload-execution-approval-record-v1'
    || sourceApprovalRecord.recordFingerprint.canonicalFieldCount !== APPROVAL_RECORD_FINGERPRINT_FIELD_COUNT) {
    addBlocker(blockers, 'approval-record-fingerprint-unsupported', '$.executionApprovalRecord.approvalRecord.recordFingerprint', 'Upload execution authorization boundary requires a supported approval record fingerprint.');
  }
  if (sourceApprovalRecord.recordFingerprint.value === null) {
    addBlocker(blockers, 'approval-record-fingerprint-missing', '$.executionApprovalRecord.approvalRecord.recordFingerprint.value', 'Upload execution authorization boundary requires a safe approval record fingerprint.');
  }
}

function parseExecutionApprovalRecordForAuthorizationBoundary(
  value: unknown,
  blockers: KnowledgeTeamUploadExecutionAuthorizationBoundaryBlocker[]
): ParsedExecutionApprovalRecordForAuthorizationBoundary {
  scanForPrivateDetails(value, '$.executionApprovalRecord', blockers);
  if (!isRecord(value)) {
    addBlocker(blockers, 'invalid-execution-approval-record-kind', '$.executionApprovalRecord', 'Upload execution authorization boundary requires a saved execution approval record artifact.');
    return emptyParsedExecutionApprovalRecord();
  }

  const sourceRequest = isRecord(value.sourceApprovalRequest) ? value.sourceApprovalRequest : {};
  const approvalRecord = isRecord(value.approvalRecord) ? value.approvalRecord : {};
  const executionBoundary = isRecord(value.executionBoundary) ? value.executionBoundary : {};
  const requestFingerprint = readSafeRequestFingerprint(sourceRequest.requestFingerprint);
  const sourceRequestFingerprint = readSafeRequestFingerprint(approvalRecord.sourceRequestFingerprint);
  const recordFingerprint = readSafeRecordFingerprint(approvalRecord.recordFingerprint);
  const adapterName = typeof sourceRequest.adapterName === 'string' && isSafeKnowledgeTeamBackendAdapterName(sourceRequest.adapterName)
    ? sourceRequest.adapterName
    : null;
  if (sourceRequest.adapterName !== null && sourceRequest.adapterName !== undefined && adapterName === null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.executionApprovalRecord.sourceApprovalRequest.adapterName', 'Upload execution authorization boundary requires a safe adapter name.');
  }

  if (!isRecord(value.sourceApprovalRequest)) {
    addBlocker(blockers, 'missing-required-field', '$.executionApprovalRecord.sourceApprovalRequest', 'Upload execution authorization boundary requires source approval request metadata.');
  }
  if (!isRecord(value.approvalRecord)) {
    addBlocker(blockers, 'missing-required-field', '$.executionApprovalRecord.approvalRecord', 'Upload execution authorization boundary requires approval record metadata.');
  }
  if (!isRecord(value.executionBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.executionApprovalRecord.executionBoundary', 'Upload execution authorization boundary requires execution boundary metadata.');
  }

  const sourceApprovalRecord = {
    ...emptySourceApprovalRecord(),
    source: 'upload-execution-approval-record' as const,
    recordStatus: readRecordStatus(value.status),
    recordKind: readRecordKind(value.recordKind),
    recordNextAction: isRecord(value.readiness) ? readRecordNextAction(value.readiness.nextAction) : 'invalid' as const,
    sourceApprovalRequestStatus: readRequestStatus(sourceRequest.requestStatus),
    sourceApprovalRequestKind: readRequestKind(sourceRequest.requestKind),
    sourceApprovalRequestNextAction: readRequestNextAction(sourceRequest.requestNextAction),
    sourceExecutionReadinessStatus: readSourceExecutionReadinessStatus(sourceRequest.sourceExecutionReadinessStatus),
    sourceExecutionReadinessKind: readSourceExecutionReadinessKind(sourceRequest.sourceExecutionReadinessKind),
    sourceExecutionReadinessNextAction: readSourceExecutionReadinessNextAction(sourceRequest.sourceExecutionReadinessNextAction),
    reviewStatus: readReviewStatus(sourceRequest.reviewStatus),
    reviewKind: readReviewKind(sourceRequest.reviewKind),
    scopeMatched: readBool(sourceRequest.scopeMatched),
    humanReviewRecorded: readBool(sourceRequest.humanReviewRecorded),
    sourceFingerprintVerified: readBool(sourceRequest.sourceFingerprintVerified),
    sourceArtifactFingerprintVerified: readBool(sourceRequest.sourceArtifactFingerprintVerified),
    adapterName,
    adapterBackendKind: readAdapterBackendKind(sourceRequest.adapterBackendKind),
    requestIssued: readBool(sourceRequest.requestIssued),
    requestHumanApprovalRecorded: readBool(sourceRequest.requestHumanApprovalRecorded),
    requestApprovalGranted: readBool(sourceRequest.requestApprovalGranted),
    requestFingerprintVerified: readBool(sourceRequest.requestFingerprintVerified),
    requestFingerprint,
    humanApprovalRecorded: readBool(approvalRecord.humanApprovalRecorded),
    approvalFingerprintVerified: readBool(approvalRecord.fingerprintVerified),
    approvalGranted: readBool(approvalRecord.approvalGranted),
    suppliedFingerprint: typeof approvalRecord.suppliedFingerprint === 'string' && SAFE_FINGERPRINT_PATTERN.test(approvalRecord.suppliedFingerprint)
      ? approvalRecord.suppliedFingerprint
      : null,
    expectedFingerprint: typeof approvalRecord.expectedFingerprint === 'string' && SAFE_FINGERPRINT_PATTERN.test(approvalRecord.expectedFingerprint)
      ? approvalRecord.expectedFingerprint
      : null,
    sourceRequestFingerprint,
    recordFingerprint,
    uploadApproved: readBool(approvalRecord.uploadApproved),
    uploadExecutionApproved: readBool(approvalRecord.uploadExecutionApproved),
    uploadExecutionAllowed: readBool(approvalRecord.uploadExecutionAllowed),
    mutationApprovalGranted: readBool(approvalRecord.mutationApprovalGranted)
  };

  validateSourceApprovalRecordReadiness(value, sourceApprovalRecord, blockers);
  for (const key of DISABLED_EXECUTION_BOUNDARY_FIELDS) {
    if (executionBoundary[key]) {
      addBlocker(blockers, blockerCodeForFalseField(key), `$.executionApprovalRecord.executionBoundary.${key}`, `${key} must remain false before upload execution authorization boundary design.`);
    }
  }

  return {
    recordStatus: sourceApprovalRecord.recordStatus,
    recordKind: sourceApprovalRecord.recordKind,
    recordNextAction: sourceApprovalRecord.recordNextAction,
    target: parseTarget(value.target, blockers),
    sourceApprovalRecord
  };
}

function computeAuthorizationBoundaryFingerprint(input: {
  enabled: boolean;
  target: KnowledgeTeamUploadExecutionAuthorizationBoundary['target'];
  sourceApprovalRecord: KnowledgeTeamUploadExecutionAuthorizationBoundary['sourceApprovalRecord'];
}): KnowledgeTeamUploadExecutionAuthorizationBoundary['authorizationBoundary']['authorizationBoundaryFingerprint'] {
  if (!input.enabled
    || input.target.manifestId === null
    || input.target.objectSha256 === null
    || input.target.artifactId === null
    || input.sourceApprovalRecord.requestFingerprint.value === null
    || input.sourceApprovalRecord.recordFingerprint.value === null) {
    return {
      algorithm: 'sha256',
      scope: 'stage-knowledge-pack-upload-execution-authorization-boundary-v1',
      value: null,
      canonicalFieldCount: AUTHORIZATION_BOUNDARY_FINGERPRINT_FIELD_COUNT
    };
  }

  const canonicalFields = [
    ['scope', 'stage-knowledge-pack-upload-execution-authorization-boundary-v1'],
    ['plannedOperation', 'stage-knowledge-pack'],
    ['sourceKind', 'infra-agent.knowledge-team-upload-execution-approval-record'],
    ['sourceStatus', 'upload-execution-approval-record-ready'],
    ['sourceNextAction', 'design-upload-execution-authorization-boundary'],
    ['manifestId', input.target.manifestId],
    ['objectSha256', input.target.objectSha256],
    ['artifactId', input.target.artifactId],
    ['sourceApprovalRequestFingerprint', input.sourceApprovalRecord.requestFingerprint.value],
    ['sourceApprovalRecordFingerprint', input.sourceApprovalRecord.recordFingerprint.value],
    ['humanApprovalRecorded', 'true'],
    ['approvalFingerprintVerified', 'true'],
    ['authorizationGranted', 'false'],
    ['uploadExecutionApproved', 'false'],
    ['uploadExecutionAllowed', 'false'],
    ['schemaVersion', '1']
  ];

  return {
    algorithm: 'sha256',
    scope: 'stage-knowledge-pack-upload-execution-authorization-boundary-v1',
    value: createHash('sha256')
      .update(JSON.stringify(canonicalFields))
      .digest('hex'),
    canonicalFieldCount: AUTHORIZATION_BOUNDARY_FINGERPRINT_FIELD_COUNT
  };
}

function executionBoundary(): KnowledgeTeamUploadExecutionAuthorizationBoundary['executionBoundary'] {
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

export function buildKnowledgeTeamUploadExecutionAuthorizationBoundary(
  input: KnowledgeTeamUploadExecutionAuthorizationBoundaryInput
): KnowledgeTeamUploadExecutionAuthorizationBoundary {
  const blockers: KnowledgeTeamUploadExecutionAuthorizationBoundaryBlocker[] = [];
  const parsedRecord = parseExecutionApprovalRecordForAuthorizationBoundary(input.executionApprovalRecord, blockers);
  const status: KnowledgeTeamUploadExecutionAuthorizationBoundaryStatus = blockers.length === 0
    ? 'upload-execution-authorization-boundary-ready'
    : 'blocked';
  const boundaryReady = status === 'upload-execution-authorization-boundary-ready';
  const authorizationBoundaryFingerprint = computeAuthorizationBoundaryFingerprint({
    enabled: boundaryReady,
    target: parsedRecord.target,
    sourceApprovalRecord: parsedRecord.sourceApprovalRecord
  });

  return {
    kind: 'infra-agent.knowledge-team-upload-execution-authorization-boundary',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    boundaryKind: 'upload-execution-authorization-boundary-dry-run',
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
    target: parsedRecord.target,
    sourceApprovalRecord: parsedRecord.sourceApprovalRecord,
    authorizationBoundary: {
      dryRunOnly: true,
      uploadExecutionAuthorizationRequired: true,
      humanApprovalRecorded: boundaryReady,
      approvalFingerprintVerified: boundaryReady,
      authorizationBoundaryDesigned: boundaryReady,
      authorizationGranted: false,
      executionAuthorizationGranted: false,
      approvalGranted: false,
      uploadApproved: false,
      uploadExecutionApproved: false,
      uploadExecutionAllowed: false,
      mutationApprovalGranted: false,
      executable: false,
      objectWriteAllowed: false,
      metadataIndexWriteAllowed: false,
      objectWriteAttempted: false,
      metadataIndexWriteAttempted: false,
      remoteMutationPerformed: false,
      sourceApprovalRecordFingerprint: parsedRecord.sourceApprovalRecord.recordFingerprint,
      authorizationBoundaryFingerprint
    },
    executionBoundary: executionBoundary(),
    readiness: {
      status,
      nextAction: boundaryReady ? 'await-plan-rules-update-for-upload-execution' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: blockers.map(entry => entry.code),
      blockers,
      reason: boundaryReady
        ? 'Upload execution authorization boundary is modeled, but execution remains disabled until a later plan/rules update explicitly narrows the boundary.'
        : 'Upload execution authorization boundary is blocked until source approval record and safety blockers are resolved.'
    }
  };
}
