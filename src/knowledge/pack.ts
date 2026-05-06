import { createHash } from 'node:crypto';
import { extractWorkspaceKnowledgeFacts, type KnowledgeExtractionOptions } from './extract.ts';
import { rankKnowledgePackFacts } from './fact-ranking.ts';
import type { InfraDomainId, WorkspaceInspection } from '../types/repository.ts';
import type {
  KnowledgeFact,
  KnowledgeFactExtractionMethod,
  KnowledgeFactKind,
  KnowledgeSource,
  RetrievedContextConfidence
} from '../types/knowledge.ts';

export interface KnowledgePackSource {
  id: string;
  domain: InfraDomainId;
  targetPath: string;
  kind: KnowledgeSource['kind'];
  name: string;
  factCount: number;
  contentHash: string;
  fetchedAt: string | null;
  staleAfter?: string;
  stale: boolean;
}

export interface KnowledgePackFact {
  kind: KnowledgeFactKind;
  path: string;
  summary: string;
  confidence: RetrievedContextConfidence;
  extractionMethod: KnowledgeFactExtractionMethod;
  sourceId: string;
  sourceLocator: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
  values?: string[];
  relatedPaths?: string[];
}

export interface KnowledgePack {
  kind: 'infra-agent.knowledge-pack';
  schemaVersion: 1;
  mutationAllowed: false;
  packId: string;
  workspaceRoot: string;
  cacheRoot: string;
  requestedDomains: InfraDomainId[];
  targetPaths: string[];
  sourceIds: string[];
  sourceCount: number;
  factSetCount: number;
  factCount: number;
  includedFactCount: number;
  omittedFactCount: number;
  maxFacts: number;
  staleSourceCount: number;
  sources: KnowledgePackSource[];
  facts: KnowledgePackFact[];
}

export interface KnowledgePackOptions extends KnowledgeExtractionOptions {
  maxFacts?: number;
}

function normalizeMaxFacts(maxFacts: number | undefined): number {
  if (!Number.isInteger(maxFacts) || maxFacts === undefined) {
    return 80;
  }

  return Math.max(1, maxFacts);
}

function packHash(input: {
  sources: KnowledgePackSource[];
  facts: KnowledgePackFact[];
}): string {
  return createHash('sha256')
    .update(JSON.stringify({
      sources: input.sources.map(source => ({
        id: source.id,
        contentHash: source.contentHash,
        stale: source.stale
      })),
      facts: input.facts.map(fact => ({
        kind: fact.kind,
        path: fact.path,
        summary: fact.summary,
        sourceId: fact.sourceId,
        sourceLocator: fact.sourceLocator
      }))
    }))
    .digest('hex')
    .slice(0, 24);
}

function toPackSource(factSet: {
  sourceId: string;
  source: KnowledgeSource;
  sourceContentHash: string;
  sourceFetchedAt: string | null;
  sourceStaleAfter?: string;
  sourceStale: boolean;
  factCount: number;
}, sourceIndex: Map<string, { domain: InfraDomainId; targetPath: string }>): KnowledgePackSource {
  const sourceContext = sourceIndex.get(factSet.sourceId);
  const fallbackDomain: InfraDomainId = factSet.source.kind.startsWith('chart') || factSet.source.kind === 'helm-docs'
    ? 'helm'
    : factSet.source.kind === 'pulumi-docs'
      ? 'pulumi'
      : 'terraform';
  return {
    id: factSet.sourceId,
    domain: sourceContext?.domain ?? fallbackDomain,
    targetPath: sourceContext?.targetPath ?? '',
    kind: factSet.source.kind,
    name: factSet.source.name,
    factCount: factSet.factCount,
    contentHash: factSet.sourceContentHash,
    fetchedAt: factSet.sourceFetchedAt,
    ...(factSet.sourceStaleAfter !== undefined ? { staleAfter: factSet.sourceStaleAfter } : {}),
    stale: factSet.sourceStale
  };
}

function toPackFact(fact: KnowledgeFact): KnowledgePackFact {
  const values = fact.kind === 'example' ? undefined : fact.values;
  return {
    kind: fact.kind,
    path: fact.path,
    summary: fact.summary,
    confidence: fact.confidence,
    extractionMethod: fact.extractionMethod,
    sourceId: fact.source.id,
    sourceLocator: fact.source.locator,
    ...(fact.required !== undefined ? { required: fact.required } : {}),
    ...(fact.type !== undefined ? { type: fact.type } : {}),
    ...(fact.defaultValue !== undefined ? { defaultValue: fact.defaultValue } : {}),
    ...(values !== undefined ? { values } : {}),
    ...(fact.relatedPaths !== undefined ? { relatedPaths: fact.relatedPaths } : {})
  };
}

export async function buildKnowledgePack(
  inspection: WorkspaceInspection,
  options: KnowledgePackOptions = {}
): Promise<KnowledgePack> {
  const maxFacts = normalizeMaxFacts(options.maxFacts);
  const extraction = await extractWorkspaceKnowledgeFacts(inspection, options);
  const sourceIndex = new Map(extraction.sources.map(source => [
    source.id,
    {
      domain: source.domain,
      targetPath: source.targetPath
    }
  ]));
  const sources = extraction.factSets.map(factSet => toPackSource(factSet, sourceIndex));
  const allFacts = extraction.factSets.flatMap(factSet => factSet.facts.map(toPackFact));
  const rankedFacts = rankKnowledgePackFacts(allFacts, {
    sources,
    requestedDomains: extraction.requestedDomains,
    targetPaths: extraction.targetPaths
  });
  const facts = rankedFacts.slice(0, maxFacts);

  return {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: packHash({ sources, facts }),
    workspaceRoot: extraction.workspaceRoot,
    cacheRoot: extraction.cacheRoot,
    requestedDomains: extraction.requestedDomains,
    targetPaths: extraction.targetPaths,
    sourceIds: extraction.sourceIds,
    sourceCount: sources.length,
    factSetCount: extraction.factSetCount,
    factCount: extraction.factCount,
    includedFactCount: facts.length,
    omittedFactCount: Math.max(0, rankedFacts.length - facts.length),
    maxFacts,
    staleSourceCount: sources.filter(source => source.stale).length,
    sources,
    facts
  };
}
