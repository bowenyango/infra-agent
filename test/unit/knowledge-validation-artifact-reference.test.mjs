import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  validateKnowledgeArtifactReference
} from '../../src/knowledge/validation-artifact-reference.ts';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function validationReport(input) {
  return {
    kind: 'infra-agent.knowledge-validation',
    schemaVersion: 1,
    mutationAllowed: false,
    inputPath: input.inputPath,
    inputKind: input.inputKind,
    valid: input.issues.length === 0,
    factSetCount: input.factSetCount ?? 0,
    factCount: input.factCount ?? 0,
    staleSourceCount: input.staleSourceCount ?? 0,
    uncheckedLocalSourceCount: input.uncheckedLocalSourceCount ?? 0,
    freshness: {
      kind: 'infra-agent.knowledge-freshness-summary',
      schemaVersion: 1,
      mutationAllowed: false,
      staleSourceCount: input.staleSourceCount ?? 0,
      uncheckedLocalSourceCount: input.uncheckedLocalSourceCount ?? 0,
      staleFactCount: 0,
      uncheckedFactCount: 0,
      staleSources: [],
      uncheckedLocalSources: []
    },
    issueCount: input.issues.length,
    issues: input.issues
  };
}

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'infra-agent-artifact-reference-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('knowledge artifact reference validation ignores incomplete manifest references', async () => {
  const issues = [];
  const validatePayload = () => validationReport({
    inputPath: 'unused',
    inputKind: 'unused',
    issues: []
  });

  assert.deepEqual(await validateKnowledgeArtifactReference({}, 'manifest.json', {}, issues, validatePayload), {});
  assert.deepEqual(await validateKnowledgeArtifactReference({
    artifact: { path: '', sha256: 'not-a-sha' }
  }, 'manifest.json', {}, issues, validatePayload), {});
  assert.deepEqual(issues, []);
});

test('knowledge artifact reference validation reports unreadable and unparsable artifacts', async () => {
  await withTempDir(async dir => {
    const manifestPath = join(dir, 'manifest.json');
    const issues = [];
    const validatePayload = () => validationReport({
      inputPath: 'unused',
      inputKind: 'unused',
      issues: []
    });

    await validateKnowledgeArtifactReference({
      artifact: {
        path: 'missing.json',
        sha256: 'a'.repeat(64)
      }
    }, manifestPath, {}, issues, validatePayload);
    assert.equal(issues.some(issue => issue.path === '$.artifact.path'), true);

    const badJsonPath = join(dir, 'bad.json');
    const badJson = '{not json';
    await writeFile(badJsonPath, badJson);
    await validateKnowledgeArtifactReference({
      artifact: {
        path: 'bad.json',
        sha256: sha256(badJson)
      }
    }, manifestPath, {}, issues, validatePayload);
    assert.equal(issues.filter(issue => issue.path === '$.artifact.path').length, 2);
  });
});

test('knowledge artifact reference validation prefixes payload issues and reports pack metadata drift', async () => {
  await withTempDir(async dir => {
    const manifestPath = join(dir, 'manifest.json');
    const payload = {
      kind: 'infra-agent.knowledge-pack',
      packId: 'pack-1',
      sourceIds: ['source-a', 'source-b'],
      sourceCount: 2,
      factCount: 5,
      staleSourceCount: 1
    };
    const bytes = JSON.stringify(payload);
    await writeFile(join(dir, 'pack.json'), bytes);
    const issues = [];
    const validatePayload = (artifactPayload, artifactPath) => {
      assert.deepEqual(artifactPayload, payload);
      assert.equal(artifactPath, join(dir, 'pack.json'));
      return validationReport({
        inputPath: artifactPath,
        inputKind: payload.kind,
        factSetCount: 3,
        factCount: 5,
        staleSourceCount: 1,
        uncheckedLocalSourceCount: 2,
        issues: [{ severity: 'error', path: '$.facts[0]', message: 'bad fact' }]
      });
    };

    const overrides = await validateKnowledgeArtifactReference({
      artifact: {
        path: 'pack.json',
        sha256: 'b'.repeat(64),
        kind: 'wrong-kind',
        id: 'wrong-id',
        sourceIds: ['source-b', 'missing'],
        sourceCount: 1,
        factCount: 4,
        staleSourceCount: 0
      }
    }, manifestPath, {}, issues, validatePayload);

    assert.deepEqual(overrides, {
      factSetCount: 3,
      factCount: 5,
      staleSourceCount: 1,
      uncheckedLocalSourceCount: 2
    });
    for (const path of [
      '$.artifact.sha256',
      '$.artifact.payload.facts[0]',
      '$.artifact.kind',
      '$.artifact.id',
      '$.artifact.sourceIds',
      '$.artifact.sourceCount',
      '$.artifact.factCount',
      '$.artifact.staleSourceCount'
    ]) {
      assert.equal(issues.some(issue => issue.path === path), true, path);
    }
  });
});

test('knowledge artifact reference validation derives extraction stats from sources and stale fact sets', async () => {
  await withTempDir(async dir => {
    const payload = {
      kind: 'infra-agent.knowledge-extraction',
      sources: [
        { id: 'source-a' },
        { id: 'source-b' },
        { name: 'ignored' },
        null
      ],
      sourceCount: 2,
      factCount: 7,
      factSets: [
        { sourceId: 'source-a', sourceStale: true },
        { sourceId: 'source-a', sourceStale: true },
        { sourceId: 'source-b', sourceStale: false }
      ]
    };
    const bytes = JSON.stringify(payload);
    const digest = sha256(bytes);
    await writeFile(join(dir, 'extraction.json'), bytes);
    const issues = [];
    const validatePayload = () => validationReport({
      inputPath: join(dir, 'extraction.json'),
      inputKind: payload.kind,
      factSetCount: 2,
      factCount: 7,
      staleSourceCount: 1,
      issues: []
    });

    const overrides = await validateKnowledgeArtifactReference({
      artifact: {
        path: join(dir, 'extraction.json'),
        sha256: digest,
        kind: payload.kind,
        id: digest.slice(0, 24),
        sourceIds: ['source-b', 'source-a'],
        sourceCount: 2,
        factCount: 7,
        staleSourceCount: 1
      }
    }, join(dir, 'manifest.json'), {}, issues, validatePayload);

    assert.equal(issues.length, 0);
    assert.deepEqual(overrides, {
      factSetCount: 2,
      factCount: 7,
      staleSourceCount: 1,
      uncheckedLocalSourceCount: 0
    });
  });
});

test('knowledge artifact reference validation returns payload counts for unknown artifact kinds', async () => {
  await withTempDir(async dir => {
    const payload = { kind: 'infra-agent.unknown-artifact' };
    const bytes = JSON.stringify(payload);
    await writeFile(join(dir, 'unknown.json'), bytes);
    const issues = [];
    const validatePayload = () => validationReport({
      inputPath: join(dir, 'unknown.json'),
      inputKind: payload.kind,
      factSetCount: 1,
      factCount: 2,
      staleSourceCount: 3,
      uncheckedLocalSourceCount: 4,
      issues: []
    });

    const overrides = await validateKnowledgeArtifactReference({
      artifact: {
        path: 'unknown.json',
        sha256: sha256(bytes),
        kind: payload.kind
      }
    }, join(dir, 'manifest.json'), {}, issues, validatePayload);

    assert.equal(issues.length, 0);
    assert.deepEqual(overrides, {
      factSetCount: 1,
      factCount: 2,
      staleSourceCount: 3,
      uncheckedLocalSourceCount: 4
    });
  });
});
