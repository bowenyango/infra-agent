import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeTeamS3CompatibleBackendConfig
} from '../../src/knowledge/team-s3-compatible-backend-config.ts';
import {
  buildKnowledgeTeamS3CompatibleReferenceRegistry,
  parseKnowledgeTeamS3CompatibleReferenceRegistry,
  validateKnowledgeTeamS3CompatibleBackendReferences
} from '../../src/knowledge/team-s3-compatible-reference-registry.ts';

test('s3-compatible reference registry accepts safe offline env var names', () => {
  const registry = buildKnowledgeTeamS3CompatibleReferenceRegistry();
  const parsed = parseKnowledgeTeamS3CompatibleReferenceRegistry(registry);

  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.issues, []);
  assert.deepEqual(parsed.registry, {
    kind: 'infra-agent.knowledge-team-s3-compatible-reference-registry',
    schemaVersion: 1,
    mutationAllowed: false,
    storageProfiles: [
      {
        ref: 'team-cache-storage',
        endpointUrlEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_ENDPOINT_URL',
        bucketNameEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_BUCKET_NAME',
        regionEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_REGION'
      }
    ],
    authProfiles: [
      {
        ref: 'team-cache-auth',
        accessKeyIdEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_ACCESS_KEY_ID',
        secretAccessKeyEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_SECRET_ACCESS_KEY',
        sessionTokenEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_SESSION_TOKEN'
      }
    ]
  });
});

test('s3-compatible reference validation reports only required env var names', () => {
  const summary = validateKnowledgeTeamS3CompatibleBackendReferences(
    buildKnowledgeTeamS3CompatibleBackendConfig(),
    buildKnowledgeTeamS3CompatibleReferenceRegistry()
  );

  assert.equal(summary.kind, 'infra-agent.knowledge-team-s3-compatible-reference-validation');
  assert.equal(summary.schemaVersion, 1);
  assert.equal(summary.mutationAllowed, false);
  assert.equal(summary.status, 'valid');
  assert.equal(summary.backendKind, 's3-compatible');
  assert.equal(summary.configName, 'team-cache');
  assert.equal(summary.storageProfileRef, 'team-cache-storage');
  assert.equal(summary.authProfileRef, 'team-cache-auth');
  assert.deepEqual(summary.requiredEnvironmentVariables, [
    'INFRA_AGENT_TEAM_CACHE_S3_ENDPOINT_URL',
    'INFRA_AGENT_TEAM_CACHE_S3_BUCKET_NAME',
    'INFRA_AGENT_TEAM_CACHE_S3_REGION',
    'INFRA_AGENT_TEAM_CACHE_S3_ACCESS_KEY_ID',
    'INFRA_AGENT_TEAM_CACHE_S3_SECRET_ACCESS_KEY'
  ]);
  assert.deepEqual(summary.optionalEnvironmentVariables, [
    'INFRA_AGENT_TEAM_CACHE_S3_SESSION_TOKEN'
  ]);
  assert.deepEqual(summary.issueCodes, []);
  assert.deepEqual(summary.issues, []);
  assert.equal(summary.capabilities.remoteWriteAllowed, false);
  assert.equal(summary.capabilities.liveCheckAllowed, false);
  assert.equal(summary.capabilities.credentialValuesExposed, false);
  assert.equal(summary.capabilities.uploadCommand, null);
  assert.equal(summary.capabilities.dryRunOnly, true);
});
