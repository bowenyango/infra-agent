import { isKnowledgeCacheEntryStale } from './cache.ts';
import { parseKnowledgeFactSet } from './facts-contract.ts';
import { parseKnowledgeUnitSet } from './knowledge-unit-contract.ts';
import {
  KNOWLEDGE_UNIT_EXTRACTION_METHODS,
  KNOWLEDGE_UNIT_TYPES,
  type KnowledgeCacheEntry,
  type KnowledgeFactSet,
  type KnowledgeUnit,
  type KnowledgeUnitExtractionMethod,
  type KnowledgeUnitSet,
  type KnowledgeUnitType,
  type RetrievedContextConfidence
} from '../types/knowledge.ts';

interface CuratedUnitExtractionOptions {
  now?: Date;
  extractedAt?: string;
}

const RETRIEVED_CONTEXT_CONFIDENCES = ['low', 'medium', 'high'] as const satisfies readonly RetrievedContextConfidence[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readUnitType(value: unknown): KnowledgeUnitType {
  if (typeof value !== 'string' || !KNOWLEDGE_UNIT_TYPES.includes(value as KnowledgeUnitType)) {
    throw new Error('curated knowledge unit unitType must be supported.');
  }

  return value as KnowledgeUnitType;
}

function confidence(value: unknown): RetrievedContextConfidence {
  return typeof value === 'string' && RETRIEVED_CONTEXT_CONFIDENCES.includes(value as RetrievedContextConfidence)
    ? value as RetrievedContextConfidence
    : 'medium';
}

function extractionMethod(unitType: KnowledgeUnitType, value: unknown): KnowledgeUnitExtractionMethod {
  if (typeof value === 'string' && KNOWLEDGE_UNIT_EXTRACTION_METHODS.includes(value as KnowledgeUnitExtractionMethod)) {
    return value as KnowledgeUnitExtractionMethod;
  }

  switch (unitType) {
    case 'fact':
      return 'repo-local-static';
    case 'guidance':
      return 'repo-local-guidance';
    case 'example':
      return 'repo-local-example';
    case 'diagnostic':
      return 'provider-diagnostic';
    case 'recipe':
      return 'workflow-recipe';
  }
}

function optionalStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0) : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function optionalNonNegativeInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) >= 0 ? value as number : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function sourceLocator(unit: Record<string, unknown>, unitType: KnowledgeUnitType, index: number): string {
  return optionalString(unit.locator) ?? `${unitType}:${optionalString(unit.path) ?? index.toString()}`;
}

function baseUnit(
  entry: KnowledgeCacheEntry,
  unit: Record<string, unknown>,
  unitType: KnowledgeUnitType,
  index: number
): Omit<KnowledgeUnit, 'unitType'> {
  return {
    path: unit.path,
    summary: unit.summary,
    confidence: confidence(unit.confidence),
    extractionMethod: extractionMethod(unitType, unit.extractionMethod),
    source: {
      id: entry.id,
      source: entry.source,
      contentHash: entry.contentHash,
      locator: sourceLocator(unit, unitType, index)
    },
    privacyScope: optionalString(unit.privacyScope) ?? 'internal-team',
    ...(optionalNonNegativeInteger(unit.tokenEstimate) !== undefined ? { tokenEstimate: optionalNonNegativeInteger(unit.tokenEstimate) } : {}),
    ...(optionalStringArray(unit.relatedPaths) ? { relatedPaths: optionalStringArray(unit.relatedPaths) } : {})
  } as Omit<KnowledgeUnit, 'unitType'>;
}

function curatedUnit(entry: KnowledgeCacheEntry, rawUnit: unknown, index: number): KnowledgeUnit {
  if (!isRecord(rawUnit)) {
    throw new Error(`curated knowledge unit units[${index}] must be an object.`);
  }

  const unitType = readUnitType(rawUnit.unitType);
  const base = baseUnit(entry, rawUnit, unitType, index);

  switch (unitType) {
    case 'fact':
      return {
        ...base,
        unitType,
        factKind: rawUnit.factKind,
        ...(optionalStringArray(rawUnit.values) ? { values: optionalStringArray(rawUnit.values) } : {}),
        ...(optionalBoolean(rawUnit.required) !== undefined ? { required: optionalBoolean(rawUnit.required) } : {}),
        ...(optionalString(rawUnit.type) ? { type: optionalString(rawUnit.type) } : {}),
        ...(optionalString(rawUnit.defaultValue) ? { defaultValue: optionalString(rawUnit.defaultValue) } : {})
      } as KnowledgeUnit;
    case 'guidance':
      return {
        ...base,
        unitType,
        topic: optionalString(rawUnit.topic) ?? optionalString(rawUnit.path) ?? 'curated-guidance',
        ...(optionalStringArray(rawUnit.appliesWhen) ? { appliesWhen: optionalStringArray(rawUnit.appliesWhen) } : {}),
        ...(optionalStringArray(rawUnit.avoidWhen) ? { avoidWhen: optionalStringArray(rawUnit.avoidWhen) } : {}),
        ...(optionalString(rawUnit.risk) ? { risk: optionalString(rawUnit.risk) } : {})
      } as KnowledgeUnit;
    case 'example':
      return {
        ...base,
        unitType,
        exampleType: optionalString(rawUnit.exampleType) ?? 'infra-example',
        snippet: rawUnit.snippet,
        ...(optionalString(rawUnit.language) ? { language: optionalString(rawUnit.language) } : {}),
        ...(optionalStringArray(rawUnit.appliesWhen) ? { appliesWhen: optionalStringArray(rawUnit.appliesWhen) } : {}),
        ...(optionalStringArray(rawUnit.avoidWhen) ? { avoidWhen: optionalStringArray(rawUnit.avoidWhen) } : {})
      } as KnowledgeUnit;
    case 'diagnostic':
      return {
        ...base,
        unitType,
        engine: optionalString(rawUnit.engine) ?? 'runtime',
        signature: optionalString(rawUnit.signature) ?? optionalString(rawUnit.path) ?? 'curated-diagnostic',
        likelyCause: optionalString(rawUnit.likelyCause) ?? optionalString(rawUnit.summary) ?? 'Curated internal diagnostic.',
        recommendedReview: optionalStringArray(rawUnit.recommendedReview) ?? ['Review the curated diagnostic before changing infrastructure.']
      } as KnowledgeUnit;
    case 'recipe':
      return {
        ...base,
        unitType,
        name: optionalString(rawUnit.name) ?? optionalString(rawUnit.summary) ?? 'Curated infrastructure workflow',
        steps: rawUnit.steps,
        ...(optionalBoolean(rawUnit.requiresApproval) !== undefined ? { requiresApproval: optionalBoolean(rawUnit.requiresApproval) } : {}),
        mutationAllowed: false
      } as KnowledgeUnit;
  }
}

function curatedPayloadUnits(payload: Record<string, unknown>): unknown[] {
  if (payload.kind !== 'infra-agent.curated-knowledge-units') {
    throw new Error('curated knowledge units input kind must be infra-agent.curated-knowledge-units.');
  }
  if (payload.schemaVersion !== 1) {
    throw new Error('curated knowledge units schemaVersion must be 1.');
  }
  if (payload.mutationAllowed !== false) {
    throw new Error('curated knowledge units mutationAllowed must be false.');
  }
  if (!Array.isArray(payload.units)) {
    throw new Error('curated knowledge units input units must be an array.');
  }

  return payload.units;
}

export function extractCuratedKnowledgeUnitSetFromCacheEntry(
  entry: KnowledgeCacheEntry,
  options: CuratedUnitExtractionOptions = {}
): KnowledgeUnitSet {
  const payload = JSON.parse(entry.content) as unknown;
  if (!isRecord(payload)) {
    throw new Error('curated knowledge units input must be a JSON object.');
  }

  const units = curatedPayloadUnits(payload).map((unit, index) => curatedUnit(entry, unit, index));
  const unitSet = {
    kind: 'infra-agent.knowledge-units',
    schemaVersion: 1,
    mutationAllowed: false,
    sourceId: entry.id,
    source: entry.source,
    sourceContentHash: entry.contentHash,
    extractedAt: options.extractedAt ?? new Date().toISOString(),
    unitCount: units.length,
    units
  } satisfies KnowledgeUnitSet;

  return parseKnowledgeUnitSet(unitSet);
}

export function buildEmptyCuratedKnowledgeFactSet(
  entry: KnowledgeCacheEntry,
  options: CuratedUnitExtractionOptions = {}
): KnowledgeFactSet {
  const sourceStale = isKnowledgeCacheEntryStale(entry, options.now);
  const factSet = {
    kind: 'infra-agent.knowledge-facts',
    schemaVersion: 1,
    mutationAllowed: false,
    sourceId: entry.id,
    source: entry.source,
    sourceContentHash: entry.contentHash,
    sourceFetchedAt: entry.fetchedAt,
    ...(entry.staleAfter !== undefined ? { sourceStaleAfter: entry.staleAfter } : {}),
    sourceStale,
    ...(entry.fingerprint !== undefined ? { sourceFingerprint: entry.fingerprint } : {}),
    extractedAt: options.extractedAt ?? new Date().toISOString(),
    factCount: 0,
    facts: []
  } satisfies KnowledgeFactSet;

  return parseKnowledgeFactSet(factSet);
}
