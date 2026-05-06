import { readdir, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import type { KnowledgeSource } from '../types/knowledge.ts';
import type { TerraformRootSummary } from '../types/repository.ts';
import {
  extractTerraformBlocksFromContent,
  findMatchingBrace,
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

function collectValidationBlockBodies(body: string): string[] {
  const blocks: string[] = [];
  const validationPattern = /\bvalidation\s*\{/g;

  for (const match of body.matchAll(validationPattern)) {
    if (match.index === undefined) {
      continue;
    }

    const openBraceIndex = match.index + match[0].lastIndexOf('{');
    const closeBraceIndex = findMatchingBrace(body, openBraceIndex);
    if (closeBraceIndex < 0) {
      continue;
    }

    blocks.push(body.slice(openBraceIndex + 1, closeBraceIndex));
  }

  return blocks;
}

function parseStringListExpression(expression: string): string[] {
  const values: string[] = [];

  for (const match of expression.matchAll(/"((?:\\"|[^"])*)"/g)) {
    if (match[1]) {
      values.push(unquoteHclString(`"${match[1]}"`));
    }
  }

  return values.filter(value => !SECRET_PATH_PATTERN.test(value));
}

function extractContainsEnumValues(condition: string, variableName: string): string[] {
  const containsPattern = /contains\(\s*\[([^\]]+)\]\s*,\s*var\.([A-Za-z0-9_]+)\s*\)/g;

  for (const match of condition.matchAll(containsPattern)) {
    if (match[2] === variableName && match[1]) {
      return parseStringListExpression(match[1]);
    }
  }

  return [];
}

function descriptionFromBody(body: string): string | undefined {
  const description = readAttributeExpression(body, 'description');
  if (!description) {
    return undefined;
  }

  const unquoted = unquoteHclString(description);
  return SECRET_PATH_PATTERN.test(unquoted) ? undefined : unquoted.slice(0, 180);
}

function defaultValueFromExpression(expression: string | null): string | undefined {
  if (!expression) {
    return undefined;
  }

  const defaultValue = unquoteHclString(expression);
  if (SECRET_PATH_PATTERN.test(defaultValue) || defaultValue.length > 160) {
    return undefined;
  }

  return defaultValue;
}

function enumValuesFromVariableBody(name: string, body: string): string[] | undefined {
  const values = collectValidationBlockBodies(body).flatMap(validationBody => {
    const condition = readAttributeExpression(validationBody, 'condition');
    return condition ? extractContainsEnumValues(condition, name) : [];
  });
  const uniqueValues = Array.from(new Set(values)).sort();
  return uniqueValues.length > 0 ? uniqueValues : undefined;
}

async function readModuleTerraformFiles(
  workspaceRoot: string,
  modulePath: string
): Promise<Array<{ path: string; content: string }>> {
  const moduleRoot = join(workspaceRoot, modulePath);
  const entries = await readdir(moduleRoot, { withFileTypes: true });
  const files: Array<{ path: string; content: string }> = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.tf')) {
      continue;
    }

    const sourcePath = toWorkspacePath(join(modulePath, entry.name));
    const content = await readFile(join(moduleRoot, entry.name), 'utf8');
    files.push({ path: sourcePath, content });
  }

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function collectModuleInputs(files: Array<{ path: string; content: string }>): TerraformModuleInputSummary[] {
  const inputs: TerraformModuleInputSummary[] = [];

  for (const file of files) {
    for (const block of extractTerraformBlocksFromContent(file.content, file.path, 'variable')) {
      const name = block.labels[0];
      if (!name || SECRET_PATH_PATTERN.test(name)) {
        continue;
      }

      const defaultExpression = readAttributeExpression(block.body, 'default');
      const typeExpression = readAttributeExpression(block.body, 'type') ?? undefined;
      const defaultValue = defaultValueFromExpression(defaultExpression);

      inputs.push({
        name,
        sourcePath: block.sourcePath,
        required: defaultExpression === null,
        ...(typeExpression && !SECRET_PATH_PATTERN.test(typeExpression) ? { type: typeExpression } : {}),
        ...(defaultValue !== undefined ? { defaultValue } : {}),
        ...(descriptionFromBody(block.body) ? { description: descriptionFromBody(block.body) } : {}),
        ...(enumValuesFromVariableBody(name, block.body) ? { values: enumValuesFromVariableBody(name, block.body) } : {})
      });

      if (inputs.length >= MAX_MODULE_INPUTS) {
        return inputs;
      }
    }
  }

  return inputs;
}

function collectModuleOutputs(files: Array<{ path: string; content: string }>): TerraformModuleOutputSummary[] {
  const outputs: TerraformModuleOutputSummary[] = [];

  for (const file of files) {
    for (const block of extractTerraformBlocksFromContent(file.content, file.path, 'output')) {
      const name = block.labels[0];
      const sensitive = readAttributeExpression(block.body, 'sensitive') === 'true';
      if (!name || sensitive || SECRET_PATH_PATTERN.test(name)) {
        continue;
      }

      outputs.push({
        name,
        sourcePath: block.sourcePath,
        ...(descriptionFromBody(block.body) ? { description: descriptionFromBody(block.body) } : {})
      });

      if (outputs.length >= MAX_MODULE_OUTPUTS) {
        return outputs;
      }
    }
  }

  return outputs;
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

export async function buildTerraformLocalModuleKnowledgeContent(input: {
  workspaceRoot: string;
  root: TerraformRootSummary;
  source: KnowledgeSource;
}): Promise<string | null> {
  if (input.source.kind !== 'terraform-module' || !input.source.localPath || !input.source.packageName) {
    return null;
  }

  const calls = await collectTerraformLocalModuleCalls(input.workspaceRoot, input.root);
  const matchedCalls = calls.filter(call =>
    call.name === input.source.packageName
    && call.modulePath === input.source.localPath
  );
  if (matchedCalls.length === 0) {
    return null;
  }

  const files = await readModuleTerraformFiles(input.workspaceRoot, input.source.localPath);
  const moduleSourcePaths = files.map(file => file.path);
  const summary: TerraformLocalModuleSummary = {
    kind: 'infra-agent.terraform-local-module-summary',
    schemaVersion: 1,
    mutationAllowed: false,
    rootPath: input.root.rootPath,
    callName: input.source.packageName,
    modulePath: input.source.localPath,
    callSourcePaths: Array.from(new Set(matchedCalls.map(call => call.sourcePath))).sort(),
    moduleSourcePaths,
    inputs: collectModuleInputs(files),
    outputs: collectModuleOutputs(files)
  };

  return JSON.stringify(summary, null, 2);
}
