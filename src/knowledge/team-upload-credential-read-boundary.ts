import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadCredentialReadBoundaryStatus =
  | 'credential-read-boundary-ready'
  | 'blocked';

export type KnowledgeTeamUploadCredentialReadBoundaryNextAction =
  | 'design-credential-presence-boundary'
  | 'resolve-blockers';

export type KnowledgeTeamUploadCredentialReadBoundaryBlockerCode =
  | 'adapter-dependency-leak'
  | 'adapter-injected'
  | 'client-creation-boundary-next-action-invalid'
  | 'client-creation-boundary-not-ready'
  | 'client-creation-not-required'
  | 'artifact-bytes-provided'
  | 'artifact-object-store-bound'
  | 'audit-record-created'
  | 'backend-detail-leak'
  | 'client-created'
  | 'client-dependency-leak'
  | 'credential-dependency-leak'
  | 'credential-presence-check-enabled'
  | 'credential-read-not-required'
  | 'credential-values-exposed'
  | 'executable-state-enabled'
  | 'execution-lease-created'
  | 'invalid-client-creation-boundary-kind'
  | 'invalid-boundary-kind'
  | 'invalid-schema-version'
  | 'live-check-enabled'
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

export interface KnowledgeTeamUploadCredentialReadBoundaryBlocker {
  code: KnowledgeTeamUploadCredentialReadBoundaryBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadCredentialReadBoundary {
  kind: 'infra-agent.knowledge-team-upload-credential-read-boundary';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  boundaryKind: 'credential-read-boundary-dry-run';
  status: KnowledgeTeamUploadCredentialReadBoundaryStatus;
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
  sourceClientCreationBoundary: {
    source: 'upload-client-creation-boundary';
    boundaryStatus: 'client-creation-boundary-ready' | 'blocked' | 'invalid';
    boundaryKind: 'client-creation-boundary-dry-run' | 'unsupported';
    boundaryNextAction: 'design-credential-read-boundary' | 'resolve-blockers' | 'invalid';
    reviewStatus: 'review-ready' | 'blocked' | 'invalid';
    reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
    scopeMatched: boolean;
    humanReviewRecorded: boolean;
    fingerprintVerified: boolean;
    sourceFingerprintVerified: boolean;
    adapterName: string | null;
    adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
    dryRunOnly: boolean;
    clientCreationRequiredBeforeExecution: boolean;
    clientCreationRequiredAfterAdapter: boolean;
    adapterInjectionRequiredBeforeClient: boolean;
    adapterDependencyInjectionOnly: boolean;
    mockAdapterRequired: boolean;
    clientFactoryDescriptorRequired: boolean;
    credentialReadBoundaryRequired: boolean;
    credentialPresenceBoundaryRequired: boolean;
    liveCheckBoundaryRequired: boolean;
    uploadCommandBoundaryRequired: boolean;
    artifactObjectStoreDependencyRequired: boolean;
    metadataIndexDependencyRequired: boolean;
    contentAddressedObjectKeysRequired: boolean;
    contentAddressedIndexKeysRequired: boolean;
    idempotentWritesRequired: boolean;
    explicitUploadApprovalRequired: boolean;
    clientCreated: boolean;
    sdkClientCreated: boolean;
    adapterInjected: boolean;
    artifactObjectStoreBound: boolean;
    metadataIndexBound: boolean;
    credentialValuesExposed: boolean;
    credentialPresenceChecked: boolean;
    liveCheckPerformed: boolean;
    uploadExecutionAllowed: boolean;
    uploadCommandGenerated: boolean;
    objectWriteAttempted: boolean;
    metadataIndexWriteAttempted: boolean;
    remoteMutationPerformed: boolean;
    executable: boolean;
  };
  credentialReadBoundary: {
    dryRunOnly: true;
    credentialReadRequiredBeforeExecution: true;
    credentialReadRequiredAfterClientBoundary: true;
    clientCreationBoundaryRequired: true;
    credentialSourceDescriptorRequired: true;
    credentialReferenceOnlyRequired: true;
    credentialValueRedactionRequired: true;
    mockAdapterRequired: true;
    clientFactoryDescriptorRequired: true;
    credentialPresenceBoundaryRequired: true;
    liveCheckBoundaryRequired: true;
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
    clientCreated: false;
    sdkClientCreated: false;
    adapterInjected: false;
    artifactObjectStoreBound: false;
    metadataIndexBound: false;
    liveCheckPerformed: false;
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
    status: KnowledgeTeamUploadCredentialReadBoundaryStatus;
    nextAction: KnowledgeTeamUploadCredentialReadBoundaryNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadCredentialReadBoundaryBlockerCode[];
    blockers: KnowledgeTeamUploadCredentialReadBoundaryBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadCredentialReadBoundaryInput {
  clientCreationBoundary: unknown;
}

interface ParsedClientCreationBoundaryForCredentialReadBoundary {
  boundaryStatus: 'client-creation-boundary-ready' | 'blocked' | 'invalid';
  boundaryKind: 'client-creation-boundary-dry-run' | 'unsupported';
  boundaryNextAction: 'design-credential-read-boundary' | 'resolve-blockers' | 'invalid';
  reviewStatus: 'review-ready' | 'blocked' | 'invalid';
  reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
  scopeMatched: boolean;
  humanReviewRecorded: boolean;
  fingerprintVerified: boolean;
  sourceFingerprintVerified: boolean;
  adapterName: string | null;
  adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
  dryRunOnly: boolean;
  clientCreationRequiredBeforeExecution: boolean;
  clientCreationRequiredAfterAdapter: boolean;
  adapterInjectionRequiredBeforeClient: boolean;
  adapterDependencyInjectionOnly: boolean;
  mockAdapterRequired: boolean;
  clientFactoryDescriptorRequired: boolean;
  credentialReadBoundaryRequired: boolean;
  credentialPresenceBoundaryRequired: boolean;
  liveCheckBoundaryRequired: boolean;
  uploadCommandBoundaryRequired: boolean;
  artifactObjectStoreDependencyRequired: boolean;
  metadataIndexDependencyRequired: boolean;
  contentAddressedObjectKeysRequired: boolean;
  contentAddressedIndexKeysRequired: boolean;
  idempotentWritesRequired: boolean;
  explicitUploadApprovalRequired: boolean;
  clientCreated: boolean;
  sdkClientCreated: boolean;
  adapterInjected: boolean;
  artifactObjectStoreBound: boolean;
  metadataIndexBound: boolean;
  credentialValuesExposed: boolean;
  credentialPresenceChecked: boolean;
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
const FORBIDDEN_CLIENT_KEY_PATTERN = /(clientInstance|clientObject|clientValue|clientFactory|clientDescriptorValue|clientConfig|adapterClient|sdkClient|sdkClientConfig|objectStoreHandle|metadataIndexHandle|putObject|putEntry|fetch|signedUrl)/i;
const FORBIDDEN_CREDENTIAL_KEY_PATTERN = /(^credentialValue$|credentialValuePayload|credentialValueMaterial|credentialMaterial|credentialFile|credentialPath|credentialsPath|secretValue|envValue|processEnv|presenceResult|presenceCheckResult)/i;
const FORBIDDEN_ADAPTER_KEY_PATTERN = /(adapterInstance|adapterObject|adapterValue|adapterDescriptorValue)/i;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|secret|password|authorization|header|accessKey|sessionToken|tokenValue|tokenMaterial|leaseValue|leaseMaterial|rollbackValue|rollbackMaterial|rollbackCommand|auditValue|auditMaterial|auditCommand)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|secret|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBool(value: unknown): boolean {
  return value === true;
}

function readBoundaryStatus(value: unknown): ParsedClientCreationBoundaryForCredentialReadBoundary['boundaryStatus'] {
  if (value === 'client-creation-boundary-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readBoundaryKind(value: unknown): ParsedClientCreationBoundaryForCredentialReadBoundary['boundaryKind'] {
  if (value === 'client-creation-boundary-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readBoundaryNextAction(value: unknown): ParsedClientCreationBoundaryForCredentialReadBoundary['boundaryNextAction'] {
  if (value === 'design-credential-read-boundary' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readReviewStatus(value: unknown): ParsedClientCreationBoundaryForCredentialReadBoundary['reviewStatus'] {
  if (value === 'review-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readReviewKind(value: unknown): ParsedClientCreationBoundaryForCredentialReadBoundary['reviewKind'] {
  if (value === 'human-fingerprint-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readAdapterBackendKind(value: unknown): ParsedClientCreationBoundaryForCredentialReadBoundary['adapterBackendKind'] {
  if (value === 'mock-s3-compatible' || value === 's3-compatible') {
    return value;
  }
  return 'unsupported';
}

function addBlocker(
  blockers: KnowledgeTeamUploadCredentialReadBoundaryBlocker[],
  code: KnowledgeTeamUploadCredentialReadBoundaryBlockerCode,
  path: string,
  message: string
): void {
  blockers.push({ code, path, message });
}

function scanForPrivateDetails(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadCredentialReadBoundaryBlocker[]
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
        'Credential read boundary input must not contain backend details, private paths, credentials, commands, client handles, adapter instances, or raw artifact content.'
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
        'Credential read boundary input must not contain raw bytes, byte buffers, streams, content payloads, or local artifact paths.'
      );
      continue;
    }
    if (FORBIDDEN_CLIENT_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'client-dependency-leak',
        entryPath,
        'Credential read boundary input must not contain SDK clients, client configs, object store handles, metadata index handles, or write functions.'
      );
      continue;
    }
    if (FORBIDDEN_CREDENTIAL_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'credential-dependency-leak',
        entryPath,
        'Credential read boundary input must not contain credential values, credential files, environment reads, or credential presence results.'
      );
      continue;
    }
    if (FORBIDDEN_ADAPTER_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'adapter-dependency-leak',
        entryPath,
        'Credential read boundary input must not contain adapter instances or concrete adapter values.'
      );
      continue;
    }
    if (FORBIDDEN_LEAK_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'backend-detail-leak',
        entryPath,
        'Credential read boundary input must not contain backend details, credential fields, commands, token/lease material, or raw artifact content.'
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
  blockers: KnowledgeTeamUploadCredentialReadBoundaryBlocker[]
): ParsedClientCreationBoundaryForCredentialReadBoundary['target'] {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.clientCreationBoundary.target', 'Credential read boundary planning requires a target object.');
    addBlocker(blockers, 'unsafe-artifact-reference', '$.clientCreationBoundary.target', 'Credential read boundary planning requires safe target references.');
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
    addBlocker(blockers, 'unsafe-artifact-reference', '$.clientCreationBoundary.target', 'Credential read boundary planning requires safe manifest, object, hash, and artifact references.');
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
  code: KnowledgeTeamUploadCredentialReadBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadCredentialReadBoundaryBlocker[]
): void {
  if (value[key] === true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must remain false for credential read boundary planning.`);
  }
}

function checkNullCommand(
  value: Record<string, unknown>,
  key: string,
  path: string,
  blockers: KnowledgeTeamUploadCredentialReadBoundaryBlocker[]
): void {
  if (value[key] !== null && value[key] !== undefined) {
    addBlocker(blockers, 'upload-command-present', `${path}.${key}`, 'Credential read boundary planning must not receive upload commands.');
  }
}

function checkRequiredTrue(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadCredentialReadBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadCredentialReadBoundaryBlocker[]
): boolean {
  if (value[key] !== true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be true before credential read boundary planning can proceed.`);
    return false;
  }
  return true;
}

function checkRequiredFalse(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadCredentialReadBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadCredentialReadBoundaryBlocker[]
): boolean {
  if (value[key] !== false) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be false for credential read boundary planning.`);
    return false;
  }
  return true;
}

function checkCommonExecutionDisabledFields(
  value: Record<string, unknown>,
  path: string,
  blockers: KnowledgeTeamUploadCredentialReadBoundaryBlocker[]
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

function defaultParsedClientCreationBoundary(): ParsedClientCreationBoundaryForCredentialReadBoundary {
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
    clientCreationRequiredBeforeExecution: false,
    clientCreationRequiredAfterAdapter: false,
    adapterInjectionRequiredBeforeClient: false,
    adapterDependencyInjectionOnly: false,
    mockAdapterRequired: false,
    clientFactoryDescriptorRequired: false,
    credentialReadBoundaryRequired: false,
    credentialPresenceBoundaryRequired: false,
    liveCheckBoundaryRequired: false,
    uploadCommandBoundaryRequired: false,
    artifactObjectStoreDependencyRequired: false,
    metadataIndexDependencyRequired: false,
    contentAddressedObjectKeysRequired: false,
    contentAddressedIndexKeysRequired: false,
    idempotentWritesRequired: false,
    explicitUploadApprovalRequired: false,
    clientCreated: false,
    sdkClientCreated: false,
    adapterInjected: false,
    artifactObjectStoreBound: false,
    metadataIndexBound: false,
    credentialValuesExposed: false,
    credentialPresenceChecked: false,
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

function parseClientCreationBoundaryForCredentialReadBoundary(
  value: unknown,
  blockers: KnowledgeTeamUploadCredentialReadBoundaryBlocker[]
): ParsedClientCreationBoundaryForCredentialReadBoundary {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.clientCreationBoundary', 'Credential read boundary planning requires an client creation boundary object.');
    return defaultParsedClientCreationBoundary();
  }

  scanForPrivateDetails(value, '$.clientCreationBoundary', blockers);

  if (value.kind !== 'infra-agent.knowledge-team-upload-client-creation-boundary') {
    addBlocker(blockers, 'invalid-client-creation-boundary-kind', '$.clientCreationBoundary.kind', 'Credential read boundary planning requires an upload client creation boundary artifact.');
  }
  if (value.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.clientCreationBoundary.schemaVersion', 'Credential read boundary planning requires schemaVersion 1.');
  }
  if (value.boundaryKind !== 'client-creation-boundary-dry-run') {
    addBlocker(blockers, 'invalid-boundary-kind', '$.clientCreationBoundary.boundaryKind', 'Credential read boundary planning requires the client creation dry-run boundary kind.');
  }

  checkCommonExecutionDisabledFields(value, '$.clientCreationBoundary', blockers);

  const boundaryStatus = readBoundaryStatus(value.status);
  if (boundaryStatus !== 'client-creation-boundary-ready') {
    addBlocker(blockers, 'client-creation-boundary-not-ready', '$.clientCreationBoundary.status', 'Credential read boundary planning requires a ready client creation boundary.');
  }

  const readiness = isRecord(value.readiness) ? value.readiness : {};
  if (!isRecord(value.readiness)) {
    addBlocker(blockers, 'missing-required-field', '$.clientCreationBoundary.readiness', 'Credential read boundary planning requires client creation readiness.');
  }
  const boundaryNextAction = readBoundaryNextAction(readiness.nextAction);
  if (boundaryNextAction !== 'design-credential-read-boundary') {
    addBlocker(blockers, 'client-creation-boundary-next-action-invalid', '$.clientCreationBoundary.readiness.nextAction', 'Credential read boundary planning requires the client creation boundary to advance to credential read design.');
  }
  if (typeof readiness.blockerCount === 'number' && readiness.blockerCount !== 0) {
    addBlocker(blockers, 'client-creation-boundary-not-ready', '$.clientCreationBoundary.readiness.blockerCount', 'Credential read boundary planning requires zero client creation boundary blockers.');
  }

  const parsedTarget = parseTarget(value.target, blockers);
  const sourceAdapterInjectionBoundary = isRecord(value.sourceAdapterInjectionBoundary) ? value.sourceAdapterInjectionBoundary : {};
  const clientCreationBoundary = isRecord(value.clientCreationBoundary) ? value.clientCreationBoundary : {};
  const remainingExecutionBoundaries = isRecord(value.remainingExecutionBoundaries) ? value.remainingExecutionBoundaries : {};

  if (!isRecord(value.sourceAdapterInjectionBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.clientCreationBoundary.sourceAdapterInjectionBoundary', 'Credential read boundary planning requires source adapter injection boundary summary.');
  }
  if (!isRecord(value.clientCreationBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.clientCreationBoundary.clientCreationBoundary', 'Credential read boundary planning requires client creation boundary details.');
  }
  if (!isRecord(value.remainingExecutionBoundaries)) {
    addBlocker(blockers, 'missing-required-field', '$.clientCreationBoundary.remainingExecutionBoundaries', 'Credential read boundary planning requires remaining execution boundary details.');
  }

  const reviewStatus = readReviewStatus(sourceAdapterInjectionBoundary.reviewStatus);
  const reviewKind = readReviewKind(sourceAdapterInjectionBoundary.reviewKind);
  const scopeMatched = readBool(sourceAdapterInjectionBoundary.scopeMatched);
  const humanReviewRecorded = readBool(sourceAdapterInjectionBoundary.humanReviewRecorded);
  const fingerprintVerified = readBool(sourceAdapterInjectionBoundary.fingerprintVerified);
  const sourceFingerprintVerified = readBool(sourceAdapterInjectionBoundary.sourceFingerprintVerified);
  const adapterName = typeof sourceAdapterInjectionBoundary.adapterName === 'string'
    && isSafeKnowledgeTeamBackendAdapterName(sourceAdapterInjectionBoundary.adapterName)
    ? sourceAdapterInjectionBoundary.adapterName
    : null;
  const adapterBackendKind = readAdapterBackendKind(sourceAdapterInjectionBoundary.adapterBackendKind);

  if (reviewStatus !== 'review-ready' || reviewKind !== 'human-fingerprint-dry-run' || !humanReviewRecorded || !fingerprintVerified || !sourceFingerprintVerified) {
    addBlocker(blockers, 'review-fingerprint-unverified', '$.clientCreationBoundary.sourceAdapterInjectionBoundary', 'Credential read boundary planning requires verified prior human review state.');
  }
  if (!scopeMatched) {
    addBlocker(blockers, 'scope-not-matched', '$.clientCreationBoundary.sourceAdapterInjectionBoundary.scopeMatched', 'Credential read boundary planning requires matched artifact scope.');
  }
  if (adapterName === null && sourceAdapterInjectionBoundary.adapterName !== null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.clientCreationBoundary.sourceAdapterInjectionBoundary.adapterName', 'Credential read boundary planning requires a safe adapter name.');
  }
  if (adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.clientCreationBoundary.sourceAdapterInjectionBoundary.adapterBackendKind', 'Credential read boundary planning currently accepts only the mock S3-compatible backend boundary.');
  }

  const dryRunOnly = checkRequiredTrue(clientCreationBoundary, 'dryRunOnly', '$.clientCreationBoundary.clientCreationBoundary', 'client-creation-not-required', blockers);
  const clientCreationRequiredBeforeExecution = checkRequiredTrue(clientCreationBoundary, 'clientCreationRequiredBeforeExecution', '$.clientCreationBoundary.clientCreationBoundary', 'client-creation-not-required', blockers);
  const clientCreationRequiredAfterAdapter = checkRequiredTrue(clientCreationBoundary, 'clientCreationRequiredAfterAdapter', '$.clientCreationBoundary.clientCreationBoundary', 'client-creation-not-required', blockers);
  const adapterInjectionRequiredBeforeClient = checkRequiredTrue(clientCreationBoundary, 'adapterInjectionRequiredBeforeClient', '$.clientCreationBoundary.clientCreationBoundary', 'client-creation-not-required', blockers);
  const adapterDependencyInjectionOnly = checkRequiredTrue(clientCreationBoundary, 'adapterDependencyInjectionOnly', '$.clientCreationBoundary.clientCreationBoundary', 'client-creation-not-required', blockers);
  const mockAdapterRequired = checkRequiredTrue(clientCreationBoundary, 'mockAdapterRequired', '$.clientCreationBoundary.clientCreationBoundary', 'unsupported-adapter-backend', blockers);
  const clientFactoryDescriptorRequired = checkRequiredTrue(clientCreationBoundary, 'clientFactoryDescriptorRequired', '$.clientCreationBoundary.clientCreationBoundary', 'client-creation-not-required', blockers);
  const credentialReadBoundaryRequired = checkRequiredTrue(clientCreationBoundary, 'credentialReadBoundaryRequired', '$.clientCreationBoundary.clientCreationBoundary', 'credential-read-not-required', blockers);
  const credentialPresenceBoundaryRequired = checkRequiredTrue(clientCreationBoundary, 'credentialPresenceBoundaryRequired', '$.clientCreationBoundary.clientCreationBoundary', 'credential-presence-check-enabled', blockers);
  const liveCheckBoundaryRequired = checkRequiredTrue(clientCreationBoundary, 'liveCheckBoundaryRequired', '$.clientCreationBoundary.clientCreationBoundary', 'live-check-enabled', blockers);
  const uploadCommandBoundaryRequired = checkRequiredTrue(clientCreationBoundary, 'uploadCommandBoundaryRequired', '$.clientCreationBoundary.clientCreationBoundary', 'upload-command-present', blockers);
  const artifactObjectStoreDependencyRequired = checkRequiredTrue(clientCreationBoundary, 'artifactObjectStoreDependencyRequired', '$.clientCreationBoundary.clientCreationBoundary', 'client-creation-not-required', blockers);
  const metadataIndexDependencyRequired = checkRequiredTrue(clientCreationBoundary, 'metadataIndexDependencyRequired', '$.clientCreationBoundary.clientCreationBoundary', 'client-creation-not-required', blockers);
  const contentAddressedObjectKeysRequired = checkRequiredTrue(clientCreationBoundary, 'contentAddressedObjectKeysRequired', '$.clientCreationBoundary.clientCreationBoundary', 'client-creation-not-required', blockers);
  const contentAddressedIndexKeysRequired = checkRequiredTrue(clientCreationBoundary, 'contentAddressedIndexKeysRequired', '$.clientCreationBoundary.clientCreationBoundary', 'client-creation-not-required', blockers);
  const idempotentWritesRequired = checkRequiredTrue(clientCreationBoundary, 'idempotentWritesRequired', '$.clientCreationBoundary.clientCreationBoundary', 'client-creation-not-required', blockers);
  const explicitUploadApprovalRequired = checkRequiredTrue(clientCreationBoundary, 'explicitUploadApprovalRequired', '$.clientCreationBoundary.clientCreationBoundary', 'upload-approval-already-provided', blockers);

  checkRequiredFalse(clientCreationBoundary, 'clientCreated', '$.clientCreationBoundary.clientCreationBoundary', 'client-created', blockers);
  checkRequiredFalse(clientCreationBoundary, 'sdkClientCreated', '$.clientCreationBoundary.clientCreationBoundary', 'client-created', blockers);
  checkRequiredFalse(clientCreationBoundary, 'adapterInjected', '$.clientCreationBoundary.clientCreationBoundary', 'adapter-injected', blockers);
  checkRequiredFalse(clientCreationBoundary, 'artifactObjectStoreBound', '$.clientCreationBoundary.clientCreationBoundary', 'artifact-object-store-bound', blockers);
  checkRequiredFalse(clientCreationBoundary, 'metadataIndexBound', '$.clientCreationBoundary.clientCreationBoundary', 'metadata-index-bound', blockers);
  checkRequiredFalse(clientCreationBoundary, 'credentialValuesExposed', '$.clientCreationBoundary.clientCreationBoundary', 'credential-values-exposed', blockers);
  checkRequiredFalse(clientCreationBoundary, 'credentialPresenceChecked', '$.clientCreationBoundary.clientCreationBoundary', 'credential-presence-check-enabled', blockers);
  checkRequiredFalse(clientCreationBoundary, 'liveCheckPerformed', '$.clientCreationBoundary.clientCreationBoundary', 'live-check-enabled', blockers);
  checkRequiredFalse(clientCreationBoundary, 'uploadExecutionAllowed', '$.clientCreationBoundary.clientCreationBoundary', 'upload-execution-enabled', blockers);
  checkRequiredFalse(clientCreationBoundary, 'uploadCommandGenerated', '$.clientCreationBoundary.clientCreationBoundary', 'upload-command-present', blockers);
  checkRequiredFalse(clientCreationBoundary, 'objectWriteAttempted', '$.clientCreationBoundary.clientCreationBoundary', 'object-write-attempted', blockers);
  checkRequiredFalse(clientCreationBoundary, 'metadataIndexWriteAttempted', '$.clientCreationBoundary.clientCreationBoundary', 'metadata-index-write-attempted', blockers);
  checkRequiredFalse(clientCreationBoundary, 'remoteMutationPerformed', '$.clientCreationBoundary.clientCreationBoundary', 'remote-mutation-performed', blockers);
  checkRequiredFalse(clientCreationBoundary, 'executable', '$.clientCreationBoundary.clientCreationBoundary', 'executable-state-enabled', blockers);

  checkRequiredTrue(remainingExecutionBoundaries, 'artifactBytesRequired', '$.clientCreationBoundary.remainingExecutionBoundaries', 'artifact-bytes-provided', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'adapterInjectionRequired', '$.clientCreationBoundary.remainingExecutionBoundaries', 'client-creation-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'clientCreationRequired', '$.clientCreationBoundary.remainingExecutionBoundaries', 'client-creation-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'credentialReadRequired', '$.clientCreationBoundary.remainingExecutionBoundaries', 'credential-read-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'credentialPresenceCheckRequired', '$.clientCreationBoundary.remainingExecutionBoundaries', 'credential-presence-check-enabled', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'liveCheckRequired', '$.clientCreationBoundary.remainingExecutionBoundaries', 'live-check-enabled', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'uploadCommandRequired', '$.clientCreationBoundary.remainingExecutionBoundaries', 'upload-command-present', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'writeTokenRequired', '$.clientCreationBoundary.remainingExecutionBoundaries', 'write-token-issued', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'executionLeaseRequired', '$.clientCreationBoundary.remainingExecutionBoundaries', 'execution-lease-created', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'rollbackPlanRequired', '$.clientCreationBoundary.remainingExecutionBoundaries', 'rollback-plan-created', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'auditRecordRequired', '$.clientCreationBoundary.remainingExecutionBoundaries', 'audit-record-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'artifactBytesProvided', '$.clientCreationBoundary.remainingExecutionBoundaries', 'artifact-bytes-provided', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'adapterInjected', '$.clientCreationBoundary.remainingExecutionBoundaries', 'adapter-injected', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'clientCreated', '$.clientCreationBoundary.remainingExecutionBoundaries', 'client-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'credentialValuesExposed', '$.clientCreationBoundary.remainingExecutionBoundaries', 'credential-values-exposed', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'credentialPresenceChecked', '$.clientCreationBoundary.remainingExecutionBoundaries', 'credential-presence-check-enabled', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'liveCheckPerformed', '$.clientCreationBoundary.remainingExecutionBoundaries', 'live-check-enabled', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'uploadCommandGenerated', '$.clientCreationBoundary.remainingExecutionBoundaries', 'upload-command-present', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'writeTokenIssued', '$.clientCreationBoundary.remainingExecutionBoundaries', 'write-token-issued', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'executionLeaseCreated', '$.clientCreationBoundary.remainingExecutionBoundaries', 'execution-lease-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'rollbackPlanCreated', '$.clientCreationBoundary.remainingExecutionBoundaries', 'rollback-plan-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'auditRecordCreated', '$.clientCreationBoundary.remainingExecutionBoundaries', 'audit-record-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'objectWriteAllowed', '$.clientCreationBoundary.remainingExecutionBoundaries', 'object-write-attempted', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'metadataIndexWriteAllowed', '$.clientCreationBoundary.remainingExecutionBoundaries', 'metadata-index-write-attempted', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'remoteMutationAllowed', '$.clientCreationBoundary.remainingExecutionBoundaries', 'remote-mutation-performed', blockers);

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
    clientCreationRequiredBeforeExecution,
    clientCreationRequiredAfterAdapter,
    adapterInjectionRequiredBeforeClient,
    adapterDependencyInjectionOnly,
    mockAdapterRequired,
    clientFactoryDescriptorRequired,
    credentialReadBoundaryRequired,
    credentialPresenceBoundaryRequired,
    liveCheckBoundaryRequired,
    uploadCommandBoundaryRequired,
    artifactObjectStoreDependencyRequired,
    metadataIndexDependencyRequired,
    contentAddressedObjectKeysRequired,
    contentAddressedIndexKeysRequired,
    idempotentWritesRequired,
    explicitUploadApprovalRequired,
    clientCreated: readBool(clientCreationBoundary.clientCreated),
    sdkClientCreated: readBool(clientCreationBoundary.sdkClientCreated),
    adapterInjected: readBool(clientCreationBoundary.adapterInjected),
    artifactObjectStoreBound: readBool(clientCreationBoundary.artifactObjectStoreBound),
    metadataIndexBound: readBool(clientCreationBoundary.metadataIndexBound),
    credentialValuesExposed: readBool(clientCreationBoundary.credentialValuesExposed),
    credentialPresenceChecked: readBool(clientCreationBoundary.credentialPresenceChecked),
    liveCheckPerformed: readBool(clientCreationBoundary.liveCheckPerformed),
    uploadExecutionAllowed: readBool(clientCreationBoundary.uploadExecutionAllowed),
    uploadCommandGenerated: readBool(clientCreationBoundary.uploadCommandGenerated),
    objectWriteAttempted: readBool(clientCreationBoundary.objectWriteAttempted),
    metadataIndexWriteAttempted: readBool(clientCreationBoundary.metadataIndexWriteAttempted),
    remoteMutationPerformed: readBool(clientCreationBoundary.remoteMutationPerformed),
    executable: readBool(clientCreationBoundary.executable),
    target: parsedTarget
  };
}

export function buildKnowledgeTeamUploadCredentialReadBoundary(
  input: KnowledgeTeamUploadCredentialReadBoundaryInput
): KnowledgeTeamUploadCredentialReadBoundary {
  const blockers: KnowledgeTeamUploadCredentialReadBoundaryBlocker[] = [];
  const parsedBoundary = parseClientCreationBoundaryForCredentialReadBoundary(input.clientCreationBoundary, blockers);
  const status: KnowledgeTeamUploadCredentialReadBoundaryStatus = blockers.length === 0
    ? 'credential-read-boundary-ready'
    : 'blocked';

  return {
    kind: 'infra-agent.knowledge-team-upload-credential-read-boundary',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    boundaryKind: 'credential-read-boundary-dry-run',
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
    sourceClientCreationBoundary: {
      source: 'upload-client-creation-boundary',
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
      clientCreationRequiredBeforeExecution: parsedBoundary.clientCreationRequiredBeforeExecution,
      clientCreationRequiredAfterAdapter: parsedBoundary.clientCreationRequiredAfterAdapter,
      adapterInjectionRequiredBeforeClient: parsedBoundary.adapterInjectionRequiredBeforeClient,
      adapterDependencyInjectionOnly: parsedBoundary.adapterDependencyInjectionOnly,
      mockAdapterRequired: parsedBoundary.mockAdapterRequired,
      clientFactoryDescriptorRequired: parsedBoundary.clientFactoryDescriptorRequired,
      credentialReadBoundaryRequired: parsedBoundary.credentialReadBoundaryRequired,
      credentialPresenceBoundaryRequired: parsedBoundary.credentialPresenceBoundaryRequired,
      liveCheckBoundaryRequired: parsedBoundary.liveCheckBoundaryRequired,
      uploadCommandBoundaryRequired: parsedBoundary.uploadCommandBoundaryRequired,
      artifactObjectStoreDependencyRequired: parsedBoundary.artifactObjectStoreDependencyRequired,
      metadataIndexDependencyRequired: parsedBoundary.metadataIndexDependencyRequired,
      contentAddressedObjectKeysRequired: parsedBoundary.contentAddressedObjectKeysRequired,
      contentAddressedIndexKeysRequired: parsedBoundary.contentAddressedIndexKeysRequired,
      idempotentWritesRequired: parsedBoundary.idempotentWritesRequired,
      explicitUploadApprovalRequired: parsedBoundary.explicitUploadApprovalRequired,
      clientCreated: parsedBoundary.clientCreated,
      sdkClientCreated: parsedBoundary.sdkClientCreated,
      adapterInjected: parsedBoundary.adapterInjected,
      artifactObjectStoreBound: parsedBoundary.artifactObjectStoreBound,
      metadataIndexBound: parsedBoundary.metadataIndexBound,
      credentialValuesExposed: parsedBoundary.credentialValuesExposed,
      credentialPresenceChecked: parsedBoundary.credentialPresenceChecked,
      liveCheckPerformed: parsedBoundary.liveCheckPerformed,
      uploadExecutionAllowed: parsedBoundary.uploadExecutionAllowed,
      uploadCommandGenerated: parsedBoundary.uploadCommandGenerated,
      objectWriteAttempted: parsedBoundary.objectWriteAttempted,
      metadataIndexWriteAttempted: parsedBoundary.metadataIndexWriteAttempted,
      remoteMutationPerformed: parsedBoundary.remoteMutationPerformed,
      executable: parsedBoundary.executable
    },
    credentialReadBoundary: {
      dryRunOnly: true,
      credentialReadRequiredBeforeExecution: true,
      credentialReadRequiredAfterClientBoundary: true,
      clientCreationBoundaryRequired: true,
      credentialSourceDescriptorRequired: true,
      credentialReferenceOnlyRequired: true,
      credentialValueRedactionRequired: true,
      mockAdapterRequired: true,
      clientFactoryDescriptorRequired: true,
      credentialPresenceBoundaryRequired: true,
      liveCheckBoundaryRequired: true,
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
      nextAction: status === 'credential-read-boundary-ready' ? 'design-credential-presence-boundary' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: blockers.map(entry => entry.code),
      blockers,
      reason: status === 'credential-read-boundary-ready'
        ? 'Credential read boundary requirements are modeled, but no credential values are read, no credential presence check is performed, and upload execution remains disabled until separate credential presence and mutation boundaries are designed.'
        : 'Credential read boundary planning is blocked until all client creation boundary blockers are resolved.'
    }
  };
}
