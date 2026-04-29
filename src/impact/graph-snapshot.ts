import type { InfraGraph, InfraGraphEdge, InfraGraphNode } from '../types/infra-graph.ts';

interface StableGraphSnapshotOptions {
  workspaceRoot?: string;
}

type Metadata = NonNullable<InfraGraphNode['metadata']>;

function sortMetadata(metadata: Metadata | undefined): Metadata | undefined {
  const entries = Object.entries(metadata ?? {})
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function sortCountMap<T extends string>(value: Partial<Record<T, number>> | undefined): Partial<Record<T, number>> | undefined {
  if (!value || Object.keys(value).length === 0) {
    return undefined;
  }

  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) as Partial<Record<T, number>>;
}

function compareNodes(left: InfraGraphNode, right: InfraGraphNode): number {
  return left.kind.localeCompare(right.kind)
    || left.id.localeCompare(right.id)
    || (left.path ?? '').localeCompare(right.path ?? '');
}

function compareEdges(left: InfraGraphEdge, right: InfraGraphEdge): number {
  return left.kind.localeCompare(right.kind)
    || left.from.localeCompare(right.from)
    || left.to.localeCompare(right.to)
    || left.id.localeCompare(right.id);
}

function stabilizeNode(node: InfraGraphNode): InfraGraphNode {
  const metadata = sortMetadata(node.metadata);
  const { metadata: _metadata, ...rest } = node;
  return metadata ? { ...rest, metadata } : rest;
}

function stabilizeEdge(edge: InfraGraphEdge): InfraGraphEdge {
  const metadata = sortMetadata(edge.metadata);
  const { metadata: _metadata, ...rest } = edge;
  return metadata ? { ...rest, metadata } : rest;
}

function stabilizeSummary(summary: InfraGraph['summary']): InfraGraph['summary'] {
  const changesByAction = sortCountMap(summary.changesByAction);
  const impact = summary.impact
    ? Object.fromEntries(Object.entries(summary.impact).sort(([left], [right]) => left.localeCompare(right))) as InfraGraph['summary']['impact']
    : undefined;

  return {
    nodeCount: summary.nodeCount,
    edgeCount: summary.edgeCount,
    nodesByKind: sortCountMap(summary.nodesByKind) ?? {},
    edgesByKind: sortCountMap(summary.edgesByKind) ?? {},
    ...(changesByAction ? { changesByAction } : {}),
    ...(impact ? { impact } : {})
  };
}

export function buildStableInfraGraphSnapshot(
  graph: InfraGraph,
  options: StableGraphSnapshotOptions = {}
): InfraGraph {
  return {
    ...graph,
    workspaceRoot: options.workspaceRoot ?? graph.workspaceRoot,
    nodes: graph.nodes.map(stabilizeNode).sort(compareNodes),
    edges: graph.edges.map(stabilizeEdge).sort(compareEdges),
    summary: stabilizeSummary(graph.summary)
  };
}
