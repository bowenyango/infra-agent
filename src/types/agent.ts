import type { RunPreflightState } from './repository.ts';
import type { ToolResult } from '../Tool.ts';
import type { ValidationCommandOutput } from './tools.ts';

export type AgentActionKind =
  | 'ask-for-clarification'
  | 'inspect-target-files'
  | 'apply-edit-plan'
  | 'validate-targets'
  | 'stop';

export interface FileWritePlan {
  path: string;
  content: string;
  reason: string;
}

export interface AgentAction {
  kind: AgentActionKind;
  summary: string;
  rationale: string;
  payload?: {
    targetPaths?: string[];
    questions?: string[];
    commands?: string[];
    writes?: FileWritePlan[];
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
  runtime: AgentRuntimeState;
}

export interface PlanningModel {
  readonly name: string;
  decideNextAction(input: AgentPlanningInput): Promise<AgentDecision>;
}

export interface AgentRuntimeState {
  task: string;
  preflight: RunPreflightState;
  observations: ToolResult<unknown>[];
  appliedWrites: FileWritePlan[];
  validationResults: ValidationCommandOutput[];
}
