import { dirname, join } from 'node:path';
import { executeTool } from '../services/tools/execute-tool.ts';
import { ListDirectoryTool } from '../tools/ListDirectoryTool/ListDirectoryTool.ts';
import { ReadFileTool } from '../tools/ReadFileTool/ReadFileTool.ts';
import { ValidateTargetsTool } from '../tools/ValidateTargetsTool/ValidateTargetsTool.ts';
import type { AgentDecision, AgentDecisionExecution } from '../types/agent.ts';
import type { ToolUseContext } from '../Tool.ts';

function deduplicatePaths(paths: string[]): string[] {
  return Array.from(new Set(paths));
}

function buildContext(workspaceRoot: string): ToolUseContext {
  return { workspaceRoot };
}

export async function executeDecision(
  decision: AgentDecision,
  workspaceRoot: string
): Promise<AgentDecisionExecution | null> {
  const context = buildContext(workspaceRoot);

  if (decision.action.kind === 'inspect-target-files') {
    const targetPaths = deduplicatePaths(decision.action.payload?.targetPaths ?? []);
    const toolResults = [];

    for (const targetPath of targetPaths) {
      toolResults.push(await executeTool(ListDirectoryTool, { path: targetPath }, context));

      const dirName = targetPath === '.' ? '.' : targetPath;
      const candidateFiles = [
        join(dirName, 'Chart.yaml'),
        join(dirName, 'values.yaml'),
        join(dirName, 'Pulumi.yaml')
      ];

      for (const candidateFile of candidateFiles) {
        try {
          toolResults.push(await executeTool(ReadFileTool, { path: candidateFile }, context));
        } catch {
          // Missing files are expected across mixed Helm/Pulumi targets.
        }
      }

      const parentDir = dirname(targetPath);
      if (parentDir !== targetPath && parentDir !== '.') {
        try {
          toolResults.push(await executeTool(ListDirectoryTool, { path: parentDir }, context));
        } catch {
          // Parent directory inspection is opportunistic.
        }
      }
    }

    return {
      status: 'completed',
      executedTools: toolResults
    };
  }

  if (decision.action.kind === 'validate-targets') {
    const commands = decision.action.payload?.commands ?? [];
    if (commands.length === 0) {
      return {
        status: 'skipped',
        executedTools: [],
        reason: 'No validation commands were present in the decision payload.'
      };
    }

    const result = await executeTool(ValidateTargetsTool, { commands }, context);
    return {
      status: 'completed',
      executedTools: [result]
    };
  }

  return null;
}

