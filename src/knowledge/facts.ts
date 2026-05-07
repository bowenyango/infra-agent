import type {
  KnowledgeCacheEntry,
  KnowledgeFact,
  KnowledgeFactSet,
  KnowledgeFactSourceRef,
  RetrievedContextConfidence
} from '../types/knowledge.ts';
import { isKnowledgeCacheEntryStale } from './cache.ts';
import { extractPulumiDocsMarkdownFacts } from './fact-extractors/pulumi-docs-markdown.ts';
import { parseKnowledgeFactSet } from './facts-contract.ts';

interface ExtractKnowledgeFactSetOptions {
  now?: Date;
  extractedAt?: string;
}

const SECRET_PATH_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const IDENTITY_FIELD_NAMES = new Set(['bucket', 'domain_name', 'name', 'priority']);
const MAX_TERRAFORM_PROVIDER_SCHEMA_FACTS = 120;
const MAX_TERRAFORM_MODULE_FACTS = 140;
const MAX_PULUMI_CONFIG_FACTS = 140;
const MAX_HELM_CHART_METADATA_FACTS = 140;

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

interface TerraformLocalModuleInputFactSource {
  name: string;
  sourcePath: string;
  required: boolean;
  type?: string;
  defaultValue?: string;
  description?: string;
  values?: string[];
}

interface TerraformLocalModuleOutputFactSource {
  name: string;
  sourcePath: string;
  description?: string;
}

interface TerraformLocalModuleFactSource {
  callName: string;
  modulePath: string;
  callSourcePaths: string[];
  moduleSourcePaths: string[];
  inputs: TerraformLocalModuleInputFactSource[];
  outputs: TerraformLocalModuleOutputFactSource[];
}

interface PulumiConfigDeclarationFactSource {
  key: string;
  sourcePath: string;
  type?: string;
  defaultValue?: string;
}

interface PulumiStackConfigValueFactSource {
  key: string;
  sourcePath: string;
  stackName: string;
  configured: true;
  secure: false;
  value?: string;
}

interface PulumiConfigFactSource {
  projectRoot: string;
  projectFile: string;
  projectName: string;
  stackFiles: string[];
  declarations: PulumiConfigDeclarationFactSource[];
  stackValues: PulumiStackConfigValueFactSource[];
}

interface HelmChartMetadataDependencyFactSource {
  name: string;
  sourcePath: string;
  locked: boolean;
  version?: string;
  repository?: string;
  alias?: string;
}

interface HelmChartMetadataFactSource {
  chartRoot: string;
  chartFile: string;
  lockFile?: string;
  chartName: string;
  apiVersion?: string;
  version?: string;
  appVersion?: string;
  kubeVersion?: string;
  chartType?: string;
  home?: string;
  sources: string[];
  lockDigest?: string;
  lockGenerated?: string;
  dependencies: HelmChartMetadataDependencyFactSource[];
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

function asTerraformLocalModuleInput(value: unknown): TerraformLocalModuleInputFactSource | null {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.sourcePath !== 'string') {
    return null;
  }

  if (SECRET_PATH_PATTERN.test(value.name) || SECRET_PATH_PATTERN.test(value.sourcePath)) {
    return null;
  }

  return {
    name: value.name,
    sourcePath: value.sourcePath,
    required: value.required === true,
    ...(typeof value.type === 'string' && !SECRET_PATH_PATTERN.test(value.type) ? { type: value.type } : {}),
    ...(typeof value.defaultValue === 'string' && !SECRET_PATH_PATTERN.test(value.defaultValue)
      ? { defaultValue: value.defaultValue }
      : {}),
    ...(typeof value.description === 'string' && !SECRET_PATH_PATTERN.test(value.description)
      ? { description: value.description }
      : {}),
    values: asStringArray(value.values).filter(entryValue => !SECRET_PATH_PATTERN.test(entryValue))
  };
}

function asTerraformLocalModuleOutput(value: unknown): TerraformLocalModuleOutputFactSource | null {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.sourcePath !== 'string') {
    return null;
  }

  if (SECRET_PATH_PATTERN.test(value.name) || SECRET_PATH_PATTERN.test(value.sourcePath)) {
    return null;
  }

  return {
    name: value.name,
    sourcePath: value.sourcePath,
    ...(typeof value.description === 'string' && !SECRET_PATH_PATTERN.test(value.description)
      ? { description: value.description }
      : {})
  };
}

function asTerraformLocalModuleFactSource(value: unknown): TerraformLocalModuleFactSource | null {
  if (
    !isRecord(value)
    || value.kind !== 'infra-agent.terraform-local-module-summary'
    || value.schemaVersion !== 1
    || value.mutationAllowed !== false
    || typeof value.callName !== 'string'
    || typeof value.modulePath !== 'string'
    || SECRET_PATH_PATTERN.test(value.callName)
    || SECRET_PATH_PATTERN.test(value.modulePath)
  ) {
    return null;
  }

  const inputs = Array.isArray(value.inputs)
    ? value.inputs.map(asTerraformLocalModuleInput)
      .filter((input): input is TerraformLocalModuleInputFactSource => Boolean(input))
    : [];
  const outputs = Array.isArray(value.outputs)
    ? value.outputs.map(asTerraformLocalModuleOutput)
      .filter((output): output is TerraformLocalModuleOutputFactSource => Boolean(output))
    : [];

  return {
    callName: value.callName,
    modulePath: value.modulePath,
    callSourcePaths: asStringArray(value.callSourcePaths),
    moduleSourcePaths: asStringArray(value.moduleSourcePaths),
    inputs,
    outputs
  };
}

function moduleFactPath(callName: string, group: 'inputs' | 'outputs' | 'source', name?: string): string {
  const safeCallName = callName.replace(/[^A-Za-z0-9_.-]+/g, '_');
  if (group === 'source') {
    return `module.${safeCallName}.source`;
  }

  const safeName = (name ?? '').replace(/[^A-Za-z0-9_.-]+/g, '_');
  return `module.${safeCallName}.${group}.${safeName}`;
}

function relatedModulePaths(module: TerraformLocalModuleFactSource, sourcePath?: string): string[] {
  return Array.from(new Set([
    ...module.callSourcePaths,
    ...(sourcePath ? [sourcePath] : []),
    module.modulePath
  ])).filter(path => !SECRET_PATH_PATTERN.test(path)).sort();
}

function extractTerraformLocalModuleFacts(entry: KnowledgeCacheEntry): KnowledgeFact[] {
  try {
    const module = asTerraformLocalModuleFactSource(JSON.parse(entry.content) as unknown);
    if (!module) {
      return [];
    }

    const facts: KnowledgeFact[] = [{
      kind: 'argument',
      path: moduleFactPath(module.callName, 'source'),
      summary: `module.${module.callName} uses a local Terraform module source.`,
      values: [module.modulePath],
      required: true,
      confidence: 'high',
      extractionMethod: 'repo-local-static',
      source: factSource(entry, `module call: ${module.callName}.source`),
      relatedPaths: relatedModulePaths(module)
    }];

    for (const input of module.inputs) {
      if (facts.length >= MAX_TERRAFORM_MODULE_FACTS) {
        return facts;
      }

      const path = moduleFactPath(module.callName, 'inputs', input.name);
      const summary = input.required
        ? `${path} is required by the local Terraform module interface.`
        : `${path} is optional in the local Terraform module interface.`;
      if (SECRET_PATH_PATTERN.test(path) || SECRET_PATH_PATTERN.test(summary)) {
        continue;
      }

      facts.push({
        kind: 'module-input',
        path,
        summary: input.description ? `${summary} ${input.description}` : summary,
        required: input.required,
        ...(input.type ? { type: input.type } : {}),
        ...(input.defaultValue !== undefined ? { defaultValue: input.defaultValue } : {}),
        ...(input.values && input.values.length > 0 ? { values: input.values } : {}),
        confidence: 'high',
        extractionMethod: 'repo-local-static',
        source: factSource(entry, `${input.sourcePath}: variable.${input.name}`),
        relatedPaths: relatedModulePaths(module, input.sourcePath)
      });
    }

    for (const output of module.outputs) {
      if (facts.length >= MAX_TERRAFORM_MODULE_FACTS) {
        return facts;
      }

      const path = moduleFactPath(module.callName, 'outputs', output.name);
      const summary = `${path} is declared by the local Terraform module interface.`;
      if (SECRET_PATH_PATTERN.test(path) || SECRET_PATH_PATTERN.test(summary)) {
        continue;
      }

      facts.push({
        kind: 'module-output',
        path,
        summary: output.description ? `${summary} ${output.description}` : summary,
        confidence: 'high',
        extractionMethod: 'repo-local-static',
        source: factSource(entry, `${output.sourcePath}: output.${output.name}`),
        relatedPaths: relatedModulePaths(module, output.sourcePath)
      });
    }

    return facts;
  } catch {
    return [];
  }
}

function asPulumiConfigDeclaration(value: unknown): PulumiConfigDeclarationFactSource | null {
  if (!isRecord(value) || typeof value.key !== 'string' || typeof value.sourcePath !== 'string') {
    return null;
  }

  if (SECRET_PATH_PATTERN.test(value.key) || SECRET_PATH_PATTERN.test(value.sourcePath)) {
    return null;
  }

  return {
    key: value.key,
    sourcePath: value.sourcePath,
    ...(typeof value.type === 'string' && !SECRET_PATH_PATTERN.test(value.type) ? { type: value.type } : {}),
    ...(typeof value.defaultValue === 'string' && !SECRET_PATH_PATTERN.test(value.defaultValue)
      ? { defaultValue: value.defaultValue }
      : {})
  };
}

function asPulumiStackConfigValue(value: unknown): PulumiStackConfigValueFactSource | null {
  if (
    !isRecord(value)
    || typeof value.key !== 'string'
    || typeof value.sourcePath !== 'string'
    || typeof value.stackName !== 'string'
    || value.configured !== true
    || value.secure !== false
  ) {
    return null;
  }

  if (
    SECRET_PATH_PATTERN.test(value.key)
    || SECRET_PATH_PATTERN.test(value.sourcePath)
    || SECRET_PATH_PATTERN.test(value.stackName)
  ) {
    return null;
  }

  return {
    key: value.key,
    sourcePath: value.sourcePath,
    stackName: value.stackName,
    configured: true,
    secure: false,
    ...(typeof value.value === 'string' && !SECRET_PATH_PATTERN.test(value.value) ? { value: value.value } : {})
  };
}

function asPulumiConfigFactSource(value: unknown): PulumiConfigFactSource | null {
  if (
    !isRecord(value)
    || value.kind !== 'infra-agent.pulumi-config-summary'
    || value.schemaVersion !== 1
    || value.mutationAllowed !== false
    || typeof value.projectRoot !== 'string'
    || typeof value.projectFile !== 'string'
    || typeof value.projectName !== 'string'
    || SECRET_PATH_PATTERN.test(value.projectRoot)
    || SECRET_PATH_PATTERN.test(value.projectFile)
    || SECRET_PATH_PATTERN.test(value.projectName)
  ) {
    return null;
  }

  const declarations = Array.isArray(value.declarations)
    ? value.declarations.map(asPulumiConfigDeclaration)
      .filter((declaration): declaration is PulumiConfigDeclarationFactSource => Boolean(declaration))
    : [];
  const stackValues = Array.isArray(value.stackValues)
    ? value.stackValues.map(asPulumiStackConfigValue)
      .filter((stackValue): stackValue is PulumiStackConfigValueFactSource => Boolean(stackValue))
    : [];

  return {
    projectRoot: value.projectRoot,
    projectFile: value.projectFile,
    projectName: value.projectName,
    stackFiles: asStringArray(value.stackFiles).filter(path => !SECRET_PATH_PATTERN.test(path)),
    declarations,
    stackValues
  };
}

function pulumiConfigFactPath(key: string): string {
  return `config.${key}`;
}

function relatedPulumiConfigPaths(
  project: PulumiConfigFactSource,
  sourcePaths: string[]
): string[] {
  return Array.from(new Set([
    project.projectFile,
    ...sourcePaths
  ])).filter(path => !SECRET_PATH_PATTERN.test(path)).sort();
}

function extractPulumiConfigFacts(entry: KnowledgeCacheEntry): KnowledgeFact[] {
  try {
    const project = asPulumiConfigFactSource(JSON.parse(entry.content) as unknown);
    if (!project) {
      return [];
    }

    const declarationsByKey = new Map(project.declarations.map(declaration => [declaration.key, declaration]));
    const stackValuesByKey = new Map<string, PulumiStackConfigValueFactSource[]>();
    for (const stackValue of project.stackValues) {
      stackValuesByKey.set(stackValue.key, [
        ...(stackValuesByKey.get(stackValue.key) ?? []),
        stackValue
      ]);
    }

    const keys = Array.from(new Set([
      ...declarationsByKey.keys(),
      ...stackValuesByKey.keys()
    ])).sort();
    const facts: KnowledgeFact[] = [];
    for (const key of keys) {
      if (facts.length >= MAX_PULUMI_CONFIG_FACTS || SECRET_PATH_PATTERN.test(key)) {
        continue;
      }

      const declaration = declarationsByKey.get(key);
      const stackValues = stackValuesByKey.get(key) ?? [];
      const path = pulumiConfigFactPath(key);
      const values = Array.from(new Set(stackValues.map(value => value.value)
        .filter((value): value is string => Boolean(value) && !SECRET_PATH_PATTERN.test(value)))).sort();
      const relatedPaths = relatedPulumiConfigPaths(project, [
        ...(declaration ? [declaration.sourcePath] : []),
        ...stackValues.map(value => value.sourcePath)
      ]);
      const sourcePath = declaration?.sourcePath ?? stackValues[0]?.sourcePath ?? project.projectFile;
      const summary = declaration
        ? `${path} is declared by Pulumi project config.`
        : `${path} is configured in Pulumi stack config.`;

      if (SECRET_PATH_PATTERN.test(path) || SECRET_PATH_PATTERN.test(summary)) {
        continue;
      }

      facts.push({
        kind: 'pulumi-config-parameter',
        path,
        summary,
        ...(values.length > 0 ? { values } : {}),
        ...(declaration?.type ? { type: declaration.type } : {}),
        ...(declaration?.defaultValue !== undefined ? { defaultValue: declaration.defaultValue, required: false } : {}),
        confidence: 'high',
        extractionMethod: 'repo-local-static',
        source: factSource(entry, `${sourcePath}: config.${key}`),
        relatedPaths
      });
    }

    return facts;
  } catch {
    return [];
  }
}

function asHelmChartMetadataDependency(value: unknown): HelmChartMetadataDependencyFactSource | null {
  if (
    !isRecord(value)
    || typeof value.name !== 'string'
    || typeof value.sourcePath !== 'string'
    || typeof value.locked !== 'boolean'
  ) {
    return null;
  }

  if (SECRET_PATH_PATTERN.test(value.name) || SECRET_PATH_PATTERN.test(value.sourcePath)) {
    return null;
  }

  return {
    name: value.name,
    sourcePath: value.sourcePath,
    locked: value.locked,
    ...(typeof value.version === 'string' && !SECRET_PATH_PATTERN.test(value.version) ? { version: value.version } : {}),
    ...(typeof value.repository === 'string' && !SECRET_PATH_PATTERN.test(value.repository)
      ? { repository: value.repository }
      : {}),
    ...(typeof value.alias === 'string' && !SECRET_PATH_PATTERN.test(value.alias) ? { alias: value.alias } : {})
  };
}

function asHelmChartMetadataFactSource(value: unknown): HelmChartMetadataFactSource | null {
  if (
    !isRecord(value)
    || value.kind !== 'infra-agent.helm-chart-metadata-summary'
    || value.schemaVersion !== 1
    || value.mutationAllowed !== false
    || typeof value.chartRoot !== 'string'
    || typeof value.chartFile !== 'string'
    || typeof value.chartName !== 'string'
    || SECRET_PATH_PATTERN.test(value.chartRoot)
    || SECRET_PATH_PATTERN.test(value.chartFile)
    || SECRET_PATH_PATTERN.test(value.chartName)
  ) {
    return null;
  }

  const dependencies = Array.isArray(value.dependencies)
    ? value.dependencies.map(asHelmChartMetadataDependency)
      .filter((dependency): dependency is HelmChartMetadataDependencyFactSource => Boolean(dependency))
    : [];

  return {
    chartRoot: value.chartRoot,
    chartFile: value.chartFile,
    ...(typeof value.lockFile === 'string' && !SECRET_PATH_PATTERN.test(value.lockFile) ? { lockFile: value.lockFile } : {}),
    chartName: value.chartName,
    ...(typeof value.apiVersion === 'string' && !SECRET_PATH_PATTERN.test(value.apiVersion) ? { apiVersion: value.apiVersion } : {}),
    ...(typeof value.version === 'string' && !SECRET_PATH_PATTERN.test(value.version) ? { version: value.version } : {}),
    ...(typeof value.appVersion === 'string' && !SECRET_PATH_PATTERN.test(value.appVersion) ? { appVersion: value.appVersion } : {}),
    ...(typeof value.kubeVersion === 'string' && !SECRET_PATH_PATTERN.test(value.kubeVersion) ? { kubeVersion: value.kubeVersion } : {}),
    ...(typeof value.chartType === 'string' && !SECRET_PATH_PATTERN.test(value.chartType) ? { chartType: value.chartType } : {}),
    ...(typeof value.home === 'string' && !SECRET_PATH_PATTERN.test(value.home) ? { home: value.home } : {}),
    sources: asStringArray(value.sources).filter(source => !SECRET_PATH_PATTERN.test(source)),
    ...(typeof value.lockDigest === 'string' && !SECRET_PATH_PATTERN.test(value.lockDigest) ? { lockDigest: value.lockDigest } : {}),
    ...(typeof value.lockGenerated === 'string' && !SECRET_PATH_PATTERN.test(value.lockGenerated) ? { lockGenerated: value.lockGenerated } : {}),
    dependencies
  };
}

function helmChartMetadataPath(chartName: string, name: string): string {
  const safeChartName = chartName.replace(/[^A-Za-z0-9_.-]+/g, '_');
  return `chart.${safeChartName}.metadata.${name}`;
}

function helmChartDependencyPath(chartName: string, dependencyName: string): string {
  const safeChartName = chartName.replace(/[^A-Za-z0-9_.-]+/g, '_');
  const safeDependencyName = dependencyName.replace(/[^A-Za-z0-9_.-]+/g, '_');
  return `chart.${safeChartName}.dependencies.${safeDependencyName}`;
}

function relatedHelmMetadataPaths(chart: HelmChartMetadataFactSource, sourcePath?: string): string[] {
  return Array.from(new Set([
    chart.chartFile,
    ...(chart.lockFile ? [chart.lockFile] : []),
    ...(sourcePath ? [sourcePath] : [])
  ])).filter(path => !SECRET_PATH_PATTERN.test(path)).sort();
}

function pushHelmChartMetadataFact(params: {
  entry: KnowledgeCacheEntry;
  chart: HelmChartMetadataFactSource;
  name: string;
  value: string | undefined;
  facts: KnowledgeFact[];
}): void {
  if (
    params.facts.length >= MAX_HELM_CHART_METADATA_FACTS
    || !params.value
    || SECRET_PATH_PATTERN.test(params.name)
    || SECRET_PATH_PATTERN.test(params.value)
  ) {
    return;
  }

  const path = helmChartMetadataPath(params.chart.chartName, params.name);
  const summary = `chart.${params.chart.chartName} declares Helm chart ${params.name} ${params.value}.`;
  if (SECRET_PATH_PATTERN.test(path) || SECRET_PATH_PATTERN.test(summary)) {
    return;
  }

  params.facts.push({
    kind: 'chart-metadata',
    path,
    summary,
    values: [params.value],
    confidence: 'high',
    extractionMethod: 'repo-local-static',
    source: factSource(params.entry, `${params.chart.chartFile}: ${params.name}`),
    relatedPaths: relatedHelmMetadataPaths(params.chart, params.chart.chartFile)
  });
}

function extractHelmChartMetadataFacts(entry: KnowledgeCacheEntry): KnowledgeFact[] {
  try {
    const chart = asHelmChartMetadataFactSource(JSON.parse(entry.content) as unknown);
    if (!chart) {
      return [];
    }

    const facts: KnowledgeFact[] = [];
    const metadataFields: Array<[string, string | undefined]> = [
      ['name', chart.chartName],
      ['apiVersion', chart.apiVersion],
      ['version', chart.version],
      ['appVersion', chart.appVersion],
      ['kubeVersion', chart.kubeVersion],
      ['type', chart.chartType],
      ['home', chart.home],
      ['lockDigest', chart.lockDigest],
      ['lockGenerated', chart.lockGenerated]
    ];

    for (const [name, value] of metadataFields) {
      pushHelmChartMetadataFact({
        entry,
        chart,
        name,
        value,
        facts
      });
    }

    for (const source of chart.sources) {
      if (facts.length >= MAX_HELM_CHART_METADATA_FACTS || SECRET_PATH_PATTERN.test(source)) {
        continue;
      }

      const path = helmChartMetadataPath(chart.chartName, 'source');
      facts.push({
        kind: 'chart-metadata',
        path,
        summary: `chart.${chart.chartName} declares a safe source URL.`,
        values: [source],
        confidence: 'high',
        extractionMethod: 'repo-local-static',
        source: factSource(entry, `${chart.chartFile}: sources`),
        relatedPaths: relatedHelmMetadataPaths(chart, chart.chartFile)
      });
    }

    const dependenciesByName = new Map<string, HelmChartMetadataDependencyFactSource>();
    for (const dependency of chart.dependencies) {
      const existing = dependenciesByName.get(dependency.name);
      if (!existing || (!existing.locked && dependency.locked)) {
        dependenciesByName.set(dependency.name, dependency);
      }
    }

    for (const dependency of Array.from(dependenciesByName.values())
      .sort((left, right) => left.name.localeCompare(right.name))) {
      if (facts.length >= MAX_HELM_CHART_METADATA_FACTS || SECRET_PATH_PATTERN.test(dependency.name)) {
        continue;
      }

      const path = helmChartDependencyPath(chart.chartName, dependency.name);
      const values = [
        dependency.version ? `version=${dependency.version}` : undefined,
        dependency.repository ? `repository=${dependency.repository}` : undefined,
        dependency.alias ? `alias=${dependency.alias}` : undefined,
        dependency.locked ? 'locked=true' : 'locked=false'
      ].filter((value): value is string => Boolean(value) && !SECRET_PATH_PATTERN.test(value));
      const sourceLabel = dependency.locked ? 'locked' : 'declared';
      const summary = `chart.${chart.chartName} ${sourceLabel} Helm dependency ${dependency.name}.`;
      if (SECRET_PATH_PATTERN.test(path) || SECRET_PATH_PATTERN.test(summary)) {
        continue;
      }

      facts.push({
        kind: 'chart-dependency',
        path,
        summary,
        ...(values.length > 0 ? { values } : {}),
        confidence: 'high',
        extractionMethod: 'repo-local-static',
        source: factSource(entry, `${dependency.sourcePath}: dependencies.${dependency.name}`),
        relatedPaths: relatedHelmMetadataPaths(chart, dependency.sourcePath)
      });
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

    if (entry.source.kind === 'pulumi-docs' && entry.contentType === 'text/markdown') {
      return extractPulumiDocsMarkdownFacts(entry);
    }

    if (entry.source.kind === 'chart-schema' && entry.contentType === 'application/json') {
      return extractHelmValuesSchemaFacts(entry);
    }

    if (entry.source.kind === 'provider-schema' && entry.contentType === 'application/json') {
      return extractTerraformProviderSchemaFacts(entry);
    }

    if (entry.source.kind === 'terraform-module' && entry.contentType === 'application/json') {
      return extractTerraformLocalModuleFacts(entry);
    }

    if (entry.source.kind === 'pulumi-config' && entry.contentType === 'application/json') {
      return extractPulumiConfigFacts(entry);
    }

    if (entry.source.kind === 'chart-metadata' && entry.contentType === 'application/json') {
      return extractHelmChartMetadataFacts(entry);
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
    ...(sourceStale ? { sourceStaleReason: 'time-expired' } : {}),
    ...(entry.fingerprint !== undefined ? { sourceFingerprint: entry.fingerprint } : {}),
    extractedAt: options.extractedAt ?? new Date().toISOString(),
    factCount: facts.length,
    facts
  });
}
