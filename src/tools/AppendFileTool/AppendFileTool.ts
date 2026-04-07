import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Tool } from '../../Tool.ts';
import { tryReadTextFile } from '../repository/repository-tools.ts';
import type { WriteFileOutput } from '../../types/tools.ts';

export interface AppendFileInput {
  path: string;
  content: string;
}

export const AppendFileTool: Tool<AppendFileInput, WriteFileOutput> = {
  name: 'append_file',
  description: 'Append task-scoped content to an existing workspace file or create it if missing.',
  safety: 'write_scoped',
  async execute(input, context) {
    const absolutePath = resolve(context.workspaceRoot, input.path);
    await mkdir(dirname(absolutePath), { recursive: true });
    const previousContent = await tryReadTextFile(absolutePath);
    await appendFile(absolutePath, input.content, 'utf8');
    const nextContent = `${previousContent ?? ''}${input.content}`;

    return {
      toolName: 'append_file',
      safety: 'write_scoped',
      output: {
        path: absolutePath,
        bytesWritten: Buffer.byteLength(input.content, 'utf8'),
        content: nextContent
      }
    };
  }
};
