import {
  createEmptyKnowledgeValidationReport,
  error,
  isRecord,
  readNonNegativeInteger,
  readPositiveInteger,
  readStringArray,
  validateBlockerCodeSummary,
  type KnowledgeValidationIssue,
  type KnowledgeValidationReport
} from './validation-primitives.ts';

const SAFE_SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_ENV_VAR_NAME_PATTERN = /^[A-Z_][A-Z0-9_]{0,127}$/;
const UPLOAD_INTENT_STATUSES = ['approval-required', 'blocked'] as const;
const UPLOAD_INTENT_NEXT_ACTIONS = ['request-explicit-upload-approval', 'resolve-blockers'] as const;
const UPLOAD_CONTINUATION_STATUSES = ['continuation-ready', 'blocked'] as const;
const UPLOAD_CONTINUATION_NEXT_ACTIONS = ['inject-approved-adapter-dependencies', 'resolve-blockers'] as const;
const UPLOAD_INTENT_BLOCKERS = [
  'backend-reference-blocked',
  'credential-presence-check-enabled',
  'credential-values-exposed',
  'invalid-backend-reference-kind',
  'invalid-publication-readiness-kind',
  'invalid-schema-version',
  'live-check-enabled',
  'missing-required-field',
  'mutation-enabled',
  'publication-not-upload-required',
  'publication-readiness-blocked',
  'remote-write-enabled',
  'unsupported-backend-kind',
  'unsafe-artifact-reference',
  'unsafe-env-var-name',
  'upload-command-present'
] as const;
const UPLOAD_CONTINUATION_BLOCKERS = [
  'approval-fingerprint-forged',
  'approval-fingerprint-mismatch',
  'approval-fingerprint-missing',
  'backend-detail-leak',
  'client-created',
  'credential-presence-check-enabled',
  'credential-values-exposed',
  'invalid-intent-kind',
  'invalid-schema-version',
  'intent-not-approval-required',
  'live-check-enabled',
  'missing-required-field',
  'mutation-enabled',
  'remote-write-enabled',
  'unsafe-approval-fingerprint',
  'unsafe-artifact-reference',
  'upload-approval-already-provided',
  'upload-command-present',
  'upload-execution-enabled'
] as const;
const FORBIDDEN_KEY_PATTERN = /(bucket|endpoint|url|credentialValue|secret|token|password|authorization|header|accessKey|sessionToken|clientConfig|signedUrl)/i;
const FORBIDDEN_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|secret|token|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;

function isOneOf<T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === 'string' && (options as readonly string[]).includes(value);
}

function validateNoUploadApprovalLeakage(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): void {
  if (typeof value === 'string') {
    if (SAFE_ENV_VAR_NAME_PATTERN.test(value)) {
      return;
    }
    if (FORBIDDEN_VALUE_PATTERN.test(value)) {
      issues.push(error(path, 'Knowledge upload approval payloads must not expose backend details, credential values, upload commands, or absolute paths.'));
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      validateNoUploadApprovalLeakage(entry, `${path}[${index}]`, issues);
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    const entryPath = `${path}.${key}`;
    const safeControlField = key === 'credentialValuesExposed'
      || key === 'credentialValuesRead'
      || key === 'credentialPresenceChecked'
      || key === 'credentialBoundary';
    if (!safeControlField && FORBIDDEN_KEY_PATTERN.test(key)) {
      issues.push(error(entryPath, 'Knowledge upload approval payloads must not include backend detail or credential fields.'));
    }
    validateNoUploadApprovalLeakage(entry, entryPath, issues);
  }
}

function validateCommonDryRunBoundary(
  payload: Record<string, unknown>,
  issues: KnowledgeValidationIssue[],
  label: string
): void {
  if (payload.schemaVersion !== 1) {
    issues.push(error('$.schemaVersion', `${label} schemaVersion must be 1.`));
  }
  if (payload.mutationAllowed !== false) {
    issues.push(error('$.mutationAllowed', `${label} mutationAllowed must be false.`));
  }
  if (payload.executionMode !== 'dry-run') {
    issues.push(error('$.executionMode', `${label} executionMode must be dry-run.`));
  }
  if (payload.remoteWriteAllowed !== false) {
    issues.push(error('$.remoteWriteAllowed', `${label} must not allow remote writes.`));
  }
  if (payload.liveCheckAllowed !== false) {
    issues.push(error('$.liveCheckAllowed', `${label} must not allow live backend checks.`));
  }
  if (payload.credentialValuesExposed !== false) {
    issues.push(error('$.credentialValuesExposed', `${label} must not expose credential values.`));
  }
  if (payload.credentialPresenceChecked !== false) {
    issues.push(error('$.credentialPresenceChecked', `${label} must not check credential presence.`));
  }
  if (payload.uploadCommand !== null) {
    issues.push(error('$.uploadCommand', `${label} must not include an upload command.`));
  }
}

function validateFingerprintObject(
  fingerprint: unknown,
  path: string,
  issues: KnowledgeValidationIssue[],
  allowNullValue: boolean
): string | null {
  if (!isRecord(fingerprint)) {
    issues.push(error(path, 'must be an object.'));
    return null;
  }
  if (fingerprint.algorithm !== 'sha256') {
    issues.push(error(`${path}.algorithm`, 'must be sha256.'));
  }
  if (fingerprint.scope !== 'stage-knowledge-pack-intent-v1') {
    issues.push(error(`${path}.scope`, 'must be stage-knowledge-pack-intent-v1.'));
  }
  if (fingerprint.canonicalFieldCount !== 13) {
    issues.push(error(`${path}.canonicalFieldCount`, 'must be 13.'));
  }
  if (fingerprint.value === null && allowNullValue) {
    return null;
  }
  if (typeof fingerprint.value !== 'string' || !SAFE_SHA256_PATTERN.test(fingerprint.value)) {
    issues.push(error(`${path}.value`, 'must be a SHA-256 hex string.'));
    return null;
  }
  return fingerprint.value;
}

function validateBlockers(input: {
  readiness: Record<string, unknown>;
  supportedCodes: readonly string[];
  supportedStatuses: readonly string[];
  supportedNextActions: readonly string[];
  path: string;
  issues: KnowledgeValidationIssue[];
}): void {
  if (!isOneOf(input.readiness.status, input.supportedStatuses)) {
    input.issues.push(error(`${input.path}.status`, 'must be a supported status.'));
  }
  if (!isOneOf(input.readiness.nextAction, input.supportedNextActions)) {
    input.issues.push(error(`${input.path}.nextAction`, 'must be a supported next action.'));
  }
  readNonNegativeInteger(input.readiness.blockerCount, `${input.path}.blockerCount`, input.issues);
  const blockerCodes = readStringArray(input.readiness.blockerCodes, `${input.path}.blockerCodes`, input.issues);
  if (blockerCodes) {
    blockerCodes.forEach((code, index) => {
      if (!input.supportedCodes.includes(code)) {
        input.issues.push(error(`${input.path}.blockerCodes[${index}]`, 'must be a supported blocker code.'));
      }
    });
  }
  if (!Array.isArray(input.readiness.blockers)) {
    input.issues.push(error(`${input.path}.blockers`, 'must be an array.'));
  } else {
    if (typeof input.readiness.blockerCount === 'number' && input.readiness.blockerCount !== input.readiness.blockers.length) {
      input.issues.push(error(`${input.path}.blockerCount`, 'must match blockers.length.'));
    }
    input.readiness.blockers.forEach((entry, index) => {
      const entryPath = `${input.path}.blockers[${index}]`;
      if (!isRecord(entry)) {
        input.issues.push(error(entryPath, 'must be an object.'));
        return;
      }
      if (!isOneOf(entry.code, input.supportedCodes)) {
        input.issues.push(error(`${entryPath}.code`, 'must be a supported blocker code.'));
      }
      if (typeof entry.path !== 'string' || entry.path.length === 0) {
        input.issues.push(error(`${entryPath}.path`, 'must be a non-empty string.'));
      }
      if (typeof entry.message !== 'string' || entry.message.length === 0) {
        input.issues.push(error(`${entryPath}.message`, 'must be a non-empty string.'));
      }
    });
    validateBlockerCodeSummary({
      blockerCodes,
      blockers: input.readiness.blockers,
      path: `${input.path}.blockerCodes`,
      issues: input.issues
    });
  }
}

export function validateKnowledgeTeamUploadApprovalIntentPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  validateCommonDryRunBoundary(payload, issues, 'Knowledge team upload approval intent');
  validateNoUploadApprovalLeakage(payload, '$', issues);

  if (!isOneOf(payload.status, UPLOAD_INTENT_STATUSES)) {
    issues.push(error('$.status', 'Knowledge team upload approval intent status must be supported.'));
  }
  if (payload.plannedOperation !== 'stage-knowledge-pack') {
    issues.push(error('$.plannedOperation', 'Knowledge team upload approval intent operation must be stage-knowledge-pack.'));
  }
  const fingerprintValue = validateFingerprintObject(
    payload.approvalFingerprint,
    '$.approvalFingerprint',
    issues,
    payload.status === 'blocked'
  );
  if (payload.status === 'approval-required' && fingerprintValue === null) {
    issues.push(error('$.approvalFingerprint.value', 'Approval-required upload intents require a fingerprint value.'));
  }

  if (!isRecord(payload.object)) {
    issues.push(error('$.object', 'Knowledge team upload approval intent object must be an object.'));
  } else {
    readPositiveInteger(payload.object.byteLength, '$.object.byteLength', issues);
  }
  if (!isRecord(payload.preconditions)) {
    issues.push(error('$.preconditions', 'Knowledge team upload approval intent preconditions must be an object.'));
  } else {
    const uploadApproval = isRecord(payload.preconditions.uploadApproval)
      ? payload.preconditions.uploadApproval
      : null;
    if (uploadApproval === null) {
      issues.push(error('$.preconditions.uploadApproval', 'must be an object.'));
    } else {
      if (uploadApproval.explicitUploadApprovalRequired !== true) {
        issues.push(error('$.preconditions.uploadApproval.explicitUploadApprovalRequired', 'must be true.'));
      }
      if (uploadApproval.approvalProvided !== false) {
        issues.push(error('$.preconditions.uploadApproval.approvalProvided', 'must be false.'));
      }
      if (uploadApproval.uploadCommandGenerated !== false) {
        issues.push(error('$.preconditions.uploadApproval.uploadCommandGenerated', 'must be false.'));
      }
    }
  }
  if (!isRecord(payload.readiness)) {
    issues.push(error('$.readiness', 'Knowledge team upload approval intent readiness must be an object.'));
  } else {
    validateBlockers({
      readiness: payload.readiness,
      supportedCodes: UPLOAD_INTENT_BLOCKERS,
      supportedStatuses: UPLOAD_INTENT_STATUSES,
      supportedNextActions: UPLOAD_INTENT_NEXT_ACTIONS,
      path: '$.readiness',
      issues
    });
  }

  return createEmptyKnowledgeValidationReport({ inputPath, inputKind, issues });
}

export function validateKnowledgeTeamUploadApprovalContinuationPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  validateCommonDryRunBoundary(payload, issues, 'Knowledge team upload approval continuation');
  validateNoUploadApprovalLeakage(payload, '$', issues);

  if (!isOneOf(payload.status, UPLOAD_CONTINUATION_STATUSES)) {
    issues.push(error('$.status', 'Knowledge team upload approval continuation status must be supported.'));
  }
  if (payload.uploadApproved !== false) {
    issues.push(error('$.uploadApproved', 'Knowledge team upload approval continuation must not approve upload.'));
  }
  if (payload.uploadExecutionAllowed !== false) {
    issues.push(error('$.uploadExecutionAllowed', 'Knowledge team upload approval continuation must not allow upload execution.'));
  }
  if (payload.clientCreated !== false) {
    issues.push(error('$.clientCreated', 'Knowledge team upload approval continuation must not create clients.'));
  }
  if (!isRecord(payload.approval)) {
    issues.push(error('$.approval', 'Knowledge team upload approval continuation approval must be an object.'));
  } else {
    if (payload.approval.required !== true) {
      issues.push(error('$.approval.required', 'must be true.'));
    }
    if (typeof payload.approval.provided !== 'boolean') {
      issues.push(error('$.approval.provided', 'must be a boolean.'));
    }
    if (payload.approval.suppliedFingerprint !== null && (typeof payload.approval.suppliedFingerprint !== 'string' || !SAFE_SHA256_PATTERN.test(payload.approval.suppliedFingerprint))) {
      issues.push(error('$.approval.suppliedFingerprint', 'must be null or a SHA-256 hex string.'));
    }
    if (payload.approval.expectedFingerprint !== null && (typeof payload.approval.expectedFingerprint !== 'string' || !SAFE_SHA256_PATTERN.test(payload.approval.expectedFingerprint))) {
      issues.push(error('$.approval.expectedFingerprint', 'must be null or a SHA-256 hex string.'));
    }
    if (payload.status === 'continuation-ready') {
      if (payload.approval.fingerprintVerified !== true) {
        issues.push(error('$.approval.fingerprintVerified', 'must be true for continuation-ready payloads.'));
      }
      if (payload.approval.suppliedFingerprint !== payload.approval.expectedFingerprint) {
        issues.push(error('$.approval.suppliedFingerprint', 'must match expectedFingerprint for continuation-ready payloads.'));
      }
    }
  }
  if (!isRecord(payload.adapterBoundary)) {
    issues.push(error('$.adapterBoundary', 'Knowledge team upload approval continuation adapterBoundary must be an object.'));
  } else {
    if (payload.adapterBoundary.dependencyInjectionRequired !== true) {
      issues.push(error('$.adapterBoundary.dependencyInjectionRequired', 'must be true.'));
    }
    if (payload.adapterBoundary.adapterInjected !== false) {
      issues.push(error('$.adapterBoundary.adapterInjected', 'must be false.'));
    }
    if (payload.adapterBoundary.realBackendImplemented !== false) {
      issues.push(error('$.adapterBoundary.realBackendImplemented', 'must be false.'));
    }
    if (payload.adapterBoundary.remoteWriteCapabilityEnabled !== false) {
      issues.push(error('$.adapterBoundary.remoteWriteCapabilityEnabled', 'must be false.'));
    }
  }
  if (!isRecord(payload.readiness)) {
    issues.push(error('$.readiness', 'Knowledge team upload approval continuation readiness must be an object.'));
  } else {
    validateBlockers({
      readiness: payload.readiness,
      supportedCodes: UPLOAD_CONTINUATION_BLOCKERS,
      supportedStatuses: UPLOAD_CONTINUATION_STATUSES,
      supportedNextActions: UPLOAD_CONTINUATION_NEXT_ACTIONS,
      path: '$.readiness',
      issues
    });
  }

  return createEmptyKnowledgeValidationReport({ inputPath, inputKind, issues });
}
