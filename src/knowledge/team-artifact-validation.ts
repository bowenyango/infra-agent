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
