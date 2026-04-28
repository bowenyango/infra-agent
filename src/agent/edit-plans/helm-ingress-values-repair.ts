import type { AgentRuntimeState } from '../../types/agent.ts';
import type { EditPlan } from '../../types/edit-plan.ts';
import { chooseHelmEnumValue } from './helm-schema-semantics.ts';
import { getLatestFileContent } from './runtime-file-content.ts';

function needsIngressValuesRepair(runtime: AgentRuntimeState): boolean {
  return runtime.validationIssues.some(issue => issue.kind === 'helm-missing-ingress-values');
}

function normalizeEnvironmentForHostname(environment: string | null): string {
  if (!environment) {
    return 'dev';
  }

  if (environment === 'development') {
    return 'dev';
  }

  if (environment === 'production') {
    return 'prod';
  }

  return environment;
}

function buildIngressValuesBlock(hostname: string, className: string): string {
  return [
    '',
    'ingress:',
    '  enabled: true',
    `  className: ${className}`,
    '  annotations: {}',
    `  host: ${hostname}`,
    '  path: /',
    '  pathType: Prefix'
  ].join('\n');
}

export function buildHelmIngressValuesRepairEditPlan(runtime: AgentRuntimeState): EditPlan | null {
  if (!needsIngressValuesRepair(runtime)) {
    return null;
  }

  const topHelmTarget = runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'helm-chart');
  if (!topHelmTarget) {
    return null;
  }

  const valuesPath = `${topHelmTarget.path}/values.yaml`;
  const valuesContent = getLatestFileContent(runtime, valuesPath);
  if (!valuesContent || /\ningress:\n/.test(valuesContent)) {
    return null;
  }

  const environment = normalizeEnvironmentForHostname(runtime.preflight.requestedEnvironment);
  const hostname = `${topHelmTarget.name}.${environment}.internal`;
  const ingressClassName = chooseHelmEnumValue(runtime, topHelmTarget.path, 'ingress.className', 'nginx');

  return {
    kind: 'helm-ingress-values-repair',
    summary: `Repair missing ingress values in ${valuesPath}.`,
    rationale: [
      'Validation failed on ingress.enabled and the selected chart values file does not currently define ingress settings.',
      ingressClassName.note
    ].filter(Boolean).join(' '),
    writes: [
      {
        path: valuesPath,
        content: `${valuesContent.trimEnd()}${buildIngressValuesBlock(hostname, ingressClassName.value)}\n`,
        reason: 'Add bounded ingress defaults so existing ingress templates can render during validation.'
      }
    ]
  };
}
