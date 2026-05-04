import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { cwd } from 'node:process';
import {
  buildIdentityConflictIncidentReport,
  type IdentityConflictIncidentReport
} from './output.ts';
import { parseCompactAgentRunResult } from './agent-result-contract.ts';
import { AGENT_RUN_OUTCOMES } from '../types/agent.ts';

const IDENTITY_CONFLICT_ENGINES = ['pulumi', 'terraform'] as const;
const IDENTITY_CONFLICT_RISK_CATEGORIES = [
  'create-before-delete-ordering',
  'dns-or-domain-ownership',
  'exclusive-identity-review',
  'kubernetes-object-ownership',
  'physical-name-ownership'
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0;
}

function isStringOrNull(value: unknown): boolean {
  return typeof value === 'string' || value === null;
}

function isKnownAgentResultOutcome(value: unknown): boolean {
  return typeof value === 'string' && AGENT_RUN_OUTCOMES.includes(value as typeof AGENT_RUN_OUTCOMES[number]);
}

function isKnownIdentityConflictEngine(value: unknown): boolean {
  return typeof value === 'string'
    && IDENTITY_CONFLICT_ENGINES.includes(value as typeof IDENTITY_CONFLICT_ENGINES[number]);
}

function isKnownIdentityConflictRiskCategory(value: unknown): boolean {
  return typeof value === 'string'
    && IDENTITY_CONFLICT_RISK_CATEGORIES.includes(value as typeof IDENTITY_CONFLICT_RISK_CATEGORIES[number]);
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

function assertNumericMap(
  record: Record<string, unknown>,
  fieldName: string,
  keyValidator: (value: unknown) => boolean,
  expectedTotal: number
): void {
  let total = 0;

  for (const [key, value] of Object.entries(record)) {
    if (!keyValidator(key) || !isNonNegativeInteger(value)) {
      throw new Error(`${fieldName} must use supported non-negative integer keys.`);
    }

    total += value;
  }

  if (total !== expectedTotal) {
    throw new Error(`${fieldName} counts must sum to incidentSummary.totalCount.`);
  }
}

export function parseIdentityConflictIncidentReport(value: unknown): IdentityConflictIncidentReport {
  if (!isRecord(value) || value.kind !== 'infra-agent.identity-conflict-report') {
    throw new Error('identity conflict report input must be an infra-agent.identity-conflict-report JSON payload.');
  }

  if (value.schemaVersion !== 1) {
    throw new Error('identity conflict report input must use schemaVersion 1.');
  }

  if (value.sourceKind !== 'infra-agent.agent-result' || value.sourceSchemaVersion !== 1) {
    throw new Error('identity conflict report input must reference compact infra-agent.agent-result schemaVersion 1.');
  }

  if (typeof value.sourceTask !== 'string' || typeof value.workspaceRoot !== 'string') {
    throw new Error('identity conflict report input must include sourceTask and workspaceRoot strings.');
  }

  if (!isKnownAgentResultOutcome(value.outcome)) {
    throw new Error('identity conflict report input must include a supported outcome.');
  }

  if (value.mutationAllowed !== false) {
    throw new Error('identity conflict report input mutationAllowed must be false.');
  }

  if (
    !isNonNegativeInteger(value.incidentCount)
    || !isNonNegativeInteger(value.omittedIncidentCount)
  ) {
    throw new Error('identity conflict report input incident counts must be non-negative integers.');
  }

  if (!Array.isArray(value.summary) || value.summary.some(entry => typeof entry !== 'string')) {
    throw new Error('identity conflict report input summary must be a string array.');
  }

  if (!Array.isArray(value.incidents)) {
    throw new Error('identity conflict report input incidents must be an array.');
  }

  if (value.incidents.length !== value.incidentCount) {
    throw new Error('identity conflict report input incidents length must match incidentCount.');
  }

  if (!isRecord(value.incidentSummary)) {
    throw new Error('identity conflict report input must include incidentSummary.');
  }

  for (const field of ['totalCount', 'includedCount', 'maxEntries', 'omittedCount']) {
    if (!isNonNegativeInteger(value.incidentSummary[field])) {
      throw new Error(`identity conflict report input incidentSummary.${field} must be a non-negative integer.`);
    }
  }

  if (value.incidentSummary.mutationAllowed !== false) {
    throw new Error('identity conflict report input incidentSummary.mutationAllowed must be false.');
  }

  if (value.incidentSummary.includedCount + value.incidentSummary.omittedCount !== value.incidentSummary.totalCount) {
    throw new Error('identity conflict report input incidentSummary counts must be consistent.');
  }

  if (value.incidentSummary.includedCount > value.incidentSummary.maxEntries) {
    throw new Error('identity conflict report input incidentSummary.includedCount must not exceed maxEntries.');
  }

  if (value.incidentSummary.includedCount !== value.incidentCount) {
    throw new Error('identity conflict report input incidentSummary.includedCount must match incidentCount.');
  }

  if (value.omittedIncidentCount !== value.incidentSummary.omittedCount) {
    throw new Error('identity conflict report input omittedIncidentCount must match incidentSummary.omittedCount.');
  }

  if (!isRecord(value.incidentSummary.byEngine)) {
    throw new Error('identity conflict report input incidentSummary.byEngine must be an object.');
  }

  assertNumericMap(
    value.incidentSummary.byEngine,
    'identity conflict report input incidentSummary.byEngine',
    isKnownIdentityConflictEngine,
    value.incidentSummary.totalCount
  );

  if (!isRecord(value.incidentSummary.byRiskCategory)) {
    throw new Error('identity conflict report input incidentSummary.byRiskCategory must be an object.');
  }

  assertNumericMap(
    value.incidentSummary.byRiskCategory,
    'identity conflict report input incidentSummary.byRiskCategory',
    isKnownIdentityConflictRiskCategory,
    value.incidentSummary.totalCount
  );

  for (let index = 0; index < value.incidents.length; index += 1) {
    const incident = value.incidents[index];
    if (!isRecord(incident)) {
      throw new Error(`identity conflict report incident at index ${index} must be an object.`);
    }

    if (!isKnownIdentityConflictEngine(incident.engine)) {
      throw new Error(`identity conflict report incident at index ${index} must include engine terraform or pulumi.`);
    }

    if (incident.issueKind !== expectedIdentityIssueKind(incident.engine)) {
      throw new Error(`identity conflict report incident at index ${index} must include matching engine issueKind.`);
    }

    for (const field of ['conflictCode', 'conflictFamily', 'conflictLabel', 'resourceLocator', 'resourceType', 'suggestedAction']) {
      if (!isStringOrNull(incident[field])) {
        throw new Error(`identity conflict report incident at index ${index}.${field} must be string or null.`);
      }
    }

    if (!isRecord(incident.identity) || Object.values(incident.identity).some(identity => typeof identity !== 'string')) {
      throw new Error(`identity conflict report incident at index ${index} identity must be a string-valued object.`);
    }

    if (!isKnownIdentityConflictRiskCategory(incident.riskCategory)) {
      throw new Error(`identity conflict report incident at index ${index} must include supported riskCategory.`);
    }

    if (!Array.isArray(incident.reviewSteps) || incident.reviewSteps.some(step => typeof step !== 'string')) {
      throw new Error(`identity conflict report incident at index ${index} must include string reviewSteps.`);
    }

    if (typeof incident.sourceCommand !== 'string' || incident.sourceCommand.length === 0) {
      throw new Error(`identity conflict report incident at index ${index} must include sourceCommand.`);
    }

    if (incident.mutationAllowed !== false) {
      throw new Error(`identity conflict report incident at index ${index} mutationAllowed must be false.`);
    }
  }

  return value as unknown as IdentityConflictIncidentReport;
}

export async function loadIdentityConflictIncidentReport(
  inputPath: string,
  baseDir = cwd()
): Promise<IdentityConflictIncidentReport> {
  const resolvedInputPath = isAbsolute(inputPath) ? inputPath : resolve(baseDir, inputPath);
  const inputContent = await readFile(resolvedInputPath, 'utf8');

  return parseIdentityConflictIncidentReport(
    buildIdentityConflictIncidentReport(parseCompactAgentRunResult(JSON.parse(inputContent)))
  );
}
