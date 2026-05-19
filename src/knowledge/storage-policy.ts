import type { KnowledgeSource, KnowledgeSourceKind } from '../types/knowledge.ts';

export type KnowledgeStorageScope =
  | 'public-reference'
  | 'workspace-private';

export type KnowledgeStorageDefault =
  | 'local-or-explicit-team-cache'
  | 'local-only';

export interface KnowledgeStoragePolicy {
  scope: KnowledgeStorageScope;
  defaultStore: KnowledgeStorageDefault;
  shareableByDefault: boolean;
  requiresExplicitOptIn: boolean;
  reason: string;
}

const PUBLIC_REFERENCE_KINDS = new Set<KnowledgeSourceKind>([
  'terraform-registry',
  'pulumi-docs',
  'helm-docs',
  'chart-docs',
  'public-knowledge-library-artifact'
]);

export function isPublicReferenceCapableSourceKind(kind: KnowledgeSourceKind): boolean {
  return PUBLIC_REFERENCE_KINDS.has(kind);
}

export function isKnowledgeStoragePolicyCompatibleWithSourceKind(
  kind: KnowledgeSourceKind,
  policy: KnowledgeStoragePolicy
): boolean {
  if (policy.scope === 'public-reference') {
    return isPublicReferenceCapableSourceKind(kind)
      && policy.defaultStore === 'local-or-explicit-team-cache'
      && policy.shareableByDefault === true
      && policy.requiresExplicitOptIn === false;
  }

  return policy.scope === 'workspace-private'
    && policy.defaultStore === 'local-only'
    && policy.shareableByDefault === false
    && policy.requiresExplicitOptIn === true;
}

export function resolveKnowledgeStoragePolicy(source: KnowledgeSource): KnowledgeStoragePolicy {
  if (source.kind === 'public-knowledge-library-artifact') {
    return {
      scope: 'public-reference',
      defaultStore: 'local-or-explicit-team-cache',
      shareableByDefault: true,
      requiresExplicitOptIn: false,
      reason: 'Source is a reviewed public-reference library artifact staged for local reuse.'
    };
  }

  if (source.localPath) {
    return {
      scope: 'workspace-private',
      defaultStore: 'local-only',
      shareableByDefault: false,
      requiresExplicitOptIn: true,
      reason: 'Source is derived from workspace-local files and must not be shared without explicit opt-in.'
    };
  }

  if (PUBLIC_REFERENCE_KINDS.has(source.kind) && source.url) {
    return {
      scope: 'public-reference',
      defaultStore: 'local-or-explicit-team-cache',
      shareableByDefault: true,
      requiresExplicitOptIn: false,
      reason: 'Source points at public provider, package, or chart documentation.'
    };
  }

  return {
    scope: 'workspace-private',
    defaultStore: 'local-only',
    shareableByDefault: false,
    requiresExplicitOptIn: true,
    reason: 'Source publication posture is not known to be public.'
  };
}

export interface KnowledgeStoragePolicySummary {
  publicReference: number;
  workspacePrivate: number;
  shareableByDefault: number;
  explicitOptInRequired: number;
}

export function summarizeKnowledgeStoragePolicies(
  policies: KnowledgeStoragePolicy[]
): KnowledgeStoragePolicySummary {
  return {
    publicReference: policies.filter(policy => policy.scope === 'public-reference').length,
    workspacePrivate: policies.filter(policy => policy.scope === 'workspace-private').length,
    shareableByDefault: policies.filter(policy => policy.shareableByDefault).length,
    explicitOptInRequired: policies.filter(policy => policy.requiresExplicitOptIn).length
  };
}
