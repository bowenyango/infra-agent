export type InfraGraphNodeKind =
  | 'workspace'
  | 'helm-chart'
  | 'helm-values-schema'
  | 'pulumi-project'
  | 'pulumi-stack'
  | 'terraform-root'
  | 'terraform-resource'
  | 'terraform-tfvars';

export type InfraGraphEdgeKind =
  | 'contains'
  | 'configures'
  | 'has-schema'
  | 'planned-change';

export type InfraGraphConfidence = 'low' | 'medium' | 'high';
export type InfraGraphSource = 'workspace-inspection' | 'terraform-plan';
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
}

export interface InfraGraphSummary {
  nodeCount: number;
  edgeCount: number;
  nodesByKind: Partial<Record<InfraGraphNodeKind, number>>;
  changesByAction?: Partial<Record<InfraGraphChangeAction, number>>;
}

export interface InfraGraph {
  kind: 'infra-agent.infra-graph';
  schemaVersion: 1;
  workspaceRoot: string;
  nodes: InfraGraphNode[];
  edges: InfraGraphEdge[];
  summary: InfraGraphSummary;
}
