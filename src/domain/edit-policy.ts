import type { AgentRuntimeState } from '../types/agent.ts';
import type { EditPlan } from '../types/edit-plan.ts';
import type { EditPlanKind } from '../types/edit-plan.ts';
import type {
  RepoProfileId,
  ResolvedEditConstraintPolicy,
  WorkspaceInspection,
  WorkspaceAgentConfig
} from '../types/repository.ts';

function normalizePolicyPath(path: string): string {
  return path.replace(/^\.\/+/, '').replace(/\/+$/, '');
}

function getDefaultAllowedEditPlanKinds(profileId: RepoProfileId): EditPlanKind[] | null {
  switch (profileId) {
    case 'scrawlr-infra-apps':
      return [
        'helm-ingress',
        'helm-probes',
        'helm-service-port-repair',
        'helm-ingress-values-repair'
      ];
    case 'scrawlr-infra-cloud':
      return ['pulumi-stack-config'];
    case 'generic':
    default:
      return null;
  }
}

function getDefaultAllowedTargetPrefixes(
  profileId: RepoProfileId,
  inspection?: Pick<WorkspaceInspection, 'helmCharts' | 'pulumiProjects' | 'terraformRoots'>
): string[] | null {
  switch (profileId) {
    case 'scrawlr-infra-apps':
      return ['charts/apps', 'charts/infra'];
    case 'scrawlr-infra-cloud':
      return null;
    case 'generic':
      if (
        inspection
        && inspection.terraformRoots.length > 0
        && inspection.helmCharts.length === 0
        && inspection.pulumiProjects.length === 0
      ) {
        return inspection.terraformRoots.map(root => normalizePolicyPath(root.rootPath));
      }
      return null;
    default:
      return null;
  }
}

function getDefaultAllowedTargetPrefixesByKind(
  profileId: RepoProfileId
): Partial<Record<EditPlanKind, string[]>> {
  switch (profileId) {
    case 'scrawlr-infra-apps':
      return {
        'helm-ingress': ['charts/apps'],
        'helm-probes': ['charts/apps'],
        'helm-service-port-repair': ['charts/apps'],
        'helm-ingress-values-repair': ['charts/apps']
      };
    default:
      return {};
  }
}

function normalizeTargetPrefixesByKind(
  mapping: Partial<Record<EditPlanKind, string[]>> | undefined
): Partial<Record<EditPlanKind, string[]>> {
  if (!mapping) {
    return {};
  }

  const normalizedEntries = Object.entries(mapping)
    .filter(([, prefixes]) => Array.isArray(prefixes) && prefixes.length > 0)
    .map(([kind, prefixes]) => [kind, prefixes.map(normalizePolicyPath)]);

  return Object.fromEntries(normalizedEntries);
}

function getDefaultEditPolicySources(profileId: RepoProfileId): string[] {
  switch (profileId) {
    case 'scrawlr-infra-apps':
      return ['profile-default: scrawlr-infra-apps edit constraints'];
    case 'scrawlr-infra-cloud':
      return ['profile-default: scrawlr-infra-cloud edit constraints'];
    case 'generic':
    default:
      return ['default: no additional profile-specific edit constraints'];
  }
}

export function resolveEffectiveEditPolicy(
  config: WorkspaceAgentConfig | null,
  profileId: RepoProfileId = 'generic',
  inspection?: Pick<WorkspaceInspection, 'helmCharts' | 'pulumiProjects' | 'terraformRoots'>
): ResolvedEditConstraintPolicy {
  if (config?.editPolicy) {
    return {
      allowedEditPlanKinds: config.editPolicy.allowedEditPlanKinds ? [...config.editPolicy.allowedEditPlanKinds] : null,
      allowedTargetPrefixes: config.editPolicy.allowedTargetPrefixes
        ? config.editPolicy.allowedTargetPrefixes.map(normalizePolicyPath)
        : null,
      allowedTargetPrefixesByKind: normalizeTargetPrefixesByKind(config.editPolicy.allowedTargetPrefixesByKind),
      sources: ['workspace-config: editPolicy']
    };
  }

  if (
    profileId === 'generic'
    && inspection
    && inspection.terraformRoots.length > 0
    && inspection.helmCharts.length === 0
    && inspection.pulumiProjects.length === 0
  ) {
    return {
      allowedEditPlanKinds: [
        'terraform-missing-required-argument-repair',
        'terraform-tfvars-config'
      ],
      allowedTargetPrefixes: getDefaultAllowedTargetPrefixes(profileId, inspection),
      allowedTargetPrefixesByKind: {},
      sources: ['default: terraform-only generic workspace edit constraints']
    };
  }

  return {
    allowedEditPlanKinds: getDefaultAllowedEditPlanKinds(profileId),
    allowedTargetPrefixes: getDefaultAllowedTargetPrefixes(profileId, inspection),
    allowedTargetPrefixesByKind: getDefaultAllowedTargetPrefixesByKind(profileId),
    sources: getDefaultEditPolicySources(profileId)
  };
}

export function isEditPlanAllowedByPolicy(plan: EditPlan, runtime: AgentRuntimeState): boolean {
  const { effectiveEditPolicy } = runtime.preflight;

  if (
    effectiveEditPolicy.allowedEditPlanKinds &&
    !effectiveEditPolicy.allowedEditPlanKinds.includes(plan.kind)
  ) {
    return false;
  }

  if (!effectiveEditPolicy.allowedTargetPrefixes || effectiveEditPolicy.allowedTargetPrefixes.length === 0) {
    const kindPrefixes = effectiveEditPolicy.allowedTargetPrefixesByKind[plan.kind];
    if (!kindPrefixes || kindPrefixes.length === 0) {
      return true;
    }

    return plan.writes.every(write => {
      const normalizedPath = normalizePolicyPath(write.path);
      return kindPrefixes.some(prefix => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`));
    });
  }

  const allowedByGlobalPrefixes = plan.writes.every(write => {
    const normalizedPath = normalizePolicyPath(write.path);
    return effectiveEditPolicy.allowedTargetPrefixes?.some(
      prefix => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
    );
  });

  if (!allowedByGlobalPrefixes) {
    return false;
  }

  const kindPrefixes = effectiveEditPolicy.allowedTargetPrefixesByKind[plan.kind];
  if (!kindPrefixes || kindPrefixes.length === 0) {
    return true;
  }

  return plan.writes.every(write => {
    const normalizedPath = normalizePolicyPath(write.path);
    return kindPrefixes.some(prefix => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`));
  });
}
