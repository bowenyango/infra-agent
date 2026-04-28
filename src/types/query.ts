import type { AgentDecision, AgentDecisionExecution, AgentRunOutcome, AgentRuntimeState } from './agent.ts';
import type { QueryLoopConfig } from '../query-config.ts';

export interface QueryTurn {
  index: number;
  decision: AgentDecision;
  execution: AgentDecisionExecution | null;
  runtimeSnapshot: AgentRuntimeState;
}

export interface QueryLoopResult {
  outcome: AgentRunOutcome;
  runtime: AgentRuntimeState;
  turns: QueryTurn[];
  config: QueryLoopConfig;
}
