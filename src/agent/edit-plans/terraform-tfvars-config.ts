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

function requiresTfvarsClarification(tfvarsFiles: string[], requestedEnvironment: string | null): boolean {
  if (requestedEnvironment) {
    return false;
  }

  return tfvarsFiles.length > 1;
}

function collectTerraformFileContents(runtime: AgentRuntimeState, rootPath: string, filePaths: string[]): string[] {
  return filePaths
    .filter(filePath => filePath.startsWith(rootPath))
    .map(filePath => getLatestFileContent(runtime, filePath))
    .filter((content): content is string => typeof content === 'string');
}

function collectAssignedKeys(contents: string[]): string[] {
  const keys: string[] = [];

  for (const content of contents) {
    for (const match of content.matchAll(/^\s*([A-Za-z0-9_]+)\s*=/gm)) {
      if (match[1]) {
        keys.push(match[1]);
      }
    }
  }

  return keys;
}

function collectDeclaredVariables(contents: string[]): string[] {
  const keys: string[] = [];

  for (const content of contents) {
    for (const match of content.matchAll(/variable\s+"([^"]+)"/g)) {
      if (match[1]) {
        keys.push(match[1]);
      }
    }
  }

  return keys;
}

function pickMatchingKey(keys: string[], patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = keys.find(key => pattern.test(key));
    if (match) {
      return match;
    }
  }

  return null;
}

function inferTerraformKey(runtime: AgentRuntimeState, rootPath: string, tfFilePaths: string[], tfvarsFilePaths: string[], params: {
  tfvarsPatterns: RegExp[];
  variablePatterns: RegExp[];
  fallback: string;
}): string {
  const tfvarsContents = collectTerraformFileContents(runtime, rootPath, tfvarsFilePaths);
  const tfContents = collectTerraformFileContents(runtime, rootPath, tfFilePaths);
  const assignedKeys = collectAssignedKeys(tfvarsContents);
  const declaredVariables = collectDeclaredVariables(tfContents);

  return pickMatchingKey(assignedKeys, params.tfvarsPatterns)
    ?? pickMatchingKey(declaredVariables, params.variablePatterns)
    ?? params.fallback;
}

function buildTerraformTfvarsWrite(
  runtime: AgentRuntimeState,
  rootPath: string,
  tfFilePaths: string[],
  tfvarsFilePaths: string[],
  preferredTfvarsPath: string,
  params: {
    imageTag?: string | null;
    explicitKey?: string | null;
    explicitValue?: string | null;
  }
): { nextContent: string; rationaleParts: string[] } | null {
  const existingContent = getLatestFileContent(runtime, preferredTfvarsPath) ?? '';
  const nextEnvironment = normalizeEnvironmentValue(runtime.preflight.requestedEnvironment);
  const imageTagKey = inferTerraformKey(runtime, rootPath, tfFilePaths, tfvarsFilePaths, {
    tfvarsPatterns: [/^image_tag$/i, /^imageTag$/i, /image.*tag/i, /tag.*image/i],
    variablePatterns: [/^image_tag$/i, /^imageTag$/i, /image.*tag/i, /tag.*image/i],
    fallback: 'image_tag'
  });
  const environmentKey = inferTerraformKey(runtime, rootPath, tfFilePaths, tfvarsFilePaths, {
    tfvarsPatterns: [/^environment$/i, /^env$/i, /environment/i, /env/i],
    variablePatterns: [/^environment$/i, /^env$/i, /environment/i, /env/i],
    fallback: 'environment'
  });
  let nextContent = existingContent;
  const rationaleParts = [`The plan reuses Terraform variable keys ${imageTagKey} and ${environmentKey} when available.`];

  if (params.imageTag) {
    nextContent = upsertTfvarsValue(nextContent, imageTagKey, params.imageTag);
  }

  if (params.explicitKey && params.explicitValue) {
    nextContent = upsertTfvarsValue(nextContent, params.explicitKey, params.explicitValue);
    rationaleParts.push(`The repair path also restores the missing required variable ${params.explicitKey}.`);
  }

  if (nextEnvironment) {
    nextContent = upsertTfvarsValue(nextContent, environmentKey, nextEnvironment);
  }

  if (nextContent === existingContent) {
    return null;
  }

  return {
    nextContent,
    rationaleParts
  };
}

export function buildTerraformMissingRequiredArgumentRepairEditPlan(runtime: AgentRuntimeState): EditPlan | null {
  const missingRequiredIssue = runtime.validationIssues.find(
    issue => issue.kind === 'terraform-validate-failure' && issue.metadata?.missingVariableName
  );
  const missingVariableName = missingRequiredIssue?.metadata?.missingVariableName;
  if (!missingRequiredIssue || !missingVariableName) {
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

  if (runtime.preflight.profile.id === 'generic' && root.tfvarsFiles.length === 0) {
    return null;
  }

  if (requiresTfvarsClarification(root.tfvarsFiles, runtime.preflight.requestedEnvironment)) {
    return null;
  }

  const imageTag = detectImageTag(runtime.task);
  const preferredTfvarsPath = selectTfvarsPath(root.tfvarsFiles, runtime.preflight.requestedEnvironment, topTerraformTarget.path);
  const explicitValue =
    /image/i.test(missingVariableName) && /tag/i.test(missingVariableName)
      ? imageTag
      : /^environment$/i.test(missingVariableName) || /^env$/i.test(missingVariableName)
        ? normalizeEnvironmentValue(runtime.preflight.requestedEnvironment)
        : null;
  if (!explicitValue) {
    return null;
  }

  const tfvarsWrite = buildTerraformTfvarsWrite(runtime, topTerraformTarget.path, root.tfFiles, root.tfvarsFiles, preferredTfvarsPath, {
    imageTag,
    explicitKey: missingVariableName,
    explicitValue
  });
  if (!tfvarsWrite) {
    return null;
  }

  return {
    kind: 'terraform-missing-required-argument-repair',
    summary: `Repair missing Terraform variable ${missingVariableName} in ${preferredTfvarsPath}.`,
    rationale: `Terraform validate reported that ${missingVariableName} is required and the selected root exposes a safe tfvars-based repair path. ${tfvarsWrite.rationaleParts.join(' ')}`,
    writes: [
      {
        path: preferredTfvarsPath,
        content: tfvarsWrite.nextContent,
        reason: `Repair missing required Terraform variable ${missingVariableName} through a bounded tfvars file change.`
      }
    ]
  };
}

export function buildTerraformTfvarsConfigEditPlan(runtime: AgentRuntimeState): EditPlan | null {
  const hasRepairableMissingRequiredArgument = runtime.validationIssues.some(
    issue => issue.kind === 'terraform-validate-failure' && issue.repairable && Boolean(issue.metadata?.missingVariableName)
  );
  if (hasRepairableMissingRequiredArgument) {
    return null;
  }

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

  if (runtime.preflight.profile.id === 'generic' && root.tfvarsFiles.length === 0) {
    return null;
  }

  if (requiresTfvarsClarification(root.tfvarsFiles, runtime.preflight.requestedEnvironment)) {
    return null;
  }

  const imageTag = detectImageTag(runtime.task);
  if (!imageTag) {
    return null;
  }

  const preferredTfvarsPath = selectTfvarsPath(root.tfvarsFiles, runtime.preflight.requestedEnvironment, topTerraformTarget.path);
  const tfvarsWrite = buildTerraformTfvarsWrite(runtime, topTerraformTarget.path, root.tfFiles, root.tfvarsFiles, preferredTfvarsPath, {
    imageTag
  });
  if (!tfvarsWrite) {
    return null;
  }

  return {
    kind: 'terraform-tfvars-config',
    summary: `Apply Terraform variable updates to ${preferredTfvarsPath}.`,
    rationale: `The task requests a bounded Terraform configuration change and the selected Terraform root exposes a safe tfvars-based update path. ${tfvarsWrite.rationaleParts.join(' ')}`,
    writes: [
      {
        path: preferredTfvarsPath,
        content: tfvarsWrite.nextContent,
        reason: 'Update Terraform variable values through a bounded tfvars file change.'
      }
    ]
  };
}
