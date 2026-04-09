import type { AgentRuntimeState } from '../types/agent.ts';

export function selectValidationCommands(runtime: AgentRuntimeState): string[] {
  const profileId = runtime.preflight.profile.id;
  const topHelmTarget = runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'helm-chart');
  const topPulumiTarget = runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'pulumi-project');
  const topTerraformTarget = runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'terraform-root');
  const filtered = runtime.preflight.validation.plan.filter(entry => {
    if (profileId === 'scrawlr-infra-apps' && entry.kind !== 'helm') {
      return false;
    }

    if (profileId === 'scrawlr-infra-cloud' && entry.kind !== 'pulumi') {
      return false;
    }

    if (entry.kind === 'helm') {
      return entry.target === topHelmTarget?.path;
    }

    if (entry.kind === 'pulumi') {
      return /\b(pulumi|stack)\b/i.test(runtime.task) && entry.target === topPulumiTarget?.path;
    }

    if (entry.kind === 'terraform') {
      return /\b(terraform|tfvars|module|variable|variables)\b/i.test(runtime.task) && entry.target === topTerraformTarget?.path;
    }

    return false;
  });

  return filtered.flatMap(entry => entry.commands).slice(0, 6);
}
