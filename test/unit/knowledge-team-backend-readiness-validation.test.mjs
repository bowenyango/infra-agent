import test from 'node:test';
import assert from 'node:assert/strict';
import { validateKnowledgeTeamBackendReadinessPayload } from '../../src/knowledge/team-backend-readiness-validation.ts';

function readyBackendReadiness(overrides = {}) {
  return {
    kind: 'infra-agent.knowledge-team-backend-readiness',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'dry-run',
    remoteWriteAllowed: false,
    liveCheckAllowed: false,
    credentialValuesExposed: false,
    uploadCommand: null,
    backendKind: 's3-compatible',
    config: {
      name: 'team-cache',
      artifactPrefix: 'knowledge-artifacts/v1',
      indexPrefix: 'knowledge-index/v1',
      credentialMode: 'environment',
      remoteWriteDefault: false,
      liveCheckDefault: false
    },
    capabilities: {
      artifactObjectStore: true,
      metadataIndex: true,
      contentAddressedObjectKeys: true,
      contentAddressedIndexKeys: true,
      idempotentWritesRequired: true,
      explicitUploadApprovalRequired: true,
      dryRunOnly: true
    },
    readiness: {
      status: 'ready-for-explicit-upload',
      nextAction: 'design-explicit-upload',
      blockerCount: 0,
      blockerCodes: [],
      blockers: [],
      reason: 'Backend config can support explicit upload design.'
    },
    ...overrides
  };
}

test('backend readiness validation module accepts compact safe reports directly', () => {
  const validation = validateKnowledgeTeamBackendReadinessPayload(
    readyBackendReadiness(),
    'inline',
    'infra-agent.knowledge-team-backend-readiness'
  );

  assert.equal(validation.inputKind, 'infra-agent.knowledge-team-backend-readiness');
  assert.equal(validation.valid, true);
  assert.equal(validation.factSetCount, 0);
  assert.equal(validation.factCount, 0);
  assert.equal(validation.issueCount, 0);
});

test('backend readiness validation module rejects forged readiness state and backend leakage', () => {
  const validation = validateKnowledgeTeamBackendReadinessPayload(
    readyBackendReadiness({
      remoteWriteAllowed: true,
      uploadCommand: 'aws s3 cp pack.json s3://private-team-cache',
      backendKind: 'unsupported',
      endpointUrl: 'https://s3.example.test/private',
      readiness: {
        status: 'ready-for-explicit-upload',
        nextAction: 'fix-backend-config',
        blockerCount: 1,
        blockerCodes: ['remote-write-enabled'],
        blockers: [{
          code: 'remote-write-enabled',
          path: '$.remoteWriteDefault',
          message: 'Remote writes are enabled.'
        }],
        reason: 'Forged ready state.'
      }
    }),
    'inline',
    'infra-agent.knowledge-team-backend-readiness'
  );

  assert.equal(validation.valid, false);
  for (const expectedPath of [
    '$.remoteWriteAllowed',
    '$.uploadCommand',
    '$.backendKind',
    '$.endpointUrl',
    '$.readiness.nextAction',
    '$.readiness.blockers'
  ]) {
    assert.ok(
      validation.issues.some(issue => issue.path === expectedPath),
      `expected issue for ${expectedPath}`
    );
  }
});
