import type {
  KnowledgeCacheEntry,
  KnowledgeFact,
  KnowledgeFactSet,
  KnowledgeFactSourceRef,
  RetrievedContextConfidence
} from '../types/knowledge.ts';
import { isKnowledgeCacheEntryStale } from './cache.ts';
import { parseKnowledgeFactSet } from './facts-contract.ts';

interface ExtractKnowledgeFactSetOptions {
  now?: Date;
  extractedAt?: string;
}

const SECRET_PATH_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const IDENTITY_FIELD_NAMES = new Set(['bucket', 'domain_name', 'name', 'priority']);
const MAX_TERRAFORM_PROVIDER_SCHEMA_FACTS = 120;

interface CompactTerraformProviderSchemaAttribute {
  name: string;
  type?: string;
  required?: boolean;
  optional?: boolean;
  computed?: boolean;
  sensitive?: boolean;
  deprecated?: boolean;
}

interface CompactTerraformProviderSchemaBlock {
  type: string;
  kind: 'resource' | 'data-source';
  sourcePaths?: string[];
  requiredAttributes?: CompactTerraformProviderSchemaAttribute[];
  configuredAttributes?: CompactTerraformProviderSchemaAttribute[];
  requiredBlocks?: string[];
  configuredBlocks?: string[];
}

function factSource(entry: KnowledgeCacheEntry, locator: string): KnowledgeFactSourceRef {
  return {
    id: entry.id,
    source: entry.source,
    contentHash: entry.contentHash,
    locator
  };
}

function pathPrefixForSource(entry: KnowledgeCacheEntry): string {
  if (entry.source.name.startsWith('resource:')) {
    return `resource.${entry.source.name.slice('resource:'.length)}`;
  }

  if (entry.source.name.startsWith('data-source:')) {
    return `data.${entry.source.name.slice('data-source:'.length)}`;
  }

  return entry.source.name.replace(/[^A-Za-z0-9_.-]+/g, '_');
}

function stripMarkdown(value: string): string {
  return value
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSentence(value: string): string {
  const stripped = stripMarkdown(value);
  const match = stripped.match(/^(.+?[.!?])(?:\s|$)/);
  return match?.[1]?.trim() || stripped;
}

function sectionContent(markdown: string, heading: string): string | null {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`(?:^|\\n)#{2,3}\\s+${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n#{2,3}\\s+|$)`, 'i'));
  return match?.[1]?.trim() ?? null;
}

function extractExampleFact(entry: KnowledgeCacheEntry, prefix: string): KnowledgeFact[] {
  const section = sectionContent(entry.content, 'Example Usage');
  if (!section) {
    return [];
  }

  const codeBlock = section.match(/```(?:hcl|terraform|tf)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (!codeBlock) {
    return [];
  }

  return [{
    kind: 'example',
    path: `${prefix}.example`,
    summary: `Example usage for ${entry.source.name}.`,
    values: [codeBlock.slice(0, 240)],
    confidence: 'medium',
    extractionMethod: 'terraform-registry-markdown',
    source: factSource(entry, 'Example Usage')
  }];
}

function extractTerraformBulletFacts(
  entry: KnowledgeCacheEntry,
  prefix: string,
  sectionName: string,
  kind: 'argument' | 'attribute'
): KnowledgeFact[] {
  const section = sectionContent(entry.content, sectionName);
  if (!section) {
    return [];
  }

  const facts: KnowledgeFact[] = [];
  const bulletPattern = /(?:^|\n)\s*[-*]\s+`([^`]+)`\s*[-–]\s*([^\n]+)/g;
  for (const match of section.matchAll(bulletPattern)) {
    const name = match[1]?.trim();
    const description = match[2]?.trim();
    if (!name || !description || SECRET_PATH_PATTERN.test(name)) {
      continue;
    }

    const summary = firstSentence(description);
    if (SECRET_PATH_PATTERN.test(summary)) {
      continue;
    }

    const required = /\(required\)/i.test(description)
      ? true
      : /\(optional\)|\(computed\)/i.test(description)
        ? false
        : undefined;

    facts.push({
      kind,
      path: `${prefix}.${name}`,
      summary,
      values: [name],
      ...(required !== undefined ? { required } : {}),
      confidence: 'medium',
      extractionMethod: 'terraform-registry-markdown',
      source: factSource(entry, `${sectionName}: ${name}`)
    });

    if (kind === 'argument' && IDENTITY_FIELD_NAMES.has(name)) {
      facts.push({
        kind: 'identity-field',
        path: `${prefix}.${name}`,
        summary: `${name} can identify the remote infrastructure object.`,
        values: [name],
        confidence: 'low',
        extractionMethod: 'terraform-registry-markdown',
        source: factSource(entry, `${sectionName}: ${name}`)
      });
    }

    if (/force(s)? (a )?new|replacement|recreate/i.test(description)) {
      facts.push({
        kind: 'replacement-sensitive-field',
        path: `${prefix}.${name}`,
        summary: `${name} is described as replacement-sensitive.`,
        values: [name],
        confidence: 'medium',
        extractionMethod: 'terraform-registry-markdown',
        source: factSource(entry, `${sectionName}: ${name}`)
      });
    }
  }

  return facts;
}

function extractTerraformRegistryFacts(entry: KnowledgeCacheEntry): KnowledgeFact[] {
  const prefix = pathPrefixForSource(entry);
  return [
    ...extractExampleFact(entry, prefix),
    ...extractTerraformBulletFacts(entry, prefix, 'Argument Reference', 'argument'),
    ...extractTerraformBulletFacts(entry, prefix, 'Attributes Reference', 'attribute')
  ];
}

function valueToString(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

function extractHelmSchemaFactsFromNode(
  entry: KnowledgeCacheEntry,
  node: unknown,
  pathParts: string[],
  requiredFields: Set<string>,
  facts: KnowledgeFact[]
): void {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    return;
  }

  const schema = node as Record<string, unknown>;
  const properties = schema.properties;
  if (typeof properties !== 'object' || properties === null || Array.isArray(properties)) {
    return;
  }

  const chartName = entry.source.chart ?? entry.source.name;
  for (const [propertyName, propertyValue] of Object.entries(properties)) {
    if (SECRET_PATH_PATTERN.test(propertyName)) {
      continue;
    }

    const propertyPath = [...pathParts, propertyName];
    const propertySchema = typeof propertyValue === 'object' && propertyValue !== null && !Array.isArray(propertyValue)
      ? propertyValue as Record<string, unknown>
      : {};
    const description = typeof propertySchema.description === 'string'
      ? firstSentence(propertySchema.description)
      : `${propertyPath.join('.')} chart value.`;

    if (!SECRET_PATH_PATTERN.test(description)) {
      const values = Array.isArray(propertySchema.enum)
        ? propertySchema.enum.map(valueToString).filter((value): value is string => Boolean(value))
        : undefined;
      const defaultValue = valueToString(propertySchema.default);

      facts.push({
        kind: 'chart-value',
        path: `chart.${chartName}.${propertyPath.join('.')}`,
        summary: description,
        ...(values && values.length > 0 ? { values } : {}),
        required: requiredFields.has(propertyName),
        ...(typeof propertySchema.type === 'string' ? { type: propertySchema.type } : {}),
        ...(defaultValue !== undefined && !SECRET_PATH_PATTERN.test(defaultValue) ? { defaultValue } : {}),
        confidence: 'high',
        extractionMethod: 'helm-values-schema',
        source: factSource(entry, `values.schema.json: ${propertyPath.join('.')}`)
      });
    }

    const childRequired = new Set(Array.isArray(propertySchema.required)
      ? propertySchema.required.filter((value): value is string => typeof value === 'string')
      : []);
    extractHelmSchemaFactsFromNode(entry, propertySchema, propertyPath, childRequired, facts);
  }
}

function extractHelmValuesSchemaFacts(entry: KnowledgeCacheEntry): KnowledgeFact[] {
  try {
    const parsed = JSON.parse(entry.content) as unknown;
    const requiredFields = isRecordWithArray(parsed, 'required')
      ? new Set(parsed.required.filter((value): value is string => typeof value === 'string'))
      : new Set<string>();
    const facts: KnowledgeFact[] = [];
    extractHelmSchemaFactsFromNode(entry, parsed, [], requiredFields, facts);
    return facts;
  } catch {
    return [];
  }
}

function isRecordWithArray(value: unknown, field: string): value is Record<string, unknown[]> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Array.isArray((value as Record<string, unknown>)[field]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : [];
}

function asCompactTerraformProviderSchemaAttribute(value: unknown): CompactTerraformProviderSchemaAttribute | null {
  if (!isRecord(value) || typeof value.name !== 'string' || value.name.length === 0) {
    return null;
  }

  return {
    name: value.name,
    ...(typeof value.type === 'string' ? { type: value.type } : {}),
    ...(typeof value.required === 'boolean' ? { required: value.required } : {}),
    ...(typeof value.optional === 'boolean' ? { optional: value.optional } : {}),
    ...(typeof value.computed === 'boolean' ? { computed: value.computed } : {}),
    ...(typeof value.sensitive === 'boolean' ? { sensitive: value.sensitive } : {}),
    ...(typeof value.deprecated === 'boolean' ? { deprecated: value.deprecated } : {})
  };
}

function asCompactTerraformProviderSchemaBlock(value: unknown): CompactTerraformProviderSchemaBlock | null {
  if (
    !isRecord(value)
    || typeof value.type !== 'string'
    || (value.kind !== 'resource' && value.kind !== 'data-source')
  ) {
    return null;
  }

  const requiredAttributes = Array.isArray(value.requiredAttributes)
    ? value.requiredAttributes.map(asCompactTerraformProviderSchemaAttribute)
      .filter((attribute): attribute is CompactTerraformProviderSchemaAttribute => Boolean(attribute))
    : [];
  const configuredAttributes = Array.isArray(value.configuredAttributes)
    ? value.configuredAttributes.map(asCompactTerraformProviderSchemaAttribute)
      .filter((attribute): attribute is CompactTerraformProviderSchemaAttribute => Boolean(attribute))
    : [];

  return {
    type: value.type,
    kind: value.kind,
    sourcePaths: asStringArray(value.sourcePaths),
    requiredAttributes,
    configuredAttributes,
    requiredBlocks: asStringArray(value.requiredBlocks),
    configuredBlocks: asStringArray(value.configuredBlocks)
  };
}

function providerSchemaBlockPath(block: CompactTerraformProviderSchemaBlock, fieldPath: string): string {
  return `${block.kind === 'resource' ? 'resource' : 'data'}.${block.type}.${fieldPath}`;
}

function relationValuesFromBlockEntry(blockEntry: string): { name: string; values: string[] } | null {
  const [name, ...values] = blockEntry.split(/\s+/).filter(Boolean);
  if (!name || SECRET_PATH_PATTERN.test(name)) {
    return null;
  }

  return {
    name,
    values: values.filter(value => !SECRET_PATH_PATTERN.test(value))
  };
}

function pushTerraformProviderSchemaAttributeFact(params: {
  entry: KnowledgeCacheEntry;
  block: CompactTerraformProviderSchemaBlock;
  attribute: CompactTerraformProviderSchemaAttribute;
  required: boolean;
  emittedPaths: Set<string>;
  facts: KnowledgeFact[];
}): void {
  if (params.facts.length >= MAX_TERRAFORM_PROVIDER_SCHEMA_FACTS) {
    return;
  }

  const attribute = params.attribute;
  if (attribute.sensitive || SECRET_PATH_PATTERN.test(attribute.name)) {
    return;
  }

  const path = providerSchemaBlockPath(params.block, attribute.name);
  if (SECRET_PATH_PATTERN.test(path) || params.emittedPaths.has(path)) {
    return;
  }

  const computedOnly = Boolean(attribute.computed && !attribute.optional && !attribute.required);
  const summary = computedOnly
    ? `${path} is computed by the Terraform provider schema; do not set it in configuration.`
    : params.required
      ? `${path} is required by the Terraform provider schema.`
      : `${path} is configured in this Terraform root and typed by the provider schema.`;
  if (SECRET_PATH_PATTERN.test(summary)) {
    return;
  }

  params.emittedPaths.add(path);
  params.facts.push({
    kind: computedOnly ? 'attribute' : 'argument',
    path,
    summary,
    ...(attribute.type ? { type: attribute.type, values: [attribute.type] } : {}),
    required: params.required,
    confidence: 'high',
    extractionMethod: 'terraform-provider-schema',
    source: factSource(params.entry, `provider schema: ${path}`),
    ...(params.block.sourcePaths && params.block.sourcePaths.length > 0 ? { relatedPaths: params.block.sourcePaths } : {})
  });
}

function pushTerraformProviderSchemaNestedBlockFact(params: {
  entry: KnowledgeCacheEntry;
  block: CompactTerraformProviderSchemaBlock;
  blockEntry: string;
  required: boolean;
  emittedPaths: Set<string>;
  facts: KnowledgeFact[];
}): void {
  if (params.facts.length >= MAX_TERRAFORM_PROVIDER_SCHEMA_FACTS) {
    return;
  }

  const relation = relationValuesFromBlockEntry(params.blockEntry);
  if (!relation) {
    return;
  }

  const path = providerSchemaBlockPath(params.block, relation.name);
  if (SECRET_PATH_PATTERN.test(path) || params.emittedPaths.has(path)) {
    return;
  }

  params.emittedPaths.add(path);
  params.facts.push({
    kind: 'nested-block',
    path,
    summary: params.required
      ? `${path} block is required by the Terraform provider schema.`
      : `${path} block is configured in this Terraform root and constrained by the provider schema.`,
    required: params.required,
    ...(relation.values.length > 0 ? { values: relation.values } : {}),
    confidence: 'high',
    extractionMethod: 'terraform-provider-schema',
    source: factSource(params.entry, `provider schema: ${path}`),
    ...(params.block.sourcePaths && params.block.sourcePaths.length > 0 ? { relatedPaths: params.block.sourcePaths } : {})
  });
}

function extractTerraformProviderSchemaFacts(entry: KnowledgeCacheEntry): KnowledgeFact[] {
  try {
    const parsed = JSON.parse(entry.content) as unknown;
    const blocks = isRecord(parsed) && Array.isArray(parsed.blocks)
      ? parsed.blocks.map(asCompactTerraformProviderSchemaBlock)
        .filter((block): block is CompactTerraformProviderSchemaBlock => Boolean(block))
      : [];
    const facts: KnowledgeFact[] = [];

    for (const block of blocks) {
      const emittedPaths = new Set<string>();
      for (const attribute of block.requiredAttributes ?? []) {
        pushTerraformProviderSchemaAttributeFact({
          entry,
          block,
          attribute,
          required: true,
          emittedPaths,
          facts
        });
      }

      for (const attribute of block.configuredAttributes ?? []) {
        pushTerraformProviderSchemaAttributeFact({
          entry,
          block,
          attribute,
          required: Boolean(attribute.required),
          emittedPaths,
          facts
        });
      }

      for (const blockEntry of block.requiredBlocks ?? []) {
        pushTerraformProviderSchemaNestedBlockFact({
          entry,
          block,
          blockEntry,
          required: true,
          emittedPaths,
          facts
        });
      }

      for (const blockEntry of block.configuredBlocks ?? []) {
        pushTerraformProviderSchemaNestedBlockFact({
          entry,
          block,
          blockEntry,
          required: false,
          emittedPaths,
          facts
        });
      }

      if (facts.length >= MAX_TERRAFORM_PROVIDER_SCHEMA_FACTS) {
        break;
      }
    }

    return facts;
  } catch {
    return [];
  }
}

export function extractKnowledgeFactSetFromCacheEntry(
  entry: KnowledgeCacheEntry,
  options: ExtractKnowledgeFactSetOptions = {}
): KnowledgeFactSet {
  const sourceStale = isKnowledgeCacheEntryStale(entry, options.now);
  const extractedFacts = (() => {
    if (entry.source.kind === 'terraform-registry' && entry.contentType === 'text/markdown') {
      return extractTerraformRegistryFacts(entry);
    }

    if (entry.source.kind === 'chart-schema' && entry.contentType === 'application/json') {
      return extractHelmValuesSchemaFacts(entry);
    }

    if (entry.source.kind === 'provider-schema' && entry.contentType === 'application/json') {
      return extractTerraformProviderSchemaFacts(entry);
    }

    return [];
  })();
  const confidence: RetrievedContextConfidence = sourceStale ? 'medium' : 'high';
  const facts = extractedFacts.map(fact => sourceStale && fact.confidence === 'high'
    ? { ...fact, confidence }
    : fact);

  return parseKnowledgeFactSet({
    kind: 'infra-agent.knowledge-facts',
    schemaVersion: 1,
    mutationAllowed: false,
    sourceId: entry.id,
    source: entry.source,
    sourceContentHash: entry.contentHash,
    sourceFetchedAt: entry.fetchedAt,
    ...(entry.staleAfter !== undefined ? { sourceStaleAfter: entry.staleAfter } : {}),
    sourceStale,
    extractedAt: options.extractedAt ?? new Date().toISOString(),
    factCount: facts.length,
    facts
  });
}
