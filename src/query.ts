import { buildRunPreflight } from './agent/build-run-preflight.ts';
import { isAbsolute, relative } from 'node:path';
import { resolveQueryLoopConfig } from './query-config.ts';
import { classifyValidationIssues } from './agent/classify-validation-issues.ts';
import { refreshRuntimeConfigSemantics } from './agent/config-semantics-state.ts';
import { collectApprovalSignals } from './agent/collect-approval-signals.ts';
import { buildEditPlan } from './agent/build-edit-plan.ts';
import { executeDecision } from './agent/execute-decision.ts';
import type { AgentActionKind, AgentDecisionExecution, AgentRuntimeState, FileWritePlan, ToolExecutionSummary } from './types/agent.ts';
import type { RunPreflightState, TerraformRootSummary } from './types/repository.ts';
import type { RunApprovalScope } from './types/repository.ts';
import type { QueryLoopResult, QueryTurn } from './types/query.ts';
import type { QueryLoopConfig } from './query-config.ts';
import type { RetrievedContextPacket } from './types/knowledge.ts';
import { retrieveTerraformRegistryContextPackets } from './domain/terraform-registry-context.ts';
import { retrieveHelmChartContextPackets } from './domain/helm-chart-context.ts';
import type {
  DiffPreviewOutput,
  DirectoryListingOutput,
  FileReadOutput,
  HelmShowChartOutput,
  HelmShowValuesOutput,
  PulumiConfigSetOutput,
  SearchWorkspaceOutput,
  TerraformFormatRepairOutput,
  ValidationRunOutput,
  WriteFileOutput,
  YamlSyntaxValidationOutput
} from './types/tools.ts';
import type { ModelClient } from './model/ModelClient.ts';
import { RuleBasedModelClient } from './model/RuleBasedModelClient.ts';
import type { AgentRunOutcome } from './types/agent.ts';
import type { HelmChartSummary } from './types/repository.ts';

function cloneRuntimeState(runtime: AgentRuntimeState): AgentRuntimeState {
  return {
    ...runtime,
    configSemantics: runtime.configSemantics?.map(summary => ({
      ...summary,
      facts: [...summary.facts]
    })),
    retrievedContext: [...runtime.retrievedContext],
    observations: [...runtime.observations],
    toolSummaries: [...(runtime.toolSummaries ?? [])],
    appliedWrites: [...runtime.appliedWrites],
    validationResults: [...runtime.validationResults],
    validationIssues: [...runtime.validationIssues],
    approvalSignals: [...runtime.approvalSignals]
  };
}

function displayPath(path: string, workspaceRoot: string): string {
  if (!isAbsolute(path)) {
    return path;
  }

  const relativePath = relative(workspaceRoot, path);
  return relativePath && !relativePath.startsWith('..') ? relativePath : path;
}

function summarizeExecutedTool(params: {
  turnIndex: number;
  actionKind: AgentActionKind;
  toolResult: AgentDecisionExecution['executedTools'][number];
  workspaceRoot: string;
}): ToolExecutionSummary {
  const { turnIndex, actionKind, toolResult, workspaceRoot } = params;
  const base = {
    turnIndex,
    actionKind,
    toolName: toolResult.toolName,
    safety: toolResult.safety
  };

  switch (toolResult.toolName) {
    case 'list_directory': {
      const output = toolResult.output as DirectoryListingOutput;
      return {
        ...base,
        summary: `Listed ${output.path} (${output.entries.length} item(s))`
      };
    }
    case 'search_workspace': {
      const output = toolResult.output as SearchWorkspaceOutput;
      return {
        ...base,
        summary: `Searched ${output.rootPath} (${output.matches.length} match(es))`
      };
    }
    case 'read_file': {
      const output = toolResult.output as FileReadOutput;
      return {
        ...base,
        summary: `Read ${displayPath(output.path, workspaceRoot)}${output.truncated ? ' (truncated)' : ''}`
      };
    }
    case 'helm_show_chart': {
      const output = toolResult.output as HelmShowChartOutput;
      return {
        ...base,
        summary: `Loaded Helm chart metadata for ${output.chartPath}${output.exitCode === 0 ? '' : ` (exit ${output.exitCode})`}`
      };
    }
    case 'helm_show_values': {
      const output = toolResult.output as HelmShowValuesOutput;
      return {
        ...base,
        summary: `Loaded Helm values for ${output.chartPath}${output.exitCode === 0 ? '' : ` (exit ${output.exitCode})`}`
      };
    }
    case 'diff_preview': {
      const output = toolResult.output as DiffPreviewOutput;
      return {
        ...base,
        summary: `Previewed diff for ${displayPath(output.path, workspaceRoot)} (+${output.addedLines}/-${output.removedLines})`
      };
    }
    case 'write_file':
    case 'append_file':
    case 'replace_file': {
      const output = toolResult.output as WriteFileOutput;
      const verb = toolResult.toolName === 'append_file'
        ? 'Appended'
        : toolResult.toolName === 'replace_file'
          ? 'Replaced'
          : 'Wrote';
      return {
        ...base,
        summary: `${verb} ${displayPath(output.path, workspaceRoot)} (${output.bytesWritten} byte(s))`
      };
    }
    case 'pulumi_config_set': {
      const output = toolResult.output as PulumiConfigSetOutput;
      return {
        ...base,
        summary: `Set Pulumi config ${output.key} in ${output.stackFilePath}${output.exitCode === 0 ? '' : ` (exit ${output.exitCode})`}`
      };
    }
    case 'validate_targets': {
      const output = toolResult.output as ValidationRunOutput;
      const failed = output.results.filter(result => result.exitCode !== 0).length;
      return {
        ...base,
        summary: `Ran ${output.results.length} validator command(s)${failed > 0 ? ` (${failed} failed)` : ' (passed)'}`
      };
    }
    case 'validate_yaml_syntax': {
      const output = toolResult.output as YamlSyntaxValidationOutput;
      return {
        ...base,
        summary: `Parsed YAML for ${displayPath(output.path, workspaceRoot)} with ${output.parser}${output.result.exitCode === 0 ? ' (passed)' : ' (failed)'}`
      };
    }
    case 'terraform_fmt': {
      const output = toolResult.output as TerraformFormatRepairOutput;
      return {
        ...base,
        summary: `Ran terraform fmt for ${output.rootPath} (${output.formattedFiles.length} file(s) formatted)`
      };
    }
    default:
      return {
        ...base,
        summary: `Executed ${toolResult.toolName}`
      };
  }
}

function applyExecutionToRuntime(
  runtime: AgentRuntimeState,
  execution: AgentDecisionExecution,
  turnIndex: number,
  actionKind: AgentActionKind
): AgentRuntimeState {
  const nextRuntime = cloneRuntimeState(runtime);

  for (const toolResult of execution.executedTools) {
    nextRuntime.observations.push(toolResult);
    nextRuntime.toolSummaries.push(summarizeExecutedTool({
      turnIndex,
      actionKind,
      toolResult,
      workspaceRoot: runtime.preflight.workspaceRoot
    }));

    if (toolResult.toolName === 'write_file' || toolResult.toolName === 'append_file' || toolResult.toolName === 'replace_file') {
      const output = toolResult.output as WriteFileOutput;
      nextRuntime.appliedWrites.push({
        path: output.path,
        content: output.content,
        reason: `Applied via ${toolResult.toolName} tool.`
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

    if (toolResult.toolName === 'pulumi_config_set') {
      const output = toolResult.output as PulumiConfigSetOutput;
      nextRuntime.appliedWrites.push({
        path: output.stackFilePath,
        content: output.content,
        reason: `Applied ${output.key} via pulumi_config_set tool.`
      } satisfies FileWritePlan);
      nextRuntime.observations.push({
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: output.stackFilePath,
          content: output.content,
          truncated: false
        } satisfies FileReadOutput
      });
    }

    if (toolResult.toolName === 'validate_targets') {
      const output = toolResult.output as ValidationRunOutput;
      nextRuntime.validationResults.push(...output.results);
      nextRuntime.validationIssues = classifyValidationIssues(nextRuntime.validationResults);
      nextRuntime.configSemantics = refreshRuntimeConfigSemantics(nextRuntime);
    }

    if (toolResult.toolName === 'validate_yaml_syntax') {
      const output = toolResult.output as YamlSyntaxValidationOutput;
      nextRuntime.validationResults.push(output.result);
      nextRuntime.validationIssues = classifyValidationIssues(nextRuntime.validationResults);
      nextRuntime.configSemantics = refreshRuntimeConfigSemantics(nextRuntime);
    }

    if (toolResult.toolName === 'terraform_fmt') {
      const output = toolResult.output as TerraformFormatRepairOutput;
      for (const formattedFile of output.formattedFiles) {
        nextRuntime.appliedWrites.push({
          path: formattedFile.path,
          content: formattedFile.content,
          reason: 'Applied via terraform_fmt tool.',
          mode: 'replace',
          risk: 'low'
        } satisfies FileWritePlan);
        nextRuntime.observations.push({
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: formattedFile.path,
            content: formattedFile.content,
            truncated: false
          } satisfies FileReadOutput
        });
      }
    }
  }

  return nextRuntime;
}

function selectTerraformContextRoots(preflight: RunPreflightState): TerraformRootSummary[] {
  if (!preflight.requestedDomains.includes('terraform')) {
    return [];
  }

  const targetPaths = new Set(
    preflight.targetCandidates
      .filter(candidate => candidate.kind === 'terraform-root')
      .slice(0, 2)
      .map(candidate => candidate.path)
  );

  if (targetPaths.size === 0) {
    return [];
  }

  return preflight.inspection.terraformRoots.filter(root => targetPaths.has(root.rootPath));
}

function selectHelmContextCharts(preflight: RunPreflightState): HelmChartSummary[] {
  if (!preflight.requestedDomains.includes('helm')) {
    return [];
  }

  const targetPaths = new Set(
    preflight.targetCandidates
      .filter(candidate => candidate.kind === 'helm-chart')
      .slice(0, 2)
      .map(candidate => candidate.path)
  );

  if (targetPaths.size === 0) {
    return [];
  }

  return preflight.inspection.helmCharts.filter(chart => targetPaths.has(chart.chartRoot));
}

async function retrieveInitialContext(preflight: RunPreflightState): Promise<RetrievedContextPacket[]> {
  const packets: RetrievedContextPacket[] = [];

  for (const root of selectTerraformContextRoots(preflight)) {
    packets.push(...await retrieveTerraformRegistryContextPackets({
      workspaceRoot: preflight.workspaceRoot,
      root,
      cacheRoot: preflight.inspection.knowledgeCache.root,
      reason: `Terraform Registry docs for selected root ${root.rootPath}`,
      maxSources: 3
    }));
  }

  for (const chart of selectHelmContextCharts(preflight)) {
    packets.push(...await retrieveHelmChartContextPackets({
      workspaceRoot: preflight.workspaceRoot,
      chart,
      cacheRoot: preflight.inspection.knowledgeCache.root,
      reason: `Helm chart docs for selected chart ${chart.chartRoot}`,
      maxExternalSources: 2
    }));
  }

  return packets.slice(0, 5);
}

async function buildInitialRuntime(task: string, preflight: RunPreflightState): Promise<AgentRuntimeState> {
  return {
    task,
    preflight,
    configSemantics: [...preflight.inspection.configSemantics],
    retrievedContext: await retrieveInitialContext(preflight),
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
}

function executionHasValidationFailure(execution: AgentDecisionExecution | null): boolean {
  return execution?.executedTools.some(toolResult => {
    if (toolResult.toolName !== 'validate_yaml_syntax') {
      return false;
    }

    return (toolResult.output as YamlSyntaxValidationOutput).result.exitCode !== 0;
  }) ?? false;
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

function determineOutcome(turns: QueryTurn[]): AgentRunOutcome {
  const lastTurn = turns[turns.length - 1];
  if (!lastTurn) {
    return 'no-safe-action';
  }

  if (lastTurn.decision.action.kind === 'ask-for-clarification') {
    return lastTurn.decision.action.payload?.clarificationKind === 'approval-required'
      ? 'approval-required'
      : 'clarification-required';
  }

  if (lastTurn.decision.action.kind !== 'stop') {
    return 'no-safe-action';
  }

  switch (lastTurn.decision.action.payload?.stopReason) {
    case 'validation-succeeded':
      return 'completed';
    case 'validation-blocked':
      return 'validation-blocked';
    case 'repair-budget-exhausted':
      return 'repair-budget-exhausted';
    case 'no-safe-action':
    default:
      return 'no-safe-action';
  }
}

export async function runQueryLoop(
  task: string,
  workspacePath: string,
  modelClient?: ModelClient,
  approvalScope?: Partial<RunApprovalScope>,
  config?: Partial<QueryLoopConfig>
): Promise<QueryLoopResult> {
  const effectiveModelClient = modelClient ?? new RuleBasedModelClient();
  const queryConfig = resolveQueryLoopConfig(config);
  const preflight = await buildRunPreflight(task, workspacePath, approvalScope);
  let runtime = await buildInitialRuntime(task, preflight);
  const turns: QueryTurn[] = [];

  for (let turnIndex = 0; turnIndex < queryConfig.maxTurns; turnIndex += 1) {
    const decision = await effectiveModelClient.decideNextAction(runtime);
    const hadValidationIssuesBeforeAction = runtime.validationIssues.length > 0;
    const execution = await executeDecision(decision, preflight.workspaceRoot, preflight.inspection.config);

    if (execution) {
      runtime = applyExecutionToRuntime(runtime, execution, turnIndex, decision.action.kind);
    }

    if (
      (decision.action.kind === 'apply-edit-plan' || decision.action.kind === 'repair-terraform-formatting')
      && hadValidationIssuesBeforeAction
      && runtime.validationIssues.length > 0
      && !executionHasValidationFailure(execution)
    ) {
      runtime = {
        ...runtime,
        repairAttempts: runtime.repairAttempts + 1,
        validationResults: [],
        validationIssues: []
      };
    }

    runtime = {
      ...runtime,
      lastEditPlan: buildEditPlan(runtime)
    };
    runtime = {
      ...runtime,
      approvalSignals: collectApprovalSignals(runtime)
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
    outcome: determineOutcome(turns),
    runtime,
    turns,
    config: queryConfig
  };
}
