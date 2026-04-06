import type { AgentRuntimeState } from '../../types/agent.ts';
import type { EditPlan } from '../../types/edit-plan.ts';
import { getLatestFileContent } from './runtime-file-content.ts';

function hasProbeIntent(task: string): boolean {
  return /\b(probe|probes|readiness|liveness|health(?:check)?)\b/i.test(task);
}

function buildProbeValuesBlock(): string {
  return [
    '',
    'probes:',
    '  readiness:',
    '    enabled: true',
    '    httpGet:',
    '      path: /healthz',
    '      port: http',
    '    initialDelaySeconds: 5',
    '    periodSeconds: 10',
    '  liveness:',
    '    enabled: true',
    '    httpGet:',
    '      path: /livez',
    '      port: http',
    '    initialDelaySeconds: 10',
    '    periodSeconds: 20'
  ].join('\n');
}

function buildProbeTemplateBlock(): string {
  return [
    '          {{- if .Values.probes.readiness.enabled }}',
    '          readinessProbe:',
    '            {{- toYaml .Values.probes.readiness | nindent 12 }}',
    '          {{- end }}',
    '          {{- if .Values.probes.liveness.enabled }}',
    '          livenessProbe:',
    '            {{- toYaml .Values.probes.liveness | nindent 12 }}',
    '          {{- end }}'
  ].join('\n');
}

function insertProbeTemplateBlock(deploymentContent: string): string {
  if (/readinessProbe:\s*$/m.test(deploymentContent) || /livenessProbe:\s*$/m.test(deploymentContent)) {
    return deploymentContent;
  }

  const insertionNeedle = '          resources:\n';
  if (deploymentContent.includes(insertionNeedle)) {
    return deploymentContent.replace(insertionNeedle, `${buildProbeTemplateBlock()}\n${insertionNeedle}`);
  }

  return deploymentContent;
}

export function buildHelmProbesEditPlan(runtime: AgentRuntimeState): EditPlan | null {
  if (!hasProbeIntent(runtime.task)) {
    return null;
  }

  const topHelmTarget = runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'helm-chart');
  if (!topHelmTarget) {
    return null;
  }

  const valuesPath = `${topHelmTarget.path}/values.yaml`;
  const deploymentPath = `${topHelmTarget.path}/templates/deployment.yaml`;
  const valuesContent = getLatestFileContent(runtime, valuesPath);
  const deploymentContent = getLatestFileContent(runtime, deploymentPath);
  if (!valuesContent || !deploymentContent) {
    return null;
  }

  const writes = [];

  if (!/\nprobes:\n/.test(valuesContent)) {
    writes.push({
      path: valuesPath,
      content: `${valuesContent.trimEnd()}${buildProbeValuesBlock()}\n`,
      reason: 'Add readiness and liveness probe defaults to the chart values file.'
    });
  }

  const nextDeploymentContent = insertProbeTemplateBlock(deploymentContent);
  if (nextDeploymentContent !== deploymentContent) {
    writes.push({
      path: deploymentPath,
      content: nextDeploymentContent,
      reason: 'Wire readiness and liveness probes into the deployment template.'
    });
  }

  if (writes.length === 0) {
    return null;
  }

  return {
    kind: 'helm-probes',
    summary: `Apply probe configuration updates to ${topHelmTarget.path}.`,
    rationale: 'The task requests probe-related chart hardening and the selected chart is missing one or more required probe assets.',
    writes
  };
}
