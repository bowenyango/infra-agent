import type { Tool } from './Tool.ts';
import { AppendFileTool } from './tools/AppendFileTool/AppendFileTool.ts';
import { DiffPreviewTool } from './tools/DiffPreviewTool/DiffPreviewTool.ts';
import { ListDirectoryTool } from './tools/ListDirectoryTool/ListDirectoryTool.ts';
import { ReadFileTool } from './tools/ReadFileTool/ReadFileTool.ts';
import { ReplaceFileTool } from './tools/ReplaceFileTool/ReplaceFileTool.ts';
import { SearchWorkspaceTool } from './tools/SearchWorkspaceTool/SearchWorkspaceTool.ts';
import { TerraformFormatTool } from './tools/TerraformFormatTool/TerraformFormatTool.ts';
import { ValidateTargetsTool } from './tools/ValidateTargetsTool/ValidateTargetsTool.ts';
import { WriteFileTool } from './tools/WriteFileTool/WriteFileTool.ts';

export const toolRegistry = {
  [AppendFileTool.name]: AppendFileTool,
  [DiffPreviewTool.name]: DiffPreviewTool,
  [ListDirectoryTool.name]: ListDirectoryTool,
  [ReadFileTool.name]: ReadFileTool,
  [ReplaceFileTool.name]: ReplaceFileTool,
  [SearchWorkspaceTool.name]: SearchWorkspaceTool,
  [TerraformFormatTool.name]: TerraformFormatTool,
  [ValidateTargetsTool.name]: ValidateTargetsTool,
  [WriteFileTool.name]: WriteFileTool
} as const satisfies Record<string, Tool<unknown, unknown>>;

export type ToolName = keyof typeof toolRegistry;

export function getTools(): Tool<unknown, unknown>[] {
  return Object.values(toolRegistry);
}
