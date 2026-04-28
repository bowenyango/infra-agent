import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import type { ConfigSemanticFact, ConfigSemanticSource, ConfigSemanticsSummary } from '../types/config-semantics.ts';
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

function configFactPath(key: string): string {
  return `config.${key}`;
}

function stringifyConfigValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }

  return JSON.stringify(value) ?? String(value);
}

function buildFact(params: {
  kind: ConfigSemanticFact['kind'];
  path: string;
  message: string;
  source: ConfigSemanticSource;
  values?: string[];
}): ConfigSemanticFact {
  return {
    kind: params.kind,
    path: params.path,
    message: params.message,
    source: params.source,
    confidence: 'high',
    values: params.values
  };
}

function collectProjectConfigDeclarationFacts(
  projectFile: string,
  parsedProject: Record<string, unknown>,
  facts: ConfigSemanticFact[]
): void {
  const config = parsedProject.config;
  if (!isRecord(config)) {
    return;
  }

  const source: ConfigSemanticSource = {
    kind: 'pulumi-config',
    path: projectFile
  };

  for (const [key, declaration] of Object.entries(config)) {
    if (!isRecord(declaration)) {
      continue;
    }

    const typeValue = declaration.type;
    if (typeof typeValue === 'string' && typeValue.length > 0) {
      facts.push(buildFact({
        kind: 'type-constraint',
        path: configFactPath(key),
        message: `Pulumi project declares ${key} as ${typeValue}.`,
        source,
        values: [typeValue]
      }));
    }

    if (Object.prototype.hasOwnProperty.call(declaration, 'default')) {
      facts.push(buildFact({
        kind: 'defaulted-field',
        path: configFactPath(key),
        message: `Pulumi project declares a default for ${key}.`,
        source,
        values: [stringifyConfigValue(declaration.default)]
      }));
    }
  }
}

function collectStackConfigFacts(
  stackFile: string,
  parsedStack: Record<string, unknown>,
  facts: ConfigSemanticFact[]
): void {
  const config = parsedStack.config;
  if (!isRecord(config)) {
    return;
  }

  const source: ConfigSemanticSource = {
    kind: 'pulumi-config',
    path: stackFile
  };

  for (const [key, value] of Object.entries(config)) {
    const valueIsSecret = isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'secure');
    facts.push(buildFact({
      kind: 'configured-field',
      path: configFactPath(key),
      message: valueIsSecret
        ? `Pulumi stack config ${key} is configured as a secret.`
        : `Pulumi stack config ${key} is configured in ${stackFile}.`,
      source,
      values: valueIsSecret ? undefined : [stringifyConfigValue(value)]
    }));
  }
}

export async function extractPulumiStackConfigSemantics(
  workspaceRoot: string,
  project: PulumiProjectSummary
): Promise<ConfigSemanticsSummary | null> {
  const facts: ConfigSemanticFact[] = [];

  try {
    const projectContent = await readFile(join(workspaceRoot, project.projectFile), 'utf8');
    const parsedProject = parseYamlRecord(projectContent);
    if (parsedProject) {
      collectProjectConfigDeclarationFacts(project.projectFile, parsedProject, facts);
    }
  } catch {
    // Pulumi project discovery already proved the file exists; ignore races.
  }

  for (const stackFile of project.stackFiles) {
    try {
      const stackContent = await readFile(join(workspaceRoot, stackFile), 'utf8');
      const parsedStack = parseYamlRecord(stackContent);
      if (parsedStack) {
        collectStackConfigFacts(stackFile, parsedStack, facts);
      }
    } catch {
      continue;
    }
  }

  if (facts.length === 0) {
    return null;
  }

  return {
    targetKind: 'pulumi-project',
    targetPath: project.projectRoot,
    facts
  };
}

export async function extractPulumiStackConfigSemanticsForProjects(
  workspaceRoot: string,
  projects: PulumiProjectSummary[]
): Promise<ConfigSemanticsSummary[]> {
  const summaries: ConfigSemanticsSummary[] = [];

  for (const project of projects) {
    const summary = await extractPulumiStackConfigSemantics(workspaceRoot, project);
    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries;
}
