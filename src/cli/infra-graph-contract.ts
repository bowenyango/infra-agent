import type { InfraGraph } from '../types/infra-graph.ts';

const SUPPORTED_NODE_KINDS = new Set([
  'workspace',
  'helm-chart',
  'helm-values-schema',
  'pulumi-project',
  'pulumi-resource',
  'pulumi-stack',
  'terraform-root',
  'terraform-resource',
  'terraform-tfvars'
]);

const SUPPORTED_EDGE_KINDS = new Set([
  'contains',
  'configures',
  'create-before-delete-conflict',
  'depends-on',
  'has-schema',
  'planned-change',
  'possible-rename',
  'replacement-cascade'
]);

const SUPPORTED_DOMAINS = new Set(['helm', 'pulumi', 'terraform', 'workspace']);
const SUPPORTED_CONFIDENCES = new Set(['low', 'medium', 'high']);
const SUPPORTED_SOURCES = new Set(['workspace-inspection', 'terraform-plan', 'pulumi-preview']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function assertNumberField(record: Record<string, unknown>, field: string, label: string): void {
  if (field in record && !isNumber(record[field])) {
    throw new Error(`infra graph input ${label}.${field} must be a finite number when present.`);
  }
}

function assertStringField(record: Record<string, unknown>, field: string, label: string): void {
  if (typeof record[field] !== 'string') {
    throw new Error(`infra graph input ${label}.${field} must be a string.`);
  }
}

function assertSupportedField(
  record: Record<string, unknown>,
  field: string,
  label: string,
  supportedValues: Set<string>
): void {
  if (typeof record[field] !== 'string' || !supportedValues.has(record[field])) {
    throw new Error(`infra graph input ${label}.${field} must be a supported value.`);
  }
}

function assertNodeShape(node: unknown, index: number): void {
  const label = `nodes[${index}]`;
  if (!isRecord(node)) {
    throw new Error(`infra graph input ${label} must be an object.`);
  }

  assertStringField(node, 'id', label);
  assertStringField(node, 'label', label);
  assertSupportedField(node, 'kind', label, SUPPORTED_NODE_KINDS);
  if (typeof node.path !== 'string' && node.path !== null) {
    throw new Error(`infra graph input ${label}.path must be a string or null.`);
  }
  assertSupportedField(node, 'domain', label, SUPPORTED_DOMAINS);
  assertSupportedField(node, 'confidence', label, SUPPORTED_CONFIDENCES);
  assertSupportedField(node, 'source', label, SUPPORTED_SOURCES);
}

function assertEdgeShape(edge: unknown, index: number): void {
  const label = `edges[${index}]`;
  if (!isRecord(edge)) {
    throw new Error(`infra graph input ${label} must be an object.`);
  }

  assertStringField(edge, 'id', label);
  assertStringField(edge, 'from', label);
  assertStringField(edge, 'to', label);
  assertSupportedField(edge, 'kind', label, SUPPORTED_EDGE_KINDS);
  assertSupportedField(edge, 'confidence', label, SUPPORTED_CONFIDENCES);
  assertSupportedField(edge, 'source', label, SUPPORTED_SOURCES);
  if ('label' in edge && typeof edge.label !== 'string') {
    throw new Error(`infra graph input ${label}.label must be a string when present.`);
  }
}

export function parseInfraGraphResult(value: unknown): InfraGraph {
  if (!isRecord(value) || value.kind !== 'infra-agent.infra-graph') {
    throw new Error('infra graph input must be an infra-agent.infra-graph JSON payload.');
  }

  if (value.schemaVersion !== 1) {
    throw new Error('infra graph input must use infra graph schemaVersion 1.');
  }

  if (value.mutationAllowed !== false) {
    throw new Error('infra graph input mutationAllowed must be false.');
  }

  if (typeof value.workspaceRoot !== 'string') {
    throw new Error('infra graph input workspaceRoot must be a string.');
  }

  if (!Array.isArray(value.nodes)) {
    throw new Error('infra graph input must include nodes array.');
  }

  if (!Array.isArray(value.edges)) {
    throw new Error('infra graph input must include edges array.');
  }

  for (let index = 0; index < value.nodes.length; index += 1) {
    assertNodeShape(value.nodes[index], index);
  }

  for (let index = 0; index < value.edges.length; index += 1) {
    assertEdgeShape(value.edges[index], index);
  }

  if (!isRecord(value.summary)) {
    throw new Error('infra graph input must include summary object.');
  }

  assertNumberField(value.summary, 'nodeCount', 'summary');
  assertNumberField(value.summary, 'edgeCount', 'summary');

  if (value.summary.nodeCount !== value.nodes.length) {
    throw new Error('infra graph input summary.nodeCount must match nodes.length.');
  }

  if (value.summary.edgeCount !== value.edges.length) {
    throw new Error('infra graph input summary.edgeCount must match edges.length.');
  }

  if (isRecord(value.summary.impact)) {
    const impact = value.summary.impact;
    for (const field of [
      'dependencyEdges',
      'createBeforeDeleteConflicts',
      'omittedReviewTargets',
      'plannedChanges',
      'possibleRenames',
      'replacementCascades'
    ]) {
      assertNumberField(impact, field, 'summary.impact');
    }

    if (impact.mutationAllowed !== false) {
      throw new Error('infra graph input summary.impact.mutationAllowed must be false when impact is present.');
    }

    if (isRecord(impact.reviewTargetBudget)) {
      for (const field of ['maxTargets', 'totalTargets', 'includedTargets', 'omittedTargets']) {
        assertNumberField(impact.reviewTargetBudget, field, 'summary.impact.reviewTargetBudget');
      }
    }

    if ('reviewTargets' in impact && !Array.isArray(impact.reviewTargets)) {
      throw new Error('infra graph input summary.impact.reviewTargets must be an array when present.');
    }

    if (Array.isArray(impact.reviewTargets)) {
      for (let index = 0; index < impact.reviewTargets.length; index += 1) {
        const target = impact.reviewTargets[index];
        if (!isRecord(target)) {
          throw new Error(`infra graph input summary.impact.reviewTargets[${index}] must be an object.`);
        }

        if (target.mutationAllowed !== false) {
          throw new Error(`infra graph input summary.impact.reviewTargets[${index}].mutationAllowed must be false.`);
        }
      }
    }
  }

  return value as unknown as InfraGraph;
}
