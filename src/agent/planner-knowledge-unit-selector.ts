import type { AgentRuntimeState, ValidationIssue } from '../types/agent.ts';
import type { KnowledgePackSource, KnowledgePackUnit } from '../knowledge/pack.ts';
import type { InfraDomainId } from '../types/repository.ts';
import { knowledgeUnitIncludesText, knowledgeUnitSearchText } from './knowledge-unit-text.ts';

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

export interface PlannerKnowledgeUnitIdentityHints {
  resources?: string[];
  modules?: string[];
  charts?: string[];
  components?: string[];
  providers?: string[];
  packages?: string[];
}

export interface PlannerKnowledgeUnitSelectionOptions {
  signals?: PlannerKnowledgeUnitSignal[];
  taskText?: string;
  plannedActionHints?: string[];
  validationIssues?: ValidationIssue[];
  identityHints?: PlannerKnowledgeUnitIdentityHints;
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
const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const SIGNIFICANT_TOKEN_PATTERN = /[a-z0-9][a-z0-9_.:/@-]{2,}/gi;
const COMMON_CONTEXT_TOKENS = new Set([
  'and',
  'for',
  'the',
  'with',
  'from',
  'into',
  'this',
  'that',
  'review',
  'update',
  'change',
  'changes',
  'target',
  'targets'
]);
const VALIDATION_METADATA_IDENTITY_KEYS: Array<keyof NonNullable<ValidationIssue['metadata']>> = [
  'conflictCode',
  'conflictFamily',
  'conflictLabel',
  'duplicateIdentity',
  'dnsNames',
  'kubernetesNames',
  'kubernetesNamespaces',
  'listenerArns',
  'listenerRulePriorities',
  'missingConfigKey',
  'missingVariableName',
  'providerName',
  'recordTypes',
  'resourceAddress',
  'resourceName',
  'resourceType',
  'oidcProviderUrls',
  'routeDestinations',
  'routeTableIds',
  'securityGroupIds',
  'securityGroupRulePeers',
  'yamlPath'
];

interface SelectionScoring {
  score: number;
  reasons: string[];
}

interface ScoredSelectedPlannerKnowledgeUnit extends SelectedPlannerKnowledgeUnit {
  score: number;
  originalIndex: number;
}

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

function compactReasonValue(value: string | undefined): string | null {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text || SECRET_VALUE_PATTERN.test(text)) {
    return null;
  }

  return text.length > 96 ? `${text.slice(0, 93)}...` : text;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function textMatchesValue(searchText: string, value: string | undefined): boolean {
  const compact = compactReasonValue(value);
  if (!compact) {
    return false;
  }

  const lowerSearchText = searchText.toLowerCase();
  const lowerCompact = compact.toLowerCase();
  if (lowerSearchText.includes(lowerCompact)) {
    return true;
  }

  const tokens = compact.match(SIGNIFICANT_TOKEN_PATTERN) ?? [];
  return tokens.some(token =>
    !COMMON_CONTEXT_TOKENS.has(token.toLowerCase())
    && lowerSearchText.includes(token.toLowerCase())
  );
}

function sourceSearchText(source: KnowledgePackSource | undefined): string {
  if (!source) {
    return '';
  }

  return [
    source.id,
    source.domain,
    source.targetPath,
    source.kind,
    source.name,
    source.version,
    source.provider,
    source.module,
    source.chart,
    source.packageName
  ].filter((value): value is string => value !== undefined).join(' ');
}

function issueDomain(issue: ValidationIssue): InfraDomainId | null {
  if (issue.kind.startsWith('terraform-') || /^terraform\b/i.test(issue.sourceCommand)) {
    return 'terraform';
  }
  if (issue.kind.startsWith('pulumi-') || /^pulumi\b/i.test(issue.sourceCommand)) {
    return 'pulumi';
  }
  if (issue.kind.startsWith('helm-') || /^helm\b/i.test(issue.sourceCommand)) {
    return 'helm';
  }

  return null;
}

function validationMetadataEntries(issue: ValidationIssue): Array<[string, string]> {
  const metadata = issue.metadata;
  if (!metadata) {
    return [];
  }

  const entries: Array<[string, string]> = [];
  for (const key of VALIDATION_METADATA_IDENTITY_KEYS) {
    const value = compactReasonValue(metadata[key]);
    if (value) {
      entries.push([key, value]);
    }
  }

  return entries;
}

function scoreValidationIssues(
  unit: KnowledgePackUnit,
  source: KnowledgePackSource | undefined,
  searchText: string,
  issues: ValidationIssue[] | undefined
): SelectionScoring {
  const scoring: SelectionScoring = { score: 0, reasons: [] };
  if (!issues || issues.length === 0) {
    return scoring;
  }

  for (const issue of issues) {
    const domain = issueDomain(issue);
    if (domain !== null && source !== undefined && source.domain !== domain) {
      continue;
    }

    let matchedIssue = false;
    if (textMatchesValue(searchText, issue.kind)) {
      scoring.score += unit.unitType === 'diagnostic' ? 30 : 12;
      scoring.reasons.push(`validation-issue:${issue.kind}`);
      matchedIssue = true;
    }

    for (const [key, value] of validationMetadataEntries(issue)) {
      if (!textMatchesValue(searchText, value)) {
        continue;
      }

      scoring.score += unit.unitType === 'diagnostic' ? 12 : 5;
      scoring.reasons.push(`validation-issue:${key}`);
      scoring.reasons.push(`identity:${key}:${value}`);
      matchedIssue = true;
    }

    if (!matchedIssue) {
      continue;
    }

    if (unit.unitType === 'diagnostic') {
      scoring.score += 8;
    }
  }

  scoring.reasons = dedupe(scoring.reasons);
  return scoring;
}

function scoreTaskContext(searchText: string, options: PlannerKnowledgeUnitSelectionOptions): SelectionScoring {
  const scoring: SelectionScoring = { score: 0, reasons: [] };
  const taskTokens = options.taskText?.match(SIGNIFICANT_TOKEN_PATTERN) ?? [];
  const plannedActionHints = options.plannedActionHints ?? [];

  for (const hint of plannedActionHints) {
    const reasonValue = compactReasonValue(hint);
    if (!reasonValue || !textMatchesValue(searchText, reasonValue)) {
      continue;
    }

    scoring.score += 8;
    scoring.reasons.push(`task-action:${reasonValue}`);
  }

  const lowerSearchText = searchText.toLowerCase();
  const matchedTaskTokens = taskTokens.filter(token =>
    !COMMON_CONTEXT_TOKENS.has(token.toLowerCase())
    && lowerSearchText.includes(token.toLowerCase())
  );
  if (matchedTaskTokens.length >= 2) {
    scoring.score += Math.min(6, matchedTaskTokens.length);
    scoring.reasons.push('task-text');
  }

  scoring.reasons = dedupe(scoring.reasons);
  return scoring;
}

function identityHintEntries(
  hints: PlannerKnowledgeUnitIdentityHints | undefined
): Array<[string, string]> {
  if (!hints) {
    return [];
  }

  return [
    ...(hints.resources ?? []).map((value): [string, string] => ['resource', value]),
    ...(hints.modules ?? []).map((value): [string, string] => ['module', value]),
    ...(hints.charts ?? []).map((value): [string, string] => ['chart', value]),
    ...(hints.components ?? []).map((value): [string, string] => ['component', value]),
    ...(hints.providers ?? []).map((value): [string, string] => ['provider', value]),
    ...(hints.packages ?? []).map((value): [string, string] => ['package', value])
  ].flatMap(([kind, value]) => {
    const compact = compactReasonValue(value);
    return compact ? [[kind, compact]] : [];
  });
}

function scoreIdentityHints(
  searchText: string,
  source: KnowledgePackSource | undefined,
  hints: PlannerKnowledgeUnitIdentityHints | undefined
): SelectionScoring {
  const scoring: SelectionScoring = { score: 0, reasons: [] };
  const sourceText = sourceSearchText(source);
  const combinedSearchText = `${searchText} ${sourceText}`;

  for (const [kind, value] of identityHintEntries(hints)) {
    if (!textMatchesValue(combinedSearchText, value)) {
      continue;
    }

    scoring.score += 10;
    scoring.reasons.push(`identity:${kind}:${value}`);
  }

  scoring.reasons = dedupe(scoring.reasons);
  return scoring;
}

function contextScoring(
  unit: KnowledgePackUnit,
  source: KnowledgePackSource | undefined,
  options: PlannerKnowledgeUnitSelectionOptions
): SelectionScoring {
  const searchText = `${knowledgeUnitSearchText(unit)} ${sourceSearchText(source)}`;
  const validation = scoreValidationIssues(unit, source, searchText, options.validationIssues);
  const task = scoreTaskContext(searchText, options);
  const identity = scoreIdentityHints(searchText, source, options.identityHints);

  return {
    score: validation.score + task.score + identity.score,
    reasons: dedupe([...validation.reasons, ...task.reasons, ...identity.reasons])
  };
}

function selectionReasons(
  source: KnowledgePackSource | undefined,
  signals: PlannerKnowledgeUnitSignal[],
  contextReasons: string[]
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
    if (source.module) {
      reasons.push(`module:${source.module}`);
    }
    if (source.packageName) {
      reasons.push(`packageName:${source.packageName}`);
      reasons.push(`package:${source.packageName}`);
    }
    if (source.chart) {
      reasons.push(`chart:${source.chart}`);
    }
  }

  return dedupe([...reasons, ...contextReasons]);
}

export function selectPlannerKnowledgeUnits(
  runtime: AgentRuntimeState,
  options: PlannerKnowledgeUnitSelectionOptions = {}
): SelectedPlannerKnowledgeUnit[] {
  const signals = options.signals ?? DEFAULT_SIGNALS;
  const sourceIndex = sourceById(runtime);
  const selected: ScoredSelectedPlannerKnowledgeUnit[] = [];

  for (const [originalIndex, unit] of (runtime.knowledgeFacts?.units ?? []).entries()) {
    const source = unitSource(sourceIndex, unit);
    if (source?.stale || !sourceMatchesCurrentPackTarget(runtime, source)) {
      continue;
    }

    const matchedSignals = signals.filter(signal => unitMatchesSignal(unit, source, signal));
    if (matchedSignals.length === 0) {
      continue;
    }

    const scoring = contextScoring(unit, source, options);
    selected.push({
      unit,
      ...(source !== undefined ? { source } : {}),
      signals: matchedSignals,
      reasons: selectionReasons(source, matchedSignals, scoring.reasons),
      score: matchedSignals.length * 100 + scoring.score,
      originalIndex
    });
  }

  return selected
    .sort((left, right) => right.score - left.score || left.originalIndex - right.originalIndex)
    .map(({ score, originalIndex, ...entry }) => entry);
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
