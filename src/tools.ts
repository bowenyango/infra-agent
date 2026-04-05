import type { Tool } from './Tool.ts';
import { ListDirectoryTool } from './tools/ListDirectoryTool/ListDirectoryTool.ts';
import { ReadFileTool } from './tools/ReadFileTool/ReadFileTool.ts';
import { ValidateTargetsTool } from './tools/ValidateTargetsTool/ValidateTargetsTool.ts';

export const toolRegistry = {
  [ListDirectoryTool.name]: ListDirectoryTool,
  [ReadFileTool.name]: ReadFileTool,
  [ValidateTargetsTool.name]: ValidateTargetsTool
} as const satisfies Record<string, Tool<unknown, unknown>>;

export type ToolName = keyof typeof toolRegistry;

export function getTools(): Tool<unknown, unknown>[] {
  return Object.values(toolRegistry);
}

