import { fetchOfficialKnowledgeSource, retrieveKnowledgeContextPacket } from './retrieve.ts';
import type { KnowledgeFetcher } from './retrieve.ts';
import { createFileKnowledgeStore, type KnowledgeStore } from './knowledge-store.ts';
import { buildHelmChartKnowledgeSources } from '../domain/helm-chart-context.ts';
import { buildPulumiConfigKnowledgeSources } from '../domain/pulumi-config-knowledge.ts';
import { buildPulumiDocsKnowledgeSources } from '../domain/pulumi-docs-context.ts';
import { buildTerraformLocalModuleKnowledgeSources } from '../domain/terraform-local-modules.ts';
import { buildTerraformProviderSchemaKnowledgeSources } from '../domain/terraform-provider-schema.ts';
import { buildTerraformRegistryKnowledgeSources } from '../domain/terraform-registry-context.ts';
import type { InfraDomainId, WorkspaceInspection } from '../types/repository.ts';
import type { KnowledgeContentType, KnowledgeSource, RetrievedContextConfidence } from '../types/knowledge.ts';
import { buildKnowledgeCacheId } from './cache.ts';

export type KnowledgePrefetchStatus =
  | 'local'
  | 'cached'
  | 'fetched'
  | 'stale-cache'
  | 'failed'
  | 'skipped';

export interface KnowledgePrefetchCandidate {
  domain: InfraDomainId;
  targetPath: string;
  source: KnowledgeSource;
}

export interface KnowledgePrefetchSourceResult extends KnowledgePrefetchCandidate {
  id: string;
  status: KnowledgePrefetchStatus;
  confidence?: RetrievedContextConfidence;
  contentType?: KnowledgeContentType;
  message?: string;
}

export interface KnowledgePrefetchSummary {
  local: number;
  cached: number;
  fetched: number;
  staleCache: number;
  failed: number;
  skipped: number;
}

export interface KnowledgePrefetchResult {
  kind: 'infra-agent.knowledge-prefetch';
  schemaVersion: 1;
  workspaceRoot: string;
  cacheRoot: string;
  requestedDomains: InfraDomainId[];
  targetPaths: string[];
  maxSources: number;
  sources: KnowledgePrefetchSourceResult[];
  summary: KnowledgePrefetchSummary;
}

export interface KnowledgePrefetchOptions {
  domains?: InfraDomainId[];
  targetPaths?: string[];
  maxSources?: number;
  fetcher?: KnowledgeFetcher;
  store?: KnowledgeStore;
  now?: Date;
}

function normalizeMaxSources(maxSources: number | undefined): number {
  if (!Number.isInteger(maxSources) || maxSources === undefined) {
    return 10;
  }

  return Math.max(1, maxSources);
}

function resolveRequestedDomains(
  inspection: WorkspaceInspection,
  requestedDomains: InfraDomainId[] | undefined
): InfraDomainId[] {
  if (requestedDomains && requestedDomains.length > 0) {
    return [...new Set(requestedDomains)];
  }

  return inspection.domainCapabilities.map(domain => domain.id);
}

function targetAllowed(targetPath: string, targetPaths: Set<string>): boolean {
  return targetPaths.size === 0 || targetPaths.has(targetPath);
}

export async function collectWorkspaceKnowledgeSources(
  inspection: WorkspaceInspection,
  options: Pick<KnowledgePrefetchOptions, 'domains' | 'targetPaths'> = {}
): Promise<KnowledgePrefetchCandidate[]> {
  const workspaceRoot = inspection.workspaceRoot;
  const requestedDomains = new Set(resolveRequestedDomains(inspection, options.domains));
  const targetPaths = new Set(options.targetPaths ?? []);
  const candidates: KnowledgePrefetchCandidate[] = [];

  if (requestedDomains.has('terraform')) {
    for (const root of inspection.terraformRoots) {
      if (!targetAllowed(root.rootPath, targetPaths)) {
        continue;
      }

      const providerSchemaSources = await buildTerraformProviderSchemaKnowledgeSources(workspaceRoot, root);
      candidates.push(...providerSchemaSources.map(source => ({
        domain: 'terraform' as const,
        targetPath: root.rootPath,
        source
      })));

      const moduleSources = await buildTerraformLocalModuleKnowledgeSources(workspaceRoot, root);
      candidates.push(...moduleSources.map(source => ({
        domain: 'terraform' as const,
        targetPath: root.rootPath,
        source
      })));

      const sources = await buildTerraformRegistryKnowledgeSources(workspaceRoot, root);
      candidates.push(...sources.map(source => ({
        domain: 'terraform' as const,
        targetPath: root.rootPath,
        source
      })));
    }
  }

  if (requestedDomains.has('helm')) {
    for (const chart of inspection.helmCharts) {
      if (!targetAllowed(chart.chartRoot, targetPaths)) {
        continue;
      }

      const sources = await buildHelmChartKnowledgeSources(workspaceRoot, chart);
      candidates.push(...sources.map(source => ({
        domain: 'helm' as const,
        targetPath: chart.chartRoot,
        source
      })));
    }
  }

  if (requestedDomains.has('pulumi')) {
    for (const project of inspection.pulumiProjects) {
      if (!targetAllowed(project.projectRoot, targetPaths)) {
        continue;
      }

      const sources = await buildPulumiConfigKnowledgeSources(workspaceRoot, project);
      candidates.push(...sources.map(source => ({
        domain: 'pulumi' as const,
        targetPath: project.projectRoot,
        source
      })));

      const docsSources = await buildPulumiDocsKnowledgeSources(workspaceRoot, project);
      candidates.push(...docsSources.map(source => ({
        domain: 'pulumi' as const,
        targetPath: project.projectRoot,
        source
      })));
    }
  }

  return candidates;
}

function buildSummary(sources: KnowledgePrefetchSourceResult[]): KnowledgePrefetchSummary {
  return {
    local: sources.filter(source => source.status === 'local').length,
    cached: sources.filter(source => source.status === 'cached').length,
    fetched: sources.filter(source => source.status === 'fetched').length,
    staleCache: sources.filter(source => source.status === 'stale-cache').length,
    failed: sources.filter(source => source.status === 'failed').length,
    skipped: sources.filter(source => source.status === 'skipped').length
  };
}

function sourceResult(
  candidate: KnowledgePrefetchCandidate,
  status: KnowledgePrefetchStatus,
  extra: Partial<Omit<KnowledgePrefetchSourceResult, keyof KnowledgePrefetchCandidate | 'id' | 'status'>> = {},
  buildId: (source: KnowledgeSource) => string = buildKnowledgeCacheId
): KnowledgePrefetchSourceResult {
  return {
    ...candidate,
    id: buildId(candidate.source),
    status,
    ...extra
  };
}

export async function prefetchWorkspaceKnowledge(
  inspection: WorkspaceInspection,
  options: KnowledgePrefetchOptions = {}
): Promise<KnowledgePrefetchResult> {
  const requestedDomains = resolveRequestedDomains(inspection, options.domains);
  const targetPaths = options.targetPaths ?? [];
  const maxSources = normalizeMaxSources(options.maxSources);
  const fetcher = options.fetcher ?? fetchOfficialKnowledgeSource;
  const store = options.store ?? createFileKnowledgeStore(inspection.knowledgeCache.root);
  const storeBuildId = (source: KnowledgeSource) => store.buildId(source);
  const candidates = await collectWorkspaceKnowledgeSources(inspection, {
    domains: requestedDomains,
    targetPaths
  });
  const sources: KnowledgePrefetchSourceResult[] = [];
  let externalSourceCount = 0;

  for (const candidate of candidates) {
    if (!candidate.source.url) {
      sources.push(sourceResult(candidate, 'local', {
        message: 'Local source does not require prefetch.'
      }, storeBuildId));
      continue;
    }

    if (externalSourceCount >= maxSources) {
      sources.push(sourceResult(candidate, 'skipped', {
        message: `Skipped because maxSources=${maxSources} was reached.`
      }, storeBuildId));
      continue;
    }

    externalSourceCount += 1;
    const cachedBefore = await store.read(candidate.source);
    const hadFreshCache = Boolean(cachedBefore && !store.isStale(cachedBefore, options.now));
    const packet = await retrieveKnowledgeContextPacket({
      store,
      source: candidate.source,
      reason: `Prefetch ${candidate.domain} docs for ${candidate.targetPath}`,
      fetcher,
      now: options.now
    });

    if (!packet) {
      sources.push(sourceResult(candidate, 'failed', {
        message: 'No cached entry was available and fetch returned no content.'
      }, storeBuildId));
      continue;
    }

    sources.push(sourceResult(candidate, hadFreshCache
      ? 'cached'
      : packet.confidence === 'medium'
        ? 'stale-cache'
        : 'fetched', {
      confidence: packet.confidence,
      contentType: packet.contentType
    }, storeBuildId));
  }

  return {
    kind: 'infra-agent.knowledge-prefetch',
    schemaVersion: 1,
    workspaceRoot: inspection.workspaceRoot,
    cacheRoot: inspection.knowledgeCache.root,
    requestedDomains,
    targetPaths,
    maxSources,
    sources,
    summary: buildSummary(sources)
  };
}
