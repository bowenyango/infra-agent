import { buildRunPreflight } from './agent/build-run-preflight.ts';
import { isAbsolute, relative } from 'node:path';
import { resolveQueryLoopConfig } from './query-config.ts';
import { classifyValidationIssues } from './agent/classify-validation-issues.ts';
import { refreshRuntimeConfigSemantics } from './agent/config-semantics-state.ts';
import { collectApprovalSignals } from './agent/collect-approval-signals.ts';
import { buildEditPlan } from './agent/build-edit-plan.ts';
import { executeDecision } from './agent/execute-decision.ts';
import type {
  AgentActionKind,
  AgentDecision,
  AgentDecisionExecution,
  AgentRuntimeState,
  AgentRunOutcome,
  ApprovalSignal,
  FileWritePlan,
  ToolExecutionSummary
} from './types/agent.ts';
import type { RunPreflightState, TerraformRootSummary } from './types/repository.ts';
import type { RunApprovalScope } from './types/repository.ts';
import type { QueryLoopResult, QueryTurn } from './types/query.ts';
import type { QueryLoopConfig, QueryLoopConfigOverrides } from './query-config.ts';
import type { RetrievedContextPacket } from './types/knowledge.ts';
import { retrieveTerraformProviderSchemaContextPackets } from './domain/terraform-provider-schema.ts';
import { retrieveTerraformRegistryContextPackets } from './domain/terraform-registry-context.ts';
import { retrieveHelmChartContextPackets } from './domain/helm-chart-context.ts';
import { buildKnowledgePack } from './knowledge/pack.ts';
import { syncInfraWorkflowRecipeKnowledgeUnits } from './knowledge/infra-workflow-recipe-units.ts';
import { syncValidationDiagnosticKnowledgeUnits } from './knowledge/validation-diagnostic-units.ts';
import { classifyToolPermission } from './agent/tool-permissions.ts';
import {
  isApprovalRequiredForToolCategory,
  isApprovalRequiredForWrite,
  isToolCategoryCoveredByApproval,
  isWriteCoveredByApproval
} from './domain/workspace-policy.ts';
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
import type { HelmChartSummary } from './types/repository.ts';
import type { InfraDomainId, TargetCandidate } from './types/repository.ts';

const APPROVAL_GATE_EXECUTION_REASON = 'Approval is required before executing this workspace mutation.';

function cloneRuntimeState(runtime: AgentRuntimeState): AgentRuntimeState {
  return {
    ...runtime,
    configSemantics: runtime.configSemantics?.map(summary => ({
      ...summary,
      facts: [...summary.facts]
    })),
    retrievedContext: [...runtime.retrievedContext],
    knowledgeFacts: runtime.knowledgeFacts
      ? {
          ...runtime.knowledgeFacts,
          sources: [...runtime.knowledgeFacts.sources],
          facts: [...runtime.knowledgeFacts.facts],
          units: [...runtime.knowledgeFacts.units]
        }
      : null,
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
    safety: toolResult.safety,
    permission: classifyToolPermission(toolResult.toolName, toolResult.safety)
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

  function refreshValidationDerivedState(): void {
    nextRuntime.validationIssues = classifyValidationIssues(nextRuntime.validationResults);
    nextRuntime.configSemantics = refreshRuntimeConfigSemantics(nextRuntime);
    const syncedRuntime = syncValidationDiagnosticKnowledgeUnits(nextRuntime);
    nextRuntime.knowledgeFacts = syncedRuntime.knowledgeFacts;
  }

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
      refreshValidationDerivedState();
    }

    if (toolResult.toolName === 'validate_yaml_syntax') {
      const output = toolResult.output as YamlSyntaxValidationOutput;
      nextRuntime.validationResults.push(output.result);
      refreshValidationDerivedState();
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
    packets.push(...await retrieveTerraformProviderSchemaContextPackets({
      workspaceRoot: preflight.workspaceRoot,
      root,
      reason: `Local Terraform provider schema for selected root ${root.rootPath}`
    }));

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

function knowledgeDomainForTargetKind(kind: TargetCandidate['kind']): InfraDomainId {
  switch (kind) {
    case 'helm-chart':
      return 'helm';
    case 'pulumi-project':
      return 'pulumi';
    case 'terraform-root':
      return 'terraform';
  }
}

function selectKnowledgeFactScope(preflight: RunPreflightState): {
  domains: InfraDomainId[];
  targetPaths: string[];
} {
  const selectedCandidates = preflight.requestedDomains.length === 0
    ? preflight.targetCandidates.slice(0, 1)
    : preflight.requestedDomains.flatMap(domain => {
      const candidate = preflight.targetCandidates.find(target =>
        knowledgeDomainForTargetKind(target.kind) === domain
      );
      return candidate ? [candidate] : [];
    });
  const domains = preflight.requestedDomains.length > 0
    ? preflight.requestedDomains
    : Array.from(new Set(selectedCandidates.map(candidate => knowledgeDomainForTargetKind(candidate.kind))));

  return {
    domains,
    targetPaths: Array.from(new Set(selectedCandidates.map(candidate => candidate.path)))
  };
}

async function retrieveInitialKnowledgeFacts(
  preflight: RunPreflightState,
  config: QueryLoopConfig
): Promise<AgentRuntimeState['knowledgeFacts']> {
  const scope = selectKnowledgeFactScope(preflight);
  if (scope.targetPaths.length === 0 || scope.domains.length === 0) {
    return null;
  }

  const pack = await buildKnowledgePack(preflight.inspection, {
    domains: scope.domains,
    targetPaths: scope.targetPaths,
    maxFacts: config.retrievedContextBudget.maxFacts
  });

  return pack.factCount > 0 || pack.unitCount > 0 ? pack : null;
}

function syncInitialWorkflowRecipeKnowledgeUnits(runtime: AgentRuntimeState): AgentRuntimeState {
  const sourceById = new Map((runtime.knowledgeFacts?.sources ?? []).map(source => [source.id, source]));
  const selectedWorkflowRecipes = runtime.knowledgeFacts?.units.filter(unit =>
    unit.unitType === 'recipe' && unit.extractionMethod === 'workflow-recipe'
    && sourceById.get(unit.sourceId)?.kind === 'knowledge-unit-artifact'
  ) ?? [];
  const syncedRuntime = syncInfraWorkflowRecipeKnowledgeUnits(runtime);
  if (!syncedRuntime.knowledgeFacts || selectedWorkflowRecipes.length === 0) {
    return syncedRuntime;
  }

  const selectedRecipeBySourceId = new Map(selectedWorkflowRecipes.map(unit => [unit.sourceId, unit]));
  const selectedRecipeForSource = (sourceId: string) => {
    const source = sourceById.get(sourceId);
    return selectedRecipeBySourceId.get(sourceId) ?? selectedWorkflowRecipes.find(recipe => {
      const recipeSource = sourceById.get(recipe.sourceId);
      return source && recipeSource
        && source.domain === recipeSource.domain
        && source.targetPath === recipeSource.targetPath;
    });
  };

  return {
    ...syncedRuntime,
    knowledgeFacts: {
      ...syncedRuntime.knowledgeFacts,
      units: syncedRuntime.knowledgeFacts.units.map(unit => {
        if (unit.unitType !== 'recipe' || unit.extractionMethod !== 'workflow-recipe') {
          return unit;
        }

        return selectedRecipeForSource(unit.sourceId) ?? unit;
      })
    }
  };
}

async function buildInitialRuntime(
  task: string,
  preflight: RunPreflightState,
  config: QueryLoopConfig
): Promise<AgentRuntimeState> {
  const runtime: AgentRuntimeState = {
    task,
    preflight,
    configSemantics: [...preflight.inspection.configSemantics],
    retrievedContext: await retrieveInitialContext(preflight),
    knowledgeFacts: await retrieveInitialKnowledgeFacts(preflight, config),
    retrievedContextBudget: config.retrievedContextBudget,
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    maxRepairAttempts: config.maxRepairAttempts,
    lastEditPlan: null
  };

  return syncInitialWorkflowRecipeKnowledgeUnits(runtime);
}

function executionHasValidationFailure(execution: AgentDecisionExecution | null): boolean {
  return execution?.executedTools.some(toolResult => {
    if (toolResult.toolName !== 'validate_yaml_syntax') {
      return false;
    }

    return (toolResult.output as YamlSyntaxValidationOutput).result.exitCode !== 0;
  }) ?? false;
}

function collectDecisionApprovalSignals(decision: AgentDecision, runtime: AgentRuntimeState): ApprovalSignal[] {
  if (decision.action.kind !== 'apply-edit-plan') {
    return [];
  }

  const writes = decision.action.payload?.writes ?? [];
  const writeSignals = writes.flatMap(write => {
    if (!isApprovalRequiredForWrite(write, runtime.preflight.inspection.config, runtime.preflight.profile.id)) {
      return [];
    }

    if (isWriteCoveredByApproval(write, runtime.preflight.approval)) {
      return [];
    }

    return [{
      kind: 'write-approval-required',
      path: write.path,
      risk: write.risk,
      message: `The planned ${write.mode ?? 'rewrite'} change at ${write.path} has risk=${write.risk}. Approval is required before applying this edit.`
    } satisfies ApprovalSignal];
  });

  const toolCategorySignals = (decision.action.payload?.editPlan?.pulumiConfigOperations ?? []).length > 0
    && isApprovalRequiredForToolCategory('native-stack-config-write', runtime.preflight.inspection.config, runtime.preflight.profile.id)
    && !isToolCategoryCoveredByApproval('native-stack-config-write', runtime.preflight.approval)
      ? [{
          kind: 'tool-category-approval-required',
          toolCategory: 'native-stack-config-write',
          message: 'The planned edit uses native-stack-config-write, which is marked approval-required by workspace policy. Approval is required before executing this native operation.'
        } satisfies ApprovalSignal]
      : [];

  return [...writeSignals, ...toolCategorySignals];
}

function buildApprovalGateExecution(
  decision: AgentDecision,
  runtime: AgentRuntimeState
): { execution: AgentDecisionExecution; approvalSignals: ApprovalSignal[]; runtime: AgentRuntimeState } | null {
  const decisionApprovalSignals = collectDecisionApprovalSignals(decision, runtime);
  const approvalSignals = runtime.approvalSignals.length > 0
    ? runtime.approvalSignals
    : decisionApprovalSignals;

  if (approvalSignals.length === 0) {
    return null;
  }

  if (decision.action.kind !== 'apply-edit-plan' && decision.action.kind !== 'repair-terraform-formatting') {
    return null;
  }

  return {
    execution: {
      status: 'skipped',
      executedTools: [],
      reason: APPROVAL_GATE_EXECUTION_REASON
    },
    approvalSignals,
    runtime: {
      ...runtime,
      approvalSignals,
      lastEditPlan: decision.action.kind === 'apply-edit-plan'
        ? decision.action.payload?.editPlan ?? runtime.lastEditPlan
        : runtime.lastEditPlan
    }
  };
}

function isApprovalGateTurn(turn: QueryTurn): boolean {
  return turn.execution?.status === 'skipped'
    && turn.execution.reason === APPROVAL_GATE_EXECUTION_REASON;
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

  if (isApprovalGateTurn(lastTurn)) {
    return 'approval-required';
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
  config?: QueryLoopConfigOverrides
): Promise<QueryLoopResult> {
  const effectiveModelClient = modelClient ?? new RuleBasedModelClient();
  const queryConfig = resolveQueryLoopConfig(config);
  const preflight = await buildRunPreflight(task, workspacePath, approvalScope);
  let runtime = await buildInitialRuntime(task, preflight, queryConfig);
  const turns: QueryTurn[] = [];

  for (let turnIndex = 0; turnIndex < queryConfig.maxTurns; turnIndex += 1) {
    const decision = await effectiveModelClient.decideNextAction(runtime);
    const hadValidationIssuesBeforeAction = runtime.validationIssues.length > 0;
    const approvalGate = buildApprovalGateExecution(decision, runtime);
    const execution = approvalGate?.execution
      ?? await executeDecision(decision, preflight.workspaceRoot, preflight.inspection.config);

    if (approvalGate) {
      runtime = approvalGate.runtime;
    } else if (execution) {
      runtime = applyExecutionToRuntime(runtime, execution, turnIndex, decision.action.kind);
    }

    if (
      (decision.action.kind === 'apply-edit-plan' || decision.action.kind === 'repair-terraform-formatting')
      && hadValidationIssuesBeforeAction
      && runtime.validationIssues.length > 0
      && execution?.status === 'completed'
      && !executionHasValidationFailure(execution)
    ) {
      runtime = {
        ...runtime,
        repairAttempts: runtime.repairAttempts + 1,
        validationResults: [],
        validationIssues: []
      };
      runtime = syncValidationDiagnosticKnowledgeUnits(runtime);
    }

    if (!approvalGate) {
      runtime = {
        ...runtime,
        lastEditPlan: buildEditPlan(runtime)
      };
      runtime = {
        ...runtime,
        approvalSignals: collectApprovalSignals(runtime)
      };
    }

    const turn: QueryTurn = {
      index: turnIndex,
      decision,
      execution,
      runtimeSnapshot: cloneRuntimeState(runtime)
    };

    turns.push(turn);

    if (approvalGate || shouldStopLoop(turn)) {
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
