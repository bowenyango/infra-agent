import { knowledgeFactToFactUnit, parseKnowledgeUnitSet } from './knowledge-unit-contract.ts';
import { resolveKnowledgeStoragePolicy } from './storage-policy.ts';
import type {
  KnowledgeFact,
  KnowledgeFactSet,
  KnowledgeDiagnosticUnit,
  KnowledgeGuidanceUnit,
  KnowledgeExampleUnit,
  KnowledgeRecipeUnit,
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

function requiredInputGuidanceFromFact(
  fact: KnowledgeFact,
  privacyScope: KnowledgeUnitPrivacyScope
): KnowledgeGuidanceUnit | null {
  if (fact.required !== true) {
    return null;
  }

  const supportedKinds = new Set<KnowledgeFact['kind']>([
    'argument',
    'nested-block',
    'module-input',
    'chart-value',
    'pulumi-component-input'
  ]);
  if (!supportedKinds.has(fact.kind)) {
    return null;
  }

  const topic = fact.kind === 'chart-value'
    ? 'required-helm-value'
    : fact.kind === 'module-input'
      ? 'required-terraform-module-input'
      : fact.kind === 'pulumi-component-input'
        ? 'required-pulumi-component-input'
        : 'required-provider-input';

  return {
    unitType: 'guidance',
    path: `guidance.required.${fact.path}`,
    summary: `${fact.path} is required; preserve or supply it before generating infrastructure edits.`,
    confidence: fact.confidence,
    extractionMethod: guidanceExtractionMethod(privacyScope),
    source: fact.source,
    privacyScope,
    tokenEstimate: tokenEstimateFor(fact.summary, fact.path),
    topic,
    appliesWhen: ['building bounded edit plans', 'repairing validation failures', 'checking required provider or chart inputs']
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

  return requiredInputGuidanceFromFact(fact, privacyScope);
}

function diagnosticUnitFromFact(
  fact: KnowledgeFact,
  privacyScope: KnowledgeUnitPrivacyScope
): KnowledgeDiagnosticUnit | null {
  if (fact.kind === 'identity-field') {
    return {
      unitType: 'diagnostic',
      path: `diagnostic.identity.${fact.path}`,
      summary: `${fact.path} can produce provider-exclusive identity conflicts when a logical rename is treated as replacement.`,
      confidence: fact.confidence,
      extractionMethod: 'provider-diagnostic',
      source: fact.source,
      privacyScope,
      tokenEstimate: tokenEstimateFor(fact.summary, fact.path),
      engine: 'provider',
      signature: `identity-field:${fact.path}`,
      likelyCause: `${fact.path} participates in remote object identity and may not coexist under create-before-delete semantics.`,
      recommendedReview: [
        'Confirm whether the change is a logical rename or a new physical object.',
        'Prefer moved blocks, aliases, import/state review, or address-preserving edits before replacement-style changes.'
      ]
    };
  }

  if (fact.kind === 'replacement-sensitive-field') {
    return {
      unitType: 'diagnostic',
      path: `diagnostic.replacement.${fact.path}`,
      summary: `${fact.path} is documented as replacement-sensitive and can explain plan or preview delete/create output.`,
      confidence: fact.confidence,
      extractionMethod: 'provider-diagnostic',
      source: fact.source,
      privacyScope,
      tokenEstimate: tokenEstimateFor(fact.summary, fact.path),
      engine: 'provider',
      signature: `replacement-sensitive-field:${fact.path}`,
      likelyCause: `Changing ${fact.path} can force replacement according to the extracted provider documentation.`,
      recommendedReview: [
        'Inspect plan or preview replacement reasons before editing the field.',
        'Prefer rename/import/state workflows when the physical object should be preserved.'
      ]
    };
  }

  if (fact.kind === 'chart-value' && fact.required === true) {
    return {
      unitType: 'diagnostic',
      path: `diagnostic.required-chart-value.${fact.path}`,
      summary: `${fact.path} is a required Helm chart value and can explain render or schema validation failures.`,
      confidence: fact.confidence,
      extractionMethod: 'provider-diagnostic',
      source: fact.source,
      privacyScope,
      tokenEstimate: tokenEstimateFor(fact.summary, fact.path),
      engine: 'helm',
      signature: `required-chart-value:${fact.path}`,
      likelyCause: `The selected chart requires ${fact.path}, but the rendered values may omit it or set it incorrectly.`,
      recommendedReview: [
        'Check values.yaml and environment override files for the required value.',
        'Run helm lint or helm template after applying the bounded values edit.'
      ]
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
    guidanceUnitFromFact(fact, privacyScope),
    diagnosticUnitFromFact(fact, privacyScope)
  ].filter((unit): unit is KnowledgeUnit => unit !== null);
}

function anchorFact(factSet: KnowledgeFactSet): KnowledgeFact | null {
  return factSet.facts.find(fact =>
    fact.kind === 'identity-field'
    || fact.kind === 'replacement-sensitive-field'
    || fact.kind === 'chart-value'
    || fact.kind === 'pulumi-config-parameter'
    || fact.kind === 'pulumi-component-input'
    || fact.kind === 'module-input'
  ) ?? factSet.facts[0] ?? null;
}

function terraformWorkflowRecipe(
  factSet: KnowledgeFactSet,
  privacyScope: KnowledgeUnitPrivacyScope,
  anchor: KnowledgeFact
): KnowledgeRecipeUnit | null {
  const terraformSource = factSet.source.kind === 'terraform-registry'
    || factSet.source.kind === 'provider-schema'
    || factSet.source.kind === 'terraform-module'
    || factSet.source.kind === 'module-readme';
  const hasRenameRisk = factSet.facts.some(fact =>
    fact.kind === 'identity-field' || fact.kind === 'replacement-sensitive-field'
  );
  if (!terraformSource || !hasRenameRisk) {
    return null;
  }

  return {
    unitType: 'recipe',
    path: `recipe.terraform.${topicFromPath(factSet.source.name, 'source')}.identity-safe-change`,
    summary: 'Terraform identity-safe edit workflow derived from provider or module knowledge.',
    confidence: hasRenameRisk ? 'medium' : anchor.confidence,
    extractionMethod: 'workflow-recipe',
    source: anchor.source,
    privacyScope,
    tokenEstimate: tokenEstimateFor(anchor.summary, factSet.source.name),
    name: 'Plan Terraform identity-sensitive edits',
    steps: [
      'Inspect plan output for delete/create pairs before changing identity or replacement-sensitive fields.',
      'Use moved blocks, import/state review, or address-preserving edits for logical renames.',
      'Rerun Terraform validation or plan after the bounded edit and review remaining replacements.'
    ],
    requiresApproval: true,
    mutationAllowed: false
  };
}

function helmWorkflowRecipe(
  factSet: KnowledgeFactSet,
  privacyScope: KnowledgeUnitPrivacyScope,
  anchor: KnowledgeFact
): KnowledgeRecipeUnit | null {
  const helmSource = factSet.source.kind === 'chart-schema'
    || factSet.source.kind === 'chart-docs'
    || factSet.source.kind === 'chart-metadata'
    || factSet.source.kind === 'chart-lock'
    || factSet.source.kind === 'helm-docs';
  const hasChartEvidence = factSet.facts.some(fact =>
    fact.kind === 'chart-value'
    || fact.kind === 'chart-dependency'
    || fact.kind === 'chart-metadata'
  );
  if (!helmSource || !hasChartEvidence) {
    return null;
  }

  return {
    unitType: 'recipe',
    path: `recipe.helm.${topicFromPath(factSet.source.name, 'chart')}.values-safe-change`,
    summary: 'Helm values-first edit workflow derived from chart schema, metadata, or docs.',
    confidence: anchor.confidence,
    extractionMethod: 'workflow-recipe',
    source: anchor.source,
    privacyScope,
    tokenEstimate: tokenEstimateFor(anchor.summary, factSet.source.name),
    name: 'Plan Helm values and rendered manifest edits',
    steps: [
      'Prefer values.yaml or environment override edits when chart behavior is configurable.',
      'Check required values, chart metadata, and dependencies before changing templates.',
      'Run helm lint or helm template for the selected chart after the bounded edit.'
    ],
    requiresApproval: false,
    mutationAllowed: false
  };
}

function pulumiWorkflowRecipe(
  factSet: KnowledgeFactSet,
  privacyScope: KnowledgeUnitPrivacyScope,
  anchor: KnowledgeFact
): KnowledgeRecipeUnit | null {
  const pulumiSource = factSet.source.kind === 'pulumi-docs'
    || factSet.source.kind === 'pulumi-config'
    || factSet.source.kind === 'pulumi-component';
  const hasPulumiEvidence = factSet.facts.some(fact =>
    fact.kind === 'pulumi-config-parameter'
    || fact.kind === 'pulumi-component-input'
    || fact.kind === 'pulumi-component-child-resource'
    || fact.kind === 'pulumi-docs-guidance'
  );
  if (!pulumiSource || !hasPulumiEvidence) {
    return null;
  }

  return {
    unitType: 'recipe',
    path: `recipe.pulumi.${topicFromPath(factSet.source.name, 'project')}.stack-safe-change`,
    summary: 'Pulumi stack-safe edit workflow derived from project config, component, or official docs knowledge.',
    confidence: anchor.confidence,
    extractionMethod: 'workflow-recipe',
    source: anchor.source,
    privacyScope,
    tokenEstimate: tokenEstimateFor(anchor.summary, factSet.source.name),
    name: 'Plan Pulumi stack config and resource edits',
    steps: [
      'Inspect preview output for replacements before renaming resources or changing identity-like inputs.',
      'Use Pulumi aliases, import/state review, or native stack config writes when preserving existing resources.',
      'Rerun Pulumi preview after bounded edits and review any remaining replacements.'
    ],
    requiresApproval: true,
    mutationAllowed: false
  };
}

function generatedUnitsForFactSet(
  factSet: KnowledgeFactSet,
  privacyScope: KnowledgeUnitPrivacyScope
): KnowledgeUnit[] {
  const anchor = anchorFact(factSet);
  if (!anchor) {
    return [];
  }

  return [
    terraformWorkflowRecipe(factSet, privacyScope, anchor),
    helmWorkflowRecipe(factSet, privacyScope, anchor),
    pulumiWorkflowRecipe(factSet, privacyScope, anchor)
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

export function extractKnowledgeUnitSetFromFactSet(
  factSet: KnowledgeFactSet,
  extraUnits: KnowledgeUnit[] = []
): KnowledgeUnitSet {
  const privacyScope = resolveKnowledgeStoragePolicy(factSet.source).scope;
  const units = dedupeUnits([
    ...factSet.facts.map(fact => knowledgeFactToFactUnit(fact, privacyScope)),
    ...factSet.facts.flatMap(fact => generatedUnitsForFact(fact, privacyScope)),
    ...generatedUnitsForFactSet(factSet, privacyScope),
    ...extraUnits
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
