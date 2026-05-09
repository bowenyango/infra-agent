import type {
  KnowledgeSourceKind,
  KnowledgeSourceStaleReason
} from '../types/knowledge.ts';

export interface KnowledgeValidationIssue {
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

export interface KnowledgeValidationFreshnessSource {
  sourceId: string;
  sourceKind: KnowledgeSourceKind | null;
  sourceName: string | null;
  factCount: number;
  validationPath?: string;
  staleReason?: KnowledgeSourceStaleReason;
  uncheckedReason?: 'workspace-not-provided' | 'missing-fingerprint';
  stalePaths?: string[];
  missingPaths?: string[];
  fingerprintDigest?: string;
  fingerprintFileCount?: number;
}

export interface KnowledgeValidationFreshnessSummary {
  kind: 'infra-agent.knowledge-freshness-summary';
  schemaVersion: 1;
  mutationAllowed: false;
  staleSourceCount: number;
  uncheckedLocalSourceCount: number;
  staleFactCount: number;
  uncheckedFactCount: number;
  staleSources: KnowledgeValidationFreshnessSource[];
  uncheckedLocalSources: KnowledgeValidationFreshnessSource[];
}

export interface KnowledgeValidationReport {
  kind: 'infra-agent.knowledge-validation';
  schemaVersion: 1;
  mutationAllowed: false;
  inputPath: string;
  inputKind: string | null;
  workspaceRoot?: string;
  valid: boolean;
  factSetCount: number;
  factCount: number;
  staleSourceCount: number;
  uncheckedLocalSourceCount: number;
  freshness: KnowledgeValidationFreshnessSummary;
  issueCount: number;
  issues: KnowledgeValidationIssue[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function error(path: string, message: string): KnowledgeValidationIssue {
  return {
    severity: 'error',
    path,
    message
  };
}

export function warning(path: string, message: string): KnowledgeValidationIssue {
  return {
    severity: 'warning',
    path,
    message
  };
}

export function readNonEmptyString(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[],
  message = 'must be a non-empty string.'
): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    issues.push(error(path, message));
    return null;
  }

  return value;
}

export function readBoolean(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): boolean | null {
  if (typeof value !== 'boolean') {
    issues.push(error(path, 'must be a boolean.'));
    return null;
  }

  return value;
}

export function readNonNegativeInteger(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): number | null {
  if (!Number.isInteger(value) || (value as number) < 0) {
    issues.push(error(path, 'must be a non-negative integer.'));
    return null;
  }

  return value as number;
}

export function readPositiveInteger(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): number | null {
  if (!Number.isInteger(value) || (value as number) < 1) {
    issues.push(error(path, 'must be a positive integer.'));
    return null;
  }

  return value as number;
}

export function readStringArray(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): string[] | null {
  if (!Array.isArray(value)) {
    issues.push(error(path, 'must be an array.'));
    return null;
  }

  const strings: string[] = [];
  value.forEach((entry, index) => {
    if (typeof entry !== 'string' || entry.length === 0) {
      issues.push(error(`${path}[${index}]`, 'must be a non-empty string.'));
      return;
    }

    strings.push(entry);
  });

  return strings;
}

export function validateBlockerCodeSummary(input: {
  blockerCodes: string[] | null;
  blockers: unknown[];
  path: string;
  issues: KnowledgeValidationIssue[];
  message?: string;
}): void {
  if (input.blockerCodes === null) {
    return;
  }

  const actualCodes = [...new Set(input.blockers
    .map(blocker => isRecord(blocker) && typeof blocker.code === 'string' ? blocker.code : null)
    .filter((code): code is string => code !== null))]
    .sort();
  const expectedCodes = [...new Set(input.blockerCodes)].sort();
  if (
    actualCodes.length !== expectedCodes.length
    || actualCodes.some((code, index) => code !== expectedCodes[index])
  ) {
    input.issues.push(error(
      input.path,
      input.message ?? 'Knowledge blockerCodes must match the unique blocker codes.'
    ));
  }
}

export function buildEmptyFreshnessSummary(input: {
  staleSourceCount?: number;
  uncheckedLocalSourceCount?: number;
} = {}): KnowledgeValidationFreshnessSummary {
  return {
    kind: 'infra-agent.knowledge-freshness-summary',
    schemaVersion: 1,
    mutationAllowed: false,
    staleSourceCount: input.staleSourceCount ?? 0,
    uncheckedLocalSourceCount: input.uncheckedLocalSourceCount ?? 0,
    staleFactCount: 0,
    uncheckedFactCount: 0,
    staleSources: [],
    uncheckedLocalSources: []
  };
}

export function createEmptyKnowledgeValidationReport(input: {
  inputPath: string;
  inputKind: string | null;
  issues: KnowledgeValidationIssue[];
  factCount?: number;
  staleSourceCount?: number;
}): KnowledgeValidationReport {
  return {
    kind: 'infra-agent.knowledge-validation',
    schemaVersion: 1,
    mutationAllowed: false,
    inputPath: input.inputPath,
    inputKind: input.inputKind,
    valid: input.issues.every(issue => issue.severity !== 'error'),
    factSetCount: 0,
    factCount: input.factCount ?? 0,
    staleSourceCount: input.staleSourceCount ?? 0,
    uncheckedLocalSourceCount: 0,
    freshness: buildEmptyFreshnessSummary({
      staleSourceCount: input.staleSourceCount ?? 0
    }),
    issueCount: input.issues.length,
    issues: input.issues
  };
}
