import { basename, join } from 'node:path';
import type { AgentRuntimeState } from '../../types/agent.ts';
import type { EditPlan } from '../../types/edit-plan.ts';
import { getLatestFileContent } from './runtime-file-content.ts';

function hasPulumiConfigIntent(task: string): boolean {
  return /\b(pulumi|stack|image(?:[- ]?tag)?)\b/i.test(task);
}

function normalizeStackName(environment: string | null, availableStacks: string[]): string | null {
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

function extractProjectName(projectFileContent: string | null, projectRoot: string): string {
  const matchedName = projectFileContent?.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  if (matchedName && matchedName.length > 0) {
    return matchedName;
  }

  return basename(projectRoot);
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

  const stackName = normalizeStackName(runtime.preflight.requestedEnvironment, project.stackNames);
  if (!stackName) {
    return null;
  }

  const imageTag = detectImageTag(runtime.task);
  if (!imageTag) {
    return null;
  }

  const projectFileContent = getLatestFileContent(runtime, join(topPulumiTarget.path, 'Pulumi.yaml'));
  const stackFileRelativePath = project.stackFiles.find(filePath => filePath.endsWith(`Pulumi.${stackName}.yaml`))
    ?? join(topPulumiTarget.path, `Pulumi.${stackName}.yaml`);
  const stackFileContent = getLatestFileContent(runtime, stackFileRelativePath) ?? '';
  const projectName = extractProjectName(projectFileContent, topPulumiTarget.path);

  const nextContent = upsertConfigValue(
    upsertConfigValue(
      stackFileContent,
      `${projectName}:environment`,
      stackName
    ),
    `${projectName}:imageTag`,
    imageTag
  );

  if (stackFileContent === nextContent) {
    return null;
  }

  return {
    kind: 'pulumi-stack-config',
    summary: `Apply Pulumi stack configuration updates to ${stackFileRelativePath}.`,
    rationale: 'The task requests a stack-level configuration change and the selected Pulumi project exposes a matching stack file.',
    writes: [
      {
        path: stackFileRelativePath,
        content: nextContent,
        reason: 'Update the Pulumi stack file with the requested bounded configuration change.'
      }
    ]
  };
}
