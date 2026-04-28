import type { AgentRuntimeState } from '../../types/agent.ts';
import type { EditPlan } from '../../types/edit-plan.ts';
import { chooseHelmEnumValue, summarizeHelmRequiredFacts } from './helm-schema-semantics.ts';
import { getLatestFileContent } from './runtime-file-content.ts';

function hasIngressIntent(task: string): boolean {
  return /\bingress\b/i.test(task);
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

function buildServiceValuesBlock(): string {
  return [
    '',
    'service:',
    '  port: 8080'
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
  const ingressClassName = chooseHelmEnumValue(runtime, topHelmTarget.path, 'ingress.className', 'nginx');
  const requiredFactNote = summarizeHelmRequiredFacts(runtime, topHelmTarget.path, ['service.port']);
  const needsDefaultServicePort =
    runtime.preflight.profile.id === 'scrawlr-infra-apps'
    && topHelmTarget.path.startsWith('charts/apps/')
    && !/\nservice:\n[\s\S]*\n  port:\s*/m.test(valuesContent);

  if (!/\ningress:\n/.test(valuesContent)) {
    const serviceBlock = needsDefaultServicePort ? buildServiceValuesBlock() : '';
    writes.push({
      path: valuesPath,
      content: `${valuesContent.trimEnd()}${serviceBlock}${buildIngressValuesBlock(hostname, ingressClassName.value)}\n`,
      reason: needsDefaultServicePort
        ? 'Add ingress values and a bounded default service.port to the chart values file.'
        : 'Add ingress values to the chart values file.'
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
    rationale: [
      needsDefaultServicePort
        ? 'The task requests ingress changes and the selected app chart needs both ingress values and a minimal service.port default to satisfy common template references.'
        : 'The task requests ingress changes and the selected chart is missing one or more required ingress assets.',
      ingressClassName.note,
      requiredFactNote
    ].filter(Boolean).join(' '),
    writes
  };
}
