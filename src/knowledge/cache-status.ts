import type { KnowledgeStore } from './knowledge-store.ts';
import type { KnowledgeSource } from '../types/knowledge.ts';

export type KnowledgeSourceCacheStatus =
  | 'local'
  | 'missing'
  | 'fresh'
  | 'stale';

export async function resolveKnowledgeSourceCacheStatus(
  source: KnowledgeSource,
  store: KnowledgeStore,
  now?: Date
): Promise<KnowledgeSourceCacheStatus> {
  if (!source.url) {
    return 'local';
  }

  const entry = await store.read(source);
  if (!entry) {
    return 'missing';
  }

  return store.isStale(entry, now) ? 'stale' : 'fresh';
}
