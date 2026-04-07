import type { ApprovalSignal, AgentRuntimeState } from '../types/agent.ts';
import type { FileWritePlan } from '../types/edit-plan.ts';
import { isApprovalRequiredForWrite } from '../domain/workspace-policy.ts';

function toApprovalSignal(write: FileWritePlan, runtime: AgentRuntimeState): ApprovalSignal | null {
  if (!isApprovalRequiredForWrite(write, runtime.preflight.inspection.config)) {
    return null;
  }

  return {
    kind: 'write-approval-required',
    path: write.path,
    risk: write.risk,
    message: `The planned ${write.mode ?? 'rewrite'} change at ${write.path} has risk=${write.risk}. Approval is required before applying this edit.`
  };
}

export function collectApprovalSignals(runtime: AgentRuntimeState): ApprovalSignal[] {
  if (!runtime.lastEditPlan) {
    return [];
  }

  return runtime.lastEditPlan.writes
    .map(write => toApprovalSignal(write, runtime))
    .filter((signal): signal is ApprovalSignal => signal !== null);
}
