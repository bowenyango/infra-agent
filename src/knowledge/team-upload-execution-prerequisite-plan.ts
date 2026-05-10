import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadExecutionPrerequisitePlanStatus =
  | 'prerequisite-plan-ready'
  | 'blocked';

export type KnowledgeTeamUploadExecutionPrerequisitePlanNextAction =
  | 'design-write-token-boundary'
  | 'resolve-blockers';

export type KnowledgeTeamUploadExecutionPrerequisitePlanBlockerCode =
  | 'adapter-injected'
  | 'artifact-bytes-provided'
  | 'audit-record-created'
  | 'backend-detail-leak'
  | 'client-created'
  | 'credential-presence-check-enabled'
  | 'credential-values-exposed'
  | 'execution-lease-created'
  | 'invalid-approval-review-kind'
  | 'invalid-review-kind'
  | 'invalid-schema-version'
  | 'live-check-enabled'
  | 'metadata-index-write-attempted'
  | 'missing-required-field'
  | 'mutation-approval-already-granted'
  | 'mutation-approval-not-reviewed'
  | 'mutation-enabled'
  | 'object-write-attempted'
  | 'remote-mutation-performed'
  | 'remote-write-enabled'
  | 'review-fingerprint-missing'
  | 'review-fingerprint-unverified'
  | 'review-next-action-invalid'
  | 'review-not-ready'
  | 'rollback-plan-created'
  | 'scope-not-matched'
  | 'unsupported-adapter-backend'
  | 'unsafe-adapter-name'
  | 'unsafe-artifact-reference'
  | 'upload-approval-already-provided'
  | 'upload-command-present'
  | 'upload-execution-enabled'
  | 'write-token-issued';

export interface KnowledgeTeamUploadExecutionPrerequisitePlanBlocker {
  code: KnowledgeTeamUploadExecutionPrerequisitePlanBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadExecutionPrerequisitePlan {
  kind: 'infra-agent.knowledge-team-upload-execution-prerequisite-plan';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  prerequisitePlanKind: 'execution-prerequisite-boundary-dry-run';
  status: KnowledgeTeamUploadExecutionPrerequisitePlanStatus;
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
  sourceReview: {
    source: 'upload-mutation-approval-review';
    reviewStatus: 'review-ready' | 'blocked' | 'invalid';
    reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
    reviewNextAction: 'plan-execution-prerequisite-boundaries' | 'resolve-blockers' | 'invalid';
    planStatus: 'plan-ready' | 'blocked' | 'invalid';
    planNextAction: 'request-human-mutation-approval' | 'resolve-blockers' | 'invalid';
    gateStatus: 'gate-ready' | 'blocked' | 'invalid';
    scopeMatched: boolean;
    humanReviewRecorded: boolean;
    fingerprintVerified: boolean;
    sourceFingerprintVerified: boolean;
    suppliedFingerprint: string | null;
    expectedFingerprint: string | null;
    adapterName: string | null;
    adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
  };
  prerequisitePlan: {
    humanReviewRequired: true;
    humanReviewRecorded: boolean;
    fingerprintVerified: boolean;
    mutationApprovalRequired: true;
    mutationApprovalGranted: false;
    uploadApproved: false;
    uploadExecutionAllowed: false;
    executionPrerequisitesRequired: true;
    executionAllowed: false;
    nextRequiredBoundary: 'write-token-boundary-design';
  };
  executionBoundary: {
    executable: false;
    dryRunOnly: true;
    artifactBytesRequiredBeforeExecution: true;
    artifactBytesProvided: false;
    adapterInjectionRequiredBeforeExecution: true;
    adapterInjected: false;
    writeTokenRequiredBeforeExecution: true;
    writeTokenIssued: false;
    executionLeaseRequiredBeforeExecution: true;
    executionLeaseCreated: false;
    rollbackPlanRequiredBeforeExecution: true;
    rollbackPlanCreated: false;
    auditRecordRequiredBeforeExecution: true;
    auditRecordCreated: false;
    clientCreated: false;
    credentialValuesRead: false;
    credentialPresenceChecked: false;
    liveCheckPerformed: false;
    uploadCommandGenerated: false;
    objectWriteAttempted: false;
    metadataIndexWriteAttempted: false;
    remoteMutationPerformed: false;
  };
  readiness: {
    status: KnowledgeTeamUploadExecutionPrerequisitePlanStatus;
    nextAction: KnowledgeTeamUploadExecutionPrerequisitePlanNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadExecutionPrerequisitePlanBlockerCode[];
    blockers: KnowledgeTeamUploadExecutionPrerequisitePlanBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadExecutionPrerequisitePlanInput {
  approvalReview: unknown;
}

interface ParsedApprovalReviewForPrerequisitePlan {
  reviewStatus: 'review-ready' | 'blocked' | 'invalid';
  reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
  reviewNextAction: 'plan-execution-prerequisite-boundaries' | 'resolve-blockers' | 'invalid';
  planStatus: 'plan-ready' | 'blocked' | 'invalid';
  planNextAction: 'request-human-mutation-approval' | 'resolve-blockers' | 'invalid';
  gateStatus: 'gate-ready' | 'blocked' | 'invalid';
  scopeMatched: boolean;
  humanReviewRecorded: boolean;
  fingerprintVerified: boolean;
  sourceFingerprintVerified: boolean;
  suppliedFingerprint: string | null;
  expectedFingerprint: string | null;
  adapterName: string | null;
  adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
  target: {
    manifestId: string | null;
    objectKey: string | null;
    objectSha256: string | null;
    artifactId: string | null;
  };
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const SAFE_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|credentialValue|secret|token|password|authorization|header|accessKey|sessionToken|client|clientConfig|signedUrl|putObject|putEntry|fetch|artifactStore)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|secret|token|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;
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
  code: KnowledgeTeamUploadExecutionPrerequisitePlanBlockerCode,
  path: string,
  message: string
): KnowledgeTeamUploadExecutionPrerequisitePlanBlocker {
  return { code, path, message };
}

function pushBlockerOnce(
  blockers: KnowledgeTeamUploadExecutionPrerequisitePlanBlocker[],
  nextBlocker: KnowledgeTeamUploadExecutionPrerequisitePlanBlocker
): void {
  if (!blockers.some(entry => entry.code === nextBlocker.code && entry.path === nextBlocker.path)) {
    blockers.push(nextBlocker);
  }
}

function checkNoPrerequisitePlanLeakage(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadExecutionPrerequisitePlanBlocker[]
): void {
  if (typeof value === 'string') {
    if (FORBIDDEN_LEAK_VALUE_PATTERN.test(value)) {
      pushBlockerOnce(blockers, blocker(
        'backend-detail-leak',
        path,
        'Upload execution prerequisite planning inputs must not expose backend details, credential values, upload commands, or absolute paths.'
      ));
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      checkNoPrerequisitePlanLeakage(entry, `${path}[${index}]`, blockers);
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
        'Upload execution prerequisite planning inputs must not include backend detail or credential fields.'
      ));
      continue;
    }
    checkNoPrerequisitePlanLeakage(nested, nestedPath, blockers);
  }
}

function readBool(value: unknown): boolean {
  return value === true;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readReviewStatus(value: unknown): ParsedApprovalReviewForPrerequisitePlan['reviewStatus'] {
  return value === 'review-ready' || value === 'blocked' ? value : 'invalid';
}

function readReviewKind(value: unknown): ParsedApprovalReviewForPrerequisitePlan['reviewKind'] {
  return value === 'human-fingerprint-dry-run' ? value : 'unsupported';
}

function readReviewNextAction(value: unknown): ParsedApprovalReviewForPrerequisitePlan['reviewNextAction'] {
  if (value === 'plan-execution-prerequisite-boundaries' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readPlanStatus(value: unknown): ParsedApprovalReviewForPrerequisitePlan['planStatus'] {
  return value === 'plan-ready' || value === 'blocked' ? value : 'invalid';
}

function readPlanNextAction(value: unknown): ParsedApprovalReviewForPrerequisitePlan['planNextAction'] {
  if (value === 'request-human-mutation-approval' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readGateStatus(value: unknown): ParsedApprovalReviewForPrerequisitePlan['gateStatus'] {
  return value === 'gate-ready' || value === 'blocked' ? value : 'invalid';
}

function readAdapterBackendKind(value: unknown): ParsedApprovalReviewForPrerequisitePlan['adapterBackendKind'] {
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

function readSafeFingerprint(value: unknown): string | null {
  if (typeof value !== 'string' || !SAFE_FINGERPRINT_PATTERN.test(value)) {
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
  code: KnowledgeTeamUploadExecutionPrerequisitePlanBlockerCode,
  blockers: KnowledgeTeamUploadExecutionPrerequisitePlanBlocker[],
  message = 'Upload execution prerequisite planning requires this mutation or execution field to remain false.'
): void {
  if (record[key] !== undefined && record[key] !== false) {
    pushBlockerOnce(blockers, blocker(code, `${path}.${key}`, message));
  }
}

function checkUploadCommand(
  record: Record<string, unknown>,
  path: string,
  blockers: KnowledgeTeamUploadExecutionPrerequisitePlanBlocker[]
): void {
  if (record.uploadCommand !== undefined && record.uploadCommand !== null) {
    pushBlockerOnce(blockers, blocker(
      'upload-command-present',
      `${path}.uploadCommand`,
      'Upload execution prerequisite planning must not receive upload commands.'
    ));
  }
}

function parseApprovalReviewForPrerequisitePlan(
  value: unknown,
  blockers: KnowledgeTeamUploadExecutionPrerequisitePlanBlocker[]
): ParsedApprovalReviewForPrerequisitePlan {
  checkNoPrerequisitePlanLeakage(value, '$.approvalReview', blockers);

  const invalid: ParsedApprovalReviewForPrerequisitePlan = {
    reviewStatus: 'invalid',
    reviewKind: 'unsupported',
    reviewNextAction: 'invalid',
    planStatus: 'invalid',
    planNextAction: 'invalid',
    gateStatus: 'invalid',
    scopeMatched: false,
    humanReviewRecorded: false,
    fingerprintVerified: false,
    sourceFingerprintVerified: false,
    suppliedFingerprint: null,
    expectedFingerprint: null,
    adapterName: null,
    adapterBackendKind: 'unsupported',
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
      '$.approvalReview',
      'Upload execution prerequisite planning requires an approval-review artifact object.'
    ));
    return invalid;
  }

  if (value.kind !== 'infra-agent.knowledge-team-upload-mutation-approval-review') {
    pushBlockerOnce(blockers, blocker(
      'invalid-approval-review-kind',
      '$.approvalReview.kind',
      'Upload execution prerequisite planning requires an upload mutation approval review artifact.'
    ));
  }
  if (value.schemaVersion !== 1) {
    pushBlockerOnce(blockers, blocker(
      'invalid-schema-version',
      '$.approvalReview.schemaVersion',
      'Upload execution prerequisite planning requires schemaVersion 1.'
    ));
  }
  if (value.reviewKind !== 'human-fingerprint-dry-run') {
    pushBlockerOnce(blockers, blocker(
      'invalid-review-kind',
      '$.approvalReview.reviewKind',
      'Upload execution prerequisite planning requires a human fingerprint dry-run review.'
    ));
  }

  checkFalseField(value, 'mutationAllowed', '$.approvalReview', 'mutation-enabled', blockers);
  checkFalseField(value, 'remoteWriteAllowed', '$.approvalReview', 'remote-write-enabled', blockers);
  checkFalseField(value, 'liveCheckAllowed', '$.approvalReview', 'live-check-enabled', blockers);
  checkFalseField(value, 'credentialValuesExposed', '$.approvalReview', 'credential-values-exposed', blockers);
  checkFalseField(value, 'credentialPresenceChecked', '$.approvalReview', 'credential-presence-check-enabled', blockers);
  checkFalseField(value, 'uploadApproved', '$.approvalReview', 'upload-approval-already-provided', blockers);
  checkFalseField(value, 'uploadExecutionAllowed', '$.approvalReview', 'upload-execution-enabled', blockers);
  checkFalseField(value, 'mutationApprovalGranted', '$.approvalReview', 'mutation-approval-already-granted', blockers);
  checkFalseField(value, 'clientCreated', '$.approvalReview', 'client-created', blockers);
  checkFalseField(value, 'adapterInjected', '$.approvalReview', 'adapter-injected', blockers);
  checkFalseField(value, 'artifactBytesProvided', '$.approvalReview', 'artifact-bytes-provided', blockers);
  checkFalseField(value, 'writeTokenIssued', '$.approvalReview', 'write-token-issued', blockers);
  checkFalseField(value, 'executionLeaseCreated', '$.approvalReview', 'execution-lease-created', blockers);
  checkFalseField(value, 'rollbackPlanCreated', '$.approvalReview', 'rollback-plan-created', blockers);
  checkFalseField(value, 'objectWriteAttempted', '$.approvalReview', 'object-write-attempted', blockers);
  checkFalseField(value, 'metadataIndexWriteAttempted', '$.approvalReview', 'metadata-index-write-attempted', blockers);
  checkFalseField(value, 'remoteMutationPerformed', '$.approvalReview', 'remote-mutation-performed', blockers);
  checkUploadCommand(value, '$.approvalReview', blockers);

  const reviewStatus = readReviewStatus(value.status);
  if (reviewStatus !== 'review-ready') {
    pushBlockerOnce(blockers, blocker(
      'review-not-ready',
      '$.approvalReview.status',
      'Upload execution prerequisite planning requires a review-ready approval review.'
    ));
  }

  const target = isRecord(value.target) ? value.target : {};
  if (!isRecord(value.target)) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-artifact-reference',
      '$.approvalReview.target',
      'Upload execution prerequisite planning requires a safe review target.'
    ));
  }
  const parsedTarget = {
    manifestId: readSafeId(target.manifestId),
    objectKey: readSafeObjectKey(target.objectKey),
    objectSha256: readSafeSha(target.objectSha256),
    artifactId: readSafeId(target.artifactId)
  };
  if (target.manifestId !== undefined && parsedTarget.manifestId === null) {
    pushBlockerOnce(blockers, blocker('unsafe-artifact-reference', '$.approvalReview.target.manifestId', 'Upload execution prerequisite planning requires safe manifest ids.'));
  }
  if (target.objectKey !== undefined && parsedTarget.objectKey === null) {
    pushBlockerOnce(blockers, blocker('unsafe-artifact-reference', '$.approvalReview.target.objectKey', 'Upload execution prerequisite planning requires safe object keys.'));
  }
  if (target.objectSha256 !== undefined && parsedTarget.objectSha256 === null) {
    pushBlockerOnce(blockers, blocker('unsafe-artifact-reference', '$.approvalReview.target.objectSha256', 'Upload execution prerequisite planning requires safe object SHA-256 digests.'));
  }
  if (target.artifactId !== undefined && parsedTarget.artifactId === null) {
    pushBlockerOnce(blockers, blocker('unsafe-artifact-reference', '$.approvalReview.target.artifactId', 'Upload execution prerequisite planning requires safe artifact ids.'));
  }

  const sourcePlan = isRecord(value.sourcePlan) ? value.sourcePlan : {};
  if (!isRecord(value.sourcePlan)) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.approvalReview.sourcePlan',
      'Upload execution prerequisite planning requires source review plan metadata.'
    ));
  }
  const approvalReview = isRecord(value.approvalReview) ? value.approvalReview : {};
  if (!isRecord(value.approvalReview)) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.approvalReview.approvalReview',
      'Upload execution prerequisite planning requires approval review metadata.'
    ));
  }
  const executionBoundary = isRecord(value.executionBoundary) ? value.executionBoundary : {};
  if (!isRecord(value.executionBoundary)) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.approvalReview.executionBoundary',
      'Upload execution prerequisite planning requires execution boundary metadata.'
    ));
  }
  const readiness = isRecord(value.readiness) ? value.readiness : {};
  if (!isRecord(value.readiness)) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.approvalReview.readiness',
      'Upload execution prerequisite planning requires review readiness metadata.'
    ));
  }

  const reviewNextAction = readReviewNextAction(readiness.nextAction);
  if (reviewNextAction !== 'plan-execution-prerequisite-boundaries') {
    pushBlockerOnce(blockers, blocker(
      'review-next-action-invalid',
      '$.approvalReview.readiness.nextAction',
      'Upload execution prerequisite planning requires a review that points to prerequisite boundary planning.'
    ));
  }
  if (readiness.blockerCount !== undefined && readiness.blockerCount !== 0) {
    pushBlockerOnce(blockers, blocker(
      'review-not-ready',
      '$.approvalReview.readiness.blockerCount',
      'Upload execution prerequisite planning requires review artifacts with no blockers.'
    ));
  }

  const humanReviewRecorded = readBool(approvalReview.humanReviewRecorded);
  const fingerprintVerified = readBool(approvalReview.fingerprintVerified);
  if (!humanReviewRecorded || !fingerprintVerified) {
    pushBlockerOnce(blockers, blocker(
      humanReviewRecorded ? 'review-fingerprint-unverified' : 'mutation-approval-not-reviewed',
      '$.approvalReview.approvalReview',
      'Upload execution prerequisite planning requires a recorded human fingerprint review.'
    ));
  }
  checkFalseField(approvalReview, 'mutationApprovalGranted', '$.approvalReview.approvalReview', 'mutation-approval-already-granted', blockers);
  checkFalseField(approvalReview, 'uploadApproved', '$.approvalReview.approvalReview', 'upload-approval-already-provided', blockers);
  checkFalseField(approvalReview, 'uploadExecutionAllowed', '$.approvalReview.approvalReview', 'upload-execution-enabled', blockers);

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
    checkFalseField(executionBoundary, key, '$.approvalReview.executionBoundary', code, blockers);
  }
  if (executionBoundary.executable !== undefined && executionBoundary.executable !== false) {
    pushBlockerOnce(blockers, blocker(
      'upload-execution-enabled',
      '$.approvalReview.executionBoundary.executable',
      'Upload execution prerequisite planning must not receive executable review records.'
    ));
  }

  const sourceFingerprintVerified = readBool(sourcePlan.sourceFingerprintVerified);
  if (!sourceFingerprintVerified) {
    pushBlockerOnce(blockers, blocker(
      'review-fingerprint-unverified',
      '$.approvalReview.sourcePlan.sourceFingerprintVerified',
      'Upload execution prerequisite planning requires verified source fingerprints.'
    ));
  }

  const scopeMatched = readBool(sourcePlan.scopeMatched);
  if (!scopeMatched) {
    pushBlockerOnce(blockers, blocker(
      'scope-not-matched',
      '$.approvalReview.sourcePlan.scopeMatched',
      'Upload execution prerequisite planning requires matched upload scope.'
    ));
  }

  const adapterBackendKind = readAdapterBackendKind(sourcePlan.adapterBackendKind);
  if (adapterBackendKind !== 'mock-s3-compatible') {
    pushBlockerOnce(blockers, blocker(
      'unsupported-adapter-backend',
      '$.approvalReview.sourcePlan.adapterBackendKind',
      'Upload execution prerequisite planning only accepts mock-s3-compatible source summaries.'
    ));
  }

  const adapterName = readString(sourcePlan.adapterName);
  if (adapterName !== null && !isSafeKnowledgeTeamBackendAdapterName(adapterName)) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-adapter-name',
      '$.approvalReview.sourcePlan.adapterName',
      'Upload execution prerequisite planning requires safe adapter names.'
    ));
  }

  const suppliedFingerprint = readSafeFingerprint(approvalReview.suppliedFingerprint);
  const expectedFingerprint = readSafeFingerprint(approvalReview.expectedFingerprint);
  if (suppliedFingerprint === null || expectedFingerprint === null) {
    pushBlockerOnce(blockers, blocker(
      'review-fingerprint-missing',
      '$.approvalReview.approvalReview',
      'Upload execution prerequisite planning requires safe recorded review fingerprints.'
    ));
  }

  return {
    reviewStatus,
    reviewKind: readReviewKind(value.reviewKind),
    reviewNextAction,
    planStatus: readPlanStatus(sourcePlan.planStatus),
    planNextAction: readPlanNextAction(sourcePlan.planNextAction),
    gateStatus: readGateStatus(sourcePlan.gateStatus),
    scopeMatched,
    humanReviewRecorded,
    fingerprintVerified,
    sourceFingerprintVerified,
    suppliedFingerprint,
    expectedFingerprint,
    adapterName,
    adapterBackendKind,
    target: parsedTarget
  };
}

export function buildKnowledgeTeamUploadExecutionPrerequisitePlan(
  input: KnowledgeTeamUploadExecutionPrerequisitePlanInput
): KnowledgeTeamUploadExecutionPrerequisitePlan {
  const blockers: KnowledgeTeamUploadExecutionPrerequisitePlanBlocker[] = [];
  const parsedReview = parseApprovalReviewForPrerequisitePlan(input.approvalReview, blockers);
  const status: KnowledgeTeamUploadExecutionPrerequisitePlanStatus = blockers.length === 0
    ? 'prerequisite-plan-ready'
    : 'blocked';

  return {
    kind: 'infra-agent.knowledge-team-upload-execution-prerequisite-plan',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    prerequisitePlanKind: 'execution-prerequisite-boundary-dry-run',
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
    target: parsedReview.target,
    sourceReview: {
      source: 'upload-mutation-approval-review',
      reviewStatus: parsedReview.reviewStatus,
      reviewKind: parsedReview.reviewKind,
      reviewNextAction: parsedReview.reviewNextAction,
      planStatus: parsedReview.planStatus,
      planNextAction: parsedReview.planNextAction,
      gateStatus: parsedReview.gateStatus,
      scopeMatched: parsedReview.scopeMatched,
      humanReviewRecorded: parsedReview.humanReviewRecorded,
      fingerprintVerified: parsedReview.fingerprintVerified,
      sourceFingerprintVerified: parsedReview.sourceFingerprintVerified,
      suppliedFingerprint: parsedReview.suppliedFingerprint,
      expectedFingerprint: parsedReview.expectedFingerprint,
      adapterName: parsedReview.adapterName,
      adapterBackendKind: parsedReview.adapterBackendKind
    },
    prerequisitePlan: {
      humanReviewRequired: true,
      humanReviewRecorded: parsedReview.humanReviewRecorded,
      fingerprintVerified: parsedReview.fingerprintVerified,
      mutationApprovalRequired: true,
      mutationApprovalGranted: false,
      uploadApproved: false,
      uploadExecutionAllowed: false,
      executionPrerequisitesRequired: true,
      executionAllowed: false,
      nextRequiredBoundary: 'write-token-boundary-design'
    },
    executionBoundary: {
      executable: false,
      dryRunOnly: true,
      artifactBytesRequiredBeforeExecution: true,
      artifactBytesProvided: false,
      adapterInjectionRequiredBeforeExecution: true,
      adapterInjected: false,
      writeTokenRequiredBeforeExecution: true,
      writeTokenIssued: false,
      executionLeaseRequiredBeforeExecution: true,
      executionLeaseCreated: false,
      rollbackPlanRequiredBeforeExecution: true,
      rollbackPlanCreated: false,
      auditRecordRequiredBeforeExecution: true,
      auditRecordCreated: false,
      clientCreated: false,
      credentialValuesRead: false,
      credentialPresenceChecked: false,
      liveCheckPerformed: false,
      uploadCommandGenerated: false,
      objectWriteAttempted: false,
      metadataIndexWriteAttempted: false,
      remoteMutationPerformed: false
    },
    readiness: {
      status,
      nextAction: status === 'prerequisite-plan-ready' ? 'design-write-token-boundary' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: blockers.map(entry => entry.code),
      blockers,
      reason: status === 'prerequisite-plan-ready'
        ? 'Execution prerequisite boundary plan is ready, but upload execution remains disabled until separate token, lease, rollback, audit, adapter, and artifact-byte boundaries are designed.'
        : 'Execution prerequisite planning is blocked until all review and boundary blockers are resolved.'
    }
  };
}
