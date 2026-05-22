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
  HelmChartSummary,
  InfraDomainId,
  PulumiProjectSummary,
  TerraformRootSummary,
  WorkspaceInspection,
  WorkspacePublicKnowledgeLibraryRegistrySourceConfig
} from '../types/repository.ts';
import {
  KNOWLEDGE_UNIT_TYPES,
  type KnowledgeSource,
  type KnowledgeUnitType
} from '../types/knowledge.ts';

interface PublicLibraryRegistryEntry {
  coordinates: string;
  ecosystem: 'terraform' | 'pulumi' | 'helm';
  artifactKind:
    | 'terraform-provider-resource'
    | 'terraform-provider-data-source'
    | 'pulumi-package-resource'
    | 'helm-chart-docs';
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
  resourceToken?: string;
  repository?: string;
  chart?: string;
  tags: string[];
  llmRefinement: {
    status: 'not-run';
    mode: 'offline-review';
    inputRef: 'artifact.llmRefinementInput';
    reviewPacketHash: string;
    outputContract: 'infra-agent.public-knowledge-url-report';
    unitTypes: KnowledgeUnitType[];
    unitCounts: Record<KnowledgeUnitType, number>;
    missingUnitTypes: KnowledgeUnitType[];
    qualityStatus: 'ready' | 'needs-refinement';
    qualityScore: number;
    qualityWarningCount: number;
    reviewRequired: true;
  };
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

function artifactKindMatchesEcosystem(ecosystem: unknown, artifactKind: unknown): boolean {
  if (ecosystem === 'terraform') {
    return artifactKind === 'terraform-provider-resource'
      || artifactKind === 'terraform-provider-data-source';
  }

  if (ecosystem === 'pulumi') {
    return artifactKind === 'pulumi-package-resource';
  }

  if (ecosystem === 'helm') {
    return artifactKind === 'helm-chart-docs';
  }

  return false;
}

function requiredMetadataMatchesEcosystem(value: Record<string, unknown>): boolean {
  if (value.ecosystem === 'pulumi') {
    return typeof value.resourceToken === 'string' && value.resourceToken.length > 0;
  }

  if (value.ecosystem === 'helm') {
    return typeof value.chart === 'string' && value.chart.length > 0;
  }

  return true;
}

function isLlmRefinementSummary(value: unknown): boolean {
  return isRecord(value)
    && value.status === 'not-run'
    && value.mode === 'offline-review'
    && value.inputRef === 'artifact.llmRefinementInput'
    && isSha256Hex(value.reviewPacketHash)
    && value.outputContract === 'infra-agent.public-knowledge-url-report'
    && Array.isArray(value.unitTypes)
    && KNOWLEDGE_UNIT_TYPES.every(unitType => value.unitTypes.includes(unitType))
    && isRecord(value.unitCounts)
    && KNOWLEDGE_UNIT_TYPES.every(unitType =>
      Number.isInteger(value.unitCounts[unitType])
      && Number(value.unitCounts[unitType]) >= 0
    )
    && Array.isArray(value.missingUnitTypes)
    && value.missingUnitTypes.every(unitType =>
      KNOWLEDGE_UNIT_TYPES.includes(unitType as KnowledgeUnitType)
    )
    && (value.qualityStatus === 'ready' || value.qualityStatus === 'needs-refinement')
    && Number.isInteger(value.qualityScore)
    && Number(value.qualityScore) >= 0
    && Number(value.qualityScore) <= 100
    && Number.isInteger(value.qualityWarningCount)
    && Number(value.qualityWarningCount) >= 0
    && value.reviewRequired === true;
}

function configuredPublicLibraryRegistries(
  inspection: WorkspaceInspection,
  requestedDomains: Set<InfraDomainId>,
  targetPaths: Set<string>
): WorkspacePublicKnowledgeLibraryRegistrySourceConfig[] {
  const configuredSources = inspection.config?.knowledgeSources?.publicLibraryRegistries;
  if (!Array.isArray(configuredSources)) {
    return [];
  }

  return configuredSources.filter(configuredSource => {
    if (configuredSource.domain !== undefined && (!isInfraDomain(configuredSource.domain) || !requestedDomains.has(configuredSource.domain))) {
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
      : {}),
    ...(typeof configuredSource.packageName === 'string' && configuredSource.packageName.length > 0
      ? { packageName: configuredSource.packageName }
      : {}),
    ...(typeof configuredSource.chart === 'string' && configuredSource.chart.length > 0
      ? { chart: configuredSource.chart }
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
    || (value.ecosystem !== 'terraform' && value.ecosystem !== 'pulumi' && value.ecosystem !== 'helm')
    || (
      value.artifactKind !== 'terraform-provider-resource'
      && value.artifactKind !== 'terraform-provider-data-source'
      && value.artifactKind !== 'pulumi-package-resource'
      && value.artifactKind !== 'helm-chart-docs'
    )
    || !artifactKindMatchesEcosystem(value.ecosystem, value.artifactKind)
    || typeof value.providerAddress !== 'string'
    || typeof value.version !== 'string'
    || !isVersionRef(value.versionRef, value.version)
    || !isVersionResolution(value.versionResolution, value.version)
    || typeof value.sourceName !== 'string'
    || (value.resourceToken !== undefined && typeof value.resourceToken !== 'string')
    || (value.repository !== undefined && typeof value.repository !== 'string')
    || (value.chart !== undefined && typeof value.chart !== 'string')
    || !requiredMetadataMatchesEcosystem(value)
    || !Array.isArray(value.tags)
    || !value.tags.every(tag => typeof tag === 'string')
    || !isLlmRefinementSummary(value.llmRefinement)
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
  if (isInfraDomain(configuredSource.domain) && configuredSource.domain !== entry.ecosystem) {
    return false;
  }

  if (typeof configuredSource.provider === 'string' && configuredSource.provider !== entry.providerAddress) {
    return false;
  }

  if (typeof configuredSource.packageName === 'string' && configuredSource.packageName !== entry.providerAddress) {
    return false;
  }

  if (typeof configuredSource.chart === 'string' && configuredSource.chart !== entry.chart) {
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
    ...(entry.ecosystem === 'terraform' ? { provider: entry.providerAddress } : {}),
    ...(entry.ecosystem === 'pulumi' ? { packageName: entry.providerAddress } : {}),
    ...(entry.ecosystem === 'pulumi' && entry.resourceToken ? { module: entry.resourceToken } : {}),
    ...(entry.ecosystem === 'helm' && entry.chart ? { chart: entry.chart } : {}),
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

function pulumiTargetUsesPublicLibraryEntry(
  project: PulumiProjectSummary,
  entry: PublicLibraryRegistryEntry
): boolean {
  if (entry.resourceToken) {
    return project.resourceTokens.some(token => token.type === entry.resourceToken);
  }

  return project.resourceTokens.some(token => `@pulumi/${token.packageName}` === entry.providerAddress);
}

function helmTargetUsesPublicLibraryEntry(
  chart: HelmChartSummary,
  entry: PublicLibraryRegistryEntry
): boolean {
  return entry.chart !== undefined
    && (chart.chartName === entry.chart || chart.chartMetadata.chartName === entry.chart);
}

function targetDomainPaths(inspection: WorkspaceInspection, domain: InfraDomainId): string[] {
  switch (domain) {
    case 'terraform':
      return inspection.terraformRoots.map(root => root.rootPath);
    case 'pulumi':
      return inspection.pulumiProjects.map(project => project.projectRoot);
    case 'helm':
      return inspection.helmCharts.map(chart => chart.chartRoot);
  }
}

async function targetUsesPublicLibraryEntry(
  inspection: WorkspaceInspection,
  targetPath: string,
  entry: PublicLibraryRegistryEntry
): Promise<boolean> {
  if (entry.ecosystem === 'terraform') {
    const root = inspection.terraformRoots.find(candidate => candidate.rootPath === targetPath);
    return root ? terraformTargetUsesPublicLibraryEntry(inspection, root, entry) : false;
  }

  if (entry.ecosystem === 'pulumi') {
    const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === targetPath);
    return project ? pulumiTargetUsesPublicLibraryEntry(project, entry) : false;
  }

  const chart = inspection.helmCharts.find(candidate => candidate.chartRoot === targetPath);
  return chart ? helmTargetUsesPublicLibraryEntry(chart, entry) : false;
}

async function targetPathsForPublicLibraryEntry(
  inspection: WorkspaceInspection,
  configuredSource: WorkspacePublicKnowledgeLibraryRegistrySourceConfig,
  entry: PublicLibraryRegistryEntry,
  requestedTargetPaths: Set<string>
): Promise<string[]> {
  if (typeof configuredSource.targetPath === 'string' && configuredSource.targetPath.length > 0) {
    if (
      targetAllowed(configuredSource.targetPath, requestedTargetPaths)
      && await targetUsesPublicLibraryEntry(inspection, configuredSource.targetPath, entry)
    ) {
      return [configuredSource.targetPath];
    }

    return [];
  }

  const matchedTargets: string[] = [];
  for (const targetPath of targetDomainPaths(inspection, entry.ecosystem)) {
    if (!targetAllowed(targetPath, requestedTargetPaths)) {
      continue;
    }

    if (await targetUsesPublicLibraryEntry(inspection, targetPath, entry)) {
      matchedTargets.push(targetPath);
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
        domain: entry.ecosystem,
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
        domain: isInfraDomain(configuredSource.domain)
          ? configuredSource.domain
          : requestedDomains.values().next().value ?? 'terraform',
        targetPath: typeof configuredSource.targetPath === 'string' ? configuredSource.targetPath : '',
        source
      };
    })
    .filter((candidate): candidate is KnowledgePrefetchCandidate => candidate !== null);
}
