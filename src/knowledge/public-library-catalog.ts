import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  parsePublicLibraryRegistryEntries,
  type PublicLibraryRegistryEntry
} from './public-library-registry.ts';
import { validateKnowledgePayload } from './validate.ts';
import {
  KNOWLEDGE_UNIT_TYPES,
  type KnowledgeUnitType
} from '../types/knowledge.ts';
import type { InfraDomainId } from '../types/repository.ts';

export type PublicKnowledgeLibraryCatalogQualityStatus = 'ready' | 'needs-refinement';

export interface PublicKnowledgeLibraryCatalogFilter {
  domains?: InfraDomainId[];
  provider?: string;
  packageName?: string;
  chart?: string;
  resource?: string;
  version?: string;
  coordinates?: string;
  tags?: string[];
  qualityStatus?: PublicKnowledgeLibraryCatalogQualityStatus;
}

export interface PublicKnowledgeLibraryCatalogReport {
  kind: 'infra-agent.public-knowledge-library-catalog';
  schemaVersion: 1;
  mutationAllowed: false;
  registryPath: string;
  summary: {
    entryCount: number;
    matchedEntryCount: number;
    downloadableEntryCount: number;
    readyEntryCount: number;
    needsRefinementEntryCount: number;
    unitTypeCompleteEntryCount: number;
    reviewRequiredEntryCount: number;
    totalUnitCount: number;
    ecosystemCounts: Record<InfraDomainId, number>;
    artifactKindCounts: Record<PublicLibraryRegistryEntry['artifactKind'], number>;
    missingUnitTypeCounts: Record<KnowledgeUnitType, number>;
  };
  filters: PublicKnowledgeLibraryCatalogFilter;
  entries: PublicKnowledgeLibraryCatalogEntry[];
  warnings: string[];
}

export interface PublicKnowledgeLibraryCatalogEntry {
  coordinates: string;
  classification: {
    ecosystem: PublicLibraryRegistryEntry['ecosystem'];
    artifactKind: PublicLibraryRegistryEntry['artifactKind'];
    providerAddress: string;
    version: string;
    versionRef: PublicLibraryRegistryEntry['versionRef'];
    versionResolution: PublicLibraryRegistryEntry['versionResolution'];
    sourceName: string;
    resourceToken?: string;
    repository?: string;
    chart?: string;
    tags: string[];
  };
  artifact: {
    artifactId: string;
    contentHash: string;
    mediaType: PublicLibraryRegistryEntry['artifact']['mediaType'];
    unitPayloadHash: string;
    sourceContentHash: string;
    unitCount: number;
    qualityStatus: PublicKnowledgeLibraryCatalogQualityStatus;
    reviewRequired: true;
    location:
      | {
        kind: 'workspace-path';
        path: string;
      }
      | {
        kind: 'url';
        url: string;
      };
  };
  quality: {
    status: PublicKnowledgeLibraryCatalogQualityStatus;
    score: number;
    warningCount: number;
  };
  llmRefinement: {
    status: 'not-run';
    mode: 'offline-review';
    inputRef: 'artifact.llmRefinementInput';
    reviewPacketHash: string;
    outputContract: 'infra-agent.public-knowledge-url-report';
    unitTypes: KnowledgeUnitType[];
    unitCounts: Record<KnowledgeUnitType, number>;
    missingUnitTypes: KnowledgeUnitType[];
    unitTypeComplete: boolean;
    reviewRequired: true;
  };
  sourceDownload: PublicLibraryRegistryEntry['download'];
  artifactDownload: {
    available: true;
    mode: 'workspace-path' | 'url';
    requiresPrefetch: boolean;
    contentHash: string;
    mediaType: PublicLibraryRegistryEntry['artifact']['mediaType'];
  };
}

interface PublicKnowledgeLibraryCatalogOptions {
  registryPath: string;
  filter?: PublicKnowledgeLibraryCatalogFilter;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeFilter(filter: PublicKnowledgeLibraryCatalogFilter = {}): PublicKnowledgeLibraryCatalogFilter {
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

function entryMatchesResource(entry: PublicLibraryRegistryEntry, resource: string): boolean {
  return entry.resourceToken === resource
    || entry.sourceName === resource
    || entry.sourceName.endsWith(`:${resource}`)
    || entry.coordinates === resource
    || entry.coordinates.endsWith(`/${resource}`)
    || entry.coordinates.includes(`/${resource}/`);
}

function entryMatchesChart(entry: PublicLibraryRegistryEntry, chart: string): boolean {
  return entry.chart === chart
    || entry.providerAddress === chart
    || entry.coordinates.includes(`/chart/${chart}/`);
}

function entryMatchesFilter(entry: PublicLibraryRegistryEntry, filter: PublicKnowledgeLibraryCatalogFilter): boolean {
  if (filter.domains && filter.domains.length > 0 && !filter.domains.includes(entry.ecosystem)) {
    return false;
  }

  if (filter.provider && entry.providerAddress !== filter.provider) {
    return false;
  }

  if (filter.packageName && entry.providerAddress !== filter.packageName) {
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

function artifactLocation(entry: PublicLibraryRegistryEntry): PublicKnowledgeLibraryCatalogEntry['artifact']['location'] {
  if (typeof entry.artifact.url === 'string') {
    return {
      kind: 'url',
      url: entry.artifact.url
    };
  }

  if (typeof entry.artifact.path === 'string') {
    return {
      kind: 'workspace-path',
      path: entry.artifact.path
    };
  }

  throw new Error(`Public knowledge library registry entry ${entry.coordinates} has no downloadable artifact location.`);
}

function catalogEntryFromRegistryEntry(entry: PublicLibraryRegistryEntry): PublicKnowledgeLibraryCatalogEntry {
  const location = artifactLocation(entry);
  const unitTypeComplete = entry.llmRefinement.missingUnitTypes.length === 0;

  return {
    coordinates: entry.coordinates,
    classification: {
      ecosystem: entry.ecosystem,
      artifactKind: entry.artifactKind,
      providerAddress: entry.providerAddress,
      version: entry.version,
      versionRef: entry.versionRef,
      versionResolution: entry.versionResolution,
      sourceName: entry.sourceName,
      ...(entry.resourceToken ? { resourceToken: entry.resourceToken } : {}),
      ...(entry.repository ? { repository: entry.repository } : {}),
      ...(entry.chart ? { chart: entry.chart } : {}),
      tags: entry.tags
    },
    artifact: {
      artifactId: entry.artifact.artifactId,
      contentHash: entry.artifact.contentHash,
      mediaType: entry.artifact.mediaType,
      unitPayloadHash: entry.artifact.unitPayloadHash,
      sourceContentHash: entry.artifact.sourceContentHash,
      unitCount: entry.artifact.unitCount,
      qualityStatus: entry.artifact.qualityStatus,
      reviewRequired: entry.artifact.reviewRequired,
      location
    },
    quality: {
      status: entry.llmRefinement.qualityStatus,
      score: entry.llmRefinement.qualityScore,
      warningCount: entry.llmRefinement.qualityWarningCount
    },
    llmRefinement: {
      status: entry.llmRefinement.status,
      mode: entry.llmRefinement.mode,
      inputRef: entry.llmRefinement.inputRef,
      reviewPacketHash: entry.llmRefinement.reviewPacketHash,
      outputContract: entry.llmRefinement.outputContract,
      unitTypes: entry.llmRefinement.unitTypes,
      unitCounts: entry.llmRefinement.unitCounts,
      missingUnitTypes: entry.llmRefinement.missingUnitTypes,
      unitTypeComplete,
      reviewRequired: entry.llmRefinement.reviewRequired
    },
    sourceDownload: entry.download,
    artifactDownload: {
      available: true,
      mode: location.kind,
      requiresPrefetch: location.kind === 'url',
      contentHash: entry.artifact.contentHash,
      mediaType: entry.artifact.mediaType
    }
  };
}

function emptyEcosystemCounts(): Record<InfraDomainId, number> {
  return {
    helm: 0,
    pulumi: 0,
    terraform: 0
  };
}

function emptyArtifactKindCounts(): Record<PublicLibraryRegistryEntry['artifactKind'], number> {
  return {
    'helm-chart-docs': 0,
    'pulumi-package-resource': 0,
    'terraform-provider-data-source': 0,
    'terraform-provider-resource': 0
  };
}

function emptyMissingUnitTypeCounts(): Record<KnowledgeUnitType, number> {
  return {
    fact: 0,
    guidance: 0,
    example: 0,
    diagnostic: 0,
    recipe: 0
  };
}

function buildSummary(
  entryCount: number,
  entries: PublicKnowledgeLibraryCatalogEntry[]
): PublicKnowledgeLibraryCatalogReport['summary'] {
  const ecosystemCounts = emptyEcosystemCounts();
  const artifactKindCounts = emptyArtifactKindCounts();
  const missingUnitTypeCounts = emptyMissingUnitTypeCounts();

  let downloadableEntryCount = 0;
  let readyEntryCount = 0;
  let needsRefinementEntryCount = 0;
  let unitTypeCompleteEntryCount = 0;
  let reviewRequiredEntryCount = 0;
  let totalUnitCount = 0;

  for (const entry of entries) {
    ecosystemCounts[entry.classification.ecosystem] += 1;
    artifactKindCounts[entry.classification.artifactKind] += 1;
    totalUnitCount += entry.artifact.unitCount;
    downloadableEntryCount += entry.artifactDownload.available ? 1 : 0;
    readyEntryCount += entry.quality.status === 'ready' ? 1 : 0;
    needsRefinementEntryCount += entry.quality.status === 'needs-refinement' ? 1 : 0;
    unitTypeCompleteEntryCount += entry.llmRefinement.unitTypeComplete ? 1 : 0;
    reviewRequiredEntryCount += entry.llmRefinement.reviewRequired ? 1 : 0;
    for (const unitType of KNOWLEDGE_UNIT_TYPES) {
      missingUnitTypeCounts[unitType] += entry.llmRefinement.missingUnitTypes.includes(unitType) ? 1 : 0;
    }
  }

  return {
    entryCount,
    matchedEntryCount: entries.length,
    downloadableEntryCount,
    readyEntryCount,
    needsRefinementEntryCount,
    unitTypeCompleteEntryCount,
    reviewRequiredEntryCount,
    totalUnitCount,
    ecosystemCounts,
    artifactKindCounts,
    missingUnitTypeCounts
  };
}

function registryEntryCount(payload: unknown): number {
  if (!isRecord(payload) || !Array.isArray(payload.entries)) {
    return 0;
  }

  return payload.entries.length;
}

export async function buildPublicKnowledgeLibraryCatalogReport(
  options: PublicKnowledgeLibraryCatalogOptions
): Promise<PublicKnowledgeLibraryCatalogReport> {
  const registryPath = resolve(options.registryPath);
  const payload = JSON.parse(await readFile(registryPath, 'utf8')) as unknown;
  const validation = validateKnowledgePayload(payload, registryPath);
  if (!validation.valid || validation.inputKind !== 'infra-agent.public-knowledge-library-registry') {
    const firstIssue = validation.issues[0];
    throw new Error(firstIssue
      ? `Public knowledge library registry is invalid: ${firstIssue.path} ${firstIssue.message}`
      : 'Public knowledge library registry is invalid.');
  }

  const rawEntryCount = registryEntryCount(payload);
  const registryEntries = parsePublicLibraryRegistryEntries(payload);
  if (registryEntries.length !== rawEntryCount) {
    throw new Error('Public knowledge library registry contains entries that could not be parsed for catalog output.');
  }

  const filters = normalizeFilter(options.filter);
  const entries = registryEntries
    .filter(entry => entryMatchesFilter(entry, filters))
    .map(catalogEntryFromRegistryEntry)
    .sort((left, right) => left.coordinates.localeCompare(right.coordinates));

  return {
    kind: 'infra-agent.public-knowledge-library-catalog',
    schemaVersion: 1,
    mutationAllowed: false,
    registryPath,
    summary: buildSummary(rawEntryCount, entries),
    filters,
    entries,
    warnings: entries.some(entry => entry.quality.status === 'needs-refinement')
      ? ['Some matched entries need LLM refinement before they should be promoted as ready public-reference artifacts.']
      : []
  };
}
