import type { AgentRuntimeState, FileWritePlan } from '../types/agent.ts';
import type { FileReadOutput } from '../types/tools.ts';

function getFileContent(runtime: AgentRuntimeState, relativePathSuffix: string): string | null {
  for (const observation of runtime.observations) {
    if (observation.toolName !== 'read_file') {
      continue;
    }

    const output = observation.output as FileReadOutput;
    if (output.path.endsWith(relativePathSuffix)) {
      return output.content;
    }
  }

  return null;
}

function hasIngressIntent(task: string): boolean {
  return /\bingress\b/i.test(task);
}

function buildIngressValuesBlock(serviceName: string): string {
  return [
    '',
    'ingress:',
    '  enabled: true',
    '  className: nginx',
    '  annotations: {}',
    '  host: ' + `${serviceName}.dev.internal`,
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

export function buildIngressEditPlan(runtime: AgentRuntimeState): FileWritePlan[] {
  if (!hasIngressIntent(runtime.task)) {
    return [];
  }

  const topHelmTarget = runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'helm-chart');
  if (!topHelmTarget) {
    return [];
  }

  const valuesPath = `${topHelmTarget.path}/values.yaml`;
  const ingressPath = `${topHelmTarget.path}/templates/ingress.yaml`;
  const valuesContent = getFileContent(runtime, valuesPath);
  if (!valuesContent) {
    return [];
  }

  const writes: FileWritePlan[] = [];
  const serviceName = topHelmTarget.name;

  if (!/\ningress:\n/.test(valuesContent)) {
    writes.push({
      path: valuesPath,
      content: `${valuesContent.trimEnd()}${buildIngressValuesBlock(serviceName)}\n`,
      reason: 'Add ingress values to the chart values file.'
    });
  }

  const existingIngress = getFileContent(runtime, ingressPath);
  if (!existingIngress) {
    writes.push({
      path: ingressPath,
      content: buildIngressTemplate(),
      reason: 'Create a standard ingress template for the chart.'
    });
  }

  return writes;
}

