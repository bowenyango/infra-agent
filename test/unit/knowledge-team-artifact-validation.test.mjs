import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeTeamArtifactContractFixture
} from '../support/knowledge-team-artifact-fixtures.mjs';
import {
  validateKnowledgeTeamArtifactDescriptorPayload,
  validateKnowledgeTeamArtifactIndexEntryPayload,
  validateKnowledgeTeamPublicationPlanPayload,
  validateKnowledgeTeamPublicationReadinessPayload
} from '../../src/knowledge/team-artifact-validation.ts';

function assertValid(report, inputKind, factCount = 1) {
  assert.equal(report.inputKind, inputKind);
  assert.equal(report.valid, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.factCount, factCount);
}

test('team artifact validation module accepts generated compact artifacts directly', async () => {
  const fixture = await buildKnowledgeTeamArtifactContractFixture();
  assert.notEqual(fixture.descriptor, null);
  assert.notEqual(fixture.indexEntry, null);
  assert.notEqual(fixture.alreadyPublishedReadiness, null);

  assertValid(
    validateKnowledgeTeamArtifactDescriptorPayload(
      fixture.descriptor,
      'inline',
      'infra-agent.knowledge-team-artifact-descriptor'
    ),
    'infra-agent.knowledge-team-artifact-descriptor'
  );
  assertValid(
    validateKnowledgeTeamArtifactIndexEntryPayload(
      fixture.indexEntry,
      'inline',
      'infra-agent.knowledge-team-artifact-index-entry'
    ),
    'infra-agent.knowledge-team-artifact-index-entry'
  );
  assertValid(
    validateKnowledgeTeamPublicationPlanPayload(
      fixture.publicationPlan,
      'inline',
      'infra-agent.knowledge-team-publication-plan'
    ),
    'infra-agent.knowledge-team-publication-plan'
  );
  assertValid(
    validateKnowledgeTeamPublicationReadinessPayload(
      fixture.uploadRequiredReadiness,
      'inline',
      'infra-agent.knowledge-team-publication-readiness'
    ),
    'infra-agent.knowledge-team-publication-readiness'
  );
  assertValid(
    validateKnowledgeTeamPublicationReadinessPayload(
      fixture.alreadyPublishedReadiness,
      'inline',
      'infra-agent.knowledge-team-publication-readiness'
    ),
    'infra-agent.knowledge-team-publication-readiness'
  );
});

test('team artifact validation module rejects leaky or forged team artifacts directly', async () => {
  const fixture = await buildKnowledgeTeamArtifactContractFixture();
  assert.notEqual(fixture.descriptor, null);
  assert.notEqual(fixture.alreadyPublishedReadiness, null);

  const descriptorReport = validateKnowledgeTeamArtifactDescriptorPayload(
    {
      ...fixture.descriptor,
      object: {
        ...fixture.descriptor.object,
        key: '../private-pack.json'
      },
      bucket: 'private-team-cache',
      endpointUrl: 'https://s3.example.test/private'
    },
    'inline',
    'infra-agent.knowledge-team-artifact-descriptor'
  );
  assert.equal(descriptorReport.valid, false);
  for (const path of ['$.object.key', '$.bucket', '$.endpointUrl']) {
    assert.ok(descriptorReport.issues.some(issue => issue.path === path), path);
  }

  const planReport = validateKnowledgeTeamPublicationPlanPayload(
    {
      ...fixture.publicationPlan,
      remoteWriteAllowed: true,
      uploadCommand: 'aws s3 cp pack.json s3://private-bucket'
    },
    'inline',
    'infra-agent.knowledge-team-publication-plan'
  );
  assert.equal(planReport.valid, false);
  for (const path of ['$.remoteWriteAllowed', '$.uploadCommand']) {
    assert.ok(planReport.issues.some(issue => issue.path === path), path);
  }

  const readinessReport = validateKnowledgeTeamPublicationReadinessPayload(
    {
      ...fixture.alreadyPublishedReadiness,
      readiness: {
        ...fixture.alreadyPublishedReadiness.readiness,
        nextAction: 'prepare-explicit-upload',
        blockerCount: 1,
        blockerCodes: ['index-object-mismatch'],
        blockers: [{
          code: 'index-object-mismatch',
          path: '$.indexEntry.objectKey',
          message: 'Index object drift.'
        }]
      }
    },
    'inline',
    'infra-agent.knowledge-team-publication-readiness'
  );
  assert.equal(readinessReport.valid, false);
  for (const path of ['$.readiness.nextAction', '$.readiness.blockers']) {
    assert.ok(readinessReport.issues.some(issue => issue.path === path), path);
  }
});
