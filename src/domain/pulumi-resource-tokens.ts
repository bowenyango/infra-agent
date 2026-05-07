import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import type { PulumiProjectSummary, PulumiResourceTokenSummary } from '../types/repository.ts';

const SECRET_TOKEN_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const PULUMI_RESOURCE_TOKEN_PATTERN = /^([A-Za-z][A-Za-z0-9_-]*):([A-Za-z0-9_.\/-]+):([A-Za-z][A-Za-z0-9_.-]*)$/;
const PULUMI_PACKAGE_SPECIFIER_PATTERN = /^@pulumi\/([a-z0-9][a-z0-9-]*)(?:\/([A-Za-z0-9_.\/-]+))?$/;
const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const MEMBER_CONSTRUCTOR_PATTERN = /new\s+([A-Za-z_$][A-Za-z0-9_$]*(?:\s*\.\s*[A-Za-z_$][A-Za-z0-9_$]*)+)\s*\(/g;
const CLASS_CONSTRUCTOR_PATTERN = /new\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;

interface PulumiPackageReference {
  packageName: string;
  moduleSegments: string[];
}

interface NamespaceBinding extends PulumiPackageReference {}

interface ClassBinding extends PulumiPackageReference {
  typeName: string;
}

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

function parsePulumiPackageSpecifier(specifier: string): PulumiPackageReference | null {
  const match = specifier.match(PULUMI_PACKAGE_SPECIFIER_PATTERN);
  if (!match) {
    return null;
  }

  const packageName = match[1] ?? '';
  const subpath = match[2] ?? '';
  const moduleSegments = subpath
    .split('/')
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0);
  if (
    SECRET_TOKEN_PATTERN.test(packageName)
    || moduleSegments.some(segment => !/^[A-Za-z0-9_.-]+$/.test(segment) || SECRET_TOKEN_PATTERN.test(segment))
  ) {
    return null;
  }

  return {
    packageName,
    moduleSegments
  };
}

function parseNamedImportSpecifiers(specifiers: string): Array<{ imported: string; local: string }> {
  return specifiers
    .split(',')
    .map(specifier => specifier.trim())
    .filter(Boolean)
    .map(specifier => {
      const parts = specifier.split(/\s+as\s+/i).map(part => part.trim());
      const imported = parts[0] ?? '';
      const local = parts[1] ?? imported;
      return { imported, local };
    })
    .filter(specifier => IDENTIFIER_PATTERN.test(specifier.imported) && IDENTIFIER_PATTERN.test(specifier.local));
}

function collectPulumiBindings(content: string): {
  namespaces: Map<string, NamespaceBinding>;
  classes: Map<string, ClassBinding>;
} {
  const namespaces = new Map<string, NamespaceBinding>();
  const classes = new Map<string, ClassBinding>();

  for (const match of content.matchAll(/import\s+\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+['"]([^'"]+)['"]/g)) {
    const local = match[1] ?? '';
    const reference = parsePulumiPackageSpecifier(match[2] ?? '');
    if (!reference || SECRET_TOKEN_PATTERN.test(local)) {
      continue;
    }

    namespaces.set(local, reference);
  }

  for (const match of content.matchAll(/const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const local = match[1] ?? '';
    const reference = parsePulumiPackageSpecifier(match[2] ?? '');
    if (!reference || SECRET_TOKEN_PATTERN.test(local)) {
      continue;
    }

    namespaces.set(local, reference);
  }

  for (const match of content.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const reference = parsePulumiPackageSpecifier(match[2] ?? '');
    if (!reference) {
      continue;
    }

    for (const specifier of parseNamedImportSpecifiers(match[1] ?? '')) {
      if (SECRET_TOKEN_PATTERN.test(specifier.imported) || SECRET_TOKEN_PATTERN.test(specifier.local)) {
        continue;
      }

      if (reference.moduleSegments.length === 0 && /^[a-z][A-Za-z0-9_$]*$/.test(specifier.imported)) {
        namespaces.set(specifier.local, {
          packageName: reference.packageName,
          moduleSegments: [specifier.imported]
        });
        continue;
      }

      if (reference.moduleSegments.length > 0 && /^[A-Z]/.test(specifier.imported)) {
        classes.set(specifier.local, {
          packageName: reference.packageName,
          moduleSegments: reference.moduleSegments,
          typeName: specifier.imported
        });
      }
    }
  }

  return { namespaces, classes };
}

function maskCommentsAndStringLiterals(content: string): string {
  let output = '';
  let index = 0;
  while (index < content.length) {
    const current = content[index];
    const next = content[index + 1];

    if (current === '/' && next === '/') {
      output += '  ';
      index += 2;
      while (index < content.length && content[index] !== '\n') {
        output += ' ';
        index += 1;
      }
      continue;
    }

    if (current === '/' && next === '*') {
      output += '  ';
      index += 2;
      while (index < content.length) {
        const blockCurrent = content[index];
        const blockNext = content[index + 1];
        if (blockCurrent === '*' && blockNext === '/') {
          output += '  ';
          index += 2;
          break;
        }
        output += blockCurrent === '\n' ? '\n' : ' ';
        index += 1;
      }
      continue;
    }

    if (current === '"' || current === '\'' || current === '`') {
      const quote = current;
      output += ' ';
      index += 1;
      while (index < content.length) {
        const value = content[index];
        if (value === '\\') {
          output += ' ';
          if (index + 1 < content.length) {
            output += content[index + 1] === '\n' ? '\n' : ' ';
          }
          index += 2;
          continue;
        }
        output += value === '\n' ? '\n' : ' ';
        index += 1;
        if (value === quote) {
          break;
        }
      }
      continue;
    }

    output += current;
    index += 1;
  }

  return output;
}

function resourceDocsTypeSegment(typeName: string): string {
  return typeName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function moduleNameForConstructor(packageName: string, moduleSegments: string[], typeName: string): string | null {
  const cleanSegments = moduleSegments
    .map(segment => segment.trim())
    .filter(segment => /^[A-Za-z0-9_.-]+$/.test(segment) && !SECRET_TOKEN_PATTERN.test(segment));
  if (cleanSegments.length === 0) {
    return null;
  }

  if (packageName === 'kubernetes' || cleanSegments.length > 1) {
    return cleanSegments.join('/');
  }

  const typeSegment = resourceDocsTypeSegment(typeName);
  return typeSegment ? [...cleanSegments, typeSegment].join('/') : null;
}

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function readFirstStringArgument(content: string, openParenIndex: number): string | null {
  let index = openParenIndex + 1;
  while (index < content.length && /\s/.test(content[index] ?? '')) {
    index += 1;
  }

  const quote = content[index];
  if (quote !== '"' && quote !== '\'') {
    return null;
  }

  let value = '';
  index += 1;
  while (index < content.length) {
    const char = content[index];
    if (char === '\\') {
      index += 2;
      continue;
    }

    if (char === quote) {
      return value;
    }

    if (char === '\n') {
      return null;
    }

    value += char;
    index += 1;
  }

  return null;
}

function buildLanguageResourceToken(input: {
  name: string;
  packageName: string;
  moduleSegments: string[];
  typeName: string;
  sourcePath: string;
  line: number;
}): PulumiResourceTokenSummary | null {
  const moduleName = moduleNameForConstructor(input.packageName, input.moduleSegments, input.typeName);
  if (!moduleName) {
    return null;
  }

  const resourceToken = parseResourceToken(
    input.name,
    `${input.packageName}:${moduleName}:${input.typeName}`
  );
  return resourceToken
    ? {
      ...resourceToken,
      evidence: {
        kind: 'pulumi-nodejs',
        sourcePath: input.sourcePath,
        sourceLocator: `${input.sourcePath}:${input.line}`
      }
    }
    : null;
}

export function extractPulumiLanguageResourceTokens(
  content: string,
  options: {
    sourcePath: string;
  }
): PulumiResourceTokenSummary[] {
  const bindings = collectPulumiBindings(content);
  const maskedContent = maskCommentsAndStringLiterals(content);
  const resourceTokens: PulumiResourceTokenSummary[] = [];
  const seen = new Set<string>();

  function addToken(token: PulumiResourceTokenSummary | null): void {
    if (!token || seen.has(`${token.name}\0${token.type}\0${token.evidence?.sourceLocator ?? ''}`)) {
      return;
    }

    seen.add(`${token.name}\0${token.type}\0${token.evidence?.sourceLocator ?? ''}`);
    resourceTokens.push(token);
  }

  for (const match of maskedContent.matchAll(MEMBER_CONSTRUCTOR_PATTERN)) {
    const expression = match[1] ?? '';
    const parts = expression.split('.').map(part => part.trim()).filter(Boolean);
    const base = parts[0] ?? '';
    const binding = bindings.namespaces.get(base);
    if (!binding || parts.length < 3) {
      continue;
    }

    const typeName = parts.at(-1) ?? '';
    const constructorModuleSegments = [...binding.moduleSegments, ...parts.slice(1, -1)];
    const openParenIndex = match.index + match[0].lastIndexOf('(');
    addToken(buildLanguageResourceToken({
      name: readFirstStringArgument(content, openParenIndex) ?? typeName,
      packageName: binding.packageName,
      moduleSegments: constructorModuleSegments,
      typeName,
      sourcePath: options.sourcePath,
      line: lineNumberAt(content, match.index)
    }));
  }

  for (const match of maskedContent.matchAll(CLASS_CONSTRUCTOR_PATTERN)) {
    const local = match[1] ?? '';
    const binding = bindings.classes.get(local);
    if (!binding) {
      continue;
    }

    const openParenIndex = match.index + match[0].lastIndexOf('(');
    addToken(buildLanguageResourceToken({
      name: readFirstStringArgument(content, openParenIndex) ?? binding.typeName,
      packageName: binding.packageName,
      moduleSegments: binding.moduleSegments,
      typeName: binding.typeName,
      sourcePath: options.sourcePath,
      line: lineNumberAt(content, match.index)
    }));
  }

  return resourceTokens.sort((left, right) =>
    left.type.localeCompare(right.type)
    || left.name.localeCompare(right.name)
    || (left.evidence?.sourceLocator ?? '').localeCompare(right.evidence?.sourceLocator ?? '')
  );
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
