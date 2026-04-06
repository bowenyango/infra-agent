import type { AgentRuntimeState } from '../../types/agent.ts';
import type { EditPlan } from '../../types/edit-plan.ts';
import { getLatestFileContent } from './runtime-file-content.ts';

function hasIngressIntent(task: string): boolean {
  return /\bingress\b/i.test(task);
}

function buildIngressValuesBlock(hostname: string): string {
  return [
    '',
    'ingress:',
    '  enabled: true',
    '  className: nginx',
    '  annotations: {}',
    `  host: ${hostname}`,
    '  path: /',
    '  pathType: Prefix'
  ].join('\n');
}

function buildIngressTemplate(): string {
  return [
    '{{- if .Values.ingress.enabled }}',
    'apiVersion: networking.k8s.io/v1',
    'kind: Ingress',
    'metadata:',
    '  name: {{ .Chart.Name }}',
    '  {{- with .Values.ingress.annotations }}',
    '  annotations:',
    '    {{- toYaml . | nindent 4 }}',
    '  {{- end }}',
    'spec:',
    '  {{- if .Values.ingress.className }}',
    '  ingressClassName: {{ .Values.ingress.className }}',
    '  {{- end }}',
    '  rules:',
    '    - host: {{ .Values.ingress.host }}',
    '      http:',
    '        paths:',
    '          - path: {{ .Values.ingress.path }}',
    '            pathType: {{ .Values.ingress.pathType }}',
    '            backend:',
    '              service:',
    '                name: {{ .Chart.Name }}',
    '                port:',
    '                  number: {{ .Values.service.port }}',
    '{{- end }}',
    ''
  ].join('\n');
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

export function buildHelmIngressEditPlan(runtime: AgentRuntimeState): EditPlan | null {
  if (!hasIngressIntent(runtime.task)) {
    return null;
  }

  const topHelmTarget = runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'helm-chart');
  if (!topHelmTarget) {
    return null;
  }

  const valuesPath = `${topHelmTarget.path}/values.yaml`;
  const ingressPath = `${topHelmTarget.path}/templates/ingress.yaml`;
  const valuesContent = getLatestFileContent(runtime, valuesPath);
  if (!valuesContent) {
    return null;
  }

  const writes = [];
  const serviceName = topHelmTarget.name;
  const environment = normalizeEnvironmentForHostname(runtime.preflight.requestedEnvironment);
  const hostname = `${serviceName}.${environment}.internal`;

  if (!/\ningress:\n/.test(valuesContent)) {
    writes.push({
      path: valuesPath,
      content: `${valuesContent.trimEnd()}${buildIngressValuesBlock(hostname)}\n`,
      reason: 'Add ingress values to the chart values file.'
    });
  }

  const existingIngress = getLatestFileContent(runtime, ingressPath);
  if (!existingIngress) {
    writes.push({
      path: ingressPath,
      content: buildIngressTemplate(),
      reason: 'Create a standard ingress template for the chart.'
    });
  }

  if (writes.length === 0) {
    return null;
  }

  return {
    kind: 'helm-ingress',
    summary: `Apply ingress configuration updates to ${topHelmTarget.path}.`,
    rationale: 'The task requests ingress changes and the selected chart is missing one or more required ingress assets.',
    writes
  };
}
