import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadRollbackPlanBoundaryStatus =
  | 'rollback-plan-boundary-ready'
  | 'blocked';

export type KnowledgeTeamUploadRollbackPlanBoundaryNextAction =
  | 'design-audit-record-boundary'
  | 'resolve-blockers';

export type KnowledgeTeamUploadRollbackPlanBoundaryBlockerCode =
  | 'adapter-injected'
  | 'artifact-bytes-provided'
  | 'audit-binding-created'
  | 'audit-record-created'
  | 'backend-detail-leak'
  | 'client-created'
  | 'credential-presence-check-enabled'
  | 'credential-values-exposed'
  | 'execution-lease-created'
  | 'execution-lease-not-required'
  | 'invalid-execution-lease-boundary-kind'
  | 'invalid-boundary-kind'
  | 'invalid-schema-version'
  | 'lease-expiry-already-set'
  | 'lease-scope-already-bound'
  | 'lease-boundary-next-action-invalid'
  | 'lease-boundary-not-ready'
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
  | 'rollback-review-already-recorded'
  | 'rollback-scope-already-bound'
  | 'scope-not-matched'
  | 'token-expiry-already-set'
  | 'token-scope-already-bound'
  | 'unsupported-adapter-backend'
  | 'unsafe-adapter-name'
  | 'unsafe-artifact-reference'
  | 'upload-approval-already-provided'
  | 'upload-command-present'
  | 'upload-execution-enabled'
  | 'write-token-issued'
  | 'write-token-not-required';

export interface KnowledgeTeamUploadRollbackPlanBoundaryBlocker {
  code: KnowledgeTeamUploadRollbackPlanBoundaryBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadRollbackPlanBoundary {
  kind: 'infra-agent.knowledge-team-upload-rollback-plan-boundary';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  boundaryKind: 'rollback-plan-boundary-dry-run';
  status: KnowledgeTeamUploadRollbackPlanBoundaryStatus;
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
  sourceExecutionLeaseBoundary: {
    source: 'upload-execution-lease-boundary';
    boundaryStatus: 'execution-lease-boundary-ready' | 'blocked' | 'invalid';
    boundaryKind: 'execution-lease-boundary-dry-run' | 'unsupported';
    boundaryNextAction: 'design-rollback-plan-boundary' | 'resolve-blockers' | 'invalid';
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
  };
  rollbackPlanBoundary: {
    dryRunOnly: true;
    rollbackPlanRequiredBeforeExecution: true;
    rollbackPlanCreated: false;
    rollbackScopeBindingRequired: true;
    rollbackScopeBoundToArtifact: false;
    rollbackReviewRequired: true;
    rollbackReviewed: false;
    writeTokenRequiredBeforeRollback: true;
    writeTokenIssued: false;
    executionLeaseRequiredBeforeRollback: true;
    executionLeaseCreated: false;
    artifactBytesRequiredBeforeRollback: true;
    artifactBytesProvided: false;
    auditBindingRequired: true;
    auditBindingCreated: false;
    auditRecordRequiredBeforeExecution: true;
    auditRecordCreated: false;
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
    status: KnowledgeTeamUploadRollbackPlanBoundaryStatus;
    nextAction: KnowledgeTeamUploadRollbackPlanBoundaryNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadRollbackPlanBoundaryBlockerCode[];
    blockers: KnowledgeTeamUploadRollbackPlanBoundaryBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadRollbackPlanBoundaryInput {
  executionLeaseBoundary: unknown;
}

interface ParsedExecutionLeaseBoundaryForRollbackPlanBoundary {
  boundaryStatus: 'execution-lease-boundary-ready' | 'blocked' | 'invalid';
  boundaryKind: 'execution-lease-boundary-dry-run' | 'unsupported';
  boundaryNextAction: 'design-rollback-plan-boundary' | 'resolve-blockers' | 'invalid';
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
  target: {
    manifestId: string | null;
    objectKey: string | null;
    objectSha256: string | null;
    artifactId: string | null;
  };
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|secret|password|authorization|header|accessKey|sessionToken|clientConfig|sdkClient|signedUrl|putObject|putEntry|fetch|artifactStore|tokenValue|tokenMaterial|leaseValue|leaseMaterial|rollbackValue|rollbackMaterial|rollbackCommand)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|secret|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBool(value: unknown): boolean {
  return value === true;
}

function readBoundaryStatus(value: unknown): ParsedExecutionLeaseBoundaryForRollbackPlanBoundary['boundaryStatus'] {
  if (value === 'execution-lease-boundary-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readBoundaryKind(value: unknown): ParsedExecutionLeaseBoundaryForRollbackPlanBoundary['boundaryKind'] {
  if (value === 'execution-lease-boundary-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readBoundaryNextAction(value: unknown): ParsedExecutionLeaseBoundaryForRollbackPlanBoundary['boundaryNextAction'] {
  if (value === 'design-rollback-plan-boundary' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readReviewStatus(value: unknown): ParsedExecutionLeaseBoundaryForRollbackPlanBoundary['reviewStatus'] {
  if (value === 'review-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readReviewKind(value: unknown): ParsedExecutionLeaseBoundaryForRollbackPlanBoundary['reviewKind'] {
  if (value === 'human-fingerprint-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readAdapterBackendKind(value: unknown): ParsedExecutionLeaseBoundaryForRollbackPlanBoundary['adapterBackendKind'] {
  if (value === 'mock-s3-compatible' || value === 's3-compatible') {
    return value;
  }
  return 'unsupported';
}

function addBlocker(
  blockers: KnowledgeTeamUploadRollbackPlanBoundaryBlocker[],
  code: KnowledgeTeamUploadRollbackPlanBoundaryBlockerCode,
  path: string,
  message: string
): void {
  blockers.push({ code, path, message });
}

function scanForPrivateDetails(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadRollbackPlanBoundaryBlocker[]
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
        'Rollback plan boundary input must not contain backend details, private paths, credentials, commands, or token/lease material.'
      );
    }
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    if (FORBIDDEN_LEAK_KEY_PATTERN.test(key)) {
      addBlocker(
        blockers,
        'backend-detail-leak',
        entryPath,
        'Rollback plan boundary input must not contain backend details, credential fields, SDK/client fields, commands, or token/lease material.'
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
  blockers: KnowledgeTeamUploadRollbackPlanBoundaryBlocker[]
): ParsedExecutionLeaseBoundaryForRollbackPlanBoundary['target'] {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.executionLeaseBoundary.target', 'Rollback plan boundary planning requires a target object.');
    addBlocker(blockers, 'unsafe-artifact-reference', '$.executionLeaseBoundary.target', 'Rollback plan boundary planning requires safe target references.');
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
    addBlocker(blockers, 'unsafe-artifact-reference', '$.executionLeaseBoundary.target', 'Rollback plan boundary planning requires safe manifest, object, hash, and artifact references.');
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
  code: KnowledgeTeamUploadRollbackPlanBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadRollbackPlanBoundaryBlocker[]
): void {
  if (value[key] === true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must remain false for rollback plan boundary planning.`);
  }
}

function checkNullCommand(
  value: Record<string, unknown>,
  key: string,
  path: string,
  blockers: KnowledgeTeamUploadRollbackPlanBoundaryBlocker[]
): void {
  if (value[key] !== null && value[key] !== undefined) {
    addBlocker(blockers, 'upload-command-present', `${path}.${key}`, 'Rollback plan boundary planning must not receive upload commands.');
  }
}

function checkRequiredTrue(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadRollbackPlanBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadRollbackPlanBoundaryBlocker[]
): boolean {
  if (value[key] !== true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be true before rollback plan boundary planning can proceed.`);
    return false;
  }
  return true;
}

function checkRequiredFalse(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadRollbackPlanBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadRollbackPlanBoundaryBlocker[]
): boolean {
  if (value[key] !== false) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be false for rollback plan boundary planning.`);
    return false;
  }
  return true;
}

function checkCommonExecutionDisabledFields(
  value: Record<string, unknown>,
  path: string,
  blockers: KnowledgeTeamUploadRollbackPlanBoundaryBlocker[]
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

function defaultParsedExecutionLeaseBoundary(): ParsedExecutionLeaseBoundaryForRollbackPlanBoundary {
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
    target: {
      manifestId: null,
      objectKey: null,
      objectSha256: null,
      artifactId: null
    }
  };
}

function parseExecutionLeaseBoundaryForRollbackPlanBoundary(
  value: unknown,
  blockers: KnowledgeTeamUploadRollbackPlanBoundaryBlocker[]
): ParsedExecutionLeaseBoundaryForRollbackPlanBoundary {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.executionLeaseBoundary', 'Rollback plan boundary planning requires an execution lease boundary object.');
    return defaultParsedExecutionLeaseBoundary();
  }

  scanForPrivateDetails(value, '$.executionLeaseBoundary', blockers);

  if (value.kind !== 'infra-agent.knowledge-team-upload-execution-lease-boundary') {
    addBlocker(blockers, 'invalid-execution-lease-boundary-kind', '$.executionLeaseBoundary.kind', 'Rollback plan boundary planning requires an upload execution lease boundary artifact.');
  }
  if (value.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.executionLeaseBoundary.schemaVersion', 'Rollback plan boundary planning requires schemaVersion 1.');
  }
  if (value.boundaryKind !== 'execution-lease-boundary-dry-run') {
    addBlocker(blockers, 'invalid-boundary-kind', '$.executionLeaseBoundary.boundaryKind', 'Rollback plan boundary planning requires the execution lease dry-run boundary kind.');
  }

  checkCommonExecutionDisabledFields(value, '$.executionLeaseBoundary', blockers);

  const boundaryStatus = readBoundaryStatus(value.status);
  if (boundaryStatus !== 'execution-lease-boundary-ready') {
    addBlocker(blockers, 'lease-boundary-not-ready', '$.executionLeaseBoundary.status', 'Rollback plan boundary planning requires a ready execution lease boundary.');
  }

  const readiness = isRecord(value.readiness) ? value.readiness : {};
  if (!isRecord(value.readiness)) {
    addBlocker(blockers, 'missing-required-field', '$.executionLeaseBoundary.readiness', 'Rollback plan boundary planning requires execution lease readiness.');
  }
  const boundaryNextAction = readBoundaryNextAction(readiness.nextAction);
  if (boundaryNextAction !== 'design-rollback-plan-boundary') {
    addBlocker(blockers, 'lease-boundary-next-action-invalid', '$.executionLeaseBoundary.readiness.nextAction', 'Rollback plan boundary planning requires the execution lease boundary to advance to rollback plan design.');
  }
  if (typeof readiness.blockerCount === 'number' && readiness.blockerCount !== 0) {
    addBlocker(blockers, 'lease-boundary-not-ready', '$.executionLeaseBoundary.readiness.blockerCount', 'Rollback plan boundary planning requires zero execution lease blockers.');
  }

  const parsedTarget = parseTarget(value.target, blockers);
  const sourceWriteTokenBoundary = isRecord(value.sourceWriteTokenBoundary) ? value.sourceWriteTokenBoundary : {};
  const executionLeaseBoundary = isRecord(value.executionLeaseBoundary) ? value.executionLeaseBoundary : {};
  const remainingExecutionBoundaries = isRecord(value.remainingExecutionBoundaries) ? value.remainingExecutionBoundaries : {};

  if (!isRecord(value.sourceWriteTokenBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.executionLeaseBoundary.sourceWriteTokenBoundary', 'Rollback plan boundary planning requires source write-token boundary summary.');
  }
  if (!isRecord(value.executionLeaseBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.executionLeaseBoundary.executionLeaseBoundary', 'Rollback plan boundary planning requires execution lease boundary details.');
  }
  if (!isRecord(value.remainingExecutionBoundaries)) {
    addBlocker(blockers, 'missing-required-field', '$.executionLeaseBoundary.remainingExecutionBoundaries', 'Rollback plan boundary planning requires remaining execution boundary details.');
  }

  const reviewStatus = readReviewStatus(sourceWriteTokenBoundary.reviewStatus);
  const reviewKind = readReviewKind(sourceWriteTokenBoundary.reviewKind);
  const scopeMatched = readBool(sourceWriteTokenBoundary.scopeMatched);
  const humanReviewRecorded = readBool(sourceWriteTokenBoundary.humanReviewRecorded);
  const fingerprintVerified = readBool(sourceWriteTokenBoundary.fingerprintVerified);
  const sourceFingerprintVerified = readBool(sourceWriteTokenBoundary.sourceFingerprintVerified);
  const adapterName = typeof sourceWriteTokenBoundary.adapterName === 'string'
    && isSafeKnowledgeTeamBackendAdapterName(sourceWriteTokenBoundary.adapterName)
    ? sourceWriteTokenBoundary.adapterName
    : null;
  const adapterBackendKind = readAdapterBackendKind(sourceWriteTokenBoundary.adapterBackendKind);

  if (reviewStatus !== 'review-ready' || reviewKind !== 'human-fingerprint-dry-run' || !humanReviewRecorded || !fingerprintVerified || !sourceFingerprintVerified) {
    addBlocker(blockers, 'review-fingerprint-unverified', '$.executionLeaseBoundary.sourceWriteTokenBoundary', 'Rollback plan boundary planning requires verified prior human review state.');
  }
  if (!scopeMatched) {
    addBlocker(blockers, 'scope-not-matched', '$.executionLeaseBoundary.sourceWriteTokenBoundary.scopeMatched', 'Rollback plan boundary planning requires matched artifact scope.');
  }
  if (adapterName === null && sourceWriteTokenBoundary.adapterName !== null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.executionLeaseBoundary.sourceWriteTokenBoundary.adapterName', 'Rollback plan boundary planning requires a safe adapter name.');
  }
  if (adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.executionLeaseBoundary.sourceWriteTokenBoundary.adapterBackendKind', 'Rollback plan boundary planning currently accepts only the mock S3-compatible backend boundary.');
  }

  const tokenRequiredBeforeExecution = checkRequiredTrue(sourceWriteTokenBoundary, 'tokenRequiredBeforeExecution', '$.executionLeaseBoundary.sourceWriteTokenBoundary', 'write-token-not-required', blockers);
  const tokenScopeBindingRequired = checkRequiredTrue(sourceWriteTokenBoundary, 'tokenScopeBindingRequired', '$.executionLeaseBoundary.sourceWriteTokenBoundary', 'write-token-not-required', blockers);
  const tokenSingleUseRequired = checkRequiredTrue(sourceWriteTokenBoundary, 'tokenSingleUseRequired', '$.executionLeaseBoundary.sourceWriteTokenBoundary', 'write-token-not-required', blockers);
  const tokenExpiryRequired = checkRequiredTrue(sourceWriteTokenBoundary, 'tokenExpiryRequired', '$.executionLeaseBoundary.sourceWriteTokenBoundary', 'write-token-not-required', blockers);
  const auditBindingRequired = checkRequiredTrue(sourceWriteTokenBoundary, 'auditBindingRequired', '$.executionLeaseBoundary.sourceWriteTokenBoundary', 'write-token-not-required', blockers);

  const executionLeaseRequiredBeforeExecution = checkRequiredTrue(executionLeaseBoundary, 'executionLeaseRequiredBeforeExecution', '$.executionLeaseBoundary.executionLeaseBoundary', 'execution-lease-not-required', blockers);
  const leaseScopeBindingRequired = checkRequiredTrue(executionLeaseBoundary, 'leaseScopeBindingRequired', '$.executionLeaseBoundary.executionLeaseBoundary', 'execution-lease-not-required', blockers);
  const leaseSingleUseRequired = checkRequiredTrue(executionLeaseBoundary, 'leaseSingleUseRequired', '$.executionLeaseBoundary.executionLeaseBoundary', 'execution-lease-not-required', blockers);
  const leaseExpiryRequired = checkRequiredTrue(executionLeaseBoundary, 'leaseExpiryRequired', '$.executionLeaseBoundary.executionLeaseBoundary', 'execution-lease-not-required', blockers);
  const writeTokenRequiredBeforeLease = checkRequiredTrue(executionLeaseBoundary, 'writeTokenRequiredBeforeLease', '$.executionLeaseBoundary.executionLeaseBoundary', 'write-token-not-required', blockers);
  const rollbackPlanRequiredBeforeExecution = checkRequiredTrue(executionLeaseBoundary, 'rollbackPlanRequiredBeforeExecution', '$.executionLeaseBoundary.executionLeaseBoundary', 'rollback-plan-not-required', blockers);

  checkRequiredFalse(executionLeaseBoundary, 'executionLeaseCreated', '$.executionLeaseBoundary.executionLeaseBoundary', 'execution-lease-created', blockers);
  checkRequiredFalse(executionLeaseBoundary, 'leaseScopeBoundToArtifact', '$.executionLeaseBoundary.executionLeaseBoundary', 'lease-scope-already-bound', blockers);
  checkRequiredFalse(executionLeaseBoundary, 'singleUseLeaseCreated', '$.executionLeaseBoundary.executionLeaseBoundary', 'execution-lease-created', blockers);
  checkRequiredFalse(executionLeaseBoundary, 'leaseExpirySet', '$.executionLeaseBoundary.executionLeaseBoundary', 'lease-expiry-already-set', blockers);
  checkRequiredFalse(executionLeaseBoundary, 'writeTokenIssued', '$.executionLeaseBoundary.executionLeaseBoundary', 'write-token-issued', blockers);
  checkRequiredFalse(executionLeaseBoundary, 'auditBindingCreated', '$.executionLeaseBoundary.executionLeaseBoundary', 'audit-binding-created', blockers);
  checkRequiredFalse(executionLeaseBoundary, 'rollbackPlanCreated', '$.executionLeaseBoundary.executionLeaseBoundary', 'rollback-plan-created', blockers);
  checkRequiredFalse(executionLeaseBoundary, 'executable', '$.executionLeaseBoundary.executionLeaseBoundary', 'upload-execution-enabled', blockers);

  checkRequiredTrue(remainingExecutionBoundaries, 'artifactBytesRequired', '$.executionLeaseBoundary.remainingExecutionBoundaries', 'write-token-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'adapterInjectionRequired', '$.executionLeaseBoundary.remainingExecutionBoundaries', 'write-token-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'writeTokenRequired', '$.executionLeaseBoundary.remainingExecutionBoundaries', 'write-token-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'executionLeaseRequired', '$.executionLeaseBoundary.remainingExecutionBoundaries', 'execution-lease-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'rollbackPlanRequired', '$.executionLeaseBoundary.remainingExecutionBoundaries', 'rollback-plan-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'auditRecordRequired', '$.executionLeaseBoundary.remainingExecutionBoundaries', 'write-token-not-required', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'artifactBytesProvided', '$.executionLeaseBoundary.remainingExecutionBoundaries', 'artifact-bytes-provided', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'adapterInjected', '$.executionLeaseBoundary.remainingExecutionBoundaries', 'adapter-injected', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'writeTokenIssued', '$.executionLeaseBoundary.remainingExecutionBoundaries', 'write-token-issued', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'executionLeaseCreated', '$.executionLeaseBoundary.remainingExecutionBoundaries', 'execution-lease-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'rollbackPlanCreated', '$.executionLeaseBoundary.remainingExecutionBoundaries', 'rollback-plan-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'auditRecordCreated', '$.executionLeaseBoundary.remainingExecutionBoundaries', 'audit-record-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'objectWriteAllowed', '$.executionLeaseBoundary.remainingExecutionBoundaries', 'object-write-attempted', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'metadataIndexWriteAllowed', '$.executionLeaseBoundary.remainingExecutionBoundaries', 'metadata-index-write-attempted', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'remoteMutationAllowed', '$.executionLeaseBoundary.remainingExecutionBoundaries', 'remote-mutation-performed', blockers);

  const incomingRollbackPlanBoundary = isRecord(value.rollbackPlanBoundary) ? value.rollbackPlanBoundary : {};
  checkFalseField(incomingRollbackPlanBoundary, 'rollbackPlanCreated', '$.executionLeaseBoundary.rollbackPlanBoundary', 'rollback-plan-created', blockers);
  checkFalseField(incomingRollbackPlanBoundary, 'rollbackScopeBoundToArtifact', '$.executionLeaseBoundary.rollbackPlanBoundary', 'rollback-scope-already-bound', blockers);
  checkFalseField(incomingRollbackPlanBoundary, 'rollbackReviewed', '$.executionLeaseBoundary.rollbackPlanBoundary', 'rollback-review-already-recorded', blockers);
  checkFalseField(incomingRollbackPlanBoundary, 'writeTokenIssued', '$.executionLeaseBoundary.rollbackPlanBoundary', 'write-token-issued', blockers);
  checkFalseField(incomingRollbackPlanBoundary, 'executionLeaseCreated', '$.executionLeaseBoundary.rollbackPlanBoundary', 'execution-lease-created', blockers);
  checkFalseField(incomingRollbackPlanBoundary, 'artifactBytesProvided', '$.executionLeaseBoundary.rollbackPlanBoundary', 'artifact-bytes-provided', blockers);
  checkFalseField(incomingRollbackPlanBoundary, 'auditBindingCreated', '$.executionLeaseBoundary.rollbackPlanBoundary', 'audit-binding-created', blockers);
  checkFalseField(incomingRollbackPlanBoundary, 'auditRecordCreated', '$.executionLeaseBoundary.rollbackPlanBoundary', 'audit-record-created', blockers);
  checkFalseField(incomingRollbackPlanBoundary, 'executable', '$.executionLeaseBoundary.rollbackPlanBoundary', 'upload-execution-enabled', blockers);

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
    target: parsedTarget
  };
}

export function buildKnowledgeTeamUploadRollbackPlanBoundary(
  input: KnowledgeTeamUploadRollbackPlanBoundaryInput
): KnowledgeTeamUploadRollbackPlanBoundary {
  const blockers: KnowledgeTeamUploadRollbackPlanBoundaryBlocker[] = [];
  const parsedBoundary = parseExecutionLeaseBoundaryForRollbackPlanBoundary(input.executionLeaseBoundary, blockers);
  const status: KnowledgeTeamUploadRollbackPlanBoundaryStatus = blockers.length === 0
    ? 'rollback-plan-boundary-ready'
    : 'blocked';

  return {
    kind: 'infra-agent.knowledge-team-upload-rollback-plan-boundary',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    boundaryKind: 'rollback-plan-boundary-dry-run',
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
    sourceExecutionLeaseBoundary: {
      source: 'upload-execution-lease-boundary',
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
      rollbackPlanRequiredBeforeExecution: parsedBoundary.rollbackPlanRequiredBeforeExecution
    },
    rollbackPlanBoundary: {
      dryRunOnly: true,
      rollbackPlanRequiredBeforeExecution: true,
      rollbackPlanCreated: false,
      rollbackScopeBindingRequired: true,
      rollbackScopeBoundToArtifact: false,
      rollbackReviewRequired: true,
      rollbackReviewed: false,
      writeTokenRequiredBeforeRollback: true,
      writeTokenIssued: false,
      executionLeaseRequiredBeforeRollback: true,
      executionLeaseCreated: false,
      artifactBytesRequiredBeforeRollback: true,
      artifactBytesProvided: false,
      auditBindingRequired: true,
      auditBindingCreated: false,
      auditRecordRequiredBeforeExecution: true,
      auditRecordCreated: false,
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
      nextAction: status === 'rollback-plan-boundary-ready' ? 'design-audit-record-boundary' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: blockers.map(entry => entry.code),
      blockers,
      reason: status === 'rollback-plan-boundary-ready'
        ? 'Rollback plan boundary requirements are modeled, but no rollback plan is created and upload execution remains disabled until separate audit, adapter, artifact-byte, and mutation boundaries are designed.'
        : 'Rollback plan boundary planning is blocked until all execution lease and rollback boundary blockers are resolved.'
    }
  };
}
