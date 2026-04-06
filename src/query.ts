import { buildRunPreflight } from './agent/build-run-preflight.ts';
import { buildEditPlan } from './agent/build-edit-plan.ts';
import { executeDecision } from './agent/execute-decision.ts';
import type { AgentDecisionExecution, AgentRuntimeState, FileWritePlan } from './types/agent.ts';
import type { RunPreflightState } from './types/repository.ts';
import type { QueryLoopResult, QueryTurn } from './types/query.ts';
import type { FileReadOutput, ValidationRunOutput, WriteFileOutput } from './types/tools.ts';
import type { ModelClient } from './model/ModelClient.ts';
import { RuleBasedModelClient } from './model/RuleBasedModelClient.ts';

function cloneRuntimeState(runtime: AgentRuntimeState): AgentRuntimeState {
  return {
    ...runtime,
    observations: [...runtime.observations],
    appliedWrites: [...runtime.appliedWrites],
    validationResults: [...runtime.validationResults]
  };
}

function applyExecutionToRuntime(runtime: AgentRuntimeState, execution: AgentDecisionExecution): AgentRuntimeState {
  const nextRuntime = cloneRuntimeState(runtime);

  for (const toolResult of execution.executedTools) {
    nextRuntime.observations.push(toolResult);

    if (toolResult.toolName === 'write_file') {
      const output = toolResult.output as WriteFileOutput;
      nextRuntime.appliedWrites.push({
        path: output.path,
        content: output.content,
        reason: 'Applied via write_file tool.'
      } satisfies FileWritePlan);
      nextRuntime.observations.push({
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: output.path,
          content: output.content,
          truncated: false
        } satisfies FileReadOutput
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
    validationResults: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
}

function shouldStopLoop(turn: QueryTurn): boolean {
  if (turn.decision.action.kind === 'stop') {
    return true;
  }

  if (turn.decision.action.kind === 'ask-for-clarification') {
    return true;
  }

  return false;
}

export async function runQueryLoop(
  task: string,
  workspacePath: string,
  modelClient?: ModelClient
): Promise<QueryLoopResult> {
  const effectiveModelClient = modelClient ?? new RuleBasedModelClient();
  const preflight = await buildRunPreflight(task, workspacePath);
  let runtime = buildInitialRuntime(task, preflight);
  const turns: QueryTurn[] = [];

  for (let turnIndex = 0; turnIndex < 6; turnIndex += 1) {
    const decision = await effectiveModelClient.decideNextAction(runtime);
    const execution = await executeDecision(decision, preflight.workspaceRoot, preflight.inspection.config);

    if (execution) {
      runtime = applyExecutionToRuntime(runtime, execution);
    }

    if (decision.action.kind === 'apply-edit-plan' && runtime.validationResults.some(result => result.exitCode !== 0)) {
      runtime = {
        ...runtime,
        repairAttempts: runtime.repairAttempts + 1,
        validationResults: []
      };
    }

    runtime = {
      ...runtime,
      lastEditPlan: buildEditPlan(runtime)
    };

    const turn: QueryTurn = {
      index: turnIndex,
      decision,
      execution,
      runtimeSnapshot: cloneRuntimeState(runtime)
    };

    turns.push(turn);

    if (shouldStopLoop(turn)) {
      break;
    }
  }

  return {
    runtime,
    turns
  };
}
