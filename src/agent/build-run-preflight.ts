import {
  collectWorkspaceWarnings,
  inspectWorkspace,
  looksLikeInfraWorkspace
} from '../domain/inspect-workspace.ts';
import { getAllowedWritePaths, isPathAllowedByWorkspacePolicy } from '../domain/workspace-policy.ts';
import {
  buildTargetCandidates,
  buildTargetingWarnings
} from '../domain/task-targeting.ts';
import { buildValidationPreflight } from '../validators/preflight.ts';
import type { RunPreflightState } from '../types/repository.ts';

function buildNextActions(state: {
  profileLabel: string;
  profileId: string;
  repoLooksValid: boolean;
  hasHelmCharts: boolean;
  hasPulumiProjects: boolean;
  hasMissingValidators: boolean;
  hasAssumptions: boolean;
  hasStrongTargetMatch: boolean;
}): string[] {
  const nextActions: string[] = [];

  if (!state.repoLooksValid) {
    nextActions.push('Inspect repository layout and confirm the intended workspace before any edit step.');
    return nextActions;
  }

  if (state.profileId !== 'generic') {
    nextActions.push(`Apply ${state.profileLabel} repository conventions before generating edits.`);
  }

  if (state.hasAssumptions) {
    nextActions.push('Clarify the target environment and the intended service or chart before writing files.');
  }

  if (!state.hasStrongTargetMatch) {
    nextActions.push('Inspect candidate charts and Pulumi projects to identify the correct edit target before changing files.');
  }

  if (state.hasHelmCharts) {
    nextActions.push('Read the target Helm chart files and infer repository-specific values and template conventions.');
  }

  if (state.hasPulumiProjects) {
    nextActions.push('Read the relevant Pulumi project and stack files before proposing infrastructure edits.');
  }

  if (state.hasMissingValidators) {
    nextActions.push('Install or expose missing validators before relying on validation-driven refinement.');
  } else {
    nextActions.push('Use helm and pulumi validators as the mandatory refinement loop after file changes.');
  }

  if (state.profileId === 'generic') {
    nextActions.push('Prefer repository config over generic heuristics when infra-agent.config.json is available.');
  }

  return nextActions;
}

export async function buildRunPreflight(task: string, workspacePath: string): Promise<RunPreflightState> {
  const inspection = await inspectWorkspace(workspacePath);
  const validation = buildValidationPreflight(inspection);
  const targeting = buildTargetCandidates(task, inspection);
  const assumptions = buildTargetingWarnings({
    requestedEnvironment: targeting.requestedEnvironment,
    requestedService: targeting.requestedService,
    targetCandidates: targeting.targetCandidates
  });
  const blockers = collectWorkspaceWarnings(inspection);

  if (!looksLikeInfraWorkspace(inspection)) {
    blockers.unshift('Workspace does not look like a Pulumi or Helm repository.');
  }

  const allowedWritePaths = getAllowedWritePaths(inspection.config);
  const topTargetPath = targeting.targetCandidates[0]?.path;
  if (allowedWritePaths && topTargetPath && !isPathAllowedByWorkspacePolicy(topTargetPath, inspection.config)) {
    blockers.unshift(`Workspace write policy does not allow edits under ${topTargetPath}. Allowed roots: ${allowedWritePaths.join(', ')}.`);
  }

  const hasMissingValidators = validation.validators.some(validator => !validator.available);
  const nextActions = buildNextActions({
    profileLabel: inspection.profile.label,
    profileId: inspection.profile.id,
    repoLooksValid: looksLikeInfraWorkspace(inspection),
    hasHelmCharts: inspection.helmCharts.length > 0,
    hasPulumiProjects: inspection.pulumiProjects.length > 0,
    hasMissingValidators,
    hasAssumptions: assumptions.length > 0,
    hasStrongTargetMatch: (targeting.targetCandidates[0]?.score ?? 0) > 0
  });

  return {
    task,
    workspaceRoot: inspection.workspaceRoot,
    profile: inspection.profile,
    inspection,
    validation,
    requestedEnvironment: targeting.requestedEnvironment,
    requestedService: targeting.requestedService,
    targetCandidates: targeting.targetCandidates,
    assumptions,
    blockers,
    nextActions
  };
}
