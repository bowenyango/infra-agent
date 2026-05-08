import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPulumiComponentSummaries } from '../../src/domain/pulumi-components.ts';

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
