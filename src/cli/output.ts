import type { AgentRunState } from '../agent/run-single-step.ts';
import type {
  DomainCapabilitySummary,
  RunPreflightState,
  ValidationPreflight,
  WorkspaceInspection
} from '../types/repository.ts';
import type {
  DiffPreviewOutput,
  HelmShowChartOutput,
  HelmShowValuesOutput,
  PulumiConfigSetOutput,
  SearchWorkspaceOutput,
  TerraformFormatRepairOutput,
  ValidationRunOutput
} from '../types/tools.ts';
import type { EditPlanKind } from '../types/edit-plan.ts';

function printHeader(title: string): void {
  process.stdout.write(`${title}\n`);
}

function printList(items: string[], fallback: string): void {
  if (items.length === 0) {
    process.stdout.write(`- ${fallback}\n`);
    return;
  }

  for (const item of items) {
    process.stdout.write(`- ${item}\n`);
  }
}

function formatDomainCapability(domain: DomainCapabilitySummary): string {
  return `${domain.label}: ${domain.detectedTargets} target(s); tasks=${domain.supportedTaskKinds.join(', ')}; edits=${domain.boundedEditKinds.join(', ')}; validators=${domain.validatorCommands.join(', ')}`;
}

function formatRequestedDomains(domains: string[]): string {
  return domains.length > 0 ? domains.join(', ') : 'undetected';
}

function getPrimaryRequestedDomain(domains: string[]): string | null {
  return domains[0] ?? null;
}

function toTitleCase(value: string): string {
  return value.length > 0 ? `${value[0]?.toUpperCase() ?? ''}${value.slice(1)}` : value;
}

function formatPrimaryDomainLabel(domain: string | null): string {
  if (!domain) {
    return 'Infrastructure';
  }

  return toTitleCase(domain);
}

function describeDomainTarget(domain: string | null): string {
  switch (domain) {
    case 'terraform':
      return 'Terraform root';
    case 'pulumi':
      return 'Pulumi project';
    case 'helm':
      return 'Helm chart';
    default:
      return 'infrastructure target';
  }
}

function domainFromEditPlanKind(kind: EditPlanKind): string {
  if (kind.startsWith('helm-')) {
    return 'Helm';
  }

  if (kind.startsWith('pulumi-')) {
    return 'Pulumi';
  }

  if (kind.startsWith('terraform-')) {
    return 'Terraform';
  }

  return 'Unknown';
}

function summarizeBoundedPath(state: AgentRunState): string {
  const lastEditPlan = state.runtime.lastEditPlan;
  if (lastEditPlan) {
    return `${domainFromEditPlanKind(lastEditPlan.kind)} -> ${lastEditPlan.kind}`;
  }

  const lastTurnActionFamily = state.turns[state.turns.length - 1]?.decision.action.payload?.actionFamily;
  if (lastTurnActionFamily) {
    return lastTurnActionFamily;
  }

  const validationCommands = state.runtime.validationResults.map(result => result.command);
  if (validationCommands.some(command => command.includes('terraform '))) {
    return 'Terraform -> validation';
  }

  if (validationCommands.some(command => command.includes('pulumi '))) {
    return 'Pulumi -> validation';
  }

  if (validationCommands.some(command => command.includes('helm '))) {
    return 'Helm -> validation';
  }

  return `Requested domains -> ${formatRequestedDomains(state.preflight.requestedDomains)}`;
}

function summarizeValidatorFamilies(state: AgentRunState): string {
  const families = new Set<string>();

  for (const result of state.runtime.validationResults) {
    if (result.command.includes('terraform ')) {
      families.add('Terraform');
      continue;
    }

    if (result.command.includes('pulumi ')) {
      families.add('Pulumi');
      continue;
    }

    if (result.command.includes('helm ')) {
      families.add('Helm');
    }
  }

  return families.size > 0 ? Array.from(families).join(', ') : 'none';
}

function summarizeValidationFindings(state: AgentRunState): string {
  const renderedKinds = new Set<string>();

  for (const result of state.runtime.validationResults) {
    if (!result.command.includes('helm template')) {
      continue;
    }

    for (const match of result.stdout.matchAll(/^\s*kind:\s*([A-Za-z0-9]+)/gm)) {
      if (match[1]) {
        renderedKinds.add(match[1]);
      }
    }
  }

  if (renderedKinds.size > 0) {
    return `Helm rendered resources: ${Array.from(renderedKinds).join(', ')}`;
  }

  const topIssue = state.runtime.validationIssues[0];
  if (topIssue?.kind === 'pulumi-missing-config') {
    const missingConfigKey = topIssue.metadata?.missingConfigKey;
    return missingConfigKey
      ? `Pulumi preview missing config: ${missingConfigKey}`
      : 'Pulumi preview is blocked by a missing required config value.';
  }

  if (topIssue?.kind === 'pulumi-preview-failure') {
    return topIssue.guidance ?? 'Pulumi preview reported a configuration error.';
  }

  if (topIssue?.kind === 'terraform-formatting-required') {
    return 'Terraform formatting repair is required before validation can pass.';
  }

  if (topIssue?.kind === 'terraform-validate-failure') {
    const missingVariableName = topIssue.metadata?.missingVariableName;
    if (missingVariableName) {
      return `Terraform validate is missing required variable: ${missingVariableName}`;
    }

    return topIssue.guidance ?? 'Terraform validate reported a configuration error.';
  }

  return 'none';
}

function summarizeNativeCliTools(state: AgentRunState): string {
  const tools = new Set<string>();

  for (const turn of state.turns) {
    for (const result of turn.execution?.executedTools ?? []) {
      if (result.toolName === 'helm_show_values') {
        tools.add('Helm CLI');
      }

      if (result.toolName === 'helm_show_chart') {
        tools.add('Helm CLI');
      }

      if (result.toolName === 'pulumi_config_set') {
        tools.add('Pulumi CLI');
      }

      if (result.toolName === 'terraform_fmt') {
        tools.add('Terraform CLI');
      }
    }
  }

  return tools.size > 0 ? Array.from(tools).join(', ') : 'none';
}

function summarizeNativeCliFindings(state: AgentRunState): string {
  const findings: string[] = [];

  for (const turn of state.turns) {
    for (const result of turn.execution?.executedTools ?? []) {
      if (result.toolName === 'helm_show_chart') {
        const output = result.output as HelmShowChartOutput;
        const nameMatch = output.content.match(/^\s*name:\s*(.+)$/m);
        const versionMatch = output.content.match(/^\s*version:\s*(.+)$/m);
        findings.push(`Helm chart ${nameMatch?.[1]?.trim() ?? output.chartPath}${versionMatch?.[1] ? ` v${versionMatch[1].trim()}` : ''}`);
        continue;
      }

      if (result.toolName === 'helm_show_values') {
        const output = result.output as HelmShowValuesOutput;
        const topLevelKeys = Array.from(
          new Set(
            output.content
              .split('\n')
              .map(line => line.match(/^([A-Za-z0-9_-]+):\s*$/)?.[1])
              .filter((key): key is string => Boolean(key))
          )
        );

        findings.push(`Helm values inspected for ${output.chartPath}${topLevelKeys.length > 0 ? ` (${topLevelKeys.slice(0, 3).join(', ')})` : ''}`);
        continue;
      }

      if (result.toolName === 'pulumi_config_set') {
        const output = result.output as PulumiConfigSetOutput;
        findings.push(`Pulumi config updated ${output.key} on stack ${output.stackName}`);
        continue;
      }

      if (result.toolName === 'terraform_fmt') {
        const output = result.output as TerraformFormatRepairOutput;
        findings.push(`Terraform fmt normalized ${output.formattedFiles.length} file(s) in ${output.rootPath}`);
      }
    }
  }

  return findings.length > 0 ? findings.slice(0, 3).join('; ') : 'none';
}

function extractTargetPathFromValidationCommand(command: string, primaryDomain: string | null): string | null {
  if (primaryDomain === 'helm') {
    const match = command.match(/helm (?:lint|template) (\S+)/);
    return match?.[1] ?? null;
  }

  if (primaryDomain === 'pulumi') {
    const match = command.match(/--cwd (\S+)/);
    return match?.[1] ?? null;
  }

  if (primaryDomain === 'terraform') {
    const match = command.match(/-chdir=(\S+)/);
    return match?.[1] ?? null;
  }

  return null;
}

function inferPrimaryImpactTargetPath(state: AgentRunState, primaryDomain: string | null): string | null {
  for (const turn of state.turns) {
    for (const result of turn.execution?.executedTools ?? []) {
      if (result.toolName === 'helm_show_chart' || result.toolName === 'helm_show_values') {
        return (result.output as HelmShowChartOutput | HelmShowValuesOutput).chartPath;
      }

      if (result.toolName === 'pulumi_config_set') {
        return (result.output as PulumiConfigSetOutput).projectRoot;
      }

      if (result.toolName === 'terraform_fmt') {
        return (result.output as TerraformFormatRepairOutput).rootPath;
      }
    }
  }

  for (const write of state.runtime.appliedWrites) {
    if (primaryDomain === 'helm' && write.path.startsWith('charts/')) {
      const segments = write.path.split('/');
      return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : write.path;
    }

    if (primaryDomain === 'pulumi' && /\/Pulumi(\..+)?\.(yaml|yml)$/i.test(write.path)) {
      const segments = write.path.split('/');
      return segments.slice(0, -1).join('/');
    }

    if (primaryDomain === 'terraform' && (write.path.endsWith('.tf') || /\.tfvars(\.json)?$/i.test(write.path))) {
      const segments = write.path.split('/');
      return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : write.path;
    }
  }

  for (const result of state.runtime.validationResults) {
    const targetPath = extractTargetPathFromValidationCommand(result.command, primaryDomain);
    if (targetPath) {
      return targetPath;
    }
  }

  return state.preflight.targetCandidates[0]?.path ?? null;
}

function summarizePrimaryTargetImpact(state: AgentRunState): string {
  const primaryDomain = getPrimaryRequestedDomain(state.preflight.requestedDomains);
  const targetPath = inferPrimaryImpactTargetPath(state, primaryDomain);
  const changedPaths = Array.from(new Set(state.runtime.appliedWrites.map(write => write.path)));

  if (!targetPath) {
    return 'undetected';
  }

  const domainLabel = formatPrimaryDomainLabel(primaryDomain);
  const changedInTarget = changedPaths.filter(path => path.startsWith(targetPath));
  if (changedInTarget.length > 0) {
    return `${domainLabel} target ${targetPath} with ${changedInTarget.length} changed file(s)`;
  }

  if (state.runtime.validationResults.length > 0) {
    return `${domainLabel} target ${targetPath} was validated without direct file changes`;
  }

  return `${domainLabel} target ${targetPath} was inspected`;
}

function summarizeRunPosture(state: AgentRunState): string {
  switch (state.outcome) {
    case 'completed':
      if (state.runtime.validationResults.length > 0) {
        return 'validated and ready for review';
      }

      return 'completed with bounded inspection or edits';
    case 'approval-required':
      return 'paused pending explicit approval for a scoped high-risk change';
    case 'validation-blocked':
      return 'blocked by validation and needs follow-up action';
    case 'clarification-required':
      return 'paused pending clarification about target, environment, or scope';
    case 'repair-budget-exhausted':
      return 'stopped after bounded repair attempts were exhausted';
    case 'no-safe-action':
    default:
      return 'stopped because no safe next action was available';
  }
}

function summarizeOpenConcern(state: AgentRunState): string {
  const topApprovalSignal = state.runtime.approvalSignals[0];
  const topValidationIssue = state.runtime.validationIssues[0];
  const lastQuestion = state.turns[state.turns.length - 1]?.decision.action.payload?.questions?.[0];

  switch (state.outcome) {
    case 'approval-required':
      if (topApprovalSignal) {
        return `Approval required for ${topApprovalSignal.risk}-risk write at ${topApprovalSignal.path}.`;
      }

      return 'Approval is required before the agent can continue.';
    case 'validation-blocked':
    case 'repair-budget-exhausted':
      if (topValidationIssue?.guidance) {
        return topValidationIssue.guidance;
      }

      if (topValidationIssue?.message) {
        return topValidationIssue.message;
      }

      return 'Validation is blocked and needs follow-up action.';
    case 'clarification-required':
      if (lastQuestion) {
        return lastQuestion;
      }

      return 'The agent needs clarification about the target, environment, or intended scope.';
    case 'no-safe-action':
      return 'No safe next action is currently available.';
    case 'completed':
    default:
      return 'none';
  }
}

export function summarizeResultCard(state: AgentRunState): string[] {
  const lines: string[] = [];
  const changedPaths = Array.from(new Set(state.runtime.appliedWrites.map(write => write.path)));

  lines.push(`Run posture: ${summarizeRunPosture(state)}`);
  lines.push(`Primary target impact: ${summarizePrimaryTargetImpact(state)}`);
  lines.push(`Open concern: ${summarizeOpenConcern(state)}`);
  lines.push(`Changed files: ${changedPaths.length === 0 ? 'none' : changedPaths.slice(0, 3).join(', ')}${changedPaths.length > 3 ? ` (+${changedPaths.length - 3} more)` : ''}`);
  lines.push(`Native CLI operations: ${summarizeNativeCliTools(state)}`);
  lines.push(`Native CLI findings: ${summarizeNativeCliFindings(state)}`);
  lines.push(`Validators executed: ${state.runtime.validationResults.length} command(s) across ${summarizeValidatorFamilies(state)}`);
  lines.push(`Validation findings: ${summarizeValidationFindings(state)}`);
  lines.push(`Repair activity: ${state.runtime.repairAttempts > 0 ? `${state.runtime.repairAttempts} bounded repair attempt(s)` : 'none'}`);

  return lines;
}

function shellQuote(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function buildCliBaseCommand(): string {
  return 'node --experimental-strip-types src/cli/main.ts';
}

function buildWorkspaceFlag(workspaceRoot: string): string {
  return `--workspace ${shellQuote(workspaceRoot)}`;
}

function buildTaskFlag(task: string): string {
  return shellQuote(task);
}

function getPrimaryDomainTargetPath(state: AgentRunState, primaryDomain: string | null): string | null {
  if (primaryDomain === 'helm') {
    return state.preflight.targetCandidates.find(candidate => candidate.kind === 'helm-chart')?.path ?? null;
  }

  if (primaryDomain === 'pulumi') {
    return state.preflight.targetCandidates.find(candidate => candidate.kind === 'pulumi-project')?.path ?? null;
  }

  if (primaryDomain === 'terraform') {
    return state.preflight.targetCandidates.find(candidate => candidate.kind === 'terraform-root')?.path ?? null;
  }

  return state.preflight.targetCandidates[0]?.path ?? null;
}

function summarizeDomainSuggestedCommands(state: AgentRunState): string[] {
  const primaryDomain = getPrimaryRequestedDomain(state.preflight.requestedDomains);
  const targetPath = getPrimaryDomainTargetPath(state, primaryDomain);

  if (!primaryDomain || !targetPath) {
    return [];
  }

  if (primaryDomain === 'helm') {
    return [
      `helm show chart ${shellQuote(targetPath)}`,
      `helm show values ${shellQuote(targetPath)}`,
      `helm lint ${shellQuote(targetPath)}`
    ];
  }

  if (primaryDomain === 'pulumi') {
    const commands = state.preflight.validation.plan.find(
      entry => entry.kind === 'pulumi' && entry.target === targetPath
    )?.commands;

    return commands ? commands.slice(0, 1) : [];
  }

  if (primaryDomain === 'terraform') {
    const commands = state.preflight.validation.plan.find(
      entry => entry.kind === 'terraform' && entry.target === targetPath
    )?.commands;

    return commands ? commands.slice(0, 2) : [];
  }

  return [];
}

export function summarizePreflightSnapshot(state: RunPreflightState): string[] {
  const lines: string[] = [];
  const topTarget = state.targetCandidates[0];
  const unavailableValidators = state.validation.validators.filter(validator => !validator.available).map(validator => validator.name);

  lines.push(`Profile: ${state.profile.id}`);
  lines.push(`Detected domains: ${state.inspection.domainCapabilities.length > 0 ? state.inspection.domainCapabilities.map(domain => domain.label).join(', ') : 'none'}`);
  lines.push(`Requested domains: ${formatRequestedDomains(state.requestedDomains)}`);
  lines.push(`Planned domain path: ${state.requestedDomains.length > 0 ? state.requestedDomains.map(toTitleCase).join(' -> ') : 'infer from targets'}`);
  lines.push(`Requested environment: ${state.requestedEnvironment ?? 'undetected'}`);
  lines.push(`Requested service: ${state.requestedService ?? 'undetected'}`);
  lines.push(`Primary target: ${topTarget ? `${topTarget.kind} ${topTarget.path} (score=${topTarget.score})` : 'undetected'}`);
  lines.push(`Validation readiness: ${unavailableValidators.length === 0 ? 'all configured validators available' : `missing ${unavailableValidators.join(', ')}`}`);
  lines.push(`Approval posture: ${state.effectiveApprovalPolicy.requiredWriteRisks.length > 0 ? `writes with risk ${state.effectiveApprovalPolicy.requiredWriteRisks.join(', ')} require approval` : 'no approval rules active'}`);

  if (state.blockers[0]) {
    lines.push(`Top blocker: ${state.blockers[0]}`);
  } else if (state.assumptions[0]) {
    lines.push(`Top ambiguity: ${state.assumptions[0]}`);
  } else {
    lines.push('Top blocker: none');
  }

  return lines;
}

export function summarizePreflightSuggestedCommands(state: RunPreflightState): string[] {
  const base = buildCliBaseCommand();
  const workspaceArg = shellQuote(state.workspaceRoot);
  const workspaceFlag = buildWorkspaceFlag(state.workspaceRoot);
  const taskFlag = buildTaskFlag(state.task);

  if (state.blockers.length > 0) {
    return [
      `${base} inspect ${workspaceArg}`,
      `${base} validate ${workspaceArg}`
    ];
  }

  if (state.assumptions.length > 0) {
    return [
      `${base} inspect ${workspaceArg}`,
      `${base} run ${taskFlag} ${workspaceFlag}`
    ];
  }

  return [
    `${base} inspect ${workspaceArg}`,
    `${base} validate ${workspaceArg}`,
    `${base} agent ${taskFlag} ${workspaceFlag}`
  ];
}

export function summarizeRecommendedNextSteps(state: AgentRunState): string[] {
  const steps: string[] = [];
  const topTarget = state.preflight.targetCandidates[0];
  const lastTurn = state.turns[state.turns.length - 1];
  const topValidationIssue = state.runtime.validationIssues[0];
  const primaryDomain = getPrimaryRequestedDomain(state.preflight.requestedDomains);
  const domainLabel = formatPrimaryDomainLabel(primaryDomain);
  const domainTarget = describeDomainTarget(primaryDomain);

  if (topTarget) {
    steps.push(`Focus on ${topTarget.kind} target ${topTarget.path} for the next change or review step.`);
  }

  switch (state.outcome) {
    case 'completed':
      steps.push('Review the bounded file changes and keep the validated output as the proposed infra update.');
      return steps;
    case 'approval-required':
      steps.push('Approve the flagged write risk or write path before asking the agent to continue.');
      steps.push('Use --approve-write-risk and optionally --approve-write-path to continue the same task with explicit approval.');
      return steps;
    case 'clarification-required':
      if (lastTurn?.decision.action.payload?.questions?.length) {
        steps.push(`Answer the clarification prompt: ${lastTurn.decision.action.payload.questions[0]}`);
      } else {
        steps.push(`Clarify the intended ${domainTarget}, environment, or values scope before retrying the task.`);
      }
      return steps;
    case 'validation-blocked':
      if (topValidationIssue?.guidance) {
        steps.push(topValidationIssue.guidance);
      } else if (topValidationIssue) {
        steps.push(`Resolve the ${domainLabel} validation blocker: ${topValidationIssue.message}`);
      } else {
        steps.push(`Inspect the failed ${domainLabel} validation output and correct the configuration before retrying.`);
      }
      return steps;
    case 'repair-budget-exhausted':
      steps.push(`Inspect the latest ${domainLabel} validation issue and apply a manual correction before retrying the agent.`);
      return steps;
    case 'no-safe-action':
    default:
      steps.push(`Review ${domainLabel} target ambiguity, workspace policy, or missing validators before rerunning the task.`);
      return steps;
  }
}

export function summarizeSuggestedCommands(state: AgentRunState): string[] {
  const base = buildCliBaseCommand();
  const workspaceFlag = buildWorkspaceFlag(state.preflight.workspaceRoot);
  const workspaceArg = shellQuote(state.preflight.workspaceRoot);
  const taskFlag = buildTaskFlag(state.preflight.task);
  const topApprovalSignal = state.runtime.approvalSignals[0];
  const primaryDomain = getPrimaryRequestedDomain(state.preflight.requestedDomains);
  const domainValidateCommand = `${base} validate ${workspaceArg}`;
  const domainInspectCommand = `${base} inspect ${workspaceArg}`;
  const rerunCommand = `${base} run ${taskFlag} ${workspaceFlag}`;
  const agentJsonCommand = `${base} agent ${taskFlag} ${workspaceFlag} --json`;
  const domainNativeCommands = summarizeDomainSuggestedCommands(state);

  switch (state.outcome) {
    case 'approval-required':
      if (topApprovalSignal) {
        return [
          `${base} agent ${taskFlag} ${workspaceFlag} --approve-write-risk ${topApprovalSignal.risk} --approve-write-path ${shellQuote(topApprovalSignal.path)}`
        ];
      }
      return [`${base} agent ${taskFlag} ${workspaceFlag}`];
    case 'clarification-required':
      if (primaryDomain === 'terraform') {
        return [rerunCommand, ...domainNativeCommands, domainInspectCommand, domainValidateCommand];
      }
      if (primaryDomain === 'pulumi' || primaryDomain === 'helm') {
        return [domainInspectCommand, ...domainNativeCommands, rerunCommand, domainValidateCommand];
      }
      return [
        rerunCommand,
        domainInspectCommand
      ];
    case 'validation-blocked':
    case 'repair-budget-exhausted':
      if (primaryDomain === 'terraform' || primaryDomain === 'pulumi' || primaryDomain === 'helm') {
        return [...domainNativeCommands, domainValidateCommand, domainInspectCommand, rerunCommand];
      }
      return [
        domainInspectCommand,
        rerunCommand
      ];
    case 'completed':
      return [
        agentJsonCommand
      ];
    case 'no-safe-action':
    default:
      return [
        rerunCommand
      ];
  }
}

export function summarizeAgentSnapshot(state: AgentRunState): string[] {
  const lines: string[] = [];
  const topTarget = state.preflight.targetCandidates[0];
  const topValidationIssue = state.runtime.validationIssues[0];
  const primaryDomain = getPrimaryRequestedDomain(state.preflight.requestedDomains);

  lines.push(`Outcome: ${state.outcome}`);
  lines.push(`Model: ${state.modelName}`);
  lines.push(`Detected domains: ${state.preflight.inspection.domainCapabilities.length > 0 ? state.preflight.inspection.domainCapabilities.map(domain => domain.label).join(', ') : 'none'}`);
  lines.push(`Requested domains: ${formatRequestedDomains(state.preflight.requestedDomains)}`);
  lines.push(`Primary domain: ${formatPrimaryDomainLabel(primaryDomain)}`);
  lines.push(`Active bounded path: ${summarizeBoundedPath(state)}`);
  lines.push(`Primary target: ${topTarget ? `${topTarget.kind} ${topTarget.path}` : 'undetected'}`);
  lines.push(`Repair attempts: ${state.runtime.repairAttempts}`);
  lines.push(`Validation status: ${state.runtime.validationResults.length === 0 ? 'not run yet' : state.runtime.validationResults.every(result => result.exitCode === 0) ? 'passed' : 'failed'}`);
  lines.push(`Approval signals: ${state.runtime.approvalSignals.length}`);

  if (topValidationIssue) {
    lines.push(`Top validation issue: ${topValidationIssue.kind}`);
  } else {
    lines.push('Top validation issue: none');
  }

  return lines;
}

export function printInspection(inspection: WorkspaceInspection): void {
  printHeader('Workspace Inspection');
  process.stdout.write(`workspace: ${inspection.workspaceRoot}\n`);
  process.stdout.write(`profile: ${inspection.profile.label} (${inspection.profile.id})\n`);
  process.stdout.write(`workspace config: ${inspection.config ? 'present' : 'absent'}\n`);
  process.stdout.write(`helm charts: ${inspection.helmCharts.length}\n`);
  process.stdout.write(`pulumi projects: ${inspection.pulumiProjects.length}\n`);
  process.stdout.write(`pulumi stack files: ${inspection.fileCounts.pulumiStackFiles}\n\n`);
  process.stdout.write(`terraform roots: ${inspection.terraformRoots.length}\n`);
  process.stdout.write(`terraform tfvars files: ${inspection.fileCounts.terraformVariableFiles}\n\n`);

  printHeader('Helm Charts');
  printList(
    inspection.helmCharts.map(chart => {
      const features = [
        chart.hasValuesFile ? 'values' : 'missing-values',
        chart.hasTemplatesDir ? 'templates' : 'missing-templates'
      ].join(', ');
      return `${chart.chartRoot} (${features})`;
    }),
    'No Helm charts detected.'
  );

  process.stdout.write('\n');

  printHeader('Pulumi Projects');
  printList(
    inspection.pulumiProjects.map(project => `${project.projectRoot} (${project.stackFiles.length} stack file(s))`),
    'No Pulumi projects detected.'
  );

  process.stdout.write('\n');

  printHeader('Terraform Roots');
  printList(
    inspection.terraformRoots.map(root => `${root.rootPath} (${root.tfFiles.length} .tf file(s), ${root.tfvarsFiles.length} tfvars file(s))`),
    'No Terraform roots detected.'
  );

  process.stdout.write('\n');

  printHeader('Domain Capabilities');
  printList(
    inspection.domainCapabilities.map(formatDomainCapability),
    'No supported infra domains detected.'
  );
}

export function printValidationPreflight(preflight: ValidationPreflight): void {
  printHeader('Validator Availability');
  printList(
    preflight.validators.map(validator => `${validator.name}: ${validator.available ? validator.resolvedPath : 'missing'}`),
    'No validators configured.'
  );

  process.stdout.write('\n');
  process.stdout.write(`workspace config validation: ${preflight.usedWorkspaceConfig ? 'enabled' : 'disabled'}\n\n`);

  printHeader('Validation Plan');
  printList(
    preflight.plan.flatMap(entry => entry.commands.map(command => `${entry.kind} ${entry.target}: ${command}`)),
    'No validation targets detected.'
  );
}

export function printRunPreflight(state: RunPreflightState): void {
  printHeader('Run Preflight');
  process.stdout.write(`task: ${state.task}\n`);
  process.stdout.write(`workspace: ${state.workspaceRoot}\n\n`);
  printHeader('Operation Snapshot');
  printList(summarizePreflightSnapshot(state), 'No snapshot available.');
  process.stdout.write('\n');
  printHeader('Suggested Commands');
  printList(summarizePreflightSuggestedCommands(state), 'No suggested commands available.');
  process.stdout.write('\n');
  printHeader('Profile');
  process.stdout.write(`${state.profile.label} (${state.profile.id})\n`);
  printList(state.profile.reasons, 'No profile reasons recorded.');
  process.stdout.write('\n');

  printHeader('Explicit Approval');
  process.stdout.write(
    `approved write risks: ${state.approval.approvedWriteRisks.length > 0 ? state.approval.approvedWriteRisks.join(', ') : 'none'}\n`
  );
  process.stdout.write(
    `approved write paths: ${state.approval.approvedWritePaths.length > 0 ? state.approval.approvedWritePaths.join(', ') : 'none'}\n`
  );
  process.stdout.write('\n');

  printHeader('Effective Approval Policy');
  process.stdout.write(
    `required write risks: ${state.effectiveApprovalPolicy.requiredWriteRisks.length > 0 ? state.effectiveApprovalPolicy.requiredWriteRisks.join(', ') : 'none'}\n`
  );
  printList(
    state.effectiveApprovalPolicy.pathRules.map(
      rule => `${rule.path}: ${rule.requiredWriteRisks.join(', ')}`
    ),
    'No path-scoped approval rules.'
  );
  printList(state.effectiveApprovalPolicy.sources, 'No approval policy sources recorded.');
  process.stdout.write('\n');

  printHeader('Effective Edit Policy');
  process.stdout.write(
    `allowed edit plan kinds: ${state.effectiveEditPolicy.allowedEditPlanKinds ? state.effectiveEditPolicy.allowedEditPlanKinds.join(', ') : 'unrestricted'}\n`
  );
  process.stdout.write(
    `allowed target prefixes: ${state.effectiveEditPolicy.allowedTargetPrefixes ? state.effectiveEditPolicy.allowedTargetPrefixes.join(', ') : 'unrestricted'}\n`
  );
  printList(
    Object.entries(state.effectiveEditPolicy.allowedTargetPrefixesByKind).map(
      ([kind, prefixes]) => `${kind}: ${prefixes.join(', ')}`
    ),
    'No kind-scoped target constraints.'
  );
  printList(state.effectiveEditPolicy.sources, 'No edit policy sources recorded.');
  process.stdout.write('\n');

  printHeader('Domain Capabilities');
  printList(
    state.inspection.domainCapabilities.map(formatDomainCapability),
    'No supported infra domains detected.'
  );
  process.stdout.write('\n');

  printHeader('Targeting');
  process.stdout.write(`requested environment: ${state.requestedEnvironment ?? 'undetected'}\n`);
  process.stdout.write(`requested service: ${state.requestedService ?? 'undetected'}\n`);
  printList(
    state.targetCandidates.slice(0, 5).map(candidate => {
      const reasons = candidate.reasons.length > 0 ? ` [${candidate.reasons.join('; ')}]` : '';
      const details = candidate.details && candidate.details.length > 0 ? ` {${candidate.details.join(' | ')}}` : '';
      return `${candidate.kind} ${candidate.path} score=${candidate.score}${reasons}${details}`;
    }),
    'No target candidates detected.'
  );
  process.stdout.write('\n');

  printInspection(state.inspection);
  process.stdout.write('\n\n');
  printValidationPreflight(state.validation);
  process.stdout.write('\n\n');

  printHeader('Assumptions');
  printList(state.assumptions, 'No preflight assumptions detected.');
  process.stdout.write('\n');

  printHeader('Blockers');
  printList(state.blockers, 'No preflight blockers detected.');
  process.stdout.write('\n');

  printHeader('Next Actions');
  printList(state.nextActions, 'No next actions generated.');
}

export function printAgentRunState(state: AgentRunState): void {
  printHeader('Agent Runtime');
  process.stdout.write(`planning model: ${state.modelName}\n`);
  process.stdout.write(`outcome: ${state.outcome}\n`);
  process.stdout.write(`turn count: ${state.turns.length}\n`);
  process.stdout.write(`repair attempts: ${state.runtime.repairAttempts}\n`);
  process.stdout.write('\n');
  printHeader('Result Summary');
  printList(summarizeResultCard(state), 'No result summary available.');
  process.stdout.write('\n');
  printHeader('Operation Snapshot');
  printList(summarizeAgentSnapshot(state), 'No snapshot available.');
  process.stdout.write('\n');
  printHeader('Recommended Next Step');
  printList(summarizeRecommendedNextSteps(state), 'No next step summary available.');
  process.stdout.write('\n');
  printHeader('Suggested Commands');
  printList(summarizeSuggestedCommands(state), 'No suggested commands available.');

  for (let index = 0; index < state.turns.length; index += 1) {
    const turn = state.turns[index];
    const decision = turn.decision;
    process.stdout.write('\n');
    printHeader(`Turn ${index + 1}`);
    process.stdout.write(`confidence: ${decision.confidence}\n`);
    process.stdout.write(`action: ${decision.action.kind}\n`);
    process.stdout.write(`summary: ${decision.action.summary}\n`);
    process.stdout.write(`rationale: ${decision.action.rationale}\n`);

    if (decision.action.payload?.questions && decision.action.payload.questions.length > 0) {
      printList(decision.action.payload.questions, 'No clarifying questions.');
    }

    if (decision.action.payload?.clarificationKind) {
      process.stdout.write(`clarification kind: ${decision.action.payload.clarificationKind}\n`);
    }

    if (decision.action.payload?.actionFamily) {
      process.stdout.write(`action family: ${decision.action.payload.actionFamily}\n`);
    }

    if (decision.action.payload?.targetPaths && decision.action.payload.targetPaths.length > 0) {
      printList(decision.action.payload.targetPaths, 'No target paths selected.');
    }

    if (decision.action.payload?.commands && decision.action.payload.commands.length > 0) {
      printList(decision.action.payload.commands, 'No commands selected.');
    }

    if (decision.action.payload?.writes && decision.action.payload.writes.length > 0) {
      printList(
        decision.action.payload.writes.map(write =>
          `${write.path} [${write.mode ?? 'rewrite'}, risk=${write.risk ?? 'high'}]: ${write.reason}${write.patchHint ? ` (${write.patchHint})` : ''}`
        ),
        'No writes selected.'
      );
    }

    const execution = turn.execution;
    if (execution) {
      process.stdout.write('\n');
      printHeader(`Tool Result ${index + 1}`);
      process.stdout.write(`status: ${execution.status}\n`);
      if (execution.reason) {
        process.stdout.write(`reason: ${execution.reason}\n`);
      }
      printList(
        execution.executedTools.map(result => `${result.toolName} (${result.safety})`),
        'No tools executed.'
      );

      for (const toolResult of execution.executedTools) {
        if (toolResult.toolName === 'search_workspace') {
          const output = toolResult.output as SearchWorkspaceOutput;
          printList(
            output.matches.map(match => `${match.kind} ${match.path}${match.line ? `:${match.line}` : ''}`),
            'No search matches found.'
          );
        }

        if (toolResult.toolName === 'diff_preview') {
          const output = toolResult.output as DiffPreviewOutput;
          printList(
            [
              `${output.path} exists=${output.exists ? 'yes' : 'no'} +${output.addedLines} -${output.removedLines}`,
              ...output.preview
            ],
            'No diff preview available.'
          );
        }

        if (toolResult.toolName === 'helm_show_values') {
          const output = toolResult.output as HelmShowValuesOutput;
          printList(
            [
              `${output.chartPath} -> exit ${output.exitCode}`,
              ...output.content.split('\n').filter(Boolean).slice(0, 4)
            ],
            'No Helm values output available.'
          );
        }

        if (toolResult.toolName === 'helm_show_chart') {
          const output = toolResult.output as HelmShowChartOutput;
          printList(
            [
              `${output.chartPath} -> exit ${output.exitCode}`,
              ...output.content.split('\n').filter(Boolean).slice(0, 4)
            ],
            'No Helm chart metadata available.'
          );
        }

        if (toolResult.toolName === 'append_file') {
          const output = toolResult.output as { path: string; bytesWritten: number };
          printList(
            [`${output.path}: appended ${output.bytesWritten} bytes`],
            'No append output available.'
          );
        }

        if (toolResult.toolName === 'replace_file') {
          const output = toolResult.output as { path: string; bytesWritten: number };
          printList(
            [`${output.path}: replaced bounded segment and wrote ${output.bytesWritten} bytes`],
            'No replace output available.'
          );
        }

        if (toolResult.toolName === 'validate_targets') {
          const output = toolResult.output as ValidationRunOutput;
          printList(
            output.results.map(result => `${result.command} -> exit ${result.exitCode}`),
            'No validator commands executed.'
          );
        }
      }
    }
  }

  process.stdout.write('\n');
  printHeader('Validation Issues');
  printList(
    state.runtime.validationIssues.map(issue =>
      `${issue.kind} (${issue.repairable ? 'repairable' : 'blocker'}): ${issue.message}${issue.guidance ? ` Guidance: ${issue.guidance}` : ''}`
    ),
    'No validation issues recorded.'
  );

  process.stdout.write('\n');
  printHeader('Approval Signals');
  printList(
    state.runtime.approvalSignals.map(signal => `${signal.kind} ${signal.path} [risk=${signal.risk}]: ${signal.message}`),
    'No approval signals recorded.'
  );

  process.stdout.write('\n\n');
  printRunPreflight(state.preflight);
}
