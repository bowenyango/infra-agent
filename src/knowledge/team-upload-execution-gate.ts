import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadExecutionGateStatus =
  | 'gate-ready'
  | 'blocked';

export type KnowledgeTeamUploadExecutionGateNextAction =
  | 'request-separate-mutation-approval'
  | 'resolve-blockers';

export type KnowledgeTeamUploadExecutionGateBlockerCode =
  | 'adapter-injected'
  | 'backend-detail-leak'
  | 'client-created'
  | 'credential-presence-check-enabled'
  | 'credential-values-exposed'
  | 'execution-lease-created'
  | 'harness-not-ready'
  | 'invalid-continuation-kind'
  | 'invalid-harness-kind'
  | 'invalid-schema-version'
  | 'live-check-enabled'
  | 'metadata-index-write-attempted'
  | 'missing-required-field'
  | 'mock-adapter-not-instantiated'
  | 'mock-descriptor-not-matched'
  | 'mutation-enabled'
  | 'object-write-attempted'
  | 'remote-mutation-performed'
  | 'remote-write-enabled'
  | 'scope-mismatch'
  | 'unsupported-adapter-backend'
  | 'upload-approval-already-provided'
  | 'upload-command-present'
  | 'upload-execution-enabled'
  | 'unsafe-adapter-name'
  | 'unsafe-artifact-reference'
  | 'write-token-issued';

export interface KnowledgeTeamUploadExecutionGateBlocker {
  code: KnowledgeTeamUploadExecutionGateBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadExecutionGate {
  kind: 'infra-agent.knowledge-team-upload-execution-gate';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  gateKind: 'approval-gated-dry-run';
  status: KnowledgeTeamUploadExecutionGateStatus;
  plannedOperation: 'stage-knowledge-pack';
  remoteWriteAllowed: false;
  liveCheckAllowed: false;
  credentialValuesExposed: false;
  credentialPresenceChecked: false;
  uploadApproved: false;
  uploadExecutionAllowed: false;
  clientCreated: false;
  adapterInjected: false;
  writeTokenIssued: false;
  executionLeaseCreated: false;
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
  approvalGate: {
    source: 'upload-approval-continuation';
    continuationStatus: 'continuation-ready' | 'blocked' | 'invalid';
    approvalRequired: true;
    approvalProvided: boolean;
    fingerprintVerified: boolean;
    mutationApprovalRequired: true;
    mutationApprovalGranted: false;
    uploadApproved: false;
    uploadExecutionAllowed: false;
    scopeMatched: boolean;
  };
  mockHarness: {
    source: 'upload-mock-harness';
    status: 'harness-ready' | 'blocked' | 'invalid';
    harnessKind: 'in-memory-mock' | 'unsupported';
    mockAdapterInstantiated: boolean;
    adapterName: string | null;
    adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
    descriptorMatched: boolean;
    objectWriteAttempted: false;
    indexWriteAttempted: false;
    remoteMutationPerformed: false;
  };
  executionBoundary: {
    dryRunOnly: true;
    artifactBytesProvided: false;
    adapterInjectionReviewed: boolean;
    adapterInjected: false;
    clientCreated: false;
    credentialValuesRead: false;
    credentialPresenceChecked: false;
    liveCheckPerformed: false;
    writeTokenIssued: false;
    executionLeaseCreated: false;
    rollbackPlanRequired: true;
    auditRecordRequired: true;
    uploadCommandGenerated: false;
    objectWriteAttempted: false;
    metadataIndexWriteAttempted: false;
    remoteMutationPerformed: false;
  };
  readiness: {
    status: KnowledgeTeamUploadExecutionGateStatus;
    nextAction: KnowledgeTeamUploadExecutionGateNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadExecutionGateBlockerCode[];
    blockers: KnowledgeTeamUploadExecutionGateBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadExecutionGateInput {
  continuation: unknown;
  mockHarness: unknown;
}

interface ParsedExecutionGateTarget {
  manifestId: string | null;
  objectKey: string | null;
  objectSha256: string | null;
  artifactId: string | null;
}

interface ParsedContinuationForExecutionGate {
  status: 'continuation-ready' | 'blocked' | 'invalid';
  approvalProvided: boolean;
  fingerprintVerified: boolean;
  uploadApproved: false;
  uploadExecutionAllowed: false;
  target: ParsedExecutionGateTarget;
}

interface ParsedMockHarnessForExecutionGate {
  status: 'harness-ready' | 'blocked' | 'invalid';
  harnessKind: 'in-memory-mock' | 'unsupported';
  mockAdapterInstantiated: boolean;
  adapterName: string | null;
  adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
  descriptorMatched: boolean;
  target: ParsedExecutionGateTarget;
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|credentialValue|secret|token|password|authorization|header|accessKey|sessionToken|client|clientConfig|signedUrl|putObject|putEntry|fetch|artifactStore)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|secret|token|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;
const SAFE_CONTROL_KEYS = new Set([
  'adapterInjected',
  'approvalGate',
  'clientCreated',
  'credentialBoundary',
  'credentialPresenceChecked',
  'credentialValuesExposed',
  'credentialValuesRead',
  'liveCheckAllowed',
  'liveCheckPerformed',
  'metadataIndexAvailable',
  'metadataIndexWriteAttempted',
  'objectKey',
  'remoteWriteAllowed',
  'uploadApproved',
  'uploadCommand',
  'uploadCommandGenerated',
  'uploadExecutionAllowed'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function blocker(
  code: KnowledgeTeamUploadExecutionGateBlockerCode,
  path: string,
  message: string
): KnowledgeTeamUploadExecutionGateBlocker {
  return {
    code,
    path,
    message
  };
}

function pushBlockerOnce(
  blockers: KnowledgeTeamUploadExecutionGateBlocker[],
  nextBlocker: KnowledgeTeamUploadExecutionGateBlocker
): void {
  if (!blockers.some(entry => entry.code === nextBlocker.code && entry.path === nextBlocker.path)) {
    blockers.push(nextBlocker);
  }
}

function checkNoExecutionGateLeakage(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadExecutionGateBlocker[]
): void {
  if (typeof value === 'string') {
    if (FORBIDDEN_LEAK_VALUE_PATTERN.test(value)) {
      pushBlockerOnce(blockers, blocker(
        'backend-detail-leak',
        path,
        'Upload execution gate inputs must not expose backend details, credential values, commands, client fields, or absolute paths.'
      ));
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      checkNoExecutionGateLeakage(entry, `${path}[${index}]`, blockers);
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
        'Upload execution gate inputs must not include backend detail, credential, command, client, store, or index fields.'
      ));
    }
    checkNoExecutionGateLeakage(entry, entryPath, blockers);
  }
}

function readSafeId(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadExecutionGateBlocker[]
): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      path,
      'Upload execution gate requires this field.'
    ));
    return null;
  }
  if (!SAFE_ID_PATTERN.test(value)) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-artifact-reference',
      path,
      'Upload execution gate requires safe artifact identifiers.'
    ));
    return null;
  }
  return value;
}

function readSafeObjectKey(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadExecutionGateBlocker[]
): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      path,
      'Upload execution gate requires this field.'
    ));
    return null;
  }
  if (!isSafeKnowledgeTeamArtifactObjectKey(value)) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-artifact-reference',
      path,
      'Upload execution gate requires a safe content-addressed object key.'
    ));
    return null;
  }
  return value;
}

function readSafeSha256(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadExecutionGateBlocker[]
): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      path,
      'Upload execution gate requires this field.'
    ));
    return null;
  }
  if (!isKnowledgeTeamArtifactSha256(value)) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-artifact-reference',
      path,
      'Upload execution gate requires safe SHA-256 artifact references.'
    ));
    return null;
  }
  return value;
}

function emptyTarget(): ParsedExecutionGateTarget {
  return {
    manifestId: null,
    objectKey: null,
    objectSha256: null,
    artifactId: null
  };
}

function parseContinuationForExecutionGate(
  input: unknown,
  blockers: KnowledgeTeamUploadExecutionGateBlocker[]
): ParsedContinuationForExecutionGate {
  const empty: ParsedContinuationForExecutionGate = {
    status: 'invalid',
    approvalProvided: false,
    fingerprintVerified: false,
    uploadApproved: false,
    uploadExecutionAllowed: false,
    target: emptyTarget()
  };

  if (!isRecord(input)) {
    pushBlockerOnce(blockers, blocker(
      'invalid-continuation-kind',
      '$.continuation',
      'Upload execution gate requires an upload approval continuation JSON object.'
    ));
    return empty;
  }

  if (input.kind !== 'infra-agent.knowledge-team-upload-approval-continuation') {
    pushBlockerOnce(blockers, blocker(
      'invalid-continuation-kind',
      '$.continuation.kind',
      'Upload execution gate requires an upload approval continuation artifact.'
    ));
  }
  if (input.schemaVersion !== 1) {
    pushBlockerOnce(blockers, blocker(
      'invalid-schema-version',
      '$.continuation.schemaVersion',
      'Upload execution gate requires continuation schemaVersion 1.'
    ));
  }
  if (input.mutationAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'mutation-enabled',
      '$.continuation.mutationAllowed',
      'Upload execution gate requires mutationAllowed=false.'
    ));
  }
  if (input.remoteWriteAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'remote-write-enabled',
      '$.continuation.remoteWriteAllowed',
      'Upload execution gate requires remote writes to remain disabled.'
    ));
  }
  if (input.liveCheckAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'live-check-enabled',
      '$.continuation.liveCheckAllowed',
      'Upload execution gate requires live backend checks to remain disabled.'
    ));
  }
  if (input.credentialValuesExposed !== false) {
    pushBlockerOnce(blockers, blocker(
      'credential-values-exposed',
      '$.continuation.credentialValuesExposed',
      'Upload execution gate must not expose credential values.'
    ));
  }
  if (input.credentialPresenceChecked !== false) {
    pushBlockerOnce(blockers, blocker(
      'credential-presence-check-enabled',
      '$.continuation.credentialPresenceChecked',
      'Upload execution gate must not check credential presence.'
    ));
  }
  if (input.uploadApproved !== false) {
    pushBlockerOnce(blockers, blocker(
      'upload-approval-already-provided',
      '$.continuation.uploadApproved',
      'Upload execution gate must not receive already-approved upload state.'
    ));
  }
  if (input.uploadExecutionAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'upload-execution-enabled',
      '$.continuation.uploadExecutionAllowed',
      'Upload execution gate must not receive upload execution permission.'
    ));
  }
  if (input.clientCreated !== false) {
    pushBlockerOnce(blockers, blocker(
      'client-created',
      '$.continuation.clientCreated',
      'Upload execution gate must not receive created clients.'
    ));
  }
  if (input.uploadCommand !== null) {
    pushBlockerOnce(blockers, blocker(
      'upload-command-present',
      '$.continuation.uploadCommand',
      'Upload execution gate must not include upload commands.'
    ));
  }

  const status = input.status === 'continuation-ready'
    ? 'continuation-ready'
    : input.status === 'blocked'
      ? 'blocked'
      : 'invalid';
  if (status !== 'continuation-ready') {
    pushBlockerOnce(blockers, blocker(
      'invalid-continuation-kind',
      '$.continuation.status',
      'Upload execution gate requires continuation-ready input.'
    ));
  }

  const approval = isRecord(input.approval) ? input.approval : {};
  if (approval.provided !== true || approval.fingerprintVerified !== true) {
    pushBlockerOnce(blockers, blocker(
      'upload-approval-already-provided',
      '$.continuation.approval',
      'Upload execution gate requires a previously verified explicit approval fingerprint, but still does not grant upload permission.'
    ));
  }

  const target = isRecord(input.target) ? input.target : {};
  return {
    status,
    approvalProvided: approval.provided === true,
    fingerprintVerified: approval.fingerprintVerified === true,
    uploadApproved: false,
    uploadExecutionAllowed: false,
    target: {
      manifestId: readSafeId(target.manifestId, '$.continuation.target.manifestId', blockers),
      objectKey: readSafeObjectKey(target.objectKey, '$.continuation.target.objectKey', blockers),
      objectSha256: readSafeSha256(target.objectSha256, '$.continuation.target.objectSha256', blockers),
      artifactId: readSafeId(target.artifactId, '$.continuation.target.artifactId', blockers)
    }
  };
}

function parseMockHarnessForExecutionGate(
  input: unknown,
  blockers: KnowledgeTeamUploadExecutionGateBlocker[]
): ParsedMockHarnessForExecutionGate {
  const empty: ParsedMockHarnessForExecutionGate = {
    status: 'invalid',
    harnessKind: 'unsupported',
    mockAdapterInstantiated: false,
    adapterName: null,
    adapterBackendKind: 'unsupported',
    descriptorMatched: false,
    target: emptyTarget()
  };

  if (!isRecord(input)) {
    pushBlockerOnce(blockers, blocker(
      'invalid-harness-kind',
      '$.mockHarness',
      'Upload execution gate requires an upload mock harness JSON object.'
    ));
    return empty;
  }

  if (input.kind !== 'infra-agent.knowledge-team-upload-mock-harness') {
    pushBlockerOnce(blockers, blocker(
      'invalid-harness-kind',
      '$.mockHarness.kind',
      'Upload execution gate requires an upload mock harness artifact.'
    ));
  }
  if (input.schemaVersion !== 1) {
    pushBlockerOnce(blockers, blocker(
      'invalid-schema-version',
      '$.mockHarness.schemaVersion',
      'Upload execution gate requires harness schemaVersion 1.'
    ));
  }
  if (input.mutationAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'mutation-enabled',
      '$.mockHarness.mutationAllowed',
      'Upload execution gate requires harness mutationAllowed=false.'
    ));
  }
  if (input.remoteWriteAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'remote-write-enabled',
      '$.mockHarness.remoteWriteAllowed',
      'Upload execution gate requires harness remote writes to remain disabled.'
    ));
  }
  if (input.liveCheckAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'live-check-enabled',
      '$.mockHarness.liveCheckAllowed',
      'Upload execution gate requires harness live checks to remain disabled.'
    ));
  }
  if (input.credentialValuesExposed !== false) {
    pushBlockerOnce(blockers, blocker(
      'credential-values-exposed',
      '$.mockHarness.credentialValuesExposed',
      'Upload execution gate requires harness credential values to remain hidden.'
    ));
  }
  if (input.credentialPresenceChecked !== false) {
    pushBlockerOnce(blockers, blocker(
      'credential-presence-check-enabled',
      '$.mockHarness.credentialPresenceChecked',
      'Upload execution gate requires harness credential presence checks to remain disabled.'
    ));
  }
  if (input.uploadApproved !== false) {
    pushBlockerOnce(blockers, blocker(
      'upload-approval-already-provided',
      '$.mockHarness.uploadApproved',
      'Upload execution gate must not receive already-approved upload state.'
    ));
  }
  if (input.uploadExecutionAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'upload-execution-enabled',
      '$.mockHarness.uploadExecutionAllowed',
      'Upload execution gate must not receive upload execution permission.'
    ));
  }
  if (input.clientCreated !== false) {
    pushBlockerOnce(blockers, blocker(
      'client-created',
      '$.mockHarness.clientCreated',
      'Upload execution gate must not receive created clients.'
    ));
  }
  if (input.adapterInjected !== false) {
    pushBlockerOnce(blockers, blocker(
      'adapter-injected',
      '$.mockHarness.adapterInjected',
      'Upload execution gate must not receive already-injected adapters.'
    ));
  }
  if (input.objectWriteAttempted !== false) {
    pushBlockerOnce(blockers, blocker(
      'object-write-attempted',
      '$.mockHarness.objectWriteAttempted',
      'Upload execution gate requires object writes to remain unattempted.'
    ));
  }
  if (input.metadataIndexWriteAttempted !== false) {
    pushBlockerOnce(blockers, blocker(
      'metadata-index-write-attempted',
      '$.mockHarness.metadataIndexWriteAttempted',
      'Upload execution gate requires metadata index writes to remain unattempted.'
    ));
  }
  if (input.remoteMutationPerformed !== false) {
    pushBlockerOnce(blockers, blocker(
      'remote-mutation-performed',
      '$.mockHarness.remoteMutationPerformed',
      'Upload execution gate requires remote mutations to remain unperformed.'
    ));
  }
  if (input.uploadCommand !== null) {
    pushBlockerOnce(blockers, blocker(
      'upload-command-present',
      '$.mockHarness.uploadCommand',
      'Upload execution gate must not include upload commands.'
    ));
  }

  const status = input.status === 'harness-ready'
    ? 'harness-ready'
    : input.status === 'blocked'
      ? 'blocked'
      : 'invalid';
  if (status !== 'harness-ready') {
    pushBlockerOnce(blockers, blocker(
      'harness-not-ready',
      '$.mockHarness.status',
      'Upload execution gate requires harness-ready input.'
    ));
  }
  const harnessKind = input.harnessKind === 'in-memory-mock'
    ? 'in-memory-mock'
    : 'unsupported';
  if (harnessKind !== 'in-memory-mock') {
    pushBlockerOnce(blockers, blocker(
      'invalid-harness-kind',
      '$.mockHarness.harnessKind',
      'Upload execution gate requires an in-memory mock harness.'
    ));
  }
  if (input.mockAdapterInstantiated !== true) {
    pushBlockerOnce(blockers, blocker(
      'mock-adapter-not-instantiated',
      '$.mockHarness.mockAdapterInstantiated',
      'Upload execution gate requires a reviewed in-memory mock adapter boundary.'
    ));
  }

  const mockHarness = isRecord(input.mockHarness) ? input.mockHarness : {};
  const preflight = isRecord(input.preflight) ? input.preflight : {};
  const adapterName = typeof mockHarness.adapterName === 'string'
    ? mockHarness.adapterName
    : null;
  if (adapterName === null || !isSafeKnowledgeTeamBackendAdapterName(adapterName)) {
    pushBlockerOnce(blockers, blocker(
      adapterName === null ? 'missing-required-field' : 'unsafe-adapter-name',
      '$.mockHarness.mockHarness.adapterName',
      'Upload execution gate requires a safe mock adapter name.'
    ));
  }
  const adapterBackendKind = preflight.adapterBackendKind === 'mock-s3-compatible' || preflight.adapterBackendKind === 's3-compatible'
    ? preflight.adapterBackendKind
    : 'unsupported';
  if (adapterBackendKind !== 'mock-s3-compatible' || mockHarness.backendKind !== 'mock-s3-compatible') {
    pushBlockerOnce(blockers, blocker(
      'unsupported-adapter-backend',
      '$.mockHarness.mockHarness.backendKind',
      'Upload execution gate only accepts reviewed mock-s3-compatible adapter harnesses.'
    ));
  }
  if (mockHarness.descriptorMatched !== true) {
    pushBlockerOnce(blockers, blocker(
      'mock-descriptor-not-matched',
      '$.mockHarness.mockHarness.descriptorMatched',
      'Upload execution gate requires a matched mock adapter descriptor.'
    ));
  }
  if (mockHarness.objectWriteAttempted !== false) {
    pushBlockerOnce(blockers, blocker(
      'object-write-attempted',
      '$.mockHarness.mockHarness.objectWriteAttempted',
      'Upload execution gate requires nested object write attempts to remain false.'
    ));
  }
  if (mockHarness.indexWriteAttempted !== false) {
    pushBlockerOnce(blockers, blocker(
      'metadata-index-write-attempted',
      '$.mockHarness.mockHarness.indexWriteAttempted',
      'Upload execution gate requires nested index write attempts to remain false.'
    ));
  }
  if (mockHarness.remoteMutationPerformed !== false) {
    pushBlockerOnce(blockers, blocker(
      'remote-mutation-performed',
      '$.mockHarness.mockHarness.remoteMutationPerformed',
      'Upload execution gate requires nested remote mutation attempts to remain false.'
    ));
  }

  return {
    status,
    harnessKind,
    mockAdapterInstantiated: input.mockAdapterInstantiated === true,
    adapterName,
    adapterBackendKind,
    descriptorMatched: mockHarness.descriptorMatched === true,
    target: {
      manifestId: readSafeId(preflight.manifestId, '$.mockHarness.preflight.manifestId', blockers),
      objectKey: readSafeObjectKey(preflight.objectKey, '$.mockHarness.preflight.objectKey', blockers),
      objectSha256: readSafeSha256(preflight.objectSha256, '$.mockHarness.preflight.objectSha256', blockers),
      artifactId: readSafeId(preflight.artifactId, '$.mockHarness.preflight.artifactId', blockers)
    }
  };
}

function targetsMatch(
  continuationTarget: ParsedExecutionGateTarget,
  harnessTarget: ParsedExecutionGateTarget
): boolean {
  return continuationTarget.manifestId !== null
    && continuationTarget.manifestId === harnessTarget.manifestId
    && continuationTarget.objectKey !== null
    && continuationTarget.objectKey === harnessTarget.objectKey
    && continuationTarget.objectSha256 !== null
    && continuationTarget.objectSha256 === harnessTarget.objectSha256
    && continuationTarget.artifactId !== null
    && continuationTarget.artifactId === harnessTarget.artifactId;
}

export function buildKnowledgeTeamUploadExecutionGate(
  input: KnowledgeTeamUploadExecutionGateInput
): KnowledgeTeamUploadExecutionGate {
  const blockers: KnowledgeTeamUploadExecutionGateBlocker[] = [];
  checkNoExecutionGateLeakage(input.continuation, '$.continuation', blockers);
  checkNoExecutionGateLeakage(input.mockHarness, '$.mockHarness', blockers);

  const continuation = parseContinuationForExecutionGate(input.continuation, blockers);
  const mockHarness = parseMockHarnessForExecutionGate(input.mockHarness, blockers);
  const scopeMatched = targetsMatch(continuation.target, mockHarness.target);
  if (!scopeMatched) {
    pushBlockerOnce(blockers, blocker(
      'scope-mismatch',
      '$.scope',
      'Upload execution gate requires continuation and mock harness artifact references to match exactly.'
    ));
  }

  const status: KnowledgeTeamUploadExecutionGateStatus = blockers.length === 0
    ? 'gate-ready'
    : 'blocked';

  return {
    kind: 'infra-agent.knowledge-team-upload-execution-gate',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    gateKind: 'approval-gated-dry-run',
    status,
    plannedOperation: 'stage-knowledge-pack',
    remoteWriteAllowed: false,
    liveCheckAllowed: false,
    credentialValuesExposed: false,
    credentialPresenceChecked: false,
    uploadApproved: false,
    uploadExecutionAllowed: false,
    clientCreated: false,
    adapterInjected: false,
    writeTokenIssued: false,
    executionLeaseCreated: false,
    objectWriteAttempted: false,
    metadataIndexWriteAttempted: false,
    remoteMutationPerformed: false,
    uploadCommand: null,
    target: scopeMatched ? continuation.target : emptyTarget(),
    approvalGate: {
      source: 'upload-approval-continuation',
      continuationStatus: continuation.status,
      approvalRequired: true,
      approvalProvided: continuation.approvalProvided,
      fingerprintVerified: continuation.fingerprintVerified,
      mutationApprovalRequired: true,
      mutationApprovalGranted: false,
      uploadApproved: false,
      uploadExecutionAllowed: false,
      scopeMatched
    },
    mockHarness: {
      source: 'upload-mock-harness',
      status: mockHarness.status,
      harnessKind: mockHarness.harnessKind,
      mockAdapterInstantiated: mockHarness.mockAdapterInstantiated,
      adapterName: mockHarness.adapterName,
      adapterBackendKind: mockHarness.adapterBackendKind,
      descriptorMatched: mockHarness.descriptorMatched,
      objectWriteAttempted: false,
      indexWriteAttempted: false,
      remoteMutationPerformed: false
    },
    executionBoundary: {
      dryRunOnly: true,
      artifactBytesProvided: false,
      adapterInjectionReviewed: status === 'gate-ready',
      adapterInjected: false,
      clientCreated: false,
      credentialValuesRead: false,
      credentialPresenceChecked: false,
      liveCheckPerformed: false,
      writeTokenIssued: false,
      executionLeaseCreated: false,
      rollbackPlanRequired: true,
      auditRecordRequired: true,
      uploadCommandGenerated: false,
      objectWriteAttempted: false,
      metadataIndexWriteAttempted: false,
      remoteMutationPerformed: false
    },
    readiness: {
      status,
      nextAction: status === 'gate-ready'
        ? 'request-separate-mutation-approval'
        : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: [...new Set(blockers.map(entry => entry.code))].sort(),
      blockers,
      reason: status === 'gate-ready'
        ? 'Upload execution gate is ready to request a separate mutation approval design; upload execution and remote writes remain disabled.'
        : 'Upload execution gate blockers must be resolved before requesting a separate mutation approval design.'
    }
  };
}
