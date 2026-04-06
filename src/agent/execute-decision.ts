import { dirname, join } from 'node:path';
import { isPathAllowedByWorkspacePolicy } from '../domain/workspace-policy.ts';
import { executeTool } from '../services/tools/execute-tool.ts';
import { ListDirectoryTool } from '../tools/ListDirectoryTool/ListDirectoryTool.ts';
import { ReadFileTool } from '../tools/ReadFileTool/ReadFileTool.ts';
import { ValidateTargetsTool } from '../tools/ValidateTargetsTool/ValidateTargetsTool.ts';
import { WriteFileTool } from '../tools/WriteFileTool/WriteFileTool.ts';
import type { AgentDecision, AgentDecisionExecution } from '../types/agent.ts';
import type { ToolUseContext } from '../Tool.ts';
import type { DirectoryListingOutput } from '../types/tools.ts';

function deduplicatePaths(paths: string[]): string[] {
  return Array.from(new Set(paths));
}

function buildContext(workspaceRoot: string, workspaceConfig: ToolUseContext['workspaceConfig']): ToolUseContext {
  return { workspaceRoot, workspaceConfig };
}

export async function executeDecision(
  decision: AgentDecision,
  workspaceRoot: string,
  workspaceConfig: ToolUseContext['workspaceConfig'] = null
): Promise<AgentDecisionExecution | null> {
  const context = buildContext(workspaceRoot, workspaceConfig);

  if (decision.action.kind === 'inspect-target-files') {
    const targetPaths = deduplicatePaths(decision.action.payload?.targetPaths ?? []);
    const toolResults = [];

    for (const targetPath of targetPaths) {
      const directoryListing = await executeTool(ListDirectoryTool, { path: targetPath }, context);
      toolResults.push(directoryListing);

      const dirName = targetPath === '.' ? '.' : targetPath;
      const listedFiles = (directoryListing.output as DirectoryListingOutput).entries
        .filter(entry => entry.kind === 'file')
        .map(entry => entry.name);
      const candidateFiles = [
        join(dirName, 'Chart.yaml'),
        join(dirName, 'values.yaml'),
        join(dirName, 'templates/deployment.yaml'),
        join(dirName, 'templates/ingress.yaml')
      ];
      for (const listedFile of listedFiles) {
        if (/^Pulumi(\..+)?\.(yaml|yml)$/i.test(listedFile)) {
          candidateFiles.push(join(dirName, listedFile));
        }
      }

      for (const candidateFile of deduplicatePaths(candidateFiles)) {
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

  if (decision.action.kind === 'apply-edit-plan') {
    const writes = decision.action.payload?.writes ?? [];
    if (writes.length === 0) {
      return {
        status: 'skipped',
        executedTools: [],
        reason: 'No file writes were present in the edit plan.'
      };
    }

    const allowedWrites = writes.filter(write => isPathAllowedByWorkspacePolicy(write.path, workspaceConfig));
    if (allowedWrites.length === 0) {
      return {
        status: 'skipped',
        executedTools: [],
        reason: 'Workspace write policy blocked all planned file writes.'
      };
    }

    const toolResults = [];
    for (const write of allowedWrites) {
      toolResults.push(await executeTool(WriteFileTool, {
        path: write.path,
        content: write.content
      }, context));
    }

    return {
      status: 'completed',
      executedTools: toolResults
    };
  }

  return null;
}
