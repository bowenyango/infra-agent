import type {
  InfraGraphImpactPrimaryConcern,
  InfraGraphImpactRecommendedAction,
  InfraGraphImpactRiskLevel
} from '../types/infra-graph.ts';

export interface InfraGraphImpactPostureInput {
  createBeforeDeleteConflicts: number;
  dependencyEdges: number;
  plannedChanges: number;
  possibleRenames: number;
  replacementActions?: number;
  replacementCascades: number;
}

export interface InfraGraphImpactPosture {
  riskLevel: InfraGraphImpactRiskLevel;
  primaryConcern: InfraGraphImpactPrimaryConcern;
  recommendedAction: InfraGraphImpactRecommendedAction;
  reviewSteps: string[];
}

export function inferInfraGraphImpactPosture(params: InfraGraphImpactPostureInput): InfraGraphImpactPosture {
  if (params.createBeforeDeleteConflicts > 0) {
    return {
      riskLevel: 'high',
      primaryConcern: 'create-before-delete-conflicts',
      recommendedAction: 'review-create-before-delete-conflicts',
      reviewSteps: [
        'Confirm whether each delete/create pair is a logical rename or a true provider identity replacement.',
        'For logical renames, review Terraform moved blocks/state moves or Pulumi aliases/imports before any update.',
        'For true replacements, plan explicit delete-before-create or manual sequencing only after downtime and ownership review.'
      ]
    };
  }

  if (params.replacementCascades > 0) {
    return {
      riskLevel: 'medium',
      primaryConcern: 'replacement-cascades',
      recommendedAction: 'review-replacement-cascades',
      reviewSteps: [
        'Review upstream replacement reasons before approving dependent changes.',
        'Check each replacement-cascade edge for downstream blast radius and required sequencing.'
      ]
    };
  }

  if ((params.replacementActions ?? 0) > 0) {
    return {
      riskLevel: 'medium',
      primaryConcern: 'replacements',
      recommendedAction: 'review-replacements',
      reviewSteps: [
        'Review replacement reason metadata and native plan/preview output for each replace action.',
        'Confirm whether any replacement is a logical rename before considering moved blocks, aliases, imports, or state repair.'
      ]
    };
  }

  if (params.possibleRenames > 0) {
    return {
      riskLevel: 'medium',
      primaryConcern: 'possible-renames',
      recommendedAction: 'review-possible-renames',
      reviewSteps: [
        'Review possible-rename edges and matching identity keys before treating delete/create as a rename.',
        'Use moved blocks, aliases, imports, or state moves only after human-reviewed address mapping and approval.'
      ]
    };
  }

  if (params.plannedChanges > 0 || params.dependencyEdges > 0) {
    return {
      riskLevel: 'low',
      primaryConcern: 'planned-changes',
      recommendedAction: 'review-planned-changes',
      reviewSteps: [
        'Review planned-change edges and native plan/preview output before applying outside infra-agent.'
      ]
    };
  }

  return {
    riskLevel: 'none',
    primaryConcern: 'none',
    recommendedAction: 'none',
    reviewSteps: []
  };
}

export function isInfraGraphImpactRiskLevel(value: unknown): value is InfraGraphImpactRiskLevel {
  return value === 'none' || value === 'low' || value === 'medium' || value === 'high';
}

export function isInfraGraphImpactPrimaryConcern(value: unknown): value is InfraGraphImpactPrimaryConcern {
  return value === 'none'
    || value === 'planned-changes'
    || value === 'possible-renames'
    || value === 'replacements'
    || value === 'replacement-cascades'
    || value === 'create-before-delete-conflicts';
}

export function isInfraGraphImpactRecommendedAction(value: unknown): value is InfraGraphImpactRecommendedAction {
  return value === 'none'
    || value === 'review-planned-changes'
    || value === 'review-possible-renames'
    || value === 'review-replacements'
    || value === 'review-replacement-cascades'
    || value === 'review-create-before-delete-conflicts';
}

export function normalizeInfraGraphImpactReviewSteps(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const steps = value.filter((step): step is string => typeof step === 'string' && step.length > 0);
  return steps.length > 0 || fallback.length === 0 ? steps : fallback;
}
