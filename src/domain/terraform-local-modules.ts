import { readdir, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import type { KnowledgeSource } from '../types/knowledge.ts';
import type { TerraformRootSummary } from '../types/repository.ts';
import {
  extractTerraformBlocksFromContent,
  readAttributeExpression,
  unquoteHclString
} from './terraform-hcl.ts';

interface TerraformModuleCall {
  name: string;
  sourcePath: string;
  modulePath: string;
}

export interface TerraformModuleInputSummary {
  name: string;
  sourcePath: string;
  required: boolean;
  type?: string;
  defaultValue?: string;
  description?: string;
  values?: string[];
}

export interface TerraformModuleOutputSummary {
  name: string;
  sourcePath: string;
  description?: string;
}

export interface TerraformLocalModuleSummary {
  kind: 'infra-agent.terraform-local-module-summary';
  schemaVersion: 1;
  mutationAllowed: false;
  rootPath: string;
  callName: string;
  modulePath: string;
  callSourcePaths: string[];
  moduleSourcePaths: string[];
  inputs: TerraformModuleInputSummary[];
  outputs: TerraformModuleOutputSummary[];
}

const MAX_MODULE_INPUTS = 80;
const MAX_MODULE_OUTPUTS = 60;
const SECRET_PATH_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;

function toWorkspacePath(path: string): string {
  return path.split('\\').join('/');
}

function isInsideWorkspace(workspaceRoot: string, targetPath: string): boolean {
  const relativePath = relative(workspaceRoot, targetPath);
  return relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath);
}

function resolveWorkspaceRelativePath(
  workspaceRoot: string,
  basePath: string,
  requestedPath: string
): string | null {
  const absolutePath = resolve(workspaceRoot, basePath, requestedPath);
  if (!isInsideWorkspace(workspaceRoot, absolutePath)) {
    return null;
  }

  return toWorkspacePath(relative(workspaceRoot, absolutePath));
}

function parseLiteralLocalModuleSource(expression: string | null): string | null {
  if (!expression || expression.includes('${')) {
    return null;
  }

  const value = unquoteHclString(expression);
  if (!value.startsWith('./') && !value.startsWith('../')) {
    return null;
  }

  if (value.includes('::') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) || isAbsolute(value)) {
    return null;
  }

  return value;
}

async function readRootTerraformFile(
  workspaceRoot: string,
  tfFile: string
): Promise<string | null> {
  try {
    return await readFile(join(workspaceRoot, tfFile), 'utf8');
  } catch {
    return null;
  }
}

async function collectTerraformLocalModuleCalls(
  workspaceRoot: string,
  root: TerraformRootSummary
): Promise<TerraformModuleCall[]> {
  const calls: TerraformModuleCall[] = [];

  for (const tfFile of root.tfFiles) {
    const content = await readRootTerraformFile(workspaceRoot, tfFile);
    if (!content) {
      continue;
    }

    for (const block of extractTerraformBlocksFromContent(content, tfFile, 'module')) {
      const name = block.labels[0];
      if (!name || SECRET_PATH_PATTERN.test(name)) {
        continue;
      }

      const literalSource = parseLiteralLocalModuleSource(readAttributeExpression(block.body, 'source'));
      if (!literalSource) {
        continue;
      }

      const modulePath = resolveWorkspaceRelativePath(workspaceRoot, dirname(block.sourcePath), literalSource);
      if (!modulePath || SECRET_PATH_PATTERN.test(modulePath)) {
        continue;
      }

      calls.push({
        name,
        sourcePath: block.sourcePath,
        modulePath
      });
    }
  }

  return calls.sort((left, right) =>
    left.name.localeCompare(right.name)
    || left.modulePath.localeCompare(right.modulePath)
    || left.sourcePath.localeCompare(right.sourcePath)
  );
}

export async function buildTerraformLocalModuleKnowledgeSources(
  workspaceRoot: string,
  root: TerraformRootSummary
): Promise<KnowledgeSource[]> {
  const calls = await collectTerraformLocalModuleCalls(workspaceRoot, root);
  const seen = new Set<string>();
  const sources: KnowledgeSource[] = [];

  for (const call of calls) {
    const key = `${root.rootPath}\n${call.name}\n${call.modulePath}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    sources.push({
      kind: 'terraform-module',
      name: `terraform-module:${root.rootPath}:${call.name}`,
      localPath: call.modulePath,
      module: root.rootPath,
      packageName: call.name
    });
  }

  return sources;
}
