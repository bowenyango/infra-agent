import type { AgentRuntimeState } from '../types/agent.ts';
import type { ValidationPlanEntry } from '../types/repository.ts';
import type { KnowledgePackUnit } from '../knowledge/pack.ts';
import { knowledgeUnitIncludesText, knowledgeUnitSearchText } from './knowledge-unit-text.ts';

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
const PULUMI_PREVIEW_UNIT_PATTERN = /\bpulumi\s+preview\b|\bstack\s+config(?:uration)?\b|\bmissing\s+config(?:uration)?\b|\balias(?:es)?\b|\bimport(?:ing)?\b|\bstate\s+repair\b|\brepair\s+state\b|\blogical\s+renam(?:e|es|ed|ing)\b/i;
const PULUMI_SOURCE_FALLBACK_PATTERN = /\bpulumi\b|\bPulumi\.[^/\s]+\.ya?ml\b|\bstack\s+config(?:uration)?\b/i;
const PULUMI_PREVIEW_COMMAND_PATTERN = /(?:^|\s)pulumi(?:\s+[^\s;&|]+)*\s+preview(?:\s|$)/i;
const PULUMI_STACK_OPTION_PATTERN = /(?:^|\s)(?:--stack|-s)(?:=|\s+)(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/gi;
const PULUMI_STACK_FILE_PATTERN = /\bPulumi\.([^/\s]+?)\.ya?ml\b/gi;
const PULUMI_STACK_TEXT_PATTERN = /\bstack\s+(?:name|ref(?:erence)?|id)?\s*[:=]?\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`|([A-Za-z0-9][A-Za-z0-9._/@:-]*))/gi;
const PULUMI_STACK_TEXT_STOP_WORDS = new Set([
  'config',
  'configuration',
  'commands',
  'command',
  'file',
  'files',
  'for',
  'in',
  'is',
  'name',
  'names',
  'preview',
  'previews',
  'reference',
  'references',
  'ref',
  'repair',
  'selected',
  'state',
  'the',
  'to',
  'value',
  'values',
  'with'
]);

interface HelmValidationCommandPreference {
  template: boolean;
  lint: boolean;
}

interface TerraformValidationCommandPreference {
  fmt: boolean;
  validate: boolean;
  plan: boolean;
}

interface PulumiValidationCommandPreference {
  preview: boolean;
  stackRefs: string[];
}

interface ValidationCommandPreference {
  helm: HelmValidationCommandPreference;
  pulumi: PulumiValidationCommandPreference;
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

function isPulumiValidationKnowledgeUnit(runtime: AgentRuntimeState, unit: KnowledgePackUnit): boolean {
  if (unit.unitType === 'diagnostic' && unit.engine === 'pulumi') {
    return true;
  }

  const source = runtime.knowledgeFacts?.sources?.find(candidate => candidate.id === unit.sourceId);
  if (source !== undefined) {
    return source.domain === 'pulumi';
  }

  return knowledgeUnitIncludesText(unit, PULUMI_SOURCE_FALLBACK_PATTERN);
}

function isValidationCommandPriorityUnit(unit: KnowledgePackUnit): boolean {
  return unit.unitType === 'diagnostic'
    || unit.unitType === 'recipe'
    || unit.unitType === 'guidance'
    || unit.unitType === 'example';
}

function normalizePulumiStackRef(ref: string): string | null {
  const normalized = ref
    .trim()
    .replace(/^[`'"]+|[`'",.;:)\\\]}]+$/g, '')
    .toLowerCase();

  return normalized.length > 0 ? normalized : null;
}

function addPulumiStackRefVariants(stackRefs: Set<string>, ref: string): void {
  const normalized = normalizePulumiStackRef(ref);
  if (normalized === null || PULUMI_STACK_TEXT_STOP_WORDS.has(normalized)) {
    return;
  }

  stackRefs.add(normalized);

  const stackName = normalized.split('/').filter(Boolean).at(-1);
  if (stackName !== undefined && !PULUMI_STACK_TEXT_STOP_WORDS.has(stackName)) {
    stackRefs.add(stackName);
  }
}

function firstMatchGroup(match: RegExpExecArray): string | undefined {
  return match.slice(1).find(value => value !== undefined);
}

function extractPulumiStackRefsFromText(text: string): string[] {
  const stackRefs = new Set<string>();
  const patterns = [
    PULUMI_STACK_OPTION_PATTERN,
    PULUMI_STACK_FILE_PATTERN,
    PULUMI_STACK_TEXT_PATTERN
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;

    for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
      const ref = firstMatchGroup(match);
      if (ref !== undefined) {
        addPulumiStackRefVariants(stackRefs, ref);
      }
    }
  }

  return [...stackRefs];
}

function extractPulumiStackRefsFromCommand(command: string): string[] {
  const stackRefs = new Set<string>();
  PULUMI_STACK_OPTION_PATTERN.lastIndex = 0;

  for (let match = PULUMI_STACK_OPTION_PATTERN.exec(command); match !== null; match = PULUMI_STACK_OPTION_PATTERN.exec(command)) {
    const ref = firstMatchGroup(match);
    if (ref !== undefined) {
      addPulumiStackRefVariants(stackRefs, ref);
    }
  }

  return [...stackRefs];
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

function resolvePulumiValidationCommandPreference(runtime: AgentRuntimeState): PulumiValidationCommandPreference {
  const stackRefs = new Set<string>();
  let preview = false;

  for (const unit of runtime.knowledgeFacts?.units ?? []) {
    if (!isValidationCommandPriorityUnit(unit) || !isPulumiValidationKnowledgeUnit(runtime, unit)) {
      continue;
    }

    if (!knowledgeUnitIncludesText(unit, PULUMI_PREVIEW_UNIT_PATTERN)) {
      continue;
    }

    preview = true;

    for (const stackRef of extractPulumiStackRefsFromText(knowledgeUnitSearchText(unit))) {
      stackRefs.add(stackRef);
    }
  }

  return {
    preview,
    stackRefs: [...stackRefs]
  };
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
    pulumi: resolvePulumiValidationCommandPreference(runtime),
    terraform: resolveTerraformValidationCommandPreference(runtime)
  };
}

function hasValidationCommandPreference(preference: ValidationCommandPreference): boolean {
  return preference.helm.template
    || preference.helm.lint
    || preference.pulumi.preview
    || preference.terraform.fmt
    || preference.terraform.validate
    || preference.terraform.plan;
}

function validationCommandPriority(command: string, preference: ValidationCommandPreference): number {
  const preferredCommandMatchers: ((candidate: string) => boolean)[] = [];

  if (preference.helm.template) {
    preferredCommandMatchers.push(candidate => HELM_TEMPLATE_COMMAND_PATTERN.test(candidate));
  }

  if (preference.helm.lint) {
    preferredCommandMatchers.push(candidate => HELM_LINT_COMMAND_PATTERN.test(candidate));
  }

  if (preference.terraform.fmt) {
    preferredCommandMatchers.push(candidate => TERRAFORM_FMT_COMMAND_PATTERN.test(candidate));
  }

  if (preference.terraform.validate) {
    preferredCommandMatchers.push(candidate => TERRAFORM_VALIDATE_COMMAND_PATTERN.test(candidate));
  }

  if (preference.terraform.plan) {
    preferredCommandMatchers.push(candidate => TERRAFORM_PLAN_COMMAND_PATTERN.test(candidate));
  }

  if (preference.pulumi.preview && preference.pulumi.stackRefs.length > 0) {
    const preferredStackRefs = new Set(preference.pulumi.stackRefs);
    preferredCommandMatchers.push(candidate =>
      PULUMI_PREVIEW_COMMAND_PATTERN.test(candidate)
        && extractPulumiStackRefsFromCommand(candidate).some(stackRef => preferredStackRefs.has(stackRef))
    );
  }

  if (preference.pulumi.preview) {
    preferredCommandMatchers.push(candidate => PULUMI_PREVIEW_COMMAND_PATTERN.test(candidate));
  }

  const priority = preferredCommandMatchers.findIndex(matches => matches(command));
  if (priority !== -1) {
    return priority;
  }

  return preferredCommandMatchers.length;
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
