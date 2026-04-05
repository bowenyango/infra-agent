import type {
  AgentDecision,
  AgentPlanningInput,
  PlanningModel
} from '../types/agent.ts';

export abstract class BasePlanningModel implements PlanningModel {
  abstract readonly name: string;

  abstract decideNextAction(input: AgentPlanningInput): Promise<AgentDecision>;
}

