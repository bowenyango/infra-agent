import type { RunPreflightState } from './repository.ts';
import type { ToolResult } from '../Tool.ts';

export type AgentActionKind =
  | 'ask-for-clarification'
  | 'inspect-target-files'
  | 'validate-targets'
  | 'stop';

export interface AgentAction {
  kind: AgentActionKind;
  summary: string;
  rationale: string;
  payload?: {
    targetPaths?: string[];
    questions?: string[];
    commands?: string[];
  };
}

export interface AgentDecision {
  action: AgentAction;
  confidence: 'low' | 'medium' | 'high';
}

export interface AgentDecisionExecution {
  status: 'completed' | 'skipped';
  executedTools: ToolResult<unknown>[];
  reason?: string;
}

export interface AgentPlanningInput {
  preflight: RunPreflightState;
}

export interface PlanningModel {
  readonly name: string;
  decideNextAction(input: AgentPlanningInput): Promise<AgentDecision>;
}
