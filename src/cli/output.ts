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
import type {
  KnowledgeTeamPublicationPlan,
  KnowledgeTeamPublicationReadinessReport
} from '../knowledge/team-artifact-store.ts';
import type { KnowledgeTeamBackendReadinessReport } from '../knowledge/team-backend-readiness.ts';
import type { KnowledgeTeamS3CompatibleReferenceValidationSummary } from '../knowledge/team-s3-compatible-reference-registry.ts';
import type { KnowledgeTeamUploadAdapterPreflight } from '../knowledge/team-upload-adapter-preflight.ts';
import type { KnowledgeTeamUploadApprovalContinuation } from '../knowledge/team-upload-approval-continuation.ts';
import type { KnowledgeTeamUploadApprovalIntent } from '../knowledge/team-upload-approval-intent.ts';
import type { KnowledgeTeamUploadExecutionGate } from '../knowledge/team-upload-execution-gate.ts';
import type { KnowledgeTeamUploadExecutionPrerequisitePlan } from '../knowledge/team-upload-execution-prerequisite-plan.ts';
import type { KnowledgeTeamUploadMockHarness } from '../knowledge/team-upload-mock-harness.ts';
import type { KnowledgeTeamUploadMutationApprovalReview } from '../knowledge/team-upload-mutation-approval-review.ts';
import type { KnowledgeTeamUploadMutationPlan } from '../knowledge/team-upload-mutation-plan.ts';
import type { KnowledgeTeamUploadWriteTokenBoundary } from '../knowledge/team-upload-write-token-boundary.ts';
import type { KnowledgeTeamUploadExecutionLeaseBoundary } from '../knowledge/team-upload-execution-lease-boundary.ts';
import type { KnowledgeTeamUploadRollbackPlanBoundary } from '../knowledge/team-upload-rollback-plan-boundary.ts';
import type { KnowledgeTeamUploadAuditRecordBoundary } from '../knowledge/team-upload-audit-record-boundary.ts';
import type { KnowledgeTeamUploadArtifactBytesBoundary } from '../knowledge/team-upload-artifact-bytes-boundary.ts';
import type { KnowledgeTeamUploadAdapterInjectionBoundary } from '../knowledge/team-upload-adapter-injection-boundary.ts';
import type { KnowledgeTeamUploadClientCreationBoundary } from '../knowledge/team-upload-client-creation-boundary.ts';
import type { KnowledgeTeamUploadCredentialReadBoundary } from '../knowledge/team-upload-credential-read-boundary.ts';
import type { KnowledgeTeamUploadCredentialPresenceBoundary } from '../knowledge/team-upload-credential-presence-boundary.ts';
import type { KnowledgeTeamUploadLiveCheckBoundary } from '../knowledge/team-upload-live-check-boundary.ts';
import type { KnowledgeTeamUploadCommandBoundary } from '../knowledge/team-upload-command-boundary.ts';
import type { KnowledgeTeamUploadObjectIndexBindingBoundary } from '../knowledge/team-upload-object-index-binding-boundary.ts';
import type { KnowledgeTeamUploadExecutionReadinessBoundary } from '../knowledge/team-upload-execution-readiness-boundary.ts';
import type { KnowledgeTeamUploadExecutionApprovalRequest } from '../knowledge/team-upload-execution-approval-request.ts';
import type { KnowledgeTeamUploadExecutionApprovalRecord } from '../knowledge/team-upload-execution-approval-record.ts';
import type { KnowledgeTeamUploadExecutionAuthorizationBoundary } from '../knowledge/team-upload-execution-authorization-boundary.ts';
import type { KnowledgeTeamUploadExecutionPlanRulesReview } from '../knowledge/team-upload-execution-plan-rules-review.ts';
import type { KnowledgeTeamUploadExecutionPlanRulesUpdateRecord } from '../knowledge/team-upload-execution-plan-rules-update-record.ts';
import type { KnowledgeTeamUploadExecutionImplementationBoundary } from '../knowledge/team-upload-execution-implementation-boundary.ts';
import type { KnowledgeTeamUploadExecutionRuntimeBoundaries } from '../knowledge/team-upload-execution-runtime-boundaries.ts';
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
  const message = result.message ? ` (${result.message})` : '';
  return `${result.status} ${result.domain} ${result.targetPath}: ${result.source.kind} ${result.source.name} (id=${result.id}${factLabel}, ${location})${message}`;
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
  return [
    `${summary.includedFactCount}/${summary.totalFactCount} fact(s) included`,
    `max ${summary.maxFacts}`,
    `omitted ${omittedSummary}`,
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
  process.stdout.write(`summary: sources=${report.sourceCount}, factSets=${report.factSetCount}, facts=${report.factCount}, skipped=${report.skippedSourceCount}\n\n`);
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
  process.stdout.write(`summary: factSets=${report.factSetCount}, facts=${report.factCount}, issues=${report.issueCount}, staleSources=${report.staleSourceCount}, uncheckedLocalSources=${report.uncheckedLocalSourceCount}\n\n`);
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
  process.stdout.write(`summary: sources=${pack.sourceCount}, factSets=${pack.factSetCount}, facts=${pack.includedFactCount}/${pack.factCount}, omitted=${pack.omittedFactCount}, staleSources=${pack.staleSourceCount}, uncheckedSources=${uncheckedSourceCount}\n`);
  process.stdout.write(`storage: public-reference=${pack.storagePolicy.publicReference}, workspace-private=${pack.storagePolicy.workspacePrivate}, shareable=${pack.storagePolicy.shareableByDefault}, opt-in=${pack.storagePolicy.explicitOptInRequired}\n\n`);
  printHeader('Facts');
  printList(pack.facts.map(fact => `${fact.confidence} ${fact.kind} ${fact.path}: ${fact.summary}`), 'No knowledge facts included.');
}

export function printKnowledgeTeamPublicationPlan(plan: KnowledgeTeamPublicationPlan): void {
  printHeader('Knowledge team publication plan');
  process.stdout.write(`allowed: ${plan.publication.allowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution: ${plan.executionMode}\n`);
  process.stdout.write(`remote write: ${plan.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`backend: ${plan.plannedBackendKind}\n`);
  process.stdout.write(`object: ${plan.object.key}\n`);
  process.stdout.write(`artifact: ${plan.artifact.id}\n`);
  process.stdout.write(`summary: sources=${plan.artifact.sourceCount}, facts=${plan.artifact.factCount}, staleSources=${plan.artifact.staleSourceCount}, blockers=${plan.publication.blockerCount}\n`);
  process.stdout.write(`storage: public-reference=${plan.artifact.storagePolicy.publicReference}, workspace-private=${plan.artifact.storagePolicy.workspacePrivate}, shareable=${plan.artifact.storagePolicy.shareableByDefault}, opt-in=${plan.artifact.storagePolicy.explicitOptInRequired}\n\n`);
  printHeader('Blockers');
  printList(
    plan.publication.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No team publication blockers.'
  );
}

export function printKnowledgeTeamPublicationReadinessReport(report: KnowledgeTeamPublicationReadinessReport): void {
  printHeader('Knowledge team publication readiness');
  process.stdout.write(`status: ${report.readiness.status}\n`);
  process.stdout.write(`next action: ${report.readiness.nextAction}\n`);
  process.stdout.write(`publication allowed: ${report.publication.allowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution: ${report.executionMode}\n`);
  process.stdout.write(`remote write: ${report.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`backend: ${report.plannedBackendKind}\n`);
  process.stdout.write(`object: ${report.object.key}\n`);
  process.stdout.write(`artifact: ${report.artifact.id}\n`);
  process.stdout.write(`index entry: ${report.indexEntry.provided ? report.indexEntry.key : 'none'}\n`);
  process.stdout.write(`summary: sources=${report.artifact.sourceCount}, facts=${report.artifact.factCount}, staleSources=${report.artifact.staleSourceCount}, blockers=${report.readiness.blockerCount}\n`);
  process.stdout.write(`storage: public-reference=${report.artifact.storagePolicy.publicReference}, workspace-private=${report.artifact.storagePolicy.workspacePrivate}, shareable=${report.artifact.storagePolicy.shareableByDefault}, opt-in=${report.artifact.storagePolicy.explicitOptInRequired}\n\n`);
  printHeader('Blockers');
  printList(
    report.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No team publication readiness blockers.'
  );
}

export function printKnowledgeTeamBackendReadinessReport(report: KnowledgeTeamBackendReadinessReport): void {
  printHeader('Knowledge team backend readiness');
  process.stdout.write(`status: ${report.readiness.status}\n`);
  process.stdout.write(`next action: ${report.readiness.nextAction}\n`);
  process.stdout.write(`execution: ${report.executionMode}\n`);
  process.stdout.write(`remote write: ${report.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check: ${report.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${report.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`backend: ${report.backendKind}\n`);
  process.stdout.write(`config: ${report.config.name ?? 'invalid'}\n`);
  process.stdout.write(`artifact prefix: ${report.config.artifactPrefix ?? 'invalid'}\n`);
  process.stdout.write(`index prefix: ${report.config.indexPrefix ?? 'invalid'}\n`);
  process.stdout.write(`summary: blockers=${report.readiness.blockerCount}, objectStore=${report.capabilities.artifactObjectStore ? 'yes' : 'no'}, metadataIndex=${report.capabilities.metadataIndex ? 'yes' : 'no'}, dryRunOnly=${report.capabilities.dryRunOnly ? 'yes' : 'no'}\n\n`);
  printHeader('Blockers');
  printList(
    report.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No team backend readiness blockers.'
  );
}

export function printKnowledgeTeamS3CompatibleReferenceValidationSummary(
  summary: KnowledgeTeamS3CompatibleReferenceValidationSummary
): void {
  printHeader('Knowledge team backend reference readiness');
  process.stdout.write(`status: ${summary.status}\n`);
  process.stdout.write(`backend: ${summary.backendKind}\n`);
  process.stdout.write(`config: ${summary.configName ?? 'invalid'}\n`);
  process.stdout.write(`storage ref: ${summary.storageProfileRef ?? 'invalid'}\n`);
  process.stdout.write(`auth ref: ${summary.authProfileRef ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${summary.capabilities.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check: ${summary.capabilities.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${summary.capabilities.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${summary.capabilities.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`summary: requiredEnv=${summary.requiredEnvironmentVariables.length}, optionalEnv=${summary.optionalEnvironmentVariables.length}, blockers=${summary.issues.length}, dryRunOnly=${summary.capabilities.dryRunOnly ? 'yes' : 'no'}\n\n`);
  printHeader('Required environment names');
  printList(summary.requiredEnvironmentVariables, 'No required environment variable names.');
  process.stdout.write('\n');
  printHeader('Optional environment names');
  printList(summary.optionalEnvironmentVariables, 'No optional environment variable names.');
  process.stdout.write('\n');
  printHeader('Blockers');
  printList(
    summary.issues.map(issue => `${issue.code} ${issue.path}: ${issue.message}`),
    'No team backend reference readiness blockers.'
  );
}

export function printKnowledgeTeamUploadApprovalIntent(
  intent: KnowledgeTeamUploadApprovalIntent
): void {
  printHeader('Knowledge team upload approval intent');
  process.stdout.write(`status: ${intent.status}\n`);
  process.stdout.write(`next action: ${intent.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${intent.plannedOperation}\n`);
  process.stdout.write(`execution: ${intent.executionMode}\n`);
  process.stdout.write(`remote write: ${intent.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check: ${intent.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${intent.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${intent.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${intent.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`backend: ${intent.backendKind}\n`);
  process.stdout.write(`publication backend: ${intent.publicationBackendKind}\n`);
  process.stdout.write(`manifest: ${intent.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`object: ${intent.object.key ?? 'invalid'}\n`);
  process.stdout.write(`artifact: ${intent.artifact.id ?? 'invalid'}\n`);
  process.stdout.write(`approval fingerprint: ${intent.approvalFingerprint.value ?? 'unavailable'}\n`);
  process.stdout.write(`publication readiness: ${intent.preconditions.publicationReadiness.status ?? 'invalid'}\n`);
  process.stdout.write(`backend reference: ${intent.preconditions.backendReference.status ?? 'invalid'}\n`);
  process.stdout.write(`approval provided: ${intent.preconditions.uploadApproval.approvalProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: requiredEnv=${intent.preconditions.credentialBoundary.requiredEnvironmentVariables.length}, optionalEnv=${intent.preconditions.credentialBoundary.optionalEnvironmentVariables.length}, blockers=${intent.readiness.blockerCount}\n\n`);
  printHeader('Required environment names');
  printList(intent.preconditions.credentialBoundary.requiredEnvironmentVariables, 'No required environment variable names.');
  process.stdout.write('\n');
  printHeader('Optional environment names');
  printList(intent.preconditions.credentialBoundary.optionalEnvironmentVariables, 'No optional environment variable names.');
  process.stdout.write('\n');
  printHeader('Blockers');
  printList(
    intent.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload approval intent blockers.'
  );
}

export function printKnowledgeTeamUploadApprovalContinuation(
  continuation: KnowledgeTeamUploadApprovalContinuation
): void {
  printHeader('Knowledge team upload approval continuation');
  process.stdout.write(`status: ${continuation.status}\n`);
  process.stdout.write(`next action: ${continuation.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${continuation.plannedOperation}\n`);
  process.stdout.write(`execution: ${continuation.executionMode}\n`);
  process.stdout.write(`remote write: ${continuation.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check: ${continuation.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${continuation.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${continuation.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${continuation.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${continuation.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${continuation.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${continuation.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`backend: ${continuation.backendKind}\n`);
  process.stdout.write(`manifest: ${continuation.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`object: ${continuation.target.objectKey ?? 'invalid'}\n`);
  process.stdout.write(`artifact: ${continuation.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`approval provided: ${continuation.approval.provided ? 'yes' : 'no'}\n`);
  process.stdout.write(`fingerprint verified: ${continuation.approval.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`expected fingerprint: ${continuation.approval.expectedFingerprint ?? 'unavailable'}\n`);
  process.stdout.write(`adapter injected: ${continuation.adapterBoundary.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`real backend implemented: ${continuation.adapterBoundary.realBackendImplemented ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: requiredEnv=${continuation.credentialBoundary.requiredEnvironmentVariableCount}, optionalEnv=${continuation.credentialBoundary.optionalEnvironmentVariableCount}, blockers=${continuation.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    continuation.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload approval continuation blockers.'
  );
}

export function printKnowledgeTeamUploadAdapterPreflight(
  preflight: KnowledgeTeamUploadAdapterPreflight
): void {
  printHeader('Knowledge team upload adapter preflight');
  process.stdout.write(`status: ${preflight.status}\n`);
  process.stdout.write(`next action: ${preflight.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${preflight.plannedOperation}\n`);
  process.stdout.write(`execution: ${preflight.executionMode}\n`);
  process.stdout.write(`remote write: ${preflight.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check: ${preflight.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${preflight.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${preflight.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${preflight.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${preflight.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${preflight.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${preflight.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${preflight.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`continuation: ${preflight.continuation.status}\n`);
  process.stdout.write(`fingerprint verified: ${preflight.continuation.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter source: ${preflight.adapterDependency.source}\n`);
  process.stdout.write(`adapter backend: ${preflight.adapterDependency.backendKind}\n`);
  process.stdout.write(`adapter name: ${preflight.adapterDependency.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`adapter resolution: ${preflight.adapterDependency.resolutionStatus}\n`);
  process.stdout.write(`injection candidate: ${preflight.adapterDependency.injectionCandidate ? 'yes' : 'no'}\n`);
  process.stdout.write(`real backend implemented: ${preflight.adapterDependency.realBackendImplemented ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: artifactObjectStore=${preflight.adapterDependency.artifactObjectStore ? 'yes' : 'no'}, metadataIndex=${preflight.adapterDependency.metadataIndex ? 'yes' : 'no'}, blockers=${preflight.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    preflight.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload adapter preflight blockers.'
  );
}

export function printKnowledgeTeamUploadMockHarness(
  harness: KnowledgeTeamUploadMockHarness
): void {
  printHeader('Knowledge team upload mock harness');
  process.stdout.write(`status: ${harness.status}\n`);
  process.stdout.write(`next action: ${harness.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${harness.plannedOperation}\n`);
  process.stdout.write(`execution: ${harness.executionMode}\n`);
  process.stdout.write(`harness: ${harness.harnessKind}\n`);
  process.stdout.write(`remote write: ${harness.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check: ${harness.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${harness.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${harness.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${harness.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${harness.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${harness.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${harness.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`mock adapter instantiated: ${harness.mockAdapterInstantiated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${harness.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${harness.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${harness.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${harness.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`preflight: ${harness.preflight.status}\n`);
  process.stdout.write(`adapter backend: ${harness.preflight.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${harness.preflight.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`injection candidate: ${harness.preflight.injectionCandidate ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter factory: ${harness.mockHarness.adapterFactory}\n`);
  process.stdout.write(`descriptor matched: ${harness.mockHarness.descriptorMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact object store available: ${harness.mockHarness.artifactObjectStoreAvailable ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index available: ${harness.mockHarness.metadataIndexAvailable ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: mockAdapter=${harness.mockAdapterInstantiated ? 'yes' : 'no'}, objectWrite=${harness.mockHarness.objectWriteAttempted ? 'yes' : 'no'}, indexWrite=${harness.mockHarness.indexWriteAttempted ? 'yes' : 'no'}, blockers=${harness.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    harness.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload mock harness blockers.'
  );
}

export function printKnowledgeTeamUploadExecutionGate(
  gate: KnowledgeTeamUploadExecutionGate
): void {
  printHeader('Knowledge team upload execution gate');
  process.stdout.write(`status: ${gate.status}\n`);
  process.stdout.write(`next action: ${gate.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${gate.plannedOperation}\n`);
  process.stdout.write(`execution: ${gate.executionMode}\n`);
  process.stdout.write(`gate: ${gate.gateKind}\n`);
  process.stdout.write(`remote write: ${gate.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check: ${gate.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${gate.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${gate.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${gate.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${gate.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${gate.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${gate.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${gate.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${gate.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${gate.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${gate.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${gate.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${gate.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`continuation: ${gate.approvalGate.continuationStatus}\n`);
  process.stdout.write(`approval provided: ${gate.approvalGate.approvalProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`fingerprint verified: ${gate.approvalGate.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval required: ${gate.approvalGate.mutationApprovalRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${gate.approvalGate.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`scope matched: ${gate.approvalGate.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`mock harness: ${gate.mockHarness.status}\n`);
  process.stdout.write(`harness kind: ${gate.mockHarness.harnessKind}\n`);
  process.stdout.write(`mock adapter instantiated: ${gate.mockHarness.mockAdapterInstantiated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${gate.mockHarness.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${gate.mockHarness.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`descriptor matched: ${gate.mockHarness.descriptorMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${gate.executionBoundary.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injection reviewed: ${gate.executionBoundary.adapterInjectionReviewed ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan required: ${gate.executionBoundary.rollbackPlanRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record required: ${gate.executionBoundary.auditRecordRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command generated: ${gate.executionBoundary.uploadCommandGenerated ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: mutationApproval=${gate.approvalGate.mutationApprovalGranted ? 'yes' : 'no'}, writeToken=${gate.writeTokenIssued ? 'yes' : 'no'}, lease=${gate.executionLeaseCreated ? 'yes' : 'no'}, objectWrite=${gate.objectWriteAttempted ? 'yes' : 'no'}, blockers=${gate.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    gate.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload execution gate blockers.'
  );
}

export function printKnowledgeTeamUploadMutationPlan(
  plan: KnowledgeTeamUploadMutationPlan
): void {
  printHeader('Knowledge team upload mutation plan');
  process.stdout.write(`status: ${plan.status}\n`);
  process.stdout.write(`next action: ${plan.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${plan.plannedOperation}\n`);
  process.stdout.write(`execution: ${plan.executionMode}\n`);
  process.stdout.write(`plan: ${plan.planKind}\n`);
  process.stdout.write(`remote write: ${plan.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check: ${plan.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${plan.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${plan.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${plan.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${plan.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${plan.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${plan.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${plan.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${plan.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${plan.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${plan.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${plan.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${plan.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${plan.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${plan.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${plan.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source gate: ${plan.sourceGate.gateStatus}\n`);
  process.stdout.write(`source gate action: ${plan.sourceGate.gateNextAction}\n`);
  process.stdout.write(`scope matched: ${plan.sourceGate.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`continuation: ${plan.sourceGate.continuationStatus}\n`);
  process.stdout.write(`approval provided: ${plan.sourceGate.approvalProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`fingerprint verified: ${plan.sourceGate.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`mock harness: ${plan.sourceGate.mockHarnessStatus}\n`);
  process.stdout.write(`harness kind: ${plan.sourceGate.mockHarnessKind}\n`);
  process.stdout.write(`mock adapter instantiated: ${plan.sourceGate.mockAdapterInstantiated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${plan.sourceGate.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${plan.sourceGate.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`mutation approval required: ${plan.approvalAudit.mutationApprovalRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`human approval request issued: ${plan.approvalAudit.humanApprovalRequestIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`approval fingerprint: ${plan.approvalAudit.approvalScopeFingerprint.value ?? 'unavailable'}\n`);
  process.stdout.write(`executable: ${plan.executionPlan.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`dry run only: ${plan.executionPlan.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes required before execution: ${plan.executionPlan.artifactBytesRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token required before execution: ${plan.executionPlan.writeTokenRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease required before execution: ${plan.executionPlan.executionLeaseRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan required: ${plan.executionPlan.rollbackPlanRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record required: ${plan.executionPlan.auditRecordRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: mutationApproval=${plan.mutationApprovalGranted ? 'yes' : 'no'}, executable=${plan.executionPlan.executable ? 'yes' : 'no'}, writeToken=${plan.writeTokenIssued ? 'yes' : 'no'}, lease=${plan.executionLeaseCreated ? 'yes' : 'no'}, blockers=${plan.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    plan.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload mutation plan blockers.'
  );
}

export function printKnowledgeTeamUploadMutationApprovalReview(
  review: KnowledgeTeamUploadMutationApprovalReview
): void {
  printHeader('Knowledge team upload mutation approval review');
  process.stdout.write(`status: ${review.status}\n`);
  process.stdout.write(`next action: ${review.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${review.plannedOperation}\n`);
  process.stdout.write(`execution: ${review.executionMode}\n`);
  process.stdout.write(`review: ${review.reviewKind}\n`);
  process.stdout.write(`remote write: ${review.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check: ${review.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${review.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${review.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${review.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${review.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${review.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${review.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${review.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${review.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${review.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${review.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${review.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${review.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${review.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${review.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${review.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source plan: ${review.sourcePlan.planStatus}\n`);
  process.stdout.write(`source plan action: ${review.sourcePlan.planNextAction}\n`);
  process.stdout.write(`source gate: ${review.sourcePlan.gateStatus}\n`);
  process.stdout.write(`scope matched: ${review.sourcePlan.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`source fingerprint verified: ${review.sourcePlan.sourceFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`mock harness: ${review.sourcePlan.mockHarnessStatus}\n`);
  process.stdout.write(`adapter backend: ${review.sourcePlan.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${review.sourcePlan.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`expected fingerprint: ${review.approvalReview.expectedFingerprint ?? 'unavailable'}\n`);
  process.stdout.write(`supplied fingerprint: ${review.approvalReview.suppliedFingerprint ?? 'unavailable'}\n`);
  process.stdout.write(`human review recorded: ${review.approvalReview.humanReviewRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`fingerprint verified: ${review.approvalReview.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`executable: ${review.executionBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`dry run only: ${review.executionBoundary.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: reviewRecorded=${review.approvalReview.humanReviewRecorded ? 'yes' : 'no'}, mutationApproval=${review.mutationApprovalGranted ? 'yes' : 'no'}, executable=${review.executionBoundary.executable ? 'yes' : 'no'}, writeToken=${review.writeTokenIssued ? 'yes' : 'no'}, lease=${review.executionLeaseCreated ? 'yes' : 'no'}, blockers=${review.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    review.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload mutation approval review blockers.'
  );
}

export function printKnowledgeTeamUploadExecutionPrerequisitePlan(
  plan: KnowledgeTeamUploadExecutionPrerequisitePlan
): void {
  printHeader('Knowledge team upload execution prerequisite plan');
  process.stdout.write(`status: ${plan.status}\n`);
  process.stdout.write(`next action: ${plan.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${plan.plannedOperation}\n`);
  process.stdout.write(`execution: ${plan.executionMode}\n`);
  process.stdout.write(`prerequisite plan: ${plan.prerequisitePlanKind}\n`);
  process.stdout.write(`remote write: ${plan.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check: ${plan.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${plan.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${plan.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${plan.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${plan.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${plan.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${plan.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${plan.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${plan.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${plan.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${plan.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${plan.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${plan.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${plan.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${plan.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${plan.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${plan.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source review: ${plan.sourceReview.reviewStatus}\n`);
  process.stdout.write(`source review action: ${plan.sourceReview.reviewNextAction}\n`);
  process.stdout.write(`source plan: ${plan.sourceReview.planStatus}\n`);
  process.stdout.write(`source gate: ${plan.sourceReview.gateStatus}\n`);
  process.stdout.write(`scope matched: ${plan.sourceReview.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`human review recorded: ${plan.sourceReview.humanReviewRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`fingerprint verified: ${plan.sourceReview.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source fingerprint verified: ${plan.sourceReview.sourceFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${plan.sourceReview.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${plan.sourceReview.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`artifact bytes required before execution: ${plan.executionBoundary.artifactBytesRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injection required before execution: ${plan.executionBoundary.adapterInjectionRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token required before execution: ${plan.executionBoundary.writeTokenRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease required before execution: ${plan.executionBoundary.executionLeaseRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan required before execution: ${plan.executionBoundary.rollbackPlanRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record required before execution: ${plan.executionBoundary.auditRecordRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`executable: ${plan.executionBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`dry run only: ${plan.executionBoundary.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: reviewRecorded=${plan.prerequisitePlan.humanReviewRecorded ? 'yes' : 'no'}, mutationApproval=${plan.mutationApprovalGranted ? 'yes' : 'no'}, executable=${plan.executionBoundary.executable ? 'yes' : 'no'}, writeToken=${plan.writeTokenIssued ? 'yes' : 'no'}, lease=${plan.executionLeaseCreated ? 'yes' : 'no'}, blockers=${plan.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    plan.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload execution prerequisite plan blockers.'
  );
}

export function printKnowledgeTeamUploadWriteTokenBoundary(
  boundary: KnowledgeTeamUploadWriteTokenBoundary
): void {
  printHeader('Knowledge team upload write-token boundary');
  process.stdout.write(`status: ${boundary.status}\n`);
  process.stdout.write(`next action: ${boundary.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${boundary.plannedOperation}\n`);
  process.stdout.write(`execution: ${boundary.executionMode}\n`);
  process.stdout.write(`boundary: ${boundary.boundaryKind}\n`);
  process.stdout.write(`remote write: ${boundary.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check: ${boundary.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${boundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${boundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${boundary.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${boundary.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${boundary.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${boundary.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${boundary.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${boundary.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${boundary.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${boundary.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${boundary.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${boundary.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${boundary.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${boundary.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${boundary.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${boundary.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source prerequisite: ${boundary.sourcePrerequisitePlan.prerequisiteStatus}\n`);
  process.stdout.write(`source prerequisite action: ${boundary.sourcePrerequisitePlan.prerequisiteNextAction}\n`);
  process.stdout.write(`source review: ${boundary.sourcePrerequisitePlan.reviewStatus}\n`);
  process.stdout.write(`scope matched: ${boundary.sourcePrerequisitePlan.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`human review recorded: ${boundary.sourcePrerequisitePlan.humanReviewRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`fingerprint verified: ${boundary.sourcePrerequisitePlan.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source fingerprint verified: ${boundary.sourcePrerequisitePlan.sourceFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${boundary.sourcePrerequisitePlan.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${boundary.sourcePrerequisitePlan.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`token required before execution: ${boundary.writeTokenBoundary.tokenRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`token issued: ${boundary.writeTokenBoundary.tokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`token scope binding required: ${boundary.writeTokenBoundary.tokenScopeBindingRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`token scope bound to artifact: ${boundary.writeTokenBoundary.tokenScopeBoundToArtifact ? 'yes' : 'no'}\n`);
  process.stdout.write(`single-use token required: ${boundary.writeTokenBoundary.tokenSingleUseRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`token expiry required: ${boundary.writeTokenBoundary.tokenExpiryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`token expiry set: ${boundary.writeTokenBoundary.tokenExpirySet ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit binding required: ${boundary.writeTokenBoundary.auditBindingRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease required before issuance: ${boundary.writeTokenBoundary.executionLeaseRequiredBeforeIssuance ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan required before issuance: ${boundary.writeTokenBoundary.rollbackPlanRequiredBeforeIssuance ? 'yes' : 'no'}\n`);
  process.stdout.write(`executable: ${boundary.writeTokenBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`dry run only: ${boundary.writeTokenBoundary.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: tokenIssued=${boundary.writeTokenBoundary.tokenIssued ? 'yes' : 'no'}, tokenScopeBound=${boundary.writeTokenBoundary.tokenScopeBoundToArtifact ? 'yes' : 'no'}, lease=${boundary.executionLeaseCreated ? 'yes' : 'no'}, objectWrite=${boundary.objectWriteAttempted ? 'yes' : 'no'}, blockers=${boundary.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    boundary.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload write-token boundary blockers.'
  );
}

export function printKnowledgeTeamUploadExecutionLeaseBoundary(
  boundary: KnowledgeTeamUploadExecutionLeaseBoundary
): void {
  printHeader('Knowledge team upload execution lease boundary');
  process.stdout.write(`status: ${boundary.status}\n`);
  process.stdout.write(`next action: ${boundary.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${boundary.plannedOperation}\n`);
  process.stdout.write(`execution: ${boundary.executionMode}\n`);
  process.stdout.write(`boundary: ${boundary.boundaryKind}\n`);
  process.stdout.write(`target manifest: ${boundary.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`target object: ${boundary.target.objectKey}\n`);
  process.stdout.write(`target artifact: ${boundary.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${boundary.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check: ${boundary.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${boundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${boundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${boundary.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${boundary.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${boundary.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${boundary.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${boundary.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${boundary.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${boundary.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${boundary.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${boundary.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${boundary.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${boundary.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${boundary.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${boundary.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${boundary.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source write-token boundary: ${boundary.sourceWriteTokenBoundary.boundaryStatus}\n`);
  process.stdout.write(`source write-token action: ${boundary.sourceWriteTokenBoundary.boundaryNextAction}\n`);
  process.stdout.write(`source review: ${boundary.sourceWriteTokenBoundary.reviewStatus}\n`);
  process.stdout.write(`scope matched: ${boundary.sourceWriteTokenBoundary.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`human review recorded: ${boundary.sourceWriteTokenBoundary.humanReviewRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`fingerprint verified: ${boundary.sourceWriteTokenBoundary.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source fingerprint verified: ${boundary.sourceWriteTokenBoundary.sourceFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${boundary.sourceWriteTokenBoundary.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${boundary.sourceWriteTokenBoundary.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`token required before execution: ${boundary.sourceWriteTokenBoundary.tokenRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`token scope binding required: ${boundary.sourceWriteTokenBoundary.tokenScopeBindingRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`single-use token required: ${boundary.sourceWriteTokenBoundary.tokenSingleUseRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`token expiry required: ${boundary.sourceWriteTokenBoundary.tokenExpiryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`source audit binding required: ${boundary.sourceWriteTokenBoundary.auditBindingRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`lease required before execution: ${boundary.executionLeaseBoundary.executionLeaseRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`lease created: ${boundary.executionLeaseBoundary.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`lease scope binding required: ${boundary.executionLeaseBoundary.leaseScopeBindingRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`lease scope bound to artifact: ${boundary.executionLeaseBoundary.leaseScopeBoundToArtifact ? 'yes' : 'no'}\n`);
  process.stdout.write(`single-use lease required: ${boundary.executionLeaseBoundary.leaseSingleUseRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`single-use lease created: ${boundary.executionLeaseBoundary.singleUseLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`lease expiry required: ${boundary.executionLeaseBoundary.leaseExpiryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`lease expiry set: ${boundary.executionLeaseBoundary.leaseExpirySet ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token required before lease: ${boundary.executionLeaseBoundary.writeTokenRequiredBeforeLease ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit binding required: ${boundary.executionLeaseBoundary.auditBindingRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit binding created: ${boundary.executionLeaseBoundary.auditBindingCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan required before execution: ${boundary.executionLeaseBoundary.rollbackPlanRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`dry run only: ${boundary.executionLeaseBoundary.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`executable: ${boundary.executionLeaseBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: leaseCreated=${boundary.executionLeaseBoundary.executionLeaseCreated ? 'yes' : 'no'}, leaseScopeBound=${boundary.executionLeaseBoundary.leaseScopeBoundToArtifact ? 'yes' : 'no'}, tokenIssued=${boundary.writeTokenIssued ? 'yes' : 'no'}, rollback=${boundary.rollbackPlanCreated ? 'yes' : 'no'}, blockers=${boundary.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    boundary.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload execution lease boundary blockers.'
  );
}

export function printKnowledgeTeamUploadRollbackPlanBoundary(
  boundary: KnowledgeTeamUploadRollbackPlanBoundary
): void {
  printHeader('Knowledge team upload rollback plan boundary');
  process.stdout.write(`status: ${boundary.status}\n`);
  process.stdout.write(`next action: ${boundary.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${boundary.plannedOperation}\n`);
  process.stdout.write(`execution: ${boundary.executionMode}\n`);
  process.stdout.write(`boundary: ${boundary.boundaryKind}\n`);
  process.stdout.write(`target manifest: ${boundary.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`target object: ${boundary.target.objectKey}\n`);
  process.stdout.write(`target artifact: ${boundary.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${boundary.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check: ${boundary.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${boundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${boundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${boundary.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${boundary.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${boundary.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${boundary.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${boundary.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${boundary.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${boundary.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${boundary.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${boundary.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${boundary.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${boundary.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${boundary.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${boundary.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${boundary.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source execution lease boundary: ${boundary.sourceExecutionLeaseBoundary.boundaryStatus}\n`);
  process.stdout.write(`source execution lease action: ${boundary.sourceExecutionLeaseBoundary.boundaryNextAction}\n`);
  process.stdout.write(`source review: ${boundary.sourceExecutionLeaseBoundary.reviewStatus}\n`);
  process.stdout.write(`scope matched: ${boundary.sourceExecutionLeaseBoundary.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`human review recorded: ${boundary.sourceExecutionLeaseBoundary.humanReviewRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`fingerprint verified: ${boundary.sourceExecutionLeaseBoundary.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source fingerprint verified: ${boundary.sourceExecutionLeaseBoundary.sourceFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${boundary.sourceExecutionLeaseBoundary.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${boundary.sourceExecutionLeaseBoundary.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`token required before execution: ${boundary.sourceExecutionLeaseBoundary.tokenRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`lease required before execution: ${boundary.sourceExecutionLeaseBoundary.executionLeaseRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan required before execution: ${boundary.sourceExecutionLeaseBoundary.rollbackPlanRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan required: ${boundary.rollbackPlanBoundary.rollbackPlanRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${boundary.rollbackPlanBoundary.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback scope binding required: ${boundary.rollbackPlanBoundary.rollbackScopeBindingRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback scope bound to artifact: ${boundary.rollbackPlanBoundary.rollbackScopeBoundToArtifact ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback review required: ${boundary.rollbackPlanBoundary.rollbackReviewRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback reviewed: ${boundary.rollbackPlanBoundary.rollbackReviewed ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token required before rollback: ${boundary.rollbackPlanBoundary.writeTokenRequiredBeforeRollback ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease required before rollback: ${boundary.rollbackPlanBoundary.executionLeaseRequiredBeforeRollback ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes required before rollback: ${boundary.rollbackPlanBoundary.artifactBytesRequiredBeforeRollback ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record required before execution: ${boundary.rollbackPlanBoundary.auditRecordRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`dry run only: ${boundary.rollbackPlanBoundary.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`executable: ${boundary.rollbackPlanBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: rollbackCreated=${boundary.rollbackPlanBoundary.rollbackPlanCreated ? 'yes' : 'no'}, rollbackScopeBound=${boundary.rollbackPlanBoundary.rollbackScopeBoundToArtifact ? 'yes' : 'no'}, tokenIssued=${boundary.writeTokenIssued ? 'yes' : 'no'}, leaseCreated=${boundary.executionLeaseCreated ? 'yes' : 'no'}, blockers=${boundary.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    boundary.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload rollback plan boundary blockers.'
  );
}

export function printKnowledgeTeamUploadAuditRecordBoundary(
  boundary: KnowledgeTeamUploadAuditRecordBoundary
): void {
  printHeader('Knowledge team upload audit record boundary');
  process.stdout.write(`status: ${boundary.status}\n`);
  process.stdout.write(`next action: ${boundary.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${boundary.plannedOperation}\n`);
  process.stdout.write(`execution: ${boundary.executionMode}\n`);
  process.stdout.write(`boundary: ${boundary.boundaryKind}\n`);
  process.stdout.write(`target manifest: ${boundary.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`target object: ${boundary.target.objectKey}\n`);
  process.stdout.write(`target artifact: ${boundary.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${boundary.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check: ${boundary.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${boundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${boundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${boundary.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${boundary.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${boundary.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${boundary.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${boundary.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${boundary.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${boundary.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${boundary.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${boundary.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${boundary.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${boundary.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${boundary.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${boundary.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${boundary.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source rollback plan boundary: ${boundary.sourceRollbackPlanBoundary.boundaryStatus}\n`);
  process.stdout.write(`source rollback plan action: ${boundary.sourceRollbackPlanBoundary.boundaryNextAction}\n`);
  process.stdout.write(`source review: ${boundary.sourceRollbackPlanBoundary.reviewStatus}\n`);
  process.stdout.write(`scope matched: ${boundary.sourceRollbackPlanBoundary.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`human review recorded: ${boundary.sourceRollbackPlanBoundary.humanReviewRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`fingerprint verified: ${boundary.sourceRollbackPlanBoundary.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source fingerprint verified: ${boundary.sourceRollbackPlanBoundary.sourceFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${boundary.sourceRollbackPlanBoundary.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${boundary.sourceRollbackPlanBoundary.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`token required before execution: ${boundary.sourceRollbackPlanBoundary.tokenRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`lease required before execution: ${boundary.sourceRollbackPlanBoundary.executionLeaseRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan required before execution: ${boundary.sourceRollbackPlanBoundary.rollbackPlanRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback scope binding required: ${boundary.sourceRollbackPlanBoundary.rollbackScopeBindingRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback review required: ${boundary.sourceRollbackPlanBoundary.rollbackReviewRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record required before execution: ${boundary.sourceRollbackPlanBoundary.auditRecordRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record required: ${boundary.auditRecordBoundary.auditRecordRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${boundary.auditRecordBoundary.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit scope binding required: ${boundary.auditRecordBoundary.auditScopeBindingRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit scope bound to artifact: ${boundary.auditRecordBoundary.auditScopeBoundToArtifact ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit review required: ${boundary.auditRecordBoundary.auditReviewRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit reviewed: ${boundary.auditRecordBoundary.auditReviewed ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token required before audit: ${boundary.auditRecordBoundary.writeTokenRequiredBeforeAudit ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease required before audit: ${boundary.auditRecordBoundary.executionLeaseRequiredBeforeAudit ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan required before audit: ${boundary.auditRecordBoundary.rollbackPlanRequiredBeforeAudit ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes required before audit: ${boundary.auditRecordBoundary.artifactBytesRequiredBeforeAudit ? 'yes' : 'no'}\n`);
  process.stdout.write(`dry run only: ${boundary.auditRecordBoundary.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`executable: ${boundary.auditRecordBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: auditCreated=${boundary.auditRecordBoundary.auditRecordCreated ? 'yes' : 'no'}, auditScopeBound=${boundary.auditRecordBoundary.auditScopeBoundToArtifact ? 'yes' : 'no'}, rollbackCreated=${boundary.rollbackPlanCreated ? 'yes' : 'no'}, tokenIssued=${boundary.writeTokenIssued ? 'yes' : 'no'}, blockers=${boundary.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    boundary.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload audit record boundary blockers.'
  );
}

export function printKnowledgeTeamUploadArtifactBytesBoundary(
  boundary: KnowledgeTeamUploadArtifactBytesBoundary
): void {
  printHeader('Knowledge team upload artifact bytes boundary');
  process.stdout.write(`status: ${boundary.status}\n`);
  process.stdout.write(`next action: ${boundary.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${boundary.plannedOperation}\n`);
  process.stdout.write(`execution: ${boundary.executionMode}\n`);
  process.stdout.write(`boundary: ${boundary.boundaryKind}\n`);
  process.stdout.write(`target manifest: ${boundary.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`target object: ${boundary.target.objectKey}\n`);
  process.stdout.write(`target artifact: ${boundary.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${boundary.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check: ${boundary.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${boundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${boundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${boundary.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${boundary.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${boundary.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${boundary.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${boundary.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${boundary.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${boundary.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${boundary.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${boundary.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${boundary.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${boundary.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${boundary.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${boundary.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${boundary.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source audit record boundary: ${boundary.sourceAuditRecordBoundary.boundaryStatus}\n`);
  process.stdout.write(`source audit record action: ${boundary.sourceAuditRecordBoundary.boundaryNextAction}\n`);
  process.stdout.write(`source review: ${boundary.sourceAuditRecordBoundary.reviewStatus}\n`);
  process.stdout.write(`scope matched: ${boundary.sourceAuditRecordBoundary.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`human review recorded: ${boundary.sourceAuditRecordBoundary.humanReviewRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`fingerprint verified: ${boundary.sourceAuditRecordBoundary.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source fingerprint verified: ${boundary.sourceAuditRecordBoundary.sourceFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${boundary.sourceAuditRecordBoundary.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${boundary.sourceAuditRecordBoundary.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`token required before execution: ${boundary.sourceAuditRecordBoundary.tokenRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`lease required before execution: ${boundary.sourceAuditRecordBoundary.executionLeaseRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan required before execution: ${boundary.sourceAuditRecordBoundary.rollbackPlanRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record required before execution: ${boundary.sourceAuditRecordBoundary.auditRecordRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit scope binding required: ${boundary.sourceAuditRecordBoundary.auditScopeBindingRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit review required: ${boundary.sourceAuditRecordBoundary.auditReviewRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes required before audit: ${boundary.sourceAuditRecordBoundary.artifactBytesRequiredBeforeAudit ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes required before adapter: ${boundary.artifactBytesBoundary.artifactBytesRequiredBeforeAdapter ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes required before execution: ${boundary.artifactBytesBoundary.artifactBytesRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact digest required: ${boundary.artifactBytesBoundary.artifactDigestRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact digest verified: ${boundary.artifactBytesBoundary.artifactDigestVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact scope binding required: ${boundary.artifactBytesBoundary.artifactScopeBindingRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact scope bound to artifact: ${boundary.artifactBytesBoundary.artifactScopeBoundToArtifact ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record required before bytes: ${boundary.artifactBytesBoundary.auditRecordRequiredBeforeBytes ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token required before bytes: ${boundary.artifactBytesBoundary.writeTokenRequiredBeforeBytes ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease required before bytes: ${boundary.artifactBytesBoundary.executionLeaseRequiredBeforeBytes ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan required before bytes: ${boundary.artifactBytesBoundary.rollbackPlanRequiredBeforeBytes ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injection required after bytes: ${boundary.artifactBytesBoundary.adapterInjectionRequiredAfterBytes ? 'yes' : 'no'}\n`);
  process.stdout.write(`dry run only: ${boundary.artifactBytesBoundary.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`executable: ${boundary.artifactBytesBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: artifactBytesProvided=${boundary.artifactBytesBoundary.artifactBytesProvided ? 'yes' : 'no'}, artifactDigestVerified=${boundary.artifactBytesBoundary.artifactDigestVerified ? 'yes' : 'no'}, adapterInjected=${boundary.adapterInjected ? 'yes' : 'no'}, auditCreated=${boundary.auditRecordCreated ? 'yes' : 'no'}, blockers=${boundary.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    boundary.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload artifact bytes boundary blockers.'
  );
}

export function printKnowledgeTeamUploadAdapterInjectionBoundary(
  boundary: KnowledgeTeamUploadAdapterInjectionBoundary
): void {
  printHeader('Knowledge team upload adapter injection boundary');
  process.stdout.write(`status: ${boundary.status}\n`);
  process.stdout.write(`next action: ${boundary.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${boundary.plannedOperation}\n`);
  process.stdout.write(`execution: ${boundary.executionMode}\n`);
  process.stdout.write(`boundary: ${boundary.boundaryKind}\n`);
  process.stdout.write(`target manifest: ${boundary.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`target object: ${boundary.target.objectKey}\n`);
  process.stdout.write(`target artifact: ${boundary.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${boundary.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check: ${boundary.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${boundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${boundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${boundary.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${boundary.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${boundary.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${boundary.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${boundary.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${boundary.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${boundary.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${boundary.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${boundary.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${boundary.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${boundary.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${boundary.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${boundary.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${boundary.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source artifact bytes boundary: ${boundary.sourceArtifactBytesBoundary.boundaryStatus}\n`);
  process.stdout.write(`source artifact bytes action: ${boundary.sourceArtifactBytesBoundary.boundaryNextAction}\n`);
  process.stdout.write(`source review: ${boundary.sourceArtifactBytesBoundary.reviewStatus}\n`);
  process.stdout.write(`scope matched: ${boundary.sourceArtifactBytesBoundary.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`human review recorded: ${boundary.sourceArtifactBytesBoundary.humanReviewRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`fingerprint verified: ${boundary.sourceArtifactBytesBoundary.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source fingerprint verified: ${boundary.sourceArtifactBytesBoundary.sourceFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${boundary.sourceArtifactBytesBoundary.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${boundary.sourceArtifactBytesBoundary.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`artifact bytes required before adapter: ${boundary.sourceArtifactBytesBoundary.artifactBytesRequiredBeforeAdapter ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${boundary.sourceArtifactBytesBoundary.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact digest required: ${boundary.sourceArtifactBytesBoundary.artifactDigestRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact digest verified: ${boundary.sourceArtifactBytesBoundary.artifactDigestVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injection required after bytes: ${boundary.sourceArtifactBytesBoundary.adapterInjectionRequiredAfterBytes ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter dependency injection only: ${boundary.adapterInjectionBoundary.adapterDependencyInjectionOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`mock adapter required: ${boundary.adapterInjectionBoundary.mockAdapterRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter descriptor required: ${boundary.adapterInjectionBoundary.adapterDescriptorRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact object store dependency required: ${boundary.adapterInjectionBoundary.artifactObjectStoreDependencyRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index dependency required: ${boundary.adapterInjectionBoundary.metadataIndexDependencyRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact object store bound: ${boundary.adapterInjectionBoundary.artifactObjectStoreBound ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index bound: ${boundary.adapterInjectionBoundary.metadataIndexBound ? 'yes' : 'no'}\n`);
  process.stdout.write(`client creation required: ${boundary.remainingExecutionBoundaries.clientCreationRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`dry run only: ${boundary.adapterInjectionBoundary.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`executable: ${boundary.adapterInjectionBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: adapterInjected=${boundary.adapterInjectionBoundary.adapterInjected ? 'yes' : 'no'}, clientCreated=${boundary.adapterInjectionBoundary.clientCreated ? 'yes' : 'no'}, objectStoreBound=${boundary.adapterInjectionBoundary.artifactObjectStoreBound ? 'yes' : 'no'}, metadataIndexBound=${boundary.adapterInjectionBoundary.metadataIndexBound ? 'yes' : 'no'}, blockers=${boundary.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    boundary.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload adapter injection boundary blockers.'
  );
}

export function printKnowledgeTeamUploadClientCreationBoundary(
  boundary: KnowledgeTeamUploadClientCreationBoundary
): void {
  printHeader('Knowledge team upload client creation boundary');
  process.stdout.write(`status: ${boundary.status}\n`);
  process.stdout.write(`next action: ${boundary.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${boundary.plannedOperation}\n`);
  process.stdout.write(`execution: ${boundary.executionMode}\n`);
  process.stdout.write(`boundary: ${boundary.boundaryKind}\n`);
  process.stdout.write(`target manifest: ${boundary.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`target object: ${boundary.target.objectKey}\n`);
  process.stdout.write(`target artifact: ${boundary.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${boundary.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check: ${boundary.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${boundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${boundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${boundary.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${boundary.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${boundary.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${boundary.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${boundary.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${boundary.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${boundary.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${boundary.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${boundary.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${boundary.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${boundary.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${boundary.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${boundary.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${boundary.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source adapter injection boundary: ${boundary.sourceAdapterInjectionBoundary.boundaryStatus}\n`);
  process.stdout.write(`source adapter injection action: ${boundary.sourceAdapterInjectionBoundary.boundaryNextAction}\n`);
  process.stdout.write(`source review: ${boundary.sourceAdapterInjectionBoundary.reviewStatus}\n`);
  process.stdout.write(`scope matched: ${boundary.sourceAdapterInjectionBoundary.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`human review recorded: ${boundary.sourceAdapterInjectionBoundary.humanReviewRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`fingerprint verified: ${boundary.sourceAdapterInjectionBoundary.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source fingerprint verified: ${boundary.sourceAdapterInjectionBoundary.sourceFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${boundary.sourceAdapterInjectionBoundary.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${boundary.sourceAdapterInjectionBoundary.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`adapter dependency injection only: ${boundary.sourceAdapterInjectionBoundary.adapterDependencyInjectionOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`mock adapter required: ${boundary.sourceAdapterInjectionBoundary.mockAdapterRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter descriptor required: ${boundary.sourceAdapterInjectionBoundary.adapterDescriptorRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact object store dependency required: ${boundary.sourceAdapterInjectionBoundary.artifactObjectStoreDependencyRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index dependency required: ${boundary.sourceAdapterInjectionBoundary.metadataIndexDependencyRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`source adapter injected: ${boundary.sourceAdapterInjectionBoundary.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`source client created: ${boundary.sourceAdapterInjectionBoundary.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`source artifact object store bound: ${boundary.sourceAdapterInjectionBoundary.artifactObjectStoreBound ? 'yes' : 'no'}\n`);
  process.stdout.write(`source metadata index bound: ${boundary.sourceAdapterInjectionBoundary.metadataIndexBound ? 'yes' : 'no'}\n`);
  process.stdout.write(`client creation required before execution: ${boundary.clientCreationBoundary.clientCreationRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`client factory descriptor required: ${boundary.clientCreationBoundary.clientFactoryDescriptorRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential read boundary required: ${boundary.clientCreationBoundary.credentialReadBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence boundary required: ${boundary.clientCreationBoundary.credentialPresenceBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check boundary required: ${boundary.clientCreationBoundary.liveCheckBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command boundary required: ${boundary.clientCreationBoundary.uploadCommandBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`SDK client created: ${boundary.clientCreationBoundary.sdkClientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential read required: ${boundary.remainingExecutionBoundaries.credentialReadRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence check required: ${boundary.remainingExecutionBoundaries.credentialPresenceCheckRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check required: ${boundary.remainingExecutionBoundaries.liveCheckRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command required: ${boundary.remainingExecutionBoundaries.uploadCommandRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`dry run only: ${boundary.clientCreationBoundary.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`executable: ${boundary.clientCreationBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: clientCreated=${boundary.clientCreationBoundary.clientCreated ? 'yes' : 'no'}, sdkClientCreated=${boundary.clientCreationBoundary.sdkClientCreated ? 'yes' : 'no'}, credentialValuesExposed=${boundary.clientCreationBoundary.credentialValuesExposed ? 'yes' : 'no'}, liveCheckPerformed=${boundary.clientCreationBoundary.liveCheckPerformed ? 'yes' : 'no'}, blockers=${boundary.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    boundary.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload client creation boundary blockers.'
  );
}

export function printKnowledgeTeamUploadCredentialReadBoundary(
  boundary: KnowledgeTeamUploadCredentialReadBoundary
): void {
  printHeader('Knowledge team upload credential read boundary');
  process.stdout.write(`status: ${boundary.status}\n`);
  process.stdout.write(`next action: ${boundary.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${boundary.plannedOperation}\n`);
  process.stdout.write(`execution: ${boundary.executionMode}\n`);
  process.stdout.write(`boundary: ${boundary.boundaryKind}\n`);
  process.stdout.write(`target manifest: ${boundary.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`target object: ${boundary.target.objectKey}\n`);
  process.stdout.write(`target artifact: ${boundary.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${boundary.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check: ${boundary.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${boundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${boundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${boundary.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${boundary.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${boundary.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${boundary.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${boundary.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${boundary.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${boundary.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${boundary.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${boundary.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${boundary.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${boundary.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${boundary.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${boundary.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${boundary.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source client creation boundary: ${boundary.sourceClientCreationBoundary.boundaryStatus}\n`);
  process.stdout.write(`source client creation action: ${boundary.sourceClientCreationBoundary.boundaryNextAction}\n`);
  process.stdout.write(`source review: ${boundary.sourceClientCreationBoundary.reviewStatus}\n`);
  process.stdout.write(`scope matched: ${boundary.sourceClientCreationBoundary.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`human review recorded: ${boundary.sourceClientCreationBoundary.humanReviewRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`fingerprint verified: ${boundary.sourceClientCreationBoundary.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source fingerprint verified: ${boundary.sourceClientCreationBoundary.sourceFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${boundary.sourceClientCreationBoundary.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${boundary.sourceClientCreationBoundary.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`source client factory descriptor required: ${boundary.sourceClientCreationBoundary.clientFactoryDescriptorRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`source credential read required: ${boundary.sourceClientCreationBoundary.credentialReadBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`source client created: ${boundary.sourceClientCreationBoundary.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`source SDK client created: ${boundary.sourceClientCreationBoundary.sdkClientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`source credential values exposed: ${boundary.sourceClientCreationBoundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`source credential presence checked: ${boundary.sourceClientCreationBoundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential source descriptor required: ${boundary.credentialReadBoundary.credentialSourceDescriptorRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential reference only required: ${boundary.credentialReadBoundary.credentialReferenceOnlyRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential value redaction required: ${boundary.credentialReadBoundary.credentialValueRedactionRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values read: ${boundary.credentialReadBoundary.credentialValuesRead ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${boundary.credentialReadBoundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${boundary.credentialReadBoundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence boundary required: ${boundary.credentialReadBoundary.credentialPresenceBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check boundary required: ${boundary.credentialReadBoundary.liveCheckBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command boundary required: ${boundary.credentialReadBoundary.uploadCommandBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential read required: ${boundary.remainingExecutionBoundaries.credentialReadRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence check required: ${boundary.remainingExecutionBoundaries.credentialPresenceCheckRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check required: ${boundary.remainingExecutionBoundaries.liveCheckRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command required: ${boundary.remainingExecutionBoundaries.uploadCommandRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`dry run only: ${boundary.credentialReadBoundary.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`executable: ${boundary.credentialReadBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: credentialValuesRead=${boundary.credentialReadBoundary.credentialValuesRead ? 'yes' : 'no'}, credentialValuesExposed=${boundary.credentialReadBoundary.credentialValuesExposed ? 'yes' : 'no'}, credentialPresenceChecked=${boundary.credentialReadBoundary.credentialPresenceChecked ? 'yes' : 'no'}, liveCheckPerformed=${boundary.credentialReadBoundary.liveCheckPerformed ? 'yes' : 'no'}, blockers=${boundary.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    boundary.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload credential read boundary blockers.'
  );
}

export function printKnowledgeTeamUploadCredentialPresenceBoundary(
  boundary: KnowledgeTeamUploadCredentialPresenceBoundary
): void {
  printHeader('Knowledge team upload credential presence boundary');
  process.stdout.write(`status: ${boundary.status}\n`);
  process.stdout.write(`next action: ${boundary.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${boundary.plannedOperation}\n`);
  process.stdout.write(`execution: ${boundary.executionMode}\n`);
  process.stdout.write(`boundary: ${boundary.boundaryKind}\n`);
  process.stdout.write(`target manifest: ${boundary.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`target object: ${boundary.target.objectKey}\n`);
  process.stdout.write(`target artifact: ${boundary.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${boundary.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check: ${boundary.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${boundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${boundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${boundary.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${boundary.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${boundary.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${boundary.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${boundary.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${boundary.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${boundary.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${boundary.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${boundary.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${boundary.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${boundary.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${boundary.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${boundary.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${boundary.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source credential read boundary: ${boundary.sourceCredentialReadBoundary.boundaryStatus}\n`);
  process.stdout.write(`source credential read action: ${boundary.sourceCredentialReadBoundary.boundaryNextAction}\n`);
  process.stdout.write(`source review: ${boundary.sourceCredentialReadBoundary.reviewStatus}\n`);
  process.stdout.write(`scope matched: ${boundary.sourceCredentialReadBoundary.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`human review recorded: ${boundary.sourceCredentialReadBoundary.humanReviewRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`fingerprint verified: ${boundary.sourceCredentialReadBoundary.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source fingerprint verified: ${boundary.sourceCredentialReadBoundary.sourceFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${boundary.sourceCredentialReadBoundary.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${boundary.sourceCredentialReadBoundary.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`source credential values read: ${boundary.sourceCredentialReadBoundary.credentialValuesRead ? 'yes' : 'no'}\n`);
  process.stdout.write(`source credential values exposed: ${boundary.sourceCredentialReadBoundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`source credential presence checked: ${boundary.sourceCredentialReadBoundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence signal required: ${boundary.credentialPresenceBoundary.credentialPresenceSignalRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence result redaction required: ${boundary.credentialPresenceBoundary.credentialPresenceResultRedactionRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values read: ${boundary.credentialPresenceBoundary.credentialValuesRead ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${boundary.credentialPresenceBoundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${boundary.credentialPresenceBoundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence result exposed: ${boundary.credentialPresenceBoundary.credentialPresenceResultExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check boundary required: ${boundary.credentialPresenceBoundary.liveCheckBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command boundary required: ${boundary.credentialPresenceBoundary.uploadCommandBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential read required: ${boundary.remainingExecutionBoundaries.credentialReadRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence check required: ${boundary.remainingExecutionBoundaries.credentialPresenceCheckRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check required: ${boundary.remainingExecutionBoundaries.liveCheckRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command required: ${boundary.remainingExecutionBoundaries.uploadCommandRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`dry run only: ${boundary.credentialPresenceBoundary.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`executable: ${boundary.credentialPresenceBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: credentialValuesRead=${boundary.credentialPresenceBoundary.credentialValuesRead ? 'yes' : 'no'}, credentialValuesExposed=${boundary.credentialPresenceBoundary.credentialValuesExposed ? 'yes' : 'no'}, credentialPresenceChecked=${boundary.credentialPresenceBoundary.credentialPresenceChecked ? 'yes' : 'no'}, liveCheckPerformed=${boundary.credentialPresenceBoundary.liveCheckPerformed ? 'yes' : 'no'}, blockers=${boundary.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    boundary.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload credential presence boundary blockers.'
  );
}

export function printKnowledgeTeamUploadLiveCheckBoundary(
  boundary: KnowledgeTeamUploadLiveCheckBoundary
): void {
  printHeader('Knowledge team upload live check boundary');
  process.stdout.write(`status: ${boundary.status}\n`);
  process.stdout.write(`next action: ${boundary.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${boundary.plannedOperation}\n`);
  process.stdout.write(`execution: ${boundary.executionMode}\n`);
  process.stdout.write(`boundary: ${boundary.boundaryKind}\n`);
  process.stdout.write(`target manifest: ${boundary.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`target object: ${boundary.target.objectKey}\n`);
  process.stdout.write(`target artifact: ${boundary.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${boundary.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check allowed: ${boundary.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${boundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${boundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${boundary.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${boundary.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${boundary.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${boundary.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${boundary.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${boundary.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${boundary.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${boundary.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${boundary.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${boundary.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${boundary.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${boundary.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${boundary.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${boundary.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source credential presence boundary: ${boundary.sourceCredentialPresenceBoundary.boundaryStatus}\n`);
  process.stdout.write(`source credential presence action: ${boundary.sourceCredentialPresenceBoundary.boundaryNextAction}\n`);
  process.stdout.write(`source review: ${boundary.sourceCredentialPresenceBoundary.reviewStatus}\n`);
  process.stdout.write(`scope matched: ${boundary.sourceCredentialPresenceBoundary.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`human review recorded: ${boundary.sourceCredentialPresenceBoundary.humanReviewRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`fingerprint verified: ${boundary.sourceCredentialPresenceBoundary.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source fingerprint verified: ${boundary.sourceCredentialPresenceBoundary.sourceFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${boundary.sourceCredentialPresenceBoundary.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${boundary.sourceCredentialPresenceBoundary.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`source credential values read: ${boundary.sourceCredentialPresenceBoundary.credentialValuesRead ? 'yes' : 'no'}\n`);
  process.stdout.write(`source credential values exposed: ${boundary.sourceCredentialPresenceBoundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`source credential presence checked: ${boundary.sourceCredentialPresenceBoundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`source live check performed: ${boundary.sourceCredentialPresenceBoundary.liveCheckPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check policy required: ${boundary.liveCheckBoundary.liveCheckPolicyRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check read-only required: ${boundary.liveCheckBoundary.liveCheckReadOnlyRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check result redaction required: ${boundary.liveCheckBoundary.liveCheckResultRedactionRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check allowed: ${boundary.liveCheckBoundary.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check performed: ${boundary.liveCheckBoundary.liveCheckPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check result exposed: ${boundary.liveCheckBoundary.liveCheckResultExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command boundary required: ${boundary.liveCheckBoundary.uploadCommandBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential read required: ${boundary.remainingExecutionBoundaries.credentialReadRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence check required: ${boundary.remainingExecutionBoundaries.credentialPresenceCheckRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check required: ${boundary.remainingExecutionBoundaries.liveCheckRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command required: ${boundary.remainingExecutionBoundaries.uploadCommandRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`dry run only: ${boundary.liveCheckBoundary.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`executable: ${boundary.liveCheckBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: credentialValuesRead=${boundary.liveCheckBoundary.credentialValuesRead ? 'yes' : 'no'}, credentialPresenceChecked=${boundary.liveCheckBoundary.credentialPresenceChecked ? 'yes' : 'no'}, liveCheckPerformed=${boundary.liveCheckBoundary.liveCheckPerformed ? 'yes' : 'no'}, uploadCommandGenerated=${boundary.liveCheckBoundary.uploadCommandGenerated ? 'yes' : 'no'}, blockers=${boundary.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    boundary.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload live check boundary blockers.'
  );
}

export function printKnowledgeTeamUploadCommandBoundary(
  boundary: KnowledgeTeamUploadCommandBoundary
): void {
  printHeader('Knowledge team upload command boundary');
  process.stdout.write(`status: ${boundary.status}\n`);
  process.stdout.write(`next action: ${boundary.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${boundary.plannedOperation}\n`);
  process.stdout.write(`execution: ${boundary.executionMode}\n`);
  process.stdout.write(`boundary: ${boundary.boundaryKind}\n`);
  process.stdout.write(`target manifest: ${boundary.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`target object key redacted: ${boundary.target.objectKeyRedacted ? 'yes' : 'no'}\n`);
  process.stdout.write(`target object sha256: ${boundary.target.objectSha256 ?? 'invalid'}\n`);
  process.stdout.write(`target artifact: ${boundary.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${boundary.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check allowed: ${boundary.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${boundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${boundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${boundary.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${boundary.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${boundary.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${boundary.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${boundary.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${boundary.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${boundary.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${boundary.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${boundary.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${boundary.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${boundary.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${boundary.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${boundary.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${boundary.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source live check boundary: ${boundary.sourceLiveCheckBoundary.boundaryStatus}\n`);
  process.stdout.write(`source live check action: ${boundary.sourceLiveCheckBoundary.boundaryNextAction}\n`);
  process.stdout.write(`source review: ${boundary.sourceLiveCheckBoundary.reviewStatus}\n`);
  process.stdout.write(`scope matched: ${boundary.sourceLiveCheckBoundary.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`human review recorded: ${boundary.sourceLiveCheckBoundary.humanReviewRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`fingerprint verified: ${boundary.sourceLiveCheckBoundary.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source fingerprint verified: ${boundary.sourceLiveCheckBoundary.sourceFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${boundary.sourceLiveCheckBoundary.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${boundary.sourceLiveCheckBoundary.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`source live check allowed: ${boundary.sourceLiveCheckBoundary.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`source live check performed: ${boundary.sourceLiveCheckBoundary.liveCheckPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`source live check result exposed: ${boundary.sourceLiveCheckBoundary.liveCheckResultExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command required before execution: ${boundary.uploadCommandBoundary.uploadCommandRequiredBeforeExecution ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command required after live check boundary: ${boundary.uploadCommandBoundary.uploadCommandRequiredAfterLiveCheckBoundary ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command descriptor required: ${boundary.uploadCommandBoundary.uploadCommandDescriptorRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command payload redaction required: ${boundary.uploadCommandBoundary.uploadCommandPayloadRedactionRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command material redaction required: ${boundary.uploadCommandBoundary.uploadCommandMaterialRedactionRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`command execution approval required: ${boundary.uploadCommandBoundary.commandExecutionApprovalRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command generated: ${boundary.uploadCommandBoundary.uploadCommandGenerated ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command materialized: ${boundary.uploadCommandBoundary.uploadCommandMaterialized ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command exposed: ${boundary.uploadCommandBoundary.uploadCommandExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${boundary.uploadCommandBoundary.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${boundary.uploadCommandBoundary.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${boundary.uploadCommandBoundary.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command executable: ${boundary.uploadCommandBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`object store dependency required: ${boundary.uploadCommandBoundary.artifactObjectStoreDependencyRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index dependency required: ${boundary.uploadCommandBoundary.metadataIndexDependencyRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`content addressed object keys required: ${boundary.uploadCommandBoundary.contentAddressedObjectKeysRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`content addressed index keys required: ${boundary.uploadCommandBoundary.contentAddressedIndexKeysRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`idempotent writes required: ${boundary.uploadCommandBoundary.idempotentWritesRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`explicit upload approval required: ${boundary.uploadCommandBoundary.explicitUploadApprovalRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`remaining upload command required: ${boundary.remainingExecutionBoundaries.uploadCommandRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`remaining upload command generated: ${boundary.remainingExecutionBoundaries.uploadCommandGenerated ? 'yes' : 'no'}\n`);
  process.stdout.write(`remaining object write allowed: ${boundary.remainingExecutionBoundaries.objectWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`remaining metadata index write allowed: ${boundary.remainingExecutionBoundaries.metadataIndexWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`remaining remote mutation allowed: ${boundary.remainingExecutionBoundaries.remoteMutationAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`dry run only: ${boundary.uploadCommandBoundary.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: uploadCommandGenerated=${boundary.uploadCommandBoundary.uploadCommandGenerated ? 'yes' : 'no'}, uploadCommandMaterialized=${boundary.uploadCommandBoundary.uploadCommandMaterialized ? 'yes' : 'no'}, uploadCommandExposed=${boundary.uploadCommandBoundary.uploadCommandExposed ? 'yes' : 'no'}, executable=${boundary.uploadCommandBoundary.executable ? 'yes' : 'no'}, blockers=${boundary.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    boundary.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload command boundary blockers.'
  );
}

export function printKnowledgeTeamUploadObjectIndexBindingBoundary(
  boundary: KnowledgeTeamUploadObjectIndexBindingBoundary
): void {
  printHeader('Knowledge team upload object/index binding boundary');
  process.stdout.write(`status: ${boundary.status}\n`);
  process.stdout.write(`next action: ${boundary.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${boundary.plannedOperation}\n`);
  process.stdout.write(`execution: ${boundary.executionMode}\n`);
  process.stdout.write(`boundary: ${boundary.boundaryKind}\n`);
  process.stdout.write(`target manifest: ${boundary.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`target object key redacted: ${boundary.target.objectKeyRedacted ? 'yes' : 'no'}\n`);
  process.stdout.write(`target object sha256: ${boundary.target.objectSha256 ?? 'invalid'}\n`);
  process.stdout.write(`target artifact: ${boundary.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${boundary.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check allowed: ${boundary.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${boundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${boundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${boundary.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${boundary.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${boundary.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${boundary.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${boundary.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${boundary.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${boundary.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${boundary.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${boundary.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${boundary.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${boundary.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${boundary.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${boundary.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${boundary.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source upload command boundary: ${boundary.sourceUploadCommandBoundary.boundaryStatus}\n`);
  process.stdout.write(`source upload command action: ${boundary.sourceUploadCommandBoundary.boundaryNextAction}\n`);
  process.stdout.write(`source review: ${boundary.sourceUploadCommandBoundary.reviewStatus}\n`);
  process.stdout.write(`scope matched: ${boundary.sourceUploadCommandBoundary.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`human review recorded: ${boundary.sourceUploadCommandBoundary.humanReviewRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`fingerprint verified: ${boundary.sourceUploadCommandBoundary.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source fingerprint verified: ${boundary.sourceUploadCommandBoundary.sourceFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${boundary.sourceUploadCommandBoundary.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${boundary.sourceUploadCommandBoundary.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`source upload command generated: ${boundary.sourceUploadCommandBoundary.uploadCommandGenerated ? 'yes' : 'no'}\n`);
  process.stdout.write(`source upload command materialized: ${boundary.sourceUploadCommandBoundary.uploadCommandMaterialized ? 'yes' : 'no'}\n`);
  process.stdout.write(`source upload command exposed: ${boundary.sourceUploadCommandBoundary.uploadCommandExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`source object store bound: ${boundary.sourceUploadCommandBoundary.artifactObjectStoreBound ? 'yes' : 'no'}\n`);
  process.stdout.write(`source metadata index bound: ${boundary.sourceUploadCommandBoundary.metadataIndexBound ? 'yes' : 'no'}\n`);
  process.stdout.write(`object store binding required: ${boundary.objectIndexBindingBoundary.objectStoreBindingRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index binding required: ${boundary.objectIndexBindingBoundary.metadataIndexBindingRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`object store descriptor required: ${boundary.objectIndexBindingBoundary.objectStoreDescriptorRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index descriptor required: ${boundary.objectIndexBindingBoundary.metadataIndexDescriptorRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`object key redaction required: ${boundary.objectIndexBindingBoundary.objectKeyRedactionRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index entry redaction required: ${boundary.objectIndexBindingBoundary.metadataIndexEntryRedactionRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`content addressed object keys required: ${boundary.objectIndexBindingBoundary.contentAddressedObjectKeysRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`content addressed index keys required: ${boundary.objectIndexBindingBoundary.contentAddressedIndexKeysRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`idempotent object write required: ${boundary.objectIndexBindingBoundary.idempotentObjectWriteRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`idempotent metadata index write required: ${boundary.objectIndexBindingBoundary.idempotentMetadataIndexWriteRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`object store bound: ${boundary.objectIndexBindingBoundary.artifactObjectStoreBound ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index bound: ${boundary.objectIndexBindingBoundary.metadataIndexBound ? 'yes' : 'no'}\n`);
  process.stdout.write(`object store handle exposed: ${boundary.objectIndexBindingBoundary.objectStoreHandleExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index handle exposed: ${boundary.objectIndexBindingBoundary.metadataIndexHandleExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write allowed: ${boundary.objectIndexBindingBoundary.objectWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write allowed: ${boundary.objectIndexBindingBoundary.metadataIndexWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${boundary.objectIndexBindingBoundary.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${boundary.objectIndexBindingBoundary.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${boundary.objectIndexBindingBoundary.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`binding executable: ${boundary.objectIndexBindingBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`remaining object/index binding required: ${boundary.remainingExecutionBoundaries.objectIndexBindingRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`remaining object store bound: ${boundary.remainingExecutionBoundaries.artifactObjectStoreBound ? 'yes' : 'no'}\n`);
  process.stdout.write(`remaining metadata index bound: ${boundary.remainingExecutionBoundaries.metadataIndexBound ? 'yes' : 'no'}\n`);
  process.stdout.write(`remaining object write allowed: ${boundary.remainingExecutionBoundaries.objectWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`remaining metadata index write allowed: ${boundary.remainingExecutionBoundaries.metadataIndexWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`remaining remote mutation allowed: ${boundary.remainingExecutionBoundaries.remoteMutationAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`dry run only: ${boundary.objectIndexBindingBoundary.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: artifactObjectStoreBound=${boundary.objectIndexBindingBoundary.artifactObjectStoreBound ? 'yes' : 'no'}, metadataIndexBound=${boundary.objectIndexBindingBoundary.metadataIndexBound ? 'yes' : 'no'}, objectWriteAllowed=${boundary.objectIndexBindingBoundary.objectWriteAllowed ? 'yes' : 'no'}, metadataIndexWriteAllowed=${boundary.objectIndexBindingBoundary.metadataIndexWriteAllowed ? 'yes' : 'no'}, executable=${boundary.objectIndexBindingBoundary.executable ? 'yes' : 'no'}, blockers=${boundary.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    boundary.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload object/index binding boundary blockers.'
  );
}

export function printKnowledgeTeamUploadExecutionReadinessBoundary(
  boundary: KnowledgeTeamUploadExecutionReadinessBoundary
): void {
  printHeader('Knowledge team upload execution readiness boundary');
  process.stdout.write(`status: ${boundary.status}\n`);
  process.stdout.write(`next action: ${boundary.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${boundary.plannedOperation}\n`);
  process.stdout.write(`execution: ${boundary.executionMode}\n`);
  process.stdout.write(`boundary: ${boundary.boundaryKind}\n`);
  process.stdout.write(`target manifest: ${boundary.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`target object key redacted: ${boundary.target.objectKeyRedacted ? 'yes' : 'no'}\n`);
  process.stdout.write(`target object sha256: ${boundary.target.objectSha256 ?? 'invalid'}\n`);
  process.stdout.write(`target artifact: ${boundary.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${boundary.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check allowed: ${boundary.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${boundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${boundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${boundary.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${boundary.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${boundary.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${boundary.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${boundary.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${boundary.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${boundary.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${boundary.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${boundary.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${boundary.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${boundary.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${boundary.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${boundary.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${boundary.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source object/index boundary: ${boundary.sourceObjectIndexBindingBoundary.boundaryStatus}\n`);
  process.stdout.write(`source object/index action: ${boundary.sourceObjectIndexBindingBoundary.boundaryNextAction}\n`);
  process.stdout.write(`source review: ${boundary.sourceObjectIndexBindingBoundary.reviewStatus}\n`);
  process.stdout.write(`scope matched: ${boundary.sourceObjectIndexBindingBoundary.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`human review recorded: ${boundary.sourceObjectIndexBindingBoundary.humanReviewRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`fingerprint verified: ${boundary.sourceObjectIndexBindingBoundary.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source fingerprint verified: ${boundary.sourceObjectIndexBindingBoundary.sourceFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${boundary.sourceObjectIndexBindingBoundary.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${boundary.sourceObjectIndexBindingBoundary.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`source object store binding required: ${boundary.sourceObjectIndexBindingBoundary.objectStoreBindingRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`source metadata index binding required: ${boundary.sourceObjectIndexBindingBoundary.metadataIndexBindingRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`source object write allowed: ${boundary.sourceObjectIndexBindingBoundary.objectWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`source metadata index write allowed: ${boundary.sourceObjectIndexBindingBoundary.metadataIndexWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution readiness modeled: ${boundary.uploadExecutionReadinessBoundary.executionReadinessModeled ? 'yes' : 'no'}\n`);
  process.stdout.write(`separate execution approval required: ${boundary.uploadExecutionReadinessBoundary.separateExecutionApprovalRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write requires execution approval: ${boundary.uploadExecutionReadinessBoundary.objectWriteRequiresExecutionApproval ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write requires execution approval: ${boundary.uploadExecutionReadinessBoundary.metadataIndexWriteRequiresExecutionApproval ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution approved: ${boundary.remainingExecutionBoundaries.uploadExecutionApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`remaining object write allowed: ${boundary.remainingExecutionBoundaries.objectWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`remaining metadata index write allowed: ${boundary.remainingExecutionBoundaries.metadataIndexWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`remaining remote mutation allowed: ${boundary.remainingExecutionBoundaries.remoteMutationAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`dry run only: ${boundary.uploadExecutionReadinessBoundary.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: uploadApproved=${boundary.uploadExecutionReadinessBoundary.uploadApproved ? 'yes' : 'no'}, uploadExecutionAllowed=${boundary.uploadExecutionReadinessBoundary.uploadExecutionAllowed ? 'yes' : 'no'}, objectWriteAllowed=${boundary.uploadExecutionReadinessBoundary.objectWriteAllowed ? 'yes' : 'no'}, metadataIndexWriteAllowed=${boundary.uploadExecutionReadinessBoundary.metadataIndexWriteAllowed ? 'yes' : 'no'}, executable=${boundary.uploadExecutionReadinessBoundary.executable ? 'yes' : 'no'}, blockers=${boundary.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    boundary.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload execution readiness boundary blockers.'
  );
}

export function printKnowledgeTeamUploadExecutionApprovalRequest(
  request: KnowledgeTeamUploadExecutionApprovalRequest
): void {
  printHeader('Knowledge team upload execution approval request');
  process.stdout.write(`status: ${request.status}\n`);
  process.stdout.write(`next action: ${request.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${request.plannedOperation}\n`);
  process.stdout.write(`execution: ${request.executionMode}\n`);
  process.stdout.write(`request: ${request.requestKind}\n`);
  process.stdout.write(`target manifest: ${request.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`target object key redacted: ${request.target.objectKeyRedacted ? 'yes' : 'no'}\n`);
  process.stdout.write(`target object sha256: ${request.target.objectSha256 ?? 'invalid'}\n`);
  process.stdout.write(`target artifact: ${request.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${request.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check allowed: ${request.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${request.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${request.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${request.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution approved: ${request.uploadExecutionApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${request.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${request.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${request.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${request.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${request.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${request.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${request.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${request.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${request.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${request.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${request.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${request.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${request.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source execution readiness boundary: ${request.sourceExecutionReadinessBoundary.boundaryStatus}\n`);
  process.stdout.write(`source execution readiness action: ${request.sourceExecutionReadinessBoundary.boundaryNextAction}\n`);
  process.stdout.write(`source review: ${request.sourceExecutionReadinessBoundary.reviewStatus}\n`);
  process.stdout.write(`scope matched: ${request.sourceExecutionReadinessBoundary.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`human review recorded: ${request.sourceExecutionReadinessBoundary.humanReviewRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`source fingerprint verified: ${request.sourceExecutionReadinessBoundary.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source artifact fingerprint verified: ${request.sourceExecutionReadinessBoundary.sourceFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${request.sourceExecutionReadinessBoundary.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${request.sourceExecutionReadinessBoundary.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`execution readiness modeled: ${request.sourceExecutionReadinessBoundary.executionReadinessModeled ? 'yes' : 'no'}\n`);
  process.stdout.write(`separate execution approval required: ${request.sourceExecutionReadinessBoundary.separateExecutionApprovalRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write requires execution approval: ${request.sourceExecutionReadinessBoundary.objectWriteRequiresExecutionApproval ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write requires execution approval: ${request.sourceExecutionReadinessBoundary.metadataIndexWriteRequiresExecutionApproval ? 'yes' : 'no'}\n`);
  process.stdout.write(`approval request issued: ${request.approvalRequest.requestIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`human approval required: ${request.approvalRequest.humanApprovalRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`human approval recorded: ${request.approvalRequest.humanApprovalRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`approval granted: ${request.approvalRequest.approvalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`approval fingerprint scope: ${request.approvalRequest.fingerprint.scope}\n`);
  process.stdout.write(`approval fingerprint: ${request.approvalRequest.fingerprint.value ?? 'unavailable'}\n`);
  process.stdout.write(`approval fingerprint verified: ${request.approvalRequest.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`dry run only: ${request.executionBoundary.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary executable: ${request.executionBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary object write allowed: ${request.executionBoundary.objectWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary metadata index write allowed: ${request.executionBoundary.metadataIndexWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: requestIssued=${request.approvalRequest.requestIssued ? 'yes' : 'no'}, approvalGranted=${request.approvalRequest.approvalGranted ? 'yes' : 'no'}, uploadExecutionAllowed=${request.uploadExecutionAllowed ? 'yes' : 'no'}, executable=${request.executionBoundary.executable ? 'yes' : 'no'}, blockers=${request.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    request.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload execution approval request blockers.'
  );
}

export function printKnowledgeTeamUploadExecutionApprovalRecord(
  record: KnowledgeTeamUploadExecutionApprovalRecord
): void {
  printHeader('Knowledge team upload execution approval record');
  process.stdout.write(`status: ${record.status}\n`);
  process.stdout.write(`next action: ${record.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${record.plannedOperation}\n`);
  process.stdout.write(`execution: ${record.executionMode}\n`);
  process.stdout.write(`record: ${record.recordKind}\n`);
  process.stdout.write(`target manifest: ${record.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`target object key redacted: ${record.target.objectKeyRedacted ? 'yes' : 'no'}\n`);
  process.stdout.write(`target object sha256: ${record.target.objectSha256 ?? 'invalid'}\n`);
  process.stdout.write(`target artifact: ${record.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${record.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check allowed: ${record.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${record.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${record.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${record.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution approved: ${record.uploadExecutionApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${record.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${record.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${record.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${record.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${record.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${record.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${record.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${record.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${record.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${record.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${record.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${record.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${record.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source approval request: ${record.sourceApprovalRequest.requestStatus}\n`);
  process.stdout.write(`source approval request action: ${record.sourceApprovalRequest.requestNextAction}\n`);
  process.stdout.write(`source execution readiness boundary: ${record.sourceApprovalRequest.sourceExecutionReadinessStatus}\n`);
  process.stdout.write(`source execution readiness action: ${record.sourceApprovalRequest.sourceExecutionReadinessNextAction}\n`);
  process.stdout.write(`source review: ${record.sourceApprovalRequest.reviewStatus}\n`);
  process.stdout.write(`scope matched: ${record.sourceApprovalRequest.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`source human review recorded: ${record.sourceApprovalRequest.humanReviewRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`source fingerprint verified: ${record.sourceApprovalRequest.sourceFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source artifact fingerprint verified: ${record.sourceApprovalRequest.sourceArtifactFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${record.sourceApprovalRequest.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${record.sourceApprovalRequest.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`source request issued: ${record.sourceApprovalRequest.requestIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`source request human approval recorded: ${record.sourceApprovalRequest.requestHumanApprovalRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`source request approval granted: ${record.sourceApprovalRequest.requestApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`source request fingerprint verified: ${record.sourceApprovalRequest.requestFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source request fingerprint scope: ${record.sourceApprovalRequest.requestFingerprint.scope}\n`);
  process.stdout.write(`source request fingerprint: ${record.sourceApprovalRequest.requestFingerprint.value ?? 'unavailable'}\n`);
  process.stdout.write(`human approval required: ${record.approvalRecord.humanApprovalRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`human approval recorded: ${record.approvalRecord.humanApprovalRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`approval granted: ${record.approvalRecord.approvalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`approval source: ${record.approvalRecord.source ?? 'none'}\n`);
  process.stdout.write(`expected fingerprint: ${record.approvalRecord.expectedFingerprint ?? 'unavailable'}\n`);
  process.stdout.write(`supplied fingerprint: ${record.approvalRecord.suppliedFingerprint ?? 'unavailable'}\n`);
  process.stdout.write(`approval fingerprint verified: ${record.approvalRecord.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`record fingerprint scope: ${record.approvalRecord.recordFingerprint.scope}\n`);
  process.stdout.write(`record fingerprint: ${record.approvalRecord.recordFingerprint.value ?? 'unavailable'}\n`);
  process.stdout.write(`dry run only: ${record.executionBoundary.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary executable: ${record.executionBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary object write allowed: ${record.executionBoundary.objectWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary metadata index write allowed: ${record.executionBoundary.metadataIndexWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: humanApprovalRecorded=${record.approvalRecord.humanApprovalRecorded ? 'yes' : 'no'}, approvalGranted=${record.approvalRecord.approvalGranted ? 'yes' : 'no'}, uploadExecutionAllowed=${record.uploadExecutionAllowed ? 'yes' : 'no'}, executable=${record.executionBoundary.executable ? 'yes' : 'no'}, blockers=${record.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    record.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload execution approval record blockers.'
  );
}

export function printKnowledgeTeamUploadExecutionAuthorizationBoundary(
  boundary: KnowledgeTeamUploadExecutionAuthorizationBoundary
): void {
  printHeader('Knowledge team upload execution authorization boundary');
  process.stdout.write(`status: ${boundary.status}\n`);
  process.stdout.write(`next action: ${boundary.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${boundary.plannedOperation}\n`);
  process.stdout.write(`execution: ${boundary.executionMode}\n`);
  process.stdout.write(`boundary: ${boundary.boundaryKind}\n`);
  process.stdout.write(`target manifest: ${boundary.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`target object key redacted: ${boundary.target.objectKeyRedacted ? 'yes' : 'no'}\n`);
  process.stdout.write(`target object sha256: ${boundary.target.objectSha256 ?? 'invalid'}\n`);
  process.stdout.write(`target artifact: ${boundary.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${boundary.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check allowed: ${boundary.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${boundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${boundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${boundary.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution approved: ${boundary.uploadExecutionApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${boundary.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${boundary.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${boundary.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${boundary.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${boundary.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${boundary.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${boundary.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${boundary.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${boundary.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${boundary.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${boundary.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${boundary.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${boundary.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source approval record: ${boundary.sourceApprovalRecord.recordStatus}\n`);
  process.stdout.write(`source approval record action: ${boundary.sourceApprovalRecord.recordNextAction}\n`);
  process.stdout.write(`source approval request: ${boundary.sourceApprovalRecord.sourceApprovalRequestStatus}\n`);
  process.stdout.write(`source approval request action: ${boundary.sourceApprovalRecord.sourceApprovalRequestNextAction}\n`);
  process.stdout.write(`source execution readiness boundary: ${boundary.sourceApprovalRecord.sourceExecutionReadinessStatus}\n`);
  process.stdout.write(`source execution readiness action: ${boundary.sourceApprovalRecord.sourceExecutionReadinessNextAction}\n`);
  process.stdout.write(`source review: ${boundary.sourceApprovalRecord.reviewStatus}\n`);
  process.stdout.write(`scope matched: ${boundary.sourceApprovalRecord.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`source human review recorded: ${boundary.sourceApprovalRecord.humanReviewRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`source fingerprint verified: ${boundary.sourceApprovalRecord.sourceFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source artifact fingerprint verified: ${boundary.sourceApprovalRecord.sourceArtifactFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${boundary.sourceApprovalRecord.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${boundary.sourceApprovalRecord.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`source request issued: ${boundary.sourceApprovalRecord.requestIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`source request human approval recorded: ${boundary.sourceApprovalRecord.requestHumanApprovalRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`source request approval granted: ${boundary.sourceApprovalRecord.requestApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`source request fingerprint verified: ${boundary.sourceApprovalRecord.requestFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source human approval recorded: ${boundary.sourceApprovalRecord.humanApprovalRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`source approval granted: ${boundary.sourceApprovalRecord.approvalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`source approval fingerprint verified: ${boundary.sourceApprovalRecord.approvalFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source approval record fingerprint scope: ${boundary.sourceApprovalRecord.recordFingerprint.scope}\n`);
  process.stdout.write(`source approval record fingerprint: ${boundary.sourceApprovalRecord.recordFingerprint.value ?? 'unavailable'}\n`);
  process.stdout.write(`dry run only: ${boundary.authorizationBoundary.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`authorization modeled: ${boundary.authorizationBoundary.authorizationBoundaryDesigned ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution approval required: ${boundary.authorizationBoundary.uploadExecutionAuthorizationRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`human approval recorded: ${boundary.authorizationBoundary.humanApprovalRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`approval fingerprint verified: ${boundary.authorizationBoundary.approvalFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`approval grants execution: ${boundary.authorizationBoundary.approvalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution authorization granted: ${boundary.authorizationBoundary.executionAuthorizationGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary executable: ${boundary.authorizationBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write allowed: ${boundary.authorizationBoundary.objectWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write allowed: ${boundary.authorizationBoundary.metadataIndexWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`authorization boundary fingerprint scope: ${boundary.authorizationBoundary.authorizationBoundaryFingerprint.scope}\n`);
  process.stdout.write(`authorization boundary fingerprint: ${boundary.authorizationBoundary.authorizationBoundaryFingerprint.value ?? 'unavailable'}\n`);
  process.stdout.write(`summary: humanApprovalRecorded=${boundary.authorizationBoundary.humanApprovalRecorded ? 'yes' : 'no'}, fingerprintVerified=${boundary.authorizationBoundary.approvalFingerprintVerified ? 'yes' : 'no'}, authorizationGranted=${boundary.authorizationBoundary.authorizationGranted ? 'yes' : 'no'}, uploadExecutionAllowed=${boundary.uploadExecutionAllowed ? 'yes' : 'no'}, executable=${boundary.executionBoundary.executable ? 'yes' : 'no'}, blockers=${boundary.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    boundary.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload execution authorization boundary blockers.'
  );
}

export function printKnowledgeTeamUploadExecutionPlanRulesReview(
  review: KnowledgeTeamUploadExecutionPlanRulesReview
): void {
  printHeader('Knowledge team upload execution plan/rules review');
  process.stdout.write(`status: ${review.status}\n`);
  process.stdout.write(`next action: ${review.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${review.plannedOperation}\n`);
  process.stdout.write(`execution: ${review.executionMode}\n`);
  process.stdout.write(`review: ${review.reviewKind}\n`);
  process.stdout.write(`target manifest: ${review.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`target object key redacted: ${review.target.objectKeyRedacted ? 'yes' : 'no'}\n`);
  process.stdout.write(`target object sha256: ${review.target.objectSha256 ?? 'invalid'}\n`);
  process.stdout.write(`target artifact: ${review.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${review.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check allowed: ${review.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${review.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${review.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${review.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution approved: ${review.uploadExecutionApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${review.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${review.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${review.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${review.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${review.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${review.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${review.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${review.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${review.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${review.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${review.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${review.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${review.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source authorization boundary: ${review.sourceAuthorizationBoundary.boundaryStatus}\n`);
  process.stdout.write(`source authorization action: ${review.sourceAuthorizationBoundary.boundaryNextAction}\n`);
  process.stdout.write(`source scope matched: ${review.sourceAuthorizationBoundary.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`source human approval recorded: ${review.sourceAuthorizationBoundary.humanApprovalRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`source approval fingerprint verified: ${review.sourceAuthorizationBoundary.approvalFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source authorization boundary designed: ${review.sourceAuthorizationBoundary.authorizationBoundaryDesigned ? 'yes' : 'no'}\n`);
  process.stdout.write(`source authorization granted: ${review.sourceAuthorizationBoundary.authorizationGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution authorization granted: ${review.sourceAuthorizationBoundary.executionAuthorizationGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`source upload execution allowed: ${review.sourceAuthorizationBoundary.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${review.sourceAuthorizationBoundary.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${review.sourceAuthorizationBoundary.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`source approval record fingerprint scope: ${review.sourceAuthorizationBoundary.sourceApprovalRecordFingerprint.scope}\n`);
  process.stdout.write(`source approval record fingerprint: ${review.sourceAuthorizationBoundary.sourceApprovalRecordFingerprint.value ?? 'unavailable'}\n`);
  process.stdout.write(`source authorization boundary fingerprint scope: ${review.sourceAuthorizationBoundary.authorizationBoundaryFingerprint.scope}\n`);
  process.stdout.write(`source authorization boundary fingerprint: ${review.sourceAuthorizationBoundary.authorizationBoundaryFingerprint.value ?? 'unavailable'}\n`);
  process.stdout.write(`plan/rules review required: ${review.planRulesReview.planRulesUpdateReviewRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`plan/rules updated: ${review.planRulesReview.planRulesUpdated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rules update reviewed: ${review.planRulesReview.rulesUpdateReviewed ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution still disabled: ${review.planRulesReview.executionStillDisabled ? 'yes' : 'no'}\n`);
  process.stdout.write(`real upload execution still prohibited: ${review.planRulesReview.realUploadExecutionStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command generation still prohibited: ${review.planRulesReview.uploadCommandGenerationStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write still prohibited: ${review.planRulesReview.objectWriteStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write still prohibited: ${review.planRulesReview.metadataIndexWriteStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`next required policy update: ${review.planRulesReview.nextRequiredPolicyUpdate}\n`);
  process.stdout.write(`required review documents: ${review.planRulesReview.requiredReviewDocuments.join(', ')}\n`);
  process.stdout.write(`review fingerprint scope: ${review.planRulesReview.reviewFingerprint.scope}\n`);
  process.stdout.write(`review fingerprint: ${review.planRulesReview.reviewFingerprint.value ?? 'unavailable'}\n`);
  process.stdout.write(`execution boundary executable: ${review.executionBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary upload command generated: ${review.executionBoundary.uploadCommandGenerated ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary object write allowed: ${review.executionBoundary.objectWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary metadata index write allowed: ${review.executionBoundary.metadataIndexWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: sourceHumanApprovalRecorded=${review.sourceAuthorizationBoundary.humanApprovalRecorded ? 'yes' : 'no'}, sourceFingerprintVerified=${review.sourceAuthorizationBoundary.approvalFingerprintVerified ? 'yes' : 'no'}, authorizationGranted=${review.sourceAuthorizationBoundary.authorizationGranted ? 'yes' : 'no'}, planRulesUpdated=${review.planRulesReview.planRulesUpdated ? 'yes' : 'no'}, uploadExecutionAllowed=${review.uploadExecutionAllowed ? 'yes' : 'no'}, executable=${review.executionBoundary.executable ? 'yes' : 'no'}, blockers=${review.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    review.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload execution Plan/Rules review blockers.'
  );
}

export function printKnowledgeTeamUploadExecutionPlanRulesUpdateRecord(
  record: KnowledgeTeamUploadExecutionPlanRulesUpdateRecord
): void {
  printHeader('Knowledge team upload execution plan/rules update record');
  process.stdout.write(`status: ${record.status}\n`);
  process.stdout.write(`next action: ${record.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${record.plannedOperation}\n`);
  process.stdout.write(`execution: ${record.executionMode}\n`);
  process.stdout.write(`record: ${record.recordKind}\n`);
  process.stdout.write(`target manifest: ${record.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`target object key redacted: ${record.target.objectKeyRedacted ? 'yes' : 'no'}\n`);
  process.stdout.write(`target object sha256: ${record.target.objectSha256 ?? 'invalid'}\n`);
  process.stdout.write(`target artifact: ${record.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${record.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check allowed: ${record.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${record.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${record.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${record.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution approved: ${record.uploadExecutionApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${record.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${record.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${record.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${record.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${record.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${record.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${record.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${record.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${record.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${record.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${record.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${record.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${record.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source plan/rules review: ${record.sourcePlanRulesReview.reviewStatus}\n`);
  process.stdout.write(`source plan/rules review action: ${record.sourcePlanRulesReview.reviewNextAction}\n`);
  process.stdout.write(`source authorization boundary: ${record.sourcePlanRulesReview.sourceAuthorizationBoundaryStatus}\n`);
  process.stdout.write(`source authorization action: ${record.sourcePlanRulesReview.sourceAuthorizationBoundaryNextAction}\n`);
  process.stdout.write(`source scope matched: ${record.sourcePlanRulesReview.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`source human approval recorded: ${record.sourcePlanRulesReview.humanApprovalRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`source approval fingerprint verified: ${record.sourcePlanRulesReview.approvalFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source authorization boundary designed: ${record.sourcePlanRulesReview.authorizationBoundaryDesigned ? 'yes' : 'no'}\n`);
  process.stdout.write(`source plan/rules update required: ${record.sourcePlanRulesReview.planRulesUpdateReviewRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`source plan/rules updated: ${record.sourcePlanRulesReview.planRulesUpdated ? 'yes' : 'no'}\n`);
  process.stdout.write(`source rules update reviewed: ${record.sourcePlanRulesReview.rulesUpdateReviewed ? 'yes' : 'no'}\n`);
  process.stdout.write(`source execution still disabled: ${record.sourcePlanRulesReview.executionStillDisabled ? 'yes' : 'no'}\n`);
  process.stdout.write(`source authorization granted: ${record.sourcePlanRulesReview.authorizationGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`source execution authorization granted: ${record.sourcePlanRulesReview.executionAuthorizationGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`source upload execution allowed: ${record.sourcePlanRulesReview.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${record.sourcePlanRulesReview.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${record.sourcePlanRulesReview.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`source review fingerprint scope: ${record.sourcePlanRulesReview.reviewFingerprint.scope}\n`);
  process.stdout.write(`source review fingerprint: ${record.sourcePlanRulesReview.reviewFingerprint.value ?? 'unavailable'}\n`);
  process.stdout.write(`explicit plan/rules update required: ${record.planRulesUpdateRecord.explicitPlanRulesUpdateRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`human review required: ${record.planRulesUpdateRecord.humanReviewRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`plan/rules update recorded: ${record.planRulesUpdateRecord.planRulesUpdateRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`rules update reviewed: ${record.planRulesUpdateRecord.rulesUpdateReviewed ? 'yes' : 'no'}\n`);
  process.stdout.write(`policy update authorized: ${record.planRulesUpdateRecord.policyUpdateAuthorized ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution still disabled: ${record.planRulesUpdateRecord.executionStillDisabled ? 'yes' : 'no'}\n`);
  process.stdout.write(`record source: ${record.planRulesUpdateRecord.source ?? 'none'}\n`);
  process.stdout.write(`expected fingerprint: ${record.planRulesUpdateRecord.expectedFingerprint ?? 'unavailable'}\n`);
  process.stdout.write(`supplied fingerprint: ${record.planRulesUpdateRecord.suppliedFingerprint ?? 'unavailable'}\n`);
  process.stdout.write(`review fingerprint verified: ${record.planRulesUpdateRecord.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`record fingerprint scope: ${record.planRulesUpdateRecord.recordFingerprint.scope}\n`);
  process.stdout.write(`record fingerprint: ${record.planRulesUpdateRecord.recordFingerprint.value ?? 'unavailable'}\n`);
  process.stdout.write(`execution boundary executable: ${record.executionBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary upload command generated: ${record.executionBoundary.uploadCommandGenerated ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary object write allowed: ${record.executionBoundary.objectWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary metadata index write allowed: ${record.executionBoundary.metadataIndexWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: planRulesUpdateRecorded=${record.planRulesUpdateRecord.planRulesUpdateRecorded ? 'yes' : 'no'}, fingerprintVerified=${record.planRulesUpdateRecord.fingerprintVerified ? 'yes' : 'no'}, policyUpdateAuthorized=${record.planRulesUpdateRecord.policyUpdateAuthorized ? 'yes' : 'no'}, uploadExecutionAllowed=${record.uploadExecutionAllowed ? 'yes' : 'no'}, executable=${record.executionBoundary.executable ? 'yes' : 'no'}, blockers=${record.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    record.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload execution Plan/Rules update record blockers.'
  );
}

export function printKnowledgeTeamUploadExecutionImplementationBoundary(
  boundary: KnowledgeTeamUploadExecutionImplementationBoundary
): void {
  printHeader('Knowledge team upload execution implementation boundary');
  process.stdout.write(`status: ${boundary.status}\n`);
  process.stdout.write(`next action: ${boundary.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${boundary.plannedOperation}\n`);
  process.stdout.write(`execution: ${boundary.executionMode}\n`);
  process.stdout.write(`boundary: ${boundary.boundaryKind}\n`);
  process.stdout.write(`target manifest: ${boundary.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`target object key redacted: ${boundary.target.objectKeyRedacted ? 'yes' : 'no'}\n`);
  process.stdout.write(`target object sha256: ${boundary.target.objectSha256 ?? 'invalid'}\n`);
  process.stdout.write(`target artifact: ${boundary.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${boundary.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check allowed: ${boundary.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${boundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${boundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${boundary.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution approved: ${boundary.uploadExecutionApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${boundary.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${boundary.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${boundary.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${boundary.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${boundary.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${boundary.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${boundary.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${boundary.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${boundary.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${boundary.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${boundary.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${boundary.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${boundary.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source update record: ${boundary.sourcePlanRulesUpdateRecord.recordStatus}\n`);
  process.stdout.write(`source update record action: ${boundary.sourcePlanRulesUpdateRecord.recordNextAction}\n`);
  process.stdout.write(`source record kind: ${boundary.sourcePlanRulesUpdateRecord.recordKind}\n`);
  process.stdout.write(`source plan/rules review: ${boundary.sourcePlanRulesUpdateRecord.sourceReviewStatus}\n`);
  process.stdout.write(`source plan/rules review action: ${boundary.sourcePlanRulesUpdateRecord.sourceReviewNextAction}\n`);
  process.stdout.write(`source scope matched: ${boundary.sourcePlanRulesUpdateRecord.scopeMatched ? 'yes' : 'no'}\n`);
  process.stdout.write(`source human approval recorded: ${boundary.sourcePlanRulesUpdateRecord.humanApprovalRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`source approval fingerprint verified: ${boundary.sourcePlanRulesUpdateRecord.approvalFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source authorization boundary designed: ${boundary.sourcePlanRulesUpdateRecord.authorizationBoundaryDesigned ? 'yes' : 'no'}\n`);
  process.stdout.write(`source plan/rules update recorded: ${boundary.sourcePlanRulesUpdateRecord.planRulesUpdateRecorded ? 'yes' : 'no'}\n`);
  process.stdout.write(`source rules update reviewed: ${boundary.sourcePlanRulesUpdateRecord.rulesUpdateReviewed ? 'yes' : 'no'}\n`);
  process.stdout.write(`source fingerprint verified: ${boundary.sourcePlanRulesUpdateRecord.fingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source policy update authorized: ${boundary.sourcePlanRulesUpdateRecord.policyUpdateAuthorized ? 'yes' : 'no'}\n`);
  process.stdout.write(`source execution still disabled: ${boundary.sourcePlanRulesUpdateRecord.executionStillDisabled ? 'yes' : 'no'}\n`);
  process.stdout.write(`source authorization granted: ${boundary.sourcePlanRulesUpdateRecord.authorizationGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`source execution authorization granted: ${boundary.sourcePlanRulesUpdateRecord.executionAuthorizationGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`source upload execution allowed: ${boundary.sourcePlanRulesUpdateRecord.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${boundary.sourcePlanRulesUpdateRecord.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${boundary.sourcePlanRulesUpdateRecord.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`source update record fingerprint scope: ${boundary.sourcePlanRulesUpdateRecord.updateRecordFingerprint.scope}\n`);
  process.stdout.write(`source update record fingerprint: ${boundary.sourcePlanRulesUpdateRecord.updateRecordFingerprint.value ?? 'unavailable'}\n`);
  process.stdout.write(`dry run only: ${boundary.implementationBoundary.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`implementation boundary designed: ${boundary.implementationBoundary.implementationBoundaryDesigned ? 'yes' : 'no'}\n`);
  process.stdout.write(`source update record fingerprint verified: ${boundary.implementationBoundary.sourceUpdateRecordFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`runtime boundary design required: ${boundary.implementationBoundary.runtimeBoundaryDesignRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`implementation allowed: ${boundary.implementationBoundary.implementationAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`authorization granted: ${boundary.implementationBoundary.authorizationGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution authorization granted: ${boundary.implementationBoundary.executionAuthorizationGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${boundary.implementationBoundary.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`executable: ${boundary.implementationBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`command generation prohibited: ${boundary.implementationBoundary.commandGenerationStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injection prohibited: ${boundary.implementationBoundary.adapterInjectionStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`client creation prohibited: ${boundary.implementationBoundary.clientCreationStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential access prohibited: ${boundary.implementationBoundary.credentialAccessStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check prohibited: ${boundary.implementationBoundary.liveCheckStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`object store binding prohibited: ${boundary.implementationBoundary.objectStoreBindingStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index binding prohibited: ${boundary.implementationBoundary.metadataIndexBindingStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write prohibited: ${boundary.implementationBoundary.objectWriteStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write prohibited: ${boundary.implementationBoundary.metadataIndexWriteStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`implementation boundary fingerprint scope: ${boundary.implementationBoundary.implementationBoundaryFingerprint.scope}\n`);
  process.stdout.write(`implementation boundary fingerprint: ${boundary.implementationBoundary.implementationBoundaryFingerprint.value ?? 'unavailable'}\n`);
  process.stdout.write(`execution boundary executable: ${boundary.executionBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary upload command generated: ${boundary.executionBoundary.uploadCommandGenerated ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary object store bound: ${boundary.executionBoundary.artifactObjectStoreBound ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary metadata index bound: ${boundary.executionBoundary.metadataIndexBound ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary object write allowed: ${boundary.executionBoundary.objectWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary metadata index write allowed: ${boundary.executionBoundary.metadataIndexWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: implementationBoundaryDesigned=${boundary.implementationBoundary.implementationBoundaryDesigned ? 'yes' : 'no'}, sourceFingerprintVerified=${boundary.implementationBoundary.sourceUpdateRecordFingerprintVerified ? 'yes' : 'no'}, implementationAllowed=${boundary.implementationBoundary.implementationAllowed ? 'yes' : 'no'}, uploadExecutionAllowed=${boundary.uploadExecutionAllowed ? 'yes' : 'no'}, executable=${boundary.executionBoundary.executable ? 'yes' : 'no'}, blockers=${boundary.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    boundary.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload execution implementation boundary blockers.'
  );
}

export function printKnowledgeTeamUploadExecutionRuntimeBoundaries(
  boundary: KnowledgeTeamUploadExecutionRuntimeBoundaries
): void {
  printHeader('Knowledge team upload execution runtime boundaries');
  process.stdout.write(`status: ${boundary.status}\n`);
  process.stdout.write(`next action: ${boundary.readiness.nextAction}\n`);
  process.stdout.write(`operation: ${boundary.plannedOperation}\n`);
  process.stdout.write(`execution: ${boundary.executionMode}\n`);
  process.stdout.write(`boundary: ${boundary.boundaryKind}\n`);
  process.stdout.write(`target manifest: ${boundary.target.manifestId ?? 'invalid'}\n`);
  process.stdout.write(`target object key redacted: ${boundary.target.objectKeyRedacted ? 'yes' : 'no'}\n`);
  process.stdout.write(`target object sha256: ${boundary.target.objectSha256 ?? 'invalid'}\n`);
  process.stdout.write(`target artifact: ${boundary.target.artifactId ?? 'invalid'}\n`);
  process.stdout.write(`remote write: ${boundary.remoteWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check allowed: ${boundary.liveCheckAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential values exposed: ${boundary.credentialValuesExposed ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence checked: ${boundary.credentialPresenceChecked ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload approved: ${boundary.uploadApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution approved: ${boundary.uploadExecutionApproved ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${boundary.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`mutation approval granted: ${boundary.mutationApprovalGranted ? 'yes' : 'no'}\n`);
  process.stdout.write(`client created: ${boundary.clientCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injected: ${boundary.adapterInjected ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes provided: ${boundary.artifactBytesProvided ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token issued: ${boundary.writeTokenIssued ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease created: ${boundary.executionLeaseCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan created: ${boundary.rollbackPlanCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record created: ${boundary.auditRecordCreated ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write attempted: ${boundary.objectWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write attempted: ${boundary.metadataIndexWriteAttempted ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation performed: ${boundary.remoteMutationPerformed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command: ${boundary.uploadCommand ?? 'none'}\n`);
  process.stdout.write(`source implementation boundary: ${boundary.sourceImplementationBoundary.boundaryStatus}\n`);
  process.stdout.write(`source implementation boundary action: ${boundary.sourceImplementationBoundary.boundaryNextAction}\n`);
  process.stdout.write(`source implementation boundary kind: ${boundary.sourceImplementationBoundary.boundaryKind}\n`);
  process.stdout.write(`source update record: ${boundary.sourceImplementationBoundary.sourceUpdateRecordStatus}\n`);
  process.stdout.write(`source update record action: ${boundary.sourceImplementationBoundary.sourceUpdateRecordNextAction}\n`);
  process.stdout.write(`source implementation boundary designed: ${boundary.sourceImplementationBoundary.implementationBoundaryDesigned ? 'yes' : 'no'}\n`);
  process.stdout.write(`source update record fingerprint verified: ${boundary.sourceImplementationBoundary.sourceUpdateRecordFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`source runtime boundary design required: ${boundary.sourceImplementationBoundary.runtimeBoundaryDesignRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`source implementation allowed: ${boundary.sourceImplementationBoundary.implementationAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`source execution still disabled: ${boundary.sourceImplementationBoundary.executionStillDisabled ? 'yes' : 'no'}\n`);
  process.stdout.write(`source upload execution allowed: ${boundary.sourceImplementationBoundary.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter backend: ${boundary.sourceImplementationBoundary.adapterBackendKind}\n`);
  process.stdout.write(`adapter name: ${boundary.sourceImplementationBoundary.adapterName ?? 'invalid'}\n`);
  process.stdout.write(`source implementation boundary fingerprint scope: ${boundary.sourceImplementationBoundary.implementationBoundaryFingerprint.scope}\n`);
  process.stdout.write(`source implementation boundary fingerprint: ${boundary.sourceImplementationBoundary.implementationBoundaryFingerprint.value ?? 'unavailable'}\n`);
  process.stdout.write(`dry run only: ${boundary.runtimeBoundaries.dryRunOnly ? 'yes' : 'no'}\n`);
  process.stdout.write(`runtime boundaries designed: ${boundary.runtimeBoundaries.runtimeBoundariesDesigned ? 'yes' : 'no'}\n`);
  process.stdout.write(`source implementation boundary fingerprint verified: ${boundary.runtimeBoundaries.sourceImplementationBoundaryFingerprintVerified ? 'yes' : 'no'}\n`);
  process.stdout.write(`separate runtime artifacts required: ${boundary.runtimeBoundaries.separateRuntimeArtifactsRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`artifact bytes runtime boundary required: ${boundary.runtimeBoundaries.artifactBytesRuntimeBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injection runtime boundary required: ${boundary.runtimeBoundaries.adapterInjectionRuntimeBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`client creation runtime boundary required: ${boundary.runtimeBoundaries.clientCreationRuntimeBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential read runtime boundary required: ${boundary.runtimeBoundaries.credentialReadRuntimeBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential presence runtime boundary required: ${boundary.runtimeBoundaries.credentialPresenceRuntimeBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check runtime boundary required: ${boundary.runtimeBoundaries.liveCheckRuntimeBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload command runtime boundary required: ${boundary.runtimeBoundaries.uploadCommandRuntimeBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`object/index binding runtime boundary required: ${boundary.runtimeBoundaries.objectIndexBindingRuntimeBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`write token runtime boundary required: ${boundary.runtimeBoundaries.writeTokenRuntimeBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution lease runtime boundary required: ${boundary.runtimeBoundaries.executionLeaseRuntimeBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`rollback plan runtime boundary required: ${boundary.runtimeBoundaries.rollbackPlanRuntimeBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`audit record runtime boundary required: ${boundary.runtimeBoundaries.auditRecordRuntimeBoundaryRequired ? 'yes' : 'no'}\n`);
  process.stdout.write(`runtime execution allowed: ${boundary.runtimeBoundaries.runtimeExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`upload execution allowed: ${boundary.runtimeBoundaries.uploadExecutionAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`executable: ${boundary.runtimeBoundaries.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`command generation prohibited: ${boundary.runtimeBoundaries.commandGenerationStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`adapter injection prohibited: ${boundary.runtimeBoundaries.adapterInjectionStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`client creation prohibited: ${boundary.runtimeBoundaries.clientCreationStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`credential access prohibited: ${boundary.runtimeBoundaries.credentialAccessStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`live check prohibited: ${boundary.runtimeBoundaries.liveCheckStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`object store binding prohibited: ${boundary.runtimeBoundaries.objectStoreBindingStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index binding prohibited: ${boundary.runtimeBoundaries.metadataIndexBindingStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`object write prohibited: ${boundary.runtimeBoundaries.objectWriteStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`metadata index write prohibited: ${boundary.runtimeBoundaries.metadataIndexWriteStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`remote mutation prohibited: ${boundary.runtimeBoundaries.remoteMutationStillProhibited ? 'yes' : 'no'}\n`);
  process.stdout.write(`runtime boundaries fingerprint scope: ${boundary.runtimeBoundaries.runtimeBoundariesFingerprint.scope}\n`);
  process.stdout.write(`runtime boundaries fingerprint: ${boundary.runtimeBoundaries.runtimeBoundariesFingerprint.value ?? 'unavailable'}\n`);
  process.stdout.write(`execution boundary executable: ${boundary.executionBoundary.executable ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary upload command generated: ${boundary.executionBoundary.uploadCommandGenerated ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary object store bound: ${boundary.executionBoundary.artifactObjectStoreBound ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary metadata index bound: ${boundary.executionBoundary.metadataIndexBound ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary object write allowed: ${boundary.executionBoundary.objectWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`execution boundary metadata index write allowed: ${boundary.executionBoundary.metadataIndexWriteAllowed ? 'yes' : 'no'}\n`);
  process.stdout.write(`summary: runtimeBoundariesDesigned=${boundary.runtimeBoundaries.runtimeBoundariesDesigned ? 'yes' : 'no'}, sourceFingerprintVerified=${boundary.runtimeBoundaries.sourceImplementationBoundaryFingerprintVerified ? 'yes' : 'no'}, runtimeExecutionAllowed=${boundary.runtimeBoundaries.runtimeExecutionAllowed ? 'yes' : 'no'}, uploadExecutionAllowed=${boundary.uploadExecutionAllowed ? 'yes' : 'no'}, executable=${boundary.executionBoundary.executable ? 'yes' : 'no'}, blockers=${boundary.readiness.blockerCount}\n\n`);
  printHeader('Blockers');
  printList(
    boundary.readiness.blockers.map(blocker => `${blocker.code} ${blocker.path}: ${blocker.message}`),
    'No upload execution runtime boundaries blockers.'
  );
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
