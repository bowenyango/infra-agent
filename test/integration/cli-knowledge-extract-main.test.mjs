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
    const manifestPath = join(tempRoot, 'artifacts/knowledge-extraction.manifest.json');
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
      '--manifest-out',
      manifestPath,
      '--json'
    ]));
    const stdoutReport = JSON.parse(output.slice(output.indexOf('{')));
    const artifact = JSON.parse(await readFile(outputPath, 'utf8'));
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
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
    assert.equal(stdoutReport.manifestPath, manifestPath);
    assert.equal(artifact.kind, 'infra-agent.knowledge-extraction');
    assert.equal(artifact.outputPath, undefined);
    assert.equal(artifact.factSetCount, stdoutReport.factSetCount);
    assert.equal(manifest.kind, 'infra-agent.knowledge-artifact-manifest');
    assert.equal(manifest.artifact.kind, 'infra-agent.knowledge-extraction');
    assert.equal(manifest.artifact.path, outputPath);
    assert.equal(manifest.artifact.factCount, artifact.factCount);
    assert.equal(manifest.publication.remoteWriteAllowed, false);
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
