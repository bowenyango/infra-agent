import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { collectWorkspaceKnowledgeSources } from './prefetch.ts';
import { extractKnowledgeFactSetFromCacheEntry } from './facts.ts';
import { createFileKnowledgeStore, type KnowledgeStore } from './knowledge-store.ts';
import { fingerprintWorkspaceFiles } from './local-source-fingerprint.ts';
import { buildHelmChartMetadataKnowledgeContent } from '../domain/helm-chart-context.ts';
import { buildPulumiConfigKnowledgeContent } from '../domain/pulumi-config-knowledge.ts';
import { buildTerraformLocalModuleKnowledgeContent } from '../domain/terraform-local-modules.ts';
import { buildTerraformProviderSchemaKnowledgeContent } from '../domain/terraform-provider-schema.ts';
import type { InfraDomainId, WorkspaceInspection } from '../types/repository.ts';
import type { KnowledgeCacheEntry, KnowledgeContentType, KnowledgeFactSet, KnowledgeSource } from '../types/knowledge.ts';

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
  skippedSourceCount: number;
  sources: KnowledgeExtractionSourceResult[];
  factSets: KnowledgeFactSet[];
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
    || source.kind === 'terraform-module'
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

async function readSourceEntry(
  inspection: WorkspaceInspection,
  source: KnowledgeSource,
  store: KnowledgeStore
): Promise<KnowledgeCacheEntry | null> {
  if (source.localPath) {
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
    return {
      id: store.buildId(source),
      source,
      contentType: localContentType(source),
      content,
      contentHash: sha256Hex(content),
      fetchedAt: new Date(0).toISOString(),
      ...(fingerprint ? { fingerprint } : {})
    };
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
  extra: Partial<Pick<KnowledgeExtractionSourceResult, 'factCount' | 'message'>> = {}
): KnowledgeExtractionSourceResult {
  return {
    ...input,
    status,
    factCount: extra.factCount ?? 0,
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
      entry = await readSourceEntry(inspection, candidate.source, store);
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

    factSets.push(factSet);
    sources.push(sourceResult(base, 'extracted', {
      factCount: factSet.factCount
    }));
  }

  const factCount = factSets.reduce((total, factSet) => total + factSet.factCount, 0);

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
    skippedSourceCount: sources.filter(source => source.status !== 'extracted').length,
    sources,
    factSets
  };
}
