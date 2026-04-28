export type InfraGraphNodeKind =
  | 'workspace'
  | 'helm-chart'
  | 'helm-values-schema'
  | 'pulumi-project'
  | 'pulumi-stack'
  | 'terraform-root'
  | 'terraform-tfvars';

export type InfraGraphEdgeKind =
  | 'contains'
  | 'configures'
  | 'has-schema';

export type InfraGraphConfidence = 'low' | 'medium' | 'high';

export interface InfraGraphNode {
  id: string;
  kind: InfraGraphNodeKind;
  label: string;
  path: string | null;
  domain: 'helm' | 'pulumi' | 'terraform' | 'workspace';
  confidence: InfraGraphConfidence;
  source: 'workspace-inspection';
  metadata?: Record<string, string | number | boolean | null>;
}

export interface InfraGraphEdge {
  id: string;
  from: string;
  to: string;
  kind: InfraGraphEdgeKind;
  confidence: InfraGraphConfidence;
  source: 'workspace-inspection';
  label?: string;
}

export interface InfraGraphSummary {
  nodeCount: number;
  edgeCount: number;
  nodesByKind: Partial<Record<InfraGraphNodeKind, number>>;
}

export interface InfraGraph {
  kind: 'infra-agent.infra-graph';
  schemaVersion: 1;
  workspaceRoot: string;
  nodes: InfraGraphNode[];
  edges: InfraGraphEdge[];
  summary: InfraGraphSummary;
}
