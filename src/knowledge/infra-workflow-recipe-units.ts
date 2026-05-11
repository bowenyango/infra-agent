import type { AgentRuntimeState } from '../types/agent.ts';
import type { InfraDomainId } from '../types/repository.ts';
import type { KnowledgePackRecipeUnit, KnowledgePackSource, KnowledgePackUnit } from './pack.ts';

function isWorkflowRecipeUnit(unit: KnowledgePackUnit): boolean {
  return unit.unitType === 'recipe' && unit.extractionMethod === 'workflow-recipe';
}

function sourceForDomain(runtime: AgentRuntimeState, domain: InfraDomainId): KnowledgePackSource | null {
  const sources = runtime.knowledgeFacts?.sources ?? [];
  if (sources.length === 0) {
    return null;
  }

  const primaryPath = runtime.preflight.primaryTarget?.path;
  const domainSources = sources.filter(source => source.domain === domain);
  const candidateSources = domainSources.length > 0 ? domainSources : sources;

  return candidateSources.find(source => primaryPath && (
    source.targetPath === primaryPath
    || source.targetPath.startsWith(`${primaryPath}/`)
    || primaryPath.startsWith(`${source.targetPath}/`)
  ))
    ?? candidateSources[0]
    ?? null;
}

function recipeForDomain(domain: InfraDomainId, source: KnowledgePackSource): KnowledgePackRecipeUnit {
  switch (domain) {
    case 'terraform':
      return {
        unitType: 'recipe',
        path: source.targetPath || 'terraform',
        summary: 'Terraform rename and exclusive identity workflow.',
        confidence: 'medium',
        extractionMethod: 'workflow-recipe',
        sourceId: source.id,
        sourceLocator: 'recipe:terraform-rename-review',
        privacyScope: 'workspace-private',
        name: 'Review Terraform rename and identity-safe changes',
        steps: [
          'Inspect plan delete/create pairs for logical renames before editing resource content.',
          'Prefer Terraform moved blocks, import/state review, or address-preserving edits for renames.',
          'Review exclusive identity fields such as names, routes, listener priorities, DNS aliases, and security group rules before applying.'
        ],
        requiresApproval: true,
        mutationAllowed: false
      };
    case 'pulumi':
      return {
        unitType: 'recipe',
        path: source.targetPath || 'pulumi',
        summary: 'Pulumi rename, alias, and stack config workflow.',
        confidence: 'medium',
        extractionMethod: 'workflow-recipe',
        sourceId: source.id,
        sourceLocator: 'recipe:pulumi-rename-stack-config-review',
        privacyScope: 'workspace-private',
        name: 'Review Pulumi rename and stack config changes',
        steps: [
          'Inspect preview replacements for logical renames before changing resource definitions.',
          'Use Pulumi aliases or import/state review for logical renames that keep the same physical resource.',
          'Use the native pulumi_config_set tool for bounded stack config changes when approval allows native stack config writes.'
        ],
        requiresApproval: true,
        mutationAllowed: false
      };
    case 'helm':
      return {
        unitType: 'recipe',
        path: source.targetPath || 'helm',
        summary: 'Helm values and rendered manifest workflow.',
        confidence: 'medium',
        extractionMethod: 'workflow-recipe',
        sourceId: source.id,
        sourceLocator: 'recipe:helm-values-render-review',
        privacyScope: 'workspace-private',
        name: 'Review Helm values migration and rendered output',
        steps: [
          'Inspect values schema and chart metadata before changing templates.',
          'Prefer values.yaml updates for configurable chart behavior before template rewrites.',
          'Run helm template or the selected Helm validator to confirm rendered manifests after edits.'
        ],
        requiresApproval: false,
        mutationAllowed: false
      };
  }
}

function selectedRecipeDomains(runtime: AgentRuntimeState): InfraDomainId[] {
  const requestedDomains = runtime.preflight.requestedDomains.length > 0
    ? runtime.preflight.requestedDomains
    : runtime.knowledgeFacts?.requestedDomains ?? [];
  const knowledgeDomains = new Set((runtime.knowledgeFacts?.sources ?? []).map(source => source.domain));

  return requestedDomains.filter(domain => knowledgeDomains.has(domain));
}

export function syncInfraWorkflowRecipeKnowledgeUnits(runtime: AgentRuntimeState): AgentRuntimeState {
  if (!runtime.knowledgeFacts) {
    return runtime;
  }

  const previousRecipes = runtime.knowledgeFacts.units.filter(isWorkflowRecipeUnit);
  const baseUnits = runtime.knowledgeFacts.units.filter(unit => !isWorkflowRecipeUnit(unit));
  const baseUnitCount = Math.max(0, runtime.knowledgeFacts.unitCount - previousRecipes.length);
  const recipeUnits = selectedRecipeDomains(runtime)
    .map(domain => {
      const source = sourceForDomain(runtime, domain);
      return source ? recipeForDomain(domain, source) : null;
    })
    .filter((unit): unit is KnowledgePackRecipeUnit => unit !== null);
  const units = [...baseUnits, ...recipeUnits];
  const unitCount = baseUnitCount + recipeUnits.length;

  return {
    ...runtime,
    knowledgeFacts: {
      ...runtime.knowledgeFacts,
      unitCount,
      includedUnitCount: units.length,
      omittedUnitCount: Math.max(0, unitCount - units.length),
      units
    }
  };
}
