import type { AgentRunState } from '../agent/run-single-step.ts';
import type {
  RunPreflightState,
  ValidationPreflight,
  WorkspaceInspection
} from '../types/repository.ts';
import type { DiffPreviewOutput, SearchWorkspaceOutput, ValidationRunOutput } from '../types/tools.ts';

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
