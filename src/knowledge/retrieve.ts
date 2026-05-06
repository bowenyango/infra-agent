import type {
  KnowledgeCacheEntry,
  KnowledgeCacheWrite,
  KnowledgeContentType,
  KnowledgeSource,
  RetrievedContextConfidence,
  RetrievedContextPacket
} from '../types/knowledge.ts';
import { createFileKnowledgeStore, type KnowledgeStore } from './knowledge-store.ts';

export type KnowledgeFetcher = (source: KnowledgeSource) => Promise<KnowledgeCacheWrite | null>;

interface RetrieveKnowledgeContextInput {
  cacheRoot?: string;
  store?: KnowledgeStore;
  source: KnowledgeSource;
  reason: string;
  fetcher?: KnowledgeFetcher;
  now?: Date;
  maxExcerptChars?: number;
}

interface FetchResponseLike {
  ok: boolean;
  status: number;
  statusText: string;
  headers: {
    get(name: string): string | null;
  };
  text(): Promise<string>;
}

export interface FetchOfficialKnowledgeSourceOptions {
  fetchImpl?: (url: string) => Promise<FetchResponseLike>;
  fetchedAt?: string;
  staleAfter?: string;
}

function estimateTokens(value: string): number {
  return Math.ceil(value.length / 4);
}

function buildExcerpt(content: string, maxExcerptChars: number): string {
  if (content.length <= maxExcerptChars) {
    return content;
  }

  return content.slice(0, maxExcerptChars).trimEnd();
}

function buildPacket(
  entry: KnowledgeCacheEntry,
  confidence: RetrievedContextConfidence,
  reason: string,
  maxExcerptChars: number
): RetrievedContextPacket {
  const excerpt = buildExcerpt(entry.content, maxExcerptChars);
  return {
    id: entry.id,
    source: entry.source,
    confidence,
    reason,
    contentType: entry.contentType,
    excerpt,
    tokenEstimate: estimateTokens(excerpt)
  };
}

export async function retrieveKnowledgeContextPacket(
  input: RetrieveKnowledgeContextInput
): Promise<RetrievedContextPacket | null> {
  const maxExcerptChars = input.maxExcerptChars ?? 2000;
  const store = input.store ?? createFileKnowledgeStore(requireCacheRoot(input.cacheRoot));
  const cachedEntry = await store.read(input.source);

  if (cachedEntry && !store.isStale(cachedEntry, input.now)) {
    return buildPacket(cachedEntry, 'high', input.reason, maxExcerptChars);
  }

  if (input.fetcher) {
    try {
      const fetched = await input.fetcher(input.source);
      if (fetched) {
        const written = await store.write(fetched);
        return buildPacket(written, 'high', input.reason, maxExcerptChars);
      }
    } catch {
      // Fall through to stale cache fallback below. Network/doc failures should not
      // turn a cached, version-scoped context packet into a hard task failure.
    }
  }

  if (cachedEntry) {
    return buildPacket(
      cachedEntry,
      'medium',
      `${input.reason}; using stale cached context because fresh retrieval is unavailable`,
      maxExcerptChars
    );
  }

  return null;
}

function requireCacheRoot(cacheRoot: string | undefined): string {
  if (cacheRoot === undefined) {
    throw new Error('retrieveKnowledgeContextPacket requires cacheRoot when no KnowledgeStore is provided.');
  }

  return cacheRoot;
}

function normalizeContentType(contentTypeHeader: string | null): KnowledgeContentType {
  const contentType = contentTypeHeader?.toLowerCase() ?? '';

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

export async function fetchOfficialKnowledgeSource(
  source: KnowledgeSource,
  options: FetchOfficialKnowledgeSourceOptions = {}
): Promise<KnowledgeCacheWrite | null> {
  if (!source.url) {
    return null;
  }

  const fetchImpl = options.fetchImpl ?? (fetch as unknown as (url: string) => Promise<FetchResponseLike>);
  const response = await fetchImpl(source.url);

  if (!response.ok) {
    throw new Error(`Failed to fetch knowledge source ${source.url}: ${response.status} ${response.statusText}`);
  }

  const write: KnowledgeCacheWrite = {
    source,
    contentType: normalizeContentType(response.headers.get('content-type')),
    content: await response.text(),
    metadata: {
      retrieval: 'official-url'
    }
  };

  if (options.fetchedAt !== undefined) {
    write.fetchedAt = options.fetchedAt;
  }

  if (options.staleAfter !== undefined) {
    write.staleAfter = options.staleAfter;
  }

  return write;
}
