import { cwd, exit } from 'node:process';
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectWorkspace } from '../domain/inspect-workspace.ts';
import { buildRunPreflight } from '../agent/build-run-preflight.ts';
import { runSingleStep } from '../agent/run-single-step.ts';
import { buildValidationPreflight } from '../validators/preflight.ts';
import type { PlannerMode } from '../model/config.ts';
import type { FileWriteRisk } from '../types/edit-plan.ts';
import type { InfraDomainId } from '../types/repository.ts';
import { prefetchWorkspaceKnowledge } from '../knowledge/prefetch.ts';
import { buildWorkspaceInfraGraph } from '../impact/workspace-graph.ts';
import { attachTerraformPlanToGraph } from '../impact/terraform-plan-graph.ts';
import { attachPulumiPreviewToGraph } from '../impact/pulumi-preview-graph.ts';
import {
  buildCompactAgentRunResult,
  printAgentRunState,
  printInfraGraph,
  printInspection,
  printKnowledgePrefetchResult,
  printRunPreflight,
  printValidationPreflight
} from './output.ts';

export interface ParsedArgs {
  command: 'inspect' | 'run' | 'agent' | 'validate' | 'prefetch' | 'graph' | 'help';
  task: string | null;
  workspace: string;
  json: boolean;
  jsonFull: boolean;
  planner: PlannerMode;
  approvedWritePaths: string[];
  approvedWriteRisks: FileWriteRisk[];
  maxTurns: number | null;
  domains: InfraDomainId[];
  targetPaths: string[];
  maxSources: number | null;
  terraformPlanPaths: string[];
  pulumiPreviewPaths: string[];
}

function printUsage(): void {
  process.stdout.write(
    [
      'infra-agent',
      '',
      'Usage:',
      '  infra-agent inspect [workspace] [--json]',
      '  infra-agent validate [workspace] [--json]',
      '  infra-agent graph [workspace] [--terraform-plan <plan.json>] [--pulumi-preview <preview.json>] [--target <root>] [--json]',
      '  infra-agent prefetch [workspace] [--domain helm|pulumi|terraform] [--target <path>] [--max-sources <n>] [--json]',
      '  infra-agent agent "<task>" [--workspace <path>] [--planner auto|llm|rule-based] [--max-turns <n>] [--approve-write-risk <low|medium|high>] [--approve-write-path <path>] [--json] [--json-full]',
      '  infra-agent run "<task>" [--workspace <path>] [--approve-write-risk <low|medium|high>] [--approve-write-path <path>] [--json]',
      ''
    ].join('\n')
  );
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  exit(1);
}

export function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    return {
      command: 'help',
      task: null,
      workspace: cwd(),
      json: false,
      jsonFull: false,
      planner: 'auto',
      approvedWritePaths: [],
      approvedWriteRisks: [],
      maxTurns: null,
      domains: [],
      targetPaths: [],
      maxSources: null,
      terraformPlanPaths: [],
      pulumiPreviewPaths: []
    };
  }

  const commandName = argv[0];
  const rest = argv.slice(1);
  const jsonFull = rest.includes('--json-full');
  const json = rest.includes('--json') || jsonFull;
  const cleanArgs = rest.filter(arg => arg !== '--json' && arg !== '--json-full');

  if (commandName === 'inspect' || commandName === 'validate') {
    const workspace = cleanArgs[0] ?? cwd();
    return {
      command: commandName,
      task: null,
      workspace,
      json,
      jsonFull,
      planner: 'auto',
      approvedWritePaths: [],
      approvedWriteRisks: [],
      maxTurns: null,
      domains: [],
      targetPaths: [],
      maxSources: null,
      terraformPlanPaths: [],
      pulumiPreviewPaths: []
    };
  }

  if (commandName === 'graph') {
    let workspace = cwd();
    const targetPaths: string[] = [];
    const terraformPlanPaths: string[] = [];
    const pulumiPreviewPaths: string[] = [];
    const positionalArgs: string[] = [];

    for (let index = 0; index < cleanArgs.length; index += 1) {
      const arg = cleanArgs[index];

      if (arg === '--terraform-plan') {
        const planPath = cleanArgs[index + 1];
        if (!planPath) {
          fail('Missing value for --terraform-plan.');
        }

        terraformPlanPaths.push(planPath);
        index += 1;
        continue;
      }

      if (arg === '--pulumi-preview') {
        const previewPath = cleanArgs[index + 1];
        if (!previewPath) {
          fail('Missing value for --pulumi-preview.');
        }

        pulumiPreviewPaths.push(previewPath);
        index += 1;
        continue;
      }

      if (arg === '--target') {
        const targetValue = cleanArgs[index + 1];
        if (!targetValue) {
          fail('Missing value for --target.');
        }

        targetPaths.push(targetValue);
        index += 1;
        continue;
      }

      if (arg.startsWith('--')) {
        fail(`Unknown graph option: ${arg}`);
      }

      positionalArgs.push(arg);
    }

    if (positionalArgs.length > 1) {
      fail('graph accepts at most one workspace path.');
    }

    workspace = positionalArgs[0] ?? workspace;

    return {
      command: 'graph',
      task: null,
      workspace,
      json,
      jsonFull,
      planner: 'auto',
      approvedWritePaths: [],
      approvedWriteRisks: [],
      maxTurns: null,
      domains: [],
      targetPaths,
      maxSources: null,
      terraformPlanPaths,
      pulumiPreviewPaths
    };
  }

  if (commandName === 'prefetch') {
    let workspace = cwd();
    let maxSources: number | null = null;
    const domains: InfraDomainId[] = [];
    const targetPaths: string[] = [];
    const positionalArgs: string[] = [];

    for (let index = 0; index < cleanArgs.length; index += 1) {
      const arg = cleanArgs[index];

      if (arg === '--domain') {
        const domainValue = cleanArgs[index + 1];
        if (domainValue !== 'helm' && domainValue !== 'pulumi' && domainValue !== 'terraform') {
          fail('Missing or invalid value for --domain. Expected helm, pulumi, or terraform.');
        }

        domains.push(domainValue);
        index += 1;
        continue;
      }

      if (arg === '--target') {
        const targetValue = cleanArgs[index + 1];
        if (!targetValue) {
          fail('Missing value for --target.');
        }

        targetPaths.push(targetValue);
        index += 1;
        continue;
      }

      if (arg === '--max-sources') {
        const maxSourcesValue = cleanArgs[index + 1];
        const parsedMaxSources = Number(maxSourcesValue);
        if (!maxSourcesValue || !Number.isInteger(parsedMaxSources) || parsedMaxSources < 1) {
          fail('Missing or invalid value for --max-sources. Expected a positive integer.');
        }

        maxSources = parsedMaxSources;
        index += 1;
        continue;
      }

      if (arg.startsWith('--')) {
        fail(`Unknown prefetch option: ${arg}`);
      }

      positionalArgs.push(arg);
    }

    if (positionalArgs.length > 1) {
      fail('prefetch accepts at most one workspace path.');
    }

    workspace = positionalArgs[0] ?? workspace;

    return {
      command: 'prefetch',
      task: null,
      workspace,
      json,
      jsonFull,
      planner: 'auto',
      approvedWritePaths: [],
      approvedWriteRisks: [],
      maxTurns: null,
      domains,
      targetPaths,
      maxSources,
      terraformPlanPaths: [],
      pulumiPreviewPaths: []
    };
  }

  if (commandName === 'run' || commandName === 'agent') {
    let workspace = cwd();
    let planner: PlannerMode = 'auto';
    let maxTurns: number | null = null;
    const approvedWritePaths: string[] = [];
    const approvedWriteRisks: FileWriteRisk[] = [];
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

      if (arg === '--max-turns') {
        const maxTurnsValue = cleanArgs[index + 1];
        const parsedMaxTurns = Number(maxTurnsValue);
        if (!maxTurnsValue || !Number.isInteger(parsedMaxTurns) || parsedMaxTurns < 1) {
          fail('Missing or invalid value for --max-turns. Expected a positive integer.');
        }

        maxTurns = parsedMaxTurns;
        index += 1;
        continue;
      }

      if (arg === '--approve-write-path') {
        const pathValue = cleanArgs[index + 1];
        if (!pathValue) {
          fail('Missing value for --approve-write-path.');
        }

        approvedWritePaths.push(pathValue);
        index += 1;
        continue;
      }

      if (arg === '--approve-write-risk') {
        const riskValue = cleanArgs[index + 1];
        if (riskValue !== 'low' && riskValue !== 'medium' && riskValue !== 'high') {
          fail('Missing or invalid value for --approve-write-risk. Expected low, medium, or high.');
        }

        approvedWriteRisks.push(riskValue);
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
      jsonFull,
      planner,
      approvedWritePaths,
      approvedWriteRisks,
      maxTurns,
      domains: [],
      targetPaths: [],
      maxSources: null,
      terraformPlanPaths: [],
      pulumiPreviewPaths: []
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

  if (parsed.command === 'graph') {
    const inspection = await inspectWorkspace(parsed.workspace);
    let graph = buildWorkspaceInfraGraph(inspection);

    for (const planPath of parsed.terraformPlanPaths) {
      const resolvedPlanPath = isAbsolute(planPath) ? planPath : resolve(parsed.workspace, planPath);
      const planContent = await readFile(resolvedPlanPath, 'utf8');
      graph = attachTerraformPlanToGraph(graph, JSON.parse(planContent) as unknown, {
        targetPath: parsed.targetPaths[0] ?? null
      });
    }

    for (const previewPath of parsed.pulumiPreviewPaths) {
      const resolvedPreviewPath = isAbsolute(previewPath) ? previewPath : resolve(parsed.workspace, previewPath);
      const previewContent = await readFile(resolvedPreviewPath, 'utf8');
      graph = attachPulumiPreviewToGraph(graph, JSON.parse(previewContent) as unknown, {
        targetPath: parsed.targetPaths[0] ?? null
      });
    }

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(graph, null, 2)}\n`);
      return;
    }

    printInfraGraph(graph);
    return;
  }

  if (parsed.command === 'prefetch') {
    const inspection = await inspectWorkspace(parsed.workspace);
    const result = await prefetchWorkspaceKnowledge(inspection, {
      domains: parsed.domains,
      targetPaths: parsed.targetPaths,
      maxSources: parsed.maxSources ?? undefined
    });

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }

    printKnowledgePrefetchResult(result);
    return;
  }

  if (parsed.command === 'agent') {
    const agentRunState = await runSingleStep(parsed.task, parsed.workspace, undefined, parsed.planner, {
      approvedWritePaths: parsed.approvedWritePaths,
      approvedWriteRisks: parsed.approvedWriteRisks
    }, {
      maxTurns: parsed.maxTurns ?? undefined
    });
    if (parsed.json) {
      const payload = parsed.jsonFull ? agentRunState : buildCompactAgentRunResult(agentRunState);
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      return;
    }

    printAgentRunState(agentRunState);
    return;
  }

  const preflight = await buildRunPreflight(parsed.task, parsed.workspace, {
    approvedWritePaths: parsed.approvedWritePaths,
    approvedWriteRisks: parsed.approvedWriteRisks
  });
  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(preflight, null, 2)}\n`);
    return;
  }

  printRunPreflight(preflight);
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  main().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`infra-agent failed: ${message}\n`);
    exit(1);
  });
}
