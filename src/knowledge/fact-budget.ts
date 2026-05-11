import type { KnowledgePack, KnowledgePackFact, KnowledgePackSource, KnowledgePackUnit } from './pack.ts';

export interface BudgetedKnowledgeFact {
  unitType?: 'fact';
  kind: KnowledgePackFact['kind'];
  path: string;
  summary: string;
  confidence: KnowledgePackFact['confidence'];
  extractionMethod: KnowledgePackFact['extractionMethod'];
  sourceId: string;
  sourceLocator: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
  values?: string[];
  relatedPaths?: string[];
}

export interface BudgetedKnowledgeFactSource {
  id: string;
  domain: KnowledgePackSource['domain'];
  targetPath: string;
  kind: KnowledgePackSource['kind'];
  name: string;
  factCount: number;
  stale: boolean;
  staleReason?: KnowledgePackSource['staleReason'];
  freshness: KnowledgePackSource['freshness'];
  fingerprintDigest?: string;
  fingerprintFileCount?: number;
}

export type BudgetedKnowledgeUnit = KnowledgePackUnit;

export interface KnowledgeFactBudgetSummary {
  kind: 'infra-agent.knowledge-facts-summary';
  schemaVersion: 1;
  mutationAllowed: false;
  packId: string | null;
  maxFacts: number;
  sourceCount: number;
  factSetCount: number;
  totalFactCount: number;
  includedFactCount: number;
  omittedFactCount: number;
  totalUnitCount: number;
  includedUnitCount: number;
  omittedUnitCount: number;
  staleSourceCount: number;
  uncheckedSourceCount: number;
  sources: BudgetedKnowledgeFactSource[];
  facts: BudgetedKnowledgeFact[];
  units: BudgetedKnowledgeUnit[];
}

function normalizeMaxFacts(maxFacts: number | undefined, fallback: number): number {
  const value = Number.isFinite(maxFacts)
    ? Math.trunc(maxFacts ?? fallback)
    : fallback;
  return Math.max(1, value);
}

function compactFact(fact: KnowledgePackFact, source: KnowledgePackSource | undefined): BudgetedKnowledgeFact {
  const confidence = (source?.stale || source?.freshness === 'unchecked') && fact.confidence === 'high'
    ? 'medium'
    : fact.confidence;
  return {
    unitType: 'fact',
    kind: fact.kind,
    path: fact.path,
    summary: fact.summary,
    confidence,
    extractionMethod: fact.extractionMethod,
    sourceId: fact.sourceId,
    sourceLocator: fact.sourceLocator,
    ...(fact.required !== undefined ? { required: fact.required } : {}),
    ...(fact.type !== undefined ? { type: fact.type } : {}),
    ...(fact.defaultValue !== undefined ? { defaultValue: fact.defaultValue } : {}),
    ...(fact.values !== undefined ? { values: [...fact.values] } : {}),
    ...(fact.relatedPaths !== undefined ? { relatedPaths: [...fact.relatedPaths] } : {})
  };
}

function compactSource(source: KnowledgePackSource): BudgetedKnowledgeFactSource {
  return {
    id: source.id,
    domain: source.domain,
    targetPath: source.targetPath,
    kind: source.kind,
    name: source.name,
    factCount: source.factCount,
    stale: source.stale,
    ...(source.staleReason !== undefined ? { staleReason: source.staleReason } : {}),
    freshness: source.freshness,
    ...(source.fingerprintDigest !== undefined ? { fingerprintDigest: source.fingerprintDigest } : {}),
    ...(source.fingerprintFileCount !== undefined ? { fingerprintFileCount: source.fingerprintFileCount } : {})
  };
}

function compactUnit(unit: KnowledgePackUnit, source: KnowledgePackSource | undefined): BudgetedKnowledgeUnit {
  const confidence = (source?.stale || source?.freshness === 'unchecked') && unit.confidence === 'high'
    ? 'medium'
    : unit.confidence;
  const base = {
    ...unit,
    confidence,
    ...(unit.relatedPaths !== undefined ? { relatedPaths: [...unit.relatedPaths] } : {})
  };

  switch (unit.unitType) {
    case 'fact':
      return {
        ...base,
        ...(unit.values !== undefined ? { values: [...unit.values] } : {})
      };
    case 'guidance':
      return {
        ...base,
        ...(unit.appliesWhen !== undefined ? { appliesWhen: [...unit.appliesWhen] } : {}),
        ...(unit.avoidWhen !== undefined ? { avoidWhen: [...unit.avoidWhen] } : {})
      };
    case 'example':
      return {
        ...base,
        ...(unit.appliesWhen !== undefined ? { appliesWhen: [...unit.appliesWhen] } : {}),
        ...(unit.avoidWhen !== undefined ? { avoidWhen: [...unit.avoidWhen] } : {})
      };
    case 'diagnostic':
      return {
        ...base,
        recommendedReview: [...unit.recommendedReview]
      };
    case 'recipe':
      return {
        ...base,
        steps: [...unit.steps]
      };
  }
}

export function budgetKnowledgePackFacts(
  pack: KnowledgePack | null | undefined,
  options: {
    maxFacts?: number;
  } = {}
): KnowledgeFactBudgetSummary {
  const fallbackMaxFacts = pack?.maxFacts ?? 1;
  const maxFacts = normalizeMaxFacts(options.maxFacts, fallbackMaxFacts);
  const sourceById = new Map((pack?.sources ?? []).map(source => [source.id, source]));
  const facts = (pack?.facts ?? [])
    .slice(0, maxFacts)
    .map(fact => compactFact(fact, sourceById.get(fact.sourceId)));
  const units = (pack?.units ?? [])
    .slice(0, maxFacts)
    .map(unit => compactUnit(unit, sourceById.get(unit.sourceId)));
  const totalFactCount = pack?.factCount ?? 0;
  const totalUnitCount = pack?.unitCount ?? totalFactCount;

  return {
    kind: 'infra-agent.knowledge-facts-summary',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: pack?.packId ?? null,
    maxFacts,
    sourceCount: pack?.sourceCount ?? 0,
    factSetCount: pack?.factSetCount ?? 0,
    totalFactCount,
    includedFactCount: facts.length,
    omittedFactCount: Math.max(0, totalFactCount - facts.length),
    totalUnitCount,
    includedUnitCount: units.length,
    omittedUnitCount: Math.max(0, totalUnitCount - units.length),
    staleSourceCount: pack?.staleSourceCount ?? 0,
    uncheckedSourceCount: (pack?.sources ?? []).filter(source => source.freshness === 'unchecked').length,
    sources: (pack?.sources ?? []).map(compactSource),
    facts,
    units
  };
}
