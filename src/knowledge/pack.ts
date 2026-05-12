import { createHash } from 'node:crypto';
import { extractWorkspaceKnowledgeFacts, type KnowledgeExtractionOptions } from './extract.ts';
import { rankKnowledgePackFacts } from './fact-ranking.ts';
import { rankKnowledgePackUnits } from './unit-ranking.ts';
import {
  resolveKnowledgeStoragePolicy,
  summarizeKnowledgeStoragePolicies,
  type KnowledgeStoragePolicy,
  type KnowledgeStoragePolicySummary
} from './storage-policy.ts';
import type { InfraDomainId, WorkspaceInspection } from '../types/repository.ts';
import type {
  KnowledgeFact,
  KnowledgeFactExtractionMethod,
  KnowledgeFactKind,
  KnowledgeUnit,
  KnowledgeSource,
  KnowledgeSourceFingerprint,
  KnowledgeSourceStaleReason,
  KnowledgeUnitExtractionMethod,
  KnowledgeUnitPrivacyScope,
  KnowledgeUnitType,
  RetrievedContextConfidence
} from '../types/knowledge.ts';

export type KnowledgePackSourceFreshness = 'fresh' | 'stale' | 'unchecked';

export interface KnowledgePackSource {
  id: string;
  domain: InfraDomainId;
  targetPath: string;
  kind: KnowledgeSource['kind'];
  name: string;
  factCount: number;
  contentHash: string;
  fetchedAt: string | null;
  staleAfter?: string;
  stale: boolean;
  staleReason?: KnowledgeSourceStaleReason;
  freshness: KnowledgePackSourceFreshness;
  storagePolicy: KnowledgeStoragePolicy;
  fingerprintDigest?: string;
  fingerprintFileCount?: number;
  fingerprint?: KnowledgeSourceFingerprint;
}

export interface KnowledgePackFact {
  unitType?: 'fact';
  kind: KnowledgeFactKind;
  path: string;
  summary: string;
  confidence: RetrievedContextConfidence;
  extractionMethod: KnowledgeFactExtractionMethod;
  sourceId: string;
  sourceLocator: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
  values?: string[];
  relatedPaths?: string[];
}

export interface KnowledgePackUnitBase {
  unitType: KnowledgeUnitType;
  path: string;
  summary: string;
  confidence: RetrievedContextConfidence;
  extractionMethod: KnowledgeUnitExtractionMethod;
  sourceId: string;
  sourceLocator: string;
  privacyScope: KnowledgeUnitPrivacyScope;
  tokenEstimate?: number;
  relatedPaths?: string[];
}

export interface KnowledgePackFactUnit extends KnowledgePackUnitBase {
  unitType: 'fact';
  factKind: KnowledgeFactKind;
  required?: boolean;
  type?: string;
  defaultValue?: string;
  values?: string[];
}

export interface KnowledgePackGuidanceUnit extends KnowledgePackUnitBase {
  unitType: 'guidance';
  topic: string;
  appliesWhen?: string[];
  avoidWhen?: string[];
  risk?: string;
}

export interface KnowledgePackExampleUnit extends KnowledgePackUnitBase {
  unitType: 'example';
  exampleType: string;
  snippet: string;
  language?: string;
  appliesWhen?: string[];
  avoidWhen?: string[];
}

export interface KnowledgePackDiagnosticUnit extends KnowledgePackUnitBase {
  unitType: 'diagnostic';
  engine: 'terraform' | 'pulumi' | 'helm' | 'provider' | 'runtime';
  signature: string;
  likelyCause: string;
  recommendedReview: string[];
}

export interface KnowledgePackRecipeUnit extends KnowledgePackUnitBase {
  unitType: 'recipe';
  name: string;
  steps: string[];
  requiresApproval?: boolean;
  mutationAllowed: false;
}

export type KnowledgePackUnit =
  | KnowledgePackFactUnit
  | KnowledgePackGuidanceUnit
  | KnowledgePackExampleUnit
  | KnowledgePackDiagnosticUnit
  | KnowledgePackRecipeUnit;

export interface KnowledgePack {
  kind: 'infra-agent.knowledge-pack';
  schemaVersion: 1;
  mutationAllowed: false;
  packId: string;
  workspaceRoot: string;
  cacheRoot: string;
  requestedDomains: InfraDomainId[];
  targetPaths: string[];
  sourceIds: string[];
  sourceCount: number;
  factSetCount: number;
  factCount: number;
  includedFactCount: number;
  omittedFactCount: number;
  unitCount: number;
  includedUnitCount: number;
  omittedUnitCount: number;
  maxFacts: number;
  maxUnits?: number;
  staleSourceCount: number;
  storagePolicy: KnowledgeStoragePolicySummary;
  sources: KnowledgePackSource[];
  facts: KnowledgePackFact[];
  units: KnowledgePackUnit[];
}

export interface KnowledgePackOptions extends KnowledgeExtractionOptions {
  maxFacts?: number;
  maxUnits?: number;
}

function normalizeMaxUnitBudget(input: { maxFacts?: number; maxUnits?: number }): number {
  const selectedBudget = input.maxUnits ?? input.maxFacts;
  if (!Number.isInteger(selectedBudget) || selectedBudget === undefined) {
    return 80;
  }

  return Math.max(1, selectedBudget);
}

function packHash(input: {
  sources: KnowledgePackSource[];
  facts: KnowledgePackFact[];
  units: KnowledgePackUnit[];
}): string {
  return createHash('sha256')
    .update(JSON.stringify({
      sources: input.sources.map(source => ({
        id: source.id,
        contentHash: source.contentHash,
        stale: source.stale,
        staleReason: source.staleReason,
        freshness: source.freshness,
        storagePolicy: source.storagePolicy,
        fingerprintDigest: source.fingerprintDigest,
        fingerprintFileCount: source.fingerprintFileCount,
        fingerprint: source.fingerprint
      })),
      facts: input.facts.map(fact => ({
        kind: fact.kind,
        path: fact.path,
        summary: fact.summary,
        sourceId: fact.sourceId,
        sourceLocator: fact.sourceLocator
      })),
      units: input.units.map(unit => ({
        unitType: unit.unitType,
        path: unit.path,
        summary: unit.summary,
        sourceId: unit.sourceId,
        sourceLocator: unit.sourceLocator
      }))
    }))
    .digest('hex')
    .slice(0, 24);
}

function sourceFreshness(input: {
  sourceFetchedAt: string | null;
  sourceStaleAfter?: string;
  sourceStale: boolean;
  sourceFingerprint?: KnowledgeSourceFingerprint;
}): KnowledgePackSourceFreshness {
  if (input.sourceStale) {
    return 'stale';
  }

  if (input.sourceFingerprint !== undefined || input.sourceStaleAfter !== undefined || input.sourceFetchedAt !== null) {
    return 'fresh';
  }

  return 'unchecked';
}

function toPackSource(factSet: {
  sourceId: string;
  source: KnowledgeSource;
  sourceContentHash: string;
  sourceFetchedAt: string | null;
  sourceStaleAfter?: string;
  sourceStale: boolean;
  sourceStaleReason?: KnowledgeSourceStaleReason;
  sourceFingerprint?: KnowledgeSourceFingerprint;
  factCount: number;
}, sourceIndex: Map<string, { domain: InfraDomainId; targetPath: string }>): KnowledgePackSource {
  const sourceContext = sourceIndex.get(factSet.sourceId);
  const fallbackDomain: InfraDomainId = factSet.source.kind.startsWith('chart') || factSet.source.kind === 'helm-docs'
    ? 'helm'
    : factSet.source.kind === 'pulumi-docs' || factSet.source.kind === 'pulumi-config'
      ? 'pulumi'
      : 'terraform';
  return {
    id: factSet.sourceId,
    domain: sourceContext?.domain ?? fallbackDomain,
    targetPath: sourceContext?.targetPath ?? '',
    kind: factSet.source.kind,
    name: factSet.source.name,
    factCount: factSet.factCount,
    contentHash: factSet.sourceContentHash,
    fetchedAt: factSet.sourceFetchedAt,
    ...(factSet.sourceStaleAfter !== undefined ? { staleAfter: factSet.sourceStaleAfter } : {}),
    stale: factSet.sourceStale,
    ...(factSet.sourceStaleReason !== undefined ? { staleReason: factSet.sourceStaleReason } : {}),
    freshness: sourceFreshness(factSet),
    storagePolicy: resolveKnowledgeStoragePolicy(factSet.source),
    ...(factSet.sourceFingerprint !== undefined
      ? {
          fingerprintDigest: factSet.sourceFingerprint.digest,
          fingerprintFileCount: factSet.sourceFingerprint.fileCount,
          fingerprint: factSet.sourceFingerprint
        }
      : {})
  };
}

function toPackFact(fact: KnowledgeFact): KnowledgePackFact {
  const values = fact.kind === 'example' ? undefined : fact.values;
  return {
    unitType: 'fact',
    kind: fact.kind,
    path: fact.path,
    summary: fact.summary,
    confidence: fact.confidence,
    extractionMethod: fact.extractionMethod,
    sourceId: fact.source.id,
    sourceLocator: fact.source.locator,
    ...(fact.required !== undefined ? { required: fact.required } : {}),
    ...(fact.type !== undefined ? { type: fact.type } : {}),
    ...(fact.defaultValue !== undefined ? { defaultValue: fact.defaultValue } : {}),
    ...(values !== undefined ? { values } : {}),
    ...(fact.relatedPaths !== undefined ? { relatedPaths: fact.relatedPaths } : {})
  };
}

function toPackFactUnit(fact: KnowledgePackFact, source: KnowledgePackSource | undefined): KnowledgePackFactUnit {
  return {
    unitType: 'fact',
    factKind: fact.kind,
    path: fact.path,
    summary: fact.summary,
    confidence: fact.confidence,
    extractionMethod: fact.extractionMethod,
    sourceId: fact.sourceId,
    sourceLocator: fact.sourceLocator,
    privacyScope: source?.storagePolicy.scope ?? 'workspace-private',
    ...(fact.required !== undefined ? { required: fact.required } : {}),
    ...(fact.type !== undefined ? { type: fact.type } : {}),
    ...(fact.defaultValue !== undefined ? { defaultValue: fact.defaultValue } : {}),
    ...(fact.values !== undefined ? { values: [...fact.values] } : {}),
    ...(fact.relatedPaths !== undefined ? { relatedPaths: [...fact.relatedPaths] } : {})
  };
}

function toPackUnit(unit: KnowledgeUnit): KnowledgePackUnit {
  const base = {
    path: unit.path,
    summary: unit.summary,
    confidence: unit.confidence,
    extractionMethod: unit.extractionMethod,
    sourceId: unit.source.id,
    sourceLocator: unit.source.locator,
    privacyScope: unit.privacyScope,
    ...(unit.tokenEstimate !== undefined ? { tokenEstimate: unit.tokenEstimate } : {}),
    ...(unit.relatedPaths !== undefined ? { relatedPaths: [...unit.relatedPaths] } : {})
  };

  switch (unit.unitType) {
    case 'fact':
      return {
        ...base,
        unitType: 'fact',
        factKind: unit.factKind,
        ...(unit.required !== undefined ? { required: unit.required } : {}),
        ...(unit.type !== undefined ? { type: unit.type } : {}),
        ...(unit.defaultValue !== undefined ? { defaultValue: unit.defaultValue } : {}),
        ...(unit.values !== undefined ? { values: [...unit.values] } : {})
      };
    case 'guidance':
      return {
        ...base,
        unitType: 'guidance',
        topic: unit.topic,
        ...(unit.appliesWhen !== undefined ? { appliesWhen: [...unit.appliesWhen] } : {}),
        ...(unit.avoidWhen !== undefined ? { avoidWhen: [...unit.avoidWhen] } : {}),
        ...(unit.risk !== undefined ? { risk: unit.risk } : {})
      };
    case 'example':
      return {
        ...base,
        unitType: 'example',
        exampleType: unit.exampleType,
        snippet: unit.snippet,
        ...(unit.language !== undefined ? { language: unit.language } : {}),
        ...(unit.appliesWhen !== undefined ? { appliesWhen: [...unit.appliesWhen] } : {}),
        ...(unit.avoidWhen !== undefined ? { avoidWhen: [...unit.avoidWhen] } : {})
      };
    case 'diagnostic':
      return {
        ...base,
        unitType: 'diagnostic',
        engine: unit.engine,
        signature: unit.signature,
        likelyCause: unit.likelyCause,
        recommendedReview: [...unit.recommendedReview]
      };
    case 'recipe':
      return {
        ...base,
        unitType: 'recipe',
        name: unit.name,
        steps: [...unit.steps],
        ...(unit.requiresApproval !== undefined ? { requiresApproval: unit.requiresApproval } : {}),
        mutationAllowed: false
      };
  }
}

export async function buildKnowledgePack(
  inspection: WorkspaceInspection,
  options: KnowledgePackOptions = {}
): Promise<KnowledgePack> {
  const maxUnits = normalizeMaxUnitBudget(options);
  const maxFacts = maxUnits;
  const extraction = await extractWorkspaceKnowledgeFacts(inspection, options);
  const sourceIndex = new Map(extraction.sources.map(source => [
    source.id,
    {
      domain: source.domain,
      targetPath: source.targetPath
    }
  ]));
  const sources = extraction.factSets.map(factSet => toPackSource(factSet, sourceIndex));
  const storagePolicy = summarizeKnowledgeStoragePolicies(sources.map(source => source.storagePolicy));
  const allFacts = extraction.factSets.flatMap(factSet => factSet.facts.map(toPackFact));
  const rankedFacts = rankKnowledgePackFacts(allFacts, {
    sources,
    requestedDomains: extraction.requestedDomains,
    targetPaths: extraction.targetPaths
  });
  const facts = rankedFacts.slice(0, maxFacts);
  const sourceById = new Map(sources.map(source => [source.id, source]));
  const extractedUnits = extraction.unitSets.flatMap(unitSet => unitSet.units.map(toPackUnit));
  const rankedUnits = extractedUnits.length > 0
    ? rankKnowledgePackUnits(extractedUnits, {
        sources,
        requestedDomains: extraction.requestedDomains,
        targetPaths: extraction.targetPaths
      })
    : facts.map(fact => toPackFactUnit(fact, sourceById.get(fact.sourceId)));
  const units = rankedUnits.slice(0, maxUnits);

  return {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: packHash({ sources, facts, units }),
    workspaceRoot: extraction.workspaceRoot,
    cacheRoot: extraction.cacheRoot,
    requestedDomains: extraction.requestedDomains,
    targetPaths: extraction.targetPaths,
    sourceIds: extraction.sourceIds,
    sourceCount: sources.length,
    factSetCount: extraction.factSetCount,
    factCount: extraction.factCount,
    includedFactCount: facts.length,
    omittedFactCount: Math.max(0, rankedFacts.length - facts.length),
    unitCount: rankedUnits.length,
    includedUnitCount: units.length,
    omittedUnitCount: Math.max(0, rankedUnits.length - units.length),
    maxFacts,
    maxUnits,
    staleSourceCount: sources.filter(source => source.stale).length,
    storagePolicy,
    sources,
    facts,
    units
  };
}
