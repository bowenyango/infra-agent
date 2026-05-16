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
import { parseKnowledgeUnitSet } from './knowledge-unit-contract.ts';
import {
  isInfraDomain,
  isSafeWorkspaceRelativePath
} from './source-config.ts';
import type { InfraDomainId } from '../types/repository.ts';
import type { KnowledgeSource, KnowledgeUnitPrivacyScope, KnowledgeUnitSet } from '../types/knowledge.ts';

export interface SharedKnowledgeArtifactPublishOptions {
  workspaceRoot: string;
  artifactPath: string;
  storeDir: string;
  registryPath: string;
  domain?: InfraDomainId;
  targetPath?: string;
  name?: string;
  version?: string;
  provider?: string;
  packageName?: string;
  chart?: string;
  moduleName?: string;
  allowWorkspacePrivate?: boolean;
  createdAt?: string;
}

export interface SharedKnowledgeArtifactRegistryEntry {
  domain: InfraDomainId;
  targetPath?: string;
  artifact: {
    path: string;
    name: string;
    version?: string;
    contentHash: string;
    provider?: string;
    packageName?: string;
    chart?: string;
    module?: string;
  };
}

export interface SharedKnowledgeArtifactPublishReport {
  kind: 'infra-agent.knowledge-shared-artifact-publish';
  schemaVersion: 1;
  mutationAllowed: true;
  executionMode: 'local-file-store';
  workspaceRoot: string;
  artifact: {
    inputPath: string;
    storedPath: string;
    registryPath: string;
    sha256: string;
    sourceId: string;
    sourceKind: KnowledgeSource['kind'];
    sourceName: string;
    unitCount: number;
    privacyScopes: KnowledgeUnitPrivacyScope[];
  };
  registry: {
    path: string;
    entryCount: number;
    updatedExistingEntry: boolean;
  };
  entry: SharedKnowledgeArtifactRegistryEntry;
  warnings: string[];
}

interface SharedKnowledgeArtifactRegistryPayload {
  kind: 'infra-agent.knowledge-unit-registry';
  schemaVersion: 1;
  mutationAllowed: false;
  updatedAt?: string;
  entries: SharedKnowledgeArtifactRegistryEntry[];
}

const PUBLICATION_SAFE_PRIVACY_SCOPES = new Set<KnowledgeUnitPrivacyScope>([
  'public-reference',
  'internal-team'
]);

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

function optionalSafeString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function inferDomain(source: KnowledgeSource): InfraDomainId | null {
  if (source.kind === 'terraform-registry' || source.provider !== undefined) {
    return 'terraform';
  }

  if (source.kind === 'pulumi-docs' || source.packageName !== undefined) {
    return 'pulumi';
  }

  if (source.kind === 'helm-docs' || source.kind === 'chart-docs' || source.chart !== undefined) {
    return 'helm';
  }

  return null;
}

function privacyScopes(unitSet: KnowledgeUnitSet): KnowledgeUnitPrivacyScope[] {
  return Array.from(new Set(unitSet.units.map(unit => unit.privacyScope))).sort();
}

function assertPublishablePrivacy(unitSet: KnowledgeUnitSet, allowWorkspacePrivate: boolean | undefined): void {
  if (allowWorkspacePrivate) {
    return;
  }

  const blockedScopes = privacyScopes(unitSet)
    .filter(scope => !PUBLICATION_SAFE_PRIVACY_SCOPES.has(scope));
  if (blockedScopes.length > 0) {
    throw new Error(`Knowledge artifact includes ${blockedScopes.join(', ')} units. Pass --allow-workspace-private to publish them to a shared registry.`);
  }
}

function assertSafeRelativePath(value: string, label: string): void {
  if (!isSafeWorkspaceRelativePath(value)) {
    throw new Error(`${label} must be a safe workspace-relative path.`);
  }
}

async function readRegistryPayload(registryAbsolutePath: string): Promise<SharedKnowledgeArtifactRegistryPayload> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(registryAbsolutePath, 'utf8')) as unknown;
  } catch (loadError) {
    if (isFileNotFound(loadError)) {
      return {
        kind: 'infra-agent.knowledge-unit-registry',
        schemaVersion: 1,
        mutationAllowed: false,
        entries: []
      };
    }

    throw new Error(`Knowledge unit registry could not be loaded from ${registryAbsolutePath}.`);
  }

  if (
    !isRecord(parsed)
    || parsed.kind !== 'infra-agent.knowledge-unit-registry'
    || parsed.schemaVersion !== 1
    || parsed.mutationAllowed !== false
    || !Array.isArray(parsed.entries)
  ) {
    throw new Error(`Knowledge unit registry at ${registryAbsolutePath} is not a valid infra-agent.knowledge-unit-registry payload.`);
  }

  const invalidEntryIndex = parsed.entries.findIndex(entry => !isRegistryEntry(entry));
  if (invalidEntryIndex >= 0) {
    throw new Error(`Knowledge unit registry at ${registryAbsolutePath} has an invalid entry at index ${invalidEntryIndex}.`);
  }

  return {
    kind: 'infra-agent.knowledge-unit-registry',
    schemaVersion: 1,
    mutationAllowed: false,
    ...(typeof parsed.updatedAt === 'string' ? { updatedAt: parsed.updatedAt } : {}),
    entries: parsed.entries
  };
}

function isRegistryEntry(value: unknown): value is SharedKnowledgeArtifactRegistryEntry {
  return isRecord(value)
    && isInfraDomain(value.domain)
    && isRecord(value.artifact)
    && typeof value.artifact.path === 'string'
    && typeof value.artifact.name === 'string'
    && typeof value.artifact.contentHash === 'string';
}

function sameRegistryEntry(
  left: SharedKnowledgeArtifactRegistryEntry,
  right: SharedKnowledgeArtifactRegistryEntry
): boolean {
  return left.domain === right.domain
    && (left.targetPath ?? '') === (right.targetPath ?? '')
    && left.artifact.name === right.artifact.name;
}

async function writeRegistryPayload(
  registryAbsolutePath: string,
  payload: SharedKnowledgeArtifactRegistryPayload
): Promise<void> {
  await mkdir(dirname(registryAbsolutePath), { recursive: true });
  await writeFile(registryAbsolutePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export async function publishSharedKnowledgeArtifact(
  options: SharedKnowledgeArtifactPublishOptions
): Promise<SharedKnowledgeArtifactPublishReport> {
  assertSafeRelativePath(options.storeDir, '--store-dir');
  assertSafeRelativePath(options.registryPath, '--registry');
  if (options.targetPath !== undefined) {
    assertSafeRelativePath(options.targetPath, '--target');
  }

  const inputPath = resolve(options.artifactPath);
  const artifactBytes = await readFile(inputPath);
  const unitSet = parseKnowledgeUnitSet(JSON.parse(artifactBytes.toString('utf8')) as unknown);
  assertPublishablePrivacy(unitSet, options.allowWorkspacePrivate);

  const domain = options.domain ?? inferDomain(unitSet.source);
  if (!domain) {
    throw new Error('Unable to infer artifact domain. Pass --domain helm, --domain pulumi, or --domain terraform.');
  }

  const artifactHash = sha256(artifactBytes);
  const storedRelativePath = join(options.storeDir, `${artifactHash}.knowledge-units.json`);
  const storedAbsolutePath = resolve(options.workspaceRoot, storedRelativePath);
  const registryAbsolutePath = resolve(options.workspaceRoot, options.registryPath);
  const registry = await readRegistryPayload(registryAbsolutePath);
  await mkdir(dirname(storedAbsolutePath), { recursive: true });
  await writeFile(storedAbsolutePath, artifactBytes);

  const entry: SharedKnowledgeArtifactRegistryEntry = {
    domain,
    ...(options.targetPath !== undefined ? { targetPath: options.targetPath } : {}),
    artifact: {
      path: storedRelativePath.split('\\').join('/'),
      name: optionalSafeString(options.name) ?? unitSet.source.name,
      ...(optionalSafeString(options.version) ?? unitSet.source.version
        ? { version: optionalSafeString(options.version) ?? unitSet.source.version }
        : {}),
      contentHash: artifactHash,
      ...(optionalSafeString(options.provider) ?? unitSet.source.provider
        ? { provider: optionalSafeString(options.provider) ?? unitSet.source.provider }
        : {}),
      ...(optionalSafeString(options.packageName) ?? unitSet.source.packageName
        ? { packageName: optionalSafeString(options.packageName) ?? unitSet.source.packageName }
        : {}),
      ...(optionalSafeString(options.chart) ?? unitSet.source.chart
        ? { chart: optionalSafeString(options.chart) ?? unitSet.source.chart }
        : {}),
      ...(optionalSafeString(options.moduleName) ?? unitSet.source.module
        ? { module: optionalSafeString(options.moduleName) ?? unitSet.source.module }
        : {})
    }
  };

  const existingIndex = registry.entries.findIndex(candidate => sameRegistryEntry(candidate, entry));
  const updatedExistingEntry = existingIndex >= 0;
  if (updatedExistingEntry) {
    registry.entries[existingIndex] = entry;
  } else {
    registry.entries.push(entry);
  }
  registry.updatedAt = options.createdAt ?? new Date().toISOString();
  await writeRegistryPayload(registryAbsolutePath, registry);

  const scopes = privacyScopes(unitSet);
  return {
    kind: 'infra-agent.knowledge-shared-artifact-publish',
    schemaVersion: 1,
    mutationAllowed: true,
    executionMode: 'local-file-store',
    workspaceRoot: options.workspaceRoot,
    artifact: {
      inputPath,
      storedPath: storedAbsolutePath,
      registryPath: storedRelativePath.split('\\').join('/'),
      sha256: artifactHash,
      sourceId: unitSet.sourceId,
      sourceKind: unitSet.source.kind,
      sourceName: unitSet.source.name,
      unitCount: unitSet.unitCount,
      privacyScopes: scopes
    },
    registry: {
      path: registryAbsolutePath,
      entryCount: registry.entries.length,
      updatedExistingEntry
    },
    entry,
    warnings: scopes.includes('workspace-private') || scopes.includes('private-run')
      ? ['Artifact includes private units and was published only because --allow-workspace-private was provided.']
      : []
  };
}
