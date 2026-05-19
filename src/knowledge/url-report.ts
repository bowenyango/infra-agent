import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  buildKnowledgeCacheId,
  isKnowledgeCacheEntryStale
} from './cache.ts';
import { extractKnowledgeFactSetFromCacheEntry } from './facts.ts';
import { extractMarkdownKnowledgeUnitsFromCacheEntry } from './markdown-units.ts';
import { normalizeOfficialKnowledgeContent } from './official-doc-normalize.ts';
import { fetchOfficialKnowledgeSource } from './retrieve.ts';
import { extractKnowledgeUnitSetFromFactSet } from './units.ts';
import {
  KNOWLEDGE_UNIT_TYPES,
  type KnowledgeCacheEntry,
  type KnowledgeCacheWrite,
  type KnowledgeContentType,
  type KnowledgeSource,
  type KnowledgeUnit,
  type KnowledgeUnitType
} from '../types/knowledge.ts';
import type { InfraDomainId } from '../types/repository.ts';
import type { KnowledgeUnitCountByType } from './unit-index.ts';
import { isSecretSafeKnowledgeUrl } from './source-config.ts';

type OfficialKnowledgeFetchOptions = NonNullable<Parameters<typeof fetchOfficialKnowledgeSource>[1]>;
type OfficialKnowledgeFetchImpl = NonNullable<OfficialKnowledgeFetchOptions['fetchImpl']>;

export interface PublicKnowledgeUrlReportOptions {
  url: string;
  contentPath?: string;
  maxUnits?: number;
  now?: Date;
  fetchImpl?: OfficialKnowledgeFetchImpl;
}

export type PublicKnowledgeQualityStatus = 'ready' | 'needs-refinement';

export interface PublicKnowledgeQualitySummary {
  status: PublicKnowledgeQualityStatus;
  score: number;
  warnings: string[];
  llmUsed: false;
  refinementMode: 'deterministic';
}

export type CompactPublicKnowledgeUnit = KnowledgeUnit extends infer Unit
  ? Unit extends KnowledgeUnit
    ? Omit<Unit, 'source'> & {
      sourceId: string;
      sourceLocator: string;
    }
    : never
  : never;

export interface PublicKnowledgeCentralLibraryCandidate {
  kind: 'infra-agent.central-knowledge-candidate';
  schemaVersion: 1;
  mutationAllowed: false;
  storageScope: 'public-reference';
  privacyScope: 'public-reference';
  candidateId: string;
  sourceId: string;
  sourceContentHash: string;
  source: {
    domain: InfraDomainId;
    kind: KnowledgeSource['kind'];
    name: string;
    provider?: string;
    version?: string;
    url?: string;
  };
  quality: PublicKnowledgeQualitySummary;
  unitCount: number;
  unitCounts: KnowledgeUnitCountByType;
  unitRef: 'report.unitsByType';
}

export interface PublicKnowledgeUrlReport {
  kind: 'infra-agent.public-knowledge-url-report';
  schemaVersion: 1;
  mutationAllowed: false;
  sourceUrl: string;
  domain: InfraDomainId;
  source: KnowledgeSource;
  sourceId: string;
  sourceContentHash: string;
  fetchedAt: string;
  sourceStale: boolean;
  maxUnits: number;
  summary: {
    factCount: number;
    unitCount: number;
    includedUnitCount: number;
    omittedUnitCount: number;
    unitCounts: KnowledgeUnitCountByType;
    includedUnitTypes: KnowledgeUnitType[];
    missingUnitTypes: KnowledgeUnitType[];
    unitTypeComplete: boolean;
    qualityStatus: PublicKnowledgeQualityStatus;
    qualityScore: number;
    qualityWarnings: string[];
    compactByteLength: number;
  };
  quality: PublicKnowledgeQualitySummary;
  unitsByType: Record<KnowledgeUnitType, CompactPublicKnowledgeUnit[]>;
  centralLibraryCandidate: PublicKnowledgeCentralLibraryCandidate;
}

const DEFAULT_MAX_UNITS = 80;
const TERRAFORM_REGISTRY_INLINE_HEADINGS = [
  'Example Usage',
  'Basic Usage',
  'Argument Reference',
  'Arguments Reference',
  'Arguments',
  'Attribute Reference',
  'Attributes Reference',
  'Attributes',
  'Import',
  'Timeouts'
];

interface TerraformRegistryUrlSource {
  namespace: string;
  providerName: string;
  version: string;
  docKind: 'resources' | 'data-sources';
  slug: string;
}

interface PublicKnowledgeSourceResolution {
  domain: InfraDomainId;
  source: KnowledgeSource;
  terraformRegistry?: TerraformRegistryUrlSource;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeMaxUnits(value: number | undefined): number {
  return Number.isInteger(value) && value !== undefined ? Math.max(1, value) : DEFAULT_MAX_UNITS;
}

function contentTypeForPath(path: string): KnowledgeContentType {
  const lowerPath = path.toLowerCase();
  if (lowerPath.endsWith('.json')) {
    return 'application/json';
  }
  if (lowerPath.endsWith('.yaml') || lowerPath.endsWith('.yml')) {
    return 'application/yaml';
  }
  if (lowerPath.endsWith('.md') || lowerPath.endsWith('.markdown')) {
    return 'text/markdown';
  }

  return 'text/plain';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTerraformRegistryMarkdown(content: string): string {
  let normalized = content
    .replace(/\s+(#{1,6}\s+)/g, '\n\n$1')
    .replace(/\s+\*\s+(`[^`]+`\s+[-–:])/g, '\n* $1')
    .replace(/```([A-Za-z0-9_-]+)?\s+/g, (_match, language: string | undefined) =>
      `\`\`\`${language ?? ''}\n`
    )
    .replace(/\s+```/g, '\n```');

  for (const heading of TERRAFORM_REGISTRY_INLINE_HEADINGS) {
    const escapedHeading = escapeRegExp(heading);
    normalized = normalized.replace(
      new RegExp(`(#{2,5}\\s+${escapedHeading})(\\s+)`, 'gi'),
      '$1\n'
    );
  }

  return normalized.trim();
}

function normalizeContentForSource(source: KnowledgeSource, content: string): string {
  if (source.kind === 'terraform-registry') {
    return normalizeTerraformRegistryMarkdown(content);
  }

  return content;
}

function normalizeContentTypeForSource(
  source: KnowledgeSource,
  contentType: KnowledgeContentType
): KnowledgeContentType {
  if (source.kind === 'terraform-registry' && contentType === 'text/plain') {
    return 'text/markdown';
  }

  return contentType;
}

function normalizePublicUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error(`Unsupported public knowledge URL: ${rawUrl}`);
  }

  if (!isSecretSafeKnowledgeUrl(parsed.toString())) {
    throw new Error('Public knowledge URL must be http(s) without credentials, query, or fragment.');
  }

  return parsed;
}

function terraformResourceSourceFromUrl(parsed: URL): PublicKnowledgeSourceResolution | null {
  if (parsed.hostname !== 'registry.terraform.io') {
    return null;
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  const docsIndex = parts.indexOf('docs');
  if (
    parts[0] !== 'providers'
    || parts.length < 7
    || docsIndex !== 4
    || (parts[5] !== 'resources' && parts[5] !== 'data-sources')
  ) {
    return null;
  }

  const namespace = parts[1] === '-' ? 'hashicorp' : parts[1];
  const providerName = parts[2];
  const version = parts[3];
  const docKind = parts[5];
  const slug = parts[6];
  const typeName = `${providerName}_${slug}`;
  const sourceName = docKind === 'resources'
    ? `resource:${typeName}`
    : `data-source:${typeName}`;

  return {
    domain: 'terraform',
    source: {
      kind: 'terraform-registry',
      name: sourceName,
      provider: `${namespace}/${providerName}`,
      version,
      url: parsed.toString()
    },
    terraformRegistry: {
      namespace,
      providerName,
      version,
      docKind,
      slug
    }
  };
}

function publicKnowledgeSourceFromUrl(rawUrl: string): PublicKnowledgeSourceResolution {
  const parsed = normalizePublicUrl(rawUrl);
  const terraformSource = terraformResourceSourceFromUrl(parsed);
  if (terraformSource) {
    return terraformSource;
  }

  throw new Error('Unsupported public knowledge URL. Supported v0 URLs are Terraform Registry provider resource and data source docs.');
}

function terraformRegistryRawDocCandidates(source: TerraformRegistryUrlSource): string[] {
  const refs = source.version === 'latest'
    ? ['main', 'master']
    : [`v${source.version}`, source.version, 'main', 'master'];
  const docDir = source.docKind === 'resources' ? 'r' : 'd';
  const fileNames = [
    `${source.slug}.html.markdown`,
    `${source.slug}.markdown`,
    `${source.slug}.md`
  ];
  const repo = `${source.namespace}/terraform-provider-${source.providerName}`;

  return refs.flatMap(ref => fileNames.map(fileName =>
    `https://raw.githubusercontent.com/${repo}/${ref}/website/docs/${docDir}/${fileName}`
  ));
}

function hasExtractableKnowledgeContent(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return false;
  }

  if (/please enable javascript to use this application/i.test(trimmed)) {
    return false;
  }

  return /(^|\n)#{1,6}\s+\S/.test(trimmed)
    || /\b(argument reference|attributes? reference|example usage|resource:|data source:)\b/i.test(trimmed);
}

function buildCacheEntry(input: {
  source: KnowledgeSource;
  contentType: KnowledgeContentType;
  content: string;
  fetchedAt?: string;
  staleAfter?: string;
  now?: Date;
}): KnowledgeCacheEntry {
  const source = input.source;

  return {
    id: buildKnowledgeCacheId(source),
    source,
    contentType: input.contentType,
    content: input.content,
    contentHash: sha256Hex(input.content),
    fetchedAt: input.fetchedAt ?? input.now?.toISOString() ?? new Date().toISOString(),
    ...(input.staleAfter !== undefined ? { staleAfter: input.staleAfter } : {})
  };
}

async function readEntryFromContentPath(input: {
  source: KnowledgeSource;
  contentPath: string;
  now?: Date;
}): Promise<KnowledgeCacheEntry> {
  const content = await readFile(input.contentPath, 'utf8');
  const normalized = normalizeOfficialKnowledgeContent({
    content,
    contentType: contentTypeForPath(input.contentPath)
  });

  return buildCacheEntry({
    source: input.source,
    contentType: normalizeContentTypeForSource(input.source, normalized.contentType),
    content: normalizeContentForSource(input.source, normalized.content),
    now: input.now
  });
}

async function fetchEntry(input: {
  resolution: PublicKnowledgeSourceResolution;
  now?: Date;
  fetchImpl?: OfficialKnowledgeFetchImpl;
}): Promise<KnowledgeCacheEntry> {
  const fetchedAt = input.now?.toISOString();
  let fetched: KnowledgeCacheWrite | null = null;
  let primaryError: Error | null = null;

  try {
    fetched = await fetchOfficialKnowledgeSource(input.resolution.source, {
      fetchedAt,
      fetchImpl: input.fetchImpl
    });
  } catch (error) {
    primaryError = error instanceof Error ? error : new Error(String(error));
  }

  if (fetched && hasExtractableKnowledgeContent(fetched.content)) {
    return buildCacheEntry({
      source: input.resolution.source,
      contentType: normalizeContentTypeForSource(input.resolution.source, fetched.contentType),
      content: normalizeContentForSource(input.resolution.source, fetched.content),
      fetchedAt: fetched.fetchedAt,
      staleAfter: fetched.staleAfter,
      now: input.now
    });
  }

  if (input.resolution.terraformRegistry) {
    for (const url of terraformRegistryRawDocCandidates(input.resolution.terraformRegistry)) {
      try {
        const fallback = await fetchOfficialKnowledgeSource({
          ...input.resolution.source,
          url
        }, {
          fetchedAt,
          fetchImpl: input.fetchImpl
        });

        if (fallback && hasExtractableKnowledgeContent(fallback.content)) {
          return buildCacheEntry({
            source: input.resolution.source,
            contentType: normalizeContentTypeForSource(input.resolution.source, fallback.contentType),
            content: normalizeContentForSource(input.resolution.source, fallback.content),
            fetchedAt: fallback.fetchedAt,
            staleAfter: fallback.staleAfter,
            now: input.now
          });
        }
      } catch {
        // Keep trying provider repository documentation candidates. Terraform
        // providers do not all use the same docs file extension or default ref.
      }
    }
  }

  if (primaryError) {
    throw primaryError;
  }

  throw new Error('Public knowledge URL did not return extractable content.');
}

function emptyUnitCounts(): KnowledgeUnitCountByType {
  return {
    fact: 0,
    guidance: 0,
    example: 0,
    diagnostic: 0,
    recipe: 0
  };
}

function unitCounts(units: KnowledgeUnit[]): KnowledgeUnitCountByType {
  const counts = emptyUnitCounts();

  for (const unit of units) {
    counts[unit.unitType] += 1;
  }

  return counts;
}

function compactPublicText(value: string, maxLength = 220): string {
  const compacted = value
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  return compacted.length > maxLength ? `${compacted.slice(0, maxLength - 3)}...` : compacted;
}

function compactPublicTextList(values: string[], maxLength = 180): string[] {
  return values.map(value => compactPublicText(value, maxLength));
}

function compactUnit(unit: KnowledgeUnit): CompactPublicKnowledgeUnit {
  const {
    source,
    ...rest
  } = unit;
  const compacted: Record<string, unknown> = {
    ...rest,
    summary: compactPublicText(unit.summary)
  };

  if (unit.unitType === 'guidance') {
    compacted.appliesWhen = compactPublicTextList(unit.appliesWhen);
    if (unit.risk) {
      compacted.risk = compactPublicText(unit.risk);
    }
  } else if (unit.unitType === 'example') {
    compacted.snippet = compactPublicText(unit.snippet, 360);
    compacted.appliesWhen = compactPublicTextList(unit.appliesWhen);
  } else if (unit.unitType === 'diagnostic') {
    compacted.likelyCause = compactPublicText(unit.likelyCause);
    compacted.recommendedReview = compactPublicTextList(unit.recommendedReview);
  } else if (unit.unitType === 'recipe') {
    compacted.steps = compactPublicTextList(unit.steps);
  }

  return {
    ...compacted,
    sourceId: source.id,
    sourceLocator: source.locator
  } as CompactPublicKnowledgeUnit;
}

function compactUnitsByType(
  units: KnowledgeUnit[]
): Record<KnowledgeUnitType, CompactPublicKnowledgeUnit[]> {
  return {
    fact: units.filter(unit => unit.unitType === 'fact').map(compactUnit),
    guidance: units.filter(unit => unit.unitType === 'guidance').map(compactUnit),
    example: units.filter(unit => unit.unitType === 'example').map(compactUnit),
    diagnostic: units.filter(unit => unit.unitType === 'diagnostic').map(compactUnit),
    recipe: units.filter(unit => unit.unitType === 'recipe').map(compactUnit)
  };
}

function unitPathLeaf(path: string): string {
  const parts = path.split('.');
  return parts[parts.length - 1] ?? path;
}

function unitSearchText(unit: KnowledgeUnit): string {
  const parts = [
    unit.path,
    unit.summary,
    unit.extractionMethod
  ];

  if (unit.unitType === 'guidance') {
    parts.push(unit.topic, ...unit.appliesWhen);
    if (unit.risk) {
      parts.push(unit.risk);
    }
  } else if (unit.unitType === 'diagnostic') {
    parts.push(unit.engine, unit.signature, unit.likelyCause, ...unit.recommendedReview);
  } else if (unit.unitType === 'recipe') {
    parts.push(unit.name, ...unit.steps);
  } else if (unit.unitType === 'example') {
    parts.push(unit.exampleType, unit.snippet, ...unit.appliesWhen);
    if (unit.language) {
      parts.push(unit.language);
    }
  } else if (unit.values) {
    parts.push(...unit.values);
  }

  return parts.join(' ');
}

function unitContains(unit: KnowledgeUnit, pattern: RegExp): boolean {
  return pattern.test(unitSearchText(unit));
}

function isDeprecatedUnit(unit: KnowledgeUnit): boolean {
  return unitContains(unit, /\bdeprecated\b/i);
}

function isExampleFactUnit(unit: KnowledgeUnit): boolean {
  return unit.unitType === 'fact' && unit.factKind === 'example';
}

function isMarkdownDerivedUnit(unit: KnowledgeUnit): boolean {
  return unit.path.includes('.markdown.') || unit.source.locator.startsWith('markdown:');
}

function isWeakDefaultBudgetUnit(unit: KnowledgeUnit): boolean {
  if (unit.unitType === 'recipe' && isMarkdownDerivedUnit(unit)) {
    return true;
  }

  return unit.unitType === 'guidance'
    && isMarkdownDerivedUnit(unit)
    && /\b(argument|attribute|parameter|input|value)s?(?:-reference)?\b/i.test(unitSearchText(unit));
}

function unitSelectionKey(unit: KnowledgeUnit): string {
  return `${unit.unitType}:${unit.path}:${unit.summary}`;
}

function unitSelectionBudgets(maxUnits: number): KnowledgeUnitCountByType {
  const recipe = Math.max(1, Math.floor(maxUnits * 0.08));
  const example = Math.max(1, Math.floor(maxUnits * 0.1));
  const diagnostic = Math.max(1, Math.floor(maxUnits * 0.15));
  const guidance = Math.max(1, Math.floor(maxUnits * 0.2));
  const fact = Math.max(1, maxUnits - recipe - example - diagnostic - guidance);

  return {
    fact,
    guidance,
    example,
    diagnostic,
    recipe
  };
}

function unitPriority(unit: KnowledgeUnit): number {
  let score = 0;
  const leaf = unitPathLeaf(unit.path);

  if (unit.unitType === 'guidance') {
    score += 500;
    if (isMarkdownDerivedUnit(unit)) {
      score -= 80;
    }
    if (unit.topic === 'replacement-sensitive-field') {
      score += 80;
    }
    if (unit.topic === 'provider-identity-field') {
      score += 70;
    }
    if (unit.risk) {
      score += 20;
    }
  } else if (unit.unitType === 'diagnostic') {
    score += 480;
    if (unit.signature.includes('replacement-sensitive-field')) {
      score += 70;
    }
    if (unit.signature.includes('identity-field')) {
      score += 60;
    }
  } else if (unit.unitType === 'recipe') {
    score += 460;
    if (isMarkdownDerivedUnit(unit)) {
      score -= 180;
    }
    if (/identity|replacement|safe/i.test(unit.name)) {
      score += 60;
    }
  } else if (unit.unitType === 'example') {
    score += 440;
  } else if (unit.unitType === 'fact') {
    if (unit.factKind === 'replacement-sensitive-field') {
      score += 420;
    } else if (unit.factKind === 'identity-field') {
      score += 410;
    } else if (unit.factKind === 'argument') {
      score += 300;
    } else if (unit.factKind === 'attribute') {
      score += 150;
    } else if (unit.factKind === 'example') {
      score -= 1000;
    } else {
      score += 200;
    }
  }

  if (leaf === 'bucket') {
    score += 80;
  } else if (leaf === 'bucket_prefix') {
    score += 65;
  } else if (leaf === 'bucket_namespace') {
    score += 60;
  } else if (leaf === 'force_destroy') {
    score += 58;
  } else if (leaf === 'object_lock_enabled') {
    score += 55;
  } else if (leaf === 'tags') {
    score += 15;
  } else if (leaf === 'region') {
    score += 10;
  }

  if (unitContains(unit, /force(s)? new|replacement|recreate/i)) {
    score += 35;
  }
  if (unitContains(unit, /\bdestroy|delete/i)) {
    score += 25;
  }
  if (isDeprecatedUnit(unit)) {
    score -= 200;
  }
  if (isWeakDefaultBudgetUnit(unit)) {
    score -= 120;
  }

  return score;
}

function refineCandidateUnits(units: KnowledgeUnit[]): KnowledgeUnit[] {
  return units
    .filter(unit => !isExampleFactUnit(unit))
    .sort((left, right) => {
      const scoreDelta = unitPriority(right) - unitPriority(left);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return `${left.unitType}:${left.path}:${left.summary}`
        .localeCompare(`${right.unitType}:${right.path}:${right.summary}`);
    });
}

function findBestUnitOfType(units: KnowledgeUnit[], unitType: KnowledgeUnitType): KnowledgeUnit | null {
  return units.find(unit => unit.unitType === unitType && !isWeakDefaultBudgetUnit(unit))
    ?? units.find(unit => unit.unitType === unitType)
    ?? null;
}

function selectUnitsForAgent(units: KnowledgeUnit[], maxUnits: number): KnowledgeUnit[] {
  const rankedUnits = refineCandidateUnits(units);
  const selected: KnowledgeUnit[] = [];
  const selectedKeys = new Set<string>();
  const selectedCounts = emptyUnitCounts();
  const budgets = unitSelectionBudgets(maxUnits);

  const addUnit = (unit: KnowledgeUnit): boolean => {
    const key = unitSelectionKey(unit);
    if (selectedKeys.has(key) || selected.length >= maxUnits) {
      return false;
    }

    selected.push(unit);
    selectedKeys.add(key);
    selectedCounts[unit.unitType] += 1;
    return true;
  };

  for (const unitType of KNOWLEDGE_UNIT_TYPES) {
    const unit = findBestUnitOfType(rankedUnits, unitType);
    if (unit) {
      addUnit(unit);
    }
  }

  for (const unit of rankedUnits) {
    if (selected.length >= maxUnits) {
      break;
    }
    if (selectedCounts[unit.unitType] >= budgets[unit.unitType]) {
      continue;
    }
    if (isWeakDefaultBudgetUnit(unit) && selectedCounts[unit.unitType] > 0) {
      continue;
    }

    addUnit(unit);
  }

  for (const unit of rankedUnits) {
    if (selected.length >= maxUnits) {
      break;
    }
    if (isWeakDefaultBudgetUnit(unit)) {
      continue;
    }

    addUnit(unit);
  }

  return selected.slice(0, maxUnits);
}

function qualitySummary(input: {
  selectedUnits: KnowledgeUnit[];
  counts: KnowledgeUnitCountByType;
  missingUnitTypes: KnowledgeUnitType[];
  compactByteLength: number;
}): PublicKnowledgeQualitySummary {
  const warnings: string[] = [];

  if (input.missingUnitTypes.length > 0) {
    warnings.push(`missing unit types: ${input.missingUnitTypes.join(', ')}`);
  }
  if (input.selectedUnits.some(isExampleFactUnit)) {
    warnings.push('example fact units should be represented only as example units');
  }
  if (input.selectedUnits.some(isDeprecatedUnit)) {
    warnings.push('deprecated fields are included in the selected unit budget');
  }
  if (input.compactByteLength > 16000) {
    warnings.push('compact agent knowledge exceeds the preferred public-reference byte budget');
  }

  const score = Math.max(0, 100
    - (input.missingUnitTypes.length * 20)
    - (input.selectedUnits.some(isExampleFactUnit) ? 20 : 0)
    - (input.selectedUnits.some(isDeprecatedUnit) ? 10 : 0)
    - (input.compactByteLength > 16000 ? 10 : 0));

  return {
    status: warnings.length === 0 ? 'ready' : 'needs-refinement',
    score,
    warnings,
    llmUsed: false,
    refinementMode: 'deterministic'
  };
}

function compactSource(source: KnowledgeSource, domain: InfraDomainId): PublicKnowledgeCentralLibraryCandidate['source'] {
  return {
    domain,
    kind: source.kind,
    name: source.name,
    ...(source.provider ? { provider: source.provider } : {}),
    ...(source.version ? { version: source.version } : {}),
    ...(source.url ? { url: source.url } : {})
  };
}

function candidateId(input: {
  sourceId: string;
  sourceContentHash: string;
  maxUnits: number;
}): string {
  return sha256Hex(`${input.sourceId}:${input.sourceContentHash}:${input.maxUnits}`).slice(0, 24);
}

function buildCentralLibraryCandidate(input: {
  domain: InfraDomainId;
  source: KnowledgeSource;
  sourceId: string;
  sourceContentHash: string;
  maxUnits: number;
  quality: PublicKnowledgeQualitySummary;
  counts: KnowledgeUnitCountByType;
  selectedUnitCount: number;
}): PublicKnowledgeCentralLibraryCandidate {
  return {
    kind: 'infra-agent.central-knowledge-candidate',
    schemaVersion: 1,
    mutationAllowed: false,
    storageScope: 'public-reference',
    privacyScope: 'public-reference',
    candidateId: candidateId({
      sourceId: input.sourceId,
      sourceContentHash: input.sourceContentHash,
      maxUnits: input.maxUnits
    }),
    sourceId: input.sourceId,
    sourceContentHash: input.sourceContentHash,
    source: compactSource(input.source, input.domain),
    quality: input.quality,
    unitCount: input.selectedUnitCount,
    unitCounts: input.counts,
    unitRef: 'report.unitsByType'
  };
}

export async function buildPublicKnowledgeUrlReport(
  options: PublicKnowledgeUrlReportOptions
): Promise<PublicKnowledgeUrlReport> {
  const maxUnits = normalizeMaxUnits(options.maxUnits);
  const resolution = publicKnowledgeSourceFromUrl(options.url);
  const { domain, source } = resolution;
  const entry = options.contentPath
    ? await readEntryFromContentPath({ source, contentPath: options.contentPath, now: options.now })
    : await fetchEntry({ resolution, now: options.now, fetchImpl: options.fetchImpl });
  const factSet = extractKnowledgeFactSetFromCacheEntry(entry, {
    now: options.now
  });
  const markdownUnits = extractMarkdownKnowledgeUnitsFromCacheEntry(entry, factSet);
  const extractedUnitSet = extractKnowledgeUnitSetFromFactSet(factSet, markdownUnits);
  const selectedUnits = selectUnitsForAgent(extractedUnitSet.units, maxUnits);
  const counts = unitCounts(selectedUnits);
  const includedUnitTypes = KNOWLEDGE_UNIT_TYPES.filter(unitType => counts[unitType] > 0);
  const missingUnitTypes = KNOWLEDGE_UNIT_TYPES.filter(unitType => counts[unitType] === 0);
  const compactGroupedUnits = compactUnitsByType(selectedUnits);
  const compactByteLength = JSON.stringify(compactGroupedUnits).length;
  const quality = qualitySummary({
    selectedUnits,
    counts,
    missingUnitTypes,
    compactByteLength
  });
  const centralLibraryCandidate = buildCentralLibraryCandidate({
    domain,
    source,
    sourceId: entry.id,
    sourceContentHash: entry.contentHash,
    maxUnits,
    quality,
    counts,
    selectedUnitCount: selectedUnits.length
  });

  return {
    kind: 'infra-agent.public-knowledge-url-report',
    schemaVersion: 1,
    mutationAllowed: false,
    sourceUrl: source.url ?? options.url,
    domain,
    source,
    sourceId: entry.id,
    sourceContentHash: entry.contentHash,
    fetchedAt: entry.fetchedAt,
    sourceStale: isKnowledgeCacheEntryStale(entry, options.now),
    maxUnits,
    summary: {
      factCount: factSet.factCount,
      unitCount: extractedUnitSet.unitCount,
      includedUnitCount: selectedUnits.length,
      omittedUnitCount: Math.max(0, extractedUnitSet.unitCount - selectedUnits.length),
      unitCounts: counts,
      includedUnitTypes,
      missingUnitTypes,
      unitTypeComplete: missingUnitTypes.length === 0,
      qualityStatus: quality.status,
      qualityScore: quality.score,
      qualityWarnings: quality.warnings,
      compactByteLength
    },
    quality,
    unitsByType: compactGroupedUnits,
    centralLibraryCandidate
  };
}
