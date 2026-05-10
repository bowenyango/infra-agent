import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadAuditRecordBoundaryStatus =
  | 'audit-record-boundary-ready'
  | 'blocked';

export type KnowledgeTeamUploadAuditRecordBoundaryNextAction =
  | 'design-artifact-bytes-boundary'
  | 'resolve-blockers';

export type KnowledgeTeamUploadAuditRecordBoundaryBlockerCode =
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
  | 'invalid-boundary-kind'
  | 'invalid-rollback-plan-boundary-kind'
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
  | 'rollback-boundary-next-action-invalid'
  | 'rollback-boundary-not-ready'
  | 'audit-record-not-required'
  | 'audit-review-already-recorded'
  | 'audit-scope-already-bound'
  | 'rollback-plan-created'
  | 'rollback-plan-not-required'
  | 'rollback-review-already-recorded'
  | 'rollback-scope-already-bound'
  | 'scope-not-matched'
  | 'unsupported-adapter-backend'
  | 'unsafe-adapter-name'
  | 'unsafe-artifact-reference'
  | 'upload-approval-already-provided'
  | 'upload-command-present'
  | 'upload-execution-enabled'
  | 'write-token-issued'
  | 'write-token-not-required';

export interface KnowledgeTeamUploadAuditRecordBoundaryBlocker {
  code: KnowledgeTeamUploadAuditRecordBoundaryBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadAuditRecordBoundary {
  kind: 'infra-agent.knowledge-team-upload-audit-record-boundary';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  boundaryKind: 'audit-record-boundary-dry-run';
  status: KnowledgeTeamUploadAuditRecordBoundaryStatus;
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
  sourceRollbackPlanBoundary: {
    source: 'upload-rollback-plan-boundary';
    boundaryStatus: 'rollback-plan-boundary-ready' | 'blocked' | 'invalid';
    boundaryKind: 'rollback-plan-boundary-dry-run' | 'unsupported';
    boundaryNextAction: 'design-audit-record-boundary' | 'resolve-blockers' | 'invalid';
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
  };
  auditRecordBoundary: {
    dryRunOnly: true;
    auditRecordRequiredBeforeExecution: true;
    auditRecordCreated: false;
    auditScopeBindingRequired: true;
    auditScopeBoundToArtifact: false;
    auditReviewRequired: true;
    auditReviewed: false;
    writeTokenRequiredBeforeAudit: true;
    writeTokenIssued: false;
    executionLeaseRequiredBeforeAudit: true;
    executionLeaseCreated: false;
    rollbackPlanRequiredBeforeAudit: true;
    rollbackPlanCreated: false;
    artifactBytesRequiredBeforeAudit: true;
    artifactBytesProvided: false;
    auditBindingRequired: true;
    auditBindingCreated: false;
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
    status: KnowledgeTeamUploadAuditRecordBoundaryStatus;
    nextAction: KnowledgeTeamUploadAuditRecordBoundaryNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadAuditRecordBoundaryBlockerCode[];
    blockers: KnowledgeTeamUploadAuditRecordBoundaryBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadAuditRecordBoundaryInput {
  rollbackPlanBoundary: unknown;
}

interface ParsedRollbackPlanBoundaryForAuditRecordBoundary {
  boundaryStatus: 'rollback-plan-boundary-ready' | 'blocked' | 'invalid';
  boundaryKind: 'rollback-plan-boundary-dry-run' | 'unsupported';
  boundaryNextAction: 'design-audit-record-boundary' | 'resolve-blockers' | 'invalid';
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
  target: {
    manifestId: string | null;
    objectKey: string | null;
    objectSha256: string | null;
    artifactId: string | null;
  };
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|secret|password|authorization|header|accessKey|sessionToken|clientConfig|sdkClient|signedUrl|putObject|putEntry|fetch|artifactStore|tokenValue|tokenMaterial|leaseValue|leaseMaterial|rollbackValue|rollbackMaterial|rollbackCommand|auditValue|auditMaterial|auditCommand)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|secret|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBool(value: unknown): boolean {
  return value === true;
}

function readBoundaryStatus(value: unknown): ParsedRollbackPlanBoundaryForAuditRecordBoundary['boundaryStatus'] {
  if (value === 'rollback-plan-boundary-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readBoundaryKind(value: unknown): ParsedRollbackPlanBoundaryForAuditRecordBoundary['boundaryKind'] {
  if (value === 'rollback-plan-boundary-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readBoundaryNextAction(value: unknown): ParsedRollbackPlanBoundaryForAuditRecordBoundary['boundaryNextAction'] {
  if (value === 'design-audit-record-boundary' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readReviewStatus(value: unknown): ParsedRollbackPlanBoundaryForAuditRecordBoundary['reviewStatus'] {
  if (value === 'review-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readReviewKind(value: unknown): ParsedRollbackPlanBoundaryForAuditRecordBoundary['reviewKind'] {
  if (value === 'human-fingerprint-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readAdapterBackendKind(value: unknown): ParsedRollbackPlanBoundaryForAuditRecordBoundary['adapterBackendKind'] {
  if (value === 'mock-s3-compatible' || value === 's3-compatible') {
    return value;
  }
  return 'unsupported';
}

function addBlocker(
  blockers: KnowledgeTeamUploadAuditRecordBoundaryBlocker[],
  code: KnowledgeTeamUploadAuditRecordBoundaryBlockerCode,
  path: string,
  message: string
): void {
  blockers.push({ code, path, message });
}

function scanForPrivateDetails(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadAuditRecordBoundaryBlocker[]
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
        'Audit record boundary input must not contain backend details, private paths, credentials, commands, or token/lease material.'
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
        'Audit record boundary input must not contain backend details, credential fields, SDK/client fields, commands, or token/lease material.'
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
  blockers: KnowledgeTeamUploadAuditRecordBoundaryBlocker[]
): ParsedRollbackPlanBoundaryForAuditRecordBoundary['target'] {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.rollbackPlanBoundary.target', 'Audit record boundary planning requires a target object.');
    addBlocker(blockers, 'unsafe-artifact-reference', '$.rollbackPlanBoundary.target', 'Audit record boundary planning requires safe target references.');
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
    addBlocker(blockers, 'unsafe-artifact-reference', '$.rollbackPlanBoundary.target', 'Audit record boundary planning requires safe manifest, object, hash, and artifact references.');
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
  code: KnowledgeTeamUploadAuditRecordBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadAuditRecordBoundaryBlocker[]
): void {
  if (value[key] === true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must remain false for audit record boundary planning.`);
  }
}

function checkNullCommand(
  value: Record<string, unknown>,
  key: string,
  path: string,
  blockers: KnowledgeTeamUploadAuditRecordBoundaryBlocker[]
): void {
  if (value[key] !== null && value[key] !== undefined) {
    addBlocker(blockers, 'upload-command-present', `${path}.${key}`, 'Audit record boundary planning must not receive upload commands.');
  }
}

function checkRequiredTrue(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadAuditRecordBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadAuditRecordBoundaryBlocker[]
): boolean {
  if (value[key] !== true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be true before audit record boundary planning can proceed.`);
    return false;
  }
  return true;
}

function checkRequiredFalse(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadAuditRecordBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadAuditRecordBoundaryBlocker[]
): boolean {
  if (value[key] !== false) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be false for audit record boundary planning.`);
    return false;
  }
  return true;
}

function checkCommonExecutionDisabledFields(
  value: Record<string, unknown>,
  path: string,
  blockers: KnowledgeTeamUploadAuditRecordBoundaryBlocker[]
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

function defaultParsedRollbackPlanBoundary(): ParsedRollbackPlanBoundaryForAuditRecordBoundary {
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
    target: {
      manifestId: null,
      objectKey: null,
      objectSha256: null,
      artifactId: null
    }
  };
}

function parseRollbackPlanBoundaryForAuditRecordBoundary(
  value: unknown,
  blockers: KnowledgeTeamUploadAuditRecordBoundaryBlocker[]
): ParsedRollbackPlanBoundaryForAuditRecordBoundary {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.rollbackPlanBoundary', 'Audit record boundary planning requires a rollback plan boundary object.');
    return defaultParsedRollbackPlanBoundary();
  }

  scanForPrivateDetails(value, '$.rollbackPlanBoundary', blockers);

  if (value.kind !== 'infra-agent.knowledge-team-upload-rollback-plan-boundary') {
    addBlocker(blockers, 'invalid-rollback-plan-boundary-kind', '$.rollbackPlanBoundary.kind', 'Audit record boundary planning requires an upload rollback plan boundary artifact.');
  }
  if (value.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.rollbackPlanBoundary.schemaVersion', 'Audit record boundary planning requires schemaVersion 1.');
  }
  if (value.boundaryKind !== 'rollback-plan-boundary-dry-run') {
    addBlocker(blockers, 'invalid-boundary-kind', '$.rollbackPlanBoundary.boundaryKind', 'Audit record boundary planning requires the rollback plan dry-run boundary kind.');
  }

  checkCommonExecutionDisabledFields(value, '$.rollbackPlanBoundary', blockers);

  const boundaryStatus = readBoundaryStatus(value.status);
  if (boundaryStatus !== 'rollback-plan-boundary-ready') {
    addBlocker(blockers, 'rollback-boundary-not-ready', '$.rollbackPlanBoundary.status', 'Audit record boundary planning requires a ready rollback plan boundary.');
  }

  const readiness = isRecord(value.readiness) ? value.readiness : {};
  if (!isRecord(value.readiness)) {
    addBlocker(blockers, 'missing-required-field', '$.rollbackPlanBoundary.readiness', 'Audit record boundary planning requires rollback plan readiness.');
  }
  const boundaryNextAction = readBoundaryNextAction(readiness.nextAction);
  if (boundaryNextAction !== 'design-audit-record-boundary') {
    addBlocker(blockers, 'rollback-boundary-next-action-invalid', '$.rollbackPlanBoundary.readiness.nextAction', 'Audit record boundary planning requires the rollback plan boundary to advance to audit record design.');
  }
  if (typeof readiness.blockerCount === 'number' && readiness.blockerCount !== 0) {
    addBlocker(blockers, 'rollback-boundary-not-ready', '$.rollbackPlanBoundary.readiness.blockerCount', 'Audit record boundary planning requires zero rollback plan blockers.');
  }

  const parsedTarget = parseTarget(value.target, blockers);
  const sourceExecutionLeaseBoundary = isRecord(value.sourceExecutionLeaseBoundary) ? value.sourceExecutionLeaseBoundary : {};
  const rollbackPlanBoundary = isRecord(value.rollbackPlanBoundary) ? value.rollbackPlanBoundary : {};
  const remainingExecutionBoundaries = isRecord(value.remainingExecutionBoundaries) ? value.remainingExecutionBoundaries : {};

  if (!isRecord(value.sourceExecutionLeaseBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.rollbackPlanBoundary.sourceExecutionLeaseBoundary', 'Audit record boundary planning requires source execution lease boundary summary.');
  }
  if (!isRecord(value.rollbackPlanBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.rollbackPlanBoundary.rollbackPlanBoundary', 'Audit record boundary planning requires rollback plan boundary details.');
  }
  if (!isRecord(value.remainingExecutionBoundaries)) {
    addBlocker(blockers, 'missing-required-field', '$.rollbackPlanBoundary.remainingExecutionBoundaries', 'Audit record boundary planning requires remaining execution boundary details.');
  }

  const reviewStatus = readReviewStatus(sourceExecutionLeaseBoundary.reviewStatus);
  const reviewKind = readReviewKind(sourceExecutionLeaseBoundary.reviewKind);
  const scopeMatched = readBool(sourceExecutionLeaseBoundary.scopeMatched);
  const humanReviewRecorded = readBool(sourceExecutionLeaseBoundary.humanReviewRecorded);
  const fingerprintVerified = readBool(sourceExecutionLeaseBoundary.fingerprintVerified);
  const sourceFingerprintVerified = readBool(sourceExecutionLeaseBoundary.sourceFingerprintVerified);
  const adapterName = typeof sourceExecutionLeaseBoundary.adapterName === 'string'
    && isSafeKnowledgeTeamBackendAdapterName(sourceExecutionLeaseBoundary.adapterName)
    ? sourceExecutionLeaseBoundary.adapterName
    : null;
  const adapterBackendKind = readAdapterBackendKind(sourceExecutionLeaseBoundary.adapterBackendKind);

  if (reviewStatus !== 'review-ready' || reviewKind !== 'human-fingerprint-dry-run' || !humanReviewRecorded || !fingerprintVerified || !sourceFingerprintVerified) {
    addBlocker(blockers, 'review-fingerprint-unverified', '$.rollbackPlanBoundary.sourceExecutionLeaseBoundary', 'Audit record boundary planning requires verified prior human review state.');
  }
  if (!scopeMatched) {
    addBlocker(blockers, 'scope-not-matched', '$.rollbackPlanBoundary.sourceExecutionLeaseBoundary.scopeMatched', 'Audit record boundary planning requires matched artifact scope.');
  }
  if (adapterName === null && sourceExecutionLeaseBoundary.adapterName !== null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.rollbackPlanBoundary.sourceExecutionLeaseBoundary.adapterName', 'Audit record boundary planning requires a safe adapter name.');
  }
  if (adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.rollbackPlanBoundary.sourceExecutionLeaseBoundary.adapterBackendKind', 'Audit record boundary planning currently accepts only the mock S3-compatible backend boundary.');
  }

  const tokenRequiredBeforeExecution = checkRequiredTrue(sourceExecutionLeaseBoundary, 'tokenRequiredBeforeExecution', '$.rollbackPlanBoundary.sourceExecutionLeaseBoundary', 'write-token-not-required', blockers);
  const tokenScopeBindingRequired = checkRequiredTrue(sourceExecutionLeaseBoundary, 'tokenScopeBindingRequired', '$.rollbackPlanBoundary.sourceExecutionLeaseBoundary', 'write-token-not-required', blockers);
  const tokenSingleUseRequired = checkRequiredTrue(sourceExecutionLeaseBoundary, 'tokenSingleUseRequired', '$.rollbackPlanBoundary.sourceExecutionLeaseBoundary', 'write-token-not-required', blockers);
  const tokenExpiryRequired = checkRequiredTrue(sourceExecutionLeaseBoundary, 'tokenExpiryRequired', '$.rollbackPlanBoundary.sourceExecutionLeaseBoundary', 'write-token-not-required', blockers);
  const executionLeaseRequiredBeforeExecution = checkRequiredTrue(sourceExecutionLeaseBoundary, 'executionLeaseRequiredBeforeExecution', '$.rollbackPlanBoundary.sourceExecutionLeaseBoundary', 'execution-lease-not-required', blockers);
  const leaseScopeBindingRequired = checkRequiredTrue(sourceExecutionLeaseBoundary, 'leaseScopeBindingRequired', '$.rollbackPlanBoundary.sourceExecutionLeaseBoundary', 'execution-lease-not-required', blockers);
  const leaseSingleUseRequired = checkRequiredTrue(sourceExecutionLeaseBoundary, 'leaseSingleUseRequired', '$.rollbackPlanBoundary.sourceExecutionLeaseBoundary', 'execution-lease-not-required', blockers);
  const leaseExpiryRequired = checkRequiredTrue(sourceExecutionLeaseBoundary, 'leaseExpiryRequired', '$.rollbackPlanBoundary.sourceExecutionLeaseBoundary', 'execution-lease-not-required', blockers);
  const writeTokenRequiredBeforeLease = checkRequiredTrue(sourceExecutionLeaseBoundary, 'writeTokenRequiredBeforeLease', '$.rollbackPlanBoundary.sourceExecutionLeaseBoundary', 'write-token-not-required', blockers);
  const auditBindingRequired = checkRequiredTrue(sourceExecutionLeaseBoundary, 'auditBindingRequired', '$.rollbackPlanBoundary.sourceExecutionLeaseBoundary', 'write-token-not-required', blockers);
  const rollbackPlanRequiredBeforeExecution = checkRequiredTrue(sourceExecutionLeaseBoundary, 'rollbackPlanRequiredBeforeExecution', '$.rollbackPlanBoundary.sourceExecutionLeaseBoundary', 'rollback-plan-not-required', blockers);

  const rollbackScopeBindingRequired = checkRequiredTrue(rollbackPlanBoundary, 'rollbackScopeBindingRequired', '$.rollbackPlanBoundary.rollbackPlanBoundary', 'rollback-plan-not-required', blockers);
  const rollbackReviewRequired = checkRequiredTrue(rollbackPlanBoundary, 'rollbackReviewRequired', '$.rollbackPlanBoundary.rollbackPlanBoundary', 'rollback-plan-not-required', blockers);
  const auditRecordRequiredBeforeExecution = checkRequiredTrue(rollbackPlanBoundary, 'auditRecordRequiredBeforeExecution', '$.rollbackPlanBoundary.rollbackPlanBoundary', 'audit-record-not-required', blockers);

  checkRequiredTrue(rollbackPlanBoundary, 'rollbackPlanRequiredBeforeExecution', '$.rollbackPlanBoundary.rollbackPlanBoundary', 'rollback-plan-not-required', blockers);
  checkRequiredTrue(rollbackPlanBoundary, 'writeTokenRequiredBeforeRollback', '$.rollbackPlanBoundary.rollbackPlanBoundary', 'write-token-not-required', blockers);
  checkRequiredTrue(rollbackPlanBoundary, 'executionLeaseRequiredBeforeRollback', '$.rollbackPlanBoundary.rollbackPlanBoundary', 'execution-lease-not-required', blockers);
  checkRequiredTrue(rollbackPlanBoundary, 'artifactBytesRequiredBeforeRollback', '$.rollbackPlanBoundary.rollbackPlanBoundary', 'write-token-not-required', blockers);
  checkRequiredTrue(rollbackPlanBoundary, 'auditBindingRequired', '$.rollbackPlanBoundary.rollbackPlanBoundary', 'write-token-not-required', blockers);
  checkRequiredFalse(rollbackPlanBoundary, 'rollbackPlanCreated', '$.rollbackPlanBoundary.rollbackPlanBoundary', 'rollback-plan-created', blockers);
  checkRequiredFalse(rollbackPlanBoundary, 'rollbackScopeBoundToArtifact', '$.rollbackPlanBoundary.rollbackPlanBoundary', 'rollback-scope-already-bound', blockers);
  checkRequiredFalse(rollbackPlanBoundary, 'rollbackReviewed', '$.rollbackPlanBoundary.rollbackPlanBoundary', 'rollback-review-already-recorded', blockers);
  checkRequiredFalse(rollbackPlanBoundary, 'writeTokenIssued', '$.rollbackPlanBoundary.rollbackPlanBoundary', 'write-token-issued', blockers);
  checkRequiredFalse(rollbackPlanBoundary, 'executionLeaseCreated', '$.rollbackPlanBoundary.rollbackPlanBoundary', 'execution-lease-created', blockers);
  checkRequiredFalse(rollbackPlanBoundary, 'artifactBytesProvided', '$.rollbackPlanBoundary.rollbackPlanBoundary', 'artifact-bytes-provided', blockers);
  checkRequiredFalse(rollbackPlanBoundary, 'auditBindingCreated', '$.rollbackPlanBoundary.rollbackPlanBoundary', 'audit-binding-created', blockers);
  checkRequiredFalse(rollbackPlanBoundary, 'auditRecordCreated', '$.rollbackPlanBoundary.rollbackPlanBoundary', 'audit-record-created', blockers);
  checkRequiredFalse(rollbackPlanBoundary, 'executable', '$.rollbackPlanBoundary.rollbackPlanBoundary', 'upload-execution-enabled', blockers);

  checkRequiredTrue(remainingExecutionBoundaries, 'artifactBytesRequired', '$.rollbackPlanBoundary.remainingExecutionBoundaries', 'write-token-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'adapterInjectionRequired', '$.rollbackPlanBoundary.remainingExecutionBoundaries', 'write-token-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'writeTokenRequired', '$.rollbackPlanBoundary.remainingExecutionBoundaries', 'write-token-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'executionLeaseRequired', '$.rollbackPlanBoundary.remainingExecutionBoundaries', 'execution-lease-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'rollbackPlanRequired', '$.rollbackPlanBoundary.remainingExecutionBoundaries', 'rollback-plan-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'auditRecordRequired', '$.rollbackPlanBoundary.remainingExecutionBoundaries', 'audit-record-not-required', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'artifactBytesProvided', '$.rollbackPlanBoundary.remainingExecutionBoundaries', 'artifact-bytes-provided', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'adapterInjected', '$.rollbackPlanBoundary.remainingExecutionBoundaries', 'adapter-injected', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'writeTokenIssued', '$.rollbackPlanBoundary.remainingExecutionBoundaries', 'write-token-issued', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'executionLeaseCreated', '$.rollbackPlanBoundary.remainingExecutionBoundaries', 'execution-lease-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'rollbackPlanCreated', '$.rollbackPlanBoundary.remainingExecutionBoundaries', 'rollback-plan-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'auditRecordCreated', '$.rollbackPlanBoundary.remainingExecutionBoundaries', 'audit-record-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'objectWriteAllowed', '$.rollbackPlanBoundary.remainingExecutionBoundaries', 'object-write-attempted', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'metadataIndexWriteAllowed', '$.rollbackPlanBoundary.remainingExecutionBoundaries', 'metadata-index-write-attempted', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'remoteMutationAllowed', '$.rollbackPlanBoundary.remainingExecutionBoundaries', 'remote-mutation-performed', blockers);

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
    target: parsedTarget
  };
}

export function buildKnowledgeTeamUploadAuditRecordBoundary(
  input: KnowledgeTeamUploadAuditRecordBoundaryInput
): KnowledgeTeamUploadAuditRecordBoundary {
  const blockers: KnowledgeTeamUploadAuditRecordBoundaryBlocker[] = [];
  const parsedBoundary = parseRollbackPlanBoundaryForAuditRecordBoundary(input.rollbackPlanBoundary, blockers);
  const status: KnowledgeTeamUploadAuditRecordBoundaryStatus = blockers.length === 0
    ? 'audit-record-boundary-ready'
    : 'blocked';

  return {
    kind: 'infra-agent.knowledge-team-upload-audit-record-boundary',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    boundaryKind: 'audit-record-boundary-dry-run',
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
    sourceRollbackPlanBoundary: {
      source: 'upload-rollback-plan-boundary',
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
      auditRecordRequiredBeforeExecution: parsedBoundary.auditRecordRequiredBeforeExecution
    },
    auditRecordBoundary: {
      dryRunOnly: true,
      auditRecordRequiredBeforeExecution: true,
      auditRecordCreated: false,
      auditScopeBindingRequired: true,
      auditScopeBoundToArtifact: false,
      auditReviewRequired: true,
      auditReviewed: false,
      writeTokenRequiredBeforeAudit: true,
      writeTokenIssued: false,
      executionLeaseRequiredBeforeAudit: true,
      executionLeaseCreated: false,
      rollbackPlanRequiredBeforeAudit: true,
      rollbackPlanCreated: false,
      artifactBytesRequiredBeforeAudit: true,
      artifactBytesProvided: false,
      auditBindingRequired: true,
      auditBindingCreated: false,
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
      nextAction: status === 'audit-record-boundary-ready' ? 'design-artifact-bytes-boundary' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: blockers.map(entry => entry.code),
      blockers,
      reason: status === 'audit-record-boundary-ready'
        ? 'Audit record boundary requirements are modeled, but no audit record is created and upload execution remains disabled until separate artifact-byte, adapter, and mutation boundaries are designed.'
        : 'Audit record boundary planning is blocked until all rollback plan boundary blockers are resolved.'
    }
  };
}
