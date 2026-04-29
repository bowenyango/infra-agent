import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TerraformRootSummary } from '../types/repository.ts';
import {
  extractTerraformBlocksFromContent,
  readAttributeExpression,
  unquoteHclString
} from './terraform-hcl.ts';

export interface TerraformLockedProvider {
  sourceAddress: string;
  version: string;
}

function stripQuotes(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return unquoteHclString(value);
}

export function normalizeTerraformProviderSourceAddress(value: string): string {
  return value.replace(/^registry\.terraform\.io\//, '');
}

export function collectTerraformLockedProvidersFromContent(content: string): TerraformLockedProvider[] {
  const lockedProviders: TerraformLockedProvider[] = [];

  for (const block of extractTerraformBlocksFromContent(content, '.terraform.lock.hcl', 'provider')) {
    const sourceAddress = block.labels[0];
    const version = stripQuotes(readAttributeExpression(block.body, 'version'));
    if (!sourceAddress || !version) {
      continue;
    }

    lockedProviders.push({
      sourceAddress: normalizeTerraformProviderSourceAddress(sourceAddress),
      version
    });
  }

  return lockedProviders;
}

export async function collectTerraformLockedProviders(
  workspaceRoot: string,
  root: TerraformRootSummary
): Promise<Map<string, TerraformLockedProvider>> {
  const lockedBySource = new Map<string, TerraformLockedProvider>();

  try {
    const lockContent = await readFile(join(workspaceRoot, root.rootPath, '.terraform.lock.hcl'), 'utf8');
    for (const lockedProvider of collectTerraformLockedProvidersFromContent(lockContent)) {
      lockedBySource.set(lockedProvider.sourceAddress, lockedProvider);
    }
  } catch {
    return lockedBySource;
  }

  return lockedBySource;
}
