import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { KnowledgeExtractionReport } from './extract.ts';
import type { KnowledgePack } from './pack.ts';
import {
  resolveKnowledgeStoragePolicy,
  summarizeKnowledgeStoragePolicies,
  type KnowledgeStorageDefault,
  type KnowledgeStoragePolicy,
  type KnowledgeStoragePolicySummary,
  type KnowledgeStorageScope
} from './storage-policy.ts';

export type KnowledgeArtifactPayload = KnowledgeExtractionReport | KnowledgePack;
export type KnowledgeArtifactPublicationMode = 'plan-only';
export type KnowledgeArtifactBlockedSourceReason =
  | 'explicit-opt-in-required'
  | 'stale-source'
  | 'workspace-private-source';

export interface KnowledgeArtifactSourcePublicationPlan {
  sourceId: string;
  storageScope: KnowledgeStorageScope;
  stale: boolean;
  reason: KnowledgeArtifactBlockedSourceReason;
}

export interface KnowledgeArtifactManifest {
  kind: 'infra-agent.knowledge-artifact-manifest';
  schemaVersion: 1;
  mutationAllowed: false;
  manifestId: string;
  createdAt: string;
  artifact: {
    kind: KnowledgeArtifactPayload['kind'];
    id: string;
    path: string;
    sha256: string;
    sourceIds: string[];
    workspaceRoot: string;
    cacheRoot: string;
    sourceCount: number;
    factCount: number;
    staleSourceCount: number;
    storagePolicy: KnowledgeStoragePolicySummary;
  };
  publication: {
    executionMode: KnowledgeArtifactPublicationMode;
    remoteWriteAllowed: false;
    credentialRequired: false;
    uploadCommand: null;
    defaultStore: KnowledgeStorageDefault;
    shareableByDefault: boolean;
    requiresExplicitOptIn: boolean;
    publishableByDefaultSourceIds: string[];
    blockedSources: KnowledgeArtifactSourcePublicationPlan[];
    requiredValidations: string[];
    reason: string;
  };
}

export interface KnowledgeArtifactManifestOptions {
  artifactPath: string;
  artifactSha256?: string;
  createdAt?: string;
}

function sha256Json(payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

export function hashKnowledgeArtifactContent(content: string | Buffer): string {
  return createHash('sha256')
    .update(content)
    .digest('hex');
}

export async function hashKnowledgeArtifactFile(artifactPath: string): Promise<string> {
  return hashKnowledgeArtifactContent(await readFile(artifactPath));
}

function artifactStoragePolicy(payload: KnowledgeArtifactPayload): KnowledgeStoragePolicySummary {
  if (payload.kind === 'infra-agent.knowledge-pack') {
    return payload.storagePolicy;
  }

  return summarizeKnowledgeStoragePolicies(
    payload.sources.map(source => resolveKnowledgeStoragePolicy(source.source))
  );
}

function artifactSourcePolicies(payload: KnowledgeArtifactPayload): Array<{
  sourceId: string;
  stale: boolean;
  storagePolicy: KnowledgeStoragePolicy;
}> {
  if (payload.kind === 'infra-agent.knowledge-pack') {
    return payload.sources.map(source => ({
      sourceId: source.id,
      stale: source.stale,
      storagePolicy: source.storagePolicy
    }));
  }

  const staleSourceIds = new Set(
    payload.factSets
      .filter(factSet => factSet.sourceStale)
      .map(factSet => factSet.sourceId)
  );
  return payload.sources.map(source => ({
    sourceId: source.id,
    stale: staleSourceIds.has(source.id),
    storagePolicy: resolveKnowledgeStoragePolicy(source.source)
  }));
}

function artifactStaleSourceCount(payload: KnowledgeArtifactPayload): number {
  if (payload.kind === 'infra-agent.knowledge-pack') {
    return payload.staleSourceCount;
  }

  return payload.factSets.filter(factSet => factSet.sourceStale).length;
}

function artifactId(payload: KnowledgeArtifactPayload, artifactHash: string): string {
  return payload.kind === 'infra-agent.knowledge-pack'
    ? payload.packId
    : artifactHash.slice(0, 24);
}

function publicationDefaultStore(summary: KnowledgeStoragePolicySummary): KnowledgeStorageDefault {
  return summary.explicitOptInRequired > 0
    ? 'local-only'
    : 'local-or-explicit-team-cache';
}

function blockedSourceReason(input: {
  stale: boolean;
  storagePolicy: KnowledgeStoragePolicy;
}): KnowledgeArtifactBlockedSourceReason {
  if (input.stale) {
    return 'stale-source';
  }

  return input.storagePolicy.scope === 'workspace-private'
    ? 'workspace-private-source'
    : 'explicit-opt-in-required';
}

export function buildKnowledgeArtifactManifest(
  payload: KnowledgeArtifactPayload,
  options: KnowledgeArtifactManifestOptions
): KnowledgeArtifactManifest {
  const artifactHash = options.artifactSha256 ?? sha256Json(payload);
  const storagePolicy = artifactStoragePolicy(payload);
  const sourcePolicies = artifactSourcePolicies(payload);
  const requiresExplicitOptIn = storagePolicy.explicitOptInRequired > 0;
  const shareableByDefault = !requiresExplicitOptIn
    && storagePolicy.publicReference === payload.sourceCount
    && payload.sourceCount > 0;
  const defaultStore = publicationDefaultStore(storagePolicy);
  const requiredValidations = [
    `infra-agent knowledge validate ${options.artifactPath}`,
    ...(requiresExplicitOptIn
      ? ['record explicit team-cache opt-in before remote publication']
      : [])
  ];
  const publishableByDefaultSourceIds = sourcePolicies
    .filter(source => source.storagePolicy.shareableByDefault && !source.stale)
    .map(source => source.sourceId);
  const blockedSources = sourcePolicies
    .filter(source =>
      source.stale
      || source.storagePolicy.requiresExplicitOptIn
      || source.storagePolicy.scope === 'workspace-private'
    )
    .map(source => ({
      sourceId: source.sourceId,
      storageScope: source.storagePolicy.scope,
      stale: source.stale,
      reason: blockedSourceReason(source)
    }));
  const id = artifactId(payload, artifactHash);
  const createdAt = options.createdAt ?? new Date().toISOString();

  return {
    kind: 'infra-agent.knowledge-artifact-manifest',
    schemaVersion: 1,
    mutationAllowed: false,
    manifestId: sha256Json({
      artifactKind: payload.kind,
      artifactId: id,
      artifactPath: options.artifactPath,
      artifactHash
    }).slice(0, 24),
    createdAt,
    artifact: {
      kind: payload.kind,
      id,
      path: options.artifactPath,
      sha256: artifactHash,
      sourceIds: sourcePolicies.map(source => source.sourceId),
      workspaceRoot: payload.workspaceRoot,
      cacheRoot: payload.cacheRoot,
      sourceCount: payload.sourceCount,
      factCount: payload.factCount,
      staleSourceCount: artifactStaleSourceCount(payload),
      storagePolicy
    },
    publication: {
      executionMode: 'plan-only',
      remoteWriteAllowed: false,
      credentialRequired: false,
      uploadCommand: null,
      defaultStore,
      shareableByDefault,
      requiresExplicitOptIn,
      publishableByDefaultSourceIds,
      blockedSources,
      requiredValidations,
      reason: requiresExplicitOptIn
        ? 'Artifact contains workspace-private knowledge and must stay local unless a user explicitly opts into team-cache publication.'
        : 'Artifact contains public-reference knowledge that may be staged locally or in an explicit team cache after validation.'
    }
  };
}
