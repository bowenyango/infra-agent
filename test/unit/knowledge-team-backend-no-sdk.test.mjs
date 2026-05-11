import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const TEAM_BACKEND_MODULES = [
  'src/knowledge/team-backend-adapter.ts',
  'src/knowledge/team-backend-adapter-mock.ts',
  'src/knowledge/team-backend-adapter-resolver.ts',
  'src/knowledge/team-backend-readiness.ts',
  'src/knowledge/team-s3-compatible-backend-config.ts',
  'src/knowledge/team-s3-compatible-reference-registry.ts',
  'src/knowledge/team-upload-approval-intent.ts',
  'src/knowledge/team-upload-approval-continuation.ts',
  'src/knowledge/team-upload-adapter-preflight.ts',
  'src/knowledge/team-upload-mock-harness.ts',
  'src/knowledge/team-upload-execution-gate.ts',
  'src/knowledge/team-upload-execution-prerequisite-plan.ts',
  'src/knowledge/team-upload-write-token-boundary.ts',
  'src/knowledge/team-upload-execution-lease-boundary.ts',
  'src/knowledge/team-upload-rollback-plan-boundary.ts',
  'src/knowledge/team-upload-audit-record-boundary.ts',
  'src/knowledge/team-upload-artifact-bytes-boundary.ts',
  'src/knowledge/team-upload-adapter-injection-boundary.ts',
  'src/knowledge/team-upload-client-creation-boundary.ts',
  'src/knowledge/team-upload-credential-read-boundary.ts',
  'src/knowledge/team-upload-credential-presence-boundary.ts',
  'src/knowledge/team-upload-live-check-boundary.ts',
  'src/knowledge/team-upload-command-boundary.ts',
  'src/knowledge/team-upload-object-index-binding-boundary.ts',
  'src/knowledge/team-upload-execution-readiness-boundary.ts',
  'src/knowledge/team-upload-execution-approval-request.ts',
  'src/knowledge/team-upload-execution-approval-record.ts',
  'src/knowledge/team-upload-execution-authorization-boundary.ts',
  'src/knowledge/team-upload-execution-plan-rules-review.ts',
  'src/knowledge/team-upload-execution-plan-rules-update-record.ts',
  'src/knowledge/team-upload-execution-implementation-boundary.ts',
  'src/knowledge/team-upload-execution-runtime-boundaries.ts',
  'src/knowledge/team-upload-execution-runtime-boundary-policy-review.ts',
  'src/knowledge/team-upload-mutation-plan.ts',
  'src/knowledge/team-upload-mutation-approval-review.ts',
  'src/knowledge/team-upload-approval-validation.ts'
];

const ARTIFACT_BYTE_BOUNDARY_MODULES = [
  'src/knowledge/team-upload-artifact-bytes-boundary.ts',
  'src/knowledge/team-upload-adapter-injection-boundary.ts',
  'src/knowledge/team-upload-client-creation-boundary.ts',
  'src/knowledge/team-upload-credential-read-boundary.ts'
];

const ADAPTER_INJECTION_BOUNDARY_MODULES = [
  'src/knowledge/team-upload-adapter-injection-boundary.ts'
];

const CLIENT_CREATION_BOUNDARY_MODULES = [
  'src/knowledge/team-upload-client-creation-boundary.ts'
];

const CREDENTIAL_READ_BOUNDARY_MODULES = [
  'src/knowledge/team-upload-credential-read-boundary.ts'
];

const CREDENTIAL_PRESENCE_BOUNDARY_MODULES = [
  'src/knowledge/team-upload-credential-presence-boundary.ts'
];

const LIVE_CHECK_BOUNDARY_MODULES = [
  'src/knowledge/team-upload-live-check-boundary.ts'
];

const COMMAND_BOUNDARY_MODULES = [
  'src/knowledge/team-upload-command-boundary.ts'
];

const OBJECT_INDEX_BINDING_BOUNDARY_MODULES = [
  'src/knowledge/team-upload-object-index-binding-boundary.ts'
];

const EXECUTION_READINESS_BOUNDARY_MODULES = [
  'src/knowledge/team-upload-execution-readiness-boundary.ts'
];

const EXECUTION_APPROVAL_REQUEST_MODULES = [
  'src/knowledge/team-upload-execution-approval-request.ts'
];

const EXECUTION_APPROVAL_RECORD_MODULES = [
  'src/knowledge/team-upload-execution-approval-record.ts'
];

const EXECUTION_AUTHORIZATION_BOUNDARY_MODULES = [
  'src/knowledge/team-upload-execution-authorization-boundary.ts'
];

const EXECUTION_PLAN_RULES_REVIEW_MODULES = [
  'src/knowledge/team-upload-execution-plan-rules-review.ts'
];

const EXECUTION_PLAN_RULES_UPDATE_RECORD_MODULES = [
  'src/knowledge/team-upload-execution-plan-rules-update-record.ts'
];

const EXECUTION_IMPLEMENTATION_BOUNDARY_MODULES = [
  'src/knowledge/team-upload-execution-implementation-boundary.ts'
];

const EXECUTION_RUNTIME_BOUNDARIES_MODULES = [
  'src/knowledge/team-upload-execution-runtime-boundaries.ts'
];

const EXECUTION_RUNTIME_BOUNDARY_POLICY_REVIEW_MODULES = [
  'src/knowledge/team-upload-execution-runtime-boundary-policy-review.ts'
];

const FORBIDDEN_SDK_IMPORTS = [
  '@aws-sdk/',
  'aws-sdk',
  '@google-cloud/storage',
  '@azure/storage-blob',
  'node:http',
  'node:https',
  'node:net',
  'node:tls',
  'from \'http\'',
  'from "http"',
  'from \'https\'',
  'from "https"',
  'fetch('
];

const FORBIDDEN_RUNTIME_CREDENTIAL_READS = [
  'process.env[',
  'process.env.'
];

const FORBIDDEN_ARTIFACT_BYTE_READS = [
  'node:fs',
  'fs/promises',
  'readFile(',
  'createReadStream(',
  'Buffer.from(',
  'arrayBuffer(',
  'new Blob',
  'Blob(',
  'ReadableStream'
];

const FORBIDDEN_ADAPTER_INJECTION_EXECUTION = [
  'createMockKnowledgeTeamBackendAdapter(',
  'new KnowledgeTeamBackendAdapter',
  'new S3',
  'putObject(',
  'putEntry(',
  'artifactStore.put',
  'metadataIndex.put',
  'clientCreated: true',
  'adapterInjected: true'
];

const FORBIDDEN_CLIENT_CREATION_EXECUTION = [
  'createMockKnowledgeTeamBackendAdapter(',
  'createClient(',
  'new S3',
  'new Client',
  'putObject(',
  'putEntry(',
  'artifactStore.put',
  'metadataIndex.put',
  'readFile(',
  'createReadStream(',
  'clientCreated: true',
  'sdkClientCreated: true',
  'adapterInjected: true',
  'liveCheckPerformed: true',
  'uploadCommandGenerated: true'
];

const FORBIDDEN_CREDENTIAL_READ_EXECUTION = [
  'createMockKnowledgeTeamBackendAdapter(',
  'createClient(',
  'new S3',
  'new Client',
  'putObject(',
  'putEntry(',
  'artifactStore.put',
  'metadataIndex.put',
  'readFile(',
  'createReadStream(',
  'process.env[',
  'process.env.',
  'clientCreated: true',
  'sdkClientCreated: true',
  'adapterInjected: true',
  'credentialValuesRead: true',
  'credentialValuesExposed: true',
  'credentialPresenceChecked: true',
  'liveCheckPerformed: true',
  'uploadCommandGenerated: true',
  'objectWriteAttempted: true',
  'metadataIndexWriteAttempted: true'
];

const FORBIDDEN_CREDENTIAL_PRESENCE_EXECUTION = [
  'createMockKnowledgeTeamBackendAdapter(',
  'createClient(',
  'new S3',
  'new Client',
  'putObject(',
  'putEntry(',
  'artifactStore.put',
  'metadataIndex.put',
  'readFile(',
  'createReadStream(',
  'process.env[',
  'process.env.',
  'clientCreated: true',
  'sdkClientCreated: true',
  'adapterInjected: true',
  'credentialValuesRead: true',
  'credentialValuesExposed: true',
  'credentialPresenceChecked: true',
  'credentialPresenceResultExposed: true',
  'liveCheckPerformed: true',
  'uploadCommandGenerated: true',
  'objectWriteAttempted: true',
  'metadataIndexWriteAttempted: true'
];

const FORBIDDEN_LIVE_CHECK_EXECUTION = [
  'createMockKnowledgeTeamBackendAdapter(',
  'createClient(',
  'new S3',
  'new Client',
  'putObject(',
  'putEntry(',
  'artifactStore.put',
  'metadataIndex.put',
  'readFile(',
  'createReadStream(',
  'process.env[',
  'process.env.',
  'clientCreated: true',
  'sdkClientCreated: true',
  'adapterInjected: true',
  'credentialValuesRead: true',
  'credentialValuesExposed: true',
  'credentialPresenceChecked: true',
  'credentialPresenceResultExposed: true',
  'liveCheckAllowed: true',
  'liveCheckPerformed: true',
  'liveCheckResultExposed: true',
  'uploadCommandGenerated: true',
  'objectWriteAttempted: true',
  'metadataIndexWriteAttempted: true'
];

const FORBIDDEN_COMMAND_BOUNDARY_EXECUTION = [
  'createMockKnowledgeTeamBackendAdapter(',
  'createClient(',
  'new S3',
  'new Client',
  'putObject(',
  'putEntry(',
  'artifactStore.put',
  'metadataIndex.put',
  'readFile(',
  'createReadStream(',
  'process.env[',
  'process.env.',
  'fetch(',
  'node:http',
  'node:https',
  'node:net',
  'node:tls',
  'clientCreated: true',
  'sdkClientCreated: true',
  'adapterInjected: true',
  'credentialValuesRead: true',
  'credentialValuesExposed: true',
  'credentialPresenceChecked: true',
  'credentialPresenceResultExposed: true',
  'liveCheckAllowed: true',
  'liveCheckPerformed: true',
  'liveCheckResultExposed: true',
  'uploadCommandGenerated: true',
  'uploadCommandMaterialized: true',
  'uploadCommandExposed: true',
  'uploadCommand: {',
  'uploadCommand: \'',
  'uploadCommand: "',
  'uploadExecutionAllowed: true',
  'objectWriteAttempted: true',
  'metadataIndexWriteAttempted: true',
  'remoteMutationPerformed: true',
  'executable: true'
];

const FORBIDDEN_OBJECT_INDEX_BINDING_EXECUTION = [
  'createMockKnowledgeTeamBackendAdapter(',
  'createClient(',
  'new S3',
  'new Client',
  'putObject(',
  'putEntry(',
  'artifactStore.put',
  'metadataIndex.put',
  'readFile(',
  'createReadStream(',
  'process.env[',
  'process.env.',
  'fetch(',
  'node:http',
  'node:https',
  'node:net',
  'node:tls',
  'clientCreated: true',
  'sdkClientCreated: true',
  'adapterInjected: true',
  'credentialValuesRead: true',
  'credentialValuesExposed: true',
  'credentialPresenceChecked: true',
  'credentialPresenceResultExposed: true',
  'liveCheckAllowed: true',
  'liveCheckPerformed: true',
  'liveCheckResultExposed: true',
  'uploadCommandGenerated: true',
  'uploadCommandMaterialized: true',
  'uploadCommandExposed: true',
  'uploadCommand: {',
  'uploadCommand: \'',
  'uploadCommand: "',
  'uploadExecutionAllowed: true',
  'artifactBytesProvided: true',
  'artifactObjectStoreBound: true',
  'metadataIndexBound: true',
  'objectStoreHandleExposed: true',
  'metadataIndexHandleExposed: true',
  'objectWriteAllowed: true',
  'metadataIndexWriteAllowed: true',
  'objectWriteAttempted: true',
  'metadataIndexWriteAttempted: true',
  'remoteMutationPerformed: true',
  'executable: true'
];

const FORBIDDEN_EXECUTION_READINESS_EXECUTION = [
  'createMockKnowledgeTeamBackendAdapter(',
  'createClient(',
  'new S3',
  'new Client',
  'putObject(',
  'putEntry(',
  'artifactStore.put',
  'metadataIndex.put',
  'readFile(',
  'createReadStream(',
  'process.env[',
  'process.env.',
  'fetch(',
  'node:http',
  'node:https',
  'node:net',
  'node:tls',
  'clientCreated: true',
  'sdkClientCreated: true',
  'adapterInjected: true',
  'credentialValuesRead: true',
  'credentialValuesExposed: true',
  'credentialPresenceChecked: true',
  'credentialPresenceResultExposed: true',
  'liveCheckAllowed: true',
  'liveCheckPerformed: true',
  'liveCheckResultExposed: true',
  'uploadCommandGenerated: true',
  'uploadCommandMaterialized: true',
  'uploadCommandExposed: true',
  'uploadCommand: {',
  'uploadCommand: \'',
  'uploadCommand: "',
  'uploadApproved: true',
  'uploadExecutionAllowed: true',
  'mutationApprovalGranted: true',
  'artifactBytesProvided: true',
  'artifactObjectStoreBound: true',
  'metadataIndexBound: true',
  'objectStoreHandleExposed: true',
  'metadataIndexHandleExposed: true',
  'objectWriteAllowed: true',
  'metadataIndexWriteAllowed: true',
  'objectWriteAttempted: true',
  'metadataIndexWriteAttempted: true',
  'writeTokenIssued: true',
  'executionLeaseCreated: true',
  'rollbackPlanCreated: true',
  'auditRecordCreated: true',
  'remoteMutationPerformed: true',
  'executable: true'
];

const FORBIDDEN_EXECUTION_APPROVAL_REQUEST_EXECUTION = [
  'createMockKnowledgeTeamBackendAdapter(',
  'createClient(',
  'new S3',
  'new Client',
  'putObject(',
  'putEntry(',
  'artifactStore.put',
  'metadataIndex.put',
  'readFile(',
  'createReadStream(',
  'process.env[',
  'process.env.',
  'fetch(',
  'node:http',
  'node:https',
  'node:net',
  'node:tls',
  'clientCreated: true',
  'sdkClientCreated: true',
  'adapterInjected: true',
  'credentialValuesRead: true',
  'credentialValuesExposed: true',
  'credentialPresenceChecked: true',
  'credentialPresenceResultExposed: true',
  'liveCheckAllowed: true',
  'liveCheckPerformed: true',
  'liveCheckResultExposed: true',
  'uploadCommandGenerated: true',
  'uploadCommandMaterialized: true',
  'uploadCommandExposed: true',
  'uploadCommand: {',
  'uploadCommand: \'',
  'uploadCommand: "',
  'uploadApproved: true',
  'uploadExecutionApproved: true',
  'uploadExecutionAllowed: true',
  'mutationApprovalGranted: true',
  'humanApprovalRecorded: true',
  'approvalGranted: true',
  'fingerprintVerified: true',
  'artifactBytesProvided: true',
  'artifactObjectStoreBound: true',
  'metadataIndexBound: true',
  'objectStoreHandleExposed: true',
  'metadataIndexHandleExposed: true',
  'objectWriteAllowed: true',
  'metadataIndexWriteAllowed: true',
  'objectWriteAttempted: true',
  'metadataIndexWriteAttempted: true',
  'writeTokenIssued: true',
  'executionLeaseCreated: true',
  'rollbackPlanCreated: true',
  'auditRecordCreated: true',
  'remoteMutationPerformed: true',
  'executable: true'
];

const FORBIDDEN_EXECUTION_APPROVAL_RECORD_EXECUTION = [
  'createMockKnowledgeTeamBackendAdapter(',
  'createClient(',
  'new S3',
  'new Client',
  'putObject(',
  'putEntry(',
  'artifactStore.put',
  'metadataIndex.put',
  'readFile(',
  'createReadStream(',
  'process.env[',
  'process.env.',
  'fetch(',
  'node:http',
  'node:https',
  'node:net',
  'node:tls',
  'clientCreated: true',
  'sdkClientCreated: true',
  'adapterInjected: true',
  'credentialValuesRead: true',
  'credentialValuesExposed: true',
  'credentialPresenceChecked: true',
  'credentialPresenceResultExposed: true',
  'liveCheckAllowed: true',
  'liveCheckPerformed: true',
  'liveCheckResultExposed: true',
  'uploadCommandGenerated: true',
  'uploadCommandMaterialized: true',
  'uploadCommandExposed: true',
  'uploadCommand: {',
  'uploadCommand: \'',
  'uploadCommand: "',
  'uploadApproved: true',
  'uploadExecutionApproved: true',
  'uploadExecutionAllowed: true',
  'mutationApprovalGranted: true',
  'approvalGranted: true',
  'artifactBytesProvided: true',
  'artifactObjectStoreBound: true',
  'metadataIndexBound: true',
  'objectStoreHandleExposed: true',
  'metadataIndexHandleExposed: true',
  'objectWriteAllowed: true',
  'metadataIndexWriteAllowed: true',
  'objectWriteAttempted: true',
  'metadataIndexWriteAttempted: true',
  'writeTokenIssued: true',
  'executionLeaseCreated: true',
  'rollbackPlanCreated: true',
  'auditRecordCreated: true',
  'remoteMutationPerformed: true',
  'executable: true'
];

const FORBIDDEN_EXECUTION_AUTHORIZATION_BOUNDARY_EXECUTION = [
  ...FORBIDDEN_EXECUTION_APPROVAL_RECORD_EXECUTION,
  'authorizationGranted: true',
  'executionAuthorizationGranted: true',
  'executionAuthorizationMaterialized: true',
  'uploadExecutionAuthorized: true',
  'objectWriteAllowed: true',
  'metadataIndexWriteAllowed: true',
  'uploadCommand: {',
  'uploadCommand: \'',
  'uploadCommand: "',
  'fetch('
];

const FORBIDDEN_EXECUTION_PLAN_RULES_REVIEW_EXECUTION = [
  ...FORBIDDEN_EXECUTION_AUTHORIZATION_BOUNDARY_EXECUTION,
  'authorizationGranted: true',
  'executionAuthorizationGranted: true',
  'uploadExecutionAuthorized: true',
  'uploadExecutionAllowed: true',
  'objectWriteAllowed: true',
  'metadataIndexWriteAllowed: true',
  'remoteMutationPerformed: true',
  'executable: true',
  'planRulesUpdated: true',
  'rulesUpdateReviewed: true',
  'uploadCommand: {',
  'uploadCommand: \'',
  'uploadCommand: "',
  'process.env[',
  'process.env.',
  'readFile(',
  'createReadStream(',
  'fetch(',
  'node:http',
  'node:https',
  'putObject(',
  'putEntry('
];

const FORBIDDEN_EXECUTION_PLAN_RULES_UPDATE_RECORD_EXECUTION = [
  'createMockKnowledgeTeamBackendAdapter(',
  'createClient(',
  'new S3',
  'new Client',
  'putObject(',
  'putEntry(',
  'artifactStore.put',
  'metadataIndex.put',
  'readFile(',
  'createReadStream(',
  'process.env[',
  'process.env.',
  'fetch(',
  'node:http',
  'node:https',
  'node:net',
  'node:tls',
  'clientCreated: true',
  'sdkClientCreated: true',
  'adapterInjected: true',
  'credentialValuesRead: true',
  'credentialValuesExposed: true',
  'credentialPresenceChecked: true',
  'credentialPresenceResultExposed: true',
  'liveCheckAllowed: true',
  'liveCheckPerformed: true',
  'liveCheckResultExposed: true',
  'uploadCommandGenerated: true',
  'uploadCommandMaterialized: true',
  'uploadCommandExposed: true',
  'uploadCommand: {',
  'uploadCommand: \'',
  'uploadCommand: "',
  'uploadApproved: true',
  'uploadExecutionApproved: true',
  'uploadExecutionAllowed: true',
  'mutationApprovalGranted: true',
  'approvalGranted: true',
  'authorizationGranted: true',
  'executionAuthorizationGranted: true',
  'uploadExecutionAuthorized: true',
  'policyUpdateAuthorized: true',
  'artifactBytesProvided: true',
  'artifactObjectStoreBound: true',
  'metadataIndexBound: true',
  'objectStoreHandleExposed: true',
  'metadataIndexHandleExposed: true',
  'objectWriteAllowed: true',
  'metadataIndexWriteAllowed: true',
  'objectWriteAttempted: true',
  'metadataIndexWriteAttempted: true',
  'writeTokenIssued: true',
  'executionLeaseCreated: true',
  'rollbackPlanCreated: true',
  'auditRecordCreated: true',
  'remoteMutationPerformed: true',
  'executable: true',
  'planRulesUpdated: true'
];

const FORBIDDEN_EXECUTION_IMPLEMENTATION_BOUNDARY_EXECUTION = [
  ...FORBIDDEN_EXECUTION_PLAN_RULES_UPDATE_RECORD_EXECUTION,
  'implementationAllowed: true',
  'implementationBoundaryDesigned: true',
  'sourceUpdateRecordFingerprintVerified: true',
  'uploadExecutionAllowed: true',
  'authorizationGranted: true',
  'executionAuthorizationGranted: true',
  'uploadCommand: {',
  'uploadCommand: \'',
  'uploadCommand: "',
  'process.env[',
  'process.env.',
  'readFile(',
  'createReadStream(',
  'fetch(',
  'node:http',
  'node:https',
  'putObject(',
  'putEntry('
];

const FORBIDDEN_EXECUTION_RUNTIME_BOUNDARIES_EXECUTION = [
  ...FORBIDDEN_EXECUTION_IMPLEMENTATION_BOUNDARY_EXECUTION,
  'runtimeExecutionAllowed: true',
  'runtimeBoundariesDesigned: true',
  'sourceImplementationBoundaryFingerprintVerified: true',
  'createMockKnowledgeTeamBackendAdapter(',
  'createClient(',
  'new S3',
  'new Client',
  'process.env[',
  'process.env.',
  'readFile(',
  'createReadStream(',
  'fetch(',
  'node:http',
  'node:https',
  'putObject(',
  'putEntry('
];

const FORBIDDEN_EXECUTION_RUNTIME_BOUNDARY_POLICY_REVIEW_EXECUTION = [
  ...FORBIDDEN_EXECUTION_RUNTIME_BOUNDARIES_EXECUTION,
  'runtimeBoundaryPolicyUpdated: true',
  'policyUpdateAuthorized: true',
  'uploadExecutionAllowed: true',
  'runtimeExecutionAllowed: true',
  'objectWriteAllowed: true',
  'metadataIndexWriteAllowed: true',
  'remoteMutationPerformed: true',
  'executable: true',
  'uploadCommand: {',
  'uploadCommand: \'',
  'uploadCommand: "',
  'process.env[',
  'process.env.',
  'readFile(',
  'createReadStream(',
  'fetch(',
  'node:http',
  'node:https',
  'putObject(',
  'putEntry('
];

test('team backend contract modules do not import cloud SDK or network clients', async () => {
  const root = process.cwd();

  for (const relativePath of TEAM_BACKEND_MODULES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    for (const forbidden of FORBIDDEN_SDK_IMPORTS) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not import ${forbidden}`
      );
    }
  }
});

test('team backend contract modules do not read runtime credential environment values', async () => {
  const root = process.cwd();

  for (const relativePath of TEAM_BACKEND_MODULES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    for (const forbidden of FORBIDDEN_RUNTIME_CREDENTIAL_READS) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not read runtime credentials via ${forbidden}`
      );
    }
  }
});

test('artifact bytes boundary does not read or materialize artifact bytes', async () => {
  const root = process.cwd();

  for (const relativePath of ARTIFACT_BYTE_BOUNDARY_MODULES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    for (const forbidden of FORBIDDEN_ARTIFACT_BYTE_READS) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not read or materialize artifact bytes via ${forbidden}`
      );
    }
  }
});

test('adapter injection boundary does not instantiate adapters, clients, or writes', async () => {
  const root = process.cwd();

  for (const relativePath of ADAPTER_INJECTION_BOUNDARY_MODULES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    for (const forbidden of FORBIDDEN_ADAPTER_INJECTION_EXECUTION) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not instantiate adapters, create clients, or write via ${forbidden}`
      );
    }
  }
});

test('client creation boundary does not instantiate SDK clients, adapters, reads, or writes', async () => {
  const root = process.cwd();

  for (const relativePath of CLIENT_CREATION_BOUNDARY_MODULES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    for (const forbidden of FORBIDDEN_CLIENT_CREATION_EXECUTION) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not instantiate clients, adapters, read bytes, perform checks, or write via ${forbidden}`
      );
    }
  }
});

test('credential read boundary does not read credentials, instantiate clients, or write', async () => {
  const root = process.cwd();

  for (const relativePath of CREDENTIAL_READ_BOUNDARY_MODULES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    for (const forbidden of FORBIDDEN_CREDENTIAL_READ_EXECUTION) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not read credentials, instantiate clients, perform checks, or write via ${forbidden}`
      );
    }
  }
});

test('credential presence boundary does not check credentials, instantiate clients, or write', async () => {
  const root = process.cwd();

  for (const relativePath of CREDENTIAL_PRESENCE_BOUNDARY_MODULES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    for (const forbidden of FORBIDDEN_CREDENTIAL_PRESENCE_EXECUTION) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not check credentials, instantiate clients, perform live checks, or write via ${forbidden}`
      );
    }
  }
});

test('live check boundary does not probe remotes, instantiate clients, or write', async () => {
  const root = process.cwd();

  for (const relativePath of LIVE_CHECK_BOUNDARY_MODULES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    for (const forbidden of FORBIDDEN_LIVE_CHECK_EXECUTION) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not probe remotes, instantiate clients, read credentials, or write via ${forbidden}`
      );
    }
  }
});

test('upload command boundary does not generate commands, instantiate clients, read credentials, or write', async () => {
  const root = process.cwd();

  for (const relativePath of COMMAND_BOUNDARY_MODULES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    for (const forbidden of FORBIDDEN_COMMAND_BOUNDARY_EXECUTION) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not generate commands, instantiate clients, read credentials, perform checks, or write via ${forbidden}`
      );
    }
  }
});

test('object/index binding boundary does not bind stores, instantiate clients, read credentials, generate commands, or write', async () => {
  const root = process.cwd();

  for (const relativePath of OBJECT_INDEX_BINDING_BOUNDARY_MODULES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    for (const forbidden of FORBIDDEN_OBJECT_INDEX_BINDING_EXECUTION) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not bind stores, instantiate clients, read credentials, generate commands, perform checks, or write via ${forbidden}`
      );
    }
  }
});

test('upload execution readiness boundary does not approve execution, instantiate clients, read credentials, generate commands, or write', async () => {
  const root = process.cwd();

  for (const relativePath of EXECUTION_READINESS_BOUNDARY_MODULES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    for (const forbidden of FORBIDDEN_EXECUTION_READINESS_EXECUTION) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not approve execution, instantiate clients, read credentials, generate commands, perform checks, or write via ${forbidden}`
      );
    }
  }
});

test('upload execution approval request does not grant approval, instantiate clients, read credentials, generate commands, or write', async () => {
  const root = process.cwd();

  for (const relativePath of EXECUTION_APPROVAL_REQUEST_MODULES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    for (const forbidden of FORBIDDEN_EXECUTION_APPROVAL_REQUEST_EXECUTION) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not grant approval, instantiate clients, read credentials, generate commands, perform checks, or write via ${forbidden}`
      );
    }
  }
});

test('upload execution approval record does not grant execution, instantiate clients, read credentials, generate commands, or write', async () => {
  const root = process.cwd();

  for (const relativePath of EXECUTION_APPROVAL_RECORD_MODULES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    for (const forbidden of FORBIDDEN_EXECUTION_APPROVAL_RECORD_EXECUTION) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not grant execution, instantiate clients, read credentials, generate commands, perform checks, or write via ${forbidden}`
      );
    }
  }
});

test('upload execution authorization boundary does not grant authorization, instantiate clients, read credentials, generate commands, or write', async () => {
  const root = process.cwd();

  for (const relativePath of EXECUTION_AUTHORIZATION_BOUNDARY_MODULES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    for (const forbidden of FORBIDDEN_EXECUTION_AUTHORIZATION_BOUNDARY_EXECUTION) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not grant authorization, instantiate clients, read credentials, generate commands, perform checks, or write via ${forbidden}`
      );
    }
  }
});

test('upload execution plan/rules review does not update rules, grant authorization, instantiate clients, read credentials, generate commands, or write', async () => {
  const root = process.cwd();

  for (const relativePath of EXECUTION_PLAN_RULES_REVIEW_MODULES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    for (const forbidden of FORBIDDEN_EXECUTION_PLAN_RULES_REVIEW_EXECUTION) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not update rules, grant authorization, instantiate clients, read credentials, generate commands, perform checks, or write via ${forbidden}`
      );
    }
  }
});

test('upload execution plan/rules update record does not grant policy or execution, instantiate clients, read credentials, generate commands, or write', async () => {
  const root = process.cwd();

  for (const relativePath of EXECUTION_PLAN_RULES_UPDATE_RECORD_MODULES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    for (const forbidden of FORBIDDEN_EXECUTION_PLAN_RULES_UPDATE_RECORD_EXECUTION) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not grant policy or execution, instantiate clients, read credentials, generate commands, perform checks, or write via ${forbidden}`
      );
    }
  }
});

test('upload execution implementation boundary does not grant implementation or execution, instantiate clients, read credentials, generate commands, or write', async () => {
  const root = process.cwd();

  for (const relativePath of EXECUTION_IMPLEMENTATION_BOUNDARY_MODULES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    for (const forbidden of FORBIDDEN_EXECUTION_IMPLEMENTATION_BOUNDARY_EXECUTION) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not grant implementation or execution, instantiate clients, read credentials, generate commands, perform checks, or write via ${forbidden}`
      );
    }
  }
});

test('upload execution runtime boundaries do not grant runtime execution, instantiate clients, read credentials, generate commands, or write', async () => {
  const root = process.cwd();

  for (const relativePath of EXECUTION_RUNTIME_BOUNDARIES_MODULES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    for (const forbidden of FORBIDDEN_EXECUTION_RUNTIME_BOUNDARIES_EXECUTION) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not grant runtime execution, instantiate clients, read credentials, generate commands, perform checks, or write via ${forbidden}`
      );
    }
  }
});

test('upload execution runtime-boundary policy review does not update policy, grant execution, instantiate clients, read credentials, generate commands, or write', async () => {
  const root = process.cwd();

  for (const relativePath of EXECUTION_RUNTIME_BOUNDARY_POLICY_REVIEW_MODULES) {
    const source = await readFile(join(root, relativePath), 'utf8');
    for (const forbidden of FORBIDDEN_EXECUTION_RUNTIME_BOUNDARY_POLICY_REVIEW_EXECUTION) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${relativePath} must not update policy, grant runtime execution, instantiate clients, read credentials, generate commands, perform checks, or write via ${forbidden}`
      );
    }
  }
});
