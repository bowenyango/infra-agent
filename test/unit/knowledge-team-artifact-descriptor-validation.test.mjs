import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeTeamArtifactObjectKey
} from '../../src/knowledge/team-artifact-store.ts';
import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';

function buildDescriptor(overrides = {}) {
  const sha256 = 'a'.repeat(64);
  return {
    kind: 'infra-agent.knowledge-team-artifact-descriptor',
    schemaVersion: 1,
    mutationAllowed: false,
    backendKind: 'mock-s3-compatible',
    manifestId: 'b'.repeat(24),
    object: {
      key: buildKnowledgeTeamArtifactObjectKey({
        artifactKind: 'infra-agent.knowledge-pack',
        sha256
      }),
      sha256,
      byteLength: 42,
      contentType: 'application/json'
    },
    artifact: {
      kind: 'infra-agent.knowledge-pack',
      id: 'c'.repeat(24),
      sourceCount: 1,
      factCount: 2,
      staleSourceCount: 0,
      storagePolicy: {
        publicReference: 1,
        workspacePrivate: 0,
        shareableByDefault: 1,
        explicitOptInRequired: 0
      }
    },
    publication: {
      shareableByDefault: true,
      requiresExplicitOptIn: false,
      publishableByDefaultSourceCount: 1,
      blockedSourceCount: 0,
      requiredValidationCount: 1,
      reason: 'Artifact contains public-reference knowledge staged by explicit team cache flow.'
    },
    ...overrides
  };
}

test('knowledge validation accepts compact team artifact descriptors', () => {
  const report = validateKnowledgePayload(buildDescriptor(), 'inline');

  assert.equal(report.inputKind, 'infra-agent.knowledge-team-artifact-descriptor');
  assert.equal(report.valid, true);
  assert.equal(report.factCount, 2);
  assert.equal(report.staleSourceCount, 0);
});

test('knowledge validation rejects unsafe team artifact object keys and backend detail fields', () => {
  const report = validateKnowledgePayload(buildDescriptor({
    object: {
      key: '../private-pack.json',
      sha256: 'a'.repeat(64),
      byteLength: 42,
      contentType: 'application/json'
    },
    bucket: 'private-team-cache',
    endpointUrl: 'https://s3.example.test/private',
    accessToken: 'secret-token'
  }), 'inline');

  assert.equal(report.valid, false);
  assert.ok(report.issues.some(issue => issue.path === '$.object.key'));
  assert.ok(report.issues.some(issue => issue.path === '$.bucket'));
  assert.ok(report.issues.some(issue => issue.path === '$.endpointUrl'));
  assert.ok(report.issues.some(issue => issue.path === '$.accessToken'));
});

test('knowledge validation rejects team artifact descriptors for private or blocked artifacts', () => {
  const report = validateKnowledgePayload(buildDescriptor({
    artifact: {
      kind: 'infra-agent.knowledge-pack',
      id: 'c'.repeat(24),
      sourceCount: 1,
      factCount: 2,
      staleSourceCount: 1,
      storagePolicy: {
        publicReference: 0,
        workspacePrivate: 1,
        shareableByDefault: 0,
        explicitOptInRequired: 1
      }
    },
    publication: {
      shareableByDefault: false,
      requiresExplicitOptIn: true,
      publishableByDefaultSourceCount: 0,
      blockedSourceCount: 1,
      requiredValidationCount: 1,
      reason: 'Artifact requires explicit opt-in.'
    }
  }), 'inline');

  assert.equal(report.valid, false);
  for (const path of [
    '$.artifact.staleSourceCount',
    '$.artifact.storagePolicy.workspacePrivate',
    '$.publication.shareableByDefault',
    '$.publication.requiresExplicitOptIn',
    '$.publication.blockedSourceCount',
    '$.publication.publishableByDefaultSourceCount'
  ]) {
    assert.ok(report.issues.some(issue => issue.path === path), path);
  }
});
