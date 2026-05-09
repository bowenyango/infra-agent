import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeTeamArtifactIndexEntryKey,
  buildKnowledgeTeamArtifactObjectKey,
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey
} from '../../src/knowledge/team-artifact-store.ts';

const packSha = 'a'.repeat(64);
const extractionSha = 'b'.repeat(64);

test('team artifact keys are content-addressed by artifact family and sha prefix', () => {
  assert.equal(
    buildKnowledgeTeamArtifactObjectKey({
      artifactKind: 'infra-agent.knowledge-pack',
      sha256: packSha
    }),
    `knowledge-artifacts/v1/knowledge-pack/sha256/aa/${packSha}.json`
  );
  assert.equal(
    buildKnowledgeTeamArtifactIndexEntryKey({
      artifactKind: 'infra-agent.knowledge-pack',
      sha256: packSha
    }),
    `knowledge-index/v1/knowledge-pack/sha256/aa/${packSha}.json`
  );
  assert.equal(
    buildKnowledgeTeamArtifactObjectKey({
      artifactKind: 'infra-agent.knowledge-extraction',
      sha256: extractionSha
    }),
    `knowledge-artifacts/v1/knowledge-extraction/sha256/bb/${extractionSha}.json`
  );
});

test('team artifact keys reject non-sha digests before key construction', () => {
  assert.equal(isKnowledgeTeamArtifactSha256(packSha), true);
  assert.equal(isKnowledgeTeamArtifactSha256('A'.repeat(64)), false);
  assert.equal(isKnowledgeTeamArtifactSha256('a'.repeat(63)), false);
  assert.throws(
    () => buildKnowledgeTeamArtifactObjectKey({
      artifactKind: 'infra-agent.knowledge-pack',
      sha256: '../pack'
    }),
    /SHA-256 hex digest/
  );
});

test('team artifact key safety blocks path escapes and backend URL shapes', () => {
  assert.equal(isSafeKnowledgeTeamArtifactObjectKey(`knowledge-artifacts/v1/knowledge-pack/sha256/aa/${packSha}.json`), true);
  for (const unsafeKey of [
    '/knowledge-artifacts/v1/pack.json',
    'knowledge-artifacts//v1/pack.json',
    'knowledge-artifacts/v1/../pack.json',
    'knowledge-artifacts\\v1\\pack.json',
    'knowledge-artifacts/v1/pack.json?token=secret',
    'knowledge-artifacts/v1/pack.json#fragment'
  ]) {
    assert.equal(isSafeKnowledgeTeamArtifactObjectKey(unsafeKey), false, unsafeKey);
  }
});
