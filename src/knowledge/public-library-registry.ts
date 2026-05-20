import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  isInfraDomain,
  isSafeWorkspaceRelativePath,
  isSecretSafeKnowledgeUrl,
  isSha256Hex,
  targetAllowed
} from './source-config.ts';
import { buildTerraformRegistryKnowledgeSources } from '../domain/terraform-registry-context.ts';
import type { KnowledgeStore } from './knowledge-store.ts';
import type { KnowledgePrefetchCandidate } from './prefetch.ts';
import type {
  InfraDomainId,
  TerraformRootSummary,
  WorkspaceInspection,
  WorkspacePublicKnowledgeLibraryRegistrySourceConfig
} from '../types/repository.ts';
import type { KnowledgeSource } from '../types/knowledge.ts';

interface PublicLibraryRegistryEntry {
  coordinates: string;
  ecosystem: 'terraform';
  artifactKind: 'terraform-provider-resource' | 'terraform-provider-data-source';
  providerAddress: string;
  version: string;
  versionRef: {
    value: string;
    kind: 'pinned-version' | 'floating-alias';
    mutable: boolean;
    source: 'url-path';
  };
  versionResolution: {
    requestedVersion: string;
    resolvedVersion?: string;
    status: 'pinned' | 'resolved' | 'unavailable';
    mutable: boolean;
    source: 'url-path' | 'terraform-registry-provider-versions' | 'not-attempted-local-content';
    url?: string;
    fetchedAt?: string;
    reason?: 'content-fixture-no-network' | 'http-error' | 'invalid-response' | 'no-semver-version' | 'fetch-error';
  };
  sourceName: string;
  tags: string[];
  artifact: {
    path?: string;
    url?: string;
    contentHash: string;
    mediaType: 'application/vnd.infra-agent.public-knowledge-library-artifact+json';
    artifactId: string;
    unitPayloadHash: string;
    sourceContentHash: string;
    unitCount: number;
    qualityStatus: 'ready' | 'needs-refinement';
    versionRef: PublicLibraryRegistryEntry['versionRef'];
    versionResolution: PublicLibraryRegistryEntry['versionResolution'];
    reviewRequired: true;
  };
}

const PUBLIC_LIBRARY_ARTIFACT_MEDIA_TYPE = 'application/vnd.infra-agent.public-knowledge-library-artifact+json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVersionRef(value: unknown, version: string): boolean {
  const floating = version === 'latest';
  return isRecord(value)
    && value.value === version
    && value.kind === (floating ? 'floating-alias' : 'pinned-version')
    && value.mutable === floating
    && value.source === 'url-path';
}

function isVersionResolution(value: unknown, version: string): boolean {
  const floating = version === 'latest';
  if (!isRecord(value)
    || value.requestedVersion !== version
    || value.mutable !== floating
    || typeof value.status !== 'string'
    || typeof value.source !== 'string'
  ) {
    return false;
  }

  if (value.url !== undefined && typeof value.url !== 'string') {
    return false;
  }
  if (value.fetchedAt !== undefined && typeof value.fetchedAt !== 'string') {
    return false;
  }
  if (value.reason !== undefined && typeof value.reason !== 'string') {
    return false;
  }

  if (!floating) {
    return value.status === 'pinned'
      && value.resolvedVersion === version
      && value.source === 'url-path';
  }

  if (value.status === 'resolved') {
    return typeof value.resolvedVersion === 'string'
      && value.resolvedVersion.length > 0
      && value.source === 'terraform-registry-provider-versions';
  }

  return value.status === 'unavailable'
    && value.resolvedVersion === undefined
    && (
      value.source === 'terraform-registry-provider-versions'
      || value.source === 'not-attempted-local-content'
    );
}

function configuredPublicLibraryRegistries(
  inspection: WorkspaceInspection,
  requestedDomains: Set<InfraDomainId>,
  targetPaths: Set<string>
): WorkspacePublicKnowledgeLibraryRegistrySourceConfig[] {
  const configuredSources = inspection.config?.knowledgeSources?.publicLibraryRegistries;
  if (!Array.isArray(configuredSources) || !requestedDomains.has('terraform')) {
    return [];
  }

  return configuredSources.filter(configuredSource => {
    if (configuredSource.domain !== undefined && (!isInfraDomain(configuredSource.domain) || configuredSource.domain !== 'terraform')) {
      return false;
    }

    if (
      typeof configuredSource.targetPath === 'string'
      && configuredSource.targetPath.length > 0
      && !targetAllowed(configuredSource.targetPath, targetPaths)
    ) {
      return false;
    }

    const localPath = typeof configuredSource.path === 'string' && isSafeWorkspaceRelativePath(configuredSource.path);
    const url = typeof configuredSource.url === 'string' && isSecretSafeKnowledgeUrl(configuredSource.url);

    return localPath !== url;
  });
}

function registrySourceFromConfig(configuredSource: WorkspacePublicKnowledgeLibraryRegistrySourceConfig): KnowledgeSource | null {
  const localPath = typeof configuredSource.path === 'string' && isSafeWorkspaceRelativePath(configuredSource.path)
    ? configuredSource.path
    : null;
  const url = typeof configuredSource.url === 'string' && isSecretSafeKnowledgeUrl(configuredSource.url)
    ? configuredSource.url
    : null;
  if ((localPath === null && url === null) || (localPath !== null && url !== null)) {
    return null;
  }

  return {
    kind: 'public-knowledge-library-registry',
    name: typeof configuredSource.name === 'string' && configuredSource.name.length > 0
      ? configuredSource.name
      : `public-library-registry:${localPath ?? url}`,
    ...(localPath !== null ? { localPath } : {}),
    ...(url !== null ? { url } : {}),
    ...(typeof configuredSource.version === 'string' && configuredSource.version.length > 0
      ? { version: configuredSource.version }
      : {}),
    ...(typeof configuredSource.provider === 'string' && configuredSource.provider.length > 0
      ? { provider: configuredSource.provider }
      : {})
  };
}

function readPublicLibraryRegistryEntry(value: unknown): PublicLibraryRegistryEntry | null {
  if (!isRecord(value) || !isRecord(value.artifact)) {
    return null;
  }

  const artifactLocalPath = typeof value.artifact.path === 'string' && isSafeWorkspaceRelativePath(value.artifact.path);
  const artifactUrl = typeof value.artifact.url === 'string' && isSecretSafeKnowledgeUrl(value.artifact.url);
  if (
    typeof value.coordinates !== 'string'
    || value.ecosystem !== 'terraform'
    || (
      value.artifactKind !== 'terraform-provider-resource'
      && value.artifactKind !== 'terraform-provider-data-source'
    )
    || typeof value.providerAddress !== 'string'
    || typeof value.version !== 'string'
    || !isVersionRef(value.versionRef, value.version)
    || !isVersionResolution(value.versionResolution, value.version)
    || typeof value.sourceName !== 'string'
    || !Array.isArray(value.tags)
    || !value.tags.every(tag => typeof tag === 'string')
    || artifactLocalPath === artifactUrl
    || !isSha256Hex(value.artifact.contentHash)
    || value.artifact.mediaType !== PUBLIC_LIBRARY_ARTIFACT_MEDIA_TYPE
    || typeof value.artifact.artifactId !== 'string'
    || !isSha256Hex(value.artifact.unitPayloadHash)
    || !isSha256Hex(value.artifact.sourceContentHash)
    || !Number.isInteger(value.artifact.unitCount)
    || !isVersionRef(value.artifact.versionRef, value.version)
    || !isVersionResolution(value.artifact.versionResolution, value.version)
    || (
      value.artifact.qualityStatus !== 'ready'
      && value.artifact.qualityStatus !== 'needs-refinement'
    )
    || value.artifact.reviewRequired !== true
  ) {
    return null;
  }

  return value as unknown as PublicLibraryRegistryEntry;
}

function parsePublicLibraryRegistryEntries(value: unknown): PublicLibraryRegistryEntry[] {
  if (
    !isRecord(value)
    || value.kind !== 'infra-agent.public-knowledge-library-registry'
    || value.schemaVersion !== 1
    || value.mutationAllowed !== false
    || !Array.isArray(value.entries)
  ) {
    return [];
  }

  return value.entries
    .map(readPublicLibraryRegistryEntry)
    .filter((entry): entry is PublicLibraryRegistryEntry => entry !== null);
}

async function readConfiguredRegistryEntries(
  inspection: WorkspaceInspection,
  configuredSource: WorkspacePublicKnowledgeLibraryRegistrySourceConfig,
  store: KnowledgeStore
): Promise<PublicLibraryRegistryEntry[]> {
  const source = registrySourceFromConfig(configuredSource);
  if (source === null) {
    return [];
  }

  try {
    const content = source.localPath
      ? await readFile(join(inspection.workspaceRoot, source.localPath), 'utf8')
      : (await store.read(source))?.content;
    if (content === undefined) {
      return [];
    }

    return parsePublicLibraryRegistryEntries(JSON.parse(content) as unknown);
  } catch {
    return [];
  }
}

function configuredSourceAllowsEntry(
  configuredSource: WorkspacePublicKnowledgeLibraryRegistrySourceConfig,
  entry: PublicLibraryRegistryEntry
): boolean {
  if (typeof configuredSource.provider === 'string' && configuredSource.provider !== entry.providerAddress) {
    return false;
  }

  if (typeof configuredSource.version === 'string' && configuredSource.version !== entry.version) {
    return false;
  }

  return true;
}

function publicLibrarySourceFromEntry(
  entry: PublicLibraryRegistryEntry,
  registrySource: KnowledgeSource
): KnowledgeSource | null {
  const localPath = typeof entry.artifact.path === 'string' && isSafeWorkspaceRelativePath(entry.artifact.path)
    ? entry.artifact.path
    : null;
  const explicitUrl = typeof entry.artifact.url === 'string' && isSecretSafeKnowledgeUrl(entry.artifact.url)
    ? entry.artifact.url
    : null;
  const relativeUrl = localPath !== null && registrySource.url !== undefined
    ? new URL(localPath, registrySource.url).toString()
    : null;
  const url = explicitUrl ?? (
    relativeUrl !== null && isSecretSafeKnowledgeUrl(relativeUrl)
      ? relativeUrl
      : null
  );
  if (registrySource.localPath && localPath === null) {
    return null;
  }
  if (registrySource.url && url === null) {
    return null;
  }

  return {
    kind: 'public-knowledge-library-artifact',
    name: entry.sourceName,
    ...(registrySource.localPath && localPath !== null ? { localPath } : {}),
    ...(registrySource.url && url !== null ? { url } : {}),
    version: entry.version,
    provider: entry.providerAddress,
    artifactContentHash: entry.artifact.contentHash
  };
}

async function terraformTargetUsesPublicLibraryEntry(
  inspection: WorkspaceInspection,
  root: TerraformRootSummary,
  entry: PublicLibraryRegistryEntry
): Promise<boolean> {
  const sources = await buildTerraformRegistryKnowledgeSources(inspection.workspaceRoot, root);
  return sources.some(source =>
    source.name === entry.sourceName
    && source.provider === entry.providerAddress
  );
}

async function targetPathsForPublicLibraryEntry(
  inspection: WorkspaceInspection,
  configuredSource: WorkspacePublicKnowledgeLibraryRegistrySourceConfig,
  entry: PublicLibraryRegistryEntry,
  requestedTargetPaths: Set<string>
): Promise<string[]> {
  if (typeof configuredSource.targetPath === 'string' && configuredSource.targetPath.length > 0) {
    const root = inspection.terraformRoots.find(candidate => candidate.rootPath === configuredSource.targetPath);
    if (
      root
      && targetAllowed(root.rootPath, requestedTargetPaths)
      && await terraformTargetUsesPublicLibraryEntry(inspection, root, entry)
    ) {
      return [root.rootPath];
    }

    return [];
  }

  const matchedTargets: string[] = [];
  for (const root of inspection.terraformRoots) {
    if (!targetAllowed(root.rootPath, requestedTargetPaths)) {
      continue;
    }

    if (await terraformTargetUsesPublicLibraryEntry(inspection, root, entry)) {
      matchedTargets.push(root.rootPath);
    }
  }

  return matchedTargets;
}

export async function collectConfiguredPublicLibraryRegistrySources(
  inspection: WorkspaceInspection,
  requestedDomains: Set<InfraDomainId>,
  targetPaths: Set<string>,
  store: KnowledgeStore
): Promise<KnowledgePrefetchCandidate[]> {
  const candidates: KnowledgePrefetchCandidate[] = [];
  for (const configuredSource of configuredPublicLibraryRegistries(inspection, requestedDomains, targetPaths)) {
    const registrySource = registrySourceFromConfig(configuredSource);
    if (registrySource === null) {
      continue;
    }

    const entries = await readConfiguredRegistryEntries(inspection, configuredSource, store);
    for (const entry of entries) {
      if (!configuredSourceAllowsEntry(configuredSource, entry)) {
        continue;
      }

      const resolvedTargetPaths = await targetPathsForPublicLibraryEntry(
        inspection,
        configuredSource,
        entry,
        targetPaths
      );

      candidates.push(...resolvedTargetPaths.map(targetPath => ({
        domain: 'terraform' as const,
        targetPath,
        source: publicLibrarySourceFromEntry(entry, registrySource)
      })).filter((candidate): candidate is KnowledgePrefetchCandidate => candidate.source !== null));
    }
  }

  return candidates;
}

export function configuredPublicLibraryRegistrySources(
  inspection: WorkspaceInspection,
  requestedDomains: Set<InfraDomainId>,
  targetPaths: Set<string>
): KnowledgePrefetchCandidate[] {
  return configuredPublicLibraryRegistries(inspection, requestedDomains, targetPaths)
    .map(configuredSource => {
      const source = registrySourceFromConfig(configuredSource);
      if (source === null) {
        return null;
      }

      return {
        domain: 'terraform' as const,
        targetPath: typeof configuredSource.targetPath === 'string' ? configuredSource.targetPath : '',
        source
      };
    })
    .filter((candidate): candidate is KnowledgePrefetchCandidate => candidate !== null);
}
