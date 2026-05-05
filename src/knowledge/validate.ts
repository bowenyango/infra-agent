import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseKnowledgeFactSet } from './facts-contract.ts';
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
  valid: boolean;
  factSetCount: number;
  factCount: number;
  issueCount: number;
  issues: KnowledgeValidationIssue[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createReport(inputPath: string, inputKind: string | null, issues: KnowledgeValidationIssue[], factSets: KnowledgeFactSet[]): KnowledgeValidationReport {
  const factCount = factSets.reduce((total, factSet) => total + factSet.factCount, 0);
  return {
    kind: 'infra-agent.knowledge-validation',
    schemaVersion: 1,
    mutationAllowed: false,
    inputPath,
    inputKind,
    valid: issues.every(issue => issue.severity !== 'error'),
    factSetCount: factSets.length,
    factCount,
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

export async function loadKnowledgeValidationReport(inputPath: string, baseDir: string): Promise<KnowledgeValidationReport> {
  const resolvedPath = resolve(baseDir, inputPath);
  try {
    const payload = JSON.parse(await readFile(resolvedPath, 'utf8')) as unknown;
    return validateKnowledgePayload(payload, resolvedPath);
  } catch (loadError) {
    return createReport(resolvedPath, null, [error('$', loadError instanceof Error
      ? loadError.message
      : 'Knowledge payload could not be loaded.')], []);
  }
}
