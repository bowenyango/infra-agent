import { createHash } from 'node:crypto';
import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadExecutionRuntimeBoundariesStatus =
  | 'upload-execution-runtime-boundaries-ready'
  | 'blocked';

export type KnowledgeTeamUploadExecutionRuntimeBoundariesNextAction =
  | 'await-explicit-upload-execution-runtime-boundary-policy-review'
  | 'resolve-blockers';

export type KnowledgeTeamUploadExecutionRuntimeBoundariesBlockerCode =
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
  | 'implementation-boundary-fingerprint-missing'
  | 'implementation-boundary-fingerprint-unsupported'
  | 'implementation-boundary-fingerprint-unverified'
  | 'implementation-boundary-next-action-invalid'
  | 'implementation-boundary-not-ready'
  | 'implementation-enabled-execution'
  | 'invalid-implementation-boundary-kind'
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
  | 'runtime-boundaries-enabled-execution'
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

export interface KnowledgeTeamUploadExecutionRuntimeBoundariesBlocker {
  code: KnowledgeTeamUploadExecutionRuntimeBoundariesBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadExecutionRuntimeBoundaries {
  kind: 'infra-agent.knowledge-team-upload-execution-runtime-boundaries';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  boundaryKind: 'upload-execution-runtime-boundaries-dry-run';
  status: KnowledgeTeamUploadExecutionRuntimeBoundariesStatus;
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
  sourceImplementationBoundary: {
    source: 'upload-execution-implementation-boundary';
    boundaryStatus: 'upload-execution-implementation-boundary-ready' | 'blocked' | 'invalid';
    boundaryKind: 'upload-execution-implementation-boundary-dry-run' | 'unsupported';
    boundaryNextAction: 'design-upload-execution-runtime-boundaries' | 'resolve-blockers' | 'invalid';
    sourceUpdateRecordStatus: 'upload-execution-plan-rules-update-record-ready' | 'blocked' | 'invalid';
    sourceUpdateRecordNextAction: 'design-upload-execution-implementation-boundary' | 'resolve-blockers' | 'invalid';
    implementationBoundaryDesigned: boolean;
    sourceUpdateRecordFingerprintVerified: boolean;
    runtimeBoundaryDesignRequired: boolean;
    implementationAllowed: boolean;
    executionStillDisabled: boolean;
    authorizationGranted: boolean;
    executionAuthorizationGranted: boolean;
    uploadApproved: boolean;
    uploadExecutionApproved: boolean;
    uploadExecutionAllowed: boolean;
    mutationApprovalGranted: boolean;
    adapterName: string | null;
    adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
    sourceUpdateRecordFingerprint: {
      algorithm: 'sha256' | 'unsupported';
      scope: 'stage-knowledge-pack-upload-execution-plan-rules-update-record-v1' | 'unsupported';
      value: string | null;
      canonicalFieldCount: number | null;
    };
    implementationBoundaryFingerprint: {
      algorithm: 'sha256' | 'unsupported';
      scope: 'stage-knowledge-pack-upload-execution-implementation-boundary-v1' | 'unsupported';
      value: string | null;
      canonicalFieldCount: number | null;
    };
  };
  runtimeBoundaries: {
    dryRunOnly: true;
    runtimeBoundariesDesigned: boolean;
    sourceImplementationBoundaryFingerprintVerified: boolean;
    separateRuntimeArtifactsRequired: true;
    artifactBytesRuntimeBoundaryRequired: true;
    adapterInjectionRuntimeBoundaryRequired: true;
    clientCreationRuntimeBoundaryRequired: true;
    credentialReadRuntimeBoundaryRequired: true;
    credentialPresenceRuntimeBoundaryRequired: true;
    liveCheckRuntimeBoundaryRequired: true;
    uploadCommandRuntimeBoundaryRequired: true;
    objectIndexBindingRuntimeBoundaryRequired: true;
    writeTokenRuntimeBoundaryRequired: true;
    executionLeaseRuntimeBoundaryRequired: true;
    rollbackPlanRuntimeBoundaryRequired: true;
    auditRecordRuntimeBoundaryRequired: true;
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
    runtimeExecutionAllowed: false;
    authorizationGranted: false;
    executionAuthorizationGranted: false;
    uploadApproved: false;
    uploadExecutionApproved: false;
    uploadExecutionAllowed: false;
    mutationApprovalGranted: false;
    executable: false;
    sourceImplementationBoundaryFingerprint: {
      algorithm: 'sha256' | 'unsupported';
      scope: 'stage-knowledge-pack-upload-execution-implementation-boundary-v1' | 'unsupported';
      value: string | null;
      canonicalFieldCount: number | null;
    };
    runtimeBoundariesFingerprint: {
      algorithm: 'sha256';
      scope: 'stage-knowledge-pack-upload-execution-runtime-boundaries-v1';
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
    status: KnowledgeTeamUploadExecutionRuntimeBoundariesStatus;
    nextAction: KnowledgeTeamUploadExecutionRuntimeBoundariesNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadExecutionRuntimeBoundariesBlockerCode[];
    blockers: KnowledgeTeamUploadExecutionRuntimeBoundariesBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadExecutionRuntimeBoundariesInput {
  implementationBoundary: unknown;
}

interface ParsedImplementationBoundaryForRuntimeBoundaries {
  boundaryStatus: KnowledgeTeamUploadExecutionRuntimeBoundaries['sourceImplementationBoundary']['boundaryStatus'];
  boundaryKind: KnowledgeTeamUploadExecutionRuntimeBoundaries['sourceImplementationBoundary']['boundaryKind'];
  boundaryNextAction: KnowledgeTeamUploadExecutionRuntimeBoundaries['sourceImplementationBoundary']['boundaryNextAction'];
  target: KnowledgeTeamUploadExecutionRuntimeBoundaries['target'];
  sourceImplementationBoundary: KnowledgeTeamUploadExecutionRuntimeBoundaries['sourceImplementationBoundary'];
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const SAFE_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const PLAN_RULES_UPDATE_RECORD_FINGERPRINT_FIELD_COUNT = 18;
const IMPLEMENTATION_BOUNDARY_FINGERPRINT_FIELD_COUNT = 18;
const RUNTIME_BOUNDARIES_FINGERPRINT_FIELD_COUNT = 20;
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
  blockers: KnowledgeTeamUploadExecutionRuntimeBoundariesBlocker[],
  code: KnowledgeTeamUploadExecutionRuntimeBoundariesBlockerCode,
  path: string,
  message: string
): void {
  if (!blockers.some((blocker) => blocker.code === code && blocker.path === path)) {
    blockers.push({ code, path, message });
  }
}

function inspectForForbiddenRuntimeMaterial(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadExecutionRuntimeBoundariesBlocker[]
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
      addBlocker(blockers, 'backend-detail-leak', entryPath, 'Input must not include backend details, secrets, token/lease/rollback/audit material, or runtime secrets.');
    }
    inspectForForbiddenRuntimeMaterial(entry, entryPath, blockers);
  }
}

function emptyTarget(): KnowledgeTeamUploadExecutionRuntimeBoundaries['target'] {
  return {
    manifestId: null,
    objectKeyRedacted: true,
    objectSha256: null,
    artifactId: null
  };
}

function emptyFingerprint(
  scope: KnowledgeTeamUploadExecutionRuntimeBoundaries['sourceImplementationBoundary']['sourceUpdateRecordFingerprint']['scope'],
  canonicalFieldCount: number
): {
  algorithm: 'sha256' | 'unsupported';
  scope: typeof scope;
  value: string | null;
  canonicalFieldCount: number | null;
} {
  return {
    algorithm: 'sha256',
    scope,
    value: null,
    canonicalFieldCount
  };
}

function emptySourceImplementationBoundary(): KnowledgeTeamUploadExecutionRuntimeBoundaries['sourceImplementationBoundary'] {
  return {
    source: 'upload-execution-implementation-boundary',
    boundaryStatus: 'invalid',
    boundaryKind: 'unsupported',
    boundaryNextAction: 'invalid',
    sourceUpdateRecordStatus: 'invalid',
    sourceUpdateRecordNextAction: 'invalid',
    implementationBoundaryDesigned: false,
    sourceUpdateRecordFingerprintVerified: false,
    runtimeBoundaryDesignRequired: false,
    implementationAllowed: false,
    executionStillDisabled: false,
    authorizationGranted: false,
    executionAuthorizationGranted: false,
    uploadApproved: false,
    uploadExecutionApproved: false,
    uploadExecutionAllowed: false,
    mutationApprovalGranted: false,
    adapterName: null,
    adapterBackendKind: 'unsupported',
    sourceUpdateRecordFingerprint: emptyFingerprint('stage-knowledge-pack-upload-execution-plan-rules-update-record-v1', PLAN_RULES_UPDATE_RECORD_FINGERPRINT_FIELD_COUNT),
    implementationBoundaryFingerprint: emptyFingerprint('stage-knowledge-pack-upload-execution-implementation-boundary-v1', IMPLEMENTATION_BOUNDARY_FINGERPRINT_FIELD_COUNT)
  };
}

function readSafeTarget(
  boundary: Record<string, unknown>,
  blockers: KnowledgeTeamUploadExecutionRuntimeBoundariesBlocker[]
): KnowledgeTeamUploadExecutionRuntimeBoundaries['target'] {
  if (!isRecord(boundary.target)) {
    addBlocker(blockers, 'missing-required-field', '$.implementationBoundary.target', 'Implementation boundary target must be an object.');
    return emptyTarget();
  }
  const target = boundary.target;
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
    addBlocker(blockers, 'unsafe-artifact-reference', '$.implementationBoundary.target.manifestId', 'Target manifest id must be a safe 24-character lowercase hex id.');
  }
  if (artifactId === null) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.implementationBoundary.target.artifactId', 'Target artifact id must be a safe 24-character lowercase hex id.');
  }
  if (objectSha256 === null) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.implementationBoundary.target.objectSha256', 'Target object hash must be a safe SHA-256 hex digest.');
  }
  if (target.objectKeyRedacted !== true) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.implementationBoundary.target.objectKeyRedacted', 'Target object key must remain redacted.');
  }
  if (Object.hasOwn(target, 'objectKey')) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.implementationBoundary.target.objectKey', 'Target object key must not be copied into runtime boundaries output.');
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
  blockers: KnowledgeTeamUploadExecutionRuntimeBoundariesBlocker[]
): {
  algorithm: 'sha256' | 'unsupported';
  scope: 'stage-knowledge-pack-upload-execution-plan-rules-update-record-v1' | 'stage-knowledge-pack-upload-execution-implementation-boundary-v1' | 'unsupported';
  value: string | null;
  canonicalFieldCount: number | null;
} {
  if (!isRecord(value)) {
    addBlocker(blockers, 'implementation-boundary-fingerprint-missing', path, 'Required source fingerprint object is missing.');
    return {
      algorithm: 'sha256',
      scope: expectedScope as 'stage-knowledge-pack-upload-execution-plan-rules-update-record-v1',
      value: null,
      canonicalFieldCount: expectedCanonicalFieldCount
    };
  }
  const algorithm = value.algorithm === 'sha256' ? 'sha256' : 'unsupported';
  const scope = value.scope === expectedScope
    ? expectedScope as 'stage-knowledge-pack-upload-execution-plan-rules-update-record-v1'
    : 'unsupported';
  const canonicalFieldCount = value.canonicalFieldCount === expectedCanonicalFieldCount
    ? expectedCanonicalFieldCount
    : null;
  const fingerprintValue = typeof value.value === 'string' && SAFE_FINGERPRINT_PATTERN.test(value.value)
    ? value.value
    : null;

  if (algorithm !== 'sha256' || scope === 'unsupported' || canonicalFieldCount === null) {
    addBlocker(blockers, 'implementation-boundary-fingerprint-unsupported', path, 'Source fingerprint metadata must use the expected sha256 scope and canonical field count.');
  }
  if (fingerprintValue === null) {
    addBlocker(blockers, 'implementation-boundary-fingerprint-missing', `${path}.value`, 'Source fingerprint value must be a safe SHA-256 hex string.');
  }

  return {
    algorithm,
    scope,
    value: fingerprintValue,
    canonicalFieldCount
  };
}

function readBoundaryStatus(value: unknown): KnowledgeTeamUploadExecutionRuntimeBoundaries['sourceImplementationBoundary']['boundaryStatus'] {
  return value === 'upload-execution-implementation-boundary-ready' || value === 'blocked' ? value : 'invalid';
}

function readBoundaryKind(value: unknown): KnowledgeTeamUploadExecutionRuntimeBoundaries['sourceImplementationBoundary']['boundaryKind'] {
  return value === 'upload-execution-implementation-boundary-dry-run' ? value : 'unsupported';
}

function readBoundaryNextAction(value: unknown): KnowledgeTeamUploadExecutionRuntimeBoundaries['sourceImplementationBoundary']['boundaryNextAction'] {
  return value === 'design-upload-execution-runtime-boundaries' || value === 'resolve-blockers' ? value : 'invalid';
}

function readUpdateRecordStatus(value: unknown): KnowledgeTeamUploadExecutionRuntimeBoundaries['sourceImplementationBoundary']['sourceUpdateRecordStatus'] {
  return value === 'upload-execution-plan-rules-update-record-ready' || value === 'blocked' ? value : 'invalid';
}

function readUpdateRecordNextAction(value: unknown): KnowledgeTeamUploadExecutionRuntimeBoundaries['sourceImplementationBoundary']['sourceUpdateRecordNextAction'] {
  return value === 'design-upload-execution-implementation-boundary' || value === 'resolve-blockers' ? value : 'invalid';
}

function readAdapterBackendKind(value: unknown): KnowledgeTeamUploadExecutionRuntimeBoundaries['sourceImplementationBoundary']['adapterBackendKind'] {
  return value === 'mock-s3-compatible' || value === 's3-compatible' ? value : 'unsupported';
}

function validateNonExecutionPosture(
  boundary: Record<string, unknown>,
  blockers: KnowledgeTeamUploadExecutionRuntimeBoundariesBlocker[]
): void {
  for (const field of TOP_LEVEL_FALSE_FIELDS) {
    if (boundary[field] !== false) {
      addBlocker(blockers, blockerCodeForFalseField(field), `$.implementationBoundary.${field}`, `${field} must remain false before runtime boundary design.`);
    }
  }
  if (boundary.uploadCommand !== null) {
    addBlocker(blockers, 'upload-command-present', '$.implementationBoundary.uploadCommand', 'Implementation boundary must not include upload commands.');
  }
  if (!isRecord(boundary.executionBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.implementationBoundary.executionBoundary', 'Implementation boundary executionBoundary must be an object.');
    return;
  }
  if (boundary.executionBoundary.dryRunOnly !== true) {
    addBlocker(blockers, 'executable-state-enabled', '$.implementationBoundary.executionBoundary.dryRunOnly', 'Execution boundary must remain dry-run only.');
  }
  for (const field of EXECUTION_BOUNDARY_FALSE_FIELDS) {
    if (boundary.executionBoundary[field] !== false) {
      addBlocker(blockers, blockerCodeForFalseField(field), `$.implementationBoundary.executionBoundary.${field}`, `${field} must remain false before runtime boundary design.`);
    }
  }
}

function blockerCodeForFalseField(field: string): KnowledgeTeamUploadExecutionRuntimeBoundariesBlockerCode {
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
      return 'runtime-boundaries-enabled-execution';
  }
}

function parseImplementationBoundaryForRuntimeBoundaries(
  input: unknown,
  blockers: KnowledgeTeamUploadExecutionRuntimeBoundariesBlocker[]
): ParsedImplementationBoundaryForRuntimeBoundaries {
  inspectForForbiddenRuntimeMaterial(input, '$.implementationBoundary', blockers);
  if (!isRecord(input)) {
    addBlocker(blockers, 'missing-required-field', '$.implementationBoundary', 'Implementation boundary input must be an object.');
    return {
      boundaryStatus: 'invalid',
      boundaryKind: 'unsupported',
      boundaryNextAction: 'invalid',
      target: emptyTarget(),
      sourceImplementationBoundary: emptySourceImplementationBoundary()
    };
  }

  if (input.kind !== 'infra-agent.knowledge-team-upload-execution-implementation-boundary') {
    addBlocker(blockers, 'invalid-implementation-boundary-kind', '$.implementationBoundary.kind', 'Input must be an implementation boundary artifact.');
  }
  if (input.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.implementationBoundary.schemaVersion', 'Implementation boundary schemaVersion must be 1.');
  }
  if (input.mutationAllowed !== false || input.executionMode !== 'dry-run') {
    addBlocker(blockers, 'mutation-enabled', '$.implementationBoundary.mutationAllowed', 'Implementation boundary must remain dry-run and non-mutating.');
  }

  validateNonExecutionPosture(input, blockers);

  const boundaryStatus = readBoundaryStatus(input.status);
  const boundaryKind = readBoundaryKind(input.boundaryKind);
  const boundaryNextAction = isRecord(input.readiness) ? readBoundaryNextAction(input.readiness.nextAction) : 'invalid';
  if (boundaryKind !== 'upload-execution-implementation-boundary-dry-run') {
    addBlocker(blockers, 'invalid-implementation-boundary-kind', '$.implementationBoundary.boundaryKind', 'Implementation boundary kind is unsupported.');
  }
  if (boundaryStatus !== 'upload-execution-implementation-boundary-ready') {
    addBlocker(blockers, 'implementation-boundary-not-ready', '$.implementationBoundary.status', 'Implementation boundary must be ready.');
  }
  if (boundaryNextAction !== 'design-upload-execution-runtime-boundaries') {
    addBlocker(blockers, 'implementation-boundary-next-action-invalid', '$.implementationBoundary.readiness.nextAction', 'Implementation boundary must point at runtime boundary design.');
  }

  const target = readSafeTarget(input, blockers);
  const sourcePlanRulesUpdateRecord = isRecord(input.sourcePlanRulesUpdateRecord) ? input.sourcePlanRulesUpdateRecord : {};
  const implementationBoundary = isRecord(input.implementationBoundary) ? input.implementationBoundary : {};
  if (!isRecord(input.sourcePlanRulesUpdateRecord)) {
    addBlocker(blockers, 'missing-required-field', '$.implementationBoundary.sourcePlanRulesUpdateRecord', 'Source Plan/Rules update record summary must be present.');
  }
  if (!isRecord(input.implementationBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.implementationBoundary.implementationBoundary', 'Implementation boundary summary must be present.');
  }

  const adapterName = typeof sourcePlanRulesUpdateRecord.adapterName === 'string' && isSafeKnowledgeTeamBackendAdapterName(sourcePlanRulesUpdateRecord.adapterName)
    ? sourcePlanRulesUpdateRecord.adapterName
    : null;
  if (adapterName === null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.implementationBoundary.sourcePlanRulesUpdateRecord.adapterName', 'Source adapter name must be present and safe.');
  }
  const adapterBackendKind = readAdapterBackendKind(sourcePlanRulesUpdateRecord.adapterBackendKind);
  if (adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.implementationBoundary.sourcePlanRulesUpdateRecord.adapterBackendKind', 'Runtime boundary design currently supports only mock-s3-compatible dry-run sources.');
  }

  const sourceUpdateRecordFingerprint = readFingerprint(
    implementationBoundary.sourceUpdateRecordFingerprint,
    '$.implementationBoundary.implementationBoundary.sourceUpdateRecordFingerprint',
    'stage-knowledge-pack-upload-execution-plan-rules-update-record-v1',
    PLAN_RULES_UPDATE_RECORD_FINGERPRINT_FIELD_COUNT,
    blockers
  );
  const implementationBoundaryFingerprint = readFingerprint(
    implementationBoundary.implementationBoundaryFingerprint,
    '$.implementationBoundary.implementationBoundary.implementationBoundaryFingerprint',
    'stage-knowledge-pack-upload-execution-implementation-boundary-v1',
    IMPLEMENTATION_BOUNDARY_FINGERPRINT_FIELD_COUNT,
    blockers
  );

  const source: KnowledgeTeamUploadExecutionRuntimeBoundaries['sourceImplementationBoundary'] = {
    source: 'upload-execution-implementation-boundary',
    boundaryStatus,
    boundaryKind,
    boundaryNextAction,
    sourceUpdateRecordStatus: readUpdateRecordStatus(sourcePlanRulesUpdateRecord.recordStatus),
    sourceUpdateRecordNextAction: readUpdateRecordNextAction(sourcePlanRulesUpdateRecord.recordNextAction),
    implementationBoundaryDesigned: readBool(implementationBoundary.implementationBoundaryDesigned),
    sourceUpdateRecordFingerprintVerified: readBool(implementationBoundary.sourceUpdateRecordFingerprintVerified),
    runtimeBoundaryDesignRequired: readBool(implementationBoundary.runtimeBoundaryDesignRequired),
    implementationAllowed: readBool(implementationBoundary.implementationAllowed),
    executionStillDisabled: readBool(sourcePlanRulesUpdateRecord.executionStillDisabled),
    authorizationGranted: readBool(implementationBoundary.authorizationGranted),
    executionAuthorizationGranted: readBool(implementationBoundary.executionAuthorizationGranted),
    uploadApproved: readBool(implementationBoundary.uploadApproved),
    uploadExecutionApproved: readBool(implementationBoundary.uploadExecutionApproved),
    uploadExecutionAllowed: readBool(implementationBoundary.uploadExecutionAllowed),
    mutationApprovalGranted: readBool(implementationBoundary.mutationApprovalGranted),
    adapterName,
    adapterBackendKind,
    sourceUpdateRecordFingerprint,
    implementationBoundaryFingerprint
  };

  if (source.sourceUpdateRecordStatus !== 'upload-execution-plan-rules-update-record-ready'
    || source.sourceUpdateRecordNextAction !== 'design-upload-execution-implementation-boundary') {
    addBlocker(blockers, 'implementation-boundary-not-ready', '$.implementationBoundary.sourcePlanRulesUpdateRecord', 'Source Plan/Rules update record summary must remain ready for implementation boundary.');
  }
  for (const [field, expected] of [
    ['implementationBoundaryDesigned', true],
    ['sourceUpdateRecordFingerprintVerified', true],
    ['runtimeBoundaryDesignRequired', true],
    ['implementationAllowed', false],
    ['executionStillDisabled', true],
    ['authorizationGranted', false],
    ['executionAuthorizationGranted', false],
    ['uploadApproved', false],
    ['uploadExecutionApproved', false],
    ['uploadExecutionAllowed', false],
    ['mutationApprovalGranted', false]
  ] as const) {
    if (source[field] !== expected) {
      addBlocker(blockers, blockerCodeForSourceField(field), `$.implementationBoundary.${field}`, `${field} must remain ${expected} before runtime boundary design.`);
    }
  }

  if (sourceUpdateRecordFingerprint.value === null || implementationBoundaryFingerprint.value === null) {
    addBlocker(blockers, 'implementation-boundary-fingerprint-unverified', '$.implementationBoundary.implementationBoundary', 'Implementation boundary fingerprints must be verified before runtime boundary design.');
  }

  return {
    boundaryStatus,
    boundaryKind,
    boundaryNextAction,
    target,
    sourceImplementationBoundary: source
  };
}

function blockerCodeForSourceField(field: string): KnowledgeTeamUploadExecutionRuntimeBoundariesBlockerCode {
  switch (field) {
    case 'implementationBoundaryDesigned':
    case 'sourceUpdateRecordFingerprintVerified':
    case 'runtimeBoundaryDesignRequired':
      return 'implementation-boundary-not-ready';
    case 'implementationAllowed':
      return 'implementation-enabled-execution';
    case 'authorizationGranted':
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
    case 'executionStillDisabled':
      return 'executable-state-enabled';
    default:
      return 'runtime-boundaries-enabled-execution';
  }
}

function buildRuntimeBoundariesFingerprint(
  parsed: ParsedImplementationBoundaryForRuntimeBoundaries,
  ready: boolean
): KnowledgeTeamUploadExecutionRuntimeBoundaries['runtimeBoundaries']['runtimeBoundariesFingerprint'] {
  if (!ready || parsed.sourceImplementationBoundary.implementationBoundaryFingerprint.value === null) {
    return {
      algorithm: 'sha256',
      scope: 'stage-knowledge-pack-upload-execution-runtime-boundaries-v1',
      value: null,
      canonicalFieldCount: RUNTIME_BOUNDARIES_FINGERPRINT_FIELD_COUNT
    };
  }

  const canonicalFields = [
    ['scope', 'stage-knowledge-pack-upload-execution-runtime-boundaries-v1'],
    ['plannedOperation', 'stage-knowledge-pack'],
    ['sourceKind', 'infra-agent.knowledge-team-upload-execution-implementation-boundary'],
    ['sourceStatus', parsed.boundaryStatus],
    ['sourceNextAction', parsed.boundaryNextAction],
    ['manifestId', parsed.target.manifestId],
    ['objectSha256', parsed.target.objectSha256],
    ['artifactId', parsed.target.artifactId],
    ['sourceUpdateRecordFingerprint', parsed.sourceImplementationBoundary.sourceUpdateRecordFingerprint.value],
    ['sourceImplementationBoundaryFingerprint', parsed.sourceImplementationBoundary.implementationBoundaryFingerprint.value],
    ['runtimeBoundariesDesigned', 'true'],
    ['sourceImplementationBoundaryFingerprintVerified', 'true'],
    ['separateRuntimeArtifactsRequired', 'true'],
    ['artifactBytesRuntimeBoundaryRequired', 'true'],
    ['adapterInjectionRuntimeBoundaryRequired', 'true'],
    ['clientCreationRuntimeBoundaryRequired', 'true'],
    ['credentialRuntimeBoundariesRequired', 'true'],
    ['uploadCommandRuntimeBoundaryRequired', 'true'],
    ['objectIndexBindingRuntimeBoundaryRequired', 'true'],
    ['remoteMutationStillProhibited', 'true']
  ] as const;

  return {
    algorithm: 'sha256',
    scope: 'stage-knowledge-pack-upload-execution-runtime-boundaries-v1',
    value: createHash('sha256')
      .update(canonicalFields.map(([key, value]) => `${key}=${value}`).join('\n'))
      .digest('hex'),
    canonicalFieldCount: RUNTIME_BOUNDARIES_FINGERPRINT_FIELD_COUNT
  };
}

function buildExecutionBoundary(): KnowledgeTeamUploadExecutionRuntimeBoundaries['executionBoundary'] {
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

export function buildKnowledgeTeamUploadExecutionRuntimeBoundaries(
  input: KnowledgeTeamUploadExecutionRuntimeBoundariesInput
): KnowledgeTeamUploadExecutionRuntimeBoundaries {
  const blockers: KnowledgeTeamUploadExecutionRuntimeBoundariesBlocker[] = [];
  const parsed = parseImplementationBoundaryForRuntimeBoundaries(input.implementationBoundary, blockers);
  const ready = blockers.length === 0;
  const status: KnowledgeTeamUploadExecutionRuntimeBoundariesStatus = ready
    ? 'upload-execution-runtime-boundaries-ready'
    : 'blocked';
  const runtimeBoundariesFingerprint = buildRuntimeBoundariesFingerprint(parsed, ready);

  return {
    kind: 'infra-agent.knowledge-team-upload-execution-runtime-boundaries',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    boundaryKind: 'upload-execution-runtime-boundaries-dry-run',
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
    sourceImplementationBoundary: parsed.sourceImplementationBoundary,
    runtimeBoundaries: {
      dryRunOnly: true,
      runtimeBoundariesDesigned: ready,
      sourceImplementationBoundaryFingerprintVerified: ready,
      separateRuntimeArtifactsRequired: true,
      artifactBytesRuntimeBoundaryRequired: true,
      adapterInjectionRuntimeBoundaryRequired: true,
      clientCreationRuntimeBoundaryRequired: true,
      credentialReadRuntimeBoundaryRequired: true,
      credentialPresenceRuntimeBoundaryRequired: true,
      liveCheckRuntimeBoundaryRequired: true,
      uploadCommandRuntimeBoundaryRequired: true,
      objectIndexBindingRuntimeBoundaryRequired: true,
      writeTokenRuntimeBoundaryRequired: true,
      executionLeaseRuntimeBoundaryRequired: true,
      rollbackPlanRuntimeBoundaryRequired: true,
      auditRecordRuntimeBoundaryRequired: true,
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
      runtimeExecutionAllowed: false,
      authorizationGranted: false,
      executionAuthorizationGranted: false,
      uploadApproved: false,
      uploadExecutionApproved: false,
      uploadExecutionAllowed: false,
      mutationApprovalGranted: false,
      executable: false,
      sourceImplementationBoundaryFingerprint: parsed.sourceImplementationBoundary.implementationBoundaryFingerprint,
      runtimeBoundariesFingerprint
    },
    executionBoundary: buildExecutionBoundary(),
    readiness: {
      status,
      nextAction: ready ? 'await-explicit-upload-execution-runtime-boundary-policy-review' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: [...new Set(blockers.map((blocker) => blocker.code))],
      blockers,
      reason: ready
        ? 'Upload execution runtime boundaries are designed as dry-run checkpoints; runtime artifacts and execution remain prohibited.'
        : 'Upload execution runtime boundaries are blocked because the implementation boundary is incomplete, unsafe, leaky, non-ready, or already executable.'
    }
  };
}
