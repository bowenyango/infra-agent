import { buildRunPreflight } from './build-run-preflight.ts';
import type { PlanningModel } from '../types/agent.ts';
import type { RunPreflightState } from '../types/repository.ts';
import { RuleBasedPlanningModel } from './rule-based-planner.ts';

export interface AgentRunState {
  modelName: string;
  preflight: RunPreflightState;
  decision: Awaited<ReturnType<PlanningModel['decideNextAction']>>;
}

export async function runSingleStep(task: string, workspacePath: string, model?: PlanningModel): Promise<AgentRunState> {
  const effectiveModel = model ?? new RuleBasedPlanningModel();
  const preflight = await buildRunPreflight(task, workspacePath);
  const decision = await effectiveModel.decideNextAction({
    preflight
  });

  return {
    modelName: effectiveModel.name,
    preflight,
    decision
  };
}

