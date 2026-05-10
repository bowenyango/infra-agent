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
  'src/knowledge/team-upload-mutation-plan.ts',
  'src/knowledge/team-upload-mutation-approval-review.ts',
  'src/knowledge/team-upload-approval-validation.ts'
];

const ARTIFACT_BYTE_BOUNDARY_MODULES = [
  'src/knowledge/team-upload-artifact-bytes-boundary.ts',
  'src/knowledge/team-upload-adapter-injection-boundary.ts'
];

const ADAPTER_INJECTION_BOUNDARY_MODULES = [
  'src/knowledge/team-upload-adapter-injection-boundary.ts'
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
