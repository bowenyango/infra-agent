import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { collectWorkspaceKnowledgeSources } from './prefetch.ts';
import {
  buildEmptyCuratedKnowledgeFactSet,
  extractCuratedKnowledgeUnitSetFromCacheEntry
} from './curated-units.ts';
import { extractPrebuiltKnowledgeUnitSetFromCacheEntry } from './prebuilt-units.ts';
import { extractKnowledgeFactSetFromCacheEntry } from './facts.ts';
import { extractMarkdownKnowledgeUnitsFromCacheEntry } from './markdown-units.ts';
import { extractKnowledgeUnitSetFromFactSet } from './units.ts';
import { createFileKnowledgeStore, type KnowledgeStore } from './knowledge-store.ts';
import {
  checkKnowledgeSourceFingerprint,
  fingerprintWorkspaceFiles
} from './local-source-fingerprint.ts';
import { buildHelmChartMetadataKnowledgeContent } from '../domain/helm-chart-context.ts';
import { buildPulumiComponentKnowledgeContent } from '../domain/pulumi-components.ts';
import { buildPulumiConfigKnowledgeContent } from '../domain/pulumi-config-knowledge.ts';
import { buildTerraformLocalModuleKnowledgeContent } from '../domain/terraform-local-modules.ts';
import { buildTerraformProviderSchemaKnowledgeContent } from '../domain/terraform-provider-schema.ts';
import type { InfraDomainId, WorkspaceInspection } from '../types/repository.ts';
import type { KnowledgeCacheEntry, KnowledgeContentType, KnowledgeFactSet, KnowledgeSource, KnowledgeUnitSet } from '../types/knowledge.ts';

export type KnowledgeExtractionSourceStatus =
  | 'extracted'
  | 'missing-cache'
  | 'unsupported'
  | 'unreadable'
  | 'skipped';

export interface KnowledgeExtractionSourceResult {
  id: string;
  domain: InfraDomainId;
  targetPath: string;
  status: KnowledgeExtractionSourceStatus;
  factCount: number;
  unitCount: number;
  message?: string;
  source: KnowledgeSource;
}

export interface KnowledgeExtractionReport {
  kind: 'infra-agent.knowledge-extraction';
  schemaVersion: 1;
  mutationAllowed: false;
  workspaceRoot: string;
  cacheRoot: string;
  requestedDomains: InfraDomainId[];
  targetPaths: string[];
  sourceIds: string[];
  sourceCount: number;
  factSetCount: number;
  factCount: number;
  unitSetCount: number;
  unitCount: number;
  skippedSourceCount: number;
  sources: KnowledgeExtractionSourceResult[];
  factSets: KnowledgeFactSet[];
  unitSets: KnowledgeUnitSet[];
}

export interface KnowledgeExtractionOptions {
  domains?: InfraDomainId[];
  targetPaths?: string[];
  sourceIds?: string[];
  store?: KnowledgeStore;
  now?: Date;
  extractedAt?: string;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function localContentType(source: KnowledgeSource): KnowledgeContentType {
  if (
    source.kind === 'chart-schema'
    || source.kind === 'chart-metadata'
    || source.kind === 'provider-schema'
    || source.kind === 'pulumi-config'
    || source.kind === 'pulumi-component'
    || source.kind === 'terraform-module'
    || source.kind === 'internal-knowledge'
    || source.kind === 'knowledge-unit-artifact'
  ) {
    return 'application/json';
  }

  if (source.kind === 'chart-lock') {
    return 'application/yaml';
  }

  return 'text/plain';
}

async function workspaceFileExists(workspaceRoot: string, path: string): Promise<boolean> {
  try {
    await readFile(join(workspaceRoot, path), 'utf8');
    return true;
  } catch {
    return false;
  }
}

function stringArrayFromRecord(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : [];
}

function localFingerprintPaths(source: KnowledgeSource, content: string): string[] {
  if (!source.localPath) {
    return [];
  }

  if (source.kind === 'chart-metadata') {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      return [
        typeof parsed.chartFile === 'string' ? parsed.chartFile : source.localPath,
        typeof parsed.lockFile === 'string' ? parsed.lockFile : null
      ].filter((path): path is string => Boolean(path));
    } catch {
      return [source.localPath];
    }
  }

  if (source.kind === 'terraform-module') {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      return [
        ...stringArrayFromRecord(parsed.callSourcePaths),
        ...stringArrayFromRecord(parsed.moduleSourcePaths)
      ];
    } catch {
      return [source.localPath];
    }
  }

  if (source.kind === 'pulumi-config') {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      return [
        typeof parsed.projectFile === 'string' ? parsed.projectFile : null,
        ...stringArrayFromRecord(parsed.stackFiles)
      ].filter((path): path is string => Boolean(path));
    } catch {
      return [source.localPath];
    }
  }

  if (source.kind === 'pulumi-component') {
    return source.localPath ? [source.localPath] : [];
  }

  if (source.kind === 'provider-schema') {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const blocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
      const usagePaths = blocks.flatMap(block =>
        typeof block === 'object'
        && block !== null
        && Array.isArray((block as Record<string, unknown>).sourcePaths)
          ? stringArrayFromRecord((block as Record<string, unknown>).sourcePaths)
          : []
      );
      const paths = [
        typeof parsed.schemaFile === 'string' ? parsed.schemaFile : source.localPath,
        ...usagePaths
      ];
      if (source.module) {
        paths.push(`${source.module}/.terraform.lock.hcl`);
      }
      return paths;
    } catch {
      return [source.localPath];
    }
  }

  return [source.localPath];
}

async function buildLocalSourceFingerprint(
  inspection: WorkspaceInspection,
  source: KnowledgeSource,
  content: string
): Promise<KnowledgeCacheEntry['fingerprint']> {
  const paths = [];
  for (const path of localFingerprintPaths(source, content)) {
    if (await workspaceFileExists(inspection.workspaceRoot, path)) {
      paths.push(path);
    }
  }

  return paths.length > 0
    ? fingerprintWorkspaceFiles(inspection.workspaceRoot, paths)
    : undefined;
}

async function readFreshLocalSourceEntry(
  inspection: WorkspaceInspection,
  source: KnowledgeSource,
  store: KnowledgeStore,
  now: Date | undefined
): Promise<KnowledgeCacheEntry | null> {
  const cached = await store.read(source);
  if (
    cached === null
    || cached.fingerprint === undefined
    || cached.contentType !== localContentType(source)
    || cached.contentHash !== sha256Hex(cached.content)
    || store.isStale(cached, now)
  ) {
    return null;
  }

  try {
    const freshness = await checkKnowledgeSourceFingerprint(inspection.workspaceRoot, cached.fingerprint);
    return freshness.sourceStale ? null : cached;
  } catch {
    return null;
  }
}

async function writeLocalSourceEntry(
  source: KnowledgeSource,
  contentType: KnowledgeCacheEntry['contentType'],
  content: string,
  fingerprint: KnowledgeCacheEntry['fingerprint'],
  store: KnowledgeStore
): Promise<KnowledgeCacheEntry> {
  const fallbackEntry: KnowledgeCacheEntry = {
    id: store.buildId(source),
    source,
    contentType,
    content,
    contentHash: sha256Hex(content),
    fetchedAt: new Date(0).toISOString(),
    ...(fingerprint ? { fingerprint } : {}),
    metadata: {
      retrieval: 'workspace-local'
    }
  };

  try {
    return await store.write({
      source,
      contentType,
      content,
      fetchedAt: fallbackEntry.fetchedAt,
      ...(fingerprint ? { fingerprint } : {}),
      metadata: fallbackEntry.metadata
    });
  } catch {
    return fallbackEntry;
  }
}

async function readSourceEntry(
  inspection: WorkspaceInspection,
  source: KnowledgeSource,
  store: KnowledgeStore,
  now: Date | undefined
): Promise<KnowledgeCacheEntry | null> {
  if (source.localPath) {
    const cached = await readFreshLocalSourceEntry(inspection, source, store, now);
    if (cached !== null) {
      return cached;
    }

    let content: string | null = null;
    if (source.kind === 'provider-schema' && source.module) {
      const root = inspection.terraformRoots.find(candidate => candidate.rootPath === source.module);
      if (root) {
        content = await buildTerraformProviderSchemaKnowledgeContent({
          workspaceRoot: inspection.workspaceRoot,
          root,
          schemaFile: source.localPath
        });
      }
    }

    if (source.kind === 'terraform-module' && source.module) {
      const root = inspection.terraformRoots.find(candidate => candidate.rootPath === source.module);
      if (root) {
        content = await buildTerraformLocalModuleKnowledgeContent({
          workspaceRoot: inspection.workspaceRoot,
          root,
          source
        });
      }

      if (content === null) {
        throw new Error('Terraform local module source could not be summarized.');
      }
    }

    if (source.kind === 'pulumi-config' && source.module) {
      const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === source.module);
      if (project) {
        content = await buildPulumiConfigKnowledgeContent({
          workspaceRoot: inspection.workspaceRoot,
          project,
          source
        });
      }

      if (content === null) {
        throw new Error('Pulumi config source could not be summarized.');
      }
    }

    if (source.kind === 'pulumi-component' && source.module) {
      const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === source.module);
      if (project) {
        content = await buildPulumiComponentKnowledgeContent({
          workspaceRoot: inspection.workspaceRoot,
          project,
          source
        });
      }

      if (content === null) {
        throw new Error('Pulumi component source could not be summarized.');
      }
    }

    if (source.kind === 'chart-metadata' && source.module) {
      const chart = inspection.helmCharts.find(candidate => candidate.chartRoot === source.module);
      if (chart) {
        content = await buildHelmChartMetadataKnowledgeContent({
          workspaceRoot: inspection.workspaceRoot,
          chart,
          source
        });
      }

      if (content === null) {
        throw new Error('Helm chart metadata source could not be summarized.');
      }
    }

    content ??= await readFile(join(inspection.workspaceRoot, source.localPath), 'utf8');
    const fingerprint = await buildLocalSourceFingerprint(inspection, source, content);
    return writeLocalSourceEntry(
      source,
      localContentType(source),
      content,
      fingerprint,
      store
    );
  }

  if (source.url) {
    return store.read(source);
  }

  return null;
}

function sourceResult(
  input: {
    id: string;
    domain: InfraDomainId;
    targetPath: string;
    source: KnowledgeSource;
  },
  status: KnowledgeExtractionSourceStatus,
  extra: Partial<Pick<KnowledgeExtractionSourceResult, 'factCount' | 'unitCount' | 'message'>> = {}
): KnowledgeExtractionSourceResult {
  return {
    ...input,
    status,
    factCount: extra.factCount ?? 0,
    unitCount: extra.unitCount ?? 0,
    ...(extra.message !== undefined ? { message: extra.message } : {})
  };
}

export async function extractWorkspaceKnowledgeFacts(
  inspection: WorkspaceInspection,
  options: KnowledgeExtractionOptions = {}
): Promise<KnowledgeExtractionReport> {
  const store = options.store ?? createFileKnowledgeStore(inspection.knowledgeCache.root);
  const candidates = await collectWorkspaceKnowledgeSources(inspection, {
    domains: options.domains,
    targetPaths: options.targetPaths
  });
  const requestedSourceIds = new Set(options.sourceIds ?? []);
  const factSets: KnowledgeFactSet[] = [];
  const unitSets: KnowledgeUnitSet[] = [];
  const sources: KnowledgeExtractionSourceResult[] = [];

  for (const candidate of candidates) {
    const id = store.buildId(candidate.source);
    const base = {
      id,
      domain: candidate.domain,
      targetPath: candidate.targetPath,
      source: candidate.source
    };

    if (requestedSourceIds.size > 0 && !requestedSourceIds.has(id)) {
      sources.push(sourceResult(base, 'skipped', {
        message: 'Skipped because source id was not requested.'
      }));
      continue;
    }

    let entry: KnowledgeCacheEntry | null;
    try {
      entry = await readSourceEntry(inspection, candidate.source, store, options.now);
    } catch {
      sources.push(sourceResult(base, 'unreadable', {
        message: 'Source could not be read.'
      }));
      continue;
    }

    if (!entry) {
      sources.push(sourceResult(base, 'missing-cache', {
        message: 'External source is not present in the cache.'
      }));
      continue;
    }

    if (entry.source.kind === 'internal-knowledge') {
      try {
        const unitSet = extractCuratedKnowledgeUnitSetFromCacheEntry(entry, {
          now: options.now,
          extractedAt: options.extractedAt
        });
        if (unitSet.unitCount === 0) {
          sources.push(sourceResult(base, 'unsupported', {
            message: 'Curated internal knowledge source did not contain any units.'
          }));
          continue;
        }

        const factSet = buildEmptyCuratedKnowledgeFactSet(entry, {
          now: options.now,
          extractedAt: options.extractedAt
        });
        factSets.push(factSet);
        unitSets.push(unitSet);
        sources.push(sourceResult(base, 'extracted', {
          factCount: 0,
          unitCount: unitSet.unitCount
        }));
      } catch {
        sources.push(sourceResult(base, 'unreadable', {
          message: 'Curated internal knowledge source could not be parsed.'
        }));
      }
      continue;
    }

    if (entry.source.kind === 'knowledge-unit-artifact') {
      if (
        typeof entry.source.artifactContentHash === 'string'
        && entry.contentHash !== entry.source.artifactContentHash
      ) {
        sources.push(sourceResult(base, 'unreadable', {
          message: 'Prebuilt knowledge unit artifact content hash did not match the configured reference.'
        }));
        continue;
      }

      try {
        const unitSet = extractPrebuiltKnowledgeUnitSetFromCacheEntry(entry, {
          extractedAt: options.extractedAt
        });
        if (unitSet.unitCount === 0) {
          sources.push(sourceResult(base, 'unsupported', {
            message: 'Prebuilt knowledge unit artifact did not contain any units.'
          }));
          continue;
        }

        const factSet = buildEmptyCuratedKnowledgeFactSet(entry, {
          now: options.now,
          extractedAt: options.extractedAt
        });
        factSets.push(factSet);
        unitSets.push(unitSet);
        sources.push(sourceResult(base, 'extracted', {
          factCount: 0,
          unitCount: unitSet.unitCount
        }));
      } catch {
        sources.push(sourceResult(base, 'unreadable', {
          message: 'Prebuilt knowledge unit artifact could not be parsed.'
        }));
      }
      continue;
    }

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry, {
      now: options.now,
      extractedAt: options.extractedAt
    });

    if (factSet.factCount === 0) {
      sources.push(sourceResult(base, 'unsupported', {
        message: 'No extractor is available for this source type.'
      }));
      continue;
    }

    const markdownUnits = extractMarkdownKnowledgeUnitsFromCacheEntry(entry, factSet);
    const unitSet = extractKnowledgeUnitSetFromFactSet(factSet, markdownUnits);

    factSets.push(factSet);
    unitSets.push(unitSet);
    sources.push(sourceResult(base, 'extracted', {
      factCount: factSet.factCount,
      unitCount: unitSet.unitCount
    }));
  }

  const factCount = factSets.reduce((total, factSet) => total + factSet.factCount, 0);
  const unitCount = unitSets.reduce((total, unitSet) => total + unitSet.unitCount, 0);

  return {
    kind: 'infra-agent.knowledge-extraction',
    schemaVersion: 1,
    mutationAllowed: false,
    workspaceRoot: inspection.workspaceRoot,
    cacheRoot: inspection.knowledgeCache.root,
    requestedDomains: options.domains ?? inspection.domainCapabilities.map(domain => domain.id),
    targetPaths: options.targetPaths ?? [],
    sourceIds: options.sourceIds ?? [],
    sourceCount: sources.length,
    factSetCount: factSets.length,
    factCount,
    unitSetCount: unitSets.length,
    unitCount,
    skippedSourceCount: sources.filter(source => source.status !== 'extracted').length,
    sources,
    factSets,
    unitSets
  };
}
