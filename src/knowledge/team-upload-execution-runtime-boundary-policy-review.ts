import { createHash } from 'node:crypto';
import {
  isSafeKnowledgeTeamBackendAdapterName
} from './team-backend-adapter.ts';
import {
  isKnowledgeTeamArtifactSha256
} from './team-artifact-store.ts';

export type KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewStatus =
  | 'upload-execution-runtime-boundary-policy-review-ready'
  | 'blocked';

export type KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewNextAction =
  | 'await-explicit-upload-execution-runtime-boundary-policy-update'
  | 'resolve-blockers';

export type KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewBlockerCode =
  | 'adapter-dependency-leak'
  | 'adapter-injected'
  | 'artifact-bytes-provided'
  | 'artifact-object-store-bound'
  | 'audit-record-created'
  | 'authorization-already-granted'
  | 'authorization-material-leak'
  | 'backend-detail-leak'
  | 'client-created'
  | 'client-dependency-leak'
  | 'credential-dependency-leak'
  | 'credential-presence-check-enabled'
  | 'credential-presence-result-exposed'
  | 'credential-values-exposed'
  | 'credential-values-read'
  | 'executable-state-enabled'
  | 'execution-lease-created'
  | 'invalid-runtime-boundaries-kind'
  | 'invalid-schema-version'
  | 'live-check-enabled'
  | 'live-check-result-exposed'
  | 'metadata-index-bound'
  | 'metadata-index-handle-leak'
  | 'metadata-index-write-attempted'
  | 'missing-required-field'
  | 'mutation-approval-already-granted'
  | 'mutation-enabled'
  | 'object-store-handle-leak'
  | 'object-write-attempted'
  | 'policy-update-already-authorized'
  | 'policy-update-already-recorded'
  | 'policy-update-material-leak'
  | 'remote-mutation-performed'
  | 'remote-write-enabled'
  | 'rollback-plan-created'
  | 'runtime-boundaries-enabled-execution'
  | 'runtime-boundaries-fingerprint-missing'
  | 'runtime-boundaries-fingerprint-unsupported'
  | 'runtime-boundaries-fingerprint-unverified'
  | 'runtime-boundaries-next-action-invalid'
  | 'runtime-boundaries-not-ready'
  | 'runtime-boundary-policy-review-enabled-execution'
  | 'unsafe-adapter-name'
  | 'unsafe-artifact-reference'
  | 'unsupported-adapter-backend'
  | 'upload-approval-already-provided'
  | 'upload-command-exposed'
  | 'upload-command-generated'
  | 'upload-command-present'
  | 'upload-execution-approval-already-provided'
  | 'upload-execution-authorization-already-provided'
  | 'upload-execution-enabled'
  | 'write-token-issued';

export interface KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewBlocker {
  code: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewBlockerCode;
  path: string;
  message: string;
}

type AdapterBackendKind = 'mock-s3-compatible' | 's3-compatible' | 'unsupported';

interface Fingerprint {
  algorithm: 'sha256' | 'unsupported';
  scope:
    | 'stage-knowledge-pack-upload-execution-implementation-boundary-v1'
    | 'stage-knowledge-pack-upload-execution-runtime-boundaries-v1'
    | 'stage-knowledge-pack-upload-execution-runtime-boundary-policy-review-v1'
    | 'unsupported';
  value: string | null;
  canonicalFieldCount: number | null;
}

export interface KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReview {
  kind: 'infra-agent.knowledge-team-upload-execution-runtime-boundary-policy-review';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'dry-run';
  reviewKind: 'upload-execution-runtime-boundary-policy-review-dry-run';
  status: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewStatus;
  plannedOperation: 'stage-knowledge-pack';
  remoteWriteAllowed: false;
  liveCheckAllowed: false;
  credentialValuesExposed: false;
  credentialPresenceChecked: false;
  uploadApproved: false;
  uploadExecutionApproved: false;
  uploadExecutionAllowed: false;
  mutationApprovalGranted: false;
  clientCreated: false;
  adapterInjected: false;
  artifactBytesProvided: false;
  writeTokenIssued: false;
  executionLeaseCreated: false;
  rollbackPlanCreated: false;
  auditRecordCreated: false;
  objectWriteAttempted: false;
  metadataIndexWriteAttempted: false;
  remoteMutationPerformed: false;
  uploadCommand: null;
  target: {
    manifestId: string | null;
    objectKeyRedacted: true;
    objectSha256: string | null;
    artifactId: string | null;
  };
  sourceRuntimeBoundaries: {
    source: 'upload-execution-runtime-boundaries';
    boundaryStatus: 'upload-execution-runtime-boundaries-ready' | 'blocked' | 'invalid';
    boundaryKind: 'upload-execution-runtime-boundaries-dry-run' | 'unsupported';
    boundaryNextAction: 'await-explicit-upload-execution-runtime-boundary-policy-review' | 'resolve-blockers' | 'invalid';
    runtimeBoundariesDesigned: boolean;
    sourceImplementationBoundaryFingerprintVerified: boolean;
    runtimeExecutionAllowed: boolean;
    executionStillDisabled: boolean;
    adapterName: string | null;
    adapterBackendKind: AdapterBackendKind;
    sourceImplementationBoundaryFingerprint: Fingerprint;
    runtimeBoundariesFingerprint: Fingerprint;
  };
  runtimeBoundaryPolicyReview: {
    dryRunOnly: true;
    runtimeBoundaryPolicyReviewRequired: true;
    runtimeBoundaryPolicyReviewed: boolean;
    runtimeBoundaryPolicyUpdated: false;
    policyUpdateAuthorized: false;
    executionStillDisabled: true;
    runtimeExecutionStillProhibited: true;
    uploadExecutionStillProhibited: true;
    commandGenerationStillProhibited: true;
    objectWriteStillProhibited: true;
    metadataIndexWriteStillProhibited: true;
    reviewedCapabilityFamilies: string[];
    artifactBytesPolicyReviewed: boolean;
    adapterInjectionPolicyReviewed: boolean;
    clientCreationPolicyReviewed: boolean;
    credentialReadPolicyReviewed: boolean;
    credentialPresencePolicyReviewed: boolean;
    liveCheckPolicyReviewed: boolean;
    commandGenerationPolicyReviewed: boolean;
    objectIndexBindingPolicyReviewed: boolean;
    writeTokenPolicyReviewed: boolean;
    executionLeasePolicyReviewed: boolean;
    rollbackPolicyReviewed: boolean;
    auditPolicyReviewed: boolean;
    remoteMutationPolicyReviewed: boolean;
    separatePolicyUpdateRequired: true;
    nextRequiredPolicyUpdate: 'explicit-runtime-boundary-policy-update';
    requiredReviewDocuments: [
      'docs/HANDOFF.md',
      'docs/ROADMAP.md',
      'docs/AGENT_RULES.md',
      'docs/CLAUDE_CODE_AGENT_PATTERNS.md'
    ];
    reviewFingerprint: Fingerprint;
  };
  toolCapabilityPolicy: {
    allowedCapabilityFamilies: [
      'read-saved-json',
      'validate-contract',
      'write-local-artifact'
    ];
    disallowedCapabilityFamilies: [
      'sdk-client',
      'credential-read',
      'live-backend-check',
      'shell-command-generation',
      'object-store-write',
      'metadata-index-write',
      'remote-mutation'
    ];
  };
  handoffPolicy: {
    compact: true;
    rawRuntimeIncluded: false;
    rawToolOutputIncluded: false;
    credentialMaterialIncluded: false;
    commandMaterialIncluded: false;
    backendHandlesIncluded: false;
  };
  executionBoundary: {
    dryRunOnly: true;
    executable: false;
    artifactBytesProvided: false;
    adapterInjected: false;
    clientCreated: false;
    credentialValuesRead: false;
    credentialValuesExposed: false;
    credentialPresenceChecked: false;
    credentialPresenceResultExposed: false;
    liveCheckAllowed: false;
    liveCheckPerformed: false;
    liveCheckResultExposed: false;
    uploadCommandGenerated: false;
    uploadCommandMaterialized: false;
    uploadCommandExposed: false;
    artifactObjectStoreBound: false;
    metadataIndexBound: false;
    objectStoreHandleExposed: false;
    metadataIndexHandleExposed: false;
    objectWriteAllowed: false;
    metadataIndexWriteAllowed: false;
    objectWriteAttempted: false;
    metadataIndexWriteAttempted: false;
    writeTokenIssued: false;
    executionLeaseCreated: false;
    rollbackPlanCreated: false;
    auditRecordCreated: false;
    remoteMutationPerformed: false;
  };
  readiness: {
    status: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewStatus;
    nextAction: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewNextAction;
    blockerCount: number;
    blockerCodes: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewBlockerCode[];
    blockers: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewBlocker[];
    reason: string;
  };
}

export interface KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewInput {
  runtimeBoundaries: unknown;
}

interface ParsedRuntimeBoundariesForPolicyReview {
  target: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReview['target'];
  sourceRuntimeBoundaries: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReview['sourceRuntimeBoundaries'];
}

const SAFE_ID_PATTERN = /^[a-f0-9]{24}$/;
const SAFE_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const IMPLEMENTATION_BOUNDARY_FINGERPRINT_FIELD_COUNT = 18;
const RUNTIME_BOUNDARIES_FINGERPRINT_FIELD_COUNT = 20;
const POLICY_REVIEW_FINGERPRINT_FIELD_COUNT = 24;
const FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN = /(artifactBytesValue|artifactBytesBase64|artifactBytesContent|artifactBytesPayload|artifactContent|artifactPayload|rawArtifact|byteBuffer|bytesBase64|contentBase64|buffer|stream|arrayBuffer|blob|readPath|filePath|localPath|artifactPath|serializedPayload|stagedBytes)/i;
const FORBIDDEN_CLIENT_KEY_PATTERN = /(clientInstance|clientObject|clientValue|clientFactoryValue|clientDescriptorValue|clientConfig|adapterClient|^sdkClient$|sdkClientConfig|signedUrl)/i;
const FORBIDDEN_CREDENTIAL_KEY_PATTERN = /(^credentialValue$|credentialValuePayload|credentialValueMaterial|credentialMaterial|credentialFile|credentialPath|credentialsPath|secretValue|envValue|processEnv|presenceCheckResult|^credentialPresenceResult$|credentialPresenceResult(?:Value|Payload|Material|Data|Body|Response)|credentialPresenceSignalValue)/i;
const FORBIDDEN_LIVE_CHECK_KEY_PATTERN = /(^liveCheckResult$|liveCheckResult(?:Value|Payload|Material|Data|Body)|liveCheckResponse|liveCheckProbe|liveCheckRequest|liveBackendProbe|headObjectResult|headIndexResult|remoteProbeResult|connectivityResult|healthCheckResult)/i;
const FORBIDDEN_COMMAND_KEY_PATTERN = /(^uploadCommandValue$|^uploadCommandPayload$|^uploadCommandMaterial$|^uploadCommandData$|^uploadCommandBody$|^uploadCommandLine$|^commandLine$|^shellCommand$|^signedUploadCommand$|^uploadExecutionCommand$)/i;
const FORBIDDEN_AUTHORIZATION_KEY_PATTERN = /(^authorizationValue$|authorizationMaterial|authorizationToken|authorizationHeader|executionAuthorizationValue|executionAuthorizationMaterial|executionGrant|signedAuthorization|uploadExecutionAuthorizationMaterial|uploadExecutionGrant)/i;
const FORBIDDEN_ADAPTER_KEY_PATTERN = /(adapterInstance|adapterObject|adapterValue|adapterDescriptorValue)/i;
const FORBIDDEN_OBJECT_STORE_HANDLE_KEY_PATTERN = /(^objectStoreBinding$|objectStoreBinding(?:Handle|Instance|Client|Value|Payload|Material)|^objectStoreHandle$|objectStoreHandle(?:Value|Payload|Material|Instance|Client)|objectStoreInstance|objectStoreClient|artifactObjectStoreHandle|putObject|writeObject)/i;
const FORBIDDEN_METADATA_INDEX_HANDLE_KEY_PATTERN = /(^metadataIndexBinding$|metadataIndexBinding(?:Handle|Instance|Client|Value|Payload|Material)|^metadataIndexHandle$|metadataIndexHandle(?:Value|Payload|Material|Instance|Client)|metadataIndexInstance|metadataIndexClient|putEntry|writeIndex|indexEntryPayload|indexEntryValue)/i;
const FORBIDDEN_POLICY_UPDATE_KEY_PATTERN = /(policyUpdate(?:Value|Payload|Material|Document|Patch|Diff|Content)|rulesUpdatePatch|runtimeBoundaryPolicyUpdate)/i;
const FORBIDDEN_LEAK_KEY_PATTERN = /(bucket|endpoint|url|secret|password|header|accessKey|sessionToken|tokenValue|tokenMaterial|leaseValue|leaseMaterial|rollbackValue|rollbackMaterial|rollbackCommand|auditValue|auditMaterial|auditCommand|implementationSecret|runtimeSecret)/i;
const FORBIDDEN_LEAK_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|kubectl |curl |secret|password|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;

const TOP_LEVEL_FALSE_FIELDS = [
  'remoteWriteAllowed',
  'liveCheckAllowed',
  'credentialValuesExposed',
  'credentialPresenceChecked',
  'uploadApproved',
  'uploadExecutionApproved',
  'uploadExecutionAllowed',
  'mutationApprovalGranted',
  'clientCreated',
  'adapterInjected',
  'artifactBytesProvided',
  'writeTokenIssued',
  'executionLeaseCreated',
  'rollbackPlanCreated',
  'auditRecordCreated',
  'objectWriteAttempted',
  'metadataIndexWriteAttempted',
  'remoteMutationPerformed'
] as const;

const EXECUTION_BOUNDARY_FALSE_FIELDS = [
  'executable',
  'artifactBytesProvided',
  'adapterInjected',
  'clientCreated',
  'credentialValuesRead',
  'credentialValuesExposed',
  'credentialPresenceChecked',
  'credentialPresenceResultExposed',
  'liveCheckAllowed',
  'liveCheckPerformed',
  'liveCheckResultExposed',
  'uploadCommandGenerated',
  'uploadCommandMaterialized',
  'uploadCommandExposed',
  'artifactObjectStoreBound',
  'metadataIndexBound',
  'objectStoreHandleExposed',
  'metadataIndexHandleExposed',
  'objectWriteAllowed',
  'metadataIndexWriteAllowed',
  'objectWriteAttempted',
  'metadataIndexWriteAttempted',
  'writeTokenIssued',
  'executionLeaseCreated',
  'rollbackPlanCreated',
  'auditRecordCreated',
  'remoteMutationPerformed'
] as const;

const RUNTIME_BOUNDARY_REQUIRED_TRUE_FIELDS = [
  'runtimeBoundariesDesigned',
  'sourceImplementationBoundaryFingerprintVerified',
  'separateRuntimeArtifactsRequired',
  'artifactBytesRuntimeBoundaryRequired',
  'adapterInjectionRuntimeBoundaryRequired',
  'clientCreationRuntimeBoundaryRequired',
  'credentialReadRuntimeBoundaryRequired',
  'credentialPresenceRuntimeBoundaryRequired',
  'liveCheckRuntimeBoundaryRequired',
  'uploadCommandRuntimeBoundaryRequired',
  'objectIndexBindingRuntimeBoundaryRequired',
  'writeTokenRuntimeBoundaryRequired',
  'executionLeaseRuntimeBoundaryRequired',
  'rollbackPlanRuntimeBoundaryRequired',
  'auditRecordRuntimeBoundaryRequired',
  'commandGenerationStillProhibited',
  'adapterInjectionStillProhibited',
  'clientCreationStillProhibited',
  'credentialAccessStillProhibited',
  'credentialPresenceCheckStillProhibited',
  'liveCheckStillProhibited',
  'objectStoreBindingStillProhibited',
  'metadataIndexBindingStillProhibited',
  'objectWriteStillProhibited',
  'metadataIndexWriteStillProhibited',
  'remoteMutationStillProhibited'
] as const;

const RUNTIME_BOUNDARY_REQUIRED_FALSE_FIELDS = [
  'runtimeExecutionAllowed',
  'authorizationGranted',
  'executionAuthorizationGranted',
  'uploadApproved',
  'uploadExecutionApproved',
  'uploadExecutionAllowed',
  'mutationApprovalGranted',
  'executable'
] as const;

const REVIEWED_CAPABILITY_FAMILIES = [
  'artifact-bytes',
  'adapter-injection',
  'client-creation',
  'credential-read',
  'credential-presence',
  'live-check',
  'upload-command',
  'object-index-binding',
  'write-token',
  'execution-lease',
  'rollback-plan',
  'audit-record',
  'remote-mutation'
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBool(value: unknown): boolean {
  return value === true;
}

function addBlocker(
  blockers: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewBlocker[],
  code: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewBlockerCode,
  path: string,
  message: string
): void {
  if (!blockers.some((blocker) => blocker.code === code && blocker.path === path)) {
    blockers.push({ code, path, message });
  }
}

function inspectForForbiddenPolicyReviewMaterial(
  value: unknown,
  path: string,
  blockers: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewBlocker[]
): void {
  if (typeof value === 'string') {
    if (FORBIDDEN_LEAK_VALUE_PATTERN.test(value)) {
      addBlocker(blockers, 'backend-detail-leak', path, 'Runtime-boundary policy review input must not include backend details, commands, secrets, private paths, or signed material.');
    }
    return;
  }
  if (!isRecord(value) && !Array.isArray(value)) {
    return;
  }
  const entries = Array.isArray(value)
    ? value.map((entry, index) => [String(index), entry] as const)
    : Object.entries(value);
  for (const [key, entry] of entries) {
    const entryPath = Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`;
    if (key === 'objectKey') {
      addBlocker(blockers, 'unsafe-artifact-reference', entryPath, 'Runtime-boundary policy review input must not include target object keys.');
    }
    if (FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'artifact-bytes-provided', entryPath, 'Runtime-boundary policy review input must not include raw artifact bytes or local artifact byte paths.');
    }
    if (FORBIDDEN_CLIENT_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'client-dependency-leak', entryPath, 'Runtime-boundary policy review input must not include SDK clients, client configs, or signed URLs.');
    }
    if (FORBIDDEN_CREDENTIAL_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'credential-dependency-leak', entryPath, 'Runtime-boundary policy review input must not include credential values, files, or presence-check results.');
    }
    if (FORBIDDEN_LIVE_CHECK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'live-check-result-exposed', entryPath, 'Runtime-boundary policy review input must not include live-check probes or results.');
    }
    if (FORBIDDEN_COMMAND_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'upload-command-exposed', entryPath, 'Runtime-boundary policy review input must not include upload command material.');
    }
    if (FORBIDDEN_AUTHORIZATION_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'authorization-material-leak', entryPath, 'Runtime-boundary policy review input must not include authorization material or execution grants.');
    }
    if (FORBIDDEN_ADAPTER_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'adapter-dependency-leak', entryPath, 'Runtime-boundary policy review input must not include concrete adapter instances.');
    }
    if (FORBIDDEN_OBJECT_STORE_HANDLE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'object-store-handle-leak', entryPath, 'Runtime-boundary policy review input must not include object-store handles or write functions.');
    }
    if (FORBIDDEN_METADATA_INDEX_HANDLE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'metadata-index-handle-leak', entryPath, 'Runtime-boundary policy review input must not include metadata-index handles or write functions.');
    }
    if (FORBIDDEN_POLICY_UPDATE_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'policy-update-material-leak', entryPath, 'Runtime-boundary policy review input must not include policy update material.');
    }
    if (FORBIDDEN_LEAK_KEY_PATTERN.test(key)) {
      addBlocker(blockers, 'backend-detail-leak', entryPath, 'Runtime-boundary policy review input must not include backend details, secrets, token/lease/rollback/audit material, or runtime secrets.');
    }
    inspectForForbiddenPolicyReviewMaterial(entry, entryPath, blockers);
  }
}

function emptyTarget(): KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReview['target'] {
  return {
    manifestId: null,
    objectKeyRedacted: true,
    objectSha256: null,
    artifactId: null
  };
}

function emptyFingerprint(
  scope: Fingerprint['scope'],
  canonicalFieldCount: number
): Fingerprint {
  return {
    algorithm: 'sha256',
    scope,
    value: null,
    canonicalFieldCount
  };
}

function emptySourceRuntimeBoundaries(): KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReview['sourceRuntimeBoundaries'] {
  return {
    source: 'upload-execution-runtime-boundaries',
    boundaryStatus: 'invalid',
    boundaryKind: 'unsupported',
    boundaryNextAction: 'invalid',
    runtimeBoundariesDesigned: false,
    sourceImplementationBoundaryFingerprintVerified: false,
    runtimeExecutionAllowed: false,
    executionStillDisabled: false,
    adapterName: null,
    adapterBackendKind: 'unsupported',
    sourceImplementationBoundaryFingerprint: emptyFingerprint(
      'stage-knowledge-pack-upload-execution-implementation-boundary-v1',
      IMPLEMENTATION_BOUNDARY_FINGERPRINT_FIELD_COUNT
    ),
    runtimeBoundariesFingerprint: emptyFingerprint(
      'stage-knowledge-pack-upload-execution-runtime-boundaries-v1',
      RUNTIME_BOUNDARIES_FINGERPRINT_FIELD_COUNT
    )
  };
}

function readSafeTarget(
  runtimeBoundaries: Record<string, unknown>,
  blockers: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewBlocker[]
): KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReview['target'] {
  if (!isRecord(runtimeBoundaries.target)) {
    addBlocker(blockers, 'missing-required-field', '$.runtimeBoundaries.target', 'Runtime-boundaries target must be an object.');
    return emptyTarget();
  }
  const target = runtimeBoundaries.target;
  const manifestId = typeof target.manifestId === 'string' && SAFE_ID_PATTERN.test(target.manifestId)
    ? target.manifestId
    : null;
  const artifactId = typeof target.artifactId === 'string' && SAFE_ID_PATTERN.test(target.artifactId)
    ? target.artifactId
    : null;
  const objectSha256 = typeof target.objectSha256 === 'string' && isKnowledgeTeamArtifactSha256(target.objectSha256)
    ? target.objectSha256
    : null;

  if (manifestId === null) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.runtimeBoundaries.target.manifestId', 'Target manifest id must be a safe 24-character lowercase hex id.');
  }
  if (artifactId === null) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.runtimeBoundaries.target.artifactId', 'Target artifact id must be a safe 24-character lowercase hex id.');
  }
  if (objectSha256 === null) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.runtimeBoundaries.target.objectSha256', 'Target object hash must be a safe SHA-256 hex digest.');
  }
  if (target.objectKeyRedacted !== true) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.runtimeBoundaries.target.objectKeyRedacted', 'Target object key must remain redacted.');
  }
  if (Object.hasOwn(target, 'objectKey')) {
    addBlocker(blockers, 'unsafe-artifact-reference', '$.runtimeBoundaries.target.objectKey', 'Target object key must not be copied into policy-review output.');
  }

  return {
    manifestId,
    objectKeyRedacted: true,
    objectSha256,
    artifactId
  };
}

function readFingerprint(
  value: unknown,
  path: string,
  expectedScope: Fingerprint['scope'],
  expectedCanonicalFieldCount: number,
  blockers: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewBlocker[]
): Fingerprint {
  if (!isRecord(value)) {
    addBlocker(blockers, 'runtime-boundaries-fingerprint-missing', path, 'Required source fingerprint object is missing.');
    return emptyFingerprint(expectedScope, expectedCanonicalFieldCount);
  }
  const algorithm = value.algorithm === 'sha256' ? 'sha256' : 'unsupported';
  const scope = value.scope === expectedScope ? expectedScope : 'unsupported';
  const canonicalFieldCount = value.canonicalFieldCount === expectedCanonicalFieldCount
    ? expectedCanonicalFieldCount
    : null;
  const fingerprintValue = typeof value.value === 'string' && SAFE_FINGERPRINT_PATTERN.test(value.value)
    ? value.value
    : null;

  if (algorithm !== 'sha256' || scope === 'unsupported' || canonicalFieldCount === null) {
    addBlocker(blockers, 'runtime-boundaries-fingerprint-unsupported', path, 'Source fingerprint metadata must use the expected sha256 scope and canonical field count.');
  }
  if (fingerprintValue === null) {
    addBlocker(blockers, 'runtime-boundaries-fingerprint-missing', `${path}.value`, 'Source fingerprint value must be a safe SHA-256 hex string.');
  }

  return {
    algorithm,
    scope,
    value: fingerprintValue,
    canonicalFieldCount
  };
}

function readBoundaryStatus(
  value: unknown
): KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReview['sourceRuntimeBoundaries']['boundaryStatus'] {
  return value === 'upload-execution-runtime-boundaries-ready' || value === 'blocked'
    ? value
    : 'invalid';
}

function readBoundaryKind(
  value: unknown
): KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReview['sourceRuntimeBoundaries']['boundaryKind'] {
  return value === 'upload-execution-runtime-boundaries-dry-run' ? value : 'unsupported';
}

function readBoundaryNextAction(
  value: unknown
): KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReview['sourceRuntimeBoundaries']['boundaryNextAction'] {
  return value === 'await-explicit-upload-execution-runtime-boundary-policy-review' || value === 'resolve-blockers'
    ? value
    : 'invalid';
}

function readAdapterBackendKind(value: unknown): AdapterBackendKind {
  return value === 'mock-s3-compatible' || value === 's3-compatible' ? value : 'unsupported';
}

function blockerCodeForFalseField(field: string): KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewBlockerCode {
  switch (field) {
    case 'remoteWriteAllowed':
    case 'objectWriteAllowed':
    case 'metadataIndexWriteAllowed':
      return 'remote-write-enabled';
    case 'liveCheckAllowed':
    case 'liveCheckPerformed':
      return 'live-check-enabled';
    case 'liveCheckResultExposed':
      return 'live-check-result-exposed';
    case 'credentialValuesRead':
      return 'credential-values-read';
    case 'credentialValuesExposed':
      return 'credential-values-exposed';
    case 'credentialPresenceChecked':
      return 'credential-presence-check-enabled';
    case 'credentialPresenceResultExposed':
      return 'credential-presence-result-exposed';
    case 'uploadApproved':
      return 'upload-approval-already-provided';
    case 'uploadExecutionApproved':
      return 'upload-execution-approval-already-provided';
    case 'uploadExecutionAllowed':
    case 'runtimeExecutionAllowed':
      return 'upload-execution-enabled';
    case 'mutationApprovalGranted':
      return 'mutation-approval-already-granted';
    case 'clientCreated':
      return 'client-created';
    case 'adapterInjected':
      return 'adapter-injected';
    case 'artifactBytesProvided':
      return 'artifact-bytes-provided';
    case 'writeTokenIssued':
      return 'write-token-issued';
    case 'executionLeaseCreated':
      return 'execution-lease-created';
    case 'rollbackPlanCreated':
      return 'rollback-plan-created';
    case 'auditRecordCreated':
      return 'audit-record-created';
    case 'objectWriteAttempted':
      return 'object-write-attempted';
    case 'metadataIndexWriteAttempted':
      return 'metadata-index-write-attempted';
    case 'remoteMutationPerformed':
      return 'remote-mutation-performed';
    case 'executable':
      return 'executable-state-enabled';
    case 'uploadCommandGenerated':
    case 'uploadCommandMaterialized':
      return 'upload-command-generated';
    case 'uploadCommandExposed':
      return 'upload-command-exposed';
    case 'artifactObjectStoreBound':
      return 'artifact-object-store-bound';
    case 'metadataIndexBound':
      return 'metadata-index-bound';
    case 'objectStoreHandleExposed':
      return 'object-store-handle-leak';
    case 'metadataIndexHandleExposed':
      return 'metadata-index-handle-leak';
    default:
      return 'runtime-boundary-policy-review-enabled-execution';
  }
}

function validateNonExecutionPosture(
  runtimeBoundaries: Record<string, unknown>,
  blockers: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewBlocker[]
): boolean {
  let executionStillDisabled = true;
  for (const field of TOP_LEVEL_FALSE_FIELDS) {
    if (runtimeBoundaries[field] !== false) {
      executionStillDisabled = false;
      addBlocker(blockers, blockerCodeForFalseField(field), `$.runtimeBoundaries.${field}`, `${field} must remain false before runtime-boundary policy review.`);
    }
  }
  if (runtimeBoundaries.uploadCommand !== null) {
    executionStillDisabled = false;
    addBlocker(blockers, 'upload-command-present', '$.runtimeBoundaries.uploadCommand', 'Runtime-boundaries artifact must not include upload commands.');
  }
  if (!isRecord(runtimeBoundaries.executionBoundary)) {
    executionStillDisabled = false;
    addBlocker(blockers, 'missing-required-field', '$.runtimeBoundaries.executionBoundary', 'Runtime-boundaries executionBoundary must be an object.');
    return false;
  }
  if (runtimeBoundaries.executionBoundary.dryRunOnly !== true) {
    executionStillDisabled = false;
    addBlocker(blockers, 'executable-state-enabled', '$.runtimeBoundaries.executionBoundary.dryRunOnly', 'Execution boundary must remain dry-run only.');
  }
  for (const field of EXECUTION_BOUNDARY_FALSE_FIELDS) {
    if (runtimeBoundaries.executionBoundary[field] !== false) {
      executionStillDisabled = false;
      addBlocker(blockers, blockerCodeForFalseField(field), `$.runtimeBoundaries.executionBoundary.${field}`, `${field} must remain false before runtime-boundary policy review.`);
    }
  }
  return executionStillDisabled;
}

function validateRuntimeBoundarySection(
  runtimeBoundarySection: Record<string, unknown>,
  blockers: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewBlocker[]
): void {
  for (const field of RUNTIME_BOUNDARY_REQUIRED_TRUE_FIELDS) {
    if (runtimeBoundarySection[field] !== true) {
      addBlocker(blockers, 'runtime-boundaries-not-ready', `$.runtimeBoundaries.runtimeBoundaries.${field}`, `${field} must be true before runtime-boundary policy review.`);
    }
  }
  for (const field of RUNTIME_BOUNDARY_REQUIRED_FALSE_FIELDS) {
    if (runtimeBoundarySection[field] !== false) {
      addBlocker(blockers, blockerCodeForFalseField(field), `$.runtimeBoundaries.runtimeBoundaries.${field}`, `${field} must remain false before runtime-boundary policy review.`);
    }
  }
}

function parseRuntimeBoundariesForPolicyReview(
  input: unknown,
  blockers: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewBlocker[]
): ParsedRuntimeBoundariesForPolicyReview {
  inspectForForbiddenPolicyReviewMaterial(input, '$.runtimeBoundaries', blockers);
  if (!isRecord(input)) {
    addBlocker(blockers, 'missing-required-field', '$.runtimeBoundaries', 'Runtime-boundaries input must be an object.');
    return {
      target: emptyTarget(),
      sourceRuntimeBoundaries: emptySourceRuntimeBoundaries()
    };
  }

  if (input.kind !== 'infra-agent.knowledge-team-upload-execution-runtime-boundaries') {
    addBlocker(blockers, 'invalid-runtime-boundaries-kind', '$.runtimeBoundaries.kind', 'Input must be a runtime-boundaries artifact.');
  }
  if (input.schemaVersion !== 1) {
    addBlocker(blockers, 'invalid-schema-version', '$.runtimeBoundaries.schemaVersion', 'Runtime-boundaries schemaVersion must be 1.');
  }
  if (input.mutationAllowed !== false || input.executionMode !== 'dry-run') {
    addBlocker(blockers, 'mutation-enabled', '$.runtimeBoundaries.mutationAllowed', 'Runtime-boundaries artifact must remain dry-run and non-mutating.');
  }

  const boundaryStatus = readBoundaryStatus(input.status);
  const boundaryKind = readBoundaryKind(input.boundaryKind);
  const boundaryNextAction = isRecord(input.readiness) ? readBoundaryNextAction(input.readiness.nextAction) : 'invalid';
  if (boundaryKind !== 'upload-execution-runtime-boundaries-dry-run') {
    addBlocker(blockers, 'invalid-runtime-boundaries-kind', '$.runtimeBoundaries.boundaryKind', 'Runtime-boundaries kind is unsupported.');
  }
  if (boundaryStatus !== 'upload-execution-runtime-boundaries-ready') {
    addBlocker(blockers, 'runtime-boundaries-not-ready', '$.runtimeBoundaries.status', 'Runtime-boundaries artifact must be ready.');
  }
  if (boundaryNextAction !== 'await-explicit-upload-execution-runtime-boundary-policy-review') {
    addBlocker(blockers, 'runtime-boundaries-next-action-invalid', '$.runtimeBoundaries.readiness.nextAction', 'Runtime-boundaries artifact must point at explicit policy review.');
  }
  if (!isRecord(input.readiness) || input.readiness.blockerCount !== 0) {
    addBlocker(blockers, 'runtime-boundaries-not-ready', '$.runtimeBoundaries.readiness.blockerCount', 'Runtime-boundaries artifact must be unblocked before policy review.');
  }

  const executionStillDisabled = validateNonExecutionPosture(input, blockers);
  const target = readSafeTarget(input, blockers);
  const sourceImplementationBoundary = isRecord(input.sourceImplementationBoundary) ? input.sourceImplementationBoundary : {};
  const runtimeBoundarySection = isRecord(input.runtimeBoundaries) ? input.runtimeBoundaries : {};
  if (!isRecord(input.sourceImplementationBoundary)) {
    addBlocker(blockers, 'missing-required-field', '$.runtimeBoundaries.sourceImplementationBoundary', 'Source implementation boundary summary must be present.');
  }
  if (!isRecord(input.runtimeBoundaries)) {
    addBlocker(blockers, 'missing-required-field', '$.runtimeBoundaries.runtimeBoundaries', 'Runtime-boundary summary must be present.');
  }
  validateRuntimeBoundarySection(runtimeBoundarySection, blockers);

  const adapterName = typeof sourceImplementationBoundary.adapterName === 'string'
    && isSafeKnowledgeTeamBackendAdapterName(sourceImplementationBoundary.adapterName)
    ? sourceImplementationBoundary.adapterName
    : null;
  if (adapterName === null) {
    addBlocker(blockers, 'unsafe-adapter-name', '$.runtimeBoundaries.sourceImplementationBoundary.adapterName', 'Source adapter name must be present and safe.');
  }
  const adapterBackendKind = readAdapterBackendKind(sourceImplementationBoundary.adapterBackendKind);
  if (adapterBackendKind !== 'mock-s3-compatible') {
    addBlocker(blockers, 'unsupported-adapter-backend', '$.runtimeBoundaries.sourceImplementationBoundary.adapterBackendKind', 'Runtime-boundary policy review currently supports only mock-s3-compatible dry-run sources.');
  }

  const sourceImplementationBoundaryFingerprint = readFingerprint(
    runtimeBoundarySection.sourceImplementationBoundaryFingerprint,
    '$.runtimeBoundaries.runtimeBoundaries.sourceImplementationBoundaryFingerprint',
    'stage-knowledge-pack-upload-execution-implementation-boundary-v1',
    IMPLEMENTATION_BOUNDARY_FINGERPRINT_FIELD_COUNT,
    blockers
  );
  const copiedSourceImplementationBoundaryFingerprint = readFingerprint(
    sourceImplementationBoundary.implementationBoundaryFingerprint,
    '$.runtimeBoundaries.sourceImplementationBoundary.implementationBoundaryFingerprint',
    'stage-knowledge-pack-upload-execution-implementation-boundary-v1',
    IMPLEMENTATION_BOUNDARY_FINGERPRINT_FIELD_COUNT,
    blockers
  );
  const runtimeBoundariesFingerprint = readFingerprint(
    runtimeBoundarySection.runtimeBoundariesFingerprint,
    '$.runtimeBoundaries.runtimeBoundaries.runtimeBoundariesFingerprint',
    'stage-knowledge-pack-upload-execution-runtime-boundaries-v1',
    RUNTIME_BOUNDARIES_FINGERPRINT_FIELD_COUNT,
    blockers
  );

  if (sourceImplementationBoundaryFingerprint.value === null
    || runtimeBoundariesFingerprint.value === null) {
    addBlocker(blockers, 'runtime-boundaries-fingerprint-unverified', '$.runtimeBoundaries.runtimeBoundaries', 'Runtime-boundary fingerprints must be present before policy review.');
  }
  if (sourceImplementationBoundaryFingerprint.value !== null
    && copiedSourceImplementationBoundaryFingerprint.value !== null
    && sourceImplementationBoundaryFingerprint.value !== copiedSourceImplementationBoundaryFingerprint.value) {
    addBlocker(blockers, 'runtime-boundaries-fingerprint-unverified', '$.runtimeBoundaries.sourceImplementationBoundary.implementationBoundaryFingerprint.value', 'Source implementation boundary fingerprints must match.');
  }

  const sourceRuntimeBoundaries: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReview['sourceRuntimeBoundaries'] = {
    source: 'upload-execution-runtime-boundaries',
    boundaryStatus,
    boundaryKind,
    boundaryNextAction,
    runtimeBoundariesDesigned: readBool(runtimeBoundarySection.runtimeBoundariesDesigned),
    sourceImplementationBoundaryFingerprintVerified: readBool(runtimeBoundarySection.sourceImplementationBoundaryFingerprintVerified),
    runtimeExecutionAllowed: readBool(runtimeBoundarySection.runtimeExecutionAllowed),
    executionStillDisabled,
    adapterName,
    adapterBackendKind,
    sourceImplementationBoundaryFingerprint,
    runtimeBoundariesFingerprint
  };

  if (sourceRuntimeBoundaries.runtimeExecutionAllowed) {
    addBlocker(blockers, 'upload-execution-enabled', '$.runtimeBoundaries.runtimeBoundaries.runtimeExecutionAllowed', 'Runtime execution must remain disabled before policy review.');
  }
  if (!sourceRuntimeBoundaries.runtimeBoundariesDesigned
    || !sourceRuntimeBoundaries.sourceImplementationBoundaryFingerprintVerified
    || !sourceRuntimeBoundaries.executionStillDisabled) {
    addBlocker(blockers, 'runtime-boundaries-not-ready', '$.runtimeBoundaries.runtimeBoundaries', 'Runtime boundaries must be designed, verified, and non-executing before policy review.');
  }
  if (readBool(input.runtimeBoundaryPolicyUpdated)) {
    addBlocker(blockers, 'policy-update-already-recorded', '$.runtimeBoundaries.runtimeBoundaryPolicyUpdated', 'Policy updates must be recorded by a separate explicit artifact.');
  }
  if (readBool(input.policyUpdateAuthorized)) {
    addBlocker(blockers, 'policy-update-already-authorized', '$.runtimeBoundaries.policyUpdateAuthorized', 'Policy update authorization must not be embedded in policy review input.');
  }

  return {
    target,
    sourceRuntimeBoundaries
  };
}

function buildPolicyReviewFingerprint(
  parsed: ParsedRuntimeBoundariesForPolicyReview,
  ready: boolean
): Fingerprint {
  if (!ready || parsed.sourceRuntimeBoundaries.runtimeBoundariesFingerprint.value === null) {
    return {
      algorithm: 'sha256',
      scope: 'stage-knowledge-pack-upload-execution-runtime-boundary-policy-review-v1',
      value: null,
      canonicalFieldCount: POLICY_REVIEW_FINGERPRINT_FIELD_COUNT
    };
  }

  const canonicalFields = [
    ['scope', 'stage-knowledge-pack-upload-execution-runtime-boundary-policy-review-v1'],
    ['plannedOperation', 'stage-knowledge-pack'],
    ['sourceKind', 'infra-agent.knowledge-team-upload-execution-runtime-boundaries'],
    ['sourceStatus', parsed.sourceRuntimeBoundaries.boundaryStatus],
    ['sourceNextAction', parsed.sourceRuntimeBoundaries.boundaryNextAction],
    ['manifestId', parsed.target.manifestId],
    ['objectSha256', parsed.target.objectSha256],
    ['artifactId', parsed.target.artifactId],
    ['sourceImplementationBoundaryFingerprint', parsed.sourceRuntimeBoundaries.sourceImplementationBoundaryFingerprint.value],
    ['sourceRuntimeBoundariesFingerprint', parsed.sourceRuntimeBoundaries.runtimeBoundariesFingerprint.value],
    ['runtimeBoundaryPolicyReviewed', 'true'],
    ['artifactBytesPolicyReviewed', 'true'],
    ['adapterInjectionPolicyReviewed', 'true'],
    ['clientCreationPolicyReviewed', 'true'],
    ['credentialReadPolicyReviewed', 'true'],
    ['credentialPresencePolicyReviewed', 'true'],
    ['liveCheckPolicyReviewed', 'true'],
    ['commandGenerationPolicyReviewed', 'true'],
    ['objectIndexBindingPolicyReviewed', 'true'],
    ['writeTokenPolicyReviewed', 'true'],
    ['executionLeasePolicyReviewed', 'true'],
    ['rollbackPolicyReviewed', 'true'],
    ['auditPolicyReviewed', 'true'],
    ['remoteMutationPolicyReviewed', 'true']
  ] as const;

  return {
    algorithm: 'sha256',
    scope: 'stage-knowledge-pack-upload-execution-runtime-boundary-policy-review-v1',
    value: createHash('sha256')
      .update(canonicalFields.map(([key, value]) => `${key}=${value}`).join('\n'))
      .digest('hex'),
    canonicalFieldCount: POLICY_REVIEW_FINGERPRINT_FIELD_COUNT
  };
}

function buildExecutionBoundary(): KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReview['executionBoundary'] {
  return {
    dryRunOnly: true,
    executable: false,
    artifactBytesProvided: false,
    adapterInjected: false,
    clientCreated: false,
    credentialValuesRead: false,
    credentialValuesExposed: false,
    credentialPresenceChecked: false,
    credentialPresenceResultExposed: false,
    liveCheckAllowed: false,
    liveCheckPerformed: false,
    liveCheckResultExposed: false,
    uploadCommandGenerated: false,
    uploadCommandMaterialized: false,
    uploadCommandExposed: false,
    artifactObjectStoreBound: false,
    metadataIndexBound: false,
    objectStoreHandleExposed: false,
    metadataIndexHandleExposed: false,
    objectWriteAllowed: false,
    metadataIndexWriteAllowed: false,
    objectWriteAttempted: false,
    metadataIndexWriteAttempted: false,
    writeTokenIssued: false,
    executionLeaseCreated: false,
    rollbackPlanCreated: false,
    auditRecordCreated: false,
    remoteMutationPerformed: false
  };
}

export function buildKnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReview(
  input: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewInput
): KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReview {
  const blockers: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewBlocker[] = [];
  const parsed = parseRuntimeBoundariesForPolicyReview(input.runtimeBoundaries, blockers);
  const ready = blockers.length === 0;
  const status: KnowledgeTeamUploadExecutionRuntimeBoundaryPolicyReviewStatus = ready
    ? 'upload-execution-runtime-boundary-policy-review-ready'
    : 'blocked';
  const reviewFingerprint = buildPolicyReviewFingerprint(parsed, ready);

  return {
    kind: 'infra-agent.knowledge-team-upload-execution-runtime-boundary-policy-review',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    reviewKind: 'upload-execution-runtime-boundary-policy-review-dry-run',
    status,
    plannedOperation: 'stage-knowledge-pack',
    remoteWriteAllowed: false,
    liveCheckAllowed: false,
    credentialValuesExposed: false,
    credentialPresenceChecked: false,
    uploadApproved: false,
    uploadExecutionApproved: false,
    uploadExecutionAllowed: false,
    mutationApprovalGranted: false,
    clientCreated: false,
    adapterInjected: false,
    artifactBytesProvided: false,
    writeTokenIssued: false,
    executionLeaseCreated: false,
    rollbackPlanCreated: false,
    auditRecordCreated: false,
    objectWriteAttempted: false,
    metadataIndexWriteAttempted: false,
    remoteMutationPerformed: false,
    uploadCommand: null,
    target: parsed.target,
    sourceRuntimeBoundaries: parsed.sourceRuntimeBoundaries,
    runtimeBoundaryPolicyReview: {
      dryRunOnly: true,
      runtimeBoundaryPolicyReviewRequired: true,
      runtimeBoundaryPolicyReviewed: ready,
      runtimeBoundaryPolicyUpdated: false,
      policyUpdateAuthorized: false,
      executionStillDisabled: true,
      runtimeExecutionStillProhibited: true,
      uploadExecutionStillProhibited: true,
      commandGenerationStillProhibited: true,
      objectWriteStillProhibited: true,
      metadataIndexWriteStillProhibited: true,
      reviewedCapabilityFamilies: REVIEWED_CAPABILITY_FAMILIES,
      artifactBytesPolicyReviewed: ready,
      adapterInjectionPolicyReviewed: ready,
      clientCreationPolicyReviewed: ready,
      credentialReadPolicyReviewed: ready,
      credentialPresencePolicyReviewed: ready,
      liveCheckPolicyReviewed: ready,
      commandGenerationPolicyReviewed: ready,
      objectIndexBindingPolicyReviewed: ready,
      writeTokenPolicyReviewed: ready,
      executionLeasePolicyReviewed: ready,
      rollbackPolicyReviewed: ready,
      auditPolicyReviewed: ready,
      remoteMutationPolicyReviewed: ready,
      separatePolicyUpdateRequired: true,
      nextRequiredPolicyUpdate: 'explicit-runtime-boundary-policy-update',
      requiredReviewDocuments: [
        'docs/HANDOFF.md',
        'docs/ROADMAP.md',
        'docs/AGENT_RULES.md',
        'docs/CLAUDE_CODE_AGENT_PATTERNS.md'
      ],
      reviewFingerprint
    },
    toolCapabilityPolicy: {
      allowedCapabilityFamilies: [
        'read-saved-json',
        'validate-contract',
        'write-local-artifact'
      ],
      disallowedCapabilityFamilies: [
        'sdk-client',
        'credential-read',
        'live-backend-check',
        'shell-command-generation',
        'object-store-write',
        'metadata-index-write',
        'remote-mutation'
      ]
    },
    handoffPolicy: {
      compact: true,
      rawRuntimeIncluded: false,
      rawToolOutputIncluded: false,
      credentialMaterialIncluded: false,
      commandMaterialIncluded: false,
      backendHandlesIncluded: false
    },
    executionBoundary: buildExecutionBoundary(),
    readiness: {
      status,
      nextAction: ready
        ? 'await-explicit-upload-execution-runtime-boundary-policy-update'
        : 'resolve-blockers',
      blockerCount: blockers.length,
      blockerCodes: [...new Set(blockers.map((blocker) => blocker.code))],
      blockers,
      reason: ready
        ? 'Upload execution runtime-boundary policy review is recorded as a dry-run checkpoint; policy updates and execution remain prohibited.'
        : 'Upload execution runtime-boundary policy review is blocked because the runtime-boundaries source is incomplete, unsafe, leaky, non-ready, policy-updated, or already executable.'
    }
  };
}
