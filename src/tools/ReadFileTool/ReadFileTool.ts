import { resolve } from 'node:path';
import type { Tool } from '../../Tool.ts';
import { readTextFile } from '../repository/repository-tools.ts';
import type { FileReadOutput } from '../../types/tools.ts';

const DEFAULT_MAX_CHARS = 8000;

export interface ReadFileInput {
  path: string;
  maxChars?: number;
}

export const ReadFileTool: Tool<ReadFileInput, FileReadOutput> = {
  name: 'read_file',
  description: 'Read a text file from the active workspace.',
  safety: 'read_only',
  async execute(input, context) {
    const absolutePath = resolve(context.workspaceRoot, input.path);
    const maxChars = input.maxChars ?? DEFAULT_MAX_CHARS;
    const content = await readTextFile(absolutePath);
    const truncated = content.length > maxChars;

    return {
      toolName: 'read_file',
      safety: 'read_only',
      output: {
        path: absolutePath,
        content: truncated ? content.slice(0, maxChars) : content,
        truncated
      }
    };
  }
};

