import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  createMockKnowledgeTeamBackendAdapter
} from './team-backend-adapter-mock.ts';
import {
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadMockHarnessStatus =
  | 'harness-ready'
  | 'blocked';

export type KnowledgeTeamUploadMockHarnessNextAction =
  | 'run-mock-only-contract-tests'
  | 'resolve-blockers';

export type KnowledgeTeamUploadMockHarnessBlockerCode =
  | 'adapter-capability-disabled'
  | 'adapter-credential-values-exposed'
  | 'adapter-injected'
  | 'adapter-live-check-enabled'
  | 'adapter-remote-write-enabled'
  | 'adapter-resolution-not-ready'
  | 'adapter-upload-command-present'
  | 'backend-detail-leak'
  | 'client-created'
  | 'credential-presence-check-enabled'
  | 'credential-values-exposed'
  | 'invalid-preflight-kind'
  | 'invalid-schema-version'
  | 'live-check-enabled'
  | 'missing-required-field'
  | 'mock-adapter-descriptor-mismatch'
  | 'mock-adapter-factory-failed'
  | 'mock-artifact-store-unavailable'
  | 'mock-metadata-index-unavailable'
  | 'mutation-enabled'
  | 'preflight-not-ready'
  | 'real-backend-not-implemented'
  | 'remote-write-enabled'
  | 'unsupported-adapter-backend'
  | 'upload-approval-already-provided'
  | 'upload-command-present'
  | 'upload-execution-enabled'
  | 'unsafe-adapter-name'
  | 'unsafe-artifact-reference';

export interface KnowledgeTeamUploadMockHarnessBlocker {
  code: KnowledgeTeamUploadMockHarnessBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadMockHarness {
  kind: 'infra-agent.knowledge-team-upload-mock-harness';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  harnessKind: 'in-memory-mock';
  status: KnowledgeTeamUploadMockHarnessStatus;
  plannedOperation: 'stage-knowledge-pack';
  remoteWriteAllowed: false;
  liveCheckAllowed: false;
  credentialValuesExposed: false;
  credentialPresenceChecked: false;
  uploadApproved: false;
  uploadExecutionAllowed: false;
  clientCreated: false;
  adapterInjected: false;
  mockAdapterInstantiated: boolean;
  objectWriteAttempted: false;
  metadataIndexWriteAttempted: false;
  remoteMutationPerformed: false;
  uploadCommand: null;
  preflight: {
    status: 'preflight-ready' | 'blocked' | 'invalid';
    adapterName: string | null;
    adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
    injectionCandidate: boolean;
    manifestId: string | null;
    objectKey: string | null;
    objectSha256: string | null;
    artifactId: string | null;
  };
  mockHarness: {
    adapterFactory: 'createMockKnowledgeTeamBackendAdapter';
    adapterName: string | null;
    backendKind: 'mock-s3-compatible' | 'unsupported';
    descriptorMatched: boolean;
    artifactObjectStoreAvailable: boolean;
    metadataIndexAvailable: boolean;
    objectWriteAttempted: false;
    indexWriteAttempted: false;
    remoteMutationPerformed: false;
  };
  readiness: {
    status: KnowledgeTeamUploadMockHarnessStatus;
    nextAction: KnowledgeTeamUploadMockHarnessNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadMockHarnessBlockerCode[];
    blockers: KnowledgeTeamUploadMockHarnessBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadMockHarnessInput {
  preflight: unknown;
}

interface ParsedPreflightForMockHarness {
  status: 'preflight-ready' | 'blocked' | 'invalid';
  adapterName: string | null;
  adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
  injectionCandidate: boolean;
  manifestId: string | null;
  objectKey: string | null;
  objectSha256: string | null;
  artifactId: string | null;
}

interface MockHarnessProbe {
  mockAdapterInstantiated: boolean;
  descriptorMatched: boolean;
  artifactObjectStoreAvailable: boolean;
  metadataIndexAvailable: boolean;
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|credentialValue|secret|token|password|authorization|header|accessKey|sessionToken|client|clientConfig|signedUrl|putObject|putEntry|fetch|artifactStore|metadataIndex)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|secret|token|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;
const SAFE_CONTROL_KEYS = new Set([
  'adapterDependency',
  'adapterInjected',
  'capabilities',
  'clientCreated',
  'credentialPresenceChecked',
  'credentialValuesExposed',
  'liveCheckAllowed',
  'metadataIndex',
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
  code: KnowledgeTeamUploadMockHarnessBlockerCode,
  path: string,
  message: string
): KnowledgeTeamUploadMockHarnessBlocker {
  return {
    code,
    path,
    message
  };
}

function pushBlockerOnce(
  blockers: KnowledgeTeamUploadMockHarnessBlocker[],
  nextBlocker: KnowledgeTeamUploadMockHarnessBlocker
): void {
  if (!blockers.some(entry => entry.code === nextBlocker.code && entry.path === nextBlocker.path)) {
    blockers.push(nextBlocker);
  }
}

function checkNoMockHarnessLeakage(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadMockHarnessBlocker[]
): void {
  if (typeof value === 'string') {
    if (FORBIDDEN_LEAK_VALUE_PATTERN.test(value)) {
      pushBlockerOnce(blockers, blocker(
        'backend-detail-leak',
        path,
        'Upload mock harness inputs must not expose backend details, credential values, commands, client fields, or absolute paths.'
      ));
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      checkNoMockHarnessLeakage(entry, `${path}[${index}]`, blockers);
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
        'Upload mock harness inputs must not include backend detail, credential, command, client, store, or index fields.'
      ));
    }
    checkNoMockHarnessLeakage(entry, entryPath, blockers);
  }
}

function readSafeId(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadMockHarnessBlocker[]
): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      path,
      'Upload mock harness requires this field.'
    ));
    return null;
  }
  if (!SAFE_ID_PATTERN.test(value)) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-artifact-reference',
      path,
      'Upload mock harness requires safe artifact identifiers.'
    ));
    return null;
  }
  return value;
}

function readSafeObjectKey(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadMockHarnessBlocker[]
): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      path,
      'Upload mock harness requires this field.'
    ));
    return null;
  }
  if (!isSafeKnowledgeTeamArtifactObjectKey(value)) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-artifact-reference',
      path,
      'Upload mock harness requires a safe content-addressed object key.'
    ));
    return null;
  }
  return value;
}

function readSafeSha256(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadMockHarnessBlocker[]
): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      path,
      'Upload mock harness requires this field.'
    ));
    return null;
  }
  if (!isKnowledgeTeamArtifactSha256(value)) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-artifact-reference',
      path,
      'Upload mock harness requires safe SHA-256 artifact references.'
    ));
    return null;
  }
  return value;
}

function parsePreflightForMockHarness(
  input: unknown,
  blockers: KnowledgeTeamUploadMockHarnessBlocker[]
): ParsedPreflightForMockHarness {
  const empty: ParsedPreflightForMockHarness = {
    status: 'invalid',
    adapterName: null,
    adapterBackendKind: 'unsupported',
    injectionCandidate: false,
    manifestId: null,
    objectKey: null,
    objectSha256: null,
    artifactId: null
  };

  if (!isRecord(input)) {
    pushBlockerOnce(blockers, blocker(
      'invalid-preflight-kind',
      '$.preflight',
      'Upload mock harness requires a preflight JSON object.'
    ));
    return empty;
  }

  if (input.kind !== 'infra-agent.knowledge-team-upload-adapter-preflight') {
    pushBlockerOnce(blockers, blocker(
      'invalid-preflight-kind',
      '$.preflight.kind',
      'Upload mock harness requires an upload adapter preflight artifact.'
    ));
  }
  if (input.schemaVersion !== 1) {
    pushBlockerOnce(blockers, blocker(
      'invalid-schema-version',
      '$.preflight.schemaVersion',
      'Upload mock harness requires preflight schemaVersion 1.'
    ));
  }
  if (input.mutationAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'mutation-enabled',
      '$.preflight.mutationAllowed',
      'Upload mock harness requires mutationAllowed=false.'
    ));
  }
  if (input.remoteWriteAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'remote-write-enabled',
      '$.preflight.remoteWriteAllowed',
      'Upload mock harness requires remote writes to remain disabled.'
    ));
  }
  if (input.liveCheckAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'live-check-enabled',
      '$.preflight.liveCheckAllowed',
      'Upload mock harness requires live backend checks to remain disabled.'
    ));
  }
  if (input.credentialValuesExposed !== false) {
    pushBlockerOnce(blockers, blocker(
      'credential-values-exposed',
      '$.preflight.credentialValuesExposed',
      'Upload mock harness must not expose credential values.'
    ));
  }
  if (input.credentialPresenceChecked !== false) {
    pushBlockerOnce(blockers, blocker(
      'credential-presence-check-enabled',
      '$.preflight.credentialPresenceChecked',
      'Upload mock harness must not check credential presence.'
    ));
  }
  if (input.uploadApproved !== false) {
    pushBlockerOnce(blockers, blocker(
      'upload-approval-already-provided',
      '$.preflight.uploadApproved',
      'Upload mock harness must not convert preflight into upload approval.'
    ));
  }
  if (input.uploadExecutionAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'upload-execution-enabled',
      '$.preflight.uploadExecutionAllowed',
      'Upload mock harness must not allow upload execution.'
    ));
  }
  if (input.clientCreated !== false) {
    pushBlockerOnce(blockers, blocker(
      'client-created',
      '$.preflight.clientCreated',
      'Upload mock harness must not create clients.'
    ));
  }
  if (input.adapterInjected !== false) {
    pushBlockerOnce(blockers, blocker(
      'adapter-injected',
      '$.preflight.adapterInjected',
      'Upload mock harness must not receive already-injected adapters.'
    ));
  }
  if (input.uploadCommand !== null) {
    pushBlockerOnce(blockers, blocker(
      'upload-command-present',
      '$.preflight.uploadCommand',
      'Upload mock harness must not include upload commands.'
    ));
  }

  const status = input.status === 'preflight-ready'
    ? 'preflight-ready'
    : input.status === 'blocked'
      ? 'blocked'
      : 'invalid';
  if (status !== 'preflight-ready') {
    pushBlockerOnce(blockers, blocker(
      'preflight-not-ready',
      '$.preflight.status',
      'Upload mock harness requires preflight-ready input.'
    ));
  }

  const dependency = isRecord(input.adapterDependency) ? input.adapterDependency : {};
  const adapterName = typeof dependency.adapterName === 'string'
    ? dependency.adapterName
    : null;
  if (adapterName === null || !isSafeKnowledgeTeamBackendAdapterName(adapterName)) {
    pushBlockerOnce(blockers, blocker(
      adapterName === null ? 'missing-required-field' : 'unsafe-adapter-name',
      '$.preflight.adapterDependency.adapterName',
      'Upload mock harness requires a safe mock adapter name.'
    ));
  }
  const adapterBackendKind = dependency.backendKind === 'mock-s3-compatible' || dependency.backendKind === 's3-compatible'
    ? dependency.backendKind
    : 'unsupported';
  if (adapterBackendKind === 's3-compatible') {
    pushBlockerOnce(blockers, blocker(
      'real-backend-not-implemented',
      '$.preflight.adapterDependency.backendKind',
      'Upload mock harness cannot use real S3-compatible backend adapters.'
    ));
  }
  if (adapterBackendKind !== 'mock-s3-compatible') {
    pushBlockerOnce(blockers, blocker(
      'unsupported-adapter-backend',
      '$.preflight.adapterDependency.backendKind',
      'Upload mock harness only accepts mock-s3-compatible adapter dependencies.'
    ));
  }
  if (dependency.injectionCandidate !== true) {
    pushBlockerOnce(blockers, blocker(
      'adapter-resolution-not-ready',
      '$.preflight.adapterDependency.injectionCandidate',
      'Upload mock harness requires an injection candidate.'
    ));
  }
  if (dependency.resolutionStatus !== 'resolvable') {
    pushBlockerOnce(blockers, blocker(
      'adapter-resolution-not-ready',
      '$.preflight.adapterDependency.resolutionStatus',
      'Upload mock harness requires a resolvable mock adapter dependency.'
    ));
  }
  if (dependency.artifactObjectStore !== true || dependency.metadataIndex !== true) {
    pushBlockerOnce(blockers, blocker(
      'adapter-capability-disabled',
      '$.preflight.adapterDependency',
      'Upload mock harness requires mock object store and metadata index capabilities.'
    ));
  }
  if (dependency.remoteWriteAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'adapter-remote-write-enabled',
      '$.preflight.adapterDependency.remoteWriteAllowed',
      'Upload mock harness requires adapter remote writes to remain disabled.'
    ));
  }
  if (dependency.liveCheckAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'adapter-live-check-enabled',
      '$.preflight.adapterDependency.liveCheckAllowed',
      'Upload mock harness requires adapter live checks to remain disabled.'
    ));
  }
  if (dependency.credentialValuesExposed !== false) {
    pushBlockerOnce(blockers, blocker(
      'adapter-credential-values-exposed',
      '$.preflight.adapterDependency.credentialValuesExposed',
      'Upload mock harness requires adapter credentials to remain hidden.'
    ));
  }
  if (dependency.uploadCommand !== null) {
    pushBlockerOnce(blockers, blocker(
      'adapter-upload-command-present',
      '$.preflight.adapterDependency.uploadCommand',
      'Upload mock harness requires adapter dependencies without upload commands.'
    ));
  }

  const continuation = isRecord(input.continuation) ? input.continuation : {};
  return {
    status,
    adapterName,
    adapterBackendKind,
    injectionCandidate: dependency.injectionCandidate === true,
    manifestId: readSafeId(continuation.manifestId, '$.preflight.continuation.manifestId', blockers),
    objectKey: readSafeObjectKey(continuation.objectKey, '$.preflight.continuation.objectKey', blockers),
    objectSha256: readSafeSha256(continuation.objectSha256, '$.preflight.continuation.objectSha256', blockers),
    artifactId: readSafeId(continuation.artifactId, '$.preflight.continuation.artifactId', blockers)
  };
}

function probeMockHarness(
  preflight: ParsedPreflightForMockHarness,
  blockers: KnowledgeTeamUploadMockHarnessBlocker[]
): MockHarnessProbe {
  const empty: MockHarnessProbe = {
    mockAdapterInstantiated: false,
    descriptorMatched: false,
    artifactObjectStoreAvailable: false,
    metadataIndexAvailable: false
  };

  if (preflight.adapterName === null || preflight.adapterBackendKind !== 'mock-s3-compatible') {
    return empty;
  }

  try {
    const adapter = createMockKnowledgeTeamBackendAdapter({
      name: preflight.adapterName
    });
    const descriptorMatched = adapter.descriptor.name === preflight.adapterName
      && adapter.descriptor.backendKind === 'mock-s3-compatible'
      && adapter.descriptor.mutationAllowed === false
      && adapter.descriptor.capabilities.remoteWriteAllowed === false
      && adapter.descriptor.capabilities.liveCheckAllowed === false
      && adapter.descriptor.capabilities.credentialValuesExposed === false
      && adapter.descriptor.capabilities.uploadCommand === null;
    if (!descriptorMatched) {
      pushBlockerOnce(blockers, blocker(
        'mock-adapter-descriptor-mismatch',
        '$.mockHarness.descriptor',
        'Upload mock harness adapter descriptor must match the preflight dependency.'
      ));
    }

    const artifactObjectStoreAvailable = adapter.artifactStore.backendKind === 'mock-s3-compatible'
      && typeof adapter.artifactStore.putObject === 'function'
      && typeof adapter.artifactStore.headObject === 'function'
      && typeof adapter.artifactStore.getObject === 'function';
    if (!artifactObjectStoreAvailable) {
      pushBlockerOnce(blockers, blocker(
        'mock-artifact-store-unavailable',
        '$.mockHarness.artifactObjectStore',
        'Upload mock harness requires an in-memory mock artifact object store.'
      ));
    }

    const metadataIndexAvailable = adapter.metadataIndex.backendKind === 'mock-s3-compatible'
      && typeof adapter.metadataIndex.putEntry === 'function'
      && typeof adapter.metadataIndex.getEntry === 'function'
      && typeof adapter.metadataIndex.findEntryForObject === 'function';
    if (!metadataIndexAvailable) {
      pushBlockerOnce(blockers, blocker(
        'mock-metadata-index-unavailable',
        '$.mockHarness.metadataIndex',
        'Upload mock harness requires an in-memory mock metadata index.'
      ));
    }

    return {
      mockAdapterInstantiated: true,
      descriptorMatched,
      artifactObjectStoreAvailable,
      metadataIndexAvailable
    };
  } catch {
    pushBlockerOnce(blockers, blocker(
      'mock-adapter-factory-failed',
      '$.mockHarness.adapterFactory',
      'Upload mock harness failed to construct a safe in-memory mock adapter.'
    ));
    return empty;
  }
}

export function buildKnowledgeTeamUploadMockHarness(
  input: KnowledgeTeamUploadMockHarnessInput
): KnowledgeTeamUploadMockHarness {
  const blockers: KnowledgeTeamUploadMockHarnessBlocker[] = [];
  checkNoMockHarnessLeakage(input.preflight, '$.preflight', blockers);

  const preflight = parsePreflightForMockHarness(input.preflight, blockers);
  const probe = blockers.length === 0
    ? probeMockHarness(preflight, blockers)
    : {
        mockAdapterInstantiated: false,
        descriptorMatched: false,
        artifactObjectStoreAvailable: false,
        metadataIndexAvailable: false
      };
  const status: KnowledgeTeamUploadMockHarnessStatus = blockers.length === 0
    ? 'harness-ready'
    : 'blocked';

  return {
    kind: 'infra-agent.knowledge-team-upload-mock-harness',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    harnessKind: 'in-memory-mock',
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
    mockAdapterInstantiated: status === 'harness-ready' && probe.mockAdapterInstantiated,
    objectWriteAttempted: false,
    metadataIndexWriteAttempted: false,
    remoteMutationPerformed: false,
    uploadCommand: null,
    preflight,
    mockHarness: {
      adapterFactory: 'createMockKnowledgeTeamBackendAdapter',
      adapterName: preflight.adapterName,
      backendKind: preflight.adapterBackendKind === 'mock-s3-compatible'
        ? 'mock-s3-compatible'
        : 'unsupported',
      descriptorMatched: status === 'harness-ready' && probe.descriptorMatched,
      artifactObjectStoreAvailable: status === 'harness-ready' && probe.artifactObjectStoreAvailable,
      metadataIndexAvailable: status === 'harness-ready' && probe.metadataIndexAvailable,
      objectWriteAttempted: false,
      indexWriteAttempted: false,
      remoteMutationPerformed: false
    },
    readiness: {
      status,
      nextAction: status === 'harness-ready'
        ? 'run-mock-only-contract-tests'
        : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: [...new Set(blockers.map(entry => entry.code))].sort(),
      blockers,
      reason: status === 'harness-ready'
        ? 'Upload mock harness is ready for mock-only contract tests; upload execution and object/index writes remain disabled.'
        : 'Upload mock harness blockers must be resolved before mock dependency injection can be tested.'
    }
  };
}
