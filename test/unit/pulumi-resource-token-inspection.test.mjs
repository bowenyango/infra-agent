import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { extractPulumiLanguageResourceTokens } from '../../src/domain/pulumi-resource-tokens.ts';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { buildTargetCandidates } from '../../src/domain/task-targeting.ts';

test('Pulumi language parser extracts namespace import resource constructors', () => {
  const resourceTokens = extractPulumiLanguageResourceTokens(
    [
      'import * as aws from "@pulumi/aws";',
      'const bucket = new aws.s3.Bucket("api-bucket", {});',
      'const provider = new aws.Provider("ignored", {});',
      'const fake = "new aws.s3.Bucket(\\"not-real\\", {})";',
      '// const commented = new aws.s3.Bucket("also-not-real", {});',
      ''
    ].join('\n'),
    { sourcePath: 'infra/api/index.ts' }
  );

  assert.deepEqual(resourceTokens, [
    {
      name: 'api-bucket',
      type: 'aws:s3/bucket:Bucket',
      packageName: 'aws',
      moduleName: 's3/bucket',
      typeName: 'Bucket',
      evidence: {
        kind: 'pulumi-nodejs',
        sourcePath: 'infra/api/index.ts',
        sourceLocator: 'infra/api/index.ts:2'
      }
    }
  ]);
});

test('Pulumi language parser extracts CommonJS namespace resource constructors', () => {
  const resourceTokens = extractPulumiLanguageResourceTokens(
    [
      'const k8s = require("@pulumi/kubernetes");',
      'const deployment = new k8s.apps.v1.Deployment("apiDeployment", {});',
      ''
    ].join('\n'),
    { sourcePath: 'infra/api/index.js' }
  );

  assert.deepEqual(resourceTokens, [
    {
      name: 'apiDeployment',
      type: 'kubernetes:apps/v1:Deployment',
      packageName: 'kubernetes',
      moduleName: 'apps/v1',
      typeName: 'Deployment',
      evidence: {
        kind: 'pulumi-nodejs',
        sourcePath: 'infra/api/index.js',
        sourceLocator: 'infra/api/index.js:2'
      }
    }
  ]);
});

test('inspectWorkspace extracts deterministic Pulumi YAML resource tokens', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-resource-tokens-'));

  try {
    const projectRoot = join(tempRoot, 'infra/app');
    await mkdir(projectRoot, { recursive: true });
    await writeFile(
      join(projectRoot, 'Pulumi.yaml'),
      [
        'name: app',
        'runtime: yaml',
        'resources:',
        '  appBucket:',
        '    type: aws:s3/bucket:Bucket',
        '  appDeployment:',
        '    type: kubernetes:apps/v1:Deployment',
        '  generatedPassword:',
        '    type: random:index/randomPassword:RandomPassword',
        '  malformed:',
        '    type: not-a-resource-token',
        '  missingType:',
        '    properties: {}',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === 'infra/app');

    assert.ok(project);
    assert.deepEqual(project.resourceTokens, [
      {
        name: 'appBucket',
        type: 'aws:s3/bucket:Bucket',
        packageName: 'aws',
        moduleName: 's3/bucket',
        typeName: 'Bucket'
      },
      {
        name: 'appDeployment',
        type: 'kubernetes:apps/v1:Deployment',
        packageName: 'kubernetes',
        moduleName: 'apps/v1',
        typeName: 'Deployment'
      }
    ]);

    const targeting = buildTargetCandidates('update Pulumi bucket configuration', inspection);
    const candidate = targeting.targetCandidates.find(item => item.path === 'infra/app');
    assert.ok(candidate);
    assert.ok(candidate.reasons.some(reason => /repository hints matched service token "bucket"/i.test(reason)));
    assert.ok(candidate.details?.some(detail =>
      detail === 'pulumi resources: aws:s3/bucket:Bucket, kubernetes:apps/v1:Deployment'
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
