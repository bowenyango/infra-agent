import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildKnowledgeCacheId } from '../knowledge/cache.ts';
import type { ConfigSemanticFact, ConfigSemanticSource, ConfigSemanticsSummary } from '../types/config-semantics.ts';
import type { KnowledgeSource, RetrievedContextPacket } from '../types/knowledge.ts';
import type { TerraformRootSummary } from '../types/repository.ts';
import { extractTerraformBlocksFromContent, type TerraformHclBlock } from './terraform-hcl.ts';

const PROVIDER_SCHEMA_FILE_CANDIDATES = [
  '.infra-agent/terraform-provider-schema.json',
  '.infra-agent/terraform-providers-schema.json',
  'terraform-provider-schema.json',
  'terraform-providers-schema.json'
];

const MAX_SCHEMA_FACTS_PER_BLOCK = 18;
const MAX_CONTEXT_BLOCKS = 6;
const MAX_CONTEXT_ATTRIBUTES = 18;

interface TerraformProviderSchemaAttribute {
  type?: unknown;
  required?: boolean;
  optional?: boolean;
  computed?: boolean;
  sensitive?: boolean;
  deprecated?: boolean;
}

interface TerraformProviderSchemaNestedBlock {
  nesting_mode?: string;
  min_items?: number;
  max_items?: number;
  block?: TerraformProviderSchemaBlock;
}

interface TerraformProviderSchemaBlock {
  attributes?: Record<string, TerraformProviderSchemaAttribute>;
  block_types?: Record<string, TerraformProviderSchemaNestedBlock>;
}

interface TerraformProviderBlockSchema {
  version?: number;
  block?: TerraformProviderSchemaBlock;
}

interface TerraformProviderSchema {
  resource_schemas?: Record<string, TerraformProviderBlockSchema>;
  data_source_schemas?: Record<string, TerraformProviderBlockSchema>;
}

interface TerraformProvidersSchemaFile {
  format_version?: string;
  provider_schemas?: Record<string, TerraformProviderSchema>;
}

interface TerraformSchemaBlockUsage {
  typeName: string;
  docKind: 'resource' | 'data-source';
  blocks: TerraformHclBlock[];
}

interface TerraformSchemaMatch {
  providerAddress: string;
  schema: TerraformProviderBlockSchema;
}

interface CompactSchemaAttribute {
  name: string;
  type?: string;
  required?: boolean;
  optional?: boolean;
  computed?: boolean;
  sensitive?: boolean;
  deprecated?: boolean;
}

interface CompactSchemaBlock {
  type: string;
  kind: 'resource' | 'data-source';
  provider: string;
  sourcePaths: string[];
  requiredAttributes: CompactSchemaAttribute[];
  configuredAttributes: CompactSchemaAttribute[];
  requiredBlocks: string[];
  configuredBlocks: string[];
}

interface CompactProviderSchemaContext {
  schemaFile: string;
  formatVersion: string | null;
  blocks: CompactSchemaBlock[];
  note: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toAttribute(value: unknown): TerraformProviderSchemaAttribute | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    type: value.type,
    required: asBoolean(value.required),
    optional: asBoolean(value.optional),
    computed: asBoolean(value.computed),
    sensitive: asBoolean(value.sensitive),
    deprecated: asBoolean(value.deprecated)
  };
}

function toNestedBlock(value: unknown): TerraformProviderSchemaNestedBlock | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    nesting_mode: asString(value.nesting_mode) ?? undefined,
    min_items: asNumber(value.min_items),
    max_items: asNumber(value.max_items),
    block: toProviderSchemaBlock(value.block)
  };
}

function toAttributeMap(value: unknown): Record<string, TerraformProviderSchemaAttribute> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const attributes: Record<string, TerraformProviderSchemaAttribute> = {};
  for (const [name, attributeValue] of Object.entries(value)) {
    const attribute = toAttribute(attributeValue);
    if (attribute) {
      attributes[name] = attribute;
    }
  }

  return attributes;
}

function toBlockTypeMap(value: unknown): Record<string, TerraformProviderSchemaNestedBlock> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const blockTypes: Record<string, TerraformProviderSchemaNestedBlock> = {};
  for (const [name, blockValue] of Object.entries(value)) {
    const block = toNestedBlock(blockValue);
    if (block) {
      blockTypes[name] = block;
    }
  }

  return blockTypes;
}

function toProviderSchemaBlock(value: unknown): TerraformProviderSchemaBlock | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    attributes: toAttributeMap(value.attributes),
    block_types: toBlockTypeMap(value.block_types)
  };
}

function toBlockSchemaMap(value: unknown): Record<string, TerraformProviderBlockSchema> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const schemas: Record<string, TerraformProviderBlockSchema> = {};
  for (const [typeName, schemaValue] of Object.entries(value)) {
    if (!isRecord(schemaValue)) {
      continue;
    }

    schemas[typeName] = {
      version: asNumber(schemaValue.version),
      block: toProviderSchemaBlock(schemaValue.block)
    };
  }

  return schemas;
}

function toProvidersSchemaFile(value: unknown): TerraformProvidersSchemaFile | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawProviderSchemas = value.provider_schemas;
  if (!isRecord(rawProviderSchemas)) {
    return null;
  }

  const providerSchemas: Record<string, TerraformProviderSchema> = {};
  for (const [providerAddress, schemaValue] of Object.entries(rawProviderSchemas)) {
    if (!isRecord(schemaValue)) {
      continue;
    }

    providerSchemas[providerAddress] = {
      resource_schemas: toBlockSchemaMap(schemaValue.resource_schemas),
      data_source_schemas: toBlockSchemaMap(schemaValue.data_source_schemas)
    };
  }

  return {
    format_version: asString(value.format_version) ?? undefined,
    provider_schemas: providerSchemas
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readRootFile(workspaceRoot: string, path: string): Promise<string | null> {
  try {
    return await readFile(join(workspaceRoot, path), 'utf8');
  } catch {
    return null;
  }
}

function normalizeProviderAddress(address: string): string {
  return address.replace(/^registry\.terraform\.io\//, '');
}

function stringifySchemaType(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function sanitizeIdentifierForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function blockUsesAttribute(block: TerraformHclBlock, attributeName: string): boolean {
  const pattern = new RegExp(`(^|\\n)\\s*${sanitizeIdentifierForRegExp(attributeName)}\\s*=`, 'm');
  return pattern.test(block.body);
}

function blockUsesNestedBlock(block: TerraformHclBlock, blockName: string): boolean {
  const escapedBlockName = sanitizeIdentifierForRegExp(blockName);
  const pattern = new RegExp(`(^|\\n)\\s*(?:${escapedBlockName}\\s*\\{|dynamic\\s+"${escapedBlockName}"\\s*\\{)`, 'm');
  return pattern.test(block.body);
}

function sourceForSchemaFile(schemaFile: string): ConfigSemanticSource {
  return {
    kind: 'terraform-provider-schema',
    path: schemaFile
  };
}

function buildFact(params: {
  kind: ConfigSemanticFact['kind'];
  path: string;
  message: string;
  source: ConfigSemanticSource;
  values?: string[];
  relatedPaths?: string[];
}): ConfigSemanticFact {
  return {
    kind: params.kind,
    path: params.path,
    message: params.message,
    source: params.source,
    confidence: 'high',
    values: params.values,
    relatedPaths: params.relatedPaths
  };
}

function blockUsageKey(docKind: 'resource' | 'data-source', typeName: string): string {
  return `${docKind}:${typeName}`;
}

async function collectTerraformSchemaBlockUsages(
  workspaceRoot: string,
  root: TerraformRootSummary
): Promise<TerraformSchemaBlockUsage[]> {
  const usagesByKey = new Map<string, TerraformSchemaBlockUsage>();

  for (const tfFile of root.tfFiles) {
    const content = await readRootFile(workspaceRoot, tfFile);
    if (!content) {
      continue;
    }

    for (const resourceBlock of extractTerraformBlocksFromContent(content, tfFile, 'resource')) {
      const typeName = resourceBlock.labels[0];
      if (!typeName) {
        continue;
      }

      const key = blockUsageKey('resource', typeName);
      const usage = usagesByKey.get(key) ?? {
        typeName,
        docKind: 'resource' as const,
        blocks: []
      };
      usage.blocks.push(resourceBlock);
      usagesByKey.set(key, usage);
    }

    for (const dataBlock of extractTerraformBlocksFromContent(content, tfFile, 'data')) {
      const typeName = dataBlock.labels[0];
      if (!typeName) {
        continue;
      }

      const key = blockUsageKey('data-source', typeName);
      const usage = usagesByKey.get(key) ?? {
        typeName,
        docKind: 'data-source' as const,
        blocks: []
      };
      usage.blocks.push(dataBlock);
      usagesByKey.set(key, usage);
    }
  }

  return Array.from(usagesByKey.values()).sort((left, right) =>
    blockUsageKey(left.docKind, left.typeName).localeCompare(blockUsageKey(right.docKind, right.typeName))
  );
}

function findSchemaForUsage(
  schemaFile: TerraformProvidersSchemaFile,
  usage: TerraformSchemaBlockUsage
): TerraformSchemaMatch | null {
  for (const [providerAddress, providerSchema] of Object.entries(schemaFile.provider_schemas ?? {})) {
    const schema = usage.docKind === 'resource'
      ? providerSchema.resource_schemas?.[usage.typeName]
      : providerSchema.data_source_schemas?.[usage.typeName];

    if (schema) {
      return {
        providerAddress: normalizeProviderAddress(providerAddress),
        schema
      };
    }
  }

  return null;
}

function buildSchemaPath(usage: TerraformSchemaBlockUsage, fieldPath: string): string {
  return `${usage.docKind === 'resource' ? 'resource' : 'data'}.${usage.typeName}.${fieldPath}`;
}

function compactAttribute(name: string, attribute: TerraformProviderSchemaAttribute): CompactSchemaAttribute {
  return {
    name,
    type: stringifySchemaType(attribute.type),
    required: attribute.required,
    optional: attribute.optional,
    computed: attribute.computed,
    sensitive: attribute.sensitive,
    deprecated: attribute.deprecated
  };
}

function collectFactsForUsage(params: {
  usage: TerraformSchemaBlockUsage;
  match: TerraformSchemaMatch;
  source: ConfigSemanticSource;
}): ConfigSemanticFact[] {
  const facts: ConfigSemanticFact[] = [];
  const attributes = params.match.schema.block?.attributes ?? {};
  const blockTypes = params.match.schema.block?.block_types ?? {};

  for (const [attributeName, attribute] of Object.entries(attributes).sort(([left], [right]) => left.localeCompare(right))) {
    const path = buildSchemaPath(params.usage, attributeName);
    const typeLabel = stringifySchemaType(attribute.type);
    const isConfigured = params.usage.blocks.some(block => blockUsesAttribute(block, attributeName));

    if (attribute.required) {
      facts.push(buildFact({
        kind: 'required-field',
        path,
        message: `${path} is required by the Terraform provider schema.`,
        source: params.source,
        values: typeLabel ? [typeLabel] : undefined
      }));
      continue;
    }

    if (isConfigured && attribute.computed && !attribute.optional) {
      facts.push(buildFact({
        kind: 'disabled-field',
        path,
        message: `${path} is computed by the provider; do not set it in Terraform configuration.`,
        source: params.source,
        values: typeLabel ? [typeLabel] : undefined
      }));
      continue;
    }

    if (isConfigured && typeLabel) {
      facts.push(buildFact({
        kind: 'type-constraint',
        path,
        message: `${path} has Terraform provider schema type ${typeLabel}.`,
        source: params.source,
        values: [typeLabel]
      }));
    }

    if (isConfigured && attribute.deprecated) {
      facts.push(buildFact({
        kind: 'disabled-field',
        path,
        message: `${path} is marked deprecated by the Terraform provider schema.`,
        source: params.source
      }));
    }

    if (facts.length >= MAX_SCHEMA_FACTS_PER_BLOCK) {
      return facts;
    }
  }

  for (const [blockName, blockType] of Object.entries(blockTypes).sort(([left], [right]) => left.localeCompare(right))) {
    const path = buildSchemaPath(params.usage, blockName);
    const isConfigured = params.usage.blocks.some(block => blockUsesNestedBlock(block, blockName));
    const relationValues = [
      blockType.nesting_mode ? `nesting_mode=${blockType.nesting_mode}` : null,
      blockType.min_items !== undefined ? `min_items=${blockType.min_items}` : null,
      blockType.max_items !== undefined ? `max_items=${blockType.max_items}` : null
    ].filter((value): value is string => Boolean(value));

    if ((blockType.min_items ?? 0) > 0) {
      facts.push(buildFact({
        kind: 'required-field',
        path,
        message: `${path} block is required by the Terraform provider schema.`,
        source: params.source,
        values: relationValues.length > 0 ? relationValues : undefined
      }));
    } else if (isConfigured && relationValues.length > 0) {
      facts.push(buildFact({
        kind: 'type-constraint',
        path,
        message: `${path} block has Terraform provider schema nesting constraints.`,
        source: params.source,
        values: relationValues
      }));
    }

    if (facts.length >= MAX_SCHEMA_FACTS_PER_BLOCK) {
      return facts;
    }
  }

  return facts;
}

function buildCompactBlock(params: {
  usage: TerraformSchemaBlockUsage;
  match: TerraformSchemaMatch;
}): CompactSchemaBlock {
  const attributes = params.match.schema.block?.attributes ?? {};
  const blockTypes = params.match.schema.block?.block_types ?? {};
  const requiredAttributes = Object.entries(attributes)
    .filter(([, attribute]) => Boolean(attribute.required))
    .map(([name, attribute]) => compactAttribute(name, attribute))
    .slice(0, MAX_CONTEXT_ATTRIBUTES);
  const configuredAttributes = Object.entries(attributes)
    .filter(([name]) => params.usage.blocks.some(block => blockUsesAttribute(block, name)))
    .map(([name, attribute]) => compactAttribute(name, attribute))
    .slice(0, MAX_CONTEXT_ATTRIBUTES);
  const requiredBlocks = Object.entries(blockTypes)
    .filter(([, blockType]) => (blockType.min_items ?? 0) > 0)
    .map(([name, blockType]) => [
      name,
      blockType.nesting_mode ? `nesting_mode=${blockType.nesting_mode}` : null,
      blockType.min_items !== undefined ? `min_items=${blockType.min_items}` : null,
      blockType.max_items !== undefined ? `max_items=${blockType.max_items}` : null
    ].filter((value): value is string => Boolean(value)).join(' '))
    .slice(0, MAX_CONTEXT_ATTRIBUTES);
  const configuredBlocks = Object.entries(blockTypes)
    .filter(([name]) => params.usage.blocks.some(block => blockUsesNestedBlock(block, name)))
    .map(([name, blockType]) => [
      name,
      blockType.nesting_mode ? `nesting_mode=${blockType.nesting_mode}` : null,
      blockType.min_items !== undefined ? `min_items=${blockType.min_items}` : null,
      blockType.max_items !== undefined ? `max_items=${blockType.max_items}` : null
    ].filter((value): value is string => Boolean(value)).join(' '))
    .slice(0, MAX_CONTEXT_ATTRIBUTES);

  return {
    type: params.usage.typeName,
    kind: params.usage.docKind,
    provider: params.match.providerAddress,
    sourcePaths: Array.from(new Set(params.usage.blocks.map(block => block.sourcePath))).sort(),
    requiredAttributes,
    configuredAttributes,
    requiredBlocks,
    configuredBlocks
  };
}

function buildProviderSchemaKnowledgeSource(
  root: TerraformRootSummary,
  schemaFile: string
): KnowledgeSource {
  return {
    kind: 'provider-schema',
    name: `terraform-provider-schema:${root.rootPath}`,
    localPath: schemaFile,
    module: root.rootPath
  };
}

function estimateTokens(value: string): number {
  return Math.ceil(value.length / 4);
}

async function readTerraformProviderSchemaFile(
  workspaceRoot: string,
  schemaFile: string
): Promise<TerraformProvidersSchemaFile | null> {
  try {
    const raw = JSON.parse(await readFile(join(workspaceRoot, schemaFile), 'utf8')) as unknown;
    return toProvidersSchemaFile(raw);
  } catch {
    return null;
  }
}

async function buildCompactProviderSchemaContext(
  workspaceRoot: string,
  root: TerraformRootSummary,
  schemaFile: string
): Promise<CompactProviderSchemaContext | null> {
  const parsedSchemaFile = await readTerraformProviderSchemaFile(workspaceRoot, schemaFile);
  if (!parsedSchemaFile) {
    return null;
  }

  const usages = await collectTerraformSchemaBlockUsages(workspaceRoot, root);
  const blocks: CompactSchemaBlock[] = [];
  for (const usage of usages) {
    const match = findSchemaForUsage(parsedSchemaFile, usage);
    if (!match) {
      continue;
    }

    blocks.push(buildCompactBlock({
      usage,
      match
    }));

    if (blocks.length >= MAX_CONTEXT_BLOCKS) {
      break;
    }
  }

  if (blocks.length === 0) {
    return null;
  }

  return {
    schemaFile,
    formatVersion: parsedSchemaFile.format_version ?? null,
    blocks,
    note: 'Compact read-only summary from a local terraform providers schema -json export. Use it for shape/required/type context; confirm replacement behavior with plan output and provider-specific rules.'
  };
}

export async function detectTerraformProviderSchemaFiles(
  workspaceRoot: string,
  root: TerraformRootSummary
): Promise<string[]> {
  const schemaFiles: string[] = [];

  for (const candidate of PROVIDER_SCHEMA_FILE_CANDIDATES) {
    const schemaFile = join(root.rootPath, candidate);
    if (await fileExists(join(workspaceRoot, schemaFile))) {
      schemaFiles.push(schemaFile);
    }
  }

  return schemaFiles;
}

export async function extractTerraformProviderSchemaSemantics(
  workspaceRoot: string,
  root: TerraformRootSummary
): Promise<ConfigSemanticsSummary | null> {
  const schemaFile = root.providerSchemaFiles[0];
  if (!schemaFile) {
    return null;
  }

  const parsedSchemaFile = await readTerraformProviderSchemaFile(workspaceRoot, schemaFile);
  if (!parsedSchemaFile) {
    return null;
  }

  const source = sourceForSchemaFile(schemaFile);
  const facts: ConfigSemanticFact[] = [];
  const usages = await collectTerraformSchemaBlockUsages(workspaceRoot, root);

  for (const usage of usages) {
    const match = findSchemaForUsage(parsedSchemaFile, usage);
    if (!match) {
      continue;
    }

    facts.push(...collectFactsForUsage({
      usage,
      match,
      source
    }));
  }

  if (facts.length === 0) {
    return null;
  }

  return {
    targetKind: 'terraform-root',
    targetPath: root.rootPath,
    facts
  };
}

export async function extractTerraformProviderSchemaSemanticsForRoots(
  workspaceRoot: string,
  roots: TerraformRootSummary[]
): Promise<ConfigSemanticsSummary[]> {
  const summaries: ConfigSemanticsSummary[] = [];

  for (const root of roots) {
    const summary = await extractTerraformProviderSchemaSemantics(workspaceRoot, root);
    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries;
}

export async function buildTerraformProviderSchemaKnowledgeSources(
  workspaceRoot: string,
  root: TerraformRootSummary
): Promise<KnowledgeSource[]> {
  const sources: KnowledgeSource[] = [];

  for (const schemaFile of root.providerSchemaFiles) {
    const parsedSchemaFile = await readTerraformProviderSchemaFile(workspaceRoot, schemaFile);
    if (!parsedSchemaFile) {
      continue;
    }

    sources.push(buildProviderSchemaKnowledgeSource(
      root,
      schemaFile
    ));
  }

  return sources;
}

export async function retrieveTerraformProviderSchemaContextPackets(input: {
  workspaceRoot: string;
  root: TerraformRootSummary;
  reason: string;
  maxExcerptChars?: number;
}): Promise<RetrievedContextPacket[]> {
  const schemaFile = input.root.providerSchemaFiles[0];
  if (!schemaFile) {
    return [];
  }

  const compactContext = await buildCompactProviderSchemaContext(input.workspaceRoot, input.root, schemaFile);
  if (!compactContext) {
    return [];
  }

  const source = buildProviderSchemaKnowledgeSource(
    input.root,
    compactContext.schemaFile
  );
  const fullExcerpt = JSON.stringify(compactContext, null, 2);
  const excerpt = fullExcerpt.length <= (input.maxExcerptChars ?? 2400)
    ? fullExcerpt
    : fullExcerpt.slice(0, input.maxExcerptChars ?? 2400).trimEnd();

  return [
    {
      id: buildKnowledgeCacheId(source),
      source,
      confidence: 'high',
      reason: input.reason,
      contentType: 'application/json',
      excerpt,
      tokenEstimate: estimateTokens(excerpt)
    }
  ];
}
