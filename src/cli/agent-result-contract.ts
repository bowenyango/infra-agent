import type { CompactAgentRunResult } from './output.ts';
import { AGENT_ACTION_FAMILIES, AGENT_RUN_OUTCOMES } from '../types/agent.ts';
const AGENT_ACTION_KINDS = [
  'ask-for-clarification',
  'inspect-target-files',
  'apply-edit-plan',
  'repair-terraform-formatting',
  'validate-targets',
  'stop'
] as const;
const AGENT_CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
const AGENT_DECISION_EXECUTION_STATUSES = ['completed', 'skipped'] as const;
const AGENT_STOP_REASONS = [
  'validation-succeeded',
  'validation-blocked',
  'repair-budget-exhausted',
  'no-safe-action'
] as const;
const AGENT_CLARIFICATION_KINDS = [
  'approval-required',
  'target-ambiguity',
  'workspace-policy',
  'general'
] as const;
const TOOL_SAFETIES = ['read_only', 'write_scoped', 'validate', 'approval_required'] as const;
const TOOL_PERMISSION_CATEGORIES = [
  'workspace-read',
  'workspace-write',
  'local-validation',
  'native-cli-read',
  'native-cli-validation',
  'native-cli-write',
  'native-stack-config-write',
  'approval-required',
  'unknown'
] as const;
const DOCTOR_CHECK_STATUSES = ['pass', 'warn', 'fail'] as const;
const VALIDATION_COMMAND_STATUSES = ['passed', 'failed'] as const;
const VALIDATION_COMMAND_KINDS = ['yaml-guard', 'target-validation'] as const;
const VALIDATION_PLAN_KINDS = ['helm', 'pulumi', 'terraform'] as const;
const VALIDATION_SAFETY_BLOCKER_KINDS = ['unsafe-validation-command', 'yaml-syntax-failure'] as const;
const VALIDATION_ISSUE_KINDS = [
  'helm-missing-service-port',
  'helm-missing-ingress-values',
  'pulumi-create-before-delete-conflict',
  'pulumi-missing-config',
  'pulumi-preview-failure',
  'terraform-create-before-delete-conflict',
  'terraform-formatting-required',
  'terraform-validate-failure',
  'unsafe-validation-command',
  'yaml-syntax-failure',
  'unknown-validation-failure'
] as const;
const FILE_WRITE_RISKS = ['low', 'medium', 'high'] as const;
const APPROVAL_SIGNAL_KINDS = ['write-approval-required', 'tool-category-approval-required'] as const;
const PLANNER_HANDOFF_ACTIVE_BLOCKERS = [
  'none',
  'approval',
  'clarification',
  'validation',
  'repair-budget',
  'turn-budget',
  'no-safe-action'
] as const;
const PLANNER_HANDOFF_NEXT_CONTROL_ACTIONS = [
  'review-result',
  'request-approval',
  'answer-clarification',
  'resolve-validation',
  'manual-repair',
  'rerun-with-larger-turn-budget',
  'inspect-readiness-or-targeting'
] as const;
const LIFECYCLE_EVENT_NAMES = [
  'query-started',
  'decision',
  'tool-execution',
  'approval-gate',
  'terminal'
] as const;
const TURN_TRACE_PRESERVED_WINDOWS = ['head'] as const;
const IDENTITY_CONFLICT_RISK_CATEGORIES = [
  'create-before-delete-ordering',
  'dns-or-domain-ownership',
  'exclusive-identity-review',
  'kubernetes-object-ownership',
  'physical-name-ownership'
] as const;
const IDENTITY_CONFLICT_ENGINES = ['pulumi', 'terraform'] as const;
const RETRIEVED_CONTEXT_OMITTED_REASONS = ['packet-limit', 'token-budget'] as const;
const KNOWLEDGE_CACHE_SOURCES = [
  'environment: INFRA_AGENT_KNOWLEDGE_CACHE',
  'workspace-config: knowledgeCache.root',
  'default: user cache'
] as const;
const HANDOFF_CHECKPOINT_SOURCES = ['agent-result'] as const;
const HANDOFF_CHECKPOINT_PRIMARY_ARTIFACTS = ['agent --json'] as const;
const HANDOFF_CHECKPOINT_DEBUG_ARTIFACTS = ['agent --json-full'] as const;
const HANDOFF_CHECKPOINT_DURABLE_SECTIONS = [
  'root',
  'harness',
  'validation',
  'approval',
  'knowledge',
  'readiness',
  'result-card'
] as const;
const TARGETING_SOURCES = ['derived-run-preflight'] as const;
const TARGET_CANDIDATE_KINDS = ['helm-chart', 'pulumi-project', 'terraform-root'] as const;
const TARGET_CANDIDATE_DOMAINS = ['helm', 'pulumi', 'terraform'] as const;
const TARGETING_AMBIGUITY_KINDS = [
  'missing-environment',
  'missing-service',
  'no-candidates',
  'weak-match',
  'tied-top-score'
] as const;
const TARGETING_RECOMMENDED_ACTIONS = [
  'inspect-selected-target',
  'review-targeting',
  'clarify-target'
] as const;
const WORK_PLAN_SOURCES = ['derived-agent-run-state'] as const;
const WORK_PLAN_STATUSES = ['not-started', 'in-progress', 'blocked', 'completed'] as const;
const WORK_PLAN_STEP_KINDS = ['readiness', 'targeting', 'inspection', 'edit', 'validation', 'handoff'] as const;
const WORK_PLAN_STEP_STATUSES = ['pending', 'in-progress', 'blocked', 'completed', 'skipped'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKnownAgentResultOutcome(value: unknown): boolean {
  return typeof value === 'string' && AGENT_RUN_OUTCOMES.includes(value as typeof AGENT_RUN_OUTCOMES[number]);
}

function isKnownHandoffCheckpointSource(value: unknown): boolean {
  return typeof value === 'string' && HANDOFF_CHECKPOINT_SOURCES.includes(value as typeof HANDOFF_CHECKPOINT_SOURCES[number]);
}

function isKnownHandoffCheckpointPrimaryArtifact(value: unknown): boolean {
  return typeof value === 'string'
    && HANDOFF_CHECKPOINT_PRIMARY_ARTIFACTS.includes(value as typeof HANDOFF_CHECKPOINT_PRIMARY_ARTIFACTS[number]);
}

function isKnownHandoffCheckpointDebugArtifact(value: unknown): boolean {
  return typeof value === 'string'
    && HANDOFF_CHECKPOINT_DEBUG_ARTIFACTS.includes(value as typeof HANDOFF_CHECKPOINT_DEBUG_ARTIFACTS[number]);
}

function isKnownHandoffCheckpointDurableSection(value: unknown): boolean {
  return typeof value === 'string'
    && HANDOFF_CHECKPOINT_DURABLE_SECTIONS.includes(value as typeof HANDOFF_CHECKPOINT_DURABLE_SECTIONS[number]);
}

function isKnownAgentActionKind(value: unknown): boolean {
  return typeof value === 'string' && AGENT_ACTION_KINDS.includes(value as typeof AGENT_ACTION_KINDS[number]);
}

function isKnownAgentActionFamily(value: unknown): boolean {
  return typeof value === 'string' && AGENT_ACTION_FAMILIES.includes(value as typeof AGENT_ACTION_FAMILIES[number]);
}

function isKnownAgentConfidence(value: unknown): boolean {
  return typeof value === 'string' && AGENT_CONFIDENCE_LEVELS.includes(value as typeof AGENT_CONFIDENCE_LEVELS[number]);
}

function isKnownAgentDecisionExecutionStatus(value: unknown): boolean {
  return typeof value === 'string'
    && AGENT_DECISION_EXECUTION_STATUSES.includes(value as typeof AGENT_DECISION_EXECUTION_STATUSES[number]);
}

function isKnownAgentStopReason(value: unknown): boolean {
  return typeof value === 'string' && AGENT_STOP_REASONS.includes(value as typeof AGENT_STOP_REASONS[number]);
}

function isKnownAgentClarificationKind(value: unknown): boolean {
  return typeof value === 'string'
    && AGENT_CLARIFICATION_KINDS.includes(value as typeof AGENT_CLARIFICATION_KINDS[number]);
}

function isKnownToolSafety(value: unknown): boolean {
  return typeof value === 'string' && TOOL_SAFETIES.includes(value as typeof TOOL_SAFETIES[number]);
}

function isKnownToolPermissionCategory(value: unknown): boolean {
  return typeof value === 'string'
    && TOOL_PERMISSION_CATEGORIES.includes(value as typeof TOOL_PERMISSION_CATEGORIES[number]);
}

function isKnownDoctorCheckStatus(value: unknown): boolean {
  return typeof value === 'string' && DOCTOR_CHECK_STATUSES.includes(value as typeof DOCTOR_CHECK_STATUSES[number]);
}

function isKnownValidationCommandStatus(value: unknown): boolean {
  return typeof value === 'string'
    && VALIDATION_COMMAND_STATUSES.includes(value as typeof VALIDATION_COMMAND_STATUSES[number]);
}

function isKnownValidationCommandKind(value: unknown): boolean {
  return typeof value === 'string' && VALIDATION_COMMAND_KINDS.includes(value as typeof VALIDATION_COMMAND_KINDS[number]);
}

function isKnownValidationPlanKind(value: unknown): boolean {
  return typeof value === 'string' && VALIDATION_PLAN_KINDS.includes(value as typeof VALIDATION_PLAN_KINDS[number]);
}

function isKnownValidationSafetyBlockerKind(value: unknown): boolean {
  return typeof value === 'string'
    && VALIDATION_SAFETY_BLOCKER_KINDS.includes(value as typeof VALIDATION_SAFETY_BLOCKER_KINDS[number]);
}

function isKnownValidationIssueKind(value: unknown): boolean {
  return typeof value === 'string' && VALIDATION_ISSUE_KINDS.includes(value as typeof VALIDATION_ISSUE_KINDS[number]);
}

function isKnownFileWriteRisk(value: unknown): boolean {
  return typeof value === 'string' && FILE_WRITE_RISKS.includes(value as typeof FILE_WRITE_RISKS[number]);
}

function isKnownApprovalSignalKind(value: unknown): boolean {
  return typeof value === 'string' && APPROVAL_SIGNAL_KINDS.includes(value as typeof APPROVAL_SIGNAL_KINDS[number]);
}

function isKnownPlannerHandoffActiveBlocker(value: unknown): boolean {
  return typeof value === 'string'
    && PLANNER_HANDOFF_ACTIVE_BLOCKERS.includes(value as typeof PLANNER_HANDOFF_ACTIVE_BLOCKERS[number]);
}

function isKnownPlannerHandoffNextControlAction(value: unknown): boolean {
  return typeof value === 'string'
    && PLANNER_HANDOFF_NEXT_CONTROL_ACTIONS.includes(value as typeof PLANNER_HANDOFF_NEXT_CONTROL_ACTIONS[number]);
}

function isKnownLifecycleEventName(value: unknown): boolean {
  return typeof value === 'string'
    && LIFECYCLE_EVENT_NAMES.includes(value as typeof LIFECYCLE_EVENT_NAMES[number]);
}

function isKnownTurnTracePreservedWindow(value: unknown): boolean {
  return typeof value === 'string'
    && TURN_TRACE_PRESERVED_WINDOWS.includes(value as typeof TURN_TRACE_PRESERVED_WINDOWS[number]);
}

function isKnownIdentityConflictEngine(value: unknown): boolean {
  return typeof value === 'string'
    && IDENTITY_CONFLICT_ENGINES.includes(value as typeof IDENTITY_CONFLICT_ENGINES[number]);
}

function isKnownIdentityConflictRiskCategory(value: unknown): boolean {
  return typeof value === 'string'
    && IDENTITY_CONFLICT_RISK_CATEGORIES.includes(value as typeof IDENTITY_CONFLICT_RISK_CATEGORIES[number]);
}

function isKnownRetrievedContextOmittedReason(value: unknown): boolean {
  return typeof value === 'string'
    && RETRIEVED_CONTEXT_OMITTED_REASONS.includes(value as typeof RETRIEVED_CONTEXT_OMITTED_REASONS[number]);
}

function isKnownKnowledgeCacheSource(value: unknown): boolean {
  return typeof value === 'string'
    && KNOWLEDGE_CACHE_SOURCES.includes(value as typeof KNOWLEDGE_CACHE_SOURCES[number]);
}

function isKnownTargetingSource(value: unknown): boolean {
  return typeof value === 'string' && TARGETING_SOURCES.includes(value as typeof TARGETING_SOURCES[number]);
}

function isKnownTargetCandidateKind(value: unknown): boolean {
  return typeof value === 'string'
    && TARGET_CANDIDATE_KINDS.includes(value as typeof TARGET_CANDIDATE_KINDS[number]);
}

function isKnownTargetCandidateDomain(value: unknown): boolean {
  return typeof value === 'string'
    && TARGET_CANDIDATE_DOMAINS.includes(value as typeof TARGET_CANDIDATE_DOMAINS[number]);
}

function isKnownTargetingAmbiguityKind(value: unknown): boolean {
  return typeof value === 'string'
    && TARGETING_AMBIGUITY_KINDS.includes(value as typeof TARGETING_AMBIGUITY_KINDS[number]);
}

function isKnownTargetingRecommendedAction(value: unknown): boolean {
  return typeof value === 'string'
    && TARGETING_RECOMMENDED_ACTIONS.includes(value as typeof TARGETING_RECOMMENDED_ACTIONS[number]);
}

function isKnownWorkPlanSource(value: unknown): boolean {
  return typeof value === 'string' && WORK_PLAN_SOURCES.includes(value as typeof WORK_PLAN_SOURCES[number]);
}

function isKnownWorkPlanStatus(value: unknown): boolean {
  return typeof value === 'string' && WORK_PLAN_STATUSES.includes(value as typeof WORK_PLAN_STATUSES[number]);
}

function isKnownWorkPlanStepKind(value: unknown): boolean {
  return typeof value === 'string' && WORK_PLAN_STEP_KINDS.includes(value as typeof WORK_PLAN_STEP_KINDS[number]);
}

function isKnownWorkPlanStepStatus(value: unknown): boolean {
  return typeof value === 'string' && WORK_PLAN_STEP_STATUSES.includes(value as typeof WORK_PLAN_STEP_STATUSES[number]);
}

function isNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): boolean {
  return isNumber(value) && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): boolean {
  return isNumber(value) && Number.isInteger(value) && value > 0;
}

function isStringOrNull(value: unknown): boolean {
  return typeof value === 'string' || value === null;
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(entry => typeof entry === 'string');
}

function isArrayOf(value: unknown, validator: (entry: unknown) => boolean): boolean {
  return Array.isArray(value) && value.every(entry => validator(entry));
}

function hasNumericCountSet(record: Record<string, unknown>): boolean {
  return isNumber(record.totalCount) && isNumber(record.includedCount) && isNumber(record.omittedCount);
}

function hasConsistentCountSet(record: Record<string, unknown>): boolean {
  return typeof record.totalCount === 'number'
    && typeof record.includedCount === 'number'
    && typeof record.omittedCount === 'number'
    && record.includedCount + record.omittedCount === record.totalCount;
}

function assertNumericMap(
  record: Record<string, unknown>,
  fieldName: string,
  keyValidator: (value: unknown) => boolean
): void {
  for (const [key, value] of Object.entries(record)) {
    if (!keyValidator(key) || !isNonNegativeInteger(value)) {
      throw new Error(`compact result input ${fieldName} must use supported non-negative integer keys when present.`);
    }
  }
}

function assertIntegerField(
  record: Record<string, unknown>,
  field: string,
  fieldPath: string,
  validator: (value: unknown) => boolean,
  description: string
): void {
  if (!validator(record[field])) {
    throw new Error(`compact result input ${fieldPath}.${field} must be ${description}.`);
  }
}

function assertHandoffBudgetSample(
  value: unknown,
  fieldPath: string,
  extraCountFields: string[] = []
): void {
  if (!isRecord(value)) {
    throw new Error(`compact result input ${fieldPath} must be an object.`);
  }

  for (const field of ['includedCount', 'omittedCount', ...extraCountFields]) {
    assertIntegerField(value, field, fieldPath, isNonNegativeInteger, 'a non-negative integer');
  }
}

function assertHandoffBudgetMatches(
  value: unknown,
  fieldPath: string,
  includedCount: number,
  omittedCount: number,
  sourcePath: string
): void {
  if (!isRecord(value)) {
    throw new Error(`compact result input ${fieldPath} must be an object.`);
  }

  if (value.includedCount !== includedCount || value.omittedCount !== omittedCount) {
    throw new Error(`compact result input ${fieldPath} must match ${sourcePath}.`);
  }
}

function expectedIdentityIssueKind(engine: unknown): string | null {
  if (engine === 'terraform') {
    return 'terraform-create-before-delete-conflict';
  }

  if (engine === 'pulumi') {
    return 'pulumi-create-before-delete-conflict';
  }

  return null;
}

function assertCompactTargeting(value: unknown): void {
  if (!isRecord(value)) {
    throw new Error('compact result input harness.targeting must be an object when harness is present.');
  }

  if (value.schemaVersion !== 1) {
    throw new Error('compact result input harness.targeting.schemaVersion must be 1.');
  }

  if (!isKnownTargetingSource(value.source)) {
    throw new Error('compact result input harness.targeting.source must be supported.');
  }

  if (value.compact !== true) {
    throw new Error('compact result input harness.targeting.compact must be true.');
  }

  if (value.mutationAllowed !== false) {
    throw new Error('compact result input harness.targeting.mutationAllowed must be false.');
  }

  for (const field of [
    'candidateCount',
    'maxCandidates',
    'includedCount',
    'omittedCount'
  ]) {
    assertIntegerField(value, field, 'harness.targeting', isNonNegativeInteger, 'a non-negative integer');
  }

  if (value.topScore !== null && !isNumber(value.topScore)) {
    throw new Error('compact result input harness.targeting.topScore must be a number or null.');
  }

  if (value.scoreGapToNext !== null && !isNumber(value.scoreGapToNext)) {
    throw new Error('compact result input harness.targeting.scoreGapToNext must be a number or null.');
  }

  if (!isKnownTargetingRecommendedAction(value.recommendedAction)) {
    throw new Error('compact result input harness.targeting.recommendedAction must be supported.');
  }

  if (!Array.isArray(value.ambiguityKinds)) {
    throw new Error('compact result input harness.targeting.ambiguityKinds must be an array.');
  }

  if (value.ambiguityKinds.some(kind => !isKnownTargetingAmbiguityKind(kind))) {
    throw new Error('compact result input harness.targeting.ambiguityKinds must use supported values.');
  }

  if (new Set(value.ambiguityKinds).size !== value.ambiguityKinds.length) {
    throw new Error('compact result input harness.targeting.ambiguityKinds must not include duplicates.');
  }

  if (!isRecord(value.flags)) {
    throw new Error('compact result input harness.targeting.flags must be an object.');
  }

  for (const field of ['missingEnvironment', 'missingService', 'noCandidates', 'weakTopScore', 'tiedTopScore']) {
    if (typeof value.flags[field] !== 'boolean') {
      throw new Error(`compact result input harness.targeting.flags.${field} must be a boolean.`);
    }
  }

  if (!Array.isArray(value.candidates)) {
    throw new Error('compact result input harness.targeting.candidates must be an array.');
  }

  if (value.includedCount !== value.candidates.length) {
    throw new Error('compact result input harness.targeting.includedCount must match candidates length.');
  }

  if ((value.includedCount as number) + (value.omittedCount as number) !== value.candidateCount) {
    throw new Error('compact result input harness.targeting candidate counts must be consistent.');
  }

  if ((value.includedCount as number) > (value.maxCandidates as number)) {
    throw new Error('compact result input harness.targeting.includedCount must not exceed maxCandidates.');
  }

  const selectedCandidateCount = value.candidates
    .filter(candidate => isRecord(candidate) && candidate.selected === true)
    .length;

  if (value.selectedTarget !== null) {
    if (!isRecord(value.selectedTarget)) {
      throw new Error('compact result input harness.targeting.selectedTarget must be an object or null.');
    }

    assertIntegerField(value.selectedTarget, 'rank', 'harness.targeting.selectedTarget', isPositiveInteger, 'a positive integer');

    if (!isKnownTargetCandidateKind(value.selectedTarget.kind)) {
      throw new Error('compact result input harness.targeting.selectedTarget.kind must be supported.');
    }

    if (!isKnownTargetCandidateDomain(value.selectedTarget.domain)) {
      throw new Error('compact result input harness.targeting.selectedTarget.domain must be supported.');
    }

    for (const field of ['name', 'path']) {
      if (typeof value.selectedTarget[field] !== 'string') {
        throw new Error(`compact result input harness.targeting.selectedTarget.${field} must be a string.`);
      }
    }

    if (!isNumber(value.selectedTarget.score)) {
      throw new Error('compact result input harness.targeting.selectedTarget.score must be a number.');
    }
  } else if (selectedCandidateCount > 0) {
    throw new Error('compact result input harness.targeting.selectedTarget is required when an included candidate is selected.');
  }

  let previousRank = 0;
  for (let index = 0; index < value.candidates.length; index += 1) {
    const candidate = value.candidates[index];
    const candidatePath = `harness.targeting.candidates[${index}]`;

    if (!isRecord(candidate)) {
      throw new Error(`compact result input ${candidatePath} must be an object.`);
    }

    assertIntegerField(candidate, 'rank', candidatePath, isPositiveInteger, 'a positive integer');

    if ((candidate.rank as number) <= previousRank) {
      throw new Error('compact result input harness.targeting.candidates ranks must be unique and ascending.');
    }
    previousRank = candidate.rank as number;

    if (typeof candidate.selected !== 'boolean') {
      throw new Error(`compact result input ${candidatePath}.selected must be a boolean.`);
    }

    if (!isKnownTargetCandidateKind(candidate.kind)) {
      throw new Error(`compact result input ${candidatePath}.kind must be supported.`);
    }

    if (!isKnownTargetCandidateDomain(candidate.domain)) {
      throw new Error(`compact result input ${candidatePath}.domain must be supported.`);
    }

    for (const field of ['name', 'path']) {
      if (typeof candidate[field] !== 'string') {
        throw new Error(`compact result input ${candidatePath}.${field} must be a string.`);
      }
    }

    if (!isNumber(candidate.score)) {
      throw new Error(`compact result input ${candidatePath}.score must be a number.`);
    }

    for (const field of ['reasonCount', 'detailCount']) {
      assertIntegerField(candidate, field, candidatePath, isNonNegativeInteger, 'a non-negative integer');
    }

    if (!isStringArray(candidate.reasons)) {
      throw new Error(`compact result input ${candidatePath}.reasons must be a string array.`);
    }

    if (!isStringArray(candidate.matchedEnvironmentHints)) {
      throw new Error(`compact result input ${candidatePath}.matchedEnvironmentHints must be a string array.`);
    }

    if (!isStringArray(candidate.details)) {
      throw new Error(`compact result input ${candidatePath}.details must be a string array.`);
    }

    if ((candidate.reasons as unknown[]).length > (candidate.reasonCount as number)) {
      throw new Error(`compact result input ${candidatePath}.reasons length must not exceed reasonCount.`);
    }

    if ((candidate.details as unknown[]).length > (candidate.detailCount as number)) {
      throw new Error(`compact result input ${candidatePath}.details length must not exceed detailCount.`);
    }
  }
}

function assertCompactWorkPlan(value: unknown): void {
  if (!isRecord(value)) {
    throw new Error('compact result input harness.workPlan must be an object when harness is present.');
  }

  if (value.schemaVersion !== 1) {
    throw new Error('compact result input harness.workPlan.schemaVersion must be 1.');
  }

  if (!isKnownWorkPlanSource(value.source)) {
    throw new Error('compact result input harness.workPlan.source must be supported.');
  }

  if (value.compact !== true) {
    throw new Error('compact result input harness.workPlan.compact must be true.');
  }

  if (value.mutationAllowed !== false) {
    throw new Error('compact result input harness.workPlan.mutationAllowed must be false.');
  }

  if (!isKnownWorkPlanStatus(value.status)) {
    throw new Error('compact result input harness.workPlan.status must be supported.');
  }

  if (!isKnownPlannerHandoffActiveBlocker(value.blockerKind)) {
    throw new Error('compact result input harness.workPlan.blockerKind must be supported.');
  }

  if (!isKnownPlannerHandoffNextControlAction(value.nextControlAction)) {
    throw new Error('compact result input harness.workPlan.nextControlAction must be supported.');
  }

  for (const field of [
    'totalStepCount',
    'completedStepCount',
    'pendingStepCount',
    'blockedStepCount',
    'maxEntries',
    'includedCount',
    'omittedCount'
  ]) {
    assertIntegerField(value, field, 'harness.workPlan', isNonNegativeInteger, 'a non-negative integer');
  }

  if (value.currentStepIndex !== null && !isNonNegativeInteger(value.currentStepIndex)) {
    throw new Error('compact result input harness.workPlan.currentStepIndex must be a non-negative integer or null.');
  }

  if (!Array.isArray(value.steps)) {
    throw new Error('compact result input harness.workPlan.steps must be an array.');
  }

  if (value.includedCount !== value.steps.length) {
    throw new Error('compact result input harness.workPlan.includedCount must match steps length.');
  }

  if ((value.includedCount as number) + (value.omittedCount as number) !== value.totalStepCount) {
    throw new Error('compact result input harness.workPlan step counts must be consistent.');
  }

  if ((value.includedCount as number) > (value.maxEntries as number)) {
    throw new Error('compact result input harness.workPlan.includedCount must not exceed maxEntries.');
  }

  const seenIndexes = new Set<number>();
  let previousIndex = -1;

  for (let index = 0; index < value.steps.length; index += 1) {
    const step = value.steps[index];
    const stepPath = `harness.workPlan.steps[${index}]`;

    if (!isRecord(step)) {
      throw new Error(`compact result input ${stepPath} must be an object.`);
    }

    assertIntegerField(step, 'index', stepPath, isNonNegativeInteger, 'a non-negative integer');

    if (!isKnownWorkPlanStepKind(step.kind)) {
      throw new Error(`compact result input ${stepPath}.kind must be supported.`);
    }

    if (!isKnownWorkPlanStepStatus(step.status)) {
      throw new Error(`compact result input ${stepPath}.status must be supported.`);
    }

    for (const field of ['title', 'summary']) {
      if (typeof step[field] !== 'string') {
        throw new Error(`compact result input ${stepPath}.${field} must be a string.`);
      }
    }

    if (step.actionKind !== null && !isKnownAgentActionKind(step.actionKind)) {
      throw new Error(`compact result input ${stepPath}.actionKind must be supported or null.`);
    }

    if (step.validationIssueKind !== null && !isKnownValidationIssueKind(step.validationIssueKind)) {
      throw new Error(`compact result input ${stepPath}.validationIssueKind must be supported or null.`);
    }

    if (step.approvalSignalKind !== null && !isKnownApprovalSignalKind(step.approvalSignalKind)) {
      throw new Error(`compact result input ${stepPath}.approvalSignalKind must be supported or null.`);
    }

    const stepIndex = step.index as number;
    if (seenIndexes.has(stepIndex) || stepIndex <= previousIndex) {
      throw new Error('compact result input harness.workPlan.steps indexes must be unique and ascending.');
    }

    seenIndexes.add(stepIndex);
    previousIndex = stepIndex;
  }
}

function assertCompactWorkPlanConsistency(
  workPlan: unknown,
  value: Record<string, unknown>
): void {
  if (!isRecord(workPlan) || !isRecord(value.harness) || !isRecord(value.harness.plannerHandoff)) {
    return;
  }

  const plannerHandoff = value.harness.plannerHandoff;
  if (!isRecord(plannerHandoff.activeBlocker)) {
    return;
  }

  if (workPlan.blockerKind !== plannerHandoff.activeBlocker.kind) {
    throw new Error('compact result input harness.workPlan.blockerKind must match harness.plannerHandoff.activeBlocker.kind.');
  }

  if (workPlan.nextControlAction !== plannerHandoff.nextControlAction) {
    throw new Error('compact result input harness.workPlan.nextControlAction must match harness.plannerHandoff.nextControlAction.');
  }

  if (value.outcome === 'completed' && workPlan.status !== 'completed') {
    throw new Error('compact result input harness.workPlan.status must be completed when outcome is completed.');
  }

  if (plannerHandoff.activeBlocker.kind !== 'none' && workPlan.status !== 'blocked') {
    throw new Error('compact result input harness.workPlan.status must be blocked when a planner blocker is active.');
  }

  const steps = Array.isArray(workPlan.steps) ? workPlan.steps : [];
  const includedStatuses = steps
    .filter(isRecord)
    .map(step => step.status);
  const completedStepCount = includedStatuses.filter(status => status === 'completed').length;
  const pendingStepCount = includedStatuses.filter(status => status === 'pending').length;
  const blockedStepCount = includedStatuses.filter(status => status === 'blocked').length;

  if (workPlan.omittedCount === 0) {
    if (workPlan.completedStepCount !== completedStepCount) {
      throw new Error('compact result input harness.workPlan.completedStepCount must match included completed steps.');
    }

    if (workPlan.pendingStepCount !== pendingStepCount) {
      throw new Error('compact result input harness.workPlan.pendingStepCount must match included pending steps.');
    }

    if (workPlan.blockedStepCount !== blockedStepCount) {
      throw new Error('compact result input harness.workPlan.blockedStepCount must match included blocked steps.');
    }
  }

  if (workPlan.currentStepIndex !== null) {
    const currentStep = steps
      .filter(isRecord)
      .find(step => step.index === workPlan.currentStepIndex);

    if (!currentStep) {
      throw new Error('compact result input harness.workPlan.currentStepIndex must point to an included step.');
    }

    if (currentStep.status !== 'blocked' && currentStep.status !== 'in-progress') {
      throw new Error('compact result input harness.workPlan.currentStepIndex must point to a blocked or in-progress step.');
    }
  }

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (!isRecord(step)) {
      continue;
    }

    const stepPath = `harness.workPlan.steps[${index}]`;

    if (step.validationIssueKind !== null && step.kind !== 'validation') {
      throw new Error(`compact result input ${stepPath}.validationIssueKind must be null unless step kind is validation.`);
    }

    if (step.validationIssueKind !== null && step.status !== 'blocked') {
      throw new Error(`compact result input ${stepPath}.validationIssueKind requires blocked step status.`);
    }

    if (step.approvalSignalKind !== null && step.kind !== 'edit') {
      throw new Error(`compact result input ${stepPath}.approvalSignalKind must be null unless step kind is edit.`);
    }

    if (step.approvalSignalKind !== null && step.status !== 'blocked') {
      throw new Error(`compact result input ${stepPath}.approvalSignalKind requires blocked step status.`);
    }
  }
}

export function parseCompactAgentRunResult(value: unknown): CompactAgentRunResult {
  if (!isRecord(value) || value.kind !== 'infra-agent.agent-result') {
    throw new Error('compact result input must be a compact infra-agent.agent-result JSON payload.');
  }

  if (value.schemaVersion !== 1) {
    throw new Error('compact result input must use compact agent result schemaVersion 1.');
  }

  if (!isRecord(value.handoffCheckpoint)) {
    throw new Error('compact result input must include handoffCheckpoint object.');
  }

  if (value.handoffCheckpoint.schemaVersion !== 1) {
    throw new Error('compact result input handoffCheckpoint.schemaVersion must be 1.');
  }

  if (!isKnownHandoffCheckpointSource(value.handoffCheckpoint.source)) {
    throw new Error('compact result input handoffCheckpoint.source must be supported.');
  }

  if (value.handoffCheckpoint.compact !== true) {
    throw new Error('compact result input handoffCheckpoint.compact must be true.');
  }

  if (!isKnownHandoffCheckpointPrimaryArtifact(value.handoffCheckpoint.primaryArtifact)) {
    throw new Error('compact result input handoffCheckpoint.primaryArtifact must be supported.');
  }

  if (!isKnownHandoffCheckpointDebugArtifact(value.handoffCheckpoint.debugArtifact)) {
    throw new Error('compact result input handoffCheckpoint.debugArtifact must be supported.');
  }

  if (value.handoffCheckpoint.mutationAllowed !== false) {
    throw new Error('compact result input handoffCheckpoint.mutationAllowed must be false.');
  }

  if (!isRecord(value.handoffCheckpoint.exclusions)) {
    throw new Error('compact result input handoffCheckpoint.exclusions must be an object.');
  }

  for (const field of [
    'rawRuntimeIncluded',
    'rawPreflightIncluded',
    'rawToolOutputIncluded',
    'rawPromptIncluded',
    'rawKnowledgeExcerptIncluded'
  ]) {
    if (value.handoffCheckpoint.exclusions[field] !== false) {
      throw new Error(`compact result input handoffCheckpoint.exclusions.${field} must be false.`);
    }
  }

  if (!isRecord(value.handoffCheckpoint.summary)) {
    throw new Error('compact result input handoffCheckpoint.summary must be an object.');
  }

  if (!isKnownAgentResultOutcome(value.handoffCheckpoint.summary.outcome)) {
    throw new Error('compact result input handoffCheckpoint.summary.outcome must be supported.');
  }

  if (!isKnownPlannerHandoffActiveBlocker(value.handoffCheckpoint.summary.activeBlocker)) {
    throw new Error('compact result input handoffCheckpoint.summary.activeBlocker must be supported.');
  }

  if (!isKnownPlannerHandoffNextControlAction(value.handoffCheckpoint.summary.nextControlAction)) {
    throw new Error('compact result input handoffCheckpoint.summary.nextControlAction must be supported.');
  }

  if (!isKnownDoctorCheckStatus(value.handoffCheckpoint.summary.readinessStatus)) {
    throw new Error('compact result input handoffCheckpoint.summary.readinessStatus must be supported.');
  }

  if (typeof value.handoffCheckpoint.summary.validationStatus !== 'string') {
    throw new Error('compact result input handoffCheckpoint.summary.validationStatus must be a string.');
  }

  for (const field of ['validationIssueCount', 'identityConflictCount', 'changedFileCount']) {
    assertIntegerField(
      value.handoffCheckpoint.summary,
      field,
      'handoffCheckpoint.summary',
      isNonNegativeInteger,
      'a non-negative integer'
    );
  }

  if (typeof value.handoffCheckpoint.summary.approvalContinuationRequired !== 'boolean') {
    throw new Error('compact result input handoffCheckpoint.summary.approvalContinuationRequired must be a boolean.');
  }

  if (!isRecord(value.handoffCheckpoint.budgets)) {
    throw new Error('compact result input handoffCheckpoint.budgets must be an object.');
  }

  for (const field of [
    'turnTrace',
    'lifecycleEvents',
    'toolTrace',
    'workPlan',
    'targeting',
    'validationCommands',
    'validationIssues',
    'validationIssueGroups',
    'validationSafetyBlockers',
    'identityConflicts',
    'approvalSignals'
  ]) {
    assertHandoffBudgetSample(value.handoffCheckpoint.budgets[field], `handoffCheckpoint.budgets.${field}`);
  }

  assertHandoffBudgetSample(
    value.handoffCheckpoint.budgets.knowledgePackets,
    'handoffCheckpoint.budgets.knowledgePackets',
    ['includedTokenEstimate', 'omittedTokenEstimate']
  );

  if (!isRecord(value.handoffCheckpoint.continuation)) {
    throw new Error('compact result input handoffCheckpoint.continuation must be an object.');
  }

  if (typeof value.handoffCheckpoint.continuation.required !== 'boolean') {
    throw new Error('compact result input handoffCheckpoint.continuation.required must be a boolean.');
  }

  if (!isKnownPlannerHandoffActiveBlocker(value.handoffCheckpoint.continuation.reason)) {
    throw new Error('compact result input handoffCheckpoint.continuation.reason must be supported.');
  }

  if (!isKnownPlannerHandoffNextControlAction(value.handoffCheckpoint.continuation.nextControlAction)) {
    throw new Error('compact result input handoffCheckpoint.continuation.nextControlAction must be supported.');
  }

  if (typeof value.handoffCheckpoint.continuation.approvalRequired !== 'boolean') {
    throw new Error('compact result input handoffCheckpoint.continuation.approvalRequired must be a boolean.');
  }

  if (!isStringOrNull(value.handoffCheckpoint.continuation.command)) {
    throw new Error('compact result input handoffCheckpoint.continuation.command must be string or null.');
  }

  if (value.handoffCheckpoint.continuation.mutationAllowed !== false) {
    throw new Error('compact result input handoffCheckpoint.continuation.mutationAllowed must be false.');
  }

  if (value.handoffCheckpoint.continuation.required !== (value.handoffCheckpoint.continuation.reason !== 'none')) {
    throw new Error('compact result input handoffCheckpoint.continuation.required must match reason.');
  }

  if (value.handoffCheckpoint.continuation.reason !== value.handoffCheckpoint.summary.activeBlocker) {
    throw new Error('compact result input handoffCheckpoint.continuation.reason must match handoffCheckpoint.summary.activeBlocker.');
  }

  if (value.handoffCheckpoint.continuation.nextControlAction !== value.handoffCheckpoint.summary.nextControlAction) {
    throw new Error('compact result input handoffCheckpoint.continuation.nextControlAction must match handoffCheckpoint.summary.nextControlAction.');
  }

  if (value.handoffCheckpoint.continuation.approvalRequired !== value.handoffCheckpoint.summary.approvalContinuationRequired) {
    throw new Error('compact result input handoffCheckpoint.continuation.approvalRequired must match handoffCheckpoint.summary.approvalContinuationRequired.');
  }

  if (value.handoffCheckpoint.continuation.approvalRequired && typeof value.handoffCheckpoint.continuation.command !== 'string') {
    throw new Error('compact result input handoffCheckpoint.continuation.command is required when approvalRequired is true.');
  }

  if (!value.handoffCheckpoint.continuation.approvalRequired && value.handoffCheckpoint.continuation.command !== null) {
    throw new Error('compact result input handoffCheckpoint.continuation.command must be null when approvalRequired is false.');
  }

  if (!Array.isArray(value.handoffCheckpoint.durableSections)) {
    throw new Error('compact result input handoffCheckpoint.durableSections must be an array.');
  }

  const durableSections = value.handoffCheckpoint.durableSections;
  if (durableSections.some(section => !isKnownHandoffCheckpointDurableSection(section))) {
    throw new Error('compact result input handoffCheckpoint.durableSections must use supported section names.');
  }

  if (new Set(durableSections).size !== durableSections.length) {
    throw new Error('compact result input handoffCheckpoint.durableSections must not include duplicate section names.');
  }

  for (const requiredSection of HANDOFF_CHECKPOINT_DURABLE_SECTIONS) {
    if (!durableSections.includes(requiredSection)) {
      throw new Error('compact result input handoffCheckpoint.durableSections must include all required recovery section names.');
    }
  }

  if (!isKnownAgentResultOutcome(value.outcome)) {
    throw new Error('compact result input must include a supported outcome.');
  }

  if (value.handoffCheckpoint.summary.outcome !== value.outcome) {
    throw new Error('compact result input handoffCheckpoint.summary.outcome must match root.outcome.');
  }

  if (typeof value.task !== 'string') {
    throw new Error('compact result input root.task must be a string.');
  }

  if (typeof value.workspaceRoot !== 'string') {
    throw new Error('compact result input root.workspaceRoot must be a string.');
  }

  for (const field of ['modelName', 'profileId']) {
    if (typeof value[field] !== 'string') {
      throw new Error(`compact result input root.${field} must be a string.`);
    }
  }

  if (!isNonNegativeInteger(value.turnsUsed)) {
    throw new Error('compact result input root.turnsUsed must be a non-negative integer.');
  }

  if (!isStringArray(value.requestedDomains)) {
    throw new Error('compact result input root.requestedDomains must be a string array.');
  }

  if (!value.requestedDomains.every(domain => isKnownValidationPlanKind(domain))) {
    throw new Error('compact result input root.requestedDomains must use supported domains.');
  }

  for (const field of ['changedFiles', 'resultCard', 'nextSteps', 'suggestedCommands']) {
    if (!isStringArray(value[field])) {
      throw new Error(`compact result input root.${field} must be a string array.`);
    }
  }

  if (
    Array.isArray(value.changedFiles)
    && value.handoffCheckpoint.summary.changedFileCount !== value.changedFiles.length
  ) {
    throw new Error('compact result input handoffCheckpoint.summary.changedFileCount must match root.changedFiles length.');
  }

  for (const field of ['requestedEnvironment', 'requestedService']) {
    if (field in value && !isStringOrNull(value[field])) {
      throw new Error(`compact result input root.${field} must be string or null when present.`);
    }
  }

  if (value.primaryTarget !== undefined && value.primaryTarget !== null) {
    if (!isRecord(value.primaryTarget)) {
      throw new Error('compact result input root.primaryTarget must be an object or null when present.');
    }

    for (const field of ['kind', 'name', 'path']) {
      if (typeof value.primaryTarget[field] !== 'string') {
        throw new Error(`compact result input root.primaryTarget.${field} must be a string when present.`);
      }
    }

    if (!isNumber(value.primaryTarget.score)) {
      throw new Error('compact result input root.primaryTarget.score must be a number when present.');
    }
  }

  if (isRecord(value.harness)) {
    assertIntegerField(value.harness, 'maxTurns', 'harness', isPositiveInteger, 'a positive integer');

    if (!isRecord(value.harness.queryConfig)) {
      throw new Error('compact result input harness.queryConfig must be an object.');
    }

    assertIntegerField(value.harness.queryConfig, 'maxTurns', 'harness.queryConfig', isPositiveInteger, 'a positive integer');
    assertIntegerField(
      value.harness.queryConfig,
      'maxRepairAttempts',
      'harness.queryConfig',
      isNonNegativeInteger,
      'a non-negative integer'
    );

    if (!isRecord(value.harness.queryConfig.retrievedContextBudget)) {
      throw new Error('compact result input harness.queryConfig.retrievedContextBudget must be an object.');
    }

    for (const field of ['maxPackets', 'maxTokens', 'maxExcerptChars', 'maxFacts']) {
      assertIntegerField(
        value.harness.queryConfig.retrievedContextBudget,
        field,
        'harness.queryConfig.retrievedContextBudget',
        isPositiveInteger,
        'a positive integer'
      );
    }

    if (!isRecord(value.harness.loopBudget)) {
      throw new Error('compact result input harness.loopBudget must be an object.');
    }

    assertIntegerField(value.harness.loopBudget, 'turnsUsed', 'harness.loopBudget', isNonNegativeInteger, 'a non-negative integer');
    assertIntegerField(value.harness.loopBudget, 'maxTurns', 'harness.loopBudget', isPositiveInteger, 'a positive integer');
    assertIntegerField(value.harness.loopBudget, 'turnsRemaining', 'harness.loopBudget', isNonNegativeInteger, 'a non-negative integer');

    if (typeof value.harness.loopBudget.exhausted !== 'boolean') {
      throw new Error('compact result input harness.loopBudget.exhausted must be a boolean.');
    }

    const harnessMaxTurns = value.harness.maxTurns as number;
    const queryConfigMaxTurns = value.harness.queryConfig.maxTurns as number;
    const loopBudgetTurnsUsed = value.harness.loopBudget.turnsUsed as number;
    const loopBudgetMaxTurns = value.harness.loopBudget.maxTurns as number;
    const loopBudgetTurnsRemaining = value.harness.loopBudget.turnsRemaining as number;
    const loopBudgetExhausted = value.harness.loopBudget.exhausted as boolean;

    if (harnessMaxTurns !== queryConfigMaxTurns) {
      throw new Error('compact result input harness.maxTurns must match harness.queryConfig.maxTurns.');
    }

    if (loopBudgetMaxTurns !== harnessMaxTurns) {
      throw new Error('compact result input harness.loopBudget.maxTurns must match harness.maxTurns.');
    }

    if (loopBudgetTurnsUsed !== value.turnsUsed) {
      throw new Error('compact result input root.turnsUsed must match harness.loopBudget.turnsUsed.');
    }

    const expectedTurnsRemaining = Math.max(0, loopBudgetMaxTurns - loopBudgetTurnsUsed);
    if (loopBudgetTurnsRemaining !== expectedTurnsRemaining) {
      throw new Error('compact result input harness.loopBudget.turnsRemaining must match maxTurns minus turnsUsed.');
    }

    if (loopBudgetExhausted !== (loopBudgetTurnsRemaining === 0)) {
      throw new Error('compact result input harness.loopBudget.exhausted must match remaining turn budget.');
    }

    if (!isRecord(value.harness.repairBudget)) {
      throw new Error('compact result input harness.repairBudget must be an object.');
    }

    assertIntegerField(
      value.harness.repairBudget,
      'attemptsUsed',
      'harness.repairBudget',
      isNonNegativeInteger,
      'a non-negative integer'
    );
    assertIntegerField(
      value.harness.repairBudget,
      'maxAttempts',
      'harness.repairBudget',
      isNonNegativeInteger,
      'a non-negative integer'
    );
    assertIntegerField(
      value.harness.repairBudget,
      'attemptsRemaining',
      'harness.repairBudget',
      isNonNegativeInteger,
      'a non-negative integer'
    );

    if (typeof value.harness.repairBudget.exhausted !== 'boolean') {
      throw new Error('compact result input harness.repairBudget.exhausted must be a boolean.');
    }

    const queryConfigMaxRepairAttempts = value.harness.queryConfig.maxRepairAttempts as number;
    const repairBudgetAttemptsUsed = value.harness.repairBudget.attemptsUsed as number;
    const repairBudgetMaxAttempts = value.harness.repairBudget.maxAttempts as number;
    const repairBudgetAttemptsRemaining = value.harness.repairBudget.attemptsRemaining as number;
    const repairBudgetExhausted = value.harness.repairBudget.exhausted as boolean;

    if (repairBudgetMaxAttempts !== queryConfigMaxRepairAttempts) {
      throw new Error('compact result input harness.repairBudget.maxAttempts must match harness.queryConfig.maxRepairAttempts.');
    }

    const expectedRepairAttemptsRemaining = Math.max(0, repairBudgetMaxAttempts - repairBudgetAttemptsUsed);
    if (repairBudgetAttemptsRemaining !== expectedRepairAttemptsRemaining) {
      throw new Error('compact result input harness.repairBudget.attemptsRemaining must match maxAttempts minus attemptsUsed.');
    }

    if (repairBudgetExhausted !== (repairBudgetAttemptsRemaining === 0)) {
      throw new Error('compact result input harness.repairBudget.exhausted must match remaining repair budget.');
    }

    if ('turnTrace' in value.harness && !Array.isArray(value.harness.turnTrace)) {
      throw new Error('compact result input harness.turnTrace must be an array when present.');
    }

    if (Array.isArray(value.harness.turnTrace)) {
      for (let index = 0; index < value.harness.turnTrace.length; index += 1) {
        const entry = value.harness.turnTrace[index];
        const entryPath = `harness.turnTrace[${index}]`;

        if (!isRecord(entry)) {
          throw new Error(`compact result input ${entryPath} must be an object.`);
        }

        assertIntegerField(entry, 'index', entryPath, isNonNegativeInteger, 'a non-negative integer');

        if (!isKnownAgentActionKind(entry.actionKind)) {
          throw new Error(`compact result input ${entryPath}.actionKind must be supported.`);
        }

        if (entry.actionFamily !== null && !isKnownAgentActionFamily(entry.actionFamily)) {
          throw new Error(`compact result input ${entryPath}.actionFamily must be supported or null.`);
        }

        if (!isKnownAgentConfidence(entry.confidence)) {
          throw new Error(`compact result input ${entryPath}.confidence must be supported.`);
        }

        if (typeof entry.summary !== 'string') {
          throw new Error(`compact result input ${entryPath}.summary must be a string.`);
        }

        if (typeof entry.terminal !== 'boolean') {
          throw new Error(`compact result input ${entryPath}.terminal must be a boolean.`);
        }

        if (entry.executionStatus !== null && !isKnownAgentDecisionExecutionStatus(entry.executionStatus)) {
          throw new Error(`compact result input ${entryPath}.executionStatus must be supported or null.`);
        }

        if (!isStringOrNull(entry.executionReason)) {
          throw new Error(`compact result input ${entryPath}.executionReason must be string or null.`);
        }

        for (const field of ['executedToolCount', 'changedFileCount', 'validationIssueCount', 'approvalSignalCount']) {
          assertIntegerField(entry, field, entryPath, isNonNegativeInteger, 'a non-negative integer');
        }

        if (entry.stopReason !== null && !isKnownAgentStopReason(entry.stopReason)) {
          throw new Error(`compact result input ${entryPath}.stopReason must be supported or null.`);
        }

        if (entry.clarificationKind !== null && !isKnownAgentClarificationKind(entry.clarificationKind)) {
          throw new Error(`compact result input ${entryPath}.clarificationKind must be supported or null.`);
        }

        if (entry.actionKind === 'stop' && entry.stopReason === null) {
          throw new Error(`compact result input ${entryPath}.stopReason is required for stop actions.`);
        }

        if (entry.actionKind !== 'stop' && entry.stopReason !== null) {
          throw new Error(`compact result input ${entryPath}.stopReason must be null unless actionKind is stop.`);
        }

        if (entry.actionKind === 'ask-for-clarification' && entry.clarificationKind === null) {
          throw new Error(`compact result input ${entryPath}.clarificationKind is required for clarification actions.`);
        }

        if (entry.actionKind !== 'ask-for-clarification' && entry.clarificationKind !== null) {
          throw new Error(`compact result input ${entryPath}.clarificationKind must be null unless actionKind asks for clarification.`);
        }
      }
    }

    if (isRecord(value.harness.turnTraceBudget)) {
      for (const field of ['maxEntries', 'totalCount', 'includedCount', 'omittedCount']) {
        if (field in value.harness.turnTraceBudget && !isNonNegativeInteger(value.harness.turnTraceBudget[field])) {
          throw new Error(`compact result input harness.turnTraceBudget.${field} must be a non-negative integer when present.`);
        }
      }

      for (const field of ['firstIncludedTurnIndex', 'lastIncludedTurnIndex']) {
        if (
          field in value.harness.turnTraceBudget
          && value.harness.turnTraceBudget[field] !== null
          && !isNonNegativeInteger(value.harness.turnTraceBudget[field])
        ) {
          throw new Error(`compact result input harness.turnTraceBudget.${field} must be a non-negative integer or null when present.`);
        }
      }

      if (
        'preservedWindow' in value.harness.turnTraceBudget
        && !isKnownTurnTracePreservedWindow(value.harness.turnTraceBudget.preservedWindow)
      ) {
        throw new Error('compact result input harness.turnTraceBudget.preservedWindow must be supported when present.');
      }

      if (
        hasNumericCountSet(value.harness.turnTraceBudget)
        && !hasConsistentCountSet(value.harness.turnTraceBudget)
      ) {
        throw new Error('compact result input harness.turnTraceBudget counts must be consistent when present.');
      }

      if (
        isNonNegativeInteger(value.harness.turnTraceBudget.includedCount)
        && isNonNegativeInteger(value.harness.turnTraceBudget.maxEntries)
        && (value.harness.turnTraceBudget.includedCount as number) > (value.harness.turnTraceBudget.maxEntries as number)
      ) {
        throw new Error('compact result input harness.turnTraceBudget.includedCount must not exceed maxEntries.');
      }
    }

    if ('turnTraceLimit' in value.harness && !isNonNegativeInteger(value.harness.turnTraceLimit)) {
      throw new Error('compact result input harness.turnTraceLimit must be a non-negative integer when present.');
    }

    if ('turnTraceOmittedCount' in value.harness && !isNonNegativeInteger(value.harness.turnTraceOmittedCount)) {
      throw new Error('compact result input harness.turnTraceOmittedCount must be a non-negative integer when present.');
    }

    if (Array.isArray(value.harness.turnTrace) && isRecord(value.harness.turnTraceBudget)) {
      const turnTrace = value.harness.turnTrace;

      if (
        isNonNegativeInteger(value.harness.turnTraceBudget.includedCount)
        && value.harness.turnTraceBudget.includedCount !== turnTrace.length
      ) {
        throw new Error('compact result input harness.turnTraceBudget.includedCount must match turnTrace length when present.');
      }

      if (
        isNonNegativeInteger(value.harness.turnTraceLimit)
        && isNonNegativeInteger(value.harness.turnTraceBudget.maxEntries)
        && value.harness.turnTraceLimit !== value.harness.turnTraceBudget.maxEntries
      ) {
        throw new Error('compact result input harness.turnTraceLimit must match harness.turnTraceBudget.maxEntries.');
      }

      if (
        isNonNegativeInteger(value.harness.turnTraceOmittedCount)
        && isNonNegativeInteger(value.harness.turnTraceBudget.omittedCount)
        && value.harness.turnTraceOmittedCount !== value.harness.turnTraceBudget.omittedCount
      ) {
        throw new Error('compact result input harness.turnTraceOmittedCount must match harness.turnTraceBudget.omittedCount.');
      }

      if (
        turnTrace.length === 0
        && (
          value.harness.turnTraceBudget.firstIncludedTurnIndex !== null
          || value.harness.turnTraceBudget.lastIncludedTurnIndex !== null
        )
      ) {
        throw new Error('compact result input harness.turnTraceBudget included turn indexes must be null when turnTrace is empty.');
      }

      if (turnTrace.length > 0) {
        const firstTurnIndex = (turnTrace[0] as Record<string, unknown>).index;
        const lastTurnIndex = (turnTrace[turnTrace.length - 1] as Record<string, unknown>).index;

        if (value.harness.turnTraceBudget.firstIncludedTurnIndex !== firstTurnIndex) {
          throw new Error('compact result input harness.turnTraceBudget.firstIncludedTurnIndex must match first turnTrace entry.');
        }

        if (value.harness.turnTraceBudget.lastIncludedTurnIndex !== lastTurnIndex) {
          throw new Error('compact result input harness.turnTraceBudget.lastIncludedTurnIndex must match last turnTrace entry.');
        }
      }
    }

    if (isRecord(value.harness.stateSummary)) {
      const countKeys = [
        'observationCount',
        'toolSummaryCount',
        'appliedWriteCount',
        'validationResultCount',
        'validationIssueCount',
        'approvalSignalCount',
        'retrievedContextCount',
        'semanticFactCount'
      ];
      if (countKeys.some(key => key in value.harness.stateSummary && !isNonNegativeInteger(value.harness.stateSummary[key]))) {
        throw new Error('compact result input harness.stateSummary counts must be non-negative integers when present.');
      }
    }

    assertCompactWorkPlan(value.harness.workPlan);
    assertCompactTargeting(value.harness.targeting);

    if (
      isRecord(value.harness.toolTrace)
      && 'entries' in value.harness.toolTrace
      && !Array.isArray(value.harness.toolTrace.entries)
    ) {
      throw new Error('compact result input harness.toolTrace.entries must be an array when present.');
    }

    if (isRecord(value.harness.toolTrace)) {
      for (const field of ['maxEntries', 'totalCount', 'includedCount', 'omittedCount']) {
        if (field in value.harness.toolTrace && !isNonNegativeInteger(value.harness.toolTrace[field])) {
          throw new Error(`compact result input harness.toolTrace.${field} must be a non-negative integer when present.`);
        }
      }

      for (const field of ['firstIncludedTurnIndex', 'latestTurnIndex']) {
        if (
          field in value.harness.toolTrace
          && value.harness.toolTrace[field] !== null
          && !isNonNegativeInteger(value.harness.toolTrace[field])
        ) {
          throw new Error(`compact result input harness.toolTrace.${field} must be a non-negative integer or null when present.`);
        }
      }

      if (
        hasNumericCountSet(value.harness.toolTrace)
        && !hasConsistentCountSet(value.harness.toolTrace)
      ) {
        throw new Error('compact result input harness.toolTrace counts must be consistent when present.');
      }

      if (
        isNonNegativeInteger(value.harness.toolTrace.includedCount)
        && isNonNegativeInteger(value.harness.toolTrace.maxEntries)
        && (value.harness.toolTrace.includedCount as number) > (value.harness.toolTrace.maxEntries as number)
      ) {
        throw new Error('compact result input harness.toolTrace.includedCount must not exceed maxEntries.');
      }

      if (Array.isArray(value.harness.toolTrace.entries)) {
        for (let index = 0; index < value.harness.toolTrace.entries.length; index += 1) {
          const entry = value.harness.toolTrace.entries[index];
          const entryPath = `harness.toolTrace.entries[${index}]`;

          if (!isRecord(entry)) {
            throw new Error(`compact result input ${entryPath} must be an object.`);
          }

          assertIntegerField(entry, 'turnIndex', entryPath, isNonNegativeInteger, 'a non-negative integer');

          if (!isKnownAgentActionKind(entry.actionKind)) {
            throw new Error(`compact result input ${entryPath}.actionKind must be supported.`);
          }

          if (typeof entry.toolName !== 'string' || entry.toolName.length === 0) {
            throw new Error(`compact result input ${entryPath}.toolName must be a non-empty string.`);
          }

          if (!isKnownToolSafety(entry.safety)) {
            throw new Error(`compact result input ${entryPath}.safety must be supported.`);
          }

          if (!isKnownToolPermissionCategory(entry.permissionCategory)) {
            throw new Error(`compact result input ${entryPath}.permissionCategory must be supported.`);
          }

          for (const field of ['mutatesWorkspace', 'mutatesExternalState', 'externalCommand', 'approvalRequired']) {
            if (typeof entry[field] !== 'boolean') {
              throw new Error(`compact result input ${entryPath}.${field} must be a boolean.`);
            }
          }

          if (typeof entry.summary !== 'string') {
            throw new Error(`compact result input ${entryPath}.summary must be a string.`);
          }
        }

        if (
          isNonNegativeInteger(value.harness.toolTrace.includedCount)
          && value.harness.toolTrace.includedCount !== value.harness.toolTrace.entries.length
        ) {
          throw new Error('compact result input harness.toolTrace.includedCount must match entries length when present.');
        }

        if (
          value.harness.toolTrace.entries.length === 0
          && value.harness.toolTrace.firstIncludedTurnIndex !== null
        ) {
          throw new Error('compact result input harness.toolTrace.firstIncludedTurnIndex must be null when entries are empty.');
        }

        if (value.harness.toolTrace.entries.length > 0) {
          const firstToolTurnIndex = (value.harness.toolTrace.entries[0] as Record<string, unknown>).turnIndex;
          if (value.harness.toolTrace.firstIncludedTurnIndex !== firstToolTurnIndex) {
            throw new Error('compact result input harness.toolTrace.firstIncludedTurnIndex must match first entry turnIndex.');
          }
        }
      }

      if (isRecord(value.harness.toolTrace.permissionCategoryCounts)) {
        let totalPermissionCategoryCount = 0;
        for (const [category, count] of Object.entries(value.harness.toolTrace.permissionCategoryCounts)) {
          if (!isKnownToolPermissionCategory(category) || !isNonNegativeInteger(count)) {
            throw new Error('compact result input harness.toolTrace.permissionCategoryCounts must use supported non-negative integer counts.');
          }
          totalPermissionCategoryCount += count as number;
        }

        if (
          isNonNegativeInteger(value.harness.toolTrace.totalCount)
          && totalPermissionCategoryCount !== (value.harness.toolTrace.totalCount as number)
        ) {
          throw new Error('compact result input harness.toolTrace.permissionCategoryCounts must sum to totalCount when present.');
        }
      }
    }

    if (isRecord(value.harness.toolPermissionSummary)) {
      const countKeys = [
        'totalToolCount',
        'workspaceMutationToolCount',
        'externalCommandToolCount',
        'externalStateMutationToolCount',
        'approvalRequiredToolCount'
      ];
      if (countKeys.some(key => key in value.harness.toolPermissionSummary && !isNonNegativeInteger(value.harness.toolPermissionSummary[key]))) {
        throw new Error('compact result input harness.toolPermissionSummary counts must be non-negative integers when present.');
      }

      const totalToolCount = isNonNegativeInteger(value.harness.toolPermissionSummary.totalToolCount)
        ? value.harness.toolPermissionSummary.totalToolCount as number
        : null;

      if (totalToolCount !== null) {
        for (const field of countKeys.filter(key => key !== 'totalToolCount')) {
          if (
            isNonNegativeInteger(value.harness.toolPermissionSummary[field])
            && (value.harness.toolPermissionSummary[field] as number) > totalToolCount
          ) {
            throw new Error(`compact result input harness.toolPermissionSummary.${field} must not exceed totalToolCount.`);
          }
        }
      }

      if (isRecord(value.harness.toolPermissionSummary.categories)) {
        let totalCategoryCount = 0;
        for (const [category, count] of Object.entries(value.harness.toolPermissionSummary.categories)) {
          if (!isKnownToolPermissionCategory(category) || !isNonNegativeInteger(count)) {
            throw new Error('compact result input harness.toolPermissionSummary.categories must use supported non-negative integer counts.');
          }
          totalCategoryCount += count as number;
        }

        if (totalToolCount !== null && totalCategoryCount !== totalToolCount) {
          throw new Error('compact result input harness.toolPermissionSummary.categories must sum to totalToolCount when present.');
        }
      }

      if (
        isRecord(value.harness.toolTrace)
        && isRecord(value.harness.toolTrace.permissionCategoryCounts)
        && isRecord(value.harness.toolPermissionSummary.categories)
      ) {
        const traceCategories = value.harness.toolTrace.permissionCategoryCounts;
        const summaryCategories = value.harness.toolPermissionSummary.categories;
        const categoryNames = new Set([
          ...Object.keys(traceCategories),
          ...Object.keys(summaryCategories)
        ]);

        for (const category of categoryNames) {
          if (traceCategories[category] !== summaryCategories[category]) {
            throw new Error('compact result input harness.toolPermissionSummary.categories must match harness.toolTrace.permissionCategoryCounts when present.');
          }
        }
      }
    }

    if (
      isRecord(value.harness.lifecycleEvents)
      && 'events' in value.harness.lifecycleEvents
      && !Array.isArray(value.harness.lifecycleEvents.events)
    ) {
      throw new Error('compact result input harness.lifecycleEvents.events must be an array when present.');
    }

    if (isRecord(value.harness.lifecycleEvents)) {
      for (const field of ['maxEntries', 'totalCount', 'includedCount', 'omittedCount']) {
        if (field in value.harness.lifecycleEvents && !isNonNegativeInteger(value.harness.lifecycleEvents[field])) {
          throw new Error(`compact result input harness.lifecycleEvents.${field} must be a non-negative integer when present.`);
        }
      }

      if (Array.isArray(value.harness.lifecycleEvents.events)) {
        for (let index = 0; index < value.harness.lifecycleEvents.events.length; index += 1) {
          const event = value.harness.lifecycleEvents.events[index];
          const eventPath = `harness.lifecycleEvents.events[${index}]`;

          if (!isRecord(event) || !isKnownLifecycleEventName(event.event)) {
            throw new Error(`compact result input harness.lifecycleEvents.events[${index}].event must be supported.`);
          }

          if (event.turnIndex !== null && !isNonNegativeInteger(event.turnIndex)) {
            throw new Error(`compact result input ${eventPath}.turnIndex must be a non-negative integer or null.`);
          }

          if (event.actionKind !== null && !isKnownAgentActionKind(event.actionKind)) {
            throw new Error(`compact result input ${eventPath}.actionKind must be supported or null.`);
          }

          if (event.actionFamily !== null && !isKnownAgentActionFamily(event.actionFamily)) {
            throw new Error(`compact result input ${eventPath}.actionFamily must be supported or null.`);
          }

          if (event.executionStatus !== null && !isKnownAgentDecisionExecutionStatus(event.executionStatus)) {
            throw new Error(`compact result input ${eventPath}.executionStatus must be supported or null.`);
          }

          if (!isStringOrNull(event.reason)) {
            throw new Error(`compact result input ${eventPath}.reason must be string or null.`);
          }

          for (const field of ['toolCount', 'approvalSignalCount', 'validationIssueCount']) {
            assertIntegerField(event, field, eventPath, isNonNegativeInteger, 'a non-negative integer');
          }

          if (event.outcome !== null && !isKnownAgentResultOutcome(event.outcome)) {
            throw new Error(`compact result input ${eventPath}.outcome must be supported or null.`);
          }
        }

        if (
          isNonNegativeInteger(value.harness.lifecycleEvents.includedCount)
          && value.harness.lifecycleEvents.includedCount !== value.harness.lifecycleEvents.events.length
        ) {
          throw new Error('compact result input harness.lifecycleEvents.includedCount must match events length when present.');
        }

        if (
          isNonNegativeInteger(value.harness.lifecycleEvents.includedCount)
          && isNonNegativeInteger(value.harness.lifecycleEvents.maxEntries)
          && (value.harness.lifecycleEvents.includedCount as number) > (value.harness.lifecycleEvents.maxEntries as number)
        ) {
          throw new Error('compact result input harness.lifecycleEvents.includedCount must not exceed maxEntries.');
        }
      }

      if (isRecord(value.harness.lifecycleEvents.eventCounts)) {
        let totalLifecycleEventCount = 0;
        for (const [eventName, count] of Object.entries(value.harness.lifecycleEvents.eventCounts)) {
          if (!isKnownLifecycleEventName(eventName) || !isNonNegativeInteger(count)) {
            throw new Error('compact result input harness.lifecycleEvents.eventCounts must use supported non-negative integer event counts.');
          }
          totalLifecycleEventCount += count as number;
        }

        if (
          isNonNegativeInteger(value.harness.lifecycleEvents.totalCount)
          && totalLifecycleEventCount !== (value.harness.lifecycleEvents.totalCount as number)
        ) {
          throw new Error('compact result input harness.lifecycleEvents.eventCounts must sum to totalCount when present.');
        }
      }

      if (
        hasNumericCountSet(value.harness.lifecycleEvents)
        && !hasConsistentCountSet(value.harness.lifecycleEvents)
      ) {
        throw new Error('compact result input harness.lifecycleEvents counts must be consistent when present.');
      }
    }

    if (isRecord(value.harness.plannerHandoff)) {
      if (!isRecord(value.harness.plannerHandoff.lastAction)) {
        throw new Error('compact result input harness.plannerHandoff.lastAction must be an object when present.');
      }

      const lastAction = value.harness.plannerHandoff.lastAction;
      if (lastAction.kind !== null && !isKnownAgentActionKind(lastAction.kind)) {
        throw new Error('compact result input harness.plannerHandoff.lastAction.kind must be supported or null.');
      }

      if (lastAction.family !== null && !isKnownAgentActionFamily(lastAction.family)) {
        throw new Error('compact result input harness.plannerHandoff.lastAction.family must be supported or null.');
      }

      if (lastAction.stopReason !== null && !isKnownAgentStopReason(lastAction.stopReason)) {
        throw new Error('compact result input harness.plannerHandoff.lastAction.stopReason must be supported or null.');
      }

      if (lastAction.clarificationKind !== null && !isKnownAgentClarificationKind(lastAction.clarificationKind)) {
        throw new Error('compact result input harness.plannerHandoff.lastAction.clarificationKind must be supported or null.');
      }

      if (lastAction.executionStatus !== null && !isKnownAgentDecisionExecutionStatus(lastAction.executionStatus)) {
        throw new Error('compact result input harness.plannerHandoff.lastAction.executionStatus must be supported or null.');
      }

      if (lastAction.kind === 'stop' && lastAction.stopReason === null) {
        throw new Error('compact result input harness.plannerHandoff.lastAction.stopReason is required for stop actions.');
      }

      if (lastAction.kind !== 'stop' && lastAction.stopReason !== null) {
        throw new Error('compact result input harness.plannerHandoff.lastAction.stopReason must be null unless kind is stop.');
      }

      if (lastAction.kind === 'ask-for-clarification' && lastAction.clarificationKind === null) {
        throw new Error('compact result input harness.plannerHandoff.lastAction.clarificationKind is required for clarification actions.');
      }

      if (lastAction.kind !== 'ask-for-clarification' && lastAction.clarificationKind !== null) {
        throw new Error('compact result input harness.plannerHandoff.lastAction.clarificationKind must be null unless kind asks for clarification.');
      }

      if (
        isRecord(value.harness.plannerHandoff.activeBlocker)
        && !isKnownPlannerHandoffActiveBlocker(value.harness.plannerHandoff.activeBlocker.kind)
      ) {
        throw new Error('compact result input harness.plannerHandoff.activeBlocker.kind must be supported when present.');
      }

      if (!isRecord(value.harness.plannerHandoff.activeBlocker)) {
        throw new Error('compact result input harness.plannerHandoff.activeBlocker must be an object when present.');
      }

      const activeBlocker = value.harness.plannerHandoff.activeBlocker;
      if (activeBlocker.validationIssueKind !== null && !isKnownValidationIssueKind(activeBlocker.validationIssueKind)) {
        throw new Error('compact result input harness.plannerHandoff.activeBlocker.validationIssueKind must be supported or null.');
      }

      if (activeBlocker.approvalSignalKind !== null && !isKnownApprovalSignalKind(activeBlocker.approvalSignalKind)) {
        throw new Error('compact result input harness.plannerHandoff.activeBlocker.approvalSignalKind must be supported or null.');
      }

      if (activeBlocker.kind !== 'validation' && activeBlocker.validationIssueKind !== null) {
        throw new Error('compact result input harness.plannerHandoff.activeBlocker.validationIssueKind must be null unless blocker kind is validation.');
      }

      if (activeBlocker.kind !== 'approval' && activeBlocker.approvalSignalKind !== null) {
        throw new Error('compact result input harness.plannerHandoff.activeBlocker.approvalSignalKind must be null unless blocker kind is approval.');
      }

      if (!isKnownPlannerHandoffNextControlAction(value.harness.plannerHandoff.nextControlAction)) {
        throw new Error('compact result input harness.plannerHandoff.nextControlAction must be supported when present.');
      }

      const expectedActiveBlockerKind = (() => {
        switch (value.outcome) {
          case 'completed':
            return 'none';
          case 'approval-required':
            return 'approval';
          case 'clarification-required':
            return 'clarification';
          case 'validation-blocked':
            return 'validation';
          case 'repair-budget-exhausted':
            return 'repair-budget';
          case 'no-safe-action':
            return isRecord(value.harness) && isRecord(value.harness.loopBudget) && value.harness.loopBudget.exhausted === true
              ? 'turn-budget'
              : 'no-safe-action';
        }
      })();
      if (activeBlocker.kind !== expectedActiveBlockerKind) {
        throw new Error('compact result input harness.plannerHandoff.activeBlocker.kind must match outcome.');
      }

      const expectedNextControlAction = (() => {
        switch (value.outcome) {
          case 'completed':
            return 'review-result';
          case 'approval-required':
            return 'request-approval';
          case 'clarification-required':
            return 'answer-clarification';
          case 'validation-blocked':
            return 'resolve-validation';
          case 'repair-budget-exhausted':
            return 'manual-repair';
          case 'no-safe-action':
            return expectedActiveBlockerKind === 'turn-budget'
              ? 'rerun-with-larger-turn-budget'
              : 'inspect-readiness-or-targeting';
        }
      })();
      if (value.harness.plannerHandoff.nextControlAction !== expectedNextControlAction) {
        throw new Error('compact result input harness.plannerHandoff.nextControlAction must match outcome.');
      }

      if (value.handoffCheckpoint.summary.activeBlocker !== activeBlocker.kind) {
        throw new Error('compact result input handoffCheckpoint.summary.activeBlocker must match harness.plannerHandoff.activeBlocker.kind.');
      }

      if (value.handoffCheckpoint.summary.nextControlAction !== value.harness.plannerHandoff.nextControlAction) {
        throw new Error('compact result input handoffCheckpoint.summary.nextControlAction must match harness.plannerHandoff.nextControlAction.');
      }
    }

    assertCompactWorkPlanConsistency(value.harness.workPlan, value);

    if (isRecord(value.harness.turnTraceBudget)) {
      assertHandoffBudgetMatches(
        value.handoffCheckpoint.budgets.turnTrace,
        'handoffCheckpoint.budgets.turnTrace',
        value.harness.turnTraceBudget.includedCount as number,
        value.harness.turnTraceBudget.omittedCount as number,
        'harness.turnTraceBudget'
      );
    }

    if (isRecord(value.harness.lifecycleEvents)) {
      assertHandoffBudgetMatches(
        value.handoffCheckpoint.budgets.lifecycleEvents,
        'handoffCheckpoint.budgets.lifecycleEvents',
        value.harness.lifecycleEvents.includedCount as number,
        value.harness.lifecycleEvents.omittedCount as number,
        'harness.lifecycleEvents'
      );
    }

    if (isRecord(value.harness.toolTrace)) {
      assertHandoffBudgetMatches(
        value.handoffCheckpoint.budgets.toolTrace,
        'handoffCheckpoint.budgets.toolTrace',
        value.harness.toolTrace.includedCount as number,
        value.harness.toolTrace.omittedCount as number,
        'harness.toolTrace'
      );
    }

    if (isRecord(value.harness.workPlan)) {
      assertHandoffBudgetMatches(
        value.handoffCheckpoint.budgets.workPlan,
        'handoffCheckpoint.budgets.workPlan',
        value.harness.workPlan.includedCount as number,
        value.harness.workPlan.omittedCount as number,
        'harness.workPlan'
      );
    }

    if (isRecord(value.harness.targeting)) {
      assertHandoffBudgetMatches(
        value.handoffCheckpoint.budgets.targeting,
        'handoffCheckpoint.budgets.targeting',
        value.harness.targeting.includedCount as number,
        value.harness.targeting.omittedCount as number,
        'harness.targeting'
      );
    }
  }

  if (isRecord(value.readiness)) {
    if (!isKnownDoctorCheckStatus(value.readiness.status)) {
      throw new Error('compact result input readiness.status must be supported when present.');
    }

    for (const field of ['passCount', 'warnCount', 'failCount']) {
      assertIntegerField(value.readiness, field, 'readiness', isNonNegativeInteger, 'a non-negative integer');
    }

    if (typeof value.readiness.doctorCommand !== 'string') {
      throw new Error('compact result input readiness.doctorCommand must be a string when present.');
    }

    if (!Array.isArray(value.readiness.checks)) {
      throw new Error('compact result input readiness.checks must be an array when present.');
    }

    const statusCounts = {
      pass: 0,
      warn: 0,
      fail: 0
    };

    for (let index = 0; index < value.readiness.checks.length; index += 1) {
      const check = value.readiness.checks[index];
      const checkPath = `readiness.checks[${index}]`;

      if (!isRecord(check)) {
        throw new Error(`compact result input ${checkPath} must be an object.`);
      }

      if (typeof check.name !== 'string' || check.name.length === 0) {
        throw new Error(`compact result input ${checkPath}.name must be a non-empty string.`);
      }

      if (!isKnownDoctorCheckStatus(check.status)) {
        throw new Error(`compact result input ${checkPath}.status must be supported.`);
      }

      if (typeof check.message !== 'string') {
        throw new Error(`compact result input ${checkPath}.message must be a string.`);
      }

      if (!isStringOrNull(check.detail)) {
        throw new Error(`compact result input ${checkPath}.detail must be string or null.`);
      }

      statusCounts[check.status as keyof typeof statusCounts] += 1;
    }

    if (
      value.readiness.passCount !== statusCounts.pass
      || value.readiness.warnCount !== statusCounts.warn
      || value.readiness.failCount !== statusCounts.fail
    ) {
      throw new Error('compact result input readiness counts must match checks by status.');
    }

    const expectedReadinessStatus = statusCounts.fail > 0 ? 'fail' : statusCounts.warn > 0 ? 'warn' : 'pass';
    if (value.readiness.status !== expectedReadinessStatus) {
      throw new Error('compact result input readiness.status must match check counts.');
    }

    if (value.handoffCheckpoint.summary.readinessStatus !== value.readiness.status) {
      throw new Error('compact result input handoffCheckpoint.summary.readinessStatus must match readiness.status.');
    }
  }

  if (!isRecord(value.validation) || !Array.isArray(value.validation.identityConflicts)) {
    throw new Error('compact result input must include validation.identityConflicts array.');
  }

  if (typeof value.validation.status !== 'string') {
    throw new Error('compact result input validation.status must be a string.');
  }

  if (value.handoffCheckpoint.summary.validationStatus !== value.validation.status) {
    throw new Error('compact result input handoffCheckpoint.summary.validationStatus must match validation.status.');
  }

  if (!isRecord(value.validation.identityConflictSummary)) {
    throw new Error('compact result input must include validation.identityConflictSummary object.');
  }

  for (const field of ['totalCount', 'includedCount', 'maxEntries', 'omittedCount']) {
    assertIntegerField(
      value.validation.identityConflictSummary,
      field,
      'validation.identityConflictSummary',
      isNonNegativeInteger,
      'a non-negative integer'
    );
  }

  if (value.validation.identityConflictSummary.mutationAllowed !== false) {
    throw new Error('compact result input validation.identityConflictSummary.mutationAllowed must be false.');
  }

  if (
    !hasConsistentCountSet(value.validation.identityConflictSummary)
  ) {
    throw new Error('compact result input validation.identityConflictSummary counts must be consistent.');
  }

  if (
    (value.validation.identityConflictSummary.includedCount as number)
    > (value.validation.identityConflictSummary.maxEntries as number)
  ) {
    throw new Error('compact result input validation.identityConflictSummary.includedCount must not exceed maxEntries.');
  }

  if ((value.validation.identityConflictSummary.includedCount as number) !== value.validation.identityConflicts.length) {
    throw new Error('compact result input validation.identityConflictSummary.includedCount must match validation.identityConflicts length.');
  }

  if (!isRecord(value.validation.identityConflictSummary.byEngine)) {
    throw new Error('compact result input validation.identityConflictSummary.byEngine must be an object.');
  }

  assertNumericMap(
    value.validation.identityConflictSummary.byEngine,
    'validation.identityConflictSummary.byEngine',
    isKnownIdentityConflictEngine
  );

  if (!isRecord(value.validation.identityConflictSummary.byRiskCategory)) {
    throw new Error('compact result input validation.identityConflictSummary.byRiskCategory must be an object.');
  }

  assertNumericMap(
    value.validation.identityConflictSummary.byRiskCategory,
    'validation.identityConflictSummary.byRiskCategory',
    isKnownIdentityConflictRiskCategory
  );

  const byEngineTotal = Object.values(value.validation.identityConflictSummary.byEngine)
    .reduce((total, count) => total + (count as number), 0);
  if (byEngineTotal !== value.validation.identityConflictSummary.totalCount) {
    throw new Error('compact result input validation.identityConflictSummary.byEngine counts must sum to totalCount.');
  }

  const byRiskCategoryTotal = Object.values(value.validation.identityConflictSummary.byRiskCategory)
    .reduce((total, count) => total + (count as number), 0);
  if (byRiskCategoryTotal !== value.validation.identityConflictSummary.totalCount) {
    throw new Error('compact result input validation.identityConflictSummary.byRiskCategory counts must sum to totalCount.');
  }

  for (const field of ['targetCommandCount', 'yamlGuardCount']) {
    if (field in value.validation && !isNonNegativeInteger(value.validation[field])) {
      throw new Error(`compact result input validation.${field} must be a non-negative integer when present.`);
    }
  }

  if (!Array.isArray(value.validation.selectedPlan)) {
    throw new Error('compact result input must include validation.selectedPlan array.');
  }

  for (let index = 0; index < value.validation.selectedPlan.length; index += 1) {
    const entry = value.validation.selectedPlan[index];
    const entryPath = `validation.selectedPlan[${index}]`;

    if (!isRecord(entry)) {
      throw new Error(`compact result input ${entryPath} must be an object.`);
    }

    if (!isKnownValidationPlanKind(entry.kind)) {
      throw new Error(`compact result input ${entryPath}.kind must be supported.`);
    }

    if (typeof entry.target !== 'string' || entry.target.length === 0) {
      throw new Error(`compact result input ${entryPath}.target must be a non-empty string.`);
    }

    for (const field of ['commandCount', 'executedCommandCount', 'failedCommandCount']) {
      assertIntegerField(entry, field, entryPath, isNonNegativeInteger, 'a non-negative integer');
    }

    if (
      !Array.isArray(entry.commands)
      || !entry.commands.every(command => typeof command === 'string' && command.length > 0)
    ) {
      throw new Error(`compact result input ${entryPath}.commands must be a non-empty string array.`);
    }

    if (typeof entry.validatorAvailable !== 'boolean') {
      throw new Error(`compact result input ${entryPath}.validatorAvailable must be a boolean.`);
    }

    if (entry.commandCount !== entry.commands.length) {
      throw new Error(`compact result input ${entryPath}.commandCount must match commands length.`);
    }

    if ((entry.executedCommandCount as number) > (entry.commandCount as number)) {
      throw new Error(`compact result input ${entryPath}.executedCommandCount must not exceed commandCount.`);
    }

    if ((entry.failedCommandCount as number) > (entry.executedCommandCount as number)) {
      throw new Error(`compact result input ${entryPath}.failedCommandCount must not exceed executedCommandCount.`);
    }
  }

  if (isRecord(value.validation.commands)) {
    for (const field of ['maxEntries', 'omittedCount']) {
      if (field in value.validation.commands && !isNonNegativeInteger(value.validation.commands[field])) {
        throw new Error(`compact result input validation.commands.${field} must be a non-negative integer when present.`);
      }
    }

    if ('entries' in value.validation.commands && !Array.isArray(value.validation.commands.entries)) {
      throw new Error('compact result input validation.commands.entries must be an array when present.');
    }

    if (Array.isArray(value.validation.commands.entries)) {
      if (
        isNonNegativeInteger(value.validation.commands.maxEntries)
        && value.validation.commands.entries.length > (value.validation.commands.maxEntries as number)
      ) {
        throw new Error('compact result input validation.commands.entries length must not exceed maxEntries.');
      }

      for (let index = 0; index < value.validation.commands.entries.length; index += 1) {
        const entry = value.validation.commands.entries[index];
        const entryPath = `validation.commands.entries[${index}]`;

        if (!isRecord(entry)) {
          throw new Error(`compact result input ${entryPath} must be an object.`);
        }

        if (typeof entry.command !== 'string' || entry.command.length === 0) {
          throw new Error(`compact result input ${entryPath}.command must be a non-empty string.`);
        }

        assertIntegerField(entry, 'exitCode', entryPath, isNonNegativeInteger, 'a non-negative integer');

        if (!isKnownValidationCommandStatus(entry.status)) {
          throw new Error(`compact result input ${entryPath}.status must be supported.`);
        }

        if (!isKnownValidationCommandKind(entry.kind)) {
          throw new Error(`compact result input ${entryPath}.kind must be supported.`);
        }

        if (typeof entry.stdoutPreview !== 'string') {
          throw new Error(`compact result input ${entryPath}.stdoutPreview must be a string.`);
        }

        if (typeof entry.stderrPreview !== 'string') {
          throw new Error(`compact result input ${entryPath}.stderrPreview must be a string.`);
        }

        if (typeof entry.unsafeBlocked !== 'boolean') {
          throw new Error(`compact result input ${entryPath}.unsafeBlocked must be a boolean.`);
        }

        if (!isStringOrNull(entry.unsafeRuleId)) {
          throw new Error(`compact result input ${entryPath}.unsafeRuleId must be string or null.`);
        }

        if (!isStringOrNull(entry.unsafeReason)) {
          throw new Error(`compact result input ${entryPath}.unsafeReason must be string or null.`);
        }

        const exitCode = entry.exitCode as number;
        if (entry.status === 'passed' && exitCode !== 0) {
          throw new Error(`compact result input ${entryPath}.status must match exitCode.`);
        }

        if (entry.status === 'failed' && exitCode === 0) {
          throw new Error(`compact result input ${entryPath}.status must match exitCode.`);
        }

        if (entry.unsafeBlocked && (typeof entry.unsafeRuleId !== 'string' || typeof entry.unsafeReason !== 'string')) {
          throw new Error(`compact result input ${entryPath}.unsafeRuleId and unsafeReason must be strings when unsafeBlocked is true.`);
        }

        if (!entry.unsafeBlocked && (entry.unsafeRuleId !== null || entry.unsafeReason !== null)) {
          throw new Error(`compact result input ${entryPath}.unsafeRuleId and unsafeReason must be null when unsafeBlocked is false.`);
        }
      }

      if (value.validation.commands.omittedCount === 0) {
        const targetCommandCount = value.validation.commands.entries
          .filter(entry => isRecord(entry) && entry.kind === 'target-validation')
          .length;
        const yamlGuardCount = value.validation.commands.entries
          .filter(entry => isRecord(entry) && entry.kind === 'yaml-guard')
          .length;
        const selectedPlanCommandOwners = new Map<string, number>();
        const selectedPlanExecutedCounts = Array(value.validation.selectedPlan.length).fill(0) as number[];
        const selectedPlanFailedCounts = Array(value.validation.selectedPlan.length).fill(0) as number[];

        for (let selectedPlanIndex = 0; selectedPlanIndex < value.validation.selectedPlan.length; selectedPlanIndex += 1) {
          const selectedPlanEntry = value.validation.selectedPlan[selectedPlanIndex];
          if (!isRecord(selectedPlanEntry) || !Array.isArray(selectedPlanEntry.commands)) {
            continue;
          }

          for (const command of selectedPlanEntry.commands) {
            if (typeof command !== 'string') {
              continue;
            }

            const existingOwner = selectedPlanCommandOwners.get(command);
            if (existingOwner !== undefined && existingOwner !== selectedPlanIndex) {
              throw new Error(`compact result input validation.selectedPlan command "${command}" is owned by both validation.selectedPlan[${existingOwner}] and validation.selectedPlan[${selectedPlanIndex}].`);
            }

            selectedPlanCommandOwners.set(command, selectedPlanIndex);
          }
        }

        for (let commandIndex = 0; commandIndex < value.validation.commands.entries.length; commandIndex += 1) {
          const commandEntry = value.validation.commands.entries[commandIndex];
          if (!isRecord(commandEntry) || commandEntry.kind !== 'target-validation') {
            continue;
          }

          const ownerIndex = selectedPlanCommandOwners.get(commandEntry.command as string);
          if (ownerIndex === undefined) {
            throw new Error(`compact result input validation.commands.entries[${commandIndex}].command must exist in validation.selectedPlan commands when no commands are omitted.`);
          }

          selectedPlanExecutedCounts[ownerIndex] += 1;
          if (commandEntry.status === 'failed') {
            selectedPlanFailedCounts[ownerIndex] += 1;
          }
        }

        for (let selectedPlanIndex = 0; selectedPlanIndex < value.validation.selectedPlan.length; selectedPlanIndex += 1) {
          const selectedPlanEntry = value.validation.selectedPlan[selectedPlanIndex];
          if (!isRecord(selectedPlanEntry)) {
            continue;
          }

          if (selectedPlanEntry.executedCommandCount !== selectedPlanExecutedCounts[selectedPlanIndex]) {
            throw new Error(`compact result input validation.selectedPlan[${selectedPlanIndex}].executedCommandCount must match validation.commands target-validation entries when no commands are omitted.`);
          }

          if (selectedPlanEntry.failedCommandCount !== selectedPlanFailedCounts[selectedPlanIndex]) {
            throw new Error(`compact result input validation.selectedPlan[${selectedPlanIndex}].failedCommandCount must match failed validation.commands target-validation entries when no commands are omitted.`);
          }
        }

        if (value.validation.targetCommandCount !== targetCommandCount) {
          throw new Error('compact result input validation.targetCommandCount must match validation.commands target-validation entries when no commands are omitted.');
        }

        if (value.validation.yamlGuardCount !== yamlGuardCount) {
          throw new Error('compact result input validation.yamlGuardCount must match validation.commands yaml-guard entries when no commands are omitted.');
        }
      }
    }

    if (
      Array.isArray(value.validation.commands.entries)
      && isNonNegativeInteger(value.validation.commands.omittedCount)
    ) {
      assertHandoffBudgetMatches(
        value.handoffCheckpoint.budgets.validationCommands,
        'handoffCheckpoint.budgets.validationCommands',
        value.validation.commands.entries.length,
        value.validation.commands.omittedCount as number,
        'validation.commands'
      );
    }
  }

  if (!isRecord(value.validation.issueSummary)) {
    throw new Error('compact result input must include validation.issueSummary object.');
  }

  for (const field of [
    'totalCount',
    'omittedIssueCount',
    'repairableCount',
    'nonRepairableCount',
    'maxGroups',
    'omittedGroupCount'
  ]) {
    assertIntegerField(
      value.validation.issueSummary,
      field,
      'validation.issueSummary',
      isNonNegativeInteger,
      'a non-negative integer'
    );
  }

  const issueSummaryTotalCount = value.validation.issueSummary.totalCount as number;
  const issueSummaryRepairableCount = value.validation.issueSummary.repairableCount as number;
  const issueSummaryNonRepairableCount = value.validation.issueSummary.nonRepairableCount as number;
  const issueSummaryMaxGroups = value.validation.issueSummary.maxGroups as number;
  const issueSummaryOmittedGroupCount = value.validation.issueSummary.omittedGroupCount as number;

  if (issueSummaryRepairableCount + issueSummaryNonRepairableCount !== issueSummaryTotalCount) {
    throw new Error('compact result input validation.issueSummary repairable counts must sum to totalCount.');
  }

  if (!Array.isArray(value.validation.issueSummary.groups)) {
    throw new Error('compact result input validation.issueSummary.groups must be an array.');
  }

  if (value.validation.issueSummary.groups.length > issueSummaryMaxGroups) {
    throw new Error('compact result input validation.issueSummary.groups length must not exceed maxGroups.');
  }

  let groupedIssueCount = 0;
  let groupedRepairableCount = 0;
  let groupedNonRepairableCount = 0;
  const groupedIssueKinds = new Set<string>();

  for (let index = 0; index < value.validation.issueSummary.groups.length; index += 1) {
    const group = value.validation.issueSummary.groups[index];
    const groupPath = `validation.issueSummary.groups[${index}]`;

    if (!isRecord(group)) {
      throw new Error(`compact result input ${groupPath} must be an object.`);
    }

    if (!isKnownValidationIssueKind(group.kind)) {
      throw new Error(`compact result input ${groupPath}.kind must be supported.`);
    }

    if (typeof group.repairable !== 'boolean') {
      throw new Error(`compact result input ${groupPath}.repairable must be a boolean.`);
    }

    assertIntegerField(group, 'count', groupPath, isPositiveInteger, 'a positive integer');
    assertIntegerField(group, 'sourceCommandCount', groupPath, isPositiveInteger, 'a positive integer');

    if (typeof group.blocking !== 'boolean') {
      throw new Error(`compact result input ${groupPath}.blocking must be a boolean.`);
    }

    groupedIssueCount += group.count as number;
    if (group.repairable) {
      groupedRepairableCount += group.count as number;
    } else {
      groupedNonRepairableCount += group.count as number;
    }
    groupedIssueKinds.add(group.kind as string);
  }

  if (groupedIssueCount > issueSummaryTotalCount) {
    throw new Error('compact result input validation.issueSummary group counts must not exceed totalCount.');
  }

  if (issueSummaryOmittedGroupCount === 0 && groupedIssueCount !== issueSummaryTotalCount) {
    throw new Error('compact result input validation.issueSummary group counts must match totalCount when no groups are omitted.');
  }

  if (issueSummaryOmittedGroupCount === 0 && groupedRepairableCount !== issueSummaryRepairableCount) {
    throw new Error('compact result input validation.issueSummary repairable group counts must match repairableCount when no groups are omitted.');
  }

  if (issueSummaryOmittedGroupCount === 0 && groupedNonRepairableCount !== issueSummaryNonRepairableCount) {
    throw new Error('compact result input validation.issueSummary non-repairable group counts must match nonRepairableCount when no groups are omitted.');
  }

  if (!isRecord(value.validation.issueSummary.flags)) {
    throw new Error('compact result input validation.issueSummary.flags must be an object.');
  }

  const issueSummaryFlags = value.validation.issueSummary.flags;
  for (const field of [
    'hasRepairableIssues',
    'hasNonRepairableIssues',
    'hasUnsafeValidationCommand',
    'hasYamlSyntaxFailure',
    'hasIdentityConflict'
  ]) {
    if (typeof issueSummaryFlags[field] !== 'boolean') {
      throw new Error(`compact result input validation.issueSummary.flags.${field} must be a boolean.`);
    }
  }

  if (issueSummaryFlags.hasRepairableIssues !== (issueSummaryRepairableCount > 0)) {
    throw new Error('compact result input validation.issueSummary.flags.hasRepairableIssues must match repairableCount.');
  }

  if (issueSummaryFlags.hasNonRepairableIssues !== (issueSummaryNonRepairableCount > 0)) {
    throw new Error('compact result input validation.issueSummary.flags.hasNonRepairableIssues must match nonRepairableCount.');
  }

  if (issueSummaryOmittedGroupCount === 0) {
    if (issueSummaryFlags.hasUnsafeValidationCommand !== groupedIssueKinds.has('unsafe-validation-command')) {
      throw new Error('compact result input validation.issueSummary.flags.hasUnsafeValidationCommand must match groups when no groups are omitted.');
    }

    if (issueSummaryFlags.hasYamlSyntaxFailure !== groupedIssueKinds.has('yaml-syntax-failure')) {
      throw new Error('compact result input validation.issueSummary.flags.hasYamlSyntaxFailure must match groups when no groups are omitted.');
    }

    const hasIdentityConflict = groupedIssueKinds.has('terraform-create-before-delete-conflict')
      || groupedIssueKinds.has('pulumi-create-before-delete-conflict');
    if (issueSummaryFlags.hasIdentityConflict !== hasIdentityConflict) {
      throw new Error('compact result input validation.issueSummary.flags.hasIdentityConflict must match groups when no groups are omitted.');
    }
  }

  assertHandoffBudgetMatches(
    value.handoffCheckpoint.budgets.validationIssueGroups,
    'handoffCheckpoint.budgets.validationIssueGroups',
    value.validation.issueSummary.groups.length,
    issueSummaryOmittedGroupCount,
    'validation.issueSummary'
  );

  if (!isRecord(value.validation.issueDetails)) {
    throw new Error('compact result input must include validation.issueDetails object.');
  }

  for (const field of ['maxEntries', 'omittedCount']) {
    assertIntegerField(
      value.validation.issueDetails,
      field,
      'validation.issueDetails',
      isNonNegativeInteger,
      'a non-negative integer'
    );
  }

  if (value.validation.issueDetails.omittedCount !== value.validation.issueSummary.omittedIssueCount) {
    throw new Error('compact result input validation.issueDetails.omittedCount must match validation.issueSummary.omittedIssueCount.');
  }

  if (!Array.isArray(value.validation.issues)) {
    throw new Error('compact result input must include validation.issues array.');
  }

  const sampledIssueOmittedCount = value.validation.issueDetails.omittedCount as number;
  if (value.validation.issues.length > (value.validation.issueDetails.maxEntries as number)) {
    throw new Error('compact result input validation.issues length must not exceed validation.issueDetails.maxEntries.');
  }

  if (value.validation.issues.length + sampledIssueOmittedCount !== issueSummaryTotalCount) {
    throw new Error('compact result input validation.issues length plus omitted count must match validation.issueSummary.totalCount.');
  }

  assertHandoffBudgetMatches(
    value.handoffCheckpoint.budgets.validationIssues,
    'handoffCheckpoint.budgets.validationIssues',
    value.validation.issues.length,
    sampledIssueOmittedCount,
    'validation.issueDetails'
  );

  let sampledRepairableCount = 0;
  let sampledNonRepairableCount = 0;
  const sampledIssueGroupCounts = new Map<string, number>();

  for (let index = 0; index < value.validation.issues.length; index += 1) {
    const issue = value.validation.issues[index];
    const issuePath = `validation.issues[${index}]`;

    if (!isRecord(issue)) {
      throw new Error(`compact result input ${issuePath} must be an object.`);
    }

    if (!isKnownValidationIssueKind(issue.kind)) {
      throw new Error(`compact result input ${issuePath}.kind must be supported.`);
    }

    if (typeof issue.repairable !== 'boolean') {
      throw new Error(`compact result input ${issuePath}.repairable must be a boolean.`);
    }

    if (typeof issue.message !== 'string' || issue.message.length === 0) {
      throw new Error(`compact result input ${issuePath}.message must be a non-empty string.`);
    }

    if ('guidance' in issue && !isStringOrNull(issue.guidance)) {
      throw new Error(`compact result input ${issuePath}.guidance must be string or null when present.`);
    }

    if ('metadata' in issue) {
      if (!isRecord(issue.metadata)) {
        throw new Error(`compact result input ${issuePath}.metadata must be an object when present.`);
      }

      for (const [key, metadataValue] of Object.entries(issue.metadata)) {
        if (typeof metadataValue !== 'string') {
          throw new Error(`compact result input ${issuePath}.metadata.${key} must be a string.`);
        }
      }
    }

    if (issue.repairable) {
      sampledRepairableCount += 1;
    } else {
      sampledNonRepairableCount += 1;
    }

    const issueGroupKey = `${issue.kind}:${issue.repairable}`;
    sampledIssueGroupCounts.set(issueGroupKey, (sampledIssueGroupCounts.get(issueGroupKey) ?? 0) + 1);
  }

  if (sampledIssueOmittedCount === 0) {
    if (sampledRepairableCount !== issueSummaryRepairableCount) {
      throw new Error('compact result input validation.issues repairable count must match validation.issueSummary when no issues are omitted.');
    }

    if (sampledNonRepairableCount !== issueSummaryNonRepairableCount) {
      throw new Error('compact result input validation.issues non-repairable count must match validation.issueSummary when no issues are omitted.');
    }

    for (let index = 0; index < value.validation.issueSummary.groups.length; index += 1) {
      const group = value.validation.issueSummary.groups[index] as Record<string, unknown>;
      const groupKey = `${group.kind}:${group.repairable}`;
      if (sampledIssueGroupCounts.get(groupKey) !== group.count) {
        throw new Error('compact result input validation.issues group counts must match validation.issueSummary.groups when no issues are omitted.');
      }
    }
  }

  if (!isRecord(value.validation.safetyBlockers)) {
    throw new Error('compact result input must include validation.safetyBlockers object.');
  }

  for (const field of ['maxEntries', 'omittedCount']) {
    assertIntegerField(
      value.validation.safetyBlockers,
      field,
      'validation.safetyBlockers',
      isNonNegativeInteger,
      'a non-negative integer'
    );
  }

  if (!Array.isArray(value.validation.safetyBlockers.entries)) {
    throw new Error('compact result input validation.safetyBlockers.entries must be an array.');
  }

  if (
    value.validation.safetyBlockers.entries.length > (value.validation.safetyBlockers.maxEntries as number)
  ) {
    throw new Error('compact result input validation.safetyBlockers.entries length must not exceed maxEntries.');
  }

  for (let index = 0; index < value.validation.safetyBlockers.entries.length; index += 1) {
    const entry = value.validation.safetyBlockers.entries[index];
    const entryPath = `validation.safetyBlockers.entries[${index}]`;

    if (!isRecord(entry)) {
      throw new Error(`compact result input ${entryPath} must be an object.`);
    }

    if (!isKnownValidationSafetyBlockerKind(entry.kind)) {
      throw new Error(`compact result input ${entryPath}.kind must be supported.`);
    }

    for (const field of ['sourceCommand', 'message']) {
      if (typeof entry[field] !== 'string' || entry[field].length === 0) {
        throw new Error(`compact result input ${entryPath}.${field} must be a non-empty string.`);
      }
    }

    if (!isStringOrNull(entry.guidance)) {
      throw new Error(`compact result input ${entryPath}.guidance must be string or null.`);
    }

    if (typeof entry.repairable !== 'boolean') {
      throw new Error(`compact result input ${entryPath}.repairable must be a boolean.`);
    }

    if (entry.mutationPrevented !== true) {
      throw new Error(`compact result input ${entryPath}.mutationPrevented must be true.`);
    }

    for (const field of ['unsafeCommand', 'unsafeRuleId', 'unsafeReason', 'yamlPath', 'yamlParser']) {
      if (!isStringOrNull(entry[field])) {
        throw new Error(`compact result input ${entryPath}.${field} must be string or null.`);
      }
    }

    if (entry.kind === 'unsafe-validation-command') {
      for (const field of ['unsafeCommand', 'unsafeRuleId', 'unsafeReason']) {
        if (typeof entry[field] !== 'string' || entry[field].length === 0) {
          throw new Error(`compact result input ${entryPath}.${field} must be a non-empty string for unsafe-validation-command safety blockers.`);
        }
      }

      for (const field of ['yamlPath', 'yamlParser']) {
        if (entry[field] !== null) {
          throw new Error(`compact result input ${entryPath}.${field} must be null for unsafe-validation-command safety blockers.`);
        }
      }
    }

    if (entry.kind === 'yaml-syntax-failure') {
      for (const field of ['yamlPath', 'yamlParser']) {
        if (typeof entry[field] !== 'string' || entry[field].length === 0) {
          throw new Error(`compact result input ${entryPath}.${field} must be a non-empty string for yaml-syntax-failure safety blockers.`);
        }
      }

      for (const field of ['unsafeCommand', 'unsafeRuleId', 'unsafeReason']) {
        if (entry[field] !== null) {
          throw new Error(`compact result input ${entryPath}.${field} must be null for yaml-syntax-failure safety blockers.`);
        }
      }
    }
  }

  assertHandoffBudgetMatches(
    value.handoffCheckpoint.budgets.validationSafetyBlockers,
    'handoffCheckpoint.budgets.validationSafetyBlockers',
    value.validation.safetyBlockers.entries.length,
    value.validation.safetyBlockers.omittedCount as number,
    'validation.safetyBlockers'
  );

  const includedIdentityConflictCountsByEngine = new Map<string, number>();
  const includedIdentityConflictCountsByRiskCategory = new Map<string, number>();

  for (let index = 0; index < value.validation.identityConflicts.length; index += 1) {
    const conflict = value.validation.identityConflicts[index];
    if (!isRecord(conflict)) {
      throw new Error(`compact result conflict at index ${index} must be an object.`);
    }

    if (!isKnownIdentityConflictEngine(conflict.engine)) {
      throw new Error(`compact result conflict at index ${index} must include engine terraform or pulumi.`);
    }

    if (conflict.issueKind !== expectedIdentityIssueKind(conflict.engine)) {
      throw new Error(`compact result conflict at index ${index} must include matching engine issueKind.`);
    }

    if (!isKnownIdentityConflictRiskCategory(conflict.riskCategory)) {
      throw new Error(`compact result conflict at index ${index} must include supported riskCategory.`);
    }

    if (!isRecord(conflict.identity)) {
      throw new Error(`compact result conflict at index ${index} must include identity object.`);
    }

    if (Object.values(conflict.identity).some(value => typeof value !== 'string')) {
      throw new Error(`compact result conflict at index ${index} identity values must be strings.`);
    }

    if (typeof conflict.sourceCommand !== 'string' || conflict.sourceCommand.length === 0) {
      throw new Error(`compact result conflict at index ${index} must include sourceCommand.`);
    }

    if (!Array.isArray(conflict.reviewSteps) || conflict.reviewSteps.some(step => typeof step !== 'string')) {
      throw new Error(`compact result conflict at index ${index} must include reviewSteps array.`);
    }

    if ('mutationAllowed' in conflict && conflict.mutationAllowed !== false) {
      throw new Error(`compact result conflict at index ${index} mutationAllowed must be false when present.`);
    }

    includedIdentityConflictCountsByEngine.set(
      conflict.engine as string,
      (includedIdentityConflictCountsByEngine.get(conflict.engine as string) ?? 0) + 1
    );
    includedIdentityConflictCountsByRiskCategory.set(
      conflict.riskCategory as string,
      (includedIdentityConflictCountsByRiskCategory.get(conflict.riskCategory as string) ?? 0) + 1
    );
  }

  for (const [engine, includedCount] of includedIdentityConflictCountsByEngine) {
    if (includedCount > (value.validation.identityConflictSummary.byEngine[engine] as number)) {
      throw new Error('compact result input validation.identityConflictSummary.byEngine must cover included conflicts.');
    }
  }

  for (const [riskCategory, includedCount] of includedIdentityConflictCountsByRiskCategory) {
    if (includedCount > (value.validation.identityConflictSummary.byRiskCategory[riskCategory] as number)) {
      throw new Error('compact result input validation.identityConflictSummary.byRiskCategory must cover included conflicts.');
    }
  }

  if ((value.validation.identityConflictSummary.omittedCount as number) === 0) {
    for (const [engine, totalCount] of Object.entries(value.validation.identityConflictSummary.byEngine)) {
      if ((includedIdentityConflictCountsByEngine.get(engine) ?? 0) !== totalCount) {
        throw new Error('compact result input validation.identityConflictSummary.byEngine must match included conflicts when none are omitted.');
      }
    }

    for (const [riskCategory, totalCount] of Object.entries(value.validation.identityConflictSummary.byRiskCategory)) {
      if ((includedIdentityConflictCountsByRiskCategory.get(riskCategory) ?? 0) !== totalCount) {
        throw new Error('compact result input validation.identityConflictSummary.byRiskCategory must match included conflicts when none are omitted.');
      }
    }
  }

  if (value.handoffCheckpoint.summary.validationIssueCount !== value.validation.issueSummary.totalCount) {
    throw new Error('compact result input handoffCheckpoint.summary.validationIssueCount must match validation.issueSummary.totalCount.');
  }

  if (value.handoffCheckpoint.summary.identityConflictCount !== value.validation.identityConflictSummary.totalCount) {
    throw new Error('compact result input handoffCheckpoint.summary.identityConflictCount must match validation.identityConflictSummary.totalCount.');
  }

  assertHandoffBudgetMatches(
    value.handoffCheckpoint.budgets.identityConflicts,
    'handoffCheckpoint.budgets.identityConflicts',
    value.validation.identityConflictSummary.includedCount as number,
    value.validation.identityConflictSummary.omittedCount as number,
    'validation.identityConflictSummary'
  );

  if (isRecord(value.approval)) {
    if ('requiredWriteRisks' in value.approval && !isArrayOf(value.approval.requiredWriteRisks, isKnownFileWriteRisk)) {
      throw new Error('compact result input approval.requiredWriteRisks must use supported write risks when present.');
    }

    if (
      'requiredToolCategories' in value.approval
      && !isArrayOf(value.approval.requiredToolCategories, isKnownToolPermissionCategory)
    ) {
      throw new Error('compact result input approval.requiredToolCategories must use supported tool categories when present.');
    }

    if ('signals' in value.approval && !Array.isArray(value.approval.signals)) {
      throw new Error('compact result input approval.signals must be an array when present.');
    }

    if (Array.isArray(value.approval.signals)) {
      for (let index = 0; index < value.approval.signals.length; index += 1) {
        const signal = value.approval.signals[index];
        const signalPath = `approval.signals[${index}]`;

        if (!isRecord(signal)) {
          throw new Error(`compact result input ${signalPath} must be an object.`);
        }

        if (!isKnownApprovalSignalKind(signal.kind)) {
          throw new Error(`compact result input ${signalPath}.kind must be supported.`);
        }

        if (typeof signal.message !== 'string') {
          throw new Error(`compact result input ${signalPath}.message must be a string.`);
        }

        if (signal.kind === 'write-approval-required') {
          if (typeof signal.path !== 'string' || signal.path.length === 0) {
            throw new Error(`compact result input ${signalPath}.path must be a non-empty string for write approval signals.`);
          }

          if (!isKnownFileWriteRisk(signal.risk)) {
            throw new Error(`compact result input ${signalPath}.risk must be supported for write approval signals.`);
          }

          if (signal.toolCategory !== null) {
            throw new Error(`compact result input ${signalPath}.toolCategory must be null for write approval signals.`);
          }
        }

        if (signal.kind === 'tool-category-approval-required') {
          if (!isKnownToolPermissionCategory(signal.toolCategory)) {
            throw new Error(`compact result input ${signalPath}.toolCategory must be supported for tool category approval signals.`);
          }

          if (signal.path !== null || signal.risk !== null) {
            throw new Error(`compact result input ${signalPath}.path and risk must be null for tool category approval signals.`);
          }
        }
      }
    }

    if (isRecord(value.approval.resume)) {
      if (typeof value.approval.resume.continuationRequired !== 'boolean') {
        throw new Error('compact result input approval.resume.continuationRequired must be a boolean when present.');
      }

      if (!isStringOrNull(value.approval.resume.command)) {
        throw new Error('compact result input approval.resume.command must be string or null when present.');
      }

      if (!isArrayOf(value.approval.resume.writeRisks, isKnownFileWriteRisk)) {
        throw new Error('compact result input approval.resume.writeRisks must use supported write risks when present.');
      }

      if (!isStringArray(value.approval.resume.writePaths)) {
        throw new Error('compact result input approval.resume.writePaths must be a string array when present.');
      }

      if (!isArrayOf(value.approval.resume.toolCategories, isKnownToolPermissionCategory)) {
        throw new Error('compact result input approval.resume.toolCategories must use supported tool categories when present.');
      }

      assertIntegerField(value.approval.resume, 'signalCount', 'approval.resume', isNonNegativeInteger, 'a non-negative integer');

      if (value.approval.resume.continuationRequired && typeof value.approval.resume.command !== 'string') {
        throw new Error('compact result input approval.resume.command is required when continuationRequired is true.');
      }

      if (!value.approval.resume.continuationRequired && value.approval.resume.command !== null) {
        throw new Error('compact result input approval.resume.command must be null when continuationRequired is false.');
      }

      if (
        Array.isArray(value.approval.signals)
        && (value.approval.resume.signalCount as number) < value.approval.signals.length
      ) {
        throw new Error('compact result input approval.resume.signalCount must cover included approval signals.');
      }

      if (value.handoffCheckpoint.summary.approvalContinuationRequired !== value.approval.resume.continuationRequired) {
        throw new Error('compact result input handoffCheckpoint.summary.approvalContinuationRequired must match approval.resume.continuationRequired.');
      }

      if (value.handoffCheckpoint.continuation.command !== value.approval.resume.command) {
        throw new Error('compact result input handoffCheckpoint.continuation.command must match approval.resume.command.');
      }

      if (Array.isArray(value.approval.signals)) {
        assertHandoffBudgetMatches(
          value.handoffCheckpoint.budgets.approvalSignals,
          'handoffCheckpoint.budgets.approvalSignals',
          value.approval.signals.length,
          Math.max(0, (value.approval.resume.signalCount as number) - value.approval.signals.length),
          'approval.resume'
        );
      }
    }
  }

  if (!isRecord(value.knowledgeContext)) {
    throw new Error('compact result input must include knowledgeContext object.');
  }

  for (const field of ['maxPackets', 'maxTokens', 'maxExcerptChars']) {
    assertIntegerField(
      value.knowledgeContext,
      field,
      'knowledgeContext',
      isPositiveInteger,
      'a positive integer'
    );
  }

  for (const field of [
    'totalPacketCount',
    'includedPacketCount',
    'omittedPacketCount',
    'includedTokenEstimate',
    'omittedTokenEstimate',
    'omittedByPacketLimit',
    'omittedByTokenBudget'
  ]) {
    assertIntegerField(
      value.knowledgeContext,
      field,
      'knowledgeContext',
      isNonNegativeInteger,
      'a non-negative integer'
    );
  }

  const knowledgeTotalPacketCount = value.knowledgeContext.totalPacketCount as number;
  const knowledgeIncludedPacketCount = value.knowledgeContext.includedPacketCount as number;
  const knowledgeOmittedPacketCount = value.knowledgeContext.omittedPacketCount as number;
  const knowledgeOmittedByPacketLimit = value.knowledgeContext.omittedByPacketLimit as number;
  const knowledgeOmittedByTokenBudget = value.knowledgeContext.omittedByTokenBudget as number;

  if (knowledgeIncludedPacketCount + knowledgeOmittedPacketCount !== knowledgeTotalPacketCount) {
    throw new Error('compact result input knowledgeContext packet counts must be consistent.');
  }

  if (knowledgeOmittedByPacketLimit + knowledgeOmittedByTokenBudget !== knowledgeOmittedPacketCount) {
    throw new Error('compact result input knowledgeContext omitted counts must be consistent.');
  }

  if (knowledgeIncludedPacketCount > (value.knowledgeContext.maxPackets as number)) {
    throw new Error('compact result input knowledgeContext.includedPacketCount must not exceed maxPackets.');
  }

  if (!Array.isArray(value.knowledgeContext.packets)) {
    throw new Error('compact result input knowledgeContext.packets must be an array.');
  }

  if (value.knowledgeContext.packets.length !== knowledgeTotalPacketCount) {
    throw new Error('compact result input knowledgeContext.packets length must match totalPacketCount.');
  }

  let derivedIncludedPacketCount = 0;
  let derivedOmittedPacketCount = 0;
  let derivedIncludedTokenEstimate = 0;
  let derivedOmittedTokenEstimate = 0;
  let derivedOmittedByPacketLimit = 0;
  let derivedOmittedByTokenBudget = 0;

  for (let index = 0; index < value.knowledgeContext.packets.length; index += 1) {
    const packet = value.knowledgeContext.packets[index];
    const packetPath = `knowledgeContext.packets[${index}]`;

    if (!isRecord(packet)) {
      throw new Error(`compact result input ${packetPath} must be an object.`);
    }

    if ('excerpt' in packet || 'facts' in packet || 'source' in packet) {
      throw new Error(`compact result input ${packetPath} must not include raw context fields.`);
    }

    for (const field of ['id', 'sourceKind', 'reason']) {
      if (typeof packet[field] !== 'string' || packet[field].length === 0) {
        throw new Error(`compact result input ${packetPath}.${field} must be a non-empty string.`);
      }
    }

    for (const field of ['sourceName', 'sourceVersion']) {
      if (!isStringOrNull(packet[field])) {
        throw new Error(`compact result input ${packetPath}.${field} must be string or null.`);
      }
    }

    if (!isKnownAgentConfidence(packet.confidence)) {
      throw new Error(`compact result input ${packetPath}.confidence must be supported.`);
    }

    assertIntegerField(packet, 'tokenEstimate', packetPath, isNonNegativeInteger, 'a non-negative integer');
    assertIntegerField(packet, 'excerptChars', packetPath, isNonNegativeInteger, 'a non-negative integer');

    if ((packet.excerptChars as number) > (value.knowledgeContext.maxExcerptChars as number)) {
      throw new Error(`compact result input ${packetPath}.excerptChars must not exceed knowledgeContext.maxExcerptChars.`);
    }

    if (typeof packet.included !== 'boolean') {
      throw new Error(`compact result input ${packetPath}.included must be a boolean.`);
    }

    if (packet.omittedReason !== null && !isKnownRetrievedContextOmittedReason(packet.omittedReason)) {
      throw new Error(`compact result input ${packetPath}.omittedReason must be null or supported.`);
    }

    if (packet.included && packet.omittedReason !== null) {
      throw new Error(`compact result input ${packetPath}.omittedReason must be null when included is true.`);
    }

    if (!packet.included && packet.omittedReason === null) {
      throw new Error(`compact result input ${packetPath}.omittedReason is required when included is false.`);
    }

    if (packet.included) {
      derivedIncludedPacketCount += 1;
      derivedIncludedTokenEstimate += packet.tokenEstimate as number;
    } else {
      derivedOmittedPacketCount += 1;
      derivedOmittedTokenEstimate += packet.tokenEstimate as number;
      if (packet.omittedReason === 'packet-limit') {
        derivedOmittedByPacketLimit += 1;
      }
      if (packet.omittedReason === 'token-budget') {
        derivedOmittedByTokenBudget += 1;
      }
    }
  }

  if (derivedIncludedPacketCount !== knowledgeIncludedPacketCount) {
    throw new Error('compact result input knowledgeContext.includedPacketCount must match packets.');
  }

  if (derivedOmittedPacketCount !== knowledgeOmittedPacketCount) {
    throw new Error('compact result input knowledgeContext.omittedPacketCount must match packets.');
  }

  if (derivedIncludedTokenEstimate !== value.knowledgeContext.includedTokenEstimate) {
    throw new Error('compact result input knowledgeContext.includedTokenEstimate must match included packets.');
  }

  if (derivedOmittedTokenEstimate !== value.knowledgeContext.omittedTokenEstimate) {
    throw new Error('compact result input knowledgeContext.omittedTokenEstimate must match omitted packets.');
  }

  if (derivedOmittedByPacketLimit !== knowledgeOmittedByPacketLimit) {
    throw new Error('compact result input knowledgeContext.omittedByPacketLimit must match packets.');
  }

  if (derivedOmittedByTokenBudget !== knowledgeOmittedByTokenBudget) {
    throw new Error('compact result input knowledgeContext.omittedByTokenBudget must match packets.');
  }

  assertHandoffBudgetMatches(
    value.handoffCheckpoint.budgets.knowledgePackets,
    'handoffCheckpoint.budgets.knowledgePackets',
    knowledgeIncludedPacketCount,
    knowledgeOmittedPacketCount,
    'knowledgeContext'
  );

  const knowledgePacketBudget = value.handoffCheckpoint.budgets.knowledgePackets as Record<string, unknown>;
  if (
    knowledgePacketBudget.includedTokenEstimate !== value.knowledgeContext.includedTokenEstimate
    || knowledgePacketBudget.omittedTokenEstimate !== value.knowledgeContext.omittedTokenEstimate
  ) {
    throw new Error('compact result input handoffCheckpoint.budgets.knowledgePackets token estimates must match knowledgeContext.');
  }

  if (!isRecord(value.knowledgeCache)) {
    throw new Error('compact result input must include knowledgeCache object.');
  }

  if (typeof value.knowledgeCache.root !== 'string' || value.knowledgeCache.root.length === 0) {
    throw new Error('compact result input knowledgeCache.root must be a non-empty string.');
  }

  if (!isKnownKnowledgeCacheSource(value.knowledgeCache.source)) {
    throw new Error('compact result input knowledgeCache.source must be supported.');
  }

  return value as unknown as CompactAgentRunResult;
}
