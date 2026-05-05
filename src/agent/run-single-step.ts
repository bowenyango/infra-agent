import type { PlanningModel } from '../types/agent.ts';
import type { AgentRunOutcome, AgentRuntimeState } from '../types/agent.ts';
import { runQueryLoop } from '../query.ts';
import type { RunApprovalScope, RunPreflightState } from '../types/repository.ts';
import type { QueryLoopConfig, QueryLoopConfigOverrides } from '../query-config.ts';
import type { LLMClientConfigOverrides, PlannerMode } from '../model/config.ts';
import { createModelClientSelection, type PlannerRuntimeConfig } from '../model/create-model-client.ts';
import type { ModelClient } from '../model/ModelClient.ts';

export interface AgentRunState {
  modelName: string;
  outcome: AgentRunOutcome;
  preflight: RunPreflightState;
  runtime: AgentRuntimeState;
  turns: Awaited<ReturnType<typeof runQueryLoop>>['turns'];
  config: QueryLoopConfig;
  plannerConfig?: PlannerRuntimeConfig;
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
  queryConfig?: QueryLoopConfigOverrides,
  plannerOptions?: LLMClientConfigOverrides
): Promise<AgentRunState> {
  const modelSelection = model ? null : createModelClientSelection(plannerMode, undefined, plannerOptions);
  const modelClient = model ? toModelClient(model) : modelSelection.client;
  const result = await runQueryLoop(task, workspacePath, modelClient, approvalScope, queryConfig);
  const preflight = result.runtime.preflight;
  const plannerConfig = modelSelection?.plannerConfig ?? {
    requestedMode: plannerMode,
    effectiveMode: 'custom',
    clientName: modelClient.name,
    fallbackReason: null,
    llm: null
  } satisfies PlannerRuntimeConfig;

  return {
    modelName: modelClient.name,
    outcome: result.outcome,
    preflight,
    runtime: result.runtime,
    turns: result.turns,
    config: result.config,
    plannerConfig
  };
}
