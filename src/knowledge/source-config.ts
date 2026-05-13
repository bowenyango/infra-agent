import { isAbsolute } from 'node:path';
import type { InfraDomainId } from '../types/repository.ts';

const INFRA_DOMAINS: InfraDomainId[] = ['helm', 'pulumi', 'terraform'];
const SECRET_PATH_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;

export function isInfraDomain(value: unknown): value is InfraDomainId {
  return typeof value === 'string' && INFRA_DOMAINS.includes(value as InfraDomainId);
}

export function isSafeWorkspaceRelativePath(value: string): boolean {
  const normalized = value.split('\\').join('/');
  const segments = normalized.split('/');

  return normalized.length > 0
    && normalized !== '.'
    && !isAbsolute(value)
    && !/^[A-Za-z]:\//.test(normalized)
    && !normalized.startsWith('/')
    && !segments.some(segment => segment.length === 0 || segment === '.' || segment === '..')
    && !SECRET_PATH_PATTERN.test(normalized);
}

export function isSecretSafeKnowledgeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && !url.username
      && !url.password
      && !url.search
      && !url.hash
      && !SECRET_PATH_PATTERN.test(value);
  } catch {
    return false;
  }
}

export function targetAllowed(targetPath: string, targetPaths: Set<string>): boolean {
  return targetPaths.size === 0 || targetPaths.has(targetPath);
}
