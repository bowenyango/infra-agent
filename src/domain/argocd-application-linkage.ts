import { readFile } from 'node:fs/promises';
import {
  isAbsolute,
  join,
  posix,
  relative,
  resolve
} from 'node:path';
import { parseAllDocuments } from 'yaml';
import {
  isYamlPath,
  listDirectory,
  shouldIgnoreDirectory
} from '../tools/repository/repository-tools.ts';
import type {
  HelmChartSummary,
  HelmDeploymentLinkSummary,
  HelmValuesLayerSummary
} from '../types/repository.ts';

interface ArgoApplicationSource {
  path: string;
  targetRevision?: string;
  releaseName?: string;
  rawValueFiles: string[];
}

interface ArgoApplicationManifest {
  applicationName: string;
  applicationNamespace?: string;
  applicationFile: string;
  destinationNamespace?: string;
  syncPolicyAutomated: boolean;
  sources: ArgoApplicationSource[];
}

const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;

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

function optionalString(value: unknown): string | undefined {
  return asString(value) ?? undefined;
}

function normalizePath(path: string): string {
  const normalized = path.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
  const collapsed = posix.normalize(normalized);
  return collapsed.replace(/^\/+/, '').replace(/\/$/, '') || '.';
}

function pathIsWithin(path: string, root: string): boolean {
  if (root === '.') {
    return true;
  }

  return path === root || path.startsWith(`${root}/`);
}

function isWorkspaceRelative(resolvedPath: string, workspaceRoot: string): boolean {
  const relativePath = relative(workspaceRoot, resolvedPath);
  return relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath);
}

function uniquePreserveOrder(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    unique.push(value);
  }

  return unique;
}

function compareLinks(left: HelmDeploymentLinkSummary, right: HelmDeploymentLinkSummary): number {
  return left.applicationFile.localeCompare(right.applicationFile)
    || left.applicationName.localeCompare(right.applicationName)
    || left.sourcePath.localeCompare(right.sourcePath);
}

function shouldSkipYamlFile(relativePath: string, charts: HelmChartSummary[]): boolean {
  return charts.some(chart => pathIsWithin(relativePath, normalizePath(join(chart.chartRoot, 'templates'))));
}

async function collectYamlFiles(
  currentDir: string,
  workspaceRoot: string,
  charts: HelmChartSummary[],
  result: string[]
): Promise<void> {
  const entries = await listDirectory(currentDir);

  for (const entry of entries) {
    if (entry.kind === 'directory') {
      if (shouldIgnoreDirectory(entry.name)) {
        continue;
      }

      await collectYamlFiles(entry.path, workspaceRoot, charts, result);
      continue;
    }

    const relativePath = normalizePath(relative(workspaceRoot, entry.path));
    if (!isYamlPath(entry.path) || shouldSkipYamlFile(relativePath, charts)) {
      continue;
    }

    result.push(relativePath);
  }
}

function extractSource(value: unknown): ArgoApplicationSource | null {
  if (!isRecord(value)) {
    return null;
  }

  const sourcePath = asString(value.path);
  if (!sourcePath) {
    return null;
  }

  const helm = isRecord(value.helm) ? value.helm : {};
  return {
    path: normalizePath(sourcePath),
    targetRevision: optionalString(value.targetRevision),
    releaseName: optionalString(helm.releaseName),
    rawValueFiles: asStringArray(helm.valueFiles)
  };
}

function extractSources(spec: Record<string, unknown>): ArgoApplicationSource[] {
  const sources: ArgoApplicationSource[] = [];
  const singleSource = extractSource(spec.source);
  if (singleSource) {
    sources.push(singleSource);
  }

  if (Array.isArray(spec.sources)) {
    for (const source of spec.sources) {
      const parsedSource = extractSource(source);
      if (parsedSource) {
        sources.push(parsedSource);
      }
    }
  }

  const seen = new Set<string>();
  return sources.filter(source => {
    const key = `${source.path}:${source.targetRevision ?? ''}:${source.releaseName ?? ''}:${source.rawValueFiles.join('\u0000')}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function parseArgoApplicationManifest(rawDocument: unknown, applicationFile: string): ArgoApplicationManifest | null {
  if (!isRecord(rawDocument)) {
    return null;
  }

  const apiVersion = asString(rawDocument.apiVersion);
  const kind = asString(rawDocument.kind);
  if (!apiVersion?.startsWith('argoproj.io/') || kind !== 'Application') {
    return null;
  }

  const metadata = isRecord(rawDocument.metadata) ? rawDocument.metadata : {};
  const spec = isRecord(rawDocument.spec) ? rawDocument.spec : null;
  const applicationName = asString(metadata.name);
  if (!applicationName || !spec) {
    return null;
  }

  const destination = isRecord(spec.destination) ? spec.destination : {};
  const syncPolicy = isRecord(spec.syncPolicy) ? spec.syncPolicy : {};
  const automated = Object.prototype.hasOwnProperty.call(syncPolicy, 'automated');
  const sources = extractSources(spec);
  if (sources.length === 0) {
    return null;
  }

  return {
    applicationName,
    applicationNamespace: optionalString(metadata.namespace),
    applicationFile,
    destinationNamespace: optionalString(destination.namespace),
    syncPolicyAutomated: automated,
    sources
  };
}

function resolveValueFiles(workspaceRoot: string, sourcePath: string, rawValueFiles: string[]): {
  valueFiles: string[];
  omittedValueFileCount: number;
} {
  const localValueFiles: string[] = [];
  let omittedValueFileCount = 0;

  for (const rawValueFile of rawValueFiles) {
    const valueFile = rawValueFile.trim();
    if (
      valueFile.length === 0
      || SECRET_VALUE_PATTERN.test(valueFile)
      || valueFile.startsWith('$')
      || /^[a-z][a-z0-9+.-]*:/i.test(valueFile)
      || valueFile.startsWith('/')
    ) {
      omittedValueFileCount += 1;
      continue;
    }

    const resolvedPath = resolve(workspaceRoot, sourcePath, valueFile);
    if (!isWorkspaceRelative(resolvedPath, workspaceRoot)) {
      omittedValueFileCount += 1;
      continue;
    }

    localValueFiles.push(normalizePath(relative(workspaceRoot, resolvedPath)));
  }

  return {
    valueFiles: uniquePreserveOrder(localValueFiles),
    omittedValueFileCount
  };
}

function buildLink(
  workspaceRoot: string,
  chart: HelmChartSummary,
  application: ArgoApplicationManifest,
  source: ArgoApplicationSource
): HelmDeploymentLinkSummary {
  const { valueFiles, omittedValueFileCount } = resolveValueFiles(workspaceRoot, source.path, source.rawValueFiles);
  const valuesLayers = buildValuesLayers(chart, valueFiles);

  return {
    kind: 'argocd-application',
    applicationName: application.applicationName,
    applicationNamespace: application.applicationNamespace,
    applicationFile: application.applicationFile,
    sourcePath: source.path,
    matchReason: 'argocd-source-path-matches-chart-root',
    confidence: 'medium',
    destinationNamespace: application.destinationNamespace,
    targetRevision: source.targetRevision,
    releaseName: source.releaseName,
    valueFiles,
    valueFileCount: valueFiles.length,
    omittedValueFileCount,
    valuesLayers,
    valuesLayerCount: valuesLayers.length,
    syncPolicyAutomated: application.syncPolicyAutomated
  };
}

function buildValuesLayers(chart: HelmChartSummary, valueFiles: string[]): HelmValuesLayerSummary[] {
  const layers: HelmValuesLayerSummary[] = [];

  if (chart.hasValuesFile) {
    layers.push({
      order: layers.length,
      path: chart.chartRoot === '.' ? 'values.yaml' : `${chart.chartRoot}/values.yaml`,
      source: 'chart-default'
    });
  }

  for (const valueFile of valueFiles) {
    layers.push({
      order: layers.length,
      path: valueFile,
      source: 'argocd-value-file'
    });
  }

  return layers;
}

async function readArgoApplicationManifests(workspaceRoot: string, relativePath: string): Promise<ArgoApplicationManifest[]> {
  const absolutePath = join(workspaceRoot, relativePath);
  let content: string;
  try {
    content = await readFile(absolutePath, 'utf8');
  } catch {
    return [];
  }

  let documents;
  try {
    documents = parseAllDocuments(content);
  } catch {
    return [];
  }

  return documents.flatMap(document => {
    if (document.errors.length > 0) {
      return [];
    }

    return parseArgoApplicationManifest(document.toJSON() as unknown, relativePath) ?? [];
  });
}

export async function discoverArgoCdHelmApplicationLinks(
  workspaceRoot: string,
  charts: HelmChartSummary[]
): Promise<Map<string, HelmDeploymentLinkSummary[]>> {
  const yamlFiles: string[] = [];
  await collectYamlFiles(workspaceRoot, workspaceRoot, charts, yamlFiles);
  const linksByChartRoot = new Map<string, HelmDeploymentLinkSummary[]>();
  const chartsByRoot = new Map(charts.map(chart => [normalizePath(chart.chartRoot), chart]));

  for (const yamlFile of yamlFiles.sort()) {
    const applications = await readArgoApplicationManifests(workspaceRoot, yamlFile);
    for (const application of applications) {
      for (const source of application.sources) {
        const chart = chartsByRoot.get(source.path);
        if (!chart) {
          continue;
        }

        const links = linksByChartRoot.get(chart.chartRoot) ?? [];
        links.push(buildLink(workspaceRoot, chart, application, source));
        linksByChartRoot.set(chart.chartRoot, links);
      }
    }
  }

  for (const [chartRoot, links] of linksByChartRoot.entries()) {
    linksByChartRoot.set(chartRoot, links.sort(compareLinks));
  }

  return linksByChartRoot;
}
