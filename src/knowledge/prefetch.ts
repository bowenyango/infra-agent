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
import { CANONICAL_PUBLIC_EXTRACTION_TARGETS } from './public-extraction-targets.ts';
import {
  collectConfiguredUnitArtifactRegistrySources,
  configuredRegistrySources,
  registryPrefetchCandidate
} from './unit-artifact-registry.ts';
import {
  collectConfiguredPublicLibraryRegistrySources,
  configuredPublicLibraryRegistrySources
} from './public-library-registry.ts';
import { buildScopedPackReport } from '../domain/scoped-pack.ts';
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
  resource?: string;
  targetPaths: string[];
  maxSources: number;
  sources: KnowledgePrefetchSourceResult[];
  summary: KnowledgePrefetchSummary;
}

export interface KnowledgePrefetchOptions {
  domains?: InfraDomainId[];
  targetPaths?: string[];
  resource?: string;
  maxSources?: number;
  fetcher?: KnowledgeFetcher;
  store?: KnowledgeStore;
  now?: Date;
}

interface CollectWorkspaceKnowledgeSourcesOptions {
  domains?: InfraDomainId[];
  targetPaths?: string[];
  resource?: string;
  store?: KnowledgeStore;
}

export interface KnowledgeSourceSelection {
  requestedDomains: InfraDomainId[];
  targetPaths: string[];
  resource?: string;
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

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).filter(Boolean))).sort();
}

function normalizeIdentity(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').replace(/\/$/, '').toLowerCase();
}

function identityMatches(resource: string, identities: Iterable<string | null | undefined>): boolean {
  const normalizedResource = normalizeIdentity(resource);
  for (const identity of identities) {
    if (typeof identity === 'string' && normalizeIdentity(identity) === normalizedResource) {
      return true;
    }
  }

  return false;
}

function terraformUsageIdentities(usage: WorkspaceInspection['terraformRoots'][number]['resourceUsages'][number]): string[] {
  return [
    usage.typeName,
    `${usage.typeName}.${usage.name}`,
    usage.sourceLocator,
    usage.kind === 'data-source' ? `data.${usage.typeName}.${usage.name}` : null,
    usage.kind === 'resource' ? `resource.${usage.typeName}.${usage.name}` : null,
    usage.kind === 'data-source' ? `data:${usage.typeName}` : null,
    usage.kind === 'resource' ? `resource:${usage.typeName}` : null
  ].filter((value): value is string => Boolean(value));
}

function pulumiTokenIdentities(token: WorkspaceInspection['pulumiProjects'][number]['resourceTokens'][number]): string[] {
  return [
    token.name,
    token.type,
    `${token.type}.${token.name}`,
    `pulumi:${token.type}`,
    `@pulumi/${token.packageName}`,
    token.packageName,
    token.moduleName,
    token.typeName,
    token.evidence?.sourceLocator
  ].filter((value): value is string => Boolean(value));
}

function matchedTerraformResourceUsages(
  inspection: WorkspaceInspection,
  targetPath: string,
  resource: string
): WorkspaceInspection['terraformRoots'][number]['resourceUsages'] {
  const root = inspection.terraformRoots.find(candidate => candidate.rootPath === targetPath);
  if (!root) {
    return [];
  }

  return root.resourceUsages.filter(usage => identityMatches(resource, terraformUsageIdentities(usage)));
}

function matchedPulumiResourceTokens(
  inspection: WorkspaceInspection,
  targetPath: string,
  resource: string
): WorkspaceInspection['pulumiProjects'][number]['resourceTokens'] {
  const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === targetPath);
  if (!project) {
    return [];
  }

  return project.resourceTokens.filter(token => identityMatches(resource, pulumiTokenIdentities(token)));
}

function terraformSourceAllowedForResource(input: {
  inspection: WorkspaceInspection;
  targetPath: string;
  resource: string;
  source: KnowledgeSource;
}): boolean {
  if (
    input.source.kind !== 'terraform-registry'
    && input.source.kind !== 'public-knowledge-library-artifact'
  ) {
    return false;
  }

  const matchedUsages = matchedTerraformResourceUsages(input.inspection, input.targetPath, input.resource);
  if (matchedUsages.length === 0) {
    return false;
  }

  return matchedUsages.some(usage =>
    input.source.name === `${usage.kind === 'data-source' ? 'data-source' : 'resource'}:${usage.typeName}`
  );
}

function pulumiSourceAllowedForResource(input: {
  inspection: WorkspaceInspection;
  targetPath: string;
  resource: string;
  source: KnowledgeSource;
}): boolean {
  if (
    input.source.kind !== 'pulumi-docs'
    && input.source.kind !== 'public-knowledge-library-artifact'
  ) {
    return false;
  }
  if (input.source.kind === 'pulumi-docs' && !input.source.name.startsWith('pulumi-docs:resource:')) {
    return false;
  }

  const matchedTokens = matchedPulumiResourceTokens(input.inspection, input.targetPath, input.resource);
  if (matchedTokens.length === 0) {
    return false;
  }

  return matchedTokens.some(token => input.source.module === token.type);
}

function sourceAllowedForResource(
  inspection: WorkspaceInspection,
  candidate: KnowledgePrefetchCandidate,
  resource: string
): boolean {
  if (candidate.domain === 'helm') {
    return true;
  }

  if (candidate.domain === 'terraform') {
    return terraformSourceAllowedForResource({
      inspection,
      targetPath: candidate.targetPath,
      resource,
      source: candidate.source
    });
  }

  if (candidate.domain === 'pulumi') {
    return pulumiSourceAllowedForResource({
      inspection,
      targetPath: candidate.targetPath,
      resource,
      source: candidate.source
    });
  }

  return false;
}

function filterResourceScopedCandidates(
  inspection: WorkspaceInspection,
  candidates: KnowledgePrefetchCandidate[],
  resource: string | undefined
): KnowledgePrefetchCandidate[] {
  if (resource === undefined) {
    return candidates;
  }

  return candidates.filter(candidate => sourceAllowedForResource(inspection, candidate, resource));
}

export function resolveKnowledgeSourceSelection(
  inspection: WorkspaceInspection,
  options: {
    domains?: InfraDomainId[];
    targetPaths?: string[];
    resource?: string;
  } = {}
): KnowledgeSourceSelection {
  const requestedDomains = resolveRequestedDomains(inspection, options.domains);
  const resource = options.resource?.trim();

  if (resource && resource.length > 0) {
    const scopedPack = buildScopedPackReport(inspection, {
      scope: resource,
      domains: requestedDomains
    });

    return {
      requestedDomains,
      resource,
      targetPaths: uniqueSorted(scopedPack.targets.map(target => target.path))
    };
  }

  return {
    requestedDomains,
    targetPaths: options.targetPaths ?? []
  };
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

function collectCanonicalPublicExtractionTargetSources(
  requestedDomains: Set<InfraDomainId>,
  targetPaths: Set<string>
): KnowledgePrefetchCandidate[] {
  if (targetPaths.size === 0) {
    return [];
  }

  return CANONICAL_PUBLIC_EXTRACTION_TARGETS
    .filter(target =>
      requestedDomains.has(target.domain)
      && targetAllowed(target.targetPath, targetPaths)
    )
    .map(target => ({
      domain: target.domain,
      targetPath: target.targetPath,
      source: target.source
    }));
}

export async function collectWorkspaceKnowledgeSources(
  inspection: WorkspaceInspection,
  options: CollectWorkspaceKnowledgeSourcesOptions = {}
): Promise<KnowledgePrefetchCandidate[]> {
  const workspaceRoot = inspection.workspaceRoot;
  const selection = resolveKnowledgeSourceSelection(inspection, options);
  if (selection.resource !== undefined && selection.targetPaths.length === 0) {
    return [];
  }

  const requestedDomains = new Set(selection.requestedDomains);
  const targetPaths = new Set(selection.targetPaths);
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
  candidates.push(...collectCanonicalPublicExtractionTargetSources(requestedDomains, targetPaths));
  candidates.push(...await collectConfiguredUnitArtifactRegistrySources(
    inspection,
    requestedDomains,
    targetPaths,
    store
  ));
  candidates.push(...await collectConfiguredPublicLibraryRegistrySources(
    inspection,
    requestedDomains,
    targetPaths,
    store
  ));

  return filterResourceScopedCandidates(inspection, candidates, selection.resource);
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

async function prefetchConfiguredPublicLibraryRegistries(input: {
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

  for (const candidate of configuredPublicLibraryRegistrySources(input.inspection, requestedDomainSet, targetPathSet)) {
    if (!candidate.source.url) {
      sources.push(sourceResult(candidate, 'local', 'local', {
        message: 'Local public knowledge library registry does not require prefetch.'
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
      reason: `Prefetch public knowledge library registry ${candidate.source.name}`,
      fetcher: input.fetcher,
      now: input.now
    });

    if (!packet) {
      sources.push(sourceResult(candidate, 'failed', previousCacheStatus, {
        message: 'No cached public library registry was available and fetch returned no content.'
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
  const selection = resolveKnowledgeSourceSelection(inspection, options);
  const requestedDomains = selection.requestedDomains;
  const targetPaths = selection.targetPaths;
  const maxSources = normalizeMaxSources(options.maxSources);
  const fetcher = options.fetcher ?? fetchOfficialKnowledgeSource;
  const store = options.store ?? createFileKnowledgeStore(inspection.knowledgeCache.root);
  const storeBuildId = (source: KnowledgeSource) => store.buildId(source);
  const registryPrefetch = selection.resource !== undefined
    ? { sources: [], externalSourceCount: 0 }
    : await prefetchConfiguredUnitArtifactRegistries({
        inspection,
        requestedDomains,
        targetPaths,
        maxSources,
        fetcher,
        store,
        now: options.now,
        externalSourceCount: 0
      });
  const publicLibraryRegistryPrefetch = await prefetchConfiguredPublicLibraryRegistries({
    inspection,
    requestedDomains,
    targetPaths,
    maxSources,
    fetcher,
    store,
    now: options.now,
    externalSourceCount: registryPrefetch.externalSourceCount
  });
  const candidates = await collectWorkspaceKnowledgeSources(inspection, {
    domains: requestedDomains,
    targetPaths,
    resource: selection.resource,
    store
  });
  const sources: KnowledgePrefetchSourceResult[] = [
    ...registryPrefetch.sources,
    ...publicLibraryRegistryPrefetch.sources
  ];
  let externalSourceCount = publicLibraryRegistryPrefetch.externalSourceCount;

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
    ...(selection.resource !== undefined ? { resource: selection.resource } : {}),
    targetPaths,
    maxSources,
    sources,
    summary: buildSummary(sources)
  };
}
