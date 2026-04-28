import type { InfraGraph, InfraGraphChangeAction, InfraGraphEdge, InfraGraphNode } from '../types/infra-graph.ts';
import { summarizeInfraGraph } from './workspace-graph.ts';

interface PulumiResourceChange {
  urn: string;
  type: string | null;
  name: string | null;
  operation: string;
  action: InfraGraphChangeAction;
  diffs: string[];
}

interface AttachPulumiPreviewOptions {
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
  if (Array.isArray(value)) {
    return value.map(asString).filter((entry): entry is string => Boolean(entry));
  }

  if (isRecord(value)) {
    return Object.keys(value);
  }

  return [];
}

function normalizePulumiOperation(operation: string | null): InfraGraphChangeAction {
  switch (operation) {
    case 'create':
      return 'create';
    case 'update':
      return 'update';
    case 'delete':
      return 'delete';
    case 'replace':
    case 'delete-replaced':
      return 'replace';
    case 'read':
    case 'read-replacement':
      return 'read';
    default:
      return 'no-op';
  }
}

function resourceNameFromUrn(urn: string): string | null {
  const parts = urn.split('::');
  return parts[parts.length - 1] ?? null;
}

function resourceTypeFromUrn(urn: string): string | null {
  const parts = urn.split('::');
  return parts.length >= 3 ? parts[parts.length - 2] ?? null : null;
}

function parsePulumiMetadata(metadata: unknown): PulumiResourceChange | null {
  if (!isRecord(metadata)) {
    return null;
  }

  const urn = asString(metadata.urn);
  if (!urn) {
    return null;
  }

  const operation = asString(metadata.op) ?? asString(metadata.operation) ?? 'same';
  return {
    urn,
    type: asString(metadata.type) ?? resourceTypeFromUrn(urn),
    name: asString(metadata.name) ?? resourceNameFromUrn(urn),
    operation,
    action: normalizePulumiOperation(operation),
    diffs: [
      ...asStringArray(metadata.diffs),
      ...asStringArray(metadata.detailedDiff)
    ].filter((entry, index, entries) => entries.indexOf(entry) === index)
  };
}

function parsePulumiStep(step: unknown): PulumiResourceChange | null {
  if (!isRecord(step)) {
    return null;
  }

  const urn = asString(step.urn);
  if (!urn) {
    return null;
  }

  const operation = asString(step.op) ?? asString(step.operation) ?? 'same';
  return {
    urn,
    type: asString(step.type) ?? resourceTypeFromUrn(urn),
    name: asString(step.name) ?? resourceNameFromUrn(urn),
    operation,
    action: normalizePulumiOperation(operation),
    diffs: asStringArray(step.diffs)
  };
}

function collectPulumiEvents(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return [];
  }

  if (Array.isArray(value.events)) {
    return value.events;
  }

  if (Array.isArray(value.steps)) {
    return value.steps;
  }

  return [value];
}

export function parsePulumiPreviewResourceChanges(previewJson: unknown): PulumiResourceChange[] {
  const changes: PulumiResourceChange[] = [];

  for (const event of collectPulumiEvents(previewJson)) {
    if (!isRecord(event)) {
      continue;
    }

    const resourcePreEvent = isRecord(event.resourcePreEvent) ? event.resourcePreEvent : null;
    const resourceOutputsEvent = isRecord(event.resOutputsEvent) ? event.resOutputsEvent : null;
    const metadata = resourcePreEvent?.metadata ?? resourceOutputsEvent?.metadata;
    const change = metadata ? parsePulumiMetadata(metadata) : parsePulumiStep(event);
    if (change) {
      changes.push(change);
    }
  }

  return changes;
}

function edgeId(from: string, to: string): string {
  return `planned-change:${from}->${to}`;
}

function findParentNodeId(graph: InfraGraph, targetPath: string | null | undefined): string {
  if (targetPath) {
    const targetNodeId = `pulumi-project:${targetPath}`;
    if (graph.nodes.some(node => node.id === targetNodeId)) {
      return targetNodeId;
    }
  }

  return graph.nodes.some(node => node.id === 'workspace') ? 'workspace' : graph.nodes[0]?.id ?? 'workspace';
}

function buildResourceNode(change: PulumiResourceChange, targetPath: string | null | undefined): InfraGraphNode {
  return {
    id: `pulumi-resource:${change.urn}`,
    kind: 'pulumi-resource',
    label: change.name ?? change.urn,
    path: targetPath ?? null,
    domain: 'pulumi',
    confidence: 'high',
    source: 'pulumi-preview',
    metadata: {
      urn: change.urn,
      action: change.action,
      operation: change.operation,
      type: change.type,
      name: change.name,
      diffs: change.diffs.join(',')
    }
  };
}

function buildChangeEdge(parentNodeId: string, resourceNodeId: string, change: PulumiResourceChange): InfraGraphEdge {
  return {
    id: edgeId(parentNodeId, resourceNodeId),
    from: parentNodeId,
    to: resourceNodeId,
    kind: 'planned-change',
    confidence: 'high',
    source: 'pulumi-preview',
    label: `Pulumi preview ${change.action}`
  };
}

export function attachPulumiPreviewToGraph(
  graph: InfraGraph,
  previewJson: unknown,
  options: AttachPulumiPreviewOptions = {}
): InfraGraph {
  const parentNodeId = findParentNodeId(graph, options.targetPath);
  const changes = parsePulumiPreviewResourceChanges(previewJson)
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
