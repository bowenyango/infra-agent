import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildKnowledgeCacheId } from './cache.ts';
import { parseKnowledgeFactSet } from './facts-contract.ts';
import { checkKnowledgeSourceFingerprint } from './local-source-fingerprint.ts';
import type { KnowledgePackFact, KnowledgePackSource, KnowledgePackUnit } from './pack.ts';
import { validateKnowledgeStoragePolicySummary } from './storage-policy-validation.ts';
import {
  isKnowledgeStoragePolicyCompatibleWithSourceKind,
  type KnowledgeStorageDefault,
  type KnowledgeStoragePolicy,
  type KnowledgeStoragePolicySummary,
  type KnowledgeStorageScope
} from './storage-policy.ts';
import {
  KNOWLEDGE_FACT_EXTRACTION_METHODS,
  KNOWLEDGE_FACT_KINDS,
  KNOWLEDGE_UNIT_EXTRACTION_METHODS,
  KNOWLEDGE_UNIT_TYPES,
  type KnowledgeFactExtractionMethod,
  type KnowledgeFactKind,
  type KnowledgeFactSet,
  type KnowledgeContentType,
  type KnowledgeSource,
  type KnowledgeSourceKind,
  type KnowledgeSourceStaleReason,
  type KnowledgeUnitSet,
  type KnowledgeUnitExtractionMethod,
  type KnowledgeUnitPrivacyScope,
  type KnowledgeUnitType,
  type RetrievedContextConfidence
} from '../types/knowledge.ts';
import { validateKnowledgeArtifactReference } from './validation-artifact-reference.ts';
import {
  isSafeWorkspaceRelativePath,
  isSecretSafeKnowledgeUrl
} from './source-config.ts';
import {
  buildLocalSourceStaleDetail,
  buildLocalSourceUncheckedDetail,
  validateKnowledgeSourceFingerprintContract,
  validatePackSourceFingerprints,
  type LocalSourceValidationStats
} from './validation-source-fingerprints.ts';

export interface KnowledgeValidationIssue {
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

export interface KnowledgeValidationReport {
  kind: 'infra-agent.knowledge-validation';
  schemaVersion: 1;
  mutationAllowed: false;
  inputPath: string;
  inputKind: string | null;
  workspaceRoot?: string;
  valid: boolean;
  factSetCount: number;
  factCount: number;
  unitSetCount?: number;
  unitCount?: number;
  staleSourceCount: number;
  uncheckedLocalSourceCount: number;
  freshness: KnowledgeValidationFreshnessSummary;
  issueCount: number;
  issues: KnowledgeValidationIssue[];
}

export interface KnowledgeValidationOptions {
  workspaceRoot?: string;
}

export interface KnowledgeValidationFreshnessSource {
  sourceId: string;
  sourceKind: KnowledgeSourceKind | null;
  sourceName: string | null;
  factCount: number;
  validationPath?: string;
  staleReason?: KnowledgeSourceStaleReason;
  uncheckedReason?: 'workspace-not-provided' | 'missing-fingerprint';
  stalePaths?: string[];
  missingPaths?: string[];
  fingerprintDigest?: string;
  fingerprintFileCount?: number;
}

export interface KnowledgeValidationFreshnessSummary {
  kind: 'infra-agent.knowledge-freshness-summary';
  schemaVersion: 1;
  mutationAllowed: false;
  staleSourceCount: number;
  uncheckedLocalSourceCount: number;
  staleFactCount: number;
  uncheckedFactCount: number;
  staleSources: KnowledgeValidationFreshnessSource[];
  uncheckedLocalSources: KnowledgeValidationFreshnessSource[];
}

interface ValidatedKnowledgeFactSet {
  path: string;
  factSet: KnowledgeFactSet;
}

interface KnowledgeValidationCountOverrides {
  factSetCount?: number;
  factCount?: number;
  unitSetCount?: number;
  unitCount?: number;
  staleSourceCount?: number;
  uncheckedLocalSourceCount?: number;
}

const KNOWLEDGE_SOURCE_KINDS = [
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
  'knowledge-unit-registry',
  'knowledge-unit-artifact',
  'public-knowledge-library-registry',
  'public-knowledge-library-artifact'
] as const satisfies readonly KnowledgeSourceKind[];
const KNOWLEDGE_SOURCE_STALE_REASONS = [
  'time-expired',
  'local-file-hash-mismatch',
  'local-file-missing'
] as const satisfies readonly KnowledgeSourceStaleReason[];
const KNOWLEDGE_PACK_SOURCE_FRESHNESS = ['fresh', 'stale', 'unchecked'] as const;
const KNOWLEDGE_CONTENT_TYPES = ['text/markdown', 'text/plain', 'application/json', 'application/yaml'] as const satisfies readonly KnowledgeContentType[];
const KNOWLEDGE_STORAGE_SCOPES = ['public-reference', 'workspace-private'] as const satisfies readonly KnowledgeStorageScope[];
const KNOWLEDGE_STORAGE_DEFAULTS = ['local-or-explicit-team-cache', 'local-only'] as const satisfies readonly KnowledgeStorageDefault[];
const KNOWLEDGE_ARTIFACT_BLOCK_REASONS = [
  'explicit-opt-in-required',
  'stale-source',
  'workspace-private-source'
] as const;
const INFRA_DOMAINS = ['helm', 'pulumi', 'terraform'] as const;
const RETRIEVED_CONTEXT_CONFIDENCES = ['low', 'medium', 'high'] as const satisfies readonly RetrievedContextConfidence[];
const KNOWLEDGE_UNIT_PRIVACY_SCOPES = [
  'public-reference',
  'workspace-private',
  'internal-team',
  'private-run'
] as const satisfies readonly KnowledgeUnitPrivacyScope[];
const KNOWLEDGE_DIAGNOSTIC_ENGINES = ['terraform', 'pulumi', 'helm', 'provider', 'runtime'] as const;
const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const FULL_URL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/\S+/i;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const SHORT_HEX_PATTERN = /^[a-f0-9]{8,32}$/;
const PACK_ID_PATTERN = /^[a-f0-9]{24}$/;
const MANIFEST_ID_PATTERN = PACK_ID_PATTERN;
const PUBLIC_KNOWLEDGE_DOWNLOAD_MODES = ['live-fetch', 'local-content'] as const;
const PUBLIC_KNOWLEDGE_DOWNLOAD_STRATEGIES = ['local-content-fixture', 'terraform-registry-primary-then-provider-repo-raw'] as const;
const PUBLIC_KNOWLEDGE_DOWNLOAD_ATTEMPT_ROLES = ['primary', 'fallback'] as const;
const PUBLIC_KNOWLEDGE_DOWNLOAD_ATTEMPT_STATUSES = ['used', 'rejected', 'failed'] as const;
const PUBLIC_KNOWLEDGE_QUALITY_STATUSES = ['ready', 'needs-refinement'] as const;
const PUBLIC_KNOWLEDGE_VERSION_REF_KINDS = ['pinned-version', 'floating-alias'] as const;
const PUBLIC_LIBRARY_ARTIFACT_KINDS = ['terraform-provider-resource', 'terraform-provider-data-source'] as const;
const PUBLIC_LIBRARY_ARTIFACT_MEDIA_TYPE = 'application/vnd.infra-agent.public-knowledge-library-artifact+json';

interface PublicKnowledgeLlmReviewExpected {
  sourceId: string | null;
  sourceContentHash: string | null;
  classification: {
    ecosystem: string | null;
    artifactKind: string | null;
    sourceName: string | null;
    coordinates: string | null;
    version: string | null;
    versionRef: {
      value: string | null;
      kind: string | null;
      mutable: boolean | null;
    } | null;
  };
  download: unknown;
  quality: unknown;
  unitCount: number;
  unitCounts: Record<KnowledgeUnitType, number>;
  missingUnitTypes: KnowledgeUnitType[];
  compactByteLength: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function createReport(
  inputPath: string,
  inputKind: string | null,
  issues: KnowledgeValidationIssue[],
  factSets: KnowledgeFactSet[],
  options: KnowledgeValidationOptions = {},
  localSourceStats: LocalSourceValidationStats = {
    staleSourceIds: new Set(),
    uncheckedLocalSourceCount: 0,
    staleSourceDetails: [],
    uncheckedLocalSourceDetails: []
  },
  countOverrides: KnowledgeValidationCountOverrides = {}
): KnowledgeValidationReport {
  const factCount = countOverrides.factCount
    ?? factSets.reduce((total, factSet) => total + factSet.factCount, 0);
  const staleSourceIds = new Set([
    ...factSets.filter(factSet => factSet.sourceStale).map(factSet => factSet.sourceId),
    ...localSourceStats.staleSourceIds
  ]);
  const freshness = buildFreshnessSummary(factSets, localSourceStats, {
    staleSourceCount: countOverrides.staleSourceCount ?? staleSourceIds.size,
    uncheckedLocalSourceCount: localSourceStats.uncheckedLocalSourceCount
  });
  return {
    kind: 'infra-agent.knowledge-validation',
    schemaVersion: 1,
    mutationAllowed: false,
    inputPath,
    inputKind,
    ...(options.workspaceRoot !== undefined ? { workspaceRoot: options.workspaceRoot } : {}),
    valid: issues.every(issue => issue.severity !== 'error'),
    factSetCount: countOverrides.factSetCount ?? factSets.length,
    factCount,
    ...(countOverrides.unitSetCount !== undefined ? { unitSetCount: countOverrides.unitSetCount } : {}),
    ...(countOverrides.unitCount !== undefined ? { unitCount: countOverrides.unitCount } : {}),
    staleSourceCount: countOverrides.staleSourceCount ?? staleSourceIds.size,
    uncheckedLocalSourceCount: localSourceStats.uncheckedLocalSourceCount,
    freshness,
    issueCount: issues.length,
    issues
  };
}

function buildFreshnessSummary(
  factSets: KnowledgeFactSet[],
  localSourceStats: LocalSourceValidationStats,
  counts: Pick<KnowledgeValidationFreshnessSummary, 'staleSourceCount' | 'uncheckedLocalSourceCount'>
): KnowledgeValidationFreshnessSummary {
  const staleBySourceId = new Map<string, KnowledgeValidationFreshnessSource>();
  const factSetBySourceId = new Map(factSets.map(factSet => [factSet.sourceId, factSet]));

  for (const factSet of factSets) {
    if (!factSet.sourceStale) {
      continue;
    }

    staleBySourceId.set(factSet.sourceId, {
      sourceId: factSet.sourceId,
      sourceKind: factSet.source.kind,
      sourceName: factSet.source.name,
      factCount: factSet.factCount,
      staleReason: factSet.sourceStaleReason ?? 'time-expired',
      ...(factSet.sourceFingerprint !== undefined
        ? {
            fingerprintDigest: factSet.sourceFingerprint.digest,
            fingerprintFileCount: factSet.sourceFingerprint.fileCount
          }
        : {})
    });
  }

  for (const detail of localSourceStats.staleSourceDetails) {
    const factSet = factSetBySourceId.get(detail.sourceId);
    staleBySourceId.set(detail.sourceId, {
      sourceId: detail.sourceId,
      sourceKind: detail.sourceKind ?? factSet?.source.kind ?? null,
      sourceName: detail.sourceName ?? factSet?.source.name ?? null,
      factCount: detail.factCount ?? factSet?.factCount ?? 0,
      validationPath: detail.path,
      staleReason: detail.staleReason,
      stalePaths: [...detail.stalePaths],
      missingPaths: [...detail.missingPaths],
      ...(detail.fingerprintDigest !== undefined ? { fingerprintDigest: detail.fingerprintDigest } : {}),
      ...(detail.fingerprintFileCount !== undefined ? { fingerprintFileCount: detail.fingerprintFileCount } : {})
    });
  }

  const staleSources = Array.from(staleBySourceId.values())
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  const uncheckedLocalSources = localSourceStats.uncheckedLocalSourceDetails.map(detail => {
    const factSet = factSetBySourceId.get(detail.sourceId);
    return {
      sourceId: detail.sourceId,
      sourceKind: detail.sourceKind ?? factSet?.source.kind ?? null,
      sourceName: detail.sourceName ?? factSet?.source.name ?? null,
      factCount: detail.factCount ?? factSet?.factCount ?? 0,
      validationPath: detail.path,
      uncheckedReason: detail.uncheckedReason,
      ...(detail.fingerprintDigest !== undefined ? { fingerprintDigest: detail.fingerprintDigest } : {}),
      ...(detail.fingerprintFileCount !== undefined ? { fingerprintFileCount: detail.fingerprintFileCount } : {})
    };
  }).sort((left, right) => left.sourceId.localeCompare(right.sourceId));

  return {
    kind: 'infra-agent.knowledge-freshness-summary',
    schemaVersion: 1,
    mutationAllowed: false,
    staleSourceCount: counts.staleSourceCount,
    uncheckedLocalSourceCount: counts.uncheckedLocalSourceCount,
    staleFactCount: staleSources.reduce((total, source) => total + source.factCount, 0),
    uncheckedFactCount: uncheckedLocalSources.reduce((total, source) => total + source.factCount, 0),
    staleSources,
    uncheckedLocalSources
  };
}

function error(path: string, message: string): KnowledgeValidationIssue {
  return {
    severity: 'error',
    path,
    message
  };
}

function warning(path: string, message: string): KnowledgeValidationIssue {
  return {
    severity: 'warning',
    path,
    message
  };
}

function readNonEmptyString(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[],
  message = 'must be a non-empty string.'
): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    issues.push(error(path, message));
    return null;
  }

  return value;
}

function readString(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[],
  message = 'must be a string.'
): string | null {
  if (typeof value !== 'string') {
    issues.push(error(path, message));
    return null;
  }

  return value;
}

function readBoolean(value: unknown, path: string, issues: KnowledgeValidationIssue[]): boolean | null {
  if (typeof value !== 'boolean') {
    issues.push(error(path, 'must be a boolean.'));
    return null;
  }

  return value;
}

function readNonNegativeInteger(value: unknown, path: string, issues: KnowledgeValidationIssue[]): number | null {
  if (!Number.isInteger(value) || (value as number) < 0) {
    issues.push(error(path, 'must be a non-negative integer.'));
    return null;
  }

  return value as number;
}

function readPositiveInteger(value: unknown, path: string, issues: KnowledgeValidationIssue[]): number | null {
  if (!Number.isInteger(value) || (value as number) < 1) {
    issues.push(error(path, 'must be a positive integer.'));
    return null;
  }

  return value as number;
}

function validateIsoDateString(value: unknown, path: string, issues: KnowledgeValidationIssue[]): void {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    issues.push(error(path, 'must be an ISO date string.'));
  }
}

function readStringArray(value: unknown, path: string, issues: KnowledgeValidationIssue[]): string[] | null {
  if (!Array.isArray(value)) {
    issues.push(error(path, 'must be an array.'));
    return null;
  }

  const strings: string[] = [];
  value.forEach((entry, index) => {
    if (typeof entry !== 'string' || entry.length === 0) {
      issues.push(error(`${path}[${index}]`, 'must be a non-empty string.'));
      return;
    }

    strings.push(entry);
  });

  return strings;
}

function stringArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length
    && left.every((entry, index) => entry === right[index]);
}

function validateOptionalStringArray(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): void {
  if (value !== undefined) {
    readStringArray(value, path, issues)?.forEach((entry, index) => {
      validateNoSecretLikeValue(entry, `${path}[${index}]`, issues);
    });
  }
}

function validateNoSecretLikeValue(value: string, path: string, issues: KnowledgeValidationIssue[]): void {
  if (SECRET_VALUE_PATTERN.test(value)) {
    issues.push(error(path, 'must not include secret-like values.'));
  }
}

function validateOptionalString(value: unknown, path: string, issues: KnowledgeValidationIssue[]): void {
  if (value === undefined) {
    return;
  }

  const stringValue = readString(value, path, issues);
  if (stringValue !== null) {
    validateNoSecretLikeValue(stringValue, path, issues);
  }
}

function validateSecretSafeUrl(value: string, path: string, issues: KnowledgeValidationIssue[]): void {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) {
      issues.push(error(path, 'must be a secret-safe URL without credentials, query, or fragment.'));
    }
  } catch {
    issues.push(error(path, 'must be a valid URL.'));
  }
}

function validateKnowledgeUnitSource(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): KnowledgeSource | null {
  if (!isRecord(value)) {
    issues.push(error(path, 'Knowledge unit source must be an object.'));
    return null;
  }

  if (typeof value.kind !== 'string' || !KNOWLEDGE_SOURCE_KINDS.includes(value.kind as KnowledgeSourceKind)) {
    issues.push(error(`${path}.kind`, 'Knowledge unit source kind must be supported.'));
  }
  const name = readNonEmptyString(value.name, `${path}.name`, issues);
  if (name !== null) {
    validateNoSecretLikeValue(name, `${path}.name`, issues);
  }

  for (const field of ['version', 'url', 'localPath', 'provider', 'module', 'chart', 'packageName', 'artifactContentHash'] as const) {
    validateOptionalString(value[field], `${path}.${field}`, issues);
  }
  if (typeof value.artifactContentHash === 'string' && !SHA256_HEX_PATTERN.test(value.artifactContentHash)) {
    issues.push(error(`${path}.artifactContentHash`, 'Knowledge unit source artifactContentHash must be a SHA-256 hex string.'));
  }
  if (typeof value.url === 'string') {
    validateSecretSafeUrl(value.url, `${path}.url`, issues);
  }

  if (
    typeof value.kind !== 'string'
    || !KNOWLEDGE_SOURCE_KINDS.includes(value.kind as KnowledgeSourceKind)
    || name === null
  ) {
    return null;
  }

  return value as unknown as KnowledgeSource;
}

function validateKnowledgeUnitSourceRef(
  value: unknown,
  path: string,
  sourceId: string | null,
  sourceContentHash: string | null,
  issues: KnowledgeValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push(error(path, 'Knowledge unit source reference must be an object.'));
    return;
  }

  const refId = readNonEmptyString(value.id, `${path}.id`, issues);
  if (refId !== null && sourceId !== null && refId !== sourceId) {
    issues.push(error(`${path}.id`, 'Knowledge unit source reference id must match sourceId.'));
  }

  const contentHash = readNonEmptyString(value.contentHash, `${path}.contentHash`, issues);
  if (contentHash !== null) {
    if (!SHA256_HEX_PATTERN.test(contentHash)) {
      issues.push(error(`${path}.contentHash`, 'Knowledge unit source reference contentHash must be a SHA-256 hex string.'));
    }
    if (sourceContentHash !== null && contentHash !== sourceContentHash) {
      issues.push(error(`${path}.contentHash`, 'Knowledge unit source reference contentHash must match sourceContentHash.'));
    }
  }

  validateKnowledgeUnitSource(value.source, `${path}.source`, issues);
  const locator = readNonEmptyString(value.locator, `${path}.locator`, issues);
  if (locator !== null) {
    validateNoSecretLikeValue(locator, `${path}.locator`, issues);
  }
}

function validateKnowledgeUnitBase(
  unit: Record<string, unknown>,
  path: string,
  sourceId: string | null,
  sourceContentHash: string | null,
  issues: KnowledgeValidationIssue[]
): void {
  const unitPath = readNonEmptyString(unit.path, `${path}.path`, issues);
  if (unitPath !== null) {
    validateNoSecretLikeValue(unitPath, `${path}.path`, issues);
  }
  const summary = readNonEmptyString(unit.summary, `${path}.summary`, issues);
  if (summary !== null) {
    validateNoSecretLikeValue(summary, `${path}.summary`, issues);
  }

  if (
    typeof unit.confidence !== 'string'
    || !RETRIEVED_CONTEXT_CONFIDENCES.includes(unit.confidence as RetrievedContextConfidence)
  ) {
    issues.push(error(`${path}.confidence`, 'Knowledge unit confidence must be supported.'));
  }
  if (
    typeof unit.extractionMethod !== 'string'
    || !KNOWLEDGE_UNIT_EXTRACTION_METHODS.includes(unit.extractionMethod as KnowledgeUnitExtractionMethod)
  ) {
    issues.push(error(`${path}.extractionMethod`, 'Knowledge unit extractionMethod must be supported.'));
  }
  if (
    typeof unit.privacyScope !== 'string'
    || !KNOWLEDGE_UNIT_PRIVACY_SCOPES.includes(unit.privacyScope as KnowledgeUnitPrivacyScope)
  ) {
    issues.push(error(`${path}.privacyScope`, 'Knowledge unit privacyScope must be supported.'));
  }
  if (unit.tokenEstimate !== undefined) {
    readNonNegativeInteger(unit.tokenEstimate, `${path}.tokenEstimate`, issues);
  }
  validateOptionalStringArray(unit.relatedPaths, `${path}.relatedPaths`, issues);
  validateKnowledgeUnitSourceRef(unit.source, `${path}.source`, sourceId, sourceContentHash, issues);
}

function validateFactKnowledgeUnit(unit: Record<string, unknown>, path: string, issues: KnowledgeValidationIssue[]): void {
  if (typeof unit.factKind !== 'string' || !KNOWLEDGE_FACT_KINDS.includes(unit.factKind as KnowledgeFactKind)) {
    issues.push(error(`${path}.factKind`, 'Knowledge fact unit factKind must be supported.'));
  }
  validateOptionalStringArray(unit.values, `${path}.values`, issues);
  if (unit.required !== undefined) {
    readBoolean(unit.required, `${path}.required`, issues);
  }
  validateOptionalString(unit.type, `${path}.type`, issues);
  validateOptionalString(unit.defaultValue, `${path}.defaultValue`, issues);
}

function validateGuidanceKnowledgeUnit(unit: Record<string, unknown>, path: string, issues: KnowledgeValidationIssue[]): void {
  const topic = readNonEmptyString(unit.topic, `${path}.topic`, issues);
  if (topic !== null) {
    validateNoSecretLikeValue(topic, `${path}.topic`, issues);
  }
  validateOptionalStringArray(unit.appliesWhen, `${path}.appliesWhen`, issues);
  validateOptionalStringArray(unit.avoidWhen, `${path}.avoidWhen`, issues);
  validateOptionalString(unit.risk, `${path}.risk`, issues);
}

function validateExampleKnowledgeUnit(unit: Record<string, unknown>, path: string, issues: KnowledgeValidationIssue[]): void {
  const exampleType = readNonEmptyString(unit.exampleType, `${path}.exampleType`, issues);
  if (exampleType !== null) {
    validateNoSecretLikeValue(exampleType, `${path}.exampleType`, issues);
  }
  const snippet = readNonEmptyString(unit.snippet, `${path}.snippet`, issues);
  if (snippet !== null) {
    validateNoSecretLikeValue(snippet, `${path}.snippet`, issues);
  }
  validateOptionalString(unit.language, `${path}.language`, issues);
  validateOptionalStringArray(unit.appliesWhen, `${path}.appliesWhen`, issues);
  validateOptionalStringArray(unit.avoidWhen, `${path}.avoidWhen`, issues);
}

function validateDiagnosticKnowledgeUnit(unit: Record<string, unknown>, path: string, issues: KnowledgeValidationIssue[]): void {
  if (typeof unit.engine !== 'string' || !KNOWLEDGE_DIAGNOSTIC_ENGINES.includes(unit.engine as typeof KNOWLEDGE_DIAGNOSTIC_ENGINES[number])) {
    issues.push(error(`${path}.engine`, 'Knowledge diagnostic unit engine must be supported.'));
  }
  for (const field of ['signature', 'likelyCause'] as const) {
    const value = readNonEmptyString(unit[field], `${path}.${field}`, issues);
    if (value !== null) {
      validateNoSecretLikeValue(value, `${path}.${field}`, issues);
    }
  }
  const recommendedReview = readStringArray(unit.recommendedReview, `${path}.recommendedReview`, issues);
  recommendedReview?.forEach((entry, index) => validateNoSecretLikeValue(entry, `${path}.recommendedReview[${index}]`, issues));
}

function validateRecipeKnowledgeUnit(unit: Record<string, unknown>, path: string, issues: KnowledgeValidationIssue[]): void {
  const name = readNonEmptyString(unit.name, `${path}.name`, issues);
  if (name !== null) {
    validateNoSecretLikeValue(name, `${path}.name`, issues);
  }
  const steps = readStringArray(unit.steps, `${path}.steps`, issues);
  steps?.forEach((entry, index) => validateNoSecretLikeValue(entry, `${path}.steps[${index}]`, issues));
  if (unit.requiresApproval !== undefined) {
    readBoolean(unit.requiresApproval, `${path}.requiresApproval`, issues);
  }
  if (unit.mutationAllowed !== false) {
    issues.push(error(`${path}.mutationAllowed`, 'Knowledge recipe unit mutationAllowed must be false.'));
  }
}

function validateKnowledgeUnitIndexRetrievalKey(
  value: string,
  path: string,
  issues: KnowledgeValidationIssue[]
): void {
  validateNoSecretLikeValue(value, path, issues);
  if (FULL_URL_PATTERN.test(value)) {
    issues.push(error(path, 'Knowledge unit index retrievalKeys must not include URLs.'));
  }
}

function validateKnowledgeUnitIndexPathValue(
  value: string,
  path: string,
  issues: KnowledgeValidationIssue[]
): void {
  validateNoSecretLikeValue(value, path, issues);
  if (FULL_URL_PATTERN.test(value)) {
    issues.push(error(path, 'Knowledge unit index path metadata must not include URLs.'));
  }
}

function validateKnowledgeUnitIndexPrivacyScopes(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[],
  label: string
): KnowledgeUnitPrivacyScope[] {
  if (!Array.isArray(value)) {
    issues.push(error(path, `${label} privacyScopes must be an array.`));
    return [];
  }

  const scopes: KnowledgeUnitPrivacyScope[] = [];
  value.forEach((scope, index) => {
    if (typeof scope !== 'string' || !KNOWLEDGE_UNIT_PRIVACY_SCOPES.includes(scope as KnowledgeUnitPrivacyScope)) {
      issues.push(error(`${path}[${index}]`, `${label} privacyScope must be supported.`));
      return;
    }
    scopes.push(scope as KnowledgeUnitPrivacyScope);
  });

  return scopes;
}

function validateKnowledgeUnitIndexUnitCounts(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): number {
  let unitCountSum = 0;
  if (!isRecord(value)) {
    issues.push(error(path, 'Knowledge unit index unitCounts must be an object.'));
    return unitCountSum;
  }

  const unitCountKeys = new Set(Object.keys(value));
  for (const unitType of KNOWLEDGE_UNIT_TYPES) {
    unitCountKeys.delete(unitType);
    const unitCount = readNonNegativeInteger(value[unitType], `${path}.${unitType}`, issues);
    if (unitCount !== null) {
      unitCountSum += unitCount;
    }
  }
  for (const extraKey of unitCountKeys) {
    issues.push(error(`${path}.${extraKey}`, 'Knowledge unit index unitCounts must only include supported unit types.'));
  }

  return unitCountSum;
}

function validateKnowledgeUnitIndexFieldSummary(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): {
  fieldPath: string | null;
  unitCountSum: number;
} {
  if (!isRecord(value)) {
    issues.push(error(path, 'Knowledge unit index field summary must be an object.'));
    return {
      fieldPath: null,
      unitCountSum: 0
    };
  }

  const fieldPath = readNonEmptyString(value.fieldPath, `${path}.fieldPath`, issues);
  if (fieldPath !== null) {
    validateKnowledgeUnitIndexPathValue(fieldPath, `${path}.fieldPath`, issues);
  }
  validateKnowledgeUnitIndexPrivacyScopes(
    value.privacyScopes,
    `${path}.privacyScopes`,
    issues,
    'Knowledge unit index field summary'
  );
  const unitCountSum = validateKnowledgeUnitIndexUnitCounts(value.unitCounts, `${path}.unitCounts`, issues);
  const includedUnitCount = readNonNegativeInteger(value.includedUnitCount, `${path}.includedUnitCount`, issues);
  if (includedUnitCount !== null && includedUnitCount !== unitCountSum) {
    issues.push(error(`${path}.includedUnitCount`, 'Knowledge unit index field includedUnitCount must match the sum of unitCounts.'));
  }

  return {
    fieldPath,
    unitCountSum
  };
}

function validateKnowledgeUnitFieldIndexEntry(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): number {
  if (!isRecord(value)) {
    issues.push(error(path, 'Knowledge unit field index entry must be an object.'));
    return 0;
  }

  if (typeof value.domain !== 'string' || !INFRA_DOMAINS.includes(value.domain as InfraDomainId)) {
    issues.push(error(`${path}.domain`, 'Knowledge unit field index entry domain must be supported.'));
  }
  if (typeof value.sourceKind !== 'string' || !KNOWLEDGE_SOURCE_KINDS.includes(value.sourceKind as KnowledgeSourceKind)) {
    issues.push(error(`${path}.sourceKind`, 'Knowledge unit field index entry sourceKind must be supported.'));
  }
  if (typeof value.storageScope !== 'string' || !KNOWLEDGE_STORAGE_SCOPES.includes(value.storageScope as KnowledgeStorageScope)) {
    issues.push(error(`${path}.storageScope`, 'Knowledge unit field index entry storageScope must be supported.'));
  }
  if (typeof value.freshness !== 'string' || !KNOWLEDGE_PACK_SOURCE_FRESHNESS.includes(value.freshness as typeof KNOWLEDGE_PACK_SOURCE_FRESHNESS[number])) {
    issues.push(error(`${path}.freshness`, 'Knowledge unit field index entry freshness must be supported.'));
  }

  for (const field of ['targetPath', 'sourceId', 'sourceName', 'resourceKey', 'fieldPath'] as const) {
    const stringValue = readNonEmptyString(value[field], `${path}.${field}`, issues);
    if (stringValue !== null) {
      validateKnowledgeUnitIndexPathValue(stringValue, `${path}.${field}`, issues);
    }
  }

  for (const field of ['provider', 'packageName', 'chart', 'module', 'version'] as const) {
    validateOptionalString(value[field], `${path}.${field}`, issues);
  }

  validateKnowledgeUnitIndexPrivacyScopes(
    value.privacyScopes,
    `${path}.privacyScopes`,
    issues,
    'Knowledge unit field index entry'
  );

  const unitCountSum = validateKnowledgeUnitIndexUnitCounts(value.unitCounts, `${path}.unitCounts`, issues);
  const includedUnitCount = readNonNegativeInteger(value.includedUnitCount, `${path}.includedUnitCount`, issues);
  if (includedUnitCount !== null && includedUnitCount !== unitCountSum) {
    issues.push(error(`${path}.includedUnitCount`, 'Knowledge unit field index entry includedUnitCount must match the sum of unitCounts.'));
  }

  readStringArray(value.unitPaths, `${path}.unitPaths`, issues)
    ?.forEach((unitPath, index) => validateKnowledgeUnitIndexPathValue(unitPath, `${path}.unitPaths[${index}]`, issues));
  readStringArray(value.retrievalKeys, `${path}.retrievalKeys`, issues)
    ?.forEach((key, index) => validateKnowledgeUnitIndexRetrievalKey(key, `${path}.retrievalKeys[${index}]`, issues));

  return unitCountSum;
}

function validateKnowledgeUnitIndexEntry(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): number {
  if (!isRecord(value)) {
    issues.push(error(path, 'Knowledge unit index entry must be an object.'));
    return 0;
  }

  if (typeof value.domain !== 'string' || !INFRA_DOMAINS.includes(value.domain as typeof INFRA_DOMAINS[number])) {
    issues.push(error(`${path}.domain`, 'Knowledge unit index entry domain must be supported.'));
  }
  if (typeof value.sourceKind !== 'string' || !KNOWLEDGE_SOURCE_KINDS.includes(value.sourceKind as KnowledgeSourceKind)) {
    issues.push(error(`${path}.sourceKind`, 'Knowledge unit index entry sourceKind must be supported.'));
  }
  if (typeof value.storageScope !== 'string' || !KNOWLEDGE_STORAGE_SCOPES.includes(value.storageScope as KnowledgeStorageScope)) {
    issues.push(error(`${path}.storageScope`, 'Knowledge unit index entry storageScope must be supported.'));
  }
  if (typeof value.freshness !== 'string' || !KNOWLEDGE_PACK_SOURCE_FRESHNESS.includes(value.freshness as typeof KNOWLEDGE_PACK_SOURCE_FRESHNESS[number])) {
    issues.push(error(`${path}.freshness`, 'Knowledge unit index entry freshness must be supported.'));
  }

  for (const field of ['targetPath', 'sourceId', 'sourceName'] as const) {
    const stringValue = readNonEmptyString(value[field], `${path}.${field}`, issues);
    if (stringValue !== null) {
      validateNoSecretLikeValue(stringValue, `${path}.${field}`, issues);
    }
  }

  for (const field of ['provider', 'packageName', 'chart', 'module', 'version'] as const) {
    validateOptionalString(value[field], `${path}.${field}`, issues);
  }

  validateKnowledgeUnitIndexPrivacyScopes(
    value.privacyScopes,
    `${path}.privacyScopes`,
    issues,
    'Knowledge unit index entry'
  );

  const unitCountSum = validateKnowledgeUnitIndexUnitCounts(value.unitCounts, `${path}.unitCounts`, issues);

  const includedUnitCount = readNonNegativeInteger(value.includedUnitCount, `${path}.includedUnitCount`, issues);
  if (includedUnitCount !== null && includedUnitCount !== unitCountSum) {
    issues.push(error(`${path}.includedUnitCount`, 'Knowledge unit index entry includedUnitCount must match the sum of unitCounts.'));
  }
  if (value.omittedUnitCount !== undefined) {
    readNonNegativeInteger(value.omittedUnitCount, `${path}.omittedUnitCount`, issues);
  }
  readNonNegativeInteger(value.sourceUnitCountEstimate, `${path}.sourceUnitCountEstimate`, issues);

  const fieldPaths = readStringArray(value.fieldPaths, `${path}.fieldPaths`, issues);
  fieldPaths?.forEach((fieldPath, index) => validateKnowledgeUnitIndexPathValue(fieldPath, `${path}.fieldPaths[${index}]`, issues));

  const fieldSummaryPaths: string[] = [];
  if (!Array.isArray(value.fields)) {
    issues.push(error(`${path}.fields`, 'Knowledge unit index entry fields must be an array.'));
  } else {
    value.fields.forEach((field, index) => {
      const fieldSummary = validateKnowledgeUnitIndexFieldSummary(field, `${path}.fields[${index}]`, issues);
      if (fieldSummary.fieldPath !== null) {
        fieldSummaryPaths.push(fieldSummary.fieldPath);
      }
    });
  }
  if (fieldPaths !== null) {
    const listedFieldPaths = new Set(fieldPaths);
    const summarizedFieldPaths = new Set(fieldSummaryPaths);
    for (const fieldPath of listedFieldPaths) {
      if (!summarizedFieldPaths.has(fieldPath)) {
        issues.push(error(`${path}.fieldPaths`, 'Knowledge unit index entry fieldPaths must match fields[].fieldPath.'));
      }
    }
    for (const fieldPath of summarizedFieldPaths) {
      if (!listedFieldPaths.has(fieldPath)) {
        issues.push(error(`${path}.fields`, 'Knowledge unit index entry fields must match fieldPaths.'));
      }
    }
  }

  const retrievalKeys = readStringArray(value.retrievalKeys, `${path}.retrievalKeys`, issues);
  retrievalKeys?.forEach((key, index) => validateKnowledgeUnitIndexRetrievalKey(key, `${path}.retrievalKeys[${index}]`, issues));

  if (value.sourceContentHash !== undefined) {
    const sourceContentHash = readNonEmptyString(value.sourceContentHash, `${path}.sourceContentHash`, issues);
    if (sourceContentHash !== null) {
      if (SHA256_HEX_PATTERN.test(sourceContentHash)) {
        issues.push(error(`${path}.sourceContentHash`, 'Knowledge unit index entry sourceContentHash must be a short hex digest, not a full SHA-256 hash.'));
      } else if (!SHORT_HEX_PATTERN.test(sourceContentHash)) {
        issues.push(error(`${path}.sourceContentHash`, 'Knowledge unit index entry sourceContentHash must be a short lowercase hex digest.'));
      }
    }
  }

  return unitCountSum;
}

function validateKnowledgeUnitIndexPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];

  if (payload.schemaVersion !== 1) {
    issues.push(error('$.schemaVersion', 'Knowledge unit index schemaVersion must be 1.'));
  }
  if (payload.mutationAllowed !== false) {
    issues.push(error('$.mutationAllowed', 'Knowledge unit index mutationAllowed must be false.'));
  }
  readString(payload.packId, '$.packId', issues);

  const sourceCount = readNonNegativeInteger(payload.sourceCount, '$.sourceCount', issues);
  const includedUnitCount = readNonNegativeInteger(payload.includedUnitCount, '$.includedUnitCount', issues);
  readNonNegativeInteger(payload.omittedUnitCount, '$.omittedUnitCount', issues);
  const fieldEntryCount = readNonNegativeInteger(payload.fieldEntryCount, '$.fieldEntryCount', issues);
  const fieldIncludedUnitCount = readNonNegativeInteger(payload.fieldIncludedUnitCount, '$.fieldIncludedUnitCount', issues);

  let actualIncludedUnitCount = 0;
  const sourceFieldPathsBySourceId = new Map<string, Set<string>>();
  const sourceEntryPathBySourceId = new Map<string, string>();
  if (!Array.isArray(payload.entries)) {
    issues.push(error('$.entries', 'Knowledge unit index entries must be an array.'));
  } else {
    if (sourceCount !== null && sourceCount !== payload.entries.length) {
      issues.push(error('$.sourceCount', 'Knowledge unit index sourceCount must match entries.length.'));
    }
    payload.entries.forEach((entry, index) => {
      actualIncludedUnitCount += validateKnowledgeUnitIndexEntry(entry, `$.entries[${index}]`, issues);
      if (isRecord(entry) && typeof entry.sourceId === 'string') {
        sourceEntryPathBySourceId.set(entry.sourceId, `$.entries[${index}]`);
        const fieldPaths = new Set<string>();
        if (Array.isArray(entry.fields)) {
          for (const field of entry.fields) {
            if (isRecord(field) && typeof field.fieldPath === 'string' && field.fieldPath.length > 0) {
              fieldPaths.add(field.fieldPath);
            }
          }
        }
        sourceFieldPathsBySourceId.set(entry.sourceId, fieldPaths);
      }
    });
  }

  let actualFieldIncludedUnitCount = 0;
  const fieldPathsBySourceId = new Map<string, Set<string>>();
  if (!Array.isArray(payload.fieldEntries)) {
    issues.push(error('$.fieldEntries', 'Knowledge unit index fieldEntries must be an array.'));
  } else {
    if (fieldEntryCount !== null && fieldEntryCount !== payload.fieldEntries.length) {
      issues.push(error('$.fieldEntryCount', 'Knowledge unit index fieldEntryCount must match fieldEntries.length.'));
    }
    payload.fieldEntries.forEach((entry, index) => {
      actualFieldIncludedUnitCount += validateKnowledgeUnitFieldIndexEntry(entry, `$.fieldEntries[${index}]`, issues);
      if (
        isRecord(entry)
        && typeof entry.sourceId === 'string'
        && typeof entry.resourceKey === 'string'
        && typeof entry.fieldPath === 'string'
      ) {
        const fullFieldPath = entry.fieldPath.startsWith(`${entry.resourceKey}.`)
          ? entry.fieldPath
          : `${entry.resourceKey}.${entry.fieldPath}`;
        const fieldPaths = fieldPathsBySourceId.get(entry.sourceId) ?? new Set<string>();
        fieldPaths.add(fullFieldPath);
        fieldPathsBySourceId.set(entry.sourceId, fieldPaths);
      }
    });
  }

  if (includedUnitCount !== null && includedUnitCount !== actualIncludedUnitCount) {
    issues.push(error('$.includedUnitCount', 'Knowledge unit index includedUnitCount must match the sum of entry includedUnitCount values.'));
  }
  if (fieldIncludedUnitCount !== null && fieldIncludedUnitCount !== actualFieldIncludedUnitCount) {
    issues.push(error('$.fieldIncludedUnitCount', 'Knowledge unit index fieldIncludedUnitCount must match the sum of field entry includedUnitCount values.'));
  }
  for (const [sourceId, sourceFieldPaths] of sourceFieldPathsBySourceId) {
    const fieldEntryPaths = fieldPathsBySourceId.get(sourceId) ?? new Set<string>();
    for (const fieldPath of sourceFieldPaths) {
      if (!fieldEntryPaths.has(fieldPath)) {
        issues.push(error(
          `${sourceEntryPathBySourceId.get(sourceId) ?? '$.entries'}.fields`,
          'Knowledge unit index source fields must correspond to top-level fieldEntries.'
        ));
        break;
      }
    }
  }
  for (const [sourceId, fieldEntryPaths] of fieldPathsBySourceId) {
    const sourceFieldPaths = sourceFieldPathsBySourceId.get(sourceId) ?? new Set<string>();
    for (const fieldPath of fieldEntryPaths) {
      if (!sourceFieldPaths.has(fieldPath)) {
        issues.push(error(
          '$.fieldEntries',
          'Knowledge unit index fieldEntries must correspond to source entry fields.'
        ));
        break;
      }
    }
  }

  return createReport(
    inputPath,
    inputKind,
    issues,
    [],
    {},
    {
      staleSourceIds: new Set(),
      uncheckedLocalSourceCount: 0,
      staleSourceDetails: [],
      uncheckedLocalSourceDetails: []
    },
    {
      factSetCount: 0,
      factCount: 0,
      unitSetCount: 0,
      unitCount: includedUnitCount ?? actualIncludedUnitCount
    }
  );
}

function validateKnowledgeUnit(
  value: unknown,
  path: string,
  sourceId: string | null,
  sourceContentHash: string | null,
  issues: KnowledgeValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push(error(path, 'Knowledge unit must be an object.'));
    return;
  }

  if (typeof value.unitType !== 'string' || !KNOWLEDGE_UNIT_TYPES.includes(value.unitType as KnowledgeUnitType)) {
    issues.push(error(`${path}.unitType`, 'Knowledge unit unitType must be supported.'));
    validateKnowledgeUnitBase(value, path, sourceId, sourceContentHash, issues);
    return;
  }

  validateKnowledgeUnitBase(value, path, sourceId, sourceContentHash, issues);
  switch (value.unitType) {
    case 'fact':
      validateFactKnowledgeUnit(value, path, issues);
      break;
    case 'guidance':
      validateGuidanceKnowledgeUnit(value, path, issues);
      break;
    case 'example':
      validateExampleKnowledgeUnit(value, path, issues);
      break;
    case 'diagnostic':
      validateDiagnosticKnowledgeUnit(value, path, issues);
      break;
    case 'recipe':
      validateRecipeKnowledgeUnit(value, path, issues);
      break;
  }
}

function validateKnowledgeUnitSetPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  const factSets: KnowledgeFactSet[] = [];

  if (payload.schemaVersion !== 1) {
    issues.push(error('$.schemaVersion', 'Knowledge units schemaVersion must be 1.'));
  }
  if (payload.mutationAllowed !== false) {
    issues.push(error('$.mutationAllowed', 'Knowledge units mutationAllowed must be false.'));
  }

  const sourceId = readNonEmptyString(payload.sourceId, '$.sourceId', issues);
  const source = validateKnowledgeUnitSource(payload.source, '$.source', issues);
  if (sourceId !== null && source !== null && sourceId !== buildKnowledgeCacheId(source)) {
    issues.push(error('$.sourceId', 'Knowledge units sourceId must match source.'));
  }

  const sourceContentHash = readNonEmptyString(payload.sourceContentHash, '$.sourceContentHash', issues);
  if (sourceContentHash !== null && !SHA256_HEX_PATTERN.test(sourceContentHash)) {
    issues.push(error('$.sourceContentHash', 'Knowledge units sourceContentHash must be a SHA-256 hex string.'));
  }
  validateIsoDateString(payload.extractedAt, '$.extractedAt', issues);

  const unitCount = readNonNegativeInteger(payload.unitCount, '$.unitCount', issues);
  if (!Array.isArray(payload.units)) {
    issues.push(error('$.units', 'Knowledge units units must be an array.'));
  } else {
    if (unitCount !== null && unitCount !== payload.units.length) {
      issues.push(error('$.unitCount', 'Knowledge units unitCount must match units.length.'));
    }
    payload.units.forEach((unit, index) => {
      validateKnowledgeUnit(unit, `$.units[${index}]`, sourceId, sourceContentHash, issues);
    });
  }

  return createReport(
    inputPath,
    inputKind,
    issues,
    factSets,
    {},
    {
      staleSourceIds: new Set(),
      uncheckedLocalSourceCount: 0,
      staleSourceDetails: [],
      uncheckedLocalSourceDetails: []
    },
    {
      unitSetCount: 1,
      unitCount: unitCount ?? (Array.isArray(payload.units) ? payload.units.length : 0)
    }
  );
}

function prefixValidationIssues(
  issues: KnowledgeValidationIssue[],
  prefix: string
): KnowledgeValidationIssue[] {
  return issues.map(issue => ({
    ...issue,
    path: issue.path === '$' ? prefix : `${prefix}${issue.path.slice(1)}`
  }));
}

function validateFactSet(value: unknown, path: string, issues: KnowledgeValidationIssue[]): KnowledgeFactSet | null {
  try {
    return parseKnowledgeFactSet(value);
  } catch (validationError) {
    issues.push(error(path, validationError instanceof Error
      ? validationError.message
      : 'Knowledge fact set is invalid.'));
    return null;
  }
}

function validateKnowledgeStoragePolicy(
  value: unknown,
  path: string,
  sourceKind: KnowledgeSourceKind | null,
  issues: KnowledgeValidationIssue[]
): KnowledgeStoragePolicy | null {
  if (!isRecord(value)) {
    issues.push(error(path, 'Knowledge storage policy must be an object.'));
    return null;
  }

  if (typeof value.scope !== 'string' || !KNOWLEDGE_STORAGE_SCOPES.includes(value.scope as KnowledgeStorageScope)) {
    issues.push(error(`${path}.scope`, 'Knowledge storage policy scope must be supported.'));
  }
  if (typeof value.defaultStore !== 'string' || !KNOWLEDGE_STORAGE_DEFAULTS.includes(value.defaultStore as KnowledgeStorageDefault)) {
    issues.push(error(`${path}.defaultStore`, 'Knowledge storage policy defaultStore must be supported.'));
  }
  const shareableByDefault = readBoolean(value.shareableByDefault, `${path}.shareableByDefault`, issues);
  const requiresExplicitOptIn = readBoolean(value.requiresExplicitOptIn, `${path}.requiresExplicitOptIn`, issues);
  readNonEmptyString(value.reason, `${path}.reason`, issues);

  if (
    typeof value.scope !== 'string'
    || !KNOWLEDGE_STORAGE_SCOPES.includes(value.scope as KnowledgeStorageScope)
    || typeof value.defaultStore !== 'string'
    || !KNOWLEDGE_STORAGE_DEFAULTS.includes(value.defaultStore as KnowledgeStorageDefault)
    || shareableByDefault === null
    || requiresExplicitOptIn === null
    || typeof value.reason !== 'string'
  ) {
    return null;
  }

  const policy = {
    scope: value.scope as KnowledgeStorageScope,
    defaultStore: value.defaultStore as KnowledgeStorageDefault,
    shareableByDefault,
    requiresExplicitOptIn,
    reason: value.reason
  };

  if (!isKnowledgeStoragePolicyCompatibleWithSourceKind(sourceKind ?? 'repo-example', policy)) {
    issues.push(error(path, 'Knowledge storage policy is not compatible with the source kind.'));
  }

  return policy;
}

function validateKnowledgePackSource(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): Pick<KnowledgePackSource, 'id' | 'kind' | 'name' | 'factCount' | 'stale' | 'staleReason' | 'storagePolicy' | 'fingerprint'> | null {
  if (!isRecord(value)) {
    issues.push(error(path, 'Knowledge pack source must be an object.'));
    return null;
  }

  const id = readNonEmptyString(value.id, `${path}.id`, issues);
  if (typeof value.domain !== 'string' || !INFRA_DOMAINS.includes(value.domain as typeof INFRA_DOMAINS[number])) {
    issues.push(error(`${path}.domain`, 'Knowledge pack source domain must be supported.'));
  }
  readString(value.targetPath, `${path}.targetPath`, issues);
  const sourceKind = typeof value.kind === 'string' && KNOWLEDGE_SOURCE_KINDS.includes(value.kind as KnowledgeSourceKind)
    ? value.kind as KnowledgeSourceKind
    : null;
  if (sourceKind === null) {
    issues.push(error(`${path}.kind`, 'Knowledge pack source kind must be supported.'));
  }
  const name = readNonEmptyString(value.name, `${path}.name`, issues);
  const factCount = readNonNegativeInteger(value.factCount, `${path}.factCount`, issues);
  const staleReason = typeof value.staleReason === 'string'
    && KNOWLEDGE_SOURCE_STALE_REASONS.includes(value.staleReason as KnowledgeSourceStaleReason)
      ? value.staleReason as KnowledgeSourceStaleReason
      : undefined;

  if (typeof value.contentHash !== 'string' || !SHA256_HEX_PATTERN.test(value.contentHash)) {
    issues.push(error(`${path}.contentHash`, 'Knowledge pack source contentHash must be a SHA-256 hex string.'));
  }

  if (value.fetchedAt !== null) {
    validateIsoDateString(value.fetchedAt, `${path}.fetchedAt`, issues);
  }
  if (value.staleAfter !== undefined) {
    validateIsoDateString(value.staleAfter, `${path}.staleAfter`, issues);
  }

  const stale = readBoolean(value.stale, `${path}.stale`, issues);
  if (value.staleReason !== undefined) {
    if (
      typeof value.staleReason !== 'string'
      || !KNOWLEDGE_SOURCE_STALE_REASONS.includes(value.staleReason as KnowledgeSourceStaleReason)
    ) {
      issues.push(error(`${path}.staleReason`, 'Knowledge pack source staleReason must be supported.'));
    }
    if (stale !== true) {
      issues.push(error(`${path}.staleReason`, 'Knowledge pack source staleReason requires stale=true.'));
    }
  }

  if (
    typeof value.freshness !== 'string'
    || !KNOWLEDGE_PACK_SOURCE_FRESHNESS.includes(value.freshness as typeof KNOWLEDGE_PACK_SOURCE_FRESHNESS[number])
  ) {
    issues.push(error(`${path}.freshness`, 'Knowledge pack source freshness must be supported.'));
  } else if (stale === true && value.freshness !== 'stale') {
    issues.push(error(`${path}.freshness`, 'Knowledge pack stale sources must use freshness=stale.'));
  } else if (stale === false && value.freshness === 'stale') {
    issues.push(error(`${path}.freshness`, 'Knowledge pack fresh sources must not use freshness=stale.'));
  }

  const storagePolicy = validateKnowledgeStoragePolicy(value.storagePolicy, `${path}.storagePolicy`, sourceKind, issues);

  const hasFingerprintDigest = value.fingerprintDigest !== undefined;
  const hasFingerprintFileCount = value.fingerprintFileCount !== undefined;
  if (hasFingerprintDigest !== hasFingerprintFileCount) {
    issues.push(error(`${path}.fingerprintDigest`, 'Knowledge pack source fingerprint digest and file count must be present together.'));
  }
  if (hasFingerprintDigest && (typeof value.fingerprintDigest !== 'string' || !SHA256_HEX_PATTERN.test(value.fingerprintDigest))) {
    issues.push(error(`${path}.fingerprintDigest`, 'Knowledge pack source fingerprintDigest must be a SHA-256 hex string.'));
  }
  const fingerprintFileCount = hasFingerprintFileCount
    ? readNonNegativeInteger(value.fingerprintFileCount, `${path}.fingerprintFileCount`, issues)
    : null;
  const fingerprint = value.fingerprint !== undefined
    ? validateKnowledgeSourceFingerprintContract(value.fingerprint, `${path}.fingerprint`, issues)
    : null;

  if (fingerprint !== null) {
    if (hasFingerprintDigest && value.fingerprintDigest !== fingerprint.digest) {
      issues.push(error(`${path}.fingerprintDigest`, 'Knowledge pack source fingerprintDigest must match fingerprint.digest.'));
    }
    if (fingerprintFileCount !== null && fingerprintFileCount !== fingerprint.fileCount) {
      issues.push(error(`${path}.fingerprintFileCount`, 'Knowledge pack source fingerprintFileCount must match fingerprint.fileCount.'));
    }
  }
  if (
    storagePolicy?.scope === 'workspace-private'
    && value.freshness !== 'unchecked'
    && !hasFingerprintDigest
    && fingerprint === null
  ) {
    issues.push(error(`${path}.fingerprint`, 'Fresh workspace-private knowledge pack sources must include a recheckable fingerprint.'));
  }

  if (id === null || sourceKind === null || name === null || factCount === null || stale === null || storagePolicy === null) {
    return null;
  }

  return {
    id,
    kind: sourceKind,
    name,
    factCount,
    stale,
    ...(staleReason !== undefined ? { staleReason } : {}),
    storagePolicy,
    ...(fingerprint !== null ? { fingerprint } : {})
  };
}

function validateKnowledgePackFact(
  value: unknown,
  path: string,
  sourceIds: Set<string>,
  issues: KnowledgeValidationIssue[]
): Pick<KnowledgePackFact, 'sourceId'> | null {
  if (!isRecord(value)) {
    issues.push(error(path, 'Knowledge pack fact must be an object.'));
    return null;
  }

  if (value.unitType !== undefined && value.unitType !== 'fact') {
    issues.push(error(`${path}.unitType`, 'Knowledge pack fact unitType must be fact when present.'));
  }

  if (typeof value.kind !== 'string' || !KNOWLEDGE_FACT_KINDS.includes(value.kind as KnowledgeFactKind)) {
    issues.push(error(`${path}.kind`, 'Knowledge pack fact kind must be supported.'));
  }
  const factPath = readNonEmptyString(value.path, `${path}.path`, issues);
  if (factPath !== null) {
    validateNoSecretLikeValue(factPath, `${path}.path`, issues);
  }
  const summary = readNonEmptyString(value.summary, `${path}.summary`, issues);
  if (summary !== null) {
    validateNoSecretLikeValue(summary, `${path}.summary`, issues);
  }
  if (
    typeof value.confidence !== 'string'
    || !RETRIEVED_CONTEXT_CONFIDENCES.includes(value.confidence as RetrievedContextConfidence)
  ) {
    issues.push(error(`${path}.confidence`, 'Knowledge pack fact confidence must be supported.'));
  }
  if (
    typeof value.extractionMethod !== 'string'
    || !KNOWLEDGE_FACT_EXTRACTION_METHODS.includes(value.extractionMethod as KnowledgeFactExtractionMethod)
  ) {
    issues.push(error(`${path}.extractionMethod`, 'Knowledge pack fact extractionMethod must be supported.'));
  }
  if (value.extractionMethod === 'helm-chart-docs-markdown' && value.confidence !== 'medium') {
    issues.push(error(`${path}.confidence`, 'Helm chart docs markdown facts must remain medium-confidence advisory facts.'));
  }

  const sourceId = readNonEmptyString(value.sourceId, `${path}.sourceId`, issues);
  if (sourceId !== null && !sourceIds.has(sourceId)) {
    issues.push(error(`${path}.sourceId`, 'Knowledge pack fact sourceId must reference a source in sources.'));
  }
  const sourceLocator = readNonEmptyString(value.sourceLocator, `${path}.sourceLocator`, issues);
  if (sourceLocator !== null) {
    validateNoSecretLikeValue(sourceLocator, `${path}.sourceLocator`, issues);
  }

  if (value.required !== undefined && typeof value.required !== 'boolean') {
    issues.push(error(`${path}.required`, 'Knowledge pack fact required must be a boolean when present.'));
  }
  if (value.type !== undefined) {
    const type = readString(value.type, `${path}.type`, issues);
    if (type !== null) {
      validateNoSecretLikeValue(type, `${path}.type`, issues);
    }
  }
  if (value.defaultValue !== undefined) {
    const defaultValue = readString(value.defaultValue, `${path}.defaultValue`, issues);
    if (defaultValue !== null) {
      validateNoSecretLikeValue(defaultValue, `${path}.defaultValue`, issues);
    }
  }
  validateOptionalStringArray(value.values, `${path}.values`, issues);
  validateOptionalStringArray(value.relatedPaths, `${path}.relatedPaths`, issues);

  return sourceId === null ? null : { sourceId };
}

function validateKnowledgePackUnit(
  value: unknown,
  path: string,
  sourceIds: Set<string>,
  issues: KnowledgeValidationIssue[]
): Pick<KnowledgePackUnit, 'sourceId' | 'unitType'> | null {
  if (!isRecord(value)) {
    issues.push(error(path, 'Knowledge pack unit must be an object.'));
    return null;
  }

  if (typeof value.unitType !== 'string' || !KNOWLEDGE_UNIT_TYPES.includes(value.unitType as KnowledgeUnitType)) {
    issues.push(error(`${path}.unitType`, 'Knowledge pack unit unitType must be supported.'));
  }

  const unitPath = readNonEmptyString(value.path, `${path}.path`, issues);
  if (unitPath !== null) {
    validateNoSecretLikeValue(unitPath, `${path}.path`, issues);
  }
  const summary = readNonEmptyString(value.summary, `${path}.summary`, issues);
  if (summary !== null) {
    validateNoSecretLikeValue(summary, `${path}.summary`, issues);
  }
  if (
    typeof value.confidence !== 'string'
    || !RETRIEVED_CONTEXT_CONFIDENCES.includes(value.confidence as RetrievedContextConfidence)
  ) {
    issues.push(error(`${path}.confidence`, 'Knowledge pack unit confidence must be supported.'));
  }
  if (
    typeof value.extractionMethod !== 'string'
    || !KNOWLEDGE_UNIT_EXTRACTION_METHODS.includes(value.extractionMethod as KnowledgeUnitExtractionMethod)
  ) {
    issues.push(error(`${path}.extractionMethod`, 'Knowledge pack unit extractionMethod must be supported.'));
  }
  if (
    typeof value.privacyScope !== 'string'
    || !KNOWLEDGE_UNIT_PRIVACY_SCOPES.includes(value.privacyScope as KnowledgeUnitPrivacyScope)
  ) {
    issues.push(error(`${path}.privacyScope`, 'Knowledge pack unit privacyScope must be supported.'));
  }
  if (value.tokenEstimate !== undefined) {
    readNonNegativeInteger(value.tokenEstimate, `${path}.tokenEstimate`, issues);
  }
  validateOptionalStringArray(value.relatedPaths, `${path}.relatedPaths`, issues);

  const sourceId = readNonEmptyString(value.sourceId, `${path}.sourceId`, issues);
  if (sourceId !== null && !sourceIds.has(sourceId)) {
    issues.push(error(`${path}.sourceId`, 'Knowledge pack unit sourceId must reference a source in sources.'));
  }
  const sourceLocator = readNonEmptyString(value.sourceLocator, `${path}.sourceLocator`, issues);
  if (sourceLocator !== null) {
    validateNoSecretLikeValue(sourceLocator, `${path}.sourceLocator`, issues);
  }

  switch (value.unitType) {
    case 'fact':
      if (typeof value.factKind !== 'string' || !KNOWLEDGE_FACT_KINDS.includes(value.factKind as KnowledgeFactKind)) {
        issues.push(error(`${path}.factKind`, 'Knowledge pack fact unit factKind must be supported.'));
      }
      validateOptionalStringArray(value.values, `${path}.values`, issues);
      if (value.required !== undefined) {
        readBoolean(value.required, `${path}.required`, issues);
      }
      validateOptionalString(value.type, `${path}.type`, issues);
      validateOptionalString(value.defaultValue, `${path}.defaultValue`, issues);
      break;
    case 'guidance':
      validateGuidanceKnowledgeUnit(value, path, issues);
      break;
    case 'example':
      validateExampleKnowledgeUnit(value, path, issues);
      break;
    case 'diagnostic':
      validateDiagnosticKnowledgeUnit(value, path, issues);
      break;
    case 'recipe':
      validateRecipeKnowledgeUnit(value, path, issues);
      break;
  }

  return sourceId === null || typeof value.unitType !== 'string'
    ? null
    : {
        sourceId,
        unitType: value.unitType as KnowledgeUnitType
      };
}

function validateKnowledgePackPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];

  if (payload.schemaVersion !== 1) {
    issues.push(error('$.schemaVersion', 'Knowledge pack schemaVersion must be 1.'));
  }
  if (payload.mutationAllowed !== false) {
    issues.push(error('$.mutationAllowed', 'Knowledge pack mutationAllowed must be false.'));
  }
  if (typeof payload.packId !== 'string' || !PACK_ID_PATTERN.test(payload.packId)) {
    issues.push(error('$.packId', 'Knowledge pack packId must be a 24-character hex string.'));
  }
  readNonEmptyString(payload.workspaceRoot, '$.workspaceRoot', issues);
  readNonEmptyString(payload.cacheRoot, '$.cacheRoot', issues);

  const requestedDomains = readStringArray(payload.requestedDomains, '$.requestedDomains', issues);
  requestedDomains?.forEach((domain, index) => {
    if (!INFRA_DOMAINS.includes(domain as typeof INFRA_DOMAINS[number])) {
      issues.push(error(`$.requestedDomains[${index}]`, 'Knowledge pack requested domain must be supported.'));
    }
  });
  readStringArray(payload.targetPaths, '$.targetPaths', issues);
  const declaredSourceIds = readStringArray(payload.sourceIds, '$.sourceIds', issues);

  const maxFacts = readPositiveInteger(payload.maxFacts, '$.maxFacts', issues);
  const maxUnits = payload.maxUnits === undefined
    ? maxFacts
    : readPositiveInteger(payload.maxUnits, '$.maxUnits', issues);
  const sourceCount = readNonNegativeInteger(payload.sourceCount, '$.sourceCount', issues);
  const factSetCount = readNonNegativeInteger(payload.factSetCount, '$.factSetCount', issues);
  const factCount = readNonNegativeInteger(payload.factCount, '$.factCount', issues);
  const includedFactCount = readNonNegativeInteger(payload.includedFactCount, '$.includedFactCount', issues);
  const omittedFactCount = readNonNegativeInteger(payload.omittedFactCount, '$.omittedFactCount', issues);
  const hasUnitFields = payload.unitCount !== undefined
    || payload.includedUnitCount !== undefined
    || payload.omittedUnitCount !== undefined
    || payload.units !== undefined;
  const unitCount = hasUnitFields
    ? readNonNegativeInteger(payload.unitCount, '$.unitCount', issues)
    : null;
  const includedUnitCount = hasUnitFields
    ? readNonNegativeInteger(payload.includedUnitCount, '$.includedUnitCount', issues)
    : null;
  const omittedUnitCount = hasUnitFields
    ? readNonNegativeInteger(payload.omittedUnitCount, '$.omittedUnitCount', issues)
    : null;
  const staleSourceCount = readNonNegativeInteger(payload.staleSourceCount, '$.staleSourceCount', issues);

  const storagePolicySummary = validateKnowledgeStoragePolicySummary(payload.storagePolicy, '$.storagePolicy', issues);
  const sources: Array<Pick<KnowledgePackSource, 'id' | 'kind' | 'name' | 'factCount' | 'stale' | 'staleReason' | 'storagePolicy' | 'fingerprint'>> = [];
  if (!Array.isArray(payload.sources)) {
    issues.push(error('$.sources', 'Knowledge pack sources must be an array.'));
  } else {
    payload.sources.forEach((source, index) => {
      const validated = validateKnowledgePackSource(source, `$.sources[${index}]`, issues);
      if (validated) {
        sources.push(validated);
      }
    });
  }

  const sourceIds = new Set(sources.map(source => source.id));
  if (sourceIds.size !== sources.length) {
    issues.push(error('$.sources', 'Knowledge pack source ids must be unique.'));
  }
  if (declaredSourceIds !== null) {
    const declaredIdSet = new Set(declaredSourceIds);
    if (declaredIdSet.size !== declaredSourceIds.length) {
      issues.push(error('$.sourceIds', 'Knowledge pack sourceIds must be unique.'));
    }
  }

  const facts: Array<Pick<KnowledgePackFact, 'sourceId'>> = [];
  if (!Array.isArray(payload.facts)) {
    issues.push(error('$.facts', 'Knowledge pack facts must be an array.'));
  } else {
    payload.facts.forEach((fact, index) => {
      const validated = validateKnowledgePackFact(fact, `$.facts[${index}]`, sourceIds, issues);
      if (validated) {
        facts.push(validated);
      }
    });
  }

  const units: Array<Pick<KnowledgePackUnit, 'sourceId' | 'unitType'>> = [];
  if (hasUnitFields) {
    if (!Array.isArray(payload.units)) {
      issues.push(error('$.units', 'Knowledge pack units must be an array when unit counts are present.'));
    } else {
      payload.units.forEach((unit, index) => {
        const validated = validateKnowledgePackUnit(unit, `$.units[${index}]`, sourceIds, issues);
        if (validated) {
          units.push(validated);
        }
      });
    }
  }

  const actualSourceCount = sources.length;
  const actualFactSetCount = sources.length;
  const actualFactCount = sources.reduce((total, source) => total + source.factCount, 0);
  const actualIncludedFactCount = facts.length;
  const actualOmittedFactCount = Math.max(0, actualFactCount - actualIncludedFactCount);
  const actualIncludedUnitCount = units.length;
  const actualOmittedUnitCount = unitCount !== null
    ? unitCount - actualIncludedUnitCount
    : 0;
  const actualStaleSourceCount = sources.filter(source => source.stale).length;
  const actualStoragePolicy = {
    publicReference: sources.filter(source => source.storagePolicy.scope === 'public-reference').length,
    workspacePrivate: sources.filter(source => source.storagePolicy.scope === 'workspace-private').length,
    shareableByDefault: sources.filter(source => source.storagePolicy.shareableByDefault).length,
    explicitOptInRequired: sources.filter(source => source.storagePolicy.requiresExplicitOptIn).length
  };

  if (sourceCount !== null && sourceCount !== actualSourceCount) {
    issues.push(error('$.sourceCount', 'Knowledge pack sourceCount must match sources.length.'));
  }
  if (factSetCount !== null && factSetCount !== actualFactSetCount) {
    issues.push(error('$.factSetCount', 'Knowledge pack factSetCount must match sources.length.'));
  }
  if (factCount !== null && factCount !== actualFactCount) {
    issues.push(error('$.factCount', 'Knowledge pack factCount must match the sum of source fact counts.'));
  }
  if (includedFactCount !== null && includedFactCount !== actualIncludedFactCount) {
    issues.push(error('$.includedFactCount', 'Knowledge pack includedFactCount must match facts.length.'));
  }
  if (includedFactCount !== null && factCount !== null && includedFactCount > factCount) {
    issues.push(error('$.includedFactCount', 'Knowledge pack includedFactCount must not exceed factCount.'));
  }
  if (includedFactCount !== null && maxFacts !== null && includedFactCount > maxFacts) {
    issues.push(error('$.includedFactCount', 'Knowledge pack includedFactCount must not exceed maxFacts.'));
  }
  if (payload.maxUnits !== undefined && maxFacts !== null && maxUnits !== null && maxUnits !== maxFacts) {
    issues.push(error('$.maxUnits', 'Knowledge pack maxUnits must match maxFacts while maxFacts remains the compatibility budget field.'));
  }
  if (omittedFactCount !== null && omittedFactCount !== actualOmittedFactCount) {
    issues.push(error('$.omittedFactCount', 'Knowledge pack omittedFactCount must match factCount - includedFactCount.'));
  }
  if (hasUnitFields) {
    if (unitCount !== null && unitCount < actualIncludedUnitCount) {
      issues.push(error('$.unitCount', 'Knowledge pack unitCount must not be less than units.length.'));
    }
    if (includedUnitCount !== null && includedUnitCount !== actualIncludedUnitCount) {
      issues.push(error('$.includedUnitCount', 'Knowledge pack includedUnitCount must match units.length.'));
    }
    if (includedUnitCount !== null && unitCount !== null && includedUnitCount > unitCount) {
      issues.push(error('$.includedUnitCount', 'Knowledge pack includedUnitCount must not exceed unitCount.'));
    }
    if (includedUnitCount !== null && maxUnits !== null && includedUnitCount > maxUnits) {
      issues.push(error('$.includedUnitCount', 'Knowledge pack includedUnitCount must not exceed maxUnits.'));
    }
    if (omittedUnitCount !== null && unitCount !== null && omittedUnitCount !== actualOmittedUnitCount) {
      issues.push(error('$.omittedUnitCount', 'Knowledge pack omittedUnitCount must match unitCount - includedUnitCount.'));
    }
  }
  if (staleSourceCount !== null && staleSourceCount !== actualStaleSourceCount) {
    issues.push(error('$.staleSourceCount', 'Knowledge pack staleSourceCount must match stale sources.'));
  }
  if (storagePolicySummary !== null) {
    if (storagePolicySummary.publicReference !== actualStoragePolicy.publicReference) {
      issues.push(error('$.storagePolicy.publicReference', 'Knowledge pack storagePolicy publicReference must match source policies.'));
    }
    if (storagePolicySummary.workspacePrivate !== actualStoragePolicy.workspacePrivate) {
      issues.push(error('$.storagePolicy.workspacePrivate', 'Knowledge pack storagePolicy workspacePrivate must match source policies.'));
    }
    if (storagePolicySummary.shareableByDefault !== actualStoragePolicy.shareableByDefault) {
      issues.push(error('$.storagePolicy.shareableByDefault', 'Knowledge pack storagePolicy shareableByDefault must match source policies.'));
    }
    if (storagePolicySummary.explicitOptInRequired !== actualStoragePolicy.explicitOptInRequired) {
      issues.push(error('$.storagePolicy.explicitOptInRequired', 'Knowledge pack storagePolicy explicitOptInRequired must match source policies.'));
    }
  }

  return createReport(
    inputPath,
    inputKind,
    issues,
    [],
    {},
    {
      staleSourceIds: new Set(),
      uncheckedLocalSourceCount: 0,
      staleSourceDetails: [],
      uncheckedLocalSourceDetails: []
    },
    {
      factSetCount: factSetCount ?? actualFactSetCount,
      factCount: factCount ?? actualFactCount,
      ...(unitCount !== null ? { unitCount } : {}),
      staleSourceCount: staleSourceCount ?? actualStaleSourceCount
    }
  );
}

function emptyKnowledgeUnitCountByType(): Record<KnowledgeUnitType, number> {
  return {
    fact: 0,
    guidance: 0,
    example: 0,
    diagnostic: 0,
    recipe: 0
  };
}

function validatePublicKnowledgeUnitCounts(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): Record<KnowledgeUnitType, number> | null {
  if (!isRecord(value)) {
    issues.push(error(path, 'Public knowledge library artifact unitCounts must be an object.'));
    return null;
  }

  const counts = emptyKnowledgeUnitCountByType();
  const keys = new Set(Object.keys(value));
  for (const unitType of KNOWLEDGE_UNIT_TYPES) {
    keys.delete(unitType);
    const count = readNonNegativeInteger(value[unitType], `${path}.${unitType}`, issues);
    if (count !== null) {
      counts[unitType] = count;
    }
  }
  for (const extraKey of keys) {
    issues.push(error(`${path}.${extraKey}`, 'Public knowledge library artifact unitCounts must only include supported unit types.'));
  }

  return counts;
}

function validatePublicKnowledgeVersionRef(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[],
  expectedVersion: string | null
): {
  value: string | null;
  kind: string | null;
  mutable: boolean | null;
} | null {
  if (!isRecord(value)) {
    issues.push(error(path, 'Public knowledge library artifact versionRef must be an object.'));
    return null;
  }

  const versionValue = readNonEmptyString(value.value, `${path}.value`, issues);
  if (versionValue !== null) {
    validateNoSecretLikeValue(versionValue, `${path}.value`, issues);
    if (expectedVersion !== null && versionValue !== expectedVersion) {
      issues.push(error(`${path}.value`, 'Public knowledge library artifact versionRef value must match version.'));
    }
  }
  if (
    typeof value.kind !== 'string'
    || !PUBLIC_KNOWLEDGE_VERSION_REF_KINDS.includes(value.kind as typeof PUBLIC_KNOWLEDGE_VERSION_REF_KINDS[number])
  ) {
    issues.push(error(`${path}.kind`, 'Public knowledge library artifact versionRef kind must be supported.'));
  }
  const mutable = readBoolean(value.mutable, `${path}.mutable`, issues);
  if (value.source !== 'url-path') {
    issues.push(error(`${path}.source`, 'Public knowledge library artifact versionRef source must be url-path.'));
  }

  if (versionValue !== null && typeof value.kind === 'string' && mutable !== null) {
    const floating = versionValue === 'latest';
    const expectedKind = floating ? 'floating-alias' : 'pinned-version';
    if (value.kind !== expectedKind) {
      issues.push(error(`${path}.kind`, 'Public knowledge library artifact versionRef kind must match the version selector.'));
    }
    if (mutable !== floating) {
      issues.push(error(`${path}.mutable`, 'Public knowledge library artifact versionRef mutable flag must match the version selector.'));
    }
  }

  return {
    value: versionValue,
    kind: typeof value.kind === 'string' ? value.kind : null,
    mutable
  };
}

function validatePublicKnowledgeSource(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): { source: KnowledgeSource | null; domain: string | null } {
  if (!isRecord(value)) {
    issues.push(error(path, 'Public knowledge library artifact source must be an object.'));
    return { source: null, domain: null };
  }

  const domain = typeof value.domain === 'string' ? value.domain : null;
  if (domain === null || !INFRA_DOMAINS.includes(domain as typeof INFRA_DOMAINS[number])) {
    issues.push(error(`${path}.domain`, 'Public knowledge library artifact source domain must be supported.'));
  }

  const source = validateKnowledgeUnitSource(value, path, issues);
  return { source, domain };
}

function validatePublicKnowledgeClassification(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): {
  coordinates: string | null;
  ecosystem: string | null;
  artifactKind: string | null;
  sourceName: string | null;
  providerAddress: string | null;
  version: string | null;
  versionRef: {
    value: string | null;
    kind: string | null;
    mutable: boolean | null;
  } | null;
} {
  if (!isRecord(value)) {
    issues.push(error(path, 'Public knowledge library artifact classification must be an object.'));
    return {
      coordinates: null,
      ecosystem: null,
      artifactKind: null,
      sourceName: null,
      providerAddress: null,
      version: null,
      versionRef: null
    };
  }

  if (value.registry !== 'infra-agent-public-reference') {
    issues.push(error(`${path}.registry`, 'Public knowledge library artifact registry must be infra-agent-public-reference.'));
  }
  if (value.ecosystem !== 'terraform') {
    issues.push(error(`${path}.ecosystem`, 'Public knowledge library artifact ecosystem must be terraform for v0.'));
  }
  if (
    value.artifactKind !== 'terraform-provider-resource'
    && value.artifactKind !== 'terraform-provider-data-source'
  ) {
    issues.push(error(`${path}.artifactKind`, 'Public knowledge library artifact artifactKind must be supported.'));
  }

  const namespace = readNonEmptyString(value.namespace, `${path}.namespace`, issues);
  const providerName = readNonEmptyString(value.providerName, `${path}.providerName`, issues);
  const providerAddress = readNonEmptyString(value.providerAddress, `${path}.providerAddress`, issues);
  const version = readNonEmptyString(value.version, `${path}.version`, issues);
  const versionRef = validatePublicKnowledgeVersionRef(value.versionRef, `${path}.versionRef`, issues, version);
  const sourceName = readNonEmptyString(value.sourceName, `${path}.sourceName`, issues);
  const slug = readNonEmptyString(value.slug, `${path}.slug`, issues);
  const coordinates = readNonEmptyString(value.coordinates, `${path}.coordinates`, issues);
  const tags = readStringArray(value.tags, `${path}.tags`, issues);

  for (const [fieldPath, fieldValue] of [
    [`${path}.namespace`, namespace],
    [`${path}.providerName`, providerName],
    [`${path}.providerAddress`, providerAddress],
    [`${path}.version`, version],
    [`${path}.sourceName`, sourceName],
    [`${path}.slug`, slug],
    [`${path}.coordinates`, coordinates]
  ] as const) {
    if (fieldValue !== null) {
      validateNoSecretLikeValue(fieldValue, fieldPath, issues);
    }
  }
  tags?.forEach((tag, index) => validateNoSecretLikeValue(tag, `${path}.tags[${index}]`, issues));

  if (namespace !== null && providerName !== null && providerAddress !== null) {
    const expectedProviderAddress = `${namespace}/${providerName}`;
    if (providerAddress !== expectedProviderAddress) {
      issues.push(error(`${path}.providerAddress`, 'Public knowledge library artifact providerAddress must match namespace/providerName.'));
    }
  }

  if (
    namespace !== null
    && providerName !== null
    && providerAddress !== null
    && version !== null
    && sourceName !== null
    && slug !== null
    && coordinates !== null
    && (value.artifactKind === 'terraform-provider-resource' || value.artifactKind === 'terraform-provider-data-source')
  ) {
    const typeName = `${providerName}_${slug}`;
    const kindSegment = value.artifactKind === 'terraform-provider-resource'
      ? 'resource'
      : 'data-source';
    const expectedSourceName = value.artifactKind === 'terraform-provider-resource'
      ? `resource:${typeName}`
      : `data-source:${typeName}`;
    const expectedCoordinates = [
      'terraform',
      'provider',
      `${namespace}/${providerName}`,
      version,
      kindSegment,
      typeName
    ].join('/');

    if (sourceName !== expectedSourceName) {
      issues.push(error(`${path}.sourceName`, 'Public knowledge library artifact sourceName must match artifactKind and provider slug.'));
    }
    if (coordinates !== expectedCoordinates) {
      issues.push(error(`${path}.coordinates`, 'Public knowledge library artifact coordinates must match ecosystem/provider/version/kind/type.'));
    }
    if (tags !== null && !tags.includes(typeName)) {
      issues.push(error(`${path}.tags`, 'Public knowledge library artifact tags must include the resource or data-source type name.'));
    }
  }

  return {
    coordinates,
    ecosystem: typeof value.ecosystem === 'string' ? value.ecosystem : null,
    artifactKind: typeof value.artifactKind === 'string' ? value.artifactKind : null,
    sourceName,
    providerAddress,
    version,
    versionRef
  };
}

function validatePublicKnowledgeDownloadSummary(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push(error(path, 'Public knowledge library artifact download must be an object.'));
    return;
  }

  if (
    typeof value.mode !== 'string'
    || !PUBLIC_KNOWLEDGE_DOWNLOAD_MODES.includes(value.mode as typeof PUBLIC_KNOWLEDGE_DOWNLOAD_MODES[number])
  ) {
    issues.push(error(`${path}.mode`, 'Public knowledge library artifact download mode must be supported.'));
  }
  if (
    typeof value.strategy !== 'string'
    || !PUBLIC_KNOWLEDGE_DOWNLOAD_STRATEGIES.includes(value.strategy as typeof PUBLIC_KNOWLEDGE_DOWNLOAD_STRATEGIES[number])
  ) {
    issues.push(error(`${path}.strategy`, 'Public knowledge library artifact download strategy must be supported.'));
  }

  const attemptedCount = readNonNegativeInteger(value.attemptedCount, `${path}.attemptedCount`, issues);
  const fallbackUsed = readBoolean(value.fallbackUsed, `${path}.fallbackUsed`, issues);
  if (
    value.usedRole !== 'local-content'
    && value.usedRole !== 'primary'
    && value.usedRole !== 'fallback'
  ) {
    issues.push(error(`${path}.usedRole`, 'Public knowledge library artifact download usedRole must be supported.'));
  }
  if (
    typeof value.usedContentType !== 'string'
    || !KNOWLEDGE_CONTENT_TYPES.includes(value.usedContentType as KnowledgeContentType)
  ) {
    issues.push(error(`${path}.usedContentType`, 'Public knowledge library artifact download usedContentType must be supported.'));
  }

  if (typeof value.usedUrl === 'string') {
    validateSecretSafeUrl(value.usedUrl, `${path}.usedUrl`, issues);
  } else if (value.usedUrl !== undefined) {
    issues.push(error(`${path}.usedUrl`, 'Public knowledge library artifact download usedUrl must be a string when present.'));
  }

  const usedAttempts: Array<{ role: unknown; url: unknown; contentType: unknown }> = [];
  if (!Array.isArray(value.attempts)) {
    issues.push(error(`${path}.attempts`, 'Public knowledge library artifact download attempts must be an array.'));
  } else {
    if (attemptedCount !== null && attemptedCount !== value.attempts.length) {
      issues.push(error(`${path}.attemptedCount`, 'Public knowledge library artifact download attemptedCount must match attempts.length.'));
    }
    value.attempts.forEach((attempt, index) => {
      const attemptPath = `${path}.attempts[${index}]`;
      if (!isRecord(attempt)) {
        issues.push(error(attemptPath, 'Public knowledge library artifact download attempt must be an object.'));
        return;
      }
      if (
        typeof attempt.role !== 'string'
        || !PUBLIC_KNOWLEDGE_DOWNLOAD_ATTEMPT_ROLES.includes(attempt.role as typeof PUBLIC_KNOWLEDGE_DOWNLOAD_ATTEMPT_ROLES[number])
      ) {
        issues.push(error(`${attemptPath}.role`, 'Public knowledge library artifact download attempt role must be supported.'));
      }
      if (
        typeof attempt.status !== 'string'
        || !PUBLIC_KNOWLEDGE_DOWNLOAD_ATTEMPT_STATUSES.includes(attempt.status as typeof PUBLIC_KNOWLEDGE_DOWNLOAD_ATTEMPT_STATUSES[number])
      ) {
        issues.push(error(`${attemptPath}.status`, 'Public knowledge library artifact download attempt status must be supported.'));
      }
      const attemptUrl = readNonEmptyString(attempt.url, `${attemptPath}.url`, issues);
      if (attemptUrl !== null) {
        validateSecretSafeUrl(attemptUrl, `${attemptPath}.url`, issues);
      }
      if (attempt.contentType !== undefined && (
        typeof attempt.contentType !== 'string'
        || !KNOWLEDGE_CONTENT_TYPES.includes(attempt.contentType as KnowledgeContentType)
      )) {
        issues.push(error(`${attemptPath}.contentType`, 'Public knowledge library artifact download attempt contentType must be supported.'));
      }
      if (attempt.byteLength !== undefined) {
        readNonNegativeInteger(attempt.byteLength, `${attemptPath}.byteLength`, issues);
      }
      if (attempt.httpStatus !== undefined) {
        readNonNegativeInteger(attempt.httpStatus, `${attemptPath}.httpStatus`, issues);
      }
      validateOptionalString(attempt.reason, `${attemptPath}.reason`, issues);
      validateOptionalString(attempt.statusText, `${attemptPath}.statusText`, issues);

      if (attempt.status === 'used') {
        usedAttempts.push({
          role: attempt.role,
          url: attempt.url,
          contentType: attempt.contentType
        });
      }
    });
  }

  if (value.mode === 'local-content') {
    if (value.strategy !== 'local-content-fixture') {
      issues.push(error(`${path}.strategy`, 'Local-content public knowledge downloads must use local-content-fixture strategy.'));
    }
    if (attemptedCount !== null && attemptedCount !== 0) {
      issues.push(error(`${path}.attemptedCount`, 'Local-content public knowledge downloads must not record live attempts.'));
    }
    if (fallbackUsed !== false) {
      issues.push(error(`${path}.fallbackUsed`, 'Local-content public knowledge downloads must not report fallback usage.'));
    }
    if (value.usedRole !== 'local-content') {
      issues.push(error(`${path}.usedRole`, 'Local-content public knowledge downloads must use usedRole=local-content.'));
    }
    if (Array.isArray(value.attempts) && value.attempts.length !== 0) {
      issues.push(error(`${path}.attempts`, 'Local-content public knowledge downloads must not include live attempts.'));
    }
    if (value.usedUrl !== undefined) {
      issues.push(error(`${path}.usedUrl`, 'Local-content public knowledge downloads must not include a usedUrl.'));
    }
  }

  if (value.mode === 'live-fetch') {
    if (value.strategy !== 'terraform-registry-primary-then-provider-repo-raw') {
      issues.push(error(`${path}.strategy`, 'Live public knowledge downloads must use a supported official-doc fallback strategy.'));
    }
    if (value.usedRole !== 'primary' && value.usedRole !== 'fallback') {
      issues.push(error(`${path}.usedRole`, 'Live public knowledge downloads must use primary or fallback usedRole.'));
    }
    if (typeof value.usedUrl !== 'string' || value.usedUrl.length === 0) {
      issues.push(error(`${path}.usedUrl`, 'Live public knowledge downloads must include the used URL.'));
    }
    if (usedAttempts.length !== 1) {
      issues.push(error(`${path}.attempts`, 'Live public knowledge downloads must include exactly one used attempt.'));
    } else if (usedAttempts[0].role !== value.usedRole || usedAttempts[0].url !== value.usedUrl) {
      issues.push(error(`${path}.attempts`, 'Live public knowledge download used attempt must match usedRole and usedUrl.'));
    } else if (
      typeof usedAttempts[0].contentType === 'string'
      && usedAttempts[0].contentType !== value.usedContentType
      && !(usedAttempts[0].contentType === 'text/plain' && value.usedContentType === 'text/markdown')
    ) {
      issues.push(error(`${path}.attempts`, 'Live public knowledge download used attempt contentType must match usedContentType or a supported markdown normalization.'));
    }
    if (fallbackUsed !== (value.usedRole === 'fallback')) {
      issues.push(error(`${path}.fallbackUsed`, 'Live public knowledge fallbackUsed must match usedRole=fallback.'));
    }
  }
}

function validatePublicKnowledgeQuality(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push(error(path, 'Public knowledge library artifact quality must be an object.'));
    return;
  }

  if (
    typeof value.status !== 'string'
    || !PUBLIC_KNOWLEDGE_QUALITY_STATUSES.includes(value.status as typeof PUBLIC_KNOWLEDGE_QUALITY_STATUSES[number])
  ) {
    issues.push(error(`${path}.status`, 'Public knowledge library artifact quality status must be supported.'));
  }
  const score = readNonNegativeInteger(value.score, `${path}.score`, issues);
  if (score !== null && score > 100) {
    issues.push(error(`${path}.score`, 'Public knowledge library artifact quality score must be between 0 and 100.'));
  }
  readStringArray(value.warnings, `${path}.warnings`, issues)
    ?.forEach((warningValue, index) => validateNoSecretLikeValue(warningValue, `${path}.warnings[${index}]`, issues));
  if (value.llmUsed !== false) {
    issues.push(error(`${path}.llmUsed`, 'Public knowledge library artifact quality llmUsed must be false until explicit refinement is implemented.'));
  }
  if (value.refinementMode !== 'deterministic') {
    issues.push(error(`${path}.refinementMode`, 'Public knowledge library artifact quality refinementMode must be deterministic.'));
  }
}

function validatePublicKnowledgeLlmReviewPacket(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[],
  expected: PublicKnowledgeLlmReviewExpected
): void {
  if (!isRecord(value)) {
    issues.push(error(path, 'Public knowledge library artifact LLM reviewPacket must be an object.'));
    return;
  }

  const sourceId = readNonEmptyString(value.sourceId, `${path}.sourceId`, issues);
  if (sourceId !== null && expected.sourceId !== null && sourceId !== expected.sourceId) {
    issues.push(error(`${path}.sourceId`, 'Public knowledge library artifact LLM reviewPacket sourceId must match artifact sourceId.'));
  }

  const sourceContentHash = readNonEmptyString(value.sourceContentHash, `${path}.sourceContentHash`, issues);
  if (sourceContentHash !== null) {
    if (!SHA256_HEX_PATTERN.test(sourceContentHash)) {
      issues.push(error(`${path}.sourceContentHash`, 'Public knowledge library artifact LLM reviewPacket sourceContentHash must be a SHA-256 hex string.'));
    } else if (expected.sourceContentHash !== null && sourceContentHash !== expected.sourceContentHash) {
      issues.push(error(`${path}.sourceContentHash`, 'Public knowledge library artifact LLM reviewPacket sourceContentHash must match artifact sourceContentHash.'));
    }
  }

  const coordinates = readNonEmptyString(value.coordinates, `${path}.coordinates`, issues);
  if (coordinates !== null) {
    validateNoSecretLikeValue(coordinates, `${path}.coordinates`, issues);
    if (expected.classification.coordinates !== null && coordinates !== expected.classification.coordinates) {
      issues.push(error(`${path}.coordinates`, 'Public knowledge library artifact LLM reviewPacket coordinates must match classification.coordinates.'));
    }
  }
  if (expected.classification.ecosystem !== null && value.ecosystem !== expected.classification.ecosystem) {
    issues.push(error(`${path}.ecosystem`, 'Public knowledge library artifact LLM reviewPacket ecosystem must match classification ecosystem.'));
  }
  if (expected.classification.artifactKind !== null && value.artifactKind !== expected.classification.artifactKind) {
    issues.push(error(`${path}.artifactKind`, 'Public knowledge library artifact LLM reviewPacket artifactKind must match classification artifactKind.'));
  }
  if (expected.classification.version !== null && value.version !== expected.classification.version) {
    issues.push(error(`${path}.version`, 'Public knowledge library artifact LLM reviewPacket version must match classification version.'));
  }
  const reviewPacketVersionRef = validatePublicKnowledgeVersionRef(
    value.versionRef,
    `${path}.versionRef`,
    issues,
    expected.classification.version
  );
  if (reviewPacketVersionRef !== null && expected.classification.versionRef !== null) {
    if (reviewPacketVersionRef.kind !== expected.classification.versionRef.kind) {
      issues.push(error(`${path}.versionRef.kind`, 'Public knowledge library artifact LLM reviewPacket versionRef kind must match classification versionRef.'));
    }
    if (reviewPacketVersionRef.mutable !== expected.classification.versionRef.mutable) {
      issues.push(error(`${path}.versionRef.mutable`, 'Public knowledge library artifact LLM reviewPacket versionRef mutable flag must match classification versionRef.'));
    }
  }
  if (expected.classification.sourceName !== null && value.sourceName !== expected.classification.sourceName) {
    issues.push(error(`${path}.sourceName`, 'Public knowledge library artifact LLM reviewPacket sourceName must match classification sourceName.'));
  }

  if (isRecord(expected.download)) {
    if (value.downloadMode !== expected.download.mode) {
      issues.push(error(`${path}.downloadMode`, 'Public knowledge library artifact LLM reviewPacket downloadMode must match download.mode.'));
    }
    if (value.downloadStrategy !== expected.download.strategy) {
      issues.push(error(`${path}.downloadStrategy`, 'Public knowledge library artifact LLM reviewPacket downloadStrategy must match download.strategy.'));
    }
    if (value.usedRole !== expected.download.usedRole) {
      issues.push(error(`${path}.usedRole`, 'Public knowledge library artifact LLM reviewPacket usedRole must match download.usedRole.'));
    }
    if (value.fallbackUsed !== expected.download.fallbackUsed) {
      issues.push(error(`${path}.fallbackUsed`, 'Public knowledge library artifact LLM reviewPacket fallbackUsed must match download.fallbackUsed.'));
    }
  }

  const unitBudget = readPositiveInteger(value.unitBudget, `${path}.unitBudget`, issues);
  if (unitBudget !== null && unitBudget < expected.unitCount) {
    issues.push(error(`${path}.unitBudget`, 'Public knowledge library artifact LLM reviewPacket unitBudget must be at least the selected unit count.'));
  }
  const unitCount = readNonNegativeInteger(value.unitCount, `${path}.unitCount`, issues);
  if (unitCount !== null && unitCount !== expected.unitCount) {
    issues.push(error(`${path}.unitCount`, 'Public knowledge library artifact LLM reviewPacket unitCount must match selected units.'));
  }
  const unitCounts = validatePublicKnowledgeUnitCounts(value.unitCounts, `${path}.unitCounts`, issues);
  if (unitCounts !== null) {
    for (const unitType of KNOWLEDGE_UNIT_TYPES) {
      if (unitCounts[unitType] !== expected.unitCounts[unitType]) {
        issues.push(error(`${path}.unitCounts.${unitType}`, 'Public knowledge library artifact LLM reviewPacket unitCounts must match selected units.'));
      }
    }
  }
  const missingUnitTypes = readStringArray(value.missingUnitTypes, `${path}.missingUnitTypes`, issues);
  if (missingUnitTypes !== null && !stringArraysEqual(missingUnitTypes, expected.missingUnitTypes)) {
    issues.push(error(`${path}.missingUnitTypes`, 'Public knowledge library artifact LLM reviewPacket missingUnitTypes must match selected unit coverage.'));
  }
  const compactByteLength = readNonNegativeInteger(value.compactByteLength, `${path}.compactByteLength`, issues);
  if (
    compactByteLength !== null
    && expected.compactByteLength !== null
    && compactByteLength !== expected.compactByteLength
  ) {
    issues.push(error(`${path}.compactByteLength`, 'Public knowledge library artifact LLM reviewPacket compactByteLength must match compact units.'));
  }

  if (isRecord(expected.quality)) {
    if (value.qualityStatus !== expected.quality.status) {
      issues.push(error(`${path}.qualityStatus`, 'Public knowledge library artifact LLM reviewPacket qualityStatus must match quality.status.'));
    }
    if (value.qualityScore !== expected.quality.score) {
      issues.push(error(`${path}.qualityScore`, 'Public knowledge library artifact LLM reviewPacket qualityScore must match quality.score.'));
    }
    const qualityWarnings = readStringArray(value.qualityWarnings, `${path}.qualityWarnings`, issues);
    const expectedWarnings = Array.isArray(expected.quality.warnings)
      ? expected.quality.warnings.filter((entry): entry is string => typeof entry === 'string')
      : [];
    if (qualityWarnings !== null && !stringArraysEqual(qualityWarnings, expectedWarnings)) {
      issues.push(error(`${path}.qualityWarnings`, 'Public knowledge library artifact LLM reviewPacket qualityWarnings must match quality.warnings.'));
    }
  }
}

function validatePublicKnowledgeLlmRefinementInput(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[],
  expected: PublicKnowledgeLlmReviewExpected
): void {
  if (!isRecord(value)) {
    issues.push(error(path, 'Public knowledge library artifact llmRefinementInput must be an object.'));
    return;
  }

  if (value.status !== 'not-run') {
    issues.push(error(`${path}.status`, 'Public knowledge library artifact LLM refinement status must be not-run.'));
  }
  if (value.mode !== 'offline-review') {
    issues.push(error(`${path}.mode`, 'Public knowledge library artifact LLM refinement mode must be offline-review.'));
  }
  const inputRefs = readStringArray(value.inputRefs, `${path}.inputRefs`, issues);
  if (inputRefs !== null) {
    for (const requiredRef of [
      'report.centralLibraryCandidate.classification',
      'report.download',
      'report.summary',
      'report.unitsByType',
      'report.quality'
    ]) {
      if (!inputRefs.includes(requiredRef)) {
        issues.push(error(`${path}.inputRefs`, 'Public knowledge library artifact LLM inputRefs must include structured report fields.'));
        break;
      }
    }
  }
  validatePublicKnowledgeLlmReviewPacket(value.reviewPacket, `${path}.reviewPacket`, issues, expected);
  const objective = readNonEmptyString(value.objective, `${path}.objective`, issues);
  if (objective !== null) {
    validateNoSecretLikeValue(objective, `${path}.objective`, issues);
  }
  const unitTypes = readStringArray(value.unitTypes, `${path}.unitTypes`, issues);
  if (unitTypes !== null) {
    for (const unitType of KNOWLEDGE_UNIT_TYPES) {
      if (!unitTypes.includes(unitType)) {
        issues.push(error(`${path}.unitTypes`, 'Public knowledge library artifact LLM unitTypes must include all five knowledge unit types.'));
        break;
      }
    }
  }
  const reviewChecklist = readStringArray(value.reviewChecklist, `${path}.reviewChecklist`, issues);
  if (reviewChecklist !== null) {
    if (reviewChecklist.length < 3) {
      issues.push(error(`${path}.reviewChecklist`, 'Public knowledge library artifact LLM reviewChecklist must include multiple review checks.'));
    }
    reviewChecklist.forEach((entry, index) => validateNoSecretLikeValue(entry, `${path}.reviewChecklist[${index}]`, issues));
  }
  const rejectionCriteria = readStringArray(value.rejectionCriteria, `${path}.rejectionCriteria`, issues);
  if (rejectionCriteria !== null) {
    if (rejectionCriteria.length < 3) {
      issues.push(error(`${path}.rejectionCriteria`, 'Public knowledge library artifact LLM rejectionCriteria must include multiple rejection checks.'));
    }
    rejectionCriteria.forEach((entry, index) => validateNoSecretLikeValue(entry, `${path}.rejectionCriteria[${index}]`, issues));
  }
  const constraints = readStringArray(value.constraints, `${path}.constraints`, issues);
  if (constraints !== null) {
    if (constraints.length === 0) {
      issues.push(error(`${path}.constraints`, 'Public knowledge library artifact LLM constraints must not be empty.'));
    }
    constraints.forEach((constraint, index) => validateNoSecretLikeValue(constraint, `${path}.constraints[${index}]`, issues));
  }
  if (value.outputContract !== 'infra-agent.public-knowledge-url-report') {
    issues.push(error(`${path}.outputContract`, 'Public knowledge library artifact LLM outputContract must remain the URL report contract until refinement output is implemented.'));
  }
}

function validatePublicKnowledgeQualityMatches(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[],
  expected: unknown,
  label: string
): void {
  if (!isRecord(value) || !isRecord(expected)) {
    return;
  }

  if (value.status !== expected.status) {
    issues.push(error(`${path}.status`, `${label} quality status must match the report quality.`));
  }
  if (value.score !== expected.score) {
    issues.push(error(`${path}.score`, `${label} quality score must match the report quality.`));
  }
  const warnings = readStringArray(value.warnings, `${path}.warnings`, issues);
  const expectedWarnings = Array.isArray(expected.warnings)
    ? expected.warnings.filter((entry): entry is string => typeof entry === 'string')
    : [];
  if (warnings !== null && !stringArraysEqual(warnings, expectedWarnings)) {
    issues.push(error(`${path}.warnings`, `${label} quality warnings must match the report quality.`));
  }
}

function validateCompactPublicKnowledgeUnits(
  value: unknown,
  path: string,
  sourceId: string | null,
  issues: KnowledgeValidationIssue[],
  label: string
): {
  actualUnitCount: number;
  actualCounts: Record<KnowledgeUnitType, number>;
  actualCompactByteLength: number | null;
} {
  let actualUnitCount = 0;
  const actualCounts = emptyKnowledgeUnitCountByType();
  const sourceIds = new Set<string>();
  if (sourceId !== null) {
    sourceIds.add(sourceId);
  }

  if (!isRecord(value)) {
    issues.push(error(path, `${label} unitsByType must be an object.`));
    return {
      actualUnitCount,
      actualCounts,
      actualCompactByteLength: null
    };
  }

  const keys = new Set(Object.keys(value));
  for (const unitType of KNOWLEDGE_UNIT_TYPES) {
    keys.delete(unitType);
    const groupedUnits = value[unitType];
    if (!Array.isArray(groupedUnits)) {
      issues.push(error(`${path}.${unitType}`, `${label} unit group must be an array.`));
      continue;
    }
    for (const [index, unit] of groupedUnits.entries()) {
      const unitPath = `${path}.${unitType}[${index}]`;
      const validated = validateKnowledgePackUnit(unit, unitPath, sourceIds, issues);
      if (isRecord(unit)) {
        if (Object.hasOwn(unit, 'source')) {
          issues.push(error(`${unitPath}.source`, `${label} compact units must not embed full source objects.`));
        }
        if (unit.unitType !== unitType) {
          issues.push(error(`${unitPath}.unitType`, `${label} compact unitType must match its unit group.`));
        }
        if (unit.privacyScope !== 'public-reference') {
          issues.push(error(`${unitPath}.privacyScope`, `${label} units must remain public-reference.`));
        }
      }
      if (validated !== null) {
        actualCounts[validated.unitType] += 1;
        actualUnitCount += 1;
      }
    }
  }
  for (const extraKey of keys) {
    issues.push(error(`${path}.${extraKey}`, `${label} unitsByType must only include supported unit types.`));
  }

  return {
    actualUnitCount,
    actualCounts,
    actualCompactByteLength: JSON.stringify(value).length
  };
}

function validatePublicKnowledgeCentralLibraryCandidate(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[],
  expected: {
    domain: string | null;
    source: KnowledgeSource | null;
    sourceId: string | null;
    sourceContentHash: string | null;
    maxUnits: number | null;
    download: unknown;
    quality: unknown;
    unitCount: number;
    unitCounts: Record<KnowledgeUnitType, number>;
    missingUnitTypes: KnowledgeUnitType[];
    compactByteLength: number | null;
  }
): ReturnType<typeof validatePublicKnowledgeClassification> {
  if (!isRecord(value)) {
    issues.push(error(path, 'Public knowledge URL report centralLibraryCandidate must be an object.'));
    return {
      coordinates: null,
      ecosystem: null,
      artifactKind: null,
      sourceName: null,
      providerAddress: null,
      version: null,
      versionRef: null
    };
  }

  if (value.kind !== 'infra-agent.central-knowledge-candidate') {
    issues.push(error(`${path}.kind`, 'Public knowledge URL report centralLibraryCandidate kind must be infra-agent.central-knowledge-candidate.'));
  }
  if (value.schemaVersion !== 1) {
    issues.push(error(`${path}.schemaVersion`, 'Public knowledge URL report centralLibraryCandidate schemaVersion must be 1.'));
  }
  if (value.mutationAllowed !== false) {
    issues.push(error(`${path}.mutationAllowed`, 'Public knowledge URL report centralLibraryCandidate mutationAllowed must be false.'));
  }
  if (value.storageScope !== 'public-reference') {
    issues.push(error(`${path}.storageScope`, 'Public knowledge URL report centralLibraryCandidate storageScope must be public-reference.'));
  }
  if (value.privacyScope !== 'public-reference') {
    issues.push(error(`${path}.privacyScope`, 'Public knowledge URL report centralLibraryCandidate privacyScope must be public-reference.'));
  }

  const candidateId = readNonEmptyString(value.candidateId, `${path}.candidateId`, issues);
  if (candidateId !== null) {
    if (!PACK_ID_PATTERN.test(candidateId)) {
      issues.push(error(`${path}.candidateId`, 'Public knowledge URL report centralLibraryCandidate candidateId must be a 24-character hex string.'));
    } else if (
      expected.sourceId !== null
      && expected.sourceContentHash !== null
      && expected.maxUnits !== null
      && candidateId !== sha256Hex(`${expected.sourceId}:${expected.sourceContentHash}:${expected.maxUnits}`).slice(0, 24)
    ) {
      issues.push(error(`${path}.candidateId`, 'Public knowledge URL report centralLibraryCandidate candidateId must match sourceId, sourceContentHash, and maxUnits.'));
    }
  }

  const sourceId = readNonEmptyString(value.sourceId, `${path}.sourceId`, issues);
  if (sourceId !== null && expected.sourceId !== null && sourceId !== expected.sourceId) {
    issues.push(error(`${path}.sourceId`, 'Public knowledge URL report centralLibraryCandidate sourceId must match report sourceId.'));
  }
  const sourceContentHash = readNonEmptyString(value.sourceContentHash, `${path}.sourceContentHash`, issues);
  if (sourceContentHash !== null) {
    if (!SHA256_HEX_PATTERN.test(sourceContentHash)) {
      issues.push(error(`${path}.sourceContentHash`, 'Public knowledge URL report centralLibraryCandidate sourceContentHash must be a SHA-256 hex string.'));
    } else if (expected.sourceContentHash !== null && sourceContentHash !== expected.sourceContentHash) {
      issues.push(error(`${path}.sourceContentHash`, 'Public knowledge URL report centralLibraryCandidate sourceContentHash must match report sourceContentHash.'));
    }
  }

  const { source: candidateSource, domain: candidateDomain } = validatePublicKnowledgeSource(value.source, `${path}.source`, issues);
  if (candidateDomain !== null && expected.domain !== null && candidateDomain !== expected.domain) {
    issues.push(error(`${path}.source.domain`, 'Public knowledge URL report centralLibraryCandidate source domain must match report domain.'));
  }
  if (candidateSource !== null && expected.source !== null) {
    for (const field of ['kind', 'name', 'provider', 'version', 'url'] as const) {
      if (
        expected.source[field] !== undefined
        && candidateSource[field] !== expected.source[field]
      ) {
        issues.push(error(`${path}.source.${field}`, `Public knowledge URL report centralLibraryCandidate source ${field} must match report source.`));
      }
    }
  }

  validatePublicKnowledgeQuality(value.quality, `${path}.quality`, issues);
  validatePublicKnowledgeQualityMatches(
    value.quality,
    `${path}.quality`,
    issues,
    expected.quality,
    'Public knowledge URL report centralLibraryCandidate'
  );

  const unitCount = readNonNegativeInteger(value.unitCount, `${path}.unitCount`, issues);
  if (unitCount !== null && unitCount !== expected.unitCount) {
    issues.push(error(`${path}.unitCount`, 'Public knowledge URL report centralLibraryCandidate unitCount must match selected units.'));
  }
  const unitCounts = validatePublicKnowledgeUnitCounts(value.unitCounts, `${path}.unitCounts`, issues);
  if (unitCounts !== null) {
    for (const unitType of KNOWLEDGE_UNIT_TYPES) {
      if (unitCounts[unitType] !== expected.unitCounts[unitType]) {
        issues.push(error(`${path}.unitCounts.${unitType}`, 'Public knowledge URL report centralLibraryCandidate unitCounts must match selected units.'));
      }
    }
  }
  if (value.unitRef !== 'report.unitsByType') {
    issues.push(error(`${path}.unitRef`, 'Public knowledge URL report centralLibraryCandidate unitRef must point to report.unitsByType.'));
  }

  const classification = validatePublicKnowledgeClassification(value.classification, `${path}.classification`, issues);
  if (expected.domain !== null && classification.ecosystem !== null && expected.domain !== classification.ecosystem) {
    issues.push(error(`${path}.classification.ecosystem`, 'Public knowledge URL report centralLibraryCandidate classification ecosystem must match report domain.'));
  }
  if (
    expected.source !== null
    && classification.sourceName !== null
    && expected.source.name !== classification.sourceName
  ) {
    issues.push(error(`${path}.classification.sourceName`, 'Public knowledge URL report centralLibraryCandidate classification sourceName must match report source name.'));
  }
  if (
    expected.source !== null
    && classification.providerAddress !== null
    && expected.source.provider !== undefined
    && expected.source.provider !== classification.providerAddress
  ) {
    issues.push(error(`${path}.classification.providerAddress`, 'Public knowledge URL report centralLibraryCandidate classification providerAddress must match report source provider.'));
  }
  if (
    expected.source !== null
    && classification.version !== null
    && expected.source.version !== undefined
    && expected.source.version !== classification.version
  ) {
    issues.push(error(`${path}.classification.version`, 'Public knowledge URL report centralLibraryCandidate classification version must match report source version.'));
  }

  validatePublicKnowledgeLlmRefinementInput(value.llmRefinementInput, `${path}.llmRefinementInput`, issues, {
    sourceId: expected.sourceId,
    sourceContentHash: expected.sourceContentHash,
    classification,
    download: expected.download,
    quality: expected.quality,
    unitCount: expected.unitCount,
    unitCounts: expected.unitCounts,
    missingUnitTypes: expected.missingUnitTypes,
    compactByteLength: expected.compactByteLength
  });

  return classification;
}

function validatePublicKnowledgeUrlReportPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];

  validateNoRawContentKeys(payload, '$', issues);

  if (payload.schemaVersion !== 1) {
    issues.push(error('$.schemaVersion', 'Public knowledge URL report schemaVersion must be 1.'));
  }
  if (payload.mutationAllowed !== false) {
    issues.push(error('$.mutationAllowed', 'Public knowledge URL report mutationAllowed must be false.'));
  }

  const sourceUrl = readNonEmptyString(payload.sourceUrl, '$.sourceUrl', issues);
  if (sourceUrl !== null) {
    validateSecretSafeUrl(sourceUrl, '$.sourceUrl', issues);
    if (!isSecretSafeKnowledgeUrl(sourceUrl)) {
      issues.push(error('$.sourceUrl', 'Public knowledge URL report sourceUrl must be a secret-free http(s) URL without query or fragment.'));
    }
  }
  const domain = typeof payload.domain === 'string' ? payload.domain : null;
  if (domain === null || !INFRA_DOMAINS.includes(domain as typeof INFRA_DOMAINS[number])) {
    issues.push(error('$.domain', 'Public knowledge URL report domain must be supported.'));
  }
  const source = validateKnowledgeUnitSource(payload.source, '$.source', issues);
  if (sourceUrl !== null && source?.url !== undefined && source.url !== sourceUrl) {
    issues.push(error('$.source.url', 'Public knowledge URL report source url must match sourceUrl.'));
  }

  const sourceId = readNonEmptyString(payload.sourceId, '$.sourceId', issues);
  if (sourceId !== null && source !== null && sourceId !== buildKnowledgeCacheId(source)) {
    issues.push(error('$.sourceId', 'Public knowledge URL report sourceId must match source.'));
  }
  const sourceContentHash = readNonEmptyString(payload.sourceContentHash, '$.sourceContentHash', issues);
  if (sourceContentHash !== null && !SHA256_HEX_PATTERN.test(sourceContentHash)) {
    issues.push(error('$.sourceContentHash', 'Public knowledge URL report sourceContentHash must be a SHA-256 hex string.'));
  }
  validateIsoDateString(payload.fetchedAt, '$.fetchedAt', issues);
  readBoolean(payload.sourceStale, '$.sourceStale', issues);
  validatePublicKnowledgeDownloadSummary(payload.download, '$.download', issues);
  const maxUnits = readPositiveInteger(payload.maxUnits, '$.maxUnits', issues);
  validatePublicKnowledgeQuality(payload.quality, '$.quality', issues);

  const {
    actualUnitCount,
    actualCounts,
    actualCompactByteLength
  } = validateCompactPublicKnowledgeUnits(
    payload.unitsByType,
    '$.unitsByType',
    sourceId,
    issues,
    'Public knowledge URL report'
  );
  const expectedIncludedUnitTypes = KNOWLEDGE_UNIT_TYPES.filter(unitType => actualCounts[unitType] > 0);
  const expectedMissingUnitTypes = KNOWLEDGE_UNIT_TYPES.filter(unitType => actualCounts[unitType] === 0);

  let summaryUnitCount: number | null = null;
  let summaryIncludedUnitCount: number | null = null;
  if (!isRecord(payload.summary)) {
    issues.push(error('$.summary', 'Public knowledge URL report summary must be an object.'));
  } else {
    const factCount = readNonNegativeInteger(payload.summary.factCount, '$.summary.factCount', issues);
    if (factCount !== null && factCount < actualCounts.fact) {
      issues.push(error('$.summary.factCount', 'Public knowledge URL report summary factCount must cover selected fact units.'));
    }
    summaryUnitCount = readNonNegativeInteger(payload.summary.unitCount, '$.summary.unitCount', issues);
    if (summaryUnitCount !== null && summaryUnitCount < actualUnitCount) {
      issues.push(error('$.summary.unitCount', 'Public knowledge URL report summary unitCount must not be less than selected units.'));
    }
    summaryIncludedUnitCount = readNonNegativeInteger(payload.summary.includedUnitCount, '$.summary.includedUnitCount', issues);
    if (summaryIncludedUnitCount !== null && summaryIncludedUnitCount !== actualUnitCount) {
      issues.push(error('$.summary.includedUnitCount', 'Public knowledge URL report summary includedUnitCount must match selected units.'));
    }
    const omittedUnitCount = readNonNegativeInteger(payload.summary.omittedUnitCount, '$.summary.omittedUnitCount', issues);
    if (
      omittedUnitCount !== null
      && summaryUnitCount !== null
      && omittedUnitCount !== Math.max(0, summaryUnitCount - actualUnitCount)
    ) {
      issues.push(error('$.summary.omittedUnitCount', 'Public knowledge URL report summary omittedUnitCount must match unitCount - selected units.'));
    }
    const unitCounts = validatePublicKnowledgeUnitCounts(payload.summary.unitCounts, '$.summary.unitCounts', issues);
    if (unitCounts !== null) {
      for (const unitType of KNOWLEDGE_UNIT_TYPES) {
        if (unitCounts[unitType] !== actualCounts[unitType]) {
          issues.push(error(`$.summary.unitCounts.${unitType}`, 'Public knowledge URL report summary unitCounts must match unitsByType.'));
        }
      }
    }
    const includedUnitTypes = readStringArray(payload.summary.includedUnitTypes, '$.summary.includedUnitTypes', issues);
    if (includedUnitTypes !== null && !stringArraysEqual(includedUnitTypes, expectedIncludedUnitTypes)) {
      issues.push(error('$.summary.includedUnitTypes', 'Public knowledge URL report summary includedUnitTypes must match non-empty unit groups in canonical order.'));
    }
    const missingUnitTypes = readStringArray(payload.summary.missingUnitTypes, '$.summary.missingUnitTypes', issues);
    if (missingUnitTypes !== null && !stringArraysEqual(missingUnitTypes, expectedMissingUnitTypes)) {
      issues.push(error('$.summary.missingUnitTypes', 'Public knowledge URL report summary missingUnitTypes must match empty unit groups in canonical order.'));
    }
    const unitTypeComplete = readBoolean(payload.summary.unitTypeComplete, '$.summary.unitTypeComplete', issues);
    if (unitTypeComplete !== null && unitTypeComplete !== (expectedMissingUnitTypes.length === 0)) {
      issues.push(error('$.summary.unitTypeComplete', 'Public knowledge URL report summary unitTypeComplete must match missingUnitTypes.'));
    }
    if (isRecord(payload.quality)) {
      if (payload.summary.qualityStatus !== payload.quality.status) {
        issues.push(error('$.summary.qualityStatus', 'Public knowledge URL report summary qualityStatus must match quality.status.'));
      }
      if (payload.summary.qualityScore !== payload.quality.score) {
        issues.push(error('$.summary.qualityScore', 'Public knowledge URL report summary qualityScore must match quality.score.'));
      }
      const qualityWarnings = readStringArray(payload.summary.qualityWarnings, '$.summary.qualityWarnings', issues);
      const expectedWarnings = Array.isArray(payload.quality.warnings)
        ? payload.quality.warnings.filter((entry): entry is string => typeof entry === 'string')
        : [];
      if (qualityWarnings !== null && !stringArraysEqual(qualityWarnings, expectedWarnings)) {
        issues.push(error('$.summary.qualityWarnings', 'Public knowledge URL report summary qualityWarnings must match quality.warnings.'));
      }
    }
    const compactByteLength = readNonNegativeInteger(payload.summary.compactByteLength, '$.summary.compactByteLength', issues);
    if (
      compactByteLength !== null
      && actualCompactByteLength !== null
      && compactByteLength !== actualCompactByteLength
    ) {
      issues.push(error('$.summary.compactByteLength', 'Public knowledge URL report summary compactByteLength must match unitsByType JSON length.'));
    }
  }

  if (maxUnits !== null && actualUnitCount > maxUnits) {
    issues.push(error('$.maxUnits', 'Public knowledge URL report maxUnits must be at least the selected unit count.'));
  }

  const classification = validatePublicKnowledgeCentralLibraryCandidate(
    payload.centralLibraryCandidate,
    '$.centralLibraryCandidate',
    issues,
    {
      domain,
      source,
      sourceId,
      sourceContentHash,
      maxUnits,
      download: payload.download,
      quality: payload.quality,
      unitCount: actualUnitCount,
      unitCounts: actualCounts,
      missingUnitTypes: expectedMissingUnitTypes,
      compactByteLength: actualCompactByteLength
    }
  );
  if (
    sourceUrl !== null
    && isRecord(payload.centralLibraryCandidate)
    && isRecord(payload.centralLibraryCandidate.source)
    && typeof payload.centralLibraryCandidate.source.url === 'string'
    && payload.centralLibraryCandidate.source.url !== sourceUrl
  ) {
    issues.push(error('$.centralLibraryCandidate.source.url', 'Public knowledge URL report centralLibraryCandidate source url must match sourceUrl.'));
  }
  if (domain !== null && classification.ecosystem !== null && domain !== classification.ecosystem) {
    issues.push(error('$.domain', 'Public knowledge URL report domain must match central library classification ecosystem.'));
  }

  return createReport(
    inputPath,
    inputKind,
    issues,
    [],
    {},
    {
      staleSourceIds: new Set(),
      uncheckedLocalSourceCount: 0,
      staleSourceDetails: [],
      uncheckedLocalSourceDetails: []
    },
    {
      factSetCount: 0,
      factCount: actualCounts.fact,
      unitSetCount: 1,
      unitCount: summaryIncludedUnitCount ?? actualUnitCount,
      staleSourceCount: 0
    }
  );
}

function validateNoRawContentKeys(value: unknown, path: string, issues: KnowledgeValidationIssue[]): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateNoRawContentKeys(entry, `${path}[${index}]`, issues));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    const entryPath = path === '$' ? `$.${key}` : `${path}.${key}`;
    if (key === 'content' || key === 'rawContent') {
      issues.push(error(entryPath, 'Public knowledge library artifact must not embed raw source content.'));
      continue;
    }
    validateNoRawContentKeys(entry, entryPath, issues);
  }
}

function validatePublicKnowledgeLibraryArtifactPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];

  validateNoRawContentKeys(payload, '$', issues);

  if (payload.schemaVersion !== 1) {
    issues.push(error('$.schemaVersion', 'Public knowledge library artifact schemaVersion must be 1.'));
  }
  if (payload.mutationAllowed !== false) {
    issues.push(error('$.mutationAllowed', 'Public knowledge library artifact mutationAllowed must be false.'));
  }
  if (payload.storageScope !== 'public-reference') {
    issues.push(error('$.storageScope', 'Public knowledge library artifact storageScope must be public-reference.'));
  }
  if (payload.privacyScope !== 'public-reference') {
    issues.push(error('$.privacyScope', 'Public knowledge library artifact privacyScope must be public-reference.'));
  }
  if (payload.generatedFromReportKind !== 'infra-agent.public-knowledge-url-report') {
    issues.push(error('$.generatedFromReportKind', 'Public knowledge library artifact must be generated from a public knowledge URL report.'));
  }

  if (typeof payload.artifactId !== 'string' || !PACK_ID_PATTERN.test(payload.artifactId)) {
    issues.push(error('$.artifactId', 'Public knowledge library artifact artifactId must be a 24-character hex string.'));
  }
  const coordinates = readNonEmptyString(payload.coordinates, '$.coordinates', issues);
  if (coordinates !== null) {
    validateNoSecretLikeValue(coordinates, '$.coordinates', issues);
  }
  const sourceId = readNonEmptyString(payload.sourceId, '$.sourceId', issues);
  const sourceContentHash = readNonEmptyString(payload.sourceContentHash, '$.sourceContentHash', issues);
  if (sourceContentHash !== null && !SHA256_HEX_PATTERN.test(sourceContentHash)) {
    issues.push(error('$.sourceContentHash', 'Public knowledge library artifact sourceContentHash must be a SHA-256 hex string.'));
  }

  const { source, domain } = validatePublicKnowledgeSource(payload.source, '$.source', issues);
  if (sourceId !== null && source !== null && sourceId !== buildKnowledgeCacheId(source)) {
    issues.push(error('$.sourceId', 'Public knowledge library artifact sourceId must match source.'));
  }

  const classification = validatePublicKnowledgeClassification(payload.classification, '$.classification', issues);
  if (coordinates !== null && classification.coordinates !== null && coordinates !== classification.coordinates) {
    issues.push(error('$.coordinates', 'Public knowledge library artifact coordinates must match classification.coordinates.'));
  }
  if (domain !== null && classification.ecosystem !== null && domain !== classification.ecosystem) {
    issues.push(error('$.source.domain', 'Public knowledge library artifact source domain must match classification ecosystem.'));
  }
  if (isRecord(payload.source)) {
    if (
      classification.sourceName !== null
      && typeof payload.source.name === 'string'
      && payload.source.name !== classification.sourceName
    ) {
      issues.push(error('$.source.name', 'Public knowledge library artifact source name must match classification sourceName.'));
    }
    if (
      classification.providerAddress !== null
      && typeof payload.source.provider === 'string'
      && payload.source.provider !== classification.providerAddress
    ) {
      issues.push(error('$.source.provider', 'Public knowledge library artifact source provider must match classification providerAddress.'));
    }
    if (
      classification.version !== null
      && typeof payload.source.version === 'string'
      && payload.source.version !== classification.version
    ) {
      issues.push(error('$.source.version', 'Public knowledge library artifact source version must match classification version.'));
    }
  }

  validatePublicKnowledgeDownloadSummary(payload.download, '$.download', issues);
  validatePublicKnowledgeQuality(payload.quality, '$.quality', issues);

  let actualUnitCount = 0;
  const actualCounts = emptyKnowledgeUnitCountByType();
  const sourceIds = new Set<string>();
  if (sourceId !== null) {
    sourceIds.add(sourceId);
  }

  if (!isRecord(payload.unitsByType)) {
    issues.push(error('$.unitsByType', 'Public knowledge library artifact unitsByType must be an object.'));
  } else {
    const keys = new Set(Object.keys(payload.unitsByType));
    for (const unitType of KNOWLEDGE_UNIT_TYPES) {
      keys.delete(unitType);
      const groupedUnits = payload.unitsByType[unitType];
      if (!Array.isArray(groupedUnits)) {
        issues.push(error(`$.unitsByType.${unitType}`, 'Public knowledge library artifact unit group must be an array.'));
        continue;
      }
      for (const [index, unit] of groupedUnits.entries()) {
        const unitPath = `$.unitsByType.${unitType}[${index}]`;
        const validated = validateKnowledgePackUnit(unit, unitPath, sourceIds, issues);
        if (isRecord(unit)) {
          if (Object.hasOwn(unit, 'source')) {
            issues.push(error(`${unitPath}.source`, 'Public knowledge library artifact compact units must not embed full source objects.'));
          }
          if (unit.unitType !== unitType) {
            issues.push(error(`${unitPath}.unitType`, 'Public knowledge library artifact compact unitType must match its unit group.'));
          }
          if (unit.privacyScope !== 'public-reference') {
            issues.push(error(`${unitPath}.privacyScope`, 'Public knowledge library artifact units must remain public-reference.'));
          }
        }
        if (validated !== null) {
          actualCounts[validated.unitType] += 1;
          actualUnitCount += 1;
        }
      }
    }
    for (const extraKey of keys) {
      issues.push(error(`$.unitsByType.${extraKey}`, 'Public knowledge library artifact unitsByType must only include supported unit types.'));
    }
  }

  const unitPayloadHash = readNonEmptyString(payload.unitPayloadHash, '$.unitPayloadHash', issues);
  if (unitPayloadHash !== null) {
    if (!SHA256_HEX_PATTERN.test(unitPayloadHash)) {
      issues.push(error('$.unitPayloadHash', 'Public knowledge library artifact unitPayloadHash must be a SHA-256 hex string.'));
    } else if (isRecord(payload.unitsByType) && unitPayloadHash !== sha256Hex(JSON.stringify(payload.unitsByType))) {
      issues.push(error('$.unitPayloadHash', 'Public knowledge library artifact unitPayloadHash must match unitsByType.'));
    }
  }

  let actualCompactByteLength: number | null = null;
  if (!isRecord(payload.summary)) {
    issues.push(error('$.summary', 'Public knowledge library artifact summary must be an object.'));
  } else {
    const summaryUnitCount = readNonNegativeInteger(payload.summary.unitCount, '$.summary.unitCount', issues);
    if (summaryUnitCount !== null && summaryUnitCount !== actualUnitCount) {
      issues.push(error('$.summary.unitCount', 'Public knowledge library artifact summary unitCount must match selected units.'));
    }
    const declaredCounts = validatePublicKnowledgeUnitCounts(payload.summary.unitCounts, '$.summary.unitCounts', issues);
    if (declaredCounts !== null) {
      for (const unitType of KNOWLEDGE_UNIT_TYPES) {
        if (declaredCounts[unitType] !== actualCounts[unitType]) {
          issues.push(error(`$.summary.unitCounts.${unitType}`, 'Public knowledge library artifact summary unitCounts must match unitsByType.'));
        }
      }
    }
    const includedUnitTypes = readStringArray(payload.summary.includedUnitTypes, '$.summary.includedUnitTypes', issues);
    if (includedUnitTypes !== null) {
      const expectedIncludedUnitTypes = KNOWLEDGE_UNIT_TYPES.filter(unitType => actualCounts[unitType] > 0);
      if (includedUnitTypes.join(',') !== expectedIncludedUnitTypes.join(',')) {
        issues.push(error('$.summary.includedUnitTypes', 'Public knowledge library artifact includedUnitTypes must match non-empty unit groups in canonical order.'));
      }
    }
    const compactByteLength = readNonNegativeInteger(payload.summary.compactByteLength, '$.summary.compactByteLength', issues);
    if (isRecord(payload.unitsByType)) {
      actualCompactByteLength = JSON.stringify(payload.unitsByType).length;
      if (compactByteLength !== null && compactByteLength !== actualCompactByteLength) {
        issues.push(error('$.summary.compactByteLength', 'Public knowledge library artifact compactByteLength must match unitsByType JSON length.'));
      }
    }
  }

  validatePublicKnowledgeLlmRefinementInput(payload.llmRefinementInput, '$.llmRefinementInput', issues, {
    sourceId,
    sourceContentHash,
    classification,
    download: payload.download,
    quality: payload.quality,
    unitCount: actualUnitCount,
    unitCounts: actualCounts,
    missingUnitTypes: KNOWLEDGE_UNIT_TYPES.filter(unitType => actualCounts[unitType] === 0),
    compactByteLength: actualCompactByteLength
  });

  if (!isRecord(payload.publication)) {
    issues.push(error('$.publication', 'Public knowledge library artifact publication must be an object.'));
  } else {
    if (payload.publication.status !== 'local-artifact') {
      issues.push(error('$.publication.status', 'Public knowledge library artifact publication status must be local-artifact.'));
    }
    if (payload.publication.downloadable !== true) {
      issues.push(error('$.publication.downloadable', 'Public knowledge library artifact must be marked downloadable.'));
    }
    if (payload.publication.uploadRequired !== false) {
      issues.push(error('$.publication.uploadRequired', 'Public knowledge library artifact must not require upload.'));
    }
    if (payload.publication.reviewRequired !== true) {
      issues.push(error('$.publication.reviewRequired', 'Public knowledge library artifact must require review before publication.'));
    }
  }

  return createReport(
    inputPath,
    inputKind,
    issues,
    [],
    {},
    {
      staleSourceIds: new Set(),
      uncheckedLocalSourceCount: 0,
      staleSourceDetails: [],
      uncheckedLocalSourceDetails: []
    },
    {
      factSetCount: 0,
      factCount: actualCounts.fact,
      unitSetCount: 1,
      unitCount: actualUnitCount,
      staleSourceCount: 0
    }
  );
}

function validatePublicKnowledgeLibraryRegistryPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  let totalUnitCount = 0;

  validateNoRawContentKeys(payload, '$', issues);

  if (payload.schemaVersion !== 1) {
    issues.push(error('$.schemaVersion', 'Public knowledge library registry schemaVersion must be 1.'));
  }
  if (payload.mutationAllowed !== false) {
    issues.push(error('$.mutationAllowed', 'Public knowledge library registry mutationAllowed must be false.'));
  }
  if (!Array.isArray(payload.entries)) {
    issues.push(error('$.entries', 'Public knowledge library registry entries must be an array.'));
  } else {
    const seenCoordinates = new Set<string>();
    payload.entries.forEach((entry, index) => {
      const path = `$.entries[${index}]`;
      if (!isRecord(entry)) {
        issues.push(error(path, 'Public knowledge library registry entry must be an object.'));
        return;
      }

      const coordinates = readNonEmptyString(entry.coordinates, `${path}.coordinates`, issues);
      if (coordinates !== null) {
        validateNoSecretLikeValue(coordinates, `${path}.coordinates`, issues);
        if (FULL_URL_PATTERN.test(coordinates)) {
          issues.push(error(`${path}.coordinates`, 'Public knowledge library registry coordinates must not contain URLs.'));
        }
        if (seenCoordinates.has(coordinates)) {
          issues.push(error(`${path}.coordinates`, 'Public knowledge library registry coordinates must be unique.'));
        }
        seenCoordinates.add(coordinates);
      }

      if (entry.ecosystem !== 'terraform') {
        issues.push(error(`${path}.ecosystem`, 'Public knowledge library registry entry ecosystem must be terraform.'));
      }
      if (
        typeof entry.artifactKind !== 'string'
        || !PUBLIC_LIBRARY_ARTIFACT_KINDS.includes(entry.artifactKind as typeof PUBLIC_LIBRARY_ARTIFACT_KINDS[number])
      ) {
        issues.push(error(`${path}.artifactKind`, 'Public knowledge library registry entry artifactKind must be supported.'));
      }
      const providerAddress = readNonEmptyString(entry.providerAddress, `${path}.providerAddress`, issues);
      if (providerAddress !== null) {
        validateNoSecretLikeValue(providerAddress, `${path}.providerAddress`, issues);
      }
      const version = readNonEmptyString(entry.version, `${path}.version`, issues);
      validatePublicKnowledgeVersionRef(entry.versionRef, `${path}.versionRef`, issues, version);
      const sourceName = readNonEmptyString(entry.sourceName, `${path}.sourceName`, issues);
      if (sourceName !== null) {
        validateNoSecretLikeValue(sourceName, `${path}.sourceName`, issues);
        if (
          entry.artifactKind === 'terraform-provider-resource'
          && !sourceName.startsWith('resource:')
        ) {
          issues.push(error(`${path}.sourceName`, 'Terraform resource public library entries must use a resource: sourceName.'));
        }
        if (
          entry.artifactKind === 'terraform-provider-data-source'
          && !sourceName.startsWith('data-source:')
        ) {
          issues.push(error(`${path}.sourceName`, 'Terraform data-source public library entries must use a data-source: sourceName.'));
        }
      }

      if (
        coordinates !== null
        && providerAddress !== null
        && version !== null
        && sourceName !== null
        && (
          entry.artifactKind === 'terraform-provider-resource'
          || entry.artifactKind === 'terraform-provider-data-source'
        )
      ) {
        const typeName = sourceName.split(':')[1] ?? '';
        const kindSegment = entry.artifactKind === 'terraform-provider-resource'
          ? 'resource'
          : 'data-source';
        const expectedCoordinates = `terraform/provider/${providerAddress}/${version}/${kindSegment}/${typeName}`;
        if (coordinates !== expectedCoordinates) {
          issues.push(error(`${path}.coordinates`, 'Public knowledge library registry coordinates must match provider, version, artifactKind, and sourceName.'));
        }
      }

      const tags = readStringArray(entry.tags, `${path}.tags`, issues);
      if (tags !== null) {
        tags.forEach((tag, tagIndex) => {
          validateNoSecretLikeValue(tag, `${path}.tags[${tagIndex}]`, issues);
          if (FULL_URL_PATTERN.test(tag)) {
            issues.push(error(`${path}.tags[${tagIndex}]`, 'Public knowledge library registry tags must not contain URLs.'));
          }
        });
      }

      if (!isRecord(entry.artifact)) {
        issues.push(error(`${path}.artifact`, 'Public knowledge library registry entry artifact must be an object.'));
        return;
      }

      const artifactPath = typeof entry.artifact.path === 'string' && isSafeWorkspaceRelativePath(entry.artifact.path);
      const artifactUrl = typeof entry.artifact.url === 'string' && isSecretSafeKnowledgeUrl(entry.artifact.url);
      if (artifactPath === artifactUrl) {
        issues.push(error(`${path}.artifact`, 'Public knowledge library registry artifact must use exactly one safe path or secret-free url.'));
      }
      if (typeof entry.artifact.path === 'string' && !artifactPath) {
        issues.push(error(`${path}.artifact.path`, 'Public knowledge library registry artifact path must be safe and workspace-relative.'));
      }
      if (typeof entry.artifact.url === 'string' && !artifactUrl) {
        issues.push(error(`${path}.artifact.url`, 'Public knowledge library registry artifact url must be secret-free http(s) without query or fragment.'));
      }
      if (typeof entry.artifact.contentHash !== 'string' || !SHA256_HEX_PATTERN.test(entry.artifact.contentHash)) {
        issues.push(error(`${path}.artifact.contentHash`, 'Public knowledge library registry artifact contentHash must be a SHA-256 hex string.'));
      }
      if (entry.artifact.mediaType !== PUBLIC_LIBRARY_ARTIFACT_MEDIA_TYPE) {
        issues.push(error(`${path}.artifact.mediaType`, 'Public knowledge library registry artifact mediaType must be the public library artifact media type.'));
      }
      if (typeof entry.artifact.artifactId !== 'string' || !PACK_ID_PATTERN.test(entry.artifact.artifactId)) {
        issues.push(error(`${path}.artifact.artifactId`, 'Public knowledge library registry artifact artifactId must be a 24-character hex string.'));
      }
      if (typeof entry.artifact.unitPayloadHash !== 'string' || !SHA256_HEX_PATTERN.test(entry.artifact.unitPayloadHash)) {
        issues.push(error(`${path}.artifact.unitPayloadHash`, 'Public knowledge library registry artifact unitPayloadHash must be a SHA-256 hex string.'));
      }
      if (typeof entry.artifact.sourceContentHash !== 'string' || !SHA256_HEX_PATTERN.test(entry.artifact.sourceContentHash)) {
        issues.push(error(`${path}.artifact.sourceContentHash`, 'Public knowledge library registry artifact sourceContentHash must be a SHA-256 hex string.'));
      }
      const unitCount = readPositiveInteger(entry.artifact.unitCount, `${path}.artifact.unitCount`, issues);
      if (unitCount !== null) {
        totalUnitCount += unitCount;
      }
      validatePublicKnowledgeVersionRef(entry.artifact.versionRef, `${path}.artifact.versionRef`, issues, version);
      if (
        typeof entry.artifact.qualityStatus !== 'string'
        || !PUBLIC_KNOWLEDGE_QUALITY_STATUSES.includes(entry.artifact.qualityStatus as typeof PUBLIC_KNOWLEDGE_QUALITY_STATUSES[number])
      ) {
        issues.push(error(`${path}.artifact.qualityStatus`, 'Public knowledge library registry artifact qualityStatus must be supported.'));
      }
      if (entry.artifact.reviewRequired !== true) {
        issues.push(error(`${path}.artifact.reviewRequired`, 'Public knowledge library registry artifact must require review.'));
      }
    });
  }

  return createReport(
    inputPath,
    inputKind,
    issues,
    [],
    {},
    {
      staleSourceIds: new Set(),
      uncheckedLocalSourceCount: 0,
      staleSourceDetails: [],
      uncheckedLocalSourceDetails: []
    },
    {
      factSetCount: 0,
      factCount: 0,
      unitSetCount: 0,
      unitCount: totalUnitCount,
      staleSourceCount: 0
    }
  );
}

function validateKnowledgeArtifactManifestPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];

  if (payload.schemaVersion !== 1) {
    issues.push(error('$.schemaVersion', 'Knowledge artifact manifest schemaVersion must be 1.'));
  }
  if (payload.mutationAllowed !== false) {
    issues.push(error('$.mutationAllowed', 'Knowledge artifact manifest mutationAllowed must be false.'));
  }
  if (typeof payload.manifestId !== 'string' || !MANIFEST_ID_PATTERN.test(payload.manifestId)) {
    issues.push(error('$.manifestId', 'Knowledge artifact manifest manifestId must be a 24-character hex string.'));
  }
  validateIsoDateString(payload.createdAt, '$.createdAt', issues);

  let sourceCount: number | null = null;
  let factCount: number | null = null;
  let unitCount: number | null = null;
  let staleSourceCount: number | null = null;
  let storagePolicySummary: KnowledgeStoragePolicySummary | null = null;
  let sourceIds: string[] | null = null;

  if (!isRecord(payload.artifact)) {
    issues.push(error('$.artifact', 'Knowledge artifact manifest artifact must be an object.'));
  } else {
    if (
      payload.artifact.kind !== 'infra-agent.knowledge-extraction'
      && payload.artifact.kind !== 'infra-agent.knowledge-pack'
    ) {
      issues.push(error('$.artifact.kind', 'Knowledge artifact manifest artifact kind must be supported.'));
    }
    readNonEmptyString(payload.artifact.id, '$.artifact.id', issues);
    readNonEmptyString(payload.artifact.path, '$.artifact.path', issues);
    if (typeof payload.artifact.sha256 !== 'string' || !SHA256_HEX_PATTERN.test(payload.artifact.sha256)) {
      issues.push(error('$.artifact.sha256', 'Knowledge artifact manifest artifact sha256 must be a SHA-256 hex string.'));
    }
    sourceIds = readStringArray(payload.artifact.sourceIds, '$.artifact.sourceIds', issues);
    if (sourceIds !== null) {
      const uniqueSourceIds = new Set(sourceIds);
      if (uniqueSourceIds.size !== sourceIds.length) {
        issues.push(error('$.artifact.sourceIds', 'Knowledge artifact manifest sourceIds must be unique.'));
      }
    }
    readNonEmptyString(payload.artifact.workspaceRoot, '$.artifact.workspaceRoot', issues);
    readNonEmptyString(payload.artifact.cacheRoot, '$.artifact.cacheRoot', issues);
    sourceCount = readNonNegativeInteger(payload.artifact.sourceCount, '$.artifact.sourceCount', issues);
    factCount = readNonNegativeInteger(payload.artifact.factCount, '$.artifact.factCount', issues);
    if (payload.artifact.unitCount !== undefined) {
      unitCount = readNonNegativeInteger(payload.artifact.unitCount, '$.artifact.unitCount', issues);
    }
    staleSourceCount = readNonNegativeInteger(payload.artifact.staleSourceCount, '$.artifact.staleSourceCount', issues);
    storagePolicySummary = validateKnowledgeStoragePolicySummary(
      payload.artifact.storagePolicy,
      '$.artifact.storagePolicy',
      issues
    );
    if (sourceIds !== null && sourceCount !== null && sourceIds.length !== sourceCount) {
      issues.push(error('$.artifact.sourceIds', 'Knowledge artifact manifest sourceIds length must match sourceCount.'));
    }
  }

  if (!isRecord(payload.publication)) {
    issues.push(error('$.publication', 'Knowledge artifact manifest publication must be an object.'));
  } else {
    if (payload.publication.executionMode !== 'plan-only') {
      issues.push(error('$.publication.executionMode', 'Knowledge artifact manifest publication must use plan-only execution.'));
    }
    if (payload.publication.remoteWriteAllowed !== false) {
      issues.push(error('$.publication.remoteWriteAllowed', 'Knowledge artifact manifest must not allow remote writes.'));
    }
    if (payload.publication.credentialRequired !== false) {
      issues.push(error('$.publication.credentialRequired', 'Knowledge artifact manifest must not require credentials.'));
    }
    if (payload.publication.uploadCommand !== null) {
      issues.push(error('$.publication.uploadCommand', 'Knowledge artifact manifest must not include an upload command.'));
    }
    if (
      typeof payload.publication.defaultStore !== 'string'
      || !KNOWLEDGE_STORAGE_DEFAULTS.includes(payload.publication.defaultStore as KnowledgeStorageDefault)
    ) {
      issues.push(error('$.publication.defaultStore', 'Knowledge artifact manifest publication defaultStore must be supported.'));
    }
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
    const requiredValidations = readStringArray(
      payload.publication.requiredValidations,
      '$.publication.requiredValidations',
      issues
    );
    if (
      requiredValidations !== null
      && !requiredValidations.some(command => command.includes('knowledge validate'))
    ) {
      issues.push(error('$.publication.requiredValidations', 'Knowledge artifact manifest must require knowledge validate before publication.'));
    }
    readNonEmptyString(payload.publication.reason, '$.publication.reason', issues);

    const publishableIds = readStringArray(
      payload.publication.publishableByDefaultSourceIds,
      '$.publication.publishableByDefaultSourceIds',
      issues
    );
    if (publishableIds !== null && sourceIds !== null) {
      const sourceIdSet = new Set(sourceIds);
      for (const [index, sourceId] of publishableIds.entries()) {
        if (!sourceIdSet.has(sourceId)) {
          issues.push(error(`$.publication.publishableByDefaultSourceIds[${index}]`, 'Publishable source id must reference artifact.sourceIds.'));
        }
      }
    }
    if (!Array.isArray(payload.publication.blockedSources)) {
      issues.push(error('$.publication.blockedSources', 'Knowledge artifact manifest blockedSources must be an array.'));
    } else {
      const sourceIdSet = new Set(sourceIds ?? []);
      payload.publication.blockedSources.forEach((entry, index) => {
        const path = `$.publication.blockedSources[${index}]`;
        if (!isRecord(entry)) {
          issues.push(error(path, 'Knowledge artifact manifest blocked source must be an object.'));
          return;
        }
        const sourceId = readNonEmptyString(entry.sourceId, `${path}.sourceId`, issues);
        if (sourceId !== null && sourceIds !== null && !sourceIdSet.has(sourceId)) {
          issues.push(error(`${path}.sourceId`, 'Blocked source id must reference artifact.sourceIds.'));
        }
        if (typeof entry.storageScope !== 'string' || !KNOWLEDGE_STORAGE_SCOPES.includes(entry.storageScope as KnowledgeStorageScope)) {
          issues.push(error(`${path}.storageScope`, 'Blocked source storageScope must be supported.'));
        }
        readBoolean(entry.stale, `${path}.stale`, issues);
        if (
          typeof entry.reason !== 'string'
          || !KNOWLEDGE_ARTIFACT_BLOCK_REASONS.includes(entry.reason as typeof KNOWLEDGE_ARTIFACT_BLOCK_REASONS[number])
        ) {
          issues.push(error(`${path}.reason`, 'Blocked source reason must be supported.'));
        }
      });
    }

    if (storagePolicySummary !== null) {
      const hasPrivateSources = storagePolicySummary.explicitOptInRequired > 0;
      if (hasPrivateSources && requiresExplicitOptIn !== true) {
        issues.push(error('$.publication.requiresExplicitOptIn', 'Workspace-private artifact manifests must require explicit opt-in.'));
      }
      if (hasPrivateSources && shareableByDefault !== false) {
        issues.push(error('$.publication.shareableByDefault', 'Workspace-private artifact manifests must not be shareable by default.'));
      }
      if (hasPrivateSources && payload.publication.defaultStore !== 'local-only') {
        issues.push(error('$.publication.defaultStore', 'Workspace-private artifact manifests must default to local-only storage.'));
      }
      if (!hasPrivateSources && sourceCount !== null && sourceCount > 0 && payload.publication.defaultStore !== 'local-or-explicit-team-cache') {
        issues.push(error('$.publication.defaultStore', 'Public-reference artifact manifests must default to local or explicit team cache storage.'));
      }
    }
  }

  return createReport(
    inputPath,
    inputKind,
    issues,
    [],
    {},
    {
      staleSourceIds: new Set(),
      uncheckedLocalSourceCount: 0,
      staleSourceDetails: [],
      uncheckedLocalSourceDetails: []
    },
    {
      factSetCount: 0,
      factCount: factCount ?? 0,
      ...(unitCount !== null ? { unitCount } : {}),
      staleSourceCount: staleSourceCount ?? 0
    }
  );
}

async function validateLocalSourceFingerprints(
  factSets: ValidatedKnowledgeFactSet[],
  workspaceRoot: string | undefined,
  issues: KnowledgeValidationIssue[]
): Promise<LocalSourceValidationStats> {
  const stats: LocalSourceValidationStats = {
    staleSourceIds: new Set(),
    uncheckedLocalSourceCount: 0,
    staleSourceDetails: [],
    uncheckedLocalSourceDetails: []
  };

  for (const { factSet, path } of factSets) {
    if (factSet.sourceFingerprint === undefined) {
      continue;
    }

    if (workspaceRoot === undefined) {
      stats.uncheckedLocalSourceCount += 1;
      stats.uncheckedLocalSourceDetails.push(buildLocalSourceUncheckedDetail({
        sourceId: factSet.sourceId,
        sourceKind: factSet.source.kind,
        sourceName: factSet.source.name,
        factCount: factSet.factCount,
        path: `${path}.sourceFingerprint`,
        uncheckedReason: 'workspace-not-provided',
        fingerprint: factSet.sourceFingerprint
      }));
      issues.push(warning(
        `${path}.sourceFingerprint`,
        'Local source fingerprint was not rechecked because no workspace root was provided.'
      ));
      continue;
    }

    try {
      const check = await checkKnowledgeSourceFingerprint(workspaceRoot, factSet.sourceFingerprint);
      if (check.sourceStale) {
        stats.staleSourceIds.add(factSet.sourceId);
        stats.staleSourceDetails.push(buildLocalSourceStaleDetail({
          sourceId: factSet.sourceId,
          sourceKind: factSet.source.kind,
          sourceName: factSet.source.name,
          factCount: factSet.factCount,
          path: `${path}.sourceFingerprint`,
          fingerprint: factSet.sourceFingerprint,
          staleReason: check.sourceStaleReason ?? 'local-file-hash-mismatch',
          fileChecks: check.fileChecks
        }));
        issues.push(error(
          `${path}.sourceFingerprint`,
          `Local source fingerprint is stale: ${check.sourceStaleReason ?? 'local-file-hash-mismatch'}.`
        ));
      }
    } catch (validationError) {
      stats.staleSourceIds.add(factSet.sourceId);
      stats.staleSourceDetails.push({
        sourceId: factSet.sourceId,
        sourceKind: factSet.source.kind,
        sourceName: factSet.source.name,
        factCount: factSet.factCount,
        path: `${path}.sourceFingerprint`,
        staleReason: 'local-file-hash-mismatch',
        stalePaths: [],
        missingPaths: [],
        fingerprintDigest: factSet.sourceFingerprint.digest,
        fingerprintFileCount: factSet.sourceFingerprint.fileCount
      });
      issues.push(error(
        `${path}.sourceFingerprint`,
        validationError instanceof Error
          ? validationError.message
          : 'Local source fingerprint could not be rechecked.'
      ));
    }
  }

  return stats;
}

export function validateKnowledgePayload(payload: unknown, inputPath = 'inline'): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  const factSets: KnowledgeFactSet[] = [];

  if (!isRecord(payload)) {
    return createReport(inputPath, null, [error('$', 'Knowledge payload must be a JSON object.')], factSets);
  }

  const inputKind = typeof payload.kind === 'string' ? payload.kind : null;
  if (inputKind === 'infra-agent.knowledge-facts') {
    const factSet = validateFactSet(payload, '$', issues);
    if (factSet) {
      factSets.push(factSet);
    }
    return createReport(inputPath, inputKind, issues, factSets);
  }

  if (inputKind === 'infra-agent.knowledge-units') {
    return validateKnowledgeUnitSetPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-unit-index') {
    return validateKnowledgeUnitIndexPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-pack') {
    return validateKnowledgePackPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.public-knowledge-url-report') {
    return validatePublicKnowledgeUrlReportPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.public-knowledge-library-artifact') {
    return validatePublicKnowledgeLibraryArtifactPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.public-knowledge-library-registry') {
    return validatePublicKnowledgeLibraryRegistryPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-artifact-manifest') {
    return validateKnowledgeArtifactManifestPayload(payload, inputPath, inputKind);
  }

  if (inputKind !== 'infra-agent.knowledge-extraction') {
    return createReport(inputPath, inputKind, [error('$.kind', 'Unsupported knowledge payload kind.')], factSets);
  }

  if (payload.schemaVersion !== 1) {
    issues.push(error('$.schemaVersion', 'Knowledge extraction schemaVersion must be 1.'));
  }
  if (payload.mutationAllowed !== false) {
    issues.push(error('$.mutationAllowed', 'Knowledge extraction mutationAllowed must be false.'));
  }
  if (!Array.isArray(payload.factSets)) {
    issues.push(error('$.factSets', 'Knowledge extraction factSets must be an array.'));
  } else {
    payload.factSets.forEach((factSetPayload, index) => {
      const factSet = validateFactSet(factSetPayload, `$.factSets[${index}]`, issues);
      if (factSet) {
        factSets.push(factSet);
      }
    });

    if (payload.factSetCount !== payload.factSets.length) {
      issues.push(error('$.factSetCount', 'Knowledge extraction factSetCount must match factSets.length.'));
    }
  }

  if (Array.isArray(payload.sources) && payload.sourceCount !== payload.sources.length) {
    issues.push(error('$.sourceCount', 'Knowledge extraction sourceCount must match sources.length.'));
  }

  const declaredFactCount = typeof payload.factCount === 'number' ? payload.factCount : null;
  const actualFactCount = factSets.reduce((total, factSet) => total + factSet.factCount, 0);
  if (declaredFactCount !== actualFactCount) {
    issues.push(error('$.factCount', 'Knowledge extraction factCount must match the sum of fact set fact counts.'));
  }

  const factSetSourceIds = new Set(factSets.map(factSet => factSet.sourceId));
  const unitSets: KnowledgeUnitSet[] = [];
  if (payload.unitSets !== undefined) {
    if (!Array.isArray(payload.unitSets)) {
      issues.push(error('$.unitSets', 'Knowledge extraction unitSets must be an array when present.'));
    } else {
      payload.unitSets.forEach((unitSetPayload, index) => {
        const report = isRecord(unitSetPayload)
          ? validateKnowledgeUnitSetPayload(unitSetPayload, `$.unitSets[${index}]`, 'infra-agent.knowledge-units')
          : createReport(`$.unitSets[${index}]`, null, [error('$', 'Knowledge unit set must be an object.')], []);
        issues.push(...prefixValidationIssues(report.issues, `$.unitSets[${index}]`));

        if (report.valid && isRecord(unitSetPayload)) {
          unitSets.push(unitSetPayload as unknown as KnowledgeUnitSet);
          if (typeof unitSetPayload.sourceId === 'string' && !factSetSourceIds.has(unitSetPayload.sourceId)) {
            issues.push(error(`$.unitSets[${index}].sourceId`, 'Knowledge extraction unit set sourceId must reference an extracted fact set source.'));
          }
        }
      });

      if (payload.unitSetCount !== payload.unitSets.length) {
        issues.push(error('$.unitSetCount', 'Knowledge extraction unitSetCount must match unitSets.length.'));
      }
    }
  }

  const actualUnitSetCount = Array.isArray(payload.unitSets) ? payload.unitSets.length : unitSets.length;
  const actualUnitCount = unitSets.reduce((total, unitSet) => total + unitSet.unitCount, 0);
  if (payload.unitCount !== undefined) {
    const declaredUnitCount = readNonNegativeInteger(payload.unitCount, '$.unitCount', issues);
    if (declaredUnitCount !== null && declaredUnitCount !== actualUnitCount) {
      issues.push(error('$.unitCount', 'Knowledge extraction unitCount must match the sum of unit set unit counts.'));
    }
  }

  return createReport(
    inputPath,
    inputKind,
    issues,
    factSets,
    {},
    {
      staleSourceIds: new Set(),
      uncheckedLocalSourceCount: 0,
      staleSourceDetails: [],
      uncheckedLocalSourceDetails: []
    },
    {
      unitSetCount: payload.unitSets !== undefined ? actualUnitSetCount : undefined,
      unitCount: payload.unitCount !== undefined || payload.unitSets !== undefined ? actualUnitCount : undefined
    }
  );
}

export async function validateKnowledgePayloadWithLocalSources(
  payload: unknown,
  inputPath = 'inline',
  options: KnowledgeValidationOptions = {}
): Promise<KnowledgeValidationReport> {
  const report = validateKnowledgePayload(payload, inputPath);

  if (!isRecord(payload)) {
    return options.workspaceRoot === undefined
      ? report
      : { ...report, workspaceRoot: options.workspaceRoot };
  }

  if (payload.kind === 'infra-agent.knowledge-artifact-manifest') {
    const issues = [...report.issues];
    const countOverrides = await validateKnowledgeArtifactReference(
      payload,
      inputPath,
      options,
      issues,
      (artifactPayload, artifactPath, validationOptions) =>
        isRecord(artifactPayload) && artifactPayload.kind === 'infra-agent.knowledge-artifact-manifest'
          ? validateKnowledgePayload(artifactPayload, artifactPath)
          : validateKnowledgePayloadWithLocalSources(artifactPayload, artifactPath, validationOptions)
    );
    return createReport(
      inputPath,
      report.inputKind,
      issues,
      [],
      options,
      {
        staleSourceIds: new Set(),
        uncheckedLocalSourceCount: countOverrides.uncheckedLocalSourceCount ?? report.uncheckedLocalSourceCount,
        staleSourceDetails: [],
        uncheckedLocalSourceDetails: []
      },
      {
        factSetCount: countOverrides.factSetCount ?? report.factSetCount,
        factCount: countOverrides.factCount ?? report.factCount,
        unitSetCount: countOverrides.unitSetCount ?? report.unitSetCount,
        unitCount: countOverrides.unitCount ?? report.unitCount,
        staleSourceCount: countOverrides.staleSourceCount ?? report.staleSourceCount
      }
    );
  }

  const factSets: ValidatedKnowledgeFactSet[] = [];
  if (payload.kind === 'infra-agent.knowledge-facts') {
    const factSet = validateFactSet(payload, '$', []);
    if (factSet) {
      factSets.push({ path: '$', factSet });
    }
  } else if (payload.kind === 'infra-agent.knowledge-extraction' && Array.isArray(payload.factSets)) {
    payload.factSets.forEach((factSetPayload, index) => {
      const factSet = validateFactSet(factSetPayload, `$.factSets[${index}]`, []);
      if (factSet) {
        factSets.push({
          path: `$.factSets[${index}]`,
          factSet
        });
      }
    });
  }

  if (payload.kind === 'infra-agent.knowledge-pack' && Array.isArray(payload.sources)) {
    const sources: Array<Pick<KnowledgePackSource, 'id' | 'kind' | 'name' | 'factCount' | 'stale' | 'staleReason' | 'storagePolicy' | 'fingerprint'>> = [];
    payload.sources.forEach((source, index) => {
      const validated = validateKnowledgePackSource(source, `$.sources[${index}]`, []);
      if (validated) {
        sources.push(validated);
      }
    });
    const issues = [...report.issues];
    const localSourceStats = await validatePackSourceFingerprints(
      sources,
      options.workspaceRoot,
      issues
    );
    return createReport(
      inputPath,
      report.inputKind,
      issues,
      [],
      options,
      localSourceStats,
      {
        factSetCount: report.factSetCount,
        factCount: report.factCount,
        staleSourceCount: localSourceStats.staleSourceIds.size
      }
    );
  }

  if (factSets.length === 0 || options.workspaceRoot === undefined) {
    return options.workspaceRoot === undefined
      ? report
      : { ...report, workspaceRoot: options.workspaceRoot };
  }

  const issues = [...report.issues];
  const localSourceStats = await validateLocalSourceFingerprints(factSets, options.workspaceRoot, issues);
  return createReport(
    inputPath,
    report.inputKind,
    issues,
    factSets.map(factSet => factSet.factSet),
    options,
    localSourceStats
  );
}

export async function loadKnowledgeValidationReport(
  inputPath: string,
  baseDir: string,
  options: KnowledgeValidationOptions = {}
): Promise<KnowledgeValidationReport> {
  const resolvedPath = resolve(baseDir, inputPath);
  try {
    const payload = JSON.parse(await readFile(resolvedPath, 'utf8')) as unknown;
    return validateKnowledgePayloadWithLocalSources(payload, resolvedPath, options);
  } catch (loadError) {
    return createReport(resolvedPath, null, [error('$', loadError instanceof Error
      ? loadError.message
      : 'Knowledge payload could not be loaded.')], [], options);
  }
}
