import { spawnSync } from 'node:child_process';
import type {
  ValidationPlanEntry,
  ValidationPreflight,
  ValidatorAvailability,
  WorkspaceInspection
} from '../types/repository.ts';

function resolveExecutablePath(commandName: 'helm' | 'pulumi'): string | null {
  const result = spawnSync('sh', ['-lc', `command -v ${commandName}`], {
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    return null;
  }

  const resolvedPath = result.stdout.trim();
  return resolvedPath.length > 0 ? resolvedPath : null;
}

function buildValidatorAvailability(): ValidatorAvailability[] {
  return ['helm', 'pulumi'].map(name => {
    const resolvedPath = resolveExecutablePath(name);
    return {
      name,
      available: resolvedPath !== null,
      resolvedPath
    };
  });
}

function buildValidationPlan(inspection: WorkspaceInspection): ValidationPlanEntry[] {
  const plan: ValidationPlanEntry[] = [];

  for (const chart of inspection.helmCharts) {
    plan.push({
      kind: 'helm',
      target: chart.chartRoot,
      commands: [
        `helm lint ${chart.chartRoot}`,
        `helm template ${chart.chartRoot}`
      ]
    });
  }

  for (const project of inspection.pulumiProjects) {
    plan.push({
      kind: 'pulumi',
      target: project.projectRoot,
      commands: [
        `pulumi preview --cwd ${project.projectRoot}`
      ]
    });
  }

  return plan;
}

export function buildValidationPreflight(inspection: WorkspaceInspection): ValidationPreflight {
  return {
    workspaceRoot: inspection.workspaceRoot,
    validators: buildValidatorAvailability(),
    plan: buildValidationPlan(inspection)
  };
}
