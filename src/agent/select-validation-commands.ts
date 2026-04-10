import type { AgentRuntimeState } from '../types/agent.ts';

function topTargetByKind(runtime: AgentRuntimeState): Record<'helm' | 'pulumi' | 'terraform', string | null> {
  return {
    helm: runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'helm-chart')?.path ?? null,
    pulumi: runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'pulumi-project')?.path ?? null,
    terraform: runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'terraform-root')?.path ?? null
  };
}

export function selectValidationCommands(runtime: AgentRuntimeState): string[] {
  const profileId = runtime.preflight.profile.id;
  const allowedDomains = new Set(
    runtime.preflight.requestedDomains.length > 0
      ? runtime.preflight.requestedDomains
      : runtime.preflight.targetCandidates[0]?.kind === 'helm-chart'
        ? ['helm']
        : runtime.preflight.targetCandidates[0]?.kind === 'pulumi-project'
          ? ['pulumi']
          : runtime.preflight.targetCandidates[0]?.kind === 'terraform-root'
            ? ['terraform']
            : []
  );
  const topTargets = topTargetByKind(runtime);

  const filtered = runtime.preflight.validation.plan.filter(entry => {
    if (profileId === 'scrawlr-infra-apps' && entry.kind !== 'helm') {
      return false;
    }

    if (profileId === 'scrawlr-infra-cloud' && entry.kind !== 'pulumi') {
      return false;
    }

    if (allowedDomains.size > 0 && !allowedDomains.has(entry.kind)) {
      return false;
    }

    if (entry.kind === 'helm') {
      return entry.target === topTargets.helm;
    }

    if (entry.kind === 'pulumi') {
      return entry.target === topTargets.pulumi;
    }

    if (entry.kind === 'terraform') {
      return entry.target === topTargets.terraform;
    }

    return false;
  });

  return filtered.flatMap(entry => entry.commands).slice(0, 6);
}
