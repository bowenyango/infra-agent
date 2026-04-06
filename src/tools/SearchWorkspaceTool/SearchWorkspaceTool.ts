import { relative, resolve } from 'node:path';
import type { Tool } from '../../Tool.ts';
import { searchWorkspace } from '../repository/repository-tools.ts';
import type { SearchWorkspaceOutput } from '../../types/tools.ts';

export interface SearchWorkspaceInput {
  rootPath?: string;
  fileNamePattern?: string;
  contentPattern?: string;
  maxResults?: number;
}

function toRegExp(pattern: string | undefined): RegExp | undefined {
  if (!pattern || pattern.trim().length === 0) {
    return undefined;
  }

  return new RegExp(pattern, 'i');
}

export const SearchWorkspaceTool: Tool<SearchWorkspaceInput, SearchWorkspaceOutput> = {
  name: 'search_workspace',
  description: 'Search repository files by file name or file content.',
  safety: 'read_only',
  async execute(input, context) {
    const absoluteRootPath = resolve(context.workspaceRoot, input.rootPath ?? '.');
    const matches = await searchWorkspace({
      rootPath: absoluteRootPath,
      fileNamePattern: toRegExp(input.fileNamePattern),
      contentPattern: toRegExp(input.contentPattern),
      maxResults: input.maxResults ?? 20
    });

    return {
      toolName: 'search_workspace',
      safety: 'read_only',
      output: {
        rootPath: absoluteRootPath,
        matches: matches.map(match => ({
          ...match,
          path: relative(context.workspaceRoot, match.path) || '.'
        }))
      }
    };
  }
};
