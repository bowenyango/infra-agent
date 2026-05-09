import {
  createMockKnowledgeTeamBackendAdapter
} from './team-backend-adapter-mock.ts';
import {
  isSafeKnowledgeTeamBackendAdapterName,
  type KnowledgeTeamBackendAdapter
} from './team-backend-adapter.ts';

export type KnowledgeTeamBackendAdapterConfigKind = 'infra-agent.knowledge-team-backend-adapter-config';
export type KnowledgeTeamBackendAdapterResolutionIssueCode =
  | 'backend-detail-leak'
  | 'credential-mode-enabled'
  | 'invalid-config-kind'
  | 'invalid-schema-version'
  | 'live-check-enabled'
  | 'missing-required-field'
  | 'mutation-enabled'
  | 'remote-write-enabled'
  | 'unsafe-adapter-name'
  | 'unsupported-backend-kind';

export interface KnowledgeTeamBackendAdapterConfig {
  kind: KnowledgeTeamBackendAdapterConfigKind;
  schemaVersion: 1;
  mutationAllowed: false;
  backendKind: 'mock-s3-compatible';
  name: string;
  credentialMode: 'none';
  remoteWriteAllowed: false;
  liveCheckAllowed: false;
}

export interface KnowledgeTeamBackendAdapterResolutionIssue {
  code: KnowledgeTeamBackendAdapterResolutionIssueCode;
  path: string;
  message: string;
}

export class KnowledgeTeamBackendAdapterResolutionError extends Error {
  readonly issues: KnowledgeTeamBackendAdapterResolutionIssue[];

  constructor(issues: KnowledgeTeamBackendAdapterResolutionIssue[]) {
    super('Knowledge team backend adapter config is not safe to resolve.');
    this.name = 'KnowledgeTeamBackendAdapterResolutionError';
    this.issues = issues;
  }
}

const FORBIDDEN_ADAPTER_CONFIG_KEY_PATTERN = /(bucket|endpoint|url|credentialValue|secret|token|password|authorization|header|accessKey|sessionToken)/i;
const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const BACKEND_URL_PATTERN = /(?:https?:\/\/|s3:\/\/|gs:\/\/|az:\/\/)/i;
const ABSOLUTE_LOCAL_PATH_PATTERN = /(^|[\s"'=])(?:\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(
  code: KnowledgeTeamBackendAdapterResolutionIssueCode,
  path: string,
  message: string
): KnowledgeTeamBackendAdapterResolutionIssue {
  return {
    code,
    path,
    message
  };
}

function pushIssueOnce(
  issues: KnowledgeTeamBackendAdapterResolutionIssue[],
  nextIssue: KnowledgeTeamBackendAdapterResolutionIssue
): void {
  if (!issues.some(entry => entry.code === nextIssue.code && entry.path === nextIssue.path)) {
    issues.push(nextIssue);
  }
}

function validateNoAdapterConfigLeakage(
  value: unknown,
  path: string,
  issues: KnowledgeTeamBackendAdapterResolutionIssue[]
): void {
  if (typeof value === 'string') {
    if (
      SECRET_VALUE_PATTERN.test(value)
      || BACKEND_URL_PATTERN.test(value)
      || ABSOLUTE_LOCAL_PATH_PATTERN.test(value)
    ) {
      pushIssueOnce(issues, issue(
        'backend-detail-leak',
        '$',
        'Knowledge team backend adapter configs must not expose backend detail, credential values, or absolute local paths.'
      ));
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      validateNoAdapterConfigLeakage(entry, `${path}[${index}]`, issues);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    if (FORBIDDEN_ADAPTER_CONFIG_KEY_PATTERN.test(key) && key !== 'credentialMode') {
      pushIssueOnce(issues, issue(
        'backend-detail-leak',
        '$',
        'Knowledge team backend adapter configs must not expose backend detail, credential values, or absolute local paths.'
      ));
    }
    validateNoAdapterConfigLeakage(entry, entryPath, issues);
  }
}

export function buildMockKnowledgeTeamBackendAdapterConfig(
  name = 'mock-team-cache'
): KnowledgeTeamBackendAdapterConfig {
  if (!isSafeKnowledgeTeamBackendAdapterName(name)) {
    throw new Error('Knowledge team backend adapter name must be a safe lowercase identifier.');
  }

  return {
    kind: 'infra-agent.knowledge-team-backend-adapter-config',
    schemaVersion: 1,
    mutationAllowed: false,
    backendKind: 'mock-s3-compatible',
    name,
    credentialMode: 'none',
    remoteWriteAllowed: false,
    liveCheckAllowed: false
  };
}

export function resolveKnowledgeTeamBackendAdapter(config: unknown): KnowledgeTeamBackendAdapter {
  const issues: KnowledgeTeamBackendAdapterResolutionIssue[] = [];

  if (!isRecord(config)) {
    issues.push(issue(
      'invalid-config-kind',
      '$',
      'Knowledge team backend adapter config must be a JSON object.'
    ));
  } else {
    validateNoAdapterConfigLeakage(config, '$', issues);
  }

  const record = isRecord(config) ? config : {};
  if (record.kind !== 'infra-agent.knowledge-team-backend-adapter-config') {
    issues.push(issue(
      'invalid-config-kind',
      '$.kind',
      'Knowledge team backend adapter config kind must be infra-agent.knowledge-team-backend-adapter-config.'
    ));
  }
  if (record.schemaVersion !== 1) {
    issues.push(issue(
      'invalid-schema-version',
      '$.schemaVersion',
      'Knowledge team backend adapter config schemaVersion must be 1.'
    ));
  }
  if (record.mutationAllowed !== false) {
    issues.push(issue(
      'mutation-enabled',
      '$.mutationAllowed',
      'Knowledge team backend adapter config mutationAllowed must be false.'
    ));
  }
  if (record.backendKind !== 'mock-s3-compatible') {
    issues.push(issue(
      typeof record.backendKind === 'undefined' ? 'missing-required-field' : 'unsupported-backend-kind',
      '$.backendKind',
      'Only mock-s3-compatible backend adapters can be resolved in-process.'
    ));
  }
  if (typeof record.name !== 'string' || !isSafeKnowledgeTeamBackendAdapterName(record.name)) {
    issues.push(issue(
      typeof record.name === 'undefined' ? 'missing-required-field' : 'unsafe-adapter-name',
      '$.name',
      'Knowledge team backend adapter name must be a safe lowercase identifier.'
    ));
  }
  if (record.credentialMode !== 'none') {
    issues.push(issue(
      typeof record.credentialMode === 'undefined' ? 'missing-required-field' : 'credential-mode-enabled',
      '$.credentialMode',
      'Knowledge team backend adapter resolver does not read credentials.'
    ));
  }
  if (record.remoteWriteAllowed !== false) {
    issues.push(issue(
      typeof record.remoteWriteAllowed === 'undefined' ? 'missing-required-field' : 'remote-write-enabled',
      '$.remoteWriteAllowed',
      'Knowledge team backend adapter resolver must keep remote writes disabled.'
    ));
  }
  if (record.liveCheckAllowed !== false) {
    issues.push(issue(
      typeof record.liveCheckAllowed === 'undefined' ? 'missing-required-field' : 'live-check-enabled',
      '$.liveCheckAllowed',
      'Knowledge team backend adapter resolver must keep live checks disabled.'
    ));
  }

  if (issues.length > 0) {
    throw new KnowledgeTeamBackendAdapterResolutionError(issues);
  }

  return createMockKnowledgeTeamBackendAdapter({
    name: record.name as string
  });
}
