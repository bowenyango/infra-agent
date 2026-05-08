export interface PulumiComponentInputSummary {
  name: string;
  sourcePath: string;
  sourceLocator: string;
  required: boolean;
  type?: string;
}

export interface PulumiComponentOutputSummary {
  name: string;
  sourcePath: string;
  sourceLocator: string;
  type?: string;
}

export interface PulumiComponentSummary {
  className: string;
  sourcePath: string;
  sourceLocator: string;
  typeToken?: string;
  argsType?: string;
  inputs: PulumiComponentInputSummary[];
  outputs: PulumiComponentOutputSummary[];
}

const SECRET_NAME_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const MAX_TYPE_LENGTH = 160;

function maskComments(content: string): string {
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

    output += current;
    index += 1;
  }

  return output;
}

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function findMatchingBrace(content: string, openBraceIndex: number): number {
  let depth = 0;
  let quote: '"' | '\'' | '`' | null = null;
  for (let index = openBraceIndex; index < content.length; index += 1) {
    const char = content[index];
    if (quote !== null) {
      if (char === '\\') {
        index += 1;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === '\'' || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function sanitizeType(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/,$/, '');
  if (
    trimmed.length === 0
    || trimmed.length > MAX_TYPE_LENGTH
    || SECRET_NAME_PATTERN.test(trimmed)
  ) {
    return undefined;
  }

  return trimmed;
}

function splitTopLevelCommaList(value: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let angle = 0;
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  let quote: '"' | '\'' | '`' | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote !== null) {
      if (char === '\\') {
        index += 1;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === '\'' || char === '`') {
      quote = char;
      continue;
    }

    if (char === '<') angle += 1;
    if (char === '>') angle = Math.max(0, angle - 1);
    if (char === '(') paren += 1;
    if (char === ')') paren = Math.max(0, paren - 1);
    if (char === '{') brace += 1;
    if (char === '}') brace = Math.max(0, brace - 1);
    if (char === '[') bracket += 1;
    if (char === ']') bracket = Math.max(0, bracket - 1);

    if (char === ',' && angle === 0 && paren === 0 && brace === 0 && bracket === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function collectPulumiBindings(content: string): {
  namespaces: Set<string>;
  componentClasses: Set<string>;
} {
  const namespaces = new Set<string>();
  const componentClasses = new Set<string>();

  for (const match of content.matchAll(/import\s+\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+['"]@pulumi\/pulumi['"]/g)) {
    const local = match[1] ?? '';
    if (!SECRET_NAME_PATTERN.test(local)) {
      namespaces.add(local);
    }
  }

  for (const match of content.matchAll(/const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*require\(\s*['"]@pulumi\/pulumi['"]\s*\)/g)) {
    const local = match[1] ?? '';
    if (!SECRET_NAME_PATTERN.test(local)) {
      namespaces.add(local);
    }
  }

  for (const match of content.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]@pulumi\/pulumi['"]/g)) {
    for (const specifier of splitTopLevelCommaList(match[1] ?? '')) {
      const parts = specifier.split(/\s+as\s+/i).map(part => part.trim());
      const imported = parts[0] ?? '';
      const local = parts[1] ?? imported;
      if (imported === 'ComponentResource' && IDENTIFIER_PATTERN.test(local)) {
        componentClasses.add(local);
      }
    }
  }

  for (const match of content.matchAll(/const\s*\{([^}]+)\}\s*=\s*require\(\s*['"]@pulumi\/pulumi['"]\s*\)/g)) {
    for (const specifier of splitTopLevelCommaList(match[1] ?? '')) {
      const parts = specifier.split(':').map(part => part.trim());
      const imported = parts[0] ?? '';
      const local = parts[1] ?? imported;
      if (imported === 'ComponentResource' && IDENTIFIER_PATTERN.test(local)) {
        componentClasses.add(local);
      }
    }
  }

  return { namespaces, componentClasses };
}

function isComponentResourceBase(
  expression: string,
  bindings: ReturnType<typeof collectPulumiBindings>
): boolean {
  const base = expression.replace(/\s+/g, '');
  if (bindings.componentClasses.has(base)) {
    return true;
  }

  return Array.from(bindings.namespaces).some(namespace =>
    base === `${namespace}.ComponentResource`
  );
}

function findTypeObjectBody(content: string, typeName: string): {
  body: string;
  offset: number;
} | null {
  const escapedTypeName = typeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?:export\\s+)?(?:interface\\s+${escapedTypeName}|type\\s+${escapedTypeName}\\s*=)\\s*\\{`, 'g');
  const match = pattern.exec(content);
  if (!match) {
    return null;
  }

  const openBraceIndex = (match.index ?? 0) + match[0].lastIndexOf('{');
  const closeBraceIndex = findMatchingBrace(content, openBraceIndex);
  if (closeBraceIndex === -1) {
    return null;
  }

  return {
    body: content.slice(openBraceIndex + 1, closeBraceIndex),
    offset: openBraceIndex + 1
  };
}

function parseInterfaceFields(input: {
  content: string;
  typeName: string;
  sourcePath: string;
}): PulumiComponentInputSummary[] {
  const typeBody = findTypeObjectBody(input.content, input.typeName);
  if (!typeBody) {
    return [];
  }

  const fields: PulumiComponentInputSummary[] = [];
  const seen = new Set<string>();
  for (const match of typeBody.body.matchAll(/(?:^|[;\n])\s*(?:readonly\s+)?([A-Za-z_$][A-Za-z0-9_$]*)(\??)\s*:\s*([^;\n]+)/g)) {
    const name = match[1] ?? '';
    const optionalMarker = match[2] ?? '';
    const type = sanitizeType(match[3]);
    if (!IDENTIFIER_PATTERN.test(name) || SECRET_NAME_PATTERN.test(name) || seen.has(name)) {
      continue;
    }

    seen.add(name);
    const propertyIndex = typeBody.offset + (match.index ?? 0) + match[0].lastIndexOf(name);
    fields.push({
      name,
      sourcePath: input.sourcePath,
      sourceLocator: `${input.sourcePath}:${lineNumberAt(input.content, propertyIndex)}`,
      required: optionalMarker !== '?',
      ...(type ? { type } : {})
    });
  }

  return fields.sort((left, right) => left.name.localeCompare(right.name));
}

function parseConstructorArgsType(classBody: string): string | undefined {
  const constructorMatch = classBody.match(/constructor\s*\(([\s\S]*?)\)\s*\{/);
  if (!constructorMatch) {
    return undefined;
  }

  const parameters = splitTopLevelCommaList(constructorMatch[1] ?? '');
  for (const parameter of parameters.slice(1)) {
    const match = parameter.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\??\s*:\s*([A-Za-z_$][A-Za-z0-9_$]*)/);
    const parameterName = match?.[1] ?? '';
    const typeName = match?.[2] ?? '';
    if (
      parameterName !== 'opts'
      && parameterName !== 'options'
      && parameterName !== 'parent'
      && IDENTIFIER_PATTERN.test(typeName)
      && !SECRET_NAME_PATTERN.test(typeName)
    ) {
      return typeName;
    }
  }

  return undefined;
}

function parseComponentTypeToken(classBody: string): string | undefined {
  const match = classBody.match(/super\s*\(\s*['"]([^'"]+)['"]/);
  const token = match?.[1]?.trim();
  if (!token || token.length > 180 || SECRET_NAME_PATTERN.test(token)) {
    return undefined;
  }

  return token;
}

function parseOutputProperties(input: {
  content: string;
  classBody: string;
  classBodyOffset: number;
  sourcePath: string;
}): PulumiComponentOutputSummary[] {
  const outputs: PulumiComponentOutputSummary[] = [];
  const seen = new Set<string>();

  for (const match of input.classBody.matchAll(/(?:^|\n)\s*(?:(public|private|protected)\s+)?(?:readonly\s+)?([A-Za-z_$][A-Za-z0-9_$]*)(?:[!?])?\s*:\s*([^;=\n]+)[;=]/g)) {
    const visibility = match[1] ?? 'public';
    const name = match[2] ?? '';
    const type = sanitizeType(match[3]);
    if (
      visibility !== 'public'
      || !IDENTIFIER_PATTERN.test(name)
      || SECRET_NAME_PATTERN.test(name)
      || seen.has(name)
    ) {
      continue;
    }

    seen.add(name);
    const propertyIndex = input.classBodyOffset + (match.index ?? 0) + match[0].lastIndexOf(name);
    outputs.push({
      name,
      sourcePath: input.sourcePath,
      sourceLocator: `${input.sourcePath}:${lineNumberAt(input.content, propertyIndex)}`,
      ...(type ? { type } : {})
    });
  }

  return outputs.sort((left, right) => left.name.localeCompare(right.name));
}

export function extractPulumiComponentSummaries(
  content: string,
  options: {
    sourcePath: string;
  }
): PulumiComponentSummary[] {
  const maskedContent = maskComments(content);
  const bindings = collectPulumiBindings(maskedContent);
  const components: PulumiComponentSummary[] = [];
  const seen = new Set<string>();

  for (const match of maskedContent.matchAll(/(?:export\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+extends\s+([A-Za-z_$][A-Za-z0-9_$]*(?:\s*\.\s*[A-Za-z_$][A-Za-z0-9_$]*)?)\s*\{/g)) {
    const className = match[1] ?? '';
    const baseExpression = match[2] ?? '';
    if (
      !IDENTIFIER_PATTERN.test(className)
      || SECRET_NAME_PATTERN.test(className)
      || !isComponentResourceBase(baseExpression, bindings)
    ) {
      continue;
    }

    const openBraceIndex = match.index + match[0].lastIndexOf('{');
    const closeBraceIndex = findMatchingBrace(maskedContent, openBraceIndex);
    if (closeBraceIndex === -1) {
      continue;
    }

    const classBody = content.slice(openBraceIndex + 1, closeBraceIndex);
    const argsType = parseConstructorArgsType(classBody);
    const typeToken = parseComponentTypeToken(classBody);
    const sourceLocator = `${options.sourcePath}:${lineNumberAt(content, match.index)}`;
    const key = `${className}\0${sourceLocator}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    components.push({
      className,
      sourcePath: options.sourcePath,
      sourceLocator,
      ...(typeToken ? { typeToken } : {}),
      ...(argsType ? { argsType } : {}),
      inputs: argsType
        ? parseInterfaceFields({
            content: maskedContent,
            typeName: argsType,
            sourcePath: options.sourcePath
          })
        : [],
      outputs: parseOutputProperties({
        content,
        classBody,
        classBodyOffset: openBraceIndex + 1,
        sourcePath: options.sourcePath
      })
    });
  }

  return components.sort((left, right) =>
    left.className.localeCompare(right.className)
    || left.sourceLocator.localeCompare(right.sourceLocator)
  );
}
