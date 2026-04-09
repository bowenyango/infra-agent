import { join } from 'node:path';
import type { AgentRuntimeState } from '../../types/agent.ts';
import type { EditPlan } from '../../types/edit-plan.ts';
import { getLatestFileContent } from './runtime-file-content.ts';

function hasTerraformConfigIntent(task: string): boolean {
  return /\b(terraform|tfvars|variable|variables|image(?:[- ]?tag)?)\b/i.test(task);
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

function formatTfvarsValue(value: string): string {
  if (/^(true|false|null|[0-9]+(?:\.[0-9]+)?)$/i.test(value)) {
    return value;
  }

  return JSON.stringify(value);
}

function upsertTfvarsValue(content: string, key: string, value: string): string {
  const normalized = content.trimEnd();
  const lines = normalized.length > 0 ? normalized.split('\n') : [];
  const renderedLine = `${key} = ${formatTfvarsValue(value)}`;
  const targetPrefix = `${key} = `;

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index]?.trimStart().startsWith(targetPrefix)) {
      lines[index] = renderedLine;
      return `${lines.join('\n').trimEnd()}\n`;
    }
  }

  lines.push(renderedLine);
  return `${lines.join('\n').trimEnd()}\n`;
}

function normalizeEnvironmentValue(environment: string | null): string | null {
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

function selectTfvarsPath(tfvarsFiles: string[], requestedEnvironment: string | null, rootPath: string): string {
  const normalizedEnvironment = normalizeEnvironmentValue(requestedEnvironment);
  if (normalizedEnvironment) {
    const matchingPath = tfvarsFiles.find(filePath => filePath.toLowerCase().includes(normalizedEnvironment.toLowerCase()));
    if (matchingPath) {
      return matchingPath;
    }
  }

  return tfvarsFiles.find(filePath => filePath.endsWith('terraform.auto.tfvars'))
    ?? tfvarsFiles.find(filePath => filePath.endsWith('terraform.tfvars'))
    ?? join(rootPath, 'terraform.auto.tfvars');
}

export function buildTerraformTfvarsConfigEditPlan(runtime: AgentRuntimeState): EditPlan | null {
  if (!hasTerraformConfigIntent(runtime.task)) {
    return null;
  }

  const topTerraformTarget = runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'terraform-root');
  if (!topTerraformTarget) {
    return null;
  }

  const root = runtime.preflight.inspection.terraformRoots.find(candidate => candidate.rootPath === topTerraformTarget.path);
  if (!root) {
    return null;
  }

  const imageTag = detectImageTag(runtime.task);
  if (!imageTag) {
    return null;
  }

  const preferredTfvarsPath = selectTfvarsPath(root.tfvarsFiles, runtime.preflight.requestedEnvironment, topTerraformTarget.path);
  const existingContent = getLatestFileContent(runtime, preferredTfvarsPath) ?? '';
  const nextEnvironment = normalizeEnvironmentValue(runtime.preflight.requestedEnvironment);

  let nextContent = upsertTfvarsValue(existingContent, 'image_tag', imageTag);
  if (nextEnvironment) {
    nextContent = upsertTfvarsValue(nextContent, 'environment', nextEnvironment);
  }

  if (nextContent === existingContent) {
    return null;
  }

  return {
    kind: 'terraform-tfvars-config',
    summary: `Apply Terraform variable updates to ${preferredTfvarsPath}.`,
    rationale: 'The task requests a bounded Terraform configuration change and the selected Terraform root exposes a safe tfvars-based update path.',
    writes: [
      {
        path: preferredTfvarsPath,
        content: nextContent,
        reason: 'Update Terraform variable values through a bounded tfvars file change.'
      }
    ]
  };
}
