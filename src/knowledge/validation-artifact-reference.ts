import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import type {
  KnowledgeValidationIssue,
  KnowledgeValidationOptions,
  KnowledgeValidationReport
} from './validate.ts';

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

export interface KnowledgeValidationCountOverrides {
  factSetCount?: number;
  factCount?: number;
  unitSetCount?: number;
  unitCount?: number;
  staleSourceCount?: number;
  uncheckedLocalSourceCount?: number;
}

export type KnowledgeArtifactPayloadValidator = (
  payload: unknown,
  artifactPath: string,
  options: KnowledgeValidationOptions
) => KnowledgeValidationReport | Promise<KnowledgeValidationReport>;

interface ArtifactReferenceStats {
  kind: string;
  id: string | null;
  sourceIds: string[];
  sourceCount: number | null;
  factCount: number | null;
  unitCount: number | null;
  staleSourceCount: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function error(path: string, message: string): KnowledgeValidationIssue {
  return {
    severity: 'error',
    path,
    message
  };
}

function sha256Buffer(value: Buffer | string): string {
  return createHash('sha256')
    .update(value)
    .digest('hex');
}

function numberFromRecord(value: Record<string, unknown>, key: string): number | null {
  return typeof value[key] === 'number' && Number.isInteger(value[key]) && value[key] >= 0
    ? value[key] as number
    : null;
}

function stringArrayFromRecord(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    : [];
}

function artifactSourceIdsFromSources(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap(source => isRecord(source) && typeof source.id === 'string' ? [source.id] : [])
    : [];
}

function readArtifactReferenceStats(payload: unknown, artifactHash: string): ArtifactReferenceStats | null {
  if (!isRecord(payload) || typeof payload.kind !== 'string') {
    return null;
  }

  if (payload.kind === 'infra-agent.knowledge-pack') {
    return {
      kind: payload.kind,
      id: typeof payload.packId === 'string' ? payload.packId : null,
      sourceIds: stringArrayFromRecord(payload.sourceIds).length > 0
        ? stringArrayFromRecord(payload.sourceIds)
        : artifactSourceIdsFromSources(payload.sources),
      sourceCount: numberFromRecord(payload, 'sourceCount'),
      factCount: numberFromRecord(payload, 'factCount'),
      unitCount: numberFromRecord(payload, 'unitCount'),
      staleSourceCount: numberFromRecord(payload, 'staleSourceCount')
    };
  }

  if (payload.kind === 'infra-agent.knowledge-extraction') {
    const sourceIds = stringArrayFromRecord(payload.sourceIds).length > 0
      ? stringArrayFromRecord(payload.sourceIds)
      : artifactSourceIdsFromSources(payload.sources);
    const staleSourceIds = new Set(Array.isArray(payload.factSets)
      ? payload.factSets.flatMap(factSet =>
          isRecord(factSet) && factSet.sourceStale === true && typeof factSet.sourceId === 'string'
            ? [factSet.sourceId]
            : []
        )
      : []);
    return {
      kind: payload.kind,
      id: artifactHash.slice(0, 24),
      sourceIds,
      sourceCount: numberFromRecord(payload, 'sourceCount'),
      factCount: numberFromRecord(payload, 'factCount'),
      unitCount: numberFromRecord(payload, 'unitCount'),
      staleSourceCount: staleSourceIds.size
    };
  }

  return null;
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every(entry => rightSet.has(entry)) && rightSet.size === right.length;
}

function prefixArtifactIssue(issue: KnowledgeValidationIssue): KnowledgeValidationIssue {
  return {
    ...issue,
    path: issue.path === '$'
      ? '$.artifact.payload'
      : `$.artifact.payload${issue.path.slice(1)}`,
    message: `Referenced artifact: ${issue.message}`
  };
}

function unitCountOverrides(report: KnowledgeValidationReport): Pick<KnowledgeValidationCountOverrides, 'unitSetCount' | 'unitCount'> {
  return {
    ...(report.unitSetCount !== undefined ? { unitSetCount: report.unitSetCount } : {}),
    ...(report.unitCount !== undefined ? { unitCount: report.unitCount } : {})
  };
}

export async function validateKnowledgeArtifactReference(
  manifest: Record<string, unknown>,
  inputPath: string,
  options: KnowledgeValidationOptions,
  issues: KnowledgeValidationIssue[],
  validatePayload: KnowledgeArtifactPayloadValidator
): Promise<KnowledgeValidationCountOverrides> {
  if (!isRecord(manifest.artifact)) {
    return {};
  }

  const artifactPath = typeof manifest.artifact.path === 'string' && manifest.artifact.path.length > 0
    ? manifest.artifact.path
    : null;
  const expectedHash = typeof manifest.artifact.sha256 === 'string' && SHA256_HEX_PATTERN.test(manifest.artifact.sha256)
    ? manifest.artifact.sha256
    : null;
  if (artifactPath === null || expectedHash === null) {
    return {};
  }

  const resolvedArtifactPath = isAbsolute(artifactPath)
    ? artifactPath
    : resolve(dirname(inputPath), artifactPath);
  let artifactBytes: Buffer;
  try {
    artifactBytes = await readFile(resolvedArtifactPath);
  } catch (loadError) {
    issues.push(error(
      '$.artifact.path',
      loadError instanceof Error
        ? `Referenced artifact could not be read: ${loadError.message}`
        : 'Referenced artifact could not be read.'
    ));
    return {};
  }

  const actualHash = sha256Buffer(artifactBytes);
  if (actualHash !== expectedHash) {
    issues.push(error('$.artifact.sha256', 'Knowledge artifact manifest sha256 must match referenced artifact bytes.'));
  }

  let artifactPayload: unknown;
  try {
    artifactPayload = JSON.parse(artifactBytes.toString('utf8')) as unknown;
  } catch (parseError) {
    issues.push(error(
      '$.artifact.path',
      parseError instanceof Error
        ? `Referenced artifact JSON could not be parsed: ${parseError.message}`
        : 'Referenced artifact JSON could not be parsed.'
    ));
    return {};
  }

  const artifactReport = await validatePayload(artifactPayload, resolvedArtifactPath, options);
  issues.push(...artifactReport.issues.map(prefixArtifactIssue));

  const stats = readArtifactReferenceStats(artifactPayload, actualHash);
  if (stats === null) {
    return {
      factSetCount: artifactReport.factSetCount,
      factCount: artifactReport.factCount,
      ...unitCountOverrides(artifactReport),
      staleSourceCount: artifactReport.staleSourceCount,
      uncheckedLocalSourceCount: artifactReport.uncheckedLocalSourceCount
    };
  }

  if (manifest.artifact.kind !== stats.kind) {
    issues.push(error('$.artifact.kind', 'Knowledge artifact manifest kind must match referenced artifact.'));
  }
  if (typeof manifest.artifact.id === 'string' && stats.id !== null && manifest.artifact.id !== stats.id) {
    issues.push(error('$.artifact.id', 'Knowledge artifact manifest id must match referenced artifact.'));
  }
  if (Array.isArray(manifest.artifact.sourceIds) && !sameStringSet(stringArrayFromRecord(manifest.artifact.sourceIds), stats.sourceIds)) {
    issues.push(error('$.artifact.sourceIds', 'Knowledge artifact manifest sourceIds must match referenced artifact source ids.'));
  }
  if (typeof manifest.artifact.sourceCount === 'number' && stats.sourceCount !== null && manifest.artifact.sourceCount !== stats.sourceCount) {
    issues.push(error('$.artifact.sourceCount', 'Knowledge artifact manifest sourceCount must match referenced artifact.'));
  }
  if (typeof manifest.artifact.factCount === 'number' && stats.factCount !== null && manifest.artifact.factCount !== stats.factCount) {
    issues.push(error('$.artifact.factCount', 'Knowledge artifact manifest factCount must match referenced artifact.'));
  }
  if (typeof manifest.artifact.unitCount === 'number' && stats.unitCount !== null && manifest.artifact.unitCount !== stats.unitCount) {
    issues.push(error('$.artifact.unitCount', 'Knowledge artifact manifest unitCount must match referenced artifact.'));
  }
  if (
    typeof manifest.artifact.staleSourceCount === 'number'
    && stats.staleSourceCount !== null
    && manifest.artifact.staleSourceCount !== stats.staleSourceCount
  ) {
    issues.push(error('$.artifact.staleSourceCount', 'Knowledge artifact manifest staleSourceCount must match referenced artifact.'));
  }

  return {
    factSetCount: artifactReport.factSetCount,
    factCount: artifactReport.factCount,
    ...unitCountOverrides(artifactReport),
    staleSourceCount: artifactReport.staleSourceCount,
    uncheckedLocalSourceCount: artifactReport.uncheckedLocalSourceCount
  };
}
