import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { cwd } from 'node:process';
import {
  buildIdentityConflictIncidentReport,
  type CompactAgentRunResult,
  type IdentityConflictIncidentReport
} from './output.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseCompactAgentRunResult(value: unknown): CompactAgentRunResult {
  if (!isRecord(value) || value.kind !== 'infra-agent.agent-result') {
    throw new Error('identity-report input must be a compact infra-agent.agent-result JSON payload.');
  }

  if (!isRecord(value.validation) || !Array.isArray(value.validation.identityConflicts)) {
    throw new Error('identity-report input must include validation.identityConflicts array.');
  }

  for (let index = 0; index < value.validation.identityConflicts.length; index += 1) {
    const conflict = value.validation.identityConflicts[index];
    if (!isRecord(conflict)) {
      throw new Error(`identity-report conflict at index ${index} must be an object.`);
    }

    if (conflict.engine !== 'terraform' && conflict.engine !== 'pulumi') {
      throw new Error(`identity-report conflict at index ${index} must include engine terraform or pulumi.`);
    }

    if (!Array.isArray(conflict.reviewSteps)) {
      throw new Error(`identity-report conflict at index ${index} must include reviewSteps array.`);
    }
  }

  return value as unknown as CompactAgentRunResult;
}

export async function loadIdentityConflictIncidentReport(
  inputPath: string,
  baseDir = cwd()
): Promise<IdentityConflictIncidentReport> {
  const resolvedInputPath = isAbsolute(inputPath) ? inputPath : resolve(baseDir, inputPath);
  const inputContent = await readFile(resolvedInputPath, 'utf8');

  return buildIdentityConflictIncidentReport(parseCompactAgentRunResult(JSON.parse(inputContent)));
}
