import type { KnowledgePackSource, KnowledgePackUnit } from './pack.ts';
import type { InfraDomainId } from '../types/repository.ts';

export interface KnowledgeUnitRankingOptions {
  sources?: KnowledgePackSource[];
  requestedDomains?: InfraDomainId[];
  targetPaths?: string[];
}

interface UnitBudgetSelectionOptions extends KnowledgeUnitRankingOptions {
  maxUnits: number;
}

interface ScoredKnowledgeUnit {
  unit: KnowledgePackUnit;
  index: number;
  rank: number;
  sourceKindPriority: number;
  targetPriority: number;
  domainPriority: number;
  stalePriority: number;
  confidencePriority: number;
  unitTypePriority: number;
  pathSpecificity: number;
}

const CONFIDENCE_SCORE: Record<KnowledgePackUnit['confidence'], number> = {
  high: 30,
  medium: 15,
  low: 0
};

const SOURCE_KIND_SCORE: Record<KnowledgePackSource['kind'], number> = {
  'provider-schema': 35,
  'chart-schema': 35,
  'pulumi-config': 32,
  'chart-metadata': 32,
  'pulumi-component': 31,
  'chart-lock': 30,
  'terraform-module': 30,
  'module-readme': 28,
  'internal-knowledge': 33,
  'knowledge-unit-registry': 10,
  'knowledge-unit-artifact': 34,
  'public-knowledge-library-registry': 10,
  'public-knowledge-library-artifact': 34,
  'repo-example': 24,
  'terraform-registry': 20,
  'helm-docs': 18,
  'pulumi-docs': 18,
  'chart-docs': 16
};

const UNIT_TYPE_SCORE: Record<KnowledgePackUnit['unitType'], number> = {
  diagnostic: 42,
  fact: 36,
  guidance: 24,
  recipe: 18,
  example: 8
};

const FACT_KIND_SCORE: Record<Extract<KnowledgePackUnit, { unitType: 'fact' }>['factKind'], number> = {
  argument: 26,
  attribute: 14,
  'nested-block': 24,
  example: 4,
  'identity-field': 24,
  'replacement-sensitive-field': 28,
  'module-input': 24,
  'module-output': 12,
  'chart-metadata': 18,
  'chart-dependency': 22,
  'chart-value': 26,
  'pulumi-config-parameter': 24,
  'pulumi-component-input': 24,
  'pulumi-component-child-resource': 22,
  'pulumi-component-output': 14,
  'pulumi-docs-guidance': 12
};

const DIAGNOSTIC_ENGINE_SCORE: Record<Extract<KnowledgePackUnit, { unitType: 'diagnostic' }>['engine'], number> = {
  terraform: 8,
  pulumi: 8,
  helm: 8,
  provider: 6,
  runtime: 4
};

function sourceDomainScore(source: KnowledgePackSource | undefined, requestedDomains: InfraDomainId[]): number {
  if (!source || requestedDomains.length === 0) {
    return 0;
  }

  return requestedDomains.includes(source.domain) ? 10 : 0;
}

function targetPathScore(source: KnowledgePackSource | undefined, targetPaths: string[]): number {
  if (!source || targetPaths.length === 0 || !source.targetPath) {
    return 0;
  }

  return targetPaths.some(targetPath =>
    source.targetPath === targetPath
    || source.targetPath.startsWith(`${targetPath}/`)
    || targetPath.startsWith(`${source.targetPath}/`)
  )
    ? 14
    : 0;
}

function unitPayloadScore(unit: KnowledgePackUnit): number {
  switch (unit.unitType) {
    case 'fact': {
      let score = FACT_KIND_SCORE[unit.factKind];
      if (unit.required === true) {
        score += 22;
      } else if (unit.required === false) {
        score += 4;
      }
      if (unit.type) {
        score += 6;
      }
      if (unit.defaultValue) {
        score += 4;
      }
      if (unit.values && unit.values.length > 0 && unit.factKind !== 'example') {
        score += 5;
      }
      return score;
    }
    case 'guidance':
      return 4
        + (unit.appliesWhen?.length ? 4 : 0)
        + (unit.avoidWhen?.length ? 3 : 0)
        + (unit.risk ? 3 : 0);
    case 'example':
      return 2
        + (unit.language ? 1 : 0)
        + Math.min(Math.ceil(unit.snippet.length / 120), 5);
    case 'diagnostic':
      return DIAGNOSTIC_ENGINE_SCORE[unit.engine]
        + Math.min(unit.recommendedReview.length * 2, 6)
        + 4;
    case 'recipe':
      return Math.min(unit.steps.length * 2, 8)
        + (unit.requiresApproval === true ? 4 : 0)
        + 2;
  }
}

function scoreUnit(
  unit: KnowledgePackUnit,
  source: KnowledgePackSource | undefined,
  options: Required<Pick<KnowledgeUnitRankingOptions, 'requestedDomains' | 'targetPaths'>>
): number {
  let rank = UNIT_TYPE_SCORE[unit.unitType];

  const sourceScore = source ? SOURCE_KIND_SCORE[source.kind] : 0;
  if (sourceScore > 0) {
    rank += sourceScore;
  }

  rank += CONFIDENCE_SCORE[unit.confidence];
  rank += unitPayloadScore(unit);

  const domainScore = sourceDomainScore(source, options.requestedDomains);
  if (domainScore > 0) {
    rank += domainScore;
  }

  const targetScore = targetPathScore(source, options.targetPaths);
  if (targetScore > 0) {
    rank += targetScore;
  }

  if (source?.stale) {
    rank -= 25;
  }

  if (unit.tokenEstimate !== undefined) {
    rank -= Math.min(Math.floor(unit.tokenEstimate / 80), 8);
  }

  rank += Math.min(unit.path.split('.').length, 8);

  return Math.max(0, rank);
}

function sourcePriority(source: KnowledgePackSource | undefined): number {
  return source ? SOURCE_KIND_SCORE[source.kind] : 0;
}

function targetPriority(source: KnowledgePackSource | undefined, targetPaths: string[]): number {
  if (!source || targetPaths.length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }

  const index = targetPaths.findIndex(targetPath =>
    source.targetPath === targetPath
    || source.targetPath.startsWith(`${targetPath}/`)
    || targetPath.startsWith(`${source.targetPath}/`)
  );
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function domainPriority(source: KnowledgePackSource | undefined, requestedDomains: InfraDomainId[]): number {
  if (!source || requestedDomains.length === 0) {
    return Number.MAX_SAFE_INTEGER;
  }

  const index = requestedDomains.indexOf(source.domain);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function confidencePriority(confidence: KnowledgePackUnit['confidence']): number {
  return confidence === 'high' ? 2 : confidence === 'medium' ? 1 : 0;
}

function stalePriority(source: KnowledgePackSource | undefined): number {
  return source?.stale ? 1 : 0;
}

function unitTypePriority(unitType: KnowledgePackUnit['unitType']): number {
  return UNIT_TYPE_SCORE[unitType];
}

function pathSpecificity(path: string): number {
  return path.split('.').length;
}

function isProtectedBudgetUnit(unit: KnowledgePackUnit): boolean {
  return unit.unitType === 'diagnostic'
    || (unit.unitType === 'fact' && unit.required === true);
}

function findBudgetReplacementIndex(selected: KnowledgePackUnit[]): number {
  for (let index = selected.length - 1; index >= 0; index -= 1) {
    const unit = selected[index];
    if (
      !isProtectedBudgetUnit(unit)
      && unit.unitType !== 'example'
      && unit.unitType !== 'recipe'
    ) {
      return index;
    }
  }

  return -1;
}

function findGuidanceBudgetReplacementIndex(selected: KnowledgePackUnit[]): number {
  for (let index = selected.length - 1; index >= 0; index -= 1) {
    const unit = selected[index];
    if (
      !isProtectedBudgetUnit(unit)
      && unit.unitType !== 'example'
      && unit.unitType !== 'recipe'
    ) {
      return index;
    }
  }

  return -1;
}

function findDiagnosticBudgetReplacementIndex(selected: KnowledgePackUnit[]): number {
  for (let index = selected.length - 1; index >= 0; index -= 1) {
    const unit = selected[index];
    if (
      !isProtectedBudgetUnit(unit)
      && unit.unitType !== 'example'
      && unit.unitType !== 'recipe'
      && unit.unitType !== 'guidance'
    ) {
      return index;
    }
  }

  for (let index = selected.length - 1; index >= 0; index -= 1) {
    const unit = selected[index];
    if (!isProtectedBudgetUnit(unit) && unit.unitType === 'guidance') {
      return index;
    }
  }

  return -1;
}

function selectPreferredBudgetUnit(
  ranked: KnowledgePackUnit[],
  selected: KnowledgePackUnit[],
  sourceById: Map<string, KnowledgePackSource>,
  unitType: 'example' | 'recipe'
): KnowledgePackUnit | null {
  const selectedIds = new Set(selected.map(unit => `${unit.sourceId}:${unit.unitType}:${unit.path}:${unit.sourceLocator}`));

  return ranked.find(unit => {
    if (unit.unitType !== unitType) {
      return false;
    }

    if (selectedIds.has(`${unit.sourceId}:${unit.unitType}:${unit.path}:${unit.sourceLocator}`)) {
      return false;
    }

    const source = sourceById.get(unit.sourceId);
    return source?.stale !== true;
  }) ?? null;
}

function selectPreferredGuidanceBudgetUnit(
  ranked: KnowledgePackUnit[],
  selected: KnowledgePackUnit[],
  sourceById: Map<string, KnowledgePackSource>
): KnowledgePackUnit | null {
  const selectedIds = new Set(selected.map(unit => `${unit.sourceId}:${unit.unitType}:${unit.path}:${unit.sourceLocator}`));

  return ranked.find(unit => {
    if (unit.unitType !== 'guidance') {
      return false;
    }

    if (selectedIds.has(`${unit.sourceId}:${unit.unitType}:${unit.path}:${unit.sourceLocator}`)) {
      return false;
    }

    const source = sourceById.get(unit.sourceId);
    return source?.stale !== true;
  }) ?? null;
}

function selectPreferredDiagnosticBudgetUnit(
  ranked: KnowledgePackUnit[],
  selected: KnowledgePackUnit[],
  sourceById: Map<string, KnowledgePackSource>
): KnowledgePackUnit | null {
  const selectedIds = new Set(selected.map(unit => `${unit.sourceId}:${unit.unitType}:${unit.path}:${unit.sourceLocator}`));

  return ranked.find(unit => {
    if (unit.unitType !== 'diagnostic') {
      return false;
    }

    if (selectedIds.has(`${unit.sourceId}:${unit.unitType}:${unit.path}:${unit.sourceLocator}`)) {
      return false;
    }

    const source = sourceById.get(unit.sourceId);
    return source?.stale !== true;
  }) ?? null;
}

function hasFreshSelectedUnitType(
  selected: KnowledgePackUnit[],
  sourceById: Map<string, KnowledgePackSource>,
  unitType: 'example' | 'recipe'
): boolean {
  return selected.some(unit =>
    unit.unitType === unitType
    && sourceById.get(unit.sourceId)?.stale !== true
  );
}

function hasFreshSelectedGuidance(
  selected: KnowledgePackUnit[],
  sourceById: Map<string, KnowledgePackSource>
): boolean {
  return selected.some(unit =>
    unit.unitType === 'guidance'
    && sourceById.get(unit.sourceId)?.stale !== true
  );
}

function hasFreshSelectedDiagnostic(
  selected: KnowledgePackUnit[],
  sourceById: Map<string, KnowledgePackSource>
): boolean {
  return selected.some(unit =>
    unit.unitType === 'diagnostic'
    && sourceById.get(unit.sourceId)?.stale !== true
  );
}

export function rankKnowledgePackUnits(
  units: KnowledgePackUnit[],
  options: KnowledgeUnitRankingOptions = {}
): KnowledgePackUnit[] {
  const sourceById = new Map((options.sources ?? []).map(source => [source.id, source]));
  const requestedDomains = options.requestedDomains ?? [];
  const targetPaths = options.targetPaths ?? [];

  const scored: ScoredKnowledgeUnit[] = units.map((unit, index) => {
    const source = sourceById.get(unit.sourceId);
    const rank = scoreUnit(unit, source, {
      requestedDomains,
      targetPaths
    });

    return {
      unit,
      index,
      rank,
      sourceKindPriority: sourcePriority(source),
      targetPriority: targetPriority(source, targetPaths),
      domainPriority: domainPriority(source, requestedDomains),
      stalePriority: stalePriority(source),
      confidencePriority: confidencePriority(unit.confidence),
      unitTypePriority: unitTypePriority(unit.unitType),
      pathSpecificity: pathSpecificity(unit.path)
    };
  });

  scored.sort((left, right) =>
    right.rank - left.rank
    || left.targetPriority - right.targetPriority
    || left.domainPriority - right.domainPriority
    || right.sourceKindPriority - left.sourceKindPriority
    || left.stalePriority - right.stalePriority
    || right.confidencePriority - left.confidencePriority
    || right.unitTypePriority - left.unitTypePriority
    || right.pathSpecificity - left.pathSpecificity
    || left.unit.path.localeCompare(right.unit.path)
    || left.unit.unitType.localeCompare(right.unit.unitType)
    || left.unit.sourceId.localeCompare(right.unit.sourceId)
    || left.unit.sourceLocator.localeCompare(right.unit.sourceLocator)
    || left.index - right.index
  );

  return scored.map(entry => entry.unit);
}

export function selectKnowledgePackUnitsForBudget(
  units: KnowledgePackUnit[],
  options: UnitBudgetSelectionOptions
): KnowledgePackUnit[] {
  const maxUnits = Math.max(1, options.maxUnits);
  const ranked = rankKnowledgePackUnits(units, options);
  if (ranked.length <= maxUnits) {
    return ranked;
  }

  const selected = ranked.slice(0, maxUnits);
  if (maxUnits < 4) {
    return selected;
  }

  const sourceById = new Map((options.sources ?? []).map(source => [source.id, source]));
  for (const unitType of ['recipe', 'example'] as const) {
    if (hasFreshSelectedUnitType(selected, sourceById, unitType)) {
      continue;
    }

    const candidate = selectPreferredBudgetUnit(ranked, selected, sourceById, unitType);
    if (!candidate) {
      continue;
    }

    const replacementIndex = findBudgetReplacementIndex(selected);
    if (replacementIndex === -1) {
      continue;
    }

    selected[replacementIndex] = candidate;
  }

  if (maxUnits >= 5 && !hasFreshSelectedGuidance(selected, sourceById)) {
    const candidate = selectPreferredGuidanceBudgetUnit(ranked, selected, sourceById);
    if (candidate) {
      const replacementIndex = findGuidanceBudgetReplacementIndex(selected);
      if (replacementIndex !== -1) {
        selected[replacementIndex] = candidate;
      }
    }
  }

  if (maxUnits >= 5 && !hasFreshSelectedDiagnostic(selected, sourceById)) {
    const candidate = selectPreferredDiagnosticBudgetUnit(ranked, selected, sourceById);
    if (candidate) {
      const replacementIndex = findDiagnosticBudgetReplacementIndex(selected);
      if (replacementIndex !== -1) {
        selected[replacementIndex] = candidate;
      }
    }
  }

  return selected;
}
