import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadCommandBoundaryStatus =
  | 'upload-command-boundary-ready'
  | 'blocked';

export type KnowledgeTeamUploadCommandBoundaryNextAction =
  | 'design-object-index-binding-boundary'
  | 'resolve-blockers';

export type KnowledgeTeamUploadCommandBoundaryBlockerCode =
  | 'adapter-dependency-leak'
  | 'adapter-injected'
  | 'artifact-bytes-provided'
  | 'artifact-object-store-bound'
  | 'audit-record-created'
  | 'backend-detail-leak'
  | 'client-created'
  | 'client-dependency-leak'
  | 'credential-dependency-leak'
  | 'credential-presence-check-enabled'
  | 'credential-presence-result-exposed'
  | 'credential-values-exposed'
  | 'credential-values-read'
  | 'executable-state-enabled'
  | 'execution-lease-created'
  | 'invalid-boundary-kind'
  | 'invalid-live-check-boundary-kind'
  | 'invalid-schema-version'
  | 'live-check-boundary-next-action-invalid'
  | 'live-check-boundary-not-ready'
  | 'live-check-enabled'
  | 'live-check-not-required'
  | 'live-check-result-exposed'
  | 'metadata-index-bound'
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
  | 'unsupported-adapter-backend'
  | 'unsafe-adapter-name'
  | 'unsafe-artifact-reference'
  | 'upload-approval-already-provided'
  | 'upload-command-exposed'
  | 'upload-command-generated'
  | 'upload-command-not-required'
  | 'upload-command-present'
  | 'upload-execution-enabled'
  | 'write-token-issued';

export interface KnowledgeTeamUploadCommandBoundaryBlocker {
  code: KnowledgeTeamUploadCommandBoundaryBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadCommandBoundary {
  kind: 'infra-agent.knowledge-team-upload-command-boundary';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  boundaryKind: 'upload-command-boundary-dry-run';
  status: KnowledgeTeamUploadCommandBoundaryStatus;
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
    objectKeyRedacted: true;
    objectSha256: string | null;
    artifactId: string | null;
  };
  sourceLiveCheckBoundary: {
    source: 'upload-live-check-boundary';
    boundaryStatus: 'live-check-boundary-ready' | 'blocked' | 'invalid';
    boundaryKind: 'live-check-boundary-dry-run' | 'unsupported';
    boundaryNextAction: 'design-upload-command-boundary' | 'resolve-blockers' | 'invalid';
    reviewStatus: 'review-ready' | 'blocked' | 'invalid';
    reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
    scopeMatched: boolean;
    humanReviewRecorded: boolean;
    fingerprintVerified: boolean;
    sourceFingerprintVerified: boolean;
    adapterName: string | null;
    adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
    dryRunOnly: boolean;
    liveCheckRequiredBeforeExecution: boolean;
    liveCheckRequiredAfterCredentialPresenceBoundary: boolean;
    credentialPresenceBoundaryRequired: boolean;
    credentialReadBoundaryRequired: boolean;
    credentialSourceDescriptorRequired: boolean;
    credentialReferenceOnlyRequired: boolean;
    credentialValueRedactionRequired: boolean;
    credentialPresenceSignalRequired: boolean;
    credentialPresenceResultRedactionRequired: boolean;
    mockAdapterRequired: boolean;
    clientFactoryDescriptorRequired: boolean;
    liveCheckPolicyRequired: boolean;
    liveCheckReadOnlyRequired: boolean;
    liveCheckResultRedactionRequired: boolean;
    uploadCommandBoundaryRequired: boolean;
    artifactObjectStoreDependencyRequired: boolean;
    metadataIndexDependencyRequired: boolean;
    contentAddressedObjectKeysRequired: boolean;
    contentAddressedIndexKeysRequired: boolean;
    idempotentWritesRequired: boolean;
    explicitUploadApprovalRequired: boolean;
    credentialValuesRead: boolean;
    credentialValuesExposed: boolean;
    credentialPresenceChecked: boolean;
    credentialPresenceResultExposed: boolean;
    clientCreated: boolean;
    sdkClientCreated: boolean;
    adapterInjected: boolean;
    artifactObjectStoreBound: boolean;
    metadataIndexBound: boolean;
    liveCheckAllowed: boolean;
    liveCheckPerformed: boolean;
    liveCheckResultExposed: boolean;
    uploadExecutionAllowed: boolean;
    uploadCommandGenerated: boolean;
    objectWriteAttempted: boolean;
    metadataIndexWriteAttempted: boolean;
    remoteMutationPerformed: boolean;
    executable: boolean;
  };
  uploadCommandBoundary: {
    dryRunOnly: true;
    uploadCommandRequiredBeforeExecution: true;
    uploadCommandRequiredAfterLiveCheckBoundary: true;
    liveCheckBoundaryRequired: true;
    liveCheckPolicyRequired: true;
    liveCheckResultRedactionRequired: true;
    credentialPresenceBoundaryRequired: true;
    credentialReadBoundaryRequired: true;
    credentialSourceDescriptorRequired: true;
    credentialReferenceOnlyRequired: true;
    credentialValueRedactionRequired: true;
    credentialPresenceResultRedactionRequired: true;
    mockAdapterRequired: true;
    clientFactoryDescriptorRequired: true;
    uploadCommandDescriptorRequired: true;
    uploadCommandPayloadRedactionRequired: true;
    uploadCommandMaterialRedactionRequired: true;
    commandExecutionApprovalRequired: true;
    artifactObjectStoreDependencyRequired: true;
    metadataIndexDependencyRequired: true;
    contentAddressedObjectKeysRequired: true;
    contentAddressedIndexKeysRequired: true;
    idempotentWritesRequired: true;
    explicitUploadApprovalRequired: true;
    credentialValuesRead: false;
    credentialValuesExposed: false;
    credentialPresenceChecked: false;
    credentialPresenceResultExposed: false;
    clientCreated: false;
    sdkClientCreated: false;
    adapterInjected: false;
    artifactObjectStoreBound: false;
    metadataIndexBound: false;
    liveCheckAllowed: false;
    liveCheckPerformed: false;
    liveCheckResultExposed: false;
    uploadCommandGenerated: false;
    uploadCommandMaterialized: false;
    uploadCommandExposed: false;
    uploadExecutionAllowed: false;
    objectWriteAttempted: false;
    metadataIndexWriteAttempted: false;
    remoteMutationPerformed: false;
    executable: false;
  };
  remainingExecutionBoundaries: {
    artifactBytesRequired: true;
    artifactBytesProvided: false;
    adapterInjectionRequired: true;
    adapterInjected: false;
    clientCreationRequired: true;
    clientCreated: false;
    credentialReadRequired: true;
    credentialValuesExposed: false;
    credentialPresenceCheckRequired: true;
    credentialPresenceChecked: false;
    liveCheckRequired: true;
    liveCheckPerformed: false;
    uploadCommandRequired: true;
    uploadCommandGenerated: false;
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
    status: KnowledgeTeamUploadCommandBoundaryStatus;
    nextAction: KnowledgeTeamUploadCommandBoundaryNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadCommandBoundaryBlockerCode[];
    blockers: KnowledgeTeamUploadCommandBoundaryBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadCommandBoundaryInput {
  liveCheckBoundary: unknown;
}

interface ParsedLiveCheckBoundaryForUploadCommandBoundary {
  boundaryStatus: 'live-check-boundary-ready' | 'blocked' | 'invalid';
  boundaryKind: 'live-check-boundary-dry-run' | 'unsupported';
  boundaryNextAction: 'design-upload-command-boundary' | 'resolve-blockers' | 'invalid';
  reviewStatus: 'review-ready' | 'blocked' | 'invalid';
  reviewKind: 'human-fingerprint-dry-run' | 'unsupported';
  scopeMatched: boolean;
  humanReviewRecorded: boolean;
  fingerprintVerified: boolean;
  sourceFingerprintVerified: boolean;
  adapterName: string | null;
  adapterBackendKind: 'mock-s3-compatible' | 's3-compatible' | 'unsupported';
  liveCheckBoundary: KnowledgeTeamUploadCommandBoundary['sourceLiveCheckBoundary'];
  target: KnowledgeTeamUploadCommandBoundary['target'];
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN = /(artifactBytesValue|artifactBytesBase64|artifactBytesContent|artifactBytesPayload|artifactContent|artifactPayload|rawArtifact|byteBuffer|bytesBase64|contentBase64|buffer|stream|arrayBuffer|blob|readPath|filePath|localPath|artifactPath|serializedPayload|stagedBytes)/i;
const FORBIDDEN_CLIENT_KEY_PATTERN = /(clientInstance|clientObject|clientValue|clientFactoryValue|clientDescriptorValue|clientConfig|adapterClient|^sdkClient$|sdkClientConfig|objectStoreHandle|metadataIndexHandle|putObject|putEntry|fetch|signedUrl)/i;
const FORBIDDEN_CREDENTIAL_KEY_PATTERN = /(^credentialValue$|credentialValuePayload|credentialValueMaterial|credentialMaterial|credentialFile|credentialPath|credentialsPath|secretValue|envValue|processEnv|presenceCheckResult|credentialPresenceResult(?:Value|Payload|Material|Data|Body|Response)|credentialPresenceSignalValue)/i;
const FORBIDDEN_LIVE_CHECK_KEY_PATTERN = /(^liveCheckResult$|liveCheckResult(?:Value|Payload|Material|Data|Body)|liveCheckResponse|liveCheckProbe|liveCheckRequest|liveBackendProbe|headObjectResult|headIndexResult|remoteProbeResult|connectivityResult|healthCheckResult)/i;
const FORBIDDEN_COMMAND_KEY_PATTERN = /(^uploadCommandValue$|^uploadCommandPayload$|^uploadCommandMaterial$|^uploadCommandData$|^uploadCommandBody$|^uploadCommandLine$|^commandLine$|^shellCommand$|^signedUploadCommand$)/i;
const FORBIDDEN_ADAPTER_KEY_PATTERN = /(adapterInstance|adapterObject|adapterValue|adapterDescriptorValue)/i;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|secret|password|authorization|header|accessKey|sessionToken|tokenValue|tokenMaterial|leaseValue|leaseMaterial|rollbackValue|rollbackMaterial|rollbackCommand|auditValue|auditMaterial|auditCommand)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|kubectl |curl |secret|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBool(value: unknown): boolean {
  return value === true;
}

function readBoundaryStatus(value: unknown): ParsedLiveCheckBoundaryForUploadCommandBoundary['boundaryStatus'] {
  if (value === 'live-check-boundary-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readBoundaryKind(value: unknown): ParsedLiveCheckBoundaryForUploadCommandBoundary['boundaryKind'] {
  if (value === 'live-check-boundary-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readBoundaryNextAction(value: unknown): ParsedLiveCheckBoundaryForUploadCommandBoundary['boundaryNextAction'] {
  if (value === 'design-upload-command-boundary' || value === 'resolve-blockers') {
    return value;
  }
  return 'invalid';
}

function readReviewStatus(value: unknown): ParsedLiveCheckBoundaryForUploadCommandBoundary['reviewStatus'] {
  if (value === 'review-ready' || value === 'blocked') {
    return value;
  }
  return 'invalid';
}

function readReviewKind(value: unknown): ParsedLiveCheckBoundaryForUploadCommandBoundary['reviewKind'] {
  if (value === 'human-fingerprint-dry-run') {
    return value;
  }
  return 'unsupported';
}

function readAdapterBackendKind(value: unknown): ParsedLiveCheckBoundaryForUploadCommandBoundary['adapterBackendKind'] {
  if (value === 'mock-s3-compatible' || value === 's3-compatible') {
    return value;
  }
  return 'unsupported';
}

function addBlocker(
  blockers: KnowledgeTeamUploadCommandBoundaryBlocker[],
  code: KnowledgeTeamUploadCommandBoundaryBlockerCode,
  path: string,
  message: string
): void {
  blockers.push({ code, path, message });
}

function scanForPrivateDetails(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadCommandBoundaryBlocker[]
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForPrivateDetails(entry, `${path}[${index}]`, blockers));
    return;
  }
  if (!isRecord(value)) {
    if (typeof value === 'string' && FORBIDDEN_LEAK_VALUE_PATTERN.test(value)) {
      addBlocker(blockers, 'backend-detail-leak', path, 'Upload command boundary input must not contain backend details, private paths, credentials, executable commands, live-check results, client handles, adapter instances, or raw artifact content.');
    }
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    if (FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'artifact-bytes-provided', entryPath, 'Upload command boundary input must not contain raw bytes, byte buffers, streams, content payloads, or local artifact paths.');
      continue;
    }
    if (FORBIDDEN_CLIENT_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'client-dependency-leak', entryPath, 'Upload command boundary input must not contain SDK clients, client configs, object store handles, metadata index handles, signed URLs, or write functions.');
      continue;
    }
    if (FORBIDDEN_CREDENTIAL_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'credential-dependency-leak', entryPath, 'Upload command boundary input must not contain credential values, credential files, environment reads, or credential presence results.');
      continue;
    }
    if (FORBIDDEN_LIVE_CHECK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'live-check-enabled', entryPath, 'Upload command boundary input must not contain live backend probes, live-check requests, or live-check results.');
      continue;
    }
    if (FORBIDDEN_COMMAND_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'upload-command-present', entryPath, 'Upload command boundary input must not contain upload command payloads or executable command material.');
      continue;
    }
    if (FORBIDDEN_ADAPTER_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'adapter-dependency-leak', entryPath, 'Upload command boundary input must not contain adapter instances or concrete adapter values.');
      continue;
    }
    if (FORBIDDEN_LEAK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'backend-detail-leak', entryPath, 'Upload command boundary input must not contain backend details, credential fields, commands, token/lease material, or raw artifact content.');
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
  blockers: KnowledgeTeamUploadCommandBoundaryBlocker[]
): KnowledgeTeamUploadCommandBoundary['target'] {
  if (!isRecord(value)) {
    addBlocker(blockers, 'missing-required-field', '$.liveCheckBoundary.target', 'Upload command boundary planning requires a target object.');
    addBlocker(blockers, 'unsafe-artifact-reference', '$.liveCheckBoundary.target', 'Upload command boundary planning requires safe target references.');
    return {
      manifestId: null,
      objectKeyRedacted: true,
      objectSha256: null,
      artifactId: null
    };
  }

  const manifestId = readSafeId(value.manifestId);
  const objectKey = readSafeObjectKey(value.objectKey);
  const objectSha256 = readSafeSha256(value.objectSha256);
  const artifactId = readSafeId(value.artifactId);

  if (manifestId === null || objectKey === null || objectSha256 === null || artifactId === null) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.liveCheckBoundary.target', 'Upload command boundary planning requires safe manifest, object, hash, and artifact references.');
  }

  return {
    manifestId,
    objectKeyRedacted: true,
    objectSha256,
    artifactId
  };
}

function checkFalseField(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadCommandBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadCommandBoundaryBlocker[]
): void {
  if (value[key] === true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must remain false for upload command boundary planning.`);
  }
}

function checkNullCommand(
  value: Record<string, unknown>,
  key: string,
  path: string,
  blockers: KnowledgeTeamUploadCommandBoundaryBlocker[]
): void {
  if (value[key] !== null && value[key] !== undefined) {
    addBlocker(blockers, 'upload-command-present', `${path}.${key}`, 'Upload command boundary planning must not receive upload commands.');
  }
}

function checkRequiredTrue(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadCommandBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadCommandBoundaryBlocker[]
): boolean {
  if (value[key] !== true) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be true before upload command boundary planning can proceed.`);
    return false;
  }
  return true;
}

function checkRequiredFalse(
  value: Record<string, unknown>,
  key: string,
  path: string,
  code: KnowledgeTeamUploadCommandBoundaryBlockerCode,
  blockers: KnowledgeTeamUploadCommandBoundaryBlocker[]
): boolean {
  if (value[key] !== false) {
    addBlocker(blockers, code, `${path}.${key}`, `${key} must be false before upload command boundary planning can proceed.`);
    return false;
  }
  return true;
}

function parseLiveCheckBoundaryForUploadCommandBoundary(
  value: unknown,
  blockers: KnowledgeTeamUploadCommandBoundaryBlocker[]
): ParsedLiveCheckBoundaryForUploadCommandBoundary {
  scanForPrivateDetails(value, '$.liveCheckBoundary', blockers);
  if (!isRecord(value)) {
    addBlocker(blockers, 'invalid-live-check-boundary-kind', '$.liveCheckBoundary', 'Upload command boundary planning requires a saved live check boundary artifact.');
    return emptyParsedLiveCheckBoundary();
  }

  if (value.kind !== 'infra-agent.knowledge-team-upload-live-check-boundary') {
    addBlocker(blockers, 'invalid-live-check-boundary-kind', '$.liveCheckBoundary.kind', 'Upload command boundary planning requires an infra-agent.knowledge-team-upload-live-check-boundary artifact.');
  }
  if (value.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.liveCheckBoundary.schemaVersion', 'Upload command boundary planning requires schemaVersion 1.');
  }
  if (value.boundaryKind !== 'live-check-boundary-dry-run') {
    addBlocker(blockers, 'invalid-boundary-kind', '$.liveCheckBoundary.boundaryKind', 'Upload command boundary planning requires a live-check-boundary-dry-run source.');
  }
  if (value.status !== 'live-check-boundary-ready') {
    addBlocker(blockers, 'live-check-boundary-not-ready', '$.liveCheckBoundary.status', 'Upload command boundary planning requires live-check-boundary-ready input.');
  }
  if (!isRecord(value.readiness) || value.readiness.nextAction !== 'design-upload-command-boundary') {
    addBlocker(blockers, 'live-check-boundary-next-action-invalid', '$.liveCheckBoundary.readiness.nextAction', 'Live check boundary must point to design-upload-command-boundary.');
  }

  for (const key of [
    'uploadApproved',
    'uploadExecutionAllowed',
    'mutationApprovalGranted',
    'clientCreated',
    'adapterInjected',
    'artifactBytesProvided',
    'writeTokenIssued',
    'executionLeaseCreated',
    'rollbackPlanCreated',
    'auditRecordCreated',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed'
  ]) {
    checkFalseField(value, key, '$.liveCheckBoundary', blockerCodeForFalseField(key), blockers);
  }
  checkFalseField(value, 'liveCheckAllowed', '$.liveCheckBoundary', 'live-check-enabled', blockers);
  checkFalseField(value, 'credentialValuesExposed', '$.liveCheckBoundary', 'credential-values-exposed', blockers);
  checkFalseField(value, 'credentialPresenceChecked', '$.liveCheckBoundary', 'credential-presence-check-enabled', blockers);
  checkNullCommand(value, 'uploadCommand', '$.liveCheckBoundary', blockers);

  const source = isRecord(value.sourceCredentialPresenceBoundary) ? value.sourceCredentialPresenceBoundary : {};
  const liveCheckBoundary = isRecord(value.liveCheckBoundary) ? value.liveCheckBoundary : {};
  const remainingExecutionBoundaries = isRecord(value.remainingExecutionBoundaries) ? value.remainingExecutionBoundaries : {};
  if (!isRecord(value.sourceCredentialPresenceBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.liveCheckBoundary.sourceCredentialPresenceBoundary', 'Upload command boundary planning requires sourceCredentialPresenceBoundary metadata.');
  }
  if (!isRecord(value.liveCheckBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.liveCheckBoundary.liveCheckBoundary', 'Upload command boundary planning requires liveCheckBoundary metadata.');
  }
  if (!isRecord(value.remainingExecutionBoundaries)) {
    addBlocker(blockers, 'missing-required-field', '$.liveCheckBoundary.remainingExecutionBoundaries', 'Upload command boundary planning requires remainingExecutionBoundaries metadata.');
  }

  checkRequiredTrue(liveCheckBoundary, 'dryRunOnly', '$.liveCheckBoundary.liveCheckBoundary', 'missing-required-field', blockers);
  checkRequiredTrue(liveCheckBoundary, 'liveCheckRequiredBeforeExecution', '$.liveCheckBoundary.liveCheckBoundary', 'live-check-not-required', blockers);
  checkRequiredTrue(liveCheckBoundary, 'liveCheckRequiredAfterCredentialPresenceBoundary', '$.liveCheckBoundary.liveCheckBoundary', 'live-check-not-required', blockers);
  checkRequiredTrue(liveCheckBoundary, 'uploadCommandBoundaryRequired', '$.liveCheckBoundary.liveCheckBoundary', 'upload-command-not-required', blockers);
  checkRequiredTrue(liveCheckBoundary, 'artifactObjectStoreDependencyRequired', '$.liveCheckBoundary.liveCheckBoundary', 'artifact-object-store-bound', blockers);
  checkRequiredTrue(liveCheckBoundary, 'metadataIndexDependencyRequired', '$.liveCheckBoundary.liveCheckBoundary', 'metadata-index-bound', blockers);
  checkRequiredTrue(liveCheckBoundary, 'contentAddressedObjectKeysRequired', '$.liveCheckBoundary.liveCheckBoundary', 'unsafe-artifact-reference', blockers);
  checkRequiredTrue(liveCheckBoundary, 'contentAddressedIndexKeysRequired', '$.liveCheckBoundary.liveCheckBoundary', 'unsafe-artifact-reference', blockers);
  checkRequiredTrue(liveCheckBoundary, 'idempotentWritesRequired', '$.liveCheckBoundary.liveCheckBoundary', 'remote-write-enabled', blockers);
  checkRequiredTrue(liveCheckBoundary, 'explicitUploadApprovalRequired', '$.liveCheckBoundary.liveCheckBoundary', 'upload-approval-already-provided', blockers);

  for (const key of [
    ['credentialValuesRead', 'credential-values-read'],
    ['credentialValuesExposed', 'credential-values-exposed'],
    ['credentialPresenceChecked', 'credential-presence-check-enabled'],
    ['credentialPresenceResultExposed', 'credential-presence-result-exposed'],
    ['clientCreated', 'client-created'],
    ['sdkClientCreated', 'client-created'],
    ['adapterInjected', 'adapter-injected'],
    ['artifactObjectStoreBound', 'artifact-object-store-bound'],
    ['metadataIndexBound', 'metadata-index-bound'],
    ['liveCheckAllowed', 'live-check-enabled'],
    ['liveCheckPerformed', 'live-check-enabled'],
    ['liveCheckResultExposed', 'live-check-result-exposed'],
    ['uploadExecutionAllowed', 'upload-execution-enabled'],
    ['uploadCommandGenerated', 'upload-command-generated'],
    ['objectWriteAttempted', 'object-write-attempted'],
    ['metadataIndexWriteAttempted', 'metadata-index-write-attempted'],
    ['remoteMutationPerformed', 'remote-mutation-performed'],
    ['executable', 'executable-state-enabled']
  ] as const) {
    checkRequiredFalse(liveCheckBoundary, key[0], '$.liveCheckBoundary.liveCheckBoundary', key[1], blockers);
  }

  checkRequiredTrue(remainingExecutionBoundaries, 'uploadCommandRequired', '$.liveCheckBoundary.remainingExecutionBoundaries', 'upload-command-not-required', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'uploadCommandGenerated', '$.liveCheckBoundary.remainingExecutionBoundaries', 'upload-command-generated', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'objectWriteAllowed', '$.liveCheckBoundary.remainingExecutionBoundaries', 'remote-write-enabled', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'metadataIndexWriteAllowed', '$.liveCheckBoundary.remainingExecutionBoundaries', 'remote-write-enabled', blockers);
  checkRequiredFalse(remainingExecutionBoundaries, 'remoteMutationAllowed', '$.liveCheckBoundary.remainingExecutionBoundaries', 'remote-write-enabled', blockers);

  const target = parseTarget(value.target, blockers);
  const adapterName = typeof source.adapterName === 'string' && isSafeKnowledgeTeamBackendAdapterName(source.adapterName)
    ? source.adapterName
    : null;
  if (source.adapterName !== null && source.adapterName !== undefined && adapterName === null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.liveCheckBoundary.sourceCredentialPresenceBoundary.adapterName', 'Upload command boundary planning requires a safe adapter name.');
  }

  const boundaryStatus = readBoundaryStatus(value.status);
  const boundaryKind = readBoundaryKind(value.boundaryKind);
  const boundaryNextAction = isRecord(value.readiness) ? readBoundaryNextAction(value.readiness.nextAction) : 'invalid';
  const reviewStatus = readReviewStatus(source.reviewStatus);
  const reviewKind = readReviewKind(source.reviewKind);
  const adapterBackendKind = readAdapterBackendKind(source.adapterBackendKind);

  if (reviewStatus !== 'review-ready' || reviewKind !== 'human-fingerprint-dry-run' || !readBool(source.scopeMatched) || !readBool(source.humanReviewRecorded) || !readBool(source.fingerprintVerified) || !readBool(source.sourceFingerprintVerified)) {
    addBlocker(blockers, 'review-fingerprint-unverified', '$.liveCheckBoundary.sourceCredentialPresenceBoundary', 'Upload command boundary planning requires verified review and scope metadata from the live check source.');
  }
  if (adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.liveCheckBoundary.sourceCredentialPresenceBoundary.adapterBackendKind', 'Upload command boundary planning remains mock-backend only.');
  }

  const parsedLiveCheckBoundary: KnowledgeTeamUploadCommandBoundary['sourceLiveCheckBoundary'] = {
    source: 'upload-live-check-boundary',
    boundaryStatus,
    boundaryKind,
    boundaryNextAction,
    reviewStatus,
    reviewKind,
    scopeMatched: readBool(source.scopeMatched),
    humanReviewRecorded: readBool(source.humanReviewRecorded),
    fingerprintVerified: readBool(source.fingerprintVerified),
    sourceFingerprintVerified: readBool(source.sourceFingerprintVerified),
    adapterName,
    adapterBackendKind,
    dryRunOnly: readBool(liveCheckBoundary.dryRunOnly),
    liveCheckRequiredBeforeExecution: readBool(liveCheckBoundary.liveCheckRequiredBeforeExecution),
    liveCheckRequiredAfterCredentialPresenceBoundary: readBool(liveCheckBoundary.liveCheckRequiredAfterCredentialPresenceBoundary),
    credentialPresenceBoundaryRequired: readBool(liveCheckBoundary.credentialPresenceBoundaryRequired),
    credentialReadBoundaryRequired: readBool(liveCheckBoundary.credentialReadBoundaryRequired),
    credentialSourceDescriptorRequired: readBool(liveCheckBoundary.credentialSourceDescriptorRequired),
    credentialReferenceOnlyRequired: readBool(liveCheckBoundary.credentialReferenceOnlyRequired),
    credentialValueRedactionRequired: readBool(liveCheckBoundary.credentialValueRedactionRequired),
    credentialPresenceSignalRequired: readBool(liveCheckBoundary.credentialPresenceSignalRequired),
    credentialPresenceResultRedactionRequired: readBool(liveCheckBoundary.credentialPresenceResultRedactionRequired),
    mockAdapterRequired: readBool(liveCheckBoundary.mockAdapterRequired),
    clientFactoryDescriptorRequired: readBool(liveCheckBoundary.clientFactoryDescriptorRequired),
    liveCheckPolicyRequired: readBool(liveCheckBoundary.liveCheckPolicyRequired),
    liveCheckReadOnlyRequired: readBool(liveCheckBoundary.liveCheckReadOnlyRequired),
    liveCheckResultRedactionRequired: readBool(liveCheckBoundary.liveCheckResultRedactionRequired),
    uploadCommandBoundaryRequired: readBool(liveCheckBoundary.uploadCommandBoundaryRequired),
    artifactObjectStoreDependencyRequired: readBool(liveCheckBoundary.artifactObjectStoreDependencyRequired),
    metadataIndexDependencyRequired: readBool(liveCheckBoundary.metadataIndexDependencyRequired),
    contentAddressedObjectKeysRequired: readBool(liveCheckBoundary.contentAddressedObjectKeysRequired),
    contentAddressedIndexKeysRequired: readBool(liveCheckBoundary.contentAddressedIndexKeysRequired),
    idempotentWritesRequired: readBool(liveCheckBoundary.idempotentWritesRequired),
    explicitUploadApprovalRequired: readBool(liveCheckBoundary.explicitUploadApprovalRequired),
    credentialValuesRead: readBool(liveCheckBoundary.credentialValuesRead),
    credentialValuesExposed: readBool(liveCheckBoundary.credentialValuesExposed),
    credentialPresenceChecked: readBool(liveCheckBoundary.credentialPresenceChecked),
    credentialPresenceResultExposed: readBool(liveCheckBoundary.credentialPresenceResultExposed),
    clientCreated: readBool(liveCheckBoundary.clientCreated),
    sdkClientCreated: readBool(liveCheckBoundary.sdkClientCreated),
    adapterInjected: readBool(liveCheckBoundary.adapterInjected),
    artifactObjectStoreBound: readBool(liveCheckBoundary.artifactObjectStoreBound),
    metadataIndexBound: readBool(liveCheckBoundary.metadataIndexBound),
    liveCheckAllowed: readBool(liveCheckBoundary.liveCheckAllowed),
    liveCheckPerformed: readBool(liveCheckBoundary.liveCheckPerformed),
    liveCheckResultExposed: readBool(liveCheckBoundary.liveCheckResultExposed),
    uploadExecutionAllowed: readBool(liveCheckBoundary.uploadExecutionAllowed),
    uploadCommandGenerated: readBool(liveCheckBoundary.uploadCommandGenerated),
    objectWriteAttempted: readBool(liveCheckBoundary.objectWriteAttempted),
    metadataIndexWriteAttempted: readBool(liveCheckBoundary.metadataIndexWriteAttempted),
    remoteMutationPerformed: readBool(liveCheckBoundary.remoteMutationPerformed),
    executable: readBool(liveCheckBoundary.executable)
  };

  return {
    boundaryStatus,
    boundaryKind,
    boundaryNextAction,
    reviewStatus,
    reviewKind,
    scopeMatched: readBool(source.scopeMatched),
    humanReviewRecorded: readBool(source.humanReviewRecorded),
    fingerprintVerified: readBool(source.fingerprintVerified),
    sourceFingerprintVerified: readBool(source.sourceFingerprintVerified),
    adapterName,
    adapterBackendKind,
    liveCheckBoundary: parsedLiveCheckBoundary,
    target
  };
}

function emptyParsedLiveCheckBoundary(): ParsedLiveCheckBoundaryForUploadCommandBoundary {
  const sourceLiveCheckBoundary: KnowledgeTeamUploadCommandBoundary['sourceLiveCheckBoundary'] = {
    source: 'upload-live-check-boundary',
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
    dryRunOnly: false,
    liveCheckRequiredBeforeExecution: false,
    liveCheckRequiredAfterCredentialPresenceBoundary: false,
    credentialPresenceBoundaryRequired: false,
    credentialReadBoundaryRequired: false,
    credentialSourceDescriptorRequired: false,
    credentialReferenceOnlyRequired: false,
    credentialValueRedactionRequired: false,
    credentialPresenceSignalRequired: false,
    credentialPresenceResultRedactionRequired: false,
    mockAdapterRequired: false,
    clientFactoryDescriptorRequired: false,
    liveCheckPolicyRequired: false,
    liveCheckReadOnlyRequired: false,
    liveCheckResultRedactionRequired: false,
    uploadCommandBoundaryRequired: false,
    artifactObjectStoreDependencyRequired: false,
    metadataIndexDependencyRequired: false,
    contentAddressedObjectKeysRequired: false,
    contentAddressedIndexKeysRequired: false,
    idempotentWritesRequired: false,
    explicitUploadApprovalRequired: false,
    credentialValuesRead: false,
    credentialValuesExposed: false,
    credentialPresenceChecked: false,
    credentialPresenceResultExposed: false,
    clientCreated: false,
    sdkClientCreated: false,
    adapterInjected: false,
    artifactObjectStoreBound: false,
    metadataIndexBound: false,
    liveCheckAllowed: false,
    liveCheckPerformed: false,
    liveCheckResultExposed: false,
    uploadExecutionAllowed: false,
    uploadCommandGenerated: false,
    objectWriteAttempted: false,
    metadataIndexWriteAttempted: false,
    remoteMutationPerformed: false,
    executable: false
  };
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
    liveCheckBoundary: sourceLiveCheckBoundary,
    target: {
      manifestId: null,
      objectKeyRedacted: true,
      objectSha256: null,
      artifactId: null
    }
  };
}

function blockerCodeForFalseField(key: string): KnowledgeTeamUploadCommandBoundaryBlockerCode {
  if (key === 'uploadApproved') {
    return 'upload-approval-already-provided';
  }
  if (key === 'uploadExecutionAllowed') {
    return 'upload-execution-enabled';
  }
  if (key === 'mutationApprovalGranted') {
    return 'mutation-approval-already-granted';
  }
  if (key === 'clientCreated') {
    return 'client-created';
  }
  if (key === 'adapterInjected') {
    return 'adapter-injected';
  }
  if (key === 'artifactBytesProvided') {
    return 'artifact-bytes-provided';
  }
  if (key === 'writeTokenIssued') {
    return 'write-token-issued';
  }
  if (key === 'executionLeaseCreated') {
    return 'execution-lease-created';
  }
  if (key === 'rollbackPlanCreated') {
    return 'rollback-plan-created';
  }
  if (key === 'auditRecordCreated') {
    return 'audit-record-created';
  }
  if (key === 'objectWriteAttempted') {
    return 'object-write-attempted';
  }
  if (key === 'metadataIndexWriteAttempted') {
    return 'metadata-index-write-attempted';
  }
  if (key === 'remoteMutationPerformed') {
    return 'remote-mutation-performed';
  }
  return 'mutation-enabled';
}

export function buildKnowledgeTeamUploadCommandBoundary(
  input: KnowledgeTeamUploadCommandBoundaryInput
): KnowledgeTeamUploadCommandBoundary {
  const blockers: KnowledgeTeamUploadCommandBoundaryBlocker[] = [];
  const parsedBoundary = parseLiveCheckBoundaryForUploadCommandBoundary(input.liveCheckBoundary, blockers);
  const status: KnowledgeTeamUploadCommandBoundaryStatus = blockers.length === 0
    ? 'upload-command-boundary-ready'
    : 'blocked';

  return {
    kind: 'infra-agent.knowledge-team-upload-command-boundary',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    boundaryKind: 'upload-command-boundary-dry-run',
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
    sourceLiveCheckBoundary: parsedBoundary.liveCheckBoundary,
    uploadCommandBoundary: {
      dryRunOnly: true,
      uploadCommandRequiredBeforeExecution: true,
      uploadCommandRequiredAfterLiveCheckBoundary: true,
      liveCheckBoundaryRequired: true,
      liveCheckPolicyRequired: true,
      liveCheckResultRedactionRequired: true,
      credentialPresenceBoundaryRequired: true,
      credentialReadBoundaryRequired: true,
      credentialSourceDescriptorRequired: true,
      credentialReferenceOnlyRequired: true,
      credentialValueRedactionRequired: true,
      credentialPresenceResultRedactionRequired: true,
      mockAdapterRequired: true,
      clientFactoryDescriptorRequired: true,
      uploadCommandDescriptorRequired: true,
      uploadCommandPayloadRedactionRequired: true,
      uploadCommandMaterialRedactionRequired: true,
      commandExecutionApprovalRequired: true,
      artifactObjectStoreDependencyRequired: true,
      metadataIndexDependencyRequired: true,
      contentAddressedObjectKeysRequired: true,
      contentAddressedIndexKeysRequired: true,
      idempotentWritesRequired: true,
      explicitUploadApprovalRequired: true,
      credentialValuesRead: false,
      credentialValuesExposed: false,
      credentialPresenceChecked: false,
      credentialPresenceResultExposed: false,
      clientCreated: false,
      sdkClientCreated: false,
      adapterInjected: false,
      artifactObjectStoreBound: false,
      metadataIndexBound: false,
      liveCheckAllowed: false,
      liveCheckPerformed: false,
      liveCheckResultExposed: false,
      uploadCommandGenerated: false,
      uploadCommandMaterialized: false,
      uploadCommandExposed: false,
      uploadExecutionAllowed: false,
      objectWriteAttempted: false,
      metadataIndexWriteAttempted: false,
      remoteMutationPerformed: false,
      executable: false
    },
    remainingExecutionBoundaries: {
      artifactBytesRequired: true,
      artifactBytesProvided: false,
      adapterInjectionRequired: true,
      adapterInjected: false,
      clientCreationRequired: true,
      clientCreated: false,
      credentialReadRequired: true,
      credentialValuesExposed: false,
      credentialPresenceCheckRequired: true,
      credentialPresenceChecked: false,
      liveCheckRequired: true,
      liveCheckPerformed: false,
      uploadCommandRequired: true,
      uploadCommandGenerated: false,
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
      nextAction: status === 'upload-command-boundary-ready' ? 'design-object-index-binding-boundary' : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: blockers.map(entry => entry.code),
      blockers,
      reason: status === 'upload-command-boundary-ready'
        ? 'Upload-command boundary requirements are modeled, but no upload command is generated or exposed, no backend object/index dependency is bound, and upload execution remains disabled until a separate object/index binding boundary is designed.'
        : 'Upload-command boundary planning is blocked until all live check boundary blockers are resolved.'
    }
  };
}
