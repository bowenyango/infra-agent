import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { Tool } from '../../Tool.ts';
import type { HelmShowChartOutput } from '../../types/tools.ts';

export interface HelmShowChartInput {
  chartPath: string;
}

export const HelmShowChartTool: Tool<HelmShowChartInput, HelmShowChartOutput> = {
  name: 'helm_show_chart',
  description: 'Use helm show chart to inspect local chart metadata through the native Helm CLI.',
  safety: 'read_only',
  async execute(input, context) {
    const workspaceRoot = resolve(context.workspaceRoot);
    const args = ['show', 'chart', input.chartPath];
    const result = spawnSync('helm', args, {
      cwd: workspaceRoot,
      encoding: 'utf8'
    });

    return {
      toolName: 'helm_show_chart',
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
