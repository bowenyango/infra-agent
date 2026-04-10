import type { InfraDomainId, RunPreflightState } from './repository.ts';
import type { ToolResult } from '../Tool.ts';
import type { ValidationCommandOutput } from './tools.ts';
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

export type ValidationIssueKind =
  | 'helm-missing-service-port'
  | 'helm-missing-ingress-values'
  | 'terraform-formatting-required'
  | 'terraform-validate-failure'
  | 'unknown-validation-failure';

export interface ValidationIssue {
  kind: ValidationIssueKind;
  repairable: boolean;
  sourceCommand: string;
  message: string;
  guidance?: string;
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
  observations: ToolResult<unknown>[];
  appliedWrites: FileWritePlan[];
  validationResults: ValidationCommandOutput[];
  validationIssues: ValidationIssue[];
  approvalSignals: ApprovalSignal[];
  repairAttempts: number;
  lastEditPlan: EditPlan | null;
}
