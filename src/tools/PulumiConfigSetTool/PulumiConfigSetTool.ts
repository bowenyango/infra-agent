import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Tool } from '../../Tool.ts';
import type { PulumiConfigSetOutput } from '../../types/tools.ts';

export interface PulumiConfigSetInput {
  projectRoot: string;
  stackName: string;
  key: string;
  value: string;
}

export const PulumiConfigSetTool: Tool<PulumiConfigSetInput, PulumiConfigSetOutput> = {
  name: 'pulumi_config_set',
  description: 'Use pulumi config set to apply bounded stack configuration updates through the native Pulumi CLI.',
  safety: 'write_scoped',
  async execute(input, context) {
    const workspaceRoot = resolve(context.workspaceRoot);
    const pulumiHome = join(workspaceRoot, '.pulumi-home');
    const pulumiState = join(workspaceRoot, '.pulumi-state');
    const stackFileName = `Pulumi.${input.stackName}.yaml`;
    const sharedEnv = {
      ...process.env,
      PULUMI_SKIP_UPDATE_CHECK: 'true',
      PULUMI_HOME: pulumiHome,
      PULUMI_BACKEND_URL: `file://${pulumiState}`,
      PULUMI_CONFIG_PASSPHRASE: 'infra-agent'
    };
    spawnSync('mkdir', ['-p', pulumiHome, pulumiState], {
      cwd: workspaceRoot,
      encoding: 'utf8'
    });
    spawnSync('pulumi', [
      'stack',
      'init',
      input.stackName,
      '--cwd',
      input.projectRoot,
      '--non-interactive'
    ], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      env: sharedEnv
    });
    const args = [
      'config',
      'set',
      input.key,
      input.value,
      '--cwd',
      input.projectRoot,
      '--stack',
      input.stackName,
      '--config-file',
      stackFileName,
      '--non-interactive'
    ];
    const result = spawnSync('pulumi', args, {
      cwd: workspaceRoot,
      encoding: 'utf8',
      env: sharedEnv
    });
    const stackFilePath = join(input.projectRoot, stackFileName);
    const content = await readFile(join(workspaceRoot, stackFilePath), 'utf8');

    return {
      toolName: 'pulumi_config_set',
      safety: 'write_scoped',
      output: {
        workspaceRoot,
        projectRoot: input.projectRoot,
        stackName: input.stackName,
        key: input.key,
        value: input.value,
        stackFilePath,
        command: `pulumi ${args.join(' ')}`,
        exitCode: result.status ?? 1,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
        content
      }
    };
  }
};
