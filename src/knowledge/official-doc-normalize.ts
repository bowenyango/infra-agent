import type { KnowledgeContentType } from '../types/knowledge.ts';

export interface NormalizedOfficialKnowledgeContent {
  contentType: KnowledgeContentType;
  content: string;
  normalized: boolean;
  normalization?: 'html-to-markdown';
}

const UNSAFE_HTML_BLOCK_PATTERN = /<(script|style|svg|noscript|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi;
const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;
const HTML_DOCUMENT_PATTERN = /^\s*(?:<!doctype\s+html\b|<html\b)/i;
const HTML_TAG_PATTERN = /<\/?[A-Za-z][^>]*>/;

export function contentLooksLikeHtml(content: string, contentTypeHeader?: string | null): boolean {
  const contentType = contentTypeHeader?.toLowerCase() ?? '';
  if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
    return true;
  }

  return HTML_DOCUMENT_PATTERN.test(content) || HTML_TAG_PATTERN.test(content);
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : '';
    })
    .replace(/&#(\d+);/g, (_match, decimal: string) => {
      const codePoint = Number.parseInt(decimal, 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : '';
    });
}

function stripHtmlTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function collapseMarkdownWhitespace(value: string): string {
  return value
    .split(/\r?\n/)
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function markdownTableFromHtml(tableHtml: string): string {
  const rows = Array.from(tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi))
    .map(rowMatch => Array.from((rowMatch[1] ?? '').matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi))
      .map(cellMatch => stripHtmlTags(cellMatch[1] ?? '').replace(/\|/g, '\\|').trim()))
    .filter(row => row.length > 0);

  if (rows.length === 0) {
    return '\n';
  }

  const columnCount = Math.max(...rows.map(row => row.length));
  const normalizedRows = rows.map(row => [
    ...row,
    ...Array.from({ length: columnCount - row.length }, () => '')
  ]);
  const header = normalizedRows[0] ?? [];
  const body = normalizedRows.slice(1);
  const separator = Array.from({ length: columnCount }, () => '---');
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body.map(row => `| ${row.join(' | ')} |`)
  ];

  return `\n${lines.join('\n')}\n\n`;
}

export function htmlToMarkdown(content: string): string {
  let markdown = content
    .replace(HTML_COMMENT_PATTERN, ' ')
    .replace(UNSAFE_HTML_BLOCK_PATTERN, ' ')
    .replace(/<!doctype\s+html[^>]*>/gi, ' ')
    .replace(/<\/?(html|head|body|main|article|section|div|header|footer|nav|aside)[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n');

  markdown = markdown.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, table => markdownTableFromHtml(table));

  markdown = markdown.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_match, code: string) => {
    const text = stripHtmlTags(code);
    return text ? `\`${text.replace(/`/g, '')}\`` : '';
  });

  markdown = markdown.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, (_match, label: string) => stripHtmlTags(label));

  markdown = markdown.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level: string, heading: string) => {
    const text = stripHtmlTags(heading);
    return text ? `\n${'#'.repeat(Number.parseInt(level, 10))} ${text}\n\n` : '\n';
  });

  markdown = markdown.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_match, item: string) => {
    const text = stripHtmlTags(item);
    return text ? `\n- ${text}` : '\n';
  });

  markdown = markdown.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_match, paragraph: string) => {
    const text = stripHtmlTags(paragraph);
    return text ? `\n${text}\n\n` : '\n';
  });

  markdown = stripHtmlTags(markdown);

  return collapseMarkdownWhitespace(markdown);
}

export function normalizeOfficialKnowledgeContent(params: {
  content: string;
  contentType: KnowledgeContentType;
  contentTypeHeader?: string | null;
}): NormalizedOfficialKnowledgeContent {
  if (!contentLooksLikeHtml(params.content, params.contentTypeHeader)) {
    return {
      contentType: params.contentType,
      content: params.content,
      normalized: false
    };
  }

  return {
    contentType: 'text/markdown',
    content: htmlToMarkdown(params.content),
    normalized: true,
    normalization: 'html-to-markdown'
  };
}
