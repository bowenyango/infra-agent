import type { ApprovalSignal, AgentRuntimeState } from '../types/agent.ts';
import type { FileWritePlan } from '../types/edit-plan.ts';

function toApprovalSignal(write: FileWritePlan): ApprovalSignal | null {
  if (write.mode !== 'rewrite' || write.risk !== 'high') {
    return null;
  }

  return {
    kind: 'high-risk-rewrite',
    path: write.path,
    risk: write.risk,
    message: `The planned change rewrites the full file at ${write.path}. Approval is recommended before applying this edit.`
  };
}

export function collectApprovalSignals(runtime: AgentRuntimeState): ApprovalSignal[] {
  if (!runtime.lastEditPlan) {
    return [];
  }

  return runtime.lastEditPlan.writes
    .map(toApprovalSignal)
    .filter((signal): signal is ApprovalSignal => signal !== null);
}
