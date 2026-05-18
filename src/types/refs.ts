import type {
  ConfigSemanticConfidence,
  ConfigSemanticFactKind,
  ConfigSemanticSource,
  ConfigSemanticsTargetKind
} from './config-semantics.ts';
import type { InventoryFileReferences, InventoryTarget } from './inventory.ts';
import type { KnowledgeSourceKind } from './knowledge.ts';
import type { InfraDomainId } from './repository.ts';
import type { KnowledgeSourceCacheStatus } from '../knowledge/cache-status.ts';
import type { KnowledgeStorageScope } from '../knowledge/storage-policy.ts';

export type RefsRecommendedAction =
  | 'use-refs-for-scoped-edit'
  | 'prefetch-or-extract-knowledge'
  | 'narrow-scope';

export interface RefsReportOptions {
  scope: string;
  domains?: InfraDomainId[];
  maxUnits?: number;
}

export interface RefsTarget {
  id: string;
  domain: InfraDomainId;
  kind: InventoryTarget['kind'];
  name: string;
  path: string;
  matchReasons: string[];
  lookupIdentities: string[];
  interfaceKinds: string[];
  environmentHints: string[];
  files: InventoryFileReferences;
  validationTargets: string[];
  semanticFactCount: number;
  chartName?: string;
  resourcePackages?: string[];
  resourceTypes?: string[];
  dataSourceTypes?: string[];
  moduleHints?: string[];
}

export interface RefsReferenceSource {
  id: string;
  domain: InfraDomainId;
  targetPath: string;
  sourceKind: KnowledgeSourceKind;
  sourceName: string;
  freshness: KnowledgeSourceCacheStatus;
  requiresFetch: boolean;
  refreshRecommended: boolean;
  storageScope: KnowledgeStorageScope;
  version?: string;
  provider?: string;
  packageName?: string;
  chart?: string;
  module?: string;
}

export interface RefsFact {
  targetKind: ConfigSemanticsTargetKind;
  targetPath: string;
  kind: ConfigSemanticFactKind;
  path: string;
  summary: string;
  confidence: ConfigSemanticConfidence;
  source: ConfigSemanticSource;
  values?: string[];
  relatedPaths?: string[];
}

export interface RefsReport {
  kind: 'infra-agent.refs';
  schemaVersion: 1;
  mutationAllowed: false;
  workspaceRoot: string;
  profile: {
    id: string;
    label: string;
  };
  scope: {
    requested: string;
    normalized: string;
    matchKinds: string[];
  };
  filters: {
    domains: InfraDomainId[];
    maxUnits: number;
  };
  summary: {
    matchedTargetCount: number;
    sourceCount: number;
    includedRefCount: number;
    omittedRefCount: number;
    staleSourceCount: number;
    missingOrSkippedSourceCount: number;
    domains: InfraDomainId[];
    recommendedAction: RefsRecommendedAction;
  };
  targets: RefsTarget[];
  sources: RefsReferenceSource[];
  refs: RefsFact[];
  omitted: {
    unmatchedScope: boolean;
    filteredDomainCount: number;
    sourceCount: number;
    refCount: number;
  };
}
