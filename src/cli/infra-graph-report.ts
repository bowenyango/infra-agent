import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { cwd } from 'node:process';
import type { InfraGraph, InfraGraphImpactReviewTarget } from '../types/infra-graph.ts';
import { summarizeInfraGraphImpact } from './output.ts';
import { parseInfraGraphResult } from './infra-graph-contract.ts';
import { collectInfraGraphSourceProvenance } from '../impact/graph-source-provenance.ts';

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
const SUPPORTED_IMPACT_REVIEW_TARGET_KINDS = new Set([
  'create-before-delete-conflict',
  'possible-rename',
  'replacement-cascade'
]);
const SUPPORTED_IMPACT_REVIEW_TARGET_RECOMMENDED_ACTIONS = new Set([
  'review-create-before-delete-conflicts',
  'review-possible-renames',
  'review-replacement-cascades'
]);
const SUPPORTED_IMPACT_REVIEW_TARGET_RISK_CATEGORIES = new Set([
  'create-before-delete-ordering',
  'dns-or-domain-ownership',
  'exclusive-identity-review',
  'kubernetes-object-ownership',
  'physical-name-ownership',
  'possible-rename-review',
  'replacement-cascade-review'
]);

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
  sourceProvenance: NonNullable<InfraGraph['summary']['sourceProvenance']>;
  reviewTargetCount: number;
  omittedReviewTargetCount: number;
  reviewTargetBudget: {
    maxTargets: number;
    totalTargets: number;
    includedTargets: number;
    omittedTargets: number;
  };
  summary: string[];
  reviewTargets: InfraGraphImpactReviewTarget[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNonNegativeIntegerField(record: Record<string, unknown>, field: string, label: string): void {
  if (!Number.isInteger(record[field]) || (record[field] as number) < 0) {
    throw new Error(`infra graph impact report ${label}.${field} must be a non-negative integer.`);
  }
}

function assertRequiredStringField(record: Record<string, unknown>, field: string, label: string): void {
  if (typeof record[field] !== 'string') {
    throw new Error(`infra graph impact report ${label}.${field} must be a string.`);
  }
}

function assertOptionalStringField(record: Record<string, unknown>, field: string, label: string): void {
  if (field in record && typeof record[field] !== 'string') {
    throw new Error(`infra graph impact report ${label}.${field} must be a string when present.`);
  }
}

function assertSupportedField(
  record: Record<string, unknown>,
  field: string,
  label: string,
  supportedValues: Set<string>
): void {
  if (typeof record[field] !== 'string' || !supportedValues.has(record[field])) {
    throw new Error(`infra graph impact report ${label}.${field} must be a supported value.`);
  }
}

function assertRequiredBooleanField(record: Record<string, unknown>, field: string, label: string): void {
  if (typeof record[field] !== 'boolean') {
    throw new Error(`infra graph impact report ${label}.${field} must be a boolean.`);
  }
}

function assertStringArrayField(record: Record<string, unknown>, field: string, label: string): void {
  if (!Array.isArray(record[field])) {
    throw new Error(`infra graph impact report ${label}.${field} must be an array.`);
  }

  const values = record[field];
  for (let index = 0; index < values.length; index += 1) {
    if (typeof values[index] !== 'string') {
      throw new Error(`infra graph impact report ${label}.${field}[${index}] must be a string.`);
    }
  }
}

function countEdges(graph: InfraGraph, kind: string): number {
  return graph.edges.filter(edge => edge.kind === kind).length;
}

export function buildInfraGraphImpactReport(graph: InfraGraph): InfraGraphImpactReport {
  const impact = graph.summary.impact;
  const reviewTargets = impact?.reviewTargets ?? [];
  const omittedReviewTargetCount = impact?.omittedReviewTargets ?? 0;
  const reviewTargetBudget = impact?.reviewTargetBudget ?? {
    maxTargets: reviewTargets.length,
    totalTargets: reviewTargets.length + omittedReviewTargetCount,
    includedTargets: reviewTargets.length,
    omittedTargets: omittedReviewTargetCount
  };

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
    sourceProvenance: graph.summary.sourceProvenance ?? collectInfraGraphSourceProvenance(graph.nodes, graph.edges),
    reviewTargetCount: reviewTargets.length,
    omittedReviewTargetCount,
    reviewTargetBudget,
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
  assertSupportedField(value, 'riskLevel', 'root', SUPPORTED_IMPACT_RISK_LEVELS);
  assertSupportedField(value, 'primaryConcern', 'root', SUPPORTED_IMPACT_PRIMARY_CONCERNS);
  assertSupportedField(value, 'recommendedAction', 'root', SUPPORTED_IMPACT_RECOMMENDED_ACTIONS);

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
    assertNonNegativeIntegerField(value.counts, field, 'counts');
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

  const seenSources = new Set<string>();
  for (let index = 0; index < value.sourceProvenance.sources.length; index += 1) {
    const source = value.sourceProvenance.sources[index];
    if (!isRecord(source)) {
      throw new Error(`infra graph impact report sourceProvenance.sources[${index}] must be an object.`);
    }

    assertSupportedField(source, 'source', `sourceProvenance.sources[${index}]`, SUPPORTED_SOURCES);
    const sourceLabel = source.source as string;
    if (seenSources.has(sourceLabel)) {
      throw new Error(`infra graph impact report sourceProvenance.sources[${index}].source must be unique.`);
    }
    seenSources.add(sourceLabel);

    for (const field of ['nodeCount', 'edgeCount', 'totalCount']) {
      assertNonNegativeIntegerField(source, field, `sourceProvenance.sources[${index}]`);
    }

    if (source.totalCount !== source.nodeCount + source.edgeCount) {
      throw new Error(
        `infra graph impact report sourceProvenance.sources[${index}].totalCount must equal nodeCount + edgeCount.`
      );
    }
  }

  const expectedSourceFlags = {
    hasWorkspaceInspection: seenSources.has('workspace-inspection'),
    hasTerraformPlan: seenSources.has('terraform-plan'),
    hasPulumiPreview: seenSources.has('pulumi-preview')
  };

  for (const [field, expectedValue] of Object.entries(expectedSourceFlags)) {
    if (value.sourceProvenance[field] !== expectedValue) {
      throw new Error(`infra graph impact report sourceProvenance.${field} must match listed sources.`);
    }
  }

  assertNonNegativeIntegerField(value, 'reviewTargetCount', 'root');
  assertNonNegativeIntegerField(value, 'omittedReviewTargetCount', 'root');

  if (!isRecord(value.reviewTargetBudget)) {
    throw new Error('infra graph impact report reviewTargetBudget must be an object.');
  }
  const reviewTargetBudget = value.reviewTargetBudget;

  for (const field of ['maxTargets', 'totalTargets', 'includedTargets', 'omittedTargets']) {
    assertNonNegativeIntegerField(reviewTargetBudget, field, 'reviewTargetBudget');
  }

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

    assertRequiredStringField(target, 'edgeId', `reviewTargets[${index}]`);
    assertRequiredStringField(target, 'from', `reviewTargets[${index}]`);
    assertRequiredStringField(target, 'to', `reviewTargets[${index}]`);
    assertSupportedField(target, 'kind', `reviewTargets[${index}]`, SUPPORTED_IMPACT_REVIEW_TARGET_KINDS);
    assertSupportedField(target, 'source', `reviewTargets[${index}]`, SUPPORTED_SOURCES);
    assertSupportedField(target, 'confidence', `reviewTargets[${index}]`, SUPPORTED_CONFIDENCES);
    assertSupportedField(
      target,
      'recommendedAction',
      `reviewTargets[${index}]`,
      SUPPORTED_IMPACT_REVIEW_TARGET_RECOMMENDED_ACTIONS
    );
    assertSupportedField(
      target,
      'riskCategory',
      `reviewTargets[${index}]`,
      SUPPORTED_IMPACT_REVIEW_TARGET_RISK_CATEGORIES
    );
    assertNonNegativeIntegerField(target, 'priority', `reviewTargets[${index}]`);
    if (target.priority !== index + 1) {
      throw new Error(
        `infra graph impact report reviewTargets[${index}].priority must be contiguous starting at 1 in array order.`
      );
    }

    assertStringArrayField(target, 'reviewSteps', `reviewTargets[${index}]`);
    for (const field of ['reason', 'identity', 'matchingIdentityKeys', 'replacementReasons']) {
      assertOptionalStringField(target, field, `reviewTargets[${index}]`);
    }
  }

  const reviewTargetCount = value.reviewTargetCount as number;
  const includedTargets = reviewTargetBudget.includedTargets as number;
  const omittedTargets = reviewTargetBudget.omittedTargets as number;
  const totalTargets = reviewTargetBudget.totalTargets as number;

  if (includedTargets + omittedTargets !== totalTargets) {
    throw new Error('infra graph impact report reviewTargetBudget includedTargets + omittedTargets must equal totalTargets.');
  }

  if (includedTargets !== reviewTargetCount) {
    throw new Error('infra graph impact report reviewTargetBudget.includedTargets must equal reviewTargetCount.');
  }

  if (omittedTargets !== value.omittedReviewTargetCount) {
    throw new Error('infra graph impact report reviewTargetBudget.omittedTargets must equal omittedReviewTargetCount.');
  }

  if (includedTargets !== value.reviewTargets.length) {
    throw new Error('infra graph impact report reviewTargetBudget.includedTargets must equal reviewTargets.length.');
  }

  if (includedTargets > (reviewTargetBudget.maxTargets as number)) {
    throw new Error(
      'infra graph impact report reviewTargetBudget.includedTargets must be less than or equal to maxTargets.'
    );
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
