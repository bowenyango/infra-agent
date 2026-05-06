import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseKnowledgeFactSet } from './facts-contract.ts';
import { checkKnowledgeSourceFingerprint } from './local-source-fingerprint.ts';
import type { KnowledgeFactSet } from '../types/knowledge.ts';

export interface KnowledgeValidationIssue {
  severity: 'error' | 'warning';
  path: string;
  message: string;
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
  issueCount: number;
  issues: KnowledgeValidationIssue[];
}

export interface KnowledgeValidationOptions {
  workspaceRoot?: string;
}

interface ValidatedKnowledgeFactSet {
  path: string;
  factSet: KnowledgeFactSet;
}

interface LocalSourceValidationStats {
  staleSourceIds: Set<string>;
  uncheckedLocalSourceCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createReport(
  inputPath: string,
  inputKind: string | null,
  issues: KnowledgeValidationIssue[],
  factSets: KnowledgeFactSet[],
  options: KnowledgeValidationOptions = {},
  localSourceStats: LocalSourceValidationStats = {
    staleSourceIds: new Set(),
    uncheckedLocalSourceCount: 0
  }
): KnowledgeValidationReport {
  const factCount = factSets.reduce((total, factSet) => total + factSet.factCount, 0);
  const staleSourceIds = new Set([
    ...factSets.filter(factSet => factSet.sourceStale).map(factSet => factSet.sourceId),
    ...localSourceStats.staleSourceIds
  ]);
  return {
    kind: 'infra-agent.knowledge-validation',
    schemaVersion: 1,
    mutationAllowed: false,
    inputPath,
    inputKind,
    ...(options.workspaceRoot !== undefined ? { workspaceRoot: options.workspaceRoot } : {}),
    valid: issues.every(issue => issue.severity !== 'error'),
    factSetCount: factSets.length,
    factCount,
    staleSourceCount: staleSourceIds.size,
    uncheckedLocalSourceCount: localSourceStats.uncheckedLocalSourceCount,
    issueCount: issues.length,
    issues
  };
}

function error(path: string, message: string): KnowledgeValidationIssue {
  return {
    severity: 'error',
    path,
    message
  };
}

function warning(path: string, message: string): KnowledgeValidationIssue {
  return {
    severity: 'warning',
    path,
    message
  };
}

function validateFactSet(value: unknown, path: string, issues: KnowledgeValidationIssue[]): KnowledgeFactSet | null {
  try {
    return parseKnowledgeFactSet(value);
  } catch (validationError) {
    issues.push(error(path, validationError instanceof Error
      ? validationError.message
      : 'Knowledge fact set is invalid.'));
    return null;
  }
}

async function validateLocalSourceFingerprints(
  factSets: ValidatedKnowledgeFactSet[],
  workspaceRoot: string | undefined,
  issues: KnowledgeValidationIssue[]
): Promise<LocalSourceValidationStats> {
  const stats: LocalSourceValidationStats = {
    staleSourceIds: new Set(),
    uncheckedLocalSourceCount: 0
  };

  for (const { factSet, path } of factSets) {
    if (factSet.sourceFingerprint === undefined) {
      continue;
    }

    if (workspaceRoot === undefined) {
      stats.uncheckedLocalSourceCount += 1;
      issues.push(warning(
        `${path}.sourceFingerprint`,
        'Local source fingerprint was not rechecked because no workspace root was provided.'
      ));
      continue;
    }

    try {
      const check = await checkKnowledgeSourceFingerprint(workspaceRoot, factSet.sourceFingerprint);
      if (check.sourceStale) {
        stats.staleSourceIds.add(factSet.sourceId);
        issues.push(error(
          `${path}.sourceFingerprint`,
          `Local source fingerprint is stale: ${check.sourceStaleReason ?? 'local-file-hash-mismatch'}.`
        ));
      }
    } catch (validationError) {
      stats.staleSourceIds.add(factSet.sourceId);
      issues.push(error(
        `${path}.sourceFingerprint`,
        validationError instanceof Error
          ? validationError.message
          : 'Local source fingerprint could not be rechecked.'
      ));
    }
  }

  return stats;
}

export function validateKnowledgePayload(payload: unknown, inputPath = 'inline'): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  const factSets: KnowledgeFactSet[] = [];

  if (!isRecord(payload)) {
    return createReport(inputPath, null, [error('$', 'Knowledge payload must be a JSON object.')], factSets);
  }

  const inputKind = typeof payload.kind === 'string' ? payload.kind : null;
  if (inputKind === 'infra-agent.knowledge-facts') {
    const factSet = validateFactSet(payload, '$', issues);
    if (factSet) {
      factSets.push(factSet);
    }
    return createReport(inputPath, inputKind, issues, factSets);
  }

  if (inputKind !== 'infra-agent.knowledge-extraction') {
    return createReport(inputPath, inputKind, [error('$.kind', 'Unsupported knowledge payload kind.')], factSets);
  }

  if (payload.schemaVersion !== 1) {
    issues.push(error('$.schemaVersion', 'Knowledge extraction schemaVersion must be 1.'));
  }
  if (payload.mutationAllowed !== false) {
    issues.push(error('$.mutationAllowed', 'Knowledge extraction mutationAllowed must be false.'));
  }
  if (!Array.isArray(payload.factSets)) {
    issues.push(error('$.factSets', 'Knowledge extraction factSets must be an array.'));
  } else {
    payload.factSets.forEach((factSetPayload, index) => {
      const factSet = validateFactSet(factSetPayload, `$.factSets[${index}]`, issues);
      if (factSet) {
        factSets.push(factSet);
      }
    });

    if (payload.factSetCount !== payload.factSets.length) {
      issues.push(error('$.factSetCount', 'Knowledge extraction factSetCount must match factSets.length.'));
    }
  }

  if (Array.isArray(payload.sources) && payload.sourceCount !== payload.sources.length) {
    issues.push(error('$.sourceCount', 'Knowledge extraction sourceCount must match sources.length.'));
  }

  const declaredFactCount = typeof payload.factCount === 'number' ? payload.factCount : null;
  const actualFactCount = factSets.reduce((total, factSet) => total + factSet.factCount, 0);
  if (declaredFactCount !== actualFactCount) {
    issues.push(error('$.factCount', 'Knowledge extraction factCount must match the sum of fact set fact counts.'));
  }

  return createReport(inputPath, inputKind, issues, factSets);
}

export async function validateKnowledgePayloadWithLocalSources(
  payload: unknown,
  inputPath = 'inline',
  options: KnowledgeValidationOptions = {}
): Promise<KnowledgeValidationReport> {
  const report = validateKnowledgePayload(payload, inputPath);
  if (options.workspaceRoot === undefined) {
    return report;
  }

  if (!isRecord(payload)) {
    return { ...report, workspaceRoot: options.workspaceRoot };
  }

  const factSets: ValidatedKnowledgeFactSet[] = [];
  if (payload.kind === 'infra-agent.knowledge-facts') {
    const factSet = validateFactSet(payload, '$', []);
    if (factSet) {
      factSets.push({ path: '$', factSet });
    }
  } else if (payload.kind === 'infra-agent.knowledge-extraction' && Array.isArray(payload.factSets)) {
    payload.factSets.forEach((factSetPayload, index) => {
      const factSet = validateFactSet(factSetPayload, `$.factSets[${index}]`, []);
      if (factSet) {
        factSets.push({
          path: `$.factSets[${index}]`,
          factSet
        });
      }
    });
  }

  if (factSets.length === 0) {
    return { ...report, workspaceRoot: options.workspaceRoot };
  }

  const issues = [...report.issues];
  const localSourceStats = await validateLocalSourceFingerprints(factSets, options.workspaceRoot, issues);
  return createReport(
    inputPath,
    report.inputKind,
    issues,
    factSets.map(factSet => factSet.factSet),
    options,
    localSourceStats
  );
}

export async function loadKnowledgeValidationReport(
  inputPath: string,
  baseDir: string,
  options: KnowledgeValidationOptions = {}
): Promise<KnowledgeValidationReport> {
  const resolvedPath = resolve(baseDir, inputPath);
  try {
    const payload = JSON.parse(await readFile(resolvedPath, 'utf8')) as unknown;
    return validateKnowledgePayloadWithLocalSources(payload, resolvedPath, options);
  } catch (loadError) {
    return createReport(resolvedPath, null, [error('$', loadError instanceof Error
      ? loadError.message
      : 'Knowledge payload could not be loaded.')], [], options);
  }
}
