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

test('rule-based planner asks Terraform-specific clarification questions when Terraform task lacks root and environment detail', async () => {
  const preflight = await buildRunPreflight('update terraform variables', 'fixtures/terraform-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
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
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.clarificationKind, 'target-ambiguity');
  assert.match(decision.action.summary, /Terraform root, variables, or environment/i);
  assert.ok(decision.action.payload?.questions?.some(question => /Which Terraform root should be updated\?/i.test(question)));
  assert.ok(decision.action.payload?.questions?.some(question => /terraform\/payments-api/i.test(question)));
  assert.ok(decision.action.payload?.questions?.some(question => /tfvars file/i.test(question)));
});

test('rule-based planner asks for primary domain clarification when a task spans multiple detected domains', async () => {
  const preflight = await buildRunPreflight('update helm and pulumi config for payments-api dev', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
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
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.clarificationKind, 'target-ambiguity');
  assert.match(decision.action.rationale, /multiple infrastructure domains/i);
  assert.ok(decision.action.payload?.questions?.some(question => /Which primary domain should the agent modify first/i.test(question)));
});

test('rule-based planner asks Terraform-specific clarification when no Terraform root is detected', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-empty-terraform-'));

  try {
    const preflight = await buildRunPreflight('update terraform variables', tempRoot);
    const planner = new RuleBasedPlanningModel();
    const decision = await planner.decideNextAction({
      runtime: {
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
    });

    assert.equal(decision.action.kind, 'ask-for-clarification');
    assert.match(decision.action.summary, /Terraform workspace and target/i);
    assert.ok(decision.action.payload?.questions?.some(question => /existing tfvars file/i.test(question)));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based planner asks Helm-specific clarification questions when Helm task lacks chart and environment detail', async () => {
  const preflight = await buildRunPreflight('update helm values', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
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
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.clarificationKind, 'target-ambiguity');
  assert.match(decision.action.summary, /Helm chart, values scope, or environment/i);
  assert.ok(decision.action.payload?.questions?.some(question => /Which Helm chart should be updated\?/i.test(question)));
  assert.ok(decision.action.payload?.questions?.some(question => /Which environment values or chart variant should be updated\?/i.test(question)));
});

test('rule-based planner asks Pulumi-specific clarification questions when Pulumi task lacks project and environment detail', async () => {
  const preflight = await buildRunPreflight('update pulumi config', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
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
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.clarificationKind, 'target-ambiguity');
  assert.match(decision.action.summary, /Pulumi project, stack, or environment/i);
  assert.ok(decision.action.payload?.questions?.some(question => /Which Pulumi project should be updated\?/i.test(question)));
  assert.ok(decision.action.payload?.questions?.some(question => /Which stack or environment should be updated\?/i.test(question)));
});

test('rule-based planner asks Helm-specific clarification when no Helm chart is detected', async () => {
  const preflight = await buildRunPreflight('add helm ingress', 'fixtures/terraform-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
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
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.match(decision.action.summary, /Helm workspace and target/i);
  assert.ok(decision.action.payload?.questions?.some(question => /Which Helm chart or chart directory should be updated\?/i.test(question)));
});

test('rule-based planner asks Pulumi-specific clarification when no Pulumi project is detected', async () => {
  const preflight = await buildRunPreflight('update pulumi stack', 'fixtures/terraform-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
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
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.match(decision.action.summary, /Pulumi workspace and target/i);
  assert.ok(decision.action.payload?.questions?.some(question => /Which Pulumi project or stack directory should be updated\?/i.test(question)));
});

test('rule-based planner includes Terraform root options in clarification for multi-root ambiguity', async () => {
  const preflight = await buildRunPreflight('update terraform image tag to 2.3.4', 'fixtures/terraform-multi-root-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
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
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.ok(decision.action.payload?.questions?.some(question => /terraform\/network-stack/i.test(question)));
  assert.ok(decision.action.payload?.questions?.some(question => /terraform\/worker-stack/i.test(question)));
  assert.ok(decision.action.payload?.questions?.some(question => /dev\.auto\.tfvars/i.test(question)));
});

test('rule-based planner emits Terraform-specific inspection summary for Terraform tasks', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
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
  });

  assert.equal(decision.action.kind, 'inspect-target-files');
  assert.equal(decision.action.payload?.actionFamily, 'terraform-inspection');
  assert.match(decision.action.summary, /Inspect the selected Terraform root files/i);
  assert.match(decision.action.rationale, /requested terraform task/i);
});

test('rule-based planner emits Helm-specific validation summary for Helm tasks', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight,
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: 'charts/payments-api/values.yaml',
            content: 'ingress:\n  enabled: true\n',
            truncated: false
          }
        }
      ],
      appliedWrites: [
        {
          path: 'charts/payments-api/values.yaml',
          content: 'ingress:\n  enabled: true\n',
          reason: 'test write',
          mode: 'append',
          risk: 'low'
        }
      ],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'validate-targets');
  assert.equal(decision.action.payload?.actionFamily, 'helm-validation');
  assert.match(decision.action.summary, /Run Helm validators for the selected chart/i);
  assert.match(decision.action.rationale, /requested helm path/i);
});

test('rule-based planner tags Pulumi ambiguity clarifications with a Pulumi action family', async () => {
  const preflight = await buildRunPreflight('update pulumi stack', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
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
  });

  assert.equal(decision.action.kind, 'ask-for-clarification');
  assert.equal(decision.action.payload?.actionFamily, 'pulumi-clarification');
});

test('rule-based planner tags validation-blocked stop actions with validation-blocked action family', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight,
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: 'terraform/payments-api/main.tf',
            content: 'variable "app_image_tag" { type = string }\n',
            truncated: false
          }
        }
      ],
      appliedWrites: [
        {
          path: 'terraform/payments-api/dev.auto.tfvars',
          content: 'app_image_tag = "2.3.4"\n',
          reason: 'test write'
        }
      ],
      validationResults: [
        {
          command: 'terraform -chdir=terraform/payments-api validate',
          exitCode: 1,
          stdout: '',
          stderr: 'Error: Missing required argument'
        }
      ],
      validationIssues: [
        {
          kind: 'terraform-validate-failure',
          repairable: false,
          sourceCommand: 'terraform -chdir=terraform/payments-api validate',
          message: 'Error: Missing required argument'
        }
      ],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.actionFamily, 'validation-blocked');
  assert.equal(decision.action.payload?.stopReason, 'validation-blocked');
});

test('rule-based agent repairs missing ingress values after validation failure', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-repair-ingress-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/repair-ingress-values-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add readiness and liveness probes to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    assert.ok(result.turns.some(turn => turn.decision.action.payload?.editPlan?.kind === 'helm-ingress-values-repair'));
    assert.ok(result.runtime.repairAttempts >= 1);
    assert.ok(result.runtime.validationResults.every(entry => entry.exitCode === 0));
    assert.equal(result.runtime.validationIssues.length, 0);
    assert.equal(result.outcome, 'completed');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based planner stops with repair-budget-exhausted after bounded retries are consumed', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight,
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: 'charts/payments-api/values.yaml',
            content: 'service:\n  port: 8080\n',
            truncated: false
          }
        }
      ],
      appliedWrites: [
        {
          path: 'charts/payments-api/values.yaml',
          content: 'service:\n  port: 8080\n',
          reason: 'test write'
        }
      ],
      validationResults: [
        {
          command: 'helm template charts/payments-api',
          exitCode: 1,
          stdout: '',
          stderr: 'template: charts/payments-api/templates/ingress.yaml: executing at <.Values.ingress.enabled>: nil pointer evaluating interface {}.enabled'
        }
      ],
      validationIssues: [
        {
          kind: 'helm-missing-ingress-values',
          repairable: true,
          sourceCommand: 'helm template charts/payments-api',
          message: 'Validation failed because a Helm template references .Values.ingress.enabled but the values file does not define ingress settings.'
        }
      ],
      approvalSignals: [],
      repairAttempts: 2,
      lastEditPlan: null
    }
  });

  assert.equal(decision.action.kind, 'stop');
  assert.equal(decision.action.payload?.stopReason, 'repair-budget-exhausted');
  assert.match(decision.action.summary, /repair budget/i);
});

test('rule-based agent emits ingress edit plan against fixture workspace copy', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-test-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add ingress to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    assert.match(result.modelName, /rule-based/);
    assert.equal(result.outcome, 'completed');
    assert.ok(result.runtime.appliedWrites.length > 0);
    assert.ok(result.turns.some(turn => turn.execution?.executedTools.some(tool => tool.toolName === 'diff_preview')));
    assert.ok(result.turns.some(turn => turn.execution?.executedTools.some(tool => tool.toolName === 'append_file')));
    const ingressTurn = result.turns.find(turn => turn.decision.action.payload?.editPlan?.kind === 'helm-ingress');
    assert.ok(ingressTurn?.decision.action.payload?.writes?.some(write => write.mode === 'append'));
    assert.ok(ingressTurn?.decision.action.payload?.writes?.some(write => write.mode === 'create'));
    assert.ok(
      result.turns.some(turn => turn.decision.action.payload?.editPlan?.kind === 'helm-ingress')
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based probes path uses replace mode for deployment template edits', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-probes-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add readiness and liveness probes to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    const probesTurn = result.turns.find(turn => turn.decision.action.payload?.editPlan?.kind === 'helm-probes');
    assert.ok(probesTurn?.decision.action.payload?.writes?.some(write => write.mode === 'replace'));
    assert.ok(result.turns.some(turn => turn.execution?.executedTools.some(tool => tool.toolName === 'replace_file')));
    assert.equal(result.outcome, 'completed');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('inspectWorkspace detects Terraform roots and tfvars files', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');

  assert.equal(inspection.profile.id, 'generic');
  assert.equal(inspection.terraformRoots.length, 1);
  assert.equal(inspection.fileCounts.terraformRootFiles, 1);
  assert.equal(inspection.fileCounts.terraformVariableFiles, 1);
  assert.equal(inspection.terraformRoots[0]?.rootPath, 'terraform/payments-api');
  assert.ok(inspection.terraformRoots[0]?.environmentHints.includes('dev'));
});

test('targeting prefers Terraform roots for Terraform-oriented tasks', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const targeting = buildTargetCandidates('update terraform payments-api dev image tag to 2.3.4', inspection);

  assert.equal(targeting.targetCandidates[0]?.kind, 'terraform-root');
  assert.equal(targeting.targetCandidates[0]?.path, 'terraform/payments-api');
  assert.ok(targeting.targetCandidates[0]?.matchedEnvironmentHints.includes('dev'));
});

test('targeting prefers requested Helm domain over higher-scoring non-Helm candidates in mixed workspaces', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const targeting = buildTargetCandidates('add ingress to payments-api dev chart', inspection);

  assert.equal(targeting.targetCandidates[0]?.kind, 'helm-chart');
  assert.equal(targeting.targetCandidates[0]?.path, 'charts/payments-api');
  assert.equal(targeting.targetCandidates[1]?.kind, 'pulumi-project');
});

test('targeting uses Terraform module hints to disambiguate multi-root workspaces', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-multi-root-workspace');
  const targeting = buildTargetCandidates('update terraform alb dev image tag to 2.3.4', inspection);

  assert.equal(inspection.terraformRoots.length, 2);
  assert.equal(targeting.targetCandidates[0]?.kind, 'terraform-root');
  assert.equal(targeting.targetCandidates[0]?.path, 'terraform/network-stack');
  assert.ok(targeting.targetCandidates[0]?.reasons.some(reason => /repository hints matched service token/i.test(reason)));
});

test('detectRequestedService ignores generic Terraform config nouns like image and tag', () => {
  assert.equal(detectRequestedService('update terraform dev image tag to 2.3.4'), null);
});

test('Terraform target candidates expose tfvars and module hint details for non-infra users', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-multi-root-workspace');
  const targeting = buildTargetCandidates('update terraform alb dev image tag to 2.3.4', inspection);

  assert.ok(targeting.targetCandidates[0]?.details?.some(detail => /tfvars:/i.test(detail)));
  assert.ok(targeting.targetCandidates[0]?.details?.some(detail => /module hints:/i.test(detail)));
});

test('buildRunPreflight warns when multiple Terraform roots match with similar confidence', async () => {
  const preflight = await buildRunPreflight('update terraform image tag to 2.3.4', 'fixtures/terraform-multi-root-workspace');

  assert.ok(preflight.assumptions.some(assumption => /Target service or chart was not explicitly detected/i.test(assumption)));
  assert.ok(preflight.assumptions.some(assumption => /Multiple Terraform roots matched with similar confidence/i.test(assumption)));
  assert.ok(preflight.assumptions.some(assumption => /Terraform environment was not explicit; top candidate offers/i.test(assumption)));
});

test('validation preflight adds Terraform commands for detected Terraform roots', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const validation = buildValidationPreflight(inspection);
  const terraformEntry = validation.plan.find(entry => entry.kind === 'terraform');

  assert.ok(terraformEntry);
  assert.equal(terraformEntry?.target, 'terraform/payments-api');
  assert.deepEqual(terraformEntry?.commands, [
    'terraform -chdir=terraform/payments-api fmt -check -recursive',
    'terraform -chdir=terraform/payments-api validate'
  ]);
});

test('buildEditPlan creates a bounded Terraform tfvars config plan', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const tfvarsPath = resolve('fixtures/terraform-workspace/terraform/payments-api/dev.auto.tfvars');
  const mainTfPath = resolve('fixtures/terraform-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: tfvarsPath,
          content: await readFile(tfvarsPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(editPlan);
  assert.equal(editPlan?.kind, 'terraform-tfvars-config');
  assert.equal(editPlan?.writes[0]?.path, 'terraform/payments-api/dev.auto.tfvars');
  assert.match(editPlan?.rationale ?? '', /Terraform validation allows environment values: dev, stage, prod/);
  assert.match(editPlan?.writes[0]?.content ?? '', /image_tag = "2.3.4"/);
  assert.match(editPlan?.writes[0]?.content ?? '', /environment = "dev"/);
});

test('buildEditPlan respects Terraform string type when formatting numeric-looking tfvars values', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 123', 'fixtures/terraform-workspace');
  const tfvarsPath = resolve('fixtures/terraform-workspace/terraform/payments-api/dev.auto.tfvars');
  const mainTfPath = resolve('fixtures/terraform-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: tfvarsPath,
          content: await readFile(tfvarsPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(editPlan);
  assert.match(editPlan?.rationale ?? '', /Terraform declares image_tag as string/);
  assert.match(editPlan?.writes[0]?.content ?? '', /image_tag = "123"/);
  assert.doesNotMatch(editPlan?.writes[0]?.content ?? '', /image_tag = 123/);
});

test('buildEditPlan blocks Terraform tfvars writes that violate enum semantics', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api qa image tag to 2.3.4', 'fixtures/terraform-workspace');
  const tfvarsPath = resolve('fixtures/terraform-workspace/terraform/payments-api/dev.auto.tfvars');
  const mainTfPath = resolve('fixtures/terraform-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: tfvarsPath,
          content: await readFile(tfvarsPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan, null);
});

test('buildEditPlan does not auto-create tfvars in generic terraform-only workspaces without an existing tfvars file', async () => {
  const preflight = await buildRunPreflight(
    'update terraform payments-api dev image tag to 2.3.4',
    'fixtures/terraform-no-tfvars-workspace'
  );
  const mainTfPath = resolve('fixtures/terraform-no-tfvars-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan, null);
});

test('buildEditPlan does not implicitly select one tfvars file when multiple Terraform tfvars options exist without an explicit environment', async () => {
  const preflight = await buildRunPreflight(
    'update terraform payments-api image tag to 2.3.4',
    'fixtures/terraform-multi-tfvars-workspace'
  );
  const mainTfPath = resolve('fixtures/terraform-multi-tfvars-workspace/terraform/payments-api/main.tf');
  const devTfvarsPath = resolve('fixtures/terraform-multi-tfvars-workspace/terraform/payments-api/dev.auto.tfvars');
  const prodTfvarsPath = resolve('fixtures/terraform-multi-tfvars-workspace/terraform/payments-api/prod.auto.tfvars');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: devTfvarsPath,
          content: await readFile(devTfvarsPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: prodTfvarsPath,
          content: await readFile(prodTfvarsPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan, null);
});

test('buildEditPlan selects the matching tfvars file when Terraform environment is explicit', async () => {
  const preflight = await buildRunPreflight(
    'update terraform payments-api prod image tag to 2.3.4',
    'fixtures/terraform-multi-tfvars-workspace'
  );
  const mainTfPath = resolve('fixtures/terraform-multi-tfvars-workspace/terraform/payments-api/main.tf');
  const devTfvarsPath = resolve('fixtures/terraform-multi-tfvars-workspace/terraform/payments-api/dev.auto.tfvars');
  const prodTfvarsPath = resolve('fixtures/terraform-multi-tfvars-workspace/terraform/payments-api/prod.auto.tfvars');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: devTfvarsPath,
          content: await readFile(devTfvarsPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: prodTfvarsPath,
          content: await readFile(prodTfvarsPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan?.kind, 'terraform-tfvars-config');
  assert.equal(editPlan?.writes[0]?.path, 'terraform/payments-api/prod.auto.tfvars');
  assert.match(editPlan?.writes[0]?.content ?? '', /image_tag = "2.3.4"/);
  assert.match(editPlan?.writes[0]?.content ?? '', /environment = "prod"/);
});

test('buildEditPlan reuses existing Terraform variable key names from tfvars and variable declarations', async () => {
  const preflight = await buildRunPreflight(
    'update terraform payments-api dev image tag to 4.5.6',
    'fixtures/terraform-alt-keys-workspace'
  );
  const tfvarsPath = resolve('fixtures/terraform-alt-keys-workspace/terraform/payments-api/terraform.auto.tfvars');
  const mainTfPath = resolve('fixtures/terraform-alt-keys-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: tfvarsPath,
          content: await readFile(tfvarsPath, 'utf8'),
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.ok(editPlan);
  assert.equal(editPlan?.kind, 'terraform-tfvars-config');
  assert.match(editPlan?.rationale ?? '', /app_image_tag/);
  assert.match(editPlan?.rationale ?? '', /deploy_env/);
  assert.match(editPlan?.writes[0]?.content ?? '', /app_image_tag = "4.5.6"/);
  assert.match(editPlan?.writes[0]?.content ?? '', /deploy_env = "dev"/);
  assert.doesNotMatch(editPlan?.writes[0]?.content ?? '', /^image_tag =/m);
  assert.doesNotMatch(editPlan?.writes[0]?.content ?? '', /^environment =/m);
});

test('buildEditPlan creates a bounded Pulumi missing-config repair plan', async () => {
  const preflight = await buildRunPreflight(
    'update pulumi dev stack for payments-api image tag to 1.2.3',
    'fixtures/sample-workspace'
  );

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: 'fixtures/sample-workspace/infra/payments-api/Pulumi.dev.yaml',
          content: 'config:\n  payments-api:environment: dev\n',
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [
      {
        command: 'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
        exitCode: 1,
        stdout: '',
        stderr: 'error: missing required configuration variable "payments-api:imageTag"; run `pulumi config set payments-api:imageTag <value>`'
      }
    ],
    validationIssues: [
      {
        kind: 'pulumi-missing-config',
        repairable: true,
        sourceCommand: 'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
        message: 'error: missing required configuration variable "payments-api:imageTag"; run `pulumi config set payments-api:imageTag <value>`',
        metadata: {
          missingConfigKey: 'payments-api:imageTag'
        }
      }
    ],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan?.kind, 'pulumi-missing-config-repair');
  assert.equal(editPlan?.pulumiConfigOperations?.[0]?.key, 'payments-api:imageTag');
  assert.equal(editPlan?.pulumiConfigOperations?.[0]?.value, '1.2.3');
  assert.match(editPlan?.writes[0]?.content ?? '', /payments-api:imageTag: 1\.2\.3/);
});

test('buildEditPlan creates a bounded Terraform missing-required-argument repair plan', async () => {
  const preflight = await buildRunPreflight(
    'update terraform payments-api dev image tag to 2.3.4',
    'fixtures/terraform-workspace'
  );
  const tfvarsPath = resolve('fixtures/terraform-workspace/terraform/payments-api/dev.auto.tfvars');
  const mainTfPath = resolve('fixtures/terraform-workspace/terraform/payments-api/main.tf');

  const editPlan = buildEditPlan({
    task: preflight.task,
    preflight,
    observations: [
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: tfvarsPath,
          content: 'environment = "dev"\n',
          truncated: false
        }
      },
      {
        toolName: 'read_file',
        safety: 'read_only',
        output: {
          path: mainTfPath,
          content: await readFile(mainTfPath, 'utf8'),
          truncated: false
        }
      }
    ],
    appliedWrites: [],
    validationResults: [
      {
        command: 'terraform -chdir=terraform/payments-api validate',
        exitCode: 1,
        stdout: '',
        stderr: 'Error: Missing required argument\n\nThe argument "image_tag" is required, but no definition was found.'
      }
    ],
    validationIssues: [
      {
        kind: 'terraform-validate-failure',
        repairable: true,
        sourceCommand: 'terraform -chdir=terraform/payments-api validate',
        message: 'Error: Missing required argument',
        metadata: {
          missingVariableName: 'image_tag'
        }
      }
    ],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  });

  assert.equal(editPlan?.kind, 'terraform-missing-required-argument-repair');
  assert.match(editPlan?.writes[0]?.content ?? '', /image_tag = "2\.3\.4"/);
  assert.match(editPlan?.writes[0]?.content ?? '', /environment = "dev"/);
});

test('inspect-target-files reads Terraform root files into runtime observations', async () => {
  const execution = await executeDecision(
    {
      confidence: 'high',
      action: {
        kind: 'inspect-target-files',
        summary: 'Inspect Terraform files.',
        rationale: 'Test Terraform inspection path.',
        payload: {
          targetPaths: ['terraform/payments-api'],
          requestedDomains: ['terraform']
        }
      }
    },
    resolve('fixtures/terraform-workspace'),
    null
  );

  assert.ok(execution);
  const readPaths = execution?.executedTools
    .filter(result => result.toolName === 'read_file')
    .map(result => result.output.path);

  assert.ok(readPaths?.some(path => path.endsWith('terraform/payments-api/main.tf')));
  assert.ok(readPaths?.some(path => path.endsWith('terraform/payments-api/dev.auto.tfvars')));
  assert.ok(readPaths?.every(path => !path.endsWith('Chart.yaml')));
});

test('inspect-target-files uses helm_show_values for Helm chart inspection', async () => {
  const execution = await executeDecision(
    {
      confidence: 'high',
      action: {
        kind: 'inspect-target-files',
        summary: 'Inspect Helm files.',
        rationale: 'Test Helm inspection path.',
        payload: {
          targetPaths: ['charts/payments-api'],
          requestedDomains: ['helm']
        }
      }
    },
    resolve('fixtures/sample-workspace'),
    null
  );

  assert.ok(execution);
  const helmShowValues = execution?.executedTools.find(result => result.toolName === 'helm_show_values');

  assert.ok(helmShowValues);
  assert.match(helmShowValues?.output.command ?? '', /helm show values charts\/payments-api/i);
  assert.match(helmShowValues?.output.content ?? '', /service:\s*\n\s*port:\s*8080/i);
});

test('inspect-target-files uses helm_show_chart for Helm chart metadata inspection', async () => {
  const execution = await executeDecision(
    {
      confidence: 'high',
      action: {
        kind: 'inspect-target-files',
        summary: 'Inspect Helm files.',
        rationale: 'Test Helm chart metadata path.',
        payload: {
          targetPaths: ['charts/payments-api'],
          requestedDomains: ['helm']
        }
      }
    },
    resolve('fixtures/sample-workspace'),
    null
  );

  assert.ok(execution);
  const helmShowChart = execution?.executedTools.find(result => result.toolName === 'helm_show_chart');

  assert.ok(helmShowChart);
  assert.match(helmShowChart?.output.command ?? '', /helm show chart charts\/payments-api/i);
  assert.match(helmShowChart?.output.content ?? '', /name:\s*payments-api/i);
  assert.match(helmShowChart?.output.content ?? '', /version:\s*0.1.0/i);
});

test('classifyValidationIssues marks terraform fmt failures as terraform-formatting-required', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/payments-api fmt -check -recursive',
      exitCode: 3,
      stdout: 'main.tf',
      stderr: ''
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-formatting-required');
  assert.equal(issues[0]?.repairable, true);
});

test('classifyValidationIssues marks terraform validate failures as terraform-validate-failure', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/payments-api validate',
      exitCode: 1,
      stdout: '',
      stderr: 'Error: Reference to undeclared input variable'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-validate-failure');
  assert.equal(issues[0]?.repairable, false);
  assert.match(issues[0]?.message ?? '', /undeclared input variable/i);
  assert.match(issues[0]?.guidance ?? '', /variable name exists in variable declarations and tfvars/i);
});

test('classifyValidationIssues provides actionable guidance for missing required Terraform arguments', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/payments-api validate',
      exitCode: 1,
      stdout: '',
      stderr: 'Error: Missing required argument\n\nThe argument "image_tag" is required, but no definition was found.'
    }
  ]);

  assert.equal(issues[0]?.kind, 'terraform-validate-failure');
  assert.equal(issues[0]?.repairable, true);
  assert.equal(issues[0]?.metadata?.missingVariableName, 'image_tag');
  assert.match(issues[0]?.guidance ?? '', /add the missing required argument through an existing tfvars file or declared variable path/i);
});

test('classifyValidationIssues marks Terraform AWS route identity conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/network apply -auto-approve',
      exitCode: 1,
      stdout: '',
      stderr: [
        'Error: creating Route in Route Table (rtb-0102177ec9e1ab465): operation error EC2: CreateRoute, https response error StatusCode: 400, api error RouteAlreadyExists: Route in Route Table (rtb-0102177ec9e1ab465) with destination (10.0.0.0/16) already exists',
        '',
        '  with module.network.aws_route.private[0],',
        '  on routes.tf line 12, in resource "aws_route" "private":'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-create-before-delete-conflict');
  assert.equal(issues[0]?.repairable, false);
  assert.equal(issues[0]?.metadata?.conflictCode, 'RouteAlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-route');
  assert.equal(issues[0]?.metadata?.resourceType, 'aws_route');
  assert.equal(issues[0]?.metadata?.resourceAddress, 'module.network.aws_route.private[0]');
  assert.equal(issues[0]?.metadata?.routeTableIds, 'rtb-0102177ec9e1ab465');
  assert.equal(issues[0]?.metadata?.routeDestinations, '10.0.0.0/16');
  assert.match(issues[0]?.guidance ?? '', /Terraform attempted to create/i);
  assert.match(issues[0]?.guidance ?? '', /moved blocks/i);
  assert.match(issues[0]?.guidance ?? '', /create_before_destroy/i);
});

test('classifyValidationIssues marks Terraform listener rule priority conflicts', () => {
  const listenerArn = 'arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/api/50dc6c495c0c9188/f2f7dc8efc522ab2';
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/edge plan',
      exitCode: 1,
      stdout: '',
      stderr: [
        'Error: creating ELBv2 Listener Rule: operation error Elastic Load Balancing v2: CreateRule, https response error StatusCode: 400, api error PriorityInUse: Priority \'100\' is currently in use on listener ' + listenerArn,
        '',
        '  with aws_lb_listener_rule.api,',
        '  on listeners.tf line 31, in resource "aws_lb_listener_rule" "api":'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'PriorityInUse');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-lb-listener-rule');
  assert.equal(issues[0]?.metadata?.resourceType, 'aws_lb_listener_rule');
  assert.equal(issues[0]?.metadata?.listenerArns, listenerArn);
  assert.equal(issues[0]?.metadata?.listenerRulePriorities, '100');
  assert.match(issues[0]?.guidance ?? '', /listenerArn and priority/);
  assert.match(issues[0]?.guidance ?? '', /choose a free priority/);
});

test('classifyValidationIssues uses shared specs for Terraform bucket identity conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/storage apply -auto-approve',
      exitCode: 1,
      stdout: '',
      stderr: [
        'Error: creating S3 Bucket (prod-artifacts): operation error S3: CreateBucket, https response error StatusCode: 409, api error BucketAlreadyOwnedByYou: Your previous request to create the named bucket succeeded and you already own it.',
        '',
        '  with aws_s3_bucket.artifacts,',
        '  on buckets.tf line 3, in resource "aws_s3_bucket" "artifacts":'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'BucketAlreadyOwnedByYou');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-s3-bucket');
  assert.equal(issues[0]?.metadata?.conflictLabel, 'AWS S3 Bucket');
  assert.equal(issues[0]?.metadata?.resourceType, 'aws_s3_bucket');
  assert.match(issues[0]?.metadata?.conflictSuggestedAction ?? '', /physical bucket/i);
  assert.match(issues[0]?.guidance ?? '', /AWS S3 Bucket/);
  assert.match(issues[0]?.guidance ?? '', /Provider rule:/);
  assert.match(issues[0]?.guidance ?? '', /moved blocks/);
});

test('classifyValidationIssues extracts Terraform AWS named resource identities', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/services apply -auto-approve',
      exitCode: 1,
      stdout: '',
      stderr: [
        'Error: creating ECR Repository (payments-api): operation error ECR: CreateRepository, https response error StatusCode: 400, api error RepositoryAlreadyExistsException: The repository with name \'payments-api\' already exists in the registry with id \'123456789012\'',
        '',
        '  with aws_ecr_repository.api,',
        '  on ecr.tf line 2, in resource "aws_ecr_repository" "api":'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'RepositoryAlreadyExistsException');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-named-resource');
  assert.equal(issues[0]?.metadata?.conflictLabel, 'AWS named resource');
  assert.equal(issues[0]?.metadata?.resourceType, 'aws_ecr_repository');
  assert.equal(issues[0]?.metadata?.resourceAddress, 'aws_ecr_repository.api');
  assert.equal(issues[0]?.metadata?.duplicateIdentity, 'payments-api');
  assert.match(issues[0]?.guidance ?? '', /AWS named resource/);
  assert.match(issues[0]?.guidance ?? '', /Provider rule:/);
});

test('classifyValidationIssues extracts Terraform Kubernetes object identity conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/apps apply -auto-approve',
      exitCode: 1,
      stdout: '',
      stderr: [
        'Error: services "payments-api" already exists',
        '',
        '  with kubernetes_service.api,',
        '  on service.tf line 4, in resource "kubernetes_service" "api":'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'AlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'kubernetes-namespaced-object');
  assert.equal(issues[0]?.metadata?.conflictLabel, 'Kubernetes namespaced object');
  assert.equal(issues[0]?.metadata?.resourceType, 'kubernetes_service');
  assert.equal(issues[0]?.metadata?.kubernetesNames, 'payments-api');
  assert.match(issues[0]?.guidance ?? '', /metadata\.name, and metadata\.namespace/);
  assert.match(issues[0]?.guidance ?? '', /Kubernetes object named payments-api/);
});

test('classifyValidationIssues marks missing Pulumi config as pulumi-missing-config', () => {
  const issues = classifyValidationIssues([
    {
      command: 'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
      exitCode: 1,
      stdout: '',
      stderr: 'error: missing required configuration variable "payments-api:imageTag"; run `pulumi config set payments-api:imageTag <value>`'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-missing-config');
  assert.equal(issues[0]?.repairable, true);
  assert.equal(issues[0]?.metadata?.missingConfigKey, 'payments-api:imageTag');
  assert.match(issues[0]?.guidance ?? '', /set payments-api:imageTag/i);
});

test('classifyValidationIssues marks Pulumi AWS route create-before-delete conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/networking --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:ec2:Route (scrawlr-prod-subnet-0cce76f6ee720890b-pcx-0881f5cc374f72a09):',
        'error: api error RouteAlreadyExists: Route in Route Table (rtb-0102177ec9e1ab465) with destination (10.0.0.0/16) already exists: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.repairable, false);
  assert.equal(issues[0]?.metadata?.routeTableIds, 'rtb-0102177ec9e1ab465');
  assert.equal(issues[0]?.metadata?.routeDestinations, '10.0.0.0/16');
  assert.equal(issues[0]?.metadata?.providerName, 'aws@7.23.0');
  assert.equal(issues[0]?.metadata?.conflictCode, 'RouteAlreadyExists');
  assert.match(issues[0]?.guidance ?? '', /deleteBeforeReplace/i);
  assert.match(issues[0]?.guidance ?? '', /aliases/i);
});

test('classifyValidationIssues marks generic Pulumi already-exists conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/storage --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:s3:Bucket (prod-artifacts):',
        'error: api error BucketAlreadyExists: The requested bucket name is not available: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.repairable, false);
  assert.equal(issues[0]?.metadata?.conflictCode, 'BucketAlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-s3-bucket');
  assert.equal(issues[0]?.metadata?.conflictLabel, 'AWS S3 Bucket');
  assert.equal(issues[0]?.metadata?.resourceType, 'aws:s3:Bucket');
  assert.match(issues[0]?.guidance ?? '', /same provider identity/i);
  assert.match(issues[0]?.guidance ?? '', /Provider rule:/);
  assert.match(issues[0]?.guidance ?? '', /deleteBeforeReplace/i);
});

test('classifyValidationIssues extracts Pulumi Kubernetes object identity conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/apps --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'kubernetes:core/v1:Service (payments-api):',
        'error: resource default/payments-api was not successfully created by the Kubernetes API server : services "payments-api" already exists'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'AlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'kubernetes-namespaced-object');
  assert.equal(issues[0]?.metadata?.conflictLabel, 'Kubernetes namespaced object');
  assert.equal(issues[0]?.metadata?.resourceType, 'kubernetes:core/v1:Service');
  assert.equal(issues[0]?.metadata?.kubernetesNames, 'payments-api');
  assert.equal(issues[0]?.metadata?.kubernetesNamespaces, 'default');
  assert.match(issues[0]?.guidance ?? '', /namespace\(s\) default/);
  assert.match(issues[0]?.guidance ?? '', /aliases\/import\/state repair/);
});

test('classifyValidationIssues extracts Pulumi AWS named resource identities', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/identity --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:iam/role:Role (api-role):',
        'error: api error EntityAlreadyExists: Role with name prod-api already exists: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'EntityAlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-named-resource');
  assert.equal(issues[0]?.metadata?.conflictLabel, 'AWS named resource');
  assert.equal(issues[0]?.metadata?.resourceType, 'aws:iam/role:Role');
  assert.equal(issues[0]?.metadata?.resourceName, 'api-role');
  assert.equal(issues[0]?.metadata?.duplicateIdentity, 'prod-api');
  assert.match(issues[0]?.guidance ?? '', /identity prod-api/);
  assert.match(issues[0]?.guidance ?? '', /deleteBeforeReplace/);
});

test('classifyValidationIssues marks Pulumi CloudFront alias conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/edge --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:cloudfront/distribution:Distribution (edge):',
        'error: api error CNAMEAlreadyExists: The CNAME alias "api.example.com" is already associated with another CloudFront distribution: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'CNAMEAlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-cloudfront-alias');
  assert.equal(issues[0]?.metadata?.dnsNames, 'api.example.com');
  assert.match(issues[0]?.guidance ?? '', /CloudFront distribution alias\/CNAME/);
  assert.match(issues[0]?.guidance ?? '', /state moves/);
});

test('classifyValidationIssues marks Pulumi API Gateway custom domain conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/api --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:apigateway/domainName:DomainName (api-domain):',
        'error: api error ConflictException: The domain name api.example.com already exists: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'ConflictException');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-api-gateway-domain-name');
  assert.equal(issues[0]?.metadata?.dnsNames, 'api.example.com');
  assert.match(issues[0]?.guidance ?? '', /API Gateway custom domain/);
  assert.match(issues[0]?.guidance ?? '', /deleteBeforeReplace/);
});

test('classifyValidationIssues marks Pulumi Route53 InvalidChangeBatch conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/dns --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:route53/record:Record (api-validation):',
        'error: 1 error occurred:',
        '  * api error InvalidChangeBatch: [Tried to create resource record set [name="_abc.api.example.com.", type="CNAME"] but it already exists]: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'InvalidChangeBatch');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-route53-record');
  assert.equal(issues[0]?.metadata?.dnsNames, '_abc.api.example.com.');
  assert.equal(issues[0]?.metadata?.recordTypes, 'CNAME');
  assert.match(issues[0]?.guidance ?? '', /ACM validation CNAMEs/);
  assert.match(issues[0]?.guidance ?? '', /allowOverwrite/);
});

test('classifyValidationIssues marks Pulumi security group duplicate permission conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/network --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:vpc/securityGroupIngressRule:SecurityGroupIngressRule (api-https):',
        'error: api error InvalidPermission.Duplicate: the specified rule "peer: 10.0.0.0/16, TCP, from port: 443, to port: 443, ALLOW" already exists: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'InvalidPermission.Duplicate');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-vpc-security-group-rule');
  assert.equal(issues[0]?.metadata?.securityGroupRulePeers, '10.0.0.0/16');
  assert.match(issues[0]?.guidance ?? '', /security group rule/);
  assert.match(issues[0]?.guidance ?? '', /direction, protocol, port range, security group, and peer/);
  assert.match(issues[0]?.guidance ?? '', /inline, legacy, and VPC-style rule managers/);
});

test('classifyValidationIssues marks Pulumi listener rule priority conflicts', () => {
  const listenerArn = 'arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/api/50dc6c495c0c9188/f2f7dc8efc522ab2';
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/edge --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:lb/listenerRule:ListenerRule (api-https):',
        `error: api error PriorityInUse: Priority '100' is currently in use on listener ${listenerArn}: provider=aws@7.23.0`
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'PriorityInUse');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-lb-listener-rule');
  assert.equal(issues[0]?.metadata?.listenerArns, listenerArn);
  assert.equal(issues[0]?.metadata?.listenerRulePriorities, '100');
  assert.match(issues[0]?.guidance ?? '', /load balancer listener rule/);
  assert.match(issues[0]?.guidance ?? '', /listenerArn and priority/);
  assert.match(issues[0]?.guidance ?? '', /choose a free priority/);
});

test('classifyValidationIssues marks Pulumi IAM OIDC provider duplicate conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/identity --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:iam/openIdConnectProvider:OpenIdConnectProvider (github):',
        'error: api error EntityAlreadyExists: Provider with url https://token.actions.githubusercontent.com already exists: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'EntityAlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-iam-oidc-provider');
  assert.equal(issues[0]?.metadata?.oidcProviderUrls, 'https://token.actions.githubusercontent.com');
  assert.match(issues[0]?.guidance ?? '', /IAM OIDC provider/);
  assert.match(issues[0]?.guidance ?? '', /role trust policies/);
  assert.match(issues[0]?.guidance ?? '', /import\/state repair or aliases/);
});

test('classifyValidationIssues marks general Pulumi preview failures as pulumi-preview-failure', () => {
  const issues = classifyValidationIssues([
    {
      command: 'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
      exitCode: 1,
      stdout: '',
      stderr: 'error: preview failed because the stack configuration is invalid'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-preview-failure');
  assert.equal(issues[0]?.repairable, false);
  assert.match(issues[0]?.guidance ?? '', /failing Pulumi project and stack file/i);
});

test('executeDecision runs terraform formatting repair inside the selected Terraform root', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-fmt-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/terraform-format-repair-workspace'), workspaceRoot, { recursive: true });
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'repair-terraform-formatting',
          summary: 'Repair Terraform formatting.',
          rationale: 'terraform fmt -check failed.',
          payload: {
            rootPath: 'terraform/payments-api'
          }
        }
      },
      workspaceRoot,
      null
    );

    assert.ok(execution);
    assert.equal(execution?.executedTools[0]?.toolName, 'search_workspace');
    assert.equal(execution?.executedTools[1]?.toolName, 'terraform_fmt');
    const repairedMainTf = await readFile(join(workspaceRoot, 'terraform/payments-api/main.tf'), 'utf8');
    assert.match(repairedMainTf, /  type = string/);
    assert.match(repairedMainTf, /  image_tag   = var\.image_tag/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based agent repairs Terraform formatting failures and revalidates', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-repair-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/terraform-format-repair-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'update terraform payments-api dev image tag to 2.3.4',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    assert.ok(result.turns.some(turn => turn.decision.action.kind === 'repair-terraform-formatting'));
    assert.ok(result.turns.some(turn => turn.execution?.executedTools.some(tool => tool.toolName === 'terraform_fmt')));
    assert.ok(result.runtime.repairAttempts >= 1);
    assert.ok(result.runtime.validationResults.every(entry => entry.exitCode === 0));
    assert.equal(result.runtime.validationIssues.length, 0);
    assert.equal(result.outcome, 'completed');

    const repairedMainTf = await readFile(join(workspaceRoot, 'terraform/payments-api/main.tf'), 'utf8');
    const updatedTfvars = await readFile(join(workspaceRoot, 'terraform/payments-api/dev.auto.tfvars'), 'utf8');
    assert.match(repairedMainTf, /  image_tag   = var\.image_tag/);
    assert.match(updatedTfvars, /image_tag\s*=\s*"2.3.4"/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
