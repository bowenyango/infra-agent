import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  buildKnowledgeCacheId,
  isKnowledgeCacheEntryStale
} from './cache.ts';
import { extractKnowledgeFactSetFromCacheEntry } from './facts.ts';
import { extractMarkdownKnowledgeUnitsFromCacheEntry } from './markdown-units.ts';
import { normalizeOfficialKnowledgeContent } from './official-doc-normalize.ts';
import type { FetchOfficialKnowledgeSourceOptions } from './retrieve.ts';
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

type OfficialKnowledgeFetchImpl = NonNullable<FetchOfficialKnowledgeSourceOptions['fetchImpl']>;

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

export type PublicKnowledgeDownloadMode = 'live-fetch' | 'local-content';
export type PublicKnowledgeDownloadAttemptRole = 'primary' | 'fallback';
export type PublicKnowledgeDownloadAttemptStatus = 'used' | 'rejected' | 'failed';

export interface PublicKnowledgeDownloadAttempt {
  role: PublicKnowledgeDownloadAttemptRole;
  url: string;
  status: PublicKnowledgeDownloadAttemptStatus;
  reason?: string;
  httpStatus?: number;
  statusText?: string;
  contentType?: KnowledgeContentType;
  byteLength?: number;
}

export interface PublicKnowledgeDownloadSummary {
  mode: PublicKnowledgeDownloadMode;
  strategy: 'local-content-fixture' | 'terraform-registry-primary-then-provider-repo-raw';
  attemptedCount: number;
  fallbackUsed: boolean;
  usedRole: PublicKnowledgeDownloadAttemptRole | 'local-content';
  usedUrl?: string;
  usedContentType: KnowledgeContentType;
  attempts: PublicKnowledgeDownloadAttempt[];
}

export interface PublicKnowledgeDownloadEvidence {
  traceHash: string;
  attemptedCount: number;
  selectedAttemptIndex: number | null;
  usedRole: PublicKnowledgeDownloadSummary['usedRole'];
  usedUrl?: string;
  usedContentType: KnowledgeContentType;
  fallbackUsed: boolean;
  attemptedRoles: PublicKnowledgeDownloadAttemptRole[];
  rejectedAttemptCount: number;
  failedAttemptCount: number;
}

export type PublicKnowledgeVersionRefKind = 'pinned-version' | 'floating-alias';

export interface PublicKnowledgeVersionRef {
  value: string;
  kind: PublicKnowledgeVersionRefKind;
  mutable: boolean;
  source: 'url-path';
}

export type PublicKnowledgeVersionResolutionStatus = 'pinned' | 'resolved' | 'unavailable';
export type PublicKnowledgeVersionResolutionSource =
  | 'url-path'
  | 'terraform-registry-provider-versions'
  | 'not-attempted-local-content';
export type PublicKnowledgeVersionResolutionReason =
  | 'content-fixture-no-network'
  | 'http-error'
  | 'invalid-response'
  | 'no-semver-version'
  | 'fetch-error';

export interface PublicKnowledgeVersionResolution {
  requestedVersion: string;
  resolvedVersion?: string;
  status: PublicKnowledgeVersionResolutionStatus;
  mutable: boolean;
  source: PublicKnowledgeVersionResolutionSource;
  url?: string;
  fetchedAt?: string;
  reason?: PublicKnowledgeVersionResolutionReason;
}

export interface PublicKnowledgeCentralLibraryClassification {
  registry: 'infra-agent-public-reference';
  ecosystem: 'terraform';
  artifactKind: 'terraform-provider-resource' | 'terraform-provider-data-source';
  namespace: string;
  providerName: string;
  providerAddress: string;
  version: string;
  versionRef: PublicKnowledgeVersionRef;
  versionResolution: PublicKnowledgeVersionResolution;
  sourceName: string;
  slug: string;
  coordinates: string;
  tags: string[];
}

export interface PublicKnowledgeLlmRefinementInput {
  status: 'not-run';
  mode: 'offline-review';
  inputRefs: [
    'report.centralLibraryCandidate.classification',
    'report.download',
    'report.summary',
    'report.unitsByType',
    'report.quality'
  ];
  reviewPacket: {
    sourceId: string;
    sourceContentHash: string;
    coordinates: string;
    ecosystem: 'terraform';
    artifactKind: PublicKnowledgeCentralLibraryClassification['artifactKind'];
    version: string;
    versionRef: PublicKnowledgeVersionRef;
    versionResolution: PublicKnowledgeVersionResolution;
    sourceName: string;
    downloadMode: PublicKnowledgeDownloadMode;
    downloadStrategy: PublicKnowledgeDownloadSummary['strategy'];
    usedRole: PublicKnowledgeDownloadSummary['usedRole'];
    fallbackUsed: boolean;
    downloadEvidence: PublicKnowledgeDownloadEvidence;
    unitBudget: number;
    unitCount: number;
    unitCounts: KnowledgeUnitCountByType;
    missingUnitTypes: KnowledgeUnitType[];
    compactByteLength: number;
    qualityStatus: PublicKnowledgeQualityStatus;
    qualityScore: number;
    qualityWarnings: string[];
  };
  objective: string;
  unitTypes: KnowledgeUnitType[];
  reviewChecklist: string[];
  rejectionCriteria: string[];
  constraints: string[];
  outputContract: 'infra-agent.public-knowledge-url-report';
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
  classification: PublicKnowledgeCentralLibraryClassification;
  llmRefinementInput: PublicKnowledgeLlmRefinementInput;
}

export interface PublicKnowledgeLibraryArtifact {
  kind: 'infra-agent.public-knowledge-library-artifact';
  schemaVersion: 1;
  mutationAllowed: false;
  storageScope: 'public-reference';
  privacyScope: 'public-reference';
  artifactId: string;
  coordinates: string;
  sourceId: string;
  sourceContentHash: string;
  unitPayloadHash: string;
  generatedFromReportKind: PublicKnowledgeUrlReport['kind'];
  source: PublicKnowledgeCentralLibraryCandidate['source'];
  classification: PublicKnowledgeCentralLibraryClassification;
  download: PublicKnowledgeDownloadSummary;
  quality: PublicKnowledgeQualitySummary;
  summary: {
    unitCount: number;
    unitCounts: KnowledgeUnitCountByType;
    includedUnitTypes: KnowledgeUnitType[];
    compactByteLength: number;
  };
  unitsByType: Record<KnowledgeUnitType, CompactPublicKnowledgeUnit[]>;
  llmRefinementInput: PublicKnowledgeLlmRefinementInput;
  publication: {
    status: 'local-artifact';
    downloadable: true;
    uploadRequired: false;
    reviewRequired: true;
  };
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
  download: PublicKnowledgeDownloadSummary;
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
const PUBLIC_KNOWLEDGE_STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
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

interface PublicKnowledgeEntryResult {
  entry: KnowledgeCacheEntry;
  download: PublicKnowledgeDownloadSummary;
}

interface SemverParts {
  version: string;
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalDownloadTrace(download: PublicKnowledgeDownloadSummary): string {
  return JSON.stringify({
    mode: download.mode,
    strategy: download.strategy,
    attemptedCount: download.attemptedCount,
    fallbackUsed: download.fallbackUsed,
    usedRole: download.usedRole,
    usedUrl: download.usedUrl ?? null,
    usedContentType: download.usedContentType,
    attempts: download.attempts.map(attempt => ({
      role: attempt.role,
      url: attempt.url,
      status: attempt.status,
      reason: attempt.reason ?? null,
      httpStatus: attempt.httpStatus ?? null,
      statusText: attempt.statusText ?? null,
      contentType: attempt.contentType ?? null,
      byteLength: attempt.byteLength ?? null
    }))
  });
}

function publicKnowledgeDownloadEvidence(
  download: PublicKnowledgeDownloadSummary
): PublicKnowledgeDownloadEvidence {
  const selectedAttemptIndex = download.attempts.findIndex(attempt => attempt.status === 'used');

  return {
    traceHash: sha256Hex(canonicalDownloadTrace(download)),
    attemptedCount: download.attemptedCount,
    selectedAttemptIndex: selectedAttemptIndex >= 0 ? selectedAttemptIndex : null,
    usedRole: download.usedRole,
    ...(download.usedUrl ? { usedUrl: download.usedUrl } : {}),
    usedContentType: download.usedContentType,
    fallbackUsed: download.fallbackUsed,
    attemptedRoles: download.attempts.map(attempt => attempt.role),
    rejectedAttemptCount: download.attempts.filter(attempt => attempt.status === 'rejected').length,
    failedAttemptCount: download.attempts.filter(attempt => attempt.status === 'failed').length
  };
}

function terraformProviderVersionsUrl(source: TerraformRegistryUrlSource): string {
  return `https://registry.terraform.io/v1/providers/${source.namespace}/${source.providerName}/versions`;
}

function parseSemver(value: string): SemverParts | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value);
  if (!match) {
    return null;
  }

  return {
    version: value,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null
  };
}

function compareSemver(left: SemverParts, right: SemverParts): number {
  for (const key of ['major', 'minor', 'patch'] as const) {
    const delta = left[key] - right[key];
    if (delta !== 0) {
      return delta;
    }
  }

  if (left.prerelease === null && right.prerelease !== null) {
    return 1;
  }
  if (left.prerelease !== null && right.prerelease === null) {
    return -1;
  }

  return (left.prerelease ?? '').localeCompare(right.prerelease ?? '');
}

function latestSemverVersion(versions: string[]): string | null {
  const parsed = versions
    .map(parseSemver)
    .filter((version): version is SemverParts => version !== null);
  if (parsed.length === 0) {
    return null;
  }

  return parsed.sort(compareSemver).at(-1)?.version ?? null;
}

function unavailableVersionResolution(input: {
  requestedVersion: string;
  mutable: boolean;
  source: PublicKnowledgeVersionResolutionSource;
  reason: PublicKnowledgeVersionResolutionReason;
  url?: string;
  fetchedAt?: string;
}): PublicKnowledgeVersionResolution {
  return {
    requestedVersion: input.requestedVersion,
    status: 'unavailable',
    mutable: input.mutable,
    source: input.source,
    ...(input.url ? { url: input.url } : {}),
    ...(input.fetchedAt ? { fetchedAt: input.fetchedAt } : {}),
    reason: input.reason
  };
}

async function resolveTerraformRegistryVersion(input: {
  source: TerraformRegistryUrlSource;
  contentPath?: string;
  now?: Date;
  fetchImpl?: OfficialKnowledgeFetchImpl;
}): Promise<PublicKnowledgeVersionResolution> {
  const requestedVersion = input.source.version;
  const mutable = requestedVersion === 'latest';
  if (!mutable) {
    return {
      requestedVersion,
      resolvedVersion: requestedVersion,
      status: 'pinned',
      mutable: false,
      source: 'url-path'
    };
  }

  const url = terraformProviderVersionsUrl(input.source);
  if (input.contentPath !== undefined) {
    return unavailableVersionResolution({
      requestedVersion,
      mutable: true,
      source: 'not-attempted-local-content',
      reason: 'content-fixture-no-network',
      url
    });
  }

  const fetchedAt = input.now?.toISOString() ?? new Date().toISOString();
  try {
    const fetchImpl = input.fetchImpl ?? (fetch as unknown as OfficialKnowledgeFetchImpl);
    const response = await fetchImpl(url);
    if (!response.ok) {
      return unavailableVersionResolution({
        requestedVersion,
        mutable: true,
        source: 'terraform-registry-provider-versions',
        reason: 'http-error',
        url,
        fetchedAt
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(await response.text()) as unknown;
    } catch {
      return unavailableVersionResolution({
        requestedVersion,
        mutable: true,
        source: 'terraform-registry-provider-versions',
        reason: 'invalid-response',
        url,
        fetchedAt
      });
    }

    const versions = isRecord(parsed) && Array.isArray(parsed.versions)
      ? parsed.versions
        .map(version => isRecord(version) && typeof version.version === 'string' ? version.version : null)
        .filter((version): version is string => version !== null)
      : [];
    const resolvedVersion = latestSemverVersion(versions);
    if (resolvedVersion === null) {
      return unavailableVersionResolution({
        requestedVersion,
        mutable: true,
        source: 'terraform-registry-provider-versions',
        reason: 'no-semver-version',
        url,
        fetchedAt
      });
    }

    return {
      requestedVersion,
      resolvedVersion,
      status: 'resolved',
      mutable: true,
      source: 'terraform-registry-provider-versions',
      url,
      fetchedAt
    };
  } catch {
    return unavailableVersionResolution({
      requestedVersion,
      mutable: true,
      source: 'terraform-registry-provider-versions',
      reason: 'fetch-error',
      url,
      fetchedAt
    });
  }
}

async function resolvePublicKnowledgeVersion(input: {
  resolution: PublicKnowledgeSourceResolution;
  contentPath?: string;
  now?: Date;
  fetchImpl?: OfficialKnowledgeFetchImpl;
}): Promise<PublicKnowledgeVersionResolution> {
  if (input.resolution.terraformRegistry) {
    return resolveTerraformRegistryVersion({
      source: input.resolution.terraformRegistry,
      contentPath: input.contentPath,
      now: input.now,
      fetchImpl: input.fetchImpl
    });
  }

  throw new Error('Unsupported public knowledge source version resolution.');
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

function contentTypeFromHeader(header: string | null): KnowledgeContentType {
  const contentType = header?.toLowerCase() ?? '';

  if (contentType.includes('application/json')) {
    return 'application/json';
  }
  if (contentType.includes('yaml') || contentType.includes('yml')) {
    return 'application/yaml';
  }
  if (contentType.includes('markdown')) {
    return 'text/markdown';
  }

  return 'text/plain';
}

function staleAfterForPublicSource(fetchedAt: string): string {
  return new Date(Date.parse(fetchedAt) + PUBLIC_KNOWLEDGE_STALE_AFTER_MS).toISOString();
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
}): Promise<PublicKnowledgeEntryResult> {
  const content = await readFile(input.contentPath, 'utf8');
  const normalized = normalizeOfficialKnowledgeContent({
    content,
    contentType: contentTypeForPath(input.contentPath)
  });
  const contentType = normalizeContentTypeForSource(input.source, normalized.contentType);
  const entry = buildCacheEntry({
    source: input.source,
    contentType,
    content: normalizeContentForSource(input.source, normalized.content),
    now: input.now
  });

  return {
    entry,
    download: {
      mode: 'local-content',
      strategy: 'local-content-fixture',
      attemptedCount: 0,
      fallbackUsed: false,
      usedRole: 'local-content',
      usedContentType: contentType,
      attempts: []
    }
  };
}

async function downloadOfficialKnowledgeSource(input: {
  source: KnowledgeSource;
  role: PublicKnowledgeDownloadAttemptRole;
  fetchedAt?: string;
  fetchImpl?: OfficialKnowledgeFetchImpl;
}): Promise<{
  write: KnowledgeCacheWrite;
  attempt: PublicKnowledgeDownloadAttempt;
}> {
  if (!input.source.url) {
    throw new Error('Public knowledge source is missing a URL.');
  }

  const fetchImpl = input.fetchImpl ?? (fetch as unknown as OfficialKnowledgeFetchImpl);
  const response = await fetchImpl(input.source.url);
  const contentTypeHeader = response.headers.get('content-type');
  const contentType = contentTypeFromHeader(contentTypeHeader);

  if (!response.ok) {
    throw Object.assign(new Error(`${response.status} ${response.statusText}`), {
      attempt: {
        role: input.role,
        url: input.source.url,
        status: 'failed' as const,
        reason: 'http-error',
        httpStatus: response.status,
        statusText: response.statusText,
        contentType
      }
    });
  }

  const rawContent = await response.text();
  const normalized = normalizeOfficialKnowledgeContent({
    content: rawContent,
    contentType,
    contentTypeHeader
  });
  const fetchedAt = input.fetchedAt ?? new Date().toISOString();
  const write: KnowledgeCacheWrite = {
    source: input.source,
    contentType: normalized.contentType,
    content: normalized.content,
    fetchedAt,
    staleAfter: staleAfterForPublicSource(fetchedAt),
    metadata: {
      retrieval: 'official-url',
      ...(normalized.normalization ? { normalization: normalized.normalization } : {})
    }
  };

  return {
    write,
    attempt: {
      role: input.role,
      url: input.source.url,
      status: 'used',
      httpStatus: response.status,
      statusText: response.statusText,
      contentType: normalized.contentType,
      byteLength: Buffer.byteLength(normalized.content)
    }
  };
}

async function fetchEntry(input: {
  resolution: PublicKnowledgeSourceResolution;
  now?: Date;
  fetchImpl?: OfficialKnowledgeFetchImpl;
}): Promise<PublicKnowledgeEntryResult> {
  const fetchedAt = input.now?.toISOString();
  let fetched: KnowledgeCacheWrite | null = null;
  let primaryError: Error | null = null;
  const attempts: PublicKnowledgeDownloadAttempt[] = [];

  try {
    const downloaded = await downloadOfficialKnowledgeSource({
      source: input.resolution.source,
      fetchedAt,
      role: 'primary',
      fetchImpl: input.fetchImpl
    });
    fetched = downloaded.write;
    attempts.push(downloaded.attempt);
  } catch (error) {
    primaryError = error instanceof Error ? error : new Error(String(error));
    const attempt = error instanceof Error
      ? (error as Error & { attempt?: PublicKnowledgeDownloadAttempt }).attempt
      : undefined;
    attempts.push(attempt ?? {
      role: 'primary',
      url: input.resolution.source.url ?? '',
      status: 'failed',
      reason: primaryError.message
    });
  }

  if (fetched && hasExtractableKnowledgeContent(fetched.content)) {
    const entry = buildCacheEntry({
      source: input.resolution.source,
      contentType: normalizeContentTypeForSource(input.resolution.source, fetched.contentType),
      content: normalizeContentForSource(input.resolution.source, fetched.content),
      fetchedAt: fetched.fetchedAt,
      staleAfter: fetched.staleAfter,
      now: input.now
    });

    return {
      entry,
      download: {
        mode: 'live-fetch',
        strategy: 'terraform-registry-primary-then-provider-repo-raw',
        attemptedCount: attempts.length,
        fallbackUsed: false,
        usedRole: 'primary',
        usedUrl: attempts[attempts.length - 1]?.url,
        usedContentType: entry.contentType,
        attempts
      }
    };
  }

  if (fetched) {
    const attempt = attempts[attempts.length - 1];
    if (attempt && attempt.status === 'used') {
      attempt.status = 'rejected';
      attempt.reason = 'content-not-extractable';
    }
  }

  if (input.resolution.terraformRegistry) {
    for (const url of terraformRegistryRawDocCandidates(input.resolution.terraformRegistry)) {
      try {
        const downloaded = await downloadOfficialKnowledgeSource({
          source: {
            ...input.resolution.source,
            url
          },
          role: 'fallback',
          fetchedAt,
          fetchImpl: input.fetchImpl
        });
        const fallback = downloaded.write;
        attempts.push(downloaded.attempt);

        if (fallback && hasExtractableKnowledgeContent(fallback.content)) {
          const entry = buildCacheEntry({
            source: input.resolution.source,
            contentType: normalizeContentTypeForSource(input.resolution.source, fallback.contentType),
            content: normalizeContentForSource(input.resolution.source, fallback.content),
            fetchedAt: fallback.fetchedAt,
            staleAfter: fallback.staleAfter,
            now: input.now
          });

          return {
            entry,
            download: {
              mode: 'live-fetch',
              strategy: 'terraform-registry-primary-then-provider-repo-raw',
              attemptedCount: attempts.length,
              fallbackUsed: true,
              usedRole: 'fallback',
              usedUrl: url,
              usedContentType: entry.contentType,
              attempts
            }
          };
        }

        const attempt = attempts[attempts.length - 1];
        if (attempt && attempt.status === 'used') {
          attempt.status = 'rejected';
          attempt.reason = 'content-not-extractable';
        }
      } catch (error) {
        const fallbackError = error instanceof Error ? error : new Error(String(error));
        const attempt = (fallbackError as Error & { attempt?: PublicKnowledgeDownloadAttempt }).attempt;
        attempts.push(attempt ?? {
          role: 'fallback',
          url,
          status: 'failed',
          reason: fallbackError.message
        });
        // Keep trying provider repository documentation candidates. Terraform
        // providers do not all use the same docs file extension or default ref.
      }
    }
  }

  if (primaryError) {
    primaryError.message = `${primaryError.message}; download attempts: ${attempts.length}`;
    throw primaryError;
  }

  throw new Error(`Public knowledge URL did not return extractable content after ${attempts.length} download attempts.`);
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

function terraformLibraryClassification(
  source: TerraformRegistryUrlSource,
  versionResolution: PublicKnowledgeVersionResolution
): PublicKnowledgeCentralLibraryClassification {
  const typeName = `${source.providerName}_${source.slug}`;
  const artifactKind = source.docKind === 'resources'
    ? 'terraform-provider-resource'
    : 'terraform-provider-data-source';
  const sourceName = source.docKind === 'resources'
    ? `resource:${typeName}`
    : `data-source:${typeName}`;
  const kindSegment = source.docKind === 'resources' ? 'resource' : 'data-source';
  const versionRef = publicKnowledgeVersionRef(source.version);
  const coordinates = [
    'terraform',
    'provider',
    `${source.namespace}/${source.providerName}`,
    source.version,
    kindSegment,
    typeName
  ].join('/');

  return {
    registry: 'infra-agent-public-reference',
    ecosystem: 'terraform',
    artifactKind,
    namespace: source.namespace,
    providerName: source.providerName,
    providerAddress: `${source.namespace}/${source.providerName}`,
    version: source.version,
    versionRef,
    versionResolution,
    sourceName,
    slug: source.slug,
    coordinates,
    tags: [
      'public-reference',
      'terraform',
      'provider-docs',
      source.namespace,
      source.providerName,
      typeName,
      kindSegment,
      versionRef.kind
    ]
  };
}

function publicKnowledgeVersionRef(version: string): PublicKnowledgeVersionRef {
  const floating = version === 'latest';
  return {
    value: version,
    kind: floating ? 'floating-alias' : 'pinned-version',
    mutable: floating,
    source: 'url-path'
  };
}

function libraryClassification(
  resolution: PublicKnowledgeSourceResolution,
  versionResolution: PublicKnowledgeVersionResolution
): PublicKnowledgeCentralLibraryClassification {
  if (resolution.terraformRegistry) {
    return terraformLibraryClassification(resolution.terraformRegistry, versionResolution);
  }

  throw new Error('Unsupported public knowledge source classification.');
}

function llmRefinementInput(input: {
  sourceId: string;
  sourceContentHash: string;
  classification: PublicKnowledgeCentralLibraryClassification;
  download: PublicKnowledgeDownloadSummary;
  maxUnits: number;
  counts: KnowledgeUnitCountByType;
  selectedUnitCount: number;
  missingUnitTypes: KnowledgeUnitType[];
  compactByteLength: number;
  quality: PublicKnowledgeQualitySummary;
}): PublicKnowledgeLlmRefinementInput {
  return {
    status: 'not-run',
    mode: 'offline-review',
    inputRefs: [
      'report.centralLibraryCandidate.classification',
      'report.download',
      'report.summary',
      'report.unitsByType',
      'report.quality'
    ],
    reviewPacket: {
      sourceId: input.sourceId,
      sourceContentHash: input.sourceContentHash,
      coordinates: input.classification.coordinates,
      ecosystem: input.classification.ecosystem,
      artifactKind: input.classification.artifactKind,
      version: input.classification.version,
      versionRef: input.classification.versionRef,
      versionResolution: input.classification.versionResolution,
      sourceName: input.classification.sourceName,
      downloadMode: input.download.mode,
      downloadStrategy: input.download.strategy,
      usedRole: input.download.usedRole,
      fallbackUsed: input.download.fallbackUsed,
      downloadEvidence: publicKnowledgeDownloadEvidence(input.download),
      unitBudget: input.maxUnits,
      unitCount: input.selectedUnitCount,
      unitCounts: input.counts,
      missingUnitTypes: input.missingUnitTypes,
      compactByteLength: input.compactByteLength,
      qualityStatus: input.quality.status,
      qualityScore: input.quality.score,
      qualityWarnings: input.quality.warnings
    },
    objective: 'Review and refine compact public-reference IaC knowledge units for central-library reuse without expanding raw documentation into the artifact.',
    unitTypes: [...KNOWLEDGE_UNIT_TYPES],
    reviewChecklist: [
      'Confirm the hub coordinate matches the official source identity and artifact kind.',
      'Confirm the download trace selected extractable official or provider-repository documentation.',
      'Confirm every retained unit is supported by its sourceLocator and remains useful to an IaC editing agent.',
      'Confirm facts, guidance, examples, diagnostics, and recipes stay distinct and compact.',
      'Confirm identity-sensitive and replacement-sensitive details are prioritized over generic prose.'
    ],
    rejectionCriteria: [
      'Reject output that introduces fields, defaults, enum values, replacement behavior, or safety claims not present in the selected units.',
      'Reject output that embeds raw documentation, sensitive authentication material, or backend URLs.',
      'Reject output that changes coordinates, sourceId, sourceContentHash, privacyScope, or mutationAllowed posture without deterministic evidence.',
      'Reject output that collapses the five unit types into one prose summary.'
    ],
    constraints: [
      'Do not invent provider fields, defaults, enum values, or safety claims not supported by selected units or source locators.',
      'Keep the five unit types distinct: facts are machine-readable evidence, guidance is advisory explanation, examples are bounded edit shapes, diagnostics explain failures, and recipes are review workflows.',
      'Prefer public-reference facts and identity or replacement guidance over generic documentation sections.',
      'Preserve sourceId, sourceLocator, privacyScope, mutationAllowed=false, and public-reference storage posture.',
      'Return compact JSON that remains suitable for deterministic validation and review before publication.'
    ],
    outputContract: 'infra-agent.public-knowledge-url-report'
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
  resolution: PublicKnowledgeSourceResolution;
  source: KnowledgeSource;
  sourceId: string;
  sourceContentHash: string;
  maxUnits: number;
  download: PublicKnowledgeDownloadSummary;
  versionResolution: PublicKnowledgeVersionResolution;
  quality: PublicKnowledgeQualitySummary;
  counts: KnowledgeUnitCountByType;
  selectedUnitCount: number;
  missingUnitTypes: KnowledgeUnitType[];
  compactByteLength: number;
}): PublicKnowledgeCentralLibraryCandidate {
  const classification = libraryClassification(input.resolution, input.versionResolution);

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
    unitRef: 'report.unitsByType',
    classification,
    llmRefinementInput: llmRefinementInput({
      sourceId: input.sourceId,
      sourceContentHash: input.sourceContentHash,
      classification,
      download: input.download,
      maxUnits: input.maxUnits,
      counts: input.counts,
      selectedUnitCount: input.selectedUnitCount,
      missingUnitTypes: input.missingUnitTypes,
      compactByteLength: input.compactByteLength,
      quality: input.quality
    })
  };
}

export async function buildPublicKnowledgeUrlReport(
  options: PublicKnowledgeUrlReportOptions
): Promise<PublicKnowledgeUrlReport> {
  const maxUnits = normalizeMaxUnits(options.maxUnits);
  const resolution = publicKnowledgeSourceFromUrl(options.url);
  const { domain, source } = resolution;
  const entryResult = options.contentPath
    ? await readEntryFromContentPath({ source, contentPath: options.contentPath, now: options.now })
    : await fetchEntry({ resolution, now: options.now, fetchImpl: options.fetchImpl });
  const { entry, download } = entryResult;
  const versionResolution = await resolvePublicKnowledgeVersion({
    resolution,
    contentPath: options.contentPath,
    now: options.now,
    fetchImpl: options.fetchImpl
  });
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
    resolution,
    source,
    sourceId: entry.id,
    sourceContentHash: entry.contentHash,
    maxUnits,
    download,
    versionResolution,
    quality,
    counts,
    selectedUnitCount: selectedUnits.length,
    missingUnitTypes,
    compactByteLength
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
    download,
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

export function buildPublicKnowledgeLibraryArtifact(
  report: PublicKnowledgeUrlReport
): PublicKnowledgeLibraryArtifact {
  const unitPayloadHash = sha256Hex(JSON.stringify(report.unitsByType));
  const { centralLibraryCandidate } = report;

  return {
    kind: 'infra-agent.public-knowledge-library-artifact',
    schemaVersion: 1,
    mutationAllowed: false,
    storageScope: 'public-reference',
    privacyScope: 'public-reference',
    artifactId: centralLibraryCandidate.candidateId,
    coordinates: centralLibraryCandidate.classification.coordinates,
    sourceId: report.sourceId,
    sourceContentHash: report.sourceContentHash,
    unitPayloadHash,
    generatedFromReportKind: report.kind,
    source: centralLibraryCandidate.source,
    classification: centralLibraryCandidate.classification,
    download: report.download,
    quality: report.quality,
    summary: {
      unitCount: report.summary.includedUnitCount,
      unitCounts: report.summary.unitCounts,
      includedUnitTypes: report.summary.includedUnitTypes,
      compactByteLength: report.summary.compactByteLength
    },
    unitsByType: report.unitsByType,
    llmRefinementInput: centralLibraryCandidate.llmRefinementInput,
    publication: {
      status: 'local-artifact',
      downloadable: true,
      uploadRequired: false,
      reviewRequired: true
    }
  };
}
