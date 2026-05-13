import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { KnowledgeCacheEntry, KnowledgeCacheWrite, KnowledgeSource } from '../types/knowledge.ts';

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeKnowledgeSource(source: KnowledgeSource): KnowledgeSource {
  const normalized: KnowledgeSource = {
    kind: source.kind,
    name: source.name
  };

  if (source.version !== undefined) {
    normalized.version = source.version;
  }

  if (source.url !== undefined) {
    normalized.url = source.url;
  }

  if (source.localPath !== undefined) {
    normalized.localPath = source.localPath;
  }

  if (source.provider !== undefined) {
    normalized.provider = source.provider;
  }

  if (source.module !== undefined) {
    normalized.module = source.module;
  }

  if (source.chart !== undefined) {
    normalized.chart = source.chart;
  }

  if (source.packageName !== undefined) {
    normalized.packageName = source.packageName;
  }

  if (source.artifactContentHash !== undefined) {
    normalized.artifactContentHash = source.artifactContentHash;
  }

  return normalized;
}

export function buildKnowledgeCacheId(source: KnowledgeSource): string {
  return sha256Hex(stableStringify(normalizeKnowledgeSource(source))).slice(0, 24);
}

export function buildKnowledgeCacheEntryPath(cacheRoot: string, source: KnowledgeSource): string {
  return join(cacheRoot, `${buildKnowledgeCacheId(source)}.json`);
}

function validateKnowledgeCacheEntry(value: unknown): KnowledgeCacheEntry | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<KnowledgeCacheEntry>;
  if (
    typeof candidate.id !== 'string'
    || typeof candidate.source !== 'object'
    || candidate.source === null
    || typeof candidate.contentType !== 'string'
    || typeof candidate.content !== 'string'
    || typeof candidate.contentHash !== 'string'
    || typeof candidate.fetchedAt !== 'string'
  ) {
    return null;
  }

  return candidate as KnowledgeCacheEntry;
}

export async function writeKnowledgeCacheEntry(
  cacheRoot: string,
  input: KnowledgeCacheWrite
): Promise<KnowledgeCacheEntry> {
  const source = normalizeKnowledgeSource(input.source);
  const entry: KnowledgeCacheEntry = {
    id: buildKnowledgeCacheId(source),
    source,
    contentType: input.contentType,
    content: input.content,
    contentHash: sha256Hex(input.content),
    fetchedAt: input.fetchedAt ?? new Date().toISOString()
  };

  if (input.staleAfter !== undefined) {
    entry.staleAfter = input.staleAfter;
  }

  if (input.fingerprint !== undefined) {
    entry.fingerprint = input.fingerprint;
  }

  if (input.summary !== undefined) {
    entry.summary = input.summary;
  }

  if (input.metadata !== undefined) {
    entry.metadata = input.metadata;
  }

  await mkdir(cacheRoot, { recursive: true });
  await writeFile(buildKnowledgeCacheEntryPath(cacheRoot, source), `${JSON.stringify(entry, null, 2)}\n`, 'utf8');

  return entry;
}

export async function readKnowledgeCacheEntry(
  cacheRoot: string,
  source: KnowledgeSource
): Promise<KnowledgeCacheEntry | null> {
  try {
    const content = await readFile(buildKnowledgeCacheEntryPath(cacheRoot, source), 'utf8');
    return validateKnowledgeCacheEntry(JSON.parse(content));
  } catch {
    return null;
  }
}

export function isKnowledgeCacheEntryStale(entry: KnowledgeCacheEntry, now: Date = new Date()): boolean {
  if (!entry.staleAfter) {
    return false;
  }

  const staleAfterTime = Date.parse(entry.staleAfter);
  if (!Number.isFinite(staleAfterTime)) {
    return true;
  }

  return staleAfterTime <= now.getTime();
}
