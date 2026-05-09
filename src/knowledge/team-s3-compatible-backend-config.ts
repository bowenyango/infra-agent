import type {
  KnowledgeTeamBackendConfig
} from './team-backend-readiness.ts';

export type KnowledgeTeamS3CompatibleBackendConfigKind =
  'infra-agent.knowledge-team-s3-compatible-backend-config';
export type KnowledgeTeamS3CompatibleBackendConfigIssueCode =
  | 'backend-detail-leak'
  | 'invalid-config-kind'
  | 'invalid-schema-version'
  | 'live-check-enabled'
  | 'missing-required-field'
  | 'mutation-enabled'
  | 'remote-write-enabled'
  | 'unsafe-config-name'
  | 'unsafe-prefix'
  | 'unsafe-reference'
  | 'unsupported-backend-kind'
  | 'unsupported-credential-mode';

export interface KnowledgeTeamS3CompatibleBackendConfig {
  kind: KnowledgeTeamS3CompatibleBackendConfigKind;
  schemaVersion: 1;
  mutationAllowed: false;
  backendKind: 's3-compatible';
  name: string;
  storageProfileRef: string;
  authProfileRef: string;
  artifactPrefix: 'knowledge-artifacts/v1';
  indexPrefix: 'knowledge-index/v1';
  credentialMode: 'environment';
  remoteWriteDefault: false;
  liveCheckDefault: false;
}

export interface KnowledgeTeamS3CompatibleBackendConfigIssue {
  code: KnowledgeTeamS3CompatibleBackendConfigIssueCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamS3CompatibleBackendConfigParseResult {
  ok: boolean;
  config: KnowledgeTeamS3CompatibleBackendConfig | null;
  issues: KnowledgeTeamS3CompatibleBackendConfigIssue[];
}

export interface KnowledgeTeamS3CompatibleBackendDescriptor {
  kind: 'infra-agent.knowledge-team-s3-compatible-backend-descriptor';
  schemaVersion: 1;
  mutationAllowed: false;
  backendKind: 's3-compatible';
  name: string;
  storageProfileRef: string;
  authProfileRef: string;
  artifactPrefix: 'knowledge-artifacts/v1';
  indexPrefix: 'knowledge-index/v1';
  credentialMode: 'environment';
  capabilities: {
    artifactObjectStore: true;
    metadataIndex: true;
    contentAddressedObjectKeys: true;
    contentAddressedIndexKeys: true;
    idempotentWritesRequired: true;
    explicitUploadApprovalRequired: true;
    remoteWriteAllowed: false;
    liveCheckAllowed: false;
    credentialValuesExposed: false;
    uploadCommand: null;
    dryRunOnly: true;
  };
}

const SAFE_CONFIG_NAME_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
const SAFE_REFERENCE_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,127}$/;
const FORBIDDEN_CONFIG_KEY_PATTERN = /(bucket|endpoint|url|credentialValue|secret|token|password|authorization|header|accessKey|sessionToken|signedUrl)/i;
const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer|access[_-]?key|session[_-]?token)/i;
const BACKEND_URL_PATTERN = /(?:https?:\/\/|s3:\/\/|gs:\/\/|az:\/\/)/i;
const BACKEND_DETAIL_WORD_PATTERN = /\b(?:bucket|endpoint|signed-url)\b/i;
const ABSOLUTE_LOCAL_PATH_PATTERN = /(^|[\s"'=])(?:\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(
  code: KnowledgeTeamS3CompatibleBackendConfigIssueCode,
  path: string,
  message: string
): KnowledgeTeamS3CompatibleBackendConfigIssue {
  return {
    code,
    path,
    message
  };
}

function pushIssueOnce(
  issues: KnowledgeTeamS3CompatibleBackendConfigIssue[],
  nextIssue: KnowledgeTeamS3CompatibleBackendConfigIssue
): void {
  if (!issues.some(entry => entry.code === nextIssue.code && entry.path === nextIssue.path)) {
    issues.push(nextIssue);
  }
}

function validateNoPrivateBackendLeakage(
  value: unknown,
  path: string,
  issues: KnowledgeTeamS3CompatibleBackendConfigIssue[]
): void {
  if (typeof value === 'string') {
    if (
      SECRET_VALUE_PATTERN.test(value)
      || BACKEND_URL_PATTERN.test(value)
      || BACKEND_DETAIL_WORD_PATTERN.test(value)
      || ABSOLUTE_LOCAL_PATH_PATTERN.test(value)
    ) {
      pushIssueOnce(issues, issue(
        'backend-detail-leak',
        '$',
        'S3-compatible backend configs must not expose backend details, credential values, URLs, or absolute local paths.'
      ));
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      validateNoPrivateBackendLeakage(entry, `${path}[${index}]`, issues);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_CONFIG_KEY_PATTERN.test(key) && key !== 'credentialMode') {
      pushIssueOnce(issues, issue(
        'backend-detail-leak',
        '$',
        'S3-compatible backend configs must not expose backend details, credential values, URLs, or absolute local paths.'
      ));
    }
    validateNoPrivateBackendLeakage(entry, `${path}.${key}`, issues);
  }
}

function readSafeString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  pattern: RegExp,
  missingMessage: string,
  unsafeCode: KnowledgeTeamS3CompatibleBackendConfigIssueCode,
  unsafeMessage: string,
  issues: KnowledgeTeamS3CompatibleBackendConfigIssue[]
): string | null {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    issues.push(issue('missing-required-field', path, missingMessage));
    return null;
  }
  if (!pattern.test(value)) {
    issues.push(issue(unsafeCode, path, unsafeMessage));
    return null;
  }
  return value;
}

function readLiteral<TValue extends string | boolean | number>(
  value: unknown,
  expected: TValue,
  path: string,
  code: KnowledgeTeamS3CompatibleBackendConfigIssueCode,
  message: string,
  issues: KnowledgeTeamS3CompatibleBackendConfigIssue[]
): TValue | null {
  if (value !== expected) {
    issues.push(issue(
      typeof value === 'undefined' ? 'missing-required-field' : code,
      path,
      message
    ));
    return null;
  }
  return expected;
}

export function buildKnowledgeTeamS3CompatibleBackendConfig(
  input: Partial<KnowledgeTeamS3CompatibleBackendConfig> = {}
): KnowledgeTeamS3CompatibleBackendConfig {
  const config = {
    kind: 'infra-agent.knowledge-team-s3-compatible-backend-config',
    schemaVersion: 1,
    mutationAllowed: false,
    backendKind: 's3-compatible',
    name: 'team-cache',
    storageProfileRef: 'team-cache-storage',
    authProfileRef: 'team-cache-auth',
    artifactPrefix: 'knowledge-artifacts/v1',
    indexPrefix: 'knowledge-index/v1',
    credentialMode: 'environment',
    remoteWriteDefault: false,
    liveCheckDefault: false,
    ...input
  };
  const parsed = parseKnowledgeTeamS3CompatibleBackendConfig(config);
  if (!parsed.ok || parsed.config === null) {
    throw new Error('S3-compatible backend config draft is not safe.');
  }
  return parsed.config;
}

export function parseKnowledgeTeamS3CompatibleBackendConfig(
  input: unknown
): KnowledgeTeamS3CompatibleBackendConfigParseResult {
  const issues: KnowledgeTeamS3CompatibleBackendConfigIssue[] = [];

  if (!isRecord(input)) {
    issues.push(issue(
      'invalid-config-kind',
      '$',
      'S3-compatible backend config must be a JSON object.'
    ));
  } else {
    validateNoPrivateBackendLeakage(input, '$', issues);
  }

  const record = isRecord(input) ? input : {};
  if (record.kind !== 'infra-agent.knowledge-team-s3-compatible-backend-config') {
    issues.push(issue(
      'invalid-config-kind',
      '$.kind',
      'S3-compatible backend config kind must be infra-agent.knowledge-team-s3-compatible-backend-config.'
    ));
  }
  if (record.schemaVersion !== 1) {
    issues.push(issue(
      'invalid-schema-version',
      '$.schemaVersion',
      'S3-compatible backend config schemaVersion must be 1.'
    ));
  }
  if (record.mutationAllowed !== false) {
    issues.push(issue(
      'mutation-enabled',
      '$.mutationAllowed',
      'S3-compatible backend config mutationAllowed must be false.'
    ));
  }
  if (record.backendKind !== 's3-compatible') {
    issues.push(issue(
      typeof record.backendKind === 'undefined' ? 'missing-required-field' : 'unsupported-backend-kind',
      '$.backendKind',
      'S3-compatible backend config backendKind must be s3-compatible.'
    ));
  }

  const name = readSafeString(
    record,
    'name',
    '$.name',
    SAFE_CONFIG_NAME_PATTERN,
    'S3-compatible backend config requires a non-empty safe name.',
    'unsafe-config-name',
    'S3-compatible backend config name must be a safe lowercase identifier.',
    issues
  );
  const storageProfileRef = readSafeString(
    record,
    'storageProfileRef',
    '$.storageProfileRef',
    SAFE_REFERENCE_PATTERN,
    'S3-compatible backend config requires a storage profile reference.',
    'unsafe-reference',
    'S3-compatible backend config references must be safe lowercase identifiers.',
    issues
  );
  const authProfileRef = readSafeString(
    record,
    'authProfileRef',
    '$.authProfileRef',
    SAFE_REFERENCE_PATTERN,
    'S3-compatible backend config requires an auth profile reference.',
    'unsafe-reference',
    'S3-compatible backend config references must be safe lowercase identifiers.',
    issues
  );
  const artifactPrefix = readLiteral(
    record.artifactPrefix,
    'knowledge-artifacts/v1',
    '$.artifactPrefix',
    'unsafe-prefix',
    'S3-compatible backend config artifactPrefix must be knowledge-artifacts/v1.',
    issues
  );
  const indexPrefix = readLiteral(
    record.indexPrefix,
    'knowledge-index/v1',
    '$.indexPrefix',
    'unsafe-prefix',
    'S3-compatible backend config indexPrefix must be knowledge-index/v1.',
    issues
  );
  const credentialMode = readLiteral(
    record.credentialMode,
    'environment',
    '$.credentialMode',
    'unsupported-credential-mode',
    'S3-compatible backend config uses environment credential lookup only; values are not read here.',
    issues
  );
  const remoteWriteDefault = readLiteral(
    record.remoteWriteDefault,
    false,
    '$.remoteWriteDefault',
    'remote-write-enabled',
    'S3-compatible backend config must keep remote writes disabled by default.',
    issues
  );
  const liveCheckDefault = readLiteral(
    record.liveCheckDefault,
    false,
    '$.liveCheckDefault',
    'live-check-enabled',
    'S3-compatible backend config must keep live checks disabled by default.',
    issues
  );

  if (
    issues.length > 0
    || name === null
    || storageProfileRef === null
    || authProfileRef === null
    || artifactPrefix === null
    || indexPrefix === null
    || credentialMode === null
    || remoteWriteDefault === null
    || liveCheckDefault === null
  ) {
    return {
      ok: false,
      config: null,
      issues
    };
  }

  return {
    ok: true,
    config: {
      kind: 'infra-agent.knowledge-team-s3-compatible-backend-config',
      schemaVersion: 1,
      mutationAllowed: false,
      backendKind: 's3-compatible',
      name,
      storageProfileRef,
      authProfileRef,
      artifactPrefix,
      indexPrefix,
      credentialMode,
      remoteWriteDefault,
      liveCheckDefault
    },
    issues: []
  };
}

export function toKnowledgeTeamBackendReadinessConfig(
  config: KnowledgeTeamS3CompatibleBackendConfig
): KnowledgeTeamBackendConfig {
  return {
    kind: 'infra-agent.knowledge-team-backend-config',
    schemaVersion: 1,
    mutationAllowed: false,
    backendKind: 's3-compatible',
    name: config.name,
    artifactPrefix: config.artifactPrefix,
    indexPrefix: config.indexPrefix,
    credentialMode: config.credentialMode,
    remoteWriteDefault: false,
    liveCheckDefault: false
  };
}

export function buildKnowledgeTeamS3CompatibleBackendDescriptor(
  config: KnowledgeTeamS3CompatibleBackendConfig
): KnowledgeTeamS3CompatibleBackendDescriptor {
  return {
    kind: 'infra-agent.knowledge-team-s3-compatible-backend-descriptor',
    schemaVersion: 1,
    mutationAllowed: false,
    backendKind: 's3-compatible',
    name: config.name,
    storageProfileRef: config.storageProfileRef,
    authProfileRef: config.authProfileRef,
    artifactPrefix: config.artifactPrefix,
    indexPrefix: config.indexPrefix,
    credentialMode: config.credentialMode,
    capabilities: {
      artifactObjectStore: true,
      metadataIndex: true,
      contentAddressedObjectKeys: true,
      contentAddressedIndexKeys: true,
      idempotentWritesRequired: true,
      explicitUploadApprovalRequired: true,
      remoteWriteAllowed: false,
      liveCheckAllowed: false,
      credentialValuesExposed: false,
      uploadCommand: null,
      dryRunOnly: true
    }
  };
}
