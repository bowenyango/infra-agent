import { buildScopedPackReport } from './scoped-pack.ts';
import { buildKnowledgeSourcesReport } from '../knowledge/sources.ts';
import type { ConfigSemanticFact, ConfigSemanticsSummary } from '../types/config-semantics.ts';
import type { InfraDomainId, WorkspaceInspection } from '../types/repository.ts';
import type { ScopedPackTarget } from '../types/scoped-pack.ts';
import type {
  RefsFact,
  RefsReferenceSource,
  RefsReport,
  RefsReportOptions,
  RefsTarget
} from '../types/refs.ts';

const DEFAULT_REF_LIMIT = 40;
const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const DOMAIN_ORDER = ['helm', 'pulumi', 'terraform'] as const satisfies readonly InfraDomainId[];

function normalizeMaxUnits(value: number | undefined): number {
  if (!Number.isInteger(value)) {
    return DEFAULT_REF_LIMIT;
  }

  return Math.max(1, value ?? DEFAULT_REF_LIMIT);
}

function uniqueSorted<T extends string>(values: Iterable<T>): T[] {
  return Array.from(new Set(Array.from(values).filter(Boolean))).sort();
}

function compactDomains(domains: Iterable<InfraDomainId>): InfraDomainId[] {
  const values = new Set(domains);
  return DOMAIN_ORDER.filter(domain => values.has(domain));
}

function isSecretLike(value: string | undefined): boolean {
  return typeof value === 'string' && SECRET_VALUE_PATTERN.test(value);
}

function factIsSecretLike(fact: ConfigSemanticFact): boolean {
  return [
    fact.path,
    fact.message,
    fact.source.path,
    ...(fact.values ?? []),
    ...(fact.relatedPaths ?? [])
  ].some(isSecretLike);
}

function targetKey(targetKind: string, targetPath: string): string {
  return `${targetKind}:${targetPath}`;
}

function interfaceKind(fact: ConfigSemanticFact): string {
  return `${fact.source.kind}:${fact.kind}`;
}

function refsForTarget(
  semantics: ConfigSemanticsSummary[],
  targetKind: string,
  targetPath: string
): ConfigSemanticFact[] {
  return semantics
    .filter(summary =>
      summary.targetKind === targetKind
      && summary.targetPath === targetPath
    )
    .flatMap(summary => summary.facts)
    .filter(fact => !factIsSecretLike(fact));
}

function toRefsTarget(input: {
  target: ScopedPackTarget;
  interfaceKinds: string[];
}): RefsTarget {
  return {
    id: input.target.id,
    domain: input.target.domain,
    kind: input.target.kind,
    name: input.target.name,
    path: input.target.path,
    matchReasons: [...input.target.matchReasons],
    lookupIdentities: [...input.target.lookupIdentities],
    interfaceKinds: input.interfaceKinds,
    environmentHints: [...input.target.environmentHints],
    files: input.target.files,
    validationTargets: [...input.target.validationTargets],
    semanticFactCount: input.target.semanticFactCount,
    ...(input.target.chartName !== undefined ? { chartName: input.target.chartName } : {}),
    ...(input.target.resourcePackages !== undefined ? { resourcePackages: [...input.target.resourcePackages] } : {}),
    ...(input.target.resourceTypes !== undefined ? { resourceTypes: [...input.target.resourceTypes] } : {}),
    ...(input.target.dataSourceTypes !== undefined ? { dataSourceTypes: [...input.target.dataSourceTypes] } : {}),
    ...(input.target.moduleHints !== undefined ? { moduleHints: [...input.target.moduleHints] } : {})
  };
}

function toRefsFact(
  summary: ConfigSemanticsSummary,
  fact: ConfigSemanticFact
): RefsFact {
  return {
    targetKind: summary.targetKind,
    targetPath: summary.targetPath,
    kind: fact.kind,
    path: fact.path,
    summary: fact.message,
    confidence: fact.confidence,
    source: fact.source,
    ...(fact.values !== undefined ? { values: [...fact.values] } : {}),
    ...(fact.relatedPaths !== undefined ? { relatedPaths: [...fact.relatedPaths] } : {})
  };
}

function targetRefs(
  semantics: ConfigSemanticsSummary[],
  targetKeys: Set<string>
): RefsFact[] {
  return semantics
    .filter(summary => targetKeys.has(targetKey(summary.targetKind, summary.targetPath)))
    .flatMap(summary => summary.facts
      .filter(fact => !factIsSecretLike(fact))
      .map(fact => toRefsFact(summary, fact))
    )
    .sort((left, right) =>
      left.targetPath.localeCompare(right.targetPath)
      || left.source.kind.localeCompare(right.source.kind)
      || left.kind.localeCompare(right.kind)
      || left.path.localeCompare(right.path)
    );
}

function toRefsSource(source: Awaited<ReturnType<typeof buildKnowledgeSourcesReport>>['sources'][number]): RefsReferenceSource {
  return {
    id: source.id,
    domain: source.domain,
    targetPath: source.targetPath,
    sourceKind: source.source.kind,
    sourceName: source.source.name,
    freshness: source.cacheStatus,
    requiresFetch: source.requiresFetch,
    refreshRecommended: source.cacheStatus === 'stale' || source.cacheStatus === 'missing',
    storageScope: source.storagePolicy.scope,
    ...(source.source.version !== undefined ? { version: source.source.version } : {}),
    ...(source.source.provider !== undefined ? { provider: source.source.provider } : {}),
    ...(source.source.packageName !== undefined ? { packageName: source.source.packageName } : {}),
    ...(source.source.chart !== undefined ? { chart: source.source.chart } : {}),
    ...(source.source.module !== undefined ? { module: source.source.module } : {})
  };
}

function recommendedAction(input: {
  matchedTargetCount: number;
  includedRefCount: number;
  sources: RefsReferenceSource[];
}): RefsReport['summary']['recommendedAction'] {
  if (input.matchedTargetCount === 0) {
    return 'narrow-scope';
  }

  if (
    input.includedRefCount === 0
    || input.sources.some(source => source.refreshRecommended)
  ) {
    return 'prefetch-or-extract-knowledge';
  }

  return 'use-refs-for-scoped-edit';
}

export async function buildRefsReport(
  inspection: WorkspaceInspection,
  options: RefsReportOptions
): Promise<RefsReport> {
  const maxUnits = normalizeMaxUnits(options.maxUnits);
  const scopedPack = buildScopedPackReport(inspection, {
    scope: options.scope,
    domains: options.domains
  });
  const targetPaths = scopedPack.targets.map(target => target.path);
  const targetKeys = new Set(scopedPack.targets.map(target => targetKey(target.kind, target.path)));
  const sourceReport = targetPaths.length > 0
    ? await buildKnowledgeSourcesReport(inspection, {
        domains: options.domains,
        targetPaths
      })
    : null;
  const allRefs = targetRefs(inspection.configSemantics, targetKeys);
  const refs = allRefs.slice(0, maxUnits);
  const sources = (sourceReport?.sources ?? []).map(toRefsSource);
  const refsByTarget = new Map<string, ConfigSemanticFact[]>();

  for (const target of scopedPack.targets) {
    refsByTarget.set(
      targetKey(target.kind, target.path),
      refsForTarget(inspection.configSemantics, target.kind, target.path)
    );
  }

  const targets = scopedPack.targets.map(target => toRefsTarget({
    target,
    interfaceKinds: uniqueSorted(
      (refsByTarget.get(targetKey(target.kind, target.path)) ?? []).map(interfaceKind)
    )
  }));
  const includedRefCount = refs.length;
  const omittedRefCount = Math.max(0, allRefs.length - includedRefCount);

  return {
    kind: 'infra-agent.refs',
    schemaVersion: 1,
    mutationAllowed: false,
    workspaceRoot: inspection.workspaceRoot,
    profile: {
      id: inspection.profile.id,
      label: inspection.profile.label
    },
    scope: scopedPack.scope,
    filters: {
      domains: options.domains ?? [],
      maxUnits
    },
    summary: {
      matchedTargetCount: targets.length,
      sourceCount: sources.length,
      includedRefCount,
      omittedRefCount,
      staleSourceCount: sources.filter(source => source.freshness === 'stale').length,
      missingOrSkippedSourceCount: sources.filter(source => source.freshness === 'missing').length,
      domains: compactDomains(targets.map(target => target.domain)),
      recommendedAction: recommendedAction({
        matchedTargetCount: targets.length,
        includedRefCount,
        sources
      })
    },
    targets,
    sources,
    refs,
    omitted: {
      unmatchedScope: scopedPack.omitted.unmatchedScope,
      filteredDomainCount: scopedPack.omitted.filteredDomainCount,
      sourceCount: Math.max(0, (sourceReport?.sourceCount ?? 0) - sources.length),
      refCount: omittedRefCount
    }
  };
}
