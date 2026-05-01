export type InfraGraphNodeKind =
  | 'workspace'
  | 'helm-chart'
  | 'helm-values-schema'
  | 'pulumi-project'
  | 'pulumi-resource'
  | 'pulumi-stack'
  | 'terraform-root'
  | 'terraform-resource'
  | 'terraform-tfvars';

export type InfraGraphEdgeKind =
  | 'contains'
  | 'configures'
  | 'create-before-delete-conflict'
  | 'depends-on'
  | 'has-schema'
  | 'planned-change'
  | 'possible-rename'
  | 'replacement-cascade';

export type InfraGraphConfidence = 'low' | 'medium' | 'high';
export type InfraGraphSource = 'workspace-inspection' | 'terraform-plan' | 'pulumi-preview';
export type InfraGraphChangeAction = 'create' | 'update' | 'delete' | 'replace' | 'read' | 'no-op';
export type InfraGraphImpactRiskLevel = 'none' | 'low' | 'medium' | 'high';
export type InfraGraphImpactPrimaryConcern =
  | 'none'
  | 'planned-changes'
  | 'possible-renames'
  | 'replacements'
  | 'replacement-cascades'
  | 'create-before-delete-conflicts';
export type InfraGraphImpactRecommendedAction =
  | 'none'
  | 'review-planned-changes'
  | 'review-possible-renames'
  | 'review-replacements'
  | 'review-replacement-cascades'
  | 'review-create-before-delete-conflicts';
export type InfraGraphImpactReviewTargetKind =
  | 'create-before-delete-conflict'
  | 'possible-rename'
  | 'replacement-cascade';

export interface InfraGraphImpactReviewTarget {
  edgeId: string;
  kind: InfraGraphImpactReviewTargetKind;
  from: string;
  to: string;
  confidence: InfraGraphConfidence;
  source: InfraGraphSource;
  reason?: string;
  identity?: string;
  matchingIdentityKeys?: string;
  replacementReasons?: string;
}

export interface InfraGraphNode {
  id: string;
  kind: InfraGraphNodeKind;
  label: string;
  path: string | null;
  domain: 'helm' | 'pulumi' | 'terraform' | 'workspace';
  confidence: InfraGraphConfidence;
  source: InfraGraphSource;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface InfraGraphEdge {
  id: string;
  from: string;
  to: string;
  kind: InfraGraphEdgeKind;
  confidence: InfraGraphConfidence;
  source: InfraGraphSource;
  label?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface InfraGraphSummary {
  nodeCount: number;
  edgeCount: number;
  nodesByKind: Partial<Record<InfraGraphNodeKind, number>>;
  edgesByKind: Partial<Record<InfraGraphEdgeKind, number>>;
  changesByAction?: Partial<Record<InfraGraphChangeAction, number>>;
  impact?: {
    dependencyEdges: number;
    createBeforeDeleteConflicts: number;
    mutationAllowed: boolean;
    omittedReviewTargets: number;
    plannedChanges: number;
    possibleRenames: number;
    primaryConcern: InfraGraphImpactPrimaryConcern;
    recommendedAction: InfraGraphImpactRecommendedAction;
    replacementCascades: number;
    reviewSteps: string[];
    reviewTargets: InfraGraphImpactReviewTarget[];
    riskLevel: InfraGraphImpactRiskLevel;
  };
}

export interface InfraGraph {
  kind: 'infra-agent.infra-graph';
  schemaVersion: 1;
  workspaceRoot: string;
  nodes: InfraGraphNode[];
  edges: InfraGraphEdge[];
  summary: InfraGraphSummary;
}
