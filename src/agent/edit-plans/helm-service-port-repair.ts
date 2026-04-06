import type { AgentRuntimeState } from '../../types/agent.ts';
import type { EditPlan } from '../../types/edit-plan.ts';
import { getLatestFileContent } from './runtime-file-content.ts';

function needsServicePortRepair(runtime: AgentRuntimeState): boolean {
  return runtime.validationIssues.some(issue => issue.kind === 'helm-missing-service-port');
}

function appendServiceBlock(valuesContent: string): string {
  return `${valuesContent.trimEnd()}\n\nservice:\n  port: 8080\n`;
}

export function buildHelmServicePortRepairEditPlan(runtime: AgentRuntimeState): EditPlan | null {
  if (!needsServicePortRepair(runtime)) {
    return null;
  }

  const topHelmTarget = runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'helm-chart');
  if (!topHelmTarget) {
    return null;
  }

  const valuesPath = `${topHelmTarget.path}/values.yaml`;
  const valuesContent = getLatestFileContent(runtime, valuesPath);
  if (!valuesContent || /\nservice:\n[\s\S]*\n  port:\s*/m.test(valuesContent)) {
    return null;
  }

  return {
    kind: 'helm-service-port-repair',
    summary: `Repair missing service.port configuration in ${valuesPath}.`,
    rationale: 'Validation failed on a service.port reference and the selected chart values file does not currently define service.port.',
    writes: [
      {
        path: valuesPath,
        content: appendServiceBlock(valuesContent),
        reason: 'Add a bounded default service.port to satisfy existing template references during validation.'
      }
    ]
  };
}
