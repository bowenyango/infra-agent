import type { ValidationCommandOutput } from '../types/tools.ts';
import type { ValidationIssue } from '../types/agent.ts';

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

export function classifyValidationIssues(results: ValidationCommandOutput[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const result of results) {
    if (result.exitCode === 0) {
      continue;
    }

    const combinedOutput = `${result.stdout}\n${result.stderr}`;

    if (/service\.port/i.test(combinedOutput)) {
      issues.push(buildIssue(result, {
        kind: 'helm-missing-service-port',
        repairable: true,
        message: 'Validation failed because a Helm template references .Values.service.port but the values file does not define it.'
      }));
      continue;
    }

    if (/ingress\.enabled/i.test(combinedOutput)) {
      issues.push(buildIssue(result, {
        kind: 'helm-missing-ingress-values',
        repairable: true,
        message: 'Validation failed because a Helm template references .Values.ingress.enabled but the values file does not define ingress settings.'
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
      issues.push(buildIssue(result, {
        kind: 'terraform-validate-failure',
        repairable: false,
        message: combinedOutput.trim().slice(0, 400) || 'Terraform validate reported a configuration error.',
        guidance: buildTerraformValidateGuidance(combinedOutput)
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
