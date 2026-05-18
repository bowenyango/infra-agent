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
  type KnowledgeUnitSet,
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
  };
  unitSet: KnowledgeUnitSet;
  unitsByType: Record<KnowledgeUnitType, KnowledgeUnit[]>;
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

function selectUnitsForAgent(units: KnowledgeUnit[], maxUnits: number): KnowledgeUnit[] {
  const selected: KnowledgeUnit[] = [];
  const selectedKeys = new Set<string>();

  for (const unitType of KNOWLEDGE_UNIT_TYPES) {
    const unit = units.find(candidate => candidate.unitType === unitType);
    if (unit) {
      selected.push(unit);
      selectedKeys.add(`${unit.unitType}:${unit.path}:${unit.summary}`);
    }
  }

  for (const unit of units) {
    if (selected.length >= maxUnits) {
      break;
    }

    const key = `${unit.unitType}:${unit.path}:${unit.summary}`;
    if (!selectedKeys.has(key)) {
      selected.push(unit);
      selectedKeys.add(key);
    }
  }

  return selected.slice(0, maxUnits);
}

function unitsByType(units: KnowledgeUnit[]): Record<KnowledgeUnitType, KnowledgeUnit[]> {
  return {
    fact: units.filter(unit => unit.unitType === 'fact'),
    guidance: units.filter(unit => unit.unitType === 'guidance'),
    example: units.filter(unit => unit.unitType === 'example'),
    diagnostic: units.filter(unit => unit.unitType === 'diagnostic'),
    recipe: units.filter(unit => unit.unitType === 'recipe')
  };
}

function unitCounts(units: KnowledgeUnit[]): KnowledgeUnitCountByType {
  const counts = emptyUnitCounts();

  for (const unit of units) {
    counts[unit.unitType] += 1;
  }

  return counts;
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
  const groupedUnits = unitsByType(selectedUnits);
  const counts = unitCounts(selectedUnits);
  const includedUnitTypes = KNOWLEDGE_UNIT_TYPES.filter(unitType => counts[unitType] > 0);
  const missingUnitTypes = KNOWLEDGE_UNIT_TYPES.filter(unitType => counts[unitType] === 0);
  const unitSet = {
    ...extractedUnitSet,
    unitCount: selectedUnits.length,
    units: selectedUnits
  };

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
      unitTypeComplete: missingUnitTypes.length === 0
    },
    unitSet,
    unitsByType: groupedUnits
  };
}
