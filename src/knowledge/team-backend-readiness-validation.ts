import {
  createEmptyKnowledgeValidationReport,
  error,
  isRecord,
  readBoolean,
  readNonEmptyString,
  readNonNegativeInteger,
  readStringArray,
  validateBlockerCodeSummary,
  type KnowledgeValidationIssue,
  type KnowledgeValidationReport
} from './validation-primitives.ts';

const KNOWLEDGE_TEAM_BACKEND_READINESS_BLOCKERS = [
  'backend-detail-leak',
  'invalid-config-kind',
  'invalid-schema-version',
  'live-check-enabled',
  'missing-required-field',
  'mutation-enabled',
  'remote-write-enabled',
  'unsafe-config-name',
  'unsafe-prefix',
  'unsupported-backend-kind',
  'unsupported-credential-mode'
] as const;
const KNOWLEDGE_TEAM_BACKEND_READINESS_STATUSES = [
  'blocked',
  'ready-for-explicit-upload'
] as const;
const KNOWLEDGE_TEAM_BACKEND_READINESS_NEXT_ACTIONS = [
  'design-explicit-upload',
  'fix-backend-config'
] as const;
const SECRET_VALUE_PATTERN = /(api[_-]?key|secret|token|password|authorization|bearer)/i;
const BACKEND_URL_PATTERN = /(?:https?:\/\/|s3:\/\/|gs:\/\/|az:\/\/)/i;
const BACKEND_DETAIL_WORD_PATTERN = /\b(?:bucket|endpoint)\b/i;
const FORBIDDEN_TEAM_BACKEND_READINESS_KEY_PATTERN = /(bucket|endpoint|url|secret|token|password|authorization|header|accessKey|sessionToken)/i;
const ABSOLUTE_LOCAL_PATH_PATTERN = /(^|[\s"'=])(?:\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/;

function validateNoTeamBackendReadinessLeakage(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): void {
  if (typeof value === 'string') {
    if (
      SECRET_VALUE_PATTERN.test(value)
      || BACKEND_URL_PATTERN.test(value)
      || BACKEND_DETAIL_WORD_PATTERN.test(value)
      || ABSOLUTE_LOCAL_PATH_PATTERN.test(value)
    ) {
      issues.push(error(path, 'Knowledge team backend readiness reports must not expose backend details, credential values, or absolute local paths.'));
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      validateNoTeamBackendReadinessLeakage(entry, `${path}[${index}]`, issues);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    if (FORBIDDEN_TEAM_BACKEND_READINESS_KEY_PATTERN.test(key)) {
      issues.push(error(entryPath, 'Knowledge team backend readiness reports must not include backend detail or credential fields.'));
    }
    validateNoTeamBackendReadinessLeakage(entry, entryPath, issues);
  }
}

export function validateKnowledgeTeamBackendReadinessPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];

  if (payload.schemaVersion !== 1) {
    issues.push(error('$.schemaVersion', 'Knowledge team backend readiness schemaVersion must be 1.'));
  }
  if (payload.mutationAllowed !== false) {
    issues.push(error('$.mutationAllowed', 'Knowledge team backend readiness mutationAllowed must be false.'));
  }
  if (payload.executionMode !== 'dry-run') {
    issues.push(error('$.executionMode', 'Knowledge team backend readiness executionMode must be dry-run.'));
  }
  if (payload.remoteWriteAllowed !== false) {
    issues.push(error('$.remoteWriteAllowed', 'Knowledge team backend readiness must not allow remote writes.'));
  }
  if (payload.liveCheckAllowed !== false) {
    issues.push(error('$.liveCheckAllowed', 'Knowledge team backend readiness must not perform live backend checks.'));
  }
  if (payload.credentialValuesExposed !== false) {
    issues.push(error('$.credentialValuesExposed', 'Knowledge team backend readiness must not expose credential values.'));
  }
  if (payload.uploadCommand !== null) {
    issues.push(error('$.uploadCommand', 'Knowledge team backend readiness must not include an upload command.'));
  }
  if (payload.backendKind !== 's3-compatible' && payload.backendKind !== 'unsupported') {
    issues.push(error('$.backendKind', 'Knowledge team backend readiness backendKind must be s3-compatible or unsupported.'));
  }

  if (!isRecord(payload.config)) {
    issues.push(error('$.config', 'Knowledge team backend readiness config must be an object.'));
  } else {
    if (payload.config.name !== null && typeof payload.config.name !== 'string') {
      issues.push(error('$.config.name', 'Knowledge team backend readiness config name must be a string or null.'));
    }
    if (payload.config.artifactPrefix !== null && payload.config.artifactPrefix !== 'knowledge-artifacts/v1') {
      issues.push(error('$.config.artifactPrefix', 'Knowledge team backend readiness artifactPrefix must be knowledge-artifacts/v1 or null.'));
    }
    if (payload.config.indexPrefix !== null && payload.config.indexPrefix !== 'knowledge-index/v1') {
      issues.push(error('$.config.indexPrefix', 'Knowledge team backend readiness indexPrefix must be knowledge-index/v1 or null.'));
    }
    if (
      payload.config.credentialMode !== null
      && payload.config.credentialMode !== 'environment'
      && payload.config.credentialMode !== 'unsupported'
    ) {
      issues.push(error('$.config.credentialMode', 'Knowledge team backend readiness credentialMode must be environment, unsupported, or null.'));
    }
    if (payload.config.remoteWriteDefault !== null && typeof payload.config.remoteWriteDefault !== 'boolean') {
      issues.push(error('$.config.remoteWriteDefault', 'Knowledge team backend readiness remoteWriteDefault must be a boolean or null.'));
    }
    if (payload.config.liveCheckDefault !== null && typeof payload.config.liveCheckDefault !== 'boolean') {
      issues.push(error('$.config.liveCheckDefault', 'Knowledge team backend readiness liveCheckDefault must be a boolean or null.'));
    }
  }

  if (!isRecord(payload.capabilities)) {
    issues.push(error('$.capabilities', 'Knowledge team backend readiness capabilities must be an object.'));
  } else {
    readBoolean(payload.capabilities.artifactObjectStore, '$.capabilities.artifactObjectStore', issues);
    readBoolean(payload.capabilities.metadataIndex, '$.capabilities.metadataIndex', issues);
    readBoolean(payload.capabilities.contentAddressedObjectKeys, '$.capabilities.contentAddressedObjectKeys', issues);
    readBoolean(payload.capabilities.contentAddressedIndexKeys, '$.capabilities.contentAddressedIndexKeys', issues);
    readBoolean(payload.capabilities.idempotentWritesRequired, '$.capabilities.idempotentWritesRequired', issues);
    readBoolean(payload.capabilities.explicitUploadApprovalRequired, '$.capabilities.explicitUploadApprovalRequired', issues);
    if (payload.capabilities.dryRunOnly !== true) {
      issues.push(error('$.capabilities.dryRunOnly', 'Knowledge team backend readiness dryRunOnly must be true.'));
    }
  }

  let status: string | null = null;
  if (!isRecord(payload.readiness)) {
    issues.push(error('$.readiness', 'Knowledge team backend readiness readiness must be an object.'));
  } else {
    if (
      typeof payload.readiness.status !== 'string'
      || !KNOWLEDGE_TEAM_BACKEND_READINESS_STATUSES.includes(
        payload.readiness.status as typeof KNOWLEDGE_TEAM_BACKEND_READINESS_STATUSES[number]
      )
    ) {
      issues.push(error('$.readiness.status', 'Knowledge team backend readiness status must be supported.'));
    } else {
      status = payload.readiness.status;
    }
    if (
      typeof payload.readiness.nextAction !== 'string'
      || !KNOWLEDGE_TEAM_BACKEND_READINESS_NEXT_ACTIONS.includes(
        payload.readiness.nextAction as typeof KNOWLEDGE_TEAM_BACKEND_READINESS_NEXT_ACTIONS[number]
      )
    ) {
      issues.push(error('$.readiness.nextAction', 'Knowledge team backend readiness nextAction must be supported.'));
    }
    const blockerCount = readNonNegativeInteger(payload.readiness.blockerCount, '$.readiness.blockerCount', issues);
    const blockerCodes = readStringArray(payload.readiness.blockerCodes, '$.readiness.blockerCodes', issues);
    if (blockerCodes !== null) {
      for (const [index, blockerCode] of blockerCodes.entries()) {
        if (
          !KNOWLEDGE_TEAM_BACKEND_READINESS_BLOCKERS.includes(
            blockerCode as typeof KNOWLEDGE_TEAM_BACKEND_READINESS_BLOCKERS[number]
          )
        ) {
          issues.push(error(`$.readiness.blockerCodes[${index}]`, 'Knowledge team backend readiness blocker code must be supported.'));
        }
      }
    }
    if (!Array.isArray(payload.readiness.blockers)) {
      issues.push(error('$.readiness.blockers', 'Knowledge team backend readiness blockers must be an array.'));
    } else {
      if (blockerCount !== null && blockerCount !== payload.readiness.blockers.length) {
        issues.push(error('$.readiness.blockerCount', 'Knowledge team backend readiness blockerCount must match blockers.length.'));
      }
      payload.readiness.blockers.forEach((blocker, index) => {
        const path = `$.readiness.blockers[${index}]`;
        if (!isRecord(blocker)) {
          issues.push(error(path, 'Knowledge team backend readiness blocker must be an object.'));
          return;
        }
        if (
          typeof blocker.code !== 'string'
          || !KNOWLEDGE_TEAM_BACKEND_READINESS_BLOCKERS.includes(
            blocker.code as typeof KNOWLEDGE_TEAM_BACKEND_READINESS_BLOCKERS[number]
          )
        ) {
          issues.push(error(`${path}.code`, 'Knowledge team backend readiness blocker code must be supported.'));
        }
        readNonEmptyString(blocker.path, `${path}.path`, issues);
        readNonEmptyString(blocker.message, `${path}.message`, issues);
      });
      if (status === 'ready-for-explicit-upload' && payload.readiness.blockers.length > 0) {
        issues.push(error('$.readiness.blockers', 'Ready team backend readiness reports must not include blockers.'));
      }
      if (status === 'blocked' && payload.readiness.blockers.length === 0) {
        issues.push(error('$.readiness.blockers', 'Blocked team backend readiness reports must include blockers.'));
      }
      validateBlockerCodeSummary({
        blockerCodes,
        blockers: payload.readiness.blockers,
        path: '$.readiness.blockerCodes',
        issues,
        message: 'Knowledge team artifact blockerCodes must match the unique blocker codes.'
      });
    }
    readNonEmptyString(payload.readiness.reason, '$.readiness.reason', issues);
  }

  if (status === 'ready-for-explicit-upload') {
    if (payload.backendKind !== 's3-compatible') {
      issues.push(error('$.backendKind', 'Ready team backend readiness requires an s3-compatible backend kind.'));
    }
    if (isRecord(payload.readiness) && payload.readiness.nextAction !== 'design-explicit-upload') {
      issues.push(error('$.readiness.nextAction', 'Ready team backend readiness nextAction must be design-explicit-upload.'));
    }
  }
  if (status === 'blocked' && isRecord(payload.readiness) && payload.readiness.nextAction !== 'fix-backend-config') {
    issues.push(error('$.readiness.nextAction', 'Blocked team backend readiness nextAction must be fix-backend-config.'));
  }

  validateNoTeamBackendReadinessLeakage(payload, '$', issues);

  return createEmptyKnowledgeValidationReport({
    inputPath,
    inputKind,
    issues
  });
}
