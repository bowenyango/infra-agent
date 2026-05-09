import { createHash } from 'node:crypto';
import type { KnowledgeArtifactPayload } from './artifact-manifest.ts';

export type KnowledgeTeamArtifactBackendKind = 'mock-s3-compatible';
export type KnowledgeTeamArtifactFamily =
  | 'knowledge-extraction'
  | 'knowledge-pack';

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_OBJECT_KEY_PATTERN = /^[a-z0-9][a-z0-9/_\-.]*$/;

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
