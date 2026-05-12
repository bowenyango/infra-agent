import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildKnowledgeCacheId } from './cache.ts';
import { parseKnowledgeFactSet } from './facts-contract.ts';
import { checkKnowledgeSourceFingerprint } from './local-source-fingerprint.ts';
import type { KnowledgePackFact, KnowledgePackSource, KnowledgePackUnit } from './pack.ts';
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
  buildLocalSourceStaleDetail,
  buildLocalSourceUncheckedDetail,
  validateKnowledgeSourceFingerprintContract,
  validatePackSourceFingerprints,
  type LocalSourceValidationStats
} from './validation-source-fingerprints.ts';
import {
  validateKnowledgeTeamArtifactDescriptorPayload,
  validateKnowledgeTeamArtifactIndexEntryPayload,
  validateKnowledgeTeamPublicationPlanPayload,
  validateKnowledgeTeamPublicationReadinessPayload
} from './team-artifact-validation.ts';
import { validateKnowledgeStoragePolicySummary } from './storage-policy-validation.ts';
import { validateKnowledgeTeamBackendReadinessPayload } from './team-backend-readiness-validation.ts';
import {
  validateKnowledgeTeamUploadAdapterPreflightPayload,
  validateKnowledgeTeamUploadAdapterInjectionBoundaryPayload,
  validateKnowledgeTeamUploadApprovalContinuationPayload,
  validateKnowledgeTeamUploadApprovalIntentPayload,
  validateKnowledgeTeamUploadArtifactBytesBoundaryPayload,
  validateKnowledgeTeamUploadAuditRecordBoundaryPayload,
  validateKnowledgeTeamUploadClientCreationBoundaryPayload,
  validateKnowledgeTeamUploadCredentialPresenceBoundaryPayload,
  validateKnowledgeTeamUploadCredentialReadBoundaryPayload,
  validateKnowledgeTeamUploadCommandBoundaryPayload,
  validateKnowledgeTeamUploadExecutionAuthorizationBoundaryPayload,
  validateKnowledgeTeamUploadExecutionApprovalRecordPayload,
  validateKnowledgeTeamUploadExecutionApprovalRequestPayload,
  validateKnowledgeTeamUploadExecutionImplementationBoundaryPayload,
  validateKnowledgeTeamUploadExecutionPlanRulesReviewPayload,
  validateKnowledgeTeamUploadExecutionPlanRulesUpdateRecordPayload,
  validateKnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewPayload,
  validateKnowledgeTeamUploadExecutionRuntimeBoundariesPayload,
  validateKnowledgeTeamUploadExecutionReadinessBoundaryPayload,
  validateKnowledgeTeamUploadLiveCheckBoundaryPayload,
  validateKnowledgeTeamUploadObjectIndexBindingBoundaryPayload,
  validateKnowledgeTeamUploadExecutionLeaseBoundaryPayload,
  validateKnowledgeTeamUploadExecutionGatePayload,
  validateKnowledgeTeamUploadExecutionPrerequisitePlanPayload,
  validateKnowledgeTeamUploadMutationApprovalReviewPayload,
  validateKnowledgeTeamUploadMutationPlanPayload,
  validateKnowledgeTeamUploadMockHarnessPayload,
  validateKnowledgeTeamUploadRollbackPlanBoundaryPayload,
  validateKnowledgeTeamUploadWriteTokenBoundaryPayload
} from './team-upload-approval-validation.ts';

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
  'module-readme'
] as const satisfies readonly KnowledgeSourceKind[];
const KNOWLEDGE_SOURCE_STALE_REASONS = [
  'time-expired',
  'local-file-hash-mismatch',
  'local-file-missing'
] as const satisfies readonly KnowledgeSourceStaleReason[];
const KNOWLEDGE_PACK_SOURCE_FRESHNESS = ['fresh', 'stale', 'unchecked'] as const;
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
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const PACK_ID_PATTERN = /^[a-f0-9]{24}$/;
const MANIFEST_ID_PATTERN = PACK_ID_PATTERN;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

  for (const field of ['version', 'url', 'localPath', 'provider', 'module', 'chart', 'packageName'] as const) {
    validateOptionalString(value[field], `${path}.${field}`, issues);
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

  return createReport(inputPath, inputKind, issues, factSets);
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
      staleSourceCount: staleSourceCount ?? actualStaleSourceCount
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

  if (inputKind === 'infra-agent.knowledge-pack') {
    return validateKnowledgePackPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-artifact-manifest') {
    return validateKnowledgeArtifactManifestPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-artifact-descriptor') {
    return validateKnowledgeTeamArtifactDescriptorPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-artifact-index-entry') {
    return validateKnowledgeTeamArtifactIndexEntryPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-publication-plan') {
    return validateKnowledgeTeamPublicationPlanPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-publication-readiness') {
    return validateKnowledgeTeamPublicationReadinessPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-backend-readiness') {
    return validateKnowledgeTeamBackendReadinessPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-approval-intent') {
    return validateKnowledgeTeamUploadApprovalIntentPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-approval-continuation') {
    return validateKnowledgeTeamUploadApprovalContinuationPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-adapter-preflight') {
    return validateKnowledgeTeamUploadAdapterPreflightPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-mock-harness') {
    return validateKnowledgeTeamUploadMockHarnessPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-execution-gate') {
    return validateKnowledgeTeamUploadExecutionGatePayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-mutation-plan') {
    return validateKnowledgeTeamUploadMutationPlanPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-mutation-approval-review') {
    return validateKnowledgeTeamUploadMutationApprovalReviewPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-execution-prerequisite-plan') {
    return validateKnowledgeTeamUploadExecutionPrerequisitePlanPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-write-token-boundary') {
    return validateKnowledgeTeamUploadWriteTokenBoundaryPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-execution-lease-boundary') {
    return validateKnowledgeTeamUploadExecutionLeaseBoundaryPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-rollback-plan-boundary') {
    return validateKnowledgeTeamUploadRollbackPlanBoundaryPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-audit-record-boundary') {
    return validateKnowledgeTeamUploadAuditRecordBoundaryPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-artifact-bytes-boundary') {
    return validateKnowledgeTeamUploadArtifactBytesBoundaryPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-adapter-injection-boundary') {
    return validateKnowledgeTeamUploadAdapterInjectionBoundaryPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-client-creation-boundary') {
    return validateKnowledgeTeamUploadClientCreationBoundaryPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-credential-read-boundary') {
    return validateKnowledgeTeamUploadCredentialReadBoundaryPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-credential-presence-boundary') {
    return validateKnowledgeTeamUploadCredentialPresenceBoundaryPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-live-check-boundary') {
    return validateKnowledgeTeamUploadLiveCheckBoundaryPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-command-boundary') {
    return validateKnowledgeTeamUploadCommandBoundaryPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-object-index-binding-boundary') {
    return validateKnowledgeTeamUploadObjectIndexBindingBoundaryPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-execution-readiness-boundary') {
    return validateKnowledgeTeamUploadExecutionReadinessBoundaryPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-execution-approval-request') {
    return validateKnowledgeTeamUploadExecutionApprovalRequestPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-execution-approval-record') {
    return validateKnowledgeTeamUploadExecutionApprovalRecordPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-execution-authorization-boundary') {
    return validateKnowledgeTeamUploadExecutionAuthorizationBoundaryPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-execution-plan-rules-review') {
    return validateKnowledgeTeamUploadExecutionPlanRulesReviewPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-execution-plan-rules-update-record') {
    return validateKnowledgeTeamUploadExecutionPlanRulesUpdateRecordPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-execution-implementation-boundary') {
    return validateKnowledgeTeamUploadExecutionImplementationBoundaryPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-execution-runtime-boundaries') {
    return validateKnowledgeTeamUploadExecutionRuntimeBoundariesPayload(payload, inputPath, inputKind);
  }

  if (inputKind === 'infra-agent.knowledge-team-upload-execution-runtime-boundary-policy-review') {
    return validateKnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewPayload(payload, inputPath, inputKind);
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

  if (payload.unitCount !== undefined) {
    const declaredUnitCount = readNonNegativeInteger(payload.unitCount, '$.unitCount', issues);
    const actualUnitCount = unitSets.reduce((total, unitSet) => total + unitSet.unitCount, 0);
    if (declaredUnitCount !== null && declaredUnitCount !== actualUnitCount) {
      issues.push(error('$.unitCount', 'Knowledge extraction unitCount must match the sum of unit set unit counts.'));
    }
  }

  return createReport(inputPath, inputKind, issues, factSets);
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
