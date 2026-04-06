import type { AgentRuntimeState } from '../types/agent.ts';
import type { FileWriteMode, FileWritePlan } from '../types/edit-plan.ts';
import { getLatestFileContent } from './edit-plans/runtime-file-content.ts';

function detectWriteMode(previousContent: string | null, nextContent: string): FileWriteMode {
  if (previousContent === null) {
    return 'create';
  }

  if (nextContent.startsWith(previousContent) && nextContent.length > previousContent.length) {
    return 'append';
  }

  return 'rewrite';
}

function buildPatchHint(mode: FileWriteMode): string {
  switch (mode) {
    case 'create':
      return 'Create a new task-scoped file because no existing file content was found.';
    case 'append':
      return 'Append task-scoped content without rewriting the untouched prefix of the file.';
    case 'rewrite':
    default:
      return 'Rewrite the full file because the bounded change cannot be represented as a pure append.';
  }
}

export function classifyWritePlan(runtime: AgentRuntimeState, write: FileWritePlan): FileWritePlan {
  const previousContent = getLatestFileContent(runtime, write.path);
  const mode = detectWriteMode(previousContent, write.content);

  return {
    ...write,
    mode,
    patchHint: write.patchHint ?? buildPatchHint(mode)
  };
}
