import { buildKnowledgeCacheId } from './cache.ts';
import {
  KNOWLEDGE_FACT_KINDS,
  KNOWLEDGE_UNIT_EXTRACTION_METHODS,
  KNOWLEDGE_UNIT_TYPES,
  type KnowledgeFact,
  type KnowledgeSource,
  type KnowledgeSourceKind,
  type KnowledgeUnit,
  type KnowledgeUnitExtractionMethod,
  type KnowledgeUnitPrivacyScope,
  type KnowledgeUnitSet,
  type RetrievedContextConfidence
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
  'module-readme'
];
const RETRIEVED_CONTEXT_CONFIDENCES = ['low', 'medium', 'high'] as const satisfies readonly RetrievedContextConfidence[];
const KNOWLEDGE_UNIT_PRIVACY_SCOPES = [
  'public-reference',
  'workspace-private',
  'internal-team',
  'private-run'
] as const satisfies readonly KnowledgeUnitPrivacyScope[];
const DIAGNOSTIC_ENGINES = ['terraform', 'pulumi', 'helm', 'provider', 'runtime'] as const;
const OPTIONAL_STRING_SOURCE_FIELDS = [
  'version',
  'url',
  'localPath',
  'provider',
  'module',
  'chart',
  'packageName'
] as const;
const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNonEmptyString(value: unknown, fieldPath: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`knowledge unit input ${fieldPath} must be a non-empty string.`);
  }

  assertNoSecretLikeValue(value, fieldPath);
  return value;
}

function assertNoSecretLikeValue(value: string, fieldPath: string): void {
  if (SECRET_VALUE_PATTERN.test(value)) {
    throw new Error(`knowledge unit input ${fieldPath} must not include secret-like values.`);
  }
}

function assertIsoDateString(value: unknown, fieldPath: string): void {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error(`knowledge unit input ${fieldPath} must be an ISO date string.`);
  }
}

function assertOptionalString(value: unknown, fieldPath: string): void {
  if (value !== undefined && typeof value !== 'string') {
    throw new Error(`knowledge unit input ${fieldPath} must be a string when present.`);
  }

  if (typeof value === 'string') {
    assertNoSecretLikeValue(value, fieldPath);
  }
}

function assertStringArray(value: unknown, fieldPath: string): string[] {
  if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error(`knowledge unit input ${fieldPath} must be an array of non-empty strings.`);
  }

  for (let index = 0; index < value.length; index += 1) {
    assertNoSecretLikeValue(value[index] as string, `${fieldPath}[${index}]`);
  }

  return value as string[];
}

function assertOptionalStringArray(value: unknown, fieldPath: string): void {
  if (value !== undefined) {
    assertStringArray(value, fieldPath);
  }
}

function assertKnowledgeSource(value: unknown, fieldPath: string): asserts value is KnowledgeSource {
  if (!isRecord(value)) {
    throw new Error(`knowledge unit input ${fieldPath} must be an object.`);
  }

  if (typeof value.kind !== 'string' || !KNOWLEDGE_SOURCE_KINDS.includes(value.kind as KnowledgeSourceKind)) {
    throw new Error(`knowledge unit input ${fieldPath}.kind must be supported.`);
  }

  assertNonEmptyString(value.name, `${fieldPath}.name`);

  for (const field of OPTIONAL_STRING_SOURCE_FIELDS) {
    assertOptionalString(value[field], `${fieldPath}.${field}`);
  }

  if (typeof value.url === 'string') {
    try {
      const parsedUrl = new URL(value.url);
      if (parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
        throw new Error();
      }
    } catch {
      throw new Error(`knowledge unit input ${fieldPath}.url must be a secret-safe URL without credentials, query, or fragment.`);
    }
  }
}

function assertBaseUnitFields(unit: Record<string, unknown>, unitPath: string, sourceId: string, sourceContentHash: string): void {
  assertNonEmptyString(unit.path, `${unitPath}.path`);
  assertNonEmptyString(unit.summary, `${unitPath}.summary`);

  if (
    typeof unit.confidence !== 'string'
    || !RETRIEVED_CONTEXT_CONFIDENCES.includes(unit.confidence as RetrievedContextConfidence)
  ) {
    throw new Error(`knowledge unit input ${unitPath}.confidence must be supported.`);
  }

  if (
    typeof unit.extractionMethod !== 'string'
    || !KNOWLEDGE_UNIT_EXTRACTION_METHODS.includes(unit.extractionMethod as KnowledgeUnitExtractionMethod)
  ) {
    throw new Error(`knowledge unit input ${unitPath}.extractionMethod must be supported.`);
  }

  if (
    typeof unit.privacyScope !== 'string'
    || !KNOWLEDGE_UNIT_PRIVACY_SCOPES.includes(unit.privacyScope as KnowledgeUnitPrivacyScope)
  ) {
    throw new Error(`knowledge unit input ${unitPath}.privacyScope must be supported.`);
  }

  if (unit.tokenEstimate !== undefined && (!Number.isInteger(unit.tokenEstimate) || (unit.tokenEstimate as number) < 0)) {
    throw new Error(`knowledge unit input ${unitPath}.tokenEstimate must be a non-negative integer when present.`);
  }

  assertOptionalStringArray(unit.relatedPaths, `${unitPath}.relatedPaths`);

  if (!isRecord(unit.source)) {
    throw new Error(`knowledge unit input ${unitPath}.source must be an object.`);
  }
  if (unit.source.id !== sourceId) {
    throw new Error(`knowledge unit input ${unitPath}.source.id must match sourceId.`);
  }
  if (unit.source.contentHash !== sourceContentHash) {
    throw new Error(`knowledge unit input ${unitPath}.source.contentHash must match sourceContentHash.`);
  }
  assertKnowledgeSource(unit.source.source, `${unitPath}.source.source`);
  assertNonEmptyString(unit.source.locator, `${unitPath}.source.locator`);
}

function assertFactUnit(unit: Record<string, unknown>, unitPath: string): void {
  if (typeof unit.factKind !== 'string' || !KNOWLEDGE_FACT_KINDS.includes(unit.factKind as typeof KNOWLEDGE_FACT_KINDS[number])) {
    throw new Error(`knowledge unit input ${unitPath}.factKind must be supported.`);
  }
  assertOptionalStringArray(unit.values, `${unitPath}.values`);
  if (unit.required !== undefined && typeof unit.required !== 'boolean') {
    throw new Error(`knowledge unit input ${unitPath}.required must be a boolean when present.`);
  }
  assertOptionalString(unit.type, `${unitPath}.type`);
  assertOptionalString(unit.defaultValue, `${unitPath}.defaultValue`);
}

function assertGuidanceUnit(unit: Record<string, unknown>, unitPath: string): void {
  assertNonEmptyString(unit.topic, `${unitPath}.topic`);
  assertOptionalStringArray(unit.appliesWhen, `${unitPath}.appliesWhen`);
  assertOptionalStringArray(unit.avoidWhen, `${unitPath}.avoidWhen`);
  assertOptionalString(unit.risk, `${unitPath}.risk`);
}

function assertExampleUnit(unit: Record<string, unknown>, unitPath: string): void {
  assertNonEmptyString(unit.exampleType, `${unitPath}.exampleType`);
  assertNonEmptyString(unit.snippet, `${unitPath}.snippet`);
  assertOptionalString(unit.language, `${unitPath}.language`);
  assertOptionalStringArray(unit.appliesWhen, `${unitPath}.appliesWhen`);
  assertOptionalStringArray(unit.avoidWhen, `${unitPath}.avoidWhen`);
}

function assertDiagnosticUnit(unit: Record<string, unknown>, unitPath: string): void {
  if (typeof unit.engine !== 'string' || !DIAGNOSTIC_ENGINES.includes(unit.engine as typeof DIAGNOSTIC_ENGINES[number])) {
    throw new Error(`knowledge unit input ${unitPath}.engine must be supported.`);
  }
  assertNonEmptyString(unit.signature, `${unitPath}.signature`);
  assertNonEmptyString(unit.likelyCause, `${unitPath}.likelyCause`);
  assertStringArray(unit.recommendedReview, `${unitPath}.recommendedReview`);
}

function assertRecipeUnit(unit: Record<string, unknown>, unitPath: string): void {
  assertNonEmptyString(unit.name, `${unitPath}.name`);
  assertStringArray(unit.steps, `${unitPath}.steps`);
  if (unit.requiresApproval !== undefined && typeof unit.requiresApproval !== 'boolean') {
    throw new Error(`knowledge unit input ${unitPath}.requiresApproval must be a boolean when present.`);
  }
  if (unit.mutationAllowed !== false) {
    throw new Error(`knowledge unit input ${unitPath}.mutationAllowed must be false.`);
  }
}

function assertKnowledgeUnit(unit: unknown, unitPath: string, sourceId: string, sourceContentHash: string): asserts unit is KnowledgeUnit {
  if (!isRecord(unit)) {
    throw new Error(`knowledge unit input ${unitPath} must be an object.`);
  }

  if (typeof unit.unitType !== 'string' || !KNOWLEDGE_UNIT_TYPES.includes(unit.unitType as typeof KNOWLEDGE_UNIT_TYPES[number])) {
    throw new Error(`knowledge unit input ${unitPath}.unitType must be supported.`);
  }

  assertBaseUnitFields(unit, unitPath, sourceId, sourceContentHash);

  switch (unit.unitType) {
    case 'fact':
      assertFactUnit(unit, unitPath);
      break;
    case 'guidance':
      assertGuidanceUnit(unit, unitPath);
      break;
    case 'example':
      assertExampleUnit(unit, unitPath);
      break;
    case 'diagnostic':
      assertDiagnosticUnit(unit, unitPath);
      break;
    case 'recipe':
      assertRecipeUnit(unit, unitPath);
      break;
  }
}

export function knowledgeFactToFactUnit(fact: KnowledgeFact, privacyScope: KnowledgeUnitPrivacyScope): KnowledgeUnit {
  return {
    unitType: 'fact',
    factKind: fact.kind,
    path: fact.path,
    summary: fact.summary,
    confidence: fact.confidence,
    extractionMethod: fact.extractionMethod,
    source: fact.source,
    privacyScope,
    ...(fact.values !== undefined ? { values: [...fact.values] } : {}),
    ...(fact.required !== undefined ? { required: fact.required } : {}),
    ...(fact.type !== undefined ? { type: fact.type } : {}),
    ...(fact.defaultValue !== undefined ? { defaultValue: fact.defaultValue } : {}),
    ...(fact.relatedPaths !== undefined ? { relatedPaths: [...fact.relatedPaths] } : {})
  };
}

export function parseKnowledgeUnitSet(value: unknown): KnowledgeUnitSet {
  if (!isRecord(value) || value.kind !== 'infra-agent.knowledge-units') {
    throw new Error('knowledge unit input must be an infra-agent.knowledge-units JSON payload.');
  }

  if (value.schemaVersion !== 1) {
    throw new Error('knowledge unit input schemaVersion must be 1.');
  }
  if (value.mutationAllowed !== false) {
    throw new Error('knowledge unit input mutationAllowed must be false.');
  }

  const sourceId = assertNonEmptyString(value.sourceId, 'sourceId');
  assertKnowledgeSource(value.source, 'source');
  if (sourceId !== buildKnowledgeCacheId(value.source)) {
    throw new Error('knowledge unit input sourceId must match source.');
  }

  const sourceContentHash = assertNonEmptyString(value.sourceContentHash, 'sourceContentHash');
  if (!SHA256_HEX_PATTERN.test(sourceContentHash)) {
    throw new Error('knowledge unit input sourceContentHash must be a SHA-256 hex string.');
  }
  assertIsoDateString(value.extractedAt, 'extractedAt');

  if (!Number.isInteger(value.unitCount) || (value.unitCount as number) < 0) {
    throw new Error('knowledge unit input unitCount must be a non-negative integer.');
  }
  if (!Array.isArray(value.units)) {
    throw new Error('knowledge unit input units must be an array.');
  }
  if (value.unitCount !== value.units.length) {
    throw new Error('knowledge unit input unitCount must match units length.');
  }

  for (let index = 0; index < value.units.length; index += 1) {
    assertKnowledgeUnit(value.units[index], `units[${index}]`, sourceId, sourceContentHash);
  }

  return value as KnowledgeUnitSet;
}
