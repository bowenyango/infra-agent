import { cwd, exit } from 'node:process';
import { inspectWorkspace } from '../domain/inspect-workspace.ts';
import { buildRunPreflight } from '../agent/build-run-preflight.ts';
import { runSingleStep } from '../agent/run-single-step.ts';
import { buildValidationPreflight } from '../validators/preflight.ts';
import type { PlannerMode } from '../model/config.ts';
import { printAgentRunState, printInspection, printRunPreflight, printValidationPreflight } from './output.ts';

interface ParsedArgs {
  command: 'inspect' | 'run' | 'agent' | 'validate' | 'help';
  task: string | null;
  workspace: string;
  json: boolean;
  planner: PlannerMode;
}

function printUsage(): void {
  process.stdout.write(
    [
      'infra-agent',
      '',
      'Usage:',
      '  infra-agent inspect [workspace] [--json]',
      '  infra-agent validate [workspace] [--json]',
      '  infra-agent agent "<task>" [--workspace <path>] [--planner auto|llm|rule-based] [--json]',
      '  infra-agent run "<task>" [--workspace <path>] [--json]',
      ''
    ].join('\n')
  );
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    return {
      command: 'help',
      task: null,
      workspace: cwd(),
      json: false,
      planner: 'auto'
    };
  }

  const commandName = argv[0];
  const rest = argv.slice(1);
  const json = rest.includes('--json');
  const cleanArgs = rest.filter(arg => arg !== '--json');

  if (commandName === 'inspect' || commandName === 'validate') {
    const workspace = cleanArgs[0] ?? cwd();
    return {
      command: commandName,
      task: null,
      workspace,
      json,
      planner: 'auto'
    };
  }

  if (commandName === 'run' || commandName === 'agent') {
    let workspace = cwd();
    let planner: PlannerMode = 'auto';
    const taskArgs: string[] = [];

    for (let index = 0; index < cleanArgs.length; index += 1) {
      const arg = cleanArgs[index];

      if (arg === '--workspace') {
        const workspaceValue = cleanArgs[index + 1];
        if (!workspaceValue) {
          fail('Missing value for --workspace.');
        }

        workspace = workspaceValue;
        index += 1;
        continue;
      }

      if (arg === '--planner') {
        const plannerValue = cleanArgs[index + 1];
        if (plannerValue !== 'auto' && plannerValue !== 'llm' && plannerValue !== 'rule-based') {
          fail('Missing or invalid value for --planner. Expected auto, llm, or rule-based.');
        }

        planner = plannerValue;
        index += 1;
        continue;
      }

      taskArgs.push(arg);
    }

    const task = taskArgs.join(' ').trim();
    if (task.length === 0) {
      fail(`${commandName} requires a non-empty task string.`);
    }

    return {
      command: commandName,
      task,
      workspace,
      json,
      planner
    };
  }

  fail(`Unknown command: ${commandName}`);
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.command === 'help') {
    printUsage();
    return;
  }

  if (parsed.command === 'inspect') {
    const inspection = await inspectWorkspace(parsed.workspace);
    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(inspection, null, 2)}\n`);
      return;
    }

    printInspection(inspection);
    return;
  }

  if (parsed.command === 'validate') {
    const inspection = await inspectWorkspace(parsed.workspace);
    const validationPreflight = buildValidationPreflight(inspection);

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(validationPreflight, null, 2)}\n`);
      return;
    }

    printValidationPreflight(validationPreflight);
    return;
  }

  if (parsed.command === 'agent') {
    const agentRunState = await runSingleStep(parsed.task, parsed.workspace, undefined, parsed.planner);
    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(agentRunState, null, 2)}\n`);
      return;
    }

    printAgentRunState(agentRunState);
    return;
  }

  const preflight = await buildRunPreflight(parsed.task, parsed.workspace);
  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(preflight, null, 2)}\n`);
    return;
  }

  printRunPreflight(preflight);
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`infra-agent failed: ${message}\n`);
  exit(1);
});
