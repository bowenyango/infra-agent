import type { ConfigSemanticFact } from '../types/config-semantics.ts';
import type { WorkspaceInspection } from '../types/repository.ts';

export interface TerraformEnumMismatch {
  variablePath: string;
  requestedValue: string;
  allowedValues: string[];
  message: string;
}

function terraformVariablePath(variableName: string): string {
  return variableName.startsWith('var.') ? variableName : `var.${variableName}`;
}

export function normalizeTerraformEnvironmentValue(environment: string | null): string | null {
  if (!environment) {
    return null;
  }

  if (environment === 'development') {
    return 'dev';
  }

  if (environment === 'production') {
    return 'prod';
  }

  return environment;
}

function terraformFactsForRoot(inspection: WorkspaceInspection, rootPath: string): ConfigSemanticFact[] {
  return inspection.configSemantics
    .find(summary => summary.targetKind === 'terraform-root' && summary.targetPath === rootPath)
    ?.facts ?? [];
}

export function findTerraformVariableEnumFact(
  inspection: WorkspaceInspection,
  rootPath: string,
  variableNames: string[]
): ConfigSemanticFact | null {
  const paths = variableNames.map(terraformVariablePath);

  return terraformFactsForRoot(inspection, rootPath)
    .find(fact => fact.kind === 'enum' && paths.includes(fact.path)) ?? null;
}

export function findTerraformVariableTypeFact(
  inspection: WorkspaceInspection,
  rootPath: string,
  variableNames: string[]
): ConfigSemanticFact | null {
  const paths = variableNames.map(terraformVariablePath);

  return terraformFactsForRoot(inspection, rootPath)
    .find(fact => fact.kind === 'type-constraint' && paths.includes(fact.path)) ?? null;
}

export function findTerraformEnvironmentEnumFact(
  inspection: WorkspaceInspection,
  rootPath: string
): ConfigSemanticFact | null {
  const enumFacts = terraformFactsForRoot(inspection, rootPath)
    .filter(fact => fact.kind === 'enum' && fact.path.startsWith('var.'));

  return enumFacts.find(fact => /^var\.environment$/i.test(fact.path))
    ?? enumFacts.find(fact => /^var\.env$/i.test(fact.path))
    ?? enumFacts.find(fact => /environment/i.test(fact.path))
    ?? enumFacts.find(fact => /env/i.test(fact.path))
    ?? null;
}

export function buildTerraformEnumMismatch(
  fact: ConfigSemanticFact | null,
  requestedValue: string
): TerraformEnumMismatch | null {
  const allowedValues = fact?.values ?? [];
  if (!fact || allowedValues.length === 0 || allowedValues.includes(requestedValue)) {
    return null;
  }

  return {
    variablePath: fact.path,
    requestedValue,
    allowedValues,
    message: `${fact.path} allows ${allowedValues.join(', ')} but the requested value is ${requestedValue}.`
  };
}
