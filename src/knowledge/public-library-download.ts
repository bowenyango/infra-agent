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
import { validateKnowledgePayload } from './validate.ts';
import type { PublicLibraryRegistryEntry } from './public-library-registry.ts';
import {
  fetchPublicLibraryJsonBytes,
  loadPublicLibraryRegistry,
  resolvePublicLibraryArtifactLocation,
  type LoadedPublicLibraryRegistry,
  type PublicLibraryFetchImpl
} from './public-library-registry-loader.ts';
import { isSafeWorkspaceRelativePath } from './source-config.ts';
import {
  KNOWLEDGE_UNIT_TYPES,
  type KnowledgeUnitType
} from '../types/knowledge.ts';
import type {
  PublicKnowledgeLibraryArtifact,
  PublicKnowledgeQualityStatus,
  PublicKnowledgeVersionRef,
  PublicKnowledgeVersionResolution
} from './url-report.ts';

export interface PublicKnowledgeLibraryDownloadOptions {
  registryPath: string;
  workspaceRoot: string;
  storeDir: string;
  coordinates: string;
  fetchImpl?: PublicLibraryFetchImpl;
}

export interface PublicKnowledgeLibraryDownloadReport {
  kind: 'infra-agent.public-knowledge-library-download';
  schemaVersion: 1;
  mutationAllowed: true;
  executionMode: 'local-file-store';
  workspaceRoot: string;
  registryPath: string;
  registry: {
    locationKind: 'workspace-path' | 'url';
    path?: string;
    url?: string;
    contentHash: string;
    status: 'read' | 'downloaded';
  };
  coordinates: string;
  source: {
    locationKind: 'workspace-path' | 'url';
    path?: string;
    url?: string;
    contentHash: string;
    mediaType: PublicLibraryRegistryEntry['artifact']['mediaType'];
    requiresFetch: boolean;
    status: 'copied' | 'downloaded';
  };
  artifact: {
    storedPath: string;
    registryPath: string;
    sha256: string;
    artifactId: string;
    unitPayloadHash: string;
    sourceContentHash: string;
    unitCount: number;
    qualityStatus: PublicKnowledgeQualityStatus;
    versionRef: PublicKnowledgeVersionRef;
    versionResolution: PublicKnowledgeVersionResolution;
    reviewRequired: true;
  };
  classification: {
    ecosystem: PublicLibraryRegistryEntry['ecosystem'];
    artifactKind: PublicLibraryRegistryEntry['artifactKind'];
    providerAddress: string;
    version: string;
    sourceName: string;
    resourceToken?: string;
    repository?: string;
    chart?: string;
    tags: string[];
  };
  llmRefinement: {
    status: 'not-run';
    mode: 'offline-review';
    inputRef: 'artifact.llmRefinementInput';
    reviewPacketHash: string;
    outputContract: 'infra-agent.public-knowledge-url-report';
    unitTypes: KnowledgeUnitType[];
    unitCounts: Record<KnowledgeUnitType, number>;
    missingUnitTypes: KnowledgeUnitType[];
    unitTypeComplete: boolean;
    qualityStatus: PublicKnowledgeQualityStatus;
    qualityScore: number;
    qualityWarningCount: number;
    reviewRequired: true;
  };
  warnings: string[];
}

const PUBLIC_LIBRARY_ARTIFACT_MEDIA_TYPE = 'application/vnd.infra-agent.public-knowledge-library-artifact+json';

function sha256(content: string | Buffer): string {
  return createHash('sha256')
    .update(content)
    .digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertSafeRelativePath(value: string, label: string): void {
  if (!isSafeWorkspaceRelativePath(value)) {
    throw new Error(`${label} must be a safe workspace-relative path.`);
  }
}

function parsePublicKnowledgeLibraryArtifact(value: unknown): PublicKnowledgeLibraryArtifact {
  if (!isRecord(value) || value.kind !== 'infra-agent.public-knowledge-library-artifact') {
    throw new Error('Downloaded public library artifact must be an infra-agent.public-knowledge-library-artifact payload.');
  }

  return value as unknown as PublicKnowledgeLibraryArtifact;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function readArtifactBytes(
  entry: PublicLibraryRegistryEntry,
  registry: LoadedPublicLibraryRegistry,
  workspaceRoot: string,
  fetchImpl: PublicKnowledgeLibraryDownloadOptions['fetchImpl']
): Promise<{
  bytes: Buffer;
  source: PublicKnowledgeLibraryDownloadReport['source'];
}> {
  const location = resolvePublicLibraryArtifactLocation(entry, registry);
  if (location.kind === 'workspace-path') {
    const bytes = await readFile(resolve(workspaceRoot, location.path));
    return {
      bytes,
      source: {
        locationKind: 'workspace-path',
        path: location.path,
        contentHash: entry.artifact.contentHash,
        mediaType: entry.artifact.mediaType,
        requiresFetch: false,
        status: 'copied'
      }
    };
  }

  return {
    bytes: await fetchPublicLibraryJsonBytes({
      url: location.url,
      fetchImpl,
      label: 'public library artifact'
    }),
    source: {
      locationKind: 'url',
      ...(location.path ? { path: location.path } : {}),
      url: location.url,
      contentHash: entry.artifact.contentHash,
      mediaType: entry.artifact.mediaType,
      requiresFetch: true,
      status: 'downloaded'
    }
  };
}

function assertArtifactMatchesRegistry(
  artifact: PublicKnowledgeLibraryArtifact,
  entry: PublicLibraryRegistryEntry
): void {
  const mismatch = (field: string): never => {
    throw new Error(`Downloaded public library artifact ${artifact.coordinates} does not match registry entry ${entry.coordinates}: ${field}.`);
  };

  if (artifact.coordinates !== entry.coordinates) {
    mismatch('coordinates');
  }
  if (artifact.classification.ecosystem !== entry.ecosystem) {
    mismatch('classification.ecosystem');
  }
  if (artifact.classification.artifactKind !== entry.artifactKind) {
    mismatch('classification.artifactKind');
  }
  if (artifact.classification.providerAddress !== entry.providerAddress) {
    mismatch('classification.providerAddress');
  }
  if (artifact.classification.version !== entry.version) {
    mismatch('classification.version');
  }
  if (!sameJson(artifact.classification.versionRef, entry.versionRef)) {
    mismatch('classification.versionRef');
  }
  if (!sameJson(artifact.classification.versionResolution, entry.versionResolution)) {
    mismatch('classification.versionResolution');
  }
  if (artifact.classification.sourceName !== entry.sourceName) {
    mismatch('classification.sourceName');
  }
  if ((artifact.classification.resourceToken ?? undefined) !== (entry.resourceToken ?? undefined)) {
    mismatch('classification.resourceToken');
  }
  if ((artifact.classification.repository ?? undefined) !== (entry.repository ?? undefined)) {
    mismatch('classification.repository');
  }
  if ((artifact.classification.chart ?? undefined) !== (entry.chart ?? undefined)) {
    mismatch('classification.chart');
  }
  if (!sameJson(artifact.classification.tags, entry.tags)) {
    mismatch('classification.tags');
  }
  if (artifact.artifactId !== entry.artifact.artifactId) {
    mismatch('artifactId');
  }
  if (artifact.unitPayloadHash !== entry.artifact.unitPayloadHash) {
    mismatch('unitPayloadHash');
  }
  if (artifact.sourceContentHash !== entry.artifact.sourceContentHash) {
    mismatch('sourceContentHash');
  }
  if (artifact.summary.unitCount !== entry.artifact.unitCount) {
    mismatch('summary.unitCount');
  }
  if (artifact.quality.status !== entry.artifact.qualityStatus) {
    mismatch('quality.status');
  }
  if (!sameJson(artifact.classification.versionRef, entry.artifact.versionRef)) {
    mismatch('artifact.versionRef');
  }
  if (!sameJson(artifact.classification.versionResolution, entry.artifact.versionResolution)) {
    mismatch('artifact.versionResolution');
  }
  if (artifact.publication.reviewRequired !== entry.artifact.reviewRequired) {
    mismatch('publication.reviewRequired');
  }
  if (entry.artifact.mediaType !== PUBLIC_LIBRARY_ARTIFACT_MEDIA_TYPE) {
    mismatch('artifact.mediaType');
  }
  if (artifact.llmRefinementInput.reviewPacket.sourceContentHash !== entry.artifact.sourceContentHash) {
    mismatch('llmRefinementInput.reviewPacket.sourceContentHash');
  }
  if (entry.llmRefinement.reviewPacketHash !== sha256(JSON.stringify(artifact.llmRefinementInput.reviewPacket))) {
    mismatch('llmRefinement.reviewPacketHash');
  }
  for (const unitType of KNOWLEDGE_UNIT_TYPES) {
    if (artifact.summary.unitCounts[unitType] !== entry.llmRefinement.unitCounts[unitType]) {
      mismatch(`llmRefinement.unitCounts.${unitType}`);
    }
  }
  if (!sameJson(artifact.llmRefinementInput.reviewPacket.missingUnitTypes, entry.llmRefinement.missingUnitTypes)) {
    mismatch('llmRefinement.missingUnitTypes');
  }
  if (artifact.quality.score !== entry.llmRefinement.qualityScore) {
    mismatch('llmRefinement.qualityScore');
  }
  if (artifact.quality.warnings.length !== entry.llmRefinement.qualityWarningCount) {
    mismatch('llmRefinement.qualityWarningCount');
  }
}

function buildWarnings(entry: PublicLibraryRegistryEntry): string[] {
  return [
    ...(entry.llmRefinement.qualityStatus === 'needs-refinement'
      ? ['Downloaded artifact needs LLM refinement before it should be promoted as ready public-reference knowledge.']
      : []),
    ...(entry.llmRefinement.missingUnitTypes.length > 0
      ? [`Downloaded artifact is missing unit types: ${entry.llmRefinement.missingUnitTypes.join(', ')}.`]
      : []),
    ...(entry.artifact.reviewRequired
      ? ['Downloaded artifact remains review-required before remote publication or broad reuse.']
      : []),
    ...(entry.versionRef.mutable
      ? ['Downloaded artifact was indexed from a floating version alias; consumers should rely on the verified content hash.']
      : [])
  ];
}

export async function downloadPublicKnowledgeLibraryArtifact(
  options: PublicKnowledgeLibraryDownloadOptions
): Promise<PublicKnowledgeLibraryDownloadReport> {
  assertSafeRelativePath(options.storeDir, '--store-dir');

  const registry = await loadPublicLibraryRegistry({
    registryPath: options.registryPath,
    fetchImpl: options.fetchImpl
  });
  const entry = registry.entries.find(candidate => candidate.coordinates === options.coordinates);
  if (!entry) {
    throw new Error(`Public knowledge library registry does not contain coordinate ${options.coordinates}.`);
  }

  const { bytes, source } = await readArtifactBytes(entry, registry, options.workspaceRoot, options.fetchImpl);
  const artifactHash = sha256(bytes);
  if (artifactHash !== entry.artifact.contentHash) {
    throw new Error(`Downloaded public library artifact content hash mismatch for ${entry.coordinates}: expected ${entry.artifact.contentHash}, got ${artifactHash}.`);
  }

  const artifactPayload = JSON.parse(bytes.toString('utf8')) as unknown;
  const validation = validateKnowledgePayload(artifactPayload, source.path ?? source.url ?? entry.coordinates);
  if (!validation.valid || validation.inputKind !== 'infra-agent.public-knowledge-library-artifact') {
    const firstIssue = validation.issues[0];
    throw new Error(firstIssue
      ? `Downloaded public library artifact is invalid: ${firstIssue.path} ${firstIssue.message}`
      : 'Downloaded public library artifact is invalid.');
  }

  const artifact = parsePublicKnowledgeLibraryArtifact(artifactPayload);
  assertArtifactMatchesRegistry(artifact, entry);

  const storedRelativePath = join(options.storeDir, `${artifactHash}.public-knowledge-library-artifact.json`)
    .split('\\')
    .join('/');
  const storedAbsolutePath = resolve(options.workspaceRoot, storedRelativePath);
  await mkdir(dirname(storedAbsolutePath), { recursive: true });
  await writeFile(storedAbsolutePath, bytes);

  return {
    kind: 'infra-agent.public-knowledge-library-download',
    schemaVersion: 1,
    mutationAllowed: true,
    executionMode: 'local-file-store',
    workspaceRoot: options.workspaceRoot,
    registryPath: registry.registryPath,
    registry: {
      locationKind: registry.locationKind,
      ...(registry.path ? { path: registry.path } : {}),
      ...(registry.url ? { url: registry.url } : {}),
      contentHash: registry.contentHash,
      status: registry.status
    },
    coordinates: entry.coordinates,
    source,
    artifact: {
      storedPath: storedAbsolutePath,
      registryPath: storedRelativePath,
      sha256: artifactHash,
      artifactId: artifact.artifactId,
      unitPayloadHash: artifact.unitPayloadHash,
      sourceContentHash: artifact.sourceContentHash,
      unitCount: artifact.summary.unitCount,
      qualityStatus: artifact.quality.status,
      versionRef: artifact.classification.versionRef,
      versionResolution: artifact.classification.versionResolution,
      reviewRequired: artifact.publication.reviewRequired
    },
    classification: {
      ecosystem: entry.ecosystem,
      artifactKind: entry.artifactKind,
      providerAddress: entry.providerAddress,
      version: entry.version,
      sourceName: entry.sourceName,
      ...(entry.resourceToken ? { resourceToken: entry.resourceToken } : {}),
      ...(entry.repository ? { repository: entry.repository } : {}),
      ...(entry.chart ? { chart: entry.chart } : {}),
      tags: entry.tags
    },
    llmRefinement: {
      status: entry.llmRefinement.status,
      mode: entry.llmRefinement.mode,
      inputRef: entry.llmRefinement.inputRef,
      reviewPacketHash: entry.llmRefinement.reviewPacketHash,
      outputContract: entry.llmRefinement.outputContract,
      unitTypes: entry.llmRefinement.unitTypes,
      unitCounts: entry.llmRefinement.unitCounts,
      missingUnitTypes: entry.llmRefinement.missingUnitTypes,
      unitTypeComplete: entry.llmRefinement.missingUnitTypes.length === 0,
      qualityStatus: entry.llmRefinement.qualityStatus,
      qualityScore: entry.llmRefinement.qualityScore,
      qualityWarningCount: entry.llmRefinement.qualityWarningCount,
      reviewRequired: entry.llmRefinement.reviewRequired
    },
    warnings: buildWarnings(entry)
  };
}
