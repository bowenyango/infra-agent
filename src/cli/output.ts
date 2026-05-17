import type { AgentRunState } from '../agent/run-single-step.ts';
import type { ToolSafety } from '../Tool.ts';
import { DEFAULT_QUERY_LOOP_CONFIG } from '../query-config.ts';
import type {
  AgentActionFamily,
  AgentActionKind,
  AgentClarificationKind,
  AgentStopReason,
  ApprovalSignal,
  ValidationIssue
} from '../types/agent.ts';
import type {
  DomainCapabilitySummary,
  InfraDomainId,
  RunPreflightState,
  TargetCandidate,
  ValidationPlanEntry,
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
  ValidationCommandOutput,
  ValidationRunOutput
} from '../types/tools.ts';
import type { EditPlanKind } from '../types/edit-plan.ts';
import { getRuntimeConfigSemantics } from '../agent/config-semantics-state.ts';
import { selectValidationPlanEntries } from '../agent/select-validation-commands.ts';
import {
  collectRuntimeIdentityConflicts,
  formatIdentityConflictFields,
  identityConflictResourceLocator,
  normalizeIdentityConflictRiskCategory,
  summarizeRuntimeIdentityConflictAggregate,
  type IdentityConflictRiskCategory,
  type RuntimeIdentityConflictAggregateSummary,
  type RuntimeIdentityConflictSummary
} from '../agent/identity-conflicts.ts';
import type { KnowledgePrefetchResult, KnowledgePrefetchSourceResult } from '../knowledge/prefetch.ts';
import type { KnowledgeSourcesReport, KnowledgeSourceReportEntry } from '../knowledge/sources.ts';
import type { KnowledgeExtractionReport, KnowledgeExtractionSourceResult } from '../knowledge/extract.ts';
import type { KnowledgeValidationReport } from '../knowledge/validate.ts';
import type { KnowledgePack } from '../knowledge/pack.ts';
import type { SharedKnowledgeArtifactPublishReport } from '../knowledge/shared-artifact-publish.ts';
import type {
  KnowledgeUnitIndexEntry,
  KnowledgeUnitMetadataIndex
} from '../knowledge/unit-index.ts';
import { budgetRetrievedContext, type RetrievedContextBudgetSummary } from '../knowledge/context-budget.ts';
import {
  budgetKnowledgePackFacts,
  type KnowledgeFactBudgetSummary
} from '../knowledge/fact-budget.ts';
import {
  aggregateToolPermissions,
  classifyToolPermission,
  type ToolPermissionCategory,
  type ToolPermissionAggregate,
  type ToolPermissionSummary
} from '../agent/tool-permissions.ts';
import {
  INFRA_GRAPH_IMPACT_MUTATION_ALLOWED,
  INFRA_GRAPH_IMPACT_REVIEW_TARGET_LIMIT,
  buildInfraGraphImpactReviewTargets,
  countInfraGraphImpactReviewTargets,
  inferInfraGraphImpactPosture,
  isInfraGraphImpactPrimaryConcern,
  isInfraGraphImpactRecommendedAction,
  isInfraGraphImpactRiskLevel,
  normalizeInfraGraphImpactReviewSteps,
  normalizeInfraGraphImpactReviewTargets
} from '../impact/graph-impact-summary.ts';
import type { InfraGraph } from '../types/infra-graph.ts';
import type { ChangedContextReport } from '../types/changed-context.ts';
import type { DoctorReport } from './doctor.ts';
import { classifyUnsafeValidationCommand } from '../validators/command-safety.ts';
import type { InfraGraphImpactReport } from './infra-graph-report.ts';
import {
  buildPlannerProviderCatalogDiscovery,
  type PlannerProviderCatalogDiscovery,
  type PlannerProviderCatalogReport
} from './planner-provider-catalog.ts';

type ValidationIdentityConflictSummary = RuntimeIdentityConflictSummary;
type ValidationIdentityConflictAggregateSummary = RuntimeIdentityConflictAggregateSummary;
type GraphImpactSummary = NonNullable<InfraGraph['summary']['impact']>;

interface ValidationDerivedSemanticBlocker {
  targetKind: string;
  targetPath: string;
  path: string;
  sourceKind: string;
  confidence: string;
  message?: string;
}

interface CompactValidationSafetyBlocker {
  kind: 'unsafe-validation-command' | 'yaml-syntax-failure';
  sourceCommand: string;
  message: string;
  guidance: string | null;
  repairable: boolean;
  mutationPrevented: true;
  unsafeCommand: string | null;
  unsafeRuleId: string | null;
  unsafeReason: string | null;
  yamlPath: string | null;
  yamlParser: string | null;
}

interface CompactTurnTraceEntry {
  index: number;
  actionKind: string;
  actionFamily: string | null;
  confidence: string;
  summary: string;
  terminal: boolean;
  executionStatus: string | null;
  executionReason: string | null;
  executedToolCount: number;
  stopReason: string | null;
  clarificationKind: string | null;
  changedFileCount: number;
  validationIssueCount: number;
  approvalSignalCount: number;
}

interface CompactToolTraceEntry {
  turnIndex: number;
  actionKind: string;
  toolName: string;
  safety: string;
  permissionCategory: string;
  mutatesWorkspace: boolean;
  mutatesExternalState: boolean;
  externalCommand: boolean;
  approvalRequired: boolean;
  summary: string;
}

interface CompactLifecycleEvent {
  event: 'query-started' | 'decision' | 'tool-execution' | 'approval-gate' | 'terminal';
  turnIndex: number | null;
  actionKind: string | null;
  actionFamily: string | null;
  executionStatus: string | null;
  reason: string | null;
  toolCount: number;
  approvalSignalCount: number;
  validationIssueCount: number;
  outcome: AgentRunState['outcome'] | null;
}

interface CompactApprovalSignal {
  kind: ApprovalSignal['kind'];
  message: string;
  path: string | null;
  risk: string | null;
  toolCategory: string | null;
}

interface CompactReadinessCheck {
  name: string;
  status: DoctorReport['summary']['status'];
  message: string;
  detail: string | null;
}

interface CompactReadinessSummary {
  status: DoctorReport['summary']['status'];
  passCount: number;
  warnCount: number;
  failCount: number;
  doctorCommand: string;
  plannerProviderCatalog: PlannerProviderCatalogDiscovery;
  checks: CompactReadinessCheck[];
}

type CompactTargetingAmbiguityKind =
  | 'missing-environment'
  | 'missing-service'
  | 'no-candidates'
  | 'weak-match'
  | 'tied-top-score';
type CompactTargetingRecommendedAction =
  | 'inspect-selected-target'
  | 'review-targeting'
  | 'clarify-target';

interface CompactTargetingCandidate {
  rank: number;
  selected: boolean;
  kind: TargetCandidate['kind'];
  domain: InfraDomainId;
  name: string;
  path: string;
  score: number;
  reasonCount: number;
  reasons: string[];
  matchedEnvironmentHints: string[];
  detailCount: number;
  details: string[];
}

interface CompactTargetingSummary {
  schemaVersion: 1;
  source: 'derived-run-preflight';
  compact: true;
  mutationAllowed: false;
  selectedTarget: Pick<CompactTargetingCandidate, 'rank' | 'kind' | 'domain' | 'name' | 'path' | 'score'> | null;
  candidateCount: number;
  topScore: number | null;
  scoreGapToNext: number | null;
  maxCandidates: number;
  includedCount: number;
  omittedCount: number;
  ambiguityKinds: CompactTargetingAmbiguityKind[];
  recommendedAction: CompactTargetingRecommendedAction;
  flags: {
    missingEnvironment: boolean;
    missingService: boolean;
    noCandidates: boolean;
    weakTopScore: boolean;
    tiedTopScore: boolean;
  };
  candidates: CompactTargetingCandidate[];
}

interface CompactHandoffCheckpoint {
  schemaVersion: 1;
  source: 'agent-result';
  compact: true;
  primaryArtifact: 'agent --json';
  debugArtifact: 'agent --json-full';
  mutationAllowed: false;
  exclusions: {
    rawRuntimeIncluded: false;
    rawPreflightIncluded: false;
    rawToolOutputIncluded: false;
    rawPromptIncluded: false;
    rawKnowledgeExcerptIncluded: false;
  };
  summary: {
    outcome: AgentRunState['outcome'];
    activeBlocker: CompactAgentRunResult['harness']['plannerHandoff']['activeBlocker']['kind'];
    nextControlAction: CompactAgentRunResult['harness']['plannerHandoff']['nextControlAction'];
    readinessStatus: DoctorReport['summary']['status'];
    validationStatus: string;
    validationIssueCount: number;
    identityConflictCount: number;
    approvalContinuationRequired: boolean;
    changedFileCount: number;
  };
  budgets: {
    turnTrace: CompactHandoffBudgetSample;
    lifecycleEvents: CompactHandoffBudgetSample;
    toolTrace: CompactHandoffBudgetSample;
    workPlan: CompactHandoffBudgetSample;
    targeting: CompactHandoffBudgetSample;
    validationCommands: CompactHandoffBudgetSample;
    validationIssues: CompactHandoffBudgetSample;
    validationIssueGroups: CompactHandoffBudgetSample;
    validationSafetyBlockers: CompactHandoffBudgetSample;
    identityConflicts: CompactHandoffBudgetSample;
    approvalSignals: CompactHandoffBudgetSample;
    knowledgePackets: CompactHandoffBudgetSample & {
      includedTokenEstimate: number;
      omittedTokenEstimate: number;
    };
    knowledgeFacts: CompactHandoffBudgetSample;
    knowledgeUnits: CompactHandoffBudgetSample;
  };
  continuation: {
    required: boolean;
    reason: 'none' | 'approval' | 'clarification' | 'validation' | 'repair-budget' | 'turn-budget' | 'no-safe-action';
    nextControlAction: CompactAgentRunResult['harness']['plannerHandoff']['nextControlAction'];
    approvalRequired: boolean;
    command: string | null;
    compactCommand: string | null;
    debugCommand: string | null;
    mutationAllowed: false;
  };
  durableSections: Array<
    | 'root'
    | 'harness'
    | 'validation'
    | 'approval'
    | 'knowledge'
    | 'readiness'
    | 'result-card'
  >;
}

interface CompactHandoffBudgetSample {
  includedCount: number;
  omittedCount: number;
}

type CompactWorkPlanStatus = 'not-started' | 'in-progress' | 'blocked' | 'completed';
type CompactWorkPlanStepKind = 'readiness' | 'targeting' | 'inspection' | 'edit' | 'validation' | 'handoff';
type CompactWorkPlanStepStatus = 'pending' | 'in-progress' | 'blocked' | 'completed' | 'skipped';

interface CompactWorkPlanStep {
  index: number;
  kind: CompactWorkPlanStepKind;
  status: CompactWorkPlanStepStatus;
  title: string;
  summary: string;
  actionKind: AgentActionKind | null;
  validationIssueKind: ValidationIssue['kind'] | null;
  approvalSignalKind: ApprovalSignal['kind'] | null;
}

interface CompactWorkPlan {
  schemaVersion: 1;
  source: 'derived-agent-run-state';
  compact: true;
  mutationAllowed: false;
  status: CompactWorkPlanStatus;
  blockerKind: CompactAgentRunResult['harness']['plannerHandoff']['activeBlocker']['kind'];
  nextControlAction: CompactAgentRunResult['harness']['plannerHandoff']['nextControlAction'];
  currentStepIndex: number | null;
  totalStepCount: number;
  completedStepCount: number;
  pendingStepCount: number;
  blockedStepCount: number;
  skippedStepCount: number;
  maxEntries: number;
  includedCount: number;
  omittedCount: number;
  steps: CompactWorkPlanStep[];
}

export interface IdentityConflictIncident {
  engine: ValidationIdentityConflictSummary['engine'];
  issueKind: ValidationIdentityConflictSummary['issueKind'];
  conflictCode: string | null;
  conflictFamily: string | null;
  conflictLabel: string | null;
  resourceLocator: string | null;
  resourceType: string | null;
  identity: Record<string, string>;
  riskCategory: IdentityConflictRiskCategory;
  reviewSteps: string[];
  suggestedAction: string | null;
  sourceCommand: string;
  mutationAllowed: false;
}

export interface IdentityConflictIncidentReport {
  kind: 'infra-agent.identity-conflict-report';
  schemaVersion: 1;
  sourceKind: CompactAgentRunResult['kind'];
  sourceSchemaVersion: CompactAgentRunResult['schemaVersion'];
  sourceTask: string;
  workspaceRoot: string;
  outcome: CompactAgentRunResult['outcome'];
  mutationAllowed: false;
  incidentCount: number;
  omittedIncidentCount: number;
  incidentSummary: ValidationIdentityConflictAggregateSummary;
  summary: string[];
  incidents: IdentityConflictIncident[];
}

export interface CompactAgentRunResult {
  kind: 'infra-agent.agent-result';
  schemaVersion: 1;
  outcome: AgentRunState['outcome'];
  modelName: string;
  turnsUsed: number;
  task: string;
  workspaceRoot: string;
  profileId: string;
  requestedDomains: string[];
  requestedEnvironment: string | null;
  requestedService: string | null;
  primaryTarget: Pick<TargetCandidate, 'kind' | 'name' | 'path' | 'score'> | null;
  changedFiles: string[];
  resultCard: string[];
  nextSteps: string[];
  suggestedCommands: string[];
  handoffCheckpoint: CompactHandoffCheckpoint;
  harness: {
    maxTurns: number;
    queryConfig: {
      maxTurns: number;
      maxRepairAttempts: number;
      retrievedContextBudget: AgentRunState['config']['retrievedContextBudget'];
    };
    plannerConfig: {
      requestedMode: string;
      effectiveMode: string;
      clientName: string;
      fallbackReason: string | null;
      llm: {
        provider: string;
        model: string;
        baseUrl: string;
        apiKeyConfigured: true;
        apiKeySource: string;
        providerSource: string;
        modelSource: string;
        baseUrlSource: string;
        capabilities: {
          transport: string;
          endpointPath: string;
          responseFormat: string;
          supportsJsonObject: boolean;
          supportsStreaming: boolean;
        };
      } | null;
    };
    loopBudget: {
      turnsUsed: number;
      maxTurns: number;
      turnsRemaining: number;
      exhausted: boolean;
    };
    repairBudget: {
      attemptsUsed: number;
      maxAttempts: number;
      attemptsRemaining: number;
      exhausted: boolean;
    };
    stateSummary: {
      observationCount: number;
      toolSummaryCount: number;
      appliedWriteCount: number;
      validationResultCount: number;
      validationIssueCount: number;
      approvalSignalCount: number;
      retrievedContextCount: number;
      knowledgeFactCount: number;
      knowledgeUnitCount: number;
      semanticFactCount: number;
    };
    targeting: CompactTargetingSummary;
    plannerHandoff: {
      lastAction: {
        kind: AgentActionKind | null;
        family: AgentActionFamily | null;
        stopReason: AgentStopReason | null;
        clarificationKind: AgentClarificationKind | null;
        executionStatus: 'completed' | 'skipped' | null;
      };
      activeBlocker: {
        kind: 'none' | 'approval' | 'clarification' | 'validation' | 'repair-budget' | 'turn-budget' | 'no-safe-action';
        validationIssueKind: ValidationIssue['kind'] | null;
        approvalSignalKind: ApprovalSignal['kind'] | null;
      };
      nextControlAction:
        | 'review-result'
        | 'request-approval'
        | 'answer-clarification'
        | 'resolve-validation'
        | 'manual-repair'
        | 'rerun-with-larger-turn-budget'
        | 'inspect-readiness-or-targeting';
    };
    workPlan: CompactWorkPlan;
    lifecycleEvents: {
      maxEntries: number;
      totalCount: number;
      includedCount: number;
      omittedCount: number;
      eventCounts: Record<CompactLifecycleEvent['event'], number>;
      events: CompactLifecycleEvent[];
    };
    turnTraceBudget: {
      maxEntries: number;
      totalCount: number;
      includedCount: number;
      omittedCount: number;
      firstIncludedTurnIndex: number | null;
      lastIncludedTurnIndex: number | null;
      preservedWindow: 'head';
    };
    turnTraceLimit: number;
    turnTraceOmittedCount: number;
    turnTrace: CompactTurnTraceEntry[];
    toolTrace: {
      maxEntries: number;
      totalCount: number;
      includedCount: number;
      omittedCount: number;
      firstIncludedTurnIndex: number | null;
      lastIncludedTurnIndex: number | null;
      preservedWindow: 'tail';
      latestTurnIndex: number | null;
      permissionCategoryCounts: Partial<Record<ToolPermissionCategory, number>>;
      entries: CompactToolTraceEntry[];
    };
    toolPermissionSummary: ToolPermissionAggregate;
  };
  validation: {
    status: string;
    findings: string;
    selectedPlan: Array<{
      kind: ValidationPlanEntry['kind'];
      target: string;
      commandCount: number;
      commands: string[];
      executedCommandCount: number;
      failedCommandCount: number;
      validatorAvailable: boolean;
    }>;
    semanticBlockers: ValidationDerivedSemanticBlocker[];
    identityConflictSummary: ValidationIdentityConflictAggregateSummary;
    identityConflicts: ValidationIdentityConflictSummary[];
    targetCommandCount: number;
    yamlGuardCount: number;
    commands: {
      maxEntries: number;
      omittedCount: number;
      entries: Array<{
        command: string;
        exitCode: number;
        status: 'passed' | 'failed';
        kind: 'yaml-guard' | 'target-validation';
        stdoutPreview: string;
        stderrPreview: string;
        unsafeBlocked: boolean;
        unsafeRuleId: string | null;
        unsafeReason: string | null;
      }>;
    };
    issueSummary: {
      totalCount: number;
      omittedIssueCount: number;
      repairableCount: number;
      nonRepairableCount: number;
      maxGroups: number;
      omittedGroupCount: number;
      groups: Array<{
        kind: ValidationIssue['kind'];
        repairable: boolean;
        count: number;
        sourceCommandCount: number;
        blocking: boolean;
      }>;
      flags: {
        hasRepairableIssues: boolean;
        hasNonRepairableIssues: boolean;
        hasUnsafeValidationCommand: boolean;
        hasYamlSyntaxFailure: boolean;
        hasIdentityConflict: boolean;
      };
    };
    issueDetails: {
      maxEntries: number;
      omittedCount: number;
    };
    safetyBlockers: {
      maxEntries: number;
      omittedCount: number;
      entries: CompactValidationSafetyBlocker[];
    };
    issues: Array<Pick<ValidationIssue, 'kind' | 'repairable' | 'message' | 'metadata'> & {
      guidance: string | null;
    }>;
  };
  approval: {
    requiredWriteRisks: string[];
    requiredToolCategories: string[];
    grants: {
      approvedWriteRisks: string[];
      approvedWritePaths: string[];
      approvedToolCategories: string[];
      writePathScope: 'all' | 'scoped';
      hasExplicitApproval: boolean;
    };
    signals: CompactApprovalSignal[];
    resume: {
      continuationRequired: boolean;
      command: string | null;
      compactCommand: string | null;
      debugCommand: string | null;
      primarySignal: CompactApprovalSignal | null;
      additionalCommands: Array<{
        signal: CompactApprovalSignal;
        command: string;
        compactCommand: string;
        debugCommand: string;
      }>;
      additionalSignalCount: number;
      additionalWriteRisks: string[];
      additionalWritePaths: string[];
      additionalToolCategories: string[];
      pendingScope: {
        signalCount: number;
        includedSignalCount: number;
        omittedSignalCount: number;
        additionalSignalCount: number;
        writeRiskCount: number;
        writePathCount: number;
        toolCategoryCount: number;
      };
      writeRisks: string[];
      writePaths: string[];
      toolCategories: string[];
      signalCount: number;
    };
  };
  knowledgeCache: WorkspaceInspection['knowledgeCache'];
  knowledgeContext: RetrievedContextBudgetSummary;
  knowledgeFacts: KnowledgeFactBudgetSummary;
  readiness: CompactReadinessSummary;
}

function formatKnowledgeSourceResult(result: KnowledgePrefetchSourceResult): string {
  const location = result.source.url ?? result.source.localPath ?? 'unknown-source';
  const confidence = result.confidence ? ` confidence=${result.confidence}` : '';
  const contentType = result.contentType ? ` content=${result.contentType}` : '';
  const previousCache = ` previous-cache=${result.previousCacheStatus}`;
  const message = result.message ? ` (${result.message})` : '';

  return `${result.status} ${result.domain} ${result.targetPath}: ${result.source.kind} ${result.source.name} -> ${location}${previousCache}${confidence}${contentType}${message}`;
}

function formatKnowledgeSourceReportEntry(entry: KnowledgeSourceReportEntry): string {
  const location = entry.source.url ?? entry.source.localPath ?? 'no source location';
  const fetchPosture = entry.requiresFetch ? 'external' : 'local';
  const cache = entry.cacheStatus === 'stale' || entry.cacheStatus === 'missing'
    ? `cache=${entry.cacheStatus}, refresh=prefetch recommended`
    : `cache=${entry.cacheStatus}`;
  const storage = entry.storagePolicy.scope === 'public-reference'
    ? 'public-reference'
    : 'workspace-private';
  const sharing = entry.storagePolicy.shareableByDefault ? 'shareable' : 'opt-in';
  return `${entry.domain} ${entry.targetPath}: ${entry.source.kind} ${entry.source.name} (${fetchPosture}, ${cache}, ${storage}, ${sharing}, id=${entry.id}, ${location})`;
}

function formatKnowledgeExtractionSourceResult(result: KnowledgeExtractionSourceResult): string {
  const location = result.source.url ?? result.source.localPath ?? 'no source location';
  const factLabel = result.factCount > 0 ? `, facts=${result.factCount}` : '';
  const unitLabel = result.unitCount > 0 ? `, units=${result.unitCount}` : '';
  const message = result.message ? ` (${result.message})` : '';
  return `${result.status} ${result.domain} ${result.targetPath}: ${result.source.kind} ${result.source.name} (id=${result.id}${factLabel}${unitLabel}, ${location})${message}`;
}

function formatKnowledgeStaleSource(source: KnowledgeValidationReport['freshness']['staleSources'][number]): string {
  const label = `${source.sourceKind ?? 'unknown-source'} ${source.sourceName ?? source.sourceId}`;
  const changedPaths = source.stalePaths && source.stalePaths.length > 0
    ? ` changed=${source.stalePaths.join(', ')}`
    : '';
  const missingPaths = source.missingPaths && source.missingPaths.length > 0
    ? ` missing=${source.missingPaths.join(', ')}`
    : '';
  return `stale ${label}: reason=${source.staleReason ?? 'unknown'}, facts=${source.factCount}${changedPaths}${missingPaths}`;
}

function formatKnowledgeUncheckedSource(source: KnowledgeValidationReport['freshness']['uncheckedLocalSources'][number]): string {
  const label = `${source.sourceKind ?? 'unknown-source'} ${source.sourceName ?? source.sourceId}`;
  return `unchecked ${label}: reason=${source.uncheckedReason ?? 'unknown'}, facts=${source.factCount}`;
}

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

export function printDoctorReport(report: DoctorReport): void {
  printHeader('Doctor');
  process.stdout.write(`version: ${report.version}\n`);
  process.stdout.write(`workspace: ${report.workspaceRoot}\n`);
  process.stdout.write(`node: ${report.node.current}${report.node.required ? ` (required ${report.node.required})` : ''}\n`);
  process.stdout.write(`planner provider catalog: ${report.plannerProviderCatalog.command} (read-only, live check disabled)\n`);
  process.stdout.write(`status: ${report.summary.status} (${report.summary.passCount} pass, ${report.summary.warnCount} warn, ${report.summary.failCount} fail)\n\n`);

  printHeader('Checks');
  printList(
    report.checks.map(check => `${check.status} ${check.name}: ${check.message}${check.detail ? ` (${check.detail})` : ''}`),
    'No doctor checks recorded.'
  );
}

export function printPlannerProviderCatalogReport(report: PlannerProviderCatalogReport): void {
  printHeader('Planner Providers');
  process.stdout.write(`scope: ${report.scope.plannerOnly ? 'planner-only' : 'unknown'}\n`);
  process.stdout.write(`live provider check: ${report.liveProviderCheck ? 'enabled' : 'disabled'}\n`);
  process.stdout.write(`mutation allowed: ${report.mutationAllowed ? 'true' : 'false'}\n`);
  process.stdout.write(`supported providers: ${report.summary.supportedProviderCount}/${report.summary.providerCount}\n\n`);

  printList(
    report.providers.map(provider => {
      const streaming = provider.capabilities.supportsStreaming ? 'supported' : 'disabled';
      const flags = [
        ...provider.cliFlags.provider,
        provider.cliFlags.model.join(' or '),
        provider.cliFlags.baseUrl.join(' or ')
      ].join(', ');
      const env = [
        provider.apiKeyEnv.join(' or '),
        provider.configEnv.model,
        provider.configEnv.baseUrl.join(' or ')
      ].join('; ');

      return [
        `${provider.id}: transport=${provider.capabilities.transport}, endpoint=${provider.capabilities.endpointPath}, response=${provider.capabilities.responseFormat}, streaming=${streaming}`,
        `  commands: ${report.commands.join(', ')}`,
        `  defaults: model=${provider.defaults.model}, baseUrl=${provider.defaults.baseUrl}`,
        `  flags: ${flags}`,
        `  env: ${env}`
      ].join('\n');
    }),
    'No planner providers are registered.'
  );
}

function domainLabelToId(label: string): string {
  return label.trim().toLowerCase();
}

function validationKindToId(kind: ValidationPlanEntry['kind']): string {
  return kind.trim().toLowerCase();
}

export function summarizeFocusedDomainCapabilities(
  domains: DomainCapabilitySummary[],
  requestedDomains: string[]
): string[] {
  const prioritizedDomains = [...domains].sort((left, right) => {
    const leftRank = requestedDomains.indexOf(domainLabelToId(left.label));
    const rightRank = requestedDomains.indexOf(domainLabelToId(right.label));
    const normalizedLeftRank = leftRank === -1 ? Number.MAX_SAFE_INTEGER : leftRank;
    const normalizedRightRank = rightRank === -1 ? Number.MAX_SAFE_INTEGER : rightRank;

    return normalizedLeftRank - normalizedRightRank || left.label.localeCompare(right.label);
  });

  return prioritizedDomains.map(domain => {
    const isPrimary = requestedDomains.length > 0 && requestedDomains.includes(domainLabelToId(domain.label));
    return `${formatDomainCapability(domain)}${isPrimary ? ' [requested]' : ''}`;
  });
}

export function summarizeFocusedValidationPlan(
  plan: ValidationPlanEntry[],
  requestedDomains: string[]
): string[] {
  const prioritizedEntries = [...plan].sort((left, right) => {
    const leftRank = requestedDomains.indexOf(validationKindToId(left.kind));
    const rightRank = requestedDomains.indexOf(validationKindToId(right.kind));
    const normalizedLeftRank = leftRank === -1 ? Number.MAX_SAFE_INTEGER : leftRank;
    const normalizedRightRank = rightRank === -1 ? Number.MAX_SAFE_INTEGER : rightRank;

    return normalizedLeftRank - normalizedRightRank
      || left.target.localeCompare(right.target)
      || left.kind.localeCompare(right.kind);
  });

  return prioritizedEntries.flatMap(entry =>
    entry.commands.map(command => `${entry.kind} ${entry.target}: ${command}${requestedDomains.includes(validationKindToId(entry.kind)) ? ' [requested]' : ''}`)
  );
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

  for (const result of getTargetValidationResults(state)) {
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

function isYamlSyntaxValidationCommand(command: string): boolean {
  return command.startsWith('infra-agent yaml-parse ');
}

function getTargetValidationResults(state: AgentRunState): ValidationCommandOutput[] {
  return state.runtime.validationResults.filter(result => !isYamlSyntaxValidationCommand(result.command));
}

function summarizeValidationStatus(state: AgentRunState): string {
  const targetValidationResults = getTargetValidationResults(state);
  const hasValidationFailures = state.runtime.validationResults.some(result => result.exitCode !== 0);
  const yamlGuardResults = state.runtime.validationResults.filter(result => isYamlSyntaxValidationCommand(result.command));

  if (hasValidationFailures) {
    return 'failed';
  }

  if (targetValidationResults.length > 0) {
    return 'passed';
  }

  if (yamlGuardResults.length > 0) {
    return 'YAML syntax guard passed; target validation not run yet';
  }

  return 'not run yet';
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

  if (topIssue?.kind === 'pulumi-create-before-delete-conflict' || topIssue?.kind === 'terraform-create-before-delete-conflict') {
    const engine = topIssue.kind === 'terraform-create-before-delete-conflict' ? 'Terraform' : 'Pulumi';
    const routeTables = topIssue.metadata?.routeTableIds;
    const destinations = topIssue.metadata?.routeDestinations;
    if (routeTables || destinations) {
      return `${engine} create-before-delete conflict: AWS route already exists${routeTables ? ` in ${routeTables}` : ''}${destinations ? ` for ${destinations}` : ''}.`;
    }

    const identity = topIssue.metadata?.dnsNames
      || topIssue.metadata?.kubernetesNames
      || topIssue.metadata?.kubernetesNamespaces
      || topIssue.metadata?.oidcProviderUrls
      || topIssue.metadata?.listenerRulePriorities
      || topIssue.metadata?.listenerArns
      || topIssue.metadata?.securityGroupRulePeers
      || topIssue.metadata?.securityGroupIds
      || topIssue.metadata?.duplicateIdentity;
    const conflictCode = topIssue.metadata?.conflictCode;
    return `${engine} create-before-delete conflict: provider returned ${conflictCode ?? 'an exclusive identity error'}${identity ? ` for ${identity}` : ''}.`;
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

  if (topIssue?.kind === 'yaml-syntax-failure') {
    return topIssue.metadata?.yamlPath
      ? `YAML syntax validation failed for ${topIssue.metadata.yamlPath}`
      : 'YAML syntax validation failed for a planned file write.';
  }

  return 'none';
}

function summarizeValidationBlockers(state: AgentRunState): string {
  const summary = collectValidationIssueSummary(state);
  if (summary.totalCount === 0) {
    return 'none';
  }

  const topGroup = summary.groups[0];
  const topSummary = topGroup ? `; top ${topGroup.kind} x${topGroup.count}` : '';
  const omittedSummary = summary.omittedIssueCount > 0 || summary.omittedGroupCount > 0
    ? `; omitted issues=${summary.omittedIssueCount}, groups=${summary.omittedGroupCount}`
    : '';

  return `${summary.totalCount} issue(s); ${summary.repairableCount} repairable, ${summary.nonRepairableCount} non-repairable${topSummary}${omittedSummary}`;
}

function summarizeWorkPlan(state: AgentRunState): string {
  const workPlan = collectWorkPlan(state);
  const currentStep = workPlan.currentStepIndex === null
    ? null
    : workPlan.steps.find(step => step.index === workPlan.currentStepIndex) ?? null;
  const current = currentStep
    ? `current ${currentStep.kind}/${currentStep.status}`
    : 'no active step';

  return `${workPlan.status}; ${current}; completed ${workPlan.completedStepCount}/${workPlan.totalStepCount}; blocked ${workPlan.blockedStepCount}; skipped ${workPlan.skippedStepCount}; next ${workPlan.nextControlAction}`;
}

function collectValidationDerivedSemanticBlockers(state: AgentRunState): ValidationDerivedSemanticBlocker[] {
  return getRuntimeConfigSemantics(state.runtime)
    .flatMap(summary => summary.facts.map(fact => ({
      targetKind: summary.targetKind,
      targetPath: summary.targetPath,
      fact
    })))
    .filter(item =>
      item.fact.source.kind === 'pulumi-preview'
      && item.fact.kind === 'required-field'
    )
    .map(item => ({
      targetKind: item.targetKind,
      targetPath: item.targetPath,
      path: item.fact.path,
      sourceKind: item.fact.source.kind,
      confidence: item.fact.confidence,
      message: item.fact.message
    }));
}

function isTerminalTurnAction(kind: string): boolean {
  return kind === 'stop' || kind === 'ask-for-clarification';
}

const COMPACT_TOOL_TRACE_LIMIT = 8;
const COMPACT_TURN_TRACE_LIMIT = 10;
const COMPACT_LIFECYCLE_EVENT_LIMIT = 12;
const COMPACT_IDENTITY_CONFLICT_LIMIT = 5;
const COMPACT_VALIDATION_COMMAND_LIMIT = 8;
const COMPACT_VALIDATION_ISSUE_DETAIL_LIMIT = 5;
const COMPACT_VALIDATION_ISSUE_GROUP_LIMIT = 8;
const COMPACT_VALIDATION_SAFETY_BLOCKER_LIMIT = 5;
const COMPACT_APPROVAL_SIGNAL_LIMIT = 5;
const COMPACT_WORK_PLAN_STEP_LIMIT = 6;
const COMPACT_TARGET_CANDIDATE_LIMIT = 5;
const COMPACT_TARGET_REASON_LIMIT = 3;
const COMPACT_TARGET_DETAIL_LIMIT = 3;
const COMPACT_VALIDATION_OUTPUT_PREVIEW_CHARS = 300;

function collectCompactTurnTrace(state: AgentRunState): CompactTurnTraceEntry[] {
  return state.turns.slice(0, COMPACT_TURN_TRACE_LIMIT).map(turn => ({
    index: turn.index,
    actionKind: turn.decision.action.kind,
    actionFamily: turn.decision.action.payload?.actionFamily ?? null,
    confidence: turn.decision.confidence,
    summary: turn.decision.action.summary,
    terminal: isTerminalTurnAction(turn.decision.action.kind),
    executionStatus: turn.execution?.status ?? null,
    executionReason: turn.execution?.reason ?? null,
    executedToolCount: turn.execution?.executedTools.length ?? 0,
    stopReason: turn.decision.action.payload?.stopReason ?? null,
    clarificationKind: turn.decision.action.payload?.clarificationKind ?? null,
    changedFileCount: turn.runtimeSnapshot.appliedWrites.length,
    validationIssueCount: turn.runtimeSnapshot.validationIssues.length,
    approvalSignalCount: turn.runtimeSnapshot.approvalSignals.length
  }));
}

function collectTurnTraceBudget(
  state: AgentRunState,
  turnTrace: CompactTurnTraceEntry[]
): CompactAgentRunResult['harness']['turnTraceBudget'] {
  return {
    maxEntries: COMPACT_TURN_TRACE_LIMIT,
    totalCount: state.turns.length,
    includedCount: turnTrace.length,
    omittedCount: Math.max(0, state.turns.length - turnTrace.length),
    firstIncludedTurnIndex: turnTrace[0]?.index ?? null,
    lastIncludedTurnIndex: turnTrace[turnTrace.length - 1]?.index ?? null,
    preservedWindow: 'head'
  };
}

function compactLifecycleEvent(
  event: CompactLifecycleEvent['event'],
  turn: AgentRunState['turns'][number] | null,
  state: AgentRunState,
  outcome: AgentRunState['outcome'] | null = null
): CompactLifecycleEvent {
  return {
    event,
    turnIndex: turn?.index ?? null,
    actionKind: turn?.decision.action.kind ?? null,
    actionFamily: turn?.decision.action.payload?.actionFamily ?? null,
    executionStatus: turn?.execution?.status ?? null,
    reason: turn?.execution?.reason ?? (outcome ? `outcome:${outcome}` : null),
    toolCount: turn?.execution?.executedTools.length ?? 0,
    approvalSignalCount: turn?.runtimeSnapshot.approvalSignals.length ?? state.runtime.approvalSignals.length,
    validationIssueCount: turn?.runtimeSnapshot.validationIssues.length ?? state.runtime.validationIssues.length,
    outcome
  };
}

function collectCompactLifecycleEvents(state: AgentRunState): CompactAgentRunResult['harness']['lifecycleEvents'] {
  const events: CompactLifecycleEvent[] = [
    compactLifecycleEvent('query-started', null, state)
  ];
  const eventCounts: Record<CompactLifecycleEvent['event'], number> = {
    'query-started': 0,
    decision: 0,
    'tool-execution': 0,
    'approval-gate': 0,
    terminal: 0
  };

  for (const turn of state.turns) {
    events.push(compactLifecycleEvent('decision', turn, state));

    if ((turn.execution?.executedTools.length ?? 0) > 0) {
      events.push(compactLifecycleEvent('tool-execution', turn, state));
    }

    if (
      turn.runtimeSnapshot.approvalSignals.length > 0
      || /approval/i.test(turn.execution?.reason ?? '')
    ) {
      events.push(compactLifecycleEvent('approval-gate', turn, state));
    }
  }

  events.push(compactLifecycleEvent('terminal', state.turns[state.turns.length - 1] ?? null, state, state.outcome));

  for (const event of events) {
    eventCounts[event.event] += 1;
  }

  const entries = events.length <= COMPACT_LIFECYCLE_EVENT_LIMIT
    ? events
    : [events[0], ...events.slice(-(COMPACT_LIFECYCLE_EVENT_LIMIT - 1))];

  return {
    maxEntries: COMPACT_LIFECYCLE_EVENT_LIMIT,
    totalCount: events.length,
    includedCount: entries.length,
    omittedCount: Math.max(0, events.length - entries.length),
    eventCounts,
    events: entries
  };
}

function getAgentMaxTurns(state: AgentRunState): number {
  return (state as AgentRunState & { config?: { maxTurns?: number } }).config?.maxTurns ?? state.turns.length;
}

function collectLoopBudget(state: AgentRunState): CompactAgentRunResult['harness']['loopBudget'] {
  const maxTurns = getAgentMaxTurns(state);
  const turnsUsed = state.turns.length;
  return {
    turnsUsed,
    maxTurns,
    turnsRemaining: Math.max(0, maxTurns - turnsUsed),
    exhausted: turnsUsed >= maxTurns && state.outcome === 'no-safe-action'
  };
}

function collectRepairBudget(state: AgentRunState): CompactAgentRunResult['harness']['repairBudget'] {
  const attemptsUsed = state.runtime.repairAttempts;
  const maxAttempts = getAgentMaxRepairAttempts(state);
  return {
    attemptsUsed,
    maxAttempts,
    attemptsRemaining: Math.max(0, maxAttempts - attemptsUsed),
    exhausted: state.outcome === 'repair-budget-exhausted' || attemptsUsed >= maxAttempts
  };
}

function collectRuntimeStateSummary(state: AgentRunState): CompactAgentRunResult['harness']['stateSummary'] {
  return {
    observationCount: state.runtime.observations?.length ?? 0,
    toolSummaryCount: state.runtime.toolSummaries?.length ?? 0,
    appliedWriteCount: state.runtime.appliedWrites?.length ?? 0,
    validationResultCount: state.runtime.validationResults?.length ?? 0,
    validationIssueCount: state.runtime.validationIssues?.length ?? 0,
    approvalSignalCount: state.runtime.approvalSignals?.length ?? 0,
    retrievedContextCount: state.runtime.retrievedContext?.length ?? 0,
    knowledgeFactCount: state.runtime.knowledgeFacts?.factCount ?? 0,
    knowledgeUnitCount: state.runtime.knowledgeFacts?.unitCount ?? state.runtime.knowledgeFacts?.factCount ?? 0,
    semanticFactCount: getRuntimeConfigSemantics(state.runtime).reduce((count, summary) => count + summary.facts.length, 0)
  };
}

function collectKnowledgeFactsSummary(state: AgentRunState): KnowledgeFactBudgetSummary {
  const queryConfig = getAgentQueryConfig(state);
  return budgetKnowledgePackFacts(state.runtime.knowledgeFacts ?? null, {
    maxFacts: queryConfig.retrievedContextBudget.maxFacts
  });
}

function domainForTargetCandidate(kind: TargetCandidate['kind']): InfraDomainId {
  switch (kind) {
    case 'helm-chart':
      return 'helm';
    case 'pulumi-project':
      return 'pulumi';
    case 'terraform-root':
      return 'terraform';
  }
}

function collectCompactTargeting(state: AgentRunState): CompactTargetingSummary {
  const primaryTarget = getPrimaryTargetCandidateFromAgent(state);
  const selectedRank = primaryTarget
    ? state.preflight.targetCandidates.findIndex(candidate => candidate.path === primaryTarget.path) + 1
    : 0;
  const topCandidate = state.preflight.targetCandidates[0] ?? null;
  const nextCandidate = state.preflight.targetCandidates[1] ?? null;
  const topScore = topCandidate?.score ?? null;
  const flags = {
    missingEnvironment: state.preflight.requestedEnvironment === null,
    missingService: state.preflight.requestedService === null,
    noCandidates: state.preflight.targetCandidates.length === 0,
    weakTopScore: topScore !== null && topScore <= 0,
    tiedTopScore: topScore !== null && topScore > 0 && nextCandidate?.score === topScore
  };
  const ambiguityKinds: CompactTargetingAmbiguityKind[] = [
    flags.missingEnvironment ? 'missing-environment' : null,
    flags.missingService ? 'missing-service' : null,
    flags.noCandidates ? 'no-candidates' : null,
    flags.weakTopScore ? 'weak-match' : null,
    flags.tiedTopScore ? 'tied-top-score' : null
  ].filter((kind): kind is CompactTargetingAmbiguityKind => kind !== null);
  const includedCandidates = state.preflight.targetCandidates
    .slice(0, COMPACT_TARGET_CANDIDATE_LIMIT)
    .map((candidate, index) => ({
      rank: index + 1,
      selected: primaryTarget?.path === candidate.path,
      kind: candidate.kind,
      domain: domainForTargetCandidate(candidate.kind),
      name: candidate.name,
      path: candidate.path,
      score: candidate.score,
      reasonCount: candidate.reasons.length,
      reasons: candidate.reasons.slice(0, COMPACT_TARGET_REASON_LIMIT),
      matchedEnvironmentHints: [...candidate.matchedEnvironmentHints],
      detailCount: candidate.details?.length ?? 0,
      details: (candidate.details ?? []).slice(0, COMPACT_TARGET_DETAIL_LIMIT)
    }));
  const recommendedAction: CompactTargetingRecommendedAction = flags.noCandidates || flags.weakTopScore || flags.tiedTopScore
    ? 'clarify-target'
    : ambiguityKinds.length > 0
      ? 'review-targeting'
      : 'inspect-selected-target';

  return {
    schemaVersion: 1,
    source: 'derived-run-preflight',
    compact: true,
    mutationAllowed: false,
    selectedTarget: primaryTarget
      ? {
          rank: selectedRank,
          kind: primaryTarget.kind,
          domain: domainForTargetCandidate(primaryTarget.kind),
          name: primaryTarget.name,
          path: primaryTarget.path,
          score: primaryTarget.score
        }
      : null,
    candidateCount: state.preflight.targetCandidates.length,
    topScore,
    scoreGapToNext: topCandidate && nextCandidate ? topCandidate.score - nextCandidate.score : null,
    maxCandidates: COMPACT_TARGET_CANDIDATE_LIMIT,
    includedCount: includedCandidates.length,
    omittedCount: Math.max(0, state.preflight.targetCandidates.length - includedCandidates.length),
    ambiguityKinds,
    recommendedAction,
    flags,
    candidates: includedCandidates
  };
}

function collectPlannerHandoff(state: AgentRunState): CompactAgentRunResult['harness']['plannerHandoff'] {
  const lastTurn = state.turns[state.turns.length - 1];
  const loopBudget = collectLoopBudget(state);
  const activeBlockerKind = (() => {
    switch (state.outcome) {
      case 'completed':
        return 'none';
      case 'approval-required':
        return 'approval';
      case 'clarification-required':
        return 'clarification';
      case 'validation-blocked':
        return 'validation';
      case 'repair-budget-exhausted':
        return 'repair-budget';
      case 'no-safe-action':
        return loopBudget.exhausted ? 'turn-budget' : 'no-safe-action';
    }
  })();
  const nextControlAction = (() => {
    switch (state.outcome) {
      case 'completed':
        return 'review-result';
      case 'approval-required':
        return 'request-approval';
      case 'clarification-required':
        return 'answer-clarification';
      case 'validation-blocked':
        return 'resolve-validation';
      case 'repair-budget-exhausted':
        return 'manual-repair';
      case 'no-safe-action':
        return loopBudget.exhausted ? 'rerun-with-larger-turn-budget' : 'inspect-readiness-or-targeting';
    }
  })();

  return {
    lastAction: {
      kind: lastTurn?.decision.action.kind ?? null,
      family: lastTurn?.decision.action.payload?.actionFamily ?? null,
      stopReason: lastTurn?.decision.action.payload?.stopReason ?? null,
      clarificationKind: lastTurn?.decision.action.payload?.clarificationKind ?? null,
      executionStatus: lastTurn?.execution?.status ?? null
    },
    activeBlocker: {
      kind: activeBlockerKind,
      validationIssueKind: activeBlockerKind === 'validation' ? state.runtime.validationIssues[0]?.kind ?? null : null,
      approvalSignalKind: activeBlockerKind === 'approval' ? state.runtime.approvalSignals[0]?.kind ?? null : null
    },
    nextControlAction
  };
}

function latestActionKindForStep(state: AgentRunState, stepKind: CompactWorkPlanStepKind): AgentActionKind | null {
  const actionKindsByStep: Partial<Record<CompactWorkPlanStepKind, AgentActionKind[]>> = {
    inspection: ['inspect-target-files'],
    edit: ['apply-edit-plan'],
    validation: ['validate-targets', 'repair-terraform-formatting'],
    handoff: ['ask-for-clarification', 'stop']
  };
  const actionKinds = actionKindsByStep[stepKind] ?? [];
  const matchingTurn = [...state.turns].reverse().find(turn => actionKinds.includes(turn.decision.action.kind));
  return matchingTurn?.decision.action.kind ?? null;
}

function compactWorkPlanStatus(
  state: AgentRunState,
  blockerKind: CompactAgentRunResult['harness']['plannerHandoff']['activeBlocker']['kind']
): CompactWorkPlanStatus {
  const hasProgress = state.turns.length > 0
    || (state.runtime.toolSummaries?.length ?? 0) > 0
    || (state.runtime.appliedWrites?.length ?? 0) > 0
    || (state.runtime.validationResults?.length ?? 0) > 0
    || (state.runtime.approvalSignals?.length ?? 0) > 0;

  if (state.outcome === 'completed') {
    return 'completed';
  }

  if (blockerKind !== 'none') {
    return 'blocked';
  }

  if (!hasProgress) {
    return 'not-started';
  }

  return 'in-progress';
}

function buildWorkPlanStep(params: Omit<CompactWorkPlanStep, 'validationIssueKind' | 'approvalSignalKind'> & {
  validationIssueKind?: ValidationIssue['kind'] | null;
  approvalSignalKind?: ApprovalSignal['kind'] | null;
}): CompactWorkPlanStep {
  return {
    ...params,
    validationIssueKind: params.validationIssueKind ?? null,
    approvalSignalKind: params.approvalSignalKind ?? null
  };
}

function collectWorkPlan(state: AgentRunState): CompactWorkPlan {
  const plannerHandoff = collectPlannerHandoff(state);
  const readiness = collectCompactReadiness(state);
  const validationStatus = summarizeValidationStatus(state);
  const primaryTarget = getPrimaryTargetCandidateFromAgent(state);
  const toolSummaries = state.runtime.toolSummaries ?? [];
  const appliedWrites = state.runtime.appliedWrites ?? [];
  const validationResults = state.runtime.validationResults ?? [];
  const validationIssues = state.runtime.validationIssues ?? [];
  const approvalSignals = state.runtime.approvalSignals ?? [];
  const isCompleted = state.outcome === 'completed';
  const hasInspection = toolSummaries.some(summary => summary.actionKind === 'inspect-target-files');
  const hasWrites = appliedWrites.length > 0;
  const hasValidation = validationResults.length > 0;
  const hasValidationBlocker = plannerHandoff.activeBlocker.kind === 'validation'
    || plannerHandoff.activeBlocker.kind === 'repair-budget';
  const hasTurnBudgetBlocker = plannerHandoff.activeBlocker.kind === 'turn-budget';
  const hasApprovalBlocker = plannerHandoff.activeBlocker.kind === 'approval';
  const firstValidationIssueKind = validationIssues[0]?.kind ?? null;
  const firstApprovalSignalKind = approvalSignals[0]?.kind ?? null;

  const steps: CompactWorkPlanStep[] = [
    buildWorkPlanStep({
      index: 0,
      kind: 'readiness',
      status: readiness.status === 'fail' ? 'blocked' : 'completed',
      title: 'Readiness',
      summary: `Readiness ${readiness.status}: ${readiness.passCount} pass, ${readiness.warnCount} warn, ${readiness.failCount} fail.`,
      actionKind: null
    }),
    buildWorkPlanStep({
      index: 1,
      kind: 'targeting',
      status: primaryTarget
        ? 'completed'
        : isCompleted
          ? 'skipped'
          : plannerHandoff.activeBlocker.kind === 'clarification'
            ? 'blocked'
            : 'pending',
      title: 'Targeting',
      summary: primaryTarget
        ? `${primaryTarget.kind} ${primaryTarget.path} selected for ${formatRequestedDomains(state.preflight.requestedDomains)}.`
        : `No primary target selected for ${formatRequestedDomains(state.preflight.requestedDomains)}.`,
      actionKind: null
    }),
    buildWorkPlanStep({
      index: 2,
      kind: 'inspection',
      status: hasInspection
        ? 'completed'
        : isCompleted
          ? 'skipped'
          : state.turns.length > 0
            ? 'in-progress'
            : 'pending',
      title: 'Inspection',
      summary: hasInspection
        ? `Recorded ${toolSummaries.filter(summary => summary.actionKind === 'inspect-target-files').length} inspection tool summary item(s).`
        : 'Target file inspection has not produced a tool summary yet.',
      actionKind: latestActionKindForStep(state, 'inspection')
    }),
    buildWorkPlanStep({
      index: 3,
      kind: 'edit',
      status: isCompleted
        ? hasWrites ? 'completed' : 'skipped'
        : hasApprovalBlocker
          ? 'blocked'
          : hasWrites
            ? 'completed'
            : hasInspection
              ? 'in-progress'
              : 'pending',
      title: 'Bounded edit',
      summary: hasWrites
        ? `Applied ${appliedWrites.length} bounded write(s).`
        : hasApprovalBlocker
          ? 'A workspace mutation is waiting for explicit approval.'
          : 'No bounded write has been applied yet.',
      actionKind: latestActionKindForStep(state, 'edit'),
      approvalSignalKind: hasApprovalBlocker ? firstApprovalSignalKind : null
    }),
    buildWorkPlanStep({
      index: 4,
      kind: 'validation',
      status: isCompleted
        ? validationStatus === 'passed' ? 'completed' : 'skipped'
        : validationStatus === 'passed'
        ? 'completed'
        : hasValidationBlocker
          ? 'blocked'
          : hasValidation
            ? 'in-progress'
            : 'pending',
      title: 'Validation',
      summary: `Validation ${validationStatus}; ${validationIssues.length} issue(s) currently recorded.`,
      actionKind: latestActionKindForStep(state, 'validation'),
      validationIssueKind: hasValidationBlocker ? firstValidationIssueKind : null
    }),
    buildWorkPlanStep({
      index: 5,
      kind: 'handoff',
      status: isCompleted
        ? 'completed'
        : plannerHandoff.activeBlocker.kind !== 'none' || hasTurnBudgetBlocker
          ? 'blocked'
          : state.turns.length > 0
            ? 'in-progress'
            : 'pending',
      title: 'Handoff',
      summary: `Next control action: ${plannerHandoff.nextControlAction}.`,
      actionKind: latestActionKindForStep(state, 'handoff')
    })
  ];
  const includedSteps = steps.slice(0, COMPACT_WORK_PLAN_STEP_LIMIT);
  const currentStep = includedSteps.find(step => step.status === 'blocked')
    ?? includedSteps.find(step => step.status === 'in-progress')
    ?? null;

  return {
    schemaVersion: 1,
    source: 'derived-agent-run-state',
    compact: true,
    mutationAllowed: false,
    status: compactWorkPlanStatus(state, plannerHandoff.activeBlocker.kind),
    blockerKind: plannerHandoff.activeBlocker.kind,
    nextControlAction: plannerHandoff.nextControlAction,
    currentStepIndex: currentStep?.index ?? null,
    totalStepCount: steps.length,
    completedStepCount: steps.filter(step => step.status === 'completed').length,
    pendingStepCount: steps.filter(step => step.status === 'pending').length,
    blockedStepCount: steps.filter(step => step.status === 'blocked').length,
    skippedStepCount: steps.filter(step => step.status === 'skipped').length,
    maxEntries: COMPACT_WORK_PLAN_STEP_LIMIT,
    includedCount: includedSteps.length,
    omittedCount: Math.max(0, steps.length - includedSteps.length),
    steps: includedSteps
  };
}

function getAgentMaxRepairAttempts(state: AgentRunState): number {
  return (state as AgentRunState & { config?: { maxRepairAttempts?: number } }).config?.maxRepairAttempts
    ?? state.runtime.maxRepairAttempts
    ?? DEFAULT_QUERY_LOOP_CONFIG.maxRepairAttempts;
}

function getAgentQueryConfig(state: AgentRunState): AgentRunState['config'] {
  const config = (state as AgentRunState & { config?: AgentRunState['config'] }).config;
  if (config) {
    return config;
  }

  return {
    maxTurns: getAgentMaxTurns(state),
    maxRepairAttempts: getAgentMaxRepairAttempts(state),
    retrievedContextBudget: state.runtime.retrievedContextBudget ?? DEFAULT_QUERY_LOOP_CONFIG.retrievedContextBudget
  };
}

function collectPlannerConfig(state: AgentRunState): CompactAgentRunResult['harness']['plannerConfig'] {
  const plannerConfig = state.plannerConfig;
  if (!plannerConfig || plannerConfig.clientName !== state.modelName) {
    return {
      requestedMode: 'auto',
      effectiveMode: state.modelName.startsWith('llm-model-client:') ? 'llm' : 'rule-based',
      clientName: state.modelName,
      fallbackReason: state.modelName === 'rule-based-fallback' ? 'No LLM API key is configured.' : null,
      llm: state.modelName.startsWith('llm-model-client:')
        ? {
            provider: 'openai-compatible',
            model: state.modelName.replace(/^llm-model-client:/, ''),
            baseUrl: 'https://api.openai.com/v1',
            apiKeyConfigured: true,
            apiKeySource: 'unknown',
            providerSource: 'default',
            modelSource: 'unknown',
            baseUrlSource: 'default',
            capabilities: {
              transport: 'chat-completions',
              endpointPath: '/chat/completions',
              responseFormat: 'json-object',
              supportsJsonObject: true,
              supportsStreaming: false
            }
          }
        : null
    };
  }

  const fallbackCapabilities = {
    transport: 'chat-completions',
    endpointPath: '/chat/completions',
    responseFormat: 'json-object',
    supportsJsonObject: true,
    supportsStreaming: false
  };

  return {
    requestedMode: plannerConfig.requestedMode,
    effectiveMode: plannerConfig.effectiveMode,
    clientName: plannerConfig.clientName,
    fallbackReason: plannerConfig.fallbackReason,
    llm: plannerConfig.llm
      ? {
          provider: plannerConfig.llm.provider,
          model: plannerConfig.llm.model,
          baseUrl: plannerConfig.llm.baseUrl,
          apiKeyConfigured: true,
          apiKeySource: plannerConfig.llm.apiKeySource,
          providerSource: plannerConfig.llm.providerSource,
          modelSource: plannerConfig.llm.modelSource,
          baseUrlSource: plannerConfig.llm.baseUrlSource,
          capabilities: plannerConfig.llm.capabilities ?? fallbackCapabilities
        }
      : null
  };
}

function getToolPermissionSummary(summary: {
  toolName: string;
  safety: ToolSafety;
  permission?: ToolPermissionSummary;
}): ToolPermissionSummary {
  return summary.permission ?? classifyToolPermission(summary.toolName, summary.safety);
}

function collectCompactToolTrace(state: AgentRunState): CompactAgentRunResult['harness']['toolTrace'] {
  const summaries = state.runtime.toolSummaries ?? [];
  const permissionCategoryCounts: Partial<Record<ToolPermissionCategory, number>> = {};
  const entries = summaries.slice(-COMPACT_TOOL_TRACE_LIMIT).map(summary => {
    const permission = getToolPermissionSummary(summary);
    return {
      turnIndex: summary.turnIndex,
      actionKind: summary.actionKind,
      toolName: summary.toolName,
      safety: summary.safety,
      permissionCategory: permission.category,
      mutatesWorkspace: permission.mutatesWorkspace,
      mutatesExternalState: permission.mutatesExternalState,
      externalCommand: permission.externalCommand,
      approvalRequired: permission.approvalRequired,
      summary: summary.summary
    };
  });

  for (const summary of summaries) {
    const permission = getToolPermissionSummary(summary);
    permissionCategoryCounts[permission.category] = (permissionCategoryCounts[permission.category] ?? 0) + 1;
  }

  return {
    maxEntries: COMPACT_TOOL_TRACE_LIMIT,
    totalCount: summaries.length,
    includedCount: entries.length,
    omittedCount: Math.max(0, summaries.length - entries.length),
    firstIncludedTurnIndex: entries[0]?.turnIndex ?? null,
    lastIncludedTurnIndex: entries[entries.length - 1]?.turnIndex ?? null,
    preservedWindow: 'tail',
    latestTurnIndex: summaries[summaries.length - 1]?.turnIndex ?? null,
    permissionCategoryCounts,
    entries
  };
}

function collectToolPermissionAggregate(state: AgentRunState): ToolPermissionAggregate {
  return aggregateToolPermissions(
    (state.runtime.toolSummaries ?? []).map(summary => getToolPermissionSummary(summary))
  );
}

function collectSelectedValidationPlan(state: AgentRunState): CompactAgentRunResult['validation']['selectedPlan'] {
  const validatorsByName = new Map(state.preflight.validation.validators.map(validator => [validator.name, validator]));
  const validationResultsByCommand = new Map(state.runtime.validationResults.map(result => [result.command, result]));

  return selectValidationPlanEntries(state.runtime).map(entry => {
    const executedResults = entry.commands
      .map(command => validationResultsByCommand.get(command))
      .filter((result): result is ValidationCommandOutput => Boolean(result));

    return {
      kind: entry.kind,
      target: entry.target,
      commandCount: entry.commands.length,
      commands: [...entry.commands],
      executedCommandCount: executedResults.length,
      failedCommandCount: executedResults.filter(result => result.exitCode !== 0).length,
      validatorAvailable: validatorsByName.get(entry.kind)?.available ?? false
    };
  });
}

function compactOutputPreview(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= COMPACT_VALIDATION_OUTPUT_PREVIEW_CHARS) {
    return trimmed;
  }

  return `${trimmed.slice(0, COMPACT_VALIDATION_OUTPUT_PREVIEW_CHARS)}...`;
}

function summarizeUnsafeValidationCommand(result: ValidationCommandOutput): {
  unsafeBlocked: boolean;
  unsafeRuleId: string | null;
  unsafeReason: string | null;
} {
  const classified = classifyUnsafeValidationCommand(result.command);
  if (classified) {
    return {
      unsafeBlocked: true,
      unsafeRuleId: classified.matchedPattern,
      unsafeReason: classified.reason
    };
  }

  const output = `${result.stdout}\n${result.stderr}`;
  const blockedMatch = output.match(/infra-agent blocked unsafe validation command:\s*([^\n[]+?)(?:\s*\[([^\]\n]+)\])?(?:\n|$)/i);
  if (!blockedMatch) {
    return {
      unsafeBlocked: false,
      unsafeRuleId: null,
      unsafeReason: null
    };
  }

  return {
    unsafeBlocked: true,
    unsafeRuleId: blockedMatch[2]?.trim() || null,
    unsafeReason: blockedMatch[1]?.trim() || null
  };
}

function collectValidationCommandSummaries(state: AgentRunState): CompactAgentRunResult['validation']['commands'] {
  const entries = state.runtime.validationResults.slice(-COMPACT_VALIDATION_COMMAND_LIMIT).map(result => {
    const unsafe = summarizeUnsafeValidationCommand(result);
    return {
      command: result.command,
      exitCode: result.exitCode,
      status: result.exitCode === 0 ? 'passed' as const : 'failed' as const,
      kind: isYamlSyntaxValidationCommand(result.command) ? 'yaml-guard' as const : 'target-validation' as const,
      stdoutPreview: compactOutputPreview(result.stdout),
      stderrPreview: compactOutputPreview(result.stderr),
      unsafeBlocked: unsafe.unsafeBlocked,
      unsafeRuleId: unsafe.unsafeRuleId,
      unsafeReason: unsafe.unsafeReason
    };
  });

  return {
    maxEntries: COMPACT_VALIDATION_COMMAND_LIMIT,
    omittedCount: Math.max(0, state.runtime.validationResults.length - entries.length),
    entries
  };
}

function collectValidationIssueSummary(state: AgentRunState): CompactAgentRunResult['validation']['issueSummary'] {
  const issues = state.runtime.validationIssues;
  const repairableCount = issues.filter(issue => issue.repairable).length;
  const nonRepairableCount = issues.length - repairableCount;
  const groups = new Map<string, {
    kind: ValidationIssue['kind'];
    repairable: boolean;
    count: number;
    sourceCommands: Set<string>;
  }>();

  for (const issue of issues) {
    const groupKey = `${issue.kind}:${issue.repairable}`;
    const group = groups.get(groupKey);

    if (group) {
      group.count += 1;
      group.sourceCommands.add(issue.sourceCommand);
      continue;
    }

    groups.set(groupKey, {
      kind: issue.kind,
      repairable: issue.repairable,
      count: 1,
      sourceCommands: new Set([issue.sourceCommand])
    });
  }

  const orderedGroups = Array.from(groups.values())
    .sort((left, right) => (
      right.count - left.count
      || left.kind.localeCompare(right.kind)
      || Number(left.repairable) - Number(right.repairable)
    ));
  const entries = orderedGroups.slice(0, COMPACT_VALIDATION_ISSUE_GROUP_LIMIT).map(group => ({
    kind: group.kind,
    repairable: group.repairable,
    count: group.count,
    sourceCommandCount: group.sourceCommands.size,
    blocking: true
  }));

  return {
    totalCount: issues.length,
    omittedIssueCount: Math.max(0, issues.length - COMPACT_VALIDATION_ISSUE_DETAIL_LIMIT),
    repairableCount,
    nonRepairableCount,
    maxGroups: COMPACT_VALIDATION_ISSUE_GROUP_LIMIT,
    omittedGroupCount: Math.max(0, orderedGroups.length - entries.length),
    groups: entries,
    flags: {
      hasRepairableIssues: repairableCount > 0,
      hasNonRepairableIssues: nonRepairableCount > 0,
      hasUnsafeValidationCommand: issues.some(issue => issue.kind === 'unsafe-validation-command'),
      hasYamlSyntaxFailure: issues.some(issue => issue.kind === 'yaml-syntax-failure'),
      hasIdentityConflict: issues.some(issue =>
        issue.kind === 'terraform-create-before-delete-conflict'
        || issue.kind === 'pulumi-create-before-delete-conflict'
      )
    }
  };
}

function isValidationSafetyBlocker(issue: ValidationIssue): issue is ValidationIssue & {
  kind: 'unsafe-validation-command' | 'yaml-syntax-failure';
} {
  return issue.kind === 'unsafe-validation-command' || issue.kind === 'yaml-syntax-failure';
}

function compactValidationSafetyBlocker(issue: ValidationIssue & {
  kind: 'unsafe-validation-command' | 'yaml-syntax-failure';
}): CompactValidationSafetyBlocker {
  const unsafeCommand = issue.metadata?.unsafeCommand ?? (issue.kind === 'unsafe-validation-command' ? issue.sourceCommand : null);
  const unsafe = unsafeCommand ? classifyUnsafeValidationCommand(unsafeCommand) : null;

  return {
    kind: issue.kind,
    sourceCommand: issue.sourceCommand,
    message: issue.message,
    guidance: issue.guidance ?? null,
    repairable: issue.repairable,
    mutationPrevented: true,
    unsafeCommand,
    unsafeRuleId: unsafe?.matchedPattern ?? null,
    unsafeReason: unsafe?.reason ?? issue.metadata?.unsafeReason ?? null,
    yamlPath: issue.metadata?.yamlPath ?? null,
    yamlParser: issue.metadata?.yamlParser ?? null
  };
}

function collectValidationSafetyBlockers(state: AgentRunState): CompactAgentRunResult['validation']['safetyBlockers'] {
  const blockers = state.runtime.validationIssues.filter(isValidationSafetyBlocker);
  const entries = blockers
    .slice(0, COMPACT_VALIDATION_SAFETY_BLOCKER_LIMIT)
    .map(compactValidationSafetyBlocker);

  return {
    maxEntries: COMPACT_VALIDATION_SAFETY_BLOCKER_LIMIT,
    omittedCount: Math.max(0, blockers.length - entries.length),
    entries
  };
}

function compactApprovalSignal(signal: ApprovalSignal): CompactApprovalSignal {
  return {
    kind: signal.kind,
    message: signal.message,
    path: signal.kind === 'write-approval-required' ? signal.path : null,
    risk: signal.kind === 'write-approval-required' ? signal.risk : null,
    toolCategory: signal.kind === 'tool-category-approval-required' ? signal.toolCategory : null
  };
}

function summarizeReadinessChecks(checks: CompactReadinessCheck[]): Omit<CompactReadinessSummary, 'doctorCommand' | 'plannerProviderCatalog' | 'checks'> {
  const passCount = checks.filter(check => check.status === 'pass').length;
  const warnCount = checks.filter(check => check.status === 'warn').length;
  const failCount = checks.filter(check => check.status === 'fail').length;

  return {
    status: failCount > 0 ? 'fail' : warnCount > 0 ? 'warn' : 'pass',
    passCount,
    warnCount,
    failCount
  };
}

function summarizePlannerReadiness(modelName: string): CompactReadinessCheck {
  if (modelName.startsWith('llm-model-client:')) {
    return {
      name: 'planner',
      status: 'pass',
      message: 'LLM planner is active for this run.',
      detail: modelName.replace(/^llm-model-client:/, 'model=')
    };
  }

  if (modelName === 'rule-based-fallback') {
    return {
      name: 'planner',
      status: 'warn',
      message: 'Auto planner mode is using the rule-based fallback because no LLM planner is configured.',
      detail: modelName
    };
  }

  return {
    name: 'planner',
    status: 'pass',
    message: 'Rule-based planner is selected for this run.',
    detail: modelName
  };
}

function collectRequiredValidatorNames(state: AgentRunState): Set<string> {
  return new Set(selectValidationPlanEntries(state.runtime).map(entry => entry.kind));
}

function collectCompactReadiness(state: AgentRunState): CompactReadinessSummary {
  const selectedValidationPlan = selectValidationPlanEntries(state.runtime);
  const requiredValidators = collectRequiredValidatorNames(state);
  const checks: CompactReadinessCheck[] = [
    summarizePlannerReadiness(state.modelName),
    {
      name: 'workspace',
      status: state.preflight.blockers.length > 0 ? 'fail' : 'pass',
      message: state.preflight.blockers[0] ?? `Workspace inspection is ready with profile ${state.preflight.profile.id}.`,
      detail: state.preflight.profile.id
    },
    {
      name: 'validation-plan',
      status: selectedValidationPlan.length > 0 ? 'pass' : 'warn',
      message: selectedValidationPlan.length > 0
        ? `Validation plan has ${selectedValidationPlan.length} target group(s) for this task.`
        : 'No validation targets were selected for this task.',
      detail: selectedValidationPlan.map(entry => `${entry.kind}:${entry.target}`).join(', ') || null
    }
  ];

  for (const validator of state.preflight.validation.validators) {
    if (!requiredValidators.has(validator.name)) {
      continue;
    }

    checks.push({
      name: `validator:${validator.name}`,
      status: validator.available ? 'pass' : 'warn',
      message: validator.available
        ? `${validator.name} is available for the selected validation plan.`
        : `${validator.name} is missing for the selected validation plan.`,
      detail: validator.resolvedPath
    });
  }

  return {
    ...summarizeReadinessChecks(checks),
    doctorCommand: buildDoctorCommand(state),
    plannerProviderCatalog: buildPlannerProviderCatalogDiscovery(),
    checks
  };
}

function summarizeReadinessPosture(state: AgentRunState): string {
  const readiness = collectCompactReadiness(state);
  const attentionChecks = readiness.checks
    .filter(check => check.status !== 'pass')
    .map(check => check.name);
  const attention = attentionChecks.length > 0
    ? `; attention: ${attentionChecks.join(', ')}`
    : '';

  return `${readiness.status} (${readiness.passCount} pass, ${readiness.warnCount} warn, ${readiness.failCount} fail)${attention}`;
}

function prefixReadinessSuggestedCommands(state: AgentRunState, commands: string[]): string[] {
  const readiness = collectCompactReadiness(state);
  if (readiness.status === 'pass') {
    return commands;
  }

  return [
    readiness.doctorCommand,
    ...commands.filter(command => command !== readiness.doctorCommand)
  ];
}

function formatApprovalSignal(signal: ApprovalSignal): string {
  if (signal.kind === 'write-approval-required') {
    return `${signal.risk}-risk write at ${signal.path}`;
  }

  return `tool category ${signal.toolCategory}`;
}

function collectValidationIdentityConflicts(state: AgentRunState): ValidationIdentityConflictSummary[] {
  return collectRuntimeIdentityConflicts(state.runtime.validationIssues, COMPACT_IDENTITY_CONFLICT_LIMIT);
}

function collectValidationIdentityConflictSummary(
  state: AgentRunState,
  includedConflicts = collectValidationIdentityConflicts(state)
): ValidationIdentityConflictAggregateSummary {
  return summarizeRuntimeIdentityConflictAggregate(
    state.runtime.validationIssues,
    COMPACT_IDENTITY_CONFLICT_LIMIT,
    includedConflicts
  );
}

function sampleBudget(totalCount: number, includedCount: number): CompactHandoffBudgetSample {
  return {
    includedCount,
    omittedCount: Math.max(0, totalCount - includedCount)
  };
}

function summarizeIdentityConflictReview(state: AgentRunState): string {
  const [conflict] = collectValidationIdentityConflicts(state);
  if (!conflict) {
    return 'none';
  }

  const engineLabel = conflict.engine === 'terraform' ? 'Terraform' : 'Pulumi';
  const locator = conflict.engine === 'terraform' ? conflict.resourceAddress : conflict.resourceName;
  const locatorSummary = locator ? `locator ${locator}` : 'locator unavailable';
  const identity = formatIdentityConflictFields(conflict.identity);

  return `${engineLabel} ${locatorSummary}; identity ${identity}; classify logical rename vs real replacement before state, alias, import, or sequencing changes.`;
}

function summarizeIdentityConflictIncident(conflict: ValidationIdentityConflictSummary): string {
  const engineLabel = conflict.engine === 'terraform' ? 'Terraform' : 'Pulumi';
  const label = conflict.conflictLabel ?? conflict.conflictFamily ?? 'exclusive identity';
  const locator = identityConflictResourceLocator(conflict);
  const locatorSummary = locator ? ` at ${locator}` : '';
  const identity = formatIdentityConflictFields(conflict.identity);
  const riskCategory = normalizeIdentityConflictRiskCategory(conflict.riskCategory, conflict.conflictFamily);

  return `${engineLabel} ${label}${locatorSummary}: ${identity} [${riskCategory}].`;
}

function summarizeIdentityIncidentSample(
  incidents: IdentityConflictIncident[],
  sourceSummary: CompactAgentRunResult['validation']['identityConflictSummary'] | undefined
): ValidationIdentityConflictAggregateSummary {
  if (sourceSummary) {
    return {
      totalCount: sourceSummary.totalCount,
      includedCount: sourceSummary.includedCount,
      maxEntries: sourceSummary.maxEntries,
      omittedCount: sourceSummary.omittedCount,
      mutationAllowed: false,
      byEngine: {
        pulumi: sourceSummary.byEngine?.pulumi ?? 0,
        terraform: sourceSummary.byEngine?.terraform ?? 0
      },
      byRiskCategory: {
        'create-before-delete-ordering': sourceSummary.byRiskCategory?.['create-before-delete-ordering'] ?? 0,
        'dns-or-domain-ownership': sourceSummary.byRiskCategory?.['dns-or-domain-ownership'] ?? 0,
        'exclusive-identity-review': sourceSummary.byRiskCategory?.['exclusive-identity-review'] ?? 0,
        'kubernetes-object-ownership': sourceSummary.byRiskCategory?.['kubernetes-object-ownership'] ?? 0,
        'physical-name-ownership': sourceSummary.byRiskCategory?.['physical-name-ownership'] ?? 0
      }
    };
  }

  const byEngine: ValidationIdentityConflictAggregateSummary['byEngine'] = {
    pulumi: 0,
    terraform: 0
  };
  const byRiskCategory: ValidationIdentityConflictAggregateSummary['byRiskCategory'] = {
    'create-before-delete-ordering': 0,
    'dns-or-domain-ownership': 0,
    'exclusive-identity-review': 0,
    'kubernetes-object-ownership': 0,
    'physical-name-ownership': 0
  };

  for (const incident of incidents) {
    byEngine[incident.engine] += 1;
    byRiskCategory[incident.riskCategory] += 1;
  }

  return {
    totalCount: incidents.length,
    includedCount: incidents.length,
    maxEntries: incidents.length,
    omittedCount: 0,
    mutationAllowed: false,
    byEngine,
    byRiskCategory
  };
}

export function buildIdentityConflictIncidentReport(
  result: CompactAgentRunResult
): IdentityConflictIncidentReport {
  const incidents = result.validation.identityConflicts.map(conflict => ({
    engine: conflict.engine,
    issueKind: conflict.issueKind,
    conflictCode: conflict.conflictCode,
    conflictFamily: conflict.conflictFamily,
    conflictLabel: conflict.conflictLabel,
    resourceLocator: identityConflictResourceLocator(conflict),
    resourceType: conflict.resourceType,
    identity: conflict.identity,
    riskCategory: normalizeIdentityConflictRiskCategory(conflict.riskCategory, conflict.conflictFamily),
    reviewSteps: conflict.reviewSteps,
    suggestedAction: conflict.suggestedAction,
    sourceCommand: conflict.sourceCommand,
    mutationAllowed: false as const
  }));
  const incidentSummary = summarizeIdentityIncidentSample(
    incidents,
    result.validation.identityConflictSummary
  );

  return {
    kind: 'infra-agent.identity-conflict-report',
    schemaVersion: 1,
    sourceKind: result.kind,
    sourceSchemaVersion: result.schemaVersion,
    sourceTask: result.task,
    workspaceRoot: result.workspaceRoot,
    outcome: result.outcome,
    mutationAllowed: false,
    incidentCount: incidents.length,
    omittedIncidentCount: incidentSummary.omittedCount,
    incidentSummary,
    summary: result.validation.identityConflicts.length > 0
      ? result.validation.identityConflicts.map(summarizeIdentityConflictIncident)
      : ['No runtime exclusive-identity incidents found.'],
    incidents
  };
}

function summarizeValidationDerivedSemanticBlockers(state: AgentRunState): string {
  const blockers = collectValidationDerivedSemanticBlockers(state);

  if (blockers.length === 0) {
    return 'none';
  }

  return blockers.slice(0, 3).map(item =>
    `${item.targetKind} ${item.targetPath}: ${item.path} required by ${item.sourceKind}`
  ).join('; ');
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

function summarizeTargetingPosture(state: AgentRunState): string {
  const targeting = collectCompactTargeting(state);
  const selected = targeting.selectedTarget
    ? `${targeting.selectedTarget.domain} ${targeting.selectedTarget.path} score=${targeting.selectedTarget.score}`
    : 'undetected';
  const ambiguity = targeting.ambiguityKinds.length > 0
    ? targeting.ambiguityKinds.join(', ')
    : 'none';
  const omitted = targeting.omittedCount > 0 ? `; omitted ${targeting.omittedCount}` : '';

  return `${selected}; candidates ${targeting.includedCount}/${targeting.candidateCount}${omitted}; ambiguity ${ambiguity}; next ${targeting.recommendedAction}`;
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
        return `Approval required for ${formatApprovalSignal(topApprovalSignal)}.`;
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

function summarizeApprovalResumePosture(state: AgentRunState): string {
  const resume = collectApprovalResume(state);
  const topApprovalSignal = state.runtime.approvalSignals[0];

  if (!resume.continuationRequired) {
    return 'none';
  }

  const primary = topApprovalSignal
    ? `primary ${formatApprovalSignal(topApprovalSignal)}`
    : 'primary approval scope unavailable';
  const additionalParts = [
    resume.additionalWritePaths.length > 0
      ? `write paths ${resume.additionalWritePaths.join(', ')}`
      : null,
    resume.additionalToolCategories.length > 0
      ? `tool categories ${resume.additionalToolCategories.join(', ')}`
      : null
  ].filter((part): part is string => Boolean(part));
  const additional = resume.additionalSignalCount === 0
    ? 'no additional approval signals'
    : `additional ${resume.additionalSignalCount} signal(s)${additionalParts.length > 0 ? `: ${additionalParts.join('; ')}` : ''}`;

  return `${primary}; ${additional}`;
}

function summarizeApprovalGrantPosture(state: AgentRunState): string {
  const grants = collectApprovalGrants(state);

  if (!grants.hasExplicitApproval) {
    return 'none';
  }

  const parts = [
    grants.approvedWriteRisks.length > 0 ? `write risks ${grants.approvedWriteRisks.join(', ')}` : null,
    grants.approvedWritePaths.length > 0 ? `write paths ${grants.approvedWritePaths.join(', ')}` : null,
    grants.approvedToolCategories.length > 0 ? `tool categories ${grants.approvedToolCategories.join(', ')}` : null,
    `write path scope ${grants.writePathScope}`
  ].filter((part): part is string => Boolean(part));

  return parts.join('; ');
}

function summarizeReviewFocus(state: AgentRunState): string {
  const primaryDomain = getPrimaryRequestedDomain(state.preflight.requestedDomains);
  const topValidationIssue = state.runtime.validationIssues[0];

  if (state.outcome === 'approval-required') {
    return 'Review the scoped write or native operation before granting approval.';
  }

  if (primaryDomain === 'helm') {
    if (state.runtime.validationResults.some(result => result.command.includes('helm template'))) {
      return 'Review rendered Kubernetes objects and the Helm values block that drives them.';
    }

    return 'Review the target chart metadata, values, and templates for the requested Helm change.';
  }

  if (primaryDomain === 'pulumi') {
    if (topValidationIssue?.kind === 'pulumi-missing-config') {
      return 'Review the selected Pulumi stack file and its config namespace before rerunning preview.';
    }

    if (topValidationIssue?.kind === 'pulumi-create-before-delete-conflict') {
      return 'Review Pulumi aliases, deleteBeforeReplace options, import/state repair needs, and the matched provider identity before retrying update.';
    }

    return 'Review the selected Pulumi stack file, config keys, and preview output.';
  }

  if (primaryDomain === 'terraform') {
    if (topValidationIssue?.kind === 'terraform-create-before-delete-conflict') {
      return 'Review Terraform moved blocks, import/state repair needs, lifecycle ordering, and the matched provider identity before retrying.';
    }

    if (topValidationIssue?.kind === 'terraform-validate-failure') {
      return 'Review the target tfvars file and the Terraform module inputs referenced by validate.';
    }

    if (state.runtime.validationResults.some(result => result.command.includes('terraform '))) {
      return 'Review the target tfvars file and Terraform validation output for the selected root.';
    }

    return 'Review the selected Terraform root, tfvars files, and declared variable inputs.';
  }

  return 'Review the primary target, validation output, and bounded changes before continuing.';
}

function summarizeReviewArtifacts(state: AgentRunState): string {
  const primaryDomain = getPrimaryRequestedDomain(state.preflight.requestedDomains);
  const targetPath = inferPrimaryImpactTargetPath(state, primaryDomain);

  if (primaryDomain === 'helm' && targetPath) {
    return `${targetPath}/Chart.yaml, ${targetPath}/values.yaml, ${targetPath}/templates/`;
  }

  if (primaryDomain === 'pulumi') {
    for (const turn of state.turns) {
      for (const result of turn.execution?.executedTools ?? []) {
        if (result.toolName === 'pulumi_config_set') {
          const output = result.output as PulumiConfigSetOutput;
          return `${output.stackFilePath}, config key ${output.key}`;
        }
      }
    }

    if (targetPath) {
      return `${targetPath}/Pulumi.<stack>.yaml, project config namespace`;
    }
  }

  if (primaryDomain === 'terraform') {
    const tfvarsWrites = state.runtime.appliedWrites
      .map(write => write.path)
      .filter(path => /\.tfvars(\.json)?$/i.test(path));

    if (tfvarsWrites[0] && targetPath) {
      return `${tfvarsWrites[0]}, variables declared under ${targetPath}`;
    }

    if (targetPath) {
      return `${targetPath}/terraform*.tfvars, variable declarations under ${targetPath}`;
    }
  }

  if (state.runtime.appliedWrites[0]) {
    return state.runtime.appliedWrites[0].path;
  }

  return targetPath ?? 'undetected';
}

function summarizeReviewCommand(state: AgentRunState): string {
  const primaryDomain = getPrimaryRequestedDomain(state.preflight.requestedDomains);
  const nativeCommands = summarizeDomainSuggestedCommands(state);

  if (primaryDomain === 'helm') {
    return nativeCommands.find(command => command.startsWith('helm show values '))
      ?? nativeCommands[0]
      ?? 'undetected';
  }

  if (primaryDomain === 'pulumi') {
    return nativeCommands.find(command => command.startsWith('pulumi preview '))
      ?? nativeCommands[0]
      ?? 'undetected';
  }

  if (primaryDomain === 'terraform') {
    return nativeCommands.find(command => command.includes(' validate'))
      ?? nativeCommands.find(command => command.includes('fmt -check'))
      ?? nativeCommands[0]
      ?? 'undetected';
  }

  return nativeCommands[0] ?? 'undetected';
}

function summarizeNextOperatorStep(state: AgentRunState): string {
  const primaryDomain = getPrimaryRequestedDomain(state.preflight.requestedDomains);
  const domainLabel = formatPrimaryDomainLabel(primaryDomain);
  const reviewCommand = summarizeReviewCommand(state);
  const topApprovalSignal = state.runtime.approvalSignals[0];
  const lastQuestion = state.turns[state.turns.length - 1]?.decision.action.payload?.questions?.[0];

  switch (state.outcome) {
    case 'completed':
      return reviewCommand === 'undetected'
        ? 'Review the bounded change and validated output before merging or handing off the update.'
        : `Run ${reviewCommand} and review the bounded change before merging or handing off the update.`;
    case 'approval-required':
      if (topApprovalSignal) {
        return `Decide whether to approve ${formatApprovalSignal(topApprovalSignal)} before continuing.`;
      }

      return 'Decide whether to approve the pending scoped write before continuing.';
    case 'validation-blocked':
      return reviewCommand === 'undetected'
        ? `Inspect the failing ${domainLabel} validation output and correct the configuration before retrying.`
        : `Run ${reviewCommand}, correct the blocking ${domainLabel} issue, and rerun the agent.`;
    case 'repair-budget-exhausted':
      return reviewCommand === 'undetected'
        ? `Inspect the latest ${domainLabel} validation issue and apply a manual correction before retrying.`
        : `Run ${reviewCommand}, apply a manual fix, and retry the bounded ${domainLabel} task.`;
    case 'clarification-required':
      if (lastQuestion) {
        return `Answer this question and rerun the task: ${lastQuestion}`;
      }

      return `Clarify the intended ${domainLabel} target, environment, or values scope before retrying.`;
    case 'no-safe-action':
    default:
      return `Review ${domainLabel} target ambiguity, workspace policy, or validator readiness before rerunning the task.`;
  }
}

function summarizeTurnBudget(state: AgentRunState): string {
  const budget = collectLoopBudget(state);
  if (budget.exhausted) {
    return `${budget.turnsUsed}/${budget.maxTurns} turn(s) used; exhausted`;
  }

  return `${budget.turnsUsed}/${budget.maxTurns} turn(s) used; ${budget.turnsRemaining} remaining`;
}

function summarizeToolTrace(state: AgentRunState): string {
  const summaries = state.runtime.toolSummaries ?? [];
  if (summaries.length === 0) {
    return 'none';
  }

  const latest = summaries.slice(-4).map(summary => `t${summary.turnIndex}:${summary.summary}`);
  const omitted = summaries.length - latest.length;
  return `${latest.join(' | ')}${omitted > 0 ? ` (+${omitted} earlier)` : ''}`;
}

function summarizePermissionPosture(state: AgentRunState): string {
  const aggregate = collectToolPermissionAggregate(state);
  if (aggregate.totalToolCount === 0) {
    return 'no tools executed';
  }

  const parts = [
    `${aggregate.totalToolCount} tool(s)`,
    `${aggregate.workspaceMutationToolCount} workspace mutation(s)`,
    `${aggregate.externalCommandToolCount} native command(s)`
  ];

  if (aggregate.externalStateMutationToolCount > 0) {
    parts.push(`${aggregate.externalStateMutationToolCount} stack/state mutation-risk tool(s)`);
  }

  if (aggregate.approvalRequiredToolCount > 0) {
    parts.push(`${aggregate.approvalRequiredToolCount} approval-gated tool(s)`);
  }

  return parts.join('; ');
}

function summarizeKnowledgeContext(state: AgentRunState): string {
  const budget = budgetRetrievedContext(
    state.runtime.retrievedContext,
    state.runtime.retrievedContextBudget
  ).budget;
  const omittedReasons = [
    budget.omittedByPacketLimit > 0 ? `packet-limit=${budget.omittedByPacketLimit}` : null,
    budget.omittedByTokenBudget > 0 ? `token-budget=${budget.omittedByTokenBudget}` : null
  ].filter((part): part is string => Boolean(part));
  const omittedSummary = budget.omittedPacketCount === 0
    ? 'none'
    : `${budget.omittedPacketCount} (${omittedReasons.join(', ')})`;

  return [
    `${budget.includedPacketCount}/${budget.totalPacketCount} packet(s) included`,
    `${budget.includedTokenEstimate}/${budget.maxTokens} token estimate used`,
    `omitted ${omittedSummary}`
  ].join('; ');
}

function summarizeKnowledgeFacts(state: AgentRunState): string {
  const summary = collectKnowledgeFactsSummary(state);
  const omittedSummary = summary.omittedFactCount === 0 ? 'none' : String(summary.omittedFactCount);
  const omittedUnitSummary = summary.omittedUnitCount === 0 ? 'none' : String(summary.omittedUnitCount);
  return [
    `${summary.includedFactCount}/${summary.totalFactCount} fact(s) included`,
    `${summary.includedUnitCount}/${summary.totalUnitCount} unit(s) included`,
    `max ${summary.maxFacts}`,
    `omitted ${omittedSummary}`,
    `omitted units ${omittedUnitSummary}`,
    `sources ${summary.sourceCount}`,
    `stale sources ${summary.staleSourceCount}`,
    `unchecked sources ${summary.uncheckedSourceCount}`
  ].join('; ');
}

function summarizePlannerConfig(state: AgentRunState): string {
  const plannerConfig = collectPlannerConfig(state);
  if (!plannerConfig.llm) {
    return `${plannerConfig.effectiveMode} (${plannerConfig.clientName})`;
  }

  return [
    `${plannerConfig.llm.provider}/${plannerConfig.llm.model}`,
    `transport=${plannerConfig.llm.capabilities.transport}`,
    `response=${plannerConfig.llm.capabilities.responseFormat}`,
    `streaming=${plannerConfig.llm.capabilities.supportsStreaming ? 'supported' : 'disabled'}`
  ].join('; ');
}

export function summarizeResultCard(state: AgentRunState): string[] {
  const lines: string[] = [];
  const changedPaths = Array.from(new Set(state.runtime.appliedWrites.map(write => write.path)));

  lines.push(`Run posture: ${summarizeRunPosture(state)}`);
  lines.push(`Readiness: ${summarizeReadinessPosture(state)}`);
  lines.push(`Primary target impact: ${summarizePrimaryTargetImpact(state)}`);
  lines.push(`Targeting: ${summarizeTargetingPosture(state)}`);
  lines.push(`Open concern: ${summarizeOpenConcern(state)}`);
  lines.push(`Approval resume: ${summarizeApprovalResumePosture(state)}`);
  lines.push(`Approval grants: ${summarizeApprovalGrantPosture(state)}`);
  lines.push(`Review focus: ${summarizeReviewFocus(state)}`);
  lines.push(`Identity review: ${summarizeIdentityConflictReview(state)}`);
  lines.push(`Review artifacts: ${summarizeReviewArtifacts(state)}`);
  lines.push(`Review command: ${summarizeReviewCommand(state)}`);
  lines.push(`Next operator step: ${summarizeNextOperatorStep(state)}`);
  lines.push(`Work plan: ${summarizeWorkPlan(state)}`);
  lines.push(`Tool trace: ${summarizeToolTrace(state)}`);
  lines.push(`Permission posture: ${summarizePermissionPosture(state)}`);
  lines.push(`Planner config: ${summarizePlannerConfig(state)}`);
  lines.push(`Changed files: ${changedPaths.length === 0 ? 'none' : changedPaths.slice(0, 3).join(', ')}${changedPaths.length > 3 ? ` (+${changedPaths.length - 3} more)` : ''}`);
  lines.push(`Native CLI operations: ${summarizeNativeCliTools(state)}`);
  lines.push(`Native CLI findings: ${summarizeNativeCliFindings(state)}`);
  lines.push(`Knowledge context: ${summarizeKnowledgeContext(state)}`);
  lines.push(`Knowledge facts: ${summarizeKnowledgeFacts(state)}`);
  const targetValidationCount = getTargetValidationResults(state).length;
  const yamlGuardCount = state.runtime.validationResults.filter(result => isYamlSyntaxValidationCommand(result.command)).length;
  lines.push(`Validators executed: ${targetValidationCount} command(s) across ${summarizeValidatorFamilies(state)}${yamlGuardCount > 0 ? `; ${yamlGuardCount} YAML syntax guard(s)` : ''}`);
  lines.push(`Validation findings: ${summarizeValidationFindings(state)}`);
  lines.push(`Validation blockers: ${summarizeValidationBlockers(state)}`);
  lines.push(`Semantic blockers: ${summarizeValidationDerivedSemanticBlockers(state)}`);
  lines.push(`Turn budget: ${summarizeTurnBudget(state)}`);
  lines.push(`Repair activity: ${state.runtime.repairAttempts}/${getAgentMaxRepairAttempts(state)} bounded repair attempt(s) used`);

  return lines;
}

export function buildCompactAgentRunResult(state: AgentRunState): CompactAgentRunResult {
  const primaryTarget = getPrimaryTargetCandidateFromAgent(state);
  const changedFiles = Array.from(new Set(state.runtime.appliedWrites.map(write => write.path)));
  const targetValidationCount = getTargetValidationResults(state).length;
  const yamlGuardCount = state.runtime.validationResults.filter(result => isYamlSyntaxValidationCommand(result.command)).length;
  const queryConfig = getAgentQueryConfig(state);
  const knowledgeFacts = collectKnowledgeFactsSummary(state);
  const identityConflicts = collectValidationIdentityConflicts(state);
  const turnTrace = collectCompactTurnTrace(state);

  return {
    kind: 'infra-agent.agent-result',
    schemaVersion: 1,
    outcome: state.outcome,
    modelName: state.modelName,
    turnsUsed: state.turns.length,
    task: state.preflight.task,
    workspaceRoot: state.preflight.workspaceRoot,
    profileId: state.preflight.profile.id,
    requestedDomains: [...state.preflight.requestedDomains],
    requestedEnvironment: state.preflight.requestedEnvironment,
    requestedService: state.preflight.requestedService,
    primaryTarget: primaryTarget
      ? {
          kind: primaryTarget.kind,
          name: primaryTarget.name,
          path: primaryTarget.path,
          score: primaryTarget.score
        }
      : null,
    changedFiles,
    resultCard: summarizeResultCard(state),
    nextSteps: summarizeRecommendedNextSteps(state),
    suggestedCommands: summarizeSuggestedCommands(state),
    handoffCheckpoint: collectHandoffCheckpoint(state),
    harness: {
      maxTurns: getAgentMaxTurns(state),
      queryConfig: {
        maxTurns: queryConfig.maxTurns,
        maxRepairAttempts: queryConfig.maxRepairAttempts,
        retrievedContextBudget: queryConfig.retrievedContextBudget
      },
      plannerConfig: collectPlannerConfig(state),
      loopBudget: collectLoopBudget(state),
      repairBudget: collectRepairBudget(state),
      stateSummary: collectRuntimeStateSummary(state),
      targeting: collectCompactTargeting(state),
      plannerHandoff: collectPlannerHandoff(state),
      workPlan: collectWorkPlan(state),
      lifecycleEvents: collectCompactLifecycleEvents(state),
      turnTraceBudget: collectTurnTraceBudget(state, turnTrace),
      turnTraceLimit: COMPACT_TURN_TRACE_LIMIT,
      turnTraceOmittedCount: Math.max(0, state.turns.length - COMPACT_TURN_TRACE_LIMIT),
      turnTrace,
      toolTrace: collectCompactToolTrace(state),
      toolPermissionSummary: collectToolPermissionAggregate(state)
    },
    validation: {
      status: summarizeValidationStatus(state),
      findings: summarizeValidationFindings(state),
      selectedPlan: collectSelectedValidationPlan(state),
      semanticBlockers: collectValidationDerivedSemanticBlockers(state).slice(0, 5),
      identityConflictSummary: collectValidationIdentityConflictSummary(state, identityConflicts),
      identityConflicts,
      targetCommandCount: targetValidationCount,
      yamlGuardCount,
      commands: collectValidationCommandSummaries(state),
      issueSummary: collectValidationIssueSummary(state),
      issueDetails: {
        maxEntries: COMPACT_VALIDATION_ISSUE_DETAIL_LIMIT,
        omittedCount: Math.max(0, state.runtime.validationIssues.length - COMPACT_VALIDATION_ISSUE_DETAIL_LIMIT)
      },
      safetyBlockers: collectValidationSafetyBlockers(state),
      issues: state.runtime.validationIssues.slice(0, COMPACT_VALIDATION_ISSUE_DETAIL_LIMIT).map(issue => ({
        kind: issue.kind,
        repairable: issue.repairable,
        message: issue.message,
        guidance: issue.guidance ?? null,
        metadata: issue.metadata ?? {}
      }))
    },
    approval: {
      requiredWriteRisks: [...state.preflight.effectiveApprovalPolicy.requiredWriteRisks],
      requiredToolCategories: [...state.preflight.effectiveApprovalPolicy.requiredToolCategories],
      grants: collectApprovalGrants(state),
      signals: state.runtime.approvalSignals.slice(0, COMPACT_APPROVAL_SIGNAL_LIMIT).map(compactApprovalSignal),
      resume: collectApprovalResume(state)
    },
    knowledgeCache: state.preflight.inspection.knowledgeCache,
    knowledgeContext: budgetRetrievedContext(
      state.runtime.retrievedContext,
      state.runtime.retrievedContextBudget
    ).budget,
    knowledgeFacts,
    readiness: collectCompactReadiness(state)
  };
}

function collectHandoffCheckpoint(state: AgentRunState): CompactHandoffCheckpoint {
  const plannerHandoff = collectPlannerHandoff(state);
  const workPlan = collectWorkPlan(state);
  const targeting = collectCompactTargeting(state);
  const readiness = collectCompactReadiness(state);
  const lifecycleEvents = collectCompactLifecycleEvents(state);
  const validationIssueSummary = collectValidationIssueSummary(state);
  const validationSafetyBlockers = collectValidationSafetyBlockers(state);
  const identityConflictSummary = collectValidationIdentityConflictSummary(state);
  const approvalResume = collectApprovalResume(state);
  const knowledgeBudget = budgetRetrievedContext(
    state.runtime.retrievedContext,
    state.runtime.retrievedContextBudget
  ).budget;
  const knowledgeFacts = collectKnowledgeFactsSummary(state);
  const continuationReason = plannerHandoff.activeBlocker.kind === 'none'
    ? 'none'
    : plannerHandoff.activeBlocker.kind;

  return {
    schemaVersion: 1,
    source: 'agent-result',
    compact: true,
    primaryArtifact: 'agent --json',
    debugArtifact: 'agent --json-full',
    mutationAllowed: false,
    exclusions: {
      rawRuntimeIncluded: false,
      rawPreflightIncluded: false,
      rawToolOutputIncluded: false,
      rawPromptIncluded: false,
      rawKnowledgeExcerptIncluded: false
    },
    summary: {
      outcome: state.outcome,
      activeBlocker: plannerHandoff.activeBlocker.kind,
      nextControlAction: plannerHandoff.nextControlAction,
      readinessStatus: readiness.status,
      validationStatus: summarizeValidationStatus(state),
      validationIssueCount: state.runtime.validationIssues.length,
      identityConflictCount: identityConflictSummary.totalCount,
      approvalContinuationRequired: state.outcome === 'approval-required',
      changedFileCount: new Set(state.runtime.appliedWrites.map(write => write.path)).size
    },
    budgets: {
      turnTrace: sampleBudget(state.turns.length, Math.min(state.turns.length, COMPACT_TURN_TRACE_LIMIT)),
      lifecycleEvents: {
        includedCount: lifecycleEvents.includedCount,
        omittedCount: lifecycleEvents.omittedCount
      },
      toolTrace: sampleBudget(
        state.runtime.toolSummaries?.length ?? 0,
        Math.min(state.runtime.toolSummaries?.length ?? 0, COMPACT_TOOL_TRACE_LIMIT)
      ),
      workPlan: {
        includedCount: workPlan.includedCount,
        omittedCount: workPlan.omittedCount
      },
      targeting: {
        includedCount: targeting.includedCount,
        omittedCount: targeting.omittedCount
      },
      validationCommands: sampleBudget(
        state.runtime.validationResults.length,
        Math.min(state.runtime.validationResults.length, COMPACT_VALIDATION_COMMAND_LIMIT)
      ),
      validationIssues: sampleBudget(
        state.runtime.validationIssues.length,
        Math.min(state.runtime.validationIssues.length, COMPACT_VALIDATION_ISSUE_DETAIL_LIMIT)
      ),
      validationIssueGroups: {
        includedCount: validationIssueSummary.groups.length,
        omittedCount: validationIssueSummary.omittedGroupCount
      },
      validationSafetyBlockers: {
        includedCount: validationSafetyBlockers.entries.length,
        omittedCount: validationSafetyBlockers.omittedCount
      },
      identityConflicts: {
        includedCount: identityConflictSummary.includedCount,
        omittedCount: identityConflictSummary.omittedCount
      },
      approvalSignals: sampleBudget(
        state.runtime.approvalSignals.length,
        Math.min(state.runtime.approvalSignals.length, COMPACT_APPROVAL_SIGNAL_LIMIT)
      ),
      knowledgePackets: {
        includedCount: knowledgeBudget.includedPacketCount,
        omittedCount: knowledgeBudget.omittedPacketCount,
        includedTokenEstimate: knowledgeBudget.includedTokenEstimate,
        omittedTokenEstimate: knowledgeBudget.omittedTokenEstimate
      },
      knowledgeFacts: {
        includedCount: knowledgeFacts.includedFactCount,
        omittedCount: knowledgeFacts.omittedFactCount
      },
      knowledgeUnits: {
        includedCount: knowledgeFacts.includedUnitCount,
        omittedCount: knowledgeFacts.omittedUnitCount
      }
    },
    continuation: {
      required: continuationReason !== 'none',
      reason: continuationReason,
      nextControlAction: plannerHandoff.nextControlAction,
      approvalRequired: state.outcome === 'approval-required',
      command: state.outcome === 'approval-required' ? approvalResume.command : null,
      compactCommand: state.outcome === 'approval-required' ? approvalResume.compactCommand : null,
      debugCommand: state.outcome === 'approval-required' ? approvalResume.debugCommand : null,
      mutationAllowed: false
    },
    durableSections: [
      'root',
      'harness',
      'validation',
      'approval',
      'knowledge',
      'readiness',
      'result-card'
    ]
  };
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

function buildQueryConfigFlags(state: AgentRunState): string {
  const config = state.config ?? DEFAULT_QUERY_LOOP_CONFIG;
  return [
    `--max-turns ${config.maxTurns}`,
    `--max-repair-attempts ${config.maxRepairAttempts}`,
    `--context-packet-limit ${config.retrievedContextBudget.maxPackets}`,
    `--context-token-budget ${config.retrievedContextBudget.maxTokens}`,
    `--context-fact-limit ${config.retrievedContextBudget.maxFacts}`
  ].join(' ');
}

function buildLLMConfigFlagParts(state: AgentRunState): string[] {
  const plannerConfig = collectPlannerConfig(state);
  const flags: string[] = [];

  if (plannerConfig.llm) {
    if (plannerConfig.llm.providerSource === 'cli') {
      flags.push(`--llm-provider ${plannerConfig.llm.provider}`);
    }
    if (plannerConfig.llm.modelSource === 'cli') {
      flags.push(`--model ${shellQuote(plannerConfig.llm.model)}`);
    }
    if (plannerConfig.llm.baseUrlSource === 'cli') {
      flags.push(`--openai-base-url ${shellQuote(plannerConfig.llm.baseUrl)}`);
    }
  }

  return flags;
}

function buildPlannerConfigFlagParts(state: AgentRunState): string[] {
  const plannerConfig = collectPlannerConfig(state);
  return [
    ...(plannerConfig.requestedMode !== 'auto' ? [`--planner ${plannerConfig.requestedMode}`] : []),
    ...buildLLMConfigFlagParts(state)
  ];
}

function buildDoctorCommand(state: AgentRunState): string {
  return `${buildCliBaseCommand()} doctor ${shellQuote(state.preflight.workspaceRoot)}${buildFlagSegment(buildLLMConfigFlagParts(state))} --json`;
}

function buildApprovalGrantFlagParts(state: AgentRunState): string[] {
  return [
    ...state.preflight.approval.approvedWriteRisks.map(risk => `--approve-write-risk ${risk}`),
    ...state.preflight.approval.approvedWritePaths.map(path => `--approve-write-path ${shellQuote(path)}`),
    ...state.preflight.approval.approvedToolCategories.map(category => `--approve-tool-category ${category}`)
  ];
}

function buildApprovalSignalFlagParts(signal: ApprovalSignal | null): string[] {
  if (signal?.kind === 'tool-category-approval-required') {
    return [`--approve-tool-category ${signal.toolCategory}`];
  }

  if (signal?.kind === 'write-approval-required') {
    return [
      `--approve-write-risk ${signal.risk}`,
      `--approve-write-path ${shellQuote(signal.path)}`
    ];
  }

  return [];
}

function buildFlagSegment(flagParts: string[]): string {
  return flagParts.length > 0 ? ` ${flagParts.join(' ')}` : '';
}

function buildTaskFlag(task: string): string {
  return shellQuote(task);
}

function buildApprovalContinuationCommand(
  state: AgentRunState,
  outputMode: 'human' | 'compact-json' | 'debug-json'
): string | null {
  if (state.outcome !== 'approval-required') {
    return null;
  }

  return buildApprovalContinuationCommandForSignal(
    state,
    state.runtime.approvalSignals[0] ?? null,
    outputMode
  );
}

function buildApprovalContinuationCommandForSignal(
  state: AgentRunState,
  signal: ApprovalSignal | null,
  outputMode: 'human' | 'compact-json' | 'debug-json'
): string {
  const base = buildCliBaseCommand();
  const taskFlag = buildTaskFlag(state.preflight.task);
  const workspaceFlag = buildWorkspaceFlag(state.preflight.workspaceRoot);
  const plannerFlagSegment = buildFlagSegment(buildPlannerConfigFlagParts(state));
  const queryConfigFlags = buildQueryConfigFlags(state);
  const approvalFlags = Array.from(new Set([
    ...buildApprovalGrantFlagParts(state),
    ...buildApprovalSignalFlagParts(signal)
  ]));
  const approvalFlagSegment = buildFlagSegment(approvalFlags);
  const outputFlag = outputMode === 'compact-json'
    ? ' --json'
    : outputMode === 'debug-json'
      ? ' --json-full'
      : '';

  return `${base} agent ${taskFlag} ${workspaceFlag}${plannerFlagSegment} ${queryConfigFlags}${approvalFlagSegment}${outputFlag}`;
}

function collectApprovalResume(state: AgentRunState): CompactAgentRunResult['approval']['resume'] {
  const writeRisks = new Set<string>();
  const writePaths = new Set<string>();
  const toolCategories = new Set<string>();
  const additionalWriteRisks = new Set<string>();
  const additionalWritePaths = new Set<string>();
  const additionalToolCategories = new Set<string>();

  for (const [index, signal] of state.runtime.approvalSignals.entries()) {
    if (signal.kind === 'write-approval-required') {
      writeRisks.add(signal.risk);
      writePaths.add(signal.path);
      if (index > 0) {
        additionalWriteRisks.add(signal.risk);
        additionalWritePaths.add(signal.path);
      }
      continue;
    }

    if (signal.kind === 'tool-category-approval-required') {
      toolCategories.add(signal.toolCategory);
      if (index > 0) {
        additionalToolCategories.add(signal.toolCategory);
      }
    }
  }

  const topApprovalSignal = state.runtime.approvalSignals[0];
  const additionalSignalCount = Math.max(0, state.runtime.approvalSignals.length - (topApprovalSignal ? 1 : 0));
  const additionalCommands = state.outcome === 'approval-required'
    ? state.runtime.approvalSignals.slice(1).map(signal => ({
        signal: compactApprovalSignal(signal),
        command: buildApprovalContinuationCommandForSignal(state, signal, 'human'),
        compactCommand: buildApprovalContinuationCommandForSignal(state, signal, 'compact-json'),
        debugCommand: buildApprovalContinuationCommandForSignal(state, signal, 'debug-json')
      }))
    : [];

  return {
    continuationRequired: state.outcome === 'approval-required',
    command: buildApprovalContinuationCommand(state, 'human'),
    compactCommand: buildApprovalContinuationCommand(state, 'compact-json'),
    debugCommand: buildApprovalContinuationCommand(state, 'debug-json'),
    primarySignal: topApprovalSignal ? compactApprovalSignal(topApprovalSignal) : null,
    additionalCommands,
    additionalSignalCount,
    additionalWriteRisks: Array.from(additionalWriteRisks),
    additionalWritePaths: Array.from(additionalWritePaths),
    additionalToolCategories: Array.from(additionalToolCategories),
    pendingScope: {
      signalCount: state.runtime.approvalSignals.length,
      includedSignalCount: Math.min(state.runtime.approvalSignals.length, COMPACT_APPROVAL_SIGNAL_LIMIT),
      omittedSignalCount: Math.max(0, state.runtime.approvalSignals.length - COMPACT_APPROVAL_SIGNAL_LIMIT),
      additionalSignalCount,
      writeRiskCount: writeRisks.size,
      writePathCount: writePaths.size,
      toolCategoryCount: toolCategories.size
    },
    writeRisks: Array.from(writeRisks),
    writePaths: Array.from(writePaths),
    toolCategories: Array.from(toolCategories),
    signalCount: state.runtime.approvalSignals.length
  };
}

function collectApprovalGrants(state: AgentRunState): CompactAgentRunResult['approval']['grants'] {
  const approvedWritePaths = [...state.preflight.approval.approvedWritePaths];
  const approvedWriteRisks = [...state.preflight.approval.approvedWriteRisks];
  const approvedToolCategories = [...state.preflight.approval.approvedToolCategories];

  return {
    approvedWriteRisks,
    approvedWritePaths,
    approvedToolCategories,
    writePathScope: approvedWritePaths.length === 0 ? 'all' : 'scoped',
    hasExplicitApproval:
      approvedWriteRisks.length > 0
      || approvedWritePaths.length > 0
      || approvedToolCategories.length > 0
  };
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

function getPrimaryTargetCandidateFromPreflight(state: RunPreflightState) {
  const primaryDomain = getPrimaryRequestedDomain(state.requestedDomains);

  if (primaryDomain === 'helm') {
    return state.targetCandidates.find(candidate => candidate.kind === 'helm-chart') ?? state.targetCandidates[0];
  }

  if (primaryDomain === 'pulumi') {
    return state.targetCandidates.find(candidate => candidate.kind === 'pulumi-project') ?? state.targetCandidates[0];
  }

  if (primaryDomain === 'terraform') {
    return state.targetCandidates.find(candidate => candidate.kind === 'terraform-root') ?? state.targetCandidates[0];
  }

  return state.targetCandidates[0];
}

function getPrimaryTargetCandidateFromAgent(state: AgentRunState) {
  const primaryDomain = getPrimaryRequestedDomain(state.preflight.requestedDomains);
  const topTargetPath = getPrimaryDomainTargetPath(state, primaryDomain);

  if (topTargetPath) {
    return state.preflight.targetCandidates.find(candidate => candidate.path === topTargetPath) ?? state.preflight.targetCandidates[0];
  }

  return state.preflight.targetCandidates[0];
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

function summarizeIdentityReportSuggestedCommands(state: AgentRunState, agentJsonCommand: string, base: string): string[] {
  if (collectValidationIdentityConflicts(state).length === 0) {
    return [];
  }

  const resultPath = 'agent-result.json';
  return [
    `${agentJsonCommand} > ${shellQuote(resultPath)}`,
    `${base} identity-report ${shellQuote(resultPath)} --json`
  ];
}

export function summarizePreflightSnapshot(state: RunPreflightState): string[] {
  const lines: string[] = [];
  const unavailableValidators = state.validation.validators.filter(validator => !validator.available).map(validator => validator.name);
  const topTarget = getPrimaryTargetCandidateFromPreflight(state);

  lines.push(`Profile: ${state.profile.id}`);
  lines.push(`Detected domains: ${state.inspection.domainCapabilities.length > 0 ? state.inspection.domainCapabilities.map(domain => domain.label).join(', ') : 'none'}`);
  lines.push(`Requested domains: ${formatRequestedDomains(state.requestedDomains)}`);
  lines.push(`Planned domain path: ${state.requestedDomains.length > 0 ? state.requestedDomains.map(toTitleCase).join(' -> ') : 'infer from targets'}`);
  lines.push(`Requested environment: ${state.requestedEnvironment ?? 'undetected'}`);
  lines.push(`Requested service: ${state.requestedService ?? 'undetected'}`);
  lines.push(`Primary target: ${topTarget ? `${topTarget.kind} ${topTarget.path} (score=${topTarget.score})` : 'undetected'}`);
  lines.push(`Validation readiness: ${unavailableValidators.length === 0 ? 'all configured validators available' : `missing ${unavailableValidators.join(', ')}`}`);
  const approvalRules = [
    state.effectiveApprovalPolicy.requiredWriteRisks.length > 0
      ? `writes with risk ${state.effectiveApprovalPolicy.requiredWriteRisks.join(', ')} require approval`
      : null,
    state.effectiveApprovalPolicy.requiredToolCategories.length > 0
      ? `tool categories ${state.effectiveApprovalPolicy.requiredToolCategories.join(', ')} require approval`
      : null
  ].filter((rule): rule is string => Boolean(rule));
  lines.push(`Approval posture: ${approvalRules.length > 0 ? approvalRules.join('; ') : 'no approval rules active'}`);

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
  const lastTurn = state.turns[state.turns.length - 1];
  const topValidationIssue = state.runtime.validationIssues[0];
  const primaryDomain = getPrimaryRequestedDomain(state.preflight.requestedDomains);
  const domainLabel = formatPrimaryDomainLabel(primaryDomain);
  const domainTarget = describeDomainTarget(primaryDomain);
  const topTarget = getPrimaryTargetCandidateFromAgent(state);

  if (topTarget) {
    steps.push(`Focus on ${topTarget.kind} target ${topTarget.path} for the next change or review step.`);
  }

  switch (state.outcome) {
    case 'completed':
      steps.push('Review the bounded file changes and keep the validated output as the proposed infra update.');
      return steps;
    case 'approval-required':
      steps.push('Approve the flagged write risk, write path, or tool category before asking the agent to continue.');
      steps.push('Use --approve-write-risk with optional --approve-write-path, or --approve-tool-category, to continue the same task with explicit approval.');
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
  const plannerFlagSegment = buildFlagSegment(buildPlannerConfigFlagParts(state));
  const approvalGrantFlagSegment = buildFlagSegment(buildApprovalGrantFlagParts(state));
  const rerunCommand = `${base} run ${taskFlag} ${workspaceFlag}${approvalGrantFlagSegment}`;
  const agentJsonCommand = `${base} agent ${taskFlag} ${workspaceFlag}${plannerFlagSegment}${approvalGrantFlagSegment} --json`;
  const domainNativeCommands = summarizeDomainSuggestedCommands(state);
  const identityReportCommands = summarizeIdentityReportSuggestedCommands(state, agentJsonCommand, base);
  const reviewCommand = summarizeReviewCommand(state);

  switch (state.outcome) {
    case 'approval-required':
      if (topApprovalSignal) {
        return prefixReadinessSuggestedCommands(state, [
          buildApprovalContinuationCommandForSignal(state, topApprovalSignal, 'human')
        ]);
      }
      return prefixReadinessSuggestedCommands(state, [
        buildApprovalContinuationCommandForSignal(state, null, 'human')
      ]);
    case 'clarification-required':
      if (primaryDomain === 'terraform') {
        return prefixReadinessSuggestedCommands(
          state,
          [rerunCommand, ...domainNativeCommands, domainInspectCommand, domainValidateCommand]
        );
      }
      if (primaryDomain === 'pulumi' || primaryDomain === 'helm') {
        return prefixReadinessSuggestedCommands(
          state,
          [domainInspectCommand, ...domainNativeCommands, rerunCommand, domainValidateCommand]
        );
      }
      return prefixReadinessSuggestedCommands(state, [
        rerunCommand,
        domainInspectCommand
      ]);
    case 'validation-blocked':
    case 'repair-budget-exhausted':
      if (primaryDomain === 'terraform' || primaryDomain === 'pulumi' || primaryDomain === 'helm') {
        return prefixReadinessSuggestedCommands(
          state,
          [...identityReportCommands, ...domainNativeCommands, domainValidateCommand, domainInspectCommand, rerunCommand]
        );
      }
      return prefixReadinessSuggestedCommands(state, [
        ...identityReportCommands,
        domainInspectCommand,
        rerunCommand
      ]);
    case 'completed':
      return prefixReadinessSuggestedCommands(state, [
        ...(reviewCommand !== 'undetected' ? [reviewCommand] : []),
        agentJsonCommand
      ]);
    case 'no-safe-action':
    default:
      return prefixReadinessSuggestedCommands(state, [
        rerunCommand
      ]);
  }
}

export function summarizeAgentSnapshot(state: AgentRunState): string[] {
  const lines: string[] = [];
  const topValidationIssue = state.runtime.validationIssues[0];
  const primaryDomain = getPrimaryRequestedDomain(state.preflight.requestedDomains);
  const topTarget = getPrimaryTargetCandidateFromAgent(state);

  lines.push(`Outcome: ${state.outcome}`);
  lines.push(`Model: ${state.modelName}`);
  lines.push(`Detected domains: ${state.preflight.inspection.domainCapabilities.length > 0 ? state.preflight.inspection.domainCapabilities.map(domain => domain.label).join(', ') : 'none'}`);
  lines.push(`Requested domains: ${formatRequestedDomains(state.preflight.requestedDomains)}`);
  lines.push(`Primary domain: ${formatPrimaryDomainLabel(primaryDomain)}`);
  lines.push(`Active bounded path: ${summarizeBoundedPath(state)}`);
  lines.push(`Primary target: ${topTarget ? `${topTarget.kind} ${topTarget.path}` : 'undetected'}`);
  lines.push(`Tool trace: ${summarizeToolTrace(state)}`);
  lines.push(`Repair attempts: ${state.runtime.repairAttempts}/${getAgentMaxRepairAttempts(state)}`);
  lines.push(`Validation status: ${summarizeValidationStatus(state)}`);
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
  process.stdout.write(`knowledge cache: ${inspection.knowledgeCache.root} (${inspection.knowledgeCache.source})\n`);
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
        chart.hasTemplatesDir ? 'templates' : 'missing-templates',
        chart.valuesSchemaFile ? 'values-schema' : 'missing-values-schema'
      ].join(', ');
      return `${chart.chartRoot} (${features})`;
    }),
    'No Helm charts detected.'
  );

  process.stdout.write('\n');

  printHeader('Pulumi Projects');
  printList(
    inspection.pulumiProjects.map(project => `${project.projectRoot} (${project.stackFiles.length} stack file(s), ${project.resourceTokens.length} resource token(s))`),
    'No Pulumi projects detected.'
  );

  process.stdout.write('\n');

  printHeader('Terraform Roots');
  printList(
    inspection.terraformRoots.map(root => `${root.rootPath} (${root.tfFiles.length} .tf file(s), ${root.tfvarsFiles.length} tfvars file(s), ${root.providerSchemaFiles.length} provider schema file(s))`),
    'No Terraform roots detected.'
  );

  process.stdout.write('\n');

  printHeader('Domain Capabilities');
  printList(
    summarizeFocusedDomainCapabilities(inspection.domainCapabilities, []),
    'No supported infra domains detected.'
  );

  process.stdout.write('\n');

  printHeader('Config Semantics');
  printList(
    inspection.configSemantics.map(summary => `${summary.targetKind} ${summary.targetPath}: ${summary.facts.length} fact(s)`),
    'No structured config semantics detected.'
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
    summarizeFocusedValidationPlan(preflight.plan, []),
    'No validation targets detected.'
  );
}

export function printKnowledgePrefetchResult(result: KnowledgePrefetchResult): void {
  printHeader('Knowledge prefetch');
  process.stdout.write(`workspace: ${result.workspaceRoot}\n`);
  process.stdout.write(`knowledge cache: ${result.cacheRoot}\n`);
  process.stdout.write(`domains: ${result.requestedDomains.length > 0 ? result.requestedDomains.join(', ') : 'none'}\n`);
  process.stdout.write(`targets: ${result.targetPaths.length > 0 ? result.targetPaths.join(', ') : 'all'}\n`);
  process.stdout.write(`max external sources: ${result.maxSources}\n`);
  process.stdout.write(`summary: fetched=${result.summary.fetched}, cached=${result.summary.cached}, stale-cache=${result.summary.staleCache}, local=${result.summary.local}, skipped=${result.summary.skipped}, failed=${result.summary.failed}\n`);
  process.stdout.write(`previous cache: fresh=${result.summary.previousCacheStatus.fresh}, stale=${result.summary.previousCacheStatus.stale}, missing=${result.summary.previousCacheStatus.missing}, local=${result.summary.previousCacheStatus.local}\n\n`);
  printHeader('Sources');
  printList(result.sources.map(formatKnowledgeSourceResult), 'No knowledge sources selected.');
}

export function printKnowledgeSourcesReport(report: KnowledgeSourcesReport): void {
  printHeader('Knowledge sources');
  process.stdout.write(`workspace: ${report.workspaceRoot}\n`);
  process.stdout.write(`knowledge cache: ${report.cacheRoot}\n`);
  process.stdout.write(`domains: ${report.requestedDomains.length > 0 ? report.requestedDomains.join(', ') : 'none'}\n`);
  process.stdout.write(`targets: ${report.targetPaths.length > 0 ? report.targetPaths.join(', ') : 'all'}\n`);
  process.stdout.write(`summary: sources=${report.sourceCount}, local=${report.summary.local}, external=${report.summary.external}\n`);
  process.stdout.write(`cache: fresh=${report.summary.cacheStatus.fresh}, stale=${report.summary.cacheStatus.stale}, missing=${report.summary.cacheStatus.missing}, refresh-recommended=${report.summary.cacheStatus.refreshRecommended}\n`);
  process.stdout.write(`storage: public-reference=${report.summary.storagePolicy.publicReference}, workspace-private=${report.summary.storagePolicy.workspacePrivate}, shareable=${report.summary.storagePolicy.shareableByDefault}, opt-in=${report.summary.storagePolicy.explicitOptInRequired}\n\n`);
  printHeader('Sources');
  printList(report.sources.map(formatKnowledgeSourceReportEntry), 'No knowledge sources selected.');
}

export function printKnowledgeExtractionReport(report: KnowledgeExtractionReport): void {
  printHeader('Knowledge extraction');
  process.stdout.write(`workspace: ${report.workspaceRoot}\n`);
  process.stdout.write(`knowledge cache: ${report.cacheRoot}\n`);
  process.stdout.write(`domains: ${report.requestedDomains.length > 0 ? report.requestedDomains.join(', ') : 'none'}\n`);
  process.stdout.write(`targets: ${report.targetPaths.length > 0 ? report.targetPaths.join(', ') : 'all'}\n`);
  process.stdout.write(`summary: sources=${report.sourceCount}, factSets=${report.factSetCount}, facts=${report.factCount}, unitSets=${report.unitSetCount}, units=${report.unitCount}, skipped=${report.skippedSourceCount}\n\n`);
  printHeader('Sources');
  printList(report.sources.map(formatKnowledgeExtractionSourceResult), 'No knowledge sources selected.');
}

export function printKnowledgeValidationReport(report: KnowledgeValidationReport): void {
  printHeader('Knowledge validation');
  process.stdout.write(`input: ${report.inputPath}\n`);
  if (report.workspaceRoot !== undefined) {
    process.stdout.write(`workspace: ${report.workspaceRoot}\n`);
  }
  process.stdout.write(`kind: ${report.inputKind ?? 'unknown'}\n`);
  process.stdout.write(`valid: ${report.valid ? 'yes' : 'no'}\n`);
  const unitSummary = report.unitCount !== undefined
    ? `, units=${report.unitCount}${report.unitSetCount !== undefined ? `, unitSets=${report.unitSetCount}` : ''}`
    : '';
  process.stdout.write(`summary: factSets=${report.factSetCount}, facts=${report.factCount}${unitSummary}, issues=${report.issueCount}, staleSources=${report.staleSourceCount}, uncheckedLocalSources=${report.uncheckedLocalSourceCount}\n\n`);
  printHeader('Source freshness');
  printList([
    ...report.freshness.staleSources.map(formatKnowledgeStaleSource),
    ...report.freshness.uncheckedLocalSources.map(formatKnowledgeUncheckedSource)
  ], 'No stale or unchecked local knowledge sources.');
  process.stdout.write('\n');

  printHeader('Issues');
  printList(report.issues.map(issue => `${issue.severity} ${issue.path}: ${issue.message}`), 'No knowledge validation issues.');
}

export function printKnowledgePack(pack: KnowledgePack): void {
  const uncheckedSourceCount = pack.sources.filter(source => source.freshness === 'unchecked').length;

  printHeader('Knowledge pack');
  process.stdout.write(`pack: ${pack.packId}\n`);
  process.stdout.write(`workspace: ${pack.workspaceRoot}\n`);
  process.stdout.write(`knowledge cache: ${pack.cacheRoot}\n`);
  process.stdout.write(`domains: ${pack.requestedDomains.length > 0 ? pack.requestedDomains.join(', ') : 'none'}\n`);
  process.stdout.write(`targets: ${pack.targetPaths.length > 0 ? pack.targetPaths.join(', ') : 'all'}\n`);
  process.stdout.write(`summary: sources=${pack.sourceCount}, factSets=${pack.factSetCount}, facts=${pack.includedFactCount}/${pack.factCount}, units=${pack.includedUnitCount}/${pack.unitCount}, maxUnits=${pack.maxUnits ?? pack.maxFacts}, omitted=${pack.omittedFactCount}, omittedUnits=${pack.omittedUnitCount}, staleSources=${pack.staleSourceCount}, uncheckedSources=${uncheckedSourceCount}\n`);
  process.stdout.write(`storage: public-reference=${pack.storagePolicy.publicReference}, workspace-private=${pack.storagePolicy.workspacePrivate}, shareable=${pack.storagePolicy.shareableByDefault}, opt-in=${pack.storagePolicy.explicitOptInRequired}\n\n`);
  printHeader('Facts');
  printList(pack.facts.map(fact => `${fact.confidence} ${fact.kind} ${fact.path}: ${fact.summary}`), 'No knowledge facts included.');
}

export function printKnowledgeSharedArtifactPublishReport(
  report: SharedKnowledgeArtifactPublishReport
): void {
  printHeader('Knowledge shared artifact publish');
  process.stdout.write(`mode: ${report.executionMode}\n`);
  process.stdout.write(`workspace: ${report.workspaceRoot}\n`);
  process.stdout.write(`artifact: ${report.artifact.sourceName}\n`);
  process.stdout.write(`source kind: ${report.artifact.sourceKind}\n`);
  process.stdout.write(`units: ${report.artifact.unitCount}\n`);
  process.stdout.write(`privacy scopes: ${report.artifact.privacyScopes.join(', ') || 'none'}\n`);
  process.stdout.write(`stored: ${report.artifact.registryPath}\n`);
  process.stdout.write(`sha256: ${report.artifact.sha256}\n`);
  process.stdout.write(`registry: ${report.registry.path}\n`);
  process.stdout.write(`registry entries: ${report.registry.entryCount}\n`);
  process.stdout.write(`updated existing entry: ${report.registry.updatedExistingEntry ? 'yes' : 'no'}\n`);
  process.stdout.write(`domain: ${report.entry.domain}\n`);
  process.stdout.write(`target: ${report.entry.targetPath ?? 'all'}\n`);
  if (report.warnings.length > 0) {
    process.stdout.write('\n');
    printHeader('Warnings');
    printList(report.warnings);
  }
}

function formatKnowledgeUnitIndexEntry(entry: KnowledgeUnitIndexEntry): string {
  const identity = [
    entry.domain,
    entry.targetPath,
    entry.sourceKind,
    entry.sourceName,
    entry.provider,
    entry.packageName,
    entry.chart,
    entry.module,
    entry.version
  ].filter(value => value !== undefined && value.length > 0).join(' ');
  const unitCounts = Object.entries(entry.unitCounts)
    .filter(([, count]) => count > 0)
    .map(([unitType, count]) => `${unitType}=${count}`)
    .join(', ') || 'none';

  return `${identity}: units=${entry.includedUnitCount}, omitted=${entry.omittedUnitCount ?? 'unknown'}, keys=${entry.retrievalKeys.length}, counts=${unitCounts}`;
}

export function printKnowledgeUnitMetadataIndex(index: KnowledgeUnitMetadataIndex): void {
  printHeader('Knowledge unit index');
  process.stdout.write(`pack: ${index.packId}\n`);
  process.stdout.write(`summary: sources=${index.sourceCount}, includedUnits=${index.includedUnitCount}, omittedUnits=${index.omittedUnitCount}\n\n`);
  printHeader('Sources');
  printList(index.entries.map(formatKnowledgeUnitIndexEntry), 'No knowledge unit index entries.');
}

function formatGraphCounts(counts: Record<string, number | undefined>): string {
  return Object.entries(counts)
    .filter(([, count]) => typeof count === 'number' && count > 0)
    .map(([kind, count]) => `${kind}=${count}`)
    .join(', ') || 'none';
}

function compactGraphRef(id: string): string {
  if (id.startsWith('terraform-resource:')) {
    return id.slice('terraform-resource:'.length);
  }

  if (id.startsWith('pulumi-resource:')) {
    const urn = id.slice('pulumi-resource:'.length);
    const parts = urn.split('::');
    if (parts.length >= 2) {
      return `pulumi:${parts[parts.length - 2]}::${parts[parts.length - 1]}`;
    }
    return urn;
  }

  return id;
}

function formatPossibleRename(edge: InfraGraph['edges'][number]): string {
  const score = typeof edge.metadata?.score === 'number' ? ` score=${edge.metadata.score}` : '';
  const keys = typeof edge.metadata?.matchingIdentityKeys === 'string'
    && edge.metadata.matchingIdentityKeys.length > 0
    ? ` keys=${edge.metadata.matchingIdentityKeys}`
    : '';
  return `${compactGraphRef(edge.from)} -> ${compactGraphRef(edge.to)} [${edge.confidence}]${score}${keys}`;
}

function formatReplacementCascade(edge: InfraGraph['edges'][number]): string {
  const dependencyAction = typeof edge.metadata?.dependencyAction === 'string' ? edge.metadata.dependencyAction : 'changed';
  const dependentAction = typeof edge.metadata?.dependentAction === 'string' ? edge.metadata.dependentAction : 'changed';
  const replacementReasons = typeof edge.metadata?.dependencyReplacementReasons === 'string'
    && edge.metadata.dependencyReplacementReasons.length > 0
    ? ` reason=${edge.metadata.dependencyReplacementReasons}`
    : '';
  return `${compactGraphRef(edge.from)} -> ${compactGraphRef(edge.to)} [${edge.confidence}] ${dependencyAction} -> ${dependentAction}${replacementReasons}`;
}

function impactCount(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeGraphImpactSummary(
  graph: InfraGraph,
  fallbackImpactCounts: Pick<GraphImpactSummary, 'createBeforeDeleteConflicts' | 'dependencyEdges' | 'plannedChanges' | 'possibleRenames' | 'replacementCascades'>
): GraphImpactSummary {
  const existing = graph.summary.impact as Partial<GraphImpactSummary> | undefined;
  const counts = {
    dependencyEdges: impactCount(existing?.dependencyEdges, fallbackImpactCounts.dependencyEdges),
    createBeforeDeleteConflicts: impactCount(existing?.createBeforeDeleteConflicts, fallbackImpactCounts.createBeforeDeleteConflicts),
    plannedChanges: impactCount(existing?.plannedChanges, fallbackImpactCounts.plannedChanges),
    possibleRenames: impactCount(existing?.possibleRenames, fallbackImpactCounts.possibleRenames),
    replacementCascades: impactCount(existing?.replacementCascades, fallbackImpactCounts.replacementCascades)
  };
  const inferredPosture = inferInfraGraphImpactPosture({
    ...counts,
    replacementActions: graph.summary.changesByAction?.replace ?? 0
  });
  const inferredReviewTargets = buildInfraGraphImpactReviewTargets(graph.edges);
  const inferredTotalReviewTargets = countInfraGraphImpactReviewTargets(graph.edges);
  const inferredOmittedReviewTargets = Math.max(0, inferredTotalReviewTargets - inferredReviewTargets.length);
  const existingBudget = existing?.reviewTargetBudget;
  const reviewTargets = normalizeInfraGraphImpactReviewTargets(existing?.reviewTargets, inferredReviewTargets);
  const omittedReviewTargets = impactCount(existing?.omittedReviewTargets, inferredOmittedReviewTargets);

  return {
    ...counts,
    mutationAllowed: INFRA_GRAPH_IMPACT_MUTATION_ALLOWED,
    omittedReviewTargets,
    reviewTargetBudget: {
      maxTargets: impactCount(existingBudget?.maxTargets, INFRA_GRAPH_IMPACT_REVIEW_TARGET_LIMIT),
      totalTargets: impactCount(existingBudget?.totalTargets, inferredTotalReviewTargets),
      includedTargets: impactCount(existingBudget?.includedTargets, reviewTargets.length),
      omittedTargets: impactCount(existingBudget?.omittedTargets, omittedReviewTargets)
    },
    primaryConcern: isInfraGraphImpactPrimaryConcern(existing?.primaryConcern)
      ? existing.primaryConcern
      : inferredPosture.primaryConcern,
    recommendedAction: isInfraGraphImpactRecommendedAction(existing?.recommendedAction)
      ? existing.recommendedAction
      : inferredPosture.recommendedAction,
    reviewSteps: normalizeInfraGraphImpactReviewSteps(existing?.reviewSteps, inferredPosture.reviewSteps),
    reviewTargets,
    riskLevel: isInfraGraphImpactRiskLevel(existing?.riskLevel)
      ? existing.riskLevel
      : inferredPosture.riskLevel
  };
}

export function summarizeInfraGraphImpact(graph: InfraGraph): string[] {
  const fallbackImpactCounts = {
    dependencyEdges: graph.edges.filter(edge => edge.kind === 'depends-on').length,
    createBeforeDeleteConflicts: graph.edges.filter(edge => edge.kind === 'create-before-delete-conflict').length,
    plannedChanges: graph.edges.filter(edge => edge.kind === 'planned-change').length,
    possibleRenames: graph.edges.filter(edge => edge.kind === 'possible-rename').length,
    replacementCascades: graph.edges.filter(edge => edge.kind === 'replacement-cascade').length
  };
  const impact = normalizeGraphImpactSummary(graph, fallbackImpactCounts);
  const possibleRenames = graph.edges.filter(edge => edge.kind === 'possible-rename');
  const replacementCascades = graph.edges.filter(edge => edge.kind === 'replacement-cascade');
  const createBeforeDeleteConflicts = graph.edges.filter(edge => edge.kind === 'create-before-delete-conflict');
  const lines = [
    `risk=${impact.riskLevel}, primary concern=${impact.primaryConcern}, recommended action=${impact.recommendedAction}, mutation allowed=${impact.mutationAllowed}, review targets=${impact.reviewTargets.length}, omitted review targets=${impact.omittedReviewTargets}, review target budget=${impact.reviewTargetBudget.includedTargets}/${impact.reviewTargetBudget.totalTargets} included max=${impact.reviewTargetBudget.maxTargets}, planned changes=${impact.plannedChanges}, dependencies=${impact.dependencyEdges}, possible renames=${impact.possibleRenames}, replacement cascades=${impact.replacementCascades}, create-before-delete conflicts=${impact.createBeforeDeleteConflicts}`
  ];

  lines.push(...impact.reviewSteps.map(step => `review step: ${step}`));

  lines.push(...possibleRenames.slice(0, 5).map(edge => `possible rename: ${formatPossibleRename(edge)}`));
  if (possibleRenames.length > 5) {
    lines.push(`possible rename: ${possibleRenames.length - 5} more`);
  }

  lines.push(...replacementCascades.slice(0, 5).map(edge => `replacement cascade: ${formatReplacementCascade(edge)}`));
  if (replacementCascades.length > 5) {
    lines.push(`replacement cascade: ${replacementCascades.length - 5} more`);
  }

  lines.push(...createBeforeDeleteConflicts.slice(0, 5).map(edge =>
    `create-before-delete conflict: ${compactGraphRef(edge.from)} -> ${compactGraphRef(edge.to)} [${edge.confidence}] ${edge.metadata?.reason ?? 'review replacement ordering'}`
  ));
  if (createBeforeDeleteConflicts.length > 5) {
    lines.push(`create-before-delete conflict: ${createBeforeDeleteConflicts.length - 5} more`);
  }

  return lines;
}

export function printInfraGraph(graph: InfraGraph): void {
  printHeader('Infrastructure graph');
  process.stdout.write(`workspace: ${graph.workspaceRoot}\n`);
  process.stdout.write('mutation allowed: no\n');
  process.stdout.write(`nodes: ${graph.summary.nodeCount}\n`);
  process.stdout.write(`edges: ${graph.summary.edgeCount}\n`);
  process.stdout.write(`node kinds: ${formatGraphCounts(graph.summary.nodesByKind)}\n`);
  process.stdout.write(`edge kinds: ${formatGraphCounts(graph.summary.edgesByKind)}\n\n`);
  if (graph.summary.sourceProvenance) {
    process.stdout.write(`sources: ${graph.summary.sourceProvenance.sources.map(source => `${source.source}=${source.nodeCount} nodes/${source.edgeCount} edges`).join(', ') || 'none'}\n\n`);
  }
  if (graph.summary.changesByAction) {
    process.stdout.write(`changes: ${formatGraphCounts(graph.summary.changesByAction)}\n\n`);
  }

  printHeader('Impact');
  printList(summarizeInfraGraphImpact(graph), 'No graph impact detected.');
  process.stdout.write('\n');
  printHeader('Nodes');
  printList(graph.nodes.map(node => {
    const action = typeof node.metadata?.action === 'string' ? ` [${node.metadata.action}]` : '';
    return `${node.kind} ${node.id}${node.path ? ` (${node.path})` : ''}${action}`;
  }), 'No graph nodes detected.');
  process.stdout.write('\n');
  printHeader('Edges');
  printList(graph.edges.map(edge => `${edge.kind} ${edge.from} -> ${edge.to}`), 'No graph edges detected.');
}

export function printChangedContextReport(report: ChangedContextReport): void {
  printHeader('Changed Context');
  process.stdout.write(`workspace: ${report.workspaceRoot}\n`);
  process.stdout.write('mutation allowed: no\n');
  process.stdout.write(`source: ${report.comparison.source}\n`);
  if (report.comparison.base) {
    process.stdout.write(`base: ${report.comparison.base}\n`);
  }
  if (report.comparison.head) {
    process.stdout.write(`head: ${report.comparison.head}\n`);
  }
  process.stdout.write(`changed files: ${report.summary.changedFileCount}\n`);
  process.stdout.write(`affected components: ${report.summary.affectedComponentCount}\n`);
  process.stdout.write(`domains: ${report.summary.domains.join(', ') || 'none'}\n`);
  process.stdout.write(`risk: ${report.summary.riskLevel}\n`);
  process.stdout.write(`recommended action: ${report.summary.recommendedAction}\n\n`);

  printHeader('Affected Components');
  printList(report.affectedComponents.map(component => {
    const hints = component.riskHints.length > 0 ? ` risk=${component.riskHints.join('; ')}` : '';
    return `${component.domain} ${component.kind} ${component.targetPath} (${component.changedFiles.length} changed file(s))${hints}`;
  }), 'No affected infrastructure components detected.');
  process.stdout.write('\n');

  printHeader('Suggested Inspection Files');
  printList(Array.from(new Set(report.affectedComponents.flatMap(component => component.suggestedInspectFiles))), 'No inspection files suggested.');
  process.stdout.write('\n');

  printHeader('Changed Files');
  printList(report.changedFiles.map(file => {
    const previous = file.previousPath ? ` from ${file.previousPath}` : '';
    return `${file.status ?? 'unknown'} ${file.path}${previous}`;
  }), 'No changed files detected.');
  process.stdout.write('\n');

  printHeader('Unmapped Files');
  printList(report.omitted.unmappedFiles.map(file => {
    const previous = file.previousPath ? ` from ${file.previousPath}` : '';
    return `${file.status ?? 'unknown'} ${file.path}${previous}`;
  }), 'No unmapped files.');
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
  process.stdout.write(
    `approved tool categories: ${state.approval.approvedToolCategories.length > 0 ? state.approval.approvedToolCategories.join(', ') : 'none'}\n`
  );
  process.stdout.write('\n');

  printHeader('Effective Approval Policy');
  process.stdout.write(
    `required write risks: ${state.effectiveApprovalPolicy.requiredWriteRisks.length > 0 ? state.effectiveApprovalPolicy.requiredWriteRisks.join(', ') : 'none'}\n`
  );
  process.stdout.write(
    `required tool categories: ${state.effectiveApprovalPolicy.requiredToolCategories.length > 0 ? state.effectiveApprovalPolicy.requiredToolCategories.join(', ') : 'none'}\n`
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
    summarizeFocusedDomainCapabilities(state.inspection.domainCapabilities, state.requestedDomains),
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
  printHeader('Validator Availability');
  printList(
    state.validation.validators.map(validator => `${validator.name}: ${validator.available ? validator.resolvedPath : 'missing'}`),
    'No validators configured.'
  );
  process.stdout.write('\n');
  process.stdout.write(`workspace config validation: ${state.validation.usedWorkspaceConfig ? 'enabled' : 'disabled'}\n\n`);
  printHeader('Validation Plan');
  printList(
    summarizeFocusedValidationPlan(state.validation.plan, state.requestedDomains),
    'No validation targets detected.'
  );
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
  process.stdout.write(`repair attempts: ${state.runtime.repairAttempts}/${getAgentMaxRepairAttempts(state)}\n`);
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

        if (toolResult.toolName === 'validate_yaml_syntax') {
          const output = toolResult.output as { path: string; parser: string; result: { exitCode: number; stderr: string } };
          printList(
            [`${output.path} parsed with ${output.parser} -> exit ${output.result.exitCode}${output.result.stderr ? `: ${output.result.stderr.slice(0, 160)}` : ''}`],
            'No YAML syntax validation output available.'
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
    state.runtime.approvalSignals.map(signal => `${signal.kind} ${formatApprovalSignal(signal)}: ${signal.message}`),
    'No approval signals recorded.'
  );

  process.stdout.write('\n\n');
  printRunPreflight(state.preflight);
}

export function printIdentityConflictIncidentReport(report: IdentityConflictIncidentReport): void {
  printHeader('Identity Conflict Incident Report');
  process.stdout.write(`source schema: ${report.sourceKind}@${report.sourceSchemaVersion}\n`);
  process.stdout.write(`source task: ${report.sourceTask}\n`);
  process.stdout.write(`workspace: ${report.workspaceRoot}\n`);
  process.stdout.write(`outcome: ${report.outcome}\n`);
  process.stdout.write('mutation allowed: no\n');
  process.stdout.write(`incidents: ${report.incidentCount}\n`);
  process.stdout.write(`incident sample: ${report.incidentSummary.includedCount}/${report.incidentSummary.totalCount} included; ${report.omittedIncidentCount} omitted; max ${report.incidentSummary.maxEntries}\n`);
  process.stdout.write(`engine counts: ${formatGraphCounts(report.incidentSummary.byEngine)}\n`);
  process.stdout.write(`risk counts: ${formatGraphCounts(report.incidentSummary.byRiskCategory)}\n\n`);

  printHeader('Summary');
  printList(report.summary, 'No runtime exclusive-identity incidents found.');

  for (let index = 0; index < report.incidents.length; index += 1) {
    const incident = report.incidents[index];
    process.stdout.write('\n');
    printHeader(`Incident ${index + 1}`);
    process.stdout.write(`engine: ${incident.engine}\n`);
    process.stdout.write(`issue: ${incident.issueKind}\n`);
    process.stdout.write(`conflict: ${incident.conflictCode ?? 'unknown'} (${incident.conflictLabel ?? incident.conflictFamily ?? 'unknown family'})\n`);
    process.stdout.write(`resource: ${incident.resourceLocator ?? 'unknown locator'}${incident.resourceType ? ` type=${incident.resourceType}` : ''}\n`);
    process.stdout.write(`identity: ${formatIdentityConflictFields(incident.identity)}\n`);
    process.stdout.write(`risk category: ${incident.riskCategory}\n`);
    process.stdout.write('mutation allowed: no\n');
    process.stdout.write(`source command: ${incident.sourceCommand}\n`);
    if (incident.suggestedAction) {
      process.stdout.write(`provider rule: ${incident.suggestedAction}\n`);
    }
    printList(incident.reviewSteps, 'No review steps available.');
  }
}

export function printInfraGraphImpactReport(report: InfraGraphImpactReport): void {
  printHeader('Graph Impact Report');
  process.stdout.write(`source schema: ${report.sourceKind}@${report.sourceSchemaVersion}\n`);
  process.stdout.write(`workspace: ${report.workspaceRoot}\n`);
  process.stdout.write(`risk: ${report.riskLevel}\n`);
  process.stdout.write(`primary concern: ${report.primaryConcern}\n`);
  process.stdout.write(`recommended action: ${report.recommendedAction}\n`);
  process.stdout.write('mutation allowed: no\n');
  process.stdout.write(`review targets: ${report.reviewTargetCount}\n`);
  process.stdout.write(`omitted review targets: ${report.omittedReviewTargetCount}\n`);
  process.stdout.write(`review target budget: ${report.reviewTargetBudget.includedTargets}/${report.reviewTargetBudget.totalTargets} included; ${report.reviewTargetBudget.omittedTargets} omitted; max ${report.reviewTargetBudget.maxTargets}\n\n`);

  printHeader('Counts');
  process.stdout.write(`planned changes: ${report.counts.plannedChanges}\n`);
  process.stdout.write(`dependencies: ${report.counts.dependencyEdges}\n`);
  process.stdout.write(`possible renames: ${report.counts.possibleRenames}\n`);
  process.stdout.write(`replacement cascades: ${report.counts.replacementCascades}\n`);
  process.stdout.write(`create-before-delete conflicts: ${report.counts.createBeforeDeleteConflicts}\n\n`);

  printHeader('Source Provenance');
  process.stdout.write(`workspace inspection: ${report.sourceProvenance.hasWorkspaceInspection ? 'yes' : 'no'}\n`);
  process.stdout.write(`terraform plan: ${report.sourceProvenance.hasTerraformPlan ? 'yes' : 'no'}\n`);
  process.stdout.write(`pulumi preview: ${report.sourceProvenance.hasPulumiPreview ? 'yes' : 'no'}\n`);
  printList(
    report.sourceProvenance.sources.map(source =>
      `${source.source}: ${source.nodeCount} node(s), ${source.edgeCount} edge(s)`
    ),
    'No graph source provenance recorded.'
  );
  process.stdout.write('\n');

  printHeader('Summary');
  printList(report.summary, 'No graph impact detected.');

  for (let index = 0; index < report.reviewTargets.length; index += 1) {
    const target = report.reviewTargets[index];
    process.stdout.write('\n');
    printHeader(`Review Target ${index + 1}`);
    process.stdout.write(`kind: ${target.kind}\n`);
    process.stdout.write(`edge: ${target.edgeId}\n`);
    process.stdout.write(`priority: ${target.priority}\n`);
    process.stdout.write(`from: ${target.from}\n`);
    process.stdout.write(`to: ${target.to}\n`);
    process.stdout.write(`risk category: ${target.riskCategory}\n`);
    process.stdout.write(`recommended action: ${target.recommendedAction}\n`);
    process.stdout.write('mutation allowed: no\n');
    printList(target.reviewSteps, 'No review steps available.');
  }
}
