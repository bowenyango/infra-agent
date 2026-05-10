import {
  computeKnowledgeTeamUploadApprovalIntentFingerprint,
  type KnowledgeTeamUploadApprovalIntentStatus
} from './team-upload-approval-intent.ts';
import {
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey,
  type KnowledgeTeamArtifactBackendKind,
  type KnowledgeTeamArtifactContentType
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadApprovalContinuationStatus =
  | 'continuation-ready'
  | 'blocked';

export type KnowledgeTeamUploadApprovalContinuationNextAction =
  | 'inject-approved-adapter-dependencies'
  | 'resolve-blockers';

export type KnowledgeTeamUploadApprovalContinuationBlockerCode =
  | 'approval-fingerprint-forged'
  | 'approval-fingerprint-mismatch'
  | 'approval-fingerprint-missing'
  | 'backend-detail-leak'
  | 'client-created'
  | 'credential-presence-check-enabled'
  | 'credential-values-exposed'
  | 'invalid-intent-kind'
  | 'invalid-schema-version'
  | 'intent-not-approval-required'
  | 'live-check-enabled'
  | 'missing-required-field'
  | 'mutation-enabled'
  | 'remote-write-enabled'
  | 'unsafe-approval-fingerprint'
  | 'unsafe-artifact-reference'
  | 'upload-approval-already-provided'
  | 'upload-command-present'
  | 'upload-execution-enabled';

export interface KnowledgeTeamUploadApprovalContinuationBlocker {
  code: KnowledgeTeamUploadApprovalContinuationBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadApprovalContinuation {
  kind: 'infra-agent.knowledge-team-upload-approval-continuation';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  status: KnowledgeTeamUploadApprovalContinuationStatus;
  plannedOperation: 'stage-knowledge-pack';
  remoteWriteAllowed: false;
  liveCheckAllowed: false;
  credentialValuesExposed: false;
  credentialPresenceChecked: false;
  uploadApproved: false;
  uploadExecutionAllowed: false;
  clientCreated: false;
  uploadCommand: null;
  backendKind: 's3-compatible' | 'unsupported';
  target: {
    publicationBackendKind: KnowledgeTeamArtifactBackendKind | 'unsupported';
    manifestId: string | null;
    objectKey: string | null;
    objectSha256: string | null;
    objectByteLength: number | null;
    objectContentType: KnowledgeTeamArtifactContentType | null;
    artifactId: string | null;
    configName: string | null;
    storageProfileRef: string | null;
    authProfileRef: string | null;
  };
  approval: {
    required: true;
    provided: boolean;
    source: 'cli-flag' | null;
    intentStatus: KnowledgeTeamUploadApprovalIntentStatus | 'invalid' | null;
    suppliedFingerprint: string | null;
    expectedFingerprint: string | null;
    fingerprintVerified: boolean;
  };
  credentialBoundary: {
    mode: 'environment';
    requiredEnvironmentVariableCount: number;
    optionalEnvironmentVariableCount: number;
    credentialValuesRead: false;
    credentialPresenceChecked: false;
  };
  adapterBoundary: {
    dependencyInjectionRequired: true;
    adapterInjected: false;
    adapterResolutionStatus: 'not-resolved';
    realBackendImplemented: false;
    remoteWriteCapabilityEnabled: false;
  };
  readiness: {
    status: KnowledgeTeamUploadApprovalContinuationStatus;
    nextAction: KnowledgeTeamUploadApprovalContinuationNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadApprovalContinuationBlockerCode[];
    blockers: KnowledgeTeamUploadApprovalContinuationBlocker[];
    reason: string;
  };
}

interface ParsedIntentForContinuation {
  intentStatus: KnowledgeTeamUploadApprovalIntentStatus | 'invalid' | null;
  backendKind: 's3-compatible' | 'unsupported';
  publicationBackendKind: KnowledgeTeamArtifactBackendKind | 'unsupported';
  manifestId: string | null;
  objectKey: string | null;
  objectSha256: string | null;
  objectByteLength: number | null;
  objectContentType: KnowledgeTeamArtifactContentType | null;
  artifactId: string | null;
  configName: string | null;
  storageProfileRef: string | null;
  authProfileRef: string | null;
  requiredEnvironmentVariableCount: number;
  optionalEnvironmentVariableCount: number;
  expectedFingerprint: string | null;
}

const SAFE_SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const SAFE_REFERENCE_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,127}$/;
const SAFE_ENV_VAR_NAME_PATTERN = /^[A-Z_][A-Z0-9_]{0,127}$/;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|credentialValue|secret|token|password|authorization|header|accessKey|sessionToken|clientConfig|signedUrl)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|secret|token|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function blocker(
  code: KnowledgeTeamUploadApprovalContinuationBlockerCode,
  path: string,
  message: string
): KnowledgeTeamUploadApprovalContinuationBlocker {
  return { code, path, message };
}

function pushBlockerOnce(
  blockers: KnowledgeTeamUploadApprovalContinuationBlocker[],
  nextBlocker: KnowledgeTeamUploadApprovalContinuationBlocker
): void {
  if (!blockers.some(entry => entry.code === nextBlocker.code && entry.path === nextBlocker.path)) {
    blockers.push(nextBlocker);
  }
}

function checkNoContinuationLeakage(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadApprovalContinuationBlocker[]
): void {
  if (typeof value === 'string') {
    if (SAFE_ENV_VAR_NAME_PATTERN.test(value)) {
      return;
    }
    if (FORBIDDEN_LEAK_VALUE_PATTERN.test(value)) {
      pushBlockerOnce(blockers, blocker(
        'backend-detail-leak',
        path,
        'Upload approval continuation inputs must not expose backend details, credential values, upload commands, or absolute paths.'
      ));
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      checkNoContinuationLeakage(entry, `${path}[${index}]`, blockers);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    const safeCredentialBoundaryFlag = key === 'credentialValuesExposed'
      || key === 'credentialValuesRead'
      || key === 'credentialPresenceChecked';
    if (!safeCredentialBoundaryFlag && FORBIDDEN_LEAK_KEY_PATTERN.test(key)) {
      pushBlockerOnce(blockers, blocker(
        'backend-detail-leak',
        entryPath,
        'Upload approval continuation inputs must not include backend detail or credential fields.'
      ));
    }
    checkNoContinuationLeakage(entry, entryPath, blockers);
  }
}

function readSafeString(
  value: unknown,
  path: string,
  pattern: RegExp,
  code: KnowledgeTeamUploadApprovalContinuationBlockerCode,
  blockers: KnowledgeTeamUploadApprovalContinuationBlocker[]
): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      path,
      'Upload approval continuation requires this field.'
    ));
    return null;
  }
  if (!pattern.test(value)) {
    pushBlockerOnce(blockers, blocker(
      code,
      path,
      'Upload approval continuation requires safe artifact, reference, or fingerprint values.'
    ));
    return null;
  }
  return value;
}

function readPositiveInteger(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadApprovalContinuationBlocker[]
): number | null {
  if (!Number.isInteger(value) || (value as number) < 1) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      path,
      'Upload approval continuation requires this positive count.'
    ));
    return null;
  }
  return value as number;
}

function readEnvironmentVariableCount(value: unknown): number {
  return Array.isArray(value)
    ? value.filter(entry => typeof entry === 'string').length
    : 0;
}

function parseIntentForContinuation(
  input: unknown,
  blockers: KnowledgeTeamUploadApprovalContinuationBlocker[]
): ParsedIntentForContinuation {
  const empty: ParsedIntentForContinuation = {
    intentStatus: null,
    backendKind: 'unsupported',
    publicationBackendKind: 'unsupported',
    manifestId: null,
    objectKey: null,
    objectSha256: null,
    objectByteLength: null,
    objectContentType: null,
    artifactId: null,
    configName: null,
    storageProfileRef: null,
    authProfileRef: null,
    requiredEnvironmentVariableCount: 0,
    optionalEnvironmentVariableCount: 0,
    expectedFingerprint: null
  };

  if (!isRecord(input)) {
    pushBlockerOnce(blockers, blocker(
      'invalid-intent-kind',
      '$',
      'Upload approval continuation requires an upload approval intent JSON object.'
    ));
    return empty;
  }

  checkNoContinuationLeakage(input, '$', blockers);

  if (input.kind !== 'infra-agent.knowledge-team-upload-approval-intent') {
    pushBlockerOnce(blockers, blocker(
      'invalid-intent-kind',
      '$.kind',
      'Upload approval continuation requires infra-agent.knowledge-team-upload-approval-intent input.'
    ));
  }
  if (input.schemaVersion !== 1) {
    pushBlockerOnce(blockers, blocker(
      'invalid-schema-version',
      '$.schemaVersion',
      'Upload approval continuation requires schemaVersion 1 input.'
    ));
  }
  if (input.mutationAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'mutation-enabled',
      '$.mutationAllowed',
      'Upload approval continuation input must keep mutation disabled.'
    ));
  }
  if (input.executionMode !== 'dry-run') {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.executionMode',
      'Upload approval continuation requires dry-run intent input.'
    ));
  }
  if (input.remoteWriteAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'remote-write-enabled',
      '$.remoteWriteAllowed',
      'Upload approval continuation must not consume remote-write-enabled intent input.'
    ));
  }
  if (input.liveCheckAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'live-check-enabled',
      '$.liveCheckAllowed',
      'Upload approval continuation must not consume live-check-enabled intent input.'
    ));
  }
  if (input.credentialValuesExposed !== false) {
    pushBlockerOnce(blockers, blocker(
      'credential-values-exposed',
      '$.credentialValuesExposed',
      'Upload approval continuation must not consume credential values.'
    ));
  }
  if (input.credentialPresenceChecked !== false) {
    pushBlockerOnce(blockers, blocker(
      'credential-presence-check-enabled',
      '$.credentialPresenceChecked',
      'Upload approval continuation must not consume credential presence checks.'
    ));
  }
  if (input.uploadCommand !== null) {
    pushBlockerOnce(blockers, blocker(
      'upload-command-present',
      '$.uploadCommand',
      'Upload approval continuation must not consume upload commands.'
    ));
  }
  if (input.status !== 'approval-required') {
    pushBlockerOnce(blockers, blocker(
      'intent-not-approval-required',
      '$.status',
      'Upload approval continuation requires an approval-required intent.'
    ));
  }

  const backendKind = input.backendKind === 's3-compatible'
    ? 's3-compatible'
    : 'unsupported';
  const publicationBackendKind = input.publicationBackendKind === 'mock-s3-compatible'
    ? 'mock-s3-compatible'
    : 'unsupported';
  const manifestId = readSafeString(input.manifestId, '$.manifestId', SAFE_ID_PATTERN, 'unsafe-artifact-reference', blockers);
  const object = isRecord(input.object) ? input.object : {};
  if (!isRecord(input.object)) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.object',
      'Upload approval continuation requires intent object metadata.'
    ));
  }
  const objectKey = typeof object.key === 'string' && isSafeKnowledgeTeamArtifactObjectKey(object.key)
    ? object.key
    : null;
  if (objectKey === null) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-artifact-reference',
      '$.object.key',
      'Upload approval continuation requires a safe content-addressed object key.'
    ));
  }
  const objectSha = typeof object.sha256 === 'string' && isKnowledgeTeamArtifactSha256(object.sha256)
    ? object.sha256
    : null;
  if (objectSha === null) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-artifact-reference',
      '$.object.sha256',
      'Upload approval continuation requires a safe artifact SHA-256.'
    ));
  }
  const objectByteLength = readPositiveInteger(object.byteLength, '$.object.byteLength', blockers);
  const objectContentType = object.contentType === 'application/json'
    ? 'application/json'
    : null;
  if (objectContentType === null) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.object.contentType',
      'Upload approval continuation currently supports application/json artifacts only.'
    ));
  }

  const artifact = isRecord(input.artifact) ? input.artifact : {};
  if (!isRecord(input.artifact)) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.artifact',
      'Upload approval continuation requires artifact metadata.'
    ));
  }
  const artifactId = readSafeString(artifact.id, '$.artifact.id', SAFE_ID_PATTERN, 'unsafe-artifact-reference', blockers);
  const preconditions = isRecord(input.preconditions) ? input.preconditions : {};
  const backendReference = isRecord(preconditions.backendReference) ? preconditions.backendReference : {};
  const credentialBoundary = isRecord(preconditions.credentialBoundary) ? preconditions.credentialBoundary : {};
  const uploadApproval = isRecord(preconditions.uploadApproval) ? preconditions.uploadApproval : {};

  if (uploadApproval.approvalProvided !== false) {
    pushBlockerOnce(blockers, blocker(
      'upload-approval-already-provided',
      '$.preconditions.uploadApproval.approvalProvided',
      'Upload approval intent must not already claim approval.'
    ));
  }
  if (uploadApproval.uploadCommandGenerated !== false) {
    pushBlockerOnce(blockers, blocker(
      'upload-command-present',
      '$.preconditions.uploadApproval.uploadCommandGenerated',
      'Upload approval continuation must not consume generated upload commands.'
    ));
  }

  const configName = readSafeString(backendReference.configName, '$.preconditions.backendReference.configName', SAFE_REFERENCE_PATTERN, 'unsafe-artifact-reference', blockers);
  const storageProfileRef = readSafeString(backendReference.storageProfileRef, '$.preconditions.backendReference.storageProfileRef', SAFE_REFERENCE_PATTERN, 'unsafe-artifact-reference', blockers);
  const authProfileRef = readSafeString(backendReference.authProfileRef, '$.preconditions.backendReference.authProfileRef', SAFE_REFERENCE_PATTERN, 'unsafe-artifact-reference', blockers);
  const declaredFingerprint = isRecord(input.approvalFingerprint)
    && input.approvalFingerprint.algorithm === 'sha256'
    && input.approvalFingerprint.scope === 'stage-knowledge-pack-intent-v1'
    && typeof input.approvalFingerprint.value === 'string'
    && SAFE_SHA256_PATTERN.test(input.approvalFingerprint.value)
    ? input.approvalFingerprint.value
    : null;
  if (declaredFingerprint === null) {
    pushBlockerOnce(blockers, blocker(
      'approval-fingerprint-missing',
      '$.approvalFingerprint.value',
      'Upload approval continuation requires an intent approval fingerprint.'
    ));
  }

  const expectedFingerprint = computeKnowledgeTeamUploadApprovalIntentFingerprint({
    enabled: input.status === 'approval-required',
    plannedOperation: 'stage-knowledge-pack',
    backendKind,
    publicationBackendKind,
    manifestId,
    object: {
      key: objectKey,
      sha256: objectSha,
      byteLength: objectByteLength,
      contentType: objectContentType
    },
    artifactId,
    configName,
    storageProfileRef,
    authProfileRef
  }).value;

  if (declaredFingerprint !== null && expectedFingerprint !== null && declaredFingerprint !== expectedFingerprint) {
    pushBlockerOnce(blockers, blocker(
      'approval-fingerprint-forged',
      '$.approvalFingerprint.value',
      'Upload approval continuation intent fingerprint must match the deterministic scope.'
    ));
  }

  return {
    intentStatus: input.status === 'approval-required' || input.status === 'blocked'
      ? input.status
      : 'invalid',
    backendKind,
    publicationBackendKind,
    manifestId,
    objectKey,
    objectSha256: objectSha,
    objectByteLength,
    objectContentType,
    artifactId,
    configName,
    storageProfileRef,
    authProfileRef,
    requiredEnvironmentVariableCount: readEnvironmentVariableCount(credentialBoundary.requiredEnvironmentVariables),
    optionalEnvironmentVariableCount: readEnvironmentVariableCount(credentialBoundary.optionalEnvironmentVariables),
    expectedFingerprint
  };
}

function readSuppliedFingerprint(
  value: unknown,
  blockers: KnowledgeTeamUploadApprovalContinuationBlocker[]
): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    pushBlockerOnce(blockers, blocker(
      'approval-fingerprint-missing',
      '$.approvalFingerprint',
      'Upload approval continuation requires an explicit approval fingerprint.'
    ));
    return null;
  }
  if (!SAFE_SHA256_PATTERN.test(value)) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-approval-fingerprint',
      '$.approvalFingerprint',
      'Upload approval continuation requires a SHA-256 approval fingerprint.'
    ));
    return null;
  }
  return value;
}

function continuationReason(status: KnowledgeTeamUploadApprovalContinuationStatus): string {
  return status === 'continuation-ready'
    ? 'Explicit upload approval scope was recorded as private continuation state; no upload, client creation, credential read, or remote write has executed.'
    : 'Upload approval continuation is blocked until the intent and explicit fingerprint match safe dry-run preconditions.';
}

export function buildKnowledgeTeamUploadApprovalContinuation(input: {
  approvalIntent: unknown;
  approvalFingerprint: unknown;
}): KnowledgeTeamUploadApprovalContinuation {
  const blockers: KnowledgeTeamUploadApprovalContinuationBlocker[] = [];
  const intent = parseIntentForContinuation(input.approvalIntent, blockers);
  const suppliedFingerprint = readSuppliedFingerprint(input.approvalFingerprint, blockers);

  if (
    suppliedFingerprint !== null
    && intent.expectedFingerprint !== null
    && suppliedFingerprint !== intent.expectedFingerprint
  ) {
    pushBlockerOnce(blockers, blocker(
      'approval-fingerprint-mismatch',
      '$.approvalFingerprint',
      'Supplied approval fingerprint does not match the intent scope.'
    ));
  }

  const status: KnowledgeTeamUploadApprovalContinuationStatus = blockers.length === 0
    ? 'continuation-ready'
    : 'blocked';
  const fingerprintVerified = status === 'continuation-ready'
    && suppliedFingerprint !== null
    && intent.expectedFingerprint !== null
    && suppliedFingerprint === intent.expectedFingerprint;
  const blockerCodes = [...new Set(blockers.map(entry => entry.code))].sort();

  return {
    kind: 'infra-agent.knowledge-team-upload-approval-continuation',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    status,
    plannedOperation: 'stage-knowledge-pack',
    remoteWriteAllowed: false,
    liveCheckAllowed: false,
    credentialValuesExposed: false,
    credentialPresenceChecked: false,
    uploadApproved: false,
    uploadExecutionAllowed: false,
    clientCreated: false,
    uploadCommand: null,
    backendKind: intent.backendKind,
    target: {
      publicationBackendKind: intent.publicationBackendKind,
      manifestId: intent.manifestId,
      objectKey: intent.objectKey,
      objectSha256: intent.objectSha256,
      objectByteLength: intent.objectByteLength,
      objectContentType: intent.objectContentType,
      artifactId: intent.artifactId,
      configName: intent.configName,
      storageProfileRef: intent.storageProfileRef,
      authProfileRef: intent.authProfileRef
    },
    approval: {
      required: true,
      provided: suppliedFingerprint !== null,
      source: suppliedFingerprint === null ? null : 'cli-flag',
      intentStatus: intent.intentStatus,
      suppliedFingerprint,
      expectedFingerprint: intent.expectedFingerprint,
      fingerprintVerified
    },
    credentialBoundary: {
      mode: 'environment',
      requiredEnvironmentVariableCount: intent.requiredEnvironmentVariableCount,
      optionalEnvironmentVariableCount: intent.optionalEnvironmentVariableCount,
      credentialValuesRead: false,
      credentialPresenceChecked: false
    },
    adapterBoundary: {
      dependencyInjectionRequired: true,
      adapterInjected: false,
      adapterResolutionStatus: 'not-resolved',
      realBackendImplemented: false,
      remoteWriteCapabilityEnabled: false
    },
    readiness: {
      status,
      nextAction: status === 'continuation-ready'
        ? 'inject-approved-adapter-dependencies'
        : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes,
      blockers,
      reason: continuationReason(status)
    }
  };
}
