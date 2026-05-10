import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadMutationApprovalReviewStatus =
  | 'review-ready'
  | 'blocked';

export type KnowledgeTeamUploadMutationApprovalReviewNextAction =
  | 'plan-execution-prerequisite-boundaries'
  | 'resolve-blockers';

export type KnowledgeTeamUploadMutationApprovalReviewBlockerCode =
  | 'adapter-injected'
  | 'artifact-bytes-provided'
  | 'backend-detail-leak'
  | 'client-created'
  | 'credential-presence-check-enabled'
  | 'credential-values-exposed'
  | 'execution-lease-created'
  | 'invalid-mutation-plan-kind'
  | 'invalid-plan-kind'
  | 'invalid-schema-version'
  | 'live-check-enabled'
  | 'metadata-index-write-attempted'
  | 'missing-required-field'
  | 'mock-harness-not-ready'
  | 'mutation-approval-already-granted'
  | 'mutation-plan-not-ready'
  | 'mutation-enabled'
  | 'object-write-attempted'
  | 'plan-fingerprint-mismatch'
  | 'plan-fingerprint-missing'
  | 'remote-mutation-performed'
  | 'remote-write-enabled'
  | 'review-fingerprint-mismatch'
  | 'review-fingerprint-missing'
  | 'rollback-plan-created'
  | 'scope-not-matched'
  | 'unsupported-adapter-backend'
  | 'unsafe-adapter-name'
  | 'unsafe-artifact-reference'
  | 'unsafe-review-fingerprint'
  | 'upload-approval-already-provided'
  | 'upload-command-present'
  | 'upload-execution-enabled'
  | 'write-token-issued';

export interface KnowledgeTeamUploadMutationApprovalReviewBlocker {
  code: KnowledgeTeamUploadMutationApprovalReviewBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadMutationApprovalReview {
  kind: 'infra-agent.knowledge-team-upload-mutation-approval-review';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  reviewKind: 'human-fingerprint-dry-run';
  status: KnowledgeTeamUploadMutationApprovalReviewStatus;
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
  sourcePlan: {
    source: 'upload-mutation-plan';
    planStatus: 'plan-ready' | 'blocked' | 'invalid';
    planKind: 'approval-audit-dry-run' | 'unsupported';
    planNextAction: 'request-human-mutation-approval' | 'resolve-blockers' | 'invalid';
    gateStatus: 'gate-ready' | 'blocked' | 'invalid';
    gateKind: 'approval-gated-dry-run' | 'unsupported';
    scopeMatched: boolean;
    continuationStatus: 'continuation-ready' | 'blocked' | 'invalid';
    approvalProvided: boolean;
    sourceFingerprintVerified: boolean;
    mockHarnessStatus: 'harness-ready' | 'blocked' | 'invalid';
    mockHarnessKind: 'in-memory-mock' | 'unsupported';
    mockAdapterInstantiated: boolean;
    adapterName: string | null;
    adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
    approvalFingerprint: {
      algorithm: 'sha256';
      scope: 'stage-knowledge-pack-mutation-plan-v1' | 'unsupported';
      value: string | null;
      canonicalFieldCount: number | null;
    };
  };
  approvalReview: {
    mutationApprovalRequired: true;
    humanReviewRequired: true;
    humanReviewRecorded: boolean;
    source: 'cli-flag' | null;
    suppliedFingerprint: string | null;
    expectedFingerprint: string | null;
    fingerprintVerified: boolean;
    mutationApprovalGranted: false;
    uploadApproved: false;
    uploadExecutionAllowed: false;
  };
  executionBoundary: {
    executable: false;
    dryRunOnly: true;
    artifactBytesProvided: false;
    adapterInjected: false;
    writeTokenIssued: false;
    executionLeaseCreated: false;
    rollbackPlanCreated: false;
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
    status: KnowledgeTeamUploadMutationApprovalReviewStatus;
    nextAction: KnowledgeTeamUploadMutationApprovalReviewNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadMutationApprovalReviewBlockerCode[];
    blockers: KnowledgeTeamUploadMutationApprovalReviewBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadMutationApprovalReviewInput {
  mutationPlan: unknown;
  approvalFingerprint: unknown;
}

interface ParsedMutationPlanForApprovalReview {
  planStatus: 'plan-ready' | 'blocked' | 'invalid';
  planKind: 'approval-audit-dry-run' | 'unsupported';
  planNextAction: 'request-human-mutation-approval' | 'resolve-blockers' | 'invalid';
  gateStatus: 'gate-ready' | 'blocked' | 'invalid';
  gateKind: 'approval-gated-dry-run' | 'unsupported';
  scopeMatched: boolean;
  continuationStatus: 'continuation-ready' | 'blocked' | 'invalid';
  approvalProvided: boolean;
  sourceFingerprintVerified: boolean;
  mockHarnessStatus: 'harness-ready' | 'blocked' | 'invalid';
  mockHarnessKind: 'in-memory-mock' | 'unsupported';
  mockAdapterInstantiated: boolean;
  adapterName: string | null;
  adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
  expectedFingerprint: string | null;
  fingerprintScope: 'stage-knowledge-pack-mutation-plan-v1' | 'unsupported';
  fingerprintCanonicalFieldCount: number | null;
  target: {
    manifestId: string | null;
    objectKey: string | null;
    objectSha256: string | null;
    artifactId: string | null;
  };
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const SAFE_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const MUTATION_PLAN_FINGERPRINT_FIELD_COUNT = 12;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|credentialValue|secret|token|password|authorization|header|accessKey|sessionToken|client|clientConfig|signedUrl|putObject|putEntry|fetch|artifactStore)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|secret|token|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;
const SAFE_CONTROL_KEYS = new Set([
  'adapterInjected',
  'artifactBytesProvided',
  'clientCreated',
  'credentialPresenceChecked',
  'credentialValuesExposed',
  'credentialValuesRead',
  'executionLeaseCreated',
  'expectedFingerprint',
  'fingerprintVerified',
  'liveCheckAllowed',
  'liveCheckPerformed',
  'metadataIndexWriteAttempted',
  'objectKey',
  'remoteWriteAllowed',
  'rollbackPlanCreated',
  'suppliedFingerprint',
  'uploadApproved',
  'uploadCommand',
  'uploadCommandGenerated',
  'uploadExecutionAllowed',
  'writeTokenRequiredBeforeExecution',
  'writeTokenIssued'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function blocker(
  code: KnowledgeTeamUploadMutationApprovalReviewBlockerCode,
  path: string,
  message: string
): KnowledgeTeamUploadMutationApprovalReviewBlocker {
  return { code, path, message };
}

function pushBlockerOnce(
  blockers: KnowledgeTeamUploadMutationApprovalReviewBlocker[],
  nextBlocker: KnowledgeTeamUploadMutationApprovalReviewBlocker
): void {
  if (!blockers.some(entry => entry.code === nextBlocker.code && entry.path === nextBlocker.path)) {
    blockers.push(nextBlocker);
  }
}

function checkNoApprovalReviewLeakage(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadMutationApprovalReviewBlocker[]
): void {
  if (typeof value === 'string') {
    if (FORBIDDEN_LEAK_VALUE_PATTERN.test(value)) {
      pushBlockerOnce(blockers, blocker(
        'backend-detail-leak',
        path,
        'Upload mutation approval review inputs must not expose backend details, credential values, upload commands, or absolute paths.'
      ));
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      checkNoApprovalReviewLeakage(entry, `${path}[${index}]`, blockers);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    if (!SAFE_CONTROL_KEYS.has(key) && FORBIDDEN_LEAK_KEY_PATTERN.test(key)) {
      pushBlockerOnce(blockers, blocker(
        'backend-detail-leak',
        entryPath,
        'Upload mutation approval review inputs must not include backend detail or credential fields.'
      ));
    }
    checkNoApprovalReviewLeakage(entry, entryPath, blockers);
  }
}

function readSafeId(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadMutationApprovalReviewBlocker[]
): string | null {
  if (typeof value !== 'string' || !SAFE_ID_PATTERN.test(value)) {
    pushBlockerOnce(blockers, blocker(
      typeof value === 'string' ? 'unsafe-artifact-reference' : 'missing-required-field',
      path,
      'Upload mutation approval review requires safe artifact identifiers.'
    ));
    return null;
  }
  return value;
}

function readSafeSha256(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadMutationApprovalReviewBlocker[]
): string | null {
  if (typeof value !== 'string' || !isKnowledgeTeamArtifactSha256(value)) {
    pushBlockerOnce(blockers, blocker(
      typeof value === 'string' ? 'unsafe-artifact-reference' : 'missing-required-field',
      path,
      'Upload mutation approval review requires a safe artifact SHA-256 digest.'
    ));
    return null;
  }
  return value;
}

function readSafeObjectKey(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadMutationApprovalReviewBlocker[]
): string | null {
  if (typeof value !== 'string' || !isSafeKnowledgeTeamArtifactObjectKey(value)) {
    pushBlockerOnce(blockers, blocker(
      typeof value === 'string' ? 'unsafe-artifact-reference' : 'missing-required-field',
      path,
      'Upload mutation approval review requires a safe artifact object key.'
    ));
    return null;
  }
  return value;
}

function readPlanStatus(value: unknown): ParsedMutationPlanForApprovalReview['planStatus'] {
  return value === 'plan-ready' || value === 'blocked' ? value : 'invalid';
}

function readPlanNextAction(value: unknown): ParsedMutationPlanForApprovalReview['planNextAction'] {
  if (value === 'request-human-mutation-approval' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readGateStatus(value: unknown): ParsedMutationPlanForApprovalReview['gateStatus'] {
  return value === 'gate-ready' || value === 'blocked' || value === 'invalid' ? value : 'invalid';
}

function readGateKind(value: unknown): ParsedMutationPlanForApprovalReview['gateKind'] {
  return value === 'approval-gated-dry-run' ? value : 'unsupported';
}

function readContinuationStatus(value: unknown): ParsedMutationPlanForApprovalReview['continuationStatus'] {
  return value === 'continuation-ready' || value === 'blocked' || value === 'invalid' ? value : 'invalid';
}

function readMockHarnessStatus(value: unknown): ParsedMutationPlanForApprovalReview['mockHarnessStatus'] {
  return value === 'harness-ready' || value === 'blocked' || value === 'invalid' ? value : 'invalid';
}

function readMockHarnessKind(value: unknown): ParsedMutationPlanForApprovalReview['mockHarnessKind'] {
  return value === 'in-memory-mock' ? value : 'unsupported';
}

function readAdapterBackendKind(value: unknown): ParsedMutationPlanForApprovalReview['adapterBackendKind'] {
  return value === 'mock-s3-compatible' || value === 's3-compatible' ? value : 'unsupported';
}

function requireFalse(
  value: unknown,
  path: string,
  code: KnowledgeTeamUploadMutationApprovalReviewBlockerCode,
  blockers: KnowledgeTeamUploadMutationApprovalReviewBlocker[],
  message = 'Upload mutation approval review requires this mutation or execution field to remain false.'
): void {
  if (value !== false) {
    pushBlockerOnce(blockers, blocker(code, path, message));
  }
}

function parseMutationPlanForApprovalReview(
  mutationPlan: unknown,
  blockers: KnowledgeTeamUploadMutationApprovalReviewBlocker[]
): ParsedMutationPlanForApprovalReview {
  if (!isRecord(mutationPlan)) {
    pushBlockerOnce(blockers, blocker(
      'invalid-mutation-plan-kind',
      '$.mutationPlan',
      'Upload mutation approval review requires a mutation-plan artifact object.'
    ));
    return emptyParsedMutationPlan();
  }

  const input = mutationPlan;
  checkNoApprovalReviewLeakage(input, '$.mutationPlan', blockers);

  if (input.kind !== 'infra-agent.knowledge-team-upload-mutation-plan') {
    pushBlockerOnce(blockers, blocker(
      'invalid-mutation-plan-kind',
      '$.mutationPlan.kind',
      'Upload mutation approval review requires a mutation-plan artifact.'
    ));
  }
  if (input.schemaVersion !== 1) {
    pushBlockerOnce(blockers, blocker(
      'invalid-schema-version',
      '$.mutationPlan.schemaVersion',
      'Upload mutation approval review requires schemaVersion 1.'
    ));
  }
  if (input.planKind !== 'approval-audit-dry-run') {
    pushBlockerOnce(blockers, blocker(
      'invalid-plan-kind',
      '$.mutationPlan.planKind',
      'Upload mutation approval review requires an approval-audit dry-run plan.'
    ));
  }
  if (input.mutationAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'mutation-enabled',
      '$.mutationPlan.mutationAllowed',
      'Upload mutation approval review must not receive mutation-enabled plans.'
    ));
  }
  if (input.executionMode !== 'dry-run') {
    pushBlockerOnce(blockers, blocker(
      'mutation-enabled',
      '$.mutationPlan.executionMode',
      'Upload mutation approval review requires dry-run plan execution mode.'
    ));
  }

  for (const [key, code] of [
    ['remoteWriteAllowed', 'remote-write-enabled'],
    ['liveCheckAllowed', 'live-check-enabled'],
    ['credentialValuesExposed', 'credential-values-exposed'],
    ['credentialPresenceChecked', 'credential-presence-check-enabled'],
    ['uploadApproved', 'upload-approval-already-provided'],
    ['uploadExecutionAllowed', 'upload-execution-enabled'],
    ['mutationApprovalGranted', 'mutation-approval-already-granted'],
    ['clientCreated', 'client-created'],
    ['adapterInjected', 'adapter-injected'],
    ['artifactBytesProvided', 'artifact-bytes-provided'],
    ['writeTokenIssued', 'write-token-issued'],
    ['executionLeaseCreated', 'execution-lease-created'],
    ['rollbackPlanCreated', 'rollback-plan-created'],
    ['objectWriteAttempted', 'object-write-attempted'],
    ['metadataIndexWriteAttempted', 'metadata-index-write-attempted'],
    ['remoteMutationPerformed', 'remote-mutation-performed']
  ] as const) {
    requireFalse(input[key], `$.mutationPlan.${key}`, code, blockers);
  }
  if (input.uploadCommand !== null) {
    pushBlockerOnce(blockers, blocker(
      'upload-command-present',
      '$.mutationPlan.uploadCommand',
      'Upload mutation approval review must not receive upload commands.'
    ));
  }

  const planStatus = readPlanStatus(input.status);
  if (planStatus !== 'plan-ready') {
    pushBlockerOnce(blockers, blocker(
      'mutation-plan-not-ready',
      '$.mutationPlan.status',
      'Upload mutation approval review requires a plan-ready mutation plan.'
    ));
  }

  const target = isRecord(input.target) ? input.target : {};
  const sourcePlan = isRecord(input.sourceGate) ? input.sourceGate : {};
  const approvalAudit = isRecord(input.approvalAudit) ? input.approvalAudit : {};
  const approvalFingerprint = isRecord(approvalAudit.approvalScopeFingerprint)
    ? approvalAudit.approvalScopeFingerprint
    : {};
  const executionPlan = isRecord(input.executionPlan) ? input.executionPlan : {};
  const readiness = isRecord(input.readiness) ? input.readiness : {};

  if (readiness.status !== 'plan-ready') {
    pushBlockerOnce(blockers, blocker(
      'mutation-plan-not-ready',
      '$.mutationPlan.readiness.status',
      'Upload mutation approval review requires plan-ready readiness.'
    ));
  }
  if (readiness.nextAction !== 'request-human-mutation-approval') {
    pushBlockerOnce(blockers, blocker(
      'mutation-plan-not-ready',
      '$.mutationPlan.readiness.nextAction',
      'Upload mutation approval review requires a plan requesting human mutation approval.'
    ));
  }
  if (readiness.blockerCount !== 0) {
    pushBlockerOnce(blockers, blocker(
      'mutation-plan-not-ready',
      '$.mutationPlan.readiness.blockerCount',
      'Upload mutation approval review requires mutation plans with no blockers.'
    ));
  }

  if (approvalAudit.mutationApprovalRequired !== true) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.mutationPlan.approvalAudit.mutationApprovalRequired',
      'Upload mutation approval review requires mutation approval to be required.'
    ));
  }
  requireFalse(
    approvalAudit.mutationApprovalGranted,
    '$.mutationPlan.approvalAudit.mutationApprovalGranted',
    'mutation-approval-already-granted',
    blockers,
    'Upload mutation approval review must not receive already-granted mutation approval.'
  );
  for (const [key, code] of [
    ['humanApprovalRequestIssued', 'upload-approval-already-provided'],
    ['uploadApproved', 'upload-approval-already-provided'],
    ['uploadExecutionAllowed', 'upload-execution-enabled']
  ] as const) {
    requireFalse(approvalAudit[key], `$.mutationPlan.approvalAudit.${key}`, code, blockers);
  }

  let expectedFingerprint: string | null = null;
  if (approvalFingerprint.algorithm !== 'sha256'
    || approvalFingerprint.scope !== 'stage-knowledge-pack-mutation-plan-v1'
    || approvalFingerprint.canonicalFieldCount !== MUTATION_PLAN_FINGERPRINT_FIELD_COUNT
    || typeof approvalFingerprint.value !== 'string'
    || !SAFE_FINGERPRINT_PATTERN.test(approvalFingerprint.value)) {
    pushBlockerOnce(blockers, blocker(
      typeof approvalFingerprint.value === 'string' ? 'unsafe-review-fingerprint' : 'plan-fingerprint-missing',
      '$.mutationPlan.approvalAudit.approvalScopeFingerprint',
      'Upload mutation approval review requires a safe mutation-plan approval fingerprint.'
    ));
  } else {
    expectedFingerprint = approvalFingerprint.value;
  }

  if (sourcePlan.source !== 'upload-execution-gate') {
    pushBlockerOnce(blockers, blocker(
      'invalid-mutation-plan-kind',
      '$.mutationPlan.sourceGate.source',
      'Upload mutation approval review requires a mutation plan derived from an upload execution gate.'
    ));
  }
  if (sourcePlan.gateStatus !== 'gate-ready') {
    pushBlockerOnce(blockers, blocker(
      'mutation-plan-not-ready',
      '$.mutationPlan.sourceGate.gateStatus',
      'Upload mutation approval review requires gate-ready source state.'
    ));
  }
  if (sourcePlan.gateKind !== 'approval-gated-dry-run') {
    pushBlockerOnce(blockers, blocker(
      'invalid-plan-kind',
      '$.mutationPlan.sourceGate.gateKind',
      'Upload mutation approval review requires approval-gated dry-run source state.'
    ));
  }
  if (sourcePlan.scopeMatched !== true) {
    pushBlockerOnce(blockers, blocker(
      'scope-not-matched',
      '$.mutationPlan.sourceGate.scopeMatched',
      'Upload mutation approval review requires matched source scope.'
    ));
  }
  if (sourcePlan.sourceFingerprintVerified !== true && sourcePlan.fingerprintVerified !== true) {
    pushBlockerOnce(blockers, blocker(
      'plan-fingerprint-mismatch',
      '$.mutationPlan.sourceGate.fingerprintVerified',
      'Upload mutation approval review requires verified source fingerprints.'
    ));
  }
  if (sourcePlan.mockHarnessStatus !== 'harness-ready' || sourcePlan.mockHarnessKind !== 'in-memory-mock') {
    pushBlockerOnce(blockers, blocker(
      'mock-harness-not-ready',
      '$.mutationPlan.sourceGate.mockHarnessStatus',
      'Upload mutation approval review requires a ready in-memory mock harness summary.'
    ));
  }
  if (sourcePlan.adapterBackendKind !== 'mock-s3-compatible') {
    pushBlockerOnce(blockers, blocker(
      'unsupported-adapter-backend',
      '$.mutationPlan.sourceGate.adapterBackendKind',
      'Upload mutation approval review only accepts mock-s3-compatible source summaries.'
    ));
  }
  if (sourcePlan.adapterName !== null) {
    if (typeof sourcePlan.adapterName !== 'string' || !isSafeKnowledgeTeamBackendAdapterName(sourcePlan.adapterName)) {
      pushBlockerOnce(blockers, blocker(
        'unsafe-adapter-name',
        '$.mutationPlan.sourceGate.adapterName',
        'Upload mutation approval review requires safe adapter names.'
      ));
    }
  }

  for (const [key, code] of [
    ['executable', 'upload-execution-enabled'],
    ['artifactBytesProvided', 'artifact-bytes-provided'],
    ['adapterInjected', 'adapter-injected'],
    ['writeTokenIssued', 'write-token-issued'],
    ['executionLeaseCreated', 'execution-lease-created'],
    ['rollbackPlanCreated', 'rollback-plan-created'],
    ['auditRecordCreated', 'remote-mutation-performed'],
    ['clientCreated', 'client-created'],
    ['credentialValuesRead', 'credential-values-exposed'],
    ['credentialPresenceChecked', 'credential-presence-check-enabled'],
    ['liveCheckPerformed', 'live-check-enabled'],
    ['uploadCommandGenerated', 'upload-command-present'],
    ['objectWriteAttempted', 'object-write-attempted'],
    ['metadataIndexWriteAttempted', 'metadata-index-write-attempted'],
    ['remoteMutationPerformed', 'remote-mutation-performed']
  ] as const) {
    requireFalse(executionPlan[key], `$.mutationPlan.executionPlan.${key}`, code, blockers);
  }

  return {
    planStatus,
    planKind: input.planKind === 'approval-audit-dry-run' ? 'approval-audit-dry-run' : 'unsupported',
    planNextAction: readPlanNextAction(readiness.nextAction),
    gateStatus: readGateStatus(sourcePlan.gateStatus),
    gateKind: readGateKind(sourcePlan.gateKind),
    scopeMatched: sourcePlan.scopeMatched === true,
    continuationStatus: readContinuationStatus(sourcePlan.continuationStatus),
    approvalProvided: sourcePlan.approvalProvided === true,
    sourceFingerprintVerified: sourcePlan.sourceFingerprintVerified === true || sourcePlan.fingerprintVerified === true,
    mockHarnessStatus: readMockHarnessStatus(sourcePlan.mockHarnessStatus),
    mockHarnessKind: readMockHarnessKind(sourcePlan.mockHarnessKind),
    mockAdapterInstantiated: sourcePlan.mockAdapterInstantiated === true,
    adapterName: typeof sourcePlan.adapterName === 'string' ? sourcePlan.adapterName : null,
    adapterBackendKind: readAdapterBackendKind(sourcePlan.adapterBackendKind),
    expectedFingerprint,
    fingerprintScope: approvalFingerprint.scope === 'stage-knowledge-pack-mutation-plan-v1'
      ? 'stage-knowledge-pack-mutation-plan-v1'
      : 'unsupported',
    fingerprintCanonicalFieldCount: typeof approvalFingerprint.canonicalFieldCount === 'number'
      ? approvalFingerprint.canonicalFieldCount
      : null,
    target: {
      manifestId: readSafeId(target.manifestId, '$.mutationPlan.target.manifestId', blockers),
      objectKey: readSafeObjectKey(target.objectKey, '$.mutationPlan.target.objectKey', blockers),
      objectSha256: readSafeSha256(target.objectSha256, '$.mutationPlan.target.objectSha256', blockers),
      artifactId: readSafeId(target.artifactId, '$.mutationPlan.target.artifactId', blockers)
    }
  };
}

function emptyParsedMutationPlan(): ParsedMutationPlanForApprovalReview {
  return {
    planStatus: 'invalid',
    planKind: 'unsupported',
    planNextAction: 'invalid',
    gateStatus: 'invalid',
    gateKind: 'unsupported',
    scopeMatched: false,
    continuationStatus: 'invalid',
    approvalProvided: false,
    sourceFingerprintVerified: false,
    mockHarnessStatus: 'invalid',
    mockHarnessKind: 'unsupported',
    mockAdapterInstantiated: false,
    adapterName: null,
    adapterBackendKind: 'unsupported',
    expectedFingerprint: null,
    fingerprintScope: 'unsupported',
    fingerprintCanonicalFieldCount: null,
    target: {
      manifestId: null,
      objectKey: null,
      objectSha256: null,
      artifactId: null
    }
  };
}

function readSuppliedFingerprint(
  value: unknown,
  expectedFingerprint: string | null,
  blockers: KnowledgeTeamUploadMutationApprovalReviewBlocker[]
): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    pushBlockerOnce(blockers, blocker(
      'review-fingerprint-missing',
      '$.approvalFingerprint',
      'Upload mutation approval review requires an explicit approval fingerprint.'
    ));
    return null;
  }
  if (!SAFE_FINGERPRINT_PATTERN.test(value)) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-review-fingerprint',
      '$.approvalFingerprint',
      'Upload mutation approval review requires a safe SHA-256 approval fingerprint.'
    ));
    return null;
  }
  if (expectedFingerprint !== null && value !== expectedFingerprint) {
    pushBlockerOnce(blockers, blocker(
      'review-fingerprint-mismatch',
      '$.approvalFingerprint',
      'Upload mutation approval review fingerprint must match the mutation-plan approval fingerprint.'
    ));
  }
  return value;
}

function buildReadiness(
  blockers: KnowledgeTeamUploadMutationApprovalReviewBlocker[]
): KnowledgeTeamUploadMutationApprovalReview['readiness'] {
  const status: KnowledgeTeamUploadMutationApprovalReviewStatus = blockers.length === 0
    ? 'review-ready'
    : 'blocked';
  return {
    status,
    nextAction: status === 'review-ready'
      ? 'plan-execution-prerequisite-boundaries'
      : 'resolve-blockers',
    blockerCount: blockers.length,
    blockerCodes: blockers.map(blocker => blocker.code),
    blockers,
    reason: status === 'review-ready'
      ? 'Mutation approval fingerprint matched; review is recorded without enabling execution.'
      : 'Mutation approval review is blocked until all plan and fingerprint blockers are resolved.'
  };
}

export function buildKnowledgeTeamUploadMutationApprovalReview(
  input: KnowledgeTeamUploadMutationApprovalReviewInput
): KnowledgeTeamUploadMutationApprovalReview {
  const blockers: KnowledgeTeamUploadMutationApprovalReviewBlocker[] = [];
  const parsedPlan = parseMutationPlanForApprovalReview(input.mutationPlan, blockers);
  const suppliedFingerprint = readSuppliedFingerprint(
    input.approvalFingerprint,
    parsedPlan.expectedFingerprint,
    blockers
  );
  const readiness = buildReadiness(blockers);
  const reviewReady = readiness.status === 'review-ready';

  return {
    kind: 'infra-agent.knowledge-team-upload-mutation-approval-review',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    reviewKind: 'human-fingerprint-dry-run',
    status: readiness.status,
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
    objectWriteAttempted: false,
    metadataIndexWriteAttempted: false,
    remoteMutationPerformed: false,
    uploadCommand: null,
    target: parsedPlan.target,
    sourcePlan: {
      source: 'upload-mutation-plan',
      planStatus: parsedPlan.planStatus,
      planKind: parsedPlan.planKind,
      planNextAction: parsedPlan.planNextAction,
      gateStatus: parsedPlan.gateStatus,
      gateKind: parsedPlan.gateKind,
      scopeMatched: parsedPlan.scopeMatched,
      continuationStatus: parsedPlan.continuationStatus,
      approvalProvided: parsedPlan.approvalProvided,
      sourceFingerprintVerified: parsedPlan.sourceFingerprintVerified,
      mockHarnessStatus: parsedPlan.mockHarnessStatus,
      mockHarnessKind: parsedPlan.mockHarnessKind,
      mockAdapterInstantiated: parsedPlan.mockAdapterInstantiated,
      adapterName: parsedPlan.adapterName,
      adapterBackendKind: parsedPlan.adapterBackendKind,
      approvalFingerprint: {
        algorithm: 'sha256',
        scope: parsedPlan.fingerprintScope,
        value: parsedPlan.expectedFingerprint,
        canonicalFieldCount: parsedPlan.fingerprintCanonicalFieldCount
      }
    },
    approvalReview: {
      mutationApprovalRequired: true,
      humanReviewRequired: true,
      humanReviewRecorded: reviewReady,
      source: suppliedFingerprint === null ? null : 'cli-flag',
      suppliedFingerprint,
      expectedFingerprint: parsedPlan.expectedFingerprint,
      fingerprintVerified: reviewReady,
      mutationApprovalGranted: false,
      uploadApproved: false,
      uploadExecutionAllowed: false
    },
    executionBoundary: {
      executable: false,
      dryRunOnly: true,
      artifactBytesProvided: false,
      adapterInjected: false,
      writeTokenIssued: false,
      executionLeaseCreated: false,
      rollbackPlanCreated: false,
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
    readiness
  };
}
