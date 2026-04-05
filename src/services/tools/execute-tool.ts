import type { Tool, ToolResult, ToolUseContext } from '../../Tool.ts';

export async function executeTool<TInput, TOutput>(
  tool: Tool<TInput, TOutput>,
  input: TInput,
  context: ToolUseContext
): Promise<ToolResult<TOutput>> {
  return tool.execute(input, context);
}

