import type { InfraDomainId, RunPreflightState } from './repository.ts';
import type { ToolResult, ToolSafety } from '../Tool.ts';
import type { ValidationCommandOutput } from './tools.ts';
import type { ConfigSemanticsSummary } from './config-semantics.ts';
import type { RetrievedContextPacket } from './knowledge.ts';
export type AgentActionKind =
  | 'ask-for-clarification'
  | 'inspect-target-files'
  | 'apply-edit-plan'
  | 'repair-terraform-formatting'
  | 'validate-targets'
  | 'stop';
export type AgentClarificationKind =
  | 'approval-required'
  | 'target-ambiguity'
  | 'workspace-policy'
  | 'general';
export type AgentActionFamily =
  | 'runtime-clarification'
  | 'approval-clarification'
  | 'helm-clarification'
  | 'pulumi-clarification'
  | 'terraform-clarification'
  | 'helm-inspection'
  | 'pulumi-inspection'
  | 'terraform-inspection'
  | 'runtime-inspection'
  | 'helm-bounded-edit'
  | 'pulumi-bounded-edit'
  | 'terraform-bounded-edit'
  | 'helm-validation'
  | 'pulumi-validation'
  | 'terraform-validation'
  | 'terraform-repair'
  | 'validation-complete'
  | 'validation-blocked'
  | 'repair-budget-exhausted'
  | 'runtime-stop';
export type AgentStopReason =
  | 'validation-succeeded'
  | 'validation-blocked'
  | 'repair-budget-exhausted'
  | 'no-safe-action';
export type AgentRunOutcome =
  | 'completed'
  | 'approval-required'
  | 'clarification-required'
  | 'validation-blocked'
  | 'repair-budget-exhausted'
  | 'no-safe-action';
import type { EditPlan, FileWritePlan } from './edit-plan.ts';
import type { FileWriteRisk } from './edit-plan.ts';

export interface AgentAction {
  kind: AgentActionKind;
  summary: string;
  rationale: string;
  payload?: {
    targetPaths?: string[];
    requestedDomains?: InfraDomainId[];
    rootPath?: string;
    questions?: string[];
    commands?: string[];
    writes?: FileWritePlan[];
    editPlan?: EditPlan;
    clarificationKind?: AgentClarificationKind;
    actionFamily?: AgentActionFamily;
    stopReason?: AgentStopReason;
  };
}

export interface AgentDecision {
  action: AgentAction;
  confidence: 'low' | 'medium' | 'high';
}

export interface AgentDecisionExecution {
  status: 'completed' | 'skipped';
  executedTools: ToolResult<unknown>[];
  reason?: string;
}

export interface ToolExecutionSummary {
  turnIndex: number;
  actionKind: AgentActionKind;
  toolName: string;
  safety: ToolSafety;
  summary: string;
}

export type ValidationIssueKind =
  | 'helm-missing-service-port'
  | 'helm-missing-ingress-values'
  | 'pulumi-create-before-delete-conflict'
  | 'pulumi-missing-config'
  | 'pulumi-preview-failure'
  | 'terraform-create-before-delete-conflict'
  | 'terraform-formatting-required'
  | 'terraform-validate-failure'
  | 'yaml-syntax-failure'
  | 'unknown-validation-failure';

export interface ValidationIssue {
  kind: ValidationIssueKind;
  repairable: boolean;
  sourceCommand: string;
  message: string;
  guidance?: string;
  metadata?: {
    conflictCode?: string;
    conflictFamily?: string;
    conflictLabel?: string;
    conflictSuggestedAction?: string;
    duplicateIdentity?: string;
    dnsNames?: string;
    kubernetesNames?: string;
    kubernetesNamespaces?: string;
    listenerArns?: string;
    listenerRulePriorities?: string;
    missingConfigKey?: string;
    missingVariableName?: string;
    providerName?: string;
    recordTypes?: string;
    resourceAddress?: string;
    resourceName?: string;
    resourceType?: string;
    oidcProviderUrls?: string;
    routeDestinations?: string;
    routeTableIds?: string;
    securityGroupIds?: string;
    securityGroupRulePeers?: string;
    yamlPath?: string;
    yamlParser?: string;
  };
}

export interface ApprovalSignal {
  kind: 'write-approval-required';
  path: string;
  risk: FileWriteRisk;
  message: string;
}

export interface AgentPlanningInput {
  runtime: AgentRuntimeState;
}

export interface PlanningModel {
  readonly name: string;
  decideNextAction(input: AgentPlanningInput): Promise<AgentDecision>;
}

export interface AgentRuntimeState {
  task: string;
  preflight: RunPreflightState;
  configSemantics?: ConfigSemanticsSummary[];
  retrievedContext: RetrievedContextPacket[];
  observations: ToolResult<unknown>[];
  toolSummaries: ToolExecutionSummary[];
  appliedWrites: FileWritePlan[];
  validationResults: ValidationCommandOutput[];
  validationIssues: ValidationIssue[];
  approvalSignals: ApprovalSignal[];
  repairAttempts: number;
  lastEditPlan: EditPlan | null;
}
