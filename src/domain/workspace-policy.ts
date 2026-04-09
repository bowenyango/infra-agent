import type {
  ResolvedApprovalPolicy,
  RunApprovalScope,
  RepoProfileId,
  WorkspaceAgentConfig,
  WorkspaceApprovalPathRule
} from '../types/repository.ts';
import type { FileWritePlan } from '../types/edit-plan.ts';
import type { FileWriteRisk } from '../types/edit-plan.ts';

function normalizePolicyPath(path: string): string {
  return path.replace(/^\.\/+/, '').replace(/\/+$/, '');
}

function getDefaultApprovalPathRules(profileId: RepoProfileId): WorkspaceApprovalPathRule[] {
  switch (profileId) {
    case 'scrawlr-infra-apps':
      return [
        {
          path: 'charts/apps/app-template',
          requiredWriteRisks: ['medium', 'high']
        },
        {
          path: 'charts/infra',
          requiredWriteRisks: ['medium', 'high']
        }
      ];
    default:
      return [];
  }
}

function getDefaultApprovalRequiredWriteRisks(profileId: RepoProfileId): FileWriteRisk[] {
  switch (profileId) {
    case 'scrawlr-infra-cloud':
      return ['medium', 'high'];
    case 'generic':
    case 'scrawlr-infra-apps':
    default:
      return ['high'];
  }
}

function getDefaultApprovalPolicySources(profileId: RepoProfileId): string[] {
  switch (profileId) {
    case 'scrawlr-infra-apps':
      return ['profile-default: scrawlr-infra-apps write approvals'];
    case 'scrawlr-infra-cloud':
      return ['profile-default: scrawlr-infra-cloud write approvals'];
    case 'generic':
    default:
      return ['default: high-risk writes require approval'];
  }
}

export function getAllowedWritePaths(config: WorkspaceAgentConfig | null): string[] | null {
  const allowedPaths = config?.writePolicy?.allowedPaths;
  if (!allowedPaths || allowedPaths.length === 0) {
    return null;
  }

  return allowedPaths.map(normalizePolicyPath);
}

export function isPathAllowedByWorkspacePolicy(path: string, config: WorkspaceAgentConfig | null): boolean {
  const allowedPaths = getAllowedWritePaths(config);
  if (!allowedPaths) {
    return true;
  }

  const normalizedPath = normalizePolicyPath(path);
  return allowedPaths.some(allowedPath => normalizedPath === allowedPath || normalizedPath.startsWith(`${allowedPath}/`));
}

export function getAllowedWriteModes(config: WorkspaceAgentConfig | null): FileWritePlan['mode'][] | null {
  const allowedModes = config?.writePolicy?.allowedModes;
  if (!allowedModes || allowedModes.length === 0) {
    return null;
  }

  return [...allowedModes];
}

export function isModeAllowedByWorkspacePolicy(mode: FileWritePlan['mode'], config: WorkspaceAgentConfig | null): boolean {
  const allowedModes = getAllowedWriteModes(config);
  if (!allowedModes || !mode) {
    return true;
  }

  return allowedModes.includes(mode);
}

export function isWriteAllowedByWorkspacePolicy(write: FileWritePlan, config: WorkspaceAgentConfig | null): boolean {
  return isPathAllowedByWorkspacePolicy(write.path, config) && isModeAllowedByWorkspacePolicy(write.mode, config);
}

export function getApprovalRequiredWriteRisks(
  config: WorkspaceAgentConfig | null,
  profileId: RepoProfileId = 'generic'
): FileWriteRisk[] {
  const configuredRisks = config?.approvalPolicy?.requiredWriteRisks;
  if (configuredRisks === undefined) {
    return getDefaultApprovalRequiredWriteRisks(profileId);
  }

  return [...configuredRisks];
}

export function getApprovalPathRules(
  config: WorkspaceAgentConfig | null,
  profileId: RepoProfileId = 'generic'
): WorkspaceApprovalPathRule[] {
  const pathRules = config?.approvalPolicy?.pathRules;
  if (!pathRules || pathRules.length === 0) {
    return getDefaultApprovalPathRules(profileId);
  }

  return pathRules
    .filter(rule => typeof rule.path === 'string' && rule.path.trim().length > 0)
    .map(rule => ({
      path: normalizePolicyPath(rule.path),
      requiredWriteRisks: [...rule.requiredWriteRisks]
    }));
}

export function resolveEffectiveApprovalPolicy(
  config: WorkspaceAgentConfig | null,
  profileId: RepoProfileId = 'generic'
): ResolvedApprovalPolicy {
  const requiredWriteRisks = getApprovalRequiredWriteRisks(config, profileId);
  const pathRules = getApprovalPathRules(config, profileId);
  const sources =
    config?.approvalPolicy === undefined
      ? getDefaultApprovalPolicySources(profileId)
      : ['workspace-config: approvalPolicy'];

  return {
    requiredWriteRisks,
    pathRules,
    sources
  };
}

function getApprovalRequiredWriteRisksForPath(
  path: string,
  config: WorkspaceAgentConfig | null,
  profileId: RepoProfileId = 'generic'
): FileWriteRisk[] {
  const requiredRisks = new Set<FileWriteRisk>(getApprovalRequiredWriteRisks(config, profileId));
  const normalizedPath = normalizePolicyPath(path);

  for (const rule of getApprovalPathRules(config, profileId)) {
    const ruleMatches = normalizedPath === rule.path || normalizedPath.startsWith(`${rule.path}/`);
    if (!ruleMatches) {
      continue;
    }

    for (const risk of rule.requiredWriteRisks) {
      requiredRisks.add(risk);
    }
  }

  return [...requiredRisks];
}

export function isApprovalRequiredForWrite(
  write: FileWritePlan,
  config: WorkspaceAgentConfig | null,
  profileId: RepoProfileId = 'generic'
): boolean {
  if (!write.risk) {
    return false;
  }

  return getApprovalRequiredWriteRisksForPath(write.path, config, profileId).includes(write.risk);
}

export function normalizeApprovalScope(scope: Partial<RunApprovalScope> | null | undefined): RunApprovalScope {
  return {
    approvedWritePaths: (scope?.approvedWritePaths ?? []).map(normalizePolicyPath),
    approvedWriteRisks: [...(scope?.approvedWriteRisks ?? [])]
  };
}

function isPathCoveredByApproval(path: string, approval: RunApprovalScope): boolean {
  if (approval.approvedWritePaths.length === 0) {
    return true;
  }

  const normalizedPath = normalizePolicyPath(path);
  return approval.approvedWritePaths.some(
    approvedPath => normalizedPath === approvedPath || normalizedPath.startsWith(`${approvedPath}/`)
  );
}

export function isWriteCoveredByApproval(write: FileWritePlan, approval: RunApprovalScope): boolean {
  if (!write.risk || approval.approvedWriteRisks.length === 0) {
    return false;
  }

  if (!approval.approvedWriteRisks.includes(write.risk)) {
    return false;
  }

  return isPathCoveredByApproval(write.path, approval);
}
