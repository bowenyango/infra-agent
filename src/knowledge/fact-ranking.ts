import type { KnowledgePackFact, KnowledgePackSource } from './pack.ts';
import type { InfraDomainId } from '../types/repository.ts';

export interface KnowledgeFactRankingOptions {
  sources?: KnowledgePackSource[];
  requestedDomains?: InfraDomainId[];
  targetPaths?: string[];
}

interface ScoredKnowledgeFact {
  fact: KnowledgePackFact;
  index: number;
  rank: number;
  sourceKindPriority: number;
  targetPriority: number;
  domainPriority: number;
  stalePriority: number;
  confidencePriority: number;
  pathSpecificity: number;
}

const CONFIDENCE_SCORE: Record<KnowledgePackFact['confidence'], number> = {
  high: 30,
  medium: 15,
  low: 0
};

const SOURCE_KIND_SCORE: Record<KnowledgePackSource['kind'], number> = {
  'provider-schema': 35,
  'chart-schema': 35,
  'chart-lock': 30,
  'module-readme': 28,
  'repo-example': 24,
  'terraform-registry': 20,
  'helm-docs': 18,
  'pulumi-docs': 18,
  'chart-docs': 16
};

const FACT_KIND_SCORE: Record<KnowledgePackFact['kind'], number> = {
  argument: 26,
  attribute: 14,
  'nested-block': 24,
  example: 4,
  'identity-field': 24,
  'replacement-sensitive-field': 28,
  'module-input': 24,
  'module-output': 12,
  'chart-value': 26,
  'pulumi-config-parameter': 24
};

function sourceDomainScore(source: KnowledgePackSource | undefined, requestedDomains: InfraDomainId[]): number {
  if (!source || requestedDomains.length === 0) {
    return 0;
  }

  return requestedDomains.includes(source.domain) ? 10 : 0;
}

function targetPathScore(source: KnowledgePackSource | undefined, targetPaths: string[]): number {
  if (!source || targetPaths.length === 0 || !source.targetPath) {
    return 0;
  }

  return targetPaths.some(targetPath =>
    source.targetPath === targetPath
    || source.targetPath.startsWith(`${targetPath}/`)
    || targetPath.startsWith(`${source.targetPath}/`)
  )
    ? 14
    : 0;
}

function scoreFact(
  fact: KnowledgePackFact,
  source: KnowledgePackSource | undefined,
  options: Required<Pick<KnowledgeFactRankingOptions, 'requestedDomains' | 'targetPaths'>>
): number {
  let rank = 0;

  const sourceScore = source ? SOURCE_KIND_SCORE[source.kind] : 0;
  if (sourceScore > 0) {
    rank += sourceScore;
  }

  const confidenceScore = CONFIDENCE_SCORE[fact.confidence];
  rank += confidenceScore;

  const kindScore = FACT_KIND_SCORE[fact.kind];
  rank += kindScore;

  if (fact.required === true) {
    rank += 22;
  } else if (fact.required === false) {
    rank += 4;
  }

  if (fact.type) {
    rank += 6;
  }

  if (fact.defaultValue) {
    rank += 4;
  }

  if (fact.values && fact.values.length > 0 && fact.kind !== 'example') {
    rank += 5;
  }

  const domainScore = sourceDomainScore(source, options.requestedDomains);
  if (domainScore > 0) {
    rank += domainScore;
  }

  const targetScore = targetPathScore(source, options.targetPaths);
  if (targetScore > 0) {
    rank += targetScore;
  }

  if (source?.stale) {
    rank -= 25;
  }

  rank += Math.min(fact.path.split('.').length, 8);

  return Math.max(0, rank);
}

function sourcePriority(source: KnowledgePackSource | undefined): number {
  return source ? SOURCE_KIND_SCORE[source.kind] : 0;
}

function targetPriority(source: KnowledgePackSource | undefined, targetPaths: string[]): number {
  if (!source || targetPaths.length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }

  const index = targetPaths.findIndex(targetPath =>
    source.targetPath === targetPath
    || source.targetPath.startsWith(`${targetPath}/`)
    || targetPath.startsWith(`${source.targetPath}/`)
  );
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function domainPriority(source: KnowledgePackSource | undefined, requestedDomains: InfraDomainId[]): number {
  if (!source || requestedDomains.length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }

  const index = requestedDomains.indexOf(source.domain);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function confidencePriority(confidence: KnowledgePackFact['confidence']): number {
  return confidence === 'high' ? 2 : confidence === 'medium' ? 1 : 0;
}

function stalePriority(source: KnowledgePackSource | undefined): number {
  return source?.stale ? 1 : 0;
}

function pathSpecificity(path: string): number {
  return path.split('.').length;
}

export function rankKnowledgePackFacts(
  facts: KnowledgePackFact[],
  options: KnowledgeFactRankingOptions = {}
): KnowledgePackFact[] {
  const sourceById = new Map((options.sources ?? []).map(source => [source.id, source]));
  const requestedDomains = options.requestedDomains ?? [];
  const targetPaths = options.targetPaths ?? [];

  const scored: ScoredKnowledgeFact[] = facts.map((fact, index) => {
    const source = sourceById.get(fact.sourceId);
    const rank = scoreFact(fact, source, {
      requestedDomains,
      targetPaths
    });

    return {
      fact,
      index,
      rank,
      sourceKindPriority: sourcePriority(source),
      targetPriority: targetPriority(source, targetPaths),
      domainPriority: domainPriority(source, requestedDomains),
      stalePriority: stalePriority(source),
      confidencePriority: confidencePriority(fact.confidence),
      pathSpecificity: pathSpecificity(fact.path)
    };
  });

  scored.sort((left, right) =>
    right.rank - left.rank
    || left.targetPriority - right.targetPriority
    || left.domainPriority - right.domainPriority
    || right.sourceKindPriority - left.sourceKindPriority
    || left.stalePriority - right.stalePriority
    || right.confidencePriority - left.confidencePriority
    || right.pathSpecificity - left.pathSpecificity
    || left.fact.path.localeCompare(right.fact.path)
    || left.fact.kind.localeCompare(right.fact.kind)
    || left.fact.sourceId.localeCompare(right.fact.sourceId)
    || left.fact.sourceLocator.localeCompare(right.fact.sourceLocator)
    || left.index - right.index
  );

  return scored.map(entry => entry.fact);
}
