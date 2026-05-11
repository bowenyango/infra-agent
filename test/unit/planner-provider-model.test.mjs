import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  cp,
  mkdir,
  readFile,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  resolve,
  join
} from 'node:path';
import { captureStdout } from '../support/capture-stdout.mjs';
import { executeDecision } from '../../src/agent/execute-decision.ts';
import { buildRunPreflight } from '../../src/agent/build-run-preflight.ts';
import { selectValidationCommands } from '../../src/agent/select-validation-commands.ts';
import { classifyValidationIssues } from '../../src/agent/classify-validation-issues.ts';
import { LLMModelClient } from '../../src/model/LLMModelClient.ts';
import {
  createModelClient,
  createModelClientSelection
} from '../../src/model/create-model-client.ts';
import { resolveLLMClientConfig } from '../../src/model/config.ts';
import { createLLMProviderAdapter } from '../../src/model/provider-adapter.ts';
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
  listLLMProviderCatalog,
  resolveLLMProviderCapabilities
} from '../../src/model/providers.ts';
import { parsePlannerDecision } from '../../src/model/decision-parser.ts';
import {
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt
} from '../../src/model/prompt.ts';
import { printPlannerProviderCatalogReport } from '../../src/cli/output.ts';
import {
  buildPlannerProviderCatalogDiscovery,
  buildPlannerProviderCatalogReport,
  PLANNER_PROVIDER_CATALOG_COMMAND
} from '../../src/cli/planner-provider-catalog.ts';
import { parsePlannerProviderCatalogReport } from '../../src/cli/planner-provider-catalog-contract.ts';
import { executeTool } from '../../src/services/tools/execute-tool.ts';
import { PulumiConfigSetTool } from '../../src/tools/PulumiConfigSetTool/PulumiConfigSetTool.ts';
import { ValidateTargetsTool } from '../../src/tools/ValidateTargetsTool/ValidateTargetsTool.ts';
import { classifyUnsafeValidationCommand } from '../../src/validators/command-safety.ts';
import {
  deriveConfigSemanticsFromValidationIssues,
  mergeConfigSemantics
} from '../../src/agent/config-semantics-state.ts';
import { buildKnowledgePack } from '../../src/knowledge/pack.ts';

test('planner system prompt documents explicit stop reasons', () => {
  const prompt = buildPlannerSystemPrompt();

  assert.match(prompt, /Allowed stop payload\.stopReason values:/);
  assert.match(prompt, /Allowed ask-for-clarification payload\.clarificationKind values:/);
  assert.match(prompt, /Allowed optional payload\.actionFamily metadata values:/);
  assert.match(prompt, /payload\.actionFamily is optional metadata only/);
  assert.match(prompt, /repair-budget-exhausted/);
  assert.match(prompt, /validation-succeeded/);
  assert.match(prompt, /runtimeIdentityConflicts/);
  assert.match(prompt, /runtimeIdentityConflictSummary/);
  assert.match(prompt, /review-only incident context/);
});

test('planner user prompt includes runtime identity conflict summaries', async () => {
  const preflight = await buildRunPreflight('review terraform listener rule conflict', 'fixtures/terraform-workspace');
  const prompt = buildPlannerUserPrompt({
    task: preflight.task,
    preflight,
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [
      {
        kind: 'terraform-create-before-delete-conflict',
        repairable: false,
        sourceCommand: 'terraform plan',
        message: 'Listener rule priority already exists.',
        metadata: {
          conflictCode: 'PriorityInUse',
          conflictFamily: 'aws-lb-listener-rule',
          conflictLabel: 'AWS Load Balancer Listener Rule',
          conflictSuggestedAction: 'Review listener priority ownership before retrying plan.',
          listenerArns: 'arn:aws:elasticloadbalancing:us-west-2:123456789012:listener/app/api/abc/def',
          listenerRulePriorities: '100',
          resourceAddress: 'aws_lb_listener_rule.api',
          resourceType: 'aws_lb_listener_rule'
        }
      }
    ],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });
  const parsed = JSON.parse(prompt);

  assert.equal(parsed.runtimeIdentityConflictSummary.totalCount, 1);
  assert.equal(parsed.runtimeIdentityConflictSummary.includedCount, 1);
  assert.equal(parsed.runtimeIdentityConflictSummary.omittedCount, 0);
  assert.equal(parsed.runtimeIdentityConflictSummary.maxEntries, 5);
  assert.equal(parsed.runtimeIdentityConflictSummary.byEngine.terraform, 1);
  assert.equal(parsed.runtimeIdentityConflictSummary.byEngine.pulumi, 0);
  assert.equal(parsed.runtimeIdentityConflictSummary.byRiskCategory['create-before-delete-ordering'], 1);
  assert.equal(parsed.runtimeIdentityConflictSummary.mutationAllowed, false);
  assert.equal(parsed.runtimeIdentityConflicts.length, 1);
  assert.equal(parsed.runtimeIdentityConflicts[0]?.engine, 'terraform');
  assert.equal(parsed.runtimeIdentityConflicts[0]?.conflictFamily, 'aws-lb-listener-rule');
  assert.equal(parsed.runtimeIdentityConflicts[0]?.riskCategory, 'create-before-delete-ordering');
  assert.equal(parsed.runtimeIdentityConflicts[0]?.resourceAddress, 'aws_lb_listener_rule.api');
  assert.equal(parsed.runtimeIdentityConflicts[0]?.identity.listenerRulePriorities, '100');
  assert.match(parsed.runtimeIdentityConflicts[0]?.reviewSteps[1] ?? '', /listener ARN and priority/i);
  assert.equal(parsed.runtimeIdentityConflicts[0]?.message, undefined);
});

test('LLMModelClient sends compact planner prompt and parses bounded decisions', async () => {
  const preflight = await buildRunPreflight('review terraform listener rule conflict', 'fixtures/terraform-workspace');
  let capturedUrl = '';
  let capturedInit;
  const client = new LLMModelClient(
    {
      apiKey: 'test-api-key',
      baseUrl: 'https://llm.example.test/v1',
      model: 'test-planner-model',
      provider: 'openai-compatible',
      providerCapabilities: resolveLLMProviderCapabilities('openai-compatible')
    },
    async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;

      return new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                confidence: 'high',
                action: {
                  kind: 'stop',
                  summary: 'Blocked by exclusive identity conflict.',
                  rationale: 'The provider reported an exclusive identity conflict that requires review.',
                  payload: {
                    stopReason: 'validation-blocked'
                  }
                }
              })
            }
          }
        ]
      }));
    }
  );

  const decision = await client.decideNextAction({
    task: preflight.task,
    preflight,
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [
      {
        kind: 'terraform-create-before-delete-conflict',
        repairable: false,
        sourceCommand: 'terraform plan',
        message: 'Listener rule priority already exists.',
        metadata: {
          conflictCode: 'PriorityInUse',
          conflictFamily: 'aws-lb-listener-rule',
          conflictLabel: 'AWS Load Balancer Listener Rule',
          listenerArns: 'arn:aws:elasticloadbalancing:us-west-2:123456789012:listener/app/api/abc/def',
          listenerRulePriorities: '100',
          resourceAddress: 'aws_lb_listener_rule.api',
          resourceType: 'aws_lb_listener_rule'
        }
      }
    ],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(capturedUrl, 'https://llm.example.test/v1/chat/completions');
  assert.equal(capturedInit?.method, 'POST');
  assert.equal(capturedInit?.headers?.authorization, 'Bearer test-api-key');
  const body = JSON.parse(String(capturedInit?.body));
  assert.equal(body.model, 'test-planner-model');
  assert.equal(body.response_format.type, 'json_object');
  assert.equal(body.stream, false);
  assert.match(body.messages[0]?.content ?? '', /Return exactly one JSON object/);
  const userPrompt = JSON.parse(body.messages[1]?.content ?? '{}');
  assert.equal(userPrompt.runtimeIdentityConflicts[0]?.riskCategory, 'create-before-delete-ordering');
  assert.equal(userPrompt.runtimeIdentityConflicts[0]?.resourceAddress, 'aws_lb_listener_rule.api');
  assert.equal(userPrompt.runtimeIdentityConflicts[0]?.identity.listenerRulePriorities, '100');
  assert.match(userPrompt.runtimeIdentityConflicts[0]?.reviewSteps[1] ?? '', /listener ARN and priority/i);
  assert.equal(userPrompt.repairBudget.attemptsUsed, 0);
  assert.equal(userPrompt.repairBudget.maxAttempts, undefined);
  assert.equal(decision.confidence, 'high');
  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'validation-blocked');
});

test('LLM planner config resolves explicit env maps without mutating process env', () => {
  assert.equal(resolveLLMClientConfig({}), null);

  const config = resolveLLMClientConfig({
    OPENAI_API_KEY: ' openai-key ',
    OPENAI_BASE_URL: 'https://openai-compatible.example.test/v1/',
    INFRA_AGENT_OPENAI_API_KEY: ' infra-agent-key ',
    INFRA_AGENT_OPENAI_BASE_URL: 'https://infra-agent.example.test/v1/',
    INFRA_AGENT_MODEL: ' test-model '
  });

  assert.equal(config?.apiKey, 'infra-agent-key');
  assert.equal(config?.apiKeySource, 'INFRA_AGENT_OPENAI_API_KEY');
  assert.equal(config?.provider, 'openai-compatible');
  assert.equal(config?.providerCapabilities.endpointPath, '/chat/completions');
  assert.equal(config?.providerCapabilities.supportsJsonObject, true);
  assert.equal(config?.providerCapabilities.supportsStreaming, false);
  assert.equal(config?.providerSource, 'default');
  assert.equal(config?.baseUrl, 'https://infra-agent.example.test/v1');
  assert.equal(config?.baseUrlSource, 'env');
  assert.equal(config?.model, 'test-model');
  assert.equal(config?.modelSource, 'env');

  const fallbackConfig = resolveLLMClientConfig({
    OPENAI_API_KEY: 'openai-key'
  });

  assert.equal(fallbackConfig?.apiKey, 'openai-key');
  assert.equal(fallbackConfig?.apiKeySource, 'OPENAI_API_KEY');
  assert.equal(fallbackConfig?.baseUrl, DEFAULT_OPENAI_COMPATIBLE_BASE_URL);
  assert.equal(fallbackConfig?.baseUrlSource, 'default');
  assert.equal(fallbackConfig?.model, DEFAULT_LLM_MODEL);
  assert.equal(fallbackConfig?.modelSource, 'default');
});

test('LLM planner config tracks CLI override sources without exposing keys', () => {
  const config = resolveLLMClientConfig(
    {
      OPENAI_API_KEY: 'openai-key',
      INFRA_AGENT_MODEL: 'env-model',
      INFRA_AGENT_OPENAI_BASE_URL: 'https://env.example.test/v1',
      INFRA_AGENT_LLM_PROVIDER: 'openai-compatible'
    },
    {
      provider: 'openai-compatible',
      model: ' cli-model ',
      baseUrl: 'https://cli.example.test/v1/'
    }
  );

  assert.equal(config?.apiKey, 'openai-key');
  assert.equal(config?.provider, 'openai-compatible');
  assert.equal(config?.providerSource, 'cli');
  assert.equal(config?.model, 'cli-model');
  assert.equal(config?.modelSource, 'cli');
  assert.equal(config?.baseUrl, 'https://cli.example.test/v1');
  assert.equal(config?.baseUrlSource, 'cli');
  assert.throws(
    () => resolveLLMClientConfig({ OPENAI_API_KEY: 'key', INFRA_AGENT_LLM_PROVIDER: 'anthropic' }),
    /Unsupported LLM planner provider/
  );
  for (const baseUrl of [
    'https://user:pass@planner.example.test/v1',
    'https://planner.example.test/v1?token=secret',
    'https://planner.example.test/v1#fragment',
    'file:///tmp/model'
  ]) {
    assert.throws(
      () => resolveLLMClientConfig({ OPENAI_API_KEY: 'key' }, { baseUrl }),
      /Unsupported LLM planner base URL/
    );
  }
});

test('LLM provider capabilities describe the OpenAI-compatible adapter boundary', () => {
  assert.deepEqual(resolveLLMProviderCapabilities('openai-compatible'), {
    provider: 'openai-compatible',
    transport: 'chat-completions',
    endpointPath: '/chat/completions',
    responseFormat: 'json-object',
    supportsJsonObject: true,
    supportsStreaming: false
  });
});

test('LLM provider catalog lists deterministic non-secret adapter metadata', () => {
  const catalog = listLLMProviderCatalog();

  assert.deepEqual(catalog, [
    {
      id: 'openai-compatible',
      displayName: 'OpenAI-compatible chat completions',
      status: 'supported',
      capabilities: {
        provider: 'openai-compatible',
        transport: 'chat-completions',
        endpointPath: '/chat/completions',
        responseFormat: 'json-object',
        supportsJsonObject: true,
        supportsStreaming: false
      },
      defaults: {
        model: DEFAULT_LLM_MODEL,
        baseUrl: DEFAULT_OPENAI_COMPATIBLE_BASE_URL
      }
    }
  ]);
  assert.doesNotMatch(JSON.stringify(catalog), /apiKey|authorization|bearer|secret/i);

  catalog[0].capabilities.transport = 'mutated';
  assert.equal(listLLMProviderCatalog()[0]?.capabilities.transport, 'chat-completions');
});

test('planner provider catalog report exposes read-only adapter metadata', () => {
  const report = buildPlannerProviderCatalogReport();

  assert.equal(report.kind, 'infra-agent.planner-provider-catalog');
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.mutationAllowed, false);
  assert.equal(report.liveProviderCheck, false);
  assert.deepEqual(report.scope, {
    plannerOnly: true,
    domains: ['helm', 'pulumi', 'terraform']
  });
  assert.deepEqual(report.commands, ['agent', 'doctor']);
  assert.equal(PLANNER_PROVIDER_CATALOG_COMMAND, 'infra-agent planner-providers --json');
  assert.deepEqual(report.summary, {
    providerCount: 1,
    supportedProviderCount: 1
  });
  assert.deepEqual(report.providers[0], {
    id: 'openai-compatible',
    displayName: 'OpenAI-compatible chat completions',
    status: 'supported',
    capabilities: {
      transport: 'chat-completions',
      endpointPath: '/chat/completions',
      responseFormat: 'json-object',
      supportsJsonObject: true,
      supportsStreaming: false
    },
    defaults: {
      model: DEFAULT_LLM_MODEL,
      baseUrl: DEFAULT_OPENAI_COMPATIBLE_BASE_URL
    },
    apiKeyEnv: ['INFRA_AGENT_OPENAI_API_KEY', 'OPENAI_API_KEY'],
    configEnv: {
      provider: 'INFRA_AGENT_LLM_PROVIDER',
      model: 'INFRA_AGENT_MODEL',
      baseUrl: ['INFRA_AGENT_OPENAI_BASE_URL', 'OPENAI_BASE_URL']
    },
    cliFlags: {
      provider: ['--llm-provider openai-compatible'],
      model: ['--model <name>', '--llm-model <name>'],
      baseUrl: ['--openai-base-url <url>', '--llm-base-url <url>']
    }
  });
  assert.doesNotMatch(JSON.stringify(report), /apiKeyValue|authorization|bearer|secret/i);
});

test('planner provider catalog contract validates read-only provider metadata', () => {
  const report = buildPlannerProviderCatalogReport();

  assert.equal(parsePlannerProviderCatalogReport(report).kind, 'infra-agent.planner-provider-catalog');
  assert.throws(
    () => parsePlannerProviderCatalogReport({
      ...report,
      mutationAllowed: true
    }),
    /mutationAllowed/
  );
  assert.throws(
    () => parsePlannerProviderCatalogReport({
      ...report,
      liveProviderCheck: true
    }),
    /liveProviderCheck/
  );
  assert.throws(
    () => parsePlannerProviderCatalogReport({
      ...report,
      summary: {
        ...report.summary,
        providerCount: 2
      }
    }),
    /providerCount/
  );
  assert.throws(
    () => parsePlannerProviderCatalogReport({
      ...report,
      providers: [
        {
          ...report.providers[0],
          id: 'anthropic'
        }
      ]
    }),
    /providers\[0\]\.id/
  );
  assert.throws(
    () => parsePlannerProviderCatalogReport({
      ...report,
      providers: [
        {
          ...report.providers[0],
          capabilities: {
            ...report.providers[0].capabilities,
            supportsStreaming: true
          }
        }
      ]
    }),
    /supportsStreaming/
  );
  assert.throws(
    () => parsePlannerProviderCatalogReport({
      ...report,
      providers: [
        {
          ...report.providers[0],
          cliFlags: {
            ...report.providers[0].cliFlags,
            model: ['--model <name>']
          }
        }
      ]
    }),
    /cliFlags\.model/
  );
});

test('planner provider catalog discovery projects contract-checked metadata', () => {
  assert.deepEqual(buildPlannerProviderCatalogDiscovery(), {
    schemaVersion: 1,
    source: 'static-catalog',
    command: PLANNER_PROVIDER_CATALOG_COMMAND,
    mutationAllowed: false,
    liveProviderCheck: false,
    plannerOnly: true,
    providerCount: 1,
    supportedProviderCount: 1,
    supportedProviderIds: ['openai-compatible']
  });
});

test('planner provider catalog text output summarizes adapter metadata', async () => {
  const output = await captureStdout(() => {
    printPlannerProviderCatalogReport(buildPlannerProviderCatalogReport());
  });

  assert.match(output, /Planner Providers/);
  assert.match(output, /scope: planner-only/);
  assert.match(output, /live provider check: disabled/);
  assert.match(output, /mutation allowed: false/);
  assert.match(output, /openai-compatible: transport=chat-completions, endpoint=\/chat\/completions, response=json-object, streaming=disabled/);
  assert.match(output, /commands: agent, doctor/);
  assert.match(output, /--llm-provider openai-compatible/);
  assert.match(output, /INFRA_AGENT_OPENAI_API_KEY or OPENAI_API_KEY/);
  assert.doesNotMatch(output, /authorization|bearer|secret/i);
});

test('OpenAI-compatible provider adapter builds JSON chat completion requests', () => {
  const config = resolveLLMClientConfig(
    {
      OPENAI_API_KEY: 'adapter-test-key'
    },
    {
      model: 'adapter-test-model',
      baseUrl: 'https://adapter.example.test/v1'
    }
  );
  if (!config) {
    throw new Error('Expected LLM config to resolve for provider adapter test.');
  }

  const adapter = createLLMProviderAdapter('openai-compatible');
  const request = adapter.buildRequest(config, [
    {
      role: 'system',
      content: 'system prompt'
    },
    {
      role: 'user',
      content: 'user prompt'
    }
  ]);

  assert.equal(request.url, 'https://adapter.example.test/v1/chat/completions');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.headers?.authorization, 'Bearer adapter-test-key');
  const body = JSON.parse(String(request.init.body));
  assert.equal(body.model, 'adapter-test-model');
  assert.equal(body.response_format.type, 'json_object');
  assert.equal(body.stream, false);
  assert.deepEqual(body.messages.map(message => message.role), ['system', 'user']);
  assert.equal(adapter.extractMessageContent({
    choices: [
      {
        message: {
          content: '{"action":{"kind":"stop"}}'
        }
      }
    ]
  }), '{"action":{"kind":"stop"}}');
  assert.equal(adapter.extractMessageContent({ choices: [{ message: { content: null } }] }), null);
  assert.equal(adapter.extractMessageContent({ choices: [] }), null);
});

test('createModelClient selects planner clients from explicit env maps', () => {
  const ruleBased = createModelClient('rule-based', {
    INFRA_AGENT_OPENAI_API_KEY: 'ignored-key'
  });
  const fallback = createModelClient('auto', {});
  const llmAuto = createModelClient('auto', {
    INFRA_AGENT_OPENAI_API_KEY: 'test-api-key',
    INFRA_AGENT_MODEL: 'test-model'
  });
  const llmExplicit = createModelClient('llm', {
    INFRA_AGENT_OPENAI_API_KEY: 'test-api-key',
    INFRA_AGENT_MODEL: 'explicit-model'
  });

  assert.equal(ruleBased.name, 'rule-based-model-client');
  assert.equal(fallback.name, 'rule-based-fallback');
  assert.equal(llmAuto.name, 'llm-model-client:test-model');
  assert.equal(llmExplicit.name, 'llm-model-client:explicit-model');
  assert.throws(
    () => createModelClient('llm', {}),
    /no API key was configured/
  );
});

test('createModelClientSelection reports non-secret runtime planner metadata', () => {
  const fallbackSelection = createModelClientSelection('auto', {});
  const llmSelection = createModelClientSelection(
    'llm',
    {
      INFRA_AGENT_OPENAI_API_KEY: 'secret-key',
      INFRA_AGENT_MODEL: 'env-model'
    },
    {
      model: 'cli-model',
      baseUrl: 'https://cli.example.test/v1/'
    }
  );

  assert.equal(fallbackSelection.client.name, 'rule-based-fallback');
  assert.deepEqual(fallbackSelection.plannerConfig, {
    requestedMode: 'auto',
    effectiveMode: 'rule-based',
    clientName: 'rule-based-fallback',
    fallbackReason: 'No LLM API key is configured.',
    llm: null
  });
  assert.equal(llmSelection.client.name, 'llm-model-client:cli-model');
  assert.equal(llmSelection.plannerConfig.requestedMode, 'llm');
  assert.equal(llmSelection.plannerConfig.effectiveMode, 'llm');
  assert.equal(llmSelection.plannerConfig.llm?.provider, 'openai-compatible');
  assert.equal(llmSelection.plannerConfig.llm?.model, 'cli-model');
  assert.equal(llmSelection.plannerConfig.llm?.modelSource, 'cli');
  assert.equal(llmSelection.plannerConfig.llm?.baseUrl, 'https://cli.example.test/v1');
  assert.equal(llmSelection.plannerConfig.llm?.baseUrlSource, 'cli');
  assert.equal(llmSelection.plannerConfig.llm?.apiKeySource, 'INFRA_AGENT_OPENAI_API_KEY');
  assert.deepEqual(llmSelection.plannerConfig.llm?.capabilities, {
    transport: 'chat-completions',
    endpointPath: '/chat/completions',
    responseFormat: 'json-object',
    supportsJsonObject: true,
    supportsStreaming: false
  });
  assert.doesNotMatch(JSON.stringify(llmSelection.plannerConfig), /secret-key/);
});

test('planner user prompt includes focused config semantics', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const prompt = buildPlannerUserPrompt({
    task: preflight.task,
    preflight,
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });
  const parsed = JSON.parse(prompt);

  assert.ok(parsed.configSemantics.some(summary =>
    summary.targetPath === 'charts/payments-api'
    && summary.facts.some(fact => fact.kind === 'required-field' && fact.path === 'service.port')
  ));
});

test('planner user prompt includes focused Terraform variable semantics', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const prompt = buildPlannerUserPrompt({
    task: preflight.task,
    preflight,
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });
  const parsed = JSON.parse(prompt);

  assert.ok(parsed.configSemantics.some(summary =>
    summary.targetPath === 'terraform/payments-api'
    && summary.facts.some(fact => fact.kind === 'required-field' && fact.path === 'var.image_tag')
  ));
  assert.ok(parsed.configSemantics.some(summary =>
    summary.targetPath === 'terraform/payments-api'
    && summary.facts.some(fact => fact.kind === 'enum' && fact.path === 'var.environment')
  ));
});

test('planner user prompt includes compact retrieved context packets', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const prompt = buildPlannerUserPrompt({
    task: preflight.task,
    preflight,
    retrievedContext: [
      {
        id: 'terraform-registry-aws-instance',
        source: {
          kind: 'terraform-registry',
          name: 'resource:aws_instance',
          provider: 'hashicorp/aws',
          version: '5.37.0',
          url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/instance'
        },
        confidence: 'high',
        reason: 'Terraform Registry docs for selected root terraform/payments-api',
        contentType: 'text/markdown',
        excerpt: '# aws_instance\nUse instance_type for EC2 shape.',
        tokenEstimate: 12
      }
    ],
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });
  const parsed = JSON.parse(prompt);

  assert.equal(parsed.retrievedContext[0]?.source.name, 'resource:aws_instance');
  assert.equal(parsed.retrievedContext[0]?.source.version, '5.37.0');
  assert.match(parsed.retrievedContext[0]?.excerpt ?? '', /instance_type/);
  assert.equal(parsed.retrievedContextBudget.totalPacketCount, 1);
  assert.equal(parsed.retrievedContextBudget.includedPacketCount, 1);
  assert.equal(parsed.retrievedContextBudget.omittedPacketCount, 0);
});

test('planner user prompt budgets retrieved context before model handoff', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const packets = Array.from({ length: 7 }, (_, index) => ({
    id: `terraform-registry-${index}`,
    source: {
      kind: 'terraform-registry',
      name: `resource:aws_test_${index}`,
      provider: 'hashicorp/aws',
      version: '5.37.0',
      url: `https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/test_${index}`
    },
    confidence: 'high',
    reason: 'Terraform Registry docs for selected root terraform/payments-api',
    contentType: 'text/markdown',
    excerpt: `# aws_test_${index}\n${'context '.repeat(240)}`,
    tokenEstimate: 10000
  }));
  const prompt = buildPlannerUserPrompt({
    task: preflight.task,
    preflight,
    retrievedContext: packets,
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });
  const parsed = JSON.parse(prompt);

  assert.equal(parsed.retrievedContextBudget.totalPacketCount, packets.length);
  assert.equal(parsed.retrievedContextBudget.includedPacketCount, parsed.retrievedContext.length);
  assert.equal(
    parsed.retrievedContextBudget.omittedPacketCount,
    packets.length - parsed.retrievedContext.length
  );
  assert.ok(parsed.retrievedContext.length < packets.length);
  assert.ok(parsed.retrievedContextBudget.omittedByTokenBudget > 0 || parsed.retrievedContextBudget.omittedByPacketLimit > 0);
  assert.ok(parsed.retrievedContext.every(packet => packet.excerpt.length <= parsed.retrievedContextBudget.maxExcerptChars));
});

test('planner user prompt includes budgeted knowledge facts without raw docs', async () => {
  const preflight = await buildRunPreflight('update helm payments-api image tag', 'fixtures/sample-workspace');
  const pack = await buildKnowledgePack(preflight.inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    maxFacts: 6,
    extractedAt: '2026-05-05T00:00:00.000Z'
  });
  const prompt = buildPlannerUserPrompt({
    task: preflight.task,
    preflight,
    knowledgeFacts: pack,
    retrievedContextBudget: {
      maxPackets: 5,
      maxTokens: 1000,
      maxExcerptChars: 1200,
      maxFacts: 2
    },
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });
  const parsed = JSON.parse(prompt);

  assert.equal(parsed.knowledgeFacts.kind, 'infra-agent.knowledge-facts-summary');
  assert.equal(parsed.knowledgeFacts.mutationAllowed, false);
  assert.equal(parsed.knowledgeFacts.maxFacts, 2);
  assert.equal(parsed.knowledgeFacts.includedFactCount, 2);
  assert.equal(parsed.knowledgeFacts.omittedFactCount, pack.factCount - 2);
  assert.equal(parsed.knowledgeFacts.includedUnitCount, 2);
  assert.equal(parsed.knowledgeFacts.omittedUnitCount, pack.unitCount - 2);
  assert.equal(parsed.knowledgeFacts.units.length, 2);
  assert.ok(parsed.knowledgeFacts.units.every(unit => unit.unitType === 'fact'));
  assert.ok(parsed.knowledgeFacts.units.every(unit => typeof unit.privacyScope === 'string'));
  assert.ok(parsed.knowledgeFacts.facts.some(fact => fact.path === 'chart.payments-api.image.repository'));
  assert.ok(parsed.knowledgeFacts.facts.every(fact => fact.required === true));
  assert.ok(parsed.knowledgeFacts.facts.every(fact => typeof fact.sourceLocator === 'string' && !('source' in fact)));
  assert.doesNotMatch(prompt, /"content"\s*:|contentHash|"\$schema"|replicaCount":\s*\{/);
});

test('planner user prompt includes focused Pulumi config semantics', async () => {
  const preflight = await buildRunPreflight('update pulumi payments-api dev image tag to 2.3.4', 'fixtures/sample-workspace');
  const prompt = buildPlannerUserPrompt({
    task: preflight.task,
    preflight,
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });
  const parsed = JSON.parse(prompt);

  assert.ok(parsed.configSemantics.some(summary =>
    summary.targetPath === 'infra/payments-api'
    && summary.facts.some(fact => fact.kind === 'configured-field' && fact.path === 'config.payments-api:imageTag')
  ));
  assert.ok(parsed.configSemantics.some(summary =>
    summary.targetPath === 'infra/payments-api'
    && summary.facts.some(fact => fact.kind === 'type-constraint' && fact.path === 'config.payments-api:environment')
  ));
});

test('Pulumi missing-config validation issues are promoted into config semantics', async () => {
  const preflight = await buildRunPreflight('update pulumi payments-api dev image tag to 2.3.4', 'fixtures/sample-workspace');
  const sourceCommand = preflight.validation.plan
    .find(entry => entry.kind === 'pulumi' && entry.target === 'infra/payments-api' && entry.commands.some(command => /--stack dev\b/.test(command)))
    ?.commands[0];
  assert.ok(sourceCommand);
  const runtime = {
    task: preflight.task,
    preflight,
    configSemantics: [...preflight.inspection.configSemantics],
    observations: [],
    toolSummaries: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [
      {
        kind: 'pulumi-missing-config',
        repairable: true,
        sourceCommand,
        message: 'missing required configuration variable "payments-api:imageTag"',
        metadata: {
          missingConfigKey: 'payments-api:imageTag'
        }
      }
    ],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const derivedSemantics = deriveConfigSemanticsFromValidationIssues(runtime);
  const mergedSemantics = mergeConfigSemantics(runtime.configSemantics, derivedSemantics);
  const prompt = buildPlannerUserPrompt({
    ...runtime,
    configSemantics: mergedSemantics
  });
  const parsed = JSON.parse(prompt);

  assert.ok(derivedSemantics.some(summary =>
    summary.targetPath === 'infra/payments-api'
    && summary.facts.some(fact =>
      fact.kind === 'required-field'
      && fact.path === 'config.payments-api:imageTag'
      && fact.source.kind === 'pulumi-preview'
    )
  ));
  assert.ok(parsed.configSemantics.some(summary =>
    summary.targetPath === 'infra/payments-api'
    && summary.facts.some(fact => fact.kind === 'required-field' && fact.path === 'config.payments-api:imageTag')
  ));
});
