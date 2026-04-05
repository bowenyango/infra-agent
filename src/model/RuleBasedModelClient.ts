import type { ModelClient } from './ModelClient.ts';
import { RuleBasedPlanningModel } from '../agent/rule-based-planner.ts';
import type { AgentDecision, AgentRuntimeState } from '../types/agent.ts';

export class RuleBasedModelClient implements ModelClient {
  readonly name: string;
  readonly planner = new RuleBasedPlanningModel();

  constructor(name = 'rule-based-model-client') {
    this.name = name;
  }

  async decideNextAction(runtime: AgentRuntimeState): Promise<AgentDecision> {
    return this.planner.decideNextAction({
      runtime
    });
  }
}
