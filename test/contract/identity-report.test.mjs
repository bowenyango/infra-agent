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

test('identity-report loader renders compact conflict reports from a JSON file', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-identity-report-'));
  const inputPath = join(tempRoot, 'agent-result.json');

  try {
    await writeFile(inputPath, JSON.stringify({
      kind: 'infra-agent.agent-result',
      schemaVersion: 1,
      task: 'update terraform listener priority',
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
          validationIssueCount: 3,
          identityConflictCount: 3,
          approvalContinuationRequired: false,
          changedFileCount: 0
        },
        budgets: buildCompactHandoffBudgetsFixture({
          validationIssues: { includedCount: 1, omittedCount: 2 },
          identityConflicts: { includedCount: 1, omittedCount: 2 }
        }),
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
          totalCount: 3,
          omittedIssueCount: 2,
          repairableCount: 0,
          nonRepairableCount: 3,
          maxGroups: 8,
          omittedGroupCount: 0,
          groups: [
            {
              kind: 'terraform-create-before-delete-conflict',
              repairable: false,
              count: 3,
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
          omittedCount: 2
        },
        issues: [
          {
            kind: 'terraform-create-before-delete-conflict',
            repairable: false,
            message: 'Terraform listener priority is already in use.',
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
          totalCount: 3,
          includedCount: 1,
          maxEntries: 5,
          omittedCount: 2,
          mutationAllowed: false,
          byEngine: {
            terraform: 3,
            pulumi: 0
          },
          byRiskCategory: {
            'create-before-delete-ordering': 3,
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
            riskCategory: 'create-before-delete-ordering',
            identity: {
              listenerRulePriorities: '100'
            },
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

    const report = await loadIdentityConflictIncidentReport(inputPath);
    assert.equal(report.kind, 'infra-agent.identity-conflict-report');
    assert.equal(report.sourceSchemaVersion, 1);
    assert.equal(report.mutationAllowed, false);
    assert.equal(report.incidentCount, 1);
    assert.equal(report.omittedIncidentCount, 2);
    assert.equal(report.incidentSummary.totalCount, 3);
    assert.equal(report.incidentSummary.includedCount, 1);
    assert.equal(report.incidentSummary.byEngine.terraform, 3);
    assert.equal(report.incidentSummary.byRiskCategory['create-before-delete-ordering'], 3);
    assert.equal(report.incidents[0]?.resourceLocator, 'aws_lb_listener_rule.api');
    assert.equal(report.incidents[0]?.riskCategory, 'create-before-delete-ordering');
    assert.equal(report.incidents[0]?.mutationAllowed, false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('identity conflict incident report contract validates read-only report shape', () => {
  const validReport = {
    kind: 'infra-agent.identity-conflict-report',
    schemaVersion: 1,
    sourceKind: 'infra-agent.agent-result',
    sourceSchemaVersion: 1,
    sourceTask: 'update terraform listener priority',
    workspaceRoot: '/workspace',
    outcome: 'validation-blocked',
    mutationAllowed: false,
    incidentCount: 1,
    omittedIncidentCount: 0,
    incidentSummary: {
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
    summary: [
      'Terraform AWS listener rule at aws_lb_listener_rule.api: listenerRulePriorities=100.'
    ],
    incidents: [
      {
        engine: 'terraform',
        issueKind: 'terraform-create-before-delete-conflict',
        conflictCode: 'PriorityInUse',
        conflictFamily: 'aws-lb-listener-rule',
        conflictLabel: 'AWS Load Balancer Listener Rule',
        resourceLocator: 'aws_lb_listener_rule.api',
        resourceType: 'aws_lb_listener_rule',
        identity: {
          listenerRulePriorities: '100'
        },
        riskCategory: 'create-before-delete-ordering',
        reviewSteps: [
          'Review Terraform locator aws_lb_listener_rule.api against existing state/stack ownership.'
        ],
        suggestedAction: 'Use an IaC-native rename mapping for logical renames.',
        sourceCommand: 'terraform -chdir=terraform/payments-api plan',
        mutationAllowed: false
      }
    ]
  };

  assert.equal(parseIdentityConflictIncidentReport(validReport).kind, 'infra-agent.identity-conflict-report');
  assert.throws(
    () => parseIdentityConflictIncidentReport({ ...validReport, kind: 'infra-agent.agent-result' }),
    /identity-conflict-report/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({ ...validReport, schemaVersion: 2 }),
    /schemaVersion 1/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({ ...validReport, mutationAllowed: true }),
    /mutationAllowed/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({ ...validReport, incidentCount: 2 }),
    /incidents length/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({
      ...validReport,
      incidentSummary: {
        ...validReport.incidentSummary,
        totalCount: 2
      }
    }),
    /incidentSummary counts/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({
      ...validReport,
      omittedIncidentCount: 1
    }),
    /omittedIncidentCount/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({
      ...validReport,
      incidentSummary: {
        ...validReport.incidentSummary,
        byEngine: {
          terraform: 0,
          pulumi: 0
        }
      }
    }),
    /incidentSummary\.byEngine counts/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({
      ...validReport,
      incidentSummary: {
        ...validReport.incidentSummary,
        byRiskCategory: {
          'create-before-delete-ordering': '1'
        }
      }
    }),
    /incidentSummary\.byRiskCategory/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({
      ...validReport,
      incidents: [
        {
          ...validReport.incidents[0],
          issueKind: 'pulumi-create-before-delete-conflict'
        }
      ]
    }),
    /incident at index 0.*issueKind/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({
      ...validReport,
      incidents: [
        {
          ...validReport.incidents[0],
          identity: {
            listenerRulePriorities: 100
          }
        }
      ]
    }),
    /incident at index 0 identity/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({
      ...validReport,
      incidents: [
        {
          ...validReport.incidents[0],
          riskCategory: 'unexpected'
        }
      ]
    }),
    /incident at index 0.*riskCategory/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({
      ...validReport,
      incidents: [
        {
          ...validReport.incidents[0],
          reviewSteps: ['review', 1]
        }
      ]
    }),
    /incident at index 0.*reviewSteps/
  );
  assert.throws(
    () => parseIdentityConflictIncidentReport({
      ...validReport,
      incidents: [
        {
          ...validReport.incidents[0],
          mutationAllowed: true
        }
      ]
    }),
    /incident at index 0.*mutationAllowed/
  );
});

test('identity-report loader rejects non-compact result inputs', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-identity-report-invalid-'));
  const inputPath = join(tempRoot, 'not-agent-result.json');

  try {
    await writeFile(inputPath, JSON.stringify({
      kind: 'infra-agent.infra-graph',
      validation: {
        identityConflicts: []
      }
    }), 'utf8');

    await assert.rejects(
      loadIdentityConflictIncidentReport(inputPath),
      /compact infra-agent\.agent-result/
    );

    await writeFile(inputPath, JSON.stringify({
      kind: 'infra-agent.agent-result',
      schemaVersion: 1,
      task: 'review terraform listener priority',
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
      validation: {}
    }), 'utf8');

    await assert.rejects(
      loadIdentityConflictIncidentReport(inputPath),
      /validation\.identityConflicts array/
    );

    await writeFile(inputPath, JSON.stringify({
      kind: 'infra-agent.agent-result',
      schemaVersion: 2,
      validation: {
        identityConflicts: []
      }
    }), 'utf8');

    await assert.rejects(
      loadIdentityConflictIncidentReport(inputPath),
      /schemaVersion 1/
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
