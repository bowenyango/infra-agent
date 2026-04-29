import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { buildKnowledgeCacheId } from '../knowledge/cache.ts';
import type { KnowledgeFetcher } from '../knowledge/retrieve.ts';
import { retrieveKnowledgeContextPacket } from '../knowledge/retrieve.ts';
import type { KnowledgeSource, RetrievedContextPacket } from '../types/knowledge.ts';
import type { HelmChartSummary } from '../types/repository.ts';

interface HelmChartMetadata {
  name: string | null;
  version: string | null;
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

interface HelmChartContextRetrievalInput {
  workspaceRoot: string;
  chart: HelmChartSummary;
  cacheRoot: string;
  reason: string;
  fetcher?: KnowledgeFetcher;
  now?: Date;
  maxExternalSources?: number;
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

async function readChartMetadata(workspaceRoot: string, chart: HelmChartSummary): Promise<HelmChartMetadata> {
  const content = await readWorkspaceFile(workspaceRoot, join(chart.chartRoot, 'Chart.yaml'));
  if (!content) {
    return {
      name: chart.chartName,
      version: null,
      home: null,
      sources: [],
      dependencies: []
    };
  }

  const parsed = parseDocument(content).toJSON() as unknown;
  if (!isRecord(parsed)) {
    return {
      name: chart.chartName,
      version: null,
      home: null,
      sources: [],
      dependencies: []
    };
  }

  return {
    name: asString(parsed.name) ?? chart.chartName,
    version: asString(parsed.version),
    home: asString(parsed.home),
    sources: asStringArray(parsed.sources),
    dependencies: asDependencyArray(parsed.dependencies)
  };
}

async function readChartLockDependencies(
  workspaceRoot: string,
  chart: HelmChartSummary
): Promise<HelmChartDependency[]> {
  const content = await readWorkspaceFile(workspaceRoot, join(chart.chartRoot, 'Chart.lock'));
  if (!content) {
    return [];
  }

  const parsed = parseDocument(content).toJSON() as unknown;
  return isRecord(parsed) ? asDependencyArray(parsed.dependencies) : [];
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

async function buildLocalHelmPacket(
  workspaceRoot: string,
  source: KnowledgeSource,
  reason: string
): Promise<RetrievedContextPacket | null> {
  if ((source.kind !== 'chart-schema' && source.kind !== 'chart-lock') || !source.localPath) {
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
  const externalSources = sources.filter(source => source.kind !== 'chart-schema' && source.kind !== 'chart-lock');

  for (const source of sources.filter(candidate => candidate.kind === 'chart-schema' || candidate.kind === 'chart-lock')) {
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
