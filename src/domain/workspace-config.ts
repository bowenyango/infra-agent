import { resolve, join } from 'node:path';
import { readTextFile } from '../tools/repository/repository-tools.ts';
import type { WorkspaceAgentConfig } from '../types/repository.ts';

export const WORKSPACE_CONFIG_FILE_NAME = 'infra-agent.config.json';

export async function readWorkspaceConfig(workspaceRoot: string): Promise<WorkspaceAgentConfig | null> {
  const configPath = resolve(join(workspaceRoot, WORKSPACE_CONFIG_FILE_NAME));

  try {
    const content = await readTextFile(configPath);
    return JSON.parse(content) as WorkspaceAgentConfig;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}
