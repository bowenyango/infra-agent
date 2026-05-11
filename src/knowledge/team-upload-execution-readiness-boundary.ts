import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadExecutionReadinessBoundaryStatus =
  | 'upload-execution-readiness-boundary-ready'
  | 'blocked';

export type KnowledgeTeamUploadExecutionReadinessBoundaryNextAction =
  | 'request-separate-upload-execution-approval'
  | 'resolve-blockers';

export type KnowledgeTeamUploadExecutionReadinessBoundaryBlockerCode =
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
  | 'invalid-boundary-kind'
  | 'invalid-object-index-binding-boundary-kind'
  | 'invalid-schema-version'
  | 'live-check-enabled'
  | 'live-check-result-exposed'
  | 'metadata-index-bound'
  | 'metadata-index-handle-leak'
  | 'metadata-index-write-attempted'
  | 'missing-required-field'
  | 'mutation-approval-already-granted'
  | 'mutation-enabled'
  | 'object-index-binding-boundary-next-action-invalid'
  | 'object-index-binding-boundary-not-ready'
  | 'object-index-binding-not-required'
  | 'object-index-binding-state-enabled'
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
  | 'upload-approval-already-provided'
  | 'upload-command-exposed'
  | 'upload-command-generated'
  | 'upload-command-not-required'
  | 'upload-command-present'
  | 'upload-execution-enabled'
  | 'write-token-issued';

export interface KnowledgeTeamUploadExecutionReadinessBoundaryBlocker {
  code: KnowledgeTeamUploadExecutionReadinessBoundaryBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadExecutionReadinessBoundary {
  kind: 'infra-agent.knowledge-team-upload-execution-readiness-boundary';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  boundaryKind: 'upload-execution-readiness-boundary-dry-run';
  status: KnowledgeTeamUploadExecutionReadinessBoundaryStatus;
  plannedOperation: 'stage-knowledge-pack';
  remoteWriteAllowed: false;
  liveCheckAllowed: false;
  credentialValuesExposed: false;
  credentialPresenceChecked: false;
  uploadApproved: false;
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
  sourceObjectIndexBindingBoundary: {
    source: 'upload-object-index-binding-boundary';
    boundaryStatus: 'object-index-binding-boundary-ready' | 'blocked' | 'invalid';
    boundaryKind: 'object-index-binding-boundary-dry-run' | 'unsupported';
    boundaryNextAction: 'design-upload-execution-readiness-boundary' | 'resolve-blockers' | 'invalid';
    reviewStatus: 'review-ready' | 'blocked' | 'invalid';
    reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
    scopeMatched: boolean;
    humanReviewRecorded: boolean;
    fingerprintVerified: boolean;
    sourceFingerprintVerified: boolean;
    adapterName: string | null;
    adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
    dryRunOnly: boolean;
    bindingRequiredAfterUploadCommandBoundary: boolean;
    uploadCommandBoundaryRequired: boolean;
    uploadCommandRequiredBeforeExecution: boolean;
    uploadCommandDescriptorRequired: boolean;
    uploadCommandPayloadRedactionRequired: boolean;
    uploadCommandMaterialRedactionRequired: boolean;
    commandExecutionApprovalRequired: boolean;
    objectStoreBindingRequired: boolean;
    metadataIndexBindingRequired: boolean;
    objectStoreDescriptorRequired: boolean;
    metadataIndexDescriptorRequired: boolean;
    objectKeyRedactionRequired: boolean;
    metadataIndexEntryRedactionRequired: boolean;
    contentAddressedObjectKeysRequired: boolean;
    contentAddressedIndexKeysRequired: boolean;
    idempotentObjectWriteRequired: boolean;
    idempotentMetadataIndexWriteRequired: boolean;
    objectWriteRequiresExecutionBoundary: boolean;
    metadataIndexWriteRequiresExecutionBoundary: boolean;
    explicitUploadApprovalRequired: boolean;
    credentialValuesRead: boolean;
    credentialValuesExposed: boolean;
    credentialPresenceChecked: boolean;
    credentialPresenceResultExposed: boolean;
    clientCreated: boolean;
    sdkClientCreated: boolean;
    adapterInjected: boolean;
    artifactBytesProvided: boolean;
    artifactObjectStoreBound: boolean;
    metadataIndexBound: boolean;
    objectStoreHandleExposed: boolean;
    metadataIndexHandleExposed: boolean;
    liveCheckAllowed: boolean;
    liveCheckPerformed: boolean;
    liveCheckResultExposed: boolean;
    uploadCommandGenerated: boolean;
    uploadCommandMaterialized: boolean;
    uploadCommandExposed: boolean;
    uploadExecutionAllowed: boolean;
    objectWriteAllowed: boolean;
    metadataIndexWriteAllowed: boolean;
    objectWriteAttempted: boolean;
    metadataIndexWriteAttempted: boolean;
    remoteMutationPerformed: boolean;
    executable: boolean;
  };
  uploadExecutionReadinessBoundary: {
    dryRunOnly: true;
    executionReadinessModeled: true;
    objectIndexBindingBoundaryRequired: true;
    artifactBytesBoundaryRequired: true;
    adapterInjectionBoundaryRequired: true;
    clientCreationBoundaryRequired: true;
    credentialReadBoundaryRequired: true;
    credentialPresenceBoundaryRequired: true;
    liveCheckBoundaryRequired: true;
    uploadCommandBoundaryRequired: true;
    objectStoreBindingRequired: true;
    metadataIndexBindingRequired: true;
    writeTokenRequired: true;
    executionLeaseRequired: true;
    rollbackPlanRequired: true;
    auditRecordRequired: true;
    objectWriteRequiresExecutionApproval: true;
    metadataIndexWriteRequiresExecutionApproval: true;
    explicitUploadApprovalRequired: true;
    separateExecutionApprovalRequired: true;
    mutationApprovalRequired: true;
    commandExecutionApprovalRequired: true;
    contentAddressedObjectKeysRequired: true;
    contentAddressedIndexKeysRequired: true;
    idempotentObjectWriteRequired: true;
    idempotentMetadataIndexWriteRequired: true;
    uploadApproved: false;
    uploadExecutionAllowed: false;
    mutationApprovalGranted: false;
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
    executable: false;
  };
  remainingExecutionBoundaries: {
    artifactBytesRequired: true;
    artifactBytesProvided: false;
    adapterInjectionRequired: true;
    adapterInjected: false;
    clientCreationRequired: true;
    clientCreated: false;
    credentialReadRequired: true;
    credentialValuesExposed: false;
    credentialPresenceCheckRequired: true;
    credentialPresenceChecked: false;
    liveCheckRequired: true;
    liveCheckPerformed: false;
    uploadCommandRequired: true;
    uploadCommandGenerated: false;
    objectIndexBindingRequired: true;
    artifactObjectStoreBound: false;
    metadataIndexBound: false;
    uploadExecutionApprovalRequired: true;
    uploadExecutionApproved: false;
    mutationApprovalRequired: true;
    mutationApprovalGranted: false;
    writeTokenRequired: true;
    writeTokenIssued: false;
    executionLeaseRequired: true;
    executionLeaseCreated: false;
    rollbackPlanRequired: true;
    rollbackPlanCreated: false;
    auditRecordRequired: true;
    auditRecordCreated: false;
    objectWriteAllowed: false;
    metadataIndexWriteAllowed: false;
    remoteMutationAllowed: false;
  };
  readiness: {
    status: KnowledgeTeamUploadExecutionReadinessBoundaryStatus;
    nextAction: KnowledgeTeamUploadExecutionReadinessBoundaryNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadExecutionReadinessBoundaryBlockerCode[];
    blockers: KnowledgeTeamUploadExecutionReadinessBoundaryBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadExecutionReadinessBoundaryInput {
  objectIndexBindingBoundary: unknown;
}

interface ParsedObjectIndexBindingBoundaryForExecutionReadinessBoundary {
  boundaryStatus: 'object-index-binding-boundary-ready' | 'blocked' | 'invalid';
  boundaryKind: 'object-index-binding-boundary-dry-run' | 'unsupported';
  boundaryNextAction: 'design-upload-execution-readiness-boundary' | 'resolve-blockers' | 'invalid';
  sourceObjectIndexBindingBoundary: KnowledgeTeamUploadExecutionReadinessBoundary['sourceObjectIndexBindingBoundary'];
  target: KnowledgeTeamUploadExecutionReadinessBoundary['target'];
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBool(value: unknown): boolean {
  return value === true;
}

function addBlocker(
  blockers: KnowledgeTeamUploadExecutionReadinessBoundaryBlocker[],
  code: KnowledgeTeamUploadExecutionReadinessBoundaryBlockerCode,
  path: string,
  message: string
): void {
  blockers.push({ code, path, message });
}

function scanForPrivateDetails(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadExecutionReadinessBoundaryBlocker[]
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForPrivateDetails(entry, `${path}[${index}]`, blockers));
    return;
  }
  if (!isRecord(value)) {
    if (typeof value === 'string' && FORBIDDEN_LEAK_VALUE_PATTERN.test(value)) {
      addBlocker(blockers, 'backend-detail-leak', path, 'Execution readiness boundary input must not contain backend details, private paths, credentials, executable commands, live-check results, object/index handles, or raw artifact content.');
    }
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    if (key === 'objectKey') {
      addBlocker(blockers, 'unsafe-artifact-reference', entryPath, 'Execution readiness boundary input must not contain target object keys.');
      continue;
    }
    if (FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'artifact-bytes-provided', entryPath, 'Execution readiness boundary input must not contain raw bytes, byte buffers, streams, content payloads, or local artifact paths.');
      continue;
    }
    if (FORBIDDEN_CLIENT_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'client-dependency-leak', entryPath, 'Execution readiness boundary input must not contain SDK clients, client configs, signed URLs, or write functions.');
      continue;
    }
    if (FORBIDDEN_CREDENTIAL_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'credential-dependency-leak', entryPath, 'Execution readiness boundary input must not contain credential values, credential files, environment reads, or credential presence results.');
      continue;
    }
    if (FORBIDDEN_LIVE_CHECK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'live-check-enabled', entryPath, 'Execution readiness boundary input must not contain live backend probes, live-check requests, or live-check results.');
      continue;
    }
    if (FORBIDDEN_COMMAND_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'upload-command-present', entryPath, 'Execution readiness boundary input must not contain upload command payloads or executable command material.');
      continue;
    }
    if (FORBIDDEN_ADAPTER_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'adapter-dependency-leak', entryPath, 'Execution readiness boundary input must not contain adapter instances or concrete adapter values.');
      continue;
    }
    if (FORBIDDEN_OBJECT_STORE_HANDLE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'object-store-handle-leak', entryPath, 'Execution readiness boundary input must not contain object store handles or object write functions.');
      continue;
    }
    if (FORBIDDEN_METADATA_INDEX_HANDLE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'metadata-index-handle-leak', entryPath, 'Execution readiness boundary input must not contain metadata index handles, metadata index entries, or index write functions.');
      continue;
    }
    if (FORBIDDEN_LEAK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'backend-detail-leak', entryPath, 'Execution readiness boundary input must not contain backend details, credential fields, commands, token/lease material, rollback material, audit material, or raw artifact content.');
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

function readBoundaryStatus(value: unknown): ParsedObjectIndexBindingBoundaryForExecutionReadinessBoundary['boundaryStatus'] {
  if (value === 'object-index-binding-boundary-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readBoundaryKind(value: unknown): ParsedObjectIndexBindingBoundaryForExecutionReadinessBoundary['boundaryKind'] {
  if (value === 'object-index-binding-boundary-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readBoundaryNextAction(value: unknown): ParsedObjectIndexBindingBoundaryForExecutionReadinessBoundary['boundaryNextAction'] {
  if (value === 'design-upload-execution-readiness-boundary' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readReviewStatus(value: unknown): KnowledgeTeamUploadExecutionReadinessBoundary['sourceObjectIndexBindingBoundary']['reviewStatus'] {
  if (value === 'review-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readReviewKind(value: unknown): KnowledgeTeamUploadExecutionReadinessBoundary['sourceObjectIndexBindingBoundary']['reviewKind'] {
  if (value === 'human-fingerprint-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readAdapterBackendKind(value: unknown): KnowledgeTeamUploadExecutionReadinessBoundary['sourceObjectIndexBindingBoundary']['adapterBackendKind'] {
  if (value === 'mock-s3-compatible' || value === 's3-compatible') {
    return value;
  }
  return 'unsupported';
}

function parseTarget(
  value: unknown,
  blockers: KnowledgeTeamUploadExecutionReadinessBoundaryBlocker[]
): KnowledgeTeamUploadExecutionReadinessBoundary['target'] {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.objectIndexBindingBoundary.target', 'Execution readiness boundary planning requires a target object.');
    addBlocker(blockers, 'unsafe-artifact-reference', '$.objectIndexBindingBoundary.target', 'Execution readiness boundary planning requires safe target references.');
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
    addBlocker(blockers, 'unsafe-artifact-reference', '$.objectIndexBindingBoundary.target', 'Execution readiness boundary planning requires redacted object keys and safe manifest, hash, and artifact references.');
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
  code: KnowledgeTeamUploadExecutionReadinessBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadExecutionReadinessBoundaryBlocker[]
): void {
  if (value[key] === true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must remain false for execution readiness boundary planning.`);
  }
}

function checkRequiredTrue(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadExecutionReadinessBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadExecutionReadinessBoundaryBlocker[]
): void {
  if (value[key] !== true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be true before execution readiness boundary planning can proceed.`);
  }
}

function checkRequiredFalse(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadExecutionReadinessBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadExecutionReadinessBoundaryBlocker[]
): void {
  if (value[key] !== false) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be false before execution readiness boundary planning can proceed.`);
  }
}

function blockerCodeForFalseField(key: string): KnowledgeTeamUploadExecutionReadinessBoundaryBlockerCode {
  if (key === 'uploadApproved') return 'upload-approval-already-provided';
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

function emptyParsedObjectIndexBindingBoundary(): ParsedObjectIndexBindingBoundaryForExecutionReadinessBoundary {
  return {
    boundaryStatus: 'invalid',
    boundaryKind: 'unsupported',
    boundaryNextAction: 'invalid',
    sourceObjectIndexBindingBoundary: {
      source: 'upload-object-index-binding-boundary',
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
      dryRunOnly: false,
      bindingRequiredAfterUploadCommandBoundary: false,
      uploadCommandBoundaryRequired: false,
      uploadCommandRequiredBeforeExecution: false,
      uploadCommandDescriptorRequired: false,
      uploadCommandPayloadRedactionRequired: false,
      uploadCommandMaterialRedactionRequired: false,
      commandExecutionApprovalRequired: false,
      objectStoreBindingRequired: false,
      metadataIndexBindingRequired: false,
      objectStoreDescriptorRequired: false,
      metadataIndexDescriptorRequired: false,
      objectKeyRedactionRequired: false,
      metadataIndexEntryRedactionRequired: false,
      contentAddressedObjectKeysRequired: false,
      contentAddressedIndexKeysRequired: false,
      idempotentObjectWriteRequired: false,
      idempotentMetadataIndexWriteRequired: false,
      objectWriteRequiresExecutionBoundary: false,
      metadataIndexWriteRequiresExecutionBoundary: false,
      explicitUploadApprovalRequired: false,
      credentialValuesRead: false,
      credentialValuesExposed: false,
      credentialPresenceChecked: false,
      credentialPresenceResultExposed: false,
      clientCreated: false,
      sdkClientCreated: false,
      adapterInjected: false,
      artifactBytesProvided: false,
      artifactObjectStoreBound: false,
      metadataIndexBound: false,
      objectStoreHandleExposed: false,
      metadataIndexHandleExposed: false,
      liveCheckAllowed: false,
      liveCheckPerformed: false,
      liveCheckResultExposed: false,
      uploadCommandGenerated: false,
      uploadCommandMaterialized: false,
      uploadCommandExposed: false,
      uploadExecutionAllowed: false,
      objectWriteAllowed: false,
      metadataIndexWriteAllowed: false,
      objectWriteAttempted: false,
      metadataIndexWriteAttempted: false,
      remoteMutationPerformed: false,
      executable: false
    },
    target: {
      manifestId: null,
      objectKeyRedacted: true,
      objectSha256: null,
      artifactId: null
    }
  };
}

function parseObjectIndexBindingBoundaryForExecutionReadinessBoundary(
  value: unknown,
  blockers: KnowledgeTeamUploadExecutionReadinessBoundaryBlocker[]
): ParsedObjectIndexBindingBoundaryForExecutionReadinessBoundary {
  scanForPrivateDetails(value, '$.objectIndexBindingBoundary', blockers);
  if (!isRecord(value)) {
    addBlocker(blockers, 'invalid-object-index-binding-boundary-kind', '$.objectIndexBindingBoundary', 'Execution readiness boundary planning requires a saved object/index binding boundary artifact.');
    return emptyParsedObjectIndexBindingBoundary();
  }

  if (value.kind !== 'infra-agent.knowledge-team-upload-object-index-binding-boundary') {
    addBlocker(blockers, 'invalid-object-index-binding-boundary-kind', '$.objectIndexBindingBoundary.kind', 'Execution readiness boundary planning requires an infra-agent.knowledge-team-upload-object-index-binding-boundary artifact.');
  }
  if (value.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.objectIndexBindingBoundary.schemaVersion', 'Execution readiness boundary planning requires schemaVersion 1.');
  }
  if (value.boundaryKind !== 'object-index-binding-boundary-dry-run') {
    addBlocker(blockers, 'invalid-boundary-kind', '$.objectIndexBindingBoundary.boundaryKind', 'Execution readiness boundary planning requires an object-index-binding-boundary-dry-run source.');
  }
  if (value.status !== 'object-index-binding-boundary-ready') {
    addBlocker(blockers, 'object-index-binding-boundary-not-ready', '$.objectIndexBindingBoundary.status', 'Execution readiness boundary planning requires object-index-binding-boundary-ready input.');
  }
  if (!isRecord(value.readiness) || value.readiness.nextAction !== 'design-upload-execution-readiness-boundary') {
    addBlocker(blockers, 'object-index-binding-boundary-next-action-invalid', '$.objectIndexBindingBoundary.readiness.nextAction', 'Object/index binding boundary must point to design-upload-execution-readiness-boundary.');
  }
  if (value.uploadCommand !== null) {
    addBlocker(blockers, 'upload-command-present', '$.objectIndexBindingBoundary.uploadCommand', 'Execution readiness boundary planning must not receive upload commands.');
  }

  for (const key of [
    'uploadApproved',
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
    checkFalseField(value, key, '$.objectIndexBindingBoundary', blockerCodeForFalseField(key), blockers);
  }
  checkFalseField(value, 'liveCheckAllowed', '$.objectIndexBindingBoundary', 'live-check-enabled', blockers);
  checkFalseField(value, 'credentialValuesExposed', '$.objectIndexBindingBoundary', 'credential-values-exposed', blockers);
  checkFalseField(value, 'credentialPresenceChecked', '$.objectIndexBindingBoundary', 'credential-presence-check-enabled', blockers);

  const sourceUploadCommandBoundary = isRecord(value.sourceUploadCommandBoundary) ? value.sourceUploadCommandBoundary : {};
  const objectIndexBindingBoundary = isRecord(value.objectIndexBindingBoundary) ? value.objectIndexBindingBoundary : {};
  const remainingExecutionBoundaries = isRecord(value.remainingExecutionBoundaries) ? value.remainingExecutionBoundaries : {};
  if (!isRecord(value.sourceUploadCommandBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.objectIndexBindingBoundary.sourceUploadCommandBoundary', 'Execution readiness boundary planning requires source upload command metadata.');
  }
  if (!isRecord(value.objectIndexBindingBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.objectIndexBindingBoundary.objectIndexBindingBoundary', 'Execution readiness boundary planning requires object/index binding metadata.');
  }
  if (!isRecord(value.remainingExecutionBoundaries)) {
    addBlocker(blockers, 'missing-required-field', '$.objectIndexBindingBoundary.remainingExecutionBoundaries', 'Execution readiness boundary planning requires remaining execution boundary metadata.');
  }

  for (const key of [
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
  ]) {
    checkRequiredTrue(objectIndexBindingBoundary, key, '$.objectIndexBindingBoundary.objectIndexBindingBoundary', key === 'objectStoreBindingRequired' ? 'artifact-object-store-bound' : key === 'metadataIndexBindingRequired' ? 'metadata-index-bound' : 'missing-required-field', blockers);
  }

  for (const [key, code] of [
    ['credentialValuesRead', 'credential-values-read'],
    ['credentialValuesExposed', 'credential-values-exposed'],
    ['credentialPresenceChecked', 'credential-presence-check-enabled'],
    ['credentialPresenceResultExposed', 'credential-presence-result-exposed'],
    ['clientCreated', 'client-created'],
    ['sdkClientCreated', 'client-created'],
    ['adapterInjected', 'adapter-injected'],
    ['artifactBytesProvided', 'artifact-bytes-provided'],
    ['artifactObjectStoreBound', 'artifact-object-store-bound'],
    ['metadataIndexBound', 'metadata-index-bound'],
    ['objectStoreHandleExposed', 'object-store-handle-leak'],
    ['metadataIndexHandleExposed', 'metadata-index-handle-leak'],
    ['liveCheckAllowed', 'live-check-enabled'],
    ['liveCheckPerformed', 'live-check-enabled'],
    ['liveCheckResultExposed', 'live-check-result-exposed'],
    ['uploadCommandGenerated', 'upload-command-generated'],
    ['uploadCommandMaterialized', 'upload-command-generated'],
    ['uploadCommandExposed', 'upload-command-exposed'],
    ['uploadExecutionAllowed', 'upload-execution-enabled'],
    ['objectWriteAllowed', 'remote-write-enabled'],
    ['metadataIndexWriteAllowed', 'remote-write-enabled'],
    ['objectWriteAttempted', 'object-write-attempted'],
    ['metadataIndexWriteAttempted', 'metadata-index-write-attempted'],
    ['remoteMutationPerformed', 'remote-mutation-performed'],
    ['executable', 'executable-state-enabled']
  ] as const) {
    checkRequiredFalse(objectIndexBindingBoundary, key, '$.objectIndexBindingBoundary.objectIndexBindingBoundary', code, blockers);
  }

  checkRequiredTrue(remainingExecutionBoundaries, 'uploadCommandRequired', '$.objectIndexBindingBoundary.remainingExecutionBoundaries', 'upload-command-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'objectIndexBindingRequired', '$.objectIndexBindingBoundary.remainingExecutionBoundaries', 'object-index-binding-not-required', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'uploadCommandGenerated', '$.objectIndexBindingBoundary.remainingExecutionBoundaries', 'upload-command-generated', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'artifactObjectStoreBound', '$.objectIndexBindingBoundary.remainingExecutionBoundaries', 'artifact-object-store-bound', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'metadataIndexBound', '$.objectIndexBindingBoundary.remainingExecutionBoundaries', 'metadata-index-bound', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'objectWriteAllowed', '$.objectIndexBindingBoundary.remainingExecutionBoundaries', 'remote-write-enabled', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'metadataIndexWriteAllowed', '$.objectIndexBindingBoundary.remainingExecutionBoundaries', 'remote-write-enabled', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'remoteMutationAllowed', '$.objectIndexBindingBoundary.remainingExecutionBoundaries', 'remote-write-enabled', blockers);

  const reviewStatus = readReviewStatus(sourceUploadCommandBoundary.reviewStatus);
  const reviewKind = readReviewKind(sourceUploadCommandBoundary.reviewKind);
  const adapterBackendKind = readAdapterBackendKind(sourceUploadCommandBoundary.adapterBackendKind);
  const adapterName = typeof sourceUploadCommandBoundary.adapterName === 'string' && isSafeKnowledgeTeamBackendAdapterName(sourceUploadCommandBoundary.adapterName)
    ? sourceUploadCommandBoundary.adapterName
    : null;
  if (sourceUploadCommandBoundary.adapterName !== null && sourceUploadCommandBoundary.adapterName !== undefined && adapterName === null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.objectIndexBindingBoundary.sourceUploadCommandBoundary.adapterName', 'Execution readiness boundary planning requires a safe adapter name.');
  }
  if (reviewStatus !== 'review-ready' || reviewKind !== 'human-fingerprint-dry-run' || !readBool(sourceUploadCommandBoundary.scopeMatched) || !readBool(sourceUploadCommandBoundary.humanReviewRecorded) || !readBool(sourceUploadCommandBoundary.fingerprintVerified) || !readBool(sourceUploadCommandBoundary.sourceFingerprintVerified)) {
    addBlocker(blockers, 'review-fingerprint-unverified', '$.objectIndexBindingBoundary.sourceUploadCommandBoundary', 'Execution readiness boundary planning requires verified review and scope metadata from the object/index binding source.');
  }
  if (adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.objectIndexBindingBoundary.sourceUploadCommandBoundary.adapterBackendKind', 'Execution readiness boundary planning remains mock-backend only.');
  }

  const sourceObjectIndexBindingBoundary: KnowledgeTeamUploadExecutionReadinessBoundary['sourceObjectIndexBindingBoundary'] = {
    source: 'upload-object-index-binding-boundary',
    boundaryStatus: readBoundaryStatus(value.status),
    boundaryKind: readBoundaryKind(value.boundaryKind),
    boundaryNextAction: isRecord(value.readiness) ? readBoundaryNextAction(value.readiness.nextAction) : 'invalid',
    reviewStatus,
    reviewKind,
    scopeMatched: readBool(sourceUploadCommandBoundary.scopeMatched),
    humanReviewRecorded: readBool(sourceUploadCommandBoundary.humanReviewRecorded),
    fingerprintVerified: readBool(sourceUploadCommandBoundary.fingerprintVerified),
    sourceFingerprintVerified: readBool(sourceUploadCommandBoundary.sourceFingerprintVerified),
    adapterName,
    adapterBackendKind,
    dryRunOnly: readBool(objectIndexBindingBoundary.dryRunOnly),
    bindingRequiredAfterUploadCommandBoundary: readBool(objectIndexBindingBoundary.bindingRequiredAfterUploadCommandBoundary),
    uploadCommandBoundaryRequired: readBool(objectIndexBindingBoundary.uploadCommandBoundaryRequired),
    uploadCommandRequiredBeforeExecution: readBool(objectIndexBindingBoundary.uploadCommandRequiredBeforeExecution),
    uploadCommandDescriptorRequired: readBool(objectIndexBindingBoundary.uploadCommandDescriptorRequired),
    uploadCommandPayloadRedactionRequired: readBool(objectIndexBindingBoundary.uploadCommandPayloadRedactionRequired),
    uploadCommandMaterialRedactionRequired: readBool(objectIndexBindingBoundary.uploadCommandMaterialRedactionRequired),
    commandExecutionApprovalRequired: readBool(objectIndexBindingBoundary.commandExecutionApprovalRequired),
    objectStoreBindingRequired: readBool(objectIndexBindingBoundary.objectStoreBindingRequired),
    metadataIndexBindingRequired: readBool(objectIndexBindingBoundary.metadataIndexBindingRequired),
    objectStoreDescriptorRequired: readBool(objectIndexBindingBoundary.objectStoreDescriptorRequired),
    metadataIndexDescriptorRequired: readBool(objectIndexBindingBoundary.metadataIndexDescriptorRequired),
    objectKeyRedactionRequired: readBool(objectIndexBindingBoundary.objectKeyRedactionRequired),
    metadataIndexEntryRedactionRequired: readBool(objectIndexBindingBoundary.metadataIndexEntryRedactionRequired),
    contentAddressedObjectKeysRequired: readBool(objectIndexBindingBoundary.contentAddressedObjectKeysRequired),
    contentAddressedIndexKeysRequired: readBool(objectIndexBindingBoundary.contentAddressedIndexKeysRequired),
    idempotentObjectWriteRequired: readBool(objectIndexBindingBoundary.idempotentObjectWriteRequired),
    idempotentMetadataIndexWriteRequired: readBool(objectIndexBindingBoundary.idempotentMetadataIndexWriteRequired),
    objectWriteRequiresExecutionBoundary: readBool(objectIndexBindingBoundary.objectWriteRequiresExecutionBoundary),
    metadataIndexWriteRequiresExecutionBoundary: readBool(objectIndexBindingBoundary.metadataIndexWriteRequiresExecutionBoundary),
    explicitUploadApprovalRequired: readBool(objectIndexBindingBoundary.explicitUploadApprovalRequired),
    credentialValuesRead: readBool(objectIndexBindingBoundary.credentialValuesRead),
    credentialValuesExposed: readBool(objectIndexBindingBoundary.credentialValuesExposed),
    credentialPresenceChecked: readBool(objectIndexBindingBoundary.credentialPresenceChecked),
    credentialPresenceResultExposed: readBool(objectIndexBindingBoundary.credentialPresenceResultExposed),
    clientCreated: readBool(objectIndexBindingBoundary.clientCreated),
    sdkClientCreated: readBool(objectIndexBindingBoundary.sdkClientCreated),
    adapterInjected: readBool(objectIndexBindingBoundary.adapterInjected),
    artifactBytesProvided: readBool(objectIndexBindingBoundary.artifactBytesProvided),
    artifactObjectStoreBound: readBool(objectIndexBindingBoundary.artifactObjectStoreBound),
    metadataIndexBound: readBool(objectIndexBindingBoundary.metadataIndexBound),
    objectStoreHandleExposed: readBool(objectIndexBindingBoundary.objectStoreHandleExposed),
    metadataIndexHandleExposed: readBool(objectIndexBindingBoundary.metadataIndexHandleExposed),
    liveCheckAllowed: readBool(objectIndexBindingBoundary.liveCheckAllowed),
    liveCheckPerformed: readBool(objectIndexBindingBoundary.liveCheckPerformed),
    liveCheckResultExposed: readBool(objectIndexBindingBoundary.liveCheckResultExposed),
    uploadCommandGenerated: readBool(objectIndexBindingBoundary.uploadCommandGenerated),
    uploadCommandMaterialized: readBool(objectIndexBindingBoundary.uploadCommandMaterialized),
    uploadCommandExposed: readBool(objectIndexBindingBoundary.uploadCommandExposed),
    uploadExecutionAllowed: readBool(objectIndexBindingBoundary.uploadExecutionAllowed),
    objectWriteAllowed: readBool(objectIndexBindingBoundary.objectWriteAllowed),
    metadataIndexWriteAllowed: readBool(objectIndexBindingBoundary.metadataIndexWriteAllowed),
    objectWriteAttempted: readBool(objectIndexBindingBoundary.objectWriteAttempted),
    metadataIndexWriteAttempted: readBool(objectIndexBindingBoundary.metadataIndexWriteAttempted),
    remoteMutationPerformed: readBool(objectIndexBindingBoundary.remoteMutationPerformed),
    executable: readBool(objectIndexBindingBoundary.executable)
  };

  return {
    boundaryStatus: sourceObjectIndexBindingBoundary.boundaryStatus,
    boundaryKind: sourceObjectIndexBindingBoundary.boundaryKind,
    boundaryNextAction: sourceObjectIndexBindingBoundary.boundaryNextAction,
    sourceObjectIndexBindingBoundary,
    target: parseTarget(value.target, blockers)
  };
}

export function buildKnowledgeTeamUploadExecutionReadinessBoundary(
  input: KnowledgeTeamUploadExecutionReadinessBoundaryInput
): KnowledgeTeamUploadExecutionReadinessBoundary {
  const blockers: KnowledgeTeamUploadExecutionReadinessBoundaryBlocker[] = [];
  const parsedBoundary = parseObjectIndexBindingBoundaryForExecutionReadinessBoundary(input.objectIndexBindingBoundary, blockers);
  const status: KnowledgeTeamUploadExecutionReadinessBoundaryStatus = blockers.length === 0
    ? 'upload-execution-readiness-boundary-ready'
    : 'blocked';

  return {
    kind: 'infra-agent.knowledge-team-upload-execution-readiness-boundary',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    boundaryKind: 'upload-execution-readiness-boundary-dry-run',
    status,
    plannedOperation: 'stage-knowledge-pack',
    remoteWriteAllowed: false,
    liveCheckAllowed: false,
    credentialValuesExposed: false,
    credentialPresenceChecked: false,
    uploadApproved: false,
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
    sourceObjectIndexBindingBoundary: parsedBoundary.sourceObjectIndexBindingBoundary,
    uploadExecutionReadinessBoundary: {
      dryRunOnly: true,
      executionReadinessModeled: true,
      objectIndexBindingBoundaryRequired: true,
      artifactBytesBoundaryRequired: true,
      adapterInjectionBoundaryRequired: true,
      clientCreationBoundaryRequired: true,
      credentialReadBoundaryRequired: true,
      credentialPresenceBoundaryRequired: true,
      liveCheckBoundaryRequired: true,
      uploadCommandBoundaryRequired: true,
      objectStoreBindingRequired: true,
      metadataIndexBindingRequired: true,
      writeTokenRequired: true,
      executionLeaseRequired: true,
      rollbackPlanRequired: true,
      auditRecordRequired: true,
      objectWriteRequiresExecutionApproval: true,
      metadataIndexWriteRequiresExecutionApproval: true,
      explicitUploadApprovalRequired: true,
      separateExecutionApprovalRequired: true,
      mutationApprovalRequired: true,
      commandExecutionApprovalRequired: true,
      contentAddressedObjectKeysRequired: true,
      contentAddressedIndexKeysRequired: true,
      idempotentObjectWriteRequired: true,
      idempotentMetadataIndexWriteRequired: true,
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
    },
    remainingExecutionBoundaries: {
      artifactBytesRequired: true,
      artifactBytesProvided: false,
      adapterInjectionRequired: true,
      adapterInjected: false,
      clientCreationRequired: true,
      clientCreated: false,
      credentialReadRequired: true,
      credentialValuesExposed: false,
      credentialPresenceCheckRequired: true,
      credentialPresenceChecked: false,
      liveCheckRequired: true,
      liveCheckPerformed: false,
      uploadCommandRequired: true,
      uploadCommandGenerated: false,
      objectIndexBindingRequired: true,
      artifactObjectStoreBound: false,
      metadataIndexBound: false,
      uploadExecutionApprovalRequired: true,
      uploadExecutionApproved: false,
      mutationApprovalRequired: true,
      mutationApprovalGranted: false,
      writeTokenRequired: true,
      writeTokenIssued: false,
      executionLeaseRequired: true,
      executionLeaseCreated: false,
      rollbackPlanRequired: true,
      rollbackPlanCreated: false,
      auditRecordRequired: true,
      auditRecordCreated: false,
      objectWriteAllowed: false,
      metadataIndexWriteAllowed: false,
      remoteMutationAllowed: false
    },
    readiness: {
      status,
      nextAction: status === 'upload-execution-readiness-boundary-ready' ? 'request-separate-upload-execution-approval' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: blockers.map(entry => entry.code),
      blockers,
      reason: status === 'upload-execution-readiness-boundary-ready'
        ? 'Upload execution readiness is modeled from the object/index binding boundary, but no upload approval is granted, no command is generated or exposed, no client or adapter is created, and all remote mutation remains disabled until separate execution approval is requested.'
        : 'Upload execution readiness planning is blocked until all object/index binding boundary blockers are resolved.'
    }
  };
}
