import type { AgentDecision, AgentDecisionExecution, AgentRuntimeState } from './agent.ts';

export interface QueryTurn {
  index: number;
  decision: AgentDecision;
  execution: AgentDecisionExecution | null;
  runtimeSnapshot: AgentRuntimeState;
}

export interface QueryLoopResult {
  runtime: AgentRuntimeState;
  turns: QueryTurn[];
}

