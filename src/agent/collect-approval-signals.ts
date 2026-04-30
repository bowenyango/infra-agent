import type { ApprovalSignal, AgentRuntimeState } from '../types/agent.ts';
import type { FileWritePlan } from '../types/edit-plan.ts';
import type { ToolPermissionCategory } from './tool-permissions.ts';
import {
  isApprovalRequiredForToolCategory,
  isApprovalRequiredForWrite,
  isToolCategoryCoveredByApproval,
  isWriteCoveredByApproval
} from '../domain/workspace-policy.ts';

function toApprovalSignal(write: FileWritePlan, runtime: AgentRuntimeState): ApprovalSignal | null {
  if (!isApprovalRequiredForWrite(write, runtime.preflight.inspection.config, runtime.preflight.profile.id)) {
    return null;
  }

  if (isWriteCoveredByApproval(write, runtime.preflight.approval)) {
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

  const writeSignals = runtime.lastEditPlan.writes
    .map(write => toApprovalSignal(write, runtime))
    .filter((signal): signal is ApprovalSignal => signal !== null);
  const toolCategorySignals = collectToolCategoryApprovalSignals(runtime);

  return [...writeSignals, ...toolCategorySignals];
}

function collectToolCategoryApprovalSignals(runtime: AgentRuntimeState): ApprovalSignal[] {
  const categories = new Set<ToolPermissionCategory>();
  if ((runtime.lastEditPlan?.pulumiConfigOperations ?? []).length > 0) {
    categories.add('native-stack-config-write');
  }

  return [...categories].flatMap(category => {
    if (!isApprovalRequiredForToolCategory(category, runtime.preflight.inspection.config, runtime.preflight.profile.id)) {
      return [];
    }

    if (isToolCategoryCoveredByApproval(category, runtime.preflight.approval)) {
      return [];
    }

    return [{
      kind: 'tool-category-approval-required',
      toolCategory: category,
      message: `The planned edit uses ${category}, which is marked approval-required by workspace policy. Approval is required before executing this native operation.`
    } satisfies ApprovalSignal];
  });
}
