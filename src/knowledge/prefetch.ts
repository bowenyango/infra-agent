import { fetchOfficialKnowledgeSource, retrieveKnowledgeContextPacket } from './retrieve.ts';
import type { KnowledgeFetcher } from './retrieve.ts';
import { createFileKnowledgeStore, type KnowledgeStore } from './knowledge-store.ts';
import {
  resolveKnowledgeSourceCacheStatus,
  type KnowledgeSourceCacheStatus
} from './cache-status.ts';
import {
  isInfraDomain,
  isSafeWorkspaceRelativePath,
  isSecretSafeKnowledgeUrl,
  isSha256Hex,
  targetAllowed
} from './source-config.ts';
import {
  collectConfiguredUnitArtifactRegistrySources,
  configuredRegistrySources,
  registryPrefetchCandidate
} from './unit-artifact-registry.ts';
import { buildHelmChartKnowledgeSources } from '../domain/helm-chart-context.ts';
import { buildPulumiConfigKnowledgeSources } from '../domain/pulumi-config-knowledge.ts';
import { buildPulumiComponentKnowledgeSources } from '../domain/pulumi-components.ts';
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
  previousCacheStatus: KnowledgeSourceCacheStatus;
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
  previousCacheStatus: {
    local: number;
    fresh: number;
    stale: number;
    missing: number;
  };
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

interface CollectWorkspaceKnowledgeSourcesOptions {
  domains?: InfraDomainId[];
  targetPaths?: string[];
  store?: KnowledgeStore;
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

function collectConfiguredCuratedUnitSources(
  inspection: WorkspaceInspection,
  requestedDomains: Set<InfraDomainId>,
  targetPaths: Set<string>
): KnowledgePrefetchCandidate[] {
  const configuredSources = inspection.config?.knowledgeSources?.curatedUnits;
  if (!Array.isArray(configuredSources)) {
    return [];
  }

  const candidates: KnowledgePrefetchCandidate[] = [];
  for (const configuredSource of configuredSources) {
    if (!isInfraDomain(configuredSource.domain) || !requestedDomains.has(configuredSource.domain)) {
      continue;
    }
    if (typeof configuredSource.path !== 'string' || !isSafeWorkspaceRelativePath(configuredSource.path)) {
      continue;
    }

    const targetPath = typeof configuredSource.targetPath === 'string'
      ? configuredSource.targetPath
      : '';
    if (!targetAllowed(targetPath, targetPaths)) {
      continue;
    }

    candidates.push({
      domain: configuredSource.domain,
      targetPath,
      source: {
        kind: 'internal-knowledge',
        name: typeof configuredSource.name === 'string' && configuredSource.name.length > 0
          ? configuredSource.name
          : `curated:${configuredSource.path}`,
        localPath: configuredSource.path,
        ...(typeof configuredSource.version === 'string' && configuredSource.version.length > 0
          ? { version: configuredSource.version }
          : {})
      }
    });
  }

  return candidates;
}

function collectConfiguredUnitArtifactSources(
  inspection: WorkspaceInspection,
  requestedDomains: Set<InfraDomainId>,
  targetPaths: Set<string>
): KnowledgePrefetchCandidate[] {
  const configuredSources = inspection.config?.knowledgeSources?.unitArtifacts;
  if (!Array.isArray(configuredSources)) {
    return [];
  }

  const candidates: KnowledgePrefetchCandidate[] = [];
  for (const configuredSource of configuredSources) {
    if (!isInfraDomain(configuredSource.domain) || !requestedDomains.has(configuredSource.domain)) {
      continue;
    }
    const localPath = typeof configuredSource.path === 'string' && isSafeWorkspaceRelativePath(configuredSource.path)
      ? configuredSource.path
      : null;
    const url = typeof configuredSource.url === 'string' && isSecretSafeKnowledgeUrl(configuredSource.url)
      ? configuredSource.url
      : null;
    if ((localPath === null && url === null) || (localPath !== null && url !== null)) {
      continue;
    }

    const targetPath = typeof configuredSource.targetPath === 'string'
      ? configuredSource.targetPath
      : '';
    if (!targetAllowed(targetPath, targetPaths)) {
      continue;
    }

    candidates.push({
      domain: configuredSource.domain,
      targetPath,
      source: {
        kind: 'knowledge-unit-artifact',
        name: typeof configuredSource.name === 'string' && configuredSource.name.length > 0
          ? configuredSource.name
          : `unit-artifact:${localPath ?? url}`,
        ...(localPath !== null ? { localPath } : {}),
        ...(url !== null ? { url } : {}),
        ...(typeof configuredSource.version === 'string' && configuredSource.version.length > 0
          ? { version: configuredSource.version }
          : {}),
        ...(isSha256Hex(configuredSource.artifactContentHash)
          ? { artifactContentHash: configuredSource.artifactContentHash }
          : {})
      }
    });
  }

  return candidates;
}

export async function collectWorkspaceKnowledgeSources(
  inspection: WorkspaceInspection,
  options: CollectWorkspaceKnowledgeSourcesOptions = {}
): Promise<KnowledgePrefetchCandidate[]> {
  const workspaceRoot = inspection.workspaceRoot;
  const requestedDomains = new Set(resolveRequestedDomains(inspection, options.domains));
  const targetPaths = new Set(options.targetPaths ?? []);
  const store = options.store ?? createFileKnowledgeStore(inspection.knowledgeCache.root);
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

      const componentSources = await buildPulumiComponentKnowledgeSources(workspaceRoot, project);
      candidates.push(...componentSources.map(source => ({
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

  candidates.push(...collectConfiguredCuratedUnitSources(inspection, requestedDomains, targetPaths));
  candidates.push(...collectConfiguredUnitArtifactSources(inspection, requestedDomains, targetPaths));
  candidates.push(...await collectConfiguredUnitArtifactRegistrySources(
    inspection,
    requestedDomains,
    targetPaths,
    store
  ));

  return candidates;
}

function buildSummary(sources: KnowledgePrefetchSourceResult[]): KnowledgePrefetchSummary {
  return {
    local: sources.filter(source => source.status === 'local').length,
    cached: sources.filter(source => source.status === 'cached').length,
    fetched: sources.filter(source => source.status === 'fetched').length,
    staleCache: sources.filter(source => source.status === 'stale-cache').length,
    failed: sources.filter(source => source.status === 'failed').length,
    skipped: sources.filter(source => source.status === 'skipped').length,
    previousCacheStatus: {
      local: sources.filter(source => source.previousCacheStatus === 'local').length,
      fresh: sources.filter(source => source.previousCacheStatus === 'fresh').length,
      stale: sources.filter(source => source.previousCacheStatus === 'stale').length,
      missing: sources.filter(source => source.previousCacheStatus === 'missing').length
    }
  };
}

function sourceResult(
  candidate: KnowledgePrefetchCandidate,
  status: KnowledgePrefetchStatus,
  previousCacheStatus: KnowledgeSourceCacheStatus,
  extra: Partial<Omit<KnowledgePrefetchSourceResult, keyof KnowledgePrefetchCandidate | 'id' | 'status' | 'previousCacheStatus'>> = {},
  buildId: (source: KnowledgeSource) => string = buildKnowledgeCacheId
): KnowledgePrefetchSourceResult {
  return {
    ...candidate,
    id: buildId(candidate.source),
    status,
    previousCacheStatus,
    ...extra
  };
}

async function prefetchConfiguredUnitArtifactRegistries(input: {
  inspection: WorkspaceInspection;
  requestedDomains: InfraDomainId[];
  targetPaths: string[];
  maxSources: number;
  fetcher: KnowledgeFetcher;
  store: KnowledgeStore;
  now?: Date;
  externalSourceCount: number;
}): Promise<{
  sources: KnowledgePrefetchSourceResult[];
  externalSourceCount: number;
}> {
  const requestedDomainSet = new Set(input.requestedDomains);
  const targetPathSet = new Set(input.targetPaths);
  const storeBuildId = (source: KnowledgeSource) => input.store.buildId(source);
  const sources: KnowledgePrefetchSourceResult[] = [];
  let externalSourceCount = input.externalSourceCount;

  for (const registry of configuredRegistrySources(input.inspection, requestedDomainSet, targetPathSet)) {
    const candidate = registryPrefetchCandidate(registry, input.requestedDomains);
    if (!candidate.source.url) {
      sources.push(sourceResult(candidate, 'local', 'local', {
        message: 'Local unit artifact registry does not require prefetch.'
      }, storeBuildId));
      continue;
    }

    const previousCacheStatus = await resolveKnowledgeSourceCacheStatus(candidate.source, input.store, input.now);
    if (externalSourceCount >= input.maxSources) {
      sources.push(sourceResult(candidate, 'skipped', previousCacheStatus, {
        message: `Skipped because maxSources=${input.maxSources} was reached.`
      }, storeBuildId));
      continue;
    }

    externalSourceCount += 1;
    const packet = await retrieveKnowledgeContextPacket({
      store: input.store,
      source: candidate.source,
      reason: `Prefetch knowledge unit registry ${candidate.source.name}`,
      fetcher: input.fetcher,
      now: input.now
    });

    if (!packet) {
      sources.push(sourceResult(candidate, 'failed', previousCacheStatus, {
        message: 'No cached registry was available and fetch returned no content.'
      }, storeBuildId));
      continue;
    }

    sources.push(sourceResult(candidate, previousCacheStatus === 'fresh'
      ? 'cached'
      : packet.confidence === 'medium'
        ? 'stale-cache'
        : 'fetched', previousCacheStatus, {
      confidence: packet.confidence,
      contentType: packet.contentType
    }, storeBuildId));
  }

  return {
    sources,
    externalSourceCount
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
  const registryPrefetch = await prefetchConfiguredUnitArtifactRegistries({
    inspection,
    requestedDomains,
    targetPaths,
    maxSources,
    fetcher,
    store,
    now: options.now,
    externalSourceCount: 0
  });
  const candidates = await collectWorkspaceKnowledgeSources(inspection, {
    domains: requestedDomains,
    targetPaths,
    store
  });
  const sources: KnowledgePrefetchSourceResult[] = [...registryPrefetch.sources];
  let externalSourceCount = registryPrefetch.externalSourceCount;

  for (const candidate of candidates) {
    if (!candidate.source.url) {
      sources.push(sourceResult(candidate, 'local', 'local', {
        message: 'Local source does not require prefetch.'
      }, storeBuildId));
      continue;
    }

    const previousCacheStatus = await resolveKnowledgeSourceCacheStatus(candidate.source, store, options.now);
    if (externalSourceCount >= maxSources) {
      sources.push(sourceResult(candidate, 'skipped', previousCacheStatus, {
        message: `Skipped because maxSources=${maxSources} was reached.`
      }, storeBuildId));
      continue;
    }

    externalSourceCount += 1;
    const packet = await retrieveKnowledgeContextPacket({
      store,
      source: candidate.source,
      reason: `Prefetch ${candidate.domain} docs for ${candidate.targetPath}`,
      fetcher,
      now: options.now
    });

    if (!packet) {
      sources.push(sourceResult(candidate, 'failed', previousCacheStatus, {
        message: 'No cached entry was available and fetch returned no content.'
      }, storeBuildId));
      continue;
    }

    sources.push(sourceResult(candidate, previousCacheStatus === 'fresh'
      ? 'cached'
      : packet.confidence === 'medium'
        ? 'stale-cache'
        : 'fetched', previousCacheStatus, {
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
