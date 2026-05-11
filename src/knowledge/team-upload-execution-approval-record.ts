import { createHash } from 'node:crypto';
import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadExecutionApprovalRecordStatus =
  | 'upload-execution-approval-record-ready'
  | 'blocked';

export type KnowledgeTeamUploadExecutionApprovalRecordNextAction =
  | 'design-upload-execution-authorization-boundary'
  | 'resolve-blockers';

export type KnowledgeTeamUploadExecutionApprovalRecordBlockerCode =
  | 'adapter-injected'
  | 'adapter-dependency-leak'
  | 'artifact-bytes-provided'
  | 'artifact-object-store-bound'
  | 'audit-record-created'
  | 'approval-already-granted'
  | 'approval-already-recorded'
  | 'approval-fingerprint-missing'
  | 'approval-fingerprint-mismatch'
  | 'approval-request-fingerprint-missing'
  | 'approval-request-fingerprint-unsupported'
  | 'backend-detail-leak'
  | 'client-created'
  | 'client-dependency-leak'
  | 'credential-dependency-leak'
  | 'credential-presence-check-enabled'
  | 'credential-presence-result-exposed'
  | 'credential-values-exposed'
  | 'credential-values-read'
  | 'executable-state-enabled'
  | 'execution-approval-request-next-action-invalid'
  | 'execution-approval-request-not-ready'
  | 'execution-lease-created'
  | 'invalid-execution-approval-request-kind'
  | 'invalid-request-kind'
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
  | 'unsafe-approval-fingerprint'
  | 'unsafe-artifact-reference'
  | 'unsupported-adapter-backend'
  | 'upload-approval-already-provided'
  | 'upload-command-exposed'
  | 'upload-command-generated'
  | 'upload-command-present'
  | 'upload-execution-approval-already-provided'
  | 'upload-execution-enabled'
  | 'write-token-issued';

export interface KnowledgeTeamUploadExecutionApprovalRecordBlocker {
  code: KnowledgeTeamUploadExecutionApprovalRecordBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadExecutionApprovalRecord {
  kind: 'infra-agent.knowledge-team-upload-execution-approval-record';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  recordKind: 'human-upload-execution-approval-record-dry-run';
  status: KnowledgeTeamUploadExecutionApprovalRecordStatus;
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
  sourceApprovalRequest: {
    source: 'upload-execution-approval-request';
    requestStatus: 'upload-execution-approval-request-ready' | 'blocked' | 'invalid';
    requestKind: 'upload-execution-approval-request-dry-run' | 'unsupported';
    requestNextAction: 'record-human-upload-execution-approval' | 'resolve-blockers' | 'invalid';
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
    executionReadinessModeled: boolean;
    separateExecutionApprovalRequired: boolean;
    objectWriteRequiresExecutionApproval: boolean;
    metadataIndexWriteRequiresExecutionApproval: boolean;
    uploadApproved: boolean;
    uploadExecutionApproved: boolean;
    uploadExecutionAllowed: boolean;
    mutationApprovalGranted: boolean;
    artifactBytesProvided: boolean;
    adapterInjected: boolean;
    clientCreated: boolean;
    credentialValuesRead: boolean;
    credentialValuesExposed: boolean;
    credentialPresenceChecked: boolean;
    credentialPresenceResultExposed: boolean;
    liveCheckAllowed: boolean;
    liveCheckPerformed: boolean;
    liveCheckResultExposed: boolean;
    uploadCommandGenerated: boolean;
    uploadCommandMaterialized: boolean;
    uploadCommandExposed: boolean;
    artifactObjectStoreBound: boolean;
    metadataIndexBound: boolean;
    objectStoreHandleExposed: boolean;
    metadataIndexHandleExposed: boolean;
    objectWriteAllowed: boolean;
    metadataIndexWriteAllowed: boolean;
    objectWriteAttempted: boolean;
    metadataIndexWriteAttempted: boolean;
    writeTokenIssued: boolean;
    executionLeaseCreated: boolean;
    rollbackPlanCreated: boolean;
    auditRecordCreated: boolean;
    remoteMutationPerformed: boolean;
    executable: boolean;
  };
  approvalRecord: {
    uploadExecutionApprovalRequired: true;
    humanApprovalRequired: true;
    humanApprovalRecorded: boolean;
    approvalGranted: false;
    source: 'cli-flag' | null;
    suppliedFingerprint: string | null;
    expectedFingerprint: string | null;
    fingerprintVerified: boolean;
    sourceRequestFingerprint: {
      algorithm: 'sha256' | 'unsupported';
      scope: 'stage-knowledge-pack-upload-execution-approval-request-v1' | 'unsupported';
      value: string | null;
      canonicalFieldCount: number | null;
    };
    recordFingerprint: {
      algorithm: 'sha256';
      scope: 'stage-knowledge-pack-upload-execution-approval-record-v1';
      value: string | null;
      canonicalFieldCount: number;
    };
    uploadApproved: false;
    uploadExecutionApproved: false;
    uploadExecutionAllowed: false;
    mutationApprovalGranted: false;
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
    status: KnowledgeTeamUploadExecutionApprovalRecordStatus;
    nextAction: KnowledgeTeamUploadExecutionApprovalRecordNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadExecutionApprovalRecordBlockerCode[];
    blockers: KnowledgeTeamUploadExecutionApprovalRecordBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadExecutionApprovalRecordInput {
  executionApprovalRequest: unknown;
  approvalFingerprint: unknown;
}

interface ParsedExecutionApprovalRequestForRecord {
  requestStatus: KnowledgeTeamUploadExecutionApprovalRecord['sourceApprovalRequest']['requestStatus'];
  requestKind: KnowledgeTeamUploadExecutionApprovalRecord['sourceApprovalRequest']['requestKind'];
  requestNextAction: KnowledgeTeamUploadExecutionApprovalRecord['sourceApprovalRequest']['requestNextAction'];
  target: KnowledgeTeamUploadExecutionApprovalRecord['target'];
  sourceApprovalRequest: KnowledgeTeamUploadExecutionApprovalRecord['sourceApprovalRequest'];
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const SAFE_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const APPROVAL_REQUEST_FINGERPRINT_FIELD_COUNT = 16;
const APPROVAL_RECORD_FINGERPRINT_FIELD_COUNT = 14;
const FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN = /(artifactBytesValue|artifactBytesBase64|artifactBytesContent|artifactBytesPayload|artifactContent|artifactPayload|rawArtifact|byteBuffer|bytesBase64|contentBase64|buffer|stream|arrayBuffer|blob|readPath|filePath|localPath|artifactPath|serializedPayload|stagedBytes)/i;
const FORBIDDEN_CLIENT_KEY_PATTERN = /(clientInstance|clientObject|clientValue|clientFactoryValue|clientDescriptorValue|clientConfig|adapterClient|^sdkClient$|sdkClientConfig|signedUrl)/i;
const FORBIDDEN_CREDENTIAL_KEY_PATTERN = /(^credentialValue$|credentialValuePayload|credentialValueMaterial|credentialMaterial|credentialFile|credentialPath|credentialsPath|secretValue|envValue|processEnv|presenceCheckResult|^credentialPresenceResult$|credentialPresenceResult(?:Value|Payload|Material|Data|Body|Response)|credentialPresenceSignalValue)/i;
const FORBIDDEN_LIVE_CHECK_KEY_PATTERN = /(^liveCheckResult$|liveCheckResult(?:Value|Payload|Material|Data|Body)|liveCheckResponse|liveCheckProbe|liveCheckRequest|liveBackendProbe|headObjectResult|headIndexResult|remoteProbeResult|connectivityResult|healthCheckResult)/i;
const FORBIDDEN_COMMAND_KEY_PATTERN = /(^uploadCommandValue$|^uploadCommandPayload$|^uploadCommandMaterial$|^uploadCommandData$|^uploadCommandBody$|^uploadCommandLine$|^commandLine$|^shellCommand$|^signedUploadCommand$)/i;
const FORBIDDEN_ADAPTER_KEY_PATTERN = /(adapterInstance|adapterObject|adapterValue|adapterDescriptorValue)/i;
const FORBIDDEN_OBJECT_STORE_HANDLE_KEY_PATTERN = /(^objectStoreBinding$|objectStoreBinding(?:Handle|Instance|Client|Value|Payload|Material)|^objectStoreHandle$|objectStoreHandle(?:Value|Payload|Material|Instance|Client)|objectStoreInstance|objectStoreClient|artifactObjectStoreHandle|putObject|writeObject)/i;
const FORBIDDEN_METADATA_INDEX_HANDLE_KEY_PATTERN = /(^metadataIndexBinding$|metadataIndexBinding(?:Handle|Instance|Client|Value|Payload|Material)|^metadataIndexHandle$|metadataIndexHandle(?:Value|Payload|Material|Instance|Client)|metadataIndexInstance|metadataIndexClient|putEntry|writeIndex|indexEntryPayload|indexEntryValue)/i;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|secret|password|authorization|header|accessKey|sessionToken|tokenValue|tokenMaterial|leaseValue|leaseMaterial|rollbackValue|rollbackMaterial|rollbackCommand|auditValue|auditMaterial|auditCommand)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|kubectl |curl |secret|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;

const DISABLED_SOURCE_REQUEST_FIELDS = [
  'uploadApproved',
  'uploadExecutionApproved',
  'uploadExecutionAllowed',
  'mutationApprovalGranted',
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
  'remoteMutationPerformed',
  'executable'
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBool(value: unknown): boolean {
  return value === true;
}

function addBlocker(
  blockers: KnowledgeTeamUploadExecutionApprovalRecordBlocker[],
  code: KnowledgeTeamUploadExecutionApprovalRecordBlockerCode,
  path: string,
  message: string
): void {
  blockers.push({ code, path, message });
}

function scanForPrivateDetails(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadExecutionApprovalRecordBlocker[]
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForPrivateDetails(entry, `${path}[${index}]`, blockers));
    return;
  }
  if (!isRecord(value)) {
    if (typeof value === 'string' && FORBIDDEN_LEAK_VALUE_PATTERN.test(value)) {
      addBlocker(blockers, 'backend-detail-leak', path, 'Upload execution approval record input must not contain backend details, private paths, credentials, executable commands, live-check results, object/index handles, or raw artifact content.');
    }
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    if (key === 'objectKey') {
      addBlocker(blockers, 'unsafe-artifact-reference', entryPath, 'Upload execution approval record input must not contain target object keys.');
      continue;
    }
    if (FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'artifact-bytes-provided', entryPath, 'Upload execution approval record input must not contain raw bytes, byte buffers, streams, content payloads, or local artifact paths.');
      continue;
    }
    if (FORBIDDEN_CLIENT_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'client-dependency-leak', entryPath, 'Upload execution approval record input must not contain SDK clients, client configs, signed URLs, or write functions.');
      continue;
    }
    if (FORBIDDEN_CREDENTIAL_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'credential-dependency-leak', entryPath, 'Upload execution approval record input must not contain credential values, credential files, environment reads, or credential presence results.');
      continue;
    }
    if (FORBIDDEN_LIVE_CHECK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'live-check-enabled', entryPath, 'Upload execution approval record input must not contain live backend probes, live-check requests, or live-check results.');
      continue;
    }
    if (FORBIDDEN_COMMAND_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'upload-command-present', entryPath, 'Upload execution approval record input must not contain upload command payloads or executable command material.');
      continue;
    }
    if (FORBIDDEN_ADAPTER_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'adapter-dependency-leak', entryPath, 'Upload execution approval record input must not contain adapter instances or concrete adapter values.');
      continue;
    }
    if (FORBIDDEN_OBJECT_STORE_HANDLE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'object-store-handle-leak', entryPath, 'Upload execution approval record input must not contain object store handles or object write functions.');
      continue;
    }
    if (FORBIDDEN_METADATA_INDEX_HANDLE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'metadata-index-handle-leak', entryPath, 'Upload execution approval record input must not contain metadata index handles, metadata index entries, or index write functions.');
      continue;
    }
    if (FORBIDDEN_LEAK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'backend-detail-leak', entryPath, 'Upload execution approval record input must not contain backend details, credential fields, commands, token/lease material, rollback material, audit material, or raw artifact content.');
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

function readRequestStatus(value: unknown): ParsedExecutionApprovalRequestForRecord['requestStatus'] {
  if (value === 'upload-execution-approval-request-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readRequestKind(value: unknown): ParsedExecutionApprovalRequestForRecord['requestKind'] {
  if (value === 'upload-execution-approval-request-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readRequestNextAction(value: unknown): ParsedExecutionApprovalRequestForRecord['requestNextAction'] {
  if (value === 'record-human-upload-execution-approval' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readSourceExecutionReadinessStatus(value: unknown): KnowledgeTeamUploadExecutionApprovalRecord['sourceApprovalRequest']['sourceExecutionReadinessStatus'] {
  if (value === 'upload-execution-readiness-boundary-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readSourceExecutionReadinessKind(value: unknown): KnowledgeTeamUploadExecutionApprovalRecord['sourceApprovalRequest']['sourceExecutionReadinessKind'] {
  if (value === 'upload-execution-readiness-boundary-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readSourceExecutionReadinessNextAction(value: unknown): KnowledgeTeamUploadExecutionApprovalRecord['sourceApprovalRequest']['sourceExecutionReadinessNextAction'] {
  if (value === 'request-separate-upload-execution-approval' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readReviewStatus(value: unknown): KnowledgeTeamUploadExecutionApprovalRecord['sourceApprovalRequest']['reviewStatus'] {
  if (value === 'review-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readReviewKind(value: unknown): KnowledgeTeamUploadExecutionApprovalRecord['sourceApprovalRequest']['reviewKind'] {
  if (value === 'human-fingerprint-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readAdapterBackendKind(value: unknown): KnowledgeTeamUploadExecutionApprovalRecord['sourceApprovalRequest']['adapterBackendKind'] {
  if (value === 'mock-s3-compatible' || value === 's3-compatible') {
    return value;
  }
  return 'unsupported';
}

function readSafeRequestFingerprint(
  value: unknown
): KnowledgeTeamUploadExecutionApprovalRecord['sourceApprovalRequest']['requestFingerprint'] {
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

function blockerCodeForFalseField(key: string): KnowledgeTeamUploadExecutionApprovalRecordBlockerCode {
  if (key === 'uploadApproved') return 'upload-approval-already-provided';
  if (key === 'uploadExecutionApproved') return 'upload-execution-approval-already-provided';
  if (key === 'uploadExecutionAllowed') return 'upload-execution-enabled';
  if (key === 'mutationApprovalGranted') return 'mutation-approval-already-granted';
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
  blockers: KnowledgeTeamUploadExecutionApprovalRecordBlocker[]
): void {
  if (value[key] === true) {
    addBlocker(blockers, blockerCodeForFalseField(key), `${path}.${key}`, `${key} must remain false when recording human upload execution approval.`);
  }
}

function emptyTarget(): KnowledgeTeamUploadExecutionApprovalRecord['target'] {
  return {
    manifestId: null,
    objectKeyRedacted: true,
    objectSha256: null,
    artifactId: null
  };
}

function emptySourceApprovalRequest(): KnowledgeTeamUploadExecutionApprovalRecord['sourceApprovalRequest'] {
  return {
    source: 'upload-execution-approval-request',
    requestStatus: 'invalid',
    requestKind: 'unsupported',
    requestNextAction: 'invalid',
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
    requestFingerprint: {
      algorithm: 'unsupported',
      scope: 'unsupported',
      value: null,
      canonicalFieldCount: null
    },
    executionReadinessModeled: false,
    separateExecutionApprovalRequired: false,
    objectWriteRequiresExecutionApproval: false,
    metadataIndexWriteRequiresExecutionApproval: false,
    uploadApproved: false,
    uploadExecutionApproved: false,
    uploadExecutionAllowed: false,
    mutationApprovalGranted: false,
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
    remoteMutationPerformed: false,
    executable: false
  };
}

function emptyParsedExecutionApprovalRequest(): ParsedExecutionApprovalRequestForRecord {
  return {
    requestStatus: 'invalid',
    requestKind: 'unsupported',
    requestNextAction: 'invalid',
    target: emptyTarget(),
    sourceApprovalRequest: emptySourceApprovalRequest()
  };
}

function parseTarget(
  value: unknown,
  blockers: KnowledgeTeamUploadExecutionApprovalRecordBlocker[]
): KnowledgeTeamUploadExecutionApprovalRecord['target'] {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.executionApprovalRequest.target', 'Upload execution approval record requires a target object.');
    addBlocker(blockers, 'unsafe-artifact-reference', '$.executionApprovalRequest.target', 'Upload execution approval record requires safe target references.');
    return emptyTarget();
  }

  const manifestId = readSafeId(value.manifestId);
  const objectSha256 = readSafeSha256(value.objectSha256);
  const artifactId = readSafeId(value.artifactId);

  if (Object.hasOwn(value, 'objectKey') || value.objectKeyRedacted !== true || manifestId === null || objectSha256 === null || artifactId === null) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.executionApprovalRequest.target', 'Upload execution approval record requires redacted object keys and safe manifest, hash, and artifact references.');
  }

  return {
    manifestId,
    objectKeyRedacted: true,
    objectSha256,
    artifactId
  };
}

function validateSourceApprovalRequestReadiness(
  value: Record<string, unknown>,
  sourceApprovalRequest: KnowledgeTeamUploadExecutionApprovalRecord['sourceApprovalRequest'],
  blockers: KnowledgeTeamUploadExecutionApprovalRecordBlocker[]
): void {
  if (value.kind !== 'infra-agent.knowledge-team-upload-execution-approval-request') {
    addBlocker(blockers, 'invalid-execution-approval-request-kind', '$.executionApprovalRequest.kind', 'Upload execution approval record requires an infra-agent.knowledge-team-upload-execution-approval-request artifact.');
  }
  if (value.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.executionApprovalRequest.schemaVersion', 'Upload execution approval record requires schemaVersion 1.');
  }
  if (value.requestKind !== 'upload-execution-approval-request-dry-run') {
    addBlocker(blockers, 'invalid-request-kind', '$.executionApprovalRequest.requestKind', 'Upload execution approval record requires an upload-execution-approval-request-dry-run source.');
  }
  if (value.status !== 'upload-execution-approval-request-ready') {
    addBlocker(blockers, 'execution-approval-request-not-ready', '$.executionApprovalRequest.status', 'Upload execution approval record requires upload-execution-approval-request-ready input.');
  }
  if (!isRecord(value.readiness) || value.readiness.nextAction !== 'record-human-upload-execution-approval') {
    addBlocker(blockers, 'execution-approval-request-next-action-invalid', '$.executionApprovalRequest.readiness.nextAction', 'Execution approval request must ask to record human upload execution approval.');
  }
  if (isRecord(value.readiness) && value.readiness.blockerCount !== 0) {
    addBlocker(blockers, 'execution-approval-request-not-ready', '$.executionApprovalRequest.readiness.blockerCount', 'Upload execution approval record requires an unblocked execution approval request.');
  }
  if (value.uploadCommand !== null) {
    addBlocker(blockers, 'upload-command-present', '$.executionApprovalRequest.uploadCommand', 'Upload execution approval record must not receive upload commands.');
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
    'remoteMutationPerformed'
  ]) {
    checkFalseField(value, key, '$.executionApprovalRequest', blockers);
  }
  checkFalseField(value, 'liveCheckAllowed', '$.executionApprovalRequest', blockers);
  checkFalseField(value, 'credentialValuesExposed', '$.executionApprovalRequest', blockers);
  checkFalseField(value, 'credentialPresenceChecked', '$.executionApprovalRequest', blockers);

  if (sourceApprovalRequest.requestStatus !== 'upload-execution-approval-request-ready') {
    addBlocker(blockers, 'execution-approval-request-not-ready', '$.executionApprovalRequest.status', 'Upload execution approval record requires a ready approval request source.');
  }
  if (sourceApprovalRequest.requestKind !== 'upload-execution-approval-request-dry-run') {
    addBlocker(blockers, 'invalid-request-kind', '$.executionApprovalRequest.requestKind', 'Upload execution approval record requires a dry-run approval request source.');
  }
  if (sourceApprovalRequest.requestNextAction !== 'record-human-upload-execution-approval') {
    addBlocker(blockers, 'execution-approval-request-next-action-invalid', '$.executionApprovalRequest.readiness.nextAction', 'Upload execution approval record requires the human approval record next action.');
  }
  if (sourceApprovalRequest.sourceExecutionReadinessStatus !== 'upload-execution-readiness-boundary-ready') {
    addBlocker(blockers, 'execution-approval-request-not-ready', '$.executionApprovalRequest.sourceExecutionReadinessBoundary.boundaryStatus', 'Upload execution approval record requires a ready source execution readiness boundary.');
  }
  if (sourceApprovalRequest.sourceExecutionReadinessKind !== 'upload-execution-readiness-boundary-dry-run') {
    addBlocker(blockers, 'invalid-request-kind', '$.executionApprovalRequest.sourceExecutionReadinessBoundary.boundaryKind', 'Upload execution approval record requires a dry-run source execution readiness boundary.');
  }
  if (sourceApprovalRequest.sourceExecutionReadinessNextAction !== 'request-separate-upload-execution-approval') {
    addBlocker(blockers, 'execution-approval-request-next-action-invalid', '$.executionApprovalRequest.sourceExecutionReadinessBoundary.boundaryNextAction', 'Source execution readiness must have requested separate upload execution approval.');
  }
  if (sourceApprovalRequest.reviewStatus !== 'review-ready' || sourceApprovalRequest.reviewKind !== 'human-fingerprint-dry-run') {
    addBlocker(blockers, 'review-fingerprint-unverified', '$.executionApprovalRequest.sourceExecutionReadinessBoundary', 'Upload execution approval record requires the source human fingerprint review to be ready.');
  }
  if (!sourceApprovalRequest.scopeMatched) {
    addBlocker(blockers, 'scope-not-matched', '$.executionApprovalRequest.sourceExecutionReadinessBoundary.scopeMatched', 'Upload execution approval record requires matched source scope.');
  }
  if (!sourceApprovalRequest.humanReviewRecorded || !sourceApprovalRequest.sourceFingerprintVerified || !sourceApprovalRequest.sourceArtifactFingerprintVerified) {
    addBlocker(blockers, 'review-fingerprint-unverified', '$.executionApprovalRequest.sourceExecutionReadinessBoundary', 'Upload execution approval record requires verified source fingerprints.');
  }
  if (sourceApprovalRequest.adapterName === null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.executionApprovalRequest.sourceExecutionReadinessBoundary.adapterName', 'Upload execution approval record requires a safe adapter name.');
  }
  if (sourceApprovalRequest.adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.executionApprovalRequest.sourceExecutionReadinessBoundary.adapterBackendKind', 'Upload execution approval record remains mock-backend only.');
  }
  for (const key of [
    'executionReadinessModeled',
    'separateExecutionApprovalRequired',
    'objectWriteRequiresExecutionApproval',
    'metadataIndexWriteRequiresExecutionApproval'
  ] as const) {
    if (!sourceApprovalRequest[key]) {
      addBlocker(blockers, 'missing-required-field', `$.executionApprovalRequest.sourceExecutionReadinessBoundary.${key}`, `${key} must be true before recording human upload execution approval.`);
    }
  }
  for (const key of DISABLED_SOURCE_REQUEST_FIELDS) {
    if (sourceApprovalRequest[key]) {
      addBlocker(blockers, blockerCodeForFalseField(key), `$.executionApprovalRequest.sourceExecutionReadinessBoundary.${key}`, `${key} must remain false when recording human upload execution approval.`);
    }
  }
  if (!sourceApprovalRequest.requestIssued) {
    addBlocker(blockers, 'missing-required-field', '$.executionApprovalRequest.approvalRequest.requestIssued', 'Upload execution approval record requires an issued approval request.');
  }
  if (sourceApprovalRequest.requestHumanApprovalRecorded) {
    addBlocker(blockers, 'approval-already-recorded', '$.executionApprovalRequest.approvalRequest.humanApprovalRecorded', 'Upload execution approval record requires a source request without an existing human approval record.');
  }
  if (sourceApprovalRequest.requestApprovalGranted) {
    addBlocker(blockers, 'approval-already-granted', '$.executionApprovalRequest.approvalRequest.approvalGranted', 'Upload execution approval record must not consume an approval-granted source request.');
  }
  if (sourceApprovalRequest.requestFingerprintVerified) {
    addBlocker(blockers, 'approval-already-recorded', '$.executionApprovalRequest.approvalRequest.fingerprintVerified', 'Upload execution approval record requires a source request whose human approval fingerprint has not already been recorded.');
  }
  if (sourceApprovalRequest.requestFingerprint.algorithm !== 'sha256'
    || sourceApprovalRequest.requestFingerprint.scope !== 'stage-knowledge-pack-upload-execution-approval-request-v1'
    || sourceApprovalRequest.requestFingerprint.canonicalFieldCount !== APPROVAL_REQUEST_FINGERPRINT_FIELD_COUNT) {
    addBlocker(blockers, 'approval-request-fingerprint-unsupported', '$.executionApprovalRequest.approvalRequest.fingerprint', 'Upload execution approval record requires a supported approval request fingerprint.');
  }
  if (sourceApprovalRequest.requestFingerprint.value === null) {
    addBlocker(blockers, 'approval-request-fingerprint-missing', '$.executionApprovalRequest.approvalRequest.fingerprint.value', 'Upload execution approval record requires a safe source approval request fingerprint.');
  }
}

function parseExecutionApprovalRequestForRecord(
  value: unknown,
  blockers: KnowledgeTeamUploadExecutionApprovalRecordBlocker[]
): ParsedExecutionApprovalRequestForRecord {
  scanForPrivateDetails(value, '$.executionApprovalRequest', blockers);
  if (!isRecord(value)) {
    addBlocker(blockers, 'invalid-execution-approval-request-kind', '$.executionApprovalRequest', 'Upload execution approval record requires a saved execution approval request artifact.');
    return emptyParsedExecutionApprovalRequest();
  }

  const sourceBoundary = isRecord(value.sourceExecutionReadinessBoundary) ? value.sourceExecutionReadinessBoundary : {};
  const approvalRequest = isRecord(value.approvalRequest) ? value.approvalRequest : {};
  const requestFingerprint = readSafeRequestFingerprint(approvalRequest.fingerprint);
  const adapterName = typeof sourceBoundary.adapterName === 'string' && isSafeKnowledgeTeamBackendAdapterName(sourceBoundary.adapterName)
    ? sourceBoundary.adapterName
    : null;
  if (sourceBoundary.adapterName !== null && sourceBoundary.adapterName !== undefined && adapterName === null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.executionApprovalRequest.sourceExecutionReadinessBoundary.adapterName', 'Upload execution approval record requires a safe adapter name.');
  }

  if (!isRecord(value.sourceExecutionReadinessBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.executionApprovalRequest.sourceExecutionReadinessBoundary', 'Upload execution approval record requires source execution readiness metadata.');
  }
  if (!isRecord(value.approvalRequest)) {
    addBlocker(blockers, 'missing-required-field', '$.executionApprovalRequest.approvalRequest', 'Upload execution approval record requires approval request metadata.');
  }

  const sourceApprovalRequest = {
    ...emptySourceApprovalRequest(),
    source: 'upload-execution-approval-request' as const,
    requestStatus: readRequestStatus(value.status),
    requestKind: readRequestKind(value.requestKind),
    requestNextAction: isRecord(value.readiness) ? readRequestNextAction(value.readiness.nextAction) : 'invalid' as const,
    sourceExecutionReadinessStatus: readSourceExecutionReadinessStatus(sourceBoundary.boundaryStatus),
    sourceExecutionReadinessKind: readSourceExecutionReadinessKind(sourceBoundary.boundaryKind),
    sourceExecutionReadinessNextAction: readSourceExecutionReadinessNextAction(sourceBoundary.boundaryNextAction),
    reviewStatus: readReviewStatus(sourceBoundary.reviewStatus),
    reviewKind: readReviewKind(sourceBoundary.reviewKind),
    scopeMatched: readBool(sourceBoundary.scopeMatched),
    humanReviewRecorded: readBool(sourceBoundary.humanReviewRecorded),
    sourceFingerprintVerified: readBool(sourceBoundary.fingerprintVerified),
    sourceArtifactFingerprintVerified: readBool(sourceBoundary.sourceFingerprintVerified),
    adapterName,
    adapterBackendKind: readAdapterBackendKind(sourceBoundary.adapterBackendKind),
    requestIssued: readBool(approvalRequest.requestIssued),
    requestHumanApprovalRecorded: readBool(approvalRequest.humanApprovalRecorded),
    requestApprovalGranted: readBool(approvalRequest.approvalGranted),
    requestFingerprintVerified: readBool(approvalRequest.fingerprintVerified),
    requestFingerprint,
    executionReadinessModeled: readBool(sourceBoundary.executionReadinessModeled),
    separateExecutionApprovalRequired: readBool(sourceBoundary.separateExecutionApprovalRequired),
    objectWriteRequiresExecutionApproval: readBool(sourceBoundary.objectWriteRequiresExecutionApproval),
    metadataIndexWriteRequiresExecutionApproval: readBool(sourceBoundary.metadataIndexWriteRequiresExecutionApproval)
  };
  for (const key of DISABLED_SOURCE_REQUEST_FIELDS) {
    sourceApprovalRequest[key] = readBool(sourceBoundary[key]);
  }

  validateSourceApprovalRequestReadiness(value, sourceApprovalRequest, blockers);

  return {
    requestStatus: sourceApprovalRequest.requestStatus,
    requestKind: sourceApprovalRequest.requestKind,
    requestNextAction: sourceApprovalRequest.requestNextAction,
    target: parseTarget(value.target, blockers),
    sourceApprovalRequest
  };
}

function normalizeApprovalFingerprint(
  value: unknown,
  expectedFingerprint: string | null,
  blockers: KnowledgeTeamUploadExecutionApprovalRecordBlocker[]
): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    addBlocker(blockers, 'approval-fingerprint-missing', '$.approvalFingerprint', 'Upload execution approval record requires --approval-fingerprint.');
    return null;
  }
  if (!SAFE_FINGERPRINT_PATTERN.test(value)) {
    addBlocker(blockers, 'unsafe-approval-fingerprint', '$.approvalFingerprint', 'Upload execution approval record requires a lowercase SHA-256 approval fingerprint.');
    return null;
  }
  if (expectedFingerprint !== null && value !== expectedFingerprint) {
    addBlocker(blockers, 'approval-fingerprint-mismatch', '$.approvalFingerprint', 'Supplied approval fingerprint must match the approval request fingerprint.');
  }
  return value;
}

function computeApprovalRecordFingerprint(input: {
  enabled: boolean;
  target: KnowledgeTeamUploadExecutionApprovalRecord['target'];
  expectedFingerprint: string | null;
  suppliedFingerprint: string | null;
}): KnowledgeTeamUploadExecutionApprovalRecord['approvalRecord']['recordFingerprint'] {
  if (!input.enabled
    || input.target.manifestId === null
    || input.target.objectSha256 === null
    || input.target.artifactId === null
    || input.expectedFingerprint === null
    || input.suppliedFingerprint === null) {
    return {
      algorithm: 'sha256',
      scope: 'stage-knowledge-pack-upload-execution-approval-record-v1',
      value: null,
      canonicalFieldCount: APPROVAL_RECORD_FINGERPRINT_FIELD_COUNT
    };
  }

  const canonicalFields = [
    ['scope', 'stage-knowledge-pack-upload-execution-approval-record-v1'],
    ['plannedOperation', 'stage-knowledge-pack'],
    ['sourceKind', 'infra-agent.knowledge-team-upload-execution-approval-request'],
    ['sourceStatus', 'upload-execution-approval-request-ready'],
    ['sourceNextAction', 'record-human-upload-execution-approval'],
    ['manifestId', input.target.manifestId],
    ['objectSha256', input.target.objectSha256],
    ['artifactId', input.target.artifactId],
    ['expectedFingerprint', input.expectedFingerprint],
    ['suppliedFingerprint', input.suppliedFingerprint],
    ['fingerprintVerified', 'true'],
    ['humanApprovalRecorded', 'true'],
    ['uploadExecutionAllowed', 'false'],
    ['schemaVersion', '1']
  ];

  return {
    algorithm: 'sha256',
    scope: 'stage-knowledge-pack-upload-execution-approval-record-v1',
    value: createHash('sha256')
      .update(JSON.stringify(canonicalFields))
      .digest('hex'),
    canonicalFieldCount: APPROVAL_RECORD_FINGERPRINT_FIELD_COUNT
  };
}

export function buildKnowledgeTeamUploadExecutionApprovalRecord(
  input: KnowledgeTeamUploadExecutionApprovalRecordInput
): KnowledgeTeamUploadExecutionApprovalRecord {
  const blockers: KnowledgeTeamUploadExecutionApprovalRecordBlocker[] = [];
  const parsedRequest = parseExecutionApprovalRequestForRecord(input.executionApprovalRequest, blockers);
  const expectedFingerprint = parsedRequest.sourceApprovalRequest.requestFingerprint.value;
  const suppliedFingerprint = normalizeApprovalFingerprint(input.approvalFingerprint, expectedFingerprint, blockers);
  const status: KnowledgeTeamUploadExecutionApprovalRecordStatus = blockers.length === 0
    ? 'upload-execution-approval-record-ready'
    : 'blocked';
  const recordReady = status === 'upload-execution-approval-record-ready';
  const recordFingerprint = computeApprovalRecordFingerprint({
    enabled: recordReady,
    target: parsedRequest.target,
    expectedFingerprint,
    suppliedFingerprint
  });

  return {
    kind: 'infra-agent.knowledge-team-upload-execution-approval-record',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    recordKind: 'human-upload-execution-approval-record-dry-run',
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
    target: parsedRequest.target,
    sourceApprovalRequest: parsedRequest.sourceApprovalRequest,
    approvalRecord: {
      uploadExecutionApprovalRequired: true,
      humanApprovalRequired: true,
      humanApprovalRecorded: recordReady,
      approvalGranted: false,
      source: recordReady ? 'cli-flag' : null,
      suppliedFingerprint,
      expectedFingerprint,
      fingerprintVerified: recordReady,
      sourceRequestFingerprint: parsedRequest.sourceApprovalRequest.requestFingerprint,
      recordFingerprint,
      uploadApproved: false,
      uploadExecutionApproved: false,
      uploadExecutionAllowed: false,
      mutationApprovalGranted: false
    },
    executionBoundary: {
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
    },
    readiness: {
      status,
      nextAction: status === 'upload-execution-approval-record-ready' ? 'design-upload-execution-authorization-boundary' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: blockers.map(entry => entry.code),
      blockers,
      reason: status === 'upload-execution-approval-record-ready'
        ? 'Human upload execution approval fingerprint was recorded, but upload execution remains disabled until a later authorization boundary.'
        : 'Human upload execution approval record is blocked until approval request and fingerprint blockers are resolved.'
    }
  };
}
