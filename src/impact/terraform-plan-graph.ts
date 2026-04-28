import type { InfraGraph, InfraGraphChangeAction, InfraGraphEdge, InfraGraphNode } from '../types/infra-graph.ts';
import { summarizeInfraGraph } from './workspace-graph.ts';

interface TerraformResourceChange {
  address: string;
  mode: string | null;
  type: string | null;
  name: string | null;
  providerName: string | null;
  action: InfraGraphChangeAction;
  actions: string[];
  actionReason: string | null;
  replacePaths: string[];
}

interface AttachTerraformPlanOptions {
  targetPath?: string | null;
  includeNoOp?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(asString).filter((entry): entry is string => Boolean(entry))
    : [];
}

function classifyTerraformActions(actions: string[]): InfraGraphChangeAction {
  if (actions.includes('delete') && actions.includes('create')) {
    return 'replace';
  }

  if (actions.includes('create')) {
    return 'create';
  }

  if (actions.includes('update')) {
    return 'update';
  }

  if (actions.includes('delete')) {
    return 'delete';
  }

  if (actions.includes('read')) {
    return 'read';
  }

  return 'no-op';
}

function collectReplacePaths(change: Record<string, unknown>): string[] {
  const replacePaths = change.replace_paths;
  if (!Array.isArray(replacePaths)) {
    return [];
  }

  return replacePaths.map(path => Array.isArray(path)
    ? path.map(part => String(part)).join('.')
    : String(path)
  );
}

export function parseTerraformPlanResourceChanges(planJson: unknown): TerraformResourceChange[] {
  if (!isRecord(planJson) || !Array.isArray(planJson.resource_changes)) {
    return [];
  }

  const changes: TerraformResourceChange[] = [];

  for (const entry of planJson.resource_changes) {
    if (!isRecord(entry)) {
      continue;
    }

    const address = asString(entry.address);
    if (!address) {
      continue;
    }

    const change = isRecord(entry.change) ? entry.change : {};
    const actions = asStringArray(change.actions);
    changes.push({
      address,
      mode: asString(entry.mode),
      type: asString(entry.type),
      name: asString(entry.name),
      providerName: asString(entry.provider_name),
      action: classifyTerraformActions(actions),
      actions,
      actionReason: asString(entry.action_reason),
      replacePaths: collectReplacePaths(change)
    });
  }

  return changes;
}

function edgeId(from: string, to: string): string {
  return `planned-change:${from}->${to}`;
}

function findParentNodeId(graph: InfraGraph, targetPath: string | null | undefined): string {
  if (targetPath) {
    const targetNodeId = `terraform-root:${targetPath}`;
    if (graph.nodes.some(node => node.id === targetNodeId)) {
      return targetNodeId;
    }
  }

  return graph.nodes.some(node => node.id === 'workspace') ? 'workspace' : graph.nodes[0]?.id ?? 'workspace';
}

function buildResourceNode(change: TerraformResourceChange, targetPath: string | null | undefined): InfraGraphNode {
  return {
    id: `terraform-resource:${change.address}`,
    kind: 'terraform-resource',
    label: change.address,
    path: targetPath ?? null,
    domain: 'terraform',
    confidence: 'high',
    source: 'terraform-plan',
    metadata: {
      address: change.address,
      action: change.action,
      actions: change.actions.join(','),
      mode: change.mode,
      type: change.type,
      name: change.name,
      providerName: change.providerName,
      actionReason: change.actionReason,
      replacePaths: change.replacePaths.join(',')
    }
  };
}

function buildChangeEdge(parentNodeId: string, resourceNodeId: string, change: TerraformResourceChange): InfraGraphEdge {
  return {
    id: edgeId(parentNodeId, resourceNodeId),
    from: parentNodeId,
    to: resourceNodeId,
    kind: 'planned-change',
    confidence: 'high',
    source: 'terraform-plan',
    label: `Terraform plan ${change.action}`
  };
}

export function attachTerraformPlanToGraph(
  graph: InfraGraph,
  planJson: unknown,
  options: AttachTerraformPlanOptions = {}
): InfraGraph {
  const parentNodeId = findParentNodeId(graph, options.targetPath);
  const changes = parseTerraformPlanResourceChanges(planJson)
    .filter(change => options.includeNoOp || change.action !== 'no-op');
  const nodes = [...graph.nodes];
  const edges = [...graph.edges];
  const nodeIds = new Set(nodes.map(node => node.id));
  const edgeIds = new Set(edges.map(edge => edge.id));

  for (const change of changes) {
    const node = buildResourceNode(change, options.targetPath);
    if (!nodeIds.has(node.id)) {
      nodes.push(node);
      nodeIds.add(node.id);
    }

    const edge = buildChangeEdge(parentNodeId, node.id, change);
    if (!edgeIds.has(edge.id)) {
      edges.push(edge);
      edgeIds.add(edge.id);
    }
  }

  return {
    ...graph,
    nodes,
    edges,
    summary: summarizeInfraGraph(nodes, edges)
  };
}
