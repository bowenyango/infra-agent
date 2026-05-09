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
import {
  buildPulumiComponentKnowledgeContent,
  buildPulumiComponentKnowledgeSources,
  extractPulumiComponentSummaries
} from '../../src/domain/pulumi-components.ts';

test('extracts Pulumi component inputs and outputs from namespace imports', () => {
  const summaries = extractPulumiComponentSummaries([
    'import * as pulumi from "@pulumi/pulumi";',
    '',
    'export interface ApiServiceArgs {',
    '  image: string;',
    '  replicas?: number;',
    '  secretToken?: string;',
    '}',
    '',
    'export class ApiService extends pulumi.ComponentResource {',
    '  public readonly endpoint: pulumi.Output<string>;',
    '  private readonly internalId: string;',
    '',
    '  constructor(name: string, args: ApiServiceArgs, opts?: pulumi.ComponentResourceOptions) {',
    '    super("pkg:index:ApiService", name, {}, opts);',
    '  }',
    '}',
    ''
  ].join('\n'), {
    sourcePath: 'infra/api/components.ts'
  });

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.className, 'ApiService');
  assert.equal(summaries[0]?.typeToken, 'pkg:index:ApiService');
  assert.equal(summaries[0]?.argsType, 'ApiServiceArgs');
  assert.deepEqual(summaries[0]?.inputs.map(input => ({
    name: input.name,
    required: input.required,
    type: input.type
  })), [
    {
      name: 'image',
      required: true,
      type: 'string'
    },
    {
      name: 'replicas',
      required: false,
      type: 'number'
    }
  ]);
  assert.deepEqual(summaries[0]?.outputs.map(output => ({
    name: output.name,
    type: output.type
  })), [
    {
      name: 'endpoint',
      type: 'pulumi.Output<string>'
    }
  ]);
  assert.ok(summaries[0]?.sourceLocator.startsWith('infra/api/components.ts:'));
  assert.ok(summaries[0]?.inputs.every(input => input.sourceLocator.startsWith('infra/api/components.ts:')));
  assert.ok(summaries[0]?.outputs.every(output => output.sourceLocator.startsWith('infra/api/components.ts:')));
});

test('extracts Pulumi components from direct ComponentResource imports', () => {
  const summaries = extractPulumiComponentSummaries([
    'import { ComponentResource } from "@pulumi/pulumi";',
    '',
    'type WorkerArgs = {',
    '  queueName: string',
    '  visibilityTimeout?: number',
    '}',
    '',
    'class Worker extends ComponentResource {',
    '  readonly queueUrl!: string;',
    '  constructor(name: string, args: WorkerArgs) {',
    '    super("pkg:index:Worker", name, {}, undefined);',
    '  }',
    '}',
    ''
  ].join('\n'), {
    sourcePath: 'infra/api/worker.ts'
  });

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.className, 'Worker');
  assert.equal(summaries[0]?.inputs[0]?.name, 'queueName');
  assert.equal(summaries[0]?.inputs[0]?.required, true);
  assert.equal(summaries[0]?.inputs[1]?.name, 'visibilityTimeout');
  assert.equal(summaries[0]?.inputs[1]?.required, false);
  assert.equal(summaries[0]?.outputs[0]?.name, 'queueUrl');
});

test('extracts child resources declared inside Pulumi component classes', () => {
  const summaries = extractPulumiComponentSummaries([
    'import * as pulumi from "@pulumi/pulumi";',
    'import * as aws from "@pulumi/aws";',
    'import { Bucket } from "@pulumi/aws/s3";',
    'const k8s = require("@pulumi/kubernetes");',
    '',
    'class ApiService extends pulumi.ComponentResource {',
    '  public readonly endpoint: pulumi.Output<string>;',
    '  constructor(name: string, args: ApiServiceArgs) {',
    '    super("pkg:index:ApiService", name, {}, undefined);',
    '    const assets = new aws.s3.Bucket("assets", { bucket: name });',
    '    const logs = new Bucket("logs", {});',
    '    const deployment = new k8s.apps.v1.Deployment("api-deploy", {});',
    '    const ignored = "new aws.s3.Bucket(\\"stringBucket\\", {})";',
    '    // new aws.s3.Bucket("commentBucket", {});',
    '  }',
    '}',
    '',
    'new aws.s3.Bucket("rootBucket", {});',
    ''
  ].join('\n'), {
    sourcePath: 'infra/api/components.ts'
  });

  assert.equal(summaries.length, 1);
  assert.deepEqual(summaries[0]?.childResources.map(resource => ({
    name: resource.name,
    type: resource.type,
    packageName: resource.packageName,
    moduleName: resource.moduleName,
    typeName: resource.typeName
  })), [
    {
      name: 'assets',
      type: 'aws:s3/bucket:Bucket',
      packageName: 'aws',
      moduleName: 's3/bucket',
      typeName: 'Bucket'
    },
    {
      name: 'logs',
      type: 'aws:s3/bucket:Bucket',
      packageName: 'aws',
      moduleName: 's3/bucket',
      typeName: 'Bucket'
    },
    {
      name: 'api-deploy',
      type: 'kubernetes:apps/v1:Deployment',
      packageName: 'kubernetes',
      moduleName: 'apps/v1',
      typeName: 'Deployment'
    }
  ]);
  assert.ok(summaries[0]?.childResources.every(resource =>
    resource.sourcePath === 'infra/api/components.ts'
    && resource.sourceLocator.startsWith('infra/api/components.ts:')
  ));
  assert.doesNotMatch(
    JSON.stringify(summaries[0]?.childResources),
    /rootBucket|stringBucket|commentBucket/
  );
});

test('ignores commented components and secret-like component fields', () => {
  const summaries = extractPulumiComponentSummaries([
    'import * as pulumi from "@pulumi/pulumi";',
    '',
    '// class Commented extends pulumi.ComponentResource {}',
    'interface SafeArgs {',
    '  serviceName: string;',
    '  apiKey?: string;',
    '}',
    '',
    'class SafeComponent extends pulumi.ComponentResource {',
    '  public readonly serviceUrl: string;',
    '  public readonly bearerToken: string;',
    '  constructor(name: string, args: SafeArgs) {',
    '    super("pkg:index:SafeComponent", name, {}, undefined);',
    '  }',
    '}',
    ''
  ].join('\n'), {
    sourcePath: 'infra/api/safe.ts'
  });

  assert.deepEqual(summaries.map(summary => summary.className), ['SafeComponent']);
  assert.deepEqual(summaries[0]?.inputs.map(input => input.name), ['serviceName']);
  assert.deepEqual(summaries[0]?.outputs.map(output => output.name), ['serviceUrl']);
});

test('builds Pulumi component knowledge sources and summary content', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-component-sources-'));

  try {
    const projectRoot = join(tempRoot, 'infra/api');
    await mkdir(join(projectRoot, '__tests__'), { recursive: true });
    await writeFile(
      join(projectRoot, 'Pulumi.yaml'),
      'name: api\nruntime: nodejs\n',
      'utf8'
    );
    await writeFile(
      join(projectRoot, 'components.ts'),
      [
        'import * as pulumi from "@pulumi/pulumi";',
        'import * as aws from "@pulumi/aws";',
        '',
        'export interface ApiServiceArgs {',
        '  image: string;',
        '}',
        '',
        'export class ApiService extends pulumi.ComponentResource {',
        '  public readonly endpoint: string;',
        '  constructor(name: string, args: ApiServiceArgs) {',
        '    super("pkg:index:ApiService", name, {}, undefined);',
        '    const assets = new aws.s3.Bucket("assets", { bucket: args.image });',
        '  }',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(projectRoot, '__tests__/component.test.ts'),
      [
        'import * as pulumi from "@pulumi/pulumi";',
        'class TestOnly extends pulumi.ComponentResource {}',
        ''
      ].join('\n'),
      'utf8'
    );

    const project = {
      projectRoot: 'infra/api',
      projectFile: 'infra/api/Pulumi.yaml',
      packageFiles: [],
      resourceTokens: [],
      stackFiles: [],
      stackNames: [],
      environmentHints: []
    };
    const sources = await buildPulumiComponentKnowledgeSources(tempRoot, project);

    assert.equal(sources.length, 1);
    assert.equal(sources[0]?.kind, 'pulumi-component');
    assert.equal(sources[0]?.name, 'pulumi-component:infra/api:ApiService');
    assert.equal(sources[0]?.localPath, 'infra/api/components.ts');
    assert.equal(sources[0]?.module, 'infra/api');
    assert.equal(sources[0]?.packageName, 'ApiService');

    const content = await buildPulumiComponentKnowledgeContent({
      workspaceRoot: tempRoot,
      project,
      source: sources[0]
    });
    assert.ok(content);
    const summary = JSON.parse(content);

    assert.equal(summary.kind, 'infra-agent.pulumi-component-summary');
    assert.equal(summary.mutationAllowed, false);
    assert.equal(summary.projectRoot, 'infra/api');
    assert.equal(summary.className, 'ApiService');
    assert.equal(summary.typeToken, 'pkg:index:ApiService');
    assert.deepEqual(summary.inputs.map(input => input.name), ['image']);
    assert.deepEqual(summary.outputs.map(output => output.name), ['endpoint']);
    assert.deepEqual(summary.childResources.map(resource => ({
      name: resource.name,
      type: resource.type,
      sourceLocator: resource.sourceLocator
    })), [
      {
        name: 'assets',
        type: 'aws:s3/bucket:Bucket',
        sourceLocator: 'infra/api/components.ts:12'
      }
    ]);
    assert.doesNotMatch(
      content,
      /class ApiService|super\(|@pulumi\/pulumi|@pulumi\/aws|bucket:\s*args\.image|TestOnly/
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
