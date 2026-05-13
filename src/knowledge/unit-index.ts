import { createHash } from 'node:crypto';
import type {
  KnowledgePack,
  KnowledgePackSource,
  KnowledgePackSourceFreshness
} from './pack.ts';
import type {
  KnowledgeSourceKind,
  KnowledgeUnitPrivacyScope,
  KnowledgeUnitType
} from '../types/knowledge.ts';
import { KNOWLEDGE_UNIT_TYPES } from '../types/knowledge.ts';
import type { InfraDomainId } from '../types/repository.ts';
import type { KnowledgeStorageScope } from './storage-policy.ts';

export const KNOWLEDGE_UNIT_INDEX_KIND = 'infra-agent.knowledge-unit-index' as const;
export const KNOWLEDGE_UNIT_INDEX_SCHEMA_VERSION = 1 as const;

export type KnowledgeUnitCountByType = Record<KnowledgeUnitType, number>;

export interface KnowledgeUnitIndexEntry {
  domain: InfraDomainId;
  targetPath: string;
  sourceId: string;
  sourceKind: KnowledgeSourceKind;
  sourceName: string;
  provider?: string;
  packageName?: string;
  chart?: string;
  module?: string;
  version?: string;
  storageScope: KnowledgeStorageScope;
  privacyScopes: KnowledgeUnitPrivacyScope[];
  freshness: KnowledgePackSourceFreshness;
  sourceContentHash?: string;
  unitCounts: KnowledgeUnitCountByType;
  includedUnitCount: number;
  omittedUnitCount?: number;
  sourceUnitCountEstimate: number;
  retrievalKeys: string[];
}

export interface KnowledgeUnitMetadataIndex {
  kind: typeof KNOWLEDGE_UNIT_INDEX_KIND;
  schemaVersion: typeof KNOWLEDGE_UNIT_INDEX_SCHEMA_VERSION;
  mutationAllowed: false;
  packId: string;
  sourceCount: number;
  includedUnitCount: number;
  omittedUnitCount: number;
  entries: KnowledgeUnitIndexEntry[];
}

export interface KnowledgeUnitIndexEntryFilter {
  domain?: InfraDomainId | readonly InfraDomainId[];
  targetPath?: string | readonly string[];
  sourceKind?: KnowledgeSourceKind | readonly KnowledgeSourceKind[];
  provider?: string | readonly string[];
  packageName?: string | readonly string[];
  chart?: string | readonly string[];
  module?: string | readonly string[];
  version?: string | readonly string[];
  unitType?: KnowledgeUnitType | readonly KnowledgeUnitType[];
  privacyScope?: KnowledgeUnitPrivacyScope | readonly KnowledgeUnitPrivacyScope[];
  storageScope?: KnowledgeStorageScope | readonly KnowledgeStorageScope[];
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

function shortDigest(value: string): string {
  if (/^[a-f0-9]{12,64}$/.test(value)) {
    return value.slice(0, 12);
  }

  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function pushOptionalKey(keys: string[], name: string, value: string | undefined): void {
  if (value !== undefined && value.length > 0) {
    keys.push(`${name}:${value}`);
  }
}

function unitTypesFromCounts(counts: KnowledgeUnitCountByType): KnowledgeUnitType[] {
  return KNOWLEDGE_UNIT_TYPES.filter(unitType => counts[unitType] > 0);
}

function sortedPrivacyScopes(scopes: ReadonlySet<KnowledgeUnitPrivacyScope>): KnowledgeUnitPrivacyScope[] {
  const preferredOrder: KnowledgeUnitPrivacyScope[] = [
    'public-reference',
    'workspace-private',
    'internal-team',
    'private-run'
  ];

  return preferredOrder.filter(scope => scopes.has(scope));
}

function buildRetrievalKeys(input: {
  source: KnowledgePackSource;
  unitCounts: KnowledgeUnitCountByType;
  privacyScopes: KnowledgeUnitPrivacyScope[];
}): string[] {
  const keys: string[] = [
    `domain:${input.source.domain}`,
    `targetPath:${input.source.targetPath}`,
    `sourceKind:${input.source.kind}`,
    `sourceIdDigest:${shortDigest(input.source.id)}`,
    `storageScope:${input.source.storagePolicy.scope}`,
    `freshness:${input.source.freshness}`
  ];

  pushOptionalKey(keys, 'provider', input.source.provider);
  pushOptionalKey(keys, 'packageName', input.source.packageName);
  pushOptionalKey(keys, 'chart', input.source.chart);
  pushOptionalKey(keys, 'module', input.source.module);
  pushOptionalKey(keys, 'version', input.source.version);
  pushOptionalKey(keys, 'sourceContentHash', shortDigest(input.source.contentHash));

  for (const privacyScope of input.privacyScopes) {
    keys.push(`privacyScope:${privacyScope}`);
  }

  for (const unitType of unitTypesFromCounts(input.unitCounts)) {
    keys.push(`unitType:${unitType}`);
  }

  return keys.sort();
}

function compareOptionalText(left: string | undefined, right: string | undefined): number {
  return (left ?? '').localeCompare(right ?? '');
}

function compareEntries(left: KnowledgeUnitIndexEntry, right: KnowledgeUnitIndexEntry): number {
  return left.domain.localeCompare(right.domain)
    || left.targetPath.localeCompare(right.targetPath)
    || left.sourceKind.localeCompare(right.sourceKind)
    || compareOptionalText(left.provider, right.provider)
    || compareOptionalText(left.packageName, right.packageName)
    || compareOptionalText(left.chart, right.chart)
    || compareOptionalText(left.module, right.module)
    || compareOptionalText(left.version, right.version)
    || left.sourceName.localeCompare(right.sourceName)
    || left.sourceId.localeCompare(right.sourceId);
}

function sourceUnitCountEstimate(input: {
  pack: KnowledgePack;
  source: KnowledgePackSource;
  includedUnitCount: number;
}): number {
  if (input.pack.sources.length === 1) {
    return input.pack.unitCount;
  }

  if (input.pack.omittedUnitCount === 0) {
    return input.includedUnitCount;
  }

  return Math.max(input.includedUnitCount, input.source.factCount);
}

function sourceOmittedUnitCount(input: {
  pack: KnowledgePack;
  sourceUnitCountEstimate: number;
  includedUnitCount: number;
}): number | undefined {
  if (input.pack.sources.length === 1 || input.pack.omittedUnitCount === 0) {
    return Math.max(0, input.sourceUnitCountEstimate - input.includedUnitCount);
  }

  return undefined;
}

export function buildKnowledgeUnitMetadataIndex(pack: KnowledgePack): KnowledgeUnitMetadataIndex {
  const sourceUnitCounts = new Map<string, KnowledgeUnitCountByType>();
  const sourcePrivacyScopes = new Map<string, Set<KnowledgeUnitPrivacyScope>>();

  for (const source of pack.sources) {
    sourceUnitCounts.set(source.id, emptyUnitCounts());
    sourcePrivacyScopes.set(source.id, new Set<KnowledgeUnitPrivacyScope>([source.storagePolicy.scope]));
  }

  for (const unit of pack.units) {
    const counts = sourceUnitCounts.get(unit.sourceId);
    if (counts !== undefined) {
      counts[unit.unitType] += 1;
    }

    const privacyScopes = sourcePrivacyScopes.get(unit.sourceId);
    if (privacyScopes !== undefined) {
      privacyScopes.add(unit.privacyScope);
    }
  }

  const entries = pack.sources.map(source => {
    const unitCounts = sourceUnitCounts.get(source.id) ?? emptyUnitCounts();
    const includedUnitCount = KNOWLEDGE_UNIT_TYPES.reduce(
      (sum, unitType) => sum + unitCounts[unitType],
      0
    );
    const privacyScopes = sortedPrivacyScopes(
      sourcePrivacyScopes.get(source.id) ?? new Set<KnowledgeUnitPrivacyScope>([source.storagePolicy.scope])
    );
    const estimatedUnitCount = sourceUnitCountEstimate({
      pack,
      source,
      includedUnitCount
    });
    const omittedUnitCount = sourceOmittedUnitCount({
      pack,
      sourceUnitCountEstimate: estimatedUnitCount,
      includedUnitCount
    });

    return {
      domain: source.domain,
      targetPath: source.targetPath,
      sourceId: source.id,
      sourceKind: source.kind,
      sourceName: source.name,
      ...(source.provider !== undefined ? { provider: source.provider } : {}),
      ...(source.packageName !== undefined ? { packageName: source.packageName } : {}),
      ...(source.chart !== undefined ? { chart: source.chart } : {}),
      ...(source.module !== undefined ? { module: source.module } : {}),
      ...(source.version !== undefined ? { version: source.version } : {}),
      storageScope: source.storagePolicy.scope,
      privacyScopes,
      freshness: source.freshness,
      ...(source.contentHash.length > 0 ? { sourceContentHash: shortDigest(source.contentHash) } : {}),
      unitCounts,
      includedUnitCount,
      ...(omittedUnitCount !== undefined ? { omittedUnitCount } : {}),
      sourceUnitCountEstimate: estimatedUnitCount,
      retrievalKeys: buildRetrievalKeys({
        source,
        unitCounts,
        privacyScopes
      })
    } satisfies KnowledgeUnitIndexEntry;
  }).sort(compareEntries);

  return {
    kind: KNOWLEDGE_UNIT_INDEX_KIND,
    schemaVersion: KNOWLEDGE_UNIT_INDEX_SCHEMA_VERSION,
    mutationAllowed: false,
    packId: pack.packId,
    sourceCount: entries.length,
    includedUnitCount: pack.includedUnitCount,
    omittedUnitCount: pack.omittedUnitCount,
    entries
  };
}

function filterValues<T extends string>(value: T | readonly T[] | undefined): readonly T[] | null {
  if (value === undefined) {
    return null;
  }

  return Array.isArray(value) ? value : [value];
}

function matchesValue<T extends string>(actual: T | undefined, expected: T | readonly T[] | undefined): boolean {
  const values = filterValues(expected);
  return values === null || (actual !== undefined && values.includes(actual));
}

function matchesStringValue(actual: string | undefined, expected: string | readonly string[] | undefined): boolean {
  const values = filterValues(expected);
  return values === null || (actual !== undefined && values.includes(actual));
}

export function knowledgeUnitIndexEntryMatchesFilter(
  entry: KnowledgeUnitIndexEntry,
  filter: KnowledgeUnitIndexEntryFilter
): boolean {
  const unitTypes = filterValues(filter.unitType);
  const privacyScopes = filterValues(filter.privacyScope);

  return matchesValue(entry.domain, filter.domain)
    && matchesStringValue(entry.targetPath, filter.targetPath)
    && matchesValue(entry.sourceKind, filter.sourceKind)
    && matchesStringValue(entry.provider, filter.provider)
    && matchesStringValue(entry.packageName, filter.packageName)
    && matchesStringValue(entry.chart, filter.chart)
    && matchesStringValue(entry.module, filter.module)
    && matchesStringValue(entry.version, filter.version)
    && matchesValue(entry.storageScope, filter.storageScope)
    && (unitTypes === null || unitTypes.some(unitType => entry.unitCounts[unitType] > 0))
    && (privacyScopes === null || privacyScopes.some(scope => entry.privacyScopes.includes(scope)));
}

export function selectKnowledgeUnitIndexEntries(
  index: KnowledgeUnitMetadataIndex,
  filter: KnowledgeUnitIndexEntryFilter
): KnowledgeUnitIndexEntry[] {
  return index.entries.filter(entry => knowledgeUnitIndexEntryMatchesFilter(entry, filter));
}
