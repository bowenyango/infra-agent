import type { AgentActionKind, AgentClarificationKind, AgentRuntimeState, AgentStopReason } from '../types/agent.ts';

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

function summarizeApprovalSignals(runtime: AgentRuntimeState): object[] {
  return runtime.approvalSignals.map(signal => ({
    kind: signal.kind,
    path: signal.path,
    risk: signal.risk,
    message: signal.message
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

function summarizeConfigSemantics(runtime: AgentRuntimeState): object[] {
  const targetPaths = new Set(runtime.preflight.targetCandidates.slice(0, 5).map(candidate => candidate.path));

  return runtime.preflight.inspection.configSemantics
    .filter(summary => targetPaths.size === 0 || targetPaths.has(summary.targetPath))
    .slice(0, 5)
    .map(summary => ({
      targetKind: summary.targetKind,
      targetPath: summary.targetPath,
      facts: summary.facts.slice(0, 12).map(fact => ({
        kind: fact.kind,
        path: fact.path,
        values: fact.values,
        relatedPaths: fact.relatedPaths,
        source: fact.source
      }))
    }));
}

export function buildPlannerSystemPrompt(): string {
  const allowedActionKinds: AgentActionKind[] = [
    'ask-for-clarification',
    'inspect-target-files',
    'apply-edit-plan',
    'repair-terraform-formatting',
    'validate-targets',
    'stop'
  ];
  const allowedStopReasons: AgentStopReason[] = [
    'validation-succeeded',
    'validation-blocked',
    'repair-budget-exhausted',
    'no-safe-action'
  ];
  const allowedClarificationKinds: AgentClarificationKind[] = [
    'approval-required',
    'target-ambiguity',
    'workspace-policy',
    'general'
  ];

  return [
    'You are the planning runtime for infra-agent.',
    'Return exactly one JSON object with this shape:',
    '{"confidence":"low|medium|high","action":{"kind":"...","summary":"...","rationale":"...","payload":{}}}',
    `Allowed action.kind values: ${allowedActionKinds.join(', ')}`,
    `Allowed ask-for-clarification payload.clarificationKind values: ${allowedClarificationKinds.join(', ')}`,
    `Allowed stop payload.stopReason values: ${allowedStopReasons.join(', ')}`,
    'Rules:',
    '- Prefer inspect-target-files before apply-edit-plan when file context is missing.',
    '- Prefer apply-edit-plan only when runtime.lastEditPlan is present and writes are available.',
    '- Prefer validate-targets after successful writes when validation commands are available.',
    '- YAML syntax validation results with commands beginning "infra-agent yaml-parse " are write guards, not full Helm, Pulumi, or Terraform target validation.',
    '- Use repair-terraform-formatting only when validationIssues include terraform-formatting-required and a Terraform root is already selected.',
    '- Use ask-for-clarification when target, environment, or ownership is ambiguous.',
    '- When ask-for-clarification is used, include payload.clarificationKind.',
    '- Use clarificationKind=approval-required when approvalSignals are present and the next step should pause for approval.',
    '- Never invent file paths, writes, or commands that are not already present in the runtime state.',
    '- For apply-edit-plan, copy writes from runtime.lastEditPlan.writes exactly.',
    '- For validate-targets, copy commands from the relevant entry in runtime.preflight.validation.plan.',
    '- For repair-terraform-formatting, set payload.rootPath to the selected Terraform root path from runtime.preflight.targetCandidates.',
    '- For stop, always include payload.stopReason.',
    '- Use stopReason=validation-succeeded only when non-YAML target validation results are present and all exit codes are 0.',
    '- Use stopReason=repair-budget-exhausted only when validationIssues are repairable but the bounded repair budget is already exhausted.',
    '- Use stopReason=validation-blocked when validation failed and no bounded repair is available.',
    '- If no safe action exists, return stop with stopReason=no-safe-action.',
    'Do not include markdown. Do not include commentary outside the JSON object.'
  ].join('\n');
}

export function buildPlannerUserPrompt(runtime: AgentRuntimeState): string {
  return JSON.stringify(
    {
      task: runtime.task,
      requestedEnvironment: runtime.preflight.requestedEnvironment,
      requestedService: runtime.preflight.requestedService,
      explicitApproval: runtime.preflight.approval,
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
      approvalSignals: summarizeApprovalSignals(runtime),
      lastEditPlan: summarizeEditPlan(runtime),
      configSemantics: summarizeConfigSemantics(runtime),
      validationPlan: runtime.preflight.validation.plan
    },
    null,
    2
  );
}
