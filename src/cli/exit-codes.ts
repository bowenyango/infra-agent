import type { AgentRunOutcome } from '../types/agent.ts';
import type { RunPreflightState } from '../types/repository.ts';

export const INFRA_AGENT_EXIT_CODES = {
  success: 0,
  fatalError: 1,
  validationBlocked: 2,
  approvalRequired: 3,
  clarificationRequired: 4,
  noSafeAction: 5,
  repairBudgetExhausted: 6,
  preflightBlocked: 7
} as const;

export type InfraAgentExitCode = typeof INFRA_AGENT_EXIT_CODES[keyof typeof INFRA_AGENT_EXIT_CODES];

export function exitCodeForAgentOutcome(outcome: AgentRunOutcome): InfraAgentExitCode {
  switch (outcome) {
    case 'completed':
      return INFRA_AGENT_EXIT_CODES.success;
    case 'validation-blocked':
      return INFRA_AGENT_EXIT_CODES.validationBlocked;
    case 'approval-required':
      return INFRA_AGENT_EXIT_CODES.approvalRequired;
    case 'clarification-required':
      return INFRA_AGENT_EXIT_CODES.clarificationRequired;
    case 'no-safe-action':
      return INFRA_AGENT_EXIT_CODES.noSafeAction;
    case 'repair-budget-exhausted':
      return INFRA_AGENT_EXIT_CODES.repairBudgetExhausted;
  }
}

export function exitCodeForRunPreflight(preflight: RunPreflightState): InfraAgentExitCode {
  return preflight.blockers.length > 0
    ? INFRA_AGENT_EXIT_CODES.preflightBlocked
    : INFRA_AGENT_EXIT_CODES.success;
}
