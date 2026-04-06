import type { AgentActionKind, AgentRuntimeState } from '../types/agent.ts';

function summarizeValidationResults(runtime: AgentRuntimeState): string[] {
  return runtime.validationResults.slice(-6).map(result => {
    const stderr = result.stderr.trim();
    const suffix = stderr.length > 0 ? ` stderr=${JSON.stringify(stderr.slice(0, 400))}` : '';
    return `${result.command} -> exit ${result.exitCode}${suffix}`;
  });
}

function summarizeValidationIssues(runtime: AgentRuntimeState): object[] {
  return runtime.validationIssues.slice(-6).map(issue => ({
    kind: issue.kind,
    repairable: issue.repairable,
    sourceCommand: issue.sourceCommand,
    message: issue.message
  }));
}

function summarizeObservations(runtime: AgentRuntimeState): string[] {
  return runtime.observations.slice(-12).map(result => `${result.toolName} (${result.safety})`);
}

function summarizeEditPlan(runtime: AgentRuntimeState): object | null {
  if (!runtime.lastEditPlan) {
    return null;
  }

  return {
    kind: runtime.lastEditPlan.kind,
    summary: runtime.lastEditPlan.summary,
    writes: runtime.lastEditPlan.writes.map(write => ({
      path: write.path,
      reason: write.reason
    }))
  };
}

export function buildPlannerSystemPrompt(): string {
  const allowedActionKinds: AgentActionKind[] = [
    'ask-for-clarification',
    'inspect-target-files',
    'apply-edit-plan',
    'validate-targets',
    'stop'
  ];

  return [
    'You are the planning runtime for infra-agent.',
    'Return exactly one JSON object with this shape:',
    '{"confidence":"low|medium|high","action":{"kind":"...","summary":"...","rationale":"...","payload":{}}}',
    `Allowed action.kind values: ${allowedActionKinds.join(', ')}`,
    'Rules:',
    '- Prefer inspect-target-files before apply-edit-plan when file context is missing.',
    '- Prefer apply-edit-plan only when runtime.lastEditPlan is present and writes are available.',
    '- Prefer validate-targets after successful writes when validation commands are available.',
    '- Use ask-for-clarification when target, environment, or ownership is ambiguous.',
    '- Never invent file paths, writes, or commands that are not already present in the runtime state.',
    '- For apply-edit-plan, copy writes from runtime.lastEditPlan.writes exactly.',
    '- For validate-targets, copy commands from the relevant entry in runtime.preflight.validation.plan.',
    '- If no safe action exists, return stop.',
    'Do not include markdown. Do not include commentary outside the JSON object.'
  ].join('\n');
}

export function buildPlannerUserPrompt(runtime: AgentRuntimeState): string {
  return JSON.stringify(
    {
      task: runtime.task,
      requestedEnvironment: runtime.preflight.requestedEnvironment,
      requestedService: runtime.preflight.requestedService,
      targetCandidates: runtime.preflight.targetCandidates.slice(0, 5),
      assumptions: runtime.preflight.assumptions,
      blockers: runtime.preflight.blockers,
      nextActions: runtime.preflight.nextActions,
      observationSummary: summarizeObservations(runtime),
      appliedWrites: runtime.appliedWrites.map(write => ({
        path: write.path,
        reason: write.reason
      })),
      validationResults: summarizeValidationResults(runtime),
      validationIssues: summarizeValidationIssues(runtime),
      lastEditPlan: summarizeEditPlan(runtime),
      validationPlan: runtime.preflight.validation.plan
    },
    null,
    2
  );
}
