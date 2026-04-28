import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import type { WorkspaceAgentConfig } from '../types/repository.ts';
import type { ResolvedKnowledgeCacheRoot } from '../types/knowledge.ts';

interface ResolveKnowledgeCacheRootInput {
  workspaceRoot: string;
  workspaceConfig: WorkspaceAgentConfig | null;
  env?: Record<string, string | undefined>;
  homeDir?: string;
}

function expandHomePrefix(path: string, homeDir: string): string {
  if (path === '~') {
    return homeDir;
  }

  if (path.startsWith('~/')) {
    return join(homeDir, path.slice(2));
  }

  return path;
}

function resolveWorkspaceRelativeCacheRoot(workspaceRoot: string, configuredRoot: string): string {
  const trimmedRoot = configuredRoot.trim();
  if (trimmedRoot.length === 0) {
    throw new Error('knowledgeCache.root in infra-agent.config.json must not be empty.');
  }

  if (isAbsolute(trimmedRoot)) {
    throw new Error('knowledgeCache.root in infra-agent.config.json must be workspace-relative.');
  }

  const resolvedWorkspaceRoot = resolve(workspaceRoot);
  const resolvedRoot = resolve(resolvedWorkspaceRoot, trimmedRoot);
  const relativeToWorkspace = relative(resolvedWorkspaceRoot, resolvedRoot);
  if (relativeToWorkspace === '' || (!relativeToWorkspace.startsWith('..') && !isAbsolute(relativeToWorkspace))) {
    return resolvedRoot;
  }

  throw new Error('knowledgeCache.root in infra-agent.config.json must stay inside the workspace.');
}

export function resolveKnowledgeCacheRoot(input: ResolveKnowledgeCacheRootInput): ResolvedKnowledgeCacheRoot {
  const env = input.env ?? process.env;
  const homeDir = input.homeDir ?? homedir();
  const envRoot = env.INFRA_AGENT_KNOWLEDGE_CACHE?.trim();

  if (envRoot) {
    return {
      root: resolve(expandHomePrefix(envRoot, homeDir)),
      source: 'environment: INFRA_AGENT_KNOWLEDGE_CACHE'
    };
  }

  const configuredRoot = input.workspaceConfig?.knowledgeCache?.root;
  if (configuredRoot !== undefined) {
    return {
      root: resolveWorkspaceRelativeCacheRoot(input.workspaceRoot, configuredRoot),
      source: 'workspace-config: knowledgeCache.root'
    };
  }

  const xdgCacheRoot = env.XDG_CACHE_HOME?.trim();
  const userCacheRoot = xdgCacheRoot
    ? resolve(expandHomePrefix(xdgCacheRoot, homeDir))
    : resolve(homeDir, '.cache');

  return {
    root: join(userCacheRoot, 'infra-agent', 'knowledge'),
    source: 'default: user cache'
  };
}
