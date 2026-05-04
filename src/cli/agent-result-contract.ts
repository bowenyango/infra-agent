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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKnownAgentResultOutcome(value: unknown): boolean {
  return typeof value === 'string' && AGENT_RUN_OUTCOMES.includes(value as typeof AGENT_RUN_OUTCOMES[number]);
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
    if (!keyValidator(key) || !isNumber(value)) {
      throw new Error(`compact result input ${fieldName} must use supported numeric keys when present.`);
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

function expectedIdentityIssueKind(engine: unknown): string | null {
  if (engine === 'terraform') {
    return 'terraform-create-before-delete-conflict';
  }

  if (engine === 'pulumi') {
    return 'pulumi-create-before-delete-conflict';
  }

  return null;
}

export function parseCompactAgentRunResult(value: unknown): CompactAgentRunResult {
  if (!isRecord(value) || value.kind !== 'infra-agent.agent-result') {
    throw new Error('compact result input must be a compact infra-agent.agent-result JSON payload.');
  }

  if (value.schemaVersion !== 1) {
    throw new Error('compact result input must use compact agent result schemaVersion 1.');
  }

  if (!isKnownAgentResultOutcome(value.outcome)) {
    throw new Error('compact result input must include a supported outcome.');
  }

  if (typeof value.task !== 'string') {
    throw new Error('compact result input root.task must be a string.');
  }

  if (typeof value.workspaceRoot !== 'string') {
    throw new Error('compact result input root.workspaceRoot must be a string.');
  }

  for (const field of ['modelName', 'profileId']) {
    if (field in value && typeof value[field] !== 'string') {
      throw new Error(`compact result input root.${field} must be a string when present.`);
    }
  }

  if ('turnsUsed' in value && !isNumber(value.turnsUsed)) {
    throw new Error('compact result input root.turnsUsed must be a number when present.');
  }

  for (const field of ['requestedDomains', 'changedFiles', 'resultCard', 'nextSteps', 'suggestedCommands']) {
    if (field in value && !isStringArray(value[field])) {
      throw new Error(`compact result input root.${field} must be a string array when present.`);
    }
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
      if (countKeys.some(key => key in value.harness.stateSummary && !isNumber(value.harness.stateSummary[key]))) {
        throw new Error('compact result input harness.stateSummary counts must be numbers when present.');
      }
    }

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

    if (
      isRecord(value.harness.lifecycleEvents)
      && 'events' in value.harness.lifecycleEvents
      && !Array.isArray(value.harness.lifecycleEvents.events)
    ) {
      throw new Error('compact result input harness.lifecycleEvents.events must be an array when present.');
    }

    if (isRecord(value.harness.lifecycleEvents)) {
      for (const field of ['totalCount', 'includedCount', 'omittedCount']) {
        if (field in value.harness.lifecycleEvents && !isNumber(value.harness.lifecycleEvents[field])) {
          throw new Error(`compact result input harness.lifecycleEvents.${field} must be a number when present.`);
        }
      }

      if (Array.isArray(value.harness.lifecycleEvents.events)) {
        for (let index = 0; index < value.harness.lifecycleEvents.events.length; index += 1) {
          const event = value.harness.lifecycleEvents.events[index];
          if (!isRecord(event) || !isKnownLifecycleEventName(event.event)) {
            throw new Error(`compact result input harness.lifecycleEvents.events[${index}].event must be supported.`);
          }
        }

        if (
          isNumber(value.harness.lifecycleEvents.includedCount)
          && value.harness.lifecycleEvents.includedCount !== value.harness.lifecycleEvents.events.length
        ) {
          throw new Error('compact result input harness.lifecycleEvents.includedCount must match events length when present.');
        }
      }

      if (isRecord(value.harness.lifecycleEvents.eventCounts)) {
        for (const [eventName, count] of Object.entries(value.harness.lifecycleEvents.eventCounts)) {
          if (!isKnownLifecycleEventName(eventName) || !isNumber(count)) {
            throw new Error('compact result input harness.lifecycleEvents.eventCounts must use supported numeric event counts.');
          }
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
      if (
        isRecord(value.harness.plannerHandoff.activeBlocker)
        && !isKnownPlannerHandoffActiveBlocker(value.harness.plannerHandoff.activeBlocker.kind)
      ) {
        throw new Error('compact result input harness.plannerHandoff.activeBlocker.kind must be supported when present.');
      }

      if (!isKnownPlannerHandoffNextControlAction(value.harness.plannerHandoff.nextControlAction)) {
        throw new Error('compact result input harness.plannerHandoff.nextControlAction must be supported when present.');
      }
    }
  }

  if (isRecord(value.readiness) && 'checks' in value.readiness && !Array.isArray(value.readiness.checks)) {
    throw new Error('compact result input readiness.checks must be an array when present.');
  }

  if (!isRecord(value.validation) || !Array.isArray(value.validation.identityConflicts)) {
    throw new Error('compact result input must include validation.identityConflicts array.');
  }

  if (isRecord(value.validation.identityConflictSummary)) {
    for (const field of ['totalCount', 'includedCount', 'maxEntries', 'omittedCount']) {
      if (field in value.validation.identityConflictSummary && !isNumber(value.validation.identityConflictSummary[field])) {
        throw new Error(`compact result input validation.identityConflictSummary.${field} must be a number when present.`);
      }
    }

    if (
      'mutationAllowed' in value.validation.identityConflictSummary
      && value.validation.identityConflictSummary.mutationAllowed !== false
    ) {
      throw new Error('compact result input validation.identityConflictSummary.mutationAllowed must be false when present.');
    }

    if (isRecord(value.validation.identityConflictSummary.byEngine)) {
      assertNumericMap(
        value.validation.identityConflictSummary.byEngine,
        'validation.identityConflictSummary.byEngine',
        isKnownIdentityConflictEngine
      );
    }

    if (isRecord(value.validation.identityConflictSummary.byRiskCategory)) {
      assertNumericMap(
        value.validation.identityConflictSummary.byRiskCategory,
        'validation.identityConflictSummary.byRiskCategory',
        isKnownIdentityConflictRiskCategory
      );
    }

    if (
      hasNumericCountSet(value.validation.identityConflictSummary)
      && !hasConsistentCountSet(value.validation.identityConflictSummary)
    ) {
      throw new Error('compact result input validation.identityConflictSummary counts must be consistent when present.');
    }

    if (
      isNumber(value.validation.identityConflictSummary.includedCount)
      && isNumber(value.validation.identityConflictSummary.maxEntries)
      && value.validation.identityConflictSummary.includedCount > value.validation.identityConflictSummary.maxEntries
    ) {
      throw new Error('compact result input validation.identityConflictSummary.includedCount must not exceed maxEntries.');
    }
  }

  if (isRecord(value.validation.commands) && 'entries' in value.validation.commands && !Array.isArray(value.validation.commands.entries)) {
    throw new Error('compact result input validation.commands.entries must be an array when present.');
  }

  if (
    isRecord(value.validation.issueSummary)
    && 'groups' in value.validation.issueSummary
    && !Array.isArray(value.validation.issueSummary.groups)
  ) {
    throw new Error('compact result input validation.issueSummary.groups must be an array when present.');
  }

  if (
    isRecord(value.validation.safetyBlockers)
    && 'entries' in value.validation.safetyBlockers
    && !Array.isArray(value.validation.safetyBlockers.entries)
  ) {
    throw new Error('compact result input validation.safetyBlockers.entries must be an array when present.');
  }

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
  }

  if (
    isRecord(value.approval)
    && isRecord(value.approval.resume)
    && 'continuationRequired' in value.approval.resume
    && typeof value.approval.resume.continuationRequired !== 'boolean'
  ) {
    throw new Error('compact result input approval.resume.continuationRequired must be a boolean when present.');
  }

  return value as unknown as CompactAgentRunResult;
}
