import type { ConfigSemanticFact, ConfigSemanticSource } from './config-semantics.ts';

export type KnowledgeSourceKind =
  | 'terraform-registry'
  | 'pulumi-docs'
  | 'helm-docs'
  | 'chart-docs'
  | 'chart-metadata'
  | 'provider-schema'
  | 'chart-schema'
  | 'chart-lock'
  | 'repo-example'
  | 'pulumi-config'
  | 'pulumi-component'
  | 'terraform-module'
  | 'module-readme'
  | 'internal-knowledge'
  | 'knowledge-unit-registry'
  | 'knowledge-unit-artifact';

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
  'chart-metadata',
  'chart-dependency',
  'chart-value',
  'pulumi-config-parameter',
  'pulumi-component-input',
  'pulumi-component-child-resource',
  'pulumi-component-output',
  'pulumi-docs-guidance'
] as const;

export type KnowledgeFactKind = typeof KNOWLEDGE_FACT_KINDS[number];

export const KNOWLEDGE_FACT_EXTRACTION_METHODS = [
  'terraform-registry-markdown',
  'pulumi-docs-markdown',
  'helm-chart-docs-markdown',
  'terraform-provider-schema',
  'helm-values-schema',
  'repo-local-static'
] as const;

export type KnowledgeFactExtractionMethod = typeof KNOWLEDGE_FACT_EXTRACTION_METHODS[number];

export const KNOWLEDGE_UNIT_EXTRACTION_METHODS = [
  ...KNOWLEDGE_FACT_EXTRACTION_METHODS,
  'official-guidance',
  'repo-local-guidance',
  'official-example',
  'repo-local-example',
  'validation-diagnostic',
  'terraform-plan-diagnostic',
  'pulumi-preview-diagnostic',
  'provider-diagnostic',
  'workflow-recipe'
] as const;

export type KnowledgeUnitExtractionMethod = typeof KNOWLEDGE_UNIT_EXTRACTION_METHODS[number];

export const KNOWLEDGE_UNIT_TYPES = [
  'fact',
  'guidance',
  'example',
  'diagnostic',
  'recipe'
] as const;

export type KnowledgeUnitType = typeof KNOWLEDGE_UNIT_TYPES[number];
export type KnowledgeUnitPrivacyScope =
  | 'public-reference'
  | 'workspace-private'
  | 'internal-team'
  | 'private-run';

export interface KnowledgeFactSourceRef {
  id: string;
  source: KnowledgeSource;
  contentHash: string;
  locator: string;
}

export type KnowledgeSourceStaleReason =
  | 'time-expired'
  | 'local-file-hash-mismatch'
  | 'local-file-missing';

export interface KnowledgeSourceFileFingerprint {
  path: string;
  contentHash: string;
  stale?: boolean;
}

export interface KnowledgeSourceFingerprint {
  algorithm: 'sha256';
  digest: string;
  fileCount: number;
  files: KnowledgeSourceFileFingerprint[];
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

export interface KnowledgeUnitBase {
  unitType: KnowledgeUnitType;
  path: string;
  summary: string;
  confidence: RetrievedContextConfidence;
  extractionMethod: KnowledgeUnitExtractionMethod;
  source: KnowledgeFactSourceRef;
  privacyScope: KnowledgeUnitPrivacyScope;
  tokenEstimate?: number;
  relatedPaths?: string[];
}

export interface KnowledgeFactUnit extends KnowledgeUnitBase {
  unitType: 'fact';
  factKind: KnowledgeFactKind;
  values?: string[];
  required?: boolean;
  type?: string;
  defaultValue?: string;
}

export interface KnowledgeGuidanceUnit extends KnowledgeUnitBase {
  unitType: 'guidance';
  topic: string;
  appliesWhen?: string[];
  avoidWhen?: string[];
  risk?: string;
}

export interface KnowledgeExampleUnit extends KnowledgeUnitBase {
  unitType: 'example';
  exampleType: string;
  snippet: string;
  language?: string;
  appliesWhen?: string[];
  avoidWhen?: string[];
}

export interface KnowledgeDiagnosticUnit extends KnowledgeUnitBase {
  unitType: 'diagnostic';
  engine: 'terraform' | 'pulumi' | 'helm' | 'provider' | 'runtime';
  signature: string;
  likelyCause: string;
  recommendedReview: string[];
}

export interface KnowledgeRecipeUnit extends KnowledgeUnitBase {
  unitType: 'recipe';
  name: string;
  steps: string[];
  requiresApproval?: boolean;
  mutationAllowed: false;
}

export type KnowledgeUnit =
  | KnowledgeFactUnit
  | KnowledgeGuidanceUnit
  | KnowledgeExampleUnit
  | KnowledgeDiagnosticUnit
  | KnowledgeRecipeUnit;

export interface KnowledgeUnitSet {
  kind: 'infra-agent.knowledge-units';
  schemaVersion: 1;
  mutationAllowed: false;
  sourceId: string;
  source: KnowledgeSource;
  sourceContentHash: string;
  extractedAt: string;
  unitCount: number;
  units: KnowledgeUnit[];
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
  sourceStaleReason?: KnowledgeSourceStaleReason;
  sourceFingerprint?: KnowledgeSourceFingerprint;
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
  artifactContentHash?: string;
}

export interface KnowledgeCacheEntry {
  id: string;
  source: KnowledgeSource;
  contentType: KnowledgeContentType;
  content: string;
  contentHash: string;
  fetchedAt: string;
  staleAfter?: string;
  fingerprint?: KnowledgeSourceFingerprint;
  summary?: string;
  metadata?: Record<string, string>;
}

export interface KnowledgeCacheWrite {
  source: KnowledgeSource;
  contentType: KnowledgeContentType;
  content: string;
  fetchedAt?: string;
  staleAfter?: string;
  fingerprint?: KnowledgeSourceFingerprint;
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
