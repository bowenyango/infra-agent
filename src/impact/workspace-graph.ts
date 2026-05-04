import type {
  InfraGraph,
  InfraGraphChangeAction,
  InfraGraphEdge,
  InfraGraphEdgeKind,
  InfraGraphNode,
  InfraGraphNodeKind
} from '../types/infra-graph.ts';
import type { WorkspaceInspection } from '../types/repository.ts';
import {
  INFRA_GRAPH_IMPACT_MUTATION_ALLOWED,
  INFRA_GRAPH_IMPACT_REVIEW_TARGET_LIMIT,
  buildInfraGraphImpactReviewTargets,
  countInfraGraphImpactReviewTargets,
  inferInfraGraphImpactPosture
} from './graph-impact-summary.ts';

function graphId(prefix: string, path: string): string {
  return `${prefix}:${path}`;
}

function edgeId(kind: InfraGraphEdgeKind, from: string, to: string): string {
  return `${kind}:${from}->${to}`;
}

function buildNode(params: Omit<InfraGraphNode, 'confidence' | 'source'>): InfraGraphNode {
  return {
    ...params,
    confidence: 'high',
    source: 'workspace-inspection'
  };
}

function buildEdge(params: Omit<InfraGraphEdge, 'id' | 'confidence' | 'source'>): InfraGraphEdge {
  return {
    ...params,
    id: edgeId(params.kind, params.from, params.to),
    confidence: 'high',
    source: 'workspace-inspection'
  };
}

function isGraphChangeAction(value: unknown): value is InfraGraphChangeAction {
  return value === 'create'
    || value === 'update'
    || value === 'delete'
    || value === 'replace'
    || value === 'read'
    || value === 'no-op';
}

export function summarizeInfraGraph(nodes: InfraGraphNode[], edges: InfraGraphEdge[]): InfraGraph['summary'] {
  const nodesByKind: Partial<Record<InfraGraphNodeKind, number>> = {};
  const edgesByKind: Partial<Record<InfraGraphEdgeKind, number>> = {};
  const changesByAction: Partial<Record<InfraGraphChangeAction, number>> = {};

  for (const node of nodes) {
    nodesByKind[node.kind] = (nodesByKind[node.kind] ?? 0) + 1;

    if (isGraphChangeAction(node.metadata?.action)) {
      changesByAction[node.metadata.action] = (changesByAction[node.metadata.action] ?? 0) + 1;
    }
  }

  for (const edge of edges) {
    edgesByKind[edge.kind] = (edgesByKind[edge.kind] ?? 0) + 1;
  }

  const plannedChanges = edgesByKind['planned-change'] ?? 0;
  const dependencyEdges = edgesByKind['depends-on'] ?? 0;
  const possibleRenames = edgesByKind['possible-rename'] ?? 0;
  const replacementCascades = edgesByKind['replacement-cascade'] ?? 0;
  const createBeforeDeleteConflicts = edgesByKind['create-before-delete-conflict'] ?? 0;
  const reviewTargets = buildInfraGraphImpactReviewTargets(edges);
  const totalReviewTargets = countInfraGraphImpactReviewTargets(edges);
  const impactPosture = inferInfraGraphImpactPosture({
    createBeforeDeleteConflicts,
    dependencyEdges,
    plannedChanges,
    possibleRenames,
    replacementActions: changesByAction.replace ?? 0,
    replacementCascades
  });

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodesByKind,
    edgesByKind,
    changesByAction: Object.keys(changesByAction).length > 0 ? changesByAction : undefined,
    impact: {
      dependencyEdges,
      createBeforeDeleteConflicts,
      mutationAllowed: INFRA_GRAPH_IMPACT_MUTATION_ALLOWED,
      omittedReviewTargets: Math.max(0, totalReviewTargets - reviewTargets.length),
      reviewTargetBudget: {
        maxTargets: INFRA_GRAPH_IMPACT_REVIEW_TARGET_LIMIT,
        totalTargets: totalReviewTargets,
        includedTargets: reviewTargets.length,
        omittedTargets: Math.max(0, totalReviewTargets - reviewTargets.length)
      },
      plannedChanges,
      possibleRenames,
      primaryConcern: impactPosture.primaryConcern,
      recommendedAction: impactPosture.recommendedAction,
      replacementCascades,
      reviewSteps: impactPosture.reviewSteps,
      reviewTargets,
      riskLevel: impactPosture.riskLevel
    }
  };
}

export function buildWorkspaceInfraGraph(inspection: WorkspaceInspection): InfraGraph {
  const nodes: InfraGraphNode[] = [];
  const edges: InfraGraphEdge[] = [];
  const workspaceNodeId = 'workspace';

  nodes.push(buildNode({
    id: workspaceNodeId,
    kind: 'workspace',
    label: inspection.profile.label,
    path: null,
    domain: 'workspace',
    metadata: {
      profileId: inspection.profile.id,
      helmCharts: inspection.helmCharts.length,
      pulumiProjects: inspection.pulumiProjects.length,
      terraformRoots: inspection.terraformRoots.length
    }
  }));

  for (const chart of inspection.helmCharts) {
    const chartNodeId = graphId('helm-chart', chart.chartRoot);
    nodes.push(buildNode({
      id: chartNodeId,
      kind: 'helm-chart',
      label: chart.chartName,
      path: chart.chartRoot,
      domain: 'helm',
      metadata: {
        hasValuesFile: chart.hasValuesFile,
        hasTemplatesDir: chart.hasTemplatesDir,
        environmentHints: chart.environmentHints.join(',')
      }
    }));
    edges.push(buildEdge({
      from: workspaceNodeId,
      to: chartNodeId,
      kind: 'contains',
      label: 'workspace contains Helm chart'
    }));

    if (chart.valuesSchemaFile) {
      const schemaNodeId = graphId('helm-values-schema', chart.valuesSchemaFile);
      nodes.push(buildNode({
        id: schemaNodeId,
        kind: 'helm-values-schema',
        label: 'values.schema.json',
        path: chart.valuesSchemaFile,
        domain: 'helm'
      }));
      edges.push(buildEdge({
        from: chartNodeId,
        to: schemaNodeId,
        kind: 'has-schema',
        label: 'chart values schema'
      }));
    }
  }

  for (const project of inspection.pulumiProjects) {
    const projectNodeId = graphId('pulumi-project', project.projectRoot);
    nodes.push(buildNode({
      id: projectNodeId,
      kind: 'pulumi-project',
      label: project.projectRoot,
      path: project.projectRoot,
      domain: 'pulumi',
      metadata: {
        projectFile: project.projectFile,
        stackCount: project.stackFiles.length,
        environmentHints: project.environmentHints.join(',')
      }
    }));
    edges.push(buildEdge({
      from: workspaceNodeId,
      to: projectNodeId,
      kind: 'contains',
      label: 'workspace contains Pulumi project'
    }));

    for (const stackFile of project.stackFiles) {
      const stackNodeId = graphId('pulumi-stack', stackFile);
      nodes.push(buildNode({
        id: stackNodeId,
        kind: 'pulumi-stack',
        label: stackFile,
        path: stackFile,
        domain: 'pulumi'
      }));
      edges.push(buildEdge({
        from: projectNodeId,
        to: stackNodeId,
        kind: 'configures',
        label: 'Pulumi project stack config'
      }));
    }
  }

  for (const root of inspection.terraformRoots) {
    const rootNodeId = graphId('terraform-root', root.rootPath);
    nodes.push(buildNode({
      id: rootNodeId,
      kind: 'terraform-root',
      label: root.rootPath,
      path: root.rootPath,
      domain: 'terraform',
      metadata: {
        tfFileCount: root.tfFiles.length,
        tfvarsFileCount: root.tfvarsFiles.length,
        providerSchemaFileCount: root.providerSchemaFiles.length,
        moduleHints: root.moduleHints.join(','),
        environmentHints: root.environmentHints.join(',')
      }
    }));
    edges.push(buildEdge({
      from: workspaceNodeId,
      to: rootNodeId,
      kind: 'contains',
      label: 'workspace contains Terraform root'
    }));

    for (const tfvarsFile of root.tfvarsFiles) {
      const tfvarsNodeId = graphId('terraform-tfvars', tfvarsFile);
      nodes.push(buildNode({
        id: tfvarsNodeId,
        kind: 'terraform-tfvars',
        label: tfvarsFile,
        path: tfvarsFile,
        domain: 'terraform'
      }));
      edges.push(buildEdge({
        from: rootNodeId,
        to: tfvarsNodeId,
        kind: 'configures',
        label: 'Terraform variable values'
      }));
    }
  }

  return {
    kind: 'infra-agent.infra-graph',
    schemaVersion: 1,
    mutationAllowed: INFRA_GRAPH_IMPACT_MUTATION_ALLOWED,
    workspaceRoot: inspection.workspaceRoot,
    nodes,
    edges,
    summary: summarizeInfraGraph(nodes, edges)
  };
}
