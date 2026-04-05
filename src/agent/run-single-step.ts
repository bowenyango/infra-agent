import type {
  AgentDecision,
  AgentDecisionExecution,
  AgentRuntimeState,
  PlanningModel
} from '../types/agent.ts';
import { buildRunPreflight } from './build-run-preflight.ts';
import { executeDecision } from './execute-decision.ts';
import type { RunPreflightState } from '../types/repository.ts';
import { RuleBasedPlanningModel } from './rule-based-planner.ts';
import type { ValidationRunOutput, WriteFileOutput } from '../types/tools.ts';

export interface AgentRunState {
  modelName: string;
  preflight: RunPreflightState;
  runtime: AgentRuntimeState;
  decisions: AgentDecision[];
  executions: AgentDecisionExecution[];
}

function applyExecutionToRuntime(runtime: AgentRuntimeState, execution: AgentDecisionExecution): AgentRuntimeState {
  const nextRuntime: AgentRuntimeState = {
    ...runtime,
    observations: [...runtime.observations],
    appliedWrites: [...runtime.appliedWrites],
    validationResults: [...runtime.validationResults]
  };

  for (const toolResult of execution.executedTools) {
    nextRuntime.observations.push(toolResult);

    if (toolResult.toolName === 'write_file') {
      const output = toolResult.output as WriteFileOutput;
      nextRuntime.appliedWrites.push({
        path: output.path,
        content: '',
        reason: 'Applied via write_file tool.'
      });
    }

    if (toolResult.toolName === 'validate_targets') {
      const output = toolResult.output as ValidationRunOutput;
      nextRuntime.validationResults.push(...output.results);
    }
  }

  return nextRuntime;
}

function buildInitialRuntime(task: string, preflight: RunPreflightState): AgentRuntimeState {
  return {
    task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: []
  };
}

export async function runSingleStep(task: string, workspacePath: string, model?: PlanningModel): Promise<AgentRunState> {
  const effectiveModel = model ?? new RuleBasedPlanningModel();
  const preflight = await buildRunPreflight(task, workspacePath);
  let runtime = buildInitialRuntime(task, preflight);
  const decisions: AgentDecision[] = [];
  const executions: AgentDecisionExecution[] = [];

  for (let step = 0; step < 4; step += 1) {
    const decision = await effectiveModel.decideNextAction({
      runtime
    });
    decisions.push(decision);

    const execution = await executeDecision(decision, preflight.workspaceRoot);
    if (!execution) {
      break;
    }

    executions.push(execution);
    runtime = applyExecutionToRuntime(runtime, execution);

    if (decision.action.kind === 'validate-targets' || decision.action.kind === 'stop') {
      break;
    }
  }

  return {
    modelName: effectiveModel.name,
    preflight,
    runtime,
    decisions,
    executions
  };
}
