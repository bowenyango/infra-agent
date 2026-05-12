import { knowledgeFactToFactUnit, parseKnowledgeUnitSet } from './knowledge-unit-contract.ts';
import { resolveKnowledgeStoragePolicy } from './storage-policy.ts';
import type {
  KnowledgeFact,
  KnowledgeFactSet,
  KnowledgeGuidanceUnit,
  KnowledgeExampleUnit,
  KnowledgeUnit,
  KnowledgeUnitExtractionMethod,
  KnowledgeUnitPrivacyScope,
  KnowledgeUnitSet
} from '../types/knowledge.ts';

const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;

function isPublicScope(privacyScope: KnowledgeUnitPrivacyScope): boolean {
  return privacyScope === 'public-reference';
}

function guidanceExtractionMethod(privacyScope: KnowledgeUnitPrivacyScope): KnowledgeUnitExtractionMethod {
  return isPublicScope(privacyScope) ? 'official-guidance' : 'repo-local-guidance';
}

function exampleExtractionMethod(privacyScope: KnowledgeUnitPrivacyScope): KnowledgeUnitExtractionMethod {
  return isPublicScope(privacyScope) ? 'official-example' : 'repo-local-example';
}

function compactText(value: string | undefined, fallback: string): string {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text || SECRET_VALUE_PATTERN.test(text)) {
    return fallback;
  }

  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

function safeValues(values: string[] | undefined): string[] | undefined {
  const safe = (values ?? [])
    .map(value => compactText(value, ''))
    .filter(value => value.length > 0 && !SECRET_VALUE_PATTERN.test(value))
    .slice(0, 6);

  return safe.length > 0 ? safe : undefined;
}

function topicFromPath(path: string, fallback: string): string {
  const topic = path.replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '');
  return topic.length > 0 && !SECRET_VALUE_PATTERN.test(topic) ? topic : fallback;
}

function tokenEstimateFor(...values: string[]): number {
  const chars = values.reduce((total, value) => total + value.length, 0);
  return Math.max(1, Math.ceil(chars / 4));
}

function languageForExample(fact: KnowledgeFact): string | undefined {
  if (fact.extractionMethod === 'terraform-registry-markdown') {
    return 'hcl';
  }
  if (fact.extractionMethod === 'helm-chart-docs-markdown') {
    return 'yaml';
  }
  if (fact.extractionMethod === 'pulumi-docs-markdown') {
    return 'typescript';
  }

  return undefined;
}

function exampleTypeForFact(fact: KnowledgeFact): string {
  if (fact.extractionMethod === 'terraform-registry-markdown') {
    return 'terraform-resource-snippet';
  }
  if (fact.extractionMethod === 'helm-chart-docs-markdown') {
    return 'helm-chart-example';
  }
  if (fact.extractionMethod === 'pulumi-docs-markdown') {
    return 'pulumi-docs-example';
  }

  return 'infra-example';
}

function exampleUnitFromFact(
  fact: KnowledgeFact,
  privacyScope: KnowledgeUnitPrivacyScope
): KnowledgeExampleUnit | null {
  if (fact.kind !== 'example') {
    return null;
  }

  const snippet = compactText(fact.values?.[0], '');
  if (!snippet) {
    return null;
  }

  return {
    unitType: 'example',
    path: fact.path,
    summary: fact.summary,
    confidence: fact.confidence,
    extractionMethod: exampleExtractionMethod(privacyScope),
    source: fact.source,
    privacyScope,
    tokenEstimate: tokenEstimateFor(fact.summary, snippet),
    exampleType: exampleTypeForFact(fact),
    snippet,
    ...(languageForExample(fact) ? { language: languageForExample(fact) } : {}),
    appliesWhen: ['Need a compact source-backed usage pattern.']
  };
}

function guidanceUnitFromFact(
  fact: KnowledgeFact,
  privacyScope: KnowledgeUnitPrivacyScope
): KnowledgeGuidanceUnit | null {
  if (fact.kind === 'pulumi-docs-guidance') {
    const values = safeValues(fact.values);
    return {
      unitType: 'guidance',
      path: `guidance.${fact.path}`,
      summary: fact.summary,
      confidence: fact.confidence,
      extractionMethod: guidanceExtractionMethod(privacyScope),
      source: fact.source,
      privacyScope,
      tokenEstimate: tokenEstimateFor(fact.summary, ...(values ?? [])),
      topic: topicFromPath(fact.path, 'pulumi-docs-guidance'),
      ...(values ? { appliesWhen: values } : {})
    };
  }

  if (fact.kind === 'identity-field') {
    return {
      unitType: 'guidance',
      path: `guidance.identity.${fact.path}`,
      summary: `${fact.path} participates in provider identity; review rename, import, state, or alias handling before replacement-style edits.`,
      confidence: fact.confidence,
      extractionMethod: guidanceExtractionMethod(privacyScope),
      source: fact.source,
      privacyScope,
      tokenEstimate: tokenEstimateFor(fact.summary, fact.path),
      topic: 'provider-identity-field',
      appliesWhen: ['logical renames', 'create-before-delete conflicts', 'import or state repair review'],
      risk: 'Changing identity fields can cause duplicate remote object conflicts or unintended replacement.'
    };
  }

  if (fact.kind === 'replacement-sensitive-field') {
    return {
      unitType: 'guidance',
      path: `guidance.replacement.${fact.path}`,
      summary: `${fact.path} is replacement-sensitive; inspect plan or preview replacement intent before changing it.`,
      confidence: fact.confidence,
      extractionMethod: guidanceExtractionMethod(privacyScope),
      source: fact.source,
      privacyScope,
      tokenEstimate: tokenEstimateFor(fact.summary, fact.path),
      topic: 'replacement-sensitive-field',
      appliesWhen: ['plan or preview replacement review', 'provider identity changes'],
      risk: 'Replacement-sensitive fields can turn a content edit into delete/create infrastructure changes.'
    };
  }

  return null;
}

function generatedUnitsForFact(
  fact: KnowledgeFact,
  privacyScope: KnowledgeUnitPrivacyScope
): KnowledgeUnit[] {
  return [
    exampleUnitFromFact(fact, privacyScope),
    guidanceUnitFromFact(fact, privacyScope)
  ].filter((unit): unit is KnowledgeUnit => unit !== null);
}

function dedupeUnits(units: KnowledgeUnit[]): KnowledgeUnit[] {
  const seen = new Set<string>();
  const deduped: KnowledgeUnit[] = [];

  for (const unit of units) {
    const key = `${unit.unitType}:${unit.path}:${unit.summary}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(unit);
    }
  }

  return deduped;
}

export function extractKnowledgeUnitSetFromFactSet(factSet: KnowledgeFactSet): KnowledgeUnitSet {
  const privacyScope = resolveKnowledgeStoragePolicy(factSet.source).scope;
  const units = dedupeUnits([
    ...factSet.facts.map(fact => knowledgeFactToFactUnit(fact, privacyScope)),
    ...factSet.facts.flatMap(fact => generatedUnitsForFact(fact, privacyScope))
  ]);
  const unitSet = {
    kind: 'infra-agent.knowledge-units',
    schemaVersion: 1,
    mutationAllowed: false,
    sourceId: factSet.sourceId,
    source: factSet.source,
    sourceContentHash: factSet.sourceContentHash,
    extractedAt: factSet.extractedAt,
    unitCount: units.length,
    units
  } satisfies KnowledgeUnitSet;

  return parseKnowledgeUnitSet(unitSet);
}
