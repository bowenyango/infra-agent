import type {
  InfraGraphEdge,
  InfraGraphConfidence,
  InfraGraphImpactPrimaryConcern,
  InfraGraphImpactRecommendedAction,
  InfraGraphImpactReviewTarget,
  InfraGraphImpactReviewTargetKind,
  InfraGraphImpactReviewTargetRecommendedAction,
  InfraGraphImpactRiskLevel,
  InfraGraphSource
} from '../types/infra-graph.ts';

export const INFRA_GRAPH_IMPACT_MUTATION_ALLOWED = false;
const REVIEW_TARGET_LIMIT = 5;

const REVIEW_TARGET_KIND_PRIORITY: Record<InfraGraphImpactReviewTargetKind, number> = {
  'create-before-delete-conflict': 0,
  'replacement-cascade': 1,
  'possible-rename': 2
};

function isReviewTargetKind(value: unknown): value is InfraGraphImpactReviewTargetKind {
  return value === 'create-before-delete-conflict'
    || value === 'replacement-cascade'
    || value === 'possible-rename';
}

function reviewTargetRecommendedAction(
  kind: InfraGraphImpactReviewTargetKind
): InfraGraphImpactReviewTargetRecommendedAction {
  if (kind === 'create-before-delete-conflict') {
    return 'review-create-before-delete-conflicts';
  }

  if (kind === 'replacement-cascade') {
    return 'review-replacement-cascades';
  }

  return 'review-possible-renames';
}

function isGraphConfidence(value: unknown): value is InfraGraphConfidence {
  return value === 'low' || value === 'medium' || value === 'high';
}

function isGraphSource(value: unknown): value is InfraGraphSource {
  return value === 'workspace-inspection' || value === 'terraform-plan' || value === 'pulumi-preview';
}

function confidencePriority(edge: InfraGraphEdge): number {
  if (edge.confidence === 'high') {
    return 0;
  }

  if (edge.confidence === 'medium') {
    return 1;
  }

  return 2;
}

function metadataString(edge: InfraGraphEdge, key: string): string | undefined {
  const value = edge.metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function buildReviewTarget(edge: InfraGraphEdge): InfraGraphImpactReviewTarget | null {
  if (!isReviewTargetKind(edge.kind)) {
    return null;
  }

  const reason = metadataString(edge, 'reason');
  const identity = metadataString(edge, 'exclusiveIdentityValues');
  const matchingIdentityKeys = metadataString(edge, 'matchingIdentityKeys')
    ?? metadataString(edge, 'matchingExclusiveIdentityKeys');
  const replacementReasons = metadataString(edge, 'dependencyReplacementReasons');

  return {
    edgeId: edge.id,
    kind: edge.kind,
    from: edge.from,
    to: edge.to,
    confidence: edge.confidence,
    source: edge.source,
    recommendedAction: reviewTargetRecommendedAction(edge.kind),
    ...(reason ? { reason } : {}),
    ...(identity ? { identity } : {}),
    ...(matchingIdentityKeys ? { matchingIdentityKeys } : {}),
    ...(replacementReasons ? { replacementReasons } : {})
  };
}

export function buildInfraGraphImpactReviewTargets(edges: InfraGraphEdge[], limit = REVIEW_TARGET_LIMIT): InfraGraphImpactReviewTarget[] {
  return edges
    .filter((edge): edge is InfraGraphEdge & { kind: InfraGraphImpactReviewTargetKind } => isReviewTargetKind(edge.kind))
    .sort((left, right) =>
      REVIEW_TARGET_KIND_PRIORITY[left.kind] - REVIEW_TARGET_KIND_PRIORITY[right.kind]
      || confidencePriority(left) - confidencePriority(right)
      || left.id.localeCompare(right.id)
    )
    .map(buildReviewTarget)
    .filter((target): target is InfraGraphImpactReviewTarget => target !== null)
    .slice(0, limit);
}

export function countInfraGraphImpactReviewTargets(edges: InfraGraphEdge[]): number {
  return edges.filter(edge => isReviewTargetKind(edge.kind)).length;
}

function normalizeOptionalTargetString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function normalizeReviewTarget(value: unknown): InfraGraphImpactReviewTarget | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const target = value as Partial<InfraGraphImpactReviewTarget>;
  if (
    typeof target.edgeId !== 'string'
    || !isReviewTargetKind(target.kind)
    || typeof target.from !== 'string'
    || typeof target.to !== 'string'
    || !isGraphConfidence(target.confidence)
    || !isGraphSource(target.source)
  ) {
    return null;
  }

  const reason = normalizeOptionalTargetString(target.reason);
  const identity = normalizeOptionalTargetString(target.identity);
  const matchingIdentityKeys = normalizeOptionalTargetString(target.matchingIdentityKeys);
  const replacementReasons = normalizeOptionalTargetString(target.replacementReasons);

  return {
    edgeId: target.edgeId,
    kind: target.kind,
    from: target.from,
    to: target.to,
    confidence: target.confidence,
    source: target.source,
    recommendedAction: reviewTargetRecommendedAction(target.kind),
    ...(reason ? { reason } : {}),
    ...(identity ? { identity } : {}),
    ...(matchingIdentityKeys ? { matchingIdentityKeys } : {}),
    ...(replacementReasons ? { replacementReasons } : {})
  };
}

export function normalizeInfraGraphImpactReviewTargets(value: unknown, fallback: InfraGraphImpactReviewTarget[]): InfraGraphImpactReviewTarget[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const targets = value
    .map(normalizeReviewTarget)
    .filter((target): target is InfraGraphImpactReviewTarget => target !== null)
    .slice(0, REVIEW_TARGET_LIMIT);
  return targets.length > 0 || fallback.length === 0 ? targets : fallback;
}

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
