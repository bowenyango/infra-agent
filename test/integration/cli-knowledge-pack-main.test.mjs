import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  cp,
  mkdir,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  resolve,
  join
} from 'node:path';
import { captureStdout } from '../support/capture-stdout.mjs';
import {
  buildCompactHandoffBudgetsFixture,
  buildEmptyKnowledgeFactsFixture,
  buildEmptyApprovalGrantsFixture,
  buildEmptyApprovalPendingScopeFixture
} from '../support/compact-fixtures.mjs';
import { writeTerraformProviderSchemaWorkspace } from '../support/terraform-provider-schema-workspace.mjs';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { buildRunPreflight } from '../../src/agent/build-run-preflight.ts';
import { printDoctorReport } from '../../src/cli/output.ts';
import {
  buildLLMClientConfigOverrides,
  main,
  parseArgs,
  readPackageVersion
} from '../../src/cli/main.ts';
import { buildDoctorReport } from '../../src/cli/doctor.ts';
import { buildPlannerProviderCatalogDiscovery } from '../../src/cli/planner-provider-catalog.ts';
import { parsePlannerProviderCatalogReport } from '../../src/cli/planner-provider-catalog-contract.ts';
import {
  exitCodeForAgentOutcome,
  exitCodeForRunPreflight,
  INFRA_AGENT_EXIT_CODES
} from '../../src/cli/exit-codes.ts';
import { extractWorkspaceKnowledgeFacts } from '../../src/knowledge/extract.ts';

test('knowledge pack command emits bounded fact pack JSON', async () => {
  const output = await captureStdout(() => main([
    'knowledge',
    'pack',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--max-facts',
    '4',
    '--json'
  ]));
  const pack = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(pack.kind, 'infra-agent.knowledge-pack');
  assert.equal(pack.schemaVersion, 1);
  assert.equal(pack.mutationAllowed, false);
  assert.match(pack.packId, /^[a-f0-9]{24}$/);
  assert.equal(pack.maxFacts, 4);
  assert.equal(pack.includedFactCount, Math.min(4, pack.factCount));
  assert.equal(pack.facts.length, pack.includedFactCount);
  const chartSchemaSource = pack.sources.find(source => source.kind === 'chart-schema');
  assert.ok(chartSchemaSource);
  assert.equal(chartSchemaSource.storagePolicy.scope, 'workspace-private');
  assert.equal(chartSchemaSource.storagePolicy.requiresExplicitOptIn, true);
  assert.equal(pack.storagePolicy.workspacePrivate, pack.sources.length);
  assert.equal(pack.storagePolicy.explicitOptInRequired, pack.sources.length);
  assert.ok(pack.facts.some(fact => fact.path === 'chart.payments-api.image.repository'));
  assert.ok(pack.facts.some(fact => fact.path === 'chart.payments-api.service.port'));
  assert.doesNotMatch(output, /"content"\s*:|replicaCount":\s*\{|"\$schema"/);
});

test('knowledge pack command emits Helm chart metadata and dependency facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-helm-metadata-cli-'));

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

    const output = await captureStdout(() => main([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'helm',
      '--target',
      'charts/api',
      '--max-facts',
      '6',
      '--json'
    ]));
    const pack = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(pack.kind, 'infra-agent.knowledge-pack');
    assert.equal(pack.mutationAllowed, false);
    assert.equal(pack.maxFacts, 6);
    assert.ok(pack.sources.some(source =>
      source.kind === 'chart-metadata'
      && source.targetPath === 'charts/api'
      && source.factCount > 0
    ));
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'chart-metadata'
      && fact.path === 'chart.api.metadata.version'
      && fact.values?.includes('0.2.0')
    ));
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'chart-dependency'
      && fact.path === 'chart.api.dependencies.redis'
      && fact.values?.includes('version=17.3.1')
      && fact.values?.includes('locked=true')
    ));
    assert.doesNotMatch(output, /"content"\s*:|apiVersion:\s*v2|digest:\s*sha256|generated:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack command emits focused Terraform provider schema facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-provider-schema-cli-'));

  try {
    await writeTerraformProviderSchemaWorkspace(tempRoot);

    const output = await captureStdout(() => main([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'terraform',
      '--target',
      'terraform/app',
      '--max-facts',
      '2',
      '--json'
    ]));
    const pack = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(pack.kind, 'infra-agent.knowledge-pack');
    assert.equal(pack.mutationAllowed, false);
    assert.equal(pack.maxFacts, 2);
    assert.ok(pack.sources.some(source =>
      source.kind === 'provider-schema'
      && source.targetPath === 'terraform/app'
    ));
    assert.ok(pack.facts.some(fact =>
      fact.extractionMethod === 'terraform-provider-schema'
      && fact.path === 'resource.aws_lb_listener_rule.listener_arn'
    ));
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'nested-block'
      && fact.path === 'resource.aws_lb_listener_rule.action'
    ));
    assert.doesNotMatch(output, /aws_instance|provider_schemas|"content"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack command emits Terraform local module facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-terraform-module-cli-'));

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

    const output = await captureStdout(() => main([
      'knowledge',
      'pack',
      tempRoot,
      '--domain',
      'terraform',
      '--target',
      'terraform/app',
      '--max-facts',
      '2',
      '--json'
    ]));
    const pack = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(pack.kind, 'infra-agent.knowledge-pack');
    assert.equal(pack.mutationAllowed, false);
    assert.equal(pack.maxFacts, 2);
    assert.ok(pack.sources.some(source =>
      source.kind === 'terraform-module'
      && source.targetPath === 'terraform/app'
    ));
    assert.ok(pack.facts.some(fact =>
      fact.kind === 'module-input'
      && fact.path === 'module.queue_worker.inputs.image_tag'
    ));
    assert.doesNotMatch(output, /variable "image_tag"|"content"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack command emits Pulumi config facts', async () => {
  const output = await captureStdout(() => main([
    'knowledge',
    'pack',
    'fixtures/sample-workspace',
    '--domain',
    'pulumi',
    '--target',
    'infra/payments-api',
    '--max-facts',
    '2',
    '--json'
  ]));
  const pack = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(pack.kind, 'infra-agent.knowledge-pack');
  assert.equal(pack.mutationAllowed, false);
  assert.equal(pack.maxFacts, 2);
  assert.ok(pack.sources.some(source =>
    source.kind === 'pulumi-config'
    && source.targetPath === 'infra/payments-api'
  ));
  assert.ok(pack.facts.some(fact =>
    fact.kind === 'pulumi-config-parameter'
    && fact.path === 'config.payments-api:imageTag'
  ));
  assert.doesNotMatch(output, /"content"\s*:|runtime:\s*yaml|imageTag:\s*latest/);
});

test('knowledge pack command writes a bounded reusable artifact with --out', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-out-'));

  try {
    const outputPath = join(tempRoot, 'artifacts/knowledge-pack.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'pack',
      'fixtures/sample-workspace',
      '--domain',
      'helm',
      '--target',
      'charts/payments-api',
      '--max-facts',
      '4',
      '--out',
      outputPath,
      '--json'
    ]));
    const stdoutPack = JSON.parse(output.slice(output.indexOf('{')));
    const artifact = JSON.parse(await readFile(outputPath, 'utf8'));
    const validationOutput = await captureStdout(() => main([
      'knowledge',
      'validate',
      outputPath,
      '--json'
    ]));
    const validation = JSON.parse(validationOutput.slice(validationOutput.indexOf('{')));

    assert.equal(stdoutPack.kind, 'infra-agent.knowledge-pack');
    assert.equal(stdoutPack.outputPath, outputPath);
    assert.equal(artifact.kind, 'infra-agent.knowledge-pack');
    assert.equal(artifact.outputPath, undefined);
    assert.equal(artifact.packId, stdoutPack.packId);
    assert.equal(artifact.maxFacts, 4);
    assert.equal(artifact.facts.length, artifact.includedFactCount);
    assert.equal(validation.inputKind, 'infra-agent.knowledge-pack');
    assert.equal(validation.valid, true);
    assert.equal(validation.factSetCount, artifact.factSetCount);
    assert.equal(validation.factCount, artifact.factCount);
    assert.doesNotMatch(JSON.stringify(artifact), /"content"\s*:|replicaCount":\s*\{|"\$schema"/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack command writes an artifact manifest for publication planning', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-manifest-'));

  try {
    const outputPath = join(tempRoot, 'artifacts/knowledge-pack.json');
    const manifestPath = join(tempRoot, 'artifacts/knowledge-pack.manifest.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'pack',
      'fixtures/sample-workspace',
      '--domain',
      'helm',
      '--target',
      'charts/payments-api',
      '--max-facts',
      '4',
      '--out',
      outputPath,
      '--manifest-out',
      manifestPath,
      '--json'
    ]));
    const stdoutPack = JSON.parse(output.slice(output.indexOf('{')));
    const artifact = JSON.parse(await readFile(outputPath, 'utf8'));
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const validationOutput = await captureStdout(() => main([
      'knowledge',
      'validate',
      manifestPath,
      '--json'
    ]));
    const validation = JSON.parse(validationOutput.slice(validationOutput.indexOf('{')));

    assert.equal(stdoutPack.outputPath, outputPath);
    assert.equal(stdoutPack.manifestPath, manifestPath);
    assert.equal(manifest.kind, 'infra-agent.knowledge-artifact-manifest');
    assert.equal(manifest.artifact.kind, 'infra-agent.knowledge-pack');
    assert.equal(manifest.artifact.id, artifact.packId);
    assert.equal(manifest.artifact.path, outputPath);
    assert.match(manifest.artifact.sha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(manifest.artifact.sourceIds, artifact.sources.map(source => source.id));
    assert.equal(manifest.artifact.storagePolicy.workspacePrivate, artifact.storagePolicy.workspacePrivate);
    assert.equal(manifest.publication.executionMode, 'plan-only');
    assert.equal(manifest.publication.remoteWriteAllowed, false);
    assert.equal(manifest.publication.credentialRequired, false);
    assert.equal(manifest.publication.uploadCommand, null);
    assert.equal(manifest.publication.defaultStore, 'local-only');
    assert.equal(manifest.publication.requiresExplicitOptIn, true);
    assert.deepEqual(manifest.publication.publishableByDefaultSourceIds, []);
    assert.ok(manifest.publication.blockedSources.length >= 1);
    assert.ok(manifest.publication.requiredValidations.some(command => command.includes(outputPath)));
    assert.equal(validation.inputKind, 'infra-agent.knowledge-artifact-manifest');
    assert.equal(validation.valid, true);
    assert.equal(validation.factCount, artifact.factCount);
    assert.doesNotMatch(JSON.stringify(manifest), /"content"\s*:|replicaCount":\s*\{|"\$schema"/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge validate command rejects forged pack JSON files', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-validate-forged-'));
  const previousExitCode = process.exitCode;

  try {
    process.exitCode = undefined;
    const outputPath = join(tempRoot, 'knowledge-pack.json');
    await captureStdout(() => main([
      'knowledge',
      'pack',
      'fixtures/sample-workspace',
      '--domain',
      'helm',
      '--target',
      'charts/payments-api',
      '--max-facts',
      '4',
      '--out',
      outputPath,
      '--json'
    ]));
    const artifact = JSON.parse(await readFile(outputPath, 'utf8'));
    await writeFile(outputPath, JSON.stringify({
      ...artifact,
      includedFactCount: artifact.includedFactCount + 1,
      sources: [{
        ...artifact.sources[0],
        storagePolicy: {
          scope: 'public-reference',
          defaultStore: 'local-or-explicit-team-cache',
          shareableByDefault: true,
          requiresExplicitOptIn: false,
          reason: 'Forged public posture.'
        }
      }],
      facts: [{
        ...artifact.facts[0],
        sourceId: 'forged-source'
      }]
    }, null, 2));

    const validationOutput = await captureStdout(() => main([
      'knowledge',
      'validate',
      outputPath,
      '--json'
    ]));
    const validation = JSON.parse(validationOutput.slice(validationOutput.indexOf('{')));

    assert.equal(validation.inputKind, 'infra-agent.knowledge-pack');
    assert.equal(validation.valid, false);
    assert.equal(process.exitCode, 1);
    assert.ok(validation.issues.some(issue => issue.path === '$.includedFactCount'));
    assert.ok(validation.issues.some(issue => issue.path === '$.sources[0].storagePolicy'));
    assert.ok(validation.issues.some(issue => issue.path === '$.facts[0].sourceId'));
  } finally {
    process.exitCode = previousExitCode;
    await rm(tempRoot, { recursive: true, force: true });
  }
});
