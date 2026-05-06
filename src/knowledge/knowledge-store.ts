import type { KnowledgeCacheEntry, KnowledgeCacheWrite, KnowledgeSource } from '../types/knowledge.ts';
import {
  buildKnowledgeCacheId,
  isKnowledgeCacheEntryStale,
  readKnowledgeCacheEntry,
  writeKnowledgeCacheEntry
} from './cache.ts';

export interface KnowledgeStore {
  readonly root: string;
  buildId(source: KnowledgeSource): string;
  read(source: KnowledgeSource): Promise<KnowledgeCacheEntry | null>;
  write(input: KnowledgeCacheWrite): Promise<KnowledgeCacheEntry>;
  isStale(entry: KnowledgeCacheEntry, now?: Date): boolean;
}

export class FileKnowledgeStore implements KnowledgeStore {
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  buildId(source: KnowledgeSource): string {
    return buildKnowledgeCacheId(source);
  }

  read(source: KnowledgeSource): Promise<KnowledgeCacheEntry | null> {
    return readKnowledgeCacheEntry(this.root, source);
  }

  write(input: KnowledgeCacheWrite): Promise<KnowledgeCacheEntry> {
    return writeKnowledgeCacheEntry(this.root, input);
  }

  isStale(entry: KnowledgeCacheEntry, now?: Date): boolean {
    return isKnowledgeCacheEntryStale(entry, now);
  }
}

export function createFileKnowledgeStore(root: string): KnowledgeStore {
  return new FileKnowledgeStore(root);
}
