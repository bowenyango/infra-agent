import type {
  KnowledgeCacheEntry,
  KnowledgeFact,
  KnowledgeFactSourceRef
} from '../../types/knowledge.ts';

const SECRET_PATH_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const MAX_PULUMI_DOCS_FACTS = 24;
const SUPPORTED_PULUMI_DOC_SOURCES = new Map([
  ['pulumi-docs:config', 'config'],
  ['pulumi-docs:yaml', 'yaml']
]);
const PULUMI_PACKAGE_SOURCE_PREFIX = 'pulumi-docs:package:';
const PULUMI_RESOURCE_SOURCE_PREFIX = 'pulumi-docs:resource:';
const PULUMI_RESOURCE_TOKEN_PATTERN = /^([A-Za-z][A-Za-z0-9_-]*):([A-Za-z0-9_.\/-]+):([A-Za-z][A-Za-z0-9_.-]*)$/;
const GENERIC_PACKAGE_HEADINGS = new Set([
  'api docs',
  'api reference',
  'configuration',
  'examples',
  'functions',
  'installation',
  'modules',
  'overview',
  'provider',
  'resources',
  'usage',
  'using'
]);

function factSource(entry: KnowledgeCacheEntry, locator: string): KnowledgeFactSourceRef {
  return {
    id: entry.id,
    source: entry.source,
    contentHash: entry.contentHash,
    locator
  };
}

function safePathSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
}

function safeLowerPathSegment(value: string): string {
  return safePathSegment(value).toLowerCase();
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentence(value: string): string {
  const stripped = stripMarkdown(value);
  const match = stripped.match(/^(.+?[.!?])(?:\s|$)/);
  return (match?.[1] ?? stripped).trim().slice(0, 220);
}

function looksLikeHtmlDocument(markdown: string): boolean {
  const trimmed = markdown.trimStart().toLowerCase();
  return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html');
}

function packageFactPathPrefix(entry: KnowledgeCacheEntry): { prefix: string; slug: string } | null {
  if (!entry.source.name.startsWith(PULUMI_PACKAGE_SOURCE_PREFIX)) {
    return null;
  }

  const slug = entry.source.name.slice(PULUMI_PACKAGE_SOURCE_PREFIX.length);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(slug) || SECRET_PATH_PATTERN.test(slug)) {
    return null;
  }

  return {
    prefix: `pulumi.package.${safeLowerPathSegment(slug)}`,
    slug: safeLowerPathSegment(slug)
  };
}

function resourceFactPathPrefix(entry: KnowledgeCacheEntry): string | null {
  if (!entry.source.name.startsWith(PULUMI_RESOURCE_SOURCE_PREFIX) || typeof entry.source.module !== 'string') {
    return null;
  }

  const match = entry.source.module.match(PULUMI_RESOURCE_TOKEN_PATTERN);
  if (!match) {
    return null;
  }

  const packageName = match[1] ?? '';
  const moduleName = match[2] ?? '';
  const typeName = match[3] ?? '';
  const pathSegments = [
    'pulumi',
    'resource',
    safeLowerPathSegment(packageName),
    ...moduleName.split('/').map(safeLowerPathSegment),
    safePathSegment(typeName)
  ].filter(segment => segment.length > 0);
  const path = pathSegments.join('.');

  return SECRET_PATH_PATTERN.test(path) ? null : path;
}

function splitMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return [];
  }

  return trimmed
    .slice(1, -1)
    .split('|')
    .map(cell => stripMarkdown(cell).trim());
}

function isTableSeparator(cells: string[]): boolean {
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')));
}

function collectPulumiResourceTableFacts(entry: KnowledgeCacheEntry, prefix: string, facts: KnowledgeFact[]): void {
  const lines = entry.content.split(/\r?\n/);

  for (let index = 0; index < lines.length && facts.length < MAX_PULUMI_DOCS_FACTS; index += 1) {
    const header = splitMarkdownTableRow(lines[index] ?? '');
    const separator = splitMarkdownTableRow(lines[index + 1] ?? '');
    if (header.length === 0 || !isTableSeparator(separator)) {
      continue;
    }

    const normalizedHeader = header.map(cell => cell.toLowerCase());
    const nameIndex = normalizedHeader.findIndex(cell => ['name', 'property', 'input'].includes(cell));
    const descriptionIndex = normalizedHeader.findIndex(cell => cell.includes('description'));
    const typeIndex = normalizedHeader.findIndex(cell => cell === 'type');
    if (nameIndex === -1 || descriptionIndex === -1) {
      continue;
    }

    for (let rowIndex = index + 2; rowIndex < lines.length && facts.length < MAX_PULUMI_DOCS_FACTS; rowIndex += 1) {
      const row = splitMarkdownTableRow(lines[rowIndex] ?? '');
      if (row.length === 0) {
        break;
      }

      const name = row[nameIndex]?.trim();
      const description = row[descriptionIndex]?.trim();
      const type = typeIndex >= 0 ? row[typeIndex]?.trim() : undefined;
      if (!name || !description || SECRET_PATH_PATTERN.test(name) || SECRET_PATH_PATTERN.test(description)) {
        continue;
      }

      const summary = firstSentence(description);
      const path = `${prefix}.${safeLowerPathSegment(name)}`;
      if (!summary || SECRET_PATH_PATTERN.test(path) || SECRET_PATH_PATTERN.test(summary)) {
        continue;
      }

      facts.push({
        kind: 'argument',
        path,
        summary,
        ...(type ? { type } : {}),
        confidence: 'medium',
        extractionMethod: 'pulumi-docs-markdown',
        source: factSource(entry, `Pulumi resource docs: ${name}`)
      });
    }
  }
}

function collectPulumiResourceBulletFacts(entry: KnowledgeCacheEntry, prefix: string, facts: KnowledgeFact[]): void {
  const bulletPattern = /(?:^|\n)\s*[-*]\s+`([^`]{1,90})`\s*[-–:]\s*([^\n]+)/g;
  for (const match of entry.content.matchAll(bulletPattern)) {
    if (facts.length >= MAX_PULUMI_DOCS_FACTS) {
      break;
    }

    const name = match[1]?.trim();
    const description = match[2]?.trim();
    if (!name || !description || SECRET_PATH_PATTERN.test(name) || SECRET_PATH_PATTERN.test(description)) {
      continue;
    }

    const summary = firstSentence(description);
    const path = `${prefix}.${safeLowerPathSegment(name)}`;
    if (!summary || SECRET_PATH_PATTERN.test(path) || SECRET_PATH_PATTERN.test(summary)) {
      continue;
    }

    facts.push({
      kind: 'argument',
      path,
      summary,
      confidence: 'medium',
      extractionMethod: 'pulumi-docs-markdown',
      source: factSource(entry, `Pulumi resource docs: ${name}`)
    });
  }
}

function extractPulumiResourceDocsMarkdownFacts(entry: KnowledgeCacheEntry): KnowledgeFact[] {
  const prefix = resourceFactPathPrefix(entry);
  if (!prefix) {
    return [];
  }

  const facts: KnowledgeFact[] = [];
  collectPulumiResourceTableFacts(entry, prefix, facts);
  collectPulumiResourceBulletFacts(entry, prefix, facts);

  return facts;
}

function normalizePulumiPackageItemName(value: string, packageSlug: string): string | null {
  const stripped = stripMarkdown(value)
    .replace(/\s+\([^)]*\)$/g, '')
    .replace(/^@pulumi\//i, '')
    .trim();
  const withoutPackagePrefix = stripped.replace(new RegExp(`^${packageSlug}[.:/]+`, 'i'), '').trim();
  const normalized = withoutPackagePrefix.replace(/[^\w./ -]+/g, '').trim();
  const lowerName = normalized.toLowerCase();
  if (
    !normalized
    || normalized.length > 90
    || GENERIC_PACKAGE_HEADINGS.has(lowerName)
    || SECRET_PATH_PATTERN.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

function pushPulumiPackageDocsFact(params: {
  entry: KnowledgeCacheEntry;
  prefix: string;
  packageSlug: string;
  rawName: string;
  rawDescription: string;
  facts: KnowledgeFact[];
  emittedPaths: Set<string>;
}): void {
  if (params.facts.length >= MAX_PULUMI_DOCS_FACTS) {
    return;
  }

  const name = normalizePulumiPackageItemName(params.rawName, params.packageSlug);
  const description = params.rawDescription.trim();
  if (!name || !description || SECRET_PATH_PATTERN.test(description)) {
    return;
  }

  const summary = firstSentence(description);
  const path = `${params.prefix}.${name.split(/[./]+/).map(safeLowerPathSegment).join('.')}`;
  if (
    !summary
    || SECRET_PATH_PATTERN.test(path)
    || SECRET_PATH_PATTERN.test(summary)
    || params.emittedPaths.has(path)
  ) {
    return;
  }

  params.emittedPaths.add(path);
  params.facts.push({
    kind: 'pulumi-docs-guidance',
    path,
    summary,
    values: [name],
    confidence: 'medium',
    extractionMethod: 'pulumi-docs-markdown',
    source: factSource(params.entry, `Pulumi package docs: ${name}`)
  });
}

function collectPulumiPackageTableFacts(
  entry: KnowledgeCacheEntry,
  prefix: string,
  packageSlug: string,
  facts: KnowledgeFact[],
  emittedPaths: Set<string>
): void {
  const lines = entry.content.split(/\r?\n/);

  for (let index = 0; index < lines.length && facts.length < MAX_PULUMI_DOCS_FACTS; index += 1) {
    const header = splitMarkdownTableRow(lines[index] ?? '');
    const separator = splitMarkdownTableRow(lines[index + 1] ?? '');
    if (header.length === 0 || !isTableSeparator(separator)) {
      continue;
    }

    const normalizedHeader = header.map(cell => cell.toLowerCase());
    const nameIndex = normalizedHeader.findIndex(cell => ['module', 'name', 'namespace', 'package'].includes(cell));
    const descriptionIndex = normalizedHeader.findIndex(cell => cell.includes('description'));
    if (nameIndex === -1 || descriptionIndex === -1) {
      continue;
    }

    for (let rowIndex = index + 2; rowIndex < lines.length && facts.length < MAX_PULUMI_DOCS_FACTS; rowIndex += 1) {
      const row = splitMarkdownTableRow(lines[rowIndex] ?? '');
      if (row.length === 0) {
        break;
      }

      pushPulumiPackageDocsFact({
        entry,
        prefix,
        packageSlug,
        rawName: row[nameIndex] ?? '',
        rawDescription: row[descriptionIndex] ?? '',
        facts,
        emittedPaths
      });
    }
  }
}

function collectPulumiPackageBulletFacts(
  entry: KnowledgeCacheEntry,
  prefix: string,
  packageSlug: string,
  facts: KnowledgeFact[],
  emittedPaths: Set<string>
): void {
  const bulletPatterns = [
    /(?:^|\n)\s*[-*]\s+\[([^\]]{1,90})]\([^)]+\)\s*[-–:]\s*([^\n]+)/g,
    /(?:^|\n)\s*[-*]\s+`([^`]{1,90})`\s*[-–:]\s*([^\n]+)/g
  ];

  for (const pattern of bulletPatterns) {
    for (const match of entry.content.matchAll(pattern)) {
      if (facts.length >= MAX_PULUMI_DOCS_FACTS) {
        break;
      }

      pushPulumiPackageDocsFact({
        entry,
        prefix,
        packageSlug,
        rawName: match[1] ?? '',
        rawDescription: match[2] ?? '',
        facts,
        emittedPaths
      });
    }
  }
}

function collectPulumiPackageHeadingFacts(
  entry: KnowledgeCacheEntry,
  prefix: string,
  packageSlug: string,
  facts: KnowledgeFact[],
  emittedPaths: Set<string>
): void {
  const headingPattern = /(?:^|\n)#{2,4}\s+`?([^`\n#]{1,90})`?\s*\n+([^\n#][^\n]+)/g;
  for (const match of entry.content.matchAll(headingPattern)) {
    if (facts.length >= MAX_PULUMI_DOCS_FACTS) {
      break;
    }

    pushPulumiPackageDocsFact({
      entry,
      prefix,
      packageSlug,
      rawName: match[1] ?? '',
      rawDescription: match[2] ?? '',
      facts,
      emittedPaths
    });
  }
}

function extractPulumiPackageDocsMarkdownFacts(entry: KnowledgeCacheEntry): KnowledgeFact[] {
  const prefixContext = packageFactPathPrefix(entry);
  if (!prefixContext) {
    return [];
  }

  const facts: KnowledgeFact[] = [];
  const emittedPaths = new Set<string>();
  collectPulumiPackageTableFacts(entry, prefixContext.prefix, prefixContext.slug, facts, emittedPaths);
  collectPulumiPackageBulletFacts(entry, prefixContext.prefix, prefixContext.slug, facts, emittedPaths);
  collectPulumiPackageHeadingFacts(entry, prefixContext.prefix, prefixContext.slug, facts, emittedPaths);

  return facts;
}

export function extractPulumiDocsMarkdownFacts(entry: KnowledgeCacheEntry): KnowledgeFact[] {
  const topic = SUPPORTED_PULUMI_DOC_SOURCES.get(entry.source.name);
  if (looksLikeHtmlDocument(entry.content)) {
    return [];
  }

  if (!topic) {
    return [
      ...extractPulumiPackageDocsMarkdownFacts(entry),
      ...extractPulumiResourceDocsMarkdownFacts(entry)
    ];
  }

  const facts: KnowledgeFact[] = [];
  const bulletPattern = /(?:^|\n)\s*[-*]\s+`([^`]{1,90})`\s*[-–:]\s*([^\n]+)/g;
  for (const match of entry.content.matchAll(bulletPattern)) {
    if (facts.length >= MAX_PULUMI_DOCS_FACTS) {
      break;
    }

    const name = match[1]?.trim();
    const description = match[2]?.trim();
    if (!name || !description || SECRET_PATH_PATTERN.test(name) || SECRET_PATH_PATTERN.test(description)) {
      continue;
    }

    const summary = firstSentence(description);
    const path = `pulumi.docs.${topic}.${safePathSegment(name)}`;
    if (!summary || SECRET_PATH_PATTERN.test(path) || SECRET_PATH_PATTERN.test(summary)) {
      continue;
    }

    facts.push({
      kind: 'pulumi-docs-guidance',
      path,
      summary,
      values: [name],
      confidence: 'medium',
      extractionMethod: 'pulumi-docs-markdown',
      source: factSource(entry, `Pulumi docs: ${name}`)
    });
  }

  return facts;
}
