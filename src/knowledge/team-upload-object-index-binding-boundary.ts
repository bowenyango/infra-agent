import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadObjectIndexBindingBoundaryStatus =
  | 'object-index-binding-boundary-ready'
  | 'blocked';

export type KnowledgeTeamUploadObjectIndexBindingBoundaryNextAction =
  | 'design-upload-execution-readiness-boundary'
  | 'resolve-blockers';

export type KnowledgeTeamUploadObjectIndexBindingBoundaryBlockerCode =
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
  | 'invalid-schema-version'
  | 'invalid-upload-command-boundary-kind'
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
  | 'upload-approval-already-provided'
  | 'upload-command-boundary-next-action-invalid'
  | 'upload-command-boundary-not-ready'
  | 'upload-command-exposed'
  | 'upload-command-generated'
  | 'upload-command-not-required'
  | 'upload-command-present'
  | 'upload-execution-enabled'
  | 'write-token-issued';

export interface KnowledgeTeamUploadObjectIndexBindingBoundaryBlocker {
  code: KnowledgeTeamUploadObjectIndexBindingBoundaryBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadObjectIndexBindingBoundary {
  kind: 'infra-agent.knowledge-team-upload-object-index-binding-boundary';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  boundaryKind: 'object-index-binding-boundary-dry-run';
  status: KnowledgeTeamUploadObjectIndexBindingBoundaryStatus;
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
  sourceUploadCommandBoundary: {
    source: 'upload-command-boundary';
    boundaryStatus: 'upload-command-boundary-ready' | 'blocked' | 'invalid';
    boundaryKind: 'upload-command-boundary-dry-run' | 'unsupported';
    boundaryNextAction: 'design-object-index-binding-boundary' | 'resolve-blockers' | 'invalid';
    reviewStatus: 'review-ready' | 'blocked' | 'invalid';
    reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
    scopeMatched: boolean;
    humanReviewRecorded: boolean;
    fingerprintVerified: boolean;
    sourceFingerprintVerified: boolean;
    adapterName: string | null;
    adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
    dryRunOnly: boolean;
    uploadCommandRequiredBeforeExecution: boolean;
    uploadCommandRequiredAfterLiveCheckBoundary: boolean;
    liveCheckBoundaryRequired: boolean;
    liveCheckPolicyRequired: boolean;
    liveCheckResultRedactionRequired: boolean;
    credentialPresenceBoundaryRequired: boolean;
    credentialReadBoundaryRequired: boolean;
    credentialSourceDescriptorRequired: boolean;
    credentialReferenceOnlyRequired: boolean;
    credentialValueRedactionRequired: boolean;
    credentialPresenceResultRedactionRequired: boolean;
    mockAdapterRequired: boolean;
    clientFactoryDescriptorRequired: boolean;
    uploadCommandDescriptorRequired: boolean;
    uploadCommandPayloadRedactionRequired: boolean;
    uploadCommandMaterialRedactionRequired: boolean;
    commandExecutionApprovalRequired: boolean;
    artifactObjectStoreDependencyRequired: boolean;
    metadataIndexDependencyRequired: boolean;
    contentAddressedObjectKeysRequired: boolean;
    contentAddressedIndexKeysRequired: boolean;
    idempotentWritesRequired: boolean;
    explicitUploadApprovalRequired: boolean;
    credentialValuesRead: boolean;
    credentialValuesExposed: boolean;
    credentialPresenceChecked: boolean;
    credentialPresenceResultExposed: boolean;
    clientCreated: boolean;
    sdkClientCreated: boolean;
    adapterInjected: boolean;
    artifactObjectStoreBound: boolean;
    metadataIndexBound: boolean;
    liveCheckAllowed: boolean;
    liveCheckPerformed: boolean;
    liveCheckResultExposed: boolean;
    uploadCommandGenerated: boolean;
    uploadCommandMaterialized: boolean;
    uploadCommandExposed: boolean;
    uploadExecutionAllowed: boolean;
    objectWriteAttempted: boolean;
    metadataIndexWriteAttempted: boolean;
    remoteMutationPerformed: boolean;
    executable: boolean;
  };
  objectIndexBindingBoundary: {
    dryRunOnly: true;
    bindingRequiredAfterUploadCommandBoundary: true;
    uploadCommandBoundaryRequired: true;
    uploadCommandRequiredBeforeExecution: true;
    uploadCommandDescriptorRequired: true;
    uploadCommandPayloadRedactionRequired: true;
    uploadCommandMaterialRedactionRequired: true;
    commandExecutionApprovalRequired: true;
    objectStoreBindingRequired: true;
    metadataIndexBindingRequired: true;
    objectStoreDescriptorRequired: true;
    metadataIndexDescriptorRequired: true;
    objectKeyRedactionRequired: true;
    metadataIndexEntryRedactionRequired: true;
    contentAddressedObjectKeysRequired: true;
    contentAddressedIndexKeysRequired: true;
    idempotentObjectWriteRequired: true;
    idempotentMetadataIndexWriteRequired: true;
    objectWriteRequiresExecutionBoundary: true;
    metadataIndexWriteRequiresExecutionBoundary: true;
    explicitUploadApprovalRequired: true;
    credentialValuesRead: false;
    credentialValuesExposed: false;
    credentialPresenceChecked: false;
    credentialPresenceResultExposed: false;
    clientCreated: false;
    sdkClientCreated: false;
    adapterInjected: false;
    artifactBytesProvided: false;
    artifactObjectStoreBound: false;
    metadataIndexBound: false;
    objectStoreHandleExposed: false;
    metadataIndexHandleExposed: false;
    liveCheckAllowed: false;
    liveCheckPerformed: false;
    liveCheckResultExposed: false;
    uploadCommandGenerated: false;
    uploadCommandMaterialized: false;
    uploadCommandExposed: false;
    uploadExecutionAllowed: false;
    objectWriteAllowed: false;
    metadataIndexWriteAllowed: false;
    objectWriteAttempted: false;
    metadataIndexWriteAttempted: false;
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
    status: KnowledgeTeamUploadObjectIndexBindingBoundaryStatus;
    nextAction: KnowledgeTeamUploadObjectIndexBindingBoundaryNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadObjectIndexBindingBoundaryBlockerCode[];
    blockers: KnowledgeTeamUploadObjectIndexBindingBoundaryBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadObjectIndexBindingBoundaryInput {
  commandBoundary: unknown;
}

interface ParsedUploadCommandBoundaryForObjectIndexBindingBoundary {
  boundaryStatus: 'upload-command-boundary-ready' | 'blocked' | 'invalid';
  boundaryKind: 'upload-command-boundary-dry-run' | 'unsupported';
  boundaryNextAction: 'design-object-index-binding-boundary' | 'resolve-blockers' | 'invalid';
  sourceUploadCommandBoundary: KnowledgeTeamUploadObjectIndexBindingBoundary['sourceUploadCommandBoundary'];
  target: KnowledgeTeamUploadObjectIndexBindingBoundary['target'];
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN = /(artifactBytesValue|artifactBytesBase64|artifactBytesContent|artifactBytesPayload|artifactContent|artifactPayload|rawArtifact|byteBuffer|bytesBase64|contentBase64|buffer|stream|arrayBuffer|blob|readPath|filePath|localPath|artifactPath|serializedPayload|stagedBytes)/i;
const FORBIDDEN_CLIENT_KEY_PATTERN = /(clientInstance|clientObject|clientValue|clientFactoryValue|clientDescriptorValue|clientConfig|adapterClient|^sdkClient$|sdkClientConfig|signedUrl)/i;
const FORBIDDEN_CREDENTIAL_KEY_PATTERN = /(^credentialValue$|credentialValuePayload|credentialValueMaterial|credentialMaterial|credentialFile|credentialPath|credentialsPath|secretValue|envValue|processEnv|presenceCheckResult|credentialPresenceResult(?:Value|Payload|Material|Data|Body|Response)|credentialPresenceSignalValue)/i;
const FORBIDDEN_LIVE_CHECK_KEY_PATTERN = /(^liveCheckResult$|liveCheckResult(?:Value|Payload|Material|Data|Body)|liveCheckResponse|liveCheckProbe|liveCheckRequest|liveBackendProbe|headObjectResult|headIndexResult|remoteProbeResult|connectivityResult|healthCheckResult)/i;
const FORBIDDEN_COMMAND_KEY_PATTERN = /(^uploadCommandValue$|^uploadCommandPayload$|^uploadCommandMaterial$|^uploadCommandData$|^uploadCommandBody$|^uploadCommandLine$|^commandLine$|^shellCommand$|^signedUploadCommand$)/i;
const FORBIDDEN_ADAPTER_KEY_PATTERN = /(adapterInstance|adapterObject|adapterValue|adapterDescriptorValue)/i;
const FORBIDDEN_OBJECT_STORE_HANDLE_KEY_PATTERN = /(objectStoreHandle|objectStoreInstance|objectStoreClient|objectStoreBinding|artifactObjectStoreHandle|putObject|writeObject)/i;
const FORBIDDEN_METADATA_INDEX_HANDLE_KEY_PATTERN = /(metadataIndexHandle|metadataIndexInstance|metadataIndexClient|metadataIndexBinding|putEntry|writeIndex|indexEntryPayload|indexEntryValue)/i;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|secret|password|authorization|header|accessKey|sessionToken|tokenValue|tokenMaterial|leaseValue|leaseMaterial|rollbackValue|rollbackMaterial|rollbackCommand|auditValue|auditMaterial|auditCommand)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|kubectl |curl |secret|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBool(value: unknown): boolean {
  return value === true;
}

function addBlocker(
  blockers: KnowledgeTeamUploadObjectIndexBindingBoundaryBlocker[],
  code: KnowledgeTeamUploadObjectIndexBindingBoundaryBlockerCode,
  path: string,
  message: string
): void {
  blockers.push({ code, path, message });
}

function scanForPrivateDetails(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadObjectIndexBindingBoundaryBlocker[]
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForPrivateDetails(entry, `${path}[${index}]`, blockers));
    return;
  }
  if (!isRecord(value)) {
    if (typeof value === 'string' && FORBIDDEN_LEAK_VALUE_PATTERN.test(value)) {
      addBlocker(blockers, 'backend-detail-leak', path, 'Object/index binding boundary input must not contain backend details, private paths, credentials, executable commands, live-check results, object/index handles, or raw artifact content.');
    }
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    if (key === 'objectKey') {
      addBlocker(blockers, 'unsafe-artifact-reference', entryPath, 'Object/index binding boundary input must not contain target object keys.');
      continue;
    }
    if (FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'artifact-bytes-provided', entryPath, 'Object/index binding boundary input must not contain raw bytes, byte buffers, streams, content payloads, or local artifact paths.');
      continue;
    }
    if (FORBIDDEN_CLIENT_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'client-dependency-leak', entryPath, 'Object/index binding boundary input must not contain SDK clients, client configs, signed URLs, or write functions.');
      continue;
    }
    if (FORBIDDEN_CREDENTIAL_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'credential-dependency-leak', entryPath, 'Object/index binding boundary input must not contain credential values, credential files, environment reads, or credential presence results.');
      continue;
    }
    if (FORBIDDEN_LIVE_CHECK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'live-check-enabled', entryPath, 'Object/index binding boundary input must not contain live backend probes, live-check requests, or live-check results.');
      continue;
    }
    if (FORBIDDEN_COMMAND_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'upload-command-present', entryPath, 'Object/index binding boundary input must not contain upload command payloads or executable command material.');
      continue;
    }
    if (FORBIDDEN_ADAPTER_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'adapter-dependency-leak', entryPath, 'Object/index binding boundary input must not contain adapter instances or concrete adapter values.');
      continue;
    }
    if (FORBIDDEN_OBJECT_STORE_HANDLE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'object-store-handle-leak', entryPath, 'Object/index binding boundary input must not contain object store handles or object write functions.');
      continue;
    }
    if (FORBIDDEN_METADATA_INDEX_HANDLE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'metadata-index-handle-leak', entryPath, 'Object/index binding boundary input must not contain metadata index handles or index write functions.');
      continue;
    }
    if (FORBIDDEN_LEAK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'backend-detail-leak', entryPath, 'Object/index binding boundary input must not contain backend details, credential fields, commands, token/lease material, or raw artifact content.');
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

function readBoundaryStatus(value: unknown): ParsedUploadCommandBoundaryForObjectIndexBindingBoundary['boundaryStatus'] {
  if (value === 'upload-command-boundary-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readBoundaryKind(value: unknown): ParsedUploadCommandBoundaryForObjectIndexBindingBoundary['boundaryKind'] {
  if (value === 'upload-command-boundary-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readBoundaryNextAction(value: unknown): ParsedUploadCommandBoundaryForObjectIndexBindingBoundary['boundaryNextAction'] {
  if (value === 'design-object-index-binding-boundary' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readReviewStatus(value: unknown): KnowledgeTeamUploadObjectIndexBindingBoundary['sourceUploadCommandBoundary']['reviewStatus'] {
  if (value === 'review-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readReviewKind(value: unknown): KnowledgeTeamUploadObjectIndexBindingBoundary['sourceUploadCommandBoundary']['reviewKind'] {
  if (value === 'human-fingerprint-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readAdapterBackendKind(value: unknown): KnowledgeTeamUploadObjectIndexBindingBoundary['sourceUploadCommandBoundary']['adapterBackendKind'] {
  if (value === 'mock-s3-compatible' || value === 's3-compatible') {
    return value;
  }
  return 'unsupported';
}

function parseTarget(
  value: unknown,
  blockers: KnowledgeTeamUploadObjectIndexBindingBoundaryBlocker[]
): KnowledgeTeamUploadObjectIndexBindingBoundary['target'] {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.commandBoundary.target', 'Object/index binding boundary planning requires a target object.');
    addBlocker(blockers, 'unsafe-artifact-reference', '$.commandBoundary.target', 'Object/index binding boundary planning requires safe target references.');
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
    addBlocker(blockers, 'unsafe-artifact-reference', '$.commandBoundary.target', 'Object/index binding boundary planning requires redacted object keys and safe manifest, hash, and artifact references.');
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
  code: KnowledgeTeamUploadObjectIndexBindingBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadObjectIndexBindingBoundaryBlocker[]
): void {
  if (value[key] === true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must remain false for object/index binding boundary planning.`);
  }
}

function checkRequiredTrue(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadObjectIndexBindingBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadObjectIndexBindingBoundaryBlocker[]
): void {
  if (value[key] !== true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be true before object/index binding boundary planning can proceed.`);
  }
}

function checkRequiredFalse(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadObjectIndexBindingBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadObjectIndexBindingBoundaryBlocker[]
): void {
  if (value[key] !== false) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be false before object/index binding boundary planning can proceed.`);
  }
}

function blockerCodeForFalseField(key: string): KnowledgeTeamUploadObjectIndexBindingBoundaryBlockerCode {
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

function emptyParsedUploadCommandBoundary(): ParsedUploadCommandBoundaryForObjectIndexBindingBoundary {
  return {
    boundaryStatus: 'invalid',
    boundaryKind: 'unsupported',
    boundaryNextAction: 'invalid',
    sourceUploadCommandBoundary: {
      source: 'upload-command-boundary',
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
      uploadCommandRequiredBeforeExecution: false,
      uploadCommandRequiredAfterLiveCheckBoundary: false,
      liveCheckBoundaryRequired: false,
      liveCheckPolicyRequired: false,
      liveCheckResultRedactionRequired: false,
      credentialPresenceBoundaryRequired: false,
      credentialReadBoundaryRequired: false,
      credentialSourceDescriptorRequired: false,
      credentialReferenceOnlyRequired: false,
      credentialValueRedactionRequired: false,
      credentialPresenceResultRedactionRequired: false,
      mockAdapterRequired: false,
      clientFactoryDescriptorRequired: false,
      uploadCommandDescriptorRequired: false,
      uploadCommandPayloadRedactionRequired: false,
      uploadCommandMaterialRedactionRequired: false,
      commandExecutionApprovalRequired: false,
      artifactObjectStoreDependencyRequired: false,
      metadataIndexDependencyRequired: false,
      contentAddressedObjectKeysRequired: false,
      contentAddressedIndexKeysRequired: false,
      idempotentWritesRequired: false,
      explicitUploadApprovalRequired: false,
      credentialValuesRead: false,
      credentialValuesExposed: false,
      credentialPresenceChecked: false,
      credentialPresenceResultExposed: false,
      clientCreated: false,
      sdkClientCreated: false,
      adapterInjected: false,
      artifactObjectStoreBound: false,
      metadataIndexBound: false,
      liveCheckAllowed: false,
      liveCheckPerformed: false,
      liveCheckResultExposed: false,
      uploadCommandGenerated: false,
      uploadCommandMaterialized: false,
      uploadCommandExposed: false,
      uploadExecutionAllowed: false,
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

function parseUploadCommandBoundaryForObjectIndexBindingBoundary(
  value: unknown,
  blockers: KnowledgeTeamUploadObjectIndexBindingBoundaryBlocker[]
): ParsedUploadCommandBoundaryForObjectIndexBindingBoundary {
  scanForPrivateDetails(value, '$.commandBoundary', blockers);
  if (!isRecord(value)) {
    addBlocker(blockers, 'invalid-upload-command-boundary-kind', '$.commandBoundary', 'Object/index binding boundary planning requires a saved upload command boundary artifact.');
    return emptyParsedUploadCommandBoundary();
  }

  if (value.kind !== 'infra-agent.knowledge-team-upload-command-boundary') {
    addBlocker(blockers, 'invalid-upload-command-boundary-kind', '$.commandBoundary.kind', 'Object/index binding boundary planning requires an infra-agent.knowledge-team-upload-command-boundary artifact.');
  }
  if (value.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.commandBoundary.schemaVersion', 'Object/index binding boundary planning requires schemaVersion 1.');
  }
  if (value.boundaryKind !== 'upload-command-boundary-dry-run') {
    addBlocker(blockers, 'invalid-boundary-kind', '$.commandBoundary.boundaryKind', 'Object/index binding boundary planning requires an upload-command-boundary-dry-run source.');
  }
  if (value.status !== 'upload-command-boundary-ready') {
    addBlocker(blockers, 'upload-command-boundary-not-ready', '$.commandBoundary.status', 'Object/index binding boundary planning requires upload-command-boundary-ready input.');
  }
  if (!isRecord(value.readiness) || value.readiness.nextAction !== 'design-object-index-binding-boundary') {
    addBlocker(blockers, 'upload-command-boundary-next-action-invalid', '$.commandBoundary.readiness.nextAction', 'Upload command boundary must point to design-object-index-binding-boundary.');
  }
  if (value.uploadCommand !== null) {
    addBlocker(blockers, 'upload-command-present', '$.commandBoundary.uploadCommand', 'Object/index binding boundary planning must not receive upload commands.');
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
    checkFalseField(value, key, '$.commandBoundary', blockerCodeForFalseField(key), blockers);
  }
  checkFalseField(value, 'liveCheckAllowed', '$.commandBoundary', 'live-check-enabled', blockers);
  checkFalseField(value, 'credentialValuesExposed', '$.commandBoundary', 'credential-values-exposed', blockers);
  checkFalseField(value, 'credentialPresenceChecked', '$.commandBoundary', 'credential-presence-check-enabled', blockers);

  const sourceLiveCheckBoundary = isRecord(value.sourceLiveCheckBoundary) ? value.sourceLiveCheckBoundary : {};
  const uploadCommandBoundary = isRecord(value.uploadCommandBoundary) ? value.uploadCommandBoundary : {};
  const remainingExecutionBoundaries = isRecord(value.remainingExecutionBoundaries) ? value.remainingExecutionBoundaries : {};
  if (!isRecord(value.sourceLiveCheckBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.commandBoundary.sourceLiveCheckBoundary', 'Object/index binding boundary planning requires source live check metadata.');
  }
  if (!isRecord(value.uploadCommandBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.commandBoundary.uploadCommandBoundary', 'Object/index binding boundary planning requires upload command boundary metadata.');
  }
  if (!isRecord(value.remainingExecutionBoundaries)) {
    addBlocker(blockers, 'missing-required-field', '$.commandBoundary.remainingExecutionBoundaries', 'Object/index binding boundary planning requires remaining execution boundary metadata.');
  }

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
    checkRequiredTrue(uploadCommandBoundary, key, '$.commandBoundary.uploadCommandBoundary', key === 'metadataIndexDependencyRequired' ? 'metadata-index-bound' : key === 'artifactObjectStoreDependencyRequired' ? 'artifact-object-store-bound' : 'missing-required-field', blockers);
  }

  for (const [key, code] of [
    ['credentialValuesRead', 'credential-values-read'],
    ['credentialValuesExposed', 'credential-values-exposed'],
    ['credentialPresenceChecked', 'credential-presence-check-enabled'],
    ['credentialPresenceResultExposed', 'credential-presence-result-exposed'],
    ['clientCreated', 'client-created'],
    ['sdkClientCreated', 'client-created'],
    ['adapterInjected', 'adapter-injected'],
    ['artifactObjectStoreBound', 'artifact-object-store-bound'],
    ['metadataIndexBound', 'metadata-index-bound'],
    ['liveCheckAllowed', 'live-check-enabled'],
    ['liveCheckPerformed', 'live-check-enabled'],
    ['liveCheckResultExposed', 'live-check-result-exposed'],
    ['uploadCommandGenerated', 'upload-command-generated'],
    ['uploadCommandMaterialized', 'upload-command-generated'],
    ['uploadCommandExposed', 'upload-command-exposed'],
    ['uploadExecutionAllowed', 'upload-execution-enabled'],
    ['objectWriteAttempted', 'object-write-attempted'],
    ['metadataIndexWriteAttempted', 'metadata-index-write-attempted'],
    ['remoteMutationPerformed', 'remote-mutation-performed'],
    ['executable', 'executable-state-enabled']
  ] as const) {
    checkRequiredFalse(uploadCommandBoundary, key, '$.commandBoundary.uploadCommandBoundary', code, blockers);
  }

  checkRequiredTrue(remainingExecutionBoundaries, 'uploadCommandRequired', '$.commandBoundary.remainingExecutionBoundaries', 'upload-command-not-required', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'uploadCommandGenerated', '$.commandBoundary.remainingExecutionBoundaries', 'upload-command-generated', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'objectWriteAllowed', '$.commandBoundary.remainingExecutionBoundaries', 'remote-write-enabled', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'metadataIndexWriteAllowed', '$.commandBoundary.remainingExecutionBoundaries', 'remote-write-enabled', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'remoteMutationAllowed', '$.commandBoundary.remainingExecutionBoundaries', 'remote-write-enabled', blockers);

  const reviewStatus = readReviewStatus(sourceLiveCheckBoundary.reviewStatus);
  const reviewKind = readReviewKind(sourceLiveCheckBoundary.reviewKind);
  const adapterBackendKind = readAdapterBackendKind(sourceLiveCheckBoundary.adapterBackendKind);
  const adapterName = typeof sourceLiveCheckBoundary.adapterName === 'string' && isSafeKnowledgeTeamBackendAdapterName(sourceLiveCheckBoundary.adapterName)
    ? sourceLiveCheckBoundary.adapterName
    : null;
  if (sourceLiveCheckBoundary.adapterName !== null && sourceLiveCheckBoundary.adapterName !== undefined && adapterName === null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.commandBoundary.sourceLiveCheckBoundary.adapterName', 'Object/index binding boundary planning requires a safe adapter name.');
  }
  if (reviewStatus !== 'review-ready' || reviewKind !== 'human-fingerprint-dry-run' || !readBool(sourceLiveCheckBoundary.scopeMatched) || !readBool(sourceLiveCheckBoundary.humanReviewRecorded) || !readBool(sourceLiveCheckBoundary.fingerprintVerified) || !readBool(sourceLiveCheckBoundary.sourceFingerprintVerified)) {
    addBlocker(blockers, 'review-fingerprint-unverified', '$.commandBoundary.sourceLiveCheckBoundary', 'Object/index binding boundary planning requires verified review and scope metadata from the upload command source.');
  }
  if (adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.commandBoundary.sourceLiveCheckBoundary.adapterBackendKind', 'Object/index binding boundary planning remains mock-backend only.');
  }

  const sourceUploadCommandBoundary: KnowledgeTeamUploadObjectIndexBindingBoundary['sourceUploadCommandBoundary'] = {
    source: 'upload-command-boundary',
    boundaryStatus: readBoundaryStatus(value.status),
    boundaryKind: readBoundaryKind(value.boundaryKind),
    boundaryNextAction: isRecord(value.readiness) ? readBoundaryNextAction(value.readiness.nextAction) : 'invalid',
    reviewStatus,
    reviewKind,
    scopeMatched: readBool(sourceLiveCheckBoundary.scopeMatched),
    humanReviewRecorded: readBool(sourceLiveCheckBoundary.humanReviewRecorded),
    fingerprintVerified: readBool(sourceLiveCheckBoundary.fingerprintVerified),
    sourceFingerprintVerified: readBool(sourceLiveCheckBoundary.sourceFingerprintVerified),
    adapterName,
    adapterBackendKind,
    dryRunOnly: readBool(uploadCommandBoundary.dryRunOnly),
    uploadCommandRequiredBeforeExecution: readBool(uploadCommandBoundary.uploadCommandRequiredBeforeExecution),
    uploadCommandRequiredAfterLiveCheckBoundary: readBool(uploadCommandBoundary.uploadCommandRequiredAfterLiveCheckBoundary),
    liveCheckBoundaryRequired: readBool(uploadCommandBoundary.liveCheckBoundaryRequired),
    liveCheckPolicyRequired: readBool(uploadCommandBoundary.liveCheckPolicyRequired),
    liveCheckResultRedactionRequired: readBool(uploadCommandBoundary.liveCheckResultRedactionRequired),
    credentialPresenceBoundaryRequired: readBool(uploadCommandBoundary.credentialPresenceBoundaryRequired),
    credentialReadBoundaryRequired: readBool(uploadCommandBoundary.credentialReadBoundaryRequired),
    credentialSourceDescriptorRequired: readBool(uploadCommandBoundary.credentialSourceDescriptorRequired),
    credentialReferenceOnlyRequired: readBool(uploadCommandBoundary.credentialReferenceOnlyRequired),
    credentialValueRedactionRequired: readBool(uploadCommandBoundary.credentialValueRedactionRequired),
    credentialPresenceResultRedactionRequired: readBool(uploadCommandBoundary.credentialPresenceResultRedactionRequired),
    mockAdapterRequired: readBool(uploadCommandBoundary.mockAdapterRequired),
    clientFactoryDescriptorRequired: readBool(uploadCommandBoundary.clientFactoryDescriptorRequired),
    uploadCommandDescriptorRequired: readBool(uploadCommandBoundary.uploadCommandDescriptorRequired),
    uploadCommandPayloadRedactionRequired: readBool(uploadCommandBoundary.uploadCommandPayloadRedactionRequired),
    uploadCommandMaterialRedactionRequired: readBool(uploadCommandBoundary.uploadCommandMaterialRedactionRequired),
    commandExecutionApprovalRequired: readBool(uploadCommandBoundary.commandExecutionApprovalRequired),
    artifactObjectStoreDependencyRequired: readBool(uploadCommandBoundary.artifactObjectStoreDependencyRequired),
    metadataIndexDependencyRequired: readBool(uploadCommandBoundary.metadataIndexDependencyRequired),
    contentAddressedObjectKeysRequired: readBool(uploadCommandBoundary.contentAddressedObjectKeysRequired),
    contentAddressedIndexKeysRequired: readBool(uploadCommandBoundary.contentAddressedIndexKeysRequired),
    idempotentWritesRequired: readBool(uploadCommandBoundary.idempotentWritesRequired),
    explicitUploadApprovalRequired: readBool(uploadCommandBoundary.explicitUploadApprovalRequired),
    credentialValuesRead: readBool(uploadCommandBoundary.credentialValuesRead),
    credentialValuesExposed: readBool(uploadCommandBoundary.credentialValuesExposed),
    credentialPresenceChecked: readBool(uploadCommandBoundary.credentialPresenceChecked),
    credentialPresenceResultExposed: readBool(uploadCommandBoundary.credentialPresenceResultExposed),
    clientCreated: readBool(uploadCommandBoundary.clientCreated),
    sdkClientCreated: readBool(uploadCommandBoundary.sdkClientCreated),
    adapterInjected: readBool(uploadCommandBoundary.adapterInjected),
    artifactObjectStoreBound: readBool(uploadCommandBoundary.artifactObjectStoreBound),
    metadataIndexBound: readBool(uploadCommandBoundary.metadataIndexBound),
    liveCheckAllowed: readBool(uploadCommandBoundary.liveCheckAllowed),
    liveCheckPerformed: readBool(uploadCommandBoundary.liveCheckPerformed),
    liveCheckResultExposed: readBool(uploadCommandBoundary.liveCheckResultExposed),
    uploadCommandGenerated: readBool(uploadCommandBoundary.uploadCommandGenerated),
    uploadCommandMaterialized: readBool(uploadCommandBoundary.uploadCommandMaterialized),
    uploadCommandExposed: readBool(uploadCommandBoundary.uploadCommandExposed),
    uploadExecutionAllowed: readBool(uploadCommandBoundary.uploadExecutionAllowed),
    objectWriteAttempted: readBool(uploadCommandBoundary.objectWriteAttempted),
    metadataIndexWriteAttempted: readBool(uploadCommandBoundary.metadataIndexWriteAttempted),
    remoteMutationPerformed: readBool(uploadCommandBoundary.remoteMutationPerformed),
    executable: readBool(uploadCommandBoundary.executable)
  };

  return {
    boundaryStatus: sourceUploadCommandBoundary.boundaryStatus,
    boundaryKind: sourceUploadCommandBoundary.boundaryKind,
    boundaryNextAction: sourceUploadCommandBoundary.boundaryNextAction,
    sourceUploadCommandBoundary,
    target: parseTarget(value.target, blockers)
  };
}

export function buildKnowledgeTeamUploadObjectIndexBindingBoundary(
  input: KnowledgeTeamUploadObjectIndexBindingBoundaryInput
): KnowledgeTeamUploadObjectIndexBindingBoundary {
  const blockers: KnowledgeTeamUploadObjectIndexBindingBoundaryBlocker[] = [];
  const parsedBoundary = parseUploadCommandBoundaryForObjectIndexBindingBoundary(input.commandBoundary, blockers);
  const status: KnowledgeTeamUploadObjectIndexBindingBoundaryStatus = blockers.length === 0
    ? 'object-index-binding-boundary-ready'
    : 'blocked';

  return {
    kind: 'infra-agent.knowledge-team-upload-object-index-binding-boundary',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    boundaryKind: 'object-index-binding-boundary-dry-run',
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
    sourceUploadCommandBoundary: parsedBoundary.sourceUploadCommandBoundary,
    objectIndexBindingBoundary: {
      dryRunOnly: true,
      bindingRequiredAfterUploadCommandBoundary: true,
      uploadCommandBoundaryRequired: true,
      uploadCommandRequiredBeforeExecution: true,
      uploadCommandDescriptorRequired: true,
      uploadCommandPayloadRedactionRequired: true,
      uploadCommandMaterialRedactionRequired: true,
      commandExecutionApprovalRequired: true,
      objectStoreBindingRequired: true,
      metadataIndexBindingRequired: true,
      objectStoreDescriptorRequired: true,
      metadataIndexDescriptorRequired: true,
      objectKeyRedactionRequired: true,
      metadataIndexEntryRedactionRequired: true,
      contentAddressedObjectKeysRequired: true,
      contentAddressedIndexKeysRequired: true,
      idempotentObjectWriteRequired: true,
      idempotentMetadataIndexWriteRequired: true,
      objectWriteRequiresExecutionBoundary: true,
      metadataIndexWriteRequiresExecutionBoundary: true,
      explicitUploadApprovalRequired: true,
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
      nextAction: status === 'object-index-binding-boundary-ready' ? 'design-upload-execution-readiness-boundary' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: blockers.map(entry => entry.code),
      blockers,
      reason: status === 'object-index-binding-boundary-ready'
        ? 'Object/index binding boundary requirements are modeled, but no object store or metadata index is bound, no upload command is generated or exposed, and upload execution remains disabled until a separate upload execution readiness boundary is designed.'
        : 'Object/index binding boundary planning is blocked until all upload command boundary blockers are resolved.'
    }
  };
}
