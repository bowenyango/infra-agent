import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertNoTeamArtifactContractLeaks,
  buildBlockedKnowledgeTeamArtifactContractFixture,
  buildKnowledgeTeamArtifactContractFixture
} from '../support/knowledge-team-artifact-fixtures.mjs';
import { buildKnowledgeTeamPublicationReadinessReport } from '../../src/knowledge/team-artifact-store.ts';
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

test('team artifact index entry contract accepts compact generated metadata', async () => {
  const fixture = await buildKnowledgeTeamArtifactContractFixture();

  assert.ok(fixture.indexEntry);
  const report = assertValidPayload(
    fixture.indexEntry,
    'infra-agent.knowledge-team-artifact-index-entry'
  );

  assert.equal(report.factCount, 1);
  assert.equal(report.staleSourceCount, 0);
  assert.equal(fixture.indexEntry.mutationAllowed, false);
  assert.equal(fixture.indexEntry.backendKind, 'mock-s3-compatible');
  assert.equal(fixture.indexEntry.index.source, 'descriptor');
  assert.match(fixture.indexEntry.index.key, /^knowledge-index\/v1\/knowledge-pack\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.json$/);
  assert.match(fixture.indexEntry.object.key, /^knowledge-artifacts\/v1\/knowledge-pack\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}\.json$/);
});

test('team artifact index entry contract rejects index and object drift', async () => {
  const fixture = await buildKnowledgeTeamArtifactContractFixture();

  assert.ok(fixture.indexEntry);
  assertInvalidPayload({
    ...fixture.indexEntry,
    index: {
      ...fixture.indexEntry.index,
      key: `knowledge-index/v1/knowledge-pack/sha256/ff/${'f'.repeat(64)}.json`
    },
    object: {
      ...fixture.indexEntry.object,
      key: `knowledge-artifacts/v1/knowledge-pack/sha256/ee/${'e'.repeat(64)}.json`
    },
    sources: [{
      id: 'raw-source'
    }],
    endpointUrl: 'https://s3.example.test/private'
  }, [
    '$.index.key',
    '$.object.key',
    '$.sources',
    '$.endpointUrl'
  ]);
});

test('team publication readiness contract accepts all generated statuses', async () => {
  const allowedFixture = await buildKnowledgeTeamArtifactContractFixture();
  const blockedFixture = await buildBlockedKnowledgeTeamArtifactContractFixture();

  assert.ok(allowedFixture.indexEntry);
  assert.ok(allowedFixture.alreadyPublishedReadiness);

  const conflictReadiness = buildKnowledgeTeamPublicationReadinessReport({
    plan: allowedFixture.publicationPlan,
    indexEntry: {
      ...allowedFixture.indexEntry,
      object: {
        ...allowedFixture.indexEntry.object,
        byteLength: allowedFixture.indexEntry.object.byteLength + 1
      }
    }
  });
  const reports = [
    allowedFixture.uploadRequiredReadiness,
    allowedFixture.alreadyPublishedReadiness,
    blockedFixture.uploadRequiredReadiness,
    conflictReadiness
  ].map(readiness =>
    assertValidPayload(readiness, 'infra-agent.knowledge-team-publication-readiness')
  );

  assert.deepEqual(reports.map(report => report.factCount), [1, 1, 1, 1]);
  assert.equal(allowedFixture.uploadRequiredReadiness.readiness.status, 'upload-required');
  assert.equal(allowedFixture.uploadRequiredReadiness.readiness.nextAction, 'prepare-explicit-upload');
  assert.equal(allowedFixture.alreadyPublishedReadiness.readiness.status, 'already-published');
  assert.equal(allowedFixture.alreadyPublishedReadiness.readiness.nextAction, 'none');
  assert.equal(blockedFixture.uploadRequiredReadiness.readiness.status, 'blocked');
  assert.equal(blockedFixture.uploadRequiredReadiness.readiness.nextAction, 'resolve-blockers');
  assert.equal(conflictReadiness.readiness.status, 'conflict');
  assert.equal(conflictReadiness.readiness.nextAction, 'review-index-conflict');
});

test('team publication readiness contract rejects status and blocker drift', async () => {
  const fixture = await buildKnowledgeTeamArtifactContractFixture();

  assertInvalidPayload({
    ...fixture.uploadRequiredReadiness,
    readiness: {
      ...fixture.uploadRequiredReadiness.readiness,
      nextAction: 'none',
      blockerCodes: ['index-object-mismatch']
    },
    object: {
      ...fixture.uploadRequiredReadiness.object,
      key: `knowledge-artifacts/v1/knowledge-pack/sha256/dd/${'d'.repeat(64)}.json`
    },
    cacheRoot: '/home/user/.cache/infra-agent'
  }, [
    '$.readiness.nextAction',
    '$.readiness.blockerCodes',
    '$.object.key',
    '$.cacheRoot'
  ]);
});
