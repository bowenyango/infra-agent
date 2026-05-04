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
const SUPPORTED_IMPACT_RISK_LEVELS = new Set(['none', 'low', 'medium', 'high']);
const SUPPORTED_IMPACT_PRIMARY_CONCERNS = new Set([
  'none',
  'planned-changes',
  'possible-renames',
  'replacements',
  'replacement-cascades',
  'create-before-delete-conflicts'
]);
const SUPPORTED_IMPACT_RECOMMENDED_ACTIONS = new Set([
  'none',
  'review-planned-changes',
  'review-possible-renames',
  'review-replacements',
  'review-replacement-cascades',
  'review-create-before-delete-conflicts'
]);

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

function assertNonNegativeInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`infra graph input ${label} must be a non-negative integer.`);
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

function assertSummaryKindCounts(
  summary: Record<string, unknown>,
  field: string,
  items: unknown[],
  itemField: string,
  supportedValues: Set<string>
): void {
  const label = `summary.${field}`;
  const value = summary[field];
  if (!isRecord(value)) {
    throw new Error(`infra graph input ${label} must be an object.`);
  }

  const actualCounts = new Map<string, number>();
  for (const item of items) {
    if (isRecord(item)) {
      const kind = item[itemField];
      if (typeof kind !== 'string') {
        continue;
      }

      actualCounts.set(kind, (actualCounts.get(kind) ?? 0) + 1);
    }
  }

  for (const [kind, count] of Object.entries(value)) {
    if (!supportedValues.has(kind)) {
      throw new Error(`infra graph input ${label}.${kind} must be a supported graph kind.`);
    }

    assertNonNegativeInteger(count, `${label}.${kind}`);

    const actualCount = actualCounts.get(kind) ?? 0;
    if (actualCount === 0 && count !== 0) {
      throw new Error(`infra graph input ${label}.${kind} must be 0 when no matching entries are present.`);
    }
  }

  for (const [kind, actualCount] of actualCounts.entries()) {
    if (value[kind] !== actualCount) {
      throw new Error(`infra graph input ${label}.${kind} must match actual ${itemField} totals.`);
    }
  }
}

function countItemsBySource(items: unknown[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!isRecord(item) || typeof item.source !== 'string') {
      continue;
    }

    counts.set(item.source, (counts.get(item.source) ?? 0) + 1);
  }

  return counts;
}

function assertBooleanField(record: Record<string, unknown>, field: string, label: string): void {
  if (typeof record[field] !== 'boolean') {
    throw new Error(`infra graph input ${label}.${field} must be a boolean.`);
  }
}

function assertSourceProvenance(
  summary: Record<string, unknown>,
  nodes: unknown[],
  edges: unknown[]
): void {
  if (!('sourceProvenance' in summary)) {
    return;
  }

  const label = 'summary.sourceProvenance';
  const provenance = summary.sourceProvenance;
  if (!isRecord(provenance)) {
    throw new Error(`infra graph input ${label} must be an object when present.`);
  }

  if (!Array.isArray(provenance.sources)) {
    throw new Error(`infra graph input ${label}.sources must be an array.`);
  }

  assertBooleanField(provenance, 'hasWorkspaceInspection', label);
  assertBooleanField(provenance, 'hasTerraformPlan', label);
  assertBooleanField(provenance, 'hasPulumiPreview', label);

  const actualNodeCounts = countItemsBySource(nodes);
  const actualEdgeCounts = countItemsBySource(edges);
  const seenSources = new Set<string>();

  for (let index = 0; index < provenance.sources.length; index += 1) {
    const sourceEntry = provenance.sources[index];
    const sourceLabel = `${label}.sources[${index}]`;
    if (!isRecord(sourceEntry)) {
      throw new Error(`infra graph input ${sourceLabel} must be an object.`);
    }

    assertSupportedField(sourceEntry, 'source', sourceLabel, SUPPORTED_SOURCES);
    const source = sourceEntry.source as string;
    if (seenSources.has(source)) {
      throw new Error(`infra graph input ${sourceLabel}.source must not duplicate another source entry.`);
    }
    seenSources.add(source);

    assertNonNegativeInteger(sourceEntry.nodeCount, `${sourceLabel}.nodeCount`);
    assertNonNegativeInteger(sourceEntry.edgeCount, `${sourceLabel}.edgeCount`);
    assertNonNegativeInteger(sourceEntry.totalCount, `${sourceLabel}.totalCount`);

    if (sourceEntry.totalCount !== sourceEntry.nodeCount + sourceEntry.edgeCount) {
      throw new Error(`infra graph input ${sourceLabel}.totalCount must equal nodeCount + edgeCount.`);
    }

    const actualNodeCount = actualNodeCounts.get(source) ?? 0;
    const actualEdgeCount = actualEdgeCounts.get(source) ?? 0;
    if (sourceEntry.nodeCount !== actualNodeCount) {
      throw new Error(`infra graph input ${sourceLabel}.nodeCount must match actual node source totals.`);
    }

    if (sourceEntry.edgeCount !== actualEdgeCount) {
      throw new Error(`infra graph input ${sourceLabel}.edgeCount must match actual edge source totals.`);
    }
  }

  for (const source of SUPPORTED_SOURCES) {
    const actualTotal = (actualNodeCounts.get(source) ?? 0) + (actualEdgeCounts.get(source) ?? 0);
    if (actualTotal > 0 && !seenSources.has(source)) {
      throw new Error(`infra graph input ${label}.sources must include source ${source}.`);
    }
  }

  const expectedFlags = {
    hasWorkspaceInspection: ((actualNodeCounts.get('workspace-inspection') ?? 0) +
      (actualEdgeCounts.get('workspace-inspection') ?? 0)) > 0,
    hasTerraformPlan: ((actualNodeCounts.get('terraform-plan') ?? 0) +
      (actualEdgeCounts.get('terraform-plan') ?? 0)) > 0,
    hasPulumiPreview: ((actualNodeCounts.get('pulumi-preview') ?? 0) +
      (actualEdgeCounts.get('pulumi-preview') ?? 0)) > 0
  };

  for (const [field, expectedValue] of Object.entries(expectedFlags)) {
    if (provenance[field] !== expectedValue) {
      throw new Error(`infra graph input ${label}.${field} must match actual node and edge sources.`);
    }
  }
}

function assertStringArrayField(record: Record<string, unknown>, field: string, label: string): void {
  if (!Array.isArray(record[field])) {
    throw new Error(`infra graph input ${label}.${field} must be an array.`);
  }

  const values = record[field];
  for (let index = 0; index < values.length; index += 1) {
    if (typeof values[index] !== 'string') {
      throw new Error(`infra graph input ${label}.${field}[${index}] must be a string.`);
    }
  }
}

function assertImpactSummary(impact: Record<string, unknown>): void {
  const label = 'summary.impact';
  for (const field of [
    'dependencyEdges',
    'createBeforeDeleteConflicts',
    'plannedChanges',
    'possibleRenames',
    'replacementCascades'
  ]) {
    assertNumberField(impact, field, label);
  }

  if (impact.mutationAllowed !== false) {
    throw new Error('infra graph input summary.impact.mutationAllowed must be false when impact is present.');
  }

  assertSupportedField(impact, 'riskLevel', label, SUPPORTED_IMPACT_RISK_LEVELS);
  assertSupportedField(impact, 'primaryConcern', label, SUPPORTED_IMPACT_PRIMARY_CONCERNS);
  assertSupportedField(impact, 'recommendedAction', label, SUPPORTED_IMPACT_RECOMMENDED_ACTIONS);
  assertStringArrayField(impact, 'reviewSteps', label);
  assertNonNegativeInteger(impact.omittedReviewTargets, `${label}.omittedReviewTargets`);

  if (!isRecord(impact.reviewTargetBudget)) {
    throw new Error('infra graph input summary.impact.reviewTargetBudget must be an object.');
  }

  const budget = impact.reviewTargetBudget;
  for (const field of ['maxTargets', 'totalTargets', 'includedTargets', 'omittedTargets']) {
    assertNonNegativeInteger(budget[field], `${label}.reviewTargetBudget.${field}`);
  }

  if (budget.includedTargets + budget.omittedTargets !== budget.totalTargets) {
    throw new Error(
      'infra graph input summary.impact.reviewTargetBudget includedTargets + omittedTargets must equal totalTargets.'
    );
  }

  if (budget.includedTargets > budget.maxTargets) {
    throw new Error(
      'infra graph input summary.impact.reviewTargetBudget includedTargets must be less than or equal to maxTargets.'
    );
  }

  if (impact.omittedReviewTargets !== budget.omittedTargets) {
    throw new Error(
      'infra graph input summary.impact.omittedReviewTargets must match reviewTargetBudget.omittedTargets.'
    );
  }

  if ('reviewTargets' in impact && !Array.isArray(impact.reviewTargets)) {
    throw new Error('infra graph input summary.impact.reviewTargets must be an array when present.');
  }

  if (Array.isArray(impact.reviewTargets)) {
    if (budget.includedTargets !== impact.reviewTargets.length) {
      throw new Error(
        'infra graph input summary.impact.reviewTargetBudget.includedTargets must match reviewTargets.length.'
      );
    }

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
  assertSummaryKindCounts(value.summary, 'nodesByKind', value.nodes, 'kind', SUPPORTED_NODE_KINDS);
  assertSummaryKindCounts(value.summary, 'edgesByKind', value.edges, 'kind', SUPPORTED_EDGE_KINDS);
  assertSourceProvenance(value.summary, value.nodes, value.edges);

  if (value.summary.nodeCount !== value.nodes.length) {
    throw new Error('infra graph input summary.nodeCount must match nodes.length.');
  }

  if (value.summary.edgeCount !== value.edges.length) {
    throw new Error('infra graph input summary.edgeCount must match edges.length.');
  }

  if ('impact' in value.summary) {
    if (!isRecord(value.summary.impact)) {
      throw new Error('infra graph input summary.impact must be an object when present.');
    }

    assertImpactSummary(value.summary.impact);
  }

  return value as unknown as InfraGraph;
}
