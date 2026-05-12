import { parseKnowledgeUnitSet } from './knowledge-unit-contract.ts';
import type {
  KnowledgeCacheEntry,
  KnowledgeUnit,
  KnowledgeUnitSet
} from '../types/knowledge.ts';

interface PrebuiltUnitArtifactExtractionOptions {
  extractedAt?: string;
}

function rebaseUnitSource(entry: KnowledgeCacheEntry, unit: KnowledgeUnit): KnowledgeUnit {
  return {
    ...unit,
    source: {
      id: entry.id,
      source: entry.source,
      contentHash: entry.contentHash,
      locator: unit.source.locator
    }
  } as KnowledgeUnit;
}

export function extractPrebuiltKnowledgeUnitSetFromCacheEntry(
  entry: KnowledgeCacheEntry,
  options: PrebuiltUnitArtifactExtractionOptions = {}
): KnowledgeUnitSet {
  const parsed = parseKnowledgeUnitSet(JSON.parse(entry.content) as unknown);
  const units = parsed.units.map(unit => rebaseUnitSource(entry, unit));
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
