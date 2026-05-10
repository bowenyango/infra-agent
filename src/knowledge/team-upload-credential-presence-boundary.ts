import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadCredentialPresenceBoundaryStatus =
  | 'credential-presence-boundary-ready'
  | 'blocked';

export type KnowledgeTeamUploadCredentialPresenceBoundaryNextAction =
  | 'design-live-check-boundary'
  | 'resolve-blockers';

export type KnowledgeTeamUploadCredentialPresenceBoundaryBlockerCode =
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
  | 'credential-presence-check-enabled'
  | 'credential-presence-check-not-required'
  | 'credential-presence-result-exposed'
  | 'credential-read-boundary-not-ready'
  | 'credential-read-not-required'
  | 'credential-values-exposed'
  | 'credential-values-read'
  | 'executable-state-enabled'
  | 'execution-lease-created'
  | 'invalid-boundary-kind'
  | 'invalid-credential-read-boundary-kind'
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

export interface KnowledgeTeamUploadCredentialPresenceBoundaryBlocker {
  code: KnowledgeTeamUploadCredentialPresenceBoundaryBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadCredentialPresenceBoundary {
  kind: 'infra-agent.knowledge-team-upload-credential-presence-boundary';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  boundaryKind: 'credential-presence-boundary-dry-run';
  status: KnowledgeTeamUploadCredentialPresenceBoundaryStatus;
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
  sourceCredentialReadBoundary: {
    source: 'upload-credential-read-boundary';
    boundaryStatus: 'credential-read-boundary-ready' | 'blocked' | 'invalid';
    boundaryKind: 'credential-read-boundary-dry-run' | 'unsupported';
    boundaryNextAction: 'design-credential-presence-boundary' | 'resolve-blockers' | 'invalid';
    reviewStatus: 'review-ready' | 'blocked' | 'invalid';
    reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
    scopeMatched: boolean;
    humanReviewRecorded: boolean;
    fingerprintVerified: boolean;
    sourceFingerprintVerified: boolean;
    adapterName: string | null;
    adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
    dryRunOnly: boolean;
    credentialReadRequiredBeforeExecution: boolean;
    credentialReadRequiredAfterClientBoundary: boolean;
    clientCreationBoundaryRequired: boolean;
    credentialSourceDescriptorRequired: boolean;
    credentialReferenceOnlyRequired: boolean;
    credentialValueRedactionRequired: boolean;
    mockAdapterRequired: boolean;
    clientFactoryDescriptorRequired: boolean;
    credentialPresenceBoundaryRequired: boolean;
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
  credentialPresenceBoundary: {
    dryRunOnly: true;
    credentialPresenceCheckRequiredBeforeExecution: true;
    credentialPresenceCheckRequiredAfterCredentialReadBoundary: true;
    credentialReadBoundaryRequired: true;
    credentialSourceDescriptorRequired: true;
    credentialReferenceOnlyRequired: true;
    credentialValueRedactionRequired: true;
    credentialPresenceSignalRequired: true;
    credentialPresenceResultRedactionRequired: true;
    mockAdapterRequired: true;
    clientFactoryDescriptorRequired: true;
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
    credentialPresenceResultExposed: false;
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
    status: KnowledgeTeamUploadCredentialPresenceBoundaryStatus;
    nextAction: KnowledgeTeamUploadCredentialPresenceBoundaryNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadCredentialPresenceBoundaryBlockerCode[];
    blockers: KnowledgeTeamUploadCredentialPresenceBoundaryBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadCredentialPresenceBoundaryInput {
  credentialReadBoundary: unknown;
}

interface ParsedCredentialReadBoundaryForCredentialPresenceBoundary {
  boundaryStatus: 'credential-read-boundary-ready' | 'blocked' | 'invalid';
  boundaryKind: 'credential-read-boundary-dry-run' | 'unsupported';
  boundaryNextAction: 'design-credential-presence-boundary' | 'resolve-blockers' | 'invalid';
  reviewStatus: 'review-ready' | 'blocked' | 'invalid';
  reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
  scopeMatched: boolean;
  humanReviewRecorded: boolean;
  fingerprintVerified: boolean;
  sourceFingerprintVerified: boolean;
  adapterName: string | null;
  adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
  dryRunOnly: boolean;
  credentialReadRequiredBeforeExecution: boolean;
  credentialReadRequiredAfterClientBoundary: boolean;
  clientCreationBoundaryRequired: boolean;
  credentialSourceDescriptorRequired: boolean;
  credentialReferenceOnlyRequired: boolean;
  credentialValueRedactionRequired: boolean;
  mockAdapterRequired: boolean;
  clientFactoryDescriptorRequired: boolean;
  credentialPresenceBoundaryRequired: boolean;
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
const FORBIDDEN_CREDENTIAL_KEY_PATTERN = /(^credentialValue$|credentialValuePayload|credentialValueMaterial|credentialMaterial|credentialFile|credentialPath|credentialsPath|secretValue|envValue|processEnv|presenceResult|presenceCheckResult|credentialPresenceResult|credentialPresenceSignalValue)/i;
const FORBIDDEN_ADAPTER_KEY_PATTERN = /(adapterInstance|adapterObject|adapterValue|adapterDescriptorValue)/i;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|secret|password|authorization|header|accessKey|sessionToken|tokenValue|tokenMaterial|leaseValue|leaseMaterial|rollbackValue|rollbackMaterial|rollbackCommand|auditValue|auditMaterial|auditCommand)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|secret|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBool(value: unknown): boolean {
  return value === true;
}

function readBoundaryStatus(value: unknown): ParsedCredentialReadBoundaryForCredentialPresenceBoundary['boundaryStatus'] {
  if (value === 'credential-read-boundary-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readBoundaryKind(value: unknown): ParsedCredentialReadBoundaryForCredentialPresenceBoundary['boundaryKind'] {
  if (value === 'credential-read-boundary-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readBoundaryNextAction(value: unknown): ParsedCredentialReadBoundaryForCredentialPresenceBoundary['boundaryNextAction'] {
  if (value === 'design-credential-presence-boundary' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readReviewStatus(value: unknown): ParsedCredentialReadBoundaryForCredentialPresenceBoundary['reviewStatus'] {
  if (value === 'review-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readReviewKind(value: unknown): ParsedCredentialReadBoundaryForCredentialPresenceBoundary['reviewKind'] {
  if (value === 'human-fingerprint-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readAdapterBackendKind(value: unknown): ParsedCredentialReadBoundaryForCredentialPresenceBoundary['adapterBackendKind'] {
  if (value === 'mock-s3-compatible' || value === 's3-compatible') {
    return value;
  }
  return 'unsupported';
}

function addBlocker(
  blockers: KnowledgeTeamUploadCredentialPresenceBoundaryBlocker[],
  code: KnowledgeTeamUploadCredentialPresenceBoundaryBlockerCode,
  path: string,
  message: string
): void {
  blockers.push({ code, path, message });
}

function scanForPrivateDetails(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadCredentialPresenceBoundaryBlocker[]
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
        'Credential presence boundary input must not contain backend details, private paths, credentials, commands, client handles, adapter instances, or raw artifact content.'
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
        'Credential presence boundary input must not contain raw bytes, byte buffers, streams, content payloads, or local artifact paths.'
      );
      continue;
    }
    if (FORBIDDEN_CLIENT_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'client-dependency-leak',
        entryPath,
        'Credential presence boundary input must not contain SDK clients, client configs, object store handles, metadata index handles, or write functions.'
      );
      continue;
    }
    if (FORBIDDEN_CREDENTIAL_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'credential-dependency-leak',
        entryPath,
        'Credential presence boundary input must not contain credential values, credential files, environment reads, or credential presence results.'
      );
      continue;
    }
    if (FORBIDDEN_ADAPTER_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'adapter-dependency-leak',
        entryPath,
        'Credential presence boundary input must not contain adapter instances or concrete adapter values.'
      );
      continue;
    }
    if (FORBIDDEN_LEAK_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'backend-detail-leak',
        entryPath,
        'Credential presence boundary input must not contain backend details, credential fields, commands, token/lease material, or raw artifact content.'
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
  blockers: KnowledgeTeamUploadCredentialPresenceBoundaryBlocker[]
): ParsedCredentialReadBoundaryForCredentialPresenceBoundary['target'] {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.credentialReadBoundary.target', 'Credential presence boundary planning requires a target object.');
    addBlocker(blockers, 'unsafe-artifact-reference', '$.credentialReadBoundary.target', 'Credential presence boundary planning requires safe target references.');
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
    addBlocker(blockers, 'unsafe-artifact-reference', '$.credentialReadBoundary.target', 'Credential presence boundary planning requires safe manifest, object, hash, and artifact references.');
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
  code: KnowledgeTeamUploadCredentialPresenceBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadCredentialPresenceBoundaryBlocker[]
): void {
  if (value[key] === true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must remain false for credential presence boundary planning.`);
  }
}

function checkNullCommand(
  value: Record<string, unknown>,
  key: string,
  path: string,
  blockers: KnowledgeTeamUploadCredentialPresenceBoundaryBlocker[]
): void {
  if (value[key] !== null && value[key] !== undefined) {
    addBlocker(blockers, 'upload-command-present', `${path}.${key}`, 'Credential presence boundary planning must not receive upload commands.');
  }
}

function checkRequiredTrue(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadCredentialPresenceBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadCredentialPresenceBoundaryBlocker[]
): boolean {
  if (value[key] !== true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be true before credential presence boundary planning can proceed.`);
    return false;
  }
  return true;
}

function checkRequiredFalse(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadCredentialPresenceBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadCredentialPresenceBoundaryBlocker[]
): boolean {
  if (value[key] !== false) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be false for credential presence boundary planning.`);
    return false;
  }
  return true;
}

function checkCommonExecutionDisabledFields(
  value: Record<string, unknown>,
  path: string,
  blockers: KnowledgeTeamUploadCredentialPresenceBoundaryBlocker[]
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

function defaultParsedCredentialReadBoundary(): ParsedCredentialReadBoundaryForCredentialPresenceBoundary {
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
    credentialReadRequiredBeforeExecution: false,
    credentialReadRequiredAfterClientBoundary: false,
    clientCreationBoundaryRequired: false,
    credentialSourceDescriptorRequired: false,
    credentialReferenceOnlyRequired: false,
    credentialValueRedactionRequired: false,
    mockAdapterRequired: false,
    clientFactoryDescriptorRequired: false,
    credentialPresenceBoundaryRequired: false,
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

function parseCredentialReadBoundaryForCredentialPresenceBoundary(
  value: unknown,
  blockers: KnowledgeTeamUploadCredentialPresenceBoundaryBlocker[]
): ParsedCredentialReadBoundaryForCredentialPresenceBoundary {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.credentialReadBoundary', 'Credential presence boundary planning requires a credential read boundary object.');
    return defaultParsedCredentialReadBoundary();
  }

  scanForPrivateDetails(value, '$.credentialReadBoundary', blockers);

  if (value.kind !== 'infra-agent.knowledge-team-upload-credential-read-boundary') {
    addBlocker(blockers, 'invalid-credential-read-boundary-kind', '$.credentialReadBoundary.kind', 'Credential presence boundary planning requires an upload credential read boundary artifact.');
  }
  if (value.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.credentialReadBoundary.schemaVersion', 'Credential presence boundary planning requires schemaVersion 1.');
  }
  if (value.boundaryKind !== 'credential-read-boundary-dry-run') {
    addBlocker(blockers, 'invalid-boundary-kind', '$.credentialReadBoundary.boundaryKind', 'Credential presence boundary planning requires the credential read dry-run boundary kind.');
  }

  checkCommonExecutionDisabledFields(value, '$.credentialReadBoundary', blockers);

  const boundaryStatus = readBoundaryStatus(value.status);
  if (boundaryStatus !== 'credential-read-boundary-ready') {
    addBlocker(blockers, 'credential-read-boundary-not-ready', '$.credentialReadBoundary.status', 'Credential presence boundary planning requires a ready credential read boundary.');
  }

  const readiness = isRecord(value.readiness) ? value.readiness : {};
  if (!isRecord(value.readiness)) {
    addBlocker(blockers, 'missing-required-field', '$.credentialReadBoundary.readiness', 'Credential presence boundary planning requires credential read readiness.');
  }
  const boundaryNextAction = readBoundaryNextAction(readiness.nextAction);
  if (boundaryNextAction !== 'design-credential-presence-boundary') {
    addBlocker(blockers, 'credential-presence-boundary-next-action-invalid', '$.credentialReadBoundary.readiness.nextAction', 'Credential presence boundary planning requires the credential read boundary to advance to credential presence design.');
  }
  if (typeof readiness.blockerCount === 'number' && readiness.blockerCount !== 0) {
    addBlocker(blockers, 'credential-read-boundary-not-ready', '$.credentialReadBoundary.readiness.blockerCount', 'Credential presence boundary planning requires zero credential read boundary blockers.');
  }

  const parsedTarget = parseTarget(value.target, blockers);
  const sourceClientCreationBoundary = isRecord(value.sourceClientCreationBoundary) ? value.sourceClientCreationBoundary : {};
  const credentialReadBoundary = isRecord(value.credentialReadBoundary) ? value.credentialReadBoundary : {};
  const remainingExecutionBoundaries = isRecord(value.remainingExecutionBoundaries) ? value.remainingExecutionBoundaries : {};

  if (!isRecord(value.sourceClientCreationBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.credentialReadBoundary.sourceClientCreationBoundary', 'Credential presence boundary planning requires source client creation boundary summary.');
  }
  if (!isRecord(value.credentialReadBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.credentialReadBoundary.credentialReadBoundary', 'Credential presence boundary planning requires credential read boundary details.');
  }
  if (!isRecord(value.remainingExecutionBoundaries)) {
    addBlocker(blockers, 'missing-required-field', '$.credentialReadBoundary.remainingExecutionBoundaries', 'Credential presence boundary planning requires remaining execution boundary details.');
  }

  const reviewStatus = readReviewStatus(sourceClientCreationBoundary.reviewStatus);
  const reviewKind = readReviewKind(sourceClientCreationBoundary.reviewKind);
  const scopeMatched = readBool(sourceClientCreationBoundary.scopeMatched);
  const humanReviewRecorded = readBool(sourceClientCreationBoundary.humanReviewRecorded);
  const fingerprintVerified = readBool(sourceClientCreationBoundary.fingerprintVerified);
  const sourceFingerprintVerified = readBool(sourceClientCreationBoundary.sourceFingerprintVerified);
  const adapterName = typeof sourceClientCreationBoundary.adapterName === 'string'
    && isSafeKnowledgeTeamBackendAdapterName(sourceClientCreationBoundary.adapterName)
    ? sourceClientCreationBoundary.adapterName
    : null;
  const adapterBackendKind = readAdapterBackendKind(sourceClientCreationBoundary.adapterBackendKind);

  if (reviewStatus !== 'review-ready' || reviewKind !== 'human-fingerprint-dry-run' || !humanReviewRecorded || !fingerprintVerified || !sourceFingerprintVerified) {
    addBlocker(blockers, 'review-fingerprint-unverified', '$.credentialReadBoundary.sourceClientCreationBoundary', 'Credential presence boundary planning requires verified prior human review state.');
  }
  if (!scopeMatched) {
    addBlocker(blockers, 'scope-not-matched', '$.credentialReadBoundary.sourceClientCreationBoundary.scopeMatched', 'Credential presence boundary planning requires matched artifact scope.');
  }
  if (adapterName === null && sourceClientCreationBoundary.adapterName !== null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.credentialReadBoundary.sourceClientCreationBoundary.adapterName', 'Credential presence boundary planning requires a safe adapter name.');
  }
  if (adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.credentialReadBoundary.sourceClientCreationBoundary.adapterBackendKind', 'Credential presence boundary planning currently accepts only the mock S3-compatible backend boundary.');
  }

  const dryRunOnly = checkRequiredTrue(credentialReadBoundary, 'dryRunOnly', '$.credentialReadBoundary.credentialReadBoundary', 'credential-read-not-required', blockers);
  const credentialReadRequiredBeforeExecution = checkRequiredTrue(credentialReadBoundary, 'credentialReadRequiredBeforeExecution', '$.credentialReadBoundary.credentialReadBoundary', 'credential-read-not-required', blockers);
  const credentialReadRequiredAfterClientBoundary = checkRequiredTrue(credentialReadBoundary, 'credentialReadRequiredAfterClientBoundary', '$.credentialReadBoundary.credentialReadBoundary', 'credential-read-not-required', blockers);
  const clientCreationBoundaryRequired = checkRequiredTrue(credentialReadBoundary, 'clientCreationBoundaryRequired', '$.credentialReadBoundary.credentialReadBoundary', 'client-created', blockers);
  const credentialSourceDescriptorRequired = checkRequiredTrue(credentialReadBoundary, 'credentialSourceDescriptorRequired', '$.credentialReadBoundary.credentialReadBoundary', 'credential-read-not-required', blockers);
  const credentialReferenceOnlyRequired = checkRequiredTrue(credentialReadBoundary, 'credentialReferenceOnlyRequired', '$.credentialReadBoundary.credentialReadBoundary', 'credential-read-not-required', blockers);
  const credentialValueRedactionRequired = checkRequiredTrue(credentialReadBoundary, 'credentialValueRedactionRequired', '$.credentialReadBoundary.credentialReadBoundary', 'credential-values-exposed', blockers);
  const mockAdapterRequired = checkRequiredTrue(credentialReadBoundary, 'mockAdapterRequired', '$.credentialReadBoundary.credentialReadBoundary', 'unsupported-adapter-backend', blockers);
  const clientFactoryDescriptorRequired = checkRequiredTrue(credentialReadBoundary, 'clientFactoryDescriptorRequired', '$.credentialReadBoundary.credentialReadBoundary', 'client-created', blockers);
  const credentialPresenceBoundaryRequired = checkRequiredTrue(credentialReadBoundary, 'credentialPresenceBoundaryRequired', '$.credentialReadBoundary.credentialReadBoundary', 'credential-presence-check-not-required', blockers);
  const liveCheckBoundaryRequired = checkRequiredTrue(credentialReadBoundary, 'liveCheckBoundaryRequired', '$.credentialReadBoundary.credentialReadBoundary', 'live-check-enabled', blockers);
  const uploadCommandBoundaryRequired = checkRequiredTrue(credentialReadBoundary, 'uploadCommandBoundaryRequired', '$.credentialReadBoundary.credentialReadBoundary', 'upload-command-present', blockers);
  const artifactObjectStoreDependencyRequired = checkRequiredTrue(credentialReadBoundary, 'artifactObjectStoreDependencyRequired', '$.credentialReadBoundary.credentialReadBoundary', 'client-created', blockers);
  const metadataIndexDependencyRequired = checkRequiredTrue(credentialReadBoundary, 'metadataIndexDependencyRequired', '$.credentialReadBoundary.credentialReadBoundary', 'client-created', blockers);
  const contentAddressedObjectKeysRequired = checkRequiredTrue(credentialReadBoundary, 'contentAddressedObjectKeysRequired', '$.credentialReadBoundary.credentialReadBoundary', 'client-created', blockers);
  const contentAddressedIndexKeysRequired = checkRequiredTrue(credentialReadBoundary, 'contentAddressedIndexKeysRequired', '$.credentialReadBoundary.credentialReadBoundary', 'client-created', blockers);
  const idempotentWritesRequired = checkRequiredTrue(credentialReadBoundary, 'idempotentWritesRequired', '$.credentialReadBoundary.credentialReadBoundary', 'client-created', blockers);
  const explicitUploadApprovalRequired = checkRequiredTrue(credentialReadBoundary, 'explicitUploadApprovalRequired', '$.credentialReadBoundary.credentialReadBoundary', 'upload-approval-already-provided', blockers);

  checkRequiredFalse(credentialReadBoundary, 'credentialValuesRead', '$.credentialReadBoundary.credentialReadBoundary', 'credential-values-read', blockers);
  checkRequiredFalse(credentialReadBoundary, 'credentialValuesExposed', '$.credentialReadBoundary.credentialReadBoundary', 'credential-values-exposed', blockers);
  checkRequiredFalse(credentialReadBoundary, 'credentialPresenceChecked', '$.credentialReadBoundary.credentialReadBoundary', 'credential-presence-check-enabled', blockers);
  checkRequiredFalse(credentialReadBoundary, 'clientCreated', '$.credentialReadBoundary.credentialReadBoundary', 'client-created', blockers);
  checkRequiredFalse(credentialReadBoundary, 'sdkClientCreated', '$.credentialReadBoundary.credentialReadBoundary', 'client-created', blockers);
  checkRequiredFalse(credentialReadBoundary, 'adapterInjected', '$.credentialReadBoundary.credentialReadBoundary', 'adapter-injected', blockers);
  checkRequiredFalse(credentialReadBoundary, 'artifactObjectStoreBound', '$.credentialReadBoundary.credentialReadBoundary', 'artifact-object-store-bound', blockers);
  checkRequiredFalse(credentialReadBoundary, 'metadataIndexBound', '$.credentialReadBoundary.credentialReadBoundary', 'metadata-index-bound', blockers);
  checkRequiredFalse(credentialReadBoundary, 'liveCheckPerformed', '$.credentialReadBoundary.credentialReadBoundary', 'live-check-enabled', blockers);
  checkRequiredFalse(credentialReadBoundary, 'uploadExecutionAllowed', '$.credentialReadBoundary.credentialReadBoundary', 'upload-execution-enabled', blockers);
  checkRequiredFalse(credentialReadBoundary, 'uploadCommandGenerated', '$.credentialReadBoundary.credentialReadBoundary', 'upload-command-present', blockers);
  checkRequiredFalse(credentialReadBoundary, 'objectWriteAttempted', '$.credentialReadBoundary.credentialReadBoundary', 'object-write-attempted', blockers);
  checkRequiredFalse(credentialReadBoundary, 'metadataIndexWriteAttempted', '$.credentialReadBoundary.credentialReadBoundary', 'metadata-index-write-attempted', blockers);
  checkRequiredFalse(credentialReadBoundary, 'remoteMutationPerformed', '$.credentialReadBoundary.credentialReadBoundary', 'remote-mutation-performed', blockers);
  checkRequiredFalse(credentialReadBoundary, 'executable', '$.credentialReadBoundary.credentialReadBoundary', 'executable-state-enabled', blockers);

  checkRequiredTrue(remainingExecutionBoundaries, 'artifactBytesRequired', '$.credentialReadBoundary.remainingExecutionBoundaries', 'artifact-bytes-provided', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'adapterInjectionRequired', '$.credentialReadBoundary.remainingExecutionBoundaries', 'client-created', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'clientCreationRequired', '$.credentialReadBoundary.remainingExecutionBoundaries', 'client-created', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'credentialReadRequired', '$.credentialReadBoundary.remainingExecutionBoundaries', 'credential-read-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'credentialPresenceCheckRequired', '$.credentialReadBoundary.remainingExecutionBoundaries', 'credential-presence-check-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'liveCheckRequired', '$.credentialReadBoundary.remainingExecutionBoundaries', 'live-check-enabled', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'uploadCommandRequired', '$.credentialReadBoundary.remainingExecutionBoundaries', 'upload-command-present', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'writeTokenRequired', '$.credentialReadBoundary.remainingExecutionBoundaries', 'write-token-issued', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'executionLeaseRequired', '$.credentialReadBoundary.remainingExecutionBoundaries', 'execution-lease-created', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'rollbackPlanRequired', '$.credentialReadBoundary.remainingExecutionBoundaries', 'rollback-plan-created', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'auditRecordRequired', '$.credentialReadBoundary.remainingExecutionBoundaries', 'audit-record-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'artifactBytesProvided', '$.credentialReadBoundary.remainingExecutionBoundaries', 'artifact-bytes-provided', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'adapterInjected', '$.credentialReadBoundary.remainingExecutionBoundaries', 'adapter-injected', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'clientCreated', '$.credentialReadBoundary.remainingExecutionBoundaries', 'client-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'credentialValuesExposed', '$.credentialReadBoundary.remainingExecutionBoundaries', 'credential-values-exposed', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'credentialPresenceChecked', '$.credentialReadBoundary.remainingExecutionBoundaries', 'credential-presence-check-enabled', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'liveCheckPerformed', '$.credentialReadBoundary.remainingExecutionBoundaries', 'live-check-enabled', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'uploadCommandGenerated', '$.credentialReadBoundary.remainingExecutionBoundaries', 'upload-command-present', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'writeTokenIssued', '$.credentialReadBoundary.remainingExecutionBoundaries', 'write-token-issued', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'executionLeaseCreated', '$.credentialReadBoundary.remainingExecutionBoundaries', 'execution-lease-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'rollbackPlanCreated', '$.credentialReadBoundary.remainingExecutionBoundaries', 'rollback-plan-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'auditRecordCreated', '$.credentialReadBoundary.remainingExecutionBoundaries', 'audit-record-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'objectWriteAllowed', '$.credentialReadBoundary.remainingExecutionBoundaries', 'object-write-attempted', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'metadataIndexWriteAllowed', '$.credentialReadBoundary.remainingExecutionBoundaries', 'metadata-index-write-attempted', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'remoteMutationAllowed', '$.credentialReadBoundary.remainingExecutionBoundaries', 'remote-mutation-performed', blockers);

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
    credentialReadRequiredBeforeExecution,
    credentialReadRequiredAfterClientBoundary,
    clientCreationBoundaryRequired,
    credentialSourceDescriptorRequired,
    credentialReferenceOnlyRequired,
    credentialValueRedactionRequired,
    mockAdapterRequired,
    clientFactoryDescriptorRequired,
    credentialPresenceBoundaryRequired,
    liveCheckBoundaryRequired,
    uploadCommandBoundaryRequired,
    artifactObjectStoreDependencyRequired,
    metadataIndexDependencyRequired,
    contentAddressedObjectKeysRequired,
    contentAddressedIndexKeysRequired,
    idempotentWritesRequired,
    explicitUploadApprovalRequired,
    credentialValuesRead: readBool(credentialReadBoundary.credentialValuesRead),
    credentialValuesExposed: readBool(credentialReadBoundary.credentialValuesExposed),
    credentialPresenceChecked: readBool(credentialReadBoundary.credentialPresenceChecked),
    clientCreated: readBool(credentialReadBoundary.clientCreated),
    sdkClientCreated: readBool(credentialReadBoundary.sdkClientCreated),
    adapterInjected: readBool(credentialReadBoundary.adapterInjected),
    artifactObjectStoreBound: readBool(credentialReadBoundary.artifactObjectStoreBound),
    metadataIndexBound: readBool(credentialReadBoundary.metadataIndexBound),
    liveCheckPerformed: readBool(credentialReadBoundary.liveCheckPerformed),
    uploadExecutionAllowed: readBool(credentialReadBoundary.uploadExecutionAllowed),
    uploadCommandGenerated: readBool(credentialReadBoundary.uploadCommandGenerated),
    objectWriteAttempted: readBool(credentialReadBoundary.objectWriteAttempted),
    metadataIndexWriteAttempted: readBool(credentialReadBoundary.metadataIndexWriteAttempted),
    remoteMutationPerformed: readBool(credentialReadBoundary.remoteMutationPerformed),
    executable: readBool(credentialReadBoundary.executable),
    target: parsedTarget
  };
}

export function buildKnowledgeTeamUploadCredentialPresenceBoundary(
  input: KnowledgeTeamUploadCredentialPresenceBoundaryInput
): KnowledgeTeamUploadCredentialPresenceBoundary {
  const blockers: KnowledgeTeamUploadCredentialPresenceBoundaryBlocker[] = [];
  const parsedBoundary = parseCredentialReadBoundaryForCredentialPresenceBoundary(input.credentialReadBoundary, blockers);
  const status: KnowledgeTeamUploadCredentialPresenceBoundaryStatus = blockers.length === 0
    ? 'credential-presence-boundary-ready'
    : 'blocked';

  return {
    kind: 'infra-agent.knowledge-team-upload-credential-presence-boundary',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    boundaryKind: 'credential-presence-boundary-dry-run',
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
    sourceCredentialReadBoundary: {
      source: 'upload-credential-read-boundary',
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
      credentialReadRequiredBeforeExecution: parsedBoundary.credentialReadRequiredBeforeExecution,
      credentialReadRequiredAfterClientBoundary: parsedBoundary.credentialReadRequiredAfterClientBoundary,
      clientCreationBoundaryRequired: parsedBoundary.clientCreationBoundaryRequired,
      credentialSourceDescriptorRequired: parsedBoundary.credentialSourceDescriptorRequired,
      credentialReferenceOnlyRequired: parsedBoundary.credentialReferenceOnlyRequired,
      credentialValueRedactionRequired: parsedBoundary.credentialValueRedactionRequired,
      mockAdapterRequired: parsedBoundary.mockAdapterRequired,
      clientFactoryDescriptorRequired: parsedBoundary.clientFactoryDescriptorRequired,
      credentialPresenceBoundaryRequired: parsedBoundary.credentialPresenceBoundaryRequired,
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
    credentialPresenceBoundary: {
      dryRunOnly: true,
      credentialPresenceCheckRequiredBeforeExecution: true,
      credentialPresenceCheckRequiredAfterCredentialReadBoundary: true,
      credentialReadBoundaryRequired: true,
      credentialSourceDescriptorRequired: true,
      credentialReferenceOnlyRequired: true,
      credentialValueRedactionRequired: true,
      credentialPresenceSignalRequired: true,
      credentialPresenceResultRedactionRequired: true,
      mockAdapterRequired: true,
      clientFactoryDescriptorRequired: true,
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
      nextAction: status === 'credential-presence-boundary-ready' ? 'design-live-check-boundary' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: blockers.map(entry => entry.code),
      blockers,
      reason: status === 'credential-presence-boundary-ready'
        ? 'Credential presence boundary requirements are modeled, but no credential values are read, no credential presence check is performed, and upload execution remains disabled until separate live-check and mutation boundaries are designed.'
        : 'Credential presence boundary planning is blocked until all credential read boundary blockers are resolved.'
    }
  };
}
