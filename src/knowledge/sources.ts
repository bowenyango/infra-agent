import {
  collectWorkspaceKnowledgeSources,
  resolveKnowledgeSourceSelection
} from './prefetch.ts';
import {
  resolveKnowledgeSourceCacheStatus,
  type KnowledgeSourceCacheStatus
} from './cache-status.ts';
import { createFileKnowledgeStore, type KnowledgeStore } from './knowledge-store.ts';
import {
  resolveKnowledgeStoragePolicy,
  summarizeKnowledgeStoragePolicies,
  type KnowledgeStoragePolicy,
  type KnowledgeStoragePolicySummary
} from './storage-policy.ts';
import type { InfraDomainId, WorkspaceInspection } from '../types/repository.ts';
import type { KnowledgeSource } from '../types/knowledge.ts';

export interface KnowledgeSourceReportEntry {
  id: string;
  domain: InfraDomainId;
  targetPath: string;
  requiresFetch: boolean;
  cacheStatus: KnowledgeSourceCacheStatus;
  storagePolicy: KnowledgeStoragePolicy;
  source: KnowledgeSource;
}

export interface KnowledgeSourcesReport {
  kind: 'infra-agent.knowledge-sources';
  schemaVersion: 1;
  mutationAllowed: false;
  workspaceRoot: string;
  cacheRoot: string;
  requestedDomains: InfraDomainId[];
  resource?: string;
  targetPaths: string[];
  sourceCount: number;
  summary: {
    local: number;
    external: number;
    cacheStatus: {
      local: number;
      fresh: number;
      stale: number;
      missing: number;
      refreshRecommended: number;
    };
    storagePolicy: KnowledgeStoragePolicySummary;
    byDomain: Partial<Record<InfraDomainId, number>>;
  };
  sources: KnowledgeSourceReportEntry[];
}

function summarizeSources(sources: KnowledgeSourceReportEntry[]): KnowledgeSourcesReport['summary'] {
  const byDomain: Partial<Record<InfraDomainId, number>> = {};
  for (const source of sources) {
    byDomain[source.domain] = (byDomain[source.domain] ?? 0) + 1;
  }

  return {
    local: sources.filter(source => !source.requiresFetch).length,
    external: sources.filter(source => source.requiresFetch).length,
    cacheStatus: {
      local: sources.filter(source => source.cacheStatus === 'local').length,
      fresh: sources.filter(source => source.cacheStatus === 'fresh').length,
      stale: sources.filter(source => source.cacheStatus === 'stale').length,
      missing: sources.filter(source => source.cacheStatus === 'missing').length,
      refreshRecommended: sources.filter(source =>
        source.cacheStatus === 'stale' || source.cacheStatus === 'missing'
      ).length
    },
    storagePolicy: summarizeKnowledgeStoragePolicies(sources.map(source => source.storagePolicy)),
    byDomain
  };
}

export async function buildKnowledgeSourcesReport(
  inspection: WorkspaceInspection,
  options: {
    domains?: InfraDomainId[];
    targetPaths?: string[];
    resource?: string;
    store?: KnowledgeStore;
    now?: Date;
  } = {}
): Promise<KnowledgeSourcesReport> {
  const selection = resolveKnowledgeSourceSelection(inspection, options);
  const candidates = await collectWorkspaceKnowledgeSources(inspection, options);
  const store = options.store ?? createFileKnowledgeStore(inspection.knowledgeCache.root);
  const sources = await Promise.all(candidates.map(async candidate => ({
    id: store.buildId(candidate.source),
    domain: candidate.domain,
    targetPath: candidate.targetPath,
    requiresFetch: Boolean(candidate.source.url),
    cacheStatus: await resolveKnowledgeSourceCacheStatus(candidate.source, store, options.now),
    storagePolicy: resolveKnowledgeStoragePolicy(candidate.source),
    source: candidate.source
  })));

  return {
    kind: 'infra-agent.knowledge-sources',
    schemaVersion: 1,
    mutationAllowed: false,
    workspaceRoot: inspection.workspaceRoot,
    cacheRoot: inspection.knowledgeCache.root,
    requestedDomains: selection.requestedDomains,
    ...(selection.resource !== undefined ? { resource: selection.resource } : {}),
    targetPaths: selection.targetPaths,
    sourceCount: sources.length,
    summary: summarizeSources(sources),
    sources
  };
}
