import type { PublicLibraryRegistryEntry } from './public-library-registry.ts';
import {
  normalizePublicKnowledgeLibrarySelectorFilter,
  publicLibraryEntryMatchesSelector,
  type PublicKnowledgeLibrarySelectorFilter,
  type PublicKnowledgeLibrarySelectorQualityStatus
} from './public-library-select.ts';
import {
  loadPublicLibraryRegistry,
  resolvePublicLibraryArtifactLocation,
  type PublicLibraryFetchImpl,
  type LoadedPublicLibraryRegistry
} from './public-library-registry-loader.ts';
import {
  KNOWLEDGE_UNIT_TYPES,
  type KnowledgeUnitType
} from '../types/knowledge.ts';
import type { InfraDomainId } from '../types/repository.ts';

export type PublicKnowledgeLibraryCatalogQualityStatus = PublicKnowledgeLibrarySelectorQualityStatus;
export type PublicKnowledgeLibraryCatalogFilter = PublicKnowledgeLibrarySelectorFilter;

export interface PublicKnowledgeLibraryCatalogReport {
  kind: 'infra-agent.public-knowledge-library-catalog';
  schemaVersion: 1;
  mutationAllowed: false;
  registryPath: string;
  registry: {
    locationKind: 'workspace-path' | 'url';
    path?: string;
    url?: string;
    contentHash: string;
    status: 'read' | 'downloaded';
  };
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
  fetchImpl?: PublicLibraryFetchImpl;
}

function artifactLocation(
  entry: PublicLibraryRegistryEntry,
  registry: LoadedPublicLibraryRegistry
): PublicKnowledgeLibraryCatalogEntry['artifact']['location'] {
  const location = resolvePublicLibraryArtifactLocation(entry, registry);
  if (location.kind === 'url') {
    return {
      kind: 'url',
      url: location.url
    };
  }

  return {
    kind: 'workspace-path',
    path: location.path
  };
}

function catalogEntryFromRegistryEntry(
  entry: PublicLibraryRegistryEntry,
  registry: LoadedPublicLibraryRegistry
): PublicKnowledgeLibraryCatalogEntry {
  const location = artifactLocation(entry, registry);
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

export async function buildPublicKnowledgeLibraryCatalogReport(
  options: PublicKnowledgeLibraryCatalogOptions
): Promise<PublicKnowledgeLibraryCatalogReport> {
  const registry = await loadPublicLibraryRegistry({
    registryPath: options.registryPath,
    fetchImpl: options.fetchImpl
  });
  const rawEntryCount = registry.entries.length;

  const filters = normalizePublicKnowledgeLibrarySelectorFilter(options.filter);
  const entries = registry.entries
    .filter(entry => publicLibraryEntryMatchesSelector(entry, filters))
    .map(entry => catalogEntryFromRegistryEntry(entry, registry))
    .sort((left, right) => left.coordinates.localeCompare(right.coordinates));

  return {
    kind: 'infra-agent.public-knowledge-library-catalog',
    schemaVersion: 1,
    mutationAllowed: false,
    registryPath: registry.registryPath,
    registry: {
      locationKind: registry.locationKind,
      ...(registry.path ? { path: registry.path } : {}),
      ...(registry.url ? { url: registry.url } : {}),
      contentHash: registry.contentHash,
      status: registry.status
    },
    summary: buildSummary(rawEntryCount, entries),
    filters,
    entries,
    warnings: entries.some(entry => entry.quality.status === 'needs-refinement')
      ? ['Some matched entries need LLM refinement before they should be promoted as ready public-reference artifacts.']
      : []
  };
}
