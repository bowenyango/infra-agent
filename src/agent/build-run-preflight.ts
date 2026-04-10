import {
  collectWorkspaceWarnings,
  inspectWorkspace,
  looksLikeInfraWorkspace
} from '../domain/inspect-workspace.ts';
import {
  getAllowedWriteModes,
  getAllowedWritePaths,
  isPathAllowedByWorkspacePolicy,
  normalizeApprovalScope,
  resolveEffectiveApprovalPolicy
} from '../domain/workspace-policy.ts';
import {
  buildTargetCandidates,
  buildTargetingWarnings
} from '../domain/task-targeting.ts';
import { resolveEffectiveEditPolicy } from '../domain/edit-policy.ts';
import { buildValidationPreflight } from '../validators/preflight.ts';
import type { RunApprovalScope } from '../types/repository.ts';
import type { RunPreflightState } from '../types/repository.ts';

function buildNextActions(state: {
  profileLabel: string;
  profileId: string;
  repoLooksValid: boolean;
  hasHelmCharts: boolean;
  hasPulumiProjects: boolean;
  hasTerraformRoots: boolean;
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
    nextActions.push('Inspect candidate charts, Pulumi projects, and Terraform roots to identify the correct edit target before changing files.');
  }

  if (state.hasHelmCharts) {
    nextActions.push('Read the target Helm chart files and infer repository-specific values and template conventions.');
  }

  if (state.hasPulumiProjects) {
    nextActions.push('Read the relevant Pulumi project and stack files before proposing infrastructure edits.');
  }

  if (state.hasTerraformRoots) {
    nextActions.push('Read the relevant Terraform root, tfvars files, and variable definitions before proposing infrastructure edits.');
  }

  if (state.hasMissingValidators) {
    nextActions.push('Install or expose missing validators before relying on validation-driven refinement.');
  } else {
    nextActions.push('Use Helm, Pulumi, and Terraform validators as the mandatory refinement loop after file changes.');
  }

  if (state.profileId === 'generic') {
    nextActions.push('Prefer repository config over generic heuristics when infra-agent.config.json is available.');
  }

  return nextActions;
}

export async function buildRunPreflight(
  task: string,
  workspacePath: string,
  approvalScope?: Partial<RunApprovalScope>
): Promise<RunPreflightState> {
  const inspection = await inspectWorkspace(workspacePath);
  const validation = buildValidationPreflight(inspection);
  const targeting = buildTargetCandidates(task, inspection);
  const normalizedApprovalScope = normalizeApprovalScope(approvalScope);
  const effectiveApprovalPolicy = resolveEffectiveApprovalPolicy(inspection.config, inspection.profile.id);
  const effectiveEditPolicy = resolveEffectiveEditPolicy(inspection.config, inspection.profile.id, inspection);
  const assumptions = buildTargetingWarnings({
    requestedEnvironment: targeting.requestedEnvironment,
    requestedService: targeting.requestedService,
    targetCandidates: targeting.targetCandidates
  });
  const blockers = collectWorkspaceWarnings(inspection);

  if (!looksLikeInfraWorkspace(inspection)) {
    blockers.unshift('Workspace does not look like a Pulumi, Terraform, or Helm repository.');
  }

  const allowedWritePaths = getAllowedWritePaths(inspection.config);
  const allowedWriteModes = getAllowedWriteModes(inspection.config);
  const topTargetPath = targeting.targetCandidates[0]?.path;
  if (allowedWritePaths && topTargetPath && !isPathAllowedByWorkspacePolicy(topTargetPath, inspection.config)) {
    blockers.unshift(`Workspace write policy does not allow edits under ${topTargetPath}. Allowed roots: ${allowedWritePaths.join(', ')}.`);
  }

  if (allowedWriteModes && allowedWriteModes.length > 0) {
    assumptions.push(`Workspace write policy restricts write modes to: ${allowedWriteModes.join(', ')}.`);
  }

  if (normalizedApprovalScope.approvedWriteRisks.length > 0) {
    assumptions.push(`Explicit approval granted for write risks: ${normalizedApprovalScope.approvedWriteRisks.join(', ')}.`);
  }

  if (normalizedApprovalScope.approvedWritePaths.length > 0) {
    assumptions.push(`Explicit approval granted for write paths: ${normalizedApprovalScope.approvedWritePaths.join(', ')}.`);
  }

  const shouldSurfaceEditPolicyAsAssumption = effectiveEditPolicy.sources.some(source => source.startsWith('workspace-config:'));

  if (shouldSurfaceEditPolicyAsAssumption && effectiveEditPolicy.allowedEditPlanKinds) {
    assumptions.push(`Workspace edit policy allows edit plans: ${effectiveEditPolicy.allowedEditPlanKinds.join(', ')}.`);
  }

  if (shouldSurfaceEditPolicyAsAssumption && effectiveEditPolicy.allowedTargetPrefixes && effectiveEditPolicy.allowedTargetPrefixes.length > 0) {
    assumptions.push(`Workspace edit policy constrains edit targets to: ${effectiveEditPolicy.allowedTargetPrefixes.join(', ')}.`);
  }

  const kindScopedEditTargets = Object.entries(effectiveEditPolicy.allowedTargetPrefixesByKind);
  if (shouldSurfaceEditPolicyAsAssumption && kindScopedEditTargets.length > 0) {
    assumptions.push(
      `Workspace edit policy applies kind-scoped target constraints: ${kindScopedEditTargets
        .map(([kind, prefixes]) => `${kind} -> ${prefixes.join(', ')}`)
        .join('; ')}.`
    );
  }

  const hasMissingValidators = validation.validators.some(validator => !validator.available);
  const nextActions = buildNextActions({
    profileLabel: inspection.profile.label,
    profileId: inspection.profile.id,
    repoLooksValid: looksLikeInfraWorkspace(inspection),
    hasHelmCharts: inspection.helmCharts.length > 0,
    hasPulumiProjects: inspection.pulumiProjects.length > 0,
    hasTerraformRoots: inspection.terraformRoots.length > 0,
    hasMissingValidators,
    hasAssumptions: assumptions.length > 0,
    hasStrongTargetMatch: (targeting.targetCandidates[0]?.score ?? 0) > 0
  });

  if (effectiveApprovalPolicy.requiredWriteRisks.length > 0) {
    nextActions.push(`Respect workspace approval policy for write risks: ${effectiveApprovalPolicy.requiredWriteRisks.join(', ')}.`);
  }

  return {
    task,
    workspaceRoot: inspection.workspaceRoot,
    profile: inspection.profile,
    approval: normalizedApprovalScope,
    effectiveApprovalPolicy,
    effectiveEditPolicy,
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
