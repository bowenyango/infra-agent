import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import type {
  KnowledgeArtifactManifest,
  KnowledgeArtifactPayload
} from './artifact-manifest.ts';
import type { KnowledgePack } from './pack.ts';
import type { KnowledgeStoragePolicySummary } from './storage-policy.ts';

export type KnowledgeTeamArtifactBackendKind = 'mock-s3-compatible';
export type KnowledgeTeamArtifactFamily =
  | 'knowledge-extraction'
  | 'knowledge-pack';
export type KnowledgeTeamArtifactContentType = 'application/json';
export type KnowledgeTeamArtifactStoreErrorCode =
  | 'artifact-hash-mismatch'
  | 'artifact-metadata-mismatch'
  | 'invalid-artifact-json'
  | 'invalid-content-type'
  | 'invalid-object-key'
  | 'object-conflict'
  | 'object-not-found'
  | 'publication-blocked'
  | 'unsupported-artifact-kind';
export type KnowledgeTeamArtifactPolicyIssueCode =
  | 'explicit-opt-in-required'
  | 'forged-publication-plan'
  | 'stale-source'
  | 'unchecked-source'
  | 'unsupported-artifact-kind'
  | 'workspace-private-source';

export interface KnowledgeTeamArtifactDescriptor {
  kind: 'infra-agent.knowledge-team-artifact-descriptor';
  schemaVersion: 1;
  mutationAllowed: false;
  backendKind: KnowledgeTeamArtifactBackendKind;
  manifestId: KnowledgeArtifactManifest['manifestId'];
  object: {
    key: string;
    sha256: string;
    byteLength: number;
    contentType: KnowledgeTeamArtifactContentType;
  };
  artifact: {
    kind: 'infra-agent.knowledge-pack';
    id: string;
    sourceCount: number;
    factCount: number;
    staleSourceCount: number;
    storagePolicy: KnowledgeStoragePolicySummary;
  };
  publication: {
    shareableByDefault: boolean;
    requiresExplicitOptIn: boolean;
    publishableByDefaultSourceCount: number;
    blockedSourceCount: number;
    requiredValidationCount: number;
    reason: string;
  };
}

export interface KnowledgeTeamArtifactStoredObject {
  backendKind: KnowledgeTeamArtifactBackendKind;
  key: string;
  sha256: string;
  byteLength: number;
  contentType: KnowledgeTeamArtifactContentType;
  metadata: Record<string, string>;
}

export interface KnowledgeTeamArtifactStoredBytes extends KnowledgeTeamArtifactStoredObject {
  bytes: Buffer;
}

export interface KnowledgeTeamArtifactPutInput {
  key: string;
  bytes: Buffer;
  contentType: KnowledgeTeamArtifactContentType;
  metadata?: Record<string, string>;
}

export interface KnowledgeTeamArtifactPutResult extends KnowledgeTeamArtifactStoredObject {
  alreadyPresent: boolean;
}

export interface KnowledgeTeamArtifactStore {
  readonly backendKind: KnowledgeTeamArtifactBackendKind;
  putObject(input: KnowledgeTeamArtifactPutInput): Promise<KnowledgeTeamArtifactPutResult>;
  headObject(key: string): Promise<KnowledgeTeamArtifactStoredObject | null>;
  getObject(key: string): Promise<KnowledgeTeamArtifactStoredBytes | null>;
}

export interface KnowledgeTeamArtifactPolicyIssue {
  code: KnowledgeTeamArtifactPolicyIssueCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamArtifactPolicyDecision {
  allowed: boolean;
  issues: KnowledgeTeamArtifactPolicyIssue[];
}

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_OBJECT_KEY_PATTERN = /^[a-z0-9][a-z0-9/_\-.]*$/;
const SAFE_METADATA_KEY_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
const FORBIDDEN_METADATA_KEY_PATTERN = /(bucket|endpoint|url|credential|secret|token|password|authorization|header)/i;
const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const BACKEND_URL_PATTERN = /(?:https?:\/\/|s3:\/\/)/i;

export class KnowledgeTeamArtifactStoreError extends Error {
  readonly code: KnowledgeTeamArtifactStoreErrorCode;

  constructor(code: KnowledgeTeamArtifactStoreErrorCode, message: string) {
    super(message);
    this.name = 'KnowledgeTeamArtifactStoreError';
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalizeJsonValue(value: unknown, path = '$'): unknown {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${path} must be a finite JSON number.`);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) => canonicalizeJsonValue(entry, `${path}[${index}]`));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter(key => value[key] !== undefined)
        .map(key => [key, canonicalizeJsonValue(value[key], `${path}.${key}`)])
    );
  }

  throw new TypeError(`${path} must be JSON-serializable.`);
}

function artifactFamily(artifactKind: KnowledgeArtifactPayload['kind']): KnowledgeTeamArtifactFamily {
  return artifactKind === 'infra-agent.knowledge-pack'
    ? 'knowledge-pack'
    : 'knowledge-extraction';
}

function isKnowledgePackPayload(value: unknown): value is KnowledgePack {
  return isRecord(value) && value.kind === 'infra-agent.knowledge-pack';
}

function policyIssue(
  code: KnowledgeTeamArtifactPolicyIssueCode,
  path: string,
  message: string
): KnowledgeTeamArtifactPolicyIssue {
  return {
    code,
    path,
    message
  };
}

export function serializeKnowledgeArtifactPayload(payload: KnowledgeArtifactPayload): string {
  return `${JSON.stringify(canonicalizeJsonValue(payload), null, 2)}\n`;
}

export function hashKnowledgeArtifactPayload(payload: KnowledgeArtifactPayload): string {
  return createHash('sha256')
    .update(serializeKnowledgeArtifactPayload(payload))
    .digest('hex');
}

export function isKnowledgeTeamArtifactSha256(value: string): boolean {
  return SHA256_HEX_PATTERN.test(value);
}

export function buildKnowledgeTeamArtifactObjectKey(input: {
  artifactKind: KnowledgeArtifactPayload['kind'];
  sha256: string;
}): string {
  if (!isKnowledgeTeamArtifactSha256(input.sha256)) {
    throw new Error('Knowledge team artifact object key requires a SHA-256 hex digest.');
  }

  const family = artifactFamily(input.artifactKind);
  return `knowledge-artifacts/v1/${family}/sha256/${input.sha256.slice(0, 2)}/${input.sha256}.json`;
}

export function isSafeKnowledgeTeamArtifactObjectKey(key: string): boolean {
  return SAFE_OBJECT_KEY_PATTERN.test(key)
    && !key.startsWith('/')
    && !key.includes('//')
    && !key.split('/').includes('..')
    && !key.includes('\\')
    && !key.includes('?')
    && !key.includes('#');
}

export function evaluateKnowledgeTeamArtifactPublicationPolicy(input: {
  manifest: KnowledgeArtifactManifest;
  payload?: unknown;
}): KnowledgeTeamArtifactPolicyDecision {
  const issues: KnowledgeTeamArtifactPolicyIssue[] = [];
  const { manifest, payload } = input;

  if (manifest.artifact.kind !== 'infra-agent.knowledge-pack') {
    issues.push(policyIssue(
      'unsupported-artifact-kind',
      '$.artifact.kind',
      'Only knowledge-pack artifacts may be staged for the team artifact store.'
    ));
  }
  if (
    manifest.publication.executionMode !== 'plan-only'
    || manifest.publication.remoteWriteAllowed !== false
    || manifest.publication.credentialRequired !== false
    || manifest.publication.uploadCommand !== null
  ) {
    issues.push(policyIssue(
      'forged-publication-plan',
      '$.publication',
      'Team artifact staging requires a plan-only manifest without remote commands or credentials.'
    ));
  }
  if (!manifest.publication.shareableByDefault || manifest.publication.requiresExplicitOptIn) {
    issues.push(policyIssue(
      'explicit-opt-in-required',
      '$.publication.requiresExplicitOptIn',
      'Artifact publication requires explicit opt-in and is not accepted by the default team artifact policy.'
    ));
  }
  if (manifest.publication.blockedSources.length > 0) {
    for (const blockedSource of manifest.publication.blockedSources) {
      issues.push(policyIssue(
        blockedSource.reason === 'stale-source'
          ? 'stale-source'
          : blockedSource.reason === 'workspace-private-source'
            ? 'workspace-private-source'
            : 'explicit-opt-in-required',
        '$.publication.blockedSources',
        'Artifact contains a source that is not publishable by default.'
      ));
    }
  }
  if (manifest.artifact.staleSourceCount > 0) {
    issues.push(policyIssue(
      'stale-source',
      '$.artifact.staleSourceCount',
      'Artifact contains stale sources and must be refreshed before team artifact staging.'
    ));
  }
  if (manifest.artifact.storagePolicy.workspacePrivate > 0) {
    issues.push(policyIssue(
      'workspace-private-source',
      '$.artifact.storagePolicy.workspacePrivate',
      'Artifact contains workspace-private sources and must remain local by default.'
    ));
  }

  if (payload !== undefined) {
    if (!isKnowledgePackPayload(payload)) {
      issues.push(policyIssue(
        'unsupported-artifact-kind',
        '$.artifact.payload.kind',
        'Team artifact staging requires a knowledge-pack payload.'
      ));
    } else {
      for (const [index, source] of payload.sources.entries()) {
        if (source.freshness === 'unchecked') {
          issues.push(policyIssue(
            'unchecked-source',
            `$.artifact.payload.sources[${index}].freshness`,
            'Artifact contains unchecked sources and must be validated before team artifact staging.'
          ));
        }
        if (source.stale) {
          issues.push(policyIssue(
            'stale-source',
            `$.artifact.payload.sources[${index}].stale`,
            'Artifact contains stale sources and must be refreshed before team artifact staging.'
          ));
        }
        if (source.storagePolicy.scope === 'workspace-private') {
          issues.push(policyIssue(
            'workspace-private-source',
            `$.artifact.payload.sources[${index}].storagePolicy.scope`,
            'Artifact contains workspace-private sources and must remain local by default.'
          ));
        }
        if (!source.storagePolicy.shareableByDefault || source.storagePolicy.requiresExplicitOptIn) {
          issues.push(policyIssue(
            'explicit-opt-in-required',
            `$.artifact.payload.sources[${index}].storagePolicy.requiresExplicitOptIn`,
            'Artifact contains sources that require explicit opt-in before team artifact staging.'
          ));
        }
      }
    }
  }

  return {
    allowed: issues.length === 0,
    issues
  };
}

function hashBytes(bytes: Buffer): string {
  return createHash('sha256')
    .update(bytes)
    .digest('hex');
}

function assertSafeObjectKey(key: string): void {
  if (!isSafeKnowledgeTeamArtifactObjectKey(key)) {
    throw new KnowledgeTeamArtifactStoreError(
      'invalid-object-key',
      'Knowledge team artifact object key is not backend-safe.'
    );
  }
}

function assertContentType(contentType: string): asserts contentType is KnowledgeTeamArtifactContentType {
  if (contentType !== 'application/json') {
    throw new KnowledgeTeamArtifactStoreError(
      'invalid-content-type',
      'Knowledge team artifact store only accepts application/json artifacts.'
    );
  }
}

function assertSafeMetadata(metadata: Record<string, string>): void {
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEY_PATTERN.test(key) || FORBIDDEN_METADATA_KEY_PATTERN.test(key)) {
      throw new KnowledgeTeamArtifactStoreError(
        'publication-blocked',
        'Knowledge team artifact metadata key is not safe for backend-neutral descriptors.'
      );
    }
    if (SECRET_VALUE_PATTERN.test(value) || BACKEND_URL_PATTERN.test(value)) {
      throw new KnowledgeTeamArtifactStoreError(
        'publication-blocked',
        'Knowledge team artifact metadata value is not safe for backend-neutral descriptors.'
      );
    }
  }
}

function cloneMetadata(metadata: Record<string, string> | undefined): Record<string, string> {
  const clone = Object.fromEntries(Object.entries(metadata ?? {}));
  assertSafeMetadata(clone);
  return clone;
}

interface StoredMockObject {
  bytes: Buffer;
  contentType: KnowledgeTeamArtifactContentType;
  metadata: Record<string, string>;
  sha256: string;
}

function objectHead(
  backendKind: KnowledgeTeamArtifactBackendKind,
  key: string,
  object: StoredMockObject
): KnowledgeTeamArtifactStoredObject {
  return {
    backendKind,
    key,
    sha256: object.sha256,
    byteLength: object.bytes.byteLength,
    contentType: object.contentType,
    metadata: { ...object.metadata }
  };
}

export class MockS3CompatibleKnowledgeArtifactStore implements KnowledgeTeamArtifactStore {
  readonly backendKind: KnowledgeTeamArtifactBackendKind = 'mock-s3-compatible';

  readonly #objects = new Map<string, StoredMockObject>();

  async putObject(input: KnowledgeTeamArtifactPutInput): Promise<KnowledgeTeamArtifactPutResult> {
    assertSafeObjectKey(input.key);
    assertContentType(input.contentType);

    const bytes = Buffer.from(input.bytes);
    const metadata = cloneMetadata(input.metadata);
    const sha256 = hashBytes(bytes);
    const existing = this.#objects.get(input.key);
    if (existing !== undefined) {
      if (!existing.bytes.equals(bytes)) {
        throw new KnowledgeTeamArtifactStoreError(
          'object-conflict',
          'Knowledge team artifact object key already stores different content.'
        );
      }
      return {
        ...objectHead(this.backendKind, input.key, existing),
        alreadyPresent: true
      };
    }

    this.#objects.set(input.key, {
      bytes,
      contentType: input.contentType,
      metadata,
      sha256
    });

    return {
      backendKind: this.backendKind,
      key: input.key,
      sha256,
      byteLength: bytes.byteLength,
      contentType: input.contentType,
      metadata: { ...metadata },
      alreadyPresent: false
    };
  }

  async headObject(key: string): Promise<KnowledgeTeamArtifactStoredObject | null> {
    assertSafeObjectKey(key);
    const object = this.#objects.get(key);
    return object === undefined
      ? null
      : objectHead(this.backendKind, key, object);
  }

  async getObject(key: string): Promise<KnowledgeTeamArtifactStoredBytes | null> {
    assertSafeObjectKey(key);
    const object = this.#objects.get(key);
    return object === undefined
      ? null
      : {
          ...objectHead(this.backendKind, key, object),
          bytes: Buffer.from(object.bytes)
        };
  }
}

export function createMockS3CompatibleKnowledgeArtifactStore(): KnowledgeTeamArtifactStore {
  return new MockS3CompatibleKnowledgeArtifactStore();
}
