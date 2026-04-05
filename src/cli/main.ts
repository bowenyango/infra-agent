import { cwd, exit } from 'node:process';
import { inspectWorkspace } from '../domain/inspect-workspace.ts';
import { buildRunPreflight } from '../agent/build-run-preflight.ts';
import { buildValidationPreflight } from '../validators/preflight.ts';
import { printInspection, printRunPreflight, printValidationPreflight } from './output.ts';

interface ParsedArgs {
  command: 'inspect' | 'run' | 'validate' | 'help';
  task: string | null;
  workspace: string;
  json: boolean;
}

function printUsage(): void {
  process.stdout.write(
    [
      'infra-agent',
      '',
      'Usage:',
      '  infra-agent inspect [workspace] [--json]',
      '  infra-agent validate [workspace] [--json]',
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
      json: false
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
      json
    };
  }

  if (commandName === 'run') {
    const workspaceFlagIndex = cleanArgs.indexOf('--workspace');
    let workspace = cwd();
    let taskArgs = cleanArgs;

    if (workspaceFlagIndex >= 0) {
      const workspaceValue = cleanArgs[workspaceFlagIndex + 1];
      if (!workspaceValue) {
        fail('Missing value for --workspace.');
      }

      workspace = workspaceValue;
      taskArgs = cleanArgs.filter((_, index) => index !== workspaceFlagIndex && index !== workspaceFlagIndex + 1);
    }

    const task = taskArgs.join(' ').trim();
    if (task.length === 0) {
      fail('run requires a non-empty task string.');
    }

    return {
      command: 'run',
      task,
      workspace,
      json
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
