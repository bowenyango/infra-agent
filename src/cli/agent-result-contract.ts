import type { CompactAgentRunResult } from './output.ts';
import { AGENT_ACTION_FAMILIES, AGENT_RUN_OUTCOMES } from '../types/agent.ts';
const AGENT_ACTION_KINDS = [
  'ask-for-clarification',
  'inspect-target-files',
  'apply-edit-plan',
  'repair-terraform-formatting',
  'validate-targets',
  'stop'
] as const;
const AGENT_CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
const AGENT_DECISION_EXECUTION_STATUSES = ['completed', 'skipped'] as const;
const AGENT_STOP_REASONS = [
  'validation-succeeded',
  'validation-blocked',
  'repair-budget-exhausted',
  'no-safe-action'
] as const;
const AGENT_CLARIFICATION_KINDS = [
  'approval-required',
  'target-ambiguity',
  'workspace-policy',
  'general'
] as const;
const TOOL_SAFETIES = ['read_only', 'write_scoped', 'validate', 'approval_required'] as const;
const TOOL_PERMISSION_CATEGORIES = [
  'workspace-read',
  'workspace-write',
  'local-validation',
  'native-cli-read',
  'native-cli-validation',
  'native-cli-write',
  'native-stack-config-write',
  'approval-required',
  'unknown'
] as const;
const DOCTOR_CHECK_STATUSES = ['pass', 'warn', 'fail'] as const;
const VALIDATION_COMMAND_STATUSES = ['passed', 'failed'] as const;
const VALIDATION_COMMAND_KINDS = ['yaml-guard', 'target-validation'] as const;
const VALIDATION_PLAN_KINDS = ['helm', 'pulumi', 'terraform'] as const;
const VALIDATION_SAFETY_BLOCKER_KINDS = ['unsafe-validation-command', 'yaml-syntax-failure'] as const;
const VALIDATION_ISSUE_KINDS = [
  'helm-missing-service-port',
  'helm-missing-ingress-values',
  'pulumi-create-before-delete-conflict',
  'pulumi-missing-config',
  'pulumi-preview-failure',
  'terraform-create-before-delete-conflict',
  'terraform-formatting-required',
  'terraform-validate-failure',
  'unsafe-validation-command',
  'yaml-syntax-failure',
  'unknown-validation-failure'
] as const;
const FILE_WRITE_RISKS = ['low', 'medium', 'high'] as const;
const APPROVAL_SIGNAL_KINDS = ['write-approval-required', 'tool-category-approval-required'] as const;
const APPROVAL_WRITE_PATH_SCOPES = ['all', 'scoped'] as const;
const PLANNER_HANDOFF_ACTIVE_BLOCKERS = [
  'none',
  'approval',
  'clarification',
  'validation',
  'repair-budget',
  'turn-budget',
  'no-safe-action'
] as const;
const PLANNER_HANDOFF_NEXT_CONTROL_ACTIONS = [
  'review-result',
  'request-approval',
  'answer-clarification',
  'resolve-validation',
  'manual-repair',
  'rerun-with-larger-turn-budget',
  'inspect-readiness-or-targeting'
] as const;
const LIFECYCLE_EVENT_NAMES = [
  'query-started',
  'decision',
  'tool-execution',
  'approval-gate',
  'terminal'
] as const;
const TURN_TRACE_PRESERVED_WINDOWS = ['head'] as const;
const TOOL_TRACE_PRESERVED_WINDOWS = ['tail'] as const;
const IDENTITY_CONFLICT_RISK_CATEGORIES = [
  'create-before-delete-ordering',
  'dns-or-domain-ownership',
  'exclusive-identity-review',
  'kubernetes-object-ownership',
  'physical-name-ownership'
] as const;
const IDENTITY_CONFLICT_ENGINES = ['pulumi', 'terraform'] as const;
const RETRIEVED_CONTEXT_OMITTED_REASONS = ['packet-limit', 'token-budget'] as const;
const KNOWLEDGE_FACT_DOMAINS = ['helm', 'pulumi', 'terraform'] as const;
const KNOWLEDGE_FACT_SOURCE_KINDS = [
  'terraform-registry',
  'pulumi-docs',
  'helm-docs',
  'chart-docs',
  'chart-metadata',
  'provider-schema',
  'chart-schema',
  'chart-lock',
  'repo-example',
  'pulumi-config',
  'pulumi-component',
  'terraform-module',
  'module-readme'
] as const;
const KNOWLEDGE_FACT_KINDS = [
  'argument',
  'attribute',
  'nested-block',
  'example',
  'identity-field',
  'replacement-sensitive-field',
  'module-input',
  'module-output',
  'chart-metadata',
  'chart-dependency',
  'chart-value',
  'pulumi-config-parameter',
  'pulumi-component-input',
  'pulumi-component-child-resource',
  'pulumi-component-output',
  'pulumi-docs-guidance'
] as const;
const KNOWLEDGE_FACT_EXTRACTION_METHODS = [
  'terraform-registry-markdown',
  'pulumi-docs-markdown',
  'helm-chart-docs-markdown',
  'terraform-provider-schema',
  'helm-values-schema',
  'repo-local-static'
] as const;
const KNOWLEDGE_UNIT_TYPES = ['fact', 'guidance', 'example', 'diagnostic', 'recipe'] as const;
const KNOWLEDGE_UNIT_EXTRACTION_METHODS = [
  ...KNOWLEDGE_FACT_EXTRACTION_METHODS,
  'official-guidance',
  'repo-local-guidance',
  'official-example',
  'repo-local-example',
  'validation-diagnostic',
  'terraform-plan-diagnostic',
  'pulumi-preview-diagnostic',
  'provider-diagnostic',
  'workflow-recipe'
] as const;
const KNOWLEDGE_UNIT_PRIVACY_SCOPES = [
  'public-reference',
  'workspace-private',
  'internal-team',
  'private-run'
] as const;
const KNOWLEDGE_DIAGNOSTIC_ENGINES = ['terraform', 'pulumi', 'helm', 'provider', 'runtime'] as const;
const KNOWLEDGE_SOURCE_FRESHNESS = ['fresh', 'stale', 'unchecked'] as const;
const KNOWLEDGE_SOURCE_STALE_REASONS = [
  'time-expired',
  'local-file-hash-mismatch',
  'local-file-missing'
] as const;
const KNOWLEDGE_FACT_RAW_FIELDS = new Set([
  'source',
  'content',
  'contentHash',
  'fetchedAt',
  'staleAfter',
  'url',
  'localPath',
  'sourceContentHash',
  'sourceFetchedAt'
]);
const KNOWLEDGE_PACK_ID_PATTERN = /^[a-f0-9]{24}$/;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const KNOWLEDGE_CACHE_SOURCES = [
  'environment: INFRA_AGENT_KNOWLEDGE_CACHE',
  'workspace-config: knowledgeCache.root',
  'default: user cache'
] as const;
const HANDOFF_CHECKPOINT_SOURCES = ['agent-result'] as const;
const HANDOFF_CHECKPOINT_PRIMARY_ARTIFACTS = ['agent --json'] as const;
const HANDOFF_CHECKPOINT_DEBUG_ARTIFACTS = ['agent --json-full'] as const;
const HANDOFF_CHECKPOINT_DURABLE_SECTIONS = [
  'root',
  'harness',
  'validation',
  'approval',
  'knowledge',
  'readiness',
  'result-card'
] as const;
const TARGETING_SOURCES = ['derived-run-preflight'] as const;
const TARGET_CANDIDATE_KINDS = ['helm-chart', 'pulumi-project', 'terraform-root'] as const;
const TARGET_CANDIDATE_DOMAINS = ['helm', 'pulumi', 'terraform'] as const;
const TARGETING_AMBIGUITY_KINDS = [
  'missing-environment',
  'missing-service',
  'no-candidates',
  'weak-match',
  'tied-top-score'
] as const;
const TARGETING_RECOMMENDED_ACTIONS = [
  'inspect-selected-target',
  'review-targeting',
  'clarify-target'
] as const;
const WORK_PLAN_SOURCES = ['derived-agent-run-state'] as const;
const WORK_PLAN_STATUSES = ['not-started', 'in-progress', 'blocked', 'completed'] as const;
const WORK_PLAN_STEP_KINDS = ['readiness', 'targeting', 'inspection', 'edit', 'validation', 'handoff'] as const;
const WORK_PLAN_STEP_STATUSES = ['pending', 'in-progress', 'blocked', 'completed', 'skipped'] as const;
const PLANNER_MODES = ['auto', 'llm', 'rule-based'] as const;
const PLANNER_EFFECTIVE_MODES = ['llm', 'rule-based', 'custom'] as const;
const LLM_PLANNER_PROVIDERS = ['openai-compatible'] as const;
const LLM_CONFIG_SOURCES = ['cli', 'env', 'default', 'unknown'] as const;
const LLM_API_KEY_SOURCES = ['INFRA_AGENT_OPENAI_API_KEY', 'OPENAI_API_KEY', 'unknown'] as const;
const LLM_PROVIDER_TRANSPORTS = ['chat-completions'] as const;
const LLM_PROVIDER_ENDPOINT_PATHS = ['/chat/completions'] as const;
const LLM_PROVIDER_RESPONSE_FORMATS = ['json-object'] as const;
const PLANNER_PROVIDER_CATALOG_DISCOVERY_SOURCES = ['static-catalog'] as const;
const PLANNER_PROVIDER_CATALOG_COMMAND = 'infra-agent planner-providers --json';
const PLANNER_PROVIDER_CATALOG_SUPPORTED_IDS = ['openai-compatible'] as const;
const PLANNER_PROVIDER_CATALOG_DISCOVERY_FIELDS = [
  'schemaVersion',
  'source',
  'command',
  'mutationAllowed',
  'liveProviderCheck',
  'plannerOnly',
  'providerCount',
  'supportedProviderCount',
  'supportedProviderIds'
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKnownAgentResultOutcome(value: unknown): boolean {
  return typeof value === 'string' && AGENT_RUN_OUTCOMES.includes(value as typeof AGENT_RUN_OUTCOMES[number]);
}

function isKnownHandoffCheckpointSource(value: unknown): boolean {
  return typeof value === 'string' && HANDOFF_CHECKPOINT_SOURCES.includes(value as typeof HANDOFF_CHECKPOINT_SOURCES[number]);
}

function isKnownHandoffCheckpointPrimaryArtifact(value: unknown): boolean {
  return typeof value === 'string'
    && HANDOFF_CHECKPOINT_PRIMARY_ARTIFACTS.includes(value as typeof HANDOFF_CHECKPOINT_PRIMARY_ARTIFACTS[number]);
}

function isKnownHandoffCheckpointDebugArtifact(value: unknown): boolean {
  return typeof value === 'string'
    && HANDOFF_CHECKPOINT_DEBUG_ARTIFACTS.includes(value as typeof HANDOFF_CHECKPOINT_DEBUG_ARTIFACTS[number]);
}

function isKnownHandoffCheckpointDurableSection(value: unknown): boolean {
  return typeof value === 'string'
    && HANDOFF_CHECKPOINT_DURABLE_SECTIONS.includes(value as typeof HANDOFF_CHECKPOINT_DURABLE_SECTIONS[number]);
}

function isKnownAgentActionKind(value: unknown): boolean {
  return typeof value === 'string' && AGENT_ACTION_KINDS.includes(value as typeof AGENT_ACTION_KINDS[number]);
}

function isKnownAgentActionFamily(value: unknown): boolean {
  return typeof value === 'string' && AGENT_ACTION_FAMILIES.includes(value as typeof AGENT_ACTION_FAMILIES[number]);
}

function isKnownAgentConfidence(value: unknown): boolean {
  return typeof value === 'string' && AGENT_CONFIDENCE_LEVELS.includes(value as typeof AGENT_CONFIDENCE_LEVELS[number]);
}

function isKnownAgentDecisionExecutionStatus(value: unknown): boolean {
  return typeof value === 'string'
    && AGENT_DECISION_EXECUTION_STATUSES.includes(value as typeof AGENT_DECISION_EXECUTION_STATUSES[number]);
}

function isKnownAgentStopReason(value: unknown): boolean {
  return typeof value === 'string' && AGENT_STOP_REASONS.includes(value as typeof AGENT_STOP_REASONS[number]);
}

function isKnownAgentClarificationKind(value: unknown): boolean {
  return typeof value === 'string'
    && AGENT_CLARIFICATION_KINDS.includes(value as typeof AGENT_CLARIFICATION_KINDS[number]);
}

function isKnownToolSafety(value: unknown): boolean {
  return typeof value === 'string' && TOOL_SAFETIES.includes(value as typeof TOOL_SAFETIES[number]);
}

function isKnownToolPermissionCategory(value: unknown): boolean {
  return typeof value === 'string'
    && TOOL_PERMISSION_CATEGORIES.includes(value as typeof TOOL_PERMISSION_CATEGORIES[number]);
}

function isKnownDoctorCheckStatus(value: unknown): boolean {
  return typeof value === 'string' && DOCTOR_CHECK_STATUSES.includes(value as typeof DOCTOR_CHECK_STATUSES[number]);
}

function isKnownValidationCommandStatus(value: unknown): boolean {
  return typeof value === 'string'
    && VALIDATION_COMMAND_STATUSES.includes(value as typeof VALIDATION_COMMAND_STATUSES[number]);
}

function isKnownValidationCommandKind(value: unknown): boolean {
  return typeof value === 'string' && VALIDATION_COMMAND_KINDS.includes(value as typeof VALIDATION_COMMAND_KINDS[number]);
}

function isKnownValidationPlanKind(value: unknown): boolean {
  return typeof value === 'string' && VALIDATION_PLAN_KINDS.includes(value as typeof VALIDATION_PLAN_KINDS[number]);
}

function isKnownValidationSafetyBlockerKind(value: unknown): boolean {
  return typeof value === 'string'
    && VALIDATION_SAFETY_BLOCKER_KINDS.includes(value as typeof VALIDATION_SAFETY_BLOCKER_KINDS[number]);
}

function isKnownValidationIssueKind(value: unknown): boolean {
  return typeof value === 'string' && VALIDATION_ISSUE_KINDS.includes(value as typeof VALIDATION_ISSUE_KINDS[number]);
}

function isKnownFileWriteRisk(value: unknown): boolean {
  return typeof value === 'string' && FILE_WRITE_RISKS.includes(value as typeof FILE_WRITE_RISKS[number]);
}

function isKnownApprovalSignalKind(value: unknown): boolean {
  return typeof value === 'string' && APPROVAL_SIGNAL_KINDS.includes(value as typeof APPROVAL_SIGNAL_KINDS[number]);
}

function isKnownApprovalWritePathScope(value: unknown): boolean {
  return typeof value === 'string'
    && APPROVAL_WRITE_PATH_SCOPES.includes(value as typeof APPROVAL_WRITE_PATH_SCOPES[number]);
}

function isKnownPlannerHandoffActiveBlocker(value: unknown): boolean {
  return typeof value === 'string'
    && PLANNER_HANDOFF_ACTIVE_BLOCKERS.includes(value as typeof PLANNER_HANDOFF_ACTIVE_BLOCKERS[number]);
}

function isKnownPlannerHandoffNextControlAction(value: unknown): boolean {
  return typeof value === 'string'
    && PLANNER_HANDOFF_NEXT_CONTROL_ACTIONS.includes(value as typeof PLANNER_HANDOFF_NEXT_CONTROL_ACTIONS[number]);
}

function isKnownLifecycleEventName(value: unknown): boolean {
  return typeof value === 'string'
    && LIFECYCLE_EVENT_NAMES.includes(value as typeof LIFECYCLE_EVENT_NAMES[number]);
}

function isKnownTurnTracePreservedWindow(value: unknown): boolean {
  return typeof value === 'string'
    && TURN_TRACE_PRESERVED_WINDOWS.includes(value as typeof TURN_TRACE_PRESERVED_WINDOWS[number]);
}

function isKnownToolTracePreservedWindow(value: unknown): boolean {
  return typeof value === 'string'
    && TOOL_TRACE_PRESERVED_WINDOWS.includes(value as typeof TOOL_TRACE_PRESERVED_WINDOWS[number]);
}

function isKnownIdentityConflictEngine(value: unknown): boolean {
  return typeof value === 'string'
    && IDENTITY_CONFLICT_ENGINES.includes(value as typeof IDENTITY_CONFLICT_ENGINES[number]);
}

function isKnownIdentityConflictRiskCategory(value: unknown): boolean {
  return typeof value === 'string'
    && IDENTITY_CONFLICT_RISK_CATEGORIES.includes(value as typeof IDENTITY_CONFLICT_RISK_CATEGORIES[number]);
}

function isKnownRetrievedContextOmittedReason(value: unknown): boolean {
  return typeof value === 'string'
    && RETRIEVED_CONTEXT_OMITTED_REASONS.includes(value as typeof RETRIEVED_CONTEXT_OMITTED_REASONS[number]);
}

function isKnownKnowledgeCacheSource(value: unknown): boolean {
  return typeof value === 'string'
    && KNOWLEDGE_CACHE_SOURCES.includes(value as typeof KNOWLEDGE_CACHE_SOURCES[number]);
}

function isKnownKnowledgeFactDomain(value: unknown): boolean {
  return typeof value === 'string'
    && KNOWLEDGE_FACT_DOMAINS.includes(value as typeof KNOWLEDGE_FACT_DOMAINS[number]);
}

function isKnownKnowledgeFactSourceKind(value: unknown): boolean {
  return typeof value === 'string'
    && KNOWLEDGE_FACT_SOURCE_KINDS.includes(value as typeof KNOWLEDGE_FACT_SOURCE_KINDS[number]);
}

function isKnownKnowledgeFactKind(value: unknown): boolean {
  return typeof value === 'string'
    && KNOWLEDGE_FACT_KINDS.includes(value as typeof KNOWLEDGE_FACT_KINDS[number]);
}

function isKnownKnowledgeFactExtractionMethod(value: unknown): boolean {
  return typeof value === 'string'
    && KNOWLEDGE_FACT_EXTRACTION_METHODS.includes(value as typeof KNOWLEDGE_FACT_EXTRACTION_METHODS[number]);
}

function isKnownKnowledgeUnitType(value: unknown): boolean {
  return typeof value === 'string'
    && KNOWLEDGE_UNIT_TYPES.includes(value as typeof KNOWLEDGE_UNIT_TYPES[number]);
}

function isKnownKnowledgeUnitExtractionMethod(value: unknown): boolean {
  return typeof value === 'string'
    && KNOWLEDGE_UNIT_EXTRACTION_METHODS.includes(value as typeof KNOWLEDGE_UNIT_EXTRACTION_METHODS[number]);
}

function isKnownKnowledgeUnitPrivacyScope(value: unknown): boolean {
  return typeof value === 'string'
    && KNOWLEDGE_UNIT_PRIVACY_SCOPES.includes(value as typeof KNOWLEDGE_UNIT_PRIVACY_SCOPES[number]);
}

function isKnownKnowledgeDiagnosticEngine(value: unknown): boolean {
  return typeof value === 'string'
    && KNOWLEDGE_DIAGNOSTIC_ENGINES.includes(value as typeof KNOWLEDGE_DIAGNOSTIC_ENGINES[number]);
}

function isKnownKnowledgeSourceFreshness(value: unknown): boolean {
  return typeof value === 'string'
    && KNOWLEDGE_SOURCE_FRESHNESS.includes(value as typeof KNOWLEDGE_SOURCE_FRESHNESS[number]);
}

function isKnownKnowledgeSourceStaleReason(value: unknown): boolean {
  return typeof value === 'string'
    && KNOWLEDGE_SOURCE_STALE_REASONS.includes(value as typeof KNOWLEDGE_SOURCE_STALE_REASONS[number]);
}

function isKnownTargetingSource(value: unknown): boolean {
  return typeof value === 'string' && TARGETING_SOURCES.includes(value as typeof TARGETING_SOURCES[number]);
}

function isKnownTargetCandidateKind(value: unknown): boolean {
  return typeof value === 'string'
    && TARGET_CANDIDATE_KINDS.includes(value as typeof TARGET_CANDIDATE_KINDS[number]);
}

function isKnownTargetCandidateDomain(value: unknown): boolean {
  return typeof value === 'string'
    && TARGET_CANDIDATE_DOMAINS.includes(value as typeof TARGET_CANDIDATE_DOMAINS[number]);
}

function isKnownTargetingAmbiguityKind(value: unknown): boolean {
  return typeof value === 'string'
    && TARGETING_AMBIGUITY_KINDS.includes(value as typeof TARGETING_AMBIGUITY_KINDS[number]);
}

function isKnownTargetingRecommendedAction(value: unknown): boolean {
  return typeof value === 'string'
    && TARGETING_RECOMMENDED_ACTIONS.includes(value as typeof TARGETING_RECOMMENDED_ACTIONS[number]);
}

function isKnownWorkPlanSource(value: unknown): boolean {
  return typeof value === 'string' && WORK_PLAN_SOURCES.includes(value as typeof WORK_PLAN_SOURCES[number]);
}

function isKnownWorkPlanStatus(value: unknown): boolean {
  return typeof value === 'string' && WORK_PLAN_STATUSES.includes(value as typeof WORK_PLAN_STATUSES[number]);
}

function isKnownWorkPlanStepKind(value: unknown): boolean {
  return typeof value === 'string' && WORK_PLAN_STEP_KINDS.includes(value as typeof WORK_PLAN_STEP_KINDS[number]);
}

function isKnownWorkPlanStepStatus(value: unknown): boolean {
  return typeof value === 'string' && WORK_PLAN_STEP_STATUSES.includes(value as typeof WORK_PLAN_STEP_STATUSES[number]);
}

function isKnownPlannerMode(value: unknown): boolean {
  return typeof value === 'string' && PLANNER_MODES.includes(value as typeof PLANNER_MODES[number]);
}

function isKnownPlannerEffectiveMode(value: unknown): boolean {
  return typeof value === 'string' && PLANNER_EFFECTIVE_MODES.includes(value as typeof PLANNER_EFFECTIVE_MODES[number]);
}

function isKnownLLMPlannerProvider(value: unknown): boolean {
  return typeof value === 'string' && LLM_PLANNER_PROVIDERS.includes(value as typeof LLM_PLANNER_PROVIDERS[number]);
}

function isKnownLLMConfigSource(value: unknown): boolean {
  return typeof value === 'string' && LLM_CONFIG_SOURCES.includes(value as typeof LLM_CONFIG_SOURCES[number]);
}

function isKnownLLMApiKeySource(value: unknown): boolean {
  return typeof value === 'string' && LLM_API_KEY_SOURCES.includes(value as typeof LLM_API_KEY_SOURCES[number]);
}

function isKnownLLMProviderTransport(value: unknown): boolean {
  return typeof value === 'string' && LLM_PROVIDER_TRANSPORTS.includes(value as typeof LLM_PROVIDER_TRANSPORTS[number]);
}

function isKnownLLMProviderEndpointPath(value: unknown): boolean {
  return typeof value === 'string' && LLM_PROVIDER_ENDPOINT_PATHS.includes(value as typeof LLM_PROVIDER_ENDPOINT_PATHS[number]);
}

function isKnownLLMProviderResponseFormat(value: unknown): boolean {
  return typeof value === 'string'
    && LLM_PROVIDER_RESPONSE_FORMATS.includes(value as typeof LLM_PROVIDER_RESPONSE_FORMATS[number]);
}

function assertCompactApprovalSignal(value: unknown, signalPath: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`compact result input ${signalPath} must be an object.`);
  }

  if (!isKnownApprovalSignalKind(value.kind)) {
    throw new Error(`compact result input ${signalPath}.kind must be supported.`);
  }

  if (typeof value.message !== 'string') {
    throw new Error(`compact result input ${signalPath}.message must be a string.`);
  }

  if (value.kind === 'write-approval-required') {
    if (typeof value.path !== 'string' || value.path.length === 0) {
      throw new Error(`compact result input ${signalPath}.path must be a non-empty string for write approval signals.`);
    }

    if (!isKnownFileWriteRisk(value.risk)) {
      throw new Error(`compact result input ${signalPath}.risk must be supported for write approval signals.`);
    }

    if (value.toolCategory !== null) {
      throw new Error(`compact result input ${signalPath}.toolCategory must be null for write approval signals.`);
    }
  }

  if (value.kind === 'tool-category-approval-required') {
    if (!isKnownToolPermissionCategory(value.toolCategory)) {
      throw new Error(`compact result input ${signalPath}.toolCategory must be supported for tool category approval signals.`);
    }

    if (value.path !== null || value.risk !== null) {
      throw new Error(`compact result input ${signalPath}.path and risk must be null for tool category approval signals.`);
    }
  }
}

function compactApprovalSignalsMatch(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return left.kind === right.kind
    && left.message === right.message
    && left.path === right.path
    && left.risk === right.risk
    && left.toolCategory === right.toolCategory;
}

function isNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): boolean {
  return isNumber(value) && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): boolean {
  return isNumber(value) && Number.isInteger(value) && value > 0;
}

function isStringOrNull(value: unknown): boolean {
  return typeof value === 'string' || value === null;
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(entry => typeof entry === 'string');
}

function normalizeApprovalPath(path: string): string {
  return path.replace(/^\.\/+/, '').replace(/\/+$/, '');
}

function isArrayOf(value: unknown, validator: (entry: unknown) => boolean): boolean {
  return Array.isArray(value) && value.every(entry => validator(entry));
}

function hasNumericCountSet(record: Record<string, unknown>): boolean {
  return isNumber(record.totalCount) && isNumber(record.includedCount) && isNumber(record.omittedCount);
}

function hasConsistentCountSet(record: Record<string, unknown>): boolean {
  return typeof record.totalCount === 'number'
    && typeof record.includedCount === 'number'
    && typeof record.omittedCount === 'number'
    && record.includedCount + record.omittedCount === record.totalCount;
}

function assertNumericMap(
  record: Record<string, unknown>,
  fieldName: string,
  keyValidator: (value: unknown) => boolean
): void {
  for (const [key, value] of Object.entries(record)) {
    if (!keyValidator(key) || !isNonNegativeInteger(value)) {
      throw new Error(`compact result input ${fieldName} must use supported non-negative integer keys when present.`);
    }
  }
}

function assertIntegerField(
  record: Record<string, unknown>,
  field: string,
  fieldPath: string,
  validator: (value: unknown) => boolean,
  description: string
): void {
  if (!validator(record[field])) {
    throw new Error(`compact result input ${fieldPath}.${field} must be ${description}.`);
  }
}

function assertHandoffBudgetSample(
  value: unknown,
  fieldPath: string,
  extraCountFields: string[] = []
): void {
  if (!isRecord(value)) {
    throw new Error(`compact result input ${fieldPath} must be an object.`);
  }

  for (const field of ['includedCount', 'omittedCount', ...extraCountFields]) {
    assertIntegerField(value, field, fieldPath, isNonNegativeInteger, 'a non-negative integer');
  }
}

function assertHandoffBudgetMatches(
  value: unknown,
  fieldPath: string,
  includedCount: number,
  omittedCount: number,
  sourcePath: string
): void {
  if (!isRecord(value)) {
    throw new Error(`compact result input ${fieldPath} must be an object.`);
  }

  if (value.includedCount !== includedCount || value.omittedCount !== omittedCount) {
    throw new Error(`compact result input ${fieldPath} must match ${sourcePath}.`);
  }
}

function findRawKnowledgeFactField(value: unknown, fieldPath: string): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findRawKnowledgeFactField(value[index], `${fieldPath}[${index}]`);
      if (found !== null) {
        return found;
      }
    }
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = `${fieldPath}.${key}`;
    if (KNOWLEDGE_FACT_RAW_FIELDS.has(key)) {
      return nestedPath;
    }
    const found = findRawKnowledgeFactField(nestedValue, nestedPath);
    if (found !== null) {
      return found;
    }
  }

  return null;
}

function assertOptionalStringArrayField(record: Record<string, unknown>, field: string, fieldPath: string): void {
  if (field in record && !isStringArray(record[field])) {
    throw new Error(`compact result input ${fieldPath}.${field} must be a string array when present.`);
  }
}

function assertOptionalStringField(record: Record<string, unknown>, field: string, fieldPath: string): void {
  if (field in record && typeof record[field] !== 'string') {
    throw new Error(`compact result input ${fieldPath}.${field} must be a string when present.`);
  }
}

function assertKnowledgeFactOptionalFields(fact: Record<string, unknown>, factPath: string): void {
  if ('required' in fact && typeof fact.required !== 'boolean') {
    throw new Error(`compact result input ${factPath}.required must be a boolean when present.`);
  }

  for (const field of ['type', 'defaultValue']) {
    assertOptionalStringField(fact, field, factPath);
  }

  for (const field of ['values', 'relatedPaths']) {
    assertOptionalStringArrayField(fact, field, factPath);
  }
}

function assertKnowledgeUnitPayload(unit: Record<string, unknown>, unitPath: string): void {
  switch (unit.unitType) {
    case 'fact':
      if (!isKnownKnowledgeFactKind(unit.factKind)) {
        throw new Error(`compact result input ${unitPath}.factKind must be supported.`);
      }
      assertKnowledgeFactOptionalFields(unit, unitPath);
      break;
    case 'guidance':
      if (typeof unit.topic !== 'string' || unit.topic.length === 0) {
        throw new Error(`compact result input ${unitPath}.topic must be a non-empty string.`);
      }
      assertOptionalStringArrayField(unit, 'appliesWhen', unitPath);
      assertOptionalStringArrayField(unit, 'avoidWhen', unitPath);
      assertOptionalStringField(unit, 'risk', unitPath);
      break;
    case 'example':
      for (const field of ['exampleType', 'snippet']) {
        if (typeof unit[field] !== 'string' || (unit[field] as string).length === 0) {
          throw new Error(`compact result input ${unitPath}.${field} must be a non-empty string.`);
        }
      }
      assertOptionalStringField(unit, 'language', unitPath);
      assertOptionalStringArrayField(unit, 'appliesWhen', unitPath);
      assertOptionalStringArrayField(unit, 'avoidWhen', unitPath);
      break;
    case 'diagnostic':
      if (!isKnownKnowledgeDiagnosticEngine(unit.engine)) {
        throw new Error(`compact result input ${unitPath}.engine must be supported.`);
      }
      for (const field of ['signature', 'likelyCause']) {
        if (typeof unit[field] !== 'string' || (unit[field] as string).length === 0) {
          throw new Error(`compact result input ${unitPath}.${field} must be a non-empty string.`);
        }
      }
      if (!isStringArray(unit.recommendedReview)) {
        throw new Error(`compact result input ${unitPath}.recommendedReview must be a string array.`);
      }
      break;
    case 'recipe':
      if (typeof unit.name !== 'string' || unit.name.length === 0) {
        throw new Error(`compact result input ${unitPath}.name must be a non-empty string.`);
      }
      if (!isStringArray(unit.steps)) {
        throw new Error(`compact result input ${unitPath}.steps must be a string array.`);
      }
      if ('requiresApproval' in unit && typeof unit.requiresApproval !== 'boolean') {
        throw new Error(`compact result input ${unitPath}.requiresApproval must be a boolean when present.`);
      }
      if (unit.mutationAllowed !== false) {
        throw new Error(`compact result input ${unitPath}.mutationAllowed must be false.`);
      }
      break;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractCommandFlagValues(command: string, flag: string): string[] {
  return [...command.matchAll(new RegExp(`(?:^|\\s)${escapeRegExp(flag)}\\s+(\\S+)`, 'g'))]
    .map(match => match[1] ?? '')
    .map(value => value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value);
}

function assertCommandIncludesQueryConfigFlags(command: unknown, harness: unknown, fieldPath: string): void {
  if (typeof command !== 'string' || !isRecord(harness) || !isRecord(harness.queryConfig)) {
    return;
  }

  const queryConfig = harness.queryConfig;
  if (!isRecord(queryConfig.retrievedContextBudget)) {
    return;
  }

  const expectedFlags = [
    ['--max-turns', queryConfig.maxTurns],
    ['--max-repair-attempts', queryConfig.maxRepairAttempts],
    ['--context-packet-limit', queryConfig.retrievedContextBudget.maxPackets],
    ['--context-token-budget', queryConfig.retrievedContextBudget.maxTokens],
    ['--context-fact-limit', queryConfig.retrievedContextBudget.maxFacts]
  ];

  for (const [flag, expectedValue] of expectedFlags) {
    const values = extractCommandFlagValues(command, String(flag));
    if (values.length !== 1 || values[0] !== String(expectedValue)) {
      throw new Error(`compact result input ${fieldPath} must include query config flags exactly.`);
    }
  }
}

function assertCommandIncludesPlannerConfigFlags(
  command: unknown,
  harness: unknown,
  fieldPath: string,
  options: { includePlannerMode?: boolean } = {}
): void {
  if (typeof command !== 'string' || !isRecord(harness) || !isRecord(harness.plannerConfig)) {
    return;
  }

  const plannerConfig = harness.plannerConfig;
  const expectedFlags: Array<[string, unknown]> = [];

  if (options.includePlannerMode !== false && plannerConfig.requestedMode !== 'auto') {
    expectedFlags.push(['--planner', plannerConfig.requestedMode]);
  }

  if (isRecord(plannerConfig.llm)) {
    if (plannerConfig.llm.providerSource === 'cli') {
      expectedFlags.push(['--llm-provider', plannerConfig.llm.provider]);
    }
    if (plannerConfig.llm.modelSource === 'cli') {
      expectedFlags.push(['--model', plannerConfig.llm.model]);
    }
    if (plannerConfig.llm.baseUrlSource === 'cli') {
      expectedFlags.push(['--openai-base-url', plannerConfig.llm.baseUrl]);
    }
  }

  for (const [flag, expectedValue] of expectedFlags) {
    const values = extractCommandFlagValues(command, flag);
    if (values.length !== 1 || values[0] !== String(expectedValue)) {
      throw new Error(`compact result input ${fieldPath} must include planner config flags exactly.`);
    }
  }

  if (options.includePlannerMode === false && extractCommandFlagValues(command, '--planner').length > 0) {
    throw new Error(`compact result input ${fieldPath} must not include planner mode flags.`);
  }
}

function assertPlannerProviderCatalogDiscovery(value: unknown, fieldPath: string): void {
  if (!isRecord(value)) {
    throw new Error(`compact result input ${fieldPath} must be an object.`);
  }

  for (const field of Object.keys(value)) {
    if (!PLANNER_PROVIDER_CATALOG_DISCOVERY_FIELDS.includes(
      field as typeof PLANNER_PROVIDER_CATALOG_DISCOVERY_FIELDS[number]
    )) {
      throw new Error(`compact result input ${fieldPath}.${field} must not be included.`);
    }
  }

  if (value.schemaVersion !== 1) {
    throw new Error(`compact result input ${fieldPath}.schemaVersion must be 1.`);
  }

  if (
    typeof value.source !== 'string'
    || !PLANNER_PROVIDER_CATALOG_DISCOVERY_SOURCES.includes(
      value.source as typeof PLANNER_PROVIDER_CATALOG_DISCOVERY_SOURCES[number]
    )
  ) {
    throw new Error(`compact result input ${fieldPath}.source must be supported.`);
  }

  if (value.command !== PLANNER_PROVIDER_CATALOG_COMMAND) {
    throw new Error(`compact result input ${fieldPath}.command must be ${PLANNER_PROVIDER_CATALOG_COMMAND}.`);
  }

  if (value.mutationAllowed !== false) {
    throw new Error(`compact result input ${fieldPath}.mutationAllowed must be false.`);
  }

  if (value.liveProviderCheck !== false) {
    throw new Error(`compact result input ${fieldPath}.liveProviderCheck must be false.`);
  }

  if (value.plannerOnly !== true) {
    throw new Error(`compact result input ${fieldPath}.plannerOnly must be true.`);
  }

  for (const field of ['providerCount', 'supportedProviderCount']) {
    assertIntegerField(value, field, fieldPath, isNonNegativeInteger, 'a non-negative integer');
  }

  if ((value.supportedProviderCount as number) > (value.providerCount as number)) {
    throw new Error(`compact result input ${fieldPath}.supportedProviderCount must not exceed providerCount.`);
  }

  if (
    !Array.isArray(value.supportedProviderIds)
    || value.supportedProviderIds.length !== PLANNER_PROVIDER_CATALOG_SUPPORTED_IDS.length
    || value.supportedProviderIds.some((providerId, index) => providerId !== PLANNER_PROVIDER_CATALOG_SUPPORTED_IDS[index])
  ) {
    throw new Error(`compact result input ${fieldPath}.supportedProviderIds must match supported planner provider ids.`);
  }

  if (value.supportedProviderCount !== value.supportedProviderIds.length) {
    throw new Error(`compact result input ${fieldPath}.supportedProviderCount must match supportedProviderIds length.`);
  }
}

function approvalGrantsCoverSignal(signal: Record<string, unknown>, grants: Record<string, unknown>): boolean {
  if (
    signal.kind === 'tool-category-approval-required'
    && typeof signal.toolCategory === 'string'
    && Array.isArray(grants.approvedToolCategories)
  ) {
    return grants.approvedToolCategories.includes(signal.toolCategory);
  }

  if (
    signal.kind !== 'write-approval-required'
    || typeof signal.risk !== 'string'
    || typeof signal.path !== 'string'
    || !Array.isArray(grants.approvedWriteRisks)
    || !Array.isArray(grants.approvedWritePaths)
    || !grants.approvedWriteRisks.includes(signal.risk)
  ) {
    return false;
  }

  if (grants.approvedWritePaths.length === 0) {
    return true;
  }

  const signalPath = normalizeApprovalPath(signal.path);
  return grants.approvedWritePaths
    .filter((approvedPath): approvedPath is string => typeof approvedPath === 'string')
    .map(normalizeApprovalPath)
    .some(approvedPath => signalPath === approvedPath || signalPath.startsWith(`${approvedPath}/`));
}

function expectedIdentityIssueKind(engine: unknown): string | null {
  if (engine === 'terraform') {
    return 'terraform-create-before-delete-conflict';
  }

  if (engine === 'pulumi') {
    return 'pulumi-create-before-delete-conflict';
  }

  return null;
}

function assertCompactTargeting(value: unknown): void {
  if (!isRecord(value)) {
    throw new Error('compact result input harness.targeting must be an object when harness is present.');
  }

  if (value.schemaVersion !== 1) {
    throw new Error('compact result input harness.targeting.schemaVersion must be 1.');
  }

  if (!isKnownTargetingSource(value.source)) {
    throw new Error('compact result input harness.targeting.source must be supported.');
  }

  if (value.compact !== true) {
    throw new Error('compact result input harness.targeting.compact must be true.');
  }

  if (value.mutationAllowed !== false) {
    throw new Error('compact result input harness.targeting.mutationAllowed must be false.');
  }

  for (const field of [
    'candidateCount',
    'maxCandidates',
    'includedCount',
    'omittedCount'
  ]) {
    assertIntegerField(value, field, 'harness.targeting', isNonNegativeInteger, 'a non-negative integer');
  }

  if (value.topScore !== null && !isNumber(value.topScore)) {
    throw new Error('compact result input harness.targeting.topScore must be a number or null.');
  }

  if (value.scoreGapToNext !== null && !isNumber(value.scoreGapToNext)) {
    throw new Error('compact result input harness.targeting.scoreGapToNext must be a number or null.');
  }

  if (!isKnownTargetingRecommendedAction(value.recommendedAction)) {
    throw new Error('compact result input harness.targeting.recommendedAction must be supported.');
  }

  if (!Array.isArray(value.ambiguityKinds)) {
    throw new Error('compact result input harness.targeting.ambiguityKinds must be an array.');
  }

  if (value.ambiguityKinds.some(kind => !isKnownTargetingAmbiguityKind(kind))) {
    throw new Error('compact result input harness.targeting.ambiguityKinds must use supported values.');
  }

  if (new Set(value.ambiguityKinds).size !== value.ambiguityKinds.length) {
    throw new Error('compact result input harness.targeting.ambiguityKinds must not include duplicates.');
  }

  if (!isRecord(value.flags)) {
    throw new Error('compact result input harness.targeting.flags must be an object.');
  }

  for (const field of ['missingEnvironment', 'missingService', 'noCandidates', 'weakTopScore', 'tiedTopScore']) {
    if (typeof value.flags[field] !== 'boolean') {
      throw new Error(`compact result input harness.targeting.flags.${field} must be a boolean.`);
    }
  }

  if (!Array.isArray(value.candidates)) {
    throw new Error('compact result input harness.targeting.candidates must be an array.');
  }

  if (value.includedCount !== value.candidates.length) {
    throw new Error('compact result input harness.targeting.includedCount must match candidates length.');
  }

  if ((value.includedCount as number) + (value.omittedCount as number) !== value.candidateCount) {
    throw new Error('compact result input harness.targeting candidate counts must be consistent.');
  }

  if ((value.includedCount as number) > (value.maxCandidates as number)) {
    throw new Error('compact result input harness.targeting.includedCount must not exceed maxCandidates.');
  }

  const selectedCandidateCount = value.candidates
    .filter(candidate => isRecord(candidate) && candidate.selected === true)
    .length;

  if (value.selectedTarget !== null) {
    if (!isRecord(value.selectedTarget)) {
      throw new Error('compact result input harness.targeting.selectedTarget must be an object or null.');
    }

    assertIntegerField(value.selectedTarget, 'rank', 'harness.targeting.selectedTarget', isPositiveInteger, 'a positive integer');

    if (!isKnownTargetCandidateKind(value.selectedTarget.kind)) {
      throw new Error('compact result input harness.targeting.selectedTarget.kind must be supported.');
    }

    if (!isKnownTargetCandidateDomain(value.selectedTarget.domain)) {
      throw new Error('compact result input harness.targeting.selectedTarget.domain must be supported.');
    }

    for (const field of ['name', 'path']) {
      if (typeof value.selectedTarget[field] !== 'string') {
        throw new Error(`compact result input harness.targeting.selectedTarget.${field} must be a string.`);
      }
    }

    if (!isNumber(value.selectedTarget.score)) {
      throw new Error('compact result input harness.targeting.selectedTarget.score must be a number.');
    }
  } else if (selectedCandidateCount > 0) {
    throw new Error('compact result input harness.targeting.selectedTarget is required when an included candidate is selected.');
  }

  let previousRank = 0;
  for (let index = 0; index < value.candidates.length; index += 1) {
    const candidate = value.candidates[index];
    const candidatePath = `harness.targeting.candidates[${index}]`;

    if (!isRecord(candidate)) {
      throw new Error(`compact result input ${candidatePath} must be an object.`);
    }

    assertIntegerField(candidate, 'rank', candidatePath, isPositiveInteger, 'a positive integer');

    if ((candidate.rank as number) <= previousRank) {
      throw new Error('compact result input harness.targeting.candidates ranks must be unique and ascending.');
    }
    previousRank = candidate.rank as number;

    if (typeof candidate.selected !== 'boolean') {
      throw new Error(`compact result input ${candidatePath}.selected must be a boolean.`);
    }

    if (!isKnownTargetCandidateKind(candidate.kind)) {
      throw new Error(`compact result input ${candidatePath}.kind must be supported.`);
    }

    if (!isKnownTargetCandidateDomain(candidate.domain)) {
      throw new Error(`compact result input ${candidatePath}.domain must be supported.`);
    }

    for (const field of ['name', 'path']) {
      if (typeof candidate[field] !== 'string') {
        throw new Error(`compact result input ${candidatePath}.${field} must be a string.`);
      }
    }

    if (!isNumber(candidate.score)) {
      throw new Error(`compact result input ${candidatePath}.score must be a number.`);
    }

    for (const field of ['reasonCount', 'detailCount']) {
      assertIntegerField(candidate, field, candidatePath, isNonNegativeInteger, 'a non-negative integer');
    }

    if (!isStringArray(candidate.reasons)) {
      throw new Error(`compact result input ${candidatePath}.reasons must be a string array.`);
    }

    if (!isStringArray(candidate.matchedEnvironmentHints)) {
      throw new Error(`compact result input ${candidatePath}.matchedEnvironmentHints must be a string array.`);
    }

    if (!isStringArray(candidate.details)) {
      throw new Error(`compact result input ${candidatePath}.details must be a string array.`);
    }

    if ((candidate.reasons as unknown[]).length > (candidate.reasonCount as number)) {
      throw new Error(`compact result input ${candidatePath}.reasons length must not exceed reasonCount.`);
    }

    if ((candidate.details as unknown[]).length > (candidate.detailCount as number)) {
      throw new Error(`compact result input ${candidatePath}.details length must not exceed detailCount.`);
    }
  }
}

function domainForTargetCandidateKind(kind: unknown): string | null {
  switch (kind) {
    case 'helm-chart':
      return 'helm';
    case 'pulumi-project':
      return 'pulumi';
    case 'terraform-root':
      return 'terraform';
    default:
      return null;
  }
}

function assertCompactTargetingConsistency(
  targeting: unknown,
  value: Record<string, unknown>
): void {
  if (!isRecord(targeting)) {
    return;
  }

  const candidates = Array.isArray(targeting.candidates)
    ? targeting.candidates.filter(isRecord)
    : [];
  const selectedCandidates = candidates.filter(candidate => candidate.selected === true);

  if (selectedCandidates.length > 1) {
    throw new Error('compact result input harness.targeting.candidates must include at most one selected candidate.');
  }

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const expectedDomain = domainForTargetCandidateKind(candidate.kind);
    if (expectedDomain !== candidate.domain) {
      throw new Error(`compact result input harness.targeting.candidates[${index}].domain must match kind.`);
    }
  }

  if (isRecord(targeting.selectedTarget)) {
    const expectedSelectedDomain = domainForTargetCandidateKind(targeting.selectedTarget.kind);
    if (expectedSelectedDomain !== targeting.selectedTarget.domain) {
      throw new Error('compact result input harness.targeting.selectedTarget.domain must match kind.');
    }
  }

  if (value.primaryTarget === null && targeting.selectedTarget !== null) {
    throw new Error('compact result input harness.targeting.selectedTarget must be null when root.primaryTarget is null.');
  }

  if (isRecord(value.primaryTarget)) {
    if (!isRecord(targeting.selectedTarget)) {
      throw new Error('compact result input harness.targeting.selectedTarget is required when root.primaryTarget is present.');
    }

    for (const field of ['kind', 'name', 'path', 'score']) {
      if (targeting.selectedTarget[field] !== value.primaryTarget[field]) {
        throw new Error(`compact result input harness.targeting.selectedTarget.${field} must match root.primaryTarget.${field}.`);
      }
    }
  }

  if (isRecord(targeting.selectedTarget)) {
    if (
      Array.isArray(value.requestedDomains)
      && value.requestedDomains.length > 0
      && targeting.selectedTarget.domain !== value.requestedDomains[0]
    ) {
      throw new Error('compact result input harness.targeting.selectedTarget.domain must match the primary requested domain.');
    }

    const selectedCandidate = selectedCandidates[0];
    if (selectedCandidate) {
      for (const field of ['rank', 'kind', 'domain', 'name', 'path', 'score']) {
        if (selectedCandidate[field] !== targeting.selectedTarget[field]) {
          throw new Error(`compact result input harness.targeting selected candidate ${field} must match selectedTarget.`);
        }
      }
    }
  }

  if (targeting.candidateCount === 0) {
    if (targeting.selectedTarget !== null || targeting.topScore !== null || targeting.scoreGapToNext !== null) {
      throw new Error('compact result input harness.targeting empty candidate state must not include selected target or scores.');
    }
  } else if (candidates[0] && targeting.topScore !== candidates[0].score) {
    throw new Error('compact result input harness.targeting.topScore must match the first included candidate score.');
  }

  if (targeting.candidateCount < 2 && targeting.scoreGapToNext !== null) {
    throw new Error('compact result input harness.targeting.scoreGapToNext must be null with fewer than two candidates.');
  }

  if (candidates.length >= 2 && targeting.scoreGapToNext !== (candidates[0].score as number) - (candidates[1].score as number)) {
    throw new Error('compact result input harness.targeting.scoreGapToNext must match the top candidate score gap.');
  }

  if (!isRecord(targeting.flags) || !Array.isArray(targeting.ambiguityKinds)) {
    return;
  }

  const expectedAmbiguityKinds = [
    targeting.flags.missingEnvironment ? 'missing-environment' : null,
    targeting.flags.missingService ? 'missing-service' : null,
    targeting.flags.noCandidates ? 'no-candidates' : null,
    targeting.flags.weakTopScore ? 'weak-match' : null,
    targeting.flags.tiedTopScore ? 'tied-top-score' : null
  ].filter((kind): kind is string => kind !== null);

  if (
    expectedAmbiguityKinds.length !== targeting.ambiguityKinds.length
    || expectedAmbiguityKinds.some((kind, index) => targeting.ambiguityKinds[index] !== kind)
  ) {
    throw new Error('compact result input harness.targeting.ambiguityKinds must match flags.');
  }

  const expectedRecommendedAction = targeting.flags.noCandidates || targeting.flags.weakTopScore || targeting.flags.tiedTopScore
    ? 'clarify-target'
    : expectedAmbiguityKinds.length > 0
      ? 'review-targeting'
      : 'inspect-selected-target';

  if (targeting.recommendedAction !== expectedRecommendedAction) {
    throw new Error('compact result input harness.targeting.recommendedAction must match ambiguity posture.');
  }
}

function assertCompactWorkPlan(value: unknown): void {
  if (!isRecord(value)) {
    throw new Error('compact result input harness.workPlan must be an object when harness is present.');
  }

  if (value.schemaVersion !== 1) {
    throw new Error('compact result input harness.workPlan.schemaVersion must be 1.');
  }

  if (!isKnownWorkPlanSource(value.source)) {
    throw new Error('compact result input harness.workPlan.source must be supported.');
  }

  if (value.compact !== true) {
    throw new Error('compact result input harness.workPlan.compact must be true.');
  }

  if (value.mutationAllowed !== false) {
    throw new Error('compact result input harness.workPlan.mutationAllowed must be false.');
  }

  if (!isKnownWorkPlanStatus(value.status)) {
    throw new Error('compact result input harness.workPlan.status must be supported.');
  }

  if (!isKnownPlannerHandoffActiveBlocker(value.blockerKind)) {
    throw new Error('compact result input harness.workPlan.blockerKind must be supported.');
  }

  if (!isKnownPlannerHandoffNextControlAction(value.nextControlAction)) {
    throw new Error('compact result input harness.workPlan.nextControlAction must be supported.');
  }

  for (const field of [
    'totalStepCount',
    'completedStepCount',
    'pendingStepCount',
    'blockedStepCount',
    'skippedStepCount',
    'maxEntries',
    'includedCount',
    'omittedCount'
  ]) {
    assertIntegerField(value, field, 'harness.workPlan', isNonNegativeInteger, 'a non-negative integer');
  }

  if (value.currentStepIndex !== null && !isNonNegativeInteger(value.currentStepIndex)) {
    throw new Error('compact result input harness.workPlan.currentStepIndex must be a non-negative integer or null.');
  }

  if (!Array.isArray(value.steps)) {
    throw new Error('compact result input harness.workPlan.steps must be an array.');
  }

  if (value.includedCount !== value.steps.length) {
    throw new Error('compact result input harness.workPlan.includedCount must match steps length.');
  }

  if ((value.includedCount as number) + (value.omittedCount as number) !== value.totalStepCount) {
    throw new Error('compact result input harness.workPlan step counts must be consistent.');
  }

  if ((value.includedCount as number) > (value.maxEntries as number)) {
    throw new Error('compact result input harness.workPlan.includedCount must not exceed maxEntries.');
  }

  const seenIndexes = new Set<number>();
  let previousIndex = -1;

  for (let index = 0; index < value.steps.length; index += 1) {
    const step = value.steps[index];
    const stepPath = `harness.workPlan.steps[${index}]`;

    if (!isRecord(step)) {
      throw new Error(`compact result input ${stepPath} must be an object.`);
    }

    assertIntegerField(step, 'index', stepPath, isNonNegativeInteger, 'a non-negative integer');

    if (!isKnownWorkPlanStepKind(step.kind)) {
      throw new Error(`compact result input ${stepPath}.kind must be supported.`);
    }

    if (!isKnownWorkPlanStepStatus(step.status)) {
      throw new Error(`compact result input ${stepPath}.status must be supported.`);
    }

    for (const field of ['title', 'summary']) {
      if (typeof step[field] !== 'string') {
        throw new Error(`compact result input ${stepPath}.${field} must be a string.`);
      }
    }

    if (step.actionKind !== null && !isKnownAgentActionKind(step.actionKind)) {
      throw new Error(`compact result input ${stepPath}.actionKind must be supported or null.`);
    }

    if (step.validationIssueKind !== null && !isKnownValidationIssueKind(step.validationIssueKind)) {
      throw new Error(`compact result input ${stepPath}.validationIssueKind must be supported or null.`);
    }

    if (step.approvalSignalKind !== null && !isKnownApprovalSignalKind(step.approvalSignalKind)) {
      throw new Error(`compact result input ${stepPath}.approvalSignalKind must be supported or null.`);
    }

    const stepIndex = step.index as number;
    if (seenIndexes.has(stepIndex) || stepIndex <= previousIndex) {
      throw new Error('compact result input harness.workPlan.steps indexes must be unique and ascending.');
    }

    seenIndexes.add(stepIndex);
    previousIndex = stepIndex;
  }
}

function assertCompactWorkPlanConsistency(
  workPlan: unknown,
  value: Record<string, unknown>
): void {
  if (!isRecord(workPlan) || !isRecord(value.harness) || !isRecord(value.harness.plannerHandoff)) {
    return;
  }

  const plannerHandoff = value.harness.plannerHandoff;
  if (!isRecord(plannerHandoff.activeBlocker)) {
    return;
  }

  if (workPlan.blockerKind !== plannerHandoff.activeBlocker.kind) {
    throw new Error('compact result input harness.workPlan.blockerKind must match harness.plannerHandoff.activeBlocker.kind.');
  }

  if (workPlan.nextControlAction !== plannerHandoff.nextControlAction) {
    throw new Error('compact result input harness.workPlan.nextControlAction must match harness.plannerHandoff.nextControlAction.');
  }

  if (value.outcome === 'completed' && workPlan.status !== 'completed') {
    throw new Error('compact result input harness.workPlan.status must be completed when outcome is completed.');
  }

  if (value.outcome === 'completed' && workPlan.currentStepIndex !== null) {
    throw new Error('compact result input harness.workPlan.currentStepIndex must be null when outcome is completed.');
  }

  if (plannerHandoff.activeBlocker.kind !== 'none' && workPlan.status !== 'blocked') {
    throw new Error('compact result input harness.workPlan.status must be blocked when a planner blocker is active.');
  }

  const steps = Array.isArray(workPlan.steps) ? workPlan.steps : [];
  const includedStatuses = steps
    .filter(isRecord)
    .map(step => step.status);
  const completedStepCount = includedStatuses.filter(status => status === 'completed').length;
  const pendingStepCount = includedStatuses.filter(status => status === 'pending').length;
  const blockedStepCount = includedStatuses.filter(status => status === 'blocked').length;
  const skippedStepCount = includedStatuses.filter(status => status === 'skipped').length;

  if (workPlan.omittedCount === 0) {
    if (workPlan.completedStepCount !== completedStepCount) {
      throw new Error('compact result input harness.workPlan.completedStepCount must match included completed steps.');
    }

    if (workPlan.pendingStepCount !== pendingStepCount) {
      throw new Error('compact result input harness.workPlan.pendingStepCount must match included pending steps.');
    }

    if (workPlan.blockedStepCount !== blockedStepCount) {
      throw new Error('compact result input harness.workPlan.blockedStepCount must match included blocked steps.');
    }

    if (workPlan.skippedStepCount !== skippedStepCount) {
      throw new Error('compact result input harness.workPlan.skippedStepCount must match included skipped steps.');
    }
  }

  if (workPlan.currentStepIndex !== null) {
    const currentStep = steps
      .filter(isRecord)
      .find(step => step.index === workPlan.currentStepIndex);

    if (!currentStep) {
      throw new Error('compact result input harness.workPlan.currentStepIndex must point to an included step.');
    }

    if (currentStep.status !== 'blocked' && currentStep.status !== 'in-progress') {
      throw new Error('compact result input harness.workPlan.currentStepIndex must point to a blocked or in-progress step.');
    }
  }

  if (
    value.outcome === 'completed'
    && includedStatuses.some(status => status === 'pending' || status === 'in-progress' || status === 'blocked')
  ) {
    throw new Error('compact result input harness.workPlan steps must be completed or skipped when outcome is completed.');
  }

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (!isRecord(step)) {
      continue;
    }

    const stepPath = `harness.workPlan.steps[${index}]`;

    if (step.validationIssueKind !== null && step.kind !== 'validation') {
      throw new Error(`compact result input ${stepPath}.validationIssueKind must be null unless step kind is validation.`);
    }

    if (step.validationIssueKind !== null && step.status !== 'blocked') {
      throw new Error(`compact result input ${stepPath}.validationIssueKind requires blocked step status.`);
    }

    if (step.approvalSignalKind !== null && step.kind !== 'edit') {
      throw new Error(`compact result input ${stepPath}.approvalSignalKind must be null unless step kind is edit.`);
    }

    if (step.approvalSignalKind !== null && step.status !== 'blocked') {
      throw new Error(`compact result input ${stepPath}.approvalSignalKind requires blocked step status.`);
    }
  }
}

export function parseCompactAgentRunResult(value: unknown): CompactAgentRunResult {
  if (!isRecord(value) || value.kind !== 'infra-agent.agent-result') {
    throw new Error('compact result input must be a compact infra-agent.agent-result JSON payload.');
  }

  if (value.schemaVersion !== 1) {
    throw new Error('compact result input must use compact agent result schemaVersion 1.');
  }

  if (!isRecord(value.handoffCheckpoint)) {
    throw new Error('compact result input must include handoffCheckpoint object.');
  }

  if (value.handoffCheckpoint.schemaVersion !== 1) {
    throw new Error('compact result input handoffCheckpoint.schemaVersion must be 1.');
  }

  if (!isKnownHandoffCheckpointSource(value.handoffCheckpoint.source)) {
    throw new Error('compact result input handoffCheckpoint.source must be supported.');
  }

  if (value.handoffCheckpoint.compact !== true) {
    throw new Error('compact result input handoffCheckpoint.compact must be true.');
  }

  if (!isKnownHandoffCheckpointPrimaryArtifact(value.handoffCheckpoint.primaryArtifact)) {
    throw new Error('compact result input handoffCheckpoint.primaryArtifact must be supported.');
  }

  if (!isKnownHandoffCheckpointDebugArtifact(value.handoffCheckpoint.debugArtifact)) {
    throw new Error('compact result input handoffCheckpoint.debugArtifact must be supported.');
  }

  if (value.handoffCheckpoint.mutationAllowed !== false) {
    throw new Error('compact result input handoffCheckpoint.mutationAllowed must be false.');
  }

  if (!isRecord(value.handoffCheckpoint.exclusions)) {
    throw new Error('compact result input handoffCheckpoint.exclusions must be an object.');
  }

  for (const field of [
    'rawRuntimeIncluded',
    'rawPreflightIncluded',
    'rawToolOutputIncluded',
    'rawPromptIncluded',
    'rawKnowledgeExcerptIncluded'
  ]) {
    if (value.handoffCheckpoint.exclusions[field] !== false) {
      throw new Error(`compact result input handoffCheckpoint.exclusions.${field} must be false.`);
    }
  }

  if (!isRecord(value.handoffCheckpoint.summary)) {
    throw new Error('compact result input handoffCheckpoint.summary must be an object.');
  }

  if (!isKnownAgentResultOutcome(value.handoffCheckpoint.summary.outcome)) {
    throw new Error('compact result input handoffCheckpoint.summary.outcome must be supported.');
  }

  if (!isKnownPlannerHandoffActiveBlocker(value.handoffCheckpoint.summary.activeBlocker)) {
    throw new Error('compact result input handoffCheckpoint.summary.activeBlocker must be supported.');
  }

  if (!isKnownPlannerHandoffNextControlAction(value.handoffCheckpoint.summary.nextControlAction)) {
    throw new Error('compact result input handoffCheckpoint.summary.nextControlAction must be supported.');
  }

  if (!isKnownDoctorCheckStatus(value.handoffCheckpoint.summary.readinessStatus)) {
    throw new Error('compact result input handoffCheckpoint.summary.readinessStatus must be supported.');
  }

  if (typeof value.handoffCheckpoint.summary.validationStatus !== 'string') {
    throw new Error('compact result input handoffCheckpoint.summary.validationStatus must be a string.');
  }

  for (const field of ['validationIssueCount', 'identityConflictCount', 'changedFileCount']) {
    assertIntegerField(
      value.handoffCheckpoint.summary,
      field,
      'handoffCheckpoint.summary',
      isNonNegativeInteger,
      'a non-negative integer'
    );
  }

  if (typeof value.handoffCheckpoint.summary.approvalContinuationRequired !== 'boolean') {
    throw new Error('compact result input handoffCheckpoint.summary.approvalContinuationRequired must be a boolean.');
  }

  if (!isRecord(value.handoffCheckpoint.budgets)) {
    throw new Error('compact result input handoffCheckpoint.budgets must be an object.');
  }

  for (const field of [
    'turnTrace',
    'lifecycleEvents',
    'toolTrace',
    'workPlan',
    'targeting',
    'validationCommands',
    'validationIssues',
    'validationIssueGroups',
    'validationSafetyBlockers',
    'identityConflicts',
    'approvalSignals',
    'knowledgeFacts',
    'knowledgeUnits'
  ]) {
    assertHandoffBudgetSample(value.handoffCheckpoint.budgets[field], `handoffCheckpoint.budgets.${field}`);
  }

  assertHandoffBudgetSample(
    value.handoffCheckpoint.budgets.knowledgePackets,
    'handoffCheckpoint.budgets.knowledgePackets',
    ['includedTokenEstimate', 'omittedTokenEstimate']
  );

  if (!isRecord(value.handoffCheckpoint.continuation)) {
    throw new Error('compact result input handoffCheckpoint.continuation must be an object.');
  }

  if (typeof value.handoffCheckpoint.continuation.required !== 'boolean') {
    throw new Error('compact result input handoffCheckpoint.continuation.required must be a boolean.');
  }

  if (!isKnownPlannerHandoffActiveBlocker(value.handoffCheckpoint.continuation.reason)) {
    throw new Error('compact result input handoffCheckpoint.continuation.reason must be supported.');
  }

  if (!isKnownPlannerHandoffNextControlAction(value.handoffCheckpoint.continuation.nextControlAction)) {
    throw new Error('compact result input handoffCheckpoint.continuation.nextControlAction must be supported.');
  }

  if (typeof value.handoffCheckpoint.continuation.approvalRequired !== 'boolean') {
    throw new Error('compact result input handoffCheckpoint.continuation.approvalRequired must be a boolean.');
  }

  if (!isStringOrNull(value.handoffCheckpoint.continuation.command)) {
    throw new Error('compact result input handoffCheckpoint.continuation.command must be string or null.');
  }

  if (!isStringOrNull(value.handoffCheckpoint.continuation.compactCommand)) {
    throw new Error('compact result input handoffCheckpoint.continuation.compactCommand must be string or null.');
  }

  if (!isStringOrNull(value.handoffCheckpoint.continuation.debugCommand)) {
    throw new Error('compact result input handoffCheckpoint.continuation.debugCommand must be string or null.');
  }

  if (value.handoffCheckpoint.continuation.mutationAllowed !== false) {
    throw new Error('compact result input handoffCheckpoint.continuation.mutationAllowed must be false.');
  }

  if (value.handoffCheckpoint.continuation.required !== (value.handoffCheckpoint.continuation.reason !== 'none')) {
    throw new Error('compact result input handoffCheckpoint.continuation.required must match reason.');
  }

  if (value.handoffCheckpoint.continuation.reason !== value.handoffCheckpoint.summary.activeBlocker) {
    throw new Error('compact result input handoffCheckpoint.continuation.reason must match handoffCheckpoint.summary.activeBlocker.');
  }

  if (value.handoffCheckpoint.continuation.nextControlAction !== value.handoffCheckpoint.summary.nextControlAction) {
    throw new Error('compact result input handoffCheckpoint.continuation.nextControlAction must match handoffCheckpoint.summary.nextControlAction.');
  }

  if (value.handoffCheckpoint.continuation.approvalRequired !== value.handoffCheckpoint.summary.approvalContinuationRequired) {
    throw new Error('compact result input handoffCheckpoint.continuation.approvalRequired must match handoffCheckpoint.summary.approvalContinuationRequired.');
  }

  if (value.handoffCheckpoint.continuation.approvalRequired && typeof value.handoffCheckpoint.continuation.command !== 'string') {
    throw new Error('compact result input handoffCheckpoint.continuation.command is required when approvalRequired is true.');
  }

  if (value.handoffCheckpoint.continuation.approvalRequired && typeof value.handoffCheckpoint.continuation.compactCommand !== 'string') {
    throw new Error('compact result input handoffCheckpoint.continuation.compactCommand is required when approvalRequired is true.');
  }

  if (value.handoffCheckpoint.continuation.approvalRequired && typeof value.handoffCheckpoint.continuation.debugCommand !== 'string') {
    throw new Error('compact result input handoffCheckpoint.continuation.debugCommand is required when approvalRequired is true.');
  }

  if (!value.handoffCheckpoint.continuation.approvalRequired && value.handoffCheckpoint.continuation.command !== null) {
    throw new Error('compact result input handoffCheckpoint.continuation.command must be null when approvalRequired is false.');
  }

  if (!value.handoffCheckpoint.continuation.approvalRequired && value.handoffCheckpoint.continuation.compactCommand !== null) {
    throw new Error('compact result input handoffCheckpoint.continuation.compactCommand must be null when approvalRequired is false.');
  }

  if (!value.handoffCheckpoint.continuation.approvalRequired && value.handoffCheckpoint.continuation.debugCommand !== null) {
    throw new Error('compact result input handoffCheckpoint.continuation.debugCommand must be null when approvalRequired is false.');
  }

  if (
    value.handoffCheckpoint.continuation.approvalRequired
    && typeof value.handoffCheckpoint.continuation.command === 'string'
    && (
      value.handoffCheckpoint.continuation.compactCommand !== `${value.handoffCheckpoint.continuation.command} --json`
      || value.handoffCheckpoint.continuation.debugCommand !== `${value.handoffCheckpoint.continuation.command} --json-full`
    )
  ) {
    throw new Error('compact result input handoffCheckpoint.continuation JSON commands must match the approval continuation command and output mode.');
  }

  if (!Array.isArray(value.handoffCheckpoint.durableSections)) {
    throw new Error('compact result input handoffCheckpoint.durableSections must be an array.');
  }

  const durableSections = value.handoffCheckpoint.durableSections;
  if (durableSections.some(section => !isKnownHandoffCheckpointDurableSection(section))) {
    throw new Error('compact result input handoffCheckpoint.durableSections must use supported section names.');
  }

  if (new Set(durableSections).size !== durableSections.length) {
    throw new Error('compact result input handoffCheckpoint.durableSections must not include duplicate section names.');
  }

  for (const requiredSection of HANDOFF_CHECKPOINT_DURABLE_SECTIONS) {
    if (!durableSections.includes(requiredSection)) {
      throw new Error('compact result input handoffCheckpoint.durableSections must include all required recovery section names.');
    }
  }

  if (!isKnownAgentResultOutcome(value.outcome)) {
    throw new Error('compact result input must include a supported outcome.');
  }

  if (value.handoffCheckpoint.summary.outcome !== value.outcome) {
    throw new Error('compact result input handoffCheckpoint.summary.outcome must match root.outcome.');
  }

  if (typeof value.task !== 'string') {
    throw new Error('compact result input root.task must be a string.');
  }

  if (typeof value.workspaceRoot !== 'string') {
    throw new Error('compact result input root.workspaceRoot must be a string.');
  }

  for (const field of ['modelName', 'profileId']) {
    if (typeof value[field] !== 'string') {
      throw new Error(`compact result input root.${field} must be a string.`);
    }
  }

  if (!isNonNegativeInteger(value.turnsUsed)) {
    throw new Error('compact result input root.turnsUsed must be a non-negative integer.');
  }

  if (!isStringArray(value.requestedDomains)) {
    throw new Error('compact result input root.requestedDomains must be a string array.');
  }

  if (!value.requestedDomains.every(domain => isKnownValidationPlanKind(domain))) {
    throw new Error('compact result input root.requestedDomains must use supported domains.');
  }

  for (const field of ['changedFiles', 'resultCard', 'nextSteps', 'suggestedCommands']) {
    if (!isStringArray(value[field])) {
      throw new Error(`compact result input root.${field} must be a string array.`);
    }
  }

  if (
    Array.isArray(value.changedFiles)
    && value.handoffCheckpoint.summary.changedFileCount !== value.changedFiles.length
  ) {
    throw new Error('compact result input handoffCheckpoint.summary.changedFileCount must match root.changedFiles length.');
  }

  for (const field of ['requestedEnvironment', 'requestedService']) {
    if (field in value && !isStringOrNull(value[field])) {
      throw new Error(`compact result input root.${field} must be string or null when present.`);
    }
  }

  if (value.primaryTarget !== undefined && value.primaryTarget !== null) {
    if (!isRecord(value.primaryTarget)) {
      throw new Error('compact result input root.primaryTarget must be an object or null when present.');
    }

    for (const field of ['kind', 'name', 'path']) {
      if (typeof value.primaryTarget[field] !== 'string') {
        throw new Error(`compact result input root.primaryTarget.${field} must be a string when present.`);
      }
    }

    if (!isNumber(value.primaryTarget.score)) {
      throw new Error('compact result input root.primaryTarget.score must be a number when present.');
    }
  }

  if (isRecord(value.harness)) {
    assertIntegerField(value.harness, 'maxTurns', 'harness', isPositiveInteger, 'a positive integer');

    if (!isRecord(value.harness.queryConfig)) {
      throw new Error('compact result input harness.queryConfig must be an object.');
    }

    assertIntegerField(value.harness.queryConfig, 'maxTurns', 'harness.queryConfig', isPositiveInteger, 'a positive integer');
    assertIntegerField(
      value.harness.queryConfig,
      'maxRepairAttempts',
      'harness.queryConfig',
      isNonNegativeInteger,
      'a non-negative integer'
    );

    if (!isRecord(value.harness.queryConfig.retrievedContextBudget)) {
      throw new Error('compact result input harness.queryConfig.retrievedContextBudget must be an object.');
    }

    for (const field of ['maxPackets', 'maxTokens', 'maxExcerptChars', 'maxFacts']) {
      assertIntegerField(
        value.harness.queryConfig.retrievedContextBudget,
        field,
        'harness.queryConfig.retrievedContextBudget',
        isPositiveInteger,
        'a positive integer'
      );
    }

    if (!isRecord(value.harness.plannerConfig)) {
      throw new Error('compact result input harness.plannerConfig must be an object.');
    }

    if (!isKnownPlannerMode(value.harness.plannerConfig.requestedMode)) {
      throw new Error('compact result input harness.plannerConfig.requestedMode must be supported.');
    }

    if (!isKnownPlannerEffectiveMode(value.harness.plannerConfig.effectiveMode)) {
      throw new Error('compact result input harness.plannerConfig.effectiveMode must be supported.');
    }

    if (typeof value.harness.plannerConfig.clientName !== 'string') {
      throw new Error('compact result input harness.plannerConfig.clientName must be a string.');
    }

    if (value.harness.plannerConfig.clientName !== value.modelName) {
      throw new Error('compact result input harness.plannerConfig.clientName must match root.modelName.');
    }

    if (!isStringOrNull(value.harness.plannerConfig.fallbackReason)) {
      throw new Error('compact result input harness.plannerConfig.fallbackReason must be string or null.');
    }

    if (value.harness.plannerConfig.effectiveMode === 'llm') {
      if (!isRecord(value.harness.plannerConfig.llm)) {
        throw new Error('compact result input harness.plannerConfig.llm is required for LLM planner runs.');
      }

      if (!isKnownLLMPlannerProvider(value.harness.plannerConfig.llm.provider)) {
        throw new Error('compact result input harness.plannerConfig.llm.provider must be supported.');
      }

      for (const field of ['model', 'baseUrl']) {
        if (typeof value.harness.plannerConfig.llm[field] !== 'string') {
          throw new Error(`compact result input harness.plannerConfig.llm.${field} must be a string.`);
        }
      }

      if (value.harness.plannerConfig.llm.apiKeyConfigured !== true) {
        throw new Error('compact result input harness.plannerConfig.llm.apiKeyConfigured must be true.');
      }

      if (!isKnownLLMApiKeySource(value.harness.plannerConfig.llm.apiKeySource)) {
        throw new Error('compact result input harness.plannerConfig.llm.apiKeySource must be supported.');
      }

      for (const field of ['providerSource', 'modelSource', 'baseUrlSource']) {
        if (!isKnownLLMConfigSource(value.harness.plannerConfig.llm[field])) {
          throw new Error(`compact result input harness.plannerConfig.llm.${field} must be supported.`);
        }
      }

      if (!isRecord(value.harness.plannerConfig.llm.capabilities)) {
        throw new Error('compact result input harness.plannerConfig.llm.capabilities must be an object.');
      }

      if (!isKnownLLMProviderTransport(value.harness.plannerConfig.llm.capabilities.transport)) {
        throw new Error('compact result input harness.plannerConfig.llm.capabilities.transport must be supported.');
      }

      if (!isKnownLLMProviderEndpointPath(value.harness.plannerConfig.llm.capabilities.endpointPath)) {
        throw new Error('compact result input harness.plannerConfig.llm.capabilities.endpointPath must be supported.');
      }

      if (!isKnownLLMProviderResponseFormat(value.harness.plannerConfig.llm.capabilities.responseFormat)) {
        throw new Error('compact result input harness.plannerConfig.llm.capabilities.responseFormat must be supported.');
      }

      for (const field of ['supportsJsonObject', 'supportsStreaming']) {
        if (typeof value.harness.plannerConfig.llm.capabilities[field] !== 'boolean') {
          throw new Error(`compact result input harness.plannerConfig.llm.capabilities.${field} must be a boolean.`);
        }
      }

      if (value.harness.plannerConfig.llm.capabilities.supportsJsonObject !== true) {
        throw new Error('compact result input harness.plannerConfig.llm.capabilities.supportsJsonObject must be true.');
      }

      if (value.harness.plannerConfig.llm.capabilities.supportsStreaming !== false) {
        throw new Error('compact result input harness.plannerConfig.llm.capabilities.supportsStreaming must be false.');
      }

      if (value.modelName !== `llm-model-client:${value.harness.plannerConfig.llm.model}`) {
        throw new Error('compact result input harness.plannerConfig.llm.model must match root.modelName.');
      }
    } else if (value.harness.plannerConfig.llm !== null) {
      throw new Error('compact result input harness.plannerConfig.llm must be null for non-LLM planner runs.');
    }

    if (!isRecord(value.harness.loopBudget)) {
      throw new Error('compact result input harness.loopBudget must be an object.');
    }

    assertIntegerField(value.harness.loopBudget, 'turnsUsed', 'harness.loopBudget', isNonNegativeInteger, 'a non-negative integer');
    assertIntegerField(value.harness.loopBudget, 'maxTurns', 'harness.loopBudget', isPositiveInteger, 'a positive integer');
    assertIntegerField(value.harness.loopBudget, 'turnsRemaining', 'harness.loopBudget', isNonNegativeInteger, 'a non-negative integer');

    if (typeof value.harness.loopBudget.exhausted !== 'boolean') {
      throw new Error('compact result input harness.loopBudget.exhausted must be a boolean.');
    }

    const harnessMaxTurns = value.harness.maxTurns as number;
    const queryConfigMaxTurns = value.harness.queryConfig.maxTurns as number;
    const loopBudgetTurnsUsed = value.harness.loopBudget.turnsUsed as number;
    const loopBudgetMaxTurns = value.harness.loopBudget.maxTurns as number;
    const loopBudgetTurnsRemaining = value.harness.loopBudget.turnsRemaining as number;
    const loopBudgetExhausted = value.harness.loopBudget.exhausted as boolean;

    if (harnessMaxTurns !== queryConfigMaxTurns) {
      throw new Error('compact result input harness.maxTurns must match harness.queryConfig.maxTurns.');
    }

    if (loopBudgetMaxTurns !== harnessMaxTurns) {
      throw new Error('compact result input harness.loopBudget.maxTurns must match harness.maxTurns.');
    }

    if (loopBudgetTurnsUsed !== value.turnsUsed) {
      throw new Error('compact result input root.turnsUsed must match harness.loopBudget.turnsUsed.');
    }

    const expectedTurnsRemaining = Math.max(0, loopBudgetMaxTurns - loopBudgetTurnsUsed);
    if (loopBudgetTurnsRemaining !== expectedTurnsRemaining) {
      throw new Error('compact result input harness.loopBudget.turnsRemaining must match maxTurns minus turnsUsed.');
    }

    if (loopBudgetExhausted !== (loopBudgetTurnsRemaining === 0)) {
      throw new Error('compact result input harness.loopBudget.exhausted must match remaining turn budget.');
    }

    if (!isRecord(value.harness.repairBudget)) {
      throw new Error('compact result input harness.repairBudget must be an object.');
    }

    assertIntegerField(
      value.harness.repairBudget,
      'attemptsUsed',
      'harness.repairBudget',
      isNonNegativeInteger,
      'a non-negative integer'
    );
    assertIntegerField(
      value.harness.repairBudget,
      'maxAttempts',
      'harness.repairBudget',
      isNonNegativeInteger,
      'a non-negative integer'
    );
    assertIntegerField(
      value.harness.repairBudget,
      'attemptsRemaining',
      'harness.repairBudget',
      isNonNegativeInteger,
      'a non-negative integer'
    );

    if (typeof value.harness.repairBudget.exhausted !== 'boolean') {
      throw new Error('compact result input harness.repairBudget.exhausted must be a boolean.');
    }

    const queryConfigMaxRepairAttempts = value.harness.queryConfig.maxRepairAttempts as number;
    const repairBudgetAttemptsUsed = value.harness.repairBudget.attemptsUsed as number;
    const repairBudgetMaxAttempts = value.harness.repairBudget.maxAttempts as number;
    const repairBudgetAttemptsRemaining = value.harness.repairBudget.attemptsRemaining as number;
    const repairBudgetExhausted = value.harness.repairBudget.exhausted as boolean;

    if (repairBudgetMaxAttempts !== queryConfigMaxRepairAttempts) {
      throw new Error('compact result input harness.repairBudget.maxAttempts must match harness.queryConfig.maxRepairAttempts.');
    }

    const expectedRepairAttemptsRemaining = Math.max(0, repairBudgetMaxAttempts - repairBudgetAttemptsUsed);
    if (repairBudgetAttemptsRemaining !== expectedRepairAttemptsRemaining) {
      throw new Error('compact result input harness.repairBudget.attemptsRemaining must match maxAttempts minus attemptsUsed.');
    }

    if (repairBudgetExhausted !== (repairBudgetAttemptsRemaining === 0)) {
      throw new Error('compact result input harness.repairBudget.exhausted must match remaining repair budget.');
    }

    if (!Array.isArray(value.harness.turnTrace)) {
      throw new Error('compact result input harness.turnTrace must be an array when harness is present.');
    }

    for (let index = 0; index < value.harness.turnTrace.length; index += 1) {
      const entry = value.harness.turnTrace[index];
      const entryPath = `harness.turnTrace[${index}]`;

      if (!isRecord(entry)) {
        throw new Error(`compact result input ${entryPath} must be an object.`);
      }

      assertIntegerField(entry, 'index', entryPath, isNonNegativeInteger, 'a non-negative integer');

      if (!isKnownAgentActionKind(entry.actionKind)) {
        throw new Error(`compact result input ${entryPath}.actionKind must be supported.`);
      }

      if (entry.actionFamily !== null && !isKnownAgentActionFamily(entry.actionFamily)) {
        throw new Error(`compact result input ${entryPath}.actionFamily must be supported or null.`);
      }

      if (!isKnownAgentConfidence(entry.confidence)) {
        throw new Error(`compact result input ${entryPath}.confidence must be supported.`);
      }

      if (typeof entry.summary !== 'string') {
        throw new Error(`compact result input ${entryPath}.summary must be a string.`);
      }

      if (typeof entry.terminal !== 'boolean') {
        throw new Error(`compact result input ${entryPath}.terminal must be a boolean.`);
      }

      if (entry.executionStatus !== null && !isKnownAgentDecisionExecutionStatus(entry.executionStatus)) {
        throw new Error(`compact result input ${entryPath}.executionStatus must be supported or null.`);
      }

      if (!isStringOrNull(entry.executionReason)) {
        throw new Error(`compact result input ${entryPath}.executionReason must be string or null.`);
      }

      for (const field of ['executedToolCount', 'changedFileCount', 'validationIssueCount', 'approvalSignalCount']) {
        assertIntegerField(entry, field, entryPath, isNonNegativeInteger, 'a non-negative integer');
      }

      if (entry.stopReason !== null && !isKnownAgentStopReason(entry.stopReason)) {
        throw new Error(`compact result input ${entryPath}.stopReason must be supported or null.`);
      }

      if (entry.clarificationKind !== null && !isKnownAgentClarificationKind(entry.clarificationKind)) {
        throw new Error(`compact result input ${entryPath}.clarificationKind must be supported or null.`);
      }

      if (entry.actionKind === 'stop' && entry.stopReason === null) {
        throw new Error(`compact result input ${entryPath}.stopReason is required for stop actions.`);
      }

      if (entry.actionKind !== 'stop' && entry.stopReason !== null) {
        throw new Error(`compact result input ${entryPath}.stopReason must be null unless actionKind is stop.`);
      }

      if (entry.actionKind === 'ask-for-clarification' && entry.clarificationKind === null) {
        throw new Error(`compact result input ${entryPath}.clarificationKind is required for clarification actions.`);
      }

      if (entry.actionKind !== 'ask-for-clarification' && entry.clarificationKind !== null) {
        throw new Error(`compact result input ${entryPath}.clarificationKind must be null unless actionKind asks for clarification.`);
      }
    }

    if (!isRecord(value.harness.turnTraceBudget)) {
      throw new Error('compact result input harness.turnTraceBudget must be an object when harness is present.');
    }

    if (isRecord(value.harness.turnTraceBudget)) {
      for (const field of ['maxEntries', 'totalCount', 'includedCount', 'omittedCount']) {
        if (field in value.harness.turnTraceBudget && !isNonNegativeInteger(value.harness.turnTraceBudget[field])) {
          throw new Error(`compact result input harness.turnTraceBudget.${field} must be a non-negative integer when present.`);
        }
      }

      for (const field of ['firstIncludedTurnIndex', 'lastIncludedTurnIndex']) {
        if (
          field in value.harness.turnTraceBudget
          && value.harness.turnTraceBudget[field] !== null
          && !isNonNegativeInteger(value.harness.turnTraceBudget[field])
        ) {
          throw new Error(`compact result input harness.turnTraceBudget.${field} must be a non-negative integer or null when present.`);
        }
      }

      if (
        'preservedWindow' in value.harness.turnTraceBudget
        && !isKnownTurnTracePreservedWindow(value.harness.turnTraceBudget.preservedWindow)
      ) {
        throw new Error('compact result input harness.turnTraceBudget.preservedWindow must be supported when present.');
      }

      if (
        hasNumericCountSet(value.harness.turnTraceBudget)
        && !hasConsistentCountSet(value.harness.turnTraceBudget)
      ) {
        throw new Error('compact result input harness.turnTraceBudget counts must be consistent when present.');
      }

      if (
        isNonNegativeInteger(value.harness.turnTraceBudget.includedCount)
        && isNonNegativeInteger(value.harness.turnTraceBudget.maxEntries)
        && (value.harness.turnTraceBudget.includedCount as number) > (value.harness.turnTraceBudget.maxEntries as number)
      ) {
        throw new Error('compact result input harness.turnTraceBudget.includedCount must not exceed maxEntries.');
      }
    }

    if (!isNonNegativeInteger(value.harness.turnTraceLimit)) {
      throw new Error('compact result input harness.turnTraceLimit must be a non-negative integer when harness is present.');
    }

    if (!isNonNegativeInteger(value.harness.turnTraceOmittedCount)) {
      throw new Error('compact result input harness.turnTraceOmittedCount must be a non-negative integer when harness is present.');
    }

    if (Array.isArray(value.harness.turnTrace) && isRecord(value.harness.turnTraceBudget)) {
      const turnTrace = value.harness.turnTrace;

      if (value.harness.turnTraceBudget.totalCount !== value.turnsUsed) {
        throw new Error('compact result input harness.turnTraceBudget.totalCount must match root.turnsUsed.');
      }

      if (value.harness.turnTraceBudget.totalCount !== value.harness.loopBudget.turnsUsed) {
        throw new Error('compact result input harness.turnTraceBudget.totalCount must match harness.loopBudget.turnsUsed.');
      }

      if (
        isNonNegativeInteger(value.harness.turnTraceBudget.includedCount)
        && value.harness.turnTraceBudget.includedCount !== turnTrace.length
      ) {
        throw new Error('compact result input harness.turnTraceBudget.includedCount must match turnTrace length when present.');
      }

      if (
        isNonNegativeInteger(value.harness.turnTraceLimit)
        && isNonNegativeInteger(value.harness.turnTraceBudget.maxEntries)
        && value.harness.turnTraceLimit !== value.harness.turnTraceBudget.maxEntries
      ) {
        throw new Error('compact result input harness.turnTraceLimit must match harness.turnTraceBudget.maxEntries.');
      }

      if (
        isNonNegativeInteger(value.harness.turnTraceOmittedCount)
        && isNonNegativeInteger(value.harness.turnTraceBudget.omittedCount)
        && value.harness.turnTraceOmittedCount !== value.harness.turnTraceBudget.omittedCount
      ) {
        throw new Error('compact result input harness.turnTraceOmittedCount must match harness.turnTraceBudget.omittedCount.');
      }

      if (
        turnTrace.length === 0
        && (
          value.harness.turnTraceBudget.firstIncludedTurnIndex !== null
          || value.harness.turnTraceBudget.lastIncludedTurnIndex !== null
        )
      ) {
        throw new Error('compact result input harness.turnTraceBudget included turn indexes must be null when turnTrace is empty.');
      }

      if (turnTrace.length > 0) {
        const firstTurnIndex = (turnTrace[0] as Record<string, unknown>).index;
        const lastTurnIndex = (turnTrace[turnTrace.length - 1] as Record<string, unknown>).index;

        if (value.harness.turnTraceBudget.firstIncludedTurnIndex !== firstTurnIndex) {
          throw new Error('compact result input harness.turnTraceBudget.firstIncludedTurnIndex must match first turnTrace entry.');
        }

        if (value.harness.turnTraceBudget.lastIncludedTurnIndex !== lastTurnIndex) {
          throw new Error('compact result input harness.turnTraceBudget.lastIncludedTurnIndex must match last turnTrace entry.');
        }
      }
    }

    if (!isRecord(value.harness.stateSummary)) {
      throw new Error('compact result input harness.stateSummary must be an object when harness is present.');
    }

    const stateSummaryCountKeys = [
      'observationCount',
      'toolSummaryCount',
      'appliedWriteCount',
      'validationResultCount',
      'validationIssueCount',
      'approvalSignalCount',
      'retrievedContextCount',
      'knowledgeFactCount',
      'knowledgeUnitCount',
      'semanticFactCount'
    ];
    for (const key of stateSummaryCountKeys) {
      assertIntegerField(
        value.harness.stateSummary,
        key,
        'harness.stateSummary',
        isNonNegativeInteger,
        'a non-negative integer'
      );
    }

    assertCompactWorkPlan(value.harness.workPlan);
    assertCompactTargeting(value.harness.targeting);
    assertCompactTargetingConsistency(value.harness.targeting, value);

    if (!isRecord(value.harness.toolTrace)) {
      throw new Error('compact result input harness.toolTrace must be an object when harness is present.');
    }

    if (isRecord(value.harness.toolTrace)) {
      for (const field of ['maxEntries', 'totalCount', 'includedCount', 'omittedCount']) {
        assertIntegerField(value.harness.toolTrace, field, 'harness.toolTrace', isNonNegativeInteger, 'a non-negative integer');
      }

      for (const field of ['firstIncludedTurnIndex', 'lastIncludedTurnIndex', 'latestTurnIndex']) {
        if (
          value.harness.toolTrace[field] !== null
          && !isNonNegativeInteger(value.harness.toolTrace[field])
        ) {
          throw new Error(`compact result input harness.toolTrace.${field} must be a non-negative integer or null.`);
        }
      }

      if (!isKnownToolTracePreservedWindow(value.harness.toolTrace.preservedWindow)) {
        throw new Error('compact result input harness.toolTrace.preservedWindow must be supported.');
      }

      if (!Array.isArray(value.harness.toolTrace.entries)) {
        throw new Error('compact result input harness.toolTrace.entries must be an array.');
      }

      if (!isRecord(value.harness.toolTrace.permissionCategoryCounts)) {
        throw new Error('compact result input harness.toolTrace.permissionCategoryCounts must be an object.');
      }

      if (
        hasNumericCountSet(value.harness.toolTrace)
        && !hasConsistentCountSet(value.harness.toolTrace)
      ) {
        throw new Error('compact result input harness.toolTrace counts must be consistent when present.');
      }

      if (
        isNonNegativeInteger(value.harness.toolTrace.includedCount)
        && isNonNegativeInteger(value.harness.toolTrace.maxEntries)
        && (value.harness.toolTrace.includedCount as number) > (value.harness.toolTrace.maxEntries as number)
      ) {
        throw new Error('compact result input harness.toolTrace.includedCount must not exceed maxEntries.');
      }

      if (Array.isArray(value.harness.toolTrace.entries)) {
        let previousToolTurnIndex = -1;
        const includedToolPermissionCategoryCounts = new Map<string, number>();

        for (let index = 0; index < value.harness.toolTrace.entries.length; index += 1) {
          const entry = value.harness.toolTrace.entries[index];
          const entryPath = `harness.toolTrace.entries[${index}]`;

          if (!isRecord(entry)) {
            throw new Error(`compact result input ${entryPath} must be an object.`);
          }

          assertIntegerField(entry, 'turnIndex', entryPath, isNonNegativeInteger, 'a non-negative integer');
          if ((entry.turnIndex as number) < previousToolTurnIndex) {
            throw new Error('compact result input harness.toolTrace.entries turnIndex values must be ascending.');
          }
          previousToolTurnIndex = entry.turnIndex as number;

          if (!isKnownAgentActionKind(entry.actionKind)) {
            throw new Error(`compact result input ${entryPath}.actionKind must be supported.`);
          }

          if (typeof entry.toolName !== 'string' || entry.toolName.length === 0) {
            throw new Error(`compact result input ${entryPath}.toolName must be a non-empty string.`);
          }

          if (!isKnownToolSafety(entry.safety)) {
            throw new Error(`compact result input ${entryPath}.safety must be supported.`);
          }

          if (!isKnownToolPermissionCategory(entry.permissionCategory)) {
            throw new Error(`compact result input ${entryPath}.permissionCategory must be supported.`);
          }
          includedToolPermissionCategoryCounts.set(
            entry.permissionCategory as string,
            (includedToolPermissionCategoryCounts.get(entry.permissionCategory as string) ?? 0) + 1
          );

          for (const field of ['mutatesWorkspace', 'mutatesExternalState', 'externalCommand', 'approvalRequired']) {
            if (typeof entry[field] !== 'boolean') {
              throw new Error(`compact result input ${entryPath}.${field} must be a boolean.`);
            }
          }

          if (typeof entry.summary !== 'string') {
            throw new Error(`compact result input ${entryPath}.summary must be a string.`);
          }
        }

        if (
          isNonNegativeInteger(value.harness.toolTrace.includedCount)
          && value.harness.toolTrace.includedCount !== value.harness.toolTrace.entries.length
        ) {
          throw new Error('compact result input harness.toolTrace.includedCount must match entries length when present.');
        }

        if (
          value.harness.toolTrace.entries.length === 0
          && value.harness.toolTrace.firstIncludedTurnIndex !== null
        ) {
          throw new Error('compact result input harness.toolTrace.firstIncludedTurnIndex must be null when entries are empty.');
        }

        if (
          value.harness.toolTrace.entries.length === 0
          && value.harness.toolTrace.lastIncludedTurnIndex !== null
        ) {
          throw new Error('compact result input harness.toolTrace.lastIncludedTurnIndex must be null when entries are empty.');
        }

        if (value.harness.toolTrace.entries.length > 0) {
          const firstToolTurnIndex = (value.harness.toolTrace.entries[0] as Record<string, unknown>).turnIndex;
          if (value.harness.toolTrace.firstIncludedTurnIndex !== firstToolTurnIndex) {
            throw new Error('compact result input harness.toolTrace.firstIncludedTurnIndex must match first entry turnIndex.');
          }

          const lastToolTurnIndex = (value.harness.toolTrace.entries[value.harness.toolTrace.entries.length - 1] as Record<string, unknown>).turnIndex;
          if (value.harness.toolTrace.lastIncludedTurnIndex !== lastToolTurnIndex) {
            throw new Error('compact result input harness.toolTrace.lastIncludedTurnIndex must match last entry turnIndex.');
          }

          if (value.harness.toolTrace.latestTurnIndex !== lastToolTurnIndex) {
            throw new Error('compact result input harness.toolTrace.latestTurnIndex must match last included tail entry.');
          }
        }

        for (const [category, count] of includedToolPermissionCategoryCounts) {
          const totalCategoryCount = value.harness.toolTrace.permissionCategoryCounts[category] ?? 0;
          if (!isNonNegativeInteger(totalCategoryCount) || (totalCategoryCount as number) < count) {
            throw new Error('compact result input harness.toolTrace.permissionCategoryCounts must cover included entries.');
          }
        }

        if (value.harness.toolTrace.omittedCount === 0) {
          for (const [category, count] of Object.entries(value.harness.toolTrace.permissionCategoryCounts)) {
            if ((includedToolPermissionCategoryCounts.get(category) ?? 0) !== count) {
              throw new Error('compact result input harness.toolTrace.permissionCategoryCounts must match included entries when none are omitted.');
            }
          }
        }
      }

      if (isRecord(value.harness.toolTrace.permissionCategoryCounts)) {
        let totalPermissionCategoryCount = 0;
        for (const [category, count] of Object.entries(value.harness.toolTrace.permissionCategoryCounts)) {
          if (!isKnownToolPermissionCategory(category) || !isNonNegativeInteger(count)) {
            throw new Error('compact result input harness.toolTrace.permissionCategoryCounts must use supported non-negative integer counts.');
          }
          totalPermissionCategoryCount += count as number;
        }

        if (
          isNonNegativeInteger(value.harness.toolTrace.totalCount)
          && totalPermissionCategoryCount !== (value.harness.toolTrace.totalCount as number)
        ) {
          throw new Error('compact result input harness.toolTrace.permissionCategoryCounts must sum to totalCount when present.');
        }
      }
    }

    if (isRecord(value.harness.toolPermissionSummary)) {
      const countKeys = [
        'totalToolCount',
        'workspaceMutationToolCount',
        'externalCommandToolCount',
        'externalStateMutationToolCount',
        'approvalRequiredToolCount'
      ];
      if (countKeys.some(key => key in value.harness.toolPermissionSummary && !isNonNegativeInteger(value.harness.toolPermissionSummary[key]))) {
        throw new Error('compact result input harness.toolPermissionSummary counts must be non-negative integers when present.');
      }

      const totalToolCount = isNonNegativeInteger(value.harness.toolPermissionSummary.totalToolCount)
        ? value.harness.toolPermissionSummary.totalToolCount as number
        : null;

      if (totalToolCount !== null) {
        for (const field of countKeys.filter(key => key !== 'totalToolCount')) {
          if (
            isNonNegativeInteger(value.harness.toolPermissionSummary[field])
            && (value.harness.toolPermissionSummary[field] as number) > totalToolCount
          ) {
            throw new Error(`compact result input harness.toolPermissionSummary.${field} must not exceed totalToolCount.`);
          }
        }
      }

      if (isRecord(value.harness.toolPermissionSummary.categories)) {
        let totalCategoryCount = 0;
        for (const [category, count] of Object.entries(value.harness.toolPermissionSummary.categories)) {
          if (!isKnownToolPermissionCategory(category) || !isNonNegativeInteger(count)) {
            throw new Error('compact result input harness.toolPermissionSummary.categories must use supported non-negative integer counts.');
          }
          totalCategoryCount += count as number;
        }

        if (totalToolCount !== null && totalCategoryCount !== totalToolCount) {
          throw new Error('compact result input harness.toolPermissionSummary.categories must sum to totalToolCount when present.');
        }
      }

      if (
        isRecord(value.harness.toolTrace)
        && isRecord(value.harness.toolTrace.permissionCategoryCounts)
        && isRecord(value.harness.toolPermissionSummary.categories)
      ) {
        const traceCategories = value.harness.toolTrace.permissionCategoryCounts;
        const summaryCategories = value.harness.toolPermissionSummary.categories;
        const categoryNames = new Set([
          ...Object.keys(traceCategories),
          ...Object.keys(summaryCategories)
        ]);

        for (const category of categoryNames) {
          if (traceCategories[category] !== summaryCategories[category]) {
            throw new Error('compact result input harness.toolPermissionSummary.categories must match harness.toolTrace.permissionCategoryCounts when present.');
          }
        }
      }
    }

    if (
      isRecord(value.harness.toolTrace)
      && isNonNegativeInteger(value.harness.toolTrace.totalCount)
      && value.harness.stateSummary.toolSummaryCount !== value.harness.toolTrace.totalCount
    ) {
      throw new Error('compact result input harness.stateSummary.toolSummaryCount must match harness.toolTrace.totalCount.');
    }

    if (
      isRecord(value.harness.toolPermissionSummary)
      && isNonNegativeInteger(value.harness.toolPermissionSummary.totalToolCount)
      && value.harness.stateSummary.toolSummaryCount !== value.harness.toolPermissionSummary.totalToolCount
    ) {
      throw new Error('compact result input harness.stateSummary.toolSummaryCount must match harness.toolPermissionSummary.totalToolCount.');
    }

    if (!isRecord(value.harness.lifecycleEvents)) {
      throw new Error('compact result input harness.lifecycleEvents must be an object when harness is present.');
    }

    if (!Array.isArray(value.harness.lifecycleEvents.events)) {
      throw new Error('compact result input harness.lifecycleEvents.events must be an array when harness is present.');
    }

    if (!isRecord(value.harness.lifecycleEvents.eventCounts)) {
      throw new Error('compact result input harness.lifecycleEvents.eventCounts must be an object when harness is present.');
    }

    if (isRecord(value.harness.lifecycleEvents)) {
      for (const field of ['maxEntries', 'totalCount', 'includedCount', 'omittedCount']) {
        if (field in value.harness.lifecycleEvents && !isNonNegativeInteger(value.harness.lifecycleEvents[field])) {
          throw new Error(`compact result input harness.lifecycleEvents.${field} must be a non-negative integer when present.`);
        }
      }

      if (Array.isArray(value.harness.lifecycleEvents.events)) {
        for (let index = 0; index < value.harness.lifecycleEvents.events.length; index += 1) {
          const event = value.harness.lifecycleEvents.events[index];
          const eventPath = `harness.lifecycleEvents.events[${index}]`;

          if (!isRecord(event) || !isKnownLifecycleEventName(event.event)) {
            throw new Error(`compact result input harness.lifecycleEvents.events[${index}].event must be supported.`);
          }

          if (event.turnIndex !== null && !isNonNegativeInteger(event.turnIndex)) {
            throw new Error(`compact result input ${eventPath}.turnIndex must be a non-negative integer or null.`);
          }

          if (event.actionKind !== null && !isKnownAgentActionKind(event.actionKind)) {
            throw new Error(`compact result input ${eventPath}.actionKind must be supported or null.`);
          }

          if (event.actionFamily !== null && !isKnownAgentActionFamily(event.actionFamily)) {
            throw new Error(`compact result input ${eventPath}.actionFamily must be supported or null.`);
          }

          if (event.executionStatus !== null && !isKnownAgentDecisionExecutionStatus(event.executionStatus)) {
            throw new Error(`compact result input ${eventPath}.executionStatus must be supported or null.`);
          }

          if (!isStringOrNull(event.reason)) {
            throw new Error(`compact result input ${eventPath}.reason must be string or null.`);
          }

          for (const field of ['toolCount', 'approvalSignalCount', 'validationIssueCount']) {
            assertIntegerField(event, field, eventPath, isNonNegativeInteger, 'a non-negative integer');
          }

          if (event.outcome !== null && !isKnownAgentResultOutcome(event.outcome)) {
            throw new Error(`compact result input ${eventPath}.outcome must be supported or null.`);
          }
        }

        if (
          isNonNegativeInteger(value.harness.lifecycleEvents.includedCount)
          && value.harness.lifecycleEvents.includedCount !== value.harness.lifecycleEvents.events.length
        ) {
          throw new Error('compact result input harness.lifecycleEvents.includedCount must match events length when present.');
        }

        if (
          isNonNegativeInteger(value.harness.lifecycleEvents.includedCount)
          && isNonNegativeInteger(value.harness.lifecycleEvents.maxEntries)
          && (value.harness.lifecycleEvents.includedCount as number) > (value.harness.lifecycleEvents.maxEntries as number)
        ) {
          throw new Error('compact result input harness.lifecycleEvents.includedCount must not exceed maxEntries.');
        }
      }

      if (isRecord(value.harness.lifecycleEvents.eventCounts)) {
        let totalLifecycleEventCount = 0;
        for (const [eventName, count] of Object.entries(value.harness.lifecycleEvents.eventCounts)) {
          if (!isKnownLifecycleEventName(eventName) || !isNonNegativeInteger(count)) {
            throw new Error('compact result input harness.lifecycleEvents.eventCounts must use supported non-negative integer event counts.');
          }
          totalLifecycleEventCount += count as number;
        }

        if (
          isNonNegativeInteger(value.harness.lifecycleEvents.totalCount)
          && totalLifecycleEventCount !== (value.harness.lifecycleEvents.totalCount as number)
        ) {
          throw new Error('compact result input harness.lifecycleEvents.eventCounts must sum to totalCount when present.');
        }

        if (value.harness.lifecycleEvents.eventCounts['query-started'] !== 1) {
          throw new Error('compact result input harness.lifecycleEvents.eventCounts.query-started must be exactly 1.');
        }

        if (value.harness.lifecycleEvents.eventCounts.terminal !== 1) {
          throw new Error('compact result input harness.lifecycleEvents.eventCounts.terminal must be exactly 1.');
        }

        if (value.harness.lifecycleEvents.eventCounts.decision !== value.turnsUsed) {
          throw new Error('compact result input harness.lifecycleEvents.eventCounts.decision must match root.turnsUsed.');
        }
      }

      if (
        hasNumericCountSet(value.harness.lifecycleEvents)
        && !hasConsistentCountSet(value.harness.lifecycleEvents)
      ) {
        throw new Error('compact result input harness.lifecycleEvents counts must be consistent when present.');
      }

      const includedLifecycleEvents = value.harness.lifecycleEvents.events;
      const terminalEventIndex = includedLifecycleEvents.findIndex(event =>
        isRecord(event) && event.event === 'terminal'
      );
      if (terminalEventIndex >= 0) {
        const terminalEvent = includedLifecycleEvents[terminalEventIndex];
        if (
          terminalEventIndex !== includedLifecycleEvents.length - 1
          || !isRecord(terminalEvent)
          || terminalEvent.outcome !== value.outcome
        ) {
          throw new Error('compact result input harness.lifecycleEvents terminal event must be last and match root.outcome.');
        }
      }
    }

    if (isRecord(value.harness.plannerHandoff)) {
      if (!isRecord(value.harness.plannerHandoff.lastAction)) {
        throw new Error('compact result input harness.plannerHandoff.lastAction must be an object when present.');
      }

      const lastAction = value.harness.plannerHandoff.lastAction;
      if (lastAction.kind !== null && !isKnownAgentActionKind(lastAction.kind)) {
        throw new Error('compact result input harness.plannerHandoff.lastAction.kind must be supported or null.');
      }

      if (lastAction.family !== null && !isKnownAgentActionFamily(lastAction.family)) {
        throw new Error('compact result input harness.plannerHandoff.lastAction.family must be supported or null.');
      }

      if (lastAction.stopReason !== null && !isKnownAgentStopReason(lastAction.stopReason)) {
        throw new Error('compact result input harness.plannerHandoff.lastAction.stopReason must be supported or null.');
      }

      if (lastAction.clarificationKind !== null && !isKnownAgentClarificationKind(lastAction.clarificationKind)) {
        throw new Error('compact result input harness.plannerHandoff.lastAction.clarificationKind must be supported or null.');
      }

      if (lastAction.executionStatus !== null && !isKnownAgentDecisionExecutionStatus(lastAction.executionStatus)) {
        throw new Error('compact result input harness.plannerHandoff.lastAction.executionStatus must be supported or null.');
      }

      if (lastAction.kind === 'stop' && lastAction.stopReason === null) {
        throw new Error('compact result input harness.plannerHandoff.lastAction.stopReason is required for stop actions.');
      }

      if (lastAction.kind !== 'stop' && lastAction.stopReason !== null) {
        throw new Error('compact result input harness.plannerHandoff.lastAction.stopReason must be null unless kind is stop.');
      }

      if (lastAction.kind === 'ask-for-clarification' && lastAction.clarificationKind === null) {
        throw new Error('compact result input harness.plannerHandoff.lastAction.clarificationKind is required for clarification actions.');
      }

      if (lastAction.kind !== 'ask-for-clarification' && lastAction.clarificationKind !== null) {
        throw new Error('compact result input harness.plannerHandoff.lastAction.clarificationKind must be null unless kind asks for clarification.');
      }

      if (
        isRecord(value.harness.plannerHandoff.activeBlocker)
        && !isKnownPlannerHandoffActiveBlocker(value.harness.plannerHandoff.activeBlocker.kind)
      ) {
        throw new Error('compact result input harness.plannerHandoff.activeBlocker.kind must be supported when present.');
      }

      if (!isRecord(value.harness.plannerHandoff.activeBlocker)) {
        throw new Error('compact result input harness.plannerHandoff.activeBlocker must be an object when present.');
      }

      const activeBlocker = value.harness.plannerHandoff.activeBlocker;
      if (activeBlocker.validationIssueKind !== null && !isKnownValidationIssueKind(activeBlocker.validationIssueKind)) {
        throw new Error('compact result input harness.plannerHandoff.activeBlocker.validationIssueKind must be supported or null.');
      }

      if (activeBlocker.approvalSignalKind !== null && !isKnownApprovalSignalKind(activeBlocker.approvalSignalKind)) {
        throw new Error('compact result input harness.plannerHandoff.activeBlocker.approvalSignalKind must be supported or null.');
      }

      if (activeBlocker.kind !== 'validation' && activeBlocker.validationIssueKind !== null) {
        throw new Error('compact result input harness.plannerHandoff.activeBlocker.validationIssueKind must be null unless blocker kind is validation.');
      }

      if (activeBlocker.kind !== 'approval' && activeBlocker.approvalSignalKind !== null) {
        throw new Error('compact result input harness.plannerHandoff.activeBlocker.approvalSignalKind must be null unless blocker kind is approval.');
      }

      if (!isKnownPlannerHandoffNextControlAction(value.harness.plannerHandoff.nextControlAction)) {
        throw new Error('compact result input harness.plannerHandoff.nextControlAction must be supported when present.');
      }

      const expectedActiveBlockerKind = (() => {
        switch (value.outcome) {
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
            return isRecord(value.harness) && isRecord(value.harness.loopBudget) && value.harness.loopBudget.exhausted === true
              ? 'turn-budget'
              : 'no-safe-action';
        }
      })();
      if (activeBlocker.kind !== expectedActiveBlockerKind) {
        throw new Error('compact result input harness.plannerHandoff.activeBlocker.kind must match outcome.');
      }

      const expectedNextControlAction = (() => {
        switch (value.outcome) {
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
            return expectedActiveBlockerKind === 'turn-budget'
              ? 'rerun-with-larger-turn-budget'
              : 'inspect-readiness-or-targeting';
        }
      })();
      if (value.harness.plannerHandoff.nextControlAction !== expectedNextControlAction) {
        throw new Error('compact result input harness.plannerHandoff.nextControlAction must match outcome.');
      }

      if (value.handoffCheckpoint.summary.activeBlocker !== activeBlocker.kind) {
        throw new Error('compact result input handoffCheckpoint.summary.activeBlocker must match harness.plannerHandoff.activeBlocker.kind.');
      }

      if (value.handoffCheckpoint.summary.nextControlAction !== value.harness.plannerHandoff.nextControlAction) {
        throw new Error('compact result input handoffCheckpoint.summary.nextControlAction must match harness.plannerHandoff.nextControlAction.');
      }
    }

    assertCompactWorkPlanConsistency(value.harness.workPlan, value);

    if (isRecord(value.harness.turnTraceBudget)) {
      assertHandoffBudgetMatches(
        value.handoffCheckpoint.budgets.turnTrace,
        'handoffCheckpoint.budgets.turnTrace',
        value.harness.turnTraceBudget.includedCount as number,
        value.harness.turnTraceBudget.omittedCount as number,
        'harness.turnTraceBudget'
      );
    }

    if (isRecord(value.harness.lifecycleEvents)) {
      assertHandoffBudgetMatches(
        value.handoffCheckpoint.budgets.lifecycleEvents,
        'handoffCheckpoint.budgets.lifecycleEvents',
        value.harness.lifecycleEvents.includedCount as number,
        value.harness.lifecycleEvents.omittedCount as number,
        'harness.lifecycleEvents'
      );
    }

    if (isRecord(value.harness.toolTrace)) {
      assertHandoffBudgetMatches(
        value.handoffCheckpoint.budgets.toolTrace,
        'handoffCheckpoint.budgets.toolTrace',
        value.harness.toolTrace.includedCount as number,
        value.harness.toolTrace.omittedCount as number,
        'harness.toolTrace'
      );
    }

    if (isRecord(value.harness.workPlan)) {
      assertHandoffBudgetMatches(
        value.handoffCheckpoint.budgets.workPlan,
        'handoffCheckpoint.budgets.workPlan',
        value.harness.workPlan.includedCount as number,
        value.harness.workPlan.omittedCount as number,
        'harness.workPlan'
      );
    }

    if (isRecord(value.harness.targeting)) {
      assertHandoffBudgetMatches(
        value.handoffCheckpoint.budgets.targeting,
        'handoffCheckpoint.budgets.targeting',
        value.harness.targeting.includedCount as number,
        value.harness.targeting.omittedCount as number,
        'harness.targeting'
      );
    }
  }

  if (isRecord(value.readiness)) {
    if (!isKnownDoctorCheckStatus(value.readiness.status)) {
      throw new Error('compact result input readiness.status must be supported when present.');
    }

    for (const field of ['passCount', 'warnCount', 'failCount']) {
      assertIntegerField(value.readiness, field, 'readiness', isNonNegativeInteger, 'a non-negative integer');
    }

    if (typeof value.readiness.doctorCommand !== 'string') {
      throw new Error('compact result input readiness.doctorCommand must be a string when present.');
    }

    assertCommandIncludesPlannerConfigFlags(
      value.readiness.doctorCommand,
      value.harness,
      'readiness.doctorCommand',
      { includePlannerMode: false }
    );

    assertPlannerProviderCatalogDiscovery(
      value.readiness.plannerProviderCatalog,
      'readiness.plannerProviderCatalog'
    );

    if (!Array.isArray(value.readiness.checks)) {
      throw new Error('compact result input readiness.checks must be an array when present.');
    }

    const statusCounts = {
      pass: 0,
      warn: 0,
      fail: 0
    };

    for (let index = 0; index < value.readiness.checks.length; index += 1) {
      const check = value.readiness.checks[index];
      const checkPath = `readiness.checks[${index}]`;

      if (!isRecord(check)) {
        throw new Error(`compact result input ${checkPath} must be an object.`);
      }

      if (typeof check.name !== 'string' || check.name.length === 0) {
        throw new Error(`compact result input ${checkPath}.name must be a non-empty string.`);
      }

      if (!isKnownDoctorCheckStatus(check.status)) {
        throw new Error(`compact result input ${checkPath}.status must be supported.`);
      }

      if (typeof check.message !== 'string') {
        throw new Error(`compact result input ${checkPath}.message must be a string.`);
      }

      if (!isStringOrNull(check.detail)) {
        throw new Error(`compact result input ${checkPath}.detail must be string or null.`);
      }

      statusCounts[check.status as keyof typeof statusCounts] += 1;
    }

    if (
      value.readiness.passCount !== statusCounts.pass
      || value.readiness.warnCount !== statusCounts.warn
      || value.readiness.failCount !== statusCounts.fail
    ) {
      throw new Error('compact result input readiness counts must match checks by status.');
    }

    const expectedReadinessStatus = statusCounts.fail > 0 ? 'fail' : statusCounts.warn > 0 ? 'warn' : 'pass';
    if (value.readiness.status !== expectedReadinessStatus) {
      throw new Error('compact result input readiness.status must match check counts.');
    }

    if (value.handoffCheckpoint.summary.readinessStatus !== value.readiness.status) {
      throw new Error('compact result input handoffCheckpoint.summary.readinessStatus must match readiness.status.');
    }
  }

  if (!isRecord(value.validation) || !Array.isArray(value.validation.identityConflicts)) {
    throw new Error('compact result input must include validation.identityConflicts array.');
  }

  if (typeof value.validation.status !== 'string') {
    throw new Error('compact result input validation.status must be a string.');
  }

  if (value.handoffCheckpoint.summary.validationStatus !== value.validation.status) {
    throw new Error('compact result input handoffCheckpoint.summary.validationStatus must match validation.status.');
  }

  if (!isRecord(value.validation.identityConflictSummary)) {
    throw new Error('compact result input must include validation.identityConflictSummary object.');
  }

  for (const field of ['totalCount', 'includedCount', 'maxEntries', 'omittedCount']) {
    assertIntegerField(
      value.validation.identityConflictSummary,
      field,
      'validation.identityConflictSummary',
      isNonNegativeInteger,
      'a non-negative integer'
    );
  }

  if (value.validation.identityConflictSummary.mutationAllowed !== false) {
    throw new Error('compact result input validation.identityConflictSummary.mutationAllowed must be false.');
  }

  if (
    !hasConsistentCountSet(value.validation.identityConflictSummary)
  ) {
    throw new Error('compact result input validation.identityConflictSummary counts must be consistent.');
  }

  if (
    (value.validation.identityConflictSummary.includedCount as number)
    > (value.validation.identityConflictSummary.maxEntries as number)
  ) {
    throw new Error('compact result input validation.identityConflictSummary.includedCount must not exceed maxEntries.');
  }

  if ((value.validation.identityConflictSummary.includedCount as number) !== value.validation.identityConflicts.length) {
    throw new Error('compact result input validation.identityConflictSummary.includedCount must match validation.identityConflicts length.');
  }

  if (!isRecord(value.validation.identityConflictSummary.byEngine)) {
    throw new Error('compact result input validation.identityConflictSummary.byEngine must be an object.');
  }

  assertNumericMap(
    value.validation.identityConflictSummary.byEngine,
    'validation.identityConflictSummary.byEngine',
    isKnownIdentityConflictEngine
  );

  if (!isRecord(value.validation.identityConflictSummary.byRiskCategory)) {
    throw new Error('compact result input validation.identityConflictSummary.byRiskCategory must be an object.');
  }

  assertNumericMap(
    value.validation.identityConflictSummary.byRiskCategory,
    'validation.identityConflictSummary.byRiskCategory',
    isKnownIdentityConflictRiskCategory
  );

  const byEngineTotal = Object.values(value.validation.identityConflictSummary.byEngine)
    .reduce((total, count) => total + (count as number), 0);
  if (byEngineTotal !== value.validation.identityConflictSummary.totalCount) {
    throw new Error('compact result input validation.identityConflictSummary.byEngine counts must sum to totalCount.');
  }

  const byRiskCategoryTotal = Object.values(value.validation.identityConflictSummary.byRiskCategory)
    .reduce((total, count) => total + (count as number), 0);
  if (byRiskCategoryTotal !== value.validation.identityConflictSummary.totalCount) {
    throw new Error('compact result input validation.identityConflictSummary.byRiskCategory counts must sum to totalCount.');
  }

  for (const field of ['targetCommandCount', 'yamlGuardCount']) {
    if (field in value.validation && !isNonNegativeInteger(value.validation[field])) {
      throw new Error(`compact result input validation.${field} must be a non-negative integer when present.`);
    }
  }

  if (!Array.isArray(value.validation.selectedPlan)) {
    throw new Error('compact result input must include validation.selectedPlan array.');
  }

  for (let index = 0; index < value.validation.selectedPlan.length; index += 1) {
    const entry = value.validation.selectedPlan[index];
    const entryPath = `validation.selectedPlan[${index}]`;

    if (!isRecord(entry)) {
      throw new Error(`compact result input ${entryPath} must be an object.`);
    }

    if (!isKnownValidationPlanKind(entry.kind)) {
      throw new Error(`compact result input ${entryPath}.kind must be supported.`);
    }

    if (typeof entry.target !== 'string' || entry.target.length === 0) {
      throw new Error(`compact result input ${entryPath}.target must be a non-empty string.`);
    }

    for (const field of ['commandCount', 'executedCommandCount', 'failedCommandCount']) {
      assertIntegerField(entry, field, entryPath, isNonNegativeInteger, 'a non-negative integer');
    }

    if (
      !Array.isArray(entry.commands)
      || !entry.commands.every(command => typeof command === 'string' && command.length > 0)
    ) {
      throw new Error(`compact result input ${entryPath}.commands must be a non-empty string array.`);
    }

    if (typeof entry.validatorAvailable !== 'boolean') {
      throw new Error(`compact result input ${entryPath}.validatorAvailable must be a boolean.`);
    }

    if (entry.commandCount !== entry.commands.length) {
      throw new Error(`compact result input ${entryPath}.commandCount must match commands length.`);
    }

    if ((entry.executedCommandCount as number) > (entry.commandCount as number)) {
      throw new Error(`compact result input ${entryPath}.executedCommandCount must not exceed commandCount.`);
    }

    if ((entry.failedCommandCount as number) > (entry.executedCommandCount as number)) {
      throw new Error(`compact result input ${entryPath}.failedCommandCount must not exceed executedCommandCount.`);
    }
  }

  if (isRecord(value.validation.commands)) {
    for (const field of ['maxEntries', 'omittedCount']) {
      if (field in value.validation.commands && !isNonNegativeInteger(value.validation.commands[field])) {
        throw new Error(`compact result input validation.commands.${field} must be a non-negative integer when present.`);
      }
    }

    if ('entries' in value.validation.commands && !Array.isArray(value.validation.commands.entries)) {
      throw new Error('compact result input validation.commands.entries must be an array when present.');
    }

    if (Array.isArray(value.validation.commands.entries)) {
      if (
        isNonNegativeInteger(value.validation.commands.maxEntries)
        && value.validation.commands.entries.length > (value.validation.commands.maxEntries as number)
      ) {
        throw new Error('compact result input validation.commands.entries length must not exceed maxEntries.');
      }

      for (let index = 0; index < value.validation.commands.entries.length; index += 1) {
        const entry = value.validation.commands.entries[index];
        const entryPath = `validation.commands.entries[${index}]`;

        if (!isRecord(entry)) {
          throw new Error(`compact result input ${entryPath} must be an object.`);
        }

        if (typeof entry.command !== 'string' || entry.command.length === 0) {
          throw new Error(`compact result input ${entryPath}.command must be a non-empty string.`);
        }

        assertIntegerField(entry, 'exitCode', entryPath, isNonNegativeInteger, 'a non-negative integer');

        if (!isKnownValidationCommandStatus(entry.status)) {
          throw new Error(`compact result input ${entryPath}.status must be supported.`);
        }

        if (!isKnownValidationCommandKind(entry.kind)) {
          throw new Error(`compact result input ${entryPath}.kind must be supported.`);
        }

        if (typeof entry.stdoutPreview !== 'string') {
          throw new Error(`compact result input ${entryPath}.stdoutPreview must be a string.`);
        }

        if (typeof entry.stderrPreview !== 'string') {
          throw new Error(`compact result input ${entryPath}.stderrPreview must be a string.`);
        }

        if (typeof entry.unsafeBlocked !== 'boolean') {
          throw new Error(`compact result input ${entryPath}.unsafeBlocked must be a boolean.`);
        }

        if (!isStringOrNull(entry.unsafeRuleId)) {
          throw new Error(`compact result input ${entryPath}.unsafeRuleId must be string or null.`);
        }

        if (!isStringOrNull(entry.unsafeReason)) {
          throw new Error(`compact result input ${entryPath}.unsafeReason must be string or null.`);
        }

        const exitCode = entry.exitCode as number;
        if (entry.status === 'passed' && exitCode !== 0) {
          throw new Error(`compact result input ${entryPath}.status must match exitCode.`);
        }

        if (entry.status === 'failed' && exitCode === 0) {
          throw new Error(`compact result input ${entryPath}.status must match exitCode.`);
        }

        if (entry.unsafeBlocked && (typeof entry.unsafeRuleId !== 'string' || typeof entry.unsafeReason !== 'string')) {
          throw new Error(`compact result input ${entryPath}.unsafeRuleId and unsafeReason must be strings when unsafeBlocked is true.`);
        }

        if (!entry.unsafeBlocked && (entry.unsafeRuleId !== null || entry.unsafeReason !== null)) {
          throw new Error(`compact result input ${entryPath}.unsafeRuleId and unsafeReason must be null when unsafeBlocked is false.`);
        }
      }

      if (value.validation.commands.omittedCount === 0) {
        const targetCommandCount = value.validation.commands.entries
          .filter(entry => isRecord(entry) && entry.kind === 'target-validation')
          .length;
        const yamlGuardCount = value.validation.commands.entries
          .filter(entry => isRecord(entry) && entry.kind === 'yaml-guard')
          .length;
        const selectedPlanCommandOwners = new Map<string, number>();
        const selectedPlanExecutedCounts = Array(value.validation.selectedPlan.length).fill(0) as number[];
        const selectedPlanFailedCounts = Array(value.validation.selectedPlan.length).fill(0) as number[];

        for (let selectedPlanIndex = 0; selectedPlanIndex < value.validation.selectedPlan.length; selectedPlanIndex += 1) {
          const selectedPlanEntry = value.validation.selectedPlan[selectedPlanIndex];
          if (!isRecord(selectedPlanEntry) || !Array.isArray(selectedPlanEntry.commands)) {
            continue;
          }

          for (const command of selectedPlanEntry.commands) {
            if (typeof command !== 'string') {
              continue;
            }

            const existingOwner = selectedPlanCommandOwners.get(command);
            if (existingOwner !== undefined && existingOwner !== selectedPlanIndex) {
              throw new Error(`compact result input validation.selectedPlan command "${command}" is owned by both validation.selectedPlan[${existingOwner}] and validation.selectedPlan[${selectedPlanIndex}].`);
            }

            selectedPlanCommandOwners.set(command, selectedPlanIndex);
          }
        }

        for (let commandIndex = 0; commandIndex < value.validation.commands.entries.length; commandIndex += 1) {
          const commandEntry = value.validation.commands.entries[commandIndex];
          if (!isRecord(commandEntry) || commandEntry.kind !== 'target-validation') {
            continue;
          }

          const ownerIndex = selectedPlanCommandOwners.get(commandEntry.command as string);
          if (ownerIndex === undefined) {
            throw new Error(`compact result input validation.commands.entries[${commandIndex}].command must exist in validation.selectedPlan commands when no commands are omitted.`);
          }

          selectedPlanExecutedCounts[ownerIndex] += 1;
          if (commandEntry.status === 'failed') {
            selectedPlanFailedCounts[ownerIndex] += 1;
          }
        }

        for (let selectedPlanIndex = 0; selectedPlanIndex < value.validation.selectedPlan.length; selectedPlanIndex += 1) {
          const selectedPlanEntry = value.validation.selectedPlan[selectedPlanIndex];
          if (!isRecord(selectedPlanEntry)) {
            continue;
          }

          if (selectedPlanEntry.executedCommandCount !== selectedPlanExecutedCounts[selectedPlanIndex]) {
            throw new Error(`compact result input validation.selectedPlan[${selectedPlanIndex}].executedCommandCount must match validation.commands target-validation entries when no commands are omitted.`);
          }

          if (selectedPlanEntry.failedCommandCount !== selectedPlanFailedCounts[selectedPlanIndex]) {
            throw new Error(`compact result input validation.selectedPlan[${selectedPlanIndex}].failedCommandCount must match failed validation.commands target-validation entries when no commands are omitted.`);
          }
        }

        if (value.validation.targetCommandCount !== targetCommandCount) {
          throw new Error('compact result input validation.targetCommandCount must match validation.commands target-validation entries when no commands are omitted.');
        }

        if (value.validation.yamlGuardCount !== yamlGuardCount) {
          throw new Error('compact result input validation.yamlGuardCount must match validation.commands yaml-guard entries when no commands are omitted.');
        }
      }
    }

    if (
      Array.isArray(value.validation.commands.entries)
      && isNonNegativeInteger(value.validation.commands.omittedCount)
    ) {
      assertHandoffBudgetMatches(
        value.handoffCheckpoint.budgets.validationCommands,
        'handoffCheckpoint.budgets.validationCommands',
        value.validation.commands.entries.length,
        value.validation.commands.omittedCount as number,
        'validation.commands'
      );

      if (
        isRecord(value.harness)
        && isRecord(value.harness.stateSummary)
        && value.harness.stateSummary.validationResultCount
          !== value.validation.commands.entries.length + (value.validation.commands.omittedCount as number)
      ) {
        throw new Error('compact result input harness.stateSummary.validationResultCount must match validation.commands included plus omitted count.');
      }
    }
  }

  if (!isRecord(value.validation.issueSummary)) {
    throw new Error('compact result input must include validation.issueSummary object.');
  }

  for (const field of [
    'totalCount',
    'omittedIssueCount',
    'repairableCount',
    'nonRepairableCount',
    'maxGroups',
    'omittedGroupCount'
  ]) {
    assertIntegerField(
      value.validation.issueSummary,
      field,
      'validation.issueSummary',
      isNonNegativeInteger,
      'a non-negative integer'
    );
  }

  const issueSummaryTotalCount = value.validation.issueSummary.totalCount as number;
  const issueSummaryRepairableCount = value.validation.issueSummary.repairableCount as number;
  const issueSummaryNonRepairableCount = value.validation.issueSummary.nonRepairableCount as number;
  const issueSummaryMaxGroups = value.validation.issueSummary.maxGroups as number;
  const issueSummaryOmittedGroupCount = value.validation.issueSummary.omittedGroupCount as number;

  if (issueSummaryRepairableCount + issueSummaryNonRepairableCount !== issueSummaryTotalCount) {
    throw new Error('compact result input validation.issueSummary repairable counts must sum to totalCount.');
  }

  if (
    isRecord(value.harness)
    && isRecord(value.harness.stateSummary)
    && value.harness.stateSummary.validationIssueCount !== issueSummaryTotalCount
  ) {
    throw new Error('compact result input harness.stateSummary.validationIssueCount must match validation.issueSummary.totalCount.');
  }

  if (!Array.isArray(value.validation.issueSummary.groups)) {
    throw new Error('compact result input validation.issueSummary.groups must be an array.');
  }

  if (value.validation.issueSummary.groups.length > issueSummaryMaxGroups) {
    throw new Error('compact result input validation.issueSummary.groups length must not exceed maxGroups.');
  }

  let groupedIssueCount = 0;
  let groupedRepairableCount = 0;
  let groupedNonRepairableCount = 0;
  const groupedIssueKinds = new Set<string>();

  for (let index = 0; index < value.validation.issueSummary.groups.length; index += 1) {
    const group = value.validation.issueSummary.groups[index];
    const groupPath = `validation.issueSummary.groups[${index}]`;

    if (!isRecord(group)) {
      throw new Error(`compact result input ${groupPath} must be an object.`);
    }

    if (!isKnownValidationIssueKind(group.kind)) {
      throw new Error(`compact result input ${groupPath}.kind must be supported.`);
    }

    if (typeof group.repairable !== 'boolean') {
      throw new Error(`compact result input ${groupPath}.repairable must be a boolean.`);
    }

    assertIntegerField(group, 'count', groupPath, isPositiveInteger, 'a positive integer');
    assertIntegerField(group, 'sourceCommandCount', groupPath, isPositiveInteger, 'a positive integer');

    if (typeof group.blocking !== 'boolean') {
      throw new Error(`compact result input ${groupPath}.blocking must be a boolean.`);
    }

    groupedIssueCount += group.count as number;
    if (group.repairable) {
      groupedRepairableCount += group.count as number;
    } else {
      groupedNonRepairableCount += group.count as number;
    }
    groupedIssueKinds.add(group.kind as string);
  }

  if (groupedIssueCount > issueSummaryTotalCount) {
    throw new Error('compact result input validation.issueSummary group counts must not exceed totalCount.');
  }

  if (issueSummaryOmittedGroupCount === 0 && groupedIssueCount !== issueSummaryTotalCount) {
    throw new Error('compact result input validation.issueSummary group counts must match totalCount when no groups are omitted.');
  }

  if (issueSummaryOmittedGroupCount === 0 && groupedRepairableCount !== issueSummaryRepairableCount) {
    throw new Error('compact result input validation.issueSummary repairable group counts must match repairableCount when no groups are omitted.');
  }

  if (issueSummaryOmittedGroupCount === 0 && groupedNonRepairableCount !== issueSummaryNonRepairableCount) {
    throw new Error('compact result input validation.issueSummary non-repairable group counts must match nonRepairableCount when no groups are omitted.');
  }

  if (!isRecord(value.validation.issueSummary.flags)) {
    throw new Error('compact result input validation.issueSummary.flags must be an object.');
  }

  const issueSummaryFlags = value.validation.issueSummary.flags;
  for (const field of [
    'hasRepairableIssues',
    'hasNonRepairableIssues',
    'hasUnsafeValidationCommand',
    'hasYamlSyntaxFailure',
    'hasIdentityConflict'
  ]) {
    if (typeof issueSummaryFlags[field] !== 'boolean') {
      throw new Error(`compact result input validation.issueSummary.flags.${field} must be a boolean.`);
    }
  }

  if (issueSummaryFlags.hasRepairableIssues !== (issueSummaryRepairableCount > 0)) {
    throw new Error('compact result input validation.issueSummary.flags.hasRepairableIssues must match repairableCount.');
  }

  if (issueSummaryFlags.hasNonRepairableIssues !== (issueSummaryNonRepairableCount > 0)) {
    throw new Error('compact result input validation.issueSummary.flags.hasNonRepairableIssues must match nonRepairableCount.');
  }

  if (issueSummaryOmittedGroupCount === 0) {
    if (issueSummaryFlags.hasUnsafeValidationCommand !== groupedIssueKinds.has('unsafe-validation-command')) {
      throw new Error('compact result input validation.issueSummary.flags.hasUnsafeValidationCommand must match groups when no groups are omitted.');
    }

    if (issueSummaryFlags.hasYamlSyntaxFailure !== groupedIssueKinds.has('yaml-syntax-failure')) {
      throw new Error('compact result input validation.issueSummary.flags.hasYamlSyntaxFailure must match groups when no groups are omitted.');
    }

    const hasIdentityConflict = groupedIssueKinds.has('terraform-create-before-delete-conflict')
      || groupedIssueKinds.has('pulumi-create-before-delete-conflict');
    if (issueSummaryFlags.hasIdentityConflict !== hasIdentityConflict) {
      throw new Error('compact result input validation.issueSummary.flags.hasIdentityConflict must match groups when no groups are omitted.');
    }
  }

  assertHandoffBudgetMatches(
    value.handoffCheckpoint.budgets.validationIssueGroups,
    'handoffCheckpoint.budgets.validationIssueGroups',
    value.validation.issueSummary.groups.length,
    issueSummaryOmittedGroupCount,
    'validation.issueSummary'
  );

  if (!isRecord(value.validation.issueDetails)) {
    throw new Error('compact result input must include validation.issueDetails object.');
  }

  for (const field of ['maxEntries', 'omittedCount']) {
    assertIntegerField(
      value.validation.issueDetails,
      field,
      'validation.issueDetails',
      isNonNegativeInteger,
      'a non-negative integer'
    );
  }

  if (value.validation.issueDetails.omittedCount !== value.validation.issueSummary.omittedIssueCount) {
    throw new Error('compact result input validation.issueDetails.omittedCount must match validation.issueSummary.omittedIssueCount.');
  }

  if (!Array.isArray(value.validation.issues)) {
    throw new Error('compact result input must include validation.issues array.');
  }

  const sampledIssueOmittedCount = value.validation.issueDetails.omittedCount as number;
  if (value.validation.issues.length > (value.validation.issueDetails.maxEntries as number)) {
    throw new Error('compact result input validation.issues length must not exceed validation.issueDetails.maxEntries.');
  }

  if (value.validation.issues.length + sampledIssueOmittedCount !== issueSummaryTotalCount) {
    throw new Error('compact result input validation.issues length plus omitted count must match validation.issueSummary.totalCount.');
  }

  assertHandoffBudgetMatches(
    value.handoffCheckpoint.budgets.validationIssues,
    'handoffCheckpoint.budgets.validationIssues',
    value.validation.issues.length,
    sampledIssueOmittedCount,
    'validation.issueDetails'
  );

  let sampledRepairableCount = 0;
  let sampledNonRepairableCount = 0;
  const sampledIssueGroupCounts = new Map<string, number>();

  for (let index = 0; index < value.validation.issues.length; index += 1) {
    const issue = value.validation.issues[index];
    const issuePath = `validation.issues[${index}]`;

    if (!isRecord(issue)) {
      throw new Error(`compact result input ${issuePath} must be an object.`);
    }

    if (!isKnownValidationIssueKind(issue.kind)) {
      throw new Error(`compact result input ${issuePath}.kind must be supported.`);
    }

    if (typeof issue.repairable !== 'boolean') {
      throw new Error(`compact result input ${issuePath}.repairable must be a boolean.`);
    }

    if (typeof issue.message !== 'string' || issue.message.length === 0) {
      throw new Error(`compact result input ${issuePath}.message must be a non-empty string.`);
    }

    if ('guidance' in issue && !isStringOrNull(issue.guidance)) {
      throw new Error(`compact result input ${issuePath}.guidance must be string or null when present.`);
    }

    if ('metadata' in issue) {
      if (!isRecord(issue.metadata)) {
        throw new Error(`compact result input ${issuePath}.metadata must be an object when present.`);
      }

      for (const [key, metadataValue] of Object.entries(issue.metadata)) {
        if (typeof metadataValue !== 'string') {
          throw new Error(`compact result input ${issuePath}.metadata.${key} must be a string.`);
        }
      }
    }

    if (issue.repairable) {
      sampledRepairableCount += 1;
    } else {
      sampledNonRepairableCount += 1;
    }

    const issueGroupKey = `${issue.kind}:${issue.repairable}`;
    sampledIssueGroupCounts.set(issueGroupKey, (sampledIssueGroupCounts.get(issueGroupKey) ?? 0) + 1);
  }

  if (sampledIssueOmittedCount === 0) {
    if (sampledRepairableCount !== issueSummaryRepairableCount) {
      throw new Error('compact result input validation.issues repairable count must match validation.issueSummary when no issues are omitted.');
    }

    if (sampledNonRepairableCount !== issueSummaryNonRepairableCount) {
      throw new Error('compact result input validation.issues non-repairable count must match validation.issueSummary when no issues are omitted.');
    }

    for (let index = 0; index < value.validation.issueSummary.groups.length; index += 1) {
      const group = value.validation.issueSummary.groups[index] as Record<string, unknown>;
      const groupKey = `${group.kind}:${group.repairable}`;
      if (sampledIssueGroupCounts.get(groupKey) !== group.count) {
        throw new Error('compact result input validation.issues group counts must match validation.issueSummary.groups when no issues are omitted.');
      }
    }
  }

  if (!isRecord(value.validation.safetyBlockers)) {
    throw new Error('compact result input must include validation.safetyBlockers object.');
  }

  for (const field of ['maxEntries', 'omittedCount']) {
    assertIntegerField(
      value.validation.safetyBlockers,
      field,
      'validation.safetyBlockers',
      isNonNegativeInteger,
      'a non-negative integer'
    );
  }

  if (!Array.isArray(value.validation.safetyBlockers.entries)) {
    throw new Error('compact result input validation.safetyBlockers.entries must be an array.');
  }

  if (
    value.validation.safetyBlockers.entries.length > (value.validation.safetyBlockers.maxEntries as number)
  ) {
    throw new Error('compact result input validation.safetyBlockers.entries length must not exceed maxEntries.');
  }

  for (let index = 0; index < value.validation.safetyBlockers.entries.length; index += 1) {
    const entry = value.validation.safetyBlockers.entries[index];
    const entryPath = `validation.safetyBlockers.entries[${index}]`;

    if (!isRecord(entry)) {
      throw new Error(`compact result input ${entryPath} must be an object.`);
    }

    if (!isKnownValidationSafetyBlockerKind(entry.kind)) {
      throw new Error(`compact result input ${entryPath}.kind must be supported.`);
    }

    for (const field of ['sourceCommand', 'message']) {
      if (typeof entry[field] !== 'string' || entry[field].length === 0) {
        throw new Error(`compact result input ${entryPath}.${field} must be a non-empty string.`);
      }
    }

    if (!isStringOrNull(entry.guidance)) {
      throw new Error(`compact result input ${entryPath}.guidance must be string or null.`);
    }

    if (typeof entry.repairable !== 'boolean') {
      throw new Error(`compact result input ${entryPath}.repairable must be a boolean.`);
    }

    if (entry.mutationPrevented !== true) {
      throw new Error(`compact result input ${entryPath}.mutationPrevented must be true.`);
    }

    for (const field of ['unsafeCommand', 'unsafeRuleId', 'unsafeReason', 'yamlPath', 'yamlParser']) {
      if (!isStringOrNull(entry[field])) {
        throw new Error(`compact result input ${entryPath}.${field} must be string or null.`);
      }
    }

    if (entry.kind === 'unsafe-validation-command') {
      for (const field of ['unsafeCommand', 'unsafeRuleId', 'unsafeReason']) {
        if (typeof entry[field] !== 'string' || entry[field].length === 0) {
          throw new Error(`compact result input ${entryPath}.${field} must be a non-empty string for unsafe-validation-command safety blockers.`);
        }
      }

      for (const field of ['yamlPath', 'yamlParser']) {
        if (entry[field] !== null) {
          throw new Error(`compact result input ${entryPath}.${field} must be null for unsafe-validation-command safety blockers.`);
        }
      }
    }

    if (entry.kind === 'yaml-syntax-failure') {
      for (const field of ['yamlPath', 'yamlParser']) {
        if (typeof entry[field] !== 'string' || entry[field].length === 0) {
          throw new Error(`compact result input ${entryPath}.${field} must be a non-empty string for yaml-syntax-failure safety blockers.`);
        }
      }

      for (const field of ['unsafeCommand', 'unsafeRuleId', 'unsafeReason']) {
        if (entry[field] !== null) {
          throw new Error(`compact result input ${entryPath}.${field} must be null for yaml-syntax-failure safety blockers.`);
        }
      }
    }
  }

  assertHandoffBudgetMatches(
    value.handoffCheckpoint.budgets.validationSafetyBlockers,
    'handoffCheckpoint.budgets.validationSafetyBlockers',
    value.validation.safetyBlockers.entries.length,
    value.validation.safetyBlockers.omittedCount as number,
    'validation.safetyBlockers'
  );

  const includedIdentityConflictCountsByEngine = new Map<string, number>();
  const includedIdentityConflictCountsByRiskCategory = new Map<string, number>();

  for (let index = 0; index < value.validation.identityConflicts.length; index += 1) {
    const conflict = value.validation.identityConflicts[index];
    if (!isRecord(conflict)) {
      throw new Error(`compact result conflict at index ${index} must be an object.`);
    }

    if (!isKnownIdentityConflictEngine(conflict.engine)) {
      throw new Error(`compact result conflict at index ${index} must include engine terraform or pulumi.`);
    }

    if (conflict.issueKind !== expectedIdentityIssueKind(conflict.engine)) {
      throw new Error(`compact result conflict at index ${index} must include matching engine issueKind.`);
    }

    if (!isKnownIdentityConflictRiskCategory(conflict.riskCategory)) {
      throw new Error(`compact result conflict at index ${index} must include supported riskCategory.`);
    }

    if (!isRecord(conflict.identity)) {
      throw new Error(`compact result conflict at index ${index} must include identity object.`);
    }

    if (Object.values(conflict.identity).some(value => typeof value !== 'string')) {
      throw new Error(`compact result conflict at index ${index} identity values must be strings.`);
    }

    if (typeof conflict.sourceCommand !== 'string' || conflict.sourceCommand.length === 0) {
      throw new Error(`compact result conflict at index ${index} must include sourceCommand.`);
    }

    if (!Array.isArray(conflict.reviewSteps) || conflict.reviewSteps.some(step => typeof step !== 'string')) {
      throw new Error(`compact result conflict at index ${index} must include reviewSteps array.`);
    }

    if ('mutationAllowed' in conflict && conflict.mutationAllowed !== false) {
      throw new Error(`compact result conflict at index ${index} mutationAllowed must be false when present.`);
    }

    includedIdentityConflictCountsByEngine.set(
      conflict.engine as string,
      (includedIdentityConflictCountsByEngine.get(conflict.engine as string) ?? 0) + 1
    );
    includedIdentityConflictCountsByRiskCategory.set(
      conflict.riskCategory as string,
      (includedIdentityConflictCountsByRiskCategory.get(conflict.riskCategory as string) ?? 0) + 1
    );
  }

  for (const [engine, includedCount] of includedIdentityConflictCountsByEngine) {
    if (includedCount > (value.validation.identityConflictSummary.byEngine[engine] as number)) {
      throw new Error('compact result input validation.identityConflictSummary.byEngine must cover included conflicts.');
    }
  }

  for (const [riskCategory, includedCount] of includedIdentityConflictCountsByRiskCategory) {
    if (includedCount > (value.validation.identityConflictSummary.byRiskCategory[riskCategory] as number)) {
      throw new Error('compact result input validation.identityConflictSummary.byRiskCategory must cover included conflicts.');
    }
  }

  if ((value.validation.identityConflictSummary.omittedCount as number) === 0) {
    for (const [engine, totalCount] of Object.entries(value.validation.identityConflictSummary.byEngine)) {
      if ((includedIdentityConflictCountsByEngine.get(engine) ?? 0) !== totalCount) {
        throw new Error('compact result input validation.identityConflictSummary.byEngine must match included conflicts when none are omitted.');
      }
    }

    for (const [riskCategory, totalCount] of Object.entries(value.validation.identityConflictSummary.byRiskCategory)) {
      if ((includedIdentityConflictCountsByRiskCategory.get(riskCategory) ?? 0) !== totalCount) {
        throw new Error('compact result input validation.identityConflictSummary.byRiskCategory must match included conflicts when none are omitted.');
      }
    }
  }

  if (value.handoffCheckpoint.summary.validationIssueCount !== value.validation.issueSummary.totalCount) {
    throw new Error('compact result input handoffCheckpoint.summary.validationIssueCount must match validation.issueSummary.totalCount.');
  }

  if (value.handoffCheckpoint.summary.identityConflictCount !== value.validation.identityConflictSummary.totalCount) {
    throw new Error('compact result input handoffCheckpoint.summary.identityConflictCount must match validation.identityConflictSummary.totalCount.');
  }

  assertHandoffBudgetMatches(
    value.handoffCheckpoint.budgets.identityConflicts,
    'handoffCheckpoint.budgets.identityConflicts',
    value.validation.identityConflictSummary.includedCount as number,
    value.validation.identityConflictSummary.omittedCount as number,
    'validation.identityConflictSummary'
  );

  if (!isRecord(value.approval)) {
    throw new Error('compact result input must include approval object.');
  }

  if (!Array.isArray(value.approval.signals)) {
    throw new Error('compact result input approval.signals must be an array.');
  }

  if (!isRecord(value.approval.resume)) {
    throw new Error('compact result input approval.resume must be an object.');
  }

  if (!isRecord(value.approval.grants)) {
    throw new Error('compact result input approval.grants must be an object.');
  }

  if (isRecord(value.approval)) {
    if ('requiredWriteRisks' in value.approval && !isArrayOf(value.approval.requiredWriteRisks, isKnownFileWriteRisk)) {
      throw new Error('compact result input approval.requiredWriteRisks must use supported write risks when present.');
    }

    if (
      'requiredToolCategories' in value.approval
      && !isArrayOf(value.approval.requiredToolCategories, isKnownToolPermissionCategory)
    ) {
      throw new Error('compact result input approval.requiredToolCategories must use supported tool categories when present.');
    }

    if (isRecord(value.approval.grants)) {
      if (!isArrayOf(value.approval.grants.approvedWriteRisks, isKnownFileWriteRisk)) {
        throw new Error('compact result input approval.grants.approvedWriteRisks must use supported write risks.');
      }

      if (!isStringArray(value.approval.grants.approvedWritePaths)) {
        throw new Error('compact result input approval.grants.approvedWritePaths must be a string array.');
      }

      if (!isArrayOf(value.approval.grants.approvedToolCategories, isKnownToolPermissionCategory)) {
        throw new Error('compact result input approval.grants.approvedToolCategories must use supported tool categories.');
      }

      if (!isKnownApprovalWritePathScope(value.approval.grants.writePathScope)) {
        throw new Error('compact result input approval.grants.writePathScope must be supported.');
      }

      if (typeof value.approval.grants.hasExplicitApproval !== 'boolean') {
        throw new Error('compact result input approval.grants.hasExplicitApproval must be a boolean.');
      }

      if (value.approval.grants.writePathScope === 'all' && value.approval.grants.approvedWritePaths.length > 0) {
        throw new Error('compact result input approval.grants.writePathScope must be scoped when approved write paths are present.');
      }

      if (value.approval.grants.writePathScope === 'scoped' && value.approval.grants.approvedWritePaths.length === 0) {
        throw new Error('compact result input approval.grants.writePathScope must be all when no approved write paths are present.');
      }

      const hasAnyGrant = value.approval.grants.approvedWriteRisks.length > 0
        || value.approval.grants.approvedWritePaths.length > 0
        || value.approval.grants.approvedToolCategories.length > 0;

      if (value.approval.grants.hasExplicitApproval !== hasAnyGrant) {
        throw new Error('compact result input approval.grants.hasExplicitApproval must match approved grant arrays.');
      }
    }

    const includedApprovalWriteRisks = new Set<string>();
    const includedApprovalWritePaths = new Set<string>();
    const includedApprovalToolCategories = new Set<string>();
    const includedAdditionalApprovalWriteRisks = new Set<string>();
    const includedAdditionalApprovalWritePaths = new Set<string>();
    const includedAdditionalApprovalToolCategories = new Set<string>();

    if (Array.isArray(value.approval.signals)) {
      for (let index = 0; index < value.approval.signals.length; index += 1) {
        const signal = value.approval.signals[index];
        const signalPath = `approval.signals[${index}]`;

        assertCompactApprovalSignal(signal, signalPath);

        if (signal.kind === 'write-approval-required') {
          includedApprovalWriteRisks.add(signal.risk as string);
          includedApprovalWritePaths.add(signal.path as string);
          if (index > 0) {
            includedAdditionalApprovalWriteRisks.add(signal.risk as string);
            includedAdditionalApprovalWritePaths.add(signal.path as string);
          }
        }

        if (signal.kind === 'tool-category-approval-required') {
          includedApprovalToolCategories.add(signal.toolCategory as string);
          if (index > 0) {
            includedAdditionalApprovalToolCategories.add(signal.toolCategory as string);
          }
        }
      }
    }

    if (isRecord(value.approval.resume)) {
      if (typeof value.approval.resume.continuationRequired !== 'boolean') {
        throw new Error('compact result input approval.resume.continuationRequired must be a boolean when present.');
      }

      if (!isStringOrNull(value.approval.resume.command)) {
        throw new Error('compact result input approval.resume.command must be string or null when present.');
      }

      if (!isStringOrNull(value.approval.resume.compactCommand)) {
        throw new Error('compact result input approval.resume.compactCommand must be string or null when present.');
      }

      if (!isStringOrNull(value.approval.resume.debugCommand)) {
        throw new Error('compact result input approval.resume.debugCommand must be string or null when present.');
      }

      if (value.approval.resume.primarySignal !== null) {
        assertCompactApprovalSignal(value.approval.resume.primarySignal, 'approval.resume.primarySignal');
      }

      if (!Array.isArray(value.approval.resume.additionalCommands)) {
        throw new Error('compact result input approval.resume.additionalCommands must be an array.');
      }

      for (let index = 0; index < value.approval.resume.additionalCommands.length; index += 1) {
        const additionalCommand = value.approval.resume.additionalCommands[index];
        const commandPath = `approval.resume.additionalCommands[${index}]`;

        if (!isRecord(additionalCommand)) {
          throw new Error(`compact result input ${commandPath} must be an object.`);
        }

        assertCompactApprovalSignal(additionalCommand.signal, `${commandPath}.signal`);

        if (typeof additionalCommand.command !== 'string' || additionalCommand.command.length === 0) {
          throw new Error(`compact result input ${commandPath}.command must be a non-empty string.`);
        }

        if (additionalCommand.compactCommand !== `${additionalCommand.command} --json`) {
          throw new Error(`compact result input ${commandPath}.compactCommand must match command plus --json.`);
        }

        if (additionalCommand.debugCommand !== `${additionalCommand.command} --json-full`) {
          throw new Error(`compact result input ${commandPath}.debugCommand must match command plus --json-full.`);
        }

        if (
          additionalCommand.signal.kind === 'write-approval-required'
          && (
            !additionalCommand.command.includes(`--approve-write-risk ${additionalCommand.signal.risk}`)
            || !additionalCommand.command.includes('--approve-write-path')
            || !additionalCommand.command.includes(additionalCommand.signal.path as string)
          )
        ) {
          throw new Error(`compact result input ${commandPath}.command must include the additional write approval scope.`);
        }

        if (
          additionalCommand.signal.kind === 'tool-category-approval-required'
          && !additionalCommand.command.includes(`--approve-tool-category ${additionalCommand.signal.toolCategory}`)
        ) {
          throw new Error(`compact result input ${commandPath}.command must include the additional tool category approval scope.`);
        }
      }

      assertIntegerField(value.approval.resume, 'additionalSignalCount', 'approval.resume', isNonNegativeInteger, 'a non-negative integer');

      if (!isArrayOf(value.approval.resume.additionalWriteRisks, isKnownFileWriteRisk)) {
        throw new Error('compact result input approval.resume.additionalWriteRisks must use supported write risks when present.');
      }

      if (!isStringArray(value.approval.resume.additionalWritePaths)) {
        throw new Error('compact result input approval.resume.additionalWritePaths must be a string array when present.');
      }

      if (!isArrayOf(value.approval.resume.additionalToolCategories, isKnownToolPermissionCategory)) {
        throw new Error('compact result input approval.resume.additionalToolCategories must use supported tool categories when present.');
      }

      if (!isRecord(value.approval.resume.pendingScope)) {
        throw new Error('compact result input approval.resume.pendingScope must be an object.');
      }

      for (const field of [
        'signalCount',
        'includedSignalCount',
        'omittedSignalCount',
        'additionalSignalCount',
        'writeRiskCount',
        'writePathCount',
        'toolCategoryCount'
      ]) {
        assertIntegerField(value.approval.resume.pendingScope, field, 'approval.resume.pendingScope', isNonNegativeInteger, 'a non-negative integer');
      }

      if (!isArrayOf(value.approval.resume.writeRisks, isKnownFileWriteRisk)) {
        throw new Error('compact result input approval.resume.writeRisks must use supported write risks when present.');
      }

      if (!isStringArray(value.approval.resume.writePaths)) {
        throw new Error('compact result input approval.resume.writePaths must be a string array when present.');
      }

      if (!isArrayOf(value.approval.resume.toolCategories, isKnownToolPermissionCategory)) {
        throw new Error('compact result input approval.resume.toolCategories must use supported tool categories when present.');
      }

      assertIntegerField(value.approval.resume, 'signalCount', 'approval.resume', isNonNegativeInteger, 'a non-negative integer');

      if (
        isRecord(value.harness)
        && isRecord(value.harness.stateSummary)
        && value.harness.stateSummary.approvalSignalCount !== value.approval.resume.signalCount
      ) {
        throw new Error('compact result input harness.stateSummary.approvalSignalCount must match approval.resume.signalCount.');
      }

      if (value.approval.resume.continuationRequired && typeof value.approval.resume.command !== 'string') {
        throw new Error('compact result input approval.resume.command is required when continuationRequired is true.');
      }

      if (!value.approval.resume.continuationRequired && value.approval.resume.command !== null) {
        throw new Error('compact result input approval.resume.command must be null when continuationRequired is false.');
      }

      if (value.approval.resume.continuationRequired && typeof value.approval.resume.compactCommand !== 'string') {
        throw new Error('compact result input approval.resume.compactCommand is required when continuationRequired is true.');
      }

      if (!value.approval.resume.continuationRequired && value.approval.resume.compactCommand !== null) {
        throw new Error('compact result input approval.resume.compactCommand must be null when continuationRequired is false.');
      }

      if (value.approval.resume.continuationRequired && typeof value.approval.resume.debugCommand !== 'string') {
        throw new Error('compact result input approval.resume.debugCommand is required when continuationRequired is true.');
      }

      if (!value.approval.resume.continuationRequired && value.approval.resume.debugCommand !== null) {
        throw new Error('compact result input approval.resume.debugCommand must be null when continuationRequired is false.');
      }

      if (value.approval.resume.continuationRequired !== (value.outcome === 'approval-required')) {
        throw new Error('compact result input approval.resume.continuationRequired must match root.outcome.');
      }

      if (
        value.approval.resume.continuationRequired
        && typeof value.approval.resume.command === 'string'
        && (
          value.approval.resume.compactCommand !== `${value.approval.resume.command} --json`
          || value.approval.resume.debugCommand !== `${value.approval.resume.command} --json-full`
        )
      ) {
        throw new Error('compact result input approval.resume JSON commands must match the approval continuation command and output mode.');
      }

      if (value.approval.resume.continuationRequired) {
        assertCommandIncludesQueryConfigFlags(value.approval.resume.command, value.harness, 'approval.resume.command');
        assertCommandIncludesPlannerConfigFlags(value.approval.resume.command, value.harness, 'approval.resume.command');
        for (let index = 0; index < value.approval.resume.additionalCommands.length; index += 1) {
          const additionalCommand = value.approval.resume.additionalCommands[index];
          if (isRecord(additionalCommand)) {
            assertCommandIncludesQueryConfigFlags(
              additionalCommand.command,
              value.harness,
              `approval.resume.additionalCommands[${index}].command`
            );
            assertCommandIncludesPlannerConfigFlags(
              additionalCommand.command,
              value.harness,
              `approval.resume.additionalCommands[${index}].command`
            );
          }
        }
      }

      if (
        value.approval.resume.continuationRequired
        && (
          !isRecord(value.harness)
          || !isRecord(value.harness.plannerHandoff)
          || !isRecord(value.harness.plannerHandoff.activeBlocker)
          || value.harness.plannerHandoff.activeBlocker.kind !== 'approval'
          || value.harness.plannerHandoff.nextControlAction !== 'request-approval'
        )
      ) {
        throw new Error('compact result input approval.resume continuation must match approval planner handoff.');
      }

      if (
        Array.isArray(value.approval.signals)
        && (value.approval.resume.signalCount as number) < value.approval.signals.length
      ) {
        throw new Error('compact result input approval.resume.signalCount must cover included approval signals.');
      }

      for (const risk of includedApprovalWriteRisks) {
        if (!value.approval.resume.writeRisks.includes(risk)) {
          throw new Error('compact result input approval.resume.writeRisks must cover included approval signals.');
        }
      }

      for (const path of includedApprovalWritePaths) {
        if (!value.approval.resume.writePaths.includes(path)) {
          throw new Error('compact result input approval.resume.writePaths must cover included approval signals.');
        }
      }

      for (const category of includedApprovalToolCategories) {
        if (!value.approval.resume.toolCategories.includes(category)) {
          throw new Error('compact result input approval.resume.toolCategories must cover included approval signals.');
        }
      }

      for (const risk of includedAdditionalApprovalWriteRisks) {
        if (!value.approval.resume.additionalWriteRisks.includes(risk)) {
          throw new Error('compact result input approval.resume.additionalWriteRisks must cover included additional approval signals.');
        }
      }

      for (const path of includedAdditionalApprovalWritePaths) {
        if (!value.approval.resume.additionalWritePaths.includes(path)) {
          throw new Error('compact result input approval.resume.additionalWritePaths must cover included additional approval signals.');
        }
      }

      for (const category of includedAdditionalApprovalToolCategories) {
        if (!value.approval.resume.additionalToolCategories.includes(category)) {
          throw new Error('compact result input approval.resume.additionalToolCategories must cover included additional approval signals.');
        }
      }

      for (const signal of value.approval.signals) {
        if (isRecord(signal) && approvalGrantsCoverSignal(signal, value.approval.grants)) {
          throw new Error('compact result input approval.signals must not repeat approval.grants-covered scope.');
        }
      }

      if (
        Array.isArray(value.approval.signals)
        && value.approval.resume.signalCount === value.approval.signals.length
      ) {
        for (const risk of value.approval.resume.writeRisks) {
          if (!includedApprovalWriteRisks.has(risk)) {
            throw new Error('compact result input approval.resume.writeRisks must match included approval signals when none are omitted.');
          }
        }

        for (const path of value.approval.resume.writePaths) {
          if (!includedApprovalWritePaths.has(path)) {
            throw new Error('compact result input approval.resume.writePaths must match included approval signals when none are omitted.');
          }
        }

        for (const category of value.approval.resume.toolCategories) {
          if (!includedApprovalToolCategories.has(category)) {
            throw new Error('compact result input approval.resume.toolCategories must match included approval signals when none are omitted.');
          }
        }

        for (const risk of value.approval.resume.additionalWriteRisks) {
          if (!includedAdditionalApprovalWriteRisks.has(risk)) {
            throw new Error('compact result input approval.resume.additionalWriteRisks must match included additional approval signals when none are omitted.');
          }
        }

        for (const path of value.approval.resume.additionalWritePaths) {
          if (!includedAdditionalApprovalWritePaths.has(path)) {
            throw new Error('compact result input approval.resume.additionalWritePaths must match included additional approval signals when none are omitted.');
          }
        }

        for (const category of value.approval.resume.additionalToolCategories) {
          if (!includedAdditionalApprovalToolCategories.has(category)) {
            throw new Error('compact result input approval.resume.additionalToolCategories must match included additional approval signals when none are omitted.');
          }
        }
      }

      const firstApprovalSignal = Array.isArray(value.approval.signals)
        ? value.approval.signals.find(isRecord) ?? null
        : null;
      const primaryApprovalSignal = isRecord(value.approval.resume.primarySignal)
        ? value.approval.resume.primarySignal
        : null;

      if ((value.approval.resume.signalCount as number) === 0 && value.approval.resume.primarySignal !== null) {
        throw new Error('compact result input approval.resume.primarySignal must be null when no approval signals are present.');
      }

      if (
        value.approval.resume.continuationRequired
        && (value.approval.resume.signalCount as number) > 0
        && !primaryApprovalSignal
      ) {
        throw new Error('compact result input approval.resume.primarySignal is required when approval continuation has signals.');
      }

      if (
        isRecord(firstApprovalSignal)
        && (
          !primaryApprovalSignal
          || !compactApprovalSignalsMatch(primaryApprovalSignal, firstApprovalSignal)
        )
      ) {
        throw new Error('compact result input approval.resume.primarySignal must match the first included approval signal.');
      }

      const expectedAdditionalSignalCount = Math.max(0, (value.approval.resume.signalCount as number) - (primaryApprovalSignal ? 1 : 0));
      if (value.approval.resume.additionalSignalCount !== expectedAdditionalSignalCount) {
        throw new Error('compact result input approval.resume.additionalSignalCount must match signalCount minus the primary signal.');
      }

      if (value.approval.resume.pendingScope.signalCount !== value.approval.resume.signalCount) {
        throw new Error('compact result input approval.resume.pendingScope.signalCount must match approval.resume.signalCount.');
      }

      if (value.approval.resume.pendingScope.includedSignalCount !== value.approval.signals.length) {
        throw new Error('compact result input approval.resume.pendingScope.includedSignalCount must match included approval signals.');
      }

      if (
        value.approval.resume.pendingScope.omittedSignalCount
        !== Math.max(0, (value.approval.resume.signalCount as number) - value.approval.signals.length)
      ) {
        throw new Error('compact result input approval.resume.pendingScope.omittedSignalCount must match omitted approval signals.');
      }

      if (value.approval.resume.pendingScope.additionalSignalCount !== value.approval.resume.additionalSignalCount) {
        throw new Error('compact result input approval.resume.pendingScope.additionalSignalCount must match approval.resume.additionalSignalCount.');
      }

      if (value.approval.resume.pendingScope.writeRiskCount !== new Set(value.approval.resume.writeRisks).size) {
        throw new Error('compact result input approval.resume.pendingScope.writeRiskCount must match approval.resume.writeRisks.');
      }

      if (value.approval.resume.pendingScope.writePathCount !== new Set(value.approval.resume.writePaths).size) {
        throw new Error('compact result input approval.resume.pendingScope.writePathCount must match approval.resume.writePaths.');
      }

      if (value.approval.resume.pendingScope.toolCategoryCount !== new Set(value.approval.resume.toolCategories).size) {
        throw new Error('compact result input approval.resume.pendingScope.toolCategoryCount must match approval.resume.toolCategories.');
      }

      if (
        value.approval.resume.continuationRequired
        && value.approval.resume.additionalCommands.length !== Math.max(0, value.approval.signals.length - 1)
      ) {
        throw new Error('compact result input approval.resume.additionalCommands must match included non-primary approval signals.');
      }

      if (
        value.approval.resume.continuationRequired
        && isRecord(firstApprovalSignal)
        && firstApprovalSignal.kind === 'write-approval-required'
        && typeof value.approval.resume.command === 'string'
        && (
          !value.approval.resume.command.includes(`--approve-write-risk ${firstApprovalSignal.risk}`)
          || !value.approval.resume.command.includes('--approve-write-path')
          || !value.approval.resume.command.includes(firstApprovalSignal.path as string)
        )
      ) {
        throw new Error('compact result input approval.resume.command must include the active write approval scope.');
      }

      if (
        value.approval.resume.continuationRequired
        && isRecord(firstApprovalSignal)
        && firstApprovalSignal.kind === 'tool-category-approval-required'
        && typeof value.approval.resume.command === 'string'
        && !value.approval.resume.command.includes(`--approve-tool-category ${firstApprovalSignal.toolCategory}`)
      ) {
        throw new Error('compact result input approval.resume.command must include the active tool category approval scope.');
      }

      if (value.handoffCheckpoint.summary.approvalContinuationRequired !== value.approval.resume.continuationRequired) {
        throw new Error('compact result input handoffCheckpoint.summary.approvalContinuationRequired must match approval.resume.continuationRequired.');
      }

      if (value.handoffCheckpoint.continuation.command !== value.approval.resume.command) {
        throw new Error('compact result input handoffCheckpoint.continuation.command must match approval.resume.command.');
      }

      if (value.handoffCheckpoint.continuation.compactCommand !== value.approval.resume.compactCommand) {
        throw new Error('compact result input handoffCheckpoint.continuation.compactCommand must match approval.resume.compactCommand.');
      }

      if (value.handoffCheckpoint.continuation.debugCommand !== value.approval.resume.debugCommand) {
        throw new Error('compact result input handoffCheckpoint.continuation.debugCommand must match approval.resume.debugCommand.');
      }

      if (
        value.approval.resume.continuationRequired
        && typeof value.approval.resume.command === 'string'
        && Array.isArray(value.suggestedCommands)
        && !value.suggestedCommands.includes(value.approval.resume.command)
      ) {
        throw new Error('compact result input suggestedCommands must include approval.resume.command when approval continuation is required.');
      }

      if (Array.isArray(value.approval.signals)) {
        assertHandoffBudgetMatches(
          value.handoffCheckpoint.budgets.approvalSignals,
          'handoffCheckpoint.budgets.approvalSignals',
          value.approval.signals.length,
          Math.max(0, (value.approval.resume.signalCount as number) - value.approval.signals.length),
          'approval.resume'
        );
      }
    }
  }

  if (!isRecord(value.knowledgeContext)) {
    throw new Error('compact result input must include knowledgeContext object.');
  }

  for (const field of ['maxPackets', 'maxTokens', 'maxExcerptChars']) {
    assertIntegerField(
      value.knowledgeContext,
      field,
      'knowledgeContext',
      isPositiveInteger,
      'a positive integer'
    );
  }

  for (const field of [
    'totalPacketCount',
    'includedPacketCount',
    'omittedPacketCount',
    'includedTokenEstimate',
    'omittedTokenEstimate',
    'omittedByPacketLimit',
    'omittedByTokenBudget'
  ]) {
    assertIntegerField(
      value.knowledgeContext,
      field,
      'knowledgeContext',
      isNonNegativeInteger,
      'a non-negative integer'
    );
  }

  const knowledgeTotalPacketCount = value.knowledgeContext.totalPacketCount as number;
  const knowledgeIncludedPacketCount = value.knowledgeContext.includedPacketCount as number;
  const knowledgeOmittedPacketCount = value.knowledgeContext.omittedPacketCount as number;
  const knowledgeOmittedByPacketLimit = value.knowledgeContext.omittedByPacketLimit as number;
  const knowledgeOmittedByTokenBudget = value.knowledgeContext.omittedByTokenBudget as number;

  if (knowledgeIncludedPacketCount + knowledgeOmittedPacketCount !== knowledgeTotalPacketCount) {
    throw new Error('compact result input knowledgeContext packet counts must be consistent.');
  }

  if (knowledgeOmittedByPacketLimit + knowledgeOmittedByTokenBudget !== knowledgeOmittedPacketCount) {
    throw new Error('compact result input knowledgeContext omitted counts must be consistent.');
  }

  if (knowledgeIncludedPacketCount > (value.knowledgeContext.maxPackets as number)) {
    throw new Error('compact result input knowledgeContext.includedPacketCount must not exceed maxPackets.');
  }

  if (!Array.isArray(value.knowledgeContext.packets)) {
    throw new Error('compact result input knowledgeContext.packets must be an array.');
  }

  if (value.knowledgeContext.packets.length !== knowledgeTotalPacketCount) {
    throw new Error('compact result input knowledgeContext.packets length must match totalPacketCount.');
  }

  let derivedIncludedPacketCount = 0;
  let derivedOmittedPacketCount = 0;
  let derivedIncludedTokenEstimate = 0;
  let derivedOmittedTokenEstimate = 0;
  let derivedOmittedByPacketLimit = 0;
  let derivedOmittedByTokenBudget = 0;

  for (let index = 0; index < value.knowledgeContext.packets.length; index += 1) {
    const packet = value.knowledgeContext.packets[index];
    const packetPath = `knowledgeContext.packets[${index}]`;

    if (!isRecord(packet)) {
      throw new Error(`compact result input ${packetPath} must be an object.`);
    }

    if ('excerpt' in packet || 'facts' in packet || 'source' in packet) {
      throw new Error(`compact result input ${packetPath} must not include raw context fields.`);
    }

    for (const field of ['id', 'sourceKind', 'reason']) {
      if (typeof packet[field] !== 'string' || packet[field].length === 0) {
        throw new Error(`compact result input ${packetPath}.${field} must be a non-empty string.`);
      }
    }

    for (const field of ['sourceName', 'sourceVersion']) {
      if (!isStringOrNull(packet[field])) {
        throw new Error(`compact result input ${packetPath}.${field} must be string or null.`);
      }
    }

    if (!isKnownAgentConfidence(packet.confidence)) {
      throw new Error(`compact result input ${packetPath}.confidence must be supported.`);
    }

    assertIntegerField(packet, 'tokenEstimate', packetPath, isNonNegativeInteger, 'a non-negative integer');
    assertIntegerField(packet, 'excerptChars', packetPath, isNonNegativeInteger, 'a non-negative integer');

    if ((packet.excerptChars as number) > (value.knowledgeContext.maxExcerptChars as number)) {
      throw new Error(`compact result input ${packetPath}.excerptChars must not exceed knowledgeContext.maxExcerptChars.`);
    }

    if (typeof packet.included !== 'boolean') {
      throw new Error(`compact result input ${packetPath}.included must be a boolean.`);
    }

    if (packet.omittedReason !== null && !isKnownRetrievedContextOmittedReason(packet.omittedReason)) {
      throw new Error(`compact result input ${packetPath}.omittedReason must be null or supported.`);
    }

    if (packet.included && packet.omittedReason !== null) {
      throw new Error(`compact result input ${packetPath}.omittedReason must be null when included is true.`);
    }

    if (!packet.included && packet.omittedReason === null) {
      throw new Error(`compact result input ${packetPath}.omittedReason is required when included is false.`);
    }

    if (packet.included) {
      derivedIncludedPacketCount += 1;
      derivedIncludedTokenEstimate += packet.tokenEstimate as number;
    } else {
      derivedOmittedPacketCount += 1;
      derivedOmittedTokenEstimate += packet.tokenEstimate as number;
      if (packet.omittedReason === 'packet-limit') {
        derivedOmittedByPacketLimit += 1;
      }
      if (packet.omittedReason === 'token-budget') {
        derivedOmittedByTokenBudget += 1;
      }
    }
  }

  if (derivedIncludedPacketCount !== knowledgeIncludedPacketCount) {
    throw new Error('compact result input knowledgeContext.includedPacketCount must match packets.');
  }

  if (derivedOmittedPacketCount !== knowledgeOmittedPacketCount) {
    throw new Error('compact result input knowledgeContext.omittedPacketCount must match packets.');
  }

  if (derivedIncludedTokenEstimate !== value.knowledgeContext.includedTokenEstimate) {
    throw new Error('compact result input knowledgeContext.includedTokenEstimate must match included packets.');
  }

  if (derivedOmittedTokenEstimate !== value.knowledgeContext.omittedTokenEstimate) {
    throw new Error('compact result input knowledgeContext.omittedTokenEstimate must match omitted packets.');
  }

  if (derivedOmittedByPacketLimit !== knowledgeOmittedByPacketLimit) {
    throw new Error('compact result input knowledgeContext.omittedByPacketLimit must match packets.');
  }

  if (derivedOmittedByTokenBudget !== knowledgeOmittedByTokenBudget) {
    throw new Error('compact result input knowledgeContext.omittedByTokenBudget must match packets.');
  }

  assertHandoffBudgetMatches(
    value.handoffCheckpoint.budgets.knowledgePackets,
    'handoffCheckpoint.budgets.knowledgePackets',
    knowledgeIncludedPacketCount,
    knowledgeOmittedPacketCount,
    'knowledgeContext'
  );

  const knowledgePacketBudget = value.handoffCheckpoint.budgets.knowledgePackets as Record<string, unknown>;
  if (
    knowledgePacketBudget.includedTokenEstimate !== value.knowledgeContext.includedTokenEstimate
    || knowledgePacketBudget.omittedTokenEstimate !== value.knowledgeContext.omittedTokenEstimate
  ) {
    throw new Error('compact result input handoffCheckpoint.budgets.knowledgePackets token estimates must match knowledgeContext.');
  }

  if (
    isRecord(value.harness)
    && isRecord(value.harness.stateSummary)
    && value.harness.stateSummary.retrievedContextCount !== knowledgeTotalPacketCount
  ) {
    throw new Error('compact result input harness.stateSummary.retrievedContextCount must match knowledgeContext.totalPacketCount.');
  }

  if (!isRecord(value.knowledgeFacts)) {
    throw new Error('compact result input must include knowledgeFacts object.');
  }

  const rawKnowledgeFactField = findRawKnowledgeFactField(value.knowledgeFacts, 'knowledgeFacts');
  if (rawKnowledgeFactField !== null) {
    throw new Error(`compact result input ${rawKnowledgeFactField} must not include raw source fields.`);
  }

  if (value.knowledgeFacts.kind !== 'infra-agent.knowledge-facts-summary') {
    throw new Error('compact result input knowledgeFacts.kind must be infra-agent.knowledge-facts-summary.');
  }

  if (value.knowledgeFacts.schemaVersion !== 1) {
    throw new Error('compact result input knowledgeFacts.schemaVersion must be 1.');
  }

  if (value.knowledgeFacts.mutationAllowed !== false) {
    throw new Error('compact result input knowledgeFacts.mutationAllowed must be false.');
  }

  if (
    value.knowledgeFacts.packId !== null
    && (typeof value.knowledgeFacts.packId !== 'string' || !KNOWLEDGE_PACK_ID_PATTERN.test(value.knowledgeFacts.packId))
  ) {
    throw new Error('compact result input knowledgeFacts.packId must be null or a 24-character lowercase hex id.');
  }

  for (const field of ['maxFacts']) {
    assertIntegerField(
      value.knowledgeFacts,
      field,
      'knowledgeFacts',
      isPositiveInteger,
      'a positive integer'
    );
  }

  for (const field of [
    'sourceCount',
    'factSetCount',
    'totalFactCount',
    'includedFactCount',
    'omittedFactCount',
    'totalUnitCount',
    'includedUnitCount',
    'omittedUnitCount',
    'staleSourceCount',
    'uncheckedSourceCount'
  ]) {
    assertIntegerField(
      value.knowledgeFacts,
      field,
      'knowledgeFacts',
      isNonNegativeInteger,
      'a non-negative integer'
    );
  }

  const knowledgeFactMaxFacts = value.knowledgeFacts.maxFacts as number;
  const knowledgeFactSourceCount = value.knowledgeFacts.sourceCount as number;
  const knowledgeFactTotalCount = value.knowledgeFacts.totalFactCount as number;
  const knowledgeFactIncludedCount = value.knowledgeFacts.includedFactCount as number;
  const knowledgeFactOmittedCount = value.knowledgeFacts.omittedFactCount as number;
  const knowledgeUnitTotalCount = value.knowledgeFacts.totalUnitCount as number;
  const knowledgeUnitIncludedCount = value.knowledgeFacts.includedUnitCount as number;
  const knowledgeUnitOmittedCount = value.knowledgeFacts.omittedUnitCount as number;
  const knowledgeFactStaleSourceCount = value.knowledgeFacts.staleSourceCount as number;
  const knowledgeFactUncheckedSourceCount = value.knowledgeFacts.uncheckedSourceCount as number;

  if ((knowledgeFactTotalCount > 0 || knowledgeUnitTotalCount > 0) && value.knowledgeFacts.packId === null) {
    throw new Error('compact result input knowledgeFacts.packId is required when knowledge facts or units are present.');
  }

  if (knowledgeFactIncludedCount + knowledgeFactOmittedCount !== knowledgeFactTotalCount) {
    throw new Error('compact result input knowledgeFacts fact counts must be consistent.');
  }

  if (knowledgeUnitIncludedCount + knowledgeUnitOmittedCount !== knowledgeUnitTotalCount) {
    throw new Error('compact result input knowledgeFacts unit counts must be consistent.');
  }

  if (knowledgeFactIncludedCount > knowledgeFactMaxFacts) {
    throw new Error('compact result input knowledgeFacts.includedFactCount must not exceed maxFacts.');
  }

  if (knowledgeUnitIncludedCount > knowledgeFactMaxFacts) {
    throw new Error('compact result input knowledgeFacts.includedUnitCount must not exceed maxFacts.');
  }

  if (
    isRecord(value.harness)
    && isRecord(value.harness.queryConfig)
    && isRecord(value.harness.queryConfig.retrievedContextBudget)
    && value.harness.queryConfig.retrievedContextBudget.maxFacts !== knowledgeFactMaxFacts
  ) {
    throw new Error('compact result input knowledgeFacts.maxFacts must match harness.queryConfig.retrievedContextBudget.maxFacts.');
  }

  if (!Array.isArray(value.knowledgeFacts.sources)) {
    throw new Error('compact result input knowledgeFacts.sources must be an array.');
  }

  if (!Array.isArray(value.knowledgeFacts.facts)) {
    throw new Error('compact result input knowledgeFacts.facts must be an array.');
  }

  if (!Array.isArray(value.knowledgeFacts.units)) {
    throw new Error('compact result input knowledgeFacts.units must be an array.');
  }

  if (value.knowledgeFacts.sources.length !== knowledgeFactSourceCount) {
    throw new Error('compact result input knowledgeFacts.sources length must match sourceCount.');
  }

  if (value.knowledgeFacts.facts.length !== knowledgeFactIncludedCount) {
    throw new Error('compact result input knowledgeFacts.facts length must match includedFactCount.');
  }

  if (value.knowledgeFacts.units.length !== knowledgeUnitIncludedCount) {
    throw new Error('compact result input knowledgeFacts.units length must match includedUnitCount.');
  }

  const knowledgeFactSourceIds = new Set<string>();
  const staleKnowledgeFactSourceIds = new Set<string>();
  const uncheckedKnowledgeFactSourceIds = new Set<string>();
  let derivedKnowledgeFactStaleSourceCount = 0;
  let derivedKnowledgeFactUncheckedSourceCount = 0;
  let derivedKnowledgeFactTotalCount = 0;

  for (let index = 0; index < value.knowledgeFacts.sources.length; index += 1) {
    const source = value.knowledgeFacts.sources[index];
    const sourcePath = `knowledgeFacts.sources[${index}]`;

    if (!isRecord(source)) {
      throw new Error(`compact result input ${sourcePath} must be an object.`);
    }

    for (const field of ['id', 'targetPath', 'name']) {
      if (typeof source[field] !== 'string') {
        throw new Error(`compact result input ${sourcePath}.${field} must be a string.`);
      }
    }

    if ((source.id as string).length === 0 || (source.name as string).length === 0) {
      throw new Error(`compact result input ${sourcePath}.id and name must be non-empty strings.`);
    }

    if (knowledgeFactSourceIds.has(source.id as string)) {
      throw new Error(`compact result input ${sourcePath}.id must be unique.`);
    }
    knowledgeFactSourceIds.add(source.id as string);

    if (!isKnownKnowledgeFactDomain(source.domain)) {
      throw new Error(`compact result input ${sourcePath}.domain must be supported.`);
    }

    if (!isKnownKnowledgeFactSourceKind(source.kind)) {
      throw new Error(`compact result input ${sourcePath}.kind must be supported.`);
    }

    assertIntegerField(source, 'factCount', sourcePath, isNonNegativeInteger, 'a non-negative integer');
    derivedKnowledgeFactTotalCount += source.factCount as number;

    if (typeof source.stale !== 'boolean') {
      throw new Error(`compact result input ${sourcePath}.stale must be a boolean.`);
    }

    if (!isKnownKnowledgeSourceFreshness(source.freshness)) {
      throw new Error(`compact result input ${sourcePath}.freshness must be supported.`);
    }

    if (source.stale === true && source.freshness !== 'stale') {
      throw new Error(`compact result input ${sourcePath}.freshness must be stale when stale is true.`);
    }

    if (source.stale === false && source.freshness === 'stale') {
      throw new Error(`compact result input ${sourcePath}.freshness must not be stale when stale is false.`);
    }

    if ('staleReason' in source) {
      if (!isKnownKnowledgeSourceStaleReason(source.staleReason)) {
        throw new Error(`compact result input ${sourcePath}.staleReason must be supported.`);
      }

      if (source.stale !== true) {
        throw new Error(`compact result input ${sourcePath}.staleReason requires stale to be true.`);
      }
    }

    if ('fingerprintDigest' in source) {
      if (typeof source.fingerprintDigest !== 'string' || !SHA256_HEX_PATTERN.test(source.fingerprintDigest)) {
        throw new Error(`compact result input ${sourcePath}.fingerprintDigest must be a SHA-256 hex string.`);
      }

      assertIntegerField(source, 'fingerprintFileCount', sourcePath, isNonNegativeInteger, 'a non-negative integer');
    }

    if ('fingerprintFileCount' in source && !('fingerprintDigest' in source)) {
      throw new Error(`compact result input ${sourcePath}.fingerprintFileCount requires fingerprintDigest.`);
    }

    if (source.stale) {
      derivedKnowledgeFactStaleSourceCount += 1;
      staleKnowledgeFactSourceIds.add(source.id as string);
    }
    if (source.freshness === 'unchecked') {
      derivedKnowledgeFactUncheckedSourceCount += 1;
      uncheckedKnowledgeFactSourceIds.add(source.id as string);
    }
  }

  if (derivedKnowledgeFactTotalCount !== knowledgeFactTotalCount) {
    throw new Error('compact result input knowledgeFacts source fact counts must match totalFactCount.');
  }

  if (derivedKnowledgeFactStaleSourceCount !== knowledgeFactStaleSourceCount) {
    throw new Error('compact result input knowledgeFacts.staleSourceCount must match sources.');
  }

  if (derivedKnowledgeFactUncheckedSourceCount !== knowledgeFactUncheckedSourceCount) {
    throw new Error('compact result input knowledgeFacts.uncheckedSourceCount must match sources.');
  }

  for (let index = 0; index < value.knowledgeFacts.facts.length; index += 1) {
    const fact = value.knowledgeFacts.facts[index];
    const factPath = `knowledgeFacts.facts[${index}]`;

    if (!isRecord(fact)) {
      throw new Error(`compact result input ${factPath} must be an object.`);
    }

    if ('unitType' in fact && fact.unitType !== 'fact') {
      throw new Error(`compact result input ${factPath}.unitType must be fact when present.`);
    }

    if (!isKnownKnowledgeFactKind(fact.kind)) {
      throw new Error(`compact result input ${factPath}.kind must be supported.`);
    }

    for (const field of ['path', 'summary', 'sourceId', 'sourceLocator']) {
      if (typeof fact[field] !== 'string' || (fact[field] as string).length === 0) {
        throw new Error(`compact result input ${factPath}.${field} must be a non-empty string.`);
      }
    }

    if (!isKnownAgentConfidence(fact.confidence)) {
      throw new Error(`compact result input ${factPath}.confidence must be supported.`);
    }

    if (!isKnownKnowledgeFactExtractionMethod(fact.extractionMethod)) {
      throw new Error(`compact result input ${factPath}.extractionMethod must be supported.`);
    }

    if (fact.extractionMethod === 'helm-chart-docs-markdown' && fact.confidence !== 'medium') {
      throw new Error(`compact result input ${factPath}.confidence must be medium for helm-chart-docs-markdown facts.`);
    }

    if (!knowledgeFactSourceIds.has(fact.sourceId as string)) {
      throw new Error(`compact result input ${factPath}.sourceId must reference knowledgeFacts.sources.`);
    }

    if (staleKnowledgeFactSourceIds.has(fact.sourceId as string) && fact.confidence === 'high') {
      throw new Error(`compact result input ${factPath}.confidence must not be high when source is stale.`);
    }

    if (uncheckedKnowledgeFactSourceIds.has(fact.sourceId as string) && fact.confidence === 'high') {
      throw new Error(`compact result input ${factPath}.confidence must not be high when source is unchecked.`);
    }

    assertKnowledgeFactOptionalFields(fact, factPath);
  }

  for (let index = 0; index < value.knowledgeFacts.units.length; index += 1) {
    const unit = value.knowledgeFacts.units[index];
    const unitPath = `knowledgeFacts.units[${index}]`;

    if (!isRecord(unit)) {
      throw new Error(`compact result input ${unitPath} must be an object.`);
    }

    if (!isKnownKnowledgeUnitType(unit.unitType)) {
      throw new Error(`compact result input ${unitPath}.unitType must be supported.`);
    }

    for (const field of ['path', 'summary', 'sourceId', 'sourceLocator']) {
      if (typeof unit[field] !== 'string' || (unit[field] as string).length === 0) {
        throw new Error(`compact result input ${unitPath}.${field} must be a non-empty string.`);
      }
    }

    if (!isKnownAgentConfidence(unit.confidence)) {
      throw new Error(`compact result input ${unitPath}.confidence must be supported.`);
    }

    if (!isKnownKnowledgeUnitExtractionMethod(unit.extractionMethod)) {
      throw new Error(`compact result input ${unitPath}.extractionMethod must be supported.`);
    }

    if (!isKnownKnowledgeUnitPrivacyScope(unit.privacyScope)) {
      throw new Error(`compact result input ${unitPath}.privacyScope must be supported.`);
    }

    if ('tokenEstimate' in unit) {
      assertIntegerField(unit, 'tokenEstimate', unitPath, isNonNegativeInteger, 'a non-negative integer');
    }

    assertOptionalStringArrayField(unit, 'relatedPaths', unitPath);

    if (!knowledgeFactSourceIds.has(unit.sourceId as string)) {
      throw new Error(`compact result input ${unitPath}.sourceId must reference knowledgeFacts.sources.`);
    }

    if (staleKnowledgeFactSourceIds.has(unit.sourceId as string) && unit.confidence === 'high') {
      throw new Error(`compact result input ${unitPath}.confidence must not be high when source is stale.`);
    }

    if (uncheckedKnowledgeFactSourceIds.has(unit.sourceId as string) && unit.confidence === 'high') {
      throw new Error(`compact result input ${unitPath}.confidence must not be high when source is unchecked.`);
    }

    assertKnowledgeUnitPayload(unit, unitPath);
  }

  assertHandoffBudgetMatches(
    value.handoffCheckpoint.budgets.knowledgeFacts,
    'handoffCheckpoint.budgets.knowledgeFacts',
    knowledgeFactIncludedCount,
    knowledgeFactOmittedCount,
    'knowledgeFacts'
  );

  assertHandoffBudgetMatches(
    value.handoffCheckpoint.budgets.knowledgeUnits,
    'handoffCheckpoint.budgets.knowledgeUnits',
    knowledgeUnitIncludedCount,
    knowledgeUnitOmittedCount,
    'knowledgeFacts units'
  );

  if (
    isRecord(value.harness)
    && isRecord(value.harness.stateSummary)
    && value.harness.stateSummary.knowledgeFactCount !== knowledgeFactTotalCount
  ) {
    throw new Error('compact result input harness.stateSummary.knowledgeFactCount must match knowledgeFacts.totalFactCount.');
  }

  if (
    isRecord(value.harness)
    && isRecord(value.harness.stateSummary)
    && value.harness.stateSummary.knowledgeUnitCount !== knowledgeUnitTotalCount
  ) {
    throw new Error('compact result input harness.stateSummary.knowledgeUnitCount must match knowledgeFacts.totalUnitCount.');
  }

  if (!isRecord(value.knowledgeCache)) {
    throw new Error('compact result input must include knowledgeCache object.');
  }

  if (typeof value.knowledgeCache.root !== 'string' || value.knowledgeCache.root.length === 0) {
    throw new Error('compact result input knowledgeCache.root must be a non-empty string.');
  }

  if (!isKnownKnowledgeCacheSource(value.knowledgeCache.source)) {
    throw new Error('compact result input knowledgeCache.source must be supported.');
  }

  return value as unknown as CompactAgentRunResult;
}
