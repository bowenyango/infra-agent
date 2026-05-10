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
  'src/knowledge/team-upload-approval-validation.ts'
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
