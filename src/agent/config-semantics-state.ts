import type { AgentRuntimeState, ValidationIssue } from '../types/agent.ts';
import type { KnowledgePackSource, KnowledgePackUnit } from '../knowledge/pack.ts';
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
  return mergeConfigSemantics(
    runtime.configSemantics ?? runtime.preflight.inspection.configSemantics,
    deriveConfigSemanticsFromKnowledgeUnits(runtime)
  );
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

function normalizeHelmKnowledgePath(path: string): string | null {
  if (path.startsWith('values.')) {
    return path.slice('values.'.length);
  }

  if (!path.startsWith('chart.')) {
    return null;
  }

  const parts = path.split('.');
  if (parts.length >= 3) {
    return parts.slice(2).join('.');
  }

  if (parts.length === 2) {
    return parts[1] ?? null;
  }

  return null;
}

function normalizePulumiKnowledgePath(path: string): string | null {
  if (path.startsWith('config.')) {
    return path;
  }

  const prefixes = [
    'pulumi.config.',
    'pulumi.project.config.',
    'pulumi.stack.config.'
  ];
  for (const prefix of prefixes) {
    if (path.startsWith(prefix)) {
      return `config.${path.slice(prefix.length)}`;
    }
  }

  return null;
}

function targetPathForKnowledgeUnit(
  source: KnowledgePackSource,
  runtime: AgentRuntimeState
): string | null {
  const targetPaths = runtime.knowledgeFacts?.targetPaths ?? [];

  if (source.targetPath) {
    if (targetPaths.length > 0 && !targetPaths.includes(source.targetPath)) {
      return null;
    }

    return source.targetPath;
  }

  if (targetPaths.length === 1) {
    return targetPaths[0] ?? null;
  }

  return null;
}

function factKindForKnowledgeUnit(unit: Extract<KnowledgePackUnit, { unitType: 'fact' }>): ConfigSemanticFact['kind'] | null {
  if (unit.required === true) {
    return 'required-field';
  }

  if (unit.values && unit.values.length > 0) {
    return 'enum';
  }

  if (unit.type) {
    return 'type-constraint';
  }

  if (Object.prototype.hasOwnProperty.call(unit, 'defaultValue')) {
    return 'defaulted-field';
  }

  return null;
}

function valuesForKnowledgeUnit(unit: Extract<KnowledgePackUnit, { unitType: 'fact' }>): string[] | undefined {
  if (unit.values && unit.values.length > 0) {
    return unit.values;
  }

  if (unit.type) {
    return [unit.type];
  }

  if (Object.prototype.hasOwnProperty.call(unit, 'defaultValue') && unit.defaultValue !== undefined) {
    return [unit.defaultValue];
  }

  return undefined;
}

function targetKindForKnowledgeUnit(
  unit: Extract<KnowledgePackUnit, { unitType: 'fact' }>,
  source: KnowledgePackSource
): ConfigSemanticsSummary['targetKind'] | null {
  if (unit.path.startsWith('values.') || unit.path.startsWith('chart.')) {
    return source.domain === 'helm' ? 'helm-chart' : null;
  }

  if (unit.path.startsWith('config.') || unit.path.startsWith('pulumi.')) {
    return source.domain === 'pulumi' ? 'pulumi-project' : null;
  }

  return null;
}

export function deriveConfigSemanticsFromKnowledgeUnits(runtime: AgentRuntimeState): ConfigSemanticsSummary[] {
  const knowledgeFacts = runtime.knowledgeFacts;
  if (!knowledgeFacts) {
    return [];
  }

  const sourceById = new Map(knowledgeFacts.sources.map(source => [source.id, source]));
  const factsByTarget = new Map<string, {
    targetKind: ConfigSemanticsSummary['targetKind'];
    facts: ConfigSemanticFact[];
  }>();

  for (const unit of knowledgeFacts.units) {
    if (unit.unitType !== 'fact') {
      continue;
    }

    const source = sourceById.get(unit.sourceId);
    if (!source) {
      continue;
    }

    const targetPath = targetPathForKnowledgeUnit(source, runtime);
    if (!targetPath) {
      continue;
    }

    const targetKind = targetKindForKnowledgeUnit(unit, source);
    if (!targetKind) {
      continue;
    }

    const path = targetKind === 'helm-chart'
      ? normalizeHelmKnowledgePath(unit.path)
      : normalizePulumiKnowledgePath(unit.path);
    const kind = factKindForKnowledgeUnit(unit);
    if (!path || !kind) {
      continue;
    }

    const entryKey = `${targetKind}\0${targetPath}`;
    const entry = factsByTarget.get(entryKey) ?? { targetKind, facts: [] };
    entry.facts.push({
      kind,
      path,
      message: unit.summary,
      source: {
        kind: 'knowledge-unit',
        path: unit.sourceLocator
      },
      confidence: unit.confidence,
      values: valuesForKnowledgeUnit(unit),
      relatedPaths: unit.relatedPaths
    });
    factsByTarget.set(entryKey, entry);
  }

  return Array.from(factsByTarget.entries()).map(([key, entry]) => ({
    targetKind: entry.targetKind,
    targetPath: key.split('\0')[1] ?? '',
    facts: entry.facts
  }));
}

export function refreshRuntimeConfigSemantics(runtime: AgentRuntimeState): ConfigSemanticsSummary[] {
  return mergeConfigSemantics(
    getRuntimeConfigSemantics(runtime),
    deriveConfigSemanticsFromValidationIssues(runtime)
  );
}
