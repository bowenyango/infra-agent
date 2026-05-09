import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve
} from 'node:path';
import { captureStdout } from '../support/capture-stdout.mjs';
import { main } from '../../src/cli/main.ts';

async function runKnowledgeCliJson(args) {
  const output = await captureStdout(() => main(args));
  return {
    output,
    report: JSON.parse(output.slice(output.indexOf('{')))
  };
}

async function writePulumiComponentWorkspace(tempRoot) {
  const projectRoot = join(tempRoot, 'infra/api');
  await mkdir(projectRoot, { recursive: true });
  await writeFile(
    join(projectRoot, 'Pulumi.yaml'),
    [
      'name: api',
      'runtime: nodejs',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(
    join(projectRoot, 'components.ts'),
    [
      'import * as pulumi from "@pulumi/pulumi";',
      'import * as aws from "@pulumi/aws";',
      '',
      'interface ApiServiceArgs {',
      '  image: string;',
      '}',
      '',
      'class ApiService extends pulumi.ComponentResource {',
      '  public readonly endpoint: string;',
      '  constructor(name: string, args: ApiServiceArgs) {',
      '    super("pkg:index:ApiService", name, {}, undefined);',
      '    const assets = new aws.s3.Bucket("assets", { bucket: args.image });',
      '    const apiKeyBucket = new aws.s3.Bucket("apiKeyBucket", {});',
      '  }',
      '}',
      '',
      'new aws.s3.Bucket("rootBucket", {});',
      ''
    ].join('\n'),
    'utf8'
  );
}

const RAW_SOURCE_PATTERN = /class ApiService|interface ApiServiceArgs|super\(|@pulumi\/pulumi|new aws\.s3\.Bucket|bucket:\s*args\.image|apiKeyBucket|rootBucket|"content"\s*:/;

test('knowledge extract command emits Pulumi component child resource facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-extract-pulumi-component-child-'));

  try {
    await writePulumiComponentWorkspace(tempRoot);

    const { output, report } = await runKnowledgeCliJson([
      'knowledge',
      'extract',
      tempRoot,
      '--domain',
      'pulumi',
      '--target',
      'infra/api',
      '--json'
    ]);

    assert.equal(report.kind, 'infra-agent.knowledge-extraction');
    assert.equal(report.mutationAllowed, false);
    assert.ok(report.factSets.some(factSet =>
      factSet.source.kind === 'pulumi-component'
      && factSet.facts.some(fact =>
        fact.kind === 'pulumi-component-child-resource'
        && fact.path === 'component.ApiService.childResources.assets'
        && fact.type === 'aws:s3/bucket:Bucket'
        && fact.source.locator === 'infra/api/components.ts:12: ApiService.assets'
      )
    ));
    assert.doesNotMatch(output, RAW_SOURCE_PATTERN);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack command includes bounded Pulumi component child resource facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-pulumi-component-child-'));

  try {
    await writePulumiComponentWorkspace(tempRoot);

    const { output, report: pack } = await runKnowledgeCliJson([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'pulumi',
      '--target',
      'infra/api',
      '--max-facts',
      '3',
      '--json'
    ]);

    assert.equal(pack.kind, 'infra-agent.knowledge-pack');
    assert.equal(pack.mutationAllowed, false);
    assert.equal(pack.includedFactCount, 3);
    assert.ok(pack.sources.some(source =>
      source.kind === 'pulumi-component'
      && source.name === 'pulumi-component:infra/api:ApiService'
      && source.storagePolicy.scope === 'workspace-private'
    ));
    assert.equal(pack.facts[0]?.kind, 'pulumi-component-input');
    assert.equal(pack.facts[1]?.kind, 'pulumi-component-child-resource');
    assert.equal(pack.facts[1]?.path, 'component.ApiService.childResources.assets');
    assert.equal(pack.facts[1]?.type, 'aws:s3/bucket:Bucket');
    assert.equal(pack.facts[2]?.kind, 'pulumi-component-output');
    assert.doesNotMatch(output, RAW_SOURCE_PATTERN);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
