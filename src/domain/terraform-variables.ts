import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ConfigSemanticFact, ConfigSemanticSource, ConfigSemanticsSummary } from '../types/config-semantics.ts';
import type { TerraformRootSummary } from '../types/repository.ts';

interface TerraformVariableBlock {
  name: string;
  body: string;
  sourcePath: string;
}

interface TerraformValidationBlock {
  condition: string | null;
  errorMessage: string | null;
}

function findMatchingBrace(content: string, openBraceIndex: number): number {
  let depth = 0;
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = openBraceIndex; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];
    const previousChar = content[index - 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      if (char === '"' && previousChar !== '\\') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '#') {
      inLineComment = true;
      continue;
    }

    if (char === '/' && nextChar === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function extractVariableBlocksFromContent(content: string, sourcePath: string): TerraformVariableBlock[] {
  const blocks: TerraformVariableBlock[] = [];
  const variablePattern = /\bvariable\s+"([^"]+)"\s*\{/g;

  for (const match of content.matchAll(variablePattern)) {
    if (match.index === undefined) {
      continue;
    }

    const name = match[1];
    const openBraceIndex = match.index + match[0].lastIndexOf('{');
    const closeBraceIndex = findMatchingBrace(content, openBraceIndex);
    if (!name || closeBraceIndex < 0) {
      continue;
    }

    blocks.push({
      name,
      body: content.slice(openBraceIndex + 1, closeBraceIndex),
      sourcePath
    });
  }

  return blocks;
}

export function collectTerraformDeclaredVariableNames(contents: string[]): string[] {
  const names: string[] = [];

  for (const content of contents) {
    names.push(...extractVariableBlocksFromContent(content, '').map(block => block.name));
  }

  return names;
}

function normalizeHclExpression(expression: string): string {
  return expression.replace(/\s+/g, ' ').trim();
}

function readAttributeExpression(body: string, attributeName: string): string | null {
  const pattern = new RegExp(`(^|\\n)\\s*${attributeName}\\s*=\\s*`, 'm');
  const match = body.match(pattern);
  if (!match || match.index === undefined) {
    return null;
  }

  const startIndex = match.index + match[0].length;
  let depth = 0;
  let inString = false;
  let endIndex = body.length;

  for (let index = startIndex; index < body.length; index += 1) {
    const char = body[index];
    const previousChar = body[index - 1];

    if (inString) {
      if (char === '"' && previousChar !== '\\') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '(' || char === '[' || char === '{') {
      depth += 1;
      continue;
    }

    if (char === ')' || char === ']' || char === '}') {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (char === '\n' && depth === 0) {
      endIndex = index;
      break;
    }
  }

  const expression = body.slice(startIndex, endIndex).trim();
  return expression.length > 0 ? normalizeHclExpression(expression) : null;
}

function unquoteHclString(value: string): string {
  if (!/^".*"$/.test(value)) {
    return value;
  }

  try {
    return JSON.parse(value) as string;
  } catch {
    return value.slice(1, -1);
  }
}

function collectValidationBlocks(body: string): TerraformValidationBlock[] {
  const blocks: TerraformValidationBlock[] = [];
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

    const validationBody = body.slice(openBraceIndex + 1, closeBraceIndex);
    blocks.push({
      condition: readAttributeExpression(validationBody, 'condition'),
      errorMessage: readAttributeExpression(validationBody, 'error_message')
    });
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

  return values;
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

function buildFact(params: {
  kind: ConfigSemanticFact['kind'];
  path: string;
  message: string;
  source: ConfigSemanticSource;
  values?: string[];
  relatedPaths?: string[];
}): ConfigSemanticFact {
  return {
    kind: params.kind,
    path: params.path,
    message: params.message,
    source: params.source,
    confidence: 'high',
    values: params.values,
    relatedPaths: params.relatedPaths
  };
}

function collectVariableFacts(block: TerraformVariableBlock, facts: ConfigSemanticFact[]): void {
  const variablePath = `var.${block.name}`;
  const source: ConfigSemanticSource = {
    kind: 'terraform-variable',
    path: block.sourcePath
  };
  const typeExpression = readAttributeExpression(block.body, 'type');
  const defaultExpression = readAttributeExpression(block.body, 'default');

  if (typeExpression) {
    facts.push(buildFact({
      kind: 'type-constraint',
      path: variablePath,
      message: `${variablePath} is declared with Terraform type ${typeExpression}.`,
      source,
      values: [typeExpression]
    }));
  }

  if (defaultExpression) {
    facts.push(buildFact({
      kind: 'defaulted-field',
      path: variablePath,
      message: `${variablePath} has a Terraform default value.`,
      source,
      values: [unquoteHclString(defaultExpression)]
    }));
  } else {
    facts.push(buildFact({
      kind: 'required-field',
      path: variablePath,
      message: `${variablePath} is required because the Terraform variable has no default.`,
      source
    }));
  }

  for (const validation of collectValidationBlocks(block.body)) {
    if (!validation.condition) {
      continue;
    }

    const enumValues = extractContainsEnumValues(validation.condition, block.name);
    if (enumValues.length > 0) {
      facts.push(buildFact({
        kind: 'enum',
        path: variablePath,
        message: `${variablePath} is constrained to values allowed by a Terraform validation block.`,
        source,
        values: enumValues
      }));
    }

    facts.push(buildFact({
      kind: 'validation-rule',
      path: variablePath,
      message: validation.errorMessage
        ? `${variablePath} has Terraform validation: ${unquoteHclString(validation.errorMessage)}`
        : `${variablePath} has a Terraform validation rule.`,
      source,
      values: [validation.condition]
    }));
  }
}

export async function extractTerraformVariableSemantics(
  workspaceRoot: string,
  root: TerraformRootSummary
): Promise<ConfigSemanticsSummary | null> {
  const facts: ConfigSemanticFact[] = [];

  for (const tfFile of root.tfFiles) {
    let content = '';
    try {
      content = await readFile(join(workspaceRoot, tfFile), 'utf8');
    } catch {
      continue;
    }

    for (const block of extractVariableBlocksFromContent(content, tfFile)) {
      collectVariableFacts(block, facts);
    }
  }

  if (facts.length === 0) {
    return null;
  }

  return {
    targetKind: 'terraform-root',
    targetPath: root.rootPath,
    facts
  };
}

export async function extractTerraformVariableSemanticsForRoots(
  workspaceRoot: string,
  roots: TerraformRootSummary[]
): Promise<ConfigSemanticsSummary[]> {
  const summaries: ConfigSemanticsSummary[] = [];

  for (const root of roots) {
    const summary = await extractTerraformVariableSemantics(workspaceRoot, root);
    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries;
}
