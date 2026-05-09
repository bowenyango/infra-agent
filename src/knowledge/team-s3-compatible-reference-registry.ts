import {
  parseKnowledgeTeamS3CompatibleBackendConfig,
  type KnowledgeTeamS3CompatibleBackendConfig,
  type KnowledgeTeamS3CompatibleBackendConfigIssueCode
} from './team-s3-compatible-backend-config.ts';

export type KnowledgeTeamS3CompatibleReferenceRegistryKind =
  'infra-agent.knowledge-team-s3-compatible-reference-registry';

export type KnowledgeTeamS3CompatibleReferenceRegistryIssueCode =
  | 'backend-detail-leak'
  | 'duplicate-reference'
  | 'invalid-registry-kind'
  | 'invalid-schema-version'
  | 'missing-required-field'
  | 'mutation-enabled'
  | 'unsafe-env-var-name'
  | 'unsafe-reference'
  | 'unsupported-field';

export type KnowledgeTeamS3CompatibleReferenceValidationIssueCode =
  | KnowledgeTeamS3CompatibleBackendConfigIssueCode
  | KnowledgeTeamS3CompatibleReferenceRegistryIssueCode
  | 'missing-auth-profile-reference'
  | 'missing-storage-profile-reference';

export interface KnowledgeTeamS3CompatibleStorageProfileReference {
  ref: string;
  endpointUrlEnvVar: string;
  bucketNameEnvVar: string;
  regionEnvVar: string;
}

export interface KnowledgeTeamS3CompatibleAuthProfileReference {
  ref: string;
  accessKeyIdEnvVar: string;
  secretAccessKeyEnvVar: string;
  sessionTokenEnvVar?: string;
}

export interface KnowledgeTeamS3CompatibleReferenceRegistry {
  kind: KnowledgeTeamS3CompatibleReferenceRegistryKind;
  schemaVersion: 1;
  mutationAllowed: false;
  storageProfiles: KnowledgeTeamS3CompatibleStorageProfileReference[];
  authProfiles: KnowledgeTeamS3CompatibleAuthProfileReference[];
}

export interface KnowledgeTeamS3CompatibleReferenceRegistryIssue {
  code: KnowledgeTeamS3CompatibleReferenceRegistryIssueCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamS3CompatibleReferenceRegistryParseResult {
  ok: boolean;
  registry: KnowledgeTeamS3CompatibleReferenceRegistry | null;
  issues: KnowledgeTeamS3CompatibleReferenceRegistryIssue[];
}

export interface KnowledgeTeamS3CompatibleReferenceValidationIssue {
  code: KnowledgeTeamS3CompatibleReferenceValidationIssueCode;
  path: string;
  message: string;
}

export interface KnowledgeTeamS3CompatibleReferenceValidationSummary {
  kind: 'infra-agent.knowledge-team-s3-compatible-reference-validation';
  schemaVersion: 1;
  mutationAllowed: false;
  status: 'blocked' | 'valid';
  backendKind: 's3-compatible' | 'unsupported';
  configName: string | null;
  storageProfileRef: string | null;
  authProfileRef: string | null;
  requiredEnvironmentVariables: string[];
  optionalEnvironmentVariables: string[];
  capabilities: {
    remoteWriteAllowed: false;
    liveCheckAllowed: false;
    credentialValuesExposed: false;
    uploadCommand: null;
    dryRunOnly: true;
  };
  issueCodes: KnowledgeTeamS3CompatibleReferenceValidationIssueCode[];
  issues: KnowledgeTeamS3CompatibleReferenceValidationIssue[];
  reason: string;
}

const SAFE_REFERENCE_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,127}$/;
const SAFE_ENV_VAR_NAME_PATTERN = /^[A-Z_][A-Z0-9_]{0,127}$/;
const BACKEND_URL_PATTERN = /(?:https?:\/\/|s3:\/\/|gs:\/\/|az:\/\/)/i;
const ABSOLUTE_LOCAL_PATH_PATTERN = /(^|[\s"'=])(?:\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/;
const INLINE_ASSIGNMENT_PATTERN = /=/;
const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer|access[_-]?key|session[_-]?token)/i;
const LEAKY_UNSUPPORTED_KEY_PATTERN = /(bucket|endpoint|url|credentialValue|secret|token|password|authorization|header|accessKey|sessionToken|signedUrl)/i;

const ALLOWED_ROOT_KEYS = new Set([
  'kind',
  'schemaVersion',
  'mutationAllowed',
  'storageProfiles',
  'authProfiles'
]);
const ALLOWED_STORAGE_PROFILE_KEYS = new Set([
  'ref',
  'endpointUrlEnvVar',
  'bucketNameEnvVar',
  'regionEnvVar'
]);
const ALLOWED_AUTH_PROFILE_KEYS = new Set([
  'ref',
  'accessKeyIdEnvVar',
  'secretAccessKeyEnvVar',
  'sessionTokenEnvVar'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(
  code: KnowledgeTeamS3CompatibleReferenceRegistryIssueCode,
  path: string,
  message: string
): KnowledgeTeamS3CompatibleReferenceRegistryIssue {
  return {
    code,
    path,
    message
  };
}

function validationIssue(
  code: KnowledgeTeamS3CompatibleReferenceValidationIssueCode,
  path: string,
  message: string
): KnowledgeTeamS3CompatibleReferenceValidationIssue {
  return {
    code,
    path,
    message
  };
}

function pushIssueOnce(
  issues: KnowledgeTeamS3CompatibleReferenceRegistryIssue[],
  nextIssue: KnowledgeTeamS3CompatibleReferenceRegistryIssue
): void {
  if (!issues.some(entry => entry.code === nextIssue.code && entry.path === nextIssue.path)) {
    issues.push(nextIssue);
  }
}

function looksLikePrivateBackendValue(value: string): boolean {
  return BACKEND_URL_PATTERN.test(value)
    || ABSOLUTE_LOCAL_PATH_PATTERN.test(value)
    || INLINE_ASSIGNMENT_PATTERN.test(value)
    || SECRET_VALUE_PATTERN.test(value);
}

function validateUnsupportedValueNoLeakage(
  value: unknown,
  path: string,
  issues: KnowledgeTeamS3CompatibleReferenceRegistryIssue[]
): void {
  if (typeof value === 'string') {
    if (looksLikePrivateBackendValue(value)) {
      pushIssueOnce(issues, issue(
        'backend-detail-leak',
        '$',
        'S3-compatible reference registries must not expose backend details, credential values, URLs, or absolute local paths.'
      ));
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      validateUnsupportedValueNoLeakage(entry, `${path}[${index}]`, issues);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (LEAKY_UNSUPPORTED_KEY_PATTERN.test(key)) {
      pushIssueOnce(issues, issue(
        'backend-detail-leak',
        '$',
        'S3-compatible reference registries must not expose backend details, credential values, URLs, or absolute local paths.'
      ));
    }
    validateUnsupportedValueNoLeakage(entry, `${path}.${key}`, issues);
  }
}

function validateAllowedKeys(
  record: Record<string, unknown>,
  allowedKeys: Set<string>,
  path: string,
  issues: KnowledgeTeamS3CompatibleReferenceRegistryIssue[]
): void {
  for (const [key, value] of Object.entries(record)) {
    if (allowedKeys.has(key)) {
      continue;
    }
    if (LEAKY_UNSUPPORTED_KEY_PATTERN.test(key)) {
      pushIssueOnce(issues, issue(
        'backend-detail-leak',
        '$',
        'S3-compatible reference registries must not expose backend details, credential values, URLs, or absolute local paths.'
      ));
    } else {
      issues.push(issue(
        'unsupported-field',
        `${path}.${key}`,
        'S3-compatible reference registry contains an unsupported field.'
      ));
    }
    validateUnsupportedValueNoLeakage(value, `${path}.${key}`, issues);
  }
}

function readReferenceName(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: KnowledgeTeamS3CompatibleReferenceRegistryIssue[]
): string | null {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    issues.push(issue(
      'missing-required-field',
      path,
      'S3-compatible reference registry entries require a safe reference name.'
    ));
    return null;
  }
  if (!SAFE_REFERENCE_PATTERN.test(value)) {
    issues.push(issue(
      'unsafe-reference',
      path,
      'S3-compatible reference registry references must be safe lowercase identifiers.'
    ));
    return null;
  }
  return value;
}

function readEnvVarName(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: KnowledgeTeamS3CompatibleReferenceRegistryIssue[],
  required: boolean
): string | null {
  const value = record[key];
  if (typeof value === 'undefined' && !required) {
    return null;
  }
  if (typeof value !== 'string' || value.length === 0) {
    issues.push(issue(
      'missing-required-field',
      path,
      'S3-compatible reference registry entries require environment variable names.'
    ));
    return null;
  }
  if (!SAFE_ENV_VAR_NAME_PATTERN.test(value)) {
    issues.push(issue(
      'unsafe-env-var-name',
      path,
      'S3-compatible reference registry environment variable names must be uppercase identifiers.'
    ));
    if (looksLikePrivateBackendValue(value)) {
      pushIssueOnce(issues, issue(
        'backend-detail-leak',
        '$',
        'S3-compatible reference registries must not expose backend details, credential values, URLs, or absolute local paths.'
      ));
    }
    return null;
  }
  return value;
}

function uniqueInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

function findDuplicateRefs<TEntry extends { ref: string }>(
  entries: TEntry[],
  path: string,
  issues: KnowledgeTeamS3CompatibleReferenceRegistryIssue[]
): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.ref)) {
      issues.push(issue(
        'duplicate-reference',
        path,
        'S3-compatible reference registry entries must not duplicate references.'
      ));
      return;
    }
    seen.add(entry.ref);
  }
}

function parseStorageProfile(
  entry: unknown,
  path: string,
  issues: KnowledgeTeamS3CompatibleReferenceRegistryIssue[]
): KnowledgeTeamS3CompatibleStorageProfileReference | null {
  if (!isRecord(entry)) {
    issues.push(issue(
      'missing-required-field',
      path,
      'S3-compatible storage profile references must be JSON objects.'
    ));
    return null;
  }
  validateAllowedKeys(entry, ALLOWED_STORAGE_PROFILE_KEYS, path, issues);

  const ref = readReferenceName(entry, 'ref', `${path}.ref`, issues);
  const endpointUrlEnvVar = readEnvVarName(
    entry,
    'endpointUrlEnvVar',
    `${path}.endpointUrlEnvVar`,
    issues,
    true
  );
  const bucketNameEnvVar = readEnvVarName(
    entry,
    'bucketNameEnvVar',
    `${path}.bucketNameEnvVar`,
    issues,
    true
  );
  const regionEnvVar = readEnvVarName(
    entry,
    'regionEnvVar',
    `${path}.regionEnvVar`,
    issues,
    true
  );

  if (ref === null || endpointUrlEnvVar === null || bucketNameEnvVar === null || regionEnvVar === null) {
    return null;
  }

  return {
    ref,
    endpointUrlEnvVar,
    bucketNameEnvVar,
    regionEnvVar
  };
}

function parseAuthProfile(
  entry: unknown,
  path: string,
  issues: KnowledgeTeamS3CompatibleReferenceRegistryIssue[]
): KnowledgeTeamS3CompatibleAuthProfileReference | null {
  if (!isRecord(entry)) {
    issues.push(issue(
      'missing-required-field',
      path,
      'S3-compatible auth profile references must be JSON objects.'
    ));
    return null;
  }
  validateAllowedKeys(entry, ALLOWED_AUTH_PROFILE_KEYS, path, issues);

  const ref = readReferenceName(entry, 'ref', `${path}.ref`, issues);
  const accessKeyIdEnvVar = readEnvVarName(
    entry,
    'accessKeyIdEnvVar',
    `${path}.accessKeyIdEnvVar`,
    issues,
    true
  );
  const secretAccessKeyEnvVar = readEnvVarName(
    entry,
    'secretAccessKeyEnvVar',
    `${path}.secretAccessKeyEnvVar`,
    issues,
    true
  );
  const sessionTokenEnvVar = readEnvVarName(
    entry,
    'sessionTokenEnvVar',
    `${path}.sessionTokenEnvVar`,
    issues,
    false
  );

  if (ref === null || accessKeyIdEnvVar === null || secretAccessKeyEnvVar === null) {
    return null;
  }

  const profile: KnowledgeTeamS3CompatibleAuthProfileReference = {
    ref,
    accessKeyIdEnvVar,
    secretAccessKeyEnvVar
  };
  if (sessionTokenEnvVar !== null) {
    profile.sessionTokenEnvVar = sessionTokenEnvVar;
  }
  return profile;
}

function pushValidationIssues(
  target: KnowledgeTeamS3CompatibleReferenceValidationIssue[],
  issues: Array<{
    code: KnowledgeTeamS3CompatibleReferenceValidationIssueCode;
    path: string;
    message: string;
  }>
): void {
  for (const entry of issues) {
    target.push(validationIssue(entry.code, entry.path, entry.message));
  }
}

function buildReferenceValidationSummary(input: {
  status: KnowledgeTeamS3CompatibleReferenceValidationSummary['status'];
  backendKind: KnowledgeTeamS3CompatibleReferenceValidationSummary['backendKind'];
  config: KnowledgeTeamS3CompatibleBackendConfig | null;
  requiredEnvironmentVariables: string[];
  optionalEnvironmentVariables: string[];
  issues: KnowledgeTeamS3CompatibleReferenceValidationIssue[];
  reason: string;
}): KnowledgeTeamS3CompatibleReferenceValidationSummary {
  return {
    kind: 'infra-agent.knowledge-team-s3-compatible-reference-validation',
    schemaVersion: 1,
    mutationAllowed: false,
    status: input.status,
    backendKind: input.backendKind,
    configName: input.config?.name ?? null,
    storageProfileRef: input.config?.storageProfileRef ?? null,
    authProfileRef: input.config?.authProfileRef ?? null,
    requiredEnvironmentVariables: uniqueInOrder(input.requiredEnvironmentVariables),
    optionalEnvironmentVariables: uniqueInOrder(input.optionalEnvironmentVariables),
    capabilities: {
      remoteWriteAllowed: false,
      liveCheckAllowed: false,
      credentialValuesExposed: false,
      uploadCommand: null,
      dryRunOnly: true
    },
    issueCodes: [...new Set(input.issues.map(entry => entry.code))].sort(),
    issues: input.issues,
    reason: input.reason
  };
}

export function buildKnowledgeTeamS3CompatibleReferenceRegistry(
  input: Partial<KnowledgeTeamS3CompatibleReferenceRegistry> = {}
): KnowledgeTeamS3CompatibleReferenceRegistry {
  const registry = {
    kind: 'infra-agent.knowledge-team-s3-compatible-reference-registry',
    schemaVersion: 1,
    mutationAllowed: false,
    storageProfiles: [
      {
        ref: 'team-cache-storage',
        endpointUrlEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_ENDPOINT_URL',
        bucketNameEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_BUCKET_NAME',
        regionEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_REGION'
      }
    ],
    authProfiles: [
      {
        ref: 'team-cache-auth',
        accessKeyIdEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_ACCESS_KEY_ID',
        secretAccessKeyEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_SECRET_ACCESS_KEY',
        sessionTokenEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_SESSION_TOKEN'
      }
    ],
    ...input
  };
  const parsed = parseKnowledgeTeamS3CompatibleReferenceRegistry(registry);
  if (!parsed.ok || parsed.registry === null) {
    throw new Error('S3-compatible reference registry draft is not safe.');
  }
  return parsed.registry;
}

export function parseKnowledgeTeamS3CompatibleReferenceRegistry(
  input: unknown
): KnowledgeTeamS3CompatibleReferenceRegistryParseResult {
  const issues: KnowledgeTeamS3CompatibleReferenceRegistryIssue[] = [];

  if (!isRecord(input)) {
    issues.push(issue(
      'invalid-registry-kind',
      '$',
      'S3-compatible reference registry must be a JSON object.'
    ));
  }

  const record = isRecord(input) ? input : {};
  if (isRecord(input)) {
    validateAllowedKeys(record, ALLOWED_ROOT_KEYS, '$', issues);
  }
  if (record.kind !== 'infra-agent.knowledge-team-s3-compatible-reference-registry') {
    issues.push(issue(
      'invalid-registry-kind',
      '$.kind',
      'S3-compatible reference registry kind must be infra-agent.knowledge-team-s3-compatible-reference-registry.'
    ));
  }
  if (record.schemaVersion !== 1) {
    issues.push(issue(
      'invalid-schema-version',
      '$.schemaVersion',
      'S3-compatible reference registry schemaVersion must be 1.'
    ));
  }
  if (record.mutationAllowed !== false) {
    issues.push(issue(
      'mutation-enabled',
      '$.mutationAllowed',
      'S3-compatible reference registry mutationAllowed must be false.'
    ));
  }

  const storageProfiles: KnowledgeTeamS3CompatibleStorageProfileReference[] = [];
  if (!Array.isArray(record.storageProfiles) || record.storageProfiles.length === 0) {
    issues.push(issue(
      'missing-required-field',
      '$.storageProfiles',
      'S3-compatible reference registry requires at least one storage profile reference.'
    ));
  } else {
    record.storageProfiles.forEach((entry, index) => {
      const profile = parseStorageProfile(entry, `$.storageProfiles[${index}]`, issues);
      if (profile !== null) {
        storageProfiles.push(profile);
      }
    });
  }

  const authProfiles: KnowledgeTeamS3CompatibleAuthProfileReference[] = [];
  if (!Array.isArray(record.authProfiles) || record.authProfiles.length === 0) {
    issues.push(issue(
      'missing-required-field',
      '$.authProfiles',
      'S3-compatible reference registry requires at least one auth profile reference.'
    ));
  } else {
    record.authProfiles.forEach((entry, index) => {
      const profile = parseAuthProfile(entry, `$.authProfiles[${index}]`, issues);
      if (profile !== null) {
        authProfiles.push(profile);
      }
    });
  }

  findDuplicateRefs(storageProfiles, '$.storageProfiles', issues);
  findDuplicateRefs(authProfiles, '$.authProfiles', issues);

  if (issues.length > 0) {
    return {
      ok: false,
      registry: null,
      issues
    };
  }

  return {
    ok: true,
    registry: {
      kind: 'infra-agent.knowledge-team-s3-compatible-reference-registry',
      schemaVersion: 1,
      mutationAllowed: false,
      storageProfiles,
      authProfiles
    },
    issues: []
  };
}

export function validateKnowledgeTeamS3CompatibleBackendReferences(
  configInput: unknown,
  registryInput: unknown
): KnowledgeTeamS3CompatibleReferenceValidationSummary {
  const parsedConfig = parseKnowledgeTeamS3CompatibleBackendConfig(configInput);
  const parsedRegistry = parseKnowledgeTeamS3CompatibleReferenceRegistry(registryInput);
  const issues: KnowledgeTeamS3CompatibleReferenceValidationIssue[] = [];
  pushValidationIssues(issues, parsedConfig.issues);
  pushValidationIssues(issues, parsedRegistry.issues);

  const requiredEnvironmentVariables: string[] = [];
  const optionalEnvironmentVariables: string[] = [];

  if (parsedConfig.ok && parsedConfig.config !== null && parsedRegistry.ok && parsedRegistry.registry !== null) {
    const storageProfile = parsedRegistry.registry.storageProfiles.find(
      entry => entry.ref === parsedConfig.config?.storageProfileRef
    ) ?? null;
    const authProfile = parsedRegistry.registry.authProfiles.find(
      entry => entry.ref === parsedConfig.config?.authProfileRef
    ) ?? null;

    if (storageProfile === null) {
      issues.push(validationIssue(
        'missing-storage-profile-reference',
        '$.storageProfileRef',
        'S3-compatible backend config storageProfileRef is not present in the reference registry.'
      ));
    } else {
      requiredEnvironmentVariables.push(
        storageProfile.endpointUrlEnvVar,
        storageProfile.bucketNameEnvVar,
        storageProfile.regionEnvVar
      );
    }

    if (authProfile === null) {
      issues.push(validationIssue(
        'missing-auth-profile-reference',
        '$.authProfileRef',
        'S3-compatible backend config authProfileRef is not present in the reference registry.'
      ));
    } else {
      requiredEnvironmentVariables.push(
        authProfile.accessKeyIdEnvVar,
        authProfile.secretAccessKeyEnvVar
      );
      if (typeof authProfile.sessionTokenEnvVar === 'string') {
        optionalEnvironmentVariables.push(authProfile.sessionTokenEnvVar);
      }
    }
  }

  const backendKind = parsedConfig.config?.backendKind ?? (
    isRecord(configInput) && configInput.backendKind === 's3-compatible'
      ? 's3-compatible'
      : 'unsupported'
  );
  const status = issues.length === 0 ? 'valid' : 'blocked';

  return buildReferenceValidationSummary({
    status,
    backendKind,
    config: parsedConfig.config,
    requiredEnvironmentVariables,
    optionalEnvironmentVariables,
    issues,
    reason: status === 'valid'
      ? 'S3-compatible backend references match an offline registry; no environment values were read.'
      : 'S3-compatible backend references or registry must be fixed before real adapter design can continue.'
  });
}
