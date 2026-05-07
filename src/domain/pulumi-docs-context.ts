import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { buildKnowledgeCacheId } from '../knowledge/cache.ts';
import type { KnowledgeSource } from '../types/knowledge.ts';
import type { PulumiProjectSummary } from '../types/repository.ts';

const PULUMI_CONFIG_DOCS_URL = 'https://www.pulumi.com/docs/iac/concepts/config/';
const PULUMI_YAML_DOCS_URL = 'https://www.pulumi.com/docs/iac/languages-sdks/yaml/';
const PULUMI_PACKAGE_DOCS_URL_PREFIX = 'https://www.pulumi.com/registry/packages/';
const PULUMI_CORE_PACKAGE_NAME = '@pulumi/pulumi';
const SECRET_PATH_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonRecord(path: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFile(path, 'utf8');
    const parsed = JSON.parse(content) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
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

function isDependencyRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}

function pulumiPackageSlug(packageName: string): string | null {
  if (!packageName.startsWith('@pulumi/') || packageName === PULUMI_CORE_PACKAGE_NAME) {
    return null;
  }

  const slug = packageName.slice('@pulumi/'.length).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug) || SECRET_PATH_PATTERN.test(slug)) {
    return null;
  }

  return slug;
}

function safePackageVersion(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (
    trimmed.length === 0
    || trimmed.length > 80
    || SECRET_PATH_PATTERN.test(trimmed)
    || /^(file|link|workspace|git\+|https?:|ssh:)/i.test(trimmed)
  ) {
    return undefined;
  }

  return trimmed;
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

  sources.push(...await buildPulumiPackageDocsSources(workspaceRoot, project));

  return uniqueKnowledgeSources(sources);
}

async function buildPulumiPackageDocsSources(
  workspaceRoot: string,
  project: PulumiProjectSummary
): Promise<KnowledgeSource[]> {
  const dependencySections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
  const sources: KnowledgeSource[] = [];
  const seenPackageSlugs = new Set<string>();

  for (const packageFile of project.packageFiles ?? []) {
    const parsedPackage = await readJsonRecord(join(workspaceRoot, packageFile));
    if (!parsedPackage) {
      continue;
    }

    for (const sectionName of dependencySections) {
      const section = parsedPackage[sectionName];
      if (!isDependencyRecord(section)) {
        continue;
      }

      for (const [packageName, versionSpec] of Object.entries(section)) {
        const slug = pulumiPackageSlug(packageName);
        if (!slug || seenPackageSlugs.has(slug)) {
          continue;
        }

        seenPackageSlugs.add(slug);
        const source: KnowledgeSource = {
          kind: 'pulumi-docs',
          name: `pulumi-docs:package:${slug}`,
          packageName,
          url: `${PULUMI_PACKAGE_DOCS_URL_PREFIX}${slug}/api-docs/`
        };
        const version = safePackageVersion(versionSpec);
        if (version) {
          source.version = version;
        }

        sources.push(source);
      }
    }
  }

  return uniqueKnowledgeSources(sources);
}

export async function buildPulumiPackageDocsKnowledgeSources(
  workspaceRoot: string,
  project: PulumiProjectSummary
): Promise<KnowledgeSource[]> {
  return buildPulumiPackageDocsSources(workspaceRoot, project);
}
