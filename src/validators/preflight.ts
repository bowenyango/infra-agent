import { spawnSync } from 'node:child_process';
import type {
  ValidationPlanEntry,
  ValidationPreflight,
  ValidatorAvailability,
  WorkspaceInspection
} from '../types/repository.ts';
import { getPreferredShell } from '../utils/shell.ts';

function resolveExecutablePath(commandName: 'helm' | 'pulumi'): string | null {
  const result = spawnSync(getPreferredShell(), ['-lc', `command -v ${commandName}`], {
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
    const stackNames = project.stackNames.length > 0 ? project.stackNames : [null];
    for (const stackName of stackNames) {
      const stackArg = stackName ? ` --stack ${stackName}` : '';
      const localPulumiEnv = [
        'PULUMI_HOME=$PWD/.pulumi-home',
        'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state',
        'PULUMI_CONFIG_PASSPHRASE=infra-agent'
      ].join(' ');
      const ensureLocalState = stackName
        ? `mkdir -p .pulumi-home .pulumi-state && (${localPulumiEnv} pulumi stack init ${stackName} --cwd ${project.projectRoot} --non-interactive >/dev/null 2>&1 || true) && `
        : '';
      plan.push({
        kind: 'pulumi',
        target: project.projectRoot,
        commands: [
          `${ensureLocalState}${localPulumiEnv} pulumi preview --cwd ${project.projectRoot}${stackArg} --non-interactive`
        ]
      });
    }
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
