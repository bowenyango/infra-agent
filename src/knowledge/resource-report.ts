import { createHash } from 'node:crypto';
import { buildRefsReport } from '../domain/refs.ts';
import type { RefsFact, RefsReport, RefsTarget } from '../types/refs.ts';
import type {
  HelmChartMetadataSummary,
  HelmDeploymentLinkSummary,
  InfraDomainId,
  WorkspaceInspection
} from '../types/repository.ts';
import { createFileKnowledgeStore, type KnowledgeStore } from './knowledge-store.ts';
import { buildKnowledgePack, type KnowledgePack, type KnowledgePackSourceFreshness } from './pack.ts';
import { buildKnowledgeSourcesReport, type KnowledgeSourcesReport } from './sources.ts';
import {
  buildKnowledgeUnitMetadataIndex,
  type KnowledgeUnitCountByType,
  type KnowledgeUnitMetadataIndex
} from './unit-index.ts';
import type { KnowledgeSourceKind } from '../types/knowledge.ts';
import type { KnowledgeSourceCacheStatus } from './cache-status.ts';
import type { KnowledgeStorageScope } from './storage-policy.ts';

export type ResourceKnowledgeRecommendedAction =
  | 'use-resource-knowledge'
  | 'prefetch-or-extract-knowledge'
  | 'narrow-scope';

export interface ResourceKnowledgeReportOptions {
  resource: string;
  domains?: InfraDomainId[];
  sourceIds?: string[];
  maxUnits?: number;
}

export interface ResourceKnowledgeTarget extends RefsTarget {
  chartMetadata?: HelmChartMetadataSummary;
  deploymentLinks?: HelmDeploymentLinkSummary[];
  hasValuesFile?: boolean;
  hasTemplatesDir?: boolean;
  valuesSchemaFile?: string | null;
}

export interface ResourceKnowledgeCachePostureSource {
  sourceId: string;
  domain: InfraDomainId;
  targetPath: string;
  sourceKind: KnowledgeSourceKind;
  sourceName: string;
  cacheStatus: KnowledgeSourceCacheStatus;
  requiresFetch: boolean;
  freshness?: KnowledgePackSourceFreshness;
  storageScope: KnowledgeStorageScope;
  sourceContentHash?: string;
  fingerprintDigest?: string;
  fingerprintFileCount?: number;
  includedUnitCount: number;
  omittedUnitCount?: number;
  unitCounts: KnowledgeUnitCountByType;
}

export interface ResourceKnowledgeCachePosture {
  packId: string;
  cacheRootSource: string;
  selectionHash: string;
  targetHash: string;
  sourceHash: string;
  unitIndexHash: string;
  sourceCount: number;
  local: number;
  fresh: number;
  stale: number;
  missing: number;
  refreshRecommended: number;
  reusedSourceCount: number;
  reusable: boolean;
  sources: ResourceKnowledgeCachePostureSource[];
}

export interface ResourceKnowledgeReport {
  kind: 'infra-agent.knowledge-resource-report';
  schemaVersion: 1;
  mutationAllowed: false;
  workspaceRoot: string;
  cacheRoot: string;
  resource: string;
  requestedDomains: InfraDomainId[];
  sourceIds: string[];
  maxUnits?: number;
  targetPaths: string[];
  summary: {
    matchedTargetCount: number;
    sourceCount: number;
    includedRefCount: number;
    includedUnitCount: number;
    omittedUnitCount: number;
    staleSourceCount: number;
    missingOrSkippedSourceCount: number;
    suggestedFileCount: number;
    validationTargetCount: number;
    domains: InfraDomainId[];
    recommendedAction: ResourceKnowledgeRecommendedAction;
  };
  targets: ResourceKnowledgeTarget[];
  suggestedFiles: string[];
  validationTargets: string[];
  refs: RefsFact[];
  sources: KnowledgeSourcesReport['sources'];
  cachePosture: ResourceKnowledgeCachePosture;
  pack: KnowledgePack;
  unitIndex: KnowledgeUnitMetadataIndex;
}

const DOMAIN_ORDER = ['helm', 'pulumi', 'terraform'] as const satisfies readonly InfraDomainId[];

function createReadOnlyKnowledgeStore(root: string): KnowledgeStore {
  const store = createFileKnowledgeStore(root);

  return {
    root: store.root,
    buildId: source => store.buildId(source),
    read: source => store.read(source),
    write: async () => {
      throw new Error('Resource knowledge reports are read-only and must not write knowledge cache entries.');
    },
    isStale: (entry, now) => store.isStale(entry, now)
  };
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).filter(Boolean))).sort();
}

function shortDigest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function stableHash(value: unknown): string {
  return shortDigest(JSON.stringify(value));
}

function compactDigest(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }

  return /^[a-f0-9]{12,64}$/.test(value)
    ? value.slice(0, 12)
    : shortDigest(value);
}

function normalizeIdentity(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').replace(/\/$/, '').toLowerCase();
}

function normalizeLookup(value: string): string {
  return normalizeIdentity(value).replace(/[:/]+/g, '.').replace(/\.+/g, '.');
}

function resourceLookupParts(resource: string): string[] {
  const normalized = normalizeLookup(resource);
  const withoutPrefixes = normalized
    .replace(/^resource\./, '')
    .replace(/^data\./, '')
    .replace(/^chart\./, '')
    .replace(/^release\./, '')
    .replace(/^argocd\./, '')
    .replace(/^pulumi\./, '');
  const typeOnly = withoutPrefixes.split('.').slice(0, -1).join('.');

  return uniqueSorted([
    normalized,
    withoutPrefixes,
    typeOnly
  ].filter(value => value.length > 0));
}

function identityMatchesResource(identity: string, resource: string): boolean {
  const normalizedIdentity = normalizeIdentity(identity);
  const normalizedResource = normalizeIdentity(resource);

  return normalizedIdentity === normalizedResource
    || normalizedIdentity.endsWith(`.${normalizedResource}`)
    || normalizedIdentity.endsWith(`:${normalizedResource}`);
}

function resourceTypeMatchesResource(typeName: string, resource: string): boolean {
  const normalizedType = normalizeIdentity(typeName);
  const normalizedResource = normalizeIdentity(resource);

  return normalizedResource === normalizedType
    || normalizedResource.startsWith(`${normalizedType}.`)
    || normalizedResource.endsWith(`:${normalizedType}`)
    || normalizedResource.includes(`:${normalizedType}.`);
}

function compactTargetForResource(
  inspection: WorkspaceInspection,
  target: RefsTarget,
  resource: string
): ResourceKnowledgeTarget {
  const compactTarget: ResourceKnowledgeTarget = {
    ...target,
    lookupIdentities: target.lookupIdentities.filter(identity => identityMatchesResource(identity, resource)),
    ...(target.resourceTypes !== undefined
      ? { resourceTypes: target.resourceTypes.filter(typeName => resourceTypeMatchesResource(typeName, resource)) }
      : {}),
    ...(target.dataSourceTypes !== undefined
      ? { dataSourceTypes: target.dataSourceTypes.filter(typeName => resourceTypeMatchesResource(typeName, resource)) }
      : {})
  };

  if (target.domain !== 'helm' || target.kind !== 'helm-chart') {
    return compactTarget;
  }

  const chart = inspection.helmCharts.find(candidate => candidate.chartRoot === target.path);
  if (!chart) {
    return compactTarget;
  }

  return {
    ...compactTarget,
    chartMetadata: chart.chartMetadata,
    deploymentLinks: chart.deploymentLinks.map(link => ({
      ...link,
      valueFiles: [...link.valueFiles],
      valuesLayers: link.valuesLayers.map(layer => ({ ...layer }))
    })),
    hasValuesFile: chart.hasValuesFile,
    hasTemplatesDir: chart.hasTemplatesDir,
    valuesSchemaFile: chart.valuesSchemaFile
  };
}

function refMatchesResource(ref: RefsFact, resource: string): boolean {
  const normalizedPath = normalizeLookup(ref.path);
  const normalizedRelated = (ref.relatedPaths ?? []).map(normalizeLookup);
  const normalizedValues = (ref.values ?? []).map(normalizeLookup);
  const parts = resourceLookupParts(resource);

  return parts.some(part =>
    normalizedPath.includes(part)
    || normalizedRelated.some(relatedPath => relatedPath.includes(part))
    || normalizedValues.includes(part)
  );
}

function compactRefsForResource(refsReport: RefsReport, resource: string): RefsFact[] {
  const refs = refsReport.refs.filter(ref => refMatchesResource(ref, resource));

  return refs.length > 0 ? refs : refsReport.refs;
}

function compactDomains(domains: Iterable<InfraDomainId>): InfraDomainId[] {
  const values = new Set(domains);
  return DOMAIN_ORDER.filter(domain => values.has(domain));
}

function collectSuggestedFiles(targets: ResourceKnowledgeTarget[]): string[] {
  return uniqueSorted(targets.flatMap(target => [
    ...target.files.primary,
    ...target.files.related
  ]));
}

function collectValidationTargets(targets: ResourceKnowledgeTarget[]): string[] {
  return uniqueSorted(targets.flatMap(target => target.validationTargets));
}

function emptyUnitCounts(): KnowledgeUnitCountByType {
  return {
    fact: 0,
    guidance: 0,
    example: 0,
    diagnostic: 0,
    recipe: 0
  };
}

function buildCachePosture(input: {
  inspection: WorkspaceInspection;
  resource: string;
  requestedDomains: InfraDomainId[];
  sourceIds: string[];
  maxUnits?: number;
  targetPaths: string[];
  targets: ResourceKnowledgeTarget[];
  matchedTargetCount: number;
  includedUnitCount: number;
  sourceReport: KnowledgeSourcesReport;
  pack: KnowledgePack;
  unitIndex: KnowledgeUnitMetadataIndex;
}): ResourceKnowledgeCachePosture {
  const packSourcesById = new Map(input.pack.sources.map(source => [source.id, source]));
  const indexEntriesBySourceId = new Map(input.unitIndex.entries.map(entry => [entry.sourceId, entry]));
  const sources = input.sourceReport.sources.map(source => {
    const packSource = packSourcesById.get(source.id);
    const indexEntry = indexEntriesBySourceId.get(source.id);
    const sourceContentHash = compactDigest(indexEntry?.sourceContentHash ?? packSource?.contentHash);
    const fingerprintDigest = compactDigest(packSource?.fingerprintDigest);

    return {
      sourceId: source.id,
      domain: source.domain,
      targetPath: source.targetPath,
      sourceKind: source.source.kind,
      sourceName: source.source.name,
      cacheStatus: source.cacheStatus,
      requiresFetch: source.requiresFetch,
      ...(packSource?.freshness !== undefined ? { freshness: packSource.freshness } : {}),
      storageScope: source.storagePolicy.scope,
      ...(sourceContentHash !== undefined ? { sourceContentHash } : {}),
      ...(fingerprintDigest !== undefined ? { fingerprintDigest } : {}),
      ...(packSource?.fingerprintFileCount !== undefined ? { fingerprintFileCount: packSource.fingerprintFileCount } : {}),
      includedUnitCount: indexEntry?.includedUnitCount ?? 0,
      ...(indexEntry?.omittedUnitCount !== undefined ? { omittedUnitCount: indexEntry.omittedUnitCount } : {}),
      unitCounts: indexEntry?.unitCounts ?? emptyUnitCounts()
    } satisfies ResourceKnowledgeCachePostureSource;
  });
  const cacheStatus = input.sourceReport.summary.cacheStatus;
  const reusedSourceCount = cacheStatus.local + cacheStatus.fresh;
  const reusable = input.matchedTargetCount > 0
    && input.includedUnitCount > 0
    && cacheStatus.stale === 0
    && cacheStatus.missing === 0;

  return {
    packId: input.pack.packId,
    cacheRootSource: input.inspection.knowledgeCache.source,
    selectionHash: stableHash({
      resource: input.resource,
      requestedDomains: input.requestedDomains,
      sourceIds: input.sourceIds,
      maxUnits: input.maxUnits,
      targetPaths: input.targetPaths
    }),
    targetHash: stableHash(input.targets.map(target => ({
      id: target.id,
      path: target.path,
      domain: target.domain,
      kind: target.kind,
      lookupIdentities: target.lookupIdentities,
      validationTargets: target.validationTargets
    }))),
    sourceHash: stableHash(sources.map(source => ({
      sourceId: source.sourceId,
      cacheStatus: source.cacheStatus,
      freshness: source.freshness,
      sourceContentHash: source.sourceContentHash,
      fingerprintDigest: source.fingerprintDigest,
      includedUnitCount: source.includedUnitCount,
      unitCounts: source.unitCounts
    }))),
    unitIndexHash: stableHash(input.unitIndex.entries.map(entry => ({
      sourceId: entry.sourceId,
      sourceContentHash: entry.sourceContentHash,
      includedUnitCount: entry.includedUnitCount,
      omittedUnitCount: entry.omittedUnitCount,
      unitCounts: entry.unitCounts,
      retrievalKeys: entry.retrievalKeys
    }))),
    sourceCount: input.sourceReport.sourceCount,
    local: cacheStatus.local,
    fresh: cacheStatus.fresh,
    stale: cacheStatus.stale,
    missing: cacheStatus.missing,
    refreshRecommended: cacheStatus.refreshRecommended,
    reusedSourceCount,
    reusable,
    sources
  };
}

function recommendedAction(input: {
  matchedTargetCount: number;
  includedUnitCount: number;
  staleSourceCount: number;
  missingOrSkippedSourceCount: number;
}): ResourceKnowledgeRecommendedAction {
  if (input.matchedTargetCount === 0) {
    return 'narrow-scope';
  }

  if (
    input.includedUnitCount === 0
    || input.staleSourceCount > 0
    || input.missingOrSkippedSourceCount > 0
  ) {
    return 'prefetch-or-extract-knowledge';
  }

  return 'use-resource-knowledge';
}

export async function buildResourceKnowledgeReport(
  inspection: WorkspaceInspection,
  options: ResourceKnowledgeReportOptions
): Promise<ResourceKnowledgeReport> {
  const resource = options.resource.trim();
  const store = createReadOnlyKnowledgeStore(inspection.knowledgeCache.root);
  const refsReport = await buildRefsReport(inspection, {
    scope: resource,
    domains: options.domains,
    maxUnits: options.maxUnits
  });
  const sourceReport = await buildKnowledgeSourcesReport(inspection, {
    domains: options.domains,
    resource,
    store
  });
  const pack = await buildKnowledgePack(inspection, {
    domains: options.domains,
    resource,
    sourceIds: options.sourceIds ?? [],
    maxUnits: options.maxUnits,
    store
  });
  const unitIndex = buildKnowledgeUnitMetadataIndex(pack);
  const targets = refsReport.targets.map(target => compactTargetForResource(inspection, target, resource));
  const refs = compactRefsForResource(refsReport, resource);
  const targetPaths = uniqueSorted([
    ...targets.map(target => target.path),
    ...sourceReport.targetPaths,
    ...pack.targetPaths
  ]);
  const suggestedFiles = collectSuggestedFiles(targets);
  const validationTargets = collectValidationTargets(targets);
  const staleSourceCount = sourceReport.summary.cacheStatus.stale;
  const missingOrSkippedSourceCount = sourceReport.summary.cacheStatus.missing;
  const includedUnitCount = pack.includedUnitCount;
  const sourceIds = options.sourceIds ?? [];
  const cachePosture = buildCachePosture({
    inspection,
    resource,
    requestedDomains: sourceReport.requestedDomains,
    sourceIds,
    maxUnits: options.maxUnits,
    targetPaths,
    targets,
    matchedTargetCount: refsReport.summary.matchedTargetCount,
    includedUnitCount,
    sourceReport,
    pack,
    unitIndex
  });

  return {
    kind: 'infra-agent.knowledge-resource-report',
    schemaVersion: 1,
    mutationAllowed: false,
    workspaceRoot: inspection.workspaceRoot,
    cacheRoot: inspection.knowledgeCache.root,
    resource,
    requestedDomains: sourceReport.requestedDomains,
    sourceIds,
    ...(options.maxUnits !== undefined ? { maxUnits: options.maxUnits } : {}),
    targetPaths,
    summary: {
      matchedTargetCount: refsReport.summary.matchedTargetCount,
      sourceCount: sourceReport.sourceCount,
      includedRefCount: refs.length,
      includedUnitCount,
      omittedUnitCount: pack.omittedUnitCount,
      staleSourceCount,
      missingOrSkippedSourceCount,
      suggestedFileCount: suggestedFiles.length,
      validationTargetCount: validationTargets.length,
      domains: compactDomains([
        ...refsReport.summary.domains,
        ...sourceReport.requestedDomains.filter(domain => sourceReport.summary.byDomain[domain] !== undefined),
        ...pack.requestedDomains.filter(domain => pack.sources.some(source => source.domain === domain))
      ]),
      recommendedAction: recommendedAction({
        matchedTargetCount: refsReport.summary.matchedTargetCount,
        includedUnitCount,
        staleSourceCount,
        missingOrSkippedSourceCount
      })
    },
    targets,
    suggestedFiles,
    validationTargets,
    refs,
    sources: sourceReport.sources,
    cachePosture,
    pack,
    unitIndex
  };
}
