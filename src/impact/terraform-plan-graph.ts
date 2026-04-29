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
  identityValues: Record<string, string>;
}

interface TerraformRenameCandidate {
  confidence: 'low' | 'medium' | 'high';
  score: number;
  matchingIdentityKeys: string[];
  reason: string;
}

interface AttachTerraformPlanOptions {
  targetPath?: string | null;
  includeNoOp?: boolean;
}

const GENERIC_IDENTITY_PATHS = [
  'name',
  'name_prefix',
  'bucket',
  'identifier',
  'cluster_identifier',
  'db_instance_identifier',
  'function_name',
  'role',
  'user',
  'group',
  'key_name',
  'repository',
  'namespace',
  'service',
  'topic',
  'queue',
  'tags.Name',
  'tags.name'
];

const RESOURCE_IDENTITY_PATHS: Record<string, string[]> = {
  aws_s3_bucket: ['bucket', 'tags.Name'],
  aws_db_instance: ['identifier', 'db_instance_identifier', 'tags.Name'],
  aws_rds_cluster: ['cluster_identifier', 'tags.Name'],
  aws_lambda_function: ['function_name', 'tags.Name'],
  aws_iam_role: ['name', 'name_prefix', 'tags.Name'],
  aws_iam_user: ['name', 'path', 'tags.Name'],
  aws_iam_group: ['name', 'path'],
  aws_security_group: ['name', 'name_prefix', 'vpc_id', 'tags.Name'],
  aws_lb: ['name', 'name_prefix', 'tags.Name'],
  aws_ecr_repository: ['name', 'repository', 'tags.Name'],
  aws_sqs_queue: ['name', 'name_prefix', 'tags.Name'],
  aws_sns_topic: ['name', 'name_prefix', 'tags.Name'],
  kubernetes_namespace: ['metadata.0.name', 'metadata.name'],
  kubernetes_service: ['metadata.0.name', 'metadata.0.namespace', 'metadata.name', 'metadata.namespace'],
  kubernetes_deployment: ['metadata.0.name', 'metadata.0.namespace', 'metadata.name', 'metadata.namespace']
};

const WEAK_IDENTITY_KEYS = new Set(['tags.Name', 'tags.name']);

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

function identityString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

function getPathValue(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => {
    if (Array.isArray(current)) {
      const index = Number(part);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (isRecord(current)) {
      return current[part];
    }

    return undefined;
  }, value);
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

function collectIdentityValues(value: unknown, resourceType: string | null): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const identityKeys = [
    ...new Set([
      ...GENERIC_IDENTITY_PATHS,
      ...(resourceType ? RESOURCE_IDENTITY_PATHS[resourceType] ?? [] : [])
    ])
  ];
  const values: Record<string, string> = {};

  for (const key of identityKeys) {
    const identityValue = identityString(getPathValue(value, key));
    if (identityValue) {
      values[key] = identityValue;
    }
  }

  return values;
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
    const type = asString(entry.type);
    const actions = asStringArray(change.actions);
    changes.push({
      address,
      mode: asString(entry.mode),
      type,
      name: asString(entry.name),
      providerName: asString(entry.provider_name),
      action: classifyTerraformActions(actions),
      actions,
      actionReason: asString(entry.action_reason),
      replacePaths: collectReplacePaths(change),
      identityValues: collectIdentityValues(change.after ?? change.before, type)
    });
  }

  return changes;
}

function edgeId(from: string, to: string): string {
  return `planned-change:${from}->${to}`;
}

function renameEdgeId(from: string, to: string): string {
  return `possible-rename:${from}->${to}`;
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
      replacePaths: change.replacePaths.join(','),
      identityKeys: Object.keys(change.identityValues).join(',')
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

function findMatchingIdentityKeys(left: TerraformResourceChange, right: TerraformResourceChange): string[] {
  return Object.entries(left.identityValues)
    .filter(([key, value]) => right.identityValues[key] === value)
    .map(([key]) => key);
}

function confidenceFromScore(score: number): TerraformRenameCandidate['confidence'] {
  if (score >= 0.85) {
    return 'high';
  }

  if (score >= 0.6) {
    return 'medium';
  }

  return 'low';
}

function buildRenameReason(params: {
  providerMatched: boolean;
  matchingIdentityKeys: string[];
  score: number;
}): string {
  return [
    'same resource type',
    params.providerMatched ? 'same provider' : 'provider unavailable on one side',
    `matching identity fields: ${params.matchingIdentityKeys.join(', ')}`,
    `score ${params.score.toFixed(2)}`
  ].join('; ');
}

function scoreRenameCandidate(
  left: TerraformResourceChange,
  right: TerraformResourceChange
): TerraformRenameCandidate | null {
  if (left.action !== 'delete' || right.action !== 'create') {
    return null;
  }

  if (!left.type || left.type !== right.type) {
    return null;
  }

  if (left.providerName && right.providerName && left.providerName !== right.providerName) {
    return null;
  }

  const matchingIdentityKeys = findMatchingIdentityKeys(left, right);
  if (matchingIdentityKeys.length === 0) {
    return null;
  }

  const strongIdentityMatches = matchingIdentityKeys.filter(key => !WEAK_IDENTITY_KEYS.has(key)).length;
  const providerMatched = Boolean(left.providerName && right.providerName && left.providerName === right.providerName);
  const score = Math.min(1, 0.35
    + (providerMatched ? 0.15 : 0.05)
    + Math.min(0.35, matchingIdentityKeys.length * 0.18)
    + Math.min(0.15, strongIdentityMatches * 0.1));

  return {
    confidence: confidenceFromScore(score),
    score,
    matchingIdentityKeys,
    reason: buildRenameReason({
      providerMatched,
      matchingIdentityKeys,
      score
    })
  };
}

function buildPossibleRenameEdges(changes: TerraformResourceChange[], edgeIds: Set<string>): InfraGraphEdge[] {
  const deletes = changes.filter(change => change.action === 'delete');
  const creates = changes.filter(change => change.action === 'create');
  const edges: InfraGraphEdge[] = [];

  for (const deleted of deletes) {
    for (const created of creates) {
      const candidate = scoreRenameCandidate(deleted, created);
      if (!candidate) {
        continue;
      }

      const from = `terraform-resource:${deleted.address}`;
      const to = `terraform-resource:${created.address}`;
      const id = renameEdgeId(from, to);
      if (edgeIds.has(id)) {
        continue;
      }

      edgeIds.add(id);
      edges.push({
        id,
        from,
        to,
        kind: 'possible-rename',
        confidence: candidate.confidence,
        source: 'terraform-plan',
        label: 'Possible Terraform address rename',
        metadata: {
          matchingIdentityKeys: candidate.matchingIdentityKeys.join(','),
          resourceType: deleted.type,
          providerName: deleted.providerName ?? created.providerName,
          score: Number(candidate.score.toFixed(2)),
          reason: candidate.reason
        }
      });
    }
  }

  return edges;
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

  edges.push(...buildPossibleRenameEdges(changes, edgeIds));

  return {
    ...graph,
    nodes,
    edges,
    summary: summarizeInfraGraph(nodes, edges)
  };
}
