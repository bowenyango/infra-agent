import type { Tool } from './Tool.ts';
import { ListDirectoryTool } from './tools/ListDirectoryTool/ListDirectoryTool.ts';
import { ReadFileTool } from './tools/ReadFileTool/ReadFileTool.ts';
import { ValidateTargetsTool } from './tools/ValidateTargetsTool/ValidateTargetsTool.ts';
import { WriteFileTool } from './tools/WriteFileTool/WriteFileTool.ts';

export const toolRegistry = {
  [ListDirectoryTool.name]: ListDirectoryTool,
  [ReadFileTool.name]: ReadFileTool,
  [ValidateTargetsTool.name]: ValidateTargetsTool,
  [WriteFileTool.name]: WriteFileTool
} as const satisfies Record<string, Tool<unknown, unknown>>;

export type ToolName = keyof typeof toolRegistry;

export function getTools(): Tool<unknown, unknown>[] {
  return Object.values(toolRegistry);
}
