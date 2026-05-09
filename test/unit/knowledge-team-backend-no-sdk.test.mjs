import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const TEAM_BACKEND_MODULES = [
  'src/knowledge/team-backend-adapter.ts',
  'src/knowledge/team-backend-adapter-mock.ts',
  'src/knowledge/team-backend-adapter-resolver.ts',
  'src/knowledge/team-backend-readiness.ts',
  'src/knowledge/team-s3-compatible-backend-config.ts'
];

const FORBIDDEN_SDK_IMPORTS = [
  '@aws-sdk/',
  'aws-sdk',
  '@google-cloud/storage',
  '@azure/storage-blob'
];

test('team backend contract modules do not import cloud SDK clients', async () => {
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
