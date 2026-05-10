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

test('knowledge publish-plan CLI args accept manifest descriptor and output paths', () => {
  const parsed = parseArgs([
    'knowledge',
    'publish-plan',
    'artifacts/knowledge-pack.manifest.json',
    '--descriptor',
    'artifacts/knowledge-pack.descriptor.json',
    '--out',
    'artifacts/knowledge-pack.publication-plan.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'publish-plan');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.inputPath, 'artifacts/knowledge-pack.manifest.json');
  assert.equal(parsed.descriptorInputPath, 'artifacts/knowledge-pack.descriptor.json');
  assert.equal(parsed.outputPath, 'artifacts/knowledge-pack.publication-plan.json');
  assert.equal(parsed.json, true);
});

test('knowledge publish-readiness CLI args accept plan index entry and output paths', () => {
  const parsed = parseArgs([
    'knowledge',
    'publish-readiness',
    'artifacts/knowledge-pack.publication-plan.json',
    '--index-entry',
    'artifacts/knowledge-pack.index-entry.json',
    '--out',
    'artifacts/knowledge-pack.readiness.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'publish-readiness');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.inputPath, 'artifacts/knowledge-pack.publication-plan.json');
  assert.equal(parsed.indexEntryInputPath, 'artifacts/knowledge-pack.index-entry.json');
  assert.equal(parsed.outputPath, 'artifacts/knowledge-pack.readiness.json');
  assert.equal(parsed.json, true);
});

test('knowledge backend-readiness CLI args accept config and output paths', () => {
  const parsed = parseArgs([
    'knowledge',
    'backend-readiness',
    'artifacts/team-backend.config.json',
    '--out',
    'artifacts/team-backend.readiness.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'backend-readiness');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.inputPath, 'artifacts/team-backend.config.json');
  assert.equal(parsed.outputPath, 'artifacts/team-backend.readiness.json');
  assert.equal(parsed.json, true);
});

test('knowledge backend-reference-readiness CLI args accept config registry and output paths', () => {
  const parsed = parseArgs([
    'knowledge',
    'backend-reference-readiness',
    'artifacts/team-backend.config.json',
    '--registry',
    'artifacts/team-backend.reference-registry.json',
    '--out',
    'artifacts/team-backend.reference-readiness.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'backend-reference-readiness');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.inputPath, 'artifacts/team-backend.config.json');
  assert.equal(parsed.registryInputPath, 'artifacts/team-backend.reference-registry.json');
  assert.equal(parsed.outputPath, 'artifacts/team-backend.reference-readiness.json');
  assert.equal(parsed.json, true);
});

test('knowledge upload-approval-intent CLI args accept readiness reference and output paths', () => {
  const parsed = parseArgs([
    'knowledge',
    'upload-approval-intent',
    'artifacts/knowledge-pack.readiness.json',
    '--backend-reference',
    'artifacts/team-backend.reference-readiness.json',
    '--out',
    'artifacts/knowledge-pack.upload-intent.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'upload-approval-intent');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.inputPath, 'artifacts/knowledge-pack.readiness.json');
  assert.equal(parsed.backendReferenceInputPath, 'artifacts/team-backend.reference-readiness.json');
  assert.equal(parsed.outputPath, 'artifacts/knowledge-pack.upload-intent.json');
  assert.equal(parsed.json, true);
});

test('knowledge upload-approval-continuation CLI args accept intent fingerprint and output paths', () => {
  const parsed = parseArgs([
    'knowledge',
    'upload-approval-continuation',
    'artifacts/knowledge-pack.upload-intent.json',
    '--approval-fingerprint',
    'a'.repeat(64),
    '--out',
    'artifacts/knowledge-pack.upload-continuation.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'upload-approval-continuation');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.inputPath, 'artifacts/knowledge-pack.upload-intent.json');
  assert.equal(parsed.approvalFingerprint, 'a'.repeat(64));
  assert.equal(parsed.outputPath, 'artifacts/knowledge-pack.upload-continuation.json');
  assert.equal(parsed.json, true);
});

test('knowledge upload-adapter-preflight CLI args accept continuation adapter plan and output paths', () => {
  const parsed = parseArgs([
    'knowledge',
    'upload-adapter-preflight',
    'artifacts/knowledge-pack.upload-continuation.json',
    '--adapter-plan',
    'artifacts/team-backend.adapter-plan.json',
    '--out',
    'artifacts/knowledge-pack.upload-adapter-preflight.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'upload-adapter-preflight');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.inputPath, 'artifacts/knowledge-pack.upload-continuation.json');
  assert.equal(parsed.adapterPlanInputPath, 'artifacts/team-backend.adapter-plan.json');
  assert.equal(parsed.outputPath, 'artifacts/knowledge-pack.upload-adapter-preflight.json');
  assert.equal(parsed.json, true);
});

test('knowledge upload-mock-harness CLI args accept preflight and output paths', () => {
  const parsed = parseArgs([
    'knowledge',
    'upload-mock-harness',
    'artifacts/knowledge-pack.upload-adapter-preflight.json',
    '--out',
    'artifacts/knowledge-pack.upload-mock-harness.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'upload-mock-harness');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.inputPath, 'artifacts/knowledge-pack.upload-adapter-preflight.json');
  assert.equal(parsed.outputPath, 'artifacts/knowledge-pack.upload-mock-harness.json');
  assert.equal(parsed.json, true);
});

test('knowledge upload-execution-gate CLI args accept continuation mock harness and output paths', () => {
  const parsed = parseArgs([
    'knowledge',
    'upload-execution-gate',
    'artifacts/knowledge-pack.upload-continuation.json',
    '--mock-harness',
    'artifacts/knowledge-pack.upload-mock-harness.json',
    '--out',
    'artifacts/knowledge-pack.upload-execution-gate.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'upload-execution-gate');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.inputPath, 'artifacts/knowledge-pack.upload-continuation.json');
  assert.equal(parsed.mockHarnessInputPath, 'artifacts/knowledge-pack.upload-mock-harness.json');
  assert.equal(parsed.outputPath, 'artifacts/knowledge-pack.upload-execution-gate.json');
  assert.equal(parsed.json, true);
});

test('knowledge upload-mutation-plan CLI args accept execution gate and output paths', () => {
  const parsed = parseArgs([
    'knowledge',
    'upload-mutation-plan',
    'artifacts/knowledge-pack.upload-execution-gate.json',
    '--out',
    'artifacts/knowledge-pack.upload-mutation-plan.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'upload-mutation-plan');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.inputPath, 'artifacts/knowledge-pack.upload-execution-gate.json');
  assert.equal(parsed.outputPath, 'artifacts/knowledge-pack.upload-mutation-plan.json');
  assert.equal(parsed.json, true);
});

test('knowledge upload-mutation-approval-review CLI args accept mutation plan fingerprint and output paths', () => {
  const parsed = parseArgs([
    'knowledge',
    'upload-mutation-approval-review',
    'artifacts/knowledge-pack.upload-mutation-plan.json',
    '--approval-fingerprint',
    'b'.repeat(64),
    '--out',
    'artifacts/knowledge-pack.upload-mutation-approval-review.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'upload-mutation-approval-review');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.inputPath, 'artifacts/knowledge-pack.upload-mutation-plan.json');
  assert.equal(parsed.approvalFingerprint, 'b'.repeat(64));
  assert.equal(parsed.outputPath, 'artifacts/knowledge-pack.upload-mutation-approval-review.json');
  assert.equal(parsed.json, true);
});

test('knowledge upload-execution-prerequisite-plan CLI args accept approval review and output paths', () => {
  const parsed = parseArgs([
    'knowledge',
    'upload-execution-prerequisite-plan',
    'artifacts/knowledge-pack.upload-mutation-approval-review.json',
    '--out',
    'artifacts/knowledge-pack.upload-execution-prerequisite-plan.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'upload-execution-prerequisite-plan');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.inputPath, 'artifacts/knowledge-pack.upload-mutation-approval-review.json');
  assert.equal(parsed.outputPath, 'artifacts/knowledge-pack.upload-execution-prerequisite-plan.json');
  assert.equal(parsed.json, true);
});

test('knowledge upload-write-token-boundary CLI args accept prerequisite plan and output paths', () => {
  const parsed = parseArgs([
    'knowledge',
    'upload-write-token-boundary',
    'artifacts/knowledge-pack.upload-execution-prerequisite-plan.json',
    '--out',
    'artifacts/knowledge-pack.upload-write-token-boundary.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'upload-write-token-boundary');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.inputPath, 'artifacts/knowledge-pack.upload-execution-prerequisite-plan.json');
  assert.equal(parsed.outputPath, 'artifacts/knowledge-pack.upload-write-token-boundary.json');
  assert.equal(parsed.json, true);
});

test('knowledge upload-execution-lease-boundary CLI args accept write-token boundary and output paths', () => {
  const parsed = parseArgs([
    'knowledge',
    'upload-execution-lease-boundary',
    'artifacts/knowledge-pack.upload-write-token-boundary.json',
    '--out',
    'artifacts/knowledge-pack.upload-execution-lease-boundary.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'upload-execution-lease-boundary');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.inputPath, 'artifacts/knowledge-pack.upload-write-token-boundary.json');
  assert.equal(parsed.outputPath, 'artifacts/knowledge-pack.upload-execution-lease-boundary.json');
  assert.equal(parsed.json, true);
});

test('knowledge upload-rollback-plan-boundary CLI args accept execution lease boundary and output paths', () => {
  const parsed = parseArgs([
    'knowledge',
    'upload-rollback-plan-boundary',
    'artifacts/knowledge-pack.upload-execution-lease-boundary.json',
    '--out',
    'artifacts/knowledge-pack.upload-rollback-plan-boundary.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'knowledge');
  assert.equal(parsed.knowledgeAction, 'upload-rollback-plan-boundary');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.inputPath, 'artifacts/knowledge-pack.upload-execution-lease-boundary.json');
  assert.equal(parsed.outputPath, 'artifacts/knowledge-pack.upload-rollback-plan-boundary.json');
  assert.equal(parsed.json, true);
});
