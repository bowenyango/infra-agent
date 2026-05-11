import { createHash } from 'node:crypto';
import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadExecutionPlanRulesUpdateRecordStatus =
  | 'upload-execution-plan-rules-update-record-ready'
  | 'blocked';

export type KnowledgeTeamUploadExecutionPlanRulesUpdateRecordNextAction =
  | 'design-upload-execution-implementation-boundary'
  | 'resolve-blockers';

export type KnowledgeTeamUploadExecutionPlanRulesUpdateRecordBlockerCode =
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
  | 'invalid-plan-rules-review-kind'
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
  | 'plan-rules-review-fingerprint-missing'
  | 'plan-rules-review-fingerprint-unsupported'
  | 'plan-rules-review-next-action-invalid'
  | 'plan-rules-review-not-ready'
  | 'plan-rules-update-record-enabled-execution'
  | 'remote-mutation-performed'
  | 'remote-write-enabled'
  | 'review-fingerprint-mismatch'
  | 'review-fingerprint-missing'
  | 'review-fingerprint-unverified'
  | 'rollback-plan-created'
  | 'scope-not-matched'
  | 'unsafe-adapter-name'
  | 'unsafe-artifact-reference'
  | 'unsafe-review-fingerprint'
  | 'unsupported-adapter-backend'
  | 'upload-approval-already-provided'
  | 'upload-command-exposed'
  | 'upload-command-generated'
  | 'upload-command-present'
  | 'upload-execution-approval-already-provided'
  | 'upload-execution-authorization-already-provided'
  | 'upload-execution-enabled'
  | 'write-token-issued';

export interface KnowledgeTeamUploadExecutionPlanRulesUpdateRecordBlocker {
  code: KnowledgeTeamUploadExecutionPlanRulesUpdateRecordBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadExecutionPlanRulesUpdateRecord {
  kind: 'infra-agent.knowledge-team-upload-execution-plan-rules-update-record';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  recordKind: 'upload-execution-plan-rules-update-record-dry-run';
  status: KnowledgeTeamUploadExecutionPlanRulesUpdateRecordStatus;
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
  sourcePlanRulesReview: {
    source: 'upload-execution-plan-rules-review';
    reviewStatus: 'upload-execution-plan-rules-review-ready' | 'blocked' | 'invalid';
    reviewKind: 'upload-execution-plan-rules-review-dry-run' | 'unsupported';
    reviewNextAction: 'await-explicit-plan-rules-update' | 'resolve-blockers' | 'invalid';
    sourceAuthorizationBoundaryStatus: 'upload-execution-authorization-boundary-ready' | 'blocked' | 'invalid';
    sourceAuthorizationBoundaryKind: 'upload-execution-authorization-boundary-dry-run' | 'unsupported';
    sourceAuthorizationBoundaryNextAction: 'await-plan-rules-update-for-upload-execution' | 'resolve-blockers' | 'invalid';
    scopeMatched: boolean;
    humanApprovalRecorded: boolean;
    approvalFingerprintVerified: boolean;
    authorizationBoundaryDesigned: boolean;
    planRulesUpdateReviewRequired: boolean;
    planRulesUpdated: boolean;
    rulesUpdateReviewed: boolean;
    executionStillDisabled: boolean;
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
    reviewFingerprint: {
      algorithm: 'sha256' | 'unsupported';
      scope: 'stage-knowledge-pack-upload-execution-plan-rules-review-v1' | 'unsupported';
      value: string | null;
      canonicalFieldCount: number | null;
    };
  };
  planRulesUpdateRecord: {
    explicitPlanRulesUpdateRequired: true;
    humanReviewRequired: true;
    planRulesUpdateRecorded: boolean;
    rulesUpdateReviewed: boolean;
    policyUpdateAuthorized: false;
    executionStillDisabled: true;
    source: 'cli-flag' | null;
    suppliedFingerprint: string | null;
    expectedFingerprint: string | null;
    fingerprintVerified: boolean;
    sourceReviewFingerprint: {
      algorithm: 'sha256' | 'unsupported';
      scope: 'stage-knowledge-pack-upload-execution-plan-rules-review-v1' | 'unsupported';
      value: string | null;
      canonicalFieldCount: number | null;
    };
    recordFingerprint: {
      algorithm: 'sha256';
      scope: 'stage-knowledge-pack-upload-execution-plan-rules-update-record-v1';
      value: string | null;
      canonicalFieldCount: number;
    };
    authorizationGranted: false;
    executionAuthorizationGranted: false;
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
    status: KnowledgeTeamUploadExecutionPlanRulesUpdateRecordStatus;
    nextAction: KnowledgeTeamUploadExecutionPlanRulesUpdateRecordNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadExecutionPlanRulesUpdateRecordBlockerCode[];
    blockers: KnowledgeTeamUploadExecutionPlanRulesUpdateRecordBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadExecutionPlanRulesUpdateRecordInput {
  planRulesReview: unknown;
  reviewFingerprint: unknown;
}

interface ParsedPlanRulesReviewForUpdateRecord {
  reviewStatus: KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['sourcePlanRulesReview']['reviewStatus'];
  reviewKind: KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['sourcePlanRulesReview']['reviewKind'];
  reviewNextAction: KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['sourcePlanRulesReview']['reviewNextAction'];
  target: KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['target'];
  sourcePlanRulesReview: KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['sourcePlanRulesReview'];
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const SAFE_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const APPROVAL_RECORD_FINGERPRINT_FIELD_COUNT = 14;
const AUTHORIZATION_BOUNDARY_FINGERPRINT_FIELD_COUNT = 16;
const PLAN_RULES_REVIEW_FINGERPRINT_FIELD_COUNT = 20;
const PLAN_RULES_UPDATE_RECORD_FINGERPRINT_FIELD_COUNT = 18;
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

const SOURCE_REVIEW_FALSE_FIELDS = [
  'authorizationGranted',
  'executionAuthorizationGranted',
  'approvalGranted',
  'uploadApproved',
  'uploadExecutionApproved',
  'uploadExecutionAllowed',
  'mutationApprovalGranted'
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
  blockers: KnowledgeTeamUploadExecutionPlanRulesUpdateRecordBlocker[],
  code: KnowledgeTeamUploadExecutionPlanRulesUpdateRecordBlockerCode,
  path: string,
  message: string
): void {
  blockers.push({ code, path, message });
}

function scanForPrivateDetails(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadExecutionPlanRulesUpdateRecordBlocker[]
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForPrivateDetails(entry, `${path}[${index}]`, blockers));
    return;
  }
  if (!isRecord(value)) {
    if (typeof value === 'string' && FORBIDDEN_LEAK_VALUE_PATTERN.test(value)) {
      addBlocker(blockers, 'backend-detail-leak', path, 'Upload execution Plan/Rules update record input must not contain backend details, private paths, credentials, commands, live-check results, handles, authorization material, or raw artifact content.');
    }
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    if (key === 'objectKey') {
      addBlocker(blockers, 'unsafe-artifact-reference', entryPath, 'Upload execution Plan/Rules update record input must not contain target object keys.');
      continue;
    }
    if (FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'artifact-bytes-provided', entryPath, 'Upload execution Plan/Rules update record input must not contain raw bytes, byte buffers, streams, content payloads, or local artifact paths.');
      continue;
    }
    if (FORBIDDEN_CLIENT_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'client-dependency-leak', entryPath, 'Upload execution Plan/Rules update record input must not contain SDK clients, client configs, signed URLs, or write functions.');
      continue;
    }
    if (FORBIDDEN_CREDENTIAL_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'credential-dependency-leak', entryPath, 'Upload execution Plan/Rules update record input must not contain credential values, credential files, environment reads, or credential presence results.');
      continue;
    }
    if (FORBIDDEN_LIVE_CHECK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'live-check-enabled', entryPath, 'Upload execution Plan/Rules update record input must not contain live backend probes, live-check requests, or live-check results.');
      continue;
    }
    if (FORBIDDEN_COMMAND_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'upload-command-present', entryPath, 'Upload execution Plan/Rules update record input must not contain upload command payloads or executable command material.');
      continue;
    }
    if (FORBIDDEN_AUTHORIZATION_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'authorization-material-leak', entryPath, 'Upload execution Plan/Rules update record input must not contain authorization material, grant values, tokens, or headers.');
      continue;
    }
    if (FORBIDDEN_ADAPTER_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'adapter-dependency-leak', entryPath, 'Upload execution Plan/Rules update record input must not contain adapter instances or concrete adapter values.');
      continue;
    }
    if (FORBIDDEN_OBJECT_STORE_HANDLE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'object-store-handle-leak', entryPath, 'Upload execution Plan/Rules update record input must not contain object store handles or object write functions.');
      continue;
    }
    if (FORBIDDEN_METADATA_INDEX_HANDLE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'metadata-index-handle-leak', entryPath, 'Upload execution Plan/Rules update record input must not contain metadata index handles, metadata index entries, or index write functions.');
      continue;
    }
    if (FORBIDDEN_LEAK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'backend-detail-leak', entryPath, 'Upload execution Plan/Rules update record input must not contain backend details, credential fields, commands, token/lease material, rollback material, audit material, authorization material, or raw artifact content.');
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

function readSafeFingerprint(value: unknown): string | null {
  if (typeof value !== 'string' || !SAFE_FINGERPRINT_PATTERN.test(value)) {
    return null;
  }
  return value;
}

function readReviewStatus(value: unknown): ParsedPlanRulesReviewForUpdateRecord['reviewStatus'] {
  if (value === 'upload-execution-plan-rules-review-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readReviewKind(value: unknown): ParsedPlanRulesReviewForUpdateRecord['reviewKind'] {
  if (value === 'upload-execution-plan-rules-review-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readReviewNextAction(value: unknown): ParsedPlanRulesReviewForUpdateRecord['reviewNextAction'] {
  if (value === 'await-explicit-plan-rules-update' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readSourceAuthorizationBoundaryStatus(value: unknown): KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['sourcePlanRulesReview']['sourceAuthorizationBoundaryStatus'] {
  if (value === 'upload-execution-authorization-boundary-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readSourceAuthorizationBoundaryKind(value: unknown): KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['sourcePlanRulesReview']['sourceAuthorizationBoundaryKind'] {
  if (value === 'upload-execution-authorization-boundary-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readSourceAuthorizationBoundaryNextAction(value: unknown): KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['sourcePlanRulesReview']['sourceAuthorizationBoundaryNextAction'] {
  if (value === 'await-plan-rules-update-for-upload-execution' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readAdapterBackendKind(value: unknown): KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['sourcePlanRulesReview']['adapterBackendKind'] {
  if (value === 'mock-s3-compatible' || value === 's3-compatible') {
    return value;
  }
  return 'unsupported';
}

function readSafeSourceApprovalRecordFingerprint(
  value: unknown
): KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['sourcePlanRulesReview']['sourceApprovalRecordFingerprint'] {
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
    value: readSafeFingerprint(value.value),
    canonicalFieldCount: typeof value.canonicalFieldCount === 'number' ? value.canonicalFieldCount : null
  };
}

function readSafeAuthorizationBoundaryFingerprint(
  value: unknown
): KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['sourcePlanRulesReview']['sourceAuthorizationBoundaryFingerprint'] {
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
    value: readSafeFingerprint(value.value),
    canonicalFieldCount: typeof value.canonicalFieldCount === 'number' ? value.canonicalFieldCount : null
  };
}

function readSafePlanRulesReviewFingerprint(
  value: unknown
): KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['sourcePlanRulesReview']['reviewFingerprint'] {
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
    scope: value.scope === 'stage-knowledge-pack-upload-execution-plan-rules-review-v1'
      ? 'stage-knowledge-pack-upload-execution-plan-rules-review-v1'
      : 'unsupported',
    value: readSafeFingerprint(value.value),
    canonicalFieldCount: typeof value.canonicalFieldCount === 'number' ? value.canonicalFieldCount : null
  };
}

function blockerCodeForFalseField(key: string): KnowledgeTeamUploadExecutionPlanRulesUpdateRecordBlockerCode {
  if (key === 'uploadApproved') return 'upload-approval-already-provided';
  if (key === 'uploadExecutionApproved') return 'upload-execution-approval-already-provided';
  if (key === 'uploadExecutionAllowed') return 'upload-execution-enabled';
  if (key === 'mutationApprovalGranted') return 'mutation-approval-already-granted';
  if (key === 'authorizationGranted' || key === 'executionAuthorizationGranted' || key === 'approvalGranted') return 'authorization-already-granted';
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
  blockers: KnowledgeTeamUploadExecutionPlanRulesUpdateRecordBlocker[]
): void {
  if (value[key] === true) {
    addBlocker(blockers, blockerCodeForFalseField(key), `${path}.${key}`, `${key} must remain false when recording upload execution Plan/Rules update review.`);
  }
}

function emptyTarget(): KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['target'] {
  return {
    manifestId: null,
    objectKeyRedacted: true,
    objectSha256: null,
    artifactId: null
  };
}

function emptySourceApprovalRecordFingerprint(): KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['sourcePlanRulesReview']['sourceApprovalRecordFingerprint'] {
  return {
    algorithm: 'unsupported',
    scope: 'unsupported',
    value: null,
    canonicalFieldCount: null
  };
}

function emptyAuthorizationBoundaryFingerprint(): KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['sourcePlanRulesReview']['sourceAuthorizationBoundaryFingerprint'] {
  return {
    algorithm: 'unsupported',
    scope: 'unsupported',
    value: null,
    canonicalFieldCount: null
  };
}

function emptyPlanRulesReviewFingerprint(): KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['sourcePlanRulesReview']['reviewFingerprint'] {
  return {
    algorithm: 'unsupported',
    scope: 'unsupported',
    value: null,
    canonicalFieldCount: null
  };
}

function emptySourcePlanRulesReview(): KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['sourcePlanRulesReview'] {
  return {
    source: 'upload-execution-plan-rules-review',
    reviewStatus: 'invalid',
    reviewKind: 'unsupported',
    reviewNextAction: 'invalid',
    sourceAuthorizationBoundaryStatus: 'invalid',
    sourceAuthorizationBoundaryKind: 'unsupported',
    sourceAuthorizationBoundaryNextAction: 'invalid',
    scopeMatched: false,
    humanApprovalRecorded: false,
    approvalFingerprintVerified: false,
    authorizationBoundaryDesigned: false,
    planRulesUpdateReviewRequired: false,
    planRulesUpdated: false,
    rulesUpdateReviewed: false,
    executionStillDisabled: false,
    authorizationGranted: false,
    executionAuthorizationGranted: false,
    approvalGranted: false,
    uploadApproved: false,
    uploadExecutionApproved: false,
    uploadExecutionAllowed: false,
    mutationApprovalGranted: false,
    adapterName: null,
    adapterBackendKind: 'unsupported',
    sourceApprovalRecordFingerprint: emptySourceApprovalRecordFingerprint(),
    sourceAuthorizationBoundaryFingerprint: emptyAuthorizationBoundaryFingerprint(),
    reviewFingerprint: emptyPlanRulesReviewFingerprint()
  };
}

function emptyParsedPlanRulesReview(): ParsedPlanRulesReviewForUpdateRecord {
  return {
    reviewStatus: 'invalid',
    reviewKind: 'unsupported',
    reviewNextAction: 'invalid',
    target: emptyTarget(),
    sourcePlanRulesReview: emptySourcePlanRulesReview()
  };
}

function parseTarget(
  value: unknown,
  blockers: KnowledgeTeamUploadExecutionPlanRulesUpdateRecordBlocker[]
): KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['target'] {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.planRulesReview.target', 'Upload execution Plan/Rules update record requires a target object.');
    addBlocker(blockers, 'unsafe-artifact-reference', '$.planRulesReview.target', 'Upload execution Plan/Rules update record requires safe target references.');
    return emptyTarget();
  }

  const manifestId = readSafeId(value.manifestId);
  const objectSha256 = readSafeSha256(value.objectSha256);
  const artifactId = readSafeId(value.artifactId);

  if (Object.hasOwn(value, 'objectKey') || value.objectKeyRedacted !== true || manifestId === null || objectSha256 === null || artifactId === null) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.planRulesReview.target', 'Upload execution Plan/Rules update record requires redacted object keys and safe manifest, hash, and artifact references.');
  }

  return {
    manifestId,
    objectKeyRedacted: true,
    objectSha256,
    artifactId
  };
}

function validatePlanRulesReviewReadiness(
  value: Record<string, unknown>,
  sourcePlanRulesReview: KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['sourcePlanRulesReview'],
  blockers: KnowledgeTeamUploadExecutionPlanRulesUpdateRecordBlocker[]
): void {
  if (value.kind !== 'infra-agent.knowledge-team-upload-execution-plan-rules-review') {
    addBlocker(blockers, 'invalid-plan-rules-review-kind', '$.planRulesReview.kind', 'Upload execution Plan/Rules update record requires an infra-agent.knowledge-team-upload-execution-plan-rules-review artifact.');
  }
  if (value.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.planRulesReview.schemaVersion', 'Upload execution Plan/Rules update record requires schemaVersion 1.');
  }
  if (value.recordKind !== undefined) {
    addBlocker(blockers, 'invalid-record-kind', '$.planRulesReview.recordKind', 'Upload execution Plan/Rules update record requires a review source, not a record artifact.');
  }
  if (value.reviewKind !== 'upload-execution-plan-rules-review-dry-run') {
    addBlocker(blockers, 'invalid-plan-rules-review-kind', '$.planRulesReview.reviewKind', 'Upload execution Plan/Rules update record requires a dry-run Plan/Rules review source.');
  }
  if (value.status !== 'upload-execution-plan-rules-review-ready') {
    addBlocker(blockers, 'plan-rules-review-not-ready', '$.planRulesReview.status', 'Upload execution Plan/Rules update record requires upload-execution-plan-rules-review-ready input.');
  }
  if (!isRecord(value.readiness) || value.readiness.nextAction !== 'await-explicit-plan-rules-update') {
    addBlocker(blockers, 'plan-rules-review-next-action-invalid', '$.planRulesReview.readiness.nextAction', 'Plan/Rules review must await an explicit Plan/Rules update.');
  }
  if (isRecord(value.readiness) && value.readiness.blockerCount !== 0) {
    addBlocker(blockers, 'plan-rules-review-not-ready', '$.planRulesReview.readiness.blockerCount', 'Upload execution Plan/Rules update record requires an unblocked Plan/Rules review.');
  }
  if (value.uploadCommand !== null) {
    addBlocker(blockers, 'upload-command-present', '$.planRulesReview.uploadCommand', 'Upload execution Plan/Rules update record must not receive upload commands.');
  }

  for (const key of TOP_LEVEL_FALSE_FIELDS) {
    checkFalseField(value, key, '$.planRulesReview', blockers);
  }

  const executionBoundary = isRecord(value.executionBoundary) ? value.executionBoundary : {};
  const sourceAuthorizationBoundary = isRecord(value.sourceAuthorizationBoundary) ? value.sourceAuthorizationBoundary : {};
  const planRulesReview = isRecord(value.planRulesReview) ? value.planRulesReview : {};

  if (!isRecord(value.executionBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.planRulesReview.executionBoundary', 'Upload execution Plan/Rules update record requires execution boundary metadata.');
  }
  if (!isRecord(value.sourceAuthorizationBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.planRulesReview.sourceAuthorizationBoundary', 'Upload execution Plan/Rules update record requires source authorization boundary metadata.');
  }
  if (!isRecord(value.planRulesReview)) {
    addBlocker(blockers, 'missing-required-field', '$.planRulesReview.planRulesReview', 'Upload execution Plan/Rules update record requires Plan/Rules review metadata.');
  }

  for (const key of SOURCE_REVIEW_FALSE_FIELDS) {
    checkFalseField(sourceAuthorizationBoundary, key, '$.planRulesReview.sourceAuthorizationBoundary', blockers);
  }
  for (const key of EXECUTION_BOUNDARY_FALSE_FIELDS) {
    checkFalseField(executionBoundary, key, '$.planRulesReview.executionBoundary', blockers);
  }

  if (sourcePlanRulesReview.reviewStatus !== 'upload-execution-plan-rules-review-ready') {
    addBlocker(blockers, 'plan-rules-review-not-ready', '$.planRulesReview.status', 'Upload execution Plan/Rules update record requires a ready Plan/Rules review source.');
  }
  if (sourcePlanRulesReview.reviewKind !== 'upload-execution-plan-rules-review-dry-run') {
    addBlocker(blockers, 'invalid-plan-rules-review-kind', '$.planRulesReview.reviewKind', 'Upload execution Plan/Rules update record requires a dry-run Plan/Rules review source.');
  }
  if (sourcePlanRulesReview.reviewNextAction !== 'await-explicit-plan-rules-update') {
    addBlocker(blockers, 'plan-rules-review-next-action-invalid', '$.planRulesReview.readiness.nextAction', 'Upload execution Plan/Rules update record requires the explicit Plan/Rules update next action.');
  }
  if (sourcePlanRulesReview.sourceAuthorizationBoundaryStatus !== 'upload-execution-authorization-boundary-ready'
    || sourcePlanRulesReview.sourceAuthorizationBoundaryKind !== 'upload-execution-authorization-boundary-dry-run'
    || sourcePlanRulesReview.sourceAuthorizationBoundaryNextAction !== 'await-plan-rules-update-for-upload-execution') {
    addBlocker(blockers, 'plan-rules-review-not-ready', '$.planRulesReview.sourceAuthorizationBoundary', 'Upload execution Plan/Rules update record requires verified authorization-boundary source state.');
  }
  if (!sourcePlanRulesReview.scopeMatched) {
    addBlocker(blockers, 'scope-not-matched', '$.planRulesReview.sourceAuthorizationBoundary.scopeMatched', 'Upload execution Plan/Rules update record requires matched source scope.');
  }
  if (!sourcePlanRulesReview.humanApprovalRecorded
    || !sourcePlanRulesReview.approvalFingerprintVerified
    || !sourcePlanRulesReview.authorizationBoundaryDesigned) {
    addBlocker(blockers, 'review-fingerprint-unverified', '$.planRulesReview.sourceAuthorizationBoundary', 'Upload execution Plan/Rules update record requires verified source approval and designed authorization boundary.');
  }
  if (sourcePlanRulesReview.adapterName === null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.planRulesReview.sourceAuthorizationBoundary.adapterName', 'Upload execution Plan/Rules update record requires a safe adapter name.');
  }
  if (sourcePlanRulesReview.adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.planRulesReview.sourceAuthorizationBoundary.adapterBackendKind', 'Upload execution Plan/Rules update record remains mock-backend only.');
  }
  if (sourcePlanRulesReview.planRulesUpdateReviewRequired !== true
    || sourcePlanRulesReview.planRulesUpdated !== false
    || sourcePlanRulesReview.rulesUpdateReviewed !== false
    || sourcePlanRulesReview.executionStillDisabled !== true) {
    addBlocker(blockers, 'plan-rules-review-not-ready', '$.planRulesReview.planRulesReview', 'Upload execution Plan/Rules update record requires an unrecorded Plan/Rules review gate with execution disabled.');
  }
  for (const key of SOURCE_REVIEW_FALSE_FIELDS) {
    if (sourcePlanRulesReview[key]) {
      addBlocker(blockers, blockerCodeForFalseField(key), `$.planRulesReview.sourceAuthorizationBoundary.${key}`, `${key} must remain false before Plan/Rules update record.`);
    }
  }
  if (sourcePlanRulesReview.sourceApprovalRecordFingerprint.algorithm !== 'sha256'
    || sourcePlanRulesReview.sourceApprovalRecordFingerprint.scope !== 'stage-knowledge-pack-upload-execution-approval-record-v1'
    || sourcePlanRulesReview.sourceApprovalRecordFingerprint.canonicalFieldCount !== APPROVAL_RECORD_FINGERPRINT_FIELD_COUNT
    || sourcePlanRulesReview.sourceApprovalRecordFingerprint.value === null) {
    addBlocker(blockers, 'plan-rules-review-fingerprint-unsupported', '$.planRulesReview.sourceAuthorizationBoundary.sourceApprovalRecordFingerprint', 'Upload execution Plan/Rules update record requires a supported source approval record fingerprint.');
  }
  if (sourcePlanRulesReview.sourceAuthorizationBoundaryFingerprint.algorithm !== 'sha256'
    || sourcePlanRulesReview.sourceAuthorizationBoundaryFingerprint.scope !== 'stage-knowledge-pack-upload-execution-authorization-boundary-v1'
    || sourcePlanRulesReview.sourceAuthorizationBoundaryFingerprint.canonicalFieldCount !== AUTHORIZATION_BOUNDARY_FINGERPRINT_FIELD_COUNT
    || sourcePlanRulesReview.sourceAuthorizationBoundaryFingerprint.value === null) {
    addBlocker(blockers, 'plan-rules-review-fingerprint-unsupported', '$.planRulesReview.sourceAuthorizationBoundary.authorizationBoundaryFingerprint', 'Upload execution Plan/Rules update record requires a supported authorization boundary fingerprint.');
  }
  if (sourcePlanRulesReview.reviewFingerprint.algorithm !== 'sha256'
    || sourcePlanRulesReview.reviewFingerprint.scope !== 'stage-knowledge-pack-upload-execution-plan-rules-review-v1'
    || sourcePlanRulesReview.reviewFingerprint.canonicalFieldCount !== PLAN_RULES_REVIEW_FINGERPRINT_FIELD_COUNT) {
    addBlocker(blockers, 'plan-rules-review-fingerprint-unsupported', '$.planRulesReview.planRulesReview.reviewFingerprint', 'Upload execution Plan/Rules update record requires a supported Plan/Rules review fingerprint.');
  }
  if (sourcePlanRulesReview.reviewFingerprint.value === null) {
    addBlocker(blockers, 'plan-rules-review-fingerprint-missing', '$.planRulesReview.planRulesReview.reviewFingerprint.value', 'Upload execution Plan/Rules update record requires a safe Plan/Rules review fingerprint.');
  }

  if (planRulesReview.nextRequiredPolicyUpdate !== 'explicit-plan-rules-update') {
    addBlocker(blockers, 'plan-rules-review-not-ready', '$.planRulesReview.planRulesReview.nextRequiredPolicyUpdate', 'Upload execution Plan/Rules update record requires explicit-plan-rules-update source state.');
  }
}

function parsePlanRulesReviewForUpdateRecord(
  value: unknown,
  blockers: KnowledgeTeamUploadExecutionPlanRulesUpdateRecordBlocker[]
): ParsedPlanRulesReviewForUpdateRecord {
  scanForPrivateDetails(value, '$.planRulesReview', blockers);
  if (!isRecord(value)) {
    addBlocker(blockers, 'invalid-plan-rules-review-kind', '$.planRulesReview', 'Upload execution Plan/Rules update record requires a saved Plan/Rules review artifact.');
    return emptyParsedPlanRulesReview();
  }

  const sourceAuthorizationBoundary = isRecord(value.sourceAuthorizationBoundary) ? value.sourceAuthorizationBoundary : {};
  const planRulesReview = isRecord(value.planRulesReview) ? value.planRulesReview : {};
  const readiness = isRecord(value.readiness) ? value.readiness : {};
  const adapterName = typeof sourceAuthorizationBoundary.adapterName === 'string' && isSafeKnowledgeTeamBackendAdapterName(sourceAuthorizationBoundary.adapterName)
    ? sourceAuthorizationBoundary.adapterName
    : null;
  if (sourceAuthorizationBoundary.adapterName !== null && sourceAuthorizationBoundary.adapterName !== undefined && adapterName === null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.planRulesReview.sourceAuthorizationBoundary.adapterName', 'Upload execution Plan/Rules update record requires a safe adapter name.');
  }

  const sourcePlanRulesReview = {
    ...emptySourcePlanRulesReview(),
    source: 'upload-execution-plan-rules-review' as const,
    reviewStatus: readReviewStatus(value.status),
    reviewKind: readReviewKind(value.reviewKind),
    reviewNextAction: readReviewNextAction(readiness.nextAction),
    sourceAuthorizationBoundaryStatus: readSourceAuthorizationBoundaryStatus(sourceAuthorizationBoundary.boundaryStatus),
    sourceAuthorizationBoundaryKind: readSourceAuthorizationBoundaryKind(sourceAuthorizationBoundary.boundaryKind),
    sourceAuthorizationBoundaryNextAction: readSourceAuthorizationBoundaryNextAction(sourceAuthorizationBoundary.boundaryNextAction),
    scopeMatched: readBool(sourceAuthorizationBoundary.scopeMatched),
    humanApprovalRecorded: readBool(sourceAuthorizationBoundary.humanApprovalRecorded),
    approvalFingerprintVerified: readBool(sourceAuthorizationBoundary.approvalFingerprintVerified),
    authorizationBoundaryDesigned: readBool(sourceAuthorizationBoundary.authorizationBoundaryDesigned),
    planRulesUpdateReviewRequired: readBool(planRulesReview.planRulesUpdateReviewRequired),
    planRulesUpdated: readBool(planRulesReview.planRulesUpdated),
    rulesUpdateReviewed: readBool(planRulesReview.rulesUpdateReviewed),
    executionStillDisabled: readBool(planRulesReview.executionStillDisabled),
    authorizationGranted: false,
    executionAuthorizationGranted: false,
    approvalGranted: false,
    uploadApproved: false,
    uploadExecutionApproved: false,
    uploadExecutionAllowed: false,
    mutationApprovalGranted: false,
    adapterName,
    adapterBackendKind: readAdapterBackendKind(sourceAuthorizationBoundary.adapterBackendKind),
    sourceApprovalRecordFingerprint: readSafeSourceApprovalRecordFingerprint(sourceAuthorizationBoundary.sourceApprovalRecordFingerprint),
    sourceAuthorizationBoundaryFingerprint: readSafeAuthorizationBoundaryFingerprint(sourceAuthorizationBoundary.authorizationBoundaryFingerprint),
    reviewFingerprint: readSafePlanRulesReviewFingerprint(planRulesReview.reviewFingerprint)
  };

  const parsed = {
    reviewStatus: sourcePlanRulesReview.reviewStatus,
    reviewKind: sourcePlanRulesReview.reviewKind,
    reviewNextAction: sourcePlanRulesReview.reviewNextAction,
    target: parseTarget(value.target, blockers),
    sourcePlanRulesReview
  };

  validatePlanRulesReviewReadiness(value, sourcePlanRulesReview, blockers);
  return parsed;
}

function parseReviewFingerprint(
  value: unknown,
  blockers: KnowledgeTeamUploadExecutionPlanRulesUpdateRecordBlocker[]
): string | null {
  if (typeof value !== 'string') {
    addBlocker(blockers, 'review-fingerprint-missing', '$.reviewFingerprint', 'Upload execution Plan/Rules update record requires --review-fingerprint <sha256>.');
    return null;
  }
  if (!SAFE_FINGERPRINT_PATTERN.test(value)) {
    addBlocker(blockers, 'unsafe-review-fingerprint', '$.reviewFingerprint', 'Upload execution Plan/Rules update record requires a safe SHA-256 review fingerprint.');
    return null;
  }
  return value;
}

function buildRecordFingerprint(
  parsed: ParsedPlanRulesReviewForUpdateRecord,
  suppliedFingerprint: string | null,
  ready: boolean
): KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['planRulesUpdateRecord']['recordFingerprint'] {
  if (!ready
    || suppliedFingerprint === null
    || parsed.target.manifestId === null
    || parsed.target.objectSha256 === null
    || parsed.target.artifactId === null
    || parsed.sourcePlanRulesReview.sourceApprovalRecordFingerprint.value === null
    || parsed.sourcePlanRulesReview.sourceAuthorizationBoundaryFingerprint.value === null
    || parsed.sourcePlanRulesReview.reviewFingerprint.value === null) {
    return {
      algorithm: 'sha256',
      scope: 'stage-knowledge-pack-upload-execution-plan-rules-update-record-v1',
      value: null,
      canonicalFieldCount: PLAN_RULES_UPDATE_RECORD_FINGERPRINT_FIELD_COUNT
    };
  }

  const canonicalFields = [
    ['scope', 'stage-knowledge-pack-upload-execution-plan-rules-update-record-v1'],
    ['plannedOperation', 'stage-knowledge-pack'],
    ['sourceKind', 'infra-agent.knowledge-team-upload-execution-plan-rules-review'],
    ['sourceStatus', parsed.reviewStatus],
    ['sourceNextAction', parsed.reviewNextAction],
    ['manifestId', parsed.target.manifestId],
    ['objectSha256', parsed.target.objectSha256],
    ['artifactId', parsed.target.artifactId],
    ['sourceApprovalRecordFingerprint', parsed.sourcePlanRulesReview.sourceApprovalRecordFingerprint.value],
    ['sourceAuthorizationBoundaryFingerprint', parsed.sourcePlanRulesReview.sourceAuthorizationBoundaryFingerprint.value],
    ['sourcePlanRulesReviewFingerprint', parsed.sourcePlanRulesReview.reviewFingerprint.value],
    ['suppliedReviewFingerprint', suppliedFingerprint],
    ['planRulesUpdateRecorded', 'true'],
    ['rulesUpdateReviewed', 'true'],
    ['policyUpdateAuthorized', 'false'],
    ['executionStillDisabled', 'true'],
    ['uploadExecutionAllowed', 'false'],
    ['mutationApprovalGranted', 'false']
  ] as const;

  return {
    algorithm: 'sha256',
    scope: 'stage-knowledge-pack-upload-execution-plan-rules-update-record-v1',
    value: createHash('sha256')
      .update(canonicalFields.map(([key, value]) => `${key}=${value}`).join('\n'))
      .digest('hex'),
    canonicalFieldCount: PLAN_RULES_UPDATE_RECORD_FINGERPRINT_FIELD_COUNT
  };
}

function buildExecutionBoundary(): KnowledgeTeamUploadExecutionPlanRulesUpdateRecord['executionBoundary'] {
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

export function buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord(
  input: KnowledgeTeamUploadExecutionPlanRulesUpdateRecordInput
): KnowledgeTeamUploadExecutionPlanRulesUpdateRecord {
  const blockers: KnowledgeTeamUploadExecutionPlanRulesUpdateRecordBlocker[] = [];
  const parsed = parsePlanRulesReviewForUpdateRecord(input.planRulesReview, blockers);
  const suppliedFingerprint = parseReviewFingerprint(input.reviewFingerprint, blockers);
  const expectedFingerprint = parsed.sourcePlanRulesReview.reviewFingerprint.value;
  const fingerprintVerified = suppliedFingerprint !== null
    && expectedFingerprint !== null
    && suppliedFingerprint === expectedFingerprint;

  if (suppliedFingerprint !== null && expectedFingerprint !== null && suppliedFingerprint !== expectedFingerprint) {
    addBlocker(blockers, 'review-fingerprint-mismatch', '$.reviewFingerprint', 'Supplied review fingerprint must match the Plan/Rules review fingerprint.');
  }
  if (expectedFingerprint === null) {
    addBlocker(blockers, 'plan-rules-review-fingerprint-missing', '$.planRulesReview.planRulesReview.reviewFingerprint.value', 'Plan/Rules review source must include a safe review fingerprint.');
  }

  const ready = blockers.length === 0 && fingerprintVerified;
  const status: KnowledgeTeamUploadExecutionPlanRulesUpdateRecordStatus = ready
    ? 'upload-execution-plan-rules-update-record-ready'
    : 'blocked';
  const recordFingerprint = buildRecordFingerprint(parsed, suppliedFingerprint, ready);

  return {
    kind: 'infra-agent.knowledge-team-upload-execution-plan-rules-update-record',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    recordKind: 'upload-execution-plan-rules-update-record-dry-run',
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
    sourcePlanRulesReview: parsed.sourcePlanRulesReview,
    planRulesUpdateRecord: {
      explicitPlanRulesUpdateRequired: true,
      humanReviewRequired: true,
      planRulesUpdateRecorded: ready,
      rulesUpdateReviewed: ready,
      policyUpdateAuthorized: false,
      executionStillDisabled: true,
      source: suppliedFingerprint === null ? null : 'cli-flag',
      suppliedFingerprint,
      expectedFingerprint,
      fingerprintVerified,
      sourceReviewFingerprint: parsed.sourcePlanRulesReview.reviewFingerprint,
      recordFingerprint,
      authorizationGranted: false,
      executionAuthorizationGranted: false,
      uploadApproved: false,
      uploadExecutionApproved: false,
      uploadExecutionAllowed: false,
      mutationApprovalGranted: false
    },
    executionBoundary: buildExecutionBoundary(),
    readiness: {
      status,
      nextAction: ready ? 'design-upload-execution-implementation-boundary' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: [...new Set(blockers.map((blocker) => blocker.code))],
      blockers,
      reason: ready
        ? 'Upload execution Plan/Rules update fingerprint is recorded, but execution remains disabled until a later implementation boundary is designed.'
        : 'Upload execution Plan/Rules update record is blocked because the review source or supplied fingerprint is incomplete, unsafe, mismatched, leaky, or already executable.'
    }
  };
}
