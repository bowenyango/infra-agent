import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
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
  provider?: string;
  packageName?: string;
  chart?: string;
  module?: string;
}

type MetadataSelectorKey = 'provider' | 'packageName' | 'chart' | 'module';

type MetadataSelectors = Partial<Record<MetadataSelectorKey, string>>;

type DetectedTargetMetadata = Record<MetadataSelectorKey, Set<string>>;

const METADATA_SELECTOR_KEYS = ['provider', 'packageName', 'chart', 'module'] as const satisfies readonly MetadataSelectorKey[];
const SECRET_METADATA_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;

function emptyDetectedTargetMetadata(): DetectedTargetMetadata {
  return {
    provider: new Set(),
    packageName: new Set(),
    chart: new Set(),
    module: new Set()
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeMetadataSelector(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 160 || SECRET_METADATA_PATTERN.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function metadataSelectorsFromRecord(value: Record<string, unknown>): MetadataSelectors {
  const selectors: MetadataSelectors = {};
  for (const key of METADATA_SELECTOR_KEYS) {
    const selector = safeMetadataSelector(value[key]);
    if (selector !== undefined) {
      selectors[key] = selector;
    }
  }

  return selectors;
}

function mergeMetadataSelectors(...selectors: MetadataSelectors[]): MetadataSelectors {
  return selectors.reduce<MetadataSelectors>((merged, selector) => ({
    ...merged,
    ...selector
  }), {});
}

function metadataSourceFields(selectors: MetadataSelectors): MetadataSelectors {
  const fields: MetadataSelectors = {};
  for (const key of METADATA_SELECTOR_KEYS) {
    if (selectors[key] !== undefined) {
      fields[key] = selectors[key];
    }
  }

  return fields;
}

function normalizeMetadataSelector(value: string): string {
  return value.trim().toLowerCase();
}

function addDetectedMetadata(values: Set<string>, value: string | null | undefined): void {
  const selector = safeMetadataSelector(value);
  if (selector !== undefined) {
    values.add(normalizeMetadataSelector(selector));
  }
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

async function readJsonRecord(path: string): Promise<Record<string, unknown> | null> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function addPulumiPackageDependencyMetadata(metadata: DetectedTargetMetadata, value: unknown): void {
  if (!isRecord(value)) {
    return;
  }

  for (const packageName of Object.keys(value)) {
    if (packageName.startsWith('@pulumi/')) {
      addDetectedMetadata(metadata.packageName, packageName);
    }
  }
}

async function detectedPulumiTargetMetadata(
  inspection: WorkspaceInspection,
  project: PulumiProjectSummary
): Promise<DetectedTargetMetadata> {
  const metadata = emptyDetectedTargetMetadata();

  for (const packageFile of project.packageFiles) {
    const parsed = await readJsonRecord(join(inspection.workspaceRoot, packageFile));
    if (!parsed) {
      continue;
    }

    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      addPulumiPackageDependencyMetadata(metadata, parsed[section]);
    }
  }

  for (const token of project.resourceTokens) {
    addDetectedMetadata(metadata.packageName, `@pulumi/${token.packageName}`);
    addDetectedMetadata(metadata.module, token.moduleName);
  }

  return metadata;
}

async function detectedTerraformTargetMetadata(
  inspection: WorkspaceInspection,
  root: TerraformRootSummary
): Promise<DetectedTargetMetadata> {
  const metadata = emptyDetectedTargetMetadata();
  const sources = await buildTerraformRegistryKnowledgeSources(inspection.workspaceRoot, root);

  for (const source of sources) {
    addDetectedMetadata(metadata.provider, source.provider);
  }

  return metadata;
}

async function detectedHelmTargetMetadata(
  inspection: WorkspaceInspection,
  chart: HelmChartSummary
): Promise<DetectedTargetMetadata> {
  const metadata = emptyDetectedTargetMetadata();

  addDetectedMetadata(metadata.chart, chart.chartName);
  try {
    const content = await readFile(join(inspection.workspaceRoot, chart.chartRoot, 'Chart.yaml'), 'utf8');
    const parsed = parseDocument(content).toJSON() as unknown;
    if (isRecord(parsed)) {
      addDetectedMetadata(metadata.chart, parsed.name);
    }
  } catch {
    // The inspected chart root is still useful even when Chart.yaml cannot be reread.
  }

  return metadata;
}

async function detectTargetMetadata(
  inspection: WorkspaceInspection,
  domain: InfraDomainId,
  targetPath: string
): Promise<DetectedTargetMetadata> {
  switch (domain) {
    case 'terraform': {
      const root = inspection.terraformRoots.find(candidate => candidate.rootPath === targetPath);
      return root ? detectedTerraformTargetMetadata(inspection, root) : emptyDetectedTargetMetadata();
    }
    case 'pulumi': {
      const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === targetPath);
      return project ? detectedPulumiTargetMetadata(inspection, project) : emptyDetectedTargetMetadata();
    }
    case 'helm': {
      const chart = inspection.helmCharts.find(candidate => candidate.chartRoot === targetPath);
      return chart ? detectedHelmTargetMetadata(inspection, chart) : emptyDetectedTargetMetadata();
    }
  }
}

async function detectedTargetMetadataForEntry(
  inspection: WorkspaceInspection,
  entry: UnitArtifactRegistryEntry,
  targetPath: string
): Promise<DetectedTargetMetadata> {
  if (!entry.domain) {
    return emptyDetectedTargetMetadata();
  }

  return detectTargetMetadata(inspection, entry.domain, targetPath);
}

function entryMatchesDetectedMetadata(
  entry: UnitArtifactRegistryEntry,
  metadata: DetectedTargetMetadata
): boolean {
  for (const key of METADATA_SELECTOR_KEYS) {
    const selector = entry[key];
    if (selector === undefined || metadata[key].size === 0) {
      continue;
    }

    if (!metadata[key].has(normalizeMetadataSelector(selector))) {
      return false;
    }
  }

  return true;
}

function hasMetadataSelectors(entry: UnitArtifactRegistryEntry): boolean {
  return METADATA_SELECTOR_KEYS.some(key => entry[key] !== undefined);
}

function knowledgeUnitArtifactSourceFromRegistryEntry(
  entry: UnitArtifactRegistryEntry,
  localPath: string | null,
  url: string | null
): KnowledgeSource {
  return {
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
      : {}),
    ...metadataSourceFields(entry)
  };
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
          : {}),
        ...metadataSourceFields(metadataSelectorsFromRecord(configuredSource as Record<string, unknown>))
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
    const metadataSelectors = mergeMetadataSelectors(
      metadataSelectorsFromRecord(configuredSource as Record<string, unknown>),
      metadataSelectorsFromRecord(artifact),
      metadataSelectorsFromRecord(entry)
    );
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
        : undefined,
      ...metadataSelectors
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

async function unitArtifactCandidateFromRegistryEntry(
  inspection: WorkspaceInspection,
  entry: UnitArtifactRegistryEntry,
  requestedDomains: Set<InfraDomainId>,
  targetPaths: Set<string>
): Promise<KnowledgePrefetchCandidate[]> {
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
  if (!hasMetadataSelectors(entry)) {
    return resolvedTargetPaths.map(targetPath => ({
      domain: entry.domain as InfraDomainId,
      targetPath,
      source: knowledgeUnitArtifactSourceFromRegistryEntry(entry, localPath, url)
    }));
  }

  const matchingTargetPaths: string[] = [];
  for (const targetPath of resolvedTargetPaths) {
    const metadata = await detectedTargetMetadataForEntry(inspection, entry, targetPath);
    if (entryMatchesDetectedMetadata(entry, metadata)) {
      matchingTargetPaths.push(targetPath);
    }
  }

  return matchingTargetPaths.map(targetPath => ({
    domain: entry.domain as InfraDomainId,
    targetPath,
    source: knowledgeUnitArtifactSourceFromRegistryEntry(entry, localPath, url)
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
      candidates.push(...await unitArtifactCandidateFromRegistryEntry(
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
