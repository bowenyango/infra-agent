import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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

test('knowledge source selection accepts resource identities', () => {
  const parsed = parseArgs([
    'knowledge',
    'pack',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--resource',
    'chart:payments-api',
    '--max-units',
    '4',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'pack');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.deepEqual(parsed.domains, ['helm']);
  assert.deepEqual(parsed.targetPaths, []);
  assert.equal(parsed.knowledgeResource, 'chart:payments-api');
  assert.equal(parsed.maxUnits, 4);
  assert.equal(parsed.json, true);
});

test('knowledge resource CLI args accept one-shot resource report flags', () => {
  const parsed = parseArgs([
    'knowledge',
    'resource',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--resource',
    'chart:payments-api',
    '--source',
    'chart-schema:example',
    '--max-units',
    '4',
    '--out',
    'artifacts/resource-knowledge.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'resource');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.deepEqual(parsed.domains, ['helm']);
  assert.deepEqual(parsed.targetPaths, []);
  assert.equal(parsed.knowledgeResource, 'chart:payments-api');
  assert.deepEqual(parsed.sourceIds, ['chart-schema:example']);
  assert.equal(parsed.maxUnits, 4);
  assert.equal(parsed.outputPath, 'artifacts/resource-knowledge.json');
  assert.equal(parsed.json, true);
});

test('knowledge from-url CLI args accept public documentation URL extraction flags', () => {
  const parsed = parseArgs([
    'knowledge',
    'from-url',
    'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket',
    '--content',
    'fixtures/aws_s3_bucket.md',
    '--max-units',
    '20',
    '--out',
    'artifacts/aws-s3-url-knowledge.json',
    '--library-out',
    'artifacts/aws-s3-library.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'from-url');
  assert.equal(parsed.inputPath, 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket');
  assert.equal(parsed.contentPath, 'fixtures/aws_s3_bucket.md');
  assert.equal(parsed.maxUnits, 20);
  assert.equal(parsed.outputPath, 'artifacts/aws-s3-url-knowledge.json');
  assert.equal(parsed.libraryOutputPath, 'artifacts/aws-s3-library.json');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.json, true);
});

test('knowledge library-download CLI args require a coordinate and local store target', () => {
  const parsed = parseArgs([
    'knowledge',
    'library-download',
    'knowledge/public-library-registry.json',
    '--coordinate',
    'terraform/provider/hashicorp/aws/5.37.0/resource/aws_s3_bucket',
    '--workspace',
    'fixtures/sample-workspace',
    '--store-dir',
    'knowledge/downloaded-public-library',
    '--out',
    'artifacts/public-library-download.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'library-download');
  assert.equal(parsed.inputPath, 'knowledge/public-library-registry.json');
  assert.equal(parsed.publicLibraryDownloadCoordinate, 'terraform/provider/hashicorp/aws/5.37.0/resource/aws_s3_bucket');
  assert.equal(parsed.workspace, resolve(process.cwd(), 'fixtures/sample-workspace'));
  assert.equal(parsed.publishStoreDir, 'knowledge/downloaded-public-library');
  assert.equal(parsed.outputPath, 'artifacts/public-library-download.json');
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
    '--units-out',
    'artifacts/units',
    '--manifest-out',
    'artifacts/knowledge-extraction.manifest.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'extract');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.deepEqual(parsed.domains, ['helm']);
  assert.deepEqual(parsed.targetPaths, ['charts/payments-api']);
  assert.deepEqual(parsed.sourceIds, ['chart-schema:example']);
  assert.equal(parsed.outputPath, 'artifacts/knowledge-extraction.json');
  assert.equal(parsed.unitOutputDir, 'artifacts/units');
  assert.equal(parsed.manifestOutputPath, 'artifacts/knowledge-extraction.manifest.json');
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
    '--manifest-out',
    'artifacts/knowledge-pack.manifest.json',
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
  assert.equal(parsed.manifestOutputPath, 'artifacts/knowledge-pack.manifest.json');
  assert.equal(parsed.json, true);
});

test('knowledge pack CLI args accept unit-first budget alias', () => {
  const parsed = parseArgs([
    'knowledge',
    'pack',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--max-facts',
    '9',
    '--max-units',
    '4',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'pack');
  assert.equal(parsed.maxFacts, 9);
  assert.equal(parsed.maxUnits, 4);
  assert.equal(parsed.json, true);
});

test('knowledge index CLI args accept compact unit index flags', () => {
  const parsed = parseArgs([
    'knowledge',
    'index',
    'fixtures/sample-workspace',
    '--domain',
    'helm',
    '--target',
    'charts/payments-api',
    '--source',
    'chart-schema:example',
    '--max-units',
    '4',
    '--unit-type',
    'fact',
    '--field-path',
    'image.repository',
    '--provider',
    'hashicorp/aws',
    '--package',
    'payments-api',
    '--chart',
    'payments-api',
    '--module',
    'charts/payments-api',
    '--version',
    '0.1.0',
    '--privacy-scope',
    'workspace-private',
    '--storage-scope',
    'workspace-private',
    '--out',
    'artifacts/knowledge-index.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'index');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.deepEqual(parsed.domains, ['helm']);
  assert.deepEqual(parsed.targetPaths, ['charts/payments-api']);
  assert.deepEqual(parsed.sourceIds, ['chart-schema:example']);
  assert.equal(parsed.maxUnits, 4);
  assert.deepEqual(parsed.knowledgeIndexFilter, {
    unitType: 'fact',
    fieldPath: 'image.repository',
    provider: 'hashicorp/aws',
    packageName: 'payments-api',
    chart: 'payments-api',
    module: 'charts/payments-api',
    version: '0.1.0',
    privacyScope: 'workspace-private',
    storageScope: 'workspace-private'
  });
  assert.equal(parsed.outputPath, 'artifacts/knowledge-index.json');
  assert.equal(parsed.json, true);
});

test('knowledge publish CLI args accept lean shared artifact staging flags', () => {
  const parsed = parseArgs([
    'knowledge',
    'publish',
    'artifacts/aws-s3.units.json',
    '--workspace',
    'fixtures/sample-workspace',
    '--store-dir',
    'knowledge/shared',
    '--registry',
    'knowledge/unit-registry.json',
    '--domain',
    'terraform',
    '--target',
    'terraform/app',
    '--name',
    'aws-s3-team-units',
    '--version',
    '2026-05-15',
    '--provider',
    'hashicorp/aws',
    '--package',
    '@pulumi/aws',
    '--chart',
    'kube-prometheus-stack',
    '--module',
    's3',
    '--allow-workspace-private',
    '--out',
    'artifacts/publish-report.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'publish');
  assert.equal(parsed.inputPath, 'artifacts/aws-s3.units.json');
  assert.equal(parsed.workspace, resolve(process.cwd(), 'fixtures/sample-workspace'));
  assert.equal(parsed.publishStoreDir, 'knowledge/shared');
  assert.equal(parsed.publishRegistryPath, 'knowledge/unit-registry.json');
  assert.deepEqual(parsed.domains, ['terraform']);
  assert.deepEqual(parsed.targetPaths, ['terraform/app']);
  assert.equal(parsed.publishName, 'aws-s3-team-units');
  assert.equal(parsed.publishVersion, '2026-05-15');
  assert.equal(parsed.publishProvider, 'hashicorp/aws');
  assert.equal(parsed.publishPackageName, '@pulumi/aws');
  assert.equal(parsed.publishChart, 'kube-prometheus-stack');
  assert.equal(parsed.publishModule, 's3');
  assert.equal(parsed.publishAllowWorkspacePrivate, true);
  assert.equal(parsed.outputPath, 'artifacts/publish-report.json');
  assert.equal(parsed.json, true);
});

test('knowledge library-stage CLI args accept public library registry staging flags', () => {
  const parsed = parseArgs([
    'knowledge',
    'library-stage',
    'artifacts/aws-s3-library.json',
    '--workspace',
    'fixtures/sample-workspace',
    '--store-dir',
    'knowledge/public-library',
    '--registry',
    'knowledge/public-library-registry.json',
    '--out',
    'artifacts/library-stage-report.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'library-stage');
  assert.equal(parsed.inputPath, 'artifacts/aws-s3-library.json');
  assert.equal(parsed.workspace, resolve(process.cwd(), 'fixtures/sample-workspace'));
  assert.equal(parsed.publishStoreDir, 'knowledge/public-library');
  assert.equal(parsed.publishRegistryPath, 'knowledge/public-library-registry.json');
  assert.equal(parsed.outputPath, 'artifacts/library-stage-report.json');
  assert.equal(parsed.json, true);
});

test('knowledge library-catalog CLI args accept public registry filter flags', () => {
  const parsed = parseArgs([
    'knowledge',
    'library-catalog',
    'artifacts/public-library-registry.json',
    '--domain',
    'terraform',
    '--provider',
    'hashicorp/aws',
    '--resource',
    'aws_s3_bucket',
    '--version',
    'latest',
    '--tag',
    'resource-docs',
    '--quality',
    'ready',
    '--coordinate',
    'terraform/provider/hashicorp/aws/latest/resource/aws_s3_bucket',
    '--out',
    'artifacts/public-library-catalog.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'library-catalog');
  assert.equal(parsed.inputPath, 'artifacts/public-library-registry.json');
  assert.equal(parsed.workspace, process.cwd());
  assert.deepEqual(parsed.domains, ['terraform']);
  assert.equal(parsed.knowledgeResource, 'aws_s3_bucket');
  assert.deepEqual(parsed.publicLibraryCatalogFilter, {
    provider: 'hashicorp/aws',
    version: 'latest',
    tags: ['resource-docs'],
    qualityStatus: 'ready',
    coordinates: 'terraform/provider/hashicorp/aws/latest/resource/aws_s3_bucket',
    domains: ['terraform'],
    resource: 'aws_s3_bucket'
  });
  assert.equal(parsed.outputPath, 'artifacts/public-library-catalog.json');
  assert.equal(parsed.json, true);
});

test('knowledge library-refinement-review CLI args accept artifact input and output flags', () => {
  const parsed = parseArgs([
    'knowledge',
    'library-refinement-review',
    'artifacts/aws-s3-library.json',
    '--out',
    'artifacts/refinement-review.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'library-refinement-review');
  assert.equal(parsed.inputPath, 'artifacts/aws-s3-library.json');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.outputPath, 'artifacts/refinement-review.json');
  assert.equal(parsed.json, true);
});

test('knowledge library-refinement-review rejects unrelated selector and download flags', () => {
  const rejectedArgs = [
    ['--domain', 'terraform'],
    ['--resource', 'aws_s3_bucket'],
    ['--coordinate', 'terraform/provider/hashicorp/aws/latest/resource/aws_s3_bucket'],
    ['--workspace', 'fixtures/sample-workspace']
  ];

  for (const args of rejectedArgs) {
    const script = [
      "import { parseArgs } from './src/cli/main.ts';",
      `parseArgs(${JSON.stringify(['knowledge', 'library-refinement-review', 'artifacts/aws-s3-library.json', ...args])});`
    ].join(' ');
    const result = spawnSync(process.execPath, [
      '--experimental-strip-types',
      '--input-type=module',
      '-e',
      script
    ], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });

    assert.equal(result.status, 1);
  }
});

test('knowledge index filters are rejected for other knowledge actions', () => {
  const script = "import { parseArgs } from './src/cli/main.ts'; parseArgs(['knowledge', 'pack', 'fixtures/sample-workspace', '--unit-type', 'fact']);";
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    '--input-type=module',
    '-e',
    script
  ], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  assert.equal(result.status, 1);
});

test('knowledge source selection rejects target and resource together', () => {
  const script = "import { parseArgs } from './src/cli/main.ts'; parseArgs(['knowledge', 'sources', 'fixtures/sample-workspace', '--target', 'charts/payments-api', '--resource', 'chart:payments-api']);";
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    '--input-type=module',
    '-e',
    script
  ], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  assert.equal(result.status, 1);
});

test('knowledge resource requires a resource identity', () => {
  const script = "import { parseArgs } from './src/cli/main.ts'; parseArgs(['knowledge', 'resource', 'fixtures/sample-workspace', '--domain', 'helm']);";
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    '--input-type=module',
    '-e',
    script
  ], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  assert.equal(result.status, 1);
});

test('knowledge resource rejects target selection', () => {
  const script = "import { parseArgs } from './src/cli/main.ts'; parseArgs(['knowledge', 'resource', 'fixtures/sample-workspace', '--target', 'charts/payments-api', '--resource', 'chart:payments-api']);";
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    '--input-type=module',
    '-e',
    script
  ], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  assert.equal(result.status, 1);
});
