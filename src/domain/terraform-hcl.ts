export interface TerraformHclBlock {
  labels: string[];
  body: string;
  sourcePath: string;
}

export function findMatchingBrace(content: string, openBraceIndex: number): number {
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

export function normalizeHclExpression(expression: string): string {
  return expression.replace(/\s+/g, ' ').trim();
}

export function readAttributeExpression(body: string, attributeName: string): string | null {
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

export function unquoteHclString(value: string): string {
  if (!/^".*"$/.test(value)) {
    return value;
  }

  try {
    return JSON.parse(value) as string;
  } catch {
    return value.slice(1, -1);
  }
}

export function extractTerraformBlocksFromContent(
  content: string,
  sourcePath: string,
  blockType: string
): TerraformHclBlock[] {
  const blocks: TerraformHclBlock[] = [];
  const escapedBlockType = blockType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blockPattern = new RegExp(`\\b${escapedBlockType}\\b((?:\\s+"[^"]+")*)\\s*\\{`, 'g');

  for (const match of content.matchAll(blockPattern)) {
    if (match.index === undefined) {
      continue;
    }

    const openBraceIndex = match.index + match[0].lastIndexOf('{');
    const closeBraceIndex = findMatchingBrace(content, openBraceIndex);
    if (closeBraceIndex < 0) {
      continue;
    }

    const labels = Array.from((match[1] ?? '').matchAll(/"([^"]+)"/g))
      .map(labelMatch => labelMatch[1])
      .filter((label): label is string => Boolean(label));

    blocks.push({
      labels,
      body: content.slice(openBraceIndex + 1, closeBraceIndex),
      sourcePath
    });
  }

  return blocks;
}
