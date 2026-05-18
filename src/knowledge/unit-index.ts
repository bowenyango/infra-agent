import { createHash } from 'node:crypto';
import type {
  KnowledgePack,
  KnowledgePackSource,
  KnowledgePackSourceFreshness,
  KnowledgePackUnit
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

export interface KnowledgeUnitIndexFieldEntry {
  fieldPath: string;
  privacyScopes: KnowledgeUnitPrivacyScope[];
  unitCounts: KnowledgeUnitCountByType;
  includedUnitCount: number;
}

export interface KnowledgeUnitFieldIndexEntry {
  domain: InfraDomainId;
  targetPath: string;
  sourceId: string;
  sourceKind: KnowledgeSourceKind;
  sourceName: string;
  resourceKey: string;
  fieldPath: string;
  provider?: string;
  packageName?: string;
  chart?: string;
  module?: string;
  version?: string;
  storageScope: KnowledgeStorageScope;
  privacyScopes: KnowledgeUnitPrivacyScope[];
  freshness: KnowledgePackSourceFreshness;
  unitCounts: KnowledgeUnitCountByType;
  includedUnitCount: number;
  unitPaths: string[];
  retrievalKeys: string[];
}

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
  fieldPaths: string[];
  fields: KnowledgeUnitIndexFieldEntry[];
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
  fieldEntryCount: number;
  fieldIncludedUnitCount: number;
  entries: KnowledgeUnitIndexEntry[];
  fieldEntries: KnowledgeUnitFieldIndexEntry[];
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
  fieldPath?: string | readonly string[];
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

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).filter(Boolean))).sort();
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
  fieldPaths: string[];
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

  for (const fieldPath of input.fieldPaths) {
    keys.push(`fieldPath:${fieldPath}`);
  }

  return keys.sort();
}

function stripUnitPathPrefix(path: string): string {
  const prefixes = [
    'guidance.required.',
    'guidance.identity.',
    'guidance.replacement.',
    'diagnostic.identity.',
    'diagnostic.replacement.',
    'diagnostic.required-chart-value.'
  ];

  for (const prefix of prefixes) {
    if (path.startsWith(prefix)) {
      return path.slice(prefix.length);
    }
  }

  return path;
}

function fieldPathsForUnit(unit: KnowledgePackUnit): string[] {
  const candidates = [unit.path];

  if (unit.unitType === 'diagnostic') {
    for (const prefix of ['identity-field:', 'replacement-sensitive-field:', 'required-chart-value:']) {
      if (unit.signature.startsWith(prefix)) {
        candidates.push(unit.signature.slice(prefix.length));
      }
    }
  }

  return uniqueSorted(candidates.map(stripUnitPathPrefix).filter(path => path.length > 0));
}

function resourceKeyFromSource(source: KnowledgePackSource, semanticPath: string): string | null {
  if (source.kind === 'terraform-registry') {
    const match = source.name.match(/^(resource|data-source):(.+)$/);
    if (match) {
      return `${match[1] === 'data-source' ? 'data' : 'resource'}.${match[2]}`;
    }
  }

  if (source.kind === 'pulumi-docs' && typeof source.module === 'string') {
    const match = source.module.match(/^([A-Za-z][A-Za-z0-9_-]*):([A-Za-z0-9_.\/-]+):([A-Za-z][A-Za-z0-9_.-]*)$/);
    if (match) {
      const packageName = match[1] ?? '';
      const modulePath = (match[2] ?? '').split('/').filter(Boolean).join('.');
      const typeName = match[3] ?? '';
      return `pulumi.resource.${packageName}.${modulePath}.${typeName}`;
    }
  }

  if (source.chart !== undefined && semanticPath.startsWith(`chart.${source.chart}.`)) {
    return `chart.${source.chart}`;
  }

  return null;
}

function fieldPathFromResourceKey(semanticPath: string, resourceKey: string): string {
  const prefix = `${resourceKey}.`;
  if (semanticPath.startsWith(prefix)) {
    return semanticPath.slice(prefix.length);
  }

  return semanticPath;
}

function buildFieldRetrievalKeys(input: {
  source: KnowledgePackSource;
  resourceKey: string;
  fieldPath: string;
  unitCounts: KnowledgeUnitCountByType;
  privacyScopes: KnowledgeUnitPrivacyScope[];
}): string[] {
  const keys = [
    `domain:${input.source.domain}`,
    `targetPath:${input.source.targetPath}`,
    `sourceKind:${input.source.kind}`,
    `resourceKey:${input.resourceKey}`,
    `fieldPath:${input.fieldPath}`,
    `storageScope:${input.source.storagePolicy.scope}`,
    `freshness:${input.source.freshness}`
  ];

  pushOptionalKey(keys, 'provider', input.source.provider);
  pushOptionalKey(keys, 'packageName', input.source.packageName);
  pushOptionalKey(keys, 'chart', input.source.chart);
  pushOptionalKey(keys, 'module', input.source.module);
  pushOptionalKey(keys, 'version', input.source.version);

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
  const sourceFieldPaths = new Map<string, Set<string>>();
  const sourceFieldCounts = new Map<string, Map<string, {
    unitCounts: KnowledgeUnitCountByType;
    privacyScopes: Set<KnowledgeUnitPrivacyScope>;
  }>>();
  const sourceById = new Map(pack.sources.map(source => [source.id, source]));
  const fieldEntriesByKey = new Map<string, {
    source: KnowledgePackSource;
    resourceKey: string;
    fieldPath: string;
    unitCounts: KnowledgeUnitCountByType;
    privacyScopes: Set<KnowledgeUnitPrivacyScope>;
    unitPaths: Set<string>;
  }>();

  for (const source of pack.sources) {
    sourceUnitCounts.set(source.id, emptyUnitCounts());
    sourcePrivacyScopes.set(source.id, new Set<KnowledgeUnitPrivacyScope>([source.storagePolicy.scope]));
    sourceFieldPaths.set(source.id, new Set<string>());
    sourceFieldCounts.set(source.id, new Map());
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

    const fieldPaths = sourceFieldPaths.get(unit.sourceId);
    if (fieldPaths !== undefined) {
      const fieldCountsByPath = sourceFieldCounts.get(unit.sourceId);
      const source = sourceById.get(unit.sourceId);
      for (const semanticPath of fieldPathsForUnit(unit)) {
        if (source !== undefined) {
          const resourceKey = resourceKeyFromSource(source, semanticPath);
          if (resourceKey !== null) {
            fieldPaths.add(semanticPath);
            if (fieldCountsByPath !== undefined) {
              const fieldSummary = fieldCountsByPath.get(semanticPath) ?? {
                unitCounts: emptyUnitCounts(),
                privacyScopes: new Set<KnowledgeUnitPrivacyScope>()
              };
              fieldSummary.unitCounts[unit.unitType] += 1;
              fieldSummary.privacyScopes.add(unit.privacyScope);
              fieldCountsByPath.set(semanticPath, fieldSummary);
            }

            const fieldPath = fieldPathFromResourceKey(semanticPath, resourceKey);
            const fieldEntryKey = `${source.id}\0${resourceKey}\0${fieldPath}`;
            const fieldEntry = fieldEntriesByKey.get(fieldEntryKey) ?? {
              source,
              resourceKey,
              fieldPath,
              unitCounts: emptyUnitCounts(),
              privacyScopes: new Set<KnowledgeUnitPrivacyScope>(),
              unitPaths: new Set<string>()
            };

            fieldEntry.unitCounts[unit.unitType] += 1;
            fieldEntry.privacyScopes.add(unit.privacyScope);
            fieldEntry.unitPaths.add(unit.path);
            fieldEntriesByKey.set(fieldEntryKey, fieldEntry);
          }
        }
      }
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
    const fieldPaths = uniqueSorted(sourceFieldPaths.get(source.id) ?? []);
    const fields = Array.from(sourceFieldCounts.get(source.id)?.entries() ?? [])
      .map(([fieldPath, fieldSummary]) => ({
        fieldPath,
        privacyScopes: sortedPrivacyScopes(fieldSummary.privacyScopes),
        unitCounts: fieldSummary.unitCounts,
        includedUnitCount: KNOWLEDGE_UNIT_TYPES.reduce(
          (sum, unitType) => sum + fieldSummary.unitCounts[unitType],
          0
        )
      } satisfies KnowledgeUnitIndexFieldEntry))
      .sort((left, right) => left.fieldPath.localeCompare(right.fieldPath));
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
      fieldPaths,
      fields,
      retrievalKeys: buildRetrievalKeys({
        source,
        unitCounts,
        fieldPaths,
        privacyScopes
      })
    } satisfies KnowledgeUnitIndexEntry;
  }).sort(compareEntries);
  const fieldEntries = Array.from(fieldEntriesByKey.values())
    .map(fieldEntry => {
      const includedUnitCount = KNOWLEDGE_UNIT_TYPES.reduce(
        (sum, unitType) => sum + fieldEntry.unitCounts[unitType],
        0
      );
      const privacyScopes = sortedPrivacyScopes(fieldEntry.privacyScopes);

      return {
        domain: fieldEntry.source.domain,
        targetPath: fieldEntry.source.targetPath,
        sourceId: fieldEntry.source.id,
        sourceKind: fieldEntry.source.kind,
        sourceName: fieldEntry.source.name,
        resourceKey: fieldEntry.resourceKey,
        fieldPath: fieldEntry.fieldPath,
        ...(fieldEntry.source.provider !== undefined ? { provider: fieldEntry.source.provider } : {}),
        ...(fieldEntry.source.packageName !== undefined ? { packageName: fieldEntry.source.packageName } : {}),
        ...(fieldEntry.source.chart !== undefined ? { chart: fieldEntry.source.chart } : {}),
        ...(fieldEntry.source.module !== undefined ? { module: fieldEntry.source.module } : {}),
        ...(fieldEntry.source.version !== undefined ? { version: fieldEntry.source.version } : {}),
        storageScope: fieldEntry.source.storagePolicy.scope,
        privacyScopes,
        freshness: fieldEntry.source.freshness,
        unitCounts: fieldEntry.unitCounts,
        includedUnitCount,
        unitPaths: uniqueSorted(fieldEntry.unitPaths),
        retrievalKeys: buildFieldRetrievalKeys({
          source: fieldEntry.source,
          resourceKey: fieldEntry.resourceKey,
          fieldPath: fieldEntry.fieldPath,
          unitCounts: fieldEntry.unitCounts,
          privacyScopes
        })
      } satisfies KnowledgeUnitFieldIndexEntry;
    })
    .sort((left, right) =>
      left.domain.localeCompare(right.domain)
      || left.targetPath.localeCompare(right.targetPath)
      || left.resourceKey.localeCompare(right.resourceKey)
      || left.fieldPath.localeCompare(right.fieldPath)
      || left.sourceName.localeCompare(right.sourceName)
    );

  return {
    kind: KNOWLEDGE_UNIT_INDEX_KIND,
    schemaVersion: KNOWLEDGE_UNIT_INDEX_SCHEMA_VERSION,
    mutationAllowed: false,
    packId: pack.packId,
    sourceCount: entries.length,
    includedUnitCount: pack.includedUnitCount,
    omittedUnitCount: pack.omittedUnitCount,
    fieldEntryCount: fieldEntries.length,
    fieldIncludedUnitCount: fieldEntries.reduce((sum, entry) => sum + entry.includedUnitCount, 0),
    entries,
    fieldEntries
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

function normalizeFieldPath(value: string): string {
  return stripUnitPathPrefix(value.trim()).replace(/\\/g, '/').replace(/\/+/g, '.').replace(/:+/g, '.').replace(/\.+/g, '.').replace(/^\.+|\.+$/g, '').toLowerCase();
}

function matchesFieldPathValue(actualValues: string[], expected: string | readonly string[] | undefined): boolean {
  const values = filterValues(expected);
  if (values === null) {
    return true;
  }

  const normalizedActualValues = actualValues.map(normalizeFieldPath);
  return values.some(value => {
    const normalizedExpected = normalizeFieldPath(value);
    return normalizedActualValues.some(actual =>
      actual === normalizedExpected
      || actual.endsWith(`.${normalizedExpected}`)
    );
  });
}

function sumFieldUnitCounts(fields: KnowledgeUnitIndexFieldEntry[]): KnowledgeUnitCountByType {
  const counts = emptyUnitCounts();
  for (const field of fields) {
    for (const unitType of KNOWLEDGE_UNIT_TYPES) {
      counts[unitType] += field.unitCounts[unitType];
    }
  }

  return counts;
}

function privacyScopesFromFields(fields: KnowledgeUnitIndexFieldEntry[]): KnowledgeUnitPrivacyScope[] {
  return sortedPrivacyScopes(new Set(fields.flatMap(field => field.privacyScopes)));
}

function buildNarrowedRetrievalKeys(
  entry: KnowledgeUnitIndexEntry,
  unitCounts: KnowledgeUnitCountByType,
  privacyScopes: KnowledgeUnitPrivacyScope[],
  fieldPaths: string[]
): string[] {
  const keys = entry.retrievalKeys.filter(key =>
    !key.startsWith('fieldPath:')
    && !key.startsWith('unitType:')
    && !key.startsWith('privacyScope:')
  );

  for (const privacyScope of privacyScopes) {
    keys.push(`privacyScope:${privacyScope}`);
  }

  for (const unitType of unitTypesFromCounts(unitCounts)) {
    keys.push(`unitType:${unitType}`);
  }

  for (const fieldPath of fieldPaths) {
    keys.push(`fieldPath:${fieldPath}`);
  }

  return keys.sort();
}

function narrowEntryByFieldPath(
  entry: KnowledgeUnitIndexEntry,
  fieldPath: string | readonly string[] | undefined
): KnowledgeUnitIndexEntry {
  if (fieldPath === undefined) {
    return entry;
  }

  const fields = entry.fields.filter(field => matchesFieldPathValue([field.fieldPath], fieldPath));
  const unitCounts = sumFieldUnitCounts(fields);
  const includedUnitCount = KNOWLEDGE_UNIT_TYPES.reduce((sum, unitType) => sum + unitCounts[unitType], 0);
  const fieldPaths = fields.map(field => field.fieldPath);
  const privacyScopes = privacyScopesFromFields(fields);
  const retrievalKeys = buildNarrowedRetrievalKeys(entry, unitCounts, privacyScopes, fieldPaths);

  return {
    ...entry,
    privacyScopes,
    unitCounts,
    includedUnitCount,
    fieldPaths,
    fields,
    retrievalKeys
  };
}

function knowledgeUnitIndexEntryMatchesStructuralFilter(
  entry: KnowledgeUnitIndexEntry,
  filter: KnowledgeUnitIndexEntryFilter
): boolean {
  return matchesValue(entry.domain, filter.domain)
    && matchesStringValue(entry.targetPath, filter.targetPath)
    && matchesValue(entry.sourceKind, filter.sourceKind)
    && matchesStringValue(entry.provider, filter.provider)
    && matchesStringValue(entry.packageName, filter.packageName)
    && matchesStringValue(entry.chart, filter.chart)
    && matchesStringValue(entry.module, filter.module)
    && matchesStringValue(entry.version, filter.version)
    && matchesValue(entry.storageScope, filter.storageScope);
}

function knowledgeUnitIndexEntryMatchesUnitFilter(
  entry: KnowledgeUnitIndexEntry,
  filter: KnowledgeUnitIndexEntryFilter
): boolean {
  const unitTypes = filterValues(filter.unitType);
  const privacyScopes = filterValues(filter.privacyScope);

  return matchesFieldPathValue(entry.fieldPaths, filter.fieldPath)
    && (unitTypes === null || unitTypes.some(unitType => entry.unitCounts[unitType] > 0))
    && (privacyScopes === null || privacyScopes.some(scope => entry.privacyScopes.includes(scope)));
}

export function knowledgeUnitIndexEntryMatchesFilter(
  entry: KnowledgeUnitIndexEntry,
  filter: KnowledgeUnitIndexEntryFilter
): boolean {
  return knowledgeUnitIndexEntryMatchesStructuralFilter(entry, filter)
    && knowledgeUnitIndexEntryMatchesUnitFilter(entry, filter);
}

export function knowledgeUnitIndexFieldEntryMatchesFilter(
  entry: KnowledgeUnitFieldIndexEntry,
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
    && matchesFieldPathValue([entry.fieldPath, `${entry.resourceKey}.${entry.fieldPath}`], filter.fieldPath)
    && (unitTypes === null || unitTypes.some(unitType => entry.unitCounts[unitType] > 0))
    && (privacyScopes === null || privacyScopes.some(scope => entry.privacyScopes.includes(scope)));
}

export function selectKnowledgeUnitIndexEntries(
  index: KnowledgeUnitMetadataIndex,
  filter: KnowledgeUnitIndexEntryFilter
): KnowledgeUnitIndexEntry[] {
  return index.entries
    .filter(entry => knowledgeUnitIndexEntryMatchesStructuralFilter(entry, filter))
    .map(entry => narrowEntryByFieldPath(entry, filter.fieldPath))
    .filter(entry => knowledgeUnitIndexEntryMatchesUnitFilter(entry, filter))
    .filter(entry => entry.includedUnitCount > 0);
}

export function selectKnowledgeUnitIndexFieldEntries(
  index: KnowledgeUnitMetadataIndex,
  filter: KnowledgeUnitIndexEntryFilter
): KnowledgeUnitFieldIndexEntry[] {
  return index.fieldEntries.filter(entry => knowledgeUnitIndexFieldEntryMatchesFilter(entry, filter));
}
