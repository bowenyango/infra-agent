import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadLiveCheckBoundaryStatus =
  | 'live-check-boundary-ready'
  | 'blocked';

export type KnowledgeTeamUploadLiveCheckBoundaryNextAction =
  | 'design-upload-command-boundary'
  | 'resolve-blockers';

export type KnowledgeTeamUploadLiveCheckBoundaryBlockerCode =
  | 'adapter-dependency-leak'
  | 'adapter-injected'
  | 'artifact-bytes-provided'
  | 'artifact-object-store-bound'
  | 'audit-record-created'
  | 'backend-detail-leak'
  | 'client-created'
  | 'client-dependency-leak'
  | 'credential-dependency-leak'
  | 'credential-presence-boundary-next-action-invalid'
  | 'credential-presence-boundary-not-ready'
  | 'credential-presence-check-enabled'
  | 'credential-presence-check-not-required'
  | 'credential-presence-result-exposed'
  | 'credential-read-not-required'
  | 'credential-values-exposed'
  | 'credential-values-read'
  | 'executable-state-enabled'
  | 'execution-lease-created'
  | 'invalid-boundary-kind'
  | 'invalid-credential-presence-boundary-kind'
  | 'invalid-schema-version'
  | 'live-check-enabled'
  | 'live-check-not-required'
  | 'live-check-result-exposed'
  | 'metadata-index-bound'
  | 'metadata-index-write-attempted'
  | 'missing-required-field'
  | 'mutation-approval-already-granted'
  | 'mutation-enabled'
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
  | 'upload-command-present'
  | 'upload-execution-enabled'
  | 'write-token-issued';

export interface KnowledgeTeamUploadLiveCheckBoundaryBlocker {
  code: KnowledgeTeamUploadLiveCheckBoundaryBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadLiveCheckBoundary {
  kind: 'infra-agent.knowledge-team-upload-live-check-boundary';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  boundaryKind: 'live-check-boundary-dry-run';
  status: KnowledgeTeamUploadLiveCheckBoundaryStatus;
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
    objectKey: string | null;
    objectSha256: string | null;
    artifactId: string | null;
  };
  sourceCredentialPresenceBoundary: {
    source: 'upload-credential-presence-boundary';
    boundaryStatus: 'credential-presence-boundary-ready' | 'blocked' | 'invalid';
    boundaryKind: 'credential-presence-boundary-dry-run' | 'unsupported';
    boundaryNextAction: 'design-live-check-boundary' | 'resolve-blockers' | 'invalid';
    reviewStatus: 'review-ready' | 'blocked' | 'invalid';
    reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
    scopeMatched: boolean;
    humanReviewRecorded: boolean;
    fingerprintVerified: boolean;
    sourceFingerprintVerified: boolean;
    adapterName: string | null;
    adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
    dryRunOnly: boolean;
    credentialPresenceCheckRequiredBeforeExecution: boolean;
    credentialPresenceCheckRequiredAfterCredentialReadBoundary: boolean;
    credentialReadBoundaryRequired: boolean;
    credentialSourceDescriptorRequired: boolean;
    credentialReferenceOnlyRequired: boolean;
    credentialValueRedactionRequired: boolean;
    credentialPresenceSignalRequired: boolean;
    credentialPresenceResultRedactionRequired: boolean;
    mockAdapterRequired: boolean;
    clientFactoryDescriptorRequired: boolean;
    liveCheckBoundaryRequired: boolean;
    uploadCommandBoundaryRequired: boolean;
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
    liveCheckPerformed: boolean;
    uploadExecutionAllowed: boolean;
    uploadCommandGenerated: boolean;
    objectWriteAttempted: boolean;
    metadataIndexWriteAttempted: boolean;
    remoteMutationPerformed: boolean;
    executable: boolean;
  };
  liveCheckBoundary: {
    dryRunOnly: true;
    liveCheckRequiredBeforeExecution: true;
    liveCheckRequiredAfterCredentialPresenceBoundary: true;
    credentialPresenceBoundaryRequired: true;
    credentialReadBoundaryRequired: true;
    credentialSourceDescriptorRequired: true;
    credentialReferenceOnlyRequired: true;
    credentialValueRedactionRequired: true;
    credentialPresenceSignalRequired: true;
    credentialPresenceResultRedactionRequired: true;
    mockAdapterRequired: true;
    clientFactoryDescriptorRequired: true;
    liveCheckPolicyRequired: true;
    liveCheckReadOnlyRequired: true;
    liveCheckResultRedactionRequired: true;
    uploadCommandBoundaryRequired: true;
    artifactObjectStoreDependencyRequired: true;
    metadataIndexDependencyRequired: true;
    contentAddressedObjectKeysRequired: true;
    contentAddressedIndexKeysRequired: true;
    idempotentWritesRequired: true;
    explicitUploadApprovalRequired: true;
    credentialValuesRead: false;
    credentialValuesExposed: false;
    credentialPresenceChecked: false;
    credentialPresenceResultExposed: false;
    clientCreated: false;
    sdkClientCreated: false;
    adapterInjected: false;
    artifactObjectStoreBound: false;
    metadataIndexBound: false;
    liveCheckAllowed: false;
    liveCheckPerformed: false;
    liveCheckResultExposed: false;
    uploadExecutionAllowed: false;
    uploadCommandGenerated: false;
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
    status: KnowledgeTeamUploadLiveCheckBoundaryStatus;
    nextAction: KnowledgeTeamUploadLiveCheckBoundaryNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadLiveCheckBoundaryBlockerCode[];
    blockers: KnowledgeTeamUploadLiveCheckBoundaryBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadLiveCheckBoundaryInput {
  credentialPresenceBoundary: unknown;
}

interface ParsedCredentialPresenceBoundaryForLiveCheckBoundary {
  boundaryStatus: 'credential-presence-boundary-ready' | 'blocked' | 'invalid';
  boundaryKind: 'credential-presence-boundary-dry-run' | 'unsupported';
  boundaryNextAction: 'design-live-check-boundary' | 'resolve-blockers' | 'invalid';
  reviewStatus: 'review-ready' | 'blocked' | 'invalid';
  reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
  scopeMatched: boolean;
  humanReviewRecorded: boolean;
  fingerprintVerified: boolean;
  sourceFingerprintVerified: boolean;
  adapterName: string | null;
  adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
  dryRunOnly: boolean;
  credentialPresenceCheckRequiredBeforeExecution: boolean;
  credentialPresenceCheckRequiredAfterCredentialReadBoundary: boolean;
  credentialReadBoundaryRequired: boolean;
  credentialSourceDescriptorRequired: boolean;
  credentialReferenceOnlyRequired: boolean;
  credentialValueRedactionRequired: boolean;
  credentialPresenceSignalRequired: boolean;
  credentialPresenceResultRedactionRequired: boolean;
  mockAdapterRequired: boolean;
  clientFactoryDescriptorRequired: boolean;
  liveCheckBoundaryRequired: boolean;
  uploadCommandBoundaryRequired: boolean;
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
  liveCheckPerformed: boolean;
  uploadExecutionAllowed: boolean;
  uploadCommandGenerated: boolean;
  objectWriteAttempted: boolean;
  metadataIndexWriteAttempted: boolean;
  remoteMutationPerformed: boolean;
  executable: boolean;
  target: {
    manifestId: string | null;
    objectKey: string | null;
    objectSha256: string | null;
    artifactId: string | null;
  };
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN = /(artifactBytesValue|artifactBytesBase64|artifactBytesContent|artifactBytesPayload|artifactContent|artifactPayload|rawArtifact|byteBuffer|bytesBase64|contentBase64|buffer|stream|arrayBuffer|blob|readPath|filePath|localPath|artifactPath|serializedPayload|stagedBytes)/i;
const FORBIDDEN_CLIENT_KEY_PATTERN = /(clientInstance|clientObject|clientValue|clientFactoryValue|clientDescriptorValue|clientConfig|adapterClient|^sdkClient$|sdkClientConfig|objectStoreHandle|metadataIndexHandle|putObject|putEntry|fetch|signedUrl)/i;
const FORBIDDEN_CREDENTIAL_KEY_PATTERN = /(^credentialValue$|credentialValuePayload|credentialValueMaterial|credentialMaterial|credentialFile|credentialPath|credentialsPath|secretValue|envValue|processEnv|presenceCheckResult|credentialPresenceResult(?:Value|Payload|Material|Data|Body|Response)|credentialPresenceSignalValue)/i;
const FORBIDDEN_LIVE_CHECK_KEY_PATTERN = /(liveCheckResult|liveCheckResponse|liveCheckProbe|liveCheckRequest|liveBackendProbe|headObjectResult|headIndexResult|remoteProbeResult|connectivityResult|healthCheckResult)/i;
const FORBIDDEN_ADAPTER_KEY_PATTERN = /(adapterInstance|adapterObject|adapterValue|adapterDescriptorValue)/i;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|secret|password|authorization|header|accessKey|sessionToken|tokenValue|tokenMaterial|leaseValue|leaseMaterial|rollbackValue|rollbackMaterial|rollbackCommand|auditValue|auditMaterial|auditCommand)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|secret|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBool(value: unknown): boolean {
  return value === true;
}

function readBoundaryStatus(value: unknown): ParsedCredentialPresenceBoundaryForLiveCheckBoundary['boundaryStatus'] {
  if (value === 'credential-presence-boundary-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readBoundaryKind(value: unknown): ParsedCredentialPresenceBoundaryForLiveCheckBoundary['boundaryKind'] {
  if (value === 'credential-presence-boundary-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readBoundaryNextAction(value: unknown): ParsedCredentialPresenceBoundaryForLiveCheckBoundary['boundaryNextAction'] {
  if (value === 'design-live-check-boundary' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readReviewStatus(value: unknown): ParsedCredentialPresenceBoundaryForLiveCheckBoundary['reviewStatus'] {
  if (value === 'review-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readReviewKind(value: unknown): ParsedCredentialPresenceBoundaryForLiveCheckBoundary['reviewKind'] {
  if (value === 'human-fingerprint-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readAdapterBackendKind(value: unknown): ParsedCredentialPresenceBoundaryForLiveCheckBoundary['adapterBackendKind'] {
  if (value === 'mock-s3-compatible' || value === 's3-compatible') {
    return value;
  }
  return 'unsupported';
}

function addBlocker(
  blockers: KnowledgeTeamUploadLiveCheckBoundaryBlocker[],
  code: KnowledgeTeamUploadLiveCheckBoundaryBlockerCode,
  path: string,
  message: string
): void {
  blockers.push({ code, path, message });
}

function scanForPrivateDetails(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadLiveCheckBoundaryBlocker[]
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForPrivateDetails(entry, `${path}[${index}]`, blockers));
    return;
  }
  if (!isRecord(value)) {
    if (typeof value === 'string' && FORBIDDEN_LEAK_VALUE_PATTERN.test(value)) {
      addBlocker(
        blockers,
        'backend-detail-leak',
        path,
        'Live check boundary input must not contain backend details, private paths, credentials, commands, client handles, adapter instances, live-check results, or raw artifact content.'
      );
    }
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    if (FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'artifact-bytes-provided',
        entryPath,
        'Live check boundary input must not contain raw bytes, byte buffers, streams, content payloads, or local artifact paths.'
      );
      continue;
    }
    if (FORBIDDEN_CLIENT_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'client-dependency-leak',
        entryPath,
        'Live check boundary input must not contain SDK clients, client configs, object store handles, metadata index handles, or write functions.'
      );
      continue;
    }
    if (FORBIDDEN_CREDENTIAL_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'credential-dependency-leak',
        entryPath,
        'Live check boundary input must not contain credential values, credential files, environment reads, or credential presence results.'
      );
      continue;
    }
    if (FORBIDDEN_LIVE_CHECK_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'live-check-enabled',
        entryPath,
        'Live check boundary input must not contain live backend probes, live-check requests, or live-check results.'
      );
      continue;
    }
    if (FORBIDDEN_ADAPTER_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'adapter-dependency-leak',
        entryPath,
        'Live check boundary input must not contain adapter instances or concrete adapter values.'
      );
      continue;
    }
    if (FORBIDDEN_LEAK_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'backend-detail-leak',
        entryPath,
        'Live check boundary input must not contain backend details, credential fields, commands, token/lease material, or raw artifact content.'
      );
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

function readSafeObjectKey(value: unknown): string | null {
  if (typeof value !== 'string' || !isSafeKnowledgeTeamArtifactObjectKey(value)) {
    return null;
  }
  return value;
}

function parseTarget(
  value: unknown,
  blockers: KnowledgeTeamUploadLiveCheckBoundaryBlocker[]
): ParsedCredentialPresenceBoundaryForLiveCheckBoundary['target'] {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.credentialPresenceBoundary.target', 'Live check boundary planning requires a target object.');
    addBlocker(blockers, 'unsafe-artifact-reference', '$.credentialPresenceBoundary.target', 'Live check boundary planning requires safe target references.');
    return {
      manifestId: null,
      objectKey: null,
      objectSha256: null,
      artifactId: null
    };
  }

  const manifestId = readSafeId(value.manifestId);
  const objectKey = readSafeObjectKey(value.objectKey);
  const objectSha256 = readSafeSha256(value.objectSha256);
  const artifactId = readSafeId(value.artifactId);

  if (manifestId === null || objectKey === null || objectSha256 === null || artifactId === null) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.credentialPresenceBoundary.target', 'Live check boundary planning requires safe manifest, object, hash, and artifact references.');
  }

  return {
    manifestId,
    objectKey,
    objectSha256,
    artifactId
  };
}

function checkFalseField(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadLiveCheckBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadLiveCheckBoundaryBlocker[]
): void {
  if (value[key] === true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must remain false for live check boundary planning.`);
  }
}

function checkNullCommand(
  value: Record<string, unknown>,
  key: string,
  path: string,
  blockers: KnowledgeTeamUploadLiveCheckBoundaryBlocker[]
): void {
  if (value[key] !== null && value[key] !== undefined) {
    addBlocker(blockers, 'upload-command-present', `${path}.${key}`, 'Live check boundary planning must not receive upload commands.');
  }
}

function checkRequiredTrue(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadLiveCheckBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadLiveCheckBoundaryBlocker[]
): boolean {
  if (value[key] !== true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be true before live check boundary planning can proceed.`);
    return false;
  }
  return true;
}

function checkRequiredFalse(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadLiveCheckBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadLiveCheckBoundaryBlocker[]
): boolean {
  if (value[key] !== false) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be false for live check boundary planning.`);
    return false;
  }
  return true;
}

function checkCommonExecutionDisabledFields(
  value: Record<string, unknown>,
  path: string,
  blockers: KnowledgeTeamUploadLiveCheckBoundaryBlocker[]
): void {
  checkFalseField(value, 'mutationAllowed', path, 'mutation-enabled', blockers);
  checkFalseField(value, 'remoteWriteAllowed', path, 'remote-write-enabled', blockers);
  checkFalseField(value, 'liveCheckAllowed', path, 'live-check-enabled', blockers);
  checkFalseField(value, 'credentialValuesExposed', path, 'credential-values-exposed', blockers);
  checkFalseField(value, 'credentialPresenceChecked', path, 'credential-presence-check-enabled', blockers);
  checkFalseField(value, 'uploadApproved', path, 'upload-approval-already-provided', blockers);
  checkFalseField(value, 'uploadExecutionAllowed', path, 'upload-execution-enabled', blockers);
  checkFalseField(value, 'mutationApprovalGranted', path, 'mutation-approval-already-granted', blockers);
  checkFalseField(value, 'clientCreated', path, 'client-created', blockers);
  checkFalseField(value, 'adapterInjected', path, 'adapter-injected', blockers);
  checkFalseField(value, 'artifactBytesProvided', path, 'artifact-bytes-provided', blockers);
  checkFalseField(value, 'writeTokenIssued', path, 'write-token-issued', blockers);
  checkFalseField(value, 'executionLeaseCreated', path, 'execution-lease-created', blockers);
  checkFalseField(value, 'rollbackPlanCreated', path, 'rollback-plan-created', blockers);
  checkFalseField(value, 'auditRecordCreated', path, 'audit-record-created', blockers);
  checkFalseField(value, 'objectWriteAttempted', path, 'object-write-attempted', blockers);
  checkFalseField(value, 'metadataIndexWriteAttempted', path, 'metadata-index-write-attempted', blockers);
  checkFalseField(value, 'remoteMutationPerformed', path, 'remote-mutation-performed', blockers);
  checkNullCommand(value, 'uploadCommand', path, blockers);
}

function defaultParsedCredentialPresenceBoundary(): ParsedCredentialPresenceBoundaryForLiveCheckBoundary {
  return {
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
    credentialPresenceCheckRequiredBeforeExecution: false,
    credentialPresenceCheckRequiredAfterCredentialReadBoundary: false,
    credentialReadBoundaryRequired: false,
    credentialSourceDescriptorRequired: false,
    credentialReferenceOnlyRequired: false,
    credentialValueRedactionRequired: false,
    credentialPresenceSignalRequired: false,
    credentialPresenceResultRedactionRequired: false,
    mockAdapterRequired: false,
    clientFactoryDescriptorRequired: false,
    liveCheckBoundaryRequired: false,
    uploadCommandBoundaryRequired: false,
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
    liveCheckPerformed: false,
    uploadExecutionAllowed: false,
    uploadCommandGenerated: false,
    objectWriteAttempted: false,
    metadataIndexWriteAttempted: false,
    remoteMutationPerformed: false,
    executable: false,
    target: {
      manifestId: null,
      objectKey: null,
      objectSha256: null,
      artifactId: null
    }
  };
}

function parseCredentialPresenceBoundaryForLiveCheckBoundary(
  value: unknown,
  blockers: KnowledgeTeamUploadLiveCheckBoundaryBlocker[]
): ParsedCredentialPresenceBoundaryForLiveCheckBoundary {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.credentialPresenceBoundary', 'Live check boundary planning requires a credential presence boundary object.');
    return defaultParsedCredentialPresenceBoundary();
  }

  scanForPrivateDetails(value, '$.credentialPresenceBoundary', blockers);

  if (value.kind !== 'infra-agent.knowledge-team-upload-credential-presence-boundary') {
    addBlocker(blockers, 'invalid-credential-presence-boundary-kind', '$.credentialPresenceBoundary.kind', 'Live check boundary planning requires an upload credential presence boundary artifact.');
  }
  if (value.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.credentialPresenceBoundary.schemaVersion', 'Live check boundary planning requires schemaVersion 1.');
  }
  if (value.boundaryKind !== 'credential-presence-boundary-dry-run') {
    addBlocker(blockers, 'invalid-boundary-kind', '$.credentialPresenceBoundary.boundaryKind', 'Live check boundary planning requires the credential presence dry-run boundary kind.');
  }

  checkCommonExecutionDisabledFields(value, '$.credentialPresenceBoundary', blockers);

  const boundaryStatus = readBoundaryStatus(value.status);
  if (boundaryStatus !== 'credential-presence-boundary-ready') {
    addBlocker(blockers, 'credential-presence-boundary-not-ready', '$.credentialPresenceBoundary.status', 'Live check boundary planning requires a ready credential presence boundary.');
  }

  const readiness = isRecord(value.readiness) ? value.readiness : {};
  if (!isRecord(value.readiness)) {
    addBlocker(blockers, 'missing-required-field', '$.credentialPresenceBoundary.readiness', 'Live check boundary planning requires credential presence readiness.');
  }
  const boundaryNextAction = readBoundaryNextAction(readiness.nextAction);
  if (boundaryNextAction !== 'design-live-check-boundary') {
    addBlocker(blockers, 'credential-presence-boundary-next-action-invalid', '$.credentialPresenceBoundary.readiness.nextAction', 'Live check boundary planning requires the credential presence boundary to advance to live check design.');
  }
  if (typeof readiness.blockerCount === 'number' && readiness.blockerCount !== 0) {
    addBlocker(blockers, 'credential-presence-boundary-not-ready', '$.credentialPresenceBoundary.readiness.blockerCount', 'Live check boundary planning requires zero credential presence boundary blockers.');
  }

  const parsedTarget = parseTarget(value.target, blockers);
  const sourceCredentialReadBoundary = isRecord(value.sourceCredentialReadBoundary) ? value.sourceCredentialReadBoundary : {};
  const credentialPresenceBoundary = isRecord(value.credentialPresenceBoundary) ? value.credentialPresenceBoundary : {};
  const remainingExecutionBoundaries = isRecord(value.remainingExecutionBoundaries) ? value.remainingExecutionBoundaries : {};

  if (!isRecord(value.sourceCredentialReadBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.credentialPresenceBoundary.sourceCredentialReadBoundary', 'Live check boundary planning requires source credential read boundary summary.');
  }
  if (!isRecord(value.credentialPresenceBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'Live check boundary planning requires credential presence boundary details.');
  }
  if (!isRecord(value.remainingExecutionBoundaries)) {
    addBlocker(blockers, 'missing-required-field', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'Live check boundary planning requires remaining execution boundary details.');
  }

  const reviewStatus = readReviewStatus(sourceCredentialReadBoundary.reviewStatus);
  const reviewKind = readReviewKind(sourceCredentialReadBoundary.reviewKind);
  const scopeMatched = readBool(sourceCredentialReadBoundary.scopeMatched);
  const humanReviewRecorded = readBool(sourceCredentialReadBoundary.humanReviewRecorded);
  const fingerprintVerified = readBool(sourceCredentialReadBoundary.fingerprintVerified);
  const sourceFingerprintVerified = readBool(sourceCredentialReadBoundary.sourceFingerprintVerified);
  const adapterName = typeof sourceCredentialReadBoundary.adapterName === 'string'
    && isSafeKnowledgeTeamBackendAdapterName(sourceCredentialReadBoundary.adapterName)
    ? sourceCredentialReadBoundary.adapterName
    : null;
  const adapterBackendKind = readAdapterBackendKind(sourceCredentialReadBoundary.adapterBackendKind);

  if (reviewStatus !== 'review-ready' || reviewKind !== 'human-fingerprint-dry-run' || !humanReviewRecorded || !fingerprintVerified || !sourceFingerprintVerified) {
    addBlocker(blockers, 'review-fingerprint-unverified', '$.credentialPresenceBoundary.sourceCredentialReadBoundary', 'Live check boundary planning requires verified prior human review state.');
  }
  if (!scopeMatched) {
    addBlocker(blockers, 'scope-not-matched', '$.credentialPresenceBoundary.sourceCredentialReadBoundary.scopeMatched', 'Live check boundary planning requires matched artifact scope.');
  }
  if (adapterName === null && sourceCredentialReadBoundary.adapterName !== null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.credentialPresenceBoundary.sourceCredentialReadBoundary.adapterName', 'Live check boundary planning requires a safe adapter name.');
  }
  if (adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.credentialPresenceBoundary.sourceCredentialReadBoundary.adapterBackendKind', 'Live check boundary planning currently accepts only the mock S3-compatible backend boundary.');
  }

  const dryRunOnly = checkRequiredTrue(credentialPresenceBoundary, 'dryRunOnly', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'credential-presence-check-not-required', blockers);
  const credentialPresenceCheckRequiredBeforeExecution = checkRequiredTrue(credentialPresenceBoundary, 'credentialPresenceCheckRequiredBeforeExecution', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'credential-presence-check-not-required', blockers);
  const credentialPresenceCheckRequiredAfterCredentialReadBoundary = checkRequiredTrue(credentialPresenceBoundary, 'credentialPresenceCheckRequiredAfterCredentialReadBoundary', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'credential-presence-check-not-required', blockers);
  const credentialReadBoundaryRequired = checkRequiredTrue(credentialPresenceBoundary, 'credentialReadBoundaryRequired', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'credential-read-not-required', blockers);
  const credentialSourceDescriptorRequired = checkRequiredTrue(credentialPresenceBoundary, 'credentialSourceDescriptorRequired', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'credential-read-not-required', blockers);
  const credentialReferenceOnlyRequired = checkRequiredTrue(credentialPresenceBoundary, 'credentialReferenceOnlyRequired', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'credential-read-not-required', blockers);
  const credentialValueRedactionRequired = checkRequiredTrue(credentialPresenceBoundary, 'credentialValueRedactionRequired', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'credential-values-exposed', blockers);
  const credentialPresenceSignalRequired = checkRequiredTrue(credentialPresenceBoundary, 'credentialPresenceSignalRequired', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'credential-presence-check-not-required', blockers);
  const credentialPresenceResultRedactionRequired = checkRequiredTrue(credentialPresenceBoundary, 'credentialPresenceResultRedactionRequired', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'credential-presence-result-exposed', blockers);
  const mockAdapterRequired = checkRequiredTrue(credentialPresenceBoundary, 'mockAdapterRequired', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'unsupported-adapter-backend', blockers);
  const clientFactoryDescriptorRequired = checkRequiredTrue(credentialPresenceBoundary, 'clientFactoryDescriptorRequired', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'client-created', blockers);
  const liveCheckBoundaryRequired = checkRequiredTrue(credentialPresenceBoundary, 'liveCheckBoundaryRequired', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'live-check-not-required', blockers);
  const uploadCommandBoundaryRequired = checkRequiredTrue(credentialPresenceBoundary, 'uploadCommandBoundaryRequired', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'upload-command-present', blockers);
  const artifactObjectStoreDependencyRequired = checkRequiredTrue(credentialPresenceBoundary, 'artifactObjectStoreDependencyRequired', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'client-created', blockers);
  const metadataIndexDependencyRequired = checkRequiredTrue(credentialPresenceBoundary, 'metadataIndexDependencyRequired', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'client-created', blockers);
  const contentAddressedObjectKeysRequired = checkRequiredTrue(credentialPresenceBoundary, 'contentAddressedObjectKeysRequired', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'client-created', blockers);
  const contentAddressedIndexKeysRequired = checkRequiredTrue(credentialPresenceBoundary, 'contentAddressedIndexKeysRequired', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'client-created', blockers);
  const idempotentWritesRequired = checkRequiredTrue(credentialPresenceBoundary, 'idempotentWritesRequired', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'client-created', blockers);
  const explicitUploadApprovalRequired = checkRequiredTrue(credentialPresenceBoundary, 'explicitUploadApprovalRequired', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'upload-approval-already-provided', blockers);

  checkRequiredFalse(credentialPresenceBoundary, 'credentialValuesRead', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'credential-values-read', blockers);
  checkRequiredFalse(credentialPresenceBoundary, 'credentialValuesExposed', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'credential-values-exposed', blockers);
  checkRequiredFalse(credentialPresenceBoundary, 'credentialPresenceChecked', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'credential-presence-check-enabled', blockers);
  checkRequiredFalse(credentialPresenceBoundary, 'credentialPresenceResultExposed', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'credential-presence-result-exposed', blockers);
  checkRequiredFalse(credentialPresenceBoundary, 'clientCreated', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'client-created', blockers);
  checkRequiredFalse(credentialPresenceBoundary, 'sdkClientCreated', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'client-created', blockers);
  checkRequiredFalse(credentialPresenceBoundary, 'adapterInjected', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'adapter-injected', blockers);
  checkRequiredFalse(credentialPresenceBoundary, 'artifactObjectStoreBound', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'artifact-object-store-bound', blockers);
  checkRequiredFalse(credentialPresenceBoundary, 'metadataIndexBound', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'metadata-index-bound', blockers);
  checkRequiredFalse(credentialPresenceBoundary, 'liveCheckPerformed', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'live-check-enabled', blockers);
  checkRequiredFalse(credentialPresenceBoundary, 'uploadExecutionAllowed', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'upload-execution-enabled', blockers);
  checkRequiredFalse(credentialPresenceBoundary, 'uploadCommandGenerated', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'upload-command-present', blockers);
  checkRequiredFalse(credentialPresenceBoundary, 'objectWriteAttempted', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'object-write-attempted', blockers);
  checkRequiredFalse(credentialPresenceBoundary, 'metadataIndexWriteAttempted', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'metadata-index-write-attempted', blockers);
  checkRequiredFalse(credentialPresenceBoundary, 'remoteMutationPerformed', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'remote-mutation-performed', blockers);
  checkRequiredFalse(credentialPresenceBoundary, 'executable', '$.credentialPresenceBoundary.credentialPresenceBoundary', 'executable-state-enabled', blockers);

  checkRequiredTrue(remainingExecutionBoundaries, 'artifactBytesRequired', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'artifact-bytes-provided', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'adapterInjectionRequired', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'client-created', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'clientCreationRequired', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'client-created', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'credentialReadRequired', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'credential-read-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'credentialPresenceCheckRequired', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'credential-presence-check-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'liveCheckRequired', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'live-check-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'uploadCommandRequired', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'upload-command-present', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'writeTokenRequired', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'write-token-issued', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'executionLeaseRequired', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'execution-lease-created', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'rollbackPlanRequired', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'rollback-plan-created', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'auditRecordRequired', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'audit-record-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'artifactBytesProvided', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'artifact-bytes-provided', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'adapterInjected', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'adapter-injected', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'clientCreated', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'client-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'credentialValuesExposed', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'credential-values-exposed', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'credentialPresenceChecked', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'credential-presence-check-enabled', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'liveCheckPerformed', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'live-check-enabled', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'uploadCommandGenerated', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'upload-command-present', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'writeTokenIssued', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'write-token-issued', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'executionLeaseCreated', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'execution-lease-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'rollbackPlanCreated', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'rollback-plan-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'auditRecordCreated', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'audit-record-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'objectWriteAllowed', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'object-write-attempted', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'metadataIndexWriteAllowed', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'metadata-index-write-attempted', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'remoteMutationAllowed', '$.credentialPresenceBoundary.remainingExecutionBoundaries', 'remote-mutation-performed', blockers);

  return {
    boundaryStatus,
    boundaryKind: readBoundaryKind(value.boundaryKind),
    boundaryNextAction,
    reviewStatus,
    reviewKind,
    scopeMatched,
    humanReviewRecorded,
    fingerprintVerified,
    sourceFingerprintVerified,
    adapterName,
    adapterBackendKind,
    dryRunOnly,
    credentialPresenceCheckRequiredBeforeExecution,
    credentialPresenceCheckRequiredAfterCredentialReadBoundary,
    credentialReadBoundaryRequired,
    credentialSourceDescriptorRequired,
    credentialReferenceOnlyRequired,
    credentialValueRedactionRequired,
    credentialPresenceSignalRequired,
    credentialPresenceResultRedactionRequired,
    mockAdapterRequired,
    clientFactoryDescriptorRequired,
    liveCheckBoundaryRequired,
    uploadCommandBoundaryRequired,
    artifactObjectStoreDependencyRequired,
    metadataIndexDependencyRequired,
    contentAddressedObjectKeysRequired,
    contentAddressedIndexKeysRequired,
    idempotentWritesRequired,
    explicitUploadApprovalRequired,
    credentialValuesRead: readBool(credentialPresenceBoundary.credentialValuesRead),
    credentialValuesExposed: readBool(credentialPresenceBoundary.credentialValuesExposed),
    credentialPresenceChecked: readBool(credentialPresenceBoundary.credentialPresenceChecked),
    credentialPresenceResultExposed: readBool(credentialPresenceBoundary.credentialPresenceResultExposed),
    clientCreated: readBool(credentialPresenceBoundary.clientCreated),
    sdkClientCreated: readBool(credentialPresenceBoundary.sdkClientCreated),
    adapterInjected: readBool(credentialPresenceBoundary.adapterInjected),
    artifactObjectStoreBound: readBool(credentialPresenceBoundary.artifactObjectStoreBound),
    metadataIndexBound: readBool(credentialPresenceBoundary.metadataIndexBound),
    liveCheckPerformed: readBool(credentialPresenceBoundary.liveCheckPerformed),
    uploadExecutionAllowed: readBool(credentialPresenceBoundary.uploadExecutionAllowed),
    uploadCommandGenerated: readBool(credentialPresenceBoundary.uploadCommandGenerated),
    objectWriteAttempted: readBool(credentialPresenceBoundary.objectWriteAttempted),
    metadataIndexWriteAttempted: readBool(credentialPresenceBoundary.metadataIndexWriteAttempted),
    remoteMutationPerformed: readBool(credentialPresenceBoundary.remoteMutationPerformed),
    executable: readBool(credentialPresenceBoundary.executable),
    target: parsedTarget
  };
}

export function buildKnowledgeTeamUploadLiveCheckBoundary(
  input: KnowledgeTeamUploadLiveCheckBoundaryInput
): KnowledgeTeamUploadLiveCheckBoundary {
  const blockers: KnowledgeTeamUploadLiveCheckBoundaryBlocker[] = [];
  const parsedBoundary = parseCredentialPresenceBoundaryForLiveCheckBoundary(input.credentialPresenceBoundary, blockers);
  const status: KnowledgeTeamUploadLiveCheckBoundaryStatus = blockers.length === 0
    ? 'live-check-boundary-ready'
    : 'blocked';

  return {
    kind: 'infra-agent.knowledge-team-upload-live-check-boundary',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    boundaryKind: 'live-check-boundary-dry-run',
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
    sourceCredentialPresenceBoundary: {
      source: 'upload-credential-presence-boundary',
      boundaryStatus: parsedBoundary.boundaryStatus,
      boundaryKind: parsedBoundary.boundaryKind,
      boundaryNextAction: parsedBoundary.boundaryNextAction,
      reviewStatus: parsedBoundary.reviewStatus,
      reviewKind: parsedBoundary.reviewKind,
      scopeMatched: parsedBoundary.scopeMatched,
      humanReviewRecorded: parsedBoundary.humanReviewRecorded,
      fingerprintVerified: parsedBoundary.fingerprintVerified,
      sourceFingerprintVerified: parsedBoundary.sourceFingerprintVerified,
      adapterName: parsedBoundary.adapterName,
      adapterBackendKind: parsedBoundary.adapterBackendKind,
      dryRunOnly: parsedBoundary.dryRunOnly,
      credentialPresenceCheckRequiredBeforeExecution: parsedBoundary.credentialPresenceCheckRequiredBeforeExecution,
      credentialPresenceCheckRequiredAfterCredentialReadBoundary: parsedBoundary.credentialPresenceCheckRequiredAfterCredentialReadBoundary,
      credentialReadBoundaryRequired: parsedBoundary.credentialReadBoundaryRequired,
      credentialSourceDescriptorRequired: parsedBoundary.credentialSourceDescriptorRequired,
      credentialReferenceOnlyRequired: parsedBoundary.credentialReferenceOnlyRequired,
      credentialValueRedactionRequired: parsedBoundary.credentialValueRedactionRequired,
      credentialPresenceSignalRequired: parsedBoundary.credentialPresenceSignalRequired,
      credentialPresenceResultRedactionRequired: parsedBoundary.credentialPresenceResultRedactionRequired,
      mockAdapterRequired: parsedBoundary.mockAdapterRequired,
      clientFactoryDescriptorRequired: parsedBoundary.clientFactoryDescriptorRequired,
      liveCheckBoundaryRequired: parsedBoundary.liveCheckBoundaryRequired,
      uploadCommandBoundaryRequired: parsedBoundary.uploadCommandBoundaryRequired,
      artifactObjectStoreDependencyRequired: parsedBoundary.artifactObjectStoreDependencyRequired,
      metadataIndexDependencyRequired: parsedBoundary.metadataIndexDependencyRequired,
      contentAddressedObjectKeysRequired: parsedBoundary.contentAddressedObjectKeysRequired,
      contentAddressedIndexKeysRequired: parsedBoundary.contentAddressedIndexKeysRequired,
      idempotentWritesRequired: parsedBoundary.idempotentWritesRequired,
      explicitUploadApprovalRequired: parsedBoundary.explicitUploadApprovalRequired,
      credentialValuesRead: parsedBoundary.credentialValuesRead,
      credentialValuesExposed: parsedBoundary.credentialValuesExposed,
      credentialPresenceChecked: parsedBoundary.credentialPresenceChecked,
      credentialPresenceResultExposed: parsedBoundary.credentialPresenceResultExposed,
      clientCreated: parsedBoundary.clientCreated,
      sdkClientCreated: parsedBoundary.sdkClientCreated,
      adapterInjected: parsedBoundary.adapterInjected,
      artifactObjectStoreBound: parsedBoundary.artifactObjectStoreBound,
      metadataIndexBound: parsedBoundary.metadataIndexBound,
      liveCheckPerformed: parsedBoundary.liveCheckPerformed,
      uploadExecutionAllowed: parsedBoundary.uploadExecutionAllowed,
      uploadCommandGenerated: parsedBoundary.uploadCommandGenerated,
      objectWriteAttempted: parsedBoundary.objectWriteAttempted,
      metadataIndexWriteAttempted: parsedBoundary.metadataIndexWriteAttempted,
      remoteMutationPerformed: parsedBoundary.remoteMutationPerformed,
      executable: parsedBoundary.executable
    },
    liveCheckBoundary: {
      dryRunOnly: true,
      liveCheckRequiredBeforeExecution: true,
      liveCheckRequiredAfterCredentialPresenceBoundary: true,
      credentialPresenceBoundaryRequired: true,
      credentialReadBoundaryRequired: true,
      credentialSourceDescriptorRequired: true,
      credentialReferenceOnlyRequired: true,
      credentialValueRedactionRequired: true,
      credentialPresenceSignalRequired: true,
      credentialPresenceResultRedactionRequired: true,
      mockAdapterRequired: true,
      clientFactoryDescriptorRequired: true,
      liveCheckPolicyRequired: true,
      liveCheckReadOnlyRequired: true,
      liveCheckResultRedactionRequired: true,
      uploadCommandBoundaryRequired: true,
      artifactObjectStoreDependencyRequired: true,
      metadataIndexDependencyRequired: true,
      contentAddressedObjectKeysRequired: true,
      contentAddressedIndexKeysRequired: true,
      idempotentWritesRequired: true,
      explicitUploadApprovalRequired: true,
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
      uploadExecutionAllowed: false,
      uploadCommandGenerated: false,
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
      nextAction: status === 'live-check-boundary-ready' ? 'design-upload-command-boundary' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: blockers.map(entry => entry.code),
      blockers,
      reason: status === 'live-check-boundary-ready'
        ? 'Live-check boundary requirements are modeled, but no credential values are read, no credential presence check is performed, no live backend check is performed, and upload execution remains disabled until a separate upload-command boundary is designed.'
        : 'Live-check boundary planning is blocked until all credential presence boundary blockers are resolved.'
    }
  };
}
