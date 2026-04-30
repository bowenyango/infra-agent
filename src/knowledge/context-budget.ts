import type { ConfigSemanticFact } from '../types/config-semantics.ts';
import type { KnowledgeContentType, RetrievedContextPacket } from '../types/knowledge.ts';

export interface RetrievedContextBudgetOptions {
  maxPackets?: number;
  maxTokens?: number;
  maxExcerptChars?: number;
  maxFacts?: number;
}

export interface CompactRetrievedContextPacket {
  id: string;
  source: RetrievedContextPacket['source'];
  confidence: RetrievedContextPacket['confidence'];
  reason: string;
  contentType: KnowledgeContentType;
  excerpt?: string;
  facts?: ConfigSemanticFact[];
  tokenEstimate: number;
}

export interface RetrievedContextBudgetPacketSummary {
  id: string;
  sourceKind: string;
  sourceName: string | null;
  sourceVersion: string | null;
  confidence: RetrievedContextPacket['confidence'];
  reason: string;
  tokenEstimate: number;
  excerptChars: number;
  included: boolean;
  omittedReason: 'packet-limit' | 'token-budget' | null;
}

export interface RetrievedContextBudgetSummary {
  maxPackets: number;
  maxTokens: number;
  maxExcerptChars: number;
  totalPacketCount: number;
  includedPacketCount: number;
  omittedPacketCount: number;
  includedTokenEstimate: number;
  omittedTokenEstimate: number;
  omittedByPacketLimit: number;
  omittedByTokenBudget: number;
  packets: RetrievedContextBudgetPacketSummary[];
}

export interface BudgetedRetrievedContext {
  packets: CompactRetrievedContextPacket[];
  budget: RetrievedContextBudgetSummary;
}

export const DEFAULT_RETRIEVED_CONTEXT_BUDGET = {
  maxPackets: 5,
  maxTokens: 1000,
  maxExcerptChars: 1200,
  maxFacts: 12
} as const;

function estimateTokens(value: string): number {
  return Math.ceil(value.length / 4);
}

function clipText(value: string | undefined, maxChars: number): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.length <= maxChars ? value : value.slice(0, maxChars).trimEnd();
}

function sourceField(source: RetrievedContextPacket['source'], field: string): string | null {
  const value = (source as Record<string, unknown>)[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function compactPacket(
  packet: RetrievedContextPacket,
  options: Required<RetrievedContextBudgetOptions>
): CompactRetrievedContextPacket {
  const excerpt = clipText(packet.excerpt, options.maxExcerptChars);
  const facts = packet.facts?.slice(0, options.maxFacts);
  const tokenSource = excerpt ?? (facts ? JSON.stringify(facts) : '');
  const tokenEstimate = tokenSource.length > 0
    ? estimateTokens(tokenSource)
    : Math.max(0, packet.tokenEstimate ?? 0);

  return {
    id: packet.id,
    source: packet.source,
    confidence: packet.confidence,
    reason: packet.reason,
    contentType: packet.contentType,
    excerpt,
    facts,
    tokenEstimate
  };
}

function packetSummary(
  packet: CompactRetrievedContextPacket,
  included: boolean,
  omittedReason: RetrievedContextBudgetPacketSummary['omittedReason']
): RetrievedContextBudgetPacketSummary {
  return {
    id: packet.id,
    sourceKind: sourceField(packet.source, 'kind') ?? 'unknown',
    sourceName: sourceField(packet.source, 'name') ?? sourceField(packet.source, 'path'),
    sourceVersion: sourceField(packet.source, 'version'),
    confidence: packet.confidence,
    reason: packet.reason,
    tokenEstimate: packet.tokenEstimate,
    excerptChars: packet.excerpt?.length ?? 0,
    included,
    omittedReason
  };
}

export function budgetRetrievedContext(
  packets: RetrievedContextPacket[] | undefined,
  options: RetrievedContextBudgetOptions = {}
): BudgetedRetrievedContext {
  const budgetOptions: Required<RetrievedContextBudgetOptions> = {
    maxPackets: options.maxPackets ?? DEFAULT_RETRIEVED_CONTEXT_BUDGET.maxPackets,
    maxTokens: options.maxTokens ?? DEFAULT_RETRIEVED_CONTEXT_BUDGET.maxTokens,
    maxExcerptChars: options.maxExcerptChars ?? DEFAULT_RETRIEVED_CONTEXT_BUDGET.maxExcerptChars,
    maxFacts: options.maxFacts ?? DEFAULT_RETRIEVED_CONTEXT_BUDGET.maxFacts
  };
  const compactPackets = (packets ?? []).map(packet => compactPacket(packet, budgetOptions));
  const includedPackets: CompactRetrievedContextPacket[] = [];
  const packetSummaries: RetrievedContextBudgetPacketSummary[] = [];
  let includedTokenEstimate = 0;
  let omittedTokenEstimate = 0;
  let omittedByPacketLimit = 0;
  let omittedByTokenBudget = 0;

  for (const packet of compactPackets) {
    const wouldExceedPacketLimit = includedPackets.length >= budgetOptions.maxPackets;
    const wouldExceedTokenBudget = includedPackets.length > 0
      && includedTokenEstimate + packet.tokenEstimate > budgetOptions.maxTokens;
    const omittedReason = wouldExceedPacketLimit
      ? 'packet-limit'
      : wouldExceedTokenBudget
        ? 'token-budget'
        : null;

    if (omittedReason) {
      omittedTokenEstimate += packet.tokenEstimate;
      if (omittedReason === 'packet-limit') {
        omittedByPacketLimit += 1;
      } else {
        omittedByTokenBudget += 1;
      }
      packetSummaries.push(packetSummary(packet, false, omittedReason));
      continue;
    }

    includedPackets.push(packet);
    includedTokenEstimate += packet.tokenEstimate;
    packetSummaries.push(packetSummary(packet, true, null));
  }

  return {
    packets: includedPackets,
    budget: {
      maxPackets: budgetOptions.maxPackets,
      maxTokens: budgetOptions.maxTokens,
      maxExcerptChars: budgetOptions.maxExcerptChars,
      totalPacketCount: compactPackets.length,
      includedPacketCount: includedPackets.length,
      omittedPacketCount: compactPackets.length - includedPackets.length,
      includedTokenEstimate,
      omittedTokenEstimate,
      omittedByPacketLimit,
      omittedByTokenBudget,
      packets: packetSummaries
    }
  };
}
