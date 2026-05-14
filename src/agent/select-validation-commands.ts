import type { AgentRuntimeState } from '../types/agent.ts';
import type { ValidationPlanEntry } from '../types/repository.ts';
import type { KnowledgePackUnit } from '../knowledge/pack.ts';
import { knowledgeUnitIncludesText } from './knowledge-unit-text.ts';

const HELM_TEMPLATE_UNIT_PATTERN = /\bhelm\s+template\b|\brender(?:s|ed|ing)?\b|\bmanifest(?:s)?\b|\bservice\.port\b|\bingress\.enabled\b|\bvalues?\s+render(?:s|ed|ing)?\b|\brender(?:s|ed|ing)?\s+values?\b/i;
const HELM_LINT_UNIT_PATTERN = /\bhelm\s+lint\b|\bchart\s+lint\b|\bvalues?\s+lint\b|\bschema\b/i;
const HELM_SOURCE_FALLBACK_PATTERN = /\bhelm\b|\bchart\b|\bvalues\.ya?ml\b/i;
const HELM_TEMPLATE_COMMAND_PATTERN = /(?:^|\s)helm\s+template(?:\s|$)/i;
const HELM_LINT_COMMAND_PATTERN = /(?:^|\s)helm\s+lint(?:\s|$)/i;
const TERRAFORM_PLAN_UNIT_PATTERN = /\bterraform\s+plan\b|\bmoved\s+blocks?\b|\brenam(?:e|es|ed|ing)\b|\bimport\b|\bstate\b|\bprevent\s+replacement\b|\breplacement\b|\bdestroy\s*\/\s*create\b|\bcreate\s*\/\s*destroy\b|\bdestroy\b.*\bcreate\b|\bcreate\b.*\bdestroy\b/i;
const TERRAFORM_VALIDATE_UNIT_PATTERN = /\bterraform\s+validate\b|\brequired\s+arguments?\b|\bschema\b|\binvalid\s+configuration\b|\bconfiguration\s+invalid\b/i;
const TERRAFORM_FMT_UNIT_PATTERN = /\bterraform\s+fmt\b|\bformat(?:ting)?\b/i;
const TERRAFORM_SOURCE_FALLBACK_PATTERN = /\bterraform\b|\b\.tfvars\b|\b\.tf\b/i;
const TERRAFORM_FMT_COMMAND_PATTERN = /(?:^|\s)terraform(?:\s+-[^\s]+)*\s+fmt(?:\s|$)/i;
const TERRAFORM_VALIDATE_COMMAND_PATTERN = /(?:^|\s)terraform(?:\s+-[^\s]+)*\s+validate(?:\s|$)/i;
const TERRAFORM_PLAN_COMMAND_PATTERN = /(?:^|\s)terraform(?:\s+-[^\s]+)*\s+plan(?:\s|$)/i;

interface HelmValidationCommandPreference {
  template: boolean;
  lint: boolean;
}

interface TerraformValidationCommandPreference {
  fmt: boolean;
  validate: boolean;
  plan: boolean;
}

interface ValidationCommandPreference {
  helm: HelmValidationCommandPreference;
  terraform: TerraformValidationCommandPreference;
}

function isHelmValidationKnowledgeUnit(runtime: AgentRuntimeState, unit: KnowledgePackUnit): boolean {
  if (unit.unitType === 'diagnostic' && unit.engine === 'helm') {
    return true;
  }

  const source = runtime.knowledgeFacts?.sources?.find(candidate => candidate.id === unit.sourceId);
  if (source !== undefined) {
    return source.domain === 'helm';
  }

  return knowledgeUnitIncludesText(unit, HELM_SOURCE_FALLBACK_PATTERN);
}

function isTerraformValidationKnowledgeUnit(runtime: AgentRuntimeState, unit: KnowledgePackUnit): boolean {
  if (unit.unitType === 'diagnostic' && unit.engine === 'terraform') {
    return true;
  }

  const source = runtime.knowledgeFacts?.sources?.find(candidate => candidate.id === unit.sourceId);
  if (source !== undefined) {
    return source.domain === 'terraform';
  }

  return knowledgeUnitIncludesText(unit, TERRAFORM_SOURCE_FALLBACK_PATTERN);
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

function resolveTerraformValidationCommandPreference(runtime: AgentRuntimeState): TerraformValidationCommandPreference {
  const preference: TerraformValidationCommandPreference = {
    fmt: false,
    validate: false,
    plan: false
  };

  for (const unit of runtime.knowledgeFacts?.units ?? []) {
    if (!isValidationCommandPriorityUnit(unit) || !isTerraformValidationKnowledgeUnit(runtime, unit)) {
      continue;
    }

    if (knowledgeUnitIncludesText(unit, TERRAFORM_FMT_UNIT_PATTERN)) {
      preference.fmt = true;
    }

    if (knowledgeUnitIncludesText(unit, TERRAFORM_VALIDATE_UNIT_PATTERN)) {
      preference.validate = true;
    }

    if (knowledgeUnitIncludesText(unit, TERRAFORM_PLAN_UNIT_PATTERN)) {
      preference.plan = true;
    }
  }

  return preference;
}

function resolveValidationCommandPreference(runtime: AgentRuntimeState): ValidationCommandPreference {
  return {
    helm: resolveHelmValidationCommandPreference(runtime),
    terraform: resolveTerraformValidationCommandPreference(runtime)
  };
}

function hasValidationCommandPreference(preference: ValidationCommandPreference): boolean {
  return preference.helm.template
    || preference.helm.lint
    || preference.terraform.fmt
    || preference.terraform.validate
    || preference.terraform.plan;
}

function validationCommandPriority(command: string, preference: ValidationCommandPreference): number {
  const preferredCommandPatterns: RegExp[] = [];

  if (preference.helm.template) {
    preferredCommandPatterns.push(HELM_TEMPLATE_COMMAND_PATTERN);
  }

  if (preference.helm.lint) {
    preferredCommandPatterns.push(HELM_LINT_COMMAND_PATTERN);
  }

  if (preference.terraform.fmt) {
    preferredCommandPatterns.push(TERRAFORM_FMT_COMMAND_PATTERN);
  }

  if (preference.terraform.validate) {
    preferredCommandPatterns.push(TERRAFORM_VALIDATE_COMMAND_PATTERN);
  }

  if (preference.terraform.plan) {
    preferredCommandPatterns.push(TERRAFORM_PLAN_COMMAND_PATTERN);
  }

  const priority = preferredCommandPatterns.findIndex(pattern => pattern.test(command));
  if (priority !== -1) {
    return priority;
  }

  return preferredCommandPatterns.length;
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
  const preference = resolveValidationCommandPreference(runtime);

  if (!hasValidationCommandPreference(preference)) {
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
