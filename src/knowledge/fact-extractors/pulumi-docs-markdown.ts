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

export function extractPulumiDocsMarkdownFacts(entry: KnowledgeCacheEntry): KnowledgeFact[] {
  const topic = SUPPORTED_PULUMI_DOC_SOURCES.get(entry.source.name);
  if (!topic || looksLikeHtmlDocument(entry.content)) {
    return [];
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
