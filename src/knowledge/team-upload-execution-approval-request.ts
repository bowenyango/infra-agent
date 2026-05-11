import { createHash } from 'node:crypto';
import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadExecutionApprovalRequestStatus =
  | 'upload-execution-approval-request-ready'
  | 'blocked';

export type KnowledgeTeamUploadExecutionApprovalRequestNextAction =
  | 'record-human-upload-execution-approval'
  | 'resolve-blockers';

export type KnowledgeTeamUploadExecutionApprovalRequestBlockerCode =
  | 'adapter-dependency-leak'
  | 'adapter-injected'
  | 'artifact-bytes-provided'
  | 'artifact-object-store-bound'
  | 'audit-record-created'
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
  | 'execution-readiness-boundary-next-action-invalid'
  | 'execution-readiness-boundary-not-ready'
  | 'invalid-execution-readiness-boundary-kind'
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
  | 'unsupported-adapter-backend'
  | 'unsafe-adapter-name'
  | 'unsafe-artifact-reference'
  | 'unsafe-approval-fingerprint'
  | 'upload-approval-already-provided'
  | 'upload-command-exposed'
  | 'upload-command-generated'
  | 'upload-command-present'
  | 'upload-execution-approval-already-provided'
  | 'upload-execution-enabled'
  | 'write-token-issued';

export interface KnowledgeTeamUploadExecutionApprovalRequestBlocker {
  code: KnowledgeTeamUploadExecutionApprovalRequestBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadExecutionApprovalRequest {
  kind: 'infra-agent.knowledge-team-upload-execution-approval-request';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  requestKind: 'upload-execution-approval-request-dry-run';
  status: KnowledgeTeamUploadExecutionApprovalRequestStatus;
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
  sourceExecutionReadinessBoundary: {
    source: 'upload-execution-readiness-boundary';
    boundaryStatus: 'upload-execution-readiness-boundary-ready' | 'blocked' | 'invalid';
    boundaryKind: 'upload-execution-readiness-boundary-dry-run' | 'unsupported';
    boundaryNextAction: 'request-separate-upload-execution-approval' | 'resolve-blockers' | 'invalid';
    reviewStatus: 'review-ready' | 'blocked' | 'invalid';
    reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
    scopeMatched: boolean;
    humanReviewRecorded: boolean;
    fingerprintVerified: boolean;
    sourceFingerprintVerified: boolean;
    adapterName: string | null;
    adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
    executionReadinessModeled: boolean;
    objectIndexBindingBoundaryRequired: boolean;
    artifactBytesBoundaryRequired: boolean;
    adapterInjectionBoundaryRequired: boolean;
    clientCreationBoundaryRequired: boolean;
    credentialReadBoundaryRequired: boolean;
    credentialPresenceBoundaryRequired: boolean;
    liveCheckBoundaryRequired: boolean;
    uploadCommandBoundaryRequired: boolean;
    objectStoreBindingRequired: boolean;
    metadataIndexBindingRequired: boolean;
    writeTokenRequired: boolean;
    executionLeaseRequired: boolean;
    rollbackPlanRequired: boolean;
    auditRecordRequired: boolean;
    objectWriteRequiresExecutionApproval: boolean;
    metadataIndexWriteRequiresExecutionApproval: boolean;
    explicitUploadApprovalRequired: boolean;
    separateExecutionApprovalRequired: boolean;
    mutationApprovalRequired: boolean;
    commandExecutionApprovalRequired: boolean;
    contentAddressedObjectKeysRequired: boolean;
    contentAddressedIndexKeysRequired: boolean;
    idempotentObjectWriteRequired: boolean;
    idempotentMetadataIndexWriteRequired: boolean;
    uploadApproved: boolean;
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
  approvalRequest: {
    uploadExecutionApprovalRequired: true;
    humanApprovalRequired: true;
    humanApprovalRecorded: false;
    approvalGranted: false;
    requestIssued: boolean;
    source: 'execution-readiness-boundary';
    fingerprint: {
      algorithm: 'sha256';
      scope: 'stage-knowledge-pack-upload-execution-approval-request-v1';
      value: string | null;
      canonicalFieldCount: number;
    };
    fingerprintVerified: false;
    approvalSource: null;
    suppliedFingerprint: null;
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
    status: KnowledgeTeamUploadExecutionApprovalRequestStatus;
    nextAction: KnowledgeTeamUploadExecutionApprovalRequestNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadExecutionApprovalRequestBlockerCode[];
    blockers: KnowledgeTeamUploadExecutionApprovalRequestBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadExecutionApprovalRequestInput {
  executionReadinessBoundary: unknown;
}

interface ParsedExecutionReadinessBoundaryForApprovalRequest {
  boundaryStatus: 'upload-execution-readiness-boundary-ready' | 'blocked' | 'invalid';
  boundaryKind: 'upload-execution-readiness-boundary-dry-run' | 'unsupported';
  boundaryNextAction: 'request-separate-upload-execution-approval' | 'resolve-blockers' | 'invalid';
  sourceExecutionReadinessBoundary: KnowledgeTeamUploadExecutionApprovalRequest['sourceExecutionReadinessBoundary'];
  target: KnowledgeTeamUploadExecutionApprovalRequest['target'];
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const SAFE_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const APPROVAL_REQUEST_FINGERPRINT_FIELD_COUNT = 16;
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

const REQUIRED_SOURCE_READINESS_FIELDS = [
  'dryRunOnly',
  'executionReadinessModeled',
  'objectIndexBindingBoundaryRequired',
  'artifactBytesBoundaryRequired',
  'adapterInjectionBoundaryRequired',
  'clientCreationBoundaryRequired',
  'credentialReadBoundaryRequired',
  'credentialPresenceBoundaryRequired',
  'liveCheckBoundaryRequired',
  'uploadCommandBoundaryRequired',
  'objectStoreBindingRequired',
  'metadataIndexBindingRequired',
  'writeTokenRequired',
  'executionLeaseRequired',
  'rollbackPlanRequired',
  'auditRecordRequired',
  'objectWriteRequiresExecutionApproval',
  'metadataIndexWriteRequiresExecutionApproval',
  'explicitUploadApprovalRequired',
  'separateExecutionApprovalRequired',
  'mutationApprovalRequired',
  'commandExecutionApprovalRequired',
  'contentAddressedObjectKeysRequired',
  'contentAddressedIndexKeysRequired',
  'idempotentObjectWriteRequired',
  'idempotentMetadataIndexWriteRequired'
] as const;

const DISABLED_SOURCE_READINESS_FIELDS = [
  'uploadApproved',
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
  blockers: KnowledgeTeamUploadExecutionApprovalRequestBlocker[],
  code: KnowledgeTeamUploadExecutionApprovalRequestBlockerCode,
  path: string,
  message: string
): void {
  blockers.push({ code, path, message });
}

function scanForPrivateDetails(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadExecutionApprovalRequestBlocker[]
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForPrivateDetails(entry, `${path}[${index}]`, blockers));
    return;
  }
  if (!isRecord(value)) {
    if (typeof value === 'string' && FORBIDDEN_LEAK_VALUE_PATTERN.test(value)) {
      addBlocker(blockers, 'backend-detail-leak', path, 'Upload execution approval request input must not contain backend details, private paths, credentials, executable commands, live-check results, object/index handles, or raw artifact content.');
    }
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    if (key === 'objectKey') {
      addBlocker(blockers, 'unsafe-artifact-reference', entryPath, 'Upload execution approval request input must not contain target object keys.');
      continue;
    }
    if (FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'artifact-bytes-provided', entryPath, 'Upload execution approval request input must not contain raw bytes, byte buffers, streams, content payloads, or local artifact paths.');
      continue;
    }
    if (FORBIDDEN_CLIENT_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'client-dependency-leak', entryPath, 'Upload execution approval request input must not contain SDK clients, client configs, signed URLs, or write functions.');
      continue;
    }
    if (FORBIDDEN_CREDENTIAL_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'credential-dependency-leak', entryPath, 'Upload execution approval request input must not contain credential values, credential files, environment reads, or credential presence results.');
      continue;
    }
    if (FORBIDDEN_LIVE_CHECK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'live-check-enabled', entryPath, 'Upload execution approval request input must not contain live backend probes, live-check requests, or live-check results.');
      continue;
    }
    if (FORBIDDEN_COMMAND_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'upload-command-present', entryPath, 'Upload execution approval request input must not contain upload command payloads or executable command material.');
      continue;
    }
    if (FORBIDDEN_ADAPTER_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'adapter-dependency-leak', entryPath, 'Upload execution approval request input must not contain adapter instances or concrete adapter values.');
      continue;
    }
    if (FORBIDDEN_OBJECT_STORE_HANDLE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'object-store-handle-leak', entryPath, 'Upload execution approval request input must not contain object store handles or object write functions.');
      continue;
    }
    if (FORBIDDEN_METADATA_INDEX_HANDLE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'metadata-index-handle-leak', entryPath, 'Upload execution approval request input must not contain metadata index handles, metadata index entries, or index write functions.');
      continue;
    }
    if (FORBIDDEN_LEAK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'backend-detail-leak', entryPath, 'Upload execution approval request input must not contain backend details, credential fields, commands, token/lease material, rollback material, audit material, or raw artifact content.');
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

function readBoundaryStatus(value: unknown): ParsedExecutionReadinessBoundaryForApprovalRequest['boundaryStatus'] {
  if (value === 'upload-execution-readiness-boundary-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readBoundaryKind(value: unknown): ParsedExecutionReadinessBoundaryForApprovalRequest['boundaryKind'] {
  if (value === 'upload-execution-readiness-boundary-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readBoundaryNextAction(value: unknown): ParsedExecutionReadinessBoundaryForApprovalRequest['boundaryNextAction'] {
  if (value === 'request-separate-upload-execution-approval' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readReviewStatus(value: unknown): KnowledgeTeamUploadExecutionApprovalRequest['sourceExecutionReadinessBoundary']['reviewStatus'] {
  if (value === 'review-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readReviewKind(value: unknown): KnowledgeTeamUploadExecutionApprovalRequest['sourceExecutionReadinessBoundary']['reviewKind'] {
  if (value === 'human-fingerprint-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readAdapterBackendKind(value: unknown): KnowledgeTeamUploadExecutionApprovalRequest['sourceExecutionReadinessBoundary']['adapterBackendKind'] {
  if (value === 'mock-s3-compatible' || value === 's3-compatible') {
    return value;
  }
  return 'unsupported';
}

function parseTarget(
  value: unknown,
  blockers: KnowledgeTeamUploadExecutionApprovalRequestBlocker[]
): KnowledgeTeamUploadExecutionApprovalRequest['target'] {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.executionReadinessBoundary.target', 'Upload execution approval request requires a target object.');
    addBlocker(blockers, 'unsafe-artifact-reference', '$.executionReadinessBoundary.target', 'Upload execution approval request requires safe target references.');
    return {
      manifestId: null,
      objectKeyRedacted: true,
      objectSha256: null,
      artifactId: null
    };
  }

  const manifestId = readSafeId(value.manifestId);
  const objectSha256 = readSafeSha256(value.objectSha256);
  const artifactId = readSafeId(value.artifactId);

  if (Object.hasOwn(value, 'objectKey') || value.objectKeyRedacted !== true || manifestId === null || objectSha256 === null || artifactId === null) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.executionReadinessBoundary.target', 'Upload execution approval request requires redacted object keys and safe manifest, hash, and artifact references.');
  }

  return {
    manifestId,
    objectKeyRedacted: true,
    objectSha256,
    artifactId
  };
}

function checkFalseField(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadExecutionApprovalRequestBlockerCode,
  blockers: KnowledgeTeamUploadExecutionApprovalRequestBlocker[]
): void {
  if (value[key] === true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must remain false for upload execution approval requests.`);
  }
}

function checkRequiredTrue(
  value: Record<string, unknown>,
  key: string,
  path: string,
  blockers: KnowledgeTeamUploadExecutionApprovalRequestBlocker[]
): void {
  if (value[key] !== true) {
    addBlocker(blockers, 'missing-required-field', `${path}.${key}`, `${key} must be true before requesting upload execution approval.`);
  }
}

function checkRequiredFalse(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadExecutionApprovalRequestBlockerCode,
  blockers: KnowledgeTeamUploadExecutionApprovalRequestBlocker[]
): void {
  if (value[key] !== false) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be false before requesting upload execution approval.`);
  }
}

function blockerCodeForFalseField(key: string): KnowledgeTeamUploadExecutionApprovalRequestBlockerCode {
  if (key === 'uploadApproved') return 'upload-approval-already-provided';
  if (key === 'uploadExecutionApproved') return 'upload-execution-approval-already-provided';
  if (key === 'uploadExecutionAllowed') return 'upload-execution-enabled';
  if (key === 'mutationApprovalGranted') return 'mutation-approval-already-granted';
  if (key === 'clientCreated') return 'client-created';
  if (key === 'adapterInjected') return 'adapter-injected';
  if (key === 'artifactBytesProvided') return 'artifact-bytes-provided';
  if (key === 'writeTokenIssued') return 'write-token-issued';
  if (key === 'executionLeaseCreated') return 'execution-lease-created';
  if (key === 'rollbackPlanCreated') return 'rollback-plan-created';
  if (key === 'auditRecordCreated') return 'audit-record-created';
  if (key === 'objectWriteAttempted') return 'object-write-attempted';
  if (key === 'metadataIndexWriteAttempted') return 'metadata-index-write-attempted';
  if (key === 'remoteMutationPerformed') return 'remote-mutation-performed';
  return 'mutation-enabled';
}

function emptySourceExecutionReadinessBoundary(): KnowledgeTeamUploadExecutionApprovalRequest['sourceExecutionReadinessBoundary'] {
  return {
    source: 'upload-execution-readiness-boundary',
    boundaryStatus: 'invalid',
    boundaryKind: 'unsupported',
    boundaryNextAction: 'invalid',
    reviewStatus: 'invalid',
    reviewKind: 'unsupported',
    scopeMatched: false,
    humanReviewRecorded: false,
    fingerprintVerified: false,
    sourceFingerprintVerified: false,
    adapterName: null,
    adapterBackendKind: 'unsupported',
    executionReadinessModeled: false,
    objectIndexBindingBoundaryRequired: false,
    artifactBytesBoundaryRequired: false,
    adapterInjectionBoundaryRequired: false,
    clientCreationBoundaryRequired: false,
    credentialReadBoundaryRequired: false,
    credentialPresenceBoundaryRequired: false,
    liveCheckBoundaryRequired: false,
    uploadCommandBoundaryRequired: false,
    objectStoreBindingRequired: false,
    metadataIndexBindingRequired: false,
    writeTokenRequired: false,
    executionLeaseRequired: false,
    rollbackPlanRequired: false,
    auditRecordRequired: false,
    objectWriteRequiresExecutionApproval: false,
    metadataIndexWriteRequiresExecutionApproval: false,
    explicitUploadApprovalRequired: false,
    separateExecutionApprovalRequired: false,
    mutationApprovalRequired: false,
    commandExecutionApprovalRequired: false,
    contentAddressedObjectKeysRequired: false,
    contentAddressedIndexKeysRequired: false,
    idempotentObjectWriteRequired: false,
    idempotentMetadataIndexWriteRequired: false,
    uploadApproved: false,
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

function emptyParsedExecutionReadinessBoundary(): ParsedExecutionReadinessBoundaryForApprovalRequest {
  return {
    boundaryStatus: 'invalid',
    boundaryKind: 'unsupported',
    boundaryNextAction: 'invalid',
    sourceExecutionReadinessBoundary: emptySourceExecutionReadinessBoundary(),
    target: {
      manifestId: null,
      objectKeyRedacted: true,
      objectSha256: null,
      artifactId: null
    }
  };
}

function parseExecutionReadinessBoundaryForApprovalRequest(
  value: unknown,
  blockers: KnowledgeTeamUploadExecutionApprovalRequestBlocker[]
): ParsedExecutionReadinessBoundaryForApprovalRequest {
  scanForPrivateDetails(value, '$.executionReadinessBoundary', blockers);
  if (!isRecord(value)) {
    addBlocker(blockers, 'invalid-execution-readiness-boundary-kind', '$.executionReadinessBoundary', 'Upload execution approval request requires a saved execution readiness boundary artifact.');
    return emptyParsedExecutionReadinessBoundary();
  }

  if (value.kind !== 'infra-agent.knowledge-team-upload-execution-readiness-boundary') {
    addBlocker(blockers, 'invalid-execution-readiness-boundary-kind', '$.executionReadinessBoundary.kind', 'Upload execution approval request requires an infra-agent.knowledge-team-upload-execution-readiness-boundary artifact.');
  }
  if (value.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.executionReadinessBoundary.schemaVersion', 'Upload execution approval request requires schemaVersion 1.');
  }
  if (value.boundaryKind !== 'upload-execution-readiness-boundary-dry-run') {
    addBlocker(blockers, 'invalid-request-kind', '$.executionReadinessBoundary.boundaryKind', 'Upload execution approval request requires an upload-execution-readiness-boundary-dry-run source.');
  }
  if (value.status !== 'upload-execution-readiness-boundary-ready') {
    addBlocker(blockers, 'execution-readiness-boundary-not-ready', '$.executionReadinessBoundary.status', 'Upload execution approval request requires upload-execution-readiness-boundary-ready input.');
  }
  if (!isRecord(value.readiness) || value.readiness.nextAction !== 'request-separate-upload-execution-approval') {
    addBlocker(blockers, 'execution-readiness-boundary-next-action-invalid', '$.executionReadinessBoundary.readiness.nextAction', 'Execution readiness boundary must request separate upload execution approval.');
  }
  if (isRecord(value.readiness) && value.readiness.blockerCount !== 0) {
    addBlocker(blockers, 'execution-readiness-boundary-not-ready', '$.executionReadinessBoundary.readiness.blockerCount', 'Upload execution approval request requires an unblocked execution readiness boundary.');
  }
  if (value.uploadCommand !== null) {
    addBlocker(blockers, 'upload-command-present', '$.executionReadinessBoundary.uploadCommand', 'Upload execution approval request must not receive upload commands.');
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
    checkFalseField(value, key, '$.executionReadinessBoundary', blockerCodeForFalseField(key), blockers);
  }
  checkFalseField(value, 'liveCheckAllowed', '$.executionReadinessBoundary', 'live-check-enabled', blockers);
  checkFalseField(value, 'credentialValuesExposed', '$.executionReadinessBoundary', 'credential-values-exposed', blockers);
  checkFalseField(value, 'credentialPresenceChecked', '$.executionReadinessBoundary', 'credential-presence-check-enabled', blockers);

  const sourceObjectIndexBindingBoundary = isRecord(value.sourceObjectIndexBindingBoundary) ? value.sourceObjectIndexBindingBoundary : {};
  const uploadExecutionReadinessBoundary = isRecord(value.uploadExecutionReadinessBoundary) ? value.uploadExecutionReadinessBoundary : {};
  const remainingExecutionBoundaries = isRecord(value.remainingExecutionBoundaries) ? value.remainingExecutionBoundaries : {};
  if (!isRecord(value.sourceObjectIndexBindingBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.executionReadinessBoundary.sourceObjectIndexBindingBoundary', 'Upload execution approval request requires source object/index metadata.');
  }
  if (!isRecord(value.uploadExecutionReadinessBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.executionReadinessBoundary.uploadExecutionReadinessBoundary', 'Upload execution approval request requires execution readiness metadata.');
  }
  if (!isRecord(value.remainingExecutionBoundaries)) {
    addBlocker(blockers, 'missing-required-field', '$.executionReadinessBoundary.remainingExecutionBoundaries', 'Upload execution approval request requires remaining execution boundary metadata.');
  }

  for (const key of REQUIRED_SOURCE_READINESS_FIELDS) {
    checkRequiredTrue(uploadExecutionReadinessBoundary, key, '$.executionReadinessBoundary.uploadExecutionReadinessBoundary', blockers);
  }
  for (const [key, code] of [
    ['uploadApproved', 'upload-approval-already-provided'],
    ['uploadExecutionAllowed', 'upload-execution-enabled'],
    ['mutationApprovalGranted', 'mutation-approval-already-granted'],
    ['artifactBytesProvided', 'artifact-bytes-provided'],
    ['adapterInjected', 'adapter-injected'],
    ['clientCreated', 'client-created'],
    ['credentialValuesRead', 'credential-values-read'],
    ['credentialValuesExposed', 'credential-values-exposed'],
    ['credentialPresenceChecked', 'credential-presence-check-enabled'],
    ['credentialPresenceResultExposed', 'credential-presence-result-exposed'],
    ['liveCheckAllowed', 'live-check-enabled'],
    ['liveCheckPerformed', 'live-check-enabled'],
    ['liveCheckResultExposed', 'live-check-result-exposed'],
    ['uploadCommandGenerated', 'upload-command-generated'],
    ['uploadCommandMaterialized', 'upload-command-generated'],
    ['uploadCommandExposed', 'upload-command-exposed'],
    ['artifactObjectStoreBound', 'artifact-object-store-bound'],
    ['metadataIndexBound', 'metadata-index-bound'],
    ['objectStoreHandleExposed', 'object-store-handle-leak'],
    ['metadataIndexHandleExposed', 'metadata-index-handle-leak'],
    ['objectWriteAllowed', 'remote-write-enabled'],
    ['metadataIndexWriteAllowed', 'remote-write-enabled'],
    ['objectWriteAttempted', 'object-write-attempted'],
    ['metadataIndexWriteAttempted', 'metadata-index-write-attempted'],
    ['writeTokenIssued', 'write-token-issued'],
    ['executionLeaseCreated', 'execution-lease-created'],
    ['rollbackPlanCreated', 'rollback-plan-created'],
    ['auditRecordCreated', 'audit-record-created'],
    ['remoteMutationPerformed', 'remote-mutation-performed'],
    ['executable', 'executable-state-enabled']
  ] as const) {
    checkRequiredFalse(uploadExecutionReadinessBoundary, key, '$.executionReadinessBoundary.uploadExecutionReadinessBoundary', code, blockers);
  }

  checkRequiredTrue(remainingExecutionBoundaries, 'uploadExecutionApprovalRequired', '$.executionReadinessBoundary.remainingExecutionBoundaries', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'uploadExecutionApproved', '$.executionReadinessBoundary.remainingExecutionBoundaries', 'upload-execution-approval-already-provided', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'objectWriteAllowed', '$.executionReadinessBoundary.remainingExecutionBoundaries', 'remote-write-enabled', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'metadataIndexWriteAllowed', '$.executionReadinessBoundary.remainingExecutionBoundaries', 'remote-write-enabled', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'remoteMutationAllowed', '$.executionReadinessBoundary.remainingExecutionBoundaries', 'remote-write-enabled', blockers);

  const reviewStatus = readReviewStatus(sourceObjectIndexBindingBoundary.reviewStatus);
  const reviewKind = readReviewKind(sourceObjectIndexBindingBoundary.reviewKind);
  const adapterBackendKind = readAdapterBackendKind(sourceObjectIndexBindingBoundary.adapterBackendKind);
  const adapterName = typeof sourceObjectIndexBindingBoundary.adapterName === 'string' && isSafeKnowledgeTeamBackendAdapterName(sourceObjectIndexBindingBoundary.adapterName)
    ? sourceObjectIndexBindingBoundary.adapterName
    : null;
  if (sourceObjectIndexBindingBoundary.adapterName !== null && sourceObjectIndexBindingBoundary.adapterName !== undefined && adapterName === null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.executionReadinessBoundary.sourceObjectIndexBindingBoundary.adapterName', 'Upload execution approval request requires a safe adapter name.');
  }
  if (reviewStatus !== 'review-ready' || reviewKind !== 'human-fingerprint-dry-run' || !readBool(sourceObjectIndexBindingBoundary.scopeMatched) || !readBool(sourceObjectIndexBindingBoundary.humanReviewRecorded) || !readBool(sourceObjectIndexBindingBoundary.fingerprintVerified) || !readBool(sourceObjectIndexBindingBoundary.sourceFingerprintVerified)) {
    addBlocker(blockers, 'review-fingerprint-unverified', '$.executionReadinessBoundary.sourceObjectIndexBindingBoundary', 'Upload execution approval request requires verified review and scope metadata from the execution readiness source.');
  }
  if (adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.executionReadinessBoundary.sourceObjectIndexBindingBoundary.adapterBackendKind', 'Upload execution approval request remains mock-backend only.');
  }

  const sourceExecutionReadinessBoundary = {
    ...emptySourceExecutionReadinessBoundary(),
    source: 'upload-execution-readiness-boundary' as const,
    boundaryStatus: readBoundaryStatus(value.status),
    boundaryKind: readBoundaryKind(value.boundaryKind),
    boundaryNextAction: isRecord(value.readiness) ? readBoundaryNextAction(value.readiness.nextAction) : 'invalid' as const,
    reviewStatus,
    reviewKind,
    scopeMatched: readBool(sourceObjectIndexBindingBoundary.scopeMatched),
    humanReviewRecorded: readBool(sourceObjectIndexBindingBoundary.humanReviewRecorded),
    fingerprintVerified: readBool(sourceObjectIndexBindingBoundary.fingerprintVerified),
    sourceFingerprintVerified: readBool(sourceObjectIndexBindingBoundary.sourceFingerprintVerified),
    adapterName,
    adapterBackendKind
  };
  for (const key of REQUIRED_SOURCE_READINESS_FIELDS) {
    sourceExecutionReadinessBoundary[key] = readBool(uploadExecutionReadinessBoundary[key]);
  }
  for (const key of DISABLED_SOURCE_READINESS_FIELDS) {
    sourceExecutionReadinessBoundary[key] = readBool(uploadExecutionReadinessBoundary[key]);
  }

  return {
    boundaryStatus: sourceExecutionReadinessBoundary.boundaryStatus,
    boundaryKind: sourceExecutionReadinessBoundary.boundaryKind,
    boundaryNextAction: sourceExecutionReadinessBoundary.boundaryNextAction,
    sourceExecutionReadinessBoundary,
    target: parseTarget(value.target, blockers)
  };
}

function computeApprovalRequestFingerprint(input: {
  enabled: boolean;
  source: KnowledgeTeamUploadExecutionApprovalRequest['sourceExecutionReadinessBoundary'];
  target: KnowledgeTeamUploadExecutionApprovalRequest['target'];
}): KnowledgeTeamUploadExecutionApprovalRequest['approvalRequest']['fingerprint'] {
  if (!input.enabled
    || input.target.manifestId === null
    || input.target.objectSha256 === null
    || input.target.artifactId === null
    || input.source.adapterName === null) {
    return {
      algorithm: 'sha256',
      scope: 'stage-knowledge-pack-upload-execution-approval-request-v1',
      value: null,
      canonicalFieldCount: APPROVAL_REQUEST_FINGERPRINT_FIELD_COUNT
    };
  }

  const canonicalFields = [
    ['scope', 'stage-knowledge-pack-upload-execution-approval-request-v1'],
    ['plannedOperation', 'stage-knowledge-pack'],
    ['sourceKind', 'infra-agent.knowledge-team-upload-execution-readiness-boundary'],
    ['sourceBoundaryKind', input.source.boundaryKind],
    ['sourceStatus', input.source.boundaryStatus],
    ['sourceNextAction', input.source.boundaryNextAction],
    ['manifestId', input.target.manifestId],
    ['objectSha256', input.target.objectSha256],
    ['artifactId', input.target.artifactId],
    ['adapterName', input.source.adapterName],
    ['adapterBackendKind', input.source.adapterBackendKind],
    ['executionReadinessModeled', input.source.executionReadinessModeled ? 'true' : 'false'],
    ['separateExecutionApprovalRequired', input.source.separateExecutionApprovalRequired ? 'true' : 'false'],
    ['objectWriteRequiresExecutionApproval', input.source.objectWriteRequiresExecutionApproval ? 'true' : 'false'],
    ['metadataIndexWriteRequiresExecutionApproval', input.source.metadataIndexWriteRequiresExecutionApproval ? 'true' : 'false'],
    ['schemaVersion', '1']
  ];

  return {
    algorithm: 'sha256',
    scope: 'stage-knowledge-pack-upload-execution-approval-request-v1',
    value: createHash('sha256')
      .update(JSON.stringify(canonicalFields))
      .digest('hex'),
    canonicalFieldCount: APPROVAL_REQUEST_FINGERPRINT_FIELD_COUNT
  };
}

export function buildKnowledgeTeamUploadExecutionApprovalRequest(
  input: KnowledgeTeamUploadExecutionApprovalRequestInput
): KnowledgeTeamUploadExecutionApprovalRequest {
  const blockers: KnowledgeTeamUploadExecutionApprovalRequestBlocker[] = [];
  const parsedBoundary = parseExecutionReadinessBoundaryForApprovalRequest(input.executionReadinessBoundary, blockers);
  const status: KnowledgeTeamUploadExecutionApprovalRequestStatus = blockers.length === 0
    ? 'upload-execution-approval-request-ready'
    : 'blocked';
  const requestReady = status === 'upload-execution-approval-request-ready';
  const fingerprint = computeApprovalRequestFingerprint({
    enabled: requestReady,
    source: parsedBoundary.sourceExecutionReadinessBoundary,
    target: parsedBoundary.target
  });
  if (fingerprint.value !== null && !SAFE_FINGERPRINT_PATTERN.test(fingerprint.value)) {
    addBlocker(blockers, 'unsafe-approval-fingerprint', '$.approvalRequest.fingerprint.value', 'Upload execution approval request generated an unsafe approval fingerprint.');
  }

  return {
    kind: 'infra-agent.knowledge-team-upload-execution-approval-request',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    requestKind: 'upload-execution-approval-request-dry-run',
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
    target: parsedBoundary.target,
    sourceExecutionReadinessBoundary: parsedBoundary.sourceExecutionReadinessBoundary,
    approvalRequest: {
      uploadExecutionApprovalRequired: true,
      humanApprovalRequired: true,
      humanApprovalRecorded: false,
      approvalGranted: false,
      requestIssued: requestReady,
      source: 'execution-readiness-boundary',
      fingerprint,
      fingerprintVerified: false,
      approvalSource: null,
      suppliedFingerprint: null,
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
      nextAction: status === 'upload-execution-approval-request-ready' ? 'record-human-upload-execution-approval' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: blockers.map(entry => entry.code),
      blockers,
      reason: status === 'upload-execution-approval-request-ready'
        ? 'Upload execution approval request is prepared with a deterministic fingerprint, but no human approval is recorded and upload execution remains disabled.'
        : 'Upload execution approval request is blocked until all execution readiness blockers are resolved.'
    }
  };
}
