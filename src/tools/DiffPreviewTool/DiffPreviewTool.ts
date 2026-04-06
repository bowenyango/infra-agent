import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool } from '../../Tool.ts';
import { readTextFile } from '../repository/repository-tools.ts';
import type { DiffPreviewOutput } from '../../types/tools.ts';

export interface DiffPreviewInput {
  path: string;
  nextContent: string;
}

function countAddedAndRemovedLines(previousContent: string, nextContent: string): { addedLines: number; removedLines: number } {
  const previousLines = previousContent.split('\n');
  const nextLines = nextContent.split('\n');

  let prefixLength = 0;
  while (
    prefixLength < previousLines.length &&
    prefixLength < nextLines.length &&
    previousLines[prefixLength] === nextLines[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength + prefixLength < previousLines.length &&
    suffixLength + prefixLength < nextLines.length &&
    previousLines[previousLines.length - 1 - suffixLength] === nextLines[nextLines.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const removedLines = Math.max(previousLines.length - prefixLength - suffixLength, 0);
  const addedLines = Math.max(nextLines.length - prefixLength - suffixLength, 0);

  return { addedLines, removedLines };
}

function buildPreview(previousContent: string, nextContent: string): string[] {
  const previousLines = previousContent.split('\n');
  const nextLines = nextContent.split('\n');
  const preview: string[] = [];

  for (const line of previousLines.slice(0, 6)) {
    if (!nextLines.includes(line)) {
      preview.push(`- ${line}`);
    }
  }

  for (const line of nextLines.slice(0, 10)) {
    if (!previousLines.includes(line)) {
      preview.push(`+ ${line}`);
    }
  }

  return preview.slice(0, 12);
}

export const DiffPreviewTool: Tool<DiffPreviewInput, DiffPreviewOutput> = {
  name: 'diff_preview',
  description: 'Preview the bounded diff for a planned file write.',
  safety: 'read_only',
  async execute(input, context) {
    const absolutePath = resolve(context.workspaceRoot, input.path);
    let exists = true;
    let previousContent = '';

    try {
      await access(absolutePath, fsConstants.F_OK);
      previousContent = await readTextFile(absolutePath);
    } catch {
      exists = false;
    }

    const { addedLines, removedLines } = countAddedAndRemovedLines(previousContent, input.nextContent);

    return {
      toolName: 'diff_preview',
      safety: 'read_only',
      output: {
        path: absolutePath,
        exists,
        addedLines,
        removedLines,
        preview: buildPreview(previousContent, input.nextContent)
      }
    };
  }
};
