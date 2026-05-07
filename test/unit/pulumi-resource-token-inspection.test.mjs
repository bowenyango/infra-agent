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
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { buildTargetCandidates } from '../../src/domain/task-targeting.ts';

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
