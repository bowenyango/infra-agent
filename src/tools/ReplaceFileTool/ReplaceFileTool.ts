import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { Tool } from '../../Tool.ts';
import { readTextFile } from '../repository/repository-tools.ts';
import type { WriteFileOutput } from '../../types/tools.ts';

export interface ReplaceFileInput {
  path: string;
  before: string;
  after: string;
}

export const ReplaceFileTool: Tool<ReplaceFileInput, WriteFileOutput> = {
  name: 'replace_file',
  description: 'Replace a bounded content segment inside an existing workspace file.',
  safety: 'write_scoped',
  async execute(input, context) {
    const absolutePath = resolve(context.workspaceRoot, input.path);
    const previousContent = await readTextFile(absolutePath);
    if (!previousContent.includes(input.before)) {
      throw new Error(`replace_file could not find the requested segment in ${input.path}.`);
    }

    const nextContent = previousContent.replace(input.before, input.after);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, nextContent, 'utf8');

    return {
      toolName: 'replace_file',
      safety: 'write_scoped',
      output: {
        path: absolutePath,
        bytesWritten: Buffer.byteLength(nextContent, 'utf8'),
        content: nextContent
      }
    };
  }
};
