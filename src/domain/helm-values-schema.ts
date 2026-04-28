import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ConfigSemanticFact, ConfigSemanticSource, ConfigSemanticsSummary } from '../types/config-semantics.ts';
import type { HelmChartSummary } from '../types/repository.ts';

interface JsonSchemaObject {
  type?: string | string[];
  properties?: Record<string, JsonSchemaObject>;
  required?: string[];
  enum?: unknown[];
  default?: unknown;
  oneOf?: JsonSchemaObject[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toJsonSchemaObject(value: unknown): JsonSchemaObject | null {
  return isRecord(value) ? value as JsonSchemaObject : null;
}

function joinConfigPath(basePath: string, fieldName: string): string {
  return basePath.length > 0 ? `${basePath}.${fieldName}` : fieldName;
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value) ?? String(value);
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

function collectSchemaFacts(
  schema: JsonSchemaObject,
  basePath: string,
  source: ConfigSemanticSource,
  facts: ConfigSemanticFact[]
): void {
  for (const requiredField of schema.required ?? []) {
    const fieldPath = joinConfigPath(basePath, requiredField);
    facts.push(buildFact({
      kind: 'required-field',
      path: fieldPath,
      message: `${fieldPath} is required by Helm values schema.`,
      source
    }));
  }

  if (schema.enum && schema.enum.length > 0) {
    facts.push(buildFact({
      kind: 'enum',
      path: basePath || '.',
      message: `${basePath || 'value'} must be one of the values allowed by Helm values schema.`,
      source,
      values: schema.enum.map(stringifyValue)
    }));
  }

  if (Object.prototype.hasOwnProperty.call(schema, 'default')) {
    facts.push(buildFact({
      kind: 'defaulted-field',
      path: basePath || '.',
      message: `${basePath || 'value'} has a default in Helm values schema.`,
      source,
      values: [stringifyValue(schema.default)]
    }));
  }

  if (schema.oneOf && schema.oneOf.length > 0) {
    const relatedPaths = schema.oneOf
      .flatMap(candidate => candidate.required ?? [])
      .map(field => joinConfigPath(basePath, field));
    facts.push(buildFact({
      kind: 'exactly-one-group',
      path: basePath || '.',
      message: `${basePath || 'value'} has a oneOf constraint in Helm values schema.`,
      source,
      relatedPaths: Array.from(new Set(relatedPaths))
    }));
  }

  for (const [fieldName, childSchema] of Object.entries(schema.properties ?? {})) {
    const childPath = joinConfigPath(basePath, fieldName);
    collectSchemaFacts(childSchema, childPath, source, facts);
  }
}

export async function extractHelmValuesSchemaSemantics(
  workspaceRoot: string,
  chart: HelmChartSummary
): Promise<ConfigSemanticsSummary | null> {
  if (!chart.valuesSchemaFile) {
    return null;
  }

  const schemaPath = join(workspaceRoot, chart.valuesSchemaFile);
  let rawSchema: unknown;
  try {
    rawSchema = JSON.parse(await readFile(schemaPath, 'utf8')) as unknown;
  } catch {
    return null;
  }

  const schema = toJsonSchemaObject(rawSchema);
  if (!schema) {
    return null;
  }

  const source: ConfigSemanticSource = {
    kind: 'helm-values-schema',
    path: chart.valuesSchemaFile
  };
  const facts: ConfigSemanticFact[] = [];
  collectSchemaFacts(schema, '', source, facts);

  return {
    targetKind: 'helm-chart',
    targetPath: chart.chartRoot,
    facts
  };
}

export async function extractHelmValuesSchemaSemanticsForCharts(
  workspaceRoot: string,
  charts: HelmChartSummary[]
): Promise<ConfigSemanticsSummary[]> {
  const summaries: ConfigSemanticsSummary[] = [];

  for (const chart of charts) {
    const summary = await extractHelmValuesSchemaSemantics(workspaceRoot, chart);
    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries;
}
