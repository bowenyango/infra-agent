import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { cwd } from 'node:process';
import type { InfraGraph, InfraGraphImpactReviewTarget } from '../types/infra-graph.ts';
import { summarizeInfraGraphImpact } from './output.ts';
import { parseInfraGraphResult } from './infra-graph-contract.ts';

export interface InfraGraphImpactReport {
  kind: 'infra-agent.infra-graph-impact-report';
  schemaVersion: 1;
  sourceKind: InfraGraph['kind'];
  sourceSchemaVersion: InfraGraph['schemaVersion'];
  workspaceRoot: string;
  riskLevel: string;
  primaryConcern: string;
  recommendedAction: string;
  mutationAllowed: false;
  counts: {
    plannedChanges: number;
    dependencyEdges: number;
    possibleRenames: number;
    replacementCascades: number;
    createBeforeDeleteConflicts: number;
  };
  sourceProvenance: {
    sources: Array<{
      source: string;
      nodeCount: number;
      edgeCount: number;
      totalCount: number;
    }>;
    hasWorkspaceInspection: boolean;
    hasTerraformPlan: boolean;
    hasPulumiPreview: boolean;
  };
  reviewTargetCount: number;
  omittedReviewTargetCount: number;
  summary: string[];
  reviewTargets: InfraGraphImpactReviewTarget[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function assertRequiredNumberField(record: Record<string, unknown>, field: string, label: string): void {
  if (!isFiniteNumber(record[field])) {
    throw new Error(`infra graph impact report ${label}.${field} must be a finite number.`);
  }
}

function assertRequiredStringField(record: Record<string, unknown>, field: string, label: string): void {
  if (typeof record[field] !== 'string') {
    throw new Error(`infra graph impact report ${label}.${field} must be a string.`);
  }
}

function assertRequiredBooleanField(record: Record<string, unknown>, field: string, label: string): void {
  if (typeof record[field] !== 'boolean') {
    throw new Error(`infra graph impact report ${label}.${field} must be a boolean.`);
  }
}

function countEdges(graph: InfraGraph, kind: string): number {
  return graph.edges.filter(edge => edge.kind === kind).length;
}

function collectSourceProvenance(graph: InfraGraph): InfraGraphImpactReport['sourceProvenance'] {
  const sourceCounts = new Map<string, { nodeCount: number; edgeCount: number }>();

  for (const node of graph.nodes) {
    const counts = sourceCounts.get(node.source) ?? { nodeCount: 0, edgeCount: 0 };
    counts.nodeCount += 1;
    sourceCounts.set(node.source, counts);
  }

  for (const edge of graph.edges) {
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

export function buildInfraGraphImpactReport(graph: InfraGraph): InfraGraphImpactReport {
  const impact = graph.summary.impact;
  const reviewTargets = impact?.reviewTargets ?? [];

  return {
    kind: 'infra-agent.infra-graph-impact-report',
    schemaVersion: 1,
    sourceKind: graph.kind,
    sourceSchemaVersion: graph.schemaVersion,
    workspaceRoot: graph.workspaceRoot,
    riskLevel: impact?.riskLevel ?? 'none',
    primaryConcern: impact?.primaryConcern ?? 'none',
    recommendedAction: impact?.recommendedAction ?? 'none',
    mutationAllowed: false,
    counts: {
      plannedChanges: impact?.plannedChanges ?? countEdges(graph, 'planned-change'),
      dependencyEdges: impact?.dependencyEdges ?? countEdges(graph, 'depends-on'),
      possibleRenames: impact?.possibleRenames ?? countEdges(graph, 'possible-rename'),
      replacementCascades: impact?.replacementCascades ?? countEdges(graph, 'replacement-cascade'),
      createBeforeDeleteConflicts: impact?.createBeforeDeleteConflicts ?? countEdges(graph, 'create-before-delete-conflict')
    },
    sourceProvenance: collectSourceProvenance(graph),
    reviewTargetCount: reviewTargets.length,
    omittedReviewTargetCount: impact?.omittedReviewTargets ?? 0,
    summary: summarizeInfraGraphImpact(graph),
    reviewTargets
  };
}

export function parseInfraGraphImpactReport(value: unknown): InfraGraphImpactReport {
  if (!isRecord(value) || value.kind !== 'infra-agent.infra-graph-impact-report') {
    throw new Error('infra graph impact report input must be an infra-agent.infra-graph-impact-report JSON payload.');
  }

  if (value.schemaVersion !== 1) {
    throw new Error('infra graph impact report input must use schemaVersion 1.');
  }

  if (value.sourceKind !== 'infra-agent.infra-graph') {
    throw new Error('infra graph impact report sourceKind must be infra-agent.infra-graph.');
  }

  if (value.sourceSchemaVersion !== 1) {
    throw new Error('infra graph impact report sourceSchemaVersion must be 1.');
  }

  if (value.mutationAllowed !== false) {
    throw new Error('infra graph impact report mutationAllowed must be false.');
  }

  for (const field of ['workspaceRoot', 'riskLevel', 'primaryConcern', 'recommendedAction']) {
    assertRequiredStringField(value, field, 'root');
  }

  if (!isRecord(value.counts)) {
    throw new Error('infra graph impact report counts must be an object.');
  }

  for (const field of [
    'plannedChanges',
    'dependencyEdges',
    'possibleRenames',
    'replacementCascades',
    'createBeforeDeleteConflicts'
  ]) {
    assertRequiredNumberField(value.counts, field, 'counts');
  }

  if (!isRecord(value.sourceProvenance)) {
    throw new Error('infra graph impact report sourceProvenance must be an object.');
  }

  if (!Array.isArray(value.sourceProvenance.sources)) {
    throw new Error('infra graph impact report sourceProvenance.sources must be an array.');
  }

  for (const field of ['hasWorkspaceInspection', 'hasTerraformPlan', 'hasPulumiPreview']) {
    assertRequiredBooleanField(value.sourceProvenance, field, 'sourceProvenance');
  }

  for (let index = 0; index < value.sourceProvenance.sources.length; index += 1) {
    const source = value.sourceProvenance.sources[index];
    if (!isRecord(source)) {
      throw new Error(`infra graph impact report sourceProvenance.sources[${index}] must be an object.`);
    }

    assertRequiredStringField(source, 'source', `sourceProvenance.sources[${index}]`);
    for (const field of ['nodeCount', 'edgeCount', 'totalCount']) {
      assertRequiredNumberField(source, field, `sourceProvenance.sources[${index}]`);
    }
  }

  assertRequiredNumberField(value, 'reviewTargetCount', 'root');
  assertRequiredNumberField(value, 'omittedReviewTargetCount', 'root');

  if (!Array.isArray(value.summary)) {
    throw new Error('infra graph impact report summary must be an array.');
  }

  for (let index = 0; index < value.summary.length; index += 1) {
    if (typeof value.summary[index] !== 'string') {
      throw new Error(`infra graph impact report summary[${index}] must be a string.`);
    }
  }

  if (!Array.isArray(value.reviewTargets)) {
    throw new Error('infra graph impact report reviewTargets must be an array.');
  }

  for (let index = 0; index < value.reviewTargets.length; index += 1) {
    const target = value.reviewTargets[index];
    if (!isRecord(target)) {
      throw new Error(`infra graph impact report reviewTargets[${index}] must be an object.`);
    }

    if (target.mutationAllowed !== false) {
      throw new Error(`infra graph impact report reviewTargets[${index}].mutationAllowed must be false.`);
    }
  }

  return value as InfraGraphImpactReport;
}

export async function loadInfraGraphImpactReport(
  inputPath: string,
  baseDir = cwd()
): Promise<InfraGraphImpactReport> {
  const resolvedInputPath = isAbsolute(inputPath) ? inputPath : resolve(baseDir, inputPath);
  const inputContent = await readFile(resolvedInputPath, 'utf8');

  return buildInfraGraphImpactReport(parseInfraGraphResult(JSON.parse(inputContent)));
}
