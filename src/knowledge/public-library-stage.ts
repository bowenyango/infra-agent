import { createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  writeFile
} from 'node:fs/promises';
import {
  dirname,
  join,
  resolve
} from 'node:path';
import { isSafeWorkspaceRelativePath } from './source-config.ts';
import type {
  PublicKnowledgeDownloadSummary,
  PublicKnowledgeLibraryArtifact,
  PublicKnowledgeQualityStatus,
  PublicKnowledgeVersionRef
} from './url-report.ts';

export interface PublicKnowledgeLibraryRegistryEntry {
  coordinates: string;
  ecosystem: 'terraform';
  artifactKind: 'terraform-provider-resource' | 'terraform-provider-data-source';
  providerAddress: string;
  version: string;
  versionRef: PublicKnowledgeVersionRef;
  sourceName: string;
  tags: string[];
  artifact: {
    path: string;
    contentHash: string;
    mediaType: 'application/vnd.infra-agent.public-knowledge-library-artifact+json';
    artifactId: string;
    unitPayloadHash: string;
    sourceContentHash: string;
    unitCount: number;
    qualityStatus: PublicKnowledgeQualityStatus;
    versionRef: PublicKnowledgeVersionRef;
    reviewRequired: true;
  };
  download: Pick<PublicKnowledgeDownloadSummary, 'mode' | 'strategy' | 'usedRole' | 'fallbackUsed'>;
}

export interface PublicKnowledgeLibraryStageOptions {
  workspaceRoot: string;
  artifactPath: string;
  storeDir: string;
  registryPath: string;
  createdAt?: string;
}

export interface PublicKnowledgeLibraryStageReport {
  kind: 'infra-agent.public-knowledge-library-stage';
  schemaVersion: 1;
  mutationAllowed: true;
  executionMode: 'local-file-store';
  workspaceRoot: string;
  artifact: {
    inputPath: string;
    storedPath: string;
    registryPath: string;
    sha256: string;
    coordinates: string;
    artifactId: string;
    unitPayloadHash: string;
    sourceContentHash: string;
    unitCount: number;
    qualityStatus: PublicKnowledgeQualityStatus;
    versionRef: PublicKnowledgeVersionRef;
  };
  registry: {
    path: string;
    entryCount: number;
    updatedExistingEntry: boolean;
  };
  entry: PublicKnowledgeLibraryRegistryEntry;
  warnings: string[];
}

interface PublicKnowledgeLibraryRegistryPayload {
  kind: 'infra-agent.public-knowledge-library-registry';
  schemaVersion: 1;
  mutationAllowed: false;
  updatedAt?: string;
  entries: PublicKnowledgeLibraryRegistryEntry[];
}

const PUBLIC_LIBRARY_ARTIFACT_MEDIA_TYPE = 'application/vnd.infra-agent.public-knowledge-library-artifact+json';
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

function sha256(content: string | Buffer): string {
  return createHash('sha256')
    .update(content)
    .digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFileNotFound(value: unknown): boolean {
  return isRecord(value) && value.code === 'ENOENT';
}

function assertSafeRelativePath(value: string, label: string): void {
  if (!isSafeWorkspaceRelativePath(value)) {
    throw new Error(`${label} must be a safe workspace-relative path.`);
  }
}

function parsePublicKnowledgeLibraryArtifact(value: unknown): PublicKnowledgeLibraryArtifact {
  if (!isRecord(value) || value.kind !== 'infra-agent.public-knowledge-library-artifact') {
    throw new Error('Input artifact must be an infra-agent.public-knowledge-library-artifact payload.');
  }

  return value as unknown as PublicKnowledgeLibraryArtifact;
}

function isVersionRef(value: unknown, version: string): value is PublicKnowledgeVersionRef {
  const floating = version === 'latest';
  return isRecord(value)
    && value.value === version
    && value.kind === (floating ? 'floating-alias' : 'pinned-version')
    && value.mutable === floating
    && value.source === 'url-path';
}

function isRegistryEntry(value: unknown): value is PublicKnowledgeLibraryRegistryEntry {
  return isRecord(value)
    && typeof value.coordinates === 'string'
    && value.ecosystem === 'terraform'
    && (
      value.artifactKind === 'terraform-provider-resource'
      || value.artifactKind === 'terraform-provider-data-source'
    )
    && typeof value.providerAddress === 'string'
    && typeof value.version === 'string'
    && isVersionRef(value.versionRef, value.version)
    && typeof value.sourceName === 'string'
    && Array.isArray(value.tags)
    && value.tags.every(tag => typeof tag === 'string')
    && isRecord(value.artifact)
    && typeof value.artifact.path === 'string'
    && SHA256_HEX_PATTERN.test(String(value.artifact.contentHash))
    && value.artifact.mediaType === PUBLIC_LIBRARY_ARTIFACT_MEDIA_TYPE
    && typeof value.artifact.artifactId === 'string'
    && SHA256_HEX_PATTERN.test(String(value.artifact.unitPayloadHash))
    && SHA256_HEX_PATTERN.test(String(value.artifact.sourceContentHash))
    && Number.isInteger(value.artifact.unitCount)
    && isVersionRef(value.artifact.versionRef, value.version)
    && value.artifact.reviewRequired === true
    && isRecord(value.download)
    && typeof value.download.mode === 'string'
    && typeof value.download.strategy === 'string'
    && typeof value.download.usedRole === 'string'
    && typeof value.download.fallbackUsed === 'boolean';
}

async function readRegistryPayload(registryAbsolutePath: string): Promise<PublicKnowledgeLibraryRegistryPayload> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(registryAbsolutePath, 'utf8')) as unknown;
  } catch (loadError) {
    if (isFileNotFound(loadError)) {
      return {
        kind: 'infra-agent.public-knowledge-library-registry',
        schemaVersion: 1,
        mutationAllowed: false,
        entries: []
      };
    }

    throw new Error(`Public knowledge library registry could not be loaded from ${registryAbsolutePath}.`);
  }

  if (
    !isRecord(parsed)
    || parsed.kind !== 'infra-agent.public-knowledge-library-registry'
    || parsed.schemaVersion !== 1
    || parsed.mutationAllowed !== false
    || !Array.isArray(parsed.entries)
  ) {
    throw new Error(`Public knowledge library registry at ${registryAbsolutePath} is not a valid infra-agent.public-knowledge-library-registry payload.`);
  }

  const invalidEntryIndex = parsed.entries.findIndex(entry => !isRegistryEntry(entry));
  if (invalidEntryIndex >= 0) {
    throw new Error(`Public knowledge library registry at ${registryAbsolutePath} has an invalid entry at index ${invalidEntryIndex}.`);
  }

  return {
    kind: 'infra-agent.public-knowledge-library-registry',
    schemaVersion: 1,
    mutationAllowed: false,
    ...(typeof parsed.updatedAt === 'string' ? { updatedAt: parsed.updatedAt } : {}),
    entries: parsed.entries
  };
}

async function writeRegistryPayload(
  registryAbsolutePath: string,
  payload: PublicKnowledgeLibraryRegistryPayload
): Promise<void> {
  await mkdir(dirname(registryAbsolutePath), { recursive: true });
  await writeFile(registryAbsolutePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function buildRegistryEntry(input: {
  artifact: PublicKnowledgeLibraryArtifact;
  storedRelativePath: string;
  artifactHash: string;
}): PublicKnowledgeLibraryRegistryEntry {
  const { artifact } = input;

  return {
    coordinates: artifact.coordinates,
    ecosystem: artifact.classification.ecosystem,
    artifactKind: artifact.classification.artifactKind,
    providerAddress: artifact.classification.providerAddress,
    version: artifact.classification.version,
    versionRef: artifact.classification.versionRef,
    sourceName: artifact.classification.sourceName,
    tags: artifact.classification.tags,
    artifact: {
      path: input.storedRelativePath,
      contentHash: input.artifactHash,
      mediaType: PUBLIC_LIBRARY_ARTIFACT_MEDIA_TYPE,
      artifactId: artifact.artifactId,
      unitPayloadHash: artifact.unitPayloadHash,
      sourceContentHash: artifact.sourceContentHash,
      unitCount: artifact.summary.unitCount,
      qualityStatus: artifact.quality.status,
      versionRef: artifact.classification.versionRef,
      reviewRequired: artifact.publication.reviewRequired
    },
    download: {
      mode: artifact.download.mode,
      strategy: artifact.download.strategy,
      usedRole: artifact.download.usedRole,
      fallbackUsed: artifact.download.fallbackUsed
    }
  };
}

export async function stagePublicKnowledgeLibraryArtifact(
  options: PublicKnowledgeLibraryStageOptions
): Promise<PublicKnowledgeLibraryStageReport> {
  assertSafeRelativePath(options.storeDir, '--store-dir');
  assertSafeRelativePath(options.registryPath, '--registry');

  const inputPath = resolve(options.artifactPath);
  const artifactBytes = await readFile(inputPath);
  const artifact = parsePublicKnowledgeLibraryArtifact(JSON.parse(artifactBytes.toString('utf8')) as unknown);
  const artifactHash = sha256(artifactBytes);
  const storedRelativePath = join(options.storeDir, `${artifactHash}.public-knowledge-library-artifact.json`)
    .split('\\')
    .join('/');
  const storedAbsolutePath = resolve(options.workspaceRoot, storedRelativePath);
  const registryAbsolutePath = resolve(options.workspaceRoot, options.registryPath);
  const registry = await readRegistryPayload(registryAbsolutePath);

  await mkdir(dirname(storedAbsolutePath), { recursive: true });
  await writeFile(storedAbsolutePath, artifactBytes);

  const entry = buildRegistryEntry({
    artifact,
    storedRelativePath,
    artifactHash
  });
  const existingIndex = registry.entries.findIndex(candidate => candidate.coordinates === entry.coordinates);
  const updatedExistingEntry = existingIndex >= 0;
  if (updatedExistingEntry) {
    registry.entries[existingIndex] = entry;
  } else {
    registry.entries.push(entry);
  }
  registry.updatedAt = options.createdAt ?? new Date().toISOString();
  await writeRegistryPayload(registryAbsolutePath, registry);

  return {
    kind: 'infra-agent.public-knowledge-library-stage',
    schemaVersion: 1,
    mutationAllowed: true,
    executionMode: 'local-file-store',
    workspaceRoot: options.workspaceRoot,
    artifact: {
      inputPath,
      storedPath: storedAbsolutePath,
      registryPath: storedRelativePath,
      sha256: artifactHash,
      coordinates: artifact.coordinates,
      artifactId: artifact.artifactId,
      unitPayloadHash: artifact.unitPayloadHash,
      sourceContentHash: artifact.sourceContentHash,
      unitCount: artifact.summary.unitCount,
      qualityStatus: artifact.quality.status,
      versionRef: artifact.classification.versionRef
    },
    registry: {
      path: registryAbsolutePath,
      entryCount: registry.entries.length,
      updatedExistingEntry
    },
    entry,
    warnings: [
      ...(artifact.publication.reviewRequired
        ? ['Artifact remains review-required before any remote or public registry publication.']
        : []),
      ...(artifact.classification.versionRef.mutable
        ? ['Artifact was built from a floating version alias; consumers must rely on content hashes and review before public reuse.']
        : [])
    ]
  };
}
