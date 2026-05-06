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
import { writeTerraformProviderSchemaWorkspace } from '../support/terraform-provider-schema-workspace.mjs';
import { runSingleStep } from '../../src/agent/run-single-step.ts';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { buildTerraformRegistryKnowledgeSources } from '../../src/domain/terraform-registry-context.ts';
import {
  buildKnowledgeCacheId,
  readKnowledgeCacheEntry,
  writeKnowledgeCacheEntry
} from '../../src/knowledge/cache.ts';
import { prefetchWorkspaceKnowledge } from '../../src/knowledge/prefetch.ts';

test('agent runtime loads cached Terraform Registry context for Terraform tasks', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-context-runtime-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    await mkdir(terraformRoot, { recursive: true });
    await writeFile(
      join(tempRoot, 'infra-agent.config.json'),
      JSON.stringify({
        knowledgeCache: {
          root: '.infra-agent/knowledge-cache'
        }
      }, null, 2),
      'utf8'
    );
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'terraform {',
        '  required_providers {',
        '    aws = {',
        '      source = "hashicorp/aws"',
        '    }',
        '  }',
        '}',
        '',
        'resource "aws_instance" "api" {}',
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
    const inspection = await inspectWorkspace(tempRoot);
    const root = inspection.terraformRoots.find(candidate => candidate.rootPath === 'terraform/app');
    assert.ok(root);
    const source = (await buildTerraformRegistryKnowledgeSources(tempRoot, root))[0];
    assert.ok(source);
    await writeKnowledgeCacheEntry(inspection.knowledgeCache.root, {
      source,
      contentType: 'text/markdown',
      content: '# aws_instance\nCached docs for planning.',
      fetchedAt: '2026-04-28T00:00:00.000Z',
      staleAfter: '2026-05-28T00:00:00.000Z'
    });

    const checkingModel = {
      name: 'context-check',
      async decideNextAction({ runtime }) {
        assert.ok(runtime.retrievedContext.some(packet =>
          packet.source.kind === 'terraform-registry'
          && packet.source.name === 'resource:aws_instance'
          && packet.confidence === 'high'
        ));
        return {
          confidence: 'high',
          action: {
            kind: 'stop',
            summary: 'Context checked.',
            rationale: 'The runtime loaded cached Terraform Registry context.',
            payload: {
              stopReason: 'no-safe-action'
            }
          }
        };
      }
    };
    const result = await runSingleStep('update terraform aws instance', tempRoot, checkingModel);

    assert.ok(result.runtime.retrievedContext.some(packet => packet.source.name === 'resource:aws_instance'));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('agent runtime loads Helm chart schema context for Helm tasks', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-context-runtime-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'values.schema.json'),
      [
        '{',
        '  "type": "object",',
        '  "required": ["image"],',
        '  "properties": {',
        '    "image": {',
        '      "type": "object",',
        '      "required": ["repository", "tag"],',
        '      "properties": {',
        '        "repository": { "type": "string" },',
        '        "tag": { "type": "string" }',
        '      }',
        '    }',
        '  }',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const checkingModel = {
      name: 'helm-context-check',
      async decideNextAction({ runtime }) {
        assert.ok(runtime.retrievedContext.some(packet =>
          packet.source.kind === 'chart-schema'
          && packet.source.localPath === 'charts/api/values.schema.json'
          && packet.confidence === 'high'
          && packet.contentType === 'application/json'
          && packet.excerpt.includes('"repository"')
        ));
        assert.ok(runtime.knowledgeFacts);
        assert.ok(runtime.knowledgeFacts.facts.some(fact =>
          fact.kind === 'chart-value'
          && fact.path === 'chart.api.image.repository'
          && fact.required === true
        ));
        return {
          confidence: 'high',
          action: {
            kind: 'stop',
            summary: 'Context checked.',
            rationale: 'The runtime loaded local Helm chart schema context.',
            payload: {
              stopReason: 'no-safe-action'
            }
          }
        };
      }
    };
    const result = await runSingleStep('update helm chart image repository', tempRoot, checkingModel);

    assert.ok(result.runtime.retrievedContext.some(packet =>
      packet.source.kind === 'chart-schema'
      && packet.source.name === 'api:values.schema.json'
    ));
    assert.ok(result.runtime.knowledgeFacts);
    assert.equal(result.runtime.knowledgeFacts.requestedDomains.includes('helm'), true);
    assert.equal(result.runtime.knowledgeFacts.targetPaths.includes('charts/api'), true);
    assert.ok(result.runtime.knowledgeFacts.facts.some(fact => fact.path === 'chart.api.image.tag'));
    assert.doesNotMatch(JSON.stringify(result.runtime.knowledgeFacts), /"content"\s*:|"\$schema"|repository":\s*\{/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('agent runtime loads Helm chart metadata and dependency knowledge facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-metadata-runtime-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        'dependencies:',
        '  - name: redis',
        '    version: 17.3.0',
        '    repository: https://charts.bitnami.com/bitnami',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'Chart.lock'),
      [
        'dependencies:',
        '  - name: redis',
        '    version: 17.3.1',
        '    repository: https://charts.bitnami.com/bitnami',
        'digest: sha256:abc123',
        'generated: "2026-04-28T00:00:00Z"',
        ''
      ].join('\n'),
      'utf8'
    );

    const checkingModel = {
      name: 'helm-metadata-knowledge-check',
      async decideNextAction({ runtime }) {
        assert.ok(runtime.knowledgeFacts);
        assert.equal(runtime.knowledgeFacts.requestedDomains.includes('helm'), true);
        assert.equal(runtime.knowledgeFacts.targetPaths.includes('charts/api'), true);
        assert.ok(runtime.knowledgeFacts.sources.some(source =>
          source.kind === 'chart-metadata'
          && source.targetPath === 'charts/api'
          && source.factCount > 0
        ));
        assert.ok(runtime.knowledgeFacts.facts.some(fact =>
          fact.kind === 'chart-metadata'
          && fact.path === 'chart.api.metadata.version'
          && fact.values?.includes('0.2.0')
        ));
        assert.ok(runtime.knowledgeFacts.facts.some(fact =>
          fact.kind === 'chart-dependency'
          && fact.path === 'chart.api.dependencies.redis'
          && fact.values?.includes('version=17.3.1')
          && fact.values?.includes('locked=true')
        ));
        assert.doesNotMatch(JSON.stringify(runtime.knowledgeFacts), /"content"\s*:|apiVersion:\s*v2|digest:\s*sha256|generated:/);
        return {
          confidence: 'high',
          action: {
            kind: 'stop',
            summary: 'Helm metadata facts checked.',
            rationale: 'The runtime loaded compact Helm chart metadata and dependency facts.',
            payload: {
              stopReason: 'no-safe-action'
            }
          }
        };
      }
    };

    const result = await runSingleStep('update helm dependency redis version', tempRoot, checkingModel);

    assert.ok(result.runtime.knowledgeFacts?.facts.some(fact =>
      fact.kind === 'chart-dependency'
      && fact.path === 'chart.api.dependencies.redis'
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('agent runtime loads focused Terraform provider schema knowledge facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-runtime-provider-schema-facts-'));

  try {
    await writeTerraformProviderSchemaWorkspace(tempRoot);

    const checkingModel = {
      name: 'terraform-provider-schema-knowledge-check',
      async decideNextAction({ runtime }) {
        assert.ok(runtime.knowledgeFacts);
        assert.equal(runtime.knowledgeFacts.requestedDomains.includes('terraform'), true);
        assert.equal(runtime.knowledgeFacts.targetPaths.includes('terraform/app'), true);
        assert.ok(runtime.knowledgeFacts.facts.some(fact =>
          fact.extractionMethod === 'terraform-provider-schema'
          && fact.path === 'resource.aws_lb_listener_rule.listener_arn'
          && fact.required === true
        ));
        assert.ok(runtime.knowledgeFacts.facts.some(fact =>
          fact.kind === 'nested-block'
          && fact.path === 'resource.aws_lb_listener_rule.action'
        ));
        assert.doesNotMatch(JSON.stringify(runtime.knowledgeFacts), /aws_instance|provider_schemas|"content"\s*:/);
        return {
          confidence: 'high',
          action: {
            kind: 'stop',
            summary: 'Provider schema facts checked.',
            rationale: 'The runtime loaded focused Terraform provider schema facts.',
            payload: {
              stopReason: 'no-safe-action'
            }
          }
        };
      }
    };

    const result = await runSingleStep(
      'update terraform app listener rule priority',
      tempRoot,
      checkingModel
    );

    assert.ok(result.runtime.knowledgeFacts?.facts.some(fact =>
      fact.path === 'resource.aws_lb_listener_rule.priority'
      && fact.extractionMethod === 'terraform-provider-schema'
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('agent runtime loads Terraform local module knowledge facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-runtime-terraform-module-facts-'));

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
        ''
      ].join('\n'),
      'utf8'
    );

    const checkingModel = {
      name: 'terraform-module-knowledge-check',
      async decideNextAction({ runtime }) {
        assert.ok(runtime.knowledgeFacts);
        assert.equal(runtime.knowledgeFacts.requestedDomains.includes('terraform'), true);
        assert.equal(runtime.knowledgeFacts.targetPaths.includes('terraform/app'), true);
        assert.ok(runtime.knowledgeFacts.facts.some(fact =>
          fact.kind === 'module-input'
          && fact.path === 'module.queue_worker.inputs.image_tag'
          && fact.required === true
        ));
        assert.doesNotMatch(JSON.stringify(runtime.knowledgeFacts), /variable "image_tag"|"content"\s*:/);
        return {
          confidence: 'high',
          action: {
            kind: 'stop',
            summary: 'Terraform module facts checked.',
            rationale: 'The runtime loaded local Terraform module facts.',
            payload: {
              stopReason: 'no-safe-action'
            }
          }
        };
      }
    };

    const result = await runSingleStep(
      'update terraform app queue worker image tag',
      tempRoot,
      checkingModel
    );

    assert.ok(result.runtime.knowledgeFacts?.facts.some(fact =>
      fact.path === 'module.queue_worker.source'
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('agent runtime loads Pulumi config knowledge facts', async () => {
  const checkingModel = {
    name: 'pulumi-config-knowledge-check',
    async decideNextAction({ runtime }) {
      assert.ok(runtime.knowledgeFacts);
      assert.equal(runtime.knowledgeFacts.requestedDomains.includes('pulumi'), true);
      assert.equal(runtime.knowledgeFacts.targetPaths.includes('infra/payments-api'), true);
      assert.ok(runtime.knowledgeFacts.facts.some(fact =>
        fact.kind === 'pulumi-config-parameter'
        && fact.path === 'config.payments-api:imageTag'
        && fact.type === 'string'
        && fact.values?.includes('latest')
      ));
      assert.doesNotMatch(JSON.stringify(runtime.knowledgeFacts), /"content"\s*:|runtime:\s*yaml|imageTag:\s*latest/);
      return {
        confidence: 'high',
        action: {
          kind: 'stop',
          summary: 'Pulumi config facts checked.',
          rationale: 'The runtime loaded local Pulumi config facts.',
          payload: {
            stopReason: 'no-safe-action'
          }
        }
      };
    }
  };

  const result = await runSingleStep(
    'update pulumi payments-api dev image tag',
    'fixtures/sample-workspace',
    checkingModel
  );

  assert.ok(result.runtime.knowledgeFacts?.facts.some(fact =>
    fact.path === 'config.payments-api:environment'
  ));
});

test('agent runtime loads knowledge facts for generic tasks with selected targets', async () => {
  const checkingModel = {
    name: 'generic-target-knowledge-check',
    async decideNextAction({ runtime }) {
      assert.deepEqual(runtime.preflight.requestedDomains, []);
      assert.ok(runtime.knowledgeFacts);
      assert.deepEqual(runtime.knowledgeFacts.requestedDomains, ['helm']);
      assert.equal(runtime.knowledgeFacts.targetPaths.includes('charts/payments-api'), true);
      assert.ok(runtime.knowledgeFacts.facts.some(fact => fact.path === 'chart.payments-api.image.repository'));
      return {
        confidence: 'high',
        action: {
          kind: 'stop',
          summary: 'Generic target facts checked.',
          rationale: 'Knowledge facts loaded from the selected target domain.',
          payload: {
            stopReason: 'no-safe-action'
          }
        }
      };
    }
  };

  const result = await runSingleStep(
    'update api image repository',
    'fixtures/sample-workspace',
    checkingModel,
    'rule-based',
    undefined,
    {
      retrievedContextBudget: {
        maxFacts: 2
      }
    }
  );

  assert.deepEqual(result.preflight.requestedDomains, []);
  assert.ok(result.runtime.knowledgeFacts);
  assert.deepEqual(result.runtime.knowledgeFacts.requestedDomains, ['helm']);
  assert.ok(result.runtime.knowledgeFacts.targetPaths.includes('charts/payments-api'));
});

test('knowledge prefetch fetches bounded external docs and skips local schema', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-prefetch-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(terraformRoot, { recursive: true });
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(tempRoot, 'infra-agent.config.json'),
      JSON.stringify({
        knowledgeCache: {
          root: '.infra-agent/knowledge-cache'
        }
      }, null, 2),
      'utf8'
    );
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'terraform {',
        '  required_providers {',
        '    aws = {',
        '      source = "hashicorp/aws"',
        '    }',
        '  }',
        '}',
        '',
        'resource "aws_instance" "api" {}',
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
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        'home: https://example.com/api-chart',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'values.schema.json'),
      '{"type":"object","required":["image"]}\n',
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const result = await prefetchWorkspaceKnowledge(inspection, {
      domains: ['terraform', 'helm'],
      targetPaths: ['terraform/app', 'charts/api'],
      maxSources: 2,
      fetcher: async source => ({
        source,
        contentType: 'text/markdown',
        content: `# ${source.name}\nPrefetched docs for ${source.kind}.`,
        fetchedAt: '2026-04-28T00:00:00.000Z',
        staleAfter: '2026-05-28T00:00:00.000Z'
      })
    });

    assert.equal(result.kind, 'infra-agent.knowledge-prefetch');
    assert.equal(result.summary.fetched, 2);
    assert.equal(result.summary.local, 2);
    assert.equal(result.summary.skipped, 1);
    assert.equal(result.summary.failed, 0);
    assert.equal(result.cacheRoot, join(tempRoot, '.infra-agent/knowledge-cache'));
    assert.ok(result.sources.some(source =>
      source.status === 'local'
      && source.source.kind === 'chart-schema'
      && source.source.localPath === 'charts/api/values.schema.json'
    ));
    assert.ok(result.sources.some(source =>
      source.status === 'local'
      && source.source.kind === 'chart-metadata'
      && source.source.localPath === 'charts/api/Chart.yaml'
    ));
    const fetchedTerraform = result.sources.find(source =>
      source.status === 'fetched'
      && source.source.kind === 'terraform-registry'
    );
    assert.ok(fetchedTerraform);
    const cachedTerraform = await readKnowledgeCacheEntry(result.cacheRoot, fetchedTerraform.source);
    assert.match(cachedTerraform?.content ?? '', /Prefetched docs/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge prefetch can use an injected knowledge store', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-prefetch-store-'));

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

    const inspection = await inspectWorkspace(tempRoot);
    const writes = [];
    const store = {
      root: inspection.knowledgeCache.root,
      buildId: buildKnowledgeCacheId,
      read: async () => null,
      write: async input => {
        const entry = {
          id: buildKnowledgeCacheId(input.source),
          source: input.source,
          contentType: input.contentType,
          content: input.content,
          contentHash: 'c'.repeat(64),
          fetchedAt: input.fetchedAt ?? '2026-04-28T00:00:00.000Z',
          ...(input.staleAfter !== undefined ? { staleAfter: input.staleAfter } : {})
        };
        writes.push(entry);
        return entry;
      },
      isStale: () => false
    };

    const result = await prefetchWorkspaceKnowledge(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      maxSources: 1,
      store,
      fetcher: async source => ({
        source,
        contentType: 'text/markdown',
        content: `# ${source.name}\nInjected store prefetch.`,
        fetchedAt: '2026-04-28T00:00:00.000Z',
        staleAfter: '2026-05-28T00:00:00.000Z'
      })
    });

    assert.equal(result.cacheRoot, inspection.knowledgeCache.root);
    assert.equal(result.summary.fetched, 1);
    assert.equal(writes.length, 1);
    assert.ok(result.sources.some(source =>
      source.status === 'fetched'
      && source.source.kind === 'terraform-registry'
    ));
    assert.equal(await readKnowledgeCacheEntry(result.cacheRoot, writes[0].source), null);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
