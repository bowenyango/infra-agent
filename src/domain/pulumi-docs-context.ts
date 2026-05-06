import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { buildKnowledgeCacheId } from '../knowledge/cache.ts';
import type { KnowledgeSource } from '../types/knowledge.ts';
import type { PulumiProjectSummary } from '../types/repository.ts';

const PULUMI_CONFIG_DOCS_URL = 'https://www.pulumi.com/docs/iac/concepts/config/';
const PULUMI_YAML_DOCS_URL = 'https://www.pulumi.com/docs/iac/languages-sdks/yaml/';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readPulumiProjectRecord(
  workspaceRoot: string,
  project: PulumiProjectSummary
): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFile(join(workspaceRoot, project.projectFile), 'utf8');
    const document = parseDocument(content);
    if (document.errors.length > 0) {
      return null;
    }

    const parsed = document.toJSON() as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hasProjectConfig(parsedProject: Record<string, unknown> | null): boolean {
  return isRecord(parsedProject?.config) && Object.keys(parsedProject.config).length > 0;
}

function isYamlRuntime(runtime: unknown): boolean {
  if (typeof runtime === 'string') {
    return runtime.toLowerCase() === 'yaml';
  }

  if (!isRecord(runtime)) {
    return false;
  }

  return typeof runtime.name === 'string' && runtime.name.toLowerCase() === 'yaml';
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

export async function buildPulumiDocsKnowledgeSources(
  workspaceRoot: string,
  project: PulumiProjectSummary
): Promise<KnowledgeSource[]> {
  const parsedProject = await readPulumiProjectRecord(workspaceRoot, project);
  const sources: KnowledgeSource[] = [];

  if (hasProjectConfig(parsedProject) || project.stackFiles.length > 0 || project.stackNames.length > 0) {
    sources.push({
      kind: 'pulumi-docs',
      name: 'pulumi-docs:config',
      packageName: '@pulumi/pulumi',
      url: PULUMI_CONFIG_DOCS_URL
    });
  }

  if (isYamlRuntime(parsedProject?.runtime)) {
    sources.push({
      kind: 'pulumi-docs',
      name: 'pulumi-docs:yaml',
      packageName: '@pulumi/pulumi',
      url: PULUMI_YAML_DOCS_URL
    });
  }

  return uniqueKnowledgeSources(sources);
}
