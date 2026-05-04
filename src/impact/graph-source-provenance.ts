import type {
  InfraGraphEdge,
  InfraGraphNode,
  InfraGraphSource,
  InfraGraphSourceProvenance
} from '../types/infra-graph.ts';

export function collectInfraGraphSourceProvenance(
  nodes: InfraGraphNode[],
  edges: InfraGraphEdge[]
): InfraGraphSourceProvenance {
  const sourceCounts = new Map<InfraGraphSource, { nodeCount: number; edgeCount: number }>();

  for (const node of nodes) {
    const counts = sourceCounts.get(node.source) ?? { nodeCount: 0, edgeCount: 0 };
    counts.nodeCount += 1;
    sourceCounts.set(node.source, counts);
  }

  for (const edge of edges) {
    const counts = sourceCounts.get(edge.source) ?? { nodeCount: 0, edgeCount: 0 };
    counts.edgeCount += 1;
    sourceCounts.set(edge.source, counts);
  }

  const sources = Array.from(sourceCounts.entries())
    .map(([source, counts]) => ({
      source,
      nodeCount: counts.nodeCount,
      edgeCount: counts.edgeCount,
      totalCount: counts.nodeCount + counts.edgeCount
    }))
    .sort((left, right) => right.totalCount - left.totalCount || left.source.localeCompare(right.source));

  return {
    sources,
    hasWorkspaceInspection: sourceCounts.has('workspace-inspection'),
    hasTerraformPlan: sourceCounts.has('terraform-plan'),
    hasPulumiPreview: sourceCounts.has('pulumi-preview')
  };
}
