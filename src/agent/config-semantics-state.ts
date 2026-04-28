import type { AgentRuntimeState, ValidationIssue } from '../types/agent.ts';
import type { ConfigSemanticFact, ConfigSemanticsSummary } from '../types/config-semantics.ts';

function factKey(fact: ConfigSemanticFact): string {
  return JSON.stringify({
    kind: fact.kind,
    path: fact.path,
    source: fact.source,
    values: fact.values,
    relatedPaths: fact.relatedPaths
  });
}

export function getRuntimeConfigSemantics(runtime: AgentRuntimeState): ConfigSemanticsSummary[] {
  return runtime.configSemantics ?? runtime.preflight.inspection.configSemantics;
}

export function mergeConfigSemantics(
  baseSummaries: ConfigSemanticsSummary[],
  additionalSummaries: ConfigSemanticsSummary[]
): ConfigSemanticsSummary[] {
  const summaries = baseSummaries.map(summary => ({
    ...summary,
    facts: [...summary.facts]
  }));

  for (const additionalSummary of additionalSummaries) {
    let existingSummary = summaries.find(summary =>
      summary.targetKind === additionalSummary.targetKind
      && summary.targetPath === additionalSummary.targetPath
    );

    if (!existingSummary) {
      existingSummary = {
        targetKind: additionalSummary.targetKind,
        targetPath: additionalSummary.targetPath,
        facts: []
      };
      summaries.push(existingSummary);
    }

    const existingFactKeys = new Set(existingSummary.facts.map(factKey));
    for (const fact of additionalSummary.facts) {
      const key = factKey(fact);
      if (!existingFactKeys.has(key)) {
        existingSummary.facts.push(fact);
        existingFactKeys.add(key);
      }
    }
  }

  return summaries;
}

function findValidationTarget(runtime: AgentRuntimeState, issue: ValidationIssue): string | null {
  const matchingEntry = runtime.preflight.validation.plan.find(entry =>
    entry.kind === 'pulumi' && entry.commands.includes(issue.sourceCommand)
  );
  if (matchingEntry) {
    return matchingEntry.target;
  }

  const cwdMatch = issue.sourceCommand.match(/\bpulumi\b.*\s--cwd\s+([^\s]+)/);
  return cwdMatch?.[1] ?? null;
}

export function deriveConfigSemanticsFromValidationIssues(runtime: AgentRuntimeState): ConfigSemanticsSummary[] {
  const factsByTarget = new Map<string, ConfigSemanticFact[]>();

  for (const issue of runtime.validationIssues) {
    if (issue.kind !== 'pulumi-missing-config' || !issue.metadata?.missingConfigKey) {
      continue;
    }

    const targetPath = findValidationTarget(runtime, issue);
    if (!targetPath) {
      continue;
    }

    const facts = factsByTarget.get(targetPath) ?? [];
    facts.push({
      kind: 'required-field',
      path: `config.${issue.metadata.missingConfigKey}`,
      message: `Pulumi preview reported ${issue.metadata.missingConfigKey} as required.`,
      source: {
        kind: 'pulumi-preview',
        path: issue.sourceCommand
      },
      confidence: 'high'
    });
    factsByTarget.set(targetPath, facts);
  }

  return Array.from(factsByTarget.entries()).map(([targetPath, facts]) => ({
    targetKind: 'pulumi-project',
    targetPath,
    facts
  }));
}

export function refreshRuntimeConfigSemantics(runtime: AgentRuntimeState): ConfigSemanticsSummary[] {
  return mergeConfigSemantics(
    getRuntimeConfigSemantics(runtime),
    deriveConfigSemanticsFromValidationIssues(runtime)
  );
}
