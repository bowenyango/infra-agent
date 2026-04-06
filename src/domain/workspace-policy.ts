import type { WorkspaceAgentConfig } from '../types/repository.ts';

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
