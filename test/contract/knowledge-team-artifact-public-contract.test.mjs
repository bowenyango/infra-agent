import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertNoTeamArtifactContractLeaks,
  buildBlockedKnowledgeTeamArtifactContractFixture,
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

test('team publication plan contract accepts allowed and blocked compact plans', async () => {
  const allowedFixture = await buildKnowledgeTeamArtifactContractFixture();
  const blockedFixture = await buildBlockedKnowledgeTeamArtifactContractFixture();

  const allowedReport = assertValidPayload(
    allowedFixture.publicationPlan,
    'infra-agent.knowledge-team-publication-plan'
  );
  const blockedReport = assertValidPayload(
    blockedFixture.publicationPlan,
    'infra-agent.knowledge-team-publication-plan'
  );

  assert.equal(allowedReport.factCount, 1);
  assert.equal(blockedReport.factCount, 1);
  assert.equal(allowedFixture.publicationPlan.publication.allowed, true);
  assert.equal(allowedFixture.publicationPlan.publication.blockerCount, 0);
  assert.deepEqual(allowedFixture.publicationPlan.publication.blockerCodes, []);
  assert.equal(blockedFixture.publicationPlan.publication.allowed, false);
  assert.ok(blockedFixture.publicationPlan.publication.blockerCodes.includes('workspace-private-source'));
  assert.ok(blockedFixture.publicationPlan.publication.blockerCodes.includes('stale-source'));
  assert.ok(blockedFixture.publicationPlan.publication.blockerCodes.includes('unchecked-source'));
});

test('team publication plan contract rejects remote write and summary drift', async () => {
  const fixture = await buildKnowledgeTeamArtifactContractFixture();

  assertInvalidPayload({
    ...fixture.publicationPlan,
    remoteWriteAllowed: true,
    credentialRequired: true,
    uploadCommand: 'aws s3 cp pack.json s3://private-bucket',
    object: {
      ...fixture.publicationPlan.object,
      key: `knowledge-artifacts/v1/knowledge-pack/sha256/ff/${'f'.repeat(64)}.json`
    },
    publication: {
      ...fixture.publicationPlan.publication,
      blockerCodes: ['stale-source']
    },
    workspaceRoot: '/workspace/private-project'
  }, [
    '$.remoteWriteAllowed',
    '$.credentialRequired',
    '$.uploadCommand',
    '$.object.key',
    '$.publication.blockerCodes',
    '$.workspaceRoot'
  ]);
});
