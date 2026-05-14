import type { AgentRuntimeState } from '../types/agent.ts';
import type { ValidationPlanEntry } from '../types/repository.ts';
import type { KnowledgePackUnit } from '../knowledge/pack.ts';
import { knowledgeUnitIncludesText } from './knowledge-unit-text.ts';

const HELM_TEMPLATE_UNIT_PATTERN = /\bhelm\s+template\b|\brender(?:s|ed|ing)?\b|\bmanifest(?:s)?\b|\bservice\.port\b|\bingress\.enabled\b|\bvalues?\s+render(?:s|ed|ing)?\b|\brender(?:s|ed|ing)?\s+values?\b/i;
const HELM_LINT_UNIT_PATTERN = /\bhelm\s+lint\b|\bchart\s+lint\b|\bvalues?\s+lint\b|\bschema\b/i;
const HELM_SOURCE_FALLBACK_PATTERN = /\bhelm\b|\bchart\b|\bvalues\.ya?ml\b/i;
const HELM_TEMPLATE_COMMAND_PATTERN = /(?:^|\s)helm\s+template(?:\s|$)/i;
const HELM_LINT_COMMAND_PATTERN = /(?:^|\s)helm\s+lint(?:\s|$)/i;

interface HelmValidationCommandPreference {
  template: boolean;
  lint: boolean;
}

function isHelmValidationKnowledgeUnit(runtime: AgentRuntimeState, unit: KnowledgePackUnit): boolean {
  if (unit.unitType === 'diagnostic' && unit.engine === 'helm') {
    return true;
  }

  const source = runtime.knowledgeFacts?.sources.find(candidate => candidate.id === unit.sourceId);
  if (source !== undefined) {
    return source.domain === 'helm';
  }

  return knowledgeUnitIncludesText(unit, HELM_SOURCE_FALLBACK_PATTERN);
}

function isValidationCommandPriorityUnit(unit: KnowledgePackUnit): boolean {
  return unit.unitType === 'diagnostic'
    || unit.unitType === 'recipe'
    || unit.unitType === 'guidance'
    || unit.unitType === 'example';
}

function resolveHelmValidationCommandPreference(runtime: AgentRuntimeState): HelmValidationCommandPreference {
  const preference: HelmValidationCommandPreference = {
    template: false,
    lint: false
  };

  for (const unit of runtime.knowledgeFacts?.units ?? []) {
    if (!isValidationCommandPriorityUnit(unit) || !isHelmValidationKnowledgeUnit(runtime, unit)) {
      continue;
    }

    if (knowledgeUnitIncludesText(unit, HELM_TEMPLATE_UNIT_PATTERN)) {
      preference.template = true;
    }

    if (knowledgeUnitIncludesText(unit, HELM_LINT_UNIT_PATTERN)) {
      preference.lint = true;
    }
  }

  return preference;
}

function validationCommandPriority(command: string, preference: HelmValidationCommandPreference): number {
  if (preference.template && HELM_TEMPLATE_COMMAND_PATTERN.test(command)) {
    return 0;
  }

  if (preference.lint && HELM_LINT_COMMAND_PATTERN.test(command)) {
    return preference.template ? 1 : 0;
  }

  return 2;
}

function topTargetByKind(runtime: AgentRuntimeState): Record<'helm' | 'pulumi' | 'terraform', string | null> {
  return {
    helm: runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'helm-chart')?.path ?? null,
    pulumi: runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'pulumi-project')?.path ?? null,
    terraform: runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'terraform-root')?.path ?? null
  };
}

export function selectValidationPlanEntries(runtime: AgentRuntimeState): ValidationPlanEntry[] {
  const profileId = runtime.preflight.profile.id;
  const allowedDomains = new Set(
    runtime.preflight.requestedDomains.length > 0
      ? runtime.preflight.requestedDomains
      : runtime.preflight.targetCandidates[0]?.kind === 'helm-chart'
        ? ['helm']
        : runtime.preflight.targetCandidates[0]?.kind === 'pulumi-project'
          ? ['pulumi']
          : runtime.preflight.targetCandidates[0]?.kind === 'terraform-root'
            ? ['terraform']
            : []
  );
  const topTargets = topTargetByKind(runtime);

  return runtime.preflight.validation.plan.filter(entry => {
    if (profileId === 'scrawlr-infra-apps' && entry.kind !== 'helm') {
      return false;
    }

    if (profileId === 'scrawlr-infra-cloud' && entry.kind !== 'pulumi') {
      return false;
    }

    if (allowedDomains.size > 0 && !allowedDomains.has(entry.kind)) {
      return false;
    }

    if (entry.kind === 'helm') {
      return entry.target === topTargets.helm;
    }

    if (entry.kind === 'pulumi') {
      return entry.target === topTargets.pulumi;
    }

    if (entry.kind === 'terraform') {
      return entry.target === topTargets.terraform;
    }

    return false;
  });
}

export function selectValidationCommands(runtime: AgentRuntimeState): string[] {
  const commands = selectValidationPlanEntries(runtime).flatMap(entry => entry.commands);
  const preference = resolveHelmValidationCommandPreference(runtime);

  if (!preference.template && !preference.lint) {
    return commands.slice(0, 6);
  }

  return commands
    .map((command, index) => ({
      command,
      index,
      priority: validationCommandPriority(command, preference)
    }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(entry => entry.command)
    .slice(0, 6);
}
