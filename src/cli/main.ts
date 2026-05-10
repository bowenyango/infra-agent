import { cwd, exit } from 'node:process';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectWorkspace } from '../domain/inspect-workspace.ts';
import { buildRunPreflight } from '../agent/build-run-preflight.ts';
import { runSingleStep } from '../agent/run-single-step.ts';
import { buildValidationPreflight } from '../validators/preflight.ts';
import type { LLMClientConfigOverrides, LLMProvider, PlannerMode } from '../model/config.ts';
import type { FileWriteRisk } from '../types/edit-plan.ts';
import type { InfraDomainId } from '../types/repository.ts';
import type { ToolPermissionCategory } from '../agent/tool-permissions.ts';
import { prefetchWorkspaceKnowledge } from '../knowledge/prefetch.ts';
import { buildKnowledgeSourcesReport } from '../knowledge/sources.ts';
import { extractWorkspaceKnowledgeFacts } from '../knowledge/extract.ts';
import {
  loadKnowledgeValidationReport,
  validateKnowledgePayload
} from '../knowledge/validate.ts';
import { buildKnowledgePack } from '../knowledge/pack.ts';
import {
  buildKnowledgeArtifactManifest,
  hashKnowledgeArtifactFile,
  type KnowledgeArtifactManifest
} from '../knowledge/artifact-manifest.ts';
import {
  buildKnowledgeTeamPublicationPlan,
  buildKnowledgeTeamPublicationReadinessReport,
  type KnowledgeTeamArtifactDescriptor,
  type KnowledgeTeamArtifactIndexEntry,
  type KnowledgeTeamPublicationPlan
} from '../knowledge/team-artifact-store.ts';
import { buildKnowledgeTeamBackendReadinessReport } from '../knowledge/team-backend-readiness.ts';
import { validateKnowledgeTeamS3CompatibleBackendReferences } from '../knowledge/team-s3-compatible-reference-registry.ts';
import { buildKnowledgeTeamUploadApprovalIntent } from '../knowledge/team-upload-approval-intent.ts';
import { buildKnowledgeTeamUploadApprovalContinuation } from '../knowledge/team-upload-approval-continuation.ts';
import { buildKnowledgeTeamUploadAdapterPreflight } from '../knowledge/team-upload-adapter-preflight.ts';
import { buildKnowledgeTeamUploadMockHarness } from '../knowledge/team-upload-mock-harness.ts';
import { buildKnowledgeTeamUploadExecutionGate } from '../knowledge/team-upload-execution-gate.ts';
import { buildKnowledgeTeamUploadExecutionPrerequisitePlan } from '../knowledge/team-upload-execution-prerequisite-plan.ts';
import { buildKnowledgeTeamUploadMutationPlan } from '../knowledge/team-upload-mutation-plan.ts';
import { buildKnowledgeTeamUploadMutationApprovalReview } from '../knowledge/team-upload-mutation-approval-review.ts';
import { buildKnowledgeTeamUploadWriteTokenBoundary } from '../knowledge/team-upload-write-token-boundary.ts';
import { buildKnowledgeTeamUploadExecutionLeaseBoundary } from '../knowledge/team-upload-execution-lease-boundary.ts';
import { buildKnowledgeTeamUploadRollbackPlanBoundary } from '../knowledge/team-upload-rollback-plan-boundary.ts';
import { buildKnowledgeTeamUploadAuditRecordBoundary } from '../knowledge/team-upload-audit-record-boundary.ts';
import { buildKnowledgeTeamUploadArtifactBytesBoundary } from '../knowledge/team-upload-artifact-bytes-boundary.ts';
import { buildKnowledgeTeamUploadAdapterInjectionBoundary } from '../knowledge/team-upload-adapter-injection-boundary.ts';
import { buildKnowledgeTeamUploadClientCreationBoundary } from '../knowledge/team-upload-client-creation-boundary.ts';
import { buildKnowledgeTeamUploadCredentialReadBoundary } from '../knowledge/team-upload-credential-read-boundary.ts';
import { buildWorkspaceInfraGraph } from '../impact/workspace-graph.ts';
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
  printInfraGraph,
  printInspection,
  printKnowledgePrefetchResult,
  printKnowledgeTeamBackendReadinessReport,
  printKnowledgeTeamS3CompatibleReferenceValidationSummary,
  printKnowledgeTeamUploadAdapterPreflight,
  printKnowledgeTeamUploadApprovalContinuation,
  printKnowledgeTeamUploadApprovalIntent,
  printKnowledgeTeamUploadExecutionGate,
  printKnowledgeTeamUploadExecutionPrerequisitePlan,
  printKnowledgeTeamUploadMutationApprovalReview,
  printKnowledgeTeamUploadMutationPlan,
  printKnowledgeTeamUploadMockHarness,
  printKnowledgeTeamUploadWriteTokenBoundary,
  printKnowledgeTeamUploadExecutionLeaseBoundary,
  printKnowledgeTeamUploadRollbackPlanBoundary,
  printKnowledgeTeamUploadAuditRecordBoundary,
  printKnowledgeTeamUploadArtifactBytesBoundary,
  printKnowledgeTeamUploadAdapterInjectionBoundary,
  printKnowledgeTeamUploadClientCreationBoundary,
  printKnowledgeTeamUploadCredentialReadBoundary,
  printKnowledgeExtractionReport,
  printKnowledgeSourcesReport,
  printKnowledgeValidationReport,
  printKnowledgePack,
  printKnowledgeTeamPublicationReadinessReport,
  printKnowledgeTeamPublicationPlan,
  printPlannerProviderCatalogReport,
  printRunPreflight,
  printValidationPreflight
} from './output.ts';
import { exitCodeForAgentOutcome, exitCodeForRunPreflight } from './exit-codes.ts';
import { readPackageVersion } from './package-metadata.ts';

export { readPackageVersion } from './package-metadata.ts';

export interface ParsedArgs {
  command: 'inspect' | 'run' | 'agent' | 'validate' | 'prefetch' | 'knowledge' | 'graph' | 'impact-report' | 'identity-report' | 'doctor' | 'planner-providers' | 'version' | 'help';
  knowledgeAction?: 'sources' | 'prefetch' | 'extract' | 'validate' | 'pack' | 'publish-plan' | 'publish-readiness' | 'backend-readiness' | 'backend-reference-readiness' | 'upload-approval-intent' | 'upload-approval-continuation' | 'upload-adapter-preflight' | 'upload-mock-harness' | 'upload-execution-gate' | 'upload-mutation-plan' | 'upload-mutation-approval-review' | 'upload-execution-prerequisite-plan' | 'upload-write-token-boundary' | 'upload-execution-lease-boundary' | 'upload-rollback-plan-boundary' | 'upload-audit-record-boundary' | 'upload-artifact-bytes-boundary' | 'upload-adapter-injection-boundary' | 'upload-client-creation-boundary' | 'upload-credential-read-boundary' | null;
  task: string | null;
  workspace: string;
  inputPath: string | null;
  adapterPlanInputPath?: string | null;
  mockHarnessInputPath?: string | null;
  approvalFingerprint?: string | null;
  backendReferenceInputPath?: string | null;
  descriptorInputPath?: string | null;
  indexEntryInputPath?: string | null;
  registryInputPath?: string | null;
  outputPath?: string | null;
  manifestOutputPath?: string | null;
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
  sourceIds?: string[];
  maxSources: number | null;
  maxFacts?: number | null;
  terraformPlanPaths: string[];
  pulumiPreviewPaths: string[];
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
      '  infra-agent validate [workspace] [--json]',
      '  infra-agent graph [workspace] [--terraform-plan <plan.json>] [--pulumi-preview <preview.json>] [--target <root>] [--json]',
      '  infra-agent impact-report <graph.json> [--json]',
      '  infra-agent identity-report <agent-result.json> [--json]',
      '  infra-agent prefetch [workspace] [--domain helm|pulumi|terraform] [--target <path>] [--max-sources <n>] [--json]',
      '  infra-agent knowledge sources [workspace] [--domain helm|pulumi|terraform] [--target <path>] [--json]',
      '  infra-agent knowledge prefetch [workspace] [--domain helm|pulumi|terraform] [--target <path>] [--max-sources <n>] [--json]',
      '  infra-agent knowledge extract [workspace] [--domain helm|pulumi|terraform] [--target <path>] [--source <id>] [--out <knowledge.json>] [--manifest-out <manifest.json>] [--json]',
      '  infra-agent knowledge validate <knowledge.json> [--workspace <workspace>] [--json]',
      '  infra-agent knowledge pack [workspace] [--domain helm|pulumi|terraform] [--target <path>] [--source <id>] [--max-facts <n>] [--out <pack.json>] [--manifest-out <manifest.json>] [--json]',
      '  infra-agent knowledge publish-plan <manifest.json> [--descriptor <descriptor.json>] [--out <plan.json>] [--json]',
      '  infra-agent knowledge publish-readiness <plan.json> [--index-entry <entry.json>] [--out <readiness.json>] [--json]',
      '  infra-agent knowledge backend-readiness <backend-config.json> [--out <readiness.json>] [--json]',
      '  infra-agent knowledge backend-reference-readiness <backend-config.json> --registry <reference-registry.json> [--out <readiness.json>] [--json]',
      '  infra-agent knowledge upload-approval-intent <publication-readiness.json> --backend-reference <reference-readiness.json> [--out <intent.json>] [--json]',
      '  infra-agent knowledge upload-approval-continuation <intent.json> --approval-fingerprint <sha256> [--out <continuation.json>] [--json]',
      '  infra-agent knowledge upload-adapter-preflight <continuation.json> --adapter-plan <adapter-plan.json> [--out <preflight.json>] [--json]',
      '  infra-agent knowledge upload-mock-harness <preflight.json> [--out <harness.json>] [--json]',
      '  infra-agent knowledge upload-execution-gate <continuation.json> --mock-harness <harness.json> [--out <gate.json>] [--json]',
      '  infra-agent knowledge upload-mutation-plan <gate.json> [--out <mutation-plan.json>] [--json]',
      '  infra-agent knowledge upload-mutation-approval-review <mutation-plan.json> --approval-fingerprint <sha256> [--out <review.json>] [--json]',
      '  infra-agent knowledge upload-execution-prerequisite-plan <approval-review.json> [--out <prerequisite-plan.json>] [--json]',
      '  infra-agent knowledge upload-write-token-boundary <execution-prerequisite-plan.json> [--out <write-token-boundary.json>] [--json]',
      '  infra-agent knowledge upload-execution-lease-boundary <write-token-boundary.json> [--out <execution-lease-boundary.json>] [--json]',
      '  infra-agent knowledge upload-rollback-plan-boundary <execution-lease-boundary.json> [--out <rollback-plan-boundary.json>] [--json]',
      '  infra-agent knowledge upload-audit-record-boundary <rollback-plan-boundary.json> [--out <audit-record-boundary.json>] [--json]',
      '  infra-agent knowledge upload-artifact-bytes-boundary <audit-record-boundary.json> [--out <artifact-bytes-boundary.json>] [--json]',
      '  infra-agent knowledge upload-adapter-injection-boundary <artifact-bytes-boundary.json> [--out <adapter-injection-boundary.json>] [--json]',
      '  infra-agent knowledge upload-client-creation-boundary <adapter-injection-boundary.json> [--out <client-creation-boundary.json>] [--json]',
      '  infra-agent knowledge upload-credential-read-boundary <client-creation-boundary.json> [--out <credential-read-boundary.json>] [--json]',
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
      && knowledgeAction !== 'publish-plan'
      && knowledgeAction !== 'publish-readiness'
      && knowledgeAction !== 'backend-readiness'
      && knowledgeAction !== 'backend-reference-readiness'
      && knowledgeAction !== 'upload-approval-intent'
      && knowledgeAction !== 'upload-approval-continuation'
      && knowledgeAction !== 'upload-adapter-preflight'
      && knowledgeAction !== 'upload-mock-harness'
      && knowledgeAction !== 'upload-execution-gate'
      && knowledgeAction !== 'upload-mutation-plan'
      && knowledgeAction !== 'upload-mutation-approval-review'
      && knowledgeAction !== 'upload-execution-prerequisite-plan'
      && knowledgeAction !== 'upload-write-token-boundary'
      && knowledgeAction !== 'upload-execution-lease-boundary'
      && knowledgeAction !== 'upload-rollback-plan-boundary'
      && knowledgeAction !== 'upload-audit-record-boundary'
      && knowledgeAction !== 'upload-artifact-bytes-boundary'
      && knowledgeAction !== 'upload-adapter-injection-boundary'
      && knowledgeAction !== 'upload-client-creation-boundary'
      && knowledgeAction !== 'upload-credential-read-boundary'
    ) {
      fail('knowledge requires a supported action: sources, prefetch, extract, validate, pack, publish-plan, publish-readiness, backend-readiness, backend-reference-readiness, upload-approval-intent, upload-approval-continuation, upload-adapter-preflight, upload-mock-harness, upload-execution-gate, upload-mutation-plan, upload-mutation-approval-review, upload-execution-prerequisite-plan, upload-write-token-boundary, upload-execution-lease-boundary, upload-rollback-plan-boundary, upload-audit-record-boundary, upload-artifact-bytes-boundary, upload-adapter-injection-boundary, upload-client-creation-boundary, upload-credential-read-boundary.');
    }

    let workspace = cwd();
    const domains: InfraDomainId[] = [];
    const targetPaths: string[] = [];
    const sourceIds: string[] = [];
    let maxSources: number | null = null;
    let maxFacts: number | null = null;
    let adapterPlanInputPath: string | null = null;
    let mockHarnessInputPath: string | null = null;
    let outputPath: string | null = null;
    let manifestOutputPath: string | null = null;
    let approvalFingerprint: string | null = null;
    let backendReferenceInputPath: string | null = null;
    let descriptorInputPath: string | null = null;
    let indexEntryInputPath: string | null = null;
    let registryInputPath: string | null = null;
    let validationWorkspace: string | null = null;
    const positionalArgs: string[] = [];
    const actionArgs = cleanArgs.slice(1);

    for (let index = 0; index < actionArgs.length; index += 1) {
      const arg = actionArgs[index];

      if (arg === '--domain') {
        if (knowledgeAction === 'validate' || knowledgeAction === 'publish-plan' || knowledgeAction === 'publish-readiness' || knowledgeAction === 'backend-readiness' || knowledgeAction === 'backend-reference-readiness' || knowledgeAction === 'upload-approval-intent' || knowledgeAction === 'upload-approval-continuation' || knowledgeAction === 'upload-adapter-preflight' || knowledgeAction === 'upload-mock-harness' || knowledgeAction === 'upload-execution-gate' || knowledgeAction === 'upload-mutation-plan' || knowledgeAction === 'upload-mutation-approval-review' || knowledgeAction === 'upload-execution-prerequisite-plan' || knowledgeAction === 'upload-write-token-boundary' || knowledgeAction === 'upload-execution-lease-boundary' || knowledgeAction === 'upload-rollback-plan-boundary' || knowledgeAction === 'upload-audit-record-boundary' || knowledgeAction === 'upload-artifact-bytes-boundary' || knowledgeAction === 'upload-adapter-injection-boundary' || knowledgeAction === 'upload-client-creation-boundary' || knowledgeAction === 'upload-credential-read-boundary') {
          fail(`--domain is not supported for knowledge ${knowledgeAction}.`);
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
        if (knowledgeAction === 'validate' || knowledgeAction === 'publish-plan' || knowledgeAction === 'publish-readiness' || knowledgeAction === 'backend-readiness' || knowledgeAction === 'backend-reference-readiness' || knowledgeAction === 'upload-approval-intent' || knowledgeAction === 'upload-approval-continuation' || knowledgeAction === 'upload-adapter-preflight' || knowledgeAction === 'upload-mock-harness' || knowledgeAction === 'upload-execution-gate' || knowledgeAction === 'upload-mutation-plan' || knowledgeAction === 'upload-mutation-approval-review' || knowledgeAction === 'upload-execution-prerequisite-plan' || knowledgeAction === 'upload-write-token-boundary' || knowledgeAction === 'upload-execution-lease-boundary' || knowledgeAction === 'upload-rollback-plan-boundary' || knowledgeAction === 'upload-audit-record-boundary' || knowledgeAction === 'upload-artifact-bytes-boundary' || knowledgeAction === 'upload-adapter-injection-boundary' || knowledgeAction === 'upload-client-creation-boundary' || knowledgeAction === 'upload-credential-read-boundary') {
          fail(`--target is not supported for knowledge ${knowledgeAction}.`);
        }
        const targetValue = actionArgs[index + 1];
        if (!targetValue) {
          fail('Missing value for --target.');
        }

        targetPaths.push(targetValue);
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
        if (knowledgeAction !== 'extract' && knowledgeAction !== 'pack') {
          fail('--source is only supported for knowledge extract or knowledge pack.');
        }

        sourceIds.push(sourceId);
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
          && knowledgeAction !== 'publish-plan'
          && knowledgeAction !== 'publish-readiness'
          && knowledgeAction !== 'backend-readiness'
          && knowledgeAction !== 'backend-reference-readiness'
          && knowledgeAction !== 'upload-approval-intent'
          && knowledgeAction !== 'upload-approval-continuation'
          && knowledgeAction !== 'upload-adapter-preflight'
          && knowledgeAction !== 'upload-mock-harness'
          && knowledgeAction !== 'upload-execution-gate'
          && knowledgeAction !== 'upload-mutation-plan'
          && knowledgeAction !== 'upload-mutation-approval-review'
          && knowledgeAction !== 'upload-execution-prerequisite-plan'
          && knowledgeAction !== 'upload-write-token-boundary'
          && knowledgeAction !== 'upload-execution-lease-boundary'
          && knowledgeAction !== 'upload-rollback-plan-boundary'
          && knowledgeAction !== 'upload-audit-record-boundary'
          && knowledgeAction !== 'upload-artifact-bytes-boundary'
          && knowledgeAction !== 'upload-adapter-injection-boundary'
          && knowledgeAction !== 'upload-client-creation-boundary'
          && knowledgeAction !== 'upload-credential-read-boundary'
        ) {
          fail('--out is only supported for knowledge extract, knowledge pack, knowledge publish-plan, knowledge publish-readiness, knowledge backend-readiness, knowledge backend-reference-readiness, knowledge upload-approval-intent, knowledge upload-approval-continuation, knowledge upload-adapter-preflight, knowledge upload-mock-harness, knowledge upload-execution-gate, knowledge upload-mutation-plan, knowledge upload-mutation-approval-review, knowledge upload-execution-prerequisite-plan, knowledge upload-write-token-boundary, knowledge upload-execution-lease-boundary, knowledge upload-rollback-plan-boundary, knowledge upload-audit-record-boundary, knowledge upload-artifact-bytes-boundary, knowledge upload-adapter-injection-boundary, knowledge upload-client-creation-boundary, or knowledge upload-credential-read-boundary.');
        }
        if (outputPath !== null) {
          fail('Output path can be provided at most once.');
        }

        outputPath = outputValue;
        index += 1;
        continue;
      }

      if (arg === '--index-entry') {
        const indexEntryValue = actionArgs[index + 1]?.trim();
        if (!indexEntryValue) {
          fail('Missing value for --index-entry.');
        }
        if (knowledgeAction !== 'publish-readiness') {
          fail('--index-entry is only supported for knowledge publish-readiness.');
        }
        if (indexEntryInputPath !== null) {
          fail('Index entry path can be provided at most once.');
        }

        indexEntryInputPath = indexEntryValue;
        index += 1;
        continue;
      }

      if (arg === '--registry') {
        const registryValue = actionArgs[index + 1]?.trim();
        if (!registryValue) {
          fail('Missing value for --registry.');
        }
        if (knowledgeAction !== 'backend-reference-readiness') {
          fail('--registry is only supported for knowledge backend-reference-readiness.');
        }
        if (registryInputPath !== null) {
          fail('Registry path can be provided at most once.');
        }

        registryInputPath = registryValue;
        index += 1;
        continue;
      }

      if (arg === '--backend-reference') {
        const backendReferenceValue = actionArgs[index + 1]?.trim();
        if (!backendReferenceValue) {
          fail('Missing value for --backend-reference.');
        }
        if (knowledgeAction !== 'upload-approval-intent') {
          fail('--backend-reference is only supported for knowledge upload-approval-intent.');
        }
        if (backendReferenceInputPath !== null) {
          fail('Backend reference path can be provided at most once.');
        }

        backendReferenceInputPath = backendReferenceValue;
        index += 1;
        continue;
      }

      if (arg === '--approval-fingerprint') {
        const approvalFingerprintValue = actionArgs[index + 1]?.trim();
        if (!approvalFingerprintValue) {
          fail('Missing value for --approval-fingerprint.');
        }
        if (knowledgeAction !== 'upload-approval-continuation' && knowledgeAction !== 'upload-mutation-approval-review') {
          fail('--approval-fingerprint is only supported for knowledge upload-approval-continuation or knowledge upload-mutation-approval-review.');
        }
        if (approvalFingerprint !== null) {
          fail('Approval fingerprint can be provided at most once.');
        }

        approvalFingerprint = approvalFingerprintValue;
        index += 1;
        continue;
      }

      if (arg === '--adapter-plan') {
        const adapterPlanValue = actionArgs[index + 1]?.trim();
        if (!adapterPlanValue) {
          fail('Missing value for --adapter-plan.');
        }
        if (knowledgeAction !== 'upload-adapter-preflight') {
          fail('--adapter-plan is only supported for knowledge upload-adapter-preflight.');
        }
        if (adapterPlanInputPath !== null) {
          fail('Adapter plan path can be provided at most once.');
        }

        adapterPlanInputPath = adapterPlanValue;
        index += 1;
        continue;
      }

      if (arg === '--mock-harness') {
        const mockHarnessValue = actionArgs[index + 1]?.trim();
        if (!mockHarnessValue) {
          fail('Missing value for --mock-harness.');
        }
        if (knowledgeAction !== 'upload-execution-gate') {
          fail('--mock-harness is only supported for knowledge upload-execution-gate.');
        }
        if (mockHarnessInputPath !== null) {
          fail('Mock harness path can be provided at most once.');
        }

        mockHarnessInputPath = mockHarnessValue;
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

      if (arg === '--descriptor') {
        const descriptorValue = actionArgs[index + 1]?.trim();
        if (!descriptorValue) {
          fail('Missing value for --descriptor.');
        }
        if (knowledgeAction !== 'publish-plan') {
          fail('--descriptor is only supported for knowledge publish-plan.');
        }
        if (descriptorInputPath !== null) {
          fail('Descriptor path can be provided at most once.');
        }

        descriptorInputPath = descriptorValue;
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

      if (arg === '--workspace') {
        if (knowledgeAction !== 'validate') {
          fail('--workspace is only supported for knowledge validate.');
        }
        const workspaceValue = actionArgs[index + 1]?.trim();
        if (!workspaceValue) {
          fail('Missing value for --workspace.');
        }

        validationWorkspace = resolve(cwd(), workspaceValue);
        index += 1;
        continue;
      }

      if (arg.startsWith('--')) {
        fail(`Unknown knowledge ${knowledgeAction} option: ${arg}`);
      }

      positionalArgs.push(arg);
    }

    if (positionalArgs.length > 1) {
      fail(`knowledge ${knowledgeAction} accepts at most one workspace path.`);
    }

    if (knowledgeAction === 'validate' && positionalArgs.length !== 1) {
      fail('knowledge validate requires exactly one knowledge JSON path.');
    }
    if (knowledgeAction === 'publish-plan' && positionalArgs.length !== 1) {
      fail('knowledge publish-plan requires exactly one artifact manifest path.');
    }
    if (knowledgeAction === 'publish-readiness' && positionalArgs.length !== 1) {
      fail('knowledge publish-readiness requires exactly one publication plan path.');
    }
    if (knowledgeAction === 'backend-readiness' && positionalArgs.length !== 1) {
      fail('knowledge backend-readiness requires exactly one backend config path.');
    }
    if (knowledgeAction === 'backend-reference-readiness' && positionalArgs.length !== 1) {
      fail('knowledge backend-reference-readiness requires exactly one backend config path.');
    }
    if (knowledgeAction === 'upload-approval-intent' && positionalArgs.length !== 1) {
      fail('knowledge upload-approval-intent requires exactly one publication readiness path.');
    }
    if (knowledgeAction === 'upload-approval-continuation' && positionalArgs.length !== 1) {
      fail('knowledge upload-approval-continuation requires exactly one upload approval intent path.');
    }
    if (knowledgeAction === 'upload-adapter-preflight' && positionalArgs.length !== 1) {
      fail('knowledge upload-adapter-preflight requires exactly one upload approval continuation path.');
    }
    if (knowledgeAction === 'upload-mock-harness' && positionalArgs.length !== 1) {
      fail('knowledge upload-mock-harness requires exactly one upload adapter preflight path.');
    }
    if (knowledgeAction === 'upload-execution-gate' && positionalArgs.length !== 1) {
      fail('knowledge upload-execution-gate requires exactly one upload approval continuation path.');
    }
    if (knowledgeAction === 'upload-mutation-plan' && positionalArgs.length !== 1) {
      fail('knowledge upload-mutation-plan requires exactly one upload execution gate path.');
    }
    if (knowledgeAction === 'upload-mutation-approval-review' && positionalArgs.length !== 1) {
      fail('knowledge upload-mutation-approval-review requires exactly one upload mutation plan path.');
    }
    if (knowledgeAction === 'upload-execution-prerequisite-plan' && positionalArgs.length !== 1) {
      fail('knowledge upload-execution-prerequisite-plan requires exactly one upload mutation approval review path.');
    }
    if (knowledgeAction === 'upload-write-token-boundary' && positionalArgs.length !== 1) {
      fail('knowledge upload-write-token-boundary requires exactly one upload execution prerequisite plan path.');
    }
    if (knowledgeAction === 'upload-execution-lease-boundary' && positionalArgs.length !== 1) {
      fail('knowledge upload-execution-lease-boundary requires exactly one upload write-token boundary path.');
    }
    if (knowledgeAction === 'upload-rollback-plan-boundary' && positionalArgs.length !== 1) {
      fail('knowledge upload-rollback-plan-boundary requires exactly one upload execution lease boundary path.');
    }
    if (knowledgeAction === 'upload-audit-record-boundary' && positionalArgs.length !== 1) {
      fail('knowledge upload-audit-record-boundary requires exactly one upload rollback plan boundary path.');
    }
    if (knowledgeAction === 'upload-artifact-bytes-boundary' && positionalArgs.length !== 1) {
      fail('knowledge upload-artifact-bytes-boundary requires exactly one upload audit record boundary path.');
    }
    if (knowledgeAction === 'upload-adapter-injection-boundary' && positionalArgs.length !== 1) {
      fail('knowledge upload-adapter-injection-boundary requires exactly one upload artifact bytes boundary path.');
    }
    if (knowledgeAction === 'upload-client-creation-boundary' && positionalArgs.length !== 1) {
      fail('knowledge upload-client-creation-boundary requires exactly one upload adapter injection boundary path.');
    }
    if (knowledgeAction === 'upload-credential-read-boundary' && positionalArgs.length !== 1) {
      fail('knowledge upload-credential-read-boundary requires exactly one upload client creation boundary path.');
    }
    if (knowledgeAction === 'backend-reference-readiness' && registryInputPath === null) {
      fail('knowledge backend-reference-readiness requires --registry <reference-registry.json>.');
    }
    if (knowledgeAction === 'upload-approval-intent' && backendReferenceInputPath === null) {
      fail('knowledge upload-approval-intent requires --backend-reference <reference-readiness.json>.');
    }
    if (knowledgeAction === 'upload-approval-continuation' && approvalFingerprint === null) {
      fail('knowledge upload-approval-continuation requires --approval-fingerprint <sha256>.');
    }
    if (knowledgeAction === 'upload-mutation-approval-review' && approvalFingerprint === null) {
      fail('knowledge upload-mutation-approval-review requires --approval-fingerprint <sha256>.');
    }
    if (knowledgeAction === 'upload-adapter-preflight' && adapterPlanInputPath === null) {
      fail('knowledge upload-adapter-preflight requires --adapter-plan <adapter-plan.json>.');
    }
    if (knowledgeAction === 'upload-execution-gate' && mockHarnessInputPath === null) {
      fail('knowledge upload-execution-gate requires --mock-harness <harness.json>.');
    }
    if (manifestOutputPath !== null && outputPath === null) {
      fail('--manifest-out requires --out so the manifest can reference a persisted artifact.');
    }

    workspace = positionalArgs[0] ?? workspace;

    return {
      command: 'knowledge',
      knowledgeAction,
      task: null,
      workspace: knowledgeAction === 'validate' || knowledgeAction === 'publish-plan' || knowledgeAction === 'publish-readiness' || knowledgeAction === 'backend-readiness' || knowledgeAction === 'backend-reference-readiness' || knowledgeAction === 'upload-approval-intent' || knowledgeAction === 'upload-approval-continuation' || knowledgeAction === 'upload-adapter-preflight' || knowledgeAction === 'upload-mock-harness' || knowledgeAction === 'upload-execution-gate' || knowledgeAction === 'upload-mutation-plan' || knowledgeAction === 'upload-mutation-approval-review' || knowledgeAction === 'upload-execution-prerequisite-plan' || knowledgeAction === 'upload-write-token-boundary' || knowledgeAction === 'upload-execution-lease-boundary' || knowledgeAction === 'upload-rollback-plan-boundary' || knowledgeAction === 'upload-audit-record-boundary' || knowledgeAction === 'upload-artifact-bytes-boundary' || knowledgeAction === 'upload-adapter-injection-boundary' || knowledgeAction === 'upload-client-creation-boundary' || knowledgeAction === 'upload-credential-read-boundary' ? cwd() : workspace,
      inputPath: knowledgeAction === 'validate' || knowledgeAction === 'publish-plan' || knowledgeAction === 'publish-readiness' || knowledgeAction === 'backend-readiness' || knowledgeAction === 'backend-reference-readiness' || knowledgeAction === 'upload-approval-intent' || knowledgeAction === 'upload-approval-continuation' || knowledgeAction === 'upload-adapter-preflight' || knowledgeAction === 'upload-mock-harness' || knowledgeAction === 'upload-execution-gate' || knowledgeAction === 'upload-mutation-plan' || knowledgeAction === 'upload-mutation-approval-review' || knowledgeAction === 'upload-execution-prerequisite-plan' || knowledgeAction === 'upload-write-token-boundary' || knowledgeAction === 'upload-execution-lease-boundary' || knowledgeAction === 'upload-rollback-plan-boundary' || knowledgeAction === 'upload-audit-record-boundary' || knowledgeAction === 'upload-artifact-bytes-boundary' || knowledgeAction === 'upload-adapter-injection-boundary' || knowledgeAction === 'upload-client-creation-boundary' || knowledgeAction === 'upload-credential-read-boundary' ? positionalArgs[0] : null,
      adapterPlanInputPath,
      mockHarnessInputPath,
      approvalFingerprint,
      backendReferenceInputPath,
      descriptorInputPath,
      indexEntryInputPath,
      registryInputPath,
      outputPath,
      manifestOutputPath,
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
      sourceIds,
      maxSources,
      maxFacts,
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
      targetPaths: parsed.targetPaths
    });

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }

    printKnowledgeSourcesReport(report);
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'prefetch') {
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

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'extract') {
    const inspection = await inspectWorkspace(parsed.workspace);
    const report = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: parsed.domains,
      targetPaths: parsed.targetPaths,
      sourceIds: parsed.sourceIds
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), report)
      : null;
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
            ...(manifestPath ? { manifestPath } : {})
          }
        : report, null, 2)}\n`);
      return;
    }

    printKnowledgeExtractionReport(report);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    if (manifestPath) {
      process.stdout.write(`manifest: ${manifestPath}\n`);
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

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'publish-plan') {
    if (!parsed.inputPath) {
      fail('knowledge publish-plan requires exactly one artifact manifest path.');
    }

    const manifestPath = resolveFromCwd(parsed.inputPath);
    const manifest = await readJsonObject(manifestPath);
    if (!isRecord(manifest.artifact) || typeof manifest.artifact.path !== 'string') {
      fail('knowledge publish-plan requires an artifact manifest with artifact.path.');
    }
    const artifactPath = isAbsolute(manifest.artifact.path)
      ? manifest.artifact.path
      : resolve(dirname(manifestPath), manifest.artifact.path);
    const artifactBytes = await readFile(artifactPath);
    const descriptor = parsed.descriptorInputPath
      ? await readJsonObject(resolveFromCwd(parsed.descriptorInputPath)) as unknown as KnowledgeTeamArtifactDescriptor
      : undefined;
    const plan = buildKnowledgeTeamPublicationPlan({
      manifest: manifest as unknown as KnowledgeArtifactManifest,
      artifactBytes,
      ...(descriptor !== undefined ? { descriptor } : {})
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), plan)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...plan,
            outputPath: writtenPath
          }
        : plan, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamPublicationPlan(plan);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'publish-readiness') {
    if (!parsed.inputPath) {
      fail('knowledge publish-readiness requires exactly one publication plan path.');
    }

    const planPath = resolveFromCwd(parsed.inputPath);
    const plan = await readJsonObject(planPath) as unknown as KnowledgeTeamPublicationPlan;
    const planReport = validateKnowledgePayload(plan, planPath);
    if (planReport.inputKind !== 'infra-agent.knowledge-team-publication-plan' || !planReport.valid) {
      fail('knowledge publish-readiness requires a valid team publication plan JSON file.');
    }

    const indexEntry = parsed.indexEntryInputPath
      ? await readJsonObject(resolveFromCwd(parsed.indexEntryInputPath)) as unknown as KnowledgeTeamArtifactIndexEntry
      : undefined;
    if (indexEntry !== undefined) {
      const entryReport = validateKnowledgePayload(indexEntry, parsed.indexEntryInputPath ?? 'index-entry');
      if (entryReport.inputKind !== 'infra-agent.knowledge-team-artifact-index-entry' || !entryReport.valid) {
        fail('knowledge publish-readiness requires a valid team artifact index entry JSON file.');
      }
    }

    const readiness = buildKnowledgeTeamPublicationReadinessReport({
      plan,
      ...(indexEntry !== undefined ? { indexEntry } : {})
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), readiness)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...readiness,
            outputPath: writtenPath
          }
        : readiness, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamPublicationReadinessReport(readiness);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'backend-readiness') {
    if (!parsed.inputPath) {
      fail('knowledge backend-readiness requires exactly one backend config path.');
    }

    const configPath = resolveFromCwd(parsed.inputPath);
    const config = await readJsonObject(configPath);
    const readiness = buildKnowledgeTeamBackendReadinessReport(config);
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), readiness)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...readiness,
            outputPath: writtenPath
          }
        : readiness, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamBackendReadinessReport(readiness);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'backend-reference-readiness') {
    if (!parsed.inputPath) {
      fail('knowledge backend-reference-readiness requires exactly one backend config path.');
    }
    if (!parsed.registryInputPath) {
      fail('knowledge backend-reference-readiness requires --registry <reference-registry.json>.');
    }

    const configPath = resolveFromCwd(parsed.inputPath);
    const registryPath = resolveFromCwd(parsed.registryInputPath);
    const config = await readJsonObject(configPath);
    const registry = await readJsonObject(registryPath);
    const readiness = validateKnowledgeTeamS3CompatibleBackendReferences(config, registry);
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), readiness)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...readiness,
            outputPath: writtenPath
          }
        : readiness, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamS3CompatibleReferenceValidationSummary(readiness);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'upload-approval-intent') {
    if (!parsed.inputPath) {
      fail('knowledge upload-approval-intent requires exactly one publication readiness path.');
    }
    if (!parsed.backendReferenceInputPath) {
      fail('knowledge upload-approval-intent requires --backend-reference <reference-readiness.json>.');
    }

    const readinessPath = resolveFromCwd(parsed.inputPath);
    const backendReferencePath = resolveFromCwd(parsed.backendReferenceInputPath);
    const publicationReadiness = await readJsonObject(readinessPath);
    const backendReferenceValidation = await readJsonObject(backendReferencePath);
    const intent = buildKnowledgeTeamUploadApprovalIntent({
      publicationReadiness,
      backendReferenceValidation
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), intent)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...intent,
            outputPath: writtenPath
          }
        : intent, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamUploadApprovalIntent(intent);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'upload-approval-continuation') {
    if (!parsed.inputPath) {
      fail('knowledge upload-approval-continuation requires exactly one upload approval intent path.');
    }
    if (!parsed.approvalFingerprint) {
      fail('knowledge upload-approval-continuation requires --approval-fingerprint <sha256>.');
    }

    const intentPath = resolveFromCwd(parsed.inputPath);
    const approvalIntent = await readJsonObject(intentPath);
    const continuation = buildKnowledgeTeamUploadApprovalContinuation({
      approvalIntent,
      approvalFingerprint: parsed.approvalFingerprint
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), continuation)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...continuation,
            outputPath: writtenPath
          }
        : continuation, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamUploadApprovalContinuation(continuation);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'upload-adapter-preflight') {
    if (!parsed.inputPath) {
      fail('knowledge upload-adapter-preflight requires exactly one upload approval continuation path.');
    }
    if (!parsed.adapterPlanInputPath) {
      fail('knowledge upload-adapter-preflight requires --adapter-plan <adapter-plan.json>.');
    }

    const continuationPath = resolveFromCwd(parsed.inputPath);
    const adapterPlanPath = resolveFromCwd(parsed.adapterPlanInputPath);
    const continuation = await readJsonObject(continuationPath);
    const adapterResolutionPlan = await readJsonObject(adapterPlanPath);
    const preflight = buildKnowledgeTeamUploadAdapterPreflight({
      continuation,
      adapterResolutionPlan
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), preflight)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...preflight,
            outputPath: writtenPath
          }
        : preflight, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamUploadAdapterPreflight(preflight);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'upload-mock-harness') {
    if (!parsed.inputPath) {
      fail('knowledge upload-mock-harness requires exactly one upload adapter preflight path.');
    }

    const preflightPath = resolveFromCwd(parsed.inputPath);
    const preflight = await readJsonObject(preflightPath);
    const harness = buildKnowledgeTeamUploadMockHarness({ preflight });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), harness)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...harness,
            outputPath: writtenPath
          }
        : harness, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamUploadMockHarness(harness);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'upload-execution-gate') {
    if (!parsed.inputPath) {
      fail('knowledge upload-execution-gate requires exactly one upload approval continuation path.');
    }
    if (!parsed.mockHarnessInputPath) {
      fail('knowledge upload-execution-gate requires --mock-harness <harness.json>.');
    }

    const continuationPath = resolveFromCwd(parsed.inputPath);
    const mockHarnessPath = resolveFromCwd(parsed.mockHarnessInputPath);
    const continuation = await readJsonObject(continuationPath);
    const mockHarness = await readJsonObject(mockHarnessPath);
    const gate = buildKnowledgeTeamUploadExecutionGate({
      continuation,
      mockHarness
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), gate)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...gate,
            outputPath: writtenPath
          }
        : gate, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamUploadExecutionGate(gate);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'upload-mutation-plan') {
    if (!parsed.inputPath) {
      fail('knowledge upload-mutation-plan requires exactly one upload execution gate path.');
    }

    const gatePath = resolveFromCwd(parsed.inputPath);
    const executionGate = await readJsonObject(gatePath);
    const plan = buildKnowledgeTeamUploadMutationPlan({ executionGate });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), plan)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...plan,
            outputPath: writtenPath
          }
        : plan, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamUploadMutationPlan(plan);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'upload-mutation-approval-review') {
    if (!parsed.inputPath) {
      fail('knowledge upload-mutation-approval-review requires exactly one upload mutation plan path.');
    }
    if (!parsed.approvalFingerprint) {
      fail('knowledge upload-mutation-approval-review requires --approval-fingerprint <sha256>.');
    }

    const mutationPlanPath = resolveFromCwd(parsed.inputPath);
    const mutationPlan = await readJsonObject(mutationPlanPath);
    const review = buildKnowledgeTeamUploadMutationApprovalReview({
      mutationPlan,
      approvalFingerprint: parsed.approvalFingerprint
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), review)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...review,
            outputPath: writtenPath
          }
        : review, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamUploadMutationApprovalReview(review);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'upload-execution-prerequisite-plan') {
    if (!parsed.inputPath) {
      fail('knowledge upload-execution-prerequisite-plan requires exactly one upload mutation approval review path.');
    }

    const approvalReviewPath = resolveFromCwd(parsed.inputPath);
    const approvalReview = await readJsonObject(approvalReviewPath);
    const plan = buildKnowledgeTeamUploadExecutionPrerequisitePlan({
      approvalReview
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), plan)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...plan,
            outputPath: writtenPath
          }
        : plan, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamUploadExecutionPrerequisitePlan(plan);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'upload-write-token-boundary') {
    if (!parsed.inputPath) {
      fail('knowledge upload-write-token-boundary requires exactly one upload execution prerequisite plan path.');
    }

    const prerequisitePlanPath = resolveFromCwd(parsed.inputPath);
    const prerequisitePlan = await readJsonObject(prerequisitePlanPath);
    const boundary = buildKnowledgeTeamUploadWriteTokenBoundary({
      prerequisitePlan
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), boundary)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...boundary,
            outputPath: writtenPath
          }
        : boundary, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamUploadWriteTokenBoundary(boundary);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'upload-execution-lease-boundary') {
    if (!parsed.inputPath) {
      fail('knowledge upload-execution-lease-boundary requires exactly one upload write-token boundary path.');
    }

    const writeTokenBoundaryPath = resolveFromCwd(parsed.inputPath);
    const writeTokenBoundary = await readJsonObject(writeTokenBoundaryPath);
    const boundary = buildKnowledgeTeamUploadExecutionLeaseBoundary({
      writeTokenBoundary
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), boundary)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...boundary,
            outputPath: writtenPath
          }
        : boundary, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamUploadExecutionLeaseBoundary(boundary);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'upload-rollback-plan-boundary') {
    if (!parsed.inputPath) {
      fail('knowledge upload-rollback-plan-boundary requires exactly one upload execution lease boundary path.');
    }

    const executionLeaseBoundaryPath = resolveFromCwd(parsed.inputPath);
    const executionLeaseBoundary = await readJsonObject(executionLeaseBoundaryPath);
    const boundary = buildKnowledgeTeamUploadRollbackPlanBoundary({
      executionLeaseBoundary
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), boundary)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...boundary,
            outputPath: writtenPath
          }
        : boundary, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamUploadRollbackPlanBoundary(boundary);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'upload-audit-record-boundary') {
    if (!parsed.inputPath) {
      fail('knowledge upload-audit-record-boundary requires exactly one upload rollback plan boundary path.');
    }

    const rollbackPlanBoundaryPath = resolveFromCwd(parsed.inputPath);
    const rollbackPlanBoundary = await readJsonObject(rollbackPlanBoundaryPath);
    const boundary = buildKnowledgeTeamUploadAuditRecordBoundary({
      rollbackPlanBoundary
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), boundary)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...boundary,
            outputPath: writtenPath
          }
        : boundary, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamUploadAuditRecordBoundary(boundary);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'upload-artifact-bytes-boundary') {
    if (!parsed.inputPath) {
      fail('knowledge upload-artifact-bytes-boundary requires exactly one upload audit record boundary path.');
    }

    const auditRecordBoundaryPath = resolveFromCwd(parsed.inputPath);
    const auditRecordBoundary = await readJsonObject(auditRecordBoundaryPath);
    const boundary = buildKnowledgeTeamUploadArtifactBytesBoundary({
      auditRecordBoundary
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), boundary)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...boundary,
            outputPath: writtenPath
          }
        : boundary, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamUploadArtifactBytesBoundary(boundary);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'upload-adapter-injection-boundary') {
    if (!parsed.inputPath) {
      fail('knowledge upload-adapter-injection-boundary requires exactly one upload artifact bytes boundary path.');
    }

    const artifactBytesBoundaryPath = resolveFromCwd(parsed.inputPath);
    const artifactBytesBoundary = await readJsonObject(artifactBytesBoundaryPath);
    const boundary = buildKnowledgeTeamUploadAdapterInjectionBoundary({
      artifactBytesBoundary
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), boundary)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...boundary,
            outputPath: writtenPath
          }
        : boundary, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamUploadAdapterInjectionBoundary(boundary);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'upload-client-creation-boundary') {
    if (!parsed.inputPath) {
      fail('knowledge upload-client-creation-boundary requires exactly one upload adapter injection boundary path.');
    }

    const adapterInjectionBoundaryPath = resolveFromCwd(parsed.inputPath);
    const adapterInjectionBoundary = await readJsonObject(adapterInjectionBoundaryPath);
    const boundary = buildKnowledgeTeamUploadClientCreationBoundary({
      adapterInjectionBoundary
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), boundary)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...boundary,
            outputPath: writtenPath
          }
        : boundary, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamUploadClientCreationBoundary(boundary);
    if (writtenPath) {
      process.stdout.write(`\nwritten: ${writtenPath}\n`);
    }
    return;
  }

  if (parsed.command === 'knowledge' && parsed.knowledgeAction === 'upload-credential-read-boundary') {
    if (!parsed.inputPath) {
      fail('knowledge upload-credential-read-boundary requires exactly one upload client creation boundary path.');
    }

    const clientCreationBoundaryPath = resolveFromCwd(parsed.inputPath);
    const clientCreationBoundary = await readJsonObject(clientCreationBoundaryPath);
    const boundary = buildKnowledgeTeamUploadCredentialReadBoundary({
      clientCreationBoundary
    });
    const writtenPath = parsed.outputPath
      ? await writeJsonArtifact(parsed.outputPath, cwd(), boundary)
      : null;

    if (parsed.json) {
      process.stdout.write(`${JSON.stringify(writtenPath
        ? {
            ...boundary,
            outputPath: writtenPath
          }
        : boundary, null, 2)}\n`);
      return;
    }

    printKnowledgeTeamUploadCredentialReadBoundary(boundary);
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
      sourceIds: parsed.sourceIds,
      maxFacts: parsed.maxFacts ?? undefined
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
