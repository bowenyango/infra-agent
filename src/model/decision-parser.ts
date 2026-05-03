import type {
  AgentAction,
  AgentActionKind,
  AgentClarificationKind,
  AgentDecision,
  AgentRuntimeState,
  AgentStopReason
} from '../types/agent.ts';
import { selectValidationCommands } from '../agent/select-validation-commands.ts';

function extractJsonObject(content: string): string {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('LLM planner response did not include a JSON object.');
  }

  return content.slice(start, end + 1);
}

function isActionKind(value: string): value is AgentActionKind {
  return ['ask-for-clarification', 'inspect-target-files', 'apply-edit-plan', 'repair-terraform-formatting', 'validate-targets', 'stop'].includes(value);
}

function isStopReason(value: string): value is AgentStopReason {
  return ['validation-succeeded', 'validation-blocked', 'repair-budget-exhausted', 'no-safe-action'].includes(value);
}

function isClarificationKind(value: string): value is AgentClarificationKind {
  return ['approval-required', 'target-ambiguity', 'workspace-policy', 'general'].includes(value);
}

function ensureString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`LLM planner response field "${fieldName}" must be a non-empty string.`);
  }

  return value;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean);
  return values.length > 0 ? values : undefined;
}

function buildDefaultValidationCommands(runtime: AgentRuntimeState): string[] {
  return selectValidationCommands(runtime);
}

function buildValidationCommands(runtime: AgentRuntimeState, rawCommands: unknown): string[] {
  const allowedCommands = new Set(buildDefaultValidationCommands(runtime));
  const requestedCommands = toStringArray(rawCommands);
  const filteredCommands = requestedCommands?.filter(command => allowedCommands.has(command)) ?? [];

  return filteredCommands.length > 0 ? filteredCommands : Array.from(allowedCommands);
}

function buildPayload(actionKind: AgentActionKind, runtime: AgentRuntimeState, payload: unknown): AgentAction['payload'] {
  const rawPayload = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};

  if (actionKind === 'inspect-target-files') {
    return {
      targetPaths: toStringArray(rawPayload.targetPaths) ?? runtime.preflight.targetCandidates.slice(0, 3).map(candidate => candidate.path)
    };
  }

  if (actionKind === 'ask-for-clarification') {
    const clarificationKind = rawPayload.clarificationKind;
    let normalizedClarificationKind: AgentClarificationKind = 'general';
    if (clarificationKind !== undefined) {
      const kindValue = ensureString(clarificationKind, 'action.payload.clarificationKind');
      if (!isClarificationKind(kindValue)) {
        throw new Error(`LLM planner response included unsupported clarification kind "${kindValue}".`);
      }

      normalizedClarificationKind = kindValue;
    }

    return {
      questions: toStringArray(rawPayload.questions) ?? ['Which service and environment should the agent modify?'],
      clarificationKind: normalizedClarificationKind
    };
  }

  if (actionKind === 'validate-targets') {
    return {
      commands: buildValidationCommands(runtime, rawPayload.commands)
    };
  }

  if (actionKind === 'repair-terraform-formatting') {
    const topTerraformTarget = runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'terraform-root');
    return {
      rootPath: typeof rawPayload.rootPath === 'string' && rawPayload.rootPath.trim().length > 0
        ? rawPayload.rootPath.trim()
        : topTerraformTarget?.path
    };
  }

  if (actionKind === 'apply-edit-plan') {
    if (!runtime.lastEditPlan) {
      throw new Error('LLM planner requested apply-edit-plan without runtime.lastEditPlan.');
    }

    return {
      editPlan: runtime.lastEditPlan,
      writes: runtime.lastEditPlan.writes
    };
  }

  if (actionKind === 'stop') {
    const stopReason = ensureString(rawPayload.stopReason, 'action.payload.stopReason');
    if (!isStopReason(stopReason)) {
      throw new Error(`LLM planner response included unsupported stop reason "${stopReason}".`);
    }

    return {
      stopReason
    };
  }

  return undefined;
}

export function parsePlannerDecision(content: string, runtime: AgentRuntimeState): AgentDecision {
  const parsed = JSON.parse(extractJsonObject(content)) as Record<string, unknown>;
  const confidence = ensureString(parsed.confidence, 'confidence');
  if (!['low', 'medium', 'high'].includes(confidence)) {
    throw new Error('LLM planner response included an invalid confidence value.');
  }

  const actionValue = parsed.action;
  if (typeof actionValue !== 'object' || actionValue === null) {
    throw new Error('LLM planner response action must be an object.');
  }

  const action = actionValue as Record<string, unknown>;
  const kind = ensureString(action.kind, 'action.kind');
  if (!isActionKind(kind)) {
    throw new Error(`LLM planner response included unsupported action kind "${kind}".`);
  }

  return {
    confidence,
    action: {
      kind,
      summary: ensureString(action.summary, 'action.summary'),
      rationale: ensureString(action.rationale, 'action.rationale'),
      payload: buildPayload(kind, runtime, action.payload)
    }
  };
}
