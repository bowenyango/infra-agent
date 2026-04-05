import { resolve } from 'node:path';
import type { Tool } from '../../Tool.ts';
import { listDirectory } from '../repository/repository-tools.ts';
import type { DirectoryListingOutput } from '../../types/tools.ts';

export interface ListDirectoryInput {
  path: string;
}

export const ListDirectoryTool: Tool<ListDirectoryInput, DirectoryListingOutput> = {
  name: 'list_directory',
  description: 'List direct children of a repository path.',
  safety: 'read_only',
  async execute(input, context) {
    const absolutePath = resolve(context.workspaceRoot, input.path);
    const entries = await listDirectory(absolutePath);

    return {
      toolName: 'list_directory',
      safety: 'read_only',
      output: {
        path: absolutePath,
        entries: entries.map(entry => ({
          name: entry.name,
          kind: entry.kind
        }))
      }
    };
  }
};

