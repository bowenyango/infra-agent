import {
  test,
  assert,
  mkdtemp,
  cp,
  mkdir,
  readFile,
  rm,
  writeFile,
  tmpdir,
  resolve,
  join,
  inspectWorkspace,
  runSingleStep,
  executeDecision,
  buildTargetCandidates,
  detectRequestedService,
  buildRunPreflight,
  selectValidationCommands,
  buildValidationPreflight,
  classifyValidationIssues,
  RuleBasedPlanningModel,
  LLMModelClient,
  createModelClient,
  createModelClientSelection,
  resolveLLMClientConfig,
  createLLMProviderAdapter,
  DEFAULT_LLM_MODEL,
  DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
  listLLMProviderCatalog,
  resolveLLMProviderCapabilities,
  parsePlannerDecision,
  buildPlannerSystemPrompt,
  buildPlannerUserPrompt,
  buildEditPlan,
  collectApprovalSignals,
  buildCompactAgentRunResult,
  buildIdentityConflictIncidentReport,
  summarizeAgentSnapshot,
  summarizeFocusedDomainCapabilities,
  summarizeFocusedValidationPlan,
  summarizeInfraGraphImpact,
  summarizePreflightSnapshot,
  summarizePreflightSuggestedCommands,
  printPlannerProviderCatalogReport,
  printDoctorReport,
  summarizeRecommendedNextSteps,
  summarizeResultCard,
  summarizeSuggestedCommands,
  buildLLMClientConfigOverrides,
  main,
  parseArgs,
  readPackageVersion,
  buildDoctorReport,
  buildPlannerProviderCatalogDiscovery,
  buildPlannerProviderCatalogReport,
  PLANNER_PROVIDER_CATALOG_COMMAND,
  parsePlannerProviderCatalogReport,
  exitCodeForAgentOutcome,
  exitCodeForRunPreflight,
  INFRA_AGENT_EXIT_CODES,
  parseCompactAgentRunResult,
  parseInfraGraphResult,
  buildInfraGraphImpactReport,
  loadInfraGraphImpactReport,
  parseInfraGraphImpactReport,
  loadIdentityConflictIncidentReport,
  parseIdentityConflictIncidentReport,
  executeTool,
  PulumiConfigSetTool,
  SearchWorkspaceTool,
  ValidateTargetsTool,
  classifyUnsafeValidationCommand,
  resolveEffectiveApprovalPolicy,
  resolveEffectiveEditPolicy,
  inferRequestedDomains,
  prioritizeEditPlanKinds,
  buildInspectionCandidateFiles,
  buildInspectionSearchPattern,
  deriveConfigSemanticsFromValidationIssues,
  mergeConfigSemantics,
  resolveQueryLoopConfig,
  buildKnowledgeCacheId,
  isKnowledgeCacheEntryStale,
  readKnowledgeCacheEntry,
  writeKnowledgeCacheEntry,
  resolveKnowledgeCacheRoot,
  fetchOfficialKnowledgeSource,
  retrieveKnowledgeContextPacket,
  buildTerraformRegistryKnowledgeSources,
  retrieveTerraformRegistryContextPackets,
  buildTerraformLocalModuleKnowledgeContent,
  buildTerraformLocalModuleKnowledgeSources,
  buildTerraformProviderSchemaKnowledgeSources,
  retrieveTerraformProviderSchemaContextPackets,
  buildPulumiConfigKnowledgeContent,
  buildPulumiConfigKnowledgeSources,
  buildHelmChartMetadataKnowledgeContent,
  buildHelmChartKnowledgeSources,
  retrieveHelmChartContextPackets,
  prefetchWorkspaceKnowledge,
  KNOWLEDGE_FACT_EXTRACTION_METHODS,
  KNOWLEDGE_FACT_KINDS,
  parseKnowledgeFactSet,
  extractKnowledgeFactSetFromCacheEntry,
  extractWorkspaceKnowledgeFacts,
  validateKnowledgePayload,
  validateKnowledgePayloadWithLocalSources,
  buildKnowledgePack,
  budgetKnowledgePackFacts,
  rankKnowledgePackFacts,
  buildKnowledgeSourceFingerprint,
  checkKnowledgeSourceFingerprint,
  fingerprintWorkspaceFiles,
  buildStableInfraGraphSnapshot,
  normalizeInfraGraphImpactReviewTargets,
  buildWorkspaceInfraGraph,
  summarizeInfraGraph,
  attachTerraformPlanToGraph,
  parseTerraformPlanResourceChanges,
  attachPulumiPreviewToGraph,
  parsePulumiPreviewResourceChanges,
  captureStdout,
  buildCompactHandoffBudgetsFixture,
  buildEmptyKnowledgeFactsFixture,
  buildEmptyApprovalGrantsFixture,
  buildEmptyApprovalPendingScopeFixture,
  buildGraphSnapshotBaseGraph,
  buildGraphSnapshotTerraformPlan,
  buildGraphSnapshotPulumiPreview,
  writeTerraformProviderSchemaWorkspace
} from '../support/cli-smoke-harness.mjs';

test('apply-edit-plan execution uses append_file for append-mode writes', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-append-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const existingValues = await readFile(join(workspaceRoot, 'charts/payments-api/values.yaml'), 'utf8');
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: 'Append bounded values update.',
          rationale: 'Test append tool path.',
          payload: {
            writes: [
              {
                path: 'charts/payments-api/values.yaml',
                content: `${existingValues.trimEnd()}\n\nfeatureFlag:\n  enabled: true\n`,
                reason: 'Append test block',
                mode: 'append'
              }
            ]
          }
        }
      },
      workspaceRoot,
      null
    );

    assert.ok(execution);
    assert.equal(execution?.executedTools[0]?.toolName, 'diff_preview');
    assert.equal(execution?.executedTools[1]?.toolName, 'validate_yaml_syntax');
    assert.equal(execution?.executedTools[2]?.toolName, 'append_file');
    assert.equal(execution?.executedTools[3]?.toolName, 'validate_yaml_syntax');
    const updatedValues = await readFile(join(workspaceRoot, 'charts/payments-api/values.yaml'), 'utf8');
    assert.match(updatedValues, /featureFlag:\n  enabled: true/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('apply-edit-plan execution uses replace_file for replace-mode writes', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-replace-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const deploymentPath = join(workspaceRoot, 'charts/payments-api/templates/deployment.yaml');
    const existingDeployment = await readFile(deploymentPath, 'utf8');
    const before = '          resources:\n';
    const after = [
      '          readinessProbe:',
      '            httpGet:',
      '              path: /healthz',
      '              port: http',
      '          resources:\n'
    ].join('\n');
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: 'Replace bounded deployment segment.',
          rationale: 'Test replace tool path.',
          payload: {
            writes: [
              {
                path: 'charts/payments-api/templates/deployment.yaml',
                content: existingDeployment.replace(before, after),
                reason: 'Insert readiness probe block',
                mode: 'replace',
                replacePatch: {
                  before,
                  after
                }
              }
            ]
          }
        }
      },
      workspaceRoot,
      null
    );

    assert.ok(execution);
    assert.equal(execution?.executedTools[0]?.toolName, 'diff_preview');
    assert.equal(execution?.executedTools[1]?.toolName, 'replace_file');
    const updatedDeployment = await readFile(deploymentPath, 'utf8');
    assert.match(updatedDeployment, /readinessProbe:/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('PulumiConfigSetTool applies bounded stack config updates through the Pulumi CLI', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-config-set-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const result = await executeTool(
      PulumiConfigSetTool,
      {
        projectRoot: 'infra/payments-api',
        stackName: 'dev',
        key: 'payments-api:imageTag',
        value: '9.9.9'
      },
      {
        workspaceRoot,
        workspaceConfig: null
      }
    );

    assert.equal(result.toolName, 'pulumi_config_set');
    assert.equal(result.output.exitCode, 0);
    assert.equal(result.output.stackFilePath, 'infra/payments-api/Pulumi.dev.yaml');
    assert.match(result.output.content, /payments-api:imageTag: 9\.9\.9/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('apply-edit-plan execution uses pulumi_config_set for Pulumi stack config plans', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-pulumi-apply-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: 'Apply Pulumi stack configuration updates.',
          rationale: 'Use the native Pulumi CLI for bounded stack config writes.',
          payload: {
            editPlan: {
              kind: 'pulumi-stack-config',
              summary: 'Apply Pulumi stack configuration updates to infra/payments-api/Pulumi.dev.yaml.',
              rationale: 'Synthetic Pulumi config write.',
              pulumiConfigOperations: [
                {
                  projectRoot: 'infra/payments-api',
                  stackName: 'dev',
                  key: 'payments-api:environment',
                  value: 'dev'
                },
                {
                  projectRoot: 'infra/payments-api',
                  stackName: 'dev',
                  key: 'payments-api:imageTag',
                  value: '2.4.6'
                }
              ],
              writes: [
                {
                  path: 'infra/payments-api/Pulumi.dev.yaml',
                  content: 'config:\n  payments-api:environment: dev\n  payments-api:imageTag: 2.4.6\n',
                  reason: 'Synthetic Pulumi stack config write.'
                }
              ]
            },
            writes: [
              {
                path: 'infra/payments-api/Pulumi.dev.yaml',
                content: 'config:\n  payments-api:environment: dev\n  payments-api:imageTag: 2.4.6\n',
                reason: 'Synthetic Pulumi stack config write.'
              }
            ]
          }
        }
      },
      workspaceRoot,
      null
    );

    assert.ok(execution);
    assert.equal(execution?.executedTools[0]?.toolName, 'diff_preview');
    assert.ok(execution?.executedTools.some(tool => tool.toolName === 'pulumi_config_set'));
    assert.ok(execution?.executedTools.every(tool => tool.toolName !== 'write_file'));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('apply-edit-plan execution blocks writes disallowed by workspace mode policy', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-mode-policy-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: 'Blocked rewrite write.',
          rationale: 'Test workspace mode policy.',
          payload: {
            writes: [
              {
                path: 'charts/payments-api/values.yaml',
                content: 'replicaCount: 3\n',
                reason: 'Rewrite test',
                mode: 'rewrite'
              }
            ]
          }
        }
      },
      workspaceRoot,
      {
        writePolicy: {
          allowedModes: ['append', 'create', 'replace']
        }
      }
    );

    assert.ok(execution);
    assert.equal(execution?.status, 'skipped');
    assert.match(execution?.reason ?? '', /write mode/i);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('validation command safety allows read-only validators and blocks mutation commands', () => {
  assert.equal(classifyUnsafeValidationCommand('terraform -chdir=terraform/payments-api fmt -check -recursive'), null);
  assert.equal(classifyUnsafeValidationCommand('terraform -chdir=terraform/payments-api validate'), null);
  assert.equal(classifyUnsafeValidationCommand('helm lint charts/payments-api'), null);
  assert.equal(classifyUnsafeValidationCommand('helm template charts/payments-api'), null);
  assert.equal(
    classifyUnsafeValidationCommand('PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive'),
    null
  );
  assert.equal(
    classifyUnsafeValidationCommand(
      'mkdir -p .pulumi-home .pulumi-state && (PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi stack init dev --cwd infra/payments-api --non-interactive >/dev/null 2>&1 || true) && PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive'
    ),
    null
  );

  assert.match(classifyUnsafeValidationCommand('terraform -chdir=terraform/payments-api apply -auto-approve')?.reason ?? '', /not validation/i);
  assert.match(classifyUnsafeValidationCommand('pulumi up --cwd infra/payments-api --stack prod --yes')?.reason ?? '', /deployment/i);
  assert.match(classifyUnsafeValidationCommand('helm upgrade payments-api charts/payments-api')?.reason ?? '', /deployment/i);
  assert.match(classifyUnsafeValidationCommand('kubectl delete deployment payments-api')?.reason ?? '', /cluster state/i);
});

test('validate_targets blocks unsafe validation commands before execution', async () => {
  const result = await executeTool(ValidateTargetsTool, {
    commands: [
      'terraform -chdir=terraform/payments-api apply -auto-approve'
    ]
  }, {
    workspaceRoot: resolve('fixtures/sample-workspace'),
    workspaceConfig: null
  });

  assert.equal(result.output.results.length, 1);
  assert.equal(result.output.results[0]?.exitCode, 1);
  assert.match(result.output.results[0]?.stderr ?? '', /blocked unsafe validation command/i);
  assert.match(result.output.results[0]?.stderr ?? '', /Terraform apply and destroy/i);

  const issues = classifyValidationIssues(result.output.results);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'unsafe-validation-command');
  assert.equal(issues[0]?.repairable, false);
  assert.equal(issues[0]?.metadata?.unsafeCommand, 'terraform -chdir=terraform/payments-api apply -auto-approve');
  assert.match(issues[0]?.metadata?.unsafeReason ?? '', /Terraform apply and destroy/i);
  assert.match(issues[0]?.guidance ?? '', /Remove deploy, apply, state mutation/i);
});

test('classifyValidationIssues marks ingress.enabled failures as repairable', () => {
  const issues = classifyValidationIssues([
    {
      command: 'helm template charts/payments-api',
      exitCode: 1,
      stdout: '',
      stderr: 'template: charts/payments-api/templates/ingress.yaml: executing at <.Values.ingress.enabled>: nil pointer evaluating interface {}.enabled'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'helm-missing-ingress-values');
  assert.equal(issues[0]?.repairable, true);
  assert.match(issues[0]?.guidance ?? '', /define the ingress block in values\.yaml/i);
});

test('classifyValidationIssues adds actionable guidance for missing Helm service.port', () => {
  const issues = classifyValidationIssues([
    {
      command: 'helm template charts/payments-api',
      exitCode: 1,
      stdout: '',
      stderr: 'template: charts/payments-api/templates/service.yaml: executing at <.Values.service.port>: nil pointer evaluating interface {}.port'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'helm-missing-service-port');
  assert.equal(issues[0]?.repairable, true);
  assert.match(issues[0]?.guidance ?? '', /define service\.port in values\.yaml/i);
});

test('classifyValidationIssues marks YAML syntax failures as blockers', () => {
  const issues = classifyValidationIssues([
    {
      command: 'infra-agent yaml-parse charts/payments-api/values.yaml',
      exitCode: 1,
      stdout: 'parser: python:pyyaml',
      stderr: 'while parsing a flow sequence'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'yaml-syntax-failure');
  assert.equal(issues[0]?.repairable, false);
  assert.equal(issues[0]?.metadata?.yamlPath, 'charts/payments-api/values.yaml');
  assert.equal(issues[0]?.metadata?.yamlParser, 'python:pyyaml');
  assert.match(issues[0]?.guidance ?? '', /Fix the planned YAML content/i);
});

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

test('parsePlannerDecision requires stopReason for stop actions', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');

  assert.throws(
    () =>
      parsePlannerDecision(
        JSON.stringify({
          confidence: 'medium',
          action: {
            kind: 'stop',
            summary: 'Stop here',
            rationale: 'No further work'
          }
        }),
        {
          task: preflight.task,
          preflight,
          observations: [],
          appliedWrites: [],
          validationResults: [],
          validationIssues: [],
          approvalSignals: [],
          repairAttempts: 0,
          lastEditPlan: null
        }
      ),
    /action\.payload\.stopReason/
  );
});

test('parsePlannerDecision accepts supported stopReason values', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'high',
      action: {
        kind: 'stop',
        summary: 'Validation passed',
        rationale: 'All configured validators succeeded.',
        payload: {
          stopReason: 'validation-succeeded'
        }
      }
    }),
    {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  );

  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'validation-succeeded');
  assert.equal(decision.action.payload?.actionFamily, 'validation-complete');
});

test('parsePlannerDecision accepts supported clarificationKind values', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'high',
      action: {
        kind: 'ask-for-clarification',
        summary: 'Approval required',
        rationale: 'High-risk rewrite detected.',
        payload: {
          clarificationKind: 'approval-required',
          questions: ['Proceed with this rewrite?']
        }
      }
    }),
    {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  );

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.clarificationKind, 'approval-required');
  assert.equal(decision.action.payload?.actionFamily, 'approval-clarification');
});

test('parsePlannerDecision preserves supported actionFamily metadata', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'high',
      action: {
        kind: 'validate-targets',
        summary: 'Run validation',
        rationale: 'The LLM copied a supported metadata family.',
        payload: {
          actionFamily: 'helm-validation',
          commands: selectValidationCommands(runtime)
        }
      }
    }),
    runtime
  );

  assert.equal(decision.action.payload?.actionFamily, 'helm-validation');
});

test('parsePlannerDecision normalizes unsupported actionFamily metadata', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'medium',
      action: {
        kind: 'validate-targets',
        summary: 'Run validation',
        rationale: 'The LLM provided unsupported metadata.',
        payload: {
          actionFamily: 'pulumi-up-now',
          commands: selectValidationCommands(runtime)
        }
      }
    }),
    runtime
  );

  assert.equal(decision.action.payload?.actionFamily, 'terraform-validation');
});

test('parsePlannerDecision derives stop actionFamily from stopReason when omitted', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'medium',
      action: {
        kind: 'stop',
        summary: 'Repair budget exhausted',
        rationale: 'The bounded repair budget has been consumed.',
        payload: {
          stopReason: 'repair-budget-exhausted'
        }
      }
    }),
    {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 2,
      maxRepairAttempts: 2,
      lastEditPlan: null
    }
  );

  assert.equal(decision.action.payload?.actionFamily, 'repair-budget-exhausted');
});

test('parsePlannerDecision clamps validate-targets commands to the selected validation plan', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'high',
      action: {
        kind: 'validate-targets',
        summary: 'Run validation',
        rationale: 'The LLM mixed a safe command with unsafe invented commands.',
        payload: {
          commands: [
            'terraform -chdir=terraform/payments-api apply -auto-approve',
            'helm template charts/payments-api',
            'terraform -chdir=terraform/payments-api validate'
          ]
        }
      }
    }),
    runtime
  );

  assert.deepEqual(decision.action.payload?.commands, [
    'terraform -chdir=terraform/payments-api validate'
  ]);
});

test('parsePlannerDecision falls back to selected validation commands when all LLM commands are invented', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'medium',
      action: {
        kind: 'validate-targets',
        summary: 'Run validation',
        rationale: 'The LLM did not copy commands from the selected plan.',
        payload: {
          commands: [
            'pulumi up --cwd infra/payments-api --stack dev --yes',
            'terraform -chdir=terraform/payments-api apply -auto-approve'
          ]
        }
      }
    }),
    runtime
  );

  assert.deepEqual(decision.action.payload?.commands, selectValidationCommands(runtime));
  assert.ok(decision.action.payload?.commands?.every(command => /^helm (?:lint|template) charts\/payments-api$/.test(command)));
});

test('parsePlannerDecision clamps inspect target paths to known target candidates', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'high',
      action: {
        kind: 'inspect-target-files',
        summary: 'Inspect targets',
        rationale: 'The LLM mixed valid and invalid target paths.',
        payload: {
          targetPaths: [
            '../secrets',
            'charts/payments-api',
            '/tmp/unrelated'
          ]
        }
      }
    }),
    runtime
  );

  assert.deepEqual(decision.action.payload?.targetPaths, ['charts/payments-api']);
});

test('parsePlannerDecision falls back to known inspect targets when all LLM target paths are invalid', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const decision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'medium',
      action: {
        kind: 'inspect-target-files',
        summary: 'Inspect targets',
        rationale: 'The LLM invented target paths.',
        payload: {
          targetPaths: [
            '../secrets',
            '/tmp/unrelated'
          ]
        }
      }
    }),
    runtime
  );

  assert.deepEqual(
    decision.action.payload?.targetPaths,
    preflight.targetCandidates.slice(0, 3).map(candidate => candidate.path)
  );
});

test('parsePlannerDecision clamps Terraform formatting root path to Terraform candidates', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const invalidDecision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'medium',
      action: {
        kind: 'repair-terraform-formatting',
        summary: 'Repair formatting',
        rationale: 'The LLM proposed an unrelated path.',
        payload: {
          rootPath: '../terraform'
        }
      }
    }),
    runtime
  );
  const validDecision = parsePlannerDecision(
    JSON.stringify({
      confidence: 'high',
      action: {
        kind: 'repair-terraform-formatting',
        summary: 'Repair formatting',
        rationale: 'The LLM copied the selected Terraform root.',
        payload: {
          rootPath: 'terraform/payments-api'
        }
      }
    }),
    runtime
  );

  assert.equal(invalidDecision.action.payload?.rootPath, 'terraform/payments-api');
  assert.equal(validDecision.action.payload?.rootPath, 'terraform/payments-api');
});
