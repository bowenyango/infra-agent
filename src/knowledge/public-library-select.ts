import type { InfraDomainId } from '../types/repository.ts';
import type { PublicLibraryRegistryEntry } from './public-library-registry.ts';

export type PublicKnowledgeLibrarySelectorQualityStatus = 'ready' | 'needs-refinement';

export interface PublicKnowledgeLibrarySelectorFilter {
  domains?: InfraDomainId[];
  provider?: string;
  packageName?: string;
  chart?: string;
  resource?: string;
  version?: string;
  coordinates?: string;
  tags?: string[];
  qualityStatus?: PublicKnowledgeLibrarySelectorQualityStatus;
}

export interface PublicKnowledgeLibrarySelectionMetadata {
  mode: 'coordinate' | 'selector';
  selectedCoordinate: string;
  candidateCount: number;
  filter?: PublicKnowledgeLibrarySelectorFilter;
}

export interface PublicKnowledgeLibraryResolvedSelection {
  entry: PublicLibraryRegistryEntry;
  metadata: PublicKnowledgeLibrarySelectionMetadata;
}

interface PublicKnowledgeLibrarySelectionInput {
  coordinates?: string | null;
  filter?: PublicKnowledgeLibrarySelectorFilter;
}

export function normalizePublicKnowledgeLibrarySelectorFilter(
  filter: PublicKnowledgeLibrarySelectorFilter = {}
): PublicKnowledgeLibrarySelectorFilter {
  return {
    ...(filter.domains && filter.domains.length > 0 ? { domains: [...new Set(filter.domains)] } : {}),
    ...(filter.provider ? { provider: filter.provider } : {}),
    ...(filter.packageName ? { packageName: filter.packageName } : {}),
    ...(filter.chart ? { chart: filter.chart } : {}),
    ...(filter.resource ? { resource: filter.resource } : {}),
    ...(filter.version ? { version: filter.version } : {}),
    ...(filter.coordinates ? { coordinates: filter.coordinates } : {}),
    ...(filter.tags && filter.tags.length > 0 ? { tags: [...new Set(filter.tags)] } : {}),
    ...(filter.qualityStatus ? { qualityStatus: filter.qualityStatus } : {})
  };
}

export function hasPublicKnowledgeLibrarySelectorFilter(
  filter: PublicKnowledgeLibrarySelectorFilter | undefined
): boolean {
  return Object.keys(normalizePublicKnowledgeLibrarySelectorFilter(filter)).length > 0;
}

function entryMatchesResource(entry: PublicLibraryRegistryEntry, resource: string): boolean {
  const pulumiTokenParts = entry.ecosystem === 'pulumi' && entry.resourceToken
    ? entry.resourceToken.split(':')
    : [];
  const pulumiPackageName = entry.ecosystem === 'pulumi'
    ? entry.providerAddress.replace(/^@pulumi\//, '')
    : null;
  const pulumiModulePath = pulumiTokenParts.length >= 2
    ? pulumiTokenParts[1]
    : null;
  const pulumiTypeName = pulumiTokenParts.length >= 3
    ? pulumiTokenParts[pulumiTokenParts.length - 1]
    : null;
  const pulumiAliases = [
    entry.resourceToken,
    pulumiModulePath,
    pulumiTypeName,
    pulumiPackageName && pulumiModulePath ? `${pulumiPackageName}:${pulumiModulePath}` : null,
    pulumiModulePath && pulumiTypeName ? `${pulumiModulePath}:${pulumiTypeName}` : null
  ].filter((alias): alias is string => typeof alias === 'string' && alias.length > 0);

  return entry.resourceToken === resource
    || pulumiAliases.includes(resource)
    || entry.sourceName === resource
    || entry.sourceName.endsWith(`:${resource}`)
    || entry.coordinates === resource
    || entry.coordinates.endsWith(`/${resource}`);
}

function entryMatchesPackageName(entry: PublicLibraryRegistryEntry, packageName: string): boolean {
  return entry.providerAddress === packageName
    || (
      entry.ecosystem === 'pulumi'
      && (
        entry.providerAddress === `@pulumi/${packageName}`
        || entry.providerAddress.replace(/^@pulumi\//, '') === packageName
      )
    );
}

function entryMatchesChart(entry: PublicLibraryRegistryEntry, chart: string): boolean {
  return entry.chart === chart
    || entry.providerAddress === chart
    || entry.coordinates === chart
    || entry.coordinates.endsWith(`/chart/${chart}/${entry.version}`);
}

export function publicLibraryEntryMatchesSelector(
  entry: PublicLibraryRegistryEntry,
  filter: PublicKnowledgeLibrarySelectorFilter
): boolean {
  if (filter.domains && filter.domains.length > 0 && !filter.domains.includes(entry.ecosystem)) {
    return false;
  }

  if (filter.provider && entry.providerAddress !== filter.provider) {
    return false;
  }

  if (filter.packageName && !entryMatchesPackageName(entry, filter.packageName)) {
    return false;
  }

  if (filter.chart && !entryMatchesChart(entry, filter.chart)) {
    return false;
  }

  if (filter.resource && !entryMatchesResource(entry, filter.resource)) {
    return false;
  }

  if (filter.version && entry.version !== filter.version) {
    return false;
  }

  if (filter.coordinates && entry.coordinates !== filter.coordinates) {
    return false;
  }

  if (filter.tags && filter.tags.some(tag => !entry.tags.includes(tag))) {
    return false;
  }

  if (filter.qualityStatus && entry.llmRefinement.qualityStatus !== filter.qualityStatus) {
    return false;
  }

  return true;
}

export function formatPublicKnowledgeLibrarySelectorFilter(
  filter: PublicKnowledgeLibrarySelectorFilter
): string {
  const entries = Object.entries(normalizePublicKnowledgeLibrarySelectorFilter(filter));
  if (entries.length === 0) {
    return 'none';
  }

  return entries
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : value}`)
    .join(' ');
}

function formatCandidate(entry: PublicLibraryRegistryEntry): string {
  return [
    entry.coordinates,
    `domain=${entry.ecosystem}`,
    `kind=${entry.artifactKind}`,
    `provider=${entry.providerAddress}`,
    `version=${entry.version}`,
    `source=${entry.sourceName}`,
    ...(entry.resourceToken ? [`resource=${entry.resourceToken}`] : []),
    ...(entry.chart ? [`chart=${entry.chart}`] : []),
    `quality=${entry.llmRefinement.qualityStatus}`,
    `units=${entry.artifact.unitCount}`
  ].join(' ');
}

export function resolvePublicKnowledgeLibraryRegistryEntrySelection(
  entries: PublicLibraryRegistryEntry[],
  selection: PublicKnowledgeLibrarySelectionInput
): PublicKnowledgeLibraryResolvedSelection {
  const coordinates = selection.coordinates?.trim() ?? null;
  const filter = normalizePublicKnowledgeLibrarySelectorFilter(selection.filter);
  const hasSelector = hasPublicKnowledgeLibrarySelectorFilter(filter);

  if (coordinates && hasSelector) {
    throw new Error('Public knowledge library selection accepts either --coordinate or selector filters, not both.');
  }
  if (!coordinates && !hasSelector) {
    throw new Error('Public knowledge library selection requires --coordinate or at least one selector filter.');
  }

  if (coordinates) {
    const entry = entries.find(candidate => candidate.coordinates === coordinates);
    if (!entry) {
      throw new Error(`Public knowledge library registry does not contain coordinate ${coordinates}.`);
    }

    return {
      entry,
      metadata: {
        mode: 'coordinate',
        selectedCoordinate: entry.coordinates,
        candidateCount: 1
      }
    };
  }

  const candidates = entries.filter(entry => publicLibraryEntryMatchesSelector(entry, filter));
  if (candidates.length === 0) {
    throw new Error(`Public knowledge library selector matched no entries: ${formatPublicKnowledgeLibrarySelectorFilter(filter)}.`);
  }
  if (candidates.length > 1) {
    throw new Error(`Public knowledge library selector matched ${candidates.length} entries: ${formatPublicKnowledgeLibrarySelectorFilter(filter)}. Candidates: ${candidates.map(formatCandidate).join('; ')}.`);
  }

  return {
    entry: candidates[0],
    metadata: {
      mode: 'selector',
      selectedCoordinate: candidates[0].coordinates,
      candidateCount: candidates.length,
      filter
    }
  };
}
