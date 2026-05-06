import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { parseDocument } from 'yaml';
import type { KnowledgeSource } from '../types/knowledge.ts';
import type { PulumiProjectSummary } from '../types/repository.ts';

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
