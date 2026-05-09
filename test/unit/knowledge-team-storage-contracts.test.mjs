import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeTeamArtifactObjectKey,
  hashKnowledgeArtifactPayload,
  isKnowledgeTeamArtifactSha256,
  isSafeKnowledgeTeamArtifactObjectKey,
  serializeKnowledgeArtifactPayload
} from '../../src/knowledge/team-artifact-store.ts';

test('knowledge team artifact serialization is canonical for equivalent payloads', () => {
  const left = {
    kind: 'infra-agent.knowledge-pack',
    schemaVersion: 1,
    mutationAllowed: false,
    packId: 'a'.repeat(24),
    nested: {
      z: 1,
      a: ['left', { b: true, a: 'first' }]
    }
  };
  const right = {
    mutationAllowed: false,
    schemaVersion: 1,
    kind: 'infra-agent.knowledge-pack',
    nested: {
      a: ['left', { a: 'first', b: true }],
      z: 1
    },
    packId: 'a'.repeat(24)
  };

  assert.equal(serializeKnowledgeArtifactPayload(left), serializeKnowledgeArtifactPayload(right));
  assert.equal(hashKnowledgeArtifactPayload(left), hashKnowledgeArtifactPayload(right));
  assert.notEqual(
    hashKnowledgeArtifactPayload(left),
    hashKnowledgeArtifactPayload({
      ...right,
      nested: {
        ...right.nested,
        z: 2
      }
    })
  );
});

test('knowledge team artifact object keys are full-sha content addresses', () => {
  const sha256 = 'b'.repeat(64);
  const key = buildKnowledgeTeamArtifactObjectKey({
    artifactKind: 'infra-agent.knowledge-pack',
    sha256
  });

  assert.equal(key, `knowledge-artifacts/v1/knowledge-pack/sha256/bb/${sha256}.json`);
  assert.equal(isKnowledgeTeamArtifactSha256(sha256), true);
  assert.equal(isSafeKnowledgeTeamArtifactObjectKey(key), true);
  assert.equal(key.includes('/home/'), false);
  assert.equal(key.includes('fixtures'), false);
  assert.equal(key.includes('s3://'), false);
  assert.equal(key.includes('bucket'), false);
  assert.equal(key.includes('token'), false);
  assert.throws(
    () => buildKnowledgeTeamArtifactObjectKey({
      artifactKind: 'infra-agent.knowledge-pack',
      sha256: 'not-a-sha'
    }),
    /SHA-256/
  );
});

test('knowledge team artifact object keys reject unsafe remote key shapes', () => {
  assert.equal(isSafeKnowledgeTeamArtifactObjectKey('../pack.json'), false);
  assert.equal(isSafeKnowledgeTeamArtifactObjectKey('/knowledge-artifacts/v1/pack.json'), false);
  assert.equal(isSafeKnowledgeTeamArtifactObjectKey('knowledge-artifacts//pack.json'), false);
  assert.equal(isSafeKnowledgeTeamArtifactObjectKey('knowledge-artifacts\\pack.json'), false);
  assert.equal(isSafeKnowledgeTeamArtifactObjectKey('knowledge-artifacts/pack.json?token=secret'), false);
  assert.equal(isSafeKnowledgeTeamArtifactObjectKey('knowledge-artifacts/pack.json#signed'), false);
});
