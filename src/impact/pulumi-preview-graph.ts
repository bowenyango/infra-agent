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

interface PulumiResourceChange {
  urn: string;
  type: string | null;
  name: string | null;
  operation: string;
  action: InfraGraphChangeAction;
  diffs: string[];
  identityValues: Record<string, string>;
  exclusiveIdentitySpec: ExclusiveIdentitySpec | null;
  exclusiveIdentityValues: Record<string, string>;
  targetValues: Record<string, string>;
  dependencyUrns: string[];
}

interface PulumiRenameCandidate {
  confidence: 'low' | 'medium' | 'high';
  score: number;
  matchingIdentityKeys: string[];
  reason: string;
}

interface PulumiCreateBeforeDeleteConflict {
  confidence: 'high';
  matchingExclusiveIdentityKeys: string[];
  spec: ExclusiveIdentitySpec;
  reason: string;
}

interface AttachPulumiPreviewOptions {
  targetPath?: string | null;
  includeNoOp?: boolean;
}

const IDENTITY_PATHS = [
  'name',
  'metadata.name',
  'metadata.namespace',
  'bucket',
  'functionName',
  'function_name',
  'role',
  'queue',
  'topic',
  'tags.Name',
  'tags.name'
];

const WEAK_IDENTITY_KEYS = new Set(['tags.Name', 'tags.name']);
const NON_RENAME_ONLY_KEYS = new Set(['metadata.namespace']);

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

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
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

function collectIdentityValues(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const values: Record<string, string> = {};
  for (const key of IDENTITY_PATHS) {
    const identityValue = identityString(getPathValue(value, key));
    if (identityValue) {
      values[key] = identityValue;
    }
  }

  return values;
}

function identitySourceForMetadata(metadata: Record<string, unknown>): unknown {
  return metadata.new ?? metadata.inputs ?? metadata.outputs ?? metadata.old;
}

function collectPropertyDependencyUrns(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }

  return Object.values(value).flatMap(asStringArray);
}

function collectPulumiDependencyUrns(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }

  return uniqueStrings([
    ...asStringArray(value.dependencies),
    ...asStringArray(value.dependencyUrns),
    ...asStringArray(value.dependencyURNs),
    ...asStringArray(value.dependsOn),
    ...asStringArray(value.depends_on),
    ...collectPropertyDependencyUrns(value.propertyDependencies)
  ]);
}

function normalizePulumiOperation(operation: string | null): InfraGraphChangeAction {
  switch (operation) {
    case 'create':
    case 'create-replacement':
      return 'create';
    case 'update':
      return 'update';
    case 'delete':
    case 'delete-replaced':
      return 'delete';
    case 'replace':
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
  const type = asString(metadata.type) ?? resourceTypeFromUrn(urn);
  const identitySource = identitySourceForMetadata(metadata);
  const exclusiveIdentitySpec = findExclusiveIdentitySpec(type, 'pulumi');
  return {
    urn,
    type,
    name: asString(metadata.name) ?? resourceNameFromUrn(urn),
    operation,
    action: normalizePulumiOperation(operation),
    diffs: [
      ...asStringArray(metadata.diffs),
      ...asStringArray(metadata.detailedDiff)
    ].filter((entry, index, entries) => entries.indexOf(entry) === index),
    identityValues: collectIdentityValues(identitySource),
    exclusiveIdentitySpec,
    exclusiveIdentityValues: collectExclusiveIdentityValues(identitySource, exclusiveIdentitySpec),
    targetValues: collectExclusiveTargetValues(identitySource, exclusiveIdentitySpec),
    dependencyUrns: collectPulumiDependencyUrns(metadata)
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
  const type = asString(step.type) ?? resourceTypeFromUrn(urn);
  const identitySource = step.new ?? step.inputs ?? step.outputs ?? step.old;
  const exclusiveIdentitySpec = findExclusiveIdentitySpec(type, 'pulumi');
  return {
    urn,
    type,
    name: asString(step.name) ?? resourceNameFromUrn(urn),
    operation,
    action: normalizePulumiOperation(operation),
    diffs: asStringArray(step.diffs),
    identityValues: collectIdentityValues(identitySource),
    exclusiveIdentitySpec,
    exclusiveIdentityValues: collectExclusiveIdentityValues(identitySource, exclusiveIdentitySpec),
    targetValues: collectExclusiveTargetValues(identitySource, exclusiveIdentitySpec),
    dependencyUrns: collectPulumiDependencyUrns(step)
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

function dependencyEdgeId(from: string, to: string): string {
  return `depends-on:${from}->${to}`;
}

function cascadeEdgeId(from: string, to: string): string {
  return `replacement-cascade:${from}->${to}`;
}

function createBeforeDeleteConflictEdgeId(from: string, to: string): string {
  return `create-before-delete-conflict:${from}->${to}`;
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
      diffs: change.diffs.join(','),
      identityKeys: Object.keys(change.identityValues).join(','),
      exclusiveIdentitySpec: change.exclusiveIdentitySpec?.id ?? null,
      exclusiveIdentityKeys: Object.keys(change.exclusiveIdentityValues).join(','),
      targetKeys: Object.keys(change.targetValues).join(','),
      dependencyUrns: change.dependencyUrns.join(',')
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

function buildDependencyEdges(
  changes: PulumiResourceChange[],
  edgeIds: Set<string>,
  nodeIds: Set<string>
): InfraGraphEdge[] {
  const edges: InfraGraphEdge[] = [];

  for (const change of changes) {
    const from = `pulumi-resource:${change.urn}`;
    if (!nodeIds.has(from)) {
      continue;
    }

    for (const dependencyUrn of change.dependencyUrns) {
      const to = `pulumi-resource:${dependencyUrn}`;
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
        source: 'pulumi-preview',
        label: 'Pulumi preview dependency',
        metadata: {
          dependentAction: change.action
        }
      });
    }
  }

  return edges;
}

function isCascadeSource(change: PulumiResourceChange): boolean {
  return change.action === 'replace' || change.action === 'delete';
}

function cascadeConfidence(dependency: PulumiResourceChange, dependent: PulumiResourceChange): 'medium' | 'high' {
  return dependency.action === 'replace' && dependent.action === 'replace' ? 'high' : 'medium';
}

function buildReplacementCascadeEdges(changes: PulumiResourceChange[], edgeIds: Set<string>): InfraGraphEdge[] {
  const changesByUrn = new Map(changes.map(change => [change.urn, change]));
  const edges: InfraGraphEdge[] = [];

  for (const dependent of changes) {
    if (dependent.action === 'no-op') {
      continue;
    }

    for (const dependencyUrn of dependent.dependencyUrns) {
      const dependency = changesByUrn.get(dependencyUrn);
      if (!dependency || !isCascadeSource(dependency)) {
        continue;
      }

      const from = `pulumi-resource:${dependency.urn}`;
      const to = `pulumi-resource:${dependent.urn}`;
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
        source: 'pulumi-preview',
        label: 'Potential Pulumi replacement cascade',
        metadata: {
          dependencyAction: dependency.action,
          dependentAction: dependent.action,
          dependencyUrn: dependency.urn,
          dependentUrn: dependent.urn,
          reason: `${dependent.urn} depends on ${dependency.urn}; upstream ${dependency.action} may explain downstream ${dependent.action}`
        }
      });
    }
  }

  return edges;
}

function scoreCreateBeforeDeleteConflict(
  left: PulumiResourceChange,
  right: PulumiResourceChange
): PulumiCreateBeforeDeleteConflict | null {
  if (left.action !== 'delete' || right.action !== 'create') {
    return null;
  }

  if (!left.exclusiveIdentitySpec || left.exclusiveIdentitySpec !== right.exclusiveIdentitySpec || left.type !== right.type) {
    return null;
  }

  if (!hasCompleteExclusiveIdentityMatch(left.exclusiveIdentitySpec, left.exclusiveIdentityValues, right.exclusiveIdentityValues)) {
    return null;
  }

  const matchedKeys = matchingExclusiveIdentityKeys(left.exclusiveIdentityValues, right.exclusiveIdentityValues);
  return {
    confidence: 'high',
    matchingExclusiveIdentityKeys: matchedKeys,
    spec: left.exclusiveIdentitySpec,
    reason: `${left.exclusiveIdentitySpec.label} resources are exclusive by ${matchedKeys.join(', ')}; Pulumi create-before-delete ordering can fail with ${left.exclusiveIdentitySpec.conflictError}.`
  };
}

function buildCreateBeforeDeleteConflictEdges(
  changes: PulumiResourceChange[],
  edgeIds: Set<string>
): InfraGraphEdge[] {
  const deletes = changes.filter(change => change.action === 'delete');
  const creates = changes.filter(change => change.action === 'create');
  const edges: InfraGraphEdge[] = [];

  for (const deleted of deletes) {
    for (const created of creates) {
      const conflict = scoreCreateBeforeDeleteConflict(deleted, created);
      if (!conflict) {
        continue;
      }

      const from = `pulumi-resource:${deleted.urn}`;
      const to = `pulumi-resource:${created.urn}`;
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
        source: 'pulumi-preview',
        label: 'Pulumi create-before-delete conflict risk',
        metadata: {
          matchingExclusiveIdentityKeys: conflict.matchingExclusiveIdentityKeys.join(','),
          resourceType: deleted.type,
          exclusiveIdentitySpec: conflict.spec.id,
          exclusiveIdentityValues: formatExclusiveIdentityValues(deleted.exclusiveIdentityValues),
          routeTableId: deleted.exclusiveIdentityValues.routeTableId,
          destinationValue: deleted.exclusiveIdentityValues.destination ?? null,
          oldTargets: formatExclusiveTargetValues(deleted.targetValues),
          newTargets: formatExclusiveTargetValues(created.targetValues),
          reason: conflict.reason,
          suggestedAction: conflict.spec.suggestedAction
        }
      });
    }
  }

  return edges;
}

function renameEdgeId(from: string, to: string): string {
  return `possible-rename:${from}->${to}`;
}

function findMatchingIdentityKeys(left: PulumiResourceChange, right: PulumiResourceChange): string[] {
  return Object.entries(left.identityValues)
    .filter(([key, value]) => right.identityValues[key] === value)
    .map(([key]) => key);
}

function confidenceFromScore(score: number): PulumiRenameCandidate['confidence'] {
  if (score >= 0.85) {
    return 'high';
  }

  if (score >= 0.6) {
    return 'medium';
  }

  return 'low';
}

function buildRenameReason(params: {
  matchingIdentityKeys: string[];
  score: number;
}): string {
  return [
    'same Pulumi resource type',
    `matching identity fields: ${params.matchingIdentityKeys.join(', ')}`,
    `score ${params.score.toFixed(2)}`
  ].join('; ');
}

function scoreRenameCandidate(
  left: PulumiResourceChange,
  right: PulumiResourceChange
): PulumiRenameCandidate | null {
  if (left.action !== 'delete' || right.action !== 'create') {
    return null;
  }

  if (!left.type || left.type !== right.type) {
    return null;
  }

  const matchingIdentityKeys = findMatchingIdentityKeys(left, right);
  if (matchingIdentityKeys.length === 0) {
    return null;
  }

  if (matchingIdentityKeys.every(key => NON_RENAME_ONLY_KEYS.has(key))) {
    return null;
  }

  const strongIdentityMatches = matchingIdentityKeys.filter(key => !WEAK_IDENTITY_KEYS.has(key)).length;
  const score = Math.min(1, 0.45
    + Math.min(0.35, matchingIdentityKeys.length * 0.18)
    + Math.min(0.2, strongIdentityMatches * 0.1));

  return {
    confidence: confidenceFromScore(score),
    score,
    matchingIdentityKeys,
    reason: buildRenameReason({
      matchingIdentityKeys,
      score
    })
  };
}

function buildPossibleRenameEdges(changes: PulumiResourceChange[], edgeIds: Set<string>): InfraGraphEdge[] {
  const deletes = changes.filter(change => change.action === 'delete');
  const creates = changes.filter(change => change.action === 'create');
  const edges: InfraGraphEdge[] = [];

  for (const deleted of deletes) {
    for (const created of creates) {
      const candidate = scoreRenameCandidate(deleted, created);
      if (!candidate) {
        continue;
      }

      const from = `pulumi-resource:${deleted.urn}`;
      const to = `pulumi-resource:${created.urn}`;
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
        source: 'pulumi-preview',
        label: 'Possible Pulumi resource rename',
        metadata: {
          matchingIdentityKeys: candidate.matchingIdentityKeys.join(','),
          resourceType: deleted.type,
          score: Number(candidate.score.toFixed(2)),
          reason: candidate.reason
        }
      });
    }
  }

  return edges;
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
