export type KnowledgeTeamBackendKind = 's3-compatible';
export type KnowledgeTeamBackendCredentialMode = 'environment';
export type KnowledgeTeamBackendReadinessStatus =
  | 'blocked'
  | 'ready-for-explicit-upload';
export type KnowledgeTeamBackendReadinessNextAction =
  | 'design-explicit-upload'
  | 'fix-backend-config';
export type KnowledgeTeamBackendReadinessBlockerCode =
  | 'backend-detail-leak'
  | 'invalid-config-kind'
  | 'invalid-schema-version'
  | 'live-check-enabled'
  | 'missing-required-field'
  | 'mutation-enabled'
  | 'remote-write-enabled'
  | 'unsafe-config-name'
  | 'unsafe-prefix'
  | 'unsupported-backend-kind'
  | 'unsupported-credential-mode';

export interface KnowledgeTeamBackendConfig {
  kind: 'infra-agent.knowledge-team-backend-config';
  schemaVersion: 1;
  mutationAllowed: false;
  backendKind: KnowledgeTeamBackendKind;
  name: string;
  artifactPrefix: 'knowledge-artifacts/v1';
  indexPrefix: 'knowledge-index/v1';
  credentialMode: KnowledgeTeamBackendCredentialMode;
  remoteWriteDefault: false;
  liveCheckDefault: false;
}

export interface KnowledgeTeamBackendReadinessBlocker {
  code: KnowledgeTeamBackendReadinessBlockerCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamBackendReadinessReport {
  kind: 'infra-agent.knowledge-team-backend-readiness';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  remoteWriteAllowed: false;
  liveCheckAllowed: false;
  credentialValuesExposed: false;
  uploadCommand: null;
  backendKind: KnowledgeTeamBackendKind | 'unsupported';
  config: {
    name: string | null;
    artifactPrefix: 'knowledge-artifacts/v1' | null;
    indexPrefix: 'knowledge-index/v1' | null;
    credentialMode: KnowledgeTeamBackendCredentialMode | 'unsupported' | null;
    remoteWriteDefault: boolean | null;
    liveCheckDefault: boolean | null;
  };
  capabilities: {
    artifactObjectStore: boolean;
    metadataIndex: boolean;
    contentAddressedObjectKeys: boolean;
    contentAddressedIndexKeys: boolean;
    idempotentWritesRequired: boolean;
    explicitUploadApprovalRequired: boolean;
    dryRunOnly: true;
  };
  readiness: {
    status: KnowledgeTeamBackendReadinessStatus;
    nextAction: KnowledgeTeamBackendReadinessNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamBackendReadinessBlockerCode[];
    blockers: KnowledgeTeamBackendReadinessBlocker[];
    reason: string;
  };
}

const SAFE_CONFIG_NAME_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
const FORBIDDEN_BACKEND_CONFIG_KEY_PATTERN = /(bucket|endpoint|url|credentialValue|secret|token|password|authorization|header|accessKey|sessionToken)/i;
const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const BACKEND_URL_PATTERN = /(?:https?:\/\/|s3:\/\/|gs:\/\/|az:\/\/)/i;
const ABSOLUTE_LOCAL_PATH_PATTERN = /(^|[\s"'=])(?:\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function blocker(
  code: KnowledgeTeamBackendReadinessBlockerCode,
  path: string,
  message: string
): KnowledgeTeamBackendReadinessBlocker {
  return {
    code,
    path,
    message
  };
}

function hasBlocker(
  blockers: KnowledgeTeamBackendReadinessBlocker[],
  code: KnowledgeTeamBackendReadinessBlockerCode,
  path: string
): boolean {
  return blockers.some(entry => entry.code === code && entry.path === path);
}

function pushBlocker(
  blockers: KnowledgeTeamBackendReadinessBlocker[],
  entry: KnowledgeTeamBackendReadinessBlocker
): void {
  if (!hasBlocker(blockers, entry.code, entry.path)) {
    blockers.push(entry);
  }
}

function validateNoBackendConfigLeakage(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamBackendReadinessBlocker[]
): void {
  if (typeof value === 'string') {
    if (
      SECRET_VALUE_PATTERN.test(value)
      || BACKEND_URL_PATTERN.test(value)
      || ABSOLUTE_LOCAL_PATH_PATTERN.test(value)
    ) {
      pushBlocker(blockers, blocker(
        'backend-detail-leak',
        '$.config',
        'Team backend readiness configs must not expose backend detail, credential values, or absolute local paths.'
      ));
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      validateNoBackendConfigLeakage(entry, `${path}[${index}]`, blockers);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    if (FORBIDDEN_BACKEND_CONFIG_KEY_PATTERN.test(key) && key !== 'credentialMode') {
      pushBlocker(blockers, blocker(
        'backend-detail-leak',
        '$.config',
        'Team backend readiness configs must not expose backend detail, credential values, or absolute local paths.'
      ));
    }
    validateNoBackendConfigLeakage(entry, entryPath, blockers);
  }
}

function readSafeName(value: unknown, path: string, blockers: KnowledgeTeamBackendReadinessBlocker[]): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    pushBlocker(blockers, blocker(
      'missing-required-field',
      path,
      'Team backend readiness config requires a non-empty safe name.'
    ));
    return null;
  }

  if (!SAFE_CONFIG_NAME_PATTERN.test(value)) {
    pushBlocker(blockers, blocker(
      'unsafe-config-name',
      path,
      'Team backend readiness config name must be a safe lowercase identifier.'
    ));
    return null;
  }

  return value;
}

function readLiteralPrefix<TPrefix extends 'knowledge-artifacts/v1' | 'knowledge-index/v1'>(
  value: unknown,
  expected: TPrefix,
  path: string,
  blockers: KnowledgeTeamBackendReadinessBlocker[]
): TPrefix | null {
  if (value !== expected) {
    pushBlocker(blockers, blocker(
      typeof value === 'undefined' ? 'missing-required-field' : 'unsafe-prefix',
      path,
      `Team backend readiness config ${path} must be ${expected}.`
    ));
    return null;
  }

  return expected;
}

function readBooleanFlag(
  value: unknown,
  expected: false,
  path: string,
  code: KnowledgeTeamBackendReadinessBlockerCode,
  blockers: KnowledgeTeamBackendReadinessBlocker[]
): boolean | null {
  if (typeof value !== 'boolean') {
    pushBlocker(blockers, blocker(
      'missing-required-field',
      path,
      'Team backend readiness config requires this boolean flag.'
    ));
    return null;
  }

  if (value !== expected) {
    pushBlocker(blockers, blocker(
      code,
      path,
      'Team backend readiness config must keep remote mutation and live checks disabled by default.'
    ));
  }

  return value;
}

function readinessReason(status: KnowledgeTeamBackendReadinessStatus): string {
  return status === 'ready-for-explicit-upload'
    ? 'Backend config is structurally ready for a future explicit upload design; no upload is approved or executed.'
    : 'Backend config must be fixed before a future explicit upload design can use it.';
}

export function buildKnowledgeTeamBackendReadinessReport(
  config: unknown
): KnowledgeTeamBackendReadinessReport {
  const blockers: KnowledgeTeamBackendReadinessBlocker[] = [];

  if (!isRecord(config)) {
    pushBlocker(blockers, blocker(
      'invalid-config-kind',
      '$',
      'Team backend readiness requires a JSON object config.'
    ));
  } else {
    validateNoBackendConfigLeakage(config, '$', blockers);
  }

  const configRecord = isRecord(config) ? config : {};

  if (configRecord.kind !== 'infra-agent.knowledge-team-backend-config') {
    pushBlocker(blockers, blocker(
      'invalid-config-kind',
      '$.kind',
      'Team backend readiness config kind must be infra-agent.knowledge-team-backend-config.'
    ));
  }
  if (configRecord.schemaVersion !== 1) {
    pushBlocker(blockers, blocker(
      'invalid-schema-version',
      '$.schemaVersion',
      'Team backend readiness config schemaVersion must be 1.'
    ));
  }
  if (configRecord.mutationAllowed !== false) {
    pushBlocker(blockers, blocker(
      'mutation-enabled',
      '$.mutationAllowed',
      'Team backend readiness config mutationAllowed must be false.'
    ));
  }

  const backendKind = configRecord.backendKind === 's3-compatible'
    ? 's3-compatible'
    : 'unsupported';
  if (backendKind === 'unsupported') {
    pushBlocker(blockers, blocker(
      typeof configRecord.backendKind === 'undefined' ? 'missing-required-field' : 'unsupported-backend-kind',
      '$.backendKind',
      'Team backend readiness currently supports s3-compatible configs only.'
    ));
  }

  const credentialMode = configRecord.credentialMode === 'environment'
    ? 'environment'
    : typeof configRecord.credentialMode === 'undefined'
      ? null
      : 'unsupported';
  if (credentialMode !== 'environment') {
    pushBlocker(blockers, blocker(
      credentialMode === null ? 'missing-required-field' : 'unsupported-credential-mode',
      '$.credentialMode',
      'Team backend readiness requires environment-based credentials without credential values in config.'
    ));
  }

  const name = readSafeName(configRecord.name, '$.name', blockers);
  const artifactPrefix = readLiteralPrefix(
    configRecord.artifactPrefix,
    'knowledge-artifacts/v1',
    '$.artifactPrefix',
    blockers
  );
  const indexPrefix = readLiteralPrefix(
    configRecord.indexPrefix,
    'knowledge-index/v1',
    '$.indexPrefix',
    blockers
  );
  const remoteWriteDefault = readBooleanFlag(
    configRecord.remoteWriteDefault,
    false,
    '$.remoteWriteDefault',
    'remote-write-enabled',
    blockers
  );
  const liveCheckDefault = readBooleanFlag(
    configRecord.liveCheckDefault,
    false,
    '$.liveCheckDefault',
    'live-check-enabled',
    blockers
  );

  const blockerCodes = [...new Set(blockers.map(entry => entry.code))].sort();
  const status: KnowledgeTeamBackendReadinessStatus = blockers.length === 0
    ? 'ready-for-explicit-upload'
    : 'blocked';

  return {
    kind: 'infra-agent.knowledge-team-backend-readiness',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    remoteWriteAllowed: false,
    liveCheckAllowed: false,
    credentialValuesExposed: false,
    uploadCommand: null,
    backendKind,
    config: {
      name,
      artifactPrefix,
      indexPrefix,
      credentialMode,
      remoteWriteDefault,
      liveCheckDefault
    },
    capabilities: {
      artifactObjectStore: backendKind === 's3-compatible',
      metadataIndex: backendKind === 's3-compatible',
      contentAddressedObjectKeys: artifactPrefix === 'knowledge-artifacts/v1',
      contentAddressedIndexKeys: indexPrefix === 'knowledge-index/v1',
      idempotentWritesRequired: true,
      explicitUploadApprovalRequired: true,
      dryRunOnly: true
    },
    readiness: {
      status,
      nextAction: status === 'ready-for-explicit-upload'
        ? 'design-explicit-upload'
        : 'fix-backend-config',
      blockerCount: blockers.length,
      blockerCodes,
      blockers,
      reason: readinessReason(status)
    }
  };
}
