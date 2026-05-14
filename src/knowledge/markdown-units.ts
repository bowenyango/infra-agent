import { resolveKnowledgeStoragePolicy } from './storage-policy.ts';
import type {
  KnowledgeCacheEntry,
  KnowledgeDiagnosticUnit,
  KnowledgeExampleUnit,
  KnowledgeFactSet,
  KnowledgeGuidanceUnit,
  KnowledgeRecipeUnit,
  KnowledgeUnit,
  KnowledgeUnitExtractionMethod,
  KnowledgeUnitPrivacyScope
} from '../types/knowledge.ts';

const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const MAX_MARKDOWN_UNITS_PER_SOURCE = 8;
const SUPPORTED_MARKDOWN_SOURCE_KINDS = new Set<KnowledgeCacheEntry['source']['kind']>([
  'terraform-registry',
  'pulumi-docs',
  'helm-docs',
  'chart-docs',
  'repo-example',
  'module-readme'
]);

interface MarkdownSection {
  title: string;
  slug: string;
  content: string;
}

function isMarkdownEntry(entry: KnowledgeCacheEntry): boolean {
  return SUPPORTED_MARKDOWN_SOURCE_KINDS.has(entry.source.kind)
    && (entry.contentType === 'text/markdown' || entry.contentType === 'text/plain')
    && !looksLikeHtmlDocument(entry.content);
}

function looksLikeHtmlDocument(markdown: string): boolean {
  const trimmed = markdown.trimStart().toLowerCase();
  return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html');
}

function compactText(value: string | undefined, maxLength = 240): string | null {
  const text = stripMarkdown(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text || SECRET_VALUE_PATTERN.test(text)) {
    return null;
  }

  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
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

function safeSlug(value: string, fallback: string): string {
  const slug = stripMarkdown(value)
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug && !SECRET_VALUE_PATTERN.test(slug) ? slug : fallback;
}

function sourceSlug(entry: KnowledgeCacheEntry): string {
  return safeSlug(entry.source.name, 'source');
}

function tokenEstimateFor(...values: string[]): number {
  const chars = values.reduce((total, value) => total + value.length, 0);
  return Math.max(1, Math.ceil(chars / 4));
}

function splitMarkdownSections(markdown: string): MarkdownSection[] {
  const headingPattern = /^#{2,5}\s+(.+?)\s*$/gm;
  const matches = Array.from(markdown.matchAll(headingPattern));
  const sections: MarkdownSection[] = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const title = compactText(match[1], 100);
    if (!title) {
      continue;
    }

    const contentStart = (match.index ?? 0) + match[0].length;
    const contentEnd = matches[index + 1]?.index ?? markdown.length;
    const content = markdown.slice(contentStart, contentEnd).trim();
    if (!content || SECRET_VALUE_PATTERN.test(content)) {
      continue;
    }

    sections.push({
      title,
      slug: safeSlug(title, `section-${index}`),
      content
    });
  }

  return sections;
}

function firstParagraph(section: MarkdownSection): string | null {
  const withoutCode = section.content.replace(/```[\s\S]*?```/g, '\n');
  for (const block of withoutCode.split(/\n{2,}/)) {
    const text = compactText(block.replace(/^\s*(?:[-*]|\d+[.)])\s+/gm, ''), 220);
    if (text) {
      return text;
    }
  }

  return null;
}

function firstSentence(value: string): string {
  const stripped = stripMarkdown(value);
  const match = stripped.match(/^(.+?[.!?])(?:\s|$)/);
  return compactText(match?.[1] ?? stripped, 220) ?? stripped.slice(0, 220);
}

function listSteps(section: MarkdownSection): string[] {
  const steps: string[] = [];
  for (const line of section.content.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:[-*]|\d+[.)])\s+(.+)$/);
    const step = compactText(match?.[1], 180);
    if (step && !steps.includes(step)) {
      steps.push(step);
    }
    if (steps.length >= 5) {
      break;
    }
  }

  return steps;
}

function firstCodeBlock(section: MarkdownSection): { language?: string; snippet: string } | null {
  const match = section.content.match(/```([A-Za-z0-9_-]+)?\s*\n([\s\S]*?)```/);
  const rawSnippet = match?.[2]?.trim();
  if (!rawSnippet || SECRET_VALUE_PATTERN.test(rawSnippet)) {
    return null;
  }

  const language = normalizeLanguage(match?.[1]);
  return {
    ...(language ? { language } : {}),
    snippet: rawSnippet.length > 360 ? `${rawSnippet.slice(0, 357)}...` : rawSnippet
  };
}

function normalizeLanguage(value: string | undefined): string | undefined {
  const language = value?.trim().toLowerCase();
  if (!language) {
    return undefined;
  }

  if (['terraform', 'tf'].includes(language)) {
    return 'hcl';
  }
  if (language === 'yml') {
    return 'yaml';
  }
  if (language === 'ts') {
    return 'typescript';
  }
  if (language === 'js') {
    return 'javascript';
  }

  return /^[a-z0-9_-]{1,24}$/.test(language) ? language : undefined;
}

function defaultExampleLanguage(entry: KnowledgeCacheEntry): string | undefined {
  if (entry.source.kind === 'terraform-registry' || entry.source.kind === 'module-readme') {
    return 'hcl';
  }
  if (entry.source.kind === 'chart-docs' || entry.source.kind === 'helm-docs') {
    return 'yaml';
  }
  if (entry.source.kind === 'pulumi-docs') {
    return 'typescript';
  }

  return undefined;
}

function guidanceExtractionMethod(scope: KnowledgeUnitPrivacyScope): KnowledgeUnitExtractionMethod {
  return scope === 'public-reference' ? 'official-guidance' : 'repo-local-guidance';
}

function exampleExtractionMethod(scope: KnowledgeUnitPrivacyScope): KnowledgeUnitExtractionMethod {
  return scope === 'public-reference' ? 'official-example' : 'repo-local-example';
}

function diagnosticEngine(entry: KnowledgeCacheEntry): KnowledgeDiagnosticUnit['engine'] {
  if (entry.source.kind === 'chart-docs' || entry.source.kind === 'helm-docs') {
    return 'helm';
  }
  if (entry.source.kind === 'pulumi-docs') {
    return 'pulumi';
  }
  if (entry.source.kind === 'terraform-registry' || entry.source.kind === 'module-readme') {
    return 'terraform';
  }

  return 'runtime';
}

function sourceRef(entry: KnowledgeCacheEntry, factSet: KnowledgeFactSet, locator: string) {
  return {
    id: factSet.sourceId,
    source: factSet.source,
    contentHash: factSet.sourceContentHash,
    locator: `markdown:${locator}`
  };
}

function exampleType(entry: KnowledgeCacheEntry): string {
  if (entry.source.kind === 'terraform-registry') {
    return 'terraform-docs-example';
  }
  if (entry.source.kind === 'chart-docs' || entry.source.kind === 'helm-docs') {
    return 'helm-docs-example';
  }
  if (entry.source.kind === 'pulumi-docs') {
    return 'pulumi-docs-example';
  }

  return 'repo-docs-example';
}

function exampleUnitFromSection(
  entry: KnowledgeCacheEntry,
  factSet: KnowledgeFactSet,
  section: MarkdownSection,
  privacyScope: KnowledgeUnitPrivacyScope
): KnowledgeExampleUnit | null {
  if (!/\b(example|examples|usage|sample)\b/i.test(section.title)) {
    return null;
  }

  const code = firstCodeBlock(section);
  if (!code) {
    return null;
  }

  return {
    unitType: 'example',
    path: `example.${sourceSlug(entry)}.${section.slug}`,
    summary: `Example from ${entry.source.name}: ${section.title}.`,
    confidence: 'medium',
    extractionMethod: exampleExtractionMethod(privacyScope),
    source: sourceRef(entry, factSet, section.title),
    privacyScope,
    tokenEstimate: tokenEstimateFor(section.title, code.snippet),
    exampleType: exampleType(entry),
    snippet: code.snippet,
    language: code.language ?? defaultExampleLanguage(entry),
    appliesWhen: ['Need a source-backed configuration shape before editing infrastructure.']
  };
}

function guidanceUnitFromSection(
  entry: KnowledgeCacheEntry,
  factSet: KnowledgeFactSet,
  section: MarkdownSection,
  privacyScope: KnowledgeUnitPrivacyScope
): KnowledgeGuidanceUnit | null {
  if (!/\b(best practices?|notes?|important|limitations?|caveats?|constraints?|values?|inputs?|arguments?|argument reference|parameters?|requirements?|restrictions?)\b/i.test(section.title)) {
    return null;
  }

  const summary = firstParagraph(section);
  if (!summary) {
    return null;
  }

  return {
    unitType: 'guidance',
    path: `guidance.markdown.${sourceSlug(entry)}.${section.slug}`,
    summary: firstSentence(summary),
    confidence: 'medium',
    extractionMethod: guidanceExtractionMethod(privacyScope),
    source: sourceRef(entry, factSet, section.title),
    privacyScope,
    tokenEstimate: tokenEstimateFor(section.title, summary),
    topic: section.slug,
    appliesWhen: [`${entry.source.name} docs mention ${section.title}.`],
    risk: /\b(cannot|must|avoid|limitation|caveat|warning|required)\b/i.test(summary)
      ? summary
      : undefined
  };
}

function recipeUnitFromSection(
  entry: KnowledgeCacheEntry,
  factSet: KnowledgeFactSet,
  section: MarkdownSection,
  privacyScope: KnowledgeUnitPrivacyScope
): KnowledgeRecipeUnit | null {
  if (!/\b(how to|configure|configuration|install|installation|upgrade|upgrade guide|migration|migration guide|migrate|workflow|import|state)\b/i.test(section.title)) {
    return null;
  }

  const steps = listSteps(section);
  if (steps.length < 2) {
    return null;
  }

  return {
    unitType: 'recipe',
    path: `recipe.markdown.${sourceSlug(entry)}.${section.slug}`,
    summary: `Workflow from ${entry.source.name}: ${section.title}.`,
    confidence: 'medium',
    extractionMethod: 'workflow-recipe',
    source: sourceRef(entry, factSet, section.title),
    privacyScope,
    tokenEstimate: tokenEstimateFor(section.title, ...steps),
    name: section.title,
    steps,
    requiresApproval: /\b(upgrade|migration|migrate|import|state|rename)\b/i.test(section.title),
    mutationAllowed: false
  };
}

function diagnosticUnitFromSection(
  entry: KnowledgeCacheEntry,
  factSet: KnowledgeFactSet,
  section: MarkdownSection,
  privacyScope: KnowledgeUnitPrivacyScope
): KnowledgeDiagnosticUnit | null {
  if (!/\b(troubleshooting|errors?|known issues?|failure(?: modes?)?|debugging|validation|common problems?)\b/i.test(section.title)) {
    return null;
  }

  const summary = firstParagraph(section);
  if (!summary || !/\b(error|failed|failure|invalid|missing|required|cannot|timeout)\b/i.test(summary)) {
    return null;
  }

  const codeSignature = section.content.match(/`([^`]*(?:error|failed|failure|invalid|missing|required|cannot|timeout)[^`]*)`/i)?.[1];
  const signature = compactText(codeSignature ?? summary, 120);
  if (!signature) {
    return null;
  }

  const reviewSteps = listSteps(section);
  const recommendedReview = reviewSteps.length > 0
    ? reviewSteps
    : [
        `Review ${section.title} guidance from ${entry.source.name}.`,
        'Rerun the selected validator after applying a bounded edit.'
      ];

  return {
    unitType: 'diagnostic',
    path: `diagnostic.markdown.${sourceSlug(entry)}.${section.slug}`,
    summary: firstSentence(summary),
    confidence: 'medium',
    extractionMethod: 'provider-diagnostic',
    source: sourceRef(entry, factSet, section.title),
    privacyScope,
    tokenEstimate: tokenEstimateFor(signature, ...recommendedReview),
    engine: diagnosticEngine(entry),
    signature,
    likelyCause: firstSentence(summary),
    recommendedReview: recommendedReview.slice(0, 5)
  };
}

function dedupeUnits(units: KnowledgeUnit[]): KnowledgeUnit[] {
  const seen = new Set<string>();
  const deduped: KnowledgeUnit[] = [];

  for (const unit of units) {
    const key = `${unit.unitType}:${unit.path}:${unit.summary}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(unit);
    }
  }

  return deduped;
}

export function extractMarkdownKnowledgeUnitsFromCacheEntry(
  entry: KnowledgeCacheEntry,
  factSet: KnowledgeFactSet
): KnowledgeUnit[] {
  if (!isMarkdownEntry(entry)) {
    return [];
  }

  const privacyScope = resolveKnowledgeStoragePolicy(factSet.source).scope;
  const units = splitMarkdownSections(entry.content).flatMap(section => [
    exampleUnitFromSection(entry, factSet, section, privacyScope),
    guidanceUnitFromSection(entry, factSet, section, privacyScope),
    recipeUnitFromSection(entry, factSet, section, privacyScope),
    diagnosticUnitFromSection(entry, factSet, section, privacyScope)
  ]).filter((unit): unit is KnowledgeUnit => unit !== null);

  return dedupeUnits(units).slice(0, MAX_MARKDOWN_UNITS_PER_SOURCE);
}
