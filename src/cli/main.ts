import { cwd, exit } from 'node:process';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectWorkspace } from '../domain/inspect-workspace.ts';
import { buildRunPreflight } from '../agent/build-run-preflight.ts';
import { runSingleStep } from '../agent/run-single-step.ts';
import { buildValidationPreflight } from '../validators/preflight.ts';
import type { LLMClientConfigOverrides, LLMProvider, PlannerMode } from '../model/config.ts';
import type { FileWriteRisk } from '../types/edit-plan.ts';
import type { KnowledgeUnitPrivacyScope, KnowledgeUnitType } from '../types/knowledge.ts';
import { KNOWLEDGE_UNIT_TYPES } from '../types/knowledge.ts';
import type { InfraDomainId } from '../types/repository.ts';
import type { ToolPermissionCategory } from '../agent/tool-permissions.ts';
import type { KnowledgeStorageScope } from '../knowledge/storage-policy.ts';
import { prefetchWorkspaceKnowledge } from '../knowledge/prefetch.ts';
import { buildKnowledgeSourcesReport } from '../knowledge/sources.ts';
import { buildKnowledgeCacheStatusReportFromSources } from '../knowledge/cache-status.ts';
import { extractWorkspaceKnowledgeFacts } from '../knowledge/extract.ts';
import {
  loadKnowledgeValidationReport,
  validateKnowledgePayload
} from '../knowledge/validate.ts';
import { buildKnowledgePack } from '../knowledge/pack.ts';
import { buildResourceKnowledgeReport } from '../knowledge/resource-report.ts';
import {
  buildPublicKnowledgeLibraryArtifact,
  buildPublicKnowledgeUrlReport
} from '../knowledge/url-report.ts';
import {
  buildKnowledgeUnitMetadataIndex,
  selectKnowledgeUnitIndexEntries,
  selectKnowledgeUnitIndexFieldEntries,
  type KnowledgeUnitIndexEntryFilter,
  type KnowledgeUnitMetadataIndex
} from '../knowledge/unit-index.ts';
import { publishSharedKnowledgeArtifact } from '../knowledge/shared-artifact-publish.ts';
import {
  buildKnowledgeArtifactManifest,
  hashKnowledgeArtifactFile
} from '../knowledge/artifact-manifest.ts';
import { buildWorkspaceInfraGraph } from '../impact/workspace-graph.ts';
import { buildChangedContextReport } from '../impact/changed-context.ts';
import { buildInventoryReport } from '../domain/inventory.ts';
import {
  buildChangedScopedPackReport,
  buildScopedPackReport,
  renderScopedPackMarkdown
} from '../domain/scoped-pack.ts';
import { buildRefsReport } from '../domain/refs.ts';
import type { ChangedContextFileInput } from '../types/changed-context.ts';
import { attachTerraformPlanToGraph } from '../impact/terraform-plan-graph.ts';
import { attachPulumiPreviewToGraph } from '../impact/pulumi-preview-graph.ts';
import { loadIdentityConflictIncidentReport } from './identity-report.ts';
import { loadInfraGraphImpactReport } from './infra-graph-report.ts';
import { buildDoctorReport } from './doctor.ts';
import { buildPlannerProviderCatalogReport } from './planner-provider-catalog.ts';
import { writeJsonArtifact } from './write-json-artifact.ts';
import {
  buildCompactAgentRunResult,
  printIdentityConflictIncidentReport,
  printInfraGraphImpactReport,
  printAgentRunState,
  printDoctorReport,
  printChangedContextReport,
  printInfraGraph,
  printInventoryReport,
  printInspection,
  printRefsReport,
  printKnowledgePrefetchResult,
  printKnowledgeExtractionReport,
  printKnowledgeCacheStatusReport,
  printKnowledgeSourcesReport,
  printKnowledgeValidationReport,
  printKnowledgePack,
  printResourceKnowledgeReport,
  printPublicKnowledgeUrlReport,
  printKnowledgeSharedArtifactPublishReport,
  printKnowledgeUnitMetadataIndex,
  printPlannerProviderCatalogReport,
  printRunPreflight,
  printValidationPreflight
} from './output.ts';
import { exitCodeForAgentOutcome, exitCodeForRunPreflight } from './exit-codes.ts';
import { readPackageVersion } from './package-metadata.ts';

export { readPackageVersion } from './package-metadata.ts';

const KNOWLEDGE_UNIT_PRIVACY_SCOPES = [
  'public-reference',
  'workspace-private',
  'internal-team',
  'private-run'
] as const satisfies readonly KnowledgeUnitPrivacyScope[];

const KNOWLEDGE_STORAGE_SCOPES = [
  'public-reference',
  'workspace-private'
] as const satisfies readonly KnowledgeStorageScope[];

export interface ParsedArgs {
  command: 'inspect' | 'inventory' | 'pack' | 'refs' | 'run' | 'agent' | 'validate' | 'prefetch' | 'knowledge' | 'cache' | 'graph' | 'changed' | 'impact-report' | 'identity-report' | 'doctor' | 'planner-providers' | 'version' | 'help';
  knowledgeAction?: 'sources' | 'prefetch' | 'extract' | 'validate' | 'pack' | 'index' | 'resource' | 'from-url' | 'publish' | null;
  cacheAction?: 'status' | null;
  task: string | null;
  workspace: string;
  inputPath: string | null;
  outputPath?: string | null;
  libraryOutputPath?: string | null;
  contentPath?: string | null;
  unitOutputDir?: string | null;
  manifestOutputPath?: string | null;
  publishStoreDir?: string | null;
  publishRegistryPath?: string | null;
  publishName?: string | null;
  publishVersion?: string | null;
  publishProvider?: string | null;
  publishPackageName?: string | null;
  publishChart?: string | null;
  publishModule?: string | null;
  publishAllowWorkspacePrivate?: boolean;
  validationWorkspace?: string | null;
  json: boolean;
  jsonFull: boolean;
  planner: PlannerMode;
  approvedWritePaths: string[];
  approvedWriteRisks: FileWriteRisk[];
  approvedToolCategories: ToolPermissionCategory[];
  llmProvider?: LLMProvider | null;
  llmModel?: string | null;
  llmBaseUrl?: string | null;
  maxTurns: number | null;
  maxRepairAttempts?: number | null;
  contextPacketLimit: number | null;
  contextTokenBudget: number | null;
  contextFactLimit?: number | null;
  domains: InfraDomainId[];
  targetPaths: string[];
  packScope?: string | null;
  packChanged?: boolean;
  refsScope?: string | null;
  refsResource?: string | null;
  knowledgeResource?: string | null;
  sourceIds?: string[];
  knowledgeIndexFilter?: KnowledgeUnitIndexEntryFilter;
  maxSources: number | null;
  maxFacts?: number | null;
  maxUnits?: number | null;
  terraformPlanPaths: string[];
  pulumiPreviewPaths: string[];
  changedBaseRef?: string | null;
  changedHeadRef?: string | null;
  changedFilePaths?: string[];
}

function printUsage(): void {
  process.stdout.write(
    [
      'infra-agent',
      '',
      'Usage:',
      '  infra-agent --version',
      '  infra-agent doctor [workspace] [--model <name>] [--openai-base-url <url>] [--llm-provider openai-compatible] [--json]',
      '  infra-agent planner-providers [--json]',
      '  infra-agent inspect [workspace] [--json]',
      '  infra-agent inventory [workspace] [--domain helm|pulumi|terraform] [--target <path>] [--json]',
      '  infra-agent pack [workspace] (--scope <path|target|env|stack> | --changed --base <ref>|--file <path>) [--head <ref>] [--domain helm|pulumi|terraform] [--json]',
      '  infra-agent cache status [workspace] [--domain helm|pulumi|terraform] [--target <path>] [--json]',
      '  infra-agent refs [workspace] (--scope <path|target|env|stack|resource> | --resource <identity>) [--domain helm|pulumi|terraform] [--max-units <n>] [--json]',
      '  infra-agent validate [workspace] [--json]',
      '  infra-agent graph [workspace] [--terraform-plan <plan.json>] [--pulumi-preview <preview.json>] [--target <root>] [--json]',
      '  infra-agent changed [workspace] [--base <ref>] [--head <ref>] [--file <path>] [--domain helm|pulumi|terraform] [--target <path>] [--json]',
      '  infra-agent impact-report <graph.json> [--json]',
      '  infra-agent identity-report <agent-result.json> [--json]',
      '  infra-agent prefetch [workspace] [--domain helm|pulumi|terraform] [--target <path>] [--max-sources <n>] [--json]',
      '  infra-agent knowledge sources [workspace] [--domain helm|pulumi|terraform] [--target <path>|--resource <identity>] [--json]',
      '  infra-agent knowledge prefetch [workspace] [--domain helm|pulumi|terraform] [--target <path>|--resource <identity>] [--max-sources <n>] [--json]',
      '  infra-agent knowledge extract [workspace] [--domain helm|pulumi|terraform] [--target <path>|--resource <identity>] [--source <id>] [--out <knowledge.json>] [--units-out <dir>] [--manifest-out <manifest.json>] [--json]',
      '  infra-agent knowledge validate <knowledge.json> [--workspace <workspace>] [--json]',
      '  infra-agent knowledge pack [workspace] [--domain helm|pulumi|terraform] [--target <path>|--resource <identity>] [--source <id>] [--max-units <n>] [--max-facts <n>] [--out <pack.json>] [--manifest-out <manifest.json>] [--json]',
      '  infra-agent knowledge index [workspace] [--domain helm|pulumi|terraform] [--target <path>|--resource <identity>] [--source <id>] [--max-units <n>] [--unit-type fact|guidance|example|diagnostic|recipe] [--field-path <path>] [--provider <addr>] [--package <name>] [--chart <name>] [--module <name>] [--version <version>] [--privacy-scope public-reference|workspace-private|internal-team|private-run] [--storage-scope public-reference|workspace-private] [--out <index.json>] [--json]',
      '  infra-agent knowledge resource [workspace] --resource <identity> [--domain helm|pulumi|terraform] [--source <id>] [--max-units <n>] [--out <resource-knowledge.json>] [--json]',
      '  infra-agent knowledge from-url <url> [--max-units <n>] [--content <markdown-or-html-file>] [--out <url-knowledge.json>] [--library-out <library-artifact.json>] [--json]',
      '  infra-agent knowledge publish <knowledge-units.json> --workspace <workspace> --store-dir <dir> --registry <registry.json> [--domain helm|pulumi|terraform] [--target <path>] [--name <name>] [--version <version>] [--provider <addr>] [--package <name>] [--chart <name>] [--module <name>] [--allow-workspace-private] [--out <report.json>] [--json]',
      '  infra-agent agent "<task>" [--workspace <path>] [--planner auto|llm|rule-based] [--model <name>] [--openai-base-url <url>] [--llm-provider openai-compatible] [--max-turns <n>] [--max-repair-attempts <n>] [--context-packet-limit <n>] [--context-token-budget <n>] [--context-fact-limit <n>] [--approve-write-risk <low|medium|high>] [--approve-write-path <path>] [--approve-tool-category <category>] [--json] [--json-full]',
      '  infra-agent run "<task>" [--workspace <path>] [--approve-write-risk <low|medium|high>] [--approve-write-path <path>] [--approve-tool-category <category>] [--json]',
      ''
    ].join('\n')
  );
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  exit(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasKnowledgeIndexFilter(filter: KnowledgeUnitIndexEntryFilter): boolean {
  return Object.keys(filter).length > 0;
}

function filterKnowledgeUnitMetadataIndex(
  index: KnowledgeUnitMetadataIndex,
  filter: KnowledgeUnitIndexEntryFilter
): KnowledgeUnitMetadataIndex {
  if (!hasKnowledgeIndexFilter(filter)) {
    return index;
  }

  const entries = selectKnowledgeUnitIndexEntries(index, filter);
  const fieldEntries = selectKnowledgeUnitIndexFieldEntries(index, filter);

  return {
    ...index,
    sourceCount: entries.length,
    includedUnitCount: entries.reduce((sum, entry) => sum + entry.includedUnitCount, 0),
    fieldEntryCount: fieldEntries.length,
    fieldIncludedUnitCount: fieldEntries.reduce((sum, entry) => sum + entry.includedUnitCount, 0),
    entries,
    fieldEntries
  };
}

async function readJsonObject(inputPath: string): Promise<Record<string, unknown>> {
  const payload = JSON.parse(await readFile(inputPath, 'utf8')) as unknown;
  if (!isRecord(payload)) {
    fail(`Expected ${inputPath} to contain a JSON object.`);
  }

  return payload;
}

function resolveFromCwd(inputPath: string): string {
  return isAbsolute(inputPath)
    ? inputPath
    : resolve(cwd(), inputPath);
}

function parseGitChangedStatus(value: string): ChangedContextFileInput['status'] {
  if (value.startsWith('A')) {
    return 'added';
  }
  if (value.startsWith('C')) {
    return 'copied';
  }
  if (value.startsWith('D')) {
    return 'deleted';
  }
  if (value.startsWith('R')) {
    return 'renamed';
  }
  if (value.startsWith('M')) {
    return 'modified';
  }

  return 'unknown';
}

function parseGitNameStatus(output: string): ChangedContextFileInput[] {
  return output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const columns = line.split('\t');
      const status = parseGitChangedStatus(columns[0] ?? '');
      if (status === 'renamed' && columns[1] && columns[2]) {
        return {
          path: columns[2],
          previousPath: columns[1],
          status
        };
      }

      return {
        path: columns[1] ?? columns[0] ?? line,
        status
      };
    });
}

function readGitChangedFiles(
  workspace: string,
  baseRef: string,
  headRef: string | null | undefined
): ChangedContextFileInput[] {
  const range = headRef ? `${baseRef}...${headRef}` : baseRef;
  const result = spawnSync('git', [
    '-C',
    workspace,
    'diff',
    '--name-status',
    range
  ], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024
  });

  if (result.error) {
    fail(`Unable to run git diff for changed context: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const message = result.stderr.trim() || result.stdout.trim() || `git diff exited with status ${result.status}`;
    fail(`Unable to read changed files: ${message}`);
  }

  return parseGitNameStatus(result.stdout);
}

async function writeKnowledgeUnitArtifacts(
  unitOutputDir: string,
  unitSets: Array<{ sourceId: string }>
): Promise<string[]> {
  const resolvedDir = resolveFromCwd(unitOutputDir);
  const outputPaths: string[] = [];

  for (const unitSet of unitSets) {
    outputPaths.push(await writeJsonArtifact(
      resolve(resolvedDir, `${unitSet.sourceId}.knowledge-units.json`),
      cwd(),
      unitSet
    ));
  }

  return outputPaths;
}

function isToolPermissionCategory(value: string | undefined): value is ToolPermissionCategory {
  return value === 'workspace-read'
    || value === 'workspace-write'
    || value === 'local-validation'
    || value === 'native-cli-read'
    || value === 'native-cli-validation'
    || value === 'native-cli-write'
    || value === 'native-stack-config-write'
    || value === 'approval-required'
    || value === 'unknown';
}

export function buildLLMClientConfigOverrides(parsed: Pick<ParsedArgs, 'llmProvider' | 'llmModel' | 'llmBaseUrl'>): LLMClientConfigOverrides {
  return {
    provider: parsed.llmProvider ?? undefined,
    model: parsed.llmModel ?? undefined,
    baseUrl: parsed.llmBaseUrl ?? undefined
  };
}

export function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 1 && (argv[0] === '--version' || argv[0] === '-v' || argv[0] === 'version')) {
    return {
      command: 'version',
      task: null,
      workspace: cwd(),
      inputPath: null,
      json: false,
      jsonFull: false,
      planner: 'auto',
      approvedWritePaths: [],
      approvedWriteRisks: [],
      approvedToolCategories: [],
      maxTurns: null,
      contextPacketLimit: null,
      contextTokenBudget: null,
      domains: [],
      targetPaths: [],
      maxSources: null,
      terraformPlanPaths: [],
      pulumiPreviewPaths: []
    };
  }

  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    return {
      command: 'help',
      task: null,
      workspace: cwd(),
      inputPath: null,
      json: false,
      jsonFull: false,
      planner: 'auto',
      approvedWritePaths: [],
      approvedWriteRisks: [],
      approvedToolCategories: [],
      maxTurns: null,
      contextPacketLimit: null,
      contextTokenBudget: null,
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
      inputPath: null,
      json,
      jsonFull,
      planner: 'auto',
      approvedWritePaths: [],
      approvedWriteRisks: [],
      approvedToolCategories: [],
      maxTurns: null,
      contextPacketLimit: null,
      contextTokenBudget: null,
      domains: [],
      targetPaths: [],
      maxSources: null,
      terraformPlanPaths: [],
      pulumiPreviewPaths: []
    };
  }

  if (commandName === 'inventory') {
    let workspace = cwd();
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
        const targetValue = cleanArgs[index + 1]?.trim();
        if (!targetValue) {
          fail('Missing value for --target.');
        }

        targetPaths.push(targetValue);
        index += 1;
        continue;
      }

      if (arg.startsWith('--')) {
        fail(`Unknown inventory option: ${arg}`);
      }

      positionalArgs.push(arg);
    }

    if (positionalArgs.length > 1) {
      fail('inventory accepts at most one workspace path.');
    }

    workspace = positionalArgs[0] ?? workspace;

    return {
      command: 'inventory',
      task: null,
      workspace,
      inputPath: null,
      json,
      jsonFull,
      planner: 'auto',
      approvedWritePaths: [],
      approvedWriteRisks: [],
      approvedToolCategories: [],
      maxTurns: null,
      contextPacketLimit: null,
      contextTokenBudget: null,
      domains,
      targetPaths,
      maxSources: null,
      terraformPlanPaths: [],
      pulumiPreviewPaths: []
    };
  }

  if (commandName === 'pack') {
    let workspace = cwd();
    let packScope: string | null = null;
    let packChanged = false;
    let changedBaseRef: string | null = null;
    let changedHeadRef: string | null = null;
    const changedFilePaths: string[] = [];
    const domains: InfraDomainId[] = [];
    const positionalArgs: string[] = [];

    for (let index = 0; index < cleanArgs.length; index += 1) {
      const arg = cleanArgs[index];

      if (arg === '--changed') {
        packChanged = true;
        continue;
      }

      if (arg === '--scope') {
        const scopeValue = cleanArgs[index + 1]?.trim();
        if (!scopeValue) {
          fail('Missing value for --scope.');
        }
        if (packScope !== null) {
          fail('--scope can be provided at most once.');
        }

        packScope = scopeValue;
        index += 1;
        continue;
      }

      if (arg === '--base') {
        const baseValue = cleanArgs[index + 1]?.trim();
        if (!baseValue) {
          fail('Missing value for --base.');
        }
        if (changedBaseRef !== null) {
          fail('--base can be provided at most once.');
        }

        changedBaseRef = baseValue;
        index += 1;
        continue;
      }

      if (arg === '--head') {
        const headValue = cleanArgs[index + 1]?.trim();
        if (!headValue) {
          fail('Missing value for --head.');
        }
        if (changedHeadRef !== null) {
          fail('--head can be provided at most once.');
        }

        changedHeadRef = headValue;
        index += 1;
        continue;
      }

      if (arg === '--file') {
        const fileValue = cleanArgs[index + 1]?.trim();
        if (!fileValue) {
          fail('Missing value for --file.');
        }

        changedFilePaths.push(fileValue);
        index += 1;
        continue;
      }

      if (arg === '--domain') {
        const domainValue = cleanArgs[index + 1];
        if (domainValue !== 'helm' && domainValue !== 'pulumi' && domainValue !== 'terraform') {
          fail('Missing or invalid value for --domain. Expected helm, pulumi, or terraform.');
        }

        domains.push(domainValue);
        index += 1;
        continue;
      }

      if (arg.startsWith('--')) {
        fail(`Unknown pack option: ${arg}`);
      }

      positionalArgs.push(arg);
    }

    if (positionalArgs.length > 1) {
      fail('pack accepts at most one workspace path.');
    }
    if (packScope !== null && packChanged) {
      fail('pack accepts either --scope or --changed, not both.');
    }
    if (packScope === null && !packChanged) {
      fail('pack requires --scope or --changed.');
    }
    if (!packChanged && (changedBaseRef !== null || changedHeadRef !== null || changedFilePaths.length > 0)) {
      fail('pack --base, --head, and --file require --changed.');
    }
    if (packChanged && changedFilePaths.length > 0 && changedBaseRef !== null) {
      fail('pack --changed accepts either --file values or --base/--head, not both.');
    }
    if (packChanged && changedHeadRef !== null && changedBaseRef === null) {
      fail('--head requires --base.');
    }
    if (packChanged && changedFilePaths.length === 0 && changedBaseRef === null) {
      fail('pack --changed requires --base or at least one --file.');
    }

    workspace = positionalArgs[0] ?? workspace;

    return {
      command: 'pack',
      task: null,
      workspace,
      inputPath: null,
      json,
      jsonFull,
      planner: 'auto',
      approvedWritePaths: [],
      approvedWriteRisks: [],
      approvedToolCategories: [],
      maxTurns: null,
      contextPacketLimit: null,
      contextTokenBudget: null,
      domains,
      targetPaths: [],
      packScope,
      packChanged,
      maxSources: null,
      terraformPlanPaths: [],
      pulumiPreviewPaths: [],
      changedBaseRef,
      changedHeadRef: changedBaseRef !== null ? changedHeadRef ?? 'HEAD' : null,
      changedFilePaths
    };
  }

  if (commandName === 'cache') {
    const cacheAction = cleanArgs[0];
    if (cacheAction !== 'status') {
      fail('cache requires a supported action: status.');
    }

    let workspace = cwd();
    const domains: InfraDomainId[] = [];
    const targetPaths: string[] = [];
    const positionalArgs: string[] = [];
    const actionArgs = cleanArgs.slice(1);

    for (let index = 0; index < actionArgs.length; index += 1) {
      const arg = actionArgs[index];

      if (arg === '--domain') {
        const domainValue = actionArgs[index + 1];
        if (domainValue !== 'helm' && domainValue !== 'pulumi' && domainValue !== 'terraform') {
          fail('Missing or invalid value for --domain. Expected helm, pulumi, or terraform.');
        }

        domains.push(domainValue);
        index += 1;
        continue;
      }

      if (arg === '--target') {
        const targetValue = actionArgs[index + 1]?.trim();
        if (!targetValue) {
          fail('Missing value for --target.');
        }

        targetPaths.push(targetValue);
        index += 1;
        continue;
      }

      if (arg.startsWith('--')) {
        fail(`Unknown cache status option: ${arg}`);
      }

      positionalArgs.push(arg);
    }

    if (positionalArgs.length > 1) {
      fail('cache status accepts at most one workspace path.');
    }

    workspace = positionalArgs[0] ?? workspace;

    return {
      command: 'cache',
      cacheAction,
      task: null,
      workspace,
      inputPath: null,
      json,
      jsonFull,
      planner: 'auto',
      approvedWritePaths: [],
      approvedWriteRisks: [],
      approvedToolCategories: [],
      maxTurns: null,
      contextPacketLimit: null,
      contextTokenBudget: null,
      domains,
      targetPaths,
      maxSources: null,
      terraformPlanPaths: [],
      pulumiPreviewPaths: []
    };
  }

  if (commandName === 'refs') {
    let workspace = cwd();
    let refsScope: string | null = null;
    let refsResource: string | null = null;
    let maxUnits: number | null = null;
    const domains: InfraDomainId[] = [];
    const positionalArgs: string[] = [];

    for (let index = 0; index < cleanArgs.length; index += 1) {
      const arg = cleanArgs[index];

      if (arg === '--scope') {
        const scopeValue = cleanArgs[index + 1]?.trim();
        if (!scopeValue) {
          fail('Missing value for --scope.');
        }
        if (refsScope !== null) {
          fail('--scope can be provided at most once.');
        }

        refsScope = scopeValue;
        index += 1;
        continue;
      }

      if (arg === '--resource') {
        const resourceValue = cleanArgs[index + 1]?.trim();
        if (!resourceValue) {
          fail('Missing value for --resource.');
        }
        if (refsResource !== null) {
          fail('--resource can be provided at most once.');
        }

        refsResource = resourceValue;
        index += 1;
        continue;
      }

      if (arg === '--domain') {
        const domainValue = cleanArgs[index + 1];
        if (domainValue !== 'helm' && domainValue !== 'pulumi' && domainValue !== 'terraform') {
          fail('Missing or invalid value for --domain. Expected helm, pulumi, or terraform.');
        }

        domains.push(domainValue);
        index += 1;
        continue;
      }

      if (arg === '--max-units') {
        const rawMaxUnits = cleanArgs[index + 1];
        const parsedMaxUnits = Number.parseInt(rawMaxUnits ?? '', 10);
        if (!Number.isInteger(parsedMaxUnits) || parsedMaxUnits < 1) {
          fail('Missing or invalid value for --max-units. Expected a positive integer.');
        }

        maxUnits = parsedMaxUnits;
        index += 1;
        continue;
      }

      if (arg.startsWith('--')) {
        fail(`Unknown refs option: ${arg}`);
      }

      positionalArgs.push(arg);
    }

    if (positionalArgs.length > 1) {
      fail('refs accepts at most one workspace path.');
    }
    if (refsScope !== null && refsResource !== null) {
      fail('refs accepts either --scope or --resource, not both.');
    }
    if (refsScope === null && refsResource === null) {
      fail('refs requires --scope or --resource.');
    }

    workspace = positionalArgs[0] ?? workspace;

    return {
      command: 'refs',
      task: null,
      workspace,
      inputPath: null,
      json,
      jsonFull,
      planner: 'auto',
      approvedWritePaths: [],
      approvedWriteRisks: [],
      approvedToolCategories: [],
      maxTurns: null,
      contextPacketLimit: null,
      contextTokenBudget: null,
      domains,
      targetPaths: [],
      refsScope,
      refsResource,
      maxSources: null,
      maxUnits,
      terraformPlanPaths: [],
      pulumiPreviewPaths: []
    };
  }

  if (commandName === 'doctor') {
    const positionalArgs: string[] = [];
    let llmProvider: LLMProvider | null = null;
    let llmModel: string | null = null;
    let llmBaseUrl: string | null = null;

    for (let index = 0; index < cleanArgs.length; index += 1) {
      const arg = cleanArgs[index];

      if (arg === '--model' || arg === '--llm-model') {
        const modelValue = cleanArgs[index + 1]?.trim();
        if (!modelValue) {
          fail(`Missing value for ${arg}.`);
        }
        if (llmModel !== null) {
          fail('LLM model can be provided at most once.');
        }

        llmModel = modelValue;
        index += 1;
        continue;
      }

      if (arg === '--openai-base-url' || arg === '--llm-base-url') {
        const baseUrlValue = cleanArgs[index + 1]?.trim();
        if (!baseUrlValue) {
          fail(`Missing value for ${arg}.`);
        }
        if (llmBaseUrl !== null) {
          fail('LLM base URL can be provided at most once.');
        }

        llmBaseUrl = baseUrlValue;
        index += 1;
        continue;
      }

      if (arg === '--llm-provider') {
        const providerValue = cleanArgs[index + 1];
        if (providerValue !== 'openai-compatible') {
          fail('Missing or invalid value for --llm-provider. Expected openai-compatible.');
        }
        if (llmProvider !== null) {
          fail('LLM provider can be provided at most once.');
        }

        llmProvider = providerValue;
        index += 1;
        continue;
      }

      if (arg.startsWith('--')) {
        fail(`Unknown doctor option: ${arg}`);
      }

      positionalArgs.push(arg);
    }

    if (positionalArgs.length > 1) {
      fail('doctor accepts at most one workspace path.');
    }

    return {
      command: 'doctor',
      task: null,
      workspace: positionalArgs[0] ?? cwd(),
      inputPath: null,
      json,
      jsonFull,
      planner: 'auto',
      llmProvider,
      llmModel,
      llmBaseUrl,
      approvedWritePaths: [],
      approvedWriteRisks: [],
      approvedToolCategories: [],
      maxTurns: null,
      contextPacketLimit: null,
      contextTokenBudget: null,
      domains: [],
      targetPaths: [],
      maxSources: null,
      terraformPlanPaths: [],
      pulumiPreviewPaths: []
    };
  }

  if (commandName === 'planner-providers') {
    if (cleanArgs.length > 0) {
      fail('planner-providers does not accept positional arguments or options other than --json.');
    }

    return {
      command: 'planner-providers',
      task: null,
      workspace: cwd(),
      inputPath: null,
      json,
      jsonFull,
      planner: 'auto',
      approvedWritePaths: [],
      approvedWriteRisks: [],
      approvedToolCategories: [],
      maxTurns: null,
      contextPacketLimit: null,
      contextTokenBudget: null,
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
      inputPath: null,
      json,
      jsonFull,
      planner: 'auto',
      approvedWritePaths: [],
      approvedWriteRisks: [],
      approvedToolCategories: [],
      maxTurns: null,
      contextPacketLimit: null,
      contextTokenBudget: null,
      domains: [],
      targetPaths,
      maxSources: null,
      terraformPlanPaths,
      pulumiPreviewPaths
    };
  }

  if (commandName === 'changed') {
    let workspace = cwd();
    let changedBaseRef: string | null = null;
    let changedHeadRef: string | null = null;
    const changedFilePaths: string[] = [];
    const domains: InfraDomainId[] = [];
    const targetPaths: string[] = [];
    const positionalArgs: string[] = [];

    for (let index = 0; index < cleanArgs.length; index += 1) {
      const arg = cleanArgs[index];

      if (arg === '--base') {
        const baseValue = cleanArgs[index + 1]?.trim();
        if (!baseValue) {
          fail('Missing value for --base.');
        }
        if (changedBaseRef !== null) {
          fail('--base can be provided at most once.');
        }

        changedBaseRef = baseValue;
        index += 1;
        continue;
      }

      if (arg === '--head') {
        const headValue = cleanArgs[index + 1]?.trim();
        if (!headValue) {
          fail('Missing value for --head.');
        }
        if (changedHeadRef !== null) {
          fail('--head can be provided at most once.');
        }

        changedHeadRef = headValue;
        index += 1;
        continue;
      }

      if (arg === '--file') {
        const fileValue = cleanArgs[index + 1]?.trim();
        if (!fileValue) {
          fail('Missing value for --file.');
        }

        changedFilePaths.push(fileValue);
        index += 1;
        continue;
      }

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
        const targetValue = cleanArgs[index + 1]?.trim();
        if (!targetValue) {
          fail('Missing value for --target.');
        }

        targetPaths.push(targetValue);
        index += 1;
        continue;
      }

      if (arg.startsWith('--')) {
        fail(`Unknown changed option: ${arg}`);
      }

      positionalArgs.push(arg);
    }

    if (positionalArgs.length > 1) {
      fail('changed accepts at most one workspace path.');
    }
    if (changedFilePaths.length > 0 && changedBaseRef !== null) {
      fail('changed accepts either --file values or --base/--head, not both.');
    }
    if (changedHeadRef !== null && changedBaseRef === null) {
      fail('--head requires --base.');
    }
    if (changedFilePaths.length === 0 && changedBaseRef === null) {
      fail('changed requires --base or at least one --file.');
    }

    workspace = positionalArgs[0] ?? workspace;

    return {
      command: 'changed',
      task: null,
      workspace,
      inputPath: null,
      json,
      jsonFull,
      planner: 'auto',
      approvedWritePaths: [],
      approvedWriteRisks: [],
      approvedToolCategories: [],
      maxTurns: null,
      contextPacketLimit: null,
      contextTokenBudget: null,
      domains,
      targetPaths,
      maxSources: null,
      terraformPlanPaths: [],
      pulumiPreviewPaths: [],
      changedBaseRef,
      changedHeadRef: changedBaseRef !== null ? changedHeadRef ?? 'HEAD' : null,
      changedFilePaths
    };
  }

  if (commandName === 'identity-report') {
    const positionalArgs: string[] = [];
    for (const arg of cleanArgs) {
      if (arg.startsWith('--')) {
        fail(`Unknown identity-report option: ${arg}`);
      }

      positionalArgs.push(arg);
    }

    if (positionalArgs.length !== 1) {
      fail('identity-report requires exactly one compact agent result JSON path.');
    }

    return {
      command: 'identity-report',
      task: null,
      workspace: cwd(),
      inputPath: positionalArgs[0],
      json,
      jsonFull,
      planner: 'auto',
      approvedWritePaths: [],
      approvedWriteRisks: [],
      approvedToolCategories: [],
      maxTurns: null,
      contextPacketLimit: null,
      contextTokenBudget: null,
      domains: [],
      targetPaths: [],
      maxSources: null,
      terraformPlanPaths: [],
      pulumiPreviewPaths: []
    };
  }

  if (commandName === 'impact-report') {
    const positionalArgs: string[] = [];
    for (const arg of cleanArgs) {
      if (arg.startsWith('--')) {
        fail(`Unknown impact-report option: ${arg}`);
      }

      positionalArgs.push(arg);
    }

    if (positionalArgs.length !== 1) {
      fail('impact-report requires exactly one infra graph JSON path.');
    }

    return {
      command: 'impact-report',
      task: null,
      workspace: cwd(),
      inputPath: positionalArgs[0],
      json,
      jsonFull,
      planner: 'auto',
      approvedWritePaths: [],
      approvedWriteRisks: [],
      approvedToolCategories: [],
      maxTurns: null,
      contextPacketLimit: null,
      contextTokenBudget: null,
      domains: [],
      targetPaths: [],
      maxSources: null,
      terraformPlanPaths: [],
      pulumiPreviewPaths: []
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
      inputPath: null,
      json,
      jsonFull,
      planner: 'auto',
      approvedWritePaths: [],
      approvedWriteRisks: [],
      approvedToolCategories: [],
      maxTurns: null,
      contextPacketLimit: null,
      contextTokenBudget: null,
      domains,
      targetPaths,
      maxSources,
      terraformPlanPaths: [],
      pulumiPreviewPaths: []
    };
  }

  if (commandName === 'knowledge') {
    const knowledgeAction = cleanArgs[0];
    if (
      knowledgeAction !== 'sources'
      && knowledgeAction !== 'prefetch'
      && knowledgeAction !== 'extract'
      && knowledgeAction !== 'validate'
      && knowledgeAction !== 'pack'
      && knowledgeAction !== 'index'
      && knowledgeAction !== 'resource'
      && knowledgeAction !== 'from-url'
      && knowledgeAction !== 'publish'
    ) {
      fail('knowledge requires a supported action: sources, prefetch, extract, validate, pack, index, resource, from-url, or publish.');
    }

    let workspace = cwd();
    const domains: InfraDomainId[] = [];
    const targetPaths: string[] = [];
    const sourceIds: string[] = [];
    let maxSources: number | null = null;
    let maxFacts: number | null = null;
    let maxUnits: number | null = null;
    let outputPath: string | null = null;
    let libraryOutputPath: string | null = null;
    let contentPath: string | null = null;
    let unitOutputDir: string | null = null;
    let manifestOutputPath: string | null = null;
    let validationWorkspace: string | null = null;
    let publishStoreDir: string | null = null;
    let publishRegistryPath: string | null = null;
    let publishName: string | null = null;
    let publishVersion: string | null = null;
    let publishProvider: string | null = null;
    let publishPackageName: string | null = null;
    let publishChart: string | null = null;
    let publishModule: string | null = null;
    let publishAllowWorkspacePrivate = false;
    let knowledgeResource: string | null = null;
    const knowledgeIndexFilter: KnowledgeUnitIndexEntryFilter = {};
    const positionalArgs: string[] = [];
    const actionArgs = cleanArgs.slice(1);

    for (let index = 0; index < actionArgs.length; index += 1) {
      const arg = actionArgs[index];

      if (arg === '--domain') {
        if (knowledgeAction === 'validate') {
          fail('--domain is not supported for knowledge validate.');
        }
        if (knowledgeAction === 'from-url') {
          fail('--domain is inferred for knowledge from-url.');
        }
        const domainValue = actionArgs[index + 1];
        if (domainValue !== 'helm' && domainValue !== 'pulumi' && domainValue !== 'terraform') {
          fail('Missing or invalid value for --domain. Expected helm, pulumi, or terraform.');
        }

        domains.push(domainValue);
        index += 1;
        continue;
      }

      if (arg === '--target') {
        if (knowledgeAction === 'validate') {
          fail('--target is not supported for knowledge validate.');
        }
        if (knowledgeAction === 'from-url') {
          fail('--target is not supported for knowledge from-url.');
        }
        if (knowledgeAction === 'resource') {
          fail('--target is not supported for knowledge resource. Use --resource instead.');
        }
        const targetValue = actionArgs[index + 1];
        if (!targetValue) {
          fail('Missing value for --target.');
        }

        targetPaths.push(targetValue);
        index += 1;
        continue;
      }

      if (arg === '--resource') {
        const resourceValue = actionArgs[index + 1]?.trim();
        if (!resourceValue) {
          fail('Missing value for --resource.');
        }
        if (knowledgeAction === 'validate' || knowledgeAction === 'publish' || knowledgeAction === 'from-url') {
          fail('--resource is not supported for knowledge validate, knowledge from-url, or knowledge publish.');
        }
        if (knowledgeResource !== null) {
          fail('--resource can be provided at most once.');
        }

        knowledgeResource = resourceValue;
        index += 1;
        continue;
      }

      if (arg === '--max-sources') {
        const rawMaxSources = actionArgs[index + 1];
        const parsedMaxSources = Number.parseInt(rawMaxSources ?? '', 10);
        if (!Number.isInteger(parsedMaxSources) || parsedMaxSources < 1) {
          fail('Missing or invalid value for --max-sources. Expected a positive integer.');
        }
        if (knowledgeAction !== 'prefetch') {
          fail('--max-sources is only supported for knowledge prefetch.');
        }

        maxSources = parsedMaxSources;
        index += 1;
        continue;
      }

      if (arg === '--source') {
        const sourceId = actionArgs[index + 1]?.trim();
        if (!sourceId) {
          fail('Missing value for --source.');
        }
        if (knowledgeAction !== 'extract' && knowledgeAction !== 'pack' && knowledgeAction !== 'index' && knowledgeAction !== 'resource') {
          fail('--source is only supported for knowledge extract, knowledge pack, knowledge index, or knowledge resource.');
        }

        sourceIds.push(sourceId);
        index += 1;
        continue;
      }

      if (arg === '--unit-type') {
        const unitType = actionArgs[index + 1]?.trim();
        if (!KNOWLEDGE_UNIT_TYPES.includes(unitType as KnowledgeUnitType)) {
          fail('Missing or invalid value for --unit-type. Expected fact, guidance, example, diagnostic, or recipe.');
        }
        if (knowledgeAction !== 'index') {
          fail('--unit-type is only supported for knowledge index.');
        }
        if (knowledgeIndexFilter.unitType !== undefined) {
          fail('--unit-type can be provided at most once.');
        }

        knowledgeIndexFilter.unitType = unitType as KnowledgeUnitType;
        index += 1;
        continue;
      }

      if (arg === '--field-path' || arg === '--field') {
        const fieldPath = actionArgs[index + 1]?.trim();
        if (!fieldPath) {
          fail(`Missing value for ${arg}.`);
        }
        if (knowledgeAction !== 'index') {
          fail(`${arg} is only supported for knowledge index.`);
        }
        if (knowledgeIndexFilter.fieldPath !== undefined) {
          fail('--field-path can be provided at most once.');
        }

        knowledgeIndexFilter.fieldPath = fieldPath;
        index += 1;
        continue;
      }

      if (arg === '--provider') {
        const provider = actionArgs[index + 1]?.trim();
        if (!provider) {
          fail('Missing value for --provider.');
        }
        if (knowledgeAction === 'publish') {
          if (publishProvider !== null) {
            fail('--provider can be provided at most once.');
          }
          publishProvider = provider;
          index += 1;
          continue;
        }
        if (knowledgeAction !== 'index') {
          fail('--provider is only supported for knowledge index.');
        }
        if (knowledgeIndexFilter.provider !== undefined) {
          fail('--provider can be provided at most once.');
        }

        knowledgeIndexFilter.provider = provider;
        index += 1;
        continue;
      }

      if (arg === '--package') {
        const packageName = actionArgs[index + 1]?.trim();
        if (!packageName) {
          fail('Missing value for --package.');
        }
        if (knowledgeAction === 'publish') {
          if (publishPackageName !== null) {
            fail('--package can be provided at most once.');
          }
          publishPackageName = packageName;
          index += 1;
          continue;
        }
        if (knowledgeAction !== 'index') {
          fail('--package is only supported for knowledge index.');
        }
        if (knowledgeIndexFilter.packageName !== undefined) {
          fail('--package can be provided at most once.');
        }

        knowledgeIndexFilter.packageName = packageName;
        index += 1;
        continue;
      }

      if (arg === '--chart') {
        const chart = actionArgs[index + 1]?.trim();
        if (!chart) {
          fail('Missing value for --chart.');
        }
        if (knowledgeAction === 'publish') {
          if (publishChart !== null) {
            fail('--chart can be provided at most once.');
          }
          publishChart = chart;
          index += 1;
          continue;
        }
        if (knowledgeAction !== 'index') {
          fail('--chart is only supported for knowledge index.');
        }
        if (knowledgeIndexFilter.chart !== undefined) {
          fail('--chart can be provided at most once.');
        }

        knowledgeIndexFilter.chart = chart;
        index += 1;
        continue;
      }

      if (arg === '--module') {
        const moduleName = actionArgs[index + 1]?.trim();
        if (!moduleName) {
          fail('Missing value for --module.');
        }
        if (knowledgeAction === 'publish') {
          if (publishModule !== null) {
            fail('--module can be provided at most once.');
          }
          publishModule = moduleName;
          index += 1;
          continue;
        }
        if (knowledgeAction !== 'index') {
          fail('--module is only supported for knowledge index.');
        }
        if (knowledgeIndexFilter.module !== undefined) {
          fail('--module can be provided at most once.');
        }

        knowledgeIndexFilter.module = moduleName;
        index += 1;
        continue;
      }

      if (arg === '--version') {
        const version = actionArgs[index + 1]?.trim();
        if (!version) {
          fail('Missing value for --version.');
        }
        if (knowledgeAction === 'publish') {
          if (publishVersion !== null) {
            fail('--version can be provided at most once.');
          }
          publishVersion = version;
          index += 1;
          continue;
        }
        if (knowledgeAction !== 'index') {
          fail('--version is only supported for knowledge index.');
        }
        if (knowledgeIndexFilter.version !== undefined) {
          fail('--version can be provided at most once.');
        }

        knowledgeIndexFilter.version = version;
        index += 1;
        continue;
      }

      if (arg === '--privacy-scope') {
        const privacyScope = actionArgs[index + 1]?.trim();
        if (!KNOWLEDGE_UNIT_PRIVACY_SCOPES.includes(privacyScope as KnowledgeUnitPrivacyScope)) {
          fail('Missing or invalid value for --privacy-scope. Expected public-reference, workspace-private, internal-team, or private-run.');
        }
        if (knowledgeAction !== 'index') {
          fail('--privacy-scope is only supported for knowledge index.');
        }
        if (knowledgeIndexFilter.privacyScope !== undefined) {
          fail('--privacy-scope can be provided at most once.');
        }

        knowledgeIndexFilter.privacyScope = privacyScope as KnowledgeUnitPrivacyScope;
        index += 1;
        continue;
      }

      if (arg === '--storage-scope') {
        const storageScope = actionArgs[index + 1]?.trim();
        if (!KNOWLEDGE_STORAGE_SCOPES.includes(storageScope as KnowledgeStorageScope)) {
          fail('Missing or invalid value for --storage-scope. Expected public-reference or workspace-private.');
        }
        if (knowledgeAction !== 'index') {
          fail('--storage-scope is only supported for knowledge index.');
        }
        if (knowledgeIndexFilter.storageScope !== undefined) {
          fail('--storage-scope can be provided at most once.');
        }

        knowledgeIndexFilter.storageScope = storageScope as KnowledgeStorageScope;
        index += 1;
        continue;
      }

      if (arg === '--out') {
        const outputValue = actionArgs[index + 1]?.trim();
        if (!outputValue) {
          fail('Missing value for --out.');
        }
        if (
          knowledgeAction !== 'extract'
          && knowledgeAction !== 'pack'
          && knowledgeAction !== 'index'
          && knowledgeAction !== 'resource'
          && knowledgeAction !== 'from-url'
          && knowledgeAction !== 'publish'
        ) {
          fail('--out is only supported for knowledge extract, knowledge pack, knowledge index, knowledge resource, knowledge from-url, or knowledge publish.');
        }
        if (outputPath !== null) {
          fail('Output path can be provided at most once.');
        }

        outputPath = outputValue;
        index += 1;
        continue;
      }

      if (arg === '--library-out') {
        const outputValue = actionArgs[index + 1]?.trim();
        if (!outputValue) {
          fail('Missing value for --library-out.');
        }
        if (knowledgeAction !== 'from-url') {
          fail('--library-out is only supported for knowledge from-url.');
        }
        if (libraryOutputPath !== null) {
          fail('Library output path can be provided at most once.');
        }

        libraryOutputPath = outputValue;
        index += 1;
        continue;
      }

      if (arg === '--units-out') {
        const unitOutputValue = actionArgs[index + 1]?.trim();
        if (!unitOutputValue) {
          fail('Missing value for --units-out.');
        }
        if (knowledgeAction !== 'extract') {
          fail('--units-out is only supported for knowledge extract.');
        }
        if (unitOutputDir !== null) {
          fail('Unit output directory can be provided at most once.');
        }

        unitOutputDir = unitOutputValue;
        index += 1;
        continue;
      }

      if (arg === '--content') {
        const contentValue = actionArgs[index + 1]?.trim();
        if (!contentValue) {
          fail('Missing value for --content.');
        }
        if (knowledgeAction !== 'from-url') {
          fail('--content is only supported for knowledge from-url.');
        }
        if (contentPath !== null) {
          fail('--content can be provided at most once.');
        }

        contentPath = contentValue;
        index += 1;
        continue;
      }

      if (arg === '--manifest-out') {
        const outputValue = actionArgs[index + 1]?.trim();
        if (!outputValue) {
          fail('Missing value for --manifest-out.');
        }
        if (knowledgeAction !== 'extract' && knowledgeAction !== 'pack') {
          fail('--manifest-out is only supported for knowledge extract or knowledge pack.');
        }
        if (manifestOutputPath !== null) {
          fail('Manifest output path can be provided at most once.');
        }

        manifestOutputPath = outputValue;
        index += 1;
        continue;
      }

      if (arg === '--max-facts') {
        const rawMaxFacts = actionArgs[index + 1];
        const parsedMaxFacts = Number.parseInt(rawMaxFacts ?? '', 10);
        if (!Number.isInteger(parsedMaxFacts) || parsedMaxFacts < 1) {
          fail('Missing or invalid value for --max-facts. Expected a positive integer.');
        }
        if (knowledgeAction !== 'pack') {
          fail('--max-facts is only supported for knowledge pack.');
        }

        maxFacts = parsedMaxFacts;
        index += 1;
        continue;
      }

      if (arg === '--max-units') {
        const rawMaxUnits = actionArgs[index + 1];
        const parsedMaxUnits = Number.parseInt(rawMaxUnits ?? '', 10);
        if (!Number.isInteger(parsedMaxUnits) || parsedMaxUnits < 1) {
          fail('Missing or invalid value for --max-units. Expected a positive integer.');
        }
        if (knowledgeAction !== 'pack' && knowledgeAction !== 'index' && knowledgeAction !== 'resource' && knowledgeAction !== 'from-url') {
          fail('--max-units is only supported for knowledge pack, knowledge index, knowledge resource, or knowledge from-url.');
        }

        maxUnits = parsedMaxUnits;
        index += 1;
        continue;
      }

      if (arg === '--workspace') {
        if (knowledgeAction !== 'validate' && knowledgeAction !== 'publish') {
          fail('--workspace is only supported for knowledge validate or knowledge publish.');
        }
        const workspaceValue = actionArgs[index + 1]?.trim();
        if (!workspaceValue) {
          fail('Missing value for --workspace.');
        }

        if (knowledgeAction === 'publish') {
          workspace = resolve(cwd(), workspaceValue);
        } else {
          validationWorkspace = resolve(cwd(), workspaceValue);
        }
        index += 1;
        continue;
      }

      if (arg === '--store-dir') {
        if (knowledgeAction !== 'publish') {
          fail('--store-dir is only supported for knowledge publish.');
        }
        const storeDir = actionArgs[index + 1]?.trim();
        if (!storeDir) {
          fail('Missing value for --store-dir.');
        }
        if (publishStoreDir !== null) {
          fail('--store-dir can be provided at most once.');
        }
        publishStoreDir = storeDir;
        index += 1;
        continue;
      }

      if (arg === '--registry') {
        if (knowledgeAction !== 'publish') {
          fail('--registry is only supported for knowledge publish.');
        }
        const registryPath = actionArgs[index + 1]?.trim();
        if (!registryPath) {
          fail('Missing value for --registry.');
        }
        if (publishRegistryPath !== null) {
          fail('--registry can be provided at most once.');
        }
        publishRegistryPath = registryPath;
        index += 1;
        continue;
      }

      if (arg === '--name') {
        if (knowledgeAction !== 'publish') {
          fail('--name is only supported for knowledge publish.');
        }
        const name = actionArgs[index + 1]?.trim();
        if (!name) {
          fail('Missing value for --name.');
        }
        if (publishName !== null) {
          fail('--name can be provided at most once.');
        }
        publishName = name;
        index += 1;
        continue;
      }

      if (arg === '--allow-workspace-private') {
        if (knowledgeAction !== 'publish') {
          fail('--allow-workspace-private is only supported for knowledge publish.');
        }
        publishAllowWorkspacePrivate = true;
        continue;
      }

      if (arg.startsWith('--')) {
        fail(`Unknown knowledge ${knowledgeAction} option: ${arg}`);
      }

      positionalArgs.push(arg);
    }

    if (knowledgeAction !== 'from-url' && positionalArgs.length > 1) {
      fail(`knowledge ${knowledgeAction} accepts at most one workspace path.`);
    }
    if (knowledgeAction === 'from-url' && positionalArgs.length !== 1) {
      fail('knowledge from-url requires exactly one public documentation URL.');
    }

    if (knowledgeAction === 'validate' && positionalArgs.length !== 1) {
      fail('knowledge validate requires exactly one knowledge JSON path.');
    }
    if (knowledgeAction === 'publish' && positionalArgs.length !== 1) {
      fail('knowledge publish requires exactly one knowledge-units JSON path.');
    }
    if (knowledgeAction === 'publish' && publishStoreDir === null) {
      fail('knowledge publish requires --store-dir.');
    }
    if (knowledgeAction === 'publish' && publishRegistryPath === null) {
      fail('knowledge publish requires --registry.');
    }
    if (knowledgeAction === 'publish' && domains.length > 1) {
      fail('knowledge publish accepts at most one --domain value.');
    }
    if (knowledgeAction === 'publish' && targetPaths.length > 1) {
      fail('knowledge publish accepts at most one --target value.');
    }
    if (knowledgeAction === 'resource' && knowledgeResource === null) {
      fail('knowledge resource requires --resource.');
    }
    if (knowledgeResource !== null && targetPaths.length > 0) {
      fail(`knowledge ${knowledgeAction} accepts either --target or --resource, not both.`);
    }
    if (manifestOutputPath !== null && outputPath === null) {
      fail('--manifest-out requires --out so the manifest can reference a persisted artifact.');
    }

    if (knowledgeAction !== 'validate' && knowledgeAction !== 'publish' && knowledgeAction !== 'from-url') {
      workspace = positionalArgs[0] ?? workspace;
    }

    return {
      command: 'knowledge',
      knowledgeAction,
      task: null,
      workspace: knowledgeAction === 'validate' ? cwd() : workspace,
      inputPath: knowledgeAction === 'validate' || knowledgeAction === 'publish' || knowledgeAction === 'from-url'
        ? positionalArgs[0]
        : null,
      outputPath,
      libraryOutputPath,
      contentPath,
      unitOutputDir,
      manifestOutputPath,
      publishStoreDir,
      publishRegistryPath,
      publishName,
      publishVersion,
      publishProvider,
      publishPackageName,
      publishChart,
      publishModule,
      publishAllowWorkspacePrivate,
      validationWorkspace,
      json,
      jsonFull,
      planner: 'auto',
      approvedWritePaths: [],
      approvedWriteRisks: [],
      approvedToolCategories: [],
      maxTurns: null,
      contextPacketLimit: null,
      contextTokenBudget: null,
      domains,
      targetPaths,
      knowledgeResource,
      sourceIds,
      knowledgeIndexFilter: hasKnowledgeIndexFilter(knowledgeIndexFilter) ? knowledgeIndexFilter : undefined,
      maxSources,
      maxFacts,
      maxUnits,
      terraformPlanPaths: [],
      pulumiPreviewPaths: []
    };
  }

  if (commandName === 'run' || commandName === 'agent') {
    let workspace = cwd();
    let planner: PlannerMode = 'auto';
    let llmProvider: LLMProvider | null = null;
    let llmModel: string | null = null;
    let llmBaseUrl: string | null = null;
    let maxTurns: number | null = null;
    let maxRepairAttempts: number | null = null;
    let contextPacketLimit: number | null = null;
    let contextTokenBudget: number | null = null;
    let contextFactLimit: number | null = null;
    const approvedWritePaths: string[] = [];
    const approvedWriteRisks: FileWriteRisk[] = [];
    const approvedToolCategories: ToolPermissionCategory[] = [];
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

      if (arg === '--model' || arg === '--llm-model') {
        if (commandName !== 'agent') {
          fail(`${arg} is only supported for the agent command.`);
        }
        const modelValue = cleanArgs[index + 1]?.trim();
        if (!modelValue) {
          fail(`Missing value for ${arg}.`);
        }
        if (llmModel !== null) {
          fail('LLM model can be provided at most once.');
        }

        llmModel = modelValue;
        index += 1;
        continue;
      }

      if (arg === '--openai-base-url' || arg === '--llm-base-url') {
        if (commandName !== 'agent') {
          fail(`${arg} is only supported for the agent command.`);
        }
        const baseUrlValue = cleanArgs[index + 1]?.trim();
        if (!baseUrlValue) {
          fail(`Missing value for ${arg}.`);
        }
        if (llmBaseUrl !== null) {
          fail('LLM base URL can be provided at most once.');
        }

        llmBaseUrl = baseUrlValue;
        index += 1;
        continue;
      }

      if (arg === '--llm-provider') {
        if (commandName !== 'agent') {
          fail('--llm-provider is only supported for the agent command.');
        }
        const providerValue = cleanArgs[index + 1];
        if (providerValue !== 'openai-compatible') {
          fail('Missing or invalid value for --llm-provider. Expected openai-compatible.');
        }
        if (llmProvider !== null) {
          fail('LLM provider can be provided at most once.');
        }

        llmProvider = providerValue;
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

      if (arg === '--max-repair-attempts') {
        const maxRepairAttemptsValue = cleanArgs[index + 1];
        const parsedMaxRepairAttempts = Number(maxRepairAttemptsValue);
        if (!maxRepairAttemptsValue || !Number.isInteger(parsedMaxRepairAttempts) || parsedMaxRepairAttempts < 0) {
          fail('Missing or invalid value for --max-repair-attempts. Expected a non-negative integer.');
        }

        maxRepairAttempts = parsedMaxRepairAttempts;
        index += 1;
        continue;
      }

      if (arg === '--context-packet-limit') {
        const packetLimitValue = cleanArgs[index + 1];
        const parsedPacketLimit = Number(packetLimitValue);
        if (!packetLimitValue || !Number.isInteger(parsedPacketLimit) || parsedPacketLimit < 1) {
          fail('Missing or invalid value for --context-packet-limit. Expected a positive integer.');
        }

        contextPacketLimit = parsedPacketLimit;
        index += 1;
        continue;
      }

      if (arg === '--context-token-budget') {
        const tokenBudgetValue = cleanArgs[index + 1];
        const parsedTokenBudget = Number(tokenBudgetValue);
        if (!tokenBudgetValue || !Number.isInteger(parsedTokenBudget) || parsedTokenBudget < 1) {
          fail('Missing or invalid value for --context-token-budget. Expected a positive integer.');
        }

        contextTokenBudget = parsedTokenBudget;
        index += 1;
        continue;
      }

      if (arg === '--context-fact-limit') {
        const factLimitValue = cleanArgs[index + 1];
        const parsedFactLimit = Number(factLimitValue);
        if (!factLimitValue || !Number.isInteger(parsedFactLimit) || parsedFactLimit < 1) {
          fail('Missing or invalid value for --context-fact-limit. Expected a positive integer.');
        }

        contextFactLimit = parsedFactLimit;
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

      if (arg === '--approve-tool-category') {
        const categoryValue = cleanArgs[index + 1];
        if (!isToolPermissionCategory(categoryValue)) {
          fail('Missing or invalid value for --approve-tool-category.');
        }

        approvedToolCategories.push(categoryValue);
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
      inputPath: null,
      json,
      jsonFull,
      planner,
      llmProvider,
      llmModel,
      llmBaseUrl,
      approvedWritePaths,
      approvedWriteRisks,
      approvedToolCategories,
      maxTurns,
      maxRepairAttempts,
      contextPacketLimit,
      contextTokenBudget,
      contextFactLimit,
      domains: [],
      targetPaths: [],
      maxSources: null,
      terraformPlanPaths: [],
      pulumiPreviewPaths: []
    };
  }

  fail(`Unknown command: ${commandName}`);
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const parsed = parseArgs(argv);

  if (parsed.command === 'help') {
    printUsage();
    return;
  }

  if (parsed.command === 'version') {
    process.stdout.write(`infra-agent ${await readPackageVersion()}\n`);
    return;
  }

  if (parsed.command === 'doctor') {
    const report = await buildDoctorReport(parsed.workspace, undefined, buildLLMClientConfigOverrides(parsed));
    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      printDoctorReport(report);
    }

    process.exitCode = report.summary.status === 'fail' ? 1 : 0;
    return;
  }

  if (parsed.command === 'planner-providers') {
    const report = buildPlannerProviderCatalogReport();
    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      printPlannerProviderCatalogReport(report);
    }

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

  if (parsed.command === 'inventory') {
    const inspection = await inspectWorkspace(parsed.workspace);
    const report = buildInventoryReport(inspection, {
      domains: parsed.domains,
      targetPaths: parsed.targetPaths
    });

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }

    printInventoryReport(report);
    return;
  }

  if (parsed.command === 'pack') {
    const inspection = await inspectWorkspace(parsed.workspace);
    let report;

    if (parsed.packChanged) {
      const explicitFiles = parsed.changedFilePaths ?? [];
      const changedFiles = explicitFiles.length > 0
        ? explicitFiles.map(path => ({ path, status: 'unknown' as const }))
        : readGitChangedFiles(parsed.workspace, parsed.changedBaseRef ?? 'HEAD', parsed.changedHeadRef);
      const changedContext = buildChangedContextReport(inspection, {
        changedFiles,
        comparison: explicitFiles.length > 0
          ? { source: 'explicit-files' }
          : {
              source: 'git-diff',
              base: parsed.changedBaseRef ?? 'HEAD',
              head: parsed.changedHeadRef ?? undefined
            },
        domains: parsed.domains
      });

      report = buildChangedScopedPackReport(inspection, changedContext, {
        domains: parsed.domains
      });
    } else {
      if (!parsed.packScope) {
        fail('pack requires --scope or --changed.');
      }

      report = buildScopedPackReport(inspection, {
        scope: parsed.packScope,
        domains: parsed.domains
      });
    }

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }

    process.stdout.write(`${renderScopedPackMarkdown(report)}\n`);
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

  if (parsed.command === 'changed') {
    const inspection = await inspectWorkspace(parsed.workspace);
    const explicitFiles = parsed.changedFilePaths ?? [];
    const changedFiles = explicitFiles.length > 0
      ? explicitFiles.map(path => ({ path, status: 'unknown' as const }))
      : readGitChangedFiles(parsed.workspace, parsed.changedBaseRef ?? 'HEAD', parsed.changedHeadRef);
    const report = buildChangedContextReport(inspection, {
      changedFiles,
      comparison: explicitFiles.length > 0
        ? { source: 'explicit-files' }
        : {
            source: 'git-diff',
            base: parsed.changedBaseRef ?? 'HEAD',
            head: parsed.changedHeadRef ?? undefined
          },
      domains: parsed.domains,
      targetPaths: parsed.targetPaths
    });

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }

    printChangedContextReport(report);
    return;
  }

  if (parsed.command === 'identity-report') {
    if (!parsed.inputPath) {
      fail('identity-report requires exactly one compact agent result JSON path.');
    }

    const report = await loadIdentityConflictIncidentReport(parsed.inputPath, cwd());

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }

    printIdentityConflictIncidentReport(report);
    return;
  }

  if (parsed.command === 'impact-report') {
    if (!parsed.inputPath) {
      fail('impact-report requires exactly one infra graph JSON path.');
    }

    const report = await loadInfraGraphImpactReport(parsed.inputPath, cwd());

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }

    printInfraGraphImpactReport(report);
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

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'sources') {
    const inspection = await inspectWorkspace(parsed.workspace);
    const report = await buildKnowledgeSourcesReport(inspection, {
      domains: parsed.domains,
      targetPaths: parsed.targetPaths,
      resource: parsed.knowledgeResource ?? undefined
    });

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }

    printKnowledgeSourcesReport(report);
    return;
  }

  if (parsed.command === 'cache' && parsed.cacheAction === 'status') {
    const inspection = await inspectWorkspace(parsed.workspace);
    const sourceReport = await buildKnowledgeSourcesReport(inspection, {
      domains: parsed.domains,
      targetPaths: parsed.targetPaths
    });
    const report = buildKnowledgeCacheStatusReportFromSources(
      sourceReport,
      inspection.knowledgeCache.source
    );

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }

    printKnowledgeCacheStatusReport(report);
    return;
  }

  if (parsed.command === 'refs') {
    const refsScope = parsed.refsResource ?? parsed.refsScope;
    if (!refsScope) {
      fail('refs requires --scope or --resource.');
    }

    const inspection = await inspectWorkspace(parsed.workspace);
    const report = await buildRefsReport(inspection, {
      scope: refsScope,
      domains: parsed.domains,
      maxUnits: parsed.maxUnits ?? undefined
    });

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }

    printRefsReport(report);
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'prefetch') {
    const inspection = await inspectWorkspace(parsed.workspace);
    const result = await prefetchWorkspaceKnowledge(inspection, {
      domains: parsed.domains,
      targetPaths: parsed.targetPaths,
      resource: parsed.knowledgeResource ?? undefined,
      maxSources: parsed.maxSources ?? undefined
    });

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }

    printKnowledgePrefetchResult(result);
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'extract') {
    const inspection = await inspectWorkspace(parsed.workspace);
    const report = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: parsed.domains,
      targetPaths: parsed.targetPaths,
      resource: parsed.knowledgeResource ?? undefined,
      sourceIds: parsed.sourceIds
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), report)
      : null;
    const unitOutputPaths = parsed.unitOutputDir
      ? await writeKnowledgeUnitArtifacts(parsed.unitOutputDir, report.unitSets)
      : [];
    const manifestPath = writtenPath && parsed.manifestOutputPath
      ? await writeJsonArtifact(parsed.manifestOutputPath, cwd(), buildKnowledgeArtifactManifest(report, {
          artifactPath: writtenPath,
          artifactSha256: await hashKnowledgeArtifactFile(writtenPath)
        }))
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...report,
            outputPath: writtenPath,
            ...(parsed.unitOutputDir ? { unitOutputPaths } : {}),
            ...(manifestPath ? { manifestPath } : {})
          }
        : {
            ...report,
            ...(parsed.unitOutputDir ? { unitOutputPaths } : {})
          }, null, 2)}\n`);
      return;
    }

    printKnowledgeExtractionReport(report);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    if (parsed.unitOutputDir) {
      process.stdout.write(`unit artifacts: ${unitOutputPaths.length}\n`);
      for (const unitOutputPath of unitOutputPaths) {
        process.stdout.write(`unit: ${unitOutputPath}\n`);
      }
    }
    if (manifestPath) {
      process.stdout.write(`manifest: ${manifestPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'from-url') {
    if (!parsed.inputPath) {
      fail('knowledge from-url requires exactly one public documentation URL.');
    }

    const report = await buildPublicKnowledgeUrlReport({
      url: parsed.inputPath,
      contentPath: parsed.contentPath ? resolve(cwd(), parsed.contentPath) : undefined,
      maxUnits: parsed.maxUnits ?? undefined
    });
    const libraryArtifact = parsed.libraryOutputPath
      ? buildPublicKnowledgeLibraryArtifact(report)
      : null;
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), report)
      : null;
    const libraryWrittenPath = parsed.libraryOutputPath && libraryArtifact
      ? await writeJsonArtifact(parsed.libraryOutputPath, cwd(), libraryArtifact)
      : null;

    if (parsed.json) {
      const reportPayload = {
        ...report,
        ...(writtenPath ? { outputPath: writtenPath } : {}),
        ...(libraryWrittenPath ? { libraryOutputPath: libraryWrittenPath } : {})
      };
      process.stdout.write(`${JSON.stringify(reportPayload, null, 2)}\n`);
      return;
    }

    printPublicKnowledgeUrlReport(report);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    if (libraryWrittenPath) {
      process.stdout.write(`library artifact: ${libraryWrittenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'validate') {
    if (!parsed.inputPath) {
      fail('knowledge validate requires exactly one knowledge JSON path.');
    }

    const report = await loadKnowledgeValidationReport(parsed.inputPath, cwd(), parsed.validationWorkspace
      ? { workspaceRoot: parsed.validationWorkspace }
      : {});

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      printKnowledgeValidationReport(report);
    }

    if (!report.valid) {
      process.exitCode = 1;
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'publish') {
    if (!parsed.inputPath || !parsed.publishStoreDir || !parsed.publishRegistryPath) {
      fail('knowledge publish requires a knowledge-units JSON path, --store-dir, and --registry.');
    }

    const validationReport = await loadKnowledgeValidationReport(parsed.inputPath, cwd(), {});
    if (!validationReport.valid) {
      if (parsed.json) {
        process.stdout.write(`${JSON.stringify(validationReport, null, 2)}\n`);
      } else {
        printKnowledgeValidationReport(validationReport);
      }
      process.exitCode = 1;
      return;
    }

    const report = await publishSharedKnowledgeArtifact({
      workspaceRoot: parsed.workspace,
      artifactPath: parsed.inputPath,
      storeDir: parsed.publishStoreDir,
      registryPath: parsed.publishRegistryPath,
      domain: parsed.domains[0],
      targetPath: parsed.targetPaths[0],
      name: parsed.publishName ?? undefined,
      version: parsed.publishVersion ?? undefined,
      provider: parsed.publishProvider ?? undefined,
      packageName: parsed.publishPackageName ?? undefined,
      chart: parsed.publishChart ?? undefined,
      moduleName: parsed.publishModule ?? undefined,
      allowWorkspacePrivate: parsed.publishAllowWorkspacePrivate
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), report)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...report,
            outputPath: writtenPath
          }
        : report, null, 2)}\n`);
      return;
    }

    printKnowledgeSharedArtifactPublishReport(report);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'resource') {
    if (!parsed.knowledgeResource) {
      fail('knowledge resource requires --resource.');
    }

    const inspection = await inspectWorkspace(parsed.workspace);
    const report = await buildResourceKnowledgeReport(inspection, {
      resource: parsed.knowledgeResource,
      domains: parsed.domains,
      sourceIds: parsed.sourceIds,
      maxUnits: parsed.maxUnits ?? undefined
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), report)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...report,
            outputPath: writtenPath
          }
        : report, null, 2)}\n`);
      return;
    }

    printResourceKnowledgeReport(report);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'index') {
    const inspection = await inspectWorkspace(parsed.workspace);
    const pack = await buildKnowledgePack(inspection, {
      domains: parsed.domains,
      targetPaths: parsed.targetPaths,
      resource: parsed.knowledgeResource ?? undefined,
      sourceIds: parsed.sourceIds,
      maxUnits: parsed.maxUnits ?? undefined
    });
    const unitIndex = filterKnowledgeUnitMetadataIndex(
      buildKnowledgeUnitMetadataIndex(pack),
      parsed.knowledgeIndexFilter ?? {}
    );
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), unitIndex)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...unitIndex,
            outputPath: writtenPath
          }
        : unitIndex, null, 2)}\n`);
      return;
    }

    printKnowledgeUnitMetadataIndex(unitIndex);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'pack') {
    const inspection = await inspectWorkspace(parsed.workspace);
    const pack = await buildKnowledgePack(inspection, {
      domains: parsed.domains,
      targetPaths: parsed.targetPaths,
      resource: parsed.knowledgeResource ?? undefined,
      sourceIds: parsed.sourceIds,
      maxFacts: parsed.maxFacts ?? undefined,
      maxUnits: parsed.maxUnits ?? undefined
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), pack)
      : null;
    const manifestPath = writtenPath && parsed.manifestOutputPath
      ? await writeJsonArtifact(parsed.manifestOutputPath, cwd(), buildKnowledgeArtifactManifest(pack, {
          artifactPath: writtenPath,
          artifactSha256: await hashKnowledgeArtifactFile(writtenPath)
        }))
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...pack,
            outputPath: writtenPath,
            ...(manifestPath ? { manifestPath } : {})
          }
        : pack, null, 2)}\n`);
      return;
    }

    printKnowledgePack(pack);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    if (manifestPath) {
      process.stdout.write(`manifest: ${manifestPath}\n`);
    }
    return;
  }

  if (parsed.command === 'agent') {
    const agentRunState = await runSingleStep(parsed.task, parsed.workspace, undefined, parsed.planner, {
      approvedWritePaths: parsed.approvedWritePaths,
      approvedWriteRisks: parsed.approvedWriteRisks,
      approvedToolCategories: parsed.approvedToolCategories
    }, {
      maxTurns: parsed.maxTurns ?? undefined,
      maxRepairAttempts: parsed.maxRepairAttempts ?? undefined,
      retrievedContextBudget: {
        maxPackets: parsed.contextPacketLimit ?? undefined,
        maxTokens: parsed.contextTokenBudget ?? undefined,
        maxFacts: parsed.contextFactLimit ?? undefined
      }
    }, buildLLMClientConfigOverrides(parsed));
    if (parsed.json) {
      const payload = parsed.jsonFull ? agentRunState : buildCompactAgentRunResult(agentRunState);
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      process.exitCode = exitCodeForAgentOutcome(agentRunState.outcome);
      return;
    }

    printAgentRunState(agentRunState);
    process.exitCode = exitCodeForAgentOutcome(agentRunState.outcome);
    return;
  }

  const preflight = await buildRunPreflight(parsed.task, parsed.workspace, {
    approvedWritePaths: parsed.approvedWritePaths,
    approvedWriteRisks: parsed.approvedWriteRisks,
    approvedToolCategories: parsed.approvedToolCategories
  });
  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(preflight, null, 2)}\n`);
    process.exitCode = exitCodeForRunPreflight(preflight);
    return;
  }

  printRunPreflight(preflight);
  process.exitCode = exitCodeForRunPreflight(preflight);
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  main().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`infra-agent failed: ${message}\n`);
    exit(1);
  });
}
