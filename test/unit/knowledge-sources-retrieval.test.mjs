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
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import {
  buildKnowledgeCacheId,
  readKnowledgeCacheEntry,
  writeKnowledgeCacheEntry
} from '../../src/knowledge/cache.ts';
import {
  fetchOfficialKnowledgeSource,
  retrieveKnowledgeContextPacket
} from '../../src/knowledge/retrieve.ts';
import {
  buildTerraformRegistryKnowledgeSources,
  retrieveTerraformRegistryContextPackets
} from '../../src/domain/terraform-registry-context.ts';
import {
  buildTerraformLocalModuleKnowledgeContent,
  buildTerraformLocalModuleKnowledgeSources
} from '../../src/domain/terraform-local-modules.ts';
import {
  buildTerraformProviderSchemaKnowledgeSources,
  retrieveTerraformProviderSchemaContextPackets
} from '../../src/domain/terraform-provider-schema.ts';
import {
  buildPulumiConfigKnowledgeContent,
  buildPulumiConfigKnowledgeSources
} from '../../src/domain/pulumi-config-knowledge.ts';
import {
  buildHelmChartMetadataKnowledgeContent,
  buildHelmChartKnowledgeSources,
  retrieveHelmChartContextPackets
} from '../../src/domain/helm-chart-context.ts';
import { prefetchWorkspaceKnowledge } from '../../src/knowledge/prefetch.ts';

test('knowledge context retrieval uses fresh cache entries before fetching', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-retrieve-fresh-'));

  try {
    const source = {
      kind: 'pulumi-docs',
      name: 'config',
      packageName: '@pulumi/pulumi',
      version: '3.0.0',
      url: 'https://www.pulumi.com/docs/iac/concepts/config/'
    };
    await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'text/markdown',
      content: '# Pulumi Config\nUse stack config for environment-specific values.',
      fetchedAt: '2026-04-28T00:00:00.000Z',
      staleAfter: '2026-05-28T00:00:00.000Z'
    });
    const packet = await retrieveKnowledgeContextPacket({
      cacheRoot: tempRoot,
      source,
      reason: 'Pulumi stack config task',
      now: new Date('2026-05-01T00:00:00.000Z')
    });

    assert.ok(packet);
    assert.equal(packet.confidence, 'high');
    assert.match(packet.excerpt ?? '', /Pulumi Config/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge context retrieval fetches missing sources and writes cache', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-retrieve-fetch-'));

  try {
    const source = {
      kind: 'terraform-registry',
      name: 'aws_instance',
      provider: 'hashicorp/aws',
      version: '5.0.0',
      url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/instance'
    };
    const packet = await retrieveKnowledgeContextPacket({
      cacheRoot: tempRoot,
      source,
      reason: 'Terraform resource docs',
      fetcher: async fetchedSource => ({
        source: fetchedSource,
        contentType: 'text/markdown',
        content: '# aws_instance\nInstance docs.',
        fetchedAt: '2026-04-28T00:00:00.000Z',
        staleAfter: '2026-05-28T00:00:00.000Z'
      })
    });
    const cached = await readKnowledgeCacheEntry(tempRoot, source);

    assert.ok(packet);
    assert.equal(packet?.confidence, 'high');
    assert.match(packet?.excerpt ?? '', /aws_instance/);
    assert.ok(cached);
    assert.equal(cached?.content, '# aws_instance\nInstance docs.');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge context retrieval can use an injected knowledge store', async () => {
  const source = {
    kind: 'terraform-registry',
    name: 'aws_lb_listener_rule',
    provider: 'hashicorp/aws',
    version: '5.37.0',
    url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lb_listener_rule'
  };
  const calls = [];
  const writtenEntries = [];
  const store = {
    root: 'memory://knowledge-store',
    buildId: buildKnowledgeCacheId,
    read: async readSource => {
      calls.push(`read:${readSource.name}`);
      return null;
    },
    write: async input => {
      calls.push(`write:${input.source.name}`);
      const entry = {
        id: buildKnowledgeCacheId(input.source),
        source: input.source,
        contentType: input.contentType,
        content: input.content,
        contentHash: 'd'.repeat(64),
        fetchedAt: input.fetchedAt ?? '2026-04-28T00:00:00.000Z',
        ...(input.staleAfter !== undefined ? { staleAfter: input.staleAfter } : {})
      };
      writtenEntries.push(entry);
      return entry;
    },
    isStale: () => false
  };
  const packet = await retrieveKnowledgeContextPacket({
    store,
    source,
    reason: 'Terraform listener rule planning',
    fetcher: async fetchedSource => ({
      source: fetchedSource,
      contentType: 'text/markdown',
      content: '# aws_lb_listener_rule\nPriority and listener ARN docs.',
      fetchedAt: '2026-04-28T00:00:00.000Z',
      staleAfter: '2026-05-28T00:00:00.000Z'
    })
  });

  assert.deepEqual(calls, ['read:aws_lb_listener_rule', 'write:aws_lb_listener_rule']);
  assert.equal(writtenEntries.length, 1);
  assert.equal(packet?.id, buildKnowledgeCacheId(source));
  assert.equal(packet?.confidence, 'high');
  assert.match(packet?.excerpt ?? '', /Priority and listener ARN/);
});

test('knowledge context retrieval checks injected stores before fetching', async () => {
  const source = {
    kind: 'helm-docs',
    name: 'values.schema.json',
    chart: 'payments-api',
    version: '3.14.0',
    url: 'https://helm.sh/docs/topics/charts/'
  };
  let fetchCalled = false;
  const store = {
    root: 'memory://knowledge-store',
    buildId: buildKnowledgeCacheId,
    read: async readSource => ({
      id: buildKnowledgeCacheId(readSource),
      source: readSource,
      contentType: 'text/markdown',
      content: '# Helm values schema\nUse JSON Schema for chart values.',
      contentHash: 'e'.repeat(64),
      fetchedAt: '2026-04-28T00:00:00.000Z',
      staleAfter: '2026-05-28T00:00:00.000Z'
    }),
    write: async () => {
      throw new Error('fresh cache should not be rewritten');
    },
    isStale: () => false
  };
  const packet = await retrieveKnowledgeContextPacket({
    store,
    source,
    reason: 'Helm values planning',
    fetcher: async () => {
      fetchCalled = true;
      return null;
    }
  });

  assert.equal(fetchCalled, false);
  assert.equal(packet?.confidence, 'high');
  assert.match(packet?.excerpt ?? '', /Helm values schema/);
});

test('knowledge context retrieval falls back to stale cache when refresh is unavailable', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-retrieve-stale-'));

  try {
    const source = {
      kind: 'helm-docs',
      name: 'chart-template-guide',
      version: '3.14.0',
      url: 'https://helm.sh/docs/chart_template_guide/'
    };
    await writeKnowledgeCacheEntry(tempRoot, {
      source,
      contentType: 'text/markdown',
      content: '# Helm Templates\nStale but version-scoped docs.',
      fetchedAt: '2026-01-01T00:00:00.000Z',
      staleAfter: '2026-02-01T00:00:00.000Z'
    });
    const packet = await retrieveKnowledgeContextPacket({
      cacheRoot: tempRoot,
      source,
      reason: 'Helm template task',
      now: new Date('2026-04-28T00:00:00.000Z'),
      fetcher: async () => {
        throw new Error('network unavailable');
      }
    });

    assert.ok(packet);
    assert.equal(packet?.confidence, 'medium');
    assert.match(packet?.reason ?? '', /stale cached context/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('official knowledge fetcher normalizes response content type', async () => {
  const source = {
    kind: 'terraform-registry',
    name: 'aws_instance',
    provider: 'hashicorp/aws',
    version: '5.0.0',
    url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/instance'
  };
  const fetched = await fetchOfficialKnowledgeSource(source, {
    fetchedAt: '2026-04-28T00:00:00.000Z',
    fetchImpl: async url => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: name => name.toLowerCase() === 'content-type' ? 'text/markdown; charset=utf-8' : null
      },
      text: async () => `# fetched from ${url}`
    })
  });

  assert.ok(fetched);
  assert.equal(fetched?.contentType, 'text/markdown');
  assert.match(fetched?.content ?? '', /fetched from/);
  assert.equal(fetched?.metadata?.retrieval, 'official-url');
});

test('Terraform Registry context sources use provider requirements and lockfile versions', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-registry-sources-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    await mkdir(terraformRoot, { recursive: true });
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'terraform {',
        '  required_providers {',
        '    aws = {',
        '      source  = "hashicorp/aws"',
        '      version = "~> 5.0"',
        '    }',
        '  }',
        '}',
        '',
        'resource "aws_instance" "api" {',
        '  ami           = "ami-123456"',
        '  instance_type = "t3.micro"',
        '}',
        '',
        'data "aws_ami" "ubuntu" {',
        '  most_recent = true',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(terraformRoot, '.terraform.lock.hcl'),
      [
        'provider "registry.terraform.io/hashicorp/aws" {',
        '  version     = "5.37.0"',
        '  constraints = "~> 5.0"',
        '  hashes      = []',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const root = inspection.terraformRoots.find(candidate => candidate.rootPath === 'terraform/app');
    assert.ok(root);
    const sources = await buildTerraformRegistryKnowledgeSources(tempRoot, root);
    const instanceSource = sources.find(source => source.name === 'resource:aws_instance');
    const amiSource = sources.find(source => source.name === 'data-source:aws_ami');

    assert.ok(instanceSource);
    assert.equal(instanceSource.provider, 'hashicorp/aws');
    assert.equal(instanceSource.version, '5.37.0');
    assert.match(instanceSource.url ?? '', /providers\/hashicorp\/aws\/latest\/docs\/resources\/instance$/);
    assert.ok(amiSource);
    assert.match(amiSource.url ?? '', /providers\/hashicorp\/aws\/latest\/docs\/data-sources\/ami$/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Terraform local module knowledge sources include only literal workspace modules', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-local-module-sources-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    await mkdir(join(terraformRoot, 'modules/queue-worker'), { recursive: true });
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'module "queue_worker" {',
        '  source = "./modules/queue-worker"',
        '}',
        '',
        'module "registry_module" {',
        '  source = "hashicorp/consul/aws"',
        '}',
        '',
        'module "git_module" {',
        '  source = "git::https://example.com/org/mod.git"',
        '}',
        '',
        'module "dynamic_module" {',
        '  source = var.module_source',
        '}',
        '',
        'module "outside_workspace" {',
        '  source = "../../../outside-workspace"',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const root = inspection.terraformRoots.find(candidate => candidate.rootPath === 'terraform/app');
    assert.ok(root);
    const sources = await buildTerraformLocalModuleKnowledgeSources(tempRoot, root);

    assert.equal(sources.length, 1);
    assert.equal(sources[0]?.kind, 'terraform-module');
    assert.equal(sources[0]?.name, 'terraform-module:terraform/app:queue_worker');
    assert.equal(sources[0]?.localPath, 'terraform/app/modules/queue-worker');
    assert.equal(sources[0]?.module, 'terraform/app');
    assert.equal(sources[0]?.packageName, 'queue_worker');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Pulumi config knowledge sources summarize discovered project metadata', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === 'infra/payments-api');
  assert.ok(project);

  const sources = await buildPulumiConfigKnowledgeSources(inspection.workspaceRoot, project);

  assert.equal(sources.length, 1);
  assert.equal(sources[0]?.kind, 'pulumi-config');
  assert.equal(sources[0]?.name, 'pulumi-config:infra/payments-api');
  assert.equal(sources[0]?.localPath, 'infra/payments-api');
  assert.equal(sources[0]?.module, 'infra/payments-api');
  assert.equal(sources[0]?.packageName, 'payments-api');
});

test('Pulumi config knowledge content summarizes safe project and stack config', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-config-content-'));

  try {
    const projectRoot = join(tempRoot, 'infra/payments-api');
    await mkdir(projectRoot, { recursive: true });
    await writeFile(
      join(projectRoot, 'Pulumi.yaml'),
      [
        'name: payments-api',
        'runtime: yaml',
        'config:',
        '  payments-api:imageTag:',
        '    type: string',
        '    default: latest',
        '  payments-api:replicas:',
        '    type: integer',
        '  payments-api:apiToken:',
        '    type: string',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(projectRoot, 'Pulumi.dev.yaml'),
      [
        'config:',
        '  payments-api:imageTag: dev-2026',
        '  payments-api:replicas: 2',
        '  payments-api:databasePassword:',
        '    secure: ciphertext',
        '  payments-api:signingKey:',
        '    secure: redacted',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const project = inspection.pulumiProjects.find(candidate => candidate.projectRoot === 'infra/payments-api');
    assert.ok(project);
    const source = (await buildPulumiConfigKnowledgeSources(tempRoot, project))[0];
    assert.ok(source);
    const content = await buildPulumiConfigKnowledgeContent({
      workspaceRoot: tempRoot,
      project,
      source
    });
    assert.ok(content);
    const summary = JSON.parse(content);

    assert.equal(summary.kind, 'infra-agent.pulumi-config-summary');
    assert.equal(summary.mutationAllowed, false);
    assert.equal(summary.projectRoot, 'infra/payments-api');
    assert.deepEqual(summary.stackFiles, ['infra/payments-api/Pulumi.dev.yaml']);
    assert.ok(summary.declarations.some(declaration =>
      declaration.key === 'payments-api:imageTag'
      && declaration.type === 'string'
      && declaration.defaultValue === 'latest'
    ));
    assert.ok(summary.stackValues.some(value =>
      value.key === 'payments-api:replicas'
      && value.value === '2'
      && value.stackName === 'dev'
    ));
    assert.doesNotMatch(content, /apiToken|databasePassword|signingKey|ciphertext|redacted/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Terraform local module knowledge content summarizes variables and outputs', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-local-module-content-'));

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
        '  type        = string',
        '  description = "Container image tag."',
        '}',
        '',
        'variable "environment" {',
        '  type    = string',
        '  default = "dev"',
        '  validation {',
        '    condition     = contains(["dev", "stage", "prod"], var.environment)',
        '    error_message = "Environment must be supported."',
        '  }',
        '}',
        '',
        'variable "api_token" {',
        '  type = string',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(moduleRoot, 'outputs.tf'),
      [
        'output "queue_name" {',
        '  description = "Queue name."',
        '  value       = aws_sqs_queue.worker.name',
        '}',
        '',
        'output "secret_value" {',
        '  sensitive = true',
        '  value     = random_password.secret.result',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const root = inspection.terraformRoots.find(candidate => candidate.rootPath === 'terraform/app');
    assert.ok(root);
    const source = (await buildTerraformLocalModuleKnowledgeSources(tempRoot, root))[0];
    assert.ok(source);
    const content = await buildTerraformLocalModuleKnowledgeContent({
      workspaceRoot: tempRoot,
      root,
      source
    });
    assert.ok(content);
    const summary = JSON.parse(content);

    assert.equal(summary.kind, 'infra-agent.terraform-local-module-summary');
    assert.equal(summary.mutationAllowed, false);
    assert.deepEqual(summary.callSourcePaths, ['terraform/app/main.tf']);
    assert.ok(summary.inputs.some(input =>
      input.name === 'image_tag'
      && input.required === true
      && input.type === 'string'
      && input.description === 'Container image tag.'
    ));
    assert.ok(summary.inputs.some(input =>
      input.name === 'environment'
      && input.required === false
      && input.defaultValue === 'dev'
      && input.values.includes('prod')
    ));
    assert.ok(summary.outputs.some(output => output.name === 'queue_name'));
    assert.doesNotMatch(content, /api_token|secret_value|random_password/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Terraform provider schema context stays local and compact', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-provider-schema-context-'));

  try {
    await writeTerraformProviderSchemaWorkspace(tempRoot);

    const inspection = await inspectWorkspace(tempRoot);
    const root = inspection.terraformRoots.find(candidate => candidate.rootPath === 'terraform/app');
    assert.ok(root);

    const sources = await buildTerraformProviderSchemaKnowledgeSources(tempRoot, root);
    assert.equal(sources.length, 1);
    assert.equal(sources[0]?.kind, 'provider-schema');
    assert.equal(sources[0]?.localPath, 'terraform/app/.infra-agent/terraform-provider-schema.json');
    assert.equal(sources[0]?.version, 'hashicorp/aws@5.37.0');

    const packets = await retrieveTerraformProviderSchemaContextPackets({
      workspaceRoot: tempRoot,
      root,
      reason: 'Local provider schema for Terraform planning'
    });
    assert.equal(packets.length, 1);
    assert.equal(packets[0]?.source.kind, 'provider-schema');
    assert.equal(packets[0]?.source.version, 'hashicorp/aws@5.37.0');
    assert.match(packets[0]?.excerpt ?? '', /aws_lb_listener_rule/);
    assert.match(packets[0]?.excerpt ?? '', /"providerVersions": \{\n    "hashicorp\/aws": "5\.37\.0"/);
    assert.match(packets[0]?.excerpt ?? '', /"providerVersion": "5\.37\.0"/);
    assert.match(packets[0]?.excerpt ?? '', /listener_arn/);
    assert.doesNotMatch(packets[0]?.excerpt ?? '', /aws_instance/);

    const prefetch = await prefetchWorkspaceKnowledge(inspection, {
      domains: ['terraform'],
      targetPaths: ['terraform/app'],
      maxSources: 1,
      fetcher: async source => ({
        source,
        contentType: 'text/markdown',
        content: `# ${source.name}`,
        fetchedAt: '2026-04-29T00:00:00.000Z',
        staleAfter: '2026-05-29T00:00:00.000Z'
      })
    });
    assert.ok(prefetch.sources.some(source =>
      source.status === 'local'
      && source.source.kind === 'provider-schema'
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Terraform Registry context packets retrieve selected source docs through the cache layer', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-registry-retrieve-'));
  const cacheRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-registry-cache-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    await mkdir(terraformRoot, { recursive: true });
    await writeFile(
      join(terraformRoot, 'main.tf'),
      [
        'terraform {',
        '  required_providers {',
        '    aws = {',
        '      source  = "hashicorp/aws"',
        '      version = "~> 5.0"',
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
    const packets = await retrieveTerraformRegistryContextPackets({
      workspaceRoot: tempRoot,
      root,
      cacheRoot,
      reason: 'Terraform AWS resource docs for selected root',
      fetcher: async source => ({
        source,
        contentType: 'text/markdown',
        content: `# ${source.name}\nVersion ${source.version} docs for ${source.provider}.`,
        fetchedAt: '2026-04-28T00:00:00.000Z',
        staleAfter: '2026-05-28T00:00:00.000Z'
      })
    });

    assert.equal(packets.length, 1);
    assert.equal(packets[0]?.source.kind, 'terraform-registry');
    assert.equal(packets[0]?.confidence, 'high');
    assert.match(packets[0]?.excerpt ?? '', /Version 5\.37\.0 docs/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    await rm(cacheRoot, { recursive: true, force: true });
  }
});

test('Helm chart context sources include local schema and chart docs metadata', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-context-sources-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'version: 0.2.0',
        'home: https://example.com/api-chart',
        'sources:',
        '  - https://example.com/api-chart/source',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'values.schema.json'),
      '{"type":"object","properties":{"service":{"type":"object"}}}\n',
      'utf8'
    );
    const inspection = await inspectWorkspace(tempRoot);
    const chart = inspection.helmCharts.find(candidate => candidate.chartRoot === 'charts/api');
    assert.ok(chart);
    const sources = await buildHelmChartKnowledgeSources(tempRoot, chart);
    const metadataSource = sources.find(source => source.kind === 'chart-metadata');
    const schemaSource = sources.find(source => source.kind === 'chart-schema');
    const helmDocsSource = sources.find(source => source.kind === 'helm-docs');
    const chartDocsSource = sources.find(source => source.kind === 'chart-docs' && source.name === 'api:home');

    assert.ok(metadataSource);
    assert.equal(metadataSource.localPath, 'charts/api/Chart.yaml');
    assert.equal(metadataSource.module, 'charts/api');
    assert.equal(metadataSource.version, '0.2.0');
    assert.equal(metadataSource.packageName, 'api');
    assert.ok(schemaSource);
    assert.equal(schemaSource.localPath, 'charts/api/values.schema.json');
    assert.equal(schemaSource.version, '0.2.0');
    assert.ok(helmDocsSource);
    assert.match(helmDocsSource.url ?? '', /helm\.sh\/docs\/topics\/charts/);
    assert.ok(chartDocsSource);
    assert.equal(chartDocsSource.url, 'https://example.com/api-chart');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Helm chart context sources include chart lock and dependency repositories', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-dependency-context-'));
  const cacheRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-dependency-cache-'));

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
        '  - name: local-helper',
        '    version: 0.1.0',
        '    repository: file://../local-helper',
        ''
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      join(chartRoot, 'Chart.lock'),
      [
        'dependencies:',
        '  - name: postgresql',
        '    version: 12.1.0',
        '    repository: https://charts.bitnami.com/bitnami',
        'digest: sha256:abc123',
        'generated: "2026-04-28T00:00:00Z"',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const chart = inspection.helmCharts.find(candidate => candidate.chartRoot === 'charts/api');
    assert.ok(chart);
    const sources = await buildHelmChartKnowledgeSources(tempRoot, chart);
    const lockSource = sources.find(source => source.kind === 'chart-lock');
    const redisSource = sources.find(source => source.name === 'api:dependency:redis');
    const postgresqlSource = sources.find(source => source.name === 'api:dependency:postgresql');
    const localSource = sources.find(source => source.name === 'api:dependency:local-helper');

    assert.ok(lockSource);
    assert.equal(lockSource.localPath, 'charts/api/Chart.lock');
    assert.equal(lockSource.version, '0.2.0');
    assert.ok(redisSource);
    assert.equal(redisSource.chart, 'redis');
    assert.equal(redisSource.module, 'api');
    assert.equal(redisSource.packageName, 'redis');
    assert.equal(redisSource.version, '17.3.0');
    assert.equal(redisSource.url, 'https://charts.bitnami.com/bitnami');
    assert.ok(postgresqlSource);
    assert.equal(postgresqlSource.version, '12.1.0');
    assert.equal(localSource, undefined);

    const packets = await retrieveHelmChartContextPackets({
      workspaceRoot: tempRoot,
      chart,
      cacheRoot,
      reason: 'Helm dependency docs for selected chart',
      maxExternalSources: 0
    });
    const lockPacket = packets.find(packet => packet.source.kind === 'chart-lock');

    assert.ok(lockPacket);
    assert.equal(lockPacket.contentType, 'application/yaml');
    assert.match(lockPacket.excerpt ?? '', /postgresql/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    await rm(cacheRoot, { recursive: true, force: true });
  }
});

test('Helm chart metadata knowledge content summarizes safe metadata and dependencies', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-metadata-content-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
    await writeFile(
      join(chartRoot, 'Chart.yaml'),
      [
        'apiVersion: v2',
        'name: api',
        'description: api token should not be retained',
        'type: application',
        'version: 0.2.0',
        'appVersion: "1.4.0"',
        'kubeVersion: ">=1.27.0"',
        'home: https://example.com/api-chart?token=bad',
        'sources:',
        '  - https://example.com/api-chart/source',
        '  - https://example.com/api-chart/source?token=bad',
        'dependencies:',
        '  - name: redis',
        '    alias: cache',
        '    version: 17.3.0',
        '    repository: https://charts.bitnami.com/bitnami',
        '  - name: api-token-helper',
        '    version: 0.1.0',
        '    repository: https://example.com/secret-helper',
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
        '  - name: postgresql',
        '    version: 12.1.0',
        '    repository: oci://registry.example.com/charts',
        'digest: sha256:abc123',
        'generated: "2026-04-28T00:00:00Z"',
        ''
      ].join('\n'),
      'utf8'
    );

    const inspection = await inspectWorkspace(tempRoot);
    const chart = inspection.helmCharts.find(candidate => candidate.chartRoot === 'charts/api');
    assert.ok(chart);
    const source = (await buildHelmChartKnowledgeSources(tempRoot, chart))
      .find(candidate => candidate.kind === 'chart-metadata');
    assert.ok(source);
    const content = await buildHelmChartMetadataKnowledgeContent({
      workspaceRoot: tempRoot,
      chart,
      source
    });
    assert.ok(content);
    const summary = JSON.parse(content);

    assert.equal(summary.kind, 'infra-agent.helm-chart-metadata-summary');
    assert.equal(summary.schemaVersion, 1);
    assert.equal(summary.mutationAllowed, false);
    assert.equal(summary.chartRoot, 'charts/api');
    assert.equal(summary.chartFile, 'charts/api/Chart.yaml');
    assert.equal(summary.lockFile, 'charts/api/Chart.lock');
    assert.equal(summary.chartName, 'api');
    assert.equal(summary.apiVersion, 'v2');
    assert.equal(summary.version, '0.2.0');
    assert.equal(summary.appVersion, '1.4.0');
    assert.equal(summary.kubeVersion, '>=1.27.0');
    assert.equal(summary.chartType, 'application');
    assert.equal(summary.lockDigest, 'sha256:abc123');
    assert.equal(summary.lockGenerated, '2026-04-28T00:00:00Z');
    assert.deepEqual(summary.sources, ['https://example.com/api-chart/source']);
    assert.ok(summary.dependencies.some(dependency =>
      dependency.name === 'redis'
      && dependency.version === '17.3.0'
      && dependency.alias === 'cache'
      && dependency.locked === false
    ));
    assert.ok(summary.dependencies.some(dependency =>
      dependency.name === 'redis'
      && dependency.version === '17.3.1'
      && dependency.locked === true
    ));
    assert.ok(summary.dependencies.some(dependency =>
      dependency.name === 'postgresql'
      && dependency.locked === true
      && dependency.repository === 'oci://registry.example.com/charts'
    ));
    assert.doesNotMatch(content, /api-token-helper|secret-helper|token=bad|api token should not be retained/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('Helm chart context packets include local schema and cached external docs', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-context-packets-'));
  const cacheRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-helm-context-cache-'));

  try {
    const chartRoot = join(tempRoot, 'charts/api');
    await mkdir(chartRoot, { recursive: true });
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
    const chart = inspection.helmCharts.find(candidate => candidate.chartRoot === 'charts/api');
    assert.ok(chart);
    const packets = await retrieveHelmChartContextPackets({
      workspaceRoot: tempRoot,
      chart,
      cacheRoot,
      reason: 'Helm chart docs for selected chart',
      maxExternalSources: 1,
      fetcher: async source => ({
        source,
        contentType: 'text/markdown',
        content: `# ${source.name}\nExternal Helm docs.`,
        fetchedAt: '2026-04-28T00:00:00.000Z',
        staleAfter: '2026-05-28T00:00:00.000Z'
      })
    });

    assert.equal(packets.length, 2);
    assert.equal(packets[0]?.source.kind, 'chart-schema');
    assert.equal(packets[0]?.contentType, 'application/json');
    assert.match(packets[0]?.excerpt ?? '', /required/);
    assert.equal(packets[1]?.source.kind, 'helm-docs');
    assert.match(packets[1]?.excerpt ?? '', /External Helm docs/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    await rm(cacheRoot, { recursive: true, force: true });
  }
});
