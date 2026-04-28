import { dirname, join } from 'node:path';
import { buildInspectionCandidateFiles, buildInspectionSearchPattern } from './inspection-priority.ts';
import { isWriteAllowedByWorkspacePolicy } from '../domain/workspace-policy.ts';
import { executeTool } from '../services/tools/execute-tool.ts';
import { AppendFileTool } from '../tools/AppendFileTool/AppendFileTool.ts';
import { DiffPreviewTool } from '../tools/DiffPreviewTool/DiffPreviewTool.ts';
import { HelmShowChartTool } from '../tools/HelmShowChartTool/HelmShowChartTool.ts';
import { HelmShowValuesTool } from '../tools/HelmShowValuesTool/HelmShowValuesTool.ts';
import { ListDirectoryTool } from '../tools/ListDirectoryTool/ListDirectoryTool.ts';
import { PulumiConfigSetTool } from '../tools/PulumiConfigSetTool/PulumiConfigSetTool.ts';
import { ReadFileTool } from '../tools/ReadFileTool/ReadFileTool.ts';
import { ReplaceFileTool } from '../tools/ReplaceFileTool/ReplaceFileTool.ts';
import { SearchWorkspaceTool } from '../tools/SearchWorkspaceTool/SearchWorkspaceTool.ts';
import { TerraformFormatTool } from '../tools/TerraformFormatTool/TerraformFormatTool.ts';
import { ValidateTargetsTool } from '../tools/ValidateTargetsTool/ValidateTargetsTool.ts';
import { ValidateYamlSyntaxTool } from '../tools/ValidateYamlSyntaxTool/ValidateYamlSyntaxTool.ts';
import { WriteFileTool } from '../tools/WriteFileTool/WriteFileTool.ts';
import type { AgentDecision, AgentDecisionExecution } from '../types/agent.ts';
import type { ToolUseContext } from '../Tool.ts';
import type { DiffPreviewOutput, DirectoryListingOutput, SearchWorkspaceOutput, WriteFileOutput, YamlSyntaxValidationOutput } from '../types/tools.ts';
import { shouldValidateYamlSyntaxPath } from '../validators/yaml-syntax.ts';

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

function yamlValidationFailed(output: unknown): boolean {
  return (output as YamlSyntaxValidationOutput).result.exitCode !== 0;
}

async function validatePlannedYamlWriteIfNeeded(
  path: string,
  content: string,
  context: ToolUseContext
) {
  if (!shouldValidateYamlSyntaxPath(path)) {
    return null;
  }

  return executeTool(ValidateYamlSyntaxTool, { path, content }, context);
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
      const candidateFiles = buildInspectionCandidateFiles({
        dirName,
        listedFiles,
        requestedDomains: decision.action.payload?.requestedDomains ?? []
      });

      if ((decision.action.payload?.requestedDomains ?? []).includes('helm') && listedFiles.includes('Chart.yaml')) {
        toolResults.push(await executeTool(HelmShowChartTool, { chartPath: targetPath }, context));
        toolResults.push(await executeTool(HelmShowValuesTool, { chartPath: targetPath }, context));
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
        fileNamePattern: buildInspectionSearchPattern(decision.action.payload?.requestedDomains ?? []),
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

  if (decision.action.kind === 'repair-terraform-formatting') {
    const rootPath = decision.action.payload?.rootPath;
    if (!rootPath) {
      return {
        status: 'skipped',
        executedTools: [],
        reason: 'No Terraform root path was present for formatting repair.'
      };
    }

    const workspaceSearch = await executeTool(SearchWorkspaceTool, {
      rootPath,
      fileNamePattern: '^(.*\\.tf|.*\\.tfvars(?:\\.json)?)$',
      maxResults: 200
    }, context);

    const candidateMatches = (workspaceSearch.output as SearchWorkspaceOutput).matches;
    const blockedPaths = candidateMatches
      .map(match => match.path)
      .filter(path => !isWriteAllowedByWorkspacePolicy({
        path,
        content: '',
        reason: 'Terraform formatting repair.',
        mode: 'replace'
      }, workspaceConfig));

    if (blockedPaths.length > 0) {
      return {
        status: 'skipped',
        executedTools: [workspaceSearch],
        reason: `Workspace write policy blocked terraform formatting repair for: ${blockedPaths.join(', ')}`
      };
    }

    const formatResult = await executeTool(TerraformFormatTool, { rootPath }, context);
    return {
      status: 'completed',
      executedTools: [workspaceSearch, formatResult]
    };
  }

  if (decision.action.kind === 'apply-edit-plan') {
    const writes = decision.action.payload?.writes ?? [];
    const editPlan = decision.action.payload?.editPlan;
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
    if (editPlan?.kind === 'pulumi-stack-config' && editPlan.pulumiConfigOperations && editPlan.pulumiConfigOperations.length > 0) {
      for (const write of allowedWrites) {
        const diffResult = await executeTool(DiffPreviewTool, {
          path: write.path,
          nextContent: write.content
        }, context);
        toolResults.push(diffResult);

        const yamlValidation = await validatePlannedYamlWriteIfNeeded(write.path, write.content, context);
        if (yamlValidation) {
          toolResults.push(yamlValidation);
          if (yamlValidationFailed(yamlValidation.output)) {
            return {
              status: 'completed',
              executedTools: toolResults
            };
          }
        }
      }

      for (const operation of editPlan.pulumiConfigOperations) {
        const pulumiResult = await executeTool(PulumiConfigSetTool, operation, context);
        toolResults.push(pulumiResult);

        const pulumiOutput = pulumiResult.output;
        const yamlValidation = await validatePlannedYamlWriteIfNeeded(
          pulumiOutput.stackFilePath,
          pulumiOutput.content,
          context
        );
        if (yamlValidation) {
          toolResults.push(yamlValidation);
          if (yamlValidationFailed(yamlValidation.output)) {
            return {
              status: 'completed',
              executedTools: toolResults
            };
          }
        }
      }

      return {
        status: 'completed',
        executedTools: toolResults
      };
    }

    for (const write of allowedWrites) {
      const diffResult = await executeTool(DiffPreviewTool, {
        path: write.path,
        nextContent: write.content
      }, context);
      toolResults.push(diffResult);

      const plannedYamlValidation = await validatePlannedYamlWriteIfNeeded(write.path, write.content, context);
      if (plannedYamlValidation) {
        toolResults.push(plannedYamlValidation);
        if (yamlValidationFailed(plannedYamlValidation.output)) {
          return {
            status: 'completed',
            executedTools: toolResults
          };
        }
      }

      let writeResult;

      if (write.mode === 'append') {
        const diffOutput = diffResult.output as DiffPreviewOutput;
        const writeTool = diffOutput?.exists === false ? WriteFileTool : AppendFileTool;
        writeResult = await executeTool(writeTool, {
          path: write.path,
          content: writeTool.name === 'append_file'
            ? getAppendDelta(write.content, diffOutput.exists, diffOutput.previousContent)
            : write.content
        }, context);
      } else if (write.mode === 'replace' && write.replacePatch) {
        writeResult = await executeTool(ReplaceFileTool, {
          path: write.path,
          before: write.replacePatch.before,
          after: write.replacePatch.after
        }, context);
      } else {
        writeResult = await executeTool(WriteFileTool, {
          path: write.path,
          content: write.content
        }, context);
      }

      toolResults.push(writeResult);

      const writeOutput = writeResult.output as WriteFileOutput;
      const actualYamlValidation = await validatePlannedYamlWriteIfNeeded(write.path, writeOutput.content, context);
      if (actualYamlValidation) {
        toolResults.push(actualYamlValidation);
        if (yamlValidationFailed(actualYamlValidation.output)) {
          return {
            status: 'completed',
            executedTools: toolResults
          };
        }
      }
    }

    return {
      status: 'completed',
      executedTools: toolResults
    };
  }

  return null;
}
