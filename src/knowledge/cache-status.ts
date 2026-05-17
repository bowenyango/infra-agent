import type { KnowledgeStore } from './knowledge-store.ts';
import type { KnowledgeSourcesReport } from './sources.ts';
import type { KnowledgeStorageScope } from './storage-policy.ts';
import type { InfraDomainId } from '../types/repository.ts';
import type {
  KnowledgeSource,
  KnowledgeSourceKind,
  ResolvedKnowledgeCacheRoot
} from '../types/knowledge.ts';

export type KnowledgeSourceCacheStatus =
  | 'local'
  | 'missing'
  | 'fresh'
  | 'stale';

export interface KnowledgeCacheStatusSourceEntry {
  id: string;
  domain: InfraDomainId;
  targetPath: string;
  sourceKind: KnowledgeSourceKind;
  sourceName: string;
  cacheStatus: KnowledgeSourceCacheStatus;
  requiresFetch: boolean;
  refreshRecommended: boolean;
  storageScope: KnowledgeStorageScope;
  location: string | null;
}

export interface KnowledgeCacheStatusDomainSummary {
  domain: InfraDomainId;
  sourceCount: number;
  local: number;
  external: number;
  fresh: number;
  stale: number;
  missing: number;
  refreshRecommended: number;
}

export interface KnowledgeCacheStatusReport {
  kind: 'infra-agent.cache-status';
  schemaVersion: 1;
  mutationAllowed: false;
  workspaceRoot: string;
  cacheRoot: string;
  cacheRootSource: ResolvedKnowledgeCacheRoot['source'];
  requestedDomains: InfraDomainId[];
  targetPaths: string[];
  summary: {
    sourceCount: number;
    local: number;
    external: number;
    fresh: number;
    stale: number;
    missing: number;
    refreshRecommended: number;
  };
  byDomain: KnowledgeCacheStatusDomainSummary[];
  sources: KnowledgeCacheStatusSourceEntry[];
}

export async function resolveKnowledgeSourceCacheStatus(
  source: KnowledgeSource,
  store: KnowledgeStore,
  now?: Date
): Promise<KnowledgeSourceCacheStatus> {
  if (!source.url) {
    return 'local';
  }

  const entry = await store.read(source);
  if (!entry) {
    return 'missing';
  }

  return store.isStale(entry, now) ? 'stale' : 'fresh';
}

function summarizeStatusEntries(
  entries: KnowledgeCacheStatusSourceEntry[]
): KnowledgeCacheStatusReport['summary'] {
  return {
    sourceCount: entries.length,
    local: entries.filter(entry => entry.cacheStatus === 'local').length,
    external: entries.filter(entry => entry.requiresFetch).length,
    fresh: entries.filter(entry => entry.cacheStatus === 'fresh').length,
    stale: entries.filter(entry => entry.cacheStatus === 'stale').length,
    missing: entries.filter(entry => entry.cacheStatus === 'missing').length,
    refreshRecommended: entries.filter(entry => entry.refreshRecommended).length
  };
}

function summarizeStatusEntriesByDomain(
  entries: KnowledgeCacheStatusSourceEntry[]
): KnowledgeCacheStatusDomainSummary[] {
  const byDomain = new Map<InfraDomainId, KnowledgeCacheStatusSourceEntry[]>();

  for (const entry of entries) {
    byDomain.set(entry.domain, [
      ...(byDomain.get(entry.domain) ?? []),
      entry
    ]);
  }

  return Array.from(byDomain.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([domain, domainEntries]) => ({
      domain,
      sourceCount: domainEntries.length,
      local: domainEntries.filter(entry => entry.cacheStatus === 'local').length,
      external: domainEntries.filter(entry => entry.requiresFetch).length,
      fresh: domainEntries.filter(entry => entry.cacheStatus === 'fresh').length,
      stale: domainEntries.filter(entry => entry.cacheStatus === 'stale').length,
      missing: domainEntries.filter(entry => entry.cacheStatus === 'missing').length,
      refreshRecommended: domainEntries.filter(entry => entry.refreshRecommended).length
    }));
}

export function buildKnowledgeCacheStatusReportFromSources(
  report: KnowledgeSourcesReport,
  cacheRootSource: ResolvedKnowledgeCacheRoot['source']
): KnowledgeCacheStatusReport {
  const sources = report.sources.map(source => ({
    id: source.id,
    domain: source.domain,
    targetPath: source.targetPath,
    sourceKind: source.source.kind,
    sourceName: source.source.name,
    cacheStatus: source.cacheStatus,
    requiresFetch: source.requiresFetch,
    refreshRecommended: source.cacheStatus === 'stale' || source.cacheStatus === 'missing',
    storageScope: source.storagePolicy.scope,
    location: source.source.url ?? source.source.localPath ?? null
  }));

  return {
    kind: 'infra-agent.cache-status',
    schemaVersion: 1,
    mutationAllowed: false,
    workspaceRoot: report.workspaceRoot,
    cacheRoot: report.cacheRoot,
    cacheRootSource,
    requestedDomains: report.requestedDomains,
    targetPaths: report.targetPaths,
    summary: summarizeStatusEntries(sources),
    byDomain: summarizeStatusEntriesByDomain(sources),
    sources
  };
}
