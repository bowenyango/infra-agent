import { createHash } from 'node:crypto';
import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadMutationPlanStatus =
  | 'plan-ready'
  | 'blocked';

export type KnowledgeTeamUploadMutationPlanNextAction =
  | 'request-human-mutation-approval'
  | 'resolve-blockers';

export type KnowledgeTeamUploadMutationPlanBlockerCode =
  | 'adapter-injected'
  | 'artifact-bytes-provided'
  | 'backend-detail-leak'
  | 'client-created'
  | 'credential-presence-check-enabled'
  | 'credential-values-exposed'
  | 'execution-gate-not-ready'
  | 'execution-lease-created'
  | 'invalid-execution-gate-kind'
  | 'invalid-schema-version'
  | 'live-check-enabled'
  | 'metadata-index-write-attempted'
  | 'missing-required-field'
  | 'mock-harness-not-ready'
  | 'mutation-approval-already-granted'
  | 'mutation-enabled'
  | 'object-write-attempted'
  | 'remote-mutation-performed'
  | 'remote-write-enabled'
  | 'rollback-plan-created'
  | 'scope-not-matched'
  | 'unsupported-adapter-backend'
  | 'upload-approval-already-provided'
  | 'upload-command-present'
  | 'upload-execution-enabled'
  | 'unsafe-adapter-name'
  | 'unsafe-artifact-reference'
  | 'write-token-issued';

export interface KnowledgeTeamUploadMutationPlanBlocker {
  code: KnowledgeTeamUploadMutationPlanBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadMutationPlan {
  kind: 'infra-agent.knowledge-team-upload-mutation-plan';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  planKind: 'approval-audit-dry-run';
  status: KnowledgeTeamUploadMutationPlanStatus;
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
  sourceGate: {
    source: 'upload-execution-gate';
    gateStatus: 'gate-ready' | 'blocked' | 'invalid';
    gateKind: 'approval-gated-dry-run' | 'unsupported';
    gateNextAction: 'request-separate-mutation-approval' | 'resolve-blockers' | 'invalid';
    scopeMatched: boolean;
    continuationStatus: 'continuation-ready' | 'blocked' | 'invalid';
    approvalProvided: boolean;
    fingerprintVerified: boolean;
    mockHarnessStatus: 'harness-ready' | 'blocked' | 'invalid';
    mockHarnessKind: 'in-memory-mock' | 'unsupported';
    mockAdapterInstantiated: boolean;
    adapterName: string | null;
    adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
  };
  approvalAudit: {
    mutationApprovalRequired: true;
    mutationApprovalGranted: false;
    humanApprovalRequestIssued: false;
    uploadApproved: false;
    uploadExecutionAllowed: false;
    approvalScopeFingerprint: {
      algorithm: 'sha256';
      scope: 'stage-knowledge-pack-mutation-plan-v1';
      value: string | null;
      canonicalFieldCount: number;
    };
  };
  executionPlan: {
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
    rollbackPlanRequired: true;
    rollbackPlanCreated: false;
    auditRecordRequired: true;
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
    status: KnowledgeTeamUploadMutationPlanStatus;
    nextAction: KnowledgeTeamUploadMutationPlanNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadMutationPlanBlockerCode[];
    blockers: KnowledgeTeamUploadMutationPlanBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadMutationPlanInput {
  executionGate: unknown;
}

interface ParsedMutationPlanTarget {
  manifestId: string | null;
  objectKey: string | null;
  objectSha256: string | null;
  artifactId: string | null;
}

interface ParsedExecutionGateForMutationPlan {
  gateStatus: 'gate-ready' | 'blocked' | 'invalid';
  gateKind: 'approval-gated-dry-run' | 'unsupported';
  gateNextAction: 'request-separate-mutation-approval' | 'resolve-blockers' | 'invalid';
  scopeMatched: boolean;
  continuationStatus: 'continuation-ready' | 'blocked' | 'invalid';
  approvalProvided: boolean;
  fingerprintVerified: boolean;
  mockHarnessStatus: 'harness-ready' | 'blocked' | 'invalid';
  mockHarnessKind: 'in-memory-mock' | 'unsupported';
  mockAdapterInstantiated: boolean;
  adapterName: string | null;
  adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
  target: ParsedMutationPlanTarget;
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
  'liveCheckAllowed',
  'liveCheckPerformed',
  'metadataIndexWriteAttempted',
  'objectKey',
  'remoteWriteAllowed',
  'rollbackPlanCreated',
  'uploadApproved',
  'uploadCommand',
  'uploadCommandGenerated',
  'uploadExecutionAllowed',
  'writeTokenIssued'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function blocker(
  code: KnowledgeTeamUploadMutationPlanBlockerCode,
  path: string,
  message: string
): KnowledgeTeamUploadMutationPlanBlocker {
  return { code, path, message };
}

function pushBlockerOnce(
  blockers: KnowledgeTeamUploadMutationPlanBlocker[],
  nextBlocker: KnowledgeTeamUploadMutationPlanBlocker
): void {
  if (!blockers.some(entry => entry.code === nextBlocker.code && entry.path === nextBlocker.path)) {
    blockers.push(nextBlocker);
  }
}

function checkNoMutationPlanLeakage(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadMutationPlanBlocker[]
): void {
  if (typeof value === 'string') {
    if (FORBIDDEN_LEAK_VALUE_PATTERN.test(value)) {
      pushBlockerOnce(blockers, blocker(
        'backend-detail-leak',
        path,
        'Upload mutation plan inputs must not expose backend details, credential values, commands, client fields, or absolute paths.'
      ));
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      checkNoMutationPlanLeakage(entry, `${path}[${index}]`, blockers);
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
        'Upload mutation plan inputs must not include backend detail, credential, command, client, store, or index fields.'
      ));
    }
    checkNoMutationPlanLeakage(entry, entryPath, blockers);
  }
}

function emptyTarget(): ParsedMutationPlanTarget {
  return {
    manifestId: null,
    objectKey: null,
    objectSha256: null,
    artifactId: null
  };
}

function readSafeId(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadMutationPlanBlocker[]
): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      path,
      'Upload mutation plan requires this field.'
    ));
    return null;
  }
  if (!SAFE_ID_PATTERN.test(value)) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-artifact-reference',
      path,
      'Upload mutation plan requires safe artifact identifiers.'
    ));
    return null;
  }
  return value;
}

function readSafeObjectKey(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadMutationPlanBlocker[]
): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      path,
      'Upload mutation plan requires this field.'
    ));
    return null;
  }
  if (!isSafeKnowledgeTeamArtifactObjectKey(value)) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-artifact-reference',
      path,
      'Upload mutation plan requires a safe content-addressed object key.'
    ));
    return null;
  }
  return value;
}

function readSafeSha256(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadMutationPlanBlocker[]
): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      path,
      'Upload mutation plan requires this field.'
    ));
    return null;
  }
  if (!isKnowledgeTeamArtifactSha256(value)) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-artifact-reference',
      path,
      'Upload mutation plan requires safe SHA-256 artifact references.'
    ));
    return null;
  }
  return value;
}

function readGateStatus(value: unknown): ParsedExecutionGateForMutationPlan['gateStatus'] {
  return value === 'gate-ready'
    ? 'gate-ready'
    : value === 'blocked'
      ? 'blocked'
      : 'invalid';
}

function readGateNextAction(value: unknown): ParsedExecutionGateForMutationPlan['gateNextAction'] {
  return value === 'request-separate-mutation-approval' || value === 'resolve-blockers'
    ? value
    : 'invalid';
}

function readContinuationStatus(value: unknown): ParsedExecutionGateForMutationPlan['continuationStatus'] {
  return value === 'continuation-ready' || value === 'blocked'
    ? value
    : 'invalid';
}

function readHarnessStatus(value: unknown): ParsedExecutionGateForMutationPlan['mockHarnessStatus'] {
  return value === 'harness-ready' || value === 'blocked'
    ? value
    : 'invalid';
}

function readHarnessKind(value: unknown): ParsedExecutionGateForMutationPlan['mockHarnessKind'] {
  return value === 'in-memory-mock'
    ? 'in-memory-mock'
    : 'unsupported';
}

function readAdapterBackendKind(value: unknown): ParsedExecutionGateForMutationPlan['adapterBackendKind'] {
  return value === 'mock-s3-compatible' || value === 's3-compatible'
    ? value
    : 'unsupported';
}

function parseExecutionGateForMutationPlan(
  input: unknown,
  blockers: KnowledgeTeamUploadMutationPlanBlocker[]
): ParsedExecutionGateForMutationPlan {
  const empty: ParsedExecutionGateForMutationPlan = {
    gateStatus: 'invalid',
    gateKind: 'unsupported',
    gateNextAction: 'invalid',
    scopeMatched: false,
    continuationStatus: 'invalid',
    approvalProvided: false,
    fingerprintVerified: false,
    mockHarnessStatus: 'invalid',
    mockHarnessKind: 'unsupported',
    mockAdapterInstantiated: false,
    adapterName: null,
    adapterBackendKind: 'unsupported',
    target: emptyTarget()
  };

  if (!isRecord(input)) {
    pushBlockerOnce(blockers, blocker(
      'invalid-execution-gate-kind',
      '$.executionGate',
      'Upload mutation plan requires an upload execution gate JSON object.'
    ));
    return empty;
  }

  if (input.kind !== 'infra-agent.knowledge-team-upload-execution-gate') {
    pushBlockerOnce(blockers, blocker(
      'invalid-execution-gate-kind',
      '$.executionGate.kind',
      'Upload mutation plan requires an upload execution gate artifact.'
    ));
  }
  if (input.schemaVersion !== 1) {
    pushBlockerOnce(blockers, blocker(
      'invalid-schema-version',
      '$.executionGate.schemaVersion',
      'Upload mutation plan requires execution gate schemaVersion 1.'
    ));
  }
  if (input.mutationAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'mutation-enabled',
      '$.executionGate.mutationAllowed',
      'Upload mutation plan requires mutationAllowed=false.'
    ));
  }
  if (input.remoteWriteAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'remote-write-enabled',
      '$.executionGate.remoteWriteAllowed',
      'Upload mutation plan requires remote writes to remain disabled.'
    ));
  }
  if (input.liveCheckAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'live-check-enabled',
      '$.executionGate.liveCheckAllowed',
      'Upload mutation plan requires live backend checks to remain disabled.'
    ));
  }
  if (input.credentialValuesExposed !== false) {
    pushBlockerOnce(blockers, blocker(
      'credential-values-exposed',
      '$.executionGate.credentialValuesExposed',
      'Upload mutation plan must not expose credential values.'
    ));
  }
  if (input.credentialPresenceChecked !== false) {
    pushBlockerOnce(blockers, blocker(
      'credential-presence-check-enabled',
      '$.executionGate.credentialPresenceChecked',
      'Upload mutation plan must not check credential presence.'
    ));
  }
  if (input.uploadApproved !== false) {
    pushBlockerOnce(blockers, blocker(
      'upload-approval-already-provided',
      '$.executionGate.uploadApproved',
      'Upload mutation plan must not receive already-approved upload state.'
    ));
  }
  if (input.uploadExecutionAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'upload-execution-enabled',
      '$.executionGate.uploadExecutionAllowed',
      'Upload mutation plan must not receive upload execution permission.'
    ));
  }
  if (input.clientCreated !== false) {
    pushBlockerOnce(blockers, blocker(
      'client-created',
      '$.executionGate.clientCreated',
      'Upload mutation plan must not receive created clients.'
    ));
  }
  if (input.adapterInjected !== false) {
    pushBlockerOnce(blockers, blocker(
      'adapter-injected',
      '$.executionGate.adapterInjected',
      'Upload mutation plan must not receive injected adapters.'
    ));
  }
  if (input.writeTokenIssued !== false) {
    pushBlockerOnce(blockers, blocker(
      'write-token-issued',
      '$.executionGate.writeTokenIssued',
      'Upload mutation plan must not receive issued write tokens.'
    ));
  }
  if (input.executionLeaseCreated !== false) {
    pushBlockerOnce(blockers, blocker(
      'execution-lease-created',
      '$.executionGate.executionLeaseCreated',
      'Upload mutation plan must not receive execution leases.'
    ));
  }
  if (input.objectWriteAttempted !== false) {
    pushBlockerOnce(blockers, blocker(
      'object-write-attempted',
      '$.executionGate.objectWriteAttempted',
      'Upload mutation plan requires object writes to remain unattempted.'
    ));
  }
  if (input.metadataIndexWriteAttempted !== false) {
    pushBlockerOnce(blockers, blocker(
      'metadata-index-write-attempted',
      '$.executionGate.metadataIndexWriteAttempted',
      'Upload mutation plan requires metadata index writes to remain unattempted.'
    ));
  }
  if (input.remoteMutationPerformed !== false) {
    pushBlockerOnce(blockers, blocker(
      'remote-mutation-performed',
      '$.executionGate.remoteMutationPerformed',
      'Upload mutation plan requires remote mutations to remain unperformed.'
    ));
  }
  if (input.uploadCommand !== null) {
    pushBlockerOnce(blockers, blocker(
      'upload-command-present',
      '$.executionGate.uploadCommand',
      'Upload mutation plan must not include upload commands.'
    ));
  }

  const gateStatus = readGateStatus(input.status);
  if (gateStatus !== 'gate-ready') {
    pushBlockerOnce(blockers, blocker(
      'execution-gate-not-ready',
      '$.executionGate.status',
      'Upload mutation plan requires a gate-ready execution gate.'
    ));
  }
  const gateKind = input.gateKind === 'approval-gated-dry-run'
    ? 'approval-gated-dry-run'
    : 'unsupported';
  if (gateKind !== 'approval-gated-dry-run') {
    pushBlockerOnce(blockers, blocker(
      'invalid-execution-gate-kind',
      '$.executionGate.gateKind',
      'Upload mutation plan requires an approval-gated dry-run execution gate.'
    ));
  }

  const target = isRecord(input.target) ? input.target : {};
  const approvalGate = isRecord(input.approvalGate) ? input.approvalGate : {};
  const mockHarness = isRecord(input.mockHarness) ? input.mockHarness : {};
  const executionBoundary = isRecord(input.executionBoundary) ? input.executionBoundary : {};
  const readiness = isRecord(input.readiness) ? input.readiness : {};

  if (approvalGate.mutationApprovalGranted !== false) {
    pushBlockerOnce(blockers, blocker(
      'mutation-approval-already-granted',
      '$.executionGate.approvalGate.mutationApprovalGranted',
      'Upload mutation plan must request separate mutation approval later, not receive it now.'
    ));
  }
  if (approvalGate.uploadApproved !== false) {
    pushBlockerOnce(blockers, blocker(
      'upload-approval-already-provided',
      '$.executionGate.approvalGate.uploadApproved',
      'Upload mutation plan must not receive upload approval.'
    ));
  }
  if (approvalGate.uploadExecutionAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'upload-execution-enabled',
      '$.executionGate.approvalGate.uploadExecutionAllowed',
      'Upload mutation plan must not receive upload execution permission.'
    ));
  }
  if (approvalGate.scopeMatched !== true) {
    pushBlockerOnce(blockers, blocker(
      'scope-not-matched',
      '$.executionGate.approvalGate.scopeMatched',
      'Upload mutation plan requires the execution gate scope to be matched.'
    ));
  }

  if (mockHarness.status !== 'harness-ready') {
    pushBlockerOnce(blockers, blocker(
      'mock-harness-not-ready',
      '$.executionGate.mockHarness.status',
      'Upload mutation plan requires a harness-ready gate summary.'
    ));
  }
  if (mockHarness.harnessKind !== 'in-memory-mock') {
    pushBlockerOnce(blockers, blocker(
      'mock-harness-not-ready',
      '$.executionGate.mockHarness.harnessKind',
      'Upload mutation plan requires an in-memory mock harness summary.'
    ));
  }
  if (mockHarness.mockAdapterInstantiated !== true) {
    pushBlockerOnce(blockers, blocker(
      'mock-harness-not-ready',
      '$.executionGate.mockHarness.mockAdapterInstantiated',
      'Upload mutation plan requires a reviewed mock adapter boundary.'
    ));
  }
  const adapterName = typeof mockHarness.adapterName === 'string'
    ? mockHarness.adapterName
    : null;
  if (adapterName === null || !isSafeKnowledgeTeamBackendAdapterName(adapterName)) {
    pushBlockerOnce(blockers, blocker(
      adapterName === null ? 'missing-required-field' : 'unsafe-adapter-name',
      '$.executionGate.mockHarness.adapterName',
      'Upload mutation plan requires a safe mock adapter name.'
    ));
  }
  if (mockHarness.adapterBackendKind !== 'mock-s3-compatible') {
    pushBlockerOnce(blockers, blocker(
      'unsupported-adapter-backend',
      '$.executionGate.mockHarness.adapterBackendKind',
      'Upload mutation plan only accepts mock-s3-compatible gate summaries.'
    ));
  }
  if (mockHarness.objectWriteAttempted !== false) {
    pushBlockerOnce(blockers, blocker(
      'object-write-attempted',
      '$.executionGate.mockHarness.objectWriteAttempted',
      'Upload mutation plan requires nested object write attempts to remain false.'
    ));
  }
  if (mockHarness.indexWriteAttempted !== false) {
    pushBlockerOnce(blockers, blocker(
      'metadata-index-write-attempted',
      '$.executionGate.mockHarness.indexWriteAttempted',
      'Upload mutation plan requires nested index write attempts to remain false.'
    ));
  }
  if (mockHarness.remoteMutationPerformed !== false) {
    pushBlockerOnce(blockers, blocker(
      'remote-mutation-performed',
      '$.executionGate.mockHarness.remoteMutationPerformed',
      'Upload mutation plan requires nested remote mutation attempts to remain false.'
    ));
  }

  if (executionBoundary.artifactBytesProvided !== false) {
    pushBlockerOnce(blockers, blocker(
      'artifact-bytes-provided',
      '$.executionGate.executionBoundary.artifactBytesProvided',
      'Upload mutation plan must not receive artifact bytes.'
    ));
  }
  for (const key of [
    ['adapterInjected', 'adapter-injected'],
    ['clientCreated', 'client-created'],
    ['credentialValuesRead', 'credential-values-exposed'],
    ['credentialPresenceChecked', 'credential-presence-check-enabled'],
    ['liveCheckPerformed', 'live-check-enabled'],
    ['writeTokenIssued', 'write-token-issued'],
    ['executionLeaseCreated', 'execution-lease-created'],
    ['uploadCommandGenerated', 'upload-command-present'],
    ['objectWriteAttempted', 'object-write-attempted'],
    ['metadataIndexWriteAttempted', 'metadata-index-write-attempted'],
    ['remoteMutationPerformed', 'remote-mutation-performed']
  ] as const) {
    if (executionBoundary[key[0]] !== false) {
      pushBlockerOnce(blockers, blocker(
        key[1],
        `$.executionGate.executionBoundary.${key[0]}`,
        'Upload mutation plan requires execution boundary mutation fields to remain false.'
      ));
    }
  }

  return {
    gateStatus,
    gateKind,
    gateNextAction: readGateNextAction(readiness.nextAction),
    scopeMatched: approvalGate.scopeMatched === true,
    continuationStatus: readContinuationStatus(approvalGate.continuationStatus),
    approvalProvided: approvalGate.approvalProvided === true,
    fingerprintVerified: approvalGate.fingerprintVerified === true,
    mockHarnessStatus: readHarnessStatus(mockHarness.status),
    mockHarnessKind: readHarnessKind(mockHarness.harnessKind),
    mockAdapterInstantiated: mockHarness.mockAdapterInstantiated === true,
    adapterName,
    adapterBackendKind: readAdapterBackendKind(mockHarness.adapterBackendKind),
    target: {
      manifestId: readSafeId(target.manifestId, '$.executionGate.target.manifestId', blockers),
      objectKey: readSafeObjectKey(target.objectKey, '$.executionGate.target.objectKey', blockers),
      objectSha256: readSafeSha256(target.objectSha256, '$.executionGate.target.objectSha256', blockers),
      artifactId: readSafeId(target.artifactId, '$.executionGate.target.artifactId', blockers)
    }
  };
}

function buildApprovalScopeFingerprint(
  gate: ParsedExecutionGateForMutationPlan,
  status: KnowledgeTeamUploadMutationPlanStatus
): string | null {
  if (status !== 'plan-ready') {
    return null;
  }

  const canonicalFields = [
    ['scope', 'stage-knowledge-pack-mutation-plan-v1'],
    ['plannedOperation', 'stage-knowledge-pack'],
    ['gateKind', gate.gateKind],
    ['gateStatus', gate.gateStatus],
    ['manifestId', gate.target.manifestId],
    ['objectKey', gate.target.objectKey],
    ['objectSha256', gate.target.objectSha256],
    ['artifactId', gate.target.artifactId],
    ['approvalProvided', gate.approvalProvided ? 'true' : 'false'],
    ['fingerprintVerified', gate.fingerprintVerified ? 'true' : 'false'],
    ['adapterName', gate.adapterName],
    ['adapterBackendKind', gate.adapterBackendKind]
  ];

  return createHash('sha256')
    .update(JSON.stringify(canonicalFields))
    .digest('hex');
}

export function buildKnowledgeTeamUploadMutationPlan(
  input: KnowledgeTeamUploadMutationPlanInput
): KnowledgeTeamUploadMutationPlan {
  const blockers: KnowledgeTeamUploadMutationPlanBlocker[] = [];
  checkNoMutationPlanLeakage(input.executionGate, '$.executionGate', blockers);
  const gate = parseExecutionGateForMutationPlan(input.executionGate, blockers);

  const status: KnowledgeTeamUploadMutationPlanStatus = blockers.length === 0
    ? 'plan-ready'
    : 'blocked';
  const fingerprintValue = buildApprovalScopeFingerprint(gate, status);
  if (fingerprintValue !== null && !SAFE_FINGERPRINT_PATTERN.test(fingerprintValue)) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-artifact-reference',
      '$.approvalAudit.approvalScopeFingerprint.value',
      'Upload mutation plan generated an unsafe approval scope fingerprint.'
    ));
  }

  return {
    kind: 'infra-agent.knowledge-team-upload-mutation-plan',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    planKind: 'approval-audit-dry-run',
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
    objectWriteAttempted: false,
    metadataIndexWriteAttempted: false,
    remoteMutationPerformed: false,
    uploadCommand: null,
    target: status === 'plan-ready' ? gate.target : emptyTarget(),
    sourceGate: {
      source: 'upload-execution-gate',
      gateStatus: gate.gateStatus,
      gateKind: gate.gateKind,
      gateNextAction: gate.gateNextAction,
      scopeMatched: gate.scopeMatched,
      continuationStatus: gate.continuationStatus,
      approvalProvided: gate.approvalProvided,
      fingerprintVerified: gate.fingerprintVerified,
      mockHarnessStatus: gate.mockHarnessStatus,
      mockHarnessKind: gate.mockHarnessKind,
      mockAdapterInstantiated: gate.mockAdapterInstantiated,
      adapterName: gate.adapterName,
      adapterBackendKind: gate.adapterBackendKind
    },
    approvalAudit: {
      mutationApprovalRequired: true,
      mutationApprovalGranted: false,
      humanApprovalRequestIssued: false,
      uploadApproved: false,
      uploadExecutionAllowed: false,
      approvalScopeFingerprint: {
        algorithm: 'sha256',
        scope: 'stage-knowledge-pack-mutation-plan-v1',
        value: fingerprintValue,
        canonicalFieldCount: MUTATION_PLAN_FINGERPRINT_FIELD_COUNT
      }
    },
    executionPlan: {
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
      rollbackPlanRequired: true,
      rollbackPlanCreated: false,
      auditRecordRequired: true,
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
      nextAction: status === 'plan-ready'
        ? 'request-human-mutation-approval'
        : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: [...new Set(blockers.map(entry => entry.code))].sort(),
      blockers,
      reason: status === 'plan-ready'
        ? 'Upload mutation plan is ready to request explicit human mutation approval; upload execution and remote writes remain disabled.'
        : 'Upload mutation plan blockers must be resolved before requesting explicit human mutation approval.'
    }
  };
}
