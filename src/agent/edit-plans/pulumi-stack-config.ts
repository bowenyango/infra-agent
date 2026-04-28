import { basename, join } from 'node:path';
import type { AgentRuntimeState } from '../../types/agent.ts';
import type { ConfigSemanticFact } from '../../types/config-semantics.ts';
import type { EditPlan } from '../../types/edit-plan.ts';
import { getLatestFileContent } from './runtime-file-content.ts';

function hasPulumiConfigIntent(task: string): boolean {
  return /\b(pulumi|stack|image(?:[- ]?tag)?)\b/i.test(task);
}

function detectRequestedStackQualifier(task: string): string | null {
  if (/\btenant-shared\b/i.test(task)) {
    return 'tenant-shared';
  }

  if (/\bglobal\b/i.test(task)) {
    return 'global';
  }

  return null;
}

function normalizeStackNameForProfile(
  profileId: AgentRuntimeState['preflight']['profile']['id'],
  task: string,
  environment: string | null,
  availableStacks: string[]
): string | null {
  if (profileId === 'scrawlr-infra-cloud') {
    const requestedQualifier = detectRequestedStackQualifier(task);
    const normalizedEnvironment =
      environment === 'development' ? 'dev'
      : environment === 'production' ? 'prod'
      : environment;

    const targetLabel =
      normalizedEnvironment === 'dev' || normalizedEnvironment === 'stage' || normalizedEnvironment === 'staging' || normalizedEnvironment === 'qa' || normalizedEnvironment === 'test'
        ? 'non-prod'
        : normalizedEnvironment;

    if (!targetLabel) {
      if (requestedQualifier) {
        const qualifiedFallback = availableStacks.find(stackName => stackName.startsWith(`${requestedQualifier}.`));
        return qualifiedFallback ?? null;
      }

      return availableStacks.find(stackName => stackName === 'non-prod' || stackName.endsWith('.non-prod'))
        ?? availableStacks.find(stackName => stackName === 'prod' || stackName.endsWith('.prod'))
        ?? availableStacks[0]
        ?? null;
    }

    if (requestedQualifier) {
      const qualifiedMatch = availableStacks.find(stackName => stackName === `${requestedQualifier}.${targetLabel}`);
      return qualifiedMatch ?? null;
    }

    return availableStacks.find(stackName => stackName === targetLabel || stackName.endsWith(`.${targetLabel}`)) ?? null;
  }

  if (environment === 'development') {
    return 'dev';
  }

  if (environment === 'production') {
    return 'prod';
  }

  if (environment) {
    return environment;
  }

  return availableStacks[0] ?? null;
}

function detectImageTag(task: string): string | null {
  const patterns = [
    /\bimage(?:[- ]?tag)?\s+(?:to|as)\s+([a-z0-9._:/-]+)/i,
    /\bimage(?:[- ]?tag)?=([a-z0-9._:/-]+)/i,
    /\btag\s+(?:to|as)\s+([a-z0-9._:/-]+)/i
  ];

  for (const pattern of patterns) {
    const match = task.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function extractStackNameFromCommand(command: string): string | null {
  const match = command.match(/--stack\s+([^\s]+)/);
  return match?.[1] ?? null;
}

function extractProjectName(projectFileContent: string | null, projectRoot: string): string {
  const matchedName = projectFileContent?.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  if (matchedName && matchedName.length > 0) {
    return matchedName;
  }

  return basename(projectRoot);
}

function extractExistingConfigNamespace(
  profileId: AgentRuntimeState['preflight']['profile']['id'],
  stackFileContent: string,
  projectName: string
): string {
  if (profileId !== 'scrawlr-infra-cloud') {
    return projectName;
  }

  const matches = Array.from(stackFileContent.matchAll(/^\s{2}([a-z0-9._-]+):[a-zA-Z0-9._-]+:\s+/gm));
  if (matches.length === 0) {
    return projectName;
  }

  const namespaces = matches
    .map(match => match[1]?.trim())
    .filter((value): value is string => Boolean(value));

  return namespaces[0] ?? projectName;
}

function configKeyFromSemanticPath(path: string): string | null {
  return path.startsWith('config.') ? path.slice('config.'.length) : null;
}

function pulumiConfigFactsForProject(runtime: AgentRuntimeState, projectRoot: string): ConfigSemanticFact[] {
  return runtime.preflight.inspection.configSemantics
    .find(summary => summary.targetKind === 'pulumi-project' && summary.targetPath === projectRoot)
    ?.facts ?? [];
}

function selectPulumiConfigKeyFromFacts(params: {
  facts: ConfigSemanticFact[];
  stackFilePath: string;
  suffix: string;
}): string | null {
  const normalizedSuffix = `:${params.suffix.toLowerCase()}`;
  const keyForFact = (fact: ConfigSemanticFact): string | null => {
    const key = configKeyFromSemanticPath(fact.path);
    if (!key || !key.toLowerCase().endsWith(normalizedSuffix)) {
      return null;
    }

    return key;
  };
  const stackConfiguredFact = params.facts.find(fact =>
    fact.kind === 'configured-field'
    && fact.source.path === params.stackFilePath
    && keyForFact(fact)
  );
  const anyConfiguredFact = params.facts.find(fact =>
    fact.kind === 'configured-field'
    && keyForFact(fact)
  );
  const declaredFact = params.facts.find(fact =>
    (fact.kind === 'type-constraint' || fact.kind === 'defaulted-field')
    && keyForFact(fact)
  );
  const selectedFact = stackConfiguredFact ?? anyConfiguredFact ?? declaredFact ?? null;

  return selectedFact ? keyForFact(selectedFact) : null;
}

function normalizeEnvironmentValueForProfile(
  profileId: AgentRuntimeState['preflight']['profile']['id'],
  stackName: string
): string {
  if (profileId !== 'scrawlr-infra-cloud') {
    return stackName;
  }

  const normalizedStackName = stackName.trim();
  if (normalizedStackName === 'non-prod' || normalizedStackName.endsWith('.non-prod')) {
    return 'non-prod';
  }

  if (normalizedStackName === 'prod' || normalizedStackName.endsWith('.prod')) {
    return 'prod';
  }

  return normalizedStackName;
}

function formatYamlScalar(value: string): string {
  if (/^[a-z0-9._:/-]+$/i.test(value)) {
    return value;
  }

  return JSON.stringify(value);
}

function upsertConfigValue(content: string, key: string, value: string): string {
  const lines = content.length > 0 ? content.split('\n') : [];
  const renderedLine = `  ${key}: ${formatYamlScalar(value)}`;
  const configIndex = lines.findIndex(line => line.trim() === 'config:');

  if (configIndex === -1) {
    const prefix = content.trimEnd();
    return prefix.length > 0
      ? `${prefix}\nconfig:\n${renderedLine}\n`
      : `config:\n${renderedLine}\n`;
  }

  let blockEnd = lines.length;
  for (let index = configIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().length === 0) {
      continue;
    }

    if (!line.startsWith(' ')) {
      blockEnd = index;
      break;
    }
  }

  for (let index = configIndex + 1; index < blockEnd; index += 1) {
    const line = lines[index];
    if (line.trimStart().startsWith(`${key}:`)) {
      lines[index] = renderedLine;
      return `${lines.join('\n').trimEnd()}\n`;
    }
  }

  lines.splice(blockEnd, 0, renderedLine);
  return `${lines.join('\n').trimEnd()}\n`;
}

export function buildPulumiMissingConfigRepairEditPlan(runtime: AgentRuntimeState): EditPlan | null {
  const missingConfigIssue = runtime.validationIssues.find(issue => issue.kind === 'pulumi-missing-config');
  const missingConfigKey = missingConfigIssue?.metadata?.missingConfigKey;
  if (!missingConfigIssue || !missingConfigKey) {
    return null;
  }

  const topPulumiTarget = runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'pulumi-project');
  if (!topPulumiTarget) {
    return null;
  }

  const project = runtime.preflight.inspection.pulumiProjects.find(
    candidate => candidate.projectRoot === topPulumiTarget.path
  );
  if (!project) {
    return null;
  }

  const stackName =
    extractStackNameFromCommand(missingConfigIssue.sourceCommand)
    ?? normalizeStackNameForProfile(
      runtime.preflight.profile.id,
      runtime.task,
      runtime.preflight.requestedEnvironment,
      project.stackNames
    );
  if (!stackName) {
    return null;
  }

  const stackFileRelativePath = project.stackFiles.find(filePath => filePath.endsWith(`Pulumi.${stackName}.yaml`));
  if (!stackFileRelativePath) {
    return null;
  }

  let value: string | null = null;
  if (/:imageTag$/i.test(missingConfigKey)) {
    value = detectImageTag(runtime.task);
  } else if (/:environment$/i.test(missingConfigKey)) {
    value = normalizeEnvironmentValueForProfile(runtime.preflight.profile.id, stackName);
  }

  if (!value) {
    return null;
  }

  const stackFileContent = getLatestFileContent(runtime, stackFileRelativePath) ?? '';
  const nextContent = upsertConfigValue(stackFileContent, missingConfigKey, value);
  if (nextContent === stackFileContent) {
    return null;
  }

  return {
    kind: 'pulumi-missing-config-repair',
    summary: `Repair missing Pulumi config ${missingConfigKey} in ${stackFileRelativePath}.`,
    rationale: `Pulumi preview reported that ${missingConfigKey} is required, and the selected stack file can be repaired with a bounded config update.`,
    pulumiConfigOperations: [
      {
        projectRoot: topPulumiTarget.path,
        stackName,
        key: missingConfigKey,
        value
      }
    ],
    writes: [
      {
        path: stackFileRelativePath,
        content: nextContent,
        reason: `Repair missing bounded Pulumi config ${missingConfigKey}.`
      }
    ]
  };
}

export function buildPulumiStackConfigEditPlan(runtime: AgentRuntimeState): EditPlan | null {
  if (!hasPulumiConfigIntent(runtime.task)) {
    return null;
  }

  const topPulumiTarget = runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'pulumi-project');
  if (!topPulumiTarget) {
    return null;
  }

  const project = runtime.preflight.inspection.pulumiProjects.find(
    candidate => candidate.projectRoot === topPulumiTarget.path
  );
  if (!project) {
    return null;
  }

  const stackName = normalizeStackNameForProfile(
    runtime.preflight.profile.id,
    runtime.task,
    runtime.preflight.requestedEnvironment,
    project.stackNames
  );
  if (!stackName) {
    return null;
  }

  const imageTag = detectImageTag(runtime.task);
  if (!imageTag) {
    return null;
  }

  const projectFileContent = getLatestFileContent(runtime, join(topPulumiTarget.path, 'Pulumi.yaml'));
  const existingStackFileRelativePath = project.stackFiles.find(filePath => filePath.endsWith(`Pulumi.${stackName}.yaml`)) ?? null;
  if (runtime.preflight.profile.id === 'scrawlr-infra-cloud' && !existingStackFileRelativePath) {
    return null;
  }

  const stackFileRelativePath = existingStackFileRelativePath ?? join(topPulumiTarget.path, `Pulumi.${stackName}.yaml`);
  const stackFileContent = getLatestFileContent(runtime, stackFileRelativePath) ?? '';
  const projectName = extractProjectName(projectFileContent, topPulumiTarget.path);
  const configNamespaceFallback = extractExistingConfigNamespace(runtime.preflight.profile.id, stackFileContent, projectName);
  const configFacts = pulumiConfigFactsForProject(runtime, topPulumiTarget.path);
  const environmentConfigKey =
    selectPulumiConfigKeyFromFacts({
      facts: configFacts,
      stackFilePath: stackFileRelativePath,
      suffix: 'environment'
    }) ?? `${configNamespaceFallback}:environment`;
  const imageTagConfigKey =
    selectPulumiConfigKeyFromFacts({
      facts: configFacts,
      stackFilePath: stackFileRelativePath,
      suffix: 'imageTag'
    }) ?? `${configNamespaceFallback}:imageTag`;
  const environmentValue = normalizeEnvironmentValueForProfile(runtime.preflight.profile.id, stackName);

  const nextContent = upsertConfigValue(
    upsertConfigValue(
      stackFileContent,
      environmentConfigKey,
      environmentValue
    ),
    imageTagConfigKey,
    imageTag
  );

  if (stackFileContent === nextContent) {
    return null;
  }

  return {
    kind: 'pulumi-stack-config',
    summary: `Apply Pulumi stack configuration updates to ${stackFileRelativePath}.`,
    rationale: `The task requests a stack-level configuration change and the selected Pulumi project exposes a matching stack file. The plan reuses Pulumi config keys ${environmentConfigKey} and ${imageTagConfigKey} when available.`,
    pulumiConfigOperations: [
      {
        projectRoot: topPulumiTarget.path,
        stackName,
        key: environmentConfigKey,
        value: environmentValue
      },
      {
        projectRoot: topPulumiTarget.path,
        stackName,
        key: imageTagConfigKey,
        value: imageTag
      }
    ],
    writes: [
      {
        path: stackFileRelativePath,
        content: nextContent,
        reason: 'Update the Pulumi stack file with the requested bounded configuration change.'
      }
    ]
  };
}
