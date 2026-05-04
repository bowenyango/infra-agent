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
  reviewTargetCount: number;
  omittedReviewTargetCount: number;
  summary: string[];
  reviewTargets: InfraGraphImpactReviewTarget[];
}

function countEdges(graph: InfraGraph, kind: string): number {
  return graph.edges.filter(edge => edge.kind === kind).length;
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
    reviewTargetCount: reviewTargets.length,
    omittedReviewTargetCount: impact?.omittedReviewTargets ?? 0,
    summary: summarizeInfraGraphImpact(graph),
    reviewTargets
  };
}

export async function loadInfraGraphImpactReport(
  inputPath: string,
  baseDir = cwd()
): Promise<InfraGraphImpactReport> {
  const resolvedInputPath = isAbsolute(inputPath) ? inputPath : resolve(baseDir, inputPath);
  const inputContent = await readFile(resolvedInputPath, 'utf8');

  return buildInfraGraphImpactReport(parseInfraGraphResult(JSON.parse(inputContent)));
}
