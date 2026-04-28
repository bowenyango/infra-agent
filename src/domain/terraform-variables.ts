import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ConfigSemanticFact, ConfigSemanticSource, ConfigSemanticsSummary } from '../types/config-semantics.ts';
import type { TerraformRootSummary } from '../types/repository.ts';
import {
  extractTerraformBlocksFromContent,
  findMatchingBrace,
  readAttributeExpression,
  unquoteHclString
} from './terraform-hcl.ts';

interface TerraformValidationBlock {
  condition: string | null;
  errorMessage: string | null;
}

export function collectTerraformDeclaredVariableNames(contents: string[]): string[] {
  const names: string[] = [];

  for (const content of contents) {
    names.push(
      ...extractTerraformBlocksFromContent(content, '', 'variable')
        .map(block => block.labels[0])
        .filter((name): name is string => Boolean(name))
    );
  }

  return names;
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

function collectVariableFacts(params: {
  name: string;
  body: string;
  sourcePath: string;
}, facts: ConfigSemanticFact[]): void {
  const variablePath = `var.${params.name}`;
  const source: ConfigSemanticSource = {
    kind: 'terraform-variable',
    path: params.sourcePath
  };
  const typeExpression = readAttributeExpression(params.body, 'type');
  const defaultExpression = readAttributeExpression(params.body, 'default');

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

  for (const validation of collectValidationBlocks(params.body)) {
    if (!validation.condition) {
      continue;
    }

    const enumValues = extractContainsEnumValues(validation.condition, params.name);
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

    for (const block of extractTerraformBlocksFromContent(content, tfFile, 'variable')) {
      const name = block.labels[0];
      if (!name) {
        continue;
      }

      collectVariableFacts({
        name,
        body: block.body,
        sourcePath: block.sourcePath
      }, facts);
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
