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

  const replacePatch = buildReplacePatch(previousContent, nextContent);
  if (replacePatch) {
    return 'replace';
  }

  return 'rewrite';
}

function buildPatchHint(mode: FileWriteMode): string {
  switch (mode) {
    case 'create':
      return 'Create a new task-scoped file because no existing file content was found.';
    case 'append':
      return 'Append task-scoped content without rewriting the untouched prefix of the file.';
    case 'replace':
      return 'Replace a bounded in-file segment while preserving unchanged prefix and suffix content.';
    case 'rewrite':
    default:
      return 'Rewrite the full file because the bounded change cannot be represented as a pure append.';
  }
}

function buildReplacePatch(previousContent: string, nextContent: string): FileWritePlan['replacePatch'] | undefined {
  let prefixLength = 0;
  while (
    prefixLength < previousContent.length &&
    prefixLength < nextContent.length &&
    previousContent[prefixLength] === nextContent[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength + prefixLength < previousContent.length &&
    suffixLength + prefixLength < nextContent.length &&
    previousContent[previousContent.length - 1 - suffixLength] === nextContent[nextContent.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const before = previousContent.slice(prefixLength, previousContent.length - suffixLength);
  const after = nextContent.slice(prefixLength, nextContent.length - suffixLength);

  if (before.length > 0 && after.length > 0) {
    if (before === after || previousContent.indexOf(before) === -1) {
      return undefined;
    }

    return { before, after };
  }

  if (before.length === 0 && after.length > 0) {
    const anchorEnd = previousContent.indexOf('\n', prefixLength);
    const anchor = anchorEnd >= 0
      ? previousContent.slice(prefixLength, anchorEnd + 1)
      : previousContent.slice(prefixLength);
    if (anchor.length === 0 || previousContent.indexOf(anchor) === -1) {
      return undefined;
    }

    return {
      before: anchor,
      after: `${after}${anchor}`
    };
  }

  if (before.length > 0 && after.length === 0) {
    return undefined;
  }

  return undefined;
}

export function classifyWritePlan(runtime: AgentRuntimeState, write: FileWritePlan): FileWritePlan {
  const previousContent = getLatestFileContent(runtime, write.path);
  const mode = detectWriteMode(previousContent, write.content);
  const replacePatch = previousContent && mode === 'replace'
    ? buildReplacePatch(previousContent, write.content)
    : undefined;

  return {
    ...write,
    mode,
    patchHint: write.patchHint ?? buildPatchHint(mode),
    replacePatch
  };
}
