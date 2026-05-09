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

function withEnvValues(updates, callback) {
  const previous = {};
  for (const [key, value] of Object.entries(updates)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }

  try {
    callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (typeof value === 'undefined') {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

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

test('s3-compatible reference validation does not read environment values', () => {
  withEnvValues({
    INFRA_AGENT_TEAM_CACHE_S3_ENDPOINT_URL: 'https://should-not-read.example.test',
    INFRA_AGENT_TEAM_CACHE_S3_BUCKET_NAME: 'should-not-read-bucket',
    INFRA_AGENT_TEAM_CACHE_S3_REGION: 'should-not-read-region',
    INFRA_AGENT_TEAM_CACHE_S3_ACCESS_KEY_ID: 'should-not-read-access-key',
    INFRA_AGENT_TEAM_CACHE_S3_SECRET_ACCESS_KEY: 'should-not-read-secret-key',
    INFRA_AGENT_TEAM_CACHE_S3_SESSION_TOKEN: 'should-not-read-session-token'
  }, () => {
    const registry = buildKnowledgeTeamS3CompatibleReferenceRegistry();
    const summary = validateKnowledgeTeamS3CompatibleBackendReferences(
      buildKnowledgeTeamS3CompatibleBackendConfig(),
      registry
    );
    const text = JSON.stringify({ registry, summary });

    assert.equal(summary.status, 'valid');
    for (const forbidden of [
      'https://should-not-read.example.test',
      'should-not-read-bucket',
      'should-not-read-region',
      'should-not-read-access-key',
      'should-not-read-secret-key',
      'should-not-read-session-token'
    ]) {
      assert.equal(text.includes(forbidden), false, forbidden);
    }
  });
});

test('s3-compatible reference registry rejects unsafe env var names without echoing values', () => {
  const result = parseKnowledgeTeamS3CompatibleReferenceRegistry({
    kind: 'infra-agent.knowledge-team-s3-compatible-reference-registry',
    schemaVersion: 1,
    mutationAllowed: false,
    storageProfiles: [
      {
        ref: 'team-cache-storage',
        endpointUrlEnvVar: 'https://private.example.test',
        bucketNameEnvVar: 'team-cache-bucket',
        regionEnvVar: 'us-east-1'
      }
    ],
    authProfiles: [
      {
        ref: 'team-cache-auth',
        accessKeyIdEnvVar: 'access-key-value',
        secretAccessKeyEnvVar: 'secret-token'
      }
    ]
  });

  assert.equal(result.ok, false);
  assert.equal(result.registry, null);
  const codes = new Set(result.issues.map(issue => issue.code));
  assert.equal(codes.has('unsafe-env-var-name'), true);
  assert.equal(codes.has('backend-detail-leak'), true);

  const issueText = JSON.stringify(result.issues);
  for (const forbidden of [
    'https://private.example.test',
    'team-cache-bucket',
    'us-east-1',
    'access-key-value',
    'secret-token'
  ]) {
    assert.equal(issueText.includes(forbidden), false, forbidden);
  }
});

test('s3-compatible reference registry rejects duplicate refs and inline detail fields', () => {
  const result = parseKnowledgeTeamS3CompatibleReferenceRegistry({
    kind: 'infra-agent.knowledge-team-s3-compatible-reference-registry',
    schemaVersion: 1,
    mutationAllowed: false,
    storageProfiles: [
      {
        ref: 'team-cache-storage',
        endpointUrlEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_ENDPOINT_URL',
        bucketNameEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_BUCKET_NAME',
        regionEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_REGION',
        bucketName: 'private-team-cache'
      },
      {
        ref: 'team-cache-storage',
        endpointUrlEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_ENDPOINT_URL_2',
        bucketNameEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_BUCKET_NAME_2',
        regionEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_REGION_2'
      }
    ],
    authProfiles: [
      {
        ref: 'team-cache-auth',
        accessKeyIdEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_ACCESS_KEY_ID',
        secretAccessKeyEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_SECRET_ACCESS_KEY',
        secretAccessKey: 'private-secret'
      },
      {
        ref: 'team-cache-auth',
        accessKeyIdEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_ACCESS_KEY_ID_2',
        secretAccessKeyEnvVar: 'INFRA_AGENT_TEAM_CACHE_S3_SECRET_ACCESS_KEY_2'
      }
    ]
  });

  assert.equal(result.ok, false);
  const codes = new Set(result.issues.map(issue => issue.code));
  assert.equal(codes.has('duplicate-reference'), true);
  assert.equal(codes.has('backend-detail-leak'), true);

  const issueText = JSON.stringify(result.issues);
  for (const forbidden of [
    'private-team-cache',
    'private-secret',
    'bucketName',
    'secretAccessKey'
  ]) {
    assert.equal(issueText.includes(forbidden), false, forbidden);
  }
});
