import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadClientCreationBoundaryStatus =
  | 'client-creation-boundary-ready'
  | 'blocked';

export type KnowledgeTeamUploadClientCreationBoundaryNextAction =
  | 'design-credential-read-boundary'
  | 'resolve-blockers';

export type KnowledgeTeamUploadClientCreationBoundaryBlockerCode =
  | 'adapter-dependency-leak'
  | 'adapter-injected'
  | 'adapter-injection-boundary-next-action-invalid'
  | 'adapter-injection-boundary-not-ready'
  | 'adapter-injection-not-required'
  | 'artifact-bytes-provided'
  | 'artifact-object-store-bound'
  | 'audit-record-created'
  | 'backend-detail-leak'
  | 'client-created'
  | 'client-creation-not-required'
  | 'client-dependency-leak'
  | 'credential-presence-check-enabled'
  | 'credential-values-exposed'
  | 'executable-state-enabled'
  | 'execution-lease-created'
  | 'invalid-adapter-injection-boundary-kind'
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

export interface KnowledgeTeamUploadClientCreationBoundaryBlocker {
  code: KnowledgeTeamUploadClientCreationBoundaryBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadClientCreationBoundary {
  kind: 'infra-agent.knowledge-team-upload-client-creation-boundary';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  boundaryKind: 'client-creation-boundary-dry-run';
  status: KnowledgeTeamUploadClientCreationBoundaryStatus;
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
  sourceAdapterInjectionBoundary: {
    source: 'upload-adapter-injection-boundary';
    boundaryStatus: 'adapter-injection-boundary-ready' | 'blocked' | 'invalid';
    boundaryKind: 'adapter-injection-boundary-dry-run' | 'unsupported';
    boundaryNextAction: 'design-client-creation-boundary' | 'resolve-blockers' | 'invalid';
    reviewStatus: 'review-ready' | 'blocked' | 'invalid';
    reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
    scopeMatched: boolean;
    humanReviewRecorded: boolean;
    fingerprintVerified: boolean;
    sourceFingerprintVerified: boolean;
    adapterName: string | null;
    adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
    adapterInjectionRequiredBeforeExecution: boolean;
    adapterInjectionRequiredAfterBytes: boolean;
    adapterDependencyInjectionOnly: boolean;
    mockAdapterRequired: boolean;
    adapterDescriptorRequired: boolean;
    artifactObjectStoreDependencyRequired: boolean;
    metadataIndexDependencyRequired: boolean;
    contentAddressedObjectKeysRequired: boolean;
    contentAddressedIndexKeysRequired: boolean;
    idempotentWritesRequired: boolean;
    explicitUploadApprovalRequired: boolean;
    artifactBytesRequiredBeforeAdapter: boolean;
    artifactBytesProvided: boolean;
    artifactDigestRequired: boolean;
    artifactDigestVerified: boolean;
    artifactScopeBindingRequired: boolean;
    artifactScopeBoundToArtifact: boolean;
    writeTokenRequiredBeforeAdapter: boolean;
    writeTokenIssued: boolean;
    executionLeaseRequiredBeforeAdapter: boolean;
    executionLeaseCreated: boolean;
    rollbackPlanRequiredBeforeAdapter: boolean;
    rollbackPlanCreated: boolean;
    auditRecordRequiredBeforeAdapter: boolean;
    auditRecordCreated: boolean;
    adapterInjected: boolean;
    clientCreated: boolean;
    artifactObjectStoreBound: boolean;
    metadataIndexBound: boolean;
    executable: boolean;
  };
  clientCreationBoundary: {
    dryRunOnly: true;
    clientCreationRequiredBeforeExecution: true;
    clientCreationRequiredAfterAdapter: true;
    adapterInjectionRequiredBeforeClient: true;
    adapterDependencyInjectionOnly: true;
    mockAdapterRequired: true;
    clientFactoryDescriptorRequired: true;
    credentialReadBoundaryRequired: true;
    credentialPresenceBoundaryRequired: true;
    liveCheckBoundaryRequired: true;
    uploadCommandBoundaryRequired: true;
    artifactObjectStoreDependencyRequired: true;
    metadataIndexDependencyRequired: true;
    contentAddressedObjectKeysRequired: true;
    contentAddressedIndexKeysRequired: true;
    idempotentWritesRequired: true;
    explicitUploadApprovalRequired: true;
    clientCreated: false;
    sdkClientCreated: false;
    adapterInjected: false;
    artifactObjectStoreBound: false;
    metadataIndexBound: false;
    credentialValuesExposed: false;
    credentialPresenceChecked: false;
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
    status: KnowledgeTeamUploadClientCreationBoundaryStatus;
    nextAction: KnowledgeTeamUploadClientCreationBoundaryNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadClientCreationBoundaryBlockerCode[];
    blockers: KnowledgeTeamUploadClientCreationBoundaryBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadClientCreationBoundaryInput {
  adapterInjectionBoundary: unknown;
}

interface ParsedAdapterInjectionBoundaryForClientCreationBoundary {
  boundaryStatus: 'adapter-injection-boundary-ready' | 'blocked' | 'invalid';
  boundaryKind: 'adapter-injection-boundary-dry-run' | 'unsupported';
  boundaryNextAction: 'design-client-creation-boundary' | 'resolve-blockers' | 'invalid';
  reviewStatus: 'review-ready' | 'blocked' | 'invalid';
  reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
  scopeMatched: boolean;
  humanReviewRecorded: boolean;
  fingerprintVerified: boolean;
  sourceFingerprintVerified: boolean;
  adapterName: string | null;
  adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
  adapterInjectionRequiredBeforeExecution: boolean;
  adapterInjectionRequiredAfterBytes: boolean;
  adapterDependencyInjectionOnly: boolean;
  mockAdapterRequired: boolean;
  adapterDescriptorRequired: boolean;
  artifactObjectStoreDependencyRequired: boolean;
  metadataIndexDependencyRequired: boolean;
  contentAddressedObjectKeysRequired: boolean;
  contentAddressedIndexKeysRequired: boolean;
  idempotentWritesRequired: boolean;
  explicitUploadApprovalRequired: boolean;
  artifactBytesRequiredBeforeAdapter: boolean;
  artifactBytesProvided: boolean;
  artifactDigestRequired: boolean;
  artifactDigestVerified: boolean;
  artifactScopeBindingRequired: boolean;
  artifactScopeBoundToArtifact: boolean;
  writeTokenRequiredBeforeAdapter: boolean;
  writeTokenIssued: boolean;
  executionLeaseRequiredBeforeAdapter: boolean;
  executionLeaseCreated: boolean;
  rollbackPlanRequiredBeforeAdapter: boolean;
  rollbackPlanCreated: boolean;
  auditRecordRequiredBeforeAdapter: boolean;
  auditRecordCreated: boolean;
  adapterInjected: boolean;
  clientCreated: boolean;
  artifactObjectStoreBound: boolean;
  metadataIndexBound: boolean;
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
const FORBIDDEN_ADAPTER_KEY_PATTERN = /(adapterInstance|adapterObject|adapterValue|adapterDescriptorValue)/i;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|secret|password|authorization|header|accessKey|sessionToken|tokenValue|tokenMaterial|leaseValue|leaseMaterial|rollbackValue|rollbackMaterial|rollbackCommand|auditValue|auditMaterial|auditCommand)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|secret|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBool(value: unknown): boolean {
  return value === true;
}

function readBoundaryStatus(value: unknown): ParsedAdapterInjectionBoundaryForClientCreationBoundary['boundaryStatus'] {
  if (value === 'adapter-injection-boundary-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readBoundaryKind(value: unknown): ParsedAdapterInjectionBoundaryForClientCreationBoundary['boundaryKind'] {
  if (value === 'adapter-injection-boundary-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readBoundaryNextAction(value: unknown): ParsedAdapterInjectionBoundaryForClientCreationBoundary['boundaryNextAction'] {
  if (value === 'design-client-creation-boundary' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readReviewStatus(value: unknown): ParsedAdapterInjectionBoundaryForClientCreationBoundary['reviewStatus'] {
  if (value === 'review-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readReviewKind(value: unknown): ParsedAdapterInjectionBoundaryForClientCreationBoundary['reviewKind'] {
  if (value === 'human-fingerprint-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readAdapterBackendKind(value: unknown): ParsedAdapterInjectionBoundaryForClientCreationBoundary['adapterBackendKind'] {
  if (value === 'mock-s3-compatible' || value === 's3-compatible') {
    return value;
  }
  return 'unsupported';
}

function addBlocker(
  blockers: KnowledgeTeamUploadClientCreationBoundaryBlocker[],
  code: KnowledgeTeamUploadClientCreationBoundaryBlockerCode,
  path: string,
  message: string
): void {
  blockers.push({ code, path, message });
}

function scanForPrivateDetails(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadClientCreationBoundaryBlocker[]
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
        'Client creation boundary input must not contain backend details, private paths, credentials, commands, client handles, adapter instances, or raw artifact content.'
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
        'Client creation boundary input must not contain raw bytes, byte buffers, streams, content payloads, or local artifact paths.'
      );
      continue;
    }
    if (FORBIDDEN_CLIENT_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'client-dependency-leak',
        entryPath,
        'Client creation boundary input must not contain SDK clients, client configs, object store handles, metadata index handles, or write functions.'
      );
      continue;
    }
    if (FORBIDDEN_ADAPTER_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'adapter-dependency-leak',
        entryPath,
        'Client creation boundary input must not contain adapter instances or concrete adapter values.'
      );
      continue;
    }
    if (FORBIDDEN_LEAK_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'backend-detail-leak',
        entryPath,
        'Client creation boundary input must not contain backend details, credential fields, commands, token/lease material, or raw artifact content.'
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
  blockers: KnowledgeTeamUploadClientCreationBoundaryBlocker[]
): ParsedAdapterInjectionBoundaryForClientCreationBoundary['target'] {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.adapterInjectionBoundary.target', 'Client creation boundary planning requires a target object.');
    addBlocker(blockers, 'unsafe-artifact-reference', '$.adapterInjectionBoundary.target', 'Client creation boundary planning requires safe target references.');
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
    addBlocker(blockers, 'unsafe-artifact-reference', '$.adapterInjectionBoundary.target', 'Client creation boundary planning requires safe manifest, object, hash, and artifact references.');
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
  code: KnowledgeTeamUploadClientCreationBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadClientCreationBoundaryBlocker[]
): void {
  if (value[key] === true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must remain false for client creation boundary planning.`);
  }
}

function checkNullCommand(
  value: Record<string, unknown>,
  key: string,
  path: string,
  blockers: KnowledgeTeamUploadClientCreationBoundaryBlocker[]
): void {
  if (value[key] !== null && value[key] !== undefined) {
    addBlocker(blockers, 'upload-command-present', `${path}.${key}`, 'Client creation boundary planning must not receive upload commands.');
  }
}

function checkRequiredTrue(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadClientCreationBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadClientCreationBoundaryBlocker[]
): boolean {
  if (value[key] !== true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be true before client creation boundary planning can proceed.`);
    return false;
  }
  return true;
}

function checkRequiredFalse(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadClientCreationBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadClientCreationBoundaryBlocker[]
): boolean {
  if (value[key] !== false) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be false for client creation boundary planning.`);
    return false;
  }
  return true;
}

function checkCommonExecutionDisabledFields(
  value: Record<string, unknown>,
  path: string,
  blockers: KnowledgeTeamUploadClientCreationBoundaryBlocker[]
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

function defaultParsedAdapterInjectionBoundary(): ParsedAdapterInjectionBoundaryForClientCreationBoundary {
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
    adapterInjectionRequiredBeforeExecution: false,
    adapterInjectionRequiredAfterBytes: false,
    adapterDependencyInjectionOnly: false,
    mockAdapterRequired: false,
    adapterDescriptorRequired: false,
    artifactObjectStoreDependencyRequired: false,
    metadataIndexDependencyRequired: false,
    contentAddressedObjectKeysRequired: false,
    contentAddressedIndexKeysRequired: false,
    idempotentWritesRequired: false,
    explicitUploadApprovalRequired: false,
    artifactBytesRequiredBeforeAdapter: false,
    artifactBytesProvided: false,
    artifactDigestRequired: false,
    artifactDigestVerified: false,
    artifactScopeBindingRequired: false,
    artifactScopeBoundToArtifact: false,
    writeTokenRequiredBeforeAdapter: false,
    writeTokenIssued: false,
    executionLeaseRequiredBeforeAdapter: false,
    executionLeaseCreated: false,
    rollbackPlanRequiredBeforeAdapter: false,
    rollbackPlanCreated: false,
    auditRecordRequiredBeforeAdapter: false,
    auditRecordCreated: false,
    adapterInjected: false,
    clientCreated: false,
    artifactObjectStoreBound: false,
    metadataIndexBound: false,
    executable: false,
    target: {
      manifestId: null,
      objectKey: null,
      objectSha256: null,
      artifactId: null
    }
  };
}

function parseAdapterInjectionBoundaryForClientCreationBoundary(
  value: unknown,
  blockers: KnowledgeTeamUploadClientCreationBoundaryBlocker[]
): ParsedAdapterInjectionBoundaryForClientCreationBoundary {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.adapterInjectionBoundary', 'Client creation boundary planning requires an adapter injection boundary object.');
    return defaultParsedAdapterInjectionBoundary();
  }

  scanForPrivateDetails(value, '$.adapterInjectionBoundary', blockers);

  if (value.kind !== 'infra-agent.knowledge-team-upload-adapter-injection-boundary') {
    addBlocker(blockers, 'invalid-adapter-injection-boundary-kind', '$.adapterInjectionBoundary.kind', 'Client creation boundary planning requires an upload adapter injection boundary artifact.');
  }
  if (value.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.adapterInjectionBoundary.schemaVersion', 'Client creation boundary planning requires schemaVersion 1.');
  }
  if (value.boundaryKind !== 'adapter-injection-boundary-dry-run') {
    addBlocker(blockers, 'invalid-boundary-kind', '$.adapterInjectionBoundary.boundaryKind', 'Client creation boundary planning requires the adapter injection dry-run boundary kind.');
  }

  checkCommonExecutionDisabledFields(value, '$.adapterInjectionBoundary', blockers);

  const boundaryStatus = readBoundaryStatus(value.status);
  if (boundaryStatus !== 'adapter-injection-boundary-ready') {
    addBlocker(blockers, 'adapter-injection-boundary-not-ready', '$.adapterInjectionBoundary.status', 'Client creation boundary planning requires a ready adapter injection boundary.');
  }

  const readiness = isRecord(value.readiness) ? value.readiness : {};
  if (!isRecord(value.readiness)) {
    addBlocker(blockers, 'missing-required-field', '$.adapterInjectionBoundary.readiness', 'Client creation boundary planning requires adapter injection readiness.');
  }
  const boundaryNextAction = readBoundaryNextAction(readiness.nextAction);
  if (boundaryNextAction !== 'design-client-creation-boundary') {
    addBlocker(blockers, 'adapter-injection-boundary-next-action-invalid', '$.adapterInjectionBoundary.readiness.nextAction', 'Client creation boundary planning requires the adapter injection boundary to advance to client creation design.');
  }
  if (typeof readiness.blockerCount === 'number' && readiness.blockerCount !== 0) {
    addBlocker(blockers, 'adapter-injection-boundary-not-ready', '$.adapterInjectionBoundary.readiness.blockerCount', 'Client creation boundary planning requires zero adapter injection boundary blockers.');
  }

  const parsedTarget = parseTarget(value.target, blockers);
  const sourceArtifactBytesBoundary = isRecord(value.sourceArtifactBytesBoundary) ? value.sourceArtifactBytesBoundary : {};
  const adapterInjectionBoundary = isRecord(value.adapterInjectionBoundary) ? value.adapterInjectionBoundary : {};
  const remainingExecutionBoundaries = isRecord(value.remainingExecutionBoundaries) ? value.remainingExecutionBoundaries : {};

  if (!isRecord(value.sourceArtifactBytesBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.adapterInjectionBoundary.sourceArtifactBytesBoundary', 'Client creation boundary planning requires source artifact bytes boundary summary.');
  }
  if (!isRecord(value.adapterInjectionBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'Client creation boundary planning requires adapter injection boundary details.');
  }
  if (!isRecord(value.remainingExecutionBoundaries)) {
    addBlocker(blockers, 'missing-required-field', '$.adapterInjectionBoundary.remainingExecutionBoundaries', 'Client creation boundary planning requires remaining execution boundary details.');
  }

  const reviewStatus = readReviewStatus(sourceArtifactBytesBoundary.reviewStatus);
  const reviewKind = readReviewKind(sourceArtifactBytesBoundary.reviewKind);
  const scopeMatched = readBool(sourceArtifactBytesBoundary.scopeMatched);
  const humanReviewRecorded = readBool(sourceArtifactBytesBoundary.humanReviewRecorded);
  const fingerprintVerified = readBool(sourceArtifactBytesBoundary.fingerprintVerified);
  const sourceFingerprintVerified = readBool(sourceArtifactBytesBoundary.sourceFingerprintVerified);
  const adapterName = typeof sourceArtifactBytesBoundary.adapterName === 'string'
    && isSafeKnowledgeTeamBackendAdapterName(sourceArtifactBytesBoundary.adapterName)
    ? sourceArtifactBytesBoundary.adapterName
    : null;
  const adapterBackendKind = readAdapterBackendKind(sourceArtifactBytesBoundary.adapterBackendKind);

  if (reviewStatus !== 'review-ready' || reviewKind !== 'human-fingerprint-dry-run' || !humanReviewRecorded || !fingerprintVerified || !sourceFingerprintVerified) {
    addBlocker(blockers, 'review-fingerprint-unverified', '$.adapterInjectionBoundary.sourceArtifactBytesBoundary', 'Client creation boundary planning requires verified prior human review state.');
  }
  if (!scopeMatched) {
    addBlocker(blockers, 'scope-not-matched', '$.adapterInjectionBoundary.sourceArtifactBytesBoundary.scopeMatched', 'Client creation boundary planning requires matched artifact scope.');
  }
  if (adapterName === null && sourceArtifactBytesBoundary.adapterName !== null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.adapterInjectionBoundary.sourceArtifactBytesBoundary.adapterName', 'Client creation boundary planning requires a safe adapter name.');
  }
  if (adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.adapterInjectionBoundary.sourceArtifactBytesBoundary.adapterBackendKind', 'Client creation boundary planning currently accepts only the mock S3-compatible backend boundary.');
  }

  const adapterInjectionRequiredBeforeExecution = checkRequiredTrue(adapterInjectionBoundary, 'adapterInjectionRequiredBeforeExecution', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'adapter-injection-not-required', blockers);
  const adapterInjectionRequiredAfterBytes = checkRequiredTrue(adapterInjectionBoundary, 'adapterInjectionRequiredAfterBytes', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'adapter-injection-not-required', blockers);
  const adapterDependencyInjectionOnly = checkRequiredTrue(adapterInjectionBoundary, 'adapterDependencyInjectionOnly', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'adapter-injection-not-required', blockers);
  const mockAdapterRequired = checkRequiredTrue(adapterInjectionBoundary, 'mockAdapterRequired', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'unsupported-adapter-backend', blockers);
  const adapterDescriptorRequired = checkRequiredTrue(adapterInjectionBoundary, 'adapterDescriptorRequired', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'adapter-injection-not-required', blockers);
  const artifactObjectStoreDependencyRequired = checkRequiredTrue(adapterInjectionBoundary, 'artifactObjectStoreDependencyRequired', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'adapter-injection-not-required', blockers);
  const metadataIndexDependencyRequired = checkRequiredTrue(adapterInjectionBoundary, 'metadataIndexDependencyRequired', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'adapter-injection-not-required', blockers);
  const contentAddressedObjectKeysRequired = checkRequiredTrue(adapterInjectionBoundary, 'contentAddressedObjectKeysRequired', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'adapter-injection-not-required', blockers);
  const contentAddressedIndexKeysRequired = checkRequiredTrue(adapterInjectionBoundary, 'contentAddressedIndexKeysRequired', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'adapter-injection-not-required', blockers);
  const idempotentWritesRequired = checkRequiredTrue(adapterInjectionBoundary, 'idempotentWritesRequired', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'adapter-injection-not-required', blockers);
  const explicitUploadApprovalRequired = checkRequiredTrue(adapterInjectionBoundary, 'explicitUploadApprovalRequired', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'upload-approval-already-provided', blockers);
  const artifactBytesRequiredBeforeAdapter = checkRequiredTrue(adapterInjectionBoundary, 'artifactBytesRequiredBeforeAdapter', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'artifact-bytes-provided', blockers);
  const artifactDigestRequired = checkRequiredTrue(adapterInjectionBoundary, 'artifactDigestRequired', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'artifact-bytes-provided', blockers);
  const artifactScopeBindingRequired = checkRequiredTrue(adapterInjectionBoundary, 'artifactScopeBindingRequired', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'artifact-bytes-provided', blockers);
  const writeTokenRequiredBeforeAdapter = checkRequiredTrue(adapterInjectionBoundary, 'writeTokenRequiredBeforeAdapter', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'write-token-issued', blockers);
  const executionLeaseRequiredBeforeAdapter = checkRequiredTrue(adapterInjectionBoundary, 'executionLeaseRequiredBeforeAdapter', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'execution-lease-created', blockers);
  const rollbackPlanRequiredBeforeAdapter = checkRequiredTrue(adapterInjectionBoundary, 'rollbackPlanRequiredBeforeAdapter', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'rollback-plan-created', blockers);
  const auditRecordRequiredBeforeAdapter = checkRequiredTrue(adapterInjectionBoundary, 'auditRecordRequiredBeforeAdapter', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'audit-record-created', blockers);

  checkRequiredFalse(adapterInjectionBoundary, 'artifactBytesProvided', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'artifact-bytes-provided', blockers);
  checkRequiredFalse(adapterInjectionBoundary, 'artifactDigestVerified', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'artifact-bytes-provided', blockers);
  checkRequiredFalse(adapterInjectionBoundary, 'artifactScopeBoundToArtifact', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'artifact-bytes-provided', blockers);
  checkRequiredFalse(adapterInjectionBoundary, 'writeTokenIssued', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'write-token-issued', blockers);
  checkRequiredFalse(adapterInjectionBoundary, 'executionLeaseCreated', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'execution-lease-created', blockers);
  checkRequiredFalse(adapterInjectionBoundary, 'rollbackPlanCreated', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'rollback-plan-created', blockers);
  checkRequiredFalse(adapterInjectionBoundary, 'auditRecordCreated', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'audit-record-created', blockers);
  checkRequiredFalse(adapterInjectionBoundary, 'adapterInjected', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'adapter-injected', blockers);
  checkRequiredFalse(adapterInjectionBoundary, 'clientCreated', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'client-created', blockers);
  checkRequiredFalse(adapterInjectionBoundary, 'artifactObjectStoreBound', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'artifact-object-store-bound', blockers);
  checkRequiredFalse(adapterInjectionBoundary, 'metadataIndexBound', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'metadata-index-bound', blockers);
  checkRequiredFalse(adapterInjectionBoundary, 'executable', '$.adapterInjectionBoundary.adapterInjectionBoundary', 'executable-state-enabled', blockers);

  checkRequiredTrue(remainingExecutionBoundaries, 'artifactBytesRequired', '$.adapterInjectionBoundary.remainingExecutionBoundaries', 'artifact-bytes-provided', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'adapterInjectionRequired', '$.adapterInjectionBoundary.remainingExecutionBoundaries', 'adapter-injection-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'clientCreationRequired', '$.adapterInjectionBoundary.remainingExecutionBoundaries', 'client-creation-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'writeTokenRequired', '$.adapterInjectionBoundary.remainingExecutionBoundaries', 'write-token-issued', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'executionLeaseRequired', '$.adapterInjectionBoundary.remainingExecutionBoundaries', 'execution-lease-created', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'rollbackPlanRequired', '$.adapterInjectionBoundary.remainingExecutionBoundaries', 'rollback-plan-created', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'auditRecordRequired', '$.adapterInjectionBoundary.remainingExecutionBoundaries', 'audit-record-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'artifactBytesProvided', '$.adapterInjectionBoundary.remainingExecutionBoundaries', 'artifact-bytes-provided', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'adapterInjected', '$.adapterInjectionBoundary.remainingExecutionBoundaries', 'adapter-injected', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'clientCreated', '$.adapterInjectionBoundary.remainingExecutionBoundaries', 'client-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'writeTokenIssued', '$.adapterInjectionBoundary.remainingExecutionBoundaries', 'write-token-issued', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'executionLeaseCreated', '$.adapterInjectionBoundary.remainingExecutionBoundaries', 'execution-lease-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'rollbackPlanCreated', '$.adapterInjectionBoundary.remainingExecutionBoundaries', 'rollback-plan-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'auditRecordCreated', '$.adapterInjectionBoundary.remainingExecutionBoundaries', 'audit-record-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'objectWriteAllowed', '$.adapterInjectionBoundary.remainingExecutionBoundaries', 'object-write-attempted', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'metadataIndexWriteAllowed', '$.adapterInjectionBoundary.remainingExecutionBoundaries', 'metadata-index-write-attempted', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'remoteMutationAllowed', '$.adapterInjectionBoundary.remainingExecutionBoundaries', 'remote-mutation-performed', blockers);

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
    adapterInjectionRequiredBeforeExecution,
    adapterInjectionRequiredAfterBytes,
    adapterDependencyInjectionOnly,
    mockAdapterRequired,
    adapterDescriptorRequired,
    artifactObjectStoreDependencyRequired,
    metadataIndexDependencyRequired,
    contentAddressedObjectKeysRequired,
    contentAddressedIndexKeysRequired,
    idempotentWritesRequired,
    explicitUploadApprovalRequired,
    artifactBytesRequiredBeforeAdapter,
    artifactBytesProvided: readBool(adapterInjectionBoundary.artifactBytesProvided),
    artifactDigestRequired,
    artifactDigestVerified: readBool(adapterInjectionBoundary.artifactDigestVerified),
    artifactScopeBindingRequired,
    artifactScopeBoundToArtifact: readBool(adapterInjectionBoundary.artifactScopeBoundToArtifact),
    writeTokenRequiredBeforeAdapter,
    writeTokenIssued: readBool(adapterInjectionBoundary.writeTokenIssued),
    executionLeaseRequiredBeforeAdapter,
    executionLeaseCreated: readBool(adapterInjectionBoundary.executionLeaseCreated),
    rollbackPlanRequiredBeforeAdapter,
    rollbackPlanCreated: readBool(adapterInjectionBoundary.rollbackPlanCreated),
    auditRecordRequiredBeforeAdapter,
    auditRecordCreated: readBool(adapterInjectionBoundary.auditRecordCreated),
    adapterInjected: readBool(adapterInjectionBoundary.adapterInjected),
    clientCreated: readBool(adapterInjectionBoundary.clientCreated),
    artifactObjectStoreBound: readBool(adapterInjectionBoundary.artifactObjectStoreBound),
    metadataIndexBound: readBool(adapterInjectionBoundary.metadataIndexBound),
    executable: readBool(adapterInjectionBoundary.executable),
    target: parsedTarget
  };
}

export function buildKnowledgeTeamUploadClientCreationBoundary(
  input: KnowledgeTeamUploadClientCreationBoundaryInput
): KnowledgeTeamUploadClientCreationBoundary {
  const blockers: KnowledgeTeamUploadClientCreationBoundaryBlocker[] = [];
  const parsedBoundary = parseAdapterInjectionBoundaryForClientCreationBoundary(input.adapterInjectionBoundary, blockers);
  const status: KnowledgeTeamUploadClientCreationBoundaryStatus = blockers.length === 0
    ? 'client-creation-boundary-ready'
    : 'blocked';

  return {
    kind: 'infra-agent.knowledge-team-upload-client-creation-boundary',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    boundaryKind: 'client-creation-boundary-dry-run',
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
    sourceAdapterInjectionBoundary: {
      source: 'upload-adapter-injection-boundary',
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
      adapterInjectionRequiredBeforeExecution: parsedBoundary.adapterInjectionRequiredBeforeExecution,
      adapterInjectionRequiredAfterBytes: parsedBoundary.adapterInjectionRequiredAfterBytes,
      adapterDependencyInjectionOnly: parsedBoundary.adapterDependencyInjectionOnly,
      mockAdapterRequired: parsedBoundary.mockAdapterRequired,
      adapterDescriptorRequired: parsedBoundary.adapterDescriptorRequired,
      artifactObjectStoreDependencyRequired: parsedBoundary.artifactObjectStoreDependencyRequired,
      metadataIndexDependencyRequired: parsedBoundary.metadataIndexDependencyRequired,
      contentAddressedObjectKeysRequired: parsedBoundary.contentAddressedObjectKeysRequired,
      contentAddressedIndexKeysRequired: parsedBoundary.contentAddressedIndexKeysRequired,
      idempotentWritesRequired: parsedBoundary.idempotentWritesRequired,
      explicitUploadApprovalRequired: parsedBoundary.explicitUploadApprovalRequired,
      artifactBytesRequiredBeforeAdapter: parsedBoundary.artifactBytesRequiredBeforeAdapter,
      artifactBytesProvided: parsedBoundary.artifactBytesProvided,
      artifactDigestRequired: parsedBoundary.artifactDigestRequired,
      artifactDigestVerified: parsedBoundary.artifactDigestVerified,
      artifactScopeBindingRequired: parsedBoundary.artifactScopeBindingRequired,
      artifactScopeBoundToArtifact: parsedBoundary.artifactScopeBoundToArtifact,
      writeTokenRequiredBeforeAdapter: parsedBoundary.writeTokenRequiredBeforeAdapter,
      writeTokenIssued: parsedBoundary.writeTokenIssued,
      executionLeaseRequiredBeforeAdapter: parsedBoundary.executionLeaseRequiredBeforeAdapter,
      executionLeaseCreated: parsedBoundary.executionLeaseCreated,
      rollbackPlanRequiredBeforeAdapter: parsedBoundary.rollbackPlanRequiredBeforeAdapter,
      rollbackPlanCreated: parsedBoundary.rollbackPlanCreated,
      auditRecordRequiredBeforeAdapter: parsedBoundary.auditRecordRequiredBeforeAdapter,
      auditRecordCreated: parsedBoundary.auditRecordCreated,
      adapterInjected: parsedBoundary.adapterInjected,
      clientCreated: parsedBoundary.clientCreated,
      artifactObjectStoreBound: parsedBoundary.artifactObjectStoreBound,
      metadataIndexBound: parsedBoundary.metadataIndexBound,
      executable: parsedBoundary.executable
    },
    clientCreationBoundary: {
      dryRunOnly: true,
      clientCreationRequiredBeforeExecution: true,
      clientCreationRequiredAfterAdapter: true,
      adapterInjectionRequiredBeforeClient: true,
      adapterDependencyInjectionOnly: true,
      mockAdapterRequired: true,
      clientFactoryDescriptorRequired: true,
      credentialReadBoundaryRequired: true,
      credentialPresenceBoundaryRequired: true,
      liveCheckBoundaryRequired: true,
      uploadCommandBoundaryRequired: true,
      artifactObjectStoreDependencyRequired: true,
      metadataIndexDependencyRequired: true,
      contentAddressedObjectKeysRequired: true,
      contentAddressedIndexKeysRequired: true,
      idempotentWritesRequired: true,
      explicitUploadApprovalRequired: true,
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
      nextAction: status === 'client-creation-boundary-ready' ? 'design-credential-read-boundary' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: blockers.map(entry => entry.code),
      blockers,
      reason: status === 'client-creation-boundary-ready'
        ? 'Client creation boundary requirements are modeled, but no SDK client is created, no credentials are read, and upload execution remains disabled until separate credential and mutation boundaries are designed.'
        : 'Client creation boundary planning is blocked until all adapter injection boundary blockers are resolved.'
    }
  };
}
