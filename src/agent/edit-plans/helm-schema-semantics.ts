import type { AgentRuntimeState } from '../../types/agent.ts';
import type { ConfigSemanticFact } from '../../types/config-semantics.ts';
import { getRuntimeConfigSemantics } from '../config-semantics-state.ts';

export interface HelmSemanticValueChoice {
  value: string;
  note: string | null;
}

function findHelmFacts(runtime: AgentRuntimeState, chartPath: string): ConfigSemanticFact[] {
  return getRuntimeConfigSemantics(runtime)
    .find(summary => summary.targetKind === 'helm-chart' && summary.targetPath === chartPath)
    ?.facts ?? [];
}

function findEnumFact(runtime: AgentRuntimeState, chartPath: string, valuePath: string): ConfigSemanticFact | null {
  return findHelmFacts(runtime, chartPath)
    .find(fact => fact.kind === 'enum' && fact.path === valuePath) ?? null;
}

export function chooseHelmEnumValue(
  runtime: AgentRuntimeState,
  chartPath: string,
  valuePath: string,
  preferredValue: string
): HelmSemanticValueChoice {
  const enumFact = findEnumFact(runtime, chartPath, valuePath);
  const allowedValues = enumFact?.values ?? [];
  if (allowedValues.length === 0 || allowedValues.includes(preferredValue)) {
    return {
      value: preferredValue,
      note: null
    };
  }

  const fallbackValue = allowedValues[0] ?? preferredValue;
  return {
    value: fallbackValue,
    note: `Selected ${valuePath}=${fallbackValue} because ${enumFact?.source.path ?? 'the Helm values schema'} allows ${allowedValues.join(', ')}.`
  };
}

export function summarizeHelmRequiredFacts(runtime: AgentRuntimeState, chartPath: string, valuePaths: string[]): string | null {
  const requiredFacts = findHelmFacts(runtime, chartPath)
    .filter(fact => fact.kind === 'required-field' && valuePaths.includes(fact.path));

  if (requiredFacts.length === 0) {
    return null;
  }

  return `Helm values schema marks ${requiredFacts.map(fact => fact.path).join(', ')} as required.`;
}
