import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { Tool } from '../../Tool.ts';
import type { HelmShowValuesOutput } from '../../types/tools.ts';

export interface HelmShowValuesInput {
  chartPath: string;
}

export const HelmShowValuesTool: Tool<HelmShowValuesInput, HelmShowValuesOutput> = {
  name: 'helm_show_values',
  description: 'Use helm show values to inspect the effective default values of a local chart through the native Helm CLI.',
  safety: 'read_only',
  async execute(input, context) {
    const workspaceRoot = resolve(context.workspaceRoot);
    const args = ['show', 'values', input.chartPath];
    const result = spawnSync('helm', args, {
      cwd: workspaceRoot,
      encoding: 'utf8'
    });

    return {
      toolName: 'helm_show_values',
      safety: 'read_only',
      output: {
        workspaceRoot,
        chartPath: input.chartPath,
        command: `helm ${args.join(' ')}`,
        exitCode: result.status ?? 1,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        content: result.stdout ?? ''
      }
    };
  }
};
