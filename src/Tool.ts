import type { WorkspaceAgentConfig } from './types/repository.ts';

export type ToolSafety = 'read_only' | 'write_scoped' | 'validate' | 'approval_required';

export interface ToolUseContext {
  workspaceRoot: string;
  workspaceConfig: WorkspaceAgentConfig | null;
}

export interface ToolResult<TOutput> {
  toolName: string;
  safety: ToolSafety;
  output: TOutput;
}

export interface Tool<TInput, TOutput> {
  name: string;
  description: string;
  safety: ToolSafety;
  execute(input: TInput, context: ToolUseContext): Promise<ToolResult<TOutput>>;
}
