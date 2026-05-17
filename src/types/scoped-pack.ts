import type { InfraDomainId, RepoProfile } from './repository.ts';
import type { ResolvedKnowledgeCacheRoot } from './knowledge.ts';
import type { InventoryTarget } from './inventory.ts';

export interface ScopedPackOptions {
  scope: string;
  domains?: InfraDomainId[];
}

export interface ScopedPackScope {
  requested: string;
  normalized: string;
  matchKinds: string[];
}

export interface ScopedPackTarget extends InventoryTarget {
  matchReasons: string[];
}

export interface ScopedPackReport {
  kind: 'infra-agent.scoped-pack';
  schemaVersion: 1;
  mutationAllowed: false;
  workspaceRoot: string;
  profile: RepoProfile;
  scope: ScopedPackScope;
  filters: {
    domains: InfraDomainId[];
  };
  summary: {
    matchedTargetCount: number;
    domains: InfraDomainId[];
    environmentHints: string[];
    suggestedFileCount: number;
    validationTargetCount: number;
    semanticFactCount: number;
    recommendedAction: 'inspect-suggested-files' | 'narrow-scope';
  };
  targets: ScopedPackTarget[];
  suggestedFiles: string[];
  validationTargets: string[];
  knowledgeCache: ResolvedKnowledgeCacheRoot;
  omitted: {
    unmatchedScope: boolean;
    filteredDomainCount: number;
    relatedFileCount: number;
  };
}
