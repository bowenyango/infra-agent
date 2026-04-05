import type { ModelClient } from './ModelClient.ts';
import { RuleBasedPlanningModel } from '../agent/rule-based-planner.ts';
import type { AgentDecision, AgentRuntimeState } from '../types/agent.ts';

export class RuleBasedModelClient implements ModelClient {
  readonly name = 'rule-based-model-client';
  readonly planner = new RuleBasedPlanningModel();

  async decideNextAction(runtime: AgentRuntimeState): Promise<AgentDecision> {
    return this.planner.decideNextAction({
      runtime
    });
  }
}

