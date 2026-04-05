import type { PlanningModel } from '../types/agent.ts';
import type { AgentRuntimeState } from '../types/agent.ts';
import { runQueryLoop } from '../query.ts';
import type { RunPreflightState } from '../types/repository.ts';
import { RuleBasedModelClient } from '../model/RuleBasedModelClient.ts';

export interface AgentRunState {
  modelName: string;
  preflight: RunPreflightState;
  runtime: AgentRuntimeState;
  turns: Awaited<ReturnType<typeof runQueryLoop>>['turns'];
}

export async function runSingleStep(task: string, workspacePath: string, model?: PlanningModel): Promise<AgentRunState> {
  const modelClient = model
    ? {
        name: model.name,
        decideNextAction(runtime: AgentRuntimeState) {
          return model.decideNextAction({ runtime });
        }
      }
    : new RuleBasedModelClient();
  const result = await runQueryLoop(task, workspacePath, modelClient);
  const preflight = result.runtime.preflight;

  return {
    modelName: modelClient.name,
    preflight,
    runtime: result.runtime,
    turns: result.turns
  };
}
