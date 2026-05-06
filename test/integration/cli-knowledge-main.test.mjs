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

test('prefetch CLI args accept bounded source selection flags', () => {
  const parsed = parseArgs([
    'prefetch',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--max-sources',
    '2',
    '--json'
  ]);

  assert.equal(parsed.command, 'prefetch');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.deepEqual(parsed.domains, ['helm']);
  assert.deepEqual(parsed.targetPaths, ['charts/payments-api']);
  assert.equal(parsed.maxSources, 2);
  assert.equal(parsed.json, true);
});

test('knowledge prefetch CLI args mirror top-level bounded source selection', () => {
  const parsed = parseArgs([
    'knowledge',
    'prefetch',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--max-sources',
    '2',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'prefetch');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.deepEqual(parsed.domains, ['helm']);
  assert.deepEqual(parsed.targetPaths, ['charts/payments-api']);
  assert.equal(parsed.maxSources, 2);
  assert.equal(parsed.json, true);
});

test('knowledge sources CLI args accept bounded source listing flags', () => {
  const parsed = parseArgs([
    'knowledge',
    'sources',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'sources');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.deepEqual(parsed.domains, ['helm']);
  assert.deepEqual(parsed.targetPaths, ['charts/payments-api']);
  assert.equal(parsed.json, true);
});

test('knowledge extract CLI args accept source filters and bounded targets', () => {
  const parsed = parseArgs([
    'knowledge',
    'extract',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--source',
    'chart-schema:example',
    '--out',
    'artifacts/knowledge-extraction.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'extract');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.deepEqual(parsed.domains, ['helm']);
  assert.deepEqual(parsed.targetPaths, ['charts/payments-api']);
  assert.deepEqual(parsed.sourceIds, ['chart-schema:example']);
  assert.equal(parsed.outputPath, 'artifacts/knowledge-extraction.json');
  assert.equal(parsed.json, true);
});

test('knowledge validate CLI args accept a knowledge JSON path', () => {
  const parsed = parseArgs([
    'knowledge',
    'validate',
    'knowledge-extraction.json',
    '--workspace',
    'fixtures/sample-workspace',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'validate');
  assert.equal(parsed.inputPath, 'knowledge-extraction.json');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.validationWorkspace, resolve(process.cwd(), 'fixtures/sample-workspace'));
  assert.equal(parsed.json, true);
});

test('knowledge pack CLI args accept bounded fact pack flags', () => {
  const parsed = parseArgs([
    'knowledge',
    'pack',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--source',
    'chart-schema:example',
    '--max-facts',
    '5',
    '--out',
    'artifacts/knowledge-pack.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'pack');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.deepEqual(parsed.domains, ['helm']);
  assert.deepEqual(parsed.targetPaths, ['charts/payments-api']);
  assert.deepEqual(parsed.sourceIds, ['chart-schema:example']);
  assert.equal(parsed.maxFacts, 5);
  assert.equal(parsed.outputPath, 'artifacts/knowledge-pack.json');
  assert.equal(parsed.json, true);
});

test('knowledge sources command emits read-only source listing JSON', async () => {
  const output = await captureStdout(() => main([
    'knowledge',
    'sources',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--json'
  ]));
  const report = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(report.kind, 'infra-agent.knowledge-sources');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mutationAllowed, false);
  assert.deepEqual(report.requestedDomains, ['helm']);
  assert.deepEqual(report.targetPaths, ['charts/payments-api']);
  assert.equal(report.sourceCount, report.sources.length);
  const chartMetadataSource = report.sources.find(source =>
    source.domain === 'helm'
    && source.targetPath === 'charts/payments-api'
    && source.id
    && source.requiresFetch === false
    && source.source.kind === 'chart-metadata'
    && source.source.localPath === 'charts/payments-api/Chart.yaml'
    && source.source.module === 'charts/payments-api'
  );
  assert.ok(chartMetadataSource);
  assert.equal(chartMetadataSource.storagePolicy.scope, 'workspace-private');
  assert.equal(chartMetadataSource.storagePolicy.defaultStore, 'local-only');
  assert.equal(chartMetadataSource.storagePolicy.shareableByDefault, false);
  assert.equal(chartMetadataSource.storagePolicy.requiresExplicitOptIn, true);
  assert.ok(report.sources.some(source =>
    source.domain === 'helm'
    && source.targetPath === 'charts/payments-api'
    && source.id
    && source.requiresFetch === false
    && source.source.kind === 'chart-schema'
  ));
  assert.ok(report.summary.local >= 1);
  assert.ok(report.summary.storagePolicy.workspacePrivate >= 1);
  assert.ok(report.summary.storagePolicy.explicitOptInRequired >= 1);
  assert.doesNotMatch(output, /contentHash|fetchedAt|# Values|replicaCount:/);
});

test('knowledge sources command lists Terraform local module sources', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-sources-terraform-module-'));

  try {
    const terraformRoot = join(tempRoot, 'terraform/app');
    await mkdir(join(terraformRoot, 'modules/queue-worker'), { recursive: true });
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

    const output = await captureStdout(() => main([
      'knowledge',
      'sources',
      tempRoot,
      '--domain',
      'terraform',
      '--target',
      'terraform/app',
      '--json'
    ]));
    const report = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(report.kind, 'infra-agent.knowledge-sources');
    assert.equal(report.mutationAllowed, false);
    assert.ok(report.sources.some(source =>
      source.domain === 'terraform'
      && source.targetPath === 'terraform/app'
      && source.requiresFetch === false
      && source.source.kind === 'terraform-module'
      && source.source.localPath === 'terraform/app/modules/queue-worker'
    ));
    assert.ok(report.summary.local >= 1);
    assert.doesNotMatch(output, /variable "image_tag"|"content"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge sources command lists Pulumi config sources', async () => {
  const output = await captureStdout(() => main([
    'knowledge',
    'sources',
    'fixtures/sample-workspace',
    '--domain',
    'pulumi',
    '--target',
    'infra/payments-api',
    '--json'
  ]));
  const report = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(report.kind, 'infra-agent.knowledge-sources');
  assert.equal(report.mutationAllowed, false);
  assert.deepEqual(report.requestedDomains, ['pulumi']);
  assert.deepEqual(report.targetPaths, ['infra/payments-api']);
  assert.ok(report.sources.some(source =>
    source.domain === 'pulumi'
    && source.targetPath === 'infra/payments-api'
    && source.requiresFetch === false
    && source.source.kind === 'pulumi-config'
    && source.source.localPath === 'infra/payments-api'
    && source.source.packageName === 'payments-api'
  ));
  assert.ok(report.summary.local >= 1);
  assert.doesNotMatch(output, /imageTag:\s*latest|runtime:\s*yaml|"content"\s*:/);
});

test('knowledge prefetch command emits existing prefetch JSON contract', async () => {
  const output = await captureStdout(() => main([
    'knowledge',
    'prefetch',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--max-sources',
    '1',
    '--json'
  ]));
  const result = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(result.kind, 'infra-agent.knowledge-prefetch');
  assert.equal(result.schemaVersion, 1);
  assert.deepEqual(result.requestedDomains, ['helm']);
  assert.deepEqual(result.targetPaths, ['charts/payments-api']);
  assert.equal(result.maxSources, 1);
  assert.ok(result.sources.some(source =>
    source.domain === 'helm'
    && source.targetPath === 'charts/payments-api'
    && source.status === 'local'
    && source.source.kind === 'chart-schema'
  ));
});

test('knowledge extract command emits cache-first fact sets as JSON', async () => {
  const output = await captureStdout(() => main([
    'knowledge',
    'extract',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--json'
  ]));
  const report = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(report.kind, 'infra-agent.knowledge-extraction');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mutationAllowed, false);
  assert.deepEqual(report.requestedDomains, ['helm']);
  assert.deepEqual(report.targetPaths, ['charts/payments-api']);
  assert.equal(report.sourceCount, report.sources.length);
  assert.equal(report.factSetCount, report.factSets.length);
  assert.ok(report.factCount >= 5);
  assert.ok(report.sources.some(source =>
    source.source.kind === 'chart-schema'
    && source.status === 'extracted'
    && source.factCount > 0
  ));
  assert.ok(report.sources.some(source =>
    source.source.kind === 'chart-metadata'
    && source.status === 'extracted'
    && source.factCount > 0
  ));
  assert.ok(report.factSets.some(factSet =>
    factSet.kind === 'infra-agent.knowledge-facts'
    && factSet.source.kind === 'chart-schema'
    && factSet.facts.some(fact => fact.path === 'chart.payments-api.service.port')
  ));
  assert.ok(report.factSets.some(factSet =>
    factSet.kind === 'infra-agent.knowledge-facts'
    && factSet.source.kind === 'chart-metadata'
    && factSet.facts.some(fact =>
      fact.kind === 'chart-metadata'
      && fact.path === 'chart.payments-api.metadata.version'
      && fact.values?.includes('0.1.0')
    )
  ));
  assert.doesNotMatch(output, /"content"\s*:|replicaCount":\s*\{|"\$schema"|apiVersion:\s*v2/);
});

test('knowledge extract command emits Terraform local module facts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-extract-terraform-module-'));

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
      'extract',
      tempRoot,
      '--domain',
      'terraform',
      '--target',
      'terraform/app',
      '--json'
    ]));
    const report = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(report.kind, 'infra-agent.knowledge-extraction');
    assert.equal(report.mutationAllowed, false);
    assert.ok(report.sources.some(source =>
      source.source.kind === 'terraform-module'
      && source.status === 'extracted'
      && source.factCount > 0
    ));
    assert.ok(report.factSets.some(factSet =>
      factSet.source.kind === 'terraform-module'
      && factSet.facts.some(fact =>
        fact.kind === 'module-input'
        && fact.path === 'module.queue_worker.inputs.image_tag'
        && fact.required === true
      )
    ));
    assert.doesNotMatch(output, /variable "image_tag"|"content"\s*:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge extract command emits Pulumi config facts', async () => {
  const output = await captureStdout(() => main([
    'knowledge',
    'extract',
    'fixtures/sample-workspace',
    '--domain',
    'pulumi',
    '--target',
    'infra/payments-api',
    '--json'
  ]));
  const report = JSON.parse(output.slice(output.indexOf('{')));

  assert.equal(report.kind, 'infra-agent.knowledge-extraction');
  assert.equal(report.mutationAllowed, false);
  assert.deepEqual(report.requestedDomains, ['pulumi']);
  assert.deepEqual(report.targetPaths, ['infra/payments-api']);
  assert.ok(report.sources.some(source =>
    source.source.kind === 'pulumi-config'
    && source.status === 'extracted'
    && source.factCount > 0
  ));
  assert.ok(report.factSets.some(factSet =>
    factSet.source.kind === 'pulumi-config'
    && factSet.facts.some(fact =>
      fact.kind === 'pulumi-config-parameter'
      && fact.path === 'config.payments-api:imageTag'
      && fact.values?.includes('latest')
    )
  ));
  assert.doesNotMatch(output, /"content"\s*:|runtime:\s*yaml|imageTag:\s*latest/);
});

test('knowledge extract command writes a reusable validation artifact with --out', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-extract-out-'));

  try {
    const outputPath = join(tempRoot, 'artifacts/knowledge-extraction.json');
    const output = await captureStdout(() => main([
      'knowledge',
      'extract',
      'fixtures/sample-workspace',
      '--domain',
      'helm',
      '--target',
      'charts/payments-api',
      '--out',
      outputPath,
      '--json'
    ]));
    const stdoutReport = JSON.parse(output.slice(output.indexOf('{')));
    const artifact = JSON.parse(await readFile(outputPath, 'utf8'));
    const validationOutput = await captureStdout(() => main([
      'knowledge',
      'validate',
      outputPath,
      '--workspace',
      'fixtures/sample-workspace',
      '--json'
    ]));
    const validation = JSON.parse(validationOutput.slice(validationOutput.indexOf('{')));

    assert.equal(stdoutReport.kind, 'infra-agent.knowledge-extraction');
    assert.equal(stdoutReport.outputPath, outputPath);
    assert.equal(artifact.kind, 'infra-agent.knowledge-extraction');
    assert.equal(artifact.outputPath, undefined);
    assert.equal(artifact.factSetCount, stdoutReport.factSetCount);
    assert.equal(validation.valid, true);
    assert.equal(validation.factSetCount, artifact.factSetCount);
    assert.doesNotMatch(JSON.stringify(artifact), /"content"\s*:|replicaCount":\s*\{|"\$schema"/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge validate command validates extraction JSON files', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-validate-'));

  try {
    const inspection = await inspectWorkspace('fixtures/sample-workspace');
    const extraction = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['helm'],
      targetPaths: ['charts/payments-api'],
      extractedAt: '2026-05-05T00:00:00.000Z'
    });
    const inputPath = join(tempRoot, 'knowledge-extraction.json');
    await writeFile(inputPath, JSON.stringify(extraction, null, 2));

    const output = await captureStdout(() => main([
      'knowledge',
      'validate',
      inputPath,
      '--json'
    ]));
    const report = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(report.kind, 'infra-agent.knowledge-validation');
    assert.equal(report.schemaVersion, 1);
    assert.equal(report.mutationAllowed, false);
    assert.equal(report.inputKind, 'infra-agent.knowledge-extraction');
    assert.equal(report.valid, true);
    assert.equal(report.factSetCount, extraction.factSetCount);
    assert.equal(report.factCount, extraction.factCount);
    assert.deepEqual(report.issues, []);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge validate command detects stale local source fingerprints with workspace', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-validate-stale-'));
  const previousExitCode = process.exitCode;

  try {
    process.exitCode = undefined;
    await cp(resolve('fixtures/sample-workspace'), tempRoot, { recursive: true });
    const inspection = await inspectWorkspace(tempRoot);
    const extraction = await extractWorkspaceKnowledgeFacts(inspection, {
      domains: ['helm'],
      targetPaths: ['charts/payments-api'],
      extractedAt: '2026-05-05T00:00:00.000Z'
    });
    const inputPath = join(tempRoot, 'knowledge-extraction.json');
    await writeFile(inputPath, JSON.stringify(extraction, null, 2));
    await writeFile(
      join(tempRoot, 'charts/payments-api/Chart.yaml'),
      `${await readFile(join(tempRoot, 'charts/payments-api/Chart.yaml'), 'utf8')}\n# changed after extraction\n`
    );

    const output = await captureStdout(() => main([
      'knowledge',
      'validate',
      inputPath,
      '--workspace',
      tempRoot,
      '--json'
    ]));
    const report = JSON.parse(output.slice(output.indexOf('{')));

    assert.equal(report.kind, 'infra-agent.knowledge-validation');
    assert.equal(report.valid, false);
    assert.equal(report.workspaceRoot, resolve(process.cwd(), tempRoot));
    assert.equal(report.staleSourceCount, 1);
    assert.equal(process.exitCode, 1);
    assert.ok(report.issues.some(issue =>
      issue.severity === 'error'
      && /local-file-hash-mismatch/.test(issue.message)
    ));
  } finally {
    process.exitCode = previousExitCode;
    await rm(tempRoot, { recursive: true, force: true });
  }
});

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
