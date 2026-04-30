import type { PlanningModel } from '../types/agent.ts';
import type { AgentRunOutcome, AgentRuntimeState } from '../types/agent.ts';
import { runQueryLoop } from '../query.ts';
import type { RunApprovalScope, RunPreflightState } from '../types/repository.ts';
import type { QueryLoopConfig, QueryLoopConfigOverrides } from '../query-config.ts';
import type { PlannerMode } from '../model/config.ts';
import { createModelClient } from '../model/create-model-client.ts';
import type { ModelClient } from '../model/ModelClient.ts';

export interface AgentRunState {
  modelName: string;
  outcome: AgentRunOutcome;
  preflight: RunPreflightState;
  runtime: AgentRuntimeState;
  turns: Awaited<ReturnType<typeof runQueryLoop>>['turns'];
  config: QueryLoopConfig;
}

function toModelClient(model: PlanningModel): ModelClient {
  return {
    name: model.name,
    decideNextAction(runtime: AgentRuntimeState) {
      return model.decideNextAction({ runtime });
    }
  };
}

export async function runSingleStep(
  task: string,
  workspacePath: string,
  model?: PlanningModel,
  plannerMode: PlannerMode = 'auto',
  approvalScope?: Partial<RunApprovalScope>,
  queryConfig?: QueryLoopConfigOverrides
): Promise<AgentRunState> {
  const modelClient = model ? toModelClient(model) : createModelClient(plannerMode);
  const result = await runQueryLoop(task, workspacePath, modelClient, approvalScope, queryConfig);
  const preflight = result.runtime.preflight;

  return {
    modelName: modelClient.name,
    outcome: result.outcome,
    preflight,
    runtime: result.runtime,
    turns: result.turns,
    config: result.config
  };
}
