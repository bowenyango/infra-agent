import type { InfraGraph, InfraGraphChangeAction, InfraGraphEdge, InfraGraphNode } from '../types/infra-graph.ts';
import {
  collectExclusiveIdentityValues,
  collectExclusiveTargetValues,
  findExclusiveIdentitySpec,
  formatExclusiveIdentityValues,
  formatExclusiveTargetValues,
  hasCompleteExclusiveIdentityMatch,
  matchingExclusiveIdentityKeys,
  type ExclusiveIdentitySpec
} from './exclusive-identity.ts';
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
  exclusiveIdentitySpec: ExclusiveIdentitySpec | null;
  exclusiveIdentityValues: Record<string, string>;
  exclusiveIdentityBefore: Record<string, string>;
  exclusiveIdentityAfter: Record<string, string>;
  exclusiveTargetBefore: Record<string, string>;
  exclusiveTargetAfter: Record<string, string>;
  dependsOn: string[];
}

interface TerraformRenameCandidate {
  confidence: 'low' | 'medium' | 'high';
  score: number;
  matchingIdentityKeys: string[];
  reason: string;
}

interface TerraformCreateBeforeDeleteConflict {
  confidence: 'medium' | 'high';
  matchingExclusiveIdentityKeys: string[];
  spec: ExclusiveIdentitySpec;
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

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function collectExpressionReferences(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectExpressionReferences);
  }

  if (!isRecord(value)) {
    return [];
  }

  return [
    ...asStringArray(value.references),
    ...Object.values(value).flatMap(collectExpressionReferences)
  ];
}

function normalizeTerraformReference(reference: string, knownAddresses: string[]): string | null {
  return knownAddresses.find(address => reference === address || reference.startsWith(`${address}.`)) ?? null;
}

function addDependency(dependencies: Map<string, Set<string>>, address: string, dependency: string | null): void {
  if (!dependency || dependency === address) {
    return;
  }

  const existing = dependencies.get(address) ?? new Set<string>();
  existing.add(dependency);
  dependencies.set(address, existing);
}

function collectTerraformModuleDependencies(
  moduleValue: unknown,
  knownAddresses: string[],
  dependencies: Map<string, Set<string>>
): void {
  if (!isRecord(moduleValue)) {
    return;
  }

  if (Array.isArray(moduleValue.resources)) {
    for (const resource of moduleValue.resources) {
      if (!isRecord(resource)) {
        continue;
      }

      const address = asString(resource.address);
      if (!address) {
        continue;
      }

      for (const dependency of asStringArray(resource.depends_on)) {
        addDependency(dependencies, address, normalizeTerraformReference(dependency, knownAddresses) ?? dependency);
      }

      for (const reference of collectExpressionReferences(resource.expressions)) {
        addDependency(dependencies, address, normalizeTerraformReference(reference, knownAddresses));
      }
    }
  }

  if (Array.isArray(moduleValue.child_modules)) {
    for (const childModule of moduleValue.child_modules) {
      collectTerraformModuleDependencies(childModule, knownAddresses, dependencies);
    }
  }

  if (isRecord(moduleValue.module_calls)) {
    for (const moduleCall of Object.values(moduleValue.module_calls)) {
      if (isRecord(moduleCall)) {
        collectTerraformModuleDependencies(moduleCall.module, knownAddresses, dependencies);
      }
    }
  }
}

function collectTerraformDependencyMap(planJson: Record<string, unknown>, knownAddresses: string[]): Map<string, string[]> {
  const dependencies = new Map<string, Set<string>>();
  const plannedValues = isRecord(planJson.planned_values) ? planJson.planned_values : null;
  const priorState = isRecord(planJson.prior_state) ? planJson.prior_state : null;
  const priorValues = isRecord(priorState?.values) ? priorState.values : null;
  const configuration = isRecord(planJson.configuration) ? planJson.configuration : null;

  collectTerraformModuleDependencies(plannedValues?.root_module, knownAddresses, dependencies);
  collectTerraformModuleDependencies(priorValues?.root_module, knownAddresses, dependencies);
  collectTerraformModuleDependencies(configuration?.root_module, knownAddresses, dependencies);

  return new Map([...dependencies.entries()].map(([address, values]) => [address, [...values]]));
}

export function parseTerraformPlanResourceChanges(planJson: unknown): TerraformResourceChange[] {
  if (!isRecord(planJson) || !Array.isArray(planJson.resource_changes)) {
    return [];
  }

  const knownAddresses = planJson.resource_changes
    .map(entry => isRecord(entry) ? asString(entry.address) : null)
    .filter((address): address is string => Boolean(address))
    .sort((left, right) => right.length - left.length);
  const dependencyMap = collectTerraformDependencyMap(planJson, knownAddresses);
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
    const exclusiveIdentitySpec = findExclusiveIdentitySpec(type, 'terraform');
    const exclusiveIdentityBefore = collectExclusiveIdentityValues(change.before, exclusiveIdentitySpec);
    const exclusiveIdentityAfter = collectExclusiveIdentityValues(change.after, exclusiveIdentitySpec);
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
      identityValues: collectIdentityValues(change.after ?? change.before, type),
      exclusiveIdentitySpec,
      exclusiveIdentityValues: Object.keys(exclusiveIdentityAfter).length > 0 ? exclusiveIdentityAfter : exclusiveIdentityBefore,
      exclusiveIdentityBefore,
      exclusiveIdentityAfter,
      exclusiveTargetBefore: collectExclusiveTargetValues(change.before, exclusiveIdentitySpec),
      exclusiveTargetAfter: collectExclusiveTargetValues(change.after, exclusiveIdentitySpec),
      dependsOn: uniqueStrings([
        ...(dependencyMap.get(address) ?? []),
        ...asStringArray(entry.depends_on)
      ]).filter(dependency => dependency !== address)
    });
  }

  return changes;
}

function edgeId(from: string, to: string): string {
  return `planned-change:${from}->${to}`;
}

function dependencyEdgeId(from: string, to: string): string {
  return `depends-on:${from}->${to}`;
}

function renameEdgeId(from: string, to: string): string {
  return `possible-rename:${from}->${to}`;
}

function cascadeEdgeId(from: string, to: string): string {
  return `replacement-cascade:${from}->${to}`;
}

function createBeforeDeleteConflictEdgeId(from: string, to: string): string {
  return `create-before-delete-conflict:${from}->${to}`;
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
      identityKeys: Object.keys(change.identityValues).join(','),
      exclusiveIdentitySpec: change.exclusiveIdentitySpec?.id ?? null,
      exclusiveIdentityKeys: Object.keys(change.exclusiveIdentityValues).join(','),
      dependsOn: change.dependsOn.join(',')
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

function buildDependencyEdges(
  changes: TerraformResourceChange[],
  edgeIds: Set<string>,
  nodeIds: Set<string>
): InfraGraphEdge[] {
  const edges: InfraGraphEdge[] = [];

  for (const change of changes) {
    const from = `terraform-resource:${change.address}`;
    if (!nodeIds.has(from)) {
      continue;
    }

    for (const dependency of change.dependsOn) {
      const to = `terraform-resource:${dependency}`;
      if (!nodeIds.has(to)) {
        continue;
      }

      const id = dependencyEdgeId(from, to);
      if (edgeIds.has(id)) {
        continue;
      }

      edgeIds.add(id);
      edges.push({
        id,
        from,
        to,
        kind: 'depends-on',
        confidence: 'high',
        source: 'terraform-plan',
        label: 'Terraform plan dependency',
        metadata: {
          dependentAction: change.action
        }
      });
    }
  }

  return edges;
}

function isCascadeSource(change: TerraformResourceChange): boolean {
  return change.action === 'replace' || change.action === 'delete';
}

function cascadeConfidence(dependency: TerraformResourceChange, dependent: TerraformResourceChange): 'medium' | 'high' {
  return dependency.action === 'replace' && dependent.action === 'replace' ? 'high' : 'medium';
}

function buildReplacementCascadeEdges(changes: TerraformResourceChange[], edgeIds: Set<string>): InfraGraphEdge[] {
  const changesByAddress = new Map(changes.map(change => [change.address, change]));
  const edges: InfraGraphEdge[] = [];

  for (const dependent of changes) {
    if (dependent.action === 'no-op') {
      continue;
    }

    for (const dependencyAddress of dependent.dependsOn) {
      const dependency = changesByAddress.get(dependencyAddress);
      if (!dependency || !isCascadeSource(dependency)) {
        continue;
      }

      const from = `terraform-resource:${dependency.address}`;
      const to = `terraform-resource:${dependent.address}`;
      const id = cascadeEdgeId(from, to);
      if (edgeIds.has(id)) {
        continue;
      }

      edgeIds.add(id);
      edges.push({
        id,
        from,
        to,
        kind: 'replacement-cascade',
        confidence: cascadeConfidence(dependency, dependent),
        source: 'terraform-plan',
        label: 'Potential Terraform replacement cascade',
        metadata: {
          dependencyAction: dependency.action,
          dependentAction: dependent.action,
          dependencyAddress: dependency.address,
          dependentAddress: dependent.address,
          reason: `${dependent.address} depends on ${dependency.address}; upstream ${dependency.action} may explain downstream ${dependent.action}`
        }
      });
    }
  }

  return edges;
}

function isCreateBeforeDeleteReplacement(change: TerraformResourceChange): boolean {
  const createIndex = change.actions.indexOf('create');
  const deleteIndex = change.actions.indexOf('delete');
  return createIndex >= 0 && deleteIndex >= 0 && createIndex < deleteIndex;
}

function scoreReplacementCreateBeforeDeleteConflict(
  change: TerraformResourceChange
): TerraformCreateBeforeDeleteConflict | null {
  if (change.action !== 'replace' || !isCreateBeforeDeleteReplacement(change) || !change.exclusiveIdentitySpec) {
    return null;
  }

  if (!hasCompleteExclusiveIdentityMatch(change.exclusiveIdentitySpec, change.exclusiveIdentityBefore, change.exclusiveIdentityAfter)) {
    return null;
  }

  const matchedKeys = matchingExclusiveIdentityKeys(change.exclusiveIdentityBefore, change.exclusiveIdentityAfter);
  return {
    confidence: 'high',
    matchingExclusiveIdentityKeys: matchedKeys,
    spec: change.exclusiveIdentitySpec,
    reason: `${change.exclusiveIdentitySpec.label} resources are exclusive by ${matchedKeys.join(', ')}; Terraform create-before-destroy replacement can fail with ${change.exclusiveIdentitySpec.conflictError}.`
  };
}

function scoreDeleteCreateExclusiveIdentityConflict(
  deleted: TerraformResourceChange,
  created: TerraformResourceChange
): TerraformCreateBeforeDeleteConflict | null {
  if (deleted.action !== 'delete' || created.action !== 'create') {
    return null;
  }

  if (!deleted.exclusiveIdentitySpec || deleted.exclusiveIdentitySpec !== created.exclusiveIdentitySpec) {
    return null;
  }

  if (!deleted.type || deleted.type !== created.type) {
    return null;
  }

  if (deleted.providerName && created.providerName && deleted.providerName !== created.providerName) {
    return null;
  }

  if (!hasCompleteExclusiveIdentityMatch(deleted.exclusiveIdentitySpec, deleted.exclusiveIdentityValues, created.exclusiveIdentityValues)) {
    return null;
  }

  const matchedKeys = matchingExclusiveIdentityKeys(deleted.exclusiveIdentityValues, created.exclusiveIdentityValues);
  return {
    confidence: 'medium',
    matchingExclusiveIdentityKeys: matchedKeys,
    spec: deleted.exclusiveIdentitySpec,
    reason: `${deleted.exclusiveIdentitySpec.label} delete/create resources share exclusive identity ${matchedKeys.join(', ')}; if Terraform schedules creation before deletion, the provider can fail with ${deleted.exclusiveIdentitySpec.conflictError}.`
  };
}

function buildCreateBeforeDeleteConflictEdges(changes: TerraformResourceChange[], edgeIds: Set<string>): InfraGraphEdge[] {
  const deletes = changes.filter(change => change.action === 'delete');
  const creates = changes.filter(change => change.action === 'create');
  const edges: InfraGraphEdge[] = [];

  for (const change of changes) {
    const conflict = scoreReplacementCreateBeforeDeleteConflict(change);
    if (!conflict) {
      continue;
    }

    const nodeId = `terraform-resource:${change.address}`;
    const id = createBeforeDeleteConflictEdgeId(nodeId, nodeId);
    if (edgeIds.has(id)) {
      continue;
    }

    edgeIds.add(id);
    edges.push({
      id,
      from: nodeId,
      to: nodeId,
      kind: 'create-before-delete-conflict',
      confidence: conflict.confidence,
      source: 'terraform-plan',
      label: 'Terraform create-before-destroy conflict risk',
      metadata: {
        actionOrder: change.actions.join(','),
        exclusiveIdentitySpec: conflict.spec.id,
        exclusiveIdentityValues: formatExclusiveIdentityValues(change.exclusiveIdentityBefore),
        matchingExclusiveIdentityKeys: conflict.matchingExclusiveIdentityKeys.join(','),
        newTargets: formatExclusiveTargetValues(change.exclusiveTargetAfter),
        oldTargets: formatExclusiveTargetValues(change.exclusiveTargetBefore),
        providerName: change.providerName,
        replacePaths: change.replacePaths.join(','),
        resourceType: change.type,
        reason: conflict.reason,
        suggestedAction: conflict.spec.suggestedAction
      }
    });
  }

  for (const deleted of deletes) {
    for (const created of creates) {
      const conflict = scoreDeleteCreateExclusiveIdentityConflict(deleted, created);
      if (!conflict) {
        continue;
      }

      const from = `terraform-resource:${deleted.address}`;
      const to = `terraform-resource:${created.address}`;
      const id = createBeforeDeleteConflictEdgeId(from, to);
      if (edgeIds.has(id)) {
        continue;
      }

      edgeIds.add(id);
      edges.push({
        id,
        from,
        to,
        kind: 'create-before-delete-conflict',
        confidence: conflict.confidence,
        source: 'terraform-plan',
        label: 'Terraform exclusive identity ordering risk',
        metadata: {
          exclusiveIdentitySpec: conflict.spec.id,
          exclusiveIdentityValues: formatExclusiveIdentityValues(deleted.exclusiveIdentityValues),
          matchingExclusiveIdentityKeys: conflict.matchingExclusiveIdentityKeys.join(','),
          newTargets: formatExclusiveTargetValues(created.exclusiveTargetAfter),
          oldTargets: formatExclusiveTargetValues(deleted.exclusiveTargetBefore),
          providerName: deleted.providerName ?? created.providerName,
          resourceType: deleted.type,
          reason: conflict.reason,
          suggestedAction: conflict.spec.suggestedAction
        }
      });
    }
  }

  return edges;
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

  edges.push(...buildDependencyEdges(changes, edgeIds, nodeIds));
  edges.push(...buildReplacementCascadeEdges(changes, edgeIds));
  edges.push(...buildCreateBeforeDeleteConflictEdges(changes, edgeIds));
  edges.push(...buildPossibleRenameEdges(changes, edgeIds));

  return {
    ...graph,
    nodes,
    edges,
    summary: summarizeInfraGraph(nodes, edges)
  };
}
