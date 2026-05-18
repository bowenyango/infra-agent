import { buildRefsReport } from '../domain/refs.ts';
import type { RefsFact, RefsReport, RefsTarget } from '../types/refs.ts';
import type { InfraDomainId, WorkspaceInspection } from '../types/repository.ts';
import { createFileKnowledgeStore, type KnowledgeStore } from './knowledge-store.ts';
import { buildKnowledgePack, type KnowledgePack } from './pack.ts';
import { buildKnowledgeSourcesReport, type KnowledgeSourcesReport } from './sources.ts';
import {
  buildKnowledgeUnitMetadataIndex,
  type KnowledgeUnitMetadataIndex
} from './unit-index.ts';

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
  targets: RefsTarget[];
  suggestedFiles: string[];
  validationTargets: string[];
  refs: RefsFact[];
  sources: KnowledgeSourcesReport['sources'];
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

function compactTargetForResource(target: RefsTarget, resource: string): RefsTarget {
  return {
    ...target,
    lookupIdentities: target.lookupIdentities.filter(identity => identityMatchesResource(identity, resource)),
    ...(target.resourceTypes !== undefined
      ? { resourceTypes: target.resourceTypes.filter(typeName => resourceTypeMatchesResource(typeName, resource)) }
      : {}),
    ...(target.dataSourceTypes !== undefined
      ? { dataSourceTypes: target.dataSourceTypes.filter(typeName => resourceTypeMatchesResource(typeName, resource)) }
      : {})
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

function collectSuggestedFiles(targets: RefsTarget[]): string[] {
  return uniqueSorted(targets.flatMap(target => [
    ...target.files.primary,
    ...target.files.related
  ]));
}

function collectValidationTargets(targets: RefsTarget[]): string[] {
  return uniqueSorted(targets.flatMap(target => target.validationTargets));
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
  const targets = refsReport.targets.map(target => compactTargetForResource(target, resource));
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

  return {
    kind: 'infra-agent.knowledge-resource-report',
    schemaVersion: 1,
    mutationAllowed: false,
    workspaceRoot: inspection.workspaceRoot,
    cacheRoot: inspection.knowledgeCache.root,
    resource,
    requestedDomains: sourceReport.requestedDomains,
    sourceIds: options.sourceIds ?? [],
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
    pack,
    unitIndex
  };
}
