import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadArtifactBytesBoundaryStatus =
  | 'artifact-bytes-boundary-ready'
  | 'blocked';

export type KnowledgeTeamUploadArtifactBytesBoundaryNextAction =
  | 'design-adapter-injection-boundary'
  | 'resolve-blockers';

export type KnowledgeTeamUploadArtifactBytesBoundaryBlockerCode =
  | 'adapter-injected'
  | 'artifact-bytes-digest-already-verified'
  | 'artifact-bytes-leak'
  | 'artifact-bytes-not-required'
  | 'artifact-bytes-provided'
  | 'artifact-bytes-scope-already-bound'
  | 'audit-binding-created'
  | 'audit-boundary-next-action-invalid'
  | 'audit-boundary-not-ready'
  | 'audit-record-created'
  | 'audit-record-not-required'
  | 'audit-review-already-recorded'
  | 'audit-scope-already-bound'
  | 'backend-detail-leak'
  | 'client-created'
  | 'credential-presence-check-enabled'
  | 'credential-values-exposed'
  | 'execution-lease-created'
  | 'execution-lease-not-required'
  | 'invalid-audit-record-boundary-kind'
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

export interface KnowledgeTeamUploadArtifactBytesBoundaryBlocker {
  code: KnowledgeTeamUploadArtifactBytesBoundaryBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadArtifactBytesBoundary {
  kind: 'infra-agent.knowledge-team-upload-artifact-bytes-boundary';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  boundaryKind: 'artifact-bytes-boundary-dry-run';
  status: KnowledgeTeamUploadArtifactBytesBoundaryStatus;
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
  sourceAuditRecordBoundary: {
    source: 'upload-audit-record-boundary';
    boundaryStatus: 'audit-record-boundary-ready' | 'blocked' | 'invalid';
    boundaryKind: 'audit-record-boundary-dry-run' | 'unsupported';
    boundaryNextAction: 'design-artifact-bytes-boundary' | 'resolve-blockers' | 'invalid';
    reviewStatus: 'review-ready' | 'blocked' | 'invalid';
    reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
    scopeMatched: boolean;
    humanReviewRecorded: boolean;
    fingerprintVerified: boolean;
    sourceFingerprintVerified: boolean;
    adapterName: string | null;
    adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
    tokenRequiredBeforeExecution: boolean;
    tokenScopeBindingRequired: boolean;
    tokenSingleUseRequired: boolean;
    tokenExpiryRequired: boolean;
    executionLeaseRequiredBeforeExecution: boolean;
    leaseScopeBindingRequired: boolean;
    leaseSingleUseRequired: boolean;
    leaseExpiryRequired: boolean;
    writeTokenRequiredBeforeLease: boolean;
    auditBindingRequired: boolean;
    rollbackPlanRequiredBeforeExecution: boolean;
    rollbackScopeBindingRequired: boolean;
    rollbackReviewRequired: boolean;
    auditRecordRequiredBeforeExecution: boolean;
    auditScopeBindingRequired: boolean;
    auditReviewRequired: boolean;
    artifactBytesRequiredBeforeAudit: boolean;
  };
  artifactBytesBoundary: {
    dryRunOnly: true;
    artifactBytesRequiredBeforeAdapter: true;
    artifactBytesRequiredBeforeExecution: true;
    artifactBytesProvided: false;
    artifactDigestRequired: true;
    artifactDigestVerified: false;
    artifactScopeBindingRequired: true;
    artifactScopeBoundToArtifact: false;
    auditRecordRequiredBeforeBytes: true;
    auditRecordCreated: false;
    auditScopeBindingRequired: true;
    auditScopeBoundToArtifact: false;
    writeTokenRequiredBeforeBytes: true;
    writeTokenIssued: false;
    executionLeaseRequiredBeforeBytes: true;
    executionLeaseCreated: false;
    rollbackPlanRequiredBeforeBytes: true;
    rollbackPlanCreated: false;
    adapterInjectionRequiredAfterBytes: true;
    adapterInjected: false;
    executable: false;
  };
  remainingExecutionBoundaries: {
    artifactBytesRequired: true;
    artifactBytesProvided: false;
    adapterInjectionRequired: true;
    adapterInjected: false;
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
    status: KnowledgeTeamUploadArtifactBytesBoundaryStatus;
    nextAction: KnowledgeTeamUploadArtifactBytesBoundaryNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadArtifactBytesBoundaryBlockerCode[];
    blockers: KnowledgeTeamUploadArtifactBytesBoundaryBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadArtifactBytesBoundaryInput {
  auditRecordBoundary: unknown;
}

interface ParsedAuditRecordBoundaryForArtifactBytesBoundary {
  boundaryStatus: 'audit-record-boundary-ready' | 'blocked' | 'invalid';
  boundaryKind: 'audit-record-boundary-dry-run' | 'unsupported';
  boundaryNextAction: 'design-artifact-bytes-boundary' | 'resolve-blockers' | 'invalid';
  reviewStatus: 'review-ready' | 'blocked' | 'invalid';
  reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
  scopeMatched: boolean;
  humanReviewRecorded: boolean;
  fingerprintVerified: boolean;
  sourceFingerprintVerified: boolean;
  adapterName: string | null;
  adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
  tokenRequiredBeforeExecution: boolean;
  tokenScopeBindingRequired: boolean;
  tokenSingleUseRequired: boolean;
  tokenExpiryRequired: boolean;
  executionLeaseRequiredBeforeExecution: boolean;
  leaseScopeBindingRequired: boolean;
  leaseSingleUseRequired: boolean;
  leaseExpiryRequired: boolean;
  writeTokenRequiredBeforeLease: boolean;
  auditBindingRequired: boolean;
  rollbackPlanRequiredBeforeExecution: boolean;
  rollbackScopeBindingRequired: boolean;
  rollbackReviewRequired: boolean;
  auditRecordRequiredBeforeExecution: boolean;
  auditScopeBindingRequired: boolean;
  auditReviewRequired: boolean;
  artifactBytesRequiredBeforeAudit: boolean;
  target: {
    manifestId: string | null;
    objectKey: string | null;
    objectSha256: string | null;
    artifactId: string | null;
  };
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN = /(artifactBytesValue|artifactBytesBase64|artifactBytesContent|artifactBytesPayload|artifactContent|artifactPayload|rawArtifact|byteBuffer|bytesBase64|contentBase64|buffer|stream|arrayBuffer|blob|readPath|filePath|localPath|artifactPath|serializedPayload|stagedBytes)/i;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|secret|password|authorization|header|accessKey|sessionToken|clientConfig|sdkClient|signedUrl|putObject|putEntry|fetch|artifactStore|tokenValue|tokenMaterial|leaseValue|leaseMaterial|rollbackValue|rollbackMaterial|rollbackCommand|auditValue|auditMaterial|auditCommand)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|secret|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBool(value: unknown): boolean {
  return value === true;
}

function readBoundaryStatus(value: unknown): ParsedAuditRecordBoundaryForArtifactBytesBoundary['boundaryStatus'] {
  if (value === 'audit-record-boundary-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readBoundaryKind(value: unknown): ParsedAuditRecordBoundaryForArtifactBytesBoundary['boundaryKind'] {
  if (value === 'audit-record-boundary-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readBoundaryNextAction(value: unknown): ParsedAuditRecordBoundaryForArtifactBytesBoundary['boundaryNextAction'] {
  if (value === 'design-artifact-bytes-boundary' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readReviewStatus(value: unknown): ParsedAuditRecordBoundaryForArtifactBytesBoundary['reviewStatus'] {
  if (value === 'review-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readReviewKind(value: unknown): ParsedAuditRecordBoundaryForArtifactBytesBoundary['reviewKind'] {
  if (value === 'human-fingerprint-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readAdapterBackendKind(value: unknown): ParsedAuditRecordBoundaryForArtifactBytesBoundary['adapterBackendKind'] {
  if (value === 'mock-s3-compatible' || value === 's3-compatible') {
    return value;
  }
  return 'unsupported';
}

function addBlocker(
  blockers: KnowledgeTeamUploadArtifactBytesBoundaryBlocker[],
  code: KnowledgeTeamUploadArtifactBytesBoundaryBlockerCode,
  path: string,
  message: string
): void {
  blockers.push({ code, path, message });
}

function scanForPrivateDetails(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadArtifactBytesBoundaryBlocker[]
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
        'Artifact bytes boundary input must not contain backend details, private paths, credentials, commands, token/lease material, or raw artifact content.'
      );
    }
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    if (FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'artifact-bytes-leak',
        entryPath,
        'Artifact bytes boundary input must not contain raw bytes, byte buffers, streams, content payloads, or local artifact paths.'
      );
      continue;
    }
    if (FORBIDDEN_LEAK_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'backend-detail-leak',
        entryPath,
        'Artifact bytes boundary input must not contain backend details, credential fields, SDK/client fields, commands, token/lease material, or raw artifact content.'
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
  blockers: KnowledgeTeamUploadArtifactBytesBoundaryBlocker[]
): ParsedAuditRecordBoundaryForArtifactBytesBoundary['target'] {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.auditRecordBoundary.target', 'Artifact bytes boundary planning requires a target object.');
    addBlocker(blockers, 'unsafe-artifact-reference', '$.auditRecordBoundary.target', 'Artifact bytes boundary planning requires safe target references.');
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
    addBlocker(blockers, 'unsafe-artifact-reference', '$.auditRecordBoundary.target', 'Artifact bytes boundary planning requires safe manifest, object, hash, and artifact references.');
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
  code: KnowledgeTeamUploadArtifactBytesBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadArtifactBytesBoundaryBlocker[]
): void {
  if (value[key] === true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must remain false for artifact bytes boundary planning.`);
  }
}

function checkNullCommand(
  value: Record<string, unknown>,
  key: string,
  path: string,
  blockers: KnowledgeTeamUploadArtifactBytesBoundaryBlocker[]
): void {
  if (value[key] !== null && value[key] !== undefined) {
    addBlocker(blockers, 'upload-command-present', `${path}.${key}`, 'Artifact bytes boundary planning must not receive upload commands.');
  }
}

function checkRequiredTrue(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadArtifactBytesBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadArtifactBytesBoundaryBlocker[]
): boolean {
  if (value[key] !== true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be true before artifact bytes boundary planning can proceed.`);
    return false;
  }
  return true;
}

function checkRequiredFalse(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadArtifactBytesBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadArtifactBytesBoundaryBlocker[]
): boolean {
  if (value[key] !== false) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be false for artifact bytes boundary planning.`);
    return false;
  }
  return true;
}

function checkCommonExecutionDisabledFields(
  value: Record<string, unknown>,
  path: string,
  blockers: KnowledgeTeamUploadArtifactBytesBoundaryBlocker[]
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

function defaultParsedAuditRecordBoundary(): ParsedAuditRecordBoundaryForArtifactBytesBoundary {
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
    tokenRequiredBeforeExecution: false,
    tokenScopeBindingRequired: false,
    tokenSingleUseRequired: false,
    tokenExpiryRequired: false,
    executionLeaseRequiredBeforeExecution: false,
    leaseScopeBindingRequired: false,
    leaseSingleUseRequired: false,
    leaseExpiryRequired: false,
    writeTokenRequiredBeforeLease: false,
    auditBindingRequired: false,
    rollbackPlanRequiredBeforeExecution: false,
    rollbackScopeBindingRequired: false,
    rollbackReviewRequired: false,
    auditRecordRequiredBeforeExecution: false,
    auditScopeBindingRequired: false,
    auditReviewRequired: false,
    artifactBytesRequiredBeforeAudit: false,
    target: {
      manifestId: null,
      objectKey: null,
      objectSha256: null,
      artifactId: null
    }
  };
}

function parseAuditRecordBoundaryForArtifactBytesBoundary(
  value: unknown,
  blockers: KnowledgeTeamUploadArtifactBytesBoundaryBlocker[]
): ParsedAuditRecordBoundaryForArtifactBytesBoundary {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.auditRecordBoundary', 'Artifact bytes boundary planning requires an audit record boundary object.');
    return defaultParsedAuditRecordBoundary();
  }

  scanForPrivateDetails(value, '$.auditRecordBoundary', blockers);

  if (value.kind !== 'infra-agent.knowledge-team-upload-audit-record-boundary') {
    addBlocker(blockers, 'invalid-audit-record-boundary-kind', '$.auditRecordBoundary.kind', 'Artifact bytes boundary planning requires an upload audit record boundary artifact.');
  }
  if (value.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.auditRecordBoundary.schemaVersion', 'Artifact bytes boundary planning requires schemaVersion 1.');
  }
  if (value.boundaryKind !== 'audit-record-boundary-dry-run') {
    addBlocker(blockers, 'invalid-boundary-kind', '$.auditRecordBoundary.boundaryKind', 'Artifact bytes boundary planning requires the audit record dry-run boundary kind.');
  }

  checkCommonExecutionDisabledFields(value, '$.auditRecordBoundary', blockers);

  const boundaryStatus = readBoundaryStatus(value.status);
  if (boundaryStatus !== 'audit-record-boundary-ready') {
    addBlocker(blockers, 'audit-boundary-not-ready', '$.auditRecordBoundary.status', 'Artifact bytes boundary planning requires a ready audit record boundary.');
  }

  const readiness = isRecord(value.readiness) ? value.readiness : {};
  if (!isRecord(value.readiness)) {
    addBlocker(blockers, 'missing-required-field', '$.auditRecordBoundary.readiness', 'Artifact bytes boundary planning requires audit record readiness.');
  }
  const boundaryNextAction = readBoundaryNextAction(readiness.nextAction);
  if (boundaryNextAction !== 'design-artifact-bytes-boundary') {
    addBlocker(blockers, 'audit-boundary-next-action-invalid', '$.auditRecordBoundary.readiness.nextAction', 'Artifact bytes boundary planning requires the audit record boundary to advance to artifact bytes design.');
  }
  if (typeof readiness.blockerCount === 'number' && readiness.blockerCount !== 0) {
    addBlocker(blockers, 'audit-boundary-not-ready', '$.auditRecordBoundary.readiness.blockerCount', 'Artifact bytes boundary planning requires zero audit record boundary blockers.');
  }

  const parsedTarget = parseTarget(value.target, blockers);
  const sourceRollbackPlanBoundary = isRecord(value.sourceRollbackPlanBoundary) ? value.sourceRollbackPlanBoundary : {};
  const auditRecordBoundary = isRecord(value.auditRecordBoundary) ? value.auditRecordBoundary : {};
  const remainingExecutionBoundaries = isRecord(value.remainingExecutionBoundaries) ? value.remainingExecutionBoundaries : {};

  if (!isRecord(value.sourceRollbackPlanBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.auditRecordBoundary.sourceRollbackPlanBoundary', 'Artifact bytes boundary planning requires source rollback plan boundary summary.');
  }
  if (!isRecord(value.auditRecordBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.auditRecordBoundary.auditRecordBoundary', 'Artifact bytes boundary planning requires audit record boundary details.');
  }
  if (!isRecord(value.remainingExecutionBoundaries)) {
    addBlocker(blockers, 'missing-required-field', '$.auditRecordBoundary.remainingExecutionBoundaries', 'Artifact bytes boundary planning requires remaining execution boundary details.');
  }

  const reviewStatus = readReviewStatus(sourceRollbackPlanBoundary.reviewStatus);
  const reviewKind = readReviewKind(sourceRollbackPlanBoundary.reviewKind);
  const scopeMatched = readBool(sourceRollbackPlanBoundary.scopeMatched);
  const humanReviewRecorded = readBool(sourceRollbackPlanBoundary.humanReviewRecorded);
  const fingerprintVerified = readBool(sourceRollbackPlanBoundary.fingerprintVerified);
  const sourceFingerprintVerified = readBool(sourceRollbackPlanBoundary.sourceFingerprintVerified);
  const adapterName = typeof sourceRollbackPlanBoundary.adapterName === 'string'
    && isSafeKnowledgeTeamBackendAdapterName(sourceRollbackPlanBoundary.adapterName)
    ? sourceRollbackPlanBoundary.adapterName
    : null;
  const adapterBackendKind = readAdapterBackendKind(sourceRollbackPlanBoundary.adapterBackendKind);

  if (reviewStatus !== 'review-ready' || reviewKind !== 'human-fingerprint-dry-run' || !humanReviewRecorded || !fingerprintVerified || !sourceFingerprintVerified) {
    addBlocker(blockers, 'review-fingerprint-unverified', '$.auditRecordBoundary.sourceRollbackPlanBoundary', 'Artifact bytes boundary planning requires verified prior human review state.');
  }
  if (!scopeMatched) {
    addBlocker(blockers, 'scope-not-matched', '$.auditRecordBoundary.sourceRollbackPlanBoundary.scopeMatched', 'Artifact bytes boundary planning requires matched artifact scope.');
  }
  if (adapterName === null && sourceRollbackPlanBoundary.adapterName !== null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.auditRecordBoundary.sourceRollbackPlanBoundary.adapterName', 'Artifact bytes boundary planning requires a safe adapter name.');
  }
  if (adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.auditRecordBoundary.sourceRollbackPlanBoundary.adapterBackendKind', 'Artifact bytes boundary planning currently accepts only the mock S3-compatible backend boundary.');
  }

  const tokenRequiredBeforeExecution = checkRequiredTrue(sourceRollbackPlanBoundary, 'tokenRequiredBeforeExecution', '$.auditRecordBoundary.sourceRollbackPlanBoundary', 'write-token-not-required', blockers);
  const tokenScopeBindingRequired = checkRequiredTrue(sourceRollbackPlanBoundary, 'tokenScopeBindingRequired', '$.auditRecordBoundary.sourceRollbackPlanBoundary', 'write-token-not-required', blockers);
  const tokenSingleUseRequired = checkRequiredTrue(sourceRollbackPlanBoundary, 'tokenSingleUseRequired', '$.auditRecordBoundary.sourceRollbackPlanBoundary', 'write-token-not-required', blockers);
  const tokenExpiryRequired = checkRequiredTrue(sourceRollbackPlanBoundary, 'tokenExpiryRequired', '$.auditRecordBoundary.sourceRollbackPlanBoundary', 'write-token-not-required', blockers);
  const executionLeaseRequiredBeforeExecution = checkRequiredTrue(sourceRollbackPlanBoundary, 'executionLeaseRequiredBeforeExecution', '$.auditRecordBoundary.sourceRollbackPlanBoundary', 'execution-lease-not-required', blockers);
  const leaseScopeBindingRequired = checkRequiredTrue(sourceRollbackPlanBoundary, 'leaseScopeBindingRequired', '$.auditRecordBoundary.sourceRollbackPlanBoundary', 'execution-lease-not-required', blockers);
  const leaseSingleUseRequired = checkRequiredTrue(sourceRollbackPlanBoundary, 'leaseSingleUseRequired', '$.auditRecordBoundary.sourceRollbackPlanBoundary', 'execution-lease-not-required', blockers);
  const leaseExpiryRequired = checkRequiredTrue(sourceRollbackPlanBoundary, 'leaseExpiryRequired', '$.auditRecordBoundary.sourceRollbackPlanBoundary', 'execution-lease-not-required', blockers);
  const writeTokenRequiredBeforeLease = checkRequiredTrue(sourceRollbackPlanBoundary, 'writeTokenRequiredBeforeLease', '$.auditRecordBoundary.sourceRollbackPlanBoundary', 'write-token-not-required', blockers);
  const auditBindingRequired = checkRequiredTrue(sourceRollbackPlanBoundary, 'auditBindingRequired', '$.auditRecordBoundary.sourceRollbackPlanBoundary', 'write-token-not-required', blockers);
  const rollbackPlanRequiredBeforeExecution = checkRequiredTrue(sourceRollbackPlanBoundary, 'rollbackPlanRequiredBeforeExecution', '$.auditRecordBoundary.sourceRollbackPlanBoundary', 'rollback-plan-not-required', blockers);
  const rollbackScopeBindingRequired = checkRequiredTrue(sourceRollbackPlanBoundary, 'rollbackScopeBindingRequired', '$.auditRecordBoundary.sourceRollbackPlanBoundary', 'rollback-plan-not-required', blockers);
  const rollbackReviewRequired = checkRequiredTrue(sourceRollbackPlanBoundary, 'rollbackReviewRequired', '$.auditRecordBoundary.sourceRollbackPlanBoundary', 'rollback-plan-not-required', blockers);
  const auditRecordRequiredBeforeExecution = checkRequiredTrue(sourceRollbackPlanBoundary, 'auditRecordRequiredBeforeExecution', '$.auditRecordBoundary.sourceRollbackPlanBoundary', 'audit-record-not-required', blockers);

  const auditScopeBindingRequired = checkRequiredTrue(auditRecordBoundary, 'auditScopeBindingRequired', '$.auditRecordBoundary.auditRecordBoundary', 'audit-record-not-required', blockers);
  const auditReviewRequired = checkRequiredTrue(auditRecordBoundary, 'auditReviewRequired', '$.auditRecordBoundary.auditRecordBoundary', 'audit-record-not-required', blockers);
  const artifactBytesRequiredBeforeAudit = checkRequiredTrue(auditRecordBoundary, 'artifactBytesRequiredBeforeAudit', '$.auditRecordBoundary.auditRecordBoundary', 'artifact-bytes-not-required', blockers);

  checkRequiredTrue(auditRecordBoundary, 'auditRecordRequiredBeforeExecution', '$.auditRecordBoundary.auditRecordBoundary', 'audit-record-not-required', blockers);
  checkRequiredTrue(auditRecordBoundary, 'writeTokenRequiredBeforeAudit', '$.auditRecordBoundary.auditRecordBoundary', 'write-token-not-required', blockers);
  checkRequiredTrue(auditRecordBoundary, 'executionLeaseRequiredBeforeAudit', '$.auditRecordBoundary.auditRecordBoundary', 'execution-lease-not-required', blockers);
  checkRequiredTrue(auditRecordBoundary, 'rollbackPlanRequiredBeforeAudit', '$.auditRecordBoundary.auditRecordBoundary', 'rollback-plan-not-required', blockers);
  checkRequiredTrue(auditRecordBoundary, 'auditBindingRequired', '$.auditRecordBoundary.auditRecordBoundary', 'audit-record-not-required', blockers);
  checkRequiredFalse(auditRecordBoundary, 'auditRecordCreated', '$.auditRecordBoundary.auditRecordBoundary', 'audit-record-created', blockers);
  checkRequiredFalse(auditRecordBoundary, 'auditScopeBoundToArtifact', '$.auditRecordBoundary.auditRecordBoundary', 'audit-scope-already-bound', blockers);
  checkRequiredFalse(auditRecordBoundary, 'auditReviewed', '$.auditRecordBoundary.auditRecordBoundary', 'audit-review-already-recorded', blockers);
  checkRequiredFalse(auditRecordBoundary, 'writeTokenIssued', '$.auditRecordBoundary.auditRecordBoundary', 'write-token-issued', blockers);
  checkRequiredFalse(auditRecordBoundary, 'executionLeaseCreated', '$.auditRecordBoundary.auditRecordBoundary', 'execution-lease-created', blockers);
  checkRequiredFalse(auditRecordBoundary, 'rollbackPlanCreated', '$.auditRecordBoundary.auditRecordBoundary', 'rollback-plan-created', blockers);
  checkRequiredFalse(auditRecordBoundary, 'artifactBytesProvided', '$.auditRecordBoundary.auditRecordBoundary', 'artifact-bytes-provided', blockers);
  checkRequiredFalse(auditRecordBoundary, 'auditBindingCreated', '$.auditRecordBoundary.auditRecordBoundary', 'audit-binding-created', blockers);
  checkRequiredFalse(auditRecordBoundary, 'executable', '$.auditRecordBoundary.auditRecordBoundary', 'upload-execution-enabled', blockers);

  checkRequiredTrue(remainingExecutionBoundaries, 'artifactBytesRequired', '$.auditRecordBoundary.remainingExecutionBoundaries', 'artifact-bytes-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'adapterInjectionRequired', '$.auditRecordBoundary.remainingExecutionBoundaries', 'write-token-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'writeTokenRequired', '$.auditRecordBoundary.remainingExecutionBoundaries', 'write-token-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'executionLeaseRequired', '$.auditRecordBoundary.remainingExecutionBoundaries', 'execution-lease-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'rollbackPlanRequired', '$.auditRecordBoundary.remainingExecutionBoundaries', 'rollback-plan-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'auditRecordRequired', '$.auditRecordBoundary.remainingExecutionBoundaries', 'audit-record-not-required', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'artifactBytesProvided', '$.auditRecordBoundary.remainingExecutionBoundaries', 'artifact-bytes-provided', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'adapterInjected', '$.auditRecordBoundary.remainingExecutionBoundaries', 'adapter-injected', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'writeTokenIssued', '$.auditRecordBoundary.remainingExecutionBoundaries', 'write-token-issued', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'executionLeaseCreated', '$.auditRecordBoundary.remainingExecutionBoundaries', 'execution-lease-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'rollbackPlanCreated', '$.auditRecordBoundary.remainingExecutionBoundaries', 'rollback-plan-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'auditRecordCreated', '$.auditRecordBoundary.remainingExecutionBoundaries', 'audit-record-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'objectWriteAllowed', '$.auditRecordBoundary.remainingExecutionBoundaries', 'object-write-attempted', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'metadataIndexWriteAllowed', '$.auditRecordBoundary.remainingExecutionBoundaries', 'metadata-index-write-attempted', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'remoteMutationAllowed', '$.auditRecordBoundary.remainingExecutionBoundaries', 'remote-mutation-performed', blockers);

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
    tokenRequiredBeforeExecution,
    tokenScopeBindingRequired,
    tokenSingleUseRequired,
    tokenExpiryRequired,
    executionLeaseRequiredBeforeExecution,
    leaseScopeBindingRequired,
    leaseSingleUseRequired,
    leaseExpiryRequired,
    writeTokenRequiredBeforeLease,
    auditBindingRequired,
    rollbackPlanRequiredBeforeExecution,
    rollbackScopeBindingRequired,
    rollbackReviewRequired,
    auditRecordRequiredBeforeExecution,
    auditScopeBindingRequired,
    auditReviewRequired,
    artifactBytesRequiredBeforeAudit,
    target: parsedTarget
  };
}

export function buildKnowledgeTeamUploadArtifactBytesBoundary(
  input: KnowledgeTeamUploadArtifactBytesBoundaryInput
): KnowledgeTeamUploadArtifactBytesBoundary {
  const blockers: KnowledgeTeamUploadArtifactBytesBoundaryBlocker[] = [];
  const parsedBoundary = parseAuditRecordBoundaryForArtifactBytesBoundary(input.auditRecordBoundary, blockers);
  const status: KnowledgeTeamUploadArtifactBytesBoundaryStatus = blockers.length === 0
    ? 'artifact-bytes-boundary-ready'
    : 'blocked';

  return {
    kind: 'infra-agent.knowledge-team-upload-artifact-bytes-boundary',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    boundaryKind: 'artifact-bytes-boundary-dry-run',
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
    sourceAuditRecordBoundary: {
      source: 'upload-audit-record-boundary',
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
      tokenRequiredBeforeExecution: parsedBoundary.tokenRequiredBeforeExecution,
      tokenScopeBindingRequired: parsedBoundary.tokenScopeBindingRequired,
      tokenSingleUseRequired: parsedBoundary.tokenSingleUseRequired,
      tokenExpiryRequired: parsedBoundary.tokenExpiryRequired,
      executionLeaseRequiredBeforeExecution: parsedBoundary.executionLeaseRequiredBeforeExecution,
      leaseScopeBindingRequired: parsedBoundary.leaseScopeBindingRequired,
      leaseSingleUseRequired: parsedBoundary.leaseSingleUseRequired,
      leaseExpiryRequired: parsedBoundary.leaseExpiryRequired,
      writeTokenRequiredBeforeLease: parsedBoundary.writeTokenRequiredBeforeLease,
      auditBindingRequired: parsedBoundary.auditBindingRequired,
      rollbackPlanRequiredBeforeExecution: parsedBoundary.rollbackPlanRequiredBeforeExecution,
      rollbackScopeBindingRequired: parsedBoundary.rollbackScopeBindingRequired,
      rollbackReviewRequired: parsedBoundary.rollbackReviewRequired,
      auditRecordRequiredBeforeExecution: parsedBoundary.auditRecordRequiredBeforeExecution,
      auditScopeBindingRequired: parsedBoundary.auditScopeBindingRequired,
      auditReviewRequired: parsedBoundary.auditReviewRequired,
      artifactBytesRequiredBeforeAudit: parsedBoundary.artifactBytesRequiredBeforeAudit
    },
    artifactBytesBoundary: {
      dryRunOnly: true,
      artifactBytesRequiredBeforeAdapter: true,
      artifactBytesRequiredBeforeExecution: true,
      artifactBytesProvided: false,
      artifactDigestRequired: true,
      artifactDigestVerified: false,
      artifactScopeBindingRequired: true,
      artifactScopeBoundToArtifact: false,
      auditRecordRequiredBeforeBytes: true,
      auditRecordCreated: false,
      auditScopeBindingRequired: true,
      auditScopeBoundToArtifact: false,
      writeTokenRequiredBeforeBytes: true,
      writeTokenIssued: false,
      executionLeaseRequiredBeforeBytes: true,
      executionLeaseCreated: false,
      rollbackPlanRequiredBeforeBytes: true,
      rollbackPlanCreated: false,
      adapterInjectionRequiredAfterBytes: true,
      adapterInjected: false,
      executable: false
    },
    remainingExecutionBoundaries: {
      artifactBytesRequired: true,
      artifactBytesProvided: false,
      adapterInjectionRequired: true,
      adapterInjected: false,
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
      nextAction: status === 'artifact-bytes-boundary-ready' ? 'design-adapter-injection-boundary' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: blockers.map(entry => entry.code),
      blockers,
      reason: status === 'artifact-bytes-boundary-ready'
        ? 'Artifact bytes boundary requirements are modeled, but no bytes are read or staged and upload execution remains disabled until separate adapter and mutation boundaries are designed.'
        : 'Artifact bytes boundary planning is blocked until all audit record boundary blockers are resolved.'
    }
  };
}
