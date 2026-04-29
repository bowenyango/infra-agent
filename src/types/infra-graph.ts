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
    plannedChanges: number;
    possibleRenames: number;
    replacementCascades: number;
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
