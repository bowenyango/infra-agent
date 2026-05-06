import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type {
  KnowledgeSourceFileFingerprint,
  KnowledgeSourceFingerprint,
  KnowledgeSourceStaleReason
} from '../types/knowledge.ts';

export interface KnowledgeSourceFingerprintCheck {
  fingerprint: KnowledgeSourceFingerprint;
  sourceStale: boolean;
  sourceStaleReason?: KnowledgeSourceStaleReason;
}

const SECRET_PATH_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeWorkspacePath(path: string): string {
  return path.split('\\').join('/');
}

function assertSafeWorkspacePath(path: string): void {
  const normalized = normalizeWorkspacePath(path);
  const segments = normalized.split('/');
  if (
    normalized.length === 0
    || normalized === '.'
    || isAbsolute(path)
    || /^[A-Za-z]:\//.test(normalized)
    || normalized.startsWith('/')
    || segments.some(segment => segment.length === 0 || segment === '.' || segment === '..')
    || SECRET_PATH_PATTERN.test(normalized)
  ) {
    throw new Error(`Invalid local knowledge source path: ${path}`);
  }
}

function normalizeFiles(files: KnowledgeSourceFileFingerprint[]): KnowledgeSourceFileFingerprint[] {
  const byPath = new Map<string, KnowledgeSourceFileFingerprint>();

  for (const file of files) {
    const path = normalizeWorkspacePath(file.path);
    assertSafeWorkspacePath(path);
    if (!SHA256_HEX_PATTERN.test(file.contentHash)) {
      throw new Error(`Invalid local knowledge source hash for ${path}`);
    }
    byPath.set(path, {
      path,
      contentHash: file.contentHash,
      ...(file.stale !== undefined ? { stale: file.stale } : {})
    });
  }

  return Array.from(byPath.values()).sort((left, right) => left.path.localeCompare(right.path));
}

export function buildKnowledgeSourceFingerprint(
  files: KnowledgeSourceFileFingerprint[]
): KnowledgeSourceFingerprint {
  const normalizedFiles = normalizeFiles(files);
  const digest = sha256Hex(JSON.stringify(normalizedFiles.map(file => ({
    path: file.path,
    contentHash: file.contentHash
  }))));

  return {
    algorithm: 'sha256',
    digest,
    fileCount: normalizedFiles.length,
    files: normalizedFiles
  };
}

export async function fingerprintWorkspaceFiles(
  workspaceRoot: string,
  paths: string[]
): Promise<KnowledgeSourceFingerprint> {
  const files: KnowledgeSourceFileFingerprint[] = [];

  for (const path of Array.from(new Set(paths.map(normalizeWorkspacePath))).sort()) {
    assertSafeWorkspacePath(path);
    files.push({
      path,
      contentHash: sha256Hex(await readFile(join(workspaceRoot, path), 'utf8')),
      stale: false
    });
  }

  return buildKnowledgeSourceFingerprint(files);
}

export async function checkKnowledgeSourceFingerprint(
  workspaceRoot: string,
  fingerprint: KnowledgeSourceFingerprint
): Promise<KnowledgeSourceFingerprintCheck> {
  const files: KnowledgeSourceFileFingerprint[] = [];
  let missing = false;
  let mismatch = false;

  for (const file of fingerprint.files) {
    assertSafeWorkspacePath(file.path);
    try {
      const currentHash = sha256Hex(await readFile(join(workspaceRoot, file.path), 'utf8'));
      const stale = currentHash !== file.contentHash;
      mismatch ||= stale;
      files.push({
        path: file.path,
        contentHash: file.contentHash,
        stale
      });
    } catch {
      missing = true;
      files.push({
        path: file.path,
        contentHash: file.contentHash,
        stale: true
      });
    }
  }

  const checkedFingerprint = buildKnowledgeSourceFingerprint(files);
  return {
    fingerprint: checkedFingerprint,
    sourceStale: missing || mismatch,
    ...(missing
      ? { sourceStaleReason: 'local-file-missing' as const }
      : mismatch
        ? { sourceStaleReason: 'local-file-hash-mismatch' as const }
        : {})
  };
}
