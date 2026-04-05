import type { AgentRuntimeState } from '../types/agent.ts';

export function selectValidationCommands(runtime: AgentRuntimeState): string[] {
  const topHelmTarget = runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'helm-chart');
  const topPulumiTarget = runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'pulumi-project');
  const filtered = runtime.preflight.validation.plan.filter(entry => {
    if (entry.kind === 'helm') {
      return entry.target === topHelmTarget?.path;
    }

    if (entry.kind === 'pulumi') {
      return /\b(pulumi|stack)\b/i.test(runtime.task) && entry.target === topPulumiTarget?.path;
    }

    return false;
  });

  return filtered.flatMap(entry => entry.commands).slice(0, 6);
}

