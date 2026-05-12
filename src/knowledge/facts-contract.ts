import { buildKnowledgeCacheId } from './cache.ts';
import { buildKnowledgeSourceFingerprint } from './local-source-fingerprint.ts';
import {
  KNOWLEDGE_FACT_EXTRACTION_METHODS,
  KNOWLEDGE_FACT_KINDS,
  type KnowledgeFactSet,
  type KnowledgeSourceFileFingerprint,
  type KnowledgeSourceFingerprint,
  type KnowledgeSource,
  type KnowledgeSourceKind
} from '../types/knowledge.ts';

const KNOWLEDGE_SOURCE_KINDS: KnowledgeSourceKind[] = [
  'terraform-registry',
  'pulumi-docs',
  'helm-docs',
  'chart-docs',
  'chart-metadata',
  'provider-schema',
  'chart-schema',
  'chart-lock',
  'repo-example',
  'pulumi-config',
  'pulumi-component',
  'terraform-module',
  'module-readme',
  'internal-knowledge',
  'knowledge-unit-artifact'
];
const RETRIEVED_CONTEXT_CONFIDENCES = ['low', 'medium', 'high'] as const;
const KNOWLEDGE_SOURCE_STALE_REASONS = [
  'time-expired',
  'local-file-hash-mismatch',
  'local-file-missing'
] as const;
const OPTIONAL_STRING_SOURCE_FIELDS = [
  'version',
  'url',
  'localPath',
  'provider',
  'module',
  'chart',
  'packageName'
] as const;
const FACT_OPTIONAL_STRING_FIELDS = ['type', 'defaultValue'] as const;
const FACT_OPTIONAL_STRING_ARRAY_FIELDS = ['relatedPaths'] as const;
const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNonEmptyString(value: unknown, fieldPath: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`knowledge fact input ${fieldPath} must be a non-empty string.`);
  }
}

function assertNoSecretLikeValue(value: string, fieldPath: string): void {
  if (SECRET_VALUE_PATTERN.test(value)) {
    throw new Error(`knowledge fact input ${fieldPath} must not include secret-like values.`);
  }
}

function assertIsoDateString(value: unknown, fieldPath: string): void {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error(`knowledge fact input ${fieldPath} must be an ISO date string.`);
  }
}

function assertOptionalString(value: unknown, fieldPath: string): void {
  if (value !== undefined && typeof value !== 'string') {
    throw new Error(`knowledge fact input ${fieldPath} must be a string when present.`);
  }
}

function assertKnowledgeSource(value: unknown, fieldPath: string): asserts value is KnowledgeSource {
  if (!isRecord(value)) {
    throw new Error(`knowledge fact input ${fieldPath} must be an object.`);
  }

  if (typeof value.kind !== 'string' || !KNOWLEDGE_SOURCE_KINDS.includes(value.kind as KnowledgeSourceKind)) {
    throw new Error(`knowledge fact input ${fieldPath}.kind must be supported.`);
  }

  assertNonEmptyString(value.name, `${fieldPath}.name`);

  for (const field of OPTIONAL_STRING_SOURCE_FIELDS) {
    assertOptionalString(value[field], `${fieldPath}.${field}`);
  }

  if (typeof value.url === 'string') {
    assertNoSecretLikeValue(value.url, `${fieldPath}.url`);
    try {
      const parsedUrl = new URL(value.url);
      if (parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
        throw new Error();
      }
    } catch {
      throw new Error(`knowledge fact input ${fieldPath}.url must be a secret-safe URL without credentials, query, or fragment.`);
    }
  }
}

function assertStringArray(value: unknown, fieldPath: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error(`knowledge fact input ${fieldPath} must be an array of non-empty strings.`);
  }

  for (let index = 0; index < value.length; index += 1) {
    assertNoSecretLikeValue(value[index] as string, `${fieldPath}[${index}]`);
  }
}

function assertKnowledgeSourceFingerprint(
  value: unknown,
  fieldPath: string
): asserts value is KnowledgeSourceFingerprint {
  if (!isRecord(value)) {
    throw new Error(`knowledge fact input ${fieldPath} must be an object.`);
  }

  if (value.algorithm !== 'sha256') {
    throw new Error(`knowledge fact input ${fieldPath}.algorithm must be sha256.`);
  }

  if (typeof value.digest !== 'string' || !SHA256_HEX_PATTERN.test(value.digest)) {
    throw new Error(`knowledge fact input ${fieldPath}.digest must be a SHA-256 hex string.`);
  }

  if (!Number.isInteger(value.fileCount) || (value.fileCount as number) < 0) {
    throw new Error(`knowledge fact input ${fieldPath}.fileCount must be a non-negative integer.`);
  }

  if (!Array.isArray(value.files)) {
    throw new Error(`knowledge fact input ${fieldPath}.files must be an array.`);
  }

  if (value.fileCount !== value.files.length) {
    throw new Error(`knowledge fact input ${fieldPath}.fileCount must match files length.`);
  }

  const files: KnowledgeSourceFileFingerprint[] = [];
  for (let index = 0; index < value.files.length; index += 1) {
    const file = value.files[index];
    const filePath = `${fieldPath}.files[${index}]`;
    if (!isRecord(file)) {
      throw new Error(`knowledge fact input ${filePath} must be an object.`);
    }

    assertNonEmptyString(file.path, `${filePath}.path`);
    assertNoSecretLikeValue(file.path as string, `${filePath}.path`);

    if (typeof file.contentHash !== 'string' || !SHA256_HEX_PATTERN.test(file.contentHash)) {
      throw new Error(`knowledge fact input ${filePath}.contentHash must be a SHA-256 hex string.`);
    }

    if (file.stale !== undefined && typeof file.stale !== 'boolean') {
      throw new Error(`knowledge fact input ${filePath}.stale must be a boolean when present.`);
    }

    files.push({
      path: file.path as string,
      contentHash: file.contentHash,
      ...(file.stale !== undefined ? { stale: file.stale } : {})
    });
  }

  const expected = buildKnowledgeSourceFingerprint(files);
  if (value.fileCount !== expected.fileCount || value.digest !== expected.digest) {
    throw new Error(`knowledge fact input ${fieldPath} digest must match files.`);
  }
}

export function parseKnowledgeFactSet(value: unknown): KnowledgeFactSet {
  if (!isRecord(value) || value.kind !== 'infra-agent.knowledge-facts') {
    throw new Error('knowledge fact input must be an infra-agent.knowledge-facts JSON payload.');
  }

  if (value.schemaVersion !== 1) {
    throw new Error('knowledge fact input schemaVersion must be 1.');
  }

  if (value.mutationAllowed !== false) {
    throw new Error('knowledge fact input mutationAllowed must be false.');
  }

  assertNonEmptyString(value.sourceId, 'sourceId');
  assertKnowledgeSource(value.source, 'source');
  if (value.sourceId !== buildKnowledgeCacheId(value.source)) {
    throw new Error('knowledge fact input sourceId must match source.');
  }
  assertNonEmptyString(value.sourceContentHash, 'sourceContentHash');
  if (!SHA256_HEX_PATTERN.test(value.sourceContentHash as string)) {
    throw new Error('knowledge fact input sourceContentHash must be a SHA-256 hex string.');
  }

  if (value.sourceFetchedAt !== null) {
    assertIsoDateString(value.sourceFetchedAt, 'sourceFetchedAt');
  }

  if (value.sourceStaleAfter !== undefined) {
    assertIsoDateString(value.sourceStaleAfter, 'sourceStaleAfter');
  }

  assertIsoDateString(value.extractedAt, 'extractedAt');

  if (typeof value.sourceStale !== 'boolean') {
    throw new Error('knowledge fact input sourceStale must be a boolean.');
  }

  if (value.sourceStaleReason !== undefined) {
    if (
      typeof value.sourceStaleReason !== 'string'
      || !KNOWLEDGE_SOURCE_STALE_REASONS.includes(
        value.sourceStaleReason as typeof KNOWLEDGE_SOURCE_STALE_REASONS[number]
      )
    ) {
      throw new Error('knowledge fact input sourceStaleReason must be supported.');
    }

    if (value.sourceStale !== true) {
      throw new Error('knowledge fact input sourceStaleReason requires sourceStale to be true.');
    }
  }

  if (value.sourceFingerprint !== undefined) {
    assertKnowledgeSourceFingerprint(value.sourceFingerprint, 'sourceFingerprint');
    if (
      value.sourceStale !== true
      && value.sourceFingerprint.files.some(file => file.stale === true)
    ) {
      throw new Error('knowledge fact input sourceFingerprint stale files require sourceStale to be true.');
    }
  }

  if (!Number.isInteger(value.factCount) || (value.factCount as number) < 0) {
    throw new Error('knowledge fact input factCount must be a non-negative integer.');
  }

  if (!Array.isArray(value.facts)) {
    throw new Error('knowledge fact input facts must be an array.');
  }

  if (value.factCount !== value.facts.length) {
    throw new Error('knowledge fact input factCount must match facts length.');
  }

  for (let index = 0; index < value.facts.length; index += 1) {
    const fact = value.facts[index];
    const factPath = `facts[${index}]`;

    if (!isRecord(fact)) {
      throw new Error(`knowledge fact input ${factPath} must be an object.`);
    }

    if (typeof fact.kind !== 'string' || !KNOWLEDGE_FACT_KINDS.includes(fact.kind as typeof KNOWLEDGE_FACT_KINDS[number])) {
      throw new Error(`knowledge fact input ${factPath}.kind must be supported.`);
    }

    assertNonEmptyString(fact.path, `${factPath}.path`);
    assertNoSecretLikeValue(fact.path, `${factPath}.path`);
    assertNonEmptyString(fact.summary, `${factPath}.summary`);
    assertNoSecretLikeValue(fact.summary, `${factPath}.summary`);

    if (
      typeof fact.confidence !== 'string'
      || !RETRIEVED_CONTEXT_CONFIDENCES.includes(fact.confidence as typeof RETRIEVED_CONTEXT_CONFIDENCES[number])
    ) {
      throw new Error(`knowledge fact input ${factPath}.confidence must be supported.`);
    }

    if (
      typeof fact.extractionMethod !== 'string'
      || !KNOWLEDGE_FACT_EXTRACTION_METHODS.includes(
        fact.extractionMethod as typeof KNOWLEDGE_FACT_EXTRACTION_METHODS[number]
      )
    ) {
      throw new Error(`knowledge fact input ${factPath}.extractionMethod must be supported.`);
    }

    if (fact.extractionMethod === 'helm-chart-docs-markdown' && fact.confidence !== 'medium') {
      throw new Error(`knowledge fact input ${factPath}.confidence must be medium for helm-chart-docs-markdown facts.`);
    }

    if (fact.values !== undefined) {
      assertStringArray(fact.values, `${factPath}.values`);
    }

    for (const field of FACT_OPTIONAL_STRING_ARRAY_FIELDS) {
      if (fact[field] !== undefined) {
        assertStringArray(fact[field], `${factPath}.${field}`);
      }
    }

    if (fact.required !== undefined && typeof fact.required !== 'boolean') {
      throw new Error(`knowledge fact input ${factPath}.required must be a boolean when present.`);
    }

    for (const field of FACT_OPTIONAL_STRING_FIELDS) {
      assertOptionalString(fact[field], `${factPath}.${field}`);
      if (typeof fact[field] === 'string') {
        assertNoSecretLikeValue(fact[field] as string, `${factPath}.${field}`);
      }
    }

    if (!isRecord(fact.source)) {
      throw new Error(`knowledge fact input ${factPath}.source must be an object.`);
    }

    if (fact.source.id !== value.sourceId) {
      throw new Error(`knowledge fact input ${factPath}.source.id must match sourceId.`);
    }

    if (fact.source.contentHash !== value.sourceContentHash) {
      throw new Error(`knowledge fact input ${factPath}.source.contentHash must match sourceContentHash.`);
    }

    if (value.sourceStale === true && fact.confidence === 'high') {
      throw new Error(`knowledge fact input ${factPath}.confidence must not be high when sourceStale is true.`);
    }

    assertKnowledgeSource(fact.source.source, `${factPath}.source.source`);
    assertNonEmptyString(fact.source.locator, `${factPath}.source.locator`);
  }

  return value as KnowledgeFactSet;
}
