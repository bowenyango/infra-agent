import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildKnowledgeCacheId, readKnowledgeCacheEntry } from './cache.ts';
import { collectWorkspaceKnowledgeSources } from './prefetch.ts';
import { extractKnowledgeFactSetFromCacheEntry } from './facts.ts';
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

async function readSourceEntry(
  inspection: WorkspaceInspection,
  source: KnowledgeSource
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
    return {
      id: buildKnowledgeCacheId(source),
      source,
      contentType: localContentType(source),
      content,
      contentHash: sha256Hex(content),
      fetchedAt: new Date(0).toISOString()
    };
  }

  if (source.url) {
    return readKnowledgeCacheEntry(inspection.knowledgeCache.root, source);
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
  const candidates = await collectWorkspaceKnowledgeSources(inspection, {
    domains: options.domains,
    targetPaths: options.targetPaths
  });
  const requestedSourceIds = new Set(options.sourceIds ?? []);
  const factSets: KnowledgeFactSet[] = [];
  const sources: KnowledgeExtractionSourceResult[] = [];

  for (const candidate of candidates) {
    const id = buildKnowledgeCacheId(candidate.source);
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
      entry = await readSourceEntry(inspection, candidate.source);
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
