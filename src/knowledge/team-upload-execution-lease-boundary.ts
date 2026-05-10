import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadExecutionLeaseBoundaryStatus =
  | 'execution-lease-boundary-ready'
  | 'blocked';

export type KnowledgeTeamUploadExecutionLeaseBoundaryNextAction =
  | 'design-rollback-plan-boundary'
  | 'resolve-blockers';

export type KnowledgeTeamUploadExecutionLeaseBoundaryBlockerCode =
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
  | 'invalid-schema-version'
  | 'invalid-write-token-boundary-kind'
  | 'lease-expiry-already-set'
  | 'lease-scope-already-bound'
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
  | 'scope-not-matched'
  | 'token-boundary-next-action-invalid'
  | 'token-boundary-not-ready'
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

export interface KnowledgeTeamUploadExecutionLeaseBoundaryBlocker {
  code: KnowledgeTeamUploadExecutionLeaseBoundaryBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadExecutionLeaseBoundary {
  kind: 'infra-agent.knowledge-team-upload-execution-lease-boundary';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  boundaryKind: 'execution-lease-boundary-dry-run';
  status: KnowledgeTeamUploadExecutionLeaseBoundaryStatus;
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
  sourceWriteTokenBoundary: {
    source: 'upload-write-token-boundary';
    boundaryStatus: 'write-token-boundary-ready' | 'blocked' | 'invalid';
    boundaryKind: 'write-token-boundary-dry-run' | 'unsupported';
    boundaryNextAction: 'design-execution-lease-boundary' | 'resolve-blockers' | 'invalid';
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
    auditBindingRequired: boolean;
    executionLeaseRequiredBeforeIssuance: boolean;
    rollbackPlanRequiredBeforeIssuance: boolean;
  };
  executionLeaseBoundary: {
    dryRunOnly: true;
    executionLeaseRequiredBeforeExecution: true;
    executionLeaseCreated: false;
    leaseScopeBindingRequired: true;
    leaseScopeBoundToArtifact: false;
    leaseSingleUseRequired: true;
    singleUseLeaseCreated: false;
    leaseExpiryRequired: true;
    leaseExpirySet: false;
    writeTokenRequiredBeforeLease: true;
    writeTokenIssued: false;
    auditBindingRequired: true;
    auditBindingCreated: false;
    rollbackPlanRequiredBeforeExecution: true;
    rollbackPlanCreated: false;
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
    status: KnowledgeTeamUploadExecutionLeaseBoundaryStatus;
    nextAction: KnowledgeTeamUploadExecutionLeaseBoundaryNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadExecutionLeaseBoundaryBlockerCode[];
    blockers: KnowledgeTeamUploadExecutionLeaseBoundaryBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadExecutionLeaseBoundaryInput {
  writeTokenBoundary: unknown;
}

interface ParsedWriteTokenBoundaryForExecutionLeaseBoundary {
  boundaryStatus: 'write-token-boundary-ready' | 'blocked' | 'invalid';
  boundaryKind: 'write-token-boundary-dry-run' | 'unsupported';
  boundaryNextAction: 'design-execution-lease-boundary' | 'resolve-blockers' | 'invalid';
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
  auditBindingRequired: boolean;
  executionLeaseRequiredBeforeIssuance: boolean;
  rollbackPlanRequiredBeforeIssuance: boolean;
  target: {
    manifestId: string | null;
    objectKey: string | null;
    objectSha256: string | null;
    artifactId: string | null;
  };
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|credentialValue|secret|password|authorization|header|accessKey|sessionToken|client|clientConfig|signedUrl|putObject|putEntry|fetch|artifactStore|tokenValue|tokenMaterial|leaseValue|leaseMaterial)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|secret|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBool(value: unknown): boolean {
  return value === true;
}

function readBoundaryStatus(value: unknown): ParsedWriteTokenBoundaryForExecutionLeaseBoundary['boundaryStatus'] {
  if (value === 'write-token-boundary-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readBoundaryKind(value: unknown): ParsedWriteTokenBoundaryForExecutionLeaseBoundary['boundaryKind'] {
  if (value === 'write-token-boundary-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readBoundaryNextAction(value: unknown): ParsedWriteTokenBoundaryForExecutionLeaseBoundary['boundaryNextAction'] {
  if (value === 'design-execution-lease-boundary' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readReviewStatus(value: unknown): ParsedWriteTokenBoundaryForExecutionLeaseBoundary['reviewStatus'] {
  if (value === 'review-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readReviewKind(value: unknown): ParsedWriteTokenBoundaryForExecutionLeaseBoundary['reviewKind'] {
  if (value === 'human-fingerprint-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readAdapterBackendKind(value: unknown): ParsedWriteTokenBoundaryForExecutionLeaseBoundary['adapterBackendKind'] {
  if (value === 'mock-s3-compatible' || value === 's3-compatible') {
    return value;
  }
  return 'unsupported';
}

function addBlocker(
  blockers: KnowledgeTeamUploadExecutionLeaseBoundaryBlocker[],
  code: KnowledgeTeamUploadExecutionLeaseBoundaryBlockerCode,
  path: string,
  message: string
): void {
  blockers.push({ code, path, message });
}

function scanForPrivateDetails(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadExecutionLeaseBoundaryBlocker[]
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
        'Execution lease boundary input must not contain backend details, private paths, credentials, commands, or token/lease material.'
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
        'Execution lease boundary input must not contain backend details, credential fields, SDK/client fields, commands, or token/lease material.'
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
  blockers: KnowledgeTeamUploadExecutionLeaseBoundaryBlocker[]
): ParsedWriteTokenBoundaryForExecutionLeaseBoundary['target'] {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.writeTokenBoundary.target', 'Execution lease boundary planning requires a target object.');
    addBlocker(blockers, 'unsafe-artifact-reference', '$.writeTokenBoundary.target', 'Execution lease boundary planning requires safe target references.');
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
    addBlocker(blockers, 'unsafe-artifact-reference', '$.writeTokenBoundary.target', 'Execution lease boundary planning requires safe manifest, object, hash, and artifact references.');
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
  code: KnowledgeTeamUploadExecutionLeaseBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadExecutionLeaseBoundaryBlocker[]
): void {
  if (value[key] === true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must remain false for execution lease boundary planning.`);
  }
}

function checkNullCommand(
  value: Record<string, unknown>,
  key: string,
  path: string,
  blockers: KnowledgeTeamUploadExecutionLeaseBoundaryBlocker[]
): void {
  if (value[key] !== null && value[key] !== undefined) {
    addBlocker(blockers, 'upload-command-present', `${path}.${key}`, 'Execution lease boundary planning must not receive upload commands.');
  }
}

function checkRequiredTrue(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadExecutionLeaseBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadExecutionLeaseBoundaryBlocker[]
): boolean {
  if (value[key] !== true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be true before execution lease boundary planning can proceed.`);
    return false;
  }
  return true;
}

function checkRequiredFalse(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadExecutionLeaseBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadExecutionLeaseBoundaryBlocker[]
): boolean {
  if (value[key] !== false) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be false for execution lease boundary planning.`);
    return false;
  }
  return true;
}

function checkCommonExecutionDisabledFields(
  value: Record<string, unknown>,
  path: string,
  blockers: KnowledgeTeamUploadExecutionLeaseBoundaryBlocker[]
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

function defaultParsedWriteTokenBoundary(): ParsedWriteTokenBoundaryForExecutionLeaseBoundary {
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
    auditBindingRequired: false,
    executionLeaseRequiredBeforeIssuance: false,
    rollbackPlanRequiredBeforeIssuance: false,
    target: {
      manifestId: null,
      objectKey: null,
      objectSha256: null,
      artifactId: null
    }
  };
}

function parseWriteTokenBoundaryForExecutionLeaseBoundary(
  value: unknown,
  blockers: KnowledgeTeamUploadExecutionLeaseBoundaryBlocker[]
): ParsedWriteTokenBoundaryForExecutionLeaseBoundary {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.writeTokenBoundary', 'Execution lease boundary planning requires a write-token boundary object.');
    return defaultParsedWriteTokenBoundary();
  }

  scanForPrivateDetails(value, '$.writeTokenBoundary', blockers);

  if (value.kind !== 'infra-agent.knowledge-team-upload-write-token-boundary') {
    addBlocker(blockers, 'invalid-write-token-boundary-kind', '$.writeTokenBoundary.kind', 'Execution lease boundary planning requires an upload write-token boundary artifact.');
  }
  if (value.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.writeTokenBoundary.schemaVersion', 'Execution lease boundary planning requires schemaVersion 1.');
  }
  if (value.boundaryKind !== 'write-token-boundary-dry-run') {
    addBlocker(blockers, 'invalid-boundary-kind', '$.writeTokenBoundary.boundaryKind', 'Execution lease boundary planning requires the write-token dry-run boundary kind.');
  }

  checkCommonExecutionDisabledFields(value, '$.writeTokenBoundary', blockers);

  const boundaryStatus = readBoundaryStatus(value.status);
  if (boundaryStatus !== 'write-token-boundary-ready') {
    addBlocker(blockers, 'token-boundary-not-ready', '$.writeTokenBoundary.status', 'Execution lease boundary planning requires a ready write-token boundary.');
  }

  const readiness = isRecord(value.readiness) ? value.readiness : {};
  if (!isRecord(value.readiness)) {
    addBlocker(blockers, 'missing-required-field', '$.writeTokenBoundary.readiness', 'Execution lease boundary planning requires write-token readiness.');
  }
  const boundaryNextAction = readBoundaryNextAction(readiness.nextAction);
  if (boundaryNextAction !== 'design-execution-lease-boundary') {
    addBlocker(blockers, 'token-boundary-next-action-invalid', '$.writeTokenBoundary.readiness.nextAction', 'Execution lease boundary planning requires the write-token boundary to advance to execution lease design.');
  }
  if (typeof readiness.blockerCount === 'number' && readiness.blockerCount !== 0) {
    addBlocker(blockers, 'token-boundary-not-ready', '$.writeTokenBoundary.readiness.blockerCount', 'Execution lease boundary planning requires zero write-token blockers.');
  }

  const parsedTarget = parseTarget(value.target, blockers);
  const sourcePrerequisitePlan = isRecord(value.sourcePrerequisitePlan) ? value.sourcePrerequisitePlan : {};
  const writeTokenBoundary = isRecord(value.writeTokenBoundary) ? value.writeTokenBoundary : {};
  const remainingExecutionBoundaries = isRecord(value.remainingExecutionBoundaries) ? value.remainingExecutionBoundaries : {};

  if (!isRecord(value.sourcePrerequisitePlan)) {
    addBlocker(blockers, 'missing-required-field', '$.writeTokenBoundary.sourcePrerequisitePlan', 'Execution lease boundary planning requires source prerequisite plan summary.');
  }
  if (!isRecord(value.writeTokenBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.writeTokenBoundary.writeTokenBoundary', 'Execution lease boundary planning requires write-token boundary details.');
  }
  if (!isRecord(value.remainingExecutionBoundaries)) {
    addBlocker(blockers, 'missing-required-field', '$.writeTokenBoundary.remainingExecutionBoundaries', 'Execution lease boundary planning requires remaining execution boundary details.');
  }

  const reviewStatus = readReviewStatus(sourcePrerequisitePlan.reviewStatus);
  const reviewKind = readReviewKind(sourcePrerequisitePlan.reviewKind);
  const scopeMatched = readBool(sourcePrerequisitePlan.scopeMatched);
  const humanReviewRecorded = readBool(sourcePrerequisitePlan.humanReviewRecorded);
  const fingerprintVerified = readBool(sourcePrerequisitePlan.fingerprintVerified);
  const sourceFingerprintVerified = readBool(sourcePrerequisitePlan.sourceFingerprintVerified);
  const adapterName = typeof sourcePrerequisitePlan.adapterName === 'string'
    && isSafeKnowledgeTeamBackendAdapterName(sourcePrerequisitePlan.adapterName)
    ? sourcePrerequisitePlan.adapterName
    : null;
  const adapterBackendKind = readAdapterBackendKind(sourcePrerequisitePlan.adapterBackendKind);

  if (reviewStatus !== 'review-ready' || reviewKind !== 'human-fingerprint-dry-run' || !humanReviewRecorded || !fingerprintVerified || !sourceFingerprintVerified) {
    addBlocker(blockers, 'review-fingerprint-unverified', '$.writeTokenBoundary.sourcePrerequisitePlan', 'Execution lease boundary planning requires verified prior human review state.');
  }
  if (!scopeMatched) {
    addBlocker(blockers, 'scope-not-matched', '$.writeTokenBoundary.sourcePrerequisitePlan.scopeMatched', 'Execution lease boundary planning requires matched artifact scope.');
  }
  if (adapterName === null && sourcePrerequisitePlan.adapterName !== null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.writeTokenBoundary.sourcePrerequisitePlan.adapterName', 'Execution lease boundary planning requires a safe adapter name.');
  }
  if (adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.writeTokenBoundary.sourcePrerequisitePlan.adapterBackendKind', 'Execution lease boundary planning currently accepts only the mock S3-compatible backend boundary.');
  }

  const tokenRequiredBeforeExecution = checkRequiredTrue(writeTokenBoundary, 'tokenRequiredBeforeExecution', '$.writeTokenBoundary.writeTokenBoundary', 'write-token-not-required', blockers);
  const tokenScopeBindingRequired = checkRequiredTrue(writeTokenBoundary, 'tokenScopeBindingRequired', '$.writeTokenBoundary.writeTokenBoundary', 'write-token-not-required', blockers);
  const tokenSingleUseRequired = checkRequiredTrue(writeTokenBoundary, 'tokenSingleUseRequired', '$.writeTokenBoundary.writeTokenBoundary', 'write-token-not-required', blockers);
  const tokenExpiryRequired = checkRequiredTrue(writeTokenBoundary, 'tokenExpiryRequired', '$.writeTokenBoundary.writeTokenBoundary', 'write-token-not-required', blockers);
  const auditBindingRequired = checkRequiredTrue(writeTokenBoundary, 'auditBindingRequired', '$.writeTokenBoundary.writeTokenBoundary', 'write-token-not-required', blockers);
  const executionLeaseRequiredBeforeIssuance = checkRequiredTrue(writeTokenBoundary, 'executionLeaseRequiredBeforeIssuance', '$.writeTokenBoundary.writeTokenBoundary', 'execution-lease-not-required', blockers);
  const rollbackPlanRequiredBeforeIssuance = checkRequiredTrue(writeTokenBoundary, 'rollbackPlanRequiredBeforeIssuance', '$.writeTokenBoundary.writeTokenBoundary', 'write-token-not-required', blockers);

  checkRequiredFalse(writeTokenBoundary, 'tokenIssued', '$.writeTokenBoundary.writeTokenBoundary', 'write-token-issued', blockers);
  checkRequiredFalse(writeTokenBoundary, 'tokenScopeBoundToArtifact', '$.writeTokenBoundary.writeTokenBoundary', 'token-scope-already-bound', blockers);
  checkRequiredFalse(writeTokenBoundary, 'singleUseTokenIssued', '$.writeTokenBoundary.writeTokenBoundary', 'write-token-issued', blockers);
  checkRequiredFalse(writeTokenBoundary, 'tokenExpirySet', '$.writeTokenBoundary.writeTokenBoundary', 'token-expiry-already-set', blockers);
  checkRequiredFalse(writeTokenBoundary, 'auditBindingCreated', '$.writeTokenBoundary.writeTokenBoundary', 'audit-binding-created', blockers);
  checkRequiredFalse(writeTokenBoundary, 'executionLeaseCreated', '$.writeTokenBoundary.writeTokenBoundary', 'execution-lease-created', blockers);
  checkRequiredFalse(writeTokenBoundary, 'rollbackPlanCreated', '$.writeTokenBoundary.writeTokenBoundary', 'rollback-plan-created', blockers);
  checkRequiredFalse(writeTokenBoundary, 'executable', '$.writeTokenBoundary.writeTokenBoundary', 'upload-execution-enabled', blockers);

  checkRequiredTrue(remainingExecutionBoundaries, 'executionLeaseRequired', '$.writeTokenBoundary.remainingExecutionBoundaries', 'execution-lease-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'rollbackPlanRequired', '$.writeTokenBoundary.remainingExecutionBoundaries', 'write-token-not-required', blockers);
  checkRequiredTrue(remainingExecutionBoundaries, 'auditRecordRequired', '$.writeTokenBoundary.remainingExecutionBoundaries', 'write-token-not-required', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'executionLeaseCreated', '$.writeTokenBoundary.remainingExecutionBoundaries', 'execution-lease-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'rollbackPlanCreated', '$.writeTokenBoundary.remainingExecutionBoundaries', 'rollback-plan-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'auditRecordCreated', '$.writeTokenBoundary.remainingExecutionBoundaries', 'audit-record-created', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'objectWriteAllowed', '$.writeTokenBoundary.remainingExecutionBoundaries', 'object-write-attempted', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'metadataIndexWriteAllowed', '$.writeTokenBoundary.remainingExecutionBoundaries', 'metadata-index-write-attempted', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'remoteMutationAllowed', '$.writeTokenBoundary.remainingExecutionBoundaries', 'remote-mutation-performed', blockers);

  const incomingExecutionLeaseBoundary = isRecord(value.executionLeaseBoundary) ? value.executionLeaseBoundary : {};
  checkFalseField(incomingExecutionLeaseBoundary, 'executionLeaseCreated', '$.writeTokenBoundary.executionLeaseBoundary', 'execution-lease-created', blockers);
  checkFalseField(incomingExecutionLeaseBoundary, 'leaseScopeBoundToArtifact', '$.writeTokenBoundary.executionLeaseBoundary', 'lease-scope-already-bound', blockers);
  checkFalseField(incomingExecutionLeaseBoundary, 'singleUseLeaseCreated', '$.writeTokenBoundary.executionLeaseBoundary', 'execution-lease-created', blockers);
  checkFalseField(incomingExecutionLeaseBoundary, 'leaseExpirySet', '$.writeTokenBoundary.executionLeaseBoundary', 'lease-expiry-already-set', blockers);
  checkFalseField(incomingExecutionLeaseBoundary, 'writeTokenIssued', '$.writeTokenBoundary.executionLeaseBoundary', 'write-token-issued', blockers);
  checkFalseField(incomingExecutionLeaseBoundary, 'auditBindingCreated', '$.writeTokenBoundary.executionLeaseBoundary', 'audit-binding-created', blockers);
  checkFalseField(incomingExecutionLeaseBoundary, 'rollbackPlanCreated', '$.writeTokenBoundary.executionLeaseBoundary', 'rollback-plan-created', blockers);
  checkFalseField(incomingExecutionLeaseBoundary, 'executable', '$.writeTokenBoundary.executionLeaseBoundary', 'upload-execution-enabled', blockers);

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
    auditBindingRequired,
    executionLeaseRequiredBeforeIssuance,
    rollbackPlanRequiredBeforeIssuance,
    target: parsedTarget
  };
}

export function buildKnowledgeTeamUploadExecutionLeaseBoundary(
  input: KnowledgeTeamUploadExecutionLeaseBoundaryInput
): KnowledgeTeamUploadExecutionLeaseBoundary {
  const blockers: KnowledgeTeamUploadExecutionLeaseBoundaryBlocker[] = [];
  const parsedBoundary = parseWriteTokenBoundaryForExecutionLeaseBoundary(input.writeTokenBoundary, blockers);
  const status: KnowledgeTeamUploadExecutionLeaseBoundaryStatus = blockers.length === 0
    ? 'execution-lease-boundary-ready'
    : 'blocked';

  return {
    kind: 'infra-agent.knowledge-team-upload-execution-lease-boundary',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    boundaryKind: 'execution-lease-boundary-dry-run',
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
    sourceWriteTokenBoundary: {
      source: 'upload-write-token-boundary',
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
      auditBindingRequired: parsedBoundary.auditBindingRequired,
      executionLeaseRequiredBeforeIssuance: parsedBoundary.executionLeaseRequiredBeforeIssuance,
      rollbackPlanRequiredBeforeIssuance: parsedBoundary.rollbackPlanRequiredBeforeIssuance
    },
    executionLeaseBoundary: {
      dryRunOnly: true,
      executionLeaseRequiredBeforeExecution: true,
      executionLeaseCreated: false,
      leaseScopeBindingRequired: true,
      leaseScopeBoundToArtifact: false,
      leaseSingleUseRequired: true,
      singleUseLeaseCreated: false,
      leaseExpiryRequired: true,
      leaseExpirySet: false,
      writeTokenRequiredBeforeLease: true,
      writeTokenIssued: false,
      auditBindingRequired: true,
      auditBindingCreated: false,
      rollbackPlanRequiredBeforeExecution: true,
      rollbackPlanCreated: false,
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
      nextAction: status === 'execution-lease-boundary-ready' ? 'design-rollback-plan-boundary' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: blockers.map(entry => entry.code),
      blockers,
      reason: status === 'execution-lease-boundary-ready'
        ? 'Execution lease boundary requirements are modeled, but no lease is created and upload execution remains disabled until separate rollback, audit, adapter, artifact-byte, and mutation boundaries are designed.'
        : 'Execution lease boundary planning is blocked until all write-token and lease boundary blockers are resolved.'
    }
  };
}
