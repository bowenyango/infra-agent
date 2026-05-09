import type { KnowledgeStoragePolicySummary } from './storage-policy.ts';
import { validateKnowledgeStoragePolicySummary } from './storage-policy-validation.ts';
import {
  buildKnowledgeTeamArtifactIndexEntryKey,
  buildKnowledgeTeamArtifactObjectKey,
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey
} from './team-artifact-store.ts';
import {
  createEmptyKnowledgeValidationReport,
  error,
  isRecord,
  readBoolean,
  readNonEmptyString,
  readNonNegativeInteger,
  readPositiveInteger,
  readStringArray,
  validateBlockerCodeSummary,
  type KnowledgeValidationIssue,
  type KnowledgeValidationReport
} from './validation-primitives.ts';

export const KNOWLEDGE_TEAM_PUBLICATION_BLOCKERS = [
  'artifact-hash-mismatch',
  'artifact-metadata-mismatch',
  'descriptor-mismatch',
  'explicit-opt-in-required',
  'forged-publication-plan',
  'invalid-artifact-json',
  'stale-source',
  'unchecked-source',
  'unsupported-artifact-kind',
  'workspace-private-source'
] as const;
export const KNOWLEDGE_TEAM_READINESS_BLOCKERS = [
  ...KNOWLEDGE_TEAM_PUBLICATION_BLOCKERS,
  'index-artifact-mismatch',
  'index-backend-mismatch',
  'index-object-mismatch',
  'index-publication-mismatch'
] as const;
export const KNOWLEDGE_TEAM_READINESS_STATUSES = [
  'already-published',
  'blocked',
  'conflict',
  'upload-required'
] as const;
export const KNOWLEDGE_TEAM_READINESS_NEXT_ACTIONS = [
  'none',
  'prepare-explicit-upload',
  'resolve-blockers',
  'review-index-conflict'
] as const;

const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const BACKEND_URL_PATTERN = /(?:https?:\/\/|s3:\/\/|gs:\/\/|az:\/\/)/i;
const FORBIDDEN_TEAM_ARTIFACT_DESCRIPTOR_KEY_PATTERN = /(bucket|endpoint|url|credential|secret|token|password|authorization|header|uploadCommand|accessKey|sessionToken)/i;
const FORBIDDEN_TEAM_ARTIFACT_RAW_KEY_PATTERN = /^(workspaceRoot|cacheRoot|artifactPath|localPath|rawContent|rawDocs|rawRepoContent|facts|factSets|sources)$/;
const ABSOLUTE_LOCAL_PATH_PATTERN = /(^|[\s"'=])(?:\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/;
const PACK_ID_PATTERN = /^[a-f0-9]{24}$/;
const MANIFEST_ID_PATTERN = PACK_ID_PATTERN;

export function validateNoTeamArtifactPayloadLeakage(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): void {
  if (typeof value === 'string') {
    if (SECRET_VALUE_PATTERN.test(value)) {
      issues.push(error(path, 'Knowledge team artifact payloads must not include secret-like values.'));
    }
    if (BACKEND_URL_PATTERN.test(value)) {
      issues.push(error(path, 'Knowledge team artifact payloads must not include backend URLs.'));
    }
    if (ABSOLUTE_LOCAL_PATH_PATTERN.test(value)) {
      issues.push(error(path, 'Knowledge team artifact payloads must not include absolute local paths.'));
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      validateNoTeamArtifactPayloadLeakage(entry, `${path}[${index}]`, issues);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    const allowedControlField = (key === 'credentialRequired' && entry === false)
      || (key === 'uploadCommand' && entry === null);
    if (FORBIDDEN_TEAM_ARTIFACT_DESCRIPTOR_KEY_PATTERN.test(key) && !allowedControlField) {
      issues.push(error(entryPath, 'Knowledge team artifact payloads must not include backend, credential, or upload fields.'));
    }
    if (FORBIDDEN_TEAM_ARTIFACT_RAW_KEY_PATTERN.test(key)) {
      issues.push(error(entryPath, 'Knowledge team artifact payloads must not include raw source, fact, workspace, or cache fields.'));
    }
    validateNoTeamArtifactPayloadLeakage(entry, entryPath, issues);
  }
}

export function validateTeamArtifactObjectKeyMatchesSha(
  key: unknown,
  sha256: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): void {
  if (
    typeof key !== 'string'
    || typeof sha256 !== 'string'
    || !isSafeKnowledgeTeamArtifactObjectKey(key)
    || !isKnowledgeTeamArtifactSha256(sha256)
  ) {
    return;
  }

  const expectedKey = buildKnowledgeTeamArtifactObjectKey({
    artifactKind: 'infra-agent.knowledge-pack',
    sha256
  });
  if (key !== expectedKey) {
    issues.push(error(path, 'Knowledge team artifact object key must match the artifact SHA-256 content address.'));
  }
}

export function validateTeamArtifactIndexKeyMatchesSha(
  key: unknown,
  sha256: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): void {
  if (
    typeof key !== 'string'
    || typeof sha256 !== 'string'
    || !isSafeKnowledgeTeamArtifactObjectKey(key)
    || !isKnowledgeTeamArtifactSha256(sha256)
  ) {
    return;
  }

  const expectedKey = buildKnowledgeTeamArtifactIndexEntryKey({
    artifactKind: 'infra-agent.knowledge-pack',
    sha256
  });
  if (key !== expectedKey) {
    issues.push(error(path, 'Knowledge team artifact index key must match the artifact SHA-256 content address.'));
  }
}

export function validateKnowledgeTeamArtifactDescriptorPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  let factCount: number | null = null;
  let staleSourceCount: number | null = null;
  let sourceCount: number | null = null;
  let storagePolicySummary: KnowledgeStoragePolicySummary | null = null;

  if (payload.schemaVersion !== 1) {
    issues.push(error('$.schemaVersion', 'Knowledge team artifact descriptor schemaVersion must be 1.'));
  }
  if (payload.mutationAllowed !== false) {
    issues.push(error('$.mutationAllowed', 'Knowledge team artifact descriptor mutationAllowed must be false.'));
  }
  if (payload.backendKind !== 'mock-s3-compatible') {
    issues.push(error('$.backendKind', 'Knowledge team artifact descriptor backendKind must be mock-s3-compatible.'));
  }
  if (typeof payload.manifestId !== 'string' || !MANIFEST_ID_PATTERN.test(payload.manifestId)) {
    issues.push(error('$.manifestId', 'Knowledge team artifact descriptor manifestId must be a 24-character hex string.'));
  }

  if (!isRecord(payload.object)) {
    issues.push(error('$.object', 'Knowledge team artifact descriptor object must be an object.'));
  } else {
    const key = readNonEmptyString(payload.object.key, '$.object.key', issues);
    if (key !== null && !isSafeKnowledgeTeamArtifactObjectKey(key)) {
      issues.push(error('$.object.key', 'Knowledge team artifact descriptor object key must be backend-safe.'));
    }
    if (typeof payload.object.sha256 !== 'string' || !isKnowledgeTeamArtifactSha256(payload.object.sha256)) {
      issues.push(error('$.object.sha256', 'Knowledge team artifact descriptor object sha256 must be a SHA-256 hex string.'));
    }
    validateTeamArtifactObjectKeyMatchesSha(payload.object.key, payload.object.sha256, '$.object.key', issues);
    readPositiveInteger(payload.object.byteLength, '$.object.byteLength', issues);
    if (payload.object.contentType !== 'application/json') {
      issues.push(error('$.object.contentType', 'Knowledge team artifact descriptor contentType must be application/json.'));
    }
  }

  if (!isRecord(payload.artifact)) {
    issues.push(error('$.artifact', 'Knowledge team artifact descriptor artifact must be an object.'));
  } else {
    if (payload.artifact.kind !== 'infra-agent.knowledge-pack') {
      issues.push(error('$.artifact.kind', 'Knowledge team artifact descriptors currently support knowledge-pack artifacts only.'));
    }
    if (typeof payload.artifact.id !== 'string' || !PACK_ID_PATTERN.test(payload.artifact.id)) {
      issues.push(error('$.artifact.id', 'Knowledge team artifact descriptor artifact id must be a 24-character hex string.'));
    }
    sourceCount = readNonNegativeInteger(payload.artifact.sourceCount, '$.artifact.sourceCount', issues);
    factCount = readNonNegativeInteger(payload.artifact.factCount, '$.artifact.factCount', issues);
    staleSourceCount = readNonNegativeInteger(payload.artifact.staleSourceCount, '$.artifact.staleSourceCount', issues);
    storagePolicySummary = validateKnowledgeStoragePolicySummary(
      payload.artifact.storagePolicy,
      '$.artifact.storagePolicy',
      issues
    );
    if (staleSourceCount !== null && staleSourceCount > 0) {
      issues.push(error('$.artifact.staleSourceCount', 'Knowledge team artifact descriptors must reference fresh artifacts.'));
    }
    if (storagePolicySummary !== null && storagePolicySummary.workspacePrivate > 0) {
      issues.push(error('$.artifact.storagePolicy.workspacePrivate', 'Knowledge team artifact descriptors must not reference workspace-private sources.'));
    }
  }

  if (!isRecord(payload.publication)) {
    issues.push(error('$.publication', 'Knowledge team artifact descriptor publication must be an object.'));
  } else {
    const shareableByDefault = readBoolean(
      payload.publication.shareableByDefault,
      '$.publication.shareableByDefault',
      issues
    );
    const requiresExplicitOptIn = readBoolean(
      payload.publication.requiresExplicitOptIn,
      '$.publication.requiresExplicitOptIn',
      issues
    );
    const publishableByDefaultSourceCount = readNonNegativeInteger(
      payload.publication.publishableByDefaultSourceCount,
      '$.publication.publishableByDefaultSourceCount',
      issues
    );
    const blockedSourceCount = readNonNegativeInteger(
      payload.publication.blockedSourceCount,
      '$.publication.blockedSourceCount',
      issues
    );
    readPositiveInteger(
      payload.publication.requiredValidationCount,
      '$.publication.requiredValidationCount',
      issues
    );
    readNonEmptyString(payload.publication.reason, '$.publication.reason', issues);

    if (shareableByDefault !== true) {
      issues.push(error('$.publication.shareableByDefault', 'Knowledge team artifact descriptors must be shareable by default.'));
    }
    if (requiresExplicitOptIn !== false) {
      issues.push(error('$.publication.requiresExplicitOptIn', 'Knowledge team artifact descriptors must not require private-source opt-in.'));
    }
    if (blockedSourceCount !== null && blockedSourceCount > 0) {
      issues.push(error('$.publication.blockedSourceCount', 'Knowledge team artifact descriptors must not contain blocked sources.'));
    }
    if (
      publishableByDefaultSourceCount !== null
      && sourceCount !== null
      && publishableByDefaultSourceCount !== sourceCount
    ) {
      issues.push(error('$.publication.publishableByDefaultSourceCount', 'Knowledge team artifact descriptors must publish all artifact sources by default.'));
    }
  }

  validateNoTeamArtifactPayloadLeakage(payload, '$', issues);

  return createEmptyKnowledgeValidationReport({
    inputPath,
    inputKind,
    issues,
    factCount: factCount ?? 0,
    staleSourceCount: staleSourceCount ?? 0
  });
}

export function validateKnowledgeTeamArtifactIndexEntryPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  let factCount: number | null = null;
  let staleSourceCount: number | null = null;
  let sourceCount: number | null = null;
  let storagePolicySummary: KnowledgeStoragePolicySummary | null = null;

  if (payload.schemaVersion !== 1) {
    issues.push(error('$.schemaVersion', 'Knowledge team artifact index entry schemaVersion must be 1.'));
  }
  if (payload.mutationAllowed !== false) {
    issues.push(error('$.mutationAllowed', 'Knowledge team artifact index entry mutationAllowed must be false.'));
  }
  if (payload.backendKind !== 'mock-s3-compatible') {
    issues.push(error('$.backendKind', 'Knowledge team artifact index entry backendKind must be mock-s3-compatible.'));
  }
  if (typeof payload.sourceManifestId !== 'string' || !MANIFEST_ID_PATTERN.test(payload.sourceManifestId)) {
    issues.push(error('$.sourceManifestId', 'Knowledge team artifact index entry sourceManifestId must be a 24-character hex string.'));
  }

  if (!isRecord(payload.index)) {
    issues.push(error('$.index', 'Knowledge team artifact index entry index must be an object.'));
  } else {
    const key = readNonEmptyString(payload.index.key, '$.index.key', issues);
    if (key !== null && !isSafeKnowledgeTeamArtifactObjectKey(key)) {
      issues.push(error('$.index.key', 'Knowledge team artifact index entry key must be backend-safe.'));
    }
    if (payload.index.source !== 'descriptor') {
      issues.push(error('$.index.source', 'Knowledge team artifact index entry source must be descriptor.'));
    }
  }

  if (!isRecord(payload.object)) {
    issues.push(error('$.object', 'Knowledge team artifact index entry object must be an object.'));
  } else {
    const key = readNonEmptyString(payload.object.key, '$.object.key', issues);
    if (key !== null && !isSafeKnowledgeTeamArtifactObjectKey(key)) {
      issues.push(error('$.object.key', 'Knowledge team artifact index entry object key must be backend-safe.'));
    }
    if (typeof payload.object.sha256 !== 'string' || !isKnowledgeTeamArtifactSha256(payload.object.sha256)) {
      issues.push(error('$.object.sha256', 'Knowledge team artifact index entry object sha256 must be a SHA-256 hex string.'));
    }
    validateTeamArtifactObjectKeyMatchesSha(payload.object.key, payload.object.sha256, '$.object.key', issues);
    if (isRecord(payload.index)) {
      validateTeamArtifactIndexKeyMatchesSha(payload.index.key, payload.object.sha256, '$.index.key', issues);
    }
    readPositiveInteger(payload.object.byteLength, '$.object.byteLength', issues);
    if (payload.object.contentType !== 'application/json') {
      issues.push(error('$.object.contentType', 'Knowledge team artifact index entry contentType must be application/json.'));
    }
  }

  if (!isRecord(payload.artifact)) {
    issues.push(error('$.artifact', 'Knowledge team artifact index entry artifact must be an object.'));
  } else {
    if (payload.artifact.kind !== 'infra-agent.knowledge-pack') {
      issues.push(error('$.artifact.kind', 'Knowledge team artifact index entries currently support knowledge-pack artifacts only.'));
    }
    if (typeof payload.artifact.id !== 'string' || !PACK_ID_PATTERN.test(payload.artifact.id)) {
      issues.push(error('$.artifact.id', 'Knowledge team artifact index entry artifact id must be a 24-character hex string.'));
    }
    sourceCount = readNonNegativeInteger(payload.artifact.sourceCount, '$.artifact.sourceCount', issues);
    factCount = readNonNegativeInteger(payload.artifact.factCount, '$.artifact.factCount', issues);
    staleSourceCount = readNonNegativeInteger(payload.artifact.staleSourceCount, '$.artifact.staleSourceCount', issues);
    storagePolicySummary = validateKnowledgeStoragePolicySummary(
      payload.artifact.storagePolicy,
      '$.artifact.storagePolicy',
      issues
    );
    if (staleSourceCount !== null && staleSourceCount > 0) {
      issues.push(error('$.artifact.staleSourceCount', 'Knowledge team artifact index entries must reference fresh artifacts.'));
    }
    if (storagePolicySummary !== null && storagePolicySummary.workspacePrivate > 0) {
      issues.push(error('$.artifact.storagePolicy.workspacePrivate', 'Knowledge team artifact index entries must not reference workspace-private sources.'));
    }
  }

  if (!isRecord(payload.publication)) {
    issues.push(error('$.publication', 'Knowledge team artifact index entry publication must be an object.'));
  } else {
    const shareableByDefault = readBoolean(
      payload.publication.shareableByDefault,
      '$.publication.shareableByDefault',
      issues
    );
    const requiresExplicitOptIn = readBoolean(
      payload.publication.requiresExplicitOptIn,
      '$.publication.requiresExplicitOptIn',
      issues
    );
    const publishableByDefaultSourceCount = readNonNegativeInteger(
      payload.publication.publishableByDefaultSourceCount,
      '$.publication.publishableByDefaultSourceCount',
      issues
    );
    const blockedSourceCount = readNonNegativeInteger(
      payload.publication.blockedSourceCount,
      '$.publication.blockedSourceCount',
      issues
    );
    readPositiveInteger(
      payload.publication.requiredValidationCount,
      '$.publication.requiredValidationCount',
      issues
    );
    readNonEmptyString(payload.publication.reason, '$.publication.reason', issues);

    if (shareableByDefault !== true) {
      issues.push(error('$.publication.shareableByDefault', 'Knowledge team artifact index entries must be shareable by default.'));
    }
    if (requiresExplicitOptIn !== false) {
      issues.push(error('$.publication.requiresExplicitOptIn', 'Knowledge team artifact index entries must not require private-source opt-in.'));
    }
    if (blockedSourceCount !== null && blockedSourceCount > 0) {
      issues.push(error('$.publication.blockedSourceCount', 'Knowledge team artifact index entries must not contain blocked sources.'));
    }
    if (
      publishableByDefaultSourceCount !== null
      && sourceCount !== null
      && publishableByDefaultSourceCount !== sourceCount
    ) {
      issues.push(error('$.publication.publishableByDefaultSourceCount', 'Knowledge team artifact index entries must publish all artifact sources by default.'));
    }
  }

  validateNoTeamArtifactPayloadLeakage(payload, '$', issues);

  return createEmptyKnowledgeValidationReport({
    inputPath,
    inputKind,
    issues,
    factCount: factCount ?? 0,
    staleSourceCount: staleSourceCount ?? 0
  });
}

export function validateKnowledgeTeamPublicationPlanPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  let factCount: number | null = null;
  let staleSourceCount: number | null = null;
  let sourceCount: number | null = null;

  if (payload.schemaVersion !== 1) {
    issues.push(error('$.schemaVersion', 'Knowledge team publication plan schemaVersion must be 1.'));
  }
  if (payload.mutationAllowed !== false) {
    issues.push(error('$.mutationAllowed', 'Knowledge team publication plan mutationAllowed must be false.'));
  }
  if (payload.executionMode !== 'dry-run') {
    issues.push(error('$.executionMode', 'Knowledge team publication plan executionMode must be dry-run.'));
  }
  if (payload.remoteWriteAllowed !== false) {
    issues.push(error('$.remoteWriteAllowed', 'Knowledge team publication plan must not allow remote writes.'));
  }
  if (payload.credentialRequired !== false) {
    issues.push(error('$.credentialRequired', 'Knowledge team publication plan must not require credentials.'));
  }
  if (payload.uploadCommand !== null) {
    issues.push(error('$.uploadCommand', 'Knowledge team publication plan must not include an upload command.'));
  }
  if (payload.plannedBackendKind !== 'mock-s3-compatible') {
    issues.push(error('$.plannedBackendKind', 'Knowledge team publication plan plannedBackendKind must be mock-s3-compatible.'));
  }
  if (typeof payload.manifestId !== 'string' || !MANIFEST_ID_PATTERN.test(payload.manifestId)) {
    issues.push(error('$.manifestId', 'Knowledge team publication plan manifestId must be a 24-character hex string.'));
  }

  if (!isRecord(payload.object)) {
    issues.push(error('$.object', 'Knowledge team publication plan object must be an object.'));
  } else {
    const key = readNonEmptyString(payload.object.key, '$.object.key', issues);
    if (key !== null && !isSafeKnowledgeTeamArtifactObjectKey(key)) {
      issues.push(error('$.object.key', 'Knowledge team publication plan object key must be backend-safe.'));
    }
    if (typeof payload.object.sha256 !== 'string' || !isKnowledgeTeamArtifactSha256(payload.object.sha256)) {
      issues.push(error('$.object.sha256', 'Knowledge team publication plan object sha256 must be a SHA-256 hex string.'));
    }
    validateTeamArtifactObjectKeyMatchesSha(payload.object.key, payload.object.sha256, '$.object.key', issues);
    readPositiveInteger(payload.object.byteLength, '$.object.byteLength', issues);
    if (payload.object.contentType !== 'application/json') {
      issues.push(error('$.object.contentType', 'Knowledge team publication plan contentType must be application/json.'));
    }
  }

  if (!isRecord(payload.artifact)) {
    issues.push(error('$.artifact', 'Knowledge team publication plan artifact must be an object.'));
  } else {
    if (payload.artifact.kind !== 'infra-agent.knowledge-pack') {
      issues.push(error('$.artifact.kind', 'Knowledge team publication plans currently support knowledge-pack artifacts only.'));
    }
    if (typeof payload.artifact.id !== 'string' || !PACK_ID_PATTERN.test(payload.artifact.id)) {
      issues.push(error('$.artifact.id', 'Knowledge team publication plan artifact id must be a 24-character hex string.'));
    }
    sourceCount = readNonNegativeInteger(payload.artifact.sourceCount, '$.artifact.sourceCount', issues);
    factCount = readNonNegativeInteger(payload.artifact.factCount, '$.artifact.factCount', issues);
    staleSourceCount = readNonNegativeInteger(payload.artifact.staleSourceCount, '$.artifact.staleSourceCount', issues);
    validateKnowledgeStoragePolicySummary(
      payload.artifact.storagePolicy,
      '$.artifact.storagePolicy',
      issues
    );
  }

  if (!isRecord(payload.validation)) {
    issues.push(error('$.validation', 'Knowledge team publication plan validation must be an object.'));
  } else {
    readBoolean(payload.validation.artifactHashMatches, '$.validation.artifactHashMatches', issues);
    readBoolean(payload.validation.artifactMetadataMatches, '$.validation.artifactMetadataMatches', issues);
    readBoolean(payload.validation.descriptorProvided, '$.validation.descriptorProvided', issues);
    if (
      payload.validation.descriptorMatches !== null
      && typeof payload.validation.descriptorMatches !== 'boolean'
    ) {
      issues.push(error('$.validation.descriptorMatches', 'Knowledge team publication plan descriptorMatches must be a boolean or null.'));
    }
  }

  let publicationAllowed: boolean | null = null;
  if (!isRecord(payload.publication)) {
    issues.push(error('$.publication', 'Knowledge team publication plan publication must be an object.'));
  } else {
    publicationAllowed = readBoolean(payload.publication.allowed, '$.publication.allowed', issues);
    readBoolean(payload.publication.shareableByDefault, '$.publication.shareableByDefault', issues);
    readBoolean(payload.publication.requiresExplicitOptIn, '$.publication.requiresExplicitOptIn', issues);
    readNonNegativeInteger(
      payload.publication.publishableByDefaultSourceCount,
      '$.publication.publishableByDefaultSourceCount',
      issues
    );
    readNonNegativeInteger(payload.publication.blockedSourceCount, '$.publication.blockedSourceCount', issues);
    readPositiveInteger(
      payload.publication.requiredValidationCount,
      '$.publication.requiredValidationCount',
      issues
    );
    const blockerCount = readNonNegativeInteger(payload.publication.blockerCount, '$.publication.blockerCount', issues);
    const blockerCodes = readStringArray(payload.publication.blockerCodes, '$.publication.blockerCodes', issues);
    if (blockerCodes !== null) {
      for (const [index, blockerCode] of blockerCodes.entries()) {
        if (!KNOWLEDGE_TEAM_PUBLICATION_BLOCKERS.includes(blockerCode as typeof KNOWLEDGE_TEAM_PUBLICATION_BLOCKERS[number])) {
          issues.push(error(`$.publication.blockerCodes[${index}]`, 'Knowledge team publication plan blocker code must be supported.'));
        }
      }
    }
    if (!Array.isArray(payload.publication.blockers)) {
      issues.push(error('$.publication.blockers', 'Knowledge team publication plan blockers must be an array.'));
    } else {
      if (blockerCount !== null && blockerCount !== payload.publication.blockers.length) {
        issues.push(error('$.publication.blockerCount', 'Knowledge team publication plan blockerCount must match blockers.length.'));
      }
      payload.publication.blockers.forEach((blocker, index) => {
        const path = `$.publication.blockers[${index}]`;
        if (!isRecord(blocker)) {
          issues.push(error(path, 'Knowledge team publication plan blocker must be an object.'));
          return;
        }
        if (
          typeof blocker.code !== 'string'
          || !KNOWLEDGE_TEAM_PUBLICATION_BLOCKERS.includes(blocker.code as typeof KNOWLEDGE_TEAM_PUBLICATION_BLOCKERS[number])
        ) {
          issues.push(error(`${path}.code`, 'Knowledge team publication plan blocker code must be supported.'));
        }
        readNonEmptyString(blocker.path, `${path}.path`, issues);
        readNonEmptyString(blocker.message, `${path}.message`, issues);
      });
      if (publicationAllowed === true && payload.publication.blockers.length > 0) {
        issues.push(error('$.publication.allowed', 'Allowed team publication plans must not include blockers.'));
      }
      if (publicationAllowed === false && payload.publication.blockers.length === 0) {
        issues.push(error('$.publication.blockers', 'Blocked team publication plans must include at least one blocker.'));
      }
      validateBlockerCodeSummary({
        blockerCodes,
        blockers: payload.publication.blockers,
        path: '$.publication.blockerCodes',
        issues,
        message: 'Knowledge team artifact blockerCodes must match the unique blocker codes.'
      });
    }
    readNonEmptyString(payload.publication.reason, '$.publication.reason', issues);
  }

  if (!isRecord(payload.descriptor)) {
    issues.push(error('$.descriptor', 'Knowledge team publication plan descriptor must be an object.'));
  } else {
    const descriptorProvided = readBoolean(payload.descriptor.provided, '$.descriptor.provided', issues);
    const descriptorReusable = readBoolean(payload.descriptor.reusable, '$.descriptor.reusable', issues);
    if (
      payload.descriptor.objectKey !== null
      && (typeof payload.descriptor.objectKey !== 'string' || !isSafeKnowledgeTeamArtifactObjectKey(payload.descriptor.objectKey))
    ) {
      issues.push(error('$.descriptor.objectKey', 'Knowledge team publication plan descriptor objectKey must be backend-safe or null.'));
    }
    if (descriptorProvided === false && payload.descriptor.objectKey !== null) {
      issues.push(error('$.descriptor.objectKey', 'Knowledge team publication plan descriptor objectKey must be null when no descriptor was provided.'));
    }
    if (descriptorReusable === true && publicationAllowed !== true) {
      issues.push(error('$.descriptor.reusable', 'Knowledge team publication plan descriptor can be reusable only for allowed plans.'));
    }
  }

  if (
    publicationAllowed === true
    && staleSourceCount !== null
    && staleSourceCount > 0
  ) {
    issues.push(error('$.artifact.staleSourceCount', 'Allowed team publication plans must reference fresh artifacts.'));
  }
  if (
    publicationAllowed === true
    && sourceCount !== null
    && isRecord(payload.publication)
    && payload.publication.publishableByDefaultSourceCount !== sourceCount
  ) {
    issues.push(error('$.publication.publishableByDefaultSourceCount', 'Allowed team publication plans must publish all artifact sources by default.'));
  }

  validateNoTeamArtifactPayloadLeakage(payload, '$', issues);

  return createEmptyKnowledgeValidationReport({
    inputPath,
    inputKind,
    issues,
    factCount: factCount ?? 0,
    staleSourceCount: staleSourceCount ?? 0
  });
}

export function validateKnowledgeTeamPublicationReadinessPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  let factCount: number | null = null;
  let staleSourceCount: number | null = null;
  let sourceCount: number | null = null;

  if (payload.schemaVersion !== 1) {
    issues.push(error('$.schemaVersion', 'Knowledge team publication readiness schemaVersion must be 1.'));
  }
  if (payload.mutationAllowed !== false) {
    issues.push(error('$.mutationAllowed', 'Knowledge team publication readiness mutationAllowed must be false.'));
  }
  if (payload.executionMode !== 'dry-run') {
    issues.push(error('$.executionMode', 'Knowledge team publication readiness executionMode must be dry-run.'));
  }
  if (payload.remoteWriteAllowed !== false) {
    issues.push(error('$.remoteWriteAllowed', 'Knowledge team publication readiness must not allow remote writes.'));
  }
  if (payload.credentialRequired !== false) {
    issues.push(error('$.credentialRequired', 'Knowledge team publication readiness must not require credentials.'));
  }
  if (payload.uploadCommand !== null) {
    issues.push(error('$.uploadCommand', 'Knowledge team publication readiness must not include an upload command.'));
  }
  if (payload.plannedBackendKind !== 'mock-s3-compatible') {
    issues.push(error('$.plannedBackendKind', 'Knowledge team publication readiness plannedBackendKind must be mock-s3-compatible.'));
  }
  if (typeof payload.manifestId !== 'string' || !MANIFEST_ID_PATTERN.test(payload.manifestId)) {
    issues.push(error('$.manifestId', 'Knowledge team publication readiness manifestId must be a 24-character hex string.'));
  }

  if (!isRecord(payload.object)) {
    issues.push(error('$.object', 'Knowledge team publication readiness object must be an object.'));
  } else {
    const key = readNonEmptyString(payload.object.key, '$.object.key', issues);
    if (key !== null && !isSafeKnowledgeTeamArtifactObjectKey(key)) {
      issues.push(error('$.object.key', 'Knowledge team publication readiness object key must be backend-safe.'));
    }
    if (typeof payload.object.sha256 !== 'string' || !isKnowledgeTeamArtifactSha256(payload.object.sha256)) {
      issues.push(error('$.object.sha256', 'Knowledge team publication readiness object sha256 must be a SHA-256 hex string.'));
    }
    validateTeamArtifactObjectKeyMatchesSha(payload.object.key, payload.object.sha256, '$.object.key', issues);
    readPositiveInteger(payload.object.byteLength, '$.object.byteLength', issues);
    if (payload.object.contentType !== 'application/json') {
      issues.push(error('$.object.contentType', 'Knowledge team publication readiness contentType must be application/json.'));
    }
  }

  if (!isRecord(payload.artifact)) {
    issues.push(error('$.artifact', 'Knowledge team publication readiness artifact must be an object.'));
  } else {
    if (payload.artifact.kind !== 'infra-agent.knowledge-pack') {
      issues.push(error('$.artifact.kind', 'Knowledge team publication readiness currently supports knowledge-pack artifacts only.'));
    }
    if (typeof payload.artifact.id !== 'string' || !PACK_ID_PATTERN.test(payload.artifact.id)) {
      issues.push(error('$.artifact.id', 'Knowledge team publication readiness artifact id must be a 24-character hex string.'));
    }
    sourceCount = readNonNegativeInteger(payload.artifact.sourceCount, '$.artifact.sourceCount', issues);
    factCount = readNonNegativeInteger(payload.artifact.factCount, '$.artifact.factCount', issues);
    staleSourceCount = readNonNegativeInteger(payload.artifact.staleSourceCount, '$.artifact.staleSourceCount', issues);
    validateKnowledgeStoragePolicySummary(
      payload.artifact.storagePolicy,
      '$.artifact.storagePolicy',
      issues
    );
  }

  let publicationAllowed: boolean | null = null;
  if (!isRecord(payload.publication)) {
    issues.push(error('$.publication', 'Knowledge team publication readiness publication must be an object.'));
  } else {
    publicationAllowed = readBoolean(payload.publication.allowed, '$.publication.allowed', issues);
    const blockerCount = readNonNegativeInteger(payload.publication.blockerCount, '$.publication.blockerCount', issues);
    const blockerCodes = readStringArray(payload.publication.blockerCodes, '$.publication.blockerCodes', issues);
    if (blockerCodes !== null) {
      for (const [index, blockerCode] of blockerCodes.entries()) {
        if (!KNOWLEDGE_TEAM_PUBLICATION_BLOCKERS.includes(blockerCode as typeof KNOWLEDGE_TEAM_PUBLICATION_BLOCKERS[number])) {
          issues.push(error(`$.publication.blockerCodes[${index}]`, 'Knowledge team publication readiness publication blocker code must be supported.'));
        }
      }
    }
    if (publicationAllowed === true && blockerCount !== null && blockerCount > 0) {
      issues.push(error('$.publication.blockerCount', 'Allowed team publication readiness payloads must not carry publication blockers.'));
    }
  }

  let indexEntryProvided: boolean | null = null;
  let indexEntryMatches: boolean | null = null;
  if (!isRecord(payload.indexEntry)) {
    issues.push(error('$.indexEntry', 'Knowledge team publication readiness indexEntry must be an object.'));
  } else {
    indexEntryProvided = readBoolean(payload.indexEntry.provided, '$.indexEntry.provided', issues);
    if (payload.indexEntry.matches !== null && typeof payload.indexEntry.matches !== 'boolean') {
      issues.push(error('$.indexEntry.matches', 'Knowledge team publication readiness indexEntry.matches must be a boolean or null.'));
    } else {
      indexEntryMatches = payload.indexEntry.matches;
    }
    if (
      payload.indexEntry.key !== null
      && (typeof payload.indexEntry.key !== 'string' || !isSafeKnowledgeTeamArtifactObjectKey(payload.indexEntry.key))
    ) {
      issues.push(error('$.indexEntry.key', 'Knowledge team publication readiness indexEntry key must be backend-safe or null.'));
    }
    if (
      payload.indexEntry.objectKey !== null
      && (typeof payload.indexEntry.objectKey !== 'string' || !isSafeKnowledgeTeamArtifactObjectKey(payload.indexEntry.objectKey))
    ) {
      issues.push(error('$.indexEntry.objectKey', 'Knowledge team publication readiness indexEntry objectKey must be backend-safe or null.'));
    }
    if (indexEntryProvided === false && (payload.indexEntry.key !== null || payload.indexEntry.objectKey !== null)) {
      issues.push(error('$.indexEntry', 'Knowledge team publication readiness indexEntry keys must be null when no index entry was provided.'));
    }
    if (indexEntryMatches === true && indexEntryProvided !== true) {
      issues.push(error('$.indexEntry.matches', 'Knowledge team publication readiness can match an index entry only when one was provided.'));
    }
  }

  let status: string | null = null;
  if (!isRecord(payload.readiness)) {
    issues.push(error('$.readiness', 'Knowledge team publication readiness readiness must be an object.'));
  } else {
    if (
      typeof payload.readiness.status !== 'string'
      || !KNOWLEDGE_TEAM_READINESS_STATUSES.includes(payload.readiness.status as typeof KNOWLEDGE_TEAM_READINESS_STATUSES[number])
    ) {
      issues.push(error('$.readiness.status', 'Knowledge team publication readiness status must be supported.'));
    } else {
      status = payload.readiness.status;
    }
    if (
      typeof payload.readiness.nextAction !== 'string'
      || !KNOWLEDGE_TEAM_READINESS_NEXT_ACTIONS.includes(payload.readiness.nextAction as typeof KNOWLEDGE_TEAM_READINESS_NEXT_ACTIONS[number])
    ) {
      issues.push(error('$.readiness.nextAction', 'Knowledge team publication readiness nextAction must be supported.'));
    }
    const blockerCount = readNonNegativeInteger(payload.readiness.blockerCount, '$.readiness.blockerCount', issues);
    const blockerCodes = readStringArray(payload.readiness.blockerCodes, '$.readiness.blockerCodes', issues);
    if (blockerCodes !== null) {
      for (const [index, blockerCode] of blockerCodes.entries()) {
        if (!KNOWLEDGE_TEAM_READINESS_BLOCKERS.includes(blockerCode as typeof KNOWLEDGE_TEAM_READINESS_BLOCKERS[number])) {
          issues.push(error(`$.readiness.blockerCodes[${index}]`, 'Knowledge team publication readiness blocker code must be supported.'));
        }
      }
    }
    if (!Array.isArray(payload.readiness.blockers)) {
      issues.push(error('$.readiness.blockers', 'Knowledge team publication readiness blockers must be an array.'));
    } else {
      if (blockerCount !== null && blockerCount !== payload.readiness.blockers.length) {
        issues.push(error('$.readiness.blockerCount', 'Knowledge team publication readiness blockerCount must match blockers.length.'));
      }
      payload.readiness.blockers.forEach((blocker, index) => {
        const path = `$.readiness.blockers[${index}]`;
        if (!isRecord(blocker)) {
          issues.push(error(path, 'Knowledge team publication readiness blocker must be an object.'));
          return;
        }
        if (
          typeof blocker.code !== 'string'
          || !KNOWLEDGE_TEAM_READINESS_BLOCKERS.includes(blocker.code as typeof KNOWLEDGE_TEAM_READINESS_BLOCKERS[number])
        ) {
          issues.push(error(`${path}.code`, 'Knowledge team publication readiness blocker code must be supported.'));
        }
        readNonEmptyString(blocker.path, `${path}.path`, issues);
        readNonEmptyString(blocker.message, `${path}.message`, issues);
      });
      if ((status === 'already-published' || status === 'upload-required') && payload.readiness.blockers.length > 0) {
        issues.push(error('$.readiness.blockers', 'Ready or upload-required publication readiness payloads must not include blockers.'));
      }
      if ((status === 'blocked' || status === 'conflict') && payload.readiness.blockers.length === 0) {
        issues.push(error('$.readiness.blockers', 'Blocked or conflict publication readiness payloads must include blockers.'));
      }
      validateBlockerCodeSummary({
        blockerCodes,
        blockers: payload.readiness.blockers,
        path: '$.readiness.blockerCodes',
        issues,
        message: 'Knowledge team artifact blockerCodes must match the unique blocker codes.'
      });
    }
    readNonEmptyString(payload.readiness.reason, '$.readiness.reason', issues);
  }

  if (status === 'already-published') {
    if (publicationAllowed !== true) {
      issues.push(error('$.publication.allowed', 'Already-published readiness requires an allowed publication plan.'));
    }
    if (indexEntryProvided !== true || indexEntryMatches !== true) {
      issues.push(error('$.indexEntry.matches', 'Already-published readiness requires a matching index entry.'));
    }
    if (isRecord(payload.readiness) && payload.readiness.nextAction !== 'none') {
      issues.push(error('$.readiness.nextAction', 'Already-published readiness nextAction must be none.'));
    }
  }
  if (status === 'upload-required') {
    if (publicationAllowed !== true) {
      issues.push(error('$.publication.allowed', 'Upload-required readiness requires an allowed publication plan.'));
    }
    if (indexEntryProvided !== false || indexEntryMatches !== null) {
      issues.push(error('$.indexEntry', 'Upload-required readiness must not include an index entry.'));
    }
    if (isRecord(payload.readiness) && payload.readiness.nextAction !== 'prepare-explicit-upload') {
      issues.push(error('$.readiness.nextAction', 'Upload-required readiness nextAction must be prepare-explicit-upload.'));
    }
  }
  if (status === 'blocked') {
    if (publicationAllowed !== false) {
      issues.push(error('$.publication.allowed', 'Blocked readiness requires a blocked publication plan.'));
    }
    if (isRecord(payload.readiness) && payload.readiness.nextAction !== 'resolve-blockers') {
      issues.push(error('$.readiness.nextAction', 'Blocked readiness nextAction must be resolve-blockers.'));
    }
  }
  if (status === 'conflict') {
    if (publicationAllowed !== true) {
      issues.push(error('$.publication.allowed', 'Conflict readiness requires an allowed publication plan with index disagreement.'));
    }
    if (indexEntryProvided !== true || indexEntryMatches !== false) {
      issues.push(error('$.indexEntry.matches', 'Conflict readiness requires a non-matching index entry.'));
    }
    if (isRecord(payload.readiness) && payload.readiness.nextAction !== 'review-index-conflict') {
      issues.push(error('$.readiness.nextAction', 'Conflict readiness nextAction must be review-index-conflict.'));
    }
  }

  if (publicationAllowed === true && staleSourceCount !== null && staleSourceCount > 0) {
    issues.push(error('$.artifact.staleSourceCount', 'Allowed team publication readiness must reference fresh artifacts.'));
  }
  if (
    publicationAllowed === true
    && sourceCount !== null
    && isRecord(payload.artifact)
    && isRecord(payload.artifact.storagePolicy)
    && payload.artifact.storagePolicy.publicReference !== sourceCount
  ) {
    issues.push(error('$.artifact.storagePolicy.publicReference', 'Allowed team publication readiness must reference public-reference sources.'));
  }

  validateNoTeamArtifactPayloadLeakage(payload, '$', issues);

  return createEmptyKnowledgeValidationReport({
    inputPath,
    inputKind,
    issues,
    factCount: factCount ?? 0,
    staleSourceCount: staleSourceCount ?? 0
  });
}
