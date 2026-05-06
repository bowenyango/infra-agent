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

test('rule-based planner proceeds with apply-edit-plan after explicit approval covers a high-risk rewrite', async () => {
  const preflight = await buildRunPreflight('update payments-api chart deeply', 'fixtures/sample-workspace', {
    approvedWriteRisks: ['high'],
    approvedWritePaths: ['charts/payments-api']
  });
  const planner = new RuleBasedPlanningModel();
  const decision = await planner.decideNextAction({
    runtime: {
      task: preflight.task,
      preflight: {
        ...preflight,
        assumptions: [],
        targetCandidates: [
          {
            kind: 'helm-chart',
            name: 'payments-api',
            path: 'charts/payments-api',
            score: 10,
            reasons: ['synthetic approval continuation test'],
            matchedEnvironmentHints: ['dev']
          }
        ]
      },
      observations: [
        {
          toolName: 'read_file',
          safety: 'read_only',
          output: {
            path: resolve('fixtures/sample-workspace/charts/payments-api/values.yaml'),
            content: await readFile(resolve('fixtures/sample-workspace/charts/payments-api/values.yaml'), 'utf8'),
            truncated: false
          }
        }
      ],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: {
        kind: 'helm-ingress',
        summary: 'Rewrite values file.',
        rationale: 'Synthetic rewrite continuation test.',
        writes: [
          {
            path: 'charts/payments-api/values.yaml',
            content: 'replicaCount: 99\n',
            reason: 'Rewrite test',
            mode: 'rewrite',
            risk: 'high'
          }
        ]
      }
    }
  });

  assert.equal(decision.action.kind, 'apply-edit-plan');
});

test('rule-based agent repairs missing service.port after validation failure', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-repair-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/repair-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add ingress to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    assert.ok(result.turns.some(turn => turn.decision.action.payload?.editPlan?.kind === 'helm-service-port-repair'));
    assert.ok(result.runtime.repairAttempts >= 1);
    assert.ok(result.runtime.validationResults.every(entry => entry.exitCode === 0));
    assert.equal(result.runtime.validationIssues.length, 0);
    assert.equal(result.outcome, 'completed');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('apply-edit-plan execution emits diff preview before write', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-diff-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: 'Apply bounded values update.',
          rationale: 'Test diff preview output.',
          payload: {
            writes: [
              {
                path: 'charts/payments-api/values.yaml',
                content: 'replicaCount: 2\n',
                reason: 'Test write'
              }
            ]
          }
        }
      },
      workspaceRoot,
      null
    );

    assert.ok(execution);
    assert.deepEqual(
      execution?.executedTools.map(tool => tool.toolName),
      ['diff_preview', 'validate_yaml_syntax', 'write_file', 'validate_yaml_syntax']
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('apply-edit-plan validates YAML syntax before writing YAML files', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-yaml-preflight-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const valuesPath = join(workspaceRoot, 'charts/payments-api/values.yaml');
    const existingValues = await readFile(valuesPath, 'utf8');
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: 'Apply invalid YAML.',
          rationale: 'Test YAML syntax gate.',
          payload: {
            writes: [
              {
                path: 'charts/payments-api/values.yaml',
                content: 'ingress:\n  hosts: [\n',
                reason: 'Invalid YAML test write'
              }
            ]
          }
        }
      },
      workspaceRoot,
      null
    );

    assert.ok(execution);
    assert.deepEqual(
      execution?.executedTools.map(tool => tool.toolName),
      ['diff_preview', 'validate_yaml_syntax']
    );
    assert.equal(execution?.executedTools[1]?.output.result.exitCode, 1);
    assert.equal(await readFile(valuesPath, 'utf8'), existingValues);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('runSingleStep preserves YAML syntax failures found during apply-edit-plan', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-yaml-runtime-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'write invalid YAML to payments-api values',
      workspaceRoot,
      {
        name: 'invalid-yaml-test-planner',
        async decideNextAction({ runtime }) {
          if (runtime.validationIssues.length > 0) {
            return {
              confidence: 'high',
              action: {
                kind: 'stop',
                summary: 'Stop after YAML validation failure.',
                rationale: 'The runtime preserved the YAML syntax blocker.',
                payload: {
                  stopReason: 'validation-blocked'
                }
              }
            };
          }

          return {
            confidence: 'high',
            action: {
              kind: 'apply-edit-plan',
              summary: 'Apply invalid YAML.',
              rationale: 'Synthetic planner output for YAML validation.',
              payload: {
                writes: [
                  {
                    path: 'charts/payments-api/values.yaml',
                    content: 'ingress:\n  hosts: [\n',
                    reason: 'Invalid YAML test write'
                  }
                ]
              }
            }
          };
        }
      },
      'rule-based'
    );

    assert.equal(result.outcome, 'validation-blocked');
    assert.equal(result.runtime.validationIssues[0]?.kind, 'yaml-syntax-failure');
    assert.ok(result.runtime.validationResults.some(entry => entry.command.includes('yaml-parse')));
    assert.equal(result.runtime.appliedWrites.length, 0);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('runSingleStep gates unapproved edit execution even when the model asks to apply', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-approval-gate-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const valuesPath = join(workspaceRoot, 'charts/payments-api/values.yaml');
    const existingValues = await readFile(valuesPath, 'utf8');
    const write = {
      path: 'charts/payments-api/values.yaml',
      content: 'replicaCount: 99\n',
      reason: 'Synthetic unapproved high-risk rewrite.',
      mode: 'rewrite',
      risk: 'high'
    };
    const bypassModel = {
      name: 'approval-bypass-test-model',
      async decideNextAction() {
        return {
          action: {
            kind: 'apply-edit-plan',
            summary: 'Attempt to bypass approval.',
            rationale: 'Synthetic approval gate test.',
            payload: {
              actionFamily: 'helm-bounded-edit',
              writes: [write],
              editPlan: {
                kind: 'helm-ingress',
                summary: 'Synthetic high-risk rewrite.',
                rationale: 'Exercise execution-time approval gate.',
                writes: [write]
              }
            }
          },
          confidence: 'high'
        };
      }
    };

    const result = await runSingleStep(
      'update payments-api chart deeply',
      workspaceRoot,
      bypassModel
    );
    const compact = buildCompactAgentRunResult(result);

    assert.equal(result.outcome, 'approval-required');
    assert.equal(result.turns.length, 1);
    assert.equal(result.turns[0]?.decision.action.kind, 'apply-edit-plan');
    assert.equal(result.turns[0]?.execution?.status, 'skipped');
    assert.match(result.turns[0]?.execution?.reason ?? '', /Approval is required before executing this workspace mutation/);
    assert.equal(result.turns[0]?.execution?.executedTools.length, 0);
    assert.equal(result.runtime.appliedWrites.length, 0);
    assert.equal(result.runtime.approvalSignals[0]?.kind, 'write-approval-required');
    assert.equal(result.runtime.approvalSignals[0]?.path, 'charts/payments-api/values.yaml');
    assert.equal(compact.harness.plannerHandoff.activeBlocker.kind, 'approval');
    assert.equal(compact.harness.plannerHandoff.nextControlAction, 'request-approval');
    assert.equal(await readFile(valuesPath, 'utf8'), existingValues);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('runSingleStep records deterministic tool execution summaries', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-tool-summary-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add ingress to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    assert.ok(result.runtime.toolSummaries.some(summary => summary.summary.includes('Loaded Helm values for charts/payments-api')));
    assert.ok(result.runtime.toolSummaries.some(summary => summary.summary.includes('Previewed diff for charts/payments-api/values.yaml')));
    assert.ok(result.runtime.toolSummaries.every(summary => typeof summary.turnIndex === 'number'));
    assert.ok(result.runtime.toolSummaries.some(summary =>
      summary.toolName === 'helm_show_values'
      && summary.permission.category === 'native-cli-read'
      && summary.permission.externalCommand
    ));
    assert.ok(result.runtime.toolSummaries.some(summary =>
      summary.toolName === 'append_file'
      && summary.permission.category === 'workspace-write'
      && summary.permission.mutatesWorkspace
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('resolveQueryLoopConfig keeps bounded defaults and normalizes overrides', () => {
  assert.equal(resolveQueryLoopConfig().maxTurns, 6);
  assert.equal(resolveQueryLoopConfig().maxRepairAttempts, 2);
  assert.equal(resolveQueryLoopConfig().retrievedContextBudget.maxPackets, 5);
  assert.equal(resolveQueryLoopConfig().retrievedContextBudget.maxTokens, 1000);
  assert.equal(resolveQueryLoopConfig().retrievedContextBudget.maxFacts, 12);
  assert.equal(resolveQueryLoopConfig({ maxTurns: 2.8 }).maxTurns, 2);
  assert.equal(resolveQueryLoopConfig({ maxTurns: 0 }).maxTurns, 1);
  assert.equal(resolveQueryLoopConfig({ maxRepairAttempts: 3.8 }).maxRepairAttempts, 3);
  assert.equal(resolveQueryLoopConfig({ maxRepairAttempts: -1 }).maxRepairAttempts, 0);
  assert.equal(resolveQueryLoopConfig({
    retrievedContextBudget: {
      maxPackets: 2.8,
      maxTokens: 0,
      maxExcerptChars: 240.8,
      maxFacts: 4.8
    }
  }).retrievedContextBudget.maxPackets, 2);
  assert.equal(resolveQueryLoopConfig({
    retrievedContextBudget: {
      maxPackets: 2.8,
      maxTokens: 0,
      maxExcerptChars: 240.8,
      maxFacts: 4.8
    }
  }).retrievedContextBudget.maxTokens, 1);
  assert.equal(resolveQueryLoopConfig({
    retrievedContextBudget: {
      maxPackets: 2.8,
      maxTokens: 0,
      maxExcerptChars: 240.8,
      maxFacts: 4.8
    }
  }).retrievedContextBudget.maxExcerptChars, 240);
  assert.equal(resolveQueryLoopConfig({
    retrievedContextBudget: {
      maxFacts: 4.8
    }
  }).retrievedContextBudget.maxFacts, 4);
});

test('runSingleStep respects configured zero repair attempts', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-repair-budget-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/repair-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add ingress to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based',
      undefined,
      {
        maxRepairAttempts: 0
      }
    );

    assert.equal(result.config.maxRepairAttempts, 0);
    assert.equal(result.runtime.maxRepairAttempts, 0);
    assert.equal(result.runtime.repairAttempts, 0);
    assert.equal(result.outcome, 'repair-budget-exhausted');
    const compact = buildCompactAgentRunResult(result);
    assert.equal(compact.harness.queryConfig.maxRepairAttempts, 0);
    assert.deepEqual(compact.harness.repairBudget, {
      attemptsUsed: 0,
      maxAttempts: 0,
      attemptsRemaining: 0,
      exhausted: true
    });
    assert.equal(compact.harness.loopBudget.exhausted, false);
    assert.ok(compact.harness.loopBudget.turnsRemaining > 0);
    assert.ok(compact.resultCard.some(line => /Repair activity: 0\/0 bounded repair attempt\(s\) used/i.test(line)));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('runSingleStep respects the configured maximum turn count', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-turn-budget-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/sample-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'add ingress to payments-api dev chart',
      workspaceRoot,
      undefined,
      'rule-based',
      undefined,
      {
        maxTurns: 1,
        retrievedContextBudget: {
          maxPackets: 2,
          maxTokens: 500,
          maxFacts: 3
        }
      }
    );

    assert.equal(result.turns.length, 1);
    assert.equal(result.outcome, 'no-safe-action');
    assert.equal(result.plannerConfig?.requestedMode, 'rule-based');
    assert.equal(result.plannerConfig?.effectiveMode, 'rule-based');
    assert.equal(result.plannerConfig?.clientName, 'rule-based-model-client');
    assert.equal(result.plannerConfig?.llm, null);
    assert.ok(result.runtime.toolSummaries.some(summary => summary.actionKind === 'inspect-target-files'));
    const compact = buildCompactAgentRunResult(result);
    assert.equal(compact.harness.maxTurns, 1);
    assert.deepEqual(compact.harness.plannerConfig, {
      requestedMode: 'rule-based',
      effectiveMode: 'rule-based',
      clientName: 'rule-based-model-client',
      fallbackReason: null,
      llm: null
    });
    assert.equal(compact.harness.queryConfig.maxTurns, 1);
    assert.equal(compact.harness.queryConfig.maxRepairAttempts, 2);
    assert.equal(compact.harness.queryConfig.retrievedContextBudget.maxPackets, 2);
    assert.equal(compact.harness.queryConfig.retrievedContextBudget.maxTokens, 500);
    assert.equal(compact.harness.queryConfig.retrievedContextBudget.maxFacts, 3);
    assert.equal(compact.knowledgeFacts.kind, 'infra-agent.knowledge-facts-summary');
    assert.equal(compact.knowledgeFacts.maxFacts, 3);
    assert.equal(compact.knowledgeFacts.mutationAllowed, false);
    assert.ok(compact.knowledgeFacts.totalFactCount > 0);
    assert.ok(compact.knowledgeFacts.includedFactCount <= 3);
    assert.equal(compact.harness.stateSummary.knowledgeFactCount, compact.knowledgeFacts.totalFactCount);
    assert.deepEqual(compact.handoffCheckpoint.budgets.knowledgeFacts, {
      includedCount: compact.knowledgeFacts.includedFactCount,
      omittedCount: compact.knowledgeFacts.omittedFactCount
    });
    assert.doesNotMatch(JSON.stringify(compact.knowledgeFacts), /"content"\s*:|contentHash|fetchedAt|"\$schema"/);
    assert.deepEqual(compact.harness.loopBudget, {
      turnsUsed: 1,
      maxTurns: 1,
      turnsRemaining: 0,
      exhausted: true
    });
    assert.deepEqual(compact.harness.repairBudget, {
      attemptsUsed: 0,
      maxAttempts: 2,
      attemptsRemaining: 2,
      exhausted: false
    });
    assert.equal(compact.harness.plannerHandoff.activeBlocker.kind, 'turn-budget');
    assert.equal(compact.harness.plannerHandoff.nextControlAction, 'rerun-with-larger-turn-budget');
    assert.equal(compact.harness.plannerHandoff.lastAction.kind, 'inspect-target-files');
    assert.equal(compact.harness.plannerHandoff.lastAction.executionStatus, 'completed');
    assert.equal(compact.harness.lifecycleEvents.maxEntries, 12);
    assert.equal(compact.harness.lifecycleEvents.totalCount, compact.harness.lifecycleEvents.events.length);
    assert.equal(compact.harness.lifecycleEvents.includedCount, compact.harness.lifecycleEvents.events.length);
    assert.equal(compact.harness.lifecycleEvents.omittedCount, 0);
    assert.equal(compact.harness.lifecycleEvents.eventCounts['query-started'], 1);
    assert.equal(compact.harness.lifecycleEvents.eventCounts.decision, 1);
    assert.ok(compact.harness.lifecycleEvents.eventCounts['tool-execution'] >= 1);
    assert.equal(compact.harness.lifecycleEvents.eventCounts.terminal, 1);
    assert.equal(compact.harness.lifecycleEvents.events[0]?.event, 'query-started');
    assert.ok(compact.harness.lifecycleEvents.events.some(event =>
      event.event === 'decision'
      && event.actionKind === 'inspect-target-files'
    ));
    assert.ok(compact.harness.lifecycleEvents.events.some(event =>
      event.event === 'tool-execution'
      && event.toolCount > 0
    ));
    assert.equal(compact.harness.lifecycleEvents.events.at(-1)?.event, 'terminal');
    assert.equal(compact.harness.lifecycleEvents.events.at(-1)?.outcome, 'no-safe-action');
    assert.ok(compact.resultCard.some(line => /Turn budget: 1\/1 turn\(s\) used; exhausted/i.test(line)));
    assert.ok(compact.resultCard.some(line =>
      /Targeting: helm charts\/payments-api score=.*candidates .*; ambiguity none; next inspect-selected-target/i.test(line)
    ));
    assert.ok(compact.resultCard.some(line =>
      /Work plan: blocked; current handoff\/blocked; completed 3\/6; blocked 1; skipped 0; next rerun-with-larger-turn-budget/i.test(line)
    ));
    assert.equal(compact.harness.turnTraceLimit, 10);
    assert.equal(compact.harness.turnTraceOmittedCount, 0);
    assert.deepEqual(compact.harness.turnTraceBudget, {
      maxEntries: 10,
      totalCount: 1,
      includedCount: 1,
      omittedCount: 0,
      firstIncludedTurnIndex: 0,
      lastIncludedTurnIndex: 0,
      preservedWindow: 'head'
    });
    assert.equal(compact.knowledgeContext.maxPackets, 2);
    assert.equal(compact.knowledgeContext.maxTokens, 500);
    assert.equal(compact.harness.turnTrace.length, 1);
    assert.equal(compact.harness.turnTrace[0]?.actionKind, 'inspect-target-files');
    assert.equal(compact.harness.turnTrace[0]?.terminal, false);
    assert.equal(compact.harness.turnTrace[0]?.executionStatus, 'completed');
    assert.equal(compact.harness.turnTrace[0]?.executionReason, null);
    assert.ok((compact.harness.turnTrace[0]?.executedToolCount ?? 0) > 0);
    assert.equal(compact.harness.toolTrace.maxEntries, 8);
    assert.equal(compact.harness.toolTrace.totalCount, result.runtime.toolSummaries.length);
    assert.equal(compact.harness.toolTrace.entries.length, Math.min(result.runtime.toolSummaries.length, 8));
    assert.equal(compact.harness.toolTrace.includedCount, compact.harness.toolTrace.entries.length);
    assert.equal(compact.harness.toolTrace.omittedCount, Math.max(0, result.runtime.toolSummaries.length - 8));
    assert.equal(compact.harness.toolTrace.firstIncludedTurnIndex, compact.harness.toolTrace.entries[0]?.turnIndex ?? null);
    assert.equal(compact.harness.toolTrace.lastIncludedTurnIndex, compact.harness.toolTrace.entries.at(-1)?.turnIndex ?? null);
    assert.equal(compact.harness.toolTrace.preservedWindow, 'tail');
    assert.equal(compact.harness.toolTrace.latestTurnIndex, result.runtime.toolSummaries.at(-1)?.turnIndex ?? null);
    assert.ok(Object.values(compact.harness.toolTrace.permissionCategoryCounts).reduce((total, count) => total + count, 0) >= compact.harness.toolTrace.includedCount);
    assert.ok(compact.harness.toolTrace.entries.some(entry => entry.actionKind === 'inspect-target-files'));
    assert.ok(compact.harness.toolTrace.entries.every(entry => entry.toolName.length > 0));
    assert.equal(compact.harness.toolPermissionSummary.totalToolCount, result.runtime.toolSummaries.length);
    assert.ok(compact.harness.toolPermissionSummary.externalCommandToolCount > 0);
    assert.equal(compact.harness.stateSummary.observationCount, result.runtime.observations.length);
    assert.equal(compact.harness.stateSummary.toolSummaryCount, result.runtime.toolSummaries.length);
    assert.equal(compact.harness.stateSummary.appliedWriteCount, result.runtime.appliedWrites.length);
    assert.equal(compact.harness.stateSummary.validationResultCount, result.runtime.validationResults.length);
    assert.equal(compact.harness.stateSummary.validationIssueCount, result.runtime.validationIssues.length);
    assert.equal(compact.harness.stateSummary.approvalSignalCount, result.runtime.approvalSignals.length);
    assert.equal(compact.harness.stateSummary.retrievedContextCount, result.runtime.retrievedContext.length);
    assert.ok(compact.harness.stateSummary.semanticFactCount > 0);
    assert.equal(compact.harness.targeting.schemaVersion, 1);
    assert.equal(compact.harness.targeting.source, 'derived-run-preflight');
    assert.equal(compact.harness.targeting.compact, true);
    assert.equal(compact.harness.targeting.mutationAllowed, false);
    assert.equal(compact.harness.targeting.candidateCount, result.preflight.targetCandidates.length);
    assert.equal(compact.harness.targeting.includedCount, compact.harness.targeting.candidates.length);
    assert.equal(compact.harness.targeting.omittedCount, Math.max(0, result.preflight.targetCandidates.length - 5));
    assert.equal(compact.harness.targeting.selectedTarget?.path, 'charts/payments-api');
    assert.equal(compact.harness.targeting.selectedTarget?.domain, 'helm');
    assert.equal(compact.harness.targeting.candidates[0]?.rank, 1);
    assert.equal(compact.harness.targeting.candidates[0]?.selected, true);
    assert.equal(compact.harness.targeting.candidates[0]?.domain, 'helm');
    assert.ok((compact.harness.targeting.candidates[0]?.reasons.length ?? 0) <= 3);
    assert.ok((compact.harness.targeting.candidates[0]?.details.length ?? 0) <= 3);
    assert.equal(compact.harness.targeting.flags.missingEnvironment, false);
    assert.equal(compact.harness.targeting.flags.missingService, false);
    assert.equal(compact.harness.targeting.recommendedAction, 'inspect-selected-target');
    assert.ok(compact.validation.selectedPlan.length > 0);
    assert.ok(compact.validation.selectedPlan.every(entry => entry.kind === 'helm'));
    assert.ok(compact.validation.selectedPlan.every(entry => entry.target === 'charts/payments-api'));
    assert.ok(compact.validation.selectedPlan.every(entry => entry.commandCount === entry.commands.length));
    assert.ok(compact.validation.selectedPlan.every(entry => entry.executedCommandCount === 0));
    assert.ok(compact.validation.selectedPlan.every(entry => entry.failedCommandCount === 0));
    assert.ok(compact.validation.selectedPlan.every(entry => typeof entry.validatorAvailable === 'boolean'));
    assert.equal(compact.knowledgeContext.totalPacketCount, result.runtime.retrievedContext.length);
    assert.equal(
      compact.knowledgeContext.includedPacketCount,
      compact.knowledgeContext.packets.filter(packet => packet.included).length
    );
    assert.equal(compact.readiness.status, 'pass');
    assert.equal(compact.harness.workPlan.schemaVersion, 1);
    assert.equal(compact.harness.workPlan.source, 'derived-agent-run-state');
    assert.equal(compact.harness.workPlan.compact, true);
    assert.equal(compact.harness.workPlan.mutationAllowed, false);
    assert.equal(compact.harness.workPlan.status, 'blocked');
    assert.equal(compact.harness.workPlan.blockerKind, 'turn-budget');
    assert.equal(compact.harness.workPlan.nextControlAction, compact.harness.plannerHandoff.nextControlAction);
    assert.equal(compact.harness.workPlan.totalStepCount, 6);
    assert.equal(compact.harness.workPlan.includedCount, compact.harness.workPlan.steps.length);
    assert.equal(compact.harness.workPlan.omittedCount, 0);
    assert.equal(compact.harness.workPlan.currentStepIndex, 5);
    assert.equal(compact.harness.workPlan.skippedStepCount, 0);
    assert.deepEqual(
      compact.harness.workPlan.steps.map(step => step.kind),
      ['readiness', 'targeting', 'inspection', 'edit', 'validation', 'handoff']
    );
    assert.ok(compact.harness.workPlan.steps.some(step =>
      step.kind === 'inspection'
      && step.status === 'completed'
      && step.actionKind === 'inspect-target-files'
    ));
    assert.ok(compact.harness.workPlan.steps.some(step =>
      step.kind === 'handoff'
      && step.status === 'blocked'
    ));
    assert.deepEqual(compact.handoffCheckpoint, {
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
        outcome: 'no-safe-action',
        activeBlocker: 'turn-budget',
        nextControlAction: 'rerun-with-larger-turn-budget',
        readinessStatus: 'pass',
        validationStatus: 'not run yet',
        validationIssueCount: 0,
        identityConflictCount: 0,
        approvalContinuationRequired: false,
        changedFileCount: 0
      },
      budgets: {
        turnTrace: {
          includedCount: compact.harness.turnTraceBudget.includedCount,
          omittedCount: compact.harness.turnTraceBudget.omittedCount
        },
        lifecycleEvents: {
          includedCount: compact.harness.lifecycleEvents.includedCount,
          omittedCount: compact.harness.lifecycleEvents.omittedCount
        },
        toolTrace: {
          includedCount: compact.harness.toolTrace.includedCount,
          omittedCount: compact.harness.toolTrace.omittedCount
        },
        workPlan: {
          includedCount: compact.harness.workPlan.includedCount,
          omittedCount: compact.harness.workPlan.omittedCount
        },
        targeting: {
          includedCount: compact.harness.targeting.includedCount,
          omittedCount: compact.harness.targeting.omittedCount
        },
        validationCommands: {
          includedCount: compact.validation.commands.entries.length,
          omittedCount: compact.validation.commands.omittedCount
        },
        validationIssues: {
          includedCount: compact.validation.issues.length,
          omittedCount: compact.validation.issueDetails.omittedCount
        },
        validationIssueGroups: {
          includedCount: compact.validation.issueSummary.groups.length,
          omittedCount: compact.validation.issueSummary.omittedGroupCount
        },
        validationSafetyBlockers: {
          includedCount: compact.validation.safetyBlockers.entries.length,
          omittedCount: compact.validation.safetyBlockers.omittedCount
        },
        identityConflicts: {
          includedCount: compact.validation.identityConflictSummary.includedCount,
          omittedCount: compact.validation.identityConflictSummary.omittedCount
        },
        approvalSignals: {
          includedCount: compact.approval.signals.length,
          omittedCount: Math.max(0, compact.approval.resume.signalCount - compact.approval.signals.length)
        },
        knowledgePackets: {
          includedCount: compact.knowledgeContext.includedPacketCount,
          omittedCount: compact.knowledgeContext.omittedPacketCount,
          includedTokenEstimate: compact.knowledgeContext.includedTokenEstimate,
          omittedTokenEstimate: compact.knowledgeContext.omittedTokenEstimate
        },
        knowledgeFacts: {
          includedCount: compact.knowledgeFacts.includedFactCount,
          omittedCount: compact.knowledgeFacts.omittedFactCount
        }
      },
      continuation: {
        required: true,
        reason: 'turn-budget',
        nextControlAction: 'rerun-with-larger-turn-budget',
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
    });
    assert.ok(compact.resultCard.some(line => /Readiness: pass/i.test(line)));
    assert.match(compact.readiness.doctorCommand, / doctor /);
    assert.deepEqual(compact.readiness.plannerProviderCatalog, buildPlannerProviderCatalogDiscovery());
    assert.ok(compact.readiness.checks.some(check =>
      check.name === 'planner'
      && check.status === 'pass'
      && check.detail === 'rule-based-model-client'
    ));
    assert.ok(compact.readiness.checks.some(check =>
      check.name === 'validator:helm'
      && check.status === 'pass'
    ));
    assert.ok(!compact.readiness.checks.some(check => check.name === 'validator:pulumi'));
    assert.ok(!compact.readiness.checks.some(check => check.name === 'validator:terraform'));
    assert.equal(Object.hasOwn(compact, 'runtime'), false);
    assert.equal(Object.hasOwn(compact, 'preflight'), false);
    assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');

    const fallbackCompact = buildCompactAgentRunResult({
      ...result,
      modelName: 'rule-based-fallback'
    });
    assert.equal(fallbackCompact.readiness.status, 'warn');
    assert.ok(fallbackCompact.resultCard.some(line => /Readiness: warn.*planner/i.test(line)));
    assert.match(fallbackCompact.suggestedCommands[0] ?? '', / doctor .*--json/);
    assert.ok(fallbackCompact.readiness.checks.some(check =>
      check.name === 'planner'
      && check.status === 'warn'
      && /fallback/.test(check.message)
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('compact work plan maps terminal outcomes to active steps', async () => {
  const preflight = await buildRunPreflight('add readiness and liveness probes to payments-api dev chart', 'fixtures/sample-workspace');
  const readFileSummary = {
    turnIndex: 0,
    actionKind: 'inspect-target-files',
    toolName: 'read_file',
    safety: 'read_only',
    permission: {
      category: 'workspace-read',
      mutatesWorkspace: false,
      mutatesExternalState: false,
      externalCommand: false,
      approvalRequired: false
    },
    summary: 'Read chart values.'
  };
  const makeState = runtimeOverrides => ({
    modelName: 'test-model',
    outcome: runtimeOverrides.outcome,
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      retrievedContext: [],
      observations: [],
      toolSummaries: runtimeOverrides.toolSummaries ?? [],
      appliedWrites: runtimeOverrides.appliedWrites ?? [],
      validationResults: runtimeOverrides.validationResults ?? [],
      validationIssues: runtimeOverrides.validationIssues ?? [],
      approvalSignals: runtimeOverrides.approvalSignals ?? [],
      repairAttempts: runtimeOverrides.repairAttempts ?? 0,
      maxRepairAttempts: 2,
      lastEditPlan: null
    },
    turns: [],
    config: resolveQueryLoopConfig()
  });

  const approvalState = makeState({
    outcome: 'approval-required',
    toolSummaries: [readFileSummary],
    approvalSignals: [
      {
        kind: 'write-approval-required',
        path: 'charts/payments-api/values.yaml',
        risk: 'medium',
        message: 'Approval required before editing chart values.'
      }
    ]
  });
  const approvalCompact = buildCompactAgentRunResult(approvalState);
  const approvalStep = approvalCompact.harness.workPlan.steps.find(step => step.kind === 'edit');
  assert.equal(approvalCompact.harness.workPlan.status, 'blocked');
  assert.equal(approvalCompact.harness.workPlan.blockerKind, 'approval');
  assert.equal(approvalCompact.harness.workPlan.currentStepIndex, 3);
  assert.equal(approvalStep?.status, 'blocked');
  assert.equal(approvalStep?.approvalSignalKind, 'write-approval-required');
  assert.equal(parseCompactAgentRunResult(approvalCompact).kind, 'infra-agent.agent-result');

  const approvalWarnCompact = buildCompactAgentRunResult({
    ...approvalState,
    modelName: 'rule-based-fallback'
  });
  assert.match(approvalWarnCompact.suggestedCommands[0] ?? '', / doctor .*--json/);
  assert.ok(approvalWarnCompact.suggestedCommands.some(command => /--approve-write-risk medium/.test(command)));
  assert.doesNotMatch(approvalWarnCompact.approval.resume.command ?? '', /doctor/);

  const validationCompact = buildCompactAgentRunResult(makeState({
    outcome: 'validation-blocked',
    validationResults: [
      {
        command: 'helm lint charts/payments-api',
        exitCode: 1,
        stdout: '',
        stderr: 'service.port is required'
      }
    ],
    validationIssues: [
      {
        kind: 'helm-missing-service-port',
        repairable: true,
        sourceCommand: 'helm lint charts/payments-api',
        message: 'service.port is required'
      }
    ]
  }));
  const validationStep = validationCompact.harness.workPlan.steps.find(step => step.kind === 'validation');
  assert.equal(validationCompact.harness.workPlan.status, 'blocked');
  assert.equal(validationCompact.harness.workPlan.blockerKind, 'validation');
  assert.equal(validationCompact.harness.workPlan.currentStepIndex, 4);
  assert.equal(validationStep?.status, 'blocked');
  assert.equal(validationStep?.validationIssueKind, 'helm-missing-service-port');
  assert.equal(validationCompact.harness.plannerHandoff.activeBlocker.validationIssueKind, 'helm-missing-service-port');
  assert.equal(parseCompactAgentRunResult(validationCompact).kind, 'infra-agent.agent-result');

  const repairCompact = buildCompactAgentRunResult(makeState({
    outcome: 'repair-budget-exhausted',
    repairAttempts: 2,
    validationResults: [
      {
        command: 'helm lint charts/payments-api',
        exitCode: 1,
        stdout: '',
        stderr: 'service.port is required'
      }
    ],
    validationIssues: [
      {
        kind: 'helm-missing-service-port',
        repairable: true,
        sourceCommand: 'helm lint charts/payments-api',
        message: 'service.port is required'
      }
    ]
  }));
  const repairStep = repairCompact.harness.workPlan.steps.find(step => step.kind === 'validation');
  assert.equal(repairCompact.harness.workPlan.status, 'blocked');
  assert.equal(repairCompact.harness.workPlan.blockerKind, 'repair-budget');
  assert.equal(repairCompact.harness.workPlan.nextControlAction, 'manual-repair');
  assert.equal(repairStep?.status, 'blocked');
  assert.equal(repairStep?.validationIssueKind, 'helm-missing-service-port');
  assert.equal(repairCompact.harness.plannerHandoff.activeBlocker.validationIssueKind, null);
  assert.equal(parseCompactAgentRunResult(repairCompact).kind, 'infra-agent.agent-result');

  const completedCompact = buildCompactAgentRunResult(makeState({
    outcome: 'completed',
    toolSummaries: [readFileSummary],
    validationResults: [
      {
        command: 'helm lint charts/payments-api',
        exitCode: 0,
        stdout: 'ok',
        stderr: ''
      }
    ]
  }));
  assert.equal(completedCompact.harness.workPlan.status, 'completed');
  assert.equal(completedCompact.harness.workPlan.blockerKind, 'none');
  assert.equal(completedCompact.harness.workPlan.currentStepIndex, null);
  assert.equal(completedCompact.harness.workPlan.skippedStepCount, 1);
  assert.ok(completedCompact.harness.workPlan.steps.some(step =>
    step.kind === 'edit'
    && step.status === 'skipped'
  ));
  assert.ok(completedCompact.harness.workPlan.steps.some(step =>
    step.kind === 'validation'
    && step.status === 'completed'
  ));
  assert.ok(completedCompact.harness.workPlan.steps.some(step =>
    step.kind === 'handoff'
    && step.status === 'completed'
  ));
  assert.equal(parseCompactAgentRunResult(completedCompact).kind, 'infra-agent.agent-result');
  assert.throws(
    () => parseCompactAgentRunResult({
      ...completedCompact,
      harness: {
        ...completedCompact.harness,
        workPlan: {
          ...completedCompact.harness.workPlan,
          currentStepIndex: 3
        }
      }
    }),
    /harness\.workPlan\.currentStepIndex must be null/
  );

  const noSafeCompact = buildCompactAgentRunResult(makeState({
    outcome: 'no-safe-action'
  }));
  assert.equal(noSafeCompact.harness.workPlan.status, 'blocked');
  assert.equal(noSafeCompact.harness.workPlan.blockerKind, 'no-safe-action');
  assert.equal(noSafeCompact.harness.workPlan.nextControlAction, 'inspect-readiness-or-targeting');
  assert.equal(noSafeCompact.harness.workPlan.currentStepIndex, 5);
  assert.equal(parseCompactAgentRunResult(noSafeCompact).kind, 'infra-agent.agent-result');
});

test('agent CLI compact JSON includes work plan handoff', async () => {
  const previousExitCode = process.exitCode;
  process.exitCode = 0;

  try {
    const output = await captureStdout(() => main([
      'agent',
      'add ingress to payments-api dev chart',
      '--workspace',
      'fixtures/sample-workspace',
      '--planner',
      'rule-based',
      '--max-turns',
      '1',
      '--context-fact-limit',
      '2',
      '--json'
    ]));
    const jsonStart = output.indexOf('{');
    const jsonEnd = output.lastIndexOf('}');
    const compact = JSON.parse(output.slice(jsonStart, jsonEnd + 1));

    assert.equal(compact.kind, 'infra-agent.agent-result');
    assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
    assert.equal(compact.outcome, 'no-safe-action');
    assert.equal(compact.knowledgeFacts.kind, 'infra-agent.knowledge-facts-summary');
    assert.equal(compact.knowledgeFacts.maxFacts, 2);
    assert.ok(compact.knowledgeFacts.totalFactCount > 0);
    assert.ok(compact.knowledgeFacts.includedFactCount <= 2);
    assert.deepEqual(compact.handoffCheckpoint.budgets.knowledgeFacts, {
      includedCount: compact.knowledgeFacts.includedFactCount,
      omittedCount: compact.knowledgeFacts.omittedFactCount
    });
    assert.ok(compact.resultCard.some(line => /Knowledge facts: \d+\/\d+ fact\(s\) included; max 2/i.test(line)));
    assert.doesNotMatch(JSON.stringify(compact.knowledgeFacts), /"content"\s*:|contentHash|fetchedAt|"\$schema"/);
    assert.equal(compact.harness.workPlan.schemaVersion, 1);
    assert.equal(compact.harness.workPlan.blockerKind, compact.harness.plannerHandoff.activeBlocker.kind);
    assert.equal(compact.harness.workPlan.nextControlAction, compact.harness.plannerHandoff.nextControlAction);
    assert.equal(compact.handoffCheckpoint.budgets.workPlan.includedCount, compact.harness.workPlan.includedCount);
    assert.equal(compact.handoffCheckpoint.budgets.workPlan.omittedCount, compact.harness.workPlan.omittedCount);
    assert.ok(compact.resultCard.some(line => /Work plan: blocked; current handoff\/blocked; completed \d+\/6; blocked \d+; skipped \d+; next/i.test(line)));
    assert.equal(process.exitCode, INFRA_AGENT_EXIT_CODES.noSafeAction);
  } finally {
    process.exitCode = previousExitCode;
  }
});

test('agent CLI compact JSON preserves explicit approval grants', async () => {
  const previousExitCode = process.exitCode;
  process.exitCode = 0;

  try {
    const output = await captureStdout(() => main([
      'agent',
      'update payments-api chart deeply',
      '--workspace',
      'fixtures/sample-workspace',
      '--planner',
      'rule-based',
      '--approve-write-risk',
      'high',
      '--approve-write-path',
      'charts/payments-api',
      '--approve-tool-category',
      'native-stack-config-write',
      '--json'
    ]));
    const jsonStart = output.indexOf('{');
    const jsonEnd = output.lastIndexOf('}');
    const compact = JSON.parse(output.slice(jsonStart, jsonEnd + 1));

    assert.equal(compact.kind, 'infra-agent.agent-result');
    assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
    assert.deepEqual(compact.approval.grants, {
      approvedWriteRisks: ['high'],
      approvedWritePaths: ['charts/payments-api'],
      approvedToolCategories: ['native-stack-config-write'],
      writePathScope: 'scoped',
      hasExplicitApproval: true
    });
    assert.ok(compact.resultCard.some(line =>
      /Approval grants: write risks high; write paths charts\/payments-api; tool categories native-stack-config-write; write path scope scoped/i.test(line)
    ));
    assert.equal(process.exitCode, INFRA_AGENT_EXIT_CODES.clarificationRequired);
  } finally {
    process.exitCode = previousExitCode;
  }
});

test('buildCompactAgentRunResult exposes skipped turn execution reasons', async () => {
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
  const state = {
    modelName: 'test-model',
    outcome: 'no-safe-action',
    preflight,
    runtime,
    turns: [
      {
        index: 0,
        decision: {
          confidence: 'low',
          action: {
            kind: 'validate-targets',
            summary: 'Validation skipped',
            rationale: 'No command payload was available.',
            payload: {
              commands: [],
              actionFamily: 'helm-validation'
            }
          }
        },
        execution: {
          status: 'skipped',
          executedTools: [],
          reason: 'No validation commands were present in the decision payload.'
        },
        runtimeSnapshot: runtime
      }
    ]
  };
  const compact = buildCompactAgentRunResult(state);

  assert.equal(compact.harness.turnTrace[0]?.executionStatus, 'skipped');
  assert.equal(compact.harness.lifecycleEvents.totalCount, 3);
  assert.equal(compact.harness.lifecycleEvents.includedCount, 3);
  assert.equal(compact.harness.lifecycleEvents.eventCounts.decision, 1);
  assert.equal(compact.harness.lifecycleEvents.eventCounts.terminal, 1);
  assert.ok(compact.harness.lifecycleEvents.events.some(event =>
    event.event === 'decision'
    && event.actionKind === 'validate-targets'
    && event.executionStatus === 'skipped'
    && /No validation commands/.test(event.reason ?? '')
  ));
  assert.equal(compact.harness.lifecycleEvents.events.at(-1)?.event, 'terminal');
  assert.equal(compact.harness.lifecycleEvents.events.at(-1)?.outcome, 'no-safe-action');
  assert.equal(
    compact.harness.turnTrace[0]?.executionReason,
    'No validation commands were present in the decision payload.'
  );
  assert.deepEqual(compact.harness.plannerHandoff.lastAction, {
    kind: 'validate-targets',
    family: 'helm-validation',
    stopReason: null,
    clarificationKind: null,
    executionStatus: 'skipped'
  });
  assert.equal(compact.harness.plannerHandoff.activeBlocker.kind, 'turn-budget');
  assert.equal(compact.harness.plannerHandoff.nextControlAction, 'rerun-with-larger-turn-budget');
  assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
});

test('buildCompactAgentRunResult preserves capped tool trace tail window', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const toolSummaries = Array.from({ length: 10 }, (_, index) => ({
    turnIndex: index,
    actionKind: 'inspect-target-files',
    toolName: 'read_file',
    safety: 'read_only',
    summary: `Read target file ${index}.`
  }));
  const compact = buildCompactAgentRunResult({
    modelName: 'test-model',
    outcome: 'no-safe-action',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      toolSummaries,
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: [],
    config: resolveQueryLoopConfig()
  });

  assert.equal(compact.harness.toolTrace.totalCount, 10);
  assert.equal(compact.harness.toolTrace.maxEntries, 8);
  assert.equal(compact.harness.toolTrace.includedCount, 8);
  assert.equal(compact.harness.toolTrace.omittedCount, 2);
  assert.equal(compact.harness.toolTrace.preservedWindow, 'tail');
  assert.equal(compact.harness.toolTrace.firstIncludedTurnIndex, 2);
  assert.equal(compact.harness.toolTrace.lastIncludedTurnIndex, 9);
  assert.equal(compact.harness.toolTrace.latestTurnIndex, 9);
  assert.deepEqual(
    compact.harness.toolTrace.entries.map(entry => entry.turnIndex),
    [2, 3, 4, 5, 6, 7, 8, 9]
  );
  assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
});

test('buildCompactAgentRunResult exposes turn trace budget metadata when capped', async () => {
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
  const turns = Array.from({ length: 12 }, (_, index) => ({
    index,
    decision: {
      confidence: 'medium',
      action: {
        kind: 'inspect-target-files',
        summary: `Inspect turn ${index}`,
        rationale: 'Synthetic capped trace coverage.',
        payload: {
          actionFamily: 'runtime-inspection'
        }
      }
    },
    execution: {
      status: 'completed',
      executedTools: [],
      reason: null
    },
    runtimeSnapshot: runtime
  }));
  const compact = buildCompactAgentRunResult({
    modelName: 'test-model',
    outcome: 'no-safe-action',
    preflight,
    runtime,
    turns
  });

  assert.equal(compact.harness.turnTrace.length, 10);
  assert.equal(compact.harness.turnTraceOmittedCount, 2);
  assert.deepEqual(compact.harness.turnTraceBudget, {
    maxEntries: 10,
    totalCount: 12,
    includedCount: 10,
    omittedCount: 2,
    firstIncludedTurnIndex: 0,
    lastIncludedTurnIndex: 9,
    preservedWindow: 'head'
  });
  assert.equal(parseCompactAgentRunResult(compact).kind, 'infra-agent.agent-result');
});

test('buildCompactAgentRunResult includes budgeted validation command summaries', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const longStdout = 'x'.repeat(420);
  const runtime = {
    task: preflight.task,
    preflight,
    observations: [],
    appliedWrites: [],
    validationResults: [
      {
        command: 'infra-agent yaml-parse terraform/payments-api/dev.auto.tfvars',
        exitCode: 0,
        stdout: 'YAML ok',
        stderr: ''
      },
      {
        command: 'terraform -chdir=terraform/payments-api validate',
        exitCode: 1,
        stdout: longStdout,
        stderr: 'Error: Missing required argument'
      },
      {
        command: 'terraform -chdir=terraform/payments-api apply -auto-approve',
        exitCode: 1,
        stdout: '',
        stderr: 'infra-agent blocked unsafe validation command: Terraform apply is not validation [terraform-apply]'
      }
    ],
    validationIssues: [],
    approvalSignals: [],
    repairAttempts: 0,
    lastEditPlan: null
  };
  const compact = buildCompactAgentRunResult({
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime,
    turns: []
  });

  assert.equal(compact.validation.commands.maxEntries, 8);
  assert.equal(compact.validation.commands.omittedCount, 0);
  assert.equal(compact.validation.commands.entries[0]?.kind, 'yaml-guard');
  assert.equal(compact.validation.commands.entries[1]?.status, 'failed');
  assert.equal(compact.validation.commands.entries[1]?.stdoutPreview.length, 303);
  assert.equal(compact.validation.commands.entries[1]?.unsafeRuleId, null);
  assert.equal(compact.validation.commands.entries[1]?.unsafeReason, null);
  assert.equal(compact.validation.commands.entries[2]?.unsafeBlocked, true);
  assert.equal(compact.validation.commands.entries[2]?.unsafeRuleId, 'terraform-apply-destroy');
  assert.equal(
    compact.validation.commands.entries[2]?.unsafeReason,
    'Terraform apply and destroy commands are deploy/state mutation operations, not validation.'
  );
  assert.equal(Object.hasOwn(compact, 'runtime'), false);
});

test('buildCompactAgentRunResult includes grouped validation issue summary', async () => {
  const preflight = await buildRunPreflight('update terraform payments-api dev image tag to 2.3.4', 'fixtures/terraform-workspace');
  const validationIssues = [
    {
      kind: 'terraform-validate-failure',
      repairable: true,
      sourceCommand: 'terraform -chdir=terraform/payments-api validate',
      message: 'Missing required argument.'
    },
    {
      kind: 'terraform-validate-failure',
      repairable: true,
      sourceCommand: 'terraform -chdir=terraform/payments-api validate -json',
      message: 'Missing required argument.'
    },
    {
      kind: 'yaml-syntax-failure',
      repairable: false,
      sourceCommand: 'infra-agent yaml-parse terraform/payments-api/dev.auto.tfvars',
      message: 'YAML syntax failed.',
      metadata: {
        yamlPath: 'terraform/payments-api/dev.auto.tfvars',
        yamlParser: 'yaml'
      }
    },
    {
      kind: 'unsafe-validation-command',
      repairable: false,
      sourceCommand: 'terraform -chdir=terraform/payments-api apply',
      message: 'Unsafe validation command blocked.',
      metadata: {
        unsafeCommand: 'terraform -chdir=terraform/payments-api apply',
        unsafeReason: 'Terraform apply and destroy commands are deploy/state mutation operations, not validation.'
      }
    },
    {
      kind: 'helm-missing-service-port',
      repairable: true,
      sourceCommand: 'helm template payments-api charts/payments-api',
      message: 'service.port is required.'
    },
    {
      kind: 'helm-missing-ingress-values',
      repairable: true,
      sourceCommand: 'helm template payments-api charts/payments-api',
      message: 'ingress.enabled is required.'
    },
    {
      kind: 'pulumi-missing-config',
      repairable: true,
      sourceCommand: 'pulumi preview --stack dev',
      message: 'Missing stack config.'
    },
    {
      kind: 'pulumi-preview-failure',
      repairable: false,
      sourceCommand: 'pulumi preview --stack dev',
      message: 'Preview failed.'
    },
    {
      kind: 'terraform-formatting-required',
      repairable: true,
      sourceCommand: 'terraform -chdir=terraform/payments-api fmt -check',
      message: 'Terraform formatting is required.'
    },
    {
      kind: 'unknown-validation-failure',
      repairable: false,
      sourceCommand: 'custom validate',
      message: 'Unknown validation failed.'
    }
  ];
  const state = {
    modelName: 'test-model',
    outcome: 'validation-blocked',
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues,
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null
    },
    turns: []
  };
  const compact = buildCompactAgentRunResult(state);
  const resultCard = summarizeResultCard(state);

  assert.equal(compact.validation.issueSummary.totalCount, 10);
  assert.equal(compact.validation.issueSummary.omittedIssueCount, 5);
  assert.equal(compact.validation.issueSummary.repairableCount, 6);
  assert.equal(compact.validation.issueSummary.nonRepairableCount, 4);
  assert.equal(compact.validation.issueSummary.maxGroups, 8);
  assert.equal(compact.validation.issueSummary.groups.length, 8);
  assert.equal(compact.validation.issueSummary.omittedGroupCount, 1);
  assert.deepEqual(compact.validation.issueSummary.groups[0], {
    kind: 'terraform-validate-failure',
    repairable: true,
    count: 2,
    sourceCommandCount: 2,
    blocking: true
  });
  assert.deepEqual(compact.validation.issueSummary.flags, {
    hasRepairableIssues: true,
    hasNonRepairableIssues: true,
    hasUnsafeValidationCommand: true,
    hasYamlSyntaxFailure: true,
    hasIdentityConflict: false
  });
  assert.deepEqual(compact.validation.issueDetails, {
    maxEntries: 5,
    omittedCount: 5
  });
  assert.equal(compact.validation.issueDetails.omittedCount, compact.validation.issueSummary.omittedIssueCount);
  assert.equal(compact.validation.safetyBlockers.maxEntries, 5);
  assert.equal(compact.validation.safetyBlockers.omittedCount, 0);
  assert.equal(compact.validation.safetyBlockers.entries.length, 2);
  const yamlSafetyBlocker = compact.validation.safetyBlockers.entries.find(entry => entry.kind === 'yaml-syntax-failure');
  const unsafeSafetyBlocker = compact.validation.safetyBlockers.entries.find(entry => entry.kind === 'unsafe-validation-command');
  assert.equal(yamlSafetyBlocker?.mutationPrevented, true);
  assert.equal(yamlSafetyBlocker?.yamlPath, 'terraform/payments-api/dev.auto.tfvars');
  assert.equal(yamlSafetyBlocker?.yamlParser, 'yaml');
  assert.equal(yamlSafetyBlocker?.unsafeRuleId, null);
  assert.equal(unsafeSafetyBlocker?.mutationPrevented, true);
  assert.equal(unsafeSafetyBlocker?.unsafeCommand, 'terraform -chdir=terraform/payments-api apply');
  assert.equal(unsafeSafetyBlocker?.unsafeRuleId, 'terraform-apply-destroy');
  assert.equal(
    unsafeSafetyBlocker?.unsafeReason,
    'Terraform apply and destroy commands are deploy/state mutation operations, not validation.'
  );
  assert.equal(compact.validation.issues.length, 5);
  assert.equal(compact.harness.plannerHandoff.activeBlocker.kind, 'validation');
  assert.equal(compact.harness.plannerHandoff.activeBlocker.validationIssueKind, 'terraform-validate-failure');
  assert.equal(compact.harness.plannerHandoff.nextControlAction, 'resolve-validation');
  assert.ok(resultCard.some(line => /Validation blockers: 10 issue\(s\); 6 repairable, 4 non-repairable; top terraform-validate-failure x2; omitted issues=5, groups=1/i.test(line)));
});

test('buildCompactAgentRunResult maps planner handoff controls by outcome', async () => {
  const preflight = await buildRunPreflight('add ingress to payments-api dev chart', 'fixtures/sample-workspace');
  const retrievedContextBudget = {
    maxPackets: 5,
    maxTokens: 1000,
    maxExcerptChars: 600
  };
  const makeTurn = (actionKind = 'stop', payload = { stopReason: 'done' }) => ({
    index: 0,
    decision: {
      action: {
        kind: actionKind,
        summary: `${actionKind} summary`,
        payload
      },
      confidence: 0.9
    },
    execution: {
      status: 'skipped',
      reason: null,
      executedTools: []
    },
    runtimeSnapshot: {
      appliedWrites: [],
      validationIssues: [],
      approvalSignals: []
    }
  });
  const makeState = ({
    outcome,
    runtime = {},
    turns = [makeTurn()],
    maxTurns = 6,
    maxRepairAttempts = 2
  }) => ({
    modelName: 'test-model',
    outcome,
    preflight,
    runtime: {
      task: preflight.task,
      preflight,
      observations: [],
      appliedWrites: [],
      validationResults: [],
      validationIssues: [],
      approvalSignals: [],
      repairAttempts: 0,
      lastEditPlan: null,
      retrievedContext: [],
      retrievedContextBudget,
      ...runtime
    },
    turns,
    config: {
      maxTurns,
      maxRepairAttempts,
      retrievedContextBudget
    }
  });
  const cases = [
    {
      name: 'completed',
      state: makeState({ outcome: 'completed' }),
      activeBlockerKind: 'none',
      nextControlAction: 'review-result'
    },
    {
      name: 'approval-required',
      state: makeState({
        outcome: 'approval-required',
        runtime: {
          approvalSignals: [
            {
              kind: 'write-approval-required',
              path: 'charts/payments-api/values.yaml',
              risk: 'high',
              message: 'Approval required.'
            }
          ]
        }
      }),
      activeBlockerKind: 'approval',
      nextControlAction: 'request-approval',
      approvalSignalKind: 'write-approval-required'
    },
    {
      name: 'clarification-required',
      state: makeState({
        outcome: 'clarification-required',
        turns: [makeTurn('ask-for-clarification', {
          actionFamily: 'helm-edit',
          clarificationKind: 'target',
          question: 'Which target should be changed?'
        })]
      }),
      activeBlockerKind: 'clarification',
      nextControlAction: 'answer-clarification'
    },
    {
      name: 'validation-blocked',
      state: makeState({
        outcome: 'validation-blocked',
        runtime: {
          validationIssues: [
            {
              kind: 'terraform-validate-failure',
              repairable: true,
              sourceCommand: 'terraform -chdir=terraform/payments-api validate',
              message: 'Missing required argument.'
            }
          ]
        }
      }),
      activeBlockerKind: 'validation',
      nextControlAction: 'resolve-validation',
      validationIssueKind: 'terraform-validate-failure'
    },
    {
      name: 'repair-budget-exhausted',
      state: makeState({
        outcome: 'repair-budget-exhausted',
        runtime: {
          repairAttempts: 2
        },
        maxRepairAttempts: 2
      }),
      activeBlockerKind: 'repair-budget',
      nextControlAction: 'manual-repair'
    },
    {
      name: 'no-safe-action',
      state: makeState({
        outcome: 'no-safe-action',
        turns: [makeTurn('inspect-target-files', { actionFamily: 'inspection' })],
        maxTurns: 3
      }),
      activeBlockerKind: 'no-safe-action',
      nextControlAction: 'inspect-readiness-or-targeting'
    },
    {
      name: 'turn-budget',
      state: makeState({
        outcome: 'no-safe-action',
        turns: [makeTurn('inspect-target-files', { actionFamily: 'inspection' })],
        maxTurns: 1
      }),
      activeBlockerKind: 'turn-budget',
      nextControlAction: 'rerun-with-larger-turn-budget'
    }
  ];

  for (const entry of cases) {
    const handoff = buildCompactAgentRunResult(entry.state).harness.plannerHandoff;
    assert.equal(handoff.activeBlocker.kind, entry.activeBlockerKind, entry.name);
    assert.equal(handoff.nextControlAction, entry.nextControlAction, entry.name);
    assert.equal(handoff.activeBlocker.validationIssueKind, entry.validationIssueKind ?? null, entry.name);
    assert.equal(handoff.activeBlocker.approvalSignalKind, entry.approvalSignalKind ?? null, entry.name);
  }
});
