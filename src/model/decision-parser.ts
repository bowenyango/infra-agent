import type {
  AgentAction,
  AgentActionFamily,
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

const AGENT_ACTION_FAMILIES: AgentActionFamily[] = [
  'runtime-clarification',
  'approval-clarification',
  'helm-clarification',
  'pulumi-clarification',
  'terraform-clarification',
  'helm-inspection',
  'pulumi-inspection',
  'terraform-inspection',
  'runtime-inspection',
  'helm-bounded-edit',
  'pulumi-bounded-edit',
  'terraform-bounded-edit',
  'helm-validation',
  'pulumi-validation',
  'terraform-validation',
  'terraform-repair',
  'validation-complete',
  'validation-blocked',
  'repair-budget-exhausted',
  'runtime-stop'
];

function isActionFamily(value: string): value is AgentActionFamily {
  return AGENT_ACTION_FAMILIES.includes(value as AgentActionFamily);
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

function buildDefaultTargetPaths(runtime: AgentRuntimeState): string[] {
  return runtime.preflight.targetCandidates.slice(0, 3).map(candidate => candidate.path);
}

function buildInspectableTargetPaths(runtime: AgentRuntimeState, rawTargetPaths: unknown): string[] {
  const fallbackTargetPaths = buildDefaultTargetPaths(runtime);
  const requestedTargetPaths = toStringArray(rawTargetPaths);
  if (!requestedTargetPaths) {
    return fallbackTargetPaths;
  }

  const candidatePaths = new Set(runtime.preflight.targetCandidates.map(candidate => candidate.path));
  const filteredTargetPaths = requestedTargetPaths.filter(targetPath => candidatePaths.has(targetPath));
  return filteredTargetPaths.length > 0 ? filteredTargetPaths : fallbackTargetPaths;
}

function buildTerraformFormattingRootPath(runtime: AgentRuntimeState, rawRootPath: unknown): string | undefined {
  const topTerraformTarget = runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'terraform-root');
  const requestedRootPath = typeof rawRootPath === 'string' ? rawRootPath.trim() : '';
  if (requestedRootPath.length === 0) {
    return topTerraformTarget?.path;
  }

  return runtime.preflight.targetCandidates.some(candidate => candidate.kind === 'terraform-root' && candidate.path === requestedRootPath)
    ? requestedRootPath
    : topTerraformTarget?.path;
}

function buildClarificationActionFamily(runtime: AgentRuntimeState, clarificationKind?: AgentClarificationKind): AgentActionFamily {
  if (clarificationKind === 'approval-required') {
    return 'approval-clarification';
  }

  const primaryDomain = runtime.preflight.requestedDomains[0];
  if (primaryDomain === 'terraform') {
    return 'terraform-clarification';
  }

  if (primaryDomain === 'pulumi') {
    return 'pulumi-clarification';
  }

  if (primaryDomain === 'helm') {
    return 'helm-clarification';
  }

  return 'runtime-clarification';
}

function buildInspectionActionFamily(runtime: AgentRuntimeState): AgentActionFamily {
  const primaryDomain = runtime.preflight.requestedDomains[0];
  if (primaryDomain === 'terraform') {
    return 'terraform-inspection';
  }

  if (primaryDomain === 'pulumi') {
    return 'pulumi-inspection';
  }

  if (primaryDomain === 'helm') {
    return 'helm-inspection';
  }

  return 'runtime-inspection';
}

function buildValidationActionFamily(runtime: AgentRuntimeState): AgentActionFamily {
  const primaryDomain = runtime.preflight.requestedDomains[0];
  if (primaryDomain === 'terraform') {
    return 'terraform-validation';
  }

  if (primaryDomain === 'pulumi') {
    return 'pulumi-validation';
  }

  if (primaryDomain === 'helm') {
    return 'helm-validation';
  }

  return 'runtime-stop';
}

function buildEditPlanActionFamily(runtime: AgentRuntimeState): AgentActionFamily {
  const editPlanKind = runtime.lastEditPlan?.kind ?? '';
  if (editPlanKind.startsWith('terraform-')) {
    return 'terraform-bounded-edit';
  }

  if (editPlanKind.startsWith('pulumi-')) {
    return 'pulumi-bounded-edit';
  }

  return 'helm-bounded-edit';
}

function buildStopActionFamily(stopReason?: AgentStopReason): AgentActionFamily {
  switch (stopReason) {
    case 'validation-succeeded':
      return 'validation-complete';
    case 'validation-blocked':
      return 'validation-blocked';
    case 'repair-budget-exhausted':
      return 'repair-budget-exhausted';
    case 'no-safe-action':
    default:
      return 'runtime-stop';
  }
}

function buildFallbackActionFamily(
  actionKind: AgentActionKind,
  runtime: AgentRuntimeState,
  payload: AgentAction['payload']
): AgentActionFamily {
  switch (actionKind) {
    case 'ask-for-clarification':
      return buildClarificationActionFamily(runtime, payload?.clarificationKind);
    case 'inspect-target-files':
      return buildInspectionActionFamily(runtime);
    case 'apply-edit-plan':
      return buildEditPlanActionFamily(runtime);
    case 'repair-terraform-formatting':
      return 'terraform-repair';
    case 'validate-targets':
      return buildValidationActionFamily(runtime);
    case 'stop':
    default:
      return buildStopActionFamily(payload?.stopReason);
  }
}

function normalizeActionFamily(
  actionKind: AgentActionKind,
  runtime: AgentRuntimeState,
  rawActionFamily: unknown,
  payload: AgentAction['payload']
): AgentActionFamily {
  const actionFamily = typeof rawActionFamily === 'string' ? rawActionFamily.trim() : '';
  return isActionFamily(actionFamily) ? actionFamily : buildFallbackActionFamily(actionKind, runtime, payload);
}

function withActionFamily(
  actionKind: AgentActionKind,
  runtime: AgentRuntimeState,
  rawActionFamily: unknown,
  payload: AgentAction['payload']
): AgentAction['payload'] {
  return {
    ...payload,
    actionFamily: normalizeActionFamily(actionKind, runtime, rawActionFamily, payload)
  };
}

function buildPayload(actionKind: AgentActionKind, runtime: AgentRuntimeState, payload: unknown): AgentAction['payload'] {
  const rawPayload = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};

  if (actionKind === 'inspect-target-files') {
    return withActionFamily(actionKind, runtime, rawPayload.actionFamily, {
      targetPaths: buildInspectableTargetPaths(runtime, rawPayload.targetPaths)
    });
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

    return withActionFamily(actionKind, runtime, rawPayload.actionFamily, {
      questions: toStringArray(rawPayload.questions) ?? ['Which service and environment should the agent modify?'],
      clarificationKind: normalizedClarificationKind
    });
  }

  if (actionKind === 'validate-targets') {
    return withActionFamily(actionKind, runtime, rawPayload.actionFamily, {
      commands: buildValidationCommands(runtime, rawPayload.commands)
    });
  }

  if (actionKind === 'repair-terraform-formatting') {
    return withActionFamily(actionKind, runtime, rawPayload.actionFamily, {
      rootPath: buildTerraformFormattingRootPath(runtime, rawPayload.rootPath)
    });
  }

  if (actionKind === 'apply-edit-plan') {
    if (!runtime.lastEditPlan) {
      throw new Error('LLM planner requested apply-edit-plan without runtime.lastEditPlan.');
    }

    return withActionFamily(actionKind, runtime, rawPayload.actionFamily, {
      editPlan: runtime.lastEditPlan,
      writes: runtime.lastEditPlan.writes
    });
  }

  if (actionKind === 'stop') {
    const stopReason = ensureString(rawPayload.stopReason, 'action.payload.stopReason');
    if (!isStopReason(stopReason)) {
      throw new Error(`LLM planner response included unsupported stop reason "${stopReason}".`);
    }

    return withActionFamily(actionKind, runtime, rawPayload.actionFamily, {
      stopReason
    });
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
