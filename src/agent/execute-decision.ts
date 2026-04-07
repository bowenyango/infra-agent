import { dirname, join } from 'node:path';
import { isWriteAllowedByWorkspacePolicy } from '../domain/workspace-policy.ts';
import { executeTool } from '../services/tools/execute-tool.ts';
import { AppendFileTool } from '../tools/AppendFileTool/AppendFileTool.ts';
import { DiffPreviewTool } from '../tools/DiffPreviewTool/DiffPreviewTool.ts';
import { ListDirectoryTool } from '../tools/ListDirectoryTool/ListDirectoryTool.ts';
import { ReadFileTool } from '../tools/ReadFileTool/ReadFileTool.ts';
import { ReplaceFileTool } from '../tools/ReplaceFileTool/ReplaceFileTool.ts';
import { SearchWorkspaceTool } from '../tools/SearchWorkspaceTool/SearchWorkspaceTool.ts';
import { ValidateTargetsTool } from '../tools/ValidateTargetsTool/ValidateTargetsTool.ts';
import { WriteFileTool } from '../tools/WriteFileTool/WriteFileTool.ts';
import type { AgentDecision, AgentDecisionExecution } from '../types/agent.ts';
import type { ToolUseContext } from '../Tool.ts';
import type { DiffPreviewOutput, DirectoryListingOutput, SearchWorkspaceOutput } from '../types/tools.ts';

function deduplicatePaths(paths: string[]): string[] {
  return Array.from(new Set(paths));
}

function buildContext(workspaceRoot: string, workspaceConfig: ToolUseContext['workspaceConfig']): ToolUseContext {
  return { workspaceRoot, workspaceConfig };
}

function getAppendDelta(nextContent: string, previousExists: boolean, previousContent: string | undefined): string {
  if (!previousExists || !previousContent) {
    return nextContent;
  }

  if (nextContent.startsWith(previousContent)) {
    return nextContent.slice(previousContent.length);
  }

  return nextContent;
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

      const workspaceSearch = await executeTool(SearchWorkspaceTool, {
        rootPath: targetPath,
        fileNamePattern: '^(Chart\\.ya?ml|values\\.ya?ml|Pulumi(\\..+)?\\.(yaml|yml)|deployment\\.ya?ml|ingress\\.ya?ml)$',
        maxResults: 12
      }, context);
      toolResults.push(workspaceSearch);

      for (const match of (workspaceSearch.output as SearchWorkspaceOutput).matches) {
        try {
          toolResults.push(await executeTool(ReadFileTool, { path: match.path }, context));
        } catch {
          // Search matches may refer to files already removed or unreadable in test fixtures.
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

    const allowedWrites = writes.filter(write => isWriteAllowedByWorkspacePolicy(write, workspaceConfig));
    if (allowedWrites.length === 0) {
      return {
        status: 'skipped',
        executedTools: [],
        reason: 'Workspace write policy blocked all planned file writes by path or write mode.'
      };
    }

    const toolResults = [];
    for (const write of allowedWrites) {
      const diffResult = await executeTool(DiffPreviewTool, {
        path: write.path,
        nextContent: write.content
      }, context);
      toolResults.push(diffResult);

      if (write.mode === 'append') {
        const diffOutput = diffResult.output as DiffPreviewOutput;
        const writeTool = diffOutput?.exists === false ? WriteFileTool : AppendFileTool;
        toolResults.push(await executeTool(writeTool, {
          path: write.path,
          content: writeTool.name === 'append_file'
            ? getAppendDelta(write.content, diffOutput.exists, diffOutput.previousContent)
            : write.content
        }, context));
        continue;
      }

      if (write.mode === 'replace' && write.replacePatch) {
        toolResults.push(await executeTool(ReplaceFileTool, {
          path: write.path,
          before: write.replacePatch.before,
          after: write.replacePatch.after
        }, context));
        continue;
      }

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
