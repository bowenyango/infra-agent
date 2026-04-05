import { spawnSync } from 'node:child_process';
import type { Tool } from '../../Tool.ts';
import type { ValidationRunOutput } from '../../types/tools.ts';

export interface ValidateTargetsInput {
  commands: string[];
}

export const ValidateTargetsTool: Tool<ValidateTargetsInput, ValidationRunOutput> = {
  name: 'validate_targets',
  description: 'Run validation commands inside the active workspace.',
  safety: 'validate',
  async execute(input, context) {
    const results = input.commands.map(command => {
      const result = spawnSync('sh', ['-lc', command], {
        cwd: context.workspaceRoot,
        encoding: 'utf8'
      });

      return {
        command,
        exitCode: result.status ?? 1,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? ''
      };
    });

    return {
      toolName: 'validate_targets',
      safety: 'validate',
      output: {
        workspaceRoot: context.workspaceRoot,
        results
      }
    };
  }
};

