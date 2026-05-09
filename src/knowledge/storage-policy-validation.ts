import type { KnowledgeStoragePolicySummary } from './storage-policy.ts';
import {
  error,
  isRecord,
  readNonNegativeInteger,
  type KnowledgeValidationIssue
} from './validation-primitives.ts';

export function validateKnowledgeStoragePolicySummary(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): KnowledgeStoragePolicySummary | null {
  if (!isRecord(value)) {
    issues.push(error(path, 'Knowledge storage policy summary must be an object.'));
    return null;
  }

  const publicReference = readNonNegativeInteger(value.publicReference, `${path}.publicReference`, issues);
  const workspacePrivate = readNonNegativeInteger(value.workspacePrivate, `${path}.workspacePrivate`, issues);
  const shareableByDefault = readNonNegativeInteger(value.shareableByDefault, `${path}.shareableByDefault`, issues);
  const explicitOptInRequired = readNonNegativeInteger(value.explicitOptInRequired, `${path}.explicitOptInRequired`, issues);

  if (
    publicReference === null
    || workspacePrivate === null
    || shareableByDefault === null
    || explicitOptInRequired === null
  ) {
    return null;
  }

  return {
    publicReference,
    workspacePrivate,
    shareableByDefault,
    explicitOptInRequired
  };
}
