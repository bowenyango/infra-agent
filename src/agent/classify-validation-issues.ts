import type { ValidationCommandOutput } from '../types/tools.ts';
import type { ValidationIssue } from '../types/agent.ts';

interface PulumiCreateBeforeDeleteConflictFacts {
  conflictCode: string;
  duplicateIdentity: string | null;
  providerName: string | null;
  resourceType: string | null;
  routeDestinations: string[];
  routeTableIds: string[];
}

function buildIssue(result: ValidationCommandOutput, issue: Omit<ValidationIssue, 'sourceCommand'>): ValidationIssue {
  return {
    ...issue,
    sourceCommand: result.command
  };
}

function buildTerraformValidateGuidance(output: string): string {
  if (/undeclared (input )?variable/i.test(output)) {
    return 'Read the referenced Terraform root and confirm the variable name exists in variable declarations and tfvars before retrying.';
  }

  if (/missing required argument/i.test(output)) {
    return 'Read the referenced Terraform module inputs and add the missing required argument through an existing tfvars file or declared variable path.';
  }

  if (/unsupported argument/i.test(output)) {
    return 'Compare the failing argument name against the Terraform module variable declarations and remove or rename unsupported keys before retrying.';
  }

  if (/invalid value/i.test(output)) {
    return 'Inspect the failing Terraform variable type and update the tfvars value to match the declared schema before retrying.';
  }

  return 'Read the failing Terraform root, review variable declarations and tfvars, then correct the configuration before rerunning validation.';
}

function extractMissingRequiredTerraformArgument(output: string): string | null {
  const match = output.match(/argument\s+"([^"]+)"\s+is required/i);
  return match?.[1] ?? null;
}

function buildPulumiPreviewGuidance(output: string): string {
  const missingConfigMatch =
    output.match(/missing required configuration (?:key|variable)[^"'`]*["'`]([^"'`]+)["'`]/i)
    ?? output.match(/configuration[^"'`]*["'`]([^"'`]+)["'`][^"'`]*is required/i);

  const missingConfigKey = missingConfigMatch?.[1]?.trim();
  if (missingConfigKey) {
    if (/:imageTag$/i.test(missingConfigKey)) {
      return `Update the selected Pulumi stack file and set ${missingConfigKey} using the existing stack config namespace before rerunning preview.`;
    }

    if (/:environment$/i.test(missingConfigKey)) {
      return `Update the selected Pulumi stack file and set ${missingConfigKey} to the intended environment value before rerunning preview.`;
    }

    return `Update the selected Pulumi stack file and define ${missingConfigKey} using the existing project config shape before rerunning preview.`;
  }

  return 'Read the failing Pulumi project and stack file, then correct the missing or invalid config value before rerunning preview.';
}

function uniqueMatches(output: string, pattern: RegExp): string[] {
  return [...new Set([...output.matchAll(pattern)]
    .map(match => match[1]?.trim())
    .filter((value): value is string => Boolean(value)))];
}

function extractPulumiResourceType(output: string): string | null {
  const match = output.match(/(?:^|\n)\s*([A-Za-z0-9_./-]+:[A-Za-z0-9_./-]+(?::[A-Za-z0-9_./-]+)?)\s+\([^)]+\):/);
  return match?.[1]?.trim() ?? null;
}

function extractDuplicateIdentity(output: string): string | null {
  return output.match(/\b(?:name|bucket|repository|queue|topic|function|role|group|user)\s+["'`]([^"'`]+)["'`][^.\n]*already exists/i)?.[1]?.trim()
    ?? output.match(/\b([A-Za-z0-9._:/-]+)\s+already exists\b/i)?.[1]?.trim()
    ?? null;
}

function extractPulumiCreateBeforeDeleteConflictFacts(output: string): PulumiCreateBeforeDeleteConflictFacts | null {
  const conflictCode = output.match(/\b(RouteAlreadyExists|BucketAlreadyExists|BucketAlreadyOwnedByYou|EntityAlreadyExists|ResourceAlreadyExistsException|RepositoryAlreadyExistsException|QueueAlreadyExists|TopicAlreadyExists|DBInstanceAlreadyExists|TableAlreadyExistsException|AlreadyExistsException|InvalidGroup\.Duplicate|InvalidPermission\.Duplicate)\b/i)?.[1]
    ?? (/\balready exists\b/i.test(output) ? 'AlreadyExists' : null);

  if (!conflictCode) {
    return null;
  }

  const routeTableIds = uniqueMatches(output, /Route Table \((rtb-[^)]+)\)/gi);
  const routeDestinations = uniqueMatches(output, /destination \(([^)]+)\)/gi);
  const providerName = output.match(/\bprovider=([^\s]+)/i)?.[1]?.trim() ?? null;

  return {
    conflictCode,
    duplicateIdentity: extractDuplicateIdentity(output),
    providerName,
    resourceType: extractPulumiResourceType(output),
    routeDestinations,
    routeTableIds
  };
}

function buildPulumiCreateBeforeDeleteConflictGuidance(facts: PulumiCreateBeforeDeleteConflictFacts): string {
  const routeTableText = facts.routeTableIds.length > 0 ? ` in route table(s) ${facts.routeTableIds.join(', ')}` : '';
  const destinationText = facts.routeDestinations.length > 0 ? ` for destination(s) ${facts.routeDestinations.join(', ')}` : '';
  const resourceText = facts.resourceType ? ` ${facts.resourceType}` : '';
  const identityText = facts.duplicateIdentity ? ` for identity ${facts.duplicateIdentity}` : '';

  return `Pulumi attempted to create an exclusive${resourceText} resource${routeTableText}${destinationText}${identityText} before deleting the existing object, and the provider returned ${facts.conflictCode}. Review the preview for delete/create or delete-replaced/create-replacement pairs with the same provider identity: if this is a logical rename, add Pulumi aliases from the old URNs; if the resource must be replaced, set deleteBeforeReplace or manually sequence the replacement with accepted downtime; if the failed update already changed cloud or state, run refresh/import/state repair only with explicit approval.`;
}

function buildHelmValidationGuidance(kind: 'service-port' | 'ingress-values'): string {
  if (kind === 'service-port') {
    return 'Read the selected Helm chart values and define service.port in values.yaml before rerunning helm lint or helm template.';
  }

  return 'Read the selected Helm chart values and define the ingress block in values.yaml before rerunning helm lint or helm template.';
}

function extractYamlValidationPath(command: string): string | null {
  const match = command.match(/^infra-agent yaml-parse (.+)$/);
  return match?.[1]?.trim() ?? null;
}

export function classifyValidationIssues(results: ValidationCommandOutput[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const result of results) {
    if (result.exitCode === 0) {
      continue;
    }

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    const yamlPath = extractYamlValidationPath(result.command);

    if (yamlPath) {
      const parserMatch = combinedOutput.match(/\b(parser|using):\s*([A-Za-z0-9:_-]+)/i);
      issues.push(buildIssue(result, {
        kind: 'yaml-syntax-failure',
        repairable: false,
        message: combinedOutput.trim().slice(0, 400) || `YAML syntax validation failed for ${yamlPath}.`,
        guidance: `Fix the planned YAML content for ${yamlPath} before applying the write. Do not continue to Helm, Pulumi, or Terraform validation until the file parses as YAML.`,
        metadata: {
          yamlPath,
          yamlParser: parserMatch?.[2]
        }
      }));
      continue;
    }

    if (/service\.port/i.test(combinedOutput)) {
      issues.push(buildIssue(result, {
        kind: 'helm-missing-service-port',
        repairable: true,
        message: 'Validation failed because a Helm template references .Values.service.port but the values file does not define it.',
        guidance: buildHelmValidationGuidance('service-port')
      }));
      continue;
    }

    if (/ingress\.enabled/i.test(combinedOutput)) {
      issues.push(buildIssue(result, {
        kind: 'helm-missing-ingress-values',
        repairable: true,
        message: 'Validation failed because a Helm template references .Values.ingress.enabled but the values file does not define ingress settings.',
        guidance: buildHelmValidationGuidance('ingress-values')
      }));
      continue;
    }

    if (/terraform\b.*fmt\b.*-check/i.test(result.command) || /terraform fmt/i.test(combinedOutput)) {
      issues.push(buildIssue(result, {
        kind: 'terraform-formatting-required',
        repairable: true,
        message: 'Terraform formatting validation failed. The selected Terraform root can be repaired with a bounded terraform fmt pass.'
      }));
      continue;
    }

    if (/terraform\b.*validate/i.test(result.command)) {
      const missingVariableName = extractMissingRequiredTerraformArgument(combinedOutput);
      issues.push(buildIssue(result, {
        kind: 'terraform-validate-failure',
        repairable: Boolean(missingVariableName),
        message: combinedOutput.trim().slice(0, 400) || 'Terraform validate reported a configuration error.',
        guidance: buildTerraformValidateGuidance(combinedOutput),
        metadata: missingVariableName
          ? {
              missingVariableName
            }
          : undefined
      }));
      continue;
    }

    if (/pulumi\b.*(?:preview|up|update)/i.test(result.command)) {
      const missingConfigMatch =
        combinedOutput.match(/missing required configuration (?:key|variable)[^"'`]*["'`]([^"'`]+)["'`]/i)
        ?? combinedOutput.match(/configuration[^"'`]*["'`]([^"'`]+)["'`][^"'`]*is required/i);
      const createBeforeDeleteConflictFacts = extractPulumiCreateBeforeDeleteConflictFacts(combinedOutput);

      if (createBeforeDeleteConflictFacts) {
        issues.push(buildIssue(result, {
          kind: 'pulumi-create-before-delete-conflict',
          repairable: false,
          message: combinedOutput.trim().slice(0, 400) || 'Pulumi failed because a resource with the same provider identity already exists.',
          guidance: buildPulumiCreateBeforeDeleteConflictGuidance(createBeforeDeleteConflictFacts),
          metadata: {
            conflictCode: createBeforeDeleteConflictFacts.conflictCode,
            duplicateIdentity: createBeforeDeleteConflictFacts.duplicateIdentity ?? undefined,
            providerName: createBeforeDeleteConflictFacts.providerName ?? undefined,
            resourceType: createBeforeDeleteConflictFacts.resourceType ?? undefined,
            routeDestinations: createBeforeDeleteConflictFacts.routeDestinations.join(','),
            routeTableIds: createBeforeDeleteConflictFacts.routeTableIds.join(',')
          }
        }));
        continue;
      }

      issues.push(buildIssue(result, {
        kind: missingConfigMatch ? 'pulumi-missing-config' : 'pulumi-preview-failure',
        repairable: Boolean(missingConfigMatch),
        message: combinedOutput.trim().slice(0, 400) || 'Pulumi preview reported a configuration error.',
        guidance: buildPulumiPreviewGuidance(combinedOutput),
        metadata: missingConfigMatch?.[1]
          ? {
              missingConfigKey: missingConfigMatch[1].trim()
            }
          : undefined
      }));
      continue;
    }

    issues.push(buildIssue(result, {
      kind: 'unknown-validation-failure',
      repairable: false,
      message: combinedOutput.trim().slice(0, 400) || 'Validation failed with an unclassified error.'
    }));
  }

  return issues;
}
