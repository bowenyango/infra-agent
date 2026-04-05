import type { AgentRunState } from '../agent/run-single-step.ts';
import type {
  RunPreflightState,
  ValidationPreflight,
  WorkspaceInspection
} from '../types/repository.ts';

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
  process.stdout.write(`helm charts: ${inspection.helmCharts.length}\n`);
  process.stdout.write(`pulumi projects: ${inspection.pulumiProjects.length}\n`);
  process.stdout.write(`pulumi stack files: ${inspection.fileCounts.pulumiStackFiles}\n\n`);

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
}

export function printValidationPreflight(preflight: ValidationPreflight): void {
  printHeader('Validator Availability');
  printList(
    preflight.validators.map(validator => `${validator.name}: ${validator.available ? validator.resolvedPath : 'missing'}`),
    'No validators configured.'
  );

  process.stdout.write('\n');

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

  printHeader('Targeting');
  process.stdout.write(`requested environment: ${state.requestedEnvironment ?? 'undetected'}\n`);
  process.stdout.write(`requested service: ${state.requestedService ?? 'undetected'}\n`);
  printList(
    state.targetCandidates.slice(0, 5).map(candidate => {
      const reasons = candidate.reasons.length > 0 ? ` [${candidate.reasons.join('; ')}]` : '';
      return `${candidate.kind} ${candidate.path} score=${candidate.score}${reasons}`;
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
  process.stdout.write(`decision confidence: ${state.decision.confidence}\n`);
  process.stdout.write(`decision: ${state.decision.action.kind}\n`);
  process.stdout.write(`summary: ${state.decision.action.summary}\n`);
  process.stdout.write(`rationale: ${state.decision.action.rationale}\n`);

  if (state.decision.action.payload?.questions && state.decision.action.payload.questions.length > 0) {
    process.stdout.write('\n');
    printHeader('Clarifying Questions');
    printList(state.decision.action.payload.questions, 'No clarifying questions.');
  }

  if (state.decision.action.payload?.targetPaths && state.decision.action.payload.targetPaths.length > 0) {
    process.stdout.write('\n');
    printHeader('Target Paths');
    printList(state.decision.action.payload.targetPaths, 'No target paths selected.');
  }

  if (state.decision.action.payload?.commands && state.decision.action.payload.commands.length > 0) {
    process.stdout.write('\n');
    printHeader('Planned Commands');
    printList(state.decision.action.payload.commands, 'No commands selected.');
  }

  if (state.execution) {
    process.stdout.write('\n');
    printHeader('Execution');
    process.stdout.write(`status: ${state.execution.status}\n`);
    if (state.execution.reason) {
      process.stdout.write(`reason: ${state.execution.reason}\n`);
    }
    printList(
      state.execution.executedTools.map(result => `${result.toolName} (${result.safety})`),
      'No tools executed.'
    );
  }

  process.stdout.write('\n\n');
  printRunPreflight(state.preflight);
}
