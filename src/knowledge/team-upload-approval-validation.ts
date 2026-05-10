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
import { isSafeKnowledgeTeamBackendAdapterName } from './team-backend-adapter.ts';
import { isSafeKnowledgeTeamArtifactObjectKey } from './team-artifact-store.ts';

const SAFE_SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_ENV_VAR_NAME_PATTERN = /^[A-Z_][A-Z0-9_]{0,127}$/;
const UPLOAD_INTENT_STATUSES = ['approval-required', 'blocked'] as const;
const UPLOAD_INTENT_NEXT_ACTIONS = ['request-explicit-upload-approval', 'resolve-blockers'] as const;
const UPLOAD_CONTINUATION_STATUSES = ['continuation-ready', 'blocked'] as const;
const UPLOAD_CONTINUATION_NEXT_ACTIONS = ['inject-approved-adapter-dependencies', 'resolve-blockers'] as const;
const UPLOAD_ADAPTER_PREFLIGHT_STATUSES = ['preflight-ready', 'blocked'] as const;
const UPLOAD_ADAPTER_PREFLIGHT_NEXT_ACTIONS = ['inject-mock-adapter-in-test-harness', 'resolve-blockers'] as const;
const UPLOAD_ADAPTER_PREFLIGHT_CONTINUATION_STATUSES = ['continuation-ready', 'blocked', 'invalid'] as const;
const UPLOAD_ADAPTER_PREFLIGHT_BACKENDS = ['mock-s3-compatible', 's3-compatible', 'unsupported'] as const;
const UPLOAD_ADAPTER_PREFLIGHT_RESOLUTION_STATUSES = ['resolvable', 'blocked', 'not-resolved'] as const;
const UPLOAD_MOCK_HARNESS_STATUSES = ['harness-ready', 'blocked'] as const;
const UPLOAD_MOCK_HARNESS_NEXT_ACTIONS = ['run-mock-only-contract-tests', 'resolve-blockers'] as const;
const UPLOAD_MOCK_HARNESS_BACKENDS = ['mock-s3-compatible', 'unsupported'] as const;
const UPLOAD_MOCK_HARNESS_PREFLIGHT_STATUSES = ['preflight-ready', 'blocked', 'invalid'] as const;
const UPLOAD_EXECUTION_GATE_STATUSES = ['gate-ready', 'blocked'] as const;
const UPLOAD_EXECUTION_GATE_NEXT_ACTIONS = ['request-separate-mutation-approval', 'resolve-blockers'] as const;
const UPLOAD_EXECUTION_GATE_CONTINUATION_STATUSES = ['continuation-ready', 'blocked', 'invalid'] as const;
const UPLOAD_EXECUTION_GATE_HARNESS_STATUSES = ['harness-ready', 'blocked', 'invalid'] as const;
const UPLOAD_EXECUTION_GATE_HARNESS_KINDS = ['in-memory-mock', 'unsupported'] as const;
const UPLOAD_EXECUTION_GATE_ADAPTER_BACKENDS = ['mock-s3-compatible', 's3-compatible', 'unsupported'] as const;
const UPLOAD_MUTATION_PLAN_STATUSES = ['plan-ready', 'blocked'] as const;
const UPLOAD_MUTATION_PLAN_NEXT_ACTIONS = ['request-human-mutation-approval', 'resolve-blockers'] as const;
const UPLOAD_MUTATION_PLAN_GATE_STATUSES = ['gate-ready', 'blocked', 'invalid'] as const;
const UPLOAD_MUTATION_PLAN_GATE_KINDS = ['approval-gated-dry-run', 'unsupported'] as const;
const UPLOAD_MUTATION_PLAN_GATE_NEXT_ACTIONS = ['request-separate-mutation-approval', 'resolve-blockers', 'invalid'] as const;
const UPLOAD_MUTATION_PLAN_CONTINUATION_STATUSES = ['continuation-ready', 'blocked', 'invalid'] as const;
const UPLOAD_MUTATION_PLAN_HARNESS_STATUSES = ['harness-ready', 'blocked', 'invalid'] as const;
const UPLOAD_MUTATION_PLAN_HARNESS_KINDS = ['in-memory-mock', 'unsupported'] as const;
const UPLOAD_MUTATION_PLAN_ADAPTER_BACKENDS = ['mock-s3-compatible', 's3-compatible', 'unsupported'] as const;
const UPLOAD_MUTATION_APPROVAL_REVIEW_STATUSES = ['review-ready', 'blocked'] as const;
const UPLOAD_MUTATION_APPROVAL_REVIEW_NEXT_ACTIONS = ['plan-execution-prerequisite-boundaries', 'resolve-blockers'] as const;
const UPLOAD_MUTATION_APPROVAL_REVIEW_PLAN_STATUSES = ['plan-ready', 'blocked', 'invalid'] as const;
const UPLOAD_MUTATION_APPROVAL_REVIEW_PLAN_KINDS = ['approval-audit-dry-run', 'unsupported'] as const;
const UPLOAD_MUTATION_APPROVAL_REVIEW_PLAN_NEXT_ACTIONS = ['request-human-mutation-approval', 'resolve-blockers', 'invalid'] as const;
const UPLOAD_MUTATION_APPROVAL_REVIEW_GATE_STATUSES = ['gate-ready', 'blocked', 'invalid'] as const;
const UPLOAD_MUTATION_APPROVAL_REVIEW_GATE_KINDS = ['approval-gated-dry-run', 'unsupported'] as const;
const UPLOAD_MUTATION_APPROVAL_REVIEW_CONTINUATION_STATUSES = ['continuation-ready', 'blocked', 'invalid'] as const;
const UPLOAD_MUTATION_APPROVAL_REVIEW_HARNESS_STATUSES = ['harness-ready', 'blocked', 'invalid'] as const;
const UPLOAD_MUTATION_APPROVAL_REVIEW_HARNESS_KINDS = ['in-memory-mock', 'unsupported'] as const;
const UPLOAD_MUTATION_APPROVAL_REVIEW_ADAPTER_BACKENDS = ['mock-s3-compatible', 's3-compatible', 'unsupported'] as const;
const UPLOAD_EXECUTION_PREREQUISITE_PLAN_STATUSES = ['prerequisite-plan-ready', 'blocked'] as const;
const UPLOAD_EXECUTION_PREREQUISITE_PLAN_NEXT_ACTIONS = ['design-write-token-boundary', 'resolve-blockers'] as const;
const UPLOAD_EXECUTION_PREREQUISITE_PLAN_REVIEW_STATUSES = ['review-ready', 'blocked', 'invalid'] as const;
const UPLOAD_EXECUTION_PREREQUISITE_PLAN_REVIEW_KINDS = ['human-fingerprint-dry-run', 'unsupported'] as const;
const UPLOAD_EXECUTION_PREREQUISITE_PLAN_REVIEW_NEXT_ACTIONS = ['plan-execution-prerequisite-boundaries', 'resolve-blockers', 'invalid'] as const;
const UPLOAD_EXECUTION_PREREQUISITE_PLAN_PLAN_STATUSES = ['plan-ready', 'blocked', 'invalid'] as const;
const UPLOAD_EXECUTION_PREREQUISITE_PLAN_PLAN_NEXT_ACTIONS = ['request-human-mutation-approval', 'resolve-blockers', 'invalid'] as const;
const UPLOAD_EXECUTION_PREREQUISITE_PLAN_GATE_STATUSES = ['gate-ready', 'blocked', 'invalid'] as const;
const UPLOAD_EXECUTION_PREREQUISITE_PLAN_ADAPTER_BACKENDS = ['mock-s3-compatible', 's3-compatible', 'unsupported'] as const;
const UPLOAD_WRITE_TOKEN_BOUNDARY_STATUSES = ['write-token-boundary-ready', 'blocked'] as const;
const UPLOAD_WRITE_TOKEN_BOUNDARY_NEXT_ACTIONS = ['design-execution-lease-boundary', 'resolve-blockers'] as const;
const UPLOAD_WRITE_TOKEN_BOUNDARY_PREREQUISITE_STATUSES = ['prerequisite-plan-ready', 'blocked', 'invalid'] as const;
const UPLOAD_WRITE_TOKEN_BOUNDARY_PREREQUISITE_KINDS = ['execution-prerequisite-boundary-dry-run', 'unsupported'] as const;
const UPLOAD_WRITE_TOKEN_BOUNDARY_PREREQUISITE_NEXT_ACTIONS = ['design-write-token-boundary', 'resolve-blockers', 'invalid'] as const;
const UPLOAD_WRITE_TOKEN_BOUNDARY_REVIEW_STATUSES = ['review-ready', 'blocked', 'invalid'] as const;
const UPLOAD_WRITE_TOKEN_BOUNDARY_REVIEW_KINDS = ['human-fingerprint-dry-run', 'unsupported'] as const;
const UPLOAD_WRITE_TOKEN_BOUNDARY_ADAPTER_BACKENDS = ['mock-s3-compatible', 's3-compatible', 'unsupported'] as const;
const UPLOAD_EXECUTION_LEASE_BOUNDARY_STATUSES = ['execution-lease-boundary-ready', 'blocked'] as const;
const UPLOAD_EXECUTION_LEASE_BOUNDARY_NEXT_ACTIONS = ['design-rollback-plan-boundary', 'resolve-blockers'] as const;
const UPLOAD_EXECUTION_LEASE_BOUNDARY_SOURCE_STATUSES = ['write-token-boundary-ready', 'blocked', 'invalid'] as const;
const UPLOAD_EXECUTION_LEASE_BOUNDARY_SOURCE_KINDS = ['write-token-boundary-dry-run', 'unsupported'] as const;
const UPLOAD_EXECUTION_LEASE_BOUNDARY_SOURCE_NEXT_ACTIONS = ['design-execution-lease-boundary', 'resolve-blockers', 'invalid'] as const;
const UPLOAD_EXECUTION_LEASE_BOUNDARY_REVIEW_STATUSES = ['review-ready', 'blocked', 'invalid'] as const;
const UPLOAD_EXECUTION_LEASE_BOUNDARY_REVIEW_KINDS = ['human-fingerprint-dry-run', 'unsupported'] as const;
const UPLOAD_EXECUTION_LEASE_BOUNDARY_ADAPTER_BACKENDS = ['mock-s3-compatible', 's3-compatible', 'unsupported'] as const;
const UPLOAD_ROLLBACK_PLAN_BOUNDARY_STATUSES = ['rollback-plan-boundary-ready', 'blocked'] as const;
const UPLOAD_ROLLBACK_PLAN_BOUNDARY_NEXT_ACTIONS = ['design-audit-record-boundary', 'resolve-blockers'] as const;
const UPLOAD_ROLLBACK_PLAN_BOUNDARY_SOURCE_STATUSES = ['execution-lease-boundary-ready', 'blocked', 'invalid'] as const;
const UPLOAD_ROLLBACK_PLAN_BOUNDARY_SOURCE_KINDS = ['execution-lease-boundary-dry-run', 'unsupported'] as const;
const UPLOAD_ROLLBACK_PLAN_BOUNDARY_SOURCE_NEXT_ACTIONS = ['design-rollback-plan-boundary', 'resolve-blockers', 'invalid'] as const;
const UPLOAD_ROLLBACK_PLAN_BOUNDARY_REVIEW_STATUSES = ['review-ready', 'blocked', 'invalid'] as const;
const UPLOAD_ROLLBACK_PLAN_BOUNDARY_REVIEW_KINDS = ['human-fingerprint-dry-run', 'unsupported'] as const;
const UPLOAD_ROLLBACK_PLAN_BOUNDARY_ADAPTER_BACKENDS = ['mock-s3-compatible', 's3-compatible', 'unsupported'] as const;
const UPLOAD_AUDIT_RECORD_BOUNDARY_STATUSES = ['audit-record-boundary-ready', 'blocked'] as const;
const UPLOAD_AUDIT_RECORD_BOUNDARY_NEXT_ACTIONS = ['design-artifact-bytes-boundary', 'resolve-blockers'] as const;
const UPLOAD_AUDIT_RECORD_BOUNDARY_SOURCE_STATUSES = ['rollback-plan-boundary-ready', 'blocked', 'invalid'] as const;
const UPLOAD_AUDIT_RECORD_BOUNDARY_SOURCE_KINDS = ['rollback-plan-boundary-dry-run', 'unsupported'] as const;
const UPLOAD_AUDIT_RECORD_BOUNDARY_SOURCE_NEXT_ACTIONS = ['design-audit-record-boundary', 'resolve-blockers', 'invalid'] as const;
const UPLOAD_AUDIT_RECORD_BOUNDARY_REVIEW_STATUSES = ['review-ready', 'blocked', 'invalid'] as const;
const UPLOAD_AUDIT_RECORD_BOUNDARY_REVIEW_KINDS = ['human-fingerprint-dry-run', 'unsupported'] as const;
const UPLOAD_AUDIT_RECORD_BOUNDARY_ADAPTER_BACKENDS = ['mock-s3-compatible', 's3-compatible', 'unsupported'] as const;
const UPLOAD_ARTIFACT_BYTES_BOUNDARY_STATUSES = ['artifact-bytes-boundary-ready', 'blocked'] as const;
const UPLOAD_ARTIFACT_BYTES_BOUNDARY_NEXT_ACTIONS = ['design-adapter-injection-boundary', 'resolve-blockers'] as const;
const UPLOAD_ARTIFACT_BYTES_BOUNDARY_SOURCE_STATUSES = ['audit-record-boundary-ready', 'blocked', 'invalid'] as const;
const UPLOAD_ARTIFACT_BYTES_BOUNDARY_SOURCE_KINDS = ['audit-record-boundary-dry-run', 'unsupported'] as const;
const UPLOAD_ARTIFACT_BYTES_BOUNDARY_SOURCE_NEXT_ACTIONS = ['design-artifact-bytes-boundary', 'resolve-blockers', 'invalid'] as const;
const UPLOAD_ARTIFACT_BYTES_BOUNDARY_REVIEW_STATUSES = ['review-ready', 'blocked', 'invalid'] as const;
const UPLOAD_ARTIFACT_BYTES_BOUNDARY_REVIEW_KINDS = ['human-fingerprint-dry-run', 'unsupported'] as const;
const UPLOAD_ARTIFACT_BYTES_BOUNDARY_ADAPTER_BACKENDS = ['mock-s3-compatible', 's3-compatible', 'unsupported'] as const;
const UPLOAD_ADAPTER_INJECTION_BOUNDARY_STATUSES = ['adapter-injection-boundary-ready', 'blocked'] as const;
const UPLOAD_ADAPTER_INJECTION_BOUNDARY_NEXT_ACTIONS = ['design-client-creation-boundary', 'resolve-blockers'] as const;
const UPLOAD_ADAPTER_INJECTION_BOUNDARY_SOURCE_STATUSES = ['artifact-bytes-boundary-ready', 'blocked', 'invalid'] as const;
const UPLOAD_ADAPTER_INJECTION_BOUNDARY_SOURCE_KINDS = ['artifact-bytes-boundary-dry-run', 'unsupported'] as const;
const UPLOAD_ADAPTER_INJECTION_BOUNDARY_SOURCE_NEXT_ACTIONS = ['design-adapter-injection-boundary', 'resolve-blockers', 'invalid'] as const;
const UPLOAD_ADAPTER_INJECTION_BOUNDARY_REVIEW_STATUSES = ['review-ready', 'blocked', 'invalid'] as const;
const UPLOAD_ADAPTER_INJECTION_BOUNDARY_REVIEW_KINDS = ['human-fingerprint-dry-run', 'unsupported'] as const;
const UPLOAD_ADAPTER_INJECTION_BOUNDARY_ADAPTER_BACKENDS = ['mock-s3-compatible', 's3-compatible', 'unsupported'] as const;
const UPLOAD_CLIENT_CREATION_BOUNDARY_STATUSES = ['client-creation-boundary-ready', 'blocked'] as const;
const UPLOAD_CLIENT_CREATION_BOUNDARY_NEXT_ACTIONS = ['design-credential-read-boundary', 'resolve-blockers'] as const;
const UPLOAD_CLIENT_CREATION_BOUNDARY_SOURCE_STATUSES = ['adapter-injection-boundary-ready', 'blocked', 'invalid'] as const;
const UPLOAD_CLIENT_CREATION_BOUNDARY_SOURCE_KINDS = ['adapter-injection-boundary-dry-run', 'unsupported'] as const;
const UPLOAD_CLIENT_CREATION_BOUNDARY_SOURCE_NEXT_ACTIONS = ['design-client-creation-boundary', 'resolve-blockers', 'invalid'] as const;
const UPLOAD_CLIENT_CREATION_BOUNDARY_REVIEW_STATUSES = ['review-ready', 'blocked', 'invalid'] as const;
const UPLOAD_CLIENT_CREATION_BOUNDARY_REVIEW_KINDS = ['human-fingerprint-dry-run', 'unsupported'] as const;
const UPLOAD_CLIENT_CREATION_BOUNDARY_ADAPTER_BACKENDS = ['mock-s3-compatible', 's3-compatible', 'unsupported'] as const;
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
const UPLOAD_ADAPTER_PREFLIGHT_BLOCKERS = [
  'adapter-capability-disabled',
  'adapter-credential-values-exposed',
  'adapter-injected',
  'adapter-live-check-enabled',
  'adapter-plan-blocked',
  'adapter-remote-write-enabled',
  'adapter-upload-command-present',
  'approval-fingerprint-unverified',
  'backend-detail-leak',
  'client-created',
  'continuation-not-ready',
  'credential-presence-check-enabled',
  'credential-values-exposed',
  'invalid-adapter-plan-kind',
  'invalid-continuation-kind',
  'invalid-schema-version',
  'live-check-enabled',
  'missing-required-field',
  'mutation-enabled',
  'real-backend-not-implemented',
  'remote-write-enabled',
  'unsupported-adapter-backend',
  'upload-approval-already-provided',
  'upload-command-present',
  'upload-execution-enabled',
  'unsafe-adapter-name',
  'unsafe-artifact-reference'
] as const;
const UPLOAD_MOCK_HARNESS_BLOCKERS = [
  'adapter-capability-disabled',
  'adapter-credential-values-exposed',
  'adapter-injected',
  'adapter-live-check-enabled',
  'adapter-remote-write-enabled',
  'adapter-resolution-not-ready',
  'adapter-upload-command-present',
  'backend-detail-leak',
  'client-created',
  'credential-presence-check-enabled',
  'credential-values-exposed',
  'invalid-preflight-kind',
  'invalid-schema-version',
  'live-check-enabled',
  'missing-required-field',
  'mock-adapter-descriptor-mismatch',
  'mock-adapter-factory-failed',
  'mock-artifact-store-unavailable',
  'mock-metadata-index-unavailable',
  'mutation-enabled',
  'preflight-not-ready',
  'real-backend-not-implemented',
  'remote-write-enabled',
  'unsupported-adapter-backend',
  'upload-approval-already-provided',
  'upload-command-present',
  'upload-execution-enabled',
  'unsafe-adapter-name',
  'unsafe-artifact-reference'
] as const;
const UPLOAD_EXECUTION_GATE_BLOCKERS = [
  'adapter-injected',
  'backend-detail-leak',
  'client-created',
  'credential-presence-check-enabled',
  'credential-values-exposed',
  'execution-lease-created',
  'harness-not-ready',
  'invalid-continuation-kind',
  'invalid-harness-kind',
  'invalid-schema-version',
  'live-check-enabled',
  'metadata-index-write-attempted',
  'missing-required-field',
  'mock-adapter-not-instantiated',
  'mock-descriptor-not-matched',
  'mutation-enabled',
  'object-write-attempted',
  'remote-mutation-performed',
  'remote-write-enabled',
  'scope-mismatch',
  'unsupported-adapter-backend',
  'upload-approval-already-provided',
  'upload-command-present',
  'upload-execution-enabled',
  'unsafe-adapter-name',
  'unsafe-artifact-reference',
  'write-token-issued'
] as const;
const UPLOAD_MUTATION_PLAN_BLOCKERS = [
  'adapter-injected',
  'artifact-bytes-provided',
  'backend-detail-leak',
  'client-created',
  'credential-presence-check-enabled',
  'credential-values-exposed',
  'execution-gate-not-ready',
  'execution-lease-created',
  'invalid-execution-gate-kind',
  'invalid-schema-version',
  'live-check-enabled',
  'metadata-index-write-attempted',
  'missing-required-field',
  'mock-harness-not-ready',
  'mutation-approval-already-granted',
  'mutation-enabled',
  'object-write-attempted',
  'remote-mutation-performed',
  'remote-write-enabled',
  'rollback-plan-created',
  'scope-not-matched',
  'unsupported-adapter-backend',
  'upload-approval-already-provided',
  'upload-command-present',
  'upload-execution-enabled',
  'unsafe-adapter-name',
  'unsafe-artifact-reference',
  'write-token-issued'
] as const;
const UPLOAD_MUTATION_APPROVAL_REVIEW_BLOCKERS = [
  'adapter-injected',
  'artifact-bytes-provided',
  'backend-detail-leak',
  'client-created',
  'credential-presence-check-enabled',
  'credential-values-exposed',
  'execution-lease-created',
  'invalid-mutation-plan-kind',
  'invalid-plan-kind',
  'invalid-schema-version',
  'live-check-enabled',
  'metadata-index-write-attempted',
  'missing-required-field',
  'mock-harness-not-ready',
  'mutation-approval-already-granted',
  'mutation-plan-not-ready',
  'mutation-enabled',
  'object-write-attempted',
  'plan-fingerprint-mismatch',
  'plan-fingerprint-missing',
  'remote-mutation-performed',
  'remote-write-enabled',
  'review-fingerprint-mismatch',
  'review-fingerprint-missing',
  'rollback-plan-created',
  'scope-not-matched',
  'unsupported-adapter-backend',
  'unsafe-adapter-name',
  'unsafe-artifact-reference',
  'unsafe-review-fingerprint',
  'upload-approval-already-provided',
  'upload-command-present',
  'upload-execution-enabled',
  'write-token-issued'
] as const;
const UPLOAD_EXECUTION_PREREQUISITE_PLAN_BLOCKERS = [
  'adapter-injected',
  'artifact-bytes-provided',
  'audit-record-created',
  'backend-detail-leak',
  'client-created',
  'credential-presence-check-enabled',
  'credential-values-exposed',
  'execution-lease-created',
  'invalid-approval-review-kind',
  'invalid-review-kind',
  'invalid-schema-version',
  'live-check-enabled',
  'metadata-index-write-attempted',
  'missing-required-field',
  'mutation-approval-already-granted',
  'mutation-approval-not-reviewed',
  'mutation-enabled',
  'object-write-attempted',
  'remote-mutation-performed',
  'remote-write-enabled',
  'review-fingerprint-missing',
  'review-fingerprint-unverified',
  'review-next-action-invalid',
  'review-not-ready',
  'rollback-plan-created',
  'scope-not-matched',
  'unsupported-adapter-backend',
  'unsafe-adapter-name',
  'unsafe-artifact-reference',
  'upload-approval-already-provided',
  'upload-command-present',
  'upload-execution-enabled',
  'write-token-issued'
] as const;
const UPLOAD_WRITE_TOKEN_BOUNDARY_BLOCKERS = [
  'adapter-injected',
  'artifact-bytes-provided',
  'audit-record-created',
  'backend-detail-leak',
  'client-created',
  'credential-presence-check-enabled',
  'credential-values-exposed',
  'execution-lease-created',
  'invalid-boundary-kind',
  'invalid-prerequisite-plan-kind',
  'invalid-schema-version',
  'live-check-enabled',
  'metadata-index-write-attempted',
  'missing-required-field',
  'mutation-approval-already-granted',
  'mutation-approval-not-reviewed',
  'mutation-enabled',
  'object-write-attempted',
  'prerequisite-next-action-invalid',
  'prerequisite-plan-not-ready',
  'remote-mutation-performed',
  'remote-write-enabled',
  'review-fingerprint-unverified',
  'rollback-plan-created',
  'scope-not-matched',
  'token-expiry-already-set',
  'token-scope-already-bound',
  'unsupported-adapter-backend',
  'unsafe-adapter-name',
  'unsafe-artifact-reference',
  'upload-approval-already-provided',
  'upload-command-present',
  'upload-execution-enabled',
  'write-token-issued',
  'write-token-not-required'
] as const;
const UPLOAD_EXECUTION_LEASE_BOUNDARY_BLOCKERS = [
  'adapter-injected',
  'artifact-bytes-provided',
  'audit-binding-created',
  'audit-record-created',
  'backend-detail-leak',
  'client-created',
  'credential-presence-check-enabled',
  'credential-values-exposed',
  'execution-lease-created',
  'execution-lease-not-required',
  'invalid-boundary-kind',
  'invalid-schema-version',
  'invalid-write-token-boundary-kind',
  'lease-expiry-already-set',
  'lease-scope-already-bound',
  'live-check-enabled',
  'metadata-index-write-attempted',
  'missing-required-field',
  'mutation-approval-already-granted',
  'mutation-enabled',
  'object-write-attempted',
  'remote-mutation-performed',
  'remote-write-enabled',
  'review-fingerprint-unverified',
  'rollback-plan-created',
  'scope-not-matched',
  'token-boundary-next-action-invalid',
  'token-boundary-not-ready',
  'token-expiry-already-set',
  'token-scope-already-bound',
  'unsupported-adapter-backend',
  'unsafe-adapter-name',
  'unsafe-artifact-reference',
  'upload-approval-already-provided',
  'upload-command-present',
  'upload-execution-enabled',
  'write-token-issued',
  'write-token-not-required'
] as const;
const UPLOAD_ROLLBACK_PLAN_BOUNDARY_BLOCKERS = [
  'adapter-injected',
  'artifact-bytes-provided',
  'audit-binding-created',
  'audit-record-created',
  'backend-detail-leak',
  'client-created',
  'credential-presence-check-enabled',
  'credential-values-exposed',
  'execution-lease-created',
  'execution-lease-not-required',
  'invalid-boundary-kind',
  'invalid-execution-lease-boundary-kind',
  'invalid-schema-version',
  'lease-boundary-next-action-invalid',
  'lease-boundary-not-ready',
  'lease-expiry-already-set',
  'lease-scope-already-bound',
  'live-check-enabled',
  'metadata-index-write-attempted',
  'missing-required-field',
  'mutation-approval-already-granted',
  'mutation-enabled',
  'object-write-attempted',
  'remote-mutation-performed',
  'remote-write-enabled',
  'review-fingerprint-unverified',
  'rollback-plan-created',
  'rollback-plan-not-required',
  'rollback-review-already-recorded',
  'rollback-scope-already-bound',
  'scope-not-matched',
  'token-expiry-already-set',
  'token-scope-already-bound',
  'unsupported-adapter-backend',
  'unsafe-adapter-name',
  'unsafe-artifact-reference',
  'upload-approval-already-provided',
  'upload-command-present',
  'upload-execution-enabled',
  'write-token-issued',
  'write-token-not-required'
] as const;
const UPLOAD_AUDIT_RECORD_BOUNDARY_BLOCKERS = [
  'adapter-injected',
  'artifact-bytes-provided',
  'audit-binding-created',
  'audit-record-created',
  'audit-record-not-required',
  'audit-review-already-recorded',
  'audit-scope-already-bound',
  'backend-detail-leak',
  'client-created',
  'credential-presence-check-enabled',
  'credential-values-exposed',
  'execution-lease-created',
  'execution-lease-not-required',
  'invalid-boundary-kind',
  'invalid-rollback-plan-boundary-kind',
  'invalid-schema-version',
  'live-check-enabled',
  'metadata-index-write-attempted',
  'missing-required-field',
  'mutation-approval-already-granted',
  'mutation-enabled',
  'object-write-attempted',
  'remote-mutation-performed',
  'remote-write-enabled',
  'review-fingerprint-unverified',
  'rollback-boundary-next-action-invalid',
  'rollback-boundary-not-ready',
  'rollback-plan-created',
  'rollback-plan-not-required',
  'rollback-review-already-recorded',
  'rollback-scope-already-bound',
  'scope-not-matched',
  'unsupported-adapter-backend',
  'unsafe-adapter-name',
  'unsafe-artifact-reference',
  'upload-approval-already-provided',
  'upload-command-present',
  'upload-execution-enabled',
  'write-token-issued',
  'write-token-not-required'
] as const;
const UPLOAD_ARTIFACT_BYTES_BOUNDARY_BLOCKERS = [
  'adapter-injected',
  'artifact-bytes-digest-already-verified',
  'artifact-bytes-leak',
  'artifact-bytes-not-required',
  'artifact-bytes-provided',
  'artifact-bytes-scope-already-bound',
  'audit-binding-created',
  'audit-boundary-next-action-invalid',
  'audit-boundary-not-ready',
  'audit-record-created',
  'audit-record-not-required',
  'audit-review-already-recorded',
  'audit-scope-already-bound',
  'backend-detail-leak',
  'client-created',
  'credential-presence-check-enabled',
  'credential-values-exposed',
  'execution-lease-created',
  'execution-lease-not-required',
  'invalid-audit-record-boundary-kind',
  'invalid-boundary-kind',
  'invalid-schema-version',
  'live-check-enabled',
  'metadata-index-write-attempted',
  'missing-required-field',
  'mutation-approval-already-granted',
  'mutation-enabled',
  'object-write-attempted',
  'remote-mutation-performed',
  'remote-write-enabled',
  'review-fingerprint-unverified',
  'rollback-plan-created',
  'rollback-plan-not-required',
  'scope-not-matched',
  'unsupported-adapter-backend',
  'unsafe-adapter-name',
  'unsafe-artifact-reference',
  'upload-approval-already-provided',
  'upload-command-present',
  'upload-execution-enabled',
  'write-token-issued',
  'write-token-not-required'
] as const;
const UPLOAD_ADAPTER_INJECTION_BOUNDARY_BLOCKERS = [
  'adapter-dependency-leak',
  'adapter-injected',
  'adapter-injection-not-required',
  'artifact-bytes-boundary-next-action-invalid',
  'artifact-bytes-boundary-not-ready',
  'artifact-bytes-digest-already-verified',
  'artifact-bytes-not-required',
  'artifact-bytes-provided',
  'artifact-bytes-scope-already-bound',
  'audit-record-created',
  'audit-record-not-required',
  'backend-detail-leak',
  'client-created',
  'credential-presence-check-enabled',
  'credential-values-exposed',
  'execution-lease-created',
  'execution-lease-not-required',
  'invalid-artifact-bytes-boundary-kind',
  'invalid-boundary-kind',
  'invalid-schema-version',
  'live-check-enabled',
  'metadata-index-write-attempted',
  'missing-required-field',
  'mutation-approval-already-granted',
  'mutation-enabled',
  'object-write-attempted',
  'remote-mutation-performed',
  'remote-write-enabled',
  'review-fingerprint-unverified',
  'rollback-plan-created',
  'rollback-plan-not-required',
  'scope-not-matched',
  'unsupported-adapter-backend',
  'unsafe-adapter-name',
  'unsafe-artifact-reference',
  'upload-approval-already-provided',
  'upload-command-present',
  'upload-execution-enabled',
  'write-token-issued',
  'write-token-not-required'
] as const;
const UPLOAD_CLIENT_CREATION_BOUNDARY_BLOCKERS = [
  'adapter-dependency-leak',
  'adapter-injected',
  'adapter-injection-boundary-next-action-invalid',
  'adapter-injection-boundary-not-ready',
  'adapter-injection-not-required',
  'artifact-bytes-provided',
  'artifact-object-store-bound',
  'audit-record-created',
  'backend-detail-leak',
  'client-created',
  'client-creation-not-required',
  'client-dependency-leak',
  'credential-presence-check-enabled',
  'credential-values-exposed',
  'executable-state-enabled',
  'execution-lease-created',
  'invalid-adapter-injection-boundary-kind',
  'invalid-boundary-kind',
  'invalid-schema-version',
  'live-check-enabled',
  'metadata-index-bound',
  'metadata-index-write-attempted',
  'missing-required-field',
  'mutation-approval-already-granted',
  'mutation-enabled',
  'object-write-attempted',
  'remote-mutation-performed',
  'remote-write-enabled',
  'review-fingerprint-unverified',
  'rollback-plan-created',
  'scope-not-matched',
  'unsupported-adapter-backend',
  'unsafe-adapter-name',
  'unsafe-artifact-reference',
  'upload-approval-already-provided',
  'upload-command-present',
  'upload-execution-enabled',
  'write-token-issued'
] as const;
const FORBIDDEN_KEY_PATTERN = /(bucket|endpoint|url|credentialValue|secret|token|password|authorization|header|accessKey|sessionToken|clientConfig|signedUrl)/i;
const FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN = /(artifactBytesValue|artifactBytesBase64|artifactBytesContent|artifactBytesPayload|artifactContent|artifactPayload|rawArtifact|byteBuffer|bytesBase64|contentBase64|buffer|stream|arrayBuffer|blob|readPath|filePath|localPath|artifactPath|serializedPayload|stagedBytes)/i;
const FORBIDDEN_ADAPTER_DEPENDENCY_KEY_PATTERN = /(adapterInstance|adapterObject|adapterValue|adapterDescriptorValue|adapterClient|clientInstance|clientObject|clientValue|clientFactory|clientConfig|sdkClient|objectStoreHandle|metadataIndexHandle|putObject|putEntry|fetch)/i;
const FORBIDDEN_VALUE_PATTERN = /(?:https?:\/\/|s3:\/\/|aws s3|secret|token|password|authorization|bearer|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i;
const SAFE_UPLOAD_CONTROL_VALUES = new Set([
  'infra-agent.knowledge-team-upload-write-token-boundary',
  'infra-agent.knowledge-team-upload-execution-lease-boundary',
  'infra-agent.knowledge-team-upload-rollback-plan-boundary',
  'infra-agent.knowledge-team-upload-audit-record-boundary',
  'infra-agent.knowledge-team-upload-artifact-bytes-boundary',
  'infra-agent.knowledge-team-upload-adapter-injection-boundary',
  'infra-agent.knowledge-team-upload-client-creation-boundary',
  'upload-write-token-boundary',
  'upload-execution-lease-boundary',
  'upload-rollback-plan-boundary',
  'upload-audit-record-boundary',
  'upload-artifact-bytes-boundary',
  'upload-adapter-injection-boundary',
  'upload-client-creation-boundary',
  'write-token-boundary-dry-run',
  'write-token-boundary-ready',
  'execution-lease-boundary-dry-run',
  'execution-lease-boundary-ready',
  'rollback-plan-boundary-dry-run',
  'rollback-plan-boundary-ready',
  'audit-record-boundary-dry-run',
  'audit-record-boundary-ready',
  'artifact-bytes-boundary-dry-run',
  'artifact-bytes-boundary-ready',
  'adapter-injection-boundary-dry-run',
  'adapter-injection-boundary-ready',
  'client-creation-boundary-dry-run',
  'client-creation-boundary-ready',
  'design-write-token-boundary',
  'design-execution-lease-boundary',
  'design-rollback-plan-boundary',
  'design-audit-record-boundary',
  'design-artifact-bytes-boundary',
  'design-adapter-injection-boundary',
  'design-client-creation-boundary',
  'design-credential-read-boundary',
  'write-token-boundary-design',
  'write-token-issued',
  'write-token-not-required',
  'execution-lease-created',
  'execution-lease-not-required',
  'rollback-plan-created',
  'rollback-plan-not-required',
  'audit-record-created',
  'audit-record-not-required',
  'audit-review-already-recorded',
  'audit-scope-already-bound',
  'artifact-bytes-digest-already-verified',
  'artifact-bytes-leak',
  'artifact-bytes-not-required',
  'artifact-bytes-provided',
  'artifact-bytes-scope-already-bound',
  'adapter-dependency-leak',
  'adapter-injected',
  'adapter-injection-not-required',
  'adapter-injection-boundary-next-action-invalid',
  'adapter-injection-boundary-not-ready',
  'artifact-object-store-bound',
  'client-creation-not-required',
  'client-dependency-leak',
  'executable-state-enabled',
  'metadata-index-bound',
  'artifact-bytes-boundary-next-action-invalid',
  'artifact-bytes-boundary-not-ready',
  'audit-boundary-next-action-invalid',
  'audit-boundary-not-ready',
  'rollback-boundary-next-action-invalid',
  'rollback-boundary-not-ready',
  'rollback-review-already-recorded',
  'rollback-scope-already-bound',
  'lease-expiry-already-set',
  'lease-scope-already-bound',
  'token-expiry-already-set',
  'token-scope-already-bound'
]);

function isOneOf<T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === 'string' && (options as readonly string[]).includes(value);
}

function validateNoUploadApprovalLeakage(
  value: unknown,
  path: string,
  issues: KnowledgeValidationIssue[]
): void {
  if (typeof value === 'string') {
    if (SAFE_UPLOAD_CONTROL_VALUES.has(value)) {
      return;
    }
    if (path === '$.prerequisitePlan.nextRequiredBoundary' || path === '$.readiness.nextAction' || path === '$.readiness.reason') {
      return;
    }
    const blockerCodePath = path.includes('.blockerCodes[') || /\.blockers\[\d+\]\.code$/.test(path);
    if (blockerCodePath && /^[a-z0-9-]+$/.test(value)) {
      return;
    }
    const blockerJsonPath = /\.blockers\[\d+\]\.path$/.test(path);
    if (blockerJsonPath && /^\$[A-Za-z0-9_$.[\]-]+$/.test(value)) {
      return;
    }
    const blockerMessagePath = /\.blockers\[\d+\]\.message$/.test(path);
    if (blockerMessagePath && !/(?:https?:\/\/|s3:\/\/|aws s3|private-key|\/(?:tmp|home|workspace|private|Users)\/|[A-Za-z]:\\)/i.test(value)) {
      return;
    }
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
      || key === 'credentialBoundary'
      || key === 'writeTokenIssued'
      || key === 'writeTokenRequiredBeforeExecution'
      || key === 'writeTokenRequired'
      || key === 'writeTokenRequiredBeforeLease'
      || key === 'writeTokenBoundary'
      || key === 'sourceWriteTokenBoundary'
      || key === 'sourceExecutionLeaseBoundary'
      || key === 'tokenRequiredBeforeExecution'
      || key === 'tokenIssued'
      || key === 'tokenScopeBindingRequired'
      || key === 'tokenScopeBoundToArtifact'
      || key === 'tokenSingleUseRequired'
      || key === 'singleUseTokenIssued'
      || key === 'tokenExpiryRequired'
      || key === 'tokenExpirySet'
      || key === 'executionLeaseBoundary'
      || key === 'executionLeaseCreated'
      || key === 'executionLeaseRequired'
      || key === 'executionLeaseRequiredBeforeExecution'
      || key === 'executionLeaseRequiredBeforeIssuance'
      || key === 'leaseScopeBindingRequired'
      || key === 'leaseScopeBoundToArtifact'
      || key === 'leaseSingleUseRequired'
      || key === 'singleUseLeaseCreated'
      || key === 'leaseExpiryRequired'
      || key === 'leaseExpirySet'
      || key === 'auditBindingRequired'
      || key === 'auditBindingCreated'
      || key === 'rollbackPlanBoundary'
      || key === 'rollbackPlanCreated'
      || key === 'rollbackPlanRequired'
      || key === 'rollbackPlanRequiredBeforeExecution'
      || key === 'rollbackPlanRequiredBeforeAudit'
      || key === 'rollbackScopeBindingRequired'
      || key === 'rollbackScopeBoundToArtifact'
      || key === 'rollbackReviewRequired'
      || key === 'rollbackReviewed'
      || key === 'writeTokenRequiredBeforeRollback'
      || key === 'executionLeaseRequiredBeforeRollback'
      || key === 'artifactBytesRequiredBeforeRollback'
      || key === 'sourceRollbackPlanBoundary'
      || key === 'auditRecordBoundary'
      || key === 'auditRecordCreated'
      || key === 'auditRecordRequired'
      || key === 'auditRecordRequiredBeforeExecution'
      || key === 'auditRecordRequiredBeforeBytes'
      || key === 'auditScopeBindingRequired'
      || key === 'auditScopeBoundToArtifact'
      || key === 'auditReviewRequired'
      || key === 'auditReviewed'
      || key === 'writeTokenRequiredBeforeAudit'
      || key === 'executionLeaseRequiredBeforeAudit'
      || key === 'artifactBytesRequiredBeforeAudit'
      || key === 'sourceAuditRecordBoundary'
      || key === 'artifactBytesBoundary'
      || key === 'artifactBytesProvided'
      || key === 'artifactBytesRequired'
      || key === 'artifactBytesRequiredBeforeAdapter'
      || key === 'artifactBytesRequiredBeforeExecution'
      || key === 'artifactDigestRequired'
      || key === 'artifactDigestVerified'
      || key === 'artifactScopeBindingRequired'
      || key === 'artifactScopeBoundToArtifact'
      || key === 'writeTokenRequiredBeforeBytes'
      || key === 'executionLeaseRequiredBeforeBytes'
      || key === 'rollbackPlanRequiredBeforeBytes'
      || key === 'adapterInjectionRequiredAfterBytes'
      || key === 'sourceArtifactBytesBoundary'
      || key === 'adapterInjectionBoundary'
      || key === 'adapterInjectionRequired'
      || key === 'adapterInjectionRequiredBeforeExecution'
      || key === 'adapterDependencyInjectionOnly'
      || key === 'mockAdapterRequired'
      || key === 'adapterDescriptorRequired'
      || key === 'artifactObjectStoreDependencyRequired'
      || key === 'metadataIndexDependencyRequired'
      || key === 'contentAddressedObjectKeysRequired'
      || key === 'contentAddressedIndexKeysRequired'
      || key === 'idempotentWritesRequired'
      || key === 'explicitUploadApprovalRequired'
      || key === 'clientCreationBoundary'
      || key === 'clientCreationRequiredBeforeExecution'
      || key === 'clientCreationRequiredAfterAdapter'
      || key === 'adapterInjectionRequiredBeforeClient'
      || key === 'clientFactoryDescriptorRequired'
      || key === 'credentialReadBoundaryRequired'
      || key === 'credentialPresenceBoundaryRequired'
      || key === 'liveCheckBoundaryRequired'
      || key === 'uploadCommandBoundaryRequired'
      || key === 'sdkClientCreated'
      || key === 'liveCheckPerformed'
      || key === 'uploadCommandGenerated'
      || key === 'sourceAdapterInjectionBoundary'
      || key === 'credentialReadRequired'
      || key === 'credentialPresenceCheckRequired'
      || key === 'liveCheckRequired'
      || key === 'uploadCommandRequired'
      || key === 'writeTokenRequiredBeforeAdapter'
      || key === 'executionLeaseRequiredBeforeAdapter'
      || key === 'rollbackPlanRequiredBeforeAdapter'
      || key === 'auditRecordRequiredBeforeAdapter'
      || key === 'artifactObjectStoreBound'
      || key === 'metadataIndexBound'
      || key === 'clientCreationRequired'
      || key === 'clientCreated'
      || key === 'adapterName'
      || key === 'adapterBackendKind';
    if (!safeControlField && FORBIDDEN_ARTIFACT_BYTE_KEY_PATTERN.test(key)) {
      issues.push(error(entryPath, 'Knowledge upload approval payloads must not include raw artifact bytes, byte buffers, streams, content payloads, or local artifact paths.'));
    }
    if (!safeControlField && FORBIDDEN_ADAPTER_DEPENDENCY_KEY_PATTERN.test(key)) {
      issues.push(error(entryPath, 'Knowledge upload approval payloads must not include adapter instances, SDK clients, object store handles, metadata index handles, or write functions.'));
    }
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

function validateScopedSha256FingerprintObject(
  fingerprint: unknown,
  path: string,
  issues: KnowledgeValidationIssue[],
  input: {
    expectedScope: string;
    expectedCanonicalFieldCount: number;
    allowNullValue: boolean;
  }
): string | null {
  if (!isRecord(fingerprint)) {
    issues.push(error(path, 'must be an object.'));
    return null;
  }
  if (fingerprint.algorithm !== 'sha256') {
    issues.push(error(`${path}.algorithm`, 'must be sha256.'));
  }
  if (fingerprint.scope !== input.expectedScope) {
    issues.push(error(`${path}.scope`, `must be ${input.expectedScope}.`));
  }
  if (fingerprint.canonicalFieldCount !== input.expectedCanonicalFieldCount) {
    issues.push(error(`${path}.canonicalFieldCount`, `must be ${input.expectedCanonicalFieldCount}.`));
  }
  if (fingerprint.value === null && input.allowNullValue) {
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

export function validateKnowledgeTeamUploadAdapterPreflightPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  validateCommonDryRunBoundary(payload, issues, 'Knowledge team upload adapter preflight');
  validateNoUploadApprovalLeakage(payload, '$', issues);

  if (!isOneOf(payload.status, UPLOAD_ADAPTER_PREFLIGHT_STATUSES)) {
    issues.push(error('$.status', 'Knowledge team upload adapter preflight status must be supported.'));
  }
  if (payload.plannedOperation !== 'stage-knowledge-pack') {
    issues.push(error('$.plannedOperation', 'Knowledge team upload adapter preflight operation must be stage-knowledge-pack.'));
  }
  if (payload.uploadApproved !== false) {
    issues.push(error('$.uploadApproved', 'Knowledge team upload adapter preflight must not approve upload.'));
  }
  if (payload.uploadExecutionAllowed !== false) {
    issues.push(error('$.uploadExecutionAllowed', 'Knowledge team upload adapter preflight must not allow upload execution.'));
  }
  if (payload.clientCreated !== false) {
    issues.push(error('$.clientCreated', 'Knowledge team upload adapter preflight must not create clients.'));
  }
  if (payload.adapterInjected !== false) {
    issues.push(error('$.adapterInjected', 'Knowledge team upload adapter preflight must not inject adapters.'));
  }

  if (!isRecord(payload.continuation)) {
    issues.push(error('$.continuation', 'Knowledge team upload adapter preflight continuation must be an object.'));
  } else {
    if (!isOneOf(payload.continuation.status, UPLOAD_ADAPTER_PREFLIGHT_CONTINUATION_STATUSES)) {
      issues.push(error('$.continuation.status', 'must be a supported continuation status.'));
    }
    if (typeof payload.continuation.fingerprintVerified !== 'boolean') {
      issues.push(error('$.continuation.fingerprintVerified', 'must be a boolean.'));
    }
    if (payload.continuation.backendKind !== 's3-compatible' && payload.continuation.backendKind !== 'unsupported') {
      issues.push(error('$.continuation.backendKind', 'must be s3-compatible or unsupported.'));
    }
    if (payload.status === 'preflight-ready') {
      if (payload.continuation.status !== 'continuation-ready') {
        issues.push(error('$.continuation.status', 'must be continuation-ready for preflight-ready payloads.'));
      }
      if (payload.continuation.fingerprintVerified !== true) {
        issues.push(error('$.continuation.fingerprintVerified', 'must be true for preflight-ready payloads.'));
      }
    }
    for (const key of ['manifestId', 'artifactId']) {
      if (payload.continuation[key] !== null && (typeof payload.continuation[key] !== 'string' || !/^[a-f0-9]{24}$/.test(payload.continuation[key]))) {
        issues.push(error(`$.continuation.${key}`, 'must be null or a safe 24-character id.'));
      }
    }
    if (payload.continuation.objectSha256 !== null && (typeof payload.continuation.objectSha256 !== 'string' || !SAFE_SHA256_PATTERN.test(payload.continuation.objectSha256))) {
      issues.push(error('$.continuation.objectSha256', 'must be null or a SHA-256 hex string.'));
    }
    if (payload.continuation.objectKey !== null && typeof payload.continuation.objectKey !== 'string') {
      issues.push(error('$.continuation.objectKey', 'must be null or a string.'));
    }
  }

  if (!isRecord(payload.adapterDependency)) {
    issues.push(error('$.adapterDependency', 'Knowledge team upload adapter preflight adapterDependency must be an object.'));
  } else {
    if (payload.adapterDependency.source !== 'resolution-plan' && payload.adapterDependency.source !== 'none') {
      issues.push(error('$.adapterDependency.source', 'must be resolution-plan or none.'));
    }
    if (payload.adapterDependency.dependencyInjectionOnly !== true) {
      issues.push(error('$.adapterDependency.dependencyInjectionOnly', 'must be true.'));
    }
    if (typeof payload.adapterDependency.injectionCandidate !== 'boolean') {
      issues.push(error('$.adapterDependency.injectionCandidate', 'must be a boolean.'));
    }
    if (!isOneOf(payload.adapterDependency.backendKind, UPLOAD_ADAPTER_PREFLIGHT_BACKENDS)) {
      issues.push(error('$.adapterDependency.backendKind', 'must be a supported adapter backend kind.'));
    }
    if (payload.adapterDependency.adapterName !== null && typeof payload.adapterDependency.adapterName !== 'string') {
      issues.push(error('$.adapterDependency.adapterName', 'must be null or a string.'));
    }
    if (!isOneOf(payload.adapterDependency.resolutionStatus, UPLOAD_ADAPTER_PREFLIGHT_RESOLUTION_STATUSES)) {
      issues.push(error('$.adapterDependency.resolutionStatus', 'must be a supported resolution status.'));
    }
    if (payload.adapterDependency.realBackendImplemented !== false) {
      issues.push(error('$.adapterDependency.realBackendImplemented', 'must be false.'));
    }
    for (const key of [
      'artifactObjectStore',
      'metadataIndex',
      'contentAddressedObjectKeys',
      'contentAddressedIndexKeys',
      'idempotentWritesRequired',
      'explicitUploadApprovalRequired'
    ]) {
      if (typeof payload.adapterDependency[key] !== 'boolean') {
        issues.push(error(`$.adapterDependency.${key}`, 'must be a boolean.'));
      }
    }
    if (payload.adapterDependency.remoteWriteAllowed !== false) {
      issues.push(error('$.adapterDependency.remoteWriteAllowed', 'must be false.'));
    }
    if (payload.adapterDependency.liveCheckAllowed !== false) {
      issues.push(error('$.adapterDependency.liveCheckAllowed', 'must be false.'));
    }
    if (payload.adapterDependency.credentialValuesExposed !== false) {
      issues.push(error('$.adapterDependency.credentialValuesExposed', 'must be false.'));
    }
    if (payload.adapterDependency.uploadCommand !== null) {
      issues.push(error('$.adapterDependency.uploadCommand', 'must be null.'));
    }
    if (payload.status === 'preflight-ready') {
      if (payload.adapterDependency.injectionCandidate !== true) {
        issues.push(error('$.adapterDependency.injectionCandidate', 'must be true for preflight-ready payloads.'));
      }
      if (payload.adapterDependency.backendKind !== 'mock-s3-compatible') {
        issues.push(error('$.adapterDependency.backendKind', 'must be mock-s3-compatible for preflight-ready payloads.'));
      }
      if (payload.adapterDependency.resolutionStatus !== 'resolvable') {
        issues.push(error('$.adapterDependency.resolutionStatus', 'must be resolvable for preflight-ready payloads.'));
      }
    }
  }

  if (!isRecord(payload.readiness)) {
    issues.push(error('$.readiness', 'Knowledge team upload adapter preflight readiness must be an object.'));
  } else {
    validateBlockers({
      readiness: payload.readiness,
      supportedCodes: UPLOAD_ADAPTER_PREFLIGHT_BLOCKERS,
      supportedStatuses: UPLOAD_ADAPTER_PREFLIGHT_STATUSES,
      supportedNextActions: UPLOAD_ADAPTER_PREFLIGHT_NEXT_ACTIONS,
      path: '$.readiness',
      issues
    });
  }

  return createEmptyKnowledgeValidationReport({ inputPath, inputKind, issues });
}

export function validateKnowledgeTeamUploadMockHarnessPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  validateCommonDryRunBoundary(payload, issues, 'Knowledge team upload mock harness');
  validateNoUploadApprovalLeakage(payload, '$', issues);

  if (!isOneOf(payload.status, UPLOAD_MOCK_HARNESS_STATUSES)) {
    issues.push(error('$.status', 'Knowledge team upload mock harness status must be supported.'));
  }
  if (payload.harnessKind !== 'in-memory-mock') {
    issues.push(error('$.harnessKind', 'Knowledge team upload mock harness kind must be in-memory-mock.'));
  }
  if (payload.plannedOperation !== 'stage-knowledge-pack') {
    issues.push(error('$.plannedOperation', 'Knowledge team upload mock harness operation must be stage-knowledge-pack.'));
  }
  if (payload.uploadApproved !== false) {
    issues.push(error('$.uploadApproved', 'Knowledge team upload mock harness must not approve upload.'));
  }
  if (payload.uploadExecutionAllowed !== false) {
    issues.push(error('$.uploadExecutionAllowed', 'Knowledge team upload mock harness must not allow upload execution.'));
  }
  if (payload.clientCreated !== false) {
    issues.push(error('$.clientCreated', 'Knowledge team upload mock harness must not create clients.'));
  }
  if (payload.adapterInjected !== false) {
    issues.push(error('$.adapterInjected', 'Knowledge team upload mock harness must not inject adapters.'));
  }
  if (typeof payload.mockAdapterInstantiated !== 'boolean') {
    issues.push(error('$.mockAdapterInstantiated', 'Knowledge team upload mock harness mockAdapterInstantiated must be a boolean.'));
  }
  if (payload.objectWriteAttempted !== false) {
    issues.push(error('$.objectWriteAttempted', 'Knowledge team upload mock harness must not attempt object writes.'));
  }
  if (payload.metadataIndexWriteAttempted !== false) {
    issues.push(error('$.metadataIndexWriteAttempted', 'Knowledge team upload mock harness must not attempt metadata index writes.'));
  }
  if (payload.remoteMutationPerformed !== false) {
    issues.push(error('$.remoteMutationPerformed', 'Knowledge team upload mock harness must not perform remote mutations.'));
  }

  if (!isRecord(payload.preflight)) {
    issues.push(error('$.preflight', 'Knowledge team upload mock harness preflight must be an object.'));
  } else {
    if (!isOneOf(payload.preflight.status, UPLOAD_MOCK_HARNESS_PREFLIGHT_STATUSES)) {
      issues.push(error('$.preflight.status', 'must be a supported preflight status.'));
    }
    if (payload.preflight.adapterBackendKind !== 'mock-s3-compatible' && payload.preflight.adapterBackendKind !== 's3-compatible' && payload.preflight.adapterBackendKind !== 'unsupported') {
      issues.push(error('$.preflight.adapterBackendKind', 'must be mock-s3-compatible, s3-compatible, or unsupported.'));
    }
    if (payload.preflight.adapterName !== null) {
      if (typeof payload.preflight.adapterName !== 'string' || !isSafeKnowledgeTeamBackendAdapterName(payload.preflight.adapterName)) {
        issues.push(error('$.preflight.adapterName', 'must be null or a safe mock adapter name.'));
      }
    }
    if (typeof payload.preflight.injectionCandidate !== 'boolean') {
      issues.push(error('$.preflight.injectionCandidate', 'must be a boolean.'));
    }
    for (const key of ['manifestId', 'artifactId']) {
      if (payload.preflight[key] !== null && (typeof payload.preflight[key] !== 'string' || !/^[a-f0-9]{24}$/.test(payload.preflight[key]))) {
        issues.push(error(`$.preflight.${key}`, 'must be null or a safe 24-character id.'));
      }
    }
    if (payload.preflight.objectSha256 !== null && (typeof payload.preflight.objectSha256 !== 'string' || !SAFE_SHA256_PATTERN.test(payload.preflight.objectSha256))) {
      issues.push(error('$.preflight.objectSha256', 'must be null or a SHA-256 hex string.'));
    }
    if (payload.preflight.objectKey !== null && (typeof payload.preflight.objectKey !== 'string' || !isSafeKnowledgeTeamArtifactObjectKey(payload.preflight.objectKey))) {
      issues.push(error('$.preflight.objectKey', 'must be null or a safe team artifact object key.'));
    }
    if (payload.status === 'harness-ready') {
      if (payload.preflight.status !== 'preflight-ready') {
        issues.push(error('$.preflight.status', 'must be preflight-ready for harness-ready payloads.'));
      }
      if (payload.preflight.adapterBackendKind !== 'mock-s3-compatible') {
        issues.push(error('$.preflight.adapterBackendKind', 'must be mock-s3-compatible for harness-ready payloads.'));
      }
      if (payload.preflight.injectionCandidate !== true) {
        issues.push(error('$.preflight.injectionCandidate', 'must be true for harness-ready payloads.'));
      }
    }
  }

  if (!isRecord(payload.mockHarness)) {
    issues.push(error('$.mockHarness', 'Knowledge team upload mock harness mockHarness must be an object.'));
  } else {
    if (payload.mockHarness.adapterFactory !== 'createMockKnowledgeTeamBackendAdapter') {
      issues.push(error('$.mockHarness.adapterFactory', 'must be createMockKnowledgeTeamBackendAdapter.'));
    }
    if (payload.mockHarness.adapterName !== null) {
      if (typeof payload.mockHarness.adapterName !== 'string' || !isSafeKnowledgeTeamBackendAdapterName(payload.mockHarness.adapterName)) {
        issues.push(error('$.mockHarness.adapterName', 'must be null or a safe mock adapter name.'));
      }
    }
    if (!isOneOf(payload.mockHarness.backendKind, UPLOAD_MOCK_HARNESS_BACKENDS)) {
      issues.push(error('$.mockHarness.backendKind', 'must be mock-s3-compatible or unsupported.'));
    }
    for (const key of [
      'descriptorMatched',
      'artifactObjectStoreAvailable',
      'metadataIndexAvailable'
    ]) {
      if (typeof payload.mockHarness[key] !== 'boolean') {
        issues.push(error(`$.mockHarness.${key}`, 'must be a boolean.'));
      }
    }
    if (payload.mockHarness.objectWriteAttempted !== false) {
      issues.push(error('$.mockHarness.objectWriteAttempted', 'must be false.'));
    }
    if (payload.mockHarness.indexWriteAttempted !== false) {
      issues.push(error('$.mockHarness.indexWriteAttempted', 'must be false.'));
    }
    if (payload.mockHarness.remoteMutationPerformed !== false) {
      issues.push(error('$.mockHarness.remoteMutationPerformed', 'must be false.'));
    }
    if (payload.status === 'harness-ready') {
      if (payload.mockAdapterInstantiated !== true) {
        issues.push(error('$.mockAdapterInstantiated', 'must be true for harness-ready payloads.'));
      }
      if (payload.mockHarness.backendKind !== 'mock-s3-compatible') {
        issues.push(error('$.mockHarness.backendKind', 'must be mock-s3-compatible for harness-ready payloads.'));
      }
      if (payload.mockHarness.descriptorMatched !== true) {
        issues.push(error('$.mockHarness.descriptorMatched', 'must be true for harness-ready payloads.'));
      }
      if (payload.mockHarness.artifactObjectStoreAvailable !== true) {
        issues.push(error('$.mockHarness.artifactObjectStoreAvailable', 'must be true for harness-ready payloads.'));
      }
      if (payload.mockHarness.metadataIndexAvailable !== true) {
        issues.push(error('$.mockHarness.metadataIndexAvailable', 'must be true for harness-ready payloads.'));
      }
    }
  }

  if (!isRecord(payload.readiness)) {
    issues.push(error('$.readiness', 'Knowledge team upload mock harness readiness must be an object.'));
  } else {
    validateBlockers({
      readiness: payload.readiness,
      supportedCodes: UPLOAD_MOCK_HARNESS_BLOCKERS,
      supportedStatuses: UPLOAD_MOCK_HARNESS_STATUSES,
      supportedNextActions: UPLOAD_MOCK_HARNESS_NEXT_ACTIONS,
      path: '$.readiness',
      issues
    });
  }

  return createEmptyKnowledgeValidationReport({ inputPath, inputKind, issues });
}

export function validateKnowledgeTeamUploadExecutionGatePayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  validateCommonDryRunBoundary(payload, issues, 'Knowledge team upload execution gate');
  validateNoUploadApprovalLeakage(payload, '$', issues);

  if (!isOneOf(payload.status, UPLOAD_EXECUTION_GATE_STATUSES)) {
    issues.push(error('$.status', 'Knowledge team upload execution gate status must be supported.'));
  }
  if (payload.gateKind !== 'approval-gated-dry-run') {
    issues.push(error('$.gateKind', 'Knowledge team upload execution gate kind must be approval-gated-dry-run.'));
  }
  if (payload.plannedOperation !== 'stage-knowledge-pack') {
    issues.push(error('$.plannedOperation', 'Knowledge team upload execution gate operation must be stage-knowledge-pack.'));
  }
  if (payload.uploadApproved !== false) {
    issues.push(error('$.uploadApproved', 'Knowledge team upload execution gate must not approve upload.'));
  }
  if (payload.uploadExecutionAllowed !== false) {
    issues.push(error('$.uploadExecutionAllowed', 'Knowledge team upload execution gate must not allow upload execution.'));
  }
  if (payload.clientCreated !== false) {
    issues.push(error('$.clientCreated', 'Knowledge team upload execution gate must not create clients.'));
  }
  if (payload.adapterInjected !== false) {
    issues.push(error('$.adapterInjected', 'Knowledge team upload execution gate must not inject adapters.'));
  }
  if (payload.writeTokenIssued !== false) {
    issues.push(error('$.writeTokenIssued', 'Knowledge team upload execution gate must not issue write tokens.'));
  }
  if (payload.executionLeaseCreated !== false) {
    issues.push(error('$.executionLeaseCreated', 'Knowledge team upload execution gate must not create execution leases.'));
  }
  if (payload.objectWriteAttempted !== false) {
    issues.push(error('$.objectWriteAttempted', 'Knowledge team upload execution gate must not attempt object writes.'));
  }
  if (payload.metadataIndexWriteAttempted !== false) {
    issues.push(error('$.metadataIndexWriteAttempted', 'Knowledge team upload execution gate must not attempt metadata index writes.'));
  }
  if (payload.remoteMutationPerformed !== false) {
    issues.push(error('$.remoteMutationPerformed', 'Knowledge team upload execution gate must not perform remote mutations.'));
  }

  if (!isRecord(payload.target)) {
    issues.push(error('$.target', 'Knowledge team upload execution gate target must be an object.'));
  } else {
    for (const key of ['manifestId', 'artifactId']) {
      if (payload.target[key] !== null && (typeof payload.target[key] !== 'string' || !/^[a-f0-9]{24}$/.test(payload.target[key]))) {
        issues.push(error(`$.target.${key}`, 'must be null or a safe 24-character id.'));
      }
      if (payload.status === 'gate-ready' && payload.target[key] === null) {
        issues.push(error(`$.target.${key}`, 'must be set for gate-ready payloads.'));
      }
    }
    if (payload.target.objectSha256 !== null && (typeof payload.target.objectSha256 !== 'string' || !SAFE_SHA256_PATTERN.test(payload.target.objectSha256))) {
      issues.push(error('$.target.objectSha256', 'must be null or a SHA-256 hex string.'));
    }
    if (payload.status === 'gate-ready' && payload.target.objectSha256 === null) {
      issues.push(error('$.target.objectSha256', 'must be set for gate-ready payloads.'));
    }
    if (payload.target.objectKey !== null && (typeof payload.target.objectKey !== 'string' || !isSafeKnowledgeTeamArtifactObjectKey(payload.target.objectKey))) {
      issues.push(error('$.target.objectKey', 'must be null or a safe team artifact object key.'));
    }
    if (payload.status === 'gate-ready' && payload.target.objectKey === null) {
      issues.push(error('$.target.objectKey', 'must be set for gate-ready payloads.'));
    }
  }

  if (!isRecord(payload.approvalGate)) {
    issues.push(error('$.approvalGate', 'Knowledge team upload execution gate approvalGate must be an object.'));
  } else {
    if (payload.approvalGate.source !== 'upload-approval-continuation') {
      issues.push(error('$.approvalGate.source', 'must be upload-approval-continuation.'));
    }
    if (!isOneOf(payload.approvalGate.continuationStatus, UPLOAD_EXECUTION_GATE_CONTINUATION_STATUSES)) {
      issues.push(error('$.approvalGate.continuationStatus', 'must be a supported continuation status.'));
    }
    for (const key of ['approvalRequired', 'approvalProvided', 'fingerprintVerified', 'mutationApprovalRequired', 'scopeMatched']) {
      if (typeof payload.approvalGate[key] !== 'boolean') {
        issues.push(error(`$.approvalGate.${key}`, 'must be a boolean.'));
      }
    }
    if (payload.approvalGate.approvalRequired !== true) {
      issues.push(error('$.approvalGate.approvalRequired', 'must be true.'));
    }
    if (payload.approvalGate.mutationApprovalRequired !== true) {
      issues.push(error('$.approvalGate.mutationApprovalRequired', 'must be true.'));
    }
    if (payload.approvalGate.mutationApprovalGranted !== false) {
      issues.push(error('$.approvalGate.mutationApprovalGranted', 'must be false.'));
    }
    if (payload.approvalGate.uploadApproved !== false) {
      issues.push(error('$.approvalGate.uploadApproved', 'must be false.'));
    }
    if (payload.approvalGate.uploadExecutionAllowed !== false) {
      issues.push(error('$.approvalGate.uploadExecutionAllowed', 'must be false.'));
    }
    if (payload.status === 'gate-ready') {
      if (payload.approvalGate.continuationStatus !== 'continuation-ready') {
        issues.push(error('$.approvalGate.continuationStatus', 'must be continuation-ready for gate-ready payloads.'));
      }
      if (payload.approvalGate.approvalProvided !== true) {
        issues.push(error('$.approvalGate.approvalProvided', 'must be true for gate-ready payloads.'));
      }
      if (payload.approvalGate.fingerprintVerified !== true) {
        issues.push(error('$.approvalGate.fingerprintVerified', 'must be true for gate-ready payloads.'));
      }
      if (payload.approvalGate.scopeMatched !== true) {
        issues.push(error('$.approvalGate.scopeMatched', 'must be true for gate-ready payloads.'));
      }
    }
  }

  if (!isRecord(payload.mockHarness)) {
    issues.push(error('$.mockHarness', 'Knowledge team upload execution gate mockHarness must be an object.'));
  } else {
    if (payload.mockHarness.source !== 'upload-mock-harness') {
      issues.push(error('$.mockHarness.source', 'must be upload-mock-harness.'));
    }
    if (!isOneOf(payload.mockHarness.status, UPLOAD_EXECUTION_GATE_HARNESS_STATUSES)) {
      issues.push(error('$.mockHarness.status', 'must be a supported harness status.'));
    }
    if (!isOneOf(payload.mockHarness.harnessKind, UPLOAD_EXECUTION_GATE_HARNESS_KINDS)) {
      issues.push(error('$.mockHarness.harnessKind', 'must be a supported harness kind.'));
    }
    if (payload.mockHarness.adapterName !== null) {
      if (typeof payload.mockHarness.adapterName !== 'string' || !isSafeKnowledgeTeamBackendAdapterName(payload.mockHarness.adapterName)) {
        issues.push(error('$.mockHarness.adapterName', 'must be null or a safe mock adapter name.'));
      }
    }
    if (!isOneOf(payload.mockHarness.adapterBackendKind, UPLOAD_EXECUTION_GATE_ADAPTER_BACKENDS)) {
      issues.push(error('$.mockHarness.adapterBackendKind', 'must be a supported adapter backend kind.'));
    }
    for (const key of ['mockAdapterInstantiated', 'descriptorMatched']) {
      if (typeof payload.mockHarness[key] !== 'boolean') {
        issues.push(error(`$.mockHarness.${key}`, 'must be a boolean.'));
      }
    }
    if (payload.mockHarness.objectWriteAttempted !== false) {
      issues.push(error('$.mockHarness.objectWriteAttempted', 'must be false.'));
    }
    if (payload.mockHarness.indexWriteAttempted !== false) {
      issues.push(error('$.mockHarness.indexWriteAttempted', 'must be false.'));
    }
    if (payload.mockHarness.remoteMutationPerformed !== false) {
      issues.push(error('$.mockHarness.remoteMutationPerformed', 'must be false.'));
    }
    if (payload.status === 'gate-ready') {
      if (payload.mockHarness.status !== 'harness-ready') {
        issues.push(error('$.mockHarness.status', 'must be harness-ready for gate-ready payloads.'));
      }
      if (payload.mockHarness.harnessKind !== 'in-memory-mock') {
        issues.push(error('$.mockHarness.harnessKind', 'must be in-memory-mock for gate-ready payloads.'));
      }
      if (payload.mockHarness.mockAdapterInstantiated !== true) {
        issues.push(error('$.mockHarness.mockAdapterInstantiated', 'must be true for gate-ready payloads.'));
      }
      if (payload.mockHarness.adapterBackendKind !== 'mock-s3-compatible') {
        issues.push(error('$.mockHarness.adapterBackendKind', 'must be mock-s3-compatible for gate-ready payloads.'));
      }
      if (payload.mockHarness.descriptorMatched !== true) {
        issues.push(error('$.mockHarness.descriptorMatched', 'must be true for gate-ready payloads.'));
      }
    }
  }

  if (!isRecord(payload.executionBoundary)) {
    issues.push(error('$.executionBoundary', 'Knowledge team upload execution gate executionBoundary must be an object.'));
  } else {
    if (payload.executionBoundary.dryRunOnly !== true) {
      issues.push(error('$.executionBoundary.dryRunOnly', 'must be true.'));
    }
    if (payload.executionBoundary.rollbackPlanRequired !== true) {
      issues.push(error('$.executionBoundary.rollbackPlanRequired', 'must be true.'));
    }
    if (payload.executionBoundary.auditRecordRequired !== true) {
      issues.push(error('$.executionBoundary.auditRecordRequired', 'must be true.'));
    }
    if (typeof payload.executionBoundary.adapterInjectionReviewed !== 'boolean') {
      issues.push(error('$.executionBoundary.adapterInjectionReviewed', 'must be a boolean.'));
    }
    if (payload.status === 'gate-ready' && payload.executionBoundary.adapterInjectionReviewed !== true) {
      issues.push(error('$.executionBoundary.adapterInjectionReviewed', 'must be true for gate-ready payloads.'));
    }
    for (const key of [
      'artifactBytesProvided',
      'adapterInjected',
      'clientCreated',
      'credentialValuesRead',
      'credentialPresenceChecked',
      'liveCheckPerformed',
      'writeTokenIssued',
      'executionLeaseCreated',
      'uploadCommandGenerated',
      'objectWriteAttempted',
      'metadataIndexWriteAttempted',
      'remoteMutationPerformed'
    ]) {
      if (payload.executionBoundary[key] !== false) {
        issues.push(error(`$.executionBoundary.${key}`, 'must be false.'));
      }
    }
  }

  if (!isRecord(payload.readiness)) {
    issues.push(error('$.readiness', 'Knowledge team upload execution gate readiness must be an object.'));
  } else {
    validateBlockers({
      readiness: payload.readiness,
      supportedCodes: UPLOAD_EXECUTION_GATE_BLOCKERS,
      supportedStatuses: UPLOAD_EXECUTION_GATE_STATUSES,
      supportedNextActions: UPLOAD_EXECUTION_GATE_NEXT_ACTIONS,
      path: '$.readiness',
      issues
    });
  }

  return createEmptyKnowledgeValidationReport({ inputPath, inputKind, issues });
}

export function validateKnowledgeTeamUploadMutationPlanPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  validateCommonDryRunBoundary(payload, issues, 'Knowledge team upload mutation plan');
  validateNoUploadApprovalLeakage(payload, '$', issues);

  if (!isOneOf(payload.status, UPLOAD_MUTATION_PLAN_STATUSES)) {
    issues.push(error('$.status', 'Knowledge team upload mutation plan status must be supported.'));
  }
  if (payload.planKind !== 'approval-audit-dry-run') {
    issues.push(error('$.planKind', 'Knowledge team upload mutation plan kind must be approval-audit-dry-run.'));
  }
  if (payload.plannedOperation !== 'stage-knowledge-pack') {
    issues.push(error('$.plannedOperation', 'Knowledge team upload mutation plan operation must be stage-knowledge-pack.'));
  }
  for (const key of [
    'uploadApproved',
    'uploadExecutionAllowed',
    'mutationApprovalGranted',
    'clientCreated',
    'adapterInjected',
    'artifactBytesProvided',
    'writeTokenIssued',
    'executionLeaseCreated',
    'rollbackPlanCreated',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed'
  ]) {
    if (payload[key] !== false) {
      issues.push(error(`$.${key}`, 'Knowledge team upload mutation plan must keep mutation and execution fields false.'));
    }
  }

  if (!isRecord(payload.target)) {
    issues.push(error('$.target', 'Knowledge team upload mutation plan target must be an object.'));
  } else {
    for (const key of ['manifestId', 'artifactId']) {
      if (payload.target[key] !== null && (typeof payload.target[key] !== 'string' || !/^[a-f0-9]{24}$/.test(payload.target[key]))) {
        issues.push(error(`$.target.${key}`, 'must be null or a safe 24-character id.'));
      }
      if (payload.status === 'plan-ready' && payload.target[key] === null) {
        issues.push(error(`$.target.${key}`, 'must be set for plan-ready payloads.'));
      }
    }
    if (payload.target.objectSha256 !== null && (typeof payload.target.objectSha256 !== 'string' || !SAFE_SHA256_PATTERN.test(payload.target.objectSha256))) {
      issues.push(error('$.target.objectSha256', 'must be null or a SHA-256 hex string.'));
    }
    if (payload.status === 'plan-ready' && payload.target.objectSha256 === null) {
      issues.push(error('$.target.objectSha256', 'must be set for plan-ready payloads.'));
    }
    if (payload.target.objectKey !== null && (typeof payload.target.objectKey !== 'string' || !isSafeKnowledgeTeamArtifactObjectKey(payload.target.objectKey))) {
      issues.push(error('$.target.objectKey', 'must be null or a safe team artifact object key.'));
    }
    if (payload.status === 'plan-ready' && payload.target.objectKey === null) {
      issues.push(error('$.target.objectKey', 'must be set for plan-ready payloads.'));
    }
  }

  if (!isRecord(payload.sourceGate)) {
    issues.push(error('$.sourceGate', 'Knowledge team upload mutation plan sourceGate must be an object.'));
  } else {
    if (payload.sourceGate.source !== 'upload-execution-gate') {
      issues.push(error('$.sourceGate.source', 'must be upload-execution-gate.'));
    }
    if (!isOneOf(payload.sourceGate.gateStatus, UPLOAD_MUTATION_PLAN_GATE_STATUSES)) {
      issues.push(error('$.sourceGate.gateStatus', 'must be a supported gate status.'));
    }
    if (!isOneOf(payload.sourceGate.gateKind, UPLOAD_MUTATION_PLAN_GATE_KINDS)) {
      issues.push(error('$.sourceGate.gateKind', 'must be a supported gate kind.'));
    }
    if (!isOneOf(payload.sourceGate.gateNextAction, UPLOAD_MUTATION_PLAN_GATE_NEXT_ACTIONS)) {
      issues.push(error('$.sourceGate.gateNextAction', 'must be a supported gate next action.'));
    }
    if (!isOneOf(payload.sourceGate.continuationStatus, UPLOAD_MUTATION_PLAN_CONTINUATION_STATUSES)) {
      issues.push(error('$.sourceGate.continuationStatus', 'must be a supported continuation status.'));
    }
    if (!isOneOf(payload.sourceGate.mockHarnessStatus, UPLOAD_MUTATION_PLAN_HARNESS_STATUSES)) {
      issues.push(error('$.sourceGate.mockHarnessStatus', 'must be a supported mock harness status.'));
    }
    if (!isOneOf(payload.sourceGate.mockHarnessKind, UPLOAD_MUTATION_PLAN_HARNESS_KINDS)) {
      issues.push(error('$.sourceGate.mockHarnessKind', 'must be a supported mock harness kind.'));
    }
    if (!isOneOf(payload.sourceGate.adapterBackendKind, UPLOAD_MUTATION_PLAN_ADAPTER_BACKENDS)) {
      issues.push(error('$.sourceGate.adapterBackendKind', 'must be a supported adapter backend kind.'));
    }
    for (const key of ['scopeMatched', 'approvalProvided', 'fingerprintVerified', 'mockAdapterInstantiated']) {
      if (typeof payload.sourceGate[key] !== 'boolean') {
        issues.push(error(`$.sourceGate.${key}`, 'must be a boolean.'));
      }
    }
    if (payload.sourceGate.adapterName !== null) {
      if (typeof payload.sourceGate.adapterName !== 'string' || !isSafeKnowledgeTeamBackendAdapterName(payload.sourceGate.adapterName)) {
        issues.push(error('$.sourceGate.adapterName', 'must be null or a safe adapter name.'));
      }
    }
    if (payload.status === 'plan-ready') {
      if (payload.sourceGate.gateStatus !== 'gate-ready') {
        issues.push(error('$.sourceGate.gateStatus', 'must be gate-ready for plan-ready payloads.'));
      }
      if (payload.sourceGate.gateKind !== 'approval-gated-dry-run') {
        issues.push(error('$.sourceGate.gateKind', 'must be approval-gated-dry-run for plan-ready payloads.'));
      }
      if (payload.sourceGate.gateNextAction !== 'request-separate-mutation-approval') {
        issues.push(error('$.sourceGate.gateNextAction', 'must request separate mutation approval for plan-ready payloads.'));
      }
      if (payload.sourceGate.scopeMatched !== true) {
        issues.push(error('$.sourceGate.scopeMatched', 'must be true for plan-ready payloads.'));
      }
      if (payload.sourceGate.continuationStatus !== 'continuation-ready') {
        issues.push(error('$.sourceGate.continuationStatus', 'must be continuation-ready for plan-ready payloads.'));
      }
      if (payload.sourceGate.approvalProvided !== true) {
        issues.push(error('$.sourceGate.approvalProvided', 'must be true for plan-ready payloads.'));
      }
      if (payload.sourceGate.fingerprintVerified !== true) {
        issues.push(error('$.sourceGate.fingerprintVerified', 'must be true for plan-ready payloads.'));
      }
      if (payload.sourceGate.mockHarnessStatus !== 'harness-ready') {
        issues.push(error('$.sourceGate.mockHarnessStatus', 'must be harness-ready for plan-ready payloads.'));
      }
      if (payload.sourceGate.mockHarnessKind !== 'in-memory-mock') {
        issues.push(error('$.sourceGate.mockHarnessKind', 'must be in-memory-mock for plan-ready payloads.'));
      }
      if (payload.sourceGate.mockAdapterInstantiated !== true) {
        issues.push(error('$.sourceGate.mockAdapterInstantiated', 'must be true for plan-ready payloads.'));
      }
      if (payload.sourceGate.adapterName === null) {
        issues.push(error('$.sourceGate.adapterName', 'must be set for plan-ready payloads.'));
      }
      if (payload.sourceGate.adapterBackendKind !== 'mock-s3-compatible') {
        issues.push(error('$.sourceGate.adapterBackendKind', 'must be mock-s3-compatible for plan-ready payloads.'));
      }
    }
  }

  if (!isRecord(payload.approvalAudit)) {
    issues.push(error('$.approvalAudit', 'Knowledge team upload mutation plan approvalAudit must be an object.'));
  } else {
    if (payload.approvalAudit.mutationApprovalRequired !== true) {
      issues.push(error('$.approvalAudit.mutationApprovalRequired', 'must be true.'));
    }
    for (const key of ['mutationApprovalGranted', 'humanApprovalRequestIssued', 'uploadApproved', 'uploadExecutionAllowed']) {
      if (payload.approvalAudit[key] !== false) {
        issues.push(error(`$.approvalAudit.${key}`, 'must be false.'));
      }
    }
    const fingerprintValue = validateScopedSha256FingerprintObject(
      payload.approvalAudit.approvalScopeFingerprint,
      '$.approvalAudit.approvalScopeFingerprint',
      issues,
      {
        expectedScope: 'stage-knowledge-pack-mutation-plan-v1',
        expectedCanonicalFieldCount: 12,
        allowNullValue: payload.status === 'blocked'
      }
    );
    if (payload.status === 'plan-ready' && fingerprintValue === null) {
      issues.push(error('$.approvalAudit.approvalScopeFingerprint.value', 'Plan-ready upload mutation plans require a fingerprint value.'));
    }
  }

  if (!isRecord(payload.executionPlan)) {
    issues.push(error('$.executionPlan', 'Knowledge team upload mutation plan executionPlan must be an object.'));
  } else {
    for (const key of [
      'dryRunOnly',
      'artifactBytesRequiredBeforeExecution',
      'adapterInjectionRequiredBeforeExecution',
      'writeTokenRequiredBeforeExecution',
      'executionLeaseRequiredBeforeExecution',
      'rollbackPlanRequired',
      'auditRecordRequired'
    ]) {
      if (payload.executionPlan[key] !== true) {
        issues.push(error(`$.executionPlan.${key}`, 'must be true.'));
      }
    }
    for (const key of [
      'executable',
      'artifactBytesProvided',
      'adapterInjected',
      'writeTokenIssued',
      'executionLeaseCreated',
      'rollbackPlanCreated',
      'auditRecordCreated',
      'clientCreated',
      'credentialValuesRead',
      'credentialPresenceChecked',
      'liveCheckPerformed',
      'uploadCommandGenerated',
      'objectWriteAttempted',
      'metadataIndexWriteAttempted',
      'remoteMutationPerformed'
    ]) {
      if (payload.executionPlan[key] !== false) {
        issues.push(error(`$.executionPlan.${key}`, 'must be false.'));
      }
    }
  }

  if (!isRecord(payload.readiness)) {
    issues.push(error('$.readiness', 'Knowledge team upload mutation plan readiness must be an object.'));
  } else {
    validateBlockers({
      readiness: payload.readiness,
      supportedCodes: UPLOAD_MUTATION_PLAN_BLOCKERS,
      supportedStatuses: UPLOAD_MUTATION_PLAN_STATUSES,
      supportedNextActions: UPLOAD_MUTATION_PLAN_NEXT_ACTIONS,
      path: '$.readiness',
      issues
    });
    if (payload.status === 'plan-ready' && payload.readiness.status !== 'plan-ready') {
      issues.push(error('$.readiness.status', 'must be plan-ready when payload status is plan-ready.'));
    }
    if (payload.status === 'plan-ready' && payload.readiness.nextAction !== 'request-human-mutation-approval') {
      issues.push(error('$.readiness.nextAction', 'must request human mutation approval for plan-ready payloads.'));
    }
  }

  return createEmptyKnowledgeValidationReport({ inputPath, inputKind, issues });
}

export function validateKnowledgeTeamUploadMutationApprovalReviewPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  validateCommonDryRunBoundary(payload, issues, 'Knowledge team upload mutation approval review');
  validateNoUploadApprovalLeakage(payload, '$', issues);

  if (!isOneOf(payload.status, UPLOAD_MUTATION_APPROVAL_REVIEW_STATUSES)) {
    issues.push(error('$.status', 'Knowledge team upload mutation approval review status must be supported.'));
  }
  if (payload.reviewKind !== 'human-fingerprint-dry-run') {
    issues.push(error('$.reviewKind', 'Knowledge team upload mutation approval review kind must be human-fingerprint-dry-run.'));
  }
  if (payload.plannedOperation !== 'stage-knowledge-pack') {
    issues.push(error('$.plannedOperation', 'Knowledge team upload mutation approval review operation must be stage-knowledge-pack.'));
  }
  for (const key of [
    'uploadApproved',
    'uploadExecutionAllowed',
    'mutationApprovalGranted',
    'clientCreated',
    'adapterInjected',
    'artifactBytesProvided',
    'writeTokenIssued',
    'executionLeaseCreated',
    'rollbackPlanCreated',
    'objectWriteAttempted',
    'metadataIndexWriteAttempted',
    'remoteMutationPerformed'
  ]) {
    if (payload[key] !== false) {
      issues.push(error(`$.${key}`, 'Knowledge team upload mutation approval review must keep mutation and execution fields false.'));
    }
  }

  if (!isRecord(payload.target)) {
    issues.push(error('$.target', 'Knowledge team upload mutation approval review target must be an object.'));
  } else {
    for (const key of ['manifestId', 'artifactId']) {
      if (payload.target[key] !== null && (typeof payload.target[key] !== 'string' || !/^[a-f0-9]{24}$/.test(payload.target[key]))) {
        issues.push(error(`$.target.${key}`, 'must be null or a safe 24-character id.'));
      }
      if (payload.status === 'review-ready' && payload.target[key] === null) {
        issues.push(error(`$.target.${key}`, 'must be set for review-ready payloads.'));
      }
    }
    if (payload.target.objectSha256 !== null && (typeof payload.target.objectSha256 !== 'string' || !SAFE_SHA256_PATTERN.test(payload.target.objectSha256))) {
      issues.push(error('$.target.objectSha256', 'must be null or a SHA-256 hex string.'));
    }
    if (payload.status === 'review-ready' && payload.target.objectSha256 === null) {
      issues.push(error('$.target.objectSha256', 'must be set for review-ready payloads.'));
    }
    if (payload.target.objectKey !== null && (typeof payload.target.objectKey !== 'string' || !isSafeKnowledgeTeamArtifactObjectKey(payload.target.objectKey))) {
      issues.push(error('$.target.objectKey', 'must be null or a safe team artifact object key.'));
    }
    if (payload.status === 'review-ready' && payload.target.objectKey === null) {
      issues.push(error('$.target.objectKey', 'must be set for review-ready payloads.'));
    }
  }

  if (!isRecord(payload.sourcePlan)) {
    issues.push(error('$.sourcePlan', 'Knowledge team upload mutation approval review sourcePlan must be an object.'));
  } else {
    if (payload.sourcePlan.source !== 'upload-mutation-plan') {
      issues.push(error('$.sourcePlan.source', 'must be upload-mutation-plan.'));
    }
    if (!isOneOf(payload.sourcePlan.planStatus, UPLOAD_MUTATION_APPROVAL_REVIEW_PLAN_STATUSES)) {
      issues.push(error('$.sourcePlan.planStatus', 'must be a supported plan status.'));
    }
    if (!isOneOf(payload.sourcePlan.planKind, UPLOAD_MUTATION_APPROVAL_REVIEW_PLAN_KINDS)) {
      issues.push(error('$.sourcePlan.planKind', 'must be a supported plan kind.'));
    }
    if (!isOneOf(payload.sourcePlan.planNextAction, UPLOAD_MUTATION_APPROVAL_REVIEW_PLAN_NEXT_ACTIONS)) {
      issues.push(error('$.sourcePlan.planNextAction', 'must be a supported plan next action.'));
    }
    if (!isOneOf(payload.sourcePlan.gateStatus, UPLOAD_MUTATION_APPROVAL_REVIEW_GATE_STATUSES)) {
      issues.push(error('$.sourcePlan.gateStatus', 'must be a supported gate status.'));
    }
    if (!isOneOf(payload.sourcePlan.gateKind, UPLOAD_MUTATION_APPROVAL_REVIEW_GATE_KINDS)) {
      issues.push(error('$.sourcePlan.gateKind', 'must be a supported gate kind.'));
    }
    if (!isOneOf(payload.sourcePlan.continuationStatus, UPLOAD_MUTATION_APPROVAL_REVIEW_CONTINUATION_STATUSES)) {
      issues.push(error('$.sourcePlan.continuationStatus', 'must be a supported continuation status.'));
    }
    if (!isOneOf(payload.sourcePlan.mockHarnessStatus, UPLOAD_MUTATION_APPROVAL_REVIEW_HARNESS_STATUSES)) {
      issues.push(error('$.sourcePlan.mockHarnessStatus', 'must be a supported mock harness status.'));
    }
    if (!isOneOf(payload.sourcePlan.mockHarnessKind, UPLOAD_MUTATION_APPROVAL_REVIEW_HARNESS_KINDS)) {
      issues.push(error('$.sourcePlan.mockHarnessKind', 'must be a supported mock harness kind.'));
    }
    if (!isOneOf(payload.sourcePlan.adapterBackendKind, UPLOAD_MUTATION_APPROVAL_REVIEW_ADAPTER_BACKENDS)) {
      issues.push(error('$.sourcePlan.adapterBackendKind', 'must be a supported adapter backend kind.'));
    }
    for (const key of ['scopeMatched', 'approvalProvided', 'sourceFingerprintVerified', 'mockAdapterInstantiated']) {
      if (typeof payload.sourcePlan[key] !== 'boolean') {
        issues.push(error(`$.sourcePlan.${key}`, 'must be a boolean.'));
      }
    }
    if (payload.sourcePlan.adapterName !== null) {
      if (typeof payload.sourcePlan.adapterName !== 'string' || !isSafeKnowledgeTeamBackendAdapterName(payload.sourcePlan.adapterName)) {
        issues.push(error('$.sourcePlan.adapterName', 'must be null or a safe adapter name.'));
      }
    }

    const approvalFingerprint = isRecord(payload.sourcePlan.approvalFingerprint)
      ? payload.sourcePlan.approvalFingerprint
      : null;
    if (approvalFingerprint === null) {
      issues.push(error('$.sourcePlan.approvalFingerprint', 'must be an object.'));
    } else {
      if (approvalFingerprint.algorithm !== 'sha256') {
        issues.push(error('$.sourcePlan.approvalFingerprint.algorithm', 'must be sha256.'));
      }
      if (approvalFingerprint.scope !== 'stage-knowledge-pack-mutation-plan-v1' && approvalFingerprint.scope !== 'unsupported') {
        issues.push(error('$.sourcePlan.approvalFingerprint.scope', 'must be a supported scope.'));
      }
      if (approvalFingerprint.canonicalFieldCount !== null
        && (!Number.isInteger(approvalFingerprint.canonicalFieldCount) || (approvalFingerprint.canonicalFieldCount as number) < 0)) {
        issues.push(error('$.sourcePlan.approvalFingerprint.canonicalFieldCount', 'must be null or a non-negative integer.'));
      }
      if (approvalFingerprint.value !== null && (typeof approvalFingerprint.value !== 'string' || !SAFE_SHA256_PATTERN.test(approvalFingerprint.value))) {
        issues.push(error('$.sourcePlan.approvalFingerprint.value', 'must be null or a SHA-256 hex string.'));
      }
      if (payload.status === 'review-ready') {
        if (approvalFingerprint.scope !== 'stage-knowledge-pack-mutation-plan-v1') {
          issues.push(error('$.sourcePlan.approvalFingerprint.scope', 'must be stage-knowledge-pack-mutation-plan-v1 for review-ready payloads.'));
        }
        if (approvalFingerprint.canonicalFieldCount !== 12) {
          issues.push(error('$.sourcePlan.approvalFingerprint.canonicalFieldCount', 'must be 12 for review-ready payloads.'));
        }
        if (typeof approvalFingerprint.value !== 'string' || !SAFE_SHA256_PATTERN.test(approvalFingerprint.value)) {
          issues.push(error('$.sourcePlan.approvalFingerprint.value', 'must be set for review-ready payloads.'));
        }
      }
    }

    if (payload.status === 'review-ready') {
      if (payload.sourcePlan.planStatus !== 'plan-ready') {
        issues.push(error('$.sourcePlan.planStatus', 'must be plan-ready for review-ready payloads.'));
      }
      if (payload.sourcePlan.planKind !== 'approval-audit-dry-run') {
        issues.push(error('$.sourcePlan.planKind', 'must be approval-audit-dry-run for review-ready payloads.'));
      }
      if (payload.sourcePlan.planNextAction !== 'request-human-mutation-approval') {
        issues.push(error('$.sourcePlan.planNextAction', 'must request human mutation approval for review-ready payloads.'));
      }
      if (payload.sourcePlan.gateStatus !== 'gate-ready') {
        issues.push(error('$.sourcePlan.gateStatus', 'must be gate-ready for review-ready payloads.'));
      }
      if (payload.sourcePlan.gateKind !== 'approval-gated-dry-run') {
        issues.push(error('$.sourcePlan.gateKind', 'must be approval-gated-dry-run for review-ready payloads.'));
      }
      if (payload.sourcePlan.scopeMatched !== true) {
        issues.push(error('$.sourcePlan.scopeMatched', 'must be true for review-ready payloads.'));
      }
      if (payload.sourcePlan.continuationStatus !== 'continuation-ready') {
        issues.push(error('$.sourcePlan.continuationStatus', 'must be continuation-ready for review-ready payloads.'));
      }
      if (payload.sourcePlan.approvalProvided !== true) {
        issues.push(error('$.sourcePlan.approvalProvided', 'must be true for review-ready payloads.'));
      }
      if (payload.sourcePlan.sourceFingerprintVerified !== true) {
        issues.push(error('$.sourcePlan.sourceFingerprintVerified', 'must be true for review-ready payloads.'));
      }
      if (payload.sourcePlan.mockHarnessStatus !== 'harness-ready') {
        issues.push(error('$.sourcePlan.mockHarnessStatus', 'must be harness-ready for review-ready payloads.'));
      }
      if (payload.sourcePlan.mockHarnessKind !== 'in-memory-mock') {
        issues.push(error('$.sourcePlan.mockHarnessKind', 'must be in-memory-mock for review-ready payloads.'));
      }
      if (payload.sourcePlan.mockAdapterInstantiated !== true) {
        issues.push(error('$.sourcePlan.mockAdapterInstantiated', 'must be true for review-ready payloads.'));
      }
      if (payload.sourcePlan.adapterName === null) {
        issues.push(error('$.sourcePlan.adapterName', 'must be set for review-ready payloads.'));
      }
      if (payload.sourcePlan.adapterBackendKind !== 'mock-s3-compatible') {
        issues.push(error('$.sourcePlan.adapterBackendKind', 'must be mock-s3-compatible for review-ready payloads.'));
      }
    }
  }

  if (!isRecord(payload.approvalReview)) {
    issues.push(error('$.approvalReview', 'Knowledge team upload mutation approval review approvalReview must be an object.'));
  } else {
    if (payload.approvalReview.mutationApprovalRequired !== true) {
      issues.push(error('$.approvalReview.mutationApprovalRequired', 'must be true.'));
    }
    if (payload.approvalReview.humanReviewRequired !== true) {
      issues.push(error('$.approvalReview.humanReviewRequired', 'must be true.'));
    }
    if (typeof payload.approvalReview.humanReviewRecorded !== 'boolean') {
      issues.push(error('$.approvalReview.humanReviewRecorded', 'must be a boolean.'));
    }
    if (payload.approvalReview.source !== null && payload.approvalReview.source !== 'cli-flag') {
      issues.push(error('$.approvalReview.source', 'must be cli-flag or null.'));
    }
    if (payload.approvalReview.suppliedFingerprint !== null
      && (typeof payload.approvalReview.suppliedFingerprint !== 'string' || !SAFE_SHA256_PATTERN.test(payload.approvalReview.suppliedFingerprint))) {
      issues.push(error('$.approvalReview.suppliedFingerprint', 'must be null or a SHA-256 hex string.'));
    }
    if (payload.approvalReview.expectedFingerprint !== null
      && (typeof payload.approvalReview.expectedFingerprint !== 'string' || !SAFE_SHA256_PATTERN.test(payload.approvalReview.expectedFingerprint))) {
      issues.push(error('$.approvalReview.expectedFingerprint', 'must be null or a SHA-256 hex string.'));
    }
    if (typeof payload.approvalReview.fingerprintVerified !== 'boolean') {
      issues.push(error('$.approvalReview.fingerprintVerified', 'must be a boolean.'));
    }
    for (const key of ['mutationApprovalGranted', 'uploadApproved', 'uploadExecutionAllowed']) {
      if (payload.approvalReview[key] !== false) {
        issues.push(error(`$.approvalReview.${key}`, 'must be false.'));
      }
    }
    if (payload.status === 'review-ready') {
      if (payload.approvalReview.humanReviewRecorded !== true) {
        issues.push(error('$.approvalReview.humanReviewRecorded', 'must be true for review-ready payloads.'));
      }
      if (payload.approvalReview.source !== 'cli-flag') {
        issues.push(error('$.approvalReview.source', 'must be cli-flag for review-ready payloads.'));
      }
      if (payload.approvalReview.fingerprintVerified !== true) {
        issues.push(error('$.approvalReview.fingerprintVerified', 'must be true for review-ready payloads.'));
      }
      if (typeof payload.approvalReview.suppliedFingerprint !== 'string' || !SAFE_SHA256_PATTERN.test(payload.approvalReview.suppliedFingerprint)) {
        issues.push(error('$.approvalReview.suppliedFingerprint', 'must be set for review-ready payloads.'));
      }
      if (payload.approvalReview.suppliedFingerprint !== payload.approvalReview.expectedFingerprint) {
        issues.push(error('$.approvalReview.suppliedFingerprint', 'must match expectedFingerprint for review-ready payloads.'));
      }
    }
  }

  if (!isRecord(payload.executionBoundary)) {
    issues.push(error('$.executionBoundary', 'Knowledge team upload mutation approval review executionBoundary must be an object.'));
  } else {
    if (payload.executionBoundary.executable !== false) {
      issues.push(error('$.executionBoundary.executable', 'must be false.'));
    }
    if (payload.executionBoundary.dryRunOnly !== true) {
      issues.push(error('$.executionBoundary.dryRunOnly', 'must be true.'));
    }
    for (const key of [
      'artifactBytesProvided',
      'adapterInjected',
      'writeTokenIssued',
      'executionLeaseCreated',
      'rollbackPlanCreated',
      'auditRecordCreated',
      'clientCreated',
      'credentialValuesRead',
      'credentialPresenceChecked',
      'liveCheckPerformed',
      'uploadCommandGenerated',
      'objectWriteAttempted',
      'metadataIndexWriteAttempted',
      'remoteMutationPerformed'
    ]) {
      if (payload.executionBoundary[key] !== false) {
        issues.push(error(`$.executionBoundary.${key}`, 'must be false.'));
      }
    }
  }

  if (!isRecord(payload.readiness)) {
    issues.push(error('$.readiness', 'Knowledge team upload mutation approval review readiness must be an object.'));
  } else {
    validateBlockers({
      readiness: payload.readiness,
      supportedCodes: UPLOAD_MUTATION_APPROVAL_REVIEW_BLOCKERS,
      supportedStatuses: UPLOAD_MUTATION_APPROVAL_REVIEW_STATUSES,
      supportedNextActions: UPLOAD_MUTATION_APPROVAL_REVIEW_NEXT_ACTIONS,
      path: '$.readiness',
      issues
    });
    if (payload.status !== payload.readiness.status) {
      issues.push(error('$.readiness.status', 'must match payload status.'));
    }
    if (payload.status === 'review-ready') {
      if (payload.readiness.nextAction !== 'plan-execution-prerequisite-boundaries') {
        issues.push(error('$.readiness.nextAction', 'must plan execution prerequisite boundaries for review-ready payloads.'));
      }
      if (payload.readiness.blockerCount !== 0) {
        issues.push(error('$.readiness.blockerCount', 'must be 0 for review-ready payloads.'));
      }
    }
    if (payload.status === 'blocked' && payload.readiness.nextAction !== 'resolve-blockers') {
      issues.push(error('$.readiness.nextAction', 'must resolve blockers for blocked payloads.'));
    }
  }

  return createEmptyKnowledgeValidationReport({ inputPath, inputKind, issues });
}

export function validateKnowledgeTeamUploadExecutionPrerequisitePlanPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  validateCommonDryRunBoundary(payload, issues, 'Knowledge team upload execution prerequisite plan');
  validateNoUploadApprovalLeakage(payload, '$', issues);

  if (!isOneOf(payload.status, UPLOAD_EXECUTION_PREREQUISITE_PLAN_STATUSES)) {
    issues.push(error('$.status', 'Knowledge team upload execution prerequisite plan status must be supported.'));
  }
  if (payload.prerequisitePlanKind !== 'execution-prerequisite-boundary-dry-run') {
    issues.push(error('$.prerequisitePlanKind', 'Knowledge team upload execution prerequisite plan kind must be execution-prerequisite-boundary-dry-run.'));
  }
  if (payload.plannedOperation !== 'stage-knowledge-pack') {
    issues.push(error('$.plannedOperation', 'Knowledge team upload execution prerequisite plan operation must be stage-knowledge-pack.'));
  }
  for (const key of [
    'uploadApproved',
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
  ]) {
    if (payload[key] !== false) {
      issues.push(error(`$.${key}`, 'Knowledge team upload execution prerequisite plan must keep mutation and execution fields false.'));
    }
  }

  if (!isRecord(payload.target)) {
    issues.push(error('$.target', 'Knowledge team upload execution prerequisite plan target must be an object.'));
  } else {
    for (const key of ['manifestId', 'artifactId']) {
      if (payload.target[key] !== null && (typeof payload.target[key] !== 'string' || !/^[a-f0-9]{24}$/.test(payload.target[key]))) {
        issues.push(error(`$.target.${key}`, 'must be null or a safe 24-character id.'));
      }
      if (payload.status === 'prerequisite-plan-ready' && payload.target[key] === null) {
        issues.push(error(`$.target.${key}`, 'must be set for prerequisite-plan-ready payloads.'));
      }
    }
    if (payload.target.objectSha256 !== null && (typeof payload.target.objectSha256 !== 'string' || !SAFE_SHA256_PATTERN.test(payload.target.objectSha256))) {
      issues.push(error('$.target.objectSha256', 'must be null or a SHA-256 hex string.'));
    }
    if (payload.status === 'prerequisite-plan-ready' && payload.target.objectSha256 === null) {
      issues.push(error('$.target.objectSha256', 'must be set for prerequisite-plan-ready payloads.'));
    }
    if (payload.target.objectKey !== null && (typeof payload.target.objectKey !== 'string' || !isSafeKnowledgeTeamArtifactObjectKey(payload.target.objectKey))) {
      issues.push(error('$.target.objectKey', 'must be null or a safe team artifact object key.'));
    }
    if (payload.status === 'prerequisite-plan-ready' && payload.target.objectKey === null) {
      issues.push(error('$.target.objectKey', 'must be set for prerequisite-plan-ready payloads.'));
    }
  }

  if (!isRecord(payload.sourceReview)) {
    issues.push(error('$.sourceReview', 'Knowledge team upload execution prerequisite plan sourceReview must be an object.'));
  } else {
    if (payload.sourceReview.source !== 'upload-mutation-approval-review') {
      issues.push(error('$.sourceReview.source', 'must be upload-mutation-approval-review.'));
    }
    if (!isOneOf(payload.sourceReview.reviewStatus, UPLOAD_EXECUTION_PREREQUISITE_PLAN_REVIEW_STATUSES)) {
      issues.push(error('$.sourceReview.reviewStatus', 'must be a supported review status.'));
    }
    if (!isOneOf(payload.sourceReview.reviewKind, UPLOAD_EXECUTION_PREREQUISITE_PLAN_REVIEW_KINDS)) {
      issues.push(error('$.sourceReview.reviewKind', 'must be a supported review kind.'));
    }
    if (!isOneOf(payload.sourceReview.reviewNextAction, UPLOAD_EXECUTION_PREREQUISITE_PLAN_REVIEW_NEXT_ACTIONS)) {
      issues.push(error('$.sourceReview.reviewNextAction', 'must be a supported review next action.'));
    }
    if (!isOneOf(payload.sourceReview.planStatus, UPLOAD_EXECUTION_PREREQUISITE_PLAN_PLAN_STATUSES)) {
      issues.push(error('$.sourceReview.planStatus', 'must be a supported plan status.'));
    }
    if (!isOneOf(payload.sourceReview.planNextAction, UPLOAD_EXECUTION_PREREQUISITE_PLAN_PLAN_NEXT_ACTIONS)) {
      issues.push(error('$.sourceReview.planNextAction', 'must be a supported plan next action.'));
    }
    if (!isOneOf(payload.sourceReview.gateStatus, UPLOAD_EXECUTION_PREREQUISITE_PLAN_GATE_STATUSES)) {
      issues.push(error('$.sourceReview.gateStatus', 'must be a supported gate status.'));
    }
    if (!isOneOf(payload.sourceReview.adapterBackendKind, UPLOAD_EXECUTION_PREREQUISITE_PLAN_ADAPTER_BACKENDS)) {
      issues.push(error('$.sourceReview.adapterBackendKind', 'must be a supported adapter backend kind.'));
    }
    for (const key of ['scopeMatched', 'humanReviewRecorded', 'fingerprintVerified', 'sourceFingerprintVerified']) {
      if (typeof payload.sourceReview[key] !== 'boolean') {
        issues.push(error(`$.sourceReview.${key}`, 'must be a boolean.'));
      }
    }
    for (const key of ['suppliedFingerprint', 'expectedFingerprint']) {
      if (payload.sourceReview[key] !== null && (typeof payload.sourceReview[key] !== 'string' || !SAFE_SHA256_PATTERN.test(payload.sourceReview[key]))) {
        issues.push(error(`$.sourceReview.${key}`, 'must be null or a SHA-256 hex string.'));
      }
    }
    if (payload.sourceReview.adapterName !== null) {
      if (typeof payload.sourceReview.adapterName !== 'string' || !isSafeKnowledgeTeamBackendAdapterName(payload.sourceReview.adapterName)) {
        issues.push(error('$.sourceReview.adapterName', 'must be null or a safe adapter name.'));
      }
    }
    if (payload.status === 'prerequisite-plan-ready') {
      if (payload.sourceReview.reviewStatus !== 'review-ready') {
        issues.push(error('$.sourceReview.reviewStatus', 'must be review-ready for prerequisite-plan-ready payloads.'));
      }
      if (payload.sourceReview.reviewKind !== 'human-fingerprint-dry-run') {
        issues.push(error('$.sourceReview.reviewKind', 'must be human-fingerprint-dry-run for prerequisite-plan-ready payloads.'));
      }
      if (payload.sourceReview.reviewNextAction !== 'plan-execution-prerequisite-boundaries') {
        issues.push(error('$.sourceReview.reviewNextAction', 'must plan execution prerequisite boundaries for prerequisite-plan-ready payloads.'));
      }
      if (payload.sourceReview.planStatus !== 'plan-ready') {
        issues.push(error('$.sourceReview.planStatus', 'must be plan-ready for prerequisite-plan-ready payloads.'));
      }
      if (payload.sourceReview.planNextAction !== 'request-human-mutation-approval') {
        issues.push(error('$.sourceReview.planNextAction', 'must request human mutation approval for prerequisite-plan-ready payloads.'));
      }
      if (payload.sourceReview.gateStatus !== 'gate-ready') {
        issues.push(error('$.sourceReview.gateStatus', 'must be gate-ready for prerequisite-plan-ready payloads.'));
      }
      if (payload.sourceReview.scopeMatched !== true) {
        issues.push(error('$.sourceReview.scopeMatched', 'must be true for prerequisite-plan-ready payloads.'));
      }
      if (payload.sourceReview.humanReviewRecorded !== true) {
        issues.push(error('$.sourceReview.humanReviewRecorded', 'must be true for prerequisite-plan-ready payloads.'));
      }
      if (payload.sourceReview.fingerprintVerified !== true) {
        issues.push(error('$.sourceReview.fingerprintVerified', 'must be true for prerequisite-plan-ready payloads.'));
      }
      if (payload.sourceReview.sourceFingerprintVerified !== true) {
        issues.push(error('$.sourceReview.sourceFingerprintVerified', 'must be true for prerequisite-plan-ready payloads.'));
      }
      if (typeof payload.sourceReview.suppliedFingerprint !== 'string' || !SAFE_SHA256_PATTERN.test(payload.sourceReview.suppliedFingerprint)) {
        issues.push(error('$.sourceReview.suppliedFingerprint', 'must be set for prerequisite-plan-ready payloads.'));
      }
      if (payload.sourceReview.suppliedFingerprint !== payload.sourceReview.expectedFingerprint) {
        issues.push(error('$.sourceReview.suppliedFingerprint', 'must match expectedFingerprint for prerequisite-plan-ready payloads.'));
      }
      if (payload.sourceReview.adapterName === null) {
        issues.push(error('$.sourceReview.adapterName', 'must be set for prerequisite-plan-ready payloads.'));
      }
      if (payload.sourceReview.adapterBackendKind !== 'mock-s3-compatible') {
        issues.push(error('$.sourceReview.adapterBackendKind', 'must be mock-s3-compatible for prerequisite-plan-ready payloads.'));
      }
    }
  }

  if (!isRecord(payload.prerequisitePlan)) {
    issues.push(error('$.prerequisitePlan', 'Knowledge team upload execution prerequisite plan prerequisitePlan must be an object.'));
  } else {
    for (const key of [
      'humanReviewRequired',
      'mutationApprovalRequired',
      'executionPrerequisitesRequired'
    ]) {
      if (payload.prerequisitePlan[key] !== true) {
        issues.push(error(`$.prerequisitePlan.${key}`, 'must be true.'));
      }
    }
    for (const key of [
      'mutationApprovalGranted',
      'uploadApproved',
      'uploadExecutionAllowed',
      'executionAllowed'
    ]) {
      if (payload.prerequisitePlan[key] !== false) {
        issues.push(error(`$.prerequisitePlan.${key}`, 'must be false.'));
      }
    }
    for (const key of ['humanReviewRecorded', 'fingerprintVerified']) {
      if (typeof payload.prerequisitePlan[key] !== 'boolean') {
        issues.push(error(`$.prerequisitePlan.${key}`, 'must be a boolean.'));
      }
    }
    if (payload.prerequisitePlan.nextRequiredBoundary !== 'write-token-boundary-design') {
      issues.push(error('$.prerequisitePlan.nextRequiredBoundary', 'must be write-token-boundary-design.'));
    }
    if (payload.status === 'prerequisite-plan-ready') {
      if (payload.prerequisitePlan.humanReviewRecorded !== true) {
        issues.push(error('$.prerequisitePlan.humanReviewRecorded', 'must be true for prerequisite-plan-ready payloads.'));
      }
      if (payload.prerequisitePlan.fingerprintVerified !== true) {
        issues.push(error('$.prerequisitePlan.fingerprintVerified', 'must be true for prerequisite-plan-ready payloads.'));
      }
    }
  }

  if (!isRecord(payload.executionBoundary)) {
    issues.push(error('$.executionBoundary', 'Knowledge team upload execution prerequisite plan executionBoundary must be an object.'));
  } else {
    for (const key of [
      'dryRunOnly',
      'artifactBytesRequiredBeforeExecution',
      'adapterInjectionRequiredBeforeExecution',
      'writeTokenRequiredBeforeExecution',
      'executionLeaseRequiredBeforeExecution',
      'rollbackPlanRequiredBeforeExecution',
      'auditRecordRequiredBeforeExecution'
    ]) {
      if (payload.executionBoundary[key] !== true) {
        issues.push(error(`$.executionBoundary.${key}`, 'must be true.'));
      }
    }
    for (const key of [
      'executable',
      'artifactBytesProvided',
      'adapterInjected',
      'writeTokenIssued',
      'executionLeaseCreated',
      'rollbackPlanCreated',
      'auditRecordCreated',
      'clientCreated',
      'credentialValuesRead',
      'credentialPresenceChecked',
      'liveCheckPerformed',
      'uploadCommandGenerated',
      'objectWriteAttempted',
      'metadataIndexWriteAttempted',
      'remoteMutationPerformed'
    ]) {
      if (payload.executionBoundary[key] !== false) {
        issues.push(error(`$.executionBoundary.${key}`, 'must be false.'));
      }
    }
  }

  if (!isRecord(payload.readiness)) {
    issues.push(error('$.readiness', 'Knowledge team upload execution prerequisite plan readiness must be an object.'));
  } else {
    validateBlockers({
      readiness: payload.readiness,
      supportedCodes: UPLOAD_EXECUTION_PREREQUISITE_PLAN_BLOCKERS,
      supportedStatuses: UPLOAD_EXECUTION_PREREQUISITE_PLAN_STATUSES,
      supportedNextActions: UPLOAD_EXECUTION_PREREQUISITE_PLAN_NEXT_ACTIONS,
      path: '$.readiness',
      issues
    });
    if (payload.status !== payload.readiness.status) {
      issues.push(error('$.readiness.status', 'must match payload status.'));
    }
    if (payload.status === 'prerequisite-plan-ready') {
      if (payload.readiness.nextAction !== 'design-write-token-boundary') {
        issues.push(error('$.readiness.nextAction', 'must design the write token boundary for prerequisite-plan-ready payloads.'));
      }
      if (payload.readiness.blockerCount !== 0) {
        issues.push(error('$.readiness.blockerCount', 'must be 0 for prerequisite-plan-ready payloads.'));
      }
    }
    if (payload.status === 'blocked' && payload.readiness.nextAction !== 'resolve-blockers') {
      issues.push(error('$.readiness.nextAction', 'must resolve blockers for blocked payloads.'));
    }
  }

  return createEmptyKnowledgeValidationReport({ inputPath, inputKind, issues });
}

export function validateKnowledgeTeamUploadWriteTokenBoundaryPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  validateCommonDryRunBoundary(payload, issues, 'Knowledge team upload write-token boundary');
  validateNoUploadApprovalLeakage(payload, '$', issues);

  if (!isOneOf(payload.status, UPLOAD_WRITE_TOKEN_BOUNDARY_STATUSES)) {
    issues.push(error('$.status', 'Knowledge team upload write-token boundary status must be supported.'));
  }
  if (payload.boundaryKind !== 'write-token-boundary-dry-run') {
    issues.push(error('$.boundaryKind', 'Knowledge team upload write-token boundary kind must be write-token-boundary-dry-run.'));
  }
  if (payload.plannedOperation !== 'stage-knowledge-pack') {
    issues.push(error('$.plannedOperation', 'Knowledge team upload write-token boundary operation must be stage-knowledge-pack.'));
  }
  for (const key of [
    'uploadApproved',
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
  ]) {
    if (payload[key] !== false) {
      issues.push(error(`$.${key}`, 'Knowledge team upload write-token boundary must keep mutation and execution fields false.'));
    }
  }

  if (!isRecord(payload.target)) {
    issues.push(error('$.target', 'Knowledge team upload write-token boundary target must be an object.'));
  } else {
    for (const key of ['manifestId', 'artifactId']) {
      if (payload.target[key] !== null && (typeof payload.target[key] !== 'string' || !/^[a-f0-9]{24}$/.test(payload.target[key]))) {
        issues.push(error(`$.target.${key}`, 'must be null or a safe 24-character id.'));
      }
      if (payload.status === 'write-token-boundary-ready' && payload.target[key] === null) {
        issues.push(error(`$.target.${key}`, 'must be set for write-token-boundary-ready payloads.'));
      }
    }
    if (payload.target.objectSha256 !== null && (typeof payload.target.objectSha256 !== 'string' || !SAFE_SHA256_PATTERN.test(payload.target.objectSha256))) {
      issues.push(error('$.target.objectSha256', 'must be null or a SHA-256 hex string.'));
    }
    if (payload.status === 'write-token-boundary-ready' && payload.target.objectSha256 === null) {
      issues.push(error('$.target.objectSha256', 'must be set for write-token-boundary-ready payloads.'));
    }
    if (payload.target.objectKey !== null && (typeof payload.target.objectKey !== 'string' || !isSafeKnowledgeTeamArtifactObjectKey(payload.target.objectKey))) {
      issues.push(error('$.target.objectKey', 'must be null or a safe team artifact object key.'));
    }
    if (payload.status === 'write-token-boundary-ready' && payload.target.objectKey === null) {
      issues.push(error('$.target.objectKey', 'must be set for write-token-boundary-ready payloads.'));
    }
  }

  if (!isRecord(payload.sourcePrerequisitePlan)) {
    issues.push(error('$.sourcePrerequisitePlan', 'Knowledge team upload write-token boundary sourcePrerequisitePlan must be an object.'));
  } else {
    if (payload.sourcePrerequisitePlan.source !== 'upload-execution-prerequisite-plan') {
      issues.push(error('$.sourcePrerequisitePlan.source', 'must be upload-execution-prerequisite-plan.'));
    }
    if (!isOneOf(payload.sourcePrerequisitePlan.prerequisiteStatus, UPLOAD_WRITE_TOKEN_BOUNDARY_PREREQUISITE_STATUSES)) {
      issues.push(error('$.sourcePrerequisitePlan.prerequisiteStatus', 'must be a supported prerequisite status.'));
    }
    if (!isOneOf(payload.sourcePrerequisitePlan.prerequisitePlanKind, UPLOAD_WRITE_TOKEN_BOUNDARY_PREREQUISITE_KINDS)) {
      issues.push(error('$.sourcePrerequisitePlan.prerequisitePlanKind', 'must be a supported prerequisite plan kind.'));
    }
    if (!isOneOf(payload.sourcePrerequisitePlan.prerequisiteNextAction, UPLOAD_WRITE_TOKEN_BOUNDARY_PREREQUISITE_NEXT_ACTIONS)) {
      issues.push(error('$.sourcePrerequisitePlan.prerequisiteNextAction', 'must be a supported prerequisite next action.'));
    }
    if (!isOneOf(payload.sourcePrerequisitePlan.reviewStatus, UPLOAD_WRITE_TOKEN_BOUNDARY_REVIEW_STATUSES)) {
      issues.push(error('$.sourcePrerequisitePlan.reviewStatus', 'must be a supported review status.'));
    }
    if (!isOneOf(payload.sourcePrerequisitePlan.reviewKind, UPLOAD_WRITE_TOKEN_BOUNDARY_REVIEW_KINDS)) {
      issues.push(error('$.sourcePrerequisitePlan.reviewKind', 'must be a supported review kind.'));
    }
    if (!isOneOf(payload.sourcePrerequisitePlan.adapterBackendKind, UPLOAD_WRITE_TOKEN_BOUNDARY_ADAPTER_BACKENDS)) {
      issues.push(error('$.sourcePrerequisitePlan.adapterBackendKind', 'must be a supported adapter backend kind.'));
    }
    for (const key of [
      'scopeMatched',
      'humanReviewRecorded',
      'fingerprintVerified',
      'sourceFingerprintVerified',
      'writeTokenRequiredBeforeExecution',
      'artifactBytesRequiredBeforeExecution',
      'adapterInjectionRequiredBeforeExecution',
      'executionLeaseRequiredBeforeExecution',
      'rollbackPlanRequiredBeforeExecution',
      'auditRecordRequiredBeforeExecution'
    ]) {
      if (typeof payload.sourcePrerequisitePlan[key] !== 'boolean') {
        issues.push(error(`$.sourcePrerequisitePlan.${key}`, 'must be a boolean.'));
      }
    }
    if (payload.sourcePrerequisitePlan.adapterName !== null) {
      if (typeof payload.sourcePrerequisitePlan.adapterName !== 'string' || !isSafeKnowledgeTeamBackendAdapterName(payload.sourcePrerequisitePlan.adapterName)) {
        issues.push(error('$.sourcePrerequisitePlan.adapterName', 'must be null or a safe adapter name.'));
      }
    }
    if (payload.status === 'write-token-boundary-ready') {
      if (payload.sourcePrerequisitePlan.prerequisiteStatus !== 'prerequisite-plan-ready') {
        issues.push(error('$.sourcePrerequisitePlan.prerequisiteStatus', 'must be prerequisite-plan-ready for write-token-boundary-ready payloads.'));
      }
      if (payload.sourcePrerequisitePlan.prerequisitePlanKind !== 'execution-prerequisite-boundary-dry-run') {
        issues.push(error('$.sourcePrerequisitePlan.prerequisitePlanKind', 'must be execution-prerequisite-boundary-dry-run for write-token-boundary-ready payloads.'));
      }
      if (payload.sourcePrerequisitePlan.prerequisiteNextAction !== 'design-write-token-boundary') {
        issues.push(error('$.sourcePrerequisitePlan.prerequisiteNextAction', 'must design the write-token boundary for write-token-boundary-ready payloads.'));
      }
      if (payload.sourcePrerequisitePlan.reviewStatus !== 'review-ready') {
        issues.push(error('$.sourcePrerequisitePlan.reviewStatus', 'must be review-ready for write-token-boundary-ready payloads.'));
      }
      if (payload.sourcePrerequisitePlan.reviewKind !== 'human-fingerprint-dry-run') {
        issues.push(error('$.sourcePrerequisitePlan.reviewKind', 'must be human-fingerprint-dry-run for write-token-boundary-ready payloads.'));
      }
      if (payload.sourcePrerequisitePlan.scopeMatched !== true) {
        issues.push(error('$.sourcePrerequisitePlan.scopeMatched', 'must be true for write-token-boundary-ready payloads.'));
      }
      if (payload.sourcePrerequisitePlan.humanReviewRecorded !== true) {
        issues.push(error('$.sourcePrerequisitePlan.humanReviewRecorded', 'must be true for write-token-boundary-ready payloads.'));
      }
      if (payload.sourcePrerequisitePlan.fingerprintVerified !== true) {
        issues.push(error('$.sourcePrerequisitePlan.fingerprintVerified', 'must be true for write-token-boundary-ready payloads.'));
      }
      if (payload.sourcePrerequisitePlan.sourceFingerprintVerified !== true) {
        issues.push(error('$.sourcePrerequisitePlan.sourceFingerprintVerified', 'must be true for write-token-boundary-ready payloads.'));
      }
      if (payload.sourcePrerequisitePlan.adapterName === null) {
        issues.push(error('$.sourcePrerequisitePlan.adapterName', 'must be set for write-token-boundary-ready payloads.'));
      }
      if (payload.sourcePrerequisitePlan.adapterBackendKind !== 'mock-s3-compatible') {
        issues.push(error('$.sourcePrerequisitePlan.adapterBackendKind', 'must be mock-s3-compatible for write-token-boundary-ready payloads.'));
      }
      for (const key of [
        'writeTokenRequiredBeforeExecution',
        'artifactBytesRequiredBeforeExecution',
        'adapterInjectionRequiredBeforeExecution',
        'executionLeaseRequiredBeforeExecution',
        'rollbackPlanRequiredBeforeExecution',
        'auditRecordRequiredBeforeExecution'
      ]) {
        if (payload.sourcePrerequisitePlan[key] !== true) {
          issues.push(error(`$.sourcePrerequisitePlan.${key}`, 'must be true for write-token-boundary-ready payloads.'));
        }
      }
    }
  }

  if (!isRecord(payload.writeTokenBoundary)) {
    issues.push(error('$.writeTokenBoundary', 'Knowledge team upload write-token boundary writeTokenBoundary must be an object.'));
  } else {
    for (const key of [
      'dryRunOnly',
      'tokenRequiredBeforeExecution',
      'tokenScopeBindingRequired',
      'tokenSingleUseRequired',
      'tokenExpiryRequired',
      'auditBindingRequired',
      'executionLeaseRequiredBeforeIssuance',
      'rollbackPlanRequiredBeforeIssuance'
    ]) {
      if (payload.writeTokenBoundary[key] !== true) {
        issues.push(error(`$.writeTokenBoundary.${key}`, 'must be true.'));
      }
    }
    for (const key of [
      'tokenIssued',
      'tokenScopeBoundToArtifact',
      'singleUseTokenIssued',
      'tokenExpirySet',
      'auditBindingCreated',
      'executionLeaseCreated',
      'rollbackPlanCreated',
      'executable'
    ]) {
      if (payload.writeTokenBoundary[key] !== false) {
        issues.push(error(`$.writeTokenBoundary.${key}`, 'must be false.'));
      }
    }
  }

  if (!isRecord(payload.remainingExecutionBoundaries)) {
    issues.push(error('$.remainingExecutionBoundaries', 'Knowledge team upload write-token boundary remainingExecutionBoundaries must be an object.'));
  } else {
    for (const key of [
      'artifactBytesRequired',
      'adapterInjectionRequired',
      'executionLeaseRequired',
      'rollbackPlanRequired',
      'auditRecordRequired'
    ]) {
      if (payload.remainingExecutionBoundaries[key] !== true) {
        issues.push(error(`$.remainingExecutionBoundaries.${key}`, 'must be true.'));
      }
    }
    for (const key of [
      'artifactBytesProvided',
      'adapterInjected',
      'executionLeaseCreated',
      'rollbackPlanCreated',
      'auditRecordCreated',
      'objectWriteAllowed',
      'metadataIndexWriteAllowed',
      'remoteMutationAllowed'
    ]) {
      if (payload.remainingExecutionBoundaries[key] !== false) {
        issues.push(error(`$.remainingExecutionBoundaries.${key}`, 'must be false.'));
      }
    }
  }

  if (!isRecord(payload.readiness)) {
    issues.push(error('$.readiness', 'Knowledge team upload write-token boundary readiness must be an object.'));
  } else {
    validateBlockers({
      readiness: payload.readiness,
      supportedCodes: UPLOAD_WRITE_TOKEN_BOUNDARY_BLOCKERS,
      supportedStatuses: UPLOAD_WRITE_TOKEN_BOUNDARY_STATUSES,
      supportedNextActions: UPLOAD_WRITE_TOKEN_BOUNDARY_NEXT_ACTIONS,
      path: '$.readiness',
      issues
    });
    if (payload.status !== payload.readiness.status) {
      issues.push(error('$.readiness.status', 'must match payload status.'));
    }
    if (payload.status === 'write-token-boundary-ready') {
      if (payload.readiness.nextAction !== 'design-execution-lease-boundary') {
        issues.push(error('$.readiness.nextAction', 'must design the execution lease boundary for write-token-boundary-ready payloads.'));
      }
      if (payload.readiness.blockerCount !== 0) {
        issues.push(error('$.readiness.blockerCount', 'must be 0 for write-token-boundary-ready payloads.'));
      }
    }
    if (payload.status === 'blocked' && payload.readiness.nextAction !== 'resolve-blockers') {
      issues.push(error('$.readiness.nextAction', 'must resolve blockers for blocked payloads.'));
    }
  }

  return createEmptyKnowledgeValidationReport({ inputPath, inputKind, issues });
}

export function validateKnowledgeTeamUploadExecutionLeaseBoundaryPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  validateCommonDryRunBoundary(payload, issues, 'Knowledge team upload execution lease boundary');
  validateNoUploadApprovalLeakage(payload, '$', issues);

  if (!isOneOf(payload.status, UPLOAD_EXECUTION_LEASE_BOUNDARY_STATUSES)) {
    issues.push(error('$.status', 'Knowledge team upload execution lease boundary status must be supported.'));
  }
  if (payload.boundaryKind !== 'execution-lease-boundary-dry-run') {
    issues.push(error('$.boundaryKind', 'Knowledge team upload execution lease boundary kind must be execution-lease-boundary-dry-run.'));
  }
  if (payload.plannedOperation !== 'stage-knowledge-pack') {
    issues.push(error('$.plannedOperation', 'Knowledge team upload execution lease boundary operation must be stage-knowledge-pack.'));
  }
  for (const key of [
    'uploadApproved',
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
  ]) {
    if (payload[key] !== false) {
      issues.push(error(`$.${key}`, 'Knowledge team upload execution lease boundary must keep mutation and execution fields false.'));
    }
  }

  if (!isRecord(payload.target)) {
    issues.push(error('$.target', 'Knowledge team upload execution lease boundary target must be an object.'));
  } else {
    for (const key of ['manifestId', 'artifactId']) {
      if (payload.target[key] !== null && (typeof payload.target[key] !== 'string' || !/^[a-f0-9]{24}$/.test(payload.target[key]))) {
        issues.push(error(`$.target.${key}`, 'must be null or a safe 24-character id.'));
      }
      if (payload.status === 'execution-lease-boundary-ready' && payload.target[key] === null) {
        issues.push(error(`$.target.${key}`, 'must be set for execution-lease-boundary-ready payloads.'));
      }
    }
    if (payload.target.objectSha256 !== null && (typeof payload.target.objectSha256 !== 'string' || !SAFE_SHA256_PATTERN.test(payload.target.objectSha256))) {
      issues.push(error('$.target.objectSha256', 'must be null or a SHA-256 hex string.'));
    }
    if (payload.status === 'execution-lease-boundary-ready' && payload.target.objectSha256 === null) {
      issues.push(error('$.target.objectSha256', 'must be set for execution-lease-boundary-ready payloads.'));
    }
    if (payload.target.objectKey !== null && (typeof payload.target.objectKey !== 'string' || !isSafeKnowledgeTeamArtifactObjectKey(payload.target.objectKey))) {
      issues.push(error('$.target.objectKey', 'must be null or a safe team artifact object key.'));
    }
    if (payload.status === 'execution-lease-boundary-ready' && payload.target.objectKey === null) {
      issues.push(error('$.target.objectKey', 'must be set for execution-lease-boundary-ready payloads.'));
    }
  }

  if (!isRecord(payload.sourceWriteTokenBoundary)) {
    issues.push(error('$.sourceWriteTokenBoundary', 'Knowledge team upload execution lease boundary sourceWriteTokenBoundary must be an object.'));
  } else {
    if (payload.sourceWriteTokenBoundary.source !== 'upload-write-token-boundary') {
      issues.push(error('$.sourceWriteTokenBoundary.source', 'must be upload-write-token-boundary.'));
    }
    if (!isOneOf(payload.sourceWriteTokenBoundary.boundaryStatus, UPLOAD_EXECUTION_LEASE_BOUNDARY_SOURCE_STATUSES)) {
      issues.push(error('$.sourceWriteTokenBoundary.boundaryStatus', 'must be a supported write-token boundary status.'));
    }
    if (!isOneOf(payload.sourceWriteTokenBoundary.boundaryKind, UPLOAD_EXECUTION_LEASE_BOUNDARY_SOURCE_KINDS)) {
      issues.push(error('$.sourceWriteTokenBoundary.boundaryKind', 'must be a supported write-token boundary kind.'));
    }
    if (!isOneOf(payload.sourceWriteTokenBoundary.boundaryNextAction, UPLOAD_EXECUTION_LEASE_BOUNDARY_SOURCE_NEXT_ACTIONS)) {
      issues.push(error('$.sourceWriteTokenBoundary.boundaryNextAction', 'must be a supported write-token boundary next action.'));
    }
    if (!isOneOf(payload.sourceWriteTokenBoundary.reviewStatus, UPLOAD_EXECUTION_LEASE_BOUNDARY_REVIEW_STATUSES)) {
      issues.push(error('$.sourceWriteTokenBoundary.reviewStatus', 'must be a supported review status.'));
    }
    if (!isOneOf(payload.sourceWriteTokenBoundary.reviewKind, UPLOAD_EXECUTION_LEASE_BOUNDARY_REVIEW_KINDS)) {
      issues.push(error('$.sourceWriteTokenBoundary.reviewKind', 'must be a supported review kind.'));
    }
    if (!isOneOf(payload.sourceWriteTokenBoundary.adapterBackendKind, UPLOAD_EXECUTION_LEASE_BOUNDARY_ADAPTER_BACKENDS)) {
      issues.push(error('$.sourceWriteTokenBoundary.adapterBackendKind', 'must be a supported adapter backend kind.'));
    }
    for (const key of [
      'scopeMatched',
      'humanReviewRecorded',
      'fingerprintVerified',
      'sourceFingerprintVerified',
      'tokenRequiredBeforeExecution',
      'tokenScopeBindingRequired',
      'tokenSingleUseRequired',
      'tokenExpiryRequired',
      'auditBindingRequired',
      'executionLeaseRequiredBeforeIssuance',
      'rollbackPlanRequiredBeforeIssuance'
    ]) {
      if (typeof payload.sourceWriteTokenBoundary[key] !== 'boolean') {
        issues.push(error(`$.sourceWriteTokenBoundary.${key}`, 'must be a boolean.'));
      }
    }
    if (payload.sourceWriteTokenBoundary.adapterName !== null) {
      if (typeof payload.sourceWriteTokenBoundary.adapterName !== 'string' || !isSafeKnowledgeTeamBackendAdapterName(payload.sourceWriteTokenBoundary.adapterName)) {
        issues.push(error('$.sourceWriteTokenBoundary.adapterName', 'must be null or a safe adapter name.'));
      }
    }
    if (payload.status === 'execution-lease-boundary-ready') {
      if (payload.sourceWriteTokenBoundary.boundaryStatus !== 'write-token-boundary-ready') {
        issues.push(error('$.sourceWriteTokenBoundary.boundaryStatus', 'must be write-token-boundary-ready for execution-lease-boundary-ready payloads.'));
      }
      if (payload.sourceWriteTokenBoundary.boundaryKind !== 'write-token-boundary-dry-run') {
        issues.push(error('$.sourceWriteTokenBoundary.boundaryKind', 'must be write-token-boundary-dry-run for execution-lease-boundary-ready payloads.'));
      }
      if (payload.sourceWriteTokenBoundary.boundaryNextAction !== 'design-execution-lease-boundary') {
        issues.push(error('$.sourceWriteTokenBoundary.boundaryNextAction', 'must design the execution lease boundary for execution-lease-boundary-ready payloads.'));
      }
      if (payload.sourceWriteTokenBoundary.reviewStatus !== 'review-ready') {
        issues.push(error('$.sourceWriteTokenBoundary.reviewStatus', 'must be review-ready for execution-lease-boundary-ready payloads.'));
      }
      if (payload.sourceWriteTokenBoundary.reviewKind !== 'human-fingerprint-dry-run') {
        issues.push(error('$.sourceWriteTokenBoundary.reviewKind', 'must be human-fingerprint-dry-run for execution-lease-boundary-ready payloads.'));
      }
      if (payload.sourceWriteTokenBoundary.scopeMatched !== true) {
        issues.push(error('$.sourceWriteTokenBoundary.scopeMatched', 'must be true for execution-lease-boundary-ready payloads.'));
      }
      if (payload.sourceWriteTokenBoundary.humanReviewRecorded !== true) {
        issues.push(error('$.sourceWriteTokenBoundary.humanReviewRecorded', 'must be true for execution-lease-boundary-ready payloads.'));
      }
      if (payload.sourceWriteTokenBoundary.fingerprintVerified !== true) {
        issues.push(error('$.sourceWriteTokenBoundary.fingerprintVerified', 'must be true for execution-lease-boundary-ready payloads.'));
      }
      if (payload.sourceWriteTokenBoundary.sourceFingerprintVerified !== true) {
        issues.push(error('$.sourceWriteTokenBoundary.sourceFingerprintVerified', 'must be true for execution-lease-boundary-ready payloads.'));
      }
      if (payload.sourceWriteTokenBoundary.adapterName === null) {
        issues.push(error('$.sourceWriteTokenBoundary.adapterName', 'must be set for execution-lease-boundary-ready payloads.'));
      }
      if (payload.sourceWriteTokenBoundary.adapterBackendKind !== 'mock-s3-compatible') {
        issues.push(error('$.sourceWriteTokenBoundary.adapterBackendKind', 'must be mock-s3-compatible for execution-lease-boundary-ready payloads.'));
      }
      for (const key of [
        'tokenRequiredBeforeExecution',
        'tokenScopeBindingRequired',
        'tokenSingleUseRequired',
        'tokenExpiryRequired',
        'auditBindingRequired',
        'executionLeaseRequiredBeforeIssuance',
        'rollbackPlanRequiredBeforeIssuance'
      ]) {
        if (payload.sourceWriteTokenBoundary[key] !== true) {
          issues.push(error(`$.sourceWriteTokenBoundary.${key}`, 'must be true for execution-lease-boundary-ready payloads.'));
        }
      }
    }
  }

  if (!isRecord(payload.executionLeaseBoundary)) {
    issues.push(error('$.executionLeaseBoundary', 'Knowledge team upload execution lease boundary executionLeaseBoundary must be an object.'));
  } else {
    for (const key of [
      'dryRunOnly',
      'executionLeaseRequiredBeforeExecution',
      'leaseScopeBindingRequired',
      'leaseSingleUseRequired',
      'leaseExpiryRequired',
      'writeTokenRequiredBeforeLease',
      'auditBindingRequired',
      'rollbackPlanRequiredBeforeExecution'
    ]) {
      if (payload.executionLeaseBoundary[key] !== true) {
        issues.push(error(`$.executionLeaseBoundary.${key}`, 'must be true.'));
      }
    }
    for (const key of [
      'executionLeaseCreated',
      'leaseScopeBoundToArtifact',
      'singleUseLeaseCreated',
      'leaseExpirySet',
      'writeTokenIssued',
      'auditBindingCreated',
      'rollbackPlanCreated',
      'executable'
    ]) {
      if (payload.executionLeaseBoundary[key] !== false) {
        issues.push(error(`$.executionLeaseBoundary.${key}`, 'must be false.'));
      }
    }
  }

  if (!isRecord(payload.remainingExecutionBoundaries)) {
    issues.push(error('$.remainingExecutionBoundaries', 'Knowledge team upload execution lease boundary remainingExecutionBoundaries must be an object.'));
  } else {
    for (const key of [
      'artifactBytesRequired',
      'adapterInjectionRequired',
      'writeTokenRequired',
      'executionLeaseRequired',
      'rollbackPlanRequired',
      'auditRecordRequired'
    ]) {
      if (payload.remainingExecutionBoundaries[key] !== true) {
        issues.push(error(`$.remainingExecutionBoundaries.${key}`, 'must be true.'));
      }
    }
    for (const key of [
      'artifactBytesProvided',
      'adapterInjected',
      'writeTokenIssued',
      'executionLeaseCreated',
      'rollbackPlanCreated',
      'auditRecordCreated',
      'objectWriteAllowed',
      'metadataIndexWriteAllowed',
      'remoteMutationAllowed'
    ]) {
      if (payload.remainingExecutionBoundaries[key] !== false) {
        issues.push(error(`$.remainingExecutionBoundaries.${key}`, 'must be false.'));
      }
    }
  }

  if (!isRecord(payload.readiness)) {
    issues.push(error('$.readiness', 'Knowledge team upload execution lease boundary readiness must be an object.'));
  } else {
    validateBlockers({
      readiness: payload.readiness,
      supportedCodes: UPLOAD_EXECUTION_LEASE_BOUNDARY_BLOCKERS,
      supportedStatuses: UPLOAD_EXECUTION_LEASE_BOUNDARY_STATUSES,
      supportedNextActions: UPLOAD_EXECUTION_LEASE_BOUNDARY_NEXT_ACTIONS,
      path: '$.readiness',
      issues
    });
    if (payload.status !== payload.readiness.status) {
      issues.push(error('$.readiness.status', 'must match payload status.'));
    }
    if (payload.status === 'execution-lease-boundary-ready') {
      if (payload.readiness.nextAction !== 'design-rollback-plan-boundary') {
        issues.push(error('$.readiness.nextAction', 'must design the rollback plan boundary for execution-lease-boundary-ready payloads.'));
      }
      if (payload.readiness.blockerCount !== 0) {
        issues.push(error('$.readiness.blockerCount', 'must be 0 for execution-lease-boundary-ready payloads.'));
      }
    }
    if (payload.status === 'blocked' && payload.readiness.nextAction !== 'resolve-blockers') {
      issues.push(error('$.readiness.nextAction', 'must resolve blockers for blocked payloads.'));
    }
  }

  return createEmptyKnowledgeValidationReport({ inputPath, inputKind, issues });
}

export function validateKnowledgeTeamUploadRollbackPlanBoundaryPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  validateCommonDryRunBoundary(payload, issues, 'Knowledge team upload rollback plan boundary');
  validateNoUploadApprovalLeakage(payload, '$', issues);

  if (!isOneOf(payload.status, UPLOAD_ROLLBACK_PLAN_BOUNDARY_STATUSES)) {
    issues.push(error('$.status', 'Knowledge team upload rollback plan boundary status must be supported.'));
  }
  if (payload.boundaryKind !== 'rollback-plan-boundary-dry-run') {
    issues.push(error('$.boundaryKind', 'Knowledge team upload rollback plan boundary kind must be rollback-plan-boundary-dry-run.'));
  }
  if (payload.plannedOperation !== 'stage-knowledge-pack') {
    issues.push(error('$.plannedOperation', 'Knowledge team upload rollback plan boundary operation must be stage-knowledge-pack.'));
  }
  for (const key of [
    'uploadApproved',
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
  ]) {
    if (payload[key] !== false) {
      issues.push(error(`$.${key}`, 'Knowledge team upload rollback plan boundary must keep mutation and execution fields false.'));
    }
  }

  if (!isRecord(payload.target)) {
    issues.push(error('$.target', 'Knowledge team upload rollback plan boundary target must be an object.'));
  } else {
    for (const key of ['manifestId', 'artifactId']) {
      if (payload.target[key] !== null && (typeof payload.target[key] !== 'string' || !/^[a-f0-9]{24}$/.test(payload.target[key]))) {
        issues.push(error(`$.target.${key}`, 'must be null or a safe 24-character id.'));
      }
      if (payload.status === 'rollback-plan-boundary-ready' && payload.target[key] === null) {
        issues.push(error(`$.target.${key}`, 'must be set for rollback-plan-boundary-ready payloads.'));
      }
    }
    if (payload.target.objectSha256 !== null && (typeof payload.target.objectSha256 !== 'string' || !SAFE_SHA256_PATTERN.test(payload.target.objectSha256))) {
      issues.push(error('$.target.objectSha256', 'must be null or a SHA-256 hex string.'));
    }
    if (payload.status === 'rollback-plan-boundary-ready' && payload.target.objectSha256 === null) {
      issues.push(error('$.target.objectSha256', 'must be set for rollback-plan-boundary-ready payloads.'));
    }
    if (payload.target.objectKey !== null && (typeof payload.target.objectKey !== 'string' || !isSafeKnowledgeTeamArtifactObjectKey(payload.target.objectKey))) {
      issues.push(error('$.target.objectKey', 'must be null or a safe team artifact object key.'));
    }
    if (payload.status === 'rollback-plan-boundary-ready' && payload.target.objectKey === null) {
      issues.push(error('$.target.objectKey', 'must be set for rollback-plan-boundary-ready payloads.'));
    }
  }

  if (!isRecord(payload.sourceExecutionLeaseBoundary)) {
    issues.push(error('$.sourceExecutionLeaseBoundary', 'Knowledge team upload rollback plan boundary sourceExecutionLeaseBoundary must be an object.'));
  } else {
    if (payload.sourceExecutionLeaseBoundary.source !== 'upload-execution-lease-boundary') {
      issues.push(error('$.sourceExecutionLeaseBoundary.source', 'must be upload-execution-lease-boundary.'));
    }
    if (!isOneOf(payload.sourceExecutionLeaseBoundary.boundaryStatus, UPLOAD_ROLLBACK_PLAN_BOUNDARY_SOURCE_STATUSES)) {
      issues.push(error('$.sourceExecutionLeaseBoundary.boundaryStatus', 'must be a supported execution lease boundary status.'));
    }
    if (!isOneOf(payload.sourceExecutionLeaseBoundary.boundaryKind, UPLOAD_ROLLBACK_PLAN_BOUNDARY_SOURCE_KINDS)) {
      issues.push(error('$.sourceExecutionLeaseBoundary.boundaryKind', 'must be a supported execution lease boundary kind.'));
    }
    if (!isOneOf(payload.sourceExecutionLeaseBoundary.boundaryNextAction, UPLOAD_ROLLBACK_PLAN_BOUNDARY_SOURCE_NEXT_ACTIONS)) {
      issues.push(error('$.sourceExecutionLeaseBoundary.boundaryNextAction', 'must be a supported execution lease boundary next action.'));
    }
    if (!isOneOf(payload.sourceExecutionLeaseBoundary.reviewStatus, UPLOAD_ROLLBACK_PLAN_BOUNDARY_REVIEW_STATUSES)) {
      issues.push(error('$.sourceExecutionLeaseBoundary.reviewStatus', 'must be a supported review status.'));
    }
    if (!isOneOf(payload.sourceExecutionLeaseBoundary.reviewKind, UPLOAD_ROLLBACK_PLAN_BOUNDARY_REVIEW_KINDS)) {
      issues.push(error('$.sourceExecutionLeaseBoundary.reviewKind', 'must be a supported review kind.'));
    }
    if (!isOneOf(payload.sourceExecutionLeaseBoundary.adapterBackendKind, UPLOAD_ROLLBACK_PLAN_BOUNDARY_ADAPTER_BACKENDS)) {
      issues.push(error('$.sourceExecutionLeaseBoundary.adapterBackendKind', 'must be a supported adapter backend kind.'));
    }
    for (const key of [
      'scopeMatched',
      'humanReviewRecorded',
      'fingerprintVerified',
      'sourceFingerprintVerified',
      'tokenRequiredBeforeExecution',
      'tokenScopeBindingRequired',
      'tokenSingleUseRequired',
      'tokenExpiryRequired',
      'executionLeaseRequiredBeforeExecution',
      'leaseScopeBindingRequired',
      'leaseSingleUseRequired',
      'leaseExpiryRequired',
      'writeTokenRequiredBeforeLease',
      'auditBindingRequired',
      'rollbackPlanRequiredBeforeExecution'
    ]) {
      if (typeof payload.sourceExecutionLeaseBoundary[key] !== 'boolean') {
        issues.push(error(`$.sourceExecutionLeaseBoundary.${key}`, 'must be a boolean.'));
      }
    }
    if (payload.sourceExecutionLeaseBoundary.adapterName !== null) {
      if (typeof payload.sourceExecutionLeaseBoundary.adapterName !== 'string' || !isSafeKnowledgeTeamBackendAdapterName(payload.sourceExecutionLeaseBoundary.adapterName)) {
        issues.push(error('$.sourceExecutionLeaseBoundary.adapterName', 'must be null or a safe adapter name.'));
      }
    }
    if (payload.status === 'rollback-plan-boundary-ready') {
      if (payload.sourceExecutionLeaseBoundary.boundaryStatus !== 'execution-lease-boundary-ready') {
        issues.push(error('$.sourceExecutionLeaseBoundary.boundaryStatus', 'must be execution-lease-boundary-ready for rollback-plan-boundary-ready payloads.'));
      }
      if (payload.sourceExecutionLeaseBoundary.boundaryKind !== 'execution-lease-boundary-dry-run') {
        issues.push(error('$.sourceExecutionLeaseBoundary.boundaryKind', 'must be execution-lease-boundary-dry-run for rollback-plan-boundary-ready payloads.'));
      }
      if (payload.sourceExecutionLeaseBoundary.boundaryNextAction !== 'design-rollback-plan-boundary') {
        issues.push(error('$.sourceExecutionLeaseBoundary.boundaryNextAction', 'must design the rollback plan boundary for rollback-plan-boundary-ready payloads.'));
      }
      if (payload.sourceExecutionLeaseBoundary.reviewStatus !== 'review-ready') {
        issues.push(error('$.sourceExecutionLeaseBoundary.reviewStatus', 'must be review-ready for rollback-plan-boundary-ready payloads.'));
      }
      if (payload.sourceExecutionLeaseBoundary.reviewKind !== 'human-fingerprint-dry-run') {
        issues.push(error('$.sourceExecutionLeaseBoundary.reviewKind', 'must be human-fingerprint-dry-run for rollback-plan-boundary-ready payloads.'));
      }
      if (payload.sourceExecutionLeaseBoundary.scopeMatched !== true) {
        issues.push(error('$.sourceExecutionLeaseBoundary.scopeMatched', 'must be true for rollback-plan-boundary-ready payloads.'));
      }
      if (payload.sourceExecutionLeaseBoundary.humanReviewRecorded !== true) {
        issues.push(error('$.sourceExecutionLeaseBoundary.humanReviewRecorded', 'must be true for rollback-plan-boundary-ready payloads.'));
      }
      if (payload.sourceExecutionLeaseBoundary.fingerprintVerified !== true) {
        issues.push(error('$.sourceExecutionLeaseBoundary.fingerprintVerified', 'must be true for rollback-plan-boundary-ready payloads.'));
      }
      if (payload.sourceExecutionLeaseBoundary.sourceFingerprintVerified !== true) {
        issues.push(error('$.sourceExecutionLeaseBoundary.sourceFingerprintVerified', 'must be true for rollback-plan-boundary-ready payloads.'));
      }
      if (payload.sourceExecutionLeaseBoundary.adapterName === null) {
        issues.push(error('$.sourceExecutionLeaseBoundary.adapterName', 'must be set for rollback-plan-boundary-ready payloads.'));
      }
      if (payload.sourceExecutionLeaseBoundary.adapterBackendKind !== 'mock-s3-compatible') {
        issues.push(error('$.sourceExecutionLeaseBoundary.adapterBackendKind', 'must be mock-s3-compatible for rollback-plan-boundary-ready payloads.'));
      }
      for (const key of [
        'tokenRequiredBeforeExecution',
        'tokenScopeBindingRequired',
        'tokenSingleUseRequired',
        'tokenExpiryRequired',
        'executionLeaseRequiredBeforeExecution',
        'leaseScopeBindingRequired',
        'leaseSingleUseRequired',
        'leaseExpiryRequired',
        'writeTokenRequiredBeforeLease',
        'auditBindingRequired',
        'rollbackPlanRequiredBeforeExecution'
      ]) {
        if (payload.sourceExecutionLeaseBoundary[key] !== true) {
          issues.push(error(`$.sourceExecutionLeaseBoundary.${key}`, 'must be true for rollback-plan-boundary-ready payloads.'));
        }
      }
    }
  }

  if (!isRecord(payload.rollbackPlanBoundary)) {
    issues.push(error('$.rollbackPlanBoundary', 'Knowledge team upload rollback plan boundary rollbackPlanBoundary must be an object.'));
  } else {
    for (const key of [
      'dryRunOnly',
      'rollbackPlanRequiredBeforeExecution',
      'rollbackScopeBindingRequired',
      'rollbackReviewRequired',
      'writeTokenRequiredBeforeRollback',
      'executionLeaseRequiredBeforeRollback',
      'artifactBytesRequiredBeforeRollback',
      'auditBindingRequired',
      'auditRecordRequiredBeforeExecution'
    ]) {
      if (payload.rollbackPlanBoundary[key] !== true) {
        issues.push(error(`$.rollbackPlanBoundary.${key}`, 'must be true.'));
      }
    }
    for (const key of [
      'rollbackPlanCreated',
      'rollbackScopeBoundToArtifact',
      'rollbackReviewed',
      'writeTokenIssued',
      'executionLeaseCreated',
      'artifactBytesProvided',
      'auditBindingCreated',
      'auditRecordCreated',
      'executable'
    ]) {
      if (payload.rollbackPlanBoundary[key] !== false) {
        issues.push(error(`$.rollbackPlanBoundary.${key}`, 'must be false.'));
      }
    }
  }

  if (!isRecord(payload.remainingExecutionBoundaries)) {
    issues.push(error('$.remainingExecutionBoundaries', 'Knowledge team upload rollback plan boundary remainingExecutionBoundaries must be an object.'));
  } else {
    for (const key of [
      'artifactBytesRequired',
      'adapterInjectionRequired',
      'writeTokenRequired',
      'executionLeaseRequired',
      'rollbackPlanRequired',
      'auditRecordRequired'
    ]) {
      if (payload.remainingExecutionBoundaries[key] !== true) {
        issues.push(error(`$.remainingExecutionBoundaries.${key}`, 'must be true.'));
      }
    }
    for (const key of [
      'artifactBytesProvided',
      'adapterInjected',
      'writeTokenIssued',
      'executionLeaseCreated',
      'rollbackPlanCreated',
      'auditRecordCreated',
      'objectWriteAllowed',
      'metadataIndexWriteAllowed',
      'remoteMutationAllowed'
    ]) {
      if (payload.remainingExecutionBoundaries[key] !== false) {
        issues.push(error(`$.remainingExecutionBoundaries.${key}`, 'must be false.'));
      }
    }
  }

  if (!isRecord(payload.readiness)) {
    issues.push(error('$.readiness', 'Knowledge team upload rollback plan boundary readiness must be an object.'));
  } else {
    validateBlockers({
      readiness: payload.readiness,
      supportedCodes: UPLOAD_ROLLBACK_PLAN_BOUNDARY_BLOCKERS,
      supportedStatuses: UPLOAD_ROLLBACK_PLAN_BOUNDARY_STATUSES,
      supportedNextActions: UPLOAD_ROLLBACK_PLAN_BOUNDARY_NEXT_ACTIONS,
      path: '$.readiness',
      issues
    });
    if (payload.status !== payload.readiness.status) {
      issues.push(error('$.readiness.status', 'must match payload status.'));
    }
    if (payload.status === 'rollback-plan-boundary-ready') {
      if (payload.readiness.nextAction !== 'design-audit-record-boundary') {
        issues.push(error('$.readiness.nextAction', 'must design the audit record boundary for rollback-plan-boundary-ready payloads.'));
      }
      if (payload.readiness.blockerCount !== 0) {
        issues.push(error('$.readiness.blockerCount', 'must be 0 for rollback-plan-boundary-ready payloads.'));
      }
    }
    if (payload.status === 'blocked' && payload.readiness.nextAction !== 'resolve-blockers') {
      issues.push(error('$.readiness.nextAction', 'must resolve blockers for blocked payloads.'));
    }
  }

  return createEmptyKnowledgeValidationReport({ inputPath, inputKind, issues });
}

export function validateKnowledgeTeamUploadAuditRecordBoundaryPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  validateCommonDryRunBoundary(payload, issues, 'Knowledge team upload audit record boundary');
  validateNoUploadApprovalLeakage(payload, '$', issues);

  if (!isOneOf(payload.status, UPLOAD_AUDIT_RECORD_BOUNDARY_STATUSES)) {
    issues.push(error('$.status', 'Knowledge team upload audit record boundary status must be supported.'));
  }
  if (payload.boundaryKind !== 'audit-record-boundary-dry-run') {
    issues.push(error('$.boundaryKind', 'Knowledge team upload audit record boundary kind must be audit-record-boundary-dry-run.'));
  }
  if (payload.plannedOperation !== 'stage-knowledge-pack') {
    issues.push(error('$.plannedOperation', 'Knowledge team upload audit record boundary operation must be stage-knowledge-pack.'));
  }
  for (const key of [
    'uploadApproved',
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
  ]) {
    if (payload[key] !== false) {
      issues.push(error(`$.${key}`, 'Knowledge team upload audit record boundary must keep mutation and execution fields false.'));
    }
  }

  if (!isRecord(payload.target)) {
    issues.push(error('$.target', 'Knowledge team upload audit record boundary target must be an object.'));
  } else {
    for (const key of ['manifestId', 'artifactId']) {
      if (payload.target[key] !== null && (typeof payload.target[key] !== 'string' || !/^[a-f0-9]{24}$/.test(payload.target[key]))) {
        issues.push(error(`$.target.${key}`, 'must be null or a safe 24-character id.'));
      }
      if (payload.status === 'audit-record-boundary-ready' && payload.target[key] === null) {
        issues.push(error(`$.target.${key}`, 'must be set for audit-record-boundary-ready payloads.'));
      }
    }
    if (payload.target.objectSha256 !== null && (typeof payload.target.objectSha256 !== 'string' || !SAFE_SHA256_PATTERN.test(payload.target.objectSha256))) {
      issues.push(error('$.target.objectSha256', 'must be null or a SHA-256 hex string.'));
    }
    if (payload.status === 'audit-record-boundary-ready' && payload.target.objectSha256 === null) {
      issues.push(error('$.target.objectSha256', 'must be set for audit-record-boundary-ready payloads.'));
    }
    if (payload.target.objectKey !== null && (typeof payload.target.objectKey !== 'string' || !isSafeKnowledgeTeamArtifactObjectKey(payload.target.objectKey))) {
      issues.push(error('$.target.objectKey', 'must be null or a safe team artifact object key.'));
    }
    if (payload.status === 'audit-record-boundary-ready' && payload.target.objectKey === null) {
      issues.push(error('$.target.objectKey', 'must be set for audit-record-boundary-ready payloads.'));
    }
  }

  if (!isRecord(payload.sourceRollbackPlanBoundary)) {
    issues.push(error('$.sourceRollbackPlanBoundary', 'Knowledge team upload audit record boundary sourceRollbackPlanBoundary must be an object.'));
  } else {
    if (payload.sourceRollbackPlanBoundary.source !== 'upload-rollback-plan-boundary') {
      issues.push(error('$.sourceRollbackPlanBoundary.source', 'must be upload-rollback-plan-boundary.'));
    }
    if (!isOneOf(payload.sourceRollbackPlanBoundary.boundaryStatus, UPLOAD_AUDIT_RECORD_BOUNDARY_SOURCE_STATUSES)) {
      issues.push(error('$.sourceRollbackPlanBoundary.boundaryStatus', 'must be a supported rollback plan boundary status.'));
    }
    if (!isOneOf(payload.sourceRollbackPlanBoundary.boundaryKind, UPLOAD_AUDIT_RECORD_BOUNDARY_SOURCE_KINDS)) {
      issues.push(error('$.sourceRollbackPlanBoundary.boundaryKind', 'must be a supported rollback plan boundary kind.'));
    }
    if (!isOneOf(payload.sourceRollbackPlanBoundary.boundaryNextAction, UPLOAD_AUDIT_RECORD_BOUNDARY_SOURCE_NEXT_ACTIONS)) {
      issues.push(error('$.sourceRollbackPlanBoundary.boundaryNextAction', 'must be a supported rollback plan boundary next action.'));
    }
    if (!isOneOf(payload.sourceRollbackPlanBoundary.reviewStatus, UPLOAD_AUDIT_RECORD_BOUNDARY_REVIEW_STATUSES)) {
      issues.push(error('$.sourceRollbackPlanBoundary.reviewStatus', 'must be a supported review status.'));
    }
    if (!isOneOf(payload.sourceRollbackPlanBoundary.reviewKind, UPLOAD_AUDIT_RECORD_BOUNDARY_REVIEW_KINDS)) {
      issues.push(error('$.sourceRollbackPlanBoundary.reviewKind', 'must be a supported review kind.'));
    }
    if (!isOneOf(payload.sourceRollbackPlanBoundary.adapterBackendKind, UPLOAD_AUDIT_RECORD_BOUNDARY_ADAPTER_BACKENDS)) {
      issues.push(error('$.sourceRollbackPlanBoundary.adapterBackendKind', 'must be a supported adapter backend kind.'));
    }
    for (const key of [
      'scopeMatched',
      'humanReviewRecorded',
      'fingerprintVerified',
      'sourceFingerprintVerified',
      'tokenRequiredBeforeExecution',
      'tokenScopeBindingRequired',
      'tokenSingleUseRequired',
      'tokenExpiryRequired',
      'executionLeaseRequiredBeforeExecution',
      'leaseScopeBindingRequired',
      'leaseSingleUseRequired',
      'leaseExpiryRequired',
      'writeTokenRequiredBeforeLease',
      'auditBindingRequired',
      'rollbackPlanRequiredBeforeExecution',
      'rollbackScopeBindingRequired',
      'rollbackReviewRequired',
      'auditRecordRequiredBeforeExecution'
    ]) {
      if (typeof payload.sourceRollbackPlanBoundary[key] !== 'boolean') {
        issues.push(error(`$.sourceRollbackPlanBoundary.${key}`, 'must be a boolean.'));
      }
    }
    if (payload.sourceRollbackPlanBoundary.adapterName !== null) {
      if (typeof payload.sourceRollbackPlanBoundary.adapterName !== 'string' || !isSafeKnowledgeTeamBackendAdapterName(payload.sourceRollbackPlanBoundary.adapterName)) {
        issues.push(error('$.sourceRollbackPlanBoundary.adapterName', 'must be null or a safe adapter name.'));
      }
    }
    if (payload.status === 'audit-record-boundary-ready') {
      if (payload.sourceRollbackPlanBoundary.boundaryStatus !== 'rollback-plan-boundary-ready') {
        issues.push(error('$.sourceRollbackPlanBoundary.boundaryStatus', 'must be rollback-plan-boundary-ready for audit-record-boundary-ready payloads.'));
      }
      if (payload.sourceRollbackPlanBoundary.boundaryKind !== 'rollback-plan-boundary-dry-run') {
        issues.push(error('$.sourceRollbackPlanBoundary.boundaryKind', 'must be rollback-plan-boundary-dry-run for audit-record-boundary-ready payloads.'));
      }
      if (payload.sourceRollbackPlanBoundary.boundaryNextAction !== 'design-audit-record-boundary') {
        issues.push(error('$.sourceRollbackPlanBoundary.boundaryNextAction', 'must design the audit record boundary for audit-record-boundary-ready payloads.'));
      }
      if (payload.sourceRollbackPlanBoundary.reviewStatus !== 'review-ready') {
        issues.push(error('$.sourceRollbackPlanBoundary.reviewStatus', 'must be review-ready for audit-record-boundary-ready payloads.'));
      }
      if (payload.sourceRollbackPlanBoundary.reviewKind !== 'human-fingerprint-dry-run') {
        issues.push(error('$.sourceRollbackPlanBoundary.reviewKind', 'must be human-fingerprint-dry-run for audit-record-boundary-ready payloads.'));
      }
      if (payload.sourceRollbackPlanBoundary.scopeMatched !== true) {
        issues.push(error('$.sourceRollbackPlanBoundary.scopeMatched', 'must be true for audit-record-boundary-ready payloads.'));
      }
      if (payload.sourceRollbackPlanBoundary.humanReviewRecorded !== true) {
        issues.push(error('$.sourceRollbackPlanBoundary.humanReviewRecorded', 'must be true for audit-record-boundary-ready payloads.'));
      }
      if (payload.sourceRollbackPlanBoundary.fingerprintVerified !== true) {
        issues.push(error('$.sourceRollbackPlanBoundary.fingerprintVerified', 'must be true for audit-record-boundary-ready payloads.'));
      }
      if (payload.sourceRollbackPlanBoundary.sourceFingerprintVerified !== true) {
        issues.push(error('$.sourceRollbackPlanBoundary.sourceFingerprintVerified', 'must be true for audit-record-boundary-ready payloads.'));
      }
      if (payload.sourceRollbackPlanBoundary.adapterName === null) {
        issues.push(error('$.sourceRollbackPlanBoundary.adapterName', 'must be set for audit-record-boundary-ready payloads.'));
      }
      if (payload.sourceRollbackPlanBoundary.adapterBackendKind !== 'mock-s3-compatible') {
        issues.push(error('$.sourceRollbackPlanBoundary.adapterBackendKind', 'must be mock-s3-compatible for audit-record-boundary-ready payloads.'));
      }
      for (const key of [
        'tokenRequiredBeforeExecution',
        'tokenScopeBindingRequired',
        'tokenSingleUseRequired',
        'tokenExpiryRequired',
        'executionLeaseRequiredBeforeExecution',
        'leaseScopeBindingRequired',
        'leaseSingleUseRequired',
        'leaseExpiryRequired',
        'writeTokenRequiredBeforeLease',
        'auditBindingRequired',
        'rollbackPlanRequiredBeforeExecution',
        'rollbackScopeBindingRequired',
        'rollbackReviewRequired',
        'auditRecordRequiredBeforeExecution'
      ]) {
        if (payload.sourceRollbackPlanBoundary[key] !== true) {
          issues.push(error(`$.sourceRollbackPlanBoundary.${key}`, 'must be true for audit-record-boundary-ready payloads.'));
        }
      }
    }
  }

  if (!isRecord(payload.auditRecordBoundary)) {
    issues.push(error('$.auditRecordBoundary', 'Knowledge team upload audit record boundary auditRecordBoundary must be an object.'));
  } else {
    for (const key of [
      'dryRunOnly',
      'auditRecordRequiredBeforeExecution',
      'auditScopeBindingRequired',
      'auditReviewRequired',
      'writeTokenRequiredBeforeAudit',
      'executionLeaseRequiredBeforeAudit',
      'rollbackPlanRequiredBeforeAudit',
      'artifactBytesRequiredBeforeAudit',
      'auditBindingRequired'
    ]) {
      if (payload.auditRecordBoundary[key] !== true) {
        issues.push(error(`$.auditRecordBoundary.${key}`, 'must be true.'));
      }
    }
    for (const key of [
      'auditRecordCreated',
      'auditScopeBoundToArtifact',
      'auditReviewed',
      'writeTokenIssued',
      'executionLeaseCreated',
      'rollbackPlanCreated',
      'artifactBytesProvided',
      'auditBindingCreated',
      'executable'
    ]) {
      if (payload.auditRecordBoundary[key] !== false) {
        issues.push(error(`$.auditRecordBoundary.${key}`, 'must be false.'));
      }
    }
  }

  if (!isRecord(payload.remainingExecutionBoundaries)) {
    issues.push(error('$.remainingExecutionBoundaries', 'Knowledge team upload audit record boundary remainingExecutionBoundaries must be an object.'));
  } else {
    for (const key of [
      'artifactBytesRequired',
      'adapterInjectionRequired',
      'writeTokenRequired',
      'executionLeaseRequired',
      'rollbackPlanRequired',
      'auditRecordRequired'
    ]) {
      if (payload.remainingExecutionBoundaries[key] !== true) {
        issues.push(error(`$.remainingExecutionBoundaries.${key}`, 'must be true.'));
      }
    }
    for (const key of [
      'artifactBytesProvided',
      'adapterInjected',
      'writeTokenIssued',
      'executionLeaseCreated',
      'rollbackPlanCreated',
      'auditRecordCreated',
      'objectWriteAllowed',
      'metadataIndexWriteAllowed',
      'remoteMutationAllowed'
    ]) {
      if (payload.remainingExecutionBoundaries[key] !== false) {
        issues.push(error(`$.remainingExecutionBoundaries.${key}`, 'must be false.'));
      }
    }
  }

  if (!isRecord(payload.readiness)) {
    issues.push(error('$.readiness', 'Knowledge team upload audit record boundary readiness must be an object.'));
  } else {
    validateBlockers({
      readiness: payload.readiness,
      supportedCodes: UPLOAD_AUDIT_RECORD_BOUNDARY_BLOCKERS,
      supportedStatuses: UPLOAD_AUDIT_RECORD_BOUNDARY_STATUSES,
      supportedNextActions: UPLOAD_AUDIT_RECORD_BOUNDARY_NEXT_ACTIONS,
      path: '$.readiness',
      issues
    });
    if (payload.status !== payload.readiness.status) {
      issues.push(error('$.readiness.status', 'must match payload status.'));
    }
    if (payload.status === 'audit-record-boundary-ready') {
      if (payload.readiness.nextAction !== 'design-artifact-bytes-boundary') {
        issues.push(error('$.readiness.nextAction', 'must design the artifact bytes boundary for audit-record-boundary-ready payloads.'));
      }
      if (payload.readiness.blockerCount !== 0) {
        issues.push(error('$.readiness.blockerCount', 'must be 0 for audit-record-boundary-ready payloads.'));
      }
    }
    if (payload.status === 'blocked' && payload.readiness.nextAction !== 'resolve-blockers') {
      issues.push(error('$.readiness.nextAction', 'must resolve blockers for blocked payloads.'));
    }
  }

  return createEmptyKnowledgeValidationReport({ inputPath, inputKind, issues });
}

export function validateKnowledgeTeamUploadArtifactBytesBoundaryPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  validateCommonDryRunBoundary(payload, issues, 'Knowledge team upload artifact bytes boundary');
  validateNoUploadApprovalLeakage(payload, '$', issues);

  if (!isOneOf(payload.status, UPLOAD_ARTIFACT_BYTES_BOUNDARY_STATUSES)) {
    issues.push(error('$.status', 'Knowledge team upload artifact bytes boundary status must be supported.'));
  }
  if (payload.boundaryKind !== 'artifact-bytes-boundary-dry-run') {
    issues.push(error('$.boundaryKind', 'Knowledge team upload artifact bytes boundary kind must be artifact-bytes-boundary-dry-run.'));
  }
  if (payload.plannedOperation !== 'stage-knowledge-pack') {
    issues.push(error('$.plannedOperation', 'Knowledge team upload artifact bytes boundary operation must be stage-knowledge-pack.'));
  }
  for (const key of [
    'uploadApproved',
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
  ]) {
    if (payload[key] !== false) {
      issues.push(error(`$.${key}`, 'Knowledge team upload artifact bytes boundary must keep mutation and execution fields false.'));
    }
  }

  if (!isRecord(payload.target)) {
    issues.push(error('$.target', 'Knowledge team upload artifact bytes boundary target must be an object.'));
  } else {
    for (const key of ['manifestId', 'artifactId']) {
      if (payload.target[key] !== null && (typeof payload.target[key] !== 'string' || !/^[a-f0-9]{24}$/.test(payload.target[key]))) {
        issues.push(error(`$.target.${key}`, 'must be null or a safe 24-character id.'));
      }
      if (payload.status === 'artifact-bytes-boundary-ready' && payload.target[key] === null) {
        issues.push(error(`$.target.${key}`, 'must be set for artifact-bytes-boundary-ready payloads.'));
      }
    }
    if (payload.target.objectSha256 !== null && (typeof payload.target.objectSha256 !== 'string' || !SAFE_SHA256_PATTERN.test(payload.target.objectSha256))) {
      issues.push(error('$.target.objectSha256', 'must be null or a SHA-256 hex string.'));
    }
    if (payload.status === 'artifact-bytes-boundary-ready' && payload.target.objectSha256 === null) {
      issues.push(error('$.target.objectSha256', 'must be set for artifact-bytes-boundary-ready payloads.'));
    }
    if (payload.target.objectKey !== null && (typeof payload.target.objectKey !== 'string' || !isSafeKnowledgeTeamArtifactObjectKey(payload.target.objectKey))) {
      issues.push(error('$.target.objectKey', 'must be null or a safe team artifact object key.'));
    }
    if (payload.status === 'artifact-bytes-boundary-ready' && payload.target.objectKey === null) {
      issues.push(error('$.target.objectKey', 'must be set for artifact-bytes-boundary-ready payloads.'));
    }
  }

  if (!isRecord(payload.sourceAuditRecordBoundary)) {
    issues.push(error('$.sourceAuditRecordBoundary', 'Knowledge team upload artifact bytes boundary sourceAuditRecordBoundary must be an object.'));
  } else {
    if (payload.sourceAuditRecordBoundary.source !== 'upload-audit-record-boundary') {
      issues.push(error('$.sourceAuditRecordBoundary.source', 'must be upload-audit-record-boundary.'));
    }
    if (!isOneOf(payload.sourceAuditRecordBoundary.boundaryStatus, UPLOAD_ARTIFACT_BYTES_BOUNDARY_SOURCE_STATUSES)) {
      issues.push(error('$.sourceAuditRecordBoundary.boundaryStatus', 'must be a supported audit record boundary status.'));
    }
    if (!isOneOf(payload.sourceAuditRecordBoundary.boundaryKind, UPLOAD_ARTIFACT_BYTES_BOUNDARY_SOURCE_KINDS)) {
      issues.push(error('$.sourceAuditRecordBoundary.boundaryKind', 'must be a supported audit record boundary kind.'));
    }
    if (!isOneOf(payload.sourceAuditRecordBoundary.boundaryNextAction, UPLOAD_ARTIFACT_BYTES_BOUNDARY_SOURCE_NEXT_ACTIONS)) {
      issues.push(error('$.sourceAuditRecordBoundary.boundaryNextAction', 'must be a supported audit record boundary next action.'));
    }
    if (!isOneOf(payload.sourceAuditRecordBoundary.reviewStatus, UPLOAD_ARTIFACT_BYTES_BOUNDARY_REVIEW_STATUSES)) {
      issues.push(error('$.sourceAuditRecordBoundary.reviewStatus', 'must be a supported review status.'));
    }
    if (!isOneOf(payload.sourceAuditRecordBoundary.reviewKind, UPLOAD_ARTIFACT_BYTES_BOUNDARY_REVIEW_KINDS)) {
      issues.push(error('$.sourceAuditRecordBoundary.reviewKind', 'must be a supported review kind.'));
    }
    if (!isOneOf(payload.sourceAuditRecordBoundary.adapterBackendKind, UPLOAD_ARTIFACT_BYTES_BOUNDARY_ADAPTER_BACKENDS)) {
      issues.push(error('$.sourceAuditRecordBoundary.adapterBackendKind', 'must be a supported adapter backend kind.'));
    }
    for (const key of [
      'scopeMatched',
      'humanReviewRecorded',
      'fingerprintVerified',
      'sourceFingerprintVerified',
      'tokenRequiredBeforeExecution',
      'tokenScopeBindingRequired',
      'tokenSingleUseRequired',
      'tokenExpiryRequired',
      'executionLeaseRequiredBeforeExecution',
      'leaseScopeBindingRequired',
      'leaseSingleUseRequired',
      'leaseExpiryRequired',
      'writeTokenRequiredBeforeLease',
      'auditBindingRequired',
      'rollbackPlanRequiredBeforeExecution',
      'rollbackScopeBindingRequired',
      'rollbackReviewRequired',
      'auditRecordRequiredBeforeExecution',
      'auditScopeBindingRequired',
      'auditReviewRequired',
      'artifactBytesRequiredBeforeAudit'
    ]) {
      if (typeof payload.sourceAuditRecordBoundary[key] !== 'boolean') {
        issues.push(error(`$.sourceAuditRecordBoundary.${key}`, 'must be a boolean.'));
      }
    }
    if (payload.sourceAuditRecordBoundary.adapterName !== null) {
      if (typeof payload.sourceAuditRecordBoundary.adapterName !== 'string' || !isSafeKnowledgeTeamBackendAdapterName(payload.sourceAuditRecordBoundary.adapterName)) {
        issues.push(error('$.sourceAuditRecordBoundary.adapterName', 'must be null or a safe adapter name.'));
      }
    }
    if (payload.status === 'artifact-bytes-boundary-ready') {
      if (payload.sourceAuditRecordBoundary.boundaryStatus !== 'audit-record-boundary-ready') {
        issues.push(error('$.sourceAuditRecordBoundary.boundaryStatus', 'must be audit-record-boundary-ready for artifact-bytes-boundary-ready payloads.'));
      }
      if (payload.sourceAuditRecordBoundary.boundaryKind !== 'audit-record-boundary-dry-run') {
        issues.push(error('$.sourceAuditRecordBoundary.boundaryKind', 'must be audit-record-boundary-dry-run for artifact-bytes-boundary-ready payloads.'));
      }
      if (payload.sourceAuditRecordBoundary.boundaryNextAction !== 'design-artifact-bytes-boundary') {
        issues.push(error('$.sourceAuditRecordBoundary.boundaryNextAction', 'must design the artifact bytes boundary for artifact-bytes-boundary-ready payloads.'));
      }
      if (payload.sourceAuditRecordBoundary.reviewStatus !== 'review-ready') {
        issues.push(error('$.sourceAuditRecordBoundary.reviewStatus', 'must be review-ready for artifact-bytes-boundary-ready payloads.'));
      }
      if (payload.sourceAuditRecordBoundary.reviewKind !== 'human-fingerprint-dry-run') {
        issues.push(error('$.sourceAuditRecordBoundary.reviewKind', 'must be human-fingerprint-dry-run for artifact-bytes-boundary-ready payloads.'));
      }
      if (payload.sourceAuditRecordBoundary.scopeMatched !== true) {
        issues.push(error('$.sourceAuditRecordBoundary.scopeMatched', 'must be true for artifact-bytes-boundary-ready payloads.'));
      }
      if (payload.sourceAuditRecordBoundary.humanReviewRecorded !== true) {
        issues.push(error('$.sourceAuditRecordBoundary.humanReviewRecorded', 'must be true for artifact-bytes-boundary-ready payloads.'));
      }
      if (payload.sourceAuditRecordBoundary.fingerprintVerified !== true) {
        issues.push(error('$.sourceAuditRecordBoundary.fingerprintVerified', 'must be true for artifact-bytes-boundary-ready payloads.'));
      }
      if (payload.sourceAuditRecordBoundary.sourceFingerprintVerified !== true) {
        issues.push(error('$.sourceAuditRecordBoundary.sourceFingerprintVerified', 'must be true for artifact-bytes-boundary-ready payloads.'));
      }
      if (payload.sourceAuditRecordBoundary.adapterName === null) {
        issues.push(error('$.sourceAuditRecordBoundary.adapterName', 'must be set for artifact-bytes-boundary-ready payloads.'));
      }
      if (payload.sourceAuditRecordBoundary.adapterBackendKind !== 'mock-s3-compatible') {
        issues.push(error('$.sourceAuditRecordBoundary.adapterBackendKind', 'must be mock-s3-compatible for artifact-bytes-boundary-ready payloads.'));
      }
      for (const key of [
        'tokenRequiredBeforeExecution',
        'tokenScopeBindingRequired',
        'tokenSingleUseRequired',
        'tokenExpiryRequired',
        'executionLeaseRequiredBeforeExecution',
        'leaseScopeBindingRequired',
        'leaseSingleUseRequired',
        'leaseExpiryRequired',
        'writeTokenRequiredBeforeLease',
        'auditBindingRequired',
        'rollbackPlanRequiredBeforeExecution',
        'rollbackScopeBindingRequired',
        'rollbackReviewRequired',
        'auditRecordRequiredBeforeExecution',
        'auditScopeBindingRequired',
        'auditReviewRequired',
        'artifactBytesRequiredBeforeAudit'
      ]) {
        if (payload.sourceAuditRecordBoundary[key] !== true) {
          issues.push(error(`$.sourceAuditRecordBoundary.${key}`, 'must be true for artifact-bytes-boundary-ready payloads.'));
        }
      }
    }
  }

  if (!isRecord(payload.artifactBytesBoundary)) {
    issues.push(error('$.artifactBytesBoundary', 'Knowledge team upload artifact bytes boundary artifactBytesBoundary must be an object.'));
  } else {
    for (const key of [
      'dryRunOnly',
      'artifactBytesRequiredBeforeAdapter',
      'artifactBytesRequiredBeforeExecution',
      'artifactDigestRequired',
      'artifactScopeBindingRequired',
      'auditRecordRequiredBeforeBytes',
      'auditScopeBindingRequired',
      'writeTokenRequiredBeforeBytes',
      'executionLeaseRequiredBeforeBytes',
      'rollbackPlanRequiredBeforeBytes',
      'adapterInjectionRequiredAfterBytes'
    ]) {
      if (payload.artifactBytesBoundary[key] !== true) {
        issues.push(error(`$.artifactBytesBoundary.${key}`, 'must be true.'));
      }
    }
    for (const key of [
      'artifactBytesProvided',
      'artifactDigestVerified',
      'artifactScopeBoundToArtifact',
      'auditRecordCreated',
      'auditScopeBoundToArtifact',
      'writeTokenIssued',
      'executionLeaseCreated',
      'rollbackPlanCreated',
      'adapterInjected',
      'executable'
    ]) {
      if (payload.artifactBytesBoundary[key] !== false) {
        issues.push(error(`$.artifactBytesBoundary.${key}`, 'must be false.'));
      }
    }
  }

  if (!isRecord(payload.remainingExecutionBoundaries)) {
    issues.push(error('$.remainingExecutionBoundaries', 'Knowledge team upload artifact bytes boundary remainingExecutionBoundaries must be an object.'));
  } else {
    for (const key of [
      'artifactBytesRequired',
      'adapterInjectionRequired',
      'writeTokenRequired',
      'executionLeaseRequired',
      'rollbackPlanRequired',
      'auditRecordRequired'
    ]) {
      if (payload.remainingExecutionBoundaries[key] !== true) {
        issues.push(error(`$.remainingExecutionBoundaries.${key}`, 'must be true.'));
      }
    }
    for (const key of [
      'artifactBytesProvided',
      'adapterInjected',
      'writeTokenIssued',
      'executionLeaseCreated',
      'rollbackPlanCreated',
      'auditRecordCreated',
      'objectWriteAllowed',
      'metadataIndexWriteAllowed',
      'remoteMutationAllowed'
    ]) {
      if (payload.remainingExecutionBoundaries[key] !== false) {
        issues.push(error(`$.remainingExecutionBoundaries.${key}`, 'must be false.'));
      }
    }
  }

  if (!isRecord(payload.readiness)) {
    issues.push(error('$.readiness', 'Knowledge team upload artifact bytes boundary readiness must be an object.'));
  } else {
    validateBlockers({
      readiness: payload.readiness,
      supportedCodes: UPLOAD_ARTIFACT_BYTES_BOUNDARY_BLOCKERS,
      supportedStatuses: UPLOAD_ARTIFACT_BYTES_BOUNDARY_STATUSES,
      supportedNextActions: UPLOAD_ARTIFACT_BYTES_BOUNDARY_NEXT_ACTIONS,
      path: '$.readiness',
      issues
    });
    if (payload.status !== payload.readiness.status) {
      issues.push(error('$.readiness.status', 'must match payload status.'));
    }
    if (payload.status === 'artifact-bytes-boundary-ready') {
      if (payload.readiness.nextAction !== 'design-adapter-injection-boundary') {
        issues.push(error('$.readiness.nextAction', 'must design the adapter injection boundary for artifact-bytes-boundary-ready payloads.'));
      }
      if (payload.readiness.blockerCount !== 0) {
        issues.push(error('$.readiness.blockerCount', 'must be 0 for artifact-bytes-boundary-ready payloads.'));
      }
    }
    if (payload.status === 'blocked' && payload.readiness.nextAction !== 'resolve-blockers') {
      issues.push(error('$.readiness.nextAction', 'must resolve blockers for blocked payloads.'));
    }
  }

  return createEmptyKnowledgeValidationReport({ inputPath, inputKind, issues });
}

export function validateKnowledgeTeamUploadAdapterInjectionBoundaryPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  validateCommonDryRunBoundary(payload, issues, 'Knowledge team upload adapter injection boundary');
  validateNoUploadApprovalLeakage(payload, '$', issues);

  if (!isOneOf(payload.status, UPLOAD_ADAPTER_INJECTION_BOUNDARY_STATUSES)) {
    issues.push(error('$.status', 'Knowledge team upload adapter injection boundary status must be supported.'));
  }
  if (payload.boundaryKind !== 'adapter-injection-boundary-dry-run') {
    issues.push(error('$.boundaryKind', 'Knowledge team upload adapter injection boundary kind must be adapter-injection-boundary-dry-run.'));
  }
  if (payload.plannedOperation !== 'stage-knowledge-pack') {
    issues.push(error('$.plannedOperation', 'Knowledge team upload adapter injection boundary operation must be stage-knowledge-pack.'));
  }
  for (const key of [
    'uploadApproved',
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
  ]) {
    if (payload[key] !== false) {
      issues.push(error(`$.${key}`, 'Knowledge team upload adapter injection boundary must keep mutation and execution fields false.'));
    }
  }

  if (!isRecord(payload.target)) {
    issues.push(error('$.target', 'Knowledge team upload adapter injection boundary target must be an object.'));
  } else {
    for (const key of ['manifestId', 'artifactId']) {
      if (payload.target[key] !== null && (typeof payload.target[key] !== 'string' || !/^[a-f0-9]{24}$/.test(payload.target[key]))) {
        issues.push(error(`$.target.${key}`, 'must be null or a safe 24-character id.'));
      }
      if (payload.status === 'adapter-injection-boundary-ready' && payload.target[key] === null) {
        issues.push(error(`$.target.${key}`, 'must be set for adapter-injection-boundary-ready payloads.'));
      }
    }
    if (payload.target.objectSha256 !== null && (typeof payload.target.objectSha256 !== 'string' || !SAFE_SHA256_PATTERN.test(payload.target.objectSha256))) {
      issues.push(error('$.target.objectSha256', 'must be null or a SHA-256 hex string.'));
    }
    if (payload.status === 'adapter-injection-boundary-ready' && payload.target.objectSha256 === null) {
      issues.push(error('$.target.objectSha256', 'must be set for adapter-injection-boundary-ready payloads.'));
    }
    if (payload.target.objectKey !== null && (typeof payload.target.objectKey !== 'string' || !isSafeKnowledgeTeamArtifactObjectKey(payload.target.objectKey))) {
      issues.push(error('$.target.objectKey', 'must be null or a safe team artifact object key.'));
    }
    if (payload.status === 'adapter-injection-boundary-ready' && payload.target.objectKey === null) {
      issues.push(error('$.target.objectKey', 'must be set for adapter-injection-boundary-ready payloads.'));
    }
  }

  if (!isRecord(payload.sourceArtifactBytesBoundary)) {
    issues.push(error('$.sourceArtifactBytesBoundary', 'Knowledge team upload adapter injection boundary sourceArtifactBytesBoundary must be an object.'));
  } else {
    if (payload.sourceArtifactBytesBoundary.source !== 'upload-artifact-bytes-boundary') {
      issues.push(error('$.sourceArtifactBytesBoundary.source', 'must be upload-artifact-bytes-boundary.'));
    }
    if (!isOneOf(payload.sourceArtifactBytesBoundary.boundaryStatus, UPLOAD_ADAPTER_INJECTION_BOUNDARY_SOURCE_STATUSES)) {
      issues.push(error('$.sourceArtifactBytesBoundary.boundaryStatus', 'must be a supported artifact bytes boundary status.'));
    }
    if (!isOneOf(payload.sourceArtifactBytesBoundary.boundaryKind, UPLOAD_ADAPTER_INJECTION_BOUNDARY_SOURCE_KINDS)) {
      issues.push(error('$.sourceArtifactBytesBoundary.boundaryKind', 'must be a supported artifact bytes boundary kind.'));
    }
    if (!isOneOf(payload.sourceArtifactBytesBoundary.boundaryNextAction, UPLOAD_ADAPTER_INJECTION_BOUNDARY_SOURCE_NEXT_ACTIONS)) {
      issues.push(error('$.sourceArtifactBytesBoundary.boundaryNextAction', 'must be a supported artifact bytes boundary next action.'));
    }
    if (!isOneOf(payload.sourceArtifactBytesBoundary.reviewStatus, UPLOAD_ADAPTER_INJECTION_BOUNDARY_REVIEW_STATUSES)) {
      issues.push(error('$.sourceArtifactBytesBoundary.reviewStatus', 'must be a supported review status.'));
    }
    if (!isOneOf(payload.sourceArtifactBytesBoundary.reviewKind, UPLOAD_ADAPTER_INJECTION_BOUNDARY_REVIEW_KINDS)) {
      issues.push(error('$.sourceArtifactBytesBoundary.reviewKind', 'must be a supported review kind.'));
    }
    if (!isOneOf(payload.sourceArtifactBytesBoundary.adapterBackendKind, UPLOAD_ADAPTER_INJECTION_BOUNDARY_ADAPTER_BACKENDS)) {
      issues.push(error('$.sourceArtifactBytesBoundary.adapterBackendKind', 'must be a supported adapter backend kind.'));
    }
    for (const key of [
      'scopeMatched',
      'humanReviewRecorded',
      'fingerprintVerified',
      'sourceFingerprintVerified',
      'artifactBytesRequiredBeforeAdapter',
      'artifactBytesRequiredBeforeExecution',
      'artifactBytesProvided',
      'artifactDigestRequired',
      'artifactDigestVerified',
      'artifactScopeBindingRequired',
      'artifactScopeBoundToArtifact',
      'auditRecordRequiredBeforeBytes',
      'auditRecordCreated',
      'writeTokenRequiredBeforeBytes',
      'writeTokenIssued',
      'executionLeaseRequiredBeforeBytes',
      'executionLeaseCreated',
      'rollbackPlanRequiredBeforeBytes',
      'rollbackPlanCreated',
      'adapterInjectionRequiredAfterBytes'
    ]) {
      if (typeof payload.sourceArtifactBytesBoundary[key] !== 'boolean') {
        issues.push(error(`$.sourceArtifactBytesBoundary.${key}`, 'must be a boolean.'));
      }
    }
    if (payload.sourceArtifactBytesBoundary.adapterName !== null) {
      if (typeof payload.sourceArtifactBytesBoundary.adapterName !== 'string' || !isSafeKnowledgeTeamBackendAdapterName(payload.sourceArtifactBytesBoundary.adapterName)) {
        issues.push(error('$.sourceArtifactBytesBoundary.adapterName', 'must be null or a safe adapter name.'));
      }
    }
    if (payload.status === 'adapter-injection-boundary-ready') {
      if (payload.sourceArtifactBytesBoundary.boundaryStatus !== 'artifact-bytes-boundary-ready') {
        issues.push(error('$.sourceArtifactBytesBoundary.boundaryStatus', 'must be artifact-bytes-boundary-ready for adapter-injection-boundary-ready payloads.'));
      }
      if (payload.sourceArtifactBytesBoundary.boundaryKind !== 'artifact-bytes-boundary-dry-run') {
        issues.push(error('$.sourceArtifactBytesBoundary.boundaryKind', 'must be artifact-bytes-boundary-dry-run for adapter-injection-boundary-ready payloads.'));
      }
      if (payload.sourceArtifactBytesBoundary.boundaryNextAction !== 'design-adapter-injection-boundary') {
        issues.push(error('$.sourceArtifactBytesBoundary.boundaryNextAction', 'must design the adapter injection boundary for adapter-injection-boundary-ready payloads.'));
      }
      if (payload.sourceArtifactBytesBoundary.reviewStatus !== 'review-ready') {
        issues.push(error('$.sourceArtifactBytesBoundary.reviewStatus', 'must be review-ready for adapter-injection-boundary-ready payloads.'));
      }
      if (payload.sourceArtifactBytesBoundary.reviewKind !== 'human-fingerprint-dry-run') {
        issues.push(error('$.sourceArtifactBytesBoundary.reviewKind', 'must be human-fingerprint-dry-run for adapter-injection-boundary-ready payloads.'));
      }
      if (payload.sourceArtifactBytesBoundary.scopeMatched !== true) {
        issues.push(error('$.sourceArtifactBytesBoundary.scopeMatched', 'must be true for adapter-injection-boundary-ready payloads.'));
      }
      if (payload.sourceArtifactBytesBoundary.humanReviewRecorded !== true) {
        issues.push(error('$.sourceArtifactBytesBoundary.humanReviewRecorded', 'must be true for adapter-injection-boundary-ready payloads.'));
      }
      if (payload.sourceArtifactBytesBoundary.fingerprintVerified !== true) {
        issues.push(error('$.sourceArtifactBytesBoundary.fingerprintVerified', 'must be true for adapter-injection-boundary-ready payloads.'));
      }
      if (payload.sourceArtifactBytesBoundary.sourceFingerprintVerified !== true) {
        issues.push(error('$.sourceArtifactBytesBoundary.sourceFingerprintVerified', 'must be true for adapter-injection-boundary-ready payloads.'));
      }
      if (payload.sourceArtifactBytesBoundary.adapterName === null) {
        issues.push(error('$.sourceArtifactBytesBoundary.adapterName', 'must be set for adapter-injection-boundary-ready payloads.'));
      }
      if (payload.sourceArtifactBytesBoundary.adapterBackendKind !== 'mock-s3-compatible') {
        issues.push(error('$.sourceArtifactBytesBoundary.adapterBackendKind', 'must be mock-s3-compatible for adapter-injection-boundary-ready payloads.'));
      }
      for (const key of [
        'artifactBytesRequiredBeforeAdapter',
        'artifactBytesRequiredBeforeExecution',
        'artifactDigestRequired',
        'artifactScopeBindingRequired',
        'auditRecordRequiredBeforeBytes',
        'writeTokenRequiredBeforeBytes',
        'executionLeaseRequiredBeforeBytes',
        'rollbackPlanRequiredBeforeBytes',
        'adapterInjectionRequiredAfterBytes'
      ]) {
        if (payload.sourceArtifactBytesBoundary[key] !== true) {
          issues.push(error(`$.sourceArtifactBytesBoundary.${key}`, 'must be true for adapter-injection-boundary-ready payloads.'));
        }
      }
      for (const key of [
        'artifactBytesProvided',
        'artifactDigestVerified',
        'artifactScopeBoundToArtifact',
        'auditRecordCreated',
        'writeTokenIssued',
        'executionLeaseCreated',
        'rollbackPlanCreated'
      ]) {
        if (payload.sourceArtifactBytesBoundary[key] !== false) {
          issues.push(error(`$.sourceArtifactBytesBoundary.${key}`, 'must be false for adapter-injection-boundary-ready payloads.'));
        }
      }
    }
  }

  if (!isRecord(payload.adapterInjectionBoundary)) {
    issues.push(error('$.adapterInjectionBoundary', 'Knowledge team upload adapter injection boundary adapterInjectionBoundary must be an object.'));
  } else {
    for (const key of [
      'dryRunOnly',
      'adapterInjectionRequiredBeforeExecution',
      'adapterInjectionRequiredAfterBytes',
      'adapterDependencyInjectionOnly',
      'mockAdapterRequired',
      'adapterDescriptorRequired',
      'artifactObjectStoreDependencyRequired',
      'metadataIndexDependencyRequired',
      'contentAddressedObjectKeysRequired',
      'contentAddressedIndexKeysRequired',
      'idempotentWritesRequired',
      'explicitUploadApprovalRequired',
      'artifactBytesRequiredBeforeAdapter',
      'artifactDigestRequired',
      'artifactScopeBindingRequired',
      'writeTokenRequiredBeforeAdapter',
      'executionLeaseRequiredBeforeAdapter',
      'rollbackPlanRequiredBeforeAdapter',
      'auditRecordRequiredBeforeAdapter'
    ]) {
      if (payload.adapterInjectionBoundary[key] !== true) {
        issues.push(error(`$.adapterInjectionBoundary.${key}`, 'must be true.'));
      }
    }
    for (const key of [
      'artifactBytesProvided',
      'artifactDigestVerified',
      'artifactScopeBoundToArtifact',
      'writeTokenIssued',
      'executionLeaseCreated',
      'rollbackPlanCreated',
      'auditRecordCreated',
      'adapterInjected',
      'clientCreated',
      'artifactObjectStoreBound',
      'metadataIndexBound',
      'executable'
    ]) {
      if (payload.adapterInjectionBoundary[key] !== false) {
        issues.push(error(`$.adapterInjectionBoundary.${key}`, 'must be false.'));
      }
    }
  }

  if (!isRecord(payload.remainingExecutionBoundaries)) {
    issues.push(error('$.remainingExecutionBoundaries', 'Knowledge team upload adapter injection boundary remainingExecutionBoundaries must be an object.'));
  } else {
    for (const key of [
      'artifactBytesRequired',
      'adapterInjectionRequired',
      'clientCreationRequired',
      'writeTokenRequired',
      'executionLeaseRequired',
      'rollbackPlanRequired',
      'auditRecordRequired'
    ]) {
      if (payload.remainingExecutionBoundaries[key] !== true) {
        issues.push(error(`$.remainingExecutionBoundaries.${key}`, 'must be true.'));
      }
    }
    for (const key of [
      'artifactBytesProvided',
      'adapterInjected',
      'clientCreated',
      'writeTokenIssued',
      'executionLeaseCreated',
      'rollbackPlanCreated',
      'auditRecordCreated',
      'objectWriteAllowed',
      'metadataIndexWriteAllowed',
      'remoteMutationAllowed'
    ]) {
      if (payload.remainingExecutionBoundaries[key] !== false) {
        issues.push(error(`$.remainingExecutionBoundaries.${key}`, 'must be false.'));
      }
    }
  }

  if (!isRecord(payload.readiness)) {
    issues.push(error('$.readiness', 'Knowledge team upload adapter injection boundary readiness must be an object.'));
  } else {
    validateBlockers({
      readiness: payload.readiness,
      supportedCodes: UPLOAD_ADAPTER_INJECTION_BOUNDARY_BLOCKERS,
      supportedStatuses: UPLOAD_ADAPTER_INJECTION_BOUNDARY_STATUSES,
      supportedNextActions: UPLOAD_ADAPTER_INJECTION_BOUNDARY_NEXT_ACTIONS,
      path: '$.readiness',
      issues
    });
    if (payload.status !== payload.readiness.status) {
      issues.push(error('$.readiness.status', 'must match payload status.'));
    }
    if (payload.status === 'adapter-injection-boundary-ready') {
      if (payload.readiness.nextAction !== 'design-client-creation-boundary') {
        issues.push(error('$.readiness.nextAction', 'must design the client creation boundary for adapter-injection-boundary-ready payloads.'));
      }
      if (payload.readiness.blockerCount !== 0) {
        issues.push(error('$.readiness.blockerCount', 'must be 0 for adapter-injection-boundary-ready payloads.'));
      }
    }
    if (payload.status === 'blocked' && payload.readiness.nextAction !== 'resolve-blockers') {
      issues.push(error('$.readiness.nextAction', 'must resolve blockers for blocked payloads.'));
    }
  }

  return createEmptyKnowledgeValidationReport({ inputPath, inputKind, issues });
}

export function validateKnowledgeTeamUploadClientCreationBoundaryPayload(
  payload: Record<string, unknown>,
  inputPath: string,
  inputKind: string
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];
  validateCommonDryRunBoundary(payload, issues, 'Knowledge team upload client creation boundary');
  validateNoUploadApprovalLeakage(payload, '$', issues);

  if (!isOneOf(payload.status, UPLOAD_CLIENT_CREATION_BOUNDARY_STATUSES)) {
    issues.push(error('$.status', 'Knowledge team upload client creation boundary status must be supported.'));
  }
  if (payload.boundaryKind !== 'client-creation-boundary-dry-run') {
    issues.push(error('$.boundaryKind', 'Knowledge team upload client creation boundary kind must be client-creation-boundary-dry-run.'));
  }
  if (payload.plannedOperation !== 'stage-knowledge-pack') {
    issues.push(error('$.plannedOperation', 'Knowledge team upload client creation boundary operation must be stage-knowledge-pack.'));
  }
  for (const key of [
    'uploadApproved',
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
  ]) {
    if (payload[key] !== false) {
      issues.push(error(`$.${key}`, 'Knowledge team upload client creation boundary must keep mutation and execution fields false.'));
    }
  }

  if (!isRecord(payload.target)) {
    issues.push(error('$.target', 'Knowledge team upload client creation boundary target must be an object.'));
  } else {
    for (const key of ['manifestId', 'artifactId']) {
      if (payload.target[key] !== null && (typeof payload.target[key] !== 'string' || !/^[a-f0-9]{24}$/.test(payload.target[key]))) {
        issues.push(error(`$.target.${key}`, 'must be null or a safe 24-character id.'));
      }
      if (payload.status === 'client-creation-boundary-ready' && payload.target[key] === null) {
        issues.push(error(`$.target.${key}`, 'must be set for client-creation-boundary-ready payloads.'));
      }
    }
    if (payload.target.objectSha256 !== null && (typeof payload.target.objectSha256 !== 'string' || !SAFE_SHA256_PATTERN.test(payload.target.objectSha256))) {
      issues.push(error('$.target.objectSha256', 'must be null or a SHA-256 hex string.'));
    }
    if (payload.status === 'client-creation-boundary-ready' && payload.target.objectSha256 === null) {
      issues.push(error('$.target.objectSha256', 'must be set for client-creation-boundary-ready payloads.'));
    }
    if (payload.target.objectKey !== null && (typeof payload.target.objectKey !== 'string' || !isSafeKnowledgeTeamArtifactObjectKey(payload.target.objectKey))) {
      issues.push(error('$.target.objectKey', 'must be null or a safe team artifact object key.'));
    }
    if (payload.status === 'client-creation-boundary-ready' && payload.target.objectKey === null) {
      issues.push(error('$.target.objectKey', 'must be set for client-creation-boundary-ready payloads.'));
    }
  }

  if (!isRecord(payload.sourceAdapterInjectionBoundary)) {
    issues.push(error('$.sourceAdapterInjectionBoundary', 'Knowledge team upload client creation boundary sourceAdapterInjectionBoundary must be an object.'));
  } else {
    if (payload.sourceAdapterInjectionBoundary.source !== 'upload-adapter-injection-boundary') {
      issues.push(error('$.sourceAdapterInjectionBoundary.source', 'must be upload-adapter-injection-boundary.'));
    }
    if (!isOneOf(payload.sourceAdapterInjectionBoundary.boundaryStatus, UPLOAD_CLIENT_CREATION_BOUNDARY_SOURCE_STATUSES)) {
      issues.push(error('$.sourceAdapterInjectionBoundary.boundaryStatus', 'must be a supported adapter injection boundary status.'));
    }
    if (!isOneOf(payload.sourceAdapterInjectionBoundary.boundaryKind, UPLOAD_CLIENT_CREATION_BOUNDARY_SOURCE_KINDS)) {
      issues.push(error('$.sourceAdapterInjectionBoundary.boundaryKind', 'must be a supported adapter injection boundary kind.'));
    }
    if (!isOneOf(payload.sourceAdapterInjectionBoundary.boundaryNextAction, UPLOAD_CLIENT_CREATION_BOUNDARY_SOURCE_NEXT_ACTIONS)) {
      issues.push(error('$.sourceAdapterInjectionBoundary.boundaryNextAction', 'must be a supported adapter injection boundary next action.'));
    }
    if (!isOneOf(payload.sourceAdapterInjectionBoundary.reviewStatus, UPLOAD_CLIENT_CREATION_BOUNDARY_REVIEW_STATUSES)) {
      issues.push(error('$.sourceAdapterInjectionBoundary.reviewStatus', 'must be a supported review status.'));
    }
    if (!isOneOf(payload.sourceAdapterInjectionBoundary.reviewKind, UPLOAD_CLIENT_CREATION_BOUNDARY_REVIEW_KINDS)) {
      issues.push(error('$.sourceAdapterInjectionBoundary.reviewKind', 'must be a supported review kind.'));
    }
    if (!isOneOf(payload.sourceAdapterInjectionBoundary.adapterBackendKind, UPLOAD_CLIENT_CREATION_BOUNDARY_ADAPTER_BACKENDS)) {
      issues.push(error('$.sourceAdapterInjectionBoundary.adapterBackendKind', 'must be a supported adapter backend kind.'));
    }
    for (const key of [
      'scopeMatched',
      'humanReviewRecorded',
      'fingerprintVerified',
      'sourceFingerprintVerified',
      'adapterInjectionRequiredBeforeExecution',
      'adapterInjectionRequiredAfterBytes',
      'adapterDependencyInjectionOnly',
      'mockAdapterRequired',
      'adapterDescriptorRequired',
      'artifactObjectStoreDependencyRequired',
      'metadataIndexDependencyRequired',
      'contentAddressedObjectKeysRequired',
      'contentAddressedIndexKeysRequired',
      'idempotentWritesRequired',
      'explicitUploadApprovalRequired',
      'artifactBytesRequiredBeforeAdapter',
      'artifactBytesProvided',
      'artifactDigestRequired',
      'artifactDigestVerified',
      'artifactScopeBindingRequired',
      'artifactScopeBoundToArtifact',
      'writeTokenRequiredBeforeAdapter',
      'writeTokenIssued',
      'executionLeaseRequiredBeforeAdapter',
      'executionLeaseCreated',
      'rollbackPlanRequiredBeforeAdapter',
      'rollbackPlanCreated',
      'auditRecordRequiredBeforeAdapter',
      'auditRecordCreated',
      'adapterInjected',
      'clientCreated',
      'artifactObjectStoreBound',
      'metadataIndexBound',
      'executable'
    ]) {
      if (typeof payload.sourceAdapterInjectionBoundary[key] !== 'boolean') {
        issues.push(error(`$.sourceAdapterInjectionBoundary.${key}`, 'must be a boolean.'));
      }
    }
    if (payload.sourceAdapterInjectionBoundary.adapterName !== null) {
      if (typeof payload.sourceAdapterInjectionBoundary.adapterName !== 'string' || !isSafeKnowledgeTeamBackendAdapterName(payload.sourceAdapterInjectionBoundary.adapterName)) {
        issues.push(error('$.sourceAdapterInjectionBoundary.adapterName', 'must be null or a safe adapter name.'));
      }
    }
    if (payload.status === 'client-creation-boundary-ready') {
      if (payload.sourceAdapterInjectionBoundary.boundaryStatus !== 'adapter-injection-boundary-ready') {
        issues.push(error('$.sourceAdapterInjectionBoundary.boundaryStatus', 'must be adapter-injection-boundary-ready for client-creation-boundary-ready payloads.'));
      }
      if (payload.sourceAdapterInjectionBoundary.boundaryKind !== 'adapter-injection-boundary-dry-run') {
        issues.push(error('$.sourceAdapterInjectionBoundary.boundaryKind', 'must be adapter-injection-boundary-dry-run for client-creation-boundary-ready payloads.'));
      }
      if (payload.sourceAdapterInjectionBoundary.boundaryNextAction !== 'design-client-creation-boundary') {
        issues.push(error('$.sourceAdapterInjectionBoundary.boundaryNextAction', 'must design the client creation boundary for client-creation-boundary-ready payloads.'));
      }
      if (payload.sourceAdapterInjectionBoundary.reviewStatus !== 'review-ready') {
        issues.push(error('$.sourceAdapterInjectionBoundary.reviewStatus', 'must be review-ready for client-creation-boundary-ready payloads.'));
      }
      if (payload.sourceAdapterInjectionBoundary.reviewKind !== 'human-fingerprint-dry-run') {
        issues.push(error('$.sourceAdapterInjectionBoundary.reviewKind', 'must be human-fingerprint-dry-run for client-creation-boundary-ready payloads.'));
      }
      if (payload.sourceAdapterInjectionBoundary.scopeMatched !== true) {
        issues.push(error('$.sourceAdapterInjectionBoundary.scopeMatched', 'must be true for client-creation-boundary-ready payloads.'));
      }
      if (payload.sourceAdapterInjectionBoundary.humanReviewRecorded !== true) {
        issues.push(error('$.sourceAdapterInjectionBoundary.humanReviewRecorded', 'must be true for client-creation-boundary-ready payloads.'));
      }
      if (payload.sourceAdapterInjectionBoundary.fingerprintVerified !== true) {
        issues.push(error('$.sourceAdapterInjectionBoundary.fingerprintVerified', 'must be true for client-creation-boundary-ready payloads.'));
      }
      if (payload.sourceAdapterInjectionBoundary.sourceFingerprintVerified !== true) {
        issues.push(error('$.sourceAdapterInjectionBoundary.sourceFingerprintVerified', 'must be true for client-creation-boundary-ready payloads.'));
      }
      if (payload.sourceAdapterInjectionBoundary.adapterName === null) {
        issues.push(error('$.sourceAdapterInjectionBoundary.adapterName', 'must be set for client-creation-boundary-ready payloads.'));
      }
      if (payload.sourceAdapterInjectionBoundary.adapterBackendKind !== 'mock-s3-compatible') {
        issues.push(error('$.sourceAdapterInjectionBoundary.adapterBackendKind', 'must be mock-s3-compatible for client-creation-boundary-ready payloads.'));
      }
      for (const key of [
        'adapterInjectionRequiredBeforeExecution',
        'adapterInjectionRequiredAfterBytes',
        'adapterDependencyInjectionOnly',
        'mockAdapterRequired',
        'adapterDescriptorRequired',
        'artifactObjectStoreDependencyRequired',
        'metadataIndexDependencyRequired',
        'contentAddressedObjectKeysRequired',
        'contentAddressedIndexKeysRequired',
        'idempotentWritesRequired',
        'explicitUploadApprovalRequired',
        'artifactBytesRequiredBeforeAdapter',
        'artifactDigestRequired',
        'artifactScopeBindingRequired',
        'writeTokenRequiredBeforeAdapter',
        'executionLeaseRequiredBeforeAdapter',
        'rollbackPlanRequiredBeforeAdapter',
        'auditRecordRequiredBeforeAdapter'
      ]) {
        if (payload.sourceAdapterInjectionBoundary[key] !== true) {
          issues.push(error(`$.sourceAdapterInjectionBoundary.${key}`, 'must be true for client-creation-boundary-ready payloads.'));
        }
      }
      for (const key of [
        'artifactBytesProvided',
        'artifactDigestVerified',
        'artifactScopeBoundToArtifact',
        'writeTokenIssued',
        'executionLeaseCreated',
        'rollbackPlanCreated',
        'auditRecordCreated',
        'adapterInjected',
        'clientCreated',
        'artifactObjectStoreBound',
        'metadataIndexBound',
        'executable'
      ]) {
        if (payload.sourceAdapterInjectionBoundary[key] !== false) {
          issues.push(error(`$.sourceAdapterInjectionBoundary.${key}`, 'must be false for client-creation-boundary-ready payloads.'));
        }
      }
    }
  }

  if (!isRecord(payload.clientCreationBoundary)) {
    issues.push(error('$.clientCreationBoundary', 'Knowledge team upload client creation boundary clientCreationBoundary must be an object.'));
  } else {
    for (const key of [
      'dryRunOnly',
      'clientCreationRequiredBeforeExecution',
      'clientCreationRequiredAfterAdapter',
      'adapterInjectionRequiredBeforeClient',
      'adapterDependencyInjectionOnly',
      'mockAdapterRequired',
      'clientFactoryDescriptorRequired',
      'credentialReadBoundaryRequired',
      'credentialPresenceBoundaryRequired',
      'liveCheckBoundaryRequired',
      'uploadCommandBoundaryRequired',
      'artifactObjectStoreDependencyRequired',
      'metadataIndexDependencyRequired',
      'contentAddressedObjectKeysRequired',
      'contentAddressedIndexKeysRequired',
      'idempotentWritesRequired',
      'explicitUploadApprovalRequired'
    ]) {
      if (payload.clientCreationBoundary[key] !== true) {
        issues.push(error(`$.clientCreationBoundary.${key}`, 'must be true.'));
      }
    }
    for (const key of [
      'clientCreated',
      'sdkClientCreated',
      'adapterInjected',
      'artifactObjectStoreBound',
      'metadataIndexBound',
      'credentialValuesExposed',
      'credentialPresenceChecked',
      'liveCheckPerformed',
      'uploadExecutionAllowed',
      'uploadCommandGenerated',
      'objectWriteAttempted',
      'metadataIndexWriteAttempted',
      'remoteMutationPerformed',
      'executable'
    ]) {
      if (payload.clientCreationBoundary[key] !== false) {
        issues.push(error(`$.clientCreationBoundary.${key}`, 'must be false.'));
      }
    }
  }

  if (!isRecord(payload.remainingExecutionBoundaries)) {
    issues.push(error('$.remainingExecutionBoundaries', 'Knowledge team upload client creation boundary remainingExecutionBoundaries must be an object.'));
  } else {
    for (const key of [
      'artifactBytesRequired',
      'adapterInjectionRequired',
      'clientCreationRequired',
      'credentialReadRequired',
      'credentialPresenceCheckRequired',
      'liveCheckRequired',
      'uploadCommandRequired',
      'writeTokenRequired',
      'executionLeaseRequired',
      'rollbackPlanRequired',
      'auditRecordRequired'
    ]) {
      if (payload.remainingExecutionBoundaries[key] !== true) {
        issues.push(error(`$.remainingExecutionBoundaries.${key}`, 'must be true.'));
      }
    }
    for (const key of [
      'artifactBytesProvided',
      'adapterInjected',
      'clientCreated',
      'credentialValuesExposed',
      'credentialPresenceChecked',
      'liveCheckPerformed',
      'uploadCommandGenerated',
      'writeTokenIssued',
      'executionLeaseCreated',
      'rollbackPlanCreated',
      'auditRecordCreated',
      'objectWriteAllowed',
      'metadataIndexWriteAllowed',
      'remoteMutationAllowed'
    ]) {
      if (payload.remainingExecutionBoundaries[key] !== false) {
        issues.push(error(`$.remainingExecutionBoundaries.${key}`, 'must be false.'));
      }
    }
  }

  if (!isRecord(payload.readiness)) {
    issues.push(error('$.readiness', 'Knowledge team upload client creation boundary readiness must be an object.'));
  } else {
    validateBlockers({
      readiness: payload.readiness,
      supportedCodes: UPLOAD_CLIENT_CREATION_BOUNDARY_BLOCKERS,
      supportedStatuses: UPLOAD_CLIENT_CREATION_BOUNDARY_STATUSES,
      supportedNextActions: UPLOAD_CLIENT_CREATION_BOUNDARY_NEXT_ACTIONS,
      path: '$.readiness',
      issues
    });
    if (payload.status !== payload.readiness.status) {
      issues.push(error('$.readiness.status', 'must match payload status.'));
    }
    if (payload.status === 'client-creation-boundary-ready') {
      if (payload.readiness.nextAction !== 'design-credential-read-boundary') {
        issues.push(error('$.readiness.nextAction', 'must design the credential read boundary for client-creation-boundary-ready payloads.'));
      }
      if (payload.readiness.blockerCount !== 0) {
        issues.push(error('$.readiness.blockerCount', 'must be 0 for client-creation-boundary-ready payloads.'));
      }
    }
    if (payload.status === 'blocked' && payload.readiness.nextAction !== 'resolve-blockers') {
      issues.push(error('$.readiness.nextAction', 'must resolve blockers for blocked payloads.'));
    }
  }

  return createEmptyKnowledgeValidationReport({ inputPath, inputKind, issues });
}
