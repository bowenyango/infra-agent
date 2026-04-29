import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { KnowledgeFetcher } from '../knowledge/retrieve.ts';
import { retrieveKnowledgeContextPacket } from '../knowledge/retrieve.ts';
import type { KnowledgeSource, RetrievedContextPacket } from '../types/knowledge.ts';
import type { TerraformRootSummary } from '../types/repository.ts';
import {
  extractTerraformBlocksFromContent,
  findMatchingBrace,
  readAttributeExpression,
  unquoteHclString
} from './terraform-hcl.ts';
import { buildKnowledgeCacheId } from '../knowledge/cache.ts';
import {
  collectTerraformLockedProviders,
  normalizeTerraformProviderSourceAddress
} from './terraform-provider-lock.ts';

interface TerraformProviderRequirement {
  localName: string;
  sourceAddress: string;
  versionConstraint: string | null;
  declarationPath: string;
}

interface TerraformRegistryRetrievalInput {
  workspaceRoot: string;
  root: TerraformRootSummary;
  cacheRoot: string;
  reason: string;
  fetcher?: KnowledgeFetcher;
  now?: Date;
  maxSources?: number;
}

function stripQuotes(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return unquoteHclString(value);
}

function normalizeRegistrySourceAddress(value: string): string {
  return normalizeTerraformProviderSourceAddress(value);
}

function defaultProviderSourceAddress(localName: string): string {
  return `hashicorp/${localName}`;
}

function providerLocalNameFromType(typeName: string): string {
  return typeName.split('_')[0] ?? typeName;
}

function docSlugFromTypeName(typeName: string, providerLocalName: string): string {
  const prefix = `${providerLocalName}_`;
  return typeName.startsWith(prefix) ? typeName.slice(prefix.length) : typeName;
}

function terraformRegistryDocUrl(
  sourceAddress: string,
  docKind: 'resource' | 'data-source',
  docSlug: string
): string {
  return `https://registry.terraform.io/providers/${sourceAddress}/latest/docs/${docKind === 'data-source' ? 'data-sources' : 'resources'}/${docSlug}`;
}

function extractObjectBody(body: string, attributeName: string): string | null {
  const pattern = new RegExp(`(^|\\n)\\s*${attributeName}\\s*=\\s*\\{`, 'm');
  const match = body.match(pattern);
  if (!match || match.index === undefined) {
    return null;
  }

  const openBraceIndex = match.index + match[0].lastIndexOf('{');
  const closeBraceIndex = findMatchingBrace(body, openBraceIndex);
  if (closeBraceIndex < 0) {
    return null;
  }

  return body.slice(openBraceIndex + 1, closeBraceIndex);
}

function collectProviderRequirementsFromContent(content: string, sourcePath: string): TerraformProviderRequirement[] {
  const requirements: TerraformProviderRequirement[] = [];

  for (const terraformBlock of extractTerraformBlocksFromContent(content, sourcePath, 'terraform')) {
    for (const requiredProvidersBlock of extractTerraformBlocksFromContent(terraformBlock.body, sourcePath, 'required_providers')) {
      const providerEntryPattern = /(^|\n)\s*([A-Za-z0-9_-]+)\s*=\s*\{/g;
      for (const match of requiredProvidersBlock.body.matchAll(providerEntryPattern)) {
        if (match.index === undefined || !match[2]) {
          continue;
        }

        const localName = match[2];
        const bodyFromEntry = requiredProvidersBlock.body.slice(match.index);
        const objectBody = extractObjectBody(bodyFromEntry, localName);
        if (!objectBody) {
          continue;
        }

        const sourceAddress = stripQuotes(readAttributeExpression(objectBody, 'source'))
          ?? defaultProviderSourceAddress(localName);
        requirements.push({
          localName,
          sourceAddress: normalizeRegistrySourceAddress(sourceAddress),
          versionConstraint: stripQuotes(readAttributeExpression(objectBody, 'version')),
          declarationPath: sourcePath
        });
      }
    }
  }

  return requirements;
}

async function readRootFile(workspaceRoot: string, path: string): Promise<string | null> {
  try {
    return await readFile(join(workspaceRoot, path), 'utf8');
  } catch {
    return null;
  }
}

async function collectProviderRequirements(
  workspaceRoot: string,
  root: TerraformRootSummary
): Promise<Map<string, TerraformProviderRequirement>> {
  const requirementsByLocalName = new Map<string, TerraformProviderRequirement>();

  for (const tfFile of root.tfFiles) {
    const content = await readRootFile(workspaceRoot, tfFile);
    if (!content) {
      continue;
    }

    for (const requirement of collectProviderRequirementsFromContent(content, tfFile)) {
      requirementsByLocalName.set(requirement.localName, requirement);
    }
  }

  return requirementsByLocalName;
}

function buildResourceSource(params: {
  typeName: string;
  docKind: 'resource' | 'data-source';
  providerLocalName: string;
  providerSourceAddress: string;
  providerVersion: string | null;
  sourcePath: string;
}): KnowledgeSource {
  const docSlug = docSlugFromTypeName(params.typeName, params.providerLocalName);
  const source: KnowledgeSource = {
    kind: 'terraform-registry',
    name: `${params.docKind}:${params.typeName}`,
    provider: params.providerSourceAddress,
    module: params.sourcePath,
    url: terraformRegistryDocUrl(params.providerSourceAddress, params.docKind, docSlug)
  };

  if (params.providerVersion) {
    source.version = params.providerVersion;
  }

  return source;
}

function uniqueKnowledgeSources(sources: KnowledgeSource[]): KnowledgeSource[] {
  const seen = new Set<string>();
  const unique: KnowledgeSource[] = [];

  for (const source of sources) {
    const id = buildKnowledgeCacheId(source);
    if (seen.has(id)) {
      continue;
    }

    seen.add(id);
    unique.push(source);
  }

  return unique;
}

export async function buildTerraformRegistryKnowledgeSources(
  workspaceRoot: string,
  root: TerraformRootSummary
): Promise<KnowledgeSource[]> {
  const requirementsByLocalName = await collectProviderRequirements(workspaceRoot, root);
  const lockedBySource = await collectTerraformLockedProviders(workspaceRoot, root);
  const sources: KnowledgeSource[] = [];

  for (const tfFile of root.tfFiles) {
    const content = await readRootFile(workspaceRoot, tfFile);
    if (!content) {
      continue;
    }

    for (const block of [
      ...extractTerraformBlocksFromContent(content, tfFile, 'resource').map(resourceBlock => ({
        block: resourceBlock,
        docKind: 'resource' as const
      })),
      ...extractTerraformBlocksFromContent(content, tfFile, 'data').map(dataBlock => ({
        block: dataBlock,
        docKind: 'data-source' as const
      }))
    ]) {
      const typeName = block.block.labels[0];
      if (!typeName) {
        continue;
      }

      const providerLocalName = providerLocalNameFromType(typeName);
      const providerRequirement = requirementsByLocalName.get(providerLocalName);
      const providerSourceAddress = providerRequirement?.sourceAddress ?? defaultProviderSourceAddress(providerLocalName);
      const lockedProvider = lockedBySource.get(providerSourceAddress);
      const providerVersion = lockedProvider?.version ?? providerRequirement?.versionConstraint ?? null;

      sources.push(buildResourceSource({
        typeName,
        docKind: block.docKind,
        providerLocalName,
        providerSourceAddress,
        providerVersion,
        sourcePath: tfFile
      }));
    }
  }

  return uniqueKnowledgeSources(sources);
}

export async function retrieveTerraformRegistryContextPackets(
  input: TerraformRegistryRetrievalInput
): Promise<RetrievedContextPacket[]> {
  const sources = await buildTerraformRegistryKnowledgeSources(input.workspaceRoot, input.root);
  const packets: RetrievedContextPacket[] = [];

  for (const source of sources.slice(0, input.maxSources ?? 5)) {
    const packet = await retrieveKnowledgeContextPacket({
      cacheRoot: input.cacheRoot,
      source,
      reason: input.reason,
      fetcher: input.fetcher,
      now: input.now
    });

    if (packet) {
      packets.push(packet);
    }
  }

  return packets;
}
