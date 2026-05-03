import type { CompactAgentRunResult } from './output.ts';

const AGENT_RESULT_OUTCOMES = [
  'completed',
  'approval-required',
  'clarification-required',
  'validation-blocked',
  'repair-budget-exhausted',
  'no-safe-action'
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKnownAgentResultOutcome(value: unknown): boolean {
  return typeof value === 'string' && AGENT_RESULT_OUTCOMES.includes(value as typeof AGENT_RESULT_OUTCOMES[number]);
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

    if (
      isRecord(value.harness.toolTrace)
      && 'entries' in value.harness.toolTrace
      && !Array.isArray(value.harness.toolTrace.entries)
    ) {
      throw new Error('compact result input harness.toolTrace.entries must be an array when present.');
    }
  }

  if (isRecord(value.readiness) && 'checks' in value.readiness && !Array.isArray(value.readiness.checks)) {
    throw new Error('compact result input readiness.checks must be an array when present.');
  }

  if (!isRecord(value.validation) || !Array.isArray(value.validation.identityConflicts)) {
    throw new Error('compact result input must include validation.identityConflicts array.');
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

  return value as unknown as CompactAgentRunResult;
}
