import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertNoTeamArtifactContractLeaks,
  buildKnowledgeTeamArtifactContractFixture
} from '../support/knowledge-team-artifact-fixtures.mjs';
import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';

function assertValidPayload(payload, expectedKind) {
  const report = validateKnowledgePayload(payload, 'inline');
  assert.equal(report.inputKind, expectedKind);
  assert.equal(report.valid, true);
  assert.equal(report.issueCount, 0);
  assertNoTeamArtifactContractLeaks(payload);
  return report;
}

function assertInvalidPayload(payload, expectedPaths) {
  const report = validateKnowledgePayload(payload, 'inline');
  assert.equal(report.valid, false);
  for (const expectedPath of expectedPaths) {
    assert.ok(
      report.issues.some(issue => issue.path === expectedPath),
      `expected issue for ${expectedPath}`
    );
  }
  return report;
}

test('team artifact descriptor contract accepts compact generated descriptors', async () => {
  const fixture = await buildKnowledgeTeamArtifactContractFixture();

  assert.ok(fixture.descriptor);
  const report = assertValidPayload(
    fixture.descriptor,
    'infra-agent.knowledge-team-artifact-descriptor'
  );

  assert.equal(report.factCount, 1);
  assert.equal(report.staleSourceCount, 0);
  assert.equal(fixture.descriptor.mutationAllowed, false);
  assert.equal(fixture.descriptor.backendKind, 'mock-s3-compatible');
  assert.match(fixture.descriptor.object.key, /^knowledge-artifacts\/v1\/knowledge-pack\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.json$/);
  assert.equal(fixture.descriptor.object.sha256.length, 64);
  assert.equal(fixture.descriptor.publication.blockedSourceCount, 0);
});

test('team artifact descriptor contract rejects mutation and backend detail drift', async () => {
  const fixture = await buildKnowledgeTeamArtifactContractFixture();

  assert.ok(fixture.descriptor);
  assertInvalidPayload({
    ...fixture.descriptor,
    mutationAllowed: true,
    backendKind: 's3',
    bucket: 'private-team-cache',
    endpointUrl: 'https://s3.example.test/private',
    accessToken: 'secret-token'
  }, [
    '$.mutationAllowed',
    '$.backendKind',
    '$.bucket',
    '$.endpointUrl',
    '$.accessToken'
  ]);
});

test('team artifact descriptor contract rejects content address and raw payload drift', async () => {
  const fixture = await buildKnowledgeTeamArtifactContractFixture();

  assert.ok(fixture.descriptor);
  assertInvalidPayload({
    ...fixture.descriptor,
    workspaceRoot: '/workspace/private-project',
    cacheRoot: '/home/user/.cache/infra-agent',
    facts: [{
      summary: 'Container image repository.'
    }],
    object: {
      ...fixture.descriptor.object,
      key: `knowledge-artifacts/v1/knowledge-pack/sha256/ff/${'f'.repeat(64)}.json`
    }
  }, [
    '$.workspaceRoot',
    '$.cacheRoot',
    '$.facts',
    '$.object.key'
  ]);
});
