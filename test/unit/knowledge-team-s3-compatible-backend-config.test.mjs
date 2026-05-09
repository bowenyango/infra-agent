import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeTeamS3CompatibleBackendConfig,
  parseKnowledgeTeamS3CompatibleBackendConfig
} from '../../src/knowledge/team-s3-compatible-backend-config.ts';

test('s3-compatible backend private config parser accepts safe structural references', () => {
  const config = buildKnowledgeTeamS3CompatibleBackendConfig({
    name: 'team-cache-prod',
    storageProfileRef: 'team-cache-storage-prod',
    authProfileRef: 'team-cache-auth-prod'
  });
  const result = parseKnowledgeTeamS3CompatibleBackendConfig(config);

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.config, {
    kind: 'infra-agent.knowledge-team-s3-compatible-backend-config',
    schemaVersion: 1,
    mutationAllowed: false,
    backendKind: 's3-compatible',
    name: 'team-cache-prod',
    storageProfileRef: 'team-cache-storage-prod',
    authProfileRef: 'team-cache-auth-prod',
    artifactPrefix: 'knowledge-artifacts/v1',
    indexPrefix: 'knowledge-index/v1',
    credentialMode: 'environment',
    remoteWriteDefault: false,
    liveCheckDefault: false
  });
});

test('s3-compatible backend private config parser does not read environment credential values', () => {
  const previous = {
    accessKey: process.env.AWS_ACCESS_KEY_ID,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN
  };
  process.env.AWS_ACCESS_KEY_ID = 'should-not-read-access-key';
  process.env.AWS_SECRET_ACCESS_KEY = 'should-not-read-secret-key';
  process.env.AWS_SESSION_TOKEN = 'should-not-read-session-token';

  try {
    const result = parseKnowledgeTeamS3CompatibleBackendConfig(
      buildKnowledgeTeamS3CompatibleBackendConfig()
    );
    const text = JSON.stringify(result);

    assert.equal(result.ok, true);
    for (const forbidden of [
      'should-not-read-access-key',
      'should-not-read-secret-key',
      'should-not-read-session-token'
    ]) {
      assert.equal(text.includes(forbidden), false, forbidden);
    }
  } finally {
    if (typeof previous.accessKey === 'undefined') {
      delete process.env.AWS_ACCESS_KEY_ID;
    } else {
      process.env.AWS_ACCESS_KEY_ID = previous.accessKey;
    }
    if (typeof previous.secretKey === 'undefined') {
      delete process.env.AWS_SECRET_ACCESS_KEY;
    } else {
      process.env.AWS_SECRET_ACCESS_KEY = previous.secretKey;
    }
    if (typeof previous.sessionToken === 'undefined') {
      delete process.env.AWS_SESSION_TOKEN;
    } else {
      process.env.AWS_SESSION_TOKEN = previous.sessionToken;
    }
  }
});
