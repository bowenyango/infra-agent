import { createHash } from 'node:crypto';
import type { KnowledgeStoragePolicySummary } from './storage-policy.ts';
import {
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey,
  type KnowledgeTeamArtifactBackendKind,
  type KnowledgeTeamArtifactContentType,
  type KnowledgeTeamPublicationReadinessStatus
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadApprovalIntentStatus =
  | 'approval-required'
  | 'blocked';

export type KnowledgeTeamUploadApprovalIntentNextAction =
  | 'request-explicit-upload-approval'
  | 'resolve-blockers';

export type KnowledgeTeamUploadApprovalIntentBlockerCode =
  | 'backend-reference-blocked'
  | 'credential-presence-check-enabled'
  | 'credential-values-exposed'
  | 'invalid-backend-reference-kind'
  | 'invalid-publication-readiness-kind'
  | 'invalid-schema-version'
  | 'live-check-enabled'
  | 'missing-required-field'
  | 'mutation-enabled'
  | 'publication-not-upload-required'
  | 'publication-readiness-blocked'
  | 'remote-write-enabled'
  | 'unsupported-backend-kind'
  | 'unsafe-artifact-reference'
  | 'unsafe-env-var-name'
  | 'upload-command-present';

export interface KnowledgeTeamUploadApprovalIntentBlocker {
  code: KnowledgeTeamUploadApprovalIntentBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamUploadApprovalIntent {
  kind: 'infra-agent.knowledge-team-upload-approval-intent';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  status: KnowledgeTeamUploadApprovalIntentStatus;
  plannedOperation: 'stage-knowledge-pack';
  remoteWriteAllowed: false;
  liveCheckAllowed: false;
  credentialValuesExposed: false;
  credentialPresenceChecked: false;
  uploadCommand: null;
  backendKind: 's3-compatible' | 'unsupported';
  publicationBackendKind: KnowledgeTeamArtifactBackendKind | 'unsupported';
  manifestId: string | null;
  object: {
    key: string | null;
    sha256: string | null;
    byteLength: number | null;
    contentType: KnowledgeTeamArtifactContentType | null;
  };
  artifact: {
    kind: 'infra-agent.knowledge-pack' | 'unsupported' | null;
    id: string | null;
    sourceCount: number | null;
    factCount: number | null;
    staleSourceCount: number | null;
    storagePolicy: KnowledgeStoragePolicySummary | null;
  };
  approvalFingerprint: {
    algorithm: 'sha256';
    scope: 'stage-knowledge-pack-intent-v1';
    value: string | null;
    canonicalFieldCount: number;
  };
  preconditions: {
    publicationReadiness: {
      status: KnowledgeTeamPublicationReadinessStatus | 'invalid' | null;
      nextAction: string | null;
      publicationAllowed: boolean | null;
      uploadRequired: boolean;
      blockerCount: number | null;
    };
    backendReference: {
      status: 'valid' | 'blocked' | 'invalid' | null;
      backendKind: 's3-compatible' | 'unsupported' | null;
      configName: string | null;
      storageProfileRef: string | null;
      authProfileRef: string | null;
      requiredEnvironmentVariableCount: number;
      optionalEnvironmentVariableCount: number;
    };
    credentialBoundary: {
      mode: 'environment';
      requiredEnvironmentVariables: string[];
      optionalEnvironmentVariables: string[];
      credentialValuesRead: false;
      credentialPresenceChecked: false;
    };
    uploadApproval: {
      explicitUploadApprovalRequired: true;
      approvalProvided: false;
      approvalSource: null;
      uploadCommandGenerated: false;
    };
  };
  readiness: {
    status: KnowledgeTeamUploadApprovalIntentStatus;
    nextAction: KnowledgeTeamUploadApprovalIntentNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadApprovalIntentBlockerCode[];
    blockers: KnowledgeTeamUploadApprovalIntentBlocker[];
    reason: string;
  };
}

interface ParsedPublicationReadiness {
  backendKind: KnowledgeTeamArtifactBackendKind | 'unsupported';
  manifestId: string | null;
  object: KnowledgeTeamUploadApprovalIntent['object'];
  artifact: KnowledgeTeamUploadApprovalIntent['artifact'];
  status: KnowledgeTeamPublicationReadinessStatus | 'invalid' | null;
  nextAction: string | null;
  publicationAllowed: boolean | null;
  uploadRequired: boolean;
  blockerCount: number | null;
}

interface ParsedBackendReference {
  backendKind: 's3-compatible' | 'unsupported';
  status: 'valid' | 'blocked' | 'invalid' | null;
  configName: string | null;
  storageProfileRef: string | null;
  authProfileRef: string | null;
  requiredEnvironmentVariables: string[];
  optionalEnvironmentVariables: string[];
}

const MANIFEST_ID_PATTERN = /^[a-f0-9]{24}$/;
const PACK_ID_PATTERN = MANIFEST_ID_PATTERN;
const SAFE_REFERENCE_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,127}$/;
const SAFE_ENV_VAR_NAME_PATTERN = /^[A-Z_][A-Z0-9_]{0,127}$/;
const APPROVAL_FINGERPRINT_FIELD_COUNT = 13;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function blocker(
  code: KnowledgeTeamUploadApprovalIntentBlockerCode,
  path: string,
  message: string
): KnowledgeTeamUploadApprovalIntentBlocker {
  return { code, path, message };
}

function pushBlockerOnce(
  blockers: KnowledgeTeamUploadApprovalIntentBlocker[],
  nextBlocker: KnowledgeTeamUploadApprovalIntentBlocker
): void {
  if (!blockers.some(entry => entry.code === nextBlocker.code && entry.path === nextBlocker.path)) {
    blockers.push(nextBlocker);
  }
}

function readSafeString(
  value: unknown,
  path: string,
  pattern: RegExp,
  blockers: KnowledgeTeamUploadApprovalIntentBlocker[]
): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      path,
      'Upload approval intent requires this field.'
    ));
    return null;
  }
  if (!pattern.test(value)) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-artifact-reference',
      path,
      'Upload approval intent requires safe artifact or reference identifiers.'
    ));
    return null;
  }
  return value;
}

function readNonNegativeInteger(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadApprovalIntentBlocker[]
): number | null {
  if (!Number.isInteger(value) || (value as number) < 0) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      path,
      'Upload approval intent requires this non-negative count.'
    ));
    return null;
  }
  return value as number;
}

function readPositiveInteger(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadApprovalIntentBlocker[]
): number | null {
  if (!Number.isInteger(value) || (value as number) < 1) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      path,
      'Upload approval intent requires this positive count.'
    ));
    return null;
  }
  return value as number;
}

function readStoragePolicySummary(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadApprovalIntentBlocker[]
): KnowledgeStoragePolicySummary | null {
  if (!isRecord(value)) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      path,
      'Upload approval intent requires artifact storage policy summary.'
    ));
    return null;
  }

  const publicReference = readNonNegativeInteger(value.publicReference, `${path}.publicReference`, blockers);
  const workspacePrivate = readNonNegativeInteger(value.workspacePrivate, `${path}.workspacePrivate`, blockers);
  const shareableByDefault = readNonNegativeInteger(value.shareableByDefault, `${path}.shareableByDefault`, blockers);
  const explicitOptInRequired = readNonNegativeInteger(value.explicitOptInRequired, `${path}.explicitOptInRequired`, blockers);

  if (
    publicReference === null
    || workspacePrivate === null
    || shareableByDefault === null
    || explicitOptInRequired === null
  ) {
    return null;
  }

  return {
    publicReference,
    workspacePrivate,
    shareableByDefault,
    explicitOptInRequired
  };
}

function readEnvironmentNames(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadApprovalIntentBlocker[]
): string[] {
  if (!Array.isArray(value)) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      path,
      'Upload approval intent requires environment variable name arrays.'
    ));
    return [];
  }

  const names: string[] = [];
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string' || !SAFE_ENV_VAR_NAME_PATTERN.test(entry)) {
      pushBlockerOnce(blockers, blocker(
        'unsafe-env-var-name',
        `${path}[${index}]`,
        'Upload approval intent accepts environment variable names only.'
      ));
      continue;
    }
    if (!names.includes(entry)) {
      names.push(entry);
    }
  }
  return names;
}

function parsePublicationReadiness(
  input: unknown,
  blockers: KnowledgeTeamUploadApprovalIntentBlocker[]
): ParsedPublicationReadiness {
  const empty: ParsedPublicationReadiness = {
    backendKind: 'unsupported',
    manifestId: null,
    object: {
      key: null,
      sha256: null,
      byteLength: null,
      contentType: null
    },
    artifact: {
      kind: null,
      id: null,
      sourceCount: null,
      factCount: null,
      staleSourceCount: null,
      storagePolicy: null
    },
    status: null,
    nextAction: null,
    publicationAllowed: null,
    uploadRequired: false,
    blockerCount: null
  };

  if (!isRecord(input)) {
    pushBlockerOnce(blockers, blocker(
      'invalid-publication-readiness-kind',
      '$',
      'Upload approval intent requires a publication readiness JSON object.'
    ));
    return empty;
  }

  if (input.kind !== 'infra-agent.knowledge-team-publication-readiness') {
    pushBlockerOnce(blockers, blocker(
      'invalid-publication-readiness-kind',
      '$.kind',
      'Upload approval intent requires infra-agent.knowledge-team-publication-readiness input.'
    ));
  }
  if (input.schemaVersion !== 1) {
    pushBlockerOnce(blockers, blocker(
      'invalid-schema-version',
      '$.schemaVersion',
      'Upload approval intent requires schemaVersion 1 inputs.'
    ));
  }
  if (input.mutationAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'mutation-enabled',
      '$.mutationAllowed',
      'Upload approval intent inputs must keep mutation disabled.'
    ));
  }
  if (input.executionMode !== 'dry-run') {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.executionMode',
      'Upload approval intent requires dry-run publication readiness.'
    ));
  }
  if (input.remoteWriteAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'remote-write-enabled',
      '$.remoteWriteAllowed',
      'Upload approval intent must not consume remote-write-enabled readiness.'
    ));
  }
  if (input.credentialRequired !== false) {
    pushBlockerOnce(blockers, blocker(
      'credential-presence-check-enabled',
      '$.credentialRequired',
      'Upload approval intent must not consume credential-required readiness.'
    ));
  }
  if (input.uploadCommand !== null) {
    pushBlockerOnce(blockers, blocker(
      'upload-command-present',
      '$.uploadCommand',
      'Upload approval intent must not consume upload commands.'
    ));
  }

  const backendKind = input.plannedBackendKind === 'mock-s3-compatible'
    ? 'mock-s3-compatible'
    : 'unsupported';
  if (backendKind === 'unsupported') {
    pushBlockerOnce(blockers, blocker(
      'unsupported-backend-kind',
      '$.plannedBackendKind',
      'Upload approval intent currently consumes existing mock-backed publication readiness only.'
    ));
  }

  const manifestId = typeof input.manifestId === 'string' && MANIFEST_ID_PATTERN.test(input.manifestId)
    ? input.manifestId
    : readSafeString(input.manifestId, '$.manifestId', MANIFEST_ID_PATTERN, blockers);

  const object = isRecord(input.object) ? input.object : {};
  if (!isRecord(input.object)) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.object',
      'Upload approval intent requires publication readiness object metadata.'
    ));
  }
  const objectKey = typeof object.key === 'string' && isSafeKnowledgeTeamArtifactObjectKey(object.key)
    ? object.key
    : null;
  if (objectKey === null) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-artifact-reference',
      '$.object.key',
      'Upload approval intent requires a safe content-addressed object key.'
    ));
  }
  const objectSha = typeof object.sha256 === 'string' && isKnowledgeTeamArtifactSha256(object.sha256)
    ? object.sha256
    : null;
  if (objectSha === null) {
    pushBlockerOnce(blockers, blocker(
      'unsafe-artifact-reference',
      '$.object.sha256',
      'Upload approval intent requires a safe artifact SHA-256.'
    ));
  }
  const byteLength = readPositiveInteger(object.byteLength, '$.object.byteLength', blockers);
  const contentType = object.contentType === 'application/json'
    ? 'application/json'
    : null;
  if (contentType === null) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.object.contentType',
      'Upload approval intent currently supports application/json artifacts only.'
    ));
  }

  const artifact = isRecord(input.artifact) ? input.artifact : {};
  if (!isRecord(input.artifact)) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.artifact',
      'Upload approval intent requires artifact metadata.'
    ));
  }
  const artifactKind = artifact.kind === 'infra-agent.knowledge-pack'
    ? 'infra-agent.knowledge-pack'
    : artifact.kind === undefined
      ? null
      : 'unsupported';
  if (artifactKind !== 'infra-agent.knowledge-pack') {
    pushBlockerOnce(blockers, blocker(
      'unsupported-backend-kind',
      '$.artifact.kind',
      'Upload approval intent currently supports knowledge-pack artifacts only.'
    ));
  }
  const artifactId = typeof artifact.id === 'string' && PACK_ID_PATTERN.test(artifact.id)
    ? artifact.id
    : readSafeString(artifact.id, '$.artifact.id', PACK_ID_PATTERN, blockers);
  const sourceCount = readNonNegativeInteger(artifact.sourceCount, '$.artifact.sourceCount', blockers);
  const factCount = readNonNegativeInteger(artifact.factCount, '$.artifact.factCount', blockers);
  const staleSourceCount = readNonNegativeInteger(artifact.staleSourceCount, '$.artifact.staleSourceCount', blockers);
  const storagePolicy = readStoragePolicySummary(artifact.storagePolicy, '$.artifact.storagePolicy', blockers);

  const publication = isRecord(input.publication) ? input.publication : {};
  if (!isRecord(input.publication)) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.publication',
      'Upload approval intent requires publication readiness summary.'
    ));
  }
  const publicationAllowed = typeof publication.allowed === 'boolean'
    ? publication.allowed
    : null;
  if (publicationAllowed === null) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.publication.allowed',
      'Upload approval intent requires publication allowed posture.'
    ));
  }

  const readiness = isRecord(input.readiness) ? input.readiness : {};
  if (!isRecord(input.readiness)) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.readiness',
      'Upload approval intent requires publication readiness details.'
    ));
  }
  const status = readiness.status === 'upload-required'
    || readiness.status === 'already-published'
    || readiness.status === 'blocked'
    || readiness.status === 'conflict'
    ? readiness.status
    : readiness.status === undefined
      ? null
      : 'invalid';
  if (status === null || status === 'invalid') {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.readiness.status',
      'Upload approval intent requires a supported publication readiness status.'
    ));
  }
  const nextAction = typeof readiness.nextAction === 'string'
    ? readiness.nextAction
    : null;
  const blockerCount = typeof readiness.blockerCount === 'number'
    && Number.isInteger(readiness.blockerCount)
    && readiness.blockerCount >= 0
    ? readiness.blockerCount
    : null;
  if (blockerCount === null) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.readiness.blockerCount',
      'Upload approval intent requires readiness blocker count.'
    ));
  }

  const uploadRequired = status === 'upload-required'
    && publicationAllowed === true
    && (blockerCount ?? 1) === 0;
  if (!uploadRequired) {
    pushBlockerOnce(blockers, blocker(
      status === 'blocked' || status === 'conflict'
        ? 'publication-readiness-blocked'
        : 'publication-not-upload-required',
      '$.readiness.status',
      'Upload approval intent can be prepared only from upload-required publication readiness.'
    ));
  }

  return {
    backendKind,
    manifestId,
    object: {
      key: objectKey,
      sha256: objectSha,
      byteLength,
      contentType
    },
    artifact: {
      kind: artifactKind,
      id: artifactId,
      sourceCount,
      factCount,
      staleSourceCount,
      storagePolicy
    },
    status,
    nextAction,
    publicationAllowed,
    uploadRequired,
    blockerCount
  };
}

function parseBackendReference(
  input: unknown,
  blockers: KnowledgeTeamUploadApprovalIntentBlocker[]
): ParsedBackendReference {
  const empty: ParsedBackendReference = {
    backendKind: 'unsupported',
    status: null,
    configName: null,
    storageProfileRef: null,
    authProfileRef: null,
    requiredEnvironmentVariables: [],
    optionalEnvironmentVariables: []
  };

  if (!isRecord(input)) {
    pushBlockerOnce(blockers, blocker(
      'invalid-backend-reference-kind',
      '$',
      'Upload approval intent requires a backend reference validation JSON object.'
    ));
    return empty;
  }
  if (input.kind !== 'infra-agent.knowledge-team-s3-compatible-reference-validation') {
    pushBlockerOnce(blockers, blocker(
      'invalid-backend-reference-kind',
      '$.kind',
      'Upload approval intent requires infra-agent.knowledge-team-s3-compatible-reference-validation input.'
    ));
  }
  if (input.schemaVersion !== 1) {
    pushBlockerOnce(blockers, blocker(
      'invalid-schema-version',
      '$.schemaVersion',
      'Upload approval intent requires schemaVersion 1 inputs.'
    ));
  }
  if (input.mutationAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'mutation-enabled',
      '$.mutationAllowed',
      'Upload approval intent inputs must keep mutation disabled.'
    ));
  }

  const status = input.status === 'valid' || input.status === 'blocked'
    ? input.status
    : input.status === undefined
      ? null
      : 'invalid';
  if (status !== 'valid') {
    pushBlockerOnce(blockers, blocker(
      status === 'blocked' ? 'backend-reference-blocked' : 'invalid-backend-reference-kind',
      '$.status',
      'Upload approval intent requires valid backend reference readiness.'
    ));
  }

  const backendKind = input.backendKind === 's3-compatible'
    ? 's3-compatible'
    : 'unsupported';
  if (backendKind === 'unsupported') {
    pushBlockerOnce(blockers, blocker(
      'unsupported-backend-kind',
      '$.backendKind',
      'Upload approval intent requires S3-compatible backend references.'
    ));
  }

  const configName = typeof input.configName === 'string' && SAFE_REFERENCE_PATTERN.test(input.configName)
    ? input.configName
    : null;
  const storageProfileRef = typeof input.storageProfileRef === 'string' && SAFE_REFERENCE_PATTERN.test(input.storageProfileRef)
    ? input.storageProfileRef
    : null;
  const authProfileRef = typeof input.authProfileRef === 'string' && SAFE_REFERENCE_PATTERN.test(input.authProfileRef)
    ? input.authProfileRef
    : null;

  if (status === 'valid' && (configName === null || storageProfileRef === null || authProfileRef === null)) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$',
      'Upload approval intent requires valid backend config, storage, and auth references.'
    ));
  }

  const capabilities = isRecord(input.capabilities) ? input.capabilities : {};
  if (!isRecord(input.capabilities)) {
    pushBlockerOnce(blockers, blocker(
      'missing-required-field',
      '$.capabilities',
      'Upload approval intent requires backend reference capability flags.'
    ));
  }
  if (capabilities.remoteWriteAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'remote-write-enabled',
      '$.capabilities.remoteWriteAllowed',
      'Upload approval intent must not consume remote-write-enabled backend references.'
    ));
  }
  if (capabilities.liveCheckAllowed !== false) {
    pushBlockerOnce(blockers, blocker(
      'live-check-enabled',
      '$.capabilities.liveCheckAllowed',
      'Upload approval intent must not consume live-check-enabled backend references.'
    ));
  }
  if (capabilities.credentialValuesExposed !== false) {
    pushBlockerOnce(blockers, blocker(
      'credential-values-exposed',
      '$.capabilities.credentialValuesExposed',
      'Upload approval intent must not consume credential values.'
    ));
  }
  if (capabilities.uploadCommand !== null) {
    pushBlockerOnce(blockers, blocker(
      'upload-command-present',
      '$.capabilities.uploadCommand',
      'Upload approval intent must not consume upload commands.'
    ));
  }

  return {
    backendKind,
    status,
    configName,
    storageProfileRef,
    authProfileRef,
    requiredEnvironmentVariables: readEnvironmentNames(
      input.requiredEnvironmentVariables,
      '$.requiredEnvironmentVariables',
      blockers
    ),
    optionalEnvironmentVariables: readEnvironmentNames(
      input.optionalEnvironmentVariables,
      '$.optionalEnvironmentVariables',
      blockers
    )
  };
}

function intentReason(status: KnowledgeTeamUploadApprovalIntentStatus): string {
  return status === 'approval-required'
    ? 'Dry-run publication and backend reference preconditions are met; explicit human upload approval is still required before any future remote write.'
    : 'Upload approval intent is blocked until publication readiness and backend reference preconditions are fixed.';
}

export function computeKnowledgeTeamUploadApprovalIntentFingerprint(input: {
  enabled: boolean;
  plannedOperation: KnowledgeTeamUploadApprovalIntent['plannedOperation'];
  backendKind: KnowledgeTeamUploadApprovalIntent['backendKind'];
  publicationBackendKind: KnowledgeTeamUploadApprovalIntent['publicationBackendKind'];
  manifestId: string | null;
  object: KnowledgeTeamUploadApprovalIntent['object'];
  artifactId: string | null;
  configName: string | null;
  storageProfileRef: string | null;
  authProfileRef: string | null;
}): KnowledgeTeamUploadApprovalIntent['approvalFingerprint'] {
  if (!input.enabled) {
    return {
      algorithm: 'sha256',
      scope: 'stage-knowledge-pack-intent-v1',
      value: null,
      canonicalFieldCount: APPROVAL_FINGERPRINT_FIELD_COUNT
    };
  }

  const fields = [
    input.plannedOperation,
    input.backendKind,
    input.publicationBackendKind,
    input.manifestId,
    input.object.key,
    input.object.sha256,
    input.object.byteLength,
    input.object.contentType,
    input.artifactId,
    input.configName,
    input.storageProfileRef,
    input.authProfileRef,
    'schemaVersion:1'
  ];

  if (fields.some(field => field === null || typeof field === 'undefined')) {
    return {
      algorithm: 'sha256',
      scope: 'stage-knowledge-pack-intent-v1',
      value: null,
      canonicalFieldCount: APPROVAL_FINGERPRINT_FIELD_COUNT
    };
  }

  return {
    algorithm: 'sha256',
    scope: 'stage-knowledge-pack-intent-v1',
    value: createHash('sha256')
      .update(JSON.stringify(fields))
      .digest('hex'),
    canonicalFieldCount: APPROVAL_FINGERPRINT_FIELD_COUNT
  };
}

export function buildKnowledgeTeamUploadApprovalIntent(input: {
  publicationReadiness: unknown;
  backendReferenceValidation: unknown;
}): KnowledgeTeamUploadApprovalIntent {
  const blockers: KnowledgeTeamUploadApprovalIntentBlocker[] = [];
  const publication = parsePublicationReadiness(input.publicationReadiness, blockers);
  const backendReference = parseBackendReference(input.backendReferenceValidation, blockers);
  const plannedOperation: KnowledgeTeamUploadApprovalIntent['plannedOperation'] = 'stage-knowledge-pack';
  const status: KnowledgeTeamUploadApprovalIntentStatus = blockers.length === 0
    ? 'approval-required'
    : 'blocked';
  const blockerCodes = [...new Set(blockers.map(entry => entry.code))].sort();
  const approvalFingerprint = computeKnowledgeTeamUploadApprovalIntentFingerprint({
    enabled: status === 'approval-required',
    plannedOperation,
    backendKind: backendReference.backendKind,
    publicationBackendKind: publication.backendKind,
    manifestId: publication.manifestId,
    object: publication.object,
    artifactId: publication.artifact.id,
    configName: backendReference.configName,
    storageProfileRef: backendReference.storageProfileRef,
    authProfileRef: backendReference.authProfileRef
  });

  return {
    kind: 'infra-agent.knowledge-team-upload-approval-intent',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    status,
    plannedOperation,
    remoteWriteAllowed: false,
    liveCheckAllowed: false,
    credentialValuesExposed: false,
    credentialPresenceChecked: false,
    uploadCommand: null,
    backendKind: backendReference.backendKind,
    publicationBackendKind: publication.backendKind,
    manifestId: publication.manifestId,
    object: publication.object,
    artifact: publication.artifact,
    approvalFingerprint,
    preconditions: {
      publicationReadiness: {
        status: publication.status,
        nextAction: publication.nextAction,
        publicationAllowed: publication.publicationAllowed,
        uploadRequired: publication.uploadRequired,
        blockerCount: publication.blockerCount
      },
      backendReference: {
        status: backendReference.status,
        backendKind: backendReference.backendKind,
        configName: backendReference.configName,
        storageProfileRef: backendReference.storageProfileRef,
        authProfileRef: backendReference.authProfileRef,
        requiredEnvironmentVariableCount: backendReference.requiredEnvironmentVariables.length,
        optionalEnvironmentVariableCount: backendReference.optionalEnvironmentVariables.length
      },
      credentialBoundary: {
        mode: 'environment',
        requiredEnvironmentVariables: backendReference.requiredEnvironmentVariables,
        optionalEnvironmentVariables: backendReference.optionalEnvironmentVariables,
        credentialValuesRead: false,
        credentialPresenceChecked: false
      },
      uploadApproval: {
        explicitUploadApprovalRequired: true,
        approvalProvided: false,
        approvalSource: null,
        uploadCommandGenerated: false
      }
    },
    readiness: {
      status,
      nextAction: status === 'approval-required'
        ? 'request-explicit-upload-approval'
        : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes,
      blockers,
      reason: intentReason(status)
    }
  };
}
