import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve
} from 'node:path';
import { writeTerraformProviderSchemaWorkspace } from '../support/terraform-provider-schema-workspace.mjs';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import {
  buildKnowledgeCacheId,
  writeKnowledgeCacheEntry
} from '../../src/knowledge/cache.ts';
import { parseKnowledgeFactSet } from '../../src/knowledge/facts-contract.ts';
import { extractKnowledgeFactSetFromCacheEntry } from '../../src/knowledge/facts.ts';
import { extractWorkspaceKnowledgeFacts } from '../../src/knowledge/extract.ts';
import {
  validateKnowledgePayload,
  validateKnowledgePayloadWithLocalSources
} from '../../src/knowledge/validate.ts';

test('knowledge fact extractor summarizes Terraform Registry markdown from cache', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-facts-terraform-'));

  try {
    const source = {
      kind: 'terraform-registry',
      name: 'resource:aws_s3_bucket',
      provider: 'hashicorp/aws',
      version: '5.37.0',
      url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket'
    };
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'text/markdown',
      content: [
        '# aws_s3_bucket',
        '',
        '## Example Usage',
        '',
        '```hcl',
        'resource "aws_s3_bucket" "example" {',
        '  bucket = "example-bucket"',
        '}',
        '```',
        '',
        '## Argument Reference',
        '',
        '- `bucket` - (Optional) Name of the bucket. Forces replacement.',
        '- `tags` - (Optional) Map of tags for the bucket.',
        '',
        '## Attributes Reference',
        '',
        '- `arn` - ARN of the bucket.',
        ''
      ].join('\n'),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      staleAfter: '2026-06-05T00:00:00.000Z'
    });

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry, {
      now: new Date('2026-05-06T00:00:00.000Z')
    });

    assert.equal(factSet.kind, 'infra-agent.knowledge-facts');
    assert.equal(factSet.sourceId, entry.id);
    assert.equal(factSet.sourceContentHash, entry.contentHash);
    assert.equal(factSet.sourceStale, false);
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'argument'
      && fact.path === 'resource.aws_s3_bucket.bucket'
      && fact.required === false
      && fact.source.locator === 'Argument Reference: bucket'
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'identity-field'
      && fact.path === 'resource.aws_s3_bucket.bucket'
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'replacement-sensitive-field'
      && fact.path === 'resource.aws_s3_bucket.bucket'
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'attribute'
      && fact.path === 'resource.aws_s3_bucket.arn'
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'example'
      && fact.path === 'resource.aws_s3_bucket.example'
    ));
    assert.equal(parseKnowledgeFactSet(factSet).factCount, factSet.facts.length);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge fact extractor summarizes Helm values schema from cache', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-facts-helm-'));

  try {
    const source = {
      kind: 'chart-schema',
      name: 'payments-api:values.schema.json',
      chart: 'payments-api',
      version: '1.2.3',
      localPath: 'charts/payments-api/values.schema.json'
    };
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'application/json',
      content: JSON.stringify({
        type: 'object',
        required: ['image'],
        properties: {
          image: {
            type: 'object',
            required: ['tag'],
            properties: {
              tag: {
                type: 'string',
                description: 'Container image tag.',
                default: 'latest'
              }
            }
          },
          ingress: {
            type: 'object',
            properties: {
              className: {
                type: 'string',
                enum: ['nginx', 'internal'],
                description: 'Ingress class name.'
              }
            }
          }
        }
      }),
      fetchedAt: '2026-05-05T00:00:00.000Z'
    });

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry);

    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'chart-value'
      && fact.path === 'chart.payments-api.image'
      && fact.required === true
      && fact.type === 'object'
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'chart-value'
      && fact.path === 'chart.payments-api.image.tag'
      && fact.required === true
      && fact.defaultValue === 'latest'
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'chart-value'
      && fact.path === 'chart.payments-api.ingress.className'
      && fact.values?.includes('nginx')
      && fact.values?.includes('internal')
    ));
    assert.equal(parseKnowledgeFactSet(factSet).factCount, factSet.facts.length);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge fact extractor summarizes Helm chart metadata and dependencies', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-facts-helm-metadata-'));

  try {
    const source = {
      kind: 'chart-metadata',
      name: 'api:Chart.yaml',
      chart: 'api',
      module: 'charts/api',
      version: '0.2.0',
      localPath: 'charts/api/Chart.yaml',
      packageName: 'api'
    };
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'application/json',
      content: JSON.stringify({
        kind: 'infra-agent.helm-chart-metadata-summary',
        schemaVersion: 1,
        mutationAllowed: false,
        chartRoot: 'charts/api',
        chartFile: 'charts/api/Chart.yaml',
        lockFile: 'charts/api/Chart.lock',
        chartName: 'api',
        apiVersion: 'v2',
        version: '0.2.0',
        appVersion: '1.4.0',
        kubeVersion: '>=1.27.0',
        chartType: 'application',
        home: 'https://example.com/api-chart',
        sources: ['https://example.com/api-chart/source'],
        lockDigest: 'sha256:abc123',
        lockGenerated: '2026-04-28T00:00:00Z',
        dependencies: [
          {
            name: 'redis',
            sourcePath: 'charts/api/Chart.yaml',
            locked: false,
            version: '17.3.0',
            repository: 'https://charts.bitnami.com/bitnami',
            alias: 'cache'
          },
          {
            name: 'redis',
            sourcePath: 'charts/api/Chart.lock',
            locked: true,
            version: '17.3.1',
            repository: 'https://charts.bitnami.com/bitnami'
          },
          {
            name: 'api_token_helper',
            sourcePath: 'charts/api/Chart.yaml',
            locked: false,
            version: '0.1.0'
          }
        ]
      }),
      fetchedAt: '2026-05-05T00:00:00.000Z'
    });

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry);

    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'chart-metadata'
      && fact.path === 'chart.api.metadata.version'
      && fact.values?.includes('0.2.0')
      && fact.relatedPaths?.includes('charts/api/Chart.yaml')
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'chart-metadata'
      && fact.path === 'chart.api.metadata.lockDigest'
      && fact.values?.includes('sha256:abc123')
      && fact.relatedPaths?.includes('charts/api/Chart.lock')
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'chart-dependency'
      && fact.path === 'chart.api.dependencies.redis'
      && fact.summary.includes('locked')
      && fact.values?.includes('version=17.3.1')
      && fact.values?.includes('locked=true')
      && fact.relatedPaths?.includes('charts/api/Chart.lock')
    ));
    assert.doesNotMatch(JSON.stringify(factSet), /api_token_helper|"content"\s*:|apiVersion:\s*v2|generated:/);
    assert.equal(parseKnowledgeFactSet(factSet).factCount, factSet.facts.length);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge fact extractor summarizes compact Terraform provider schema context', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-facts-provider-schema-'));

  try {
    const source = {
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/app',
      version: 'hashicorp/aws@5.37.0',
      localPath: 'terraform/app/.infra-agent/terraform-provider-schema.json',
      module: 'terraform/app'
    };
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'application/json',
      content: JSON.stringify({
        schemaFile: 'terraform/app/.infra-agent/terraform-provider-schema.json',
        blocks: [
          {
            type: 'aws_lb_listener_rule',
            kind: 'resource',
            sourcePaths: ['terraform/app/main.tf'],
            requiredAttributes: [
              { name: 'listener_arn', type: 'string', required: true }
            ],
            configuredAttributes: [
              { name: 'priority', type: 'number', optional: true },
              { name: 'arn', type: 'string', computed: true },
              { name: 'api_token', type: 'string', optional: true, sensitive: true }
            ],
            requiredBlocks: ['action nesting_mode=list min_items=1 max_items=1'],
            configuredBlocks: ['condition nesting_mode=list min_items=1']
          }
        ]
      }),
      fetchedAt: '2026-05-05T00:00:00.000Z'
    });

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry);

    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'argument'
      && fact.path === 'resource.aws_lb_listener_rule.listener_arn'
      && fact.required === true
      && fact.type === 'string'
      && fact.relatedPaths?.includes('terraform/app/main.tf')
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'argument'
      && fact.path === 'resource.aws_lb_listener_rule.priority'
      && fact.required === false
      && fact.type === 'number'
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'attribute'
      && fact.path === 'resource.aws_lb_listener_rule.arn'
      && fact.summary.includes('do not set')
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'nested-block'
      && fact.path === 'resource.aws_lb_listener_rule.action'
      && fact.values?.includes('min_items=1')
    ));
    assert.doesNotMatch(JSON.stringify(factSet), /api_token/);
    assert.equal(parseKnowledgeFactSet(factSet).factCount, factSet.facts.length);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge fact extractor summarizes Terraform local module interfaces', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-facts-terraform-module-'));

  try {
    const source = {
      kind: 'terraform-module',
      name: 'terraform-module:terraform/app:queue_worker',
      localPath: 'terraform/app/modules/queue-worker',
      module: 'terraform/app',
      packageName: 'queue_worker'
    };
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'application/json',
      content: JSON.stringify({
        kind: 'infra-agent.terraform-local-module-summary',
        schemaVersion: 1,
        mutationAllowed: false,
        rootPath: 'terraform/app',
        callName: 'queue_worker',
        modulePath: 'terraform/app/modules/queue-worker',
        callSourcePaths: ['terraform/app/main.tf'],
        moduleSourcePaths: [
          'terraform/app/modules/queue-worker/variables.tf',
          'terraform/app/modules/queue-worker/outputs.tf'
        ],
        inputs: [
          {
            name: 'image_tag',
            sourcePath: 'terraform/app/modules/queue-worker/variables.tf',
            required: true,
            type: 'string',
            description: 'Container image tag.'
          },
          {
            name: 'environment',
            sourcePath: 'terraform/app/modules/queue-worker/variables.tf',
            required: false,
            type: 'string',
            defaultValue: 'dev',
            values: ['dev', 'stage', 'prod']
          },
          {
            name: 'api_token',
            sourcePath: 'terraform/app/modules/queue-worker/variables.tf',
            required: true,
            type: 'string'
          }
        ],
        outputs: [
          {
            name: 'queue_name',
            sourcePath: 'terraform/app/modules/queue-worker/outputs.tf',
            description: 'Queue name.'
          },
          {
            name: 'secret_value',
            sourcePath: 'terraform/app/modules/queue-worker/outputs.tf'
          }
        ]
      }),
      fetchedAt: '2026-05-05T00:00:00.000Z'
    });

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry);

    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'argument'
      && fact.path === 'module.queue_worker.source'
      && fact.values?.includes('terraform/app/modules/queue-worker')
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'module-input'
      && fact.path === 'module.queue_worker.inputs.image_tag'
      && fact.required === true
      && fact.type === 'string'
      && fact.relatedPaths?.includes('terraform/app/main.tf')
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'module-input'
      && fact.path === 'module.queue_worker.inputs.environment'
      && fact.required === false
      && fact.defaultValue === 'dev'
      && fact.values?.includes('prod')
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'module-output'
      && fact.path === 'module.queue_worker.outputs.queue_name'
    ));
    assert.doesNotMatch(JSON.stringify(factSet), /api_token|secret_value/);
    assert.equal(parseKnowledgeFactSet(factSet).factCount, factSet.facts.length);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge fact extractor summarizes Pulumi config parameters', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-facts-pulumi-config-'));

  try {
    const source = {
      kind: 'pulumi-config',
      name: 'pulumi-config:infra/payments-api',
      localPath: 'infra/payments-api',
      module: 'infra/payments-api',
      packageName: 'payments-api'
    };
    const entry = await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'application/json',
      content: JSON.stringify({
        kind: 'infra-agent.pulumi-config-summary',
        schemaVersion: 1,
        mutationAllowed: false,
        projectRoot: 'infra/payments-api',
        projectFile: 'infra/payments-api/Pulumi.yaml',
        projectName: 'payments-api',
        stackFiles: ['infra/payments-api/Pulumi.dev.yaml'],
        declarations: [
          {
            key: 'payments-api:imageTag',
            sourcePath: 'infra/payments-api/Pulumi.yaml',
            type: 'string',
            defaultValue: 'latest'
          },
          {
            key: 'payments-api:replicas',
            sourcePath: 'infra/payments-api/Pulumi.yaml',
            type: 'integer'
          },
          {
            key: 'payments-api:apiToken',
            sourcePath: 'infra/payments-api/Pulumi.yaml',
            type: 'string'
          }
        ],
        stackValues: [
          {
            key: 'payments-api:imageTag',
            sourcePath: 'infra/payments-api/Pulumi.dev.yaml',
            stackName: 'dev',
            configured: true,
            secure: false,
            value: 'dev-2026'
          },
          {
            key: 'payments-api:replicas',
            sourcePath: 'infra/payments-api/Pulumi.dev.yaml',
            stackName: 'dev',
            configured: true,
            secure: false,
            value: '2'
          },
          {
            key: 'payments-api:signingKey',
            sourcePath: 'infra/payments-api/Pulumi.dev.yaml',
            stackName: 'dev',
            configured: true,
            secure: true,
            value: 'ciphertext'
          }
        ]
      }),
      fetchedAt: '2026-05-05T00:00:00.000Z'
    });

    const factSet = extractKnowledgeFactSetFromCacheEntry(entry);

    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'pulumi-config-parameter'
      && fact.path === 'config.payments-api:imageTag'
      && fact.type === 'string'
      && fact.defaultValue === 'latest'
      && fact.required === false
      && fact.values?.includes('dev-2026')
      && fact.relatedPaths?.includes('infra/payments-api/Pulumi.dev.yaml')
    ));
    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'pulumi-config-parameter'
      && fact.path === 'config.payments-api:replicas'
      && fact.type === 'integer'
      && fact.values?.includes('2')
    ));
    assert.doesNotMatch(JSON.stringify(factSet), /apiToken|signingKey|ciphertext/);
    assert.equal(parseKnowledgeFactSet(factSet).factCount, factSet.facts.length);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('workspace knowledge facts extract local Helm schema sources without fetching', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = await extractWorkspaceKnowledgeFacts(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    extractedAt: '2026-05-05T00:00:00.000Z'
  });

  assert.equal(report.kind, 'infra-agent.knowledge-extraction');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mutationAllowed, false);
  assert.deepEqual(report.requestedDomains, ['helm']);
  assert.deepEqual(report.targetPaths, ['charts/payments-api']);
  assert.equal(report.sourceCount, report.sources.length);
  assert.equal(report.factSetCount, report.factSets.length);
  assert.ok(report.factSetCount >= 1);
  assert.ok(report.factCount >= 5);

  const chartSchemaSource = report.sources.find(source => source.source.kind === 'chart-schema');
  assert.equal(chartSchemaSource?.status, 'extracted');
  const chartMetadataSource = report.sources.find(source => source.source.kind === 'chart-metadata');
  assert.equal(chartMetadataSource?.status, 'extracted');
  const chartSchemaFactSet = report.factSets.find(factSet => factSet.source.kind === 'chart-schema');
  assert.equal(chartSchemaFactSet?.sourceFingerprint?.fileCount, 1);
  assert.equal(chartSchemaFactSet?.sourceFingerprint?.files[0]?.path, 'charts/payments-api/values.schema.json');
  assert.equal(chartSchemaFactSet?.sourceFingerprint?.files[0]?.stale, false);
  const chartMetadataFactSet = report.factSets.find(factSet => factSet.source.kind === 'chart-metadata');
  assert.equal(chartMetadataFactSet?.sourceFingerprint?.fileCount, 1);
  assert.equal(chartMetadataFactSet?.sourceFingerprint?.files[0]?.path, 'charts/payments-api/Chart.yaml');
  assert.equal(chartMetadataFactSet?.sourceFingerprint?.files[0]?.stale, false);
  assert.ok(report.factSets.some(factSet =>
    factSet.source.kind === 'chart-schema'
    && factSet.facts.some(fact =>
      fact.kind === 'chart-value'
      && fact.path === 'chart.payments-api.image.repository'
      && fact.required === true
    )
  ));
  assert.ok(report.factSets.some(factSet =>
    factSet.source.kind === 'chart-metadata'
    && factSet.facts.some(fact =>
      fact.kind === 'chart-metadata'
      && fact.path === 'chart.payments-api.metadata.version'
      && fact.values?.includes('0.1.0')
    )
  ));
  assert.doesNotMatch(JSON.stringify(report), /"content"\s*:|apiVersion:\s*v2|replicaCount":\s*\{|"\$schema"/);
});

test('knowledge validation accepts extraction reports and rejects count drift', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const extraction = await extractWorkspaceKnowledgeFacts(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    extractedAt: '2026-05-05T00:00:00.000Z'
  });

  const validReport = validateKnowledgePayload(extraction, 'inline');
  assert.equal(validReport.kind, 'infra-agent.knowledge-validation');
  assert.equal(validReport.mutationAllowed, false);
  assert.equal(validReport.inputKind, 'infra-agent.knowledge-extraction');
  assert.equal(validReport.valid, true);
  assert.equal(validReport.factSetCount, extraction.factSetCount);
  assert.equal(validReport.factCount, extraction.factCount);
  assert.deepEqual(validReport.freshness, {
    kind: 'infra-agent.knowledge-freshness-summary',
    schemaVersion: 1,
    mutationAllowed: false,
    staleSourceCount: 0,
    uncheckedLocalSourceCount: 0,
    staleFactCount: 0,
    uncheckedFactCount: 0,
    staleSources: [],
    uncheckedLocalSources: []
  });

  const invalidReport = validateKnowledgePayload({
    ...extraction,
    factCount: extraction.factCount + 1
  }, 'inline');
  assert.equal(invalidReport.valid, false);
  assert.ok(invalidReport.issues.some(issue =>
    issue.severity === 'error'
    && issue.path === '$.factCount'
  ));
});

test('workspace knowledge extraction can use an injected knowledge store', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-extract-store-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    await mkdir(terraformRoot, { recursive: true });
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'terraform {',
        '  required_providers {',
        '    aws = {',
        '      source = "hashicorp/aws"',
        '      version = "5.37.0"',
        '    }',
        '  }',
        '}',
        '',
        'resource "aws_s3_bucket" "logs" {}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(terraformRoot, '.terraform.lock.hcl'),
      [
        'provider "registry.terraform.io/hashicorp/aws" {',
        '  version = "5.37.0"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const reads = [];
    const store = {
      root: join(tempRoot, '.infra-agent/knowledge-cache'),
      buildId: buildKnowledgeCacheId,
      read: async source => {
        reads.push(source);
        return {
          id: buildKnowledgeCacheId(source),
          source,
          contentType: 'text/markdown',
          content: [
            '# aws_s3_bucket',
            '',
            '## Argument Reference',
            '',
            '* `bucket` - (Optional) Bucket name.',
            '',
            '## Attribute Reference',
            '',
            '* `id` - Bucket identifier.',
            ''
          ].join('\n'),
          contentHash: 'b'.repeat(64),
          fetchedAt: '2026-04-28T00:00:00.000Z',
          staleAfter: '2026-05-28T00:00:00.000Z'
        };
      },
      write: async () => {
        throw new Error('extraction should not write through the knowledge store');
      },
      isStale: () => false
    };

    const inspection = await inspectWorkspace(tempRoot);
    const extraction = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      store,
      extractedAt: '2026-05-05T00:00:00.000Z'
    });
    const validation = validateKnowledgePayload(extraction, 'inline');

    assert.ok(reads.some(source => source.kind === 'terraform-registry'));
    assert.equal(extraction.cacheRoot, inspection.knowledgeCache.root);
    assert.ok(extraction.sources.some(source =>
      source.status === 'extracted'
      && source.id === buildKnowledgeCacheId(source.source)
    ));
    assert.ok(extraction.factSets.some(factSet =>
      factSet.source.kind === 'terraform-registry'
      && factSet.sourceId === buildKnowledgeCacheId(factSet.source)
      && factSet.facts.some(fact => fact.path === 'resource.aws_s3_bucket.bucket')
    ));
    assert.equal(validation.valid, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge validation rechecks local source fingerprints against a workspace', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-stale-'));

  try {
    await cp(resolve('fixtures/sample-workspace'), tempRoot, { recursive: true });
    const inspection = await inspectWorkspace(tempRoot);
    const extraction = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['helm'],
      targetPaths: ['charts/payments-api'],
      extractedAt: '2026-05-05T00:00:00.000Z'
    });

    const freshReport = await validateKnowledgePayloadWithLocalSources(extraction, 'inline', {
      workspaceRoot: tempRoot
    });
    assert.equal(freshReport.valid, true);
    assert.equal(freshReport.staleSourceCount, 0);
    assert.equal(freshReport.uncheckedLocalSourceCount, 0);

    await writeFile(
      join(tempRoot, 'charts/payments-api/Chart.yaml'),
      `${await readFile(join(tempRoot, 'charts/payments-api/Chart.yaml'), 'utf8')}\n# changed after extraction\n`
    );
    const staleReport = await validateKnowledgePayloadWithLocalSources(extraction, 'inline', {
      workspaceRoot: tempRoot
    });
    assert.equal(staleReport.valid, false);
    assert.equal(staleReport.staleSourceCount, 1);
    assert.equal(staleReport.freshness.staleSourceCount, 1);
    assert.equal(staleReport.freshness.uncheckedLocalSourceCount, 0);
    assert.equal(staleReport.freshness.staleSources.length, 1);
    assert.equal(staleReport.freshness.staleSources[0]?.sourceKind, 'chart-metadata');
    assert.equal(staleReport.freshness.staleSources[0]?.staleReason, 'local-file-hash-mismatch');
    assert.ok(staleReport.freshness.staleSources[0]?.stalePaths?.includes('charts/payments-api/Chart.yaml'));
    assert.equal(staleReport.freshness.staleSources[0]?.missingPaths?.length, 0);
    assert.ok((staleReport.freshness.staleSources[0]?.factCount ?? 0) > 0);
    assert.ok(staleReport.issues.some(issue =>
      issue.severity === 'error'
      && issue.path.endsWith('.sourceFingerprint')
      && /local-file-hash-mismatch/.test(issue.message)
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('workspace knowledge facts extract focused Terraform provider schema facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-provider-schema-facts-'));

  try {
    await writeTerraformProviderSchemaWorkspace(tempRoot);

    const inspection = await inspectWorkspace(tempRoot);
    const report = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      extractedAt: '2026-05-05T00:00:00.000Z'
    });

    const providerSchemaResult = report.sources.find(source =>
      source.source.kind === 'provider-schema'
      && source.targetPath === 'terraform/app'
    );
    assert.equal(providerSchemaResult?.status, 'extracted');
    const providerSchemaFactSet = report.factSets.find(factSet => factSet.source.kind === 'provider-schema');
    assert.ok(providerSchemaFactSet?.sourceFingerprint);
    assert.equal(providerSchemaFactSet.sourceFingerprint.fileCount, 3);
    assert.deepEqual(providerSchemaFactSet.sourceFingerprint.files.map(file => file.path), [
      'terraform/app/.infra-agent/terraform-provider-schema.json',
      'terraform/app/.terraform.lock.hcl',
      'terraform/app/main.tf'
    ]);
    assert.ok(report.factSets.some(factSet =>
      factSet.source.kind === 'provider-schema'
      && factSet.source.version === 'hashicorp/aws@5.37.0'
      && factSet.facts.some(fact =>
        fact.kind === 'argument'
        && fact.path === 'resource.aws_lb_listener_rule.listener_arn'
        && fact.required === true
        && fact.type === 'string'
      )
    ));
    assert.ok(report.factSets.some(factSet =>
      factSet.source.kind === 'provider-schema'
      && factSet.facts.some(fact =>
        fact.kind === 'argument'
        && fact.path === 'resource.aws_lb_listener_rule.priority'
        && fact.required === false
        && fact.type === 'number'
      )
    ));
    assert.ok(report.factSets.some(factSet =>
      factSet.source.kind === 'provider-schema'
      && factSet.facts.some(fact =>
        fact.kind === 'nested-block'
        && fact.path === 'resource.aws_lb_listener_rule.action'
        && fact.required === true
        && fact.values?.includes('max_items=1')
      )
    ));
    assert.doesNotMatch(JSON.stringify(report.factSets), /aws_instance|provider_schemas|"content"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('workspace knowledge facts extract Terraform local module facts without fetching', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-module-facts-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    const moduleRoot = join(terraformRoot, 'modules/queue-worker');
    await mkdir(moduleRoot, { recursive: true });
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'module "queue_worker" {',
        '  source = "./modules/queue-worker"',
        '}',
        '',
        'module "missing_module" {',
        '  source = "./modules/missing-module"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(moduleRoot, 'variables.tf'),
      [
        'variable "image_tag" {',
        '  type = string',
        '}',
        '',
        'variable "environment" {',
        '  type    = string',
        '  default = "dev"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(moduleRoot, 'outputs.tf'),
      [
        'output "queue_name" {',
        '  value = "queue"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const report = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      extractedAt: '2026-05-05T00:00:00.000Z'
    });

    assert.ok(report.sources.some(source =>
      source.source.kind === 'terraform-module'
      && source.source.packageName === 'queue_worker'
      && source.status === 'extracted'
      && source.factCount > 0
    ));
    assert.ok(report.sources.some(source =>
      source.source.kind === 'terraform-module'
      && source.source.packageName === 'missing_module'
      && source.status === 'unreadable'
    ));
    const moduleFactSet = report.factSets.find(factSet => factSet.source.kind === 'terraform-module');
    assert.ok(moduleFactSet?.sourceFingerprint);
    assert.equal(moduleFactSet.sourceFingerprint.fileCount, 3);
    assert.deepEqual(moduleFactSet.sourceFingerprint.files.map(file => file.path), [
      'terraform/app/main.tf',
      'terraform/app/modules/queue-worker/outputs.tf',
      'terraform/app/modules/queue-worker/variables.tf'
    ]);
    assert.ok(report.factSets.some(factSet =>
      factSet.source.kind === 'terraform-module'
      && factSet.facts.some(fact =>
        fact.kind === 'module-input'
        && fact.path === 'module.queue_worker.inputs.image_tag'
        && fact.required === true
      )
      && factSet.facts.some(fact =>
        fact.kind === 'module-output'
        && fact.path === 'module.queue_worker.outputs.queue_name'
      )
    ));
    assert.doesNotMatch(JSON.stringify(report), /"content"\s*:|variable "image_tag"|output "queue_name"/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('workspace knowledge facts extract Pulumi config parameters locally', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const report = await extractWorkspaceKnowledgeFacts(inspection, {
    domains: ['pulumi'],
    targetPaths: ['infra/payments-api'],
    extractedAt: '2026-05-05T00:00:00.000Z'
  });

  const pulumiConfigResult = report.sources.find(source =>
    source.source.kind === 'pulumi-config'
    && source.targetPath === 'infra/payments-api'
  );
  assert.equal(pulumiConfigResult?.status, 'extracted');
  assert.ok((pulumiConfigResult?.factCount ?? 0) > 0);
  const pulumiConfigFactSet = report.factSets.find(factSet => factSet.source.kind === 'pulumi-config');
  assert.ok(pulumiConfigFactSet?.sourceFingerprint);
  assert.deepEqual(pulumiConfigFactSet.sourceFingerprint.files.map(file => file.path), [
    'infra/payments-api/Pulumi.dev.yaml',
    'infra/payments-api/Pulumi.yaml'
  ]);
  assert.ok(report.factSets.some(factSet =>
    factSet.source.kind === 'pulumi-config'
    && factSet.facts.some(fact =>
      fact.kind === 'pulumi-config-parameter'
      && fact.path === 'config.payments-api:imageTag'
      && fact.type === 'string'
      && fact.values?.includes('latest')
    )
  ));
  assert.doesNotMatch(JSON.stringify(report), /"content"\s*:|runtime:\s*yaml|imageTag:\s*latest/);
});
