import type { AgentRuntimeState } from '../types/agent.ts';
import type { KnowledgePackSource, KnowledgePackUnit } from '../knowledge/pack.ts';
import type { InfraDomainId } from '../types/repository.ts';
import { knowledgeUnitIncludesText } from './knowledge-unit-text.ts';

export type PlannerKnowledgeUnitSignal =
  | 'helm-upgrade-migration-review'
  | 'helm-validation-review'
  | 'pulumi-rename-review'
  | 'pulumi-validation-review'
  | 'terraform-rename-review';

export interface SelectedPlannerKnowledgeUnit {
  unit: KnowledgePackUnit;
  source?: KnowledgePackSource;
  signals: PlannerKnowledgeUnitSignal[];
  reasons: string[];
}

export interface PlannerKnowledgeUnitSelectionOptions {
  signals?: PlannerKnowledgeUnitSignal[];
}

const TERRAFORM_RENAME_PATTERN =
  /\b(terraform|hcl)\b.*\b(rename|renaming|moved[- ]block|moved[- ]blocks|resource[- ]address|state mv|import\/state)\b|\b(rename|renaming|moved[- ]block|moved[- ]blocks|resource[- ]address|state mv|import\/state)\b.*\b(terraform|hcl)\b/i;
const PULUMI_RENAME_PATTERN =
  /\b(pulumi|urn|alias|aliases|stack config|stack configuration)\b.*\b(rename|replacement|resource name|import\/state|state repair|logical name|adopt existing|retain existing|retaining physical resource|physical resource)\b|\b(rename|replacement|resource name|import\/state|state repair|logical name|adopt existing|retain existing|retaining physical resource|physical resource)\b.*\b(pulumi|urn|alias|aliases|stack config|stack configuration)\b/i;
const HELM_UPGRADE_MIGRATION_PATTERN =
  /\b(chart defaults?|values migration|breaking values?|helm template|helm lint)\b|\bvalues?\b.{0,40}\bmigrat(?:e|ed|es|ing|ion)\b|\bmigrat(?:e|ed|es|ing|ion)\b.{0,40}\bvalues?\b|\brender(?:ing)?\b.{0,40}\bbefore\b.{0,40}\b(change|edit|migration|upgrade)\b|\bbefore\b.{0,40}\b(change|edit|migration|upgrade)\b.{0,40}\brender(?:ing)?\b/i;
const PULUMI_VALIDATION_REVIEW_PATTERN =
  /\b(alias|aliases|import\/state|import|state repair|cloudfront alias|cnamealreadyexists|dns cutover|dns ownership|logical pulumi rename|logical name)\b/i;

const DEFAULT_SIGNALS: PlannerKnowledgeUnitSignal[] = [
  'helm-upgrade-migration-review',
  'helm-validation-review',
  'pulumi-rename-review',
  'pulumi-validation-review',
  'terraform-rename-review'
];

function sourceById(runtime: AgentRuntimeState): Map<string, KnowledgePackSource> {
  return new Map((runtime.knowledgeFacts?.sources ?? []).map(source => [source.id, source]));
}

function unitSource(
  sourceIndex: Map<string, KnowledgePackSource>,
  unit: KnowledgePackUnit
): KnowledgePackSource | undefined {
  return sourceIndex.get(unit.sourceId);
}

function sourceMatchesCurrentPackTarget(runtime: AgentRuntimeState, source: KnowledgePackSource | undefined): boolean {
  if (!source || !runtime.knowledgeFacts || runtime.knowledgeFacts.targetPaths.length === 0) {
    return true;
  }

  return runtime.knowledgeFacts.targetPaths.some(targetPath =>
    source.targetPath === targetPath
    || source.targetPath.startsWith(`${targetPath}/`)
    || targetPath.startsWith(`${source.targetPath}/`)
  );
}

function unitHasDomain(source: KnowledgePackSource | undefined, domain: InfraDomainId): boolean {
  return source?.domain === domain;
}

function selectableUnitForSignal(unit: KnowledgePackUnit): boolean {
  return unit.unitType === 'diagnostic'
    || unit.unitType === 'guidance'
    || unit.unitType === 'recipe';
}

function unitMatchesSignal(
  unit: KnowledgePackUnit,
  source: KnowledgePackSource | undefined,
  signal: PlannerKnowledgeUnitSignal
): boolean {
  switch (signal) {
    case 'terraform-rename-review':
      return selectableUnitForSignal(unit)
        && unitHasDomain(source, 'terraform')
        && knowledgeUnitIncludesText(unit, TERRAFORM_RENAME_PATTERN);
    case 'pulumi-rename-review':
      return selectableUnitForSignal(unit)
        && unitHasDomain(source, 'pulumi')
        && knowledgeUnitIncludesText(unit, PULUMI_RENAME_PATTERN);
    case 'helm-upgrade-migration-review':
      return (unit.unitType === 'diagnostic' || unit.unitType === 'recipe')
        && (unitHasDomain(source, 'helm') || (unit.unitType === 'diagnostic' && unit.engine === 'helm'))
        && knowledgeUnitIncludesText(unit, HELM_UPGRADE_MIGRATION_PATTERN);
    case 'pulumi-validation-review':
      return unit.unitType === 'diagnostic'
        && unit.engine === 'pulumi'
        && unitHasDomain(source, 'pulumi')
        && knowledgeUnitIncludesText(unit, PULUMI_VALIDATION_REVIEW_PATTERN);
    case 'helm-validation-review':
      return unit.unitType === 'diagnostic'
        && unit.engine === 'helm'
        && (source === undefined || unitHasDomain(source, 'helm'));
  }
}

function selectionReasons(
  source: KnowledgePackSource | undefined,
  signals: PlannerKnowledgeUnitSignal[]
): string[] {
  const reasons = signals.map(signal => `signal:${signal}`);
  if (source !== undefined) {
    reasons.push(`domain:${source.domain}`);
    if (source.targetPath.length > 0) {
      reasons.push(`target:${source.targetPath}`);
    }
    if (source.provider) {
      reasons.push(`provider:${source.provider}`);
    }
    if (source.packageName) {
      reasons.push(`packageName:${source.packageName}`);
    }
    if (source.chart) {
      reasons.push(`chart:${source.chart}`);
    }
  }

  return reasons;
}

export function selectPlannerKnowledgeUnits(
  runtime: AgentRuntimeState,
  options: PlannerKnowledgeUnitSelectionOptions = {}
): SelectedPlannerKnowledgeUnit[] {
  const signals = options.signals ?? DEFAULT_SIGNALS;
  const sourceIndex = sourceById(runtime);
  const selected: SelectedPlannerKnowledgeUnit[] = [];

  for (const unit of runtime.knowledgeFacts?.units ?? []) {
    const source = unitSource(sourceIndex, unit);
    if (source?.stale || !sourceMatchesCurrentPackTarget(runtime, source)) {
      continue;
    }

    const matchedSignals = signals.filter(signal => unitMatchesSignal(unit, source, signal));
    if (matchedSignals.length === 0) {
      continue;
    }

    selected.push({
      unit,
      ...(source !== undefined ? { source } : {}),
      signals: matchedSignals,
      reasons: selectionReasons(source, matchedSignals)
    });
  }

  return selected;
}

export function hasPlannerKnowledgeSignal(
  runtime: AgentRuntimeState,
  signal: PlannerKnowledgeUnitSignal
): boolean {
  return selectPlannerKnowledgeUnits(runtime, { signals: [signal] }).length > 0;
}

export function findSelectedPlannerKnowledgeUnit<T extends KnowledgePackUnit>(
  runtime: AgentRuntimeState,
  signal: PlannerKnowledgeUnitSignal,
  predicate: (unit: KnowledgePackUnit) => unit is T
): T | null {
  const selected = selectPlannerKnowledgeUnits(runtime, { signals: [signal] })
    .map(entry => entry.unit)
    .find(predicate);

  return selected ?? null;
}
