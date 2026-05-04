import type { CompactAgentRunResult } from './output.ts';
import { AGENT_RUN_OUTCOMES } from '../types/agent.ts';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKnownAgentResultOutcome(value: unknown): boolean {
  return typeof value === 'string' && AGENT_RUN_OUTCOMES.includes(value as typeof AGENT_RUN_OUTCOMES[number]);
}

function isKnownPlannerHandoffActiveBlocker(value: unknown): boolean {
  return typeof value === 'string'
    && PLANNER_HANDOFF_ACTIVE_BLOCKERS.includes(value as typeof PLANNER_HANDOFF_ACTIVE_BLOCKERS[number]);
}

function isKnownPlannerHandoffNextControlAction(value: unknown): boolean {
  return typeof value === 'string'
    && PLANNER_HANDOFF_NEXT_CONTROL_ACTIONS.includes(value as typeof PLANNER_HANDOFF_NEXT_CONTROL_ACTIONS[number]);
}

function isNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
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

  if (isRecord(value.harness)) {
    if ('turnTrace' in value.harness && !Array.isArray(value.harness.turnTrace)) {
      throw new Error('compact result input harness.turnTrace must be an array when present.');
    }

    if (isRecord(value.harness.turnTraceBudget)) {
      for (const field of ['totalCount', 'includedCount', 'omittedCount']) {
        if (field in value.harness.turnTraceBudget && !isNumber(value.harness.turnTraceBudget[field])) {
          throw new Error(`compact result input harness.turnTraceBudget.${field} must be a number when present.`);
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
      for (const field of ['totalCount', 'includedCount', 'omittedCount']) {
        if (field in value.harness.toolTrace && !isNumber(value.harness.toolTrace[field])) {
          throw new Error(`compact result input harness.toolTrace.${field} must be a number when present.`);
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

    if (conflict.engine !== 'terraform' && conflict.engine !== 'pulumi') {
      throw new Error(`compact result conflict at index ${index} must include engine terraform or pulumi.`);
    }

    if (!Array.isArray(conflict.reviewSteps)) {
      throw new Error(`compact result conflict at index ${index} must include reviewSteps array.`);
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
