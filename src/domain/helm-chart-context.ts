import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { buildKnowledgeCacheId } from '../knowledge/cache.ts';
import type { KnowledgeFetcher } from '../knowledge/retrieve.ts';
import { retrieveKnowledgeContextPacket } from '../knowledge/retrieve.ts';
import type { KnowledgeSource, RetrievedContextPacket } from '../types/knowledge.ts';
import type {
  HelmChartDependencySummary,
  HelmChartMetadataSummary,
  HelmChartSummary
} from '../types/repository.ts';

interface HelmChartMetadata {
  apiVersion: string | null;
  name: string | null;
  version: string | null;
  appVersion: string | null;
  kubeVersion: string | null;
  chartType: string | null;
  description: string | null;
  home: string | null;
  sources: string[];
  dependencies: HelmChartDependency[];
}

interface HelmChartDependency {
  name: string;
  version: string | null;
  repository: string | null;
  alias: string | null;
}

interface HelmChartLockMetadata {
  digest: string | null;
  generated: string | null;
  dependencies: HelmChartDependency[];
}

interface HelmChartMetadataKnowledgeContentInput {
  workspaceRoot: string;
  chart: HelmChartSummary;
  source: KnowledgeSource;
}

const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;

interface HelmChartContextRetrievalInput {
  workspaceRoot: string;
  chart: HelmChartSummary;
  cacheRoot: string;
  reason: string;
  fetcher?: KnowledgeFetcher;
  now?: Date;
  maxExternalSources?: number;
}

interface HelmChartIdentity {
  chartRoot: string;
  chartName: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(asString).filter((entry): entry is string => Boolean(entry))
    : [];
}

function safeString(value: string | null): string | null {
  return value && !SECRET_VALUE_PATTERN.test(value) ? value : null;
}

function safeStringArray(values: string[]): string[] {
  return values.filter(value => !SECRET_VALUE_PATTERN.test(value));
}

function safeSourceUrls(values: string[]): string[] {
  return values.map(safeRepository).filter((value): value is string => Boolean(value));
}

function safeRepository(value: string | null): string | null {
  if (!value || SECRET_VALUE_PATTERN.test(value)) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      return null;
    }
  } catch {
    // Non-URL repository references are retained when they are not secret-like.
  }

  return value;
}

function asDependencyArray(value: unknown): HelmChartDependency[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(entry => {
    if (!isRecord(entry)) {
      return [];
    }

    const name = asString(entry.name);
    if (!name) {
      return [];
    }

    return [{
      name,
      version: asString(entry.version),
      repository: asString(entry.repository),
      alias: asString(entry.alias)
    }];
  });
}

function isFetchableUrl(value: string | null): value is string {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function emptyChartMetadata(chart: HelmChartIdentity): HelmChartMetadata {
  return {
    apiVersion: null,
    name: chart.chartName,
    version: null,
    appVersion: null,
    kubeVersion: null,
    chartType: null,
    description: null,
    home: null,
    sources: [],
    dependencies: []
  };
}

function emptyChartLockMetadata(): HelmChartLockMetadata {
  return {
    digest: null,
    generated: null,
    dependencies: []
  };
}

function estimateTokens(value: string): number {
  return Math.ceil(value.length / 4);
}

function buildExcerpt(content: string, maxExcerptChars = 2000): string {
  if (content.length <= maxExcerptChars) {
    return content;
  }

  return content.slice(0, maxExcerptChars).trimEnd();
}

async function readWorkspaceFile(workspaceRoot: string, path: string): Promise<string | null> {
  try {
    return await readFile(join(workspaceRoot, path), 'utf8');
  } catch {
    return null;
  }
}

async function readChartMetadata(workspaceRoot: string, chart: HelmChartIdentity): Promise<HelmChartMetadata> {
  const content = await readWorkspaceFile(workspaceRoot, join(chart.chartRoot, 'Chart.yaml'));
  if (!content) {
    return emptyChartMetadata(chart);
  }

  const parsed = (() => {
    try {
      return parseDocument(content).toJSON() as unknown;
    } catch {
      return null;
    }
  })();
  if (!isRecord(parsed)) {
    return emptyChartMetadata(chart);
  }

  return {
    apiVersion: asString(parsed.apiVersion),
    name: asString(parsed.name) ?? chart.chartName,
    version: asString(parsed.version),
    appVersion: asString(parsed.appVersion),
    kubeVersion: asString(parsed.kubeVersion),
    chartType: asString(parsed.type),
    description: asString(parsed.description),
    home: asString(parsed.home),
    sources: asStringArray(parsed.sources),
    dependencies: asDependencyArray(parsed.dependencies)
  };
}

async function readChartLockMetadata(
  workspaceRoot: string,
  chart: HelmChartIdentity
): Promise<HelmChartLockMetadata> {
  const content = await readWorkspaceFile(workspaceRoot, join(chart.chartRoot, 'Chart.lock'));
  if (!content) {
    return emptyChartLockMetadata();
  }

  const parsed = (() => {
    try {
      return parseDocument(content).toJSON() as unknown;
    } catch {
      return null;
    }
  })();
  return isRecord(parsed)
    ? {
      digest: asString(parsed.digest),
      generated: asString(parsed.generated),
      dependencies: asDependencyArray(parsed.dependencies)
    }
    : emptyChartLockMetadata();
}

async function readChartLockDependencies(
  workspaceRoot: string,
  chart: HelmChartIdentity
): Promise<HelmChartDependency[]> {
  return (await readChartLockMetadata(workspaceRoot, chart)).dependencies;
}

function withOptionalVersion(source: KnowledgeSource, version: string | null): KnowledgeSource {
  if (!version) {
    return source;
  }

  return {
    ...source,
    version
  };
}

function uniqueKnowledgeSources(sources: KnowledgeSource[]): KnowledgeSource[] {
  const seen = new Set<string>();
  const unique: KnowledgeSource[] = [];

  for (const source of sources) {
    const id = buildKnowledgeCacheId(source);
    if (seen.has(id)) {
      continue;
    }

    seen.add(id);
    unique.push(source);
  }

  return unique;
}

function uniqueDependencies(dependencies: HelmChartDependency[]): HelmChartDependency[] {
  const seen = new Set<string>();
  const unique: HelmChartDependency[] = [];

  for (const dependency of dependencies) {
    const key = [
      dependency.name,
      dependency.version ?? '',
      dependency.repository ?? '',
      dependency.alias ?? ''
    ].join('|');
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(dependency);
  }

  return unique;
}

function compactDependency(
  dependency: HelmChartDependency,
  sourcePath: string,
  locked: boolean
): Record<string, unknown> | null {
  const name = safeString(dependency.name);
  if (!name) {
    return null;
  }

  return {
    name,
    sourcePath,
    locked,
    ...(safeString(dependency.version) ? { version: safeString(dependency.version) } : {}),
    ...(safeRepository(dependency.repository) ? { repository: safeRepository(dependency.repository) } : {}),
    ...(safeString(dependency.alias) ? { alias: safeString(dependency.alias) } : {})
  };
}

function toHelmDependencySummary(dependency: HelmChartDependency, locked: boolean): HelmChartDependencySummary | null {
  const name = safeString(dependency.name);
  if (!name) {
    return null;
  }

  const repository = safeRepository(dependency.repository);

  return {
    name,
    locked,
    ...(safeString(dependency.version) ? { version: safeString(dependency.version) } : {}),
    ...(repository ? { repository } : {}),
    ...(safeString(dependency.alias) ? { alias: safeString(dependency.alias) } : {})
  };
}

function compactDependencySummaries(
  declaredDependencies: HelmChartDependency[],
  lockedDependencies: HelmChartDependency[]
): HelmChartDependencySummary[] {
  const byName = new Map<string, HelmChartDependencySummary>();

  for (const dependency of declaredDependencies) {
    const summary = toHelmDependencySummary(dependency, false);
    if (!summary || byName.has(summary.name)) {
      continue;
    }

    byName.set(summary.name, summary);
  }

  for (const dependency of lockedDependencies) {
    const summary = toHelmDependencySummary(dependency, true);
    if (!summary) {
      continue;
    }

    const declared = byName.get(summary.name);
    byName.set(summary.name, {
      ...summary,
      ...(summary.repository ? {} : declared?.repository ? { repository: declared.repository } : {}),
      ...(summary.alias ? {} : declared?.alias ? { alias: declared.alias } : {})
    });
  }

  return Array.from(byName.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export async function readHelmChartMetadataSummary(
  workspaceRoot: string,
  chart: HelmChartIdentity
): Promise<HelmChartMetadataSummary> {
  const metadata = await readChartMetadata(workspaceRoot, chart);
  const lockPath = join(chart.chartRoot, 'Chart.lock');
  const hasLockFile = Boolean(await readWorkspaceFile(workspaceRoot, lockPath));
  const lockMetadata = await readChartLockMetadata(workspaceRoot, chart);
  const chartName = safeString(metadata.name) ?? safeString(chart.chartName) ?? chart.chartName;
  const dependencies = compactDependencySummaries(metadata.dependencies, lockMetadata.dependencies);

  return {
    chartName,
    hasLockFile,
    dependencyCount: dependencies.length,
    dependencies,
    ...(safeString(metadata.apiVersion) ? { apiVersion: safeString(metadata.apiVersion) } : {}),
    ...(safeString(metadata.version) ? { version: safeString(metadata.version) } : {}),
    ...(safeString(metadata.appVersion) ? { appVersion: safeString(metadata.appVersion) } : {}),
    ...(safeString(metadata.kubeVersion) ? { kubeVersion: safeString(metadata.kubeVersion) } : {}),
    ...(safeString(metadata.chartType) ? { chartType: safeString(metadata.chartType) } : {})
  };
}

export async function buildHelmChartMetadataKnowledgeContent(
  input: HelmChartMetadataKnowledgeContentInput
): Promise<string | null> {
  if (!input.source.localPath) {
    return null;
  }

  const metadata = await readChartMetadata(input.workspaceRoot, input.chart);
  const chartFile = join(input.chart.chartRoot, 'Chart.yaml');
  const lockFile = join(input.chart.chartRoot, 'Chart.lock');
  const hasChartLock = Boolean(await readWorkspaceFile(input.workspaceRoot, lockFile));
  const lockMetadata = await readChartLockMetadata(input.workspaceRoot, input.chart);
  const dependencies = [
    ...metadata.dependencies.map(dependency => compactDependency(dependency, chartFile, false)),
    ...lockMetadata.dependencies.map(dependency => compactDependency(dependency, lockFile, true))
  ].filter((dependency): dependency is Record<string, unknown> => Boolean(dependency));

  return JSON.stringify({
    kind: 'infra-agent.helm-chart-metadata-summary',
    schemaVersion: 1,
    mutationAllowed: false,
    chartRoot: input.chart.chartRoot,
    chartFile,
    ...(hasChartLock ? { lockFile } : {}),
    chartName: safeString(metadata.name) ?? safeString(input.chart.chartName) ?? 'chart',
    ...(safeString(metadata.apiVersion) ? { apiVersion: safeString(metadata.apiVersion) } : {}),
    ...(safeString(metadata.version) ? { version: safeString(metadata.version) } : {}),
    ...(safeString(metadata.appVersion) ? { appVersion: safeString(metadata.appVersion) } : {}),
    ...(safeString(metadata.kubeVersion) ? { kubeVersion: safeString(metadata.kubeVersion) } : {}),
    ...(safeString(metadata.chartType) ? { chartType: safeString(metadata.chartType) } : {}),
    ...(safeString(metadata.description) ? { description: safeString(metadata.description) } : {}),
    ...(safeRepository(metadata.home) ? { home: safeRepository(metadata.home) } : {}),
    ...(safeString(lockMetadata.digest) ? { lockDigest: safeString(lockMetadata.digest) } : {}),
    ...(safeString(lockMetadata.generated) ? { lockGenerated: safeString(lockMetadata.generated) } : {}),
    sources: safeSourceUrls(safeStringArray(metadata.sources)),
    dependencies
  });
}

export async function buildHelmChartKnowledgeSources(
  workspaceRoot: string,
  chart: HelmChartSummary
): Promise<KnowledgeSource[]> {
  const metadata = await readChartMetadata(workspaceRoot, chart);
  const lockPath = join(chart.chartRoot, 'Chart.lock');
  const hasChartLock = Boolean(await readWorkspaceFile(workspaceRoot, lockPath));
  const lockedDependencies = await readChartLockDependencies(workspaceRoot, chart);
  const chartName = metadata.name ?? chart.chartName;
  const sources: KnowledgeSource[] = [];

  sources.push(withOptionalVersion({
    kind: 'chart-metadata',
    name: `${chartName}:Chart.yaml`,
    chart: chartName,
    localPath: join(chart.chartRoot, 'Chart.yaml'),
    module: chart.chartRoot,
    packageName: chartName
  }, metadata.version));

  if (chart.valuesSchemaFile) {
    sources.push(withOptionalVersion({
      kind: 'chart-schema',
      name: `${chartName}:values.schema.json`,
      chart: chartName,
      localPath: chart.valuesSchemaFile
    }, metadata.version));
    sources.push({
      kind: 'helm-docs',
      name: 'values.schema.json',
      chart: chartName,
      url: 'https://helm.sh/docs/topics/charts/#schema-files'
    });
  }

  if (hasChartLock) {
    sources.push(withOptionalVersion({
      kind: 'chart-lock',
      name: `${chartName}:Chart.lock`,
      chart: chartName,
      localPath: lockPath
    }, metadata.version));
  }

  if (metadata.home) {
    sources.push(withOptionalVersion({
      kind: 'chart-docs',
      name: `${chartName}:home`,
      chart: chartName,
      url: metadata.home
    }, metadata.version));
  }

  for (const [index, sourceUrl] of metadata.sources.entries()) {
    sources.push(withOptionalVersion({
      kind: 'chart-docs',
      name: `${chartName}:source-${index + 1}`,
      chart: chartName,
      url: sourceUrl
    }, metadata.version));
  }

  for (const dependency of uniqueDependencies([...metadata.dependencies, ...lockedDependencies])) {
    if (!isFetchableUrl(dependency.repository)) {
      continue;
    }

    sources.push({
      kind: 'chart-docs',
      name: `${chartName}:dependency:${dependency.name}`,
      chart: dependency.name,
      module: chartName,
      packageName: dependency.alias ?? dependency.name,
      version: dependency.version ?? undefined,
      url: dependency.repository
    });
  }

  return uniqueKnowledgeSources(sources);
}

function contentTypeForLocalHelmSource(source: KnowledgeSource): 'application/json' | 'application/yaml' {
  return source.kind === 'chart-schema' ? 'application/json' : 'application/yaml';
}

function isLocalHelmContextPacketSource(source: KnowledgeSource): boolean {
  return source.kind === 'chart-schema' || source.kind === 'chart-lock';
}

async function buildLocalHelmPacket(
  workspaceRoot: string,
  source: KnowledgeSource,
  reason: string
): Promise<RetrievedContextPacket | null> {
  if (!isLocalHelmContextPacketSource(source) || !source.localPath) {
    return null;
  }

  const content = await readWorkspaceFile(workspaceRoot, source.localPath);
  if (!content) {
    return null;
  }

  const excerpt = buildExcerpt(content);
  return {
    id: buildKnowledgeCacheId(source),
    source,
    confidence: 'high',
    reason,
    contentType: contentTypeForLocalHelmSource(source),
    excerpt,
    tokenEstimate: estimateTokens(excerpt)
  };
}

export async function retrieveHelmChartContextPackets(
  input: HelmChartContextRetrievalInput
): Promise<RetrievedContextPacket[]> {
  const sources = await buildHelmChartKnowledgeSources(input.workspaceRoot, input.chart);
  const packets: RetrievedContextPacket[] = [];
  const externalSources = sources.filter(source => !isLocalHelmContextPacketSource(source) && source.url);

  for (const source of sources.filter(isLocalHelmContextPacketSource)) {
    const packet = await buildLocalHelmPacket(input.workspaceRoot, source, input.reason);
    if (packet) {
      packets.push(packet);
    }
  }

  for (const source of externalSources.slice(0, input.maxExternalSources ?? 3)) {
    const packet = await retrieveKnowledgeContextPacket({
      cacheRoot: input.cacheRoot,
      source,
      reason: input.reason,
      fetcher: input.fetcher,
      now: input.now
    });

    if (packet) {
      packets.push(packet);
    }
  }

  return packets;
}
