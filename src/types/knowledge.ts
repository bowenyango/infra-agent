import type { ConfigSemanticFact, ConfigSemanticSource } from './config-semantics.ts';

export type KnowledgeSourceKind =
  | 'terraform-registry'
  | 'pulumi-docs'
  | 'helm-docs'
  | 'chart-docs'
  | 'provider-schema'
  | 'chart-schema'
  | 'chart-lock'
  | 'repo-example'
  | 'module-readme';

export type KnowledgeContentType =
  | 'text/markdown'
  | 'text/plain'
  | 'application/json'
  | 'application/yaml';

export type RetrievedContextConfidence = 'low' | 'medium' | 'high';

export const KNOWLEDGE_FACT_KINDS = [
  'argument',
  'attribute',
  'nested-block',
  'example',
  'identity-field',
  'replacement-sensitive-field',
  'module-input',
  'module-output',
  'chart-value',
  'pulumi-config-parameter'
] as const;

export type KnowledgeFactKind = typeof KNOWLEDGE_FACT_KINDS[number];

export const KNOWLEDGE_FACT_EXTRACTION_METHODS = [
  'terraform-registry-markdown',
  'terraform-provider-schema',
  'helm-values-schema',
  'repo-local-static'
] as const;

export type KnowledgeFactExtractionMethod = typeof KNOWLEDGE_FACT_EXTRACTION_METHODS[number];

export interface KnowledgeFactSourceRef {
  id: string;
  source: KnowledgeSource;
  contentHash: string;
  locator: string;
}

export interface KnowledgeFact {
  kind: KnowledgeFactKind;
  path: string;
  summary: string;
  values?: string[];
  required?: boolean;
  type?: string;
  defaultValue?: string;
  confidence: RetrievedContextConfidence;
  extractionMethod: KnowledgeFactExtractionMethod;
  source: KnowledgeFactSourceRef;
  relatedPaths?: string[];
}

export interface KnowledgeFactSet {
  kind: 'infra-agent.knowledge-facts';
  schemaVersion: 1;
  mutationAllowed: false;
  sourceId: string;
  source: KnowledgeSource;
  sourceContentHash: string;
  sourceFetchedAt: string | null;
  sourceStaleAfter?: string;
  sourceStale: boolean;
  extractedAt: string;
  factCount: number;
  facts: KnowledgeFact[];
}

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
