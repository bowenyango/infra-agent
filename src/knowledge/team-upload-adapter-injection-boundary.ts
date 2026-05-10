import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadAdapterInjectionBoundaryStatus =
  | 'adapter-injection-boundary-ready'
  | 'blocked';

export type KnowledgeTeamUploadAdapterInjectionBoundaryNextAction =
  | 'design-client-creation-boundary'
  | 'resolve-blockers';

export type KnowledgeTeamUploadAdapterInjectionBoundaryBlockerCode =
  | 'adapter-dependency-leak'
  | 'adapter-injected'
  | 'adapter-injection-not-required'
  | 'artifact-bytes-boundary-next-action-invalid'
  | 'artifact-bytes-boundary-not-ready'
  | 'artifact-bytes-digest-already-verified'
  | 'artifact-bytes-not-required'
  | 'artifact-bytes-provided'
  | 'artifact-bytes-scope-already-bound'
  | 'audit-record-created'
  | 'audit-record-not-required'
  | 'backend-detail-leak'
  | 'client-created'
  | 'credential-presence-check-enabled'
  | 'credential-values-exposed'
  | 'execution-lease-created'
  | 'execution-lease-not-required'
  | 'invalid-artifact-bytes-boundary-kind'
  | 'invalid-boundary-kind'
  | 'invalid-schema-version'
  | 'live-check-enabled'
  | 'metadata-index-write-attempted'
  | 'missing-required-field'
  | 'mutation-approval-already-granted'
  | 'mutation-enabled'
  | 'object-write-attempted'
  | 'remote-mutation-performed'
  | 'remote-write-enabled'
  | 'review-fingerprint-unverified'
  | 'rollback-plan-created'
  | 'rollback-plan-not-required'
  | 'scope-not-matched'
  | 'unsupported-adapter-backend'
  | 'unsafe-adapter-name'
  | 'unsafe-artifact-reference'
  | 'upload-approval-already-provided'
  | 'upload-command-present'
  | 'upload-execution-enabled'
  | 'write-token-issued'
  | 'write-token-not-required';

export interface KnowledgeTeamUploadAdapterInjectionBoundaryBlocker {
  code: KnowledgeTeamUploadAdapterInjectionBoundaryBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadAdapterInjectionBoundary {
  kind: 'infra-agent.knowledge-team-upload-adapter-injection-boundary';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  boundaryKind: 'adapter-injection-boundary-dry-run';
  status: KnowledgeTeamUploadAdapterInjectionBoundaryStatus;
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
  sourceArtifactBytesBoundary: {
    source: 'upload-artifact-bytes-boundary';
    boundaryStatus: 'artifact-bytes-boundary-ready' | 'blocked' | 'invalid';
    boundaryKind: 'artifact-bytes-boundary-dry-run' | 'unsupported';
    boundaryNextAction: 'design-adapter-injection-boundary' | 'resolve-blockers' | 'invalid';
    reviewStatus: 'review-ready' | 'blocked' | 'invalid';
    reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
    scopeMatched: boolean;
    humanReviewRecorded: boolean;
    fingerprintVerified: boolean;
    sourceFingerprintVerified: boolean;
    adapterName: string | null;
    adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
    artifactBytesRequiredBeforeAdapter: boolean;
    artifactBytesRequiredBeforeExecution: boolean;
    artifactBytesProvided: boolean;
    artifactDigestRequired: boolean;
    artifactDigestVerified: boolean;
    artifactScopeBindingRequired: boolean;
    artifactScopeBoundToArtifact: boolean;
    auditRecordRequiredBeforeBytes: boolean;
    auditRecordCreated: boolean;
    writeTokenRequiredBeforeBytes: boolean;
    writeTokenIssued: boolean;
    executionLeaseRequiredBeforeBytes: boolean;
    executionLeaseCreated: boolean;
    rollbackPlanRequiredBeforeBytes: boolean;
    rollbackPlanCreated: boolean;
    adapterInjectionRequiredAfterBytes: boolean;
  };
  adapterInjectionBoundary: {
    dryRunOnly: true;
    adapterInjectionRequiredBeforeExecution: true;
    adapterInjectionRequiredAfterBytes: true;
    adapterDependencyInjectionOnly: true;
    mockAdapterRequired: true;
    adapterDescriptorRequired: true;
    artifactObjectStoreDependencyRequired: true;
    metadataIndexDependencyRequired: true;
    contentAddressedObjectKeysRequired: true;
    contentAddressedIndexKeysRequired: true;
    idempotentWritesRequired: true;
    explicitUploadApprovalRequired: true;
    artifactBytesRequiredBeforeAdapter: true;
    artifactBytesProvided: false;
    artifactDigestRequired: true;
    artifactDigestVerified: false;
    artifactScopeBindingRequired: true;
    artifactScopeBoundToArtifact: false;
    writeTokenRequiredBeforeAdapter: true;
    writeTokenIssued: false;
    executionLeaseRequiredBeforeAdapter: true;
    executionLeaseCreated: false;
    rollbackPlanRequiredBeforeAdapter: true;
    rollbackPlanCreated: false;
    auditRecordRequiredBeforeAdapter: true;
    auditRecordCreated: false;
    adapterInjected: false;
    clientCreated: false;
    artifactObjectStoreBound: false;
    metadataIndexBound: false;
    executable: false;
  };
  remainingExecutionBoundaries: {
    artifactBytesRequired: true;
    artifactBytesProvided: false;
    adapterInjectionRequired: true;
    adapterInjected: false;
    clientCreationRequired: true;
    clientCreated: false;
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
    status: KnowledgeTeamUploadAdapterInjectionBoundaryStatus;
    nextAction: KnowledgeTeamUploadAdapterInjectionBoundaryNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadAdapterInjectionBoundaryBlockerCode[];
    blockers: KnowledgeTeamUploadAdapterInjectionBoundaryBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadAdapterInjectionBoundaryInput {
  artifactBytesBoundary: unknown;
}

interface ParsedArtifactBytesBoundaryForAdapterInjectionBoundary {
  boundaryStatus: 'artifact-bytes-boundary-ready' | 'blocked' | 'invalid';
  boundaryKind: 'artifact-bytes-boundary-dry-run' | 'unsupported';
  boundaryNextAction: 'design-adapter-injection-boundary' | 'resolve-blockers' | 'invalid';
  reviewStatus: 'review-ready' | 'blocked' | 'invalid';
  reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
  scopeMatched: boolean;
  humanReviewRecorded: boolean;
  fingerprintVerified: boolean;
  sourceFingerprintVerified: boolean;
  adapterName: string | null;
  adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
  artifactBytesRequiredBeforeAdapter: boolean;
  artifactBytesRequiredBeforeExecution: boolean;
  artifactBytesProvided: boolean;
  artifactDigestRequired: boolean;
  artifactDigestVerified: boolean;
  artifactScopeBindingRequired: boolean;
  artifactScopeBoundToArtifact: boolean;
  auditRecordRequiredBeforeBytes: boolean;
  auditRecordCreated: boolean;
  writeTokenRequiredBeforeBytes: boolean;
  writeTokenIssued: boolean;
  executionLeaseRequiredBeforeBytes: boolean;
  executionLeaseCreated: boolean;
  rollbackPlanRequiredBeforeBytes: boolean;
  rollbackPlanCreated: boolean;
  adapterInjectionRequiredAfterBytes: boolean;
  target: {
    manifestId: string | null;
    objectKey: string | null;
    objectSha256: string | null;
    artifactId: string | null;
  };
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN = /(artifactBytesValue|artifactBytesBase64|artifactBytesContent|artifactBytesPayload|artifactContent|artifactPayload|rawArtifact|byteBuffer|bytesBase64|contentBase64|buffer|stream|arrayBuffer|blob|readPath|filePath|localPath|artifactPath|serializedPayload|stagedBytes)/i;
const FORBIDDEN_ADAPTER_KEY_PATTERN = /(adapterInstance|adapterObject|adapterValue|adapterDescriptorValue|adapterClient|sdkClient|clientConfig|objectStoreHandle|metadataIndexHandle|putObject|putEntry|fetch|signedUrl)/i;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|secret|password|authorization|header|accessKey|sessionToken|tokenValue|tokenMaterial|leaseValue|leaseMaterial|rollbackValue|rollbackMaterial|rollbackCommand|auditValue|auditMaterial|auditCommand)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|secret|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBool(value: unknown): boolean {
  return value === true;
}

function readBoundaryStatus(value: unknown): ParsedArtifactBytesBoundaryForAdapterInjectionBoundary['boundaryStatus'] {
  if (value === 'artifact-bytes-boundary-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readBoundaryKind(value: unknown): ParsedArtifactBytesBoundaryForAdapterInjectionBoundary['boundaryKind'] {
  if (value === 'artifact-bytes-boundary-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readBoundaryNextAction(value: unknown): ParsedArtifactBytesBoundaryForAdapterInjectionBoundary['boundaryNextAction'] {
  if (value === 'design-adapter-injection-boundary' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readReviewStatus(value: unknown): ParsedArtifactBytesBoundaryForAdapterInjectionBoundary['reviewStatus'] {
  if (value === 'review-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readReviewKind(value: unknown): ParsedArtifactBytesBoundaryForAdapterInjectionBoundary['reviewKind'] {
  if (value === 'human-fingerprint-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readAdapterBackendKind(value: unknown): ParsedArtifactBytesBoundaryForAdapterInjectionBoundary['adapterBackendKind'] {
  if (value === 'mock-s3-compatible' || value === 's3-compatible') {
    return value;
  }
  return 'unsupported';
}

function addBlocker(
  blockers: KnowledgeTeamUploadAdapterInjectionBoundaryBlocker[],
  code: KnowledgeTeamUploadAdapterInjectionBoundaryBlockerCode,
  path: string,
  message: string
): void {
  blockers.push({ code, path, message });
}

function scanForPrivateDetails(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadAdapterInjectionBoundaryBlocker[]
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
        'Adapter injection boundary input must not contain backend details, private paths, credentials, commands, token/lease material, adapter instances, clients, or raw artifact content.'
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
        'Adapter injection boundary input must not contain raw bytes, byte buffers, streams, content payloads, or local artifact paths.'
      );
      continue;
    }
    if (FORBIDDEN_ADAPTER_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'adapter-dependency-leak',
        entryPath,
        'Adapter injection boundary input must not contain adapter instances, SDK clients, object store handles, metadata index handles, or write functions.'
      );
      continue;
    }
    if (FORBIDDEN_LEAK_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'backend-detail-leak',
        entryPath,
        'Adapter injection boundary input must not contain backend details, credential fields, commands, token/lease material, or raw artifact content.'
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
  blockers: KnowledgeTeamUploadAdapterInjectionBoundaryBlocker[]
): ParsedArtifactBytesBoundaryForAdapterInjectionBoundary['target'] {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.artifactBytesBoundary.target', 'Adapter injection boundary planning requires a target object.');
    addBlocker(blockers, 'unsafe-artifact-reference', '$.artifactBytesBoundary.target', 'Adapter injection boundary planning requires safe target references.');
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
    addBlocker(blockers, 'unsafe-artifact-reference', '$.artifactBytesBoundary.target', 'Adapter injection boundary planning requires safe manifest, object, hash, and artifact references.');
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
  code: KnowledgeTeamUploadAdapterInjectionBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadAdapterInjectionBoundaryBlocker[]
): void {
  if (value[key] === true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must remain false for adapter injection boundary planning.`);
  }
}

function checkNullCommand(
  value: Record<string, unknown>,
  key: string,
  path: string,
  blockers: KnowledgeTeamUploadAdapterInjectionBoundaryBlocker[]
): void {
  if (value[key] !== null && value[key] !== undefined) {
    addBlocker(blockers, 'upload-command-present', `${path}.${key}`, 'Adapter injection boundary planning must not receive upload commands.');
  }
}

function checkRequiredTrue(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadAdapterInjectionBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadAdapterInjectionBoundaryBlocker[]
): boolean {
  if (value[key] !== true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be true before adapter injection boundary planning can proceed.`);
    return false;
  }
  return true;
}

function checkRequiredFalse(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadAdapterInjectionBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadAdapterInjectionBoundaryBlocker[]
): boolean {
  if (value[key] !== false) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be false for adapter injection boundary planning.`);
    return false;
  }
  return true;
}

function checkCommonExecutionDisabledFields(
  value: Record<string, unknown>,
  path: string,
  blockers: KnowledgeTeamUploadAdapterInjectionBoundaryBlocker[]
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

function defaultParsedArtifactBytesBoundary(): ParsedArtifactBytesBoundaryForAdapterInjectionBoundary {
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
    artifactBytesRequiredBeforeAdapter: false,
    artifactBytesRequiredBeforeExecution: false,
    artifactBytesProvided: false,
    artifactDigestRequired: false,
    artifactDigestVerified: false,
    artifactScopeBindingRequired: false,
    artifactScopeBoundToArtifact: false,
    auditRecordRequiredBeforeBytes: false,
    auditRecordCreated: false,
    writeTokenRequiredBeforeBytes: false,
    writeTokenIssued: false,
    executionLeaseRequiredBeforeBytes: false,
    executionLeaseCreated: false,
    rollbackPlanRequiredBeforeBytes: false,
    rollbackPlanCreated: false,
    adapterInjectionRequiredAfterBytes: false,
    target: {
      manifestId: null,
      objectKey: null,
      objectSha256: null,
      artifactId: null
    }
  };
}

function parseArtifactBytesBoundaryForAdapterInjectionBoundary(
  value: unknown,
  blockers: KnowledgeTeamUploadAdapterInjectionBoundaryBlocker[]
): ParsedArtifactBytesBoundaryForAdapterInjectionBoundary {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.artifactBytesBoundary', 'Adapter injection boundary planning requires an artifact bytes boundary object.');
    return defaultParsedArtifactBytesBoundary();
  }

  scanForPrivateDetails(value, '$.artifactBytesBoundary', blockers);

  if (value.kind !== 'infra-agent.knowledge-team-upload-artifact-bytes-boundary') {
    addBlocker(blockers, 'invalid-artifact-bytes-boundary-kind', '$.artifactBytesBoundary.kind', 'Adapter injection boundary planning requires an upload artifact bytes boundary artifact.');
  }
  if (value.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.artifactBytesBoundary.schemaVersion', 'Adapter injection boundary planning requires schemaVersion 1.');
  }
  if (value.boundaryKind !== 'artifact-bytes-boundary-dry-run') {
    addBlocker(blockers, 'invalid-boundary-kind', '$.artifactBytesBoundary.boundaryKind', 'Adapter injection boundary planning requires the artifact bytes dry-run boundary kind.');
  }

  checkCommonExecutionDisabledFields(value, '$.artifactBytesBoundary', blockers);

  const boundaryStatus = readBoundaryStatus(value.status);
  if (boundaryStatus !== 'artifact-bytes-boundary-ready') {
    addBlocker(blockers, 'artifact-bytes-boundary-not-ready', '$.artifactBytesBoundary.status', 'Adapter injection boundary planning requires a ready artifact bytes boundary.');
  }

  const readiness = isRecord(value.readiness) ? value.readiness : {};
  if (!isRecord(value.readiness)) {
    addBlocker(blockers, 'missing-required-field', '$.artifactBytesBoundary.readiness', 'Adapter injection boundary planning requires artifact bytes readiness.');
  }
  const boundaryNextAction = readBoundaryNextAction(readiness.nextAction);
  if (boundaryNextAction !== 'design-adapter-injection-boundary') {
    addBlocker(blockers, 'artifact-bytes-boundary-next-action-invalid', '$.artifactBytesBoundary.readiness.nextAction', 'Adapter injection boundary planning requires the artifact bytes boundary to advance to adapter injection design.');
  }
  if (typeof readiness.blockerCount === 'number' && readiness.blockerCount !== 0) {
    addBlocker(blockers, 'artifact-bytes-boundary-not-ready', '$.artifactBytesBoundary.readiness.blockerCount', 'Adapter injection boundary planning requires zero artifact bytes boundary blockers.');
  }

  const parsedTarget = parseTarget(value.target, blockers);
  const sourceAuditRecordBoundary = isRecord(value.sourceAuditRecordBoundary) ? value.sourceAuditRecordBoundary : {};
  const artifactBytesBoundary = isRecord(value.artifactBytesBoundary) ? value.artifactBytesBoundary : {};
  const remainingExecutionBoundaries = isRecord(value.remainingExecutionBoundaries) ? value.remainingExecutionBoundaries : {};

  if (!isRecord(value.sourceAuditRecordBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.artifactBytesBoundary.sourceAuditRecordBoundary', 'Adapter injection boundary planning requires source audit record boundary summary.');
  }
  if (!isRecord(value.artifactBytesBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.artifactBytesBoundary.artifactBytesBoundary', 'Adapter injection boundary planning requires artifact bytes boundary details.');
  }
  if (!isRecord(value.remainingExecutionBoundaries)) {
    addBlocker(blockers, 'missing-required-field', '$.artifactBytesBoundary.remainingExecutionBoundaries', 'Adapter injection boundary planning requires remaining execution boundary details.');
  }

  const reviewStatus = readReviewStatus(sourceAuditRecordBoundary.reviewStatus);
  const reviewKind = readReviewKind(sourceAuditRecordBoundary.reviewKind);
  const scopeMatched = readBool(sourceAuditRecordBoundary.scopeMatched);
  const humanReviewRecorded = readBool(sourceAuditRecordBoundary.humanReviewRecorded);
  const fingerprintVerified = readBool(sourceAuditRecordBoundary.fingerprintVerified);
  const sourceFingerprintVerified = readBool(sourceAuditRecordBoundary.sourceFingerprintVerified);
  const adapterName = typeof sourceAuditRecordBoundary.adapterName === 'string'
    && isSafeKnowledgeTeamBackendAdapterName(sourceAuditRecordBoundary.adapterName)
    ? sourceAuditRecordBoundary.adapterName
    : null;
  const adapterBackendKind = readAdapterBackendKind(sourceAuditRecordBoundary.adapterBackendKind);

  if (reviewStatus !== 'review-ready' || reviewKind !== 'human-fingerprint-dry-run' || !humanReviewRecorded || !fingerprintVerified || !sourceFingerprintVerified) {
    addBlocker(blockers, 'review-fingerprint-unverified', '$.artifactBytesBoundary.sourceAuditRecordBoundary', 'Adapter injection boundary planning requires verified prior human review state.');
  }
  if (!scopeMatched) {
    addBlocker(blockers, 'scope-not-matched', '$.artifactBytesBoundary.sourceAuditRecordBoundary.scopeMatched', 'Adapter injection boundary planning requires matched artifact scope.');
  }
  if (adapterName === null && sourceAuditRecordBoundary.adapterName !== null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.artifactBytesBoundary.sourceAuditRecordBoundary.adapterName', 'Adapter injection boundary planning requires a safe adapter name.');
  }
  if (adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.artifactBytesBoundary.sourceAuditRecordBoundary.adapterBackendKind', 'Adapter injection boundary planning currently accepts only the mock S3-compatible backend boundary.');
  }

  const artifactBytesRequiredBeforeAdapter = checkRequiredTrue(artifactBytesBoundary, 'artifactBytesRequiredBeforeAdapter', '$.artifactBytesBoundary.artifactBytesBoundary', 'artifact-bytes-not-required', blockers);
  const artifactBytesRequiredBeforeExecution = checkRequiredTrue(artifactBytesBoundary, 'artifactBytesRequiredBeforeExecution', '$.artifactBytesBoundary.artifactBytesBoundary', 'artifact-bytes-not-required', blockers);
  const artifactDigestRequired = checkRequiredTrue(artifactBytesBoundary, 'artifactDigestRequired', '$.artifactBytesBoundary.artifactBytesBoundary', 'artifact-bytes-not-required', blockers);
  const artifactScopeBindingRequired = checkRequiredTrue(artifactBytesBoundary, 'artifactScopeBindingRequired', '$.artifactBytesBoundary.artifactBytesBoundary', 'artifact-bytes-not-required', blockers);
  const auditRecordRequiredBeforeBytes = checkRequiredTrue(artifactBytesBoundary, 'auditRecordRequiredBeforeBytes', '$.artifactBytesBoundary.artifactBytesBoundary', 'audit-record-not-required', blockers);
  const writeTokenRequiredBeforeBytes = checkRequiredTrue(artifactBytesBoundary, 'writeTokenRequiredBeforeBytes', '$.artifactBytesBoundary.artifactBytesBoundary', 'write-token-not-required', blockers);
  const executionLeaseRequiredBeforeBytes = checkRequiredTrue(artifactBytesBoundary, 'executionLeaseRequiredBeforeBytes', '$.artifactBytesBoundary.artifactBytesBoundary', 'execution-lease-not-required', blockers);
  const rollbackPlanRequiredBeforeBytes = checkRequiredTrue(artifactBytesBoundary, 'rollbackPlanRequiredBeforeBytes', '$.artifactBytesBoundary.artifactBytesBoundary', 'rollback-plan-not-required', blockers);
  const adapterInjectionRequiredAfterBytes = checkRequiredTrue(artifactBytesBoundary, 'adapterInjectionRequiredAfterBytes', '$.artifactBytesBoundary.artifactBytesBoundary', 'adapter-injection-not-required', blockers);

  checkRequiredFalse(artifactBytesBoundary, 'artifactBytesProvided', '$.artifactBytesBoundary.artifactBytesBoundary', 'artifact-bytes-provided', blockers);
  checkRequiredFalse(artifactBytesBoundary, 'artifactDigestVerified', '$.artifactBytesBoundary.artifactBytesBoundary', 'artifact-bytes-digest-already-verified', blockers);
  checkRequiredFalse(artifactBytesBoundary, 'artifactScopeBoundToArtifact', '$.artifactBytesBoundary.artifactBytesBoundary', 'artifact-bytes-scope-already-bound', blockers);
  checkRequiredFalse(artifactBytesBoundary, 'auditRecordCreated', '$.artifactBytesBoundary.artifactBytesBoundary', 'audit-record-created', blockers);
  checkRequiredFalse(artifactBytesBoundary, 'writeTokenIssued', '$.artifactBytesBoundary.artifactBytesBoundary', 'write-token-issued', blockers);
  checkRequiredFalse(artifactBytesBoundary, 'executionLeaseCreated', '$.artifactBytesBoundary.artifactBytesBoundary', 'execution-lease-created', blockers);
  checkRequiredFalse(artifactBytesBoundary, 'rollbackPlanCreated', '$.artifactBytesBoundary.artifactBytesBoundary', 'rollback-plan-created', blockers);
  checkRequiredFalse(artifactBytesBoundary, 'adapterInjected', '$.artifactBytesBoundary.artifactBytesBoundary', 'adapter-injected', blockers);
  checkRequiredFalse(artifactBytesBoundary, 'executable', '$.artifactBytesBoundary.artifactBytesBoundary', 'upload-execution-enabled', blockers);

  checkRequiredTrue(remainingExecutionBoundaries, 'artifactBytesRequired', '$.artifactBytesBoundary.remainingExecutionBoundaries', 'artifact-bytes-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'adapterInjectionRequired', '$.artifactBytesBoundary.remainingExecutionBoundaries', 'adapter-injection-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'writeTokenRequired', '$.artifactBytesBoundary.remainingExecutionBoundaries', 'write-token-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'executionLeaseRequired', '$.artifactBytesBoundary.remainingExecutionBoundaries', 'execution-lease-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'rollbackPlanRequired', '$.artifactBytesBoundary.remainingExecutionBoundaries', 'rollback-plan-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'auditRecordRequired', '$.artifactBytesBoundary.remainingExecutionBoundaries', 'audit-record-not-required', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'artifactBytesProvided', '$.artifactBytesBoundary.remainingExecutionBoundaries', 'artifact-bytes-provided', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'adapterInjected', '$.artifactBytesBoundary.remainingExecutionBoundaries', 'adapter-injected', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'writeTokenIssued', '$.artifactBytesBoundary.remainingExecutionBoundaries', 'write-token-issued', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'executionLeaseCreated', '$.artifactBytesBoundary.remainingExecutionBoundaries', 'execution-lease-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'rollbackPlanCreated', '$.artifactBytesBoundary.remainingExecutionBoundaries', 'rollback-plan-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'auditRecordCreated', '$.artifactBytesBoundary.remainingExecutionBoundaries', 'audit-record-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'objectWriteAllowed', '$.artifactBytesBoundary.remainingExecutionBoundaries', 'object-write-attempted', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'metadataIndexWriteAllowed', '$.artifactBytesBoundary.remainingExecutionBoundaries', 'metadata-index-write-attempted', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'remoteMutationAllowed', '$.artifactBytesBoundary.remainingExecutionBoundaries', 'remote-mutation-performed', blockers);

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
    artifactBytesRequiredBeforeAdapter,
    artifactBytesRequiredBeforeExecution,
    artifactBytesProvided: readBool(artifactBytesBoundary.artifactBytesProvided),
    artifactDigestRequired,
    artifactDigestVerified: readBool(artifactBytesBoundary.artifactDigestVerified),
    artifactScopeBindingRequired,
    artifactScopeBoundToArtifact: readBool(artifactBytesBoundary.artifactScopeBoundToArtifact),
    auditRecordRequiredBeforeBytes,
    auditRecordCreated: readBool(artifactBytesBoundary.auditRecordCreated),
    writeTokenRequiredBeforeBytes,
    writeTokenIssued: readBool(artifactBytesBoundary.writeTokenIssued),
    executionLeaseRequiredBeforeBytes,
    executionLeaseCreated: readBool(artifactBytesBoundary.executionLeaseCreated),
    rollbackPlanRequiredBeforeBytes,
    rollbackPlanCreated: readBool(artifactBytesBoundary.rollbackPlanCreated),
    adapterInjectionRequiredAfterBytes,
    target: parsedTarget
  };
}

export function buildKnowledgeTeamUploadAdapterInjectionBoundary(
  input: KnowledgeTeamUploadAdapterInjectionBoundaryInput
): KnowledgeTeamUploadAdapterInjectionBoundary {
  const blockers: KnowledgeTeamUploadAdapterInjectionBoundaryBlocker[] = [];
  const parsedBoundary = parseArtifactBytesBoundaryForAdapterInjectionBoundary(input.artifactBytesBoundary, blockers);
  const status: KnowledgeTeamUploadAdapterInjectionBoundaryStatus = blockers.length === 0
    ? 'adapter-injection-boundary-ready'
    : 'blocked';

  return {
    kind: 'infra-agent.knowledge-team-upload-adapter-injection-boundary',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    boundaryKind: 'adapter-injection-boundary-dry-run',
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
    sourceArtifactBytesBoundary: {
      source: 'upload-artifact-bytes-boundary',
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
      artifactBytesRequiredBeforeAdapter: parsedBoundary.artifactBytesRequiredBeforeAdapter,
      artifactBytesRequiredBeforeExecution: parsedBoundary.artifactBytesRequiredBeforeExecution,
      artifactBytesProvided: parsedBoundary.artifactBytesProvided,
      artifactDigestRequired: parsedBoundary.artifactDigestRequired,
      artifactDigestVerified: parsedBoundary.artifactDigestVerified,
      artifactScopeBindingRequired: parsedBoundary.artifactScopeBindingRequired,
      artifactScopeBoundToArtifact: parsedBoundary.artifactScopeBoundToArtifact,
      auditRecordRequiredBeforeBytes: parsedBoundary.auditRecordRequiredBeforeBytes,
      auditRecordCreated: parsedBoundary.auditRecordCreated,
      writeTokenRequiredBeforeBytes: parsedBoundary.writeTokenRequiredBeforeBytes,
      writeTokenIssued: parsedBoundary.writeTokenIssued,
      executionLeaseRequiredBeforeBytes: parsedBoundary.executionLeaseRequiredBeforeBytes,
      executionLeaseCreated: parsedBoundary.executionLeaseCreated,
      rollbackPlanRequiredBeforeBytes: parsedBoundary.rollbackPlanRequiredBeforeBytes,
      rollbackPlanCreated: parsedBoundary.rollbackPlanCreated,
      adapterInjectionRequiredAfterBytes: parsedBoundary.adapterInjectionRequiredAfterBytes
    },
    adapterInjectionBoundary: {
      dryRunOnly: true,
      adapterInjectionRequiredBeforeExecution: true,
      adapterInjectionRequiredAfterBytes: true,
      adapterDependencyInjectionOnly: true,
      mockAdapterRequired: true,
      adapterDescriptorRequired: true,
      artifactObjectStoreDependencyRequired: true,
      metadataIndexDependencyRequired: true,
      contentAddressedObjectKeysRequired: true,
      contentAddressedIndexKeysRequired: true,
      idempotentWritesRequired: true,
      explicitUploadApprovalRequired: true,
      artifactBytesRequiredBeforeAdapter: true,
      artifactBytesProvided: false,
      artifactDigestRequired: true,
      artifactDigestVerified: false,
      artifactScopeBindingRequired: true,
      artifactScopeBoundToArtifact: false,
      writeTokenRequiredBeforeAdapter: true,
      writeTokenIssued: false,
      executionLeaseRequiredBeforeAdapter: true,
      executionLeaseCreated: false,
      rollbackPlanRequiredBeforeAdapter: true,
      rollbackPlanCreated: false,
      auditRecordRequiredBeforeAdapter: true,
      auditRecordCreated: false,
      adapterInjected: false,
      clientCreated: false,
      artifactObjectStoreBound: false,
      metadataIndexBound: false,
      executable: false
    },
    remainingExecutionBoundaries: {
      artifactBytesRequired: true,
      artifactBytesProvided: false,
      adapterInjectionRequired: true,
      adapterInjected: false,
      clientCreationRequired: true,
      clientCreated: false,
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
      nextAction: status === 'adapter-injection-boundary-ready' ? 'design-client-creation-boundary' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: blockers.map(entry => entry.code),
      blockers,
      reason: status === 'adapter-injection-boundary-ready'
        ? 'Adapter injection boundary requirements are modeled, but no adapter is injected, no client is created, and upload execution remains disabled until separate client and mutation boundaries are designed.'
        : 'Adapter injection boundary planning is blocked until all artifact bytes boundary blockers are resolved.'
    }
  };
}
