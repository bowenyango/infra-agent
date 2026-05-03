import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { cwd } from 'node:process';
import {
  buildIdentityConflictIncidentReport,
  type IdentityConflictIncidentReport
} from './output.ts';
import { parseCompactAgentRunResult } from './agent-result-contract.ts';

export async function loadIdentityConflictIncidentReport(
  inputPath: string,
  baseDir = cwd()
): Promise<IdentityConflictIncidentReport> {
  const resolvedInputPath = isAbsolute(inputPath) ? inputPath : resolve(baseDir, inputPath);
  const inputContent = await readFile(resolvedInputPath, 'utf8');

  return buildIdentityConflictIncidentReport(parseCompactAgentRunResult(JSON.parse(inputContent)));
}
