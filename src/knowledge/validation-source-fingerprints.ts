import {
  isAbsolute
} from 'node:path';
import {
  buildKnowledgeSourceFingerprint,
  checkKnowledgeSourceFingerprint
} from './local-source-fingerprint.ts';
import type { KnowledgePackSource } from './pack.ts';
import type {
  KnowledgeSourceFileFingerprint,
  KnowledgeSourceFingerprint,
  KnowledgeSourceKind,
  KnowledgeSourceStaleReason
} from '../types/knowledge.ts';
import type { KnowledgeValidationIssue } from './validate.ts';

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const SECRET_PATH_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;

export interface LocalSourceValidationStats {
  staleSourceIds: Set<string>;
  uncheckedLocalSourceCount: number;
  staleSourceDetails: LocalSourceStaleDetail[];
  uncheckedLocalSourceDetails: LocalSourceUncheckedDetail[];
}

export type LocalSourceUncheckedReason = 'workspace-not-provided' | 'missing-fingerprint';

export interface LocalSourceFreshnessMetadata {
  sourceKind?: KnowledgeSourceKind | null;
  sourceName?: string | null;
  factCount?: number;
}

export interface LocalSourceStaleDetail extends LocalSourceFreshnessMetadata {
  sourceId: string;
  path: string;
  staleReason: KnowledgeSourceStaleReason;
  stalePaths: string[];
  missingPaths: string[];
  fingerprintDigest?: string;
  fingerprintFileCount?: number;
}

export interface LocalSourceUncheckedDetail extends LocalSourceFreshnessMetadata {
  sourceId: string;
  path: string;
  uncheckedReason: LocalSourceUncheckedReason;
  fingerprintDigest?: string;
  fingerprintFileCount?: number;
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

function warning(path: string, message: string): KnowledgeValidationIssue {
  return {
    severity: 'warning',
    path,
    message
  };
}

export function buildLocalSourceStaleDetail(input: {
  sourceId: string;
  path: string;
  fingerprint: KnowledgeSourceFingerprint;
  staleReason: KnowledgeSourceStaleReason;
  fileChecks: Array<{ path: string; stale: boolean; staleReason?: KnowledgeSourceStaleReason }>;
} & LocalSourceFreshnessMetadata): LocalSourceStaleDetail {
  return {
    sourceId: input.sourceId,
    path: input.path,
    ...(input.sourceKind !== undefined ? { sourceKind: input.sourceKind } : {}),
    ...(input.sourceName !== undefined ? { sourceName: input.sourceName } : {}),
    ...(input.factCount !== undefined ? { factCount: input.factCount } : {}),
    staleReason: input.staleReason,
    stalePaths: input.fileChecks
      .filter(file => file.stale && file.staleReason === 'local-file-hash-mismatch')
      .map(file => file.path)
      .sort(),
    missingPaths: input.fileChecks
      .filter(file => file.stale && file.staleReason === 'local-file-missing')
      .map(file => file.path)
      .sort(),
    fingerprintDigest: input.fingerprint.digest,
    fingerprintFileCount: input.fingerprint.fileCount
  };
}

export function buildLocalSourceUncheckedDetail(input: {
  sourceId: string;
  path: string;
  uncheckedReason: LocalSourceUncheckedReason;
  fingerprint?: KnowledgeSourceFingerprint;
} & LocalSourceFreshnessMetadata): LocalSourceUncheckedDetail {
  return {
    sourceId: input.sourceId,
    path: input.path,
    ...(input.sourceKind !== undefined ? { sourceKind: input.sourceKind } : {}),
    ...(input.sourceName !== undefined ? { sourceName: input.sourceName } : {}),
    ...(input.factCount !== undefined ? { factCount: input.factCount } : {}),
    uncheckedReason: input.uncheckedReason,
    ...(input.fingerprint !== undefined
      ? {
          fingerprintDigest: input.fingerprint.digest,
          fingerprintFileCount: input.fingerprint.fileCount
        }
      : {})
  };
}

function normalizeWorkspacePath(path: string): string {
  return path.split('\\').join('/');
}

function isSafeWorkspaceRelativePath(path: string): boolean {
  const normalized = normalizeWorkspacePath(path);
  const segments = normalized.split('/');
  return normalized.length > 0
    && normalized !== '.'
    && !isAbsolute(path)
    && !/^[A-Za-z]:\//.test(normalized)
    && !normalized.startsWith('/')
    && !segments.some(segment => segment.length === 0 || segment === '.' || segment === '..')
    && !SECRET_PATH_PATTERN.test(normalized);
}

function readNonEmptyString(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    issues.push(error(path, 'must be a non-empty string.'));
    return null;
  }

  return value;
}

function readNonNegativeInteger(
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

export function validateKnowledgeSourceFingerprintContract(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): KnowledgeSourceFingerprint | null {
  if (!isRecord(value)) {
    issues.push(error(path, 'Knowledge source fingerprint must be an object.'));
    return null;
  }

  if (value.algorithm !== 'sha256') {
    issues.push(error(`${path}.algorithm`, 'Knowledge source fingerprint algorithm must be sha256.'));
  }
  if (typeof value.digest !== 'string' || !SHA256_HEX_PATTERN.test(value.digest)) {
    issues.push(error(`${path}.digest`, 'Knowledge source fingerprint digest must be a SHA-256 hex string.'));
  }
  const fileCount = readNonNegativeInteger(value.fileCount, `${path}.fileCount`, issues);
  const files: KnowledgeSourceFileFingerprint[] = [];
  if (!Array.isArray(value.files)) {
    issues.push(error(`${path}.files`, 'Knowledge source fingerprint files must be an array.'));
  } else {
    value.files.forEach((file, index) => {
      const filePath = `${path}.files[${index}]`;
      if (!isRecord(file)) {
        issues.push(error(filePath, 'Knowledge source fingerprint file must be an object.'));
        return;
      }

      const sourcePath = readNonEmptyString(file.path, `${filePath}.path`, issues);
      if (sourcePath !== null && !isSafeWorkspaceRelativePath(sourcePath)) {
        issues.push(error(`${filePath}.path`, 'Knowledge source fingerprint file path must be a safe workspace-relative path.'));
      }
      if (typeof file.contentHash !== 'string' || !SHA256_HEX_PATTERN.test(file.contentHash)) {
        issues.push(error(`${filePath}.contentHash`, 'Knowledge source fingerprint file contentHash must be a SHA-256 hex string.'));
      }
      if (file.stale !== undefined && typeof file.stale !== 'boolean') {
        issues.push(error(`${filePath}.stale`, 'Knowledge source fingerprint file stale must be a boolean when present.'));
      }

      if (
        sourcePath !== null
        && isSafeWorkspaceRelativePath(sourcePath)
        && typeof file.contentHash === 'string'
        && SHA256_HEX_PATTERN.test(file.contentHash)
      ) {
        files.push({
          path: normalizeWorkspacePath(sourcePath),
          contentHash: file.contentHash,
          ...(typeof file.stale === 'boolean' ? { stale: file.stale } : {})
        });
      }
    });
  }

  if (fileCount !== null && fileCount !== files.length) {
    issues.push(error(`${path}.fileCount`, 'Knowledge source fingerprint fileCount must match files.length.'));
  }

  if (
    value.algorithm !== 'sha256'
    || typeof value.digest !== 'string'
    || !SHA256_HEX_PATTERN.test(value.digest)
    || fileCount === null
    || !Array.isArray(value.files)
  ) {
    return null;
  }

  try {
    const normalized = buildKnowledgeSourceFingerprint(files);
    if (normalized.digest !== value.digest) {
      issues.push(error(`${path}.digest`, 'Knowledge source fingerprint digest must match normalized files.'));
    }
    if (normalized.fileCount !== fileCount) {
      issues.push(error(`${path}.fileCount`, 'Knowledge source fingerprint fileCount must match normalized files.'));
    }
    return normalized;
  } catch (validationError) {
    issues.push(error(
      path,
      validationError instanceof Error
        ? validationError.message
        : 'Knowledge source fingerprint is invalid.'
    ));
    return null;
  }
}

export async function validatePackSourceFingerprints(
  sources: Array<Pick<KnowledgePackSource, 'id' | 'stale' | 'storagePolicy' | 'fingerprint'>>,
  workspaceRoot: string | undefined,
  issues: KnowledgeValidationIssue[]
): Promise<LocalSourceValidationStats> {
  const stats: LocalSourceValidationStats = {
    staleSourceIds: new Set(sources.filter(source => source.stale).map(source => source.id)),
    uncheckedLocalSourceCount: 0,
    staleSourceDetails: [],
    uncheckedLocalSourceDetails: []
  };

  for (const [index, source] of sources.entries()) {
    if (source.fingerprint === undefined) {
      if (source.storagePolicy.scope === 'workspace-private' || source.storagePolicy.requiresExplicitOptIn) {
        stats.uncheckedLocalSourceCount += 1;
        stats.uncheckedLocalSourceDetails.push(buildLocalSourceUncheckedDetail({
          sourceId: source.id,
          path: `$.sources[${index}].fingerprint`,
          uncheckedReason: 'missing-fingerprint'
        }));
        const issue = workspaceRoot === undefined ? warning : error;
        issues.push(issue(
          `$.sources[${index}].fingerprint`,
          workspaceRoot === undefined
            ? 'Workspace-private knowledge pack source fingerprint was not rechecked because no workspace root was provided.'
            : 'Workspace-private knowledge pack source cannot be rechecked because its fingerprint is missing.'
        ));
      }
      continue;
    }

    if (workspaceRoot === undefined) {
      stats.uncheckedLocalSourceCount += 1;
      stats.uncheckedLocalSourceDetails.push(buildLocalSourceUncheckedDetail({
        sourceId: source.id,
        path: `$.sources[${index}].fingerprint`,
        uncheckedReason: 'workspace-not-provided',
        fingerprint: source.fingerprint
      }));
      issues.push(warning(
        `$.sources[${index}].fingerprint`,
        'Knowledge pack source fingerprint was not rechecked because no workspace root was provided.'
      ));
      continue;
    }

    try {
      const check = await checkKnowledgeSourceFingerprint(workspaceRoot, source.fingerprint);
      if (check.sourceStale) {
        stats.staleSourceIds.add(source.id);
        stats.staleSourceDetails.push(buildLocalSourceStaleDetail({
          sourceId: source.id,
          path: `$.sources[${index}].fingerprint`,
          fingerprint: source.fingerprint,
          staleReason: check.sourceStaleReason ?? 'local-file-hash-mismatch',
          fileChecks: check.fileChecks
        }));
        issues.push(error(
          `$.sources[${index}].fingerprint`,
          `Local source fingerprint is stale: ${check.sourceStaleReason ?? 'local-file-hash-mismatch'}.`
        ));
      }
    } catch (validationError) {
      stats.staleSourceIds.add(source.id);
      stats.staleSourceDetails.push({
        sourceId: source.id,
        path: `$.sources[${index}].fingerprint`,
        staleReason: 'local-file-hash-mismatch',
        stalePaths: [],
        missingPaths: [],
        ...(source.fingerprint !== undefined
          ? {
              fingerprintDigest: source.fingerprint.digest,
              fingerprintFileCount: source.fingerprint.fileCount
            }
          : {})
      });
      issues.push(error(
        `$.sources[${index}].fingerprint`,
        validationError instanceof Error
          ? validationError.message
          : 'Knowledge pack source fingerprint could not be rechecked.'
      ));
    }
  }

  return stats;
}
