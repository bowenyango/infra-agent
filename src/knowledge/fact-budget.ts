import type { KnowledgePack, KnowledgePackFact, KnowledgePackSource } from './pack.ts';

export interface BudgetedKnowledgeFact {
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
  staleSourceCount: number;
  uncheckedSourceCount: number;
  sources: BudgetedKnowledgeFactSource[];
  facts: BudgetedKnowledgeFact[];
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
  const totalFactCount = pack?.factCount ?? 0;

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
    staleSourceCount: pack?.staleSourceCount ?? 0,
    uncheckedSourceCount: (pack?.sources ?? []).filter(source => source.freshness === 'unchecked').length,
    sources: (pack?.sources ?? []).map(compactSource),
    facts
  };
}
