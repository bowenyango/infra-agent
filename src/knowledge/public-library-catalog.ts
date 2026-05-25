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
export type PublicKnowledgeLibraryCatalogSearchableField =
  | 'coordinates'
  | 'ecosystem'
  | 'artifactKind'
  | 'providerAddress'
  | 'version'
  | 'sourceName'
  | 'resourceToken'
  | 'repository'
  | 'chart'
  | 'tags'
  | 'qualityStatus'
  | 'unitTypes';
export type PublicKnowledgeLibraryCatalogFacetField =
  | 'ecosystem'
  | 'artifactKind'
  | 'providerAddress'
  | 'version'
  | 'versionReferenceKind'
  | 'versionResolutionStatus'
  | 'sourceName'
  | 'resourceToken'
  | 'repository'
  | 'chart'
  | 'tags'
  | 'qualityStatus'
  | 'unitTypeCoverage'
  | 'unitTypes'
  | 'missingUnitTypes';

export interface PublicKnowledgeLibraryCatalogFacetValue {
  value: string;
  count: number;
}

export interface PublicKnowledgeLibraryCatalogFacetSummary {
  totalValueCount: number;
  returnedValueCount: number;
  omittedValueCount: number;
  values: PublicKnowledgeLibraryCatalogFacetValue[];
}

export interface PublicKnowledgeLibraryCatalogFacets {
  scope: 'matched-before-limit';
  matchedEntryCount: number;
  limit: number;
  fields: Record<PublicKnowledgeLibraryCatalogFacetField, PublicKnowledgeLibraryCatalogFacetSummary>;
}

export interface PublicKnowledgeLibraryCatalogSearchSummary {
  query: string;
  terms: string[];
  searchableFields: PublicKnowledgeLibraryCatalogSearchableField[];
  matchedCount: number;
}

export interface PublicKnowledgeLibraryCatalogLimitSummary {
  requested: number;
  matchedEntryCount: number;
  returnedEntryCount: number;
  omittedEntryCount: number;
}

export interface PublicKnowledgeLibraryCatalogSearchMatch {
  rank: number;
  score: number;
  matchedFields: PublicKnowledgeLibraryCatalogSearchableField[];
  matchedTerms: string[];
}

export type PublicKnowledgeLibraryCatalogDownloadVerificationCheck =
  | 'registry-entry-selection'
  | 'artifact-content-hash'
  | 'artifact-schema-validation'
  | 'registry-artifact-drift'
  | 'content-addressed-store-write';

export interface PublicKnowledgeLibraryCatalogDownloadGuidance {
  mode: 'coordinate';
  command: {
    argv: string[];
    registryArgument: string;
    coordinateArgument: string;
    requiredUserArguments: string[];
    recommendedStoreDir: string;
    optionalArguments: string[];
  };
  artifactFetch: {
    catalogStatus: 'not-attempted';
    downloadWillFetchArtifact: boolean;
    locationKind: 'workspace-path' | 'url';
  };
  verification: {
    performedBy: 'knowledge library-download';
    checks: PublicKnowledgeLibraryCatalogDownloadVerificationCheck[];
  };
  postDownload: {
    storedPathAvailableAfterDownload: true;
    reviewOutSupported: true;
  };
}

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
    returnedEntryCount: number;
    omittedEntryCount: number;
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
  search?: PublicKnowledgeLibraryCatalogSearchSummary;
  limit?: PublicKnowledgeLibraryCatalogLimitSummary;
  facets?: PublicKnowledgeLibraryCatalogFacets;
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
  downloadGuidance: PublicKnowledgeLibraryCatalogDownloadGuidance;
  searchMatch?: PublicKnowledgeLibraryCatalogSearchMatch;
}

interface PublicKnowledgeLibraryCatalogOptions {
  registryPath: string;
  filter?: PublicKnowledgeLibraryCatalogFilter;
  query?: string;
  limit?: number;
  includeFacets?: boolean;
  facetLimit?: number;
  fetchImpl?: PublicLibraryFetchImpl;
}

const DEFAULT_CATALOG_FACET_LIMIT = 10;
const DEFAULT_PUBLIC_LIBRARY_DOWNLOAD_STORE_DIR = 'knowledge/downloaded-public-library';
const PUBLIC_LIBRARY_DOWNLOAD_VERIFICATION_CHECKS: PublicKnowledgeLibraryCatalogDownloadVerificationCheck[] = [
  'registry-entry-selection',
  'artifact-content-hash',
  'artifact-schema-validation',
  'registry-artifact-drift',
  'content-addressed-store-write'
];

const CATALOG_SEARCHABLE_FIELDS: PublicKnowledgeLibraryCatalogSearchableField[] = [
  'coordinates',
  'ecosystem',
  'artifactKind',
  'providerAddress',
  'version',
  'sourceName',
  'resourceToken',
  'repository',
  'chart',
  'tags',
  'qualityStatus',
  'unitTypes'
];

const CATALOG_FACET_FIELDS: PublicKnowledgeLibraryCatalogFacetField[] = [
  'ecosystem',
  'artifactKind',
  'providerAddress',
  'version',
  'versionReferenceKind',
  'versionResolutionStatus',
  'sourceName',
  'resourceToken',
  'repository',
  'chart',
  'tags',
  'qualityStatus',
  'unitTypeCoverage',
  'unitTypes',
  'missingUnitTypes'
];

type CatalogSearchFieldValues = Record<PublicKnowledgeLibraryCatalogSearchableField, string[]>;
type CatalogFacetFieldValues = Record<PublicKnowledgeLibraryCatalogFacetField, string[]>;

interface CatalogScoredEntry {
  entry: PublicLibraryRegistryEntry;
  searchMatch?: Omit<PublicKnowledgeLibraryCatalogSearchMatch, 'rank'>;
}

interface CatalogRankedEntry {
  entry: PublicLibraryRegistryEntry;
  searchMatch?: PublicKnowledgeLibraryCatalogSearchMatch;
}

function normalizeCatalogSearchTerms(query: string | undefined): string[] {
  if (!query) {
    return [];
  }

  return [
    ...new Set(
      query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
    )
  ];
}

function catalogSearchValues(entry: PublicLibraryRegistryEntry): CatalogSearchFieldValues {
  return {
    coordinates: [entry.coordinates],
    ecosystem: [entry.ecosystem],
    artifactKind: [entry.artifactKind],
    providerAddress: [entry.providerAddress],
    version: [entry.version],
    sourceName: [entry.sourceName],
    resourceToken: entry.resourceToken ? [entry.resourceToken] : [],
    repository: entry.repository ? [entry.repository] : [],
    chart: entry.chart ? [entry.chart] : [],
    tags: entry.tags,
    qualityStatus: [entry.llmRefinement.qualityStatus],
    unitTypes: entry.llmRefinement.unitTypes
  };
}

function catalogFacetValues(entry: PublicLibraryRegistryEntry): CatalogFacetFieldValues {
  const includedUnitTypes = KNOWLEDGE_UNIT_TYPES.filter(unitType =>
    (entry.llmRefinement.unitCounts[unitType] ?? 0) > 0
  );

  return {
    ecosystem: [entry.ecosystem],
    artifactKind: [entry.artifactKind],
    providerAddress: [entry.providerAddress],
    version: [entry.version],
    versionReferenceKind: [entry.versionRef.kind],
    versionResolutionStatus: [entry.versionResolution.status],
    sourceName: [entry.sourceName],
    resourceToken: entry.resourceToken ? [entry.resourceToken] : [],
    repository: entry.repository ? [entry.repository] : [],
    chart: entry.chart ? [entry.chart] : [],
    tags: entry.tags,
    qualityStatus: [entry.llmRefinement.qualityStatus],
    unitTypeCoverage: [entry.llmRefinement.missingUnitTypes.length === 0 ? 'complete' : 'partial'],
    unitTypes: includedUnitTypes,
    missingUnitTypes: entry.llmRefinement.missingUnitTypes
  };
}

function buildCatalogFacetSummary(
  counts: Map<string, number>,
  limit: number
): PublicKnowledgeLibraryCatalogFacetSummary {
  const orderedValues = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => {
      const countDifference = right.count - left.count;
      if (countDifference !== 0) {
        return countDifference;
      }

      return left.value.localeCompare(right.value);
    });
  const values = orderedValues.slice(0, limit);

  return {
    totalValueCount: orderedValues.length,
    returnedValueCount: values.length,
    omittedValueCount: Math.max(0, orderedValues.length - values.length),
    values
  };
}

function buildCatalogFacets(
  entries: CatalogRankedEntry[],
  limit: number
): PublicKnowledgeLibraryCatalogFacets {
  const countsByField = Object.fromEntries(
    CATALOG_FACET_FIELDS.map(field => [field, new Map<string, number>()])
  ) as Record<PublicKnowledgeLibraryCatalogFacetField, Map<string, number>>;

  for (const rankedEntry of entries) {
    const valuesByField = catalogFacetValues(rankedEntry.entry);
    for (const field of CATALOG_FACET_FIELDS) {
      for (const value of new Set(valuesByField[field])) {
        countsByField[field].set(value, (countsByField[field].get(value) ?? 0) + 1);
      }
    }
  }

  const fields = Object.fromEntries(
    CATALOG_FACET_FIELDS.map(field => [field, buildCatalogFacetSummary(countsByField[field], limit)])
  ) as PublicKnowledgeLibraryCatalogFacets['fields'];

  return {
    scope: 'matched-before-limit',
    matchedEntryCount: entries.length,
    limit,
    fields
  };
}

function scoreSearchValue(value: string, term: string): number {
  const normalized = value.toLowerCase();
  if (normalized === term) {
    return 20;
  }
  if (normalized.split(/[^a-z0-9@_/-]+/).includes(term)) {
    return 12;
  }
  if (normalized.startsWith(term)) {
    return 8;
  }
  if (normalized.includes(term)) {
    return 4;
  }

  return 0;
}

function scoreCatalogEntrySearch(
  entry: PublicLibraryRegistryEntry,
  terms: string[]
): Omit<PublicKnowledgeLibraryCatalogSearchMatch, 'rank'> | null {
  const valuesByField = catalogSearchValues(entry);
  const matchedFields = new Set<PublicKnowledgeLibraryCatalogSearchableField>();
  const matchedTerms: string[] = [];
  let score = 0;

  for (const term of terms) {
    let termScore = 0;
    const termFields = new Set<PublicKnowledgeLibraryCatalogSearchableField>();

    for (const field of CATALOG_SEARCHABLE_FIELDS) {
      for (const value of valuesByField[field]) {
        const valueScore = scoreSearchValue(value, term);
        if (valueScore > 0) {
          termScore = Math.max(termScore, valueScore);
          termFields.add(field);
        }
      }
    }

    if (termScore === 0) {
      return null;
    }

    matchedTerms.push(term);
    score += termScore;
    for (const field of termFields) {
      matchedFields.add(field);
    }
  }

  score += matchedFields.size;

  return {
    score,
    matchedFields: CATALOG_SEARCHABLE_FIELDS.filter(field => matchedFields.has(field)),
    matchedTerms
  };
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
  registry: LoadedPublicLibraryRegistry,
  searchMatch?: PublicKnowledgeLibraryCatalogSearchMatch
): PublicKnowledgeLibraryCatalogEntry {
  const location = artifactLocation(entry, registry);
  const unitTypeComplete = entry.llmRefinement.missingUnitTypes.length === 0;
  const downloadGuidance = buildDownloadGuidance(entry, registry, location);

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
    },
    downloadGuidance,
    ...(searchMatch ? { searchMatch } : {})
  };
}

function buildDownloadGuidance(
  entry: PublicLibraryRegistryEntry,
  registry: LoadedPublicLibraryRegistry,
  location: PublicKnowledgeLibraryCatalogEntry['artifact']['location']
): PublicKnowledgeLibraryCatalogDownloadGuidance {
  return {
    mode: 'coordinate',
    command: {
      argv: [
        'infra-agent',
        'knowledge',
        'library-download',
        registry.registryPath,
        '--coordinate',
        entry.coordinates,
        '--workspace',
        '<workspace>',
        '--store-dir',
        DEFAULT_PUBLIC_LIBRARY_DOWNLOAD_STORE_DIR,
        '--json'
      ],
      registryArgument: registry.registryPath,
      coordinateArgument: entry.coordinates,
      requiredUserArguments: ['--workspace'],
      recommendedStoreDir: DEFAULT_PUBLIC_LIBRARY_DOWNLOAD_STORE_DIR,
      optionalArguments: ['--review-out <review.json>', '--out <download-report.json>']
    },
    artifactFetch: {
      catalogStatus: 'not-attempted',
      downloadWillFetchArtifact: location.kind === 'url',
      locationKind: location.kind
    },
    verification: {
      performedBy: 'knowledge library-download',
      checks: [...PUBLIC_LIBRARY_DOWNLOAD_VERIFICATION_CHECKS]
    },
    postDownload: {
      storedPathAvailableAfterDownload: true,
      reviewOutSupported: true
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
  matchedEntries: PublicKnowledgeLibraryCatalogEntry[],
  returnedEntryCount: number
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

  for (const entry of matchedEntries) {
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
    matchedEntryCount: matchedEntries.length,
    returnedEntryCount,
    omittedEntryCount: Math.max(0, matchedEntries.length - returnedEntryCount),
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
  const query = options.query?.trim() ?? '';
  const searchTerms = normalizeCatalogSearchTerms(query);
  const querySupplied = query.length > 0;
  const filteredEntries = registry.entries
    .filter(entry => publicLibraryEntryMatchesSelector(entry, filters))
    .map((entry): CatalogScoredEntry | null => {
      if (!querySupplied) {
        return { entry };
      }

      const searchMatch = scoreCatalogEntrySearch(entry, searchTerms);
      return searchMatch ? { entry, searchMatch } : null;
    })
    .filter((entry): entry is CatalogScoredEntry => entry !== null)
    .sort((left, right) => {
      if (querySupplied) {
        const scoreDifference = (right.searchMatch?.score ?? 0) - (left.searchMatch?.score ?? 0);
        if (scoreDifference !== 0) {
          return scoreDifference;
        }
        const readyDifference = Number(right.entry.llmRefinement.qualityStatus === 'ready') - Number(left.entry.llmRefinement.qualityStatus === 'ready');
        if (readyDifference !== 0) {
          return readyDifference;
        }
        const completeDifference = Number(right.entry.llmRefinement.missingUnitTypes.length === 0) - Number(left.entry.llmRefinement.missingUnitTypes.length === 0);
        if (completeDifference !== 0) {
          return completeDifference;
        }
      }

      return left.entry.coordinates.localeCompare(right.entry.coordinates);
    });
  const matchedEntryCount = filteredEntries.length;
  const rankedEntries = filteredEntries.map((scoredEntry, index): CatalogRankedEntry => ({
    entry: scoredEntry.entry,
    ...(scoredEntry.searchMatch
      ? {
          searchMatch: {
            rank: index + 1,
            ...scoredEntry.searchMatch
          }
        }
      : {})
  }));
  const facetLimit = options.facetLimit ?? DEFAULT_CATALOG_FACET_LIMIT;
  const matchedCatalogEntries = rankedEntries.map(({ entry, searchMatch }) =>
    catalogEntryFromRegistryEntry(entry, registry, searchMatch)
  );
  const entries = options.limit !== undefined
    ? matchedCatalogEntries.slice(0, options.limit)
    : matchedCatalogEntries;

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
    summary: buildSummary(rawEntryCount, matchedCatalogEntries, entries.length),
    filters,
    ...(querySupplied
      ? {
          search: {
            query,
            terms: searchTerms,
            searchableFields: CATALOG_SEARCHABLE_FIELDS,
            matchedCount: matchedEntryCount
          }
        }
      : {}),
    ...(options.limit !== undefined
      ? {
          limit: {
            requested: options.limit,
            matchedEntryCount,
            returnedEntryCount: entries.length,
            omittedEntryCount: Math.max(0, matchedEntryCount - entries.length)
          }
        }
      : {}),
    ...(options.includeFacets
      ? {
          facets: buildCatalogFacets(rankedEntries, facetLimit)
        }
      : {}),
    entries,
    warnings: matchedCatalogEntries.some(entry => entry.quality.status === 'needs-refinement')
      ? ['Some matched entries need LLM refinement before they should be promoted as ready public-reference artifacts.']
      : []
  };
}
