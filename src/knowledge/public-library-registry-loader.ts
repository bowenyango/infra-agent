import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  parsePublicLibraryRegistryEntries,
  type PublicLibraryRegistryEntry
} from './public-library-registry.ts';
import {
  isSecretSafeKnowledgeUrl,
  isSafeWorkspaceRelativePath
} from './source-config.ts';
import { validateKnowledgePayload } from './validate.ts';

export type PublicLibraryFetchImpl = (url: string) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  headers: {
    get(name: string): string | null;
  };
  text(): Promise<string>;
}>;

export interface LoadedPublicLibraryRegistry {
  locationKind: 'workspace-path' | 'url';
  registryPath: string;
  path?: string;
  url?: string;
  contentHash: string;
  status: 'read' | 'downloaded';
  entries: PublicLibraryRegistryEntry[];
}

export type ResolvedPublicLibraryArtifactLocation =
  | {
    kind: 'workspace-path';
    path: string;
  }
  | {
    kind: 'url';
    url: string;
    path?: string;
  };

function sha256(content: string | Buffer): string {
  return createHash('sha256')
    .update(content)
    .digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function registryEntryCount(payload: unknown): number {
  if (!isRecord(payload) || !Array.isArray(payload.entries)) {
    return 0;
  }

  return payload.entries.length;
}

function looksLikeHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

async function fetchJsonText(
  url: string,
  fetchImpl: PublicLibraryFetchImpl | undefined,
  label: string
): Promise<string> {
  const resolvedFetch = fetchImpl ?? (fetch as unknown as PublicLibraryFetchImpl);
  const response = await resolvedFetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${label} ${url}: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.length > 0 && !contentType.toLowerCase().includes('json')) {
    throw new Error(`${label} ${url} returned unsupported content type ${contentType}.`);
  }

  return response.text();
}

export async function loadPublicLibraryRegistry(input: {
  registryPath: string;
  fetchImpl?: PublicLibraryFetchImpl;
}): Promise<LoadedPublicLibraryRegistry> {
  const registryUrl = isSecretSafeKnowledgeUrl(input.registryPath)
    ? input.registryPath
    : null;
  if (registryUrl === null && looksLikeHttpUrl(input.registryPath)) {
    throw new Error('Public knowledge library registry URL must be secret-free http(s) without query or fragment.');
  }
  const registryText = registryUrl
    ? await fetchJsonText(registryUrl, input.fetchImpl, 'public knowledge library registry')
    : await readFile(resolve(input.registryPath), 'utf8');
  const registryPath = registryUrl ?? resolve(input.registryPath);
  const payload = JSON.parse(registryText) as unknown;
  const validation = validateKnowledgePayload(payload, registryPath);
  if (!validation.valid || validation.inputKind !== 'infra-agent.public-knowledge-library-registry') {
    const firstIssue = validation.issues[0];
    throw new Error(firstIssue
      ? `Public knowledge library registry is invalid: ${firstIssue.path} ${firstIssue.message}`
      : 'Public knowledge library registry is invalid.');
  }

  const entries = parsePublicLibraryRegistryEntries(payload);
  if (entries.length !== registryEntryCount(payload)) {
    throw new Error('Public knowledge library registry contains entries that could not be parsed.');
  }

  return {
    locationKind: registryUrl ? 'url' : 'workspace-path',
    registryPath,
    ...(registryUrl ? { url: registryUrl } : { path: registryPath }),
    contentHash: sha256(registryText),
    status: registryUrl ? 'downloaded' : 'read',
    entries
  };
}

export function resolvePublicLibraryArtifactLocation(
  entry: PublicLibraryRegistryEntry,
  registry: Pick<LoadedPublicLibraryRegistry, 'locationKind' | 'registryPath'>
): ResolvedPublicLibraryArtifactLocation {
  if (typeof entry.artifact.url === 'string') {
    return {
      kind: 'url',
      url: entry.artifact.url
    };
  }

  if (typeof entry.artifact.path === 'string') {
    if (registry.locationKind === 'url') {
      const url = new URL(entry.artifact.path, registry.registryPath).toString();
      if (!isSecretSafeKnowledgeUrl(url)) {
        throw new Error(`Public knowledge library registry entry ${entry.coordinates} resolves to an unsafe artifact URL.`);
      }

      return {
        kind: 'url',
        url,
        path: entry.artifact.path
      };
    }

    if (!isSafeWorkspaceRelativePath(entry.artifact.path)) {
      throw new Error(`Public knowledge library registry entry ${entry.coordinates} has an unsafe artifact path.`);
    }

    return {
      kind: 'workspace-path',
      path: entry.artifact.path
    };
  }

  throw new Error(`Public knowledge library registry entry ${entry.coordinates} has no downloadable artifact location.`);
}

export async function fetchPublicLibraryJsonBytes(input: {
  url: string;
  fetchImpl?: PublicLibraryFetchImpl;
  label: string;
}): Promise<Buffer> {
  return Buffer.from(await fetchJsonText(input.url, input.fetchImpl, input.label), 'utf8');
}
