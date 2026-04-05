import { buildRunPreflight } from './build-run-preflight.ts';
import { executeDecision } from './execute-decision.ts';
import type { PlanningModel } from '../types/agent.ts';
import type { RunPreflightState } from '../types/repository.ts';
import { RuleBasedPlanningModel } from './rule-based-planner.ts';
import type { AgentDecisionExecution } from '../types/agent.ts';

export interface AgentRunState {
  modelName: string;
  preflight: RunPreflightState;
  decision: Awaited<ReturnType<PlanningModel['decideNextAction']>>;
  execution: AgentDecisionExecution | null;
}

export async function runSingleStep(task: string, workspacePath: string, model?: PlanningModel): Promise<AgentRunState> {
  const effectiveModel = model ?? new RuleBasedPlanningModel();
  const preflight = await buildRunPreflight(task, workspacePath);
  const decision = await effectiveModel.decideNextAction({
    preflight
  });
  const execution = await executeDecision(decision, preflight.workspaceRoot);

  return {
    modelName: effectiveModel.name,
    preflight,
    decision,
    execution
  };
}
