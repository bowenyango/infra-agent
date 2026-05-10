import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadWriteTokenBoundaryStatus =
  | 'write-token-boundary-ready'
  | 'blocked';

export type KnowledgeTeamUploadWriteTokenBoundaryNextAction =
  | 'design-execution-lease-boundary'
  | 'resolve-blockers';

export type KnowledgeTeamUploadWriteTokenBoundaryBlockerCode =
  | 'adapter-injected'
  | 'artifact-bytes-provided'
  | 'audit-record-created'
  | 'backend-detail-leak'
  | 'client-created'
  | 'credential-presence-check-enabled'
  | 'credential-values-exposed'
  | 'execution-lease-created'
  | 'invalid-boundary-kind'
  | 'invalid-prerequisite-plan-kind'
  | 'invalid-schema-version'
  | 'live-check-enabled'
  | 'metadata-index-write-attempted'
  | 'missing-required-field'
  | 'mutation-approval-already-granted'
  | 'mutation-approval-not-reviewed'
  | 'mutation-enabled'
  | 'object-write-attempted'
  | 'prerequisite-next-action-invalid'
  | 'prerequisite-plan-not-ready'
  | 'remote-mutation-performed'
  | 'remote-write-enabled'
  | 'review-fingerprint-unverified'
  | 'rollback-plan-created'
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

export interface KnowledgeTeamUploadWriteTokenBoundaryBlocker {
  code: KnowledgeTeamUploadWriteTokenBoundaryBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadWriteTokenBoundary {
  kind: 'infra-agent.knowledge-team-upload-write-token-boundary';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  boundaryKind: 'write-token-boundary-dry-run';
  status: KnowledgeTeamUploadWriteTokenBoundaryStatus;
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
  sourcePrerequisitePlan: {
    source: 'upload-execution-prerequisite-plan';
    prerequisiteStatus: 'prerequisite-plan-ready' | 'blocked' | 'invalid';
    prerequisitePlanKind: 'execution-prerequisite-boundary-dry-run' | 'unsupported';
    prerequisiteNextAction: 'design-write-token-boundary' | 'resolve-blockers' | 'invalid';
    reviewStatus: 'review-ready' | 'blocked' | 'invalid';
    reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
    scopeMatched: boolean;
    humanReviewRecorded: boolean;
    fingerprintVerified: boolean;
    sourceFingerprintVerified: boolean;
    adapterName: string | null;
    adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
    writeTokenRequiredBeforeExecution: boolean;
    artifactBytesRequiredBeforeExecution: boolean;
    adapterInjectionRequiredBeforeExecution: boolean;
    executionLeaseRequiredBeforeExecution: boolean;
    rollbackPlanRequiredBeforeExecution: boolean;
    auditRecordRequiredBeforeExecution: boolean;
  };
  writeTokenBoundary: {
    dryRunOnly: true;
    tokenRequiredBeforeExecution: true;
    tokenIssued: false;
    tokenScopeBindingRequired: true;
    tokenScopeBoundToArtifact: false;
    tokenSingleUseRequired: true;
    singleUseTokenIssued: false;
    tokenExpiryRequired: true;
    tokenExpirySet: false;
    auditBindingRequired: true;
    auditBindingCreated: false;
    executionLeaseRequiredBeforeIssuance: true;
    executionLeaseCreated: false;
    rollbackPlanRequiredBeforeIssuance: true;
    rollbackPlanCreated: false;
    executable: false;
  };
  remainingExecutionBoundaries: {
    artifactBytesRequired: true;
    artifactBytesProvided: false;
    adapterInjectionRequired: true;
    adapterInjected: false;
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
    status: KnowledgeTeamUploadWriteTokenBoundaryStatus;
    nextAction: KnowledgeTeamUploadWriteTokenBoundaryNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadWriteTokenBoundaryBlockerCode[];
    blockers: KnowledgeTeamUploadWriteTokenBoundaryBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadWriteTokenBoundaryInput {
  prerequisitePlan: unknown;
}

interface ParsedPrerequisitePlanForWriteTokenBoundary {
  prerequisiteStatus: 'prerequisite-plan-ready' | 'blocked' | 'invalid';
  prerequisitePlanKind: 'execution-prerequisite-boundary-dry-run' | 'unsupported';
  prerequisiteNextAction: 'design-write-token-boundary' | 'resolve-blockers' | 'invalid';
  reviewStatus: 'review-ready' | 'blocked' | 'invalid';
  reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
  scopeMatched: boolean;
  humanReviewRecorded: boolean;
  fingerprintVerified: boolean;
  sourceFingerprintVerified: boolean;
  adapterName: string | null;
  adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
  writeTokenRequiredBeforeExecution: boolean;
  artifactBytesRequiredBeforeExecution: boolean;
  adapterInjectionRequiredBeforeExecution: boolean;
  executionLeaseRequiredBeforeExecution: boolean;
  rollbackPlanRequiredBeforeExecution: boolean;
  auditRecordRequiredBeforeExecution: boolean;
  target: {
    manifestId: string | null;
    objectKey: string | null;
    objectSha256: string | null;
    artifactId: string | null;
  };
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|credentialValue|secret|token|password|authorization|header|accessKey|sessionToken|client|clientConfig|signedUrl|putObject|putEntry|fetch|artifactStore)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|secret|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;
const SAFE_CONTROL_KEYS = new Set([
  'adapterInjected',
  'adapterInjectionRequiredBeforeExecution',
  'artifactBytesProvided',
  'artifactBytesRequiredBeforeExecution',
  'auditRecordCreated',
  'auditRecordRequiredBeforeExecution',
  'clientCreated',
  'credentialPresenceChecked',
  'credentialValuesExposed',
  'credentialValuesRead',
  'executionLeaseCreated',
  'executionLeaseRequiredBeforeExecution',
  'expectedFingerprint',
  'fingerprintVerified',
  'liveCheckAllowed',
  'liveCheckPerformed',
  'metadataIndexWriteAttempted',
  'nextRequiredBoundary',
  'objectKey',
  'remoteWriteAllowed',
  'rollbackPlanCreated',
  'rollbackPlanRequiredBeforeExecution',
  'suppliedFingerprint',
  'uploadApproved',
  'uploadCommand',
  'uploadCommandGenerated',
  'uploadExecutionAllowed',
  'writeTokenIssued',
  'writeTokenRequiredBeforeExecution'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function blocker(
  code: KnowledgeTeamUploadWriteTokenBoundaryBlockerCode,
  path: string,
  message: string
): KnowledgeTeamUploadWriteTokenBoundaryBlocker {
  return { code, path, message };
}

function pushBlockerOnce(
  blockers: KnowledgeTeamUploadWriteTokenBoundaryBlocker[],
  nextBlocker: KnowledgeTeamUploadWriteTokenBoundaryBlocker
): void {
  if (!blockers.some(entry => entry.code === nextBlocker.code && entry.path === nextBlocker.path)) {
    blockers.push(nextBlocker);
  }
}

function checkNoWriteTokenBoundaryLeakage(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadWriteTokenBoundaryBlocker[]
): void {
  if (typeof value === 'string') {
    if (FORBIDDEN_LEAK_VALUE_PATTERN.test(value)) {
      pushBlockerOnce(blockers, blocker(
        'backend-detail-leak',
        path,
        'Upload write-token boundary inputs must not expose backend details, credential values, upload commands, or absolute paths.'
      ));
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      checkNoWriteTokenBoundaryLeakage(entry, `${path}[${index}]`, blockers);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`;
    if (FORBIDDEN_LEAK_KEY_PATTERN.test(key) && !SAFE_CONTROL_KEYS.has(key)) {
      pushBlockerOnce(blockers, blocker(
        'backend-detail-leak',
        nestedPath,
        'Upload write-token boundary inputs must not include backend detail or credential fields.'
      ));
      continue;
    }
    checkNoWriteTokenBoundaryLeakage(nested, nestedPath, blockers);
  }
}

function readBool(value: unknown): boolean {
  return value === true;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readPrerequisiteStatus(value: unknown): ParsedPrerequisitePlanForWriteTokenBoundary['prerequisiteStatus'] {
  return value === 'prerequisite-plan-ready' || value === 'blocked' ? value : 'invalid';
}

function readPrerequisitePlanKind(value: unknown): ParsedPrerequisitePlanForWriteTokenBoundary['prerequisitePlanKind'] {
  return value === 'execution-prerequisite-boundary-dry-run' ? value : 'unsupported';
}

function readPrerequisiteNextAction(value: unknown): ParsedPrerequisitePlanForWriteTokenBoundary['prerequisiteNextAction'] {
  if (value === 'design-write-token-boundary' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readReviewStatus(value: unknown): ParsedPrerequisitePlanForWriteTokenBoundary['reviewStatus'] {
  return value === 'review-ready' || value === 'blocked' ? value : 'invalid';
}

function readReviewKind(value: unknown): ParsedPrerequisitePlanForWriteTokenBoundary['reviewKind'] {
  return value === 'human-fingerprint-dry-run' ? value : 'unsupported';
}

function readAdapterBackendKind(value: unknown): ParsedPrerequisitePlanForWriteTokenBoundary['adapterBackendKind'] {
  if (value === 'mock-s3-compatible' || value === 's3-compatible') {
    return value;
  }
  return 'unsupported';
}

function readSafeId(value: unknown): string | null {
  if (typeof value !== 'string' || !SAFE_ID_PATTERN.test(value)) {
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

function readSafeSha(value: unknown): string | null {
  if (typeof value !== 'string' || !isKnowledgeTeamArtifactSha256(value)) {
    return null;
  }
  return value;
}

function checkFalseField(
  record: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadWriteTokenBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadWriteTokenBoundaryBlocker[],
  message = 'Upload write-token boundary planning requires this mutation or execution field to remain false.'
): void {
  if (record[key] !== undefined && record[key] !== false) {
    pushBlockerOnce(blockers, blocker(code, `${path}.${key}`, message));
  }
}

function checkUploadCommand(
  record: Record<string, unknown>,
  path: string,
  blockers: KnowledgeTeamUploadWriteTokenBoundaryBlocker[]
): void {
  if (record.uploadCommand !== undefined && record.uploadCommand !== null) {
    pushBlockerOnce(blockers, blocker(
      'upload-command-present',
      `${path}.uploadCommand`,
      'Upload write-token boundary planning must not receive upload commands.'
    ));
  }
}

function checkTokenField(
  record: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadWriteTokenBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadWriteTokenBoundaryBlocker[]
): void {
  if (record[key] !== undefined && record[key] !== false) {
    pushBlockerOnce(blockers, blocker(
      code,
      `${path}.${key}`,
      'Upload write-token boundary planning must not receive issued token state.'
    ));
  }
}

function parsePrerequisitePlanForWriteTokenBoundary(
  value: unknown,
  blockers: KnowledgeTeamUploadWriteTokenBoundaryBlocker[]
): ParsedPrerequisitePlanForWriteTokenBoundary {
  checkNoWriteTokenBoundaryLeakage(value, '$.prerequisitePlan', blockers);

  const invalid: ParsedPrerequisitePlanForWriteTokenBoundary = {
    prerequisiteStatus: 'invalid',
    prerequisitePlanKind: 'unsupported',
    prerequisiteNextAction: 'invalid',
    reviewStatus: 'invalid',
    reviewKind: 'unsupported',
    scopeMatched: false,
    humanReviewRecorded: false,
    fingerprintVerified: false,
    sourceFingerprintVerified: false,
    adapterName: null,
    adapterBackendKind: 'unsupported',
    writeTokenRequiredBeforeExecution: false,
    artifactBytesRequiredBeforeExecution: false,
    adapterInjectionRequiredBeforeExecution: false,
    executionLeaseRequiredBeforeExecution: false,
    rollbackPlanRequiredBeforeExecution: false,
    auditRecordRequiredBeforeExecution: false,
    target: {
      manifestId: null,
      objectKey: null,
      objectSha256: null,
      artifactId: null
    }
  };

  if (!isRecord(value)) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.prerequisitePlan',
      'Upload write-token boundary planning requires an execution prerequisite plan object.'
    ));
    return invalid;
  }

  if (value.kind !== 'infra-agent.knowledge-team-upload-execution-prerequisite-plan') {
    pushBlockerOnce(blockers, blocker(
      'invalid-prerequisite-plan-kind',
      '$.prerequisitePlan.kind',
      'Upload write-token boundary planning requires an upload execution prerequisite plan artifact.'
    ));
  }
  if (value.schemaVersion !== 1) {
    pushBlockerOnce(blockers, blocker(
      'invalid-schema-version',
      '$.prerequisitePlan.schemaVersion',
      'Upload write-token boundary planning requires schemaVersion 1.'
    ));
  }
  if (value.prerequisitePlanKind !== 'execution-prerequisite-boundary-dry-run') {
    pushBlockerOnce(blockers, blocker(
      'invalid-boundary-kind',
      '$.prerequisitePlan.prerequisitePlanKind',
      'Upload write-token boundary planning requires an execution prerequisite boundary dry-run plan.'
    ));
  }

  checkFalseField(value, 'mutationAllowed', '$.prerequisitePlan', 'mutation-enabled', blockers);
  checkFalseField(value, 'remoteWriteAllowed', '$.prerequisitePlan', 'remote-write-enabled', blockers);
  checkFalseField(value, 'liveCheckAllowed', '$.prerequisitePlan', 'live-check-enabled', blockers);
  checkFalseField(value, 'credentialValuesExposed', '$.prerequisitePlan', 'credential-values-exposed', blockers);
  checkFalseField(value, 'credentialPresenceChecked', '$.prerequisitePlan', 'credential-presence-check-enabled', blockers);
  checkFalseField(value, 'uploadApproved', '$.prerequisitePlan', 'upload-approval-already-provided', blockers);
  checkFalseField(value, 'uploadExecutionAllowed', '$.prerequisitePlan', 'upload-execution-enabled', blockers);
  checkFalseField(value, 'mutationApprovalGranted', '$.prerequisitePlan', 'mutation-approval-already-granted', blockers);
  checkFalseField(value, 'clientCreated', '$.prerequisitePlan', 'client-created', blockers);
  checkFalseField(value, 'adapterInjected', '$.prerequisitePlan', 'adapter-injected', blockers);
  checkFalseField(value, 'artifactBytesProvided', '$.prerequisitePlan', 'artifact-bytes-provided', blockers);
  checkFalseField(value, 'writeTokenIssued', '$.prerequisitePlan', 'write-token-issued', blockers);
  checkFalseField(value, 'executionLeaseCreated', '$.prerequisitePlan', 'execution-lease-created', blockers);
  checkFalseField(value, 'rollbackPlanCreated', '$.prerequisitePlan', 'rollback-plan-created', blockers);
  checkFalseField(value, 'auditRecordCreated', '$.prerequisitePlan', 'audit-record-created', blockers);
  checkFalseField(value, 'objectWriteAttempted', '$.prerequisitePlan', 'object-write-attempted', blockers);
  checkFalseField(value, 'metadataIndexWriteAttempted', '$.prerequisitePlan', 'metadata-index-write-attempted', blockers);
  checkFalseField(value, 'remoteMutationPerformed', '$.prerequisitePlan', 'remote-mutation-performed', blockers);
  checkUploadCommand(value, '$.prerequisitePlan', blockers);

  const prerequisiteStatus = readPrerequisiteStatus(value.status);
  if (prerequisiteStatus !== 'prerequisite-plan-ready') {
    pushBlockerOnce(blockers, blocker(
      'prerequisite-plan-not-ready',
      '$.prerequisitePlan.status',
      'Upload write-token boundary planning requires a ready execution prerequisite plan.'
    ));
  }

  const target = isRecord(value.target) ? value.target : {};
  if (!isRecord(value.target)) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-artifact-reference',
      '$.prerequisitePlan.target',
      'Upload write-token boundary planning requires a safe prerequisite target.'
    ));
  }
  const parsedTarget = {
    manifestId: readSafeId(target.manifestId),
    objectKey: readSafeObjectKey(target.objectKey),
    objectSha256: readSafeSha(target.objectSha256),
    artifactId: readSafeId(target.artifactId)
  };
  if (target.manifestId !== undefined && parsedTarget.manifestId === null) {
    pushBlockerOnce(blockers, blocker('unsafe-artifact-reference', '$.prerequisitePlan.target.manifestId', 'Upload write-token boundary planning requires safe manifest ids.'));
  }
  if (target.objectKey !== undefined && parsedTarget.objectKey === null) {
    pushBlockerOnce(blockers, blocker('unsafe-artifact-reference', '$.prerequisitePlan.target.objectKey', 'Upload write-token boundary planning requires safe object keys.'));
  }
  if (target.objectSha256 !== undefined && parsedTarget.objectSha256 === null) {
    pushBlockerOnce(blockers, blocker('unsafe-artifact-reference', '$.prerequisitePlan.target.objectSha256', 'Upload write-token boundary planning requires safe object SHA-256 digests.'));
  }
  if (target.artifactId !== undefined && parsedTarget.artifactId === null) {
    pushBlockerOnce(blockers, blocker('unsafe-artifact-reference', '$.prerequisitePlan.target.artifactId', 'Upload write-token boundary planning requires safe artifact ids.'));
  }

  const sourceReview = isRecord(value.sourceReview) ? value.sourceReview : {};
  if (!isRecord(value.sourceReview)) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.prerequisitePlan.sourceReview',
      'Upload write-token boundary planning requires source review metadata.'
    ));
  }
  const prerequisitePlan = isRecord(value.prerequisitePlan) ? value.prerequisitePlan : {};
  if (!isRecord(value.prerequisitePlan)) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.prerequisitePlan.prerequisitePlan',
      'Upload write-token boundary planning requires prerequisite metadata.'
    ));
  }
  const executionBoundary = isRecord(value.executionBoundary) ? value.executionBoundary : {};
  if (!isRecord(value.executionBoundary)) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.prerequisitePlan.executionBoundary',
      'Upload write-token boundary planning requires execution boundary metadata.'
    ));
  }
  const readiness = isRecord(value.readiness) ? value.readiness : {};
  if (!isRecord(value.readiness)) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.prerequisitePlan.readiness',
      'Upload write-token boundary planning requires readiness metadata.'
    ));
  }

  const prerequisiteNextAction = readPrerequisiteNextAction(readiness.nextAction);
  if (prerequisiteNextAction !== 'design-write-token-boundary') {
    pushBlockerOnce(blockers, blocker(
      'prerequisite-next-action-invalid',
      '$.prerequisitePlan.readiness.nextAction',
      'Upload write-token boundary planning requires the prerequisite plan to point at write-token boundary design.'
    ));
  }
  if (readiness.blockerCount !== undefined && readiness.blockerCount !== 0) {
    pushBlockerOnce(blockers, blocker(
      'prerequisite-plan-not-ready',
      '$.prerequisitePlan.readiness.blockerCount',
      'Upload write-token boundary planning requires prerequisite artifacts with no blockers.'
    ));
  }

  const humanReviewRecorded = readBool(sourceReview.humanReviewRecorded);
  const fingerprintVerified = readBool(sourceReview.fingerprintVerified);
  const sourceFingerprintVerified = readBool(sourceReview.sourceFingerprintVerified);
  const scopeMatched = readBool(sourceReview.scopeMatched);
  if (!humanReviewRecorded) {
    pushBlockerOnce(blockers, blocker(
      'mutation-approval-not-reviewed',
      '$.prerequisitePlan.sourceReview.humanReviewRecorded',
      'Upload write-token boundary planning requires recorded human review.'
    ));
  }
  if (!fingerprintVerified || !sourceFingerprintVerified) {
    pushBlockerOnce(blockers, blocker(
      'review-fingerprint-unverified',
      '$.prerequisitePlan.sourceReview',
      'Upload write-token boundary planning requires verified review and source fingerprints.'
    ));
  }
  if (!scopeMatched) {
    pushBlockerOnce(blockers, blocker(
      'scope-not-matched',
      '$.prerequisitePlan.sourceReview.scopeMatched',
      'Upload write-token boundary planning requires matched upload scope.'
    ));
  }

  const adapterBackendKind = readAdapterBackendKind(sourceReview.adapterBackendKind);
  if (adapterBackendKind !== 'mock-s3-compatible') {
    pushBlockerOnce(blockers, blocker(
      'unsupported-adapter-backend',
      '$.prerequisitePlan.sourceReview.adapterBackendKind',
      'Upload write-token boundary planning only accepts mock-s3-compatible source summaries.'
    ));
  }

  const adapterName = readString(sourceReview.adapterName);
  if (adapterName !== null && !isSafeKnowledgeTeamBackendAdapterName(adapterName)) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-adapter-name',
      '$.prerequisitePlan.sourceReview.adapterName',
      'Upload write-token boundary planning requires safe adapter names.'
    ));
  }

  checkFalseField(prerequisitePlan, 'mutationApprovalGranted', '$.prerequisitePlan.prerequisitePlan', 'mutation-approval-already-granted', blockers);
  checkFalseField(prerequisitePlan, 'uploadApproved', '$.prerequisitePlan.prerequisitePlan', 'upload-approval-already-provided', blockers);
  checkFalseField(prerequisitePlan, 'uploadExecutionAllowed', '$.prerequisitePlan.prerequisitePlan', 'upload-execution-enabled', blockers);
  checkFalseField(prerequisitePlan, 'executionAllowed', '$.prerequisitePlan.prerequisitePlan', 'upload-execution-enabled', blockers);

  const requiredBoundaryFields = [
    'artifactBytesRequiredBeforeExecution',
    'adapterInjectionRequiredBeforeExecution',
    'writeTokenRequiredBeforeExecution',
    'executionLeaseRequiredBeforeExecution',
    'rollbackPlanRequiredBeforeExecution',
    'auditRecordRequiredBeforeExecution'
  ] as const;
  for (const key of requiredBoundaryFields) {
    if (executionBoundary[key] !== true) {
      pushBlockerOnce(blockers, blocker(
        key === 'writeTokenRequiredBeforeExecution' ? 'write-token-not-required' : 'missing-required-field',
        `$.prerequisitePlan.executionBoundary.${key}`,
        'Upload write-token boundary planning requires all execution prerequisites to remain required.'
      ));
    }
  }

  for (const [key, code] of [
    ['artifactBytesProvided', 'artifact-bytes-provided'],
    ['adapterInjected', 'adapter-injected'],
    ['writeTokenIssued', 'write-token-issued'],
    ['executionLeaseCreated', 'execution-lease-created'],
    ['rollbackPlanCreated', 'rollback-plan-created'],
    ['auditRecordCreated', 'audit-record-created'],
    ['clientCreated', 'client-created'],
    ['credentialValuesRead', 'credential-values-exposed'],
    ['credentialPresenceChecked', 'credential-presence-check-enabled'],
    ['liveCheckPerformed', 'live-check-enabled'],
    ['uploadCommandGenerated', 'upload-command-present'],
    ['objectWriteAttempted', 'object-write-attempted'],
    ['metadataIndexWriteAttempted', 'metadata-index-write-attempted'],
    ['remoteMutationPerformed', 'remote-mutation-performed']
  ] as const) {
    checkFalseField(executionBoundary, key, '$.prerequisitePlan.executionBoundary', code, blockers);
  }
  if (executionBoundary.executable !== undefined && executionBoundary.executable !== false) {
    pushBlockerOnce(blockers, blocker(
      'upload-execution-enabled',
      '$.prerequisitePlan.executionBoundary.executable',
      'Upload write-token boundary planning must not receive executable prerequisite records.'
    ));
  }

  const incomingWriteTokenBoundary = isRecord(value.writeTokenBoundary) ? value.writeTokenBoundary : {};
  checkTokenField(incomingWriteTokenBoundary, 'tokenIssued', '$.prerequisitePlan.writeTokenBoundary', 'write-token-issued', blockers);
  checkTokenField(incomingWriteTokenBoundary, 'tokenScopeBoundToArtifact', '$.prerequisitePlan.writeTokenBoundary', 'token-scope-already-bound', blockers);
  checkTokenField(incomingWriteTokenBoundary, 'tokenExpirySet', '$.prerequisitePlan.writeTokenBoundary', 'token-expiry-already-set', blockers);
  checkTokenField(incomingWriteTokenBoundary, 'singleUseTokenIssued', '$.prerequisitePlan.writeTokenBoundary', 'write-token-issued', blockers);

  return {
    prerequisiteStatus,
    prerequisitePlanKind: readPrerequisitePlanKind(value.prerequisitePlanKind),
    prerequisiteNextAction,
    reviewStatus: readReviewStatus(sourceReview.reviewStatus),
    reviewKind: readReviewKind(sourceReview.reviewKind),
    scopeMatched,
    humanReviewRecorded,
    fingerprintVerified,
    sourceFingerprintVerified,
    adapterName,
    adapterBackendKind,
    writeTokenRequiredBeforeExecution: readBool(executionBoundary.writeTokenRequiredBeforeExecution),
    artifactBytesRequiredBeforeExecution: readBool(executionBoundary.artifactBytesRequiredBeforeExecution),
    adapterInjectionRequiredBeforeExecution: readBool(executionBoundary.adapterInjectionRequiredBeforeExecution),
    executionLeaseRequiredBeforeExecution: readBool(executionBoundary.executionLeaseRequiredBeforeExecution),
    rollbackPlanRequiredBeforeExecution: readBool(executionBoundary.rollbackPlanRequiredBeforeExecution),
    auditRecordRequiredBeforeExecution: readBool(executionBoundary.auditRecordRequiredBeforeExecution),
    target: parsedTarget
  };
}

export function buildKnowledgeTeamUploadWriteTokenBoundary(
  input: KnowledgeTeamUploadWriteTokenBoundaryInput
): KnowledgeTeamUploadWriteTokenBoundary {
  const blockers: KnowledgeTeamUploadWriteTokenBoundaryBlocker[] = [];
  const parsedPlan = parsePrerequisitePlanForWriteTokenBoundary(input.prerequisitePlan, blockers);
  const status: KnowledgeTeamUploadWriteTokenBoundaryStatus = blockers.length === 0
    ? 'write-token-boundary-ready'
    : 'blocked';

  return {
    kind: 'infra-agent.knowledge-team-upload-write-token-boundary',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    boundaryKind: 'write-token-boundary-dry-run',
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
    target: parsedPlan.target,
    sourcePrerequisitePlan: {
      source: 'upload-execution-prerequisite-plan',
      prerequisiteStatus: parsedPlan.prerequisiteStatus,
      prerequisitePlanKind: parsedPlan.prerequisitePlanKind,
      prerequisiteNextAction: parsedPlan.prerequisiteNextAction,
      reviewStatus: parsedPlan.reviewStatus,
      reviewKind: parsedPlan.reviewKind,
      scopeMatched: parsedPlan.scopeMatched,
      humanReviewRecorded: parsedPlan.humanReviewRecorded,
      fingerprintVerified: parsedPlan.fingerprintVerified,
      sourceFingerprintVerified: parsedPlan.sourceFingerprintVerified,
      adapterName: parsedPlan.adapterName,
      adapterBackendKind: parsedPlan.adapterBackendKind,
      writeTokenRequiredBeforeExecution: parsedPlan.writeTokenRequiredBeforeExecution,
      artifactBytesRequiredBeforeExecution: parsedPlan.artifactBytesRequiredBeforeExecution,
      adapterInjectionRequiredBeforeExecution: parsedPlan.adapterInjectionRequiredBeforeExecution,
      executionLeaseRequiredBeforeExecution: parsedPlan.executionLeaseRequiredBeforeExecution,
      rollbackPlanRequiredBeforeExecution: parsedPlan.rollbackPlanRequiredBeforeExecution,
      auditRecordRequiredBeforeExecution: parsedPlan.auditRecordRequiredBeforeExecution
    },
    writeTokenBoundary: {
      dryRunOnly: true,
      tokenRequiredBeforeExecution: true,
      tokenIssued: false,
      tokenScopeBindingRequired: true,
      tokenScopeBoundToArtifact: false,
      tokenSingleUseRequired: true,
      singleUseTokenIssued: false,
      tokenExpiryRequired: true,
      tokenExpirySet: false,
      auditBindingRequired: true,
      auditBindingCreated: false,
      executionLeaseRequiredBeforeIssuance: true,
      executionLeaseCreated: false,
      rollbackPlanRequiredBeforeIssuance: true,
      rollbackPlanCreated: false,
      executable: false
    },
    remainingExecutionBoundaries: {
      artifactBytesRequired: true,
      artifactBytesProvided: false,
      adapterInjectionRequired: true,
      adapterInjected: false,
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
      nextAction: status === 'write-token-boundary-ready' ? 'design-execution-lease-boundary' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: blockers.map(entry => entry.code),
      blockers,
      reason: status === 'write-token-boundary-ready'
        ? 'Write-token boundary requirements are modeled, but no token is issued and upload execution remains disabled until separate lease, rollback, audit, adapter, artifact-byte, and mutation boundaries are designed.'
        : 'Write-token boundary planning is blocked until all prerequisite and boundary blockers are resolved.'
    }
  };
}
