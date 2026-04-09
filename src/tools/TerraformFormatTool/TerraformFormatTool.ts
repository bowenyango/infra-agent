import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import type { Tool } from '../../Tool.ts';
import type { TerraformFormatRepairOutput } from '../../types/tools.ts';
import { getPreferredShell } from '../../utils/shell.ts';

export interface TerraformFormatInput {
  rootPath: string;
}

function toRelativeWorkspacePath(workspaceRoot: string, rootPath: string, formattedPath: string): string {
  const absoluteRootPath = resolve(workspaceRoot, rootPath);
  const absoluteFormattedPath = resolve(absoluteRootPath, formattedPath);
  return relative(resolve(workspaceRoot), absoluteFormattedPath) || '.';
}

export const TerraformFormatTool: Tool<TerraformFormatInput, TerraformFormatRepairOutput> = {
  name: 'terraform_fmt',
  description: 'Run terraform fmt -recursive within a selected Terraform root and capture formatted file contents.',
  safety: 'write_scoped',
  async execute(input, context) {
    const shell = getPreferredShell();
    const command = `terraform -chdir=${input.rootPath} fmt -recursive`;
    const result = spawnSync(shell, ['-lc', command], {
      cwd: context.workspaceRoot,
      encoding: 'utf8'
    });

    const stdout = result.stdout ?? '';
    const formattedPaths = stdout
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const formattedFiles = await Promise.all(
      formattedPaths.map(async formattedPath => {
        const relativePath = toRelativeWorkspacePath(context.workspaceRoot, input.rootPath, formattedPath);
        const content = await readFile(join(context.workspaceRoot, relativePath), 'utf8');
        return {
          path: relativePath,
          content
        };
      })
    );

    return {
      toolName: 'terraform_fmt',
      safety: 'write_scoped',
      output: {
        workspaceRoot: context.workspaceRoot,
        rootPath: input.rootPath,
        command,
        exitCode: result.status ?? 1,
        stdout,
        stderr: result.stderr ?? '',
        formattedFiles
      }
    };
  }
};
