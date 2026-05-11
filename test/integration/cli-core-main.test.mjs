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

test('help output includes backend reference readiness command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge backend-reference-readiness <backend-config\.json> --registry <reference-registry\.json>/);
});

test('help output includes upload approval intent command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-approval-intent <publication-readiness\.json> --backend-reference <reference-readiness\.json>/);
});

test('help output includes upload approval continuation command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-approval-continuation <intent\.json> --approval-fingerprint <sha256>/);
});

test('help output includes upload adapter preflight command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-adapter-preflight <continuation\.json> --adapter-plan <adapter-plan\.json>/);
});

test('help output includes upload mock harness command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-mock-harness <preflight\.json>/);
});

test('help output includes upload execution gate command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-execution-gate <continuation\.json> --mock-harness <harness\.json>/);
});

test('help output includes upload mutation plan command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-mutation-plan <gate\.json>/);
});

test('help output includes upload mutation approval review command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-mutation-approval-review <mutation-plan\.json> --approval-fingerprint <sha256>/);
});

test('help output includes upload execution prerequisite plan command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-execution-prerequisite-plan <approval-review\.json>/);
});

test('help output includes upload write token boundary command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-write-token-boundary <execution-prerequisite-plan\.json>/);
});

test('help output includes upload execution lease boundary command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-execution-lease-boundary <write-token-boundary\.json>/);
});

test('help output includes upload rollback plan boundary command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-rollback-plan-boundary <execution-lease-boundary\.json>/);
});

test('help output includes upload audit record boundary command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-audit-record-boundary <rollback-plan-boundary\.json>/);
});

test('help output includes upload artifact bytes boundary command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-artifact-bytes-boundary <audit-record-boundary\.json>/);
});

test('help output includes upload adapter injection boundary command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-adapter-injection-boundary <artifact-bytes-boundary\.json>/);
});

test('help output includes upload client creation boundary command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-client-creation-boundary <adapter-injection-boundary\.json>/);
});

test('help output includes upload credential read boundary command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-credential-read-boundary <client-creation-boundary\.json>/);
});

test('help output includes upload credential presence boundary command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-credential-presence-boundary <credential-read-boundary\.json>/);
});

test('help output includes upload live check boundary command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-live-check-boundary <credential-presence-boundary\.json>/);
});

test('help output includes upload command boundary command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-command-boundary <live-check-boundary\.json>/);
});

test('help output includes upload object/index binding boundary command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-object-index-binding-boundary <command-boundary\.json>/);
});

test('help output includes upload execution readiness boundary command', async () => {
  const output = await captureStdout(() => main(['--help']));

  assert.match(output, /infra-agent knowledge upload-execution-readiness-boundary <object-index-binding-boundary\.json>/);
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
  const testingContent = await readFile('docs/TESTING.md', 'utf8');
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
    'docs/ROADMAP.md',
    'docs/TESTING.md'
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
  assert.match(testingContent, /test\/run-category\.mjs/);
  assert.match(testingContent, /no nested category shards/i);
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
