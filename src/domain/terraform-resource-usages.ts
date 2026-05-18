import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { extractTerraformBlocksFromContent } from './terraform-hcl.ts';
import type {
  TerraformResourceUsageSummary,
  TerraformRootSummary
} from '../types/repository.ts';

const SECRET_RESOURCE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;

function providerLocalNameFromType(typeName: string): string {
  return typeName.split('_')[0] ?? typeName;
}

function resourceUsageKey(usage: TerraformResourceUsageSummary): string {
  return `${usage.kind}:${usage.typeName}:${usage.name}:${usage.sourcePath}`;
}

function buildUsage(input: {
  kind: TerraformResourceUsageSummary['kind'];
  typeName: string;
  name: string;
  sourcePath: string;
}): TerraformResourceUsageSummary | null {
  if (
    input.typeName.length === 0
    || input.name.length === 0
    || SECRET_RESOURCE_PATTERN.test(input.typeName)
    || SECRET_RESOURCE_PATTERN.test(input.name)
  ) {
    return null;
  }

  return {
    kind: input.kind,
    typeName: input.typeName,
    name: input.name,
    providerLocalName: providerLocalNameFromType(input.typeName),
    sourcePath: input.sourcePath,
    sourceLocator: `${input.kind}.${input.typeName}.${input.name}`
  };
}

async function readRootFile(workspaceRoot: string, path: string): Promise<string | null> {
  try {
    return await readFile(join(workspaceRoot, path), 'utf8');
  } catch {
    return null;
  }
}

export async function detectTerraformResourceUsages(
  workspaceRoot: string,
  root: Pick<TerraformRootSummary, 'tfFiles'>
): Promise<TerraformResourceUsageSummary[]> {
  const usages: TerraformResourceUsageSummary[] = [];
  const seen = new Set<string>();

  for (const tfFile of root.tfFiles) {
    const content = await readRootFile(workspaceRoot, tfFile);
    if (!content) {
      continue;
    }

    for (const block of [
      ...extractTerraformBlocksFromContent(content, tfFile, 'resource').map(resourceBlock => ({
        block: resourceBlock,
        kind: 'resource' as const
      })),
      ...extractTerraformBlocksFromContent(content, tfFile, 'data').map(dataBlock => ({
        block: dataBlock,
        kind: 'data-source' as const
      }))
    ]) {
      const typeName = block.block.labels[0] ?? '';
      const name = block.block.labels[1] ?? '';
      const usage = buildUsage({
        kind: block.kind,
        typeName,
        name,
        sourcePath: block.block.sourcePath
      });
      if (!usage) {
        continue;
      }

      const key = resourceUsageKey(usage);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      usages.push(usage);
    }
  }

  return usages.sort((left, right) =>
    left.kind.localeCompare(right.kind)
    || left.typeName.localeCompare(right.typeName)
    || left.name.localeCompare(right.name)
    || left.sourcePath.localeCompare(right.sourcePath)
  );
}
