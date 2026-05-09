import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeTeamS3CompatibleBackendDescriptor,
  buildKnowledgeTeamS3CompatibleBackendConfig,
  parseKnowledgeTeamS3CompatibleBackendConfig,
  toKnowledgeTeamBackendReadinessConfig
} from '../../src/knowledge/team-s3-compatible-backend-config.ts';
import { buildKnowledgeTeamBackendReadinessReport } from '../../src/knowledge/team-backend-readiness.ts';
import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';

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

test('s3-compatible backend private config parser rejects backend detail leakage without echoing values', () => {
  const result = parseKnowledgeTeamS3CompatibleBackendConfig({
    kind: 'infra-agent.knowledge-team-s3-compatible-backend-config',
    schemaVersion: 1,
    mutationAllowed: false,
    backendKind: 's3-compatible',
    name: 'team-cache',
    storageProfileRef: 'team-cache-storage',
    authProfileRef: 'team-cache-auth',
    artifactPrefix: 'knowledge-artifacts/v1',
    indexPrefix: 'knowledge-index/v1',
    credentialMode: 'environment',
    remoteWriteDefault: false,
    liveCheckDefault: false,
    bucket: 'private-team-cache',
    endpointUrl: 'https://s3.example.test/private',
    accessToken: 'secret-token',
    workspaceRoot: '/workspace/private-project'
  });

  assert.equal(result.ok, false);
  assert.equal(result.config, null);
  assert.ok(result.issues.some(issue => issue.code === 'backend-detail-leak'));

  const issueText = JSON.stringify(result.issues);
  for (const forbidden of [
    'private-team-cache',
    'https://s3.example.test/private',
    'secret-token',
    '/workspace/private-project',
    'endpointUrl',
    'accessToken'
  ]) {
    assert.equal(issueText.includes(forbidden), false, forbidden);
  }
});

test('s3-compatible backend private config parser rejects unsafe shape and disabled-gate drift', () => {
  const result = parseKnowledgeTeamS3CompatibleBackendConfig({
    kind: 'infra-agent.knowledge-team-s3-compatible-backend-config',
    schemaVersion: 2,
    mutationAllowed: true,
    backendKind: 'gcs',
    name: '../team-cache',
    storageProfileRef: 'Team Cache Storage',
    authProfileRef: '',
    artifactPrefix: 'team-artifacts',
    credentialMode: 'inline',
    remoteWriteDefault: true,
    liveCheckDefault: true
  });

  assert.equal(result.ok, false);
  const codes = new Set(result.issues.map(issue => issue.code));
  for (const expected of [
    'invalid-schema-version',
    'mutation-enabled',
    'unsupported-backend-kind',
    'unsafe-config-name',
    'unsafe-reference',
    'missing-required-field',
    'unsafe-prefix',
    'unsupported-credential-mode',
    'remote-write-enabled',
    'live-check-enabled'
  ]) {
    assert.equal(codes.has(expected), true, expected);
  }
});

test('s3-compatible backend private config projects to existing backend readiness input without private refs', () => {
  const privateConfig = buildKnowledgeTeamS3CompatibleBackendConfig({
    name: 'team-cache-prod',
    storageProfileRef: 'team-cache-storage-prod',
    authProfileRef: 'team-cache-auth-prod'
  });
  const readinessInput = toKnowledgeTeamBackendReadinessConfig(privateConfig);
  const readiness = buildKnowledgeTeamBackendReadinessReport(readinessInput);
  const validation = validateKnowledgePayload(readiness, 'inline');

  assert.deepEqual(readinessInput, {
    kind: 'infra-agent.knowledge-team-backend-config',
    schemaVersion: 1,
    mutationAllowed: false,
    backendKind: 's3-compatible',
    name: 'team-cache-prod',
    artifactPrefix: 'knowledge-artifacts/v1',
    indexPrefix: 'knowledge-index/v1',
    credentialMode: 'environment',
    remoteWriteDefault: false,
    liveCheckDefault: false
  });
  assert.equal(readiness.readiness.status, 'ready-for-explicit-upload');
  assert.equal(validation.valid, true);
  const readinessText = JSON.stringify(readiness);
  assert.equal(readinessText.includes('storageProfileRef'), false);
  assert.equal(readinessText.includes('authProfileRef'), false);
  assert.equal(readinessText.includes('team-cache-storage-prod'), false);
  assert.equal(readinessText.includes('team-cache-auth-prod'), false);
});

test('s3-compatible backend descriptor is sanitized internal capability metadata', () => {
  const descriptor = buildKnowledgeTeamS3CompatibleBackendDescriptor(
    buildKnowledgeTeamS3CompatibleBackendConfig({
      name: 'team-cache-prod',
      storageProfileRef: 'team-cache-storage-prod',
      authProfileRef: 'team-cache-auth-prod'
    })
  );

  assert.deepEqual(Object.keys(descriptor), [
    'kind',
    'schemaVersion',
    'mutationAllowed',
    'backendKind',
    'name',
    'storageProfileRef',
    'authProfileRef',
    'artifactPrefix',
    'indexPrefix',
    'credentialMode',
    'capabilities'
  ]);
  assert.equal(descriptor.kind, 'infra-agent.knowledge-team-s3-compatible-backend-descriptor');
  assert.equal(descriptor.mutationAllowed, false);
  assert.equal(descriptor.backendKind, 's3-compatible');
  assert.equal(descriptor.capabilities.remoteWriteAllowed, false);
  assert.equal(descriptor.capabilities.liveCheckAllowed, false);
  assert.equal(descriptor.capabilities.credentialValuesExposed, false);
  assert.equal(descriptor.capabilities.uploadCommand, null);
  assert.equal(descriptor.capabilities.dryRunOnly, true);

  const descriptorText = JSON.stringify(descriptor);
  for (const forbidden of [
    'bucket',
    'endpoint',
    'https://',
    's3://',
    'token',
    'password',
    'secret',
    '/tmp/',
    '/home/',
    '/workspace/'
  ]) {
    assert.equal(descriptorText.includes(forbidden), false, forbidden);
  }
});
