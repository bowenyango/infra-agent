import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

import { parseArgs } from '../../src/cli/main.ts';

function assertKnowledgeArgsRejected(args) {
  const script = [
    "import { parseArgs } from './src/cli/main.ts';",
    `parseArgs(${JSON.stringify(['knowledge', ...args])});`
  ].join(' ');
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    '--input-type=module',
    '-e',
    script
  ], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  assert.equal(result.status, 1);
}

test('knowledge library-catalog CLI args accept facet browse flags', () => {
  const parsed = parseArgs([
    'knowledge',
    'library-catalog',
    'artifacts/public-library-registry.json',
    '--facets',
    '--facet-limit',
    '3',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'library-catalog');
  assert.equal(parsed.inputPath, 'artifacts/public-library-registry.json');
  assert.equal(parsed.publicLibraryCatalogFacets, true);
  assert.equal(parsed.publicLibraryCatalogFacetLimit, 3);
  assert.equal(parsed.json, true);

  const reversed = parseArgs([
    'knowledge',
    'library-catalog',
    'artifacts/public-library-registry.json',
    '--facet-limit',
    '4',
    '--facets',
    '--json'
  ]);

  assert.equal(reversed.publicLibraryCatalogFacets, true);
  assert.equal(reversed.publicLibraryCatalogFacetLimit, 4);
});

test('knowledge library-catalog CLI args reject facet flags outside catalog', () => {
  assertKnowledgeArgsRejected([
    'library-download',
    'knowledge/public-library-registry.json',
    '--workspace',
    'fixtures/sample-workspace',
    '--store-dir',
    'knowledge/downloaded-public-library',
    '--facets'
  ]);
  assertKnowledgeArgsRejected([
    'index',
    'fixtures/sample-workspace',
    '--facets'
  ]);
  assertKnowledgeArgsRejected([
    'library-download',
    'knowledge/public-library-registry.json',
    '--workspace',
    'fixtures/sample-workspace',
    '--store-dir',
    'knowledge/downloaded-public-library',
    '--facet-limit',
    '2'
  ]);
  assertKnowledgeArgsRejected([
    'index',
    'fixtures/sample-workspace',
    '--facet-limit',
    '2'
  ]);
  assertKnowledgeArgsRejected([
    'library-catalog',
    'artifacts/public-library-registry.json',
    '--facet-limit',
    '0'
  ]);
  assertKnowledgeArgsRejected([
    'library-catalog',
    'artifacts/public-library-registry.json',
    '--facet-limit',
    '2'
  ]);
});
