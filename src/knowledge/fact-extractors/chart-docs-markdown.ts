import type {
  KnowledgeCacheEntry,
  KnowledgeFact,
  KnowledgeFactSourceRef
} from '../../types/knowledge.ts';

const SECRET_PATH_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const MAX_CHART_DOCS_FACTS = 48;
const GENERIC_HEADING_NAMES = new Set([
  'configuration',
  'default values',
  'examples',
  'helm values',
  'installation',
  'parameters',
  'readme',
  'usage',
  'values'
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

function chartName(entry: KnowledgeCacheEntry): string {
  const candidate = entry.source.chart ?? entry.source.packageName ?? entry.source.name.split(':')[0] ?? 'chart';
  return safePathSegment(candidate);
}

function normalizeValuePath(value: string): string | null {
  const stripped = stripMarkdown(value)
    .replace(/\s+\([^)]*\)$/g, '')
    .replace(/^\$?\.?Values\./i, '')
    .replace(/^values\./i, '')
    .trim();
  const normalized = stripped.replace(/\[(\d+)]/g, '.$1').replace(/[/"'{}]+/g, '').trim();
  const lowerName = normalized.toLowerCase();
  if (
    !normalized
    || normalized.length > 120
    || GENERIC_HEADING_NAMES.has(lowerName)
    || SECRET_PATH_PATTERN.test(normalized)
  ) {
    return null;
  }

  const path = normalized
    .split('.')
    .map(segment => safePathSegment(segment.trim()))
    .filter(segment => segment.length > 0)
    .join('.');
  return path && !SECRET_PATH_PATTERN.test(path) ? path : null;
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

function safeDefaultValue(value: string | undefined): string | undefined {
  const stripped = value ? stripMarkdown(value) : '';
  if (!stripped || /^(-|n\/a|none|null)$/i.test(stripped) || SECRET_PATH_PATTERN.test(stripped)) {
    return undefined;
  }

  return stripped.slice(0, 120);
}

function requiredFromText(value: string): boolean | undefined {
  const trimmed = stripMarkdown(value).trim().toLowerCase();
  if (/^(yes|true|required)$/i.test(trimmed)) {
    return true;
  }

  if (/^(no|false|optional)$/i.test(trimmed)) {
    return false;
  }

  if (/\brequired\b/i.test(value)) {
    return true;
  }

  if (/\boptional\b/i.test(value)) {
    return false;
  }

  return undefined;
}

function pushChartDocsFact(params: {
  entry: KnowledgeCacheEntry;
  chart: string;
  rawName: string;
  rawDescription: string;
  rawType?: string;
  rawDefault?: string;
  rawRequired?: string;
  facts: KnowledgeFact[];
  emittedPaths: Set<string>;
}): void {
  if (params.facts.length >= MAX_CHART_DOCS_FACTS) {
    return;
  }

  const valuePath = normalizeValuePath(params.rawName);
  const description = params.rawDescription.trim();
  if (!valuePath || !description || SECRET_PATH_PATTERN.test(description)) {
    return;
  }

  const summary = firstSentence(description);
  const path = `chart.${params.chart}.${valuePath}`;
  if (
    !summary
    || SECRET_PATH_PATTERN.test(path)
    || SECRET_PATH_PATTERN.test(summary)
    || params.emittedPaths.has(path)
  ) {
    return;
  }

  const type = params.rawType ? stripMarkdown(params.rawType) : undefined;
  const defaultValue = safeDefaultValue(params.rawDefault);
  const required = params.rawRequired !== undefined
    ? requiredFromText(params.rawRequired) ?? requiredFromText(description)
    : requiredFromText(description);

  params.emittedPaths.add(path);
  params.facts.push({
    kind: 'chart-value',
    path,
    summary,
    values: [valuePath],
    ...(required !== undefined ? { required } : {}),
    ...(type && !SECRET_PATH_PATTERN.test(type) ? { type } : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    confidence: 'medium',
    extractionMethod: 'helm-chart-docs-markdown',
    source: factSource(params.entry, `Chart docs: ${valuePath}`)
  });
}

function collectChartDocsTableFacts(
  entry: KnowledgeCacheEntry,
  chart: string,
  facts: KnowledgeFact[],
  emittedPaths: Set<string>
): void {
  const lines = entry.content.split(/\r?\n/);

  for (let index = 0; index < lines.length && facts.length < MAX_CHART_DOCS_FACTS; index += 1) {
    const header = splitMarkdownTableRow(lines[index] ?? '');
    const separator = splitMarkdownTableRow(lines[index + 1] ?? '');
    if (header.length === 0 || !isTableSeparator(separator)) {
      continue;
    }

    const normalizedHeader = header.map(cell => cell.toLowerCase());
    const nameIndex = normalizedHeader.findIndex(cell =>
      ['key', 'name', 'parameter', 'path', 'value'].includes(cell)
    );
    const descriptionIndex = normalizedHeader.findIndex(cell => cell.includes('description'));
    const typeIndex = normalizedHeader.findIndex(cell => cell === 'type');
    const defaultIndex = normalizedHeader.findIndex(cell => cell === 'default');
    const requiredIndex = normalizedHeader.findIndex(cell => cell === 'required');
    if (nameIndex === -1 || descriptionIndex === -1) {
      continue;
    }

    for (let rowIndex = index + 2; rowIndex < lines.length && facts.length < MAX_CHART_DOCS_FACTS; rowIndex += 1) {
      const row = splitMarkdownTableRow(lines[rowIndex] ?? '');
      if (row.length === 0) {
        break;
      }

      pushChartDocsFact({
        entry,
        chart,
        rawName: row[nameIndex] ?? '',
        rawDescription: row[descriptionIndex] ?? '',
        rawType: typeIndex >= 0 ? row[typeIndex] : undefined,
        rawDefault: defaultIndex >= 0 ? row[defaultIndex] : undefined,
        rawRequired: requiredIndex >= 0 ? row[requiredIndex] : undefined,
        facts,
        emittedPaths
      });
    }
  }
}

function collectChartDocsBulletFacts(
  entry: KnowledgeCacheEntry,
  chart: string,
  facts: KnowledgeFact[],
  emittedPaths: Set<string>
): void {
  const bulletPattern = /(?:^|\n)\s*[-*]\s+(?:`([^`]{1,120})`|\*\*([^*]{1,120})\*\*|([A-Za-z0-9_.[\]-]{1,120}))\s*[-–:]\s*([^\n]+)/g;
  for (const match of entry.content.matchAll(bulletPattern)) {
    if (facts.length >= MAX_CHART_DOCS_FACTS) {
      break;
    }

    pushChartDocsFact({
      entry,
      chart,
      rawName: match[1] ?? match[2] ?? match[3] ?? '',
      rawDescription: match[4] ?? '',
      facts,
      emittedPaths
    });
  }
}

function collectChartDocsHeadingFacts(
  entry: KnowledgeCacheEntry,
  chart: string,
  facts: KnowledgeFact[],
  emittedPaths: Set<string>
): void {
  const headingPattern = /(?:^|\n)#{2,5}\s+`?([^`\n#]{1,120})`?\s*\n+([^\n#][^\n]+)/g;
  for (const match of entry.content.matchAll(headingPattern)) {
    if (facts.length >= MAX_CHART_DOCS_FACTS) {
      break;
    }

    pushChartDocsFact({
      entry,
      chart,
      rawName: match[1] ?? '',
      rawDescription: match[2] ?? '',
      facts,
      emittedPaths
    });
  }
}

export function extractChartDocsMarkdownFacts(entry: KnowledgeCacheEntry): KnowledgeFact[] {
  if (entry.source.kind !== 'chart-docs' || looksLikeHtmlDocument(entry.content)) {
    return [];
  }

  const facts: KnowledgeFact[] = [];
  const emittedPaths = new Set<string>();
  const chart = chartName(entry);
  collectChartDocsTableFacts(entry, chart, facts, emittedPaths);
  collectChartDocsBulletFacts(entry, chart, facts, emittedPaths);
  collectChartDocsHeadingFacts(entry, chart, facts, emittedPaths);

  return facts;
}
