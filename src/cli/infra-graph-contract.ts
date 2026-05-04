import type { InfraGraph } from '../types/infra-graph.ts';

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

export function parseInfraGraphResult(value: unknown): InfraGraph {
  if (!isRecord(value) || value.kind !== 'infra-agent.infra-graph') {
    throw new Error('infra graph input must be an infra-agent.infra-graph JSON payload.');
  }

  if (value.schemaVersion !== 1) {
    throw new Error('infra graph input must use infra graph schemaVersion 1.');
  }

  if (!Array.isArray(value.nodes)) {
    throw new Error('infra graph input must include nodes array.');
  }

  if (!Array.isArray(value.edges)) {
    throw new Error('infra graph input must include edges array.');
  }

  if (!isRecord(value.summary)) {
    throw new Error('infra graph input must include summary object.');
  }

  assertNumberField(value.summary, 'nodeCount', 'summary');
  assertNumberField(value.summary, 'edgeCount', 'summary');

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
