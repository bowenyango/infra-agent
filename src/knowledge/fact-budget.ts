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
  sources: BudgetedKnowledgeFactSource[];
  facts: BudgetedKnowledgeFact[];
}

function normalizeMaxFacts(maxFacts: number | undefined, fallback: number): number {
  const value = Number.isFinite(maxFacts)
    ? Math.trunc(maxFacts ?? fallback)
    : fallback;
  return Math.max(1, value);
}

function compactFact(fact: KnowledgePackFact): BudgetedKnowledgeFact {
  return {
    kind: fact.kind,
    path: fact.path,
    summary: fact.summary,
    confidence: fact.confidence,
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
    stale: source.stale
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
  const facts = (pack?.facts ?? []).slice(0, maxFacts).map(compactFact);
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
    sources: (pack?.sources ?? []).map(compactSource),
    facts
  };
}
