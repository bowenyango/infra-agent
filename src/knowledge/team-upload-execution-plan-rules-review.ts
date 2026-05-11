import { createHash } from 'node:crypto';
import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadExecutionPlanRulesReviewStatus =
  | 'upload-execution-plan-rules-review-ready'
  | 'blocked';

export type KnowledgeTeamUploadExecutionPlanRulesReviewNextAction =
  | 'await-explicit-plan-rules-update'
  | 'resolve-blockers';

export type KnowledgeTeamUploadExecutionPlanRulesReviewBlockerCode =
  | 'adapter-dependency-leak'
  | 'adapter-injected'
  | 'artifact-bytes-provided'
  | 'artifact-object-store-bound'
  | 'audit-record-created'
  | 'authorization-already-granted'
  | 'authorization-boundary-fingerprint-missing'
  | 'authorization-boundary-fingerprint-unsupported'
  | 'authorization-boundary-next-action-invalid'
  | 'authorization-boundary-not-ready'
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
  | 'invalid-authorization-boundary-kind'
  | 'invalid-boundary-kind'
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
  | 'plan-rules-update-review-enabled-execution'
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

export interface KnowledgeTeamUploadExecutionPlanRulesReviewBlocker {
  code: KnowledgeTeamUploadExecutionPlanRulesReviewBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadExecutionPlanRulesReview {
  kind: 'infra-agent.knowledge-team-upload-execution-plan-rules-review';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  reviewKind: 'upload-execution-plan-rules-review-dry-run';
  status: KnowledgeTeamUploadExecutionPlanRulesReviewStatus;
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
  sourceAuthorizationBoundary: {
    source: 'upload-execution-authorization-boundary';
    boundaryStatus: 'upload-execution-authorization-boundary-ready' | 'blocked' | 'invalid';
    boundaryKind: 'upload-execution-authorization-boundary-dry-run' | 'unsupported';
    boundaryNextAction: 'await-plan-rules-update-for-upload-execution' | 'resolve-blockers' | 'invalid';
    scopeMatched: boolean;
    humanApprovalRecorded: boolean;
    approvalFingerprintVerified: boolean;
    authorizationBoundaryDesigned: boolean;
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
    authorizationBoundaryFingerprint: {
      algorithm: 'sha256' | 'unsupported';
      scope: 'stage-knowledge-pack-upload-execution-authorization-boundary-v1' | 'unsupported';
      value: string | null;
      canonicalFieldCount: number | null;
    };
  };
  planRulesReview: {
    dryRunOnly: true;
    planRulesUpdateReviewRequired: true;
    planRulesUpdated: false;
    rulesUpdateReviewed: false;
    executionStillDisabled: true;
    uploadExecutionAuthorizationBoundaryRequired: true;
    realUploadExecutionStillProhibited: true;
    uploadCommandGenerationStillProhibited: true;
    objectWriteStillProhibited: true;
    metadataIndexWriteStillProhibited: true;
    nextRequiredPolicyUpdate: 'explicit-plan-rules-update';
    requiredReviewDocuments: [
      'docs/HANDOFF.md',
      'docs/ROADMAP.md',
      'docs/AGENT_RULES.md',
      'docs/CLAUDE_CODE_AGENT_PATTERNS.md'
    ];
    reviewFingerprint: {
      algorithm: 'sha256';
      scope: 'stage-knowledge-pack-upload-execution-plan-rules-review-v1';
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
    status: KnowledgeTeamUploadExecutionPlanRulesReviewStatus;
    nextAction: KnowledgeTeamUploadExecutionPlanRulesReviewNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadExecutionPlanRulesReviewBlockerCode[];
    blockers: KnowledgeTeamUploadExecutionPlanRulesReviewBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadExecutionPlanRulesReviewInput {
  executionAuthorizationBoundary: unknown;
}

interface ParsedAuthorizationBoundaryForPlanRulesReview {
  boundaryStatus: KnowledgeTeamUploadExecutionPlanRulesReview['sourceAuthorizationBoundary']['boundaryStatus'];
  boundaryKind: KnowledgeTeamUploadExecutionPlanRulesReview['sourceAuthorizationBoundary']['boundaryKind'];
  boundaryNextAction: KnowledgeTeamUploadExecutionPlanRulesReview['sourceAuthorizationBoundary']['boundaryNextAction'];
  target: KnowledgeTeamUploadExecutionPlanRulesReview['target'];
  sourceAuthorizationBoundary: KnowledgeTeamUploadExecutionPlanRulesReview['sourceAuthorizationBoundary'];
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const SAFE_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const APPROVAL_RECORD_FINGERPRINT_FIELD_COUNT = 14;
const AUTHORIZATION_BOUNDARY_FINGERPRINT_FIELD_COUNT = 16;
const PLAN_RULES_REVIEW_FINGERPRINT_FIELD_COUNT = 20;
const FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN = /(artifactBytesValue|artifactBytesBase64|artifactBytesContent|artifactBytesPayload|artifactContent|artifactPayload|rawArtifact|byteBuffer|bytesBase64|contentBase64|buffer|stream|arrayBuffer|blob|readPath|filePath|localPath|artifactPath|serializedPayload|stagedBytes)/i;
const FORBIDDEN_CLIENT_KEY_PATTERN = /(clientInstance|clientObject|clientValue|clientFactoryValue|clientDescriptorValue|clientConfig|adapterClient|^sdkClient$|sdkClientConfig|signedUrl)/i;
const FORBIDDEN_CREDENTIAL_KEY_PATTERN = /(^credentialValue$|credentialValuePayload|credentialValueMaterial|credentialMaterial|credentialFile|credentialPath|credentialsPath|secretValue|envValue|processEnv|presenceCheckResult|^credentialPresenceResult$|credentialPresenceResult(?:Value|Payload|Material|Data|Body|Response)|credentialPresenceSignalValue)/i;
const FORBIDDEN_LIVE_CHECK_KEY_PATTERN = /(^liveCheckResult$|liveCheckResult(?:Value|Payload|Material|Data|Body)|liveCheckResponse|liveCheckProbe|liveCheckRequest|liveBackendProbe|headObjectResult|headIndexResult|remoteProbeResult|connectivityResult|healthCheckResult)/i;
const FORBIDDEN_COMMAND_KEY_PATTERN = /(^uploadCommandValue$|^uploadCommandPayload$|^uploadCommandMaterial$|^uploadCommandData$|^uploadCommandBody$|^uploadCommandLine$|^commandLine$|^shellCommand$|^signedUploadCommand$|^uploadExecutionCommand$)/i;
const FORBIDDEN_AUTHORIZATION_KEY_PATTERN = /(^authorizationValue$|authorizationMaterial|authorizationToken|authorizationHeader|executionAuthorizationValue|executionAuthorizationMaterial|executionGrant|signedAuthorization|uploadExecutionAuthorizationMaterial|uploadExecutionGrant)/i;
const FORBIDDEN_ADAPTER_KEY_PATTERN = /(adapterInstance|adapterObject|adapterValue|adapterDescriptorValue)/i;
const FORBIDDEN_OBJECT_STORE_HANDLE_KEY_PATTERN = /(^objectStoreBinding$|objectStoreBinding(?:Handle|Instance|Client|Value|Payload|Material)|^objectStoreHandle$|objectStoreHandle(?:Value|Payload|Material|Instance|Client)|objectStoreInstance|objectStoreClient|artifactObjectStoreHandle|putObject|writeObject)/i;
const FORBIDDEN_METADATA_INDEX_HANDLE_KEY_PATTERN = /(^metadataIndexBinding$|metadataIndexBinding(?:Handle|Instance|Client|Value|Payload|Material)|^metadataIndexHandle$|metadataIndexHandle(?:Value|Payload|Material|Instance|Client)|metadataIndexInstance|metadataIndexClient|putEntry|writeIndex|indexEntryPayload|indexEntryValue)/i;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|secret|password|header|accessKey|sessionToken|tokenValue|tokenMaterial|leaseValue|leaseMaterial|rollbackValue|rollbackMaterial|rollbackCommand|auditValue|auditMaterial|auditCommand)/i;
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

const AUTHORIZATION_FALSE_FIELDS = [
  'authorizationGranted',
  'executionAuthorizationGranted',
  'approvalGranted',
  'uploadApproved',
  'uploadExecutionApproved',
  'uploadExecutionAllowed',
  'mutationApprovalGranted',
  'executable',
  'objectWriteAllowed',
  'metadataIndexWriteAllowed',
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
  return value === true;
}

function addBlocker(
  blockers: KnowledgeTeamUploadExecutionPlanRulesReviewBlocker[],
  code: KnowledgeTeamUploadExecutionPlanRulesReviewBlockerCode,
  path: string,
  message: string
): void {
  blockers.push({ code, path, message });
}

function scanForPrivateDetails(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadExecutionPlanRulesReviewBlocker[]
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForPrivateDetails(entry, `${path}[${index}]`, blockers));
    return;
  }
  if (!isRecord(value)) {
    if (typeof value === 'string' && FORBIDDEN_LEAK_VALUE_PATTERN.test(value)) {
      addBlocker(blockers, 'backend-detail-leak', path, 'Upload execution Plan/Rules review input must not contain backend details, private paths, credentials, commands, live-check results, handles, authorization material, or raw artifact content.');
    }
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    if (key === 'objectKey') {
      addBlocker(blockers, 'unsafe-artifact-reference', entryPath, 'Upload execution Plan/Rules review input must not contain target object keys.');
      continue;
    }
    if (FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'artifact-bytes-provided', entryPath, 'Upload execution Plan/Rules review input must not contain raw bytes, byte buffers, streams, content payloads, or local artifact paths.');
      continue;
    }
    if (FORBIDDEN_CLIENT_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'client-dependency-leak', entryPath, 'Upload execution Plan/Rules review input must not contain SDK clients, client configs, signed URLs, or write functions.');
      continue;
    }
    if (FORBIDDEN_CREDENTIAL_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'credential-dependency-leak', entryPath, 'Upload execution Plan/Rules review input must not contain credential values, credential files, environment reads, or credential presence results.');
      continue;
    }
    if (FORBIDDEN_LIVE_CHECK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'live-check-enabled', entryPath, 'Upload execution Plan/Rules review input must not contain live backend probes, live-check requests, or live-check results.');
      continue;
    }
    if (FORBIDDEN_COMMAND_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'upload-command-present', entryPath, 'Upload execution Plan/Rules review input must not contain upload command payloads or executable command material.');
      continue;
    }
    if (FORBIDDEN_AUTHORIZATION_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'authorization-material-leak', entryPath, 'Upload execution Plan/Rules review input must not contain authorization material, grant values, tokens, or headers.');
      continue;
    }
    if (FORBIDDEN_ADAPTER_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'adapter-dependency-leak', entryPath, 'Upload execution Plan/Rules review input must not contain adapter instances or concrete adapter values.');
      continue;
    }
    if (FORBIDDEN_OBJECT_STORE_HANDLE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'object-store-handle-leak', entryPath, 'Upload execution Plan/Rules review input must not contain object store handles or object write functions.');
      continue;
    }
    if (FORBIDDEN_METADATA_INDEX_HANDLE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'metadata-index-handle-leak', entryPath, 'Upload execution Plan/Rules review input must not contain metadata index handles, metadata index entries, or index write functions.');
      continue;
    }
    if (FORBIDDEN_LEAK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'backend-detail-leak', entryPath, 'Upload execution Plan/Rules review input must not contain backend details, credential fields, commands, token/lease material, rollback material, audit material, authorization material, or raw artifact content.');
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

function readBoundaryStatus(value: unknown): ParsedAuthorizationBoundaryForPlanRulesReview['boundaryStatus'] {
  if (value === 'upload-execution-authorization-boundary-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readBoundaryKind(value: unknown): ParsedAuthorizationBoundaryForPlanRulesReview['boundaryKind'] {
  if (value === 'upload-execution-authorization-boundary-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readBoundaryNextAction(value: unknown): ParsedAuthorizationBoundaryForPlanRulesReview['boundaryNextAction'] {
  if (value === 'await-plan-rules-update-for-upload-execution' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readAdapterBackendKind(value: unknown): KnowledgeTeamUploadExecutionPlanRulesReview['sourceAuthorizationBoundary']['adapterBackendKind'] {
  if (value === 'mock-s3-compatible' || value === 's3-compatible') {
    return value;
  }
  return 'unsupported';
}

function readSafeApprovalRecordFingerprint(
  value: unknown
): KnowledgeTeamUploadExecutionPlanRulesReview['sourceAuthorizationBoundary']['sourceApprovalRecordFingerprint'] {
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

function readSafeAuthorizationBoundaryFingerprint(
  value: unknown
): KnowledgeTeamUploadExecutionPlanRulesReview['sourceAuthorizationBoundary']['authorizationBoundaryFingerprint'] {
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
    scope: value.scope === 'stage-knowledge-pack-upload-execution-authorization-boundary-v1'
      ? 'stage-knowledge-pack-upload-execution-authorization-boundary-v1'
      : 'unsupported',
    value: typeof value.value === 'string' && SAFE_FINGERPRINT_PATTERN.test(value.value) ? value.value : null,
    canonicalFieldCount: typeof value.canonicalFieldCount === 'number' ? value.canonicalFieldCount : null
  };
}

function blockerCodeForFalseField(key: string): KnowledgeTeamUploadExecutionPlanRulesReviewBlockerCode {
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
  blockers: KnowledgeTeamUploadExecutionPlanRulesReviewBlocker[]
): void {
  if (value[key] === true) {
    addBlocker(blockers, blockerCodeForFalseField(key), `${path}.${key}`, `${key} must remain false when modeling upload execution Plan/Rules review.`);
  }
}

function emptyTarget(): KnowledgeTeamUploadExecutionPlanRulesReview['target'] {
  return {
    manifestId: null,
    objectKeyRedacted: true,
    objectSha256: null,
    artifactId: null
  };
}

function emptyApprovalRecordFingerprint(): KnowledgeTeamUploadExecutionPlanRulesReview['sourceAuthorizationBoundary']['sourceApprovalRecordFingerprint'] {
  return {
    algorithm: 'unsupported',
    scope: 'unsupported',
    value: null,
    canonicalFieldCount: null
  };
}

function emptyAuthorizationBoundaryFingerprint(): KnowledgeTeamUploadExecutionPlanRulesReview['sourceAuthorizationBoundary']['authorizationBoundaryFingerprint'] {
  return {
    algorithm: 'unsupported',
    scope: 'unsupported',
    value: null,
    canonicalFieldCount: null
  };
}

function emptySourceAuthorizationBoundary(): KnowledgeTeamUploadExecutionPlanRulesReview['sourceAuthorizationBoundary'] {
  return {
    source: 'upload-execution-authorization-boundary',
    boundaryStatus: 'invalid',
    boundaryKind: 'unsupported',
    boundaryNextAction: 'invalid',
    scopeMatched: false,
    humanApprovalRecorded: false,
    approvalFingerprintVerified: false,
    authorizationBoundaryDesigned: false,
    authorizationGranted: false,
    executionAuthorizationGranted: false,
    approvalGranted: false,
    uploadApproved: false,
    uploadExecutionApproved: false,
    uploadExecutionAllowed: false,
    mutationApprovalGranted: false,
    adapterName: null,
    adapterBackendKind: 'unsupported',
    sourceApprovalRecordFingerprint: emptyApprovalRecordFingerprint(),
    authorizationBoundaryFingerprint: emptyAuthorizationBoundaryFingerprint()
  };
}

function emptyParsedAuthorizationBoundary(): ParsedAuthorizationBoundaryForPlanRulesReview {
  return {
    boundaryStatus: 'invalid',
    boundaryKind: 'unsupported',
    boundaryNextAction: 'invalid',
    target: emptyTarget(),
    sourceAuthorizationBoundary: emptySourceAuthorizationBoundary()
  };
}

function parseTarget(
  value: unknown,
  blockers: KnowledgeTeamUploadExecutionPlanRulesReviewBlocker[]
): KnowledgeTeamUploadExecutionPlanRulesReview['target'] {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.executionAuthorizationBoundary.target', 'Upload execution Plan/Rules review requires a target object.');
    addBlocker(blockers, 'unsafe-artifact-reference', '$.executionAuthorizationBoundary.target', 'Upload execution Plan/Rules review requires safe target references.');
    return emptyTarget();
  }

  const manifestId = readSafeId(value.manifestId);
  const objectSha256 = readSafeSha256(value.objectSha256);
  const artifactId = readSafeId(value.artifactId);

  if (Object.hasOwn(value, 'objectKey') || value.objectKeyRedacted !== true || manifestId === null || objectSha256 === null || artifactId === null) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.executionAuthorizationBoundary.target', 'Upload execution Plan/Rules review requires redacted object keys and safe manifest, hash, and artifact references.');
  }

  return {
    manifestId,
    objectKeyRedacted: true,
    objectSha256,
    artifactId
  };
}

function validateAuthorizationBoundaryReadiness(
  value: Record<string, unknown>,
  sourceAuthorizationBoundary: KnowledgeTeamUploadExecutionPlanRulesReview['sourceAuthorizationBoundary'],
  blockers: KnowledgeTeamUploadExecutionPlanRulesReviewBlocker[]
): void {
  if (value.kind !== 'infra-agent.knowledge-team-upload-execution-authorization-boundary') {
    addBlocker(blockers, 'invalid-authorization-boundary-kind', '$.executionAuthorizationBoundary.kind', 'Upload execution Plan/Rules review requires an infra-agent.knowledge-team-upload-execution-authorization-boundary artifact.');
  }
  if (value.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.executionAuthorizationBoundary.schemaVersion', 'Upload execution Plan/Rules review requires schemaVersion 1.');
  }
  if (value.reviewKind !== undefined) {
    addBlocker(blockers, 'invalid-boundary-kind', '$.executionAuthorizationBoundary.reviewKind', 'Upload execution Plan/Rules review requires an authorization boundary source, not a review artifact.');
  }
  if (value.boundaryKind !== 'upload-execution-authorization-boundary-dry-run') {
    addBlocker(blockers, 'invalid-boundary-kind', '$.executionAuthorizationBoundary.boundaryKind', 'Upload execution Plan/Rules review requires a dry-run authorization boundary source.');
  }
  if (value.status !== 'upload-execution-authorization-boundary-ready') {
    addBlocker(blockers, 'authorization-boundary-not-ready', '$.executionAuthorizationBoundary.status', 'Upload execution Plan/Rules review requires upload-execution-authorization-boundary-ready input.');
  }
  if (!isRecord(value.readiness) || value.readiness.nextAction !== 'await-plan-rules-update-for-upload-execution') {
    addBlocker(blockers, 'authorization-boundary-next-action-invalid', '$.executionAuthorizationBoundary.readiness.nextAction', 'Authorization boundary must await a Plan/Rules update.');
  }
  if (isRecord(value.readiness) && value.readiness.blockerCount !== 0) {
    addBlocker(blockers, 'authorization-boundary-not-ready', '$.executionAuthorizationBoundary.readiness.blockerCount', 'Upload execution Plan/Rules review requires an unblocked authorization boundary.');
  }
  if (value.uploadCommand !== null) {
    addBlocker(blockers, 'upload-command-present', '$.executionAuthorizationBoundary.uploadCommand', 'Upload execution Plan/Rules review must not receive upload commands.');
  }

  for (const key of TOP_LEVEL_FALSE_FIELDS) {
    checkFalseField(value, key, '$.executionAuthorizationBoundary', blockers);
  }

  const authorizationBoundary = isRecord(value.authorizationBoundary) ? value.authorizationBoundary : {};
  const executionBoundary = isRecord(value.executionBoundary) ? value.executionBoundary : {};

  if (!isRecord(value.authorizationBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.executionAuthorizationBoundary.authorizationBoundary', 'Upload execution Plan/Rules review requires authorization boundary metadata.');
  }
  if (!isRecord(value.executionBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.executionAuthorizationBoundary.executionBoundary', 'Upload execution Plan/Rules review requires execution boundary metadata.');
  }

  for (const key of AUTHORIZATION_FALSE_FIELDS) {
    checkFalseField(authorizationBoundary, key, '$.executionAuthorizationBoundary.authorizationBoundary', blockers);
  }
  for (const key of EXECUTION_BOUNDARY_FALSE_FIELDS) {
    checkFalseField(executionBoundary, key, '$.executionAuthorizationBoundary.executionBoundary', blockers);
  }

  if (sourceAuthorizationBoundary.boundaryStatus !== 'upload-execution-authorization-boundary-ready') {
    addBlocker(blockers, 'authorization-boundary-not-ready', '$.executionAuthorizationBoundary.status', 'Upload execution Plan/Rules review requires a ready authorization boundary source.');
  }
  if (sourceAuthorizationBoundary.boundaryKind !== 'upload-execution-authorization-boundary-dry-run') {
    addBlocker(blockers, 'invalid-boundary-kind', '$.executionAuthorizationBoundary.boundaryKind', 'Upload execution Plan/Rules review requires a dry-run authorization boundary source.');
  }
  if (sourceAuthorizationBoundary.boundaryNextAction !== 'await-plan-rules-update-for-upload-execution') {
    addBlocker(blockers, 'authorization-boundary-next-action-invalid', '$.executionAuthorizationBoundary.readiness.nextAction', 'Upload execution Plan/Rules review requires the Plan/Rules update next action.');
  }
  if (!sourceAuthorizationBoundary.scopeMatched) {
    addBlocker(blockers, 'scope-not-matched', '$.executionAuthorizationBoundary.sourceAuthorizationBoundary.scopeMatched', 'Upload execution Plan/Rules review requires matched source scope.');
  }
  if (!sourceAuthorizationBoundary.humanApprovalRecorded
    || !sourceAuthorizationBoundary.approvalFingerprintVerified
    || !sourceAuthorizationBoundary.authorizationBoundaryDesigned) {
    addBlocker(blockers, 'review-fingerprint-unverified', '$.executionAuthorizationBoundary.authorizationBoundary', 'Upload execution Plan/Rules review requires verified source approval and designed authorization boundary.');
  }
  if (sourceAuthorizationBoundary.adapterName === null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.executionAuthorizationBoundary.sourceApprovalRecord.adapterName', 'Upload execution Plan/Rules review requires a safe adapter name.');
  }
  if (sourceAuthorizationBoundary.adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.executionAuthorizationBoundary.sourceApprovalRecord.adapterBackendKind', 'Upload execution Plan/Rules review remains mock-backend only.');
  }
  for (const key of [
    'authorizationGranted',
    'executionAuthorizationGranted',
    'approvalGranted',
    'uploadApproved',
    'uploadExecutionApproved',
    'uploadExecutionAllowed',
    'mutationApprovalGranted'
  ] as const) {
    if (sourceAuthorizationBoundary[key]) {
      addBlocker(blockers, blockerCodeForFalseField(key), `$.executionAuthorizationBoundary.authorizationBoundary.${key}`, `${key} must remain false before Plan/Rules update review.`);
    }
  }
  if (sourceAuthorizationBoundary.sourceApprovalRecordFingerprint.algorithm !== 'sha256'
    || sourceAuthorizationBoundary.sourceApprovalRecordFingerprint.scope !== 'stage-knowledge-pack-upload-execution-approval-record-v1'
    || sourceAuthorizationBoundary.sourceApprovalRecordFingerprint.canonicalFieldCount !== APPROVAL_RECORD_FINGERPRINT_FIELD_COUNT
    || sourceAuthorizationBoundary.sourceApprovalRecordFingerprint.value === null) {
    addBlocker(blockers, 'authorization-boundary-fingerprint-unsupported', '$.executionAuthorizationBoundary.authorizationBoundary.sourceApprovalRecordFingerprint', 'Upload execution Plan/Rules review requires a supported source approval record fingerprint.');
  }
  if (sourceAuthorizationBoundary.authorizationBoundaryFingerprint.algorithm !== 'sha256'
    || sourceAuthorizationBoundary.authorizationBoundaryFingerprint.scope !== 'stage-knowledge-pack-upload-execution-authorization-boundary-v1'
    || sourceAuthorizationBoundary.authorizationBoundaryFingerprint.canonicalFieldCount !== AUTHORIZATION_BOUNDARY_FINGERPRINT_FIELD_COUNT) {
    addBlocker(blockers, 'authorization-boundary-fingerprint-unsupported', '$.executionAuthorizationBoundary.authorizationBoundary.authorizationBoundaryFingerprint', 'Upload execution Plan/Rules review requires a supported authorization boundary fingerprint.');
  }
  if (sourceAuthorizationBoundary.authorizationBoundaryFingerprint.value === null) {
    addBlocker(blockers, 'authorization-boundary-fingerprint-missing', '$.executionAuthorizationBoundary.authorizationBoundary.authorizationBoundaryFingerprint.value', 'Upload execution Plan/Rules review requires a safe authorization boundary fingerprint.');
  }
}

function parseAuthorizationBoundaryForPlanRulesReview(
  value: unknown,
  blockers: KnowledgeTeamUploadExecutionPlanRulesReviewBlocker[]
): ParsedAuthorizationBoundaryForPlanRulesReview {
  scanForPrivateDetails(value, '$.executionAuthorizationBoundary', blockers);
  if (!isRecord(value)) {
    addBlocker(blockers, 'invalid-authorization-boundary-kind', '$.executionAuthorizationBoundary', 'Upload execution Plan/Rules review requires a saved execution authorization boundary artifact.');
    return emptyParsedAuthorizationBoundary();
  }

  const sourceApprovalRecord = isRecord(value.sourceApprovalRecord) ? value.sourceApprovalRecord : {};
  const authorizationBoundary = isRecord(value.authorizationBoundary) ? value.authorizationBoundary : {};
  const readiness = isRecord(value.readiness) ? value.readiness : {};
  const adapterName = typeof sourceApprovalRecord.adapterName === 'string' && isSafeKnowledgeTeamBackendAdapterName(sourceApprovalRecord.adapterName)
    ? sourceApprovalRecord.adapterName
    : null;
  if (sourceApprovalRecord.adapterName !== null && sourceApprovalRecord.adapterName !== undefined && adapterName === null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.executionAuthorizationBoundary.sourceApprovalRecord.adapterName', 'Upload execution Plan/Rules review requires a safe adapter name.');
  }

  if (!isRecord(value.sourceApprovalRecord)) {
    addBlocker(blockers, 'missing-required-field', '$.executionAuthorizationBoundary.sourceApprovalRecord', 'Upload execution Plan/Rules review requires source approval record metadata.');
  }

  const sourceApprovalRecordFingerprint = readSafeApprovalRecordFingerprint(authorizationBoundary.sourceApprovalRecordFingerprint);
  const authorizationBoundaryFingerprint = readSafeAuthorizationBoundaryFingerprint(authorizationBoundary.authorizationBoundaryFingerprint);
  const sourceAuthorizationBoundary = {
    ...emptySourceAuthorizationBoundary(),
    source: 'upload-execution-authorization-boundary' as const,
    boundaryStatus: readBoundaryStatus(value.status),
    boundaryKind: readBoundaryKind(value.boundaryKind),
    boundaryNextAction: readBoundaryNextAction(readiness.nextAction),
    scopeMatched: readBool(sourceApprovalRecord.scopeMatched),
    humanApprovalRecorded: readBool(authorizationBoundary.humanApprovalRecorded),
    approvalFingerprintVerified: readBool(authorizationBoundary.approvalFingerprintVerified),
    authorizationBoundaryDesigned: readBool(authorizationBoundary.authorizationBoundaryDesigned),
    authorizationGranted: false,
    executionAuthorizationGranted: false,
    approvalGranted: false,
    uploadApproved: false,
    uploadExecutionApproved: false,
    uploadExecutionAllowed: false,
    mutationApprovalGranted: false,
    adapterName,
    adapterBackendKind: readAdapterBackendKind(sourceApprovalRecord.adapterBackendKind),
    sourceApprovalRecordFingerprint,
    authorizationBoundaryFingerprint
  };

  const parsed = {
    boundaryStatus: sourceAuthorizationBoundary.boundaryStatus,
    boundaryKind: sourceAuthorizationBoundary.boundaryKind,
    boundaryNextAction: sourceAuthorizationBoundary.boundaryNextAction,
    target: parseTarget(value.target, blockers),
    sourceAuthorizationBoundary
  };

  validateAuthorizationBoundaryReadiness(value, sourceAuthorizationBoundary, blockers);
  return parsed;
}

function buildReviewFingerprint(
  parsed: ParsedAuthorizationBoundaryForPlanRulesReview,
  ready: boolean
): KnowledgeTeamUploadExecutionPlanRulesReview['planRulesReview']['reviewFingerprint'] {
  if (!ready
    || parsed.target.manifestId === null
    || parsed.target.objectSha256 === null
    || parsed.target.artifactId === null
    || parsed.sourceAuthorizationBoundary.sourceApprovalRecordFingerprint.value === null
    || parsed.sourceAuthorizationBoundary.authorizationBoundaryFingerprint.value === null) {
    return {
      algorithm: 'sha256',
      scope: 'stage-knowledge-pack-upload-execution-plan-rules-review-v1',
      value: null,
      canonicalFieldCount: PLAN_RULES_REVIEW_FINGERPRINT_FIELD_COUNT
    };
  }

  const canonicalFields = [
    ['scope', 'stage-knowledge-pack-upload-execution-plan-rules-review-v1'],
    ['plannedOperation', 'stage-knowledge-pack'],
    ['sourceKind', 'infra-agent.knowledge-team-upload-execution-authorization-boundary'],
    ['sourceStatus', parsed.boundaryStatus],
    ['sourceNextAction', parsed.boundaryNextAction],
    ['manifestId', parsed.target.manifestId],
    ['objectSha256', parsed.target.objectSha256],
    ['artifactId', parsed.target.artifactId],
    ['sourceApprovalRecordFingerprint', parsed.sourceAuthorizationBoundary.sourceApprovalRecordFingerprint.value],
    ['sourceAuthorizationBoundaryFingerprint', parsed.sourceAuthorizationBoundary.authorizationBoundaryFingerprint.value],
    ['humanApprovalRecorded', String(parsed.sourceAuthorizationBoundary.humanApprovalRecorded)],
    ['approvalFingerprintVerified', String(parsed.sourceAuthorizationBoundary.approvalFingerprintVerified)],
    ['authorizationBoundaryDesigned', String(parsed.sourceAuthorizationBoundary.authorizationBoundaryDesigned)],
    ['authorizationGranted', 'false'],
    ['executionAuthorizationGranted', 'false'],
    ['uploadExecutionApproved', 'false'],
    ['uploadExecutionAllowed', 'false'],
    ['mutationApprovalGranted', 'false'],
    ['planRulesUpdateReviewRequired', 'true'],
    ['executionStillDisabled', 'true']
  ] as const;

  return {
    algorithm: 'sha256',
    scope: 'stage-knowledge-pack-upload-execution-plan-rules-review-v1',
    value: createHash('sha256')
      .update(canonicalFields.map(([key, value]) => `${key}=${value}`).join('\n'))
      .digest('hex'),
    canonicalFieldCount: PLAN_RULES_REVIEW_FINGERPRINT_FIELD_COUNT
  };
}

function buildExecutionBoundary(): KnowledgeTeamUploadExecutionPlanRulesReview['executionBoundary'] {
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

export function buildKnowledgeTeamUploadExecutionPlanRulesReview(
  input: KnowledgeTeamUploadExecutionPlanRulesReviewInput
): KnowledgeTeamUploadExecutionPlanRulesReview {
  const blockers: KnowledgeTeamUploadExecutionPlanRulesReviewBlocker[] = [];
  const parsed = parseAuthorizationBoundaryForPlanRulesReview(input.executionAuthorizationBoundary, blockers);
  const ready = blockers.length === 0;
  const status: KnowledgeTeamUploadExecutionPlanRulesReviewStatus = ready
    ? 'upload-execution-plan-rules-review-ready'
    : 'blocked';
  const reviewFingerprint = buildReviewFingerprint(parsed, ready);

  return {
    kind: 'infra-agent.knowledge-team-upload-execution-plan-rules-review',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    reviewKind: 'upload-execution-plan-rules-review-dry-run',
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
    sourceAuthorizationBoundary: parsed.sourceAuthorizationBoundary,
    planRulesReview: {
      dryRunOnly: true,
      planRulesUpdateReviewRequired: true,
      planRulesUpdated: false,
      rulesUpdateReviewed: false,
      executionStillDisabled: true,
      uploadExecutionAuthorizationBoundaryRequired: true,
      realUploadExecutionStillProhibited: true,
      uploadCommandGenerationStillProhibited: true,
      objectWriteStillProhibited: true,
      metadataIndexWriteStillProhibited: true,
      nextRequiredPolicyUpdate: 'explicit-plan-rules-update',
      requiredReviewDocuments: [
        'docs/HANDOFF.md',
        'docs/ROADMAP.md',
        'docs/AGENT_RULES.md',
        'docs/CLAUDE_CODE_AGENT_PATTERNS.md'
      ],
      reviewFingerprint
    },
    executionBoundary: buildExecutionBoundary(),
    readiness: {
      status,
      nextAction: ready ? 'await-explicit-plan-rules-update' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: [...new Set(blockers.map((blocker) => blocker.code))],
      blockers,
      reason: ready
        ? 'Upload execution Plan/Rules review gate is modeled, but execution remains disabled until a later explicit Plan/Rules update narrows the boundary.'
        : 'Upload execution Plan/Rules review gate is blocked because the authorization boundary source is incomplete, unsafe, leaky, or already executable.'
    }
  };
}
