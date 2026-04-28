import type { ConfigSemanticFact, ConfigSemanticSource } from './config-semantics.ts';

export type KnowledgeSourceKind =
  | 'terraform-registry'
  | 'pulumi-docs'
  | 'helm-docs'
  | 'chart-docs'
  | 'provider-schema'
  | 'chart-schema'
  | 'repo-example'
  | 'module-readme';

export type KnowledgeContentType =
  | 'text/markdown'
  | 'text/plain'
  | 'application/json'
  | 'application/yaml';

export type RetrievedContextConfidence = 'low' | 'medium' | 'high';

export interface KnowledgeSource {
  kind: KnowledgeSourceKind;
  name: string;
  version?: string;
  url?: string;
  localPath?: string;
  provider?: string;
  module?: string;
  chart?: string;
  packageName?: string;
}

export interface KnowledgeCacheEntry {
  id: string;
  source: KnowledgeSource;
  contentType: KnowledgeContentType;
  content: string;
  contentHash: string;
  fetchedAt: string;
  staleAfter?: string;
  summary?: string;
  metadata?: Record<string, string>;
}

export interface KnowledgeCacheWrite {
  source: KnowledgeSource;
  contentType: KnowledgeContentType;
  content: string;
  fetchedAt?: string;
  staleAfter?: string;
  summary?: string;
  metadata?: Record<string, string>;
}

export interface ResolvedKnowledgeCacheRoot {
  root: string;
  source: 'environment: INFRA_AGENT_KNOWLEDGE_CACHE' | 'workspace-config: knowledgeCache.root' | 'default: user cache';
}

export interface RetrievedContextPacket {
  id: string;
  source: KnowledgeSource | ConfigSemanticSource;
  confidence: RetrievedContextConfidence;
  reason: string;
  contentType: KnowledgeContentType;
  excerpt?: string;
  facts?: ConfigSemanticFact[];
  tokenEstimate?: number;
}
