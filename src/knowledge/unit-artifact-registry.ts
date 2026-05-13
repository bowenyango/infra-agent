import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  isInfraDomain,
  isSafeWorkspaceRelativePath,
  isSecretSafeKnowledgeUrl,
  isSha256Hex,
  targetAllowed
} from './source-config.ts';
import type { KnowledgeStore } from './knowledge-store.ts';
import type { KnowledgePrefetchCandidate } from './prefetch.ts';
import type {
  InfraDomainId,
  WorkspaceInspection,
  WorkspaceKnowledgeUnitArtifactRegistrySourceConfig
} from '../types/repository.ts';
import type { KnowledgeSource } from '../types/knowledge.ts';

export interface UnitArtifactRegistrySource {
  config: WorkspaceKnowledgeUnitArtifactRegistrySourceConfig;
  source: KnowledgeSource;
}

interface UnitArtifactRegistryEntry {
  domain?: InfraDomainId;
  targetPath?: string;
  path?: string;
  url?: string;
  name?: string;
  version?: string;
  artifactContentHash?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function domainTargetPaths(inspection: WorkspaceInspection, domain: InfraDomainId): string[] {
  switch (domain) {
    case 'helm':
      return inspection.helmCharts.map(chart => chart.chartRoot);
    case 'pulumi':
      return inspection.pulumiProjects.map(project => project.projectRoot);
    case 'terraform':
      return inspection.terraformRoots.map(root => root.rootPath);
  }
}

function resolveRegistryEntryTargetPaths(
  inspection: WorkspaceInspection,
  domain: InfraDomainId,
  targetPath: string | undefined,
  requestedTargetPaths: Set<string>
): string[] {
  if (typeof targetPath === 'string' && targetPath.length > 0) {
    return targetAllowed(targetPath, requestedTargetPaths) ? [targetPath] : [];
  }

  const detectedTargets = domainTargetPaths(inspection, domain);
  const candidateTargets = detectedTargets.length > 0 ? detectedTargets : [''];
  return candidateTargets.filter(candidate => targetAllowed(candidate, requestedTargetPaths));
}

export function configuredRegistrySources(
  inspection: WorkspaceInspection,
  requestedDomains: Set<InfraDomainId>,
  targetPaths: Set<string>
): UnitArtifactRegistrySource[] {
  const configuredSources = inspection.config?.knowledgeSources?.unitArtifactRegistries;
  if (!Array.isArray(configuredSources)) {
    return [];
  }

  const sources: UnitArtifactRegistrySource[] = [];
  for (const configuredSource of configuredSources) {
    if (configuredSource.domain !== undefined) {
      if (!isInfraDomain(configuredSource.domain) || !requestedDomains.has(configuredSource.domain)) {
        continue;
      }
    }

    if (
      typeof configuredSource.targetPath === 'string'
      && configuredSource.targetPath.length > 0
      && !targetAllowed(configuredSource.targetPath, targetPaths)
    ) {
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

    sources.push({
      config: configuredSource,
      source: {
        kind: 'knowledge-unit-registry',
        name: typeof configuredSource.name === 'string' && configuredSource.name.length > 0
          ? configuredSource.name
          : `unit-artifact-registry:${localPath ?? url}`,
        ...(localPath !== null ? { localPath } : {}),
        ...(url !== null ? { url } : {}),
        ...(typeof configuredSource.version === 'string' && configuredSource.version.length > 0
          ? { version: configuredSource.version }
          : {})
      }
    });
  }

  return sources;
}

function parseRegistryArtifactEntries(
  value: unknown,
  configuredSource: WorkspaceKnowledgeUnitArtifactRegistrySourceConfig
): UnitArtifactRegistryEntry[] {
  if (!isRecord(value)
    || value.kind !== 'infra-agent.knowledge-unit-registry'
    || value.schemaVersion !== 1
    || value.mutationAllowed !== false
    || !Array.isArray(value.entries)
  ) {
    return [];
  }

  const entries: UnitArtifactRegistryEntry[] = [];
  for (const entry of value.entries) {
    if (!isRecord(entry)) {
      continue;
    }

    const artifact = isRecord(entry.artifact) ? entry.artifact : entry;
    const domain = isInfraDomain(entry.domain)
      ? entry.domain
      : configuredSource.domain;
    if (!isInfraDomain(domain)) {
      continue;
    }

    entries.push({
      domain,
      targetPath: typeof entry.targetPath === 'string'
        ? entry.targetPath
        : configuredSource.targetPath,
      path: typeof artifact.path === 'string' ? artifact.path : undefined,
      url: typeof artifact.url === 'string' ? artifact.url : undefined,
      name: typeof artifact.name === 'string' ? artifact.name : undefined,
      version: typeof artifact.version === 'string' ? artifact.version : undefined,
      artifactContentHash: isSha256Hex(artifact.contentHash)
        ? artifact.contentHash
        : undefined
    });
  }

  return entries;
}

async function readRegistryArtifactEntries(
  inspection: WorkspaceInspection,
  registry: UnitArtifactRegistrySource,
  store: KnowledgeStore
): Promise<UnitArtifactRegistryEntry[]> {
  try {
    const content = registry.source.localPath
      ? await readFile(join(inspection.workspaceRoot, registry.source.localPath), 'utf8')
      : (await store.read(registry.source))?.content;
    if (content === undefined) {
      return [];
    }

    return parseRegistryArtifactEntries(JSON.parse(content) as unknown, registry.config);
  } catch {
    return [];
  }
}

function unitArtifactCandidateFromRegistryEntry(
  inspection: WorkspaceInspection,
  entry: UnitArtifactRegistryEntry,
  requestedDomains: Set<InfraDomainId>,
  targetPaths: Set<string>
): KnowledgePrefetchCandidate[] {
  if (!entry.domain || !requestedDomains.has(entry.domain)) {
    return [];
  }

  const localPath = typeof entry.path === 'string' && isSafeWorkspaceRelativePath(entry.path)
    ? entry.path
    : null;
  const url = typeof entry.url === 'string' && isSecretSafeKnowledgeUrl(entry.url)
    ? entry.url
    : null;
  if ((localPath === null && url === null) || (localPath !== null && url !== null)) {
    return [];
  }

  const resolvedTargetPaths = resolveRegistryEntryTargetPaths(
    inspection,
    entry.domain,
    entry.targetPath,
    targetPaths
  );

  return resolvedTargetPaths.map(targetPath => ({
    domain: entry.domain as InfraDomainId,
    targetPath,
    source: {
      kind: 'knowledge-unit-artifact',
      name: typeof entry.name === 'string' && entry.name.length > 0
        ? entry.name
        : `unit-artifact:${localPath ?? url}`,
      ...(localPath !== null ? { localPath } : {}),
      ...(url !== null ? { url } : {}),
      ...(typeof entry.version === 'string' && entry.version.length > 0
        ? { version: entry.version }
        : {}),
      ...(isSha256Hex(entry.artifactContentHash)
        ? { artifactContentHash: entry.artifactContentHash }
        : {})
    }
  }));
}

export async function collectConfiguredUnitArtifactRegistrySources(
  inspection: WorkspaceInspection,
  requestedDomains: Set<InfraDomainId>,
  targetPaths: Set<string>,
  store: KnowledgeStore
): Promise<KnowledgePrefetchCandidate[]> {
  const candidates: KnowledgePrefetchCandidate[] = [];
  for (const registry of configuredRegistrySources(inspection, requestedDomains, targetPaths)) {
    const entries = await readRegistryArtifactEntries(inspection, registry, store);
    for (const entry of entries) {
      candidates.push(...unitArtifactCandidateFromRegistryEntry(
        inspection,
        entry,
        requestedDomains,
        targetPaths
      ));
    }
  }

  return candidates;
}

export function registryPrefetchCandidate(
  registry: UnitArtifactRegistrySource,
  requestedDomains: InfraDomainId[]
): KnowledgePrefetchCandidate {
  return {
    domain: isInfraDomain(registry.config.domain)
      ? registry.config.domain
      : requestedDomains[0] ?? 'terraform',
    targetPath: typeof registry.config.targetPath === 'string'
      ? registry.config.targetPath
      : '',
    source: registry.source
  };
}
