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

test('agent CLI args accept --max-turns for bounded loop control', () => {
  const parsed = parseArgs([
    'agent',
    'add ingress to payments-api dev chart',
    '--workspace',
    'fixtures/sample-workspace',
    '--planner',
    'rule-based',
    '--model',
    'gpt-5-mini',
    '--openai-base-url',
    'https://planner.example.test/v1',
    '--llm-provider',
    'openai-compatible',
    '--max-turns',
    '1',
    '--max-repair-attempts',
    '0',
    '--context-packet-limit',
    '2',
    '--context-token-budget',
    '500',
    '--context-fact-limit',
    '4',
    '--approve-tool-category',
    'native-stack-config-write',
    '--json'
  ]);

  assert.equal(parsed.command, 'agent');
  assert.equal(parsed.task, 'add ingress to payments-api dev chart');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.equal(parsed.planner, 'rule-based');
  assert.equal(parsed.llmModel, 'gpt-5-mini');
  assert.equal(parsed.llmBaseUrl, 'https://planner.example.test/v1');
  assert.equal(parsed.llmProvider, 'openai-compatible');
  assert.equal(parsed.maxTurns, 1);
  assert.equal(parsed.maxRepairAttempts, 0);
  assert.equal(parsed.contextPacketLimit, 2);
  assert.equal(parsed.contextTokenBudget, 500);
  assert.equal(parsed.contextFactLimit, 4);
  assert.deepEqual(parsed.approvedToolCategories, ['native-stack-config-write']);
  assert.equal(parsed.json, true);
  assert.equal(parsed.jsonFull, false);
});

test('agent CLI args parse write approval resume scope with query budget flags', () => {
  const parsed = parseArgs([
    'agent',
    'add ingress to payments-api dev chart',
    '--workspace',
    'fixtures/sample-workspace',
    '--max-turns',
    '3',
    '--max-repair-attempts',
    '0',
    '--context-packet-limit',
    '2',
    '--context-token-budget',
    '500',
    '--context-fact-limit',
    '4',
    '--approve-write-risk',
    'high',
    '--approve-write-path',
    'charts/payments-api/values.yaml',
    '--json-full'
  ]);

  assert.equal(parsed.command, 'agent');
  assert.equal(parsed.task, 'add ingress to payments-api dev chart');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.equal(parsed.maxTurns, 3);
  assert.equal(parsed.maxRepairAttempts, 0);
  assert.equal(parsed.contextPacketLimit, 2);
  assert.equal(parsed.contextTokenBudget, 500);
  assert.equal(parsed.contextFactLimit, 4);
  assert.deepEqual(parsed.approvedWriteRisks, ['high']);
  assert.deepEqual(parsed.approvedWritePaths, ['charts/payments-api/values.yaml']);
  assert.deepEqual(parsed.approvedToolCategories, []);
  assert.equal(parsed.json, true);
  assert.equal(parsed.jsonFull, true);
});

test('agent CLI args accept --json-full for full debug state output', () => {
  const parsed = parseArgs([
    'agent',
    'add ingress to payments-api dev chart',
    '--workspace',
    'fixtures/sample-workspace',
    '--json-full'
  ]);

  assert.equal(parsed.command, 'agent');
  assert.equal(parsed.json, true);
  assert.equal(parsed.jsonFull, true);
});

test('agent CLI args accept explicit LLM option aliases', () => {
  const parsed = parseArgs([
    'agent',
    'review terraform plan',
    '--llm-model',
    'codex-infra-test',
    '--llm-base-url',
    'https://models.example.test/v1',
    '--llm-provider',
    'openai-compatible'
  ]);

  assert.equal(parsed.command, 'agent');
  assert.equal(parsed.llmModel, 'codex-infra-test');
  assert.equal(parsed.llmBaseUrl, 'https://models.example.test/v1');
  assert.equal(parsed.llmProvider, 'openai-compatible');
  assert.deepEqual(buildLLMClientConfigOverrides(parsed), {
    provider: 'openai-compatible',
    model: 'codex-infra-test',
    baseUrl: 'https://models.example.test/v1'
  });
});

test('planner-providers CLI args parse read-only catalog command', () => {
  const parsed = parseArgs(['planner-providers', '--json']);

  assert.equal(parsed.command, 'planner-providers');
  assert.equal(parsed.task, null);
  assert.equal(parsed.json, true);
  assert.equal(parsed.jsonFull, false);
  assert.equal(parsed.workspace, process.cwd());
});

test('planner-providers command emits catalog JSON through the entrypoint', async () => {
  const output = await captureStdout(() => main(['planner-providers', '--json']));
  const report = parsePlannerProviderCatalogReport(JSON.parse(output));

  assert.equal(report.kind, 'infra-agent.planner-provider-catalog');
  assert.equal(report.providers[0]?.id, 'openai-compatible');
  assert.doesNotMatch(output, /authorization|bearer|secret/i);
});

test('planner-providers command does not expose configured environment secrets', async () => {
  const previousInfraKey = process.env.INFRA_AGENT_OPENAI_API_KEY;
  const previousOpenAIKey = process.env.OPENAI_API_KEY;
  const previousBaseUrl = process.env.INFRA_AGENT_OPENAI_BASE_URL;

  try {
    process.env.INFRA_AGENT_OPENAI_API_KEY = 'catalog-secret-infra-key';
    process.env.OPENAI_API_KEY = 'catalog-secret-openai-key';
    process.env.INFRA_AGENT_OPENAI_BASE_URL = 'https://planner.example.test/v1?token=catalog-secret-token';

    const output = await captureStdout(() => main(['planner-providers', '--json']));
    const report = parsePlannerProviderCatalogReport(JSON.parse(output));

    assert.equal(report.liveProviderCheck, false);
    assert.doesNotMatch(output, /catalog-secret-infra-key/);
    assert.doesNotMatch(output, /catalog-secret-openai-key/);
    assert.doesNotMatch(output, /catalog-secret-token/);
  } finally {
    if (previousInfraKey === undefined) {
      delete process.env.INFRA_AGENT_OPENAI_API_KEY;
    } else {
      process.env.INFRA_AGENT_OPENAI_API_KEY = previousInfraKey;
    }
    if (previousOpenAIKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousOpenAIKey;
    }
    if (previousBaseUrl === undefined) {
      delete process.env.INFRA_AGENT_OPENAI_BASE_URL;
    } else {
      process.env.INFRA_AGENT_OPENAI_BASE_URL = previousBaseUrl;
    }
  }
});

test('planner-providers command emits text through the entrypoint', async () => {
  const output = await captureStdout(() => main(['planner-providers']));

  assert.match(output, /Planner Providers/);
  assert.match(output, /openai-compatible/);
  assert.match(output, /live provider check: disabled/);
  assert.doesNotMatch(output, /authorization|bearer|secret/i);
});

test('help output includes planner provider catalog command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent planner-providers \[--json\]/);
});

test('CLI version command reads package metadata', async () => {
  const parsedLong = parseArgs(['--version']);
  const parsedCommand = parseArgs(['version']);
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

  assert.equal(parsedLong.command, 'version');
  assert.equal(parsedCommand.command, 'version');
  assert.equal(await readPackageVersion(), packageJson.version);
});

test('doctor command reports install and workspace readiness', async () => {
  const parsed = parseArgs(['doctor', 'fixtures/sample-workspace', '--json']);
  const report = await buildDoctorReport('fixtures/sample-workspace', {});

  assert.equal(parsed.command, 'doctor');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.equal(parsed.json, true);
  assert.equal(report.kind, 'infra-agent.doctor');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.version, await readPackageVersion());
  assert.ok(report.workspaceRoot.endsWith('fixtures/sample-workspace'));
  assert.deepEqual(report.plannerProviderCatalog, buildPlannerProviderCatalogDiscovery());
  assert.ok(report.checks.some(check => check.name === 'package' && check.status === 'pass'));
  assert.ok(report.checks.some(check =>
    check.name === 'agent-surface'
      && check.status === 'pass'
      && /AGENTS\.md/.test(check.detail ?? '')
      && /skills\//.test(check.detail ?? '')
      && /context-validation-and-impact\.md/.test(check.detail ?? '')
  ));
  const agentSurfaceCheck = report.checks.find(check => check.name === 'agent-surface');
  assert.doesNotMatch(agentSurfaceCheck?.detail ?? '', /fixtures\/|test\/|tests\/|scripts\//);
  assert.ok(report.checks.some(check => check.name === 'node' && check.status === 'pass'));
  assert.ok(report.checks.some(check => check.name === 'planner' && check.status === 'warn' && check.detail === 'rule-based-fallback'));
  assert.ok(report.checks.some(check => check.name === 'workspace' && check.status === 'pass'));
  assert.ok(report.checks.some(check => check.name === 'validation-plan'));
  assert.ok(report.checks.some(check => check.name === 'validator:helm'));
  assert.equal(report.summary.failCount, report.checks.filter(check => check.status === 'fail').length);
});

test('doctor text output includes planner provider catalog discovery', async () => {
  const output = await captureStdout(async () => {
    const report = await buildDoctorReport('fixtures/sample-workspace', {});
    printDoctorReport(report);
  });

  assert.match(output, /planner provider catalog: infra-agent planner-providers --json \(read-only, live check disabled\)/);
  assert.doesNotMatch(output, /authorization|bearer|secret/i);
});

test('doctor command reports configured LLM planner without exposing secrets', async () => {
  const report = await buildDoctorReport('fixtures/sample-workspace', {
    INFRA_AGENT_OPENAI_API_KEY: 'secret-value',
    INFRA_AGENT_MODEL: 'doctor-test-model',
    INFRA_AGENT_OPENAI_BASE_URL: 'https://planner.example.test/v1/'
  });
  const plannerCheck = report.checks.find(check => check.name === 'planner');

  assert.equal(plannerCheck?.status, 'pass');
  assert.match(plannerCheck?.message ?? '', /doctor-test-model/);
  assert.equal(
    plannerCheck?.detail,
    'provider=openai-compatible, model=doctor-test-model, baseUrl=https://planner.example.test/v1, transport=chat-completions, responseFormat=json-object, streaming=disabled'
  );
  assert.deepEqual(report.plannerProviderCatalog, buildPlannerProviderCatalogDiscovery());
  assert.doesNotMatch(JSON.stringify(report.plannerProviderCatalog), /doctor-test-model/);
  assert.doesNotMatch(JSON.stringify(report.plannerProviderCatalog), /planner\.example\.test/);
  assert.doesNotMatch(JSON.stringify(report.plannerProviderCatalog), /OPENAI_API_KEY/);
  assert.doesNotMatch(JSON.stringify(report), /secret-value/);
  assert.doesNotMatch(JSON.stringify(report), /authorization|bearer/i);
});

test('doctor command accepts read-only LLM planner overrides', async () => {
  const parsed = parseArgs([
    'doctor',
    'fixtures/sample-workspace',
    '--model',
    'doctor-cli-model',
    '--openai-base-url',
    'https://doctor-cli.example.test/v1',
    '--llm-provider',
    'openai-compatible',
    '--json'
  ]);
  const report = await buildDoctorReport(
    parsed.workspace,
    {
      INFRA_AGENT_OPENAI_API_KEY: 'secret-value',
      INFRA_AGENT_MODEL: 'doctor-env-model',
      INFRA_AGENT_OPENAI_BASE_URL: 'https://doctor-env.example.test/v1'
    },
    buildLLMClientConfigOverrides(parsed)
  );
  const plannerCheck = report.checks.find(check => check.name === 'planner');

  assert.equal(parsed.command, 'doctor');
  assert.equal(parsed.llmModel, 'doctor-cli-model');
  assert.equal(parsed.llmBaseUrl, 'https://doctor-cli.example.test/v1');
  assert.equal(parsed.llmProvider, 'openai-compatible');
  assert.match(plannerCheck?.message ?? '', /doctor-cli-model/);
  assert.equal(
    plannerCheck?.detail,
    'provider=openai-compatible, model=doctor-cli-model, baseUrl=https://doctor-cli.example.test/v1, transport=chat-completions, responseFormat=json-object, streaming=disabled'
  );
  assert.doesNotMatch(JSON.stringify(report), /secret-value/);
});

test('CLI exit codes map agent outcomes for downstream agents', async () => {
  assert.equal(exitCodeForAgentOutcome('completed'), INFRA_AGENT_EXIT_CODES.success);
  assert.equal(exitCodeForAgentOutcome('validation-blocked'), INFRA_AGENT_EXIT_CODES.validationBlocked);
  assert.equal(exitCodeForAgentOutcome('approval-required'), INFRA_AGENT_EXIT_CODES.approvalRequired);
  assert.equal(exitCodeForAgentOutcome('clarification-required'), INFRA_AGENT_EXIT_CODES.clarificationRequired);
  assert.equal(exitCodeForAgentOutcome('no-safe-action'), INFRA_AGENT_EXIT_CODES.noSafeAction);
  assert.equal(exitCodeForAgentOutcome('repair-budget-exhausted'), INFRA_AGENT_EXIT_CODES.repairBudgetExhausted);

  const blockedPreflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/restricted-workspace');
  const readyPreflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');

  assert.ok(blockedPreflight.blockers.length > 0);
  assert.equal(exitCodeForRunPreflight(blockedPreflight), INFRA_AGENT_EXIT_CODES.preflightBlocked);
  assert.equal(exitCodeForRunPreflight(readyPreflight), INFRA_AGENT_EXIT_CODES.success);
});

test('package metadata exposes only the installable CLI and skill surface', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  const binContent = await readFile('bin/infra-agent.js', 'utf8');
  const readmeContent = await readFile('README.md', 'utf8');
  const agentRulesContent = await readFile('docs/AGENT_RULES.md', 'utf8');
  const claudePatternsContent = await readFile('docs/CLAUDE_CODE_AGENT_PATTERNS.md', 'utf8');
  const infraSkillContent = await readFile('skills/infra-configuration/SKILL.md', 'utf8');
  const infraSkillReferenceContent = await readFile(
    'skills/infra-configuration/references/context-validation-and-impact.md',
    'utf8'
  );

  assert.equal(packageJson.bin?.['infra-agent'], './bin/infra-agent.js');
  assert.equal(packageJson.engines?.node, '>=24.0.0');
  assert.deepEqual(packageJson.files, [
    'bin/',
    'src/',
    'skills/',
    'AGENTS.md',
    'README.md',
    'docs/AGENT_RULES.md',
    'docs/CLAUDE_CODE_AGENT_PATTERNS.md',
    'docs/ROADMAP.md'
  ]);
  assert.ok(!packageJson.files.includes('fixtures/'));
  assert.ok(!packageJson.files.includes('test/'));
  assert.ok(!packageJson.files.includes('tests/'));
  assert.ok(!packageJson.files.includes('scripts/'));
  assert.ok(!packageJson.files.includes('docs/HANDOFF.md'));
  assert.match(binContent, /cwd:\s*process\.cwd\(\)/);
  assert.doesNotMatch(binContent, /cwd:\s*projectRoot/);
  assert.match(readmeContent, /infra-agent planner-providers \[--json\]/);
  assert.match(readmeContent, /infra-agent knowledge pack/);
  assert.match(readmeContent, /infra-agent\.knowledge-pack/);
  assert.match(readmeContent, /read-only text or\s+JSON report/);
  assert.match(readmeContent, /does not inspect a workspace/);
  assert.match(readmeContent, /readiness\.plannerProviderCatalog/);
  assert.match(readmeContent, /Read compact `readiness\.plannerProviderCatalog` first/);
  assert.match(agentRulesContent, /readiness\.plannerProviderCatalog/);
  assert.match(agentRulesContent, /infra-agent knowledge/);
  assert.match(agentRulesContent, /knowledge prefetch/);
  assert.match(agentRulesContent, /knowledge pack/);
  assert.match(agentRulesContent, /liveProviderCheck=false/);
  assert.match(agentRulesContent, /Doctor JSON may expose the same static\s+`plannerProviderCatalog` discovery object/);
  assert.match(claudePatternsContent, /readiness\.plannerProviderCatalog/);
  assert.match(claudePatternsContent, /knowledge sources\/prefetch\/extract\/validate\/pack/);
  assert.match(infraSkillContent, /handoffCheckpoint/);
  assert.match(infraSkillContent, /mutationAllowed=false/);
  assert.match(infraSkillContent, /harness\.plannerHandoff/);
  assert.match(infraSkillContent, /harness\.targeting/);
  assert.match(infraSkillContent, /harness\.workPlan/);
  assert.match(infraSkillContent, /harness\.plannerConfig/);
  assert.match(infraSkillContent, /harness\.plannerConfig\.llm\.capabilities/);
  assert.match(infraSkillContent, /provider\s+adapter/);
  assert.match(infraSkillContent, /harness\.repairBudget/);
  assert.match(infraSkillContent, /harness\.turnTraceBudget/);
  assert.match(infraSkillContent, /harness\.lifecycleEvents/);
  assert.match(infraSkillContent, /harness\.toolTrace/);
  assert.match(infraSkillContent, /harness\.toolPermissionSummary/);
  assert.match(infraSkillContent, /readiness/);
  assert.match(infraSkillContent, /doctorCommand/);
  assert.match(infraSkillContent, /readiness\.plannerProviderCatalog/);
  assert.match(infraSkillContent, /read\s+`readiness\.plannerProviderCatalog` first/i);
  assert.match(infraSkillContent, /planner-providers --json/);
  assert.match(infraSkillContent, /static,\s+read-only LLM planner adapter catalog/);
  assert.match(infraSkillContent, /validation\.selectedPlan/);
  assert.match(infraSkillContent, /validation\.commands/);
  assert.match(infraSkillContent, /validation\.issueSummary/);
  assert.match(infraSkillContent, /validation\.issueDetails/);
  assert.match(infraSkillContent, /validation\.issues/);
  assert.match(infraSkillContent, /validation\.safetyBlockers/);
  assert.match(infraSkillContent, /validation\.identityConflictSummary/);
  assert.match(infraSkillContent, /runtimeIdentityConflictSummary/);
  assert.match(infraSkillContent, /summary\.sourceProvenance/);
  assert.match(infraSkillContent, /reviewTargetBudget/);
  assert.match(infraSkillContent, /approval\.resume/);
  assert.match(infraSkillContent, /approval\.grants/);
  assert.match(infraSkillContent, /pendingScope/);
  assert.match(infraSkillContent, /query-budget-preserving/);
  assert.match(infraSkillContent, /CLI-selected planner flags/);
  assert.match(infraSkillContent, /additionalCommands/);
  assert.match(infraSkillContent, /knowledgeCache/);
  assert.match(infraSkillContent, /knowledgeContext/);
  assert.match(infraSkillContent, /knowledge\s+sources\/prefetch\/extract\/validate\/pack/);
  assert.match(infraSkillContent, /references\/context-validation-and-impact\.md/);
  assert.match(infraSkillReferenceContent, /Compact Contract Checklist/);
  assert.match(infraSkillReferenceContent, /readiness\.plannerProviderCatalog/);
  assert.match(infraSkillReferenceContent, /prefer\s+`readiness\.plannerProviderCatalog`/i);
  assert.match(infraSkillReferenceContent, /planner-providers --json/);
  assert.match(infraSkillReferenceContent, /KnowledgeFactSet/);
  assert.match(infraSkillReferenceContent, /KnowledgePack/);
  assert.match(infraSkillReferenceContent, /knowledge extract/);
  assert.match(infraSkillReferenceContent, /knowledge validate/);
  assert.match(infraSkillReferenceContent, /knowledge pack/);
  assert.match(infraSkillReferenceContent, /liveProviderCheck=false/);
  assert.match(infraSkillReferenceContent, /harness\.targeting/);
  assert.match(infraSkillReferenceContent, /harness\.workPlan/);
  assert.match(infraSkillReferenceContent, /harness\.plannerConfig/);
  assert.match(infraSkillReferenceContent, /provider capabilities/);
  assert.match(infraSkillReferenceContent, /JSON-object support/);
  assert.match(infraSkillReferenceContent, /harness\.toolTrace/);
  assert.match(infraSkillReferenceContent, /tail/);
  assert.match(infraSkillReferenceContent, /handoffCheckpoint\.continuation\.command/);
  assert.match(infraSkillReferenceContent, /raw-content exclusions/);
  assert.match(infraSkillReferenceContent, /validation\.identityConflictSummary/);
  assert.match(infraSkillReferenceContent, /approval\.resume/);
  assert.match(infraSkillReferenceContent, /approval\.grants/);
  assert.match(infraSkillReferenceContent, /pendingScope/);
  assert.match(infraSkillReferenceContent, /query-loop budget flags/);
  assert.match(infraSkillReferenceContent, /CLI-selected planner flags/);
  assert.match(infraSkillReferenceContent, /additionalCommands/);
  assert.match(infraSkillReferenceContent, /primary signal/);
});

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
  assert.ok(report.sources.some(source =>
    source.domain === 'helm'
    && source.targetPath === 'charts/payments-api'
    && source.id
    && source.requiresFetch === false
    && source.source.kind === 'chart-metadata'
    && source.source.localPath === 'charts/payments-api/Chart.yaml'
    && source.source.module === 'charts/payments-api'
  ));
  assert.ok(report.sources.some(source =>
    source.domain === 'helm'
    && source.targetPath === 'charts/payments-api'
    && source.id
    && source.requiresFetch === false
    && source.source.kind === 'chart-schema'
  ));
  assert.ok(report.summary.local >= 1);
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
  assert.ok(pack.sources.some(source => source.kind === 'chart-schema'));
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
    assert.ok(validation.issues.some(issue => issue.path === '$.facts[0].sourceId'));
  } finally {
    process.exitCode = previousExitCode;
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('graph CLI args accept workspace and json flags', () => {
  const parsed = parseArgs([
    'graph',
    'fixtures/sample-workspace',
    '--json'
  ]);

  assert.equal(parsed.command, 'graph');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.equal(parsed.json, true);
});

test('graph CLI args accept Terraform plan impact flags', () => {
  const parsed = parseArgs([
    'graph',
    'fixtures/terraform-workspace',
    '--terraform-plan',
    'plan.json',
    '--target',
    'terraform/payments-api',
    '--json'
  ]);

  assert.equal(parsed.command, 'graph');
  assert.equal(parsed.workspace, 'fixtures/terraform-workspace');
  assert.deepEqual(parsed.terraformPlanPaths, ['plan.json']);
  assert.deepEqual(parsed.targetPaths, ['terraform/payments-api']);
  assert.equal(parsed.json, true);
});

test('graph CLI args accept Pulumi preview impact flags', () => {
  const parsed = parseArgs([
    'graph',
    'fixtures/sample-workspace',
    '--pulumi-preview',
    'preview.json',
    '--target',
    'infra/payments-api',
    '--json'
  ]);

  assert.equal(parsed.command, 'graph');
  assert.equal(parsed.workspace, 'fixtures/sample-workspace');
  assert.deepEqual(parsed.pulumiPreviewPaths, ['preview.json']);
  assert.deepEqual(parsed.targetPaths, ['infra/payments-api']);
  assert.equal(parsed.json, true);
});

test('identity-report CLI args accept compact result input path', () => {
  const parsed = parseArgs([
    'identity-report',
    'agent-result.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'identity-report');
  assert.equal(parsed.inputPath, 'agent-result.json');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.json, true);
});

test('impact-report CLI args accept infra graph input path', () => {
  const parsed = parseArgs([
    'impact-report',
    'graph.json',
    '--json'
  ]);

  assert.equal(parsed.command, 'impact-report');
  assert.equal(parsed.inputPath, 'graph.json');
  assert.equal(parsed.workspace, process.cwd());
  assert.equal(parsed.json, true);
});

test('report CLI commands emit read-only JSON through the entrypoint', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-report-cli-'));
  const identityInputPath = join(tempRoot, 'agent-result.json');
  const graphInputPath = join(tempRoot, 'graph.json');

  try {
    await writeFile(identityInputPath, JSON.stringify({
      kind: 'infra-agent.agent-result',
      schemaVersion: 1,
      task: 'review terraform listener rule conflict',
      workspaceRoot: '/workspace',
      outcome: 'validation-blocked',
      modelName: 'rule-based',
      turnsUsed: 1,
      profileId: 'generic',
      requestedDomains: ['terraform'],
      changedFiles: [],
      resultCard: [],
      nextSteps: [],
      suggestedCommands: [],
      handoffCheckpoint: {
        schemaVersion: 1,
        source: 'agent-result',
        compact: true,
        primaryArtifact: 'agent --json',
        debugArtifact: 'agent --json-full',
        mutationAllowed: false,
        exclusions: {
          rawRuntimeIncluded: false,
          rawPreflightIncluded: false,
          rawToolOutputIncluded: false,
          rawPromptIncluded: false,
          rawKnowledgeExcerptIncluded: false
        },
        summary: {
          outcome: 'validation-blocked',
          activeBlocker: 'validation',
          nextControlAction: 'resolve-validation',
          readinessStatus: 'pass',
          validationStatus: 'failed',
          validationIssueCount: 1,
          identityConflictCount: 1,
          approvalContinuationRequired: false,
          changedFileCount: 0
        },
        budgets: buildCompactHandoffBudgetsFixture(),
        continuation: {
          required: true,
          reason: 'validation',
          nextControlAction: 'resolve-validation',
          approvalRequired: false,
          command: null,
          compactCommand: null,
          debugCommand: null,
          mutationAllowed: false
        },
        durableSections: [
          'root',
          'harness',
          'validation',
          'approval',
          'knowledge',
          'readiness',
          'result-card'
        ]
      },
      validation: {
        status: 'failed',
        selectedPlan: [],
        issueSummary: {
          totalCount: 1,
          omittedIssueCount: 0,
          repairableCount: 0,
          nonRepairableCount: 1,
          maxGroups: 8,
          omittedGroupCount: 0,
          groups: [
            {
              kind: 'terraform-create-before-delete-conflict',
              repairable: false,
              count: 1,
              sourceCommandCount: 1,
              blocking: true
            }
          ],
          flags: {
            hasRepairableIssues: false,
            hasNonRepairableIssues: true,
            hasUnsafeValidationCommand: false,
            hasYamlSyntaxFailure: false,
            hasIdentityConflict: true
          }
        },
        issueDetails: {
          maxEntries: 5,
          omittedCount: 0
        },
        issues: [
          {
            kind: 'terraform-create-before-delete-conflict',
            repairable: false,
            message: 'Listener rule priority is already in use.',
            guidance: 'Review Terraform listener rule ownership before changing the priority.',
            metadata: {
              listenerRulePriorities: '100'
            }
          }
        ],
        safetyBlockers: {
          maxEntries: 5,
          omittedCount: 0,
          entries: []
        },
        identityConflictSummary: {
          totalCount: 1,
          includedCount: 1,
          maxEntries: 5,
          omittedCount: 0,
          mutationAllowed: false,
          byEngine: {
            terraform: 1,
            pulumi: 0
          },
          byRiskCategory: {
            'create-before-delete-ordering': 1,
            'dns-or-domain-ownership': 0,
            'exclusive-identity-review': 0,
            'kubernetes-object-ownership': 0,
            'physical-name-ownership': 0
          }
        },
        identityConflicts: [
          {
            engine: 'terraform',
            issueKind: 'terraform-create-before-delete-conflict',
            conflictCode: 'PriorityInUse',
            conflictFamily: 'aws-lb-listener-rule',
            conflictLabel: 'AWS Load Balancer Listener Rule',
            resourceAddress: 'aws_lb_listener_rule.api',
            resourceName: null,
            resourceType: 'aws_lb_listener_rule',
            identity: {
              listenerRulePriorities: '100'
            },
            riskCategory: 'create-before-delete-ordering',
            reviewSteps: [
              'Review Terraform locator aws_lb_listener_rule.api against existing state/stack ownership.'
            ],
            suggestedAction: 'Use an IaC-native rename mapping for logical renames.',
            sourceCommand: 'terraform -chdir=terraform/payments-api plan'
          }
        ]
      },
      approval: {
        requiredWriteRisks: [],
        requiredToolCategories: [],
        grants: buildEmptyApprovalGrantsFixture(),
        signals: [],
        resume: {
          continuationRequired: false,
          command: null,
          compactCommand: null,
          debugCommand: null,
          primarySignal: null,
          additionalCommands: [],
          additionalSignalCount: 0,
          additionalWriteRisks: [],
          additionalWritePaths: [],
          additionalToolCategories: [],
          pendingScope: buildEmptyApprovalPendingScopeFixture(),
          writeRisks: [],
          writePaths: [],
          toolCategories: [],
          signalCount: 0
        }
      },
      knowledgeCache: {
        root: '/workspace/.infra-agent/knowledge-cache',
        source: 'workspace-config: knowledgeCache.root'
      },
      knowledgeContext: {
        maxPackets: 5,
        maxTokens: 1000,
        maxExcerptChars: 1200,
        totalPacketCount: 0,
        includedPacketCount: 0,
        omittedPacketCount: 0,
        includedTokenEstimate: 0,
        omittedTokenEstimate: 0,
        omittedByPacketLimit: 0,
        omittedByTokenBudget: 0,
        packets: []
      },
      knowledgeFacts: buildEmptyKnowledgeFactsFixture()
    }), 'utf8');

    await writeFile(graphInputPath, JSON.stringify({
      kind: 'infra-agent.infra-graph',
      schemaVersion: 1,
      mutationAllowed: false,
      workspaceRoot: '/workspace',
      nodes: [],
      edges: [],
      summary: {
        nodeCount: 0,
        edgeCount: 0,
        nodesByKind: {},
        edgesByKind: {}
      }
    }), 'utf8');

    const identityOutput = await captureStdout(() => main([
      'identity-report',
      identityInputPath,
      '--json'
    ]));
    const identityReport = JSON.parse(identityOutput);
    assert.equal(identityReport.kind, 'infra-agent.identity-conflict-report');
    assert.equal(identityReport.mutationAllowed, false);
    assert.equal(identityReport.incidentCount, 1);
    assert.equal(identityReport.incidentSummary.byEngine.terraform, 1);

    const impactOutput = await captureStdout(() => main([
      'impact-report',
      graphInputPath,
      '--json'
    ]));
    const impactReport = JSON.parse(impactOutput);
    assert.equal(impactReport.kind, 'infra-agent.infra-graph-impact-report');
    assert.equal(impactReport.mutationAllowed, false);
    assert.equal(impactReport.sourceKind, 'infra-agent.infra-graph');
    assert.equal(impactReport.counts.plannedChanges, 0);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
