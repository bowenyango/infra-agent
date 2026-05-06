import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { parseDocument } from 'yaml';
import type { KnowledgeSource } from '../types/knowledge.ts';
import type { PulumiProjectSummary } from '../types/repository.ts';

export interface PulumiConfigDeclarationSummary {
  key: string;
  sourcePath: string;
  type?: string;
  defaultValue?: string;
}

export interface PulumiStackConfigValueSummary {
  key: string;
  sourcePath: string;
  stackName: string;
  configured: true;
  secure: boolean;
  value?: string;
}

export interface PulumiConfigKnowledgeSummary {
  kind: 'infra-agent.pulumi-config-summary';
  schemaVersion: 1;
  mutationAllowed: false;
  projectRoot: string;
  projectFile: string;
  projectName: string;
  stackFiles: string[];
  declarations: PulumiConfigDeclarationSummary[];
  stackValues: PulumiStackConfigValueSummary[];
}

const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const MAX_VALUE_LENGTH = 180;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseYamlRecord(content: string): Record<string, unknown> | null {
  const document = parseDocument(content);
  if (document.errors.length > 0) {
    return null;
  }

  const parsed = document.toJSON() as unknown;
  return isRecord(parsed) ? parsed : null;
}

async function readPulumiProjectName(
  workspaceRoot: string,
  project: PulumiProjectSummary
): Promise<string> {
  try {
    const content = await readFile(join(workspaceRoot, project.projectFile), 'utf8');
    const parsed = parseYamlRecord(content);
    if (typeof parsed?.name === 'string' && parsed.name.length > 0) {
      return parsed.name;
    }
  } catch {
    // Project discovery already saw the file; fall back if it races or becomes unreadable.
  }

  return basename(project.projectRoot);
}

function stringifyConfigValue(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const stringified = typeof value === 'string'
    ? value
    : typeof value === 'number' || typeof value === 'boolean' || value === null
      ? String(value)
      : JSON.stringify(value);

  if (!stringified || stringified.length > MAX_VALUE_LENGTH || SECRET_VALUE_PATTERN.test(stringified)) {
    return undefined;
  }

  return stringified;
}

function stackNameFromFilePath(stackFile: string): string {
  const fileName = stackFile.split('/').at(-1) ?? stackFile;
  return fileName.replace(/^Pulumi\./, '').replace(/\.(yaml|yml)$/i, '');
}

function collectProjectConfigDeclarations(
  projectFile: string,
  parsedProject: Record<string, unknown> | null
): PulumiConfigDeclarationSummary[] {
  const config = parsedProject?.config;
  if (!isRecord(config)) {
    return [];
  }

  const declarations: PulumiConfigDeclarationSummary[] = [];
  for (const [key, declaration] of Object.entries(config)) {
    if (SECRET_VALUE_PATTERN.test(key)) {
      continue;
    }

    if (!isRecord(declaration)) {
      declarations.push({
        key,
        sourcePath: projectFile
      });
      continue;
    }

    const typeValue = typeof declaration.type === 'string' && !SECRET_VALUE_PATTERN.test(declaration.type)
      ? declaration.type
      : undefined;
    const defaultValue = stringifyConfigValue(declaration.default);
    declarations.push({
      key,
      sourcePath: projectFile,
      ...(typeValue !== undefined ? { type: typeValue } : {}),
      ...(defaultValue !== undefined ? { defaultValue } : {})
    });
  }

  return declarations.sort((left, right) => left.key.localeCompare(right.key));
}

function collectStackConfigValues(
  stackFile: string,
  parsedStack: Record<string, unknown> | null
): PulumiStackConfigValueSummary[] {
  const config = parsedStack?.config;
  if (!isRecord(config)) {
    return [];
  }

  const stackName = stackNameFromFilePath(stackFile);
  const stackValues: PulumiStackConfigValueSummary[] = [];
  for (const [key, value] of Object.entries(config)) {
    if (SECRET_VALUE_PATTERN.test(key)) {
      continue;
    }

    const secure = isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'secure');
    if (secure) {
      continue;
    }

    const safeValue = secure ? undefined : stringifyConfigValue(value);
    stackValues.push({
      key,
      sourcePath: stackFile,
      stackName,
      configured: true,
      secure,
      ...(safeValue !== undefined ? { value: safeValue } : {})
    });
  }

  return stackValues.sort((left, right) =>
    left.stackName.localeCompare(right.stackName)
    || left.key.localeCompare(right.key)
    || left.sourcePath.localeCompare(right.sourcePath)
  );
}

async function readYamlRecordFromWorkspacePath(
  workspaceRoot: string,
  path: string
): Promise<Record<string, unknown> | null> {
  try {
    return parseYamlRecord(await readFile(join(workspaceRoot, path), 'utf8'));
  } catch {
    return null;
  }
}

export async function buildPulumiConfigKnowledgeSources(
  workspaceRoot: string,
  project: PulumiProjectSummary
): Promise<KnowledgeSource[]> {
  return [{
    kind: 'pulumi-config',
    name: `pulumi-config:${project.projectRoot}`,
    localPath: project.projectRoot,
    module: project.projectRoot,
    packageName: await readPulumiProjectName(workspaceRoot, project)
  }];
}

export async function buildPulumiConfigKnowledgeContent(input: {
  workspaceRoot: string;
  project: PulumiProjectSummary;
  source: KnowledgeSource;
}): Promise<string | null> {
  if (input.source.kind !== 'pulumi-config' || input.source.localPath !== input.project.projectRoot) {
    return null;
  }

  const parsedProject = await readYamlRecordFromWorkspacePath(input.workspaceRoot, input.project.projectFile);
  const stackValues: PulumiStackConfigValueSummary[] = [];
  for (const stackFile of input.project.stackFiles) {
    const parsedStack = await readYamlRecordFromWorkspacePath(input.workspaceRoot, stackFile);
    stackValues.push(...collectStackConfigValues(stackFile, parsedStack));
  }

  const summary: PulumiConfigKnowledgeSummary = {
    kind: 'infra-agent.pulumi-config-summary',
    schemaVersion: 1,
    mutationAllowed: false,
    projectRoot: input.project.projectRoot,
    projectFile: input.project.projectFile,
    projectName: input.source.packageName ?? await readPulumiProjectName(input.workspaceRoot, input.project),
    stackFiles: [...input.project.stackFiles].sort(),
    declarations: collectProjectConfigDeclarations(input.project.projectFile, parsedProject),
    stackValues
  };

  return JSON.stringify(summary, null, 2);
}
