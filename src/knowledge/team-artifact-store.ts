import { createHash } from 'node:crypto';
import type {
  KnowledgeArtifactManifest,
  KnowledgeArtifactPayload
} from './artifact-manifest.ts';
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

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_OBJECT_KEY_PATTERN = /^[a-z0-9][a-z0-9/_\-.]*$/;

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
