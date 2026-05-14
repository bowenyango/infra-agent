import test from 'node:test';
import assert from 'node:assert/strict';
import { rankKnowledgePackFacts } from '../../src/knowledge/fact-ranking.ts';
import { rankKnowledgePackUnits } from '../../src/knowledge/unit-ranking.ts';

test('knowledge fact ranking prioritizes local required facts before examples', () => {
  const sources = [
    {
      id: 'provider-schema-source',
      domain: 'terraform',
      targetPath: 'terraform/app',
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/app',
      factCount: 2,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'registry-source',
      domain: 'terraform',
      targetPath: 'terraform/app',
      kind: 'terraform-registry',
      name: 'resource:aws_lb_listener_rule',
      factCount: 1,
      contentHash: 'b'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false
    }
  ];
  const ranked = rankKnowledgePackFacts([
    {
      kind: 'example',
      path: 'resource.aws_lb_listener_rule.example',
      summary: 'Example listener rule configuration.',
      confidence: 'medium',
      extractionMethod: 'terraform-registry-markdown',
      sourceId: 'registry-source',
      sourceLocator: 'Example Usage'
    },
    {
      kind: 'argument',
      path: 'resource.aws_lb_listener_rule.listener_arn',
      summary: 'resource.aws_lb_listener_rule.listener_arn is required by the Terraform provider schema.',
      confidence: 'high',
      extractionMethod: 'terraform-provider-schema',
      sourceId: 'provider-schema-source',
      sourceLocator: 'provider schema: resource.aws_lb_listener_rule.listener_arn',
      required: true,
      type: 'string'
    }
  ], {
    sources,
    requestedDomains: ['terraform'],
    targetPaths: ['terraform/app']
  });

  assert.equal(ranked[0]?.path, 'resource.aws_lb_listener_rule.listener_arn');
  assert.equal(ranked[1]?.path, 'resource.aws_lb_listener_rule.example');
});

test('knowledge fact ranking is deterministic across target order and staleness', () => {
  const sources = [
    {
      id: 'target-b',
      domain: 'terraform',
      targetPath: 'terraform/b',
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/b',
      factCount: 1,
      contentHash: 'b'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'target-a',
      domain: 'terraform',
      targetPath: 'terraform/a',
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/a',
      factCount: 1,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'stale-schema',
      domain: 'terraform',
      targetPath: 'terraform/a',
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/a-stale',
      factCount: 1,
      contentHash: 'c'.repeat(64),
      fetchedAt: '2026-04-01T00:00:00.000Z',
      stale: true
    },
    {
      id: 'fresh-registry',
      domain: 'terraform',
      targetPath: 'terraform/a',
      kind: 'terraform-registry',
      name: 'resource:aws_lb_listener_rule',
      factCount: 1,
      contentHash: 'd'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false
    }
  ];
  const ranked = rankKnowledgePackFacts([
    {
      kind: 'argument',
      path: 'resource.aws_lb_listener_rule.listener_arn',
      summary: 'listener_arn is required.',
      confidence: 'high',
      extractionMethod: 'terraform-provider-schema',
      sourceId: 'target-b',
      sourceLocator: 'provider schema: listener_arn',
      required: true,
      type: 'string'
    },
    {
      kind: 'argument',
      path: 'resource.aws_lb_listener_rule.listener_arn',
      summary: 'listener_arn is required.',
      confidence: 'high',
      extractionMethod: 'terraform-provider-schema',
      sourceId: 'target-a',
      sourceLocator: 'provider schema: listener_arn',
      required: true,
      type: 'string'
    },
    {
      kind: 'argument',
      path: 'resource.aws_lb_listener_rule.priority',
      summary: 'priority is required.',
      confidence: 'medium',
      extractionMethod: 'terraform-provider-schema',
      sourceId: 'stale-schema',
      sourceLocator: 'provider schema: priority',
      required: true,
      type: 'number'
    },
    {
      kind: 'example',
      path: 'resource.aws_lb_listener_rule.example',
      summary: 'Example listener rule configuration.',
      confidence: 'high',
      extractionMethod: 'terraform-registry-markdown',
      sourceId: 'fresh-registry',
      sourceLocator: 'Example Usage'
    }
  ], {
    sources,
    requestedDomains: ['terraform'],
    targetPaths: ['terraform/a', 'terraform/b']
  });

  assert.equal(ranked[0]?.sourceId, 'target-a');
  assert.equal(ranked[1]?.sourceId, 'target-b');
  assert.ok(
    ranked.findIndex(fact => fact.sourceId === 'stale-schema')
    < ranked.findIndex(fact => fact.sourceId === 'fresh-registry')
  );
});

test('knowledge fact ranking places required module inputs before examples', () => {
  const sources = [
    {
      id: 'provider-schema-source',
      domain: 'terraform',
      targetPath: 'terraform/app',
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/app',
      factCount: 1,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'module-source',
      domain: 'terraform',
      targetPath: 'terraform/app',
      kind: 'terraform-module',
      name: 'terraform-module:terraform/app:queue_worker',
      factCount: 1,
      contentHash: 'b'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'registry-source',
      domain: 'terraform',
      targetPath: 'terraform/app',
      kind: 'terraform-registry',
      name: 'resource:aws_sqs_queue',
      factCount: 1,
      contentHash: 'c'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false
    }
  ];
  const ranked = rankKnowledgePackFacts([
    {
      kind: 'example',
      path: 'resource.aws_sqs_queue.example',
      summary: 'Queue example.',
      confidence: 'high',
      extractionMethod: 'terraform-registry-markdown',
      sourceId: 'registry-source',
      sourceLocator: 'Example Usage'
    },
    {
      kind: 'module-input',
      path: 'module.queue_worker.inputs.image_tag',
      summary: 'module.queue_worker.inputs.image_tag is required by the local Terraform module interface.',
      required: true,
      type: 'string',
      confidence: 'high',
      extractionMethod: 'repo-local-static',
      sourceId: 'module-source',
      sourceLocator: 'variables.tf: variable.image_tag'
    },
    {
      kind: 'argument',
      path: 'resource.aws_sqs_queue.name',
      summary: 'resource.aws_sqs_queue.name is required by the Terraform provider schema.',
      required: true,
      type: 'string',
      confidence: 'high',
      extractionMethod: 'terraform-provider-schema',
      sourceId: 'provider-schema-source',
      sourceLocator: 'provider schema: resource.aws_sqs_queue.name'
    }
  ], {
    sources,
    requestedDomains: ['terraform'],
    targetPaths: ['terraform/app']
  });

  assert.equal(ranked[0]?.path, 'resource.aws_sqs_queue.name');
  assert.equal(ranked[1]?.path, 'module.queue_worker.inputs.image_tag');
  assert.equal(ranked[2]?.path, 'resource.aws_sqs_queue.example');
  assert.ok(ranked.every(fact => !('rank' in fact)));
});

test('knowledge fact ranking places Pulumi config parameters before examples', () => {
  const sources = [
    {
      id: 'pulumi-config-source',
      domain: 'pulumi',
      targetPath: 'infra/payments-api',
      kind: 'pulumi-config',
      name: 'pulumi-config:infra/payments-api',
      factCount: 1,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'pulumi-docs-source',
      domain: 'pulumi',
      targetPath: 'infra/payments-api',
      kind: 'pulumi-docs',
      name: 'pulumi-config-docs',
      factCount: 1,
      contentHash: 'b'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false
    }
  ];
  const ranked = rankKnowledgePackFacts([
    {
      kind: 'example',
      path: 'pulumi.config.example',
      summary: 'Pulumi config example.',
      confidence: 'high',
      extractionMethod: 'repo-local-static',
      sourceId: 'pulumi-docs-source',
      sourceLocator: 'Pulumi config docs'
    },
    {
      kind: 'pulumi-config-parameter',
      path: 'config.payments-api:imageTag',
      summary: 'config.payments-api:imageTag is declared by Pulumi project config.',
      confidence: 'high',
      extractionMethod: 'repo-local-static',
      sourceId: 'pulumi-config-source',
      sourceLocator: 'infra/payments-api/Pulumi.yaml: config.payments-api:imageTag',
      type: 'string',
      values: ['latest']
    }
  ], {
    sources,
    requestedDomains: ['pulumi'],
    targetPaths: ['infra/payments-api']
  });

  assert.equal(ranked[0]?.path, 'config.payments-api:imageTag');
  assert.equal(ranked[1]?.path, 'pulumi.config.example');
});

test('knowledge fact ranking places Pulumi config before package docs guidance', () => {
  const sources = [
    {
      id: 'pulumi-config-source',
      domain: 'pulumi',
      targetPath: 'infra/payments-api',
      kind: 'pulumi-config',
      name: 'pulumi-config:infra/payments-api',
      factCount: 1,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'pulumi-package-docs-source',
      domain: 'pulumi',
      targetPath: 'infra/payments-api',
      kind: 'pulumi-docs',
      name: 'pulumi-docs:package:aws',
      factCount: 1,
      contentHash: 'b'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false
    }
  ];
  const ranked = rankKnowledgePackFacts([
    {
      kind: 'pulumi-docs-guidance',
      path: 'pulumi.package.aws.s3',
      summary: 'S3 resources for buckets and objects.',
      confidence: 'medium',
      extractionMethod: 'pulumi-docs-markdown',
      sourceId: 'pulumi-package-docs-source',
      sourceLocator: 'Pulumi package docs: s3',
      values: ['s3']
    },
    {
      kind: 'pulumi-config-parameter',
      path: 'config.payments-api:imageTag',
      summary: 'config.payments-api:imageTag is declared by Pulumi project config.',
      confidence: 'high',
      extractionMethod: 'repo-local-static',
      sourceId: 'pulumi-config-source',
      sourceLocator: 'infra/payments-api/Pulumi.yaml: config.payments-api:imageTag',
      type: 'string',
      values: ['latest']
    }
  ], {
    sources,
    requestedDomains: ['pulumi'],
    targetPaths: ['infra/payments-api']
  });

  assert.equal(ranked[0]?.path, 'config.payments-api:imageTag');
  assert.equal(ranked[1]?.path, 'pulumi.package.aws.s3');
});

test('knowledge fact ranking places Helm dependency facts before chart docs examples', () => {
  const sources = [
    {
      id: 'chart-metadata-source',
      domain: 'helm',
      targetPath: 'charts/api',
      kind: 'chart-metadata',
      name: 'api:Chart.yaml',
      factCount: 1,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'chart-docs-source',
      domain: 'helm',
      targetPath: 'charts/api',
      kind: 'chart-docs',
      name: 'api:dependency:redis',
      factCount: 1,
      contentHash: 'b'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false
    }
  ];
  const ranked = rankKnowledgePackFacts([
    {
      kind: 'example',
      path: 'chart.api.example',
      summary: 'Helm chart dependency example.',
      confidence: 'high',
      extractionMethod: 'repo-local-static',
      sourceId: 'chart-docs-source',
      sourceLocator: 'chart docs'
    },
    {
      kind: 'chart-dependency',
      path: 'chart.api.dependencies.redis',
      summary: 'chart.api locked Helm dependency redis.',
      confidence: 'high',
      extractionMethod: 'repo-local-static',
      sourceId: 'chart-metadata-source',
      sourceLocator: 'charts/api/Chart.lock: dependencies.redis',
      values: ['version=17.3.1', 'locked=true']
    }
  ], {
    sources,
    requestedDomains: ['helm'],
    targetPaths: ['charts/api']
  });

  assert.equal(ranked[0]?.path, 'chart.api.dependencies.redis');
  assert.equal(ranked[1]?.path, 'chart.api.example');
});

test('knowledge unit ranking prioritizes required facts and diagnostics before examples', () => {
  const sources = [
    {
      id: 'chart-schema-source',
      domain: 'helm',
      targetPath: 'charts/api',
      kind: 'chart-schema',
      name: 'api:values.schema.json',
      factCount: 2,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'chart-docs-source',
      domain: 'helm',
      targetPath: 'charts/api',
      kind: 'chart-docs',
      name: 'api:docs',
      factCount: 2,
      contentHash: 'b'.repeat(64),
      fetchedAt: '2026-05-05T00:00:00.000Z',
      stale: false
    }
  ];
  const base = {
    path: 'charts/api',
    summary: 'Helm unit ranking input.',
    confidence: 'high',
    sourceId: 'chart-docs-source',
    sourceLocator: 'chart docs',
    privacyScope: 'public-reference'
  };
  const ranked = rankKnowledgePackUnits([
    {
      ...base,
      unitType: 'example',
      exampleType: 'helm-values',
      snippet: 'replicaCount: 2',
      extractionMethod: 'official-example',
      language: 'yaml'
    },
    {
      ...base,
      unitType: 'guidance',
      topic: 'Helm values updates',
      extractionMethod: 'official-guidance',
      appliesWhen: ['values.yaml changes']
    },
    {
      ...base,
      unitType: 'diagnostic',
      engine: 'helm',
      signature: 'template render failure',
      likelyCause: 'Values do not match template assumptions.',
      recommendedReview: ['Run helm template for the selected chart.'],
      extractionMethod: 'validation-diagnostic'
    },
    {
      ...base,
      unitType: 'fact',
      factKind: 'chart-value',
      path: 'values.service.port',
      summary: 'values.service.port is required by chart templates.',
      confidence: 'medium',
      extractionMethod: 'helm-values-schema',
      sourceId: 'chart-schema-source',
      sourceLocator: 'values.schema.json: service.port',
      privacyScope: 'workspace-private',
      required: true,
      type: 'number',
      values: ['8080']
    }
  ], {
    sources,
    requestedDomains: ['helm'],
    targetPaths: ['charts/api']
  });

  assert.deepEqual(ranked.map(unit => unit.unitType), ['fact', 'diagnostic', 'guidance', 'example']);
  assert.equal(ranked[0]?.path, 'values.service.port');
  assert.deepEqual(ranked[1]?.recommendedReview, ['Run helm template for the selected chart.']);
  assert.ok(ranked.every(unit => !('rank' in unit)));
});

test('knowledge unit ranking applies target and stale priorities deterministically', () => {
  const sources = [
    {
      id: 'target-a',
      domain: 'terraform',
      targetPath: 'terraform/a',
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/a',
      factCount: 1,
      contentHash: 'a'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'target-b',
      domain: 'terraform',
      targetPath: 'terraform/b',
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/b',
      factCount: 1,
      contentHash: 'b'.repeat(64),
      fetchedAt: null,
      stale: false
    },
    {
      id: 'target-a-stale',
      domain: 'terraform',
      targetPath: 'terraform/a',
      kind: 'provider-schema',
      name: 'terraform-provider-schema:terraform/a-stale',
      factCount: 1,
      contentHash: 'c'.repeat(64),
      fetchedAt: '2026-04-01T00:00:00.000Z',
      stale: true
    }
  ];
  const base = {
    unitType: 'guidance',
    topic: 'Terraform argument review',
    path: 'resource.aws_lb_listener_rule.priority',
    summary: 'Review listener rule priority before applying changes.',
    confidence: 'high',
    extractionMethod: 'official-guidance',
    sourceLocator: 'provider docs',
    privacyScope: 'public-reference',
    appliesWhen: ['listener rule priority changes']
  };
  const ranked = rankKnowledgePackUnits([
    {
      ...base,
      sourceId: 'target-a-stale'
    },
    {
      ...base,
      sourceId: 'target-b'
    },
    {
      ...base,
      sourceId: 'target-a'
    }
  ], {
    sources,
    requestedDomains: ['terraform'],
    targetPaths: ['terraform/a']
  });

  assert.deepEqual(ranked.map(unit => unit.sourceId), ['target-a', 'target-b', 'target-a-stale']);
});
