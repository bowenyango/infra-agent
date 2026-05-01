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
}

export function inferInfraGraphImpactPosture(params: InfraGraphImpactPostureInput): InfraGraphImpactPosture {
  if (params.createBeforeDeleteConflicts > 0) {
    return {
      riskLevel: 'high',
      primaryConcern: 'create-before-delete-conflicts',
      recommendedAction: 'review-create-before-delete-conflicts'
    };
  }

  if (params.replacementCascades > 0) {
    return {
      riskLevel: 'medium',
      primaryConcern: 'replacement-cascades',
      recommendedAction: 'review-replacement-cascades'
    };
  }

  if ((params.replacementActions ?? 0) > 0) {
    return {
      riskLevel: 'medium',
      primaryConcern: 'replacements',
      recommendedAction: 'review-replacements'
    };
  }

  if (params.possibleRenames > 0) {
    return {
      riskLevel: 'medium',
      primaryConcern: 'possible-renames',
      recommendedAction: 'review-possible-renames'
    };
  }

  if (params.plannedChanges > 0 || params.dependencyEdges > 0) {
    return {
      riskLevel: 'low',
      primaryConcern: 'planned-changes',
      recommendedAction: 'review-planned-changes'
    };
  }

  return {
    riskLevel: 'none',
    primaryConcern: 'none',
    recommendedAction: 'none'
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
