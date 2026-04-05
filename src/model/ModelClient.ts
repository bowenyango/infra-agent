import type { AgentDecision, AgentRuntimeState } from '../types/agent.ts';

export interface ModelClient {
  readonly name: string;
  decideNextAction(runtime: AgentRuntimeState): Promise<AgentDecision>;
}

