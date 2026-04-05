import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Tool } from '../../Tool.ts';

export interface WriteFileInput {
  path: string;
  content: string;
}

export interface WriteFileOutput {
  path: string;
  bytesWritten: number;
}

export const WriteFileTool: Tool<WriteFileInput, WriteFileOutput> = {
  name: 'write_file',
  description: 'Write a file inside the active workspace.',
  safety: 'write_scoped',
  async execute(input, context) {
    const absolutePath = resolve(context.workspaceRoot, input.path);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.content, 'utf8');

    return {
      toolName: 'write_file',
      safety: 'write_scoped',
      output: {
        path: absolutePath,
        bytesWritten: Buffer.byteLength(input.content, 'utf8')
      }
    };
  }
};

