import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import type { PulumiProjectSummary, PulumiResourceTokenSummary } from '../types/repository.ts';

const SECRET_TOKEN_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const PULUMI_RESOURCE_TOKEN_PATTERN = /^([A-Za-z][A-Za-z0-9_-]*):([A-Za-z0-9_.\/-]+):([A-Za-z][A-Za-z0-9_.-]*)$/;

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

function parseResourceToken(name: string, type: string): PulumiResourceTokenSummary | null {
  if (
    name.length === 0
    || type.length === 0
    || type.length > 160
    || SECRET_TOKEN_PATTERN.test(name)
    || SECRET_TOKEN_PATTERN.test(type)
  ) {
    return null;
  }

  const match = type.match(PULUMI_RESOURCE_TOKEN_PATTERN);
  if (!match) {
    return null;
  }

  return {
    name,
    type,
    packageName: match[1] ?? '',
    moduleName: match[2] ?? '',
    typeName: match[3] ?? ''
  };
}

export function extractPulumiYamlResourceTokens(
  parsedProject: Record<string, unknown>
): PulumiResourceTokenSummary[] {
  if (!isRecord(parsedProject.resources)) {
    return [];
  }

  const resourceTokens: PulumiResourceTokenSummary[] = [];
  const seen = new Set<string>();

  for (const [name, declaration] of Object.entries(parsedProject.resources)) {
    if (!isRecord(declaration) || typeof declaration.type !== 'string') {
      continue;
    }

    const resourceToken = parseResourceToken(name.trim(), declaration.type.trim());
    if (!resourceToken || seen.has(`${resourceToken.name}\0${resourceToken.type}`)) {
      continue;
    }

    seen.add(`${resourceToken.name}\0${resourceToken.type}`);
    resourceTokens.push(resourceToken);
  }

  return resourceTokens.sort((left, right) =>
    left.type.localeCompare(right.type) || left.name.localeCompare(right.name)
  );
}

export async function detectPulumiProjectResourceTokens(
  workspaceRoot: string,
  project: Pick<PulumiProjectSummary, 'projectFile'>
): Promise<PulumiResourceTokenSummary[]> {
  try {
    const content = await readFile(join(workspaceRoot, project.projectFile), 'utf8');
    const parsedProject = parseYamlRecord(content);
    return parsedProject ? extractPulumiYamlResourceTokens(parsedProject) : [];
  } catch {
    return [];
  }
}
