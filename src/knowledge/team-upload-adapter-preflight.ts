import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import type {
  KnowledgeTeamBackendAdapterResolutionPlan
} from './team-backend-adapter-resolver.ts';

export type KnowledgeTeamUploadAdapterPreflightStatus =
  | 'preflight-ready'
  | 'blocked';

export type KnowledgeTeamUploadAdapterPreflightNextAction =
  | 'inject-mock-adapter-in-test-harness'
  | 'resolve-blockers';

export type KnowledgeTeamUploadAdapterPreflightBlockerCode =
  | 'adapter-capability-disabled'
  | 'adapter-credential-values-exposed'
  | 'adapter-injected'
  | 'adapter-live-check-enabled'
  | 'adapter-plan-blocked'
  | 'adapter-remote-write-enabled'
  | 'adapter-upload-command-present'
  | 'approval-fingerprint-unverified'
  | 'backend-detail-leak'
  | 'client-created'
  | 'continuation-not-ready'
  | 'credential-presence-check-enabled'
  | 'credential-values-exposed'
  | 'invalid-adapter-plan-kind'
  | 'invalid-continuation-kind'
  | 'invalid-schema-version'
  | 'missing-required-field'
  | 'mutation-enabled'
  | 'real-backend-not-implemented'
  | 'remote-write-enabled'
  | 'unsupported-adapter-backend'
  | 'upload-approval-already-provided'
  | 'upload-command-present'
  | 'upload-execution-enabled'
  | 'unsafe-adapter-name'
  | 'unsafe-artifact-reference';

export interface KnowledgeTeamUploadAdapterPreflightBlocker {
  code: KnowledgeTeamUploadAdapterPreflightBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadAdapterPreflight {
  kind: 'infra-agent.knowledge-team-upload-adapter-preflight';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  status: KnowledgeTeamUploadAdapterPreflightStatus;
  plannedOperation: 'stage-knowledge-pack';
  remoteWriteAllowed: false;
  liveCheckAllowed: false;
  credentialValuesExposed: false;
  credentialPresenceChecked: false;
  uploadApproved: false;
  uploadExecutionAllowed: false;
  clientCreated: false;
  adapterInjected: false;
  uploadCommand: null;
  continuation: {
    status: 'continuation-ready' | 'blocked' | 'invalid';
    fingerprintVerified: boolean;
    backendKind: 's3-compatible' | 'unsupported';
    manifestId: string | null;
    objectKey: string | null;
    objectSha256: string | null;
    artifactId: string | null;
  };
  adapterDependency: {
    source: 'resolution-plan' | 'none';
    dependencyInjectionOnly: true;
    injectionCandidate: boolean;
    backendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
    adapterName: string | null;
    resolutionStatus: 'resolvable' | 'blocked' | 'not-resolved';
    realBackendImplemented: false;
    artifactObjectStore: boolean;
    metadataIndex: boolean;
    contentAddressedObjectKeys: boolean;
    contentAddressedIndexKeys: boolean;
    idempotentWritesRequired: boolean;
    explicitUploadApprovalRequired: boolean;
    remoteWriteAllowed: false;
    liveCheckAllowed: false;
    credentialValuesExposed: false;
    uploadCommand: null;
  };
  readiness: {
    status: KnowledgeTeamUploadAdapterPreflightStatus;
    nextAction: KnowledgeTeamUploadAdapterPreflightNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadAdapterPreflightBlockerCode[];
    blockers: KnowledgeTeamUploadAdapterPreflightBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadAdapterPreflightInput {
  continuation: unknown;
  adapterResolutionPlan: unknown;
}

interface ParsedContinuationForPreflight {
  status: 'continuation-ready' | 'blocked' | 'invalid';
  fingerprintVerified: boolean;
  backendKind: 's3-compatible' | 'unsupported';
  manifestId: string | null;
  objectKey: string | null;
  objectSha256: string | null;
  artifactId: string | null;
}

interface ParsedAdapterPlanForPreflight {
  source: 'resolution-plan' | 'none';
  injectionCandidate: boolean;
  backendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
  adapterName: string | null;
  resolutionStatus: 'resolvable' | 'blocked' | 'not-resolved';
  artifactObjectStore: boolean;
  metadataIndex: boolean;
  contentAddressedObjectKeys: boolean;
  contentAddressedIndexKeys: boolean;
  idempotentWritesRequired: boolean;
  explicitUploadApprovalRequired: boolean;
}

const SAFE_SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const SAFE_OBJECT_KEY_PATTERN = /^[a-f0-9]{2}\/[a-f0-9]{64}\.json$/;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|credentialValue|secret|token|password|authorization|header|accessKey|sessionToken|client|clientConfig|signedUrl|putObject|fetch)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|secret|token|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;
const SAFE_CONTROL_KEYS = new Set([
  'adapterBoundary',
  'adapterInjected',
  'capabilities',
  'clientCreated',
  'credentialBoundary',
  'credentialPresenceChecked',
  'credentialValuesExposed',
  'credentialValuesRead',
  'liveCheckAllowed',
  'objectKey',
  'remoteWriteAllowed',
  'uploadApproved',
  'uploadCommand',
  'uploadExecutionAllowed'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function blocker(
  code: KnowledgeTeamUploadAdapterPreflightBlockerCode,
  path: string,
  message: string
): KnowledgeTeamUploadAdapterPreflightBlocker {
  return {
    code,
    path,
    message
  };
}

function pushBlockerOnce(
  blockers: KnowledgeTeamUploadAdapterPreflightBlocker[],
  nextBlocker: KnowledgeTeamUploadAdapterPreflightBlocker
): void {
  if (!blockers.some(entry => entry.code === nextBlocker.code && entry.path === nextBlocker.path)) {
    blockers.push(nextBlocker);
  }
}

function checkNoPreflightLeakage(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadAdapterPreflightBlocker[]
): void {
  if (typeof value === 'string') {
    if (FORBIDDEN_LEAK_VALUE_PATTERN.test(value)) {
      pushBlockerOnce(blockers, blocker(
        'backend-detail-leak',
        path,
        'Upload adapter preflight inputs must not expose backend details, credential values, upload commands, client fields, or absolute paths.'
      ));
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      checkNoPreflightLeakage(entry, `${path}[${index}]`, blockers);
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
        'Upload adapter preflight inputs must not include backend detail, credential, command, or client fields.'
      ));
    }
    checkNoPreflightLeakage(entry, entryPath, blockers);
  }
}

function readSafeString(
  value: unknown,
  path: string,
  pattern: RegExp,
  code: KnowledgeTeamUploadAdapterPreflightBlockerCode,
  blockers: KnowledgeTeamUploadAdapterPreflightBlocker[]
): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      path,
      'Upload adapter preflight requires this field.'
    ));
    return null;
  }
  if (!pattern.test(value)) {
    pushBlockerOnce(blockers, blocker(
      code,
      path,
      'Upload adapter preflight requires safe artifact or adapter reference values.'
    ));
    return null;
  }
  return value;
}

function parseContinuationForPreflight(
  input: unknown,
  blockers: KnowledgeTeamUploadAdapterPreflightBlocker[]
): ParsedContinuationForPreflight {
  const empty: ParsedContinuationForPreflight = {
    status: 'invalid',
    fingerprintVerified: false,
    backendKind: 'unsupported',
    manifestId: null,
    objectKey: null,
    objectSha256: null,
    artifactId: null
  };

  if (!isRecord(input)) {
    pushBlockerOnce(blockers, blocker(
      'invalid-continuation-kind',
      '$.continuation',
      'Upload adapter preflight requires a continuation JSON object.'
    ));
    return empty;
  }

  if (input.kind !== 'infra-agent.knowledge-team-upload-approval-continuation') {
    pushBlockerOnce(blockers, blocker(
      'invalid-continuation-kind',
      '$.continuation.kind',
      'Upload adapter preflight requires an upload approval continuation artifact.'
    ));
  }
  if (input.schemaVersion !== 1) {
    pushBlockerOnce(blockers, blocker(
      'invalid-schema-version',
      '$.continuation.schemaVersion',
      'Upload adapter preflight requires continuation schemaVersion 1.'
    ));
  }
  if (input.mutationAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'mutation-enabled',
      '$.continuation.mutationAllowed',
      'Upload adapter preflight requires mutationAllowed=false.'
    ));
  }
  if (input.remoteWriteAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'remote-write-enabled',
      '$.continuation.remoteWriteAllowed',
      'Upload adapter preflight requires remote writes to remain disabled.'
    ));
  }
  if (input.liveCheckAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'adapter-live-check-enabled',
      '$.continuation.liveCheckAllowed',
      'Upload adapter preflight requires live backend checks to remain disabled.'
    ));
  }
  if (input.credentialValuesExposed !== false) {
    pushBlockerOnce(blockers, blocker(
      'credential-values-exposed',
      '$.continuation.credentialValuesExposed',
      'Upload adapter preflight must not expose credential values.'
    ));
  }
  if (input.credentialPresenceChecked !== false) {
    pushBlockerOnce(blockers, blocker(
      'credential-presence-check-enabled',
      '$.continuation.credentialPresenceChecked',
      'Upload adapter preflight must not check credential presence.'
    ));
  }
  if (input.uploadApproved !== false) {
    pushBlockerOnce(blockers, blocker(
      'upload-approval-already-provided',
      '$.continuation.uploadApproved',
      'Upload adapter preflight must not convert continuation into upload approval.'
    ));
  }
  if (input.uploadExecutionAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'upload-execution-enabled',
      '$.continuation.uploadExecutionAllowed',
      'Upload adapter preflight must not allow upload execution.'
    ));
  }
  if (input.clientCreated !== false) {
    pushBlockerOnce(blockers, blocker(
      'client-created',
      '$.continuation.clientCreated',
      'Upload adapter preflight must not create clients.'
    ));
  }
  if (input.uploadCommand !== null) {
    pushBlockerOnce(blockers, blocker(
      'upload-command-present',
      '$.continuation.uploadCommand',
      'Upload adapter preflight must not include upload commands.'
    ));
  }

  const status = input.status === 'continuation-ready'
    ? 'continuation-ready'
    : input.status === 'blocked'
      ? 'blocked'
      : 'invalid';
  if (status !== 'continuation-ready') {
    pushBlockerOnce(blockers, blocker(
      'continuation-not-ready',
      '$.continuation.status',
      'Upload adapter preflight requires continuation-ready input.'
    ));
  }

  const approval = isRecord(input.approval) ? input.approval : null;
  const fingerprintVerified = approval?.fingerprintVerified === true;
  if (!fingerprintVerified) {
    pushBlockerOnce(blockers, blocker(
      'approval-fingerprint-unverified',
      '$.continuation.approval.fingerprintVerified',
      'Upload adapter preflight requires a verified approval continuation fingerprint.'
    ));
  }

  const target = isRecord(input.target) ? input.target : {};
  return {
    status,
    fingerprintVerified,
    backendKind: input.backendKind === 's3-compatible' ? 's3-compatible' : 'unsupported',
    manifestId: readSafeString(target.manifestId, '$.continuation.target.manifestId', SAFE_ID_PATTERN, 'unsafe-artifact-reference', blockers),
    objectKey: readSafeString(target.objectKey, '$.continuation.target.objectKey', SAFE_OBJECT_KEY_PATTERN, 'unsafe-artifact-reference', blockers),
    objectSha256: readSafeString(target.objectSha256, '$.continuation.target.objectSha256', SAFE_SHA256_PATTERN, 'unsafe-artifact-reference', blockers),
    artifactId: readSafeString(target.artifactId, '$.continuation.target.artifactId', SAFE_ID_PATTERN, 'unsafe-artifact-reference', blockers)
  };
}

function parseAdapterPlanForPreflight(
  input: unknown,
  blockers: KnowledgeTeamUploadAdapterPreflightBlocker[]
): ParsedAdapterPlanForPreflight {
  const empty: ParsedAdapterPlanForPreflight = {
    source: 'none',
    injectionCandidate: false,
    backendKind: 'unsupported',
    adapterName: null,
    resolutionStatus: 'not-resolved',
    artifactObjectStore: false,
    metadataIndex: false,
    contentAddressedObjectKeys: false,
    contentAddressedIndexKeys: false,
    idempotentWritesRequired: false,
    explicitUploadApprovalRequired: false
  };

  if (!isRecord(input)) {
    pushBlockerOnce(blockers, blocker(
      'invalid-adapter-plan-kind',
      '$.adapterResolutionPlan',
      'Upload adapter preflight requires an adapter resolution plan JSON object.'
    ));
    return empty;
  }

  const plan = input as Partial<KnowledgeTeamBackendAdapterResolutionPlan>;
  if (plan.kind !== 'infra-agent.knowledge-team-backend-adapter-resolution-plan') {
    pushBlockerOnce(blockers, blocker(
      'invalid-adapter-plan-kind',
      '$.adapterResolutionPlan.kind',
      'Upload adapter preflight requires a backend adapter resolution plan.'
    ));
  }
  if (plan.schemaVersion !== 1) {
    pushBlockerOnce(blockers, blocker(
      'invalid-schema-version',
      '$.adapterResolutionPlan.schemaVersion',
      'Upload adapter preflight requires adapter plan schemaVersion 1.'
    ));
  }
  if (plan.mutationAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'mutation-enabled',
      '$.adapterResolutionPlan.mutationAllowed',
      'Upload adapter preflight requires adapter plan mutationAllowed=false.'
    ));
  }

  const backendKind = plan.backendKind === 'mock-s3-compatible' || plan.backendKind === 's3-compatible'
    ? plan.backendKind
    : 'unsupported';
  const resolutionStatus = plan.status === 'resolvable'
    ? 'resolvable'
    : plan.status === 'blocked'
      ? 'blocked'
      : 'not-resolved';
  if (resolutionStatus !== 'resolvable') {
    pushBlockerOnce(blockers, blocker(
      'adapter-plan-blocked',
      '$.adapterResolutionPlan.status',
      'Upload adapter preflight requires a resolvable mock adapter plan.'
    ));
  }
  if (backendKind === 's3-compatible') {
    pushBlockerOnce(blockers, blocker(
      'real-backend-not-implemented',
      '$.adapterResolutionPlan.backendKind',
      'Real S3-compatible backend adapter execution is not implemented in this dry-run slice.'
    ));
  }
  if (backendKind !== 'mock-s3-compatible') {
    pushBlockerOnce(blockers, blocker(
      'unsupported-adapter-backend',
      '$.adapterResolutionPlan.backendKind',
      'Upload adapter preflight only accepts mock-s3-compatible adapter plans.'
    ));
  }

  const adapterName = typeof plan.adapterName === 'string'
    ? plan.adapterName
    : null;
  if (adapterName === null || !isSafeKnowledgeTeamBackendAdapterName(adapterName)) {
    pushBlockerOnce(blockers, blocker(
      adapterName === null ? 'missing-required-field' : 'unsafe-adapter-name',
      '$.adapterResolutionPlan.adapterName',
      'Upload adapter preflight requires a safe mock adapter name.'
    ));
  }

  const capabilities = isRecord(plan.capabilities) ? plan.capabilities : {};
  const artifactObjectStore = capabilities.artifactObjectStore === true;
  const metadataIndex = capabilities.metadataIndex === true;
  const contentAddressedObjectKeys = capabilities.contentAddressedObjectKeys === true;
  const contentAddressedIndexKeys = capabilities.contentAddressedIndexKeys === true;
  const idempotentWritesRequired = capabilities.idempotentWritesRequired === true;
  const explicitUploadApprovalRequired = capabilities.explicitUploadApprovalRequired === true;
  for (const [path, enabled] of [
    ['$.adapterResolutionPlan.capabilities.artifactObjectStore', artifactObjectStore],
    ['$.adapterResolutionPlan.capabilities.metadataIndex', metadataIndex],
    ['$.adapterResolutionPlan.capabilities.contentAddressedObjectKeys', contentAddressedObjectKeys],
    ['$.adapterResolutionPlan.capabilities.contentAddressedIndexKeys', contentAddressedIndexKeys],
    ['$.adapterResolutionPlan.capabilities.idempotentWritesRequired', idempotentWritesRequired],
    ['$.adapterResolutionPlan.capabilities.explicitUploadApprovalRequired', explicitUploadApprovalRequired]
  ] as const) {
    if (!enabled) {
      pushBlockerOnce(blockers, blocker(
        'adapter-capability-disabled',
        path,
        'Upload adapter preflight requires safe mock adapter capabilities.'
      ));
    }
  }
  if (capabilities.remoteWriteAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'adapter-remote-write-enabled',
      '$.adapterResolutionPlan.capabilities.remoteWriteAllowed',
      'Upload adapter preflight requires adapter remote writes to remain disabled.'
    ));
  }
  if (capabilities.liveCheckAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'adapter-live-check-enabled',
      '$.adapterResolutionPlan.capabilities.liveCheckAllowed',
      'Upload adapter preflight requires adapter live checks to remain disabled.'
    ));
  }
  if (capabilities.credentialValuesExposed !== false) {
    pushBlockerOnce(blockers, blocker(
      'adapter-credential-values-exposed',
      '$.adapterResolutionPlan.capabilities.credentialValuesExposed',
      'Upload adapter preflight requires adapter credential values to remain hidden.'
    ));
  }
  if (capabilities.uploadCommand !== null) {
    pushBlockerOnce(blockers, blocker(
      'adapter-upload-command-present',
      '$.adapterResolutionPlan.capabilities.uploadCommand',
      'Upload adapter preflight requires adapter plans without upload commands.'
    ));
  }

  return {
    source: 'resolution-plan',
    injectionCandidate: resolutionStatus === 'resolvable' && backendKind === 'mock-s3-compatible',
    backendKind,
    adapterName,
    resolutionStatus,
    artifactObjectStore,
    metadataIndex,
    contentAddressedObjectKeys,
    contentAddressedIndexKeys,
    idempotentWritesRequired,
    explicitUploadApprovalRequired
  };
}

export function buildKnowledgeTeamUploadAdapterPreflight(
  input: KnowledgeTeamUploadAdapterPreflightInput
): KnowledgeTeamUploadAdapterPreflight {
  const blockers: KnowledgeTeamUploadAdapterPreflightBlocker[] = [];
  checkNoPreflightLeakage(input.continuation, '$.continuation', blockers);
  checkNoPreflightLeakage(input.adapterResolutionPlan, '$.adapterResolutionPlan', blockers);

  const continuation = parseContinuationForPreflight(input.continuation, blockers);
  const adapterDependency = parseAdapterPlanForPreflight(input.adapterResolutionPlan, blockers);
  const status: KnowledgeTeamUploadAdapterPreflightStatus = blockers.length === 0
    ? 'preflight-ready'
    : 'blocked';

  return {
    kind: 'infra-agent.knowledge-team-upload-adapter-preflight',
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
    adapterInjected: false,
    uploadCommand: null,
    continuation,
    adapterDependency: {
      source: adapterDependency.source,
      dependencyInjectionOnly: true,
      injectionCandidate: status === 'preflight-ready' && adapterDependency.injectionCandidate,
      backendKind: adapterDependency.backendKind,
      adapterName: adapterDependency.adapterName,
      resolutionStatus: adapterDependency.resolutionStatus,
      realBackendImplemented: false,
      artifactObjectStore: adapterDependency.artifactObjectStore,
      metadataIndex: adapterDependency.metadataIndex,
      contentAddressedObjectKeys: adapterDependency.contentAddressedObjectKeys,
      contentAddressedIndexKeys: adapterDependency.contentAddressedIndexKeys,
      idempotentWritesRequired: adapterDependency.idempotentWritesRequired,
      explicitUploadApprovalRequired: adapterDependency.explicitUploadApprovalRequired,
      remoteWriteAllowed: false,
      liveCheckAllowed: false,
      credentialValuesExposed: false,
      uploadCommand: null
    },
    readiness: {
      status,
      nextAction: status === 'preflight-ready'
        ? 'inject-mock-adapter-in-test-harness'
        : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: [...new Set(blockers.map(entry => entry.code))].sort(),
      blockers,
      reason: status === 'preflight-ready'
        ? 'Upload adapter preflight is ready for a future dry-run mock dependency injection harness; upload execution remains disabled.'
        : 'Upload adapter preflight blockers must be resolved before adapter dependency injection can be designed.'
    }
  };
}
