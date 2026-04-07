import type { WorkspaceAgentConfig } from '../types/repository.ts';
import type { FileWritePlan } from '../types/edit-plan.ts';

function normalizePolicyPath(path: string): string {
  return path.replace(/^\.\/+/, '').replace(/\/+$/, '');
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
